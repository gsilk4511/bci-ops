import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {securityConfig,requiredReady,securityView,inviteAccount,performEnrollment,resetAuthenticator} from '../UserSecurity/enrollment.js';

const key=randomBytes(32).toString('base64url');
const first={email:'one@example.invalid',sub:'first',issuer:'https://testing.cloudflareaccess.com'};
const second={email:'two@example.invalid',sub:'second',issuer:first.issuer};
const env={BCI_USER_SECURITY:'optional',BCI_MFA_ENCRYPTION_KEY:key,PUBLIC_ORIGIN:'https://bci.example.invalid',BCI_ADMIN_EMAILS:[first.email,second.email].join(',')};
const config=securityConfig(env), required=securityConfig({...env,BCI_USER_SECURITY:'required'});
const now=1730000000000;
const simulator=async uri=>uri;
function otp(uri,at){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', secret=new URL(uri).searchParams.get('secret');
 const bits=[...secret].map(x=>alphabet.indexOf(x).toString(2).padStart(5,'0')).join('');
 const bytes=Buffer.from(bits.match(/.{8}/g).map(x=>parseInt(x,2)));
 const time=Buffer.alloc(8);time.writeBigUInt64BE(BigInt(Math.floor(at/30000)));
 const hash=createHmac('sha1',bytes).update(time).digest();
 return String((hash.readUInt32BE(hash[19]&15)&0x7fffffff)%1e6).padStart(6,'0');
}
test('disabled acceptance is unchanged with no secrets; required needs two protected identities and HTTPS origin',()=>{
 assert.deepEqual(securityConfig({}),{mode:'off',agentEnabled:false});
 assert.equal(securityView({},securityConfig({}),first).allowed,true);
 assert.throws(()=>securityConfig({...env,PUBLIC_ORIGIN:'http://bci.example.invalid'}),/HTTPS/);
 assert.throws(()=>securityConfig({...env,BCI_USER_SECURITY:'required',BCI_ADMIN_EMAILS:first.email}),/two independent/);
 assert.throws(()=>securityConfig({BCI_AGENT_API:'on'}),/requires User Security/);
});
test('invite to verified identity, TOTP, replay, distinct owner recovery, and trusted-host reset',async()=>{
 const state={};
 const change=(user,body,cookie,at=now)=>performEnrollment(state,config,user,body,cookie,at,simulator);
 assert.equal(securityView(state,config,first,null,now).allowed,true);
 assert.equal(securityView(state,required,first,null,now).allowed,false);
 async function enroll(user){
  const {invitation}=inviteAccount(state,config,first,user.email,now);
  assert.match((await change({...user,email:'intruder@example.invalid'},{operation:'begin',invitation})).error,/invitation/);
  const {qr}=await change(user,{operation:'begin',invitation});
  assert.match(qr,/^otpauth:\/\/totp\//);
  const code=otp(qr,now);
  const firstSession=await change(user,{operation:'confirm',code});
  assert.equal(firstSession.codes.length,10);
  assert.ok(firstSession.cookie.startsWith('__Host-'));
  assert.ok(!JSON.stringify(state).includes(new URL(qr).searchParams.get('secret')));
  assert.ok(!JSON.stringify(state).includes(firstSession.codes[0]));
  assert.equal(securityView(state,config,user,null,now).allowed,false);
  assert.equal(securityView(state,config,user,firstSession.cookie,now).recent,true);
  assert.equal(securityView(state,config,{...user,sub:'changed'},firstSession.cookie,now).allowed,false);
  assert.match((await change(user,{operation:'verify',code})).error,/already used/);
  const recovery=await change(user,{operation:'recovery',code:firstSession.codes[0]});
  assert.equal(securityView(state,config,user,recovery.cookie,now).allowed,true);
  assert.equal(securityView(state,config,user,recovery.cookie,now).recent,false);
  assert.match((await change(user,{operation:'recovery',code:firstSession.codes[0]})).error,/already used/);
  return firstSession;
 }
 await enroll(first);
 assert.equal(requiredReady(state,required),false);
 const session=await enroll(second);
 assert.equal(requiredReady(state,required),true);
 assert.throws(()=>resetAuthenticator(state,required,second.email),/optional/);
 resetAuthenticator(state,config,second.email,now);
 assert.equal(requiredReady(state,required),false);
 assert.equal(securityView(state,config,second,session.cookie,now).allowed,false);
 assert.ok(state.audit.some(x=>x.event==='trusted-host-reset'));
});
