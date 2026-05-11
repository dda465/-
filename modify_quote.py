import re
import sys
import codecs

with codecs.open("quote.html", "r", encoding="utf-8") as f:
    html_content = f.read()

checkbox_html = """
                <!-- Terms Agreement Checkbox -->
                <div class="mb-4" style="display: flex; align-items: center; justify-content: space-between; background: #F8F9FA; padding: 15px; border-radius: 8px; border: 1px solid #E5E7EB; margin-top: 20px;">
                    <label style="display: flex; align-items: center; cursor: pointer; margin: 0; font-size: 0.95rem; color: #333;">
                        <input type="checkbox" id="agree-terms" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                        <span>이용약관 및 개인정보 처리방침 동의 <span style="color:red">*</span></span>
                    </label>
                    <button type="button" onclick="openTermsModal()" style="background: none; border: none; color: #2563EB; font-size: 0.9rem; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0;">보기</button>
                </div>
"""

def inject_checkbox(content):
    auth_start = content.find('id="wizard-step-auth"')
    auth_end = content.find('id="termsModal"', auth_start) 
    if auth_end == -1: auth_end = len(content)
    
    auth_slice = content[auth_start:auth_end]
    
    # Let's just find the exact phone input tag and the closing div after it
    # <input type="tel" id="auth-phone" ... >
    # </div>
    phone_input_start = auth_slice.find('id="auth-phone"')
    if phone_input_start != -1:
        # Find the next </div>
        closing_div = auth_slice.find('</div>', phone_input_start)
        if closing_div != -1:
            end_pos = closing_div + 6 # len('</div>')
            new_auth_slice = auth_slice[:end_pos] + "\n" + checkbox_html + auth_slice[end_pos:]
            return content[:auth_start] + new_auth_slice + content[auth_end:]
            
    print("Could not find phone input in auth step")
    return content

html_content = inject_checkbox(html_content)

terms_step_regex = r'<div id="wizard-step-terms"[\s\S]*?(?=<div id="wizard-step-7")'
match = re.search(terms_step_regex, html_content)
if match:
    html_content = html_content[:match.start()] + html_content[match.end():]
    print("Removed old wizard-step-terms")
else:
    print("wizard-step-terms not found (maybe already removed or modal is used)")

with codecs.open("quote.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print("Modification partial script completed.")
