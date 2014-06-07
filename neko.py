#!/usr/bin/python

import os
import json
import time
import requests
import datetime
from datetime import datetime
import uuid
import calendar
import multiprocessing
from urlparse import urlsplit

from optparse import OptionParser

import pymongo
import jinja2
import feedparser

from xml.etree.ElementTree import ElementTree


TMP_DIR = 'tmp'

# mongo
mongodb_url = os.getenv('MONGOLAB_URI', 'mongodb://127.0.0.1:27017')
parsed = urlsplit(mongodb_url)
db_name = parsed.path[1:]
if not db_name:
    db_name = 'neko'
connection = pymongo.Connection(mongodb_url)
db = pymongo.Connection(mongodb_url)[db_name]
if '@' in mongodb_url:
    user_pass = parsed.netloc.split('@')[0].split(':')
    db.authenticate(user_pass[0], user_pass[1])


def import_opml(opml_file):
    tree = ElementTree()    
    tree.parse(opml_file)
    outlines = tree.findall(".//outline")
    tag = None
    # TODO: fix this for all opml formats
    for o in outlines:
        xmlurl = None
        try:
            xmlurl = o.attrib['xmlUrl']
        except:
            tag = o.attrib['text']

        if xmlurl:
            try:
#                print "inserting ", tag, o.attrib['xmlUrl'], o.attrib['htmlUrl'], o.attrib['text'], tag
                f = {
                    '_id': str(uuid.uuid1()),
                    'title': o.attrib['text'],
                    'url': o.attrib['xmlUrl'],
                    'web_url': o.attrib['htmlUrl'],
                    'tag': tag,                
                    }
                db.feeds.update({'url': f['url']}, f, True)
            except:
                pass
                

def update():
    db.items.ensure_index('url')    
    feeds = db.feeds.find({})
    pool = multiprocessing.Pool(processes=5)
    result = pool.map_async(crawl_feed, feeds)
    result.wait(300)
    


def crawl_feed(feed):
    parsed = feedparser.parse(feed['url'])

    try:
        feed['title'] = parsed.feed.title
        feed['web_url'] = parsed.feed.link
        print "updating " + feed['title']
    except:
        pass
    
    db.feeds.update({'url': feed['url']}, feed, True)

    for feed_item in parsed.entries:
        try:
            process_feed_item(feed_item, feed)
        except:
            print 'problem inserting'
        

def process_feed_item(feed_item, feed):
#    print 'inserting %s' % feed_item.link
    
    if(db.items.find({'url': feed_item.link}).count() > 0):
        # print 'already there, done'
        # TODO handle updates
        return

    
    i = {
        # DO BETTER STUFF
        '_id': str(uuid.uuid1()),
        'title': feed_item.get('title', ''),
        'feed': feed,
    }

    i['url'] = feed_item.link

    try:
        i['description'] = feed_item.content[0].value
    except:
        i['description'] = feed_item.description

    try:
        i['date'] = datetime.fromtimestamp(calendar.timegm(feed_item.published_parsed))
    except:
        i['date'] = datetime.now()

    db.items.insert(i)
   
            
def main():

    usage ='nekko.py update | reset | import [opml_file]'
    parser = OptionParser(usage)
    (options, args) = parser.parse_args()

    command = None
    try:
        command = args[0]
    except:
        print usage

    if command == 'update':
        update()

    if command == 'allread':
        print 'marking all read'
        db.items.update({}, { '$set' : { 'read' : True } }, multi=True)

    if command == 'import':
        import_opml(args[1])

    if command == 'reset':
        print 'resetting'
        db.items.remove()
        db.feeds.remove()

    if command == 'counts':
        counts = db.items.group( ('feed.tag',), {'read': {'$ne': True}}, { 'unread': 0 }, 'function(obj,prev) { prev.unread++; }')
        print counts


if __name__ == "__main__":
    main()

