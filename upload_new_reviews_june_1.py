import urllib.request
import json
import urllib.error
from datetime import datetime, timezone, timedelta

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

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {id_token}"
}

raw_reviews = [
  {
    "deviceModel": "갤럭시 S21",
    "deviceStorage": "256GB",
    "transactionPrice": "15만원",
    "rating": 5,
    "text": "화면 잔상이 심해서 중고마켓에서는 아예 안 팔리더라고요ㅠㅠ 반포기 상태로 보냈는데 생각보다 가격 잘 쳐주시고 바로 입금돼서 기분 좋네요!",
    "userName": "김*민",
    "dateStr": "2026-05-31T10:15:00+09:00"
  },
  {
    "deviceModel": "아이폰 12 프로",
    "deviceStorage": "128GB",
    "transactionPrice": "25만원",
    "rating": 5,
    "text": "개인 거래 진상들 피하려고 여기서 팔았어요. 택배 보내고 하루 만에 검수부터 입금까지 끝나서 성격 급한 저한테 딱이네요. 양심적으로 매입해주십니다.",
    "userName": "이*아",
    "dateStr": "2026-05-31T11:40:00+09:00"
  },
  {
    "deviceModel": "갤럭시 Z 폴드3",
    "deviceStorage": "256GB",
    "transactionPrice": "21만원",
    "rating": 5,
    "text": "폴드 특성상 가운데 주름도 심하고 힌지 쪽 잔기스가 많아서 얼마 안 나오겠다 싶었어요. 다행히 터무니없는 후려치기 없이 납득할 만한 차감만 해주셔서 정직하다는 느낌을 받았습니다.",
    "userName": "박*수",
    "dateStr": "2026-05-31T14:20:00+09:00"
  },
  {
    "deviceModel": "아이폰 15",
    "deviceStorage": "512GB",
    "transactionPrice": "65만원",
    "rating": 5,
    "text": "선물 받은 폰인데 원래 쓰던 폰 계속 쓰려고 박스째로 보냈습니다. 새거라 깎일 일은 없겠다 싶었지만 혹시나 했는데 홈페이지 단가표 그대로 쿨하게 쳐주시네요ㅋㅋ 입금도 거의 10분 컷입니다.",
    "userName": "최*혁",
    "dateStr": "2026-06-01T09:30:00+09:00"
  },
  {
    "deviceModel": "갤럭시 A53",
    "deviceStorage": "128GB",
    "transactionPrice": "11만원",
    "rating": 5,
    "text": "서브폰으로 쓰다가 정리해서 보냈습니다. 보급형이라 돈이 되려나 싶었는데 처리하기도 편하고 쏠쏠하네요. 꽁돈 생긴 기분이라 좋습니다~",
    "userName": "정*현",
    "dateStr": "2026-06-01T10:45:00+09:00"
  }
]

for review in raw_reviews:
    doc_data = {
        "fields": {
            "deviceModel": {"stringValue": review["deviceModel"]},
            "deviceStorage": {"stringValue": review["deviceStorage"]},
            "transactionPrice": {"stringValue": review["transactionPrice"]},
            "rating": {"integerValue": review["rating"]},
            "text": {"stringValue": review["text"]},
            "userName": {"stringValue": review["userName"]},
            "isApproved": {"booleanValue": True},
            "createdAt": {"timestampValue": datetime.fromisoformat(review["dateStr"]).astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
        }
    }
    
    req = urllib.request.Request(url, data=json.dumps(doc_data).encode("utf-8"), headers=headers, method="POST")
    try:
        res = urllib.request.urlopen(req)
        print(f"Uploaded review for {review['userName']}")
    except urllib.error.HTTPError as e:
        print(f"Error uploading review for {review['userName']}: {e.code} - {e.read().decode('utf-8')}")

print("All done!")
