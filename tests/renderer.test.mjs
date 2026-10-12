import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const b={};vm.createContext(b);vm.runInContext(fs.readFileSync('src/renderer.js','utf8')+'\nthis.Renderer=CockpitRenderer;',b);
function renderer(){const r=Object.create(b.Renderer.prototype);Object.assign(r,{unit:'kmh',headingTarget:0,invalidate(){}});return r;}
test('renderer: absent speed and heading withdraw needles instead of measuring zero',()=>{const r=renderer();r.set(null,null);assert.equal(r.speedKnown,false);assert.equal(r.headingKnown,false);});
test('renderer: true zero speed remains a known measurement',()=>{const r=renderer();r.set(0,90);assert.equal(r.speedKnown,true);assert.equal(r.headingKnown,true);});
