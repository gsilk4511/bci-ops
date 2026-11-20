import {createHash, randomUUID} from 'node:crypto';

const BATCH='manufacturer-import-nov20-2026';
const COUNT=3843;
const normalize=s=>String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const own=(obj,key)=>Object.hasOwn(obj,key);
const brand=row=>normalize(row.catalogInfo?.brand||row.manufacturer||row.brand);
const mpn=row=>normalize(row.catalogInfo?.mpn||row.manufacturerPartNumber||row.mpn);
const positiveOrUnclear=v=>v!=null&&!(typeof v==='number'&&v===0);
const defaultPrices=new Set(['price','changePrice','cost']);
const archiveFlags=row=>Object.keys(row).filter(k=>/^warehouseArchiv/i.test(k)).sort().map(k=>[k,row[k]]);
function validateManifest(manifest){
 if(manifest?.batch!==BATCH||!Array.isArray(manifest.items)||manifest.items.length!==COUNT)
  throw Error('Unexpected protected manufacturer manifest.');
 const seen=new Set();
 for(const row of manifest.items){
  if(!/^mfr_[a-f0-9-]{36}$/.test(row?.id)||seen.has(row.id)||
   ![row.sku,row.brand,row.mpn].every(x=>typeof x==='string'&&x.trim())||
   row.brand!==normalize(row.brand)||row.mpn!==normalize(row.mpn))throw Error('Invalid manufacturer manifest entry.');
  seen.add(row.id);
 }
}
function collect(state,manifest){
 if(!state||!Array.isArray(state.catalog)||!Array.isArray(state.inventory))throw Error('Unexpected Warehouse state.');
 validateManifest(manifest);
 const ids=new Set(manifest.items.map(e=>e.id));
 const rows=new Map();
 for(const row of state.catalog){
  if(!ids.has(row?.id))continue;
  if(rows.has(row.id))throw Error('Duplicate manufacturer catalog ID.');
  rows.set(row.id,row);
 }
 const skuIDs=new Map();
 for(const e of manifest.items){
  const text=normalize(e.sku);
  if(!skuIDs.has(text))skuIDs.set(text,new Set());
  skuIDs.get(text).add(e.id);
 }
 const idPattern=/mfr_[a-f0-9-]{36}/ig;
 const ref=new Map();
 const hit=(id,reason)=>{
  if(!ref.has(id))ref.set(id,new Set());
  ref.get(id).add(reason);
 };
 const scan=(s,reason,allowSku=false)=>{
  if(typeof s!=='string')return;
  if(/mfr_/i.test(s)){
   for(const m of s.matchAll(idPattern)){
    const id=m[0].toLowerCase();
    if(ids.has(id))hit(id,reason);
   }
  }
  if(allowSku&&s.length<=256)
   for(const id of skuIDs.get(normalize(s))||[])hit(id,reason);
 };
 const skuField=/^(sku|catalogSku|catalogItemSku|manufacturerSku|materialSku|partSku|mpn|manufacturerPartNumber)$/i;
 const skuMap=/^(rates|prices|retailPrices|catalogPrices|rateBySku|priceBySku|bySku|stockBySku|skuMap|itemsBySku|partsBySku)$/i;
 const scanTree=(obj,reason,rootKey)=>{
  const pending=[[obj,rootKey,false]];
  while(pending.length){
   const [value,field,keysAreSkus]=pending.pop();
   if(value&&typeof value==='object'){
    if(Array.isArray(value)){for(const child of value)pending.push([child,field,keysAreSkus]);}
    else for(const [k,v] of Object.entries(value)){
     scan(k,reason,keysAreSkus);
     pending.push([v,k,skuMap.test(k)]);
    }
   }else scan(value,reason,skuField.test(field));
  }
 };
 for(const [k,v] of Object.entries(state)){
  if(k==='catalog')continue;
  const reason=k==='inventory'?'stock-row':/pric/i.test(k)?'pricing-reference':'historical-or-live-reference';
  scan(k,reason);scanTree(v,reason,k);
 }
 // Preserve explicit current catalog relations without matching repeated product names or manufacturer metadata.
 const relation=/^(catalogId|catalogItemId|materialId|partId|catalogSku|materialSku|partSku|packageOf|componentOf|baseItemId|parentItemId)$/i;
 for(const row of state.catalog){
  const pending=[row];
  while(pending.length){
   const o=pending.pop();
   if(!o||typeof o!=='object')continue;
   for(const [k,v] of Object.entries(o)){
    if(relation.test(k)&&typeof v==='string')scan(v,'catalog-reference',/sku$/i.test(k));
    else if(v&&typeof v==='object'&&k!=='catalogInfo')pending.push(v);
   }
  }
 }
 const details=[],eligible=[],reasonCounts={};let protectedCount=0,missing=0,mismatched=0;
 for(const e of manifest.items){
  const row=rows.get(e.id), reasons=new Set();
  if(!row){missing++;reasons.add('missing-id');}
  else if(row.type!=='material'||row.sku!==e.sku||brand(row)!==e.brand||mpn(row)!==e.mpn){
   mismatched++;reasons.add('identity-mismatch');
  }else{
   for(const reason of ref.get(e.id)||[])reasons.add(reason);
   if([...defaultPrices].some(k=>positiveOrUnclear(row[k]))||
      row.needsPricing===false||row.needsUnitCost===false||row.serviceRates!=null||row.warehouseUnitCostOverride!=null)
    reasons.add('catalog-pricing');
   if(row.warehouseArchiveBatch!=null&&row.warehouseArchiveBatch!==BATCH||
      row.warehouseArchived===true&&row.warehouseArchiveBatch!==BATCH||
      row.warehouseArchived!=null&&typeof row.warehouseArchived!=='boolean'||
      archiveFlags(row).some(([k])=>!['warehouseArchived','warehouseArchiveBatch','warehouseArchiveBatchPreviousArchived'].includes(k))||
      own(row,'warehouseArchiveBatchPreviousArchived')&&row.warehouseArchiveBatch!==BATCH)
    reasons.add('other-archive-state');
   if(reasons.size)protectedCount++;
   else eligible.push(e.id);
  }
  for(const reason of reasons)reasonCounts[reason]=(reasonCounts[reason]||0)+1;
  details.push([e.id,e.sku,e.brand,e.mpn,[...reasons].sort(),row?archiveFlags(row):null,
   row?[row.type,row.sku,brand(row),mpn(row),row.price,row.changePrice,row.cost,row.needsPricing,
     row.serviceRates,row.warehouseUnitCostOverride,row.needsUnitCost]:null]);
 }
 const fingerprint=createHash('sha256').update(JSON.stringify([BATCH,details])).digest('hex');
 return {eligibleIds:eligible,summary:{batch:BATCH,manifestCount:COUNT,eligible:eligible.length,
   protected:protectedCount,missing,drift:missing+mismatched,mismatched,reasonCounts,fingerprint}};
}
export function previewWarehousePurge(state,manifest){
 return collect(state,manifest).summary;
}
export function applyWarehousePurge(state,manifest,actor,request){
 if(actor?.role!=='admin')throw Error('Admin access required for permanent Warehouse purge.');
 if(!request||Object.keys(request).sort().join(',')!=='backupConfirmed,confirmation,fingerprint'||
  request.backupConfirmed!==true)throw Error('A verified database backup and completed confirmation are required.');
 const {eligibleIds,summary}=collect(state,manifest);
 if(summary.drift)throw Error('Manufacturer manifest identity drift detected. No Warehouse rows deleted.');
 if(request.fingerprint!==summary.fingerprint)throw Error('Warehouse purge preview is stale. Run a fresh preview.');
 if(!summary.eligible)throw Error('No manufacturer records are eligible for purge.');
 if(request.confirmation!==`DELETE ${summary.eligible}`)throw Error('Typed purge confirmation does not match preview.');
 if(state.events!=null&&!Array.isArray(state.events))throw Error('Unexpected audit event state.');
 const purgeSet=new Set(eligibleIds);
 const audit={id:randomUUID(),at:new Date().toISOString(),action:'warehouse.manufacturer-purge',reference:BATCH,
  detail:JSON.stringify({batch:BATCH,deleted:summary.eligible,protected:summary.protected}),
  actor:actor.email??actor.id??'admin'};
 state.catalog=state.catalog.filter(row=>!purgeSet.has(row.id));
 (state.events??=[]).unshift(audit);
 return {...summary,deleted:summary.eligible,audit};
}
