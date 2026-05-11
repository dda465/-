import os
import glob
import re

html_files = glob.glob('*.html')
for file in html_files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace 대표 전화
        content = re.sub(r'대표 전화:\s*<span id=\"dyn-phone\">.*?</span>\s*\|\s*', '', content)
        # Replace 상담/주문전화
        content = re.sub(r'상담/주문전화:\s*<span id=\"dyn-phone2\">.*?</span><br>', '', content)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error processing {file}: {e}")
print('Done!')
