import {mfaSessionCookie,readMfaCookie,digestSecurityToken} from './mfa.js';

const emailKey=value=>String(value??'').trim().toLowerCase();
export const accountRevision=(state,email)=>state.accountLifecycle?.[emailKey(email)]?.revision??0;
export const accountOffboarded=(state,email)=>state.accountLifecycle?.[emailKey(email)]?.removed===true;
export const isCurrentAccountRecord=(state,email,record)=>Boolean(record&&(record.accountRevision??0)===accountRevision(state,email));

export function revokeAccount(state,value){
 const email=emailKey(value);
 (state.accountLifecycle??={})[email]={revision:accountRevision(state,email)+1,removed:true};
 const ids=new Set(Object.entries(state.accounts||{}).filter(([,account])=>emailKey(account.email)===email).map(([id])=>id));
 for(const [digest,step] of Object.entries(state.passSteps||{}))if(ids.has(step.id)||emailKey(step.email)===email){ids.add(step.id);delete state.passSteps[digest];}
 for(const [digest,session] of Object.entries(state.sessions||{}))if(ids.has(session.id)||emailKey(session.email)===email)delete state.sessions[digest];
 for(const [digest,invite] of Object.entries(state.invites||{}))if(emailKey(invite.email)===email)delete state.invites[digest];
 for(const id of ids)for(const key of ['accounts','attempts','signInLimits'])if(state[key])delete state[key][id];
 if(state.reset)delete state.reset[email];
}
export function restoreAccountAccess(state,email){
 const record=state.accountLifecycle?.[emailKey(email)];
 if(record)record.removed=false;
}
export function clearBrowserSession(state,config,id,requestCookie){
 const cookie=readMfaCookie(requestCookie);
 for(const [bucket,purpose] of [['sessions','session'],['passSteps','pass-step']]){
  const digest=digestSecurityToken(purpose,cookie,config.key);
  if(digest&&state[bucket]?.[digest]?.id===id)delete state[bucket][digest];
 }
 return mfaSessionCookie('',0);
}
