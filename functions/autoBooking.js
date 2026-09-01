/**
 * ════════════════════════════════════════════════════════════════════════
 *  굿스플로 자동 배차 — 1단계: 보고만 한다 (2026-09-02 신설)
 * ════════════════════════════════════════════════════════════════════════
 *
 * ⚠️⚠️ **이 파일은 아직 굿스플로를 부르지 않는다. 한 건도 배차하지 않는다.**
 *
 *   배차는 건당 4,500원이 나가는 행위다. 규칙이 맞는지 눈으로 며칠 확인한
 *   다음에 켜야 한다. 그래서 1단계는 "자동이었다면 오늘 이렇게 묶었을 것"을
 *   매일 밤 텔레그램으로 보고만 한다.
 *   사장님이 그날 실제로 한 배차와 나란히 놓고 비교할 수 있게 같이 센다.
 *
 * ── 왜 묶어야 하나 ──────────────────────────────────────────────
 *   고객이 폰 3대를 팔면 접수를 3건 따로 한다. 그런데 기사는 한 번만 간다.
 *   지금은 사장님이 화면에서 보고 묶어서 1건만 배차한다. 이 묶는 판단이
 *   사람이 하는 진짜 일이고, 자동화의 핵심은 API 호출이 아니라 이 규칙이다.
 *
 *   묶지 않고 자동화하면 60일에 배차가 193건 늘어난다 = 월 43만원 (4,500원×).
 *
 * ── 규칙 (2026-09-01 실데이터 1,932건으로 정함) ──────────────────
 *   묶는 키   전화번호 + 주소 + 희망수거일   ← 셋 다 같아야 한다
 *   대기      첫 접수로부터 2시간
 *   예외      21:00 이 되면 대기 중이어도 즉시 배차
 *
 *   · 희망일이 다르면 절대 안 묶는다. 고객이 일부러 나눠 보내는 경우다.
 *     (사람이 안 묶은 그룹은 희망일이 같은 게 35% 뿐이었다 — 사람도 이 기준이다)
 *   · 대기 2시간이면 절약 가능분의 87% 를 잡는다. 6시간으로 늘려도 월 3만원 차이다.
 *   · 21:00 예외로 못 묶게 되는 건은 60일에 3건뿐이다. 익일 수거를 놓치는
 *     위험(굿스플로 마감 21:30~22:00)을 3건으로 막는 것이라 남는 장사다.
 *
 * ── 2단계에서 진짜 배차를 켤 때 반드시 같이 할 것 ────────────────
 *   ⚠️ **묶인 형제 문서에도 대표 goodsflowOrderNo 를 같이 기록해야 한다.**
 *      지금은 사람이 1건만 배차하고 나머지는 그냥 둬서, 그 문서들이 영원히
 *      '미배차' 로 남는다 (60일에 43개 그룹). 자동화하면 더 늘어난다.
 *      안 그러면 물건은 다 받았는데 시스템은 안 받은 걸로 보고,
 *      「수거 무산」 큐와 미집하 판정이 전부 오작동한다.
 *   ⚠️ **기사에게 몇 대인지 알려야 한다.** 안 알리면 3대 중 1대만 받아온다.
 *
 * ════════════════════════════════════════════════════════════════════════
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const REGION = "asia-northeast3";

// 텔레그램 — 전날안내 봇과 같은 수신자
const TG_TOKEN = process.env.TELEGRAM_DAILY_BOT_TOKEN || "";
const TG_CHAT_IDS = ["6989151823", "7434861149"];

/** 배차 1건당 비용 (홈픽 화면 기준 극소형 4,500원). 절약액 계산에만 쓴다 */
const COST_PER_BOOKING = Number(process.env.GOODSFLOW_COST_PER_BOOKING || 4500);

/** 묶기 대기 시간(시간) */
const WAIT_HOURS = Number(process.env.AUTO_BOOKING_WAIT_HOURS || 2);
/** 이 시각(분)이 되면 대기 중이어도 배차. 21:00 = 1260 */
const FORCE_AT_MIN = Number(process.env.AUTO_BOOKING_FORCE_AT_MIN || 21 * 60);

// ── 한국시간 도우미 ──────────────────────────────────────────────
// ⚠️ 서버는 UTC 다. getHours() 류를 쓰면 9시간 어긋난다.
const YMD_KST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
});
const HM_KST = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false
});
const ymdKst = (d) => YMD_KST.format(d);
/** 그 시각의 '자정으로부터 몇 분' (KST) */
function minOfDayKst(d) {
    const s = HM_KST.format(d);
    return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

/**
 * 전화번호 정규화.
 * ⚠️ 9자리 미만과 같은 숫자 반복(000-0000-0000)은 버린다.
 *    그런 번호 하나에 서로 다른 고객 27명이 뭉쳐 있던 적이 있다.
 *    묶기 키로 쓰면 남남을 한 사람으로 만든다.
 */
function normPhone(p) {
    const d = String(p || "").replace(/[^0-9]/g, "");
    if (d.length < 9) return "";
    if (/^(\d)\1+$/.test(d)) return "";
    return d;
}

function maskPhone(p) {
    const d = String(p || "").replace(/[^0-9]/g, "");
    if (d.length < 7) return "(번호없음)";
    return d.slice(0, 3) + "-****-" + d.slice(-4);
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
            console.error("[자동배차] 텔레그램 발송 실패:", e.message);
        }
    }
}

/**
 * 하루치 방문수거 접수를 커서로 전부 읽는다.
 *
 * ⚠️ limit 한 줄로 자르지 않는다. 2026-08-21 에 굿스플로 폴러가 같은 실수로
 *    48건을 통째로 빠뜨렸고 **조회는 성공해서 아무도 몰랐다.**
 *    못 본 게 있으면 반드시 알린다.
 */
async function fetchDayQuotes(ymd) {
    const start = new Date(`${ymd}T00:00:00+09:00`);
    const end = new Date(`${ymd}T23:59:59.999+09:00`);
    const col = admin.firestore().collection("quotes");
    const out = [];
    let cursor = null;
    let guard = 0;
    for (;;) {
        if (++guard > 50) return { rows: out, truncated: true };  // 안전장치
        // ⚠️ where(deliveryMethod) 와 where(firebaseTimestamp 범위) 를 같이 쓰면
        //    복합 인덱스가 필요하다. 없으면 **런타임에 통째로 실패한다.**
        //    (2026-09-02 실제로 확인 — 그 인덱스는 이 프로젝트에 없다)
        //    하루치는 몇십 건이라 날짜로만 받아 방문수거만 여기서 고른다.
        let q = col
            .where("firebaseTimestamp", ">=", start)
            .where("firebaseTimestamp", "<=", end)
            .orderBy("firebaseTimestamp", "asc")
            .limit(300);
        if (cursor) q = q.startAfter(cursor);
        const snap = await q.get();
        if (snap.empty) break;
        snap.forEach((d) => {
            const v = d.data();
            if (v.deliveryMethod === "courier") out.push({ id: d.id, ...v });
        });
        if (snap.size < 300) break;
        cursor = snap.docs[snap.docs.length - 1];
    }
    return { rows: out, truncated: false };
}

/**
 * 자동이었다면 몇 건을 배차했을지 계산한다. **아무것도 쓰지 않는다.**
 *
 * @returns {{배차:number, 그룹:Array}} 그룹은 2건 이상 묶인 것만
 */
function planBookings(rows) {
    // 배차 대상이 아닌 건은 먼저 걷어낸다 — createOrder 가 막는 것과 같은 조건
    const BLOCK = ["취소", "삭제", "입금완료", "반송접수", "반송완료"];
    const 대상 = rows.filter((q) =>
        q.isDeleted !== true &&
        !BLOCK.includes(q.status) &&
        normPhone(q.customerPhone) &&
        String(q.pickupDate || "").trim()
    );

    const map = new Map();
    for (const q of 대상) {
        const key = [
            normPhone(q.customerPhone),
            String(q.customerAddress || "").replace(/\s+/g, ""),
            String(q.pickupDate || "").trim()
        ].join("|");
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(q);
    }

    let 배차 = 0;
    const 그룹 = [];
    for (const list of map.values()) {
        list.sort((a, b) => tsOf(a) - tsOf(b));
        let open = null;          // 지금 열려 있는 배차의 첫 건
        let 현재 = [];
        const 닫기 = () => {
            if (!현재.length) return;
            배차++;
            if (현재.length > 1) 그룹.push(현재.slice());
            현재 = [];
        };
        for (const q of list) {
            const t = tsOf(q);
            if (open === null) { open = q; 현재 = [q]; continue; }
            const gapH = (t - tsOf(open)) / 3600000;
            // 대기 중에 21:00 을 넘겼으면 거기서 끊는다 (마감 때문에 강제 배차됐을 것)
            const 강제로끊김 =
                minOfDayKst(dateOf(open)) < FORCE_AT_MIN && minOfDayKst(dateOf(q)) >= FORCE_AT_MIN;
            if (gapH > WAIT_HOURS || 강제로끊김) { 닫기(); open = q; 현재 = [q]; }
            else { 현재.push(q); }
        }
        닫기();
    }
    return { 대상수: 대상.length, 배차, 그룹 };
}

function dateOf(q) {
    const t = q.firebaseTimestamp;
    return t && t.toDate ? t.toDate() : new Date(0);
}
function tsOf(q) { return dateOf(q).getTime(); }

async function runDryRun(targetYmd) {
    const ymd = targetYmd || ymdKst(new Date());
    const { rows, truncated } = await fetchDayQuotes(ymd);
    if (truncated) {
        await sendTelegram("⚠️ 자동배차(보고): 조회가 안전장치에 걸렸습니다. 코드 확인 필요.");
    }

    const plan = planBookings(rows);
    // 사람이 그날 실제로 잡은 배차 — 비교 기준
    const 사람배차 = rows.filter((q) => String(q.goodsflowOrderNo || "").trim()).length;
    const 절약 = plan.대상수 - plan.배차;

    const 줄 = [];
    줄.push(`🧪 자동배차 모의 (${ymd}) — 실제로는 아무것도 배차하지 않았습니다`);
    줄.push("");
    줄.push(`방문수거 접수      ${rows.length}건 (배차 대상 ${plan.대상수}건)`);
    줄.push(`자동이면 배차      ${plan.배차}건`);
    줄.push(`묶여서 줄어듦      ${절약}건  ≈ ${(절약 * COST_PER_BOOKING).toLocaleString()}원`);
    줄.push(`사람이 실제로 함   ${사람배차}건`);
    줄.push("");
    줄.push(`규칙: 번호+주소+희망일 / 대기 ${WAIT_HOURS}시간 / ${String(Math.floor(FORCE_AT_MIN / 60)).padStart(2, "0")}:00 강제`);

    if (plan.그룹.length) {
        줄.push("");
        줄.push(`── 묶인 그룹 ${plan.그룹.length}개 ──`);
        for (const g of plan.그룹.slice(0, 15)) {
            const h = g[0];
            줄.push(`· ${h.customerName || "고객"} ${maskPhone(h.customerPhone)} · 희망 ${h.pickupDate} · ${g.length}대`);
            줄.push(`   ${g.map((x) => `${x.brand || ""} ${x.model || ""}`.trim()).join(" / ")}`);
        }
        if (plan.그룹.length > 15) 줄.push(`… 외 ${plan.그룹.length - 15}개`);
    } else {
        줄.push("");
        줄.push("오늘은 묶일 그룹이 없었습니다.");
    }

    const 요약 = 줄.join("\n");
    console.log("[자동배차 모의]", JSON.stringify({
        ymd, 접수: rows.length, 대상: plan.대상수, 자동배차: plan.배차,
        절약, 사람배차, 그룹수: plan.그룹.length, truncated
    }));
    await sendTelegram(요약);
    return { ymd, 접수: rows.length, 자동배차: plan.배차, 절약, 사람배차, 그룹수: plan.그룹.length };
}

/**
 * 매일 21:05 (KST) — 그날 접수분으로 모의 계산해서 보고한다.
 *
 * ⚠️ 21:00 강제배차 규칙 직후에 돌린다. 그래야 그날 판단이 전부 끝난 뒤의
 *    결과를 본다. (홈페이지 접수 마감은 21:30 이라 21:05 이후 접수분은
 *    다음날 보고에 잡힌다 — 어차피 익일 수거 마감을 넘긴 건들이다)
 */
exports.autoBookingDryRun = onSchedule(
    { schedule: "5 21 * * *", timeZone: "Asia/Seoul", region: REGION },
    async () => { await runDryRun(); }
);

module.exports.runAutoBookingDryRun = runDryRun;
module.exports.planBookings = planBookings;
