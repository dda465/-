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
    "Content-Type": "application/json",
    "Authorization": f"Bearer {id_token}"
}

print("Fetching all reviews...")
try:
    fetch_req = urllib.request.Request(url, headers=headers)
    fetch_res = urllib.request.urlopen(fetch_req)
    docs_data = json.loads(fetch_res.read().decode("utf-8"))
    
    seen_texts = set()
    duplicates_deleted = 0
    
    if "documents" in docs_data:
        for doc in docs_data["documents"]:
            fields = doc.get("fields", {})
            text = fields.get("text", {}).get("stringValue", "")
            doc_name = doc["name"]
            
            if text in seen_texts:
                # This is a duplicate, delete it
                print(f"Found duplicate: {text[:30]}...")
                del_req = urllib.request.Request(f"https://firestore.googleapis.com/v1/{doc_name}", headers=headers, method="DELETE")
                try:
                    urllib.request.urlopen(del_req)
                    duplicates_deleted += 1
                    print(f"Deleted duplicate document: {doc_name.split('/')[-1]}")
                except Exception as e:
                    print(f"Failed to delete {doc_name}: {e}")
            else:
                seen_texts.add(text)
                
    print(f"Process complete. Total duplicates deleted: {duplicates_deleted}")

except Exception as e:
    print(f"Error fetching/deleting: {e}")
