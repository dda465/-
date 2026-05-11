import os
import urllib.request

d = 'c:/Users/PC/Desktop/used-phone-market'
base_url = "https://rejeuphone.web.app/"

for r, ds, fs in os.walk(d):
    if '.git' in r or 'node_modules' in r or 'backup_files' in r or '.firebase' in r:
        continue
    for f in fs:
        if f.endswith('.html'):
            full_path = os.path.join(r, f)
            rel_path = os.path.relpath(full_path, d).replace('\\', '/')
            url = base_url + rel_path
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as res:
                    content = res.read()
                
                text = content.decode('utf-8')
                
                with open(full_path, 'w', encoding='utf-8') as out:
                    out.write(text)
                print("Restored from WEB:", rel_path)
            except Exception as e:
                print("Failed:", rel_path, e)
