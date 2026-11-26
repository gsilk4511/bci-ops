import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dashboardLayout,saveDashboardLayout} from '../Models/dashboard-layouts.js';
import {visibleState} from '../Models/visibility.js';
import {authorizePermission} from '../Models/permissions.js';
import {seed} from '../Models/lib.js';
import {defaultLayout,validateLayout,addLayoutCard,orderLayout} from '../public/modules/dashboard-layout.js';

const office=['dashboard.view','workorders.view','workorder.review','invoice.group','finance.view','invoices.view','projects.view','tickets.view','inventory.view'];
const tech=['dashboard.view','workorders.view','clock.in','projects.view'];
test('dashboard grid snaps into validated bounds and pushes colliding cards down',()=>{
 const original=defaultLayout(office);
 assert.deepEqual(original.map(x=>x.id),['review','ready','payment','projects','overview']);
 assert.doesNotThrow(()=>validateLayout(original,office));
 const moved=orderLayout(original,'review',{x:8,y:3,w:6,h:4});
 const row=moved.find(x=>x.id==='review');
 assert.deepEqual(row,{id:'review',x:6,y:3,w:6,h:4});
 assert.equal(moved.find(x=>x.id==='projects').y,7);
 assert.doesNotThrow(()=>validateLayout(moved,office));
 assert.doesNotThrow(()=>validateLayout(addLayoutCard(moved,'warehouse'),office));
 assert.throws(()=>validateLayout([{id:'review',x:0,y:0,w:5,h:3},{id:'ready',x:2,y:1,w:5,h:3}],office),/overlap/);
 assert.throws(()=>orderLayout(moved,'review',{x:1.5}),/whole/);
});
test('layouts are private, validate allowed cards, and can be empty without resetting',()=>{
 const state=seed(),a={email:'One@example.invalid',permissions:office},b={email:'two@example.invalid',permissions:tech};
 assert.doesNotThrow(()=>authorizePermission('dashboard.layout','tech',tech));
 assert.throws(()=>authorizePermission('dashboard.layout','tech',[]));
 assert.throws(()=>saveDashboardLayout(state,b,{email:a.email,cards:[]}),/request/);
 assert.throws(()=>saveDashboardLayout(state,b,{cards:[{id:'payment',x:0,y:0,w:6,h:3}]}),/Invalid/);
 const custom=[{id:'projects',x:1,y:2,w:6,h:4}];
 saveDashboardLayout(state,a,{cards:custom});
 saveDashboardLayout(state,b,{cards:[]});
 assert.deepEqual(dashboardLayout(state,a),custom);
 assert.deepEqual(dashboardLayout(state,b),[]);
 assert.equal(visibleState(state,'admin',office).dashboardLayouts,undefined);
 assert.equal(dashboardLayout(state,{...b,permissions:[]}),undefined);
});

test('Dashboard shows project/work queues, preserves service desk, snaps pointer and saves draft',async()=>{
 const events={},cardStyles={},board={clientWidth:1200,dataset:{},querySelectorAll:()=>Object.entries(cardStyles).map(([key,style])=>({dataset:{dashCard:key},style}))};
 const context=vm.createContext({document:{addEventListener:(event,fn)=>events[event]=fn,querySelector:()=>({value:'signoff'})},
  window:{scrollY:0,matchMedia:()=>({matches:true})},getComputedStyle:()=>({columnGap:'0',rowGap:'0',gridAutoRows:'66px'})});
 const layout=defaultLayout(office);
 for(const row of layout)cardStyles[row.id]={};
 const client={id:'c1',name:'Customer'};
 const project={id:'p1',name:'Warehouse Build',nextStep:'Call vendor',followUpDue:'2026-12-01'};
 const row={id:'w1',projectId:'p1',title:'Fiber closeout',closeout:{at:'2026-11-26'},entries:[],status:'ready-for-review'};
 let saved;
 const values={
  me:{email:'office@example.invalid',permissions:office}, today:()=> '2026-11-26',can:key=>office.includes(key),
  card:(title)=>title,catalog:()=>null,data:{projects:[project],customers:[client],workorders:[row],dashboardLayout:layout,ticketOverview:{tickets:[]}},
  esc:String,fmt:n=>String(n||0),head:(title,kicker,sub,action)=>title+action,labelFor:()=>project.name,modal:()=>{},
  f:()=>'',projectLabel:p=>p.name,render:()=>{},send:async(action,data)=>{saved={action,...data};},show:()=>{},status:String,view:'dashboard'
 };
 const app=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});
 const asset=path=>new vm.SourceTextModule(readFileSync(new URL('../public/modules/'+path,import.meta.url),'utf8'),{context});
 const screen=asset('overview.js');await screen.link(path=>path==='../app.js'?app:asset(path));await screen.evaluate();
 const page=()=>screen.namespace.dashboard();
 const click=(dashAction,dashId='')=>events.click({target:{closest:()=>({dataset:{dashAction,dashId}})}});
 assert.match(page(),/Dashboard[\s\S]*Service desk/);
 assert.match(page(),/Work orders awaiting review[\s\S]*Fiber closeout/);
 assert.match(page(),/Open projects[\s\S]*Warehouse Build[\s\S]*Call vendor/);
 assert.doesNotMatch(page(),/<h2>Tickets<\/h2>/);
 click('edit');
 assert.match(page(),/Position &amp; size/);
 const element={dataset:{dashCard:'review'}};
 const grip={dataset:{dashDrag:'move'},closest:selector=>selector==='.dashboard-board'?board:element,setPointerCapture(){}};
 events.pointerdown({target:{closest:()=>grip},button:0,pointerId:1,clientX:10,clientY:10,preventDefault(){}});
 events.pointermove({pointerId:1,clientX:210,clientY:76});
 assert.match(cardStyles.review.cssText,/grid-column:3 \/ span 7;grid-row:2/);
 events.pointerup({type:'pointerup',pointerId:1});
 click('add');
 assert.match(page(),/data-dash-card="signoff"/);
 click('remove','signoff');click('save');
 assert.equal(saved.action,'dashboard.layout');
 assert.equal(saved.cards.find(r=>r.id==='review').x,2);
 assert.equal(saved.cards.find(r=>r.id==='review').y,1);
 assert.ok(!saved.cards.some(r=>r.id==='signoff'));
});
