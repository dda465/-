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
    "deviceModel": "아이폰 14",
    "deviceStorage": "128GB",
    "transactionPrice": "44만원",
    "rating": 5,
    "text": "폰 팔때 개인정보 찝찝해서 안팔고 모아뒀는데 데이터 싹 지워준다고 해서 걍 보냄요. 입금 바로바로 꽂히고 일처리 깔끔함. 담에도 폰바꿀때 이용할듯.",
    "userName": "정*훈",
    "dateStr": "2026-05-25T11:20:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S22 울트라",
    "deviceStorage": "256GB",
    "transactionPrice": "45만원",
    "rating": 5,
    "text": "서랍에 굴러다니던 식구들 옛날폰 3개 싹다 모아서 택배 보냈어요~^^ 혹시나 섞여서 정산될까봐 걱정했는데 기기마다 얼마인지 다 따로따로 계산해서 친절하게 알려주시네요~~ 굳이 동네 금은방 안가고 쉐라폰 쓰길 잘한듯요ㅎㅎ 수고하세요~~!!",
    "userName": "김*진",
    "dateStr": "2026-05-25T15:30:00+09:00"
  },
  {
    "deviceModel": "아이폰 13",
    "deviceStorage": "256GB",
    "transactionPrice": "38만원",
    "rating": 5,
    "text": "자급제 사고 기존폰 보상판매 하려다가 현금으로 바로 받는게 금액적으로 더 유리해서 요기로 보냈음. 뒷판 깨진거 치고는 가격 방어 잘 된 편이네요. 절차 복잡한거 없고 폰 도착하자마자 바로 입금처리됨.",
    "userName": "한*지",
    "dateStr": "2026-05-26T10:15:00+09:00"
  },
  {
    "deviceModel": "갤럭시 Z플립5",
    "deviceStorage": "256GB",
    "transactionPrice": "61만원",
    "rating": 5,
    "text": "금요일 새벽에 카톡 문의 남겼는데 바로 답장오셔서 놀람 ㄷㄷ 월욜오전에 편택 부쳤더니 오늘 오전에 바로 돈들어왔네요ㅋㅋ 일처리 속도 진짜 미쳤음 ㄹㅇ 개빠름 강추",
    "userName": "최*혁",
    "dateStr": "2026-05-26T14:40:00+09:00"
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
