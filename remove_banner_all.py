import os
import re

directory = r"c:\Users\PC\Desktop\used-phone-market"
pattern_banner = re.compile(r'<div style="background: white;[^>]+>.*?👋 안녕하세요, 쉐라폰 검수팀입니다!.*?</div>', re.DOTALL)

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = pattern_banner.sub('', content)
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Removed banner from {filename}")
