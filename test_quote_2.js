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

    console.log("Navigating to quote-foreigner.html?lang=en...");
    await page.goto("http://localhost:8080/quote-foreigner.html?lang=en");
    
    await page.waitForTimeout(3000);
    
    console.log("Selecting Brand...");
    await page.click('#fg-step-1 .selection-card');
    await page.waitForTimeout(1000);
    
    console.log("Selecting Series...");
    await page.click('#fg-step-2 .selection-card');
    await page.waitForTimeout(1000);
    
    console.log("Selecting Model...");
    await page.click('#fg-model-grid .selection-card');
    await page.waitForTimeout(1000);
    
    console.log("Selecting Storage...");
    const storageCards = await page.$$('#fg-storage-grid .selection-card');
    if (storageCards.length > 0) {
        await storageCards[0].click();
        await page.waitForTimeout(1000);
    }
    
    console.log("Selecting Defects...");
    await page.click('.fg-btn-primary[onclick="goToStep(6)"]');
    await page.waitForTimeout(1000);
    
    console.log("Filling Form...");
    await page.fill('#fg-name', 'Test User');
    await page.fill('#fg-contact-value', 'test_contact');
    await page.fill('#fg-address', 'Test Address');
    await page.fill('#fg-bank-account', 'Bank Name');
    
    console.log("Submitting...");
    page.on('dialog', async dialog => {
        console.log(`[DIALOG]: ${dialog.message()}`);
        logs.push(`[DIALOG]: ${dialog.message()}`);
        await dialog.accept();
    });
    await page.click('#fg-step-6 .fg-btn-primary');
    
    await page.waitForTimeout(3000);

    fs.writeFileSync('test_error.txt', logs.join('\n'));
    await browser.close();
})();
