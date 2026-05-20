import glob

old_css = """        @media (max-width: 768px) {
            .lang-select { padding: 4px 20px 4px 8px; font-size: 0.75rem; min-width: auto; margin-right: 5px;}
            .logo-text-wrapper { display: none !important; }
            .navbar .container { flex-wrap: nowrap; overflow-x: hidden; }
        }"""

new_css = """        @media (max-width: 768px) {
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

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if old_css in content:
        content = content.replace(old_css, new_css)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1

print(f"Fixed mobile navbar CSS in {count} files.")
