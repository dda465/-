const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();
    
    // Use file:// protocol to view the prototype
    await page.goto("file:///c:/Users/PC/Desktop/used-phone-market/prototype_mobile_hero.html", { waitUntil: 'networkidle' });
    
    const screenshotPath = "C:\\Users\\PC\\.gemini\\antigravity\\brain\\e291df3b-93a4-49d9-97ec-5157e2576893\\artifacts\\prototype.png";
    
    // make sure the directory exists
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(screenshotPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved to ${screenshotPath}`);

    await browser.close();
})();
