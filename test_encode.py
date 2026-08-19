import os

file_path = "admin.html"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

print("Original text sample:", repr(text[150:200]))

for enc in ['cp949', 'cp1252', 'latin1']:
    try:
        # If the file was UTF-8 bytes mistaken for 'enc', then encoded back to UTF-8
        # We can reverse it by encoding text to 'enc' and decoding to 'utf-8'.
        # Since part of the characters might not map perfectly, we use replace or ignore.
        raw_bytes = text.encode(enc, errors='strict')
        fixed = raw_bytes.decode('utf-8', errors='strict')
        print(f"\n--- SUCCESS {enc} ---")
        print(fixed[150:200])
    except Exception as e:
        pass
        
    try:
        raw_bytes = text.encode(enc, errors='replace')
        fixed = raw_bytes.decode('utf-8', errors='replace')
        print(f"\n--- PARTIAL {enc} ---")
        print(fixed[150:250])
    except Exception as e:
        pass
