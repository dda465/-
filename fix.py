import urllib.request
content = urllib.request.urlopen("https://sharaphone.com/admin.js").read().decode('utf-8')
content = content.replace("onclick=\"deleteQuote('${id}')\"", "onclick=\"permanentlyDeleteQuote('${id}')\"")
with open("admin.js", "w", encoding="utf-8") as f:
    f.write(content)
