import os
import re

html_files = [
    'terms.html',
    'signup.html',
    'reviews.html',
    'quote.html',
    'prototype_quote_flow.html',
    'prototype_natural.html',
    'privacy.html',
    'price-list.html',
    'mypage.html'
]

escrow_snippet = """
                    <div style="margin-top: 25px; padding-top: 25px; border-top: 1px solid #e5e7eb; display: flex; align-items: flex-start; justify-content: flex-start; gap: 15px; flex-wrap: wrap;">
                        <div style="cursor: pointer; display: inline-flex; align-items: center; gap: 12px; border: 1px solid #e5e7eb; padding: 12px 18px; border-radius: 8px; background: white;" onclick="window.open('https://mark.inicis.com/mark/popup_v3.php?mid=MIIsharaph', 'mark', 'width=565,height=683,scrollbars=no,resizable=no');">
                            <img src="sr_logo.png" alt="KG이니시스 에스크로" style="height: 38px;">
                            <div style="text-align: left; font-size: 0.8rem; color: #4b5563; line-height: 1.4;">
                                고객님의 안전거래를 위해 현금 결제 시 저희 쇼핑몰이 가입한<br>
                                <strong>KG이니시스의 에스크로(구매안전) 서비스</strong>를 이용하실 수 있습니다.<br>
                                <span style="color: #6b7280; text-decoration: underline;">[서비스 가입사실 확인하기]</span>
                            </div>
                        </div>
                        <div style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; background: white; padding: 0;">
                            <img src="https://image.inicis.com/mkt/certmark/inipay/inipay_74x74_gray.png" border="0" alt="클릭하시면 이니시스 결제시스템의 유효성을 확인하실 수 있습니다." style="cursor:pointer;" onclick="javascript:window.open('https://mark.inicis.com/mark/popup_v3.php?mid=MIIsharaph','mark','scrollbars=no,resizable=no,width=565,height=683');">
                        </div>
                    </div>"""

for filename in html_files:
    filepath = os.path.join(r"c:\Users\PC\Desktop\used-phone-market", filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filename}")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if "KG이니시스 에스크로" in content:
        print(f"Already applied to {filename}")
        continue
        
    # We find the specific div block ending after 통신판매업 신고번호
    # e.g.:
    # 통신판매업 신고번호: 기타 | 개인정보보호책임자: <span id="dyn-ceo-name2">박현용</span>
    # </div>
    
    # We will use regex to find this pattern and append our snippet before the next </div>
    pattern = r"(통신판매업 신고번호:[^<]*<[^>]*>박현용(?:</[^>]*>)?\s*</div>)"
    
    match = re.search(pattern, content)
    if match:
        new_content = content.replace(match.group(1), match.group(1) + escrow_snippet)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Successfully applied to {filename}")
    else:
        # Fallback for prototype_quote_flow.html if it doesn't match the span exactly
        pattern2 = r"(통신판매업 신고번호: 기타 \| 개인정보보호책임자: 박현용\s*</div>)"
        match2 = re.search(pattern2, content)
        if match2:
            new_content = content.replace(match2.group(1), match2.group(1) + escrow_snippet)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Successfully applied to {filename} (Fallback)")
        else:
            print(f"Pattern not found in {filename}")
