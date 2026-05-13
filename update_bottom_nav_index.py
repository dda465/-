import os
import re

def update_index():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # Define the new CSS and HTML
    new_css = """
            /* ============================================ */
            /* 최종 개선안: 5-item balanced bottom nav    */
            /* ============================================ */
            .bottom-nav {
                display: flex;
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 72px;
                background: rgba(255, 255, 255, 0.97);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-top: 1px solid rgba(0,0,0,0.04);
                justify-content: space-around;
                align-items: flex-end;
                padding: 0 8px;
                padding-bottom: env(safe-area-inset-bottom);
                z-index: 9999;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
            }

            .nav-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-decoration: none !important;
                flex: 1;
                height: 100%;
                padding-top: 8px;
                color: #94a3b8;
                transition: color 0.2s ease;
                position: relative;
                -webkit-tap-highlight-color: transparent;
            }

            .nav-item i {
                font-size: 1.4rem;
                margin-bottom: 3px;
                transition: transform 0.2s ease;
            }

            .nav-item span {
                font-size: 0.68rem;
                font-weight: 700;
                letter-spacing: -0.3px;
                white-space: nowrap;
            }

            .nav-item.active {
                color: #1E3A8A;
            }
            .nav-item.active::before {
                content: '';
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 24px;
                height: 3px;
                background: #2563EB;
                border-radius: 0 0 4px 4px;
            }

            .nav-item:active {
                transform: scale(0.92);
            }

            .nav-item.sell-cta {
                position: relative;
                top: -18px;
                flex: none;
                width: 72px;
                height: auto;
                padding-top: 0;
                color: #1e293b;
            }

            .nav-item.sell-cta .sell-icon-wrap {
                width: 58px;
                height: 58px;
                border-radius: 50%;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 4px solid white;
                box-shadow: 
                    0 4px 15px rgba(37, 99, 235, 0.4),
                    0 0 0 0 rgba(37, 99, 235, 0.4);
                animation: sellPulse 2.5s ease-in-out infinite;
                transition: transform 0.2s ease;
            }

            .nav-item.sell-cta .sell-icon-wrap i {
                font-size: 1.6rem;
                color: white;
                margin: 0;
            }

            .nav-item.sell-cta span {
                margin-top: 5px;
                font-size: 0.7rem;
                font-weight: 800;
                color: #2563EB;
            }

            .nav-item.sell-cta:active .sell-icon-wrap {
                transform: scale(0.9);
            }

            .nav-item.sell-cta::before {
                display: none;
            }

            @keyframes sellPulse {
                0% { box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4), 0 0 0 0 rgba(37, 99, 235, 0.35); }
                50% { box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4), 0 0 0 10px rgba(37, 99, 235, 0); }
                100% { box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4), 0 0 0 0 rgba(37, 99, 235, 0); }
            }
"""
    new_html = """
    <!-- Mobile Sticky Bottom Navigation -->
    <div class="bottom-nav mobile-only" aria-label="하단 메뉴">
        <a href="index.html" class="nav-item active" aria-label="홈">
            <i class="ri-home-5-fill"></i>
            <span>홈</span>
        </a>

        <a href="mypage.html" class="nav-item" aria-label="마이페이지">
            <i class="ri-user-3-line"></i>
            <span>마이페이지</span>
        </a>

        <a href="quote.html" class="nav-item sell-cta" aria-label="판매하기">
            <div class="sell-icon-wrap">
                <i class="ri-hand-coin-line"></i>
            </div>
            <span>판매하기</span>
        </a>

        <a href="reviews.html" class="nav-item" aria-label="이용후기">
            <i class="ri-message-3-line"></i>
            <span>이용후기</span>
        </a>

        <a href="javascript:void(0)" class="nav-item" aria-label="고객센터" onclick="ChannelIO('show')">
            <i class="ri-customer-service-2-line"></i>
            <span>고객센터</span>
        </a>
    </div>
"""

    # 1. CSS Replacement
    # Find start: .mobile-bottom-nav { inside the media query
    # Find end: .bottom-nav-item.sell-action i { ... }
    
    css_start_idx = content.find('.mobile-bottom-nav {\n\n                display: flex;')
    css_end_idx = content.find('.bottom-nav-item.sell-action i { font-size: 2rem; margin: 0; color: white; }')
    
    if css_start_idx != -1 and css_end_idx != -1:
        # Find the closing brace of the css_end line
        close_idx = content.find('}', css_end_idx) + 1
        content = content[:css_start_idx] + new_css.strip() + '\n\n' + content[close_idx:]
        print("Replaced CSS")
    else:
        print("CSS replacement failed, could not find bounds.")

    # 2. HTML Replacement
    html_start_idx = content.find('<div class="mobile-bottom-nav">')
    # Find the closing </div> of mobile-bottom-nav
    # It contains "고객센터"
    html_end_idx = content.find('<span>고객센터</span>\n\n        </a>\n\n    </div>')
    
    if html_start_idx != -1 and html_end_idx != -1:
        end_offset = content.find('</div>', html_end_idx) + 6
        content = content[:html_start_idx] + new_html.strip() + content[end_offset:]
        print("Replaced HTML")
    else:
        print("HTML replacement failed, could not find bounds.")
        
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
        
update_index()
