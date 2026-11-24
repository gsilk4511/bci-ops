// RFC 4226/6238, SHA-1 / 6 digits / 30 seconds: standard authenticator profile.
// Transactional callers must persist a returned counter before issuing a session.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const cookieName='__Host-bci-mfa';
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const strictKey=key=>{
 if(!Buffer.isBuffer(key)||key.length!==32)throw Error('MFA encryption key must contain exactly 32 bytes');
 return key;
};

export function mfaKey(encoded){
 if(typeof encoded!=='string'||!/^(?:[A-Za-z0-9+/]{43}=|[A-Za-z0-9_-]{43})$/.test(encoded))throw Error('MFA key must be 32 bytes encoded as base64 or base64url');
 const key=strictKey(Buffer.from(encoded,'base64'));
 if(key.toString(encoded.endsWith('=')?'base64':'base64url')!==encoded)throw Error('MFA key encoding is not canonical');
 return key;
}

function encode32(bytes){
 let bits=0,hold=0,result='';
 for(const value of bytes){
  hold=(hold<<8)|value;bits+=8;
  while(bits>=5){bits-=5;result+=alphabet[(hold>>>bits)&31];}
 }
 if(bits)result+=alphabet[(hold<<(5-bits))&31];
 return result;
}
function decode32(value){
 if(typeof value!=='string'||!/^[A-Z2-7]{32}$/.test(value))throw Error('Invalid TOTP secret');
 let bits=0,hold=0;
 const out=[];
 for(const char of value){
  hold=(hold<<5)|alphabet.indexOf(char);bits+=5;
  if(bits>=8){bits-=8;out.push((hold>>>bits)&255);}
 }
 return Buffer.from(out);
}

export function createTotpEnrollment(email){
 if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Verified email required');
 const secret=encode32(randomBytes(20));
 const params=new URLSearchParams({secret,issuer:'BCI Operations',algorithm:'SHA1',digits:'6',period:'30'});
 return {secret,uri:'otpauth://totp/'+encodeURIComponent('BCI Operations')+':'+encodeURIComponent(email)+'?'+params};
}

export async function totpQrDataUrl(uri){
 if(typeof uri!=='string'||uri.length>2000||!uri.startsWith('otpauth://totp/BCI%20Operations:'))throw Error('Invalid enrollment URL');
 // Render locally; exposing the URI to an external QR service exposes the factor.
 const {default:qr}=await import('qrcode');
 return qr.toDataURL(uri,{errorCorrectionLevel:'M',width:256,margin:4});
}

function aad(identity){
 if(typeof identity!=='string'||!identity||identity.length>2000)throw Error('Missing verified identity binding');
 return Buffer.from('BCI:TOTP:v1\0'+identity,'utf8');
}
export function encryptTotp(secret,key,identity){
 const bytes=decode32(secret);
 const nonce=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',strictKey(key),nonce,{authTagLength:16});
 cipher.setAAD(aad(identity));
 const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
 return 'v1.'+Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function decryptTotp(blob,key,identity){
 if(typeof blob!=='string'||!/^v1\.[A-Za-z0-9_-]{64}$/.test(blob))throw Error('Invalid encrypted TOTP secret');
 const raw=Buffer.from(blob.slice(3),'base64url');
 const decipher=createDecipheriv('aes-256-gcm',strictKey(key),raw.subarray(0,12),{authTagLength:16});
 decipher.setAAD(aad(identity));
 decipher.setAuthTag(raw.subarray(12,28));
 return encode32(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]));
}

export function verifyTotp(secret,code,{now=Date.now(),lastCounter=-1}={}){
 if(typeof code!=='string'||!/^[0-9]{6}$/.test(code)||!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(lastCounter)||lastCounter< -1)return null;
 const bytes=decode32(secret), center=Math.floor(now/30000), supplied=Buffer.from(code,'ascii');
 let matched=null;
 for(const counter of [center-1,center,center+1]){
  if(counter<0||counter<=lastCounter)continue;
  const binary=Buffer.alloc(8);binary.writeBigUInt64BE(BigInt(counter));
  const hash=createHmac('sha1',bytes).update(binary).digest();
  const value=(hash.readUInt32BE(hash[19]&15)&0x7fffffff)%1000000;
  if(timingSafeEqual(supplied,Buffer.from(String(value).padStart(6,'0'),'ascii')))matched=counter;
 }
 return matched;
}

function digest(purpose,token,key){
 if(!/^[a-z][a-z0-9-]{0,39}$/.test(purpose))throw Error('Invalid token purpose');
 const hash=key===undefined?createHash('sha256'):createHmac('sha256',strictKey(key));
 return hash.update('BCI:Security:v1\0'+purpose+'\0'+token,'ascii').digest('hex');
}
export function digestSecurityToken(purpose,token,key){
 if(typeof token!=='string'||!tokenPattern.test(token)||Buffer.from(token,'base64url').toString('base64url')!==token)return null;
 return digest(purpose,token,key);
}
export function issueSecurityToken(purpose,key){
 const token=randomBytes(32).toString('base64url');
 return {token,digest:digestSecurityToken(purpose,token,key)};
}

export function digestRecoveryCode(code,key){
 if(typeof code!=='string'||code.length>31)return null;
 const plain=code.trim().toUpperCase().replaceAll('-','');
 if(!/^[A-Z2-7]{20}$/.test(plain))return null;
 return digest('recovery',plain,strictKey(key));
}
export function createRecoveryCodes(key,count=10){
 strictKey(key);
 if(!Number.isInteger(count)||count<1||count>20)throw Error('Invalid recovery code count');
 const codes=new Set();
 while(codes.size<count)codes.add(encode32(randomBytes(13)).slice(0,20).match(/.{4}/g).join('-'));
 return {codes:[...codes],digests:[...codes].map(code=>digestRecoveryCode(code,key))};
}

export function mfaSessionCookie(token,maxAgeSeconds){
 if(token===''&&maxAgeSeconds===0)return cookieName+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';
 if(!digestSecurityToken('session',token)||!Number.isInteger(maxAgeSeconds)||maxAgeSeconds<1||maxAgeSeconds>43200)throw Error('Invalid MFA session cookie');
 return cookieName+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAgeSeconds;
}
export function readMfaCookie(header){
 if(typeof header!=='string'||header.length>16384)return null;
 const values=header.split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookieName+'='));
 if(values.length!==1)return null;
 const token=values[0].slice(cookieName.length+1);
 return digestSecurityToken('session',token)?token:null;
}
