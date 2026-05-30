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

script_js_replacements = [
    {
        'old': r"('account': '계정 잠김')",
        'new': r"\1, 'unknown_part': '알수없는부품오류'"
    },
    {
        'old': r"('account': '계정잠김')",
        'new': r"\1, 'unknown_part': '알수없는부품오류'"
    }
]

for f in glob.glob('script*.js') + glob.glob('script*.mjs') + ['admin.js']:
    if update_file(f, script_js_replacements):
        print(f"Updated JS {f}")
