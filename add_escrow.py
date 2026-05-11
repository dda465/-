import re

def insert_escrow(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        return

    if 'KG_inicis_banner_192.png' in content:
        print(f"Already in {filepath}")
        return

    escrow_html = """
            <div style="margin-top: 25px; padding-top: 25px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: flex-start; gap: 15px;">
                <div style="cursor: pointer; display: inline-flex; align-items: center; gap: 12px; border: 1px solid #e5e7eb; padding: 12px 18px; border-radius: 8px; background: white;" onclick="window.open('https://mark.inicis.com/mark/escrow_popup.php?mid=에스알커머스MID입력', 'escrow', 'width=500,height=500,scrollbars=yes,resizable=yes');">
                    <img src="KG_inicis_banner_192.png" alt="KG이니시스 에스크로" style="height: 38px;">
                    <div style="text-align: left; font-size: 0.8rem; color: #4b5563; line-height: 1.4;">
                        고객님의 안전거래를 위해 현금 결제 시 저희 쇼핑몰이 가입한<br>
                        <strong>KG이니시스의 에스크로(구매안전) 서비스</strong>를 이용하실 수 있습니다.<br>
                        <span style="color: #6b7280; text-decoration: underline;">[서비스 가입사실 확인하기]</span>
                    </div>
                </div>
            </div>
"""

    # We will insert it inside the <div class="container"> before the copyright, or right before </footer>
    new_content = re.sub(r'(</footer>)', r'\n' + escrow_html + r'\n\n\1', content, flags=re.IGNORECASE)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Added escrow to {filepath}")

insert_escrow('index.html')
insert_escrow('prototype_natural.html')
