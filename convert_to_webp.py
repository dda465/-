import os
from PIL import Image

files = [
    ("hero_bg_realistic.png", "hero_bg_realistic.webp"),
    ("banner.png.png", "banner.webp"),
    ("starbucks_promo.png", "starbucks_promo.webp")
]

for src, dst in files:
    if os.path.exists(src):
        try:
            img = Image.open(src).convert("RGBA")
            img.save(dst, "webp", quality=85)
            print(f"Success: {src} -> {dst}")
        except Exception as e:
            print(f"Error converting {src}: {e}")
    else:
        print(f"File not found: {src}")
