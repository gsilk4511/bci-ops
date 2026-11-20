import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const BATCH='manufacturer-import-nov20-2026';
const PRIOR='warehouseArchiveBatchPreviousArchived';
const norm=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const terminal=new Set(['invoiced','paid','closed','cancelled','canceled','declined','rejected','void','voided','superseded','expired']);
const isTerminal=record=>terminal.has(String(record?.status??'').trim().toLowerCase());
const list=(state,key)=> {
 if(state[key]===undefined)return [];
 if(!Array.isArray(state[key]))throw Error('Unexpected state collection: '+key);
 return state[key];
};
function collectIds(value, callback){
 if(!value||typeof value!=='object')return;
 for(const [key,child] of Object.entries(value)){
  if(typeof child==='string'&&/^(catalog(Id|ItemId)|materialId|partId|cableId|jackId|plateId|panelId|fiberId|termination[AB]Id)$/i.test(key))callback(child);
  else if(child&&typeof child==='object')collectIds(child,callback);
 }
}
const brand=x=>norm(x.catalogInfo?.brand||x.manufacturer||x.brand);
const mpn=x=>norm(x.catalogInfo?.mpn||x.manufacturerPartNumber||x.mpn);
const nonzero=v=>v!=null&&(typeof v==='number'||typeof v==='string')&&Number(v)!==0;

export function plan(state,manifest,{rollback=false,now=Date.now()}={}){
 if(!state||!Array.isArray(state.catalog)||!Array.isArray(state.inventory)||
    !Array.isArray(state.workorders)||manifest.batch!==BATCH||!Array.isArray(manifest.items))
  throw Error('Unexpected BCI state or manifest shape.');
 const candidates=new Map();
 for(const row of manifest.items){
  if(typeof row.id!=='string'||!row.id.startsWith('mfr_')||candidates.has(row.id)||
     typeof row.sku!=='string'||!row.sku||!row.brand||!row.mpn)
   throw Error('Invalid or repeated archive manifest identity.');
  candidates.set(row.id,row);
 }
 const records=new Map();
 for(const row of state.catalog){
  if(!candidates.has(row.id))continue;
  if(records.has(row.id))throw Error('Duplicate target catalog ID; no rows changed.');
  records.set(row.id,row);
 }
 const blocked=new Map();
 const block=(id,reason)=>{
  if(!candidates.has(id))return;
  if(!blocked.has(id))blocked.set(id,new Set());
  blocked.get(id).add(reason);
 };
 if(!rollback){
  for(const row of state.inventory){
   if(nonzero(row.quantity)||nonzero(row.reserved))
    block(row.catalogId,'nonzero-stock-or-reservation');
  }
  // Real job dependency, including active review and change-order lines.
  for(const row of state.workorders){
   if(!row.invoice&&(!isTerminal(row)||row.closeout&&!row.closeout.reviewedAt))
    collectIds(row,id=>block(id,'nonterminal-work-order'));
  }
  for(const profile of list(state,'pricingProfiles')){
   if(!profile.archived)for(const id of Object.keys(profile.rules||{}))block(id,'active-pricing-profile-rule');
  }
  for(const row of list(state,'materialDrafts')){
   const expires=Number(row.expiresAt);
   if(!Number.isFinite(expires)||expires>now)
    collectIds(row,id=>block(id,'active-material-draft'));
  }
  for(const [key,reason] of [
   ['estimates','nonterminal-estimate'],['tickets','nonterminal-ticket'],
   ['purchaseOrders','nonterminal-purchase-order'],['purchasingOrders','nonterminal-purchasing-order'],
  ]){
   for(const row of list(state,key)){
    if(!isTerminal(row)&&!row.completedAt&&!row.closedAt&&!row.clearedAt)
     collectIds(row,id=>block(id,reason));
   }
  }
 }
 const changes=[],skip={};let missing=0,mismatches=0;
 for(const [id,expected] of candidates){
  const row=records.get(id);
  const omit=(...reasons)=>{skip[id]=reasons;};
  if(!row){missing++;omit('missing-id');continue;}
  if(row.type!=='material'||row.sku!==expected.sku||brand(row)!==expected.brand||mpn(row)!==expected.mpn){
   mismatches++;omit('identity-mismatch');continue;
  }
  if(rollback){
   if(row.warehouseArchiveBatch!==BATCH||row.warehouseArchived!==true){omit('not-marked-by-this-batch');continue;}
   changes.push(row);continue;
  }
  if(row.warehouseArchiveBatch===BATCH&&row.warehouseArchived===true){omit('already-archived-by-this-batch');continue;}
  if(Object.hasOwn(row,'warehouseArchiveBatch')||Object.hasOwn(row,PRIOR)||
     Object.hasOwn(row,'warehouseArchived')&&row.warehouseArchived!==false){
   omit('preexisting-archive-state');continue;
  }
  if([row.price,row.changePrice,row.cost].some(nonzero)||row.warehouseUnitCostOverride===true)
   block(id,'pricing-set-since-import');
  if(blocked.has(id)){omit(...blocked.get(id));continue;}
  changes.push(row);
 }
 return {changes,skip,missing,mismatches};
}

export function mutate(changes,{rollback=false}={}){
 for(const row of changes){
  if(rollback){
   if(row.warehouseArchiveBatch!==BATCH||row.warehouseArchived!==true)
    throw Error('Rollback requires this batch marker and an archived row.');
   if(row[PRIOR]===false)row.warehouseArchived=false;
   else delete row.warehouseArchived;
   delete row.warehouseArchiveBatch;
   delete row[PRIOR];
  }else{
   if(Object.hasOwn(row,'warehouseArchived'))row[PRIOR]=row.warehouseArchived;
   row.warehouseArchived=true;
   row.warehouseArchiveBatch=BATCH;
  }
 }
}

async function main(){
 const args=process.argv.slice(2);
 if(args.includes('--help')){
  console.log('node scripts/archive-manufacturer-import-nov20-2026.js [--rollback] [--apply]');
  return;
 }
 if(args.some(arg=>!['--rollback','--apply'].includes(arg))||new Set(args).size!==args.length)
  throw Error('Unsupported option; use --help.');
 const rollback=args.includes('--rollback'),apply=args.includes('--apply');
 const manifest=JSON.parse(await readFile(new URL('./manufacturer-import-nov20-2026.manifest.json',import.meta.url),'utf8'));
 if(manifest.items?.length!==3843)throw Error('Expected 3,843 manifest identities.');
 for(const key of ['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME'])if(!process.env[key])throw Error('Missing '+key);
 const mariadb=(await import('mariadb')).default;
 const conn=await mariadb.createConnection({
  host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),
  user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,
  connectTimeout:6000,multipleStatements:false,
 });
 try{
  await conn.beginTransaction();
  const rows=await conn.query('SELECT state_json FROM pilot_state WHERE id=1 FOR UPDATE');
  if(rows.length!==1)throw Error('Expected exactly one pilot_state row.');
  const stored=rows[0].state_json;
  const state=typeof stored==='string'||Buffer.isBuffer(stored)?JSON.parse(String(stored)):stored;
  const job=plan(state,manifest,{rollback});
  const exclusions={};
  for(const reasons of Object.values(job.skip))for(const reason of reasons)exclusions[reason]=(exclusions[reason]||0)+1;
  // Abort on identity drift; a preview explains what failed without mutating state.
  const drift=job.missing||job.mismatches;
  if(apply&&!drift&&job.changes.length){
   mutate(job.changes,{rollback});
   const written=await conn.execute('UPDATE pilot_state SET state_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=1',[JSON.stringify(state)]);
   if(written.affectedRows!==1)throw Error('Expected exactly one updated pilot_state row.');
  }
  if(apply&&!drift)await conn.commit();else await conn.rollback();
  console.log(JSON.stringify({batch:BATCH,sourceExportedAt:manifest.sourceExportedAt,mode:rollback?'rollback':'archive',
   applied:Boolean(apply&&!drift),identityDrift:Boolean(drift),checked:manifest.items.length,
   eligible:job.changes.length,exclusions,details:Object.fromEntries(Object.entries(job.skip).filter(([,reasons])=>
    !reasons.includes('already-archived-by-this-batch')&&!reasons.includes('not-marked-by-this-batch')))},null,2));
  if(drift)process.exitCode=2;
 }catch(error){
  try{await conn.rollback();}catch{}
  throw error;
 }finally{await conn.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await main();}catch(error){console.error('No successful migration reported:',error.code||error.message);process.exitCode=1;}
}
