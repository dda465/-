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
  # June 13
  {
    "deviceModel": "아이폰 13 프로",
    "deviceStorage": "128GB",
    "transactionPrice": "45만원",
    "rating": 5,
    "text": "외관에 기스가 조금 있어서 다른데서 견적 냈을 때 엄청 후려치기 당했거든요. 여기서는 솔직하게 차감 기준 다 설명해주고 합리적인 선에서 끝내주셔서 바로 팔았습니다. 택배 수거 기사님도 친절하시네요.",
    "userName": "이*윤",
    "dateStr": "2026-06-13T10:15:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S21",
    "deviceStorage": "256GB",
    "transactionPrice": "10만원",
    "rating": 4,
    "text": "화면에 잔상이 심해서 팔릴까 반신반의하며 보냈습니다. 그래도 매입이 된다니 다행이네요. 홈페이지에서 예상금액 바로 확인하고 우체국으로 보낼수 있어서 편했습니다.",
    "userName": "김*철",
    "dateStr": "2026-06-13T14:40:00+09:00"
  },
  # June 14
  {
    "deviceModel": "갤럭시 Z 폴드4",
    "deviceStorage": "256GB",
    "transactionPrice": "45만원",
    "rating": 5,
    "text": "폴드 특성상 필름 벗겨지고 힌지에 흠집이 많았음. 귀찮은 흥정 없이 카톡으로 진행상황 꼬박꼬박 알려주고, 검수 당일 입금까지 깔끔하게 처리됨. 직장인들한테 강력 추천함.",
    "userName": "최*훈",
    "dateStr": "2026-06-14T09:30:00+09:00"
  },
  {
    "deviceModel": "아이폰 14 플러스",
    "deviceStorage": "256GB",
    "transactionPrice": "52만원",
    "rating": 5,
    "text": "배터리 효율이 낮아서 걱정했는데 예상가에서 많이 안 깎이고 잘 쳐주셨어요!😆 다른 어플보다 쉐라폰이 단가가 높은 거 같아요. 진행도 빨라서 담번에도 여기서 팔려구용~~",
    "userName": "박*지",
    "dateStr": "2026-06-14T11:20:00+09:00"
  },
  {
    "deviceModel": "갤럭시 A53",
    "deviceStorage": "128GB",
    "transactionPrice": "7만원",
    "rating": 5,
    "text": "아이가 험하게 쓰던 폰이라 모서리 다 찍히고 난리였어요. 집에서 뒹구느니 팔자 싶어서 신청했는데, 방문 픽업 서비스 덕분에 한 발짝도 안 나가고 용돈 벌었네요. 감사합니다.",
    "userName": "정*희",
    "dateStr": "2026-06-14T16:10:00+09:00"
  },
  # June 15
  {
    "deviceModel": "갤럭시 S22",
    "deviceStorage": "256GB",
    "transactionPrice": "15만원",
    "rating": 5,
    "text": "뒷판 유리가 깨져서 수리비가 더 나올 거 같아 그냥 처분했습니다. 파손 폰도 매입해주는 줄 몰랐네요. 망가진 폰인데도 나름 치킨 몇 마리 값은 건져서 대만족합니다.",
    "userName": "강*우",
    "dateStr": "2026-06-15T10:05:00+09:00"
  },
  {
    "deviceModel": "아이폰 12 미니",
    "deviceStorage": "128GB",
    "transactionPrice": "12만원",
    "rating": 5,
    "text": "오래된 폰이라 서랍에 짱박아뒀다가 우연히 알게돼서 팔았음다. 절차가 너무 간편해서 진작 팔걸 그랬네요. 입금 속도 ㄹㅇ 번개임",
    "userName": "송*민",
    "dateStr": "2026-06-15T13:50:00+09:00"
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
