import codecs

print("Fixing race condition in script.js...")
with codecs.open('script.js', 'r', 'utf-8', errors='ignore') as f:
    js_content = f.read()

target = r'''                // Hide loading if any
                const loadingOverlay = document.getElementById('wizard-loading');
                if(loadingOverlay) loadingOverlay.style.display = 'none';
                
                // Proceed directly to the Grade Estimates List
                if(typeof window.selectMethod === 'function') {
                    window.selectMethod('simple');
                } else {
                    console.error('window.selectMethod is not defined!');
                }
            } else {'''

replacement = r'''                // Hide loading if any
                const loadingOverlay = document.getElementById('wizard-loading');
                if(loadingOverlay) loadingOverlay.style.display = 'none';
                
                // Proceed directly to the Grade Estimates List
                if(typeof window.selectMethod === 'function') {
                    // ADD A DELAY TO FIX RACE CONDITION!
                    // If initDeepWizard finishes and forces goToStep(1), this will execute 0.3s afterwards and accurately override it.
                    setTimeout(() => { window.selectMethod('simple'); }, 300);
                } else {
                    console.error('window.selectMethod is not defined!');
                }
            } else {'''

if target in js_content:
    js_content = js_content.replace(target, replacement)
    with codecs.open('script.js', 'w', 'utf-8') as f:
        f.write(js_content)
    print("Race condition delay injected.")
else:
    print("Target not found! Maybe it's already updated.")
