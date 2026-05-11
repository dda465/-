import codecs

with codecs.open('admin.js', 'r', 'utf-8') as f:
    js_content = f.read()

# 1. Update switchTab
if "if (tabName === 'analytics') window.loadFunnelData();" not in js_content:
    js_content = js_content.replace(
        "if (tabName === 'trash') loadTrash();",
        "if (tabName === 'trash') loadTrash();\n    if (tabName === 'analytics') window.loadFunnelData();"
    )

# 2. Add loadFunnelData
funnel_logic = """
// --- Funnel Analytics ---
window.loadFunnelData = async () => {
    const container = document.getElementById('funnel-container');
    if (!container) return;
    
    container.innerHTML = '<div class=\"text-center\" style=\"padding: 40px; color: #888;\">데이터를 불러오는 중입니다...</div>';
    
    try {
        const docRef = doc(db, 'analytics', 'funnel_v1');
        const docSnap = await getDoc(docRef);
        
        let data = {};
        if (docSnap.exists()) {
            data = docSnap.data();
        }
        
        const steps = [
            { key: 'home_main', label: '1. 홈페이지 접속 (메인화면)', color: '#e2e8f0', barColor: '#94a3b8' },
            { key: 'quote_start', label: '2. 견적 페이지 (시세조회) 진입', color: '#dbeafe', barColor: '#60a5fa' },
            { key: 'quote_model', label: '3. 제조사/기종/모델 선택 완료', color: '#bfdbfe', barColor: '#3b82f6' },
            { key: 'quote_details', label: '4. 상태 및 상세정보 확인 완료', color: '#93c5fd', barColor: '#2563eb' },
            { key: 'quote_complete', label: '5. 최종 신청서 제출 완료', color: '#3b82f6', barColor: '#1d4ed8' },
        ];
        
        const maxVal = Math.max(...steps.map(s => data[s.key] || 0), 1);
        
        let html = '';
        let prevVal = null;
        
        steps.forEach((step, idx) => {
            const val = data[step.key] || 0;
            const pctOfMax = Math.round((val / maxVal) * 100) || 0;
            
            let dropHtml = '';
            // Only show dropoff if there was a previous stage with > 0 visits
            if (prevVal !== null && prevVal > 0) {
                let dropPct = Math.round(((prevVal - val) / prevVal) * 100);
                if (dropPct < 0) dropPct = 0; 
                let convPct = Math.round((val / prevVal) * 100);
                if (convPct > 100) convPct = 100;
                
                dropHtml = `
                    <div style=\"padding-left: 270px; margin: -15px 0 15px 0; font-size: 0.95rem; color: #64748b; display: flex; align-items: center; gap: 5px;\">
                       <span class=\"material-symbols-outlined\" style=\"font-size: 18px; transform: rotate(-90deg); color: #94a3b8;\">subdirectory_arrow_right</span>
                       전환 <strong style=\"color: #2563eb;\">${convPct}%</strong> (이탈률 <span style=\"color: #ef4444;\">${dropPct}%</span>)
                    </div>
                `;
            }
            
            html += dropHtml;
            html += `
                <div style=\"display: flex; align-items: center; margin-bottom: 25px;\">
                    <div style=\"width: 260px; font-weight: 700; color: #1e293b; font-size: 1.05rem;\">${step.label}</div>
                    <div style=\"flex: 1; display: flex; align-items: center; gap: 15px;\">
                        <div style=\"flex: 1; height: 36px; background: #f1f5f9; border-radius: 18px; overflow: hidden; position: relative; border: 1px solid #e2e8f0;\">
                            <div style=\"width: ${Math.max(pctOfMax, parseInt(val)===0?0:1)}%; height: 100%; background: ${step.barColor}; transition: width 1s ease; position: absolute; left: 0; top: 0; border-radius: 18px;\"></div>
                        </div>
                        <div style=\"width: 90px; font-weight: 800; color: #0f172a; text-align: right; font-size: 1.25rem;\">
                            ${new Intl.NumberFormat().format(val)}명
                        </div>
                    </div>
                </div>
            `;
            
            prevVal = val;
        });
        
        container.innerHTML = html;
        
    } catch(e) {
        console.error('Funnel error', e);
        container.innerHTML = `<div class=\"text-center\" style=\"padding: 40px; color: red;\">에러가 발생했습니다: ${e.message}</div>`;
    }
};
"""

if "window.loadFunnelData" not in js_content:
    js_content += "\n\n" + funnel_logic
    with codecs.open('admin.js', 'w', 'utf-8') as f:
        f.write(js_content)
    print("admin.js patched")
else:
    print("Already inserted")
