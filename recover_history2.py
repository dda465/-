import os, json, shutil, glob
from urllib.parse import unquote

hist_dir = r'C:\Users\PC\AppData\Roaming\Antigravity\User\History'
restored = set()
folders = glob.glob(os.path.join(hist_dir, '*', 'entries.json'))

for f in folders:
    d = os.path.dirname(f)
    try:
        with open(f, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        res = data.get('resource', '')
        if 'used-phone-market' in res and res.endswith('.html'):
            try:
                target = unquote(res).split('file:///c%3A/')[1]
                target = 'C:\\' + target.replace('/', '\\')
            except IndexError:
                try:
                    target = unquote(res).split('file:///c:/')[1]
                    target = 'C:\\' + target.replace('/', '\\')
                except IndexError:
                    target = unquote(res).replace('file:///', '').replace('/', '\\')
            
            entries = data.get('entries', [])
            if entries:
                # Loop through all entries from newest to oldest
                for entry in sorted(entries, key=lambda x: x.get('timestamp', 0), reverse=True):
                    best_id = entry.get('id')
                    src = os.path.join(d, best_id)
                    
                    # Prevent 0 byte file, find the latest > 0 byte
                    if os.path.exists(src) and os.path.getsize(src) > 0:
                        if target not in restored:
                            shutil.copy(src, target)
                            restored.add(target)
                            print(f'Restored true latest for {target}')
                        break # Found the latest valid file for this target
    except Exception as e:
        print(f"Error processing {f}: {e}")
