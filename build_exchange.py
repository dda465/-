import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

parts_nav = content.split('<!-- HERO SECTION -->')
if len(parts_nav) < 2:
    parts_nav = content.split('<div class="hero-section">')

head_nav = parts_nav[0]

# Extract footer
parts_footer = content.split('<!-- FOOTER -->')
if len(parts_footer) > 1:
    footer = '<!-- FOOTER -->' + parts_footer[1]
else:
    footer = '<footer' + content.split('<footer')[1]

# Adjust the title and description
head_nav = head_nav.replace('쉐라폰 - 최고가 중고폰 매입 플랫폼', '안심 교환 / 검수 대행 - 쉐라폰')

exchange_body = """
    <style>
        .exchange-layout {
            max-width: 1000px;
            margin: 40px auto;
            padding: 20px;
        }

        .hero-banner {
            background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
            border-radius: 24px;
            padding: 50px;
            text-align: center;
            margin-bottom: 40px;
        }

        .hero-banner h1 {
            font-size: 2.5rem;
            color: #1E3A8A;
            font-weight: 800;
            margin-bottom: 16px;
            line-height: 1.3;
        }

        .hero-banner p {
            font-size: 1.1rem;
            color: #3B82F6;
            margin-bottom: 30px;
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
        }

        .feature-card {
            background: white;
            padding: 30px 20px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        
        .feature-card i {
            font-size: 2.5rem;
            color: #2563EB;
            margin-bottom: 15px;
        }

        .form-section {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
            margin-bottom: 40px;
        }

        .form-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #0F172A;
            margin-bottom: 24px;
            border-bottom: 2px solid #E2E8F0;
            padding-bottom: 12px;
        }

        .input-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .input-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #334155;
            font-size: 0.95rem;
        }

        .input-group input, .input-group select {
            width: 100%;
            padding: 14px 16px;
            border: 1px solid #CBD5E1;
            border-radius: 12px;
            font-size: 1rem;
            font-family: 'Pretendard', sans-serif;
            background: #F8FAFC;
        }
        
        .input-group input:focus, .input-group select:focus {
            outline: none;
            border-color: #2563EB;
            background: white;
        }

        .flex-row {
            display: flex;
            gap: 20px;
        }
        
        .flex-row .input-group {
            flex: 1;
        }

        @media (max-width: 768px) {
            .feature-grid { grid-template-columns: 1fr; }
            .flex-row { flex-direction: column; gap: 0; }
            .hero-banner h1 { font-size: 1.8rem; }
            .form-section { padding: 20px; }
        }
        
        .role-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 700;
            margin-bottom: 10px;
        }
        .role-my { background: #E0E7FF; color: #4338CA; }
        .role-partner { background: #FCE7F3; color: #BE185D; }
    </style>

    <div class="exchange-layout" style="margin-top: 100px;">
        <!-- Hero Section -->
        <div class="hero-banner">
            <h1>중고폰 개인 거래,<br>불안하신가요?</h1>
            <p>쉐라폰이 검수부터 데이터 삭제, 에스크로(안전 결제)까지 모두 대행해 드립니다.</p>
        </div>

        <!-- Features -->
        <div class="feature-grid">
            <div class="feature-card">
                <i class="ri-shield-check-fill"></i>
                <h3 style="font-size: 1.1rem; margin-bottom: 8px;">전문가 상호 검수</h3>
                <p style="font-size: 0.9rem; color: #64748B;">양측 기기를 전문가가 꼼꼼히 검수하여 상태 훼손이나 사기(벽돌 배송 등)를 원천 차단합니다.</p>
            </div>
            <div class="feature-card">
                <i class="ri-delete-bin-line"></i>
                <h3 style="font-size: 1.1rem; margin-bottom: 8px;">데이터 100% 삭제</h3>
                <p style="font-size: 0.9rem; color: #64748B;">데이터 영구 삭제 솔루션으로 복구 불가능하게 데이터를 파기한 뒤 안전하게 교환해 드립니다.</p>
            </div>
            <div class="feature-card">
                <i class="ri-hand-coin-line"></i>
                <h3 style="font-size: 1.1rem; margin-bottom: 8px;">안전 차액 결제</h3>
                <p style="font-size: 0.9rem; color: #64748B;">수수료 및 상호 합의된 기기 차액을 쉐라폰이 안전하게 중개하여 송금해 드립니다.</p>
            </div>
        </div>

        <!-- Application Form -->
        <div class="form-section">
            <div class="form-title">안심 교환 / 검수 대행 신청서</div>
            <p style="color: #64748B; margin-bottom: 30px; font-size: 0.95rem;">당근마켓, 중고나라 등에서 교환하기로 합의된 내용을 아래에 정확히 기재해 주세요.</p>
            
            <form id="exchangeForm">
                <!-- My Info -->
                <div style="background: #F8FAFC; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #E2E8F0;">
                    <span class="role-badge role-my">신청인 (본인) 정보</span>
                    <div class="flex-row">
                        <div class="input-group">
                            <label>성함</label>
                            <input type="text" id="ex_my_name" placeholder="홍길동" required>
                        </div>
                        <div class="input-group">
                            <label>연락처 (알림톡 발송용)</label>
                            <input type="tel" id="ex_my_phone" placeholder="010-0000-0000" required>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>본인이 보낼 기기 모델명 (예: 아이폰 15 프로 256GB)</label>
                        <input type="text" id="ex_my_device" placeholder="정확한 기기명과 용량을 입력해 주세요" required>
                    </div>
                </div>

                <!-- Partner Info -->
                <div style="background: #FFF1F2; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #FECDD3;">
                    <span class="role-badge role-partner">상대방 (교환 대상자) 정보</span>
                    <div class="flex-row">
                        <div class="input-group">
                            <label>상대방 성함 (또는 닉네임)</label>
                            <input type="text" id="ex_partner_name" placeholder="김철수 또는 당근닉네임" required>
                        </div>
                        <div class="input-group">
                            <label>상대방 연락처</label>
                            <input type="tel" id="ex_partner_phone" placeholder="010-0000-0000" required>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>상대방이 보낼 기기 모델명 (예: 갤럭시 S24 울트라 512GB)</label>
                        <input type="text" id="ex_partner_device" placeholder="정확한 기기명과 용량을 입력해 주세요" required>
                    </div>
                </div>

                <!-- Transaction Details -->
                <div style="margin-bottom: 30px;">
                    <div class="form-title" style="font-size: 1.2rem;">차액 정산 및 수수료 합의 내용</div>
                    <div class="input-group">
                        <label>차액 정산 방식 (양측 합의 내용)</label>
                        <select id="ex_diff_type" required onchange="document.getElementById('ex_diff_amount_group').style.display = this.value === 'none' ? 'none' : 'block';">
                            <option value="">선택해 주세요</option>
                            <option value="none">차액 없이 1:1 기기만 교환</option>
                            <option value="my_pay">내가 상대방에게 추가 금액을 입금함</option>
                            <option value="partner_pay">상대방이 나에게 추가 금액을 입금함</option>
                        </select>
                    </div>
                    <div class="input-group" id="ex_diff_amount_group" style="display: none;">
                        <label>합의된 차액 금액 (원)</label>
                        <input type="number" id="ex_diff_amount" placeholder="예: 150000">
                    </div>
                    <div class="input-group">
                        <label>전달 사항 (선택)</label>
                        <input type="text" id="ex_memo" placeholder="검수 시 특별히 확인해야 할 하자 등이 있다면 적어주세요.">
                    </div>
                </div>

                <div style="background: #EFF6FF; padding: 20px; border-radius: 16px; margin-bottom: 30px;">
                    <h4 style="color: #1E3A8A; margin-bottom: 10px; font-size: 1rem;"><i class="ri-information-line"></i> 이용 수수료 및 결제 안내</h4>
                    <p style="font-size: 0.9rem; color: #3B82F6; line-height: 1.5; margin:0;">
                        신청서 접수 후, 영업일 기준 1~2시간 내에 전문 상담원이 해피콜을 드려 상세한 <b>수수료 정책 및 배송 절차(가상계좌 입금 방식 등)</b>를 안내해 드립니다.<br>
                        * 쉐라폰의 전문 검수 및 데이터 영구 삭제 비용이 포함됩니다.
                    </p>
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 18px; font-size: 1.2rem; border-radius: 12px; font-weight: 800;">안심 교환 신청하기</button>
            </form>
        </div>
    </div>
"""

with open('exchange.html', 'w', encoding='utf-8') as f:
    f.write(head_nav + '\n' + exchange_body + '\n' + footer)
    
print("exchange.html generated from index.html base.")
