<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>neko rss mode</title>
    <link rel="stylesheet" href="/static/style.css" />
    <meta name="viewport" content="width=device-width" />
    <script src="/static/jquery.min.js"></script>
    <script src="/static/ember.min.js"></script>
    <script src="/static/eui.js"></script>
  </head>

  <body>

    <div id="filters">
      <p>
	<a href="#" id="unread_filter">Unread</a> &middot;
	<a href="#" id="all_filter">All</a>
      </p>

      <ul id="tags">
      </ul>
    </div>


    <div id="items">
      <script type="text/x-handlebars">
        {{App.itemsController.items}}

  	    {{#each App.itemsController.items}}
	    <h3>{{{title}}</h3>
	    {{/each}} 
      </script>
    </div>

    <div id="bottom"></div>
      
    
  </body>


</html>  
