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
const TELEGRAM_CHAT_IDS = ["6989151823", "7434861149", "8415202496", "8549949204"];

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
