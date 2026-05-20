import glob
import re

old_css_clean = """        @media (max-width: 768px) {
            /* Protect the Logo */
            .navbar .logo { flex-shrink: 0 !important; }
            .logo-icon { width: 40px !important; height: 40px !important; min-width: 40px !important; flex-shrink: 0 !important; }
            .logo-text-wrapper { display: none !important; }
            
            /* Clean up redundant top navbar items (they exist in bottom nav) */
            .mobile-only .btn { display: none !important; }
            .mobile-only .ri-customer-service-2-line { display: none !important; }
            .mobile-only #mobile-mypage-icon { display: none !important; }
            
            /* Restore Language Selector to comfortable size */
            .lang-select { 
                padding: 6px 20px 6px 10px; 
                font-size: 0.8rem; 
                width: auto;
                min-width: 90px;
                margin-right: 10px;
                background-position: right 8px top 50%;
                background-size: 8px auto;
            }
            
            .navbar .container { padding: 0 15px; flex-wrap: nowrap; justify-content: space-between; }
        }"""

new_css_perfect = """        @media (max-width: 768px) {
            /* Protect the Logo */
            .navbar .logo { flex-shrink: 0 !important; }
            .logo-icon { width: 40px !important; height: 40px !important; min-width: 40px !important; flex-shrink: 0 !important; }
            .logo-text-wrapper { display: none !important; }
            
            /* Clean up redundant top navbar items */
            .mobile-only .btn { display: none !important; }
            .mobile-only a[onclick*="openKakaoChat"] { display: none !important; }
            .mobile-only #mobile-mypage-icon { display: none !important; }
            
            /* Restore Language Selector to comfortable size */
            .lang-select { 
                padding: 6px 20px 6px 10px; 
                font-size: 0.8rem; 
                width: auto;
                min-width: 90px;
                margin-right: 10px;
                background-position: right 8px top 50%;
                background-size: 8px auto;
            }
            
            .navbar .container { padding: 0 15px; flex-wrap: nowrap; justify-content: space-between; }
        }"""

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if old_css_clean in content:
        content = content.replace(old_css_clean, new_css_perfect)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        
print(f"Perfected mobile navbar in {count} files.")
