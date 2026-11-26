import {accountOffboarded,accountRevision,isCurrentAccountRecord} from './lifecycle.js';
import {randomUUID} from 'node:crypto';
import {identityId,audit,requiredReady} from './enrollment.js';
import {encryptTotp,decryptTotp,createTotpEnrollment,verifyTotp,totpQrDataUrl,createRecoveryCodes,digestRecoveryCode,issueSecurityToken,digestSecurityToken,mfaSessionCookie,readMfaCookie} from './mfa.js';
import {validPassword,hashPassword,verifyPassword,createEmailOtp,verifyEmailOtp} from './password.js';

const minute=60000, hour=60*minute;
const allowedEmailGrants=new Set(('dashboard.view customers.view projects.view workorders.view clock.in entry.add entry.update entry.remove receipt.add receipt.read inventory.view staff.view staff.profile staff.leave staff.internal notification.view notification.manage training.view training.start').split(' '));
const fields=store=>{
 store.accounts??={};store.passSteps??={};store.sessions??={};store.signInLimits??={};return store;
};
const denial=error=>({error});
const cookie=(token,time)=>mfaSessionCookie(token,time/1000);
const clearCookie=()=>mfaSessionCookie('',0);
const ticket=(config,header,purpose)=>digestSecurityToken(purpose,readMfaCookie(header),config.key);
const prune=(object,now)=>{for(const [key,v] of Object.entries(object))if(v.expires<=now)delete object[key];};
export function signInConfig(env,security){
 const mode=env.BCI_APP_SIGNIN||'off';
 if(!['off','pilot','required'].includes(mode))throw Error('Invalid BCI_APP_SIGNIN mode');
 const pilots=new Set(String(env.BCI_SIGNIN_PILOTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
 const emailEnabled=env.BCI_SIGNIN_EMAIL==='on';
 if(mode==='off'&&emailEnabled)throw Error('Email fallback requires staged BCI sign-in');
 if(mode!=='off'&&security.mode!=='optional')throw Error('BCI sign-in staging requires BCI_USER_SECURITY=optional; BCI_APP_SIGNIN drives enforcement');
 if(mode==='pilot'&&!pilots.size)throw Error('Select pilot emails before enabling BCI sign-in');
 if(mode==='required'&&security.owners.length<2)throw Error('BCI sign-in enforcement needs two protected administrators');
 return {mode,pilots,emailEnabled};
}
export const isAppSignIn=(config,user)=>config.mode==='required'||config.mode==='pilot'&&config.pilots.has(user.email);
export function canUseEmail(config,role,grants){
 return config.emailEnabled&&role==='tech'&&grants.every(grant=>allowedEmailGrants.has(grant));
}
export function bootSignIn(state,config,security){
 if(config.mode!=='required')return true;
 const roster=JSON.stringify([...security.owners].sort());
 if(state.signInActivation?.owners===roster)return true;
 // Readiness gates first activation and owner-roster changes, not recurring restarts.
 const eligible=Object.fromEntries(Object.entries(state.accounts||{}).filter(([,a])=>a.password));
 if(!requiredReady({accounts:eligible},{...security,mode:'required'}))return false;
 state.signInActivation={owners:roster,at:new Date().toISOString()};
 return true;
}
export function appAuthView(store,security,config,user,requestCookie,emailAllowed,now=Date.now()){
 if(!user.sub||!user.issuer||accountOffboarded(store,user.email))return {allowed:false,identifiable:false};
 const id=identityId(user),account=store.accounts?.[id];
 if(Object.values(store.accounts||{}).some(a=>a.email===user.email&&a.id!==id&&(a.enabled||a.password)))return {allowed:false,identityChanged:true};
 const auth=store.sessions?.[ticket(security,requestCookie,'session')];
 const step=store.passSteps?.[ticket(security,requestCookie,'pass-step')];
 const verified=Boolean(isCurrentAccountRecord(store,user.email,auth)&&auth.appPassword&&auth.id===id&&auth.expires>now&&(auth.method!=='email'||emailAllowed));
 return {allowed:verified,verified,recent:verified&&auth.method==='totp'&&auth.checked+10*minute>=now,
  enrolled:Boolean(account?.enabled),passwordSet:Boolean(account?.password),passwordStep:isCurrentAccountRecord(store,user.email,step)&&step.id===id&&step.expires>now,
  emailAllowed:emailAllowed&& !account?.enabled&&account?.factor!=='totp', method:account?.enabled?'totp':account?.factor||null};
}
export async function performAppSignIn(store,security,config,user,body,requestCookie,emailAllowed,now=Date.now(),renderQr=totpQrDataUrl){
 const op=body.operation;
 if(!user.sub||!user.issuer)return denial('Verified identity is incomplete.');
 const id=identityId(user);
 const intent=await store.transact(state=>{
  fields(state);prune(state.passSteps,now);prune(state.sessions,now);prune(state.signInLimits,now);
  if(accountOffboarded(state,user.email))return denial('Account access was removed.');
  const revision=accountRevision(state,user.email);
  const view=appAuthView(state,security,config,user,requestCookie,emailAllowed,now);
  if(view.identityChanged)return denial('Cloudflare identity changed. Contact your trusted administrator.');
  const account=state.accounts[id];
  const newSession=method=>{
   delete state.passSteps[ticket(security,requestCookie,'pass-step')];
   const {token,digest}=issueSecurityToken('session',security.key);
   state.sessions[digest]={id,email:user.email,accountRevision:revision,method,appPassword:true,checked:now,expires:now+8*hour};
   return {cookie:cookie(token,8*hour)};
  };
  if(op==='logout'){
   for(const [obj,purpose] of [[state.sessions,'session'],[state.passSteps,'pass-step']]){
    const digest=ticket(security,requestCookie,purpose);
    if(obj[digest]?.id===id)delete obj[digest];
   }
   return {cookie:clearCookie()};
  }
  const limit=state.signInLimits[id]??={expires:now+15*minute,password:0,factor:0,mail:0};
  if(op==='password'){
   if(limit.password++>=8)return denial('Too many sign-in attempts. Try again later.');
   if(!account?.password&&!validPassword(body.password))return denial('Use a passphrase of at least 15 characters.');
   return {passwordWork:true,expected:account?.password,revision};
  }
  if(op==='replace-recovery'){
   if(!view.recent)return denial('Verify your authenticator again first.');
   const {codes,digests}=createRecoveryCodes(security.key);account.recovery=digests;account.recoveryVerified=false;
   audit(state,'recovery-codes-replaced',user.email,now);
   return {codes};
  }
  const digest=ticket(security,requestCookie,'pass-step');
  const step=state.passSteps[digest];
  if(!isCurrentAccountRecord(state,user.email,step)||step.id!==id||step.expires<=now||step.expected!==account?.password)return denial('Enter your BCI password first.');
  if(op==='begin-totp'){
   if(account?.enabled||account?.factor==='email')return denial('Use your existing verification method.');
   if(limit.factor++>=20)return denial('Too many factor attempts. Try again later.');
   const {secret,uri}=createTotpEnrollment(user.email);
   step.pendingTotp=encryptTotp(secret,security.key,id);
   return {renderQr:uri};
  }
  if(op==='email-send'){
   if(!emailAllowed||account?.enabled||account?.factor==='totp')return denial('Authenticator required for this account.');
   if(limit.mail++>=3||(step.email?.sent??-Infinity)+minute>now)return denial('Wait before requesting another code.');
   const challengeId=randomUUID(), {code,digest:otp}=createEmailOtp(security.key,id,challengeId);
   step.email={challengeId,otp,expires:now+5*minute,sent:now};
   audit(state,'email-code-requested',user.email,now);
   return {delivery:{code,challengeId}};
  }
  if(limit.factor++>=20)return denial('Too many factor attempts. Try again later.');
  let method, counter, recoveryIndex=-1;
  if(op==='email-verify'){
   if(!emailAllowed||account?.enabled||account?.factor==='totp')return denial('Authenticator required for this account.');
   const email=step.email;
   if(!email||email.expires<=now||!verifyEmailOtp(security.key,id,email.challengeId,body.code,email.otp))return denial('Invalid or expired email code.');
   method='email';
  }else if(op==='totp-verify'){
   const source=account?.enabled?account.secret:account?.factor==='email'?null:step.pendingTotp;
   if(!source)return denial('Start authenticator setup first.');
   counter=verifyTotp(decryptTotp(source,security.key,id),body.code,{now,lastCounter:account?.lastCounter??-1});
   if(counter===null)return denial('Invalid or already-used authenticator code.');
   method='totp';
  }else if(op==='recovery'){
   const key=digestRecoveryCode(body.code,security.key);
   recoveryIndex=key?(account?.recovery||[]).indexOf(key):-1;
   if(!account?.password||!account.enabled||recoveryIndex<0)return denial('Invalid or used recovery code.');
   method='recovery';
  }else return denial('Unknown sign-in step.');
  const current=state.accounts[id]??={id,email:user.email};
  current.password??=step.newHash;
  let codes;
  if(method==='totp'){
   if(!current.enabled){
    const recovery=createRecoveryCodes(security.key);
    current.secret=step.pendingTotp;current.enabled=true;
    current.recovery=recovery.digests;current.recoveryVerified=false;codes=recovery.codes;
   }
   current.lastCounter=counter;current.factor='totp';
  }else if(method==='email')current.factor='email';
  else{current.recovery.splice(recoveryIndex,1);current.recoveryVerified=true;}
  audit(state,'app-signin-'+method,user.email,now);
  return {...newSession(method),codes};
 });
 if(intent.error)return intent;
 if(intent.renderQr)return {qr:await renderQr(intent.renderQr)};
 if(!intent.passwordWork)return intent;
 const verified=intent.expected?await verifyPassword(body.password,intent.expected):false;
 if(intent.expected&&!verified)return denial('Invalid BCI sign-in.');
 const newHash=intent.expected?undefined:await hashPassword(body.password);
 return store.transact(state=>{
  fields(state);
  if(accountOffboarded(state,user.email)||accountRevision(state,user.email)!==intent.revision||state.accounts[id]?.password!==intent.expected)return denial('Sign-in changed. Restart with your BCI password.');
  for(const [digest,step] of Object.entries(state.passSteps))if(step.id===id)delete state.passSteps[digest];
  const {token,digest}=issueSecurityToken('pass-step',security.key);
  state.passSteps[digest]={id,email:user.email,accountRevision:intent.revision,expected:intent.expected,newHash,expires:now+10*minute};
  return {cookie:cookie(token,10*minute)};
 });
}

export async function invalidateEmailDelivery(store,security,user,requestCookie,challengeId){
 const id=identityId(user);
 await store.transact(state=>{
  const step=state.passSteps?.[ticket(security,requestCookie,'pass-step')];
  if(step?.id===id&&step.email?.challengeId===challengeId){step.email.expires=0;delete step.email.otp;}
 });
}
