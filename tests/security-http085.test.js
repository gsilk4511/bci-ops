import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import test from 'node:test';
import {seed} from '../Models/lib.js';

test('HTTP role boundaries protect scoped details and remain effective after a profile change', {timeout:12000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bci-roles-'));
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const team='https://bci-test.cloudflareaccess.com',aud='isolated-test';
 const token=email=>{
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const input=encode({alg:'RS256',kid:'test'})+'.'+encode({email,iss:team,aud,exp:Math.floor(Date.now()/1000)+90});
  return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');
 };
 const keys={keys:[{...publicKey.export({format:'jwk'}),kid:'test'}]};
 const state=seed(),p=state.projects[0],w=state.workorders[0];
 const admin='owner@example.invalid',member='tech@example.invalid',other='other@example.invalid';
 const hidden='HIDDEN CUSTOMER PHONE',note='HIDDEN FIELD NOTES';
 state.customers[0].phone=hidden;
 Object.assign(w,{description:note});
 const own={...structuredClone(w),id:'own-work',createdBy:member,description:'Only owned work'};
 state.workorders.push(own);
 state.users=[{email:member,role:'tech',profileId:'read'},{email:other,role:'tech'}];
 state.permissionProfiles=[{id:'read',name:'Reader',schemaVersion:4,
  modes:{workorders:'read',customers:'hidden',projects:'read',tickets:'hidden',staff:'read'},
  recordScopes:{workorders:'own'},permissions:['entry.add','entry.remove','workorder.delete','receipt.read']}];
 const setup=join(dir,'mock-keys.mjs'),db=join(dir,'state.json');
 await writeFile(setup,'const network = globalThis.fetch; globalThis.fetch=(url,...args)=>String(url)==='+JSON.stringify(team+'/cdn-cgi/access/certs')+'?Promise.resolve(Response.json('+JSON.stringify(keys)+')):network(url,...args);');
 await writeFile(db,JSON.stringify(state));
 const server=spawn(process.execPath,['--import',setup,fileURLToPath(new URL('../Server/server.js',import.meta.url))],{env:{
  ...Object.fromEntries(['PATH','HOME','SYSTEMROOT','TEMP'].flatMap(k=>process.env[k]?[[k,process.env[k]]]:[])),
  APP_AUTH_MODE:'cloudflare',CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud,BCI_ADMIN_EMAILS:admin,
  HOST:'127.0.0.1',PORT:'0',DB_PROVIDER:'json',DATA_FILE:db
 }});
 let log='';
 server.stderr.on('data',chunk=>{log+=chunk;});
 server.stdout.on('data',chunk=>{log+=chunk;});
 try{
  for(let n=0;n<120&&!/127\.0\.0\.1:\d+/.test(log)&&server.exitCode===null;n++)await sleep(30);
  const address=log.match(/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(address,log);
  const read=async(path,email)=>fetch('http://'+address+path,{headers:email?{'cf-access-jwt-assertion':token(email)}:{}});
  const act=(email,action,data)=>fetch('http://'+address+'/api/action',{method:'POST',headers:{'content-type':'application/json','cf-access-jwt-assertion':token(email)},body:JSON.stringify({action,data})});
  assert.equal((await read('/api/state')).status,401);
  const before=await (await read('/api/state',member)).json();
  assert.deepEqual(before.workorders.map(w=>w.id),[own.id]);
  assert.ok(!JSON.stringify(before).includes(hidden)&&!JSON.stringify(before).includes(note));
  assert.ok(!before.me.permissions.includes('entry.add')&&!before.me.permissions.includes('workorder.delete'));
  assert.equal((await act(member,'entry.add',{workorderId:own.id})).status,403);
  assert.equal((await act(member,'workorder.deletePreview',{ids:[own.id]})).status,403);
  assert.equal((await act(member,'receipt.read',{workorderId:w.id,receiptId:'missing'})).status,403);
  assert.equal((await read('/api/testing/database?mode=raw',member)).status,403);
  const saved=await act(admin,'profiles.save',{id:'read',name:'Reader',modes:{workorders:'hidden',customers:'hidden',projects:'read',staff:'read'},permissions:[],recordScopes:{workorders:'assigned'}});
  assert.equal(saved.status,200,await saved.clone().text());
  const after=await (await read('/api/state',member)).json();
  assert.deepEqual(after.workorders,[]);
  assert.ok(after.me.accessRevision>before.me.accessRevision);
  assert.equal((await act(admin,'users.set',{email:admin,role:'tech',active:false})).status,400);
 }finally{
  if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}
  await rm(dir,{recursive:true,force:true});
 }
});
