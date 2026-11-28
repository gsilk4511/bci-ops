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

test('Spend Clock stays inside the app and behind admin authentication; profile feed is owner-only', {timeout:12000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bci-changelog-'));
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const team='https://bci-test.cloudflareaccess.com',aud='spend-clock-isolated-test';
 const admin='admin@example.invalid',otherAdmin='backup@example.invalid',office='office@example.invalid',tech='tech@example.invalid';
 const roles=seed();
 roles.users=[{email:office,role:'office'},{email:tech,role:'tech'}];
 const token=email=>{
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const data=encode({alg:'RS256',kid:'test'})+'.'+encode({email,iss:team,aud,exp:Math.floor(Date.now()/1000)+90});
  return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');
 };
 const keys={keys:[{...publicKey.export({format:'jwk'}),kid:'test'}]};
 const setup=join(dir,'mock-keys.mjs'),db=join(dir,'state.json');
 await writeFile(setup,'const network=globalThis.fetch; globalThis.fetch=(url,...args)=>String(url)==='+JSON.stringify(team+'/cdn-cgi/access/certs')+'?Promise.resolve(Response.json('+JSON.stringify(keys)+')):Promise.resolve(new Response(null,{status:503}));');
 await writeFile(db,JSON.stringify(roles));
 const server=spawn(process.execPath,['--import',setup,fileURLToPath(new URL('../Server/server.js',import.meta.url))],{env:{
  ...Object.fromEntries(['PATH','HOME','SYSTEMROOT','TEMP'].flatMap(key=>process.env[key]?[[key,process.env[key]]]:[])),
  APP_AUTH_MODE:'cloudflare',CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud,BCI_ADMIN_EMAILS:admin+','+otherAdmin,BCI_PERMISSION_TEST_OWNER_EMAIL:admin,PUBLIC_ORIGIN:'https://staging.example.invalid',
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
  const root='/admin/spend-clock';
  const topic=root+'/campaigns/industrial-fiber?market=vt-119000&region=metro';
  for(const path of [root+'/',root+'/details',root+'/map',topic,root+'/feed.xml',root+'/market-feed.xml',root+'/api/economy.json','/api/profile-market-feed']){
   assert.equal((await req(path)).status,401,path);
   for(const actor of [office,tech,'unknown@example.invalid'])assert.equal((await req(path,actor)).status,403,path+' '+actor);
  }
  assert.equal((await req('/api/profile-market-feed',otherAdmin)).status,403);
  assert.equal((await req(root+'/',otherAdmin)).status,200);
  const r=await req(topic,admin);
  assert.equal(r.status,200);
  assert.equal(r.headers.get('cache-control'),'private, no-store');
  assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');
  const topicText=await r.text();
  assert.match(topicText,/Colchester town.*Greater Burlington/);
  assert.match(topicText,/TV &amp; streaming TV/);
  assert.match(topicText,/href="\/admin\/spend-clock\/campaigns\?state=vt&amp;market=vt-119000&amp;region=metro"/);
  for(const [path,search] of [[root+'/',"fetch('/admin/spend-clock/api/economy.json')"],[root+'/map',root+'/?state='],[root+'/details',root+'/campaigns?market=']]){
   const page=await req(path,admin);assert.equal(page.status,200);
   const html=await page.text();
   assert.ok(html.includes(search),path);
   for(const [,js] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
    const {createHash}=await import('node:crypto');
    assert.ok(page.headers.get('content-security-policy').includes(createHash('sha256').update(js).digest('base64')));
   }
  }
  assert.equal((await (await req(root+'/api/economy.json',admin)).json()).marketStates.length,51);
  const feed=await req(root+'/market-feed.xml',admin);
  assert.match(feed.headers.get('content-type'),/application\/rss\+xml/);
  assert.match(await feed.text(),/<title>BCI Market Signals<\/title>/);
  assert.equal((await (await req('/api/profile-market-feed',admin)).json()).items.length,5);
  assert.equal((await req(root+'/cam-not-found',admin)).status,404);
  assert.equal((await req(root+'/',admin,'POST')).status,405);
  const testStart=await fetch('http://'+address+'/api/permission-test',{method:'POST',headers:{
    'cf-access-jwt-assertion':token(admin),'content-type':'application/json',origin:'https://staging.example.invalid'
   },body:JSON.stringify({operation:'start',id:'admin'})});
  assert.equal(testStart.status,200,await testStart.clone().text());
  const cookie=testStart.headers.get('set-cookie').split(';')[0];
  for(const path of [topic,root+'/market-feed.xml','/api/profile-market-feed']){
   assert.equal((await fetch('http://'+address+path,{headers:{'cf-access-jwt-assertion':token(admin),cookie,'x-bci-permission-preview':'1'}})).status,403,path);
  }
 }finally{
  if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}
  await rm(dir,{recursive:true,force:true});
 }
});
