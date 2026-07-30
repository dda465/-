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
    "deviceModel": "아이폰 13 미니",
    "deviceStorage": "128GB",
    "transactionPrice": "25만원",
    "rating": 5,
    "text": "작은 폰 쓰다가 화면이 너무 답답해서 폰 바꾸고 기존 폰은 서랍에 방치해 뒀었거든요. 편의점 택배로 무료 발송 가능하다고 해서 어제 퇴근길에 보냈는데 오늘 바로 검수 완료 톡 오고 입금까지 싹 처리됐습니다! 소액이지만 생각보다 빨리 들어와서 쏠쏠하네요ㅎㅎ",
    "userName": "권*아",
    "dateStr": "2026-06-04T09:15:00+09:00"
  },
  {
    "deviceModel": "갤럭시 노트20 울트라",
    "deviceStorage": "256GB",
    "transactionPrice": "15만원",
    "rating": 5,
    "text": "워낙 오래 쓴 폰이라 모서리 찍힘도 있고 펜 근처에 기스도 꽤 있어서 폐급 취급받을 줄 알았습니다. 솔직히 큰 기대 안 하고 보냈는데, 생활 기스 정도로만 차감해주셔서 꽤 만족스러운 금액을 받았습니다. 양심적으로 매입해 주시는 곳이네요.",
    "userName": "임*훈",
    "dateStr": "2026-06-04T09:40:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S22 울트라",
    "deviceStorage": "512GB",
    "transactionPrice": "35만원",
    "rating": 5,
    "text": "당근이랑 플리마켓에 올렸는데 찔러보는 사람만 10명 넘게 연락 와서 스트레스 받다 다 차단하고 여기로 신청했습니다. 차라리 이렇게 단가표 투명하게 공개해놓고 딱 그만큼 매입하는 곳이 백배 천배 낫네요. 시간 낭비, 감정 낭비 안 해서 진짜 좋습니다.",
    "userName": "강*수",
    "dateStr": "2026-06-04T10:10:00+09:00"
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
