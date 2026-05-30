import os

with open('quote-foreigner.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find where confirmAndSubmit begins
idx_start = -1
for i, line in enumerate(lines):
    if 'window.confirmAndSubmit = async function()' in line:
        idx_start = i
        break

if idx_start != -1:
    # Keep lines up to idx_start + 1
    good_lines = lines[:idx_start]
    
    # We will inject the full confirmAndSubmit, then the initialization, then the </script>, then the modal, then </body></html>
    
    confirm_and_submit_code = """        window.confirmAndSubmit = async function() {
            const name = document.getElementById('fg-name').value.trim();
            const contact = document.getElementById('fg-contact-value').value.trim();
            const bankAccount = document.getElementById('fg-bank-account').value.trim();

            // 버튼 상태 변경 (로딩 중)
            const submitBtn = document.getElementById('p-btn-submit');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';

            // 가격 계산
            const p = selectedQuote._priceData;
            let price = 0;
            if (p) {
                price = (p.basePrice || 0) + (selectedQuote._storageAdj || 0);
                const defectCount = Object.values(selectedQuote.defects).filter(v => v).length;
                if (defectCount > 0) price = Math.round(price * (1 - defectCount * 0.08));
                if (price < 0) price = 0;
            }
            document.getElementById('fg-price').textContent = new Intl.NumberFormat('ko-KR').format(price) + ' ₩';
            document.getElementById('fg-model-summary').textContent = `${selectedQuote.brand === 'apple' ? 'Apple' : 'Samsung'} ${selectedQuote.model} ${selectedQuote.storage}`;
            
            // 요약 정보
            const defectList = Object.entries(selectedQuote.defects).filter(([k,v]) => v).map(([k]) => k);
            const methodIcons = { phone: '📱', whatsapp: '💬', wechat: '🟢', line: '🟩', kakaotalk: '💛', email: '📧' };
            const paymentIcon = '🏦';
            const paymentText = 'Bank Transfer (' + bankAccount + ')';

            document.getElementById('fg-summary-details').innerHTML = `
                <div>📱 <strong>Device:</strong> ${selectedQuote.brand === 'apple' ? 'Apple' : 'Samsung'} ${selectedQuote.model} ${selectedQuote.storage}</div>
                <div>🔍 <strong>Issues:</strong> ${defectList.length === 0 ? 'None' : defectList.join(', ')}</div>
                <div>👤 <strong>Name:</strong> ${name}</div>
                <div>${methodIcons[selectedMethod] || '📱'} <strong>${selectedMethod.charAt(0).toUpperCase() + selectedMethod.slice(1)}:</strong> ${contact}</div>
                <div>📍 <strong>Delivery:</strong> Convenience Store Shipping</div>
                <div>${paymentIcon} <strong>Payment:</strong> ${paymentText}</div>
            `;

            const payload = {
                timestamp: new Date().toLocaleString(),
                brand: selectedQuote.brand === 'apple' ? 'Apple' : 'Samsung',
                model: selectedQuote.model,
                series: 'Foreigner',
                storage: selectedQuote.storage,
                grade: 'B', // default for foreigner
                conditionType: 'used',
                price: price,
                customerName: name,
                customerPhone: `${contact} (${selectedMethod})`,
                customerAddress: 'Foreigner Convenience Store Shipping',
                deliveryMethod: 'Foreigner Pickup',
                pickupDate: '',
                customerAccount: bankAccount,
                customerMemo: `Language: ${currentLang}\\nDefects: ${defectList.length === 0 ? 'None' : defectList.join(', ')}`,
                userId: auth.currentUser ? auth.currentUser.uid : 'anonymous',
                method: 'foreigner',
                
                // Additional fields for foreigner specifically
                language: currentLang,
                status: 'pending',
                isForeigner: true,
                paymentMethod: 'bank',
                contactMethod: selectedMethod,
                finalPrice: price
            };
            
            try {
                // 익명 로그인 후 Firestore 저장
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
                await addDoc(collection(db, 'quotes'), payload);
                
                // Telegram 알림 전송
                const telegramMsg = `
[🌍 외국인 매입 신청]
👤 이름: ${payload.customerName}
${methodIcons[selectedMethod]} 연락처(${selectedMethod}): ${payload.customerPhone}
📍 배송방식: 편의점 택배 직접 발송
${paymentIcon} 입금방식: ${paymentText}
🗣️ 언어: ${payload.language.toUpperCase()}

📱 기종: ${payload.brand} ${payload.model.model} (${payload.storage.size})
💰 예상매입가: ${new Intl.NumberFormat('ko-KR').format(price)} 원
🔍 체크된 하자: ${defectList.length === 0 ? '없음' : defectList.join(', ')}
`;
                fetch('https://asia-northeast3-rejeuphone.cloudfunctions.net/telegramApi/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: telegramMsg })
                }).catch(e => console.error('Telegram API Error:', e));

                goToStep(7);
            } catch (error) {
                console.error('Submission failed:', error);
                alert('Submission failed: ' + (error.message || JSON.stringify(error)));
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                closePresaleModal();
            }
        };

        // ─── 초기화 ───
        loadPhoneData().then(() => {
            checkUrlLang();
        });
    </script>
"""

    modal_code = """
    <!-- Presale Modal (Reset & Delivery Guide) -->
    <div id="presale-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; border-radius: 12px; width: 90%; max-width: 450px; max-height: 90vh; display: flex; flex-direction: column;">
            <style>
                .presale-step-dot { width: 30px; height: 30px; border-radius: 50%; background: #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: 0.3s; }
                .presale-step-dot.active { background: #2563eb; color: white; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3); }
                .guide-image-container { position: relative; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #f8fafc; }
                .finger-pointer { position: absolute; width: 30px; height: 30px; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232563eb"><path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.14 2-3.74a4.5 4.5 0 0 0-9 0c0 1.6.79 2.93 2 3.74zm9.75 3.31a5.47 5.47 0 0 0-2.3-3.69l-1.37-.92a2.5 2.5 0 0 1-5.16 0l-1.37.92a5.47 5.47 0 0 0-2.3 3.69 1.48 1.48 0 0 0 .54 1.77L11.5 20.3a2.5 2.5 0 0 0 2.83 0l4.71-3.98a1.48 1.48 0 0 0 .71-1.77z"/></svg>') no-repeat center; background-size: contain; animation: pointBounce 1.5s infinite; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
                @keyframes pointBounce { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(-5px,-5px); } }
                .presale-action-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; background: white; }
                .presale-btn-nav { padding: 14px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
            </style>
            
            <div class="modal-header" style="position: relative; padding: 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                <h3 style="margin: 0; font-size: 1.2rem; color: #0f172a; font-weight:bold;" data-i18n="presale_title">Before You Submit</h3>
                <button onclick="closePresaleModal()" style="position: absolute; right: 20px; top: 20px; background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer;">&times;</button>
            </div>
            
            <div style="display: flex; justify-content: center; align-items: center; padding: 20px 0 10px; gap: 15px;">
                <div class="presale-step-dot active" id="p-dot-1">1</div>
                <div style="height: 2px; width: 40px; background: #e2e8f0;"></div>
                <div class="presale-step-dot" id="p-dot-2">2</div>
                <div style="height: 2px; width: 40px; background: #e2e8f0;"></div>
                <div class="presale-step-dot" id="p-dot-3">3</div>
            </div>

            <div class="modal-body" style="padding: 0 24px 24px; overflow-y: auto; flex: 1;">
                
                <!-- Section 1: Factory Reset -->
                <div id="presale-section-1">
                    <div id="presale-step-1-apple" style="display: none;">
                        <h4 style="margin: 0 0 15px; font-size: 1.15rem; color: #0f172a;" data-i18n="presale_apple_title">1. Sign out & Factory Reset</h4>
                        <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 16px; border-radius: 12px; font-size: 0.9rem; color: #475569; margin-bottom: 20px; line-height: 1.5;">
                            <strong>※ Activation lock may still remain even after reset.</strong><br>
                            Please turn off 'Find My iPhone' and sign out completely.<br>
                            <span style="color: #2563EB; font-weight: bold;">Settings ➜ Apple ID ➜ Sign Out</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
                            <div style="width: 100%; max-width: 320px; text-align: center;">
                                <div class="guide-image-container">
                                    <img src="assets/guide/apple_1.png" style="width: 100%; display: block;"/>
                                </div>
                                <div style="font-size: 0.95rem; font-weight: 700; margin-top: 5px;">Tap [Apple ID]</div>
                            </div>
                            <div style="width: 100%; max-width: 320px; text-align: center;">
                                <div class="guide-image-container">
                                    <img src="assets/guide/apple_2.png" style="width: 100%; display: block;"/>
                                </div>
                                <div style="font-size: 0.95rem; font-weight: 700; margin-top: 5px;">Scroll down and tap [Sign Out]</div>
                            </div>
                        </div>
                    </div>

                    <div id="presale-step-1-samsung" style="display: none;">
                        <h4 style="margin: 0 0 15px; font-size: 1.15rem; color: #0f172a;" data-i18n="presale_samsung_title">1. Factory Data Reset</h4>
                        <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 16px; border-radius: 12px; font-size: 0.9rem; color: #475569; margin-bottom: 20px; line-height: 1.5;">
                            All accounts including Samsung/Google must be removed.<br>
                            <span style="color: #2563EB; font-weight: bold;">Settings ➜ General management ➜ Reset ➜ Factory data reset</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
                            <div style="width: 100%; max-width: 320px; text-align: center;">
                                <div class="guide-image-container">
                                    <img src="assets/guide/samsung_1.jpg" style="width: 100%; display: block;"/>
                                </div>
                                <div style="font-size: 0.95rem; font-weight: 700; margin-top: 5px;">Tap [General management]</div>
                            </div>
                            <div style="width: 100%; max-width: 320px; text-align: center;">
                                <div class="guide-image-container">
                                    <img src="assets/guide/samsung_3.jpg" style="width: 100%; display: block;"/>
                                </div>
                                <div style="font-size: 0.95rem; font-weight: 700; margin-top: 5px;">Tap [Factory data reset]</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 2: Data Deletion & SIM -->
                <div id="presale-section-2" style="display: none;">
                    <h4 style="margin: 0 0 15px; font-size: 1.15rem; color: #0f172a;" data-i18n="presale_data_title">2. SIM Card & Data Policy</h4>
                    <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 16px; border-radius: 12px; font-size: 0.9rem; color: #475569; margin-bottom: 24px; line-height: 1.5;">
                        Please backup your important data and remove your SIM card before shipping. <strong>We will permanently erase all remaining data upon inspection.</strong>
                    </div>
                    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                        <div class="presale-action-card">
                            <div style="background: #eff6ff; color: #2563EB; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 12px;">✂️</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: #1e293b;" data-i18n="presale_sim">Remove SIM</div>
                        </div>
                        <div class="presale-action-card">
                            <div style="background: #eff6ff; color: #2563EB; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 12px;">🗑️</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: #1e293b;" data-i18n="presale_data">Data Wiped</div>
                        </div>
                    </div>
                </div>

                <!-- Section 3: Delivery Guide -->
                <div id="presale-section-3" style="display: none;">
                    <h4 style="margin: 0 0 15px; font-size: 1.15rem; color: #0f172a;" data-i18n="presale_shipping_title">3. Shipping Guide</h4>
                    <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 16px; border-radius: 12px; font-size: 0.9rem; color: #92400e; margin-bottom: 16px; line-height: 1.5;">
                        <strong>⚠️ You must ship your phone to us directly.</strong><br>
                        Please securely pack your phone and drop it off at any <strong>CU</strong> or <strong>GS25</strong> convenience store using their parcel service (Postpaid/Receiver pays).
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px;">
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: bold; margin-bottom: 4px;">Shipping Address (Receiver):</div>
                        <div style="font-size: 0.95rem; color: #0f172a; font-weight: 600; line-height: 1.5;">
                            Busan, Busanjin-gu, Dongcheon-ro 116<br>
                            Hanshin Van Building #1003<br>
                            (Rejeuphone)
                        </div>
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: bold; margin-top: 10px; margin-bottom: 4px;">Korean Address (Show to clerk):</div>
                        <div style="font-size: 0.95rem; color: #0f172a; font-weight: 600; line-height: 1.5;">
                            부산시 부산진구 동천로 116<br>
                            한신밴빌딩 1003호 (리쥬폰)
                        </div>
                    </div>
                </div>

            </div>

            <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #f1f5f9; display: flex; gap: 12px; background: white; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
                <button id="p-btn-prev" class="presale-btn-nav" style="display: none; border: 1px solid #cbd5e1; background: white; color: #475569;" onclick="presaleGoPrev()">Back</button>
                <button id="p-btn-next" class="presale-btn-nav" style="flex: 1; background: #2563EB; color: white; border: none;" onclick="presaleGoNext()">Next</button>
                <button id="p-btn-submit" class="presale-btn-nav" style="display: none; flex: 1; background: #16a34a; color: white; border: none;" onclick="confirmAndSubmit()">I Understand & Submit</button>
            </div>
        </div>
    </div>
</body>
</html>
"""
    
    with open('quote-foreigner.html', 'w', encoding='utf-8') as f:
        f.write(''.join(good_lines))
        f.write(confirm_and_submit_code)
        f.write(modal_code)
