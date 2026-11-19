import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';

test('Cloudflare Access signed JWT checks audience, signature, and expiration',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const key=publicKey.export({format:'jwk'});key.kid='test-key';key.alg='RS256';
 process.env.APP_AUTH_MODE='cloudflare';
 process.env.CF_ACCESS_TEAM_DOMAIN='https://myfake.cloudflareaccess.com';
 process.env.CF_ACCESS_AUD='bci-test-aud';
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({keys:[key]})});
 try {
   const {identity}=await import('../Models/auth.js?jwt-verification-test');
   const token=(override={})=>{
     const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url');
     const payload=Buffer.from(JSON.stringify({iss:process.env.CF_ACCESS_TEAM_DOMAIN,aud:process.env.CF_ACCESS_AUD,email:'greg@example.test',exp:Math.floor(Date.now()/1000)+1000,...override})).toString('base64url');
     const signature=sign('RSA-SHA256',Buffer.from(`${header}.${payload}`),privateKey).toString('base64url');
     return `${header}.${payload}.${signature}`;
   };
   assert.equal((await identity({headers:{'cf-access-jwt-assertion':token()}})).email,'greg@example.test');
   await assert.rejects(()=>identity({headers:{'cf-access-jwt-assertion':token({aud:'wrong'})}}),/claims/);
   await assert.rejects(()=>identity({headers:{'cf-access-jwt-assertion':token({exp:1})}}),/claims/);
   const bad=token();await assert.rejects(()=>identity({headers:{'cf-access-jwt-assertion':bad.slice(0,-5)+'wrong'}}),/signature/);
 } finally {globalThis.fetch=originalFetch;}
});
