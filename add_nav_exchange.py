import glob

old_link = '<a href="reviews.html">이용 후기</a>'
new_links = '<a href="exchange.html" style="color: #2563EB; font-weight: 700;">안심 교환 <span style="background:#EF4444; color:white; font-size:0.6rem; padding:2px 4px; border-radius:4px; vertical-align:top; margin-left:2px;">N</span></a>\n                <a href="reviews.html">이용 후기</a>'

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if old_link in content and 'exchange.html' not in content:
        content = content.replace(old_link, new_links)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1

print(f"Added exchange.html link to {count} files.")
