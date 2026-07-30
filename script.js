import { db, auth, getStorageLazy } from './firebase-config.js';



import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, serverTimestamp, where, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";



import { onAuthStateChanged, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";



import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";







const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzyJ7SJmjqF0mNABE3TE7Xo-A7EPXgfhHc2mxebVzfSwDGqTJ3dhasTXB7pjNTCOmTr/exec";



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

// XSS 방지: 사용자 입력을 HTML에 넣기 전 특수문자 이스케이프
function escapeHtml(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// --- products 캐시: 메모리 + sessionStorage (중복 Firestore 조회 제거) ---
// 한 세션에서 products 전체를 1번만 읽고, 페이지 이동(홈→견적)에도 재사용.
async function getProductsData() {
    // 1) 메모리 (같은 페이지 내)
    if (Array.isArray(allProducts) && allProducts.length) return allProducts;
    // 2) sessionStorage (같은 탭의 페이지 이동에도 유지, 15분 TTL)
    try {
        const raw = sessionStorage.getItem('sr_products_cache');
        const ts = parseInt(sessionStorage.getItem('sr_products_cache_ts') || '0', 10);
        if (raw && (Date.now() - ts) < 15 * 60 * 1000) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length) { allProducts = arr; return allProducts; }
        }
    } catch (e) {}
    // 3) Firestore에서 새로 조회
    const snapshot = await getDocs(query(collection(db, "products")));
    const arr = [];
    snapshot.forEach(d => arr.push({ id: d.id, ...d.data() }));
    allProducts = arr;
    try {
        sessionStorage.setItem('sr_products_cache', JSON.stringify(arr));
        sessionStorage.setItem('sr_products_cache_ts', String(Date.now()));
    } catch (e) {}
    return allProducts;
}



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
        templateId = "KA01TP260720081817614kb2py4tJBtG"; // 2026-07 문구 수정본 (방문접수 매입신청 완료)
        // 변수명은 솔라피에 등록된 템플릿과 정확히 일치해야 한다(하나만 달라도 발송 실패).
        // 2026-07 수정본 기준: 신청자명 / 방문택배수거일자 / 고객연락처 / 주소 4개만 사용.
        // (택배사는 템플릿에 '한진택배'로 고정 기재, 고객계정은 문구에서 빠짐)
        variables = {
            "#{신청자명}": payload.name,
            "#{방문택배수거일자}": payload.pickupDate || "미지정",
            "#{고객연락처}": phone,
            "#{주소}": payload.address || "미입력"
        };
    } 
    // 3. 직접발송으로 신청시
    else if (type === "quote_cvs") {
        templateId = "KA01TP260519013835863h7hpYzMO26t";
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

    kakaoBtn.href = 'https://pf.kakao.com/_TEvMK/chat';

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
    naverBtn.href = 'https://talk.naver.com/W53PQQM';
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
        const utmMedium = (urlParams.get('utm_medium') || '').toLowerCase();
        if (utmMedium.includes('search')) source = 'naver_search';
        else if (utmMedium.includes('display')) source = 'naver_display';
        else source = 'naver';
    } else if (utmSource.includes('daangn') || utmSource.includes('karrot') || referrer.includes('daangn.com') || referrer.includes('karrotmarket') || ua.includes('daangn') || ua.includes('karrot')) {
        source = 'daangn';
    } else if (utmSource.includes('google') || referrer.includes('google.com')) {
        source = 'google';
    } else if (utmSource.includes('instagram') || referrer.includes('instagram.com') || ua.includes('instagram')) {
        source = 'instagram';
    } else if (utmSource.includes('tiktok') || referrer.includes('tiktok.com') || ua.includes('tiktok')) {
        source = 'tiktok';
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
                    
                    if (nameInput) { nameInput.value = result.data.name; nameInput.readOnly = false; }
                    if (phoneInput) { phoneInput.value = result.data.phone; phoneInput.readOnly = false; }
                    
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
                        // ⚠ 예전엔 goToStep(7)이었는데 wizard-step-7 은 존재하지 않는다.
                        //   모든 단계를 숨긴 뒤 보여줄 대상을 못 찾아 흰 화면이 됐다.
                        //   (모바일 비회원 휴대폰 본인인증 후 복귀 경로에서만 발생)
                        window.goToStep('auth');
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
                    const priceEl = document.getElementById('step8-expected-price');
                    if (priceEl) {
                        let mainPriceText = `${new Intl.NumberFormat('ko-KR').format(data.price)}원`;
                        if (data.priceRangeText) {
                            mainPriceText = data.priceRangeText.replace(/[()]/g, '');
                        }
                        priceEl.innerHTML = `예상 매입가: ${mainPriceText}`;
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
                slider.style.transform = `translateX(-${currentIndex * (100 / totalSlides)}%)`;

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



        // --- Naver Login SDK Init (callback is handled by login.html/auth.js) ---
        if (window.naver && window.naver.LoginWithNaverId) {
            window.naverLoginInst = new naver.LoginWithNaverId({
                clientId: "2DbzH9zYF4ObguujOS0U",
                callbackUrl: window.location.origin + "/login.html",
                isPopup: false,
                loginButton: { color: "green", type: 3, height: 40 },
                callbackHandle: true
            });
            window.naverLoginInst.init();
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

        // products 전체를 캐시에서 가져오기 (홈·견적 페이지 간 중복 조회 제거)
        const products = await getProductsData();

        if (!products || products.length === 0) {
            console.log('loadHomepageDynamicPrices: No products found, keeping fallback prices');
            return;
        }

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
                let iconSrc = 'assets/series/samsung/s시리즈.webp';
                if (p.brand === 'apple') iconSrc = 'assets/series/apple/아이폰15.webp';
                if (p.model.includes('플립') || p.model.toLowerCase().includes('flip')) iconSrc = 'assets/series/samsung/플립 시리즈.webp';
                if (p.model.includes('폴드') || p.model.toLowerCase().includes('fold')) iconSrc = 'assets/series/samsung/폴드 시리즈.webp';

                const priceStr = '최고 ' + new Intl.NumberFormat('ko-KR').format(p.basePrice) + '원';
                const searchParam = encodeURIComponent(p.model);

                const chipHTML = `
                    <div class="usc-chip" onclick="location.href='quote.html?search=${searchParam}'">
                        <div class="chip-icon"><img src="${iconSrc}" loading="lazy" alt="${p.model}" style="max-width: 60px; max-height: 60px; object-fit: contain;"></div>
                        <div class="chip-info">
                            <div class="chip-name">${p.model}</div>
                            <div class="chip-price">${priceStr}</div>
                            <div class="chip-tag">기본 용량 최상급 기준</div>
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

async function initPriceList() {

    console.log("Initializing Price List (Accordion)...");

    const tableBody = document.getElementById('price-table-body');
    const indexNav = document.getElementById('price-index-nav');
    const searchInput = document.getElementById('model-search');
    const emptyState = document.getElementById('pl-empty-state');
    const resultCount = document.getElementById('pl-result-count');
    const updateDate = document.getElementById('pl-update-date');
    const indexBarWrapper = document.getElementById('indexBarWrapper');

    let currentBrand = 'all'; // Default to 'all'

    // Set update date
    if (updateDate) {
        const now = new Date();
        updateDate.textContent = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
    }

    // 1. Fetch Data (if not already loaded)
    if (allProducts.length === 0) {
        try {
            await getProductsData();
            console.log(`PriceList: Loaded ${allProducts.length} products`);
        } catch (e) {
            console.error("PriceList Fetch Error:", e);
            tableBody.innerHTML = `<div style="text-align:center;padding:40px 20px;background:white;border-radius:16px;border:1px solid #e2e8f0;"><p style="color:#64748b;">시세 데이터를 불러오는데 실패했습니다.<br>${e.message}</p></div>`;
            return;
        }
    }

    // Helper functions
    function formatPrice(n) {
        return n.toLocaleString('ko-KR') + '원';
    }

    function plSeriesId(series) {
        return 'pl-series-' + series.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9가-힣\-]/g, '');
    }

    function getSeriesGroups(data) {
        const map = new Map();
        data.forEach(item => {
            const seriesKey = item.series || '기타';
            if (!map.has(seriesKey)) {
                let brandNorm = (item.brand || '').toLowerCase();
                if (brandNorm === '애플') brandNorm = 'apple';
                if (brandNorm === '삼성') brandNorm = 'samsung';
                map.set(seriesKey, { series: seriesKey, brand: brandNorm, models: [] });
            }
            map.get(seriesKey).models.push(item);
        });
        return Array.from(map.values());
    }

    // Toggle accordion
    function toggleAccordion(item) {
        const body = item.querySelector('.pl-accordion-body');
        const isOpen = item.classList.contains('open');
        if (isOpen) {
            body.style.maxHeight = body.scrollHeight + 'px';
            requestAnimationFrame(() => { body.style.maxHeight = '0'; });
            item.classList.remove('open');
        } else {
            item.classList.add('open');
            body.style.maxHeight = body.scrollHeight + 'px';
            body.addEventListener('transitionend', function handler() {
                if (item.classList.contains('open')) { body.style.maxHeight = 'none'; }
                body.removeEventListener('transitionend', handler);
            });
        }
    }

    // 2. Render Function
    const renderTable = () => {
        tableBody.innerHTML = '';
        if (indexNav) indexNav.innerHTML = '';

        const filterText = searchInput ? searchInput.value.toLowerCase().trim().replace(/\s/g, '') : '';

        // Filter: Brand + Search
        let filtered = allProducts.filter(p => {
            let pBrand = (p.brand || '').toLowerCase();
            if (pBrand === '애플') pBrand = 'apple';
            if (pBrand === '삼성') pBrand = 'samsung';
            const brandMatch = (currentBrand === 'all' || pBrand === currentBrand);
            const cleanModel = (p.model || '').toLowerCase().replace(/\s/g, '');
            const cleanSeries = (p.series || '').toLowerCase().replace(/\s/g, '');
            const searchMatch = !filterText || cleanModel.includes(filterText) || cleanSeries.includes(filterText);
            return brandMatch && searchMatch;
        });

        // Deduplicate by model and collect prices
        const modelMap = {};
        filtered.forEach(p => {
            if (!modelMap[p.model]) {
                modelMap[p.model] = { ...p, prices: {} };
            }
            const prices = p.prices || {};
            const existing = modelMap[p.model].prices;
            // Merge prices: take the highest found for each grade
            existing.s = Math.max(existing.s || 0, prices.s || p.basePrice || 0);
            existing.a = Math.max(existing.a || 0, prices.a || 0);
            existing.b = Math.max(existing.b || 0, prices.b || 0);
            existing.c = Math.max(existing.c || 0, prices.c || prices.d || 0);
        });
        const uniqueModels = Object.values(modelMap);

        // Sort by series desc then model
        uniqueModels.sort((a, b) => {
            if (a.series && b.series && a.series !== b.series) {
                return b.series.localeCompare(a.series);
            }
            return a.model.localeCompare(b.model);
        });

        // Group by series
        const groups = getSeriesGroups(uniqueModels);

        if (groups.length === 0 || uniqueModels.length === 0) {
            if (emptyState) emptyState.classList.add('show');
            if (resultCount) resultCount.innerHTML = '';
            return;
        }
        if (emptyState) emptyState.classList.remove('show');
        if (resultCount) {
            resultCount.innerHTML = `총 <strong>${uniqueModels.length}</strong>개 모델 · <strong>${groups.length}</strong>개 시리즈`;
        }

        // Render index bar
        if (indexNav) {
            groups.forEach(group => {
                const pill = document.createElement('button');
                pill.className = 'pl-index-pill' + (group.brand === 'apple' ? ' apple-pill' : ' samsung-pill');
                pill.textContent = group.series.replace(' 시리즈', '');
                pill.dataset.target = plSeriesId(group.series);
                pill.addEventListener('click', () => {
                    const target = document.getElementById(pill.dataset.target);
                    if (target) {
                        const item = target.querySelector('.pl-accordion-item');
                        if (item && !item.classList.contains('open')) { toggleAccordion(item); }
                        const headerH = document.querySelector('.navbar')?.offsetHeight || 0;
                        const indexH = indexBarWrapper?.offsetHeight || 0;
                        const top = target.getBoundingClientRect().top + window.scrollY - headerH - indexH - 12;
                        window.scrollTo({ top, behavior: 'smooth' });
                        if (item) { item.classList.add('highlight'); setTimeout(() => item.classList.remove('highlight'), 700); }
                    }
                });
                indexNav.appendChild(pill);
            });
        }

        // Render accordion groups
        groups.forEach((group, idx) => {
            const maxPrice = Math.max(...group.models.map(m => m.prices?.s || 0));
            const isLatest = idx < 2;
            const brandLabel = group.brand === 'apple' ? 'APPLE' : 'SAMSUNG';

            const wrapper = document.createElement('div');
            wrapper.className = 'pl-accordion-group';
            wrapper.id = plSeriesId(group.series);

            // Build desktop table rows
            const tableRows = group.models.map(m => {
                const ps = m.prices || {};
                return `<tr>
                    <td>${m.model}${m.popular ? '<span class="pl-popular-badge"><i class="ri-fire-fill"></i>인기</span>' : ''}</td>
                    <td class="pl-price-s">${ps.s > 0 ? formatPrice(ps.s) : '-'}</td>
                    <td class="pl-price-a">${ps.a > 0 ? formatPrice(ps.a) : '-'}</td>
                    <td class="pl-price-b">${ps.b > 0 ? formatPrice(ps.b) : '-'}</td>
                    <td class="pl-price-c">${ps.c > 0 ? formatPrice(ps.c) : '-'}</td>
                    <td><a href="quote.html?model=${encodeURIComponent(m.model)}" class="pl-sell-btn"><i class="ri-arrow-right-line"></i>판매</a></td>
                </tr>`;
            }).join('');

            // Build mobile cards
            const mobileCards = group.models.map(m => {
                const ps = m.prices || {};
                return `<div class="pl-mobile-card">
                    <div class="pl-mobile-card-header">
                        <div class="pl-mobile-card-model">${m.model}${m.popular ? '<span class="pl-popular-badge"><i class="ri-fire-fill"></i>인기</span>' : ''}</div>
                    </div>
                    <div class="pl-mobile-grades">
                        <div class="pl-mobile-grade-item"><span class="pl-mobile-grade-label">S등급</span><span class="pl-mobile-grade-price pl-price-s">${ps.s > 0 ? formatPrice(ps.s) : '-'}</span></div>
                        <div class="pl-mobile-grade-item"><span class="pl-mobile-grade-label">A등급</span><span class="pl-mobile-grade-price pl-price-a">${ps.a > 0 ? formatPrice(ps.a) : '-'}</span></div>
                        <div class="pl-mobile-grade-item"><span class="pl-mobile-grade-label">B등급</span><span class="pl-mobile-grade-price pl-price-b">${ps.b > 0 ? formatPrice(ps.b) : '-'}</span></div>
                        <div class="pl-mobile-grade-item"><span class="pl-mobile-grade-label">C등급</span><span class="pl-mobile-grade-price pl-price-c">${ps.c > 0 ? formatPrice(ps.c) : '-'}</span></div>
                    </div>
                    <div class="pl-mobile-card-footer"><a href="quote.html?model=${encodeURIComponent(m.model)}" class="pl-mobile-sell-btn"><i class="ri-arrow-right-line"></i>바로 판매하기</a></div>
                </div>`;
            }).join('');

            wrapper.innerHTML = `
                <div class="pl-accordion-item ${isLatest ? 'open' : ''}">
                    <div class="pl-accordion-header">
                        <span class="pl-brand-badge ${group.brand}">${brandLabel}</span>
                        <span class="pl-series-name">${group.series}</span>
                        <span class="pl-max-price">최대 ${maxPrice > 0 ? formatPrice(maxPrice) : '-'}~</span>
                        <span class="pl-chevron"><i class="ri-arrow-down-s-line"></i></span>
                    </div>
                    <div class="pl-accordion-body" style="max-height: ${isLatest ? 'none' : '0'}">
                        <div class="pl-accordion-body-inner">
                            <table class="pl-price-table">
                                <thead><tr>
                                    <th>모델명</th><th>S등급</th><th>A등급</th><th>B등급</th><th>C등급</th><th>바로 판매</th>
                                </tr></thead>
                                <tbody>${tableRows}</tbody>
                            </table>
                            <div class="pl-mobile-cards">${mobileCards}</div>
                        </div>
                    </div>
                </div>
            `;

            tableBody.appendChild(wrapper);

            // Bind header click
            const header = wrapper.querySelector('.pl-accordion-header');
            const item = wrapper.querySelector('.pl-accordion-item');
            header.addEventListener('click', () => toggleAccordion(item));
        });
    };

    // 3. Event Listeners — Brand Tabs (new style)
    document.querySelectorAll('.pl-brand-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.pl-brand-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentBrand = tab.dataset.brand;
            renderTable();
        });
    });

    // Legacy filterModels for backward compat (old onclick handlers)
    window.filterModels = (brand) => {
        document.querySelectorAll('.pl-brand-tab').forEach(t => t.classList.remove('active'));
        const btn = document.querySelector(`.pl-brand-tab[data-brand="${brand}"]`);
        if (btn) btn.classList.add('active');
        currentBrand = brand;
        renderTable();
    };

    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => { renderTable(); }, 200);
        });
    }

    // Index bar scroll shadow & active pill
    if (indexBarWrapper) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 200) {
                indexBarWrapper.classList.add('scrolled');
            } else {
                indexBarWrapper.classList.remove('scrolled');
            }
            // Update active index pill
            const pills = document.querySelectorAll('.pl-index-pill');
            const headerH = document.querySelector('.navbar')?.offsetHeight || 0;
            const indexH = indexBarWrapper?.offsetHeight || 0;
            const offset = headerH + indexH + 24;
            let currentActive = null;
            document.querySelectorAll('.pl-accordion-group').forEach(group => {
                const rect = group.getBoundingClientRect();
                if (rect.top <= offset + 10) { currentActive = group.id; }
            });
            pills.forEach(p => {
                p.classList.toggle('active', p.dataset.target === currentActive);
            });
        }, { passive: true });
    }

    // Initial Render
    renderTable();
}











// --- New Wizard Logic (Deep Wizard) ---



async function initDeepWizard() {



    const loadingOverlay = document.getElementById('wizard-loading');

    // Restore pending quote after login (skip if Naver callback is processing or already restored)
    // 모바일 네이버 로그인 대비: sessionStorage가 없으면 localStorage에서 복원
    const pendingQuoteStr = sessionStorage.getItem('pendingQuote') || localStorage.getItem('pendingQuote');
    if (pendingQuoteStr && !window.location.hash.includes('access_token') && !window._naverQuoteRestored) {
        try {
            window._naverQuoteRestored = true;
            currentQuote = JSON.parse(pendingQuoteStr);
            sessionStorage.removeItem('pendingQuote');
            localStorage.removeItem('pendingQuote');
            localStorage.removeItem('pendingQuotePage');
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

    // ══ 선택 내역 띠 ══════════════════════════════════════════
    // 고객이 고른 브랜드·모델·용량·접수방식을 진행바 아래에 쌓아 보여준다.
    // 항목을 누르면 그 단계로 돌아가 다시 고를 수 있다.
    const QTRAIL_SERIES_IMG = (brand, series) => {
        if (!series) return '';
        if (brand === 'samsung') {
            const map = {
                'S 시리즈': 's시리즈', '폴드 시리즈': '폴드 시리즈', '플립 시리즈': '플립 시리즈',
                '노트 시리즈': '갤럭시노트', 'A 시리즈': 'A시리즈', 'A 시리즈 및 기타기종': 'A시리즈'
            };
            const f = map[series];
            return f ? `assets/series/samsung/${f}.png` : '';
        }
        // 애플은 '아이폰 17 시리즈' → '아이폰17'
        const base = String(series).replace('시리즈', '').replace(/\s+/g, '').toLowerCase();
        return base ? `assets/series/apple/${base}.png` : '';
    };

    window.renderQuoteTrail = (step) => {
        const box = document.getElementById('quote-trail');
        if (!box) return;

        // 기기 선택 이전(브랜드 화면)과 완료 화면에서는 숨긴다
        const hideOn = [1, 8, 'auth'];
        const q = (typeof currentQuote === 'object' && currentQuote) ? currentQuote : {};
        const segs = [];
        if (q.brand) segs.push({ t: q.brand === 'apple' ? '애플' : '삼성', go: 1 });
        if (q.model && q.model.model) segs.push({ t: q.model.model, go: 3 });
        if (q.storage && q.storage.size && !/용량무관/.test(q.storage.size)) segs.push({ t: q.storage.size, go: 4 });
        if (q.method) segs.push({ t: q.method === 'simple' ? '간편접수' : '셀프접수', go: 'method' });

        if (!segs.length || hideOn.includes(step)) { box.style.display = 'none'; return; }

        const img = QTRAIL_SERIES_IMG(q.brand, q.series || (q.model && q.model.series));
        const thumb = img
            ? `<img src="${img}" alt="" onerror="this.style.display='none'">`
            : '📱';

        let html = `<div class="qtrail-thumb">${thumb}</div><div class="qtrail-segs">`;
        segs.forEach((s, i) => {
            const last = i === segs.length - 1;
            if (i) html += `<span class="qtrail-arrow">›</span>`;
            html += `<button type="button" class="qtrail-seg${last ? ' is-last' : ''}" data-goto="${s.go}">${s.t}</button>`;
        });
        html += `</div><span class="qtrail-hint">눌러서 수정</span>`;
        box.innerHTML = html;
        box.style.display = 'flex';

        box.querySelectorAll('.qtrail-seg:not(.is-last)').forEach(btn => {
            btn.onclick = () => {
                const g = btn.dataset.goto;
                if (g === '1') { window.goToStep(1); return; }
                if (g === '3') {
                    // 모델부터 다시 — 이후 선택은 비운다.
                    // ⚠ storage 를 null 로 두면 calculateFinalPrice 의
                    //   currentQuote.storage.priceAdjustment 에서 오류가 난다. 빈 객체로 초기화한다.
                    currentQuote.storage = { size: '', priceAdjustment: 0 };
                    currentQuote.method = null; currentQuote.grade = null;
                    window.goToStep(3); return;
                }
                if (g === '4') {
                    currentQuote.method = null; currentQuote.grade = null;
                    if (typeof window.renderStorage === 'function' && currentQuote.model) window.renderStorage(currentQuote.model);
                    window.goToStep(4); return;
                }
                window.goToStep('method');
            };
        });
    };

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

        // 선택 내역 띠 갱신 — 단계가 바뀔 때마다 다시 그린다
        try { if (typeof window.renderQuoteTrail === 'function') window.renderQuoteTrail(step); } catch (_) { }

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
                    if (nameInput) nameInput.readOnly = false;
                    if (phoneInput) phoneInput.readOnly = false;
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
            // Hide progress bar entirely on step 8 to save vertical space
            const progressWrapper = document.getElementById('wizard-progress');
            if (progressWrapper) {
                if (step === 8) {
                    progressWrapper.style.display = 'none';
                } else {
                    progressWrapper.style.display = 'block';
                }
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



    // ===== 견적 화면 추가 혜택 배지 =====
    // 규칙: 연휴 이벤트만 중복 적용, 나머지(당근/아이폰)는 서로 중복 불가 → 더 유리한 하나만.
    // 연휴 기간은 한국시간(+09:00) 절대시각으로 판정 → 고객이 해외에 있어도 동일하게 동작.
    const HOLIDAY_EVENT = {
        start: new Date('2026-07-17T00:00:00+09:00').getTime(),
        end: new Date('2026-07-19T23:59:59+09:00').getTime(),
        amount: 10000,
        label: '연휴 특별 ~7/19'
    };
    // 아이폰 이벤트: 시리즈 번호 = 만원 단위 (11~17), X·8·SE는 5천원
    function getIphoneBonus(seriesText) {
        const s = String(seriesText || '');
        if (!/아이폰|iphone/i.test(s)) return 0;
        const m = s.match(/(\d{1,2})/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n >= 11 && n <= 17) return n * 1000;
            if (n === 8) return 5000;
        }
        if (/\bX\b|SE/i.test(s)) return 5000;
        return 0;
    }
    // 현재 고객에게 적용 가능한 혜택 목록 반환
    function getActiveBonuses() {
        const out = [];
        const now = Date.now();
        if (now >= HOLIDAY_EVENT.start && now <= HOLIDAY_EVENT.end) {
            out.push({ key: 'holiday', label: HOLIDAY_EVENT.label, amount: HOLIDAY_EVENT.amount, text: '+10,000원', primary: true });
        }
        // 당근 · 아이폰은 중복 불가 → 더 유리한 하나만
        const src = sessionStorage.getItem('traffic_source') || '';
        const isDaangn = src === 'daangn';
        const iphoneBonus = getIphoneBonus((currentQuote.model && currentQuote.model.series) || currentQuote.series || (currentQuote.model && currentQuote.model.model));
        if (isDaangn) {
            out.push({ key: 'daangn', label: '당근 혜택', amount: 20000, text: '최대 +20,000원' });
        } else if (iphoneBonus > 0) {
            out.push({ key: 'iphone', label: '아이폰 이벤트', amount: iphoneBonus, text: '+' + new Intl.NumberFormat('ko-KR').format(iphoneBonus) + '원' });
        }
        return out;
    }
    // 배지 HTML 생성 (basePrice가 있으면 '최대 ~원까지' 합계도 표시)
    function renderBonusBadges(basePrice) {
        const list = getActiveBonuses();
        if (!list.length) return '';
        const total = list.reduce((s, b) => s + b.amount, 0);
        let html = '<div style="margin-top:12px; max-width:340px; margin-left:auto; margin-right:auto; box-sizing:border-box;">';
        list.forEach(b => {
            const style = b.primary
                ? 'background:#1D4ED8; color:#fff;'
                : (b.key === 'daangn' ? 'background:#FAEEDA; border:1px solid #EF9F27; color:#854F0B;' : 'background:#E1F5EE; border:1px solid #1D9E75; color:#0F6E56;');
            const sub = b.primary ? 'color:#BFDBFE;' : 'opacity:0.85;';
            // 모바일 좁은 폭에서도 글자가 쪼개지지 않도록: 줄바꿈 허용 + 각 조각은 통째로 유지
            html += `<div style="display:flex; align-items:center; justify-content:center; gap:4px 8px; flex-wrap:wrap; ${style} border-radius:12px; padding:8px 12px; margin-bottom:5px; box-sizing:border-box; width:100%;">
                <span style="font-size:0.78rem; white-space:nowrap; ${sub}">${b.label}</span>
                <span style="font-size:1rem; font-weight:800; white-space:nowrap;">${b.text}</span>
            </div>`;
        });
        if (basePrice > 0) {
            html += `<p style="margin:8px 0 0; font-size:0.85rem; color:#2563eb; font-weight:700;">최대 ${formatCurrency(basePrice + total)}원까지</p>`;
        }
        html += '</div>';
        return html;
    }
    window.renderBonusBadges = renderBonusBadges;

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



                // 액정은 3단계: 'no'(없음) / 'light'(줄·멍) / 'heavy'(완전 안보임)
                // (이전엔 val==='yes'로 비교했는데 그런 값이 없어 항상 false → 액정 파손이 등급에 반영되지 않았음)
                if (group === 'lcd_damage') defects.lcd_damage = val;



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



            grade = 'a'; // 간편접수 기본 등급 = A급 (최고가 대신 실제 검수 결과에 가까운 값)



        } else {



            // It's Used. Check defects cascadingly.



            // Priority: D (Worst) -> C -> B -> A -> S







            // '카메라 멍/기스'는 기능불량 그룹에 있지만 성격은 외관 하자 → 기능불량에서 제외하고 외관(B급)으로 취급.
            // (이래야 기능불량 3개 카운트에도 안 들어가 억울한 D급이 안 나옴)
            const COSMETIC_IN_FUNC = ['camera_lens'];
            const funcAll = Array.isArray(defects.func_defect) ? defects.func_defect : [];
            const funcReal = funcAll.filter(v => !COSMETIC_IN_FUNC.includes(v)); // 진짜 기능 하자만
            const hasCosmeticFunc = funcAll.some(v => COSMETIC_IN_FUNC.includes(v));

            const hasBodyDamage = (defects.body_damage && defects.body_damage.length > 0) || hasCosmeticFunc;



            const hasMicroScratch = defects.micro_scratch && defects.micro_scratch.length > 0;



            const isLcdDamaged = defects.lcd_damage;



            const hasBurnIn = defects.burn_in;



            const hasFuncDefect = funcReal.length > 0;







            // Rules (User can refine these!)



            // D Grade: Power, Account, LCD Damage ?? (Usually LCD is C or D)



            // Let's assume LCD Damage is Critical -> C or D. Let's start with C.



            // Sharaphone Policy assumption:







            // Grade Logic V1 (Conservative):



            // D급: 전원/충전 불량 · 계정잠김 · 기능불량 3개 이상 (액정불량은 D가 아니라 C로 내림)
            if (funcReal.includes('power') || funcReal.includes('account') || funcReal.length >= 3) {



                grade = 'd'; // Critical Failure



            } else if (defects.lcd_damage === 'light' || defects.lcd_damage === 'heavy') { // 액정불량(줄·멍 / 완전 안보임) → C



                grade = 'c'; // Screen broken



            } else if (hasFuncDefect) { // 기능불량 1~2개 → C



                grade = 'c'; // Functional issue or Burn-in -> C



            } else if (hasBurnIn || hasBodyDamage) { // 잔상(번인) 또는 파손·찍힘 → B



                // Physical damage -> B



                grade = 'b';



            } else if (hasMicroScratch) {



                // 미세 기스만 → A (이전엔 대입이 누락돼 S로 남아 최고가가 나갔음)
                grade = 'a';



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



            // 시세표에 해당 등급 단가가 없을 때: 간편접수 등급표와 동일한 비율로 폴백
            // (이 폴백이 없어서 A/B/C/D 단가가 비어있는 모델은 셀프접수에서 0원 견적이 나갔음)
            const GRADE_RATES = { s: 1, a: 0.9, b: 0.8, c: 0.6, d: 0.2 };
            const _base = currentQuote.model.basePrice || (currentQuote.model.prices && currentQuote.model.prices['s']) || 0;

            if (grade === 'sealed') {



                // If sealed price is 0 or missing, fallback to 's' grade price



                baseGradePrice = currentQuote.model.prices['s'] || currentQuote.model.basePrice || 0;



            } else if (grade === 's') {



                baseGradePrice = currentQuote.model.basePrice || 0;



            } else {

                // a / b / c / d : S급 단가 대비 비율로 산정 (간편접수 등급표와 동일 기준)
                baseGradePrice = Math.round(_base * (GRADE_RATES[grade] || 0));

            }



        }







        let storageAdj = 0;



        if (currentQuote.storage && currentQuote.storage.priceAdjustment) {



            storageAdj = currentQuote.storage.priceAdjustment;



        }







        // 단가 0원 기종은 용량 추가금을 더하지 않는다 (0원짜리에 +8만원이 붙는 것 방지)
        let finalPrice = baseGradePrice > 0 ? baseGradePrice + storageAdj : 0;



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



        let priceDisplayStr = "";
        let rangeStr = "";

        if (isSimpleMode) {
            let bPrice = 0;
            let sPrice = 0;
            if (currentQuote.model.prices) {
                bPrice = currentQuote.model.prices['b'] || (currentQuote.model.basePrice * 0.8);
                sPrice = currentQuote.model.prices['s'] || currentQuote.model.basePrice;
            } else {
                bPrice = (currentQuote.model.basePrice || 0) * 0.8;
                sPrice = currentQuote.model.basePrice || 0;
            }
            if (currentQuote.storage) {
                bPrice += (currentQuote.storage.priceAdjustment || 0);
                sPrice += (currentQuote.storage.priceAdjustment || 0);
            }
            bPrice = Math.max(0, Math.floor(bPrice / 1000) * 1000);
            sPrice = Math.max(0, Math.floor(sPrice / 1000) * 1000);
            
            rangeStr = `${formatCurrency(bPrice)} ~ ${formatCurrency(sPrice)}`;
            priceDisplayStr = rangeStr;
            currentQuote.priceRangeText = rangeStr;
        } else {
            // 셀프접수는 문진으로 등급이 확정되므로 범위(물결) 없이 단일 단가로 표시
            priceDisplayStr = `${formatCurrency(finalPrice)}원`;
            currentQuote.priceRangeText = priceDisplayStr;
        }
        
        document.getElementById('final-price-display').innerText = priceDisplayStr;

        // 추가 혜택 배지 — 금액 바로 아래(모바일 우선: 세로 배치)
        const bonusHost = document.getElementById('quote-bonus-badges');
        if (bonusHost) {
            // 간편접수는 범위 표시라 합계 기준가가 애매 → 배지만, 셀프접수는 단일가라 '최대 ~원까지'도 표시
            bonusHost.innerHTML = renderBonusBadges(isSimpleMode ? 0 : finalPrice);
        }







        let breakdown = `<p><strong>판정 등급:</strong> <span style="color:var(--primary-color)">${gradeName}</span></p>`;



        if (isSimpleMode) {



            breakdown += `<p style="color:#888; font-size:0.8rem;">* 간편 접수 — 기기 도착 후 검수를 통해 최종 매입가가 확정됩니다</p>`;



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



        const __cached = await getProductsData();
        const snapshot = { empty: !__cached || __cached.length === 0, forEach: (cb) => __cached.forEach((d) => cb({ id: d.id, data: () => d })) };







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
                
                // ⚠ 예전엔 storageOpts[0]을 무조건 골라버렸다.
                //   홈에서 '아이폰 17 PRO MAX'를 눌러 들어온 512GB 사용자가
                //   128GB 기준 금액으로 접수돼 15만원 낮은 견적을 받는 문제가 있었다.
                //   용량 선택지가 2개 이상이면 반드시 고객이 직접 고르게 한다.
                const storageOpts = foundModel.storageOptions || [];
                const isSamsung = foundModel.brand === 'samsung';
                const needsStorage = !isSamsung && storageOpts.length > 1;

                if (needsStorage) {
                    // 용량 선택 화면으로 보낸다. 용량을 고르면 기존 흐름(접수방식 선택)으로 이어진다.
                    setTimeout(() => {
                        if (typeof window.renderStorage === 'function') window.renderStorage(foundModel);
                        if (typeof window.goToStep === 'function') window.goToStep(4);
                    }, 300);
                } else {
                    // 삼성(용량무관) 또는 용량 선택지가 하나뿐인 기종 — 기존처럼 바로 등급표로
                    currentQuote.storage = isSamsung
                        ? { size: '기본(용량무관)', priceAdjustment: 0 }
                        : (storageOpts[0] || { size: '기본', priceAdjustment: 0 });
                    currentQuote.method = 'simple';
                    currentQuote.grade = 'a'; // 간편접수 기본 등급 = A급 (위 selectMethod와 동일 기준)

                    let sPrice = (currentQuote.model.prices && currentQuote.model.prices['a'] > 0)
                        ? currentQuote.model.prices['a']
                        : Math.round((currentQuote.model.basePrice || 0) * 0.9);
                    // 단가 0원 기종은 용량 추가금을 더하지 않는다
                    if (sPrice > 0 && currentQuote.storage) sPrice += (currentQuote.storage.priceAdjustment || 0);
                    currentQuote.finalPrice = Math.floor(sPrice / 1000) * 1000;

                    setTimeout(() => {
                        if (typeof window.renderGradePriceList === 'function') window.renderGradePriceList();
                        if (typeof window.goToStep === 'function') window.goToStep('grade-list');
                    }, 300);
                }
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
            const data = JSON.stringify(currentQuote);
            sessionStorage.setItem('pendingQuote', data);
            // 모바일 네이버 로그인(앱 전환) 대비: sessionStorage가 날아가도 복원되도록 localStorage에도 저장
            localStorage.setItem('pendingQuote', data);
            localStorage.setItem('pendingQuotePage', 'quote.html');
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
                                
                                if (nameInput) { nameInput.value = result.data.name; nameInput.readOnly = false; }
                                if (phoneInput) { phoneInput.value = result.data.phone; phoneInput.readOnly = false; }
                                
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
                    status: '신청접수',
                    timestamp: new Date().toLocaleString(),
                    brand: currentQuote.brand,
                    model: currentQuote.model.model,
                    series: currentQuote.model.series || currentQuote.series,
                    storage: currentQuote.storage.size,
                    grade: currentQuote.grade,
                    conditionType: currentQuote.grade === 'sealed' ? 'sealed' : 'used',
                    price: currentQuote.finalPrice,
                    priceRangeText: currentQuote.priceRangeText || "",
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
                        const trafficSourceMap = {
                            'daangn': '당근마켓 🥕',
                            'naver': '네이버 🟢',
                            'naver_search': '네이버 검색 🔎',
                            'naver_display': '네이버 디스플레이 🖼️',
                            'google': '구글 🔵',
                            'direct': '직접 유입/기타 📱'
                        };
                        const trafficSource = trafficSourceMap[sessionStorage.getItem('traffic_source')] || '직접 유입/기타 📱';

                        const tgMessage = `
🔔 *새로운 매입 신청 알림 (배송지 미입력)*
━━━━━━━━━━━━━━
👤 *신청자*: ${payload.customerName}
📞 *연락처*: ${payload.customerPhone}
📱 *모델*: ${payload.brand} ${payload.model} (${payload.storage})
💰 *예상가*: ${new Intl.NumberFormat('ko-KR').format(payload.price)}원
🔍 *유입 경로*: ${trafficSource}
━━━━━━━━━━━━━━
⚠️ *상태*: 배송 방법 미입력 (고객 이탈 시 해피콜 필요)
`.trim();
                        fetch(`https://asia-northeast3-rejeuphone.cloudfunctions.net/telegramApi/send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: tgMessage })
                        }).catch(e => console.error("Telegram Error:", e));
                    } catch(e) {}
                    
                    // Set expected price
                    const priceEl = document.getElementById('step8-expected-price');
                    if (priceEl) {
                        let mainPriceText = `${new Intl.NumberFormat('ko-KR').format(payload.price)}원`;
                        if (payload.priceRangeText) {
                            mainPriceText = payload.priceRangeText.replace(/[()]/g, '');
                        }
                        priceEl.innerHTML = `예상 매입가: ${mainPriceText}`;
                    }
                    
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
                const baseAddress = document.getElementById('customer-address') ? document.getElementById('customer-address').value : '';
                const detailAddress = document.getElementById('step8-customer-address-detail') ? document.getElementById('step8-customer-address-detail').value.trim() : '';
                const address = detailAddress ? `${baseAddress} ${detailAddress}` : baseAddress;
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

                // step8(이탈 복귀) 경로는 기존대로 '제출 전 동의' 방식 유지 → 동의 후 executeFinalSubmit 실행
                window.presaleMode = 'beforeSubmit';
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
            titleTarget.innerHTML = `<span style="color:var(--primary-color)">${currentQuote.model.model} (${currentQuote.storage.size})</span> 예상 매입가`;
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
        // ⚠ 용량 추가금을 더해야 한다.
        //   예전엔 이 표가 기본 용량 기준 금액만 보여줬다. 제목에는 '(512GB)'라고 뜨는데
        //   금액은 128GB 기준이라, 실제 접수 금액(finalPrice)과 최대 15~32만원 어긋났다.
        const storageAdj = (currentQuote.storage && currentQuote.storage.priceAdjustment) || 0;
        // 단가가 0원인 기종(기타기종 등)은 용량 추가금을 더하지 않는다.
        // 그냥 더하면 0원짜리가 '+8만원'처럼 표시돼 실제로 지급할 수 없는 금액이 노출된다.
        const addAdj = (v) => (v > 0 ? v + storageAdj : 0);

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
            price = addAdj(price);
            if (price < 0) price = 0;
            price = Math.floor(price / 1000) * 1000;

            const gradeLabels = {
                s: { title: "S급 (최상급)", desc: "하자 없는 최상 상태" },
                a: { title: "A급 (깨끗)", desc: "미세 기스 1~2곳" },
                b: { title: "B급 (사용감)", desc: "찍힘/기스 다수" },
                c: { title: "C급 (파손)", desc: "화면 파손/기능 불량" },
                d: { title: "D급 (심한 파손)", desc: "심한 파손/기능 불량" }
            };

            // Read-Only List Item
            html += `
            <div class="grade-list-card" style="cursor: default; pointer-events: none;">
                <div class="grade-row" style="padding: 10px 15px;">
                    <div class="grade-info">
                        <h4 style="margin:0; font-size:1rem;">${gradeLabels[g].title}</h4>
                        <p style="margin:2px 0 0; font-size:0.8rem; color:#888;">${gradeLabels[g].desc}</p>
                    </div>
                    <div class="grade-price" style="font-size:1.1rem;">${formatCurrency(price)}</div>
                </div>
            </div>`;
        });
        // 등급표 아래 추가 혜택 배지 (연휴/당근/아이폰) — 등급별 금액이 여러 개라 합계는 표시하지 않음
        html += renderBonusBadges(0);
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
            // 간편접수 기본 등급 = A급.
            // 예전엔 S급(최고가)을 기본으로 잡아 예상가를 띄웠는데, 실제 검수 결과는 대부분 A~B급이라
            // 예상가와 실매입가 차이가 커지고 그대로 클레임으로 돌아왔다. 기대치를 실제에 맞춘다.
            currentQuote.grade = 'a';
            let sPrice = 0;
            if (currentQuote.model.prices && currentQuote.model.prices['a'] > 0) {
                sPrice = currentQuote.model.prices['a'];
            } else {
                sPrice = Math.round((currentQuote.model.basePrice || 0) * 0.9); // A급 단가 미등록 시 폴백
            }
            // 단가 0원 기종은 용량 추가금을 더하지 않는다
            if (sPrice > 0 && currentQuote.storage) sPrice += (currentQuote.storage.priceAdjustment || 0);
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
    // 홈에서 ?search=/?model= 로 들어온 경우에도 용량 화면을 띄워야 하므로 외부에 노출한다.
    window.renderStorage = renderStorage;

    function calculateFinalPrice() {
        if (!currentQuote.model || !currentQuote.grade) return;
        let baseGradePrice = currentQuote.model.prices[currentQuote.grade] || 0;
        let storageAdj = currentQuote.storage.priceAdjustment || 0;
        // 단가 0원 기종은 용량 추가금을 더하지 않는다 (0원짜리에 +8만원이 붙는 것 방지)
        let finalPrice = baseGradePrice > 0 ? baseGradePrice + storageAdj : 0;
        if (finalPrice < 0) finalPrice = 0;

        const gradeNames = {
            sealed: "미개봉 (새상품 · S급 단가)",
            s: "S급 (최상급)",
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
            
            const baseAddress = document.getElementById('customer-address').value.trim();
            const detailAddress = document.getElementById('step8-customer-address-detail') ? document.getElementById('step8-customer-address-detail').value.trim() : '';
            const address = detailAddress ? `${baseAddress} ${detailAddress}` : baseAddress;
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

            const errorMsg = document.getElementById('delivery-error-msg');
            if (errorMsg) errorMsg.style.display = 'none';

            // --- 유효성 검사 강화 ---
            const customerNameEl = document.getElementById('auth-name');
            const customerPhoneEl = document.getElementById('auth-phone');
            const customerName = customerNameEl ? customerNameEl.value.trim() : '';
            const customerPhone = customerPhoneEl ? customerPhoneEl.value.trim() : '';

            if (!customerName || customerName.length < 2) {
                const errMsg = "신청자 이름을 올바르게 입력해주세요 (최소 2자).";
                if (errorMsg) {
                    errorMsg.innerText = errMsg;
                    errorMsg.style.display = 'block';
                } else {
                    alert(errMsg);
                }
                return;
            }

            const rawPhoneDigits = customerPhone.replace(/[^0-9]/g, '');
            if (rawPhoneDigits.length < 10 || rawPhoneDigits.length > 11) {
                const errMsg = "올바른 연락처(10~11자리 숫자)를 입력해주세요.";
                if (errorMsg) {
                    errorMsg.innerText = errMsg;
                    errorMsg.style.display = 'block';
                } else {
                    alert(errMsg);
                }
                return;
            }

            const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);
            if (needsAddress && (!address || address.length < 5)) {
                const errMsg = "수거를 위해 정확한 주소를 입력해주세요 (최소 5자 이상).";
                if (errorMsg) {
                    errorMsg.innerText = errMsg;
                    errorMsg.style.display = 'block';
                } else {
                    alert(errMsg);
                }
                return;
            }

            if (!accountNum || accountNum.length < 5) {
                const errMsg = "정산을 위해 올바른 계좌 정보를 입력해주세요 (최소 5자 이상).";
                if (errorMsg) {
                    errorMsg.innerText = errMsg;
                    errorMsg.style.display = 'block';
                } else {
                    alert(errMsg);
                }
                return;
            }

            btnSubmitDelivery.textContent = '처리 중...';
            btnSubmitDelivery.disabled = true;

            try {
                const { doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const docRef = doc(db, "quotes", window.currentQuoteDocId);
                
                const updatePayload = {
                    customerName: customerName,
                    customerPhone: customerPhone,
                    customerAddress: needsAddress ? address : '편의점/직접 택배 발송',
                    // 우편번호 저장 — 굿스플로 방문수거 자동예약에 필수 (카카오 주소검색이 채워둔 값)
                    customerZipCode: needsAddress ? (document.getElementById('step8-customer-postcode')?.value || '') : '',
                    // 상세주소 별도 저장 — 굿스플로 주소2 필드용 (비면 접수 거절됨)
                    customerAddressDetail: needsAddress ? (document.getElementById('step8-customer-address-detail')?.value.trim() || '') : '',
                    deliveryMethod: deliveryMethod,
                    pickupDate: pickupDate,
                    customerAccount: account,
                    customerMemo: memo,
                    // 배송방법이 확정된(=신청이 실제로 완료된) 시각.
                    // firebaseTimestamp는 본인인증 직후 문서가 처음 만들어진 때라,
                    // 며칠 뒤에 마무리한 고객은 목록에서 옛 날짜로 묻혀 놓치기 쉽다.
                    // 관리자 목록은 이 값이 있으면 우선 표시한다.
                    submittedAt: serverTimestamp()
                };
                
                await updateDoc(docRef, updatePayload);

                // ==========================================
                // 1. 최우선 전환/분석 코드 실행 (독립 try/catch)
                // ==========================================
                
                // [당근마켓 전환]
                try {
                    if (window.karrotPixel) {
                        window.karrotPixel.track('SubmitApplication');
                        console.log("✅ [btnSubmitDelivery] 당근 전환 성공");
                    }
                } catch(e) {
                    console.error("당근 전환 실패:", e);
                }

                // [네이버 전환]
                try {
                    if (window.wcs) {
                        if (!window.wcs_add) window.wcs_add = {};
                        window.wcs_add["wa"] = "s_bfc3561d569";
                        var _nasa = {};
                        if (window.wcs.inflow) window.wcs.inflow("s_bfc3561d569");
                        _nasa["cnv"] = wcs.cnv("1", "1");
                        window.wcs_do(_nasa);
                        console.log("✅ [btnSubmitDelivery] 네이버 전환 성공");
                    }
                } catch(e) {
                    console.error("네이버 전환 실패:", e);
                }

                // [GA4 / Google Ads 전환]
                try {
                    const isIphone = currentQuote.brand && currentQuote.brand.toLowerCase() === 'apple';
                    const isSamsung = currentQuote.brand && currentQuote.brand.toLowerCase() === 'samsung' || 
                                      (currentQuote.model && currentQuote.model.model && currentQuote.model.model.includes('갤럭시'));
                    
                    if (typeof gtag === 'function') {
                        if (isIphone) {
                            gtag('event', 'conversion', {
                                'send_to': 'AW-18055027970/QL8CCL-Ur68cEIK6p6FD',
                                'value': currentQuote.finalPrice || 1.0,
                                'currency': 'KRW',
                                'transaction_id': window.currentQuoteDocId || ''
                            });
                            console.log("✅ [btnSubmitDelivery] GA/Google Ads 아이폰 전환 성공");
                        } else if (isSamsung) {
                            gtag('event', 'conversion', {
                                'send_to': 'AW-18055027970/EYqmCNfnrq8cEIK6p6FD',
                                'value': currentQuote.finalPrice || 1.0,
                                'currency': 'KRW',
                                'transaction_id': window.currentQuoteDocId || ''
                            });
                            console.log("✅ [btnSubmitDelivery] GA/Google Ads 삼성 전환 성공");
                        }
                    }
                } catch(e) {
                    console.error("GA/Google Ads 전환 실패:", e);
                }

                // [퍼널 추적]
                try {
                    window.trackFunnel("quote_complete");
                    console.log("✅ [btnSubmitDelivery] 퍼널 분석 성공");
                } catch(e) {
                    console.error("퍼널 분석 실패:", e);
                }

                // ==========================================
                // 2. 외부 서비스 및 알림 발송 (독립 try/catch, 실패해도 UI 완료)
                // ==========================================

                // [구글 시트 연동 + 텔레그램 알림]
                try {
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const fullData = snap.data();
                        
                        // 구글 시트 연동
                        try {
                            const mapValueToKoLocal = (val) => {
                                const dict = {
                                    'true': '미개봉', 'false': '개봉', 'yes': '있음/불량', 'no': '없음/정상',
                                    'scratch': '흠집', 'dent': '찍힘', 'break': '파손',
                                    'lcd_broken': '액정파손/LCD불량', 'lcd_backlight': '백라이트 불량',
                                    'burn_in_mild': '미세 잔상', 'burn_in_severe': '심한 잔상',
                                    'camera': '카메라 불량', 'wifi': '와이파이 불량', 'power': '전원 버튼 불량',
                                    'volume': '볼륨 버튼 불량', 'speaker': '스피커 불량', 'mic': '마이크 불량',
                                    'charge': '충전 불량', 'biometrics': '생체인식 불량', 'gps': 'GPS 불량',
                                    'network': '네트워크(유심) 불량', 'account': '계정 잠김(매입불가)'
                                };
                                return dict[val] || val;
                            };
                            const formatDefectsLocal = (defects) => {
                                if (!defects || Object.keys(defects).length === 0) return '없음/해당없음 (간편견적)';
                                let parts = [];
                                if (defects.is_sealed !== undefined) parts.push(`미개봉: ${defects.is_sealed ? '미개봉' : '개봉'}`);
                                if (defects.lcd_damage !== undefined) parts.push(`액정손상: ${defects.lcd_damage ? '있음' : '정상'}`);
                                if (defects.burn_in !== undefined) parts.push(`잔상: ${defects.burn_in ? '있음' : '정상'}`);
                                for (const key in defects) {
                                    if (['is_sealed', 'lcd_damage', 'burn_in'].includes(key)) continue;
                                    if (Array.isArray(defects[key]) && defects[key].length > 0) {
                                        const mappedValues = defects[key].map(mapValueToKoLocal).join(', ');
                                        let groupName = key;
                                        if (key === 'func_defect') groupName = '기능';
                                        else if (key === 'body_defect' || key === 'body') groupName = '외관';
                                        parts.push(`${groupName}: ${mappedValues}`);
                                    }
                                }
                                return parts.join(', ');
                            };
                            
                            const sheetPayload = {
                                ...fullData,
                                id: window.currentQuoteDocId || '',
                                defects: formatDefectsLocal(fullData.defectsDetails)
                            };

                            fetch(GOOGLE_SCRIPT_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain' },
                                body: JSON.stringify(sheetPayload)
                            }).catch(e => console.error("Google Sheet Fetch Error:", e));
                            console.log("✅ [btnSubmitDelivery] 구글 시트 데이터 전송 요청 완료");
                        } catch(sheetErr) {
                            console.error("구글 시트 연동 오류:", sheetErr);
                        }

                        // 텔레그램 알림 발송
                        try {
                            const trafficSourceMap = {
                                'daangn': '당근마켓 🥕',
                                'naver': '네이버 🟢',
                                'naver_search': '네이버 검색 🔎',
                                'naver_display': '네이버 디스플레이 🖼️',
                                'google': '구글 🔵',
                                'instagram': '인스타 📷',
                                'tiktok': '틱톡 🎵',
                                'direct': '직접 유입/기타 📱'
                            };
                            const trafficSource = trafficSourceMap[fullData.trafficSource || sessionStorage.getItem('traffic_source')] || '직접 유입/기타 📱';

                            const methodKo = fullData.method === 'simple' ? '간편견적 📝' : '셀프견적 🔍';
                            const gradeMap = {
                                'sealed': '미개봉 📦',
                                's': 'S급 ✨',
                                'a': 'A급 🟢',
                                'b': 'B급 🟡',
                                'c': 'C급 🟠',
                                'd': 'D급 🔴'
                            };
                            const gradeKo = gradeMap[fullData.grade] || fullData.grade || '알수없음';
                            
                            const mapValueToKo = (val) => {
                                const dict = {
                                    'true': '미개봉', 'false': '개봉', 'yes': '있음/불량', 'no': '없음/정상',
                                    'scratch': '흠집', 'dent': '찍힘', 'break': '파손',
                                    'lcd_broken': '액정파손/LCD불량', 'lcd_backlight': '백라이트 불량',
                                    'burn_in_mild': '미세 잔상', 'burn_in_severe': '심한 잔상',
                                    'camera': '카메라 불량', 'wifi': '와이파이 불량', 'power': '전원 버튼 불량',
                                    'volume': '볼륨 버튼 불량', 'speaker': '스피커 불량', 'mic': '마이크 불량',
                                    'charge': '충전 불량', 'biometrics': '생체인식 불량', 'gps': 'GPS 불량',
                                    'network': '네트워크(유심) 불량', 'account': '계정 잠김(매입불가)'
                                };
                                return dict[val] || val;
                            };

                            const formatDefects = (defects) => {
                                if (!defects || Object.keys(defects).length === 0) return '없음/해당없음 (간편견적)';
                                let parts = [];
                                if (defects.is_sealed !== undefined) parts.push(`미개봉 여부: ${defects.is_sealed ? '미개봉 📦' : '개봉 📱'}`);
                                if (defects.lcd_damage !== undefined) parts.push(`액정 파손/LCD 불량: ${defects.lcd_damage ? '있음 ❌' : '정상/없음 ✅'}`);
                                if (defects.burn_in !== undefined) parts.push(`화면 잔상: ${defects.burn_in ? '있음 ❌' : '정상/없음 ✅'}`);
                                
                                for (const key in defects) {
                                    if (['is_sealed', 'lcd_damage', 'burn_in'].includes(key)) continue;
                                    if (Array.isArray(defects[key]) && defects[key].length > 0) {
                                        const mappedValues = defects[key].map(mapValueToKo).join(', ');
                                        let groupName = key;
                                        if (key === 'func_defect') groupName = '기능 고장';
                                        else if (key === 'body_defect' || key === 'body') groupName = '외관 상태';
                                        parts.push(`${groupName}: ${mappedValues}`);
                                    }
                                }
                                return parts.length > 0 ? parts.join('\n') : '없음';
                            };

                            const defectInfo = formatDefects(fullData.defectsDetails);

                            const tgMessage = `
✅ *배송 방법 확정 알림*
━━━━━━━━━━━━━━
👤 *신청자*: ${fullData.customerName}
📞 *연락처*: ${fullData.customerPhone}
🚚 *배송 방식*: ${fullData.deliveryMethod === 'courier' ? '택배 방문수거 📦 (희망일: ' + (fullData.pickupDate || '미정') + ')' : '직접 발송 (편의점/우체국 등) 🏪'}
📍 *수거 주소*: ${fullData.customerAddress || '해당없음 (직접 발송)'}
💳 *계좌 정보*: ${fullData.customerAccount || '미입력'}
━━━━━━━━━━━━━━
📱 *기종*: ${fullData.brand} ${fullData.model} (${fullData.storage})
📝 *견적 구분*: ${methodKo}
💎 *결정 등급*: ${gradeKo}
💰 *최종 예상가*: ${new Intl.NumberFormat('ko-KR').format(fullData.price)}원
🔍 *유입 경로*: ${trafficSource}
━━━━━━━━━━━━━━
🛠️ *선택한 하자 정보*:
${defectInfo}
━━━━━━━━━━━━━━
📝 *고객 메모*: ${fullData.customerMemo || '없음'}
`.trim();

                            fetch(`https://asia-northeast3-rejeuphone.cloudfunctions.net/telegramApi/send`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ message: tgMessage })
                            }).catch(e => console.error("Telegram Send Fetch Error:", e));
                            console.log("✅ [btnSubmitDelivery] 텔레그램 메시지 전송 요청 완료");
                        } catch(tgErr) {
                            console.error("텔레그램 알림 생성 오류:", tgErr);
                        }
                    }
                } catch(snapErr) {
                    console.error("Firestore getDoc(전체 조회) 오류:", snapErr);
                }

                // [알림톡 발송]
                try {
                    if (window.triggerFrontendAlimtalk) {
                        if (deliveryMethod === 'courier') {
                            window.triggerFrontendAlimtalk("quote_courier", customerPhone, {
                                name: customerName,
                                pickupDate: pickupDate,
                                address: needsAddress ? address : '편의점/직접 택배 발송'
                            });
                        } else if (deliveryMethod === 'cvs') {
                            window.triggerFrontendAlimtalk("quote_cvs", customerPhone, {});
                        }
                    }
                } catch(alimtalkErr) {
                    console.error("알림톡 발송 프로세스 오류:", alimtalkErr);
                }

                // ==========================================
                // 3. UI 완료 화면 처리
                // ==========================================
                document.getElementById('step8-delivery-section').style.display = 'none';
                document.getElementById('step8-final-section').style.display = 'block';
                
                const instr = document.getElementById('success-instruction');
                if (deliveryMethod === 'cvs') {
                    instr.innerHTML = `<p><strong>📦 택배비 지원받기 접수 완료</strong></p><p>고객님 편하신 편의점/우체국을 통해 아래 주소로 기기를 발송해 주세요.<br><br><strong>보내실 곳:</strong><br>부산시 부산진구 동천로 116 한신밴빌딩 1003호 쉐라폰<br>연락처: 010-5173-5382</p><p>기기가 도착하는 즉시 검수하여 <strong>당일 입금</strong>해 드립니다!</p>`;
                } else {
                    instr.innerHTML = `<p><strong>📦 택배 방문수거 접수 완료</strong></p><p>선택하신 수거일자(${pickupDate})에 맞춰 박스를 포장해 문 앞에 두시면, 택배 기사님이 안전하게 수거해 갈 예정입니다.</p><p>기기가 도착하는 즉시 검수하여 <strong>당일 입금</strong>해 드립니다!</p>`;
                }

                // 접수가 완전히 끝난 뒤 '발송 전 확인사항'(초기화·유심폐기) 안내를 띄운다.
                // 저장/전환추적/알림톡 이후에 실행되므로 이 모달이 실패해도 접수에는 영향이 없다.
                try {
                    window.presaleMode = 'afterSubmit'; // 안내 전용 — 닫아도 재제출하지 않음
                    if (window.openPresaleModal) setTimeout(() => window.openPresaleModal(), 400);
                } catch (e) { console.error("발송 전 안내 모달 표시 실패:", e); }
                
            } catch (e) {
                console.error("2차 접수 업데이트 전체 프로세스 오류:", e);
                alert("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                btnSubmitDelivery.textContent = '접수 완료하기 ✅';
                btnSubmitDelivery.disabled = false;
            }
        });
    }


    window.executeFinalSubmit = async function() {
        const btnSubmit = document.getElementById('btn-submit-final');
        const name = document.getElementById('auth-name').value;
        const phone = document.getElementById('auth-phone').value;
        const baseAddress = document.getElementById('customer-address').value;
        const detailAddress = document.getElementById('step8-customer-address-detail') ? document.getElementById('step8-customer-address-detail').value.trim() : '';
        const address = detailAddress ? `${baseAddress} ${detailAddress}` : baseAddress;
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
            status: '신청접수',
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
            // 우편번호 저장 — 굿스플로 방문수거 자동예약에 필수 (카카오 주소검색이 채워둔 값)
            customerZipCode: needsAddress ? (document.getElementById('step8-customer-postcode')?.value || '') : '',
            // 상세주소 별도 저장 — 굿스플로는 주소1/주소2를 나눠 받으며 주소2가 비면 접수를 거절함
            customerAddressDetail: needsAddress ? (document.getElementById('step8-customer-address-detail')?.value.trim() || '') : '',
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

            // 배송방법 확정(=신청완료) 시각. 이 경로는 한 번에 제출되므로 접수시각과 동일하지만,
            // 관리자 목록이 항상 submittedAt을 기준으로 정렬·표시할 수 있게 함께 기록한다.
            submittedAt: serverTimestamp(),

            method: currentQuote.method || 'simple',



            defectsDetails: currentQuote.defectsDetails || {},
            trafficSource: sessionStorage.getItem('traffic_source') || 'direct'
        };







        try {
            if (!auth.currentUser) {
                try {
                    await signInAnonymously(auth);
                } catch (authErr) {
                    console.error("signInAnonymously 실패:", authErr);
                    throw authErr; // 인증 실패 시 신청 중단
                }
            }

            let docRef;
            try {
                docRef = await addDoc(collection(db, "quotes"), payload);
                console.log("✅ 신청서 Firestore 저장 성공, docId:", docRef.id);
                window.currentQuoteDocId = docRef.id; // currentQuoteDocId 전역 할당 누락 복구
            } catch (addDocErr) {
                console.error("addDoc(신청서 저장) 실패:", addDocErr);
                throw addDocErr; // 저장 실패 시 신청 중단
            }

            // === 신청서 저장 성공 이후: 전환/분석 코드 (각각 독립 try/catch) ===

            // 1. 당근(Karrot) 전환 - 가장 먼저 호출
            try {
                if (window.karrotPixel) {
                    window.karrotPixel.track('SubmitApplication');
                    console.log("✅ karrotPixel.track('SubmitApplication') 호출 완료");
                }
            } catch(e) {
                console.error('karrotPixel 전환 에러:', e);
            }

            // 2. 네이버 전환(lead)
            try {
                if (window.wcs) {
                    window.wcs_add = window.wcs_add || {};
                    window.wcs_add['wa'] = 's_bfc3561d569';
                    var _conv = {};
                    _conv.type = 'lead';
                    wcs.trans(_conv);
                    console.log("✅ 네이버 wcs.trans 호출 완료");
                }
            } catch(e) {
                console.error('네이버 wcs 전환 에러:', e);
            }

            // 3. GA4 이벤트 + Google Ads 전환
            try {
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
            } catch(e) {
                console.error('GA4/Google Ads 전환 에러:', e);
            }

            // 4. 퍼널 추적
            try {
                window.trackFunnel("quote_complete");
            } catch(e) {
                console.error('trackFunnel 에러:', e);
            }

            // 5. 알림톡 트리거 - 전환 완료 후 가장 마지막에 안전하게 실행
            try {
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
            } catch(alimtalkErr) {
                console.error("알림톡 발송 프로세스 오류:", alimtalkErr);
            }

            const mapValueToKoLocal = (val) => {
                const dict = {
                    'true': '미개봉', 'false': '개봉', 'yes': '있음/불량', 'no': '없음/정상',
                    'scratch': '흠집', 'dent': '찍힘', 'break': '파손',
                    'lcd_broken': '액정파손/LCD불량', 'lcd_backlight': '백라이트 불량',
                    'burn_in_mild': '미세 잔상', 'burn_in_severe': '심한 잔상',
                    'camera': '카메라 불량', 'wifi': '와이파이 불량', 'power': '전원 버튼 불량',
                    'volume': '볼륨 버튼 불량', 'speaker': '스피커 불량', 'mic': '마이크 불량',
                    'charge': '충전 불량', 'biometrics': '생체인식 불량', 'gps': 'GPS 불량',
                    'network': '네트워크(유심) 불량', 'account': '계정 잠김(매입불가)'
                };
                return dict[val] || val;
            };
            const formatDefectsLocal = (defects) => {
                if (!defects || Object.keys(defects).length === 0) return '없음/해당없음 (간편견적)';
                let parts = [];
                if (defects.is_sealed !== undefined) parts.push(`미개봉: ${defects.is_sealed ? '미개봉' : '개봉'}`);
                if (defects.lcd_damage !== undefined) parts.push(`액정손상: ${defects.lcd_damage ? '있음' : '정상'}`);
                if (defects.burn_in !== undefined) parts.push(`잔상: ${defects.burn_in ? '있음' : '정상'}`);
                for (const key in defects) {
                    if (['is_sealed', 'lcd_damage', 'burn_in'].includes(key)) continue;
                    if (Array.isArray(defects[key]) && defects[key].length > 0) {
                        const mappedValues = defects[key].map(mapValueToKoLocal).join(', ');
                        let groupName = key;
                        if (key === 'func_defect') groupName = '기능';
                        else if (key === 'body_defect' || key === 'body') groupName = '외관';
                        parts.push(`${groupName}: ${mappedValues}`);
                    }
                }
                return parts.join(', ');
            };

            const sheetPayload = {
                ...payload,
                id: docRef.id,
                defects: formatDefectsLocal(payload.defectsDetails)
            };

            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(sheetPayload)
            }).catch(e => console.log("GAS Error ignored:", e));







            // --- Send Telegram Notification ---



            const trafficSourceMap = {
                'daangn': '당근마켓 🥕',
                'naver': '네이버 🟢',
                'naver_search': '네이버 검색 🔎',
                'naver_display': '네이버 디스플레이 🖼️',
                'google': '구글 🔵',
                'direct': '직접 유입/기타 📱'
            };
            const trafficSource = trafficSourceMap[payload.trafficSource || sessionStorage.getItem('traffic_source')] || '직접 유입/기타 📱';

            const methodKo = payload.method === 'simple' ? '간편견적 📝' : '셀프견적 🔍';
            const gradeMap = {
                'sealed': '미개봉 📦',
                's': 'S급 ✨',
                'a': 'A급 🟢',
                'b': 'B급 🟡',
                'c': 'C급 🟠',
                'd': 'D급 🔴'
            };
            const gradeKo = gradeMap[payload.grade] || payload.grade || '알수없음';
            
            const mapValueToKo = (val) => {
                const dict = {
                    'true': '미개봉',
                    'false': '개봉',
                    'yes': '있음/불량',
                    'no': '없음/정상',
                    'scratch': '흠집',
                    'dent': '찍힘',
                    'break': '파손',
                    'lcd_broken': '액정파손/LCD불량',
                    'lcd_backlight': '백라이트 불량',
                    'burn_in_mild': '미세 잔상',
                    'burn_in_severe': '심한 잔상',
                    'camera': '카메라 불량',
                    'wifi': '와이파이 불량',
                    'power': '전원 버튼 불량',
                    'volume': '볼륨 버튼 불량',
                    'speaker': '스피커 불량',
                    'mic': '마이크 불량',
                    'charge': '충전 불량',
                    'biometrics': '생체인식 불량',
                    'gps': 'GPS 불량',
                    'network': '네트워크(유심) 불량',
                    'account': '계정 잠김(매입불가)'
                };
                return dict[val] || val;
            };

            const formatDefects = (defects) => {
                if (!defects || Object.keys(defects).length === 0) return '없음/해당없음 (간편견적)';
                let parts = [];
                if (defects.is_sealed !== undefined) parts.push(`미개봉 여부: ${defects.is_sealed ? '미개봉 📦' : '개봉 📱'}`);
                if (defects.lcd_damage !== undefined) parts.push(`액정 파손/LCD 불량: ${defects.lcd_damage ? '있음 ❌' : '정상/없음 ✅'}`);
                if (defects.burn_in !== undefined) parts.push(`화면 잔상: ${defects.burn_in ? '있음 ❌' : '정상/없음 ✅'}`);
                
                for (const key in defects) {
                    if (['is_sealed', 'lcd_damage', 'burn_in'].includes(key)) continue;
                    if (Array.isArray(defects[key]) && defects[key].length > 0) {
                        const mappedValues = defects[key].map(mapValueToKo).join(', ');
                        let groupName = key;
                        if (key === 'func_defect') groupName = '기능 고장';
                        else if (key === 'body_defect' || key === 'body') groupName = '외관 상태';
                        parts.push(`${groupName}: ${mappedValues}`);
                    }
                }
                return parts.length > 0 ? parts.join('\n') : '없음';
            };

            const defectInfo = formatDefects(payload.defectsDetails);

            const tgMessage = `
🔔 *새로운 매입 신청 완료 알림*
━━━━━━━━━━━━━━
👤 *신청자*: ${payload.customerName}
📞 *연락처*: ${payload.customerPhone}
🚚 *배송 방식*: ${payload.deliveryMethod === 'courier' ? '택배 방문수거 📦 (희망일: ' + (payload.pickupDate || '미정') + ')' : '직접 발송 (편의점/우체국 등) 🏪'}
📍 *수거 주소*: ${payload.customerAddress || '해당없음 (직접 발송)'}
💳 *계좌 정보*: ${payload.customerAccount || '미입력'}
━━━━━━━━━━━━━━
📱 *기종*: ${payload.brand} ${payload.model} (${payload.storage})
📝 *견적 구분*: ${methodKo}
💎 *결정 등급*: ${gradeKo}
💰 *최종 예상가*: ${new Intl.NumberFormat('ko-KR').format(payload.price)}원
🔍 *유입 경로*: ${trafficSource}
━━━━━━━━━━━━━━
🛠️ *선택한 하자 정보*:
${defectInfo}
━━━━━━━━━━━━━━
📝 *고객 메모*: ${payload.customerMemo || '없음'}
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
                    연락처: <span style="color: #666;">010-5173-5382</span>
                </div>



                <p style="font-size: 0.9rem; color: #666;">* 마이페이지에서 진행 상황을 확인하실 수 있습니다.</p>



            `;




            // 6. GA4 generate_lead 이벤트
            try {
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'generate_lead', {
                        'event_category': 'Quote',
                        'event_label': `${payload.brand} ${payload.model}`,
                        'value': payload.price,
                        'currency': 'KRW'
                    });
                }
            } catch(e) { console.error('GA4 generate_lead 에러:', e); }







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







// initReviews()는 메인 init(약 666줄)에서 1회만 호출됨.
// 여기서 중복 호출하면 loadReviews가 두 번 돌아 allReviewsData가
// 두 배로 쌓이는 레이스가 발생(PC 리뷰 두 개씩 표시 버그) → 제거함.







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



                    <span class="home-review-device">${escapeHtml(deviceStr)}</span>



                    <span class="home-review-stars">${stars}</span>



                </div>



                <div class="home-review-body">



                    <p class="home-review-text">"${escapeHtml(safeText).replace(/\n/g, '<br>')}"</p>



                </div>



                <div class="home-review-footer">



                   ${imageHtml}



                   <div style="flex-grow: 1;"></div>



                   <span class="home-review-date">${dateStr}</span>



                   <span class="home-review-author">${escapeHtml(safeName)}</span>



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
            alert("리뷰 작성 권한이 없습니다. (관리자 전용)");
            return;
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



        // 후기 목록 상한 — 화면은 페이지당 5개씩만 그리고(이미지도 그만큼만 로드) 페이지 번호도
        // 현재 주변 3개만 노출하므로, 이 값을 키워도 렌더 부담은 늘지 않는다.
        // 후기 문서는 텍스트+이미지URL로 가벼워 500개까지 불러와도 로딩에 무리 없다.
        // (후기가 수천 개로 늘면 그때 '더 보기' 커서 방식으로 전환)
        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(500));



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



        const safeName = escapeHtml(data.userName || '익명'); // Restore the missing variable
        let displayTitle = safeName; // Default to user name







        if (data.deviceModel || data.deviceStorage || data.transactionPrice) {



            const parts = [];



            if (data.deviceModel) parts.push(escapeHtml(data.deviceModel));



            if (data.deviceStorage) parts.push(`(${escapeHtml(data.deviceStorage)})`);



            const deviceStr = parts.join(' ');







            if (data.transactionPrice) {



                // Formatting: "John Doe | iPhone 13 (256GB) - 55만원"



                displayTitle = `${safeName} <span style="font-weight: normal; font-size: 0.85rem; color: #666;">| ${deviceStr} - ${escapeHtml(data.transactionPrice)}</span>`;



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



                <div class="review-content">${escapeHtml(data.text || '').replace(/\n/g, '<br>')}</div>



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

    const populatePickupDates = (elementId) => {
        const selectEl = document.getElementById(elementId);
        if (!selectEl) return;
        
        const koreanHolidays = [
            '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30',
            '2025-03-01', '2025-05-05', '2025-05-06', '2025-06-06',
            '2025-08-15', '2025-10-03',
            '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
            '2025-10-09', '2025-12-25',
            '2026-01-01', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18',
            '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24', '2026-05-25',
            '2026-06-03', '2026-06-06',
            '2026-07-17', // 제헌절 — 2026년부터 공휴일로 재지정(2026-05-11 시행). 택배 집하 없음
            '2026-08-15',
            '2026-09-24', '2026-09-25', '2026-09-26',
            '2026-10-03', '2026-10-09', '2026-12-25',
        ];
        
        const isWeekendOrHoliday = (date) => {
            // ※ 아래 날짜 계산은 모두 '한국 시간 벽시계'를 UTC 게터로 읽는 방식.
            //    고객 PC/폰의 시간대가 한국이 아니어도(해외 이용자) 동일한 날짜가 나오게 하기 위함.
            const day = date.getUTCDay();
            if (day === 0) return true; // 일요일(0) 제외 (토요일은 수거 가능하므로 허용)
            return koreanHolidays.includes(date.toISOString().slice(0, 10));
        };

        const KST_MS = 9 * 3600000;
        const kstNow = new Date(Date.now() + KST_MS); // UTC 게터로 읽으면 한국 벽시계

        // 늦은 밤 신청 대응 — 한진택배는 '당일 22시까지 접수분'만 다음날 수거로 잡힌다(실측 확인).
        // 마감에 걸리면 우리가 예약 버튼을 누르기 전에 날짜가 넘어가므로, 여유를 두고 21:30부터
        // 하루 더 뒤(이튿날)부터 제시한다.
        //   예) 7/20 21:40 신청 → 가장 빠른 수거일 7/22
        const CUTOFF_MIN = 21 * 60 + 30; // 21:30 (한국시간) — 한진 익일수거 마감이 22시라 여유를 두고 앞당김
        const kstMinutes = kstNow.getUTCHours() * 60 + kstNow.getUTCMinutes();
        const startOffset = kstMinutes >= CUTOFF_MIN ? 2 : 1;

        const validDates = [];
        // 한국 기준 오늘 자정에서 출발
        const cursor = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()));
        cursor.setUTCDate(cursor.getUTCDate() + startOffset - 1); // 아래 루프가 먼저 +1 하므로 1을 뺌

        // 최소 5일치 날짜를 채움 (일요일/공휴일 제외, 토요일은 수거 가능하므로 포함)
        while (validDates.length < 5) {
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            if (!isWeekendOrHoliday(cursor)) {
                validDates.push(new Date(cursor));
            }
        }

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const formatOption = (date) => {
            const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const d = date.getUTCDate().toString().padStart(2, '0');
            const dayName = dayNames[date.getUTCDay()];
            return `<option value="${m}/${d}">${m}/${d} (${dayName})</option>`;
        };

        selectEl.innerHTML = validDates.map(formatOption).join('');
    };

    populatePickupDates('courier-pickup-date');
    populatePickupDates('auth-courier-pickup-date');

    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            
            const method = target.dataset.method;
            const courierBlock = document.getElementById('method-courier-date');
            const cvsBlock = document.getElementById('method-cvs-info');
            
            // 수거 주소는 방문수거일 때만 필요 — 개인발송(편의점/우체국) 고객에겐 숨긴다.
            // (직접 보내는데 주소를 요구하면 납득이 안 되고 이탈 요인이 됨)
            const addrLabel = document.getElementById('step8-address-label');
            const addrSection = document.getElementById('step8-address-section');

            if (method === 'courier') {
                if(courierBlock) courierBlock.style.display = 'block';
                if(cvsBlock) cvsBlock.style.display = 'none';
                if(addrLabel) addrLabel.style.display = 'flex';
                if(addrSection) addrSection.style.display = 'block';
            } else if (method === 'cvs') {
                if(courierBlock) courierBlock.style.display = 'none';
                if(cvsBlock) cvsBlock.style.display = 'block';
                if(addrLabel) addrLabel.style.display = 'none';
                if(addrSection) addrSection.style.display = 'none';
            }
        });
    });
});








// 리뷰 사진 업로드 전 자동 압축 (긴 변 1280px, JPEG 80%). 실패 시 원본 그대로 업로드.
async function compressImage(file, maxDim = 1280, quality = 0.8) {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const img = await new Promise((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = dataUrl;
        });
        const longEdge = Math.max(img.width, img.height);
        const scale = Math.min(1, maxDim / longEdge);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob || blob.size >= file.size) return file; // 압축 이득 없으면 원본 유지
        return blob;
    } catch (e) {
        console.warn('리뷰 이미지 압축 실패, 원본 업로드:', e);
        return file;
    }
}

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



                const storageInstance = await getStorageLazy();
                const compressedFile = await compressImage(file);
                const uploadName = (compressedFile !== file) ? `${(file.name || 'review').replace(/\.[^.]+$/, '')}.jpg` : file.name;
                const storageRef = ref(storageInstance, `reviews/${Date.now()}_${uploadName}`);







                btnSubmit.textContent = '사진 업로드 중...';



                const uploadTask = await uploadBytesResumable(storageRef, compressedFile);







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
            document.getElementById('p-btn-next').textContent = (window.presaleMode === 'afterSubmit') ? '다음' : '동의 후 다음';
            document.getElementById('p-dot-1').classList.add('active');
            document.getElementById('p-dot-2').classList.remove('active');
        } else {
            document.getElementById('presale-step-1-apple').style.display = 'none';
            document.getElementById('presale-step-1-samsung').style.display = 'none';
            document.getElementById('presale-step-2').style.display = 'block';
            document.getElementById('p-btn-prev').style.display = 'block';
            document.getElementById('p-btn-next').textContent = (window.presaleMode === 'afterSubmit') ? '확인했습니다' : '동의 후 최종 신청완료';
            document.getElementById('p-dot-1').classList.remove('active');
            document.getElementById('p-dot-2').classList.add('active');
        }
    };

    window.presaleGoNext = () => {
        if (document.getElementById('presale-step-2').style.display === 'block') {
            // 접수 완료 후 '안내' 용도로 띄우므로 여기서 다시 제출하지 않는다.
            // (예전엔 이 모달이 제출 직전에 떴기 때문에 executeFinalSubmit을 호출했으나,
            //  지금은 이미 저장·전환추적·알림톡이 끝난 뒤라 재호출하면 중복 접수가 발생함)
            window.closePresaleModal();
            if (window.presaleMode === 'beforeSubmit' && window.executeFinalSubmit) {
                window.executeFinalSubmit();
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

            // 노출기간 검사 — startAt/endAt은 +09:00이 명시된 절대시각이라
            // 고객이 어느 시간대에 있든 한국시간 기준으로 동일하게 판정된다.
            const nowMs = Date.now();
            const startMs = data.startAt ? new Date(data.startAt).getTime() : null;
            const endMs = data.endAt ? new Date(data.endAt).getTime() : null;
            const notStarted = startMs && !isNaN(startMs) && nowMs < startMs;
            const alreadyEnded = endMs && !isNaN(endMs) && nowMs > endMs;
            if (notStarted || alreadyEnded) return; // 기간 밖이면 아예 표시하지 않음

            if (data.isActive) {
                // 남은 시간 타이머 (종료일시가 있고 표시 옵션이 켜진 경우)
                const cdWrap = document.getElementById('global-popup-countdown');
                if (cdWrap) {
                    if (data.showCountdown && endMs && !isNaN(endMs)) {
                        cdWrap.style.display = 'flex';
                        const pad = (n) => (n < 10 ? '0' + n : '' + n);
                        const setCd = () => {
                            const left = Math.max(0, endMs - Date.now());
                            const d = document.getElementById('gp-cd-d');
                            const h = document.getElementById('gp-cd-h');
                            const m = document.getElementById('gp-cd-m');
                            const s = document.getElementById('gp-cd-s');
                            if (d) d.textContent = Math.floor(left / 86400000);
                            if (h) h.textContent = pad(Math.floor(left % 86400000 / 3600000));
                            if (m) m.textContent = pad(Math.floor(left % 3600000 / 60000));
                            if (s) s.textContent = pad(Math.floor(left % 60000 / 1000));
                            if (left <= 0 && window._gpCdTimer) clearInterval(window._gpCdTimer);
                        };
                        setCd();
                        if (window._gpCdTimer) clearInterval(window._gpCdTimer);
                        window._gpCdTimer = setInterval(setCd, 1000);
                    } else {
                        cdWrap.style.display = 'none';
                    }
                }
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
