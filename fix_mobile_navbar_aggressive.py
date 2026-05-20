import glob

old_css_pattern = """        @media (max-width: 768px) {
            .navbar .logo { flex-shrink: 0 !important; }
            .lang-select { 
                padding: 2px 14px 2px 4px; 
                font-size: 0.7rem; 
                width: 65px; 
                min-width: 65px;
                margin-right: 4px;
                background-position: right 4px top 50%;
                background-size: 6px auto;
            }
            .logo-text-wrapper { display: none !important; }
            .navbar .container { flex-wrap: nowrap; overflow-x: hidden; }
            /* Make sure logo image doesn't shrink */
            .logo-icon { min-width: 35px; min-height: 35px; }
        }"""

new_css_aggressive = """        @media (max-width: 768px) {
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

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if old_css_pattern in content:
        content = content.replace(old_css_pattern, new_css_aggressive)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        
print(f"Fixed aggressive mobile navbar CSS in {count} files.")
