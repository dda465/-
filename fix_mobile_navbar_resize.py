import glob

old_css_fit_all = """        @media (max-width: 768px) {
            /* Protect the Logo and show text compactly */
            .navbar .logo { flex-shrink: 0 !important; margin-right: 2px !important; display: flex !important; align-items: center !important; }
            .logo-icon { width: 30px !important; height: 30px !important; min-width: 30px !important; flex-shrink: 0 !important; }
            .logo-text-wrapper { display: inline-block !important; font-size: 14px !important; letter-spacing: -1px !important; margin-left: 3px !important; font-weight: 800 !important; }
            
            /* Shrink Language Selector */
            .lang-select { 
                padding: 2px 10px 2px 2px; 
                font-size: 0.6rem; 
                width: 50px; 
                min-width: 50px;
                margin-right: 2px !important;
                background-position: right 2px top 50%;
                background-size: 5px auto;
                letter-spacing: -0.5px;
            }
            
            /* Extreme Shrink Action Buttons & Icons in Navbar */
            .navbar .mobile-only a[href="quote.html"] { padding: 2px 4px !important; font-size: 0.6rem !important; margin-right: 2px !important; letter-spacing: -0.5px !important; }
            .navbar .mobile-only a#mobile-auth-link { padding: 2px 4px !important; font-size: 0.6rem !important; margin-right: 2px !important; letter-spacing: -0.5px !important; }
            .navbar .mobile-only a#mobile-logout-btn { padding: 2px 4px !important; font-size: 0.6rem !important; margin-right: 2px !important; letter-spacing: -0.5px !important; }
            .navbar .mobile-only button { margin-left: 0 !important; font-size: 1.1rem !important; padding: 0 !important; }
            
            /* Navbar Container Tweaks */
            .navbar .container { padding: 0 2px; flex-wrap: nowrap; overflow-x: visible; justify-content: space-between; }
            .navbar .mobile-only { gap: 0 !important; }
        }"""

new_css_perfect_size = """        @media (max-width: 768px) {
            /* Protect the Logo and show text comfortably */
            .navbar .logo { flex-shrink: 0 !important; margin-right: 4px !important; display: flex !important; align-items: center !important; }
            .logo-icon { width: 34px !important; height: 34px !important; min-width: 34px !important; flex-shrink: 0 !important; }
            .logo-text-wrapper { display: inline-block !important; font-size: 17px !important; letter-spacing: -1px !important; margin-left: 5px !important; font-weight: 800 !important; }
            
            /* Comfortable Language Selector */
            .lang-select { 
                padding: 3px 12px 3px 4px; 
                font-size: 0.75rem; 
                width: 60px; 
                min-width: 60px;
                margin-right: 4px !important;
                background-position: right 3px top 50%;
                background-size: 6px auto;
                letter-spacing: -0.5px;
            }
            
            /* Comfortable Action Buttons & Icons in Navbar */
            .navbar .mobile-only a[href="quote.html"] { padding: 4px 7px !important; font-size: 0.75rem !important; margin-right: 4px !important; letter-spacing: -0.5px !important; }
            .navbar .mobile-only a#mobile-auth-link { padding: 4px 7px !important; font-size: 0.75rem !important; margin-right: 4px !important; letter-spacing: -0.5px !important; }
            .navbar .mobile-only a#mobile-logout-btn { padding: 4px 7px !important; font-size: 0.75rem !important; margin-right: 4px !important; letter-spacing: -0.5px !important; }
            .navbar .mobile-only button { margin-left: 2px !important; font-size: 1.3rem !important; padding: 0 !important; }
            
            /* Navbar Container Tweaks */
            .navbar .container { padding: 0 6px; flex-wrap: nowrap; overflow-x: visible; justify-content: space-between; }
            .navbar .mobile-only { gap: 0 !important; }
        }"""

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if old_css_fit_all in content:
        content = content.replace(old_css_fit_all, new_css_perfect_size)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        
print(f"Resized elements perfectly in {count} files.")
