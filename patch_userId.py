import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = r"userId:\s*auth\.currentUser\s*\?\s*auth\.currentUser\.uid\s*:\s*'anonymous',"
replacement = """userId: (() => {
                if (auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
                try {
                    const localUser = JSON.parse(localStorage.getItem('user_info'));
                    if (localUser && localUser.uid) return localUser.uid;
                } catch(e) {}
                return 'anonymous';
            })(),"""

new_content, count = re.subn(target, replacement, content)

if count > 0:
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully replaced userId logic.")
else:
    print("Failed to find target in script.js")
