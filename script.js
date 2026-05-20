import { db, auth, storage } from './firebase-config.js';



import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, serverTimestamp, where, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";



import { onAuthStateChanged, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";



import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";







const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzWCf4pn7jyNSLzBAgNnDFEilE-1nKx_lIiCr1ausGHp_lkZ5Vkh7S9uruSfatRH0aB/exec";



// Telegram tokens moved to backend (Firebase Functions)







// ──────────────────────────────────────────────────
// Admin check: Firestore 기반 (하드코딩 제거)
// admins/{email_escaped} 문서에 isAdmin:true 가 있으면 관리자
// ──────────────────────────────────────────────────
let _adminCache = null; // null = 아직 확인 안 함, true/false = 확인됨

async function checkIsAdmin(email) {
    if (!email) return false;
    if (_adminCache !== null) return _adminCache;

    try {
        const docId = email.replace(/[@.]/g, '_');
        const snap = await getDoc(doc(db, 'admins', docId));
        _adminCache = snap.exists() && snap.data().isAdmin === true;
    } catch (e) {
        console.warn('Admin check failed, defaulting to false:', e);
        _adminCache = false;
    }
    return _adminCache;
}

// 동기 캐시 조회 (이미 한 번 확인된 경우에만 사용)
function isAdminCached() {
    return _adminCache === true;
}








// --- Global State ---



let allProducts = []; // Loaded from Firestore



let currentQuote = {



    brand: null,



    series: null,



    model: null, // Model Object from DB



    storage: null, // {size, priceAdjustment}



    grade: null, // 'sealed', 's', 'a', 'b', 'c', 'd'



    defects: [] // Removed, kept for compatibility if needed but unused



};







// DEDUCTIONS removed as we use Grade Pricing directly



// SEALED_BONUS removed as Sealed price is explicit







// Utils



const formatCurrency = (amount) => {



    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);



};

window.triggerFrontendAlimtalk = async (type, phone, payload) => {
    if (!phone) return;
    
    let templateId = "";
    let variables = {};

    const cleanPhone = phone.replace(/-/g, '');

    // 1. 회원가입시
    if (type === "signup") {
        templateId = "KA01TP260514042925080Xiepwh1IH7j";
        variables = {
            "#{고객명}": payload.name,
            "#{회원가입계정플랫폼}": payload.provider === 'kakao' ? '카카오' : (payload.provider === 'naver' ? '네이버' : '본인인증'),
            "#{회원가입일시}": new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        };
    } 
    // 2. 방문택배로 신청시
    else if (type === "quote_courier") {
        templateId = "KA01TP260514062022973Of9hrrbssgr";
        variables = {
            "#{고객명}": payload.name,
            "#{방문택배수거일자}": payload.pickupDate || "미지정",
            "#{고객계정}": payload.email || "미인증/카카오연동",
            "#{고객연락처}": phone,
            "#{택배사}": "CJ대한통운", // 기본 설정
            "#{주소}": payload.address || "미입력"
        };
    } 
    // 3. 직접발송으로 신청시
    else if (type === "quote_cvs") {
        templateId = "KA01TP260514073008756NLWPQC8W4pz";
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + 3);
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const targetDateStr = `${y}년 ${m}월 ${d}일`;

        variables = {
            "#{신청일자로부터3일}": targetDateStr
        };
    }

    if (!templateId) return;

    try {
        const response = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/alimtalkApi/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phone: cleanPhone,
                templateId: templateId,
                variables: variables
            })
        });
        const result = await response.json();
        console.log("Alimtalk frontend trigger result:", result);
    } catch (e) {
        console.error("Alimtalk frontend trigger error:", e);
    }
};


// Global Auth Listener for Navigation



// Global Auth Listener removed to prevent duplicates.



// Navbar logic is handled solely within DOMContentLoaded -> updateNavbar







// ------------------------------------------------------------------



// 0. Inject Floating Widgets (Kakao + Phone)



// ------------------------------------------------------------------



function injectFloatingWidgets() {



    if (document.getElementById('floating-widgets')) return;







    const container = document.createElement('div');



    container.id = 'floating-widgets';



    container.className = 'floating-buttons'; // Uses flex-column-reverse from CSS to stack







    // 2. Kakao Button

    const kakaoBtn = document.createElement('a');

    kakaoBtn.href = 'http://pf.kakao.com/_TEvMK/chat';

    kakaoBtn.target = '_blank';

    kakaoBtn.className = 'kakao-chat-btn pc-only';

    kakaoBtn.innerHTML = `

    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">

        <path d="M12 3C5.9 3 1 6.9 1 11.8c0 3.2 2.1 6 5.3 7.6-.2.8-.8 2.8-.9 3.2 0 0-.1.2.1.2.2 0 2.6-1.7 3.6-2.4 1 .1 1.9.2 2.9.2 6.1 0 11-3.9 11-8.8S18.1 3 12 3z" />

        </svg>

    <span class="btn-label">카톡 문의</span>

`;

    // 3. Naver TalkTalk Button
    const naverBtn = document.createElement('a');
    naverBtn.href = 'http://talk.naver.com/W53PQQM';
    naverBtn.target = '_blank';
    naverBtn.className = 'naver-chat-btn pc-only';
    naverBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/></svg>
    <span class="btn-label">네이버 톡톡</span>
`;

    // Container appended to body
    container.appendChild(naverBtn);
    container.appendChild(kakaoBtn);
    document.body.appendChild(container);

}







// Start logic based on page




// --- Traffic Source Tracking ---
(function initTrafficSource() {
    if (sessionStorage.getItem('traffic_source')) return;

    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = (urlParams.get('utm_source') || '').toLowerCase();
    const referrer = (document.referrer || '').toLowerCase();
    const ua = (navigator.userAgent || '').toLowerCase();

    let source = 'direct';

    if (utmSource.includes('naver') || referrer.includes('naver.com') || ua.includes('naver')) {
        source = 'naver';
    } else if (utmSource.includes('daangn') || utmSource.includes('karrot') || referrer.includes('daangn.com') || referrer.includes('karrotmarket') || ua.includes('daangn') || ua.includes('karrot')) {
        source = 'daangn';
    } else if (utmSource.includes('google') || referrer.includes('google.com')) {
        source = 'google';
    }

    sessionStorage.setItem('traffic_source', source);
    console.log('Traffic source initialized:', source);
})();

// --- Funnel Analytics ---
window.trackFunnel = async (stepName) => {
    try {
        // --- Admin Ignore Logic ---
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin_ignore') === 'true') {
            localStorage.setItem('admin_ignore', 'true');
            alert('관리자 추적 방지 모드가 활성화되었습니다. 앞으로 이 브라우저에서의 접속은 통계에 잡히지 않습니다.');
        }
        if (localStorage.getItem('admin_ignore') === 'true') {
            console.log('Admin tracking ignored.');
            return;
        }
        const nowMs = Date.now();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(nowMs + kstOffset);
        const dateString = kstDate.toISOString().split('T')[0]; // YYYY-MM-DD KST
        
        const docRefTotal = doc(db, 'analytics', 'funnel');
        const docRefDaily = doc(db, 'analytics', 'funnel_' + dateString);
        
        const source = sessionStorage.getItem('traffic_source') || 'direct';
        const sourceStepName = `${stepName}_${source}`;

        await setDoc(docRefTotal, { 
            [stepName]: increment(1),
            [sourceStepName]: increment(1)
        }, { merge: true });
        
        await setDoc(docRefDaily, { 
            [stepName]: increment(1),
            [sourceStepName]: increment(1)
        }, { merge: true });
        
        console.log('Funnel tracked:', stepName, 'Source:', source, 'for', dateString);
    } catch (e) {
        console.error('Funnel error:', e);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
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









    // Inject Floating Widgets



    injectFloatingWidgets();

    const curPath = window.location.pathname;
    if (curPath.endsWith('index.html') || curPath === '/' || curPath.endsWith('/')) {
        window.trackFunnel('home_main');
    } else if (curPath.includes('quote.html')) {
        window.trackFunnel('quote_start');
    } else if (curPath.includes('price-list.html')) {
        window.trackFunnel('price_list');
    } else if (curPath.includes('reviews.html')) {
        window.trackFunnel('reviews');
    }








    // Init homepage specifically



    if (document.getElementById('homepage-recent-reviews')) {



        loadRecentReviewsForHomepage();
        // 홈페이지 인기기종 + 오늘의시세 가격을 Firestore에서 동적 로드
        loadHomepageDynamicPrices();



    }



    // 1. Landing Page Logic (Recent Trades)



    const recentTradesContainer = document.querySelector('.live-prices-list');



    if (recentTradesContainer) {



        initLandingPage(recentTradesContainer);



    }







    // 1.5 Latest Models Logic



    const latestContainer = document.querySelector('.latest-prices-list');



    if (latestContainer) {



        initLatestModels(latestContainer);



    }







    // 2. Quote Wizard Logic (Deep Wizard)



    if (document.getElementById('wizard-step-1')) {



        
        initDeepWizard();




    }







    // 3. Price List Logic



    if (document.getElementById('price-table-body')) {



        initPriceList();



    }







    // 3.5 Reviews Logic



    if (document.getElementById('reviews-list')) {



        initReviews();



    }







    // 4. Navbar Auth State



    const navLoginLink = document.getElementById('nav-login-link');



    if (navLoginLink) {



        const updateNavbar = async (userData) => {



            const navLinksContainer = document.querySelector('.nav-links');







            // 1. Reset: Remove dynamic links (Logout, Admin)

            document.querySelectorAll('#nav-logout-link').forEach(el => el.remove());
            document.querySelectorAll('#admin-btn-nav').forEach(el => el.remove());
            document.querySelectorAll('#nav-welcome-text').forEach(el => el.remove());







            if (userData) {



                console.log("Navbar: User detected", userData.nickname);







                // 2. Update Login Link -> My Page



                navLoginLink.textContent = '마이페이지';
                navLoginLink.href = 'mypage.html';
                navLoginLink.onclick = null; // Remove any previous handlers

                const mobAuth = document.getElementById('mobile-auth-link');
                if (mobAuth) {
                    mobAuth.href = '#';
                    mobAuth.textContent = '로그아웃';
                    mobAuth.style.color = '#e11d48';
                    mobAuth.style.borderColor = '#e11d48';
                    mobAuth.onclick = async (e) => {
                        e.preventDefault();
                        if (confirm('로그아웃 하시겠습니까?')) {
                            try {
                                const localUser = localStorage.getItem('user_info');
                                if (localUser && localUser.includes('kakao')) {
                                    if (window.Kakao && Kakao.Auth && Kakao.Auth.getAccessToken()) {
                                        Kakao.Auth.logout(() => { console.log('Kakao logged out'); });
                                    }
                                }
                            } catch (err) {
                                console.error('Kakao logout error', err);
                            }
                            localStorage.removeItem('user_info');
                            try {
                                await signOut(auth);
                            } catch (err) {
                                console.error("Firebase Logout Error:", err);
                            }
                            window.location.replace('index.html');
                        }
                    };
                }







                // 3. Add Logout Link



                const logoutLink = document.createElement('a');



                logoutLink.id = 'nav-logout-link';



                logoutLink.href = '#';



                logoutLink.textContent = '로그아웃';



                logoutLink.addEventListener('click', async (e) => {



                    e.preventDefault();



                    if (confirm('로그아웃 하시겠습니까?')) {



                        try {



                            const localUser = localStorage.getItem('user_info');



                            if (localUser && localUser.includes('kakao')) {



                                if (window.Kakao && Kakao.Auth && Kakao.Auth.getAccessToken()) {



                                    Kakao.Auth.logout(() => {



                                        console.log('Kakao logged out');



                                    });



                                }



                            }



                        } catch (e) {



                            console.error('Kakao logout error', e);



                        }







                        localStorage.removeItem('user_info');







                        try {



                            await signOut(auth);



                        } catch (err) {



                            console.error("Firebase Logout Error:", err);



                        }







                        // Force redirect to login page instead of reload, to clear state completely



                        window.location.replace('index.html');



                    }



                });



                // Insert after My Page



                if (navLoginLink.nextSibling) {
                    navLinksContainer.insertBefore(logoutLink, navLoginLink.nextSibling);
                } else {
                    navLinksContainer.appendChild(logoutLink);
                }

                // Add welcome text before "My Page" link
                const welcomeText = document.createElement('span');
                welcomeText.id = 'nav-welcome-text';
                welcomeText.className = 'pc-only';
                welcomeText.style.fontWeight = '700';
                welcomeText.style.color = '#333';
                welcomeText.style.marginRight = '15px';
                welcomeText.textContent = `${userData.nickname}님 환영합니다`;
                navLinksContainer.insertBefore(welcomeText, navLoginLink);







                // 4. Admin Check & Button



                if (await checkIsAdmin(userData.email)) {



                    let adminBtn = document.getElementById('admin-btn-nav');
                    if (!adminBtn) {
                        adminBtn = document.createElement('a');
                        adminBtn.id = 'admin-btn-nav';
                        adminBtn.href = 'admin.html';
                        adminBtn.className = 'btn btn-sm btn-primary';
                        adminBtn.textContent = '관리자';
                        adminBtn.style.marginLeft = '10px';
                        navLinksContainer.appendChild(adminBtn);
                    }

                    const mAdmin = document.getElementById('mobile-admin-btn');
                    if (mAdmin) {
                        mAdmin.style.display = 'flex';
                    }

                    // Review Write Button (Review Page)
                    const reviewBtn = document.getElementById('btn-show-form');
                    if (reviewBtn) reviewBtn.style.display = 'inline-block';



                }







            } else {



                console.log("Navbar: No user detected");



                // Reset to Login



                navLoginLink.textContent = '로그인';
                navLoginLink.href = 'login.html';
                navLoginLink.onclick = null;

                const mobAuth = document.getElementById('mobile-auth-link');
                if (mobAuth) {
                    mobAuth.href = 'login.html';
                    mobAuth.textContent = '로그인';
                    mobAuth.style.color = '#1e293b';
                    mobAuth.style.borderColor = '#e2e8f0';
                    mobAuth.onclick = null;
                }
                const mAdmin = document.getElementById('mobile-admin-btn');
                if (mAdmin) {
                    mAdmin.style.display = 'none';
                }



            }



        };







        // --- Hero Slider Logic ---



        const initHeroSlider = () => {



            const slider = document.getElementById('hero-slider');



            const slides = document.querySelectorAll('.hero-slide');



            const prevBtn = document.getElementById('slider-prev');



            const nextBtn = document.getElementById('slider-next');



            const currentIndicator = document.getElementById('slider-current');







            if (!slider || slides.length === 0) return;







            let currentIndex = 0;



            const totalSlides = slides.length;



            let slideInterval;







            const updateSlider = () => {

                // Move the slider container
                slider.style.transform = `translateX(-${currentIndex * 50}%)`;

                // Update text indicator (hidden, kept for compat)
                if (currentIndicator) {
                    currentIndicator.textContent = currentIndex + 1;
                }

                // Update dot indicators
                document.querySelectorAll('.slider-dot').forEach((dot, i) => {
                    dot.classList.toggle('active', i === currentIndex);
                });

                // Reset interval when manually changed
                resetInterval();


            };







            const nextSlide = () => {



                currentIndex = (currentIndex + 1) % totalSlides;



                updateSlider();



            };







            const prevSlide = () => {



                currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;



                updateSlider();



            };







            const resetInterval = () => {



                clearInterval(slideInterval);



                slideInterval = setInterval(nextSlide, 5000); // 5 seconds



            };







            // Event Listeners
            if (nextBtn) nextBtn.addEventListener('click', nextSlide);
            if (prevBtn) prevBtn.addEventListener('click', prevSlide);

            // Dot click handlers
            document.querySelectorAll('.slider-dot').forEach((dot) => {
                dot.addEventListener('click', () => {
                    currentIndex = parseInt(dot.dataset.index);
                    updateSlider();
                });
            });

            // Touch Swipe support
            let touchStartX = 0;
            let touchEndX = 0;
            const threshold = 50;

            slider.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, {passive: true});

            slider.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }, {passive: true});

            const handleSwipe = () => {
                if (touchEndX < touchStartX - threshold) {
                    nextSlide(); // Swipe left
                }
                if (touchEndX > touchStartX + threshold) {
                    prevSlide(); // Swipe right
                }
            };

            // Start auto slide
            resetInterval();



        };







        // Initialize slider on load



        if (document.readyState === 'loading') {



            document.addEventListener('DOMContentLoaded', initHeroSlider);



        } else {



            initHeroSlider();



        }







        // ... existing local storage check ...



        const localUser = localStorage.getItem('user_info');



        if (localUser) {



            try {



                const parsed = JSON.parse(localUser);



                updateNavbar(parsed);



            } catch (e) { console.error(e); }



        }







        // --- Naver Login Callback Handling ---



        if (window.naver && window.naver.LoginWithNaverId) {



            window.naverLoginInst = new naver.LoginWithNaverId({
                clientId: "2DbzH9zYF4ObguujOS0U",
                callbackUrl: window.location.origin + window.location.pathname,
                isPopup: false,
                loginButton: { color: "green", type: 3, height: 40 },
                callbackHandle: true
            });
            window.naverLoginInst.init();







            // Run immediately since script.js is a module and executes after HTML parse
            if (window.location.hash.includes('access_token')) {
                    window.naverLoginInst.getLoginStatus(async function (status) {
                        if (status) {
                            // Some Naver accounts might not provide an email, use an empty string instead of undefined to prevent Firebase crashes.
                            const email = window.naverLoginInst.user.getEmail() || "";
                            const nickname = window.naverLoginInst.user.getNickName() || window.naverLoginInst.user.getName() || `naveryuser${window.naverLoginInst.user.getId()}`;
                            const uid = `naver_${window.naverLoginInst.user.getId()}`;







                            // Check if already logged in locally to avoid infinite loops and re-saving



                            const currentLocalUser = localStorage.getItem('user_info');



                            let needsUpdate = true;



                            if (currentLocalUser) {



                                try {



                                    const parsed = JSON.parse(currentLocalUser);



                                    if (parsed.uid === uid) needsUpdate = false;



                                } catch (e) { }



                            }







                            if (needsUpdate) {
                                try {
                                    const { doc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                                    const docRef = doc(db, "users", uid);
                                    const docSnap = await getDoc(docRef);
                                    const isNewUser = !docSnap.exists();

                                    await setDoc(docRef, {
                                        email: email,
                                        nickname: nickname,
                                        uid: uid,
                                        provider: 'naver',
                                        createdAt: new Date(),
                                        role: 'user'
                                    }, { merge: true });

                                    // 알림톡 발송 (네이버 연락처 제공 동의 시)
                                    if (isNewUser && window.naverLoginInst.user.getMobile && window.naverLoginInst.user.getMobile() && window.triggerFrontendAlimtalk) {
                                        let phoneRaw = window.naverLoginInst.user.getMobile();
                                        if (phoneRaw.startsWith('+82 ')) phoneRaw = '0' + phoneRaw.substring(4);
                                        window.triggerFrontendAlimtalk("signup", phoneRaw, {
                                            name: nickname,
                                            provider: 'naver'
                                        });
                                    }
                                } catch (e) {
                                    console.error('Firestore save naver user error:', e);
                                }

                                const userInfo = { email, nickname, provider: 'naver', uid };
                                localStorage.setItem('user_info', JSON.stringify(userInfo));
                                updateNavbar(userInfo);
                            }

                            // Always clean up hash and redirect, whether needsUpdate was true or false
                            window.history.replaceState(null, null, window.location.pathname + window.location.search);
                            
                            if (sessionStorage.getItem('pendingQuote')) {
                                window.location.hash = '#step-auth';
                                window.location.reload();
                            }
                        }
                    });
                }
            }




        // -------------------------------------







        onAuthStateChanged(auth, (user) => {



            if (user && !user.isAnonymous) {



                const latestLocal = localStorage.getItem('user_info');



                const localData = latestLocal ? JSON.parse(latestLocal) : null;







                updateNavbar({



                    provider: localData?.provider || 'email',



                    nickname: localData?.nickname || user.displayName || (user.email ? user.email.split('@')[0] : '사용자'),



                    email: user.email



                });



            } else {



                const latestLocal = localStorage.getItem('user_info');



                if (latestLocal) {



                    try {



                        const localData = JSON.parse(latestLocal);



                        if (localData.provider) {



                            // Valid social login session exists in localStorage



                            updateNavbar(localData);



                            return;



                        }



                    } catch (e) { }



                }



                updateNavbar(null);



            }



        });



    }



});




// ──────────────────────────────────────────────────
// 홈페이지 인기기종 + 오늘의시세 가격을 Firestore에서 동적 로드
// 실패 시 기존 하드코딩 가격이 유지되므로 안전
// ──────────────────────────────────────────────────
async function loadHomepageDynamicPrices() {
    try {
        // 가격을 업데이트할 대상 목록
        // elId: 인기기종 카드 id, tpsId: 오늘의시세 카드 id
        // keywords: Firestore products.model 필드와 매칭할 키워드 (부분 일치)
        const targets = [
            { elId: 'pop-price-ip15p', tpsId: 'tps-price-ip15p', keywords: ['아이폰 15 Pro', 'iPhone 15 Pro'], format: '최고 {price}원', tpsFormat: '최고 {priceMan}만원' },
            { elId: 'pop-price-s24u', tpsId: null, keywords: ['갤럭시 S24 Ultra', 'Galaxy S24 Ultra', 'S24 Ultra'], format: '최고 {price}원', tpsFormat: null },
            { elId: 'pop-price-zf5', tpsId: null, keywords: ['Z 플립 5', 'Z Flip5', 'Z Flip 5', 'Z플립5'], format: '최고 {price}원', tpsFormat: null },
            { elId: null, tpsId: 'tps-price-ip16p', keywords: ['아이폰 16 Pro', 'iPhone 16 Pro'], format: null, tpsFormat: '최고 {priceMan}만원' },
            { elId: null, tpsId: 'tps-price-s25u', keywords: ['갤럭시 S25 Ultra', 'Galaxy S25 Ultra', 'S25 Ultra'], format: null, tpsFormat: '최고 {priceMan}만원' },
            { elId: null, tpsId: 'tps-price-s25', keywords: ['갤럭시 S25', 'Galaxy S25'], format: null, tpsFormat: '최고 {priceMan}만원' },
            { elId: null, tpsId: 'tps-price-ip14', keywords: ['아이폰 14', 'iPhone 14'], format: null, tpsFormat: '최고 {priceMan}만원' },
            { elId: null, tpsId: 'tps-price-zf6', keywords: ['Z 플립 6', 'Z Flip6', 'Z Flip 6', 'Z플립6'], format: null, tpsFormat: '최고 {priceMan}만원' },
        ];

        // products 컬렉션에서 basePrice가 높은 순으로 충분히 가져오기 (전체 기종을 위해 500개로 확대)
        const q = query(collection(db, "products"), orderBy("basePrice", "desc"), limit(500));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('loadHomepageDynamicPrices: No products found, keeping fallback prices');
            return;
        }

        const products = [];
        snapshot.forEach(d => { products.push(d.data()); });

        // Today's Seed
        const d = new Date();
        const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        function seededRandom(s) {
            var x = Math.sin(s) * 10000;
            return x - Math.floor(x);
        }

        const appleKws = ['아이폰 14', '아이폰 15', '아이폰 16', '아이폰14', '아이폰15', '아이폰16'];
        const sKws = ['s23', 's24', 's25'];
        const zKws = ['플립 5', '폴드 5', '플립 6', '폴드 6', '플립 7', '폴드 7', '플립5', '폴드5', '플립6', '폴드6', '플립7', '폴드7'];

        const appleCandidates = [];
        const sCandidates = [];
        const zCandidates = [];

        products.forEach(p => {
            if (!p.model || !p.basePrice) return;
            const m = p.model.toLowerCase();
            if (appleKws.some(k => m.includes(k))) appleCandidates.push(p);
            else if (sKws.some(k => m.includes(k))) sCandidates.push(p);
            else if (zKws.some(k => m.includes(k))) zCandidates.push(p);
        });

        // Deduplicate by model name
        const uniqueApples = Array.from(new Map(appleCandidates.map(p => [p.model, p])).values());
        const uniqueSs = Array.from(new Map(sCandidates.map(p => [p.model, p])).values());
        const uniqueZs = Array.from(new Map(zCandidates.map(p => [p.model, p])).values());

        const picked = [];
        let currentSeed = seed;

        if (uniqueApples.length > 0) picked.push(uniqueApples[Math.floor(seededRandom(currentSeed++) * uniqueApples.length)]);
        if (uniqueSs.length > 0) picked.push(uniqueSs[Math.floor(seededRandom(currentSeed++) * uniqueSs.length)]);
        if (uniqueZs.length > 0) picked.push(uniqueZs[Math.floor(seededRandom(currentSeed++) * uniqueZs.length)]);

        // Fallback: Ensure we always show 3 items if possible
        if (picked.length < 3 && products.length > 0) {
            const allUnique = Array.from(new Map(products.map(p => [p.model, p])).values());
            const remaining = allUnique.filter(p => !picked.find(pickedItem => pickedItem.model === p.model));
            remaining.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0)); // Sort by price desc to get top phones
            
            while (picked.length < 3 && remaining.length > 0) {
                picked.push(remaining.shift());
            }
        }

        const chipsContainer = document.querySelector('.usc-chips');
        if (chipsContainer && picked.length > 0) {
            chipsContainer.innerHTML = ''; // Clear hardcoded
            picked.forEach(p => {
                let iconSrc = 'assets/series/samsung/s시리즈.png';
                if (p.brand === 'apple') iconSrc = 'assets/series/apple/아이폰15.png';
                if (p.model.includes('플립') || p.model.toLowerCase().includes('flip')) iconSrc = 'assets/series/samsung/플립 시리즈.png';
                if (p.model.includes('폴드') || p.model.toLowerCase().includes('fold')) iconSrc = 'assets/series/samsung/폴드 시리즈.png';

                const priceStr = '최고 ' + new Intl.NumberFormat('ko-KR').format(p.basePrice) + '원';
                const searchParam = encodeURIComponent(p.model);

                const chipHTML = `
                    <div class="usc-chip" onclick="location.href='quote.html?search=${searchParam}'">
                        <div class="chip-icon"><img src="${iconSrc}" alt="${p.model}" style="max-width: 60px; max-height: 60px; object-fit: contain;"></div>
                        <div class="chip-info">
                            <div class="chip-name">${p.model}</div>
                            <div class="chip-price">${priceStr}</div>
                            <div class="chip-tag">기본 용량 A급 기준</div>
                        </div>
                    </div>
                `;
                chipsContainer.insertAdjacentHTML('beforeend', chipHTML);
            });
        }

        console.log('loadHomepageDynamicPrices: Prices updated from Firestore');
    } catch (e) {
        // 실패 시 기존 하드코딩 가격 유지 — 사용자에게 영향 없음
        console.warn('loadHomepageDynamicPrices failed, keeping fallback prices:', e);
    }
}


async function initLandingPage() {



    console.log("initLandingPage");







    // 1. Live Prices (Recent Quotes)



    // We already have logic for 'live-prices-list' in existing initLandingPage? 



    // Wait, the previous code had 'initLandingPage' doing 'quotes' fetch.



    // Let's refine it to be robust.







    const liveContainer = document.querySelector('.live-prices-list');



    if (liveContainer) {



        try {



            const q = query(collection(db, "quotes"), orderBy("firebaseTimestamp", "desc"), limit(6));



            const snapshot = await getDocs(q);







            let trades = [];



            snapshot.forEach(doc => {



                const data = doc.data();



                // Calc Time



                let timeStr = "방금 전";



                if (data.firebaseTimestamp) {



                    const now = new Date();



                    const past = data.firebaseTimestamp.toDate();



                    const diffMins = Math.floor((now - past) / 60000);







                    if (diffMins < 1) timeStr = "방금 전";



                    else if (diffMins < 60) timeStr = `${diffMins}분 전`;



                    else if (diffMins < 1440) timeStr = `${Math.floor(diffMins / 60)}시간 전`;



                    else timeStr = `${Math.floor(diffMins / 1440)}일 전`;



                }







                // Grade Map



                const gradeMap = {



                    'sealed': '미개봉',



                    's': 'S급',



                    'a': 'A급',



                    'b': 'B급',



                    'c': 'C급',



                    'd': 'D급',



                    'used': '하자',



                    'scratched': '하자'



                };







                const conditionVal = data.grade || data.condition || data.conditionType || '확인중';



                const gradeText = gradeMap[conditionVal] || conditionVal;







                trades.push({



                    model: `${data.model} (${data.storage}/${gradeText})`,



                    price: data.price,



                    time: timeStr



                });



            });







            if (trades.length > 0) {



                let html = '';



                trades.forEach(t => {



                    html += `



                    <div class="price-card">



                        <div class="phone-info">



                            <h4>${t.model}</h4>



                            <p>${t.time}</p>



                        </div>



                        <div class="price-tag">${formatCurrency(t.price)}</div>



                    </div>`;



                });



                liveContainer.innerHTML = html;



            } else {



                liveContainer.innerHTML = '<div class="text-center" style="width:100%; padding:20px; color:#888;">최근 거래 내역이 없습니다.</div>';



            }







        } catch (e) {



            console.error("Live Prices Error:", e);



            // Keep default loading or show error?



            // Fallback to static if error



            const fallbackTrades = [



                { model: '아이폰 15 프로 (256GB/S급)', price: 1150000, time: '방금 전' },



                { model: '갤럭시 S24 울트라 (512GB/미개봉)', price: 1350000, time: '10분 전' },



                { model: '아이폰 14 프로 (128GB/A급)', price: 850000, time: '1시간 전' }



            ];



            let html = '';



            fallbackTrades.forEach(t => {



                html += `



                    <div class="price-card">



                    <div class="phone-info">



                        <h4>${t.model}</h4>



                        <p>${t.time}</p>



                    </div>



                    <div class="price-tag">${formatCurrency(t.price)}</div>



                </div>`;



            });



            liveContainer.innerHTML = html;



        }



    }







    // 2. Latest Models (Top Price Products)



    initLatestModels(document.querySelector('.latest-prices-list'));



}







async function initLatestModels(container) {



    if (!container) return;







    // Fetch expensive products from 'products' collection



    // Heuristic: Order by basePrice desc, limit 6



    try {



        const q = query(collection(db, "products"), orderBy("basePrice", "desc"), limit(6));



        const snapshot = await getDocs(q);







        let products = [];



        snapshot.forEach(doc => {



            products.push(doc.data());



        });







        if (products.length > 0) {



            let html = '';



            products.forEach(p => {



                // Determine Tag



                let tag = 'HOT';



                const name = p.model || "";



                if (name.includes('15') || name.includes('16') || name.includes('24') || name.includes('25') || name.includes('Flip5') || name.includes('Fold5')) {



                    tag = 'NEW';



                }







                html += `



                    <div class="price-card highlight-card" onclick="location.href='quote.html'">



                    <div class="phone-info">



                        <h4>${p.model} <span class="badge ${tag === 'NEW' ? 'badge-new' : 'badge-hot'}">${tag}</span></h4>



                        <p>최고가 매입중</p>



                    </div>



                    <div class="price-tag">${formatCurrency(p.basePrice)}</div>



                </div>



    `;



            });



            container.innerHTML = html;



        } else {



            container.innerHTML = '<div class="text-center" style="width:100%; padding:20px;">등록된 모델이 없습니다.</div>';



        }







    } catch (e) {



        console.error("Latest Models Error:", e);



        // Fallback



        const latest = [



            { model: '아이폰 15 프로 맥스', price: 1750000, tag: 'NEW' },



            { model: '갤럭시 S24 울트라', price: 1450000, tag: 'HOT' }



        ];



        let html = '';



        latest.forEach(item => {



            html += `



                    <div class="price-card highlight-card">



                <div class="phone-info">



                    <h4>${item.model} <span class="badge ${item.tag === 'NEW' ? 'badge-new' : 'badge-hot'}">${item.tag}</span></h4>



                    <p>최고가 매입중</p>



                </div>



                <div class="price-tag">${formatCurrency(item.price)}</div>



            </div>



    `;



        });



        container.innerHTML = html;



    }



}







// --- Price List Functionality (Uses Firestore) ---



async function initPriceList() {



    console.log("Initializing Price List...");



    const tableBody = document.getElementById('price-table-body');



    const tabs = document.querySelectorAll('.filter-btn');



    const searchInput = document.getElementById('model-search');







    let currentBrand = 'all'; // Default to 'all'







    // 1. Fetch Data (if not already loaded)



    if (allProducts.length === 0) {



        try {



            const q = query(collection(db, "products"));



            const snapshot = await getDocs(q);



            snapshot.forEach(doc => {



                allProducts.push({ id: doc.id, ...doc.data() });



            });



            console.log(`PriceList: Loaded ${allProducts.length} products`);



        } catch (e) {



            console.error("PriceList Fetch Error:", e);



            tableBody.innerHTML = `< tr > <td colspan="4" class="text-center text-danger">시세 데이터를 불러오는데 실패했습니다.<br>${e.message}</td></tr > `;



            return;



        }



    }







    // 2. Render Function



    const renderTable = () => {



        tableBody.innerHTML = '';



        const filterText = searchInput ? searchInput.value.toLowerCase().trim() : '';







        // Filter: Brand + Search



        let filtered = allProducts.filter(p => {



            // Brand Mapping



            let pBrand = p.brand.toLowerCase();



            if (pBrand === '애플') pBrand = 'apple';



            if (pBrand === '삼성') pBrand = 'samsung';







            const brandMatch = (currentBrand === 'all' || pBrand === currentBrand);



            const cleanFilterText = filterText.replace(/\s/g, '');
            const searchMatch = p.model.toLowerCase().replace(/\s/g, '').includes(cleanFilterText) || (p.series && p.series.toLowerCase().replace(/\s/g, '').includes(cleanFilterText));



            return brandMatch && searchMatch;



        });







        // Sort: Series -> Model (Reverse Series to put new ones on top?)



        // Let's sort simply by Series (desc) then Model



        filtered.sort((a, b) => {



            // Helper to extract number from series for valid sorting? 



            // String compare is usually fine for "Galaxy S24" vs "Galaxy S23"



            if (a.series && b.series && a.series !== b.series) {



                return b.series.localeCompare(a.series); // Descending Series



            }



            return a.model.localeCompare(b.model);



        });







        if (filtered.length === 0) {



            tableBody.innerHTML = `< tr > <td colspan="4" class="text-center" style="padding: 30px;">검색 결과가 없습니다.</td></tr > `;



            return;



        }







        // Deduplicate and calculate average
        const modelMap = {};
        filtered.forEach(p => {
            if (!modelMap[p.model]) {
                modelMap[p.model] = {
                    ...p,
                    allPrices: []
                };
            }
            // Collect all valid prices for this model across all duplicated docs
            const prices = p.prices || {};
            const priceS = prices.s || p.basePrice || 0;
            const priceA = prices.a || 0;
            const priceB = prices.b || 0;
            const priceC = prices.c || prices.d || 0;
            
            [priceS, priceA, priceB, priceC].forEach(v => {
                if (v > 0) modelMap[p.model].allPrices.push(v);
            });
        });

        const uniqueModels = Object.values(modelMap);

        uniqueModels.forEach(p => {
            const sum = p.allPrices.reduce((a, b) => a + b, 0);
            const avg = p.allPrices.length > 0 ? Math.floor(sum / p.allPrices.length / 1000) * 1000 : 0;
            
            let priceText = '-';
            if (avg > 0) {
                priceText = `${avg.toLocaleString()}원`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: left;">
                    <div style="font-weight: 700; font-size: 0.95rem; color: #1e293b; margin-bottom: 4px; word-break: keep-all;">${p.model}</div>
                    <span style="font-size:0.75rem; color:#64748b; background: #f8fafc; padding: 2px 6px; border-radius: 4px; word-break: keep-all;">${p.series}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: middle;">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; flex-wrap: nowrap;">
                        <span style="font-weight: 700; color: #3b82f6; font-size: 0.95rem; white-space: nowrap; word-break: keep-all;">
                            ${priceText}
                        </span>
                        <a href="quote.html?model=${encodeURIComponent(p.model)}" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.75rem; font-weight: 600; padding: 5px 8px; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; flex-shrink: 0; transition: background 0.2s, transform 0.2s;" onmouseover="this.style.background='#dbeafe'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='#eff6ff'; this.style.transform='translateY(0)'">
                            간편견적 <i class="ri-arrow-right-s-line"></i>
                        </a>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });



    };







    // 3. Event Listeners



    window.filterModels = (brand) => {



        // Update active class on buttons



        document.querySelectorAll('.filter-btn').forEach(btn => {



            btn.classList.remove('active');



        });







        // Find the matching button based on onClick param rather than data-tab since it's inline



        const clickedBtn = Array.from(document.querySelectorAll('.filter-btn')).find(b => b.getAttribute('onclick')?.includes(brand) || b.dataset.brand === brand);



        if (clickedBtn) clickedBtn.classList.add('active');







        currentBrand = brand;



        renderTable();



    };







    if (searchInput) {



        searchInput.addEventListener('input', () => {



            renderTable();



        });



    }







    // Initial Render



    renderTable();



}











// --- New Wizard Logic (Deep Wizard) ---



async function initDeepWizard() {



    const loadingOverlay = document.getElementById('wizard-loading');

    // Restore pending quote after login (skip if Naver callback is processing)
    const pendingQuoteStr = sessionStorage.getItem('pendingQuote');
    if (pendingQuoteStr && !window.location.hash.includes('access_token')) {
        try {
            currentQuote = JSON.parse(pendingQuoteStr);
            sessionStorage.removeItem('pendingQuote');
            // Slight delay to ensure auth state and DOM are ready before navigating
            setTimeout(() => {
                goToStep('auth');
            }, 500);
        } catch(e) {
            console.error("Error restoring pending quote", e);
        }
    }    // Global Navigation



    // Initialize history state on first load if not set
    if (!history.state || !history.state.step) {
        window.initialAdsHash = window.location.hash; // Preserve hash for Google Ads processing
        const h = window.initialAdsHash;
        if (h === '#apple' || h === '#samsung' || h === '#iphone' || h === '#galaxy' || h === '#step-1-apple' || h === '#step-1-samsung') {
            history.replaceState({ step: 1 }, '', h);
        } else {
            history.replaceState({ step: 1 }, '', '#step-1');
        }
    }

    // Handle browser Back/Forward buttons
    if (!window._wizardPopStateAttached) {
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.step) {
                // Prevent going to a step if no brand is selected, except step 1
                if (e.state.step !== 1 && (!currentQuote || !currentQuote.brand)) {
                    goToStep(1, true);
                } else {
                    goToStep(e.state.step, true);
                }
            } else {
                goToStep(1, true);
            }
        });
        window._wizardPopStateAttached = true;
    }

    window.goToStep = (step, isHistoryNav = false) => {
        console.log("Navigating to step:", step);

        // Update URL hash unless this was triggered by a back/forward button (popstate)
        if (!isHistoryNav) {
            const currentUrl = new URL(window.location.href);
            if (currentQuote && currentQuote.brand) {
                currentUrl.searchParams.set('brand', currentQuote.brand);
            }
            currentUrl.hash = 'step-' + step;
            history.pushState({ step: step }, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
        }

        document.querySelectorAll('.wizard-step').forEach(s => {
            s.classList.remove('active');
            s.style.display = 'none';
        });

        // Scroll to top of the page when navigating between steps to prevent being stuck at the bottom
        window.scrollTo({ top: 0, behavior: 'smooth' });







        // Handle named steps



        let targetId = `wizard-step-${step}`;



        if (step === 'method') targetId = 'wizard-step-method';



        if (step === 'defects') targetId = 'wizard-step-defects';







        const target = document.getElementById(targetId);



        if (target) {
            target.style.display = 'block';
            setTimeout(() => target.classList.add('active'), 10);
            
            if (step === 'auth') {
                const localUserStr = localStorage.getItem('user_info');
                let isMember = false;
                let memberName = '';
                let memberPhone = '';

                if (localUserStr) {
                    try {
                        const localUser = JSON.parse(localUserStr);
                        if (localUser.nickname) memberName = localUser.nickname;
                        if (localUser.phone || localUser.phoneNumber) memberPhone = localUser.phone || localUser.phoneNumber;
                        isMember = true;
                    } catch(e) {}
                }
                if (typeof auth !== 'undefined' && auth.currentUser && !auth.currentUser.isAnonymous) {
                    isMember = true;
                }

                const viewNonMember = document.getElementById('view-non-member');
                const viewMember = document.getElementById('view-member');
                const nameInput = document.getElementById('auth-name');
                const phoneInput = document.getElementById('auth-phone');

                if (window.isPhoneVerified) {
                    if (viewNonMember) viewNonMember.style.display = 'none';
                    if (viewMember) viewMember.style.display = 'block';
                } else if (isMember) {
                    if (viewNonMember) viewNonMember.style.display = 'none';
                    if (viewMember) viewMember.style.display = 'block';

                    if (nameInput) { 
                        nameInput.value = memberName; 
                        nameInput.readOnly = false; 
                    }
                    if (phoneInput) { 
                        phoneInput.value = memberPhone; 
                        phoneInput.readOnly = false; 
                    }
                    window.isPhoneVerified = true;
                } else {
                    if (viewNonMember) viewNonMember.style.display = 'block';
                    if (viewMember) viewMember.style.display = 'none';
                    
                    if (nameInput) { nameInput.value = ''; nameInput.readOnly = true; }
                    if (phoneInput) { phoneInput.value = ''; phoneInput.readOnly = true; }
                    window.isPhoneVerified = false;
                }
            }

            // GA4 Funnel Tracking
            if (typeof gtag !== 'undefined') {
                gtag('event', 'funnel_step', {
                    'event_category': 'Quote_Funnel',
                    'event_label': 'Step_' + step,
                    'step_name': String(step)
                });
            }
            
            // Custom Funnel Tracking
            window.__funnel_visited = window.__funnel_visited || {};
            let fStep = null;
            if (step === 'method' || step === 'grade-list' || step === 'defects') fStep = 'quote_model';
            else if (step === 'auth' || step === 'result') fStep = 'quote_details';

            if (fStep && window.trackFunnel && !window.__funnel_visited[fStep]) {
               window.__funnel_visited[fStep] = true;
               window.trackFunnel(fStep);
            }

            // Update progress bar
            const stepToProgress = { 1: 1, 2: 2, '2-sub': 2, 3: 3, 4: 4, method: 5, 'grade-list': 5, defects: 5, auth: 5, result: 5, 6: 5, 7: 5, 8: 6 };
            const currentProgressStep = stepToProgress[step] || 1;

            const isSamsung = currentQuote && currentQuote.brand === 'samsung';
            const step4Item = document.querySelector('.wiz-step-item[data-step="4"]');
            const step4Conn = document.getElementById('wiz-conn-4');
            const step5Circle = document.querySelector('.wiz-step-item[data-step="5"] .wiz-step-circle');

            if (isSamsung) {
                if (step4Item) step4Item.style.display = 'none';
                if (step4Conn) step4Conn.style.display = 'none';
                if (step5Circle) step5Circle.innerText = '4';
            } else {
                if (step4Item) step4Item.style.display = '';
                if (step4Conn) step4Conn.style.display = '';
                if (step5Circle) step5Circle.innerText = '5';
            }

            document.querySelectorAll('.wiz-step-item').forEach((item) => {
                const s = parseInt(item.dataset.step);
                item.classList.remove('active', 'done');
                // 삼성이면 5단계가 활성화될 때 4단계를 건너뛰었으므로 논리 조정
                const effectiveStep = (isSamsung && s === 5) ? 4 : s;
                const effectiveCurrent = (isSamsung && currentProgressStep === 5) ? 4 : currentProgressStep;

                if (effectiveStep < effectiveCurrent) item.classList.add('done');
                else if (effectiveStep === effectiveCurrent) item.classList.add('active');
            });
            document.querySelectorAll('.wiz-connector').forEach((conn, i) => {
                const connIndex = i + 1;
                // 커넥터도 4번 커넥터가 숨겨지므로 인덱스를 당겨서 계산
                let effectiveConnIndex = connIndex;
                if (isSamsung && connIndex === 3) {
                    effectiveConnIndex = 3; // 3번 커넥터가 3->5(실제4)를 연결
                }
                const effectiveCurrent = (isSamsung && currentProgressStep === 5) ? 4 : currentProgressStep;
                conn.classList.toggle('done', effectiveConnIndex < effectiveCurrent);
            });
        }



    };







    window.selectMethod = (method) => {



        currentQuote.method = method; // 'simple' or 'self'



        if (method === 'simple') {



            // Skip checks, assume standard used grade (maybe B or A class range?)



            // For now, let's just go to result and show a range?



            // User requested: "Simple" -> estimated price. 



            // Let's assume standard B Grade for "Simple" estimation or just show range.



            // For simplicity, let's treat "Simple" as "S Grade" but with a disclaimer?



            // Actually, "Simple" usually implies "I'll send it, you check it". 



            // Let's map Simple -> 's' grade (max price) for display to attract, 



            // or maybe 'b' for realistic?



            // Let's default to S for "Max Estimate"



            calculateAndShowResult(true);



        } else {



            goToStep('defects');



        }



    };







    
    // ──────────────────────────────────────────────────
    // 셀프접수 서브스텝 네비게이션
    // ──────────────────────────────────────────────────
    let _defectSubStep = 1;
    const DEFECT_TOTAL_STEPS = 6;

    function updateDefectSubStepUI() {
        const allSubs = document.querySelectorAll('.defect-sub-step');
        allSubs.forEach(el => {
            const step = parseInt(el.dataset.defectStep);
            el.style.display = step === _defectSubStep ? 'block' : 'none';
            if (step === _defectSubStep) el.classList.add('active');
            else el.classList.remove('active');
        });
        const label = document.getElementById('defect-step-label');
        const bar = document.getElementById('defect-progress-bar');
        if (label) label.textContent = 'STEP ' + _defectSubStep + ' / ' + DEFECT_TOTAL_STEPS;
        if (bar) bar.style.width = ((_defectSubStep / DEFECT_TOTAL_STEPS) * 100) + '%';
        const prevBtn = document.getElementById('defect-prev-btn');
        const nextBtn = document.getElementById('defect-next-btn');
        if (prevBtn) prevBtn.textContent = _defectSubStep === 1 ? '이전 단계로' : '이전';
        if (nextBtn) nextBtn.textContent = _defectSubStep === DEFECT_TOTAL_STEPS ? '견적 확인하기' : '다음';
        const progressBar = document.getElementById('defect-progress');
        if (progressBar) {
            progressBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            const defectSection = document.getElementById('wizard-step-defects');
            if (defectSection) defectSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    window.defectSubStepNav = (direction) => {
        if (direction === -1) {
            if (_defectSubStep <= 1) { goToStep('method'); return; }
            _defectSubStep--;
        } else {
            if (_defectSubStep === 1) {
                const sealedBtn = document.querySelector('.btn-check-opt[data-group="is_sealed"].active');
                if (!sealedBtn) { alert('개봉 여부를 선택해 주세요.'); return; }
                if (sealedBtn.dataset.value === 'true') { calculateAndShowResult(); return; }
            }
            if (_defectSubStep >= DEFECT_TOTAL_STEPS) { calculateAndShowResult(); return; }
            _defectSubStep++;
        }
        updateDefectSubStepUI();
    };

    // defects 스텝 진입 시 서브스텝 리셋 (MutationObserver)
    setTimeout(() => {
        const defectDiv = document.getElementById('wizard-step-defects');
        if (defectDiv) {
            const obs = new MutationObserver(() => {
                if (defectDiv.classList.contains('active')) {
                    _defectSubStep = 1;
                    updateDefectSubStepUI();
                }
            });
            obs.observe(defectDiv, { attributes: true, attributeFilter: ['class'] });
        }
    }, 500);

    // Toggle Logic for Buttons



    window.toggleRadioSafe = (btn) => {



        const group = btn.dataset.group;



        const val = btn.dataset.value;







        // Turn off others in group



        document.querySelectorAll(`.btn-check-opt[data-group="${group}"]`).forEach(b => b.classList.remove('active'));



        btn.classList.add('active');







        // Toggle visibility for Sealed/Used



        if (group === 'is_sealed') {



            const optionsDiv = document.getElementById('used-condition-options');



            if (optionsDiv) {



                if (val === 'true') {



                    optionsDiv.style.display = 'none';



                } else {



                    optionsDiv.style.display = 'block';



                }



            }



        }



    };







    window.toggleMulti = (btn, value) => {



        const group = btn.dataset.group;







        if (value === 'none') {



            // If 'None' clicked, clear others



            document.querySelectorAll(`.btn-check-opt[data-group="${group}"]`).forEach(b => b.classList.remove('active'));



            btn.classList.add('active');



        } else {



            // If specific defect clicked, turn off 'None'



            const noneBtn = document.querySelector(`.btn-check-opt[data-group="${group}"][data-value="none"]`);



            if (noneBtn) noneBtn.classList.remove('active');







            btn.classList.toggle('active');







            // If nothing active, turn 'None' back on? Optional.



            // Let's check if any are active



            const anyActive = document.querySelector(`.btn-check-opt[data-group="${group}"].active`);



            if (!anyActive && noneBtn) noneBtn.classList.add('active');



        }



    };







    // calculateAndShowResult



    window.calculateAndShowResult = (isSimpleMode = false) => {



        console.log("calculateAndShowResult called. Mode:", isSimpleMode ? "Simple" : "Detail");







        if (!currentQuote.model) {



            console.error("No model selected!");



            alert("모델이 선택되지 않았습니다. 처음부터 다시 시도해주세요.");



            return;



        }







        // Safety Check for Prices



        if (!currentQuote.model.prices && !currentQuote.model.basePrice) {



            console.error("Price data missing for", currentQuote.model);



            alert("죄송합니다. 이 모델의 시세 데이터가 아직 업데이트되지 않았습니다.");



            return;



        }







        // Gather Data



        let defects = {};







        if (!isSimpleMode) {



            // Collect checked states



            document.querySelectorAll('.btn-check-opt.active').forEach(btn => {



                const group = btn.dataset.group;



                const val = btn.dataset.value;







                if (!defects[group]) defects[group] = [];



                if (val !== 'none' && val !== 'no') defects[group].push(val);







                // For radio types like is_sealed, lcd_damage



                if (group === 'is_sealed') defects.is_sealed = (val === 'true');



                if (group === 'lcd_damage') defects.lcd_damage = (val === 'yes');



                if (group === 'burn_in') defects.burn_in = (val === 'yes');



            });



        }







        // 1. Unpurchasable Check (Account Locked)



        if (!isSimpleMode && defects.func_defect && defects.func_defect.includes('account')) {



            alert("도난 우려가 있는 '계정 잠김' 기기는 매입이 불가능합니다.\n잠금 해제 후 다시 접수해 주세요.");



            return;



        }







        // Logic to Determine Grade



        let grade = 's'; // Default start from Top







        if (isSimpleMode) {



            grade = 's'; // Show Max Price for Simple



        } else {



            // It's Used. Check defects cascadingly.



            // Priority: D (Worst) -> C -> B -> A -> S







            const hasBodyDamage = defects.body_damage && defects.body_damage.length > 0;



            const hasMicroScratch = defects.micro_scratch && defects.micro_scratch.length > 0;



            const isLcdDamaged = defects.lcd_damage;



            const hasBurnIn = defects.burn_in;



            const hasFuncDefect = defects.func_defect && defects.func_defect.length > 0;







            // Rules (User can refine these!)



            // D Grade: Power, Account, LCD Damage ?? (Usually LCD is C or D)



            // Let's assume LCD Damage is Critical -> C or D. Let's start with C.



            // Sharaphone Policy assumption:







            // Grade Logic V1 (Conservative):



            if (defects.func_defect?.includes('power') || defects.func_defect?.includes('account') || defects.func_defect?.includes('network')) {



                grade = 'd'; // Critical Failure



            } else if (isLcdDamaged) {



                grade = 'c'; // Screen broken



            } else if (hasFuncDefect || hasBurnIn) {



                grade = 'c'; // Functional issue or Burn-in -> C



            } else if (hasBodyDamage) {



                // Physical damage -> B



                grade = 'b';



            } else if (hasMicroScratch) {



                // Just scratches -> A



            } else {



                // No defects found -> S



                grade = 's';



            }



        }







        if (grade === 's' && defects.is_sealed) {



            grade = 'sealed';



        }







        console.log("Calculated Grade:", grade);



        currentQuote.grade = grade;



        currentQuote.defectsDetails = defects; // Save for record







        // Price Lookup



        let baseGradePrice = 0;







        if (currentQuote.model.prices && currentQuote.model.prices[grade] !== undefined && currentQuote.model.prices[grade] > 0) {



            baseGradePrice = currentQuote.model.prices[grade];



        } else {



            // Fallback for old data or missing grade price



            console.warn(`${grade} price missing or 0, using fallback`);



            if (grade === 'sealed') {



                // If sealed price is 0 or missing, fallback to 's' grade price



                baseGradePrice = currentQuote.model.prices['s'] || currentQuote.model.basePrice || 0;



            } else if (grade === 's') {



                baseGradePrice = currentQuote.model.basePrice || 0;



            }



        }







        let storageAdj = 0;



        if (currentQuote.storage && currentQuote.storage.priceAdjustment) {



            storageAdj = currentQuote.storage.priceAdjustment;



        }







        let finalPrice = baseGradePrice + storageAdj;



        if (finalPrice < 0) finalPrice = 0;



        finalPrice = Math.floor(finalPrice / 1000) * 1000;







        currentQuote.finalPrice = finalPrice;



        console.log("Final Price:", finalPrice);







        // Render Result



        const gradeNames = {



            sealed: "미개봉 (새상품)",



            s: "S급 (최고)",



            a: "A급 (깨끗)",



            b: "B급 (사용감)",



            c: "C급 (파손/기능)",



            d: "D급 (심한 파손)"



        };



        const gradeName = gradeNames[grade] || grade;







        document.getElementById('result-model-name').textContent = `${currentQuote.model.model} (${currentQuote.storage.size})`;



        let priceDisplayStr = formatCurrency(finalPrice);
        const gradeToCheck = (currentQuote.grade || '').toLowerCase();
        
        let multiplier = 0;
        if (gradeToCheck === 'a') multiplier = 1.1;
        else if (gradeToCheck === 'b') multiplier = 1.2;
        else if (!['sealed', 's'].includes(gradeToCheck)) multiplier = 1.5;

        if (multiplier > 0) {
            priceDisplayStr += ' ~ ' + formatCurrency(Math.floor(finalPrice * multiplier));
        }
        document.getElementById('final-price-display').innerText = priceDisplayStr;







        let breakdown = `<p><strong>판정 등급:</strong> <span style="color:var(--primary-color)">${gradeName}</span></p>`;



        if (isSimpleMode) {



            breakdown += `<p style="color:#888; font-size:0.8rem;">* 간편 접수(예상 최고가)</p>`;



        }



        breakdown += `<p>용량 옵션(${currentQuote.storage.size}): ${storageAdj > 0 ? '+' : ''}${formatCurrency(storageAdj)}</p>`;







        // Debug info if price is 0



        if (baseGradePrice === 0) {



            breakdown += `<p style="color:red; font-size:0.8rem;">* 주의: 해당 등급의 시세 데이터가 없습니다(0원).</p>`;



        }







        document.getElementById('price-breakdown').innerHTML = breakdown;







        goToStep(6);



    };







    // ... (Remainder of fetch logic) -> Keep existing listener logic or update it?



    // We need to attach listeners for Steps 1-4 (Brand, Series, Model, Storage) 



    // AND for Step 4.5 (Method) - handled by onclick HTML attributes for simplicity?



    // YES, I added onclick="selectMethod()" in HTML, so we are good there.



    // I also added onclick in the check buttons.







    // Logic to load data and render Steps 1-4 remains same.



    // Just need to ensure goToStep calls align.







    // We replaced 'attachWizardListeners' partly with inline onclicks for the new sections



    // but Brand/Series/Model/Storage listeners are still needed.







    // ... (Keep existing fetch and step 1-4 logic below)







    // 1. Fetch Data



    if (loadingOverlay) loadingOverlay.style.display = 'flex';







    try {



        console.log("Fetching products...");



        const q = query(collection(db, "products"));



        const snapshot = await getDocs(q);







        if (snapshot.empty) {



            alert("시세 데이터가 없습니다. 관리자 페이지에서 마이그레이션을 확인해주세요.");



            if (loadingOverlay) loadingOverlay.style.display = 'none';



            return;



        }







        allProducts = [];



        snapshot.forEach(doc => {



            allProducts.push({ id: doc.id, ...doc.data() });



        });



        console.log(`Loaded ${allProducts.length} products`);



        // Attach Event Listeners AFTER data is loaded
        attachWizardListeners();

        // Check URL parameters for fast navigate
        const urlParams = new URLSearchParams(window.location.search);
        let fastModel = urlParams.get('model');
        let fastSearch = urlParams.get('search');
        let fastBrand = urlParams.get('brand');
        
        const preservedHash = window.initialAdsHash || window.location.hash;
        if (!fastBrand && preservedHash) {
            if (preservedHash.includes('apple') || preservedHash.includes('iphone')) {
                fastBrand = 'apple';
            } else if (preservedHash.includes('samsung') || preservedHash.includes('galaxy')) {
                fastBrand = 'samsung';
            }
        }

        if (fastBrand) {
            setTimeout(() => {
                const btn = document.querySelector(`.brand-btn[data-brand="${fastBrand}"]`);
                if (btn) btn.click();
            }, 100);
        } else if (fastModel || fastSearch) {
            let foundModel = null;
            if (fastModel) {
                const q = fastModel.toLowerCase().replace(/\s/g, '');
                foundModel = allProducts.find(p => p.model && p.model.toLowerCase().replace(/\s/g, '') === q);
            }
            if (!foundModel && fastSearch) {
                const q = fastSearch.toLowerCase().replace(/\s/g, '');
                foundModel = allProducts.find(p => p.model && p.model.toLowerCase().replace(/\s/g, '') === q);
                if (!foundModel) {
                    foundModel = allProducts.find(p => p.model && p.model.toLowerCase().replace(/\s/g, '').includes(q));
                }
            }

            if (foundModel) {
                currentQuote.brand = foundModel.brand;
                currentQuote.series = foundModel.series || foundModel.brand;
                currentQuote.model = foundModel;
                
                const storageOpts = foundModel.storageOptions || [
                    { size: '128GB', priceAdjustment: 0 },
                    { size: '256GB', priceAdjustment: 80000 },
                    { size: '512GB', priceAdjustment: 150000 }
                ];
                currentQuote.storage = storageOpts[0];
                currentQuote.method = 'simple';
                currentQuote.grade = 's';
                
                let sPrice = (currentQuote.model.prices && currentQuote.model.prices['s']) ? currentQuote.model.prices['s'] : (currentQuote.model.basePrice || 0);
                if (currentQuote.storage) sPrice += (currentQuote.storage.priceAdjustment || 0);
                currentQuote.finalPrice = Math.floor(sPrice / 1000) * 1000;

                setTimeout(() => {
                    if (typeof window.renderGradePriceList === 'function') window.renderGradePriceList();
                    if (typeof window.goToStep === 'function') window.goToStep('grade-list');
                }, 300);
            }
        }

    } catch (e) {
        console.error("Fetch Data Error:", e);
        alert("데이터 로딩 실패: " + e.message);
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }

    function attachWizardListeners() {
        console.log("Attaching wizard listeners...");

        // Step 1: Brand
        const brandBtns = document.querySelectorAll('.brand-btn');
        brandBtns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('active'));
                newBtn.classList.add('active');
                currentQuote.brand = newBtn.dataset.brand;
                if (typeof renderSeries === 'function') {
                    renderSeries(currentQuote.brand);
                    setTimeout(() => goToStep(2), 300);
                }
            });
        });

        // Step 6: Sell Request Button (Result -> Auth)
        const reqBtn = document.getElementById('btn-sell-request');
        if (reqBtn) {
            // Remove old listeners
            const newReqBtn = reqBtn.cloneNode(true);
            reqBtn.parentNode.replaceChild(newReqBtn, reqBtn);
            newReqBtn.addEventListener('click', () => {
                goToStep('auth');
            });
        }

        // Auth Step Listeners
        const btnAuthNext = document.getElementById('btn-auth-next');
        const btnAuthNonmember = document.getElementById('btn-auth-nonmember');
        const btnAuthLogin = document.getElementById('btn-auth-login');
        const btnAuthKakao = document.getElementById('btn-auth-kakao');
        const btnAuthNaver = document.getElementById('btn-auth-naver');

        const savePendingQuote = () => {
            sessionStorage.setItem('pendingQuote', JSON.stringify(currentQuote));
        };

        if (btnAuthLogin) {
            btnAuthLogin.addEventListener('click', () => {
                savePendingQuote();
                window.location.href = 'login.html';
            });
        }

        if (btnAuthKakao) {
            btnAuthKakao.addEventListener('click', () => {
                savePendingQuote();
                if (!window.Kakao) {
                    alert('카카오 SDK가 로드되지 않았습니다.');
                    return;
                }
                if (!window.Kakao.isInitialized()) {
                    window.Kakao.init('9b153d47aec7d5bcf224455284a9e715'); 
                }

                window.Kakao.Auth.login({
                    success: function (authObj) {
                        window.Kakao.API.request({
                            url: '/v2/user/me',
                            success: async function (res) {
                                const kakaoAccount = res.kakao_account;
                                const email = kakaoAccount?.email || `kakao_${res.id}@kakao.com`;
                                const nickname = kakaoAccount?.profile?.nickname || `카카오유저${res.id}`;
                                const uid = `kakao_${res.id}`;
                                try {
                                    if (db) {
                                        const { doc, getDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                                        const docRef = doc(db, "users", uid);
                                        const docSnap = await getDoc(docRef);
                                        const isNewUser = !docSnap.exists();

                                        await setDoc(docRef, {
                                            email: email,
                                            nickname: nickname,
                                            uid: uid,
                                            provider: 'kakao',
                                            createdAt: new Date(),
                                            role: 'user'
                                        }, { merge: true });

                                        // 알림톡 발송 (카카오 연락처 제공 동의 시)
                                        if (isNewUser && kakaoAccount.phone_number && window.triggerFrontendAlimtalk) {
                                            let phoneRaw = kakaoAccount.phone_number;
                                            if (phoneRaw.startsWith('+82 ')) phoneRaw = '0' + phoneRaw.substring(4);
                                            window.triggerFrontendAlimtalk("signup", phoneRaw, {
                                                name: nickname,
                                                provider: 'kakao'
                                            });
                                        }
                                    }
                                } catch (e) {
                                    console.error('Firestore save kakao user error:', e);
                                }

                                const userInfo = { email, nickname, provider: 'kakao', uid };
                                localStorage.setItem('user_info', JSON.stringify(userInfo));
                                if (typeof window.updateNavbar === 'function') window.updateNavbar(userInfo);
                                
                                goToStep('auth');
                            },
                            fail: function (error) {
                                alert('카카오 정보 가져오기에 실패했습니다.');
                            }
                        });
                    },
                    fail: function (err) {
                        alert("카카오 로그인에 실패했습니다.");
                    }
                });
            });
        }

        if (btnAuthNaver) {
            btnAuthNaver.addEventListener('click', (e) => {
                e.preventDefault();
                savePendingQuote();
                
                if (window.naverLoginInst && typeof window.naverLoginInst.generateAuthorizeUrl === 'function') {
                    const url = window.naverLoginInst.generateAuthorizeUrl();
                    const stateMatch = url.match(/state=([^&]+)/);
                    if (stateMatch) {
                        localStorage.setItem('com.naver.nid.oauth.state_token', stateMatch[1]);
                    }
                    window.location.href = url;
                } else {
                    const naverBtn = document.querySelector('#naverIdLogin a') || document.querySelector('#naverIdLogin_loginButton');
                    if (naverBtn && naverBtn.href) {
                        window.location.href = naverBtn.href;
                    } else if (naverBtn && naverBtn.click) {
                        naverBtn.click();
                    } else {
                        alert("네이버 로그인 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
                    }
                }
            });
        }

        if (btnAuthNonmember) {
            btnAuthNonmember.addEventListener('click', () => {
                savePendingQuote(); // Save state before redirecting on mobile!
                if (!window.IMP) {
                    alert("인증 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
                    return;
                }
                const IMP = window.IMP;
                IMP.init("imp25541365");

                IMP.certification({
                    merchant_uid: "cert_" + new Date().getTime(),
                    m_redirect_url: window.location.origin + window.location.pathname + "?step=auth_callback",
                    bypass: {
                        inicisUnified: {
                            directAgency: "PASS",
                            flgFixedUser: "N"
                        }
                    }
                }, async function (rsp) {
                    if (rsp.success) {
                        btnAuthNonmember.textContent = "인증 확인 중...";
                        btnAuthNonmember.disabled = true;

                        try {
                            const res = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/portoneApi/verify", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ imp_uid: rsp.imp_uid })
                            });
                            const result = await res.json();
                            
                            if (result.success && result.data) {
                                const nameInput = document.getElementById('auth-name');
                                const phoneInput = document.getElementById('auth-phone');
                                
                                if (nameInput) { nameInput.value = result.data.name; nameInput.readOnly = true; }
                                if (phoneInput) { phoneInput.value = result.data.phone; phoneInput.readOnly = true; }
                                
                                window.isPhoneVerified = true;

                                // --- SAVE GUEST TO USERS COLLECTION ---
                                try {
                                    const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                                    const guestUid = 'guest_' + result.data.phone;
                                    await setDoc(doc(db, "users", guestUid), {
                                        email: '비회원',
                                        nickname: result.data.name,
                                        phoneNumber: result.data.phone,
                                        provider: 'guest',
                                        role: 'guest',
                                        createdAt: serverTimestamp()
                                    }, { merge: true });
                                } catch (e) {
                                    console.error("Failed to save guest user:", e);
                                }
                                
                                // Switch views
                                document.getElementById('view-non-member').style.display = 'none';
                                document.getElementById('view-member').style.display = 'block';
                                
                                btnAuthNonmember.textContent = "비회원으로 휴대폰 본인인증하기";
                                btnAuthNonmember.disabled = false;
                                
                                alert("본인인증이 완료되었습니다.");


                            } else {
                                throw new Error(result.error || "인증 정보 조회 실패");
                            }
                        } catch (err) {
                            console.error("Verification error:", err);
                            alert("본인인증 처리 중 오류가 발생했습니다: " + err.message);
                            btnAuthNonmember.textContent = "비회원으로 휴대폰 본인인증하기";
                            btnAuthNonmember.disabled = false;
                        }
                    } else {
                        alert("인증에 실패하였습니다: " + rsp.error_msg);
                    }
                });
            });
        }


        if (btnAuthNext) {
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
                        if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
                        return 'anonymous';
                    })(),
                    method: currentQuote.method || 'simple',
                    defectsDetails: currentQuote.defectsDetails || {},
                    trafficSource: sessionStorage.getItem('traffic_source') || 'direct'
                };

                try {
                    const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    payload.firebaseTimestamp = serverTimestamp();
                    
                    if (!auth.currentUser) {
                        const { signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                        await signInAnonymously(auth);
                    }
                    
                    const docRef = await addDoc(collection(db, "quotes"), payload);
                    window.currentQuoteDocId = docRef.id;
                    
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
                    } catch(e) {}
                    
                    // Proceed to step 8 (Delivery selection)
                    goToStep(8);
                    
                } catch (e) {
                    console.error("1차 접수 오류:", e);
                    alert("접수 중 오류가 발생했습니다. 다시 시도해주세요.");
                    btnAuthNext.textContent = '판매 신청 완료하기';
                    btnAuthNext.disabled = false;
                }
            });
        }

        // Terms Step (Removed)
        // Button is inline onclick="goToStep(7)" but we can add validation if needed.

        // Delivery Method Listeners
        const deliveryBtns = document.querySelectorAll('.method-btn');
        console.log("Found delivery buttons:", deliveryBtns.length);

        deliveryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const method = btn.dataset.method;
                currentQuote.deliveryMethod = method;

                // Toggle Address Field
                const addrContainer = document.getElementById('field-address-container'); // Need to ensure ID matches HTML
                // In HTML we used 'field-address-container' in Pickup logic? 
                // Let's check HTML. I added 'customer-address' input. 
                // But I didn't wrap it in a specific ID container in the last replace?
                // Let's just toggle 'method-cvs-info' and others.

                const cvsInfo = document.getElementById('method-cvs-info');
                const selfInfo = document.getElementById('method-self-info');

                if (cvsInfo) cvsInfo.style.display = 'none';
                if (selfInfo) selfInfo.style.display = 'none';

                if (method === 'cvs') {
                    if (cvsInfo) cvsInfo.style.display = 'block';
                } else if (method === 'courier' || method === 'self') {
                    // Courier implies pickup? No 'courier' in my HTML was '택배 방문수거'.
                    // wait. 
                    // pickup_samil: Visiting Pickup (Address needed)
                    // cvs: CVS (Self send)
                    // courier: Courier Pickup (visiting) (Address needed)
                    // visit: Store Visit (No address needed)
                }




                // Show/Hide Address Field based on method
                // We need to target the parent div of 'customer-address'
                const addrInput = document.getElementById('customer-address');
                if (addrInput) {
                    const addrWrapper = addrInput.closest('.mb-2');
                    if (method === 'pickup_samil' || method === 'courier' || method === 'pickup') {
                        addrWrapper.style.display = 'block';
                    } else {
                        addrWrapper.style.display = 'none';
                    }
                }
            });
        });

        // Final Submit Button
        const btnSubmit = document.getElementById('btn-submit-final');
        if (btnSubmit) {
            // Remove old listener
            const newSubmit = btnSubmit.cloneNode(true);
            btnSubmit.parentNode.replaceChild(newSubmit, btnSubmit);
            const handleFinalSubmitClick = () => {
                const name = document.getElementById('auth-name').value;
                const phone = document.getElementById('auth-phone').value;
                const address = document.getElementById('customer-address') ? document.getElementById('customer-address').value : '';
                const bankName = document.getElementById('customer-bank') ? document.getElementById('customer-bank').value : '';
                const accountNum = document.getElementById('customer-account').value;
                const account = bankName ? `${bankName} ${accountNum}` : accountNum;

                let deliveryMethod = currentQuote.deliveryMethod;
                if (!deliveryMethod) {
                    const activeBtn = document.querySelector('.method-btn.active');
                    if (activeBtn) deliveryMethod = activeBtn.dataset.method;
                    else deliveryMethod = 'courier';
                }

                if (!name || !phone) {
                    alert("이름과 연락처를 입력해주세요.");
                    return;
                }

                const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);
                if (needsAddress && !address) {
                    alert("수거를 위해 주소를 입력해주세요.");
                    return;
                }

                if (!account) {
                    alert("정산을 위해 계좌 정보를 입력해주세요.");
                    return;
                }

                // If valid, open the pre-sale modal instead of submitting directly
                if (window.openPresaleModal) window.openPresaleModal();
            };

            newSubmit.addEventListener('click', handleFinalSubmitClick);
        }
    }

    // New Function: Render Grade Price List (Read-Only)
    window.renderGradePriceList = () => {
        const container = document.getElementById('grade-price-list-target');
        if (!container || !currentQuote.model) return;

        const titleTarget = document.getElementById('simple-quote-model-title');
        if (titleTarget && currentQuote.model && currentQuote.storage) {
            titleTarget.innerHTML = `<span style="color:var(--primary-color)">${currentQuote.model.model} (${currentQuote.storage.size})</span> 모델 예상 매입가입니다.`;
        }

        if (currentQuote.model.model === '기타 기종') {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #eee;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🔍</div>
                    <h3 style="color: #333; margin-bottom: 10px; font-weight: 700;">기타 기종 상태확인 안내</h3>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                        목록에 없는 기타 기종은 기기 상태 검수 후 정확한 견적이 산출됩니다.<br>
                        대략적인 단가가 궁금하시다면 고객센터로 문의해 주세요!
                    </p>
                    <button onclick="if(window.ChannelIO){ChannelIO('showMessenger')}else{alert('채팅 상담 연결 중 문제가 발생했습니다.')}" class="btn btn-secondary" style="background: #2563EB; color: white; border: none; font-weight: 600;">채팅으로 단가 문의하기</button>
                </div>
            `;
            return;
        }

        const prices = currentQuote.model.prices || {};
        const basePrice = currentQuote.model.basePrice || 0;

        // Define Grades to show
        const grades = ['s', 'a', 'b', 'c', 'd'];
        let html = '';
        grades.forEach(g => {
            let price = prices[g];
            if (price === undefined) {
                if (g === 's') price = basePrice;
                else if (g === 'a') price = basePrice * 0.9;
                else if (g === 'b') price = basePrice * 0.8;
                else if (g === 'c') price = basePrice * 0.6;
                else if (g === 'd') price = basePrice * 0.2;
            }
            price = Math.floor(price / 1000) * 1000;

            const gradeLabels = {
                s: { title: "S급 (미사용/최고)", desc: "기스 없는 최고 상태" },
                a: { title: "A급 (깨끗)", desc: "미세 기스 1~2곳" },
                b: { title: "B급 (사용감)", desc: "찍힘/기스 다수" },
                c: { title: "C급 (파손)", desc: "화면 파손/기능 불량" },
                d: { title: "D급 (심한 파손)", desc: "심한 파손/기능 불량" }
            };

            // Read-Only List Item
            html += `
            <div class="grade-list-card" style="cursor: default; pointer-events: none;">
                <div class="grade-row" style="padding: 15px 20px;">
                    <div class="grade-info">
                        <h4 style="margin:0; font-size:1rem;">${gradeLabels[g].title}</h4>
                        <p style="margin:2px 0 0; font-size:0.8rem; color:#888;">${gradeLabels[g].desc}</p>
                    </div>
                    <div class="grade-price" style="font-size:1.1rem;">${formatCurrency(price)}</div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    };

    window.setGradeAndGo = (grade) => {
        currentQuote.grade = grade;
        // Calculate price
        let price = 0;
        if (currentQuote.model.prices && currentQuote.model.prices[grade]) {
            price = currentQuote.model.prices[grade];
        } else {
            // Fallback
            const base = currentQuote.model.basePrice || 0;
            const rates = { s: 1, a: 0.9, b: 0.8, c: 0.6, d: 0.2 };
            price = base * (rates[grade] || 0);
        }

        // Add storage
        if (currentQuote.storage) price += (currentQuote.storage.priceAdjustment || 0);

        currentQuote.finalPrice = Math.floor(price / 1000) * 1000;

        calculateAndShowResult(true); // Render Step 6
        goToStep(6);
    };

    window.selectMethod = (method) => {
        currentQuote.method = method; // 'simple' or 'self'
        if (method === 'simple') {
            currentQuote.grade = 's'; // Default to S Grade
            let sPrice = 0;
            if (currentQuote.model.prices && currentQuote.model.prices['s']) {
                sPrice = currentQuote.model.prices['s'];
            } else {
                sPrice = currentQuote.model.basePrice || 0;
            }
            if (currentQuote.storage) sPrice += (currentQuote.storage.priceAdjustment || 0);
            currentQuote.finalPrice = Math.floor(sPrice / 1000) * 1000;

            renderGradePriceList();
            goToStep('grade-list');
        } else {
            goToStep('defects');
        }
    };

    function getSamsungParentCategory(seriesName) {
        if (!seriesName) return '기타 기종';
        const s = seriesName.toUpperCase();
        if (s.includes('폴드') || s.includes('FOLD') || s.includes('Z FOLD')) return '폴드 시리즈';
        if (s.includes('플립') || s.includes('FLIP') || s.includes('Z FLIP')) return '플립 시리즈';
        if (s.includes('노트') || s.includes('NOTE')) return '노트 시리즈';
        if (s.includes('S') && /[0-9]/.test(s) && !s.includes('플립') && !s.includes('폴드') && !s.includes('노트')) return 'S 시리즈';
        if ((s.includes('A') && /[0-9]/.test(s)) || s.includes('A 시리즈') || s.includes('A시리즈')) return 'A 시리즈 및 기타기종';
        return '기타 기종';
    }

    function renderSeries(brand) {
        const container = document.getElementById('series-list');
        container.innerHTML = '';
        const products = allProducts.filter(p => p.brand === brand);
        let seriesSet;
        if (brand === 'samsung') {
            seriesSet = new Set();
            products.forEach(p => seriesSet.add(getSamsungParentCategory(p.series)));
        } else {
            seriesSet = new Set(products.map(p => p.series || '기타'));
        }
        let seriesList;
        if (brand === 'samsung') {
            const order = ['S 시리즈', '폴드 시리즈', '플립 시리즈', '노트 시리즈', 'A 시리즈 및 기타기종', '기타 기종'];
            seriesList = Array.from(seriesSet).sort((a, b) => {
                let idxA = order.indexOf(a);
                let idxB = order.indexOf(b);
                if (idxA === -1) idxA = 99;
                if (idxB === -1) idxB = 99;
                return idxA - idxB;
            });
        } else {
            seriesList = Array.from(seriesSet).sort((a, b) => {
                if (a === '기타') return 1;
                if (b === '기타') return -1;
                const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
                if (numA !== numB) return numB - numA;
                return b.localeCompare(a); 
            });
        }

        if (seriesList.length === 0) {
            container.innerHTML = '<div>해당 브랜드의 모델이 없습니다.</div>';
            return;
        }

        seriesList.forEach((series, index) => {
            if (series === '기타' || series === '기타 기종') return;
            const card = document.createElement('div');
            card.className = 'selection-card';
            card.style.position = 'relative';
            card.style.transition = '0.2s';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.padding = '15px';
            
            let extraHtml = '';
            if (brand === 'apple') {
                if (index === 0) {
                    card.style.borderColor = '#ef4444';
                    extraHtml = '<span style="position: absolute; top: -12px; right: -5px; background: #ef4444; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.70rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">NEW</span>';
                } else if (index === 1) {
                    card.style.borderColor = '#f59e0b';
                    extraHtml = '<span style="position: absolute; top: -12px; right: -5px; background: #f59e0b; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.70rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">HOT</span>';
                }
            }

            let imgHtml = '';
            if (brand === 'samsung') {
                let imgSrc = '';
                if (series === 'S 시리즈') imgSrc = 'assets/series/samsung/s시리즈.png';
                else if (series === '폴드 시리즈') imgSrc = 'assets/series/samsung/폴드 시리즈.png';
                else if (series === '플립 시리즈') imgSrc = 'assets/series/samsung/플립 시리즈.png';
                else if (series === '노트 시리즈') imgSrc = 'assets/series/samsung/갤럭시노트.png';
                else if (series === 'A 시리즈' || series === 'A 시리즈 및 기타기종') imgSrc = 'assets/series/samsung/A시리즈.png';
                if (imgSrc) {
                    imgHtml = `<img src="${imgSrc}" style="height: 80px; object-fit: contain; margin-bottom: 8px;" alt="${series}">`;
                }
            } else if (brand === 'apple') {
                const baseName = series.replace('시리즈', '').replace(/\s+/g, '').toLowerCase();
                const imgSrc = `assets/series/apple/${baseName}.png`;
                imgHtml = `<img src="${imgSrc}" style="height: 80px; object-fit: contain; margin-bottom: 8px;" alt="${series}" onerror="this.style.display='none'">`;
            }

            card.innerHTML = `${imgHtml}<div class="card-title">${series}</div>${extraHtml}`;
            card.onclick = () => {
                if (brand === 'samsung') {
                    currentQuote.parentCategory = series;
                    renderSubSeries(brand, series);
                    goToStep('2-sub');
                } else {
                    currentQuote.series = series;
                    renderModels(brand, series);
                    goToStep(3);
                }
            };
            container.appendChild(card);
        });

        const otherCard = document.createElement('div');
        otherCard.className = 'selection-card';
        otherCard.style.borderColor = '#ccc';
        otherCard.style.backgroundColor = '#f8f9fa';
        otherCard.style.display = 'flex';
        otherCard.style.alignItems = 'center';
        otherCard.style.justifyContent = 'center';
        otherCard.innerHTML = `<div class="card-title" style="color: #555;">목록에 없음</div>`;
        otherCard.onclick = () => {
            currentQuote.series = '기타';
            currentQuote.model = {
                brand: brand,
                series: '기타',
                model: '기타 기종',
                basePrice: 0,
                prices: {},
                storageOptions: [{ size: '해당없음', priceAdjustment: 0 }]
            };
            currentQuote.storage = currentQuote.model.storageOptions[0];
            goToStep('method'); 
            selectMethod('simple');
        };
        container.appendChild(otherCard);

        const notFoundCard = document.createElement('div');
        notFoundCard.className = 'selection-card';
        notFoundCard.style.borderColor = '#2563EB';
        notFoundCard.style.backgroundColor = '#EFF6FF';
        notFoundCard.innerHTML = `<div class="card-title" style="color: #1E3A8A;">찾는 시리즈가 없나요?</div><div class="card-sub" style="color:#2563EB;">채팅상담 문의하기</div>`;
        notFoundCard.onclick = () => {
            if (window.ChannelIO) {
                ChannelIO('showMessenger');
            } else {
                alert('채팅 상담 플러그인을 불러올 수 없습니다.');
            }
        };
    }

    window.openTermsModal = function() {
        const modal = document.getElementById('termsModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeTermsModal = function() {
        const modal = document.getElementById('termsModal');
        if (modal) modal.style.display = 'none';
    };

    window.addEventListener('click', function(e) {
        const modal = document.getElementById('termsModal');
        if (e.target === modal) closeTermsModal();
    });

    function renderSubSeries(brand, parentCategory) {
        const container = document.getElementById('sub-series-list');
        container.innerHTML = '';
        const productsInParent = allProducts.filter(p => p.brand === brand && getSamsungParentCategory(p.series) === parentCategory);
        const specificSeriesSet = new Set();
        productsInParent.forEach(p => {
            if (p.series) specificSeriesSet.add(p.series);
        });

        const specificSeriesList = Array.from(specificSeriesSet).sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
            const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
            if (numA !== numB) return numB - numA;
            return b.localeCompare(a);
        });
        if (specificSeriesList.length === 0) {
            container.innerHTML = '<div>해당 카테고리의 모델이 없습니다.</div>';
            return;
        }

        specificSeriesList.forEach(seriesName => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.padding = '15px';
            const displayName = seriesName; 
            let subtext = '';
            const match = seriesName.match(/[0-9]+/);
            if(match) subtext = `<div style="font-size:0.75rem; color:#888; margin-top:4px;">${match[0]} Series</div>`;
            card.innerHTML = `<div class="card-title">${displayName}</div>${subtext}`;
            card.onclick = () => {
                currentQuote.specificSeries = seriesName;
                renderModels(brand, seriesName);
                goToStep(3);
            };
            container.appendChild(card);
        });
    }

    function renderModels(brand, specificSeriesOrParent) {
        const container = document.getElementById('model-list');
        container.innerHTML = '';
        let models;
        if (brand === 'samsung') {
            models = allProducts.filter(p => p.brand === brand && p.series === specificSeriesOrParent);
            models.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
        } else {
            models = allProducts.filter(p => p.brand === brand && (p.series || '기타') === specificSeriesOrParent);
            models.sort((a, b) => b.basePrice - a.basePrice);
        }

        models.forEach(item => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            let subtext = '';
            if (brand === 'samsung' && item.series) {
                const cleanSeriesName = item.series.replace('갤럭시 ', '').replace(' 시리즈', '');
                subtext = `<div style="font-size:0.75rem; color:#888; margin-top:4px;">${cleanSeriesName}</div>`;
            }
            card.innerHTML = `<div class="card-title">${item.model}</div>${subtext}`;
            card.onclick = () => {
                currentQuote.model = item;
                if (brand === 'samsung') {
                    currentQuote.storage = { size: "기본(용량무관)", priceAdjustment: 0 };
                    goToStep('method');
                } else {
                    renderStorage(item);
                    goToStep(4);
                }
            };
            container.appendChild(card);
        });
    }

    function renderStorage(modelData) {
        const container = document.getElementById('storage-list');
        container.innerHTML = '';
        const options = modelData.storageOptions || [{ size: "Default", priceAdjustment: 0 }];
        options.forEach(opt => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            card.innerHTML = `
    <div class="card-title">${opt.size}</div>
        <div class="card-sub">${opt.priceAdjustment > 0 ? '+' : ''}${opt.priceAdjustment / 10000}만</div>
`;
            card.onclick = () => {
                currentQuote.storage = opt;
                goToStep('method'); 
            };
            container.appendChild(card);
        });
        
        const customCard = document.createElement('div');
        customCard.className = 'selection-card';
        customCard.innerHTML = `
            <div class="card-title" style="font-size: 1.1rem;">찾는 용량이 없어요</div>
            <div class="card-sub" style="font-weight: 500; color: #2563EB; margin-top: 10px;">직접 입력하기</div>
        `;
        customCard.onclick = () => {
            const inputVal = prompt("해당 기기의 저장공간 용량을 직접 입력해주세요 (예: 64GB, 256GB 등)");
            if (inputVal && inputVal.trim() !== "") {
                currentQuote.storage = { size: inputVal.trim() + " (직접입력)", priceAdjustment: 0 };
                goToStep('method'); 
            }
        };
        container.appendChild(customCard);
    }

    function calculateFinalPrice() {
        if (!currentQuote.model || !currentQuote.grade) return;
        let baseGradePrice = currentQuote.model.prices[currentQuote.grade] || 0;
        let storageAdj = currentQuote.storage.priceAdjustment || 0;
        let finalPrice = baseGradePrice + storageAdj;
        if (finalPrice < 0) finalPrice = 0;

        const gradeNames = {
            sealed: "미개봉 (새상품)",
            s: "S급 (최고)",
            a: "A급 (깨끗)",
            b: "B급 (사용감)",
            c: "C급 (파손)",
            d: "D급 (폐폰)"
        };
        const gradeName = gradeNames[currentQuote.grade] || currentQuote.grade;

        let breakdownHtml = `
    <p><strong>선택하신 등급:</strong> <span style="color:var(--primary-color)">${gradeName}</span></p>
            <p>등급 기본가: <strong>${formatCurrency(baseGradePrice)}</strong></p>
            <p>용량 옵션 (${currentQuote.storage.size}): ${storageAdj > 0 ? '+' : ''}${formatCurrency(storageAdj)}</p>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
        `;

        finalPrice = Math.floor(finalPrice / 1000) * 1000;
        if (finalPrice < 0) finalPrice = 0;
        currentQuote.finalPrice = finalPrice;
        document.getElementById('result-model-name').textContent = `${currentQuote.model.model} (${currentQuote.storage.size})`;
        
        let priceDisplayStr = formatCurrency(finalPrice);
        const gradeToCheck = (currentQuote.grade || '').toLowerCase();
        let multiplier = 0;
        if (gradeToCheck === 'a') multiplier = 1.1;
        else if (gradeToCheck === 'b') multiplier = 1.2;
        else if (!['sealed', 's'].includes(gradeToCheck)) multiplier = 1.5;

        if (multiplier > 0) {
            priceDisplayStr += ' ~ ' + formatCurrency(Math.floor(finalPrice * multiplier));
        }
        document.getElementById('final-price-display').textContent = priceDisplayStr;

        document.getElementById('price-breakdown').innerHTML = breakdownHtml;
    }

    
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
                const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
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
                }
                
                window.trackFunnel("quote_complete");

                // --- 배송 방법 확정 텔레그램 알림 ---
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


    window.executeFinalSubmit = async function() {
        const btnSubmit = document.getElementById('btn-submit-final');
        const name = document.getElementById('auth-name').value;
        const phone = document.getElementById('auth-phone').value;
        const address = document.getElementById('customer-address').value;
        const bankName = document.getElementById('customer-bank') ? document.getElementById('customer-bank').value : '';
        const accountNum = document.getElementById('customer-account').value;
        const account = bankName ? `${bankName} ${accountNum}` : accountNum;
        const memo = document.getElementById('customer-memo') ? document.getElementById('customer-memo').value : '';

        let deliveryMethod = currentQuote.deliveryMethod;
        if (!deliveryMethod) {
            const activeBtn = document.querySelector('.method-btn.active');
            if (activeBtn) deliveryMethod = activeBtn.dataset.method;
            else deliveryMethod = 'courier';
        }

        let pickupDate = '';
        if (deliveryMethod === 'courier') {
            const pickupElem = document.getElementById('courier-pickup-date');
            if (pickupElem) pickupDate = pickupElem.value;
        }

        if (!name || !phone) {
            alert("이름과 연락처를 입력해주세요.");
            return;
        }

        const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);
        if (needsAddress && !address) {
            alert("수거를 위해 주소를 입력해주세요.");
            return;
        }

        if (!account) {
            alert("정산을 위해 계좌 정보를 입력해주세요.");
            return;
        }

        btnSubmit.textContent = '처리 중...';
        btnSubmit.disabled = true;

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
            customerAddress: needsAddress ? address : '편의점/직접 택배 발송',
            deliveryMethod: deliveryMethod,
            pickupDate: pickupDate,
            customerAccount: account,
            customerMemo: memo,

            userId: (() => {
                try {
                    const localUser = JSON.parse(localStorage.getItem('user_info'));
                    if (localUser && localUser.uid) return localUser.uid;
                } catch(e) {}
                if (auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
                return 'anonymous';
            })(),



            firebaseTimestamp: serverTimestamp(),



            method: currentQuote.method || 'simple',



            defectsDetails: currentQuote.defectsDetails || {},
            trafficSource: sessionStorage.getItem('traffic_source') || 'direct'
        };







        try {



            if (!auth.currentUser) {



                await signInAnonymously(auth);



            }



            await addDoc(collection(db, "quotes"), payload);
            window.trackFunnel("quote_complete");

            // --- Alimtalk Trigger (방문택배 or 직접발송) ---
            if (window.triggerFrontendAlimtalk) {
                if (payload.deliveryMethod === 'courier') {
                    window.triggerFrontendAlimtalk("quote_courier", payload.customerPhone, {
                        name: payload.customerName,
                        pickupDate: payload.pickupDate,
                        email: payload.userId !== 'anonymous' ? '인증된 계정' : '미인증',
                        address: payload.customerAddress
                    });
                } else if (payload.deliveryMethod === 'cvs') {
                    window.triggerFrontendAlimtalk("quote_cvs", payload.customerPhone, {});
                }
            }

            // --- NAVER 신청완료(lead) SCRIPT ---
            if(window.wcs){
                window.wcs_add = window.wcs_add || {};
                window.wcs_add['wa'] = 's_bfc3561d569';
                var _conv = {};
                _conv.type = 'lead';
                wcs.trans(_conv);
            }

            // --- DAANGN(Karrot) 신청완료 SCRIPT ---
            if(window.karrotPixel) {
                window.karrotPixel.track('SubmitApplication');
            }

            // --- GA4 Event Tracking: Quote Completed ---
            if (typeof gtag !== 'undefined') {

                gtag('event', 'quote_completed', {

                    'event_category': 'quote',

                    'event_label': payload.modelName || 'Unknown Model',

                    'value': payload.expectedPrice || 0
                });

                const isIphone = (payload.brand && payload.brand.toLowerCase() === 'apple') || 
                                 (payload.series && payload.series.includes('아이폰')) ||
                                 (payload.model && payload.model.includes('아이폰'));
                const isSamsung = (payload.brand && payload.brand.toLowerCase() === 'samsung') || 
                                  (payload.brand === '삼성') || 
                                  (payload.series && payload.series.includes('갤럭시')) ||
                                  (payload.model && payload.model.includes('갤럭시'));

                // --- Google Ads Conversion Tracking (아이폰/삼성 개별) ---
                if (isIphone) {
                    console.log("🔥 [Google Ads] 아이폰 매입 신청 전환 발생 (QL8CCL-Ur68cEIK6p6FD)");
                    gtag('event', 'conversion', {
                        'send_to': 'AW-18055027970/QL8CCL-Ur68cEIK6p6FD',
                        'value': payload.price || payload.expectedPrice || 1.0,
                        'currency': 'KRW',
                        'transaction_id': payload.orderId || ''
                    });
                } else if (isSamsung) {
                    console.log("🔥 [Google Ads] 삼성(갤럭시) 매입 신청 전환 발생 (EYqmCNfnrq8cEIK6p6FD)");
                    gtag('event', 'conversion', {
                        'send_to': 'AW-18055027970/EYqmCNfnrq8cEIK6p6FD',
                        'value': payload.price || payload.expectedPrice || 1.0,
                        'currency': 'KRW',
                        'transaction_id': payload.orderId || ''
                    });
                } else {
                    console.log("⚠️ [Google Ads] 전환 트리거 스킵됨 - 알 수 없는 브랜드:", payload.brand);
                }
            }



            fetch(GOOGLE_SCRIPT_URL, {



                method: 'POST',



                headers: { 'Content-Type': 'text/plain' },



                body: JSON.stringify(payload)



            }).catch(e => console.log("GAS Error ignored:", e));







            // --- Send Telegram Notification ---



            const tgMessage = `



🔔 *새로운 매입 신청 알림*



━━━━━━━━━━━━━━



👤 *신청자*: ${payload.customerName}



📞 *연락처*: ${payload.customerPhone}



📱 *모델*: ${payload.brand} ${payload.model} (${payload.storage})



💎 *등급*: ${payload.grade}



💰 *예상가*: ${new Intl.NumberFormat('ko-KR').format(payload.price)}원



🚚 *방식*: ${payload.deliveryMethod === 'courier' ? '택배 방문수거 (희망일: ' + payload.pickupDate + ')' : '편의점 택배'}



📝 *메모*: ${payload.customerMemo || '없음'}



━━━━━━━━━━━━━━



            `.trim();



            fetch(`https://asia-northeast3-rejeuphone.cloudfunctions.net/telegramApi/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: tgMessage })
            }).catch(e => console.error("Telegram Notification Error:", e));







            // Update Success Message



            const successDiv = document.getElementById('success-instruction');



            let msgTitle = "";



            let msgDesc = "";







            if (deliveryMethod === 'courier' || deliveryMethod === 'pickup') {



                msgTitle = "📦 택배 방문수거 접수 완료";



                msgDesc = "문 앞에 박스를 두시면 기사님이 수거해 갈 예정입니다. (1~2일 내)";



            } else if (deliveryMethod === 'cvs') {
                msgTitle = "🏪 편의점/직접 택배 안내";
                msgDesc = "아래 주소로 기기를 발송해 주세요.";
            }







            successDiv.innerHTML = `



                <h4 style="color: #2196F3; margin-bottom: 10px;">${msgTitle}</h4>



                <p>${msgDesc}</p>



                <div style="background: white; padding: 15px; border: 1px solid #ddd; border-radius: 6px; margin: 10px 0; font-size: 0.95rem; line-height: 1.6;">
                    받는 이: <strong>쉐라폰</strong><br>
                    주소: <strong>부산시 부산진구 동천로 116 한신밴빌딩 1003호</strong><br>
                    연락처: <span style="color: #666;">010-3263-5672</span>
                </div>



                <p style="font-size: 0.9rem; color: #666;">* 마이페이지에서 진행 상황을 확인하실 수 있습니다.</p>



            `;







            if (typeof gtag !== 'undefined') {



                gtag('event', 'generate_lead', {



                    'event_category': 'Quote',



                    'event_label': `${payload.brand} ${payload.model}`,



                    'value': payload.price,



                    'currency': 'KRW'



                });



            }







            goToStep(8); // Success Step



        } catch (e) {



            console.error("Submit Error:", e);



            alert("제출 실패: " + e.message);



            btnSubmit.textContent = '신청 완료하기';



            btnSubmit.disabled = false;



        }



    }



}







// ------------------------------------------------------------------



// ------------------------------------------------------------------



// 4. Reviews Logic



// ------------------------------------------------------------------







let currentReviewPage = 1;



const reviewsPerPage = 5;



let allReviewsData = [];







// Call initReviews if on reviews page



if (document.getElementById('reviews-list')) {



    initReviews();



}







async function loadRecentReviewsForHomepage() {



    const listContainer = document.getElementById('homepage-recent-reviews');



    if (!listContainer) return;







    try {



        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(3));



        const querySnapshot = await getDocs(q);







        if (querySnapshot.empty) {



            listContainer.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 40px; color: #888;">아직 등록된 후기가 없습니다. 첫 후기의 주인공이 되어주세요!</div>';



            return;



        }







        listContainer.innerHTML = ''; // Clear loading text







        querySnapshot.forEach((docSnapshot) => {



            const data = docSnapshot.data();



            const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '') : '';



            const rating = data.rating || 5;



            const stars = '⭐'.repeat(rating);







            // Mask Name (e.g., 홍**님)



            let safeName = data.userName || '익명';



            if (safeName.length > 1 && safeName !== '익명') {



                safeName = safeName.substring(0, 1) + '*'.repeat(safeName.length > 2 ? 2 : 1) + '님';



            }







            // Shorten text if too long



            let safeText = data.text || '';



            if (safeText.length > 60) {



                safeText = safeText.substring(0, 60) + '...';



            }







            // Format device info



            let deviceStr = '';



            if (data.deviceModel) {



                deviceStr = data.deviceModel;



                if (data.deviceStorage) deviceStr += ` ${data.deviceStorage}`;



            }







            // Fallback image if no uploaded image exists



            let imageHtml = '';



            if (data.imageUrl) {



                imageHtml = `<div class="home-review-img-box"><img src="${data.imageUrl}" class="home-review-img" alt="리뷰 이미지"></div>`;



            }







            const card = document.createElement('div');



            card.className = 'home-review-card';



            card.innerHTML = `



                <div class="home-review-header">



                    <span class="home-review-device">${deviceStr}</span>



                    <span class="home-review-stars">${stars}</span>



                </div>



                <div class="home-review-body">



                    <p class="home-review-text">"${safeText.replace(/\n/g, '<br>')}"</p>



                </div>



                <div class="home-review-footer">



                   ${imageHtml}



                   <div style="flex-grow: 1;"></div>



                   <span class="home-review-date">${dateStr}</span>



                   <span class="home-review-author">${safeName}</span>



                </div>



            `;



            listContainer.appendChild(card);



        });







    } catch (e) {



        console.error("Error loading homepage reviews:", e);



        listContainer.innerHTML = `<div class="text-center" style="grid-column: 1/-1; padding: 40px; color: red;">후기를 불러오지 못했습니다.</div>`;



    }



}







function initReviews() {



    const btnShowForm = document.getElementById('btn-show-form');



    const reviewForm = document.getElementById('review-form'); // Renamed from formContainer



    const btnCancel = document.getElementById('btn-cancel-review');



    const btnSubmit = document.getElementById('btn-submit-review');



    const reviewList = document.getElementById('reviews-list'); // Added for consistency



    const imageInput = document.getElementById('review-image-input');



    const imagePreview = document.getElementById('review-image-preview');







    if (!btnShowForm || !reviewForm || !btnSubmit || !btnCancel || !reviewList) {



        console.log("Reviews DOM elements not found.");



        return;



    }







    // Image Preview Logic



    if (imageInput && imagePreview) {



        imageInput.addEventListener('change', function () {



            const file = this.files[0];



            if (file) {



                const reader = new FileReader();



                reader.onload = function (e) {



                    imagePreview.src = e.target.result;



                    imagePreview.style.display = 'block';



                }



                reader.readAsDataURL(file);



            } else {



                imagePreview.src = '#';



                imagePreview.style.display = 'none';



            }



        });



    }







    // Load initial reviews



    loadReviews();







    // Show form button logic



    if (btnShowForm) {

        btnShowForm.style.display = 'inline-block';

    }



    onAuthStateChanged(auth, (user) => {

        // Button is now always visible regardless of login status

    });







    // Toggle Form

    btnShowForm.onclick = async () => {



        let currentUser = auth.currentUser;

        let localUser = null;

        const localUserStr = localStorage.getItem('user_info');

        if (localUserStr) {

            try {

                localUser = JSON.parse(localUserStr);

            } catch (e) { }

        }



        if (!currentUser && !localUser) {

            alert("로그인이 필요합니다.\n매입이 완료된 고객만 후기를 작성하실 수 있습니다.");

            window.location.href = 'login.html';

            return;

        }



        let isAdmin = false;

        let currentUserEmail = currentUser ? currentUser.email : (localUser ? localUser.email : null);

        

        if (currentUserEmail && await checkIsAdmin(currentUserEmail)) {

            isAdmin = true;

        }



        if (!isAdmin) {

            // Check if user has at least one completed quote

            try {

                // If the user submitted via kakao/naver, they might have an anonymous Firebase session

                // BUT if they cleared cache, the anonymous session is lost, although localUser might be restored if they log in again.

                // However, quotes are usually saved with auth.currentUser.uid or 'anonymous'.

                // If they have auth.currentUser (anonymous or email), check currentUser.uid.

                // If they don't have auth.currentUser but have localUser, check localUser.uid.

                let searchUid = currentUser ? currentUser.uid : localUser.uid;



                let q = query(collection(db, "quotes"), where("userId", "==", searchUid), where("status", "==", "입금완료"));

                let querySnapshot = await getDocs(q);



                // Fallback: Check if they have auth.currentUser AND localUser, and check both UIDs just in case

                if (querySnapshot.empty && currentUser && localUser && currentUser.uid !== localUser.uid) {

                    q = query(collection(db, "quotes"), where("userId", "==", localUser.uid), where("status", "==", "입금완료"));

                    querySnapshot = await getDocs(q);

                }



                if (querySnapshot.empty) {

                    alert("매입이 완료된 고객만 후기를 작성하실 수 있습니다.");

                    return;

                }

            } catch (error) {

                console.error("Error checking quote status:", error);

                alert("작성 권한을 확인하는 중 오류가 발생했습니다.");

                return;

            }

        }



        reviewForm.classList.remove('hidden');

        btnShowForm.classList.add('hidden');

    };







    btnCancel.addEventListener('click', () => {



        reviewForm.classList.add('hidden');



        btnShowForm.classList.remove('hidden');



        // Clear image preview on cancel



        if (imageInput) imageInput.value = '';



        if (imagePreview) {



            imagePreview.src = '#';



            imagePreview.style.display = 'none';



        }



    });







    // Submit Review (use onclick to prevent duplicate bindings)



    btnSubmit.onclick = submitReview;



}







async function loadReviews() {



    const listContainer = document.getElementById('reviews-list');







    try {



        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(25)); // Show max 5 pages (5 reviews per page)



        const querySnapshot = await getDocs(q);







        allReviewsData = [];



        querySnapshot.forEach((docSnapshot) => {



            allReviewsData.push({ id: docSnapshot.id, ...docSnapshot.data() });



        });







        if (allReviewsData.length === 0) {



            listContainer.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 40px;">첫 번째 후기의 주인공이 되어보세요!</div>';



            const paginationContainer = document.getElementById('pagination-container');



            if (paginationContainer) paginationContainer.innerHTML = '';



            return;



        }







        renderReviews(currentReviewPage);







    } catch (e) {



        console.error("Error loading reviews:", e);



        listContainer.innerHTML = `<div class="text-center" style="color:red;">후기를 불러오지 못했습니다.<br>${e.message}</div>`;



    }



}







async function renderReviews(page) {



    const listContainer = document.getElementById('reviews-list');



    const currentUser = auth.currentUser;







    listContainer.innerHTML = '';







    const startIndex = (page - 1) * reviewsPerPage;



    const endIndex = startIndex + reviewsPerPage;



    const paginatedReviews = allReviewsData.slice(startIndex, endIndex);







    paginatedReviews.forEach(async (data) => {



        const docId = data.id;



        const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '날짜 없음'; // Changed to createdAt



        const rating = data.rating || 5; // Default to 5 if not set



        const stars = '⭐'.repeat(rating); // Simple star repeat



        const safeText = data.text || ''; // Changed content to text



        const safeName = data.userName || '익명'; // Restore the missing variable
        let displayTitle = safeName; // Default to user name







        if (data.deviceModel || data.deviceStorage || data.transactionPrice) {



            const parts = [];



            if (data.deviceModel) parts.push(data.deviceModel);



            if (data.deviceStorage) parts.push(`(${data.deviceStorage})`);



            const deviceStr = parts.join(' ');







            if (data.transactionPrice) {



                // Formatting: "John Doe | iPhone 13 (256GB) - 55만원"



                displayTitle = `${safeName} <span style="font-weight: normal; font-size: 0.85rem; color: #666;">| ${deviceStr} - ${data.transactionPrice}</span>`;



            } else {



                displayTitle = `${safeName} <span style="font-weight: normal; font-size: 0.85rem; color: #666;">| ${deviceStr}</span>`;



            }



        }







        const imageHtml = data.imageUrl ? `



            <div class="review-image-container">



                <img src="${data.imageUrl}" class="review-image" alt="Review Image">



            </div>` : '';







        // Edit and Delete buttons if current user is owner or admin



        let actionBtns = '';
        const isAdmin = currentUser && currentUser.email && await checkIsAdmin(currentUser.email);







        // Auto-fix "번개톡" to "상담톡" if user is admin



        if (isAdmin && typeof safeText === 'string' && safeText.includes('번개톡')) {



            const updatedText = safeText.replace(/번개톡/g, '상담');







            // Background update



            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ updateDoc, doc, getFirestore }) => {



                const db = getFirestore();



                updateDoc(doc(db, "reviews", docId), { text: updatedText }).then(() => {



                    console.log("Auto-fixed 번개톡 -> 상담 for", docId);



                }).catch(e => console.error("Auto-fix failed:", e));



            });



            // Update UI optimistically



            data.text = updatedText;



        }







        if (currentUser && (currentUser.uid === data.userId || isAdmin)) { // Changed uid to userId or Admin



            actionBtns = `



            <div style="margin-top:10px; display:flex; gap:10px;">



                <button onclick="editReview('${docId}')" style="font-size:0.8rem; color:#4a90e2; border:none; background:none; cursor:pointer;">수정</button>



                <button onclick="deleteReview('${docId}')" style="font-size:0.8rem; color:#e74c3c; border:none; background:none; cursor:pointer;">삭제</button>



            </div>`;



        }







        const card = document.createElement('div');



        card.className = 'review-card';



        card.innerHTML = `



            ${imageHtml}



            <div class="review-card-content">



                <div class="review-header">



                    <span class="user-name">${displayTitle}</span>



                    <span class="review-date">${dateStr}</span>



                </div>



                <div class="rating">${stars}</div>



                <div class="review-content">${(data.text || '').replace(/\n/g, '<br>')}</div>



                ${actionBtns}



            </div>



        `;



        listContainer.appendChild(card);



    });







    renderPagination();



}







function renderPagination() {



    const paginationContainer = document.getElementById('pagination-container');



    if (!paginationContainer) return;







    paginationContainer.innerHTML = '';



    const totalPages = Math.ceil(allReviewsData.length / reviewsPerPage);







    if (totalPages <= 1) return; // No need for pagination if only 1 page







    // Previous Button



    const prevBtn = document.createElement('button');



    prevBtn.className = 'page-btn';



    prevBtn.textContent = '이전';



    prevBtn.disabled = currentReviewPage === 1;



    prevBtn.onclick = () => {



        if (currentReviewPage > 1) {



            goToReviewPage(currentReviewPage - 1);



        }



    };



    paginationContainer.appendChild(prevBtn);







    // Page Numbers



    let startPage = Math.max(1, currentReviewPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    if (endPage - startPage < 2 && startPage > 1) {
        startPage = Math.max(1, endPage - 2);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentReviewPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => goToReviewPage(i);
        paginationContainer.appendChild(pageBtn);
    }







    // Next Button



    const nextBtn = document.createElement('button');



    nextBtn.className = 'page-btn';



    nextBtn.textContent = '다음';



    nextBtn.disabled = currentReviewPage === totalPages;



    nextBtn.onclick = () => {



        if (currentReviewPage < totalPages) {



            goToReviewPage(currentReviewPage + 1);



        }



    };



    paginationContainer.appendChild(nextBtn);



}







window.goToReviewPage = (page) => {
    currentReviewPage = page;
    renderReviews(page);
}

// --- Courier Pickup Date Initialization & Toggle ---

// Duplicate funnel analytics block removed

document.addEventListener('DOMContentLoaded', () => {

    const dateSelect = document.getElementById('courier-pickup-date');
    if (dateSelect) {
        const validDates = [];
        let currentDate = new Date();
        
        // 일요일(0)을 제외하고 가장 빠른 2일 찾기
        while (validDates.length < 2) {
            currentDate.setDate(currentDate.getDate() + 1);
            if (currentDate.getDay() !== 0) { 
                validDates.push(new Date(currentDate));
            }
        }
        
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const formatOption = (date) => {
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const d = date.getDate().toString().padStart(2, '0');
            const dayName = dayNames[date.getDay()];
            return `<option value="${m}/${d}">${m}/${d} (${dayName})</option>`;
        };
        
        dateSelect.innerHTML = formatOption(validDates[0]) + formatOption(validDates[1]);
    }

    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            
            const method = target.dataset.method;
            const courierBlock = document.getElementById('method-courier-date');
            const cvsBlock = document.getElementById('method-cvs-info');
            
            if (method === 'courier') {
                if(courierBlock) courierBlock.style.display = 'block';
                if(cvsBlock) cvsBlock.style.display = 'none';
            } else if (method === 'cvs') {
                if(courierBlock) courierBlock.style.display = 'none';
                if(cvsBlock) cvsBlock.style.display = 'block';
            }
        });
    });
});








async function submitReview() {



    const currentUser = auth.currentUser; // Renamed user to currentUser



    if (!currentUser) {



        alert("로그인이 필요합니다.");



        window.location.href = 'login.html';



        return;



    }







    const text = document.getElementById('review-text').value.trim(); // Renamed content to text







    // New Fields



    const modelInput = document.getElementById('review-model');



    const storageInput = document.getElementById('review-storage');



    const priceInput = document.getElementById('review-price');



    const nameInput = document.getElementById('review-user-name');



    const deviceModel = modelInput ? modelInput.value.trim() : "";



    const deviceStorage = storageInput ? storageInput.value.trim() : "";



    const transactionPrice = priceInput ? priceInput.value.trim() : "";



    const customUserName = nameInput ? nameInput.value.trim() : "";







    const imageInput = document.getElementById('review-image-input');



    const imagePreview = document.getElementById('review-image-preview');



    const btnSubmit = document.getElementById('btn-submit-review');



    const reviewForm = document.getElementById('review-form');



    const btnShowForm = document.getElementById('btn-show-form');











    if (text.length < 5) {



        alert("후기 내용은 최소 5자 이상 작성해주세요.");



        return;



    }







    // Get rating from radio buttons



    const ratingInput = document.querySelector('input[name="rating"]:checked');



    const rating = ratingInput ? parseInt(ratingInput.value) : 5;







    // Start Submit Progress



    btnSubmit.disabled = true;



    btnSubmit.textContent = '등록 중...';







    try {



        let imageUrl = null;







        // 1. Upload Image if present



        if (imageInput && imageInput.files.length > 0) {



            try {



                const file = imageInput.files[0];



                const storageRef = ref(storage, `reviews/${Date.now()}_${file.name}`);







                btnSubmit.textContent = '사진 업로드 중...';



                const uploadTask = await uploadBytesResumable(storageRef, file);







                btnSubmit.textContent = 'URL 가져오는 중...';



                imageUrl = await getDownloadURL(uploadTask.ref);



            } catch (uploadError) {



                console.error("Image upload failed:", uploadError);



                // Inform user but continue saving rest of data



                alert("사진 업로드 권한이 없어 텍스트 내용만 저장됩니다. (Firebase Storage 요금제 필요)");



                imageUrl = null;



            }



        }







        // 2. Save to Firestore



        const reviewData = {



            deviceModel: deviceModel,



            deviceStorage: deviceStorage,



            transactionPrice: transactionPrice,



            rating: rating,



            text: text,



            // Keep existing imageUrl, update if a new image was uploaded



            updatedAt: serverTimestamp()



        };







        // Include specific fields only when creating



        if (!window.currentEditReviewId) {



            reviewData.userId = currentUser.uid;



            reviewData.userEmail = currentUser.email;



            reviewData.userName = customUserName || currentUser.displayName || currentUser.email.split('@')[0];



            reviewData.createdAt = serverTimestamp();



            reviewData.imageUrl = imageUrl;



        } else {



            if (customUserName) {



                reviewData.userName = customUserName;



            }



            if (imageUrl !== null) {



                // Only update imageUrl if a new image was explicitly uploaded



                reviewData.imageUrl = imageUrl;



            }



        }







        if (window.currentEditReviewId) {



            btnSubmit.textContent = '데이터 수정 중...';



            await updateDoc(doc(db, "reviews", window.currentEditReviewId), reviewData);



            alert("후기가 수정되었습니다!");



        } else {



            btnSubmit.textContent = '데이터 저장 중...';



            await addDoc(collection(db, "reviews"), reviewData);



            alert("소중한 후기 감사합니다!");



        }







        // Reset Form Complete



        window.currentEditReviewId = null;



        document.getElementById('review-text').value = '';



        if (modelInput) modelInput.value = '';



        if (storageInput) storageInput.value = '';



        if (priceInput) priceInput.value = '';



        if (nameInput) nameInput.value = '';







        const star5 = document.getElementById('star5');



        if (star5) star5.checked = true;







        if (imageInput) imageInput.value = '';



        if (imagePreview) {



            imagePreview.src = '#';



            imagePreview.style.display = 'none';



        }







        reviewForm.classList.add('hidden');



        btnShowForm.classList.remove('hidden'); // Show the "Write Review" button again







        btnSubmit.textContent = '등록하기';



        btnSubmit.disabled = false;







        currentReviewPage = 1;



        loadReviews(); // Refresh list







    } catch (e) {



        console.error("Submit review error:", e);



        alert("후기 등록 실패: " + e.message);



        btnSubmit.textContent = '등록하기';



        btnSubmit.disabled = false;



        window.currentEditReviewId = null;



    }



}







// Global function to edit a review



window.editReview = async (docId) => {



    try {



        const docRef = doc(db, "reviews", docId);



        const docSnap = await getDoc(docRef);







        if (docSnap.exists()) {



            const data = docSnap.data();







            // Populate form



            document.getElementById('review-text').value = data.text || '';







            const modelInput = document.getElementById('review-model');



            if (modelInput) modelInput.value = data.deviceModel || '';



            const storageInput = document.getElementById('review-storage');



            if (storageInput) storageInput.value = data.deviceStorage || '';



            const priceInput = document.getElementById('review-price');



            if (priceInput) priceInput.value = data.transactionPrice || '';



            const nameInput = document.getElementById('review-user-name');



            if (nameInput) nameInput.value = data.userName || '';







            const rating = data.rating || 5;



            const starInput = document.getElementById(`star${rating}`);



            if (starInput) starInput.checked = true;







            // Show form



            const reviewForm = document.getElementById('review-form');



            const btnShowForm = document.getElementById('btn-show-form');



            reviewForm.classList.remove('hidden');



            btnShowForm.classList.add('hidden');







            // Re-focus and update btn text



            document.getElementById('review-text').focus();



            const btnSubmit = document.getElementById('btn-submit-review');



            btnSubmit.textContent = '수정 완료';







            // Set global tracking variable



            window.currentEditReviewId = docId;



        } else {



            console.log("No such document!");



            alert("후기 정보를 불러올 수 없습니다.");



        }



    } catch (error) {



        console.error("Error fetching review for edit:", error);



    }



};







// Make deleteReview global so onclick works



window.deleteReview = async (docId) => {



    if (!confirm("정말 이 후기를 삭제하시겠습니까?")) return;







    try {



        await deleteDoc(doc(db, "reviews", docId));



        alert("삭제되었습니다.");



        currentReviewPage = 1;



        loadReviews();



    } catch (e) {



        console.error("Delete error:", e);



        alert("삭제 실패: " + e.message);



    }



};







// ------------------------------------------------------------------



// Global Modal Functions



// ------------------------------------------------------------------



window.openTermsModal = function() {



    const modal = document.getElementById('termsModal');



    if (modal) {



        modal.style.display = 'flex';



    }



};







window.closeTermsModal = function() {



    const modal = document.getElementById('termsModal');



    if (modal) {



        modal.style.display = 'none';



    }



};







// Close modal when clicking outside



window.addEventListener('click', function(e) {



    const modal = document.getElementById('termsModal');



    if (e.target === modal) {



        closeTermsModal();



    }



});



// --- GA4 Event Tracking Setups ---


// Duplicate funnel analytics block removed

document.addEventListener('DOMContentLoaded', () => {


    // 1. Phone Call Clicks

    document.querySelectorAll('a[href^="tel:"]').forEach(link => {

        link.addEventListener('click', () => {

            if (typeof gtag !== 'undefined') {

                gtag('event', 'click_contact', {

                    'event_category': 'engagement',

                    'event_label': 'Phone Call Button'

                });

            }

        });

    });



    // 2. Price List Page View

    if (window.location.pathname.includes('price-list.html')) {

        if (typeof gtag !== 'undefined') {

            gtag('event', 'view_price_list', {

                'event_category': 'engagement',

                'event_label': 'Price List Page'

            });

        }

    }

    

    // 3. Channel Talk Open

    if (window.ChannelIO) {

        window.ChannelIO('onShowMessenger', function() {

            if (typeof gtag !== 'undefined') {

                gtag('event', 'click_contact', {

                    'event_category': 'engagement',

                    'event_label': 'Channel Talk'

                });

            }

        });

    }


    window.actuallySubmitQuote = window.executeFinalSubmit;

// --- Pre-sale Agreement Modal Handlers ---
    window.openPresaleModal = () => {
        const modal = document.getElementById('presale-modal');
        if (modal) {
            modal.style.display = 'flex';
            if (window.presaleShowStep) window.presaleShowStep(1);
        }
    };

    window.closePresaleModal = () => {
        const modal = document.getElementById('presale-modal');
        if (modal) modal.style.display = 'none';

        // Reset state inside the modal for next time
        setTimeout(() => {
            if (window.presaleShowStep) window.presaleShowStep(1);
        }, 300);
    };

    window.presaleShowStep = (step) => {
        const isApple = (currentQuote.brand === 'apple');

        if (step === 1) {
            if (isApple) {
                document.getElementById('presale-step-1-apple').style.display = 'block';
                document.getElementById('presale-step-1-samsung').style.display = 'none';
            } else {
                document.getElementById('presale-step-1-apple').style.display = 'none';
                document.getElementById('presale-step-1-samsung').style.display = 'block';
            }
            document.getElementById('presale-step-2').style.display = 'none';
            document.getElementById('p-btn-prev').style.display = 'none';
            document.getElementById('p-btn-next').textContent = '동의 후 다음';
            document.getElementById('p-dot-1').classList.add('active');
            document.getElementById('p-dot-2').classList.remove('active');
        } else {
            document.getElementById('presale-step-1-apple').style.display = 'none';
            document.getElementById('presale-step-1-samsung').style.display = 'none';
            document.getElementById('presale-step-2').style.display = 'block';
            document.getElementById('p-btn-prev').style.display = 'block';
            document.getElementById('p-btn-next').textContent = '동의 후 최종 신청완료';
            document.getElementById('p-dot-1').classList.remove('active');
            document.getElementById('p-dot-2').classList.add('active');
        }
    };

    window.presaleGoNext = () => {
        if (document.getElementById('presale-step-2').style.display === 'block') {
            window.closePresaleModal();
            if (window.executeFinalSubmit) {
                window.executeFinalSubmit(); // Trigger final submission!
            } else {
                alert('제출 처리 함수에 접근할 수 없습니다.');
            }
        } else {
            window.presaleShowStep(2);
        }
    };

    window.presaleGoPrev = () => {
        window.presaleShowStep(1);
    };
});

// Expose currentQuote globally for the modal
window.currentQuote = currentQuote;

// --- Global Site Settings ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const fill = (id, text) => { 
                const els = document.querySelectorAll(id);
                els.forEach(el => el.innerText = text);
            };

            if (data.heroTitle) fill('#dyn-hero-title, .dyn-hero-title', data.heroTitle);
            if (data.heroSubtitle) fill('#dyn-hero-subtitle, .dyn-hero-subtitle', data.heroSubtitle);
            if (data.siteName) fill('#dyn-company-name, .dyn-company-name', data.siteName);
            if (data.siteCeo) fill('#dyn-ceo-name, .dyn-ceo-name, #dyn-ceo-name2', data.siteCeo);
            if (data.siteAddress) {
                if (data.siteAddress.includes("전포동") || data.siteAddress.includes("더블루2") || data.siteAddress.includes("47247")) {
                    data.siteAddress = "부산시 동천로 116 한신밴빌딩 1003호";
                }
                fill('#dyn-address, .dyn-address', data.siteAddress);
            }
            if (data.sitePhone) fill('#dyn-phone, .dyn-phone, #dyn-phone2', data.sitePhone);
            if (data.siteEmail) fill('#dyn-email, .dyn-email', data.siteEmail);
            if (data.siteBizNumber) fill('#dyn-biz-number, .dyn-biz-number', data.siteBizNumber);

        }
    } catch (e) {
        console.error("Failed to fetch global site settings:", e);
    }
});

// --- Global Popup Logic ---
document.addEventListener('DOMContentLoaded', async () => {
    // Check if we are on index.html (or root '/')
    const path = window.location.pathname;
    const isHomePage = path.endsWith('index.html') || path === '/' || path.length === 0;
    
    if(!isHomePage) return;

    const hideUntil = localStorage.getItem('hidePopupUntil');
    if (hideUntil && new Date().getTime() < parseInt(hideUntil, 10)) {
        return; // User clicked "Do not show today" and it is still valid
    }

    try {
        const docRef = doc(db, "settings", "popup");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.isActive) {
                const titleEl = document.getElementById('global-popup-title');
                const contentEl = document.getElementById('global-popup-content');
                const linkBtn = document.getElementById('global-popup-link-btn');
                const btnContainer = document.getElementById('global-popup-btn-container');
                const closeBtn = document.getElementById('global-popup-close-btn');
                
                if (titleEl) titleEl.innerText = data.title || '';
                if (contentEl) contentEl.innerHTML = (data.content || '').replace(/\n/g, '<br>');
                if (closeBtn) closeBtn.innerText = data.closeText || '오늘 하루 보지 않기';
                
                if (data.link && data.link.trim() !== '') {
                    btnContainer.style.display = 'flex';
                    linkBtn.innerText = data.linkText || '자세히 보기';
                    linkBtn.onclick = () => { window.location.href = data.link.trim(); };
                } else {
                    btnContainer.style.display = 'none';
                }
                
                const overlay = document.getElementById('global-popup-overlay');
                const popup = document.getElementById('global-popup');
                
                if (overlay && popup) {
                    overlay.style.display = 'block';
                    popup.style.display = 'flex';
                    
                    // Trigger reflow
                    void popup.offsetWidth;
                    
                    overlay.style.opacity = '1';
                    popup.style.opacity = '1';
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch global popup data:", e);
    }
});

// Added for individual shipping notification
window.notifyDispatch = async function(docId) {
    const trackingNumber = prompt("택배 발송을 완료하셨나요?\\n원활한 확인을 위해 운송장 번호를 입력해 주세요.\\n(입력을 생략하고 확인을 누르셔도 발송 완료 처리가 됩니다.)", "");
    if (trackingNumber === null) return; // User cancelled
    
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const docRef = doc(db, "quotes", docId);
        
        let updateData = { status: 'pickup' };
        if (trackingNumber.trim() !== '') {
            updateData.trackingNumber = trackingNumber.trim();
        }
        
        await updateDoc(docRef, updateData);
        alert("발송 알림이 성공적으로 처리되었습니다. (상태가 '수거중'으로 변경됩니다.)");
        
        location.reload();
    } catch(e) {
        console.error("Failed to update dispatch status:", e);
        alert("처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
};

window.initPriceList = initPriceList;


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
