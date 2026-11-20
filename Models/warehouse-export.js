import {createHash,randomUUID} from 'node:crypto';
import {stockProjection} from './stock-demand.js';
import {serviceCategories} from './pricing.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const digest=/^[0-9a-f]{64}$/;
const formats={export:'bci-warehouse-export-v1',patch:'bci-warehouse-patch-v1'};
const maxPatchItems=200;
const internalPatchHistory='warehousePatchReceipts';
const limits={name:250,description:1500,system:120,partType:120,color:100};
const editable=Object.keys(limits);
const topFields=['id','sku','type','group','name','description','unit','manufacturer','manufacturerPartNumber',
 'warehouseArchived','warehouseArchiveBatch','needsPricing','needsUnitCost','needsUnitReview','packageLengthFt','warehouseUnitCostOverride','price','changePrice'];
const metadataFields=['brand','mpn','name','system','partType','spec','grade','tradeSize','length','lengthUnit','ports','packQty',
 'catalogUnit','family','color','shielding','addedInRound','documentedFit','workType','installMethod','finishCode',
 'monitoringOption','photoStatus','photoId'];
const fitsFields=['brand','mpn','part','fits','relationship','limit'];
const own=(object,key)=>Object.hasOwn(object,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exactKeys=(obj,keys)=>Object.keys(obj).every(key=>keys.includes(key));
const simple=(value,fields)=>Object.fromEntries(fields.flatMap(field=>{
 const entry=value?.[field];
 return (entry===null||['string','boolean'].includes(typeof entry)||typeof entry==='number'&&Number.isFinite(entry))?[[field,entry]]:[];
}));
const publicUrl=value=>{
 if(typeof value!=='string')return;
 try {
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return;
  // Only export provenance, not tracking or potential authorization query strings.
  url.search='';url.hash='';
  return url.href;
 } catch {}
};
function catalogMetadata(info){
 const result=simple(info,metadataFields);
 for(const key of ['sourceUrl','photoEvidencePage','originalPhotoUrl']){
  const source=publicUrl(info?.[key]);
  if(source)result[key]=source;
 }
 if(Array.isArray(info?.fitReferences))result.fitReferences=info.fitReferences.map(ref=>({
  ...simple(ref,fitsFields),sourceUrl:publicUrl(ref?.sourceUrl),
 }));
 return result;
}
const getField=(item,key)=>(['name','description'].includes(key)?item[key]:item.catalogInfo?.[key])??'';
const metadataRevision=item=>hash([item.id,item.sku,item.type,item.manufacturer??null,item.manufacturerPartNumber??null,
 item.catalogInfo?.brand??null,item.catalogInfo?.mpn??null,...editable.map(key=>getField(item,key))]);
export function exportWarehouse(state,{release,finance=false,now=new Date()}){
 const stock=new Map();
 for(const row of stockProjection(state)){
  const existing=stock.get(row.catalogId)||[];
  existing.push({location:row.location,quantity:row.quantity,reserved:row.reserved,projected:row.projected});
  stock.set(row.catalogId,existing);
 }
 const items=state.catalog.map(item=>{
  const result={...simple(item,topFields),revision:metadataRevision(item),stock:stock.get(item.id)||[]};
  if(item.catalogInfo)result.catalogInfo=catalogMetadata(item.catalogInfo);
  if(item.serviceRates)result.serviceRates=simple(item.serviceRates,serviceCategories);
  if(finance&&own(item,'cost')&&(item.cost==null||Number.isFinite(item.cost)))result.cost=item.cost;
  return result;
 });
 return {format:formats.export,release,exportedAt:now.toISOString(),items};
}
function cleanPatch(patch){
 if(!object(patch)||!exactKeys(patch,['format','items'])||patch.format!==formats.patch||!Array.isArray(patch.items)||
    !patch.items.length||patch.items.length>maxPatchItems)
  throw Error('Choose a Warehouse metadata patch with 1–'+maxPatchItems+' rows (not a complete Warehouse snapshot).');
 return patch.items.map((row,i)=>{
  if(!object(row)||!exactKeys(row,['id','sku','revision','changes'])||
     typeof row.id!=='string'||!row.id||row.id.length>160||typeof row.sku!=='string'||!row.sku||row.sku.length>160||
     typeof row.revision!=='string'||!digest.test(row.revision)||!object(row.changes)||
     !Object.keys(row.changes).length||!exactKeys(row.changes,editable))
   throw Error('Invalid fields, ID, SKU or revision in patch row '+(i+1)+'.');
  const changes={};
  for(const key of editable)if(own(row.changes,key)){
   const value=row.changes[key];
   if(typeof value!=='string'||value.length>limits[key]||/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)||key==='name'&&!value.trim())
    throw Error('Invalid '+key+' in patch row '+(i+1)+'.');
   changes[key]=value.trim();
  }
  return {id:row.id,sku:row.sku,revision:row.revision,changes};
 });
}
function patchPlan(state,patch){
 const index=new Map(),duplicateItems=new Set();
 for(const item of state.catalog){
  if(index.has(item.id))duplicateItems.add(item.id);
  else index.set(item.id,item);
 }
 const counts=new Map();
 for(const {id} of patch)counts.set(id,(counts.get(id)||0)+1);
 const update=[], unchanged=[], conflicts=[];
 for(const row of patch){
  const {id,sku,revision,changes}=row;
  const target=index.get(id);
  const conflict=reason=>conflicts.push({id,sku,reason});
  if(counts.get(id)!==1){conflict('Duplicate item ID. Merge the edits into one row.');continue;}
  if(duplicateItems.has(id)){conflict('Multiple saved catalog rows have this item ID. Review the catalog before editing.');continue;}
  if(!target){conflict('Item ID no longer exists. No item will be created.');continue;}
  if(target.sku!==sku){conflict('SKU does not match the current item. Export again.');continue;}
  if(target.type!=='material'){conflict('Only material metadata can be updated in this tool.');continue;}
  if(target.warehouseArchived===true){conflict('Archived material metadata is read-only.');continue;}
  if(metadataRevision(target)!==revision){conflict('Metadata changed since export. Export again before editing this row.');continue;}
  const fields=editable.filter(key=>own(changes,key)&&changes[key]!==getField(target,key));
  if(!fields.length){unchanged.push({id,sku});continue;}
  update.push({target,id,sku,fields,changes});
 }
 const fingerprint=hash([formats.patch,patch,conflicts,update.map(({id,sku,fields})=>({id,sku,fields})),unchanged]);
 const summary={total:patch.length,updated:update.length,unchanged:unchanged.length,conflicts,
  changes:update.map(({id,sku,fields})=>({id,sku,fields})),fingerprint};
 return {update,summary};
}
export function previewWarehousePatch(state,data){
 const {summary,update}=patchPlan(state,cleanPatch(data.patch));
 return {...summary,changes:update.map(({id,sku,fields,changes,target})=>({id,sku,fields,
  details:Object.fromEntries(fields.map(field=>[field,{before:String(getField(target,field)),after:changes[field]}]))}))};
}
export function applyWarehousePatch(state,data,actor){
 if(actor.role!=='admin')throw Error('Admin access required');
 const patch=cleanPatch(data.patch), patchHash=hash(patch);
 const repeat=(state[internalPatchHistory]||[]).find(row=>row.fingerprint===data.fingerprint&&row.patchHash===patchHash&&row.actor===actor.email);
 if(repeat)return {...repeat.result,existing:true};
 const {update,summary}=patchPlan(state,patch);
 if(summary.conflicts.length)throw Error('Warehouse metadata conflicts found. Export again and preview a corrected patch. No changes were applied.');
 if(typeof data.fingerprint!=='string'||!digest.test(data.fingerprint)||data.fingerprint!==summary.fingerprint)
  throw Error('Preview the exact Warehouse patch before applying it.');
 const now=new Date().toISOString();
 for(const row of update)for(const field of row.fields){
  const value=row.changes[field];
  if(field==='name'||field==='description')row.target[field]=value;
  else (row.target.catalogInfo??={})[field]=value;
 }
 if(update.length){
  (state.events??=[]).unshift({id:randomUUID(),at:now,actor:actor.email,action:'warehouse.patchApply',
   reference:'catalog',detail:'Updated descriptive metadata on '+update.length+' existing material items. Patch '+summary.fingerprint});
  const previous=state[internalPatchHistory]||[];
  state[internalPatchHistory]=[{fingerprint:summary.fingerprint,patchHash,actor:actor.email,result:summary},...previous].slice(0,12);
 }
 return summary;
}
