// ════════════════════════════════════════════════════════════════
// M360 연동 — 검수 세션 기록 조회 (1단계 · IMEI 자동 입력)
// ════════════════════════════════════════════════════════════════
//
// ⚠️ 이 파일은 **새로 추가된 것이다.** 기존 index.js 의 함수들은 건드리지 않는다.
//    index.js 맨 아래에 require 한 줄만 추가돼 있다.
//    (staffAuth.js · attendance.js · liveFeed.js 와 같은 방식)
//
// 【왜 서버에서 부르는가 — 이게 이 파일이 존재하는 이유다】
//   업무프로그램은 브라우저에서 도는 앱이다. 거기서 M360 을 직접 부르면
//   **인증 토큰이 앱 번들에 그대로 박힌다.** 개발자도구만 열면 누구나 꺼낸다.
//   그래서 토큰은 여기(.env)에만 두고, 앱은 이 함수를 부른다.
//
// 【이 함수는 아무것도 쓰지 않는다】
//   Firestore 에 쓰지 않는다. M360 에도 조회만 한다. 읽기 전용이다.
//   그래서 잘못 불러도 운영 데이터가 바뀌지 않는다.
//
// 【설정 — functions/.env 에만 넣는다. 코드에 박지 않는다】
//   M360_AUTH_CODE    대시보드의 「인증 코드」
//   M360_AUTH_TOKEN   대시보드의 「Auth-Token」 (표시하려면 M360 비밀번호가 필요)
//   M360_TESTING      true 면 가짜 응답으로 안전하게 시험한다. 기본 true
//
//   ⚠️⚠️ 베어러 토큰은 **두 값을 대시(-)로 이어붙인 것**이다.
//        `Bearer {인증코드}-{Auth-Token}` — 하나만으로는 인증되지 않는다.
//
//   ⚠️ 둘 중 하나라도 비어 있으면 **부르지 않고 분명한 오류를 돌려준다.**
//      조용히 빈 목록을 주면 "왜 아무것도 안 나오지"를 아무도 못 찾는다 (규칙 ⑥)
//
// 런타임 Node 20 / firebase-functions v4 (v2 API) / 리전 asia-northeast3
// 문서 요약: docs/m360-api-요약.md
// ════════════════════════════════════════════════════════════════

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const REGION = "asia-northeast3";
const db = () => admin.firestore();

const M360_BASE = "https://m360soft.com/api/customer/v2";

/** 응답을 기다리는 한계. 넘으면 끊고 오류를 돌려준다 (앱이 영영 도는 걸 막는다) */
const TIMEOUT_MS = 15000;

/** 한 번에 가져올 최대 개수. M360 문서상 한계는 100 이지만 목록용으로 이만큼이면 충분하다 */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

// ────────────────────────────────────────────────────────────────
// 직원 확인
// ────────────────────────────────────────────────────────────────
//
// ⚠️ 토큰 클레임만 보지 않고 staff 문서까지 읽는다.
//    퇴사 처리를 해도 그 사람 브라우저의 옛 토큰은 한동안 살아 있다.
//    문서를 봐야 그 순간 막힌다. (attendance.js requireStaff 와 같은 방식)

/** 검수 또는 재고 권한이 있는 재직 직원인지 확인한다 */
async function requireInspectionOrStock(request) {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const snap = await db().collection("staff").doc(auth.uid).get();
    if (!snap.exists) {
        throw new HttpsError("permission-denied", "직원으로 등록되지 않은 계정입니다.");
    }
    const s = snap.data() || {};
    if (s.active === false) {
        throw new HttpsError("permission-denied", "퇴사 처리된 계정입니다.");
    }

    const team = s.team || "";
    const perms = Array.isArray(s.perms) ? s.perms : [];
    // 관리자는 전부 통과. 그 외에는 검수팀이거나 재고/검수 권한을 받은 사람만.
    const ok =
        team === "admin" ||
        team === "inspection" ||
        perms.includes("inspection") ||
        perms.includes("stock");

    if (!ok) {
        throw new HttpsError(
            "permission-denied",
            "검수 또는 재고 권한이 있어야 M360 기록을 볼 수 있습니다."
        );
    }

    return { uid: auth.uid, name: s.name || "이름없음", team };
}

// ────────────────────────────────────────────────────────────────
// 시각 — ⚠️⚠️ M360 은 **UTC** 로 준다
// ────────────────────────────────────────────────────────────────
//
// `connectionTime` 이 "2026-08-26T05:15:12+00:00" 꼴로 온다. 한국시간보다
// **9시간 이르다.** 그대로 화면에 뿌리면 오후 2시에 검사한 건이 오전 5시로 보인다.
// 「방금 검사한 것」을 찾는 화면인데 그러면 못 찾는다.
//
// ⚠️ 같은 종류의 사고를 이미 겪었다 — 입금완료일자가 UTC 로 찍혀서
//    Asia/Seoul 을 강제로 넣었다. 서버·외부 API 는 UTC 가 기본이라고 보고 늘 확인한다.

const KST_FMT = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});

/** UTC 문자열 → 한국시간 표시 문자열. 못 읽는 값이면 null */
function toKstText(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return KST_FMT.format(d);
}

// ────────────────────────────────────────────────────────────────
// M360 호출
// ────────────────────────────────────────────────────────────────

function authHeader() {
    const code = String(process.env.M360_AUTH_CODE || "").trim();
    const token = String(process.env.M360_AUTH_TOKEN || "").trim();
    if (!code || !token) return null;
    return `Bearer ${code}-${token}`;
}

/** .env 의 M360_TESTING. 안 적어두면 **안전한 쪽(테스트)** 으로 본다 */
function isTesting() {
    const v = String(process.env.M360_TESTING || "true").trim().toLowerCase();
    return v !== "false" && v !== "0";
}

async function callM360(endpoint, body) {
    const header = authHeader();
    if (!header) {
        // 조용히 빈 목록을 주지 않는다. 왜 안 되는지 사람이 읽을 수 있게 말한다
        console.error(
            "[M360] ❌ 설정이 비어 있어 부르지 못함 — " +
                "M360_AUTH_CODE / M360_AUTH_TOKEN 을 functions/.env 에 넣고 재배포할 것"
        );
        throw new HttpsError(
            "failed-precondition",
            "M360 연동 설정이 아직 안 되어 있습니다. 관리자에게 알려주세요."
        );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res;
    let text = "";
    try {
        res = await fetch(`${M360_BASE}/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: header,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        text = await res.text();
    } catch (e) {
        clearTimeout(timer);
        const why = e && e.name === "AbortError" ? "응답이 너무 늦음" : String(e && e.message);
        console.error(`[M360] ❌ ${endpoint} 호출 실패 — ${why}`);
        throw new HttpsError("unavailable", `M360 에 연결하지 못했습니다. (${why})`);
    }
    clearTimeout(timer);

    if (!res.ok) {
        // ⚠️ 본문에 토큰이 들어갈 일은 없지만, 길이를 잘라 로그가 넘치지 않게 한다
        console.error(`[M360] ❌ ${endpoint} HTTP ${res.status} — ${text.slice(0, 300)}`);
        throw new HttpsError("unavailable", `M360 응답 오류입니다. (HTTP ${res.status})`);
    }

    try {
        return JSON.parse(text);
    } catch (_) {
        console.error(`[M360] ❌ ${endpoint} 응답을 읽지 못함 — ${text.slice(0, 300)}`);
        throw new HttpsError("internal", "M360 응답을 읽지 못했습니다.");
    }
}

// ────────────────────────────────────────────────────────────────
// 응답 정리 — ⭐ 90개 필드를 그대로 앱에 넘기지 않는다
// ────────────────────────────────────────────────────────────────
//
// M360 레코드에는 필드가 90개 있다. 계정 잠김·블랙리스트·진단 결과까지 들어 있어서
// 그대로 넘기면 앱이 안 쓰는 정보를 잔뜩 받고, 그중엔 나중에 민감해질 것도 있다.
// **목록에서 기기를 고르는 데 필요한 것만** 골라 넘긴다.
//
// ⚠️ 나중에 배터리·계정잠김 등을 쓰게 되면 여기에 줄을 더하면 된다.
//    앱이 받는 모양이 바뀌므로 그때 앱도 같이 고쳐야 한다.

function trimRecord(r) {
    if (!r || typeof r !== "object") return null;
    return {
        sessionId: r.sessionId || null,
        imei: r.imei || null,
        imei2: r.imei2 || null,
        // "iPhone 15 Pro Max 256 GB Space Gray" — 모델·용량·색상이 한 줄로 온다
        friendlyName: r.friendlyName || r.marketingName || r.modelName || null,
        modelName: r.modelName || r.marketingName || null,
        m360id: r.m360id || null,
        username: r.username || null,
        // 원본(UTC)과 한국시간 표시를 **둘 다** 준다.
        // 원본은 정렬·비교용, 표시용은 화면이 그대로 쓰라고.
        connectionTime: r.connectionTime || null,
        connectionTimeText: toKstText(r.connectionTime),
        isClosed: r.isClosed === true,
        isManual: r.isManual === true,
    };
}

// ────────────────────────────────────────────────────────────────
// 검수 세션 기록 조회
// ────────────────────────────────────────────────────────────────
//
// 앱에서:
//   const fn = httpsCallable(functions, 'm360GetHistory');
//   const { data } = await fn({ limit: 20 });
//   data.records  // 목록
//
// 받는 값 (전부 선택):
//   limit     1~50, 기본 20
//   username  M360 사용자명으로 거르기 (직원별로 좁힐 때)
//   imei      IMEI 로 찾기
//   sessionId 세션 ID 로 찾기
//
// ⚠️ username 은 이메일에서 만들어내면 안 된다.
//    tngus2595@naver.com → tngus2595.naver 인데 dda465@gmail.com → dda465 다.
//    규칙이 일정하지 않다. 직원 문서에 저장해 두고 그 값을 그대로 넘긴다.

exports.m360GetHistory = onCall(
    { region: REGION, maxInstances: 5 },
    async (request) => {
        const staff = await requireInspectionOrStock(request);

        const d = request.data || {};

        // limit — 이상한 값이 와도 안전한 범위로 눌러 담는다.
        //
        // ⚠️ `Number(null)` 과 `Number('')` 은 **0** 이다. 그냥 Number.isFinite 로
        //    거르면 둘 다 통과해서 1건으로 눌러담긴다. 앱이 limit 을 안 넘기면서
        //    null 을 보내면 **목록에 1건만 나온다.** 그건 아무도 원인을 못 찾는다.
        //    → 쓸 수 있는 값(1 이상의 숫자)일 때만 쓰고, 나머지는 전부 기본값으로.
        let limit = DEFAULT_LIMIT;
        if (d.limit !== undefined && d.limit !== null && d.limit !== "") {
            const n = Number(d.limit);
            if (Number.isFinite(n) && n >= 1) {
                limit = Math.min(MAX_LIMIT, Math.floor(n));
            }
        }

        const body = {
            limit,
            order: "connectionTime:desc", // 방금 검사한 것이 맨 위
        };

        // ⭐ 테스트 모드를 **요청마다** 넣는다. 계정 상태와 무관하게 이 호출만 가짜가 된다
        if (isTesting()) body.testing = true;

        if (typeof d.username === "string" && d.username.trim()) {
            body.username = d.username.trim();
        }
        if (typeof d.sessionId === "string" && d.sessionId.trim()) {
            body.sessionId = d.sessionId.trim();
        }
        if (typeof d.imei === "string" && d.imei.trim()) {
            body.imei = d.imei.trim();
        }

        const json = await callM360("getHistory", body);

        // 응답 모양: { data: { records, hasMore, totalCount }, meta }
        const data = (json && json.data) || {};
        const raw = Array.isArray(data.records) ? data.records : [];

        // ⚠️ 기기 식별에 실패한 세션은 imei 가 null 이다. 목록에 내면 골라도 소용없다.
        //    버리되 **몇 건을 버렸는지 같이 알려준다** — 조용히 사라지면 안 된다 (규칙 ⑥)
        const trimmed = raw.map(trimRecord).filter(Boolean);
        const records = trimmed.filter((r) => r.imei);
        const skippedNoImei = trimmed.length - records.length;

        console.log(
            `[M360] getHistory — ${staff.name}(${staff.team}) · ` +
                `${records.length}건${skippedNoImei ? ` (IMEI 없어 제외 ${skippedNoImei}건)` : ""}` +
                `${isTesting() ? " · 테스트모드" : ""}`
        );

        return {
            records,
            hasMore: data.hasMore === true,
            skippedNoImei,
            // 화면이 "지금 시험 중입니다" 를 띄울 수 있게 알려준다.
            // 가짜 데이터를 진짜로 착각해 재고에 넣으면 안 된다
            testing: isTesting(),
        };
    }
);
