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
        'old': r"authPickupSelect\.innerHTML = '';\s*const today = new Date\(\);",
        'new': r"authPickupSelect.innerHTML = '<option value=\"\">방문 날짜를 선택해주세요</option>';\n                            const today = new Date();"
    },
    {
        'old': r"const needsAddress = \['courier', 'pickup'\]\.includes\(deliveryMethod\);\s*if \(needsAddress && !baseAddress\) \{",
        'new': r'''const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);
                if (deliveryMethod === 'courier' && !pickupDate) {
                    if (errorMsg) {
                        errorMsg.innerText = "매입날짜를 선택해주세요.";
                        errorMsg.style.display = 'block';
                    }
                    return;
                }
                if (needsAddress && !baseAddress) {'''
    }
]

for f in glob.glob('script*.js') + glob.glob('script*.mjs'):
    if update_file(f, js_replacements):
        print(f"Updated JS {f}")
