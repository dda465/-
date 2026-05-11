import codecs
with codecs.open('admin.html', 'r', 'utf-8') as f:
    content = f.read()

analytics_menu = """                <div class="menu-item" onclick="switchTab('analytics')">
                    <span class="material-symbols-outlined">analytics</span>
                    퍼널 분석
                </div>
                <div class="menu-item" onclick="switchTab('trash')">"""
                
if "switchTab('analytics')" not in content:
    content = content.replace("<div class=\"menu-item\" onclick=\"switchTab('trash')\">", analytics_menu)

analytics_tab = """                <div id="tab-analytics" class="view-section" style="display: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 class="mb-2">퍼널(이탈률) 분석</h2>
                        <button class="action-btn" onclick="loadFunnelData()" style="display: flex; align-items: center; gap: 5px;"><span class="material-symbols-outlined" style="font-size: 18px;">refresh</span>새로고침</button>
                    </div>
                    
                    <div style="background: white; padding: 30px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 4px 15px rgba(0,0,0,0.02); margin-bottom: 20px;">
                        <p style="color: var(--text-secondary); margin-bottom: 30px;">방문자가 각 단계를 통과하면서 얼마나 남는지 확인할 수 있습니다.</p>
                        
                        <div id="funnel-container" style="display: flex; flex-direction: column; gap: 20px;">
                            <div class="text-center" style="padding: 40px; color: #888;">데이터를 불러오는 중입니다...</div>
                        </div>
                    </div>
                </div>

                <!-- Quote Detail Modal -->"""

if "id=\"tab-analytics\"" not in content:
    content = content.replace("<!-- Quote Detail Modal -->", analytics_tab)

with codecs.open('admin.html', 'w', 'utf-8') as f:
    f.write(content)
print("admin.html patched")
