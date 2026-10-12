"""VELORA v2 regressions. Chromium renders owned HTML; GPS, clock, storage and
ownership use explicit fixtures. No network navigation policies are modified."""
import asyncio,ast,json,pathlib
import os,shutil
from playwright.async_api import async_playwright
EXECUTABLE=os.environ.get("BROWSER_EXECUTABLE") or shutil.which("chromium") or shutil.which("google-chrome")
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs'/'v2'/'evidence';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'VELORA_GT.html').read_text()
module=ast.parse((ROOT/'tests'/'browser_v2.py').read_text())
FIXTURE=next(ast.literal_eval(n.value) for n in module.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='FIXTURE' for t in n.targets))
results=[]
def ok(name):results.append({'test':name,'status':'pass'});print('PASS',name)
async def wait_for(page,predicate,arg=None):
 for _ in range(400):
  if await page.evaluate(predicate,arg):return
  await page.wait_for_timeout(25)
 raise AssertionError('Timed out: '+predicate)
async def ready(browser,extra='',width=1440,height=940):
 p=await browser.new_page(viewport={'width':width,'height':height})
 fixture=FIXTURE.replace('</script>',extra+'</script>')
 await p.set_content(HTML.replace('<head>','<head>'+fixture,1),wait_until='load');await wait_for(p,'!!window.Velora');return p
async def sample(p,lon=0,speed=10,accuracy=5):
 accepted=await p.evaluate('Velora.inspect().accepted+Velora.inspect().rejected')
 await p.evaluate('([l,s,a])=>__sample(l,s,a)',[lon,speed,accuracy])
 await wait_for(p,'(n)=>Velora.inspect().accepted+Velora.inspect().rejected>n',arg=accepted)
async def main():
 async with async_playwright() as api:
  b=await api.chromium.launch(executable_path=EXECUTABLE,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  errors=[]
  p=await ready(b);p.on('pageerror',lambda e:errors.append(str(e)))
  await p.locator('#gpsButton').click();await sample(p,0,10);await sample(p,.00009,10)
  assert await p.evaluate('Velora.inspect().safetyPersisted');ok('Driving lock is included in persistent data')
  # Owned checkpoint bytes copied into another fixture = simulated reload.
  payload=await p.evaluate('JSON.stringify([...__store])')
  q=await ready(b,'window.__store=new Map('+payload+');')
  assert await q.evaluate('Velora.inspect().motionLock');ok('Simulated reload preserves driving lock')
  await q.locator('[data-view="settings"]').first.click();assert await q.evaluate('Velora.inspect().view')=='drive';ok('Reload does not reopen settings while lock persists');await q.close()
  # Queue a sample and stop in the same event: worker barrier must include its delta.
  before=await p.evaluate('Velora.inspect().odo')
  await p.evaluate('__sample(.00018,10,5);document.querySelector("#gpsButton").click()')
  await wait_for(p,'!Velora.inspect().gpsActive&&!Velora.inspect().stopping')
  assert await p.evaluate('Velora.inspect().odo')>before+9;ok('GPS finalization drains already queued Worker samples')
  await p.locator('[data-view="diagnostics"]').first.click();await p.locator('[data-action="unlock"]').click();await p.locator('[data-action="confirmYes"]').click()
  assert not await p.evaluate('Velora.inspect().safetyPersisted');ok('Explicit parking confirmation clears and saves the latch')
  # A completed trip is inspectable. Deletion keeps odometer unchanged.
  await p.locator('[data-view="trips"]').first.click();await p.locator('[data-action="detail"]').first.click()
  assert await p.locator('#detailRoute').is_visible();assert '3 puntos' in await p.locator('#screenContent').inner_text();ok('Historical trip inspector renders its recorded points')
  before=await p.evaluate('Velora.inspect().odo');await p.locator('[data-action="deleteTrip"]').click();await p.keyboard.press('Escape')
  assert await p.evaluate('Velora.inspect().history')==1;ok('Escape cancels trip deletion without mutation')
  await p.locator('[data-action="deleteTrip"]').click();await p.locator('[data-action="confirmYes"]').click()
  await wait_for(p,'Velora.inspect().history===0');assert await p.evaluate('Velora.inspect().odo')==before;ok('Confirmed trip deletion preserves ODO')
  # Reopening audio used to leave an invisible embed provider active.
  await p.locator('[data-view="media"]').first.click();await p.locator('#mediaURL').fill('https://youtu.be/aqz-KE-bpKQ');await p.locator('[data-action="loadEmbed"]').click()
  assert await p.locator('iframe').count()==1
  await p.locator('[data-view="media"]').first.click();assert await p.locator('iframe').count()==0 and await p.locator('#audioSource').inner_text()=='AUDIO LOCAL';ok('Reopening AUDIO removes stale external-player state')
  # Demo settings are a preview; no actual preference mutation survives exit.
  await p.locator('#demoButton').click();await p.locator('[data-view="settings"]').first.click();await p.locator('#themeSetting').select_option('amber')
  assert await p.locator('body').evaluate("e=>e.classList.contains('theme-amber')")
  await p.locator('#demoButton').click();assert not await p.locator('body').evaluate("e=>e.classList.contains('theme-amber')");ok('Demo theme previews are rolled back on exit')
  # First fix without native speed must not pretend to know a maximum.
  await p.locator('#gpsButton').click();await sample(p,0,None)
  assert await p.locator('#maxValue').inner_text()=='—';ok('Unknown initial speed does not manufacture a maximum of zero')
  await p.locator('#gpsButton').click();await wait_for(p,'!Velora.inspect().gpsActive')
  await p.emulate_media(reduced_motion='reduce');await p.wait_for_timeout(200)
  n=await p.evaluate('Velora.inspect().renderFrames');await p.wait_for_timeout(250);assert await p.evaluate('Velora.inspect().renderFrames')==n;ok('Renderer rests after reduced-motion transition settles')
  # Simulated unavailable exclusive lock. No real geolocation or state writes.
  q=await ready(b,"Object.defineProperty(navigator,'locks',{configurable:true,value:{request:(name,opts,cb)=>Promise.resolve(cb(null))}});")
  assert await q.evaluate('Velora.inspect().readOnly');await q.locator('#gpsButton').click();assert not await q.evaluate('Velora.inspect().gpsActive');assert await q.evaluate('__store.size')==0;ok('Contended writer fixture opens read-only and cannot record or checkpoint');await q.close()
  # All specified viewports, including min phone, verify no horizontal overflow.
  await p.close();p=await ready(b);p.on('pageerror',lambda e:errors.append(str(e)))
  await p.emulate_media(reduced_motion='reduce');await p.locator('#demoButton').click()
  for name,w,h in [('small-portrait',320,568),('small-landscape',640,360),('landscape',844,390),('desktop-hd',1920,1080),('tablet',768,1024)]:
   await p.set_viewport_size({'width':w,'height':h});await p.wait_for_timeout(100)
   assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),name
   touch=await p.evaluate('''() => [...document.querySelectorAll('#gpsButton,#playButton,.transport [data-action],.nav-key')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height).every(r=>r.width>=43.9&&r.height>=43.9)''')
   assert touch,(name,'primary target below 44 CSS px')
   if w<951 and w>h:
    assert await p.locator('#compactOdo').is_visible()
    await p.locator('.compact-tools [data-view="tools"]').click();assert await p.evaluate('Velora.inspect().view')=='tools'
    assert await p.locator('#screenContent [data-action="wake"]').count()==1;await p.locator('[data-view="drive"]').first.click()
   await p.screenshot(path=str(OUT/(name+'-v2.png')),full_page=True)
   ok(f'Extended viewport {name} {w}×{h}, primary targets ≥44 CSS px and all tools reachable')
  await p.set_viewport_size({'width':844,'height':390});await p.locator('.compact-tools [data-action="focus"]').click()
  assert await p.locator('#focusGPS').is_visible();await p.screenshot(path=str(OUT/'focus-landscape.png'),full_page=True);ok('Landscape focus preserves the physical GPS switch')
  assert not errors,errors;ok('No uncaught JS errors in extended workflows')
  report={'environment':'Chromium headless + explicit GPS/clock/checkpoint/locks fixtures; set_content (local HTTP navigation blocked by administrator). Renderer 2D fallback; no physical hardware tests.', 'browser':b.version,'tests':results,'errors':errors}
  (OUT/'extended-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  await b.close()
asyncio.run(main())
