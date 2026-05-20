import os
import glob
import time
import re

target_dir = 'c:/Users/PC/Desktop/used-phone-market'
new_v = str(int(time.time()))

html_files = glob.glob(os.path.join(target_dir, '*.html'))
modified_count = 0

for filepath in html_files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Replace ?v=number with ?v=new_v
        new_content = re.sub(r'(\?v=)\d+', r'\g<1>' + new_v, content)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            modified_count += 1
            print(f"Updated cache-buster in {os.path.basename(filepath)}")
    except Exception as e:
        print(f"Error processing {os.path.basename(filepath)}: {e}")

print(f"Total HTML files updated: {modified_count}")
