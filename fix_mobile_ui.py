import re
import os

filepath = r"c:\Users\PC\Desktop\used-phone-market\index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. We will replace the entire Slide 1 hero section to make it easy, but keep desktop classes.
# The issue with string replacement is whitespace. Let's use regex to replace the inside of hero-slide1
# Let's find the content of Slide 1.
# It starts from: <div class="hero-slide mobile-hero-slide1"> or <div class="hero-slide">
# up to the next: <!-- Slide 2: Quick Process -->

pattern_slide1 = r'(<!-- Slide 1: Main Promotion -->.*?)(?=<!-- Slide 2: Quick Process -->)'
slide1_match = re.search(pattern_slide1, content, flags=re.DOTALL)

if slide1_match:
    old_slide1 = slide1_match.group(1)
    
    # We will rewrite Slide 1 with distinct desktop and mobile content.
    new_slide1 = '''<!-- Slide 1: Main Promotion -->
            <div class="hero-slide mobile-hero-bg">
                <div class="container hero-container" style="padding: 60px 20px;">
                    
                    <!-- Desktop Content -->
                    <div class="hero-content-wrapper pc-only-flex" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%;">
                        <div class="hero-text-area">
                            <span class="hero-badge" style="background: rgba(37, 99, 235, 0.1); color: #2563EB; font-weight: 700;">S26 출시 기념 이벤트</span>
                            <h1 style="font-size: 3.2rem; font-weight: 800; line-height: 1.3; margin-bottom: 20px;">아이폰 & 갤럭시<br>5만원 추가 보상!</h1>
                            <p class="hero-subtitle">기종 상관없이 쓰던 폰 팔고<br>특별 지원금 5만원 더 챙기세요!</p>
                            <div class="cta-group" style="display: flex; gap: 15px; margin-top: 30px;">
                                <a href="quote.html" class="btn btn-primary btn-lg">내폰 판매하기</a>
                                <a href="price-list.html" class="btn btn-secondary btn-lg">매입 단가표</a>
                            </div>
                        </div>
                        <div class="hero-image-area" style="text-align: right;">
                            <img src="hero_bg_realistic.png" alt="최신 스마트폰 3D 이미지" style="max-width: 90%; height: auto; display: inline-block;">
                        </div>
                    </div>

                    <!-- Mobile Content (Exactly matching the mockup) -->
                    <div class="mobile-only mobile-hero-content" style="flex-direction: column; align-items: flex-start; width: 100%; padding: 10px 5px;">
                        <span style="background: #f59e0b; color: #1e293b; font-weight: 700; border-radius: 20px; padding: 6px 14px; display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; margin-bottom: 15px;">
                            <i class="ri-flashlight-fill"></i> 특별 지원금 5만원 추가 지급
                        </span>
                        <h1 style="color: #ffffff; font-size: 2.1rem; font-weight: 800; line-height: 1.3; margin: 0 0 10px; word-break: keep-all; letter-spacing: -1px;">
                            지금 폰 팔면<br>즉시 입금!
                        </h1>
                        <p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 25px; font-weight: 500;">30분 내 총알 입금 · 무료 수거</p>
                        
                        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                            <a href="quote.html" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 16px; font-size: 1.1rem; background: #3b82f6; color: white; border-radius: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 15px rgba(59,130,246,0.3);">
                                📦 내 폰 지금 판매하기
                            </a>
                            <a href="price-list.html" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; font-size: 1rem; background: transparent; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); border-radius: 14px; font-weight: 500; text-decoration: none;">
                                💰 시세만 먼저 조회하기
                            </a>
                        </div>
                    </div>

                </div>
            </div>
            '''
    content = content.replace(old_slide1, new_slide1)
else:
    print("Could not find slide 1 pattern")

# 2. Add Mobile CSS overrides for the exact mockup
# We will inject a style block before </head> to be super safe.
custom_mobile_styles = '''
    <style>
        @media (max-width: 768px) {
            .mobile-hero-bg { background: #1e293b !important; padding-top: 10px !important; min-height: auto !important; }
            .pc-only-flex { display: none !important; }
            .hero-slider-wrapper { margin: 0 !important; border-radius: 0 !important; }
            .hero-container { padding: 20px 15px !important; }
            
            /* Hide slider controls on mobile */
            .slider-controls { display: none !important; }

            /* Fix Mobile Navbar */
            .navbar { box-shadow: none !important; border-bottom: 1px solid #f1f5f9 !important; }
            
            /* Hide the ticker on mobile if user didn't show it in mockup */
            .mobile-ticker { display: none !important; }
            
            /* Fast Search Section Replacement */
            .fast-search-section { display: none !important; }
            .trust-metrics-row { display: none !important; } /* We will put a new one */
            .app-grid-section { display: none !important; } /* Hide old grid */
        }
    </style>
'''
content = content.replace('</head>', custom_mobile_styles + '</head>')

# 3. Add the Mobile-Only "인기 기종" and "Trust Metrics" below the hero slider
mobile_content_block = '''
    <!-- Mobile Mockup Exact Content -->
    <div class="mobile-only" style="flex-direction: column; width: 100%; background: white; order: 4;">
        
        <!-- Quick Models -->
        <div style="padding: 25px 20px 15px;">
            <div style="color: #64748b; font-size: 0.9rem; font-weight: 600; margin-bottom: 12px;">인기 기종 바로 판매</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <a href="quote.html?model=iphone15pro" style="padding: 8px 14px; border: 1px solid #bfdbfe; color: #3b82f6; border-radius: 20px; font-size: 0.85rem; text-decoration: none; font-weight: 500;">아이폰 15 Pro</a>
                <a href="quote.html?model=s24ultra" style="padding: 8px 14px; border: 1px solid #bfdbfe; color: #3b82f6; border-radius: 20px; font-size: 0.85rem; text-decoration: none; font-weight: 500;">갤S24 Ultra</a>
                <a href="quote.html?model=zflip5" style="padding: 8px 14px; border: 1px solid #bfdbfe; color: #3b82f6; border-radius: 20px; font-size: 0.85rem; text-decoration: none; font-weight: 500;">Z플립 5</a>
                <a href="price-list.html" style="padding: 8px 14px; border: 1px solid #e2e8f0; color: #64748b; border-radius: 20px; font-size: 0.85rem; text-decoration: none; font-weight: 500;">전체 보기 ›</a>
            </div>
        </div>

        <!-- Trust Metrics -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 0; margin: 0 20px; border-top: 1px solid #f1f5f9; border-bottom: 2px solid #22c55e;">
            <div style="text-align: center; flex: 1;">
                <b style="font-size: 1.15rem; color: #0f172a; font-weight: 800;">4,200+</b><br>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">누적 거래</span>
            </div>
            <div style="width: 1px; height: 35px; background: #e2e8f0;"></div>
            <div style="text-align: center; flex: 1;">
                <b style="font-size: 1.15rem; color: #0f172a; font-weight: 800;">30분</b><br>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">즉시 입금</span>
            </div>
            <div style="width: 1px; height: 35px; background: #e2e8f0;"></div>
            <div style="text-align: center; flex: 1;">
                <b style="font-size: 1.15rem; color: #2563EB; font-weight: 800;">4.9★</b><br>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">고객 만족</span>
            </div>
        </div>

    </div>
'''

content = content.replace('</header>', '</header>\n' + mobile_content_block)

# Clean up any previously added broken trust metrics to avoid duplicates on desktop
content = re.sub(r'<!-- Trust Metrics \(Mobile Only\).*?</div>\s*</div>', '', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated index.html to match mobile mockup exactly.")
