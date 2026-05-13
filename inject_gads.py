import os

target_dir = r"c:\Users\PC\Desktop\used-phone-market"
snippet = """
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18157690697"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-18157690697');
</script>
"""

count = 0
for filename in os.listdir(target_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(target_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Check if already has it
        if "AW-18157690697" in content:
            continue
            
        # Insert right after <head>
        if "<head>" in content:
            content = content.replace("<head>", f"<head>{snippet}", 1)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            count += 1
            print(f"Injected into {filename}")
        elif "<head " in content: # just in case
             # find first > after <head
             head_idx = content.find("<head ")
             close_idx = content.find(">", head_idx)
             if close_idx != -1:
                 content = content[:close_idx+1] + snippet + content[close_idx+1:]
                 with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                 count += 1
                 print(f"Injected into {filename}")

print(f"Total files updated: {count}")
