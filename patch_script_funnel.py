import codecs

with codecs.open('script.js', 'r', 'utf-8') as f:
    text = f.read()

target = """            // GA4 Funnel Tracking
            if (typeof gtag !== 'undefined') {
                gtag('event', 'funnel_step', {
                    'event_category': 'Quote_Funnel',
                    'event_label': 'Step_' + step,
                    'step_name': String(step)
                });
            }"""

replacement = """            // GA4 Funnel Tracking
            if (typeof gtag !== 'undefined') {
                gtag('event', 'funnel_step', {
                    'event_category': 'Quote_Funnel',
                    'event_label': 'Step_' + step,
                    'step_name': String(step)
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
    print("Patched script.js")
else:
    print("Target not found or already patched")
