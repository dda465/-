import re

with open('c:/Users/PC/Desktop/used-phone-market/admin.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = {
    # Keys with missing single quotes at the end
    r"row\['확인?리?확인\]": "row['시리즈']",
    r"row\['모델?확인\]": "row['모델명']",
    r"row\['S?확인\]": "row['S급']",
    r"row\['확인?품'\]": "row['미개봉']",
    r"row\['A?확인\]": "row['A급']",
    r"row\['B?확인\]": "row['B급']",
    r"row\['C?확인\]": "row['C급']",
    r"row\['D?확인\]": "row['D급']",

    r"'32기?확인'": "'32기가'",
    r"'64기?확인'": "'64기가'",
    r"'128기?확인'": "'128기가'",
    r"'256기?확인'": "'256기가'",
    r"'512기?확인'": "'512기가'",
    r"'1확인?라'": "'1테라'",

    r"console\.error\(\"Failed to delete old products:\", delErr\);\n            throw new Error\(\".*?\"\);": "console.error(\"Failed to delete old products:\", delErr);\n            throw new Error(\"기존 데이터를 삭제하는 중 오류가 발생했습니다.\");",

    r"brand\.includes\('확인?플'\)": "brand.includes('애플')",
    r"brand\.includes\('확인?성'\)": "brand.includes('삼성')",

}

for k, v in replacements.items():
    text = re.sub(k, v, text)

with open('c:/Users/PC/Desktop/used-phone-market/admin.js', 'w', encoding='utf-8') as f:
    f.write(text)
