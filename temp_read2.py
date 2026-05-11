import sys

def search_file(filename, query, out_f, context=20):
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
            
    matches = []
    for i, line in enumerate(lines):
        if query in line:
            start = max(0, i - context)
            end = min(len(lines), i + context + 1)
            matches.append("".join(f"{j+1}: {lines[j]}" for j in range(start, end)))
            break
            
    out_f.write(f"--- {filename} ---\n")
    for m in matches:
        out_f.write(m + "\n")
        out_f.write("-" * 40 + "\n")

with open('output_step7.txt', 'w', encoding='utf-8') as out_f:
    search_file("quote.html", "wizard-step-7", out_f)
    search_file("quote.html", "wizard-step-terms", out_f)
    search_file("script.js", "openTermsModal", out_f)
