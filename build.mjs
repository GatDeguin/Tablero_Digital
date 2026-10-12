import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const core=(await readFile('src/core.mjs','utf8')).replace(/\bexport\s+/g,'');
const common=[core,await readFile('src/renderer.js','utf8'),await readFile('src/storage.js','utf8'),await readFile('src/platform.js','utf8'),await readFile('src/app.js','utf8')].join('\n');
const css=await readFile('src/style.css','utf8'),template=await readFile('src/template.html','utf8');
function html(pwa){const script=`const PWA_BUILD=${pwa};\nconst CORE_SOURCE=${JSON.stringify(core)};\n${common}`;new Function(script);const scriptHash=createHash('sha256').update(script.replace(/<\/script/gi,'<\\/script')).digest('base64');const csp=`default-src 'none'; script-src 'self' 'sha256-${scriptHash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; frame-src https://open.spotify.com https://www.youtube-nocookie.com; manifest-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'`;return template.replace('<head>',()=>'<head>\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">').replace('/*STYLE*/',()=>css).replace('/*APP*/',()=>script.replace(/<\/script/gi,'<\\/script')).replace('<!--PWA-->',pwa?'<link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="./assets/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="./assets/icon-192.png">':'<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 40 40%27%3E%3Crect width=%2740%27 height=%2740%27 rx=%278%27 fill=%27%23131e23%27/%3E%3Cpath d=%27M10 10 20 30 30 10%27 fill=%27none%27 stroke=%27%23c9dccc%27 stroke-width=%273%27/%3E%3C/svg%3E">');}
const standalone=html(false),pages=html(true);await writeFile('index.html',pages);await writeFile('VELORA_GT.html',standalone);// The release HTML stays in the project root; delivery copies are made separately.
const hash=createHash('sha256').update(pages).digest('hex').slice(0,12);
const sw=`/* VELORA GT: immutable app shell per release; updates are user-controlled.
   Never caches GPS, music, external providers, or other app scopes. */
const PREFIX='velora-gt:'+self.registration.scope+':',CACHE=PREFIX+'${hash}';
const FILES=['./','./index.html','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
const URLS=FILES.map(f=>new URL(f,self.registration.scope).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVATE_UPDATE'&&e.source?.url?.startsWith(self.registration.scope))e.waitUntil(self.skipWaiting());});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET'||!r.url.startsWith(self.registration.scope))return;
 const isApp=r.mode==='navigate'&&[new URL(self.registration.scope).pathname,new URL(self.registration.scope).pathname+'index.html'].includes(new URL(r.url).pathname);
 if(!isApp&&!URLS.includes(r.url))return;
 e.respondWith(caches.open(CACHE).then(async cache=>{
   const key=isApp?new URL('./index.html',self.registration.scope).href:r;
   return await cache.match(key)||fetch(r);
 }));
});\n`;
await writeFile('sw.js',sw);
await writeFile('manifest.webmanifest',JSON.stringify({id:'./',name:'VELORA GT — Cockpit GPS',short_name:'VELORA GT',description:'Instrumentos GPS 3D, recorridos y audio local.',lang:'es-AR',start_url:'./',scope:'./',display:'standalone',orientation:'any',background_color:'#101519',theme_color:'#101519',icons:[{src:'assets/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},{src:'assets/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},null,2));
await writeFile('.nojekyll','');await mkdir('docs',{recursive:true});
await writeFile('docs/BUILD.json',JSON.stringify({version:'2.0.0',hash,generated:new Date().toISOString(),standaloneBytes:Buffer.byteLength(standalone),pagesBytes:Buffer.byteLength(pages),externalRuntimeDependencies:0,activeKernel:'JavaScript Worker',rust:'reference source only; not compiled or integrated'},null,2));
console.log(`Built standalone: ${Buffer.byteLength(standalone)} bytes; Pages: ${Buffer.byteLength(pages)} bytes; cache ${hash}`);
