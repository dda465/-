// ════════════════════════════════════════════════════════════════
// 방문수거 전날 안내 알림톡 — 미집하 예방
// ════════════════════════════════════════════════════════════════
//
// ⚠️ 이 파일은 새로 추가된 것이다. 기존 index.js 의 함수들은 건드리지 않는다.
//    index.js 맨 아래에 require 한 줄만 추가돼 있다.
//
// ─────────────────────────────────────────────────────────────
// 왜 만들었나 (2026-08-28 · 최근 90일 실측)
// ─────────────────────────────────────────────────────────────
//   택배 예약 1,071건 중 집하 성공 931건 = 86.9%
//   미집하 140건 중 43건이 결국 '취소' 로 끝났다.
//   집하 실패의 상당수는 "언제 오는지 몰라서 못 내놨다" 이므로
//   전날 저녁에 한 번 알려주는 것만으로 줄어들 여지가 있다.
//
// ─────────────────────────────────────────────────────────────
// ★ 가장 중요한 것 — 어떤 날짜를 기준으로 보내는가
// ─────────────────────────────────────────────────────────────
//   quotes 문서에는 날짜가 두 개 있다. 헷갈리면 엉뚱한 날 문자가 나간다.
//
//     q.pickupDate                      고객이 화면에서 고른 "희망일"
//                                       ⚠️ "08/29" 처럼 **연도가 없다**
//                                       ⚠️ 일요일·공휴일이면 실제 배차는 다른 날로 밀린다
//
//     q.goodsflowPickupRequestDateTime  굿스플로에 **실제로 접수된** 수거일시
//                                       "2026-08-29 13:00" — 연도·시각까지 있다
//
//   → 반드시 goodsflowPickupRequestDateTime 을 쓴다.
//     2026-08-28 기준 진행 중인 배차 132건 전부 이 값이 채워져 있고 시각은 전부 13:00 이다.
//     (혹시 없는 옛 건은 pickupDate 로 보조 판정하되, 로그에 따로 세어 남긴다)
//
// ─────────────────────────────────────────────────────────────
// ★ 배차된 건에만 보낸다
// ─────────────────────────────────────────────────────────────
//   "신청접수 + 방문수거" 인데 굿스플로 배차가 **아예 안 된** 건이 상시 100건 안팎 있다.
//   (배차는 관리자가 화면에서 눌러야 생성된다 — 자동이 아니다)
//   그 건에 "내일 기사님이 갑니다" 라고 보내면 기사는 오지 않는다. 거짓 안내가 된다.
//   그래서 goodsflowOrderNo 가 있는 건만 대상으로 한다.
//
// ─────────────────────────────────────────────────────────────
// 템플릿 ID 를 넣기 전에는 — 실제 발송 없이 로그만 남긴다
// ─────────────────────────────────────────────────────────────
//   .env 의 ALIMTALK_TPL_PICKUP_REMINDER 가 비어 있으면
//   "보냈을 대상" 을 그대로 로그에 찍고 끝낸다. 발송도, 문서 수정도 하지 않는다.
//   카카오 템플릿 승인을 기다리는 동안 이 로그로 대상 선정이 맞는지 확인하면 된다.
//
// 런타임 Node 20 / firebase-functions v4 (v2 API) / 리전 asia-northeast3
// ════════════════════════════════════════════════════════════════

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

const REGION = "asia-northeast3";

// ── 템플릿 ID ────────────────────────────────────────────────
// 카카오 승인 후 .env 에 넣으면 그때부터 실제로 나간다.
// 비어 있으면 로그만 남기고 아무것도 보내지 않는다. 둘은 문구가 다르므로 템플릿도 둘이다.
const TPL_NIGHT = (process.env.ALIMTALK_TPL_PICKUP_REMINDER || "").trim();        // "내일 방문합니다"
const TPL_MORNING = (process.env.ALIMTALK_TPL_PICKUP_REMINDER_AM || "").trim();   // "오늘 방문합니다"

// ─────────────────────────────────────────────────────────────
// ★ 왜 21시가 아니라 22시 10분인가 (2026-08-28 실측)
// ─────────────────────────────────────────────────────────────
//   마감이 세 개인데 서로 다르다.
//     21:30  우리 홈페이지 화면 마감 (script.js 의 CUTOFF_MIN)
//            이 시각을 넘기면 고객 선택지에서 '내일' 이 사라진다
//     22:00  한진 실제 익일수거 마감 (script.js 주석 · 실측 확인)
//     13:00  기사 방문 시각 (배차건 전부 이 시각)
//
//   최근 60일, 수거 전날에 배차된 863건 중 **21시 이후 배차가 114건(13.2%)** 이다.
//   21시에 보내면 그 114건은 안내를 못 받는다.
//   22:00 을 넘겨 보내야 그날 밤 배차가 끝난 뒤라 누락이 없다.
//
//   ※ "늦게 배차한 건이 집하 실패가 많을 것" 이라 보고 확인했으나 **틀렸다.**
//     22시 이후 배차 집하율 94.7% 로 오히려 가장 높았다(표본 38건).
//     배차 시각과 집하 성공 사이에 뚜렷한 관계는 없다.
// ─────────────────────────────────────────────────────────────
// ⚠️ 아래 시각은 **배포 시점에** cron 으로 굳는다. .env 만 바꾸고 배포를 안 하면 안 바뀐다.
const hourOf = (v, dflt) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : dflt;
};
const NIGHT_HOUR = hourOf(process.env.PICKUP_REMINDER_HOUR, 22);
const NIGHT_MIN = 10;
const MORNING_HOUR = hourOf(process.env.PICKUP_REMINDER_AM_HOUR, 8);

// 아침 발송 대상 — 기본은 '밤에 못 보낸 건만'.
// .env 에 PICKUP_REMINDER_AM_ALL=1 을 넣으면 밤에 받은 사람에게도 한 번 더 보낸다.
const MORNING_ALL = String(process.env.PICKUP_REMINDER_AM_ALL || "") === "1";

// 텔레그램 — 기존 '쉐라폰비서' 봇을 그대로 쓴다 (index.js 와 같은 수신자)
const TG_TOKEN = process.env.TELEGRAM_DAILY_BOT_TOKEN || "";
const TG_CHAT_IDS = ["6989151823", "7434861149"]; // 대표 · 담당자

// ── 한국시간 도우미 ────────────────────────────────────────────
// 서버는 UTC 로 돈다. getHours() 류를 쓰면 9시간이 어긋난다.
const YMD_KST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
});
const LABEL_KST = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short"
});
const ymdKst = (d) => YMD_KST.format(d);

// "2026-08-29 13:00" → "오후 1시" / 값이 이상하면 빈 문자열
function hhmmToKorean(s) {
    const m = /(\d{2}):(\d{2})/.exec(String(s || ""));
    if (!m) return "";
    const h = Number(m[1]), mi = Number(m[2]);
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return mi === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}시 ${mi}분`;
}

// 로그에 남기는 연락처는 가운데를 가린다. 로그는 GCP 접근권한이 있으면 누구나 본다.
function maskPhone(p) {
    const d = String(p || "").replace(/[^0-9]/g, "");
    if (d.length < 7) return "(번호없음)";
    return d.slice(0, 3) + "-****-" + d.slice(-4);
}

// ── 알림톡 발송 ────────────────────────────────────────────────
// index.js 의 gfSendAlimtalk 과 같은 경로를 쓴다(솔라피 키는 alimtalkApi 쪽에만 있다).
// ⚠️ HTTP 200 이어도 본문이 실패일 수 있다(템플릿 미승인·변수 불일치).
//    본문까지 확인하지 않으면 '보냈다'고 잘못 표시하게 된다.
async function sendAlimtalk(tpl, phone, variables) {
    const to = String(phone || "").replace(/[^0-9]/g, "");
    if (!to) return { ok: false, why: "연락처 없음" };
    try {
        const r = await fetch(
            "https://asia-northeast3-rejeuphone.cloudfunctions.net/alimtalkApi/send",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: to, templateId: tpl, variables })
            }
        );
        const t = await r.text();
        let ok = r.ok;
        try {
            const j = JSON.parse(t);
            if (j.success === false || j.error) ok = false;
            const cnt = j.result && j.result.groupInfo && j.result.groupInfo.count;
            if (cnt && Number(cnt.registeredFailed || 0) > 0) ok = false;
        } catch (_) { /* JSON 이 아니면 HTTP 상태만 믿는다 */ }
        return { ok, body: t.slice(0, 300) };
    } catch (e) {
        return { ok: false, why: String(e.message).slice(0, 200) };
    }
}

async function sendTelegram(text) {
    if (!TG_TOKEN) return;
    for (const id of TG_CHAT_IDS) {
        try {
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: id, text: text.slice(0, 3800) })
            });
        } catch (e) {
            console.error("[전날안내] 텔레그램 발송 실패:", e.message);
        }
    }
}

// ── 대상 고르기 ────────────────────────────────────────────────
// ⚠️ limit 한 줄로 자르지 않는다. 2026-08-21 에 굿스플로 폴러가 같은 실수로
//    48건을 통째로 빠뜨렸고, **조회는 성공해서 아무도 몰랐다.**
//    커서로 전체를 돌고, 못 본 게 있으면 반드시 로그로 알린다.
const TARGET_STATUSES = ["신청접수", "수거중"];
const PAGE = 300;
const MAX_PAGES = 40;

async function pickTargets(targetYmd, { kind }) {
    const db = admin.firestore();
    const docs = [];
    let cursor = null, pages = 0, truncated = false;
    for (;;) {
        let qy = db.collection("quotes")
            .where("status", "in", TARGET_STATUSES)
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE);
        if (cursor) qy = qy.startAfter(cursor);
        const page = await qy.get();
        if (page.empty) break;
        docs.push(...page.docs);
        cursor = page.docs[page.docs.length - 1];
        pages++;
        if (page.size < PAGE) break;
        if (pages >= MAX_PAGES) { truncated = true; break; }
    }

    const stat = {
        전체: docs.length, 대상: 0, 배차없음: 0, 삭제됨: 0, 방문수거아님: 0,
        날짜다름: 0, 이미발송: 0, 밤에받음: 0, 이미집하됨: 0, 연락처없음: 0,
        보조판정_pickupDate사용: 0, truncated
    };
    const targets = [];

    // 보조 판정용 — "08/29" 같은 연도 없는 값과 비교할 월/일
    const md = targetYmd.slice(5).replace("-", "/");        // "08/29"
    const mdShort = md.replace(/^0/, "").replace("/0", "/"); // "8/29"

    for (const doc of docs) {
        const q = doc.data() || {};
        if (q.isDeleted === true) { stat.삭제됨++; continue; }
        if (q.deliveryMethod !== "courier") { stat.방문수거아님++; continue; }
        if (!q.goodsflowOrderNo) { stat.배차없음++; continue; }
        if (q.pickedUpAt || q.arrivedAt) { stat.이미집하됨++; continue; }
        // 밤 발송은 pickupReminderSentAt, 아침 발송은 pickupReminderAmSentAt 로 따로 센다.
        if (kind === "night" && q.pickupReminderSentAt) { stat.이미발송++; continue; }
        if (kind === "morning") {
            if (q.pickupReminderAmSentAt) { stat.이미발송++; continue; }
            // 기본값: 밤에 이미 안내받은 사람에게는 또 보내지 않는다.
            if (!MORNING_ALL && q.pickupReminderSentAt) { stat.밤에받음++; continue; }
        }

        const req = String(q.goodsflowPickupRequestDateTime || "").trim();
        let hit = false, viaFallback = false;
        if (req) {
            hit = req.slice(0, 10) === targetYmd;
        } else {
            // 옛 건 — 실제 접수 일시가 없다. 고객 희망일로만 판정한다.
            const p = String(q.pickupDate || "").trim();
            hit = p === md || p === mdShort || p.slice(0, 10) === targetYmd;
            viaFallback = hit;
        }
        if (!hit) { stat.날짜다름++; continue; }
        if (viaFallback) stat.보조판정_pickupDate사용++;
        if (!q.customerPhone) { stat.연락처없음++; continue; }

        stat.대상++;
        targets.push({ id: doc.id, q, req });
    }
    return { targets, stat };
}

// ─────────────────────────────────────────────────────────────
// ★ 변수는 템플릿과 **정확히** 일치해야 한다
// ─────────────────────────────────────────────────────────────
//   script.js:250 의 기존 코드 주석이 이미 겪은 일을 적어두고 있다.
//     "변수명은 솔라피에 등록된 템플릿과 정확히 일치해야 한다(하나만 달라도 발송 실패)"
//     "변수를 하나라도 같이 보내면 솔라피에서 발송 실패한다"
//   → 템플릿에 안 쓴 변수를 같이 보내면 **그 건은 안 나간다.**
//
//   그래서 .env 로 쓸 변수만 고를 수 있게 했다. 이름은 #{} 없이 쉼표로.
//     ALIMTALK_TPL_PICKUP_REMINDER_VARS=고객성함,수거일,수거시각
//   비워두면 아래 6개를 전부 보낸다(템플릿이 6개를 다 쓸 때만 성공).
// ─────────────────────────────────────────────────────────────
const VARS_NIGHT = (process.env.ALIMTALK_TPL_PICKUP_REMINDER_VARS || "")
    .split(",").map((v) => v.trim()).filter(Boolean);
const VARS_MORNING = (process.env.ALIMTALK_TPL_PICKUP_REMINDER_AM_VARS || "")
    .split(",").map((v) => v.trim()).filter(Boolean);

function buildVariables(q, req, allow) {
    const day = req ? new Date(req.replace(" ", "T") + ":00+09:00") : null;
    const all = {
        "#{고객성함}": q.customerName || "고객",
        "#{기종}": `${q.brand || ""} ${q.model || ""}`.trim() || "-",
        "#{수거일}": day ? LABEL_KST.format(day) : (q.pickupDate || "-"),
        "#{수거시각}": hhmmToKorean(req) || "오후 1시",
        "#{수거주소}": q.customerAddress || "-",
        "#{택배사}": q.goodsflowTransporter || "-"
    };
    if (!allow || !allow.length) return all;
    const picked = {};
    for (const name of allow) {
        const key = `#{${name}}`;
        if (key in all) picked[key] = all[key];
        else console.error(`[전날안내] ⚠️ 알 수 없는 변수 이름: ${name} — .env 의 ..._VARS 를 확인하세요`);
    }
    return picked;
}

// ── 본체 ──────────────────────────────────────────────────────
// kind = "night"  : 오늘 밤 22:10 → **내일** 수거 예정건에 "내일 방문합니다"
// kind = "morning": 아침 08:00  → **오늘** 수거 예정건에 "오늘 방문합니다"
//                   기본은 밤에 못 보낸 건만 (21시 이후 배차분 등 누락 보완)
async function runPickupReminder({ kind = "night", dryRun = false, notify = true } = {}) {
    const db = admin.firestore();
    const tpl = kind === "night" ? TPL_NIGHT : TPL_MORNING;
    const offsetMs = kind === "night" ? 24 * 3600000 : 0;
    const targetYmd = ymdKst(new Date(Date.now() + offsetMs));
    const 이름 = kind === "night" ? "전날 밤 안내" : "당일 아침 안내";

    const { targets, stat } = await pickTargets(targetYmd, { kind });

    // 템플릿이 없으면 무조건 로그만. (카카오 승인 대기 중 확인용)
    const logOnly = dryRun || !tpl;

    console.log(`[${이름}] 대상일 ${targetYmd} · ${logOnly ? "로그만(발송 안 함)" : "실발송"} · ${JSON.stringify(stat)}`);

    if (stat.truncated) {
        // 여기 걸리면 실제로 누락이 생긴 것이다. 조용히 넘어가면 안 된다.
        console.error(`[${이름}] ⚠️ 대상이 ${MAX_PAGES * PAGE}건을 넘어 일부를 보지 못했다. 못 본 건은 안내가 나가지 않는다.`);
        if (notify) await sendTelegram(`⚠️ ${이름}: 조회 상한 초과로 일부 건을 보지 못했습니다. 코드 확인 필요.`);
    }

    const 보낸것 = [], 실패 = [];
    for (const t of targets) {
        const vars = buildVariables(t.q, t.req, kind === "night" ? VARS_NIGHT : VARS_MORNING);
        const full = buildVariables(t.q, t.req);   // 로그용 — 고른 것과 무관하게 전부
        const 표시 = `${t.q.customerName || t.id} ${maskPhone(t.q.customerPhone)} / ${full["#{기종}"]} / ${full["#{수거일}"]} ${full["#{수거시각}"]}`;
        if (logOnly) { 보낸것.push("(로그) " + 표시); continue; }

        const r = await sendAlimtalk(tpl, t.q.customerPhone, vars);
        const sentField = kind === "night" ? "pickupReminderSentAt" : "pickupReminderAmSentAt";
        const triesField = kind === "night" ? "pickupReminderTries" : "pickupReminderAmTries";
        const errField = kind === "night" ? "pickupReminderError" : "pickupReminderAmError";

        if (r.ok) {
            await db.collection("quotes").doc(t.id).update({
                [sentField]: new Date(),
                pickupReminderFor: targetYmd
            });
            보낸것.push(표시);
        } else {
            // 3회까지만 재시도 — 잘못된 번호·수신거부처럼 영구 실패면 매일 무한 시도하게 된다.
            const tries = Number(t.q[triesField] || 0) + 1;
            const patch = { [triesField]: tries, [errField]: String(r.why || r.body || "발송 실패").slice(0, 200) };
            if (tries >= 3) patch[sentField] = new Date(); // 포기
            await db.collection("quotes").doc(t.id).update(patch);
            실패.push(`${표시} — ${patch[errField]}`);
        }
    }

    const 요약 =
        `📦 ${이름} (${targetYmd})\n` +
        (logOnly ? `\n⚠️ ${tpl ? "테스트 실행" : "템플릿 ID 미설정"} — 실제로는 아무것도 보내지 않았습니다.\n` : "") +
        `\n대상 ${stat.대상}건 · 발송 ${logOnly ? 0 : 보낸것.length}건 · 실패 ${실패.length}건\n` +
        `제외: 배차없음 ${stat.배차없음} / 날짜다름 ${stat.날짜다름} / 이미발송 ${stat.이미발송}` +
        (kind === "morning" ? ` / 밤에받음 ${stat.밤에받음}` : "") + `\n` +
        (보낸것.length ? `\n${보낸것.slice(0, 30).join("\n")}\n` : "") +
        (보낸것.length > 30 ? `…외 ${보낸것.length - 30}건\n` : "") +
        (실패.length ? `\n❌ 실패\n${실패.slice(0, 10).join("\n")}\n` : "");

    console.log(요약);
    // 조용히 지나가지 않는다 — 실패가 있거나, 템플릿이 없는데 보낼 대상이 있으면 알린다.
    if (notify && (실패.length || (logOnly && stat.대상 > 0))) await sendTelegram(요약);

    return { kind, targetYmd, logOnly, stat, sent: logOnly ? 0 : 보낸것.length, failed: 실패.length };
}

// ── 스케줄 ────────────────────────────────────────────────────
// ① 전날 밤 — 한진 익일수거 마감(22:00) 이후라야 그날 배차가 다 끝나 누락이 없다.
exports.pickupReminderBot = onSchedule(
    { schedule: `${NIGHT_MIN} ${NIGHT_HOUR} * * *`, timeZone: "Asia/Seoul", region: REGION },
    async () => { await runPickupReminder({ kind: "night" }); }
);

// ② 당일 아침 — 기사 방문(13시) 전. 기본은 밤에 못 보낸 건만 보낸다.
exports.pickupReminderAmBot = onSchedule(
    { schedule: `0 ${MORNING_HOUR} * * *`, timeZone: "Asia/Seoul", region: REGION },
    async () => { await runPickupReminder({ kind: "morning" }); }
);

// ── 미리보기 ──────────────────────────────────────────────────
// 언제든 눌러서 "지금 기준 대상이 누구인지" 확인할 수 있다.
//   ?key=<열쇠>            밤 발송 대상(내일 수거건)
//   ?key=<열쇠>&kind=morning  아침 발송 대상(오늘 수거건)
//
// ⚠️ 이 주소는 **절대 발송하지 않는다.** 로그·응답만 만든다.
//    (발송까지 되게 하면 주소를 아는 누구나 고객에게 문자를 쏠 수 있고 건당 요금이 나간다)
//
// ⚠️ 처음 배포하면 403 이 날 수 있다. `invoker: "public"` 을 코드에 써도
//    Cloud Run 권한이 자동으로 붙지 않는 경우가 있다 (2026-08-26 m360 때 겪음).
//    그때는 Cloud Shell 에서 아래 한 줄:
//      gcloud functions add-invoker-policy-binding pickupReminderPreview \\
//        --region=asia-northeast3 --member=allUsers
const PREVIEW_KEY = (process.env.PICKUP_REMINDER_PREVIEW_KEY || "").trim();
exports.pickupReminderPreview = onRequest(
    { region: REGION, invoker: "public" },
    async (req, res) => {
        // 열쇠를 안 정해두면 아예 동작하지 않는다. (주소만 알면 누구나 조회를 돌릴 수 있으므로)
        if (!PREVIEW_KEY) {
            return res.status(503).json({
                ok: false,
                error: "PICKUP_REMINDER_PREVIEW_KEY 가 .env 에 없습니다. 아무 문자열이나 정해 넣고 배포하세요."
            });
        }
        if (String(req.query.key || "") !== PREVIEW_KEY) {
            return res.status(403).json({ ok: false, error: "key 가 맞지 않습니다." });
        }
        try {
            const kind = req.query.kind === "morning" ? "morning" : "night";
            const r = await runPickupReminder({ kind, dryRun: true, notify: false });
            res.json({ ok: true, 발송함: false, ...r });
        } catch (e) {
            console.error("[전날안내] 미리보기 실패:", e);
            res.status(500).json({ ok: false, error: e.message });
        }
    }
);
