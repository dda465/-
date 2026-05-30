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
    "deviceModel": "갤럭시 Z플립5",
    "deviceStorage": "256GB",
    "transactionPrice": "14만원",
    "rating": 5,
    "text": "접히는 부분 액정이 살짝 들떠서 서비스센터 갔더니 수리비 폭탄 맞고 그냥 팔기로 했습니다. 상태가 안 좋아서 매입 거절당할까 봐 걱정했는데, 생각보다 차감도 적게 해주시고 당일 바로 입금해 주셔서 너무 다행이었어요. 덕분에 새 폰 살 때 보탬이 좀 됐네요.",
    "userName": "최*진",
    "dateStr": "2026-05-30T10:15:00+09:00"
  },
  {
    "deviceModel": "아이폰 13 프로",
    "deviceStorage": "128GB",
    "transactionPrice": "32만원",
    "rating": 5,
    "text": "집에 굴러다니던 옛날 폰 2대랑 메인 폰까지 한꺼번에 보냈더니 처리하기가 훨씬 수월하네요. 방문 수거 기사님도 친절하시고 3대 합쳐서 쏠쏠하게 용돈 벌어갑니다~",
    "userName": "박*수",
    "dateStr": "2026-05-30T11:40:00+09:00"
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
