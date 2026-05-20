import { auth } from './firebase-config.js';

import {

    signInWithEmailAndPassword,

    createUserWithEmailAndPassword,

    onAuthStateChanged,

    signOut

} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from './firebase-config.js';



console.log("Auth.js: Loaded");



document.addEventListener('DOMContentLoaded', () => {

    console.log("Auth.js: DOM Ready");



    // 1. Check Auth State Globally

    onAuthStateChanged(auth, (user) => {

        if (user && !user.isAnonymous) {

            console.log("Auth State: Signed In as", user.email);

            const path = window.location.pathname;

            if (path.endsWith('login.html') || path.endsWith('signup.html')) {

                console.log("Auth State: Redirecting to index.html");

                
                // --- NAVER 회원가입(sign_up) SCRIPT ---
                if(window.wcs){
                    window.wcs_add = window.wcs_add || {};
                    window.wcs_add['wa'] = 's_bfc3561d569';
                    var _conv = {};
                    _conv.type = 'sign_up';
                    wcs.trans(_conv);
                }

                if (sessionStorage.getItem('pendingQuote')) {
                    window.location.replace('quote.html');
                } else {
                    window.location.replace('index.html');
                }

            }

        } else {

            console.log("Auth State: Signed Out or Anonymous");

        }

    });



    // 2. Handle Login Form

    const loginForm = document.getElementById('email-login-form');

    if (loginForm) {

        console.log("Login Form: Found");



        loginForm.addEventListener('submit', async (e) => {

            e.preventDefault();

            console.log("Login Form: Submit Detected");



            const email = document.getElementById('email').value;

            const password = document.getElementById('password').value;

            const btn = loginForm.querySelector('button');



            if (!email || !password) {

                alert("이메일과 비밀번호를 입력해주세요.");

                return;

            }



            if (btn) {

                btn.textContent = '로그인 중...';

                btn.disabled = true;

            }



            try {

                console.log("Login: Attempting sign in...");

                const cred = await signInWithEmailAndPassword(auth, email, password);

                console.log("Login: Success", cred.user.email);



                // Save basic info

                localStorage.setItem('user_info', JSON.stringify({

                    email: cred.user.email,

                    nickname: cred.user.displayName || cred.user.email.split('@')[0],

                    provider: 'email'

                }));



                const ADMIN_EMAILS = [

                    "admin@rejuphone.com",

                    "admin@sharaphone.com",

                    "test@admin.com",

                    "dda465@hanmail.net",

                    "guffy321@naver.com",

                ];



                if (sessionStorage.getItem('pendingQuote')) {
                    window.location.replace('quote.html');
                } else {
                    window.location.replace('index.html');
                }

            } catch (error) {

                console.error("Login Error:", error, error.code, error.message);



                let errorMsg = "로그인 실패: ";

                if (error.code === 'auth/invalid-credential') {

                    errorMsg += "이메일이나 비밀번호가 일치하지 않습니다.";

                } else if (error.code === 'auth/user-not-found') {

                    errorMsg += "가입되지 않은 이메일입니다.";

                } else if (error.code === 'auth/wrong-password') {

                    errorMsg += "비밀번호가 틀렸습니다.";

                } else {

                    errorMsg += error.message;

                }



                alert(errorMsg);

                if (btn) {

                    btn.textContent = '이메일로 로그인';

                    btn.disabled = false;

                }

            }

        });

    }



    // 2.5 Handle PortOne Identity Verification
    const verifyBtn = document.getElementById('verify-btn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', () => {
            if (!window.IMP) {
                alert("인증 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
                return;
            }
            const IMP = window.IMP;
            IMP.init("imp25541365"); // PortOne Store ID

            IMP.certification({
                merchant_uid: "cert_" + new Date().getTime()
            }, async function (rsp) {
                if (rsp.success) {
                    verifyBtn.textContent = "인증 확인 중...";
                    verifyBtn.disabled = true;

                    try {
                        const res = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/portoneApi/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ imp_uid: rsp.imp_uid })
                        });
                        const result = await res.json();
                        
                        if (result.success && result.data) {
                            const nameInput = document.getElementById('nickname');
                            const phoneInput = document.getElementById('phone');
                            
                            nameInput.value = result.data.name;
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

                            verifyBtn.textContent = "본인인증 완료";
                            verifyBtn.style.background = "#10b981";
                            alert("본인인증이 완료되었습니다.");
                        } else {
                            throw new Error(result.error || "인증 정보 조회 실패");
                        }
                    } catch (err) {
                        console.error("Verification callback error:", err);
                        alert("본인인증 처리 중 오류가 발생했습니다: " + err.message);
                        verifyBtn.textContent = "휴대폰 본인인증하기";
                        verifyBtn.disabled = false;
                    }
                } else {
                    alert("인증에 실패하였습니다: " + rsp.error_msg);
                }
            });
        });
    }

    // 3. Handle Signup Form
    const signupForm = document.getElementById('email-signup-form');
    if (signupForm) {
        console.log("Signup Form: Found");
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Signup Form: Submit Detected");

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const passwordConfirm = document.getElementById('passwordConfirm')?.value;
            const nickname = document.getElementById('nickname').value;
            const phone = document.getElementById('phone')?.value || '';
            
            const zipcode = document.getElementById('zipcode')?.value || '';
            const address = document.getElementById('address')?.value || '';
            const detailAddress = document.getElementById('detailAddress')?.value || '';

            if (password !== passwordConfirm) {
                alert("비밀번호가 일치하지 않습니다.");
                return;
            }

            if (!phone) {
                alert("먼저 휴대폰 본인인증을 완료해주세요.");
                return;
            }

            try {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                console.log("Signup: Success", cred.user.email);

                // Save to Firestore
                try {
                    await setDoc(doc(db, "users", cred.user.uid), {
                        email: email,
                        nickname: nickname,
                        phone: phone,
                        address: {
                            zipcode: zipcode,
                            basic: address,
                            detail: detailAddress
                        },
                        createdAt: new Date(),
                        role: 'user'
                    });
                } catch (dbError) {
                    console.error("Firestore Save Error:", dbError);
                }



                localStorage.setItem('user_info', JSON.stringify({

                    email: cred.user.email,

                    nickname: nickname,

                    provider: 'email'

                }));



                const ADMIN_EMAILS = [

                    "admin@rejuphone.com",

                    "admin@sharaphone.com",

                    "test@admin.com",

                    "dda465@hanmail.net",

                    "guffy321@naver.com",

                ];

                if (ADMIN_EMAILS.includes(cred.user.email)) {

                    alert("가입 성공!");

                }



                if (sessionStorage.getItem('pendingQuote')) {
                    window.location.replace('quote.html');
                } else {
                    window.location.replace('index.html');
                }

            } catch (error) {

                console.error("Signup Error:", error);

                alert("가입 실패: " + error.message);

            }

        });

    }

    // 4. Handle Kakao Login

    const kakaoBtn = document.getElementById('kakao-login');

    if (kakaoBtn) {

        kakaoBtn.addEventListener('click', () => {

            if (!window.Kakao) {

                alert('카카오 SDK가 로드되지 않았습니다.');

                return;

            }

            if (!Kakao.isInitialized()) {

                Kakao.init('9b153d47aec7d5bcf224455284a9e715'); // USER PROVIDED KEY

            }



            Kakao.Auth.login({

                success: function (authObj) {

                    Kakao.API.request({

                        url: '/v2/user/me',

                        success: async function (res) {

                            const kakaoAccount = res.kakao_account;

                            const email = kakaoAccount?.email || `kakao_${res.id}@kakao.com`;

                            const nickname = kakaoAccount?.profile?.nickname || `카카오유저${res.id}`;



                            try {

                                // Save to Firestore

                                await setDoc(doc(db, "users", `kakao_${res.id}`), {

                                    email: email,

                                    nickname: nickname,

                                    uid: `kakao_${res.id}`,

                                    provider: 'kakao',

                                    createdAt: new Date(),

                                    role: 'user'

                                }, { merge: true }); // Use merge to update existings

                            } catch (e) {

                                console.error('Firestore save kakao user error:', e);

                            }



                            localStorage.setItem('user_info', JSON.stringify({

                                email: email,

                                nickname: nickname,

                                provider: 'kakao',

                                uid: `kakao_${res.id}`

                            }));



                            const ADMIN_EMAILS = [

                                "admin@rejuphone.com",

                                "admin@sharaphone.com",

                                "test@admin.com",

                                "dda465@hanmail.net",

                                "guffy321@naver.com",

                            ];



                            if (sessionStorage.getItem('pendingQuote')) {
                                window.location.replace('quote.html');
                            } else {
                                window.location.replace('index.html');
                            }

                        },

                        fail: function (error) {

                            console.error('카카오 사용자 정보 요청 실패:', error);

                            alert('카카오 사용자 정보를 가져오는데 실패했습니다.');

                        }

                    });

                },

                fail: function (err) {

                    console.error('카카오 로그인 실패:', err);

                    alert("카카오 로그인에 실패했습니다.");

                }

            });

        });

    }



    // 5. Handle Naver Login

    const naverBtn = document.getElementById('naver-login');

    if (naverBtn) {

        // Initialize Naver Login SDK

        try {

            const naverLogin = new naver.LoginWithNaverId({

                clientId: "2DbzH9zYF4ObguujOS0U",

                callbackUrl: window.location.origin + "/index.html", // Or a dedicated callback page

                isPopup: false, // Set to true if you want a popup

                loginButton: { color: "green", type: 1, height: 40 } // Required by SDK to build a button inside naverIdLogin

            });

            naverLogin.init();



            // When custom button is clicked, trigger the hidden SDK button

            naverBtn.addEventListener('click', (e) => {

                e.preventDefault();

                const hiddenNaverBtn = document.querySelector('#naverIdLogin a');

                if (hiddenNaverBtn) {

                    hiddenNaverBtn.click();

                } else {

                    alert("네이버 로그인을 초기화하는 중입니다. 잠시 후 다시 시도해주세요.");

                }

            });

        } catch (e) {

            console.error("Naver SDK Init Error:", e);

            naverBtn.addEventListener('click', () => {

                alert("네이버 로그인 초기화에 실패했습니다. 관리자에게 문의해주세요.");

            });

        }

    }

});



export { auth };

