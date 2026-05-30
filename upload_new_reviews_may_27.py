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
    "deviceModel": "아이폰 16",
    "deviceStorage": "256GB",
    "transactionPrice": "85만원",
    "rating": 5,
    "text": "17 프맥으로 넘어가려고 일반모델 산 지 얼마 안 돼서 팔았어요. 새거라 그런지 진짜 기스 하나도 안 잡고 홈페이지에 나와있던 최고가 그대로 쳐주시네요ㅋㅋㅋ 다른 데는 박스 없다고 깎고 케이블 없다고 깎고 난리인데, 여기는 쪼잔하게 안 굴고 폰 상태만 딱 보고 쿨하게 입금 꽂아줌. 일처리 깔끔해서 강추요",
    "userName": "박*준",
    "dateStr": "2026-05-27T10:20:00+09:00"
  },
  {
    "deviceModel": "아이폰 12",
    "deviceStorage": "128GB",
    "transactionPrice": "21만원",
    "rating": 5,
    "text": "4년 넘게 쓴 폰이라 배터리 성능도 70%대고 여기저기 찍힌 곳이 많아서 큰 기대 없이 보냈습니다. 동네 중고폰 매장에서는 아예 매입을 안 하려고 하거나 너무 후려치시더라고요 ㅠㅠ 근데 쉐라폰은 하나하나 꼼꼼하게 봐주시고 생각보다 훨씬 합리적인 금액으로 쳐주셔서 놀랐습니다. 집 앞 무료 택배 수거도 너무 편했어요!",
    "userName": "정*희",
    "dateStr": "2026-05-27T10:40:00+09:00"
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
