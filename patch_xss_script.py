import os
import re

file_path = "script.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add escapeHtml at the top if not exists
if "function escapeHtml" not in content:
    escape_func = """
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return String(unsafe || '');
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
"""
    # Insert right after the imports
    import_idx = content.find("import ")
    last_import = content.rfind(';', 0, content.find('\n', content.rfind("import ")))
    if last_import != -1:
        content = content[:last_import+1] + "\n" + escape_func + content[last_import+1:]
    else:
        content = escape_func + "\n" + content

# List of common properties that are rendered to DOM
props_to_escape = [
    "data.userName", "data.text", "data.deviceModel", "data.deviceStorage", "data.transactionPrice",
    "safeText", "safeName", "displayTitle", "deviceStr", "updatedText",
    "quote.deviceModel", "quote.deviceStorage", "quote.estimatedPrice", "quote.status",
    "currentUser.displayName", "currentUser.email"
]

# Note: `displayTitle` and `deviceStr` in script.js currently contain HTML for styling!
# `displayTitle = \`${safeName} <span style="font-weight: normal; font-size: 0.85rem; color: #666;">| ${deviceStr} - ${data.transactionPrice}</span>\`;`
# If we escape `displayTitle`, the <span> tags will break.
# Instead, we should escape `safeName`, `deviceStr`, and `data.transactionPrice` BEFORE they are put into `displayTitle`.

# Let's target the exact assignments in script.js instead of blanket regex to avoid breaking HTML.

# In script.js renderReviews:
# let safeText = data.text || '';
# const safeName = data.userName || '익명';
# we can just do:
# let safeText = escapeHtml(data.text || '');
# const safeName = escapeHtml(data.userName || '익명');

content = content.replace("let safeText = data.text || '';", "let safeText = escapeHtml(data.text || '');")
content = content.replace("const safeName = data.userName || '익명';", "const safeName = escapeHtml(data.userName || '익명');")

# What about parts.push(data.deviceModel);
content = content.replace("if (data.deviceModel) parts.push(data.deviceModel);", "if (data.deviceModel) parts.push(escapeHtml(data.deviceModel));")
content = content.replace("if (data.deviceStorage) parts.push(`(${data.deviceStorage})`);", "if (data.deviceStorage) parts.push(`(${escapeHtml(data.deviceStorage)})`);")
content = content.replace("displayTitle = `${safeName} <span style=\"font-weight: normal; font-size: 0.85rem; color: #666;\">| ${deviceStr} - ${data.transactionPrice}</span>`;", "displayTitle = `${safeName} <span style=\"font-weight: normal; font-size: 0.85rem; color: #666;\">| ${deviceStr} - ${escapeHtml(data.transactionPrice)}</span>`;")

# What about mypage.html quotes?
content = content.replace("const model = quote.deviceModel || '알 수 없음';", "const model = escapeHtml(quote.deviceModel || '알 수 없음');")
content = content.replace("const storage = quote.deviceStorage || '';", "const storage = escapeHtml(quote.deviceStorage || '');")
content = content.replace("const price = quote.estimatedPrice || '상담 후 결정';", "const price = escapeHtml(quote.estimatedPrice || '상담 후 결정');")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("script.js XSS patching complete.")
