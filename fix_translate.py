import glob
import re

old_widget = """            <!-- Google Translate Widget -->
            <div id="google_translate_element" style="margin-right: 10px; display: flex; align-items: center;"></div>"""

new_widget = """            <!-- Custom Language Selector -->
            <div style="margin-right: 10px; display: flex; align-items: center; position: relative;">
                <div id="google_translate_element" style="display:none;"></div>
                <select id="custom_lang_select" class="lang-select">
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                    <option value="zh-CN">简体中文</option>
                    <option value="ja">日本語</option>
                    <option value="vi">Tiếng Việt</option>
                    <option value="ru">Русский</option>
                </select>
            </div>"""

new_script = """    <!-- Google Translate Script & Styling -->
    <style>
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        body { top: 0px !important; }
        .goog-logo-link { display: none !important; }
        .goog-te-gadget { color: transparent !important; font-size: 0px !important; display: none !important; }
        #goog-gt-tt { display: none !important; }
        
        .lang-select {
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

        .lang-select:hover {
            border-color: #2563EB;
        }
        
        @media (max-width: 768px) {
            .lang-select { padding: 4px 20px 4px 8px; font-size: 0.75rem; min-width: auto; margin-right: 5px;}
            .logo-text-wrapper { display: none !important; }
            .navbar .container { flex-wrap: nowrap; overflow-x: hidden; }
        }
    </style>
    <script type="text/javascript">
        function googleTranslateElementInit() {
            new google.translate.TranslateElement({
                pageLanguage: 'ko',
                includedLanguages: 'ko,en,zh-CN,ja,vi,ru',
                autoDisplay: false
            }, 'google_translate_element');
        }

        document.addEventListener('DOMContentLoaded', function() {
            var customSelect = document.getElementById('custom_lang_select');
            if (!customSelect) return;
            
            var match = document.cookie.match(/(?:^|;)\\s*googtrans=([^;]*)/);
            if (match) {
                var lang = match[1].split('/').pop();
                if (lang) {
                    customSelect.value = lang;
                }
            } else {
                customSelect.value = 'ko';
            }

            customSelect.addEventListener('change', function() {
                var targetLang = this.value;
                if (targetLang === 'ko') {
                    // clear cookies to revert to original
                    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=' + window.location.hostname + '; path=/;';
                } else {
                    document.cookie = 'googtrans=/ko/' + targetLang + '; path=/';
                    document.cookie = 'googtrans=/ko/' + targetLang + '; domain=' + window.location.hostname + '; path=/';
                }
                window.location.reload();
            });
        });
    </script>
</body>"""

for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace widget
    if old_widget in content:
        content = content.replace(old_widget, new_widget)
        
    # Replace script safely using split/join to avoid regex escape issues
    if '<!-- Google Translate Script & Styling -->' in content and '</body>' in content:
        parts = content.split('    <!-- Google Translate Script & Styling -->')
        head_part = parts[0]
        # Drop the old script completely, append new script which includes </body>
        content = head_part + new_script
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Fixed translation widget across all files.")
