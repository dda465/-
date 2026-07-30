"""Convert PNG images to WebP format and report file sizes."""
import os
from PIL import Image

BASE_DIR = r"c:\Users\PC\Desktop\used-phone-market"

images = [
    "danggeun_hero.png",
    "galaxy_s26_v3.png",
    "carrot_3d.png",
    "phones_3d.png",
    "gift_3d.png",
]

results = []

for png_name in images:
    png_path = os.path.join(BASE_DIR, png_name)
    webp_name = png_name.replace(".png", ".webp")
    webp_path = os.path.join(BASE_DIR, webp_name)
    
    png_size = os.path.getsize(png_path)
    
    if os.path.exists(webp_path):
        webp_size = os.path.getsize(webp_path)
        print(f"SKIP (already exists): {png_name} -> {webp_name}")
        print(f"  PNG: {png_size:,} bytes ({png_size/1024:.1f} KB)")
        print(f"  WebP: {webp_size:,} bytes ({webp_size/1024:.1f} KB)")
        print(f"  Savings: {(1 - webp_size/png_size)*100:.1f}%")
        results.append((png_name, webp_name, png_size, webp_size, True))
        continue
    
    img = Image.open(png_path)
    img.save(webp_path, "WEBP", quality=85)
    
    webp_size = os.path.getsize(webp_path)
    savings = (1 - webp_size / png_size) * 100
    
    print(f"CONVERTED: {png_name} -> {webp_name}")
    print(f"  PNG: {png_size:,} bytes ({png_size/1024:.1f} KB)")
    print(f"  WebP: {webp_size:,} bytes ({webp_size/1024:.1f} KB)")
    print(f"  Savings: {savings:.1f}%")
    results.append((png_name, webp_name, png_size, webp_size, False))

print("\n=== SUMMARY ===")
total_png = sum(r[2] for r in results)
total_webp = sum(r[3] for r in results)
print(f"Total PNG size:  {total_png:,} bytes ({total_png/1024:.1f} KB)")
print(f"Total WebP size: {total_webp:,} bytes ({total_webp/1024:.1f} KB)")
print(f"Total savings:   {(1 - total_webp/total_png)*100:.1f}%")
