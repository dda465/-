import os
import glob

# The script/CSS to inject right before </body>
translate_script = """
    <!-- Google Translate Script & Styling -->
    <style>
        /* Google Translate Customization */
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        body { top: 0px !important; }
        
        #google_translate_element select {
            background-color: #f8fafc;
            color: #1e293b;
            border: 1px solid #cbd5e1;
            border-radius: 20px;
            padding: 6px 25px 6px 12px;
            font-size: 0.85rem;
            font-weight: 600;
            outline: none;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231e293b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
            background-repeat: no-repeat;
            background-position: right 10px top 50%;
            background-size: 8px auto;
            min-width: 90px;
            font-family: 'Pretendard', sans-serif;
            transition: all 0.2s;
        }

        #google_translate_element select:hover {
            border-color: #2563EB;
        }

        .goog-logo-link { display: none !important; }
        .goog-te-gadget { color: transparent !important; font-size: 0px !important; display: flex; align-items: center; }
        .goog-te-gadget span { display: none !important; }
        
        /* Mobile adjustment for translate element */
        @media (max-width: 768px) {
            #google_translate_element { margin-right: 5px !important; margin-left: auto; }
            #google_translate_element select { padding: 4px 20px 4px 8px; font-size: 0.75rem; min-width: auto; }
            .logo-text-wrapper { display: none !important; } /* Hide text logo on mobile to save space for language dropdown */
        }
    </style>
    <script type="text/javascript">
        function googleTranslateElementInit() {
            new google.translate.TranslateElement({
                pageLanguage: 'ko',
                includedLanguages: 'ko,en,zh-CN,ja,vi,ru',
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                autoDisplay: false
            }, 'google_translate_element');
        }
    </script>
    <script type="text/javascript" src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>

</body>"""

translate_widget = '            <!-- Google Translate Widget -->\n            <div id="google_translate_element" style="margin-right: 10px; display: flex; align-items: center;"></div>\n            <div class="nav-links'

for file_path in glob.glob('*.html'):
    if file_path == 'index.html':
        continue
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'google_translate_element' in content:
        continue # already injected
        
    # Inject widget before nav-links
    if '<div class="nav-links' in content:
        content = content.replace('<div class="nav-links', translate_widget, 1)
    
    # Inject script before </body>
    if '</body>' in content:
        content = content.replace('</body>', translate_script)
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Updated {file_path}")
