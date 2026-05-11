import re

file_path = "c:/Users/PC/Desktop/used-phone-market/admin.js"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# Fix literal "확인" where it replaced "?"
text = re.sub(r' 확인 ', ' ? ', text)
text = re.sub(r'\(data\.timestamp 확인', '(data.timestamp ?', text)
text = re.sub(r'확인 \'selected\'', '? \'selected\'', text)
text = text.replace("data.storageOptions 확인", "data.storageOptions ?")
text = text.replace("data.createdAt 확인", "data.createdAt ?")

# Fix mangled strings correctly
text = text.replace("확인", "")  # Removes orphaned '확인'
text = text.replace("확인", "")    # Removes remaining '확인' if used as padding
# But wait! '확인' is an actual Korean word (e.g., 확인중). Removing it globally is dangerous.

# Let's restore from original file or just fix exactly what's broken.
