import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import test from 'node:test';
import {seed} from '../Models/lib.js';

test('the shipped app handles counts, field receipts and warehouse receipts without double-posting stock', {timeout:12000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bci-warehouse-release-'));
 const db=join(dir,'state.json'), state=seed();
 const catalogId=state.catalog.find(x=>x.type==='material').id;
 Object.assign(state.workorders[0],{approvedAt:'2026-11-19',status:'released'});
 state.inventory=[{id:'warehouse-test',catalogId,location:'BCI Warehouse',quantity:2},{id:'old-test',catalogId,location:'Old stock location',quantity:9}];
 await writeFile(db,JSON.stringify(state));
 const server=spawn(process.execPath,[fileURLToPath(new URL('../Server/server.js',import.meta.url))],{env:{
  PATH:process.env.PATH,APP_AUTH_MODE:'local',HOST:'127.0.0.1',PORT:'0',DB_PROVIDER:'json',DATA_FILE:db
 }});
 let output='';
 server.stderr.on('data',chunk=>{output+=chunk;});
 server.stdout.on('data',chunk=>{output+=chunk;});
 try{
  for(let n=0;n<120&&!/127\.0\.0\.1:\d+/.test(output)&&server.exitCode===null;n++)await sleep(30);
  const address=output.match(/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(address,output);
  const get=path=>fetch('http://'+address+path);
  const act=(action,data)=>fetch('http://'+address+(action.startsWith('catalog.pack')?'/api/catalog-pack':'/api/action'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,data})});
  const health=await (await get('/api/health')).json();
  assert.equal(health.release,'0.10.14');
  assert.match(await (await get('/')).text(),/id="appRelease">v0\.10\.14<\/span>/);
  for(const path of ['/security','/security.html','/security.js','/security.css','/signin.js','/modules/agent-api.js','/api/security/session','/api/security/agent-credentials','/api/agent/v1/status']){
   assert.equal((await get(path)).status,404,path+' must stay disabled by default');
  }
  const photoId='a'.repeat(64);
  const fixturePack={format:'bci-catalog-pack-v1',items:[{brand:'Fixture',mpn:'PHOTO-FREE',name:'Photo-free wall plate',system:'Copper',partType:'Faceplate',photoId,photoStatus:'Exact'}],fitReferences:[]};
  const photoMissing=await get('/api/catalog-photo/'+photoId+'.jpg');
  assert.equal(photoMissing.status,404);
  const previewResponse=await act('catalog.packPreview',{pack:fixturePack});
  assert.equal(previewResponse.status,200,await previewResponse.clone().text());
  const photoFree=(await previewResponse.json()).result;
  assert.equal(photoFree.omittedPhotoCount,1);
  assert.equal(photoFree.new,1);
  const imported=await act('catalog.packImport',{pack:fixturePack,fingerprint:photoFree.fingerprint});
  assert.equal(imported.status,200,await imported.clone().text());
  assert.ok((await (await get('/api/state')).json()).catalog.some(item=>item.name==='Photo-free wall plate'&&!item.catalogInfo.photoId));
  const personalLayout=[{id:'projects',x:0,y:0,w:6,h:3},{id:'review',x:6,y:0,w:6,h:3}];
  const layoutSave=await act('dashboard.layout',{cards:personalLayout});
  assert.equal(layoutSave.status,200,await layoutSave.clone().text());
  const dashboard=await (await get('/api/state')).json();
  assert.deepEqual(dashboard.dashboardLayout,personalLayout);
  assert.equal(dashboard.dashboardLayouts,undefined);
  assert.equal((await act('dashboard.layout',{cards:personalLayout,email:'other@example.invalid'})).status,400);
  const truck=await (await act('vehicles.manage',{operation:'saveVehicle',name:'HTTP fixture truck',year:'2023'})).json();
  assert.ok(truck.ok);
  const truckId=truck.result.id;
  const style=await act('vehicles.manage',{operation:'saveStyle',id:truckId,style:{ring:'emerald',banner:'aurora'}});
  assert.equal(style.status,200,await style.clone().text());
  assert.equal((await style.json()).result.style.banner,'aurora');
  assert.equal((await act('vehicles.manage',{operation:'saveStyle',id:truckId,style:{banner:'url(https://example.invalid)'}})).status,400);
  const booked=await act('vehicles.manage',{operation:'bookService',id:truckId,type:'oil',appointmentDate:'2030-08-17',appointmentTime:'10:30'});
  assert.equal(booked.status,200);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2VkAAAAASUVORK5CYII=';
  const savedDoc=await (await act('vehicles.manage',{operation:'saveDocument',id:truckId,type:'dmv',name:'Synthetic DMV test',content:'data:image/png;base64,'+png})).json();
  assert.ok(savedDoc.ok);
  const doc=savedDoc.result.documents[0];
  assert.doesNotMatch(JSON.stringify(savedDoc),/iVBORw0/);
  const download=await get(doc.url);
  assert.equal(download.status,200);
  assert.equal(download.headers.get('content-type'),'image/png');
  assert.match(download.headers.get('content-disposition'),/^attachment/);
  assert.match(download.headers.get('cache-control'),/no-store/);
  assert.equal(Buffer.from(await download.arrayBuffer()).toString('base64'),png);
  const stateResponse=await (await get('/api/state')).json();
  assert.ok(!JSON.stringify(stateResponse).includes(png));
  assert.equal(stateResponse.vehicles.records[0].schedules.oil.appointment.time,'10:30');
  assert.equal(stateResponse.vehicles.records[0].style.ring,'emerald');
  const saved=await act('inventory.adjust',{catalogId,mode:'count',quantity:5,expectedQuantity:2,reason:'Test physical count'});
  assert.equal(saved.status,200,await saved.clone().text());
  const stale=await act('inventory.adjust',{catalogId,mode:'count',quantity:7,expectedQuantity:2,reason:'Stale tab'});
  assert.equal(stale.status,400,await stale.clone().text());
  const after=await (await get('/api/state')).json();
  assert.equal(after.inventory.find(x=>x.id==='warehouse-test').quantity,5);
  assert.equal(after.inventory.find(x=>x.id==='old-test').quantity,9);
  assert.equal(after.movements.filter(x=>x.catalogId===catalogId&&x.type==='audit-adjustment'&&x.location==='BCI Warehouse').length,1);
  assert.equal(after.movements.find(x=>x.catalogId===catalogId&&x.type==='audit-adjustment'&&x.location==='BCI Warehouse').quantity,3);
  // Work-order use and warehouse receipt are two distinct ledger movements.
  const workorderId=state.workorders[0].id;
  const content='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYV0AAAAASUVORK5CYII=';
  const fieldId=randomUUID();
  const fieldPayload={type:'material',workorderId,catalogId,quantity:6,submissionId:fieldId,receipt:{uploadId:fieldId,content}};
  const issue=await act('entry.add',fieldPayload);
  assert.equal(issue.status,200,await issue.clone().text());
  const issued=await (await get('/api/state')).json();
  assert.equal(issued.inventory.find(x=>x.id==='warehouse-test').quantity,-1);
  assert.ok(!JSON.stringify(issued).includes(content),'receipt bytes must not be in the state feed');
  const moneyRow=issued.moneyOrders.find(row=>row.id===workorderId);
  assert.equal(moneyRow.stateKey,'unbilled');
  assert.ok(moneyRow.total>0,'open work must reach Money state before closeout');
  const line=issued.warehouseFieldPurchases.find(x=>x.workorderId===workorderId);
  assert.ok(line,'linked receipt must appear in the warehouse feed');
  const woPhoto=await act('receipt.read',{workorderId,id:issued.workorders[0].receipts[0].id});
  assert.equal(woPhoto.status,200,await woPhoto.clone().text());
  assert.equal((await woPhoto.json()).result.content,content);
  const commitFields={id:line.id,workorderId,revision:line.revision};
  const commit=await act('inventory.commitFieldPurchase',commitFields);
  assert.equal(commit.status,200,await commit.clone().text());
  await act('inventory.commitFieldPurchase',commitFields);
  const committed=await (await get('/api/state')).json();
  assert.equal(committed.inventory.find(x=>x.id==='warehouse-test').quantity,5);
  assert.equal(committed.workorders[0].entries.length,1);
  assert.equal(committed.movements.filter(x=>x.catalogId===catalogId).length,3);
  assert.equal(committed.purchases.length,0);
  const receiveId=randomUUID();
  const incoming={warehouseReceive:true,catalogId,quantity:3,unitCost:2,vendor:'Synthetic Supply',receipt:{content,uploadId:receiveId},submissionId:receiveId};
  for(let i=0;i<2;i++){
   const receive=await act('inventory.receive',incoming);
   assert.equal(receive.status,200,await receive.clone().text());
  }
  const stocked=await (await get('/api/state')).json();
  const inbound=stocked.movements.find(x=>x.type==='receive'&&x.catalogId===catalogId&&x.quantity===3);
  assert.ok(inbound.warehouseReceiptId);
  assert.ok(Number.isFinite(Date.parse(inbound.at)));
  assert.equal(stocked.inventory.find(x=>x.id==='warehouse-test').quantity,8);
  assert.equal(stocked.purchases.length,1);
  const whPhoto=await act('inventory.receiptRead',{id:inbound.warehouseReceiptId});
  assert.equal(whPhoto.status,200,await whPhoto.clone().text());
  assert.equal((await whPhoto.json()).result.content,content);

 }finally{
  if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}
  await rm(dir,{recursive:true,force:true});
 }
});
