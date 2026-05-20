import re

def add_resume_logic():
    with open('script.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Find the top of DOMContentLoaded
    target = """document.addEventListener('DOMContentLoaded', () => {"""
    
    replacement = """document.addEventListener('DOMContentLoaded', async () => {
    // --- RESUME LOGIC ---
    const resumeDocId = new URLSearchParams(window.location.search).get('resume_doc_id');
    if (resumeDocId) {
        window.currentQuoteDocId = resumeDocId;
        try {
            const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            // window.db is imported at top of script.js as db
            const docRef = doc(db, "quotes", resumeDocId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.deliveryMethod !== 'pending') {
                    alert("이미 배송 방법이 확정된 신청건입니다.");
                    window.location.href = "index.html";
                    return;
                }
                
                // Hide all other steps, show step 8
                setTimeout(() => {
                    goToStep(8);
                    const header = document.querySelector('#wizard-step-8 h2');
                    if (header) {
                        header.innerHTML = `신청이 1차 완료되었습니다!<br><span style="font-size:1.2rem; color:#64748b; font-weight: 500;">(${data.brand} ${data.model})</span>`;
                    }
                    
                    // We also need to pre-fill name/phone from data if possible so alimtalk works
                    const nameInput = document.getElementById('auth-name');
                    const phoneInput = document.getElementById('auth-phone');
                    if (nameInput) nameInput.value = data.customerName;
                    if (phoneInput) phoneInput.value = data.customerPhone;
                }, 500); // slight delay to let UI init
            } else {
                alert("해당 신청내역을 찾을 수 없습니다.");
            }
        } catch(e) {
            console.error(e);
        }
    }
"""

    if target in js:
        js = js.replace(target, replacement, 1)
        with open('script.js', 'w', encoding='utf-8') as f:
            f.write(js)
        print("Updated script.js with resume logic")
    else:
        print("Could not find target in script.js")

add_resume_logic()
