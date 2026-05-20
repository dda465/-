import re

def refactor_script_js():
    with open('script.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # --- 1. Replace btnAuthNext listener ---
    old_btnAuthNext = """        if (btnAuthNext) {
            btnAuthNext.addEventListener('click', () => {
                const name = document.getElementById('auth-name').value.trim();
                const phone = document.getElementById('auth-phone').value.trim();
                const agreeTerms = document.getElementById('agree-terms').checked;

                if (!name || !phone) {
                    alert('휴대폰 본인인증을 완료해주세요.');
                    return;
                }

                if (!window.isPhoneVerified) {
                    alert('휴대폰 본인인증을 진행해 주세요.');
                    return;
                }

                if (!agreeTerms) {
                    alert('이용약관 및 개인정보 처리방침에 동의해 주세요.');
                    return;
                }

                goToStep(7);
            });
        }"""
        
    new_btnAuthNext = """        if (btnAuthNext) {
            btnAuthNext.addEventListener('click', async () => {
                const name = document.getElementById('auth-name').value.trim();
                const phone = document.getElementById('auth-phone').value.trim();
                const agreeTerms = document.getElementById('agree-terms').checked;

                if (!name || !phone) {
                    alert('휴대폰 본인인증을 완료해주세요.');
                    return;
                }

                if (!window.isPhoneVerified) {
                    alert('휴대폰 본인인증을 진행해 주세요.');
                    return;
                }

                if (!agreeTerms) {
                    alert('이용약관 및 개인정보 처리방침에 동의해 주세요.');
                    return;
                }
                
                btnAuthNext.textContent = '처리 중...';
                btnAuthNext.disabled = true;

                // --- 1차 접수 (리드 확보) ---
                const payload = {
                    timestamp: new Date().toLocaleString(),
                    brand: currentQuote.brand,
                    model: currentQuote.model.model,
                    series: currentQuote.model.series || currentQuote.series,
                    storage: currentQuote.storage.size,
                    grade: currentQuote.grade,
                    conditionType: currentQuote.grade === 'sealed' ? 'sealed' : 'used',
                    price: currentQuote.finalPrice,
                    customerName: name,
                    customerPhone: phone,
                    deliveryMethod: 'pending',
                    userId: (() => {
                        try {
                            const localUser = JSON.parse(localStorage.getItem('user_info'));
                            if (localUser && localUser.uid) return localUser.uid;
                        } catch(e) {}
                        if (window.auth && window.auth.currentUser && window.auth.currentUser.uid) return window.auth.currentUser.uid;
                        return 'anonymous';
                    })(),
                    method: currentQuote.method || 'simple',
                    defectsDetails: currentQuote.defectsDetails || {},
                    trafficSource: sessionStorage.getItem('traffic_source') || 'direct'
                };

                try {
                    const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    payload.firebaseTimestamp = serverTimestamp();
                    
                    if (!window.auth.currentUser) {
                        const { signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                        await signInAnonymously(window.auth);
                    }
                    
                    const docRef = await addDoc(collection(window.db, "quotes"), payload);
                    window.currentQuoteDocId = docRef.id;
                    
                    // Proceed to step 8 (Delivery selection)
                    goToStep(8);
                    
                } catch (e) {
                    console.error("1차 접수 오류:", e);
                    alert("접수 중 오류가 발생했습니다. 다시 시도해주세요.");
                    btnAuthNext.textContent = '판매 신청 완료하기';
                    btnAuthNext.disabled = false;
                }
            });
        }"""
        
    js = js.replace(old_btnAuthNext, new_btnAuthNext)
    
    # --- 2. Remove executeFinalSubmit block since we'll use btn-submit-delivery directly ---
    # But wait, executeFinalSubmit might be bound somewhere. It's actually called from btn-submit-final in HTML maybe?
    # Let's just create a new listener at the end of window.addEventListener('DOMContentLoaded'...)
    
    delivery_listener = """
    // --- 2차 접수 (배송 및 계좌 정보 업데이트) ---
    const btnSubmitDelivery = document.getElementById('btn-submit-delivery');
    if (btnSubmitDelivery) {
        btnSubmitDelivery.addEventListener('click', async () => {
            if (!window.currentQuoteDocId) {
                alert("접수 내역을 찾을 수 없습니다. 처음부터 다시 시도해주세요.");
                return;
            }
            
            const address = document.getElementById('customer-address').value.trim();
            const bankName = document.getElementById('customer-bank') ? document.getElementById('customer-bank').value.trim() : '';
            const accountNum = document.getElementById('customer-account').value.trim();
            const account = bankName ? `${bankName} ${accountNum}` : accountNum;
            const memo = document.getElementById('customer-memo') ? document.getElementById('customer-memo').value.trim() : '';

            let deliveryMethod = 'courier';
            const activeBtn = document.querySelector('.method-btn.active');
            if (activeBtn) deliveryMethod = activeBtn.dataset.method;

            let pickupDate = '';
            if (deliveryMethod === 'courier') {
                const pickupElem = document.getElementById('courier-pickup-date');
                if (pickupElem) pickupDate = pickupElem.value;
            }

            const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);
            if (needsAddress && !address) {
                alert("수거를 위해 주소를 입력해주세요.");
                return;
            }
            if (!accountNum) {
                alert("정산을 위해 계좌 정보를 입력해주세요.");
                return;
            }

            btnSubmitDelivery.textContent = '처리 중...';
            btnSubmitDelivery.disabled = true;

            try {
                const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const docRef = doc(window.db, "quotes", window.currentQuoteDocId);
                
                const updatePayload = {
                    customerAddress: needsAddress ? address : '편의점/직접 택배 발송',
                    deliveryMethod: deliveryMethod,
                    pickupDate: pickupDate,
                    customerAccount: account,
                    customerMemo: memo
                };
                
                await updateDoc(docRef, updatePayload);
                
                window.trackFunnel("quote_complete");

                // --- Alimtalk Trigger ---
                const customerPhone = document.getElementById('auth-phone').value.trim();
                const customerName = document.getElementById('auth-name').value.trim();
                if (window.triggerFrontendAlimtalk) {
                    if (deliveryMethod === 'courier') {
                        window.triggerFrontendAlimtalk("quote_courier", customerPhone, {
                            name: customerName,
                            pickupDate: pickupDate,
                            address: updatePayload.customerAddress
                        });
                    } else if (deliveryMethod === 'cvs') {
                        window.triggerFrontendAlimtalk("quote_cvs", customerPhone, {});
                    }
                }

                // --- NAVER 신청완료(lead) SCRIPT ---
                if(window.wcs){
                    if(!window.wcs_add) window.wcs_add = {};
                    window.wcs_add["wa"] = "s_bfc3561d569";
                    var _nasa={};
                    if(window.wcs.inflow) window.wcs.inflow("s_bfc3561d569");
                    _nasa["cnv"] = wcs.cnv("1","1");
                    window.wcs_do(_nasa);
                }

                // UI Transition
                document.getElementById('step8-delivery-section').style.display = 'none';
                document.getElementById('step8-final-section').style.display = 'block';
                
                const instr = document.getElementById('success-instruction');
                if (deliveryMethod === 'cvs') {
                    instr.innerHTML = `<p><strong>📦 택배비 지원받기 접수 완료</strong></p><p>고객님 편하신 편의점/우체국을 통해 아래 주소로 기기를 발송해 주세요.<br><br><strong>보내실 곳:</strong><br>부산시 부산진구 동천로 116 한신밴빌딩 1003호 쉐라폰<br>연락처: 010-3263-5672</p><p>기기가 도착하는 즉시 검수하여 <strong>당일 입금</strong>해 드립니다!</p>`;
                } else {
                    instr.innerHTML = `<p><strong>📦 택배 방문수거 접수 완료</strong></p><p>선택하신 수거일자(${pickupDate})에 맞춰 박스를 포장해 문 앞에 두시면, 택배 기사님이 안전하게 수거해 갈 예정입니다.</p><p>기기가 도착하는 즉시 검수하여 <strong>당일 입금</strong>해 드립니다!</p>`;
                }
                
            } catch (e) {
                console.error("2차 접수 업데이트 오류:", e);
                alert("저장 중 오류가 발생했습니다.");
                btnSubmitDelivery.textContent = '기기 발송 방법 확정';
                btnSubmitDelivery.disabled = false;
            }
        });
    }
"""
    
    # We can inject this at the end of the DOMContentLoaded listener.
    # Searching for the end of document.addEventListener('DOMContentLoaded', () => { ... });
    
    # Alternatively, just append it before `});` that ends DOMContentLoaded.
    # We can just look for `window.executeFinalSubmit = async function() {` and replace that entire function, or simply append our code before `window.executeFinalSubmit`.
    
    js = js.replace('window.executeFinalSubmit = async function() {', delivery_listener + '\n\n    window.executeFinalSubmit = async function() {')
    
    # Need to make sure `db` and `auth` are accessible, we use `window.db` and `window.auth` in the code above, which works if they are exported or global, but they are imported at the top of script.js. Actually script.js imports them. `db` and `auth` are available in script.js scope. So `window.db` might be undefined unless explicitly set. I will use `db` and `auth` directly since they are in scope.
    js = js.replace('window.db', 'db').replace('window.auth', 'auth')

    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(js)
    
    print("script.js refactored.")

refactor_script_js()
