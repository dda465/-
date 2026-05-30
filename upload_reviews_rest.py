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
    "deviceModel": "아이폰 13 미니",
    "deviceStorage": "128GB",
    "transactionPrice": "22만원",
    "rating": 5,
    "text": "배터리 효율 78퍼라서 당근에서도 안팔리던거 걍 쉐라폰에 던졌는데 생각보다 넘 많이받았어여 ㅠㅠㅠ 택배보내고 담날 바로 입금완료ㅋㅋ",
    "userName": "이*지",
    "dateStr": "2026-05-19T11:20:00+09:00"
  },
  {
    "deviceModel": "갤럭시 Z 폴드 4",
    "deviceStorage": "512GB",
    "transactionPrice": "28만원",
    "rating": 4,
    "text": "폴드 힌지 부분에 기스가 좀 있어서 다른 업체에서는 차감을 심하게 불렀는데, 쉐라폰은 합리적으로 차감해주시네요. 일 처리도 빠르고 만족스럽습니다. 다음 폰 바꿀 때도 이용하겠습니다.",
    "userName": "박*훈",
    "dateStr": "2026-05-19T15:45:00+09:00"
  },
  {
    "deviceModel": "아이폰 14 프로",
    "deviceStorage": "256GB",
    "transactionPrice": "55만원",
    "rating": 5,
    "text": "업무용으로 쓰다가 15로 넘어가면서 팔았습니다. 모서리 찍힘이 한 군데 있었는데 A급-B급 사이로 잘 쳐주셨네요. 다른업체보다 낫습니다.",
    "userName": "김*석",
    "dateStr": "2026-05-20T10:15:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S22",
    "deviceStorage": "256GB",
    "transactionPrice": "22만원",
    "rating": 5,
    "text": "아들내미가 폰 바꿔주면서 쓰던거 팔아준다고 해서 보냈는데, 우체국 택배로 보내고 금방 돈 들어왔다고 하네요. 세상 참 좋아졌습니다 번창하세요~",
    "userName": "최*숙",
    "dateStr": "2026-05-20T13:30:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S23 울트라",
    "deviceStorage": "512GB",
    "transactionPrice": "65만원",
    "rating": 5,
    "text": "잔상 살짝 있어서 걱정했는데 예상했던 금액 딱 맞춰서 입금됨. 카톡으로 진행상황 바로바로 알려줘서 안심되고 개꿀띠",
    "userName": "정*호",
    "dateStr": "2026-05-20T17:50:00+09:00"
  },
  {
    "deviceModel": "아이폰 12",
    "deviceStorage": "128GB",
    "transactionPrice": "18만원",
    "rating": 5,
    "text": "집 서랍에 몇년 방치하던 폰인데 전원 켜지길래 혹시나 하고 보내봤어요ㅎㅎ 꽁돈 생긴 기분이라 주말에 소고기 사먹으려구요!! 친절한 상담 감사합니다~",
    "userName": "강*윤",
    "dateStr": "2026-05-21T14:10:00+09:00"
  },
  {
    "deviceModel": "갤럭시 Z 플립 4",
    "deviceStorage": "256GB",
    "transactionPrice": "16만원",
    "rating": 4,
    "text": "액정 가운데 줄이 살짝 갔지만 터치는 잘 되는 폰이었습니다. 동네 폰가게는 안받아준다고 해서 인터넷 찾아보고 보냈는데, 수거부터 입금까지 깔끔하네요.",
    "userName": "송*철",
    "dateStr": "2026-05-21T16:25:00+09:00"
  },
  {
    "deviceModel": "아이폰 15 프로",
    "deviceStorage": "256GB",
    "transactionPrice": "115만원",
    "rating": 5,
    "text": "해외가게되서 급하게 처분해야했는데 당일 바로 견적내주고 입금해줘서 살았어여 ㅠㅠㅠ 기스 하나도 없는 S급이었는데 진짜 홈페이지 최고가 그대로 주심!!",
    "userName": "윤*아",
    "dateStr": "2026-05-22T09:40:00+09:00"
  },
  {
    "deviceModel": "갤럭시 S21",
    "deviceStorage": "256GB",
    "transactionPrice": "13만원",
    "rating": 4,
    "text": "외관이 많이 헐어서 B급 이하로 생각했는데 생각보다 잘 쳐주었습니다. 귀찮게 직거래 할 필요 없이 박스에 넣어서 문앞에 두니 알아서 가져가고 편합니다 허허",
    "userName": "조*현",
    "dateStr": "2026-05-22T13:15:00+09:00"
  },
  {
    "deviceModel": "아이폰 13 미니",
    "deviceStorage": "256GB",
    "transactionPrice": "21만원",
    "rating": 5,
    "text": "미니 단종돼서 나름 방어 잘 된다고 들었는데 다른 곳은 매입가 똥망이더라구요 ㅡㅡ 쉐라폰이 젤 높아서 보냈는데 트집잡는거 없이 깔끔하게 쿨거래 굿입니다",
    "userName": "한*민",
    "dateStr": "2026-05-22T15:50:00+09:00"
  }
]

def format_time(date_str):
    dt = datetime.fromisoformat(date_str)
    dt_utc = dt.astimezone(timezone.utc)
    return dt_utc.strftime('%Y-%m-%dT%H:%M:%S.000Z')

for rev in raw_reviews:
    doc = {
        "deviceModel": {"stringValue": rev["deviceModel"]},
        "deviceStorage": {"stringValue": rev["deviceStorage"]},
        "transactionPrice": {"stringValue": rev["transactionPrice"]},
        "rating": {"integerValue": str(rev["rating"])},
        "text": {"stringValue": rev["text"]},
        "userName": {"stringValue": rev["userName"]},
        "userId": {"stringValue": "system_generated"},
        "createdAt": {"timestampValue": format_time(rev["dateStr"])},
        "updatedAt": {"timestampValue": format_time(rev["dateStr"])}
    }
    
    data = json.dumps({"fields": doc}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        response = urllib.request.urlopen(req)
        print(f"Successfully added review for {rev['userName']}")
    except urllib.error.HTTPError as e:
        print(f"Failed to add review: {e.read().decode()}")

print("All done.")
