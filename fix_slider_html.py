import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace Swiper Slider with Custom Slider
new_slider = """    <!-- Hero Section (Custom Slider) -->
    <header class="hero-slider-wrapper">
        <!-- Slider Track -->
        <div id="hero-slider">
            <!-- Slide 1: Main Promotion -->
            <div class="hero-slide" style="background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);">
                <div class="container hero-container" style="padding: 60px 20px;">
                    <div class="hero-content-wrapper">
                        <div class="hero-text-area">
                            <span class="hero-badge" style="background: rgba(37, 99, 235, 0.1); color: #2563EB; font-weight: 700;">NEW 쉐라폰 런칭 기념 특별 매입가</span>
                            <h1 style="font-size: 3.2rem; font-weight: 800; line-height: 1.3; margin-bottom: 20px;">무엇이든 물어보세요<br>최고가 당일 매입</h1>
                            <p class="hero-subtitle">번거로운 흥정 없이 AI가 정확한 단가를 측정합니다.<br>지금 내 폰 시세를 3분 만에 확인하세요.</p>
                            <div class="cta-group" style="display: flex; gap: 15px; margin-top: 30px;">
                                <a href="quote.html" class="btn btn-primary btn-lg">내 폰 시세 조회하기</a>
                                <a href="price-list.html" class="btn btn-secondary btn-lg">매입 단가표 보기</a>
                            </div>
                        </div>
                        <div class="hero-image-area" style="text-align: right;">
                            <img src="hero_bg_realistic.png" alt="스마트폰 일러스트" style="max-width: 90%; height: auto; display: inline-block;">
                        </div>
                    </div>
                </div>
            </div>
            <!-- Slide 2: Quick Process -->
            <div class="hero-slide" style="background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%);">
                <div class="container hero-container" style="padding: 60px 20px;">
                    <div class="hero-content-wrapper">
                        <div class="hero-text-area">
                            <span class="hero-badge" style="background: rgba(255,255,255,0.2); color: #fff; font-weight: 700;">초고속 매입 프로세스</span>
                            <h1 style="color: #fff; font-size: 3.2rem; font-weight: 800; line-height: 1.3; margin-bottom: 20px;">전국 무료 수거부터<br>검수 당일 총알 입금!</h1>
                            <p class="hero-subtitle" style="color: rgba(255,255,255,0.9);">택배 발송 후 전문 센터 검수는 단 30분!<br>빠르고 투명한 쉐라폰 시스템을 경험해보세요.</p>
                            <div class="cta-group" style="display: flex; gap: 15px; margin-top: 30px;">
                                <a href="quote.html" class="btn btn-primary btn-lg" style="background: #fff; color: #3b82f6;">견적 알아보기</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Slider Controls -->
        <div class="slider-controls" style="position: absolute; bottom: 30px; right: 10%; z-index: 10; display: flex; align-items: center; background: rgba(0,0,0,0.5); border-radius: 30px; padding: 5px 15px; color: white; gap: 15px;">
            <button id="slider-prev" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem; padding: 5px;">&#10094;</button>
            <span style="font-size: 0.9rem; font-weight: 500;"><span id="slider-current">1</span> / 2</span>
            <button id="slider-next" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem; padding: 5px;">&#10095;</button>
        </div>
    </header>"""

html = re.sub(r'<!-- Hero Section \(Swiper Slider\) -->.*?</header>', new_slider, html, flags=re.DOTALL)
html = re.sub(r'<!-- Swiper JS -->.*?</script>', '', html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("index.html updated successfully!")
