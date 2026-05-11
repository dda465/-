import re
import sys
import codecs

with codecs.open("quote.html", "r", encoding="utf-8") as f:
    text = f.read()

# Look for the start of the termsModal
start_idx = text.find('        <div id="termsModal"')
if start_idx != -1:
    # We want to remove everything from start_idx up to the start of wizard-step-7
    # Wait, the HTML has a bunch of garbage. Let's find exactly the point to cut.
    end_idx = text.find('        <!-- Step 7: Form (Updated Delivery Methods) -->')
    
    # We will remove from start_idx to end_idx
    if end_idx != -1:
        text = text[:start_idx] + "\n" + text[end_idx:]

with codecs.open("quote.html", "w", encoding="utf-8") as f:
    f.write(text)

print("Modal removed.")
