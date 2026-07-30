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
# June 25 reviews (latest -> oldest): 3번, 2번, 1번
custom_reviews = [
    {
        "deviceModel": "아이폰 12",
        "deviceStorage": "128GB",
        "transactionPrice": "21만원",
        "rating": 5,
        "text": "번장은 올려봤는데 쓸데없이 찔러보는 사람만 너무 많고 계속깎아달래서 쉐라폰으로 신청했습니다! 편의점으로 발송하자마자 배송비도 바로먼저 보내주셨어요~~~ 폰 검수 끝나자마자 입금되니까 편리하고 좋았습니다!!!!",
        "userName": "정*현",
        "dateStr": "2026-06-25T10:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "갤럭시 퀀텀2",
        "deviceStorage": "128GB",
        "transactionPrice": "11만원",
        "rating": 4,
        "text": "간편접수 제가 생각한 것보다는 3만원 정도 감가되었어요 ㅠㅠ 그래도 다른 중고폰 수거하는 업체들보다 훨씬 가격을 잘 쳐주는 편이네요. 검수 결과도 친절하게 잘 설명해주셔서 인정하고 정산 받았습니다!",
        "userName": "임*수",
        "dateStr": "2026-06-25T11:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "갤럭시 노트20 울트라",
        "deviceStorage": "256GB",
        "transactionPrice": "25만원",
        "rating": 5,
        "text": "잘몰랐는데 화면 넘어가고 남아있는게 잔상이라더라구요.. 그래도 단가가 높아서 그런지 잘 받았어용 ㅎㅎ 깜빡하고 초기화 못했는데 초기화 해주셔서 감사합니다ㅎㅎㅎ",
        "userName": "최*우",
        "dateStr": "2026-06-25T12:00:00+09:00",
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
