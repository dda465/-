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

html_replacements = [
    {
        'old': r'<input type="checkbox" id="agree-terms"([^>]*?) checked>',
        'new': r'<input type="checkbox" id="agree-terms"\1>'
    }
]

for f in glob.glob('*.html'):
    if update_file(f, html_replacements):
        print(f"Updated HTML {f}")
