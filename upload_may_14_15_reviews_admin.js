const admin = require('firebase-admin');

try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.error("serviceAccountKey.json not found or error loading it.");
    process.exit(1);
}

const db = admin.firestore();

const reviewsData = [
  {
    deviceModel: "갤럭시 Z 플립5",
    deviceStorage: "256GB",
    transactionPrice: "40만원",
    rating: 5,
    text: "당근에 올렸는데 찔러보기만 하고 네고해달라는 사람 너무 많아서 스트레스받다가 걍 여기 보냄요ㅋㅋ 근데 당근에 올렸던 가격보다 5만원 더 쳐줘서 진작 여기 팔걸 후회함",
    userName: "김*우",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-05-14T10:30:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "아이폰 12 프로",
    deviceStorage: "128GB",
    transactionPrice: "25만원",
    rating: 5,
    text: "보통 홈페이지 단가만 높게 올려두고 막상 폰 보내면 트집 잡아서 깎는 경우가 많아 걱정했습니다. 그런데 여기는 기기 상태가 좋다고 오히려 홈페이지 단가보다 더 높게 쳐서 입금해주셨습니다. 억지 차감 없는 곳은 처음이네요.",
    userName: "정*진",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-05-14T15:45:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "아이폰 14 프로",
    deviceStorage: "256GB",
    transactionPrice: "65만원",
    rating: 5,
    text: "얼마전부터 인스타에 계속 뜨길래 걍 내폰 얼마인가 견적이나 보자 하고 조회했는데 생각보다 단가가 너무 높아서 홀린듯이 바로 팔아버렸습니다ㅋㅋㅋ 입금도 당일에 바로 꽂히고 일처리 굿",
    userName: "최*아",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-05-15T11:20:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "갤럭시 S22 울트라",
    deviceStorage: "512GB",
    transactionPrice: "38만원",
    rating: 4,
    text: "신청하기도 편하고 알아서 택배 가지러 오니 참 좋네요. 가격도 다른 곳 발품 팔아본 것보다 꽤 많이 받았습니다. 감사합니다.",
    userName: "이*석",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-05-15T16:10:00+09:00")),
    imageUrl: null
  }
];

async function seed() {
  console.log("Starting seed of May 14/15 reviews using admin sdk...");
  try {
    const batch = db.batch();
    for (const review of reviewsData) {
      const docRef = db.collection('reviews').doc();
      batch.set(docRef, review);
      console.log(`Prepared review for ${review.deviceModel}`);
    }
    await batch.commit();
    console.log("Done uploading 4 new reviews!");
  } catch (err) {
    console.error("Error adding doc:", err);
  }
}

seed();
