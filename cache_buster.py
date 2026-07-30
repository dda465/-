import glob
import re
import time

new_ver = int(time.time())

for filename in glob.glob('*.html'):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = re.sub(r'(\b[a-zA-Z0-9_-]+\.m?js)\?v=[0-9]+', rf'\1?v={new_ver}', content)
        
        # Also handle cases where there's no ?v=
        # Wait, if I do this, it might be safer to just do the first regex
        if content != new_content:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated cache version in {filename} to v={new_ver}")
    except Exception as e:
        print(f"Skipping {filename}: {str(e)}")
