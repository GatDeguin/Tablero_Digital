"""Chromium DOM smoke tests. GPS/storage are explicitly simulated, not hardware tests.
Navigation is restricted in this environment; the owned HTML is loaded with set_content.
No browser permissions or managed policies are altered.
"""
import asyncio, json, pathlib, re, wave, io, math, struct
import os,shutil
from playwright.async_api import async_playwright
EXECUTABLE=os.environ.get("BROWSER_EXECUTABLE") or shutil.which("chromium") or shutil.which("google-chrome")
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'v2'/'evidence'; OUT.mkdir(exist_ok=True)
HTML=(ROOT/'VELORA_GT.html').read_text()
FIXTURE='''<script>
window.__store=new Map();window.__gps=null;window.__gpsError=null;window.__clears=0;
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>__store.get(k)||null,setItem:(k,v)=>__store.set(k,String(v)),removeItem:k=>__store.delete(k)}});
Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw Error('TEST: IndexedDB unavailable')}}});
Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(ok,err){window.__gps=ok;window.__gpsError=err;return 17},clearWatch(){window.__clears++;window.__gps=null}}});
window.__time=Date.now();Date.now=()=>window.__time;window.__sample=(lon,speed=10,accuracy=5)=>{__time+=1000;__gps({timestamp:__time,coords:{latitude:0,longitude:lon,speed,accuracy,heading:90,altitude:20,altitudeAccuracy:5}})};
</script>'''
RESULTS=[]
def passed(s):RESULTS.append({'test':s,'status':'pass'});print('PASS',s)
async def wait_for(page,predicate,arg=None):
 for _ in range(400):
  if await page.evaluate(predicate,arg):return
  await page.wait_for_timeout(25)
 raise AssertionError('Timed out: '+predicate)
async def ready(page,fixture=False):
 await page.set_content(HTML.replace('<head>','<head>'+FIXTURE,1) if fixture else HTML,wait_until='load')
 await wait_for(page,'!!window.Velora')
async def sample(page,lon,speed=10,accuracy=5):
 before=await page.evaluate('Velora.inspect().points')
 await page.evaluate('([lon,speed,accuracy])=>__sample(lon,speed,accuracy)',[lon,speed,accuracy])
 await page.wait_for_timeout(80)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=EXECUTABLE,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1440,'height':940})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await ready(page)
  assert await page.locator('#speedValue').inner_text() in ['—','--','–'];passed('No GPS: velocidad desconocida, no cero ficticio')
  assert (await page.evaluate('Velora.inspect()'))['render']=='2D';passed('Fallback real al no disponer de WebGL')
  await page.locator('#demoButton').click();await page.wait_for_timeout(300)
  state=await page.evaluate('Velora.inspect()');assert state['demo'] and state['speed']>0 and state['odo']==0 and state['history']==0;passed('Demo separada de ODO e historial')
  await page.locator('#demoButton').click();assert not (await page.evaluate('Velora.inspect()'))['demo'];passed('Salir de demo vuelve a datos reales')
  await page.locator('#gpsButton').click();assert 'HTTPS' in await page.locator('#annunciator').inner_text();passed('GPS bloqueado con mensaje en contexto inseguro')
  for name in ['trips','media','parking','settings','help','diagnostics','drive']:
   await page.locator(f'button[data-view="{name}"]').first.click()
   assert (await page.evaluate('Velora.inspect()'))['view']==name
  passed('Navegación por las siete pantallas integradas')
  for i in range(20):
   await page.locator('button[data-view="settings"]').first.click()
   await page.locator('button[data-view="drive"]').first.click()
  assert await page.locator('#screenContent').count()==1;passed('20 ciclos de cambio de vista sin duplicar pantalla')
  await page.emulate_media(reduced_motion='reduce');await page.wait_for_timeout(80)
  assert (await page.evaluate('Velora.inspect()'))['reduced'];passed('Cambio de movimiento reducido durante sesión')
  await page.emulate_media(reduced_motion='no-preference')
  await page.locator('#focusButton').click();assert await page.locator('body').evaluate("e=>e.classList.contains('focus-mode')");await page.locator('#focusButton').click();passed('Modo foco entra y vuelve a disposición completa')
  # Physical browser permissions not requested: explicitly injected deterministic test GPS.
  await page.close();page=await browser.new_page(viewport={'width':1440,'height':940});page.on('pageerror',lambda e:errors.append(str(e)))
  await ready(page,True)
  await page.locator('#gpsButton').click();assert (await page.evaluate('Velora.inspect()'))['gpsActive'];passed('Adaptador GPS: watchPosition iniciado por acción explícita')
  await sample(page,0);await sample(page,.00009)
  state=await page.evaluate('Velora.inspect()');assert 9<state['odo']<11 and state['speed']==36 and state['motionLock'];passed('GPS simulado + Worker real: distancia, velocidad y bloqueo')
  await page.locator('button[data-view="settings"]').first.click();assert (await page.evaluate('Velora.inspect()'))['view']=='drive';passed('Ajustes no abren en movimiento')
  before=state['odo'];await sample(page,.04,10,250)
  state=await page.evaluate('Velora.inspect()');assert state['odo']==before and state['speed'] is None;passed('GPS impreciso no suma kilómetros y retira velocidad')
  for i in range(6):await sample(page,.00009,0)
  assert not (await page.evaluate('Velora.inspect()'))['motionLock'];passed('Desbloqueo tras cinco segundos de detención observada')
  await page.locator('button[data-view="media"]').first.click()
  await page.locator('#mediaURL').fill('javascript:alert(1)');await page.locator('[data-action="loadEmbed"]').click()
  assert await page.locator('iframe').count()==0;passed('Reproductor rechaza URL ejecutable')
  await page.locator('#mediaURL').fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');await page.locator('[data-action="loadEmbed"]').click()
  assert await page.locator('iframe').count()==1
  assert 'youtube-nocookie.com/embed/' in await page.locator('iframe').get_attribute('src');passed('YouTube: URL oficial embebida (sin validar reproducción remota)')
  await sample(page,.00018,10)
  assert await page.locator('iframe').count()==0 and (await page.evaluate('Velora.inspect()'))['view']=='drive';passed('Comenzar a moverse desmonta reproductor y vuelve a instrumentos')
  await page.evaluate('__gpsError({code:2})');await page.wait_for_timeout(150)
  state=await page.evaluate('Velora.inspect()');assert state['speed'] is None and state['motionLock'];passed('Error de GPS conserva bloqueo y muestra velocidad desconocida')
  for i in range(6):await sample(page,.00018,0)
  await page.locator('#gpsButton').click();await wait_for(page,'!Velora.inspect().gpsActive&&!Velora.inspect().stopping');state=await page.evaluate('Velora.inspect()')
  assert not state['gpsActive'] and state['history']==1 and await page.evaluate('__clears')==1;passed('Finalizar GPS libera watch y guarda un viaje')
  await page.locator('[data-view="settings"]').first.click()
  await page.locator('#unitSetting').select_option('mph');assert await page.locator('#speedUnit').inner_text()=='mph';passed('Unidades mph/mi aplicadas a instrumentación')
  await page.locator('#limitSetting').fill('999');await page.locator('#limitSetting').dispatch_event('change')
  assert await page.locator('#limitSetting').input_value()=='80';passed('Aviso manual rechaza límite fuera de rango')
  await page.locator('#unitSetting').select_option('kmh')
  await page.locator('#odoBase').fill('15000');await page.locator('[data-action="setBase"]').click()
  assert (await page.evaluate('Velora.inspect()'))['view']=='confirm';await page.locator('[data-action="confirmYes"]').click()
  assert '15000' in (await page.locator('#odoValue').inner_text()).replace('.','');passed('Base informativa requiere confirmación antes de aplicarse')
  await page.locator('[data-view="trips"]').first.click()
  old=(await page.evaluate('Velora.inspect()'))['tripA'];await page.locator('[data-action="resetA"]').first.click();await page.locator('[data-action="confirmYes"]').click()
  assert (await page.evaluate('Velora.inspect()'))['tripA']==0
  await page.locator('[data-action="undo"]').click();assert abs((await page.evaluate('Velora.inspect()'))['tripA']-old)<1e-9;passed('Trip A: confirmación de reinicio y deshacer')
  await page.wait_for_timeout(150)
  saved=await page.evaluate("JSON.parse([...__store.values()][0])")
  assert saved['odo']>0 and saved['base']==15000000;passed('Checkpoint de respaldo conserva ODO y base (almacenamiento simulado)')
  await page.locator('[data-view="settings"]').first.click();await page.locator('[data-action="deleteData"]').click();await page.locator('[data-action="confirmNo"]').click()
  assert (await page.evaluate('Velora.inspect()'))['odo']>0;passed('Cancelar borrado preserva los datos')
  await page.locator('[data-view="media"]').first.click()
  await page.locator('#mediaURL').fill('https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6');await page.locator('[data-action="loadEmbed"]').click()
  assert 'open.spotify.com/embed/playlist/' in await page.locator('iframe').get_attribute('src');passed('Spotify: montaje del embed oficial sin credenciales en el HTML')
  await page.locator('[data-view="drive"]').first.click();assert await page.locator('iframe').count()==0;passed('Cambiar de vista desmonta el embed de Spotify')
  pcm=io.BytesIO()
  with wave.open(pcm,'wb') as wav:
   wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(8000)
   wav.writeframes(b''.join(struct.pack('<h',int(2000*math.sin(2*math.pi*220*i/8000))) for i in range(32000)))
  await page.locator('#audioFiles').set_input_files({'name':'Prueba-local.wav','mimeType':'audio/wav','buffer':pcm.getvalue()})
  await wait_for(page,'document.querySelector("#audio").duration===4')
  assert 'Prueba-local' in await page.locator('#trackTitle').inner_text();passed('WAV local: selección y metadatos decodificados por Chromium')
  await page.locator('#playButton').click();await wait_for(page,'document.querySelector("#audio").currentTime>.1')
  await page.locator('#playButton').click();assert await page.locator('#audio').evaluate('a=>a.paused');passed('Audio local: reproducción avanza y pausa efectivamente')
  await page.locator('#volume').evaluate("e=>{e.value=.3;e.dispatchEvent(new Event('input',{bubbles:true}))}")
  assert await page.locator('#audio').evaluate('a=>a.volume')==.3;passed('Volumen local enlazado al elemento de audio')
  await page.locator('#seek').evaluate("e=>{e.value=500;e.dispatchEvent(new Event('input',{bubbles:true}))}")
  assert abs((await page.locator('#audio').evaluate('a=>a.currentTime'))-2)<.1;passed('Búsqueda temporal del audio local')
  before=(await page.evaluate('Velora.inspect()'))['odo']
  await page.locator('#backupFile').set_input_files({'name':'incorrecto.json','mimeType':'application/json','buffer':b'{"version":99}'})
  assert (await page.evaluate('Velora.inspect()'))['odo']==before;passed('Importación JSON inválida no altera kilómetros')
  # Responsive verification and captured evidence from the real 2D fallback.
  await page.close();page=await browser.new_page(viewport={'width':1440,'height':940});page.on('pageerror',lambda e:errors.append(str(e)))
  await ready(page)
  await page.locator('#demoButton').click()
  for name,w,h in [('desktop',1440,940),('landscape',844,390),('portrait',390,844),('tablet',768,1024)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(180)
   dims=await page.evaluate('({w:innerWidth,sw:document.documentElement.scrollWidth})')
   assert dims['sw']<=w+2,(name,dims)
   visible=await page.evaluate('''() => { const body=document.querySelector('#cockpit').getBoundingClientRect(), screen=document.querySelector('#screenContent').getBoundingClientRect(), metrics=document.querySelector('.screen-metrics').getBoundingClientRect(); return {metricsFit:metrics.bottom<=screen.bottom+1,inside:[...document.querySelectorAll('#speedHost,#compassHost,.computer-column')].filter(e=>e.getBoundingClientRect().width).every(e=>e.getBoundingClientRect().right<=body.right+1)} }''')
   assert visible['inside'],(name,'instrumento fuera del cockpit')
   assert visible['metricsFit'],(name,'métricas esenciales recortadas')
   await page.screenshot(path=str(OUT/f'{name}.png'),full_page=True)
   passed(f'Vista {name} {w}×{h}: sin desborde horizontal')
  assert not errors,errors;passed('Ninguna excepción JavaScript no controlada durante las pruebas')
  report={'environment':'Chromium headless; set_content; WebGL unavailable. Explicit GPS/clock/checkpoint fixtures; no live GPS, remote media or service-worker verification.','browser':browser.version,'tests':RESULTS,'pageErrors':errors}
  (OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  await browser.close()
asyncio.run(main())
