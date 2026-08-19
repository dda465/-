import os, glob

for f in glob.glob('*.html'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # 1. Fix "내 폰 판매" links
    content = content.replace('<a href="index.html">내 폰 판매</a>', '<a href="quote.html">내 폰 판매</a>')
    
    # 2. Make Logo Circular
    content = content.replace(
        '<img src="sr_logo.png" alt="SR 로고" class="logo-icon" style="height: 40px; width: auto;">',
        '<img src="sr_logo.png" alt="SR 로고" class="logo-icon" style="height: 40px; width: 40px; border-radius: 50%; object-fit: cover;">'
    )
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
    
    print(f"Fixed {f}")
