import os

def fix_mid(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content.replace('에스알커머스MID입력', 'MIsharaph')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed MID in {filepath}")
    else:
        print(f"MID placeholder not found in {filepath}")

fix_mid('index.html')
fix_mid('prototype_natural.html')
