import glob

replacements = {
    "메인 LCD 손상 여부": "액정상태 불량 여부",
    "※ LCD 손상은 차감 금액이 가장 큰 항목입니다.": "※ 액정상태 불량은 차감 금액이 가장 큰 항목입니다."
}

files = glob.glob("*.html") + glob.glob("*.js")

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        for old, new in replacements.items():
            new_content = new_content.replace(old, new)
            
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
    except Exception as e:
        # try EUC-KR for repair.js which might have broken encodings
        try:
            with open(filepath, 'r', encoding='euc-kr') as f:
                content = f.read()
            
            new_content = content
            for old, new in replacements.items():
                new_content = new_content.replace(old, new)
                
            if content != new_content:
                with open(filepath, 'w', encoding='euc-kr') as f:
                    f.write(new_content)
                print(f"Updated {filepath} (euc-kr)")
        except Exception as e2:
            pass
