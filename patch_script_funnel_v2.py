import codecs
import re

with codecs.open('script.js', 'r', 'utf-8') as f:
    text = f.read()

target = "                    'step_name': String(step)\n                });\n            }"
replacement = """                    'step_name': String(step)
                });
            }
            
            // Custom Funnel Tracking
            window.__funnel_visited = window.__funnel_visited || {};
            let fStep = null;
            if (step === 'method' || step === 'grade-list' || step === 'defects') fStep = 'quote_model';
            else if (step === 'auth' || step === 'result') fStep = 'quote_details';

            if (fStep && window.trackFunnel && !window.__funnel_visited[fStep]) {
               window.__funnel_visited[fStep] = true;
               window.trackFunnel(fStep);
            }"""

if target in text and "Custom Funnel Tracking" not in text:
    patched = text.replace(target, replacement)
    with codecs.open('script.js', 'w', 'utf-8') as f:
        f.write(patched)
    print("Patched script.js successfully")
else:
    print("Target not found. Let's look for it.")
    print("Is Custom Funnel Tracking there?", "Custom Funnel Tracking" in text)
