"""
HTML 파일에서 PNG 이미지 참조를 WebP로 교체
"""
import re

FILE_MAP = {
    "real_phones_hero.png": "real_phones_hero.webp",
    "mobile_phones_hero.png": "mobile_phones_hero.webp",
    "real_starbucks_promo.png": "real_starbucks_promo.webp",
    "sr_logo.png": "sr_logo.webp",
    "logo_header.png": "logo_header.webp",
}

HTML_FILES = [
    "index.html",
    "quote.html",
    "price-list.html",
    "reviews.html",
    "login.html",
    "signup.html",
    "mypage.html",
    "admin.html",
]

for fname in HTML_FILES:
    try:
        with open(fname, "r", encoding="utf-8") as f:
            content = f.read()

        original = content
        for png, webp in FILE_MAP.items():
            content = content.replace(f'"{png}"', f'"{webp}"')
            content = content.replace(f"'{png}'", f"'{webp}'")

        if content != original:
            with open(fname, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[UPDATED] {fname}")
        else:
            print(f"[NO CHANGE] {fname}")

    except FileNotFoundError:
        print(f"[MISSING] {fname}")
    except Exception as e:
        print(f"[ERROR] {fname}: {e}")

print("\nDone!")
