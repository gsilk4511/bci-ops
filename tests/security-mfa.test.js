import assert from 'node:assert/strict';
import test from 'node:test';
import {
 mfaKey,createTotpEnrollment,encryptTotp,decryptTotp,verifyTotp,
 issueSecurityToken,digestSecurityToken,createRecoveryCodes,digestRecoveryCode,
 mfaSessionCookie,readMfaCookie,totpQrDataUrl
} from '../UserSecurity/mfa.js';

const key=Buffer.alloc(32,0xf9);
const identity=JSON.stringify(['https://example.cloudflareaccess.com','cf-stable-sub','test@example.com']);
const rfcSecret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // RFC 6238 ASCII 12345678901234567890.

test('Bitwarden enrollment uses locally generated RFC-compatible secret and six-digit URI',()=>{
 const email='test+field@example.com';
 const first=createTotpEnrollment(email);
 const second=createTotpEnrollment(email);
 assert.notEqual(first.secret,second.secret);
 assert.match(first.secret,/^[A-Z2-7]{32}$/);
 const uri=new URL(first.uri);
 assert.equal(uri.protocol,'otpauth:');
 assert.equal(uri.hostname,'totp');
 assert.equal(decodeURIComponent(uri.pathname),'/BCI Operations:'+email);
 assert.deepEqual(Object.fromEntries(uri.searchParams),{secret:first.secret,issuer:'BCI Operations',algorithm:'SHA1',digits:'6',period:'30'});
 assert.throws(()=>createTotpEnrollment('not-an-email'));
});

test('six-digit TOTP matches RFC 6238 Appendix B truncation, tolerates only one step, and rejects replay',()=>{
 const vectors=[[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']];
 for(const [seconds,code] of vectors)assert.equal(verifyTotp(rfcSecret,code,{now:seconds*1000}),Math.floor(seconds/30));
 const code='287082';
 assert.equal(verifyTotp(rfcSecret,code,{now:59000,lastCounter:1}),null);
 assert.equal(verifyTotp(rfcSecret,code,{now:59000,lastCounter:2}),null);
 assert.equal(verifyTotp(rfcSecret,code,{now:60000}),1);
 assert.equal(verifyTotp(rfcSecret,code,{now:90000}),null);
 assert.equal(verifyTotp(rfcSecret,287082,{now:59000}),null);
 assert.equal(verifyTotp(rfcSecret,' 287082',{now:59000}),null);
});

test('encrypted factors require key, exact verified identity, and intact ciphertext',()=>{
 assert.deepEqual(mfaKey(key.toString('base64')),key);
 assert.deepEqual(mfaKey(key.toString('base64url')),key);
 assert.throws(()=>mfaKey('a'.repeat(43))); // invalid trailing bits
 assert.throws(()=>mfaKey(Buffer.alloc(31).toString('base64url')));
 const encrypted=encryptTotp(rfcSecret,key,identity);
 assert.notEqual(encrypted,encryptTotp(rfcSecret,key,identity),'different nonce');
 assert.equal(decryptTotp(encrypted,key,identity),rfcSecret);
 assert.throws(()=>decryptTotp(encrypted,key,identity+'other'));
 assert.throws(()=>decryptTotp(encrypted,Buffer.alloc(32),identity));
 const tampered=encrypted.slice(0,-1)+(encrypted.endsWith('A')?'B':'A');
 assert.throws(()=>decryptTotp(tampered,key,identity));
 assert.throws(()=>encryptTotp(rfcSecret,key,''));
});

test('opaque token purpose, key and canonical form are significant; session cookie cannot be duplicated',()=>{
 const {token,digest}=issueSecurityToken('session',key);
 assert.match(digest,/^[a-f0-9]{64}$/);
 assert.equal(digestSecurityToken('session',token,key),digest);
 assert.notEqual(digestSecurityToken('invite',token,key),digest);
 assert.notEqual(digestSecurityToken('session',token,Buffer.alloc(32)),digest);
 assert.equal(digestSecurityToken('session',token+'=',key),null);
 const cookie=mfaSessionCookie(token,900);
 assert.match(cookie,/^__Host-bci-mfa=/);
 assert.match(cookie,/Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=900$/);
 assert.equal(readMfaCookie('other=foo; '+cookie),token);
 assert.equal(readMfaCookie(cookie+'; '+cookie),null);
 assert.match(mfaSessionCookie('',0),/Max-Age=0$/);
 assert.throws(()=>mfaSessionCookie(token,43201));
});

test('recovery set contains independent high-entropy codes, keyed and domain separated',()=>{
 const {codes,digests}=createRecoveryCodes(key);
 assert.equal(new Set(codes).size,10);
 assert.equal(new Set(digests).size,10);
 for(const [i,code] of codes.entries()){
  assert.match(code,/^[A-Z2-7]{4}(?:-[A-Z2-7]{4}){4}$/);
  assert.equal(digestRecoveryCode(code.toLowerCase().replaceAll('-',''),key),digests[i]);
  assert.notEqual(digestRecoveryCode(code,Buffer.alloc(32)),digests[i]);
 }
 assert.equal(digestRecoveryCode('0000-0000-0000-0000-0000',key),null);
});

test('installed QR dependency renders the enrollment PNG internally',async t=>{
 try{await import('qrcode');}catch(err){if(err.code==='ERR_MODULE_NOT_FOUND'){t.skip('qrcode dependency not installed in this test workspace');return;}throw err;}
 const {uri}=createTotpEnrollment('test@example.com');
 const encoded=await totpQrDataUrl(uri);
 assert.match(encoded,/^data:image\/png;base64,/);
 assert.deepEqual(Buffer.from(encoded.split(',')[1],'base64').subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
 await assert.rejects(totpQrDataUrl('https://untrusted.invalid'));
});
