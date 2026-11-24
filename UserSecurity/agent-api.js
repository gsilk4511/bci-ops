import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';

const maxDays=90, maxActive=20, maxRecords=100, maxAudit=250;
const day=86_400_000;
const scope='status:read';
const fingerprint=secret=>createHash('sha256').update(secret,'ascii').digest();
const rows=store=>Array.isArray(store.agentCredentials)?store.agentCredentials:[];
const visible=({id,name,createdAt,expiresAt,revokedAt})=>({id,name,scope,createdAt,expiresAt,revokedAt});
const active=(entry,now)=>entry.scope===scope&&entry.revokedAt==null&&Number.isSafeInteger(entry.expiresAt)&&entry.expiresAt>now;

function audit(store, event, id, owner, now) {
  store.agentAudit=[{event,id,owner,at:now},...(store.agentAudit||[])].slice(0,maxAudit);
}

export function listAgentCredentials(store) {
  return rows(store).map(visible);
}

export function issueAgentCredential(store,input,owner,now=Date.now()) {
  const name=typeof input?.name==='string'?input.name.trim():'';
  if(!name||name.length>80||/[\u0000-\u001f\u007f]/.test(name))throw Error('Enter a safe credential name of 1 to 80 characters.');
  if(!Number.isInteger(input.days)||input.days<1||input.days>maxDays)throw Error('Expiry must be 1 to 90 whole days.');
  const existing=rows(store);
  if(existing.filter(row=>active(row,now)).length>=maxActive)throw Error('Revoke an existing credential before creating another.');
  const id=randomBytes(16).toString('hex');
  const secret=randomBytes(32).toString('base64url');
  const entry={id,name,scope,createdAt:now,expiresAt:now+input.days*day,revokedAt:null,digest:fingerprint(secret).toString('hex')};
  store.agentCredentials=[entry,...existing.filter(x=>active(x,now)),...existing.filter(x=>!active(x,now))].slice(0,maxRecords);
  audit(store,'agent.issue',id,owner,now);
  return {credential:visible(entry),token:'bci1_'+id+'.'+secret};
}

export function revokeAgentCredential(store,id,owner,now=Date.now()) {
  if(typeof id!=='string'||!(/^[a-f0-9]{32}$/).test(id))throw Error('Invalid credential ID.');
  const entry=rows(store).find(row=>row.id===id);
  if(!entry)throw Error('Credential not found.');
  if(entry.revokedAt==null){
    entry.revokedAt=now;
    delete entry.digest;
    audit(store,'agent.revoke',id,owner,now);
  }
  return {credential:visible(entry)};
}

export function authorizeAgentCredential(store,authorization,now=Date.now()) {
  if(typeof authorization!=='string'||authorization.length>100)return null;
  const match=authorization.match(/^Bearer bci1_([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/i);
  if(!match)return null;
  const [,id,secret]=match;
  const entry=rows(store).find(row=>row.id===id);
  if(!entry||!active(entry,now)||!(/^[a-f0-9]{64}$/).test(entry.digest))return null;
  if(!timingSafeEqual(fingerprint(secret),Buffer.from(entry.digest,'hex')))return null;
  return Object.freeze({kind:'agent',credentialId:id,scope});
}

export function agentStatus(principal,release) {
  if(principal?.kind!=='agent'||principal.scope!==scope)throw Error('Machine scope denied.');
  return {ok:true,release,scope};
}
