const telegramMsg = `
[🌍 외국인 매입 신청]
👤 이름: John
🎌 국적: USA
📱 연락처(phone): 010-1234-5678 (phone)
📍 배송방식: 편의점 택배 직접 발송
🏦 입금방식: Bank Transfer (shinhan 123)
🗣️ 언어: EN

📱 기종: Apple iPhone 15 Pro (128GB)
💰 예상매입가: 1,000,000 원
🔍 체크된 하자: 없음
`;
fetch('https://asia-northeast3-rejeuphone.cloudfunctions.net/telegramApi/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: telegramMsg })
}).then(async res => {
    console.log(res.status, await res.text());
}).catch(e => console.error(e));
