import glob
import re

old_css_pattern = """        @media (max-width: 768px) {
            /* Protect the Logo */
            .navbar .logo { flex-shrink: 0 !important; margin-right: 5px !important; }
            .logo-icon { width: 36px !important; height: 36px !important; min-width: 36px !important; flex-shrink: 0 !important; }
            .logo-text-wrapper { display: none !important; }
            
            /* Shrink Language Selector */
            .lang-select { 
                padding: 2px 10px 2px 2px; 
                font-size: 0.65rem; 
                width: 50px; 
                min-width: 50px;
                margin-right: 3px !important;
                background-position: right 2px top 50%;
                background-size: 5px auto;
                letter-spacing: -0.5px;
            }
            
            /* Shrink Action Buttons & Icons */
            .mobile-only .btn { padding: 4px 6px !important; font-size: 0.7rem !important; margin-right: 3px !important; }
            .mobile-only a { margin-right: 5px !important; font-size: 1.1rem !important; }
            #speed-test-icon { margin-right: 5px !important; }
            
            /* Navbar Container Tweaks */
            .navbar .container { padding: 0 10px; flex-wrap: nowrap; overflow-x: visible; }
            .mobile-only { gap: 0 !important; }
        }"""

new_css_clean = """        @media (max-width: 768px) {
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

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if old_css_pattern in content:
        content = content.replace(old_css_pattern, new_css_clean)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        
print(f"Cleaned up mobile navbar in {count} files.")
