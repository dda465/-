import re
import os

filepath = r"c:\Users\PC\Desktop\used-phone-market\quote.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add PortOne SDK to head
portone_sdk = '<script src="https://cdn.iamport.kr/v1/iamport.js"></script>'
if portone_sdk not in content:
    content = content.replace('</head>', f'    {portone_sdk}\n</head>')

# 2. Add Identity Verification Button in Auth Step
auth_step_html = '''                <div class="mb-4">

                    <label class="form-label">휴대폰 번호 (- 없이 입력) <span style="color:red">*</span></label>

                    <input type="tel" id="auth-phone" class="search-input"

                        style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;"

                        placeholder="예) 01012345678" maxlength="11">

                </div>'''

verification_btn_html = '''                <div class="mb-4">

                    <label class="form-label">휴대폰 번호 (- 없이 입력) <span style="color:red">*</span></label>

                    <div style="display: flex; gap: 10px;">
                        <input type="tel" id="auth-phone" class="search-input"
                            style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px;"
                            placeholder="예) 01012345678" maxlength="11" readonly>
                        <button type="button" id="btn-verify-identity" class="btn btn-secondary" style="white-space: nowrap; padding: 0 20px; font-weight: 700;">본인인증</button>
                    </div>
                    <input type="hidden" id="is-verified" value="false">

                </div>'''

# We also need to make auth-name readonly so it gets filled by the verification
content = content.replace('id="auth-name" class="search-input"', 'id="auth-name" class="search-input" readonly')

content = content.replace(auth_step_html, verification_btn_html)

# 3. Add JS for PortOne
js_logic = '''
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            var btnVerify = document.getElementById('btn-verify-identity');
            if (btnVerify) {
                btnVerify.addEventListener('click', function() {
                    var IMP = window.IMP;
                    IMP.init('imp25541365'); // V1 Store ID
                    IMP.certification({
                        merchant_uid: 'cert_' + new Date().getTime(),
                        m_redirect_url: window.location.href // for mobile redirect
                    }, function (rsp) {
                        if (rsp.success) {
                            alert('본인인증이 완료되었습니다.');
                            document.getElementById('is-verified').value = 'true';
                            // Normally, you would query your server with rsp.imp_uid to get the real name and phone.
                            // Since we don't have a backend doing that yet, we allow the user to input name manually or just mark as verified.
                            document.getElementById('auth-name').readOnly = false;
                            document.getElementById('auth-phone').readOnly = false;
                            document.getElementById('auth-name').placeholder = "인증 완료 (실명을 입력해주세요)";
                            document.getElementById('auth-phone').placeholder = "인증 완료 (번호를 입력해주세요)";
                            document.getElementById('auth-name').focus();
                            btnVerify.innerText = "인증완료";
                            btnVerify.disabled = true;
                            btnVerify.style.background = "#4ade80";
                            btnVerify.style.color = "white";
                            btnVerify.style.border = "none";
                        } else {
                            alert('본인인증에 실패했습니다: ' + rsp.error_msg);
                        }
                    });
                });
            }
            
            // Intercept next button in auth step to require verification
            var btnAuthNext = document.getElementById('btn-auth-next');
            if (btnAuthNext) {
                btnAuthNext.addEventListener('click', function(e) {
                    var isVerified = document.getElementById('is-verified').value;
                    if (isVerified !== 'true') {
                        e.preventDefault();
                        e.stopPropagation();
                        alert('본인인증을 먼저 진행해주세요.');
                        return false;
                    }
                }, true); // Use capture phase to intercept early
            }
        });
    </script>
'''

content = content.replace('</body>', js_logic + '\n</body>')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated quote.html with PortOne verification.")
