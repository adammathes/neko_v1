var templates = {};

$(document).ready(function() {
    boot();
});

var AppModel =  Backbone.Model.extend({
    defaults: {
        'selectedIndex': 0,
        'starredFilter': false,
        'allFilter': false,
        'unreadFilter': true,
        'feedFilter': undefined,
        'searchFilter': undefined
    },

    initialize: function() {
        this.bind('change:selectedIndex', this.scroll_to_selected);
//        this.bind('change:selectedIndex', this.scroll_to_selected)
    },

    boot: function() {
        this.items.boot();
        this.tags.boot();
        this.feeds.fetch({add: true});
        window.setInterval(function() { App.update_read_status() }, 5000);
        
    },

    filterToFeed: function(feed) {
        this.set('feedFilter', feed);
        this.items.reboot();
    },

    filterToStarred: function() {
        this.set('starredFilter', true);
        this.set('allFilter', false);
        this.set('unreadFilter', false);
        this.items.reboot();
    },

    filterToAll: function() {
        this.set('starredFilter', false);
        this.set('allFilter', true);
        this.set('unreadFilter', false);
        this.items.reboot();
    },

    filterToUnread: function() {
        this.set('starredFilter', false);
        this.set('allFilter', false);
        this.set('unreadFilter', true);
        this.items.reboot();
    },

    filterToSearch: function() {
        this.set('searchFilter', $('#search').val());
        // this.set('starredFilter', false);
        // this.set('allFilter', true);
        // this.set('unreadFilter', false);
        this.items.reboot();
    },

    update_read_status: function() {
        if(PUBLIC_VERSION) {
            return;
        }

        var screen_top = $(window).scrollTop();
        var screen_bottom = $(window).scrollTop() +  $(window).height();

        // // mark all visible items as read
        $.each($('.item'), function(i,v) {
	        var item_top = $(v).offset().top;
            // console.log("i ", i, "item_top ", item_top, "screen_top ", screen_top, "screen_bottom ", screen_bottom);

            if( (item_top < screen_top)) {
                App.items.at(i).markRead();
            //    console.log('marking as read: ', i);
	        }
        });
//        window.setTimeout(App.update_read_status, 5000);
    },

    scroll_to_selected: function() {
	    var item = $('.item').eq(this.get('selectedIndex'));
        if(item.offset()) {
	        var item_top = item.offset().top;
	        $('.item').removeClass('selected');
	        item.addClass('selected');
	        $(window).scrollTop(item_top);
        }
        App.items.at(this.get('selectedIndex')).markRead();
        if(App.items.models.length>1) {
            if(this.get('selected')>=App.items.models.length-1) {
                App.items.boot();
            }
        }
    },
    
    next: function() {
	    if(this.get('selectedIndex') < this.items.models.length-1) {
	        this.set('selectedIndex', this.get('selectedIndex')+1);
	    }
        if(this.get('selectedIndex') == this.items.models.length-1) {
            App.items.boot();
        }
    },

    previous: function() {
	    if(this.get('selectedIndex') > 0) {
	        this.set('selectedIndex', this.get('selectedIndex')-1);
	    }
    }
});
var App = new AppModel();

var ControlsView = Backbone.View.extend({
    className: 'controls',

    events: {
        'click .starred_filter': 'filterToStarred',
        'click .all_filter': 'filterToAll',
        'click .unread_filter': 'filterToUnread',
        'click .new_feed': 'newFeed',
        'click .search_go': 'filterToSearch',
    },

    initialize: function() {
	    _.bindAll(this, 'render');
	    this.model.bind('change', this.render);
    },

    filterToStarred: function() {
        App.filterToStarred();
    },

    filterToAll: function() {
        App.filterToAll();
    },

    filterToUnread: function() {
        App.filterToUnread();
    },

    filterToSearch: function() {
        App.filterToSearch();
    },
   
    newFeed: function() {
        var feed_url = prompt('New url to subscribe to');
        var feed = new Feed({'url': feed_url});
        App.feeds.add(feed);
        feed.save();
    },

	render: function() {
        var h = $.tmpl(templates.controls_template, { 'app': this.model.toJSON() });
	    $(this.el).html(h);
	    return this;
	},

});



var Item = Backbone.Model.extend({
    idAttribute: "_id",
    url: '/item/',

    initialize: function() {
        this.bind('change', this.maybeSave);
    },

    maybeSave: function() {
        if(PUBLIC_VERSION) {
            return;
        }

        if(this.hasChanged()) {
            this.save();
        }
    },

    markRead: function() {
        // recover if not tag
        if(this.get('read')) {
	        return;
        }

        var t = this.get('feed').tag;
        var tag = App.tags.find(function(x){ return x.get('name') == t });
        this.set('read', true);
        if(tag) {
            tag.set('unread', tag.get('unread')-1);
        }
    },

    star: function() {
        console.log('starring item', this);
        this.set({'starred': true});
   //     this.save();
    },

    unstar: function() {
        console.log('unsstarring item', this);
        this.set({'starred': false});
     //   this.save();
    }

});


var ItemCollection = Backbone.Collection.extend({
    model: Item,
	initialize: function() {
	    _.bindAll(this, 'boot', 'reboot');
    },

    boot: function() {
        if(App.loading) {
            return;
        }
        if(App.noMore) {
            return;
        }

        App.loading = true;
        url = '/stream/';
        if(App.get('starredFilter')) {
            url = url + 'starred/';
        }
        if(App.tag != undefined) {
	         url = url + 'tag/' + App.tag + '/';
        }
        url=url+'?foo=bar'
        if(App.get('searchFilter')) {
            url = url + '&q=' + App.get('searchFilter');
        }

        if(App.get('feedFilter')) {
            url = url + '&feed_url=' + App.get('feedFilter').get('url');
        }

        if(App.items.last()) {
            url = url + '&date=' + App.items.last().get('date');
        }

        if(App.get('allFilter') || App.get('starredFilter')) {
	        url = url + '&read_filter=all';
        }

        if(PUBLIC_VERSION) {
	        url = url + '&read_filter=all';
        }

        console.log('fetching from ', url);

        var t = this;
        $.getJSON(url, function(data) {
            var items = [];
	        $.each(data, function(i,v) {
                var item = new Item(v);
                t.add(item);
                items.push(item);
                if(t.models.length==1){
                    App.set('selectedIndex', 0);
                }
	        });
            if(data.length == 0) {
                App.nomore = true;
            }
            App.loading = false;           

            // we wait and add them all at once for performance on mobile
            App.itemListView.addAll(items);

        });        
    },

    reboot: function() {
        App.noMore = false;
        this.reset();
        this.boot();
    },


});
App.items = new ItemCollection();


var ItemView = Backbone.View.extend({
	tagName: "div",	
	className: "item",
	template: templates.item_template,
	events: {
        "click .star": "star",
        "click .unstar": "unstar",
    },
	
	initialize: function() {
	    _.bindAll(this, 'render', 'star');
	    // this.model.bind('change', this.render);
	},

    star: function() {
        this.model.star();
        this.render();
    },

    unstar: function() {
        this.model.unstar();
        this.render();
    },

	render: function() {
        var h = $.tmpl(templates.item_template, { 'item': this.model.toJSON() });
	    $(this.el).html(h);
	    return this;
	},
});

var ItemListView = Backbone.View.extend( {
	initialize: function() {
	    _.bindAll(this, 'addOne', 'addAll', 'change', 'render', 'reset');
	    // App.items.bind('add', this.addOne);	    
	    App.items.bind('reset', this.reset);
	},
	addOne: function(item) {
	    var view = new ItemView({'model': item});
        this.$el.append(view.render().el);
	},
	addAll: function(items) {
	    // Posts.each(this.addOne);
        for(i in items) {
            item = items[i];
            var view = new ItemView({'model': item});
            this.$el.append(view.render().el);
        };
	},
    change: function() {
    },
    render: function() {
    },
    reset: function() {
        this.$el.children().remove();
    }
});
                                       

var Tag = Backbone.Model.extend({
});

var TagCollection = Backbone.Collection.extend({
    model: Tag,
	initialize: function() {
	    _.bindAll(this, 'boot');
    },

    boot: function() {
        var t = this;
        $.getJSON('/tags/', function(data) {
	        $.each(data, function(i,v) {
                var tag = new Tag(v);
                t.add(tag);
	        });
        });
    }
});
App.tags = new TagCollection();


var TagView = Backbone.View.extend({
	tagName: "li",	
	className: "tag",
	events: {
        "click": "filterTo",
    },
	initialize: function() {
	    _.bindAll(this, 'render', 'filterTo');
	    this.model.bind('change', this.render);
	},
	render: function() {
        var h = $.tmpl(templates.tag_template, { 'tag': this.model.toJSON() });
	    $(this.el).html(h);
        if(this.model.get('unread')) {
            $(this.el).addClass('hasunread');
        }
	    return this;
	},
    filterTo: function() {
        console.log('clicked on', this);
        App.tag = this.model.get('name');
        App.items.reboot();
    }
});


var TagListView = Backbone.View.extend( {

	initialize: function() {
	    _.bindAll(this, 'addOne', 'addAll', 'change', 'render');
	    App.tags.bind('add', this.addOne);
	    App.tags.bind('refresh', this.addAll);
	    App.tags.bind('change', this.render);
	},
	addOne: function(tag) {
	    var view = new TagView({'model': tag});
        this.$el.append(view.render().el);
	},
	addAll: function() {
	    App.tags.each(this.addOne);
	},
    change: function() {
    },
    render: function() {
    },
});

App.tag = undefined;
App.page = 0;
App.read_filter = 'unread';


var Feed = Backbone.Model.extend({
    idAttribute: "_id",
});

var FeedCollection = Backbone.Collection.extend({
    model: Feed,
    url: '/feed/',

	initialize: function() {
	//    _.bindAll(this, 'boot');
    },
});
App.feeds = new FeedCollection();

var FeedView = Backbone.View.extend({
	tagName: "li",	
	className: "feed",
	events: {
        "click .txt": "filterTo",
        "click .delete": "del",
    },
	initialize: function() {
	    _.bindAll(this, 'render', 'filterTo', "del");
	    this.model.bind('change', this.render);
	},
	render: function() {
        var h = $.tmpl(templates.feed_template, { 'feed': this.model.toJSON() });
	    $(this.el).html(h);
	    return this;
	},
    filterTo: function() {
        console.log('filtering to feed ', this.model);
        App.filterToFeed(this.model);
    },
    del: function() {
        this.model.destroy();
        this.$el.remove();
    },
});


var FeedListView = Backbone.View.extend( {
	initialize: function() {
	    _.bindAll(this, 'addOne', 'addAll', 'change', 'render');
	    App.feeds.bind('add', this.addOne);
	    App.feeds.bind('refresh', this.addAll);
	    App.feeds.bind('change', this.render);
	},
	addOne: function(feed) {
	    var view = new FeedView({'model': feed});
        this.$el.append(view.render().el);
	},
	addAll: function() {
	    App.feeds.each(this.addOne);
	},
    change: function() {
    },
    render: function() {
    },
});


// var page = 0;
// var read_filter = 'unread';

var selected_item = 0;

function boot() {
    templates['item_template'] = $('#item_template').html();
    templates['tag_template'] = $('#tag_template').html();
    templates['feed_template'] = $('#feed_template').html();
    templates['controls_template'] = $('#controls_template').html();

    App.itemListView = new ItemListView();
    App.itemListView.setElement($('#items'));
    App.tagListView = new TagListView();
    App.tagListView.setElement($('#tags'));
    App.feedListView = new FeedListView();
    App.feedListView.setElement($('#feeds'));
    App.controlsView = new ControlsView({model: App});
    App.controlsView.setElement($('#controls'));
    App.controlsView.render();

    infini_scroll();

    $('#unread_filter').on('click', function() {
        App.read_filter = 'unread';
        App.items.reboot();
    });

    $('#all_filter').on('click', function() {
        App.read_filter = 'all';
        App.items.reboot();
    });

    $('.logo').on('click', function() {
        App.set('feedFilter', undefined);
        App.items.reboot();
    });

    // keyboard shortcuts
    $('body').keydown(function(event) {
	if (event.which == 74) {
	    event.preventDefault();
        App.next();
	}
	if (event.which == 75) {
	    event.preventDefault();
        App.previous();
	}
    });

    App.boot();
}

// function install_tags() {

//     $('#tags').on('click', 'li', function() {
//         $('.tag').removeClass('active');
// 	    $(this).addClass('active');
// 	    filter_to_tag($(this).data('tag'));
//     });
    
// }

// function next_page() {
//     page = page + 1;
//     url = '/stream/';

//     if(App.starredFilter) {
//         url = url + 'starred/';
//     }

//     if(tag != undefined) {
// 	    url = url + 'tag/' + tag + '/';
//     }
//     url = url + '?page=' + page;
//     if(read_filter != undefined) {
// 	    url = url + '&read_filter=' + read_filter;
//     }
//     console.log('fetching ' + url);
//     $.getJSON(url, function(data) {
// 	    $.each(data, function(i,v) {
// 	        // var rendered_item = $.tmpl(templates.item_template, { 'item': v }).appendTo($('#items'));
//             // $('.description a').attr('target', '_blank');
//             var item = new Item(v);
//             App.items.add(item);
// 	    });
//     });
// }

// function key_fresh() {    
// //    window.setTimeout(key_fresh, 50);
// }

// // this is legacy code

function infini_scroll() {
    if(App.loading) {    
    }
    else {
        var dh = $('#items').height() - $(window).height();
        var st = $(window).scrollTop();
        if  ( (dh-st) < 100   ){
            App.items.boot();
        }
    }
    window.setTimeout(infini_scroll, 1000);
}


var ItemSelector =  { 
    selected_index: 0,
}
