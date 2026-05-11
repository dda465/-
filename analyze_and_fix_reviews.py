import urllib.request
import json
from datetime import datetime

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

fetch_req = urllib.request.Request(url, headers=headers)
fetch_res = urllib.request.urlopen(fetch_req)
docs_data = json.loads(fetch_res.read().decode("utf-8"))

docs = docs_data.get("documents", [])

parsed_docs = []

# 1. Normalize and find exact duplicates (ignoring whitespace)
import re

seen_texts = set()
duplicates_to_delete = []

for doc in docs:
    fields = doc.get("fields", {})
    text = fields.get("text", {}).get("stringValue", "")
    normalized_text = re.sub(r'\s+', ' ', text).strip()
    
    # Try to parse createdAt
    created_at = None
    raw_date = None
    if "createdAt" in fields:
        date_field = fields["createdAt"]
        if "timestampValue" in date_field:
            raw_date = date_field["timestampValue"]
        elif "stringValue" in date_field:
            raw_date = date_field["stringValue"]
            
        if raw_date:
            try:
                # e.g., "2026-04-25T05:20:00Z"
                created_at = datetime.fromisoformat(raw_date.replace('Z', '+00:00')).timestamp()
            except Exception:
                pass
                
    if not created_at:
        created_at = 0
        
    doc_id = doc["name"].split("/")[-1]
    
    if normalized_text in seen_texts:
        duplicates_to_delete.append(doc_id)
    else:
        seen_texts.add(normalized_text)
        parsed_docs.append({
            "id": doc_id,
            "text": normalized_text,
            "user": fields.get("userName", {}).get("stringValue", ""),
            "date": raw_date,
            "ts": created_at,
            "raw_doc": doc
        })

print(f"Total documents: {len(docs)}")
print(f"Duplicates to delete: {len(duplicates_to_delete)}")

# Delete duplicates
for doc_id in duplicates_to_delete:
    doc_name = f"projects/{project_id}/databases/(default)/documents/reviews/{doc_id}"
    del_req = urllib.request.Request(f"https://firestore.googleapis.com/v1/{doc_name}", headers=headers, method="DELETE")
    try:
        urllib.request.urlopen(del_req)
        print(f"Deleted duplicate: {doc_id}")
    except Exception as e:
        print(f"Failed to delete {doc_id}: {e}")

# Fix sorting issue: Any document with createdAt as stringValue instead of timestampValue needs to be updated.
for pd in parsed_docs:
    fields = pd["raw_doc"]["fields"]
    needs_update = False
    
    if "createdAt" in fields and "stringValue" in fields["createdAt"]:
        # Convert stringValue to timestampValue
        date_str = fields["createdAt"]["stringValue"]
        fields["createdAt"] = {"timestampValue": date_str}
        needs_update = True
    elif "createdAt" not in fields:
        # Give it a default date if missing
        fields["createdAt"] = {"timestampValue": "2026-04-01T00:00:00Z"}
        needs_update = True
        
    if needs_update:
        doc_name = pd["raw_doc"]["name"]
        update_url = f"https://firestore.googleapis.com/v1/{doc_name}?updateMask.fieldPaths=createdAt"
        data = json.dumps({"fields": {"createdAt": fields["createdAt"]}}).encode("utf-8")
        req = urllib.request.Request(update_url, data=data, headers=headers, method="PATCH")
        try:
            urllib.request.urlopen(req)
            print(f"Updated createdAt to timestampValue for {pd['id']}")
        except Exception as e:
            print(f"Failed to update {pd['id']}: {e}")

# Sort remaining docs
parsed_docs.sort(key=lambda x: x["ts"], reverse=True)

import sys
sys.stdout.reconfigure(encoding='utf-8')

print("\n--- Remaining Reviews (Sorted by Date DESC) ---")
for i, pd in enumerate(parsed_docs[:20]): # Show top 20
    print(f"{i+1}. Date: {pd['date']} | User: {pd['user']}")
    print(f"   {pd['text'][:60]}...")
