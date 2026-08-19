import re

with open('c:/Users/PC/Desktop/used-phone-market/admin.html', 'r', encoding='utf-8-sig') as f:
    text = f.read()

text = text.replace('src="admin.js"', 'src="admin.js?v=3"')

with open('c:/Users/PC/Desktop/used-phone-market/admin.html', 'w', encoding='utf-8') as f:
    f.write(text)
