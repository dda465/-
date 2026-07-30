import re

with open('index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

with open('event_iphone.html', 'r', encoding='utf-8') as f:
    iphone_html = f.read()

# Extract the head content from index.html (specifically everything between <head> and </head>)
# We actually just want all <style> blocks from index.html's head
head_start = index_html.find('<head>')
head_end = index_html.find('</head>')
index_head = index_html[head_start:head_end]

style_blocks = re.findall(r'<style>.*?</style>', index_head, re.DOTALL)

# In event_iphone.html, let's remove existing inline <style> blocks except the one containing font-faces and root
# Actually, the simplest is to just append all index.html style blocks to event_iphone.html's head
# But event_iphone.html has its own specific styles for the landing page.
# Let's just append the style blocks from index.html right before </head> in event_iphone.html

# Let's extract specific CSS for .navbar and .bottom-nav from index.html
# Instead of parsing, let's just grab all <style> blocks from index.html and append them.
combined_styles = "\n".join(style_blocks)

# Check if we already appended them before
if "/* index styles appended */" not in iphone_html:
    new_head_injection = f"<!-- index styles appended -->\n{combined_styles}\n</head>"
    iphone_html = iphone_html.replace('</head>', new_head_injection)

with open('event_iphone.html', 'w', encoding='utf-8') as f:
    f.write(iphone_html)

print("Styles appended successfully!")
