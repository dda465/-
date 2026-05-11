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
        "deviceModel": {"stringValue": "아이폰 13 미니"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "40만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "지방 소도시에 살다 보니 주변에 중고폰을 시세대로 제대로 쳐주는 매장이 없더라고요. 헐값에 넘기기엔 아까워서 온라인으로 신청해 봤는데, 저희 집 앞까지 택배 수거하러 와주시고 서울 쪽 높은 단가 그대로 입금받았습니다. 저처럼 지방 사시는 분들에게는 진짜 한 줄기 빛 같은 서비스네요!"},
        "userName": {"stringValue": "배*현"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-11T01:00:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 S23"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "55만원"},
        "rating": {"integerValue": "4"},
        "text": {"stringValue": "초등학생 아이가 험하게 쓴 폰이라 어느 정도 차감은 예상하고 보냈습니다. 그런데 뭉뚱그려서 얼마 깎는다고 하는 게 아니라, 기스나 찍힘 위치를 꼼꼼하게 사진으로 다 찍어서 검수 리포트처럼 안내해 주시더라고요. 왜 이 가격이 나왔는지 명확하게 납득시켜 주셔서 오히려 더 신뢰가 갔습니다."},
        "userName": {"stringValue": "이*정"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-12T05:30:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "아이폰 15 프로 맥스"},
        "deviceStorage": {"stringValue": "512GB"},
        "transactionPrice": {"stringValue": "130만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "거의 100만 원 돈 하는 기기를 얼굴도 안 보고 택배로만 보낸다는 게 솔직히 엄청 불안했거든요. 그래서 발송 전에 고객센터에 여러 번 전화해서 이것저것 귀찮게 캐물었는데, 매번 너무 친절하고 다정하게 안심시켜 주셨어요. 덕분에 맘 편히 거래했습니다. CS팀 직원분들 진짜 최고예요!"},
        "userName": {"stringValue": "오*민"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-13T02:15:00Z"},
        "imageUrl": {"nullValue": None}
    },
    {
        "deviceModel": {"stringValue": "갤럭시 S25"},
        "deviceStorage": {"stringValue": "256GB"},
        "transactionPrice": {"stringValue": "100만원"},
        "rating": {"integerValue": "5"},
        "text": {"stringValue": "사정이 생겨서 박스만 뜯은(가개통 급) S25를 바로 팔게 되었습니다. 조금이라도 손해를 덜 보고 싶어서 동네 대리점이랑 중고폰 매장들 단가를 일일이 다 알아봤는데, 덥게 발품 팔 필요 없이 여기 홈페이지 매입가가 제일 높더라고요. 최신 기종이라 혹시나 핑계 대고 깎을까 봐 걱정했는데, A급 최고가 약속하신 그대로 당일 쾌속 입금해 주셔서 깔끔하게 처분했습니다!"},
        "userName": {"stringValue": "박*태"},
        "userId": {"stringValue": "anonymous"},
        "createdAt": {"timestampValue": "2026-04-14T00:20:00Z"},
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
