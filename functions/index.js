const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();

const app = express();

app.use(cors({ origin: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

const TELEGRAM_BOT_TOKEN = "8711439716:AAFXr9QwxHTT4ZH3DWdOCySDMDU5DaYJBK4";
const TELEGRAM_CHAT_IDS = ["6989151823", "7434861149", "8415202496", "8549949204", "5649160603", "7909488316"];

telegramApp.post("/send", async (req, res) => {
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

const SOLAPI_API_KEY = "NCSLO3BJCMH3IEOU";
const SOLAPI_API_SECRET = "9TQGUIT0NVVDRGKCEHC7KN0ELMOCBIH1";
const SENDER_NUMBER = "01032635672"; 
const PFID = "KA01PF2605140405259447PXPLyM2Hpa";

const messageService = new SolapiMessageService(SOLAPI_API_KEY, SOLAPI_API_SECRET);

alimtalkApp.post("/send", async (req, res) => {
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

        const result = await messageService.send(messageData);
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

const PORTONE_API_KEY = "4786480776168256";
const PORTONE_API_SECRET = "cMCLrCLk2N1qbmTBILsyeCt3eb3hPCqmah25WNwMLuPxlzNMnfm2EpCqcFfzvsOlOA8HGdTD1tKw8WxQ";

portoneApp.post("/verify", async (req, res) => {
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
                phone: certInfo.phone
            }
        });
        
    } catch (error) {
        console.error("포트원 연동 에러:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

exports.portoneApi = onRequest({ region: 'asia-northeast3', invoker: 'public' }, portoneApp);