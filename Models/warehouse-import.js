import {createHash,randomUUID} from 'node:crypto';

export const warehouseImportFormat='bci-warehouse-updates-v2';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const key=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const obj=x=>!!x&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(x,allowed)=>obj(x)&&Object.keys(x).every(k=>allowed.includes(k));
const own=(x,k)=>Object.hasOwn(x,k);
const fail=message=>{throw Error(message);};
const txt=(v,n)=>typeof v==='string'&&v.trim()&&v.length<=n&&!/[\x00-\x1f\x7f]/.test(v)?v.trim():fail('Invalid Warehouse text field.');
const amt=(v,whole=false)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e6&&(whole?Number.isInteger(v):Math.abs(v*100-Math.round(v*100))<1e-7)?v:fail('Invalid Warehouse amount.');
const revision=/^[a-f0-9]{64}$/;
const units=['each','ft','box','package','reel'];
const fields={name:250,system:120,serviceCategory:120,brand:100,partType:120,color:100};
const get=(item,k)=>['name','price','cost','changePrice','unit','stockTarget'].includes(k)?item[k]??null:item.catalogInfo?.[k]??null;
const normalizedSku=v=>txt(v,80);
const changesFor=(x,adding)=>{
 const allowed=[...Object.keys(fields),'price','cost','changePrice','stockTarget',...(adding?['unit']:[])];
 if(!keys(x,allowed)||!Object.keys(x).length)fail('Invalid catalog fields. Live counts and existing billing units cannot be imported.');
 const c={};
 for(const k of Object.keys(fields))if(own(x,k))c[k]=txt(x[k],fields[k]);
 for(const k of ['price','cost','changePrice','stockTarget'])if(own(x,k))c[k]=amt(x[k],k==='stockTarget');
 if(adding){
  if(!c.name||!c.system||!c.partType||!units.includes(x.unit))fail('New parts need a name, category, type and supported billing unit.');
  c.unit=x.unit;
 }
 return c;
};
function normalize(p){
 if(!keys(p,['format','items','stockGroups','holds'])||p.format!==warehouseImportFormat||
    !Array.isArray(p.items)||p.items.length>1000||!Array.isArray(p.stockGroups)||p.stockGroups.length>100||
    !Array.isArray(p.holds)||p.holds.length>500||(!p.items.length&&!p.stockGroups.length))fail('Invalid Warehouse updates file.');
 return {
  items:p.items.map(r=>{
   if(!keys(r,['sku','id','revision','expectedPrice','expected','changes']))fail('Invalid Warehouse update row.');
   const adding=!own(r,'id'), sku=normalizedSku(r.sku), changes=changesFor(r.changes,adding);
   if(adding){
    if(own(r,'revision')||own(r,'expectedPrice')||own(r,'expected'))fail('New rows cannot set expected existing values.');
    return {sku,changes};
   }
   if(typeof r.revision!=='string'||!revision.test(r.revision))fail('Existing updates need a Warehouse export revision.');
   if(own(r,'expected')&&!keys(r.expected,amountFields))fail('Invalid expected Warehouse amounts.');
   const expected={...r.expected};
   if(own(r,'expectedPrice')){
    if(own(expected,'price'))fail('Duplicate expected sell-price field.');
    expected.price=r.expectedPrice;
   }
   for(const k of amountFields){
    if(own(changes,k)!==own(expected,k))fail('Existing rate, cost and stock target changes must include the previous value.');
    if(own(expected,k)&&expected[k]!==null)expected[k]=amt(expected[k],k==='stockTarget');
   }
   return {id:txt(r.id,160),sku,revision:r.revision,expected,changes};
  }),
  stockGroups:p.stockGroups.map(r=>{
   if(!keys(r,['id','label','target','skus'])||!Array.isArray(r.skus)||!r.skus.length||r.skus.length>100)fail('Invalid shared stock target.');
   const id=txt(r.id,80);
   if(!/^[a-z0-9-]+$/.test(id))fail('Invalid shared target ID.');
   return {id,label:txt(r.label,140),target:amt(r.target,true),skus:r.skus.map(normalizedSku).sort()};
  }),
  holds:p.holds.map(r=>{
   if(!keys(r,['sku','reason']))fail('Invalid held row.');
   return {sku:normalizedSku(r.sku),reason:txt(r.reason,240)};
  })
 };
}
const reverse=(items,selector)=>{
 const m=new Map();
 for(const item of items){const k=selector(item);if(k)m.set(k,[...(m.get(k)||[]),item]);}
 return m;
};
const amountFields=['price','cost','changePrice','stockTarget'];
function setFields(target,fields){
 for(const [k,v] of Object.entries(fields)){
  if(k==='name'||k==='unit'||amountFields.includes(k))target[k]=v;
  else (target.catalogInfo??={})[k]=v;
 }
 if(own(fields,'price'))target.needsPricing=fields.price<=0;
 if(own(fields,'cost')){target.needsUnitCost=false;target.warehouseUnitCostOverride=true;}
 return target;
}
export function planWarehouseImport(state,input,metadataRevision){
 const p=normalize(input);
 const bySku=reverse(state.catalog,r=>key(r.sku)), byId=reverse(state.catalog,r=>r.id), byName=reverse(state.catalog,r=>key(r.name));
 const skus=reverse(p.items,r=>key(r.sku)), names=reverse(p.items,r=>key(r.changes.name));
 const conflicts=[], creates=[], updates=[], unchanged=[], held=p.holds;
 const conflict=(sku,reason)=>conflicts.push({sku,reason});
 const projected=new Map();
 for(const [sku,matches] of bySku)if(matches.length===1)projected.set(sku,matches[0]);
 for(const row of p.items){
  const k=key(row.sku), matches=bySku.get(k)||[], c=row.changes;
  if(skus.get(k).length!==1||matches.length>1){conflict(row.sku,'SKU is duplicated.');continue;}
  if(c.name&&(names.get(key(c.name)).length>1||(byName.get(key(c.name))||[]).some(r=>r!==matches[0]))){
   conflict(row.sku,'The proposed name is already in use by another item.');continue;
  }
  const target=matches[0];
  if(row.id){
   if(!target||target.id!==row.id||target.sku!==row.sku||byId.get(row.id)?.length!==1||target.type!=='material'||target.warehouseArchived===true){
    conflict(row.sku,'Active material ID and SKU no longer match.');continue;
   }
   const diff=Object.keys(c).filter(field=>get(target,field)!==c[field]);
   if(!diff.length){unchanged.push({sku:row.sku});continue;}
   if(metadataRevision(target)!==row.revision||amountFields.some(k=>own(c,k)&&get(target,k)!==row.expected[k]&&get(target,k)!==c[k])){
    conflict(row.sku,'Existing record changed since the export. Refresh the review file.');continue;
   }
   const details=Object.fromEntries(diff.map(k=>[k,{before:get(target,k),after:c[k]}]));
   const fields=Object.fromEntries(diff.map(k=>[k,c[k]]));
   updates.push({target,fields,view:{id:target.id,sku:row.sku,fields:diff,details}});
   projected.set(k,setFields(structuredClone(target),fields));
  }else{
   if(target){
    if(target.warehouseImportV2===true&&target.type==='material'&&target.warehouseArchived!==true&&Object.keys(c).every(f=>get(target,f)===c[f])){
     unchanged.push({sku:row.sku});continue;
    }
    conflict(row.sku,'SKU already exists with different data or was created outside this import.');continue;
   }
   if((state.trash||[]).some(r=>r.kind==='catalog'&&key(r.record?.sku)===k)){
    conflict(row.sku,'SKU belongs to a record in Trash.');continue;
   }
   const value=setFields({sku:row.sku,type:'material',group:c.system,price:0,changePrice:null,cost:0,
    needsPricing:true,needsUnitCost:true,warehouseImportV2:true},c);
   creates.push(value);projected.set(k,value);
  }
 }
 const storedGroups=state.warehouseStockGroups||[];
 const groups=new Map(storedGroups.map(g=>[g.id,g])), requested=new Set(), members=new Set();
 for(const g of p.stockGroups){
  if(requested.has(g.id)){conflict(g.id,'Duplicate shared stock target.');continue;}
  requested.add(g.id);groups.set(g.id,g);
 }
 for(const g of groups.values())for(const sku of g.skus){
  const k=key(sku), item=projected.get(k);
  if(members.has(k)||!item||item.type!=='material'||item.warehouseArchived===true||item.unit!=='each'||item.stockTarget!=null){
   if(requested.has(g.id)||p.items.some(row=>key(row.sku)===k)||members.has(k))conflict(g.id,'Shared stock target has an invalid, duplicate or individually stocked member: '+sku);
  }
  members.add(k);
 }
 const groupUpdates=p.stockGroups.filter(g=>hash(storedGroups.find(old=>old.id===g.id)??null)!==hash(g));
 const summary={total:p.items.length,added:creates.length,updated:updates.length,unchanged:unchanged.length,
  groupsUpdated:groupUpdates.length,conflicts,held,changes:updates.map(x=>x.view),
  newItems:creates.map(r=>({sku:r.sku,name:r.name,unit:r.unit,price:r.needsPricing?null:r.price,cost:r.needsUnitCost?null:r.cost,changePrice:r.changePrice,stockTarget:r.stockTarget??null,info:r.catalogInfo})),
  stockGroups:groupUpdates.map(g=>({...g,before:storedGroups.find(old=>old.id===g.id)?.target??null}))};
 summary.fingerprint=hash([warehouseImportFormat,p,summary,storedGroups]);
 return {summary,creates,updates,groupUpdates,groups};
}
export function applyWarehouseImport(state,data,actor,metadataRevision){
 if(actor?.role!=='admin')fail('Admin access required.');
 const plan=planWarehouseImport(state,data.patch,metadataRevision);
 const {summary}=plan;
 if(summary.conflicts.length)fail('Warehouse import conflicts. No changes were applied.');
 if(data.fingerprint!==summary.fingerprint)fail('Preview this exact Warehouse update again before applying.');
 for(const {target,fields} of plan.updates)setFields(target,fields);
 for(const item of plan.creates)state.catalog.push({id:'cat_'+randomUUID(),...item});
 if(plan.groupUpdates.length)state.warehouseStockGroups=[...plan.groups.values()];
 return summary;
}
