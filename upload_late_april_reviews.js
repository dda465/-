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
  // 4월 25일
  {
    deviceModel: "갤럭시 Z 폴드 4",
    deviceStorage: "512GB",
    transactionPrice: "65만원",
    rating: 5,
    text: "업무용으로 쓰다가 이번에 S26으로 넘어가면서 처분했습니다. 나이가 있다 보니 중고거래 앱 같은 건 번거로워서 잘 못하는데, 알아서 수거해가고 검수 끝나자마자 칼같이 입금해주니 아주 편하네요. 일처리가 깔끔해서 마음에 듭니다.",
    userName: "최*식",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-25T14:20:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "아이폰 14 프로",
    deviceStorage: "256GB",
    transactionPrice: "85만원",
    rating: 5,
    text: "헐 대박!! 솔직히 다른데서 견적 받았을 때 생활기스 있다고 엄청 후려쳐서 빈정 상했었거든요 ㅠㅠ 혹시나 하고 쉐라폰에 보냈는데 방어율 미쳤어요!! ㅋㅋㅋ 상담해주신 분도 완전 친절보스🥰 커피 쿠폰도 꼭 챙겨주세용!!",
    userName: "김*아",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-25T19:45:00+09:00")),
    imageUrl: null
  },
  // 4월 26일
  {
    deviceModel: "갤럭시 S21",
    deviceStorage: "256GB",
    transactionPrice: "22만원",
    rating: 4,
    text: "아들내미가 새 폰 사주면서 쓰던 폰은 알아서 팔아준다고 가져가더니 여기서 팔았네요. 오래 써서 배터리도 빨리 닳고 낡았는데 생각보다 용돈을 두둑하게 챙겨줘서 기분이 좋습니다. 다음번에도 이용해야겠어요.",
    userName: "정*숙",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-26T11:10:00+09:00")),
    imageUrl: null
  },
  // 4월 27일
  {
    deviceModel: "아이폰 15",
    deviceStorage: "128GB",
    transactionPrice: "82만원",
    rating: 5,
    text: "맘카페에서 추천받고 진행했습니다. 워킹맘이라 퇴근하고 우체국 갈 시간도 없었는데, 문 앞에 내놓기만 하면 기사님이 수거해가시니 너무 수월했네요. 입금도 오후 3시쯤 카톡 알림 오자마자 바로 들어왔습니다. 꼼꼼하게 일하시네요.",
    userName: "이*영",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-27T15:30:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "갤럭시 S24 울트라",
    deviceStorage: "512GB",
    transactionPrice: "105만원",
    rating: 5,
    text: "사업하느라 바빠서 당근마켓 같은 곳에서 연락 주고받고 시간 맞출 여력이 없습니다. 여긴 신청서 쓰고 폰 틱 보내면 끝이니 시간 절약돼서 좋고, 단가도 개인거래랑 비교해서 크게 안 빠집니다. 시간=돈인 분들께 강력 추천합니다.",
    userName: "강*석",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-27T20:05:00+09:00")),
    imageUrl: null
  },
  // 4월 28일
  {
    deviceModel: "아이폰 13",
    deviceStorage: "128GB",
    transactionPrice: "48만원",
    rating: 4,
    text: "휴가 나온 김에 폰 바꾸면서 예전 폰 넘겼습니다. 부대 복귀 전에 처리해야 해서 조마조마했는데 다행히 수거부터 입금까지 이틀 만에 다 끝났습니다!! 일처리 속도 진짜 빠릅니다 충성충성",
    userName: "윤*호",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-28T09:50:00+09:00")),
    imageUrl: null
  },
  // 4월 29일
  {
    deviceModel: "아이폰 12 미니",
    deviceStorage: "64GB",
    transactionPrice: "25만원",
    rating: 5,
    text: "자취방 근처에 편의점 택배가 있어서 걍 퇴근길에 쓱 맡겼더니 다음날 바로 도착했다고 카톡 오더라구요. 액정에 기스 좀 있어서 걱정했는데 예상했던 금액 그대로 나와서 치킨 시켜먹었습니다 존맛탱~",
    userName: "송*진",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-29T18:15:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "갤럭시 Z 플립 5",
    deviceStorage: "256GB",
    transactionPrice: "58만원",
    rating: 5,
    text: "스마트폰을 자주 바꾸는 편이라 중고폰 매입 업체를 여러 군데 써봤는데, 여기가 제일 투명하네요. 다른 곳은 막상 폰 받으면 말도 안되는 트집 잡아서 후려치는 경우가 많은데, 쉐라폰은 사전에 고지된 단가 그대로 줍니다. 앞으로 여기로 정착합니다.",
    userName: "임*현",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-29T21:40:00+09:00")),
    imageUrl: null
  },
  // 4월 30일
  {
    deviceModel: "갤럭시 노트 20 울트라",
    deviceStorage: "256GB",
    transactionPrice: "28만원",
    rating: 4,
    text: "4년 넘게 잔고장 없이 잘 쓰던 정든 폰이라 보낼 때 시원섭섭했어요. 테두리 까진 곳도 많고 해서 큰 기대 안했는데, 생각보다 좋은 금액으로 매입해 주셔서 감사해요. 상담원 아가씨가 말도 예쁘게 해주시고 참 친절하시네요.",
    userName: "한*미",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-30T10:25:00+09:00")),
    imageUrl: null
  },
  {
    deviceModel: "아이폰 11",
    deviceStorage: "128GB",
    transactionPrice: "20만원",
    rating: 5,
    text: "취준생이라 한 푼이 아쉬웠는데, 서랍 속에 처박혀 있던 구형 아이폰이 돈이 될 줄이야ㅠㅠ 배터리 성능 70%대라서 안 받아줄까 걱정했는데 매입 잘 해주셔서 교재비 보탰습니다! 최고!!",
    userName: "박*원",
    userId: "anonymous",
    createdAt: Timestamp.fromDate(new Date("2026-04-30T16:50:00+09:00")),
    imageUrl: null
  }
];

async function seed() {
  console.log("Starting seed of 10 new late April reviews...");
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
