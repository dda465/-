import re
import os

filepath = r"c:\Users\PC\Desktop\used-phone-market\index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Desktop Fixes
# Inject global CSS for the hero desktop fixes before the first <style> tag or anywhere safe.
desktop_fixes = '''
    /* Desktop Hero Image & Button Fixes */
    <style>
        .hero-slide .hero-image-area img {
            height: 100%;
            width: auto;
            object-fit: contain;
            object-position: right center;
            max-height: 400px;
        }
        .cta-group a.btn {
            min-width: 160px;
            white-space: nowrap;
            text-align: center;
        }
    </style>
'''
# Insert after <head>
content = content.replace('<head>', '<head>\n' + desktop_fixes)

# 2. Hide Slide 2 on Mobile
# Find Slide 2 and add 'pc-only' to it, or add to mobile CSS
# We already have a robust mobile CSS block injected, let's append to it:
# Find: .app-grid-section { display: none !important; }
mobile_slide2_hide = '''
            /* Hide Slide 2 (Review Banner) on Mobile */
            #hero-slider .hero-slide:nth-child(2) { display: none !important; }
'''
content = content.replace('.app-grid-section { display: none !important; }', '.app-grid-section { display: none !important; }' + mobile_slide2_hide)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed desktop banner images and hid Slide 2 on mobile.")
