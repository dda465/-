import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Handle console logs
        def on_console(msg):
            print(f"CONSOLE: {msg.text}")
        page.on("console", on_console)

        # Handle dialogs (auto-accept confirm)
        async def handle_dialog(dialog):
            print(f"DIALOG [{dialog.type}]: {dialog.message}")
            if dialog.type == 'confirm':
                print("Accepting confirm dialog")
                await dialog.accept()
            else:
                await dialog.accept()
        page.on("dialog", handle_dialog)

        # Go to URL
        print("Navigating to admin...")
        try:
            await page.goto("http://localhost:3000/admin.html", wait_until="networkidle")
        except Exception as e:
            print(f"Failed to load: {e}")
            return

        # Login process
        print("Logging in...")
        await page.wait_for_selector("text=로그인 페이지로 이동")
        await page.click("text=로그인 페이지로 이동")
        await page.wait_for_load_state("networkidle")

        print("Filling login info...")
        # Add basic test account login (you can change this to standard credentials if known)
        await page.fill("#login-email", "test@admin.com")
        await page.fill("#login-pwd", "123456")
        await page.click("#btn-login")

        print("Waiting for page load and table...")
        await asyncio.sleep(3) # Wait for navigation/load

        try:
            # We should be on admin.html now
            await page.wait_for_selector("#quotes-table-body tr")
            rows = await page.query_selector_all("#quotes-table-body tr")
            print(f"Found {len(rows)} quotes rows.")

            if len(rows) > 0:
                print("Clicking first delete button...")
                delete_btn = await rows[0].query_selector("button:has-text('삭제')")
                if delete_btn:
                    await delete_btn.click()
                    print("Clicked delete! Waiting a bit to see console errors...")
                    await asyncio.sleep(2)
                else:
                    print("Delete button not found in row!")
        except Exception as e:
            print("Error finding rows or clicking:", e)

        input("Press enter to exit (to read logs)...")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
