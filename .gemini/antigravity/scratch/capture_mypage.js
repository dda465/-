const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 450, height: 900 },
        deviceScaleFactor: 2
    });
    const page = await context.newPage();
    
    const artifactDir = "C:\\Users\\PC\\.gemini\\antigravity\\brain\\f041b7e5-759b-491c-8c20-44cd16c8d121";
    
    console.log("Navigating to mypage...");
    await page.goto("http://localhost:8080/mypage.html", { waitUntil: 'domcontentloaded' });
    
    console.log("Injecting mock quotation card into mypage...");
    await page.evaluate(() => {
        const myQuotesList = document.getElementById('my-quotes-list');
        if (!myQuotesList) return;
        
        const el = document.createElement('div');
        el.className = 'quote-card';
        el.style.display = 'block';
        el.style.background = 'white';
        el.style.padding = '20px';
        el.style.borderRadius = '16px';
        el.style.border = '1px solid #e2e8f0';
        el.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
        
        el.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div class="qc-info">
                    <h3 style="margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 700; color: #1f2937;">애플 아이폰 15 프로 <span style="font-size:0.8rem; color:#888; font-weight: 400;">256GB</span></h3>
                    <p style="margin: 0; font-size: 0.95rem;">예상 매입가: <strong style="color: #2563EB;">850,000원</strong></p>
                    <p style="font-size: 0.85rem; margin-top: 6px; margin-bottom: 0; color: #475569; font-weight: 500; display: flex; align-items: center; gap: 5px;">
                        <span class="material-symbols-outlined" style="font-size: 1rem; color: #64748b; vertical-align: middle;">calendar_today</span>
                        <span>접수일: <strong style="color: #1e293b; font-weight: 600;">2026. 5. 23. 오후 2:46:47</strong></span>
                    </p>
                    <span style="font-size: 0.8rem; color: #16a34a; background: #f0fdf4; padding: 4px 8px; border-radius: 6px; margin-top: 8px; display: inline-block; font-weight: 600;">[방문수거] (희망일: 05/25)</span>
                </div>
                <div style="text-align: right;">
                     <span class="status-badge pickup" style="background: #eff6ff; color: #2563eb; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">기기 수거중</span>
                </div>
            </div>
        `;
        myQuotesList.innerHTML = '';
        myQuotesList.appendChild(el);
        
        const noData = document.getElementById('no-quotes-message');
        if(noData) noData.style.display = 'none';
    });
    
    await page.waitForTimeout(1000);
    
    const ssPath = path.join(artifactDir, "mypage_receipt_date.png");
    await page.screenshot({ path: ssPath });
    console.log(`Mypage screenshot saved to ${ssPath}`);
    
    await browser.close();
})();
