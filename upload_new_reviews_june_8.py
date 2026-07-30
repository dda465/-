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
    "deviceModel": "갤럭시 Z 플립3",
    "deviceStorage": "256GB",
    "transactionPrice": "10만원",
    "rating": 5,
    "text": "딸내미 쓰던거 액정 나가서 팔았읍니다. 동네 매장보다 많이 쳐주는거 같네요. 수고하세요.",
    "userName": "송*진",
    "dateStr": "2026-06-08T10:15:00+09:00"
  },
  {
    "deviceModel": "아이폰 14",
    "deviceStorage": "128GB",
    "transactionPrice": "43만원",
    "rating": 5,
    "text": "미쳤어용 ㅠㅠㅠㅠㅠ🥺 당근에 올렸다가 진상들 땜에 멘탈 털리고 걍 눈딱감고 보냈는데... 제가 생각한 가격보다 더 나왔어요!!!🔥 완전 애지중지 쓰긴 했어도 좀 깎일줄 알았거든요ㅠㅠ 진짜 입금도 개빠름 담에 또 폰바꾸면 무조건 여기로 올게여 번창하세용💕",
    "userName": "박*은",
    "dateStr": "2026-06-08T11:40:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S20",
    "deviceStorage": "128GB",
    "transactionPrice": "12만원",
    "rating": 5,
    "text": "솔직히 인터넷 업체들 말로만 최고가 부르고 막상 물건 받으면 말도 안 되는 이유로 후려치는 경우가 많아서 반신반의하며 보냈습니다. 결론부터 말씀드리면 우려와 달리 꽤 투명하게 진행되네요. S20 구형 모델인데도 납득 가능한 선에서만 차감 안내를 받았고, 동의하자마자 10분 내로 바로 계좌로 들어왔습니다. 꽤 합리적인 곳이라 생각됩니다.",
    "userName": "최*민",
    "dateStr": "2026-06-08T13:20:00+09:00"
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
