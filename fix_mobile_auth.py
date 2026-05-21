import re

def fix_mobile_auth():
    with open('script.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Add m_redirect_url to IMP.certification
    target_imp = """                IMP.certification({
                    merchant_uid: "cert_" + new Date().getTime(),
                    bypass: {"""
    replacement_imp = """                IMP.certification({
                    merchant_uid: "cert_" + new Date().getTime(),
                    m_redirect_url: window.location.origin + window.location.pathname + "?step=auth_callback",
                    bypass: {"""

    if target_imp in js:
        js = js.replace(target_imp, replacement_imp)
        print("Updated IMP.certification with m_redirect_url")
    else:
        print("Target IMP.certification not found!")

    # 2. Add callback handler on DOMContentLoaded
    target_dom = """document.addEventListener('DOMContentLoaded', async () => {"""
    replacement_dom = """document.addEventListener('DOMContentLoaded', async () => {
    // --- Mobile Auth Callback Handler ---
    const urlParams = new URLSearchParams(window.location.search);
    const impUid = urlParams.get('imp_uid');
    const authStep = urlParams.get('step');
    
    if (impUid && authStep === 'auth_callback') {
        try {
            const res = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/portoneApi/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imp_uid: impUid })
            });
            const result = await res.json();
            
            if (result.success && result.data) {
                // Remove imp_uid from URL to prevent infinite reloads if refreshed
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Wait for elements to be ready
                setTimeout(async () => {
                    const nameInput = document.getElementById('auth-name');
                    const phoneInput = document.getElementById('auth-phone');
                    
                    if (nameInput) { nameInput.value = result.data.name; nameInput.readOnly = true; }
                    if (phoneInput) { phoneInput.value = result.data.phone; phoneInput.readOnly = true; }
                    
                    window.isPhoneVerified = true;

                    // --- SAVE GUEST TO USERS COLLECTION ---
                    try {
                        const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        const guestUid = 'guest_' + result.data.phone;
                        await setDoc(doc(window.db || db, "users", guestUid), {
                            email: '비회원',
                            nickname: result.data.name,
                            phone: result.data.phone,
                            provider: 'guest',
                            role: 'guest',
                            createdAt: serverTimestamp()
                        }, { merge: true });
                    } catch (e) {
                        console.error("Failed to save guest user:", e);
                    }
                    
                    // Switch views
                    const viewNonMember = document.getElementById('view-non-member');
                    const viewMember = document.getElementById('view-member');
                    if (viewNonMember) viewNonMember.style.display = 'none';
                    if (viewMember) viewMember.style.display = 'block';
                    
                    const btnAuthNonmember = document.getElementById('btn-auth-nonmember');
                    if (btnAuthNonmember) {
                        btnAuthNonmember.textContent = "비회원으로 휴대폰 본인인증하기";
                        btnAuthNonmember.disabled = false;
                    }
                    
                    alert("본인인증이 완료되었습니다.");
                    
                    // Restore quote state if exists
                    const savedQuote = sessionStorage.getItem('pendingQuote');
                    if (savedQuote) {
                        currentQuote = JSON.parse(savedQuote);
                        window.goToStep(7); // Jump to auth step
                    }
                }, 500);
            } else {
                alert("본인인증을 실패했거나 취소되었습니다.");
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (e) {
            console.error("Mobile auth verify error:", e);
        }
    }
"""

    if target_dom in js and "auth_callback" not in js:
        js = js.replace(target_dom, replacement_dom)
        print("Injected mobile auth callback handler on DOMContentLoaded")
    else:
        print("DOM content loaded target not found or already injected")

    # 3. We also need to ensure savePendingQuote() is called BEFORE IMP.certification
    target_click = """        if (btnAuthNonmember) {
            btnAuthNonmember.addEventListener('click', () => {
                if (!window.IMP) {"""
    replacement_click = """        if (btnAuthNonmember) {
            btnAuthNonmember.addEventListener('click', () => {
                savePendingQuote(); // Save state before redirecting on mobile!
                if (!window.IMP) {"""
    
    if target_click in js:
        js = js.replace(target_click, replacement_click)
        print("Added savePendingQuote() to btnAuthNonmember")

    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_mobile_auth()
