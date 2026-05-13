import urllib.request
import json
import urllib.error

project_id = "rejeuphone"
api_key = "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc"
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"

print("Authenticating anonymously...")
auth_req = urllib.request.Request(auth_url, data=json.dumps({"returnSecureToken": True}).encode("utf-8"), headers={"Content-Type": "application/json"})
response = urllib.request.urlopen(auth_req)
auth_data = json.loads(response.read().decode("utf-8"))
id_token = auth_data["idToken"]
print("Authenticated successfully.")

url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/reviews?pageSize=100"

headers = {
    "Authorization": f"Bearer {id_token}",
    "Content-Type": "application/json"
}

req = urllib.request.Request(url, headers=headers)
response = urllib.request.urlopen(req)
data = json.loads(response.read().decode("utf-8"))

docs = data.get("documents", [])

target_dates = {
    "박*진": "2026-05-03T05:30:00Z",
    "이*훈": "2026-05-04T01:15:00Z",
    "김*영": "2026-05-05T07:45:00Z",
    "최*우": "2026-05-06T02:20:00Z",
    "정*지": "2026-05-07T04:10:00Z",
    "강*민": "2026-05-08T00:40:00Z",
    "조*석": "2026-05-09T09:05:00Z",
    "윤*아": "2026-05-10T06:55:00Z",
    "송*호": "2026-05-11T03:30:00Z",
    "한*숙": "2026-05-12T01:00:00Z",
    "백*은": "2026-05-13T08:20:00Z",
}

for doc in docs:
    name = doc["name"]
    fields = doc.get("fields", {})
    user_name = fields.get("userName", {}).get("stringValue", "")
    
    if user_name in target_dates:
        new_time = target_dates[user_name]
        
        # update just the createdAt field
        update_url = f"https://firestore.googleapis.com/v1/{name}?updateMask.fieldPaths=createdAt"
        
        # The document to patch must contain the fields
        update_data = {
            "name": name,
            "fields": {
                "createdAt": {"timestampValue": new_time}
            }
        }
        
        update_req = urllib.request.Request(update_url, data=json.dumps(update_data).encode("utf-8"), headers=headers, method="PATCH")
        try:
            update_res = urllib.request.urlopen(update_req)
            print(f"Updated {user_name} to {new_time}")
        except urllib.error.HTTPError as e:
            print(f"Failed to update {user_name}: {e.read().decode()}")

print("Done updating dates")
