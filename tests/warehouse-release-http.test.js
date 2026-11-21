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
  const act=(action,data)=>fetch('http://'+address+'/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,data})});
  const health=await (await get('/api/health')).json();
  assert.equal(health.release,'0.8.8');
  assert.match(await (await get('/')).text(),/id="appRelease">v0\.8\.8<\/span>/);
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
