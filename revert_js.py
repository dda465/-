import codecs
import re

print("Reverting handleUrlSearch from script.js...")
try:
    with codecs.open('c:/Users/PC/Desktop/used-phone-market/script.js', 'r', 'utf-8', errors='ignore') as f:
        js_content = f.read()

    # Find the block and remove it
    start_str = "// Auto-Search URL Parameters Logic (Fast Search Integration)"
    end_str = "handleUrlSearch();"
    
    if start_str in js_content and end_str in js_content:
        # Use regex to strip everything from start_str to handleUrlSearch(); and potentially some trailing whitespace or setTimeout blocks we injected
        pattern = r"\s*// Auto-Search URL Parameters Logic.*?handleUrlSearch\(\);"
        new_content = re.sub(pattern, "", js_content, flags=re.DOTALL)
        
        # Also remove the 300ms delay modification we made earlier inside window.selectMethod if it exists?
        # Wait, the delay modification was IN THE INJECTED BLOCK. So removing the injected block completely removes the delay too!
        
        with codecs.open('c:/Users/PC/Desktop/used-phone-market/script.js', 'w', 'utf-8') as f:
            f.write(new_content)
        print("Successfully reverted auto-search logic.")
    else:
        print("Logic block not found. Maybe already reverted?")
        
except Exception as e:
    print(f"Error reverting script.js: {e}")
