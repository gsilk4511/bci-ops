import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import test from 'node:test';
import {seed} from '../Models/lib.js';
import {authorizePermission} from '../Models/permissions.js';

test('permanent import deletion is admin-only and scoped to the reviewed set, even over HTTP', {timeout:18000}, async()=>{
 for(const action of ['warehouse.purgePreview','warehouse.purgeApply'])
  assert.throws(()=>authorizePermission(action,'office',['inventory.view','catalog.delete']),/Admin/);
 const manifest=JSON.parse(await readFile(new URL('../scripts/manufacturer-import-nov20-2026.manifest.json',import.meta.url),'utf8'));
 const dir=await mkdtemp(join(tmpdir(),'bci-purge-http-'));
 const db=join(dir,'state.json'), state=seed(), originals=structuredClone(state.catalog);
 state.catalog.push(...manifest.items.map(({id,sku,brand,mpn})=>({id,sku,type:'material',name:'Synthetic imported material',price:0,changePrice:0,cost:0,needsPricing:true,manufacturer:brand,manufacturerPartNumber:mpn})));
 const protectedId=manifest.items[0].id;
 state.movements.push({id:'test-purge-history',catalogId:protectedId,quantity:-1});
 const originalMovements=structuredClone(state.movements);
 const initial=JSON.stringify(state);
 await writeFile(db,initial);
 const server=spawn(process.execPath,[fileURLToPath(new URL('../Server/server.js',import.meta.url))],{env:{
  PATH:process.env.PATH,APP_AUTH_MODE:'local',HOST:'127.0.0.1',PORT:'0',DB_PROVIDER:'json',DATA_FILE:db
 }});
 let output='';server.stderr.on('data',s=>{output+=s;});server.stdout.on('data',s=>{output+=s;});
 try{
  for(let n=0;n<150&&!/127\.0\.0\.1:\d+/.test(output)&&server.exitCode===null;n++)await sleep(25);
  const address=output.match(/127\.0\.0\.1:\d+/)?.[0];assert.ok(address,output);
  const post=(action,data)=>fetch('http://'+address+'/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,data})});
  const pre=await post('warehouse.purgePreview',{});assert.equal(pre.status,200,await pre.clone().text());
  const {result:p}=await pre.json();assert.equal(p.eligible,3842);assert.equal(p.protected,1);assert.equal(p.drift,0);
  assert.equal(await readFile(db,'utf8'),initial);
  const request={confirmation:'DELETE 3842',backupConfirmed:true,fingerprint:p.fingerprint};
  for(const invalid of [{...request,backupConfirmed:false},{...request,confirmation:'DELETE 3843'},{...request,fingerprint:'bad'},{...request,ids:[originals[0].id]}]){
   const rejected=await post('warehouse.purgeApply',invalid);assert.equal(rejected.status,400);
   assert.equal(await readFile(db,'utf8'),initial);
  }
  const applied=await post('warehouse.purgeApply',request);assert.equal(applied.status,200,await applied.clone().text());
  assert.equal((await applied.json()).result.deleted,3842);
  const saved=JSON.parse(await readFile(db,'utf8'));
  assert.deepEqual(saved.catalog.slice(0,originals.length),originals);
  assert.deepEqual(saved.catalog.slice(originals.length).map(row=>row.id),[protectedId]);
  assert.deepEqual(saved.movements,originalMovements);
  const retry=await post('warehouse.purgeApply',request);assert.equal(retry.status,400);
  assert.deepEqual(JSON.parse(await readFile(db,'utf8')),saved);
 }finally{
  if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}
  await rm(dir,{recursive:true,force:true});
 }
});
