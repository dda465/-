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
        "deviceModel": {"stringValue": "갤럭시 S22 울트라"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "45만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "폰 안에 공인인증서랑 사진이 너무 많아서 기기 초기화를 해도 중고로 파는 게 찜찜했거든요. 그런데 상담할 때 데이터 안전하게 영구 삭제 진행하신다고 자세히 설명해 주셔서 믿고 맡길 수 있었습니다. 개인정보 유출 걱정 없이 깔끔하게 처리해주셔서 감사합니다."},
        "userName": {"stringValue": "정*호"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-04T01:30:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 12 프로"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "30만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "당근마켓에 올렸다가 찔러보는 사람, 깎아달라는 사람 너무 많아서 스트레스 받아 그냥 여기로 보냈습니다. 흥정하느라 감정 소모할 필요도 없고, 보낸 지 이틀 만에 그냥 제값 받고 팔아서 속이 다 시원하네요. 진작에 여기서 팔 걸 그랬습니다."},
        "userName": {"stringValue": "최*훈"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-05T05:15:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 S21"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "15만원"},
        "rating": {"integerValue": "4"},
        "text": {"stringValue": "이번에 부모님 두 분 다 새 폰으로 바꿔드리면서 남은 구형 폰 두 대를 한꺼번에 처분했습니다. 택배 접수부터 검수 상황까지 카톡으로 알림이 그때그때 오니까 진행 과정 확인하기가 너무 좋네요. 부모님도 용돈 생겼다고 좋아하십니다. ㅎㅎ"},
        "userName": {"stringValue": "강*영"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-06T07:45:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 15 프로"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "95만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "매년 신제품 나올 때마다 폰을 바꾸는 편이라 항상 쓰던 중고 업체가 있었는데, 이번에 쉐라폰 단가가 더 좋길래 처음 갈아타봤습니다. 검수 기준도 타사보다 명확한 것 같고, 안내해주신 담당자분 피드백이 정확해서 마음에 드네요. 내년 교체 시기에도 또 이용하겠습니다."},
        "userName": {"stringValue": "유*진"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-07T02:20:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 Z 폴드 3"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "20만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "힌지 부분 찌그러지고 내부 액정에 줄까지 가서 동네 대리점에서는 그냥 버리라고 하더라고요 ㅠㅠ 혹시나 하고 신청해 봤는데 다행히 매입이 가능하다고 하셨고, 거의 폐급인데도 생각보다 치킨값 이상은 챙겨주셔서 기분 최고입니다 ㅋㅋㅋ"},
        "userName": {"stringValue": "임*석"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-08T06:50:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 14"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "55만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "친구가 여기서 팔고 단가 잘 쳐준다고 추천해서 신청해봤어용~ 솔직히 우체국 가서 택배 부치는 게 조금 귀찮긴 했는데 막상 보내고 나니까 제가 할 일은 1도 없네요! 테두리 찍힘 있어서 차감 좀 될 줄 알았는데 그냥 쿨하게 넘어가 주셔서 감동..."},
        "userName": {"stringValue": "송*아"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-09T09:10:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 A53"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "10만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "업무용으로 스페어 폰으로 쓰던 거라 상태는 좋았는데 굳이 직거래 하러 시간 내고 나가기 귀찮아서 이용했어요. 연차 쓰고 나갈 필요 없이 출근길에 택배 하나 보내놓고 일하다 보니 입금 알림이 떠 있네요. 직장인들한테는 최고로 편한 시스템 같습니다. 번창하세요."},
        "userName": {"stringValue": "한*수"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-10T04:00:00Z"},
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
        print(f"Added {review['deviceModel']['stringValue']}")
    except urllib.error.HTTPError as e:
        print(f"Failed to add {review['deviceModel']['stringValue']}: {e.read().decode()}")

print("Done via REST + Auth")
