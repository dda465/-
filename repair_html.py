import re
import sys
import codecs

with codecs.open("quote.html", "r", encoding="utf-8") as f:
    text = f.read()

# We need to find the auth section and fix the checkbox syntax errors.
import xml.etree.ElementTree as ET

# Since it's HTML, simple substring replacement is safer than parsing because of partial fragments.
# Let's fix the line 461-462 issue.

bad_line_start = text.find('                        <input type="checkbox" id="agree-terms" style="margin-right: 10px; width: 18px; height: 18px; curs                    <div style="background: rgba(239, 68, 68, 0.1);')

if bad_line_start != -1:
    end_of_line = text.find('\n', bad_line_start)
    fixed_line = '                        <input type="checkbox" id="agree-terms" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">\n                        <span>이용약관 및 개인정보 처리방침 동의 <span style="color:red">*</span></span>\n                    </label>\n                    <button type="button" onclick="openTermsModal()" style="background: none; border: none; color: #2563EB; font-size: 0.9rem; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0;">보기</button>\n                </div>\n\n        <div id="termsModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; padding: 20px;">\n            <div style="background: white; width: 100%; max-width: 600px; border-radius: 12px; display: flex; flex-direction: column; max-height: 90vh;">\n                <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">\n                    <h3 style="margin: 0; font-size: 1.2rem;">이용약관 및 개인정보 처리방침</h3>\n                    <button onclick="closeTermsModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>\n                </div>\n                \n                <div class="terms-box" style="padding: 20px; overflow-y: auto; text-align: left; font-size: 0.9rem; line-height: 1.6;">\n                    <h4 style="color: var(--primary-dark); margin-bottom: 10px;">[만 14세 미만 아동의 개인정보보호]</h4>\n                    <p>회사가 운영하는 사이트에서는 만 14세 미만 아동의 경우 거래가 불가능합니다.</p>\n\n                    <div style="background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0;">'
    text = text[:bad_line_start] + fixed_line + text[end_of_line:]

# Fix the duplicate block around line 495
bad_dup = text.find('                            <li>초기화되지 않은                     <h4 style="color: var(--primary-dark); margin: 15px 0 10px;">[🚨 본체 외 구성품은 폐기됩니다 🚨]</h4>')
if bad_dup != -1:
    end_dup = text.find('\n', bad_dup)
    fixed_dup = '                            <li>초기화되지 않은 기기는 검수 및 매입이 지연될 수 있습니다.</li>\n                            <li>발송 전 <strong>모든 계정(삼성, 애플, 구글 등) 로그아웃</strong> 필수</li>\n                            <li>본 약관에 동의함은 발송 전 데이터 백업 및 삭제 책임이 고객 본인에게 있음을 동의하는 것으로 간주됩니다.</li>\n                        </ul>\n                    </div>\n\n                    <h4 style="color: var(--primary-dark); margin: 15px 0 10px;">[🚨 본체 외 구성품은 폐기됩니다 🚨]</h4>'
    text = text[:bad_dup] + fixed_dup + text[end_dup:]

# Also fix the weird extra text
extra_bad = text.find('</div>   <li>분실/도난/거래정지 등 등록 폰</li>')

if extra_bad != -1:
    # Delete from extra_bad to the end of the duplicate list
    end_extra = text.find('        <!-- Step 7: Form (Updated Delivery Methods) -->', extra_bad)
    # Actually just taking the good step 7
    step7_start = text.find('        <!-- Step 7: Form (Updated Delivery Methods) -->')
    
    text = text[:extra_bad] + "</div>\n" + text[step7_start:]

with codecs.open("quote.html", "w", encoding="utf-8") as f:
    f.write(text)

print("HTML structural repair completed.")
