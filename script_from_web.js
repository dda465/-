import { db, auth, storage } from './firebase-config.js';

import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";



const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzWCf4pn7jyNSLzBAgNnDFEilE-1nKx_lIiCr1ausGHp_lkZ5Vkh7S9uruSfatRH0aB/exec";

const TELEGRAM_BOT_TOKEN = "8711439716:AAFXr9QwxHTT4ZH3DWdOCySDMDU5DaYJBK4";

const TELEGRAM_CHAT_ID = "6989151823";



const ADMIN_EMAILS = [

    "admin@rejuphone.com",

    "admin@sharaphone.com",

    "test@admin.com",

    "dda465@hanmail.net",

    "guffy321@naver.com",

];



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

    kakaoBtn.href = 'https://pf.kakao.com/_BmFyn';

    kakaoBtn.target = '_blank';

    kakaoBtn.className = 'kakao-chat-btn';

    kakaoBtn.innerHTML = `

    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">

        <path d="M12 3C5.9 3 1 6.9 1 11.8c0 3.2 2.1 6 5.3 7.6-.2.8-.8 2.8-.9 3.2 0 0-.1.2.1.2.2 0 2.6-1.7 3.6-2.4 1 .1 1.9.2 2.9.2 6.1 0 11-3.9 11-8.8S18.1 3 12 3z" />

        </svg>

    <span class="btn-label">移댄넚 臾몄쓽</span>

`;



    // Container appended to body

    // document.body.appendChild(container); // Append to body only ONCE (Currently disabled as widgets are removed)

}



// Start logic based on page

document.addEventListener('DOMContentLoaded', () => {



    // Inject Floating Widgets

    injectFloatingWidgets();



    // Init homepage specifically

    if (document.getElementById('homepage-recent-reviews')) {

        loadRecentReviewsForHomepage();

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

        const updateNavbar = (userData) => {

            const navLinksContainer = document.querySelector('.nav-links');



            // 1. Reset: Remove dynamic links (Logout, Admin)

            const oldLogout = document.getElementById('nav-logout-link');

            if (oldLogout) oldLogout.remove();



            const oldAdmin = document.getElementById('admin-btn-nav');

            if (oldAdmin) oldAdmin.remove();



            if (userData) {

                console.log("Navbar: User detected", userData.nickname);



                // 2. Update Login Link -> My Page

                navLoginLink.textContent = '留덉씠?섏씠吏';

                navLoginLink.href = 'mypage.html';

                navLoginLink.onclick = null; // Remove any previous handlers



                // 3. Add Logout Link

                const logoutLink = document.createElement('a');

                logoutLink.id = 'nav-logout-link';

                logoutLink.href = '#';

                logoutLink.textContent = '濡쒓렇?꾩썐';

                logoutLink.addEventListener('click', async (e) => {

                    e.preventDefault();

                    if (confirm('濡쒓렇?꾩썐 ?섏떆寃좎뒿?덇퉴?')) {

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



                // 4. Admin Check & Button

                if (ADMIN_EMAILS.includes(userData.email)) {

                    const adminBtn = document.createElement('a');

                    adminBtn.id = 'admin-btn-nav';

                    adminBtn.href = 'admin.html';

                    adminBtn.className = 'btn btn-sm btn-primary'; // Use small button class

                    adminBtn.textContent = '愿由ъ옄';

                    adminBtn.style.marginLeft = '10px';

                    navLinksContainer.appendChild(adminBtn);



                    // Review Write Button (Review Page)

                    const reviewBtn = document.getElementById('btn-show-form');

                    if (reviewBtn) reviewBtn.style.display = 'inline-block';

                }



            } else {

                console.log("Navbar: No user detected");

                // Reset to Login

                navLoginLink.textContent = '濡쒓렇??;

                navLoginLink.href = 'login.html';

                navLoginLink.onclick = null;

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



                // Update text indicator

                if (currentIndicator) {

                    currentIndicator.textContent = currentIndex + 1;

                }



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

            const naverLogin = new naver.LoginWithNaverId({

                clientId: "2DbzH9zYF4ObguujOS0U",

                callbackUrl: window.location.origin + "/index.html",

                isPopup: false,

                callbackHandle: true

            });

            naverLogin.init();



            window.addEventListener('load', function () {

                // Only process the Naver login callback if the URL indicates a return from Naver (has access_token)

                // This prevents the SDK from auto-logging the user in on every page refresh after they've intentionally logged out.

                if (window.location.hash.includes('access_token')) {

                    naverLogin.getLoginStatus(async function (status) {

                        if (status) {

                            // Some Naver accounts might not provide an email, use an empty string instead of undefined to prevent Firebase crashes.

                            const email = naverLogin.user.getEmail() || "";

                            const nickname = naverLogin.user.getNickName() || naverLogin.user.getName() || `naveryuser${naverLogin.user.getId()}`;

                            const uid = `naver_${naverLogin.user.getId()}`;



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

                                    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

                                    await setDoc(doc(db, "users", uid), {

                                        email: email,

                                        nickname: nickname,

                                        uid: uid,

                                        provider: 'naver',

                                        createdAt: new Date(),

                                        role: 'user'

                                    }, { merge: true });

                                } catch (e) {

                                    console.error('Firestore save naver user error:', e);

                                }



                                const userInfo = {

                                    email: email,

                                    nickname: nickname,

                                    provider: 'naver',

                                    uid: uid

                                };

                                localStorage.setItem('user_info', JSON.stringify(userInfo));

                                updateNavbar(userInfo);



                                const ADMIN_EMAILS = [

                                    "admin@rejuphone.com",

                                    "admin@sharaphone.com",

                                    "test@admin.com",

                                    "dda465@hanmail.net",

                                    "guffy321@naver.com",

                                ];

                                if (ADMIN_EMAILS.includes(email)) {

                                    alert("?ㅼ씠踰?濡쒓렇???깃났!");

                                }

                                // Clean up hash to prevent re-processing

                                window.history.replaceState(null, null, window.location.pathname);

                            }

                        }

                    });

                }

            });

        }

        // -------------------------------------



        onAuthStateChanged(auth, (user) => {

            if (user && !user.isAnonymous) {

                const latestLocal = localStorage.getItem('user_info');

                const localData = latestLocal ? JSON.parse(latestLocal) : null;



                updateNavbar({

                    provider: localData?.provider || 'email',

                    nickname: localData?.nickname || user.displayName || (user.email ? user.email.split('@')[0] : '?ъ슜??),

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

                let timeStr = "諛⑷툑 ??;

                if (data.firebaseTimestamp) {

                    const now = new Date();

                    const past = data.firebaseTimestamp.toDate();

                    const diffMins = Math.floor((now - past) / 60000);



                    if (diffMins < 1) timeStr = "諛⑷툑 ??;

                    else if (diffMins < 60) timeStr = `${diffMins}遺???;

                    else if (diffMins < 1440) timeStr = `${Math.floor(diffMins / 60)}?쒓컙 ??;

                    else timeStr = `${Math.floor(diffMins / 1440)}????;

                }



                // Grade Map

                const gradeMap = {

                    'sealed': '誘멸컻遊?,

                    's': 'S湲?,

                    'a': 'A湲?,

                    'b': 'B湲?,

                    'c': 'C湲?,

                    'd': 'D湲?,

                    'used': '?섏옄',

                    'scratched': '?섏옄'

                };



                const conditionVal = data.grade || data.condition || data.conditionType || '?뺤씤以?;

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

                liveContainer.innerHTML = '<div class="text-center" style="width:100%; padding:20px; color:#888;">理쒓렐 嫄곕옒 ?댁뿭???놁뒿?덈떎.</div>';

            }



        } catch (e) {

            console.error("Live Prices Error:", e);

            // Keep default loading or show error?

            // Fallback to static if error

            const fallbackTrades = [

                { model: '?꾩씠??15 ?꾨줈 (256GB/S湲?', price: 1150000, time: '諛⑷툑 ?? },

                { model: '媛ㅻ윮??S24 ?명듃??(512GB/誘멸컻遊?', price: 1350000, time: '10遺??? },

                { model: '?꾩씠??14 ?꾨줈 (128GB/A湲?', price: 850000, time: '1?쒓컙 ?? }

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

                        <p>理쒓퀬媛 留ㅼ엯以?/p>

                    </div>

                    <div class="price-tag">${formatCurrency(p.basePrice)}</div>

                </div>

    `;

            });

            container.innerHTML = html;

        } else {

            container.innerHTML = '<div class="text-center" style="width:100%; padding:20px;">?깅줉??紐⑤뜽???놁뒿?덈떎.</div>';

        }



    } catch (e) {

        console.error("Latest Models Error:", e);

        // Fallback

        const latest = [

            { model: '?꾩씠??15 ?꾨줈 留μ뒪', price: 1750000, tag: 'NEW' },

            { model: '媛ㅻ윮??S24 ?명듃??, price: 1450000, tag: 'HOT' }

        ];

        let html = '';

        latest.forEach(item => {

            html += `

                    <div class="price-card highlight-card">

                <div class="phone-info">

                    <h4>${item.model} <span class="badge ${item.tag === 'NEW' ? 'badge-new' : 'badge-hot'}">${item.tag}</span></h4>

                    <p>理쒓퀬媛 留ㅼ엯以?/p>

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

            tableBody.innerHTML = `< tr > <td colspan="4" class="text-center text-danger">?쒖꽭 ?곗씠?곕? 遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎.<br>${e.message}</td></tr > `;

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

            if (pBrand === '?좏뵆') pBrand = 'apple';

            if (pBrand === '?쇱꽦') pBrand = 'samsung';



            const brandMatch = (currentBrand === 'all' || pBrand === currentBrand);

            const searchMatch = p.model.toLowerCase().includes(filterText) || (p.series && p.series.toLowerCase().includes(filterText));

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

            tableBody.innerHTML = `< tr > <td colspan="4" class="text-center" style="padding: 30px;">寃??寃곌낵媛 ?놁뒿?덈떎.</td></tr > `;

            return;

        }



        filtered.forEach(p => {

            // Prices

            const prices = p.prices || {};

            const priceS = prices.s || p.basePrice || 0;

            const priceA = prices.a || 0;

            const priceB = prices.b || 0;

            const priceC = prices.c || prices.d || 0;



            // Formatting: If 0, show '-'

            const fmt = (val) => val > 0 ? formatCurrency(val) : '-';



            const tr = document.createElement('tr');

            tr.innerHTML = `

                <td>

                    <div class="model-name">${p.model}</div>

                    <span style="font-size:0.8rem; color:#888;">${p.series}</span>

                </td>

                <td class="price-col text-success">${fmt(priceS)}</td>

                <td class="price-col">${fmt(priceA)}</td>

                <td class="price-col">${fmt(priceB)}</td>

                <td class="price-col text-danger desktop-only">${fmt(priceC)}</td>

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

        const clickedBtn = Array.from(document.querySelectorAll('.filter-btn')).find(b => b.getAttribute('onclick')?.includes(brand));

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



    // Global Navigation

    window.goToStep = (step) => {

        console.log("Navigating to step:", step);

        document.querySelectorAll('.wizard-step').forEach(s => {

            s.classList.remove('active');

            s.style.display = 'none';

        });



        // Handle named steps

        let targetId = `wizard-step-${step}`;

        if (step === 'method') targetId = 'wizard-step-method';

        if (step === 'defects') targetId = 'wizard-step-defects';



        const target = document.getElementById(targetId);

        if (target) {

            target.style.display = 'block';

            setTimeout(() => target.classList.add('active'), 10);

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

            alert("紐⑤뜽???좏깮?섏? ?딆븯?듬땲?? 泥섏쓬遺???ㅼ떆 ?쒕룄?댁＜?몄슂.");

            return;

        }



        // Safety Check for Prices

        if (!currentQuote.model.prices && !currentQuote.model.basePrice) {

            console.error("Price data missing for", currentQuote.model);

            alert("二꾩넚?⑸땲?? ??紐⑤뜽???쒖꽭 ?곗씠?곌? ?꾩쭅 ?낅뜲?댄듃?섏? ?딆븯?듬땲??");

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

                if (group === 'lcd_damage') defects.lcd_damage = val;

                if (group === 'burn_in') defects.burn_in = (val === 'yes');

            });

        }



        // 1. Unpurchasable Check (Account Locked)

        if (!isSimpleMode && defects.func_defect && defects.func_defect.includes('account')) {

            alert("?꾨궃 ?곕젮媛 ?덈뒗 '怨꾩젙 ?좉?' 湲곌린??留ㅼ엯??遺덇??ν빀?덈떎.\n?좉툑 ?댁젣 ???ㅼ떆 ?묒닔??二쇱꽭??");

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

            const isLcdDamaged = (defects.lcd_damage === 'yes' || defects.lcd_damage === 'light' || defects.lcd_damage === 'heavy' || defects.lcd_damage === true);

            const hasBurnIn = defects.burn_in;

            const hasFuncDefect = defects.func_defect && defects.func_defect.length > 0;



            // Rules (User can refine these!)

            // D Grade: Power, Account, LCD Damage ?? (Usually LCD is C or D)

            // Let's assume LCD Damage is Critical -> C or D. Let's start with C.

            // Sharaphone Policy assumption:



            // Grade Logic V1 (Conservative):

            let bGradeCount = 0;
            let cGradeCount = 0;
            let hasDGrade = false;

            // 1. LCD Damage
            if (defects.lcd_damage === 'heavy') {
                hasDGrade = true;
            } else if (defects.lcd_damage === 'light' || defects.lcd_damage === 'yes' || defects.lcd_damage === true) {
                cGradeCount++;
            }

            // 2. Burn-in -> B grade
            if (defects.burn_in === true || defects.burn_in === 'yes') {
                bGradeCount++;
            }

            // 3. Body Damage (1=A, 2+=B)
            let bodyCount = 0;
            if (defects.body_damage && Array.isArray(defects.body_damage)) {
                bodyCount = defects.body_damage.filter(x => x !== 'none').length;
            }
            if (bodyCount >= 2) {
                bGradeCount++;
            }

            // 4. Micro Scratch (1~2=A, 3+=B)
            let scratchCount = 0;
            if (defects.micro_scratch && Array.isArray(defects.micro_scratch)) {
                scratchCount = defects.micro_scratch.filter(x => x !== 'none').length;
            }
            if (scratchCount >= 3) {
                bGradeCount++;
            }

            // 5. Functional Defects
            if (defects.func_defect && Array.isArray(defects.func_defect)) {
                const validFuncs = defects.func_defect.filter(x => x !== 'none');
                const dFuncs = ['power']; // D급
                const cFuncs = ['camera_fail', 'faceid', 'wifi', 'compass', 'unknown_part', 'touch', 'account', 'network']; // C급
                const bFuncs = ['camera_lens', 'vibration', 'sound', 'battery']; // B급
                
                for (let f of validFuncs) {
                    if (dFuncs.includes(f)) hasDGrade = true;
                    else if (cFuncs.includes(f)) cGradeCount++;
                    else if (bFuncs.includes(f)) bGradeCount++;
                }
            }

            // 6. Calculate Final Grade
            grade = 's';
            if (hasDGrade || cGradeCount >= 2) {
                grade = 'd';
            } else if (cGradeCount === 1 || bGradeCount >= 3) {
                grade = 'c';
            } else if (bGradeCount > 0) {
                grade = 'b';
            } else if (bodyCount === 1 || (scratchCount > 0 && scratchCount <= 2)) {
                grade = 'a';
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

            sealed: "誘멸컻遊?(?덉긽??",

            s: "S湲?(理쒓퀬)",

            a: "A湲?(源⑤걮)",

            b: "B湲?(?ъ슜媛?",

            c: "C湲?(?뚯넀/湲곕뒫)",

            d: "D湲?(?ы븳 ?뚯넀)"

        };

        const gradeName = gradeNames[grade] || grade;



        document.getElementById('result-model-name').textContent = `${currentQuote.model.model} (${currentQuote.storage.size})`;

        document.getElementById('final-price-display').innerText = formatCurrency(finalPrice);



        let breakdown = `<p><strong>?먯젙 ?깃툒:</strong> <span style="color:var(--primary-color)">${gradeName}</span></p>`;

        if (isSimpleMode) {

            breakdown += `<p style="color:#888; font-size:0.8rem;">* 媛꾪렪 ?묒닔(?덉긽 理쒓퀬媛)</p>`;

        }

        breakdown += `<p>?⑸웾 ?듭뀡(${currentQuote.storage.size}): ${storageAdj > 0 ? '+' : ''}${formatCurrency(storageAdj)}</p>`;



        // Debug info if price is 0

        if (baseGradePrice === 0) {

            breakdown += `<p style="color:red; font-size:0.8rem;">* 二쇱쓽: ?대떦 ?깃툒???쒖꽭 ?곗씠?곌? ?놁뒿?덈떎(0??.</p>`;

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

            alert("?쒖꽭 ?곗씠?곌? ?놁뒿?덈떎. 愿由ъ옄 ?섏씠吏?먯꽌 留덉씠洹몃젅?댁뀡???뺤씤?댁＜?몄슂.");

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



    } catch (e) {

        console.error("Fetch Data Error:", e);

        alert("?곗씠??濡쒕뵫 ?ㅽ뙣: " + e.message);

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

        // Auth Step Listeners (Verification Temporarily Disabled)
        const btnAuthNext = document.getElementById('btn-auth-next');

        if (btnAuthNext) {
            btnAuthNext.addEventListener('click', () => {
                const name = document.getElementById('auth-name').value.trim();
                const phone = document.getElementById('auth-phone').value.trim();
                const agreeTerms = document.getElementById('agree-terms').checked;

                if (!name || !phone) {
                    alert('?대쫫怨??대???踰덊샇瑜?紐⑤몢 ?낅젰?댁＜?몄슂.');
                    return;
                }

                if (!agreeTerms) {
                    alert('?댁슜?쎄? 諛?媛쒖씤?뺣낫 泥섎━諛⑹묠???숈쓽??二쇱꽭??');
                    return;
                }

                goToStep(7);
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
                    // Courier implies pickup? No 'courier' in my HTML was '?앸같 諛⑸Ц?섍굅'.
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
            newSubmit.addEventListener('click', () => {
                const name = document.getElementById('auth-name').value.trim();
                const phone = document.getElementById('auth-phone').value.trim();
                const address = document.getElementById('customer-address').value.trim();
                const account = document.getElementById('customer-account').value.trim();

                let deliveryMethod = currentQuote.deliveryMethod;
                if (!deliveryMethod) {
                    const activeBtn = document.querySelector('.method-btn.active');
                    if (activeBtn) deliveryMethod = activeBtn.dataset.method;
                    else deliveryMethod = 'courier';
                }

                const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);

                if (!name || !phone) {
                    alert("?대쫫怨??곕씫泥섎? ?뺥솗???낅젰?댁＜?몄슂.");
                    if(typeof goToStep === 'function') goToStep('auth');
                    return;
                }
                if (needsAddress && !address) {
                    alert("?섍굅吏 二쇱냼瑜??낅젰?댁＜?몄슂.");
                    return;
                }
                if (!account) {
                    alert("?뺤궛???꾪빐 怨꾩쥖踰덊샇瑜??낅젰?댁＜?몄슂.");
                    return;
                }

                if (window.openPresaleModal) window.openPresaleModal();
            });
        }
    }
    // New Function: Render Grade Price List (Read-Only)
    window.renderGradePriceList = () => {
        const container = document.getElementById('grade-price-list-target');
        if (!container || !currentQuote.model) return;

        if (currentQuote.model.model === '湲고? 湲곗쥌') {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #eee;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">?뵇</div>
                    <h3 style="color: #333; margin-bottom: 10px; font-weight: 700;">湲고? 湲곗쥌 ?곹깭?뺤씤 ?덈궡</h3>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                        紐⑸줉???녿뒗 湲고? 湲곗쥌? 湲곌린 ?곹깭 寃?????뺥솗??寃ъ쟻???곗텧?⑸땲??<br>
                        ??듭쟻???④?媛 沅곴툑?섏떆?ㅻ㈃ 怨좉컼?쇳꽣濡?臾몄쓽??二쇱꽭??
                    </p>
                    <button onclick="if(window.ChannelIO){ChannelIO('showMessenger')}else{alert('梨꾪똿 ?곷떞 ?곌껐 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎.')}" class="btn btn-secondary" style="background: #2563EB; color: white; border: none; font-weight: 600;">梨꾪똿?쇰줈 ?④? 臾몄쓽?섍린</button>
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
                s: { title: "S湲?(誘몄궗??理쒓퀬)", desc: "湲곗뒪 ?녿뒗 理쒓퀬 ?곹깭" },
                a: { title: "A湲?(源⑤걮)", desc: "誘몄꽭 湲곗뒪 1~2怨? },
                b: { title: "B湲?(?ъ슜媛?", desc: "李랁옒/湲곗뒪 ?ㅼ닔" },
                c: { title: "C湲?(?뚯넀)", desc: "?붾㈃ ?뚯넀/湲곕뒫 遺덈웾" },
                d: { title: "D湲?(?ы븳 ?뚯넀)", desc: "?ы븳 ?뚯넀/湲곕뒫 遺덈웾" }
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
            console.log("Simple Mode: Showing Grade List");

            // Set default / placeholder values for Simple Quote
            currentQuote.grade = 's'; // Default to S Grade
            // Calculate S Grade Price
            let sPrice = 0;
            if (currentQuote.model.prices && currentQuote.model.prices['s']) {
                sPrice = currentQuote.model.prices['s'];
            } else {
                sPrice = currentQuote.model.basePrice || 0;
            }

            if (currentQuote.storage) sPrice += (currentQuote.storage.priceAdjustment || 0);

            // Round
            currentQuote.finalPrice = Math.floor(sPrice / 1000) * 1000;

            renderGradePriceList();
            goToStep('grade-list');
        } else {
            goToStep('defects');
        }
    };

    // Helper for Samsung Series Grouping
    function getSamsungParentCategory(seriesName) {
        if (!seriesName) return '湲고? 湲곗쥌';
        const s = seriesName.toUpperCase();
        if (s.includes('?대뱶') || s.includes('FOLD') || s.includes('Z FOLD')) return '?대뱶 ?쒕━利?;
        if (s.includes('?뚮┰') || s.includes('FLIP') || s.includes('Z FLIP')) return '?뚮┰ ?쒕━利?;
        if (s.includes('?명듃') || s.includes('NOTE')) return '?명듃 ?쒕━利?;
        if (s.includes('S') && /[0-9]/.test(s) && !s.includes('?뚮┰') && !s.includes('?대뱶') && !s.includes('?명듃')) return 'S ?쒕━利?;
        if (s.includes('A') && /[0-9]/.test(s)) return 'A ?쒕━利?;
        return '湲고? 湲곗쥌';
    }

    // Step 2: Series
    function renderSeries(brand) {
        const container = document.getElementById('series-list');
        container.innerHTML = '';

        const products = allProducts.filter(p => p.brand === brand);
        
        let seriesSet;
        if (brand === 'samsung') {
            seriesSet = new Set();
            products.forEach(p => seriesSet.add(getSamsungParentCategory(p.series)));
        } else {
            seriesSet = new Set(products.map(p => p.series || '湲고?'));
        }
        
        // Advanced sorting
        let seriesList;
        if (brand === 'samsung') {
            const order = ['S ?쒕━利?, '?대뱶 ?쒕━利?, '?뚮┰ ?쒕━利?, '?명듃 ?쒕━利?, 'A ?쒕━利?, '湲고? 湲곗쥌'];
            seriesList = Array.from(seriesSet).sort((a, b) => {
                let idxA = order.indexOf(a);
                let idxB = order.indexOf(b);
                if (idxA === -1) idxA = 99;
                if (idxB === -1) idxB = 99;
                return idxA - idxB;
            });
        } else {
            seriesList = Array.from(seriesSet).sort((a, b) => {
                if (a === '湲고?') return 1;
                if (b === '湲고?') return -1;
                const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
                if (numA !== numB) return numB - numA;
                return b.localeCompare(a); 
            });
        }

        if (seriesList.length === 0) {
            container.innerHTML = '<div>?대떦 釉뚮옖?쒖쓽 紐⑤뜽???놁뒿?덈떎.</div>';
            return;
        }

        seriesList.forEach((series, index) => {
            if (series === '湲고?' || series === '湲고? 湲곗쥌') return; // Handled below

            const card = document.createElement('div');
            card.className = 'selection-card';
            card.style.position = 'relative'; // absolute badge positioning
            card.style.transition = '0.2s';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.padding = '15px';
            
            let extraHtml = '';
            
            // Show badges mainly for Apple as before
            if (brand === 'apple') {
                if (index === 0) {
                    card.style.borderColor = '#ef4444';
                    extraHtml = '<span style="position: absolute; top: -12px; right: -5px; background: #ef4444; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.70rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">NEW</span>';
                } 
                else if (index === 1) {
                    card.style.borderColor = '#f59e0b';
                    extraHtml = '<span style="position: absolute; top: -12px; right: -5px; background: #f59e0b; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.70rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">HOT</span>';
                }
            }

            // Optional Image for Categories
            let imgHtml = '';
            if (brand === 'samsung') {
                let imgSrc = '';
                if (series === 'S ?쒕━利?) imgSrc = 'assets/series/samsung/s?쒕━利?png';
                else if (series === '?대뱶 ?쒕━利?) imgSrc = 'assets/series/samsung/?대뱶 ?쒕━利?png';
                else if (series === '?뚮┰ ?쒕━利?) imgSrc = 'assets/series/samsung/?뚮┰ ?쒕━利?png';
                else if (series === '?명듃 ?쒕━利?) imgSrc = 'assets/series/samsung/媛ㅻ윮?쒕끂??png';
                
                if (imgSrc) {
                    imgHtml = `<img src="${imgSrc}" style="height: 80px; object-fit: contain; margin-bottom: 8px;" alt="${series}">`;
                }
            } else if (brand === 'apple') {
                const baseName = series.replace('?쒕━利?, '').replace(/\s+/g, '').toLowerCase();
                const imgSrc = `assets/series/apple/${baseName}.png`;
                
                // Set fallback to avoid broken image icons if image isn't uploaded yet
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

        // Add "Other" Option
        const otherCard = document.createElement('div');
        otherCard.className = 'selection-card';
        otherCard.style.borderColor = '#ccc';
        otherCard.style.backgroundColor = '#f8f9fa';
        otherCard.style.display = 'flex';
        otherCard.style.alignItems = 'center';
        otherCard.style.justifyContent = 'center';
        otherCard.innerHTML = `<div class="card-title" style="color: #555;">湲고? 湲곗쥌 (紐⑸줉???놁쓬)</div>`;
        otherCard.onclick = () => {
            currentQuote.series = '湲고?';
            currentQuote.model = {
                brand: brand,
                series: '湲고?',
                model: '湲고? 湲곗쥌',
                basePrice: 0,
                prices: {},
                storageOptions: [{ size: '?대떦?놁쓬', priceAdjustment: 0 }]
            };
            currentQuote.storage = currentQuote.model.storageOptions[0];
            goToStep('method'); 
            selectMethod('simple');
        };
        container.appendChild(otherCard);

        // Add "Not Found" Option
        const notFoundCard = document.createElement('div');
        notFoundCard.className = 'selection-card';
        notFoundCard.style.borderColor = '#2563EB';
        notFoundCard.style.backgroundColor = '#EFF6FF';
        notFoundCard.innerHTML = `<div class="card-title" style="color: #1E3A8A;">李얜뒗 ?쒕━利덇? ?녿굹??</div><div class="card-sub" style="color:#2563EB;">梨꾪똿?곷떞 臾몄쓽?섍린</div>`;
        notFoundCard.onclick = () => {
            if (window.ChannelIO) {
                ChannelIO('showMessenger');
            } else {
                alert('梨꾪똿 ?곷떞 ?뚮윭洹몄씤??遺덈윭?????놁뒿?덈떎.');
            }
        };
        // container.appendChild(notFoundCard); // Temporarily hidden
    }

    // Step 2-Sub: Detailed Series (For Samsung)
    function renderSubSeries(brand, parentCategory) {
        const container = document.getElementById('sub-series-list');
        container.innerHTML = '';

        // Filter products that belong to the selected parent category
        const productsInParent = allProducts.filter(p => p.brand === brand && getSamsungParentCategory(p.series) === parentCategory);
        
        // Extract unique specific series (e.g., 'S24', 'S23')
        const specificSeriesSet = new Set();
        productsInParent.forEach(p => {
            if (p.series) specificSeriesSet.add(p.series);
        });

        // Sort descending (S25 -> S24 -> S23)
        const specificSeriesList = Array.from(specificSeriesSet).sort((a, b) => {
            // simple string sort in descending order works for S24 vs S23
            return b.localeCompare(a);
        });

        if (specificSeriesList.length === 0) {
            container.innerHTML = '<div>?대떦 移댄뀒怨좊━??紐⑤뜽???놁뒿?덈떎.</div>';
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
            
            // Clean up name for display if needed
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

    // Step 3: Model
    function renderModels(brand, specificSeriesOrParent) {
        const container = document.getElementById('model-list');
        container.innerHTML = '';

        let models;
        if (brand === 'samsung') {
            // For Samsung, we now pass exact specific series (e.g., 'S24') instead of parent category
            models = allProducts.filter(p => p.brand === brand && p.series === specificSeriesOrParent);
            models.sort((a, b) => {
                return (b.basePrice || 0) - (a.basePrice || 0);
            });
        } else {
            models = allProducts.filter(p => p.brand === brand && (p.series || '湲고?') === specificSeriesOrParent);
            models.sort((a, b) => b.basePrice - a.basePrice);
        }

        models.forEach(item => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            
            let subtext = '';
            if (brand === 'samsung' && item.series) {
                const cleanSeriesName = item.series.replace('媛ㅻ윮??', '').replace(' ?쒕━利?, '');
                subtext = `<div style="font-size:0.75rem; color:#888; margin-top:4px;">${cleanSeriesName}</div>`;
            }
            
            card.innerHTML = `<div class="card-title">${item.model}</div>${subtext}`;
            card.onclick = () => {
                currentQuote.model = item;
                renderStorage(item);
                goToStep(4);
            };
            container.appendChild(card);
        });
    }

    // Step 4: Storage
    function renderStorage(modelData) {
        const container = document.getElementById('storage-list');
        container.innerHTML = '';

        const options = modelData.storageOptions || [
            { size: "Default", priceAdjustment: 0 }
        ];

        options.forEach(opt => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            card.innerHTML = `
    <div class="card-title">${opt.size}</div>
        <div class="card-sub">${opt.priceAdjustment > 0 ? '+' : ''}${opt.priceAdjustment / 10000}留?/div>
`;
            card.onclick = () => {
                currentQuote.storage = opt;
                goToStep('method'); // Go to Method Selection
            };
            container.appendChild(card);
        });
        
        // Add custom option
        const customCard = document.createElement('div');
        customCard.className = 'selection-card';
        customCard.innerHTML = `
            <div class="card-title" style="font-size: 1.1rem;">李얜뒗 ?⑸웾???놁뼱??/div>
            <div class="card-sub" style="font-weight: 500; color: #2563EB; margin-top: 10px;">吏곸젒 ?낅젰?섍린</div>
        `;
        customCard.onclick = () => {
            const inputVal = prompt("?대떦 湲곌린????κ났媛??⑸웾??吏곸젒 ?낅젰?댁＜?몄슂 (?? 64GB, 256GB ??");
            if (inputVal && inputVal.trim() !== "") {
                currentQuote.storage = { size: inputVal.trim() + " (吏곸젒?낅젰)", priceAdjustment: 0 };
                goToStep('method'); // Go to Method Selection
            }
        };
        container.appendChild(customCard);
    }

    function calculateFinalPrice() {
        if (!currentQuote.model || !currentQuote.grade) return;

        // Get the price for the specific grade
        // prices obj: { sealed: 100, s: 90, ... }
        let baseGradePrice = currentQuote.model.prices[currentQuote.grade] || 0;

        // Add Storage Adjustment
        let storageAdj = currentQuote.storage.priceAdjustment || 0;

        let finalPrice = baseGradePrice + storageAdj;

        if (finalPrice < 0) finalPrice = 0;

        // Grade Name Mapping
        const gradeNames = {
            sealed: "誘멸컻遊?(?덉긽??",
            s: "S湲?(理쒓퀬)",
            a: "A湲?(源⑤걮)",
            b: "B湲?(?ъ슜媛?",
            c: "C湲?(?뚯넀)",
            d: "D湲?(?먰룿)"
        };

        const gradeName = gradeNames[currentQuote.grade] || currentQuote.grade;

        let breakdownHtml = `
    <p><strong>?좏깮?섏떊 ?깃툒:</strong> <span style="color:var(--primary-color)">${gradeName}</span></p>
            <p>?깃툒 湲곕낯媛: <strong>${formatCurrency(baseGradePrice)}</strong></p>
            <p>?⑸웾 ?듭뀡 (${currentQuote.storage.size}): ${storageAdj > 0 ? '+' : ''}${formatCurrency(storageAdj)}</p>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
        `;

        finalPrice = Math.floor(finalPrice / 1000) * 1000;
        if (finalPrice < 0) finalPrice = 0;

        currentQuote.finalPrice = finalPrice;
        document.getElementById('result-model-name').textContent = `${currentQuote.model.model} (${currentQuote.storage.size})`;
        document.getElementById('final-price-display').textContent = formatCurrency(finalPrice);
        document.getElementById('price-breakdown').innerHTML = breakdownHtml;
    }

    async function handleFinalSubmit() {
        const btnSubmit = document.getElementById('btn-submit-final');
        const name = document.getElementById('auth-name').value;
        const phone = document.getElementById('auth-phone').value;
        const address = document.getElementById('customer-address').value;
        const account = document.getElementById('customer-account').value;
        const memo = document.getElementById('customer-memo') ? document.getElementById('customer-memo').value : '';

        // Default to 'pickup' (Visiting Pickup old default) or 'courier' (new default)
        // If not set, check active btn
        let deliveryMethod = currentQuote.deliveryMethod;
        if (!deliveryMethod) {
            const activeBtn = document.querySelector('.method-btn.active');
            if (activeBtn) deliveryMethod = activeBtn.dataset.method;
            else deliveryMethod = 'courier';
        }

        if (!name || !phone) {
            alert("?대쫫怨??곕씫泥섎? ?낅젰?댁＜?몄슂.");
            return;
        }

        // Validation: Address required for visiting services
        // pickup_samil (Same day), courier (Visiting), pickup (Legacy)
        const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);
                if (deliveryMethod === 'courier' && !pickupDate) {
                    if (errorMsg) {
                        errorMsg.innerText = "방문날짜를 선택해주세요.";
                        errorMsg.style.display = 'block';
                    } else {
                        alert("방문날짜를 선택해주세요.");
                    }
                    return;
                }
                if (needsAddress && !address) {
            alert("?섍굅瑜??꾪빐 二쇱냼瑜??낅젰?댁＜?몄슂.");
            return;
        }

        if (!account) {
            alert("?뺤궛???꾪빐 怨꾩쥖踰덊샇瑜??낅젰?댁＜?몄슂.");
            return;
        }

        // --- VALIDATIONS PASSED: Save payload for later submission ---
        window.pendingSubmitPayload = {
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
            customerAddress: needsAddress ? address : '?몄쓽??吏곸젒 ?앸같 諛쒖넚',
            deliveryMethod: deliveryMethod,
            customerAccount: account,
            customerMemo: memo,
            userId: auth.currentUser ? auth.currentUser.uid : 'anonymous',
            firebaseTimestamp: serverTimestamp(),
            method: currentQuote.method || 'simple',
            defectsDetails: currentQuote.defectsDetails || {}
        };

        // Open Pre-sale Modal Instead of Submitting Immediately
        if (window.openPresaleModal) {
            window.openPresaleModal();
        } else {
            console.error("Presale modal not found, submitting directly");
            window.actuallySubmitQuote();
        }
    }

    // --- NEW: Actually Submit Quote (Called after Modal Consent) ---
    window.actuallySubmitQuote = async () => {
        const btnSubmit = document.getElementById('btn-submit-final');
        const presaleBtnSubmit = document.querySelector('.presale-btn-next');
        
        if (btnSubmit) {
            btnSubmit.textContent = '泥섎━ 以?..';
            btnSubmit.disabled = true;
        }
        if (presaleBtnSubmit) {
            presaleBtnSubmit.textContent = '泥섎━ 以?..';
            presaleBtnSubmit.disabled = true;
        }

        const payload = window.pendingSubmitPayload;
        if (!payload) return alert("?좎껌 ?곗씠?곕? 李얠쓣 ???놁뒿?덈떎.");

        try {
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }
            await addDoc(collection(db, "quotes"), payload);
            
            // --- GA4 Event Tracking: Quote Completed ---
            if (typeof gtag !== 'undefined') {
                gtag('event', 'quote_completed', {
                    'event_category': 'quote',
                    'event_label': payload.model || 'Unknown Model',
                    'value': payload.price || 0
                });
            }

            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).catch(e => console.log("GAS Error ignored:", e));

            // --- Send Telegram Notification ---
            const tgMessage = `
?뵒 *?덈줈??留ㅼ엯 ?좎껌 ?뚮┝*
?곣봺?곣봺?곣봺?곣봺?곣봺?곣봺?곣봺
?뫀 *?좎껌??: ${payload.customerName}
?뱸 *?곕씫泥?: ${payload.customerPhone}
?벑 *紐⑤뜽*: ${payload.brand} ${payload.model} (${payload.storage})
?뭿 *?깃툒*: ${payload.grade}
?뮥 *?덉긽媛*: ${new Intl.NumberFormat('ko-KR').format(payload.price)}???슊 *諛⑹떇*: ${payload.deliveryMethod === 'courier' ? '?앸같 諛⑸Ц?섍굅' : '?몄쓽???앸같'}
?뱷 *硫붾え*: ${payload.customerMemo || '?놁쓬'}
?곣봺?곣봺?곣봺?곣봺?곣봺?곣봺?곣봺
            `.trim();

            fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: tgMessage,
                    parse_mode: 'Markdown'
                })
            }).catch(e => console.error("Telegram Notification Error:", e));

            // Update Success Message
            const successDiv = document.getElementById('success-instruction');
            let msgTitle = "";
            let msgDesc = "";

            if (payload.deliveryMethod === 'courier' || payload.deliveryMethod === 'pickup') {
                msgTitle = "?벀 ?앸같 諛⑸Ц?섍굅 ?묒닔 ?꾨즺";
                msgDesc = "臾??욎뿉 諛뺤뒪瑜??먯떆硫?湲곗궗?섏씠 ?섍굅??媛??덉젙?낅땲?? (1~2????";
            } else if (payload.deliveryMethod === 'cvs') {
                msgTitle = "?룵 ?몄쓽??吏곸젒 ?앸같 ?덈궡";
                msgDesc = "?꾨옒 二쇱냼濡?湲곌린瑜?<strong>李⑸텋</strong>濡?蹂대궡二쇱꽭??";
            }

            if(successDiv) {
                successDiv.innerHTML = `
                    <h4 style="color: #2196F3; margin-bottom: 10px;">${msgTitle}</h4>
                    <p>${msgDesc}</p>
                    <div style="background: white; padding: 15px; border: 1px solid #ddd; border-radius: 6px; margin: 10px 0;">
                        <strong>遺?곌킅??떆 遺?곗쭊援??꾪룷??686-1 ?붾툝猷? 719???먮씪??/strong><br>
                        <span style="font-size: 0.9rem; color: #666;">Tel: 010-5173-5382</span>
                    </div>
                    <p style="font-size: 0.9rem; color: #666;">* 留덉씠?섏씠吏?먯꽌 吏꾪뻾 ?곹솴???뺤씤?섏떎 ???덉뒿?덈떎.</p>
                `;
            }

            if (typeof gtag !== 'undefined') {
                gtag('event', 'generate_lead', {
                    'event_category': 'Quote',
                    'event_label': `${payload.brand} ${payload.model}`,
                    'value': payload.price,
                    'currency': 'KRW'
                });
            }

            if(window.closePresaleModal) window.closePresaleModal();
            goToStep(8); // Success Step

        } catch (e) {
            console.error("Submit Error:", e);
            alert("?쒖텧 ?ㅽ뙣: " + e.message);
            if (btnSubmit) {
                btnSubmit.textContent = '?좎껌 ?꾨즺?섍린';
                btnSubmit.disabled = false;
            }
            if(presaleBtnSubmit) {
                presaleBtnSubmit.textContent = '?숈쓽?섍퀬 ?묒닔 ?꾨즺?섍린';
                presaleBtnSubmit.disabled = false;
            }
        }
    }



    // New Function: Render Grade Price List (Read-Only)
    window.renderGradePriceList = () => {
        const container = document.getElementById('grade-price-list-target');
        if (!container || !currentQuote.model) return;

        if (currentQuote.model.model === '湲고? 湲곗쥌') {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #eee;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">?뵇</div>
                    <h3 style="color: #333; margin-bottom: 10px; font-weight: 700;">湲고? 湲곗쥌 ?곹깭?뺤씤 ?덈궡</h3>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                        紐⑸줉???녿뒗 湲고? 湲곗쥌? 湲곌린 ?곹깭 寃?????뺥솗??寃ъ쟻???곗텧?⑸땲??<br>
                        ??듭쟻???④?媛 沅곴툑?섏떆?ㅻ㈃ 怨좉컼?쇳꽣濡?臾몄쓽??二쇱꽭??
                    </p>
                    <button onclick="if(window.ChannelIO){ChannelIO('showMessenger')}else{alert('梨꾪똿 ?곷떞 ?곌껐 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎.')}" class="btn btn-secondary" style="background: #2563EB; color: white; border: none; font-weight: 600;">梨꾪똿?쇰줈 ?④? 臾몄쓽?섍린</button>
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
                s: { title: "S湲?(誘몄궗??理쒓퀬)", desc: "湲곗뒪 ?녿뒗 理쒓퀬 ?곹깭" },
                a: { title: "A湲?(源⑤걮)", desc: "誘몄꽭 湲곗뒪 1~2怨? },
                b: { title: "B湲?(?ъ슜媛?", desc: "李랁옒/湲곗뒪 ?ㅼ닔" },
                c: { title: "C湲?(?뚯넀)", desc: "?붾㈃ ?뚯넀/湲곕뒫 遺덈웾" },
                d: { title: "D湲?(?ы븳 ?뚯넀)", desc: "?ы븳 ?뚯넀/湲곕뒫 遺덈웾" }
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
            console.log("Simple Mode: Showing Grade List");

            // Set default / placeholder values for Simple Quote
            currentQuote.grade = 's'; // Default to S Grade
            // Calculate S Grade Price
            let sPrice = 0;
            if (currentQuote.model.prices && currentQuote.model.prices['s']) {
                sPrice = currentQuote.model.prices['s'];
            } else {
                sPrice = currentQuote.model.basePrice || 0;
            }

            if (currentQuote.storage) sPrice += (currentQuote.storage.priceAdjustment || 0);

            // Round
            currentQuote.finalPrice = Math.floor(sPrice / 1000) * 1000;

            renderGradePriceList();
            goToStep('grade-list');
        } else {
            goToStep('defects');
        }
    };

    // Helper for Samsung Series Grouping
    function getSamsungParentCategory(seriesName) {
        if (!seriesName) return '湲고? 湲곗쥌';
        const s = seriesName.toUpperCase();
        if (s.includes('?대뱶') || s.includes('FOLD') || s.includes('Z FOLD')) return '?대뱶 ?쒕━利?;
        if (s.includes('?뚮┰') || s.includes('FLIP') || s.includes('Z FLIP')) return '?뚮┰ ?쒕━利?;
        if (s.includes('?명듃') || s.includes('NOTE')) return '?명듃 ?쒕━利?;
        if (s.includes('S') && /[0-9]/.test(s) && !s.includes('?뚮┰') && !s.includes('?대뱶') && !s.includes('?명듃')) return 'S ?쒕━利?;
        if (s.includes('A') && /[0-9]/.test(s)) return 'A ?쒕━利?;
        return '湲고? 湲곗쥌';
    }

    // Step 2: Series
    function renderSeries(brand) {
        const container = document.getElementById('series-list');
        container.innerHTML = '';

        const products = allProducts.filter(p => p.brand === brand);

        let seriesSet;
        if (brand === 'samsung') {
            seriesSet = new Set();
            products.forEach(p => seriesSet.add(getSamsungParentCategory(p.series)));
        } else {
            seriesSet = new Set(products.map(p => p.series || '湲고?'));
        }

        // Advanced sorting
        let seriesList;
        if (brand === 'samsung') {
            const order = ['S ?쒕━利?, '?대뱶 ?쒕━利?, '?뚮┰ ?쒕━利?, '?명듃 ?쒕━利?, 'A ?쒕━利?, '湲고? 湲곗쥌'];
            seriesList = Array.from(seriesSet).sort((a, b) => {
                let idxA = order.indexOf(a);
                let idxB = order.indexOf(b);
                if (idxA === -1) idxA = 99;
                if (idxB === -1) idxB = 99;
                return idxA - idxB;
            });
        } else {
            seriesList = Array.from(seriesSet).sort((a, b) => {
                if (a === '湲고?') return 1;
                if (b === '湲고?') return -1;
                const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
                if (numA !== numB) return numB - numA;
                return b.localeCompare(a);
            });
        }

        if (seriesList.length === 0) {
            container.innerHTML = '<div>?대떦 釉뚮옖?쒖쓽 紐⑤뜽???놁뒿?덈떎.</div>';
            return;
        }

        seriesList.forEach((series, index) => {
            if (series === '湲고?' || series === '湲고? 湲곗쥌') return; // Handled below

            const card = document.createElement('div');
            card.className = 'selection-card';
            card.style.position = 'relative'; // absolute badge positioning
            card.style.transition = '0.2s';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'center';
            card.style.justifyContent = 'center';
            card.style.padding = '15px';

            let extraHtml = '';

            // Show badges mainly for Apple as before
            if (brand === 'apple') {
                if (index === 0) {
                    card.style.borderColor = '#ef4444';
                    extraHtml = '<span style="position: absolute; top: -12px; right: -5px; background: #ef4444; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.70rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">NEW</span>';
                }
                else if (index === 1) {
                    card.style.borderColor = '#f59e0b';
                    extraHtml = '<span style="position: absolute; top: -12px; right: -5px; background: #f59e0b; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.70rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">HOT</span>';
                }
            }

            // Optional Image for Categories
            let imgHtml = '';
            if (brand === 'samsung') {
                let imgSrc = '';
                if (series === 'S ?쒕━利?) imgSrc = 'assets/series/samsung/s?쒕━利?png';
                else if (series === '?대뱶 ?쒕━利?) imgSrc = 'assets/series/samsung/?대뱶 ?쒕━利?png';
                else if (series === '?뚮┰ ?쒕━利?) imgSrc = 'assets/series/samsung/?뚮┰ ?쒕━利?png';
                else if (series === '?명듃 ?쒕━利?) imgSrc = 'assets/series/samsung/媛ㅻ윮?쒕끂??png';

                if (imgSrc) {
                    imgHtml = `<img src="${imgSrc}" style="height: 80px; object-fit: contain; margin-bottom: 8px;" alt="${series}">`;
                }
            } else if (brand === 'apple') {
                const baseName = series.replace('?쒕━利?, '').replace(/\s+/g, '').toLowerCase();
                const imgSrc = `assets/series/apple/${baseName}.png`;

                // Set fallback to avoid broken image icons if image isn't uploaded yet
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

        // Add "Other" Option
        const otherCard = document.createElement('div');
        otherCard.className = 'selection-card';
        otherCard.style.borderColor = '#ccc';
        otherCard.style.backgroundColor = '#f8f9fa';
        otherCard.style.display = 'flex';
        otherCard.style.alignItems = 'center';
        otherCard.style.justifyContent = 'center';
        otherCard.innerHTML = `<div class="card-title" style="color: #555;">湲고? 湲곗쥌 (紐⑸줉???놁쓬)</div>`;
        otherCard.onclick = () => {
            currentQuote.series = '湲고?';
            currentQuote.model = {
                brand: brand,
                series: '湲고?',
                model: '湲고? 湲곗쥌',
                basePrice: 0,
                prices: {},
                storageOptions: [{ size: '?대떦?놁쓬', priceAdjustment: 0 }]
            };
            currentQuote.storage = currentQuote.model.storageOptions[0];
            goToStep('method');
            selectMethod('simple');
        };
        container.appendChild(otherCard);

        // Add "Not Found" Option
        const notFoundCard = document.createElement('div');
        notFoundCard.className = 'selection-card';
        notFoundCard.style.borderColor = '#2563EB';
        notFoundCard.style.backgroundColor = '#EFF6FF';
        notFoundCard.innerHTML = `<div class="card-title" style="color: #1E3A8A;">李얜뒗 ?쒕━利덇? ?녿굹??</div><div class="card-sub" style="color:#2563EB;">梨꾪똿?곷떞 臾몄쓽?섍린</div>`;
        notFoundCard.onclick = () => {
            if (window.ChannelIO) {
                ChannelIO('showMessenger');
            } else {
                alert('梨꾪똿 ?곷떞 ?뚮윭洹몄씤??遺덈윭?????놁뒿?덈떎.');
            }
        };
        // container.appendChild(notFoundCard); // Temporarily hidden
    }

    // Step 2-Sub: Detailed Series (For Samsung)
    function renderSubSeries(brand, parentCategory) {
        const container = document.getElementById('sub-series-list');
        container.innerHTML = '';

        // Filter products that belong to the selected parent category
        const productsInParent = allProducts.filter(p => p.brand === brand && getSamsungParentCategory(p.series) === parentCategory);

        // Extract unique specific series (e.g., 'S24', 'S23')
        const specificSeriesSet = new Set();
        productsInParent.forEach(p => {
            if (p.series) specificSeriesSet.add(p.series);
        });

        // Sort descending (S25 -> S24 -> S23)
        const specificSeriesList = Array.from(specificSeriesSet).sort((a, b) => {
            // simple string sort in descending order works for S24 vs S23
            return b.localeCompare(a);
        });

        if (specificSeriesList.length === 0) {
            container.innerHTML = '<div>?대떦 移댄뀒怨좊━??紐⑤뜽???놁뒿?덈떎.</div>';
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

            // Clean up name for display if needed
            const displayName = seriesName;

            // ------------------------------------------------------------------
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

    // Step 3: Model
    function renderModels(brand, specificSeriesOrParent) {
        const container = document.getElementById('model-list');
        container.innerHTML = '';

        let models;
        if (brand === 'samsung') {
            // For Samsung, we now pass exact specific series (e.g., 'S24') instead of parent category
            models = allProducts.filter(p => p.brand === brand && p.series === specificSeriesOrParent);
            models.sort((a, b) => {
                return (b.basePrice || 0) - (a.basePrice || 0);
            });
        } else {
            models = allProducts.filter(p => p.brand === brand && (p.series || '湲고?') === specificSeriesOrParent);
            models.sort((a, b) => b.basePrice - a.basePrice);
        }

        models.forEach(item => {
            const card = document.createElement('div');
            card.className = 'selection-card';

            let subtext = '';
            if (brand === 'samsung' && item.series) {
                const cleanSeriesName = item.series.replace('媛ㅻ윮??', '').replace(' ?쒕━利?, '');
                subtext = `<div style="font-size:0.75rem; color:#888; margin-top:4px;">${cleanSeriesName}</div>`;
            }

            card.innerHTML = `<div class="card-title">${item.model}</div>${subtext}`;
            card.onclick = () => {
                currentQuote.model = item;
                renderStorage(item);
                goToStep(4);
            };
            container.appendChild(card);
        });
    }

    // Step 4: Storage
    function renderStorage(modelData) {
        const container = document.getElementById('storage-list');
        container.innerHTML = '';

        const options = modelData.storageOptions || [
            { size: "Default", priceAdjustment: 0 }
        ];

        options.forEach(opt => {
            const card = document.createElement('div');
            card.className = 'selection-card';
            card.innerHTML = `
    <div class="card-title">${opt.size}</div>
        <div class="card-sub">${opt.priceAdjustment > 0 ? '+' : ''}${opt.priceAdjustment / 10000}留?/div>
`;
            card.onclick = () => {
                currentQuote.storage = opt;
                goToStep('method'); // Go to Method Selection
            };
            container.appendChild(card);
        });
        // Add custom option
        const customCard = document.createElement('div');
        customCard.className = 'selection-card';
        customCard.innerHTML = `
            <div class="card-title" style="font-size: 1.1rem;">李얜뒗 ?⑸웾???놁뼱??/div>
            <div class="card-sub" style="font-weight: 500; color: #2563EB; margin-top: 10px;">吏곸젒 ?낅젰?섍린</div>
        `;
        customCard.onclick = () => {
            const inputVal = prompt("?대떦 湲곌린????κ났媛??⑸웾??吏곸젒 ?낅젰?댁＜?몄슂 (?? 64GB, 256GB ??");
            if (inputVal && inputVal.trim() !== "") {
                currentQuote.storage = { size: inputVal.trim() + " (吏곸젒?낅젰)", priceAdjustment: 0 };
                goToStep('method'); // Go to Method Selection
            }
        };
        container.appendChild(customCard);
    }

    function calculateFinalPrice() {
        if (!currentQuote.model || !currentQuote.grade) return;

        // Get the price for the specific grade
        // prices obj: { sealed: 100, s: 90, ... }
        let baseGradePrice = currentQuote.model.prices[currentQuote.grade] || 0;

        // Add Storage Adjustment
        let storageAdj = currentQuote.storage.priceAdjustment || 0;

        let finalPrice = baseGradePrice + storageAdj;

        if (finalPrice < 0) finalPrice = 0;

        // Grade Name Mapping
        const gradeNames = {
            sealed: "誘멸컻遊?(?덉긽??",
            s: "S湲?(理쒓퀬)",
            a: "A湲?(源⑤걮)",
            b: "B湲?(?ъ슜媛?",
            c: "C湲?(?뚯넀)",
            d: "D湲?(?먰룿)"
        };

        const gradeName = gradeNames[currentQuote.grade] || currentQuote.grade;

        let breakdownHtml = `
    < p ><strong>?좏깮?섏떊 ?깃툒:</strong> <span style="color:var(--primary-color)">${gradeName}</span></p >
            <p>?깃툒 湲곕낯媛: <strong>${formatCurrency(baseGradePrice)}</strong></p>
            <p>?⑸웾 ?듭뀡 (${currentQuote.storage.size}): ${storageAdj > 0 ? '+' : ''}${formatCurrency(storageAdj)}</p>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
        `;

        finalPrice = Math.floor(finalPrice / 1000) * 1000;
        if (finalPrice < 0) finalPrice = 0;

        currentQuote.finalPrice = finalPrice;
        document.getElementById('result-model-name').textContent = `${currentQuote.model.model} (${currentQuote.storage.size})`;
        document.getElementById('final-price-display').textContent = formatCurrency(finalPrice);
        document.getElementById('price-breakdown').innerHTML = breakdownHtml;
    }

    async function handleFinalSubmit() {
        const btnSubmit = document.getElementById('btn-submit-final');
        const name = document.getElementById('auth-name').value;
        const phone = document.getElementById('auth-phone').value;
        const address = document.getElementById('customer-address').value;
        const account = document.getElementById('customer-account').value;
        const memo = document.getElementById('customer-memo') ? document.getElementById('customer-memo').value : '';

        // Default to 'pickup' (Visiting Pickup old default) or 'courier' (new default)
        // If not set, check active btn
        let deliveryMethod = currentQuote.deliveryMethod;
        if (!deliveryMethod) {
            const activeBtn = document.querySelector('.method-btn.active');
            if (activeBtn) deliveryMethod = activeBtn.dataset.method;
            else deliveryMethod = 'courier';
        }

        if (!name || !phone) {
            alert("?대쫫怨??곕씫泥섎? ?낅젰?댁＜?몄슂.");
            return;
        }

        // Validation: Address required for visiting services
        // pickup_samil (Same day), courier (Visiting), pickup (Legacy)
        const needsAddress = ['courier', 'pickup'].includes(deliveryMethod);
                if (deliveryMethod === 'courier' && !pickupDate) {
                    if (errorMsg) {
                        errorMsg.innerText = "방문날짜를 선택해주세요.";
                        errorMsg.style.display = 'block';
                    } else {
                        alert("방문날짜를 선택해주세요.");
                    }
                    return;
                }
                if (needsAddress && !address) {
            alert("?섍굅瑜??꾪빐 二쇱냼瑜??낅젰?댁＜?몄슂.");
            return;
        }

        if (!account) {
            alert("?뺤궛???꾪빐 怨꾩쥖踰덊샇瑜??낅젰?댁＜?몄슂.");
            return;
        }

        btnSubmit.textContent = '泥섎━ 以?..';
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
            customerAddress: needsAddress ? address : '?몄쓽??吏곸젒 ?앸같 諛쒖넚',
            deliveryMethod: deliveryMethod,
            customerAccount: account,
            customerMemo: memo,
            userId: auth.currentUser ? auth.currentUser.uid : 'anonymous',
            firebaseTimestamp: serverTimestamp(),
            method: currentQuote.method || 'simple',
            defectsDetails: currentQuote.defectsDetails || {}
        };

        try {
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }
            await addDoc(collection(db, "quotes"), payload);
            // --- GA4 Event Tracking: Quote Completed ---
            if (typeof gtag !== 'undefined') {
                gtag('event', 'quote_completed', {
                    'event_category': 'quote',
                    'event_label': payload.modelName || 'Unknown Model',
                    'value': payload.expectedPrice || 0
                });
            }

            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).catch(e => console.log("GAS Error ignored:", e));

            // --- Send Telegram Notification ---
            const tgMessage = `
?뵒 *?덈줈??留ㅼ엯 ?좎껌 ?뚮┝*
?곣봺?곣봺?곣봺?곣봺?곣봺?곣봺?곣봺
?뫀 *?좎껌??: ${payload.customerName}
?뱸 *?곕씫泥?: ${payload.customerPhone}
?벑 *紐⑤뜽*: ${payload.brand} ${payload.model} (${payload.storage})
?뭿 *?깃툒*: ${payload.grade}
?뮥 *?덉긽媛*: ${new Intl.NumberFormat('ko-KR').format(payload.price)}???슊 *諛⑹떇*: ${payload.deliveryMethod === 'courier' ? '?앸같 諛⑸Ц?섍굅' : '?몄쓽???앸같'}
?뱷 *硫붾え*: ${payload.customerMemo || '?놁쓬'}
?곣봺?곣봺?곣봺?곣봺?곣봺?곣봺?곣봺
            `.trim();

            fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: tgMessage,
                    parse_mode: 'Markdown'
                })
            }).catch(e => console.error("Telegram Notification Error:", e));

            // Update Success Message
            const successDiv = document.getElementById('success-instruction');
            let msgTitle = "";
            let msgDesc = "";

            if (deliveryMethod === 'courier' || deliveryMethod === 'pickup') {
                msgTitle = "?벀 ?앸같 諛⑸Ц?섍굅 ?묒닔 ?꾨즺";
                msgDesc = "臾??욎뿉 諛뺤뒪瑜??먯떆硫?湲곗궗?섏씠 ?섍굅??媛??덉젙?낅땲?? (1~2????";
            } else if (deliveryMethod === 'cvs') {
                msgTitle = "?룵 ?몄쓽??吏곸젒 ?앸같 ?덈궡";
                msgDesc = "?꾨옒 二쇱냼濡?湲곌린瑜?<strong>李⑸텋</strong>濡?蹂대궡二쇱꽭??";
            }

            successDiv.innerHTML = `
                <h4 style="color: #2196F3; margin-bottom: 10px;">${msgTitle}</h4>
                <p>${msgDesc}</p>
                <div style="background: white; padding: 15px; border: 1px solid #ddd; border-radius: 6px; margin: 10px 0;">
                    <strong>遺?곌킅??떆 遺?곗쭊援??꾪룷??686-1 ?붾툝猷? 719???먮씪??/strong><br>
                    <span style="font-size: 0.9rem; color: #666;">Tel: 010-5173-5382</span>
                </div>
                <p style="font-size: 0.9rem; color: #666;">* 留덉씠?섏씠吏?먯꽌 吏꾪뻾 ?곹솴???뺤씤?섏떎 ???덉뒿?덈떎.</p>
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
            alert("?쒖텧 ?ㅽ뙣: " + e.message);
            btnSubmit.textContent = '?좎껌 ?꾨즺?섍린';
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
            listContainer.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 40px; color: #888;">?꾩쭅 ?깅줉???꾧린媛 ?놁뒿?덈떎. 泥??꾧린??二쇱씤怨듭씠 ?섏뼱二쇱꽭??</div>';
            return;
        }

        listContainer.innerHTML = ''; // Clear loading text

        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '') : '';
            const rating = data.rating || 5;
            const stars = '狩?.repeat(rating);

            // Mask Name (e.g., ??*??
            let safeName = data.userName || '?듬챸';
            if (safeName.length > 1 && safeName !== '?듬챸') {
                safeName = safeName.substring(0, 1) + '*'.repeat(safeName.length > 2 ? 2 : 1) + '??;
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
                imageHtml = `<div class="home-review-img-box"><img src="${data.imageUrl}" class="home-review-img" alt="由щ럭 ?대?吏"></div>`;
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
        listContainer.innerHTML = `<div class="text-center" style="grid-column: 1/-1; padding: 40px; color: red;">?꾧린瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??</div>`;
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
            alert("濡쒓렇?몄씠 ?꾩슂?⑸땲??\n留ㅼ엯???꾨즺??怨좉컼留??꾧린瑜??묒꽦?섏떎 ???덉뒿?덈떎.");
            window.location.href = 'login.html';
            return;
        }

        let isAdmin = false;
        let currentUserEmail = currentUser ? currentUser.email : (localUser ? localUser.email : null);

        if (currentUserEmail && ADMIN_EMAILS.includes(currentUserEmail)) {
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

                let q = query(collection(db, "quotes"), where("userId", "==", searchUid), where("status", "==", "?낃툑?꾨즺"));
                let querySnapshot = await getDocs(q);

                // Fallback: Check if they have auth.currentUser AND localUser, and check both UIDs just in case
                if (querySnapshot.empty && currentUser && localUser && currentUser.uid !== localUser.uid) {
                    q = query(collection(db, "quotes"), where("userId", "==", localUser.uid), where("status", "==", "?낃툑?꾨즺"));
                    querySnapshot = await getDocs(q);
                }

                if (querySnapshot.empty) {
                    alert("留ㅼ엯???꾨즺??怨좉컼留??꾧린瑜??묒꽦?섏떎 ???덉뒿?덈떎.");
                    return;
                }
            } catch (error) {
                console.error("Error checking quote status:", error);
                alert("?묒꽦 沅뚰븳???뺤씤?섎뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
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
        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc")); // Changed to createdAt
        const querySnapshot = await getDocs(q);

        allReviewsData = [];
        querySnapshot.forEach((docSnapshot) => {
            allReviewsData.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });

        if (allReviewsData.length === 0) {
            listContainer.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 40px;">泥?踰덉㎏ ?꾧린??二쇱씤怨듭씠 ?섏뼱蹂댁꽭??</div>';
            const paginationContainer = document.getElementById('pagination-container');
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        renderReviews(currentReviewPage);

    } catch (e) {
        console.error("Error loading reviews:", e);
        listContainer.innerHTML = `<div class="text-center" style="color:red;">?꾧린瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??<br>${e.message}</div>`;
    }
}

function renderReviews(page) {
    const listContainer = document.getElementById('reviews-list');
    const currentUser = auth.currentUser;

    listContainer.innerHTML = '';

    const startIndex = (page - 1) * reviewsPerPage;
    const endIndex = startIndex + reviewsPerPage;
    const paginatedReviews = allReviewsData.slice(startIndex, endIndex);

    paginatedReviews.forEach((data) => {
        const docId = data.id;
        const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '?좎쭨 ?놁쓬'; // Changed to createdAt
        const rating = data.rating || 5; // Default to 5 if not set
        const stars = '狩?.repeat(rating); // Simple star repeat
        const safeText = data.text || ''; // Changed content to text
        const safeName = data.userName || '?듬챸'; // Restore the missing variable
        let displayTitle = safeName; // Default to user name

        if (data.deviceModel || data.deviceStorage || data.transactionPrice) {
            const parts = [];
            if (data.deviceModel) parts.push(data.deviceModel);
            if (data.deviceStorage) parts.push(`(${data.deviceStorage})`);
            const deviceStr = parts.join(' ');

            if (data.transactionPrice) {
                // Formatting: "John Doe | iPhone 13 (256GB) - 55留뚯썝"
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
        const ADMIN_EMAILS = [
            "admin@rejuphone.com",
            "admin@sharaphone.com",
            "test@admin.com",
            "dda465@hanmail.net",
            "guffy321@naver.com",
        ];
        const isAdmin = currentUser && currentUser.email && ADMIN_EMAILS.includes(currentUser.email);

        // Auto-fix "踰덇컻?? to "?곷떞?? if user is admin
        if (isAdmin && typeof safeText === 'string' && safeText.includes('踰덇컻??)) {
            const updatedText = safeText.replace(/踰덇컻??g, '?곷떞');

            // Background update
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ updateDoc, doc, getFirestore }) => {
                const db = getFirestore();
                updateDoc(doc(db, "reviews", docId), { text: updatedText }).then(() => {
                    console.log("Auto-fixed 踰덇컻??-> ?곷떞 for", docId);
                }).catch(e => console.error("Auto-fix failed:", e));
            });
            // Update UI optimistically
            data.text = updatedText;
        }

        if (currentUser && (currentUser.uid === data.userId || isAdmin)) { // Changed uid to userId or Admin
            actionBtns = `
            <div style="margin-top:10px; display:flex; gap:10px;">
                <button onclick="editReview('${docId}')" style="font-size:0.8rem; color:#4a90e2; border:none; background:none; cursor:pointer;">?섏젙</button>
                <button onclick="deleteReview('${docId}')" style="font-size:0.8rem; color:#e74c3c; border:none; background:none; cursor:pointer;">??젣</button>
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
    prevBtn.textContent = '?댁쟾';
    prevBtn.disabled = currentReviewPage === 1;
    prevBtn.onclick = () => {
        if (currentReviewPage > 1) {
            goToReviewPage(currentReviewPage - 1);
        }
    };
    paginationContainer.appendChild(prevBtn);

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentReviewPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => goToReviewPage(i);
        paginationContainer.appendChild(pageBtn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = '?ㅼ쓬';
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
    // Optional: scroll to top of reviews container
    // document.getElementById('reviews-list').scrollIntoView({ behavior: 'smooth' });
}

async function submitReview() {
    const currentUser = auth.currentUser; // Renamed user to currentUser
    if (!currentUser) {
        alert("濡쒓렇?몄씠 ?꾩슂?⑸땲??");
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
        alert("?꾧린 ?댁슜? 理쒖냼 5???댁긽 ?묒꽦?댁＜?몄슂.");
        return;
    }

    // Get rating from radio buttons
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    const rating = ratingInput ? parseInt(ratingInput.value) : 5;

    // Start Submit Progress
    btnSubmit.disabled = true;
    btnSubmit.textContent = '?깅줉 以?..';

    try {
        let imageUrl = null;

        // 1. Upload Image if present
        if (imageInput && imageInput.files.length > 0) {
            try {
                const file = imageInput.files[0];
                const storageRef = ref(storage, `reviews/${Date.now()}_${file.name}`);

                btnSubmit.textContent = '?ъ쭊 ?낅줈??以?..';
                const uploadTask = await uploadBytesResumable(storageRef, file);

                btnSubmit.textContent = 'URL 媛?몄삤??以?..';
                imageUrl = await getDownloadURL(uploadTask.ref);
            } catch (uploadError) {
                console.error("Image upload failed:", uploadError);
                // Inform user but continue saving rest of data
                alert("?ъ쭊 ?낅줈??沅뚰븳???놁뼱 ?띿뒪???댁슜留???λ맗?덈떎. (Firebase Storage ?붽툑???꾩슂)");
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
            btnSubmit.textContent = '?곗씠???섏젙 以?..';
            await updateDoc(doc(db, "reviews", window.currentEditReviewId), reviewData);
            alert("?꾧린媛 ?섏젙?섏뿀?듬땲??");
        } else {
            btnSubmit.textContent = '?곗씠?????以?..';
            await addDoc(collection(db, "reviews"), reviewData);
            alert("?뚯쨷???꾧린 媛먯궗?⑸땲??");
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

        btnSubmit.textContent = '?깅줉?섍린';
        btnSubmit.disabled = false;

        currentReviewPage = 1;
        loadReviews(); // Refresh list

    } catch (e) {
        console.error("Submit review error:", e);
        alert("?꾧린 ?깅줉 ?ㅽ뙣: " + e.message);
        btnSubmit.textContent = '?깅줉?섍린';
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
            btnSubmit.textContent = '?섏젙 ?꾨즺';

            // Set global tracking variable
            window.currentEditReviewId = docId;
        } else {
            console.log("No such document!");
            alert("?꾧린 ?뺣낫瑜?遺덈윭?????놁뒿?덈떎.");
        }
    } catch (error) {
        console.error("Error fetching review for edit:", error);
    }
};

// Make deleteReview global so onclick works
window.deleteReview = async (docId) => {
    if (!confirm("?뺣쭚 ???꾧린瑜???젣?섏떆寃좎뒿?덇퉴?")) return;

    try {
        await deleteDoc(doc(db, "reviews", docId));
        alert("??젣?섏뿀?듬땲??");
        currentReviewPage = 1;
        loadReviews();
    } catch (e) {
        console.error("Delete error:", e);
        alert("??젣 ?ㅽ뙣: " + e.message);
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
            document.getElementById('p-btn-next').textContent = '?숈쓽 ???ㅼ쓬';
            document.getElementById('p-dot-1').classList.add('active');
            document.getElementById('p-dot-2').classList.remove('active');
        } else {
            document.getElementById('presale-step-1-apple').style.display = 'none';
            document.getElementById('presale-step-1-samsung').style.display = 'none';
            document.getElementById('presale-step-2').style.display = 'block';
            document.getElementById('p-btn-prev').style.display = 'block';
            document.getElementById('p-btn-next').textContent = '?숈쓽 ??理쒖쥌 ?좎껌?꾨즺';
            document.getElementById('p-dot-1').classList.remove('active');
            document.getElementById('p-dot-2').classList.add('active');
        }
    };

    window.presaleGoNext = () => {
        if (document.getElementById('presale-step-2').style.display === 'block') {
            window.closePresaleModal();
            window.actuallySubmitQuote(); // Trigger final submission!
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
