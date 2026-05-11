import codecs

# Read with errors='replace' to force it into a Python string despite garbled bytes
with open("quote.html", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

# Write it back out as pure UTF-8
with codecs.open("quote.html", "w", encoding="utf-8") as f:
    f.write(content)

print("Standardized quote.html encoding to utf-8.")
