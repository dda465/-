import codecs

with codecs.open("quote.html", "r", encoding="utf-8") as f:
    text = f.read()

# We need to make sure `wizard-step-auth` is properly closed before `wizard-step-7` begins.
# Also, want to make sure the container structure is correct.

# Currently in quote.html around line 465 it looks like:
#                 </div>
#             <div class="text-center">
#                 <button id="btn-auth-next" class="btn btn-primary" style="width: 100%;">이 가격으로 판매 신청</button>
#             </div>
#         </div>

# Wait, `</div>` on line 469 is closing `wizard-step-auth`.
# But wait, looking at `wizard-step-auth` starting around line 437:
#         <!-- Step 6: Auth (Contact Info) + Terms Checkbox -->
#         <div id="wizard-step-auth" class="wizard-step">
#             <div class="step-header">
#                 ...
#             </div>
#             <div style="max-width: 400px; margin: 0 auto; text-align: left;">
#                 ... (name input)
#                 ... (phone input)
#                 ... (checkbox block)

# Let me check if the `<div style="max-width: 400px;...">` is properly closed.
# Let's read the exact structure between step 6 and step 7 again.

target_str = """                </div>

            <div class="text-center">
                <button id="btn-auth-next" class="btn btn-primary" style="width: 100%;">이 가격으로 판매 신청</button>
            </div>
        </div>"""

# That looks like one </div> closes the checkbox block,
# but we might be missing the </div> for `<div style="max-width: 400px;...">`.
# If that div isn't closed, `wizard-step-7` ends up inside `wizard-step-auth`!

replacement_str = """                </div>
            </div> <!-- Close max-width 400px div -->

            <div class="text-center">
                <button id="btn-auth-next" class="btn btn-primary" style="width: 100%;">이 가격으로 판매 신청</button>
            </div>
        </div> <!-- Close wizard-step-auth div -->"""

if target_str in text:
    text = text.replace(target_str, replacement_str)
    with codecs.open("quote.html", "w", encoding="utf-8") as f:
        f.write(text)
    print("Fixed missing closing div!")
else:
    print("Could not find the target string to replace.")
