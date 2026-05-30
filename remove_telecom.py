import os
import glob
import re

html_files = glob.glob('*.html')

pattern = re.compile(r'통신판매업 신고번호:\s*(?:\[통신판매업 신고번호 입력\]|기타)\s*\|\s*')

for file_path in html_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = pattern.sub('', content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")

print("Done.")
