import json
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# Initialize Firebase
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate('c:/Users/PC/Desktop/used-phone-market/serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print("Could not initialize with serviceAccountKey.json, using default app if possible", e)

db = firestore.client()

docs = db.collection('products').where('brand', '==', '삼성').stream()
series_list = set()
for doc in docs:
    data = doc.to_dict()
    if 'series' in data:
        series_list.add(data['series'])

print("Samsung Series in DB:")
for s in sorted(list(series_list)):
    print(s)
