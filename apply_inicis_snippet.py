import os

def apply_inicis_snippet(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    old_onclick = "window.open('https://mark.inicis.com/mark/escrow_popup.php?mid=MIsharaph', 'escrow', 'width=500,height=500,scrollbars=yes,resizable=yes');"
    new_onclick = "window.open('https://mark.inicis.com/mark/popup_v3.php?mid=MIIsharaph', 'mark', 'width=565,height=683,scrollbars=no,resizable=no');"

    # In case the single quotes/double quotes are mixed, we do a safe replace
    if old_onclick in content:
        new_content = content.replace(old_onclick, new_onclick)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Applied Inicis snippet to {filepath}")
    else:
        print(f"Snippet not found exactly in {filepath}, trying regex fallback.")
        import re
        old_pattern = r"window\.open\('https://mark\.inicis\.com/mark/escrow_popup\.php\?mid=MIsharaph'.*?\);"
        new_content = re.sub(old_pattern, new_onclick, content)
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Applied via regex to {filepath}")
        else:
            print(f"Still not found in {filepath}")

apply_inicis_snippet('index.html')
apply_inicis_snippet('prototype_natural.html')
