import codecs
import re

with codecs.open('script.js', 'r', 'utf-8') as f:
    content = f.read()

# 1. Update imports
if 'increment' not in content:
    if 'import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, serverTimestamp, where }' in content:
        content = content.replace(
            'import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, serverTimestamp, where }',
            'import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, updateDoc, getDoc, serverTimestamp, where, setDoc, increment }'
        )
    else:
        # fallback
        content = content.replace('import { collection, addDoc', 'import { setDoc, increment, collection, addDoc')

# 2. Add trackFunnel
track_funnel_code = """
// --- Funnel Analytics ---
window.trackFunnel = async (stepName) => {
    try {
        const docRef = doc(db, 'analytics', 'funnel');
        await setDoc(docRef, { [stepName]: increment(1) }, { merge: true });
        console.log('Funnel tracked:', stepName);
    } catch (e) {
        console.error('Funnel error:', e);
    }
};

"""
if 'window.trackFunnel = async' not in content:
    content = content.replace('document.addEventListener(\'DOMContentLoaded\', () => {', track_funnel_code + 'document.addEventListener(\'DOMContentLoaded\', () => {\n')

# 3. Add home_main / quote_start in DOMContentLoaded
tracking_init = """
    const curPath = window.location.pathname;
    if (curPath.endsWith('index.html') || curPath === '/' || curPath.endsWith('/')) {
        window.trackFunnel('home_main');
    } else if (curPath.includes('quote.html')) {
        window.trackFunnel('quote_start');
    }
"""
if "window.trackFunnel('home_main')" not in content:
    content = content.replace('injectFloatingWidgets();', 'injectFloatingWidgets();\n' + tracking_init)


# 4. Add quote_model selection tracking
if "window.trackFunnel('quote_model')" not in content:
    # Look for "function showPhoneSpecs" or "const showPhoneSpecs ="
    content = content.replace('function showPhoneSpecs(btn, model)', 'function showPhoneSpecs(btn, model) {\n    window.trackFunnel("quote_model");\n')
    content = content.replace('function showPhoneSpecs(model)', 'function showPhoneSpecs(model) {\n    window.trackFunnel("quote_model");\n')
    content = content.replace('const showPhoneSpecs = (card, model) => {', 'const showPhoneSpecs = (card, model) => {\n    window.trackFunnel("quote_model");\n')
    content = content.replace('const showPhoneSpecs = (model) => {', 'const showPhoneSpecs = (model) => {\n    window.trackFunnel("quote_model");\n')

# 5. Add quote_details tracking
if "window.trackFunnel('quote_details')" not in content:
    # When going to the final form
    content = content.replace('document.getElementById(\'wizard-step-3\').classList.add(\'active\');', 'document.getElementById(\'wizard-step-3\').classList.add(\'active\');\n        window.trackFunnel(\'quote_details\');')
    content = content.replace('function showForm() {', 'function showForm() {\n    window.trackFunnel("quote_details");')
    content = content.replace('const showForm = () => {', 'const showForm = () => {\n    window.trackFunnel("quote_details");')

# 6. Add quote_complete tracking
if "window.trackFunnel('quote_complete')" not in content:
    content = content.replace('await addDoc(collection(db, "quotes"), payload);', 'await addDoc(collection(db, "quotes"), payload);\n            window.trackFunnel("quote_complete");')

with codecs.open('script.js', 'w', 'utf-8') as f:
    f.write(content)
print("script.js patched")
