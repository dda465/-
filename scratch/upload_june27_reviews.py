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
# June 27 reviews (latest -> oldest): 3번, 2번, 1번
custom_reviews = [
    {
        "deviceModel": "갤럭시 Z 플립5",
        "deviceStorage": "256GB",
        "transactionPrice": "32만원",
        "rating": 5,
        "text": "개인 중고거래는 시간 약속 잡기도 번거롭고 스트레스 받는데 비대면으로 편하게 처리해서 너무 좋네요! 집 앞 편의점에 맡기자마자 배송비도 선지급해주시고 다음날 검수 끝나자마자 입금까지 일사천리네요 ㅋㅋㅋ 일처리가 확실하고 엄청 빨라요!",
        "userName": "임*현",
        "dateStr": "2026-06-27T10:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "아이폰 15 프로",
        "deviceStorage": "128GB",
        "transactionPrice": "69만원",
        "rating": 4,
        "text": "카메라 링 쪽에 아주 미세하게 찍힘이 하나 있어서 예상한 금액보다는 2만원 정도 감가되서 쬐끔 아쉽지만 ㅠㅠ 그래도 검수 담당자분이 전화 오셔서 친절하게 사유를 조목조목 짚어주셔서 신뢰가 갔습니다. 다른 업체보다 가격도 젤 잘 쳐주는 것 같아요!",
        "userName": "황*아",
        "dateStr": "2026-06-27T11:00:00+09:00",
        "isVerified": True
    },
    {
        "deviceModel": "아이폰 11",
        "deviceStorage": "64GB",
        "transactionPrice": "12만원",
        "rating": 5,
        "text": "서랍에 박아두고 방치하던 아이폰11 팔았는데 12만원이나 용돈 벌었네요 ㅎㅎ 화면에 잔상도 좀 있고 낡아서 안 팔릴 줄 알았는데 개이득 ㅋㅋㅋ 공장 초기화도 이중 삼중으로 다 완료해서 리포트까지 톡으로 보내주시니 개인정보 털릴 걱정 없어서 맘이 푹 놓입니다!",
        "userName": "권*준",
        "dateStr": "2026-06-27T12:00:00+09:00",
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
