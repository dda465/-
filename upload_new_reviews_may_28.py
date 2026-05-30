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
    "deviceModel": "갤럭시 S23 울트라",
    "deviceStorage": "512GB",
    "transactionPrice": "68만원",
    "rating": 5,
    "text": "당근에 올렸는데 찔러보는 사람들 너무 많아서 스트레스 받다가 우연히 알게돼서 신청해봤어요. 집으로 방문택배 온다길래 반신반의했는데 진짜 기사님이 문 앞까지 오셔서 수거해가시더라구요ㅋㅋ 검수 결과도 하루만에 나오고 예상했던 매입가랑 똑같이 입금돼서 완전 대만족입니다! 앞으로 폰 바꿀 땐 무조건 여기 이용할게요.",
    "userName": "이*호",
    "dateStr": "2026-05-28T09:15:00+09:00"
  },
  {
    "deviceModel": "아이폰 14 프로",
    "deviceStorage": "256GB",
    "transactionPrice": "72만원",
    "rating": 5,
    "text": "테두리 쪽에 잔기스가 좀 있어서 다른 곳에서는 차감 엄청 심하게 부르길래 취소했었거든요..ㅠㅠ 지인 추천으로 쉐라폰에 보내봤는데 진짜 양심적으로 매입해주십니다!! 카톡으로 상담해주시는 분도 너무 친절하시고 무엇보다 입금이 10분만에 들어와요ㅎㅎ 기분 좋게 거래하고 갑니다 최고에요~~",
    "userName": "김*지",
    "dateStr": "2026-05-28T11:30:00+09:00"
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
