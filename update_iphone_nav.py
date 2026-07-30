import re

with open('index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

with open('event_iphone.html', 'r', encoding='utf-8') as f:
    iphone_html = f.read()

# Extract Navbar from index.html
navbar_pattern = re.compile(r'<nav class="navbar">.*?</nav>', re.DOTALL)
index_navbar_match = navbar_pattern.search(index_html)
if not index_navbar_match:
    print("Could not find navbar in index.html")
    exit(1)
index_navbar = index_navbar_match.group(0)

# Replace Navbar in event_iphone.html
iphone_html = navbar_pattern.sub(index_navbar, iphone_html)

# Extract Bottom Nav from index.html
bottom_nav_pattern = re.compile(r'<div class="bottom-nav mobile-only" aria-label="하단 메뉴">.*?</div>\s*$', re.DOTALL | re.MULTILINE)
# Since the regex above might be tricky with multiple divs, let's just find the exact string block
bottom_nav_start = index_html.find('<div class="bottom-nav mobile-only" aria-label="하단 메뉴">')
bottom_nav_end = index_html.find('</div>', index_html.find('</a>', bottom_nav_start + 500)) + 6

if bottom_nav_start != -1 and bottom_nav_end != -1:
    index_bottom_nav = index_html[bottom_nav_start:bottom_nav_end]
    
    # Replace sticky CTA in event_iphone.html
    sticky_cta_pattern = re.compile(r'<div class="bottom-sticky-cta">.*?</div>', re.DOTALL)
    iphone_html = sticky_cta_pattern.sub(index_bottom_nav, iphone_html)
else:
    print("Could not find bottom nav in index.html")

# Write back
with open('event_iphone.html', 'w', encoding='utf-8') as f:
    f.write(iphone_html)

print("Navbar and Bottom Nav replaced successfully!")
