import os
import glob

target_dir = 'c:/Users/PC/Desktop/used-phone-market'
old_id = 'AW-18157690697'
new_id = 'AW-18055027970'

extensions = ['*.html', '*.js', '*.mjs']
files_to_check = []
for ext in extensions:
    files_to_check.extend(glob.glob(os.path.join(target_dir, ext)))

modified_count = 0
for filepath in files_to_check:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if old_id in content:
            new_content = content.replace(old_id, new_id)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            modified_count += 1
            print(f"Updated {os.path.basename(filepath)}")
    except Exception as e:
        print(f"Error processing {os.path.basename(filepath)}: {e}")

print(f"Total files modified: {modified_count}")
