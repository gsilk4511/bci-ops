import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {seed} from '../Models/lib.js';
import {defaultProfileStyle,profileStyleOptions} from '../public/modules/profile-style-catalog.js';

test('staff profile, private fields, and avatar are separated through authenticated HTTP', {timeout:12000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bci-changelog-'));
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const team='https://bci-test.cloudflareaccess.com',aud='changelog-isolated-test';
 const admin='admin@example.invalid',office='office@example.invalid',tech='tech@example.invalid';
 const roles=seed();
 const former='former@example.invalid', photo='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jefkAAAAASUVORK5CYII=';
 roles.users=[{email:office,role:'office'},{email:tech,role:'tech'},{email:former,role:'tech',active:false}];
 roles.staffProfiles=[{email:office,name:'Office',displayName:'Public office name',contactEmail:'private-contact@example.invalid',payScale:'private pay tier',vacationHours:102,avatarBase64:photo},{email:former,name:'Former employee'}];
 const officeIcon=profileStyleOptions.icon.find(option=>option.id!==defaultProfileStyle.icon).id;
 roles.staffProfiles[0].style={icon:officeIcon};
 const sampleEntry={type:'labor',catalogId:'cat_3',name:'Cable technician',quantity:1,unit:'hr',rate:95,cost:34};
 roles.workorders[0].entries=[
  {id:'staff-test-bound',...sampleEntry,employeeEmail:office},
  {id:'staff-test-legacy',...sampleEntry,tech:office},
 ];
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
  const profilePath='/api/staff-directory/'+profile.id;
  const selfProfile=await (await req(profilePath,office)).json();
  const employerProfile=await (await req(profilePath,admin)).json();
  const peerProfile=await (await req(profilePath,tech)).json();
  assert.equal(employerProfile.profile.payScale,'private pay tier');
  assert.equal(employerProfile.profile.contactEmail,'private-contact@example.invalid');
  assert.equal(employerProfile.profile.vacationHours,102);
  assert.equal(selfProfile.profile.email,office);
  assert.deepEqual(peerProfile,{profile});
  assert.equal((await req(profilePath)).status,401);
  assert.equal((await req(profilePath,former)).status,403);
  assert.equal((await req(profilePath,admin,'POST')).status,405);
  assert.equal((await req('/api/staff-directory/'+'0'.repeat(64),admin)).status,404);
  assert.deepEqual(profile.style,{...defaultProfileStyle,icon:officeIcon});
  assert.deepEqual(result.workorders[0].entries.map(entry=>entry.technicianIcon),[officeIcon,undefined]);
  assert.equal(result.staff.directory.some(row=>row.displayName==='Former employee'),false);
  assert.equal(result.staff.contribution.status,'unavailable');
  assert.equal(result.staff.weeklyTime.rows.length,5);
  const summary=await req('/api/staff-summary?email='+encodeURIComponent(office),tech);
  assert.equal(summary.status,200,await summary.clone().text());
  assert.equal(summary.headers.get('cache-control'),'no-store');
  const ownSummary=await summary.json();
  assert.equal(ownSummary.email,tech);
  assert.deepEqual(ownSummary.weeklyTime,result.staff.weeklyTime);
  assert.deepEqual(ownSummary.contribution,result.staff.contribution);
  assert.equal((await req('/api/staff-summary')).status,401);
  assert.equal((await req('/api/staff-summary',former)).status,403);
  assert.equal((await req('/api/staff-summary',tech,'POST')).status,405);
  const supplied=JSON.stringify(result.staff);
  for(const forbidden of [office,former,'private-contact@example.invalid','private pay tier','priv_leave',photo])assert.ok(!supplied.includes(forbidden),forbidden);
  assert.equal((await req(profile.avatarUrl)).status,401);
  assert.equal((await req(profile.avatarUrl,former)).status,403);
  const image=await req(profile.avatarUrl,tech);
  assert.equal(image.status,200);
  assert.equal(image.headers.get('content-type'),'image/png');
  assert.equal(image.headers.get('cache-control'),'private, no-store');
  assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'),photo);
  const icon=profileStyleOptions.icon.find(option=>option.id!==defaultProfileStyle.icon).id;
  const change=await fetch('http://'+address+'/api/action',{method:'POST',headers:{'cf-access-jwt-assertion':token(tech),'content-type':'application/json'},
   body:JSON.stringify({action:'staff.profile',data:{email:office,name:'Wrong',displayName:'Own display',payScale:'wrong',vacationHours:999,style:{icon}}})});
  assert.equal(change.status,200,await change.clone().text());
  const after=(await (await req('/api/state',tech)).json()).staff;
  assert.equal(after.profile.displayName,'Own display');
  assert.equal(after.profile.payScale,'');
  assert.equal(after.profile.style.icon,icon);
  const invalid=await fetch('http://'+address+'/api/action',{method:'POST',headers:{'cf-access-jwt-assertion':token(tech),'content-type':'application/json'},
   body:JSON.stringify({action:'staff.profile',data:{displayName:'Own display',style:{icon:'<arbitrary-HTML>'}}})});
  assert.equal(invalid.status,400,await invalid.clone().text());
  assert.equal(after.directory.find(row=>row.id===profile.id).displayName,'Public office name');
  const post=async(action,data,email=admin)=>{
   const r=await fetch('http://'+address+'/api/action',{method:'POST',headers:{'cf-access-jwt-assertion':token(email),'content-type':'application/json'},body:JSON.stringify({action,data})});
   return {status:r.status,...await r.json()};
  };
  const workorderId=roles.workorders[0].id;
  const labor=roles.catalog.find(item=>item.type==='labor').id;
  const payload={workorderId,employeeEmail:office,type:'labor',catalogId:labor,date:'2026-11-25',quantity:2,description:'Work from the office log',submissionId:randomUUID()};
  const denied=await post('entry.addForEmployee',payload,tech);
  assert.notEqual(denied.status,200);
  assert.equal((await post('entry.addForEmployee',{...payload,employeeEmail:former})).status,400);
  const unopened=await post('entry.addForEmployee',payload);
  assert.match(unopened.error,/not released/);
  const signatureData='data:image/png;base64,'+Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(400,7)]).toString('base64');
  const approval=await post('workorder.approve',{workorderId,signedBy:'Test client',signatureData,consent:true});
  assert.equal(approval.status,200,JSON.stringify(approval));
  const entry=await post('entry.addForEmployee',payload);
  assert.equal(entry.status,200,JSON.stringify(entry));
  assert.equal(entry.result.employeeEmail,office);
  assert.equal(entry.result.createdBy,admin);
  assert.equal((await post('entry.addForEmployee',payload)).result.id,entry.result.id);
  const updated=(await (await req('/api/state',office)).json()).staff;
  assert.equal(updated.time.filter(row=>row.id===entry.result.id).length,1);
  const adminTime=(await (await req('/api/state',admin)).json()).staff;
  assert.equal(adminTime.time.filter(row=>row.id===entry.result.id).length,0);

 }finally{
  if(server.exitCode===null){server.kill();await once(server,'exit');}
  await rm(dir,{recursive:true,force:true});
 }
});
