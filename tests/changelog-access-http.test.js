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

test('release history is exposed only to authenticated admins on the private GET route', {timeout:12000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bci-changelog-'));
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const team='https://bci-test.cloudflareaccess.com',aud='changelog-isolated-test';
 const admin='admin@example.invalid',office='office@example.invalid',tech='tech@example.invalid';
 const roles=seed();
 roles.users=[{email:office,role:'office'},{email:tech,role:'tech'}];
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
  assert.equal((await req('/api/changelog')).status,401);
  for(const user of [office,tech,'unknown@example.invalid']){
   const result=await req('/api/changelog',user);
   assert.equal(result.status,403);
   assert.equal(Object.hasOwn(await result.json(),'releases'),false);
  }
  const result=await req('/api/changelog',admin);
  assert.equal(result.status,200,await result.clone().text());
  assert.equal(result.headers.get('cache-control'),'no-store');
  const {releases}=await result.json();
  assert.equal(releases.length,87);
  assert.ok(releases.every(item=>/^2026-11-\d{2}$/.test(item.releaseDate)&&Number.isInteger(item.developmentMinutes)));
  assert.equal(releases.reduce((sum,item)=>sum+item.developmentMinutes,0),10020);
  for(const {version,title,summary,sections} of releases){
   assert.ok(typeof version==='string'&&version&&typeof title==='string'&&title&&typeof summary==='string'&&summary);
   assert.ok(Array.isArray(sections)&&sections.every(section=>typeof section.title==='string'&&
    Array.isArray(section.items)&&section.items.every(item=>typeof item==='string')));
  }
  const {release}=await (await req('/api/health')).json();
  assert.equal(releases[0].version.replace(/^v/,'').toLowerCase(),release.toLowerCase());
  assert.equal((await req('/api/changelog',admin,'POST')).status,405);
  for(const path of ['/release-history.js','/Models/release-history.js','/Changelog/release-history.js','/Changelog/BCI-Operations-Time-by-Revision.md','/api/changelog.js'])
   assert.equal((await req(path,tech)).status,404);
  for(const actor of [tech,admin]){
   const snapshot=await (await req('/api/state',actor)).json();
   assert.equal(snapshot.releases,undefined);
   assert.equal(snapshot.changelog,undefined);
   if(releases[0].summary.length>12)assert.ok(!JSON.stringify(snapshot).includes(releases[0].summary));
  }
 }finally{
  if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}
  await rm(dir,{recursive:true,force:true});
 }
});
