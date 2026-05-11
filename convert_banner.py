import os
from PIL import Image

def process():
    try:
        img = Image.open('banner.png.png').convert('RGBA')
    except Exception as e:
        print("Error:", e)
        return
        
    target_w, target_h = 1300, 192
    
    # Create transparent canvas centered
    canvas = Image.new('RGBA', (target_w, target_h), (255, 255, 255, 0))
    
    scale = min(target_w / img.width, target_h / img.height)
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)
    
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    x = (target_w - new_w) // 2
    y = (target_h - new_h) // 2
    
    canvas.paste(resized, (x, y), resized)
    canvas.save('KG_inicis_banner_1300x192.png', 'PNG')
    print("Success")

if __name__ == '__main__':
    process()
