import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.set_default_timeout(10000)
        
        print("Navigating to quote.html?search=아이폰15...")
        try:
            await page.goto("http://localhost:8080/quote.html?search=아이폰15")
            print("Waiting for auto-search logic to execute...")
            await page.wait_for_timeout(3000)
            
            output_path = r"C:\Users\PC\.gemini\antigravity\brain\338c7561-88da-4f6a-a084-214d2ff96667\fast_search_result_demo.png"
            await page.screenshot(path=output_path, full_page=True)
            print("Screenshot saved to:", output_path)
            
        except Exception as e:
            print("Error:", e)
            
        await browser.close()

asyncio.run(run())
