"""UI regression probes. Owned HTML via set_content, no navigation policy changes."""
import asyncio,pathlib,json
import os,shutil
from playwright.async_api import async_playwright
EXECUTABLE=os.environ.get("BROWSER_EXECUTABLE") or shutil.which("chromium") or shutil.which("google-chrome")
ROOT=pathlib.Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=EXECUTABLE,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await b.new_page(viewport={'width':844,'height':390})
  await page.set_content((ROOT/'VELORA_GT.html').read_text(),wait_until='load');await page.wait_for_function('!!window.Velora')
  tests=[]
  tests.append({'name':'Mobile odometer stays visible','pass':await page.locator('#compactOdo').count()>0 and await page.locator('#compactOdo').is_visible()})
  await page.evaluate('document.querySelector("#focusButton").click()')
  tests.append({'name':'Focus has reachable GPS stop/start','pass':await page.locator('#focusGPS').count()>0 and await page.locator('#focusGPS').is_visible()})
  for t in tests: print(('PASS' if t['pass'] else 'FAIL'),t['name'])
  await b.close()
  assert all(t['pass'] for t in tests),json.dumps(tests)
asyncio.run(main())
