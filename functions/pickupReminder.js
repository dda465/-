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

// 템플릿 ID — 카카오 승인 후 .env 에 넣으면 그때부터 실제로 나간다.
// 비어 있으면 로그만 남기고 아무것도 보내지 않는다.
const TPL = (process.env.ALIMTALK_TPL_PICKUP_REMINDER || "").trim();

// 발송 시각(한국시간 기준 '시'). 기본 21시.
// ⚠️ 이 값은 **배포 시점에** cron 으로 굳는다. .env 만 바꾸고 배포를 안 하면 안 바뀐다.
const HOUR = (() => {
    const n = Number(process.env.PICKUP_REMINDER_HOUR);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 21;
})();

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
async function sendAlimtalk(phone, variables) {
    const to = String(phone || "").replace(/[^0-9]/g, "");
    if (!to) return { ok: false, why: "연락처 없음" };
    try {
        const r = await fetch(
            "https://asia-northeast3-rejeuphone.cloudfunctions.net/alimtalkApi/send",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: to, templateId: TPL, variables })
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

async function pickTargets(targetYmd) {
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
        날짜다름: 0, 이미발송: 0, 이미집하됨: 0, 연락처없음: 0,
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
        if (q.pickupReminderSentAt) { stat.이미발송++; continue; }

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

// 템플릿에 넣을 값들.
// ⚠️ 카카오 템플릿에 없는 변수를 같이 보내면 솔라피가 거부할 수 있다.
//    템플릿을 만든 뒤 **첫 발송 로그를 반드시 확인할 것.**
//    쓰지 않는 변수가 문제되면 아래에서 그 줄만 지우면 된다.
function buildVariables(q, req) {
    const day = req ? new Date(req.replace(" ", "T") + ":00+09:00") : null;
    return {
        "#{고객성함}": q.customerName || "고객",
        "#{기종}": `${q.brand || ""} ${q.model || ""}`.trim() || "-",
        "#{수거일}": day ? LABEL_KST.format(day) : (q.pickupDate || "-"),
        "#{수거시각}": hhmmToKorean(req) || "오후 1시",
        "#{수거주소}": q.customerAddress || "-",
        "#{택배사}": q.goodsflowTransporter || "-"
    };
}

// ── 본체 ──────────────────────────────────────────────────────
async function runPickupReminder({ dryRun = false, notify = true } = {}) {
    const db = admin.firestore();
    // '내일' = 지금부터 24시간 뒤의 한국시간 날짜
    const targetYmd = ymdKst(new Date(Date.now() + 24 * 3600000));
    const { targets, stat } = await pickTargets(targetYmd);

    // 템플릿이 없으면 무조건 로그만. (승인 대기 중 확인용)
    const logOnly = dryRun || !TPL;

    console.log(
        `[전날안내] 대상일 ${targetYmd} · ${logOnly ? "로그만(발송 안 함)" : "실발송"} · ` +
        JSON.stringify(stat)
    );

    if (stat.truncated) {
        // 여기 걸리면 실제로 누락이 생긴 것이다. 조용히 넘어가면 안 된다.
        console.error(
            `[전날안내] ⚠️ 대상이 ${MAX_PAGES * PAGE}건을 넘어 일부를 보지 못했다. ` +
            `못 본 건은 안내가 나가지 않는다.`
        );
        await sendTelegram(`⚠️ 전날안내: 조회 상한 초과로 일부 건을 보지 못했습니다. 코드 확인 필요.`);
    }

    const 보낸것 = [], 실패 = [];
    for (const t of targets) {
        const vars = buildVariables(t.q, t.req);
        const 표시 = `${t.q.customerName || t.id} ${maskPhone(t.q.customerPhone)} / ${vars["#{기종}"]} / ${vars["#{수거일}"]} ${vars["#{수거시각}"]}`;

        if (logOnly) { 보낸것.push("(로그) " + 표시); continue; }

        const r = await sendAlimtalk(t.q.customerPhone, vars);
        if (r.ok) {
            await db.collection("quotes").doc(t.id).update({
                pickupReminderSentAt: new Date(),
                pickupReminderFor: targetYmd
            });
            보낸것.push(표시);
        } else {
            // 3회까지만 재시도 — 잘못된 번호·수신거부처럼 영구 실패면 매일 무한 시도하게 된다.
            const tries = Number(t.q.pickupReminderTries || 0) + 1;
            const patch = {
                pickupReminderTries: tries,
                pickupReminderError: String(r.why || r.body || "발송 실패").slice(0, 200)
            };
            if (tries >= 3) patch.pickupReminderSentAt = new Date(); // 포기
            await db.collection("quotes").doc(t.id).update(patch);
            실패.push(`${표시} — ${patch.pickupReminderError}`);
        }
    }

    const 요약 =
        `📦 방문수거 전날 안내 (${targetYmd})\n` +
        (logOnly
            ? `\n⚠️ ${TPL ? "테스트 실행" : "템플릿 ID 미설정"} — 실제로는 아무것도 보내지 않았습니다.\n`
            : "") +
        `\n대상 ${stat.대상}건 · 발송 ${logOnly ? 0 : 보낸것.length}건 · 실패 ${실패.length}건\n` +
        `제외: 배차없음 ${stat.배차없음} / 날짜다름 ${stat.날짜다름} / 이미발송 ${stat.이미발송}\n` +
        (보낸것.length ? `\n${보낸것.slice(0, 30).join("\n")}\n` : "") +
        (보낸것.length > 30 ? `…외 ${보낸것.length - 30}건\n` : "") +
        (실패.length ? `\n❌ 실패\n${실패.slice(0, 10).join("\n")}\n` : "");

    console.log(요약);
    // 조용히 지나가지 않는다 — 실패가 있거나, 템플릿이 없는데 보낼 대상이 있으면 알린다.
    if (notify && (실패.length || (logOnly && stat.대상 > 0))) await sendTelegram(요약);

    return { targetYmd, logOnly, stat, sent: logOnly ? 0 : 보낸것.length, failed: 실패.length };
}

// ── 스케줄 ────────────────────────────────────────────────────
// 방문 전날 밤. 기본 21시(한국시간).
exports.pickupReminderBot = onSchedule(
    { schedule: `0 ${HOUR} * * *`, timeZone: "Asia/Seoul", region: REGION },
    async () => { await runPickupReminder(); }
);

// ── 미리보기 ──────────────────────────────────────────────────
// 언제든 눌러서 "지금 기준 내일 대상이 누구인지" 확인할 수 있다.
//
// ⚠️ 처음 배포하면 403 이 날 수 있다. `invoker: "public"` 을 코드에 써도
//    Cloud Run 권한이 자동으로 붙지 않는 경우가 있다 (2026-08-26 m360 때 겪음).
//    그때는 Cloud Shell 에서 아래 한 줄:
//      gcloud functions add-invoker-policy-binding pickupReminderPreview \
//        --region=asia-northeast3 --member=allUsers
// ⚠️ 이 주소는 **절대 발송하지 않는다.** 로그·응답만 만든다.
//    (발송까지 되게 하면 주소를 아는 누구나 고객에게 문자를 쏠 수 있고 건당 요금이 나간다)
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
            const r = await runPickupReminder({ dryRun: true, notify: false });
            res.json({ ok: true, 발송함: false, ...r });
        } catch (e) {
            console.error("[전날안내] 미리보기 실패:", e);
            res.status(500).json({ ok: false, error: e.message });
        }
    }
);
