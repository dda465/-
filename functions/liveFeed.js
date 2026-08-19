// ════════════════════════════════════════════════════════════════
// 홈페이지 실시간 접수 피드 (sharaphone.com 메인)
// ════════════════════════════════════════════════════════════════
//
// ⚠️ 이 파일은 새로 추가된 것이다. 기존 index.js 의 함수들은 건드리지 않는다.
//    index.js 맨 아래에 require 한 줄만 추가돼 있다.
//
// ─────────────────────────────────────────────────────────────
// ⭐ 왜 브라우저가 quotes 를 직접 읽지 않게 하는가 — 가장 중요한 이유
// ─────────────────────────────────────────────────────────────
// 예전 script.js 에는 홈에서 이런 코드가 있었다.
//
//     getDocs(query(collection(db,"quotes"), orderBy("firebaseTimestamp","desc"), limit(6)))
//
// 화면에는 모델과 시간만 그렸지만, **브라우저는 문서를 통째로 내려받는다.**
// 즉 customerName · customerPhone · customerAddress · customerAccount 가
// 방문자 누구에게나 개발자도구로 그대로 보인다.
// (보안 규칙이 `match /quotes/{id} { allow read: if true }` 라 막히지도 않는다)
//
// 그래서 이 함수가 **내보내도 되는 값만 골라** 요약 문서 하나에 적어두고,
// 홈페이지는 그 문서 하나만 읽는다.
//
//   내보내는 것   브랜드 · 모델 · 용량 · 등급(셀프접수만) · 접수시각
//   안 내보내는 것 이름 · 연락처 · 주소 · 계좌 · 금액 · 문서 ID
//
// ⚠️ 금액을 넣지 않는 이유
//    `price` 는 고객이 시세표에서 고른 **예상가**지 실제 매입가가 아니다.
//    검수 후 금액이 내려가면 "홈페이지에 44만원이라고 떴는데" 로 분쟁이 된다.
//
// ─────────────────────────────────────────────────────────────
// 저장 위치를 settings 로 잡은 이유
// ─────────────────────────────────────────────────────────────
//   settings   allow read: if true      ← 홈페이지(비로그인)가 읽어야 하므로 여기
//   stats      allow read: if isStaff() ← 직원만. 홈페이지가 못 읽는다
//
// 즉 **보안 규칙을 고칠 필요가 없다.** 쓰기는 `isAdmin()` 이라 브라우저가 못 쓰고,
// 이 함수는 관리자 SDK 라 규칙의 영향을 받지 않는다.
//
// 런타임 Node 20 / firebase-functions v4 (v2 API) / 리전 asia-northeast3
// ════════════════════════════════════════════════════════════════

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const REGION = "asia-northeast3";
const db = () => admin.firestore();

/** 피드에 남길 개수 — 최근 몇 건만 보여준다 (2026-08-11: 12 → 4) */
const FEED_SIZE = 4;
/** 후보로 훑는 개수 — 외국인·삭제를 걸러내고도 FEED_SIZE 가 차게 넉넉히 */
const SCAN_SIZE = 30;

const FEED_DOC = ["settings", "live_feed"];

// ── 제외 대상 ────────────────────────────────────────────────

/**
 * 외국인 건 판정 — 네 조건 중 하나라도 걸리면 외국인이다.
 *
 * ⚠️ 기존 admin.js 는 앞의 세 조건만 본다. 네 번째(`deliveryMethod`)까지 보는 게
 *    맞는 판정이라 여기서는 넷을 다 본다. 홈 피드는 대조 대상이 아니라
 *    숫자가 어긋날 걱정이 없다.
 */
function isForeigner(d) {
    return (
        d.isForeigner === true ||
        d.method === "foreigner" ||
        d.series === "Foreigner" ||
        d.deliveryMethod === "Foreigner Pickup"
    );
}

/**
 * 피드에 올리지 않을 상태.
 *
 * ⚠️ 목록에서 거르는 기준은 `status === '삭제'` 가 아니라 **`isDeleted` 플래그**다.
 *    종결 건은 삭제돼도 status 가 '입금완료' 그대로 남기 때문이다.
 *
 * ⭐ **이탈건(`deliveryMethod: 'pending'`)은 일부러 뺀다 — 즉 피드에 올린다.**
 *    신청 문서는 고객이 본인인증을 마친 그 순간 만들어진다
 *    (script.js 4197줄 "1차 접수(리드 확보)", `status:'신청접수'` · `deliveryMethod:'pending'`).
 *    배송방법을 안 고르고 나가도 "지금 사람들이 팔고 있다"는 사실은 맞다.
 *    그래서 `deliveryMethod` 로는 거르지 않는다. 2026-08-11 확정.
 */
const HIDDEN_STATUS = new Set(["취소", "삭제", "반송접수", "반송대기"]);

function isHidden(d) {
    return d.isDeleted === true || HIDDEN_STATUS.has(String(d.status || ""));
}

// ── 값 정리 ──────────────────────────────────────────────────

function str(v) {
    return typeof v === "string" ? v.trim() : "";
}

/**
 * 접수 시각. CLAUDE.md 2절 함정 ① 과 같은 순서를 쓴다.
 * 셋 다 없으면 null 을 돌려주고, 그런 건은 피드에서 뺀다
 * (시간을 모르면 "최근"인지 판단할 수 없다).
 */
function toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate();
    if (v.seconds) return new Date(v.seconds * 1000);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function submittedAt(d) {
    return toDate(d.submittedAt) || toDate(d.firebaseTimestamp) || toDate(d.timestamp);
}

/**
 * ⭐⭐ 등급은 **셀프접수 건만** 내보낸다.
 *
 * 간편접수(`method === 'simple'`)의 `grade` 는 고객이 고른 값이 아니라
 * 접수 코드가 자동으로 `'a'` 를 박아 넣은 것이다 (script.js 4529줄).
 * 그대로 내보내면 홈 피드가 **전부 A급**으로 도배되고,
 * 방문자에게는 "쉐라폰에 오는 폰은 다 A급" 이라는 잘못된 인상을 준다.
 *
 * → 간편접수는 등급을 비운다. 화면에서는 뱃지가 그냥 안 보인다.
 */
const GRADE_LABEL = {
    sealed: "미개봉",
    s: "S급",
    a: "A급",
    b: "B급",
    c: "C급",
    d: "D급",
};

function gradeLabel(d) {
    if (str(d.method) === "simple") return "";          // ★ 자동 'a' 라서 뜻이 없다
    const g = str(d.grade).toLowerCase();               // ⚠️ 실제 값이 소문자다
    return GRADE_LABEL[g] || "";
}

/** 문서 하나 → 피드 한 줄. 내보낼 수 없는 건이면 null */
function toFeedItem(d) {
    if (isHidden(d) || isForeigner(d)) return null;

    const at = submittedAt(d);
    if (!at) return null;

    const model = str(d.model);
    if (!model) return null;                            // 모델이 없으면 보여줄 게 없다

    return {
        brand: str(d.brand),
        model,
        storage: str(d.storage),
        grade: gradeLabel(d),
        at: admin.firestore.Timestamp.fromDate(at),
    };
}

// ── 피드 다시 만들기 ─────────────────────────────────────────

/**
 * 최근 신청건을 훑어 피드 문서를 통째로 다시 쓴다.
 *
 * ⭐ 왜 "앞에 하나 끼워넣기" 가 아니라 매번 다시 만드는가
 *    ① 스스로 고쳐진다 — 문서가 비었거나 배포 전 건이 빠져 있어도 다음 접수에서 채워진다
 *    ② 그 사이 취소·삭제된 건이 피드에서 빠진다
 *    ③ 동시에 두 건이 들어와도 순서가 꼬이지 않는다
 *    읽기는 접수 1건당 40회뿐이라 비용은 사실상 없다.
 *
 * ⚠️ `orderBy('firebaseTimestamp')` 를 쓰는 이유 — **모든 문서에 있는 유일한 시각**이다.
 *    `submittedAt` 으로 정렬하면 그 필드가 없는 문서가 조회에서 통째로 빠진다.
 *    화면 순서는 아래에서 `submittedAt` 기준으로 다시 정렬한다 (CLAUDE.md 3-1 정렬 2단계).
 */
async function rebuildFeed() {
    const snap = await db()
        .collection("quotes")
        .orderBy("firebaseTimestamp", "desc")
        .limit(SCAN_SIZE)
        .get();

    // ⭐ 같은 사람이 여러 번 신청해도 **거르지 않는다** (2026-08-11 확정).
    //
    //   본인인증 단계에서 문서가 만들어지므로, 기종을 바꿔가며 두세 번 조회한 고객은
    //   문서도 그만큼 생긴다. 그래도 신청 하나하나가 다 유효한 접수라 그대로 보여준다.
    //
    //   ⚠️ 나중에 피드가 한 사람으로 도배되는 게 보이면, 여기서 customerPhone 을
    //      숫자만 남겨 Set 으로 걸러내면 된다. 연락처는 서버 안에서만 쓰고
    //      피드에는 절대 넣지 않는다.
    const items = [];
    snap.forEach((doc) => {
        const item = toFeedItem(doc.data());
        if (item) items.push(item);
    });

    items.sort((a, b) => b.at.toMillis() - a.at.toMillis());

    await db()
        .doc(FEED_DOC.join("/"))
        .set(
            {
                items: items.slice(0, FEED_SIZE),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

    return items.length;
}

// ── 트리거 ───────────────────────────────────────────────────

/**
 * 신청건이 새로 생기면 피드를 갱신한다.
 *
 * ⚠️ `onDocumentCreated` 다. 수정(`onDocumentWritten`)에 걸면 상태를 바꿀 때마다
 *    돌아서 하루 수백 번이 된다. 피드에 필요한 건 새 접수뿐이다.
 *
 * ⚠️ 실패해도 접수 자체에는 영향이 없다. 피드는 부가 기능이라
 *    오류를 던지지 않고 로그만 남긴다 (재시도로 접수가 막히면 안 된다).
 */
exports.updateLiveFeedOnCreate = onDocumentCreated(
    { document: "quotes/{quoteId}", region: REGION },
    async (event) => {
        try {
            const n = await rebuildFeed();
            console.log(`[liveFeed] 갱신 완료 — 후보 ${n}건 중 ${FEED_SIZE}건까지 저장`);
        } catch (e) {
            console.error("[liveFeed] 갱신 실패:", e);
        }
    }
);

/**
 * 최초 1회 채우기 / 문제 생겼을 때 손으로 다시 만들기.
 *
 * 배포 직후에는 피드 문서가 비어 있어 홈에 아무것도 안 뜬다.
 * 새 접수가 하나 들어오면 자동으로 채워지지만, 기다리지 않으려면 이걸 한 번 연다.
 *
 *   https://asia-northeast3-rejeuphone.cloudfunctions.net/rebuildLiveFeed
 *
 * ⚠️ 읽기 전용 요약을 다시 만들 뿐이라 신청건 데이터는 건드리지 않는다.
 */
exports.rebuildLiveFeed = onRequest({ region: REGION, cors: true }, async (req, res) => {
    try {
        const n = await rebuildFeed();
        res.json({ ok: true, scanned: n, saved: Math.min(n, FEED_SIZE) });
    } catch (e) {
        console.error("[liveFeed] 수동 갱신 실패:", e);
        res.status(500).json({ ok: false, error: e.message });
    }
});
