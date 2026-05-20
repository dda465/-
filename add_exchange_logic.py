import re

js_code = """
// --- Exchange Form Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const exchangeForm = document.getElementById('exchangeForm');
    if (exchangeForm) {
        exchangeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Check auth
            const user = window.auth && window.auth.currentUser;
            if (!user) {
                alert('로그인이 필요한 서비스입니다.');
                window.location.href = 'login.html';
                return;
            }

            const submitBtn = exchangeForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerText = '신청 접수 중...';

            try {
                const docData = {
                    uid: user.uid,
                    my_name: document.getElementById('ex_my_name').value,
                    my_phone: document.getElementById('ex_my_phone').value,
                    my_device: document.getElementById('ex_my_device').value,
                    partner_name: document.getElementById('ex_partner_name').value,
                    partner_phone: document.getElementById('ex_partner_phone').value,
                    partner_device: document.getElementById('ex_partner_device').value,
                    diff_type: document.getElementById('ex_diff_type').value,
                    diff_amount: document.getElementById('ex_diff_amount') ? (document.getElementById('ex_diff_amount').value || 0) : 0,
                    memo: document.getElementById('ex_memo') ? document.getElementById('ex_memo').value : '',
                    status: 'pending_deposit', // 입금 대기
                    createdAt: new Date() // Use JS Date for now, will be converted by Firestore or use serverTimestamp if imported
                };

                // Assume addDoc and collection are available globally or we can use window.db
                // In script.js, db is usually exported or available in the module scope.
                // We will use the same imports script.js already has.
                // Since this is appended to script.js, we have access to db, collection, addDoc.
                
                await window.addDoc(window.collection(window.db, "exchange_applications"), docData);
                
                alert('안심 교환 신청이 완료되었습니다! 전문 상담원이 곧 해피콜을 드릴 예정입니다.');
                window.location.href = 'mypage.html';
            } catch (error) {
                console.error("Error adding exchange document: ", error);
                // Fallback for missing exports
                try {
                    const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                    docData.createdAt = serverTimestamp();
                    await addDoc(collection(window.db, "exchange_applications"), docData);
                    alert('안심 교환 신청이 완료되었습니다! 전문 상담원이 곧 해피콜을 드릴 예정입니다.');
                    window.location.href = 'mypage.html';
                } catch(err2) {
                    alert('신청 접수 중 오류가 발생했습니다. (DB 연결 에러)');
                    submitBtn.disabled = false;
                    submitBtn.innerText = '안심 교환 신청하기';
                }
            }
        });
    }
});
"""

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure addDoc and collection are exported to window so we can safely use them, or just rely on module scope if we inject directly.
# Since we append, it's in the same module scope! We can just use addDoc, collection, serverTimestamp directly!

js_code_direct = """
// --- Exchange Form Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const exchangeForm = document.getElementById('exchangeForm');
    if (exchangeForm) {
        exchangeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!auth.currentUser) {
                alert('로그인이 필요한 서비스입니다.');
                window.location.href = 'login.html';
                return;
            }

            const submitBtn = exchangeForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerText = '신청 접수 중...';

            try {
                const docData = {
                    uid: auth.currentUser.uid,
                    my_name: document.getElementById('ex_my_name').value,
                    my_phone: document.getElementById('ex_my_phone').value,
                    my_device: document.getElementById('ex_my_device').value,
                    partner_name: document.getElementById('ex_partner_name').value,
                    partner_phone: document.getElementById('ex_partner_phone').value,
                    partner_device: document.getElementById('ex_partner_device').value,
                    diff_type: document.getElementById('ex_diff_type').value,
                    diff_amount: document.getElementById('ex_diff_amount') ? (document.getElementById('ex_diff_amount').value || 0) : 0,
                    memo: document.getElementById('ex_memo') ? document.getElementById('ex_memo').value : '',
                    status: 'pending_deposit',
                    createdAt: serverTimestamp()
                };

                await addDoc(collection(db, "exchange_applications"), docData);
                
                alert('안심 교환 신청이 완료되었습니다! 전문 상담원이 곧 해피콜을 드릴 예정입니다.');
                window.location.href = 'mypage.html';
            } catch (error) {
                console.error("Error adding exchange document: ", error);
                alert('신청 중 오류가 발생했습니다. 고객센터로 문의해주세요.');
                submitBtn.disabled = false;
                submitBtn.innerText = '안심 교환 신청하기';
            }
        });
    }
});
"""

if "exchangeForm" not in content:
    with open('script.js', 'a', encoding='utf-8') as f:
        f.write('\n' + js_code_direct)
    print("Exchange logic appended to script.js")
else:
    print("Exchange logic already exists.")
