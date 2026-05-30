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
    
    console.log("Navigating to quote flow prototype...");
    await page.goto("http://localhost:8080/prototype_quote_flow.html", { waitUntil: 'domcontentloaded' });
    
    console.log("Waiting for window.goToStep to load...");
    try {
        await page.waitForFunction(() => typeof window.goToStep === 'function', { timeout: 10000 });
        console.log("window.goToStep loaded successfully!");
    } catch(err) {
        console.error("Timeout waiting for window.goToStep.", err.message);
    }
    
    // Force-transition straight to Step 8 (Success screen)
    console.log("Forcing step transition to Step 8 (Success screen)...");
    await page.evaluate(() => {
        if (typeof window.goToStep === 'function') {
            window.goToStep(8);
            
            // Manually populate success-instruction to mimic actual submission success behavior
            const instr = document.getElementById('success-instruction');
            if (instr) {
                const formattedDate = new Date().toLocaleDateString('ko-KR', {year: 'numeric', month: 'long', day: 'numeric'});
                const pickupDate = '05/25';
                instr.innerHTML = `
                    <p><strong>📦 택배 방문수거 접수 완료</strong></p>
                    <p>선택하신 수거일자(${pickupDate})에 맞춰 박스를 포장해 문 앞에 두시면, 택배 기사님이 안전하게 수거해 갈 예정입니다.</p>
                    <p>기기가 도착하는 즉시 검수하여 <strong>당일 입금</strong>해 드립니다!</p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin-top: 15px; font-size: 0.9rem; text-align: left; box-sizing: border-box;">
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 8px;">
                            <span style="color: #64748b; font-weight: 500;">📅 접수일자</span>
                            <span style="color: #0f172a; font-weight: 600;">${formattedDate}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b; font-weight: 500;">🚚 수거희망일</span>
                            <span style="color: #2563eb; font-weight: 700;">${pickupDate} 방문수거</span>
                        </div>
                    </div>
                `;
            }
        }
    });
    
    await page.waitForTimeout(1000);
    
    const ss2Path = path.join(artifactDir, "step8_success_receipt.png");
    await page.screenshot({ path: ss2Path });
    console.log(`Success receipt screenshot saved to ${ss2Path}`);
    
    await browser.close();
})();
