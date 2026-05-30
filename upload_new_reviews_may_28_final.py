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
    "deviceModel": "갤럭시 S22",
    "deviceStorage": "256GB",
    "transactionPrice": "12만원",
    "rating": 5,
    "text": "액정도 깨지고 뒷판도 갈라져서 똥값일 줄은 알았지만 검수받아보니 진짜 얼마 안 나오긴 하네요ㅋㅋㅋ 그래도 다른 곳에선 안 받아주던데 여긴 군말 없이 수거해가고 입금은 엄청 빨리 쏴주셔서 그냥 술값 벌었다 생각하려고요.",
    "userName": "정*민",
    "dateStr": "2026-05-28T10:15:00+09:00"
  },
  {
    "deviceModel": "아이폰 14",
    "deviceStorage": "128GB",
    "transactionPrice": "43만원",
    "rating": 5,
    "text": "원래 중고마켓에서 직접 팔려다가 찔러보는 진상들한테 하도 데여서 홧김에 업체 찾아서 보냈습니다. 당연히 개인 거래보단 덜 받겠지 했는데 막상 말도 안 되는 후려치기 없이 시세대로 잘 쳐주셨어요. 귀찮게 흥정 안 해도 되고 물건 받자마자 당일 바로 현금 꽂히는 게 제일 맘에 듭니다.",
    "userName": "이*현",
    "dateStr": "2026-05-28T11:45:00+09:00"
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
