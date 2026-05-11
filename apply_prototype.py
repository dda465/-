import re

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Meta
    content = content.replace(
        'content="AI 기반 투명한 시세 조회, 무료 수거, 당일 입금까지! 중고폰 거래의 새로운 기준, 쉐라폰."',
        'content="매일 업데이트되는 정확한 단가표, 택배 수거, 당일 입금 원칙! 진짜 신뢰할 수 있는 쉐라폰."'
    )

    # Ticker
    content = content.replace(
        '<i class="ri-flashlight-fill" style="color:#fbbf24;"></i> 센터 도착 즉시 당일 30분 내 총알 입금',
        '<i class="ri-flashlight-fill" style="color:#fbbf24;"></i> 검수 완료 직후 당일 송금 원칙'
    )
    content = content.replace(
        '<i class="ri-smartphone-line" style="color:#60a5fa;"></i> 내 폰 시세조회 3초 컷!',
        '<i class="ri-smartphone-line" style="color:#60a5fa;"></i> 클릭 3번으로 시세 확인 끝'
    )

    # Hero 1
    content = content.replace('hero_bg_realistic.png', 'real_phones_hero.png')
    content = content.replace(
        '아이폰 & 갤럭시<br>5만원 추가 보상!',
        '쓰던 폰 버리지 마세요<br>정직하게 매입해 드립니다'
    )
    content = content.replace(
        '기종 상관없이 쓰던 폰 팔고<br>특별 지원금 5만원 더 챙기세요!',
        '허위 단가 없는 투명한 시세, 택배 수거부터 당일 송금까지 다 해드립니다.'
    )

    # Hero 2
    content = content.replace('starbucks_promo.png', 'real_starbucks_promo.png')
    content = content.replace(
        '100% 당첨 리뷰 이벤트',
        '솔직한 매입 후기 이벤트'
    )

    # CSS tweak for fast search section
    content = content.replace('border-radius: 32px;', 'border-radius: 16px;')
    content = content.replace('box-shadow: 0 15px 35px rgba(0, 0, 0, 0.04);', 'box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);')
    content = content.replace('border-radius: 30px;', 'border-radius: 16px;')

    # Fast Search
    content = content.replace(
        '<h2>내 폰 가격, 3초 만에 확인!</h2>',
        '<h2>오늘의 정확한 매입 시세 확인</h2>'
    )

    # Quick UI grid
    content = content.replace(
        '<div class="app-grid-label">총알판매안내</div>',
        '<div class="app-grid-label">판매절차 안내</div>'
    )
    content = content.replace(
        'border-radius: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.03);',
        'border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);'
    )
    content = content.replace('border-radius: 20px;', 'border-radius: 12px;')

    # Features
    content = content.replace(
        '<span id="dyn-hero-title">판매는 더 쉽고, 입금은 더 빠르게</span>',
        '<span id="dyn-hero-title">매장 방문 없이 집에서 편하게 파세요</span>'
    )
    content = content.replace(
        '<span id="dyn-hero-subtitle">복잡한 흥정 없이, 쉐라폰만의 3-STEP 시스템을 만나보세요.</span>',
        '<span id="dyn-hero-subtitle">택배 수거부터 꼼꼼한 검수와 당일 입금까지 투명하게 진행됩니다.</span>'
    )
    content = content.replace(
        '<h3>3. 검수 당일 총알 입금</h3>',
        '<h3>3. 검수 직후 당일 송금</h3>'
    )
    content = content.replace(
        '<p>전문 센터의 꼼꼼한 검수가 끝나면<br>단 30분 내로 현금을 지급합니다.</p>',
        '<p>저희 직원이 꼼꼼히 검수한 뒤<br>지체 없이 당일 송금을 원칙으로 합니다.</p>'
    )

    # Insert Inspection Team MSG
    inspection_msg = """
    <section style="background:#ffffff; padding: 40px 0 20px;">
        <div class="container" style="max-width: 800px; text-align: center; border: 1px solid #e2e8f0; border-radius: 16px; padding: 35px 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
            <h3 style="font-size: 1.4rem; color: #1e293b; margin-bottom: 12px;">👋 안녕하세요, 쉐라폰 검수팀입니다!</h3>
            <p style="color: #64748b; line-height: 1.6; font-size: 1.05rem; margin: 0;">
                고객님의 소중한 기기를 저희가 직접 받아 하나하나 꼼꼼히 살피고 있습니다.<br>
                인터넷에 떠도는 말도 안 되는 핑계로 트집 잡지 않습니다.<br>
                투명한 기준과 양심적인 검수로 1원이라도 더 챙겨드리겠습니다. 믿고 보내주세요!
            </p>
        </div>
    </section>

    <!-- Recent Reviews (Added dynamically) -->
    """
    content = content.replace('<!-- Recent Reviews (Added dynamically) -->', inspection_msg)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    update_file('prototype_natural.html')
    print("Updated prototype_natural.html with natural copy and realistic images.")
