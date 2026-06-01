import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the onclick alerts
html = html.replace(
    '''onclick="alert('데이터 영구 삭제 시스템은 국방부/공공기관 등에서 신뢰하는 복구 불가능한 영구 삭제 방식입니다.\\n\\n고객님의 스마트폰 수거 즉시 100% 복구 불가능하게 데이터를 파기해 드립니다.')"''',
    '''onclick="showInfoModal('data')"'''
)

html = html.replace(
    '''onclick="alert('[단 3단계 판매 절차!]\\n\\n1. 견적조회: 기종에 따른 내 폰 시세 확인\\n2. 장바구니/접수: 주소 입력 후 무료 택배/방문 수거\\n3. 총알입금: 센터 도착 당일 검수 후 즉시 입금처리!')"''',
    '''onclick="showInfoModal('process')"'''
)

# Append the modal UI right before </body>
modal_html = """
    <!-- Info Modal -->
    <div id="info-modal-overlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9998; opacity:0; transition: opacity 0.3s;" onclick="closeInfoModal()"></div>
    <div id="info-modal" style="display:none; position:fixed; left:50%; top:50%; transform:translate(-50%, -45%); width:85%; max-width:400px; background:white; border-radius:24px; z-index:9999; box-shadow:0 25px 50px rgba(0,0,0,0.15); padding:30px; opacity:0; transition: all 0.3s; flex-direction:column; align-items:center; text-align:center;">
        <div id="info-modal-icon" style="width:60px; height:60px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:1.8rem; margin-bottom:20px;"></div>
        <h3 id="info-modal-title" style="font-size:1.3rem; color:#1e293b; font-weight:800; margin-bottom:15px; letter-spacing:-0.5px;"></h3>
        <div id="info-modal-content" style="font-size:0.95rem; color:#475569; line-height:1.6; word-break:keep-all; margin-bottom:25px; text-align:left; background:#f8fafc; padding:20px; border-radius:16px; width:100%; box-sizing:border-box;"></div>
        <button onclick="closeInfoModal()" style="width:100%; background:#2563EB; color:white; border:none; padding:16px; border-radius:16px; font-size:1.1rem; font-weight:700; cursor:pointer; transition:background 0.2s;">확인완료</button>
    </div>

    <script>
    function showInfoModal(type) {
        const overlay = document.getElementById('info-modal-overlay');
        const modal = document.getElementById('info-modal');
        const icon = document.getElementById('info-modal-icon');
        const title = document.getElementById('info-modal-title');
        const content = document.getElementById('info-modal-content');
        
        if(type === 'data') {
            icon.style.background = '#f0fdf4';
            icon.style.color = '#22c55e';
            icon.innerHTML = '<i class="ri-shield-check-fill"></i>';
            title.innerHTML = '데이터 100% 파기 보장';
            content.innerHTML = '<span style="font-weight:700; color:#1e293b;">데이터 영구 삭제 기술 적용</span><br><br>국방부 및 공공기관에서 채택한 최고 수준의 보안 데이터 삭제 시스템으로, 고객님의 기기가 센터에 도착하는 즉시 <strong>100% 복구 불가능하게 영구 파기</strong>하여 개인정보 유출을 원천 차단합니다.';
        } else if(type === 'process') {
            icon.style.background = '#fff7ed';
            icon.style.color = '#f97316';
            icon.innerHTML = '<i class="ri-flashlight-fill"></i>';
            title.innerHTML = '쉽고 빠른 총알 3단계';
            content.innerHTML = '<ul style="padding-left:20px; margin:0; line-height:1.8;"><li><strong>1. 3초 견적</strong>: 내 폰 시세 3초 만에 조회</li><li><strong>2. 1분 접수</strong>: 원클릭 무료 택배/방문 수거 예약</li><li><strong>3. 당일 입금</strong>: 폰 도착 30분 내 검수 완료 및 즉시 현금 송금!</li></ul>';
        }
        
        overlay.style.display = 'block';
        modal.style.display = 'flex';
        
        // Trigger reflow
        void modal.offsetWidth;
        
        overlay.style.opacity = '1';
        modal.style.opacity = '1';
        modal.style.transform = 'translate(-50%, -50%)';
    }
    
    function closeInfoModal() {
        const overlay = document.getElementById('info-modal-overlay');
        const modal = document.getElementById('info-modal');
        
        overlay.style.opacity = '0';
        modal.style.opacity = '0';
        modal.style.transform = 'translate(-50%, -45%)';
        
        setTimeout(() => {
            overlay.style.display = 'none';
            modal.style.display = 'none';
        }, 300);
    }
    </script>
</body>
"""

if '<!-- Info Modal -->' not in html:
    html = html.replace('</body>', modal_html)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Alerts replaced successfully")
