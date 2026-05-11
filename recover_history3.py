import os, json, shutil, glob
from urllib.parse import unquote

hist_dir = r'C:\Users\PC\AppData\Roaming\Antigravity\User\History'
folders = glob.glob(os.path.join(hist_dir, '*', 'entries.json'))

# Dictionary to collect all entries for a given target path
target_entries = {}

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
                    target = target.replace('C%3A', 'C:').replace('C|', 'C:')
            
            # Normalize path
            target = os.path.normpath(target).lower()

            entries = data.get('entries', [])
            for entry in entries:
                # Store the directory 'd' alongside the entry
                entry['__dir__'] = d
                
            if target not in target_entries:
                target_entries[target] = []
            target_entries[target].extend(entries)

    except Exception as e:
        pass

for target_lower, entries in target_entries.items():
    # Sort all accumulated entries for this target by timestamp, newest first
    sorted_entries = sorted(entries, key=lambda x: x.get('timestamp', 0), reverse=True)
    
    for entry in sorted_entries:
        best_id = entry.get('id')
        src = os.path.join(entry['__dir__'], best_id)
        
        # We need original path casing. Let's just find the first .html file starting with the same name if possible?
        # Actually user has used-phone-market on Desktop.
        # We can recreate the proper case target by mapping the lower case back, or just using lower is fine in windows.
        
        if os.path.exists(src) and os.path.getsize(src) > 0:
            shutil.copy(src, target_lower)
            print(f"Restored true global latest ({os.path.getsize(src)} bytes) for {target_lower}")
            break
