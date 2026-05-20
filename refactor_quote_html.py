import re

def refactor_quote_html():
    with open('quote.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Update wizard-step-auth button text
    html = html.replace('id="btn-auth-next" class="btn btn-primary" style="width: 100%;">이 가격으로 판매 신청</button>',
                        'id="btn-auth-next" class="btn btn-primary" style="width: 100%;">판매 신청 완료하기</button>')
                        
    # 2. Extract wizard-step-7 content
    m7 = re.search(r'(<div id="wizard-step-7" class="wizard-step">.*?)(<!-- Step 8: Success -->)', html, re.DOTALL)
    if not m7:
        print("Could not find step 7")
        return
        
    step7_html = m7.group(1)
    
    # 3. Extract wizard-step-8 content
    m8 = re.search(r'(<div id="wizard-step-8" class="wizard-step">.*?</div>\s*</div>)', html, re.DOTALL)
    if not m8:
        print("Could not find step 8")
        return
        
    step8_html = m8.group(1)
    
    # We will build a new step 8 that contains step 7's form, and hide step 7 completely (or delete it).
    
    new_step8 = """
        <!-- Step 8: Success & Delivery Selection -->
        <div id="wizard-step-8" class="wizard-step">
            <div id="step8-delivery-section">
                <div class="step-header">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🎉</div>
                    <h2 style="color: #2563EB;">신청이 1차 완료되었습니다!</h2>
                    <p style="font-size: 1.1rem; color: #475569; margin-top: 10px; font-weight: 600;">마지막으로 기기 전달 방식을 선택해 주세요.</p>
                </div>
                
                <!-- Insert Delivery Form from Step 7 here -->
                <div class="form-container" style="max-width: 500px; margin: 0 auto; margin-top: 30px;">
                    <!-- Delivery Method Selection -->
                    <div class="mb-4" style="text-align: left;">
                        <div class="selection-grid" style="grid-template-columns: 1fr;">
                            <div class="selection-card method-btn" data-method="cvs" style="padding: 15px; text-align: left; display: flex; align-items: center; gap: 15px;">
                                <div style="background: #E3F2FD; padding: 10px; border-radius: 50%;">🏪</div>
                                <div>
                                    <div class="card-title" style="font-size: 1rem; margin: 0; text-align: left;">택배비 지원받기 (직접 발송)</div>
                                    <div class="card-sub" style="font-size: 0.8rem; margin: 0; text-align: left;">편의점, 우체국 등 가까운 택배접수처를 통해 기기를 발송해주세요</div>
                                </div>
                            </div>
                            <div class="selection-card method-btn active" data-method="courier" style="padding: 15px; text-align: left; display: flex; align-items: center; gap: 15px;">
                                <div style="background: #E8F5E9; padding: 10px; border-radius: 50%;">📦</div>
                                <div>
                                    <div class="card-title" style="font-size: 1rem; margin: 0; text-align: left; display: flex; align-items: center;">
                                        택배 방문수거
                                        <span style="background: linear-gradient(135deg, #FF4B2B 0%, #FF416C 100%); color: white; font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; margin-left: 8px; font-weight: 800; box-shadow: 0 2px 5px rgba(255, 65, 108, 0.3);">택배비 무료 🆓</span>
                                    </div>
                                    <div class="card-sub" style="font-size: 0.8rem; margin: 0; text-align: left; margin-top: 5px;">박스 포장 후 문 앞에 두시면 수거해 드려요.<br>(검수 당일입금)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Self Info (Shown for CVS) -->
                    <div id="method-cvs-info" style="display: none; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left; border: 1px solid #ddd;">
                        <p style="font-weight: 600; margin-bottom: 5px;">[보내실 곳]</p>
                        <p style="font-size: 0.9rem; color: #555;">
                            받는 이: 쉐라폰<br>
                            부산시 부산진구 동천로 116 한신밴빌딩 1003호<br>
                            연락처: 010-3263-5672
                        </p>
                    </div>

                    <!-- Courier Info (Shown by default) -->
                    <div id="method-courier-date" style="display: block; background: #fff; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left; border: 1px solid #ddd;">
                        <label style="display:block; margin-bottom:5px; font-weight:600;">희망 수거일자 <span style="color:red">*</span></label>
                        <select id="courier-pickup-date" class="search-input" style="width:100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;"></select>
                    </div>

                    <!-- Common Fields -->
                    <div class="mb-2" style="text-align: left;">
                        <label style="display:block; margin-bottom:5px; font-weight:600;">상세 주소 (수거지)</label>
                        <input type="text" id="customer-address" class="search-input" style="width:100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;" placeholder="주소를 입력해주세요">
                    </div>

                    <div class="mb-3" style="text-align: left;">
                        <label style="display:block; margin-bottom:5px; font-weight:600;">계좌 정보 (입금 받을 곳)</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="customer-bank" class="search-input" style="width:30%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;" placeholder="은행명">
                            <input type="text" id="customer-account" class="search-input" style="width:70%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;" placeholder="계좌번호 (- 없이)">
                        </div>
                    </div>

                    <div class="mb-4" style="text-align: left;">
                        <label style="display:block; margin-bottom:5px; font-weight:600;">요청사항 / 메모 (선택)</label>
                        <textarea id="customer-memo" class="search-input" rows="3" style="width:100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-family: inherit;" placeholder="택배 수거 시 요청사항이나 기타 남기실 말씀이 있다면 적어주세요."></textarea>
                    </div>

                    <div class="text-center">
                        <button id="btn-submit-delivery" class="btn btn-primary" style="width: 100%; font-size: 1.1rem; padding: 15px;">기기 발송 방법 확정</button>
                    </div>
                </div>
            </div>
            
            <div id="step8-final-section" style="display: none;">
                <div class="step-header">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🎉</div>
                    <h2>배송 접수가 완료되었습니다!</h2>
                    <div id="success-instruction" style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: left;">
                        <!-- Javascript will populate this based on delivery method -->
                        <p>담당자가 확인 후 연락드리겠습니다.</p>
                    </div>
                </div>
                <div class="text-center" style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
                    <a href="index.html" class="btn" style="background-color: #e9ecef; color: #333;">홈으로 돌아가기</a>
                </div>
            </div>
        </div>
"""

    html = html.replace(step8_html, new_step8)
    
    # Remove step 7 completely
    html = html.replace(step7_html, '')
    
    with open('quote.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("quote.html refactored.")

refactor_quote_html()
