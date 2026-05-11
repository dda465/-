import re
import os

filepath = r"c:\Users\PC\Desktop\used-phone-market\index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove "판매하기" button from mobile navbar
# Original: <a href="quote.html" style="font-size:0.8rem; font-weight:700; color:#2563EB; border: 1px solid #2563EB; padding:3px 8px; border-radius:16px; margin-right:6px; white-space:nowrap; flex-shrink:0; min-width:max-content;">판매하기</a>
pattern_sell_btn = r'<a href="quote.html" style="[^"]*">판매하기</a>'
content = re.sub(pattern_sell_btn, '', content, count=1)

# 2. Hero Section CTA and Mobile Styles
# Add mobile CTA into Slide 1
slide1_cta_desktop = '''<div class="cta-group" style="display: flex; gap: 15px; margin-top: 30px;">
                                <a href="quote.html" class="btn btn-primary btn-lg">내폰 판매하기</a>
                                <a href="price-list.html" class="btn btn-secondary btn-lg">매입 단가표</a>
                            </div>'''
slide1_cta_new = '''<div class="cta-group pc-only" style="display: flex; gap: 15px; margin-top: 30px;">
                                <a href="quote.html" class="btn btn-primary btn-lg">내폰 판매하기</a>
                                <a href="price-list.html" class="btn btn-secondary btn-lg">매입 단가표</a>
                            </div>
                            <div class="mobile-cta-group mobile-only" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px; width: 100%;">
                                <a href="quote.html" style="width: 100%; padding: 14px; font-size: 16px; background: #2563EB; color: white; border-radius: 10px; text-align: center; font-weight: 700; text-decoration: none; box-sizing: border-box;">내폰 판매하기</a>
                                <a href="price-list.html" style="width: 100%; padding: 10px; font-size: 13px; background: transparent; color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; text-align: center; font-weight: 500; text-decoration: none; box-sizing: border-box;">시세 조회</a>
                            </div>'''
content = content.replace(slide1_cta_desktop, slide1_cta_new)

# Add class to slide 1 to apply mobile background color
# Original: <div class="hero-slide">
# Wait, it might be exactly that string. Let's replace the first occurrence.
# Actually, looking at the code:
# <!-- Slide 1: Main Promotion -->
#             <div class="hero-slide">
content = content.replace('<!-- Slide 1: Main Promotion -->\n\n\n\n            <div class="hero-slide">', '<!-- Slide 1: Main Promotion -->\n\n\n\n            <div class="hero-slide mobile-hero-slide1">')

# Also modify the CSS block to style `.mobile-hero-slide1` and `.mobile-cta-group`
# Add this inside @media (max-width: 768px) { ... }
mobile_css_addition = '''
            /* New Hero Mobile Styles */
            .mobile-hero-slide1 { background: #1e293b !important; }
            .mobile-hero-slide1 h1, .mobile-hero-slide1 p { color: white !important; }
            .hero-content-wrapper { flex-direction: column !important; align-items: flex-start !important; }
            .hero-image-area { text-align: right; width: 100%; margin-top: -30px !important; }
            .mobile-cta-group { display: flex !important; }
            
            /* Trust Metrics Row */
            .trust-metrics-row { order: 5; margin: 0 15px 10px; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); overflow: hidden; }
            .fast-search-section { order: 6 !important; } /* Push fast-search down */
'''
content = content.replace('.app-grid-item { padding: 5px; }', '.app-grid-item { padding: 5px; }' + mobile_css_addition)

# 3. Trust Metrics Row
trust_metrics_html = '''
    <!-- Trust Metrics (Mobile Only) -->
    <div class="mobile-only trust-metrics-row" style="display:flex; justify-content:space-around; padding:14px 20px; background:#f8fafc; border-top: 0.5px solid #e2e8f0; width: auto;">
        <div style="text-align:center"><b style="font-size:16px; color:#1e293b;">4,200+</b><br><span style="font-size:11px;color:#64748b">누적 거래</span></div>
        <div style="text-align:center"><b style="font-size:16px; color:#1e293b;">30분</b><br><span style="font-size:11px;color:#64748b">즉시 입금</span></div>
        <div style="text-align:center"><b style="font-size:16px;color:#2563EB">4.9★</b><br><span style="font-size:11px;color:#64748b">고객 만족</span></div>
    </div>
'''

# We need to place this right before <section class="fast-search-section">
content = content.replace('<section class="fast-search-section">', trust_metrics_html + '\n    <section class="fast-search-section">')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated index.html")
