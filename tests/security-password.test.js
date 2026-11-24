import assert from 'node:assert/strict';
import test from 'node:test';
import {validPassword,hashPassword,verifyPassword,createEmailOtp,verifyEmailOtp} from '../UserSecurity/password.js';

test('passwords require 15 code points, preserve exact input and cap UTF-8 cost',async()=>{
 assert.equal(validPassword('😀'.repeat(14)),false);
 assert.equal(validPassword('😀'.repeat(15)),true);
 assert.equal(validPassword('😀'.repeat(257)),false);
 assert.equal(validPassword('x'.repeat(1024)),true);
 assert.equal(validPassword('x'.repeat(1025)),false);
 assert.equal(validPassword('x'.repeat(15)+'\uD800'),false);
 assert.equal(validPassword({}),false);
 await assert.rejects(hashPassword('too short'));
 const secret='exact password phrase ';
 const [a,b]=await Promise.all([hashPassword(secret),hashPassword(secret)]);
 assert.match(a,/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
 assert.notEqual(a,b);
 assert.equal(await verifyPassword(secret,a),true);
 assert.equal(await verifyPassword(secret.trim(),a),false);
 assert.equal(await verifyPassword(secret),false);
 assert.equal(await verifyPassword(secret,a.replace('scrypt-v1','scrypt-v2')),false);
});
test('random six-digit email OTP is indistinguishable in digest and bound to exactly one principal and challenge',()=>{
 const key=Buffer.alloc(32,93), identity='issuer|subject|sample@example.invalid', challenge='challenge_5fc2237ea044b2d8';
 const {code,digest}=createEmailOtp(key,identity,challenge);
 assert.match(code,/^\d{6}$/);
 assert.match(digest,/^[a-f0-9]{64}$/);
 const wrong=String((Number(code)+1)%1_000_000).padStart(6,'0');
 assert.equal(verifyEmailOtp(key,identity,challenge,code,digest),true);
 for(const args of [
  [key,identity,challenge,wrong,digest],[key,identity,challenge+'a',code,digest],
  [key,identity+'a',challenge,code,digest],[Buffer.alloc(32),identity,challenge,code,digest],
  [key,identity,challenge,+code,digest],[key,identity,challenge,code,digest+'a']
 ])assert.equal(verifyEmailOtp(...args),false);
 assert.throws(()=>createEmailOtp(key,identity,'short'));
});
