import sys
content = open('Price-list.html', 'r', encoding='utf-8').read()
content = content.replace('data-brand="all"', 'onclick="filterModels(\'all\')" data-brand="all"')
content = content.replace('data-brand="apple"', 'onclick="filterModels(\'apple\')" data-brand="apple"')
content = content.replace('data-brand="samsung"', 'onclick="filterModels(\'samsung\')" data-brand="samsung"')
open('Price-list.html', 'w', encoding='utf-8').write(content)
