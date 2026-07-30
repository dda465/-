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
    "deviceStorage": "256GB",
    "transactionPrice": "45만원",
    "rating": 5,
    "text": "당근마켓에서 중고폰 매입하신다길래 채팅으로 먼저 대략적인 단가 문의드리고 사무실로 직접 방문했습니다! 고가폰이라 택배로 보내는 게 왠지 찝찝해서 직접 찾아간 건데, 바로 그 자리에서 검수하시고 5분 만에 입금해 주시더라고요. 차감 이유도 눈앞에서 정확히 설명해 주셔서 100% 납득했습니다. 다음에도 폰 바꿀 때 직접 갈게요~",
    "userName": "김*수",
    "dateStr": "2026-06-11T14:30:00+09:00"
  },
  {
    "deviceModel": "아이폰 14",
    "deviceStorage": "128GB",
    "transactionPrice": "42만원",
    "rating": 5,
    "text": "15프로로 기변하면서 기존 폰 처분했어요. 중고 직거래는 사기꾼도 많고 스트레스 받아서 그냥 쉐라폰에 보냈는데, 우체국 택배도 무료지원되고 진행 과정도 카톡으로 다 알려주셔서 완전 안심됐습니다. 가격도 생각보다 잘 쳐주셔서 대만족입니다!",
    "userName": "이*은",
    "dateStr": "2026-06-11T16:45:00+09:00"
  },
  {
    "deviceModel": "갤럭시 Z 플립4",
    "deviceStorage": "256GB",
    "transactionPrice": "26만원",
    "rating": 5,
    "text": "이번에 S26으로 폰 바꾸면서 쓰던 플립 처분했어요. 힌지 쪽에 잔기스가 꽤 있어서 헐값 나올 줄 알았는데 방어를 꽤 잘해주시네요ㅎㅎ 번거롭게 개인 간 직거래하면서 시간 낭비하느니 맘 편하게 여기다 파는 게 훨씬 이득인 것 같습니다.",
    "userName": "최*원",
    "dateStr": "2026-06-12T09:20:00+09:00"
  },
  {
    "deviceModel": "아이폰 12",
    "deviceStorage": "128GB",
    "transactionPrice": "15만원",
    "rating": 5,
    "text": "액정이 완전 바사삭 깨져서 동네 매장에서는 아예 안 산다고 빠꾸 먹었던 폰인데ㅠㅠ 혹시나 해서 쉐라폰에 보내봤더니 다행히 매입을 해주시네요! 생각보다 가격도 잘 쳐주셔서 덕분에 꽁돈 생긴 기분이라 바로 치킨 시켜 먹었습니다ㅋㅋㅋ 감사합니다!",
    "userName": "정*민",
    "dateStr": "2026-06-12T10:40:00+09:00"
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
