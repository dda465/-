import urllib.request
import json
import urllib.error

project_id = "rejeuphone"
api_key = "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc"
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"

print("Authenticating anonymously...")
auth_req = urllib.request.Request(auth_url, data=json.dumps({"returnSecureToken": True}).encode("utf-8"), headers={"Content-Type": "application/json"})
response = urllib.request.urlopen(auth_req)
auth_data = json.loads(response.read().decode("utf-8"))
id_token = auth_data["idToken"]
print("Authenticated successfully.")

url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/reviews"

reviews = [
    {
        "deviceModel": {"stringValue": "갤럭시 Z플립5"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "45만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "이번 주말 여행 경비에 보태려고 급하게 팔았는데, 택배 도착하자마자 검수 피드백 주시고 당일에 바로 입금해주셔서 너무 다행이었어요! 대학생이라 용돈이 늘 간당간당한데 빠르고 정확하게 처리해주셔서 감사합니다. 폰 상태도 정직하게 봐주셔서 예상했던 금액 그대로 받았네요 ㅎㅎ"},
        "userName": {"stringValue": "김*은"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-15T14:30:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 S22 울트라"},
        "deviceStorage": {"stringValue": "512GB"},
        "transactionPrice": {"stringValue": "50만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "법인폰으로 쓰던 기기라 보안 때문에 초기화가 제일 걱정이었습니다. 고객센터 문의하니 개인정보 완전 파기 시스템이 있다고 친절하게 안내해주셔서 믿고 보냈습니다. 일하시느라 바쁜 직장인 분들께는 이렇게 택배로 휙 보내기만 하면 알아서 처리되는 시스템이 최고인 것 같네요."},
        "userName": {"stringValue": "최*석"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-16T11:15:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 11"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "15만원"},
        "rating": {"integerValue": "4"},
        "text": {"stringValue": "아들내미가 새 폰으로 바꾸면서 예전에 쓰던 폰을 대신 팔아달라고 하더군요. 나이 먹고 이런 온라인 판매는 처음이라 헤맬까 봐 무서웠는데, 홈페이지 신청도 쉬웠고 택배 아저씨가 집으로 수거하러 와주셔서 정말 편했습니다. 상담원분도 또박또박 설명해주셔서 고마웠어요."},
        "userName": {"stringValue": "박*자"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-17T16:45:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 14 프로"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "75만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "기변증이 심해서 매년 폰을 바꾸는 편입니다. 당근이나 중고나라 같은 개인 간 거래도 많이 해봤지만, 진상들 피곤하게 상대하느니 그냥 마음 편하게 여기서 팝니다. 시세 깎이는 것도 크지 않고, 오히려 쿨거래로 스트레스 안 받는 비용 생각하면 여기가 훨씬 이득입니다."},
        "userName": {"stringValue": "정*호"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-18T09:20:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 S23"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "58만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "군인이라 휴가 때 아니면 대리점 갈 시간이 없었는데, 부대 안 우체국에서 바로 택배 부칠 수 있어서 너무 좋았습니다!! 우편물 도착하자마자 알림톡 와서 안심됐고, 입금도 LTE급이네요👍 전우들한테도 무조건 여기서 팔라고 입대동기들한테도 추천 중입니다 ㅋㅋㅋ"},
        "userName": {"stringValue": "이*준"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-19T13:10:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 A54"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "20만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "동네 폰 가게 갔더니 어르신이라고 시세를 너무 후려치길래 마음이 상해 가지고 돌아왔었습니다. 딸이 대신 인터넷으로 신청해 줘서 택배로 보냈는데, 그 가게보다 5만 원은 더 받았습니다. 사람 차별 안 하고 정해진 단가표대로 쳐주니 기분이 참 좋네요. 번창하십시오."},
        "userName": {"stringValue": "강*수"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-20T10:05:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 13 프로"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "55만원"},
        "rating": {"integerValue": "4"},
        "text": {"stringValue": "측면에 찍힘이 꽤 있어서 가격 엄청 깎일 각오하고 보냈거든요? ㅠㅠ 근데 생각보다 차감폭이 적어서 놀랐어요! 투명하게 어느 부분 때문에 차감되는지 사진이랑 같이 찝어주시니까 납득이 확 가더라고요. 양심적으로 영업하시는 느낌 팍팍 듭니다 ㅎㅎ"},
        "userName": {"stringValue": "윤*영"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-21T15:50:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 Z폴드4"},
        "deviceStorage": {"stringValue": "512GB"},
        "transactionPrice": {"stringValue": "62만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "폴더블폰을 쓰다 보니 무게도 무겁고 액정 나갈까 봐 항상 조마조마해서 이번에 일반 바형으로 넘어왔습니다. 폴드 시리즈가 감가가 심하다고 들어서 걱정했는데 꽤 두둑하게 챙겨주셔서 케이스랑 무선충전기 새로 싹 다 맞췄네요^^ 일처리가 참 깔끔합니다!"},
        "userName": {"stringValue": "한*미"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-22T17:20:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 12 미니"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "22만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "미니 시리즈를 워낙 좋아해서 오래 버티고 썼는데 배터리 효율이 너무 떨어져서 결국 바꿨습니다. 배터리 광탈에 외관 스크래치도 좀 있었는데, 다른 곳들처럼 말도 안 되는 핑계로 트집 잡지 않으시고 정해진 기준대로만 차감하셔서 깔끔하게 거래 완! 다음에도 애용할게요."},
        "userName": {"stringValue": "서*진"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-23T12:00:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 13 미니"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "35만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "이제 미니 신제품이 안 나와서 소장할까 하다가 그냥 팔았습니다. ㅠㅠ 작고 소중한 폰이라 떠나보내기 아쉬웠는데 좋은 가격에 매입해 주셔서 위안이 되네요. 포장해서 문 앞에 내놓기만 하면 알아서 수거해 가니 저같은 집순이한테는 정말 빛과 소금 같은 프로세스입니다 ㅋㅋㅋ 굳!"},
        "userName": {"stringValue": "송*아"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-24T08:30:00Z"},
        "imageUrl": {"nullValue": None}
    }
]

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {id_token}"
}

for review in reviews:
    data = json.dumps({"fields": review}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        response = urllib.request.urlopen(req)
        print(f"Added {review['deviceModel']['stringValue']} ({review['createdAt']['timestampValue']})")
    except urllib.error.HTTPError as e:
        print(f"Failed to add {review['deviceModel']['stringValue']}: {e.read().decode()}")

print("Done via REST + Auth")
