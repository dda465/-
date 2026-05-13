import os
import re

AUTH_SCRIPT = """
                // --- NAVER 회원가입(sign_up) SCRIPT ---
                if(window.wcs){
                    if(!wcs_add) var wcs_add = {};
                    wcs_add['wa'] = 's_bfc3561d569';
                    var _conv = {};
                    _conv.type = 'sign_up';
                    wcs.trans(_conv);
                }
"""

def process_auth_js():
    with open('auth.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
    if "s_bfc3561d569" in content:
        print("auth.js already processed")
        return
        
    # Replace window.location.replace('index.html'); with AUTH_SCRIPT + window.location.replace
    # But only the first instance (which is the email signup success block)
    target = "window.location.replace('index.html');"
    parts = content.split(target, 1)
    
    if len(parts) == 2:
        new_content = parts[0] + AUTH_SCRIPT + "\n                " + target + parts[1]
        with open('auth.js', 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Applied sign_up script to auth.js")
    else:
        print("Could not find target in auth.js")

if __name__ == "__main__":
    process_auth_js()
