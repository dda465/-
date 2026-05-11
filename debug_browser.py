import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Capture console logs
        def handle_console(msg):
            print(f"BROWSER CONSOLE [{msg.type}]: {msg.text}")
        
        page.on("console", handle_console)
        
        # Capture page errors
        def handle_page_error(err):
            print(f"BROWSER ERROR: {err}")
            
        page.on("pageerror", handle_page_error)

        print("Navigating to index.html...")
        await page.goto("http://localhost:3000/index.html")
        await page.wait_for_timeout(2000)
        
        # Check current navbar state
        nav_login_link = await page.query_selector("id=nav-login-link")
        if nav_login_link:
            text = await nav_login_link.inner_text()
            print(f"nav-login-link text: {text}")
        
        logout_link = await page.query_selector("id=nav-logout-link")
        if logout_link:
            text = await logout_link.inner_text()
            print(f"nav-logout-link text: {text}")
            
            # Setup dialog handler to auto-accept confirm()
            page.on("dialog", lambda dialog: dialog.accept())
            
            print("Clicking logout link...")
            await logout_link.click()
            await page.wait_for_timeout(2000)
            print(f"URL after logout click: {page.url}")
        else:
            print("Logout link NOT FOUND in navbar.")
            
        print("Navigating to login.html...")
        await page.goto("http://localhost:3000/login.html")
        await page.wait_for_timeout(2000)
        print(f"URL after going to login.html: {page.url}")

        await browser.close()

asyncio.run(run())
