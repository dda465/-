import glob
import re

old_css_perfect = """        @media (max-width: 768px) {
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

new_css_real = """        @media (max-width: 768px) {
            /* Protect the Logo and restore text */
            .navbar .logo { flex-shrink: 0 !important; display: flex !important; align-items: center !important; }
            .logo-icon { width: 36px !important; height: 36px !important; min-width: 36px !important; flex-shrink: 0 !important; }
            .logo-text-wrapper { display: inline-block !important; font-size: 20px !important; letter-spacing: -1px !important; margin-left: 6px !important; }
            
            /* Clean up redundant top navbar items completely */
            .mobile-only { display: none !important; }
            
            /* Restore Language Selector to comfortable size */
            .lang-select { 
                padding: 6px 20px 6px 10px; 
                font-size: 0.8rem; 
                width: auto;
                min-width: 90px;
                margin-right: 0;
                background-position: right 8px top 50%;
                background-size: 8px auto;
            }
            
            .navbar .container { padding: 0 15px; flex-wrap: nowrap; justify-content: space-between; }
        }"""

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if old_css_perfect in content:
        content = content.replace(old_css_perfect, new_css_real)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        
print(f"Fixed real mobile navbar in {count} files.")
