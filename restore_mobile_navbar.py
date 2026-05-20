import glob

old_css_real = """        @media (max-width: 768px) {
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

new_css_restore = """        @media (max-width: 768px) {
            /* Protect the Logo */
            .navbar .logo { flex-shrink: 0 !important; margin-right: 2px !important; }
            .logo-icon { width: 32px !important; height: 32px !important; min-width: 32px !important; flex-shrink: 0 !important; }
            .logo-text-wrapper { display: none !important; }
            
            /* Shrink Language Selector */
            .lang-select { 
                padding: 2px 12px 2px 4px; 
                font-size: 0.65rem; 
                width: 55px; 
                min-width: 55px;
                margin-right: 2px !important;
                background-position: right 2px top 50%;
                background-size: 6px auto;
                letter-spacing: -0.5px;
            }
            
            /* Shrink Action Buttons & Icons in Navbar */
            .navbar .mobile-only .btn { padding: 3px 6px !important; font-size: 0.7rem !important; margin-right: 2px !important; }
            .navbar .mobile-only a { margin-right: 3px !important; font-size: 1.1rem !important; }
            .navbar .mobile-only button { margin-left: 2px !important; font-size: 1.2rem !important; }
            
            /* Navbar Container Tweaks */
            .navbar .container { padding: 0 5px; flex-wrap: nowrap; overflow-x: visible; justify-content: space-between; }
            .navbar .mobile-only { gap: 0 !important; }
        }"""

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if old_css_real in content:
        content = content.replace(old_css_real, new_css_restore)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        
print(f"Restored mobile navbar in {count} files.")
