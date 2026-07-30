import urllib.request
import json
import urllib.error
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')

project_id = "rejeuphone"
api_key = "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc"

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

custom_reviews = [
    {
        "deviceModel": "갤럭시 A31",
        "deviceStorage": "64GB",
        "transactionPrice": "8만원",
        "rating": 5,
        "text": "이번에 삼성이벤트하길래 s26으로 사면서 팔려고 왔습니다.. a31이구요 꽤나 오래썼어요 저도 이제 신규기종좀 써볼라고요 ㅎㅋ 사용감이 좀 있는편인데요 이정도 금액이면 만족합니다",
        "userName": "박*준",
        "dateStr": "2026-06-29T10:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "아이폰 13 프로",
        "deviceStorage": "256GB",
        "transactionPrice": "46만원",
        "rating": 4,
        "text": "배터리 성능이 78%라 감가가 심할 줄 알고 기대 안 했는데 생각했던 것보다 훨씬 더 잘 쳐주셨어요! 테두리에 자잘한 스크래치 부분은 친절하게 사유 설명해주셔서 기분 좋게 납득했습니다. 다른 데보다 확실히 최고가로 쳐주시는 듯해요!",
        "userName": "이*서",
        "dateStr": "2026-06-29T11:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "아이폰 16 프로 맥스",
        "deviceStorage": "256GB",
        "transactionPrice": "129만원",
        "rating": 5,
        "text": "휴대폰 말짱해 보이긴하는데 소리가 아예안나서 감가 있었습니다 ㅠ 다행히 메인보드 문제가 아니라고해서 금액이 괜찮았네욥 처분 잘해주셔서 감사합니다!",
        "userName": "정*우",
        "dateStr": "2026-06-29T12:00:00+09:00",
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
