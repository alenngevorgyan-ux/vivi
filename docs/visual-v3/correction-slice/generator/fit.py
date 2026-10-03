import sys, asyncio, json, re
from playwright.async_api import async_playwright
async def main(jobs):
    out={}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for html, png, w, h, sc in jobs:
            pg = await b.new_page(viewport={'width': w, 'height': h})
            await pg.goto('file://' + html); await pg.wait_for_timeout(600)
            bot = await pg.evaluate("()=>{const o=document.querySelector('x-dc > div');const ds=[...o.children].filter(e=>e.tagName==='DIV');const inner=ds[1];let m=inner.getBoundingClientRect().bottom;inner.querySelectorAll('*').forEach(e=>{const q=e.getBoundingClientRect();if(q.width>0&&q.height>0)m=Math.max(m,q.bottom)});return m}")
            out[png.split('/')[-1][:-4]] = int(bot)
        await b.close()
    print(json.dumps(out))
asyncio.run(main(json.load(open(sys.argv[1]))))
