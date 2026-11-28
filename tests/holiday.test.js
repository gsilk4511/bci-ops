import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isHolidaySeason, initHoliday} from '../public/modules/holiday.js';
import {readFile} from 'node:fs/promises';

test('holiday uses Thanksgiving and midnight in Eastern time, not the server timezone', () => {
  for (const [stamp,expected] of [
    ['2026-11-26T04:59:59Z',false], ['2026-11-26T05:00:00Z',true],
    ['2027-01-01T04:59:59Z',true], ['2027-01-01T05:00:00Z',false],
    ['2027-11-25T04:59:59Z',false], ['2027-11-25T05:00:00Z',true],
    ['2025-11-27T05:00:00Z',true], ['2026-07-01T12:00:00Z',false],
  ]) assert.equal(isHolidaySeason(new Date(stamp)),expected,stamp);
});

function fixture(){
  const docEvents=new Map(), winEvents=new Map(), scheduled=new Map(), classes=new Set();
  let id=0, modal=false, focus=false, observer, layer;
  const motion={matches:false,addEventListener(ev,fn){this[ev]=fn}};
  const header={classList:{toggle(n,v){if(v)classes.add(n);else classes.delete(n)},contains:n=>classes.has(n)}};
  const doc={
    hidden:false,activeElement:{closest:()=>focus},
    querySelector(s){return s==='.operations-header'?header:modal},
    querySelectorAll(){return [{}]},
    addEventListener:(ev,fn)=>docEvents.set(ev,fn),
    createElement(tag){return {tag,children:[],attrs:{},append(o){this.children.push(o)},setAttribute(n,v){this.attrs[n]=v},remove(){layer=null}}},
    body:{append(el){layer=el}}
  };
  const win={
    matchMedia:()=>motion, setInterval(){}, clearTimeout(key){scheduled.delete(key)},
    setTimeout(fn,ms){scheduled.set(++id,{fn,ms});return id},
    addEventListener:(ev,fn)=>winEvents.set(ev,fn),
    MutationObserver:class {constructor(fn){observer=fn} observe(){}}
  };
  function tick(min,max=min){
    const hit=[...scheduled.entries()].find(([,v])=>v.ms>=min&&v.ms<=max);
    assert.ok(hit,'expected timer'); scheduled.delete(hit[0]); hit[1].fn();
  }
  return {doc,win,header,motion,tick,get layer(){return layer},scheduled,docEvents,winEvents,setModal(){modal=true;observer()},focus(){focus=true;docEvents.get('focusin')()}};
}

test('shell schedules noninterfering short flurries and stops for dialog, focus, print, hidden tabs and reduced motion',()=>{
  const f=fixture();
  initHoliday(f.doc,f.win,()=>new Date('2026-12-20T12:00:00Z'));
  assert.equal(f.header.classList.contains('bci-holiday'),true);
  f.tick(35000); assert.equal(f.layer.children.length,12);
  assert.equal(f.layer.attrs['aria-hidden'],'true');
  f.tick(4400);assert.equal(f.layer,null);
  f.tick(240000,359999);assert.ok(f.layer);
  f.winEvents.get('beforeprint')();assert.equal(f.layer,null);
  f.tick(240000,359999);assert.ok(f.layer);
  f.doc.hidden=true;f.docEvents.get('visibilitychange')();
  assert.equal(f.layer,null);assert.equal(f.scheduled.size,0);
  f.doc.hidden=false;f.docEvents.get('visibilitychange')();f.tick(35000);assert.ok(f.layer);
  f.setModal();assert.equal(f.layer,null);
  f.tick(240000,359999);assert.equal(f.layer,null);
  f.motion.matches=true;f.motion.change();assert.equal(f.scheduled.size,0);
  assert.equal(f.header.classList.contains('bci-holiday'),true);
  const g=fixture();initHoliday(g.doc,g.win,()=>new Date('2026-12-20T12:00:00Z'));
  g.tick(35000);g.focus();assert.equal(g.layer,null);g.tick(240000,359999);assert.equal(g.layer,null);
  const off=fixture();initHoliday(off.doc,off.win,()=>new Date('2027-01-01T12:00:00Z'));
  assert.equal(off.header.classList.contains('bci-holiday'),false);assert.equal(off.scheduled.size,0);
});

test('decorations are loaded by the workspace shell and excluded from print and pointer handling',async()=>{
  const [html,css]=await Promise.all(['index.html','holiday.css'].map(f=>readFile(new URL('../public/'+f,import.meta.url),'utf8')));
  assert.match(html,/<header class="operations-header">/);assert.match(html,/src="\/modules\/holiday\.js" type="module"/);
  assert.match(css,/url\("\/holiday-sprig\.svg"\)/);assert.match(css,/\.bci-snowfall\s*\{[^}]+pointer-events:\s*none;/s);
  assert.match(css,/@media print\s*\{[^}]+display:\s*none !important/s);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});
