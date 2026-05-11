import codecs

file_path = "c:/Users/PC/Desktop/used-phone-market/admin.html"

# Read with error replacement to salvage characters
with open(file_path, "rb") as f:
    raw = f.read()

# Try to decode
text = raw.decode("utf-8", errors="replace")

# Write it back cleanly
with codecs.open(file_path, "w", encoding="utf-8") as f:
    f.write(text)
