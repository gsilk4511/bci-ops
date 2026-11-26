import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {setTimeout as sleep} from 'node:timers/promises';
import {seed} from '../Models/lib.js';
import {normalizeProfileAccess,permissionDependencies} from '../Models/permissions.js';
import {permissionPrerequisitePlan,dependentPermissionRemovals} from '../public/modules/permission-prerequisites.js';
import {permissionPreviewSessions,isPreviewOwner} from '../UserSecurity/permission-preview.js';

test('read prerequisites close transitively on an explicit save, without opening broad record scopes or mutation',()=>{
 const input={modes:{invoices:'read',workorders:'hidden'},recordScopes:{invoices:'assigned'},permissions:[]};
 const repaired=normalizeProfileAccess(input,{repairReadPrerequisites:true});
 assert.equal(repaired.modes.workorders,'read');
 assert.equal(repaired.recordScopes.workorders,'own');
 assert.equal(repaired.recordScopes.invoices,'assigned');
 assert.deepEqual(new Set(repaired.permissions),new Set(['invoices.view','workorders.view','finance.view']));
 assert.throws(()=>normalizeProfileAccess({modes:{staff:'write'},permissions:['staff.internal']},{repairReadPrerequisites:true}),/workorder.create/);
 assert.throws(()=>normalizeProfileAccess({modes:{testing:'read'},permissions:['database.payroll']},{repairReadPrerequisites:true}),/payroll.view/);
 const {reasons}=permissionPrerequisitePlan(repaired.permissions,permissionDependencies);
 assert.ok(reasons.get('workorders.view').has('invoices.view'));
 assert.ok(dependentPermissionRemovals(repaired.permissions,['workorders.view'],permissionDependencies).has('invoices.view'));
});

test('preview token is bound to one verified identity and is not an administrator credential',()=>{
 const owner={email:'rbevins@bcielite.tech',issuer:'https://owner.cloudflareaccess.com',sub:'owner'};
 assert.equal(isPreviewOwner(owner,'admin',{}),true);
 assert.equal(isPreviewOwner(owner,'tech',{}),false);
 assert.equal(isPreviewOwner({...owner,email:'greg@example.invalid'},'admin',{}),false);
 let now=1000;
 const sessions=permissionPreviewSessions(()=>({users:[]}),()=>now);
 const cookie=sessions.start(owner,'','tech').split(';')[0];
 assert.match(cookie,/^__Host-bci-permission-preview=/);
 assert.ok(sessions.inspect(owner,cookie).session);
 assert.equal(sessions.inspect({...owner,sub:'different-user'},cookie).session,null);
 now+=3600001;
 assert.equal(sessions.inspect(owner,cookie).session,null);
 assert.equal(sessions.inspect(owner,cookie).present,true);
});

test('HTTP preview enforces the simulated mode and uses separate mutable synthetic state',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bci-permissions-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const socket=net.createServer();
 await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
 const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const root='http://127.0.0.1:'+port;
 const file=path.join(dir,'data.json'),fixture=seed();
 fixture.workorders[0].title='PRODUCTION SECRET';
 fixture.permissionProfiles=[{id:'view-invoices',name:'Invoice Read Test Profile',...normalizeProfileAccess({modes:{invoices:'read'},permissions:[]},{repairReadPrerequisites:true})}];
 const original=JSON.stringify(fixture);
 await writeFile(file,original);
 const child=spawn(process.execPath,['Server/server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,APP_AUTH_MODE:'local',NODE_ENV:'test',
  HOST:'127.0.0.1',PORT:String(port),DB_PROVIDER:'json',DATA_FILE:file,BCI_USER_SECURITY:'off',PUBLIC_ORIGIN:root,
  BCI_ADMIN_EMAILS:'private-admin@example.invalid'},stdio:['ignore','ignore','pipe']});
 t.after(()=>{child.kill();});
 let err='';child.stderr.on('data',buf=>{err+=buf;});
 for(let i=0;;i++){try{if((await fetch(root+'/api/health')).ok)break;}catch{}if(i>=50)assert.fail(err||'server did not start');await sleep(25);}
 const req=(rel,{cookie='',preview=false,body,method}={})=>fetch(root+rel,{method:method||(body?'POST':'GET'),redirect:'manual',
  headers:{origin:root,...(cookie?{cookie}:{}),...(preview?{'x-bci-permission-preview':'1'}:{}),...(body?{'content-type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined});
 const action=(action,data,parameters)=>req('/api/action',{...parameters,body:{action,data}});
 const begin=async id=>{
  const res=await req('/api/permission-test',{body:{operation:'start',id}});
  assert.equal(res.status,200,await res.clone().text());
  return res.headers.get('set-cookie').split(';')[0];
 };
 const exit=async cookie=>{
  const res=await req('/api/permission-test',{cookie,preview:true,body:{operation:'exit'}});
  assert.equal(res.status,200);
  assert.match(res.headers.get('set-cookie'),/Max-Age=0/);
 };
 const live=await(await req('/api/state')).json();
 assert.equal(live.me.permissionTestAvailable,true);
 assert.equal(live.workorders[0].title,'PRODUCTION SECRET');
 let cookie=await begin('hidden');
 assert.equal((await req('/',{cookie})).status,303);
 const hidden=await(await req('/api/state',{cookie,preview:true})).json();
 assert.deepEqual(hidden.me.permissions,[]);
 assert.equal(hidden.workorders.length,0);
 assert.equal((await action('customer.create',{name:'Not Allowed'},{cookie,preview:true})).status,403);
 await exit(cookie);
 assert.equal((await action('customer.create',{name:'Stale Preview Write'},{preview:true})).status,409);
 cookie=await begin('view-invoices');
 const custom=await(await req('/api/state',{cookie,preview:true})).json();
 assert.deepEqual(new Set(custom.me.permissions),new Set(['invoices.view','finance.view','workorders.view']));
 assert.equal(custom.workorders.some(row=>row.id==='preview-work'),true);
 assert.equal(custom.workorders.some(row=>row.id==='preview-other-work'),false);
 assert.equal((await action('customer.create',{name:'Not Allowed'},{cookie,preview:true})).status,403);
 await exit(cookie);
 cookie=await begin('admin');
 const adminState=await(await req('/api/state',{cookie,preview:true})).text();
 assert.match(adminState,/permission-test@example.invalid/);
 assert.doesNotMatch(adminState,/private-admin@example.invalid|PRODUCTION SECRET/);
 assert.equal((await req('/api/state',{cookie})).status,409);
 assert.equal((await req('/api/security/invite',{cookie,preview:true,body:{email:'not-in-test@example.invalid'}})).status,403);
 assert.equal((await req('/api/testing/database?mode=raw',{cookie,preview:true})).status,403);
 assert.equal((await action('notification.test',{},{cookie,preview:true})).status,403);
 const result=await action('customer.create',{name:'Test-only Mutation',business:'Fictitious',email:'billing-test@example.invalid',phone:'802-555-0105',address:'1 Example Road'},{cookie,preview:true});
 assert.equal(result.status,200,await result.clone().text());
 assert.match(await(await req('/api/state',{cookie,preview:true})).text(),/Test-only Mutation/);
 await exit(cookie);
 assert.equal((await req('/api/state',{cookie,preview:true})).status,409);
 assert.doesNotMatch(await(await req('/api/state')).text(),/Test-only Mutation/);
 assert.equal(await readFile(file,'utf8'),original);
});
