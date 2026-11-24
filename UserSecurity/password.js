// Bounded async password derivation and challenge-bound email one-time codes.
// The caller owns account rate limits, challenge TTL, atomic one-use consumption and audit.
import {createHmac,randomBytes,randomInt,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const scryptAsync=promisify(scrypt);
const prefix='scrypt-v1';
const parameters=Object.freeze({N:131072,r:8,p:1,maxmem:160*1024*1024});
const fakeSalt=Buffer.from('a663502a93e3824b95ff4c4d93f0af28','hex');
const fakeHash=Buffer.alloc(32);
const fakePassword='not-an-account-password';
const canonicalHex=/^[a-f0-9]{64}$/;
let active=0;

export function validPassword(password){
 return typeof password==='string' && password.length>=15 && password.length<=1024 &&
  password.isWellFormed() && Buffer.byteLength(password,'utf8')<=1024 &&
  [...password].length>=15;
}

function parseDigest(value){
 if(typeof value!=='string'||!/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value))return null;
 const [,salt,hash]=value.split('$');
 return {salt:Buffer.from(salt,'hex'),hash:Buffer.from(hash,'hex')};
}

async function derive(password,salt){
 if(active>=2)throw Object.assign(Error('Password verifier temporarily busy'),{code:'PASSWORD_BUSY'});
 active++;
 try{return await scryptAsync(password,salt,32,parameters);}
 finally{active--;}
}

export async function hashPassword(password){
 if(!validPassword(password))throw Error('Password must have at least 15 characters and at most 1024 UTF-8 bytes');
 const salt=randomBytes(16);
 const hash=await derive(password,salt);
 return [prefix,salt.toString('hex'),hash.toString('hex')].join('$');
}

export async function verifyPassword(password,digest){
 const parsed=parseDigest(digest), acceptable=validPassword(password);
 const hash=await derive(acceptable?password:fakePassword,parsed?.salt??fakeSalt);
 const match=timingSafeEqual(hash,parsed?.hash??fakeHash);
 return Boolean(match&&parsed&&acceptable);
}

function emailOtpDigest(key,identity,challengeId,code){
 if(!Buffer.isBuffer(key)||key.length!==32)throw Error('Email OTP requires a valid server key');
 if(typeof identity!=='string'||!identity||identity.length>2048||!identity.isWellFormed())throw Error('Email OTP requires a verified identity binding');
 if(typeof challengeId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(challengeId))throw Error('Email OTP requires an opaque challenge ID');
 return createHmac('sha256',key).update(JSON.stringify(['BCI:EmailOtp:v1',identity,challengeId,code]),'utf8').digest('hex');
}

export function createEmailOtp(key,identity,challengeId){
 const code=String(randomInt(0,1_000_000)).padStart(6,'0');
 return {code,digest:emailOtpDigest(key,identity,challengeId,code)};
}

export function verifyEmailOtp(key,identity,challengeId,code,digest){
 if(typeof code!=='string'||!/^\d{6}$/.test(code)||typeof digest!=='string'||!canonicalHex.test(digest))return false;
 try{
  const actual=emailOtpDigest(key,identity,challengeId,code);
  return timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(digest,'hex'));
 }catch{return false;}
}
