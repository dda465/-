import sys

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. CSS: iPhone slide styles + slider override for 3 slides
iphone_css = """
    <!-- iPhone Event Hero Slide Styles + 3-slide override -->
    <style>
        /* 슬라이더를 3개 슬라이드용으로 오버라이드 */
        #hero-slider {
            width: 300% !important;
        }
        .hero-slide {
            width: 33.3333% !important;
        }

        /* 아이폰 이벤트 슬라이드 */
        .hero-slide.iphone-event {
            position: relative;
            min-height: 480px;
            background: linear-gradient(135deg, #F8FAFC 0%, #f5f5f7 50%, #e8ecf1 100%) !important;
            border-bottom: 1px solid #E2E8F0;
            overflow: hidden;
            display: flex;
            align-items: center;
        }
        .iphone-hero-container {
            position: relative; z-index: 5;
            max-width: 1200px; margin: 0 auto;
            padding: 60px 40px;
            display: grid; grid-template-columns: 1.1fr 0.9fr;
            align-items: center; gap: 40px; width: 100%;
        }
        .iphone-hero-text { color: #1d1d1f; }
        .iphone-event-badge {
            display: inline-flex; align-items: center; gap: 6px;
            background: rgba(0,0,0,0.05);
            border: 1px solid rgba(0,0,0,0.08);
            color: #1d1d1f; font-weight: 700; font-size: 0.85rem;
            padding: 6px 14px; border-radius: 20px; margin-bottom: 20px;
        }
        .iphone-hero-text h1 {
            font-family: 'GmarketSans', 'Pretendard', sans-serif !important;
            font-weight: 700 !important; font-size: 2.8rem !important;
            line-height: 1.25 !important; margin-bottom: 12px !important;
            letter-spacing: -1px !important; word-break: keep-all;
            color: #1d1d1f !important;
        }
        .iphone-hero-text h1 .highlight-blue {
            background: linear-gradient(90deg, #2563EB, #60a5fa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .iphone-subtitle {
            font-size: 1.05rem; color: #475569;
            line-height: 1.7; margin-bottom: 30px; max-width: 500px; font-weight: 400;
        }
        .iphone-cta-row { display: flex; gap: 12px; align-items: center; }
        .iphone-btn-primary {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 14px 32px;
            background: #1d1d1f;
            color: white; font-weight: 700; font-size: 1rem;
            border: none; border-radius: 12px; cursor: pointer;
            box-shadow: 0 8px 25px -5px rgba(0,0,0,0.3);
            text-decoration: none;
        }
        .iphone-hero-image { position: relative; display: flex; align-items: center; justify-content: center; }
        .iphone-hero-image img {
            max-height: 320px; width: auto;
            filter: drop-shadow(0 15px 30px rgba(0,0,0,0.12));
            border-radius: 16px;
        }

        @media (max-width: 768px) {
            .hero-slide.iphone-event { min-height: auto !important; padding: 0 !important; }
            .iphone-hero-container {
                grid-template-columns: 1fr !important;
                padding: 5px 15px !important;
                gap: 10px !important;
                display: flex !important; flex-direction: row !important;
                align-items: center !important; justify-content: space-between !important;
            }
            .iphone-hero-text h1 { font-size: 1.15rem !important; margin-bottom: 0 !important; line-height: 1.35 !important; }
            .iphone-hero-text h1 .highlight-blue { background: none; -webkit-text-fill-color: initial; color: #2563EB !important; }
            .iphone-subtitle { display: none !important; }
            .iphone-cta-row { display: none !important; }
            .iphone-event-badge { font-size: 0.65rem; padding: 2px 7px; border-radius: 12px; margin-bottom: 6px; }
            .iphone-hero-image { width: 105px !important; flex-shrink: 0; }
            .iphone-hero-image img { max-height: 95px !important; }
            .iphone-hero-text { flex: 1; }
        }
    </style>
"""

# 2. iPhone event hero slide HTML
new_slide = """
            <!-- Slide: 아이폰 전 기종 특별 이벤트 -->
            <div class="hero-slide iphone-event">
                <a href="event_iphone.html" style="text-decoration: none; color: inherit; display: block; width: 100%; position: relative; z-index: 10;">
                    <div class="iphone-hero-container">
                        <div class="iphone-hero-text">
                            <div class="iphone-event-badge">
                                <i class="ri-apple-fill"></i>
                                아이폰 전 기종 특별 매입 이벤트
                            </div>
                            <h1>
                                아이폰 팔면<br>
                                <span class="highlight-blue">기종 번호</span>만큼 보너스!
                            </h1>
                            <p class="iphone-subtitle">
                                아이폰 15 → +15,000원 | 아이폰 16 → +16,000원<br>
                                기종 번호에 0 세 개만 붙이면 그게 보너스!
                            </p>
                            <div class="iphone-cta-row">
                                <span class="iphone-btn-primary">
                                    <i class="ri-apple-fill"></i>
                                    이벤트 혜택 확인하기
                                </span>
                            </div>
                        </div>
                        <div class="iphone-hero-image">
                            <img src="iphone_hero_banner.png" alt="iPhone Showcase">
                        </div>
                    </div>
                </a>
            </div>

"""

# Step 1: Inject CSS before </head>
html = html.replace('</head>', iphone_css + '</head>')

# Step 2: Insert slide before danggeun event slide
marker = '            <!-- Slide 1: 당근마켓 광고 유입 특별 이벤트 -->'
if marker in html:
    html = html.replace(marker, new_slide + marker)

# Step 3: Update slider dots (2 -> 3)
html = html.replace(
    '<span class="slider-dot active" data-index="0"></span>\n            <span class="slider-dot" data-index="1"></span>',
    '<span class="slider-dot active" data-index="0"></span>\n            <span class="slider-dot" data-index="1"></span>\n            <span class="slider-dot" data-index="2"></span>'
)

# Step 4: Fix slider JS translateX from hardcoded 50% to dynamic calc
html = html.replace(
    "slider.style.transform = `translateX(-${currentIndex * 50}%)`",
    "slider.style.transform = `translateX(-${currentIndex * (100 / totalSlides)}%)`"
)

with open('prototype_iphone.html', 'w', encoding='utf-8') as f:
    f.write(html)
    
print("Done! Fixed: slider track 300%, each slide 33.33%, translateX dynamic.")
