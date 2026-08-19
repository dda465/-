// ════════════════════════════════════════════════════════════════
// 근태 — 출퇴근 기록 (직원 앱 staff.sharaphone.com 전용)
// ════════════════════════════════════════════════════════════════
//
// ⚠️ 이 파일은 새로 추가된 것이다. 기존 index.js 의 함수들은 건드리지 않는다.
//    index.js 맨 아래에 require 한 줄만 추가돼 있다.
//
// 왜 서버에서 하는가
//   출퇴근 시각을 브라우저가 찍으면 폰 시계를 바꿔 조작할 수 있다.
//   휴게시간·근무시간 계산도 마찬가지다. 전부 여기서 확정해 저장한다.
//   Firestore 보안 규칙도 attendance 컬렉션의 클라이언트 쓰기를 막아 두었다.
//
// 저장 구조 (CLAUDE.md 9절)
//   attendance/{YYYY-MM}_{uid}
//   { uid, year, month, days: { "01": {...} }, totalMin, edits: [] }
//
// 런타임 Node 20 / firebase-functions v4 (v2 API) / 리전 asia-northeast3
// ════════════════════════════════════════════════════════════════

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const REGION = "asia-northeast3";
const db = () => admin.firestore();

// ── 설정 기본값 — 앱의 types/attendance.ts 와 같아야 한다 ──────────
const DEFAULT_BREAK_RULES = [
    { minGrossMin: 480, breakMin: 60 },
    { minGrossMin: 240, breakMin: 30 },
    { minGrossMin: 0, breakMin: 0 },
];
const DEFAULT_MAX_OPEN_HOURS = 20;

const STAFF_SETTINGS_COL = "staff_settings";
const ATTENDANCE_SETTINGS_DOC = "attendance";

// ────────────────────────────────────────────────────────────────
// 날짜 도우미
//
// ⚠️ Cloud Functions 서버는 UTC 로 돈다. 그냥 getDate() 를 쓰면
//    한국 시각 오전 9시가 UTC 로는 전날 자정이라 **날짜가 하루 밀린다.**
//    반드시 한국 시각(UTC+9) 기준으로 날짜를 뽑는다.
// ────────────────────────────────────────────────────────────────
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date → 한국 시각 기준 { year, month, day } */
function kstParts(date) {
    const k = new Date(date.getTime() + KST_OFFSET_MS);
    return {
        year: k.getUTCFullYear(),
        month: k.getUTCMonth() + 1,
        day: k.getUTCDate(),
    };
}

function docIdFor(year, month, uid) {
    return `${year}-${String(month).padStart(2, "0")}_${uid}`;
}

function dayKey(day) {
    return String(day).padStart(2, "0");
}

/** 어제의 한국 시각 기준 날짜 */
function kstYesterday(date) {
    return kstParts(new Date(date.getTime() - 24 * 60 * 60 * 1000));
}

// ────────────────────────────────────────────────────────────────
// 휴게시간 규칙
// ────────────────────────────────────────────────────────────────

/**
 * 체류시간에서 공제할 휴게시간(분).
 * 큰 구간부터 검사한다. 저장된 순서를 믿지 않고 여기서 정렬한다.
 *
 * ⚠️ 여기서 나온 값은 **그날 문서에 박아서 저장한다.**
 *    규칙이 나중에 바뀌어도 지난 기록은 바뀌지 않는다 (소급 적용 금지).
 */
function resolveBreakMin(grossMin, rules) {
    if (grossMin <= 0) return 0;
    const sorted = [...rules].sort((a, b) => b.minGrossMin - a.minGrossMin);
    for (const r of sorted) {
        if (grossMin >= r.minGrossMin) {
            return Math.max(0, Math.min(r.breakMin, grossMin));
        }
    }
    return 0;
}

/** 넘어온 값에서 쓸 만한 휴게 구간만 골라낸다 */
function pickRules(value) {
    if (!Array.isArray(value)) return null;
    const rules = value
        .map((r) => ({
            minGrossMin: Number(r && r.minGrossMin) || 0,
            breakMin: Number(r && r.breakMin) || 0,
        }))
        .filter((r) => r.minGrossMin >= 0 && r.breakMin >= 0);
    return rules.length > 0 ? rules : null;
}

/** 1~24 사이의 값만 인정 */
function pickMaxOpen(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 && n <= 24 ? n : null;
}

/** 회사 기본 근태 설정. 문서가 없거나 깨져 있으면 코드 기본값 */
async function loadCompanySettings() {
    try {
        const snap = await db()
            .collection(STAFF_SETTINGS_COL)
            .doc(ATTENDANCE_SETTINGS_DOC)
            .get();

        if (!snap.exists) {
            return { breakRules: DEFAULT_BREAK_RULES, maxOpenHours: DEFAULT_MAX_OPEN_HOURS };
        }

        const d = snap.data() || {};
        return {
            breakRules: pickRules(d.breakRules) || DEFAULT_BREAK_RULES,
            maxOpenHours: pickMaxOpen(d.maxOpenHours) || DEFAULT_MAX_OPEN_HOURS,
        };
    } catch (e) {
        // 설정을 못 읽었다고 출퇴근이 막히면 안 된다. 기본값으로 진행한다.
        console.error("[attendance] 회사 설정 읽기 실패, 기본값 사용:", e);
        return { breakRules: DEFAULT_BREAK_RULES, maxOpenHours: DEFAULT_MAX_OPEN_HOURS };
    }
}

/**
 * ⭐ 이 직원에게 **실제로 적용되는** 설정을 구한다. (CLAUDE.md 9절 — 2단 구조)
 *
 *   staff/{uid}.attendanceOverride  ← 있으면 이걸 먼저
 *   staff_settings/attendance       ← 없는 항목은 회사 기본값
 *
 * **항목 단위로 덮어쓴다.** weeklyTargetMin 만 넣은 직원은 휴게 구간은 회사 값을 쓴다.
 *
 * ⚠️ 앱의 `types/attendance.ts` 의 `effectiveSettings()` 와 규칙이 같아야 한다.
 *    어긋나면 화면에 보이는 값과 실제 기록이 달라진다.
 */
async function effectiveSettings(staffOverride) {
    const company = await loadCompanySettings();
    const o = staffOverride || {};

    const rules = pickRules(o.breakRules);
    const maxOpen = pickMaxOpen(o.maxOpenHours);

    return {
        breakRules: rules || company.breakRules,
        maxOpenHours: maxOpen || company.maxOpenHours,
        // 어느 쪽이 적용됐는지 로그에 남기려고
        usedOverride: Boolean(rules || maxOpen),
    };
}

// ────────────────────────────────────────────────────────────────
// 직원 확인
// ────────────────────────────────────────────────────────────────

/** 로그인 + 재직 중인 직원인지 확인하고 staff 정보를 돌려준다 */
async function requireStaff(request) {
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

    return {
        uid: auth.uid,
        name: s.name || "이름없음",
        team: s.team || "delivery",
        // 직원별 근태 예외. 여기서 같이 꺼내 두면 읽기가 늘지 않는다.
        attendanceOverride: s.attendanceOverride || null,
    };
}

/** 빈 월 문서. ★ edits: [] 를 반드시 넣는다 (CLAUDE.md 9절) */
function emptyMonthDoc(uid, year, month) {
    return {
        uid,
        year,
        month,
        days: {},
        totalMin: 0,
        // ★ 이게 없으면 나중에 보안 규칙의 관리자 수정 검사가 오류를 내서
        //   관리자가 이 문서를 영영 못 고친다.
        edits: [],
    };
}

/** days 전체를 더해 totalMin 을 다시 구한다 */
function sumTotalMin(days) {
    return Object.keys(days || {}).reduce((sum, k) => {
        const w = days[k] && days[k].workMin;
        return sum + (typeof w === "number" && w > 0 ? w : 0);
    }, 0);
}

// ════════════════════════════════════════════════════════════════
// punch — 출근 / 퇴근
// ════════════════════════════════════════════════════════════════
//
// 업무 규칙 (CLAUDE.md 9절)
//   - 하루 1회. 이미 출근한 날 또 출근 → 거부 (덮어쓰지 않는다)
//   - 출근 없이 퇴근 → 거부
//   - 자정 넘긴 퇴근은 **출근한 날짜로** 기록
//   - 퇴근 버튼이 닫는 대상:
//       ① 오늘 출근이 열려 있으면 오늘 것
//       ② 없으면 어제 것 — 단 maxOpenHours 이내일 때만
//       ③ 넘었으면 거부 (관리자가 채운다)
//
// 트랜잭션으로 처리한다. 버튼을 두 번 눌러도 두 번 기록되지 않는다.
// ════════════════════════════════════════════════════════════════
exports.punch = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const staff = await requireStaff(request);
    const action = request.data && request.data.action;

    if (action !== "in" && action !== "out") {
        throw new HttpsError("invalid-argument", "action 은 'in' 또는 'out' 이어야 합니다.");
    }

    // ★ 서버 시각. 클라이언트가 보낸 시각은 절대 쓰지 않는다.
    const now = admin.firestore.Timestamp.now();
    const nowDate = now.toDate();

    // ⭐ 이 직원에게 적용되는 설정 (직원별 예외 → 없으면 회사 기본값)
    const settings = await effectiveSettings(staff.attendanceOverride);

    const today = kstParts(nowDate);

    if (action === "in") {
        return await punchIn(staff, now, today);
    }
    return await punchOut(staff, now, nowDate, today, settings);
});

/** 출근 */
async function punchIn(staff, now, today) {
    const ref = db()
        .collection("attendance")
        .doc(docIdFor(today.year, today.month, staff.uid));
    const key = dayKey(today.day);

    return await db().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : emptyMonthDoc(staff.uid, today.year, today.month);
        const days = data.days || {};
        const existing = days[key];

        if (existing && existing.in) {
            throw new HttpsError(
                "already-exists",
                "이미 출근을 기록했습니다. 하루에 한 번만 찍을 수 있습니다.",
            );
        }

        days[key] = {
            in: now,
            out: null,
            grossMin: null,
            breakMin: null,
            breakAuto: true,
            workMin: null,
            note: (existing && existing.note) || "",
        };

        const next = { ...data, days, totalMin: sumTotalMin(days) };
        if (!Array.isArray(next.edits)) next.edits = [];

        tx.set(ref, next, { merge: true });

        console.log(`[punch] ${staff.name}(${staff.uid}) 출근 ${today.year}-${today.month}-${key}`);
        return { ok: true, action: "in", day: key, at: now.toDate().toISOString() };
    });
}

/**
 * 퇴근.
 *
 * ⭐ 어느 날짜를 닫을지부터 정한다. 이걸 제한하지 않으면
 *    어제 퇴근을 깜빡하고 오늘 아침에 누를 때 24시간 근무로 찍힌다.
 */
async function punchOut(staff, now, nowDate, today, settings) {
    const yesterday = kstYesterday(nowDate);

    // ── ① 오늘 열린 기록이 있는지 ──
    const todayRef = db()
        .collection("attendance")
        .doc(docIdFor(today.year, today.month, staff.uid));
    const todaySnap = await todayRef.get();
    const todayOpen =
        todaySnap.exists &&
        todaySnap.data().days &&
        todaySnap.data().days[dayKey(today.day)] &&
        todaySnap.data().days[dayKey(today.day)].in &&
        !todaySnap.data().days[dayKey(today.day)].out;

    let target;
    if (todayOpen) {
        target = { ...today, ref: todayRef };
    } else {
        // ── ② 어제 열린 기록이 있는지 ──
        const yRef = db()
            .collection("attendance")
            .doc(docIdFor(yesterday.year, yesterday.month, staff.uid));
        const ySnap = await yRef.get();
        const yDay =
            ySnap.exists && ySnap.data().days ? ySnap.data().days[dayKey(yesterday.day)] : null;

        if (!yDay || !yDay.in || yDay.out) {
            throw new HttpsError(
                "failed-precondition",
                "출근 기록이 없습니다. 출근을 먼저 찍어주세요.",
            );
        }

        // ── ③ 범위 검사 — maxOpenHours 이내인가 ──
        const openedAt = yDay.in.toDate ? yDay.in.toDate() : new Date(yDay.in);
        const openHours = (nowDate.getTime() - openedAt.getTime()) / 3_600_000;

        if (openHours > settings.maxOpenHours) {
            console.warn(
                `[punch] ${staff.uid} 퇴근 거부 — ${openHours.toFixed(1)}시간 경과 ` +
                    `(한도 ${settings.maxOpenHours}시간)`,
            );
            throw new HttpsError(
                "failed-precondition",
                "퇴근 기록이 너무 늦었습니다. 관리자에게 요청해 주세요.",
            );
        }

        target = { ...yesterday, ref: yRef };
    }

    const key = dayKey(target.day);

    return await db().runTransaction(async (tx) => {
        const snap = await tx.get(target.ref);
        if (!snap.exists) {
            throw new HttpsError("failed-precondition", "출근 기록이 없습니다.");
        }

        const data = snap.data();
        const days = data.days || {};
        const day = days[key];

        if (!day || !day.in) {
            throw new HttpsError("failed-precondition", "출근 기록이 없습니다.");
        }
        if (day.out) {
            throw new HttpsError("already-exists", "이미 퇴근을 기록했습니다.");
        }

        const inDate = day.in.toDate ? day.in.toDate() : new Date(day.in);
        const grossMin = Math.max(0, Math.round((now.toDate().getTime() - inDate.getTime()) / 60000));

        // ★ 그날 규칙으로 계산해서 **값을 박아 저장한다.**
        //   나중에 규칙이 바뀌어도 이 기록은 바뀌지 않는다.
        const breakMin = resolveBreakMin(grossMin, settings.breakRules);
        const workMin = Math.max(0, grossMin - breakMin);

        days[key] = {
            ...day,
            out: now,
            grossMin,
            breakMin,
            breakAuto: true, // 자동 규칙으로 들어간 값
            workMin,
        };

        const next = { ...data, days, totalMin: sumTotalMin(days) };
        if (!Array.isArray(next.edits)) next.edits = [];

        tx.set(target.ref, next, { merge: true });

        console.log(
            `[punch] ${staff.name}(${staff.uid}) 퇴근 ${target.year}-${target.month}-${key} ` +
                `체류 ${grossMin}분 - 휴게 ${breakMin}분 = 근무 ${workMin}분 ` +
                `(${settings.usedOverride ? "직원별 설정" : "회사 기본값"})`,
        );

        return {
            ok: true,
            action: "out",
            day: key,
            year: target.year,
            month: target.month,
            grossMin,
            breakMin,
            workMin,
            at: now.toDate().toISOString(),
        };
    });
}

// ════════════════════════════════════════════════════════════════
// adminEditAttendance — 관리자가 과거 기록을 고친다
// ════════════════════════════════════════════════════════════════
//
// 퇴근을 안 찍고 간 날을 채우거나, 반차·외근으로 휴게시간을 조정할 때 쓴다.
//
// ⚠️ 반드시 사유를 남긴다. 근로기준법상 근로시간 기록은 3년 보관이고,
//    누가·언제·왜 고쳤는지가 남아야 나중에 분쟁이 없다.
// ⚠️ 규칙을 다시 적용하지 않는다. 관리자가 넣은 값을 그대로 저장한다.
//    breakAuto: false 로 "손으로 고친 값"임을 표시한다.
// ════════════════════════════════════════════════════════════════
exports.adminEditAttendance = onCall(
    { region: REGION, maxInstances: 5 },
    async (request) => {
        const editor = await requireStaff(request);

        // 커스텀 클레임으로 판정한다. staff 문서만 믿지 않는다.
        const team = request.auth.token && request.auth.token.team;
        if (team !== "admin") {
            throw new HttpsError("permission-denied", "근태 수정은 관리자만 할 수 있습니다.");
        }

        const d = request.data || {};
        const { uid, year, month, day, reason } = d;

        if (!uid || !year || !month || !day) {
            throw new HttpsError("invalid-argument", "uid, year, month, day 가 필요합니다.");
        }
        if (!reason || String(reason).trim().length < 2) {
            throw new HttpsError("invalid-argument", "수정 사유를 입력해 주세요.");
        }

        const key = dayKey(day);
        const ref = db().collection("attendance").doc(docIdFor(year, month, uid));
        const now = admin.firestore.Timestamp.now();

        return await db().runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists ? snap.data() : emptyMonthDoc(uid, year, month);
            const days = data.days || {};
            const before = days[key] || null;

            // 넘어온 값으로 하루치를 다시 만든다.
            // in/out 은 ISO 문자열로 받는다. 없으면 기존 값 유지.
            const inAt = d.in ? admin.firestore.Timestamp.fromDate(new Date(d.in)) : before && before.in;
            const outAt = d.out ? admin.firestore.Timestamp.fromDate(new Date(d.out)) : before && before.out;

            let grossMin = null;
            if (inAt && outAt) {
                const a = inAt.toDate ? inAt.toDate() : new Date(inAt);
                const b = outAt.toDate ? outAt.toDate() : new Date(outAt);

                // ⚠️ 퇴근이 출근보다 빠르면 거부한다.
                //    예전에는 Math.max(0, 음수) 라서 **근무시간 0분으로 조용히 저장**됐다.
                //    오류도 안 나서 나중에 급여를 맞출 때야 발견된다.
                if (b.getTime() < a.getTime()) {
                    throw new HttpsError(
                        "invalid-argument",
                        "퇴근 시각이 출근 시각보다 빠릅니다. 시각을 확인해 주세요.",
                    );
                }

                grossMin = Math.round((b.getTime() - a.getTime()) / 60000);
            }

            // 관리자가 휴게시간을 직접 넣었으면 그 값, 아니면 기존 값 유지
            const breakMin =
                typeof d.breakMin === "number"
                    ? Math.max(0, d.breakMin)
                    : before && typeof before.breakMin === "number"
                      ? before.breakMin
                      : 0;

            const workMin = grossMin === null ? null : Math.max(0, grossMin - breakMin);

            days[key] = {
                in: inAt || null,
                out: outAt || null,
                grossMin,
                breakMin,
                breakAuto: false, // ★ 손으로 고친 값
                workMin,
                note: typeof d.note === "string" ? d.note : (before && before.note) || "",
            };

            const edits = Array.isArray(data.edits) ? data.edits : [];
            edits.push({
                by: editor.uid,
                byName: editor.name,
                at: now,
                day: key,
                before: before ? JSON.stringify(summarize(before)) : "(기록 없음)",
                after: JSON.stringify(summarize(days[key])),
                reason: String(reason).trim(),
            });

            tx.set(
                ref,
                { ...data, uid, year, month, days, totalMin: sumTotalMin(days), edits },
                { merge: true },
            );

            console.log(
                `[attendanceEdit] ${editor.name} → ${uid} ${year}-${month}-${key} : ${reason}`,
            );

            return { ok: true, day: key, workMin };
        });
    },
);

/** 이력에 남길 요약 (Timestamp 를 읽을 수 있는 문자열로) */
function summarize(day) {
    const t = (v) => {
        if (!v) return null;
        const dt = v.toDate ? v.toDate() : new Date(v);
        return dt.toISOString();
    };
    return {
        in: t(day.in),
        out: t(day.out),
        grossMin: day.grossMin,
        breakMin: day.breakMin,
        workMin: day.workMin,
        note: day.note || "",
    };
}


// ════════════════════════════════════════════════════════════════
// 근태 수정 요청 · 승인 (2026-08-11 추가)
// ════════════════════════════════════════════════════════════════
// 직원이 근무시간 수정을 요청하고 관리자가 승인한다.
// ⚠️ 요청만으로는 기록이 바뀌지 않는다. 승인이 나야 바뀐다.
//    (승인 전에 급여를 정산할 때 요청값이 나가면 안 되기 때문)
// 위쪽 punch / adminEditAttendance 는 건드리지 않았다.

// ────────────────────────────────────────────────────────────────
// 공통 — 승인 대기 건수 요약 문서
// ────────────────────────────────────────────────────────────────
//
// ⭐ 관리자 홈 배지는 이 문서 **하나만** 읽는다 (CLAUDE.md 5절 규칙 ③).
//    홈은 하루에 수십 번 열린다. 거기서 직원 수만큼 문서를 읽으면
//    사람이 늘수록 홈이 계속 느려진다.
//
// ⚠️⚠️ **숫자만 넣는다.** `stats/{id}` 는 `allow read: if isStaff()` 라
//      전 직원이 읽는다. 이름·날짜·근태 값을 넣으면
//      **누가 언제 근태 수정을 요청했는지가 전 직원에게 보인다.**
//
// ⚠️ 쓰기는 규칙상 `allow write: if false` 다. 관리자 SDK 라 영향을 안 받는다.
const PENDING_DOC = () => db().doc("stats/attendance_pending");

/**
 * 대기 건수를 트랜잭션 안에서 올리거나 내린다.
 *
 * ⚠️ 반드시 **호출한 트랜잭션 안에서** 같이 처리한다.
 *    따로 처리하면 요청 저장은 됐는데 숫자는 안 올라가는 상태가 생긴다.
 */
function bumpPending(tx, delta) {
    tx.set(
        PENDING_DOC(),
        {
            count: admin.firestore.FieldValue.increment(delta),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
}

/** 요청 시점 기록 스냅샷 — 승인 직전 대조에 쓴다 */
function snapshotBefore(day) {
    const iso = (v) => {
        if (!v) return null;
        const d = v.toDate ? v.toDate() : new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString();
    };
    if (!day) return { in: null, out: null, breakMin: null };
    return {
        in: iso(day.in),
        out: iso(day.out),
        breakMin: typeof day.breakMin === "number" ? day.breakMin : null,
    };
}

/** 스냅샷 두 개가 같은지 — 승인 전 "기록이 그대로인가" 검사 */
function sameBefore(a, b) {
    if (!a || !b) return false;
    return a.in === b.in && a.out === b.out && a.breakMin === b.breakMin;
}

// ════════════════════════════════════════════════════════════════
// requestAttendanceEdit — 직원 본인이 수정을 요청한다
// ════════════════════════════════════════════════════════════════
//
// ⚠️ 요청은 **기록을 건드리지 않는다.** in/out/breakMin/workMin 은 그대로 두고
//    `days[dd].request` 만 넣는다. 승인이 나야 바뀐다.
//    요청값을 미리 반영해 두면 **승인 전에 급여를 정산할 때 요청값이 나간다.**
//
// ⚠️⚠️ **트랜잭션 안에서 처리한다.**
//    "같은 날 pending 검사 → 저장 → +1" 이 한 덩어리여야 한다.
//    따로 하면 버튼을 두 번 눌렀을 때 요청이 덮어써지면서 **+2 가 된다.**
// ════════════════════════════════════════════════════════════════
exports.requestAttendanceEdit = onCall(
    { region: REGION, maxInstances: 5 },
    async (request) => {
        const staff = await requireStaff(request);

        const d = request.data || {};
        const { year, month, day, reason } = d;

        if (!year || !month || !day) {
            throw new HttpsError("invalid-argument", "year, month, day 가 필요합니다.");
        }
        if (!reason || String(reason).trim().length < 2) {
            throw new HttpsError("invalid-argument", "수정 사유를 적어 주세요.");
        }

        const inAt = d.in ? new Date(d.in) : null;
        const outAt = d.out ? new Date(d.out) : null;
        const breakMin = typeof d.breakMin === "number" ? d.breakMin : null;

        if ((inAt && isNaN(inAt.getTime())) || (outAt && isNaN(outAt.getTime()))) {
            throw new HttpsError("invalid-argument", "시각 형식이 올바르지 않습니다.");
        }
        if (!inAt && !outAt && breakMin === null) {
            throw new HttpsError("invalid-argument", "고칠 값을 하나 이상 입력해 주세요.");
        }

        // ⚠️ 퇴근이 출근보다 이르면 여기서 막는다.
        //    승인 단계에서도 다시 막지만, 요청 단계에서 걸러야
        //    직원이 사유까지 다 적고 나중에 반려당하지 않는다.
        if (inAt && outAt && outAt.getTime() < inAt.getTime()) {
            throw new HttpsError(
                "invalid-argument",
                "퇴근 시각이 출근 시각보다 빠릅니다. 시각을 확인해 주세요.",
            );
        }
        if (breakMin !== null && (breakMin < 0 || breakMin > 24 * 60)) {
            throw new HttpsError("invalid-argument", "휴게시간이 올바르지 않습니다.");
        }

        const key = dayKey(day);
        // ★ 본인 문서에만 요청할 수 있다. uid 를 클라이언트에서 받지 않는다
        const ref = db().collection("attendance").doc(docIdFor(year, month, staff.uid));
        const now = admin.firestore.Timestamp.now();

        return await db().runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists ? snap.data() : emptyMonthDoc(staff.uid, year, month);
            const days = data.days || {};
            const before = days[key] || null;

            // ⚠️ 이미 대기 중인 요청이 있으면 새로 받지 않는다.
            //    같은 날에 요청이 둘이면 어느 것을 승인한 건지 알 수 없어진다.
            if (before && before.request && before.request.status === "pending") {
                throw new HttpsError(
                    "already-exists",
                    "이미 수정 요청 중입니다. 관리자 승인을 기다려 주세요.",
                );
            }

            days[key] = {
                // ★ 기존 기록을 그대로 둔다. 요청만 얹는다
                ...(before || {
                    in: null,
                    out: null,
                    grossMin: null,
                    breakMin: null,
                    breakAuto: true,
                    workMin: null,
                    note: "",
                }),
                request: {
                    in: inAt ? admin.firestore.Timestamp.fromDate(inAt) : null,
                    out: outAt ? admin.firestore.Timestamp.fromDate(outAt) : null,
                    breakMin,
                    reason: String(reason).trim(),
                    requestedAt: now,
                    requestedBy: staff.uid,
                    requestedByName: staff.name,
                    status: "pending",
                    decidedAt: null,
                    decidedBy: "",
                    decidedByName: "",
                    rejectReason: "",
                    // ★ 승인 직전 대조용. 이게 없으면 "기록이 바뀌었는지" 를 못 본다
                    before: snapshotBefore(before),
                },
            };

            tx.set(
                ref,
                { ...data, uid: staff.uid, year, month, days },
                { merge: true },
            );
            bumpPending(tx, +1);

            console.log(`[attendanceRequest] ${staff.name} ${year}-${month}-${key} 요청`);
            return { ok: true, day: key };
        });
    },
);

// ════════════════════════════════════════════════════════════════
// decideAttendanceRequest — 관리자가 승인 / 반려
// ════════════════════════════════════════════════════════════════
//
// ⚠️⚠️ **트랜잭션 안에서 status 를 먼저 읽는다.**
//    목록을 두 탭에 띄워두고 양쪽에서 누르거나, 응답이 느려 두 번 누르면
//    `-1` 이 두 번 나가 요약 숫자가 어긋난다. **가장 흔한 경로다.**
//    `pending` 이 아니면 아무것도 하지 않고 "이미 처리된 요청입니다" 를 돌려준다.
//
// ⚠️⚠️ **승인 직전에 기록이 그대로인지 확인한다.**
//    pending 인 채로 관리자가 월간표에서 그 날짜를 직접 고쳤다면,
//    요청은 옛 기록 기준이라 그대로 승인하면 **방금 고친 값이 조용히 덮어써진다.**
//    → 승인만 거부한다. 반려는 그대로 되게 둔다 (막힌 요청을 정리해야 하므로).
//
// ⚠️ 소급 금지 — 승인으로 바뀌는 건 **그 날짜 하나뿐**이고,
//    휴게시간 규칙을 다시 적용하지 않는다. 요청에 담긴 breakMin 을 그대로 쓴다.
// ════════════════════════════════════════════════════════════════
exports.decideAttendanceRequest = onCall(
    { region: REGION, maxInstances: 5 },
    async (request) => {
        const decider = await requireStaff(request);

        // ★ 커스텀 클레임으로 판정한다. staff 문서만 믿으면 클라이언트에서 우회된다.
        const token = request.auth.token || {};
        const isAdminTeam = token.team === "admin";
        const perms = Array.isArray(token.perms) ? token.perms : [];
        if (!isAdminTeam && !perms.includes("editAttendance")) {
            throw new HttpsError(
                "permission-denied",
                "근태 승인 권한이 없습니다.",
            );
        }

        const d = request.data || {};
        const { uid, year, month, day, decision } = d;

        if (!uid || !year || !month || !day) {
            throw new HttpsError("invalid-argument", "uid, year, month, day 가 필요합니다.");
        }
        if (decision !== "approve" && decision !== "reject") {
            throw new HttpsError("invalid-argument", "decision 이 올바르지 않습니다.");
        }

        const rejectReason = String(d.rejectReason || "").trim();
        if (decision === "reject" && rejectReason.length < 2) {
            throw new HttpsError("invalid-argument", "반려 사유를 적어 주세요.");
        }

        const key = dayKey(day);
        const ref = db().collection("attendance").doc(docIdFor(year, month, uid));
        const now = admin.firestore.Timestamp.now();

        return await db().runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) {
                throw new HttpsError("not-found", "근태 기록을 찾을 수 없습니다.");
            }

            const data = snap.data();
            const days = data.days || {};
            const before = days[key] || null;
            const req = before && before.request;

            if (!req) {
                throw new HttpsError("not-found", "수정 요청을 찾을 수 없습니다.");
            }

            // ⭐ 두 번 처리 방지 — 여기가 핵심이다
            if (req.status !== "pending") {
                throw new HttpsError(
                    "failed-precondition",
                    "이미 처리된 요청입니다. 목록을 새로 고쳐 주세요.",
                );
            }

            // ── 반려 ──
            if (decision === "reject") {
                days[key] = {
                    ...before,
                    // ★ 기록은 손대지 않는다
                    request: {
                        ...req,
                        status: "rejected",
                        decidedAt: now,
                        decidedBy: decider.uid,
                        decidedByName: decider.name,
                        rejectReason,
                    },
                };
                tx.set(ref, { ...data, days }, { merge: true });
                bumpPending(tx, -1);

                console.log(
                    `[attendanceRequest] ${decider.name} → ${uid} ${year}-${month}-${key} 반려: ${rejectReason}`,
                );
                return { ok: true, day: key, workMin: before.workMin ?? null };
            }

            // ── 승인 ──
            //
            // ⭐ 요청 이후 기록이 바뀌었는지 먼저 본다.
            const nowSnapshot = snapshotBefore(before);
            if (!sameBefore(req.before, nowSnapshot)) {
                throw new HttpsError(
                    "failed-precondition",
                    "요청 이후 기록이 변경되었습니다. 반려하고 다시 요청받으세요.",
                );
            }

            // 요청값으로 덮어쓴다. 안 보낸 항목은 기존 값을 유지한다
            const inAt = req.in || before.in || null;
            const outAt = req.out || before.out || null;

            let grossMin = null;
            if (inAt && outAt) {
                const a = inAt.toDate ? inAt.toDate() : new Date(inAt);
                const b = outAt.toDate ? outAt.toDate() : new Date(outAt);

                // ⚠️ 승인 단계에서도 다시 막는다.
                //    요청 이후에 관리자가 한쪽만 고쳐 뒤집힐 수 있다.
                //    예전 관리자 수정에서 Math.max(0, 음수) 라 0분으로 조용히 저장된 적이 있다.
                if (b.getTime() < a.getTime()) {
                    throw new HttpsError(
                        "invalid-argument",
                        "퇴근 시각이 출근 시각보다 빠릅니다. 반려하고 다시 요청받으세요.",
                    );
                }
                grossMin = Math.round((b.getTime() - a.getTime()) / 60000);
            }

            const breakMin =
                typeof req.breakMin === "number"
                    ? Math.max(0, req.breakMin)
                    : typeof before.breakMin === "number"
                      ? before.breakMin
                      : 0;

            // ⚠️ 휴게시간 규칙(resolveBreakMin)을 다시 적용하지 않는다. 소급 금지.
            const workMin = grossMin === null ? null : Math.max(0, grossMin - breakMin);

            days[key] = {
                ...before,
                in: inAt,
                out: outAt,
                grossMin,
                breakMin,
                // ★ 직원이 지정한 값이라 자동 규칙 값이 아니다
                breakAuto: false,
                workMin,
                request: {
                    ...req,
                    status: "approved",
                    decidedAt: now,
                    decidedBy: decider.uid,
                    decidedByName: decider.name,
                    rejectReason: "",
                },
            };

            // ★ 수정 이력 — 누가 요청했고 누가 승인했는지 둘 다 남긴다
            const edits = Array.isArray(data.edits) ? data.edits : [];
            edits.push({
                by: decider.uid,
                byName: decider.name,
                at: now,
                day: key,
                before: JSON.stringify(summarize(before)),
                after: JSON.stringify(summarize(days[key])),
                reason: `[수정요청 승인] 요청 ${req.requestedByName || req.requestedBy}: ${req.reason || ""}`,
            });

            tx.set(
                ref,
                { ...data, days, totalMin: sumTotalMin(days), edits },
                { merge: true },
            );
            bumpPending(tx, -1);

            console.log(
                `[attendanceRequest] ${decider.name} → ${uid} ${year}-${month}-${key} 승인 (workMin=${workMin})`,
            );
            return { ok: true, day: key, workMin };
        });
    },
);

// ════════════════════════════════════════════════════════════════
// recountAttendancePending — 대기 건수를 실제 개수로 다시 센다
// ════════════════════════════════════════════════════════════════
//
// 평소에는 쓸 일이 없다. 숫자가 어긋났을 때 개발 도구에서 한 번 누르는 용도다.
// (요청·승인·반려가 전부 트랜잭션 안에서 증감하므로 정상적으로는 안 어긋난다.
//  함수 배포 전에 들어온 요청이 있거나, 문서를 손으로 고친 경우에 쓴다)
//
// ⚠️ 이번 달과 지난달만 센다. 승인 목록 화면이 보는 범위와 같아야 한다 —
//    범위가 다르면 "배지는 3인데 목록에는 2개" 가 된다.
// ════════════════════════════════════════════════════════════════
exports.recountAttendancePending = onCall(
    { region: REGION, maxInstances: 2 },
    async (request) => {
        const staff = await requireStaff(request);

        const token = request.auth.token || {};
        const perms = Array.isArray(token.perms) ? token.perms : [];
        if (token.team !== "admin" && !perms.includes("editAttendance")) {
            throw new HttpsError("permission-denied", "권한이 없습니다.");
        }

        const now = new Date(Date.now() + KST_OFFSET_MS);
        const months = [
            { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 },
            now.getUTCMonth() === 0
                ? { year: now.getUTCFullYear() - 1, month: 12 }
                : { year: now.getUTCFullYear(), month: now.getUTCMonth() },
        ];

        // 월 문서 ID 가 `{YYYY-MM}_{uid}` 라서 접두어로 훑으면 그 달 전체가 잡힌다.
        // 직원 목록을 따로 읽지 않아도 된다.
        let count = 0;
        for (const m of months) {
            const prefix = `${m.year}-${String(m.month).padStart(2, "0")}_`;
            const snap = await db()
                .collection("attendance")
                .where(admin.firestore.FieldPath.documentId(), ">=", prefix)
                .where(admin.firestore.FieldPath.documentId(), "<", prefix + "\uf8ff")
                .get();

            snap.forEach((doc) => {
                const days = doc.data().days || {};
                for (const k of Object.keys(days)) {
                    const r = days[k] && days[k].request;
                    if (r && r.status === "pending") count++;
                }
            });
        }

        const beforeSnap = await PENDING_DOC().get();
        const before = beforeSnap.exists ? beforeSnap.data().count || 0 : 0;

        await PENDING_DOC().set(
            { count, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true },
        );

        console.log(`[attendanceRequest] ${staff.name} 다시 세기: ${before} → ${count}`);
        return { ok: true, count, before };
    },
);
