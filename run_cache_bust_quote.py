import codecs
import re
import time

new_ver = int(time.time())

for filename in ['quote.html', 'index.html', 'admin.html', 'login.html']:
    try:
        with codecs.open(filename, 'r', 'utf-8', errors='ignore') as f:
            content = f.read()

        new_content = re.sub(r'script\.js\?v=\d+', f'script.js?v={new_ver}', content)
        
        if content != new_content:
            with codecs.open(filename, 'w', 'utf-8') as f:
                f.write(new_content)
            print(f"Updated cache version in {filename} to v={new_ver}")
        else:
            # Maybe it doesn't have a version parameter yet
            if 'script.js"' in content or "script.js'" in content:
                new_content = content.replace('script.js"', f'script.js?v={new_ver}"').replace("script.js'", f"script.js?v={new_ver}'")
                with codecs.open(filename, 'w', 'utf-8') as f:
                    f.write(new_content)
                print(f"Added cache version in {filename} to v={new_ver}")
    except Exception as e:
        print(f"Skipping {filename}: {str(e)}")
