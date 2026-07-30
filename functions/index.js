// Force redeploy after billing plan restoration
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();

const app = express();

// ===================================================================
// 비밀키 로딩 (functions/.env)
// -------------------------------------------------------------------
// ★ 키를 소스코드에 적지 않는다. 예전에 functions/index.js가 웹에 그대로
//   공개된 적이 있어(sharaphone.com/functions/index.js) 재발 방지가 목적.
//
// ★ 주의: .env는 배포하는 PC의 functions/ 폴더에 있어야 한다.
//   파일이 없거나 다른 경로에서 배포하면 값이 비고, 그러면 알림톡이
//   '조용히' 안 나가서 며칠 뒤에나 알아채게 된다.
//   → 아래 requireEnv가 시작 시 로그로 크게 경고하고,
//     실제 호출 시에는 500과 명확한 메시지를 돌려주도록 한다.
// ===================================================================
const MISSING_ENV = [];
function requireEnv(name) {
    const v = process.env[name];
    if (!v) {
        MISSING_ENV.push(name);
        console.error(`[치명] 환경변수 ${name} 가 설정되지 않았습니다. functions/.env를 확인하고 재배포하세요.`);
        return "";
    }
    return v;
}
// 키가 빠진 상태로 요청이 들어오면 조용히 실패시키지 않고 즉시 알린다.
function envGuard(res, names) {
    const miss = names.filter(n => !process.env[n]);
    if (miss.length) {
        console.error("[치명] 환경변수 누락으로 요청 거부:", miss.join(", "));
        res.status(500).send({
            error: "서버 설정 오류: 환경변수 " + miss.join(", ") + " 누락",
            hint: "functions/.env 파일이 있는 폴더에서 firebase deploy --only functions 를 다시 실행하세요."
        });
        return false;
    }
    return true;
}

app.use(cors({ origin: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const DEFECT_KO = {
    keys: {
        is_sealed: "미개봉",
        body_damage: "파손찍힘",
        micro_scratch: "기스",
        lcd_damage: "액정불량",
        burn_in: "잔상",
        func_defect: "기능불량"
    },
    values: {
        "true": "예",
        "false": "아니오",
        front: "전면",
        bezel: "테두리",
        rear: "후면",
        light: "줄/멍",
        heavy: "완전파손",
        yes: "있음",
        camera_lens: "카메라기스",
        camera_fail: "카메라작동불가",
        faceid: "페이스ID/지문",
        wifi: "와이파이/블루투스",
        compass: "나침반/GPS",
        unknown_part: "알수없는부품",
        sound: "스피커/마이크",
        vibration: "진동불량",
        touch: "터치불량",
        battery: "배터리불량",
        power: "전원불량",
        account: "계정잠김"
    }
};

function formatDefects(defectsDetails) {
    if (!defectsDetails || Object.keys(defectsDetails).length === 0) return '없음';
    
    const arr = [];
    for (const [k, v] of Object.entries(defectsDetails)) {
        if (v === 'none' || v === 'no' || v === 'false' || (Array.isArray(v) && v.length === 0) || v === '') continue;
        
        const kName = DEFECT_KO.keys[k] || k;
        
        if (v === true || v === 'true') {
            if (k === 'is_sealed') arr.push('미개봉');
            else arr.push(kName);
        } else if (Array.isArray(v)) {
            const vals = v.map(val => DEFECT_KO.values[val] || val);
            arr.push(`${kName}(${vals.join(', ')})`);
        } else if (typeof v === 'string') {
            const vName = DEFECT_KO.values[v] || v;
            if (vName === '있음' || vName === '예') {
                arr.push(kName);
            } else {
                arr.push(`${kName}(${vName})`);
            }
        }
    }
    
    return arr.length > 0 ? arr.join(', ') : '없음';
}

// 브라우저에서 직접 접속(GET)했을 때 정상 구동 확인을 위한 테스트 메시지
app.get("/cert/callback", (req, res) => {
    res.status(200).send("✅ 쉐라폰 이니시스 통신 서버(API)가 정상적으로 작동 중입니다.");
});

// 모바일/PC 결제 후 이니시스 서버가 보내주는 POST 요청
app.post("/cert/callback", async (req, res) => {
    try {
        const inicisData = req.body;
        await admin.firestore().collection("inicis_logs").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            data: inicisData
        });
        res.status(200).send("OK");
    } catch (error) {
        console.error("콜백 처리 중 에러 발생:", error);
        res.status(500).send("Internal Server Error");
    }
});

// 외부망 퍼블릭 접속을 강제 허용(invoker: "public")
exports.inicisApi = onRequest({ region: 'asia-northeast3', invoker: 'public' }, app);

// ==========================================
// 텔레그램 보안 발송 API (Frontend Token 노출 방지)
// ==========================================
const telegramApp = express();
telegramApp.use(cors({ origin: true }));
telegramApp.use(express.json());

const TELEGRAM_BOT_TOKEN = requireEnv("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_IDS = ["6989151823", "7434861149", "8415202496", "8549949204", "5649160603", "7909488316"];

telegramApp.post("/send", async (req, res) => {
    if (!envGuard(res, ["TELEGRAM_BOT_TOKEN"])) return;
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).send({ error: "Message is required" });
        }
        
        // Node 18+ 환경이므로 fetch 기본 사용 가능
        const sendPromises = TELEGRAM_CHAT_IDS.map(chatId => {
            return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: "Markdown"
                })
            });
        });

        await Promise.all(sendPromises);
        res.status(200).send({ success: true, message: "Telegram sent successfully" });
    } catch (error) {
        console.error("Telegram send error:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

exports.telegramApi = onRequest({ region: 'asia-northeast3', invoker: 'public' }, telegramApp);

// ==========================================
// 카카오 알림톡 발송 API (Solapi 연동)
// ==========================================
const alimtalkApp = express();
alimtalkApp.use(cors({ origin: true }));
alimtalkApp.use(express.json());

const { SolapiMessageService } = require('solapi');

const SOLAPI_API_KEY = requireEnv("SOLAPI_API_KEY");
const SOLAPI_API_SECRET = requireEnv("SOLAPI_API_SECRET");
const SENDER_NUMBER = requireEnv("SOLAPI_SENDER_NUMBER"); 
const PFID = requireEnv("SOLAPI_PFID");

// 지연 생성 — 모듈 로드 시점에 만들면 키가 비었을 때 여기서 터져
// 같은 파일의 다른 API(이니시스·텔레그램·굿스플로)까지 함께 죽는다.
let _messageService = null;
function getMessageService() {
    if (!_messageService) _messageService = new SolapiMessageService(SOLAPI_API_KEY, SOLAPI_API_SECRET);
    return _messageService;
}

alimtalkApp.post("/send", async (req, res) => {
    // 키가 비면 발송이 조용히 실패해 고객이 안내를 못 받는다 → 즉시 500으로 알림
    if (!envGuard(res, ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SENDER_NUMBER", "SOLAPI_PFID"])) return;
    try {
        const { phone, templateId, variables } = req.body;
        
        if (!phone || !templateId) {
            return res.status(400).send({ error: "phone and templateId are required" });
        }

        console.log(`[알림톡 발송 요청] 수신번호: ${phone}, 템플릿: ${templateId}, 변수:`, variables);

        const messageData = {
            to: phone,
            from: SENDER_NUMBER,
            kakaoOptions: {
                pfId: PFID,
                templateId: templateId,
                variables: variables
            }
        };

        const result = await getMessageService().send(messageData);
        console.log("Solapi Send Result:", result);

        res.status(200).send({ success: true, message: "Alimtalk sent successfully", result: result });
    } catch (error) {
        console.error("Alimtalk send error:", error);
        res.status(500).send({ error: "Internal Server Error", details: error.message });
    }
});

exports.alimtalkApi = onRequest({ region: 'asia-northeast3', invoker: 'public' }, alimtalkApp);

// ==========================================
// 포트원(KG이니시스) 본인인증 정보 조회 API
// ==========================================
const portoneApp = express();
portoneApp.use(cors({ origin: true }));
portoneApp.use(express.json());

const PORTONE_API_KEY = requireEnv("PORTONE_API_KEY");
const PORTONE_API_SECRET = requireEnv("PORTONE_API_SECRET");

portoneApp.post("/verify", async (req, res) => {
    if (!envGuard(res, ["PORTONE_API_KEY", "PORTONE_API_SECRET"])) return;
    try {
        const { imp_uid } = req.body;
        if (!imp_uid) {
            return res.status(400).send({ error: "imp_uid is required" });
        }

        // 1. 포트원 API 액세스 토큰 발급
        const tokenResponse = await fetch("https://api.iamport.kr/users/getToken", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                imp_key: PORTONE_API_KEY,
                imp_secret: PORTONE_API_SECRET
            })
        });
        
        const tokenData = await tokenResponse.json();
        if (tokenData.code !== 0) {
            console.error("포트원 토큰 발급 실패:", tokenData.message);
            return res.status(500).send({ error: "Failed to get PortOne token" });
        }
        
        const access_token = tokenData.response.access_token;

        // 2. imp_uid로 본인인증 정보 조회
        const certResponse = await fetch(`https://api.iamport.kr/certifications/${imp_uid}`, {
            method: "GET",
            headers: { "Authorization": access_token }
        });
        
        const certData = await certResponse.json();
        if (certData.code !== 0) {
            console.error("포트원 인증 정보 조회 실패:", certData.message);
            return res.status(500).send({ error: "Failed to get certification data" });
        }
        
        const certInfo = certData.response;
        
        res.status(200).send({ 
            success: true, 
            data: {
                name: certInfo.name,
                phone: certInfo.phone,
                birthday: certInfo.birthday || null,
                gender: certInfo.gender || null
            }
        });
        
    } catch (error) {
        console.error("포트원 연동 에러:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

exports.portoneApi = onRequest({ region: 'asia-northeast3', invoker: 'public' }, portoneApp);

// ==========================================
// 백엔드 데이터 동기화 (Firestore -> Google Sheets)
// ==========================================
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkewwgQ-m_3OQVph5Laex78UEgJV1klI1MaluW5ugsIeZy-bfXdi0JpZMnpER1CxGR/exec';
const GOOGLE_SCRIPT_URL_INVENTORY = 'https://script.google.com/macros/s/AKfycby-ekHguU90cIoRdGxxztAf_XYOIma-Mg7FvCnEZdVa3OYvqN3LmaTrEG8OHehmXtGO/exec';

function formatTimestampToFriendly(timestamp) {
    if (!timestamp) {
        const date = new Date();
        const pad = (n) => ("0" + n).slice(-2);
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
    
    let date = null;
    if (typeof timestamp === 'object') {
        const sec = timestamp._seconds || timestamp.seconds;
        if (sec !== undefined) {
            date = new Date(sec * 1000);
        } else if (typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        }
    } else if (typeof timestamp === 'string') {
        const match = timestamp.match(/(\d+):(\d+):(\d+)\s+(\d+)\/(\d+)\/(\d+)/);
        if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const seconds = parseInt(match[3]);
            const day = parseInt(match[4]);
            const month = parseInt(match[5]) - 1;
            const year = parseInt(match[6]);
            date = new Date(year, month, day, hours, minutes, seconds);
        } else {
            const parsed = new Date(timestamp);
            if (!isNaN(parsed.getTime())) date = parsed;
        }
    }
    
    if (!date || isNaN(date.getTime())) {
        date = new Date();
    }
    
    const pad = (n) => ("0" + n).slice(-2);
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

exports.syncToGoogleSheetsOnCreate = onDocumentCreated(
    { document: 'quotes/{quoteId}', region: 'asia-northeast3' },
    async (event) => {
        const snap = event.data;
        if (!snap) return;
        const payload = snap.data();
        const quoteId = event.params.quoteId;

        // 배송지 이탈건 제외 (주소가 없을 경우 구글 시트 등록하지 않음)
        if (!payload.customerAddress || payload.customerAddress.trim() === '') {
            console.log(`[Google Sheets Sync] 주소 미입력 이탈건 - 시트 연동 스킵: ${quoteId}`);
            return;
        }

        try {
            const defectsText = formatDefects(payload.defectsDetails);

            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'create',
                    id: quoteId,
                    timestamp: formatTimestampToFriendly(payload.timestamp),
                    brand: payload.brand || "",
                    series: payload.series || "",
                    model: payload.model || "",
                    storage: payload.storage || "",
                    grade: payload.grade || "",
                    method: payload.method || "self",
                    price: payload.price || 0,
                    customerName: payload.customerName || "",
                    customerPhone: payload.customerPhone || "",
                    deliveryMethod: payload.deliveryMethod || "",
                    pickupDate: payload.pickupDate || "",
                    customerAddress: payload.customerAddress || "",
                    customerAccount: payload.customerAccount || "",
                    defectsDetails: payload.defectsDetails || {},
                    defects: defectsText,
                    trafficSource: payload.trafficSource || "direct",
                    status: payload.status || "신청접수"
                })
            });
            console.log(`[Google Sheets Sync] 신규 매입 접수 동기화 성공: ${quoteId}`, await response.text());
        } catch (error) {
            console.error(`[Google Sheets Sync Error] 신규 접수 동기화 실패: ${quoteId}`, error);
        }
    }
);

exports.syncToGoogleSheetsOnUpdate = onDocumentUpdated(
    { document: 'quotes/{quoteId}', region: 'asia-northeast3' },
    async (event) => {
        const after = event.data.after.data();
        const before = event.data.before.data();
        const quoteId = event.params.quoteId;

        // 1. 주소 입력 시점 동기화 (기존에 주소가 없다가 새로 입력된 경우 = 배송지 확정 시점)
        const becameConfirmed = after.customerAddress && after.customerAddress.trim() !== '' && 
                                (!before.customerAddress || before.customerAddress.trim() === '');

        if (becameConfirmed) {
            try {
                console.log(`[Google Sheets Sync] 배송지 확정 감지 - 시트 등록 시작: ${quoteId}`);
                const defectsText = formatDefects(after.defectsDetails);

                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'create',
                        id: quoteId,
                        // 배송방법이 확정된 시각을 우선 사용. after.timestamp는 본인인증 직후
                        // (배송방법 선택 전) 시각이라, 며칠 뒤 마무리한 건이 옛 날짜로 시트에 남는다.
                        timestamp: formatTimestampToFriendly(after.submittedAt || after.timestamp),
                        brand: after.brand || "",
                        series: after.series || "",
                        model: after.model || "",
                        storage: after.storage || "",
                        grade: after.grade || "",
                        method: after.method || "self",
                        price: after.price || 0,
                        customerName: after.customerName || "",
                        customerPhone: after.customerPhone || "",
                        deliveryMethod: after.deliveryMethod || "",
                        pickupDate: after.pickupDate || "",
                        customerAddress: after.customerAddress || "",
                        customerAccount: after.customerAccount || "",
                        defectsDetails: after.defectsDetails || {},
                        defects: defectsText,
                        trafficSource: after.trafficSource || "direct",
                        status: after.status || "신청접수"
                    })
                });
                console.log(`[Google Sheets Sync] 배송지 확정 연동 성공: ${quoteId}`, await response.text());
            } catch (error) {
                console.error(`[Google Sheets Sync Error] 배송지 확정 연동 실패: ${quoteId}`, error);
            }
        }

        // 2. 상태 변경 동기화 (주소가 있는 확정 건에 대해서만 상태 업데이트 진행)
        if (after.status !== before.status && after.customerAddress && after.customerAddress.trim() !== '') {
            try {
                console.log(`[Google Sheets Sync] 상태 변경 동기화 시작: ${quoteId} (${before.status} -> ${after.status})`);
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'updateStatus',
                        orderId: quoteId,
                        status: after.status
                    })
                });
                console.log(`[Google Sheets Sync] 상태 변경 동기화 성공: ${quoteId}`, await response.text());
            } catch (error) {
                console.error(`[Google Sheets Sync Error] 상태 변경 동기화 실패: ${quoteId}`, error);
            }

            if (after.status === '입금완료' && GOOGLE_SCRIPT_URL_INVENTORY) {
                try {
                    console.log(`[Inventory Sync] 매입 완료 전용 시트 동기화 시작: ${quoteId}`);
                    const defectsText = formatDefects(after.defectsDetails);
                    const invResponse = await fetch(GOOGLE_SCRIPT_URL_INVENTORY, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify({
                            action: 'addInventory',
                            date: new Date().toLocaleString(),
                            imei: after.customerName || '',
                            model: `${after.brand || ''} ${after.model || ''}`.trim(),
                            storage: after.storage || '용량미상',
                            defects: defectsText
                        })
                    });
                    console.log(`[Inventory Sync] 매입 완료 전용 시트 동기화 성공: ${quoteId}`, await invResponse.text());
                } catch (error) {
                    console.error(`[Inventory Sync Error] 매입 완료 전용 시트 동기화 실패: ${quoteId}`, error);
                }
            }
        }
        
        // 3. 고객 전자매매계약서 동의 완료 시 텔레그램 알림 발송
        if (after.status === '입금대기' && before.status === '검수완료') {
            try {
                console.log(`[Telegram Notification] 전자매매계약서 동의 완료 감지: ${quoteId}`);
                
                const finalPriceText = after.inspectionData && after.inspectionData.finalPrice 
                    ? new Intl.NumberFormat('ko-KR').format(after.inspectionData.finalPrice) + '원'
                    : (after.price ? new Intl.NumberFormat('ko-KR').format(after.price) + '원' : '0원');

                const tgMessage = `
✍️ *[전자매매계약서 동의 완료]*
━━━━━━━━━━━━━━
👤 *고객명*: ${after.customerName || '알 수 없음'}
📞 *연락처*: ${after.customerPhone || '알 수 없음'}
📱 *모델명*: ${after.brand || ''} ${after.model || ''}
💰 *최종매입가*: ${finalPriceText}
━━━━━━━━━━━━━━
*상태가 [입금대기]로 전환되었습니다.* 
관리자 페이지에서 확인 후 신속히 입금을 진행해 주세요.
`.trim();

                const sendPromises = TELEGRAM_CHAT_IDS.map(chatId => {
                    return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: tgMessage,
                            parse_mode: "Markdown"
                        })
                    });
                });
                await Promise.all(sendPromises);
                console.log(`[Telegram Notification] 동의 완료 알림 발송 성공: ${quoteId}`);
            } catch (tgError) {
                console.error(`[Telegram Notification Error] 동의 완료 알림 발송 실패: ${quoteId}`, tgError);
            }
        }
    }
);

exports.migrateTodayQuotes = onRequest({ region: 'asia-northeast3' }, async (req, res) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const snapshot = await admin.firestore().collection('quotes')
            .orderBy('firebaseTimestamp', 'desc')
            .limit(20)
            .get();
            
        let count = 0;
        const results = [];
        for (const doc of snapshot.docs) {
            const payload = doc.data();
            const defectsText = formatDefects(payload.defectsDetails);

            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'create',
                    id: doc.id,
                    timestamp: formatTimestampToFriendly(payload.timestamp),
                    brand: payload.brand || "",
                    series: payload.series || "",
                    model: payload.model || "",
                    storage: payload.storage || "",
                    grade: payload.grade || "",
                    method: payload.method || "self",
                    price: payload.price || 0,
                    customerName: payload.customerName || "",
                    customerPhone: payload.customerPhone || "",
                    deliveryMethod: payload.deliveryMethod || "",
                    pickupDate: payload.pickupDate || "",
                    customerAddress: payload.customerAddress || "",
                    customerAccount: payload.customerAccount || "",
                    defectsDetails: payload.defectsDetails || {},
                    defects: defectsText,
                    trafficSource: payload.trafficSource || "direct",
                    status: payload.status || "신청접수"
                })
            });
            results.push(await response.text());
            count++;
        }
        res.send(`Migration finished. Processed ${count} records. Results: ${results.join(', ')}`);
    } catch (error) {
        res.status(500).send(`Migration failed: ${error.message}`);
    }
});


// ===================================================================
// 굿스플로(홈픽) 방문수거 연동
// -------------------------------------------------------------------
// ※ API 키는 소스에 넣지 않습니다. functions/.env 파일에 설정하세요:
//     GOODSFLOW_API_KEY=발급받은키
//     GOODSFLOW_BASE_URL=https://api-test.homepick.com   (운영 전환 시 실서버 주소로)
//     GOODSFLOW_TO_ZIP=사무실우편번호
// ※ 실제 배차 = 비용 발생. 반드시 관리자 토큰 검증 후에만 동작합니다.
// ===================================================================
const goodsflowApp = express();
goodsflowApp.use(cors({ origin: true }));
goodsflowApp.use(express.json());

const GF_BASE_URL = process.env.GOODSFLOW_BASE_URL || "https://api-test.homepick.com";
const GF_API_KEY = process.env.GOODSFLOW_API_KEY || "";
// 택배사 코드 — /v1/code/transporter 조회 결과 이 계정은 HANJIN(한진택배)만 사용 가능.
const GF_TRANSPORTER = process.env.GOODSFLOW_TRANSPORTER || "HANJIN";
// 배송 종류 — 일반 방문수거 택배는 D_SHIPPING.
// (D_PICKUP은 '오늘픽업' 전용 상품이라 계약에 없으면 "배송 종류 값이 잘못되었습니다" 오류가 남)
const GF_DELIVERY_TYPE = process.env.GOODSFLOW_DELIVERY_TYPE || "D_SHIPPING";
// 수거 희망 '시각' — 굿스플로가 요구하는 형식이 "YYYY-MM-DD HH:mm"이라 시각이 반드시 있어야 한다.
// 다만 한진 방문수거는 시간 지정이 안 되므로 이 값이 실제 방문시각을 정하지는 않는 것으로 보인다.
// (굿스플로 담당자 확인 필요) 확인 후 조정할 수 있게 .env로 빼둔다.
const GF_PICKUP_HOUR = process.env.GOODSFLOW_PICKUP_HOUR || "13:00";
// 받는 분 = 쉐라폰 사무실 (환경변수로 두어 주소 변경에 대응)
const GF_TO = {
    zipCode: process.env.GOODSFLOW_TO_ZIP || "",
    name: process.env.GOODSFLOW_TO_NAME || "쉐라폰",
    phone: process.env.GOODSFLOW_TO_PHONE || "07086809275",
    addr1: process.env.GOODSFLOW_TO_ADDR1 || "부산시 동천로 116 한신밴빌딩",
    addr2: process.env.GOODSFLOW_TO_ADDR2 || "1003호"
};
const GF_ADMIN_EMAILS = ["dda465@hanmail.net", "admin@rejuphone.com", "admin@sharaphone.com", "guffy321@naver.com", "test@admin.com"];

// 관리자 인증 — 통과 못하면 null 반환(응답은 이미 전송됨)
async function gfRequireAdmin(req, res) {
    try {
        const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
        if (!m) { res.status(401).json({ ok: false, error: "인증 토큰이 없습니다." }); return null; }
        const decoded = await admin.auth().verifyIdToken(m[1]);
        if (!decoded.email || !GF_ADMIN_EMAILS.includes(decoded.email)) {
            res.status(403).json({ ok: false, error: "관리자만 사용할 수 있습니다." }); return null;
        }
        return decoded;
    } catch (e) {
        res.status(401).json({ ok: false, error: "인증 실패: " + e.message }); return null;
    }
}

async function gfFetch(path, options = {}) {
    if (!GF_API_KEY) throw new Error("GOODSFLOW_API_KEY가 설정되지 않았습니다. functions/.env를 확인하세요.");
    const r = await fetch(GF_BASE_URL + path, {
        ...options,
        headers: { "Content-Type": "application/json", "Authorization": GF_API_KEY, ...(options.headers || {}) }
    });
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch (_) { body = text; }
    if (!r.ok) throw new Error(`굿스플로 오류 ${r.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    return body;
}
const gfDigits = (s) => String(s || "").replace(/[^0-9]/g, "");

// 굿스플로는 처리 실패도 HTTP 200으로 주면서 본문에 success:false를 담아 보낸다.
// (예: "이미 집하되어 취소할 수 없습니다") gfFetch는 HTTP 상태만 보므로 본문도 반드시 확인해야 한다.
// 실패면 사유 문자열을, 정상이면 null을 돌려준다.
function gfPayloadError(result) {
    if (!result || typeof result !== "object") return null;
    const ok = result.success;
    if (ok === false || ok === "false") {
        return String(result.message || result.errorMessage || result.error || "굿스플로가 실패를 반환했습니다.").slice(0, 300);
    }
    return null;
}

// 택배사 표기 정리 — 굿스플로는 "HANJIN" 같은 코드로 내려주는데
// 이 값이 그대로 알림톡 #{택배사} 변수에 들어가면 고객에게 "HANJIN"이라고 나간다.
const GF_CARRIER_NAMES = {
    HANJIN: "한진택배", CJGLS: "CJ대한통운", KGB: "로젠택배",
    HYUNDAI: "롯데택배", LOTTE: "롯데택배", EPOST: "우체국택배", KDEXP: "경동택배"
};
function gfCarrierName(v) {
    const s = String(v || "").trim();
    if (!s) return "한진택배";
    return GF_CARRIER_NAMES[s.toUpperCase()] || s;
}

// 응답 구조가 예상과 달라도 특정 키를 찾아내는 안전장치 (중첩 객체/배열 재귀 탐색)
function gfDeepFind(obj, key, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 6) return null;
    if (Array.isArray(obj)) {
        for (const it of obj) { const r = gfDeepFind(it, key, depth + 1); if (r) return r; }
        return null;
    }
    if (obj[key]) return obj[key];
    for (const k of Object.keys(obj)) {
        const r = gfDeepFind(obj[k], key, depth + 1);
        if (r) return r;
    }
    return null;
}

// ─── 집하 불가일(일요일·공휴일) 방어 ─────────────────────────────────────
// 택배사는 일요일과 공휴일에 집하하지 않는다. 화면(script.js)에서도 이 날짜를 막지만
// 그 목록은 손으로 관리하는 것이라 빠지는 날이 생긴다(예: 2026년 재지정된 제헌절 7/17).
// 그래서 실제로 돈이 나가는 접수 직전, 서버에서 한 번 더 걸러 다음 영업일로 밀어준다.
const GF_HOLIDAYS = new Set([
    "2026-01-01", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-03-01", "2026-03-02", "2026-05-05", "2026-05-24", "2026-05-25",
    "2026-06-03", "2026-06-06",
    "2026-07-17", // 제헌절 — 2026년부터 공휴일 재지정
    "2026-08-15", "2026-08-17",
    "2026-09-24", "2026-09-25", "2026-09-26",
    "2026-10-03", "2026-10-05", "2026-10-09", "2026-12-25",
    // ⚠ 2027년 이후는 잠정치(특히 설·추석 등 음력 기준일과 대체공휴일은 미확정).
    //   매년 말 관공서 공휴일 규정 확정되면 이 목록을 갱신할 것.
    "2027-01-01", "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09",
    "2027-03-01", "2027-05-05", "2027-05-13", "2027-06-06", "2027-06-07",
    "2027-07-17", "2027-08-15", "2027-08-16", "2027-09-14", "2027-09-15",
    "2027-09-16", "2027-10-03", "2027-10-04", "2027-10-09", "2027-10-11", "2027-12-25"
]);

function gfIsPickupClosed(ymd, dow) {
    return dow === 0 || GF_HOLIDAYS.has(ymd); // 일요일은 집하 없음(토요일은 가능)
}

// "YYYY-MM-DD HH:mm"을 받아 집하 가능한 날로 민다. 최대 10일까지만 탐색(무한루프 방지).
function gfShiftToBusinessDay(dtStr) {
    const m = String(dtStr || "").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);
    if (!m) return dtStr;
    let ymd = m[1];
    const hhmm = m[2];
    for (let i = 0; i < 10; i++) {
        const d = new Date(`${ymd}T00:00:00+09:00`);
        // KST 기준 요일 (UTC로 저장되므로 +9시간 보정 후 판정)
        const dow = new Date(d.getTime() + 9 * 3600000).getUTCDay();
        if (!gfIsPickupClosed(ymd, dow)) return `${ymd} ${hhmm}`;
        ymd = new Date(d.getTime() + 86400000 + 9 * 3600000).toISOString().slice(0, 10);
    }
    return `${ymd} ${hhmm}`;
}

// 희망 수거일이 없을 때 쓰는 기본값: 내일(한국시간) 13:00 — 단, 집하 불가일이면 그 다음 영업일
function gfDefaultPickupDateTime() {
    const kstTomorrow = new Date(Date.now() + 9 * 3600000 + 86400000);
    return gfShiftToBusinessDay(kstTomorrow.toISOString().slice(0, 10) + " " + GF_PICKUP_HOUR);
}

// "MM/DD" 또는 "YYYY-MM-DD" 형태의 희망 수거일 → 굿스플로 형식 "YYYY-MM-DD HH:mm" (한국시간 기준)
// 규칙:
//  - 연도가 없으면 올해를 붙임
//  - 6개월 이상 과거로 계산되면 연말/연초 경계(12월 신청→1월 수거)로 보고 내년으로
//  - 그래도 이미 지난 날짜면(관리자가 뒤늦게 예약하는 흔한 경우) 내일 13:00으로 대체
//    ★ 이 대체가 없으면 "07/18"을 오늘(07/20)에 예약할 때 2027-07-18로 접수되는 사고가 남
function gfPickupDateTime(pickupDate, hhmm = GF_PICKUP_HOUR) {
    const s = String(pickupDate || "").trim();
    if (!s) return "";
    let y, mo, da;
    let m = s.match(/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})$/);
    if (m) {
        y = Number(m[1]); mo = String(m[2]).padStart(2, "0"); da = String(m[3]).padStart(2, "0");
    } else {
        m = s.match(/^(\d{1,2})[-.\/](\d{1,2})$/);
        if (!m) return "";
        const kstNow = new Date(Date.now() + 9 * 3600000); // UTC+9 = KST 벽시계
        y = kstNow.getUTCFullYear();
        mo = String(m[1]).padStart(2, "0"); da = String(m[2]).padStart(2, "0");
        // 연말 경계: 올해로 붙였더니 반년 이상 과거면 내년 건으로 판단
        const cand = new Date(`${y}-${mo}-${da}T${hhmm}:00+09:00`).getTime();
        if (!isNaN(cand) && cand < Date.now() - 180 * 86400000) y += 1;
    }
    const t = new Date(`${y}-${mo}-${da}T${hhmm}:00+09:00`).getTime();
    if (isNaN(t)) return "";
    // ★ 한진택배는 '당일 23:59까지 접수 → 다음날 수거' 구조라 당일 수거 자체가 불가능하다.
    //   따라서 예약 가능한 가장 빠른 날은 언제나 '내일'. 오늘 이전 날짜는 전부 대체한다.
    //   (시각이 아니라 '날짜'로 판정해야 함 — 오전에 눌러도 당일 수거는 안 잡히므로)
    const kstTodayYmd = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    if (`${y}-${mo}-${da}` <= kstTodayYmd) return gfDefaultPickupDateTime();
    // 일요일·공휴일이면 다음 영업일로 (택배사 집하 없음)
    return gfShiftToBusinessDay(`${y}-${mo}-${da} ${hhmm}`);
}

// 이 계정이 실제로 사용 가능한 배송종류/택배사를 조회 (실패 원인 진단용)
async function gfDescribeAvailable() {
    const pick = (v) => {
        try { return JSON.stringify(v).slice(0, 700); } catch (_) { return String(v).slice(0, 700); }
    };
    const [dt, tr] = await Promise.all([
        gfFetch("/v1/available/deliveryType").catch(e => ({ error: String(e.message).slice(0, 200) })),
        gfFetch("/v1/code/transporter").catch(e => ({ error: String(e.message).slice(0, 200) }))
    ]);
    return "사용 가능한 배송종류:\n" + pick(dt) + "\n\n사용 가능한 택배사:\n" + pick(tr);
}

// 방문수거 예약 생성
goodsflowApp.post("/createOrder", async (req, res) => {
    const user = await gfRequireAdmin(req, res); if (!user) return;
    const quoteId = (req.body || {}).quoteId;
    try {
        if (!quoteId) return res.status(400).json({ ok: false, error: "quoteId가 필요합니다." });
        const ref = admin.firestore().collection("quotes").doc(quoteId);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ ok: false, error: "신청건을 찾을 수 없습니다." });
        const q = snap.data();

        // 멱등성: 중복 배차(=중복 비용) 방지
        if (q.goodsflowOrderNo) return res.status(409).json({ ok: false, error: `이미 예약된 건입니다 (주문번호 ${q.goodsflowOrderNo}).` });
        if (!q.customerZipCode) return res.status(400).json({ ok: false, error: "우편번호가 없어 자동예약할 수 없습니다. (우편번호 저장 이전 신청건)" });
        // 이미 끝났거나 버려진 건에 배차하면 그대로 헛비용(건당 배송비) → 차단
        const GF_BLOCK_STATUSES = ["취소", "삭제", "입금완료", "반송접수", "반송완료"];
        if (GF_BLOCK_STATUSES.includes(q.status)) {
            return res.status(400).json({ ok: false, error: `'${q.status}' 상태에서는 수거예약을 할 수 없습니다.` });
        }
        if (q.isDeleted === true) return res.status(400).json({ ok: false, error: "삭제된 신청건입니다." });
        // 개인발송(cvs)은 고객이 직접 편의점/우체국에서 보내므로 배차 대상이 아님 — 실수 예약(=헛비용) 차단
        if (q.deliveryMethod !== "courier") {
            return res.status(400).json({ ok: false, error: "방문수거 건만 예약할 수 있습니다. (현재: " + (q.deliveryMethod || "미입력") + ")" });
        }

        // 재예약 대응 — 굿스플로는 partnerOrderNo를 계정 내에서 재사용할 수 없다.
        // 취소한 건을 같은 번호로 다시 넣으면 '중복'으로 거절되고, 조회하면 취소된 옛 주문이 잡힌다.
        // 그래서 재예약 때는 뒤에 -R1, -R2… 를 붙여 새 번호로 접수한다.
        const gfRebookCount = Number(q.goodsflowRebookCount || 0);
        const partnerNo = gfRebookCount > 0 ? `${quoteId}-R${gfRebookCount}` : quoteId;

        const payload = {
            partnerOrderNo: partnerNo, // 이후 상태조회 열쇠 (재예약 시 접미사가 붙음)
            deliveryType: GF_DELIVERY_TYPE, // 일반 방문수거 택배 (기본 D_SHIPPING)
            // 택배사 코드 — 방문수거는 홈픽 배차. 계약에 따라 HOMEPICK / HOMEPICK3 중 하나.
            // .env의 GOODSFLOW_TRANSPORTER로 교체 가능 (빈 값이면 아예 전송하지 않음)
            ...(GF_TRANSPORTER ? { transporter: GF_TRANSPORTER } : {}),
            // 보내는 분 = 고객
            fromZipCode: gfDigits(q.customerZipCode),
            fromName: q.customerName || "",
            fromPhoneNumber: gfDigits(q.customerPhone),
            fromAddr1: q.customerAddress || "",
            // 주소2는 비우면 접수가 거절됨("보내는 분 주소2 항목이 누락"). 상세주소가 없으면 '-'로 대체.
            // (주소1에 이미 상세주소까지 합쳐 저장돼 있어 배송에는 지장 없음)
            fromAddr2: q.customerAddressDetail || "-",
            // 받는 분 = 쉐라폰 사무실
            toZipCode: gfDigits(GF_TO.zipCode),
            toName: GF_TO.name,
            toPhoneNumber: gfDigits(GF_TO.phone),
            toAddr1: GF_TO.addr1,
            toAddr2: GF_TO.addr2,
            // 박스/상품 정보 — 누락 시 400(잘못된 요청)이 남
            boxType: "XSMALL", // 휴대폰 1대 기준
            boxCount: 1,
            itemCategory: "휴대폰",
            itemName: (`${q.brand || ""} ${q.model || ""}`).trim() || "중고 휴대폰",
            // 물품가액 — 0원이면 굿스플로가 접수를 거절한다(기타기종 등 견적 0원 건).
            // 이 값은 운송 신고가액일 뿐 실제 매입가와 무관하므로, 0이거나 비정상이면 최소값으로 대체.
            itemPrice: (Number(q.price) > 0 ? Number(q.price) : 10000),
            itemQuantity: 1,
            pickupMessage: q.customerMemo || "",
            partnerMemo: `${q.customerName || ""} 고객님 매입 수거 건`
        };
        // 희망 수거일시 — "YYYY-MM-DD HH:mm" 형식이며 필수.
        // (이 값이 없으면 굿스플로가 "배송비 자동 산출 중 오류"로 접수를 거절함)
        // 고객이 고른 날짜가 없거나 형식이 이상하면 내일 13시로 대체.
        payload.pickupRequestDateTime = gfPickupDateTime(q.pickupDate) || gfDefaultPickupDateTime();
        // 고객이 고른 날짜와 실제 접수된 날짜가 다르면(지난 날짜/휴일 등) 관리자에게 알려야 한다.
        // 조용히 바뀌면 "왜 그날 안 왔지?" 하는 고객 문의로 돌아옴.
        const gfRequestedYmd = payload.pickupRequestDateTime.slice(0, 10);
        const gfCustomerWanted = String(q.pickupDate || "").trim();
        const gfDateShifted = gfCustomerWanted &&
            gfRequestedYmd.slice(5).replace("-", "/") !== gfCustomerWanted.replace(/^\d{4}-/, "").replace("-", "/");

        // 요청 본문은 "주문 배열" — 여러 건 동시 접수 구조라 단건도 배열로 감싸야 함
        let result = await gfFetch("/v1/order?partnerOrderNoDuplicateCheck=true", {
            method: "POST", body: JSON.stringify([payload])
        });
        // 응답: { success, message, data: { orderNo, orderBoxList: [ { invoiceNo, ... } ] } }
        // 요청을 배열로 보냈으므로 data가 배열로 올 수도 있어 두 형태 모두 처리.
        const rawData = (result && result.data) || {};
        const data = Array.isArray(rawData) ? (rawData[0] || {}) : rawData;
        let box = (data.orderBoxList && data.orderBoxList[0]) || {};
        // 그래도 못 찾으면 응답 전체에서 invoiceNo를 재귀 탐색 (구조가 예상과 달라도 번호는 건짐)
        if (!box.invoiceNo) {
            const found = gfDeepFind(result, "invoiceNo");
            if (found) box = Object.assign({}, box, { invoiceNo: found });
        }

        // 굿스플로가 준 주문번호를 못 받으면 우리 문서ID로 대체하지 않는다.
        // (가짜 번호를 넣으면 이후 취소·상태조회가 전부 실패하고, 예약된 것처럼 보여 더 위험)
        let orderNo = data.orderNo || gfDeepFind(result, "orderNo") || "";

        // 이미 같은 번호로 굿스플로에 접수돼 있는 경우(예: 취소가 우리 쪽에만 반영된 상태)
        // → 새로 만들지 말고 기존 주문 정보를 되찾아와 로컬에 복원한다.
        const msg = String((result && result.message) || "");
        let usedPartnerNo = partnerNo;
        if (!orderNo && msg.includes("중복")) {
            try {
                const exist = await gfFetch(`/v1/order/status/partnerOrderNo/${encodeURIComponent(partnerNo)}`);
                const foundOrderNo = gfDeepFind(exist, "orderNo");
                const existStatus = String(gfDeepFind(exist, "orderStatus") || "");

                // 기존 주문이 살아있으면 그걸 복원(이중 배차 방지).
                // 이미 취소된 주문이면 복원해봐야 '취소 상태'로 굳어버리므로,
                // 번호를 바꿔 새로 접수해야 한다. ★ 이게 없으면 취소한 건은 영영 재예약 불가.
                const isCanceled = /CANCEL/i.test(existStatus);
                if (foundOrderNo && !isCanceled) {
                    orderNo = foundOrderNo;
                    box = {
                        invoiceNo: gfDeepFind(exist, "invoiceNo") || "",
                        transporterInvoiceNo: gfDeepFind(exist, "transporterInvoiceNo") || "",
                        transporterName: gfDeepFind(exist, "transporterName") || "",
                        orderStatus: existStatus
                    };
                    result = exist; // 저장할 원문도 조회 결과로 교체
                } else {
                    // 새 번호로 재시도 (-R1, -R2 …). 최대 5회까지만 시도.
                    for (let n = gfRebookCount + 1; n <= gfRebookCount + 5 && !orderNo; n++) {
                        const retryNo = `${quoteId}-R${n}`;
                        payload.partnerOrderNo = retryNo;
                        const retry = await gfFetch("/v1/order?partnerOrderNoDuplicateCheck=true", {
                            method: "POST", body: JSON.stringify([payload])
                        });
                        const rd = (retry && retry.data) || {};
                        const rdata = Array.isArray(rd) ? (rd[0] || {}) : rd;
                        const rNo = rdata.orderNo || gfDeepFind(retry, "orderNo") || "";
                        if (rNo) {
                            orderNo = rNo;
                            usedPartnerNo = retryNo;
                            box = (rdata.orderBoxList && rdata.orderBoxList[0]) || {};
                            if (!box.invoiceNo) {
                                const f = gfDeepFind(retry, "invoiceNo");
                                if (f) box = Object.assign({}, box, { invoiceNo: f });
                            }
                            result = retry;
                        }
                    }
                }
            } catch (e) {
                console.error("중복 처리 실패:", e.message);
            }
        }

        if (!orderNo) {
            await ref.update({
                goodsflowError: "굿스플로가 주문번호를 반환하지 않았습니다. 접수 여부를 굿스플로에서 직접 확인해주세요.",
                goodsflowErrorAt: new Date(),
                goodsflowRaw: JSON.stringify(result || {}).slice(0, 4000)
            });
            // 실패 시, 이 계정이 쓸 수 있는 배송종류/택배사를 함께 보여줘 원인 파악을 돕는다
            let hint = "";
            try { hint = "\n\n──────────\n" + await gfDescribeAvailable(); } catch (_) { }
            return res.status(502).json({
                ok: false,
                error: "굿스플로가 주문번호를 주지 않았습니다.\n\n보낸 값: deliveryType=" + GF_DELIVERY_TYPE
                    + ", transporter=" + (GF_TRANSPORTER || "(미전송)")
                    + "\n\n응답 원문:\n" + JSON.stringify(result || {}).slice(0, 400) + hint
            });
        }

        await ref.update({
            goodsflowOrderNo: orderNo,
            goodsflowInvoiceNo: box.invoiceNo || "",
            // ⚠ 번호가 3종류다. 고객에게 안내할 수 있는 건 relay 뿐이다.
            //  · invoiceNo                 : 굿스플로 내부 예약번호 (260728-99529-001)
            //  · transporterInvoiceNo      : 홈픽 집하구간 번호 (26072899529001) — 한진 조회창에 안 나온다
            //  · relayTransporterInvoiceNo : 한진 간선 운송장 (573848472934, 5로 시작) — 이게 고객 조회용
            goodsflowTransporterInvoiceNo: box.transporterInvoiceNo || "",
            goodsflowRelayInvoiceNo: box.relayTransporterInvoiceNo || "",   // ★ 고객 안내용 실제 운송장
            goodsflowTransporter: gfCarrierName(box.relayTransporterName || box.transporterName || box.relayTransporter || box.transporter),
            goodsflowStatus: box.orderStatus || "",
            goodsflowCost: box.totalCost || 0,
            goodsflowBookedAt: new Date(),
            goodsflowBookedBy: user.email,
            goodsflowRaw: JSON.stringify(result).slice(0, 4000), // 응답 전체 저장 (data만 저장하면 구조 파악 불가)
            // 실제로 접수에 쓴 partnerOrderNo — 상태조회는 반드시 이 값으로 해야 한다(재예약 시 문서ID와 달라짐)
            goodsflowPartnerOrderNo: usedPartnerNo,
            goodsflowRebookCount: Number(String(usedPartnerNo).split("-R")[1] || 0),
            goodsflowPickupRequestDateTime: payload.pickupRequestDateTime, // 실제로 접수된 수거일시
            goodsflowPickupDateShifted: !!gfDateShifted,                   // 고객 희망일과 달라졌는지
            goodsflowError: admin.firestore.FieldValue.delete(),
            // 새로 예약했으므로 지난 미집하 흔적은 지운다.
            // (안 지우면 재예약해도 관리자 화면의 '미집하' 구역에 계속 남는다)
            goodsflowAlert: admin.firestore.FieldValue.delete(),
            pickupFailedNotifiedAt: admin.firestore.FieldValue.delete(),
            pickupFailedNotifySkipped: admin.firestore.FieldValue.delete(),
            pickupFailedNotifyError: admin.firestore.FieldValue.delete()
        });
        res.json({
            ok: true, data,
            pickupRequestDateTime: payload.pickupRequestDateTime,
            customerWanted: gfCustomerWanted,
            dateShifted: !!gfDateShifted
        });
    } catch (e) {
        console.error("goodsflow createOrder error:", e);
        // 실패를 신청건에 남겨 관리자가 인지할 수 있게
        try {
            if (quoteId) await admin.firestore().collection("quotes").doc(quoteId)
                .update({ goodsflowError: String(e.message).slice(0, 500), goodsflowErrorAt: new Date() });
        } catch (_) { }
        res.status(500).json({ ok: false, error: e.message });
    }
});

// 예약 취소 — 고객이 취소했는데 기사가 출동하는 헛수거 방지
goodsflowApp.post("/cancelOrder", async (req, res) => {
    const user = await gfRequireAdmin(req, res); if (!user) return;
    try {
        const { quoteId, force } = req.body || {};
        if (!quoteId) return res.status(400).json({ ok: false, error: "quoteId가 필요합니다." });
        const ref = admin.firestore().collection("quotes").doc(quoteId);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ ok: false, error: "신청건을 찾을 수 없습니다." });
        const orderNo = snap.data().goodsflowOrderNo;

        // 예약은 없고 실패 표시만 남은 경우 → 실패 표시만 정리
        if (!orderNo) {
            await ref.update({
                goodsflowError: admin.firestore.FieldValue.delete(),
                goodsflowErrorAt: admin.firestore.FieldValue.delete()
            });
            return res.json({ ok: true, message: "예약 내역이 없어 실패 표시만 정리했습니다." });
        }

        // 과거 버그로 '우리 문서ID'가 주문번호로 저장된 건은 굿스플로에 실제 접수가 없음 → 로컬 기록만 정리
        const isBogus = (orderNo === quoteId);

        // 취소는 사유코드가 필수(CancelRequestDTO). 정확한 코드 목록은 GET /v1/code/cancelType 로 확인 후 조정.
        let result = null;
        if (!isBogus) {
            try {
                result = await gfFetch(`/v1/order/cancel/orderNo/${encodeURIComponent(orderNo)}`, {
                    method: "POST",
                    body: JSON.stringify({
                        // 취소사유코드: PICKUP_DELAY(집화지연) / OTHER_SERVICE(다른 택배 이용) /
                        //               RE_RECEIVED(취소 후 재신청) / ETC(기타)
                        // 고객의 매입신청 취소는 '기타'가 가장 적합.
                        cancelType: (req.body || {}).cancelType || "ETC",
                        cancelReason: (req.body || {}).cancelReason || "고객 요청으로 매입신청 취소"
                    })
                });
                // HTTP 200이어도 본문이 실패일 수 있다(이미 집하된 건 등). 이걸 놓치면
                // 화면상 '취소됨'인데 기사는 실제로 방문해 배송비가 청구된다.
                const payloadErr = gfPayloadError(result);
                if (payloadErr) throw new Error(payloadErr);
            } catch (e) {
                // 굿스플로 취소 실패 — 관리자가 원하면 로컬 기록만 강제 정리할 수 있게 안내
                if (!force) {
                    return res.status(502).json({
                        ok: false, canForce: true,
                        error: "굿스플로 취소 실패: " + e.message
                            + "\n\n※ 굿스플로에는 예약이 살아있을 수 있습니다. 강제 정리하면 기사가 실제로 방문할 수 있으니,"
                            + " 가급적 굿스플로에서 직접 취소하거나 고객에게 안내해주세요."
                    });
                }
                result = { forcedLocalClear: true, apiError: String(e.message).slice(0, 300) };
            }
        } else {
            result = { bogusLocalClear: true, note: "굿스플로에 접수되지 않은 기록이라 로컬만 정리" };
        }
        // 예약 상태만 해제하고, 응답 원문(goodsflowRaw)과 이전 주문번호는 남긴다.
        // (취소해도 이력이 남아야 추후 문제 추적·정산 확인이 가능)
        await ref.update({
            goodsflowOrderNo: admin.firestore.FieldValue.delete(),
            goodsflowInvoiceNo: admin.firestore.FieldValue.delete(),
            goodsflowPrevOrderNo: orderNo,
            goodsflowCanceledAt: new Date(),
            goodsflowCanceledBy: user.email,
            goodsflowCancelRaw: JSON.stringify(result || {}).slice(0, 2000),
            goodsflowError: admin.firestore.FieldValue.delete(),
            goodsflowErrorAt: admin.firestore.FieldValue.delete()
        });
        res.json({ ok: true, data: result });
    } catch (e) {
        console.error("goodsflow cancelOrder error:", e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// 상태 조회 — 우리 quoteId(partnerOrderNo)로 조회. 나중에 폴러가 이걸 씀.
goodsflowApp.get("/status", async (req, res) => {
    const user = await gfRequireAdmin(req, res); if (!user) return;
    try {
        const quoteId = req.query.quoteId;
        if (!quoteId) return res.status(400).json({ ok: false, error: "quoteId가 필요합니다." });
        // 재예약 건 대응 — 문서에 저장된 실제 partnerOrderNo가 있으면 그걸로 조회
        let pNo = String(quoteId);
        try {
            const s0 = await admin.firestore().collection("quotes").doc(String(quoteId)).get();
            if (s0.exists && s0.data().goodsflowPartnerOrderNo) pNo = s0.data().goodsflowPartnerOrderNo;
        } catch (_) { }
        const result = await gfFetch(`/v1/order/status/partnerOrderNo/${encodeURIComponent(pNo)}`);
        res.json({ ok: true, data: result });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

exports.goodsflowApi = onRequest({ region: 'asia-northeast3', invoker: 'public' }, goodsflowApp);


// ===================================================================
// 굿스플로 배송상태 폴러 — 배송완료(COMPLETED) 감지 시 '택배도착'으로 자동 전환
// -------------------------------------------------------------------
// 굿스플로는 웹훅(콜백)을 제공하지 않아 주기적으로 조회해야 한다.
// '택배도착'은 굿스플로 기준 도착일 뿐 실물 확인 전 단계이므로,
// 검수중 전환은 사람이 박스를 열어보고 직접 하도록 남겨둔다.
// ===================================================================
const GF_ARRIVED_STATUS = "택배도착";
// 폴링 대상: 아직 도착 처리되지 않은 진행 단계
const GF_POLL_TARGET_STATUSES = ["신청접수", "수거중"];

// 알림톡 템플릿 ID — 솔라피에 등록·승인된 값을 .env에 넣으면 발송된다.
// 값이 없으면 발송을 건너뛰므로, 승인 전에도 시스템은 정상 동작한다.
const GF_TPL_PICKED_UP = process.env.ALIMTALK_TPL_PICKUP || ""; // 집하완료(운송장 안내)
const GF_TPL_ARRIVED = process.env.ALIMTALK_TPL_ARRIVED || "";  // 기기 도착
const GF_TPL_PICKUP_FAILED = process.env.ALIMTALK_TPL_PICKUP_FAILED || ""; // 미집하(수거 실패) 안내 — 변수 없는 고정 문구

// 서버에서 알림톡 발송 (관리자 화면을 거치지 않는 폴러용)
async function gfSendAlimtalk(templateId, phone, variables) {
    if (!templateId) return { skipped: "템플릿 ID 미설정" };
    const to = String(phone || "").replace(/[^0-9]/g, "");
    if (!to) return { skipped: "연락처 없음" };
    try {
        // 파라미터명은 기존 alimtalkApi 규격에 맞춰 phone/templateId/variables 사용
        const r = await fetch("https://asia-northeast3-rejeuphone.cloudfunctions.net/alimtalkApi/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: to, templateId, variables })
        });
        const t = await r.text();
        // HTTP 200이어도 본문이 실패일 수 있다(템플릿 미승인·변수 불일치 등).
        // 응답 본문까지 확인해야 '보냈다'고 표시하는 실수를 막을 수 있다.
        let ok = r.ok;
        let detail = t.slice(0, 300);
        try {
            const j = JSON.parse(t);
            if (j.success === false || j.error) ok = false;
            // 솔라피 결과에 실패 건수가 있으면 실패로 본다
            const cnt = j.result && j.result.groupInfo && j.result.groupInfo.count;
            if (cnt && Number(cnt.registeredFailed || 0) > 0) ok = false;
        } catch (_) { /* JSON 아니면 HTTP 상태만 신뢰 */ }
        if (!ok) console.error("알림톡 발송 실패 응답:", templateId, detail);
        return { ok, body: detail };
    } catch (e) {
        console.error("알림톡 발송 실패:", e.message);
        return { error: e.message };
    }
}

async function goodsflowPollOnce() {
    const db = admin.firestore();
    const summary = { checked: 0, pickedUp: 0, arrived: 0, failed: 0, errors: 0, details: [] };

    const snap = await db.collection("quotes")
        .where("status", "in", GF_POLL_TARGET_STATUSES)
        .limit(300)
        .get();

    // 예약한 지 오래된 건은 폴러가 손을 뗀다. 고객이 미집하 후 방치해도(취소도 도착도 안 됨)
    // 30분마다 영원히 조회하는 걸 막는 안전장치. 이 기간이 지나면 관리자가 수동 처리할 몫.
    const GF_POLL_MAX_AGE_MS = 7 * 24 * 3600000; // 7일
    const nowMs = Date.now();

    for (const doc of snap.docs) {
        const q = doc.data();
        if (!q.goodsflowOrderNo) continue;          // 굿스플로 예약이 없는 건은 대상 아님
        if (q.isDeleted) continue;
        // 예약 시각(goodsflowBookedAt)이 7일보다 오래됐으면 조회 중단 (죽은 건 방지)
        const bookedMs = q.goodsflowBookedAt
            ? (q.goodsflowBookedAt.toDate ? q.goodsflowBookedAt.toDate().getTime() : new Date(q.goodsflowBookedAt).getTime())
            : 0;
        if (bookedMs && (nowMs - bookedMs) > GF_POLL_MAX_AGE_MS) continue;
        summary.checked++;

        try {
            // 재예약 건은 partnerOrderNo가 문서ID와 다르다(-R1 등). 저장된 값을 우선 사용.
            const pNo = q.goodsflowPartnerOrderNo || doc.id;
            const result = await gfFetch(`/v1/order/status/partnerOrderNo/${encodeURIComponent(pNo)}`);
            // 조회 자체가 실패한 경우(개발서버 주문번호가 실서버에 없는 등)는 건드리지 않고 넘어간다.
            // 그냥 진행하면 orderStatus를 못 찾아 goodsflowStatus를 빈 값으로 덮어써 버린다.
            const payloadErr = gfPayloadError(result);
            if (payloadErr) {
                summary.errors++;
                summary.details.push(`조회실패: ${q.customerName || doc.id} — ${payloadErr}`);
                continue;
            }
            const st = gfDeepFind(result, "orderStatus") || "";
            if (!st) { summary.errors++; continue; } // 상태를 못 읽으면 아무것도 갱신하지 않음
            const patch = { goodsflowStatus: st, goodsflowStatusCheckedAt: new Date() };

            const model = `${q.brand || ""} ${q.model || ""}`.trim();

            // 운송장번호는 '예약 시점'엔 아직 없고 배차(ALLOCATED)~집하 사이에 부여된다.
            // 폴링할 때마다 응답에서 다시 주워 담아야 알림톡/관리자 화면에 번호가 채워진다.
            const polledTin = gfDeepFind(result, "transporterInvoiceNo") || "";
            const polledIn = gfDeepFind(result, "invoiceNo") || "";
            const polledRelay = gfDeepFind(result, "relayTransporterInvoiceNo") || "";
            if (polledTin && polledTin !== q.goodsflowTransporterInvoiceNo) patch.goodsflowTransporterInvoiceNo = polledTin;
            if (polledIn && polledIn !== q.goodsflowInvoiceNo) patch.goodsflowInvoiceNo = polledIn;
            if (polledRelay && polledRelay !== q.goodsflowRelayInvoiceNo) patch.goodsflowRelayInvoiceNo = polledRelay;

            // ★ 고객에게 안내하는 '운송장번호'는 반드시 relayTransporterInvoiceNo 여야 한다.
            //   - invoiceNo(260728-99529-001)            : 굿스플로 내부 예약번호
            //   - transporterInvoiceNo(26072899529001)   : 홈픽 집하구간 번호 — 한진 조회창에 안 나온다
            //   - relayTransporterInvoiceNo(573848472934): 한진 간선 운송장 — 이것만 조회된다
            //   예전엔 transporterInvoiceNo를 운송장으로 안내해서 고객이 조회할 수 없었다.
            const invNo = polledRelay || q.goodsflowRelayInvoiceNo || "";
            const carrier = gfCarrierName(q.goodsflowTransporter);

            // ★ 미집하 표시 해제 —
            //   기사가 다시 방문해 집하에 성공하면 굿스플로 상태가 정상 흐름으로 돌아온다.
            //   그때 goodsflowAlert를 지우지 않으면 관리자 화면의 '미집하' 구역에 영원히 남는다.
            //   재집하되면 다시 안내할 수 있게 발송 표시(pickupFailedNotifiedAt)도 함께 정리한다.
            const RECOVERED_STATES = ["PICKUP", "MOVING", "TERMINAL_IN", "DLV_START", "COMPLETED"];
            if (q.goodsflowAlert === "PICKUP_FAILED" && RECOVERED_STATES.includes(st)) {
                patch.goodsflowAlert = admin.firestore.FieldValue.delete();
                patch.pickupFailedNotifiedAt = admin.firestore.FieldValue.delete();
                patch.pickupFailedNotifySkipped = admin.firestore.FieldValue.delete();
                patch.pickupFailedNotifyError = admin.firestore.FieldValue.delete();
                summary.details.push(`미집하 해제(재집하): ${q.customerName || doc.id}`);
            }

            // 집하완료 — 기사가 실제로 기기를 받아간 시점. 이때부터 택배사 조회가 잡히므로 운송장번호를 안내.
            // pickedUpNotifiedAt으로 중복 발송 방지(폴러가 30분마다 도는 구조).
            // 운송장번호가 없으면 발송을 미룬다(30분 뒤 번호와 함께). 배송시작 단계까지 와도 없으면
            // 더 기다릴 이유가 없어 번호 없이 안내한다.
            const holdForInvoice = !invNo && (st === "PICKUP" || st === "MOVING" || st === "TERMINAL_IN");
            if ((st === "PICKUP" || st === "MOVING" || st === "TERMINAL_IN" || st === "DLV_START") && !q.pickedUpNotifiedAt && !holdForInvoice) {
                patch.pickedUpAt = q.pickedUpAt || new Date();
                summary.pickedUp++;
                // 발송 성공 시에만 표시를 남긴다(실패하면 다음 회차 재시도)
                const rPick = await gfSendAlimtalk(GF_TPL_PICKED_UP, q.customerPhone, {
                    "#{고객성함}": q.customerName || "-",
                    "#{기종}": model || "-",
                    "#{택배사}": carrier,
                    "#{운송장번호}": invNo || "-"
                });
                if (rPick && rPick.ok) {
                    patch.pickedUpNotifiedAt = new Date();
                    summary.details.push(`집하: ${q.customerName || doc.id}`);
                } else {
                    // 3회까지만 재시도 — 잘못된 번호·수신거부처럼 영구 실패면 30분마다 무한 시도하게 된다.
                    const tries = Number(q.pickedUpNotifyTries || 0) + 1;
                    patch.pickedUpNotifyTries = tries;
                    patch.pickedUpNotifyError = String((rPick && (rPick.error || rPick.skipped || rPick.body)) || "발송 실패").slice(0, 200);
                    if (tries >= 3) {
                        patch.pickedUpNotifiedAt = new Date(); // 포기: 더는 시도하지 않음
                        summary.details.push(`집하 발송실패(3회 초과·중단): ${q.customerName || doc.id}`);
                    } else {
                        summary.details.push(`집하 발송실패(${tries}/3 재시도 예정): ${q.customerName || doc.id}`);
                    }
                }
            }

            if (st === "COMPLETED") {
                // 우리 사무실 도착 → '택배도착'으로 전환 (arrivedAt은 최초 1회만 기록)
                patch.status = GF_ARRIVED_STATUS;
                if (!q.arrivedAt) patch.arrivedAt = new Date();
                summary.arrived++;
                summary.details.push(`도착: ${q.customerName || doc.id}`);
                if (!q.arrivedNotifiedAt) {
                    const rArr = await gfSendAlimtalk(GF_TPL_ARRIVED, q.customerPhone, {
                        "#{고객성함}": q.customerName || "-",
                        "#{기종}": model || "-",
                        "#{택배사}": carrier,
                        "#{운송장번호}": invNo || "-"
                    });
                    if (rArr && rArr.ok) patch.arrivedNotifiedAt = new Date();
                    else {
                        const tries = Number(q.arrivedNotifyTries || 0) + 1;
                        patch.arrivedNotifyTries = tries;
                        patch.arrivedNotifyError = String((rArr && (rArr.error || rArr.skipped || rArr.body)) || "발송 실패").slice(0, 200);
                        if (tries >= 3) {
                            patch.arrivedNotifiedAt = new Date();
                            summary.details.push(`도착알림 발송실패(3회 초과·중단): ${q.customerName || doc.id}`);
                        } else {
                            summary.details.push(`도착알림 발송실패(${tries}/3 재시도 예정): ${q.customerName || doc.id}`);
                        }
                    }
                }
            } else if (st === "PICKUP_FAILED" || st === "DLV_FAILED" || st === "RETURNED") {
                // 수거/배송 실패는 사람이 개입해야 하므로 표시만 남김 (상태는 바꾸지 않음)
                summary.failed++;
                patch.goodsflowAlert = st;
                summary.details.push(`실패(${st}): ${q.customerName || doc.id}`);

                // 미집하(수거 실패)만 고객에게 자동 안내 — "내일까지 일정수정/취소 남겨달라"는 문구라
                // 빨리 나가야 의미가 있다. 반송 실패(DLV_FAILED/RETURNED)는 상황이 달라 제외.
                // pickupFailedNotifiedAt으로 30분 폴러가 중복 발송하지 않도록 1회만.
                //
                // ★ 지난 건에는 발송하지 않는다.
                //   기능을 새로 붙이거나 잠시 멈췄다 재가동하면, 과거 미집하 건에 이 표시가 없어
                //   전부 '새로 발생한 건'으로 잡혀 옛 건들에 "금일 방문하였으나…" 문구가 한꺼번에 나간다.
                //   (실제로 15건이 소급 발송되는 사고가 있었음)
                //   그래서 예약일이 3일 넘은 건은 사람이 판단할 몫으로 두고 자동발송에서 제외한다.
                const bookedForNoti = q.goodsflowBookedAt
                    ? (q.goodsflowBookedAt.toDate ? q.goodsflowBookedAt.toDate().getTime() : new Date(q.goodsflowBookedAt).getTime())
                    : 0;
                // 예약 시각이 없으면 접수 시각으로 대신 판단한다.
                // (둘 다 없으면 언제 건인지 알 수 없으므로 안전하게 '오래된 건'으로 보고 발송하지 않는다)
                const appliedForNoti = q.submittedAt || q.firebaseTimestamp;
                const appliedMs = appliedForNoti
                    ? (appliedForNoti.toDate ? appliedForNoti.toDate().getTime() : new Date(appliedForNoti).getTime())
                    : 0;
                const baseMs = bookedForNoti || appliedMs;
                const tooOldToNotify = !baseMs || (Date.now() - baseMs) > 3 * 24 * 3600000;

                if (st === "PICKUP_FAILED" && !q.pickupFailedNotifiedAt) {
                    if (tooOldToNotify) {
                        // 오래된 건은 자동발송 제외 — 표시를 남겨 매 회차 재검사하지 않는다.
                        patch.pickupFailedNotifiedAt = new Date();
                        patch.pickupFailedNotifySkipped = "3일 초과 건 — 자동발송 제외";
                        summary.details.push(`미집하(발송제외·오래된건): ${q.customerName || doc.id}`);
                    } else {
                        // ★ 발송이 '성공했을 때만' 표시를 남긴다.
                        //   예전엔 표시를 먼저 찍고 발송을 시도해서, 템플릿 미승인·API 오류로 실패해도
                        //   표시가 남아 다시 시도하지 않았다(영구 미발송). 실제로 7월 건 다수가 이 상태였음.
                        const r = await gfSendAlimtalk(GF_TPL_PICKUP_FAILED, q.customerPhone, {});
                        if (r && r.ok) {
                            patch.pickupFailedNotifiedAt = new Date();
                            summary.details.push(`미집하 안내발송: ${q.customerName || doc.id}`);
                        } else {
                            const tries = Number(q.pickupFailedNotifyTries || 0) + 1;
                            patch.pickupFailedNotifyTries = tries;
                            patch.pickupFailedNotifyError = String((r && (r.error || r.skipped || r.body)) || "발송 실패").slice(0, 200);
                            if (tries >= 3) {
                                patch.pickupFailedNotifiedAt = new Date();
                                summary.details.push(`미집하 발송실패(3회 초과·중단): ${q.customerName || doc.id}`);
                            } else {
                                summary.details.push(`미집하 발송실패(${tries}/3 재시도 예정): ${q.customerName || doc.id}`);
                            }
                        }
                    }
                }
            }
            await doc.ref.update(patch);
        } catch (e) {
            summary.errors++;
            console.error("goodsflow poll error:", doc.id, e.message);
        }
    }
    console.log("goodsflow poll summary:", JSON.stringify(summary));
    return summary;
}

const { onSchedule } = require("firebase-functions/v2/scheduler");
exports.goodsflowPoller = onSchedule(
    { schedule: "every 30 minutes", timeZone: "Asia/Seoul", region: "asia-northeast3" },
    async () => { await goodsflowPollOnce(); }
);

// ===================================================================
// 쉐라폰비서 — 일일 요약 (매일 자정 정각, 전날 실적)
// -------------------------------------------------------------------
// 기존 알림봇(telegramApi)과 별개의 봇/수신자를 쓴다.
// 매출·건수가 담기므로 지정한 관리자에게만 발송한다.
// ===================================================================
const DAILY_BOT_TOKEN = process.env.TELEGRAM_DAILY_BOT_TOKEN || "";
const DAILY_CHAT_IDS = ["6989151823", "7434861149"]; // 대표 · 담당자

// 유입 경로 코드 → 사람이 읽는 이름
const SOURCE_LABEL = {
    daangn: "당근", naver: "네이버", naver_search: "네이버검색",
    naver_display: "네이버디스플레이", google: "구글",
    instagram: "인스타", tiktok: "틱톡", direct: "직접유입"
};

// 한국시간 기준 '어제 00:00 ~ 오늘 00:00' 구간을 구한다.
// 자정 정각에 실행되므로 방금 끝난 하루가 대상.
function krYesterdayRange() {
    const nowKst = new Date(Date.now() + 9 * 3600000);
    const y = nowKst.getUTCFullYear(), m = nowKst.getUTCMonth(), d = nowKst.getUTCDate();
    const todayStartKstMs = Date.UTC(y, m, d) - 9 * 3600000; // KST 오늘 0시의 UTC 시각
    const start = new Date(todayStartKstMs - 24 * 3600000);
    const end = new Date(todayStartKstMs);
    return { start, end, label: new Date(todayStartKstMs - 24 * 3600000 + 9 * 3600000) };
}

const toDateSafe = (v) => {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate();
    if (v._seconds || v.seconds) return new Date((v._seconds || v.seconds) * 1000);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
};

async function buildDailySummary() {
    const db = admin.firestore();
    const { start, end, label } = krYesterdayRange();
    const inRange = (dt) => dt && dt >= start && dt < end;

    // 하루치만 보면 되지만, 상태 전환(도착·입금)은 이전 접수 건에서도 일어난다.
    // 그렇다고 전체를 읽으면 건수가 쌓일수록 느려지므로 최근 3개월로 범위를 좁힌다.
    // (접수 후 입금까지 길어야 며칠이라 어제자 집계에는 영향이 없다)
    const rangeStart = new Date(start.getTime() - 90 * 24 * 3600000);
    const snap = await db.collection("quotes").where("firebaseTimestamp", ">=", rangeStart).get();

    let courier = 0, cvs = 0, escapee = 0, arrived = 0, canceled = 0, returned = 0;
    const sources = {};
    const completed = [];

    snap.forEach(doc => {
        const q = doc.data();
        if (q.isForeigner === true || q.method === "foreigner" || q.series === "Foreigner") return;

        // 신규 신청 — 배송방법이 확정된 시각(submittedAt) 기준. 없으면 접수 시각.
        const appliedAt = toDateSafe(q.submittedAt) || toDateSafe(q.firebaseTimestamp);
        if (inRange(appliedAt)) {
            const dm = q.deliveryMethod;
            if (dm === "courier" || dm === "cvs") {
                if (dm === "courier") courier++; else cvs++;
                const key = SOURCE_LABEL[q.trafficSource] || q.trafficSource || "기타";
                sources[key] = (sources[key] || 0) + 1;
            } else if (!dm || dm === "pending") {
                escapee++;
            }
            if (q.status === "취소") canceled++;
            if (q.status === "반송접수" || q.status === "반송대기") returned++;
        }

        // 택배도착 — 실제 도착한 날 기준
        if (inRange(toDateSafe(q.arrivedAt))) arrived++;

        // 매입완료 — 입금 처리된 날 기준
        if (q.status === "입금완료") {
            const paidAt = toDateSafe(q.paidAt) || toDateSafe(q.customerAgreedAt)
                || toDateSafe(q.inspectionData && q.inspectionData.inspectedAt);
            if (inRange(paidAt)) {
                completed.push(`${q.customerName || "-"}  ${(q.brand || "")} ${(q.model || "")}`.trim());
            }
        }
    });

    const dow = ["일", "월", "화", "수", "목", "금", "토"][label.getUTCDay()];
    const dateStr = `${label.getUTCMonth() + 1}월 ${label.getUTCDate()}일 (${dow})`;

    const srcLine = Object.entries(sources).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`).join(" · ");

    let msg = `📊 *${dateStr}*\n\n`;
    msg += `신규 신청  ${courier + cvs}건 (방문 ${courier} · 개인 ${cvs})\n`;
    if (srcLine) msg += `  └ ${srcLine}\n`;
    msg += `이탈       ${escapee}건\n`;
    msg += `택배도착   ${arrived}건\n`;
    msg += `취소 ${canceled}건 · 반송 ${returned}건\n`;
    msg += `\n✅ *매입완료 ${completed.length}건*\n`;
    msg += completed.length ? completed.map(t => `  ${t}`).join("\n") : "  (없음)";

    return msg;
}

async function sendDailySummary() {
    if (!DAILY_BOT_TOKEN) {
        console.error("[일일요약] TELEGRAM_DAILY_BOT_TOKEN 미설정 — 발송 건너뜀");
        return { skipped: true };
    }
    const msg = await buildDailySummary();
    const results = [];
    for (const chatId of DAILY_CHAT_IDS) {
        try {
            const r = await fetch(`https://api.telegram.org/bot${DAILY_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" })
            });
            results.push({ chatId, ok: r.ok });
        } catch (e) {
            console.error("[일일요약] 발송 실패:", chatId, e.message);
            results.push({ chatId, error: e.message });
        }
    }
    console.log("[일일요약] 발송 결과:", JSON.stringify(results));
    return { sent: results };
}

exports.dailySummaryBot = onSchedule(
    { schedule: "0 0 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
    async () => { await sendDailySummary(); }
);

// ─── 쉐라폰비서 — 대화형 조회 ───────────────────────────────────────
// 텔레그램에서 봇에게 명령어를 보내면 답한다.
// 지정된 관리자(DAILY_CHAT_IDS)만 응답하며, 그 외에는 무시한다.

// 텔레그램 한 통 최대 4096자. 그보다 길면 통째로 실패하므로 줄 단위로 잘라 나눠 보낸다.
const TG_MAX = 3800; // 여유를 둔 값
function tgSplit(text) {
    if (text.length <= TG_MAX) return [text];
    const parts = [];
    let buf = "";
    for (const line of String(text).split("\n")) {
        if ((buf + line + "\n").length > TG_MAX) { parts.push(buf); buf = ""; }
        buf += line + "\n";
    }
    if (buf.trim()) parts.push(buf);
    return parts;
}

async function tgSendOnce(chatId, text, useMarkdown) {
    const body = { chat_id: chatId, text };
    if (useMarkdown) body.parse_mode = "Markdown";
    const r = await fetch(`https://api.telegram.org/bot${DAILY_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return r.ok;
}

async function tgReply(chatId, text) {
    if (!DAILY_BOT_TOKEN) return;
    try {
        for (const part of tgSplit(text)) {
            // 고객 이름에 _ * [ 같은 문자가 있으면 Markdown 파싱이 실패해 메시지가 통째로 안 간다.
            // 실패하면 서식 없이 한 번 더 보낸다.
            const ok = await tgSendOnce(chatId, part, true);
            if (!ok) await tgSendOnce(chatId, part, false);
        }
    } catch (e) { console.error("[비서] 응답 실패:", e.message); }
}

// 오늘(KST 0시~현재) 현황
async function botToday() {
    const db = admin.firestore();
    const nowKst = new Date(Date.now() + 9 * 3600000);
    const todayStart = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()) - 9 * 3600000);

    // 오늘 현황만 필요하지만 검수중 건수는 이전 접수분도 포함되므로 최근 3개월치를 본다.
    const rangeStart = new Date(todayStart.getTime() - 90 * 24 * 3600000);
    const snap = await db.collection("quotes").where("firebaseTimestamp", ">=", rangeStart).get();
    let courier = 0, cvs = 0, escapee = 0, arrived = 0, done = 0, inspecting = 0;
    snap.forEach(d => {
        const q = d.data();
        if (q.isForeigner === true || q.method === "foreigner") return;
        const applied = toDateSafe(q.submittedAt) || toDateSafe(q.firebaseTimestamp);
        if (applied && applied >= todayStart) {
            const dm = q.deliveryMethod;
            if (dm === "courier") courier++;
            else if (dm === "cvs") cvs++;
            else if (!dm || dm === "pending") escapee++;
        }
        const ar = toDateSafe(q.arrivedAt);
        if (ar && ar >= todayStart) arrived++;
        if (q.status === "입금완료") {
            const paid = toDateSafe(q.paidAt) || toDateSafe(q.customerAgreedAt)
                || toDateSafe(q.inspectionData && q.inspectionData.inspectedAt);
            if (paid && paid >= todayStart) done++;
        }
        if (q.status === "검수중" || q.status === "검수완료" || q.status === "입금대기") inspecting++;
    });
    return `📅 *오늘 현황*\n\n`
        + `신규 신청  ${courier + cvs}건 (방문 ${courier} · 개인 ${cvs})\n`
        + `이탈       ${escapee}건\n`
        + `택배도착   ${arrived}건\n`
        + `매입완료   ${done}건\n\n`
        + `검수 진행중 ${inspecting}건`;
}

// 오늘 택배 도착한 건들 — 이름·기종까지 나열
// 집계 기준은 관리자페이지 '금일 도착건' 카드와 동일해야 숫자가 어긋나지 않는다.
//   · arrivedAt >= 오늘 0시(KST)
//   · 삭제건·외국인건 제외 (_isRealQuote와 동일 조건)
async function botArrived() {
    const db = admin.firestore();
    const nowKst = new Date(Date.now() + 9 * 3600000);
    const todayStart = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()) - 9 * 3600000);

    // arrivedAt 단일 필드 범위질의는 기본 색인으로 동작한다(관리자페이지도 같은 방식).
    const snap = await db.collection("quotes").where("arrivedAt", ">=", todayStart).get();

    const rows = [];
    snap.forEach(d => {
        const q = d.data();
        if (q.isDeleted) return;
        if (q.isForeigner === true || q.method === "foreigner" || q.series === "Foreigner") return;
        const ar = toDateSafe(q.arrivedAt);
        if (!ar) return;
        rows.push({
            at: ar,
            name: q.customerName || "-",
            model: `${q.brand || ""} ${q.model || ""}`.trim() + (q.storage ? " " + q.storage : ""),
            status: q.status || "택배도착",
            deliveryMethod: q.deliveryMethod
        });
    });

    if (!rows.length) return "📦 오늘 도착\n\n아직 도착한 건이 없습니다.";

    rows.sort((a, b) => a.at - b.at);
    const hhmm = (dt) => new Date(dt.getTime() + 9 * 3600000).toISOString().slice(11, 16);

    // 상태별 요약을 먼저 (건수가 많은 날엔 이것만 봐도 파악된다)
    const byStatus = {};
    rows.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    const statusLine = Object.keys(byStatus).map(k => `${k} ${byStatus[k]}`).join(" · ");

    let out = `📦 오늘 도착 ${rows.length}건\n${statusLine}\n\n`;
    rows.forEach((r, i) => {
        const via = r.deliveryMethod === "cvs" ? "개인" : "방문";
        out += `${i + 1}. ${hhmm(r.at)} ${r.name} (${via})\n   ${r.model || "기종미상"} · ${r.status}\n`;
    });
    return out;
}

// 고객 이름 또는 연락처로 조회
async function botSearch(keyword) {
    const db = admin.firestore();
    const kw = String(keyword || "").trim();
    if (!kw) return "검색어를 입력해 주세요.\n예) `/검색 김민재`";

    const digits = kw.replace(/\D/g, "");
    const snap = await db.collection("quotes").get();
    const hits = [];
    snap.forEach(d => {
        const q = d.data();
        const name = String(q.customerName || "");
        const phone = String(q.customerPhone || "").replace(/\D/g, "");
        const match = (digits.length >= 4 && phone.includes(digits)) || (kw.length >= 2 && name.includes(kw));
        if (!match) return;
        const at = toDateSafe(q.submittedAt) || toDateSafe(q.firebaseTimestamp);
        const fmt = (dt) => dt ? new Date(dt.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace("T", " ") : "-";
        const won = (v) => v ? Number(v).toLocaleString("ko-KR") + "원" : "-";
        const phoneFmt = String(q.customerPhone || "").replace(/\D/g, "")
            .replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");

        // 배송방법
        const dmLabel = q.deliveryMethod === "courier" ? "방문수거"
            : q.deliveryMethod === "cvs" ? "개인발송" : "미선택(이탈)";

        // 금액 — 검수 끝났으면 최종가, 아니면 예상가
        const finalP = q.inspectionData && q.inspectionData.finalPrice;
        const priceLine = finalP
            ? `최종 ${won(finalP)}  (예상 ${won(q.price)})`
            : `예상 ${won(q.price)}`;

        let line = `👤 *${name}*  ${phoneFmt}\n`;
        line += `${(q.brand || "")} ${(q.model || "")}${q.storage ? " " + q.storage : ""}\n`;
        line += `상태: ${q.status || "신청접수"}${q.isDeleted ? " (삭제됨)" : ""}\n`;
        line += `금액: ${priceLine}\n`;
        line += `접수: ${fmt(at)} · ${dmLabel}`;
        if (q.pickupDate) line += ` (희망 ${q.pickupDate})`;

        // 진행 이력 — 있는 것만
        // 운송장번호는 한진 간선 운송장(relay)만 — 나머지 번호는 조회가 안 되므로 구분 표기
        if (q.goodsflowRelayInvoiceNo) {
            line += `\n운송장: ${q.goodsflowTransporter || "한진택배"} ${q.goodsflowRelayInvoiceNo}`;
        } else if (q.goodsflowOrderNo) {
            line += `\n예약: ${q.goodsflowOrderNo} (운송장 대기)`;
        }
        const arrivedAt = toDateSafe(q.arrivedAt);
        if (arrivedAt) line += `\n도착: ${fmt(arrivedAt)}`;
        const inspectedAt = toDateSafe(q.inspectionData && q.inspectionData.inspectedAt);
        if (inspectedAt) line += `\n계약서 발송: ${fmt(inspectedAt)}`;
        const paidAt = toDateSafe(q.paidAt) || toDateSafe(q.customerAgreedAt);
        if (paidAt && q.status === "입금완료") line += `\n입금완료: ${fmt(paidAt)}`;
        if (q.inspectionData && q.inspectionData.details) {
            line += `\n차감: ${String(q.inspectionData.details).slice(0, 60)}`;
        }

        hits.push({ at: at ? at.getTime() : 0, line });
    });
    if (!hits.length) return `'${kw}' 검색 결과가 없습니다.`;
    hits.sort((a, b) => b.at - a.at);
    const top = hits.slice(0, 5);
    return `🔍 *'${kw}' 검색 ${hits.length}건*\n\n`
        + top.map(h => h.line).join("\n\n────────\n\n")
        + (hits.length > 5 ? `\n\n…외 ${hits.length - 5}건` : "");
}

// 이번 달 누적 실적
async function botMonth() {
    const db = admin.firestore();
    const nowKst = new Date(Date.now() + 9 * 3600000);
    const monthStart = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), 1) - 9 * 3600000);

    // 이번 달 집계 — 접수는 지난달일 수 있으므로 3개월치를 본다.
    const rangeStart = new Date(monthStart.getTime() - 90 * 24 * 3600000);
    const snap = await db.collection("quotes").where("firebaseTimestamp", ">=", rangeStart).get();
    let applied = 0, escapee = 0, done = 0, amount = 0, canceled = 0, returned = 0;
    snap.forEach(d => {
        const q = d.data();
        if (q.isForeigner === true || q.method === "foreigner") return;
        const at = toDateSafe(q.submittedAt) || toDateSafe(q.firebaseTimestamp);
        if (at && at >= monthStart) {
            const dm = q.deliveryMethod;
            if (dm === "courier" || dm === "cvs") applied++;
            else if (!dm || dm === "pending") escapee++;
            if (q.status === "취소") canceled++;
            if (q.status === "반송접수" || q.status === "반송대기") returned++;
        }
        if (q.status === "입금완료") {
            const paid = toDateSafe(q.paidAt) || toDateSafe(q.customerAgreedAt)
                || toDateSafe(q.inspectionData && q.inspectionData.inspectedAt);
            if (paid && paid >= monthStart) {
                done++;
                amount += Number((q.inspectionData && q.inspectionData.finalPrice) || q.price || 0);
            }
        }
    });
    const avg = done ? Math.round(amount / done) : 0;
    return `📈 *${nowKst.getUTCMonth() + 1}월 누적*\n\n`
        + `신규 신청  ${applied}건\n`
        + `이탈       ${escapee}건\n`
        + `취소 ${canceled}건 · 반송 ${returned}건\n\n`
        + `✅ 매입완료 ${done}건\n`
        + `매입 총액  ${amount.toLocaleString("ko-KR")}원\n`
        + `평균 단가  ${avg.toLocaleString("ko-KR")}원`;
}

exports.dailySummaryWebhook = onRequest(
    { region: "asia-northeast3", invoker: "public" },
    async (req, res) => {
        try {
            const msg = req.body && req.body.message;
            if (!msg || !msg.text) return res.status(200).send("ok");
            const chatId = String(msg.chat && msg.chat.id);
            // 지정 관리자 외에는 응답하지 않는다 (매출 정보 보호)
            if (!DAILY_CHAT_IDS.includes(chatId)) return res.status(200).send("ok");

            const text = String(msg.text).trim();
            const [cmdRaw, ...rest] = text.split(/\s+/);
            const cmd = cmdRaw.replace(/@\w+$/, "").toLowerCase();
            const arg = rest.join(" ");

            let reply;
            if (cmd === "/오늘" || cmd === "/today") reply = await botToday();
            else if (cmd === "/도착" || cmd === "/arrived") reply = await botArrived();
            else if (cmd === "/어제" || cmd === "/yesterday") reply = await buildDailySummary();
            else if (cmd === "/검색" || cmd === "/search") reply = await botSearch(arg);
            else if (cmd === "/이번달" || cmd === "/month") reply = await botMonth();
            else if (cmd === "/start" || cmd === "/도움말" || cmd === "/help") {
                reply = `🤖 *쉐라폰비서*\n\n`
                    + `/오늘 — 오늘 현황 (건수)\n`
                    + `/도착 — 오늘 도착한 건 (고객명·기종 전부)\n`
                    + `/어제 — 어제 요약 (자정 자동발송과 동일)\n`
                    + `/검색 이름 — 고객 조회 (이름 또는 연락처)\n`
                    + `/이번달 — 이번 달 누적 실적\n\n`
                    + `매일 자정에 전날 요약이 자동으로 전송됩니다.`;
            } else return res.status(200).send("ok"); // 명령어 아닌 일반 대화는 무시

            await tgReply(chatId, reply);
            res.status(200).send("ok");
        } catch (e) {
            console.error("[비서] 처리 오류:", e);
            res.status(200).send("ok"); // 텔레그램 재시도 방지
        }
    }
);

// 자정까지 기다리지 않고 지금 바로 받아보는 용도 (문구·숫자 확인 후 정식 운영)
// 주소 뒤에 ?key=... 를 붙여 호출한다. 키는 .env의 TELEGRAM_DAILY_BOT_TOKEN 앞 10자.
exports.dailySummaryNow = onRequest(
    { region: "asia-northeast3", invoker: "public" },
    async (req, res) => {
        const key = String(req.query.key || "");
        if (!DAILY_BOT_TOKEN || key !== DAILY_BOT_TOKEN.slice(0, 10)) {
            return res.status(403).send("forbidden");
        }
        try {
            const out = await sendDailySummary();
            res.json({ ok: true, ...out });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    }
);

// 굿스플로 ↔ 우리 기록 대조/정리
// 우리 쪽에선 취소했는데 굿스플로엔 살아있는 주문(= 기사가 헛출동할 수 있는 상태)을 찾아 정리한다.
// dryRun=true(기본)면 조회만 하고 취소하지 않는다.
goodsflowApp.post("/reconcile", async (req, res) => {
    const user = await gfRequireAdmin(req, res); if (!user) return;
    const dryRun = (req.body || {}).dryRun !== false;
    const db = admin.firestore();
    const ACTIVE_GF = ["RESERVED", "RECEIVED", "TRANSFERRED", "ALLOCATED", "PICKUP_START", "PICKUP", "TERMINAL_IN", "MOVING", "DLV_START", "WAYPOINT_ARRIVAL"];
    const report = { checked: 0, mismatched: 0, canceled: 0, errors: 0, items: [] };

    try {
        // 굿스플로에 한 번이라도 접수된 적 있는 건 = 예약중이거나(현재) 취소이력이 있는 건
        const seen = new Map();
        for (const field of ["goodsflowOrderNo", "goodsflowPrevOrderNo"]) {
            const snap = await db.collection("quotes").where(field, "!=", "").limit(400).get();
            snap.forEach(d => seen.set(d.id, d));
        }

        for (const [id, doc] of seen) {
            const q = doc.data();
            report.checked++;
            try {
                const st = await gfFetch(`/v1/order/status/partnerOrderNo/${encodeURIComponent(id)}`);
                const gfStatus = gfDeepFind(st, "orderStatus") || "";
                const gfOrderNo = gfDeepFind(st, "orderNo") || "";
                const localActive = !!q.goodsflowOrderNo;   // 우리 화면상 '예약중'인가
                const gfActive = ACTIVE_GF.includes(gfStatus); // 굿스플로에서 살아있는가

                // 어긋남: 우리는 취소했는데 굿스플로엔 살아있음 → 기사 헛출동 위험
                if (!localActive && gfActive) {
                    report.mismatched++;
                    const item = { name: q.customerName || id, quoteId: id, orderNo: gfOrderNo, gfStatus, action: dryRun ? "취소 필요" : "취소함" };
                    if (!dryRun && gfOrderNo) {
                        await gfFetch(`/v1/order/cancel/orderNo/${encodeURIComponent(gfOrderNo)}`, {
                            method: "POST",
                            body: JSON.stringify({ cancelType: "ETC", cancelReason: "매입신청 취소로 수거 불필요" })
                        });
                        report.canceled++;
                        await doc.ref.update({ goodsflowSweptAt: new Date(), goodsflowStatus: "CANCELED" });
                    }
                    report.items.push(item);
                } else {
                    report.items.push({ name: q.customerName || id, quoteId: id, orderNo: gfOrderNo, gfStatus, action: localActive ? "정상(예약중)" : "정상(취소됨)" });
                }
            } catch (e) {
                report.errors++;
                report.items.push({ name: q.customerName || id, quoteId: id, error: String(e.message).slice(0, 120) });
            }
        }
        res.json({ ok: true, dryRun, report });
    } catch (e) {
        console.error("reconcile error:", e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// 관리자용 수동 실행 — 30분을 기다리지 않고 즉시 확인할 때 사용
goodsflowApp.post("/pollNow", async (req, res) => {
    const user = await gfRequireAdmin(req, res); if (!user) return;
    try {
        const summary = await goodsflowPollOnce();
        res.json({ ok: true, summary });
    } catch (e) {
        console.error("pollNow error:", e);
        res.status(500).json({ ok: false, error: e.message });
    }
});