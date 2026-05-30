import urllib.request
import json
import urllib.error
from datetime import datetime, timezone

project_id = "rejeuphone"
api_key = "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc"
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"

print("Authenticating anonymously...")
auth_req = urllib.request.Request(auth_url, data=json.dumps({"returnSecureToken": True}).encode("utf-8"), headers={"Content-Type": "application/json"})
response = urllib.request.urlopen(auth_req)
auth_data = json.loads(response.read().decode("utf-8"))
id_token = auth_data["idToken"]

url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/reviews"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {id_token}"
}

doc_data = {
    "fields": {
        "deviceModel": {"stringValue": "갤럭시 A32"},
        "deviceStorage": {"stringValue": "128GB"},
        "transactionPrice": {"stringValue": "12만원"},
        "rating": {"integerValue": 5},
        "text": {"stringValue": "안써서 같은거 두개보냈는데 편리하네요. 입금 잘받았습니다."},
        "userName": {"stringValue": "최*노"},
        "isApproved": {"booleanValue": True},
        "createdAt": {"timestampValue": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    }
}

req = urllib.request.Request(url, data=json.dumps(doc_data).encode("utf-8"), headers=headers, method="POST")
try:
    res = urllib.request.urlopen(req)
    print(f"Uploaded review")
except urllib.error.HTTPError as e:
    print(f"Error: {e.code} - {e.read().decode('utf-8')}")
