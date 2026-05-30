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

# 1. HTML Replacements
html_replacements = [
    {
        'old': r'<p style="font-size: 0\.8rem; color: red; margin-top: 10px;">※ 액정상태 불량은 차감 금액이 가장 큰 항목입니다\.</p>',
        'new': r'<p class="lcd-heavy-warning" style="font-size: 0.8rem; color: red; margin-top: 10px; display: none;">※ 화면 및 터치 불량으로 초기화가 되지 않은경우 개인정보초기화를 고객님의 잠금 비밀번호, 애플ID 및 비밀번호를 필요로 할 수 있습니다.</p>'
    }
]

for f in glob.glob('*.html'):
    if update_file(f, html_replacements):
        print(f"Updated HTML {f}")

# 2. JS Replacements
js_replacements = [
    {
        'old': r"if \(group === 'is_sealed'\) \{",
        'new': r'''if (group === 'lcd_damage') {
            const heavyWarning = btn.closest('.defect-sub-step')?.querySelector('.lcd-heavy-warning');
            if (heavyWarning) heavyWarning.style.display = (val === 'heavy') ? 'block' : 'none';
        }

        if (group === 'is_sealed') {'''
    }
]

for f in glob.glob('script*.js') + glob.glob('script*.mjs'):
    if update_file(f, js_replacements):
        print(f"Updated JS {f}")
