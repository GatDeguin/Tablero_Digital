/* VELORA GT: immutable app shell per release; updates are user-controlled.
   Never caches GPS, music, external providers, or other app scopes. */
const PREFIX='velora-gt:'+self.registration.scope+':',CACHE=PREFIX+'2901d9649296';
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
});
