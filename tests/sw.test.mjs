import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function fixture(){
 const scope='https://example.test/velora/',handlers={},removed=[],stored=[],installURLs=[],pending=[];
 const cache={addAll:async xs=>installURLs.push(...xs),put:async(...v)=>stored.push(v),match:async()=>new Response('OFFLINE-SHELL')};
 const caches={open:async()=>cache,keys:async()=>['another-app','velora-gt:'+scope+':old'],delete:async k=>removed.push(k),match:async()=>new Response('OFFLINE-SHELL')};
 const self={registration:{scope},addEventListener:(n,fn)=>handlers[n]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 const env={self,caches,URL,fetch:async()=>{throw Error('offline')}};vm.runInNewContext(code,env);
 const evt=(url,mode='navigate',method='GET')=>({request:{url,mode,method},responded:null,respondWith(p){this.responded=p},waitUntil(p){pending.push(p)}});
 return {scope,handlers,removed,stored,installURLs,pending,evt,env};
}
test('service worker: install precaches only local shell',async()=>{const f=fixture();f.handlers.install({waitUntil:p=>f.pending.push(p)});await Promise.all(f.pending);assert.equal(f.installURLs.length,6);assert.ok(f.installURLs.every(u=>u.startsWith('./')));});
test('service worker: activate deletes only this app scope',async()=>{const f=fixture();f.handlers.activate({waitUntil:p=>f.pending.push(p)});await Promise.all(f.pending);assert.deepEqual(f.removed,['velora-gt:'+f.scope+':old']);});
test('service worker: external providers, other apps and POST are not intercepted',()=>{const f=fixture();for(const e of [f.evt('https://open.spotify.com/embed/track/x'),f.evt('https://example.test/other/'),f.evt(f.scope,'navigate','POST')]){f.handlers.fetch(e);assert.equal(e.responded,null);}});
test('service worker: app navigation falls back to offline shell',async()=>{const f=fixture(),e=f.evt(f.scope);f.handlers.fetch(e);assert.equal(await (await e.responded).text(),'OFFLINE-SHELL');});
test('service worker: navigating documentation cannot poison cached app shell',()=>{const f=fixture(),e=f.evt(f.scope+'docs/README.md');f.handlers.fetch(e);assert.equal(e.responded,null);});
test('v2 service worker: install does not force skipWaiting',()=>{const install=code.match(/self\.addEventListener\('install',[\s\S]*?(?=self\.addEventListener\('activate')/)[0];assert.ok(!install.includes('skipWaiting'));});
test('v2 service worker: activation requires explicit message',()=>{const f=fixture();assert.equal(typeof f.handlers.message,'function');});
test('v2 service worker: served navigation is not updated silently from the network',()=>{assert.ok(!code.includes("c.put('./index.html',copy)"));});
