import {applyWarehousePatch,exportWarehouse,previewWarehousePatch} from '../Models/warehouse-export.js';
import {releases} from '../Models/release-history.js';
import {catalogPhotoHash,planCatalogPack,importCatalogPack} from '../Models/catalog-pack.js';
import {recordPrincipal,scopeState,authorizeRecordAction,assignRecord,stampRecordOwner} from '../Models/record-scope.js';
import {readWorkReceipt} from '../Models/work-entry.js';
import {readWarehouseReceipt,warehouseFieldPurchases} from '../Models/warehouse-receipts.js';
import {previewWorkorderRemoval} from '../Models/records.js';
import {staffView} from '../Models/staff.js';
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
import { permissionGroups, modulePermissions, permissionMatrix, effectiveAccess, effectivePermissions, authorizePermission } from '../Models/permissions.js';
import {createHash} from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed, applyAction, moneyStats, crewSummary } from '../Models/lib.js';
import { identity, roleFor, projectState } from '../Models/auth.js';
const root=fileURLToPath(new URL('../',import.meta.url));
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
  const write = async s => {
    const role=roleFor(s,actor);
    const {permissions,recordScopes}=effectiveAccess(s,actor,role);
    const principal=recordPrincipal(s,actor,role,permissions,recordScopes);
    authorizePermission(action,role,permissions,data);
    authorizeRecordAction(s,principal,action,data);
    if(['project.create','project.contact'].includes(action)&&data.newContact)authorizePermission('contact.create',role,permissions);
    if(action==='project.create'&&data.serviceCategory)authorizePermission('pricing.project',role,permissions);
    s.users ||= [];
    let result;
    if(action==='record.assign')result=assignRecord(s,principal,data);
    else if(action==='warehouse.patchApply')result=applyWarehousePatch(s,data,principal);
    else if(action==='catalog.packImport')result=importCatalogPack(s,data,principal,catalogPhotoIds);
    else if(action==='customers.import')result=runCustomerImport(s,data);
    else if(action==='mail.assign')result=assignMail(s,data,principal);
    else if(action.startsWith('notification.'))result=notificationAction(s,action,data,principal);
    else result=applyAction(s,action,data,principal);
    if(action==='warehouse.patchApply'&&(result.existing||!result.updated))return result;
    stampRecordOwner(action,data,s,result,principal);
    if(action==='customers.import'&&result.conflicts.length)throw Error('Import blocked by conflicts. Run preview and resolve the listed matches.');
    if(['users.set','profiles.save','record.assign'].includes(action)){
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
  try {await conn.beginTransaction();const rows=await conn.query('SELECT state_json FROM pilot_state WHERE id=1 FOR UPDATE');const next=parseStoredState(rows[0].state_json);const result=await write(next);await conn.execute('UPDATE pilot_state SET state_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=1',[JSON.stringify(next)]);await conn.commit();return result;}
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
  const tables = await pool.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
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
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://local');
    if(req.method==='GET'&&url.pathname==='/api/health')return response(res,200,{ok:true,release,storage:dbProvider,auth:process.env.APP_AUTH_MODE||'cloudflare'});
    let user;
    try{user=await identity(req);}catch(e){return response(res,401,{error:e.message});}
    const photoRoute=url.pathname.startsWith('/api/catalog-photo/');
    const current=await (photoRoute?loadPhotoAccess():load());const role=roleFor(current,user);
    if(!role)return response(res,403,{error:'Email is not authorized for BCI Operations. Ask Greg to add this user.'});
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
    const principal=recordPrincipal(current,user,role,permissions,recordScopes);
    const scoped=scopeState(current,principal);
    const rawDatabaseTesting = Boolean(pool && testingOwner && role==='admin' && user.email.toLowerCase()===testingOwner);
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
    if(req.method==='GET'&&url.pathname==='/api/me')return response(res,200,{email:user.email,role,accessRevision:current.meta?.accessRevision||0,...access});
    if(req.method==='GET'&&url.pathname==='/api/training/state'){
      if(!permissions.includes('training.view'))return response(res,403,{error:'Training permission required'});
      const practice=trainingState(current,{email:user.email,role,permissions});
      if(permissions.includes('invoice.group'))practice.workorders=practice.workorders.map(order=>({...order,crewSummary:crewSummary(order.entries)}));
      return response(res,200,{...practice,liveAccess:{email:user.email,role,accessRevision:current.meta?.accessRevision||0,...access}});
    }
    if(req.method==='GET'&&url.pathname==='/api/state'){
      const finance=permissions.includes('finance.view')&&(permissions.includes('dashboard.view')||permissions.includes('money.view'));
      const exposed=visibleState(scoped,role,permissions);
      if(permissions.includes('invoice.group'))exposed.workorders=exposed.workorders.map(order=>({...order,crewSummary:crewSummary(order.entries)}));
      return response(res,200,{...exposed,warehouseFieldPurchases:warehouseFieldPurchases(current,scoped,principal),teamAccess:role==='admin'?Object.fromEntries([...new Set([user.email,...(current.users||[]).map(member=>member.email),...(process.env.BCI_ADMIN_EMAILS||'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean)])].map(email=>{
          const account={email};
          const effectiveRole=roleFor(current,account);
          return [email,{protectedAdmin:(process.env.BCI_ADMIN_EMAILS||'').split(',').some(value=>value.trim().toLowerCase()===email.toLowerCase())||process.env.APP_AUTH_MODE==='local'&&email==='local-admin@example.invalid',role:effectiveRole,...effectiveAccess(current,account,effectiveRole)}];
        })):undefined,training:permissions.includes('training.view')?{started:(current.trainingWorkspaces||[]).some(item=>item.email===user.email)}:undefined,notifications:permissions.includes('notification.view')?notificationView(scoped,principal,push):undefined,
        mailIntake:permissions.includes('mail.intake')&&permissions.includes('tickets.view')?{
          enabled:mailbox.enabled,address:mailbox.mailbox,lastSuccess:current.mailSync?.identity===mailbox.identity?current.mailSync.lastSuccess:undefined,error:mailError,
          messages:(current.mailQueue||[]).map(({attachments,...message})=>({...message,attachmentCount:attachments.length}))
        }:undefined,ticketOverview:permissions.includes('tickets.view')?ticketOverview(scoped,principal):undefined,pricingOverview:permissions.includes('pricing.view')?pricingOverview(scoped,permissions):undefined,accessSync:role==='admin'?accessSync.status():undefined,permissionGroups:role==='admin'?permissionGroups:undefined,modulePermissions:role==='admin'?modulePermissions:undefined,permissionMatrix:role==='admin'?permissionMatrix:undefined,stats:finance?moneyStats(scoped):null,staff:staffView(current,principal,new Set(scoped.workorders.map(w=>w.id))),storage:dbProvider,me:{email:user.email,role,accessRevision:current.meta?.accessRevision||0,clock:permissions.includes('workorders.view')?(current.activeClocks||[]).find(c=>c.email===user.email&&scoped.workorders.some(w=>w.id===c.workorderId)):undefined,clockDefault:permissions.includes('workorders.view')?(current.clockDefaults||[]).find(c=>c.email===user.email):undefined,databaseTesting:permissions.includes('database.view'),rawDatabaseTesting,...access}});
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
      if(url.pathname==='/api/training/action'){
        if(!permissions.includes('training.view'))return response(res,403,{error:'Training permission required'});
        const result=await enqueue(()=>writeState(state=>{
          const currentRole=roleFor(state,user);
          const grants=currentRole?effectivePermissions(state,user,currentRole):[];
          const trainingResult=trainingAction(state,body.action,body.data,{email:user.email,role:currentRole,permissions:grants});
          // Return only fields that callers need. Practice data reads use the same
          // field filters as other application state responses.
          return JSON.parse(JSON.stringify(trainingResult,(key,value)=>!grants.includes('finance.view')&&['cost','unitCost'].includes(key)?undefined:value));
        }));
        return response(res,200,{ok:true,result});
      }
      try{
        authorizePermission(body.action,role,permissions,body.data);
        authorizeRecordAction(current,principal,body.action,body.data);
      }
      catch(error){return response(res,403,{error:error.message});}
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
      if(body.action==='catalog.packPreview')return response(res,200,{ok:true,result:planCatalogPack(current,body.data.pack,catalogPhotoIds).summary});
      if(body.action==='catalog.importPreview') return response(res,200,{ok:true,result:catalogImportSummary(planCatalogImport(current,body.data))});
      const job=chain.then(async()=>{
        if(body.action==='access.sync'){
          const latest=await load();
          const latestRole=roleFor(latest,user);
          authorizePermission(body.action,latestRole,effectivePermissions(latest,user,latestRole));
          return accessSync.sync(latest.users||[]);
        }
        const result=await update(body.action,body.data,user);
        if(body.action==='users.set'&&accessSync.status().enabled){
          try{await accessSync.sync((await load()).users||[]);}
          catch{console.error('Could not load users for Cloudflare Access sync');}
        }
        return result;
      });chain=job.catch(()=>{});
      const result=await job;
      const latest=await load();
      const latestRole=roleFor(latest,user);
      if(!latestRole)return response(res,403,{error:'App access required'});
      const finalPermissions=effectivePermissions(latest,user,latestRole);
      const hidden=new Set();
      if(!finalPermissions.includes('finance.view'))for(const key of ['cost','unitCost','directCost','grossProfit','reserve','quickBooksPurchasePrice','depositLedger'])hidden.add(key);
      if(!finalPermissions.includes('invoices.view'))for(const key of ['groupId','amountPaid','depositCredit','depositLedger'])hidden.add(key);
      const safeResult=hidden.size?JSON.parse(JSON.stringify(result,(key,value)=>hidden.has(key)?undefined:value)):result;
      return response(res,200,{ok:true,result:safeResult});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return response(res,405,{error:'Method not allowed'});
    let rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    if(rel.includes('..')||rel.includes('\\')||rel.startsWith('.'))return response(res,403,{error:'Forbidden'});
    const file=path.resolve(publicRoot,rel);
    if(!file.startsWith(publicRoot+path.sep))return response(res,403,{error:'Forbidden'});
    let body;try{body=await fs.readFile(file);}catch(e){if(e.code==='ENOENT')return response(res,404,{error:'Not found'});throw e;}
    if(rel==='index.html')body=body.toString('utf8').replace('{{BCI_RELEASE}}',release);
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
