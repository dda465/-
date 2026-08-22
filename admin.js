import { db, auth, getStorageLazy } from './firebase-config.js';
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyHEgJMYpYvWV2y7ShTjq8AsOGvxwe1zLZ4UUJ76qdz_2i0d_DDHtGBKcOErI8c7pvQ/exec";
import { collection, getDocs, getDoc, query, orderBy, limit, doc, updateDoc, setDoc, deleteDoc, deleteField, writeBatch, serverTimestamp, addDoc, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
// 미집하 구역 펼침 상태 — loadQuotes() 를 다시 돌려도 유지된다.
// (여러 건을 연달아 처리하는 구역이라, 한 건 고칠 때마다 접히면 매우 불편하다)
let _pfOpen = false;

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
            // 일괄 수거예약 대상인지 — 방문수거이고, 아직 예약 안 됐고, 우편번호가 있는 건만 true
            let gfBookable = false;
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
                gfBookable = false;   // 이 건이 일괄 예약 대상인지 (아래에서 tr 에 표식으로 붙는다)
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
                    // ★ 일괄 예약 대상. 여기 걸리는 건만 '예약가능 전체선택' 과
                    //   '선택 수거예약' 이 잡는다. 이미 예약됐거나 우편번호가 없는 건은 제외된다.
                    //   (표식은 아래에서 tr 을 만든 뒤 붙인다 — 여기선 tr 이 아직 없다)
                    gfBookable = true;
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
            // 배송비 입금 버튼 — 2026-08-02 착불 전환 이전 접수 건에만 보인다.
            // 그 이전 고객은 '택배비 입금받기'로 접수해 선입금을 기다리고 있으므로 정산이 필요하고,
            // 이후 접수 건은 착불이라 입금할 것이 없다. 날짜로 갈라 옛 건 정산만 계속 처리한다.
            const CVS_COD_START = new Date('2026-08-02T00:00:00+09:00');
            const _qTime = _toDateForList(data.firebaseTimestamp) || _toDateForList(data.submittedAt);
            const isPrepaidEra = !_qTime || _qTime < CVS_COD_START;
            if (data.deliveryMethod === 'cvs') {
                // 배송비 버튼은 착불 전환 이전 건에만 — 이후 건은 입금할 것이 없다.
                if (isPrepaidEra) {
                    if (data.shippingFeePaid) {
                        feePaidBtn = `<br><button class="action-btn" style="background:#E8F5E9; color:#2E7D32; border-color:#81C784; margin-top:5px; width: 100%;" onclick="toggleShippingFee('${id}', false)">배송비 입금됨 ✓</button>`;
                    } else {
                        feePaidBtn = `<br><button class="action-btn" style="background:#FFF; color:#E65100; border-color:#FFB74D; margin-top:5px; width: 100%;" onclick="toggleShippingFee('${id}', true)">배송비 입금확인</button>`;
                    }
                } else {
                    feePaidBtn = `<br><span style="font-size:0.7rem; background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; padding:2px 7px; border-radius:4px; display:inline-block; margin-top:5px; font-weight:700;">착불 발송 건</span>`;
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
            // 일괄 수거예약 대상 표식 — '예약가능 전체선택' 과 '선택 수거예약' 이 이걸로 잡는다
            if (gfBookable) tr.dataset.gfBookable = '1';
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
                    //
                    // ⚠️ 미집하 안내는 폴러(goodsflowPoller)가 30분마다 자동 발송한다.
                    //    다만 자동이 못 잡는 경우가 있어 수동 발송 버튼을 같이 둔다.
                    //      · 고객이 "못 받았다"고 전화한 경우
                    //      · 발송이 3회 실패해 중단된 건 (pickupFailedNotifyTries >= 3)
                    //      · 7월처럼 표시만 남고 실제로는 안 나간 옛 건
                    //    이미 보낸 건이면 마지막 발송 시각을 같이 보여준다. 숨기면 재발송을 못 한다.
                    const _pfAt = _toDateForList(data.pickupFailedNotifiedAt);
                    const _pfTries = Number(data.pickupFailedNotifyTries || 0);
                    let _pfLabel = '📮 미집하 안내 발송';
                    let _pfSub = '';
                    if (_pfAt) {
                        const _m = String(_pfAt.getMonth() + 1), _d = String(_pfAt.getDate());
                        const _hh = String(_pfAt.getHours()).padStart(2, '0');
                        const _mi = String(_pfAt.getMinutes()).padStart(2, '0');
                        _pfLabel = '📮 다시 보내기';
                        _pfSub = `<br><span style="font-size:0.68rem; color:#78909C;">${_m}/${_d} ${_hh}:${_mi} 발송됨</span>`;
                    } else if (_pfTries > 0) {
                        _pfSub = `<br><span style="font-size:0.68rem; color:#C62828;">자동 발송 ${_pfTries}회 실패</span>`;
                    }
                    // 3번째 칸이 고객명이다 (1 체크박스 · 2 신청일시 · 3 고객명).
                    // 계약서 독촉 버튼도 같은 칸에 붙는다 — 490줄
                    const _pfCell = tr.querySelector('td:nth-child(3)');
                    if (_pfCell) {
                        _pfCell.insertAdjacentHTML('beforeend',
                            `<br><button onclick="sendPickupFailedNotice('${id}')" style="font-size:0.72rem; background:#FEE500; color:#391B1B; padding:3px 9px; border-radius:4px; margin-top:5px; border:none; font-weight:bold; cursor:pointer;">${_pfLabel}</button>${_pfSub}`);
                    }
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
            // ⚠️ 펼침 상태를 모듈 변수(_pfOpen)에 둔다.
            //    예전엔 이 함수 안의 지역변수라, 한 건 취소할 때마다 loadQuotes()가 다시 돌면서
            //    목록이 접혀 매번 다시 펼쳐야 했다. 미집하는 여러 건을 연달아 처리하는 구역이라
            //    이게 실제로 가장 불편한 지점이었다.
            const dividerFailed = document.createElement('tr');
            dividerFailed.style.cursor = 'pointer';
            dividerFailed.innerHTML = `<td colspan="8" style="background: #FFEBEE; text-align: center; font-weight: bold; padding: 12px; color: #C62828; border-bottom: 2px solid #FFCDD2; font-size: 1.05rem;">
                <span id="pf-toggle-icon">${_pfOpen ? '▼' : '▶'}</span> ⚠️ 미집하 — 기사 방문했으나 수거 실패 (고객 연락 필요) (${pickupFailedRows.length}건)
                <span style="font-size:0.8rem; font-weight:normal; color:#a13; margin-left:6px;">${_pfOpen ? '클릭하여 접기' : '클릭하여 펼치기'}</span>
            </td>`;
            quotesTableBody.appendChild(dividerFailed);

            // 일괄 작업 줄 — 펼쳤을 때만 보인다
            const pfBulk = document.createElement('tr');
            pfBulk.className = 'pf-bulk';
            pfBulk.style.display = _pfOpen ? '' : 'none';
            pfBulk.innerHTML = `<td colspan="8" style="background:#FFF8F8; padding:8px 12px; border-bottom:1px solid #FFCDD2;">
                <label style="font-size:0.82rem; cursor:pointer; user-select:none;">
                    <input type="checkbox" onclick="togglePickupFailedAll(this)"> 전체 선택
                </label>
                <span id="pf-selected-count" style="font-size:0.8rem; color:#78909C; margin-left:10px;"></span>
                <button onclick="bulkCancelPurchase()" style="font-size:0.76rem; background:#dc2626; color:#fff; border:none; padding:4px 11px; border-radius:5px; margin-left:12px; cursor:pointer; font-weight:bold;">선택 매입취소</button>
                <span style="font-size:0.74rem; color:#B71C1C; margin-left:10px; font-weight:600;">⚠️ 미집하 건은 홈픽에서 별도로 취소 요청해야 합니다 (48시간 뒤 처리)</span>
            </td>`;
            quotesTableBody.appendChild(pfBulk);

            pickupFailedRows.sort(_byDisplayTimeDesc);
            pickupFailedRows.forEach(tr => {
                tr.style.display = _pfOpen ? '' : 'none';
                tr.classList.add('pf-row');
                quotesTableBody.appendChild(tr);
            });

            dividerFailed.onclick = () => {
                _pfOpen = !_pfOpen;
                pickupFailedRows.forEach(tr => { tr.style.display = _pfOpen ? '' : 'none'; });
                pfBulk.style.display = _pfOpen ? '' : 'none';
                const ic = document.getElementById('pf-toggle-icon');
                if (ic) ic.textContent = _pfOpen ? '▼' : '▶';
                const hint = dividerFailed.querySelector('td span:last-child');
                if (hint) hint.textContent = _pfOpen ? '클릭하여 접기' : '클릭하여 펼치기';
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
                    <span style="display:flex; gap:6px; align-items:center;">
                        <label style="font-size:0.75rem; cursor:pointer; user-select:none; color:#2E7D32; font-weight:600;">
                            <input type="checkbox" onclick="toggleCourierBookableAll(this)"> 예약가능 전체선택
                        </label>
                        <span id="gf-selected-count" style="font-size:0.75rem; color:#558B2F;"></span>
                        <button onclick="bulkBookGoodsflowPickup(this)" title="선택한 건을 한 번에 수거예약합니다" style="background:#1565C0; color:white; border:none; padding:5px 12px; border-radius:6px; font-weight:bold; font-size:0.75rem; cursor:pointer;">🚚 선택 수거예약</button>
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
let _returnedPhoneCounts = null;  // 번호 → 반송 건수 (요약 문서에서만 채워짐)

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
    // 뱃지에 올렸을 때 뜨는 설명.
    // 같은 번호의 다른 신청을 '기종 · 시각 · 간격'까지 보여줘야 담당자가 바로 판단한다.
    //  · 같은 기종 + 몇 분 차이  → 접수된 줄 모르고 다시 누른 경우가 대부분
    //  · 기종이 다르거나 하루 차이 → 폰 여러 대를 파는 정상 접수
    const buildDupTip = (me, others) => {
        if (!others.length) return '';
        const fmt = (d) => d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '시각미상';
        const gap = (a, b) => {
            if (!a || !b) return '';
            const m = Math.abs(a - b) / 60000;
            if (m < 60) return `${Math.round(m)}분 차이`;
            if (m < 1440) return `${Math.round(m / 60)}시간 차이`;
            return `${Math.round(m / 1440)}일 차이`;
        };
        const lines = others.map(o => {
            const same = me && o.model === me.model ? ' ※같은 기종' : '';
            const g = me ? gap(me.at, o.at) : '';
            return `· ${fmt(o.at)}  ${o.model}  ${o.status}${g ? '  (' + g + ')' : ''}${same}`;
        });
        return `같은 번호로 진행 중인 다른 신청 ${others.length}건\n\n${lines.join('\n')}\n\n`
            + `같은 기종이고 시간 차이가 짧으면 접수된 줄 모르고 다시 누른 경우일 수 있습니다.\n`
            + `기종이 다르면 여러 대를 판매하시는 정상 접수입니다.`;
    };

    const render = (els, paidCount, activeCount, returnedCount, dup) => {
        if (!paidCount && !activeCount && !returnedCount) return;
        let html = '';
        if (paidCount) {
            html += `<span title="과거 입금완료 ${paidCount}건 — 재거래 고객" style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:10px; background:#FFF3E0; color:#E65100; border:1px solid #FFCC80; font-size:0.7rem; font-weight:700; vertical-align:middle;">재방문${paidCount > 1 ? ' ' + paidCount : ''}</span>`;
        }
        // 반송 이력 — 지난번 검수가에 동의하지 않았던 고객.
        // 검수·안내에 더 신경 써야 하므로 재거래와 구분해서 보여준다.
        if (returnedCount) {
            html += `<span title="과거 반송 ${returnedCount}건 — 지난번 매입가에 동의하지 않으셨던 고객입니다. 검수 안내에 유의하세요." style="display:inline-block; margin-left:4px; padding:1px 6px; border-radius:10px; background:#EEF2FF; color:#4338CA; border:1px solid #C7D2FE; font-size:0.7rem; font-weight:700; vertical-align:middle;">반송이력${returnedCount > 1 ? ' ' + returnedCount : ''}</span>`;
        }
        if (activeCount) {
            // 같은 기종이 섞였으면 빨강(확인 필요), 기종이 다르면 회색(정상 다건 접수)
            const same = dup && dup.sameModel;
            const tip = (dup && dup.tip) || `같은 연락처로 진행 중인 다른 신청이 ${activeCount}건 있습니다.`;
            const style = same
                ? 'background:#FEE2E2; color:#B91C1C; border:1px solid #FCA5A5;'
                : 'background:#F1F5F9; color:#475569; border:1px solid #CBD5E1;';
            const label = same ? `같은기종 ${activeCount}` : `여러대 ${activeCount}`;
            html += `<span title="${String(tip).replace(/"/g, '&quot;')}" style="display:inline-block; margin-left:4px; padding:1px 6px; border-radius:10px; ${style} font-size:0.7rem; font-weight:700; vertical-align:middle; cursor:help;">${label}</span>`;
        }
        els.forEach(el => { el.innerHTML = html; });
    };

    const _rt0 = performance.now();

    // ★ 예전엔 화면에 뜬 번호를 5개씩 묶어 22번씩 조회했다(≈950ms).
    //   입금완료 건은 많아야 수백 건이므로 '한 번만' 통째로 읽어 번호 집합을 만들고
    //   그 뒤로는 메모리에서 대조한다. 왕복 22회 → 1회.
    //   집합은 세션 동안 재사용하므로 탭을 오가도 다시 조회하지 않는다.
    try {
        // ── 1순위: 미리 세어둔 요약 문서 1건만 읽는다 ──────────────────
        //   stats/returning_customers 에 번호별 { paid, returned, canceled } 가 들어 있다.
        //   서버(Cloud Functions)가 매입완료·반송·취소 때마다 갱신하므로 항상 최신이다.
        //   문서 1건이라 수십 ms면 끝나고, 매입이 쌓여도 느려지지 않는다.
        if (!_paidPhoneCounts) {
            try {
                const rcSnap = await getDoc(doc(db, 'stats', 'returning_customers'));
                if (rcSnap.exists()) {
                    const counts = rcSnap.data().counts || {};
                    _paidPhoneCounts = new Map();
                    _returnedPhoneCounts = new Map();
                    for (const p in counts) {
                        const c = counts[p] || {};
                        if (c.paid) _paidPhoneCounts.set(p, c.paid);
                        if (c.returned) _returnedPhoneCounts.set(p, c.returned);
                    }
                    // 요약표에는 '어느 문서였는지'가 없으므로, 화면에 뜬 자기 자신을 빼는 보정은
                    // 아래 집계에서 상태값으로 대신 처리한다.
                    _paidDocIdsByPhone = null;
                    console.log(`[성능] 재방문 요약표 사용 ${Math.round(performance.now() - _rt0)}ms / 번호 ${_paidPhoneCounts.size}개`);
                } else {
                    console.warn('[재방문표] 요약 문서(stats/returning_customers)가 아직 없습니다. ' +
                        'admin_rc_backfill.html 에서 ② 저장하기를 실행하세요. 지금은 기존 방식으로 동작합니다.');
                }
            } catch (e) {
                console.warn('[재방문표] 요약 문서 읽기 실패 — 기존 방식으로 진행합니다:', e && e.message);
            }
        }

        // ── 2순위(안전망): 요약 문서가 아직 없으면 예전 방식으로 계산 ──
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
            // ★ 속도 개선 (2026-08)
            //   예전: where(status=="입금완료") 만 걸고 전체를 훑었다 → 554건에 6~77초.
            //   측정해 보니 '정렬 없이 훑는 조회'가 건당 13배 느렸다.
            //   (건수만 세기 95ms / 정렬+제한 300건 272ms / 정렬없이 554건 6,742ms)
            //   orderBy 를 붙이면 이미 만들어 둔 색인(status + firebaseTimestamp)을 타서 빨라진다.
            //   limit 으로 상한을 둬, 매입이 쌓여도 이 조회가 계속 무거워지지 않게 한다.
            const PAID_SCAN_LIMIT = 600;   // 최근 매입완료 600건 기준으로 재방문 판별
            const snap = await getDocs(query(
                collection(db, "quotes"),
                where("status", "==", "입금완료"),
                orderBy("firebaseTimestamp", "desc"),
                limit(PAID_SCAN_LIMIT)
            ));
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
        // 번호 → [{ id, model, at }] — 뱃지에 기종·시각을 함께 보여주기 위해 내용까지 담는다.
        //
        // ★ 왜 내용이 필요한가
        //   같은 번호로 2건이 있어도 '실수로 두 번 누른 것'과 '폰 두 대를 파는 것'은
        //   데이터만으로 구분할 수 없다. 같은 기종 두 대를 보내는 고객도 실제로 있다.
        //   그래서 판단은 담당자가 하고, 시스템은 판단에 필요한 정보(기종·간격)만 보여준다.
        //   뱃지에 마우스를 올리면 각 건이 뜨므로 목록에서 바로 판단할 수 있다.
        const activeByPhone = new Map();
        try {
            const aSnap = await getDocs(query(collection(db, "quotes"), where("status", "not-in", TERMINAL_FOR_LIST)));
            aSnap.forEach(d => {
                const v = d.data();
                if (v.isDeleted) return;
                if (v.isForeigner === true || v.method === 'foreigner' || v.series === 'Foreigner') return;
                const key = String(v.customerPhone || '').replace(/\D/g, '');
                if (key.length < 9) return;
                if (!activeByPhone.has(key)) activeByPhone.set(key, []);
                activeByPhone.get(key).push({
                    id: d.id,
                    model: `${v.brand || ''} ${v.model || ''}`.trim() || '기종미상',
                    at: _toDateForList(v.submittedAt) || _toDateForList(v.firebaseTimestamp),
                    status: v.status || ''
                });
            });
        } catch (e) {
            console.warn('진행중 중복 조회 실패:', e && e.message);
        }

        byPhone.forEach((els, p) => {
            // 재방문 — 과거 입금완료 건수 (화면에 뜬 그 건 자신은 제외)
            // 요약 문서를 쓸 땐 _paidDocIdsByPhone 이 없다(문서ID를 담지 않으므로).
            // 뱃지는 '진행중' 목록에만 붙어 그 행 자체가 입금완료일 수 없으니 보정이 필요 없다.
            let paid = _paidPhoneCounts.get(p) || 0;
            const paidIds = _paidDocIdsByPhone ? _paidDocIdsByPhone.get(p) : null;
            if (paidIds) els.forEach(el => { if (paidIds.has(el.getAttribute('data-self'))) paid--; });

            // 반송 이력 — 요약 문서가 있을 때만 채워진다
            const returned = _returnedPhoneCounts ? (_returnedPhoneCounts.get(p) || 0) : 0;

            // 진행중 — 같은 번호로 살아있는 '다른' 신청 수.
            // ⚠ 예전엔 화면에 뜬 같은 번호 행들을 한꺼번에 selfIds 로 묶어 빼버렸다.
            //   그래서 중복 접수 두 건이 둘 다 목록에 보이면 남는 게 0이 되어
            //   정작 확인이 가장 필요한 경우에 뱃지가 안 떴다.
            //   각 행 기준으로 '자기 자신만' 빼고 세야 서로를 가리킨다.
            const actList = activeByPhone.get(p) || [];

            els.forEach(el => {
                const selfId = el.getAttribute('data-self');
                const others = actList.filter(x => x.id !== selfId);
                const me = actList.find(x => x.id === selfId);

                // 같은 기종이 섞여 있으면 '실수로 두 번' 가능성이 높아 색을 달리한다.
                // 다만 같은 기종 두 대를 파는 고객도 있어 단정하지 않고 색으로만 힌트를 준다.
                const sameModel = me ? others.some(x => x.model === me.model) : false;
                const tip = buildDupTip(me, others);

                render([el], Math.max(0, paid), others.length, returned, { sameModel, tip });
            });
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
${data.isWithdrawn === true
    ? `<span style="font-size:0.78rem; color:#94a3b8;">탈퇴됨</span>`
    : `<button class="action-btn" onclick="withdrawUser('${doc.id}', '${String(data.nickname || data.email || '').replace(/'/g, "\\'")}')" style="color:#2563eb;">탈퇴 처리</button>`}
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

// ════════════════════════════════════════════════════════════════
// 회원 탈퇴 처리 — ⚠️ 아래 deleteUser(완전삭제)와 **다른 것이다**
// ════════════════════════════════════════════════════════════════
//
//   탈퇴 처리   문서를 남기고 개인정보만 비운다. 거래 이력이 유지된다  ← 정상 절차
//   완전 삭제   문서를 통째로 지운다. 과거 매입 건과 연결이 끊긴다     ← 예외 상황용
//
// ⚠️ 고객이 "탈퇴해 달라"고 요청한 경우는 **탈퇴 처리**가 맞다.
//    mypage.html 1456줄의 고객 셀프 탈퇴와 같은 결과를 만든다.
//
// ⚠️ 이 버튼이 필요한 이유 —
//    보안 규칙이 `kakao_*` 만 셀프 탈퇴를 허용하고 있어서
//    **네이버 회원(`naver_*`)은 마이페이지에서 탈퇴가 거부된다** (auth.js 607줄).
//    규칙을 고치기 전까지는 여기서 대신 처리한다.
window.withdrawUser = async (userId, label) => {
    const who = label || userId;
    if (!confirm(
        `${who} 회원을 탈퇴 처리하시겠습니까?\n\n` +
        `· 이름·연락처·이메일·닉네임·주소를 비웁니다\n` +
        `· 매입 거래 이력은 그대로 남습니다\n\n` +
        `되돌릴 수 없습니다.`
    )) return;

    try {
        await updateDoc(doc(db, "users", userId), {
            isWithdrawn: true,
            withdrawnAt: new Date(),
            // 개인정보 파기 — 고객 셀프 탈퇴와 같은 항목을 비운다
            name: "",
            nickname: "",
            phone: "",
            phoneNumber: "",
            email: "",
            address: "",
            profileImage: "",
            // 누가 처리했는지 남긴다 (고객이 셀프로 한 것과 구분)
            withdrawnBy: document.getElementById('admin-email')?.textContent || 'admin'
        });
        alert("탈퇴 처리되었습니다.");
        loadUsers();
    } catch (e) {
        console.error("탈퇴 처리 실패:", e);
        alert("탈퇴 처리 실패: " + e.message);
    }
};

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

// ===================================================================
// 방문수거 일괄 예약
// -------------------------------------------------------------------
// 방문수거 건이 하루 200건이 넘어가면서 하나씩 누르는 게 불가능해졌다.
//
// ⚠️ 예약은 실제로 돈이 나가는 요청이고 취소가 자유롭지 않다.
//    그래서 '전체 선택' 은 **예약 가능한 건만** 잡는다.
//    이미 예약된 건 · 우편번호 없는 건은 애초에 선택되지 않는다.
// ===================================================================

/** 예약 가능한 행의 체크박스만 (tr.dataset.gfBookable 이 붙은 행) */
function _gfBookableCheckboxes() {
    return Array.from(document.querySelectorAll('tr[data-gf-bookable="1"] .quote-checkbox'));
}

function _gfUpdateCount() {
    const el = document.getElementById('gf-selected-count');
    if (!el) return;
    const n = _gfBookableCheckboxes().filter(cb => cb.checked).length;
    el.textContent = n > 0 ? `${n}건 선택` : '';
}

window.toggleCourierBookableAll = (source) => {
    _gfBookableCheckboxes().forEach(cb => { cb.checked = source.checked; });
    _gfUpdateCount();
};

// 개별 체크에도 숫자가 따라오게
document.addEventListener('change', (e) => {
    if (e.target && e.target.classList?.contains('quote-checkbox')) _gfUpdateCount();
});

window.bulkBookGoodsflowPickup = async (btn) => {
    const ids = _gfBookableCheckboxes().filter(cb => cb.checked).map(cb => cb.value).filter(Boolean);
    if (ids.length === 0) {
        alert("선택된 건이 없습니다.\n\n예약 가능한 건(🚚 수거 예약 버튼이 있는 건)만 선택됩니다.\n이미 예약됐거나 우편번호가 없는 건은 제외됩니다.");
        return;
    }
    if (!confirm(`선택한 ${ids.length}건의 방문수거를 굿스플로에 예약합니다.\n\n⚠️ 실제 기사 배차가 발생하고 건당 배송비가 나갑니다.\n취소가 자유롭지 않으니 건수를 확인해 주세요.\n\n계속할까요?`)) return;

    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; }

    let ok = 0;
    const shifted = [];   // 희망일로 접수가 안 돼 날짜가 밀린 건 — 고객 안내가 필요하다
    const fails = [];

    for (let i = 0; i < ids.length; i++) {
        if (btn) btn.textContent = `예약 중… ${i + 1}/${ids.length}`;
        const id = ids[i];
        try {
            const res = await fetch(GOODSFLOW_API + "/createOrder", {
                method: "POST",
                headers: await gfAuthHeader(),
                body: JSON.stringify({ quoteId: id })
            });
            const out = await res.json().catch(() => ({ ok: false, error: "응답을 해석할 수 없습니다." }));
            if (!res.ok || !out.ok) { fails.push(`${id.slice(0, 6)}… ${out.error || `오류 ${res.status}`}`); continue; }
            ok++;
            // 지난 날짜·일요일·공휴일이면 서버가 다음 가능일로 민다.
            // 조용히 넘어가면 고객이 원래 날짜에 기다리다 문의가 들어온다.
            if (out.dateShifted) {
                shifted.push(`· 희망 ${out.customerWanted || '미지정'} → ${out.pickupRequestDateTime}`);
            }
        } catch (e) {
            fails.push(`${id.slice(0, 6)}… ${e.message}`);
        }
    }

    if (btn) { btn.disabled = false; btn.textContent = orig || '🚚 선택 수거예약'; }

    let msg = `수거예약 ${ok}건 완료`;
    if (shifted.length > 0) {
        msg += `\n\n⚠️ 아래 ${shifted.length}건은 희망일로 접수할 수 없어 날짜가 밀렸습니다.\n`
             + `고객에게 변경된 날짜를 안내해 주세요.\n\n` + shifted.join('\n');
    }
    if (fails.length > 0) msg += `\n\n실패 ${fails.length}건:\n${fails.join('\n')}`;
    alert(msg);
    loadQuotes();
};

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
    // ⚠️ 미집하 건은 이미 택배사로 이관돼서, API 는 '취소됨' 으로 응답하지만
    //    홈픽에는 그대로 남는다. 우리 화면만 취소로 바뀌고 기사는 계속 간다.
    //    그래서 미집하 건이면 눌러도 소용없다는 걸 먼저 알려준다.
    if (!force) {
        let isPickupFailed = false;
        try {
            const snap = await getDoc(doc(db, "quotes", id));
            isPickupFailed = snap.exists() && snap.data().goodsflowAlert === 'PICKUP_FAILED';
        } catch (e) { /* 조회 실패해도 아래 기본 확인창으로 진행 */ }

        if (isPickupFailed) {
            alert("미집하 건은 여기서 취소되지 않습니다.\n\n"
                + "이미 택배사로 이관된 상태라, 취소해도 화면만 바뀌고 홈픽에는 그대로 남습니다.\n"
                + "기사 방문을 막으려면 홈픽 페이지에서 직접 취소를 요청해 주세요. (48시간 뒤 처리)");
            return;
        }
        if (!confirm("굿스플로 수거 예약을 취소합니다. 진행할까요?")) return;
    }
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
    if (tabName === 'statistics') window.loadStatistics();
    if (tabName === 'users') loadUsers();
    if (tabName === 'blacklist') loadBlacklist();
    if (tabName === 'chat') fetchChatSessions();
    if (tabName === 'trash') loadTrash();
    if (tabName === 'analytics') window.loadFunnelData();
    if (tabName === 'popup' && typeof window.loadPopupSettings === 'function') window.loadPopupSettings();
    if (tabName === 'settings' && typeof window.loadGeneralSettings === 'function') window.loadGeneralSettings();
    if (tabName === 'reconcile') window.runReconciliation();
    if (tabName === 'pickup-notice') window.loadPickupNotice();
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
                { key: 'exit_channeltalk', label: '고객센터 문의 클릭 (구 채널톡)' },
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



                // ⚠️ 액정 값이 두 가지 형태다.
                //      현재: 'no'(없음) · 'light'(줄·멍) · 'heavy'(완전 안 보임)
                //      과거: true / false (불리언)
                //    예전엔 `=== true` 로만 비교해서, 지금 들어오는 문자열 값은
                //    **파손이어도 화면에 아예 안 떴다.**
                //    반대로 `d.lcd_damage ?` 로 쓰면 'no'(없음)가 참이라 뒤집힌다.
                const _lcd = d.lcd_damage;
                if (_lcd === true || _lcd === 'light' || _lcd === 'heavy') {

                    const _lcdText = _lcd === 'light' ? '있음 (줄·멍)'
                                   : _lcd === 'heavy' ? '있음 (완전 안 보임)'
                                   : '있음 (줄/멍/파손)';
                    defectsHtml += `<li style="color:red;"><strong>LCD 손상:</strong> ${_lcdText}</li>`;

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
// 2026-08 교체 (이전: KA01TP2606022004288667NGejVJlt9L)
// 새 템플릿은 치환 변수가 없어 고정 문구로 발송된다.
const CVS_ALIMTALK_TEMPLATE_ID = "KA01TP260728070417812B8ANssPJatL";

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
                // 새 템플릿은 치환 변수가 없다.
                // 템플릿에 없는 변수를 보내면 솔라피가 거부할 수 있어 빈 값으로 보낸다.
                variables: {}
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

// ===================================================================
// 미집하 — 일괄 처리
// -------------------------------------------------------------------
// 미집하는 여러 건을 연달아 처리하는 구역이다. 하나씩 누르면 오래 걸린다.
//
// 두 가지는 뜻이 다르다.
//   예약취소 — 굿스플로 수거 예약만 취소. 신청건은 살아 있다 (재예약 가능)
//   매입취소 — 신청 자체를 '취소' 로. 굿스플로 예약도 같이 취소된다
// ===================================================================

/** 미집하 구역의 체크박스만 모은다 (다른 구역까지 건드리면 안 된다) */
function _pfCheckedIds() {
    return Array.from(document.querySelectorAll('tr.pf-row .quote-checkbox:checked'))
        .map(cb => cb.value)
        .filter(Boolean);
}

function _pfUpdateCount() {
    const el = document.getElementById('pf-selected-count');
    if (!el) return;
    const n = _pfCheckedIds().length;
    el.textContent = n > 0 ? `${n}건 선택됨` : '';
}

window.togglePickupFailedAll = (source) => {
    document.querySelectorAll('tr.pf-row .quote-checkbox').forEach(cb => { cb.checked = source.checked; });
    _pfUpdateCount();
};

// 개별 체크에도 숫자가 따라오게 (미집하 구역만)
document.addEventListener('change', (e) => {
    if (e.target && e.target.classList?.contains('quote-checkbox') && e.target.closest('tr.pf-row')) {
        _pfUpdateCount();
    }
});

/** 선택한 건들을 '취소' 상태로 — 굿스플로 예약도 함께 취소된다 */
window.bulkCancelPurchase = async () => {
    const ids = _pfCheckedIds();
    if (ids.length === 0) { alert("선택된 건이 없습니다."); return; }
    if (!confirm(`선택한 ${ids.length}건을 매입취소 처리합니다.\n\n신청건이 '취소' 상태가 되고, 굿스플로 수거 예약도 함께 취소됩니다.\n계속할까요?`)) return;

    let ok = 0;
    const fails = [];
    const needHomepick = [];   // 홈픽에서 손으로 취소해야 하는 건
    for (const id of ids) {
        try {
            const ref = doc(db, "quotes", id);
            const snap = await getDoc(ref);
            const data = snap.exists() ? snap.data() : {};

            await updateDoc(ref, { status: '취소' });
            ok++;

            // ⚠️ 굿스플로 API 취소를 여기서 부르지 않는다.
            //    미집하 건은 이미 택배사로 이관돼서, API 는 '취소됨' 으로 응답하지만
            //    홈픽에는 그대로 남는다. 우리는 끝난 줄 알고 손을 떼는데 기사는 계속 간다.
            //    → 취소는 홈픽에서 직접 요청해야 하고, 48시간 뒤에 처리된다.
            //    자동으로 처리할 방법이 없으므로 사람이 할 일로 남겨 목록에 모아 보여준다.
            if (data.goodsflowOrderNo) {
                needHomepick.push(`${data.customerName || '이름없음'} · 주문 ${data.goodsflowOrderNo}`);
            }
        } catch (e) {
            fails.push(`${id.slice(0, 6)}… ${e.message}`);
        }
    }
    // 매입완료 집계 캐시가 낡으므로 버린다
    _paidPhoneCounts = null;

    let msg = `매입취소 ${ok}건 처리했습니다.`;
    if (needHomepick.length > 0) {
        msg += `\n\n⚠️ 아래 ${needHomepick.length}건은 홈픽에서 직접 취소 요청하셔야 합니다.\n`
             + `(미집하 건은 택배사로 이관돼 API 로는 취소되지 않습니다. 요청 후 48시간 뒤 처리)\n\n`
             + needHomepick.join('\n');
    }
    if (fails.length) msg += `\n\n처리 실패 ${fails.length}건:\n${fails.join('\n')}`;
    alert(msg);
    loadQuotes();
};

// ===================================================================
// 미집하 안내 — 수동 발송
// -------------------------------------------------------------------
// 평소에는 goodsflowPoller 가 30분마다 자동 발송한다 (functions/index.js 1361줄).
// 이 버튼은 자동이 못 잡는 경우를 위한 것이다.
//   · 고객이 "안내를 못 받았다"고 전화한 경우
//   · 자동 발송이 3회 실패해 중단된 건
//   · 표시만 남고 실제로는 안 나간 옛 건 (7월에 다수 발생)
//
// ⚠️ 알림톡은 한 번 나가면 되돌릴 수 없다. 이미 보낸 건은 확인을 한 번 더 받는다.
// ⚠️ 누가 보냈는지 남긴다. 자동 발송에는 이 정보가 없어서, 나중에
//    "왜 두 번 갔지"를 추적하려면 수동분은 구분돼야 한다.
// ===================================================================
const PICKUP_FAILED_TEMPLATE_ID = "KA01TP260601181544930IFU2hB2wtIC"; // 변수 없는 고정 문구

window.sendPickupFailedNotice = async (docId) => {
    if (!docId) return;
    try {
        const docRef = doc(db, "quotes", docId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) { alert("신청건을 찾을 수 없습니다."); return; }
        const data = snap.data();

        const phone = String(data.customerPhone || '').replace(/\D/g, '');
        if (!phone) { alert("고객 연락처가 없습니다."); return; }

        const prevAt = _toDateForList(data.pickupFailedNotifiedAt);
        const who = data.customerName || '고객';
        const msg = prevAt
            ? `${who}님에게 미집하 안내를 다시 보냅니다.\n\n` +
              `이미 ${prevAt.toLocaleString('ko-KR')} 에 발송된 건입니다.\n` +
              `고객이 알림톡을 두 번 받게 됩니다. 계속할까요?`
            : `${who}님(${phone})에게 미집하 안내 알림톡을 발송할까요?`;
        if (!confirm(msg)) return;

        const res = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/alimtalkApi/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phone: phone,
                templateId: PICKUP_FAILED_TEMPLATE_ID,
                variables: {}   // 이 템플릿은 변수가 없다
            })
        });
        const result = await res.json().catch(() => ({}));

        // ★ 성공했을 때만 발송 표시를 남긴다.
        //   먼저 찍고 보내면, 실패해도 '보냄'으로 남아 영영 재시도가 안 된다.
        //   (7월 건 다수가 그 상태였다 — functions/index.js 1357줄 주석 참고)
        if (!res.ok || result.error) {
            alert("발송 실패\n\n" + (result.error || result.message || `HTTP ${res.status}`));
            return;
        }

        await updateDoc(docRef, {
            pickupFailedNotifiedAt: serverTimestamp(),
            // 로그인한 관리자 이메일 — 화면 상단에 표시된 값을 그대로 쓴다
            // (계정을 공유해 쓰고 있어 사람까지는 구분되지 않는다. 직원 앱으로 넘어가면 해결됨)
            pickupFailedNotifyBy: (document.getElementById('admin-email')?.textContent || '관리자'),
            pickupFailedNotifyManual: true,
            pickupFailedNotifyTries: 0,                                  // 재시도 횟수 초기화
            pickupFailedNotifyError: deleteField()
        });

        alert("미집하 안내 알림톡을 발송했습니다.");
        loadQuotes();
    } catch (e) {
        console.error("미집하 안내 발송 오류:", e);
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

// [삭제됨] 재고 현황 대시보드 — 매입완료 시트로 관리하므로 관리자에서 제거 (2026-08)
//   loadInventory / renderInventoryTable / filterInventory 및 inventoryDataCache 삭제.
//   loadInventory 는 quotes 컬렉션을 통째로 읽어 무거웠다.

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

// ==========================================
// 3-3 대조 도구 & 근태 승인 대기 수량 (recountAttendancePending) Implementation
// ==========================================

window.recountAttendancePending = async () => {
    const btn1 = document.getElementById('btn-recount-attendance');
    const btn2 = document.getElementById('btn-recount-attendance-warn');
    if (btn1) { btn1.disabled = true; btn1.innerText = '다시 세는 중...'; }
    if (btn2) { btn2.disabled = true; btn2.innerText = '다시 세는 중...'; }
    try {
        const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
        const functions = getFunctions(undefined, 'asia-northeast3');
        const recountFn = httpsCallable(functions, 'recountAttendancePending');
        const res = await recountFn();
        alert(`근태 대기 건수 재집계가 완료되었습니다.\n(이전: ${res.data.before}건 → 변경: ${res.data.count}건)`);
        if (typeof window.runReconciliation === 'function') window.runReconciliation();
    } catch (e) {
        console.error("recountAttendancePending error:", e);
        alert(`재집계 실패: ${e.message}`);
    } finally {
        if (btn1) { btn1.disabled = false; btn1.innerText = '🔄 다시 세기 (recountAttendancePending)'; }
        if (btn2) { btn2.disabled = false; btn2.innerText = '🔄 대기 숫자 다시 세기 (recount)'; }
    }
};

window.openReconcileDocModal = async (docId) => {
    const modal = document.getElementById('reconcile-doc-modal');
    const content = document.getElementById('reconcile-doc-modal-content');
    if (!modal || !content) return;

    modal.style.display = 'flex';
    content.innerHTML = '<p style="color:#64748b; font-size:0.95rem;">문서 상세 정보(ID: ' + docId + ')를 읽어오는 중...</p>';

    try {
        const docRef = doc(db, 'quotes', docId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            content.innerHTML = `<p style="color:#dc2626; font-weight:bold;">해당 문서가 존재하지 않습니다. (ID: ${docId})</p>`;
            return;
        }
        const d = snap.data();
        const formattedDate = formatDate(d.submittedAt || d.firebaseTimestamp || d.timestamp);
        const formattedPrice = formatCurrency(d.price);

        content.innerHTML = `
            <div style="font-size: 0.9rem; line-height: 1.8; color: #1e293b;">
                <div style="background:#f8fafc; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:14px;">
                    <div style="font-size:0.8rem; color:#64748b; font-weight:bold; margin-bottom:4px;">문서 ID</div>
                    <code style="font-size:0.95rem; color:#2563eb; font-weight:bold;">${docId}</code>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:14px;">
                    <div><strong>고객명:</strong> ${d.customerName || '-'}</div>
                    <div><strong>연락처:</strong> ${d.customerPhone || '-'}</div>
                    <div><strong>기종:</strong> ${d.brand || ''} ${d.model || ''}</div>
                    <div><strong>상태등급:</strong> ${d.condition || '-'}</div>
                    <div><strong>매입가:</strong> <span style="color:#2563eb; font-weight:bold;">${formattedPrice}</span></div>
                    <div><strong>접수일시:</strong> ${formattedDate}</div>
                </div>
                <div style="border-top:1px solid #e2e8f0; padding-top:12px; margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div><strong>상태 (status):</strong> <span class="status-badge status-new" style="background:#e0f2fe; color:#0369a1;">${d.status || '신청접수'}</span></div>
                    <div><strong>이전 상태 (prevStatus):</strong> ${d.prevStatus || '-'}</div>
                    <div><strong>배송 방식 (deliveryMethod):</strong> ${d.deliveryMethod || '(미선택/pending)'}</div>
                    <div><strong>운송장 (trackingNumber):</strong> ${d.trackingNumber || '-'}</div>
                    <div><strong>굿스플로 알림:</strong> ${d.goodsflowAlert || '-'}</div>
                    <div><strong>삭제 플래그 (isDeleted):</strong> ${d.isDeleted ? '<span style="color:#dc2626; font-weight:bold;">true (삭제됨)</span>' : 'false'}</div>
                    <div><strong>외국인 플래그:</strong> ${d.isForeigner || d.method === 'foreigner' || d.series === 'Foreigner' ? '<span style="color:#d97706; font-weight:bold;">true (외국인)</span>' : 'false'}</div>
                </div>
            </div>
            <details style="margin-top: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
                <summary style="font-size: 0.82rem; font-weight: bold; color: #475569; cursor: pointer;">RAW JSON 데이터 보기</summary>
                <pre style="font-size: 0.75rem; color: #334155; margin-top: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${JSON.stringify(d, null, 2)}</pre>
            </details>
        `;
    } catch (e) {
        console.error("openReconcileDocModal error:", e);
        content.innerHTML = `<p style="color:#dc2626;">문서 조회 실패: ${e.message}</p>`;
    }
};

window.runReconciliation = async () => {
    const statusBar = document.getElementById('reconcile-status-bar');
    const statusText = document.getElementById('reconcile-status-text');
    const timeText = document.getElementById('reconcile-time-text');

    if (statusBar) statusBar.style.display = 'flex';
    if (statusText) statusText.innerHTML = '🔄 3-3 대조 데이터를 집계하는 중입니다... (getCountFromServer 쿼리 & 기존 메모리 기준 대조)';
    if (timeText) timeText.innerText = '계산 중...';

    const _t0 = performance.now();

    try {
        // --- 0. Check stats/attendance_pending (Directive ③) ---
        const attCountDisplay = document.getElementById('reconcile-attendance-count-display');
        const attWarnBanner = document.getElementById('reconcile-attendance-warning');
        const attWarnText = document.getElementById('reconcile-attendance-warning-text');
        
        try {
            const attSnap = await getDoc(doc(db, "stats", "attendance_pending"));
            const rawCount = attSnap.exists() ? (attSnap.data().count || 0) : 0;
            if (rawCount < 0) {
                if (attCountDisplay) attCountDisplay.innerHTML = `<span style="color:#dc2626; font-weight:bold;">0건 (실제집계: ${rawCount}건)</span>`;
                if (attWarnBanner) attWarnBanner.style.display = 'block';
                if (attWarnText) attWarnText.innerText = `근태 승인 대기 숫자가 어긋났습니다 (현재 ${rawCount}건) — 다시 세기`;
            } else {
                if (attCountDisplay) attCountDisplay.innerHTML = `<strong style="font-size:1.25rem; color:#2563eb;">${rawCount}건</strong>`;
                if (attWarnBanner) attWarnBanner.style.display = 'none';
            }
        } catch (e) {
            console.warn("attendance_pending check warning:", e);
        }

        const quotesRef = collection(db, "quotes");
        const B_STATUSES = ["택배도착", "검수중", "검수완료", "입금대기", "반송대기"];
        const TERMINAL_STATUSES = ["입금완료", "취소", "반송접수", "삭제"];
        const ALL_13_STATUSES = [
            "신청접수", "수거중", "택배도착", "검수중", "검수완료",
            "입금대기", "입금완료", "반송대기", "반송접수", "취소",
            "삭제", "간편접수", "임시저장"
        ];

        // 1. Fetch raw documents once for legacy memory calculation & mismatch document ID collection
        const allSnap = await getDocs(quotesRef);

        const isForeignerDoc = (d) => d.isForeigner === true || d.method === 'foreigner' || d.series === 'Foreigner';

        // Legacy in-memory aggregations
        const legacy = {
            stages: { a: 0, b: 0, terminal: 0 },
            statuses: {},
            monthlyPaid: { count: 0, amount: 0 },
            special: { pickupFailed: 0, noTracking: 0, abandoned: 0 },
            trash: 0,
            docs: []
        };
        ALL_13_STATUSES.forEach(st => legacy.statuses[st] = 0);

        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();

        allSnap.forEach(docSnap => {
            const d = docSnap.data();
            const id = docSnap.id;
            const isDel = d.isDeleted === true;
            const isFor = isForeignerDoc(d);
            const st = d.status || '신청접수';

            legacy.docs.push({ id, d, isDel, isFor, st });

            // Trash
            if (isDel || st === '삭제') legacy.trash++;

            // Main tabs ignore isDeleted & isForeigner
            if (isDel || isFor) return;

            // Stage
            if (B_STATUSES.includes(st)) {
                legacy.stages.b++;
            } else if (TERMINAL_STATUSES.includes(st)) {
                legacy.stages.terminal++;
            } else {
                legacy.stages.a++;
            }

            // Status 13
            if (legacy.statuses[st] !== undefined) {
                legacy.statuses[st]++;
            } else {
                legacy.statuses[st] = 1;
            }

            // Monthly Paid
            if (st === '입금완료') {
                let pDate = null;
                if (d.paidAt) pDate = d.paidAt.toDate ? d.paidAt.toDate() : new Date(d.paidAt.seconds ? d.paidAt.seconds * 1000 : d.paidAt);
                else if (d.customerAgreedAt) pDate = d.customerAgreedAt.toDate ? d.customerAgreedAt.toDate() : new Date(d.customerAgreedAt.seconds ? d.customerAgreedAt.seconds * 1000 : d.customerAgreedAt);
                else if (d.inspectionData && d.inspectionData.inspectedAt) pDate = new Date(d.inspectionData.inspectedAt);
                else if (d.firebaseTimestamp) pDate = d.firebaseTimestamp.toDate ? d.firebaseTimestamp.toDate() : new Date(d.firebaseTimestamp.seconds ? d.firebaseTimestamp.seconds * 1000 : d.firebaseTimestamp);

                if (pDate && pDate.getFullYear() === curYear && pDate.getMonth() === curMonth) {
                    legacy.monthlyPaid.count++;
                    legacy.monthlyPaid.amount += (d.price || 0);
                }
            }

            // Special
            if (d.goodsflowAlert === 'PICKUP_FAILED' && st !== '택배도착') legacy.special.pickupFailed++;
            if (d.deliveryMethod === 'cvs' && (!d.trackingNumber || d.trackingNumber === '미입력')) legacy.special.noTracking++;
            if ((!d.deliveryMethod || d.deliveryMethod === 'pending') && !TERMINAL_STATUSES.includes(st)) legacy.special.abandoned++;
        });

        // 2. New App Server-Side Counting (getCountFromServer) - Rule 3 Compliance
        // Stages
        const snapB = await getCountFromServer(query(quotesRef, where("status", "in", B_STATUSES)));
        const newAppB = snapB.data().count;

        const snapTerm = await getCountFromServer(query(quotesRef, where("status", "in", TERMINAL_STATUSES)));
        const newAppTerm = snapTerm.data().count;

        const snapA = await getCountFromServer(query(quotesRef, where("status", "not-in", [...B_STATUSES, ...TERMINAL_STATUSES])));
        const newAppA = snapA.data().count;

        // 13 Statuses getCountFromServer
        const newAppStatuses = {};
        for (const st of ALL_13_STATUSES) {
            try {
                if (st === '삭제') {
                    const s = await getCountFromServer(query(quotesRef, where("isDeleted", "==", true)));
                    newAppStatuses[st] = s.data().count;
                } else {
                    const s = await getCountFromServer(query(quotesRef, where("status", "==", st)));
                    newAppStatuses[st] = s.data().count;
                }
            } catch (err) {
                newAppStatuses[st] = 0;
            }
        }

        // Monthly Paid range
        const startOfMonth = new Date(curYear, curMonth, 1);
        const endOfMonth = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
        let newAppMonthlyCount = 0;
        let newAppMonthlyAmount = 0;
        try {
            const sMonth = await getCountFromServer(query(quotesRef, where("status", "==", "입금완료"), where("firebaseTimestamp", ">=", startOfMonth), where("firebaseTimestamp", "<=", endOfMonth)));
            newAppMonthlyCount = sMonth.data().count;
        } catch (err) { }

        // Sum amount for matched range
        allSnap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.status === '입금완료' && d.firebaseTimestamp) {
                const ft = d.firebaseTimestamp.toDate ? d.firebaseTimestamp.toDate() : new Date(d.firebaseTimestamp.seconds * 1000);
                if (ft >= startOfMonth && ft <= endOfMonth) {
                    newAppMonthlyAmount += (d.price || 0);
                }
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // 특수 분류 3항목 — **셋 다 서버 카운트로 셀 수 없다. 메모리에서 센다.**
        // -------------------------------------------------------------------
        // ⚠️⚠️ 2026-08-18 — 이 절의 '새 앱' 열은 **새 앱이 아니었다.**
        //    `getCountFromServer` 로 대충 비슷한 쿼리를 날려놓고 '새 앱' 이라고 적어서,
        //    세 행 모두 실제 앱 화면과 다른 숫자를 보여주고 있었다.
        //
        //      미집하    where alert=='PICKUP_FAILED'      → 삭제·외국인·종결이 다 들어감
        //      송장미입력 where trackingNumber=='미입력'    → 새 앱과 **정반대 집합**
        //      이탈건    where deliveryMethod=='pending'   → 위 + **필드가 없는 문서를 못 셈**
        //
        //    ⭐ 특히 이탈건은 `deliveryMethod` **필드가 아예 없는 문서**가 대상에 들어가는데
        //       Firestore 는 "필드 없음" 을 조회할 수 없다. 서버 카운트로는 **원리상 불가능**하다.
        //
        // ⚠️ 규칙 ③(건수는 서버 카운트)을 어기는 게 아니다. 규칙 ③은 **문서를 다 읽어서
        //    세지 말라**는 뜻인데, 이 절은 이미 위에서 전체를 훑어 `legacy.docs` 에 담아뒀다.
        //    같은 배열을 한 번 더 도는 비용은 0에 가깝고, **조회가 하나도 안 는다.**
        //
        // ⚠️ 그래서 `catch (e) { }` 로 실패를 삼키던 문제도 같이 사라진다 — 쿼리가 없다.
        //
        // 【판정 근거】 직원 앱 소스와 한 줄씩 맞춘 것이다
        //    미집하   types/quote.ts `isPickupFailed`   = alert === 'PICKUP_FAILED'
        //             lib/delivery.ts `listPickupFailed` 가 종결을 뺀다
        //    이탈건   types/quote.ts `isDropoff`        = rawDeliveryMethod 가 '' 또는 'pending'
        //    두 화면 모두 진행중 캐시(`useActiveQuotes`) 위에서 도므로 삭제·외국인·종결이 빠진다.
        // ═══════════════════════════════════════════════════════════════════
        let newAppPf = 0, newAppNt = 0, newAppAb = 0;

        // 미집하 — 두 기준이 **서로 반대 방향으로** 어긋난다
        //   새 앱만 셈 : `택배도착` (기존 관리자는 이걸 뺀다)
        //   기존만 셈 : 종결 건    (새 앱은 이걸 뺀다)
        let pfCommon = 0, pfArrivedOnly = 0, pfTerminalOnly = 0, pfExcluded = 0;
        // 이탈건 — 두 기준이 같아야 한다. 다르면 그 자체가 신호다
        let abCount = 0, abExcluded = 0;

        legacy.docs.forEach(({ d, st, isDel, isFor }) => {
            if (d.goodsflowAlert === 'PICKUP_FAILED') {
                if (isDel || isFor) pfExcluded++;                              // 양쪽 다 안 셈
                else if (st === '택배도착') pfArrivedOnly++;                    // 새 앱만
                else if (TERMINAL_STATUSES.includes(st)) pfTerminalOnly++;     // 기존 관리자만
                else pfCommon++;                                               // 양쪽 다
            }
            // ⚠️ `!d.deliveryMethod` — 필드가 **아예 없는** 문서를 잡는다. 서버 쿼리로는 못 한다
            if (!d.deliveryMethod || d.deliveryMethod === 'pending') {
                if (isDel || isFor) abExcluded++;
                else if (!TERMINAL_STATUSES.includes(st)) abCount++;
            }
        });
        newAppPf = pfCommon + pfArrivedOnly;
        newAppAb = abCount;

        // ═══════════════════════════════════════════════════════════════════
        // 송장 미입력 — **서버 카운트로 셀 수 없다. 메모리에서 센다.**
        // -------------------------------------------------------------------
        // ⚠️⚠️ 2026-08-18 — 여기가 **틀려 있었다.**
        //
        //   전에 쓰던 쿼리:  cvs  AND  trackingNumber == '미입력'
        //
        //   그런데 새 앱은 `'미입력'`(= 송장없이 발송완료)을 **일부러 뺀다.**
        //   즉 이 쿼리는 새 앱이 세는 것과 **정확히 반대 집합**을 세고 있었다.
        //   그래서 이 행의 '차이' 숫자는 아무 의미가 없었다.
        //
        // ⚠️ Firestore 는 "필드가 없는 문서" 를 조회할 수 없다. 송장이 **아예 없는**
        //    건이 대상이라 서버 카운트로는 애초에 표현이 안 된다.
        //    → 이미 메모리에 올려둔 allDocs 로 **새 앱과 같은 규칙**으로 센다.
        //
        // 【새 앱 규칙】 src/types/quote.ts 의 isMissingTracking()
        //    종결 아님 · deliveryMethod === 'cvs' · 송장번호 없음(‘미입력’ 제외)
        //    · 굿스플로 송장(간선·집하)도 없음
        //    (삭제·외국인은 위 forEach 에서 이미 빠졌다)
        //
        // ⚠️ 기존 관리자페이지는 `'미입력'` 도 미입력으로 센다 —
        //    **일부러 다르게 둔 유일한 지점**이라 이 행은 항상 차이가 난다.
        //    '미입력' 건은 4단계 '발송했다는데 도착 안 한 건' 에서 따로 본다.
        // ═══════════════════════════════════════════════════════════════════
        // ⚠️⚠️ 2026-08-18 (2차) — **차이를 끝까지 쪼개지 않았던 것을 고친다.**
        //    처음엔 `'미입력'` 하나로 다 설명된다고 적었는데, 실제로 돌려보니
        //    새 앱 46 / 기존 188 로 **142건**이 벌어졌고 `'미입력'` 은 6건뿐이었다.
        //    나머지 136건은 **기존 관리자가 종결 건을 안 빼기 때문**이었다.
        //
        //    ⚠️ 설명이 실제 숫자와 안 맞으면 그 설명은 **없는 것만 못하다.**
        //       "설명된 차이" 로 적혀 있어서 아무도 다시 안 보게 된다.
        //    → 세 조각의 **합이 기존 관리자 값과 정확히 맞는지** 화면에서 검산한다.
        //
        // ⚠️⚠️ (3차) **`legacy.docs` 에는 삭제·외국인 건이 들어 있다.**
        //    위 forEach 는 `if (isDel || isFor) return;` **뒤에** 집계하므로
        //    `legacy.special.noTracking` 에는 그 건들이 없다.
        //    여기서 안 빼면 22건이 남아돌아 검산이 안 맞는다. (실제로 그랬다)
        //    → 검산 화면이 이걸 잡아냈다. **검산이 없었으면 또 틀린 설명을 붙일 뻔했다.**
        let ntMissingOnly = 0;   // 진행중 · 송장이 아예 없음 (= 새 앱 기준)
        let ntSentNoInvoice = 0; // 진행중 · '미입력'(송장없이 발송완료)
        let ntTerminal = 0;      // 종결·굿스플로 송장 있음 — 기존 관리자만 센다
        let ntExcluded = 0;      // 삭제·외국인 — **양쪽 다 안 센다.** 검산에서 제외
        legacy.docs.forEach(({ d, st, isDel, isFor }) => {
            if (d.deliveryMethod !== 'cvs') return;
            if (d.trackingNumber && d.trackingNumber !== '미입력') return;
            if (isDel || isFor) { ntExcluded++; return; }
            if (TERMINAL_STATUSES.includes(st)) { ntTerminal++; return; }
            // ⚠️ 굿스플로 송장이 있으면 새 앱은 뺀다 (기존 관리자는 안 본다)
            if (d.goodsflowRelayInvoiceNo || d.goodsflowTransporterInvoiceNo) { ntTerminal++; return; }
            if (!d.trackingNumber) ntMissingOnly++;
            else ntSentNoInvoice++;
        });
        newAppNt = ntMissingOnly;

        // Trash getCountFromServer
        const snapTrash = await getCountFromServer(query(quotesRef, where("isDeleted", "==", true)));
        const newAppTrash = snapTrash.data().count;

        // Render Tables
        renderReconciliationTables({
            legacy,
            newApp: {
                stages: { a: newAppA, b: newAppB, terminal: newAppTerm },
                statuses: newAppStatuses,
                monthlyPaid: { count: newAppMonthlyCount, amount: newAppMonthlyAmount },
                special: { pickupFailed: newAppPf, noTracking: newAppNt, abandoned: newAppAb },
                ntSentNoInvoice,
                ntTerminal,
                ntExcluded,
                pfCommon, pfArrivedOnly, pfTerminalOnly, pfExcluded,
                abExcluded,
                trash: newAppTrash
            },
            allDocs: legacy.docs,
            B_STATUSES,
            TERMINAL_STATUSES,
            ALL_13_STATUSES
        });

        const elapsed = Math.round(performance.now() - _t0);
        if (statusText) statusText.innerHTML = '✅ <b>3-3 대조 계산 완료!</b>';
        if (timeText) timeText.innerText = `소요시간: ${elapsed}ms | 전체 검증 문서: ${allSnap.size}건`;

    } catch (e) {
        console.error("runReconciliation error:", e);
        if (statusText) statusText.innerHTML = `<span style="color:#dc2626;">❌ 대조 오류: ${e.message}</span>`;
    }
};

function renderReconciliationTables(data) {
    const { legacy, newApp, allDocs, B_STATUSES, TERMINAL_STATUSES, ALL_13_STATUSES } = data;

    // Format diff badge HTML
    const formatDiffBadge = (diff) => {
        // ⚠️ 세지 못한 항목은 **비교할 수 없다.** 0 으로도, 차이로도 쓰지 않는다.
        //    숫자를 만들어 넣으면 "조회 실패" 가 "일치" 로 둔갑한다 (규칙 ⑥).
        if (diff === null || diff === undefined || Number.isNaN(diff)) {
            return `<span style="background:#f1f5f9; color:#64748b; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:0.88rem;">비교 불가</span>`;
        }
        if (diff === 0) {
            return `<span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:0.88rem;">0 (일치)</span>`;
        } else {
            const sign = diff > 0 ? `+${diff}` : `${diff}`;
            return `<span style="background:#fee2e2; color:#dc2626; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:0.88rem;">${sign} (차이)</span>`;
        }
    };

    // Helper: Build document chip HTML for mismatched document IDs
    const buildDocChips = (docIds, limit = 8) => {
        if (!docIds || docIds.length === 0) return '<span style="color:#94a3b8; font-size:0.85rem;">차이 문서 없음</span>';
        const slice = docIds.slice(0, limit);
        let html = slice.map(id => `
            <button onclick="openReconcileDocModal('${id}')" title="클릭 시 신청서 상세 보기" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:2px 7px; border-radius:4px; font-size:0.78rem; font-weight:bold; cursor:pointer; margin:2px;">
                ${id.slice(0, 8)}...
            </button>
        `).join(' ');
        if (docIds.length > limit) {
            html += `<span style="font-size:0.75rem; color:#64748b; margin-left:4px;">외 ${docIds.length - limit}건</span>`;
        }
        return html;
    };

    // 1. Stage Table
    const stagesTbody = document.getElementById('reconcile-stages-tbody');
    if (stagesTbody) {
        const stageRows = [
            {
                name: '접수·수거 (A 구간)',
                newVal: `${newApp.stages.a}건`,
                legVal: `${legacy.stages.a}건`,
                diff: newApp.stages.a - legacy.stages.a,
                reason: '기존 관리자는 isDeleted===true 및 외국인 신청(isForeigner)을 메모리에서 빼므로 차이 발생'
            },
            {
                name: '검수·정산 (B 구간)',
                newVal: `${newApp.stages.b}건`,
                legVal: `${legacy.stages.b}건`,
                diff: newApp.stages.b - legacy.stages.b,
                reason: 'B상태(택배도착·검수중·검수완료·입금대기·반송대기) 문서 중 삭제/외국인 건 포함 여부 차이'
            },
            {
                name: '종결 (Terminal 구간)',
                newVal: `${newApp.stages.terminal}건`,
                legVal: `${legacy.stages.terminal}건`,
                diff: newApp.stages.terminal - legacy.stages.terminal,
                reason: '종결상태(입금완료·취소·반송접수·삭제) 중 삭제/외국인 필터링 여부 차이'
            }
        ];
        stagesTbody.innerHTML = stageRows.map(r => `
            <tr>
                <td style="font-weight:bold;">${r.name}</td>
                <td style="font-weight:bold; color:#2563eb;">${r.newVal}</td>
                <td style="font-weight:bold; color:#475569;">${r.legVal}</td>
                <td>${formatDiffBadge(r.diff)}</td>
                <td style="font-size:0.85rem; color:#475569;">${r.reason}</td>
            </tr>
        `).join('');
    }

    // 2. Status 13 Table
    const statusesTbody = document.getElementById('reconcile-statuses-tbody');
    if (statusesTbody) {
        let html = '';
        ALL_13_STATUSES.forEach(st => {
            const nv = newApp.statuses[st] || 0;
            const lv = legacy.statuses[st] || 0;
            const diff = nv - lv;

            // Collect mismatched doc IDs for this status
            const mismatchedIds = [];
            allDocs.forEach(({ id, d, isDel, isFor, st: docSt }) => {
                if (st === '삭제') {
                    if (d.isDeleted && !isDel) mismatchedIds.push(id);
                } else if (docSt === st) {
                    if (isDel || isFor) mismatchedIds.push(id);
                }
            });

            html += `
                <tr>
                    <td style="font-weight:bold;">${st}</td>
                    <td style="font-weight:bold; color:#2563eb;">${nv}건</td>
                    <td style="font-weight:bold; color:#475569;">${lv}건</td>
                    <td>${formatDiffBadge(diff)}</td>
                    <td>${buildDocChips(mismatchedIds)}</td>
                </tr>
            `;
        });
        statusesTbody.innerHTML = html;
    }

    // 3. Monthly Paid Table
    const monthlyTbody = document.getElementById('reconcile-monthly-tbody');
    if (monthlyTbody) {
        const curMonthName = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;
        const cDiff = newApp.monthlyPaid.count - legacy.monthlyPaid.count;
        const aDiff = newApp.monthlyPaid.amount - legacy.monthlyPaid.amount;

        monthlyTbody.innerHTML = `
            <tr>
                <td style="font-weight:bold;">${curMonthName} 매입완료 건수</td>
                <td style="font-weight:bold; color:#2563eb;">${newApp.monthlyPaid.count}건</td>
                <td style="font-weight:bold; color:#475569;">${legacy.monthlyPaid.count}건</td>
                <td>${formatDiffBadge(cDiff)}</td>
                <td style="font-size:0.83rem; color:#475569;">
                    <b>규칙 ③ 사유:</b> 서버 쿼리는 <code style="background:#f1f5f9;">firebaseTimestamp</code> 기준, 기존 관리자는 <code style="background:#f1f5f9;">paidAt > customerAgreedAt > inspectedAt > firebaseTimestamp</code> 우선순위 커스텀 날짜를 사용함
                </td>
            </tr>
            <tr>
                <td style="font-weight:bold;">${curMonthName} 총 매입금액</td>
                <td style="font-weight:bold; color:#2563eb;">${formatCurrency(newApp.monthlyPaid.amount)}</td>
                <td style="font-weight:bold; color:#475569;">${formatCurrency(legacy.monthlyPaid.amount)}</td>
                <td>${formatDiffBadge(aDiff)}</td>
                <td style="font-size:0.83rem; color:#475569;">
                    <b>규칙 ③ 사유:</b> Firestore <code style="background:#f1f5f9;">getCountFromServer</code>는 문서 개수 카운트 전용이므로, 금액(Amount) 집계는 필드 합산 연산이 필요함
                </td>
            </tr>
        `;
    }

    // 4. Special Classification Table
    const specialTbody = document.getElementById('reconcile-special-tbody');
    if (specialTbody) {
        const specialRows = [
            {
                name: '미집하',
                nv: `${newApp.special.pickupFailed}건`,
                lv: `${legacy.special.pickupFailed}건`,
                diff: newApp.special.pickupFailed - legacy.special.pickupFailed,
                mismatched: allDocs.filter(({ d, st, isDel, isFor }) => d.goodsflowAlert === 'PICKUP_FAILED' && !isDel && !isFor && (st === '택배도착' || TERMINAL_STATUSES.includes(st))).map(x => x.id),
                // ⭐ 두 기준이 **서로 반대 방향으로** 어긋나는 유일한 행이다.
                //    한 방향으로만 설명하면 숫자가 안 맞는다.
                reason: (() => {
                    const c = newApp.pfCommon || 0, ar = newApp.pfArrivedOnly || 0, te = newApp.pfTerminalOnly || 0;
                    const ok = (c + ar) === newApp.special.pickupFailed && (c + te) === legacy.special.pickupFailed;
                    return `<div style="color:#334155;">둘 다 <code style="background:#f1f5f9;">goodsflowAlert=="PICKUP_FAILED"</code> 다.
                        <strong>이 행만 두 기준이 서로 반대 방향으로 어긋난다.</strong></div>
                    <div style="margin-top:8px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px 13px; font-size:0.84rem; line-height:1.9; color:#334155;">
                        <div><span style="display:inline-block; width:230px;">양쪽 다 세는 것</span> <strong>${c}건</strong></div>
                        <div><span style="display:inline-block; width:230px;">＋ <code style="background:#dbeafe;">택배도착</code> — <strong>새 앱만</strong> 셈</span> <strong style="color:#2563eb;">${ar}건</strong></div>
                        <div><span style="display:inline-block; width:230px;">＋ 종결 상태 — <strong>기존 관리자만</strong> 셈</span> <strong style="color:#b45309;">${te}건</strong></div>
                        <div style="border-top:1px solid #cbd5e1; margin-top:6px; padding-top:6px;">
                            <span style="display:inline-block; width:230px;">새 앱 = ${c} + ${ar} = <strong style="color:#2563eb;">${c + ar}</strong></span>
                            기존 관리자 = ${c} + ${te} = <strong style="color:#b45309;">${c + te}</strong>
                            ${ok
                                ? `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:5px; font-size:0.78rem; font-weight:700; margin-left:8px;">검산 일치</span>`
                                : `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:5px; font-size:0.78rem; font-weight:700; margin-left:8px;">검산 안 맞음</span>`}
                        </div>
                        <div style="margin-top:6px; font-size:0.79rem; color:#64748b;">
                            삭제·외국인 <strong>${newApp.pfExcluded || 0}건</strong>은 양쪽 다 안 세므로 검산에서 뺐다.
                        </div>
                    </div>
                    <div style="margin-top:8px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:9px 12px; font-size:0.82rem; line-height:1.7; color:#78350f;">
                        <strong><code style="background:#fef3c7;">택배도착</code> 인데 미집하 표시가 남아 있는 건</strong>은 기존 관리자가 뺀다 —
                        이미 물건이 왔으니 처리가 끝났다고 보는 것이다. 새 앱은 <strong>종결만</strong> 뺀다.<br>
                        ⚠️ ${ar}건이 계속 쌓이면 <strong>폴러가 도착 처리를 하면서 미집하 표시를 안 지우고 있다는 신호</strong>다. 그때 다시 보자.
                    </div>`;
                })()
            },
            {
                name: '송장 미입력 (개인발송)',
                nv: `${newApp.special.noTracking}건`,
                lv: `${legacy.special.noTracking}건`,
                diff: newApp.special.noTracking - legacy.special.noTracking,
                // ⚠️ 칩에는 **차이의 정체인 문서**를 띄운다. 전에는 삭제·외국인(=양쪽 다 안 세는 것)을
                //    띄우고 있어서, 설명 문구가 말하는 것과 칩이 서로 다른 걸 가리켰다.
                mismatched: allDocs.filter(({ d, st, isDel, isFor }) =>
                    d.deliveryMethod === 'cvs'
                    && (!d.trackingNumber || d.trackingNumber === '미입력')
                    && !isDel && !isFor
                    && (d.trackingNumber === '미입력' || TERMINAL_STATUSES.includes(st)
                        || d.goodsflowRelayInvoiceNo || d.goodsflowTransporterInvoiceNo)
                ).map(x => x.id),
                // ⭐ 이 행은 **차이가 나는 게 정상이다.** 왜 나는지를 여기 적어둔다.
                //    설명이 없으면 "숫자가 안 맞네" 로 남아서, 나중에 진짜 문제가 생겨도
                //    "원래 안 맞는 행" 으로 넘어가게 된다.
                reason: (() => {
                    const a = newApp.special.noTracking;
                    const b = newApp.ntSentNoInvoice || 0;
                    const c = newApp.ntTerminal || 0;
                    const ok = (a + b + c) === legacy.special.noTracking;
                    return `<div style="color:#334155;">둘 다 <code style="background:#f1f5f9;">deliveryMethod=="cvs"</code> 이고 송장이 없거나 <code style="background:#f1f5f9;">'미입력'</code> 인 건이다.
                        <strong>차이는 두 조각으로 전부 설명된다.</strong></div>
                    <div style="margin-top:8px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px 13px; font-size:0.84rem; line-height:1.9; color:#334155;">
                        <div><span style="display:inline-block; width:210px;">새 앱이 세는 것 (독촉 대상)</span> <strong style="color:#2563eb;">${a}건</strong></div>
                        <div><span style="display:inline-block; width:210px;">＋ <code style="background:#fef3c7;">'미입력'</code> = 송장없이 발송완료</span> <strong style="color:#b45309;">${b}건</strong></div>
                        <div><span style="display:inline-block; width:210px;">＋ 종결됐거나 굿스플로 송장이 있는 건</span> <strong style="color:#b45309;">${c}건</strong></div>
                        <div style="border-top:1px solid #cbd5e1; margin-top:6px; padding-top:6px;">
                            <span style="display:inline-block; width:210px;">＝ 기존 관리자 값</span>
                            <strong style="color:${ok ? '#166534' : '#b91c1c'};">${a + b + c}건</strong>
                            ${ok
                                ? `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:5px; font-size:0.78rem; font-weight:700; margin-left:8px;">검산 일치</span>`
                                : `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:5px; font-size:0.78rem; font-weight:700; margin-left:8px;">검산 안 맞음 — 설명 못 한 차이 ${legacy.special.noTracking - (a + b + c)}건</span>`}
                        </div>
                        <div style="margin-top:6px; font-size:0.79rem; color:#64748b;">
                            삭제·외국인 <strong>${newApp.ntExcluded || 0}건</strong>은 <strong>양쪽 다 안 세므로</strong> 검산에서 뺐다.
                        </div>
                    </div>
                    <div style="margin-top:8px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:9px 12px; font-size:0.82rem; line-height:1.7; color:#78350f;">
                        <strong><code style="background:#fef3c7;">'미입력'</code> 은 송장번호가 아니라 "송장없이 발송완료" 라는 뜻이다</strong> (admin.js 353줄).
                        기존 관리자는 미입력으로 세고, 새 앱은 <strong>독촉할 게 없어서 뺀다.</strong>
                        그 건들은 4단계 <strong>'발송했다는데 도착 안 한 건'</strong> 에서 본다.<br>
                        <strong>종결 건</strong>은 기존 관리자가 안 빼는 것이다. 이미 끝난 건에 송장을 채울 일은 없다.
                        <span style="color:#92400e;">→ <strong>둘 다 일부러 다르게 둔 것이다. 맞추려 하지 말 것.</strong></span>
                    </div>
                    <div style="margin-top:6px; font-size:0.79rem; color:#64748b;">
                        2026-08-18 — ① 이탈건·매장방문이 새 앱 쪽에 섞여 있던 것을 뺐다.
                        ② 이 행의 '새 앱' 값이 <code style="background:#f1f5f9;">trackingNumber=="미입력"</code> 서버 쿼리라
                        <strong>새 앱과 정반대 집합</strong>을 세고 있던 것을 고쳤다.
                        ③ 차이를 <code style="background:#f1f5f9;">'미입력'</code> 하나로만 설명해 뒀는데
                        실제로 돌려보니 안 맞아서, <strong>합이 맞는지 검산까지 하도록</strong> 고쳤다.
                    </div>`;
                })()
            },
            {
                name: '이탈건 (배송미선택)',
                nv: `${newApp.special.abandoned}건`,
                lv: `${legacy.special.abandoned}건`,
                diff: newApp.special.abandoned - legacy.special.abandoned,
                // ⚠️ 이 행은 두 판정이 같아서 **차이 문서가 원래 없다.**
                //    전에는 종결·삭제·외국인 1,388건을 칩으로 띄워서, `0 (일치)` 인데도
                //    "차이 문서가 1,388건" 인 것처럼 보였다. **설명과 칩이 어긋나면 둘 다 못 믿게 된다.**
                mismatched: newApp.special.abandoned === legacy.special.abandoned ? [] :
                    allDocs.filter(({ d, st, isDel, isFor }) => (!d.deliveryMethod || d.deliveryMethod === 'pending') && !isDel && !isFor && !TERMINAL_STATUSES.includes(st)).map(x => x.id),
                // ⭐ 이 행은 **0이 나와야 정상이다.** 두 기준이 글자 그대로 같기 때문이다.
                //    0이 아니면 어느 한쪽이 바뀐 것이고, 그건 반드시 봐야 하는 신호다.
                reason: `<div style="color:#334155;">
                        기존 관리자 <code style="background:#f1f5f9;">!deliveryMethod || =='pending'</code> · 종결 제외 (admin.js 5073줄)<br>
                        새 앱 <code style="background:#f1f5f9;">isDropoff()</code> = <code style="background:#f1f5f9;">rawDeliveryMethod</code> 가 <code style="background:#f1f5f9;">''</code> 또는 <code style="background:#f1f5f9;">'pending'</code> · 진행중만
                    </div>
                    <div style="margin-top:8px; background:${newApp.special.abandoned === legacy.special.abandoned ? '#f0fdf4' : '#fef2f2'}; border:1px solid ${newApp.special.abandoned === legacy.special.abandoned ? '#86efac' : '#fca5a5'}; border-radius:8px; padding:10px 13px; font-size:0.84rem; line-height:1.8; color:#334155;">
                        <strong>두 판정은 글자 그대로 같다. 그래서 이 행은 <u>0이 나와야 정상이다.</u></strong><br>
                        ${newApp.special.abandoned === legacy.special.abandoned
                            ? '<span style="color:#166534; font-weight:700;">✅ 일치 — 어느 쪽도 바뀌지 않았다.</span>'
                            : '<span style="color:#b91c1c; font-weight:700;">⚠️ 안 맞는다. 둘 중 하나가 바뀌었다는 뜻이니 반드시 원인을 찾을 것.</span>'}
                        <div style="margin-top:6px; font-size:0.79rem; color:#64748b;">
                            삭제·외국인 <strong>${newApp.abExcluded || 0}건</strong>은 양쪽 다 안 세므로 뺐다.
                        </div>
                    </div>
                    <div style="margin-top:8px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:9px 12px; font-size:0.82rem; line-height:1.7; color:#78350f;">
                        2026-08-18 — 전에는 이 행이 <code style="background:#fef3c7;">where deliveryMethod=='pending'</code> 서버 쿼리라 1,469 vs 122 로 벌어져 있었다.<br>
                        ⚠️⚠️ <strong>이탈건은 서버 카운트로 셀 수 없다.</strong> 대상의 상당수가
                        <code style="background:#fef3c7;">deliveryMethod</code> <strong>필드가 아예 없는 문서</strong>인데,
                        Firestore 는 "필드 없음" 을 조회할 수 없다. <strong>원리상 불가능</strong>하다.
                        그래서 이미 훑어둔 문서로 센다 — <strong>조회는 하나도 늘지 않는다.</strong>
                    </div>`
            }
        ];

        // ⚠️ 이 절은 서버 쿼리를 쓰지 않는다(위 계산 블록 주석 참고). 그래서
        //    '조회 실패' 를 따로 처리하지 않는다 — 실패할 쿼리가 없다.
        //    전체 훑기가 실패하면 이 절 자체가 그려지지 않는다.
        specialTbody.innerHTML = specialRows.map(r => `
            <tr>
                <td style="font-weight:bold;">${r.name}</td>
                <td style="font-weight:bold; color:#2563eb;">${r.nv}</td>
                <td style="font-weight:bold; color:#475569;">${r.lv}</td>
                <td>${formatDiffBadge(r.diff)}</td>
                <td>
                    <div style="font-size:0.83rem; color:#475569; margin-bottom:4px;">${r.reason}</div>
                    ${buildDocChips(r.mismatched)}
                </td>
            </tr>
        `).join('');
    }

    // 5. Trash Table
    const trashTbody = document.getElementById('reconcile-trash-tbody');
    if (trashTbody) {
        const tDiff = newApp.trash - legacy.trash;
        const trashMismatched = allDocs.filter(({ d, st, isDel }) => (isDel || st === '삭제') && !(isDel && st === '삭제')).map(x => x.id);

        trashTbody.innerHTML = `
            <tr>
                <td style="font-weight:bold;">휴지통 (Trash)</td>
                <td style="font-weight:bold; color:#2563eb;">${newApp.trash}건</td>
                <td style="font-weight:bold; color:#475569;">${legacy.trash}건</td>
                <td>${formatDiffBadge(tDiff)}</td>
                <td>
                    <div style="font-size:0.83rem; color:#475569; margin-bottom:4px;">
                        새 앱 쿼리: <code style="background:#f1f5f9;">where("isDeleted", "==", true)</code> (복합 인덱스 <code style="background:#e0f2fe; color:#0369a1;">quotes(isDeleted, firebaseTimestamp)</code> 사용)
                    </div>
                    ${buildDocChips(trashMismatched)}
                </td>
            </tr>
        `;
    }
}



// ═══════════════════════════════════════════════════════════════════════════
// 방문수거 일자별 안내 — 일괄 알림톡
// ---------------------------------------------------------------------------
// ⚠️⚠️ 이 화면의 발송 버튼은 **고객에게 실제로 알림톡을 보낸다. 되돌릴 수 없다.**
//
// 【이 화면이 지키는 것】
//
//  ① 확정 수거일과 고객 희망일을 **절대 합치지 않는다**
//       goodsflowPickupRequestDateTime  '2026-08-18T10:00'  ← 기사가 실제로 가는 날
//       pickupDate                      '08/18'             ← 고객이 고른 희망일. **연도가 없다**
//     합쳐 세면 "그날 방문할 건"이 부풀려진다. 그래서 목록을 둘로 나눈다.
//     ❌ pickupDate 에 연도를 붙여 Date 로 만들지 않는다 —
//        연말·연초에 한 해가 통째로 어긋나고 그 오류는 화면에 안 보인다. 문자열로 비교한다.
//
//  ② **매입신청일자(접수일)와 방문수거일자는 완전히 다른 날짜다.** 이 화면은 후자만 다룬다.
//
//  ③ 신청건은 **하나도 지우거나 숨기지 않는다.** 같은 기종 두 대를 파는 건 진짜 두 건이다.
//     목록·CSV 는 건별로 전부 나오고, **발송만 사람(연락처) 단위로 묶는다.**
//     한 사람이 알림톡을 세 번 받으면 안 되기 때문이다.
//
//  ④ 발송 표시는 **성공한 뒤에만** 남긴다. 먼저 찍고 보내면 실패해도 '보냄'으로 남아
//     영영 재시도가 안 된다. (7월 미집하 안내 건이 그 상태였다)
//     한 사람의 그날 건 **전부에** 찍는다 — 한 건에만 찍으면 다음에 또 보내게 된다.
//
// 【알림톡 템플릿】 방문수거일 안내 (2026-08-13 검수 승인)
//   변수 3개 — #{고객성함} · #{방문수거일자} · #{고객주소}
//   ⚠️ 변수명이 한 글자라도 다르면 솔라피가 **조용히 실패한다.** 화면에 실패로 뜬다.
// ═══════════════════════════════════════════════════════════════════════════

const PICKUP_NOTICE_TEMPLATE_ID = "KA01TP260813021541277XfV1KwbL0Me";

// ⚠️⚠️ **여기에 limit 을 붙이면 안 된다.**
//    이 조회는 `orderBy("status")` 가 먼저다(색인 순서). limit 을 붙이면 최근 건이 아니라
//    **상태값 가나다순으로 잘린다.** 어떤 상태의 고객이 통째로 빠져도 화면에는 안 보인다.
//    기존 신청관리 목록(loadQuotes)도 같은 이유로 limit 없이 진행중 전체를 받아온다.

// ═══════════════════════════════════════════════════════════════════════════
// 사무실 이사 — 옛 주소로 접수된 예약 표시 (2026-08-18)
// ---------------------------------------------------------------------------
// 굿스플로는 예약을 만들 때 **받는 곳(쉐라폰 사무실) 주소를 통째로 실어 보낸다.**
// 그래서 주소를 바꿔 배포해도 **이미 만들어진 예약은 소급되지 않는다.**
// 그 건들은 기기가 **옛 사무실로 배달된다.**
//
// 문서에 '어느 주소로 접수됐는지'는 저장되지 않으므로, **예약 시각으로만** 가른다.
//
// ⚠️⚠️ **정확한 배포 시각을 모르면 늦게 잡는다.**
//    늦게 잡으면 → 새 주소 건이 '옛 주소'로 잘못 떠서 한 번 더 확인할 뿐이다
//    이르게 잡으면 → **옛 주소 건을 놓치고 물건이 어디 갔는지 모르게 된다**
//    그래서 배포한 날 **하루를 통째로** 옛 주소로 본다.
//
// 이사가 끝나고 옛 주소 건이 전부 처리되면 이 블록은 지워도 된다.
// ═══════════════════════════════════════════════════════════════════════════
const PN_OLD_ADDRESS_BEFORE = new Date('2026-08-19T00:00:00+09:00');
const PN_OLD_ADDRESS_TEXT = '부산시 동천로 116 한신밴빌딩 1003호';

function _pnIsOldAddress(d) {
    if (!d.goodsflowOrderNo) return false;              // 예약이 없으면 해당 없음 (앞으로 잡으면 새 주소)
    const at = _toDateForList(d.goodsflowBookedAt);
    if (!at) return true;                               // ⚠️ 예약은 있는데 시각을 모르면 옛 주소로 본다
    return at < PN_OLD_ADDRESS_BEFORE;
}

let _pnDocs = [];          // 이번 조회로 받아온 진행중 건 (원본)
let _pnDate = '';          // 고른 날짜 'YYYY-MM-DD'
let _pnSelected = new Set();
let _pnSending = false;

const _pnEsc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── 판정 함수 (직원 앱 src/lib/delivery.ts 와 같은 규칙) ───────────────────────
const PN_TERMINAL = ['입금완료', '취소', '반송접수', '삭제'];
const PN_B_STATUSES = ['택배도착', '검수중', '검수완료', '입금대기', '반송대기'];

function _pnIsForeigner(d) {
    // ⚠️ method(접수방식)와 deliveryMethod(수거방법)는 완전히 다른 필드다. 폴백으로 묶지 말 것.
    return d.isForeigner === true || d.method === 'foreigner'
        || d.series === 'Foreigner' || d.deliveryMethod === 'Foreigner Pickup';
}

// 주소로 기사가 찾아가는 수거방법만. cvs(편의점)·visit(매장 방문)은 배차 자체가 없다.
// ⚠️ 'visit' 은 **고객이 직접 온다**는 뜻이다. '방문 수거'가 아니다.
function _pnNeedsAddress(dm) { return dm === 'courier' || dm === 'pickup'; }

// 물건이 아직 우리 손에 안 들어온 건인지 — 두 목록의 공통 전제
function _pnBeforeArrival(d) {
    if (PN_TERMINAL.includes(d.status)) return false;
    if (d.isDeleted === true) return false;
    if (d.arrivedAt) return false;
    if (PN_B_STATUSES.includes(d.status)) return false;
    return true;
}

// 확정 수거일 'YYYY-MM-DD'. 예약이 없으면 빈 문자열
function _pnRequestDateKey(d) {
    const m = String(d.goodsflowPickupRequestDateTime || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

function _pnIsScheduled(d) {
    if (!_pnBeforeArrival(d)) return false;
    if (d.goodsflowAlert === 'PICKUP_FAILED') return false;   // 이미 방문이 끝난 건
    return _pnRequestDateKey(d) !== '';
}

function _pnIsUnbooked(d) {
    if (!_pnBeforeArrival(d)) return false;
    if (d.goodsflowOrderNo) return false;
    if (_pnRequestDateKey(d) !== '') return false;
    return _pnNeedsAddress(d.deliveryMethod);
}

// 'YYYY-MM-DD' → 'MM/DD'  (고객 희망일과 맞춰보기 위한 형식)
function _pnToMonthDay(ymd) {
    const m = String(ymd).match(/^\d{4}-(\d{2})-(\d{2})$/);
    return m ? `${m[1]}/${m[2]}` : '';
}

// 'MM/DD' → '8월 18일'  — 알림톡 #{방문수거일자} 에 들어갈 문구
// ⚠️ 연도·요일을 붙이지 않는다. 희망일에는 연도가 없어서 추측이 들어가면 틀릴 수 있다.
function _pnDateLabel(mmdd) {
    const m = String(mmdd).match(/^(\d{1,2})\/(\d{1,2})$/);
    return m ? `${Number(m[1])}월 ${Number(m[2])}일` : String(mmdd || '');
}

function _pnRowMonthDay(d) {
    const key = _pnRequestDateKey(d);
    if (key) return _pnToMonthDay(key);              // 확정 건 — 기사가 실제로 가는 날
    return String(d.pickupDate || '').trim();        // 미배차 건 — 고객 희망일
}

// #{고객주소} — 상세주소까지 합친다. 없으면 빈 문자열(발송 대상에서 뺀다)
function _pnAddress(d) {
    const a = String(d.customerAddress || '').trim();
    const b = String(d.customerAddressDetail || '').trim();
    // 'customerAddress' 에 '편의점/직접 택배 발송' 문자열이 들어가는 건이 있다 — 주소가 아니다
    if (!a || a.indexOf('편의점') >= 0 || a.indexOf('직접 택배') >= 0) return '';
    return (a + ' ' + b).trim();
}

function _pnPhone(d) {
    const p = String(d.customerPhone || '').replace(/\D/g, '');
    if (p.length < 9) return '';                 // 가짜·미입력 번호
    if (/^(\d)\1+$/.test(p)) return '';          // 같은 숫자 반복
    return p;
}

function _pnModel(d) {
    return [d.brand, d.model, d.storage].filter(Boolean).join(' ').trim() || '-';
}

// ── 조회 ──────────────────────────────────────────────────────────────────
window.loadPickupNotice = async () => {
    const chips = document.getElementById('pn-date-chips');
    const note = document.getElementById('pn-scan-note');
    if (!chips) return;
    if (_pnSending) { alert('발송이 진행 중입니다. 끝난 뒤에 다시 불러오세요.'); return; }

    chips.innerHTML = '<span style="color:#94a3b8; font-size:0.9rem;">불러오는 중...</span>';
    if (note) note.textContent = '';
    _pnSelected = new Set();

    try {
        // 기존 목록과 **같은 색인**(status + firebaseTimestamp)을 탄다. 새 인덱스가 필요 없다.
        // B구간은 메모리에서 다시 걸러낸다(_pnBeforeArrival).
        const snap = await getDocs(query(
            collection(db, "quotes"),
            where("status", "not-in", PN_TERMINAL),
            orderBy("status"),
            orderBy("firebaseTimestamp", "desc")
        ));

        _pnDocs = [];
        snap.forEach(s => {
            const d = s.data();
            if (_pnIsForeigner(d)) return;     // 외국인 건은 다른 흐름이다
            _pnDocs.push({ id: s.id, ...d });
        });

        if (note) {
            note.textContent = `진행중 ${snap.size}건 전체를 확인했습니다.`
                + ` (외국인 건 ${snap.size - _pnDocs.length}건 제외)`;
        }

        // 확정 수거일별로 묶어 날짜 칩을 만든다 (가까운 날 먼저)
        const map = new Map();
        _pnDocs.forEach(d => {
            if (!_pnIsScheduled(d)) return;
            const k = _pnRequestDateKey(d);
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(d);
        });
        const dates = [...map.keys()].sort();

        if (dates.length === 0) {
            chips.innerHTML = '<span style="color:#94a3b8; font-size:0.9rem;">수거 예약이 잡힌 건이 없습니다.</span>';
            _pnDate = '';
            _pnRender();
            return;
        }

        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (!_pnDate || !map.has(_pnDate)) {
            _pnDate = dates.find(x => x >= todayKey) || dates[dates.length - 1];
        }

        chips.innerHTML = dates.map(k => {
            const on = k === _pnDate;
            const past = k < todayKey;
            const shifted = map.get(k).filter(d => d.goodsflowPickupDateShifted).length;
            return `<button onclick="pnPickDate('${k}')" style="
                border:1px solid ${on ? '#2563eb' : '#e2e8f0'};
                background:${on ? '#eff6ff' : 'white'};
                color:${past && !on ? '#94a3b8' : '#0f172a'};
                font-weight:${on ? '700' : '500'};
                padding:7px 13px; border-radius:8px; cursor:pointer; font-size:0.88rem;">
                ${_pnToMonthDay(k)}
                <span style="color:#64748b; margin-left:4px;">${map.get(k).length}</span>
                ${shifted > 0 ? `<span title="고객이 고른 날과 실제 수거일이 다른 건이 있습니다." style="margin-left:5px; background:#fef3c7; color:#b45309; padding:1px 5px; border-radius:4px; font-size:0.72rem; font-weight:700;">변경 ${shifted}</span>` : ''}
            </button>`;
        }).join('');

        _pnRender();
    } catch (e) {
        console.error('방문수거 안내 조회 실패:', e);
        // ⚠️ 실패를 빈 목록으로 보여주지 않는다. 원문 오류를 그대로 띄운다.
        chips.innerHTML = `<div style="color:#b91c1c; font-size:0.88rem;">
            조회에 실패했습니다. <strong>데이터가 없는 것이 아닙니다.</strong><br>
            <code style="background:#fef2f2; padding:2px 6px; border-radius:4px;">${_pnEsc(e.message)}</code>
        </div>`;
    }
};

window.pnPickDate = (ymd) => {
    if (_pnSending) return;
    _pnDate = ymd;
    _pnSelected = new Set();
    window.loadPickupNotice();
};

// ── 목록 그리기 ────────────────────────────────────────────────────────────
function _pnCurrentRows() {
    if (!_pnDate) return { scheduled: [], unbooked: [] };
    const md = _pnToMonthDay(_pnDate);

    const scheduled = _pnDocs
        .filter(d => _pnIsScheduled(d) && _pnRequestDateKey(d) === _pnDate)
        .sort((a, b) => String(a.goodsflowPickupRequestDateTime).localeCompare(String(b.goodsflowPickupRequestDateTime)));

    // 희망일은 연도가 없어 월·일로만 맞춰본다
    const unbooked = _pnDocs.filter(d => _pnIsUnbooked(d) && String(d.pickupDate || '').trim() === md);

    return { scheduled, unbooked };
}

// 같은 연락처가 몇 건인지 — 행에 표시만 한다. **묶거나 숨기지 않는다.**
//
// ⚠️⚠️ **두 목록을 합쳐서 세지 않는다. 목록별로 따로 센다.**
//    합쳐 세면, 배차가 안 된 건까지 '이 고객 3건' 숫자에 들어간다.
//    기사는 그날 3대를 받는 줄 알고 가는데 실제로 나올 건 1대다.
//    (직원 앱 PickupDatePage 도 같은 규칙이다 — 두 화면이 어긋나면 대조가 안 된다)
//
// ⚠️ 못 믿을 번호(가짜·미입력)는 뱃지를 안 붙인다. `_pnPhone` 이 빈 값을 주므로
//    한 덩어리로 묶이면 '이 고객 27건' 같은 게 뜬다.
function _pnPhoneCounts(rows) {
    const c = new Map();
    rows.forEach(d => {
        const p = _pnPhone(d);
        if (p) c.set(p, (c.get(p) || 0) + 1);
    });
    return c;
}

// 고객 수 — 번호 기준. **못 믿을 번호는 각각 다른 사람으로 센다.**
// 빈 값으로 묶으면 서로 다른 사람 여럿이 1명으로 합쳐진다.
function _pnCustomerCount(rows) {
    const seen = new Set();
    let unknown = 0;
    rows.forEach(d => {
        const p = _pnPhone(d);
        if (p) seen.add(p); else unknown++;
    });
    return seen.size + unknown;
}

function _pnRowHtml(d, counts, withScheduleCols) {
    const phone = _pnPhone(d);
    const addr = _pnAddress(d);
    const sentAt = _toDateForList(d.pickupNoticeSentAt);
    const dup = phone ? (counts.get(phone) || 0) : 0;

    // 발송할 수 없는 건은 체크 자체를 막고 이유를 쓴다
    let blocked = '';
    if (!phone) blocked = '연락처 없음';
    else if (!addr) blocked = '주소 없음';

    const checked = _pnSelected.has(d.id) ? 'checked' : '';
    const box = blocked
        ? `<span title="${blocked}" style="color:#dc2626; font-size:0.75rem; font-weight:700;">✕</span>`
        : `<input type="checkbox" ${checked} onchange="pnToggle('${d.id}', this.checked)" style="width:16px; height:16px; cursor:pointer;">`;

    const sentBadge = sentAt
        ? `<span style="background:#dcfce7; color:#166534; padding:2px 7px; border-radius:5px; font-size:0.75rem; font-weight:700;">발송함</span>
           <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">${sentAt.toLocaleString('ko-KR')}</div>
           ${d.pickupNoticeSentBy ? `<div style="font-size:0.7rem; color:#94a3b8;">${_pnEsc(d.pickupNoticeSentBy)}</div>` : ''}`
        : (blocked
            ? `<span style="color:#dc2626; font-size:0.78rem; font-weight:600;">${blocked} — 발송 불가</span>`
            : '<span style="color:#cbd5e1; font-size:0.78rem;">—</span>');

    const dupBadge = dup > 1
        ? `<div style="font-size:0.72rem; color:#b45309; background:#fef3c7; display:inline-block; padding:1px 6px; border-radius:4px; margin-top:3px; font-weight:600;">이 고객 ${dup}건</div>`
        : '';

    const shifted = d.goodsflowPickupDateShifted;
    const wishCell = shifted
        ? `<span title="고객이 고른 날로 접수가 안 돼 자동으로 옮겨졌습니다. 고객이 그 사실을 아는지는 알 수 없습니다." style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700; white-space:nowrap;">${_pnEsc(d.pickupDate || '희망일 없음')} → 변경됨</span>`
        : `<span style="color:#64748b;">${_pnEsc(d.pickupDate || '-')}</span>`;

    // ⚠️ 이사 — 옛 주소로 접수된 예약. 기기가 **옛 사무실로 배달된다.**
    const oldAddr = _pnIsOldAddress(d)
        ? `<div title="이 예약은 주소 변경 전에 접수돼서 받는 곳이 '${PN_OLD_ADDRESS_TEXT}' 로 들어가 있습니다. 굿스플로에서 소급 변경되지 않습니다." style="margin-top:4px; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; font-size:0.72rem; font-weight:700; display:inline-block;">옛 주소</div>`
        : '';

    const schedCell = withScheduleCols
        ? `<td style="white-space:nowrap; font-weight:600;">${_pnEsc(String(d.goodsflowPickupRequestDateTime || '').replace('T', ' ').slice(5, 16))}${oldAddr}</td>`
        : '';

    return `<tr style="${blocked ? 'background:#fef2f2;' : ''}">
        <td style="text-align:center;">${box}</td>
        <td>${_pnEsc(d.customerName || '-')}${dupBadge}</td>
        <td style="white-space:nowrap;">${_pnEsc(d.customerPhone || '-')}</td>
        <td style="font-size:0.85rem;">${_pnEsc(_pnModel(d))}</td>
        ${schedCell}
        <td>${wishCell}</td>
        <td style="font-size:0.8rem; color:#475569;">${_pnEsc(addr || (d.customerAddress || '-'))}</td>
        <td>${sentBadge}</td>
    </tr>`;
}

function _pnRender() {
    const { scheduled, unbooked } = _pnCurrentRows();
    // ★ 목록별로 따로 센다. 합치지 않는다 (_pnPhoneCounts 주석 참고)
    const sCounts = _pnPhoneCounts(scheduled);
    const uCounts = _pnPhoneCounts(unbooked);

    const sTbody = document.getElementById('pn-scheduled-tbody');
    const uTbody = document.getElementById('pn-unbooked-tbody');
    const toolbar = document.getElementById('pn-toolbar');

    // 건수와 고객 수를 **같이** 보여준다. 건수만 보이면 알림톡이 몇 명에게 나가는지 모른다
    document.getElementById('pn-scheduled-count').textContent =
        `${scheduled.length}건 · 고객 ${_pnCustomerCount(scheduled)}명`;
    document.getElementById('pn-unbooked-count').textContent =
        `${unbooked.length}건 · 고객 ${_pnCustomerCount(unbooked)}명`;

    // ⚠️ 이사 — 이 날짜에 옛 주소로 배달될 건이 몇 개인지 맨 위에 알린다.
    //    목록 안 뱃지만 있으면 스크롤하다 놓친다.
    const oldNote = document.getElementById('pn-old-address-note');
    if (oldNote) {
        const n = scheduled.filter(_pnIsOldAddress).length;
        if (n === 0) {
            oldNote.style.display = 'none';
        } else {
            oldNote.style.display = 'block';
            oldNote.innerHTML = `
                <div style="font-weight:700; color:#b91c1c; margin-bottom:6px;">
                    ⚠️ 이 날짜의 ${scheduled.length}건 중 ${n}건은 <u>옛 사무실로 배달됩니다</u>
                </div>
                <div style="color:#7f1d1d; font-size:0.86rem; line-height:1.7;">
                    주소를 바꾸기 전에 접수된 예약이라 받는 곳이
                    <strong>${_pnEsc(PN_OLD_ADDRESS_TEXT)}</strong> 로 들어가 있습니다.
                    굿스플로에서 <strong>소급해서 바뀌지 않습니다.</strong><br>
                    목록에서 <span style="background:#fee2e2; color:#b91c1c; padding:1px 6px; border-radius:4px; font-size:0.78rem; font-weight:700;">옛 주소</span>
                    가 붙은 건이 그것입니다. 옛 사무실에서 받거나, 한진택배 고객센터에
                    운송장번호(간선)로 배송지 변경을 요청하세요.
                </div>`;
        }
    }

    sTbody.innerHTML = scheduled.length
        ? scheduled.map(d => _pnRowHtml(d, sCounts, true)).join('')
        : '<tr><td colspan="8" class="text-center">이 날짜에 잡힌 수거 예약이 없습니다.</td></tr>';

    uTbody.innerHTML = unbooked.length
        ? unbooked.map(d => _pnRowHtml(d, uCounts, false)).join('')
        : '<tr><td colspan="7" class="text-center">이 희망일로 남아 있는 미배차 건이 없습니다.</td></tr>';

    if (toolbar) toolbar.style.display = _pnDate ? 'block' : 'none';
    _pnUpdateSummary();
}

window.pnToggle = (id, on) => {
    if (on) _pnSelected.add(id); else _pnSelected.delete(id);
    _pnUpdateSummary();
};

// 전체 선택 — **이미 보낸 건은 빼고** 고른다. 두 번 보내는 사고를 기본값으로 만들지 않는다.
window.pnSelectAll = (on) => {
    const { scheduled, unbooked } = _pnCurrentRows();
    [...scheduled, ...unbooked].forEach(d => {
        if (!on) { _pnSelected.delete(d.id); return; }
        if (!_pnPhone(d) || !_pnAddress(d)) return;
        if (d.pickupNoticeSentAt) return;
        _pnSelected.add(d.id);
    });
    _pnRender();
};

// 선택한 건을 **연락처 단위로** 묶는다. 발송은 사람당 한 번이다.
function _pnBuildTargets() {
    const { scheduled, unbooked } = _pnCurrentRows();
    const picked = [...scheduled, ...unbooked].filter(d => _pnSelected.has(d.id));

    const map = new Map();   // phone → { name, mmdd, addr, ids[], resend }
    picked.forEach(d => {
        const phone = _pnPhone(d);
        const addr = _pnAddress(d);
        if (!phone || !addr) return;
        const g = map.get(phone);
        if (g) {
            g.ids.push(d.id);
            if (d.pickupNoticeSentAt) g.resend = true;
        } else {
            map.set(phone, {
                phone,
                name: String(d.customerName || '고객').trim() || '고객',
                mmdd: _pnRowMonthDay(d),
                addr,
                ids: [d.id],
                resend: !!d.pickupNoticeSentAt
            });
        }
    });
    return [...map.values()];
}

function _pnUpdateSummary() {
    const el = document.getElementById('pn-selection-summary');
    if (!el) return;
    const targets = _pnBuildTargets();
    const resend = targets.filter(t => t.resend).length;
    // ⚠️ 두 숫자를 **같이** 보여준다. '27명' 만 보이면 32건을 골랐는데 왜 줄었는지
    //    몰라서 선택이 잘못된 줄 안다
    el.innerHTML = `선택 <strong style="color:#2563eb;">${_pnSelected.size}건</strong>`
        + ` → 발송 <strong style="color:#ea580c;">${targets.length}명</strong>`
        + (_pnSelected.size !== targets.length
            ? ` <span style="color:#64748b; font-weight:400; font-size:0.86rem;">(같은 번호는 한 번만 — 안내가 두 번 가지 않게)</span>`
            : '')
        + (resend > 0 ? ` <span style="color:#b45309;">(재발송 ${resend}명)</span>` : '');
}

// ── CSV — **건별로 전부** 내보낸다. 기기 확인용이라 묶지 않는다 ─────────────────
window.pnExportCsv = () => {
    const { scheduled, unbooked } = _pnCurrentRows();
    const rows = [['구분', '이름', '연락처', '기종', '수거 예정', '고객 희망일', '수거일 변경', '주소', '발송 이력']];
    const push = (d, kind) => rows.push([
        kind,
        d.customerName || '',
        d.customerPhone || '',
        _pnModel(d),
        String(d.goodsflowPickupRequestDateTime || '').replace('T', ' '),
        d.pickupDate || '',
        d.goodsflowPickupDateShifted ? '변경됨' : '',
        _pnAddress(d) || (d.customerAddress || ''),
        _toDateForList(d.pickupNoticeSentAt) ? _toDateForList(d.pickupNoticeSentAt).toLocaleString('ko-KR') : ''
    ]);
    scheduled.forEach(d => push(d, '수거예정'));
    unbooked.forEach(d => push(d, '배차안됨'));

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `방문수거_${_pnDate}_${scheduled.length + unbooked.length}건.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
};

// ── 발송 ──────────────────────────────────────────────────────────────────
window.sendPickupNoticeBatch = async () => {
    if (_pnSending) return;

    const targets = _pnBuildTargets();
    if (targets.length === 0) {
        alert('발송할 대상이 없습니다.\n\n먼저 목록에서 보낼 건을 선택하세요.\n(연락처나 주소가 없는 건은 발송할 수 없습니다)');
        return;
    }

    // 날짜가 섞였는지 확인 — 대부분 한 날짜지만, 미배차 건의 희망일이 비어 있을 수 있다
    const noDate = targets.filter(t => !t.mmdd);
    if (noDate.length) {
        alert(`방문수거일자가 비어 있는 건이 ${noDate.length}명 있습니다.\n\n`
            + `알림톡에 날짜가 빈칸으로 나가면 안 되므로 발송을 중단합니다.\n`
            + `해당 건의 선택을 해제하고 다시 시도하세요.\n\n`
            + noDate.map(t => `· ${t.name} ${t.phone}`).join('\n'));
        return;
    }

    const dateSet = [...new Set(targets.map(t => _pnDateLabel(t.mmdd)))];
    const resend = targets.filter(t => t.resend);
    const quoteCount = targets.reduce((n, t) => n + t.ids.length, 0);

    const msg = `방문수거일 안내 알림톡을 보냅니다.\n\n`
        + `· 받는 사람: ${targets.length}명 (신청건 ${quoteCount}건)\n`
        + `· 안내 날짜: ${dateSet.join(' / ')}\n`
        + (resend.length ? `\n⚠️ 이미 보낸 적 있는 고객이 ${resend.length}명 포함돼 있습니다.\n   그 고객은 알림톡을 두 번 받게 됩니다.\n` : '')
        + `\n한 번 나가면 되돌릴 수 없습니다. 진행할까요?`;
    if (!confirm(msg)) return;

    // 되돌릴 수 없는 발송이라 확인을 한 번 더 받는다
    if (!confirm(`정말 ${targets.length}명에게 발송합니다.\n\n마지막 확인입니다.`)) return;

    _pnSending = true;
    const btn = document.getElementById('pn-send-btn');
    const log = document.getElementById('pn-progress');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; }
    if (log) { log.style.display = 'block'; log.textContent = `발송을 시작합니다... (0/${targets.length})\n`; }

    const who = (document.getElementById('admin-email')?.textContent || '관리자').trim();
    const fails = [];
    let done = 0;

    for (const t of targets) {
        try {
            const res = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/alimtalkApi/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: t.phone,
                    templateId: PICKUP_NOTICE_TEMPLATE_ID,
                    // ⚠️ 변수명은 솔라피 템플릿과 **글자 그대로** 같아야 한다
                    variables: {
                        "#{고객성함}": t.name,
                        "#{방문수거일자}": _pnDateLabel(t.mmdd),
                        "#{고객주소}": t.addr
                    }
                })
            });
            const out = await res.json().catch(() => ({}));

            if (!res.ok || out.error) {
                throw new Error(out.error || out.details || `HTTP ${res.status}`);
            }

            // ★ 성공한 뒤에만 표시를 남긴다. 그리고 **그 사람의 그날 건 전부에** 찍는다.
            for (const id of t.ids) {
                await updateDoc(doc(db, "quotes", id), {
                    pickupNoticeSentAt: serverTimestamp(),
                    pickupNoticeSentBy: who,
                    pickupNoticeDate: _pnDateLabel(t.mmdd),
                    pickupNoticeTemplateId: PICKUP_NOTICE_TEMPLATE_ID
                });
            }

            done++;
            if (log) log.textContent += `✅ ${t.name} ${t.phone} — ${_pnDateLabel(t.mmdd)} (${t.ids.length}건 표시)\n`;
        } catch (e) {
            fails.push(`${t.name} ${t.phone} — ${e.message}`);
            if (log) log.textContent += `❌ ${t.name} ${t.phone} — ${e.message}\n`;
        }
        if (log) log.scrollTop = log.scrollHeight;
        // 솔라피에 한꺼번에 몰리지 않게 살짝 띄운다
        await new Promise(r => setTimeout(r, 250));
    }

    _pnSending = false;
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
    if (log) log.textContent += `\n─────────────\n완료: 성공 ${done}명 / 실패 ${fails.length}명\n`;

    alert(`발송이 끝났습니다.\n\n성공 ${done}명\n실패 ${fails.length}명`
        + (fails.length ? `\n\n실패 목록:\n${fails.join('\n')}\n\n실패한 건은 '발송함' 표시가 남지 않으므로 다시 보낼 수 있습니다.` : ''));

    _pnSelected = new Set();
    window.loadPickupNotice();
};
