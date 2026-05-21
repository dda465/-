import re

def fix_telegram_notifications():
    with open('script.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Inject into btn-auth-next
    target_auth = """                const docRef = await addDoc(collection(db, "quotes"), payload);
                window.currentQuoteDocId = docRef.id;
                
                window.trackFunnel("quote_auth_complete");"""
                
    replacement_auth = """                const docRef = await addDoc(collection(db, "quotes"), payload);
                window.currentQuoteDocId = docRef.id;
                
                window.trackFunnel("quote_auth_complete");

                // --- 1차 접수 완료 텔레그램 알림 ---
                try {
                    const tgMessage = `
🔔 *새로운 매입 신청 알림 (배송지 미입력)*

👤 *신청자*: ${payload.customerName}
📞 *연락처*: ${payload.customerPhone}
📱 *모델*: ${payload.brand} ${payload.model} (${payload.storage})
💰 *예상가*: ${new Intl.NumberFormat('ko-KR').format(payload.price)}원
⚠️ *상태*: 배송 방법 미입력 (고객 이탈 시 해피콜 필요)
`.trim();
                    fetch(`https://asia-northeast3-rejeuphone.cloudfunctions.net/telegramApi/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: tgMessage })
                    }).catch(e => console.error("Telegram Error:", e));
                } catch(e) {}"""
                
    if target_auth in js:
        js = js.replace(target_auth, replacement_auth)
        print("Updated btn-auth-next Telegram notification")
    else:
        print("Could not find target_auth in script.js")

    # 2. Inject into btn-submit-delivery
    target_delivery = """                // --- Alimtalk Trigger ---
                const customerPhone = document.getElementById('auth-phone').value.trim();
                const customerName = document.getElementById('auth-name').value.trim();"""
                
    replacement_delivery = """                // --- 배송 방법 확정 텔레그램 알림 ---
                try {
                    const tgMessage = `
✅ *배송 방법 확정 알림*

👤 *신청자*: ${document.getElementById('auth-name').value.trim()}
📞 *연락처*: ${document.getElementById('auth-phone').value.trim()}
🚚 *방식*: ${deliveryMethod === 'courier' ? '방문수거 (희망일: ' + pickupDate + ')' : '직접발송'}
`.trim();
                    fetch(`https://asia-northeast3-rejeuphone.cloudfunctions.net/telegramApi/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: tgMessage })
                    }).catch(e => console.error("Telegram Error:", e));
                } catch(e) {}
                
                // --- Alimtalk Trigger ---
                const customerPhone = document.getElementById('auth-phone').value.trim();
                const customerName = document.getElementById('auth-name').value.trim();"""

    if target_delivery in js:
        js = js.replace(target_delivery, replacement_delivery)
        print("Updated btn-submit-delivery Telegram notification")
    else:
        print("Could not find target_delivery in script.js")
        
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_telegram_notifications()
