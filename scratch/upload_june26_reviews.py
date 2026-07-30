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

# 2. Define the reviews to upload
# June 26 reviews (latest -> oldest): 3번, 2번, 1번
custom_reviews = [
    {
        "deviceModel": "아이폰 13 미니",
        "deviceStorage": "128GB",
        "transactionPrice": "24만원",
        "rating": 5,
        "text": "중학생때부터 아이폰13미니 계속써왔어용.. 이번에 팔았는데 입금 빠르네요 진짜...!!! ㅠㅠ 편의점 택배로 저녁쯤?에 보냈는데 담날 오후에 바로 돈 들어옴!! 당근 올리면 맨날 네고 요청 오고 질질 끌어서 싫었는데 여긴 완전 신속하고 깔끔해서 넘 좋음요! 담에 또 쓸게요!",
        "userName": "김*은",
        "dateStr": "2026-06-26T10:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "갤럭시 Z 플립5",
        "deviceStorage": "256GB",
        "transactionPrice": "31만원",
        "rating": 5,
        "text": "화면이 안나와서 초기화를 못해가지고 아이디 알려드리고 부탁드렸는데 초기화 해주셔서 감사합니다.! 개인정보솔루션보고서인가? 그것도 받았네요",
        "userName": "한*민",
        "dateStr": "2026-06-26T11:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "갤럭시 노트20",
        "deviceStorage": "256GB",
        "transactionPrice": "18만원",
        "rating": 5,
        "text": "휴대폰을 새로 바꾸면서 쓰던 오래된 노트를 처분하려는데, 나이가 있다 보니 이런 비대면 거래나 택배 접수가 생소하고 어려웠습니다. 다행히 카카오톡으로 물어보니 아가씨가 사진까지 보내주며 참 친절하고 쉽게 설명해 주어 무사히 잘 보냈네요. 검사 끝나고 정산금도 당일에 통장으로 바로 입금해 주시니 믿음이 가고 아주 고맙습니다. 번창하십시오.",
        "userName": "박*순",
        "dateStr": "2026-06-26T12:00:00+09:00",
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
