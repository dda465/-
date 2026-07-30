import { db, auth, getStorageLazy } from './firebase-config.js';
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxkewwgQ-m_3OQVph5Laex78UEgJV1klI1MaluW5ugsIeZy-bfXdi0JpZMnpER1CxGR/exec";
import { collection, getDocs, getDoc, query, orderBy, limit, doc, updateDoc, setDoc, deleteDoc, writeBatch, serverTimestamp, addDoc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Firebase Storage is lazy-loaded via getStorageLazy() — only loaded when uploading inspection photos



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

// 보기 모드별 상태 정의
// B(검수·정산) = 물건이 우리 손에 있는 단계. A(접수·수거) = 그 외 진행중 전부(모르는 상태도 여기로 → 유령건 방지)
const B_STATUSES = ["택배도착", "검수중", "검수완료", "입금대기", "반송대기"];
const TERMINAL_FOR_LIST = ["입금완료", "취소", "반송접수", "삭제"];
window.currentQuoteView = 'a';

/**
 * @param {'a'|'b'|'all'} view
 *  a   = 접수·수거 : 종결 + B상태 제외(빼는 방식) → 방문수거/개인발송/이탈
 *  b   = 검수·정산 : B상태만(고르는 방식) → 택배도착/검수중/입금대기·검수완료/반송대기
 *  all = 기존 동작 그대로 (롤백/통합검색용)
 */
// 목록 표시/정렬용 헬퍼 (loadQuotes 안에서 쓰이므로 반드시 이 위에 정의)
const _toDateForList = (v) => { if (!v) return null; if (v.toDate) return v.toDate(); if (v.seconds) return new Date(v.seconds * 1000); const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
// 배송방법 확정 시각(submittedAt) 우선, 없으면 접수 시각. 최신순 정렬.
const _byDisplayTimeDesc = (a, b) => Number(b.dataset.sortTime || 0) - Number(a.dataset.sortTime || 0);

async function loadQuotes(view) {
    view = view || window.currentQuoteView || 'all';
    window.currentQuoteView = view;
    // 성능 계측 — 느려질 때 콘솔(F12)에서 어디가 오래 걸리는지 바로 확인할 수 있게 남긴다.
    const _t0 = performance.now();
    try {
        // 진행중(입금완료·취소·반송접수·삭제 아님)만 서버에서 불러옴 — 초기 로딩 경량화
        let q;
        if (view === 'b') {
            q = query(collection(db, "quotes"), where("status", "in", B_STATUSES), orderBy("status"), orderBy("firebaseTimestamp", "desc"));
        } else if (view === 'a') {
            q = query(collection(db, "quotes"), where("status", "not-in", [...TERMINAL_FOR_LIST, ...B_STATUSES]), orderBy("status"), orderBy("firebaseTimestamp", "desc"));
        } else {
            q = query(collection(db, "quotes"), where("status", "not-in", TERMINAL_FOR_LIST), orderBy("status"), orderBy("firebaseTimestamp", "desc"));
        }
        const querySnapshot = await getDocs(q);
        console.log(`[성능] 목록 조회 ${Math.round(performance.now() - _t0)}ms / ${querySnapshot.size}건 (보기:${view})`);

        quotesTableBody.innerHTML = '';

        let pendingCount = 0;
        let pendingAmount = 0;
        let monthlyCount = 0;
        let monthlyAmount = 0;

        if (querySnapshot.empty) {
            quotesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">표시할 신청이 없습니다.</td></tr>';
            // 완료/취소/반송 탭은 각자 on-demand로 로드되므로, 전체 보기(기존 동작)일 때만 비움 처리.
            // (A/B 보기가 0건이라고 해서 다른 탭 목록을 지우면 안 됨)
            if (view === 'all') {
                const completedTableBody = document.getElementById('completed-table-body');
                if (completedTableBody) completedTableBody.innerHTML = '<tr><td colspan="8" class="text-center">매입 완료된 신청이 없습니다.</td></tr>';
                const canceledTableBody = document.getElementById('canceled-table-body');
                if (canceledTableBody) canceledTableBody.innerHTML = '<tr><td colspan="8" class="text-center">취소된 신청이 없습니다.</td></tr>';
                const returnedTableBody = document.getElementById('returned-table-body');
                if (returnedTableBody) returnedTableBody.innerHTML = '<tr><td colspan="8" class="text-center">반송 접수된 신청이 없습니다.</td></tr>';
            }

            updateStats(0, 0, 0, 0);
            if (view === 'all') loadMonthlyPaidStats(); // A/B는 자체 카드(loadAbStats)가 계산 — 중복 200건 조회 방지
            loadAbStats(view, {});
            return;
        }

        const cvsRows = [];
        const courierRows = [];
        const pendingRows = [];
        const inspectingRows = [];
        const urgentRows = [];
        const returnPendingRows = [];
        const arrivedRows = []; // 택배도착(굿스플로 기준 도착 · 실물 확인 전)
        const pickupFailedRows = []; // 미집하 — 기사가 방문했으나 수거 못 함 (사람이 개입해야 함)

        const completedItems = [];
        const canceledItems = [];
        const returnedItems = [];

        // not-in 쿼리는 status 순으로 강제 정렬되므로, 화면 표시 전 신청일자(firebaseTimestamp) 내림차순으로 재정렬
        const quoteSortKey = (data) => {
            // 배송방법 확정 시각을 우선 (뒤늦게 마무리한 건이 아래로 묻히지 않게)
            const sa = data.submittedAt;
            if (sa) {
                if (typeof sa.toMillis === 'function') return sa.toMillis();
                if (sa.seconds) return sa.seconds * 1000;
                const d = new Date(sa); if (!isNaN(d.getTime())) return d.getTime();
            }
            const ft = data.firebaseTimestamp;
            if (ft) {
                if (typeof ft.toMillis === 'function') return ft.toMillis();
                if (ft.seconds) return ft.seconds * 1000;
                const d = new Date(ft); if (!isNaN(d.getTime())) return d.getTime();
            }
            if (data.timestamp) {
                const m = String(data.timestamp).match(/(\d+)\.\s*(\d+)\.\s*(\d+)/);
                if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])).getTime();
                const d = new Date(data.timestamp); if (!isNaN(d.getTime())) return d.getTime();
            }
            return 0;
        };
        const sortedDocs = [];
        querySnapshot.forEach((d) => sortedDocs.push(d));
        sortedDocs.sort((a, b) => quoteSortKey(b.data()) - quoteSortKey(a.data()));

        sortedDocs.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const id = docSnapshot.id;
            const status = data.status || '신청접수';

            if (data.isDeleted) return;

            const isForeigner = data.isForeigner === true || data.method === 'foreigner' || data.series === 'Foreigner';
            if (isForeigner) return;

            // Stats Calculation
            if (status === '입금완료') {
                let pDate = null;
                if (data.paidAt) {
                    pDate = data.paidAt.toDate ? data.paidAt.toDate() : new Date(data.paidAt.seconds ? data.paidAt.seconds * 1000 : data.paidAt);
                } else if (data.customerAgreedAt) {
                    pDate = data.customerAgreedAt.toDate ? data.customerAgreedAt.toDate() : new Date(data.customerAgreedAt.seconds ? data.customerAgreedAt.seconds * 1000 : data.customerAgreedAt);
                } else if (data.inspectionData && data.inspectionData.inspectedAt) {
                    pDate = new Date(data.inspectionData.inspectedAt);
                } else if (data.firebaseTimestamp) {
                    pDate = data.firebaseTimestamp.toDate ? data.firebaseTimestamp.toDate() : new Date(data.firebaseTimestamp.seconds ? data.firebaseTimestamp.seconds * 1000 : data.firebaseTimestamp);
                } else if (data.timestamp) {
                    const koMatch = String(data.timestamp).match(/(\d+)\.\s*(\d+)\.\s*(\d+)/);
                    if (koMatch) {
                        pDate = new Date(parseInt(koMatch[1]), parseInt(koMatch[2]) - 1, parseInt(koMatch[3]));
                    } else {
                        const d = new Date(data.timestamp);
                        if (!isNaN(d.getTime())) pDate = d;
                    }
                }
                const now = new Date();
                if (pDate && pDate.getFullYear() === now.getFullYear() && pDate.getMonth() === now.getMonth()) {
                    monthlyCount++;
                    monthlyAmount += (data.price || 0);
                }
            } else if (status !== '취소' && status !== '반송접수') {
                const isDroppedOff = !data.deliveryMethod || data.deliveryMethod === 'pending';
                if (!isDroppedOff) {
                    pendingCount++;
                    pendingAmount += (data.price || 0);
                }
            }

            // 표시 기준 시각 — 배송방법이 확정된 submittedAt을 우선 사용.
            // firebaseTimestamp는 본인인증 직후(배송방법 선택 전) 시각이라,
            // 며칠 뒤에 마무리한 고객이 목록 아래쪽에 묻혀 놓치는 문제가 있었다.
            const formattedDate = formatDate(data.submittedAt || data.firebaseTimestamp || data.timestamp);
            const formattedPrice = new Intl.NumberFormat('ko-KR').format(data.price || 0);

            // Status Badge Logic
            let statusClass = 'status-new';
            if (status === '수거중') statusClass = 'status-pickup';
            if (status === '택배도착') statusClass = 'status-pickup';
            if (status.includes('검수중')) statusClass = 'status-inspection';
            if (status === '입금완료') statusClass = 'status-paid';
            if (status === '입금대기' || status === '검수완료') statusClass = 'status-waiting';
            if (status === '반송대기') statusClass = 'status-return-pending';

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
                // 굿스플로 방문수거 예약 상태 표시 (예약됨 / 예약가능 / 우편번호없음 / 실패)
                let gfTag = '';
                if (data.goodsflowOrderNo) {
                    // 번호가 3종류다 — 섞어 쓰면 고객이 택배사에서 조회할 수 없다.
                    //  · goodsflowRelayInvoiceNo       : 한진 간선 운송장 (573848472934) ← 고객 조회 가능, 이것만 안내
                    //  · goodsflowTransporterInvoiceNo : 홈픽 집하구간 번호 (26072899529001) — 조회 불가
                    //  · goodsflowInvoiceNo            : 굿스플로 내부 예약번호 (260728-99529-001) — 조회 불가
                    const relay = data.goodsflowRelayInvoiceNo;
                    const inv = relay
                        ? ` · 운송장 ${relay}`
                        : (data.goodsflowTransporterInvoiceNo || data.goodsflowInvoiceNo
                            ? ` · 접수 ${data.goodsflowTransporterInvoiceNo || data.goodsflowInvoiceNo} (운송장 대기)`
                            : ' · 운송장 대기');
                    gfTag = `<br><span style="font-size:0.75rem; background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block; font-weight:bold;">수거예약 완료${inv}</span>
                    <button onclick="cancelGoodsflowPickup('${id}')" style="font-size:0.7rem; background:#fff; color:#dc2626; border:1px solid #fca5a5; padding:2px 8px; border-radius:4px; margin-top:4px; margin-left:4px; cursor:pointer; font-weight:bold;">예약취소</button>`;
                    // 미집하 — 기사 방문했으나 수거 실패. 알림톡 발송 여부까지 함께 보여준다.
                    if (data.goodsflowAlert === 'PICKUP_FAILED') {
                        const notiTxt = data.pickupFailedNotifySkipped ? '안내 미발송(오래된 건)'
                            : (data.pickupFailedNotifiedAt ? '안내 발송됨'
                                : (data.pickupFailedNotifyError ? '안내 발송실패' : '안내 대기'));
                        gfTag += `<br><span title="택배 기사가 방문했으나 수거하지 못한 건입니다. 고객 연락이 필요합니다." style="font-size:0.7rem; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; margin-top:3px; display:inline-block; font-weight:bold;">⚠ 미집하 · ${notiTxt}</span>`;
                    }
                    // 희망일과 다른 날로 접수된 건은 고객 안내가 필요하므로 목록에서도 계속 보이게 둔다
                    if (data.goodsflowPickupDateShifted && data.goodsflowPickupRequestDateTime) {
                        gfTag += `<br><span title="고객이 고른 날짜로는 접수가 불가(지난 날짜 또는 일요일·공휴일)하여 자동으로 변경되었습니다. 고객 안내 필요." style="font-size:0.7rem; background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; margin-top:3px; display:inline-block; font-weight:bold;">⚠ 수거일 변경 → ${data.goodsflowPickupRequestDateTime}</span>`;
                    }
                } else if (!data.customerZipCode) {
                    gfTag = `<br><span title="우편번호 저장 기능 이전에 접수된 건이라 자동예약을 할 수 없습니다. 굿스플로에서 수동 접수해주세요." style="font-size:0.7rem; background:#f1f5f9; color:#94a3b8; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block;">수거예약 불가(우편번호 없음)</span>`;
                } else {
                    gfTag = `<br><button onclick="bookGoodsflowPickup('${id}')" style="font-size:0.72rem; background:#2563eb; color:#fff; border:none; padding:3px 10px; border-radius:4px; margin-top:4px; cursor:pointer; font-weight:bold;">🚚 수거 예약</button>`;
                }
                if (data.goodsflowError) {
                    gfTag += `<br><span title="${String(data.goodsflowError).replace(/"/g, '&quot;')}" style="font-size:0.7rem; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; margin-top:3px; display:inline-block; font-weight:bold;">예약실패 (마우스를 올려 사유 확인)</span>
                    <button onclick="cancelGoodsflowPickup('${id}')" title="실패 표시를 지웁니다" style="font-size:0.65rem; background:#fff; color:#64748b; border:1px solid #cbd5e1; padding:1px 7px; border-radius:4px; margin-left:4px; cursor:pointer;">지우기</button>`;
                }
                deliveryTag = `<br><span style="font-size: 0.75rem; background: #E8F5E9; color: #2E7D32; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">방문수거 (${data.pickupDate || '미정'})</span>${gfTag}`;
            } else if (!data.deliveryMethod || data.deliveryMethod === 'pending') {
                deliveryTag = `<br>
                <span style="font-size: 0.75rem; background: #ffe4e6; color: #e11d48; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block; font-weight: bold;">배송방법 미입력 (이탈)</span>
                <span class="escapee-dup-badge" data-phone="${String(data.customerPhone || '').replace(/[^0-9]/g, '')}" title="같은 번호로 정상 신청/매입완료 이력 있음 (삭제 대상)" style="display:none; font-size:0.75rem; background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; margin-top:4px; margin-left:5px; font-weight:bold; box-shadow:0 1px 2px rgba(0,0,0,0.1);">중복</span>
                <button onclick="sendDropoffAlert('${id}')" style="font-size: 0.75rem; background: #FEE500; color: #391B1B; padding: 2px 8px; border-radius: 4px; margin-top: 4px; margin-left: 5px; border: none; font-weight: bold; cursor: pointer; display: inline-block; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">알림톡 보내기</button>`;
            }

            let feePaidBtn = '';
            if (data.deliveryMethod === 'cvs') {
                if (data.shippingFeePaid) {
                    feePaidBtn = `<br><button class="action-btn" style="background:#E8F5E9; color:#2E7D32; border-color:#81C784; margin-top:5px; width: 100%;" onclick="toggleShippingFee('${id}', false)">배송비 입금됨 ✓</button>`;
                } else {
                    feePaidBtn = `<br><button class="action-btn" style="background:#FFF; color:#E65100; border-color:#FFB74D; margin-top:5px; width: 100%;" onclick="toggleShippingFee('${id}', true)">배송비 입금확인</button>`;
                }
                // 개인발송은 굿스플로를 타지 않아 폴러가 도착·집하를 감지하지 못한다.
                // 그래서 담당자가 직접 상황을 보고 안내 알림톡을 보낼 수 있게 버튼을 둔다.
                const cvsSent = data.cvsNotifiedAt
                    ? (data.cvsNotifiedAt.toDate ? data.cvsNotifiedAt.toDate() : new Date(data.cvsNotifiedAt.seconds ? data.cvsNotifiedAt.seconds * 1000 : data.cvsNotifiedAt))
                    : null;
                const cvsSentTxt = (cvsSent && !isNaN(cvsSent.getTime()))
                    ? `발송됨 ${cvsSent.getMonth() + 1}/${cvsSent.getDate()} ${String(cvsSent.getHours()).padStart(2, '0')}:${String(cvsSent.getMinutes()).padStart(2, '0')}`
                    : '';
                feePaidBtn += `<br><button class="action-btn" style="background:#FEE500; color:#391B1B; border-color:#E5CF00; margin-top:5px; width: 100%; font-weight:bold;" onclick="sendCvsAlimtalk('${id}')">${cvsSentTxt ? '알림톡 재발송' : '알림톡 발송'}</button>`;
                if (cvsSentTxt) {
                    feePaidBtn += `<br><span style="font-size:0.7rem; color:#64748b; display:inline-block; margin-top:2px;">${cvsSentTxt}</span>`;
                }
            }

            let displayStatus = status;
            if (status === '신청접수') displayStatus = '매입접수완료';
            if (status === '수거중') displayStatus = '택배발송완료';

            const sourceMap = {
                'daangn': '<span style="font-size:0.75rem; background:#fff3e0; color:#e65100; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">당근마켓 🥕</span>',
                'naver': '<span style="font-size:0.75rem; background:#e6f4ea; color:#137333; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">네이버 🟢</span>',
                'naver_search': '<span style="font-size:0.75rem; background:#e6f4ea; color:#137333; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">네이버 검색 🔎</span>',
                'naver_display': '<span style="font-size:0.75rem; background:#dbeafe; color:#1d4ed8; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">네이버 디스플레이 🖼️</span>',
                'google': '<span style="font-size:0.75rem; background:#e8f0fe; color:#1967d2; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">구글 🔵</span>',
                'instagram': '<span style="font-size:0.75rem; background:#fdf2f8; color:#db2777; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">인스타 📷</span>',
                'tiktok': '<span style="font-size:0.75rem; background:#e0f7fa; color:#00838f; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">틱톡 🎵</span>',
                'direct': '<span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">직접유입 📱</span>'
            };
            const sourceTag = sourceMap[data.trafficSource] || `<span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">${data.trafficSource || '기타/직접'}</span>`;

            const methodDisplay = data.method === 'self' ? '셀프접수' : '간편접수';
            const methodBadge = data.method === 'self' 
                ? `<br><span style="font-size: 0.75rem; background: #F3E8FF; color: #6B21A8; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px; font-weight: 600;">셀프접수</span>`
                : `<br><span style="font-size: 0.75rem; background: #E0F2FE; color: #0369A1; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px; font-weight: 600;">간편접수</span>`;

            let contractReminderBtn = '';
            if (status === '검수완료') {
                contractReminderBtn = `<br><button onclick="sendContractReminder('${id}')" style="font-size: 0.75rem; background: #FEE500; color: #391B1B; padding: 2px 8px; border-radius: 4px; margin-top: 4px; border: none; font-weight: bold; cursor: pointer; display: inline-block; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">독촉 알림톡</button>`;
            }

            const isPendingRow = (status !== '입금완료' && status !== '취소' && status !== '반송접수' && status !== '입금대기' && status !== '검수완료' && status !== '검수중' && status !== '반송대기' && status !== '택배도착' && data.deliveryMethod !== 'cvs' && data.deliveryMethod !== 'courier');

            // 택배도착 상태면 도착 일시를 배지 아래에 표기 (굿스플로 자동전환·수동전환 모두 arrivedAt 사용)
            let arrivedTag = '';
            if (status === '택배도착' && data.arrivedAt) {
                const av = data.arrivedAt;
                const ad = av.toDate ? av.toDate() : (av.seconds ? new Date(av.seconds * 1000) : new Date(av));
                if (!isNaN(ad.getTime())) {
                    const mm = ad.getMonth() + 1, dd = ad.getDate();
                    const hh = String(ad.getHours()).padStart(2, '0'), mi = String(ad.getMinutes()).padStart(2, '0');
                    arrivedTag = `<br><span style="font-size:0.72rem; color:#0f766e; font-weight:600; display:inline-block; margin-top:3px;">도착 ${mm}/${dd} ${hh}:${mi}</span>`;
                }
            }

            // 전자매매계약서(검수서) 발송 시각 표기 — 검수완료 이후 상태에서 inspectedAt을 보여준다.
            // 발송 시점이 곧 검수서 저장 시점이므로 inspectionData.inspectedAt을 그대로 사용.
            let contractSentTag = '';
            const CONTRACT_SENT_STATUSES = ['검수완료', '입금대기', '입금완료', '반송대기', '반송접수'];
            if (CONTRACT_SENT_STATUSES.includes(status) && data.inspectionData && data.inspectionData.inspectedAt) {
                const cd = new Date(data.inspectionData.inspectedAt);
                if (!isNaN(cd.getTime())) {
                    const mm = cd.getMonth() + 1, dd = cd.getDate();
                    const hh = String(cd.getHours()).padStart(2, '0'), mi = String(cd.getMinutes()).padStart(2, '0');
                    contractSentTag = `<br><span style="font-size:0.72rem; color:#1976D2; font-weight:600; display:inline-block; margin-top:3px;">📄 계약서 발송 ${mm}/${dd} ${hh}:${mi}</span>`;
                }
            }

            // 접수·수거(A) 보기에선 물건이 아직 안 왔으므로 검수서 작성 버튼을 숨김 (전체 보기는 기존 그대로)
            const inspectionBtn = (view === 'a') ? '' : `<button class="action-btn" style="background:#E3F2FD; color:#1976D2; border-color:#90CAF9;" onclick="openInspectionModal('${id}')">검수서 작성</button>`;
            const trHtml = `
                <td><input type="checkbox" class="quote-checkbox${isPendingRow ? ' pending-quote-checkbox' : ''}" value="${id}" /></td>
                <td>${formattedDate}${deliveryTag}</td>
                <td>${data.customerName}<span class="repeat-badge" data-phone="${String(data.customerPhone || '').replace(/\D/g, '')}" data-self="${id}"></span><br><span style="font-size:0.8rem; color:#888;">${data.customerPhone}</span><br>${sourceTag}${contractReminderBtn}</td>
                <td>${data.brand} ${data.model}</td>
                <td>${data.condition || data.grade || '-'}</td>
                <td>${formatCurrency(data.price)}${methodBadge}</td>
                <td><span class="status-badge ${statusClass}">${displayStatus}</span>${arrivedTag}${contractSentTag}</td>
                <td>
                    <button class="action-btn" onclick="viewDetail('${id}')">상세보기</button>
                    ${inspectionBtn}
                    <select onchange="updateQuoteStatus('${id}', this.value)" class="action-btn" style="width: auto;">
                        <option value="" disabled selected>상태변경</option>
                        <option value="신청접수">매입접수완료</option>
                        <option value="수거중">택배발송완료</option>
                        <option value="택배도착" ${status === '택배도착' ? 'selected' : ''}>택배도착(실물확인 전)</option>
                        <option value="검수중">검수중</option>
                        <option value="입금대기" ${status === '입금대기' ? 'selected' : ''}>입금대기</option>
                        <option value="입금완료" ${status === '입금완료' ? 'selected' : ''}>입금완료</option>
                        <option value="반송대기" ${status === '반송대기' ? 'selected' : ''}>반송대기</option>
                        <option value="반송접수" ${status === '반송접수' ? 'selected' : ''}>반송접수</option>
                        <option value="취소" ${status === '취소' ? 'selected' : ''}>취소</option>
                    </select>
                    <button class="action-btn" style="color:red; margin-left:5px;" onclick="deleteQuote('${id}')">삭제</button>
                    ${feePaidBtn}
                </td>
            `;

            const tr = document.createElement('tr');
            tr.innerHTML = trHtml;
            // 화면 정렬 키 — Firestore는 firebaseTimestamp로 정렬해 오지만(기존 문서 누락 방지),
            // 실제로 보여줄 순서는 '배송방법 확정 시각' 기준이어야 뒤늦게 마무리한 건이 위로 온다.
            const _sortAt = _toDateForList(data.submittedAt) || _toDateForList(data.firebaseTimestamp) || _toDateForList(data.timestamp);
            tr.dataset.sortTime = _sortAt ? _sortAt.getTime() : 0;

            if (status === '입금완료') {
                completedItems.push({ id, ...data });
            } else if (status === '취소') {
                canceledItems.push({ id, ...data });
            } else if (status === '반송접수') {
                returnedItems.push({ id, ...data });
            } else {
                if (data.goodsflowAlert === 'PICKUP_FAILED' && status !== '택배도착') {
                    // 미집하는 방치되기 쉬워 별도 구역으로 분리 (배송방법 분류보다 우선)
                    pickupFailedRows.push(tr);
                } else if (status === '반송대기') {
                    returnPendingRows.push(tr);
                } else if (status === '입금대기' || status === '검수완료') {
                    urgentRows.push(tr);
                } else if (status === '검수중') {
                    inspectingRows.push(tr);
                } else if (status === '택배도착') {
                    arrivedRows.push(tr);
                } else if (data.deliveryMethod === 'cvs') {
                    cvsRows.push(tr);
                } else if (data.deliveryMethod === 'courier') {
                    courierRows.push(tr);
                } else {
                    pendingRows.push(tr);
                }
            }
        });

        // Append sorted rows — 보기 모드에 따라 섹션 선택
        const showA = (view === 'a' || view === 'all'); // 방문수거/개인발송/이탈
        const showB = (view === 'b' || view === 'all'); // 택배도착/검수중/입금대기·검수완료/반송대기

        // 미집하: 기사가 갔는데 못 받아온 건. 건수는 항상 보이되 목록은 접어두고,
        // 헤더를 클릭할 때만 펼친다 (평소 목록이 길어지는 걸 막으면서 존재는 놓치지 않게).
        if (showA && pickupFailedRows.length > 0) {
            const dividerFailed = document.createElement('tr');
            dividerFailed.style.cursor = 'pointer';
            dividerFailed.innerHTML = `<td colspan="8" style="background: #FFEBEE; text-align: center; font-weight: bold; padding: 12px; color: #C62828; border-bottom: 2px solid #FFCDD2; font-size: 1.05rem;">
                <span id="pf-toggle-icon">▶</span> ⚠️ 미집하 — 기사 방문했으나 수거 실패 (고객 연락 필요) (${pickupFailedRows.length}건)
                <span style="font-size:0.8rem; font-weight:normal; color:#a13; margin-left:6px;">클릭하여 펼치기</span>
            </td>`;
            quotesTableBody.appendChild(dividerFailed);

            pickupFailedRows.sort(_byDisplayTimeDesc);
            pickupFailedRows.forEach(tr => {
                tr.style.display = 'none';           // 기본은 접힌 상태
                tr.classList.add('pf-row');
                quotesTableBody.appendChild(tr);
            });

            let pfOpen = false;
            dividerFailed.onclick = () => {
                pfOpen = !pfOpen;
                pickupFailedRows.forEach(tr => { tr.style.display = pfOpen ? '' : 'none'; });
                const ic = document.getElementById('pf-toggle-icon');
                if (ic) ic.textContent = pfOpen ? '▼' : '▶';
                const hint = dividerFailed.querySelector('td span:last-child');
                if (hint) hint.textContent = pfOpen ? '클릭하여 접기' : '클릭하여 펼치기';
            };
        }

        // 택배도착: B의 '받은 편지함' — 굿스플로 기준 도착, 실물 확인 전
        if (showB && arrivedRows.length > 0) {
            const dividerArrived = document.createElement('tr');
            dividerArrived.innerHTML = `<td colspan="8" style="background: #E0F2F1; text-align: center; font-weight: bold; padding: 12px; color: #00695C; border-bottom: 2px solid #B2DFDB; font-size: 1.05rem;">📬 택배도착 (실물 확인 후 검수중으로) (${arrivedRows.length}건)</td>`;
            quotesTableBody.appendChild(dividerArrived);
            arrivedRows.sort(_byDisplayTimeDesc);
            arrivedRows.forEach(tr => quotesTableBody.appendChild(tr));
        }

        if (showB && urgentRows.length > 0) {
            const dividerUrgent = document.createElement('tr');
            dividerUrgent.innerHTML = `<td colspan="8" style="background: #FFF8E1; text-align: center; font-weight: bold; padding: 12px; color: #E65100; border-bottom: 2px solid #FFE082; font-size: 1.05rem;">💰 입금대기 / 검수완료 건 (${urgentRows.length}건)</td>`;
            quotesTableBody.appendChild(dividerUrgent);
            urgentRows.sort(_byDisplayTimeDesc);
            urgentRows.forEach(tr => quotesTableBody.appendChild(tr));
        }

        if (showB && inspectingRows.length > 0) {
            const dividerInspecting = document.createElement('tr');
            dividerInspecting.innerHTML = `<td colspan="8" style="background: #E3F2FD; text-align: center; font-weight: bold; padding: 12px; color: #1976D2; border-bottom: 2px solid #BBDEFB; ${urgentRows.length > 0 ? 'border-top: 2px solid #e2e8f0;' : ''}">🔍 검수중 건 (${inspectingRows.length}건)</td>`;
            quotesTableBody.appendChild(dividerInspecting);
            inspectingRows.sort(_byDisplayTimeDesc);
            inspectingRows.forEach(tr => quotesTableBody.appendChild(tr));
        }

        if (showB && returnPendingRows.length > 0) {
            const dividerReturnPending = document.createElement('tr');
            dividerReturnPending.innerHTML = `<td colspan="8" style="background: #F3E8FF; text-align: center; font-weight: bold; padding: 12px; color: #6B21A8; border-bottom: 2px solid #E9D5FF; ${(urgentRows.length > 0 || inspectingRows.length > 0) ? 'border-top: 2px solid #e2e8f0;' : ''}">📦 반송대기 건 (${returnPendingRows.length}건)</td>`;
            quotesTableBody.appendChild(dividerReturnPending);
            returnPendingRows.sort(_byDisplayTimeDesc);
            returnPendingRows.forEach(tr => quotesTableBody.appendChild(tr));
        }

        if (showA && cvsRows.length > 0) {
            const dividerCvs = document.createElement('tr');
            dividerCvs.innerHTML = `<td colspan="8" style="background: #FFF3E0; text-align: center; font-weight: bold; padding: 12px; color: #E65100; border-bottom: 2px solid #FFE0B2; ${(urgentRows.length > 0 || inspectingRows.length > 0 || returnPendingRows.length > 0) ? 'border-top: 2px solid #e2e8f0;' : ''}">🏪 개인발송 건 (${cvsRows.length}건)</td>`;
            quotesTableBody.appendChild(dividerCvs);
            cvsRows.sort(_byDisplayTimeDesc);
            cvsRows.forEach(tr => quotesTableBody.appendChild(tr));
        }

        if (showA && courierRows.length > 0) {
            const dividerCourier = document.createElement('tr');
            dividerCourier.innerHTML = `<td colspan="8" style="background: #E8F5E9; padding: 10px 16px; color: #2E7D32; border-bottom: 2px solid #C8E6C9; ${(urgentRows.length > 0 || inspectingRows.length > 0 || returnPendingRows.length > 0 || cvsRows.length > 0) ? 'border-top: 2px solid #e2e8f0;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <span style="font-weight:bold;">🚚 방문수거 신청 건 (${courierRows.length}건)</span>
                    <span style="display:flex; gap:6px;">
                        <button onclick="reconcileGoodsflow(this)" title="굿스플로에만 남아있는 예약(기사 헛출동 위험)을 찾아 정리합니다" style="background:#fff; color:#2E7D32; border:1px solid #2E7D32; padding:5px 12px; border-radius:6px; font-weight:bold; font-size:0.75rem; cursor:pointer;">🔍 굿스플로 대조</button>
                        <button onclick="pollGoodsflowNow(this)" title="굿스플로에서 배송상태를 조회해 도착한 건을 '택배도착'으로 넘깁니다" style="background:#2E7D32; color:white; border:none; padding:5px 12px; border-radius:6px; font-weight:bold; font-size:0.75rem; cursor:pointer;">📦 배송상태 확인</button>
                    </span>
                </div>
            </td>`;
            quotesTableBody.appendChild(dividerCourier);
            courierRows.sort(_byDisplayTimeDesc);
            courierRows.forEach(tr => quotesTableBody.appendChild(tr));
        }

        if (showA && pendingRows.length > 0) {
            const dividerPending = document.createElement('tr');
            dividerPending.innerHTML = `<td colspan="8" style="background: #FFEBEE; padding: 8px 16px; color: #C62828; border-bottom: 2px solid #FFCDD2; ${(urgentRows.length > 0 || inspectingRows.length > 0 || returnPendingRows.length > 0 || cvsRows.length > 0 || courierRows.length > 0) ? 'border-top: 2px solid #e2e8f0;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-weight: bold; font-size: 0.95rem; display: flex; align-items: center; gap: 4px;">⚠️ 배송방법 미입력 건 (${pendingRows.length}건)</span>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button onclick="markEscapeeDuplicates(this)" style="background: #6366f1; color: white; border: 1px solid #4f46e5; padding: 5px 12px; border-radius: 6px; font-weight: bold; font-size: 0.75rem; cursor: pointer;" title="같은 번호로 정상 신청/매입완료 이력이 있는 이탈건을 찾아 표시">중복 표시</button>
                        <span style="color: #FFCDD2; margin: 0 2px;">|</span>
                        <button onclick="bulkCancelPendingQuotes(true)" style="background: #EF4444; color: white; border: 1px solid #DC2626; padding: 5px 12px; border-radius: 6px; font-weight: bold; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#DC2626'" onmouseout="this.style.background='#EF4444'">선택 취소</button>
                        <button onclick="bulkCancelPendingQuotes(false)" style="background: #B91C1C; color: white; border: 1px solid #991B1B; padding: 5px 12px; border-radius: 6px; font-weight: bold; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#991B1B'" onmouseout="this.style.background='#B91C1C'">전체 취소</button>
                        <span style="color: #FFCDD2; margin: 0 2px;">|</span>
                        <button onclick="bulkSendPendingAlimtalk(true)" style="background: #FEE500; color: #391B1B; border: 1px solid #d97706; padding: 5px 12px; border-radius: 6px; font-weight: bold; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#facc15'" onmouseout="this.style.background='#FEE500'">선택 알림톡 발송</button>
                        <button onclick="bulkSendPendingAlimtalk(false)" style="background: #F59E0B; color: white; border: 1px solid #D97706; padding: 5px 12px; border-radius: 6px; font-weight: bold; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#D97706'" onmouseout="this.style.background='#F59E0B'">전체 알림톡 발송</button>
                    </div>
                </div>
            </td>`;
            quotesTableBody.appendChild(dividerPending);
            pendingRows.sort(_byDisplayTimeDesc);
            pendingRows.forEach(tr => quotesTableBody.appendChild(tr));
        }

        // 현재 보기에서 실제로 그려진 행이 없으면 안내
        if (quotesTableBody.children.length === 0) {
            quotesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">표시할 신청이 없습니다.</td></tr>';
        }

        // Save to window globals for client side filtering
        window.completedQuotesData = completedItems;
        window.canceledQuotesData = canceledItems;
        window.returnedQuotesData = returnedItems;

        // 완료/취소/반송 탭은 해당 탭 클릭 시에만 로드(loadTerminalTab) — 초기 로딩 경량화
        // 진행중 기준 대기 통계 반영, 이번달 입금완료는 별도 조회로 표시
        updateStats(pendingCount, pendingAmount, 0, 0);
        if (view === 'all') loadMonthlyPaidStats(); // A/B는 자체 카드(loadAbStats)가 계산 — 중복 200건 조회 방지
        loadAbStats(view, {
            pendingCount, pendingAmount,
            escapee: pendingRows.length,
            courier: courierRows.length,      // 방문수거
            cvs: cvsRows.length,              // 개인발송
            inspecting: inspectingRows.length, // 검수중
            urgent: urgentRows.length,         // 입금대기 + 검수완료
            pickupFailed: pickupFailedRows.length // 미집하 (기사 방문했으나 수거 실패)
        });
        // 중복 표시는 전체 quotes 조회가 필요해 무거우므로, 자동 실행하지 않고 '이탈 중복 표시' 버튼 클릭 시에만 실행

        console.log(`[성능] 화면 렌더 완료 ${Math.round(performance.now() - _t0)}ms`);

        // 재방문(재거래) 고객 표시 — 렌더 후 비동기로 붙여 목록 표시를 늦추지 않음
        scheduleReturningMark();

    } catch (e) {
        console.error("Error loading quotes:", e);
        quotesTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">데이터 로딩 실패: ${e.message}</td></tr>`;
    }
}



// ─── 재방문(재거래) 고객 표시 ───────────────────────────────────────────
// 목록에 뜬 고객의 전화번호로 과거 '입금완료' 이력을 찾아 이름 옆에 뱃지를 붙인다.
// 목록 렌더가 끝난 뒤 비동기로 돌아 로딩을 늦추지 않고, 결과는 세션 캐시에 남겨 재조회를 줄인다.
let _paidPhoneCounts = null;      // 번호 → 입금완료 건수 (세션 1회 로드)
let _paidDocIdsByPhone = null;    // 번호 → 입금완료 문서ID 집합 (자기 자신 제외용)

// 뱃지 작업 실행 시점 조절.
// PC는 여유가 있어 바로 돌리지만, 모바일은 자바스크립트가 3~5배 느려서
// 이 작업(조회 2회 + 번호 대조)이 첫 화면 조작을 막는다.
// 유휴 시간으로 미뤄 목록을 먼저 만질 수 있게 한다. 뱃지는 잠시 뒤 붙는다.
function scheduleReturningMark() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) { markReturningCustomers(); return; }
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => markReturningCustomers(), { timeout: 2500 });
    } else {
        setTimeout(() => markReturningCustomers(), 1200);
    }
}
async function markReturningCustomers() {
    const badges = Array.from(document.querySelectorAll('.repeat-badge[data-phone]:not([data-done])'));
    if (badges.length === 0) return;

    // 번호별로 뱃지를 묶어 같은 번호는 한 번만 조회
    const byPhone = new Map();
    badges.forEach(b => {
        b.setAttribute('data-done', '1');
        const p = b.getAttribute('data-phone') || '';
        if (p.length < 9) return; // 번호 없음/이상치는 건너뜀
        if (!byPhone.has(p)) byPhone.set(p, []);
        byPhone.get(p).push(b);
    });

    // 두 가지를 구분해 보여준다.
    //  · 재방문 : 과거에 거래가 성사된(입금완료) 이력 → 단골 고객
    //  · 진행중 : 지금 이 사람의 '다른' 신청이 살아있음 → 중복 접수일 수 있어 확인 필요
    //             (예: 미집하로 방치된 건이 있는데 새로 신청한 경우)
    const render = (els, paidCount, activeCount) => {
        if (!paidCount && !activeCount) return;
        let html = '';
        if (paidCount) {
            html += `<span title="과거 입금완료 ${paidCount}건 — 재거래 고객" style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:10px; background:#FFF3E0; color:#E65100; border:1px solid #FFCC80; font-size:0.7rem; font-weight:700; vertical-align:middle;">재방문${paidCount > 1 ? ' ' + paidCount : ''}</span>`;
        }
        if (activeCount) {
            html += `<span title="같은 연락처로 진행 중인 다른 신청이 ${activeCount}건 있습니다. 중복 접수인지 확인하세요." style="display:inline-block; margin-left:4px; padding:1px 6px; border-radius:10px; background:#FEE2E2; color:#B91C1C; border:1px solid #FCA5A5; font-size:0.7rem; font-weight:700; vertical-align:middle;">진행중 ${activeCount}</span>`;
        }
        els.forEach(el => { el.innerHTML = html; });
    };

    const _rt0 = performance.now();

    // ★ 예전엔 화면에 뜬 번호를 5개씩 묶어 22번씩 조회했다(≈950ms).
    //   입금완료 건은 많아야 수백 건이므로 '한 번만' 통째로 읽어 번호 집합을 만들고
    //   그 뒤로는 메모리에서 대조한다. 왕복 22회 → 1회.
    //   집합은 세션 동안 재사용하므로 탭을 오가도 다시 조회하지 않는다.
    try {
        // 브라우저 세션에도 저장해 새로고침·탭이동 시 재조회를 없앤다(입금완료 건은 자주 안 바뀜).
        const CACHE_KEY = 'sr_paid_phone_cache_v1';
        const CACHE_TTL = 30 * 60 * 1000; // 30분
        if (!_paidPhoneCounts) {
            try {
                const raw = sessionStorage.getItem(CACHE_KEY);
                if (raw) {
                    const c = JSON.parse(raw);
                    if (c && Date.now() - c.at < CACHE_TTL) {
                        _paidPhoneCounts = new Map(c.counts);
                        _paidDocIdsByPhone = new Map(c.ids.map(([k, arr]) => [k, new Set(arr)]));
                        console.log(`[성능] 재방문 기준표 캐시 사용 (${Math.round((Date.now() - c.at) / 1000)}초 전 데이터)`);
                    }
                }
            } catch (_) { }
        }
        if (!_paidPhoneCounts) {
            const snap = await getDocs(query(collection(db, "quotes"), where("status", "==", "입금완료")));
            _paidPhoneCounts = new Map();
            _paidDocIdsByPhone = new Map();
            snap.forEach(d => {
                const v = d.data();
                const key = String(v.customerPhone || '').replace(/\D/g, '');
                if (key.length < 9) return;
                _paidPhoneCounts.set(key, (_paidPhoneCounts.get(key) || 0) + 1);
                if (!_paidDocIdsByPhone.has(key)) _paidDocIdsByPhone.set(key, new Set());
                _paidDocIdsByPhone.get(key).add(d.id);
            });
            console.log(`[성능] 재방문 기준표 1회 로드 ${Math.round(performance.now() - _rt0)}ms / 입금완료 ${snap.size}건`);
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    at: Date.now(),
                    counts: Array.from(_paidPhoneCounts.entries()),
                    ids: Array.from(_paidDocIdsByPhone.entries()).map(([k, set]) => [k, Array.from(set)])
                }));
            } catch (_) { }
        }

        // 진행 중인 건은 상태가 수시로 바뀌므로 캐시하지 않고 매번 조회한다(수십~수백 건이라 가볍다).
        // 종결 상태(입금완료·취소·반송접수·삭제)를 뺀 나머지가 '살아있는 신청'이다.
        const activeByPhone = new Map();   // 번호 → 문서ID 집합
        try {
            const aSnap = await getDocs(query(collection(db, "quotes"), where("status", "not-in", TERMINAL_FOR_LIST)));
            aSnap.forEach(d => {
                const v = d.data();
                if (v.isDeleted) return;
                if (v.isForeigner === true || v.method === 'foreigner') return;
                const key = String(v.customerPhone || '').replace(/\D/g, '');
                if (key.length < 9) return;
                if (!activeByPhone.has(key)) activeByPhone.set(key, new Set());
                activeByPhone.get(key).add(d.id);
            });
        } catch (e) {
            console.warn('진행중 중복 조회 실패:', e && e.message);
        }

        byPhone.forEach((els, p) => {
            // 재방문 — 과거 입금완료 건수 (화면에 뜬 그 건 자신은 제외)
            let paid = _paidPhoneCounts.get(p) || 0;
            const paidIds = _paidDocIdsByPhone.get(p);
            if (paidIds) els.forEach(el => { if (paidIds.has(el.getAttribute('data-self'))) paid--; });

            // 진행중 — 같은 번호로 살아있는 다른 신청 (자기 자신은 제외)
            const actIds = activeByPhone.get(p);
            let active = 0;
            if (actIds) {
                const selfIds = new Set(els.map(el => el.getAttribute('data-self')));
                actIds.forEach(docId => { if (!selfIds.has(docId)) active++; });
            }

            render(els, Math.max(0, paid), active);
        });
        console.log(`[성능] 재방문·중복 표시 ${Math.round(performance.now() - _rt0)}ms / 번호 ${byPhone.size}개`);
    } catch (e) {
        // 조회 실패는 목록 표시에 영향을 주지 않도록 조용히 넘어감 (뱃지만 안 붙음)
        console.warn('재방문 고객 표시 실패:', e && e.message);
    }
}

function updateStats(pCount, pAmount, mCount, mAmount) {
    const pCountEl = document.getElementById('stat-pending-count');
    const pAmountEl = document.getElementById('stat-pending-amount');
    const mCountEl = document.getElementById('stat-monthly-count');
    const mAmountEl = document.getElementById('stat-monthly-amount');

    if (pCountEl) pCountEl.innerText = `${pCount}건`;
    if (pAmountEl) pAmountEl.innerText = `${new Intl.NumberFormat('ko-KR').format(pAmount)}원`;
    if (mCountEl) {
        mCountEl.innerText = `${mCount}건`;
        const h4El = mCountEl.parentElement.querySelector('h4');
        if (h4El) {
            const now = new Date();
            h4El.innerText = `${now.getMonth() + 1}월 매입완료 건수`;
        }
    }
    if (mAmountEl) {
        mAmountEl.innerText = `${new Intl.NumberFormat('ko-KR').format(mAmount)}원`;
    }
}

// 이번달 입금완료 통계 (별도 조회 — 초기 로딩에서 전체 완료건을 불러오지 않기 위함)
// ===== A/B 보기 전용 카드 3종 =====
const _startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const _startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const _isRealQuote = (x) => !x.isDeleted && !(x.isForeigner === true || x.method === 'foreigner' || x.series === 'Foreigner');
const _toDate = (v) => { if (!v) return null; if (v.toDate) return v.toDate(); if (v.seconds) return new Date(v.seconds * 1000); const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
// 입금완료 날짜 판정 — 기존 loadMonthlyPaidStats와 동일 기준(숫자 어긋남 방지)
const _resolvePaidDate = (data) => {
    if (data.paidAt) return _toDate(data.paidAt);
    if (data.customerAgreedAt) return _toDate(data.customerAgreedAt);
    if (data.inspectionData && data.inspectionData.inspectedAt) return new Date(data.inspectionData.inspectedAt);
    if (data.firebaseTimestamp) return _toDate(data.firebaseTimestamp);
    if (data.timestamp) {
        const m = String(data.timestamp).match(/(\d+)\.\s*(\d+)\.\s*(\d+)/);
        if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
        return _toDate(data.timestamp);
    }
    return null;
};

async function loadAbStats(view, ctx = {}) {
    const pendingCount = ctx.pendingCount || 0;
    const escapeeCount = ctx.escapee || 0;
    const legacy = document.getElementById('stats-legacy');
    const ab = document.getElementById('stats-ab');
    if (view === 'all') { // 전체 보기는 기존 2카드 그대로
        if (legacy) legacy.style.display = 'grid';
        if (ab) ab.style.display = 'none';
        return;
    }
    if (legacy) legacy.style.display = 'none';
    if (ab) ab.style.display = 'grid';

    const set = (n, title, main, sub) => {
        const t = document.getElementById(`ab-card${n}-title`);
        const m = document.getElementById(`ab-card${n}-main`);
        const s = document.getElementById(`ab-card${n}-sub`);
        if (t) t.textContent = title;
        if (m) m.textContent = main;
        if (s) s.textContent = sub;
    };
    const won = (v) => `${new Intl.NumberFormat('ko-KR').format(v || 0)}원`;
    const today = _startOfToday();
    const monthStart = _startOfMonth();

    if (view === 'a') {
        // 이미 계산된 값 즉시 표시
        set(2, '진행중 매입신청', `${pendingCount}건`, `방문수거 ${ctx.courier || 0}건 · 개인발송 ${ctx.cvs || 0}건`);
        const pf = ctx.pickupFailed || 0;
        // 미집하는 방치되면 손실로 이어지므로 이탈 카드에 함께 띄워 눈에 띄게 한다.
        set(3, '이탈건', `${escapeeCount}건`,
            pf ? `배송방법 미입력 · ⚠ 미집하 ${pf}건` : '배송방법 미입력');
        set(1, '금일 매입신청', '집계 중…', '-');
        try {
            // 기준 시각 정리
            //  - firebaseTimestamp : 본인인증 직후(배송방법 선택 전) = 유입 시각
            //  - submittedAt       : 배송방법 확정 = 신청이 실제로 완료된 시각
            // 목록도 submittedAt 기준으로 보여주므로 통계도 같은 기준을 쓴다.
            // 어제 인증하고 오늘 마무리한 건도 '오늘 신청'으로 잡혀 목록과 숫자가 일치한다.
            //
            // 이탈건은 submittedAt이 없으므로 유입 시각으로 셀 수밖에 없어 별도 조회한다.
            const snap = await getDocs(query(collection(db, "quotes"), where("firebaseTimestamp", ">=", today)));
            let courier = 0, cvs = 0, canceled = 0, deleted = 0, escapee = 0;
            const seen = new Set();

            const classify = (id, x) => {
                if (seen.has(id)) return;
                seen.add(id);
                if (x.isDeleted) { deleted++; return; }
                if (x.status === '취소') { canceled++; return; }
                if (x.deliveryMethod === 'courier') courier++;
                else if (x.deliveryMethod === 'cvs') cvs++;
                else escapee++;   // 배송방법 미선택 = 이탈
            };

            snap.forEach(d => {
                const x = d.data();
                if (x.isForeigner === true || x.method === 'foreigner' || x.series === 'Foreigner') return;
                // 오늘 유입됐지만 아직 배송방법을 안 고른 건(=이탈) 위주로 여기서 집계.
                // 오늘 유입 + 오늘 완료 건은 아래 submittedAt 조회에서도 잡히나 seen으로 중복 방지.
                classify(d.id, x);
            });

            // 이전에 유입됐지만 오늘 마무리한 건 추가 집계
            try {
                const snap2 = await getDocs(query(collection(db, "quotes"), where("submittedAt", ">=", today)));
                snap2.forEach(d => {
                    const x = d.data();
                    if (x.isForeigner === true || x.method === 'foreigner' || x.series === 'Foreigner') return;
                    classify(d.id, x);
                });
            } catch (e2) { console.warn('submittedAt 집계 건너뜀(색인 준비 전일 수 있음):', e2 && e2.message); }

            // 카드는 실제 처리해야 할 건(방문수거·개인발송)만 간결하게.
            // 이탈·취소·삭제는 일일통계 분석표에서 날짜별로 확인한다.
            const done = courier + cvs;
            set(1, '금일 매입신청', `${done}건`, `방문수거 ${courier}건 · 개인발송 ${cvs}건`);
        } catch (e) { console.error('금일 매입신청 집계 실패:', e); set(1, '금일 매입신청', '-', '집계 실패'); }
        return;
    }

    // view === 'b'
    set(1, '금일 도착건', '집계 중…', '-');
    set(2, '검수건 (이번달)', '집계 중…', '-');
    set(3, '매입완료 (이번달)', '집계 중…', '-');

    try { // 금일 도착 — arrivedAt 기준(수동/자동 동일)
        const snap = await getDocs(query(collection(db, "quotes"), where("arrivedAt", ">=", today)));
        let c = 0;
        snap.forEach(d => { if (_isRealQuote(d.data())) c++; });
        set(1, '금일 도착건', `${c}건`, '오늘 택배도착으로 넘긴 건');
    } catch (e) { console.error('금일 도착 집계 실패:', e); set(1, '금일 도착건', '-', '집계 실패'); }

    // 검수 진행중 — 날짜 무관, 현재 입금대기 + 검수중 + 검수완료 (B 조회 결과에서 바로 계산)
    const inspectTotal = (ctx.inspecting || 0) + (ctx.urgent || 0);
    set(2, '검수 진행중', `${inspectTotal}건`, '금일 검수 집계 중…');
    try { // 금일 검수로 넘긴 건만
        const snap = await getDocs(query(collection(db, "quotes"), where("inspectingAt", ">=", today)));
        let t = 0;
        snap.forEach(d => { if (_isRealQuote(d.data())) t++; });
        set(2, '검수 진행중', `${inspectTotal}건`, `금일 검수 ${t}건`);
    } catch (e) { console.error('금일 검수 집계 실패:', e); set(2, '검수 진행중', `${inspectTotal}건`, '금일 집계 실패'); }

    try { // 매입완료 — 기존 카드와 동일 기준
        // ★ 예전엔 limit(200)으로 최근 200건만 읽어 그 안에서 이번달을 셌다.
        //   누적 입금완료가 200건을 넘자 이번달 건이 잘려 카운트가 200에서 멈췄다.
        //   그렇다고 상한만 키우면 매달 읽는 양이 계속 늘어 첫 화면이 느려진다.
        //   → 접수일(firebaseTimestamp) 기준으로 '최근 3개월'만 읽고,
        //      그 안에서 실제 입금일(_resolvePaidDate)로 이번달을 가린다.
        //      접수 후 입금까지 길어야 며칠이므로 3개월이면 이번달 건은 모두 포함된다.
        const rangeStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        const snap = await getDocs(query(
            collection(db, "quotes"),
            where("status", "==", "입금완료"),
            where("firebaseTimestamp", ">=", rangeStart),
            orderBy("firebaseTimestamp", "desc")
        ));
        let m = 0, mAmt = 0, t = 0;
        const now = new Date();
        snap.forEach(d => {
            const x = d.data();
            if (!_isRealQuote(x)) return;
            const pd = _resolvePaidDate(x);
            if (!pd) return;
            if (pd.getFullYear() === now.getFullYear() && pd.getMonth() === now.getMonth()) { m++; mAmt += (x.price || 0); }
            if (pd >= today) t++;
        });
        set(3, '매입완료 (이번달)', `${m}건`, `금일 ${t}건 · ${won(mAmt)}`);
    } catch (e) { console.error('매입완료 집계 실패:', e); set(3, '매입완료 (이번달)', '-', '집계 실패'); }
}

async function loadMonthlyPaidStats() {
    try {
        // 이번달 집계만 필요하므로 최근 3개월치만 읽는다.
        // (전체를 읽으면 건수가 쌓일수록 계속 느려지고, 상한을 두면 이번달 건이 잘린다)
        const _now = new Date();
        const rangeStart = new Date(_now.getFullYear(), _now.getMonth() - 3, 1);
        const q = query(
            collection(db, "quotes"),
            where("status", "==", "입금완료"),
            where("firebaseTimestamp", ">=", rangeStart),
            orderBy("firebaseTimestamp", "desc")
        );
        const snap = await getDocs(q);
        let mCount = 0, mAmount = 0;
        const now = new Date();
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.isDeleted) return;
            if (data.isForeigner === true || data.method === 'foreigner' || data.series === 'Foreigner') return;
            let pDate = null;
            if (data.paidAt) {
                pDate = data.paidAt.toDate ? data.paidAt.toDate() : new Date(data.paidAt.seconds ? data.paidAt.seconds * 1000 : data.paidAt);
            } else if (data.customerAgreedAt) {
                pDate = data.customerAgreedAt.toDate ? data.customerAgreedAt.toDate() : new Date(data.customerAgreedAt.seconds ? data.customerAgreedAt.seconds * 1000 : data.customerAgreedAt);
            } else if (data.inspectionData && data.inspectionData.inspectedAt) {
                pDate = new Date(data.inspectionData.inspectedAt);
            } else if (data.firebaseTimestamp) {
                pDate = data.firebaseTimestamp.toDate ? data.firebaseTimestamp.toDate() : new Date(data.firebaseTimestamp.seconds ? data.firebaseTimestamp.seconds * 1000 : data.firebaseTimestamp);
            } else if (data.timestamp) {
                const koMatch = String(data.timestamp).match(/(\d+)\.\s*(\d+)\.\s*(\d+)/);
                if (koMatch) pDate = new Date(parseInt(koMatch[1]), parseInt(koMatch[2]) - 1, parseInt(koMatch[3]));
                else { const d = new Date(data.timestamp); if (!isNaN(d.getTime())) pDate = d; }
            }
            if (pDate && pDate.getFullYear() === now.getFullYear() && pDate.getMonth() === now.getMonth()) {
                mCount++;
                mAmount += (data.price || 0);
            }
        });
        // pending 통계는 loadQuotes가 이미 표시했으므로 여기선 월통계 요소만 갱신
        const mCountEl = document.getElementById('stat-monthly-count');
        const mAmountEl = document.getElementById('stat-monthly-amount');
        if (mCountEl) {
            mCountEl.innerText = `${mCount}건`;
            const h4El = mCountEl.parentElement.querySelector('h4');
            if (h4El) h4El.innerText = `${now.getMonth() + 1}월 매입완료 건수`;
        }
        if (mAmountEl) mAmountEl.innerText = `${new Intl.NumberFormat('ko-KR').format(mAmount)}원`;
    } catch (e) {
        console.error("loadMonthlyPaidStats error:", e);
    }
}

// 완료/취소/반송 내역: 해당 탭을 열 때만 서버에서 조회 (초기 로딩 경량화)
const TERMINAL_STATUS_MAP = { completed: '입금완료', canceled: '취소', returned: '반송접수' };
async function loadTerminalTab(type) {
    const statusVal = TERMINAL_STATUS_MAP[type];
    if (!statusVal) return;
    const tbody = document.getElementById(`${type}-table-body`);
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center">로딩 중...</td></tr>';
    try {
        // 매입완료/취소/반송 내역 — 계속 쌓이므로 상한을 넉넉히 (400이면 곧 잘려서 옛 건이 안 보임)
        const q = query(collection(db, "quotes"), where("status", "==", statusVal), orderBy("firebaseTimestamp", "desc"), limit(2000));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.isDeleted) return;
            if (data.isForeigner === true || data.method === 'foreigner' || data.series === 'Foreigner') return;
            items.push({ id: docSnap.id, ...data });
        });
        window[`${type}QuotesData`] = items;
        applyTabFilter(type, items);
    } catch (e) {
        console.error("loadTerminalTab error:", type, e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">로딩 실패: ${e.message}</td></tr>`;
    }
}
window.loadTerminalTab = loadTerminalTab;



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
            if (typeof loadForeignerQuotes === 'function') loadForeignerQuotes();
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

            const ref = doc(db, "quotes", id);
            const patch = { isDeleted: false };
            try {
                const snap = await getDoc(ref);
                const data = snap.exists() ? snap.data() : {};
                // 삭제 시 status를 '삭제'로 바꾼 건만 원래 상태로 복원
                if (data.status === '삭제') {
                    patch.status = data.prevStatus || '신청접수';
                }
            } catch (e) { /* 조회 실패해도 복원은 진행 */ }
            await updateDoc(ref, patch);

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

// 휴지통: 선택 항목 일괄 완전삭제 (하드 삭제) — 하나씩 누르지 않아도 됨
window.deleteSelectedTrash = async () => {
    const tbody = document.getElementById('trash-table-body');
    if (!tbody) return;
    const checked = tbody.querySelectorAll('.quote-checkbox:checked');
    if (checked.length === 0) { alert("완전삭제할 항목을 선택해주세요."); return; }
    if (!confirm(`선택하신 ${checked.length}건을 완전삭제합니다.\n이 작업은 영구적이며 절대 되돌릴 수 없습니다. 진행할까요?`)) return;
    let ok = 0, fail = 0;
    for (const cb of checked) {
        try { await deleteDoc(doc(db, "quotes", cb.value)); ok++; }
        catch (e) { console.error("Trash bulk delete error:", cb.value, e); fail++; }
    }
    alert(`${ok}건 완전삭제 완료${fail ? ` · ${fail}건 실패` : ''}.`);
    loadTrash();
};

// 목록 검색: 해당 tbody의 행을 텍스트(고객명/연락처/기종 등)로 필터링해 숨김/표시
window.searchTabRows = (tbodyId, keyword) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const q = (keyword || '').trim().toLowerCase();
    tbody.querySelectorAll('tr').forEach((tr) => {
        // 구분선/안내 행(colspan) 등은 검색어 없을 때만 표시
        const isDivider = tr.querySelector('td[colspan]');
        if (!q) { tr.style.display = ''; return; }
        if (isDivider) { tr.style.display = 'none'; return; }
        const text = (tr.textContent || '').toLowerCase();
        tr.style.display = text.includes(q) ? '' : 'none';
    });
};



// --- Trash Management Logic ---

async function loadTrash() {

    const trashTableBody = document.getElementById('trash-table-body');

    if (!trashTableBody) return;



    try {

        const q = query(collection(db, "quotes"), orderBy("firebaseTimestamp", "desc"));

        const querySnapshot = await getDocs(q);



        trashTableBody.innerHTML = '';

        let count = 0;



        querySnapshot.forEach((docSnapshot) => {

            const data = docSnapshot.data();

            const id = docSnapshot.id;



            // Show only deleted items

            if (!data.isDeleted) return;

            count++;



            // 표시 기준 시각 — 배송방법이 확정된 submittedAt을 우선 사용.
            // firebaseTimestamp는 본인인증 직후(배송방법 선택 전) 시각이라,
            // 며칠 뒤에 마무리한 고객이 목록 아래쪽에 묻혀 놓치는 문제가 있었다.
            const formattedDate = formatDate(data.submittedAt || data.firebaseTimestamp || data.timestamp);

            const formattedPrice = new Intl.NumberFormat('ko-KR').format(data.price || 0);

            const status = data.status || '신청접수';



            const tr = document.createElement('tr');

            tr.innerHTML = `

                <td><input type="checkbox" class="quote-checkbox" value="${id}" /></td>

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

            trashTableBody.innerHTML = '<tr><td colspan="8" class="text-center">휴지통이 비어있습니다.</td></tr>';

        }



    } catch (e) {

        console.error("Error loading trash:", e);

        trashTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">휴지통 로딩 실패: ${e.message}</td></tr>`;

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



// --- Blacklist Management Logic ---

// Phone number normalization helper
function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return "";
    let cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('82') && cleaned.length > 10) {
        cleaned = '0' + cleaned.slice(2);
    }
    return cleaned;
}

// Load Blacklist from Firestore
async function loadBlacklist() {
    const tableBody = document.getElementById('blacklist-table-body');
    if (!tableBody) return;

    try {
        const q = query(collection(db, "blacklist"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        tableBody.innerHTML = '';

        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">등록된 블랙리스트 연락처가 없습니다.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const registeredDate = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${registeredDate}</td>
                <td><strong>${data.phone}</strong></td>
                <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:0.9rem;">${data.normalizedPhone}</code></td>
                <td>${data.reason || '-'}</td>
                <td>
                    <button class="action-btn" onclick="removeBlacklist('${id}')" style="color:red; font-weight:bold;">해제</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (e) {
        console.error("Error loading blacklist:", e);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">블랙리스트 로딩 실패: ${e.message}</td></tr>`;
    }
}

// Add Blacklist to Firestore
window.addBlacklist = async () => {
    const phoneInput = document.getElementById('blacklist-phone');
    const reasonInput = document.getElementById('blacklist-reason');
    if (!phoneInput || !reasonInput) return;

    const phone = phoneInput.value.trim();
    const reason = reasonInput.value.trim();

    if (!phone) {
        alert("차단할 연락처를 입력해 주세요.");
        return;
    }

    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
        alert("올바른 연락처를 입력해 주세요.");
        return;
    }

    try {
        // Check if already exists
        const q = query(collection(db, "blacklist"), where("normalizedPhone", "==", normalized));
        const dupCheck = await getDocs(q);
        if (!dupCheck.empty) {
            alert("이미 블랙리스트에 등록되어 있는 연락처입니다.");
            return;
        }

        await addDoc(collection(db, "blacklist"), {
            phone: phone,
            normalizedPhone: normalized,
            reason: reason,
            createdAt: serverTimestamp()
        });

        alert("블랙리스트에 등록되었습니다.");
        phoneInput.value = '';
        reasonInput.value = '';
        loadBlacklist();

    } catch (e) {
        console.error("Add Blacklist Error:", e);
        alert("등록 실패: " + e.message);
    }
};

// Remove Blacklist from Firestore
window.removeBlacklist = async (id) => {
    if (confirm("이 연락처를 블랙리스트에서 해제하시겠습니까?")) {
        try {
            await deleteDoc(doc(db, "blacklist", id));
            alert("해제되었습니다.");
            loadBlacklist();
        } catch (e) {
            console.error("Remove Blacklist Error:", e);
            alert("해제 실패: " + e.message);
        }
    }
};



// ===== 굿스플로(홈픽) 방문수거 예약 =====
const GOODSFLOW_API = "https://asia-northeast3-rejeuphone.cloudfunctions.net/goodsflowApi";

// 관리자 인증 토큰 — 실제 배차(=비용)라 서버에서 관리자만 허용하도록 검증함
async function gfAuthHeader() {
    const user = auth.currentUser;
    if (!user) throw new Error("로그인이 필요합니다.");
    const token = await user.getIdToken();
    return { "Content-Type": "application/json", "Authorization": "Bearer " + token };
}

window.bookGoodsflowPickup = async (id) => {
    if (!confirm("이 건의 방문수거를 굿스플로에 예약합니다.\n실제 기사 배차가 발생합니다. 진행할까요?")) return;
    const btn = event && event.target;
    if (btn) { btn.disabled = true; btn.textContent = '예약 중...'; }
    try {
        const res = await fetch(GOODSFLOW_API + "/createOrder", {
            method: "POST",
            headers: await gfAuthHeader(),
            body: JSON.stringify({ quoteId: id })
        });
        const out = await res.json().catch(() => ({ ok: false, error: "응답을 해석할 수 없습니다." }));
        if (!res.ok || !out.ok) throw new Error(out.error || `오류 ${res.status}`);
        // 지난 날짜/일요일/공휴일이면 서버가 다음 가능일로 밀어 접수한다.
        // 이때 조용히 넘어가면 고객이 원래 날짜에 기다리다 문의가 들어오므로 반드시 알린다.
        if (out.dateShifted) {
            alert("수거 예약이 완료되었습니다.\n\n⚠ 고객 희망일(" + (out.customerWanted || '미지정') + ")로는 접수할 수 없어\n"
                + out.pickupRequestDateTime + " 로 예약되었습니다.\n"
                + "(지난 날짜이거나 일요일·공휴일인 경우)\n\n고객에게 변경된 날짜를 안내해 주세요.");
        } else {
            alert("수거 예약이 완료되었습니다." + (out.pickupRequestDateTime ? "\n수거일시: " + out.pickupRequestDateTime : ""));
        }
        loadQuotes();
    } catch (e) {
        console.error("굿스플로 예약 실패:", e);
        alert("수거 예약 실패\n\n" + e.message);
        if (btn) { btn.disabled = false; btn.textContent = '🚚 수거 예약'; }
        loadQuotes();
    }
};

// 굿스플로 배송상태 즉시 확인 — 30분 주기 자동 폴러를 기다리지 않고 지금 조회
window.pollGoodsflowNow = async (btn) => {
    if (btn) { btn.disabled = true; btn.textContent = '확인 중...'; }
    try {
        const res = await fetch(GOODSFLOW_API + "/pollNow", {
            method: "POST", headers: await gfAuthHeader(), body: JSON.stringify({})
        });
        const out = await res.json().catch(() => ({ ok: false, error: "응답을 해석할 수 없습니다." }));
        if (!res.ok || !out.ok) throw new Error(out.error || `오류 ${res.status}`);
        const s = out.summary || {};
        let msg = `배송상태 확인 완료\n\n조회 ${s.checked || 0}건`;
        if (s.pickedUp) msg += `\n집하완료(운송장 안내 발송): ${s.pickedUp}건`;
        if (s.arrived) msg += `\n택배도착으로 전환: ${s.arrived}건`;
        if (s.failed) msg += `\n수거/배송 실패: ${s.failed}건`;
        if (s.errors) msg += `\n조회 실패: ${s.errors}건`;
        if (!s.arrived && !s.failed) msg += `\n\n상태가 바뀐 건은 없습니다.`;
        if (s.details && s.details.length) msg += `\n\n` + s.details.slice(0, 10).join('\n');
        alert(msg);
        loadQuotes();
    } catch (e) {
        console.error("굿스플로 상태확인 실패:", e);
        alert("배송상태 확인 실패\n\n" + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📦 배송상태 확인'; }
    }
};

// 굿스플로 ↔ 관리자 기록 대조. 우리는 취소했는데 굿스플로엔 살아있는 주문을 찾아 정리한다.
window.reconcileGoodsflow = async (btn) => {
    if (btn) { btn.disabled = true; btn.textContent = '대조 중...'; }
    try {
        const call = async (dryRun) => {
            const res = await fetch(GOODSFLOW_API + "/reconcile", {
                method: "POST", headers: await gfAuthHeader(), body: JSON.stringify({ dryRun })
            });
            const out = await res.json().catch(() => ({ ok: false, error: "응답을 해석할 수 없습니다." }));
            if (!res.ok || !out.ok) throw new Error(out.error || `오류 ${res.status}`);
            return out.report || {};
        };

        const r = await call(true); // 1단계: 조회만
        const lines = (r.items || []).map(i => `· ${i.name}: ${i.error ? '조회실패' : (i.gfStatus || '-') + ' → ' + i.action}`);
        let msg = `굿스플로 대조 결과\n\n조회 ${r.checked || 0}건`;
        if (r.errors) msg += ` · 조회실패 ${r.errors}건`;
        msg += `\n\n` + (lines.slice(0, 15).join('\n') || '(내역 없음)');

        if (!r.mismatched) {
            alert(msg + `\n\n어긋난 건이 없습니다. 굿스플로에 남아있는 예약이 없어요.`);
            return;
        }
        if (!confirm(msg + `\n\n──────────\n굿스플로에만 살아있는 예약이 ${r.mismatched}건 있습니다.\n지금 취소할까요?`)) return;

        const r2 = await call(false); // 2단계: 실제 취소
        alert(`정리 완료\n\n취소 ${r2.canceled || 0}건 · 조회실패 ${r2.errors || 0}건`);
        loadQuotes();
    } catch (e) {
        console.error("굿스플로 대조 실패:", e);
        alert("굿스플로 대조 실패\n\n" + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔍 굿스플로 대조'; }
    }
};

window.cancelGoodsflowPickup = async (id, force) => {
    if (!force && !confirm("굿스플로 수거 예약을 취소합니다. 진행할까요?")) return;
    try {
        const res = await fetch(GOODSFLOW_API + "/cancelOrder", {
            method: "POST",
            headers: await gfAuthHeader(),
            body: JSON.stringify({ quoteId: id, force: force === true })
        });
        const out = await res.json().catch(() => ({ ok: false, error: "응답을 해석할 수 없습니다." }));
        if (!res.ok || !out.ok) {
            // 굿스플로 취소가 실패한 경우, 우리 쪽 예약 기록만 정리할지 물어본다
            // (과거 오류로 실제 접수되지 않은 기록이 남아 있으면 이 경로로 정리)
            if (out && out.canForce && !force) {
                if (confirm(out.error + "\n\n굿스플로에서는 취소하지 못했습니다.\n관리자 화면의 예약 기록만 지울까요?\n(실제 배차가 잡혀 있다면 굿스플로에서 직접 취소해야 합니다)")) {
                    return window.cancelGoodsflowPickup(id, true);
                }
                return;
            }
            throw new Error(out.error || `오류 ${res.status}`);
        }
        alert(out.message || "예약이 취소되었습니다.");
        loadQuotes();
    } catch (e) {
        console.error("굿스플로 취소 실패:", e);
        alert("예약 취소 실패\n\n" + e.message);
    }
};

// 매입 신청 관리 보기 전환: a=접수·수거 / b=검수·정산 / all=전체(기존)
window.switchQuoteView = (view) => {
    window.currentQuoteView = view;
    window.switchTab('quotes'); // tab-quotes 표시 + loadQuotes() 실행(currentQuoteView 사용)

    // 활성 메뉴 표시 (switchTab은 onclick 문자열로 매칭하므로 여기서 직접 처리)
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    const menu = document.getElementById('menu-quotes-' + view);
    if (menu) menu.classList.add('active');

    const titleEl = document.getElementById('quotes-view-title');
    const descEl = document.getElementById('quotes-view-desc');
    if (view === 'a') {
        if (titleEl) titleEl.textContent = '접수·수거';
        if (descEl) descEl.textContent = '방문수거 · 개인발송 · 이탈 (물건이 아직 도착하지 않은 단계)';
    } else if (view === 'b') {
        if (titleEl) titleEl.textContent = '검수·정산';
        if (descEl) descEl.textContent = '택배도착 · 검수중 · 입금대기 · 반송대기 (물건이 우리 손에 있는 단계)';
    } else {
        if (titleEl) titleEl.textContent = '매입 신청 관리 (전체 보기)';
        if (descEl) descEl.textContent = '진행중 전체를 한 화면에서 봅니다. 통합 검색용 · 기존 화면과 동일합니다.';
    }
};

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
    if (tabName === 'completed') loadTerminalTab('completed');
    if (tabName === 'canceled') loadTerminalTab('canceled');
    if (tabName === 'returned') loadTerminalTab('returned');
    if (tabName === 'foreigner') loadForeignerQuotes();
    if (tabName === 'monthly-stats') loadMonthlyStats();
    if (tabName === 'daily-stats') loadDailyStats();
    if (tabName === 'inventory') window.loadInventory();
    if (tabName === 'statistics') window.loadStatistics();
    if (tabName === 'users') loadUsers();
    if (tabName === 'blacklist') loadBlacklist();
    if (tabName === 'chat') fetchChatSessions();
    if (tabName === 'trash') loadTrash();
    if (tabName === 'analytics') window.loadFunnelData();
    if (tabName === 'popup' && typeof window.loadPopupSettings === 'function') window.loadPopupSettings();
    if (tabName === 'settings' && typeof window.loadGeneralSettings === 'function') window.loadGeneralSettings();
};

window.toggleFunnelDateInput = () => {
    const type = document.getElementById('funnel-date-type').value;
    const dateInput = document.getElementById('funnel-date');
    if (type === 'all' || type === '7days' || type === '30days') {
        dateInput.style.display = 'none';
        window.loadFunnelData();
    } else {
        dateInput.style.display = 'block';
        window.loadFunnelData();
    }
};

window.loadFunnelData = async () => {
    const container = document.getElementById('funnel-container');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center" style="padding: 40px; color: #888;">데이터를 불러오는 중입니다...</div>';
    
    try {
        const typeSelect = document.getElementById('funnel-date-type');
        const dateInput = document.getElementById('funnel-date');
        const type = typeSelect ? typeSelect.value : 'daily';
        
        if (typeSelect && dateInput && !dateInput.value) {
            const nowMs = Date.now();
            const kstOffset = 9 * 60 * 60 * 1000;
            const kstDate = new Date(nowMs + kstOffset);
            dateInput.value = kstDate.toISOString().split('T')[0];
        }
        
        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        let data = {};
        if (type === '7days' || type === '30days') {
            const daysCount = type === '7days' ? 7 : 30;
            const dates = [];
            const nowMs = Date.now();
            const kstOffset = 9 * 60 * 60 * 1000;
            for (let i = daysCount - 1; i >= 0; i--) {
                const d = new Date(nowMs + kstOffset - i * 24 * 60 * 60 * 1000);
                dates.push(d.toISOString().split('T')[0]);
            }
            
            const promises = dates.map(dateStr => getDoc(doc(db, 'analytics', 'funnel_' + dateStr)));
            const snaps = await Promise.all(promises);
            
            snaps.forEach(snap => {
                if (snap.exists()) {
                    const d = snap.data();
                    for (const key in d) {
                        if (typeof d[key] === 'number') {
                            data[key] = (data[key] || 0) + d[key];
                        }
                    }
                }
            });
        } else {
            let docId = 'funnel';
            if (type === 'daily' && dateInput && dateInput.value) {
                docId = 'funnel_' + dateInput.value;
            }
            const docRef = doc(db, 'analytics', docId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                data = docSnap.data();
            }
        }

        const docRefTotal = doc(db, 'analytics', 'funnel');
        const docSnapTotal = await getDoc(docRefTotal);
        
        let totalData = {};
        if (docSnapTotal.exists()) {
            totalData = docSnapTotal.data();
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
        
        const dropOffTips = {
            'quote_start': {
                title: '메인 페이지 탈출 경고',
                desc: '💡 홈 화면에서 시세조회(견적) 페이지로 넘어가는 전환이 매우 낮습니다. 메인 배너의 견적받기 버튼(CTA)의 시인성을 개선하거나, 직관적인 문구로 변경하는 것을 권장합니다.'
            },
            'quote_model': {
                title: '모델 검색/선택 단계 탈출 경고',
                desc: '💡 모델 선택 전 단계에서 많은 이탈이 보입니다. 검색 자동완성 기능을 점검하거나, 인기 기종(아이폰, 갤럭시 최신형) 바로가기 버튼 배치를 보강해 보세요.'
            },
            'quote_details': {
                title: '상태 평가/옵션 선택 단계 탈출 경고',
                desc: '💡 기기 등급(기스, 파손 여부 등) 평가 및 세부 질문이 너무 까다롭거나 혼란을 주지 않는지 확인하세요. 자가진단 항목을 보다 쉽게 고도화하고 툴팁 안내를 보강하면 이탈을 줄일 수 있습니다.'
            },
            'quote_complete': {
                title: '신청서 작성/인증 단계 탈출 경고',
                desc: '💡 마지막 제출 단계 전 이탈이 큽니다. 휴대폰 본인 인증 절차가 번거롭거나, 주소/계좌 정보 입력에 부담을 느끼는 구간입니다. "1분 만에 완료 가능" 및 보안 신뢰 배지를 눈에 띄게 배치해 보세요.'
            }
        };

        const maxVal = Math.max(...steps.map(s => data[s.key] || 0), 1);
        
        let mainHtml = '<div style="display: flex; flex-direction: column; align-items: center; width: 100%;">';
        let extraHtml = '<div style="display: flex; gap: 20px; justify-content: center; margin-top: 40px; flex-wrap: wrap; width: 100%; border-top: 2px dashed #e2e8f0; padding-top: 30px;">';
        let prevVal = null;
        
        steps.forEach((step, idx) => {
            const val = data[step.key] || 0;
            const pctOfMax = Math.round((val / maxVal) * 100) || 0;
            
            const naverVal = data[`${step.key}_naver`] || 0;
            const naverSearchVal = data[`${step.key}_naver_search`] || 0;
            const naverDisplayVal = data[`${step.key}_naver_display`] || 0;
            const daangnVal = data[`${step.key}_daangn`] || 0;
            const googleVal = data[`${step.key}_google`] || 0;
            const instagramVal = data[`${step.key}_instagram`] || 0;
            const tiktokVal = data[`${step.key}_tiktok`] || 0;
            const directVal = data[`${step.key}_direct`] || 0;
            const totalTracked = naverVal + naverSearchVal + naverDisplayVal + daangnVal + googleVal + instagramVal + tiktokVal + directVal;
            const legacyVal = val - totalTracked > 0 ? val - totalTracked : 0;
            const otherVal = directVal + legacyVal;
 
            if (step.isExtra) {
                extraHtml += `
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); min-width: 200px; text-align: center;">
                        <h4 style="margin: 0 0 10px 0; font-size: 0.9rem; color: #64748b;">${step.label}</h4>
                        <div style="font-size: 1.5rem; font-weight: 800; color: #475569;">${new Intl.NumberFormat().format(val)}<span style="font-size: 0.9rem; margin-left: 2px;">명</span></div>
                    </div>
                `;
            } else {
                let dropHtml = '';
                let warningHtml = '';
                if (prevVal !== null && prevVal > 0) {
                    let dropPct = Math.round(((prevVal - val) / prevVal) * 100);
                    if (dropPct < 0) dropPct = 0; 
                    let convPct = Math.round((val / prevVal) * 100);
                    if (convPct > 100) convPct = 100;
                    
                    dropHtml = `
                        <div style="width: 100%; display: flex; justify-content: center; align-items: center; margin: 10px 0;">
                            <div style="display: flex; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); z-index: 2; position: relative;">
                                <div style="display: flex; flex-direction: column; align-items: center; margin-right: 15px;">
                                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">전환율</span>
                                    <span style="font-size: 1.1rem; color: #2563eb; font-weight: 800;">${convPct}%</span>
                                </div>
                                <span class="material-symbols-outlined" style="font-size: 24px; color: #94a3b8; margin: 0 5px;">arrow_downward</span>
                                <div style="display: flex; flex-direction: column; align-items: center; margin-left: 15px;">
                                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">이탈률</span>
                                    <span style="font-size: 1.1rem; color: #ef4444; font-weight: 800;">${dropPct}%</span>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    if (dropPct >= 40) {
                        const tip = dropOffTips[step.key] || { title: '경고', desc: '💡 이 단계의 이탈률이 매우 높습니다. 사용자 행동 패턴을 다시 모니터링해보세요.' };
                        warningHtml = `
                            <div style="width: 100%; max-width: 650px; margin: 15px auto; background: #fff5f5; border: 1px dashed #feb2b2; border-left: 4px solid #e53e3e; border-radius: 12px; padding: 15px 20px; box-shadow: 0 4px 6px rgba(229, 62, 62, 0.05); display: flex; align-items: flex-start; gap: 12px; text-align: left;">
                                <span class="material-symbols-outlined" style="color: #e53e3e; font-size: 24px; flex-shrink: 0; margin-top: 2px;">warning</span>
                                <div>
                                    <div style="font-weight: 800; color: #9b2c2c; font-size: 0.95rem; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                                        ${tip.title} <span style="background: #e53e3e; color: white; font-size: 0.75rem; padding: 2px 8px; border-radius: 20px; font-weight: bold;">주의 단계 (⚠️ 이탈률 ${dropPct}%)</span>
                                    </div>
                                    <div style="font-size: 0.85rem; color: #c53030; line-height: 1.5; font-weight: 500;">
                                        ${tip.desc}
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                }
                
                mainHtml += dropHtml;
                if (warningHtml) mainHtml += warningHtml;
                mainHtml += `
                    <div style="width: 100%; max-width: 650px; background: white; border-top: 4px solid ${step.barColor}; border-radius: 12px; padding: 20px 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: flex; flex-direction: column; margin: 0 auto; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0; font-size: 1.2rem; color: #1e293b; font-weight: 800;">${step.label}</h3>
                            <span style="font-size: 1.8rem; font-weight: 900; color: ${step.barColor};">${new Intl.NumberFormat().format(val)}<span style="font-size: 1rem; color: #64748b; font-weight: 700; margin-left: 4px;">명</span></span>
                        </div>
                        
                        <div style="width: 100%; height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; margin-bottom: 15px;">
                            <div style="width: ${Math.max(pctOfMax, val===0?0:1)}%; height: 100%; background: ${step.barColor}; transition: width 1s ease;"></div>
                        </div>
                        
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <div style="background: #e6f4ea; border: 1px solid #ceead6; color: #137333; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <span style="width:8px; height:8px; background:#137333; border-radius:50%;"></span> 네이버 ${new Intl.NumberFormat().format(naverVal)}
                            </div>
                            <div style="background: #e6f4ea; border: 1px solid #ceead6; color: #137333; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <span style="width:8px; height:8px; background:#137333; border-radius:50%;"></span> 네이버검색 ${new Intl.NumberFormat().format(naverSearchVal)}
                            </div>
                            <div style="background: #dbeafe; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <span style="width:8px; height:8px; background:#1d4ed8; border-radius:50%;"></span> 네이버디스플레이 ${new Intl.NumberFormat().format(naverDisplayVal)}
                            </div>
                            <div style="background: #fff3e0; border: 1px solid #ffe0b2; color: #e65100; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <span style="width:8px; height:8px; background:#e65100; border-radius:50%;"></span> 당근 ${new Intl.NumberFormat().format(daangnVal)}
                            </div>
                            <div style="background: #e8f0fe; border: 1px solid #d2e3fc; color: #1967d2; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <span style="width:8px; height:8px; background:#1967d2; border-radius:50%;"></span> 구글 ${new Intl.NumberFormat().format(googleVal)}
                            </div>
                            <div style="background: #fdf2f8; border: 1px solid #fbcfe8; color: #db2777; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <span style="width:8px; height:8px; background:#db2777; border-radius:50%;"></span> 인스타 ${new Intl.NumberFormat().format(instagramVal)}
                            </div>
                            <div style="background: #e0f7fa; border: 1px solid #b2ebf2; color: #00838f; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <span style="width:8px; height:8px; background:#00838f; border-radius:50%;"></span> 틱톡 ${new Intl.NumberFormat().format(tiktokVal)}
                            </div>
                            <div style="background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <span style="width:8px; height:8px; background:#475569; border-radius:50%;"></span> 기타/이전 ${new Intl.NumberFormat().format(otherVal)}
                            </div>
                        </div>
                    </div>
                `;
                prevVal = val;
            }
        });
        
        mainHtml += '</div>';
        extraHtml += '</div>';
        
        container.innerHTML = mainHtml + extraHtml;

        // --- Render Event Stats Table ---
        const eventStatsTbody = document.getElementById('event-stats-tbody');
        if (eventStatsTbody) {
            const events = [
                { key: 'event_danggeun', label: '당근마켓 특별 이벤트 페이지' },
                { key: 'event_iphone', label: '아이폰 보너스 이벤트 페이지' },
                { key: 'event_samsung', label: '삼성 감사 이벤트 페이지' }
            ];
            let html = '';
            events.forEach(ev => {
                const dailyVal = data[ev.key] || 0;
                const totalVal = totalData[ev.key] || 0;
                html += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${ev.label}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #1e293b;">
                            <span style="color: #2563eb;">${new Intl.NumberFormat().format(dailyVal)}</span> / ${new Intl.NumberFormat().format(totalVal)}
                        </td>
                    </tr>
                `;
            });
            eventStatsTbody.innerHTML = html;
        }

        // --- Render Exit Stats Table ---
        const exitStatsTbody = document.getElementById('exit-stats-tbody');
        if (exitStatsTbody) {
            const exits = [
                { key: 'exit_kakao', label: '카카오 채널 1:1 상담 클릭' },
                { key: 'exit_naver_map', label: '네이버 지도 매장 확인 클릭' },
                { key: 'exit_channeltalk', label: '채널톡 고객센터 버튼 클릭' },
                { key: 'move_reviews', label: '메인메뉴 → 이용 후기 페이지 클릭' },
                { key: 'move_price_list', label: '메인메뉴 → 시세표 페이지 클릭' },
                { key: 'move_terms', label: '푸터 → 이용약관 클릭' },
                { key: 'move_privacy', label: '푸터 → 개인정보처리방침 클릭' }
            ];
            let html = '';
            exits.forEach(ex => {
                const dailyVal = data[ex.key] || 0;
                const totalVal = totalData[ex.key] || 0;
                html += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${ex.label}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #1e293b;">
                            <span style="color: #ef4444;">${new Intl.NumberFormat().format(dailyVal)}</span> / ${new Intl.NumberFormat().format(totalVal)}
                        </td>
                    </tr>
                `;
            });
            exitStatsTbody.innerHTML = html;
        }
        
        if (window.loadDailyTrendData) {
            window.loadDailyTrendData();
        }

        // --- Render Demographics Statistics ---
        const typeVal = typeSelect ? typeSelect.value : 'daily';
        const dateVal = dateInput ? dateInput.value : '';
        if (window.renderDemographics) {
            window.renderDemographics(dateVal, typeVal === 'all', typeVal);
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



            let methodText = '방문 수거 (택배)';
            if (data.deliveryMethod === 'visit') {
                methodText = '매장 방문';
            } else if (data.deliveryMethod === 'cvs' || data.method === 'foreigner' || data.deliveryMethod === 'Foreigner Pickup') {
                methodText = '편의점 택배 (착불)';
            }

            document.getElementById('detail-method').textContent = methodText;

            const ageText = data.age ? `${data.age}세` : '';
            const ageGroupText = data.ageGroup ? `(${data.ageGroup})` : '';
            const genderText = data.gender || '';
            const demoArr = [ageText + ageGroupText, genderText].filter(Boolean);
            document.getElementById('detail-demographics').textContent = demoArr.length > 0 ? demoArr.join(' / ') : '미수집';

            document.getElementById('detail-address').textContent = data.customerAddress || '-';



            document.getElementById('detail-account').textContent = `${data.bankName || ''} ${data.customerAccount || ''}`;
            
            const idCardWrapper = document.getElementById('detail-id-card-wrapper');
            const idCardEl = document.getElementById('detail-id-card');
            if (idCardWrapper && idCardEl) {
                if (data.idCardUrl) {
                    idCardWrapper.style.display = 'block';
                    idCardEl.innerHTML = `<a href="${data.idCardUrl}" target="_blank" style="color:#2563eb; font-weight:bold; text-decoration:underline;">[신분증 이미지 다운로드]</a>`;
                } else {
                    idCardWrapper.style.display = 'none';
                    idCardEl.innerHTML = '';
                }
            }

            document.getElementById('detail-date').textContent = formatDate(data.submittedAt || data.firebaseTimestamp || data.timestamp);



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
                    'wifi': 'Wifi/블루투스', 'compass': '나침반/GPS', 'unknown_part': '알수없는부품오류', 'sound': '스피커/마이크',
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
        templateId = "KA01TP260720082124111MHxTYbunZp8"; // 2026-07 문구 수정본
        // 수정본에서 #{접수계정}이 문구에서 빠짐 → 보내면 안 됨(템플릿에 없는 변수)
        variables = {
            "#{고객성함}": quoteData.customerName || "-",
            "#{모델}": `${quoteData.brand} ${quoteData.model}`
        };
    } else if (status === "입금완료") {
        templateId = "KA01TP260519020029152DuoB5fUdLPL";
        variables = {
            "#{고객성함}": quoteData.customerName || "-",
            "#{기종}": `${quoteData.brand} ${quoteData.model}`,
            "#{입금완료일자}": new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
        };
    } else if (status === "검수완료") {
        templateId = "KA01TP26051503220469833hM7NmGsbZ";
        variables = {
            "#{고객성함}": quoteData.customerName || "-",
            "#{고객명}": quoteData.customerName || "-",
            "#{이름}": quoteData.customerName || "-",
            "#{기종}": `${quoteData.brand || ''} ${quoteData.model || ''}`,
            "#{모델}": `${quoteData.brand || ''} ${quoteData.model || ''}`,
            "#{최종매입금액}": quoteData.inspectionData && quoteData.inspectionData.finalPrice ? quoteData.inspectionData.finalPrice.toLocaleString() + '원' : "-",
            "#{최종금액}": quoteData.inspectionData && quoteData.inspectionData.finalPrice ? quoteData.inspectionData.finalPrice.toLocaleString() + '원' : "-",
            "#{차감사유}": quoteData.inspectionData && quoteData.inspectionData.details ? quoteData.inspectionData.details : "없음",
            "#{차감내역}": quoteData.inspectionData && quoteData.inspectionData.details ? quoteData.inspectionData.details : "없음",
            "#{링크}": "https://rejeuphone.web.app/mypage.html",
            "#{마이페이지}": "https://rejeuphone.web.app/mypage.html"
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

window.sendDropoffAlert = async (docId) => {
    if(!confirm("해당 고객에게 이탈 알림톡(이어서 작성하기)을 발송하시겠습니까?")) return;
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docRef = doc(db, "quotes", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const phone = data.customerPhone ? data.customerPhone.replace(/-/g, '') : '';
            if (!phone) {
                alert("고객 연락처가 없습니다.");
                return;
            }
            
            const templateId = "KA01TP260521050226974gQEcmCPehop";
            const resumeLink = `https://sharaphone.com/quote.html?resume_doc_id=${docId}`;
            
            // 모든 가능성이 있는 변수들 포함 (알림톡 템플릿에 등록된 정확한 변수명 매칭을 위함)
            const today = new Date();
            const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
            
            const variables = {
                "#{고객명}": data.customerName || "고객",
                "#{고객성함}": data.customerName || "고객",
                "#{이름}": data.customerName || "고객",
                "#{기종}": `${data.brand} ${data.model} ${data.storage}`,
                "#{모델}": `${data.brand} ${data.model} ${data.storage}`,
                "#{매입신청한기종}": `${data.brand} ${data.model} ${data.storage}`,
                "#{신청일자}": dateStr,
                "#{접수일자}": dateStr,
                "#{매입신청일자}": dateStr,
                "#{링크}": resumeLink,
                "#{이어서하기링크}": resumeLink
            };

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
            if (result.success || (result.data && result.data.messageId)) {
                alert("이탈 알림톡이 발송되었습니다!");
            } else {
                alert("알림톡 발송 실패: " + (result.error || JSON.stringify(result)));
                console.error(result);
            }
        }
    } catch(e) {
        alert("알림톡 발송 중 오류 발생: " + e.message);
        console.error(e);
    }
};

// ─── 개인발송 안내 알림톡 (수동 발송) ─────────────────────────────
// 개인발송(cvs)은 굿스플로를 타지 않아 집하·도착 자동 알림톡이 나가지 않는다.
// 담당자가 상황을 보고 직접 보낼 수 있도록 버튼으로 제공한다.
// 템플릿 ID는 솔라피 승인 후 아래 값만 교체하면 된다.
const CVS_ALIMTALK_TEMPLATE_ID = "KA01TP2606022004288667NGejVJlt9L";

window.sendCvsAlimtalk = async (docId) => {
    if (!CVS_ALIMTALK_TEMPLATE_ID) {
        alert("알림톡 템플릿이 아직 등록되지 않았습니다.\n\n솔라피 승인 후 템플릿 ID를 설정해야 발송할 수 있습니다.");
        return;
    }
    try {
        const snap = await getDoc(doc(db, "quotes", docId));
        if (!snap.exists()) { alert("신청건을 찾을 수 없습니다."); return; }
        const data = snap.data();
        const phone = String(data.customerPhone || "").replace(/[^0-9]/g, "");
        if (!phone) { alert("연락처가 없어 발송할 수 없습니다."); return; }

        const already = data.cvsNotifiedAt ? "\n\n※ 이미 발송된 이력이 있습니다. 다시 보내시겠습니까?" : "";
        if (!confirm(`${data.customerName || "고객"}님(${data.customerPhone})께 개인발송 안내 알림톡을 보냅니다.${already}`)) return;

        const res = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/alimtalkApi/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phone: phone,
                templateId: CVS_ALIMTALK_TEMPLATE_ID,
                variables: {
                    "#{고객성함}": data.customerName || "-",
                    "#{고객명}": data.customerName || "-",
                    "#{기종}": `${data.brand || ""} ${data.model || ""}`.trim() || "-",
                    "#{모델}": `${data.brand || ""} ${data.model || ""}`.trim() || "-"
                }
            })
        });
        const body = await res.text();
        let ok = res.ok;
        try { const j = JSON.parse(body); if (j.success === false || j.error) ok = false; } catch (_) { }

        if (!ok) { alert("알림톡 발송에 실패했습니다.\n\n" + body.slice(0, 200)); return; }

        await updateDoc(doc(db, "quotes", docId), { cvsNotifiedAt: serverTimestamp() });
        alert("알림톡이 발송되었습니다.");
        loadQuotes();
    } catch (e) {
        console.error("개인발송 알림톡 오류:", e);
        alert("발송 중 오류가 발생했습니다.\n\n" + e.message);
    }
};

window.sendContractReminder = async (docId) => {
    if(!confirm("해당 고객에게 전자매매계약서 서명 재촉 알림톡을 발송하시겠습니까?")) return;
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docRef = doc(db, "quotes", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const phone = data.customerPhone ? data.customerPhone.replace(/-/g, '') : '';
            if (!phone) {
                alert("고객 연락처가 없습니다.");
                return;
            }
            
            const templateId = "KA01TP260703045259390nOF1rCpZ2kQ";
            const variables = {
                "#{고객명}": data.customerName || "고객",
                "#{고객성함}": data.customerName || "고객",
                "#{이름}": data.customerName || "고객",
                "#{기종}": `${data.brand || ''} ${data.model || ''}`,
                "#{모델}": `${data.brand || ''} ${data.model || ''}`,
                "#{최종매입금액}": data.inspectionData && data.inspectionData.finalPrice ? data.inspectionData.finalPrice.toLocaleString() + '원' : "-",
                "#{최종금액}": data.inspectionData && data.inspectionData.finalPrice ? data.inspectionData.finalPrice.toLocaleString() + '원' : "-",
                "#{차감사유}": data.inspectionData && data.inspectionData.details ? data.inspectionData.details : "없음",
                "#{차감내역}": data.inspectionData && data.inspectionData.details ? data.inspectionData.details : "없음",
                "#{링크}": "https://rejeuphone.web.app/mypage.html",
                "#{마이페이지}": "https://rejeuphone.web.app/mypage.html"
            };

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
            if (result.success || (result.data && result.data.messageId)) {
                alert("서명 독촉 알림톡이 발송되었습니다!");
            } else {
                alert("알림톡 발송 실패: " + (result.error || JSON.stringify(result)));
                console.error(result);
            }
        }
    } catch(e) {
        alert("알림톡 발송 중 오류 발생: " + e.message);
        console.error(e);
    }
};

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

    // 입금완료로 넘어가면 재방문 기준표가 낡으므로 캐시를 버려 다음 로딩 때 새로 만든다.
    if (newStatus === '입금완료') {
        _paidPhoneCounts = null;
        _paidDocIdsByPhone = null;
        try { sessionStorage.removeItem('sr_paid_phone_cache_v1'); } catch (_) { }
    }

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

        const updatePayload = {
            status: newStatus
        };
        if (newStatus === '입금완료') {
            updatePayload.paidAt = new Date();
        }
        // 단계 전환 시각 기록 — '금일 도착건 / 금일 검수건' 집계의 근거.
        // 굿스플로 자동전환(폴러)도 동일 필드를 쓰면 수동/자동이 같은 기준으로 잡힘.
        // 이미 기록돼 있으면 덮어쓰지 않음(최초 전환 시각 보존).
        if (newStatus === '택배도착' && !(quoteData && quoteData.arrivedAt)) {
            updatePayload.arrivedAt = new Date();
        }
        if (newStatus === '검수중' && !(quoteData && quoteData.inspectingAt)) {
            updatePayload.inspectingAt = new Date();
        }
        await updateDoc(docRef, updatePayload);

        // 취소로 변경 시 굿스플로 수거 예약도 함께 취소 — 안 하면 기사가 헛출동함
        if (newStatus === '취소' && quoteData && quoteData.goodsflowOrderNo) {
            try {
                const res = await fetch(GOODSFLOW_API + "/cancelOrder", {
                    method: "POST",
                    headers: await gfAuthHeader(),
                    body: JSON.stringify({ quoteId: id, cancelReason: "매입신청 취소로 수거 불필요" })
                });
                const out = await res.json().catch(() => ({}));
                if (res.ok && out.ok) {
                    alert("굿스플로 수거 예약도 함께 취소되었습니다.");
                } else {
                    alert("주의: 상태는 취소되었지만 굿스플로 수거 예약 취소에 실패했습니다.\n\n"
                        + (out.error || `오류 ${res.status}`)
                        + "\n\n기사 방문을 막으려면 굿스플로에서 직접 취소해주세요.");
                }
            } catch (e) {
                console.error("취소 연동 실패:", e);
                alert("주의: 상태는 취소되었지만 굿스플로 예약 취소 요청에 실패했습니다.\n기사 방문을 막으려면 굿스플로에서 직접 확인해주세요.");
            }
        }

        // 알림톡 발송
        if(quoteData) {
            triggerAlimtalk(quoteData, newStatus);
        }

        // 구글 시트 동기화 호출
        try {
            fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'updateStatus',
                    orderId: id,
                    status: newStatus
                })
            }).catch(e => console.error("GAS status update error:", e));
        } catch(e) {}

        loadQuotes();
        if (typeof loadForeignerQuotes === 'function') loadForeignerQuotes();
        alert("상태가 변경되었습니다. (알림톡 발송 및 구글 시트 동기화 요청됨)");
    } catch (e) {
        console.error("Status Update Error:", e);
        alert("상태 변경 실패: " + e.message);
        loadQuotes();
        if (typeof loadForeignerQuotes === 'function') loadForeignerQuotes();
    }
};

// --- Inspection Modal (전자매매계약서) Logic ---
window.uploadInspectionAttachment = async (input) => {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById('insp-attachment-status');
    const urlEl = document.getElementById('insp-attachment-url');
    const previewEl = document.getElementById('insp-attachment-preview');
    const linkEl = document.getElementById('insp-attachment-link');

    statusEl.innerText = "업로드 중...";
    statusEl.style.color = "#2563EB";

    try {
        // Lazy-load Firebase Storage SDK only when uploading
        const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
        const storageInstance = await getStorageLazy();
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${fileExt}`;
        const storageRef = ref(storageInstance, `inspections/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        urlEl.value = downloadUrl;
        statusEl.innerText = `업로드 완료: ${file.name}`;
        statusEl.style.color = "#16A34A";
        
        linkEl.href = downloadUrl;
        previewEl.style.display = "block";
    } catch (e) {
        console.error("Attachment upload error:", e);
        statusEl.innerText = "업로드 실패";
        statusEl.style.color = "#DC2626";
        alert("파일 업로드에 실패했습니다: " + e.message);
    }
};

window.removeInspectionAttachment = () => {
    if (confirm("첨부파일을 삭제하시겠습니까?")) {
        document.getElementById('insp-attachment-file').value = "";
        document.getElementById('insp-attachment-url').value = "";
        const statusEl = document.getElementById('insp-attachment-status');
        statusEl.innerText = "선택된 파일 없음";
        statusEl.style.color = "#666";
        document.getElementById('insp-attachment-preview').style.display = "none";
    }
};

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
        
        // Reset attachment UI
        document.getElementById('insp-attachment-file').value = "";
        document.getElementById('insp-attachment-url').value = "";
        const statusEl = document.getElementById('insp-attachment-status');
        statusEl.innerText = "선택된 파일 없음";
        statusEl.style.color = "#666";
        document.getElementById('insp-attachment-preview').style.display = "none";
        
        // Load existing inspection data if any
        if (data.inspectionData) {
            document.getElementById('insp-final-price').value = data.inspectionData.finalPrice || "";
            document.getElementById('insp-deduction-details').value = data.inspectionData.details || "";
            document.getElementById('insp-admin-comment').value = data.inspectionData.comment || "";
            
            const faults = data.inspectionData.faults || [];
            document.querySelectorAll('input[name="insp-fault"]').forEach(cb => {
                if(faults.includes(cb.value)) cb.checked = true;
            });
            
            if (data.inspectionData.attachmentUrl) {
                document.getElementById('insp-attachment-url').value = data.inspectionData.attachmentUrl;
                statusEl.innerText = "기존 파일 업로드됨";
                statusEl.style.color = "#16A34A";
                document.getElementById('insp-attachment-link').href = data.inspectionData.attachmentUrl;
                document.getElementById('insp-attachment-preview').style.display = "block";
            }
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
    const attachmentUrl = document.getElementById('insp-attachment-url').value;
    
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
        attachmentUrl: attachmentUrl || "",
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
            triggerAlimtalk({ ...docSnap.data(), id: id, inspectionData: inspectionData }, "검수완료");
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

// ===== 팝업 노출기간: 항상 한국시간(KST, +09:00) 기준으로 저장/표시 =====
// 관리자가 어느 시간대에서 입력하든, 고객이 어디서 보든 한국시간 기준으로 동작하게 하려면
// 'YYYY-MM-DDTHH:mm' 입력값에 +09:00을 명시해 절대시각(ISO)으로 저장한다.
const KST_OFFSET = '+09:00';
// datetime-local 입력값 → KST 절대시각 ISO 문자열
const kstInputToIso = (v) => (v && v.length >= 16) ? `${v.slice(0, 16)}:00${KST_OFFSET}` : '';
// 저장된 ISO → datetime-local 입력값(한국시간으로 환산해 표시)
const isoToKstInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const kst = new Date(d.getTime() + 9 * 3600000); // UTC 기준으로 +9시간 = KST 벽시계
    return kst.toISOString().slice(0, 16);
};
const fmtKst = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
};
window.updatePopupPeriodPreview = () => {
    const el = document.getElementById('popup-period-preview');
    if (!el) return;
    const s = kstInputToIso(document.getElementById('popup-start-at')?.value || '');
    const e = kstInputToIso(document.getElementById('popup-end-at')?.value || '');
    if (!s && !e) { el.textContent = '기간 제한 없음 — 켜두면 계속 노출됩니다.'; return; }
    el.textContent = `한국시간 ${s ? fmtKst(s) : '지금부터'} ~ ${e ? fmtKst(e) : '수동으로 끌 때까지'}`;
};

window.loadPopupSettings = async () => {
    try {
        const docRef = doc(db, "settings", "popup");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (document.getElementById('popup-start-at')) document.getElementById('popup-start-at').value = isoToKstInput(data.startAt);
            if (document.getElementById('popup-end-at')) document.getElementById('popup-end-at').value = isoToKstInput(data.endAt);
            if (document.getElementById('popup-show-countdown')) document.getElementById('popup-show-countdown').checked = data.showCountdown === true;
            ['popup-start-at', 'popup-end-at'].forEach(id => {
                const el = document.getElementById(id);
                if (el && !el.dataset.bound) { el.addEventListener('change', window.updatePopupPeriodPreview); el.dataset.bound = '1'; }
            });
            setTimeout(window.updatePopupPeriodPreview, 0);
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

        // 노출기간은 한국시간(+09:00)을 명시한 절대시각으로 저장 → 고객 시간대와 무관하게 동작
        const startAt = kstInputToIso(document.getElementById('popup-start-at')?.value || '');
        const endAt = kstInputToIso(document.getElementById('popup-end-at')?.value || '');
        const showCountdown = document.getElementById('popup-show-countdown')?.checked === true;

        if (startAt && endAt && new Date(startAt).getTime() >= new Date(endAt).getTime()) {
            alert("종료일시가 시작일시보다 빠릅니다. 다시 확인해주세요.");
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
            startAt,
            endAt,
            showCountdown,
            updatedAt: new Date()
        });

        let msg = "팝업 설정이 저장되었습니다.";
        if (endAt) msg += `\n\n종료: 한국시간 ${fmtKst(endAt)}\n이후에는 자동으로 노출되지 않습니다.`;
        if (startAt && Date.now() < new Date(startAt).getTime()) msg += `\n\n시작: 한국시간 ${fmtKst(startAt)}\n그 전까지는 노출되지 않습니다.`;
        alert(msg);
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

// =========================================================================
// 3. Monthly Classification, Statistics & Foreigner Application Management
// =========================================================================

function getQuoteYearMonth(data) {
    let dateObj = null;
    if (data.firebaseTimestamp) {
        dateObj = new Date(data.firebaseTimestamp.toMillis());
    } else if (data.timestamp) {
        if (typeof data.timestamp.toDate === 'function') {
            dateObj = data.timestamp.toDate();
        } else {
            let d = new Date(data.timestamp);
            if (!isNaN(d.getTime())) {
                dateObj = d;
            } else {
                const parts = String(data.timestamp).split('.');
                if (parts.length >= 3) {
                    dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
            }
        }
    }
    
    if (!dateObj || isNaN(dateObj.getTime())) {
        return null;
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

let currentFilters = {
    completed: 'all',
    canceled: 'all',
    returned: 'all'
};

function updateMonthlyFilters(type, allData) {
    const container = document.getElementById(`${type}-filter-container`);
    if (!container) return;
    
    const monthsSet = new Set();
    allData.forEach(item => {
        const ym = getQuoteYearMonth(item);
        if (ym) monthsSet.add(ym);
    });
    
    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    container.innerHTML = '';
    
    // 1. "전체보기" Button
    const btnAll = document.createElement('button');
    btnAll.className = 'action-btn';
    btnAll.style.cssText = currentFilters[type] === 'all' 
        ? 'background: #2563EB; color: white; border-color: #2563EB; font-weight: bold; margin-right: 5px;' 
        : 'background: white; color: #475569; border-color: #cbd5e1; margin-right: 5px;';
    btnAll.textContent = '전체보기';
    btnAll.onclick = () => {
        currentFilters[type] = 'all';
        applyTabFilter(type, allData);
    };
    container.appendChild(btnAll);
    
    // 2. Monthly Buttons
    sortedMonths.forEach(ym => {
        const [y, m] = ym.split('-');
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.cssText = currentFilters[type] === ym 
            ? 'background: #2563EB; color: white; border-color: #2563EB; font-weight: bold; margin-right: 5px;' 
            : 'background: white; color: #475569; border-color: #cbd5e1; margin-right: 5px;';
        btn.textContent = `${parseInt(m)}월 (${allData.filter(item => getQuoteYearMonth(item) === ym).length}건)`;
        btn.onclick = () => {
            currentFilters[type] = ym;
            applyTabFilter(type, allData);
        };
        container.appendChild(btn);
    });
}

function applyTabFilter(type, allData) {
    const tableBody = document.getElementById(`${type}-table-body`);
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    updateMonthlyFilters(type, allData);
    
    const filterVal = currentFilters[type];
    const filteredData = filterVal === 'all' 
        ? allData 
        : allData.filter(item => getQuoteYearMonth(item) === filterVal);
        
    if (filteredData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center">해당 월의 내역이 없습니다.</td></tr>`;
        return;
    }
    
    const PAGE_SIZE = 30;
    let renderedCount = 0;

    const renderRows = () => {
        const existingMore = tableBody.querySelector('.load-more-row');
        if (existingMore) existingMore.remove();

        const next = filteredData.slice(renderedCount, renderedCount + PAGE_SIZE);
        next.forEach(data => {
        const id = data.id;
        const status = data.status || '신청접수';
        const formattedDate = formatDate(data.submittedAt || data.firebaseTimestamp || data.timestamp);
        
        let statusClass = 'status-new';
        if (status === '수거중') statusClass = 'status-pickup';
            if (status === '택배도착') statusClass = 'status-pickup';
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
        } else if (!data.deliveryMethod || data.deliveryMethod === 'pending') {
            deliveryTag = `<br><span style="font-size: 0.75rem; background: #ffe4e6; color: #e11d48; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block; font-weight: bold;">배송방법 미입력 (이탈)</span>`;
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
        
        const sourceMap = {
            'daangn': '<span style="font-size:0.75rem; background:#fff3e0; color:#e65100; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">당근마켓 🥕</span>',
            'naver': '<span style="font-size:0.75rem; background:#e6f4ea; color:#137333; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">네이버 🟢</span>',
            'naver_search': '<span style="font-size:0.75rem; background:#e6f4ea; color:#137333; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">네이버 검색 🔎</span>',
            'naver_display': '<span style="font-size:0.75rem; background:#dbeafe; color:#1d4ed8; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">네이버 디스플레이 🖼️</span>',
            'google': '<span style="font-size:0.75rem; background:#e8f0fe; color:#1967d2; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">구글 🔵</span>',
            'instagram': '<span style="font-size:0.75rem; background:#fdf2f8; color:#db2777; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">인스타 📷</span>',
            'tiktok': '<span style="font-size:0.75rem; background:#e0f7fa; color:#00838f; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">틱톡 🎵</span>',
            'direct': '<span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">직접유입 📱</span>'
        };
        const sourceTag = sourceMap[data.trafficSource] || `<span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:bold; margin-top:3px; display:inline-block;">${data.trafficSource || '기타/직접'}</span>`;
        
        const methodDisplay = data.method === 'self' ? '셀프접수' : '간편접수';
        const methodBadge = data.method === 'self' 
            ? `<br><span style="font-size: 0.75rem; background: #F3E8FF; color: #6B21A8; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px; font-weight: 600;">셀프접수</span>`
            : `<br><span style="font-size: 0.75rem; background: #E0F2FE; color: #0369A1; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px; font-weight: 600;">간편접수</span>`;

        const trHtml = `
            <td><input type="checkbox" class="quote-checkbox" value="${id}" /></td>
            <td>${formattedDate}${deliveryTag}</td>
            <td>${data.customerName}<br><span style="font-size:0.8rem; color:#888;">${data.customerPhone}</span><br>${sourceTag}</td>
            <td>${data.brand} ${data.model}</td>
            <td>${data.condition || data.grade || '-'}</td>
            <td>${formatCurrency(data.price)}${methodBadge}</td>
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
                    <option value="반송대기" ${status === '반송대기' ? 'selected' : ''}>반송대기</option>
                    <option value="반송접수" ${status === '반송접수' ? 'selected' : ''}>반송접수</option>
                    <option value="취소" ${status === '취소' ? 'selected' : ''}>취소</option>
                </select>
                <button class="action-btn" style="color:red; margin-left:5px;" onclick="deleteQuote('${id}')">삭제</button>
                ${feePaidBtn}
            </td>
        `;
        const tr = document.createElement('tr');
        tr.innerHTML = trHtml;
        tableBody.appendChild(tr);
        });

        renderedCount += next.length;

        if (renderedCount < filteredData.length) {
            const moreTr = document.createElement('tr');
            moreTr.className = 'load-more-row';
            moreTr.innerHTML = `<td colspan="8" style="text-align:center; padding:14px;"><button type="button" class="action-btn" style="background:#EEF2FF; color:#4338CA; border-color:#C7D2FE; font-weight:bold; padding:8px 22px;">더보기 (${filteredData.length - renderedCount}건 더 보기)</button></td>`;
            moreTr.querySelector('button').addEventListener('click', renderRows);
            tableBody.appendChild(moreTr);
        }
    };
    renderRows();
}

async function loadForeignerQuotes() {
    const tableBody = document.getElementById('foreigner-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="9" class="text-center">로딩 중...</td></tr>';
    
    try {
        const q = query(collection(db, "quotes"), orderBy("firebaseTimestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        tableBody.innerHTML = '';
        
        let pendingCount = 0;
        let pendingAmount = 0;
        let completedCount = 0;
        let completedAmount = 0;
        
        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const id = docSnapshot.id;
            
            if (data.isDeleted) return;
            
            const isForeigner = data.isForeigner === true || data.method === 'foreigner' || data.series === 'Foreigner';
            if (!isForeigner) return;
            
            const status = data.status || '신청접수';
            
            if (status === '입금완료') {
                completedCount++;
                completedAmount += (data.price || 0);
            } else if (status !== '취소' && status !== '반송접수') {
                pendingCount++;
                pendingAmount += (data.price || 0);
            }
            
            // 표시 기준 시각 — 배송방법이 확정된 submittedAt을 우선 사용.
            // firebaseTimestamp는 본인인증 직후(배송방법 선택 전) 시각이라,
            // 며칠 뒤에 마무리한 고객이 목록 아래쪽에 묻혀 놓치는 문제가 있었다.
            const formattedDate = formatDate(data.submittedAt || data.firebaseTimestamp || data.timestamp);
            
            let statusClass = 'status-new';
            if (status === '수거중') statusClass = 'status-pickup';
            if (status === '택배도착') statusClass = 'status-pickup';
            if (status.includes('검수중')) statusClass = 'status-inspection';
            if (status === '입금완료') statusClass = 'status-paid';
            if (status === '입금대기') statusClass = 'status-pickup';
            
            let displayStatus = status;
            if (status === '신청접수') displayStatus = '매입접수완료';
            if (status === '수거중') displayStatus = '택배발송완료';
            
            const tr = document.createElement('tr');
            let idCardHtml = '<span style="color:#94a3b8; font-size:0.85rem;">미제출</span>';
            if (data.idCardUrl) {
                idCardHtml = `<a href="${data.idCardUrl}" target="_blank" class="action-btn" style="text-decoration:none; display:inline-block; padding: 4px 8px; font-size:0.8rem; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 4px; font-weight:bold;">📄 보기</a>`;
            }
            
            tr.innerHTML = `
                <td><input type="checkbox" class="quote-checkbox" value="${id}" /></td>
                <td>${formattedDate}</td>
                <td>${data.customerName}<br><span style="font-size:0.8rem; color:#2563eb; font-weight:bold;">${(data.language || 'en').toUpperCase()}</span></td>
                <td>${data.customerPhone}<br><span style="font-size:0.8rem; color:#888;">${data.contactMethod || ''}</span></td>
                <td>${idCardHtml}</td>
                <td>${data.brand} ${data.model}<br><span style="font-size:0.75rem; color:#666;">${data.storage || ''} / ${data.grade || ''}</span></td>
                <td>${formatCurrency(data.price)}</td>
                <td><span class="status-badge ${statusClass}">${displayStatus}</span></td>
                <td>
                    <button class="action-btn" onclick="viewDetail('${id}')">상세보기</button>
                    <select onchange="updateQuoteStatus('${id}', this.value)" class="action-btn" style="width: auto;">
                        <option value="" disabled selected>상태변경</option>
                        <option value="신청접수">매입접수완료</option>
                        <option value="수거중">택배발송완료</option>
                        <option value="검수중">검수중</option>
                        <option value="입금대기" ${status === '입금대기' ? 'selected' : ''}>입금대기</option>
                        <option value="입금완료" ${status === '입금완료' ? 'selected' : ''}>입금완료</option>
                        <option value="반송대기" ${status === '반송대기' ? 'selected' : ''}>반송대기</option>
                        <option value="반송접수" ${status === '반송접수' ? 'selected' : ''}>반송접수</option>
                        <option value="취소" ${status === '취소' ? 'selected' : ''}>취소</option>
                    </select>
                    <button class="action-btn" style="color:red; margin-left:5px;" onclick="deleteQuote('${id}')">삭제</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        
        if (tableBody.children.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">접수된 외국인 신청이 없습니다.</td></tr>';
        }
        
        const pendingCountEl = document.getElementById('stat-fg-pending-count');
        const pendingAmountEl = document.getElementById('stat-fg-pending-amount');
        const monthlyCountEl = document.getElementById('stat-fg-monthly-count');
        const monthlyAmountEl = document.getElementById('stat-fg-monthly-amount');

        if (pendingCountEl) pendingCountEl.innerText = `${pendingCount}건`;
        if (pendingAmountEl) pendingAmountEl.innerText = `${new Intl.NumberFormat('ko-KR').format(pendingAmount)}원`;
        if (monthlyCountEl) monthlyCountEl.innerText = `${completedCount}건`;
        if (monthlyAmountEl) monthlyAmountEl.innerText = `${new Intl.NumberFormat('ko-KR').format(completedAmount)}원`;
        
    } catch (e) {
        console.error("Error loading foreigner quotes:", e);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">데이터 로딩 실패: ${e.message}</td></tr>`;
    }
}

async function loadMonthlyStats() {
    const tableBody = document.getElementById('monthly-stats-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">로딩 중...</td></tr>';
    
    try {
        const q = query(collection(db, "quotes"));
        const querySnapshot = await getDocs(q);
        
        const monthlyMap = {};
        
        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            if (data.isDeleted) return;
            
            const isDroppedOff = !data.deliveryMethod || data.deliveryMethod === 'pending';
            if (isDroppedOff) return;
            
            const ym = getQuoteYearMonth(data);
            if (!ym) return;
            
            if (!monthlyMap[ym]) {
                monthlyMap[ym] = {
                    total: 0,
                    completed: 0,
                    canceled: 0,
                    returned: 0,
                    pending: 0,
                    completedAmount: 0
                };
            }
            
            monthlyMap[ym].total++;
            const status = data.status || '신청접수';
            if (status === '입금완료') {
                monthlyMap[ym].completed++;
                monthlyMap[ym].completedAmount += (data.price || 0);
            } else if (status === '취소') {
                monthlyMap[ym].canceled++;
            } else if (status === '반송접수') {
                monthlyMap[ym].returned++;
            } else {
                monthlyMap[ym].pending++;
            }
        });
        
        tableBody.innerHTML = '';
        
        const sortedMonths = Object.keys(monthlyMap).sort((a, b) => b.localeCompare(a));
        
        if (sortedMonths.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">통계 데이터가 없습니다.</td></tr>';
            return;
        }
        
        sortedMonths.forEach(ym => {
            const stats = monthlyMap[ym];
            const tr = document.createElement('tr');
            
            const [y, m] = ym.split('-');
            const displayLabel = `${y}년 ${m}월`;
            
            tr.innerHTML = `
                <td style="font-weight: bold;">${displayLabel}</td>
                <td style="text-align: right; font-weight: bold; color: #1e293b;">${stats.total} 건</td>
                <td style="text-align: right; color: #2e7d32; font-weight: bold;">${stats.completed} 건</td>
                <td style="text-align: right; color: #c62828;">${stats.canceled} 건</td>
                <td style="text-align: right; color: #e65100;">${stats.returned} 건</td>
                <td style="text-align: right; color: #475569;">${stats.pending} 건</td>
                <td style="text-align: right; font-weight: bold; color: #0d47a1;">${new Intl.NumberFormat('ko-KR').format(stats.completedAmount)}원</td>
            `;
            tableBody.appendChild(tr);
        });
        
    } catch(e) {
        console.error("Monthly stats calculation error:", e);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">통계 계산 실패: ${e.message}</td></tr>`;
    }
}

// Global Exports
window.loadForeignerQuotes = loadForeignerQuotes;
window.loadMonthlyStats = loadMonthlyStats;

// 일일통계 분석표 — 선택한 달의 날짜별(신청일 기준 코호트) 현재 상태 집계. 삭제(휴지통) 포함, 외국인 제외.
async function loadDailyStats() {
    const tableBody = document.getElementById('daily-stats-table-body');
    if (!tableBody) return;
    const monthSel = document.getElementById('daily-stats-month');
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">로딩 중...</td></tr>';
    try {
        const appliedDate = (data) => {
            // 배송방법이 확정된 날(submittedAt)을 신청일로 본다.
            //  - 신청완료 건: 실제로 신청을 마친 날에 집계 (7/20 인증 → 7/23 완료면 7/23)
            //  - 이탈 건: submittedAt이 없으므로 아래 firebaseTimestamp(인증일)로 자동 폴백
            // 관리자 목록도 같은 기준이라 두 화면 숫자가 일치한다.
            if (data.submittedAt && data.submittedAt.toMillis) return new Date(data.submittedAt.toMillis());
            if (data.submittedAt && data.submittedAt.seconds) return new Date(data.submittedAt.seconds * 1000);
            if (data.firebaseTimestamp && data.firebaseTimestamp.toMillis) return new Date(data.firebaseTimestamp.toMillis());
            if (data.firebaseTimestamp && data.firebaseTimestamp.seconds) return new Date(data.firebaseTimestamp.seconds * 1000);
            if (data.timestamp) {
                const t = new Date(data.timestamp);
                if (!isNaN(t.getTime())) return t;
                const p = String(data.timestamp).split('.');
                if (p.length >= 3) return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
            }
            return null;
        };
        const snap = await getDocs(query(collection(db, "quotes")));
        const docs = [];
        const monthsSet = new Set();
        snap.forEach((ds) => {
            const data = ds.data();
            if (data.isForeigner === true || data.method === 'foreigner' || data.series === 'Foreigner') return;
            const d = appliedDate(data);
            if (!d) return;
            const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            monthsSet.add(ym);
            docs.push({ data, d, ym });
        });
        if (monthSel && monthSel.options.length === 0) {
            const months = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
            const now = new Date();
            const curYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            months.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m.split('-')[0] + '년 ' + parseInt(m.split('-')[1]) + '월';
                monthSel.appendChild(opt);
            });
            monthSel.value = months.includes(curYM) ? curYM : (months[0] || '');
        }
        const selYM = (monthSel && monthSel.value) ? monthSel.value : null;
        const paidDate = (data) => {
            const v = data.paidAt || data.customerAgreedAt || (data.inspectionData && data.inspectionData.inspectedAt);
            if (v) {
                if (v.toDate) return v.toDate();
                if (v.seconds) return new Date(v.seconds * 1000);
                const dd = new Date(v);
                if (!isNaN(dd.getTime())) return dd;
            }
            return null;
        };
        const dayKey = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        const dayMap = {};
        const ensure = (key, dt) => { if (!dayMap[key]) dayMap[key] = { date: dt, 신규접수: 0, 이탈: 0, 이탈중복: 0, 취소: 0, 삭제: 0, 택배도착: 0, 완료: 0, 검수완료: 0, 반송대기: 0 }; return dayMap[key]; };
        // 택배도착 시각 — 굿스플로 폴러가 기록한 arrivedAt (수동 전환 시에도 동일 필드 사용)
        const arrivedDate = (data) => {
            const v = data.arrivedAt;
            if (!v) return null;
            if (v.toDate) return v.toDate();
            if (v.seconds) return new Date(v.seconds * 1000);
            const dd = new Date(v);
            return isNaN(dd.getTime()) ? null : dd;
        };
        // 정상 신청(방문수거/개인발송) 이력이 있는 전화번호 집합 → 이탈건 '중복' 판별용
        const normPhone = (p) => String(p || '').replace(/[^0-9]/g, '');
        const validPhones = new Set();
        docs.forEach(({ data }) => { if (data.deliveryMethod === 'courier' || data.deliveryMethod === 'cvs') { const p = normPhone(data.customerPhone); if (p) validPhones.add(p); } });
        docs.forEach(({ data, d, ym }) => {
            // 신청일 기준: 신규접수 / 이탈 / 검수완료 / 반송대기
            if (!selYM || ym === selYM) {
                const r = ensure(dayKey(d), d);
                const dm = data.deliveryMethod;
                if (dm === 'courier' || dm === 'cvs') r.신규접수++;   // 방문수거 or 개인발송으로 배송방법 확인된 정상 접수
                else if (!dm || dm === 'pending') {                   // 배송방법 미입력 = 이탈
                    r.이탈++;
                    const p = normPhone(data.customerPhone);
                    if (p && validPhones.has(p)) r.이탈중복++;        // 같은 번호로 정상 신청 이력 있음 = 중복(삭제 대상)
                }
                const st = data.status || '신청접수';
                if (st === '검수완료') r.검수완료++;
                else if (st === '반송대기') r.반송대기++;
                // 해당 날짜 접수분 중 취소·삭제로 빠진 건 (신규접수와 별개로 세어 유입 대비 손실을 본다)
                if (st === '취소') r.취소++;
                if (data.isDeleted) r.삭제++;
            }
            // 도착일 기준: 택배도착 = 그 날 사무실에 도착한 건수 (신청일과 다르므로 별도 집계)
            const ad = arrivedDate(data);
            if (ad) {
                const aym = ad.getFullYear() + '-' + String(ad.getMonth() + 1).padStart(2, '0');
                if (!selYM || aym === selYM) ensure(dayKey(ad), ad).택배도착++;
            }
            // 완료일(입금일) 기준: 매입완료 = 그 날 입금완료 처리된 건수
            if ((data.status || '') === '입금완료') {
                const pd = paidDate(data) || d;
                const pym = pd.getFullYear() + '-' + String(pd.getMonth() + 1).padStart(2, '0');
                if (!selYM || pym === selYM) {
                    const r = ensure(dayKey(pd), pd);
                    r.완료++;
                }
            }
        });
        const days = Object.keys(dayMap).sort((a, b) => b.localeCompare(a));
        if (days.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">해당 월 데이터가 없습니다.</td></tr>';
            return;
        }
        const dow = ['일', '월', '화', '수', '목', '금', '토'];
        const sum = { 신규접수: 0, 이탈: 0, 이탈중복: 0, 취소: 0, 삭제: 0, 택배도착: 0, 완료: 0, 검수완료: 0, 반송대기: 0 };
        const dupTag = (n) => n ? ` <span style="color:#f59e0b; font-size:0.82em; font-weight:600;">(중복 ${n})</span>` : '';
        let html = '';
        days.forEach((k) => {
            const r = dayMap[k];
            sum.신규접수 += r.신규접수; sum.이탈 += r.이탈; sum.이탈중복 += r.이탈중복; sum.취소 += r.취소; sum.삭제 += r.삭제; sum.택배도착 += r.택배도착; sum.완료 += r.완료; sum.검수완료 += r.검수완료; sum.반송대기 += r.반송대기;
            const label = `${r.date.getMonth() + 1}/${r.date.getDate()} (${dow[r.date.getDay()]})`;
            html += `<tr><td>${label}</td><td>${r.신규접수}</td><td>${r.이탈}</td><td style="color:#dc2626;">${r.취소}</td><td style="color:#94a3b8;">${r.삭제}</td><td style="color:#0f766e;">${r.택배도착}</td><td style="font-weight:bold; color:#16a34a;">${r.완료}</td><td>${r.검수완료}</td><td>${r.반송대기}</td></tr>`;
        });
        html += `<tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #e2e8f0;"><td>합계</td><td>${sum.신규접수}</td><td>${sum.이탈}</td><td style="color:#dc2626;">${sum.취소}</td><td style="color:#94a3b8;">${sum.삭제}</td><td style="color:#0f766e;">${sum.택배도착}</td><td style="color:#16a34a;">${sum.완료}</td><td>${sum.검수완료}</td><td>${sum.반송대기}</td></tr>`;
        tableBody.innerHTML = html;
    } catch (e) {
        console.error("loadDailyStats error:", e);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">로딩 실패: ${e.message}</td></tr>`;
    }
}
window.loadDailyStats = loadDailyStats;

// 매입신청관리의 이탈(배송미입력) 행 중, 같은 번호로 정상 신청(방문수거/개인발송) 또는 매입완료 이력이 있는 건에 '중복' 배지 표시.
// (진행중만 로드하므로 완료 이력 확인 위해 전체 quotes를 별도 조회 — 화면 렌더 후 비동기로 실행하여 초기 로딩 속도 유지)
async function markEscapeeDuplicates(btn) {
    const badges = document.querySelectorAll('.escapee-dup-badge');
    if (!badges.length) { if (btn) btn.textContent = '이탈 없음'; return; }
    if (btn) { btn.disabled = true; btn.textContent = '조회 중...'; }
    try {
        const snap = await getDocs(query(collection(db, "quotes")));
        const validPhones = new Set();
        snap.forEach((ds) => {
            const d = ds.data();
            const p = String(d.customerPhone || '').replace(/[^0-9]/g, '');
            if (!p) return;
            if (d.deliveryMethod === 'courier' || d.deliveryMethod === 'cvs' || d.status === '입금완료') validPhones.add(p);
        });
        let cnt = 0;
        badges.forEach((b) => { if (b.dataset.phone && validPhones.has(b.dataset.phone)) { b.style.display = 'inline-block'; cnt++; } });
        if (btn) btn.textContent = `중복 ${cnt}건 표시됨`;
    } catch (e) {
        console.error('markEscapeeDuplicates error:', e);
        if (btn) { btn.disabled = false; btn.textContent = '중복 표시 (재시도)'; }
    }
}
window.markEscapeeDuplicates = markEscapeeDuplicates;
window.applyTabFilter = applyTabFilter;


window.deleteSelectedQuotes = async (tbodyId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    const checkboxes = tbody.querySelectorAll('.quote-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("삭제할 신청내역을 선택해주세요.");
        return;
    }
    
    if (!confirm(`선택하신 ${checkboxes.length}건을 정말 삭제(휴지통 이동)하시겠습니까?`)) {
        return;
    }
    
    try {
        // 종결 상태(입금완료/취소/반송접수/삭제)는 status를 보존(완료 집계 유지),
        // 비종결(신청접수·이탈 등)만 status='삭제'로 전환 → loadQuotes 조회에서 제외되어 로딩 경량화
        const TERMINAL_STATUSES = ['입금완료', '취소', '반송접수', '삭제'];
        for (const cb of checkboxes) {
            const id = cb.value;
            const quoteRef = doc(db, 'quotes', id);
            const patch = { isDeleted: true, deletedAt: serverTimestamp() };
            try {
                const snap = await getDoc(quoteRef);
                const cur = snap.exists() ? (snap.data().status || '신청접수') : '신청접수';
                if (!TERMINAL_STATUSES.includes(cur)) {
                    patch.prevStatus = cur;
                    patch.status = '삭제';
                }
            } catch (e) { /* 상태 조회 실패 시에도 삭제 자체는 진행 */ }
            await updateDoc(quoteRef, patch);
        }
        
        alert(`${checkboxes.length}건이 성공적으로 삭제되었습니다.`);
        
        // Reload appropriate list
        if (tbodyId === 'quotes-table-body' && typeof loadQuotes === 'function') loadQuotes();
        if (tbodyId === 'foreigner-table-body' && typeof loadForeignerQuotes === 'function') loadForeignerQuotes();
        if (tbodyId === 'completed-table-body' || tbodyId === 'canceled-table-body' || tbodyId === 'returned-table-body') {
            if (typeof renderTabList === 'function') {
                const type = tbodyId.split('-')[0];
                renderTabList(type, window.quotesDataCache || []);
            }
        }
        
        // Uncheck 'select all' if checked
        const selectAllCb = document.querySelector(`input[onclick*="${tbodyId}"]`);
        if (selectAllCb) selectAllCb.checked = false;
        
    } catch (error) {
        console.error("Bulk Delete Error:", error);
        alert("일괄 삭제 중 오류가 발생했습니다.");
    }
};

window.toggleSelectAll = (sourceCheckbox, tbodyId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const checkboxes = tbody.querySelectorAll('.quote-checkbox');
    checkboxes.forEach(cb => cb.checked = sourceCheckbox.checked);
};

window.bulkCancelPendingQuotes = async (selectedOnly) => {
    let checkboxes;
    if (selectedOnly) {
        checkboxes = document.querySelectorAll('.pending-quote-checkbox:checked');
        if (checkboxes.length === 0) {
            alert("선택된 내역이 없습니다.");
            return;
        }
        if (!confirm(`선택하신 ${checkboxes.length}건의 상태를 '취소'로 변경하시겠습니까?`)) {
            return;
        }
    } else {
        checkboxes = document.querySelectorAll('.pending-quote-checkbox');
        if (checkboxes.length === 0) {
            alert("취소할 배송방법 미입력 건이 없습니다.");
            return;
        }
        if (!confirm(`현재 화면에 표시된 배송방법 미입력 건 전체(${checkboxes.length}건)의 상태를 '취소'로 변경하시겠습니까?`)) {
            return;
        }
    }

    let successCount = 0;
    let failCount = 0;

    document.body.style.cursor = 'wait';

    try {
        for (const cb of checkboxes) {
            const id = cb.value;
            try {
                const docRef = doc(db, "quotes", id);
                await updateDoc(docRef, { status: "취소" });
                
                // 구글 시트 동기화 호출
                try {
                    fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({
                            action: 'updateStatus',
                            orderId: id,
                            status: '취소'
                        })
                    }).catch(e => console.error("GAS status update error:", e));
                } catch(e) {}

                successCount++;
            } catch (err) {
                console.error(`Failed to cancel quote ${id}:`, err);
                failCount++;
            }
        }
        alert(`${successCount}건이 취소 처리되었습니다.${failCount > 0 ? ` (실패: ${failCount}건)` : ''}`);
        await loadQuotes();
    } catch (e) {
        console.error("Bulk cancel error:", e);
        alert("일괄 취소 중 오류가 발생했습니다.");
    } finally {
        document.body.style.cursor = 'default';
        const selectAllCb = document.querySelector(`input[onclick*="quotes-table-body"]`);
        if (selectAllCb) selectAllCb.checked = false;
    }
};

window.bulkSendPendingAlimtalk = async (selectedOnly) => {
    let checkboxes;
    if (selectedOnly) {
        checkboxes = document.querySelectorAll('.pending-quote-checkbox:checked');
        if (checkboxes.length === 0) {
            alert("선택된 내역이 없습니다.");
            return;
        }
        if (!confirm(`선택하신 ${checkboxes.length}명의 고객에게 이탈 알림톡(이어서 작성하기)을 발송하시겠습니까?`)) {
            return;
        }
    } else {
        checkboxes = document.querySelectorAll('.pending-quote-checkbox');
        if (checkboxes.length === 0) {
            alert("발송할 배송방법 미입력 건이 없습니다.");
            return;
        }
        if (!confirm(`현재 화면에 표시된 배송방법 미입력 건 전체(${checkboxes.length}명)의 고객에게 이탈 알림톡을 발송하시겠습니까?`)) {
            return;
        }
    }

    let successCount = 0;
    let failCount = 0;
    document.body.style.cursor = 'wait';

    try {
        for (const cb of checkboxes) {
            const id = cb.value;
            try {
                const docRef = doc(db, "quotes", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const phone = data.customerPhone ? data.customerPhone.replace(/-/g, '') : '';
                    if (!phone) {
                        failCount++;
                        continue;
                    }
                    
                    const templateId = "KA01TP260521050226974gQEcmCPehop";
                    const resumeLink = `https://sharaphone.com/quote.html?resume_doc_id=${id}`;
                    
                    const today = new Date();
                    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
                    
                    const variables = {
                        "#{고객명}": data.customerName || "고객",
                        "#{고객성함}": data.customerName || "고객",
                        "#{이름}": data.customerName || "고객",
                        "#{기종}": `${data.brand || ''} ${data.model || ''} ${data.storage || ''}`,
                        "#{모델}": `${data.brand || ''} ${data.model || ''} ${data.storage || ''}`,
                        "#{매입신청한기종}": `${data.brand || ''} ${data.model || ''} ${data.storage || ''}`,
                        "#{신청일자}": dateStr,
                        "#{접수일자}": dateStr,
                        "#{매입신청일자}": dateStr,
                        "#{링크}": resumeLink,
                        "#{이어서하기링크}": resumeLink
                    };

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
                    if (result.success || (result.data && result.data.messageId)) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                }
            } catch (err) {
                console.error(`Failed to send alimtalk for ${id}:`, err);
                failCount++;
            }
        }
        alert(`${successCount}명의 고객에게 이탈 알림톡이 발송되었습니다.${failCount > 0 ? ` (실패: ${failCount}건)` : ''}`);
    } catch (e) {
        console.error("Bulk alimtalk error:", e);
        alert("일괄 알림톡 발송 중 오류가 발생했습니다.");
    } finally {
        document.body.style.cursor = 'default';
        const selectAllCb = document.querySelector(`input[onclick*="quotes-table-body"]`);
        if (selectAllCb) selectAllCb.checked = false;
    }
};

window.inventoryDataCache = []; // 캐싱용 변수

window.loadInventory = async function() {
    const tableBody = document.getElementById('inventory-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">재고 데이터를 불러오는 중입니다...</td></tr>';
    
    try {
        const q = query(collection(db, "quotes"));
        const querySnapshot = await getDocs(q);
        
        window.inventoryDataCache = [];
        
        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const status = data.status || '신청접수';
            
            if (status !== '입금완료') return;
            if (data.isDeleted) return;
            
            window.inventoryDataCache.push({ id: docSnapshot.id, ...data });
        });

        // Helper to get time value for sorting
        const getQuotePaidTime = (data) => {
            if (data.paidAt) {
                if (typeof data.paidAt.toDate === 'function') return data.paidAt.toDate().getTime();
                if (data.paidAt.seconds) return data.paidAt.seconds * 1000;
                const d = new Date(data.paidAt);
                if (!isNaN(d.getTime())) return d.getTime();
            }
            if (data.customerAgreedAt) {
                if (typeof data.customerAgreedAt.toDate === 'function') return data.customerAgreedAt.toDate().getTime();
                if (data.customerAgreedAt.seconds) return data.customerAgreedAt.seconds * 1000;
                const d = new Date(data.customerAgreedAt);
                if (!isNaN(d.getTime())) return d.getTime();
            }
            if (data.inspectionData && data.inspectionData.inspectedAt) {
                const d = new Date(data.inspectionData.inspectedAt);
                if (!isNaN(d.getTime())) return d.getTime();
            }
            if (data.firebaseTimestamp) {
                if (typeof data.firebaseTimestamp.toDate === 'function') return data.firebaseTimestamp.toDate().getTime();
                if (data.firebaseTimestamp.seconds) return data.firebaseTimestamp.seconds * 1000;
            }
            if (data.timestamp) {
                if (data.timestamp.seconds) return data.timestamp.seconds * 1000;
                if (typeof data.timestamp === 'string') {
                    const koMatch = data.timestamp.match(/(\d+)\.\s*(\d+)\.\s*(\d+)\.\s*(오전|오후)\s*(\d+):(\d+):(\d+)/);
                    if (koMatch) {
                        const year = parseInt(koMatch[1]);
                        const month = parseInt(koMatch[2]) - 1;
                        const day = parseInt(koMatch[3]);
                        const ampm = koMatch[4];
                        let hour = parseInt(koMatch[5]);
                        const minute = parseInt(koMatch[6]);
                        const second = parseInt(koMatch[7]);
                        if (ampm === '오후' && hour < 12) hour += 12;
                        else if (ampm === '오전' && hour === 12) hour = 0;
                        return new Date(year, month, day, hour, minute, second).getTime();
                    }
                    const match = data.timestamp.match(/(\d+):(\d+):(\d+)\s+(\d+)\/(\d+)\/(\d+)/);
                    if (match) {
                        const hours = parseInt(match[1]);
                        const minutes = parseInt(match[2]);
                        const seconds = parseInt(match[3]);
                        const day = parseInt(match[4]);
                        const month = parseInt(match[5]) - 1;
                        const year = parseInt(match[6]);
                        return new Date(year, month, day, hours, minutes, seconds).getTime();
                    }
                    const d = new Date(data.timestamp);
                    if (!isNaN(d.getTime())) return d.getTime();
                }
            }
            return 0;
        };

        // Sort by payment completion date descending (most recently paid first)
        window.inventoryDataCache.sort((a, b) => {
            return getQuotePaidTime(b) - getQuotePaidTime(a);
        });
        
        renderInventoryTable(window.inventoryDataCache);
        
    } catch(e) {
        console.error("Inventory load error:", e);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">재고 로드 실패: ${e.message}</td></tr>`;
    }
};

window.renderInventoryTable = function(dataList) {
    const tableBody = document.getElementById('inventory-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    if (dataList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">해당하는 재고 내역이 없습니다.</td></tr>';
        return;
    }
    
    dataList.forEach(data => {
        const tr = document.createElement('tr');
        const id = data.id;
        const modelText = `${data.brand || ''} ${data.model || ''} ${data.storage || ''}`.trim();
        const priceText = `${new Intl.NumberFormat('ko-KR').format(data.price || 0)}원`;
        
        // Format reception date
        let reqDateText = '날짜없음';
        if (data.firebaseTimestamp) {
            const d = data.firebaseTimestamp.toDate ? data.firebaseTimestamp.toDate() : new Date(data.firebaseTimestamp.seconds ? data.firebaseTimestamp.seconds * 1000 : data.firebaseTimestamp);
            if (d && !isNaN(d.getTime())) reqDateText = d.toLocaleDateString('ko-KR');
        } else if (data.timestamp) {
            const d = new Date(data.timestamp);
            if (!isNaN(d.getTime())) {
                reqDateText = d.toLocaleDateString('ko-KR');
            } else {
                const parts = String(data.timestamp).split('.');
                if (parts.length >= 3) {
                    const yr = parseInt(parts[0]);
                    const mo = parseInt(parts[1]);
                    const dy = parseInt(parts[2]);
                    reqDateText = `${yr}. ${String(mo).padStart(2,'0')}. ${String(dy).padStart(2,'0')}.`;
                } else {
                    reqDateText = data.timestamp;
                }
            }
        }
        
        // Format remittance date (paidAt)
        let paidDateText = '확인대기';
        let pDateObj = null;
        if (data.paidAt) {
            pDateObj = data.paidAt.toDate ? data.paidAt.toDate() : new Date(data.paidAt.seconds ? data.paidAt.seconds * 1000 : data.paidAt);
        } else if (data.customerAgreedAt) {
            pDateObj = data.customerAgreedAt.toDate ? data.customerAgreedAt.toDate() : new Date(data.customerAgreedAt.seconds ? data.customerAgreedAt.seconds * 1000 : data.customerAgreedAt);
        } else if (data.inspectionData && data.inspectionData.inspectedAt) {
            pDateObj = new Date(data.inspectionData.inspectedAt);
        }
        
        if (pDateObj && !isNaN(pDateObj.getTime())) {
            paidDateText = pDateObj.toLocaleDateString('ko-KR');
        } else {
            // Legacy quotes fallback to request date
            paidDateText = reqDateText;
        }
        
        const dateStr = `${reqDateText} / ${paidDateText}`;
        const customerText = `${data.customerName || '익명'} / ${data.customerPhone || '연락처없음'}`;
        
        const formatDefectsLocal = (defects) => {
            if (!defects || Object.keys(defects).length === 0) return '특이사항 없음';
            let parts = [];
            if (defects.is_sealed !== undefined) parts.push(`미개봉: ${defects.is_sealed ? '예' : '아니오'}`);
            if (defects.lcd_damage !== undefined) parts.push(`액정손상: ${defects.lcd_damage ? '있음' : '정상'}`);
            if (defects.burn_in !== undefined) parts.push(`잔상: ${defects.burn_in ? '있음' : '정상'}`);
            const dict = {
                'true': '미개봉', 'false': '개봉', 'yes': '있음/불량', 'no': '없음/정상',
                'scratch': '흠집', 'dent': '찍힘', 'break': '파손',
                'lcd_broken': '액정파손/LCD불량', 'lcd_backlight': '백라이트 불량',
                'burn_in_mild': '미세 잔상', 'burn_in_severe': '심한 잔상',
                'camera': '카메라 불량', 'wifi': '와이파이 불량', 'power': '전원 버튼 불량',
                'volume': '볼륨 버튼 불량', 'speaker': '스피커 불량', 'mic': '마이크 불량',
                'charge': '충전 불량', 'biometrics': '생체인식 불량', 'gps': 'GPS 불량',
                'network': '네트워크(유심) 불량', 'account': '계정 잠김(매입불가)',
                'camera_lens': '카메라 멍/기스', 'camera_fail': '카메라 작동불가', 'faceid': '페이스ID/지문',
                'compass': '나침반/GPS', 'unknown_part': '알수없는부품오류', 'sound': '스피커/마이크',
                'vibration': '진동 불량', 'touch': '터치 불량', 'battery': '배터리성능 80%↓'
            };
            for (const key in defects) {
                if (['is_sealed', 'lcd_damage', 'burn_in'].includes(key)) continue;
                if (Array.isArray(defects[key]) && defects[key].length > 0) {
                    const mappedValues = defects[key].map(v => dict[v] || v).join(', ');
                    let groupName = key;
                    if (key === 'func_defect') groupName = '기능';
                    else if (key === 'body_defect' || key === 'body_damage' || key === 'body') groupName = '외관';
                    else if (key === 'micro_scratch') groupName = '미세기스';
                    parts.push(`${groupName}: ${mappedValues}`);
                }
            }
            return parts.length > 0 ? parts.join(', ') : '특이사항 없음';
        };
        const memoText = formatDefectsLocal(data.defectsDetails);
        
        tr.innerHTML = `
            <td><input type="checkbox" class="quote-checkbox" value="${id}" /></td>
            <td><span class="status-badge status-paid">보관중</span></td>
            <td style="font-weight:bold;">${modelText}</td>
            <td style="color:#1976D2; font-weight:bold;">${priceText}</td>
            <td>${dateStr}</td>
            <td>${customerText}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${memoText}</td>
        `;
        tableBody.appendChild(tr);
    });
};

window.filterInventory = function() {
    const searchInput = document.getElementById('inventory-search-input');
    if (!searchInput) return;
    
    const queryStr = searchInput.value.toLowerCase().trim();
    if (!queryStr) {
        renderInventoryTable(window.inventoryDataCache);
        return;
    }
    
    const matched = window.inventoryDataCache.filter(item => {
        const name = (item.customerName || '').toLowerCase();
        const model = (`${item.brand || ''} ${item.model || ''} ${item.storage || ''}`).toLowerCase();
        return name.includes(queryStr) || model.includes(queryStr);
    });
    
    renderInventoryTable(matched);
};

let chartDailyTrend = null;
let chartBrandRatio = null;
let chartGradeRatio = null;

window.loadStatistics = async function() {
    try {
        const tableBody = document.getElementById('stat-top-models-table-body');
        
        // 1. Fetch all quotes (in-memory filtering to avoid index errors)
        const q = query(collection(db, "quotes"));
        const querySnapshot = await getDocs(q);
        
        const allQuotes = [];
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.isDeleted) {
                allQuotes.push({ id: docSnap.id, ...data });
            }
        });
        
        // 2. Date helper functions (KST timezone match)
        const parseDate = (val) => {
            if (!val) return null;
            if (typeof val.toDate === 'function') return val.toDate();
            if (val.seconds) return new Date(val.seconds * 1000);
            if (typeof val === 'string') {
                const koMatch = val.match(/(\d+)\.\s*(\d+)\.\s*(\d+)\.\s*(오전|오후)\s*(\d+):(\d+):(\d+)/);
                if (koMatch) {
                    const year = parseInt(koMatch[1]);
                    const month = parseInt(koMatch[2]) - 1;
                    const day = parseInt(koMatch[3]);
                    const ampm = koMatch[4];
                    let hour = parseInt(koMatch[5]);
                    const minute = parseInt(koMatch[6]);
                    const second = parseInt(koMatch[7]);
                    if (ampm === '오후' && hour < 12) hour += 12;
                    else if (ampm === '오전' && hour === 12) hour = 0;
                    return new Date(year, month, day, hour, minute, second);
                }
                const match = val.match(/(\d+):(\d+):(\d+)\s+(\d+)\/(\d+)\/(\d+)/);
                if (match) {
                    const hours = parseInt(match[1]);
                    const minutes = parseInt(match[2]);
                    const seconds = parseInt(match[3]);
                    const day = parseInt(match[4]);
                    const month = parseInt(match[5]) - 1;
                    const year = parseInt(match[6]);
                    return new Date(year, month, day, hours, minutes, seconds);
                }
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d;
                
                const parts = val.split('.');
                if (parts.length >= 3) {
                    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
            }
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        const getQuotePaidDateObj = (data) => {
            if (data.paidAt) return parseDate(data.paidAt);
            if (data.customerAgreedAt) return parseDate(data.customerAgreedAt);
            if (data.inspectionData && data.inspectionData.inspectedAt) return parseDate(data.inspectionData.inspectedAt);
            if (data.firebaseTimestamp) return parseDate(data.firebaseTimestamp);
            if (data.timestamp) return parseDate(data.timestamp);
            return null;
        };

        const getQuoteRequestDateObj = (data) => {
            if (data.firebaseTimestamp) return parseDate(data.firebaseTimestamp);
            if (data.timestamp) return parseDate(data.timestamp);
            return getQuotePaidDateObj(data);
        };

        const formatDateToYYYYMM = (date) => {
            if (!date) return "";
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        };

        const now = new Date();
        const currentMonthStr = formatDateToYYYYMM(now); // e.g. "2026-06"
        
        // 3. Collect all unique completion months for completed quotes
        const uniqueMonths = new Set();
        uniqueMonths.add(currentMonthStr); // Always include current month
        
        allQuotes.forEach(q => {
            if (q.status === '입금완료') {
                const paidDate = getQuotePaidDateObj(q);
                if (paidDate) {
                    uniqueMonths.add(formatDateToYYYYMM(paidDate));
                }
            }
        });
        
        const sortedMonths = Array.from(uniqueMonths).sort().reverse(); // Newest first
        
        // 4. Populate Month Filter Select (dynamically)
        const filterSelect = document.getElementById('stat-month-filter');
        if (filterSelect) {
            const currentSelectedValue = filterSelect.value;
            // Only rebuild options if they are not already populated or count is different
            if (filterSelect.options.length <= 1 || filterSelect.options.length !== sortedMonths.length + 1) {
                filterSelect.innerHTML = '';
                
                // Add "전체" option
                const allOpt = document.createElement('option');
                allOpt.value = 'all';
                allOpt.innerText = '전체 기간';
                filterSelect.appendChild(allOpt);
                
                sortedMonths.forEach(mStr => {
                    const opt = document.createElement('option');
                    opt.value = mStr;
                    const [y, m] = mStr.split('-');
                    opt.innerText = `${y}년 ${m}월`;
                    filterSelect.appendChild(opt);
                });
                
                // Set default to current month
                if (currentSelectedValue && (currentSelectedValue === 'all' || sortedMonths.includes(currentSelectedValue))) {
                    filterSelect.value = currentSelectedValue;
                } else if (sortedMonths.includes(currentMonthStr)) {
                    filterSelect.value = currentMonthStr;
                } else {
                    filterSelect.value = 'all';
                }
            }
        }
        
        const selectedMonth = filterSelect ? filterSelect.value : currentMonthStr;
        
        // 5. Filter data by selected month
        // For completed quotes stats (Volume, cost, etc.): filter by payment completion date
        // For requested quotes (used for conversion rate denominator): filter by request date
        const completedQuotesInMonth = [];
        const requestedQuotesInMonth = [];
        
        allQuotes.forEach(q => {
            // Check request date for requested quotes
            const reqDate = getQuoteRequestDateObj(q);
            if (reqDate) {
                const reqMonthStr = formatDateToYYYYMM(reqDate);
                if (selectedMonth === 'all' || reqMonthStr === selectedMonth) {
                    requestedQuotesInMonth.push(q);
                }
            }
            
            // Check completed quotes
            if (q.status === '입금완료') {
                const paidDate = getQuotePaidDateObj(q);
                if (paidDate) {
                    const paidMonthStr = formatDateToYYYYMM(paidDate);
                    if (selectedMonth === 'all' || paidMonthStr === selectedMonth) {
                        completedQuotesInMonth.push({ ...q, _paidDateObj: paidDate, _reqDateObj: reqDate });
                    }
                }
            }
        });
        
        // 6. Calculate KPIs for selected month
        const volume = completedQuotesInMonth.length;
        let totalCost = 0;
        const brandCounts = {};
        const gradeCounts = {};
        const modelCounts = {};
        let totalDurationMs = 0;
        let durationCount = 0;
        
        completedQuotesInMonth.forEach(q => {
            totalCost += (q.price || 0);
            
            // Brand counts
            const brand = q.brand || '기타';
            brandCounts[brand] = (brandCounts[brand] || 0) + 1;
            
            // Grade counts
            let grade = (q.grade || '기타').toUpperCase();
            if (grade.includes('급')) grade = grade.replace('급', '');
            gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
            
            // Model counts
            const model = q.model || '알수없음';
            if (!modelCounts[model]) {
                modelCounts[model] = { count: 0, amount: 0 };
            }
            modelCounts[model].count++;
            modelCounts[model].amount += (q.price || 0);
            
            // Duration calculation
            if (q._paidDateObj && q._reqDateObj) {
                const diff = q._paidDateObj.getTime() - q._reqDateObj.getTime();
                if (diff >= 0 && diff < 30 * 24 * 60 * 60 * 1000) { // Limit to 30 days to filter out anomalous data
                    totalDurationMs += diff;
                    durationCount++;
                }
            }
        });
        
        const avgPrice = volume > 0 ? totalCost / volume : 0;
        const conversionRate = requestedQuotesInMonth.length > 0 ? (completedQuotesInMonth.length / requestedQuotesInMonth.length) * 100 : 0;
        const avgDurationDays = durationCount > 0 ? (totalDurationMs / durationCount) / (1000 * 60 * 60 * 24) : 0;
        
        // 7. Find Top Model
        let topModel = '-';
        let topModelCount = 0;
        for (const [m, stat] of Object.entries(modelCounts)) {
            if (stat.count > topModelCount) {
                topModelCount = stat.count;
                topModel = m;
            }
        }
        
        // 8. Update KPI Cards in UI
        const setInnerText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };
        
        setInnerText('stat-monthly-count-tab', `${volume} 대`);
        setInnerText('stat-monthly-amount-tab', `${new Intl.NumberFormat('ko-KR').format(totalCost)} 원`);
        setInnerText('stat-avg-price-tab', volume > 0 ? `${new Intl.NumberFormat('ko-KR').format(Math.round(avgPrice))} 원` : '-');
        setInnerText('stat-conversion-rate-tab', requestedQuotesInMonth.length > 0 ? `${conversionRate.toFixed(1)} %` : '0.0 %');
        setInnerText('stat-top-model-tab', topModel);
        setInnerText('stat-avg-duration-tab', durationCount > 0 ? `${avgDurationDays.toFixed(1)} 일` : '-');
        
        // 9. Update the main dashboard overview cards (for current month)
        // Find completed quotes specifically for the CURRENT month (June 2026) to show on the main tab
        let currentMonthVolume = 0;
        let currentMonthAmount = 0;
        allQuotes.forEach(q => {
            if (q.status === '입금완료') {
                const paidDate = getQuotePaidDateObj(q);
                if (paidDate && formatDateToYYYYMM(paidDate) === currentMonthStr) {
                    currentMonthVolume++;
                    currentMonthAmount += (q.price || 0);
                }
            }
        });
        const mainCountEl = document.getElementById('stat-monthly-count');
        if (mainCountEl) {
            mainCountEl.innerText = `${currentMonthVolume}건`;
            const prevEl = mainCountEl.previousElementSibling;
            if (prevEl && prevEl.tagName === 'H4') {
                prevEl.innerText = `${now.getMonth() + 1}월 매입완료 건수`;
            }
        }
        const mainAmountEl = document.getElementById('stat-monthly-amount');
        if (mainAmountEl) mainAmountEl.innerText = `${new Intl.NumberFormat('ko-KR').format(currentMonthAmount)}원`;
        
        // 10. Destroy existing charts to prevent overlaps
        if (chartDailyTrend) chartDailyTrend.destroy();
        if (chartBrandRatio) chartBrandRatio.destroy();
        if (chartGradeRatio) chartGradeRatio.destroy();
        
        // 11. Render Line Chart: Daily Trend
        let labelsDaily = [];
        let dataDaily = [];
        
        if (selectedMonth === 'all') {
            // For 'all', show trend by month instead of by day
            const monthCounts = {};
            sortedMonths.forEach(m => monthCounts[m] = 0);
            allQuotes.forEach(q => {
                if (q.status === '입금완료') {
                    const paidDate = getQuotePaidDateObj(q);
                    if (paidDate) {
                        const mStr = formatDateToYYYYMM(paidDate);
                        if (monthCounts[mStr] !== undefined) {
                            monthCounts[mStr]++;
                        }
                    }
                }
            });
            // Order months chronologically for chart display
            const chronMonths = Array.from(uniqueMonths).sort();
            labelsDaily = chronMonths.map(m => {
                const [y, mm] = m.split('-');
                return `${y.substring(2)}년 ${mm}월`;
            });
            dataDaily = chronMonths.map(m => monthCounts[m] || 0);
        } else {
            // For specific month, show day-by-day counts (1st to last day)
            const [yr, mn] = selectedMonth.split('-').map(Number);
            const daysInMonth = new Date(yr, mn, 0).getDate(); // Last day of month
            
            const dailyCounts = {};
            for (let d = 1; d <= daysInMonth; d++) {
                dailyCounts[d] = 0;
            }
            
            completedQuotesInMonth.forEach(q => {
                if (q._paidDateObj) {
                    const d = q._paidDateObj.getDate();
                    dailyCounts[d] = (dailyCounts[d] || 0) + 1;
                }
            });
            
            for (let d = 1; d <= daysInMonth; d++) {
                labelsDaily.push(`${d}일`);
                dataDaily.push(dailyCounts[d]);
            }
        }
        
        const ctxDaily = document.getElementById('chart-daily-trend');
        if (ctxDaily) {
            chartDailyTrend = new Chart(ctxDaily, {
                type: 'line',
                data: {
                    labels: labelsDaily,
                    datasets: [{
                        label: '매입 대수',
                        data: dataDaily,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.05)',
                        borderWidth: 2.5,
                        fill: true,
                        tension: 0.2,
                        pointBackgroundColor: '#2563eb',
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9' },
                            ticks: { precision: 0, stepSize: Math.max(1, Math.round(Math.max(...dataDaily) / 5)) }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }
        
        // 12. Render Doughnut Chart: Brand Ratio
        const ctxBrand = document.getElementById('chart-brand-ratio');
        if (ctxBrand) {
            const brandLabels = Object.keys(brandCounts);
            const brandData = Object.values(brandCounts);
            const brandDisplayLabels = brandLabels.map((b, idx) => {
                const totalVal = brandData.reduce((s, v) => s + v, 0);
                const pct = totalVal > 0 ? Math.round((brandData[idx] / totalVal) * 100) : 0;
                const name = b.toLowerCase() === 'apple' ? '애플' : (b.toLowerCase() === 'samsung' ? '삼성' : b);
                return `${name} (${brandData[idx]}대, ${pct}%)`;
            });
            
            chartBrandRatio = new Chart(ctxBrand, {
                type: 'doughnut',
                data: {
                    labels: brandDisplayLabels,
                    datasets: [{
                        data: brandData,
                        backgroundColor: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#cbd5e1'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 10,
                                padding: 12,
                                font: { size: 10, weight: '600' }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        }
        
        // 13. Render Doughnut Chart: Grade Ratio
        const ctxGrade = document.getElementById('chart-grade-ratio');
        if (ctxGrade) {
            const gradeLabels = Object.keys(gradeCounts);
            const gradeData = Object.values(gradeCounts);
            const gradeDisplayLabels = gradeLabels.map((g, idx) => {
                const totalVal = gradeData.reduce((s, v) => s + v, 0);
                const pct = totalVal > 0 ? Math.round((gradeData[idx] / totalVal) * 100) : 0;
                return `${g}급 (${gradeData[idx]}대, ${pct}%)`;
            });
            
            chartGradeRatio = new Chart(ctxGrade, {
                type: 'doughnut',
                data: {
                    labels: gradeDisplayLabels,
                    datasets: [{
                        data: gradeData,
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#94a3b8'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 10,
                                padding: 12,
                                font: { size: 10, weight: '600' }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        }
        
        // 14. Render Top 5 Models Table
        const modelStats = {};
        completedQuotesInMonth.forEach(q => {
            const m = q.model || '알수없음';
            if (!modelStats[m]) {
                modelStats[m] = { name: m, count: 0, amount: 0 };
            }
            modelStats[m].count++;
            modelStats[m].amount += (q.price || 0);
        });
        
        const sortedModels = Object.values(modelStats)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
            
        if (tableBody) {
            tableBody.innerHTML = '';
            if (sortedModels.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">해당 기간 매입 완료된 기기가 없습니다.</td></tr>';
            } else {
                sortedModels.forEach((m, idx) => {
                    const rank = idx + 1;
                    const avgModelPrice = m.count > 0 ? m.amount / m.count : 0;
                    
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #f1f5f9';
                    tr.innerHTML = `
                        <td style="padding: 12px 8px; font-weight: bold; color: ${rank <= 3 ? '#2563eb' : '#64748b'};">${rank}</td>
                        <td style="padding: 12px 8px; font-weight: 600; color: #1e293b;">${m.name}</td>
                        <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: #475569;">${m.count} 대</td>
                        <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #0f172a;">${new Intl.NumberFormat('ko-KR').format(m.amount)} 원</td>
                        <td style="padding: 12px 8px; text-align: right; color: #64748b;">${new Intl.NumberFormat('ko-KR').format(Math.round(avgModelPrice))} 원</td>
                    `;
                    tableBody.appendChild(tr);
                });
            }
        }
        
    } catch(e) {
        console.error("Statistics load error:", e);
        const tableBody = document.getElementById('stat-top-models-table-body');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">오류 발생: ${e.message}</td></tr>`;
        }
    }
};

// --- Demographic Charts ---
let genderChartInstance = null;
let ageChartInstance = null;

// 호출부는 (날짜, 전체여부, 기간종류) 3개를 넘기는데 예전엔 2개만 받아
// 본문에서 쓰는 typeVal이 정의되지 않아 성별·연령 통계가 통째로 실패했다.
window.renderDemographics = async (selectedDateString, showAll = false, typeVal = 'daily') => {
    try {
        const { getDocs, collection, query } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const q = query(collection(db, "quotes"));
        const querySnapshot = await getDocs(q);
        
        let maleCount = 0;
        let femaleCount = 0;
        let unknownGenderCount = 0;
        
        const ageGroups = {
            '10대 이하': 0,
            '20대': 0,
            '30대': 0,
            '40대': 0,
            '50대': 0,
            '60대 이상': 0,
            '미수집': 0
        };
        
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            // Date filtering
            let isMatch = false;
            if (showAll || typeVal === 'all') {
                isMatch = true;
            } else if (typeVal === '7days' || typeVal === '30days') {
                const daysCount = typeVal === '7days' ? 7 : 30;
                const dates = [];
                const nowMs = Date.now();
                const kstOffset = 9 * 60 * 60 * 1000;
                for (let i = daysCount - 1; i >= 0; i--) {
                    const d = new Date(nowMs + kstOffset - i * 24 * 60 * 60 * 1000);
                    dates.push(d.toISOString().split('T')[0]);
                }
                
                let docDateStr = '';
                if (data.firebaseTimestamp) {
                    const d = data.firebaseTimestamp.toDate();
                    const kstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                    docDateStr = kstDate.toISOString().split('T')[0];
                } else if (data.timestamp) {
                    const match = data.timestamp.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
                    if (match) {
                        const y = match[1];
                        const m = match[2].padStart(2, '0');
                        const d = match[3].padStart(2, '0');
                        docDateStr = `${y}-${m}-${d}`;
                    }
                }
                if (docDateStr && dates.includes(docDateStr)) {
                    isMatch = true;
                }
            } else if (selectedDateString) {
                if (data.firebaseTimestamp) {
                    const d = data.firebaseTimestamp.toDate();
                    const kstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                    const dateStr = kstDate.toISOString().split('T')[0];
                    if (dateStr === selectedDateString) isMatch = true;
                } else if (data.timestamp) {
                    const [y, m, d] = selectedDateString.split('-');
                    const formattedPart = `${parseInt(y)}. ${parseInt(m)}. ${parseInt(d)}.`;
                    if (data.timestamp.includes(formattedPart) || data.timestamp.includes(selectedDateString)) {
                        isMatch = true;
                    }
                }
            }
            
            if (isMatch) {
                // Gender aggregation
                const gender = data.gender;
                if (gender === '남성') maleCount++;
                else if (gender === '여성') femaleCount++;
                else unknownGenderCount++;
                
                // Age aggregation
                const ageGrp = data.ageGroup;
                if (ageGrp && ageGroups[ageGrp] !== undefined) {
                    ageGroups[ageGrp]++;
                } else {
                    ageGroups['미수집']++;
                }
            }
        });
        
        // --- 1. 성별 파이 차트 ---
        const genderCtx = document.getElementById('gender-chart');
        if (genderCtx && typeof Chart !== 'undefined') {
            if (genderChartInstance) genderChartInstance.destroy();
            
            const totalGender = maleCount + femaleCount + unknownGenderCount;
            const malePct = totalGender > 0 ? Math.round((maleCount / totalGender) * 100) : 0;
            const femalePct = totalGender > 0 ? Math.round((femaleCount / totalGender) * 100) : 0;
            const unknownPct = totalGender > 0 ? Math.round((unknownGenderCount / totalGender) * 100) : 0;

            genderChartInstance = new Chart(genderCtx, {
                type: 'doughnut',
                data: {
                    labels: [`남성 (${maleCount}명, ${malePct}%)`, `여성 (${femaleCount}명, ${femalePct}%)`, `미확인 (${unknownGenderCount}명, ${unknownPct}%)`],
                    datasets: [{
                        data: [maleCount, femaleCount, unknownGenderCount],
                        backgroundColor: ['#3b82f6', '#ec4899', '#cbd5e1'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: { size: 11, weight: '600' }
                            }
                        }
                    },
                    cutout: '65%'
                }
            });
        }
        
        // --- 2. 연령대 바 차트 ---
        const ageCtx = document.getElementById('age-chart');
        if (ageCtx && typeof Chart !== 'undefined') {
            if (ageChartInstance) ageChartInstance.destroy();
            
            const ageLabels = Object.keys(ageGroups);
            const ageData = Object.values(ageGroups);
            
            ageChartInstance = new Chart(ageCtx, {
                type: 'bar',
                data: {
                    labels: ageLabels,
                    datasets: [{
                        label: '신청 수 (명)',
                        data: ageData,
                        backgroundColor: '#10b981',
                        borderRadius: 6,
                        barThickness: 20
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 11, weight: '600' } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9' },
                            ticks: { precision: 0 }
                        }
                    }
                }
            });
        }
        
    } catch(e) {
        console.error('Failed to load demographics:', e);
    }
};

window.filterQuotes = function() {
    const input = document.getElementById('quote-search-input');
    if (!input) return;
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById('quotes-table-body');
    if (!tbody) return;
    const trs = tbody.getElementsByTagName('tr');
    
    let visibleInSection = 0;
    let currentDivider = null;
    
    for (let i = 0; i < trs.length; i++) {
        const tr = trs[i];
        const isDivider = tr.querySelector('td[colspan="7"]') !== null || tr.querySelector('td[colspan="8"]') !== null;
        
        if (isDivider) {
            const textContent = tr.textContent;
            if (textContent.includes("신청이 없습니다") || textContent.includes("로딩 중") || textContent.includes("실패")) {
                continue;
            }
            if (currentDivider) {
                currentDivider.style.display = visibleInSection > 0 ? '' : 'none';
            }
            currentDivider = tr;
            visibleInSection = 0;
        } else {
            const text = tr.textContent.toLowerCase();
            if (text.includes(filter)) {
                tr.style.display = '';
                visibleInSection++;
            } else {
                tr.style.display = 'none';
            }
        }
    }
    if (currentDivider) {
        currentDivider.style.display = visibleInSection > 0 ? '' : 'none';
    }
};
