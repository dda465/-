// ════════════════════════════════════════════════════════════════
// 직원 권한(커스텀 클레임) 동기화
// ════════════════════════════════════════════════════════════════
//
// 무엇을 하는가
//   Firestore 의 staff/{uid} 문서가 만들어지거나 바뀌면,
//   그 직원의 로그인 토큰에 team/role 을 심는다.
//
// 왜 필요한가
//   Firestore 보안 규칙은 `request.auth.token.team` 을 본다.
//   staff 문서를 직접 읽어서 판단하면 클라이언트에서 우회할 수 있기 때문이다.
//   이 함수가 없으면 클레임이 비어 있어서 규칙이 전부 막고, 아무도 로그인할 수 없다.
//
// ⚠️ 이 파일은 새로 추가된 것이다. 기존 index.js 의 함수 12개는 건드리지 않는다.
//    index.js 맨 아래에 다음 한 줄만 추가돼 있다:
//      Object.assign(exports, require('./staffAuth'));
//
// 런타임 Node 20 / firebase-functions v4 (v2 API) / 리전 asia-northeast3
// ════════════════════════════════════════════════════════════════

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

// index.js 가 이미 initializeApp() 을 부른다.
// 두 번 부르면 오류가 나므로 아직 초기화 안 된 경우에만 부른다.
if (!admin.apps.length) {
    admin.initializeApp();
}

const REGION = "asia-northeast3";

// 앱의 types/staff.ts 와 같은 값이어야 한다. 한쪽만 바꾸면 권한이 어긋난다.
const TEAMS = ["delivery", "inspection", "dev", "admin"];
const ROLES = ["member", "lead", "manager", "owner"];

// ── 권한 ────────────────────────────────────────────────────────
const PERM_AREAS = ["delivery", "inspection", "stock", "dev"];
const PERM_ACTIONS = [
    "approvePayment",
    "manageStaff",
    "editAttendance",
    "manageSettings",
    "viewAnalytics",
];
const ALL_PERMS = [...PERM_AREAS, ...PERM_ACTIONS];

/** 그 팀이 자동으로 갖는 영역. admin 은 전부라 null */
function teamArea(team) {
    if (team === "delivery") return "delivery";
    if (team === "inspection") return "inspection";
    if (team === "dev") return "dev";
    return null; // admin
}

/**
 * ⭐ 실제로 적용되는 권한.
 *
 *   admin 팀 → 전부
 *   그 외    → 팀의 영역 ∪ 관리자가 켜준 것
 *
 * ⚠️ 앱의 `types/staff.ts` 의 `effectivePerms()` 와 **규칙이 같아야 한다.**
 *    한쪽만 고치면 화면에는 보이는데 저장이 안 되는 상태가 된다.
 *
 * ⚠️ `staff` 문서의 `perms` 에는 **추가로 켜준 것만** 들어 있다.
 *    소속 팀 영역을 문서에 저장하면 팀을 옮겼을 때 옛 권한이 남는다.
 */
function effectivePerms(team, perms) {
    if (team === "admin") return [...ALL_PERMS];

    const set = new Set();
    const area = teamArea(team);
    if (area) set.add(area);

    if (Array.isArray(perms)) {
        for (const p of perms) {
            if (ALL_PERMS.includes(p)) set.add(p);
        }
    }
    return [...set];
}

/**
 * 문서 값이 이상해도 함수가 죽지 않게 안전한 기본값으로 떨어뜨린다.
 * 잘못된 값이 그대로 클레임에 들어가면 규칙이 예상 못 한 방향으로 통과할 수 있다.
 */
function safeTeam(value) {
    return TEAMS.includes(value) ? value : "delivery";
}
function safeRole(value) {
    return ROLES.includes(value) ? value : "member";
}

/** 배열 두 개가 같은 내용인지 (순서 무시) */
function samePerms(a, b) {
    const x = Array.isArray(a) ? [...a].sort() : [];
    const y = Array.isArray(b) ? [...b].sort() : [];
    return x.length === y.length && x.every((v, i) => v === y[i]);
}

/**
 * staff/{uid} 문서가 생성·수정·삭제되면 커스텀 클레임을 맞춘다.
 *
 * - 문서가 있고 active !== false  → { team, role } 을 심는다
 * - 문서가 없거나 active === false → 클레임을 비운다 (퇴사 처리)
 */
exports.syncStaffClaims = onDocumentWritten(
    {
        document: "staff/{uid}",
        region: REGION,
        // 직원 15명 규모라 동시 실행이 많을 일이 없다. 비용을 낮게 묶어둔다.
        maxInstances: 3,
    },
    async (event) => {
        const uid = event.params.uid;
        const after = event.data && event.data.after && event.data.after.exists
            ? event.data.after.data()
            : null;

        // ── 심을 클레임을 정한다 ──
        let claims;
        if (!after) {
            claims = null; // 문서 삭제 → 권한 회수
            console.log(`[staffClaims] ${uid} 문서 삭제됨 → 클레임 제거`);
        } else if (after.active === false) {
            claims = null; // 퇴사 처리 → 권한 회수 (문서는 기록으로 남긴다)
            console.log(`[staffClaims] ${uid} 퇴사(active:false) → 클레임 제거`);
        } else {
            const team = safeTeam(after.team);
            claims = {
                team,
                role: safeRole(after.role),
                // ★ 보안 규칙이 request.auth.token.perms 를 검사한다.
                //   문서에는 "추가로 켜준 것"만 있으므로 여기서 실제 권한을 계산해 심는다.
                //   (클레임 한도 1000바이트 — 권한 8개는 200바이트 남짓이라 여유 있다)
                perms: effectivePerms(team, after.perms),
            };
            console.log(
                `[staffClaims] ${uid} → team=${claims.team} role=${claims.role} ` +
                `perms=[${claims.perms.join(",")}]`
            );
        }

        // ── 이미 같으면 아무것도 하지 않는다 ──
        // 문서의 다른 필드(전화번호 등)만 바뀐 경우 불필요하게 토큰을 흔들지 않는다.
        let user;
        try {
            user = await admin.auth().getUser(uid);
        } catch (e) {
            if (e && e.code === "auth/user-not-found") {
                // staff 문서를 먼저 만들고 Auth 계정을 나중에 만든 경우.
                // 계정을 만든 뒤 staff 문서를 아무거나 한 번 저장하면 다시 실행된다.
                console.warn(
                    `[staffClaims] uid=${uid} 에 해당하는 Authentication 계정이 없습니다. ` +
                    `Authentication 에서 계정을 먼저 만들고, staff 문서를 다시 저장하세요.`
                );
                return;
            }
            throw e;
        }

        const current = user.customClaims || {};
        const sameTeam = current.team === (claims ? claims.team : undefined);
        const sameRole = current.role === (claims ? claims.role : undefined);
        const samePerm = samePerms(current.perms, claims ? claims.perms : undefined);
        if (sameTeam && sameRole && samePerm) {
            console.log(`[staffClaims] ${uid} 변경 없음 — 건너뜀`);
            return;
        }

        // ── 클레임 심기 ──
        await admin.auth().setCustomUserClaims(uid, claims);

        // ⚠️ 클레임은 **다음 토큰 갱신부터** 적용된다.
        //    이미 로그인해 있던 사람은 로그아웃 후 다시 로그인해야 반영된다.
        //    (앱은 로그인 시 토큰을 강제로 새로 받도록 해 두었다)
        console.log(`[staffClaims] ${uid} 적용 완료`);
    }
);

// ════════════════════════════════════════════════════════════════
// createStaffAccount — 로그인 계정 + staff 문서를 한 번에 만든다
// ════════════════════════════════════════════════════════════════
//
// ⚠️ **브라우저에서는 계정을 만들 수 없다.**
//    클라이언트 SDK 로 createUser 를 하면 그 계정으로 로그인이 바뀌어서
//    **관리자가 로그아웃된다.** 그래서 서버에서 해야 한다.
//
// 권한 검사는 반드시 여기서 한다. 화면에서 버튼을 숨기는 건 표시용일 뿐이다.
// ════════════════════════════════════════════════════════════════

/** 헷갈리는 글자(0/O, 1/l/I)를 뺀 임시 비밀번호 */
function makeTempPassword(length = 10) {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < length; i++) {
        out += chars[crypto.randomInt(0, chars.length)];
    }
    return out;
}

exports.createStaffAccount = onCall(
    { region: REGION, maxInstances: 3 },
    async (request) => {
        // ── 호출자 권한 검사 (★ 서버에서) ──
        const auth = request.auth;
        if (!auth || !auth.uid) {
            throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
        }

        const callerPerms = (auth.token && auth.token.perms) || [];
        if (!Array.isArray(callerPerms) || !callerPerms.includes("manageStaff")) {
            throw new HttpsError(
                "permission-denied",
                "직원 계정을 만들 권한이 없습니다."
            );
        }

        // ── 입력 검사 ──
        const d = request.data || {};
        const name = String(d.name || "").trim();
        const email = String(d.email || "").trim().toLowerCase();
        const team = safeTeam(d.team);
        const role = safeRole(d.role);
        const phone = String(d.phone || "").trim();

        if (!name) throw new HttpsError("invalid-argument", "이름을 입력해 주세요.");
        if (!email || !email.includes("@")) {
            throw new HttpsError("invalid-argument", "올바른 이메일을 입력해 주세요.");
        }

        // 아는 권한만 남긴다. 소속 팀 영역은 저장하지 않는다(자동으로 계산됨).
        const area = teamArea(team);
        const perms = Array.isArray(d.perms)
            ? [...new Set(d.perms.filter((p) => ALL_PERMS.includes(p) && p !== area))]
            : [];

        // ── 계정 생성 ──
        const tempPassword = makeTempPassword();
        let user;
        try {
            user = await admin.auth().createUser({
                email,
                password: tempPassword,
                displayName: name,
            });
        } catch (e) {
            if (e && e.code === "auth/email-already-exists") {
                throw new HttpsError(
                    "already-exists",
                    "이미 사용 중인 이메일입니다. 다른 이메일을 쓰거나, 이미 있는 계정이면 목록에서 찾아 수정하세요."
                );
            }
            if (e && e.code === "auth/invalid-email") {
                throw new HttpsError("invalid-argument", "이메일 형식이 올바르지 않습니다.");
            }
            console.error("[createStaffAccount] 계정 생성 실패:", e);
            throw new HttpsError("internal", "계정을 만들지 못했습니다: " + e.message);
        }

        // ── staff 문서 생성 ──
        // 이 쓰기가 syncStaffClaims 를 깨워서 커스텀 클레임까지 자동으로 심어준다.
        try {
            await admin.firestore().collection("staff").doc(user.uid).set({
                name,
                email,
                team,
                role,
                phone,
                perms,
                active: true,
                joinedAt: admin.firestore.Timestamp.now(),
                createdBy: auth.uid,
            });
        } catch (e) {
            // 문서를 못 만들면 계정만 떠 있는 상태가 된다. 되돌린다.
            console.error("[createStaffAccount] staff 문서 생성 실패, 계정 되돌림:", e);
            try {
                await admin.auth().deleteUser(user.uid);
            } catch (e2) {
                console.error("[createStaffAccount] 계정 되돌리기도 실패:", e2);
            }
            throw new HttpsError("internal", "직원 정보를 저장하지 못했습니다: " + e.message);
        }

        console.log(
            `[createStaffAccount] ${name}(${email}) 생성 — team=${team} ` +
            `perms=[${perms.join(",")}] by ${auth.uid}`
        );

        // ⚠️ 임시 비밀번호는 **여기서 한 번만** 돌려준다. 어디에도 저장하지 않는다.
        return { uid: user.uid, email, tempPassword };
    }
);
