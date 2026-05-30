import os
import glob

script_snippet = """
<!-- NAVER PV SCRIPT -->
<script type="text/javascript" src="//wcs.naver.net/wcslog.js"> </script> 
<script type="text/javascript"> 
if (!wcs_add) var wcs_add={};
wcs_add["wa"] = "s_bfc3561d569";
if (!_nasa) var _nasa={};
if(window.wcs){
wcs.inflow();
wcs_do();
}
</script>
"""

html_files = glob.glob("*.html")
modified_count = 0

for file in html_files:
    with open(file, "r", encoding="utf-8") as f:
        content = f.read()

    if "s_bfc3561d569" not in content and "wcslog.js" not in content:
        # Avoid google verification file
        if file.startswith("google"):
            continue
            
        # Try to insert before </head>, else before </body>
        if "</head>" in content:
            new_content = content.replace("</head>", f"{script_snippet}\n</head>")
        elif "</body>" in content:
            new_content = content.replace("</body>", f"{script_snippet}\n</body>")
        else:
            new_content = content + f"\n{script_snippet}"

        with open(file, "w", encoding="utf-8") as f:
            f.write(new_content)
        modified_count += 1
        print(f"Injected into {file}")

print(f"Total files modified: {modified_count}")
