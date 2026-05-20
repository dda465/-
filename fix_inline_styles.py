import re

with open('exchange.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add CSS classes to the <style> block
additional_css = """
        .feature-title { font-size: 1.1rem; margin-bottom: 8px; }
        .feature-desc { font-size: 0.9rem; color: #64748B; }
        .form-desc { color: #64748B; margin-bottom: 30px; font-size: 0.95rem; }
        .info-box-my { background: #F8FAFC; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #E2E8F0; }
        .info-box-partner { background: #FFF1F2; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #FECDD3; }
        .info-box-general { margin-bottom: 30px; }
        .form-subtitle { font-size: 1.2rem; }
        .fee-notice-box { background: #EFF6FF; padding: 20px; border-radius: 16px; margin-bottom: 30px; }
        .fee-notice-title { color: #1E3A8A; margin-bottom: 10px; font-size: 1rem; }
        .fee-notice-desc { font-size: 0.9rem; color: #3B82F6; line-height: 1.5; margin: 0; }
        .btn-submit-exchange { width: 100%; padding: 18px; font-size: 1.2rem; border-radius: 12px; font-weight: 800; }
        .exchange-main-layout { margin-top: 100px; }
"""

if '.feature-title' not in content:
    content = content.replace('</style>', additional_css + '\n    </style>')

# Replace inline styles with classes
content = content.replace('class="exchange-layout" style="margin-top: 100px;"', 'class="exchange-layout exchange-main-layout"')
content = content.replace('style="font-size: 1.1rem; margin-bottom: 8px;"', 'class="feature-title"')
content = content.replace('style="font-size: 0.9rem; color: #64748B;"', 'class="feature-desc"')
content = content.replace('style="color: #64748B; margin-bottom: 30px; font-size: 0.95rem;"', 'class="form-desc"')
content = content.replace('style="background: #F8FAFC; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #E2E8F0;"', 'class="info-box-my"')
content = content.replace('style="background: #FFF1F2; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #FECDD3;"', 'class="info-box-partner"')
content = content.replace('style="margin-bottom: 30px;"', 'class="info-box-general"')
content = content.replace('class="form-title" style="font-size: 1.2rem;"', 'class="form-title form-subtitle"')
content = content.replace('style="display: none;"', 'class="hidden-display"') # wait, hidden-display might need a rule
content = content.replace('style="background: #EFF6FF; padding: 20px; border-radius: 16px; margin-bottom: 30px;"', 'class="fee-notice-box"')
content = content.replace('style="color: #1E3A8A; margin-bottom: 10px; font-size: 1rem;"', 'class="fee-notice-title"')
content = content.replace('style="font-size: 0.9rem; color: #3B82F6; line-height: 1.5; margin:0;"', 'class="fee-notice-desc"')
content = content.replace('class="btn btn-primary" style="width: 100%; padding: 18px; font-size: 1.2rem; border-radius: 12px; font-weight: 800;"', 'class="btn btn-primary btn-submit-exchange"')

# add hidden-display to css if needed
if '.hidden-display' not in content:
    content = content.replace('</style>', '        .hidden-display { display: none; }\n    </style>')

with open('exchange.html', 'w', encoding='utf-8') as f:
    f.write(content)
    
print("Removed inline styles from exchange.html")
