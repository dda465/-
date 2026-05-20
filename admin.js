import { db, auth } from './firebase-config.js';

import { collection, getDocs, getDoc, query, orderBy, doc, updateDoc, setDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";



// Admin Check: Firestore 기반 (하드코딩 제거)
// admins/{email_escaped} 문서에 isAdmin: true 필드가 있어야 접근 허용
let _adminCache = null;
async function checkIsAdmin(email) {
    if (!email) return false;
    if (_adminCache !== null) return _adminCache;
    try {
        const escaped = email.replace(/[@.]/g, '_');
        const adminDoc = await getDoc(doc(db, 'admins', escaped));
        _adminCache = adminDoc.exists() && adminDoc.data().isAdmin === true;
    } catch (e) {
        console.warn('Admin check failed, denying access:', e);
        _adminCache = false;
    }
    return _adminCache;
}



console.log("admin.js: Top level executing");



const loginOverlay = document.getElementById('login-overlay');

const quotesTableBody = document.getElementById('quotes-table-body');

const pricesTableBody = document.getElementById('prices-table-body');



// 1. Admin Auth Check

console.log("admin.js: onAuthStateChanged registering...");

onAuthStateChanged(auth, async (user) => {

    console.log("admin.js: onAuthStateChanged fired. User:", (user && !user.isAnonymous) ? user.email : "none or anonymous");

    let currentUserEmail = null;



    if (user && !user.isAnonymous) {

        currentUserEmail = user.email;

    } else {

        // Fallback to localStorage for social logins

        const localUserStr = localStorage.getItem('user_info');

        if (localUserStr) {

            try {

                const localUser = JSON.parse(localUserStr);

                currentUserEmail = localUser.email;

            } catch (e) { }

        }

    }



    if (currentUserEmail && await checkIsAdmin(currentUserEmail)) {

        console.log("Admin Logged In:", currentUserEmail);

        document.getElementById('admin-email').textContent = currentUserEmail;

        loginOverlay.style.display = 'none';

        loadQuotes();

    } else if (currentUserEmail) {

        // Logged in but not an admin

        alert(`관리자 권한이 없는 계정입니다. (${currentUserEmail})`);

        signOut(auth).then(() => {

            localStorage.removeItem('user_info');

            window.location.href = 'index.html';

        });

    } else {

        // Not logged in at all

        loginOverlay.style.display = 'flex';

        document.getElementById('login-message').innerHTML = `

            <p>관리자 계정으로 로그인해주세요</p>

        `;

    }

});



// Helper Functions

function formatDate(timestamp) {

    if (!timestamp) return '-';

    let date;

    if (typeof timestamp.toDate === 'function') {

        date = timestamp.toDate();

    } else if (timestamp.seconds) {

        date = new Date(timestamp.seconds * 1000);

    } else {

        date = new Date(timestamp);
        
        if (isNaN(date.getTime()) && typeof timestamp === 'string') {
            return timestamp;
        }

    }

    if (isNaN(date.getTime())) return '알 수 없음';

    return date.toLocaleString('ko-KR', {

        year: 'numeric', month: '2-digit', day: '2-digit',

        hour: '2-digit', minute: '2-digit'

    });

}



function formatCurrency(amount) {

    if (amount === undefined || amount === null) return '0원';

    return new Intl.NumberFormat('ko-KR').format(amount) + '원';

}



const logoutBtn = document.getElementById('logout-btn');

if (logoutBtn) {

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('user_info');
        signOut(auth).then(() => window.location.reload());

    });

}



// 2. Load Quotes

async function loadQuotes() {

    try {

        const q = query(collection(db, "quotes"), orderBy("timestamp", "desc"));

        const querySnapshot = await getDocs(q);



        quotesTableBody.innerHTML = '';



        const completedTableBody = document.getElementById('completed-table-body');
        if (completedTableBody) completedTableBody.innerHTML = '';
        
        const canceledTableBody = document.getElementById('canceled-table-body');
        if (canceledTableBody) canceledTableBody.innerHTML = '';
        
        const returnedTableBody = document.getElementById('returned-table-body');
        if (returnedTableBody) returnedTableBody.innerHTML = '';

        let pendingCount = 0;

        let pendingAmount = 0;

        let monthlyCount = 0;

        let monthlyAmount = 0;

        const now = new Date();

        const currentMonth = now.getMonth();

        const currentYear = now.getFullYear();



        if (querySnapshot.empty) {

            quotesTableBody.innerHTML = '<tr><td colspan="7" class="text-center">접수된 신청이 없습니다.</td></tr>';
            if (completedTableBody) completedTableBody.innerHTML = '<tr><td colspan="7" class="text-center">매입 완료된 신청이 없습니다.</td></tr>';
            if (canceledTableBody) canceledTableBody.innerHTML = '<tr><td colspan="7" class="text-center">취소된 신청이 없습니다.</td></tr>';
            if (returnedTableBody) returnedTableBody.innerHTML = '<tr><td colspan="7" class="text-center">반송 접수된 신청이 없습니다.</td></tr>';

            updateStats(0, 0, 0, 0);

            return;

        }



        const cvsRows = [];
        const courierRows = [];

        querySnapshot.forEach((docSnapshot) => {

            const data = docSnapshot.data();

            const id = docSnapshot.id;

            const status = data.status || '신청접수';



            // 휴지통 필터링

            if (data.isDeleted) return;



            // Stats Calculation

            if (status === '입금대기') {

                pendingCount++;

                pendingAmount += (data.price || 0);

            }

            if (status === '입금완료') {

                let dateObj = new Date();
                if (data.firebaseTimestamp) {
                    dateObj = new Date(data.firebaseTimestamp.toMillis());
                } else if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                    dateObj = data.timestamp.toDate();
                } else if (typeof data.timestamp === 'string') {
                    let d = new Date(data.timestamp);
                    if (!isNaN(d.getTime())) dateObj = d;
                    else {
                        const parts = data.timestamp.split('.');
                        if (parts.length >= 3) {
                            dateObj = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
                        }
                    }
                }

                if (!isNaN(dateObj.getTime()) && dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {

                    monthlyCount++;

                    monthlyAmount += (data.price || 0);

                }

            }



            const formattedDate = formatDate(data.timestamp);

            const formattedPrice = new Intl.NumberFormat('ko-KR').format(data.price || 0);



            // Status Badge Logic

            let statusClass = 'status-new';

            if (status === '수거중') statusClass = 'status-pickup';

            if (status.includes('검수중')) statusClass = 'status-inspection';
            if (status === '입금완료') statusClass = 'status-paid';
            if (status === '입금대기') statusClass = 'status-pickup';

            let deliveryTag = '';
            if (data.deliveryMethod === 'cvs') {
                let trackingInfo = '';
                if (data.trackingNumber) {
                    if (data.trackingNumber === '미입력') {
                        trackingInfo = `<br><span style="font-size: 0.75rem; color: #64748b; font-weight:600; display:block; margin-top:2px;">송장없이 발송완료</span>`;
                    } else {
                        trackingInfo = `<br><span style="font-size: 0.75rem; color: #1976D2; font-weight:600; display:block; margin-top:2px;">[운송장] ${data.trackingCarrier || ''} ${data.trackingNumber}</span>`;
                    }
                }
                deliveryTag = `<br><span style="font-size: 0.75rem; background: #FFF3E0; color: #E65100; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">개인발송</span>${trackingInfo}`;
            } else if (data.deliveryMethod === 'courier') {
                deliveryTag = `<br><span style="font-size: 0.75rem; background: #E8F5E9; color: #2E7D32; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">방문수거 (${data.pickupDate || '미정'})</span>`;
            }

            let feePaidBtn = '';
            if (data.deliveryMethod === 'cvs') {
                if (data.shippingFeePaid) {
                    feePaidBtn = `<br><button class="action-btn" style="background:#E8F5E9; color:#2E7D32; border-color:#81C784; margin-top:5px; width: 100%;" onclick="toggleShippingFee('${id}', false)">배송비 입금됨 ✓</button>`;
                } else {
                    feePaidBtn = `<br><button class="action-btn" style="background:#FFF; color:#E65100; border-color:#FFB74D; margin-top:5px; width: 100%;" onclick="toggleShippingFee('${id}', true)">배송비 입금확인</button>`;
                }
            }

            let displayStatus = status;
            if (status === '신청접수') displayStatus = '매입접수완료';
            if (status === '수거중') displayStatus = '택배발송완료';

            const trHtml = `
                <td>${formattedDate}${deliveryTag}</td>
                <td>${data.customerName}<br><span style="font-size:0.8rem; color:#888;">${data.customerPhone}</span></td>
                <td>${data.brand} ${data.model}</td>
                <td>${data.condition || '-'}</td>
                <td>${formatCurrency(data.price)}</td>
                <td><span class="status-badge ${statusClass}">${displayStatus}</span></td>
                <td>
                    <button class="action-btn" onclick="viewDetail('${id}')">상세보기</button>
                    <button class="action-btn" style="background:#E3F2FD; color:#1976D2; border-color:#90CAF9;" onclick="openInspectionModal('${id}')">검수서 작성</button>
                    <select onchange="updateQuoteStatus('${id}', this.value)" class="action-btn" style="width: auto;">
                        <option value="" disabled selected>상태변경</option>
                        <option value="신청접수">매입접수완료</option>
                        <option value="수거중">택배발송완료</option>
                        <option value="검수중">검수중</option>
                        <option value="입금대기" ${status === '입금대기' ? 'selected' : ''}>입금대기</option>
                        <option value="입금완료" ${status === '입금완료' ? 'selected' : ''}>입금완료</option>
                        <option value="반송접수" ${status === '반송접수' ? 'selected' : ''}>반송접수</option>
                        <option value="취소" ${status === '취소' ? 'selected' : ''}>취소</option>
                    </select>
                    <button class="action-btn" style="color:red; margin-left:5px;" onclick="deleteQuote('${id}')">삭제</button>
                    ${feePaidBtn}
                </td>
            `;

            const tr = document.createElement('tr');
            tr.innerHTML = trHtml;
            
            if (status === '입금완료') {
                if (completedTableBody) {
                    const trCompleted = document.createElement('tr');
                    trCompleted.innerHTML = trHtml;
                    completedTableBody.appendChild(trCompleted);
                }
            } else if (status === '취소') {
                if (canceledTableBody) {
                    const trCanceled = document.createElement('tr');
                    trCanceled.innerHTML = trHtml;
                    canceledTableBody.appendChild(trCanceled);
                }
            } else if (status === '반송접수') {
                if (returnedTableBody) {
                    const trReturned = document.createElement('tr');
                    trReturned.innerHTML = trHtml;
                    returnedTableBody.appendChild(trReturned);
                }
            } else {
                if (data.deliveryMethod === 'cvs') {
                    cvsRows.push(tr);
                } else {
                    courierRows.push(tr);
                }
            }
        });

        // Append sorted rows
        cvsRows.forEach(tr => quotesTableBody.appendChild(tr));
        
        if (cvsRows.length > 0 && courierRows.length > 0) {
            const divider = document.createElement('tr');
            divider.innerHTML = `<td colspan="7" style="background: #f8fafc; text-align: center; font-weight: bold; padding: 15px; color: #475569; border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0;">🚚 방문수거 신청 건</td>`;
            quotesTableBody.appendChild(divider);
        }

        courierRows.forEach(tr => quotesTableBody.appendChild(tr));

        if (completedTableBody && completedTableBody.children.length === 0) {
            completedTableBody.innerHTML = '<tr><td colspan="7" class="text-center">매입 완료된 신청이 없습니다.</td></tr>';
        }
        
        if (canceledTableBody && canceledTableBody.children.length === 0) {
            canceledTableBody.innerHTML = '<tr><td colspan="7" class="text-center">취소된 신청이 없습니다.</td></tr>';
        }

        if (returnedTableBody && returnedTableBody.children.length === 0) {
            returnedTableBody.innerHTML = '<tr><td colspan="7" class="text-center">반송 접수된 신청이 없습니다.</td></tr>';
        }



        // Update Stats UI

        updateStats(pendingCount, pendingAmount, monthlyCount, monthlyAmount);



    } catch (e) {

        console.error("Error loading quotes:", e);

        quotesTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">데이터 로딩 실패: ${e.message}</td></tr>`;

    }

}



function updateStats(pCount, pAmount, mCount, mAmount) {

    const pCountEl = document.getElementById('stat-pending-count');

    const pAmountEl = document.getElementById('stat-pending-amount');

    const mCountEl = document.getElementById('stat-monthly-count');

    const mAmountEl = document.getElementById('stat-monthly-amount');



    if (pCountEl) pCountEl.innerText = `${pCount}건`;

    if (pAmountEl) pAmountEl.innerText = `${new Intl.NumberFormat('ko-KR').format(pAmount)}원`;

    if (mCountEl) mCountEl.innerText = `${mCount}건`;

    if (mAmountEl) mAmountEl.innerText = `${new Intl.NumberFormat('ko-KR').format(mAmount)}원`;

}



// Global Delete Quote (Soft Delete = Move to Trash)

window.deleteQuote = async (id) => {
    // Custom DOM Modal to prevent browser dialog blocking
    const modalHtml = `
        <div id="custom-delete-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;">
            <div style="background:white;padding:20px;border-radius:10px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                <p>이 신청내역을 완전히 삭제하시겠습니까?<br>(이 작업은 취소할 수 없습니다)</p>
                <div style="margin-top:20px;display:flex;justify-content:center;gap:10px;">
                    <button id="custom-delete-cancel" style="padding:10px 20px;background:#ddd;border:none;border-radius:5px;cursor:pointer;">취소</button>
                    <button id="custom-delete-confirm" style="padding:10px 20px;background:red;color:white;border:none;border-radius:5px;cursor:pointer;">삭제 확인</button>
                </div>
                <div id="custom-delete-msg" style="margin-top:10px;color:red;font-size:0.9rem;"></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('custom-delete-cancel').onclick = () => {
        document.getElementById('custom-delete-modal').remove();
    };

    document.getElementById('custom-delete-confirm').onclick = async () => {
        const btn = document.getElementById('custom-delete-confirm');
        const msg = document.getElementById('custom-delete-msg');
        btn.disabled = true;
        btn.innerText = "삭제 중...";
        try {
            await deleteDoc(doc(db, "quotes", id));
            document.getElementById('custom-delete-modal').remove();
            
            // Show toast
            const toast = document.createElement('div');
            toast.innerText = "삭제되었습니다.";
            toast.style.cssText = "position:fixed;bottom:20px;right:20px;background:#4CAF50;color:white;padding:15px;border-radius:5px;z-index:9999;";
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
            
            loadQuotes();
            if (typeof loadTrash === 'function') loadTrash();
        } catch (e) {
            console.error("Delete Error:", e);
            msg.innerText = "삭제 권한이 없거나 오류가 발생했습니다: " + e.message;
            btn.disabled = false;
            btn.innerText = "삭제 확인";
        }
    };
};



// Global Restore Quote

window.restoreQuote = async (id) => {

    if (confirm("이 신청내역을 복구하시겠습니까?")) {

        try {

            await updateDoc(doc(db, "quotes", id), { isDeleted: false });

            alert("복구되었습니다.");

            loadTrash();

        } catch (e) {

            console.error("Restore Quote Error:", e);

            alert("복구 실패: " + e.message);

        }

    }

};



// Global Permanently Delete Quote (Hard Delete)

window.permanentlyDeleteQuote = async (id) => {

    if (confirm("정말 이 신청내역을 완전히 삭제하시겠습니까? (이 작업은 영구적이며 절대 되돌릴 수 없습니다!)")) {

        try {

            await deleteDoc(doc(db, "quotes", id));

            alert("영구 삭제되었습니다.");

            loadTrash();

        } catch (e) {

            console.error("Hard Delete Quote Error:", e);

            alert("완전 삭제 실패: " + e.message);

        }

    }

};



// --- Trash Management Logic ---

async function loadTrash() {

    const trashTableBody = document.getElementById('trash-table-body');

    if (!trashTableBody) return;



    try {

        const q = query(collection(db, "quotes"), orderBy("timestamp", "desc"));

        const querySnapshot = await getDocs(q);



        trashTableBody.innerHTML = '';

        let count = 0;



        querySnapshot.forEach((docSnapshot) => {

            const data = docSnapshot.data();

            const id = docSnapshot.id;



            // Show only deleted items

            if (!data.isDeleted) return;

            count++;



            const formattedDate = formatDate(data.timestamp);

            const formattedPrice = new Intl.NumberFormat('ko-KR').format(data.price || 0);

            const status = data.status || '신청접수';



            const tr = document.createElement('tr');

            tr.innerHTML = `

                <td>${formattedDate}</td>

                <td><span style="color:#d32f2f;">(삭제됨)</span> ${data.customerName}<br><span style="font-size:0.8rem; color:#888;">${data.customerPhone}</span></td>

                <td>${data.brand} ${data.model}</td>

                <td>${data.condition || '-'}</td>

                <td>${formatCurrency(data.price)}</td>

                <td><span class="status-badge status-new" style="background:#f5f5f5; color:#999;">${status}</span></td>

                <td>

                    <button class="action-btn" onclick="restoreQuote('${id}')" style="color:var(--primary-dark); font-weight:bold;">복구</button>

                    <button class="action-btn" style="color:red; margin-left:5px;" onclick="permanentlyDeleteQuote('${id}')">완전삭제</button>

                </td>

            `;

            trashTableBody.appendChild(tr);

        });



        if (count === 0) {

            trashTableBody.innerHTML = '<tr><td colspan="7" class="text-center">휴지통이 비어있습니다.</td></tr>';

        }



    } catch (e) {

        console.error("Error loading trash:", e);

        trashTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">휴지통 로딩 실패: ${e.message}</td></tr>`;

    }

};





// ... (Rest of mapped code matches existing except switchTab)



// --- User Management Logic ---

async function loadUsers() {

    const tableBody = document.getElementById('users-table-body');

    if (!tableBody) return;



    try {

        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));

        const querySnapshot = await getDocs(q);



        tableBody.innerHTML = '';



        if (querySnapshot.empty) {

            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">가입된 회원이 없습니다.</td></tr>';

            return;

        }



        querySnapshot.forEach((doc) => {

            const data = doc.data();

            const joinedDate = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : '-';



            const tr = document.createElement('tr');

            tr.innerHTML = `

                <td>${joinedDate}</td>

                <td>${data.email}</td>

                <td>${data.nickname || '-'}</td>

                <td>${data.phoneNumber || '-'}</td>

                <td>${data.account || '-'}</td>

                <td>

                    <button class="action-btn" onclick="deleteUser('${doc.id}')" style="color:red;">삭제</button>

                </td>

`;

            tableBody.appendChild(tr);

        });



    } catch (e) {

        console.error("Error loading users:", e);

        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">회원 목록 로딩 실패: ${e.message}</td></tr>`;

    }

}



// Global Delete User

window.deleteUser = async (userId) => {

    if (confirm("정말 회원을 삭제하시겠습니까? (DB에서 삭제됩니다)")) {

        try {

            await deleteDoc(doc(db, "users", userId));

            alert("삭제되었습니다");

            loadUsers();

        } catch (e) {

            alert("삭제 실패: " + e.message);

        }

    }

};



// ... (Rest of mapped code matches existing)



window.switchTab = (tabName, event) => {

    document.querySelectorAll('.main-content > .view-section, .main-content > div[id^="tab-"]').forEach(div => div.style.display = 'none');

    const targetTab = document.getElementById(`tab-${tabName}`);

    if (targetTab) targetTab.style.display = 'block';



    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabName)) {
            item.classList.add('active');
        }
    });



    if (tabName === 'prices') loadPrices();

    if (tabName === 'quotes') loadQuotes();

    if (tabName === 'users') loadUsers();

    if (tabName === 'chat') fetchChatSessions();

    if (tabName === 'trash') loadTrash();

    if (tabName === 'analytics') window.loadFunnelData();

    if (tabName === 'analytics') window.loadFunnelData();
    if (tabName === 'popup' && typeof window.loadPopupSettings === 'function') window.loadPopupSettings();
    if (tabName === 'settings' && typeof window.loadGeneralSettings === 'function') window.loadGeneralSettings();
};

window.toggleFunnelDateInput = () => {
    const type = document.getElementById('funnel-date-type').value;
    const dateInput = document.getElementById('funnel-date');
    if (type === 'all') {
        dateInput.style.display = 'none';
        window.loadFunnelData();
    } else {
        dateInput.style.display = 'block';
        window.loadFunnelData();
    }
};

// --- Funnel Analytics ---
window.loadFunnelData = async () => {
    const container = document.getElementById('funnel-container');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center" style="padding: 40px; color: #888;">데이터를 불러오는 중입니다...</div>';
    
    try {
        const typeSelect = document.getElementById('funnel-date-type');
        const dateInput = document.getElementById('funnel-date');
        
        if (typeSelect && dateInput && !dateInput.value) {
            const nowMs = Date.now();
            const kstOffset = 9 * 60 * 60 * 1000;
            const kstDate = new Date(nowMs + kstOffset);
            dateInput.value = kstDate.toISOString().split('T')[0];
        }
        
        let docId = 'funnel';
        if (typeSelect && typeSelect.value === 'daily' && dateInput && dateInput.value) {
            docId = 'funnel_' + dateInput.value;
        }

        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docRef = doc(db, 'analytics', docId);
        const docSnap = await getDoc(docRef);
        
        let data = {};
        if (docSnap.exists()) {
            data = docSnap.data();
        }
        
        const steps = [
            { key: 'home_main', label: '1. 메인 홈페이지 방문', color: '#e2e8f0', barColor: '#94a3b8' },
            { key: 'quote_start', label: '2. 견적 페이지 (시세조회) 진입', color: '#dbeafe', barColor: '#60a5fa' },
            { key: 'quote_model', label: '3. 제조사/기종/모델 선택 완료', color: '#bfdbfe', barColor: '#3b82f6' },
            { key: 'quote_details', label: '4. 기기 상태 및 옵션 선택 완료', color: '#93c5fd', barColor: '#2563eb' },
            { key: 'quote_complete', label: '5. 최종 매입 신청서 제출 완료', color: '#3b82f6', barColor: '#1d4ed8' },
            { key: 'price_list', label: '기타: 시세표 페이지 방문', color: '#f3f4f6', barColor: '#a8a29e', isExtra: true },
            { key: 'reviews', label: '기타: 이용 후기 페이지 방문', color: '#f3f4f6', barColor: '#a8a29e', isExtra: true },
        ];
        
        const maxVal = Math.max(...steps.map(s => data[s.key] || 0), 1);
        
        let html = '';
        let prevVal = null;
        
        steps.forEach((step, idx) => {
            const val = data[step.key] || 0;
            const pctOfMax = Math.round((val / maxVal) * 100) || 0;
            
            let dropHtml = '';
            if (!step.isExtra && prevVal !== null && prevVal > 0) {
                let dropPct = Math.round(((prevVal - val) / prevVal) * 100);
                if (dropPct < 0) dropPct = 0; 
                let convPct = Math.round((val / prevVal) * 100);
                if (convPct > 100) convPct = 100;
                
                dropHtml = `
                    <div style="padding-left: 270px; margin: -15px 0 15px 0; font-size: 0.95rem; color: #64748b; display: flex; align-items: center; gap: 5px;">
                       <span class="material-symbols-outlined" style="font-size: 18px; transform: rotate(-90deg); color: #94a3b8;">subdirectory_arrow_right</span>
                       전환 <strong style="color: #2563eb;">${convPct}%</strong> (이탈률 <span style="color: #ef4444;">${dropPct}%</span>)
                    </div>
                `;
            }
            
            html += dropHtml;
            html += `
                <div style="display: flex; align-items: center; margin-bottom: 25px;">
                    <div style="width: 260px; font-weight: 700; color: #1e293b; font-size: 1.05rem;">
                        ${step.label}
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 6px; font-weight: normal; line-height: 1.3;">
                            <span style="color:#10b981; font-weight: 600;">네이버 ${data[`${step.key}_naver`] || 0}</span> | 
                            <span style="color:#f97316; font-weight: 600;">당근 ${data[`${step.key}_daangn`] || 0}</span> | 
                            <span style="color:#3b82f6; font-weight: 600;">구글 ${data[`${step.key}_google`] || 0}</span><br>
                            <span style="color:#64748b;">기타 ${data[`${step.key}_direct`] || 0} / 이전데이터 ${(data[step.key] || 0) - ((data[`${step.key}_naver`]||0)+(data[`${step.key}_daangn`]||0)+(data[`${step.key}_google`]||0)+(data[`${step.key}_direct`]||0)) > 0 ? (data[step.key] || 0) - ((data[`${step.key}_naver`]||0)+(data[`${step.key}_daangn`]||0)+(data[`${step.key}_google`]||0)+(data[`${step.key}_direct`]||0)) : 0}</span>
                        </div>
                    </div>
                    <div style="flex: 1; display: flex; align-items: center; gap: 15px;">
                        <div style="flex: 1; height: 36px; background: #f1f5f9; border-radius: 18px; overflow: hidden; position: relative; border: 1px solid #e2e8f0;">
                            <div style="width: ${Math.max(pctOfMax, parseInt(val)===0?0:1)}%; height: 100%; background: ${step.barColor}; transition: width 1s ease; position: absolute; left: 0; top: 0; border-radius: 18px;"></div>
                        </div>
                        <div style="width: 90px; font-weight: 800; color: #0f172a; text-align: right; font-size: 1.25rem;">
                            ${new Intl.NumberFormat().format(val)}명
                        </div>
                    </div>
                </div>
            `;
            
            if (!step.isExtra) {
                prevVal = val;
            }
        });
        
        container.innerHTML = html;
        
        if (window.loadDailyTrendData) {
            window.loadDailyTrendData();
        }
    } catch(e) {
        console.error('Funnel error', e);
        container.innerHTML = `<div class="text-center" style="padding: 40px; color: red;">에러가 발생했습니다: ${e.message}</div>`;
    }
};

let trendChartInstance = null;

window.loadDailyTrendData = async () => {
    try {
        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // Generate last 7 days YYYY-MM-DD (KST)
        const dates = [];
        const nowMs = Date.now();
        const kstOffset = 9 * 60 * 60 * 1000;
        for (let i = 6; i >= 0; i--) {
            const d = new Date(nowMs + kstOffset - i * 24 * 60 * 60 * 1000);
            dates.push(d.toISOString().split('T')[0]);
        }
        
        // Fetch all 7 docs in parallel
        const promises = dates.map(dateStr => getDoc(doc(db, 'analytics', 'funnel_' + dateStr)));
        const snaps = await Promise.all(promises);
        
        const rawData = [];
        snaps.forEach((snap, idx) => {
            let d = snap.exists() ? snap.data() : {};
            rawData.push({
                date: dates[idx],
                home: d.home_main || 0,
                price: d.price_list || 0,
                review: d.reviews || 0,
                quote_start: d.quote_start || 0,
                quote_complete: d.quote_complete || 0
            });
        });
        
        // Build Table
        const tbody = document.getElementById('trend-table-body');
        if (tbody) {
            let html = '';
            // Render from newest to oldest
            [...rawData].reverse().forEach(row => {
                const convRate = row.home > 0 ? Math.round((row.quote_complete / row.home) * 100) : 0;
                html += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${row.date}</strong></td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${new Intl.NumberFormat().format(row.home)}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #64748b;">${new Intl.NumberFormat().format(row.price)}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #64748b;">${new Intl.NumberFormat().format(row.review)}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #3b82f6;">${new Intl.NumberFormat().format(row.quote_start)}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #1d4ed8; font-weight: bold;">${new Intl.NumberFormat().format(row.quote_complete)}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
                            <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 700;">${convRate}%</span>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
        
        // Build Chart (using original chronological order for X axis)
        const ctx = document.getElementById('trend-chart');
        if (ctx) {
            if (trendChartInstance) {
                trendChartInstance.destroy();
            }
            
            const labels = rawData.map(d => d.date.substring(5)); // MM-DD
            const dataHome = rawData.map(d => d.home);
            const dataPrice = rawData.map(d => d.price);
            const dataReview = rawData.map(d => d.review);
            const dataQuoteComplete = rawData.map(d => d.quote_complete);
            
            // Requires Chart.js to be loaded
            if (typeof Chart !== 'undefined') {
                trendChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: '홈 접속',
                                data: dataHome,
                                borderColor: '#94a3b8',
                                backgroundColor: 'rgba(148, 163, 184, 0.1)',
                                tension: 0.3,
                                fill: true,
                                borderWidth: 2
                            },
                            {
                                label: '접수 완료',
                                data: dataQuoteComplete,
                                borderColor: '#1d4ed8',
                                backgroundColor: '#1d4ed8',
                                tension: 0.3,
                                borderWidth: 3
                            },
                             {
                                label: '시세표 조회',
                                data: dataPrice,
                                borderColor: '#eab308',
                                borderDash: [5, 5],
                                tension: 0.3,
                                borderWidth: 2,
                                hidden: true
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { precision: 0 }
                            }
                        }
                    }
                });
            }
        }

    } catch (e) {
        console.error('Failed to load daily trend:', e);
        const tbody = document.getElementById('trend-table-body');
        if(tbody) tbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">오류: ${e.message}</td></tr>`;
    }
};


// Google Sheet Sync Logic

window.syncPricesFromSheet = async () => {

    if (!confirm("구글 시트에서 데이터를 가져와 시세를 업데이트 하시겠습니까?\n동기화 작업은 시간이 조금 걸릴 수 있으며 완료 후 시세가 변경됩니다.")) return;



    // We update the table to show loading state

    const tbody = document.getElementById('prices-table-body');

    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">구글 시트에서 데이터를 불러와 업데이트 중입니다... 잠시만 기다려주세요.</td></tr>';



    try {

        // 1. Fetch CSV data from Google Sheets public export URL

        const sheetUrl = "https://docs.google.com/spreadsheets/d/1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc/export?format=csv&id=1Uhfn4XPjxsTJMhELFIF8bSTY-1B78GtYG6cFeMs_kfc&gid=0";

        const response = await fetch(sheetUrl);

        if (!response.ok) throw new Error("구글 시트 접근에 실패했습니다. (공유 상태 확인 필요)");

        const csvText = await response.text();



        // 2. Parse using PapaParse

        const result = Papa.parse(csvText, {

            header: true,

            skipEmptyLines: true

        });



        if (result.errors.length && result.data.length === 0) {

            throw new Error("데이터 파싱 오류: " + result.errors[0].message);

        }



        const data = result.data;

        let updateCount = 0;



        // 3. Clear existing data and Batch write/update to firestore

        const batchSize = 100;

        let batch = writeBatch(db);

        let batchCounter = 0;



        // --- NEW: Delete existing products first ---

        try {

            const currentProductsQuery = query(collection(db, "products"));

            const currentProductsSnapshot = await getDocs(currentProductsQuery);

            currentProductsSnapshot.forEach(docSnap => {

                batch.delete(docSnap.ref);

                batchCounter++;

                if (batchCounter === batchSize) {

                    batch.commit().then(() => {

                        batch = writeBatch(db);

                        batchCounter = 0;

                    });

                }

            });

            if (batchCounter > 0) {

                await batch.commit();

                batch = writeBatch(db);

                batchCounter = 0;

            }

        } catch (delErr) {

            console.error("Failed to delete old products:", delErr);

            throw new Error("기존 데이터를 삭제하는 중 오류가 발생했습니다.");

        }



        // --- Process each row ---

        // Structure: 브랜드 시리즈 모델명 미개봉, S급 A급 B급 C급 D급 32기가, 64기가, 128기가, 256기가, 512기가, 1테라

        for (const row of data) {

            const brandRaw = row['브랜드'];

            const series = row['시리즈'];

            const model = row['모델명'];



            if (!brandRaw || !model) continue; // Skip invalid rows



            // Format mapping

            let brand = brandRaw.toLowerCase();

            if (brand.includes('애플') || brand.includes('apple')) brand = 'apple';

            else if (brand.includes('삼성') || brand.includes('sAMSUNG')) brand = 'samsung';



            // Prices Dictionary Mapping

            const basePrice = parseInt((row['S급'] || "0").replace(/[^0-9]/g, "")) || 0;

            const prices = {

                sealed: parseInt((row['미개봉'] || "0").replace(/[^0-9]/g, "")) || 0,

                s: basePrice,

                a: parseInt((row['A급'] || "0").replace(/[^0-9]/g, "")) || 0,

                b: parseInt((row['B급'] || "0").replace(/[^0-9]/g, "")) || 0,

                c: parseInt((row['C급'] || "0").replace(/[^0-9]/g, "")) || 0,

                d: parseInt((row['D급'] || "0").replace(/[^0-9]/g, "")) || 0

            };



            // Storage Options Mapping

            const storages = [];

            const storageCols = ['32기가', '64기가', '128기가', '256기가', '512기가', '1테라'];

            const sizeMap = {

                '32기가': '32GB', '64기가': '64GB', '128기가': '128GB',

                '256기가': '256GB', '512기가': '512GB', '1테라': '1TB'

            };



            storageCols.forEach(col => {

                const adjValStr = row[col];

                if (adjValStr && adjValStr.trim() !== "") {

                    const adjVal = parseInt(adjValStr.replace(/[^0-9-]/g, "")) || 0;

                    storages.push({

                        size: sizeMap[col],

                        priceAdjustment: adjVal

                    });

                }

            });



            if (storages.length === 0) {

                storages.push({ size: '기본', priceAdjustment: 0 });

            }



            // Create Payload

            const payload = {

                brand: brand,

                series: series || "",

                model: model,

                basePrice: basePrice,

                prices: prices,

                storageOptions: storages,

                lastUpdated: new Date()

            };



            // Doc ID generation

            const docId = model.replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, '-').toLowerCase();



            batch.set(doc(db, "products", docId), payload);

            batchCounter++;

            updateCount++;



            if (batchCounter === batchSize) {

                await batch.commit();

                batch = writeBatch(db);

                batchCounter = 0;

            }

        }



        if (batchCounter > 0) {

            await batch.commit();

        }



        alert(`동기화 완료!\n총 ${updateCount}개의 모델 정보가 시트에서 성공적으로 업데이트 되었습니다.`);

        loadPrices();



    } catch (error) {

        console.error("Sheet Sync Error:", error);

        alert("동기화 중 오류가 발생했습니다.\n" + error.message);

        loadPrices();

    }

};



// 3. Load Prices (New Logic)

async function loadPrices() {

    try {

        // Simplified query to avoid "Index Required" error

        const q = query(collection(db, "products"), orderBy("brand"));

        const querySnapshot = await getDocs(q);



        pricesTableBody.innerHTML = '';



        if (querySnapshot.empty) {

            pricesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">등록된 시세 데이터가 없습니다. 마이그레이션을 진행해주세요.</td></tr>';

            return;

        }



        let products = [];

        querySnapshot.forEach(doc => {

            products.push({ id: doc.id, ...doc.data() });

        });



        // Client-side Sort: Brand -> Series -> Model

        products.sort((a, b) => {

            if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);

            const seriesA = a.series || 'zz';

            const seriesB = b.series || 'zz';

            if (seriesA !== seriesB) return seriesA.localeCompare(seriesB);

            return a.model.localeCompare(b.model);

        });



        products.forEach((data) => {

            const id = data.id;



            // Format storage options for display

            const storageStr = data.storageOptions ? data.storageOptions.map(s =>

                `${s.size} (${s.priceAdjustment > 0 ? '+' : ''

                }${s.priceAdjustment / 10000}만 원`

            ).join(', ') : '-';



            const formattedBasePrice = new Intl.NumberFormat('ko-KR').format(data.basePrice || 0);



            const tr = document.createElement('tr');

            tr.innerHTML = `

                <td>${data.brand}</td>

                <td>${data.series}</td>

                <td>${data.model}</td>

                <td>${formattedBasePrice}원</td>

                <td style="font-size: 0.85rem; color: #555;">${storageStr}</td>

                <td>

                    <button class="action-btn" onclick='openModelModal(${JSON.stringify({ id, ...data })})'>수정</button>

                    <button class="action-btn" style="color: red;" onclick="deleteModel('${id}')">삭제</button>

                </td>

            `;

            pricesTableBody.appendChild(tr);

        });



    } catch (e) {

        console.error("Error loading prices:", e);

        pricesTableBody.innerHTML = `< tr > <td colspan="6" class="text-center text-danger">시세 로딩 실패: ${e.message}</td></tr > `;

    }

}



// Global Variables for Search

let priceSearchInput = document.getElementById('price-search');

if (priceSearchInput) {

    priceSearchInput.addEventListener('input', function () {

        const filter = this.value.toUpperCase();

        const rows = pricesTableBody.getElementsByTagName('tr');

        for (let i = 0; i < rows.length; i++) {

            const td = rows[i].getElementsByTagName('td')[2]; // Model Name

            if (td) {

                const txtValue = td.textContent || td.innerText;

                if (txtValue.toUpperCase().indexOf(filter) > -1) {

                    rows[i].style.display = "";

                } else {

                    rows[i].style.display = "none";

                }

            }

        }

    });

}



// --- CRUD & Modal Logic ---



window.openModelModal = (data = null) => {

    const modal = document.getElementById('model-modal');

    const title = document.getElementById('modal-title');



    if (data) {

        title.textContent = '모델 수정';

        document.getElementById('edit-doc-id').value = data.id;

        document.getElementById('edit-brand').value = data.brand;

        document.getElementById('edit-series').value = data.series || '';

        document.getElementById('edit-model').value = data.model;

        document.getElementById('edit-price').value = data.basePrice;

        document.getElementById('edit-storage').value = JSON.stringify(data.storageOptions || [], null, 2);

    } else {

        title.textContent = '신규 모델 추가';

        document.getElementById('edit-doc-id').value = '';

        document.getElementById('edit-brand').value = 'apple';

        document.getElementById('edit-series').value = '';

        document.getElementById('edit-model').value = '';

        document.getElementById('edit-price').value = '';

        // Default template

        document.getElementById('edit-storage').value = JSON.stringify([

            { size: "128GB", priceAdjustment: -100000 },

            { size: "256GB", priceAdjustment: 0 },

            { size: "512GB", priceAdjustment: 150000 }

        ], null, 2);

    }



    modal.style.display = 'flex';

};



window.closeModelModal = () => {
    document.getElementById('model-modal').style.display = 'none';
};

window.saveModel = async () => {
    const id = document.getElementById('edit-doc-id').value;
    const brand = document.getElementById('edit-brand').value;
    const series = document.getElementById('edit-series').value;
    const model = document.getElementById('edit-model').value;
    const basePrice = parseInt(document.getElementById('edit-price').value) || 0;
    
    let storageOptions = [];
    try {
        storageOptions = JSON.parse(document.getElementById('edit-storage').value);
    } catch (e) {
        alert('용량 옵션의 JSON 형식이 잘못되었습니다.');
        return;
    }

    const payload = {
        brand,
        series,
        model,
        basePrice,
        storageOptions,
        lastUpdated: new Date()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "products", id), payload);

        } else {

            // Create a consistent ID based on model name

            const newId = model.replace(/\s+/g, '-').toLowerCase();

            await setDoc(doc(db, "products", newId), payload);

        }

        alert("저장되었습니다.");

        closeModelModal();

        loadPrices();

    } catch (e) {

        console.error("Save Error:", e);

        alert("저장 실패: " + e.message);

    }

};



window.deleteModel = async (id) => {

    if (confirm("정말 이 모델을 삭제하시겠습니까?")) {

        try {

            await deleteDoc(doc(db, "products", id));

            loadPrices();

        } catch (e) {

            alert("삭제 실패: " + e.message);

        }

    }

};



// --- Smart Migration Logic ---
// Leftover code removed



window.viewDetail = async (id) => {

    try {

        const docRef = doc(db, "quotes", id);

        const docSnap = await getDoc(docRef);



        if (docSnap.exists()) {

            const data = docSnap.data();



            document.getElementById('quote-detail-modal').dataset.id = id;



            document.getElementById('detail-name').textContent = data.customerName;

            document.getElementById('detail-phone').textContent = data.customerPhone;



            const methodText = (data.deliveryMethod === 'visit') ? '매장 방문' : (data.deliveryMethod === 'cvs' ? '편의점 택배 (착불)' : '방문 수거 (택배)');

            document.getElementById('detail-method').textContent = methodText;

            document.getElementById('detail-address').textContent = data.customerAddress || '-';



            document.getElementById('detail-account').textContent = `${data.bankName || ''} ${data.customerAccount || ''}`;

            document.getElementById('detail-date').textContent = formatDate(data.timestamp);



            document.getElementById('detail-model').textContent = `${data.brand} ${data.model}`;

            document.getElementById('detail-storage').textContent = data.storage || '-';

            document.getElementById('detail-price').textContent = formatCurrency(data.price);



            document.getElementById('detail-customer-memo').textContent = data.customerMemo || '없음';

            document.getElementById('admin-memo').value = data.adminMemo || '';



            let conditionText = '';

            let defectsHtml = '';

            const methodDisplay = data.method === 'self' ? '셀프접수' : '간편접수';



            const gradeNames = {

                sealed: "미개봉 (새상품)",

                s: "S급 (무결점)",

                a: "A급 (깨끗)",

                b: "B급 (사용감)",

                c: "C급 (파손)",

                d: "D급 (심한 파손)",

                used: "중고"

            };

            conditionText = `${gradeNames[data.grade] || data.conditionType || '확인 불가'} (${methodDisplay})`;



            if (data.method === 'simple' || (!data.defectsDetails && (!data.defects || data.defects.length === 0))) {

                if (data.conditionType === 'sealed' || data.grade === 'sealed') {

                    defectsHtml = '<p>특이사항 없음 (미개봉/새상품)</p>';

                } else {

                    const fallbackGrade = gradeNames[data.grade] || 'S급 (무결점)';

                    if (data.method === 'simple') {

                        defectsHtml = `<p style="color:#666;">간편접수로 상세기기 상태체크 생략 (${fallbackGrade})</p>`;

                    } else {

                        defectsHtml = `<p>특이사항 없음 (${fallbackGrade})</p>`;

                    }

                }

            } else if (data.defectsDetails && Object.keys(data.defectsDetails).length > 0) {

                defectsHtml = '<ul style="padding-left: 20px; margin: 0; font-size: 0.95rem; line-height: 1.6;">';

                const d = data.defectsDetails;



                if (d.is_sealed) {

                    defectsHtml += '<li><strong>기기상태:</strong> 미개봉 (새제품)</li>';

                } else {

                    defectsHtml += '<li><strong>기기상태:</strong> 개봉 (중고)</li>';

                }



                const bodyMap = { 'front': '전면(유리)', 'bezel': '테두리/베젤', 'rear': '후면(카메라)' };

                if (d.body_damage && d.body_damage.length > 0 && !d.body_damage.includes('none')) {

                    defectsHtml += `<li><strong>파손/찍힘:</strong> ${d.body_damage.map(v => bodyMap[v] || v).join(', ')}</li>`;

                }



                if (d.micro_scratch && d.micro_scratch.length > 0 && !d.micro_scratch.includes('none')) {

                    defectsHtml += `<li><strong>미세손상/기스:</strong> ${d.micro_scratch.map(v => bodyMap[v] || v).join(', ')}</li>`;

                }



                if (d.lcd_damage === true) {

                    defectsHtml += '<li style="color:red;"><strong>LCD 손상:</strong> 있음 (줄/멍/파손)</li>';

                }



                if (d.burn_in === true) {

                    defectsHtml += '<li style="color:#e67e22;"><strong>잔상(번인):</strong> 있음</li>';

                }



                const funcMap = {

                    'camera_lens': '카메라 멍/기스', 'camera_fail': '카메라 작동불가', 'faceid': '페이스ID/지문',

                    'wifi': 'Wifi/블루투스', 'compass': '나침반/GPS', 'sound': '스피커/마이크',

                    'vibration': '진동 불량', 'touch': '터치 불량', 'battery': '배터리성능 80%↓',

                    'power': '전원/충전 불량', 'account': '계정잠김'

                };

                if (d.func_defect && d.func_defect.length > 0 && !d.func_defect.includes('none')) {

                    defectsHtml += `<li style="color:red;"><strong>기능불량:</strong> ${d.func_defect.map(v => funcMap[v] || v).join(', ')}</li>`;

                }



                defectsHtml += '</ul>';



            } else {

                if (data.conditionType === 'sealed') {

                    defectsHtml = '<p>특이사항 없음 (미개봉/새상품)</p>';

                } else if (!data.defects || data.defects.length === 0) {

                    const fallbackGrade = gradeNames[data.grade] || 'S급 (무결점)';

                    defectsHtml = `<p><strong>선택한 등급만 저장된 내역결과:</strong> ${fallbackGrade}</p>`;

                } else {

                    const defectMap = { 'display': '화면 기스/손상', 'body': '테두리 찍힘/기스', 'func': '기능 불량' };

                    const defectsList = data.defects.map(d => defectMap[d] || d);

                    defectsHtml = '<ul style="padding-left: 20px; margin: 0;">';

                    defectsList.forEach(d => { defectsHtml += `<li>${d}</li>`; });

                    defectsHtml += '</ul>';

                }

            }

            document.getElementById('detail-condition').textContent = conditionText;

            document.getElementById('detail-defects').innerHTML = defectsHtml;

            document.getElementById('quote-detail-modal').style.display = 'flex';

        } else {

            alert("삭제되거나 존재하지 않는 신청입니다.");

        }

    } catch (e) {

        console.error("Error loading detail:", e);

        alert("상세 정보를 불러오는 중 오류가 발생했습니다.");

    }

};



window.saveAdminMemo = async () => {

    const id = document.getElementById('quote-detail-modal').dataset.id;

    const memo = document.getElementById('admin-memo').value;

    if (!id) return;



    try {

        await updateDoc(doc(db, "quotes", id), {

            adminMemo: memo

        });

        alert("메모가 저장되었습니다.");

    } catch (e) {

        console.error("Memo Save Error:", e);

        alert("메모 저장 실패: " + e.message);

    }

};



// 알림톡 전송 도우미 함수
async function triggerAlimtalk(quoteData, status) {
    let templateId = "";
    let variables = {};
    const phone = quoteData.customerPhone ? quoteData.customerPhone.replace(/-/g, '') : '';
    if (!phone) return;

    if (status === "검수중") {
        templateId = "KA01TP260515031257493IF4F3nfSFKa";
        variables = {
            "#{접수계정}": quoteData.userId !== 'anonymous' ? '인증된 계정' : '미인증',
            "#{고객성함}": quoteData.customerName || "-",
            "#{모델}": `${quoteData.brand} ${quoteData.model}`
        };
    } else if (status === "입금완료") {
        templateId = "KA01TP260515103832208FZS8FFOsPcv";
        variables = {
            "#{고객성함}": quoteData.customerName || "-",
            "#{기종}": `${quoteData.brand} ${quoteData.model}`,
            "#{입금완료일자}": new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
        };
    }

    if (!templateId) return;

    try {
        const response = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/alimtalkApi/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phone: phone,
                templateId: templateId,
                variables: variables
            })
        });
        const result = await response.json();
        console.log("Alimtalk trigger result:", result);
    } catch (e) {
        console.error("Alimtalk trigger error:", e);
    }
}

window.toggleShippingFee = async (id, isPaid) => {
    if (!id) return;
    try {
        const docRef = doc(db, "quotes", id);
        await updateDoc(docRef, { shippingFeePaid: isPaid });
        await loadQuotes(); // Reload UI
    } catch(e) {
        console.error(e);
        alert("배송비 입금 상태 변경에 실패했습니다.");
    }
};

window.updateQuoteStatus = async (id, newStatus) => {
    if (!id || !newStatus) return;

    if (!confirm(`해당 접수건의 상태를 \'${newStatus}\'(으)로 변경하시겠습니까?\n(고객에게 알림톡이 자동 발송됩니다)`)) {
        loadQuotes(); // Revert select option if cancelled
        return;
    }

    try {
        // Fetch current quote data
        const docRef = doc(db, "quotes", id);
        const docSnap = await getDoc(docRef);
        let quoteData = null;
        if(docSnap.exists()) {
            quoteData = docSnap.data();
        }

        await updateDoc(docRef, {
            status: newStatus
        });

        // 알림톡 발송
        if(quoteData) {
            triggerAlimtalk(quoteData, newStatus);
        }

        loadQuotes();
        alert("상태가 변경되었습니다. (알림톡 발송 요청됨)");
    } catch (e) {
        console.error("Status Update Error:", e);
        alert("상태 변경 실패: " + e.message);
        loadQuotes();
    }
};

// --- Inspection Modal (전자매매계약서) Logic ---
window.openInspectionModal = async (id) => {
    try {
        const docSnap = await getDoc(doc(db, "quotes", id));
        if (!docSnap.exists()) {
            alert("신청 내역을 찾을 수 없습니다.");
            return;
        }
        
        const data = docSnap.data();
        
        document.getElementById('insp-quote-id').value = id;
        document.getElementById('insp-customer-name').innerText = data.customerName || "-";
        document.getElementById('insp-customer-phone').innerText = data.customerPhone || "-";
        document.getElementById('insp-device-model').innerText = `${data.brand} ${data.model}`;
        document.getElementById('insp-expected-price').innerText = new Intl.NumberFormat('ko-KR').format(data.price || 0) + "원";
        
        // Reset form
        document.getElementById('inspection-form').reset();
        
        // Load existing inspection data if any
        if (data.inspectionData) {
            document.getElementById('insp-final-price').value = data.inspectionData.finalPrice || "";
            document.getElementById('insp-deduction-details').value = data.inspectionData.details || "";
            document.getElementById('insp-admin-comment').value = data.inspectionData.comment || "";
            
            const faults = data.inspectionData.faults || [];
            document.querySelectorAll('input[name="insp-fault"]').forEach(cb => {
                if(faults.includes(cb.value)) cb.checked = true;
            });
        }
        
        document.getElementById('inspection-modal').style.display = 'flex';
    } catch(e) {
        console.error("Open Inspection Error:", e);
        alert("데이터를 불러오는데 실패했습니다.");
    }
};

window.saveInspectionForm = async () => {
    const id = document.getElementById('insp-quote-id').value;
    const finalPrice = document.getElementById('insp-final-price').value;
    const details = document.getElementById('insp-deduction-details').value;
    const comment = document.getElementById('insp-admin-comment').value;
    
    if(!finalPrice) {
        alert("최종 매입가를 입력해주세요.");
        return;
    }
    
    const faults = [];
    document.querySelectorAll('input[name="insp-fault"]:checked').forEach(cb => {
        faults.push(cb.value);
    });
    
    if(!confirm("검수 결과를 저장하고 '검수완료' 상태로 변경하시겠습니까?\n(고객에게 전자매매계약서 확인 알림톡이 발송됩니다)")) {
        return;
    }
    
    const inspectionData = {
        finalPrice: Number(finalPrice),
        faults: faults,
        details: details,
        comment: comment,
        inspectedAt: new Date().toISOString()
    };
    
    try {
        const docRef = doc(db, "quotes", id);
        const docSnap = await getDoc(docRef);
        const phone = docSnap.exists() ? docSnap.data().customerPhone : "";
        const name = docSnap.exists() ? docSnap.data().customerName : "";

        await updateDoc(docRef, {
            status: "검수완료",
            inspectionData: inspectionData
        });
        
        document.getElementById('inspection-modal').style.display = 'none';
        loadQuotes();
        alert("검수서가 저장되었습니다. 고객의 동의 대기 중입니다.");
        
        if (docSnap.exists()) {
            triggerAlimtalk(docSnap.data(), "검수완료");
        }
    } catch(e) {
        console.error("Save Inspection Error:", e);
        alert("저장 실패: " + e.message);
    }
};


window.closeDetailModal = () => {

    document.getElementById('quote-detail-modal').style.display = 'none';

};



// --- CHAT MANAGEMENT LOGIC ---

let allChats = []; // Global variable to store active chats



// Fetch Chat Sessions

async function fetchChatSessions() {

    const listContainer = document.getElementById('chat-session-list');

    if (!listContainer) return;

    listContainer.innerHTML = '<div style="text-align:center; padding:20px;">로딩 중..</div>';



    try {

        const q = query(collection(db, "chats"), orderBy("lastUpdated", "desc"));

        const snapshot = await getDocs(q);



        allChats = [];

        snapshot.forEach(doc => {

            allChats.push({ id: doc.id, ...doc.data() });

        });



        renderChatSessions();

    } catch (e) {

        console.error("Fetch Chats Error:", e);

        listContainer.innerHTML = `<div style="text-align:center; color:red; padding:20px;">오류: ${e.message}</div>`;

    }

}



function renderChatSessions() {

    const listContainer = document.getElementById('chat-session-list');

    if (!listContainer) return;



    listContainer.innerHTML = '';



    if (allChats.length === 0) {

        listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">채팅 내역이 없습니다.</div>';

        return;

    }



    allChats.forEach(chat => {

        let timeStr = "";

        if (chat.lastUpdated) {

            const date = chat.lastUpdated.toDate ? chat.lastUpdated.toDate() : new Date(chat.lastUpdated);

            timeStr = date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        }



        const item = document.createElement('div');

        item.style.cssText = `

            padding: 12px 15px; 

            border: 1px solid #e2e8f0; 

            border-radius: 8px; 

            cursor: pointer;

            transition: background 0.2s;

            background: white;

        `;

        item.onmouseover = () => item.style.background = '#f8fafc';

        item.onmouseout = () => item.style.background = 'white';



        item.innerHTML = `

            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">

                <strong style="color:#1e293b;">${chat.userName || '비회원'}</strong>

                <span style="font-size:0.8rem; color:#94a3b8;">${timeStr}</span>

            </div>

            <div style="font-size:0.9rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">

                ${chat.lastMessage || '내용 없음'}

            </div>

        `;



        item.addEventListener('click', () => {

            document.querySelectorAll('#chat-session-list > div').forEach(d => d.style.border = '1px solid #e2e8f0');

            item.style.border = '2px solid #2563EB';

            loadChatMessages(chat);

        });



        listContainer.appendChild(item);

    });

}



async function loadChatMessages(chat) {

    const header = document.getElementById('chat-detail-header');

    const msgContainer = document.getElementById('chat-detail-messages');



    header.innerHTML = `<strong>${chat.userName}</strong> 님과의 대화 (Session ID: ${chat.id.substring(0, 8)}...)`;

    msgContainer.innerHTML = '<div style="text-align:center; padding:20px;">메시지 로딩 중..</div>';



    try {

        const msgsRef = collection(db, "chats", chat.id, "messages");

        const q = query(msgsRef, orderBy("timestamp", "asc"));

        const snapshot = await getDocs(q);



        msgContainer.innerHTML = '';



        if (snapshot.empty) {

            msgContainer.innerHTML = '<div style="text-align:center; color:#888;">메시지가 없습니다.</div>';

            return;

        }



        snapshot.forEach(docSnap => {

            const data = docSnap.data();

            let dateStr = "";

            if (data.timestamp) {

                const date = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);

                dateStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

            }



            const msgDiv = document.createElement('div');

            msgDiv.style.maxWidth = '75%';

            msgDiv.style.padding = '10px 14px';

            msgDiv.style.borderRadius = '12px';

            msgDiv.style.fontSize = '0.95rem';

            msgDiv.style.lineHeight = '1.4';



            if (data.sender === 'bot') {

                msgDiv.style.alignSelf = 'flex-start';

                msgDiv.style.background = '#e2e8f0';

                msgDiv.style.color = '#1e293b';

                msgDiv.style.borderTopLeftRadius = '4px';

                msgDiv.innerHTML = `

                    <div style="font-size:0.8rem; color:#64748b; margin-bottom:4px;">시스템 응답</div>

                    ${data.text}

                    <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px; text-align:right;">${dateStr}</div>

                `;

            } else if (data.sender === 'admin') {

                msgDiv.style.alignSelf = 'flex-end';

                msgDiv.style.background = '#2563EB';

                msgDiv.style.color = 'white';

                msgDiv.style.borderTopRightRadius = '4px';

                msgDiv.innerHTML = `

                    ${data.text}

                    <div style="font-size:0.75rem; color:#bfdbfe; margin-top:4px; text-align:right;">${dateStr}</div>

                `;

            } else {

                msgDiv.style.alignSelf = 'flex-start';

                msgDiv.style.background = 'white';

                msgDiv.style.border = '1px solid #e2e8f0';

                msgDiv.style.color = '#1e293b';

                msgDiv.style.borderTopLeftRadius = '4px';

                msgDiv.innerHTML = `

                    <div style="font-size:0.8rem; color:#64748b; margin-bottom:4px;">보낸사람: ${data.sender}</div>

                    ${data.text}

                    <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px; text-align:right;">${dateStr}</div>

                `;

            }

            msgContainer.appendChild(msgDiv);

        });



        msgContainer.scrollTop = msgContainer.scrollHeight;



        // Show Admin Input Area

        const inputArea = document.getElementById('chat-input-area');

        if (inputArea) {

            inputArea.style.display = 'flex';

            const sendBtn = document.getElementById('btn-send-admin-message');

            const inputField = document.getElementById('admin-chat-input');



            // clear previous listeners by cloning

            const newSendBtn = sendBtn.cloneNode(true);

            sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);



            newSendBtn.addEventListener('click', () => sendAdminMessage(chat.id, inputField.value));



            inputField.onkeypress = (e) => {

                if (e.key === 'Enter' && !e.shiftKey) {

                    e.preventDefault();

                    sendAdminMessage(chat.id, inputField.value);

                }

            };

        }



    } catch (e) {

        console.error("Load Messages Error:", e);

        msgContainer.innerHTML = `<div style="text-align:center; color:red; padding:20px;">메시지를 불러오지 못했습니다.</div>`;

    }

}



// Send Admin Message

async function sendAdminMessage(chatId, text) {

    if (!text.trim()) return;

    const inputField = document.getElementById('admin-chat-input');

    inputField.disabled = true;



    try {

        // 1. Add message to subcollection

        const msgsRef = collection(db, "chats", chatId, "messages");

        await setDoc(doc(msgsRef), {

            text: text.trim(),

            sender: 'admin',

            timestamp: new Date()

        });



        // 2. Update parent chat doc

        const chatRef = doc(db, "chats", chatId);

        await updateDoc(chatRef, {

            lastMessage: text.trim(),

            lastUpdated: new Date()

        });



        // 3. Clear input & reload

        inputField.value = '';

        inputField.disabled = false;



        // Find current chat session detail to reload messages

        const chatObj = allChats.find(c => c.id === chatId);

        if (chatObj) loadChatMessages(chatObj);



        // Refresh session list to bump it to the top

        fetchChatSessions();



    } catch (e) {

        console.error("Send Message Error:", e);

        alert("메시지 전송 실패: " + e.message);

        inputField.disabled = false;

    }

}



// Add event listener to refresh button if it exists

if (document.getElementById('btn-refresh-chats')) {

    document.getElementById('btn-refresh-chats').addEventListener('click', fetchChatSessions);

}


// --- Popup Management Logic ---

window.loadPopupSettings = async () => {
    try {
        const docRef = doc(db, "settings", "popup");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const isActiveCb = document.getElementById('popup-is-active');
            if(isActiveCb) {
                isActiveCb.checked = data.isActive === true;
                isActiveCb.dispatchEvent(new Event('change'));
            }
            if(document.getElementById('popup-title')) document.getElementById('popup-title').value = data.title || '';
            if(document.getElementById('popup-content')) document.getElementById('popup-content').value = data.content || '';
            if(document.getElementById('popup-link')) document.getElementById('popup-link').value = data.link || '';
            if(document.getElementById('popup-link-text')) document.getElementById('popup-link-text').value = data.linkText || '자세히 보기';
            if(document.getElementById('popup-close-text')) document.getElementById('popup-close-text').value = data.closeText || '오늘 하루 보지 않기';
        }
    } catch (e) {
        console.error("Error loading popup settings:", e);
        alert("팝업 설정을 불러오는 중 오류가 발생했습니다.");
    }
};

window.savePopupSettings = async () => {
    try {
        const isActive = document.getElementById('popup-is-active').checked;
        const title = document.getElementById('popup-title').value.trim();
        const content = document.getElementById('popup-content').value.trim();
        const link = document.getElementById('popup-link').value.trim();
        const linkText = document.getElementById('popup-link-text').value.trim() || '자세히 보기';
        const closeText = document.getElementById('popup-close-text').value.trim() || '오늘 하루 보지 않기';
        
        if (isActive && (!title || !content)) {
            alert("활성화하려면 팝업 제목과 내용을 입력해야 합니다.");
            return;
        }

        const docRef = doc(db, "settings", "popup");
        await setDoc(docRef, {
            isActive,
            title,
            content,
            link,
            linkText,
            closeText,
            updatedAt: new Date()
        });
        
        alert("팝업 설정이 저장되었습니다.");
    } catch (e) {
        console.error("Error saving popup settings:", e);
        alert("팝업 설정을 저장하는 중 오류가 발생했습니다.");
    }
};

// --- General Site Settings Logic ---

window.loadGeneralSettings = async () => {
    try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(document.getElementById('setting-hero-title')) document.getElementById('setting-hero-title').value = data.heroTitle || '';
            if(document.getElementById('setting-hero-subtitle')) document.getElementById('setting-hero-subtitle').value = data.heroSubtitle || '';
            if(document.getElementById('setting-company-name')) document.getElementById('setting-company-name').value = data.siteName || '';
            if(document.getElementById('setting-ceo-name')) document.getElementById('setting-ceo-name').value = data.siteCeo || '';
            if(document.getElementById('setting-address')) document.getElementById('setting-address').value = data.siteAddress || '';
            if(document.getElementById('setting-phone')) document.getElementById('setting-phone').value = data.sitePhone || '';
            if(document.getElementById('setting-email')) document.getElementById('setting-email').value = data.siteEmail || '';
            if(document.getElementById('setting-biz-number')) document.getElementById('setting-biz-number').value = data.siteBizNumber || '';
        }
    } catch (e) {
        console.error("Error loading general settings:", e);
        alert("기본 설정을 불러오는 중 오류가 발생했습니다.");
    }
};

window.saveGeneralSettings = async () => {
    try {
        const heroTitle = document.getElementById('setting-hero-title').value.trim();
        const heroSubtitle = document.getElementById('setting-hero-subtitle').value.trim();
        const siteName = document.getElementById('setting-company-name').value.trim();
        const siteCeo = document.getElementById('setting-ceo-name').value.trim();
        const siteAddress = document.getElementById('setting-address').value.trim();
        const sitePhone = document.getElementById('setting-phone').value.trim();
        const siteEmail = document.getElementById('setting-email').value.trim();
        const siteBizNumber = document.getElementById('setting-biz-number').value.trim();

        const docRef = doc(db, "settings", "general");
        await setDoc(docRef, {
            heroTitle,
            heroSubtitle,
            siteName,
            siteCeo,
            siteAddress,
            sitePhone,
            siteEmail,
            siteBizNumber,
            updatedAt: new Date()
        });
        
        alert("기본 설정이 저장되었습니다.");
    } catch (e) {
        console.error("Error saving general settings:", e);
        alert("기본 설정을 저장하는 중 오류가 발생했습니다.");
    }
};
