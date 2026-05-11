"""
이미지 WebP 변환 스크립트
Pillow 라이브러리 필요: pip install Pillow
"""
import os
from PIL import Image

TARGETS = [
    ("real_phones_hero.png", "real_phones_hero.webp", 85),
    ("mobile_phones_hero.png", "mobile_phones_hero.webp", 85),
    ("real_starbucks_promo.png", "real_starbucks_promo.webp", 85),
    ("sr_logo.png", "sr_logo.webp", 90),
    ("banner.webp", None, None),  # already webp
]

# 대용량 파일
BIG_FILES = [
    ("banner.png.png", "banner.webp", 80),
    ("hero_bg_realistic.png", "hero_bg_realistic.webp", 80),
    ("logo_header.png", "logo_header.webp", 85),
]

ALL = TARGETS + BIG_FILES

converted = []
errors = []

for src, dst, quality in ALL:
    if dst is None:
        print(f"[SKIP] {src} - already webp")
        continue
    if not os.path.exists(src):
        print(f"[MISSING] {src}")
        continue
    if os.path.exists(dst):
        orig = os.path.getsize(src)
        new = os.path.getsize(dst)
        print(f"[EXISTS] {dst} ({orig//1024}KB -> {new//1024}KB)")
        continue
    try:
        img = Image.open(src)
        if img.mode in ('RGBA', 'LA'):
            img.save(dst, 'WEBP', quality=quality, method=6, lossless=False)
        else:
            img = img.convert('RGB')
            img.save(dst, 'WEBP', quality=quality, method=6)
        orig = os.path.getsize(src)
        new = os.path.getsize(dst)
        saving = int((1 - new/orig) * 100)
        print(f"[OK] {src} ({orig//1024}KB) -> {dst} ({new//1024}KB) | -{saving}%")
        converted.append((src, dst))
    except Exception as e:
        print(f"[ERROR] {src}: {e}")
        errors.append(src)

print(f"\nConverted: {len(converted)} / Errors: {len(errors)}")
