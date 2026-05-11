import os
import glob

replacements = {
    "47294 부산광역시 부산진구 전포동 686-1 더블루2 719호": "47247 부산시 동천로 116 한신밴빌딩 1003호",
    "부산광역시 부산진구 전포동 686-1 더블루2 719호 쉐라폰": "부산시 동천로 116 한신밴빌딩 1003호 쉐라폰",
    "부산광역시 부산진구 전포동 686-1 더블루2 719호": "부산시 동천로 116 한신밴빌딩 1003호",
    "예: 부산광역시 부산진구 전포동...": "예: 부산시 동천로 116..."
}

files_to_check = glob.glob("*.html") + glob.glob("*.js") + glob.glob("*.py")

for file_path in files_to_check:
    if file_path == "update_address.py":
        continue
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        try:
            with open(file_path, 'r', encoding='euc-kr') as f:
                content = f.read()
        except:
            continue
            
    original_content = content
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    if content != original_content:
        # Save with utf-8 encoding to preserve unicode
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file_path}")

print("Done.")
