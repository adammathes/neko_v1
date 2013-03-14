<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>nekko</title>
    <link rel="stylesheet" href="/static/style.css" />
  </head>
  <body>

    <ul class="tags">
    {% for tag in tags %}
    <li><a href="/tag/{{ tag }}/">{{ tag }}</a></li>
    {% endfor %}
    </ul>

   {% for item in items %}
   <div class="item">
     <h3><a href="{{ item.url }}">{{ item.title }}</a></h3>
     <p class="dateline" style="clear: both;">
       {{ item.date.strftime("%B %e, %Y") }}
       from {{ item.feed_id }}
     </p>
     <div class="description">{{ item.description }}</div>
  </div>

   {% if loop.last %}
   <h1>
     <a href="?page={{ next_page }}">earlier</a>
   </h1>
   {% endif %}
   {% endfor %}


  </body>
</html>  
