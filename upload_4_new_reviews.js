const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, Timestamp } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc",
    authDomain: "rejeuphone.firebaseapp.com",
    projectId: "rejeuphone",
    storageBucket: "rejeuphone.firebasestorage.app",
    messagingSenderId: "1401756577",
    appId: "1:1401756577:web:d07a5f0e304ab048e749e0",
    measurementId: "G-JWS15NH588"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const reviewsData = [
  {
    deviceModel: "아이폰 13 미니",
    deviceStorage: "128GB",
    transactionPrice: "40만원",
    rating: 5,
    text: "지방 소도시에 살다 보니 주변에 중고폰을 시세대로 제대로 쳐주는 매장이 없더라고요. 헐값에 넘기기엔 아까워서 온라인으로 신청해 봤는데, 저희 집 앞까지 택배 수거하러 와주시고 서울 쪽 높은 단가 그대로 입금받았습니다. 저처럼 지방 사시는 분들에게는 진짜 한 줄기 빛 같은 서비스네요!",
    userName: "배*현",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-11T10:00:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "갤럭시 S23",
    deviceStorage: "256GB",
    transactionPrice: "55만원",
    rating: 4,
    text: "초등학생 아이가 험하게 쓴 폰이라 어느 정도 차감은 예상하고 보냈습니다. 그런데 뭉뚱그려서 얼마 깎는다고 하는 게 아니라, 기스나 찍힘 위치를 꼼꼼하게 사진으로 다 찍어서 검수 리포트처럼 안내해 주시더라고요. 왜 이 가격이 나왔는지 명확하게 납득시켜 주셔서 오히려 더 신뢰가 갔습니다.",
    userName: "이*정",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-12T14:30:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "아이폰 15 프로 맥스",
    deviceStorage: "512GB",
    transactionPrice: "130만원",
    rating: 5,
    text: "거의 100만 원 돈 하는 기기를 얼굴도 안 보고 택배로만 보낸다는 게 솔직히 엄청 불안했거든요. 그래서 발송 전에 고객센터에 여러 번 전화 해서 이것저것 귀찮게 캐물었는데, 매번 너무 친절하고 다정하게 안심시켜 주셨어요. 덕분에 맘 편히 거래했습니다. CS팀 직원분들 진짜 최고예요!",
    userName: "오*민",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-13T11:15:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "갤럭시 S25",
    deviceStorage: "256GB",
    transactionPrice: "100만원",
    rating: 5,
    text: "사정이 생겨서 박스만 뜯은(가개통 급) S25를 바로 팔게 되었습니다. 조금이라도 손해를 덜 보고 싶어서 동네 대리점이랑 중고폰 매장들 단가를 일일이 다 알아봤는데, 덥게 발품 팔 필요 없이 여기 홈페이지 매입가가 제일 높더라고요. 최신 기종이라 혹시나 핑계 대고 깎을까 봐 걱정했는데, A급 최고가 약속하신 그대로 당일 쾌속 입금해 주셔서 깔끔하게 처분했습니다!",
    userName: "박*태",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-14T09:20:00+09:00")),
    imageUrl: null
  }
];

async function seed() {
  console.log("Starting seed of 4 new reviews...");
  try {
    for (const review of reviewsData) {
      await addDoc(collection(db, "reviews"), review);
      console.log(`Added review for ${review.deviceModel}`);
    }
    console.log("Done!");
  } catch (err) {
    console.error("Error adding doc:", err);
  }
  process.exit(0);
}

seed();
