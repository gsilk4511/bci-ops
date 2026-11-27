import {permissionPreviewSessions,previewEmail,isPreviewOwner} from '../UserSecurity/permission-preview.js';
import {permissionPreviewFixture} from '../Models/permission-preview-fixture.js';
import {calendarView} from '../Models/calendar.js';
import {createProfileWeather} from './profile-weather.js';
import {dashboardLayout} from '../Models/dashboard-layouts.js';
import {planAttribution,applyAttribution} from '../Models/time-attribution.js';
import {signInConfig,isAppSignIn,canUseEmail,bootSignIn,appAuthView,performAppSignIn,invalidateEmailDelivery} from '../UserSecurity/signin.js';
import {createEmailChannel} from '../UserSecurity/email-channel.js';
import {securityConfig,requiredReady,identityId,audit,verifyStoredEncryptionKey,securityView,inviteAccount,performEnrollment} from '../UserSecurity/enrollment.js';
import {makeSecurityStore,mutateSecurityInTransaction} from '../UserSecurity/store.js';
import {clearBrowserSession,revokeAccount,restoreAccountAccess} from '../UserSecurity/lifecycle.js';
import {listAgentCredentials,issueAgentCredential,revokeAgentCredential,authorizeAgentCredential,agentStatus} from '../UserSecurity/agent-api.js';
import {vehicleDocument,vehiclePhoto,vehiclesView} from '../Models/vehicles.js';
import {applyWarehousePurge,previewWarehousePurge} from '../Models/warehouse-purge.js';
import {applyWarehousePatch,exportWarehouse,previewWarehousePatch} from '../Models/warehouse-export.js';
import {releases} from '../Models/release-history.js';
import {catalogPhotoHash,planCatalogPack,importCatalogPack} from '../Models/catalog-pack.js';
import {recordPrincipal,scopeState,authorizeRecordAction,assignRecord,stampRecordOwner} from '../Models/record-scope.js';
import {readWorkReceipt} from '../Models/work-entry.js';
import {readWarehouseReceipt,warehouseFieldPurchases} from '../Models/warehouse-receipts.js';
import {previewWorkorderRemoval} from '../Models/records.js';
import {validatedContributionYear} from '../Models/staff-profit-settings.js';
import {staffAvatar,staffDirectoryDetail,staffMetrics,staffTechnicianIcons,staffView} from '../Models/staff.js';
import {reconcileStock} from '../Models/stock-demand.js';
import {estimateRates} from '../Models/estimates.js';
import {trainingState,trainingAction} from '../Models/training.js';
import { createMailbox, importMailboxPage, assignMail } from '../Models/mail-intake.js';
import { createPush, notificationView, notificationAction, pendingPush, recordPush } from '../Models/notifications.js';
import { ticketOverview, ticketAttachment } from '../Models/tickets.js';
import { planPricing, pricingOverview } from '../Models/pricing-profiles.js';
import { visibleState } from '../Models/visibility.js';
import { planCatalogImport, catalogImportSummary } from '../Models/lib.js';
import { createAccessSync } from '../Models/access-sync.js';
import { payrollPreview } from '../Models/payroll.js';
import { runCustomerImport } from '../Models/customer-import.js';
import { permissionGroups, modulePermissions, permissionMatrix, permissionDependencies, effectiveAccess, effectivePermissions, authorizePermission } from '../Models/permissions.js';
import {createHash} from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed, applyAction, moneyStats, moneyWorkOrderRows, crewSummary } from '../Models/lib.js';
import { identity, roleFor, projectState, authorizeMachinePerimeter } from '../Models/auth.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const manufacturerImportManifest=JSON.parse(await fs.readFile(path.join(root,'scripts','manufacturer-import-nov20-2026.manifest.json'),'utf8'));
const {version:release}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(release))throw new Error('Invalid BCI Operations release version');
const host=process.env.HOST||'127.0.0.1', port=Number(process.env.PORT||3100);
const dbProvider=process.env.DB_PROVIDER||'json';
const stateFile=path.resolve(process.env.DATA_FILE||path.join(root,'data','pilot-state.json'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const publicRoot=path.join(root,'public');
const catalogPhotoRoot=path.join(root,'Server','CatalogPhotos');
const catalogPhotoNames=await fs.readdir(catalogPhotoRoot,{withFileTypes:true}).catch(error=>{
 if(error.code==='ENOENT')return [];
 throw error;
});
const catalogPhotoIds=new Set(catalogPhotoNames.filter(file=>file.isFile()&&file.name.endsWith('.jpg')&&catalogPhotoHash.test(file.name.slice(0,-4))).map(file=>file.name.slice(0,-4)));
const catalogPackPhotoPolicy={omitUnavailablePhotos:true};
const catalogPackAction=action=>['catalog.packPreview','catalog.packImport'].includes(action);
const catalogPackLimit=8*1024*1024;
const publicOrigin=process.env.PUBLIC_ORIGIN;
const parseStoredState=value=>typeof value==='string'?JSON.parse(value):value;
let state, pool, chain=Promise.resolve();
const accessSync=createAccessSync(process.env);
const mailbox=createMailbox(process.env);
const mailboxStartedAt=new Date().toISOString();
const push=createPush(process.env);
let mailJob, mailError='', pushJob;
const testTimes=new Map();
function enqueue(work){
  const job=chain.then(work);
  chain=job.catch(()=>{});
  return job;
}
if(dbProvider==='mariadb') {
  const mariadb=(await import('mariadb')).default;
  for(const name of ['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME'])if(!process.env[name])throw new Error(`Missing ${name}`);
  pool=mariadb.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,connectionLimit:5,connectTimeout:6000,multipleStatements:false});
  const conn=await pool.getConnection();
  try {
    const rows=await conn.query('SELECT state_json FROM pilot_state WHERE id=1');
    if(!rows.length) {
      if(process.env.ALLOW_DEMO_SEED==='YES' && /(?:_stage|_staging)$/.test(process.env.DB_NAME)) {
        await conn.execute('INSERT INTO pilot_state (id,state_json) VALUES (1,?)',[JSON.stringify(seed())]);
      } else throw new Error('Staging table is empty. Explicitly seed it; never auto-seed production.');
    }
  } finally {conn.release();}
} else if(dbProvider==='json') {
  await fs.mkdir(path.dirname(stateFile),{recursive:true});
  try{state=JSON.parse(await fs.readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state=seed();await fs.writeFile(stateFile,JSON.stringify(state,null,2));}
} else throw new Error('DB_PROVIDER must be json or mariadb');
const security=securityConfig(process.env);
const signIn=signInConfig(process.env,security);
const emailChannel=signIn.emailEnabled?await createEmailChannel(process.env):null;
const securityStore=security.mode==='off'?null:await makeSecurityStore(pool);
if(securityStore){
 const startingSecurity=await securityStore.read();
 verifyStoredEncryptionKey(startingSecurity,security);
 if(!requiredReady(startingSecurity,security))throw Error('User Security enforcement blocked: enroll and verify recovery for two independent protected administrators first');
}
const startingAppGate=signIn.mode==='required'?await securityStore.transact(state=>bootSignIn(state,signIn,security)):true;
let appGateReady=startingAppGate;
const agentAudience=process.env.BCI_AGENT_ACCESS_AUD;
const agentCommonName=process.env.BCI_AGENT_ACCESS_COMMON_NAME;
if(security.agentEnabled&&(!agentAudience||agentAudience===process.env.CF_ACCESS_AUD||!agentCommonName))
 throw Error('Agent API needs its own verified Access audience and service identity');
async function securityBody(req,{allowLocalOrigin=false}={}){
 const origin=publicOrigin||allowLocalOrigin&&process.env.APP_AUTH_MODE==='local'&&/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(req.headers.host||'')&&'http://'+req.headers.host;
 if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')throw Error('Untrusted request origin');
 if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')throw Error('JSON required');
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('Request too large');chunks.push(chunk);}
 const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!result||typeof result!=='object'||Array.isArray(result))throw Error('Invalid request');
 return result;
}
async function load() {
  if(dbProvider==='json')return state;
  const conn=await pool.getConnection();try{const rows=await conn.query('SELECT state_json FROM pilot_state WHERE id=1');if(!rows.length)throw new Error('Missing staging data');return parseStoredState(rows[0].state_json);}finally{conn.release();}
}
// Thumbnails need identity and grants, not the 4,000-item working state.
// Keep access checks fresh without transferring the whole database for each image.
async function loadPhotoAccess(){
  if(dbProvider==='json')return state;
  const [row]=await pool.query("SELECT JSON_EXTRACT(state_json,'$.users') AS team_json, JSON_EXTRACT(state_json,'$.permissionProfiles') AS profiles_json FROM pilot_state WHERE id=1");
  if(!row)throw new Error('Missing staging data');
  const list=value=>{const parsed=parseStoredState(value);return Array.isArray(parsed)?parsed:[];};
  return {users:list(row.team_json),permissionProfiles:list(row.profiles_json)};
}
async function update(action, data, actor) {
  const write = async (s,conn) => {
    const role=roleFor(s,actor);
    const {permissions,recordScopes}=effectiveAccess(s,actor,role);
    const principal=recordPrincipal(s,actor,role,permissions,recordScopes);
    authorizePermission(action,role,permissions,data);
    authorizeRecordAction(s,principal,action,data);
    if(['project.create','project.contact'].includes(action)&&data.newContact)authorizePermission('contact.create',role,permissions);
    if(action==='project.create'&&data.serviceCategory)authorizePermission('pricing.project',role,permissions);
    if(action==='timeAttribution.apply')return applyAttribution(s,data,principal);
    if(action==='warehouse.purgeApply')return applyWarehousePurge(s,manufacturerImportManifest,principal,data);
    s.users ||= [];
    let result;
    if(action==='record.assign')result=assignRecord(s,principal,data);
    else if(action==='warehouse.patchApply')result=applyWarehousePatch(s,data,principal);
    else if(action==='catalog.packImport')result=importCatalogPack(s,data,principal,catalogPhotoIds,catalogPackPhotoPolicy);
    else if(action==='customers.import')result=runCustomerImport(s,data);
    else if(action==='mail.assign')result=assignMail(s,data,principal);
    else if(action.startsWith('notification.'))result=notificationAction(s,action,data,principal);
    else result=applyAction(s,action,data,principal);
    if(conn&&['users.set','users.remove'].includes(action)){
      await mutateSecurityInTransaction(conn,securityState=>{
        if(action==='users.remove'){
          revokeAccount(securityState,result.email);
          audit(securityState,'team-account-removed',actor.email,Date.now(),result.email);
        }else if(data.active!==false)restoreAccountAccess(securityState,result.email);
      },{missingTableAllowed:!securityStore});
    }
    if(action==='warehouse.patchApply'&&(result.existing||!(result.updated||result.added||result.groupsUpdated)))return result;
    stampRecordOwner(action,data,s,result,principal);
    if(action==='customers.import'&&result.conflicts.length)throw Error('Import blocked by conflicts. Run preview and resolve the listed matches.');
    if(['users.set','users.remove','profiles.save','record.assign'].includes(action)){
      s.meta??={};
      s.meta.accessRevision=(Number(s.meta.accessRevision)||0)+1;
    }
    s.events ||= [];
    s.events.unshift({id:`audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,at:new Date().toISOString(),action:`actor.${action}`,reference:result?.id||data.workorderId||'-',detail:actor.email});
    s.events=s.events.slice(0,2500);
    return result;
  };
  return writeState(write);
}
async function writeState(write){
  if(dbProvider==='json') {
    const next=structuredClone(state);const result=await write(next);
    const temp=`${stateFile}.tmp`;await fs.writeFile(temp,JSON.stringify(next,null,2));await fs.rename(temp,stateFile);state=next;return result;
  }
  const conn=await pool.getConnection();
  try {await conn.beginTransaction();const rows=await conn.query('SELECT state_json FROM pilot_state WHERE id=1 FOR UPDATE');const next=parseStoredState(rows[0].state_json);const result=await write(next,conn);await conn.execute('UPDATE pilot_state SET state_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=1',[JSON.stringify(next)]);await conn.commit();return result;}
  catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
// Network requests run outside the database lock. A page and its cursor
// commit together, with a cursor check to handle concurrent workers.
function syncMailbox(){
  if(mailJob)return mailJob;
  mailJob=(async()=>{
    try{
      for(let index=0;index<4;index++){
        const current=await load();
        const previous=current.mailSync?.identity===mailbox.identity?current.mailSync:null;
        const configured=process.env.BCI_MAIL_START_AT;
        const since=previous?.since || (configured && Number.isFinite(Date.parse(configured)) ?
          new Date(configured).toISOString() : mailboxStartedAt);
        const cursor=previous?.cursor;
        let page;
        try{page=await mailbox.page(cursor,since);}
        catch(error){
          if(error.status!==410||!cursor)throw error;
          page=await mailbox.page(null,since);
        }
        await enqueue(()=>writeState(state=>importMailboxPage(state,mailbox.identity,cursor,page,since)));
        if(!page.more)break;
      }
      mailError='';
      return {ok:true};
    }catch(error){
      mailError=error.status?'Mailbox request failed with HTTP '+error.status:'Mailbox sync failed. Check configuration and network access.';
      return {ok:false,error:mailError};
    }finally{mailJob=null;}
  })();
  return mailJob;
}
function dispatchPush(){
  if(pushJob||!push.enabled)return;
  pushJob=(async()=>{
    const snapshot=await load();
    const pending=[];
    for(const user of snapshot.notificationUsers || []){
      const role=roleFor(snapshot,user);
      if(!role)continue;
      const {permissions,recordScopes}=effectiveAccess(snapshot,user,role);
      if(!permissions.includes('notification.view'))continue;
      const principal=recordPrincipal(snapshot,user,role,permissions,recordScopes);
      pending.push(...pendingPush(scopeState(snapshot,principal),principal));
    }
    for(const {email,device,event} of pending.slice(0,40)){
      const latest=await load();
      const account={email};const role=roleFor(latest,account);
      if(!role)continue;
      const {permissions,recordScopes}=effectiveAccess(latest,account,role);
      if(!permissions.includes('notification.view'))continue;
      const principal=recordPrincipal(latest,account,role,permissions,recordScopes);
      if(!pendingPush(scopeState(latest,principal),principal).some(row=>row.device.id===device.id&&row.event.id===event.id))continue;
      let expired=false;
      try{await push.send(device.subscription,event);}
      catch(error){
        expired=error.statusCode===404||error.statusCode===410;
        if(!expired)continue;
      }
      await enqueue(()=>writeState(state=>recordPush(state,email,device.id,event.id,expired)));
    }
  })().catch(()=>console.error('Notification delivery cycle failed')).finally(()=>{pushJob=null;});
}
const testingOwner = (process.env.BCI_TESTING_OWNER_EMAIL||'').trim().toLowerCase();
const quoteIdentifier = name => '`'+name.replaceAll('`','``')+'`';
async function inspectDatabase(url) {
  const tables = await pool.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME<>'bci_user_security' ORDER BY TABLE_NAME");
  const requested = url.searchParams.get('table') ?? tables[0]?.name;
  if (!requested) return {tables, columns:[], rows:[], page:0, more:false};
  const name=tables.find(table=>table.name===requested)?.name;
  if (!name) return null;
  const page = Number(url.searchParams.get('page')||0);
  if (!Number.isSafeInteger(page)||page<0||page>1000000) return null;
  const columns = await pool.query("SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, COLUMN_KEY AS colKey, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",[name]);
  const primary = await pool.query("SELECT COLUMN_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION",[name]);
  const order = primary.length ? ' ORDER BY '+primary.map(column=>quoteIdentifier(column.name)).join(', ') : '';
  const rows = await pool.query('SELECT * FROM '+quoteIdentifier(name)+order+' LIMIT 26 OFFSET ?', [page*25]);
  return {tables,name,columns,rows:rows.slice(0,25),page,more:rows.length>25};
}
// Inspectors honor the same module read gates as ordinary screens.
const databaseTablePermissions = {
 customers:'customers.view',projects:'projects.view',workorders:'workorders.view',
 catalog:'pricing.view',inventory:'inventory.view',movements:'inventory.view',
 purchases:'inventory.view',projectInvoices:'money.view',payrollRuns:'payroll.view'
};
function response(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"frame-ancestors 'none'"});res.end(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item));}
const profileWeather=createProfileWeather();
const permissionPreview=permissionPreviewSessions(permissionPreviewFixture);
const previewApis=new Set(['/api/state','/api/me','/api/action','/api/testing/database','/api/staff-summary','/api/changelog','/api/training/state','/api/training/action']);
const previewAsset=(pathname)=>['/api/staff-directory/','/api/staff-avatar/','/api/vehicle-photo/','/api/vehicle-document/'].some(prefix=>pathname.startsWith(prefix));
const previewExcluded=new Set(['mail.sync','mail.assign','notification.test','notification.subscribe','notification.unsubscribe','access.sync',
 'users.set','users.remove','profiles.save','warehouse.purgePreview','warehouse.purgeApply','warehouse.patchPreview','warehouse.patchApply']);

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://local');
    if(req.method==='GET'&&url.pathname==='/signed-out'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',
        'content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"});
      return res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed out · BCI Operations</title><main><h1>Signed out</h1><p><a href="/">Return to BCI Operations</a></p></main></html>');
    }
    if(req.method==='GET'&&url.pathname==='/api/health')return response(res,200,{ok:true,release,storage:dbProvider,auth:process.env.APP_AUTH_MODE||'cloudflare'});
    if(url.pathname.startsWith('/api/agent/')){
      if(!security.agentEnabled||!appGateReady||url.pathname!=='/api/agent/v1/status')return response(res,404,{error:'Not found'});
      if(req.method!=='GET')return response(res,405,{error:'Method not allowed'});
      try{await authorizeMachinePerimeter(req,agentAudience,agentCommonName);}catch{return response(res,401,{error:'Agent login required'});}
      const authHeaders=req.rawHeaders.filter((value,index)=>index%2===0&&value.toLowerCase()==='authorization');
      const machine=authHeaders.length===1?authorizeAgentCredential(await securityStore.read(),req.headers.authorization):null;
      if(!machine)return response(res,401,{error:'Agent credential rejected'});
      return response(res,200,agentStatus(machine,release));
    }
    let user;
    try{user=await identity(req);}catch(e){return response(res,401,{error:e.message});}
    const photoRoute=url.pathname.startsWith('/api/catalog-photo/');
    let current=await (photoRoute?loadPhotoAccess():load()),role=roleFor(current,user);
    const owner=isPreviewOwner(user,role);
    const permissionTestPath=url.pathname==='/api/permission-test';
    const previewPage=url.pathname==='/permission-preview';
    const {present:previewPresent,session:preview}=permissionPreview.inspect(user,req.headers.cookie);
    const previewRequest=req.headers['x-bci-permission-preview']==='1';
    if((permissionTestPath||previewPage||previewPresent||previewRequest)&&!owner)return response(res,403,{error:'Owner access required'});
    if(previewPresent&&url.pathname.startsWith('/api/security/'))return response(res,403,{error:'Return to My View to manage security'});
    if(previewPresent&&url.pathname==='/security'){res.writeHead(303,{location:'/permission-preview','cache-control':'no-store'});return res.end();}
    if((previewPresent||previewRequest)&&url.pathname==='/api/signout')return response(res,403,{error:'Return to My View before signing out'});
    if(!role)return response(res,403,{error:'Email is not authorized for BCI Operations. Ask Greg to add this user.'});
    if(url.pathname==='/api/signout'){
      if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});
      if(req.headers['sec-fetch-site']==='cross-site'||(publicOrigin&&req.headers.origin!==publicOrigin))return response(res,403,{error:'Untrusted request origin'});
      if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')return response(res,415,{error:'JSON required'});
      if(securityStore){
        const cookie=await securityStore.transact(store=>clearBrowserSession(store,security,identityId(user),req.headers.cookie));
        res.setHeader('set-cookie',cookie);
      }
      return response(res,200,{redirect:user.issuer?'/cdn-cgi/access/logout':'/signed-out'});
    }
    if(securityStore){
      const securityAsset=['/security','/security.js','/security.css','/signin.js','/modules/agent-api.js','/tactile-buttons.css','/modules/tactile-buttons.js'].includes(url.pathname);
      const appLogin=isAppSignIn(signIn,user);
      const emailAllowed=appLogin&&canUseEmail(signIn,role,effectivePermissions(current,user,role));
      let auth={};
      if(!securityAsset||url.pathname==='/security'){
        const securityState=await securityStore.read();
        auth=appLogin?appAuthView(securityState,security,signIn,user,req.headers.cookie,emailAllowed):securityView(securityState,security,user,req.headers.cookie);
      }
      if(url.pathname==='/api/security/session'){
        if(req.method==='GET')return response(res,200,{mode:security.mode,admin:role==='admin',agent:security.agentEnabled&&role==='admin',...auth,appLogin,rolloutReady:appGateReady});
        if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});
        const body=await securityBody(req);
        const result=appLogin?await performAppSignIn(securityStore,security,signIn,user,body,req.headers.cookie,emailAllowed):
          await securityStore.transact(store=>performEnrollment(store,security,user,body,req.headers.cookie));
        if(result.delivery){
          try{await emailChannel.sendCode(user,result.delivery.code);}
          catch{
            await invalidateEmailDelivery(securityStore,security,user,req.headers.cookie,result.delivery.challengeId);
            return response(res,503,{error:'Could not send the code. Try again later or contact your administrator.'});
          }
        }
        if(appLogin&&!appGateReady&&!result.error&&body.operation==='recovery')appGateReady=await securityStore.transact(state=>bootSignIn(state,signIn,security));
        if(result.cookie)res.setHeader('set-cookie',result.cookie);
        return result.error?response(res,400,{error:result.error}):response(res,200,{qr:result.qr,codes:result.codes});
      }
      if(url.pathname==='/api/security/invite'){
        const bootstrap=!appLogin&&security.mode==='optional'&&security.owners.includes(user.email)&&!auth.enrolled&&
          !Object.values((await securityStore.read()).accounts||{}).some(a=>a.enabled&&a.recoveryVerified&&security.owners.includes(a.email));
        if(role!=='admin'||(!auth.recent&&!bootstrap))return response(res,403,{error:'Recent authenticator verification required'});
        if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});
        const body=await securityBody(req);
        const target=String(body.email||'').trim().toLowerCase();
        if(!roleFor(current,{email:target}))return response(res,400,{error:'Add the verified staff email and role in Team first'});
        return response(res,200,await securityStore.transact(store=>{
          if(bootstrap&&!securityView(store,security,user,req.headers.cookie).recent&&Object.values(store.accounts||{}).some(a=>a.enabled&&a.recoveryVerified&&security.owners.includes(a.email)))throw Error('Verify your authenticator first');
          return inviteAccount(store,security,user,target);
        }));
      }
      if(url.pathname==='/api/security/agent-credentials'){
        if(!security.agentEnabled||!appGateReady)return response(res,404,{error:'Not found'});
        if(role!=='admin'||!auth.recent)return response(res,403,{error:'Recent authenticator verification required'});
        if(req.method==='GET')return response(res,200,{credentials:listAgentCredentials(await securityStore.read())});
        if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});
        const body=await securityBody(req);
        return response(res,200,await securityStore.transact(store=>{
          if(!securityView(store,security,user,req.headers.cookie).recent)throw Error('Verify your authenticator first');
          if(body.operation==='issue')return issueAgentCredential(store,body,user.email);
          if(body.operation==='revoke')return revokeAgentCredential(store,body.id,user.email);
          throw Error('Unknown credential operation');
        }));
      }
      if(!securityAsset&&(!auth.allowed||(appLogin&&!appGateReady))){
        if((url.pathname==='/'||previewPage)&&req.method==='GET'){if(previewPage&&owner)res.setHeader('set-cookie',permissionPreview.end(user,req.headers.cookie));res.writeHead(303,{location:'/security','cache-control':'no-store'});return res.end();}
        return response(res,403,{error:'Complete authenticator verification first'});
      }
    }else if(['/security','/security.js','/security.css','/signin.js','/modules/agent-api.js'].includes(url.pathname)||url.pathname.startsWith('/api/security/')){
      return response(res,404,{error:'Not found'});
    }
    if(permissionTestPath){
      if(req.method==='GET'){
        if(previewPresent||previewRequest)return response(res,409,{error:'Return to My View before choosing another test.'});
        return response(res,200,{profiles:(current.permissionProfiles||[]).map(({id,name})=>({id,name}))});
      }
      if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});
      if(req.headers['sec-fetch-site']==='cross-site'||(publicOrigin&&req.headers.origin!==publicOrigin))return response(res,403,{error:'Untrusted request origin'});
      const body=await securityBody(req,{allowLocalOrigin:true});
      if(body.operation==='exit'&&previewRequest){
        res.setHeader('set-cookie',permissionPreview.end(user,req.headers.cookie));
        return response(res,200,{location:'/'});
      }
      if(body.operation!=='start'||previewRequest||previewPresent)return response(res,400,{error:'Invalid permission test operation'});
      const preset=['tech','office','admin','hidden'].includes(body.id)?body.id:null;
      const profile=preset?null:(current.permissionProfiles||[]).find(profile=>profile.id===body.id);
      if(!preset&&!profile)return response(res,400,{error:'Choose a valid permission level'});
      const role=['office','admin'].includes(preset)?preset:'tech';
      const selected=profile?{...structuredClone(profile),id:'preview-profile',name:'Selected Test Profile'}:
        preset==='hidden'?{id:'preview-hidden-profile',schemaVersion:4,permissions:[]}:null;
      res.setHeader('set-cookie',permissionPreview.start(user,req.headers.cookie,role,selected));
      return response(res,200,{location:'/permission-preview'});
    }
    if(previewPresent&&!previewPage&&['/','/index.html'].includes(url.pathname)&&req.method==='GET'){
      res.writeHead(303,{location:'/permission-preview','cache-control':'no-store'});return res.end();
    }
    if(!previewPage&&(previewPresent||previewRequest)&&url.pathname.startsWith('/api/')){
      if(!preview?.active)return response(res,409,{error:'Permission preview expired. Return to My View.'});
      if(!previewRequest&&!(req.method==='GET'&&previewAsset(url.pathname)))return response(res,409,{error:'Open the active Test Permissions tab first.'});
      if(!previewApis.has(url.pathname)&&!previewAsset(url.pathname))return response(res,403,{error:'This integration is unavailable in Test Permissions.'});
      current=preview.state;
      user={email:previewEmail};
      role=preview.role;
    }
    if(url.pathname==='/api/changelog'){
      if(role!=='admin')return response(res,403,{error:'Admin access required'});
      if(req.method!=='GET')return response(res,405,{error:'Method not allowed'});
      return response(res,200,{releases});
    }
    const packRoute=url.pathname==='/api/catalog-pack';
    if(packRoute&&role!=='admin')return response(res,403,{error:'Admin access required'});
    if(packRoute&&req.method!=='POST')return response(res,405,{error:'Method not allowed'});
    const access=effectiveAccess(current,user,role);
    const {permissions,recordScopes}=access;
    if(url.pathname==='/api/warehouse-export'){
      if(role!=='admin')return response(res,403,{error:'Admin access required'});
      if(req.method!=='GET')return response(res,405,{error:'Method not allowed'});
      const snapshot=exportWarehouse(current,{release,finance:permissions.includes('finance.view')});
      res.setHeader('content-disposition','attachment; filename="BCI-Warehouse-'+snapshot.exportedAt.slice(0,10)+'.json"');
      return response(res,200,snapshot);
    }
    if(photoRoute){
      if(req.method!=='GET'&&req.method!=='HEAD')return response(res,405,{error:'Method not allowed'});
      const permitted=permissions.includes('inventory.view')||permissions.includes('pricing.view')||
       permissions.includes('workorders.view')&&permissions.includes('entry.add')||permissions.includes('estimates.view');
      if(!permitted)return response(res,403,{error:'Catalog photo access denied'});
      const hash=url.pathname.match(/^\/api\/catalog-photo\/([a-f0-9]{64})\.jpg$/)?.[1];
      if(!hash||!catalogPhotoIds.has(hash))return response(res,404,{error:'Catalog photo unavailable'});
      const file=path.join(catalogPhotoRoot,hash+'.jpg');
      try{
       const info=await fs.stat(file);
       if(info.size<4||info.size>1048576)return response(res,404,{error:'Catalog photo unavailable'});
       const body=await fs.readFile(file);
       if(body[0]!==255||body[1]!==216||body[2]!==255||body.at(-2)!==255||body.at(-1)!==217||createHash('sha256').update(body).digest('hex')!==hash)return response(res,404,{error:'Catalog photo unavailable'});
       res.writeHead(200,{'content-type':'image/jpeg','content-length':body.length,'cache-control':'private, max-age=3600',
        'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});
       return res.end(req.method==='HEAD'?undefined:body);
      }catch{return response(res,404,{error:'Catalog photo unavailable'});}
    }
    if(url.pathname.startsWith('/api/vehicle-document/')){
      if(req.method!=='GET'&&req.method!=='HEAD')return response(res,405,{error:'Method not allowed'});
      const ids=url.pathname.match(/^\/api\/vehicle-document\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/i);
      let doc;try{if(ids)doc=vehicleDocument(current,{email:user.email,permissions},ids[1],ids[2]);}catch{}
      if(!doc)return response(res,404,{error:'Document unavailable'});
      const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[doc.mime];
      res.writeHead(200,{'content-type':doc.mime,'content-length':doc.bytes.length,'content-disposition':'attachment; filename="vehicle-document.'+ext+'"',
       'cache-control':'private, no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'; sandbox"});
      return res.end(req.method==='HEAD'?undefined:doc.bytes);
    }
    if(url.pathname.startsWith('/api/vehicle-photo/')){
      if(req.method!=='GET'&&req.method!=='HEAD')return response(res,405,{error:'Method not allowed'});
      if(!permissions.includes('vehicles.view'))return response(res,403,{error:'Vehicle access required'});
      let image;try{image=vehiclePhoto(current,{email:user.email,permissions},url.pathname.split('/').at(-1));}catch{}
      if(!image)return response(res,404,{error:'Photo unavailable'});
      res.writeHead(200,{'content-type':image.mime,'content-length':image.bytes.length,'cache-control':'private, no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});
      return res.end(req.method==='HEAD'?undefined:image.bytes);
    }
    if(url.pathname.startsWith('/api/staff-avatar/')){
      if(req.method!=='GET'&&req.method!=='HEAD')return response(res,405,{error:'Method not allowed'});
      if(!permissions.includes('staff.view'))return response(res,403,{error:'Staff access required'});
      let image;try{image=staffAvatar(current,{email:user.email,permissions},url.pathname.split('/').at(-1));}catch{}
      if(!image)return response(res,404,{error:'Photo unavailable'});
      res.writeHead(200,{'content-type':image.mime,'content-length':image.bytes.length,'cache-control':'private, no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});
      return res.end(req.method==='HEAD'?undefined:image.bytes);
    }
    const principal=recordPrincipal(current,user,role,permissions,recordScopes);
    const scoped=scopeState(current,principal);
    const rawDatabaseTesting = Boolean(!preview && pool && testingOwner && role==='admin' && user.email.toLowerCase()===testingOwner);
    if(req.method==='GET'&&url.pathname==='/api/testing/database'){
      const raw=url.searchParams.get('mode')==='raw';
      if(raw?!rawDatabaseTesting:!permissions.includes('database.view'))return response(res,403,{error:'Database Testing access required.'});
      if(!raw){
        const exposed=visibleState(scoped,role,permissions);
        const groups=[
          ['database.clients',['customers','projects']],
          ['database.workorders',['workorders']],
          ['database.stock',['catalog','inventory','movements']],
          ['database.finance',['purchases','projectInvoices'],'finance.view'],
          ['database.payroll',['payrollRuns'],'payroll.view']
        ];
        const tables=groups.flatMap(([grant,names,extra])=>permissions.includes(grant)&&(!extra||permissions.includes(extra))?names.filter(name=>permissions.includes(databaseTablePermissions[name])).map(name=>({name})):[]);
        const name=url.searchParams.get('table')??tables[0]?.name;
        if(!name)return response(res,200,{tables,columns:[],rows:[],more:false});
        if(!tables.some(table=>table.name===name))return response(res,403,{error:'This section is restricted.'});
        const page=Number(url.searchParams.get('page')||0);
        if(!Number.isSafeInteger(page)||page<0||page>1000000)return response(res,400,{error:'Invalid page'});
        const records=exposed[name]||[];
        const rows=records.slice(page*25,page*25+25);
        const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))].map(name=>({name,type:'record'}));
        return response(res,200,{tables,name,columns,rows,more:records.length>(page+1)*25});
      }
      try{
        const result = await inspectDatabase(url);
        return result ? response(res,200,result) : response(res,400,{error:'Invalid table or page'});
      }catch{
        return response(res,500,{error:'Could not read the application database.'});
      }
    }
    if(req.method==='GET'&&url.pathname==='/api/me')return response(res,200,{email:user.email,role,accessRevision:current.meta?.accessRevision||0,...access,permissionTestAvailable:owner&&!preview,permissionTestMode:Boolean(preview)});
    if(req.method==='GET'&&url.pathname==='/api/training/state'){
      if(!permissions.includes('training.view'))return response(res,403,{error:'Training permission required'});
      const practice=trainingState(current,{email:user.email,role,permissions});
      if(permissions.includes('invoice.group'))practice.workorders=practice.workorders.map(order=>({...order,crewSummary:crewSummary(order.entries)}));
      return response(res,200,{...practice,liveAccess:{email:user.email,role,accessRevision:current.meta?.accessRevision||0,...access}});
    }
    if(url.pathname==='/api/profile-weather'){
      if(req.method!=='GET')return response(res,405,{error:'Method not allowed'});
      if(!permissions.includes('staff.view'))return response(res,403,{error:'Staff access required'});
      return response(res,200,await profileWeather());
    }
    if(url.pathname.startsWith('/api/staff-directory/')){
      if(req.method!=='GET')return response(res,405,{error:'Method not allowed'});
      if(!permissions.includes('staff.view'))return response(res,403,{error:'Staff access required'});
      const result=staffDirectoryDetail(current,principal,url.pathname.split('/').at(-1),scoped);
      return response(res,result?200:404,result||{error:'Staff profile unavailable'});
    }
    if(url.pathname==='/api/staff-summary'){
      if(req.method!=='GET')return response(res,405,{error:'Method not allowed'});
      if(!permissions.includes('staff.view'))return response(res,403,{error:'Staff access required'});
      const selection=url.searchParams.get('contributionYear');
      const year=selection===null?undefined:validatedContributionYear(selection);
      return response(res,200,staffMetrics(current,principal,scoped,year,new Set(scoped.projects.map(project=>project.id))));
    }
    if(req.method==='GET'&&url.pathname==='/api/state'){
      const selection=url.searchParams.get('contributionYear');
      const selectedContributionYear=selection===null?undefined:validatedContributionYear(selection);
      const finance=permissions.includes('finance.view')&&(permissions.includes('dashboard.view')||permissions.includes('money.view'));
      const exposed=visibleState(scoped,role,permissions);
      if(permissions.includes('invoice.group'))exposed.workorders=exposed.workorders.map(order=>({...order,crewSummary:crewSummary(order.entries)}));
      exposed.workorders=staffTechnicianIcons(current,principal,exposed.workorders);
      const fleet=vehiclesView(current,principal);
      exposed.calendar=calendarView(current,scoped,principal,fleet);
      return response(res,200,{...exposed,warehouseFieldPurchases:warehouseFieldPurchases(current,scoped,principal),teamAccess:role==='admin'?Object.fromEntries([...new Set([user.email,...(current.users||[]).map(member=>member.email),...(preview?[]:(process.env.BCI_ADMIN_EMAILS||'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean))])].map(email=>{
          const account={email};
          const effectiveRole=preview&&email===previewEmail?role:roleFor(current,account);
          return [email,{protectedAdmin:(process.env.BCI_ADMIN_EMAILS||'').split(',').some(value=>value.trim().toLowerCase()===email.toLowerCase())||process.env.APP_AUTH_MODE==='local'&&email==='local-admin@example.invalid',role:effectiveRole,...effectiveAccess(current,account,effectiveRole)}];
        })):undefined,training:permissions.includes('training.view')?{started:(current.trainingWorkspaces||[]).some(item=>item.email===user.email)}:undefined,notifications:permissions.includes('notification.view')?notificationView(scoped,principal,preview?{}:push):undefined,
        mailIntake:permissions.includes('mail.intake')&&permissions.includes('tickets.view')?{
          enabled:!preview&&mailbox.enabled,address:preview?undefined:mailbox.mailbox,lastSuccess:!preview&&current.mailSync?.identity===mailbox.identity?current.mailSync.lastSuccess:undefined,error:preview?'':mailError,
          messages:(current.mailQueue||[]).map(({attachments,...message})=>({...message,attachmentCount:attachments.length}))
        }:undefined,ticketOverview:permissions.includes('tickets.view')?ticketOverview(scoped,principal):undefined,pricingOverview:permissions.includes('pricing.view')?pricingOverview(scoped,permissions):undefined,accessSync:role==='admin'&&!preview?accessSync.status():undefined,permissionGroups:role==='admin'?permissionGroups:undefined,modulePermissions:role==='admin'?modulePermissions:undefined,permissionMatrix:role==='admin'?permissionMatrix:undefined,permissionDependencies:role==='admin'?permissionDependencies:undefined,stats:finance?moneyStats(scoped):null,dashboardLayout:dashboardLayout(current,principal),moneyOrders:permissions.includes('money.view')&&permissions.includes('finance.view')?moneyWorkOrderRows(scoped):undefined,vehicles:fleet,staff:staffView(current,principal,new Set(scoped.workorders.map(w=>w.id)),new Set(scoped.projects.map(project=>project.id)),scoped,selectedContributionYear),storage:preview?'test':dbProvider,me:{email:user.email,role,permissionTestAvailable:owner&&!preview,permissionTestMode:Boolean(preview),accessRevision:current.meta?.accessRevision||0,clock:permissions.includes('workorders.view')?(current.activeClocks||[]).find(c=>c.email===user.email&&scoped.workorders.some(w=>w.id===c.workorderId)):undefined,clockDefault:permissions.includes('workorders.view')?(current.clockDefaults||[]).find(c=>c.email===user.email):undefined,databaseTesting:permissions.includes('database.view'),rawDatabaseTesting,...access}});
    }
    if(req.method==='POST'&&(packRoute||['/api/action','/api/training/action'].includes(url.pathname))){
      if(req.headers['sec-fetch-site']==='cross-site'||(publicOrigin&&req.headers.origin!==publicOrigin))return response(res,403,{error:'Untrusted request origin'});
      if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')return response(res,415,{error:'JSON required'});
      const limit=packRoute?catalogPackLimit:500000;
      if(Number(req.headers['content-length'])>limit)return response(res,413,{error:'Request too large'});
      const chunks=[];
      let size=0;
      for await(const chunk of req){
        size+=chunk.length;
        if(size>limit)return response(res,413,{error:'Request too large'});
        chunks.push(chunk);
      }
      const raw=Buffer.concat(chunks).toString('utf8');
      let body;try{body=JSON.parse(raw);}catch{return response(res,400,{error:'Invalid JSON request'});}
      if(!body||typeof body.action!=='string'||!body.data||typeof body.data!=='object'||Array.isArray(body.data))throw new Error('Invalid action');
      if(packRoute!==catalogPackAction(body.action))return response(res,400,{error:'Use the matching catalog-pack endpoint'});
      if(preview&&previewExcluded.has(body.action))return response(res,403,{error:'This operation is unavailable in Test Permissions.'});
      if(url.pathname==='/api/training/action'){
        if(!permissions.includes('training.view'))return response(res,403,{error:'Training permission required'});
        const runTraining=state=>{
          const currentRole=preview?role:roleFor(state,user);
          const grants=currentRole?effectivePermissions(state,user,currentRole):[];
          const trainingResult=trainingAction(state,body.action,body.data,{email:user.email,role:currentRole,permissions:grants});
          // Return only fields that callers need. Practice data reads use the same
          // field filters as other application state responses.
          return JSON.parse(JSON.stringify(trainingResult,(key,value)=>!grants.includes('finance.view')&&['cost','unitCost'].includes(key)?undefined:value));
        };
        const result=preview?await permissionPreview.mutate(preview,runTraining):await enqueue(()=>writeState(runTraining));
        return response(res,200,{ok:true,result});
      }
      try{
        authorizePermission(body.action,role,permissions,body.data);
        authorizeRecordAction(current,principal,body.action,body.data);
      }
      catch(error){return response(res,403,{error:error.message});}
      if(body.action==='timeAttribution.preview')return response(res,200,{ok:true,result:planAttribution(current,body.data,principal).plan});
      if(body.action==='warehouse.purgePreview')return response(res,200,{ok:true,result:previewWarehousePurge(current,manufacturerImportManifest)});
      if(body.action==='warehouse.patchPreview')return response(res,200,{ok:true,result:previewWarehousePatch(current,body.data)});
      if(body.action==='inventory.receiptRead')return response(res,200,{ok:true,result:readWarehouseReceipt(current,scoped,principal,body.data)});
      if(body.action==='receipt.read')return response(res,200,{ok:true,result:readWorkReceipt(current,body.data)});
      if(body.action==='workorder.deletePreview')return response(res,200,{ok:true,result:previewWorkorderRemoval(current,body.data.ids)});
      if(body.action==='estimate.rates')return response(res,200,{ok:true,result:estimateRates(scoped,body.data)});
      if(body.action==='mail.sync'){
        if(!mailbox.enabled)return response(res,400,{error:'Configure the Microsoft 365 intake mailbox first'});
        const result=await syncMailbox();
        return response(res,result.ok?200:502,result);
      }
      if(body.action==='notification.test'){
        const device=current.notificationUsers?.find(record=>record.email===user.email)?.devices.find(device=>device.subscription.endpoint===body.data.endpoint);
        if(!device||!push.enabled)return response(res,400,{error:'Enable phone notifications first'});
        if(Date.now()-(testTimes.get(user.email)||0)<20000)return response(res,429,{error:'Wait 20 seconds between test notifications'});
        testTimes.set(user.email,Date.now());
        try{await push.send(device.subscription,{id:'test',label:'Your BCI Operations notifications are enabled.',url:'/?notifications=1'});}
        catch{return response(res,502,{error:'Push service could not deliver the test notification'});}
        return response(res,200,{ok:true,result:{sent:true}});
      }
      if(body.action==='ticket.attachment')return response(res,200,{ok:true,result:ticketAttachment(scoped,body.data,principal)});
      if(body.action==='pricing.profile.preview'){
        const {fingerprint,rates,changes}=planPricing(scoped,body.data.proposal);
        return response(res,200,{ok:true,result:{fingerprint,rates,changes:permissions.includes('workorders.view')?changes:[],changedEntries:changes.length}});
      }
      if(body.action==='payroll.preview') return response(res,200,{ok:true,result:payrollPreview(scoped,body.data.start,body.data.end)});
      if(body.action==='customers.importPreview') return response(res,200,{ok:true,result:runCustomerImport(structuredClone(current),body.data)});
      if(body.action==='catalog.packPreview')return response(res,200,{ok:true,result:planCatalogPack(current,body.data.pack,catalogPhotoIds,catalogPackPhotoPolicy).summary});
      if(body.action==='catalog.importPreview') return response(res,200,{ok:true,result:catalogImportSummary(planCatalogImport(current,body.data))});
      const job=preview?permissionPreview.mutate(preview,next=>{
        // All function inputs come from the preview copy, never the live database.
        const ownAccess=effectiveAccess(next,user,role);
        const actor=recordPrincipal(next,user,role,ownAccess.permissions,ownAccess.recordScopes);
        authorizePermission(body.action,role,actor.permissions,body.data);
        authorizeRecordAction(next,actor,body.action,body.data);
        if(['project.create','project.contact'].includes(body.action)&&body.data.newContact)authorizePermission('contact.create',role,actor.permissions);
        if(body.action==='project.create'&&body.data.serviceCategory)authorizePermission('pricing.project',role,actor.permissions);
        const result=body.action==='record.assign'?assignRecord(next,actor,body.data):
          body.action==='customers.import'?runCustomerImport(next,body.data):
          body.action.startsWith('notification.')?notificationAction(next,body.action,body.data,actor):
          applyAction(next,body.action,body.data,actor);
        stampRecordOwner(body.action,body.data,next,result,actor);
        if(body.action==='customers.import'&&result.conflicts.length)throw Error('Import blocked by conflicts. Run preview and resolve the listed matches.');
        return result;
      }):chain.then(async()=>{

        if(body.action==='access.sync'){
          const latest=await load();
          const latestRole=roleFor(latest,user);
          authorizePermission(body.action,latestRole,effectivePermissions(latest,user,latestRole));
          return accessSync.sync(latest.users||[]);
        }
        const result=await update(body.action,body.data,user);
        if(['users.set','users.remove'].includes(body.action)&&accessSync.status().enabled){
          try{await accessSync.sync((await load()).users||[]);}
          catch{console.error('Could not load users for Cloudflare Access sync');}
        }
        return result;
      });if(!preview)chain=job.catch(()=>{});
      const result=await job;
      const latest=preview?preview.state:await load();
      const latestRole=preview?role:roleFor(latest,user);
      if(!latestRole)return response(res,403,{error:'App access required'});
      const finalPermissions=effectivePermissions(latest,user,latestRole);
      const hidden=new Set();
      if(!finalPermissions.includes('finance.view'))for(const key of ['cost','unitCost','directCost','grossProfit','reserve','quickBooksPurchasePrice','depositLedger'])hidden.add(key);
      if(!finalPermissions.includes('invoices.view'))for(const key of ['groupId','amountPaid','depositCredit','depositLedger'])hidden.add(key);
      const safeResult=hidden.size?JSON.parse(JSON.stringify(result,(key,value)=>hidden.has(key)?undefined:value)):result;
      return response(res,200,{ok:true,result:safeResult});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return response(res,405,{error:'Method not allowed'});
    if(url.pathname==='/security.html')return response(res,404,{error:'Not found'});
    let rel=url.pathname==='/'||previewPage?'index.html':url.pathname==='/security'?'security.html':decodeURIComponent(url.pathname.slice(1));
    if(rel.includes('..')||rel.includes('\\')||rel.startsWith('.'))return response(res,403,{error:'Forbidden'});
    const file=path.resolve(publicRoot,rel);
    if(!file.startsWith(publicRoot+path.sep))return response(res,403,{error:'Forbidden'});
    let body;try{body=await fs.readFile(file);}catch(e){if(e.code==='ENOENT')return response(res,404,{error:'Not found'});throw e;}
    if(rel==='index.html')body=body.toString('utf8').replace('{{BCI_RELEASE}}',release).replace('{{BCI_SECURITY_LINK}}',securityStore&&!previewPage?'<a href="/security">User Security</a>':'');
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});
    return res.end(req.method==='HEAD'?undefined:body);
  }catch(e){
    if(e.sqlState||e.errno||e.code?.startsWith('ER_')){
      console.error('Database or storage request failed:',e.code||e.name);
      return response(res,500,{error:'Could not access application storage.'});
    }
    response(res,400,{error:e.message||'Unexpected request error'});
  }
});
setInterval(async()=>{
  try {
    const current=await load();
    if(current.materialDrafts?.some(draft=>draft.expiresAt<=Date.now()))
      await enqueue(()=>writeState(state=>reconcileStock(state)));
  } catch(error){console.error('Material draft expiry:',error.message);}
},60000).unref();
if(mailbox.enabled){setInterval(syncMailbox,60000).unref();void syncMailbox();}
if(push.enabled)setInterval(dispatchPush,30000).unref();
server.listen(port,host,()=>console.log(`BCI Ops ${dbProvider} at ${host}:${server.address().port}, authentication=${process.env.APP_AUTH_MODE||'cloudflare'}`));
