import os

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace openTermsModal() -> window.open('terms.html', '_blank')
    content = content.replace('onclick="openTermsModal()"', 'onclick="window.open(\'terms.html\', \'_blank\')"')
    
    # Replace footer links
    content = content.replace('href="#" onclick="openPolicyModal(\'terms.html\', \'이용약관\')"', 'href="terms.html" target="_blank"')
    content = content.replace('href="#" onclick="openPolicyModal(\'privacy.html\', \'개인정보처리방침\')"', 'href="privacy.html" target="_blank"')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

for file in os.listdir('.'):
    if file.endswith('.html'):
        replace_in_file(file)
