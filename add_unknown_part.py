import glob
import re

def update_file(filepath, replacements, encoding='utf-8'):
    try:
        with open(filepath, 'r', encoding=encoding) as f:
            content = f.read()
        
        new_content = content
        for r in replacements:
            new_content = re.sub(r['old'], r['new'], new_content, flags=re.MULTILINE)
            
        if content != new_content:
            with open(filepath, 'w', encoding=encoding) as f:
                f.write(new_content)
            return True
        return False
    except Exception as e:
        return False

# 1. HTML replacements (insert the new button next to compass)
html_replacements = [
    {
        'old': r'(<button class="btn-check-opt" data-group="func_defect" data-value="compass"\s*onclick="toggleMulti\(this, \'compass\'\)">나침반/GPS</button>)',
        'new': r'\1\n                        <button class="btn-check-opt" data-group="func_defect" data-value="unknown_part"\n                            onclick="toggleMulti(this, \'unknown_part\')">알수없는부품오류</button>'
    }
]

for f in glob.glob('*.html'):
    if update_file(f, html_replacements):
        print(f"Updated HTML {f}")

# 2. JS replacements (update funcMap in script.js and admin.js to include unknown_part)
# script.js:
# 'wifi': 'Wifi/블루투스 불량', 'compass': '나침반/GPS 불량', 'sound': '스피커/마이크 불량',
script_js_replacements = [
    {
        'old': r"('compass': '나침반/GPS( 불량)?',)",
        'new': r"\1 'unknown_part': '알수없는부품오류',"
    }
]

for f in glob.glob('script*.js') + glob.glob('script*.mjs') + ['admin.js']:
    if update_file(f, script_js_replacements):
        print(f"Updated JS {f}")
