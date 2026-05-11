import codecs

with codecs.open("quote.html", "r", encoding="utf-8") as f:
    text = f.read()

# I see a bunch of garbage starting from line 467:
#         <!-- Step 7: Form (Updated Delivery Methods) -->
#         <div id="wizard-step-7" class="wizard-step">
#             <div class="step-header">
#                 <h2>거래방식 선택</h2>
#                 <p>원하시는 수거 방식을 선택해주세요.</p>
#             </div>
#         <!-- Step 7: Form (Updated Delivery Methods) -->
#         <div id="wizard-step-7" class="wizard-step">
#             ... wait, why is step 7 duplicated?

# Let's fix this properly.
# The user wants ONLY the name/phone input and the terms agreement checkbox inside wizard-step-auth.
# In original quote.html, after the auth inputs, there's a "btn-auth-next" button to proceed.
# Let's find exactly where wizard-step-auth should end and wizard-step-7 should begin.

# Find the end of auth inputs + checkbox block
auth_start = text.find('<div id="wizard-step-auth"')
btn_auth_next_html = """            <div class="text-center">
                <button id="btn-auth-next" class="btn btn-primary" style="width: 100%;">이 가격으로 판매 신청</button>
            </div>
        </div>
"""

step7_real_start = text.rfind('        <!-- Step 7: Form (Updated Delivery Methods) -->')

if auth_start != -1 and step7_real_start != -1:
    # We want to keep everything up to the terms checkbox
    checkbox_end = text.find('</div>', text.find('id="agree-terms"')) + 6
    if text[checkbox_end:checkbox_end+1] == '\n':
        checkbox_end = text.find('</div>', checkbox_end) + 6 # it's nested
    
    # Just look for the closing div of the checkbox block:
    # <div class="mb-4" style="display:...
    checkbox_block_start = text.find('<!-- Terms Agreement Checkbox -->')
    checkbox_block_end = text.find('</div>', text.find('</button>', checkbox_block_start)) + 6
    
    # Keep up to checkbox end, add the Next button, then strictly start Step 7
    cleaned_auth_section = text[:checkbox_block_end] + "\n\n" + btn_auth_next_html + "\n"
    
    text = cleaned_auth_section + text[step7_real_start:]

with codecs.open("quote.html", "w", encoding="utf-8") as f:
    f.write(text)

print("Removed garbage HTML.")
