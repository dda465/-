import re

def add_google_sheet():
    with open('script.js', 'r', encoding='utf-8') as f:
        js = f.read()

    target = """                const docRef = doc(db, "quotes", window.currentQuoteDocId);
                
                const updatePayload = {
                    customerAddress: needsAddress ? address : '편의점/직접 택배 발송',
                    deliveryMethod: deliveryMethod,
                    pickupDate: pickupDate,
                    customerAccount: account,
                    customerMemo: memo
                };
                
                await updateDoc(docRef, updatePayload);"""

    replacement = """                const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const docRef = doc(db, "quotes", window.currentQuoteDocId);
                
                const updatePayload = {
                    customerAddress: needsAddress ? address : '편의점/직접 택배 발송',
                    deliveryMethod: deliveryMethod,
                    pickupDate: pickupDate,
                    customerAccount: account,
                    customerMemo: memo
                };
                
                await updateDoc(docRef, updatePayload);

                // --- Google Sheet Trigger (최종 확정 시) ---
                try {
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const fullData = snap.data();
                        
                        // 구글 시트 및 Google Ads 전환 추적 (isIphone, isSamsung 로직 포함)
                        const isIphone = fullData.brand && fullData.brand.toLowerCase() === 'apple';
                        const isSamsung = fullData.brand && fullData.brand.toLowerCase() === 'samsung' || 
                                          (fullData.model && fullData.model.includes('갤럭시'));
                        
                        if (isIphone) {
                            if (typeof gtag === 'function') {
                                gtag('event', 'conversion', {
                                    'send_to': 'AW-18055027970/QL8CCL-Ur68cEIK6p6FD',
                                    'value': fullData.price || fullData.expectedPrice || 1.0,
                                    'currency': 'KRW',
                                    'transaction_id': window.currentQuoteDocId || ''
                                });
                            }
                        } else if (isSamsung) {
                            if (typeof gtag === 'function') {
                                gtag('event', 'conversion', {
                                    'send_to': 'AW-18055027970/EYqmCNfnrq8cEIK6p6FD',
                                    'value': fullData.price || fullData.expectedPrice || 1.0,
                                    'currency': 'KRW',
                                    'transaction_id': window.currentQuoteDocId || ''
                                });
                            }
                        }
                        
                        fetch(GOOGLE_SCRIPT_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain' },
                            body: JSON.stringify(fullData)
                        }).catch(e => console.error("Google Sheet Fetch Error:", e));
                    }
                } catch(e) {
                    console.error("Google Sheet Integration Error:", e);
                }"""

    if target in js:
        js = js.replace(target, replacement)
        print("Updated Google Sheet integration in script.js")
    else:
        print("Target not found in script.js")

    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(js)

add_google_sheet()
