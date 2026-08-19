import os, glob
html_files = glob.glob("*.html")
old_html = """            <div style="margin-top: 25px; padding-top: 25px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: flex-start; gap: 15px;">
                <div style="cursor: pointer; display: inline-flex; align-items: center; gap: 12px; border: 1px solid #e5e7eb; padding: 12px 18px; border-radius: 8px; background: white;" onclick="window.open('https://mark.inicis.com/mark/popup_v3.php?mid=MIIsharaph', 'mark', 'width=565,height=683,scrollbars=no,resizable=no');">
                    <img src="sr_logo.png" alt="KG이니시스 에스크로" style="height: 38px;">
                    <div style="text-align: left; font-size: 0.8rem; color: #4b5563; line-height: 1.4;">
                        고객님의 안전거래를 위해 현금 결제 시 저희 쇼핑몰이 가입한<br>
                        <strong>KG이니시스의 에스크로(구매안전) 서비스</strong>를 이용하실 수 있습니다.<br>
                        <span style="color: #6b7280; text-decoration: underline;">[서비스 가입사실 확인하기]</span>
                    </div>
                </div>
            </div>"""

new_html = """            <div style="margin-top: 25px; padding-top: 25px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: flex-start; gap: 15px; flex-wrap: wrap;">
                <div style="cursor: pointer; display: inline-flex; align-items: center; gap: 12px; border: 1px solid #e5e7eb; padding: 12px 18px; border-radius: 8px; background: white;" onclick="window.open('https://mark.inicis.com/mark/popup_v3.php?mid=MIIsharaph', 'mark', 'width=565,height=683,scrollbars=no,resizable=no');">
                    <img src="sr_logo.png" alt="KG이니시스 에스크로" style="height: 38px;">
                    <div style="text-align: left; font-size: 0.8rem; color: #4b5563; line-height: 1.4;">
                        고객님의 안전거래를 위해 현금 결제 시 저희 쇼핑몰이 가입한<br>
                        <strong>KG이니시스의 에스크로(구매안전) 서비스</strong>를 이용하실 수 있습니다.<br>
                        <span style="color: #6b7280; text-decoration: underline;">[서비스 가입사실 확인하기]</span>
                    </div>
                </div>
                <div style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; background: white;">
                    <img src="https://image.inicis.com/mkt/certmark/inipay/inipay_74x74_gray.png" border="0" alt="클릭하시면 이니시스 결제시스템의 유효성을 확인하실 수 있습니다." style="cursor:pointer;" onclick="javascript:window.open('https://mark.inicis.com/mark/popup_v3.php?mid=MIIsharaph','mark','scrollbars=no,resizable=no,width=565,height=683');">
                </div>
            </div>"""

for f in html_files:
    if f == "index.html": continue
    with open(f, "r", encoding="utf-8") as file: content = file.read()
    if "sr_logo.png" in content and "inipay_74x74_gray.png" not in content:
        content = content.replace(old_html, new_html)
        with open(f, "w", encoding="utf-8") as file: file.write(content)
        print(f"Updated {f}")

