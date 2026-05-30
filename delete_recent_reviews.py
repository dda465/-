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

url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/reviews"

headers = {
    "Authorization": f"Bearer {id_token}"
}

req = urllib.request.Request(url, headers=headers, method="GET")
try:
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode('utf-8'))
    for doc in data.get("documents", []):
        fields = doc.get("fields", {})
        if fields.get("userName", {}).get("stringValue") in ["이*호", "김*지"]:
            doc_name = doc["name"]
            delete_req = urllib.request.Request(f"https://firestore.googleapis.com/v1/{doc_name}", headers=headers, method="DELETE")
            urllib.request.urlopen(delete_req)
            print(f"Deleted {doc_name}")
except Exception as e:
    print(e)

print("Done")
