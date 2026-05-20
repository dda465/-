import glob
import re

old_select = '<select id="custom_lang_select" class="lang-select">'
new_select = '<select id="custom_lang_select" class="lang-select notranslate">'

script_pattern = r"""            customSelect\.addEventListener\('change', function\(\) \{
                var targetLang = this\.value;
                
                var gtSelect = document\.querySelector\('\.goog-te-combo'\);
                if \(gtSelect\) \{
                    gtSelect\.value = targetLang === 'ko' \? '' : targetLang;
                    gtSelect\.dispatchEvent\(new Event\('change'\)\);
                \}
                
                // Fallback cookie reload if iframe/select is not ready
                if \(targetLang === 'ko'\) \{
                    document\.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    document\.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=' \+ window\.location\.hostname \+ '; path=/;';
                \} else \{
                    document\.cookie = 'googtrans=/ko/' \+ targetLang \+ '; path=/';
                    document\.cookie = 'googtrans=/ko/' \+ targetLang \+ '; domain=' \+ window\.location\.hostname \+ '; path=/';
                \}
                
                // Small delay to allow the Google Translate script to catch the change, else reload
                setTimeout\(\(\) => \{
                    if\(!document\.querySelector\('\.goog-te-combo'\)\) \{
                        window\.location\.reload\(\);
                    \}
                \}, 300\);
            \}\);"""

new_script_logic = """            customSelect.addEventListener('change', function() {
                var targetLang = this.value;
                
                if (targetLang === 'ko') {
                    // Force cookie clear and reload to perfectly restore original Korean DOM
                    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=' + window.location.hostname + '; path=/;';
                    window.location.reload();
                    return;
                }

                var gtSelect = document.querySelector('.goog-te-combo');
                if (gtSelect) {
                    gtSelect.value = targetLang;
                    gtSelect.dispatchEvent(new Event('change'));
                }
                
                document.cookie = 'googtrans=/ko/' + targetLang + '; path=/';
                document.cookie = 'googtrans=/ko/' + targetLang + '; domain=' + window.location.hostname + '; path=/';
                
                // Small delay to allow the Google Translate script to catch the change, else reload
                setTimeout(() => {
                    if(!document.querySelector('.goog-te-combo')) {
                        window.location.reload();
                    }
                }, 300);
            });"""

count = 0
for file_path in glob.glob('*.html'):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    modified = False
    
    if old_select in content:
        content = content.replace(old_select, new_select)
        modified = True
        
    # Using simple string replacement for the logic
    old_logic_raw = """            customSelect.addEventListener('change', function() {
                var targetLang = this.value;
                
                var gtSelect = document.querySelector('.goog-te-combo');
                if (gtSelect) {
                    gtSelect.value = targetLang === 'ko' ? '' : targetLang;
                    gtSelect.dispatchEvent(new Event('change'));
                }
                
                // Fallback cookie reload if iframe/select is not ready
                if (targetLang === 'ko') {
                    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=' + window.location.hostname + '; path=/;';
                } else {
                    document.cookie = 'googtrans=/ko/' + targetLang + '; path=/';
                    document.cookie = 'googtrans=/ko/' + targetLang + '; domain=' + window.location.hostname + '; path=/';
                }
                
                // Small delay to allow the Google Translate script to catch the change, else reload
                setTimeout(() => {
                    if(!document.querySelector('.goog-te-combo')) {
                        window.location.reload();
                    }
                }, 300);
            });"""

    if old_logic_raw in content:
        content = content.replace(old_logic_raw, new_script_logic)
        modified = True
        
    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        
print(f"Fixed Korean revert logic in {count} files.")
