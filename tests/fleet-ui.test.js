import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('Vehicles screen gives managers separate schedule and booking forms; assigned drivers can only complete cleanup',async()=>{
 const events={},context=vm.createContext({document:{addEventListener:(e,fn)=>events[e]=fn}});
 let manage=true, opened, saved;
 const data={vehicles:{today:'2026-11-26',staff:[],records:[{id:'test',name:'Test & truck',year:2024,make:'Make',model:'Van',odometer:53000,
  mayClean:true,needsCleanup:true,schedules:{inspection:{dueDate:'2026-11',status:'soon',appointment:{date:'2026-11-29',time:'09:30'}}},
  tireSets:[{name:'Winter',mileage:7000,mountedAt:52000}],documents:[],serviceHistory:[]}]}};
 const values={can:key=>key==='vehicles.view'||manage&&key==='vehicles.manage',data,esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
  f:(name,label)=>name+': '+label+'\n',modal:(title,fields,submit)=>opened={title,fields,submit},
  send:(action,fields)=>{saved={action,...fields};},today:()=>data.vehicles.today};
 const stub=exports=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});
 const fleet=new vm.SourceTextModule(readFileSync(new URL('../public/modules/fleet.js',import.meta.url),'utf8'),{context});
 await fleet.link(path=>path==='../app.js'?stub(values):stub({receiptPayload:()=>{}}));await fleet.evaluate();
 const page=()=>fleet.namespace.fleetPage();
 const click=(fleetAction,fleetType='')=>events.click({target:{closest:()=>({dataset:{fleetAction,fleetType,fleetId:'test'}})}});
 assert.match(page(),/Test &amp; truck/);assert.match(page(),/2024 Make Van/);
 assert.match(page(),/Next due[\s\S]*2026-11[\s\S]*Booked[\s\S]*2026-11-29/);
 assert.match(page(),/7,000 mi on set/);
 click('schedule','inspection');assert.match(opened.fields,/dueMonth:/);assert.doesNotMatch(opened.fields,/appointmentDate:/);
 click('book','inspection');assert.match(opened.fields,/appointmentDate:/);assert.doesNotMatch(opened.fields,/dueDate:/);
 await opened.submit({appointmentDate:'2026-12-02'});assert.equal(saved.operation,'bookService');
 manage=false;
 assert.doesNotMatch(page(),/data-fleet-action="(?:book|schedule|edit|upload)"/);
 assert.match(page(),/Mark cleanup done/);
 click('assigned-cleanup');await opened.submit({notes:'Clean'});
 assert.deepEqual(saved,{action:'vehicles.cleanup',id:'test',notes:'Clean'});
});
