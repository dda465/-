import re
import os

filepath = r"c:\Users\PC\Desktop\used-phone-market\index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. We will completely remove the previous <style> block I injected before </head>
# and the old slide 1 mobile content, and rewrite them properly.
# Find the injected style block:
content = re.sub(r'<style>\s*@media \(max-width: 768px\) \{\s*\.mobile-hero-bg \{ background: #1e293b.*?</style>', '', content, flags=re.DOTALL)

# Re-inject the correct, robust mobile CSS before </head>
robust_mobile_css = '''
    <style>
        /* Robust Mobile UI Fixes */
        @media (max-width: 768px) {
            /* Hero Wrapper */
            .hero-slider-wrapper { margin: 0 !important; border-radius: 0 !important; width: 100vw !important; max-width: 100% !important; box-sizing: border-box; }
            .mobile-hero-bg { background: #1e293b !important; min-height: auto !important; padding: 25px 20px !important; display: block !important; }
            
            /* Hide Desktop Elements */
            .pc-only-flex { display: none !important; }
            .slider-controls { display: none !important; }
            .navbar { box-shadow: none !important; border-bottom: 1px solid #f1f5f9 !important; }
            .mobile-ticker { display: none !important; }
            .fast-search-section { display: none !important; }
            .app-grid-section { display: none !important; }
            
            /* Mobile Content Block */
            .mobile-hero-content { display: flex !important; flex-direction: column !important; align-items: flex-start !important; width: 100% !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important; }
            
            /* Title & Subtitle */
            .mobile-hero-title { color: #ffffff !important; font-size: 2.1rem !important; font-weight: 800 !important; line-height: 1.3 !important; margin: 0 0 10px !important; letter-spacing: -1px !important; word-break: keep-all !important; }
            .mobile-hero-subtitle { color: #94a3b8 !important; font-size: 0.95rem !important; margin-bottom: 25px !important; font-weight: 500 !important; }
            
            /* CTA Buttons */
            .mobile-cta-group { display: flex !important; flex-direction: column !important; gap: 12px !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; }
            .mobile-cta-primary { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; width: 100% !important; padding: 16px !important; font-size: 1.1rem !important; background: #3b82f6 !important; color: white !important; border-radius: 14px !important; font-weight: 700 !important; text-decoration: none !important; box-shadow: 0 4px 15px rgba(59,130,246,0.3) !important; box-sizing: border-box !important; }
            .mobile-cta-secondary { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; width: 100% !important; padding: 14px !important; font-size: 1rem !important; background: transparent !important; color: #cbd5e1 !important; border: 1px solid rgba(255,255,255,0.2) !important; border-radius: 14px !important; font-weight: 500 !important; text-decoration: none !important; box-sizing: border-box !important; }

            /* Quick Models & Trust Metrics Area */
            .mobile-bottom-section { display: flex !important; flex-direction: column !important; width: 100vw !important; max-width: 100% !important; background: white !important; order: 4 !important; box-sizing: border-box !important; }
            .quick-models-container { padding: 25px 20px 15px !important; width: 100% !important; box-sizing: border-box !important; }
            .quick-models-chips { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; width: 100% !important; box-sizing: border-box !important; }
            .quick-models-chips a { display: inline-block !important; padding: 8px 14px !important; border-radius: 20px !important; font-size: 0.85rem !important; text-decoration: none !important; font-weight: 500 !important; white-space: nowrap !important; }
            .quick-models-chips a.blue-chip { border: 1px solid #bfdbfe !important; color: #3b82f6 !important; background: transparent !important; }
            .quick-models-chips a.gray-chip { border: 1px solid #e2e8f0 !important; color: #64748b !important; background: transparent !important; }

            /* Trust Metrics */
            .trust-metrics-container { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 20px 0 !important; margin: 0 20px !important; border-top: 1px solid #f1f5f9 !important; border-bottom: 2px solid #22c55e !important; width: calc(100% - 40px) !important; box-sizing: border-box !important; }
            .trust-metrics-item { text-align: center !important; flex: 1 !important; }
            .trust-metrics-divider { width: 1px !important; height: 35px !important; background: #e2e8f0 !important; }
            
            /* Remove container padding overrides */
            .container.hero-container { padding: 0 !important; display: block !important; }
        }
    </style>
'''
content = content.replace('</head>', robust_mobile_css + '\n</head>')

# 2. Rewrite the HTML for the mobile hero to use the new exact classes
pattern_mobile_hero = r'<!-- Mobile Content \(Exactly matching the mockup\).*?</div>\s*</div>\s*</div>'
new_mobile_hero = '''<!-- Mobile Content (Exactly matching the mockup) -->
                    <div class="mobile-only mobile-hero-content">
                        <span style="background: #f59e0b; color: #1e293b; font-weight: 700; border-radius: 20px; padding: 6px 14px; display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; margin-bottom: 15px;">
                            <i class="ri-flashlight-fill"></i> 특별 지원금 5만원 추가 지급
                        </span>
                        <h1 class="mobile-hero-title">
                            지금 폰 팔면<br>즉시 입금!
                        </h1>
                        <p class="mobile-hero-subtitle">30분 내 총알 입금 · 무료 수거</p>
                        
                        <div class="mobile-cta-group">
                            <a href="quote.html" class="mobile-cta-primary">
                                📦 내 폰 지금 판매하기
                            </a>
                            <a href="price-list.html" class="mobile-cta-secondary">
                                💰 시세만 먼저 조회하기
                            </a>
                        </div>
                    </div>

                </div>
            </div>'''
content = re.sub(pattern_mobile_hero, new_mobile_hero, content, flags=re.DOTALL)

# 3. Rewrite the Mobile-Only Bottom Section HTML to use new exact classes
pattern_bottom_section = r'<!-- Mobile Mockup Exact Content -->.*?</div>\s*</div>\s*</div>\s*</div>'
new_bottom_section = '''<!-- Mobile Mockup Exact Content -->
    <div class="mobile-only mobile-bottom-section">
        
        <!-- Quick Models -->
        <div class="quick-models-container">
            <div style="color: #64748b; font-size: 0.9rem; font-weight: 600; margin-bottom: 12px;">인기 기종 바로 판매</div>
            <div class="quick-models-chips">
                <a href="quote.html?model=iphone15pro" class="blue-chip">아이폰 15 Pro</a>
                <a href="quote.html?model=s24ultra" class="blue-chip">갤S24 Ultra</a>
                <a href="quote.html?model=zflip5" class="blue-chip">Z플립 5</a>
                <a href="price-list.html" class="gray-chip">전체 보기 ›</a>
            </div>
        </div>

        <!-- Trust Metrics -->
        <div class="trust-metrics-container">
            <div class="trust-metrics-item">
                <b style="font-size: 1.15rem; color: #0f172a; font-weight: 800;">4,200+</b><br>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">누적 거래</span>
            </div>
            <div class="trust-metrics-divider"></div>
            <div class="trust-metrics-item">
                <b style="font-size: 1.15rem; color: #0f172a; font-weight: 800;">30분</b><br>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">즉시 입금</span>
            </div>
            <div class="trust-metrics-divider"></div>
            <div class="trust-metrics-item">
                <b style="font-size: 1.15rem; color: #2563EB; font-weight: 800;">4.9★</b><br>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">고객 만족</span>
            </div>
        </div>

    </div>'''
content = re.sub(pattern_bottom_section, new_bottom_section, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied robust fixes to index.html mobile layout.")
