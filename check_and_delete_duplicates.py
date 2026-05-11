import urllib.request
import json
import urllib.error
import sys

# Windows 환경 출력 인코딩 문제 해결
sys.stdout.reconfigure(encoding='utf-8')

project_id = "rejeuphone"
api_key = "AIzaSyCMYsqtZzHnXjMGvdum4l3SVn_MG78m0Nc"
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}"

auth_req = urllib.request.Request(auth_url, data=json.dumps({"returnSecureToken": True}).encode("utf-8"), headers={"Content-Type": "application/json"})
response = urllib.request.urlopen(auth_req)
auth_data = json.loads(response.read().decode("utf-8"))
id_token = auth_data["idToken"]

url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/reviews?pageSize=300"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {id_token}"
}

try:
    fetch_req = urllib.request.Request(url, headers=headers)
    fetch_res = urllib.request.urlopen(fetch_req)
    docs_data = json.loads(fetch_res.read().decode("utf-8"))
    
    if "documents" in docs_data:
        reviews = docs_data["documents"]
        print(f"Total reviews fetched: {len(reviews)}")
        
        # Count occurrences of each text
        text_counts = {}
        for doc in reviews:
            fields = doc.get("fields", {})
            text = fields.get("text", {}).get("stringValue", "")
            user = fields.get("userName", {}).get("stringValue", "")
            doc_id = doc["name"].split("/")[-1]
            
            if text not in text_counts:
                text_counts[text] = []
            text_counts[text].append({"id": doc_id, "user": user})
            
        duplicate_texts = {k: v for k, v in text_counts.items() if len(v) > 1}
        print(f"\nFound {len(duplicate_texts)} unique texts that have duplicates.")
        
        for text, docs in duplicate_texts.items():
            print(f"\nText snippet: {text[:50]}...")
            print(f"Occurrences: {len(docs)}")
            for i, doc in enumerate(docs):
                print(f"  {i+1}. User: {doc['user']}, ID: {doc['id']}")
                
                # Delete all but the first one
                if i > 0:
                    doc_name = f"projects/{project_id}/databases/(default)/documents/reviews/{doc['id']}"
                    del_req = urllib.request.Request(f"https://firestore.googleapis.com/v1/{doc_name}", headers=headers, method="DELETE")
                    try:
                        urllib.request.urlopen(del_req)
                        print(f"  -> Deleted duplicate: {doc['id']}")
                    except Exception as e:
                        print(f"  -> Failed to delete {doc['id']}: {e}")
                        
        print("\nCleanup complete.")
    else:
        print("No reviews found.")

except Exception as e:
    print(f"Error fetching/deleting: {e}")
