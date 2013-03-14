# from __future__ import with_statement
from fabric.api import *

env.hosts = ['adam@4uhm.com']

def deploy_master():
    release()
    deploy()
    local('git checkout master')

def release():
    local('git checkout release')
    local('git merge master')

def deploy():
    local('git push --mirror 4uhm.com:~/neko')
    with cd('/home/adam/neko'):
        run('git checkout -f release')
        run('sv restart neko')
        
    #     # run('python import_feeds.py')
    #     run('sv restart imagesoak')
    #     run('(echo flush_all ; echo quit ) | nc 127.0.0.1 11211')
