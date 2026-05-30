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

js_replacements = [
    {
        'old': r"if \(errorMsg\) \{\s*errorMsg\.innerText = \"방문날짜를 선택해주세요\.\";\s*errorMsg\.style\.display = 'block';\s*\}\s*return;",
        'new': r'''alert("방문날짜를 선택해주세요.");
                    if (errorMsg) {
                        errorMsg.innerText = "방문날짜를 선택해주세요.";
                        errorMsg.style.display = 'block';
                    }
                    return;'''
    }
]

for f in glob.glob('script*.js') + glob.glob('script*.mjs'):
    if update_file(f, js_replacements):
        print(f"Updated JS {f}")
