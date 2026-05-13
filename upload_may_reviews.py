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
        "deviceModel": {"stringValue": "아이폰 15 Pro"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "95만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "흠집 하나 없는 A급이라 제값 받고 싶었는데 동네 매장은 너무 깎더라고요. 당근은 네고 해달라는 사람 많아서 스트레스였는데 여긴 깔끔하게 시세대로 쳐주네요! 셀카용으로 쓰다 무거워서 바꾼 건데 기분 좋게 처분했습니다."},
        "userName": {"stringValue": "박*진"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-03T14:30:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 Z 플립 5"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "35만원"},
        "rating": {"integerValue": "4"},
        "text": {"stringValue": "힌지 부분 찍힘이랑 내부 액정에 미세한 기스가 있었습니다. 폴더블 특성상 감가가 심할 줄 알았는데 생각보다 방어가 잘 됐네요. 택배 수거 기사님이 바로 와주셔서 연차 안 내고 회사에서 편하게 보냈습니다."},
        "userName": {"stringValue": "이*훈"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-04T10:15:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 13 미니"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "25만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "애들 사진 찍어주느라 배터리가 70%대까지 떨어져서 폰을 바꿨어요. 테두리 찍힘도 몇 군데 있었는데 차감 납득가게 잘 안내해주시더라고요. 전화 주신 상담원 분이 참 싹싹해서 기분 좋은 거래였습니다."},
        "userName": {"stringValue": "김*영"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-05T16:45:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 S24 Ultra"},
        "deviceStorage": {"stringValue": "512GB"},
        "transactionPrice": {"stringValue": "98만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "사업용으로 쓰다가 크기가 부담돼서 팔았습니다. 인터넷으로 폰 파는 건 처음이라 내심 의심했는데, 폰 도착하자마자 알림 톡 오고 검수 끝나자마자 30분 만에 돈 들어오더군요. 허허 세상 참 좋아졌습니다."},
        "userName": {"stringValue": "최*우"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-06T11:20:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 14"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "32만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "액정 깨진 채로 1년 가까이 썼어요ㅠㅠ 수리비가 더 나와서 그냥 보냈는데 생각보다 쏠쏠하게 챙겨서 에어팟 새로 샀습니다! 깨진 폰도 이렇게 잘 사주는지 몰랐는데 완전 개꿀이네요."},
        "userName": {"stringValue": "정*지"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-07T13:10:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 S22"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "14만원"},
        "rating": {"integerValue": "4"},
        "text": {"stringValue": "뒤판 유리 바사삭 깨짐. 서랍에 몇 달 굴러다니던 거 버리려다가 혹시나 해서 보냈는데 용돈 벌이 제대로 했네요. 폰 도착 알림 오더니 두 시간도 안 돼서 입금됨. 검수 속도 미쳤습니다."},
        "userName": {"stringValue": "강*민"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-08T09:40:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 Z 폴드 4"},
        "deviceStorage": {"stringValue": "512GB"},
        "transactionPrice": {"stringValue": "28만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "화면 가운데 주름 쪽에 흑점(멍) 생겨서 집 앞 매장 갔더니 완전 폐폰 취급하길래 열받아서 쉐라폰에 보냈습니다. 흑점 감안해도 동네보다 7~8만원은 더 받은 것 같네요. 진작 여기로 보낼 걸 그랬습니다."},
        "userName": {"stringValue": "조*석"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-09T18:05:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 12"},
        "deviceStorage": {"stringValue": "64GB"},
        "transactionPrice": {"stringValue": "18만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "용량 꽉 차서 새 폰으로 갈아타고 팔았당! 학생이라 택배 보내는 거 복잡할 줄 알았는데 집 앞으로 가지러 오니까 완전 편함ㅎㅎ 편의점 택배보다 쉬워요! 친구들한테도 추천할게여!"},
        "userName": {"stringValue": "윤*아"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-10T15:55:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 S23"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "35만원"},
        "rating": {"integerValue": "4"},
        "text": {"stringValue": "카메라 유리에 금이 가서 사진 찍을 때 빛 번짐 현상이 있었습니다. 다른 데 알아볼 때는 카메라 파손이라고 뭉텅이로 깎던데 여긴 합리적으로 딱 부품값 정도만 빼는 느낌이라 납득이 갔습니다."},
        "userName": {"stringValue": "송*호"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-11T12:30:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 11 Pro"},
        "deviceStorage": {"stringValue": "64GB"},
        "transactionPrice": {"stringValue": "21만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "딸내미가 대신 신청해줘서 우체국 택배로 부쳤습니다. 워낙 오래된 폰이라 기대 안 했는데 상담 전화 오신 아가씨가 차근차근 설명도 잘해주시고 입금도 바로바로 돼서 참 믿음직스럽네요."},
        "userName": {"stringValue": "한*숙"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-12T10:00:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 Z 플립 4"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "26만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "매장 운영하느라 따로 중고폰 직거래하러 나갈 시간이 없었는데, 신청 한 번으로 집 앞까지 수거하러 와주셔서 너무 편했습니다. 힌지에 모서리 찍힘이 있어서 걱정했지만 쿨하게 매입해 주셔서 감사해요!"},
        "userName": {"stringValue": "백*은"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-05-13T17:20:00Z"},
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
