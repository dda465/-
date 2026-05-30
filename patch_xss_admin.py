import os
import re

file_path = "admin.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add escapeHtml at the top if not exists
if "function escapeHtml" not in content:
    escape_func = """
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe || '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
"""
    # Insert right after the imports or at the top
    import_idx = content.find("import ")
    last_import = content.rfind(';', 0, content.find('\n', content.rfind("import ")))
    if last_import != -1:
        content = content[:last_import+1] + "\n" + escape_func + content[last_import+1:]
    else:
        content = escape_func + "\n" + content

# List of common properties that are rendered to DOM and might contain user input
props_to_escape = [
    "quote.customerName", "quote.customerPhone", "quote.customerAddress", 
    "quote.deviceModel", "quote.deviceStorage", "quote.accountInfo", 
    "quote.customerNotes", "quote.trackingNumber", "quote.adminNotes",
    "chat.userName", "chat.userPhone", "chat.model",
    "msg.text", "msg.text.replace",
    "user.name", "user.email", "user.phone", "user.role",
    "review.userName", "review.text", "review.deviceModel",
    "data.name", "data.email", "data.phone",
    "q.customerName", "q.deviceModel", "q.customerPhone",
]

# We need to replace ${prop} with ${escapeHtml(prop || '')}
# But only if it's not already escaped
for prop in props_to_escape:
    # Need to match exactly ${prop} or ${prop || '...'} 
    # This is a bit tricky, let's use regex
    # Match ${prop} where it's not preceded by escapeHtml(
    
    # Simple replace for exact matches:
    # ${quote.customerName} -> ${escapeHtml(quote.customerName)}
    
    # We will use regex to find ${prop} and handle defaults like ${prop || '-'}
    # Pattern: \$\{\s*prop(\s*\|\|.*?)?\s*\}
    # Replace: ${escapeHtml(prop$1)}
    
    escaped_prop = prop.replace(".", "\\.")
    pattern = r"\$\{\s*" + escaped_prop + r"(\s*\|\|[^\}]+)?\s*\}"
    
    # Only replace if not already wrapped in escapeHtml
    # Negative lookbehind isn't always easy if the wrapper is far, but we can do a function
    def replacer(match):
        inner = match.group(0)[2:-1] # remove ${ and }
        if "escapeHtml" in inner:
            return match.group(0)
        return f"${{escapeHtml({inner})}}"
        
    content = re.sub(pattern, replacer, content)

# Also catch quote.price? Price should be numeric, but if it's a string from user?
# Prices are usually strings like "100,000". We can escape them too just in case.
price_props = ["quote.estimatedPrice", "quote.finalPrice", "q.estimatedPrice"]
for prop in price_props:
    escaped_prop = prop.replace(".", "\\.")
    pattern = r"\$\{\s*" + escaped_prop + r"(\s*\|\|[^\}]+)?\s*\}"
    def replacer(match):
        inner = match.group(0)[2:-1]
        if "escapeHtml" in inner:
            return match.group(0)
        return f"${{escapeHtml(String({inner}))}}"
    content = re.sub(pattern, replacer, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("admin.js XSS patching complete.")
