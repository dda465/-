const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    let logs = [];
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        const text = `[CONSOLE] ${msg.type()}: ${msg.text()}`;
        console.log(text);
        logs.push(text);
    });
    
    page.on('pageerror', error => {
        const text = `[PAGE ERROR]: ${error}`;
        console.error(text);
        logs.push(text);
    });

    console.log("Testing ?search=아이폰15...");
    await page.goto("http://localhost:8080/quote.html?search=아이폰15");
    
    // Wait for 3 seconds for safe measure
    await page.waitForTimeout(4000);
    
    const screenshotPath = "C:\\Users\\PC\\.gemini\\antigravity\\brain\\338c7561-88da-4f6a-a084-214d2ff96667\\live_test_screenshot.png";
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to ${screenshotPath}`);

    // Check visibility of key elements
    const state = await page.evaluate(() => {
        return {
            wizardStep1: document.getElementById('wizard-step-1') ? document.getElementById('wizard-step-1').style.display : 'null',
            wizardGradeList: document.getElementById('wizard-step-grade-list') ? document.getElementById('wizard-step-grade-list').style.display : 'null',
            allProductsLength: typeof allProducts !== 'undefined' ? allProducts.length : 'undefined',
            currentQuote: typeof currentQuote !== 'undefined' ? JSON.stringify(currentQuote) : 'undefined'
        };
    });
    
    logs.push(`[EVAL STATE]: ${JSON.stringify(state, null, 2)}`);
    console.log(state);

    fs.writeFileSync('console_output.txt', logs.join('\n'));
    await browser.close();
})();
