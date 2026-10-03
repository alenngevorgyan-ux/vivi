import sys, asyncio, json
from playwright.async_api import async_playwright
async def main(jobs):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for html, png, w, h, sc in jobs:
            pg = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=sc)
            await pg.goto('file://' + html)
            await pg.wait_for_timeout(900)
            await pg.screenshot(path=png)
            await pg.close()
        await b.close()
asyncio.run(main(json.load(open(sys.argv[1]))))
