"""
Pretendard CDN + body font-family 전체 페이지 적용 스크립트
"""
import re

PRETENDARD_LINK = '<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" rel="stylesheet">\n'

TARGET_FILES = [
    "index.html",
    "quote.html",
    "price-list.html",
    "reviews.html",
    "login.html",
    "signup.html",
    "mypage.html",
    "admin.html",
]

for fname in TARGET_FILES:
    try:
        with open(fname, "r", encoding="utf-8") as f:
            content = f.read()

        # 이미 pretendard CDN이 있으면 스킵 (jsdelivr)
        if "orioncactus/pretendard" in content:
            print(f"[SKIP] {fname} - already has Pretendard CDN")
            continue

        # Google Fonts Pretendard 있으면 교체
        if "fonts.googleapis.com/css2?family=Pretendard" in content:
            content = re.sub(
                r'<link[^>]*fonts\.googleapis\.com[^>]*Pretendard[^>]*>\s*',
                PRETENDARD_LINK,
                content
            )
            print(f"[REPLACED] {fname} - replaced Google Fonts Pretendard with jsDelivr")

        # Inter나 다른 Google Fonts 뒤에 Pretendard 추가
        elif "fonts.googleapis.com" in content:
            content = content.replace(
                "</head>",
                f"{PRETENDARD_LINK}</head>",
                1
            )
            print(f"[ADDED] {fname} - added Pretendard CDN before </head>")
        else:
            # 그냥 <head> 바로 뒤에 추가
            content = content.replace(
                "</head>",
                f"{PRETENDARD_LINK}</head>",
                1
            )
            print(f"[ADDED] {fname} - added Pretendard CDN (no existing Google Fonts)")

        with open(fname, "w", encoding="utf-8") as f:
            f.write(content)

    except FileNotFoundError:
        print(f"[MISSING] {fname}")
    except Exception as e:
        print(f"[ERROR] {fname}: {e}")

print("\n✅ Done!")
