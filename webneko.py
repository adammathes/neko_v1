#!/usr/bin/python

import os
import sys
import datetime
import pymongo
import jinja2
import time
import json
import flask
import uuid
import calendar
import requests
from urlparse import urlsplit
import bleach
from xml.etree.ElementTree import ElementTree

SECRET_USERNAME = 'username'
SECRET_PASSWORD = 'password'



try:
    with open('auth', 'r') as f:
        auth = f.read()
    (SECRET_USERNAME, SECRET_PASSWORD) = auth.split(':')
except:
    print 'no valid auth file found'
    SECRET_USERNAME = os.getenv('NEKO_USERNAME', 'username')
    SECRET_PASSWORD = os.getenv('NEKO_PASSWORD', 'password')    
    # sys.exit()

app = flask.Flask(__name__)

flask.SEND_FILE_MAX_AGE_DEFAULT = 0

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
    
env = jinja2.Environment(loader=jinja2.FileSystemLoader(['templates'], encoding='utf-8'))


from functools import wraps
from flask import request, Response
def check_auth():
    username = request.cookies.get('username')
    password = request.cookies.get('password')
    return (username == SECRET_USERNAME) and (password == SECRET_PASSWORD)


def authenticate():
    with open('static/login.html', 'r') as f:
        out = f.read()
    return out


def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not check_auth():
            return authenticate()
        return f(*args, **kwargs)
    return decorated

def handler(obj):
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
#    elif isinstance(obj, ...):
#        return ...
    else:        
        return datetime.datetime.now().isoformat()
        raise TypeError, 'Object of type %s with value of %s is not JSON serializable' % (type(obj), repr(obj))


PER_PAGE = 15

@app.route('/logout/')
def logout():
    resp = flask.make_response('logged out')
    resp.set_cookie('username', '')
    resp.set_cookie('password', '')
    return resp


@app.route('/login/', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        with open('static/login.html', 'r') as f:
            out = f.read()
        return out

    username = request.form['username']
    password = request.form['password']

    if( (SECRET_USERNAME == username) and (SECRET_PASSWORD == password) ):
        print 'login success'
        resp = flask.make_response('login successful')
        resp.set_cookie('username', username, None, datetime.datetime.now()+datetime.timedelta(days=365))
        resp.set_cookie('password', password, None, datetime.datetime.now()+datetime.timedelta(days=365))
        return resp
    else:
        return flask.make_response('invalid login')


@app.route('/')
def boot():
    if(check_auth()):
        print 'valid auth'
        boot_template = 'static/ui.html'
    else:
        print 'invalid autho'
        boot_template = 'static/public.html'
        
    with open(boot_template, 'r') as f:
        out = f.read()
    return out


@app.route('/tag/<tag>/')
def tagged_items(tag):
    page = int(flask.request.args.get('page', 1))    
    items = db.items.find({'tag': tag}).sort('date', direction=pymongo.DESCENDING)[:20]
    return show_items(items, page)


def get_tags():
    tags = {}
    feeds = db.feeds.find()
    for f in feeds:
        tags[f['tag']] = 0

    tag_counts = db.items.group( ('feed.tag',), {'read': {'$ne': True}}, { 'unread': 0 }, 'function(obj,prev) { prev.unread++; }')
    for c in tag_counts:
        tags[c['feed.tag']] = c['unread']

    tags_list = []
    for tag in tags.keys():
        if tag:
            tags_list.append({'name':tag, 'unread': tags[tag]})
        
    return tags_list


@app.route('/stream/')
def stream(tag=None, starred=False):
    page = int(flask.request.args.get('page', 1))
    before_date = flask.request.args.get('date', None)

    search_term = flask.request.args.get('q', None)

    find_filter = {}
    find_filter['read'] = {'$ne': True}

    if(search_term):

        find_filter['description'] = {'$regex': search_term}
    
    if(before_date):
        try:
            find_filter['date'] = {'$lt': datetime.datetime.strptime( before_date, "%Y-%m-%dT%H:%M:%S" )}
        except:
            # maybe it has ms?
            find_filter['date'] = {'$lt': datetime.datetime.strptime( before_date, "%Y-%m-%dT%H:%M:%S.%f" )}
            
    if(tag):
        find_filter['feed.tag'] = tag

    if(starred):
        find_filter['starred'] = True

    feed_url = flask.request.args.get('feed_url', None)
    if(feed_url):
        find_filter['feed.url'] = feed_url

    read_filter = flask.request.args.get('read_filter', 'unread')
    if read_filter == 'all':
        del(find_filter['read'])

    print find_filter

    db.items.ensure_index([("date", pymongo.DESCENDING)])

    items = db.items.find(find_filter).sort("date", direction=pymongo.DESCENDING)[(page-1)*PER_PAGE:page*PER_PAGE]    
    items_array = []

    for i in items:
        i['description'] = bleach.clean(i['description'], tags=['blockquote', 'a', 'img', 'p', 'h1', 'h2', 'h3', 'h4', 'b', 'i', 'em' 'strong'], attributes = { 'a': ['href'], 'img': ['src', 'alt'] }, strip=True)
        items_array.append(i)
    x = json.dumps(items_array, default=handler)
    return flask.make_response(x)


@app.route('/stream/starred/')
@requires_auth
def stream_starred():
    return stream(tag=None, starred=True)


@app.route('/stream/tag/<tag>/')
def stream_by_tag(tag):
    return stream(tag)


@app.route('/tags/')
def tags():
    return flask.make_response(json.dumps(get_tags()))


@app.route('/feed/')
def feeds():
    feeds = db.feeds.find().sort('title')

    feeds_array = []
    for f in feeds:
        feeds_array.append(f)
        
    x = json.dumps(feeds_array, default=handler)

    return flask.make_response(json.dumps(feeds_array, default=handler))


@app.route('/feed/', methods=['POST'])
@requires_auth
def create_feed():
    print flask.request.json
    f = {
        '_id': str(uuid.uuid1()),
        'url': flask.request.json['url'],
        'tag': 'new'
        }
    print 'inserting new feed:', f
    db.feeds.insert(f)    
    return flask.jsonify({'feed': f});


@app.route('/feed/<feed_id>', methods=['PUT'])
@requires_auth
def update_feed(feed_id):
    db.feeds.update({'_id': feed_id}, flask.request.json)
    return flask.jsonify(flask.request.json)


@app.route('/feed/<feed_id>', methods=['DELETE'])
@requires_auth
def delete_feed(feed_id):
    db.feeds.remove({'_id': feed_id})
    return flask.jsonify({})


@app.route('/item/', methods=['PUT'])
@requires_auth
def update_item():

    try:
        r = flask.request.json['read']
    except:
        r = False

    try:
        s = flask.request.json['starred']
    except:
        s = False
        

    db.items.update({'_id': flask.request.json['_id']}, {"$set": {'read': r, 'starred': s}})
    return flask.jsonify(flask.request.json)


@app.route('/import/', methods=['GET', 'POST'])
def opml_import():
    if request.method == 'GET':
        return flask.render_template('import.html')

    if request.method == 'POST':
        print 'Importing!'
        opml_file = request.files['opml']

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
                    print "inserting ", tag, o.attrib['xmlUrl'], o.attrib['htmlUrl'], o.attrib['text'], tag
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
        return flask.make_response('importing!')


@app.route('/opml_preview/')
def opml_preview():
    try:
        url = flask.request.args.get('url')
    except:
        return flask.make_response('nice try, need an url')

    urls = []
    r = requests.get(url)
    tree = fromstring(r.content)
    outlines = tree.findall("body//outline")
    tag = None
    for o in outlines:
        try:
            htmlUrl = o.attrib['htmlUrl']
            urls.append(htmlUrl)
        except:
            pass

    out = ''
    for u in urls:
        out = out + '<p><a href="%s">%s</a></p>' % (u, u)
    return flask.make_response(out)


if __name__ == '__main__':
    app.debug = True
    port = int(os.environ.get('PORT', 9899))
    app.run('0.0.0.0', port=port)
