import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Capture console logs
        page.on('console', lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on('pageerror', lambda exc: print(f"PAGE ERROR: {exc}"))
        
        print("Navigating...")
        await page.goto("http://localhost:8123/prototype_quote_flow.html")
        
        print("Step 1: Brand -> Apple")
        await page.click('.brand-btn[data-brand="apple"]')
        await asyncio.sleep(0.5)
        
        print("Step 2: Series")
        await page.evaluate("() => { if (document.querySelectorAll('.series-btn').length > 0) document.querySelectorAll('.series-btn')[0].click() }")
        await asyncio.sleep(0.5)
        
        print("Step 3: Model")
        await page.evaluate("() => { if (document.querySelectorAll('.model-btn').length > 0) document.querySelectorAll('.model-btn')[0].click() }")
        await asyncio.sleep(0.5)
        
        print("Step 4: Storage")
        await page.evaluate("() => { if (document.querySelectorAll('.storage-btn').length > 0) document.querySelectorAll('.storage-btn')[0].click() }")
        await asyncio.sleep(0.5)

        print("Step 4.5: Method")
        await page.evaluate("() => { if (document.querySelectorAll('.method-select-btn').length > 0) document.querySelectorAll('.method-select-btn')[0].click() }")
        await asyncio.sleep(0.5)

        print("Step 5 -> Auth")
        await page.evaluate("goToStep('auth')")
        await asyncio.sleep(0.5)
        
        print("Auth")
        await page.fill('#auth-name', 'Test')
        await page.fill('#auth-phone', '01012345678')
        await page.check('#agree-terms')
        await page.click('#btn-auth-next')
        await asyncio.sleep(0.5)

        print("Customer Info")
        try:
            await page.fill('#customer-account', 'Bank 123', timeout=2000)
            await asyncio.sleep(0.1)
        except Exception as e:
            print("Could not fill customer-account", e)
        
        try:
            # Need to select a delivery method if required
            await page.click('.method-btn[data-method="cvs"]')
            await asyncio.sleep(0.1)
            await page.click('#btn-submit-final')
        except Exception as e:
            print("Could not click final submit", e)
            
        await asyncio.sleep(0.5)
        
        print("Modal 1")
        try:
            await page.click('#p-btn-next', timeout=2000)
            await asyncio.sleep(0.5)
        except Exception as e:
            print("Modal next failed:", e)
        
        print("Modal 2")
        try:
            await page.click('#p-btn-next', timeout=2000)
            await asyncio.sleep(1)
        except Exception as e:
            print("Modal final failed:", e)

        print("Done.")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
