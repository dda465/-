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
        'old': r'(설정 ➜ Apple 계정\(사용자 이름\) ➜ 로그아웃</span> 순서로 진행해주세요\.\s*<br>\(휴대폰의 잠금이 해제되어야합니다\)\s*</div>)',
        'new': r'\1\n                    <p style="font-size: 0.8rem; color: red; margin-bottom: 20px; text-align: center; word-break: keep-all;">※ 화면 및 터치 불량으로 초기화가 되지 않은경우 개인정보초기화를 고객님의 잠금 비밀번호, 애플ID 및 비밀번호를 필요로 할 수 있습니다.</p>'
    },
    {
        'old': r'(기기설정 ➜ 일반 ➜ 초기화 ➜ 기기전체초기화</span> 순서로 진행해주세요\.\s*</div>)',
        'new': r'\1\n                    <p style="font-size: 0.8rem; color: red; margin-bottom: 20px; text-align: center; word-break: keep-all;">※ 화면 및 터치 불량으로 초기화가 되지 않은경우 개인정보초기화를 고객님의 잠금 비밀번호, 구글/삼성 계정 및 비밀번호를 필요로 할 수 있습니다.</p>'
    }
]

for f in glob.glob('*.html'):
    if update_file(f, html_replacements):
        print(f"Updated HTML {f}")

