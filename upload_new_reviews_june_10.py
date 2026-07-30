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
    "deviceModel": "갤럭시 S22 울트라",
    "deviceStorage": "256GB",
    "transactionPrice": "31만원",
    "rating": 5,
    "text": "집 근처 중고폰 매장 몇 군데 돌아다녀 봤는데 부르는 게 값이라 너무 심하게 후려치길래 빈정 상했거든요. 여기는 단가표 시세대로 투명하게 매입해 주니까 흥정할 필요도 없고 스트레스 안 받아서 좋네요. 편의점 택배 보내고 다음날 검수 끝나자마자 바로 입금됐습니다.",
    "userName": "윤*호",
    "dateStr": "2026-06-10T10:15:00+09:00"
  },
  {
    "deviceModel": "아이폰 13",
    "deviceStorage": "128GB",
    "transactionPrice": "33만원",
    "rating": 5,
    "text": "제가 쓰던 폰 팔아보는 게 아예 처음이라 카톡으로 귀찮게 이것저것 엄청 많이 여쭤봤거든요ㅠㅠ 그런데도 너무 친절하게 하나하나 다 알려주셔서 감동이었어요! 외관 상태가 좋은 편이 아니라서 크게 기대 안 했는데 생각보다 돈도 꽤 나와서 기분 짱 좋습니당 번창하세요!!",
    "userName": "김*아",
    "dateStr": "2026-06-10T11:40:00+09:00"
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
