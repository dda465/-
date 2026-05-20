import urllib.request
import json
import urllib.error
import datetime

project_id = "rejeuphone"
api_key = "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc"
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"

print("Authenticating anonymously...")
auth_req = urllib.request.Request(auth_url, data=json.dumps({"returnSecureToken": True}).encode("utf-8"), headers={"Content-Type": "application/json"})
response = urllib.request.urlopen(auth_req)
auth_data = json.loads(response.read().decode("utf-8"))
id_token = auth_data["idToken"]
print("Authenticated successfully.")

url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/quotes"

quote = {
    "brand": {"stringValue": "Samsung"},
    "model": {"stringValue": "갤럭시 S24 울트라"},
    "customerName": {"stringValue": "테스트"},
    "customerPhone": {"stringValue": "01000000000"},
    "price": {"integerValue": "1000000"},
    "status": {"stringValue": "검수완료"},
    "timestamp": {"stringValue": datetime.datetime.now().isoformat()},
    "inspectionData": {
        "mapValue": {
            "fields": {
                "finalPrice": {"integerValue": "950000"},
                "faults": {
                    "arrayValue": {
                        "values": [
                            {"stringValue": "전면 파손/찍힘"},
                            {"stringValue": "테두리 미세 기스"}
                        ]
                    }
                },
                "details": {"stringValue": "전면 우측 상단 1cm 스크래치 (-30,000원)\n테두리 찍힘 2곳 (-20,000원)"},
                "comment": {"stringValue": "기능상 이상은 없으나 외관 찍힘 및 스크래치로 인해 일부 차감 진행되었습니다."},
                "bankName": {"stringValue": "국민은행"},
                "accountNum": {"stringValue": "123456-12-123456"},
                "accountHolder": {"stringValue": "홍길동"}
            }
        }
    }
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {id_token}"
}

data = json.dumps({"fields": quote}).encode("utf-8")
req = urllib.request.Request(url, data=data, headers=headers)
try:
    response = urllib.request.urlopen(req)
    print("Successfully added test quote.")
except urllib.error.HTTPError as e:
    print(f"Failed to add: {e.read().decode()}")
