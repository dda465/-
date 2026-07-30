import urllib.request
import json
import urllib.error
from datetime import datetime, timezone

project_id = "rejeuphone"
api_key = "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc"
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"

print("Authenticating anonymously...")
auth_req = urllib.request.Request(auth_url, data=json.dumps({"returnSecureToken": True}).encode("utf-8"), headers={"Content-Type": "application/json"})
response = urllib.request.urlopen(auth_req)
auth_data = json.loads(response.read().decode("utf-8"))
id_token = auth_data["idToken"]

url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/reviews"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {id_token}"
}

raw_reviews = [
  {
    "deviceModel": "갤럭시 S23",
    "deviceStorage": "256GB",
    "transactionPrice": "42만원",
    "rating": 5,
    "text": "당근 이벤트 보고 우연히 신청해봤는데 진짜 신세계네요! 중고거래할 때마다 네고해달라 찔러보는 사람들 때문에 피곤했는데... 여긴 폰만 딱 보내면 알아서 검수하고 바로 입금 쏴주니까 너무 편해요ㅠㅠ 게다가 당근 이벤트 참여해서 추가금으로 2만원 더 챙겨 받아서 완전 이득 본 기분입니다!!",
    "userName": "윤*우",
    "dateStr": "2026-06-02T10:30:00+09:00"
  },
  {
    "deviceModel": "아이폰 14 프로",
    "deviceStorage": "256GB",
    "transactionPrice": "55만원",
    "rating": 5,
    "text": "생활 기스랑 모서리 찍힘이 있어서 차감이 불가피한 상황이었습니다. 발송 전에 타 업체 두 곳이랑 비교 견적을 내봤는데 여기가 제일 많이 쳐주길래 최종 결정했습니다. 처리 과정도 투명하게 카톡으로 안내해 주시고, 딜레이 없이 당일에 바로 현금 입금되어서 만족스러운 거래였습니다.",
    "userName": "송*연",
    "dateStr": "2026-06-02T14:15:00+09:00"
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
