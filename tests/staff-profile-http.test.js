import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {seed} from '../Models/lib.js';

test('staff profile, private fields, and avatar are separated through authenticated HTTP', {timeout:12000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bci-changelog-'));
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const team='https://bci-test.cloudflareaccess.com',aud='changelog-isolated-test';
 const admin='admin@example.invalid',office='office@example.invalid',tech='tech@example.invalid';
 const roles=seed();
 const former='former@example.invalid', photo='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jefkAAAAASUVORK5CYII=';
 roles.users=[{email:office,role:'office'},{email:tech,role:'tech'},{email:former,role:'tech',active:false}];
 roles.staffProfiles=[{email:office,name:'Office',displayName:'Public office name',contactEmail:'private-contact@example.invalid',payScale:'private pay tier',vacationHours:102,avatarBase64:photo},{email:former,name:'Former employee'}];
 roles.staffLeave=[{id:'priv_leave',email:office,status:'Approved'}];
 const token=email=>{
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const data=encode({alg:'RS256',kid:'test'})+'.'+encode({email,iss:team,aud,exp:Math.floor(Date.now()/1000)+90});
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');
 };
 const keys={keys:[{...publicKey.export({format:'jwk'}),kid:'test'}]};
 const setup=join(dir,'mock-keys.mjs'),db=join(dir,'state.json');
 await writeFile(setup,'const network=globalThis.fetch; globalThis.fetch=(url,...args)=>String(url)==='+JSON.stringify(team+'/cdn-cgi/access/certs')+'?Promise.resolve(Response.json('+JSON.stringify(keys)+')):network(url,...args);');
 await writeFile(db,JSON.stringify(roles));
 const server=spawn(process.execPath,['--import',setup,fileURLToPath(new URL('../Server/server.js',import.meta.url))],{env:{
  ...Object.fromEntries(['PATH','HOME','SYSTEMROOT','TEMP'].flatMap(key=>process.env[key]?[[key,process.env[key]]]:[])),
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
  const req=(path,email,method='GET')=>fetch('http://'+address+path,{method,headers:email?{'cf-access-jwt-assertion':token(email)}:{}});

  const response=await req('/api/state',tech);
  assert.equal(response.status,200,await response.clone().text());
  const result=await response.json(),profile=result.staff.directory.find(row=>row.displayName==='Public office name');
  assert.ok(profile);
  assert.equal(result.staff.directory.some(row=>row.displayName==='Former employee'),false);
  assert.equal(result.staff.contribution.status,'unavailable');
  const supplied=JSON.stringify(result.staff);
  for(const forbidden of [office,former,'private-contact@example.invalid','private pay tier','priv_leave',photo])assert.ok(!supplied.includes(forbidden),forbidden);
  assert.equal((await req(profile.avatarUrl)).status,401);
  assert.equal((await req(profile.avatarUrl,former)).status,403);
  const image=await req(profile.avatarUrl,tech);
  assert.equal(image.status,200);
  assert.equal(image.headers.get('content-type'),'image/png');
  assert.equal(image.headers.get('cache-control'),'private, no-store');
  assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'),photo);
  const change=await fetch('http://'+address+'/api/action',{method:'POST',headers:{'cf-access-jwt-assertion':token(tech),'content-type':'application/json'},
   body:JSON.stringify({action:'staff.profile',data:{email:office,name:'Wrong',displayName:'Own display',payScale:'wrong',vacationHours:999}})});
  assert.equal(change.status,200,await change.clone().text());
  const after=(await (await req('/api/state',tech)).json()).staff;
  assert.equal(after.profile.displayName,'Own display');
  assert.equal(after.profile.payScale,'');
  assert.equal(after.directory.find(row=>row.id===profile.id).displayName,'Public office name');
 }finally{
  if(server.exitCode===null){server.kill();await once(server,'exit');}
  await rm(dir,{recursive:true,force:true});
 }
});
