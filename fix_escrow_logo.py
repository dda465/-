import os

def fix_logo(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace the old logo image with the new one
    new_content = content.replace('KG_inicis_banner_192.png', 'sr_logo.png')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Fixed logo in {filepath}")

fix_logo('index.html')
fix_logo('prototype_natural.html')
