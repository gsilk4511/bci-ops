import {identityId} from './enrollment.js';
import {issueSecurityToken,digestSecurityToken,readMfaCookie} from './mfa.js';

const lifetime=60*60*1000;
export const previewEmail='permission-test@example.invalid';
export const isPreviewOwner=(user,role,env=process.env)=>role==='admin'&&(
 (env.APP_AUTH_MODE==='local'&&env.NODE_ENV!=='production'&&user.email==='local-admin@example.invalid')||
 (Boolean(user.issuer)&&user.email===(env.BCI_PERMISSION_TEST_OWNER_EMAIL||'rbevins@bcielite.tech').trim().toLowerCase())
);
const cookieName=user=>user.issuer?'__Host-bci-permission-preview':'bci-permission-preview-local';
const cookie=(user,token,expiry)=>cookieName(user)+'='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+expiry+(user.issuer?'; Secure':'');
const binding=(user,header)=>identityId(user)+':'+(readMfaCookie(header)||'');

export function permissionPreviewSessions(createFixture,now=Date.now) {
 const sessions=new Map();
 function inspect(user,header){
  const keys=typeof header==='string'?header.split(';').map(value=>value.trim()).filter(value=>value.startsWith(cookieName(user)+'=')):[];
  if(!keys.length)return {present:false};
  if(keys.length!==1)return {present:true};
  const id=digestSecurityToken('permission-preview',keys[0].slice(cookieName(user).length+1));
  const candidate=id?sessions.get(id):null;
  if(candidate?.expires<=now())sessions.delete(id);
  const session=candidate&&candidate.expires>now()&&candidate.binding===binding(user,header)?candidate:null;
  return {present:true,id,session};
 }
 function start(user,header,role,profile){
  for(const [id,session] of sessions)if(session.expires<=now())sessions.delete(id);
  if(sessions.size>=12)throw Error('Too many active permission previews. Return from a test session or try again later.');
  const record=inspect(user,header);
  if(record.session)throw Error('Return to My View before starting another test.');
  const {token,digest}=issueSecurityToken('permission-preview');
  sessions.set(digest,{binding:binding(user,header),expires:now()+lifetime,role,
   state:createFixture(role,profile),chain:Promise.resolve(),active:true});
  // Session expires server-side first. Keeping the browser marker longer means
  // an expired preview never silently falls back to production.
  return cookie(user,token,86400);
 }
 function end(user,header){
  const record=inspect(user,header);
  if(record.session){record.session.active=false;sessions.delete(record.id);}
  return cookie(user,'',0);
 }
 async function mutate(session,update){
  const job=session.chain.then(async()=>{
   if(!session.active||session.expires<=now())throw Error('Permission preview expired. Return to My View.');
   const next=structuredClone(session.state);
   const result=await update(next);
   if(!session.active||session.expires<=now())throw Error('Permission preview expired. Return to My View.');
   session.state=next;
   return result;
  });
  session.chain=job.catch(()=>{});
  return job;
 }
 return {inspect,start,end,mutate};
}
