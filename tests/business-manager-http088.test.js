import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {seed} from '../Models/lib.js';

const typeEmail={admin:'admin@example.invalid',reader:'reader@example.invalid',tech:'tech@example.invalid'};
async function withManagerServer(ready){
 const dir=await mkdtemp(join(tmpdir(),'bci-manager-http-'));
 const team='https://bci-manager-test.cloudflareaccess.com',aud='isolated-manager-test';
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const token=email=>{
  const input=b64({alg:'RS256',kid:'manager-test-key'})+'.'+b64({iss:team,aud,email,exp:Math.floor(Date.now()/1000)+120});
  return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');
 };
 const keyset={keys:[{...publicKey.export({format:'jwk'}),kid:'manager-test-key'}]};
 const db=join(dir,'state.json'),setup=join(dir,'mock-keys.mjs');
 await writeFile(setup,'const fetchOriginal=globalThis.fetch;globalThis.fetch=(url,...args)=>String(url)==='+JSON.stringify(team+'/cdn-cgi/access/certs')+'?Promise.resolve(Response.json('+JSON.stringify(keyset)+')):fetchOriginal(url,...args);');
 const state=seed();
 state.users=[{email:typeEmail.tech,role:'tech'},{email:typeEmail.reader,role:'tech',profileId:'manager-reader'}];
 state.permissionProfiles=[{id:'manager-reader',name:'Manager read only',schemaVersion:4,modes:{staff:'read',businessManager:'read'},permissions:['staff.view','businessManager.view']}];
 await writeFile(db,JSON.stringify(state));
 const server=spawn(process.execPath,['--import',setup,fileURLToPath(new URL('../Server/server.js',import.meta.url))],{env:{
  ...Object.fromEntries(['PATH','HOME','SYSTEMROOT','TEMP'].flatMap(key=>process.env[key]?[[key,process.env[key]]]:[])),
  APP_AUTH_MODE:'cloudflare',CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud,BCI_ADMIN_EMAILS:typeEmail.admin,
  HOST:'127.0.0.1',PORT:'0',DB_PROVIDER:'json',DATA_FILE:db,
 }});
 let log='';
 server.stderr.on('data',chunk=>{log+=chunk;});
 server.stdout.on('data',chunk=>{log+=chunk;});
 try{
  for(let i=0;i<120&&!/127\.0\.0\.1:\d+/.test(log)&&server.exitCode===null;i++)await sleep(30);
  const address=log.match(/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(address,log);
  const req=(role,path='/api/state',action,data)=>fetch('http://'+address+path,{
   method:action?'POST':'GET',
   headers:{...(role?{'cf-access-jwt-assertion':token(typeEmail[role])}:{}),...(action?{'content-type':'application/json'}:{})},
   ...(action?{body:JSON.stringify({action,data})}:{}),
  });
  const act=(role,action,data)=>req(role,'/api/action',action,data);
  const persisted=async()=>JSON.parse(await readFile(db,'utf8'));
  await ready({req,act,persisted});
 }finally{
  if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}
  await rm(dir,{recursive:true,force:true});
 }
}

async function ok(response){
 assert.equal(response.status,200,await response.clone().text());
 return response.json();
}

test('authenticated Business Manager tracker keeps write and collection scope boundaries', {timeout:15000}, async()=>{
 await withManagerServer(async ({req,act,persisted})=>{
  const view=async role=>{
   const data=await ok(await req(role));
   assert.equal(Object.hasOwn(data,'businessManager'),false,'raw tracker storage must not be visible');
   return data.staff?.businessManager;
  };
  const action=(role,operation,data)=>act(role,'businessManager.manage',{operation,...data});
  const denied=async response=>assert.equal(response.status,403,await response.clone().text());
  const invalid=async response=>assert.equal(response.status,400,await response.clone().text());
  assert.equal((await req(null)).status,401);
  assert.equal(await view('tech'),undefined);
  const initial=await persisted();
  const createFields={name:'Synthetic Van One',plate:'TEST ONE',registrationDueDate:'2020-01-01',oilDueDate:'2090-03-01',oilDueMileage:50000};
  await denied(await action('tech','saveVehicle',createFields));
  await denied(await action('reader','saveVehicle',createFields));
  await invalid(await action('admin','saveVehicle',{...createFields,registrationDueDate:'2027-02-29'}));
  await invalid(await action('admin','saveBill',{name:'Synthetic invalid bill',dueDate:'tomorrow'}));
  assert.deepEqual(await persisted(),initial,'rejected operations must not mutate persisted state');

  await ok(await action('admin','saveVehicle',createFields));
  await ok(await action('admin','saveVehicle',{name:'Synthetic Van Two',plate:'TEST TWO',registrationDueDate:'2090-01-01',oilDueMileage:60000}));
  await ok(await action('admin','saveBill',{name:'Synthetic commercial insurance',vendor:'Synthetic vendor',dueDate:'2020-06-12',amount:125.45}));
  const tracker=await view('reader');
  assert.equal(tracker.vehicles.length,2);
  const [vanOne,vanTwo]=['Synthetic Van One','Synthetic Van Two'].map(name=>tracker.vehicles.find(vehicle=>vehicle.name===name));
  assert.ok(vanOne&&vanTwo);
  assert.notEqual(vanOne.id,vanTwo.id);
  assert.equal(vanOne.registration.dueDate,'2020-01-01');
  assert.equal(vanTwo.registration.dueDate,'2090-01-01');
  assert.equal(vanOne.oil.dueMileage,50000);
  assert.equal(tracker.bills.length,1);
  const [bill]=tracker.bills;
  assert.equal(bill.status,'open');
  assert.equal(bill.amount,125.45);
  assert.equal(bill.dueDate,'2020-06-12');

  await denied(await action('reader','completeRegistration',{id:vanOne.id,completedDate:'2020-02-01',nextDueDate:'2090-02-01'}));
  await invalid(await action('admin','completeRegistration',{id:bill.id,completedDate:'2020-02-01',nextDueDate:'2090-02-01'}));
  await invalid(await action('admin','completeOil',{id:'missing-id',completedDate:'2020-02-01',nextDueDate:'2090-02-01'}));
  await invalid(await action('admin','markBillPaid',{id:vanOne.id,paidDate:'2020-06-14'}));

  await ok(await action('admin','completeRegistration',{id:vanOne.id,completedDate:'2020-02-01',nextDueDate:'2090-02-01'}));
  await ok(await action('admin','completeOil',{id:vanOne.id,completedDate:'2020-02-05',completedMileage:51000,nextDueDate:'2090-05-01',nextDueMileage:56000}));
  await ok(await action('admin','markBillPaid',{id:bill.id,paidDate:'2020-06-14'}));
  const settled=await view('reader');
  const maintained=settled.vehicles.find(vehicle=>vehicle.id===vanOne.id);
  assert.equal(maintained.registration.lastCompletedDate,'2020-02-01');
  assert.equal(maintained.oil.lastCompletedDate,'2020-02-05');
  assert.equal(maintained.oil.lastMileage,51000);
  assert.equal(maintained.registration.dueDate,'2090-02-01');
  assert.equal(maintained.oil.dueDate,'2090-05-01');
  assert.equal(maintained.oil.dueMileage,56000);
  assert.deepEqual(settled.vehicles.find(vehicle=>vehicle.id===vanTwo.id),vanTwo,'second vehicle unchanged');
  const [paid]=settled.bills;
  assert.equal(paid.id,bill.id);
  assert.equal(paid.status,'paid');
  assert.equal(paid.paidDate,'2020-06-14');
  await invalid(await action('admin','markBillPaid',{id:bill.id,paidDate:'2020-06-15'}));
  await invalid(await action('admin','completeOil',{id:vanOne.id,completedDate:'2020-03-05',completedMileage:50999,nextDueMileage:57000}));
  await invalid(await action('admin','completeRegistration',{id:vanOne.id,completedDate:'2090-02-01',nextDueDate:'2090-03-01'}));
  const final=await persisted();
  for(const field of ['projectInvoices','purchases','workorders','customers','projects']){
   assert.deepEqual(final[field],initial[field],`tracker must not change ${field}`);
  }
  assert.equal(await view('tech'),undefined,'tracker remains private after records exist');
 });
});
