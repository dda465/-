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

    console.log("Loading admin page...");
    try {
        await page.goto("https://rejeuphone.web.app/admin.html", { timeout: 15000 });
        await page.waitForTimeout(4000);
        
        const screenshotPath = "C:\\Users\\PC\\.gemini\\antigravity\\brain\\f041b7e5-759b-491c-8c20-44cd16c8d121\\admin_diagnostic.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);
    } catch (e) {
        console.error("Navigation error:", e);
        logs.push(`[NAV ERROR]: ${e.toString()}`);
    }

    fs.writeFileSync("C:\\Users\\PC\\.gemini\\antigravity\\brain\\f041b7e5-759b-491c-8c20-44cd16c8d121\\admin_console_output.txt", logs.join('\n'));
    await browser.close();
})();
