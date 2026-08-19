import re

with open('c:/Users/PC/Desktop/used-phone-market/admin.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = {
    # Keys with missing single quotes at the end and replacement characters
    r"row\['확인.리.확인\]": "row['시리즈']",
    r"row\['모델.확인\]": "row['모델명']",
    r"row\['S.확인\]": "row['S급']",
    r"row\['확인.품'\]": "row['미개봉']",
    r"row\['A.확인\]": "row['A급']",
    r"row\['B.확인\]": "row['B급']",
    r"row\['C.확인\]": "row['C급']",
    r"row\['D.확인\]": "row['D급']",

    r"'32기.확인'": "'32기가'",
    r"'64기.확인'": "'64기가'",
    r"'128기.확인'": "'128기가'",
    r"'256기.확인'": "'256기가'",
    r"'512기.확인'": "'512기가'",
    r"'1확인.라'": "'1테라'",

    r"brand\.includes\('확인.플'\)": "brand.includes('애플')",
    r"brand\.includes\('확인.성'\)": "brand.includes('삼성')",

}

for k, v in replacements.items():
    text = re.sub(k, v, text)

# I also noticed missing double quote in confirm at line 218: "확인말 삭제확인원삭제삭제확인시겠습확인까확인 (DB급서삭제확인확인니삭제"
text = re.sub(r'confirm\("확인.말 삭제확인.원삭제삭제확인.시겠습확인.까확인 \(DB급.서.삭제확인확인.니삭제"\)', 'confirm("정말 회원을 삭제하시겠습니까? (DB에서 삭제됩니다)")', text)
text = re.sub(r'alert\("삭제확인.었확인.니삭제"\)', 'alert("삭제되었습니다")', text)
text = re.sub(r'alert\("확인.청확인.역삭제삭제확인.었확인.니삭제"\)', 'alert("삭제되었습니다")', text)
text = re.sub(r'confirm\("구확인 확인트삭제확인삭제삭제이확인확인 가확인확인 확인데확인트 확인시겠습확인까확인\\n삭제확인업확인 확인간삭제조금 걸릴 삭제확인으확인 확인료 삭제확인세가 변경됩확인다."\)', 'confirm("구글 시트에서 시세를 동기화 하시겠습니까?\\n시간이 조금 걸릴 수 있습니다.")', text)

with open('c:/Users/PC/Desktop/used-phone-market/admin.js', 'w', encoding='utf-8') as f:
    f.write(text)
