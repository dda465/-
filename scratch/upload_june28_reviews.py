import urllib.request
import json
import urllib.error
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')

project_id = "rejeuphone"
api_key = "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc"

# 1. Authenticate Anonymously to get ID Token
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"
print("Authenticating...")
auth_req = urllib.request.Request(auth_url, data=json.dumps({"returnSecureToken": True}).encode("utf-8"), headers={"Content-Type": "application/json"})
response = urllib.request.urlopen(auth_req)
auth_data = json.loads(response.read().decode("utf-8"))
id_token = auth_data["idToken"]
print("Authenticated successfully.")

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {id_token}"
}

# 2. Define the reviews to upload (June 28, 2026)
# Latest first ordering: 3번, 2번, 1번 timestamp order
custom_reviews = [
    {
        "deviceModel": "아이폰 14",
        "deviceStorage": "128GB",
        "transactionPrice": "48만원",
        "rating": 5,
        "text": "원래 당근으로 시간 약속까지 잡았는데 5분전에 파토내고.. 그래서 그냥 팔았는데 배송비도 선지급해주고 다음날에 검수도 빨리끝나서 입금도 빨랐어용 ㅎㅎ",
        "userName": "임*현",
        "dateStr": "2026-06-28T10:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "아이폰 15 프로",
        "deviceStorage": "128GB",
        "transactionPrice": "69만원",
        "rating": 4,
        "text": "카메라 링 쪽에 아주 미세하게 찍힘이 하나 있어서 예상한 금액보다는 2만원 정도 감가되서 쬐끔 아쉽지만 ㅠㅠ 그래도 검수 담당자분이 전화 오셔서 친절하게 사유를 조목조목 짚어주셔서 신뢰가 갔습니다. 다른 업체보다 가격도 젤 잘 쳐주는 것 같아요!",
        "userName": "황*아",
        "dateStr": "2026-06-28T11:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "아이폰 X",
        "deviceStorage": "64GB",
        "transactionPrice": "11만원",
        "rating": 5,
        "text": "11만원이나 벌었네요 ㅎㅎ 화면에 기스도 좀 있구 전반적으로 사용감 있는데 감사합니당~~ 개인정보도 초기화 해서 리포트로 보내주셔서 안심입니당",
        "userName": "권*준",
        "dateStr": "2026-06-28T12:00:00+09:00",
        "isVerified": True
    }
]

upload_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/reviews"

for review in custom_reviews:
    doc_data = {
        "fields": {
            "deviceModel": {"stringValue": review["deviceModel"]},
            "deviceStorage": {"stringValue": review["deviceStorage"]},
            "transactionPrice": {"stringValue": review["transactionPrice"]},
            "rating": {"integerValue": review["rating"]},
            "text": {"stringValue": review["text"]},
            "userName": {"stringValue": review["userName"]},
            "isApproved": {"booleanValue": True},
            "isVerified": {"booleanValue": review.get("isVerified", True)},
            "createdAt": {"timestampValue": datetime.fromisoformat(review["dateStr"]).astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
        }
    }
    
    req = urllib.request.Request(upload_url, data=json.dumps(doc_data).encode("utf-8"), headers=headers, method="POST")
    try:
        urllib.request.urlopen(req)
        print(f"Uploaded review: {review['userName']} ({review['deviceModel']})")
    except urllib.error.HTTPError as e:
        print(f"Error uploading review for {review['userName']}: {e.code} - {e.read().decode('utf-8')}")

print("All reviews uploaded successfully!")
