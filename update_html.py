import os

with open("c:/Users/PC/Desktop/used-phone-market/index.html", "r", encoding="utf-8") as f:
    html = f.read()

reps = {
    "상호명: 에스알커머스 | 대표자명: 박현용<br>": "상호명: <span id=\"dyn-company-name\">에스알커머스</span> | 대표자명: <span id=\"dyn-ceo-name\">박현용</span><br>",
    "사업장 주소: 47247 부산시 동천로 116 한신밴빌딩 1003호<br>": "사업장 주소: <span id=\"dyn-address\">47247 부산시 동천로 116 한신밴빌딩 1003호</span><br>",
    "대표 전화: 070-7379-2610 | 사업자 등록번호: 331-77-00487<br>": "대표 전화: <span id=\"dyn-phone\">070-7379-2610</span> | 사업자 등록번호: <span id=\"dyn-biz-number\">331-77-00487</span><br>",
    "통신판매업 신고번호: 기타 | 개인정보보호책임자: 박현용": "통신판매업 신고번호: 기타 | 개인정보보호책임자: <span id=\"dyn-ceo-name2\">박현용</span>",
    "상담/주문전화: 070-7379-2610<br>": "상담/주문전화: <span id=\"dyn-phone2\">070-7379-2610</span><br>",
    "상담/주문 이메일: guffyd321@naver.com<br><br>": "상담/주문 이메일: <span id=\"dyn-email\">guffyd321@naver.com</span><br><br>",
    "&copy; 2024 에스알커머스. All rights reserved.": "&copy; 2024 <span id=\"dyn-company-name2\">에스알커머스</span>. All rights reserved.",
    "<h2 class=\"section-title\">판매는 더 쉽고, 입금은 더 빠르게</h2>": "<h2 class=\"section-title\"><span id=\"dyn-hero-title\">판매는 더 쉽고, 입금은 더 빠르게</span></h2>",
    "<p class=\"section-subtitle\">복잡한 흥정 없이, 쉐라폰만의 3-STEP 시스템을 만나보세요.</p>": "<p class=\"section-subtitle\"><span id=\"dyn-hero-subtitle\">복잡한 흥정 없이, 쉐라폰만의 3-STEP 시스템을 만나보세요.</span></p>"
}

for src, dst in reps.items():
    html = html.replace(src, dst)

with open("c:/Users/PC/Desktop/used-phone-market/index.html", "w", encoding="utf-8") as f:
    f.write(html)
