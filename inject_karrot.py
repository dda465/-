import os

target_dir = r"c:\Users\PC\Desktop\used-phone-market"
snippet = """
<!-- Danggeun Market Code -->
<script src="https://karrot-pixel.business.daangn.com/karrot-pixel.js"></script>
<script>
  window.karrotPixel.init('1778656966686481001');
  window.karrotPixel.track('ViewPage');
</script>
<!-- End Danggeun Market Code -->
"""

count = 0
for filename in os.listdir(target_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(target_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Check if already has it
        if "karrot-pixel.js" in content:
            continue
            
        # Insert right after <head>
        if "<head>" in content:
            content = content.replace("<head>", f"<head>\n{snippet}", 1)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            count += 1
            print(f"Injected into {filename}")
        elif "<head " in content: # just in case
             head_idx = content.find("<head ")
             close_idx = content.find(">", head_idx)
             if close_idx != -1:
                 content = content[:close_idx+1] + "\n" + snippet + content[close_idx+1:]
                 with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                 count += 1
                 print(f"Injected into {filename}")

print(f"Total files updated with Karrot script: {count}")
