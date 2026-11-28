import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('Vehicles screen gives managers separate schedule and booking forms; assigned drivers can only complete cleanup',async()=>{
 const events={},context=vm.createContext({document:{addEventListener:(e,fn)=>events[e]=fn,querySelector:()=>null}});
 let manage=true, opened, saved, renders=0;
 const sounds=[];context.Audio=class {constructor(url){this.url=url;} addEventListener(){} play(){sounds.push(this.url);return Promise.resolve();} pause(){}};
 const data={vehicles:{today:'2026-11-26',staff:[],records:[{id:'test',name:'Test & truck',year:2024,make:'Make',model:'Van',odometer:53000,
  clickSound:'mw-350z',mayClean:true,needsCleanup:true,schedules:{inspection:{dueDate:'2026-11',status:'soon',appointment:{date:'2026-11-29',time:'09:30'}}},
  tireSets:[{name:'Winter',mileage:7000,mountedAt:52000}],documents:[],serviceHistory:[]},{id:'other',name:'Another vehicle',schedules:{}}]}};
 const values={can:key=>key==='vehicles.view'||manage&&key==='vehicles.manage',data,esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
  f:(name,label)=>name+': '+label+'\n',modal:(title,fields,submit)=>opened={title,fields,submit},
  render:()=>{renders++;},send:(action,fields)=>{saved={action,...fields};},today:()=>data.vehicles.today};
 const stub=exports=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});
 const fleet=new vm.SourceTextModule(readFileSync(new URL('../public/modules/fleet.js',import.meta.url),'utf8'),{context});
 const asset=path=>new vm.SourceTextModule(readFileSync(new URL('../public/modules/'+path,import.meta.url),'utf8'),{context});
 await fleet.link(path=>path==='../app.js'?stub(values):path==='./work-entry.js'?stub({receiptPayload:()=>{}}):asset(path));await fleet.evaluate();
 const page=()=>fleet.namespace.fleetPage();
 const click=(fleetAction,fleetType='',fleetId='test')=>events.click({target:{closest:()=>({dataset:{fleetAction,fleetType,fleetId}})}});
 assert.match(page(),/Test &amp; truck/);assert.match(page(),/2024 Make Van/);
 assert.match(page(),/data-fleet-action="open"/);assert.match(page(),/Setup needed/);
 assert.doesNotMatch(page(),/VIN|Update odometer|Mount \/ swap|Another vehicle too/);
 assert.match(page(),/Another vehicle/);
 click('filter','soon','');
 assert.doesNotMatch(page(),/Another vehicle/);
 click('open');
 assert.deepEqual(sounds,['/api/vehicle-sound/mw-350z.mp3']);
 assert.match(page(),/Back to Fleet/);assert.match(page(),/Customize profile/);
 assert.doesNotMatch(page(),/Another vehicle/);
 assert.match(page(),/Next due[\s\S]*2026-11[\s\S]*Booked[\s\S]*2026-11-29/);
 assert.match(page(),/7,000 mi on set/);
 click('style');assert.match(opened.fields,/Photo trim/);
 assert.match(opened.fields,/Fleet card preview/);assert.match(opened.fields,/Vehicle click sound/);assert.match(opened.fields,/Preview sound/);
 await opened.submit({fleetStyle_ring:'matte-carbon',fleetStyle_lighting:'none',fleetStyle_banner:'aurora',fleetStyle_section:'pine',fleetStyle_text:'ice',clickSound:'ram-v8'});
 assert.equal(saved.operation,'saveStyle');assert.equal(saved.style.banner,'aurora');assert.equal(saved.clickSound,'ram-v8');
 data.vehicles.records[0].style=saved.style;
 assert.match(page(),/--fleet-surface:#152820/);
 click('back','','');assert.match(page(),/--fleet-surface:#152820/);
 assert.match(page(),/data-fleet-type="soon" aria-pressed="true"/);
 assert.doesNotMatch(page(),/Another vehicle/);
 assert.equal(renders,3);
 click('open');
 click('schedule','inspection');assert.match(opened.fields,/dueMonth:/);assert.doesNotMatch(opened.fields,/appointmentDate:/);
 click('book','inspection');assert.match(opened.fields,/appointmentDate:/);assert.doesNotMatch(opened.fields,/dueDate:/);
 await opened.submit({appointmentDate:'2026-12-02'});assert.equal(saved.operation,'bookService');
 manage=false;
 assert.doesNotMatch(page(),/data-fleet-action="(?:book|schedule|edit|upload)"/);
 assert.match(page(),/Mark cleanup done/);
 click('assigned-cleanup');await opened.submit({notes:'Clean'});
 assert.deepEqual(saved,{action:'vehicles.cleanup',id:'test',notes:'Clean'});
});
