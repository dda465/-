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
    "deviceModel": "아이폰 15 프로",
    "deviceStorage": "256GB",
    "transactionPrice": "76만원",
    "rating": 5,
    "text": "거의 새 폰이라 혹시 파손될까 봐 뽁뽁이 엄청 감아서 보냈습니다 고가라서 택배 거래가 살짝 걱정됐는데 수령하시자마자 바로 확인 톡 주시고 기스 하나 없다고 단가표 그대로 입금해 주셨어요 응대부터 입금까지 시스템이 아주 깔끔하고 믿음직스럽네요",
    "userName": "강*윤",
    "dateStr": "2026-06-09T09:30:00+09:00"
  },
  {
    "deviceModel": "갤럭시 A23",
    "deviceStorage": "128GB",
    "transactionPrice": "5만원",
    "rating": 5,
    "text": "초등학생 아들내미가 하도 험하게 써서 액정도 좀 깨지고 상태가 엉망이었네요 동네 마켓에서는 무료 나눔 수준 아니면 안 팔릴 거 같아서 속는 셈 치고 보냈는데 생각보다 치킨값은 나오게 쳐주셔서 알뜰하게 잘 팔았습니다",
    "userName": "이*희",
    "dateStr": "2026-06-09T10:45:00+09:00"
  },
  {
    "deviceModel": "갤럭시 Z 폴드5",
    "deviceStorage": "512GB",
    "transactionPrice": "57만원",
    "rating": 5,
    "text": "업무용으로 쓰다가 무거워서 처분함 바빠서 직거래 나갈 시간도 없고 흥정하기도 귀찮았는데 여기는 방문 수거 신청도 되고 검수 끝나면 당일 바로 쏴주니까 매우 편함 차감도 합리적인 선에서 끝났고 다음번 기기 변경할 때도 이용할 예정임",
    "userName": "정*우",
    "dateStr": "2026-06-09T12:00:00+09:00"
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
