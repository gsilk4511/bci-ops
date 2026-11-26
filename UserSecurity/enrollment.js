import {accountOffboarded,accountRevision,isCurrentAccountRecord} from './lifecycle.js';
import {createHash} from 'node:crypto';
import {mfaKey,createTotpEnrollment,encryptTotp,decryptTotp,verifyTotp,issueSecurityToken,digestSecurityToken,createRecoveryCodes,digestRecoveryCode,mfaSessionCookie,readMfaCookie,totpQrDataUrl} from './mfa.js';

const minute=60000, lifetime=8*60*minute, inviteLifetime=24*60*minute, pendingLifetime=10*minute;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const identityId=user=>createHash('sha256').update(JSON.stringify([user.issuer,user.sub,user.email])).digest('hex');
export const audit=(state,event,email,now,target)=>{(state.audit??=[]).unshift({event,email,at:new Date(now).toISOString(),...(target?{target}:{})});state.audit.length=Math.min(state.audit.length,2000);};
const maps=state=>{
 state.accounts??={};state.invites??={};state.reset??={};state.sessions??={};state.attempts??={};
 return state;
};
export function securityConfig(env){
 const mode=env.BCI_USER_SECURITY||'off';
 if(!['off','optional','required'].includes(mode))throw Error('Invalid BCI_USER_SECURITY mode');
 const agentEnabled=env.BCI_AGENT_API==='on';
 if(mode==='off'){
  if(agentEnabled)throw Error('Agent API requires User Security');
  return {mode,agentEnabled};
 }
 let validOrigin=false;
 try{const candidate=new URL(env.PUBLIC_ORIGIN);validOrigin=candidate.protocol==='https:'&&candidate.origin===env.PUBLIC_ORIGIN;}catch{}
 if((env.APP_AUTH_MODE||'cloudflare')!=='cloudflare'||!validOrigin)
  throw Error('User Security requires verified Cloudflare identity and exact HTTPS PUBLIC_ORIGIN');
 const key=mfaKey(env.BCI_MFA_ENCRYPTION_KEY);
 const owners=[...new Set(String(env.BCI_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(x=>emailPattern.test(x)))];
 if(mode==='required'&&owners.length<2)throw Error('Required User Security needs two independent protected administrators');
 return {mode,key,owners,agentEnabled};
}
export function verifyStoredEncryptionKey(state,config){
 const existing=Object.values(state.accounts||{}).find(account=>account.enabled&&account.secret);
 if(existing){
  try{decryptTotp(existing.secret,config.key,existing.id);}
  catch{throw Error('Existing authenticator data cannot be decrypted with this security key');}
 }
}
export function requiredReady(state,config){
 if(config.mode!=='required')return true;
 return new Set(Object.values(state.accounts||{}).filter(a=>config.owners.includes(a.email)&&a.enabled&&a.recoveryVerified&&(a.recovery||[]).length>0).map(a=>a.email)).size>=2;
}
export function securityView(state,config,user,cookie,now=Date.now()){
 if(accountOffboarded(state,user.email))return {allowed:false,reason:'Account access was removed'};
 if(config.mode==='off')return {allowed:true};
 if(!user.issuer||!user.sub)return {allowed:false,reason:'Verified identity is incomplete'};
 const id=identityId(user), account=state.accounts?.[id];
 if(Object.values(state.accounts||{}).some(a=>a.email===user.email&&a.id!==id&&a.enabled))return {allowed:false,enrolled:true,reason:'Identity changed. Contact Greg for trusted-host recovery.'};
 const digest=digestSecurityToken('session',readMfaCookie(cookie),config.key);
 const session=digest&&state.sessions?.[digest];
 const verified=Boolean(account?.enabled&&isCurrentAccountRecord(state,user.email,session)&&session.id===id&&session.expires>now);
 const enrolled=Boolean(account?.enabled);
 return {allowed:verified||(!enrolled&&!state.reset?.[user.email]&&config.mode==='optional'),enrolled,verified,recent:verified&&session.method==='totp'&&session.checked+10*minute>=now,recoveryVerified:Boolean(account?.recoveryVerified)};
}
export function inviteAccount(state,config,actor,target,now=Date.now()){
 maps(state);
 const email=String(target||'').trim().toLowerCase();
 if(!emailPattern.test(email)||email.length>254)throw Error('Enter a valid staff email address');
 if(accountOffboarded(state,email))throw Error('Account access was removed');
 const token=issueSecurityToken('invite',config.key);
 for(const [digest,invite] of Object.entries(state.invites))if(invite.expires<=now||invite.email===email)delete state.invites[digest];
 if(Object.keys(state.invites).length>=500)throw Error('Invitation capacity reached');
 state.invites[token.digest]={email,expires:now+inviteLifetime};
 audit(state,'invite-issued',actor.email,now,email);
 return {invitation:token.token,expires:new Date(now+inviteLifetime).toISOString()};
}
export async function performEnrollment(state,config,user,body,cookie,now=Date.now(),renderQr=totpQrDataUrl){
 maps(state);
 if(accountOffboarded(state,user.email))return {error:'Account access was removed'};
 if(!user.issuer||!user.sub)throw Error('Verified identity is incomplete');
 const id=identityId(user);
 let account=state.accounts[id];
 if(Object.values(state.accounts).some(a=>a.email===user.email&&a.id!==id&&a.enabled))throw Error('Identity changed. Contact Greg for trusted-host recovery.');
 if((state.attempts[id]?.until||0)<=now)state.attempts[id]={until:now+5*minute,count:0};
 const attempts=state.attempts[id];
 if(attempts.count++>=10)return {error:'Too many attempts. Wait five minutes.'};
 const current=securityView(state,config,user,cookie,now);
 const mint=method=>{
  const {token,digest}=issueSecurityToken('session',config.key);
  for(const [key,s] of Object.entries(state.sessions))if(s.expires<=now)delete state.sessions[key];
  state.sessions[digest]={id,email:user.email,accountRevision:accountRevision(state,user.email),method,checked:now,expires:now+lifetime};
  return mfaSessionCookie(token,lifetime/1000);
 };
 const fail=message=>({error:message});
 if(body.operation==='begin'){
  if(account?.enabled)return fail('Authenticator is already set up');
  if(!account?.invited){
   const digest=digestSecurityToken('invite',body.invitation,config.key), invitation=digest&&state.invites[digest];
   if(!invitation||invitation.email!==user.email||invitation.expires<=now)return fail('A current invitation for this account is required');
   delete state.invites[digest];
   account={id,email:user.email,invited:true};
   state.accounts[id]=account;
  }
  const {secret,uri}=createTotpEnrollment(user.email);
  account.pending=encryptTotp(secret,config.key,id);
  account.pendingExpires=now+pendingLifetime;
  return {qr:await renderQr(uri)};
 }
 if(body.operation==='confirm'){
  if(!account?.pending||account.pendingExpires<=now||account.enabled)return fail('Start setup again');
  const counter=verifyTotp(decryptTotp(account.pending,config.key,id),body.code,{now});
  if(counter===null)return fail('Invalid code or time out of sync');
  const {codes,digests}=createRecoveryCodes(config.key);
  account.secret=account.pending;account.enabled=true;account.lastCounter=counter;account.recovery=digests;account.recoveryVerified=false;
  delete account.pending;delete account.pendingExpires;delete state.reset[user.email];
  audit(state,'totp-enrolled',user.email,now);
  return {codes,cookie:mint('totp')};
 }
 if(body.operation==='logout'){
  const digest=digestSecurityToken('session',readMfaCookie(cookie),config.key);
  if(digest&&state.sessions[digest]?.id===id)delete state.sessions[digest];
  return {cookie:mfaSessionCookie('',0)};
 }
 if(!account?.enabled)return fail('Set up the authenticator first');
 if(body.operation==='verify'){
  const counter=verifyTotp(decryptTotp(account.secret,config.key,id),body.code,{now,lastCounter:account.lastCounter});
  if(counter===null)return fail('Invalid or already used authenticator code');
  account.lastCounter=counter;
  audit(state,'totp-verified',user.email,now);
  return {cookie:mint('totp')};
 }
 if(body.operation==='replace-recovery'){
  if(!current.recent)return fail('Verify your authenticator again before replacing recovery codes');
  const {codes,digests}=createRecoveryCodes(config.key);
  account.recovery=digests;account.recoveryVerified=false;
  audit(state,'recovery-codes-replaced',user.email,now);
  return {codes};
 }
 if(body.operation==='recovery'){
  const code=digestRecoveryCode(body.code,config.key);
  const index=code?account.recovery.indexOf(code):-1;
  if(index<0)return fail('Invalid or already used recovery code');
  account.recovery.splice(index,1);account.recoveryVerified=true;
  audit(state,'recovery-code-used',user.email,now);
  return {cookie:current.recent?undefined:mint('recovery')};
 }
 return fail('Unknown security operation');
}

// Offline maintenance only. Caller must authenticate at the trusted host independently.
export function resetAuthenticator(state,config,email,now=Date.now()){
 maps(state);
 if(config.mode!=='optional')throw Error('Reset requires deliberately placing User Security in optional mode');
 const matching=Object.values(state.accounts).filter(account=>account.email===email);
 if(!matching.length)throw Error('No authenticator account matches that staff email');
 for(const account of matching){
  delete state.accounts[account.id];
  delete state.attempts[account.id];
  if(state.signInLimits)delete state.signInLimits[account.id];
  for(const [digest,step] of Object.entries(state.passSteps||{}))if(step.id===account.id)delete state.passSteps[digest];
  for(const [digest,session] of Object.entries(state.sessions))if(session.id===account.id)delete state.sessions[digest];
 }
 for(const [digest,invite] of Object.entries(state.invites))if(invite.email===email)delete state.invites[digest];
 state.reset[email]=true;
 audit(state,'trusted-host-reset','trusted-host',now,email);
}
