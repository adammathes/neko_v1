# Neko

## Description

Neko is a personal feed reader that displays a "river of news."

It is intended for a single user. Put in your feeds, and it will track what you have read.

It also includes a "public" view of all items for you to share what you're reading with others.

It's a little rough around the edges and tough to install right now, but I've been using it for almost a year and wanted to share.

The cat ears are in your mind.

Demo: http://adamsneko.herokuapp.com

## License

BSD license.

## Requirements

python (tested with 2.7)
See requirements.txt for required python modules.

## Installation

Clone the neko repo

    > git clone git@github.com:adammathes/neko.git

Install python dependencies.

    > pip install -r requirements.txt

Import your OPML. (optional)

    > ./neko.py import feeds.opml

Run the crawler

    > ./neko.py update

Run the web interface

    > ./webneko.py

View it in a browser at http://127.0.0.1:9899

## Running on Heroku

Clone the neko nepo.

    > git clone git@github.com:adammathes/neko.git

Create a new herou app.

    > heroku apps:create neko[somethingsomething]
    
Set up addons.

    > heroku addons:add mongolab:starter
    > heroku addons:add scheduler:standard

Check in your feed import to feeds.opml if you'd like.

Push it up.

    > git push heroku master

Import your feeds.

    > heroku run python neko.py import feeds.opml

Run the crawler

    > heroku run python neko.py update

If you want, add that to your scheduler to autoupdate your feeds. (May cost $)

## Auth

This is a total hack and will be improved.

Add a file called "auth" with a single line of username:password

Visit /login/ to sign in and /logout/ to sign out. (I know, I know.)

## Customizing

Templates and css are in the static directory.