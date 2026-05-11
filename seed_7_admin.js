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
    deviceModel: "갤럭시 S22 울트라",
    deviceStorage: "256GB",
    transactionPrice: "45만원",
    rating: 5,
    text: "폰 안에 공인인증서랑 사진이 너무 많아서 기기 초기화를 해도 중고로 파는 게 찜찜했거든요. 그런데 상담할 때 데이터 안전하게 영구 삭제 진행하신다고 자세히 설명해 주셔서 믿고 맡길 수 있었습니다. 개인정보 유출 걱정 없이 깔끔하게 처리해주셔서 감사합니다.",
    userName: "정*호",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-04T10:30:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "아이폰 12 프로",
    deviceStorage: "128GB",
    transactionPrice: "30만원",
    rating: 5,
    text: "당근마켓에 올렸다가 찔러보는 사람, 깎아달라는 사람 너무 많아서 스트레스 받아 그냥 여기로 보냈습니다. 흥정하느라 감정 소모할 필요도 없고, 보낸 지 이틀 만에 그냥 제값 받고 팔아서 속이 다 시원하네요. 진작에 여기서 팔 걸 그랬습니다.",
    userName: "최*훈",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-05T14:15:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "갤럭시 S21",
    deviceStorage: "256GB",
    transactionPrice: "15만원",
    rating: 4,
    text: "이번에 부모님 두 분 다 새 폰으로 바꿔드리면서 남은 구형 폰 두 대를 한꺼번에 처분했습니다. 택배 접수부터 검수 상황까지 카톡으로 알림이 그때그때 오니까 진행 과정 확인하기가 너무 좋네요. 부모님도 용돈 생겼다고 좋아하십니다. ㅎㅎ",
    userName: "강*영",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-06T16:45:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "아이폰 15 프로",
    deviceStorage: "256GB",
    transactionPrice: "95만원",
    rating: 5,
    text: "매년 신제품 나올 때마다 폰을 바꾸는 편이라 항상 쓰던 중고 업체가 있었는데, 이번에 쉐라폰 단가가 더 좋길래 처음 갈아타봤습니다. 검수 기준도 타사보다 명확한 것 같고, 안내해주신 담당자분 피드백이 정확해서 마음에 드네요. 내년 교체 시기에도 또 이용하겠습니다.",
    userName: "유*진",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-07T11:20:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "갤럭시 Z 폴드 3",
    deviceStorage: "256GB",
    transactionPrice: "20만원",
    rating: 5,
    text: "힌지 부분 찌그러지고 내부 액정에 줄까지 가서 동네 대리점에서는 그냥 버리라고 하더라고요 ㅠㅠ 혹시나 하고 신청해 봤는데 다행히 매입이 가능하다고 하셨고, 거의 폐급인데도 생각보다 치킨값 이상은 챙겨주셔서 기분 최고입니다 ㅋㅋㅋ",
    userName: "임*석",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-08T15:50:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "아이폰 14",
    deviceStorage: "128GB",
    transactionPrice: "55만원",
    rating: 5,
    text: "친구가 여기서 팔고 단가 잘 쳐준다고 추천해서 신청해봤어용~ 솔직히 우체국 가서 택배 부치는 게 조금 귀찮긴 했는데 막상 보내고 나니까 제가 할 일은 1도 없네요! 테두리 찍힘 있어서 차감 좀 될 줄 알았는데 그냥 쿨하게 넘어가 주셔서 감동...",
    userName: "송*아",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-09T18:10:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "갤럭시 A53",
    deviceStorage: "128GB",
    transactionPrice: "10만원",
    rating: 5,
    text: "업무용으로 스페어 폰으로 쓰던 거라 상태는 좋았는데 굳이 직거래 하러 시간 내고 나가기 귀찮아서 이용했어요. 연차 쓰고 나갈 필요 없이 출근길에 택배 하나 보내놓고 일하다 보니 입금 알림이 떠 있네요. 직장인들한테는 최고로 편한 시스템 같습니다. 번창하세요.",
    userName: "한*수",
    userId: "anonymous",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-10T13:00:00+09:00")),
    imageUrl: null
  }
];

async function seed() {
  console.log("Starting seed of 7 new reviews using admin sdk...");
  try {
    const batch = db.batch();
    for (const review of reviewsData) {
      const docRef = db.collection('reviews').doc();
      batch.set(docRef, review);
      console.log(`Prepared review for ${review.deviceModel}`);
    }
    await batch.commit();
    console.log("Done uploading 7 new reviews!");
  } catch (err) {
    console.error("Error adding doc:", err);
  }
}

seed();
