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
    "deviceModel": "아이폰 11",
    "deviceStorage": "128GB",
    "transactionPrice": "15만원",
    "rating": 5,
    "text": "집에서 영상용으로 쓰던 옛날 폰 보냈어용ㅋㅋ 배터리 사이클이 1500회 넘어서 차감이 되긴 했지만 나름 잘 받은 거 같아요! 어차피 버릴까 하던 건데 치킨값 벌어서 기분 좋네요 번창하세요!!😆",
    "userName": "박*연",
    "dateStr": "2026-06-05T09:30:00+09:00"
  },
  {
    "deviceModel": "갤럭시 Z 플립4",
    "deviceStorage": "256GB",
    "transactionPrice": "28만원",
    "rating": 5,
    "text": "플립 종특인 액정 가운데 갈라짐 때문에 팔았음. 타사 대비 단가 잘 쳐주는 편이고 택배 수거부터 입금까지 이틀이면 다 끝남. 귀찮은 거 딱 질색인데 카톡으로 안내 다 해주고 알아서 해주니 편함.",
    "userName": "정*호",
    "dateStr": "2026-06-05T11:15:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S24 울트라",
    "deviceStorage": "256GB",
    "transactionPrice": "82만원",
    "rating": 5,
    "text": "떨어뜨려서 모서리가 푹 파이는 바람에 B급 판정 받았습니다 ㅠㅠ 속 쓰리긴 한데 솔직히 직거래로 팔려 해도 제값 받기 힘든 상태라 그냥 넘겼어요. 그래도 차감 기준을 꼼꼼하게 사진으로 설명해 주시니까 납득이 가더라고요. 일 처리는 확실하고 빠릅니다.",
    "userName": "김*진",
    "dateStr": "2026-06-05T14:40:00+09:00"
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
