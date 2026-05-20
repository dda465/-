import re

def add_guest_save_to_script_js():
    with open('script.js', 'r', encoding='utf-8') as f:
        js = f.read()
        
    target_block = """                                window.isPhoneVerified = true;
                                
                                // Switch views"""
                                
    injection = """                                window.isPhoneVerified = true;

                                // --- SAVE GUEST TO USERS COLLECTION ---
                                try {
                                    const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                                    const guestUid = 'guest_' + result.data.phone;
                                    await setDoc(doc(window.db, "users", guestUid), {
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
                                
                                // Switch views"""
                                
    if target_block in js:
        js = js.replace(target_block, injection)
        with open('script.js', 'w', encoding='utf-8') as f:
            f.write(js)
        print("Updated script.js")
    else:
        print("Could not find target in script.js")

def add_guest_save_to_auth_js():
    with open('auth.js', 'r', encoding='utf-8') as f:
        js = f.read()
        
    target_block = """                            nameInput.value = result.data.name;
                            phoneInput.value = result.data.phone;
                            
                            verifyBtn.textContent = "본인인증 완료";"""
                            
    injection = """                            nameInput.value = result.data.name;
                            phoneInput.value = result.data.phone;
                            
                            // --- SAVE POTENTIAL MEMBER LEAD ---
                            try {
                                const guestUid = 'lead_' + result.data.phone;
                                await setDoc(doc(db, "users", guestUid), {
                                    email: '회원가입 중단',
                                    nickname: result.data.name,
                                    phone: result.data.phone,
                                    provider: 'lead',
                                    role: 'guest',
                                    createdAt: new Date()
                                }, { merge: true });
                            } catch (e) {
                                console.error("Failed to save lead user:", e);
                            }

                            verifyBtn.textContent = "본인인증 완료";"""
                            
    if target_block in js:
        js = js.replace(target_block, injection)
        with open('auth.js', 'w', encoding='utf-8') as f:
            f.write(js)
        print("Updated auth.js")
    else:
        print("Could not find target in auth.js")

add_guest_save_to_script_js()
add_guest_save_to_auth_js()
