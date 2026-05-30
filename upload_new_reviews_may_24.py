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
    "deviceModel": "아이폰 14 프로",
    "deviceStorage": "256GB",
    "transactionPrice": "54만원",
    "rating": 5,
    "text": "당근에서 팔까 하다가 귀찮아서 쉐라폰에 택배로 보냈는데, 검수도 빠르고 입금도 당일에 바로 돼서 너무 편했어요. 기스 하나 있었는데 예상했던 차감액보다 적게 깎여서 기분 좋게 팔았습니다. 다음에도 폰 바꿀 때 이용할게요!",
    "userName": "이*민",
    "dateStr": "2026-05-23T11:20:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S23 울트라",
    "deviceStorage": "512GB",
    "transactionPrice": "60만원",
    "rating": 5,
    "text": "다른 중고업체 여러 군데 견적 받아봤는데 여기가 제일 높아서 진행했습니다. 택배로 보내는게 처음이라 조금 불안했는데 카톡으로 도착부터 검수, 입금까지 진행 상황을 계속 알려주셔서 안심이 됐네요. 상담원분도 친절하셔서 좋았습니다.",
    "userName": "박*훈",
    "dateStr": "2026-05-23T15:30:00+09:00"
  },
  {
    "deviceModel": "아이폰 13",
    "deviceStorage": "128GB",
    "transactionPrice": "25만원",
    "rating": 5,
    "text": "폰을 험하게 써서 테두리에 찍힘이 꽤 있었어요ㅠㅠ 그래서 가격 별로 못 받을 줄 알았는데 생각보다 합리적인 가격에 매입해주셔서 감사합니다. 동네 매장보다 훨씬 잘 쳐주시는 것 같아요! 주변 지인들에게도 추천할게요!!",
    "userName": "최*영",
    "dateStr": "2026-05-24T10:15:00+09:00"
  },
  {
    "deviceModel": "갤럭시 Z플립5",
    "deviceStorage": "256GB",
    "transactionPrice": "49만원",
    "rating": 5,
    "text": "테두리 쪽이 나가서 감가가 심할 줄 알았는데 생각보다 좋은 가격에 팔았어요! 편의점 택배로 보냈는데 배송비도 무료라 부담 없었고, 무엇보다 폰 도착하고 검수 끝나자마자 바로 계좌로 입금 쏴주셔서 최고였습니다👍 빠르고 깔끔한 거래 감사합니다.",
    "userName": "정*진",
    "dateStr": "2026-05-24T14:40:00+09:00"
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
