import {createHash,randomUUID} from 'node:crypto';

export const catalogPhotoHash=/^[a-f0-9]{64}$/;
const format='bci-catalog-pack-v1';
const maxRows=10000;
const strings={brand:100,mpn:150,name:250,system:120,partType:120,spec:1500,grade:120,tradeSize:120,lengthUnit:40,catalogUnit:50,family:200,color:100,shielding:100,addedInRound:100,documentedFit:1800,workType:150,installMethod:150,finishCode:100,monitoringOption:150,photoStatus:30,photoId:64};
const urls=['sourceUrl','photoEvidencePage','originalPhotoUrl'];
const flexible={length:80,ports:80,packQty:80};
const allowed=new Set([...Object.keys(strings),...urls,...Object.keys(flexible)]);
const refs={brand:100,mpn:150,part:300,fits:1200,relationship:400,limit:1200,sourceUrl:1500};
const photoStatuses=new Set(['Exact','Family','Not matched yet','Needs better source']);
const required=['brand','mpn','name','system','partType'];
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const text=(v,max,label)=>{
 if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(v))throw Error('Invalid '+label);
 return v.trim();
};
const url=(s,label)=>{
 const value=text(s,1500,label);
 if(!value)return '';
 let parsed;
 try{parsed=new URL(value);}catch{throw Error('Invalid '+label);}
 if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Invalid '+label);
 return value;
};
const key=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const partKey=(brand,mpn)=>key(brand)+'\0'+key(mpn);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function normalizeRow(row,position){
 if(!object(row)||Object.keys(row).some(field=>!allowed.has(field)))throw Error('Invalid catalog item fields at row '+position);
 const out={};
 for(const [field,limit] of Object.entries(strings))if(own(row,field)&&row[field]!=null){
  const value=field==='addedInRound'&&Number.isFinite(row[field])?String(row[field]):row[field];
  out[field]=text(value,limit,field+' at row '+position);
 }
 for(const [field,limit] of Object.entries(flexible))if(own(row,field)&&row[field]!=null){
  if(typeof row[field]==='number'){
   if(!Number.isFinite(row[field])||row[field]<0||row[field]>1e9)throw Error('Invalid '+field+' at row '+position);
   out[field]=row[field];
  }else out[field]=text(row[field],limit,field+' at row '+position);
 }
 for(const field of urls)if(own(row,field)&&row[field]!=null)out[field]=url(row[field],field+' at row '+position);
 for(const field of required)if(!out[field])throw Error('Missing '+field+' at row '+position);
 if(out.photoStatus&&!photoStatuses.has(out.photoStatus))throw Error('Unknown photo status at row '+position);
 if(out.photoId&&(!catalogPhotoHash.test(out.photoId)||!['Exact','Family'].includes(out.photoStatus)))throw Error('Invalid verified photo at row '+position);
 if(['Exact','Family'].includes(out.photoStatus)&&!out.photoId)throw Error('Photo status requires a bundled photo ID at row '+position);
 return out;
}
function normalizeFit(row,position){
 if(!object(row)||Object.keys(row).some(field=>!own(refs,field)))throw Error('Invalid fit reference fields at row '+position);
 const out={};
 for(const [field,limit] of Object.entries(refs))if(own(row,field)&&row[field]!=null){
  out[field]=field==='sourceUrl'?url(row[field],field+' in fit reference '+position):text(row[field],limit,field+' in fit reference '+position);
 }
 if(!out.part||!out.fits||Boolean(out.brand)!==Boolean(out.mpn))throw Error('Fit reference '+position+' requires a part and fit target, plus both brand and MPN if known');
 return out;
}
function normalizePack(pack){
 if(!object(pack)||Object.keys(pack).some(field=>!['format','items','fitReferences'].includes(field))||pack.format!==format||!Array.isArray(pack.items)||!pack.items.length||pack.items.length>maxRows||
  !Array.isArray(pack.fitReferences)||pack.fitReferences.length>maxRows)throw Error('Choose a supported manufacturer catalog pack with 1–'+maxRows+' items');
 return {items:pack.items.map((row,i)=>normalizeRow(row,i+1)),fits:pack.fitReferences.map((row,i)=>normalizeFit(row,i+1))};
}
function indexBy(values,get){
 const out=new Map();
 for(const value of values){
  const k=get(value);if(!k)continue;
  const list=out.get(k)||[];list.push(value);out.set(k,list);
 }
 return out;
}
function existingIdentity(item){
 const brand=item.catalogInfo?.brand||item.manufacturer,mpn=item.catalogInfo?.mpn||item.manufacturerPartNumber;
 return brand&&mpn?partKey(brand,mpn):'';
}
const missing=v=>v==null||v==='';
function metadataFor(row,fitRows,previous={}){
 const out={...previous};
 for(const [field,value] of Object.entries(row)){
  if(field.startsWith('photo')||field==='originalPhotoUrl')continue;
  if(missing(out[field])&&!missing(value))out[field]=value;
 }
 // Preserve verified photo/label pairs. Upgrade an incomplete or nonverified existing
 // metadata record as one unit so a Family image cannot be labeled Exact.
 const oldVerified=catalogPhotoHash.test(previous.photoId||'')&&['Exact','Family'].includes(previous.photoStatus);
 if(!oldVerified){
  if(row.photoId){
   for(const field of ['photoId','photoStatus','photoEvidencePage','originalPhotoUrl'])if(!missing(row[field]))out[field]=row[field];
  }else if(!out.photoStatus&&!missing(row.photoStatus))out.photoStatus=row.photoStatus;
 }
 const old=Array.isArray(previous.fitReferences)?previous.fitReferences:[];
 const dedup=new Map(old.map(f=>[hash(f),f]));
 for(const f of fitRows)dedup.set(hash(f),f);
 if(dedup.size>200)throw Error('Too many fit references for one part');
 if(dedup.size)out.fitReferences=[...dedup.values()];
 return out;
}
function packageLength(row){
 const units=key(row.lengthUnit);
 return ['FT','FEET','FOOT'].includes(units)&&Number.isSafeInteger(Number(row.length))&&Number(row.length)>0?Number(row.length):null;
}

export function planCatalogPack(state,pack,availablePhotos){
 const {items,fits}=normalizePack(pack);
 const input=indexBy(items,r=>partKey(r.brand,r.mpn));
 const indexed=indexBy(state.catalog,existingIdentity), sku=indexBy(state.catalog,item=>key(item.sku));
 const fitByPart=indexBy(fits,f=>f.brand&&f.mpn?partKey(f.brand,f.mpn):'');
 const assignedFits=new Set(), conflicts=[], pending=[], updates=[], unchanged=[], touched=[];
 const reservedSku=new Set(sku.keys());
 for(const [part,rows] of input){
  const [row]=rows, matches=indexed.get(part)||[];
  const conflict=reason=>conflicts.push({brand:row.brand,mpn:row.mpn,reason,count:rows.length});
  if(rows.length!==1){conflict('Duplicate manufacturer and part number in this pack');continue;}
  const normalizedMpn=key(row.mpn);
  if(availablePhotos&&row.photoId&&!availablePhotos.has(row.photoId)){conflict('The verified photo is not present in this release');continue;}
  if(matches.length>1){conflict('Multiple existing items have this manufacturer and part number');continue;}
  if(matches.length===1&&matches[0].type!=='material'){conflict('Existing exact identity is not a material item');continue;}
  if(!matches.length&&(sku.get(normalizedMpn)||[]).some(item=>!existingIdentity(item))){conflict('Legacy item uses this SKU without verified manufacturer identity; review it before import');continue;}
  const fitRows=fitByPart.get(part)||[];
  for(const fit of fitRows)assignedFits.add(hash(fit));
  const target=matches[0];
  if(target){
   const info=metadataFor(row,fitRows,target.catalogInfo);
   touched.push([target.id,target.catalogInfo??null,target.manufacturer??null,target.manufacturerPartNumber??null]);
   if(hash(target.catalogInfo??{})===hash(info))unchanged.push(target.id);
   else updates.push({id:target.id,info});
  }else{
   let newSku=row.mpn.toUpperCase();
   if(reservedSku.has(key(newSku)))newSku='BCI-MFR-'+hash(part).slice(0,24).toUpperCase();
   if(reservedSku.has(key(newSku))){conflict('Generated manufacturer SKU is already in use');continue;}
   reservedSku.add(key(newSku));
   pending.push({type:'material',group:row.brand,name:row.name,sku:newSku,unit:row.catalogUnit||'each',
    manufacturer:row.brand,manufacturerPartNumber:row.mpn,description:row.spec||'',
    packageLengthFt:packageLength(row),price:0,changePrice:0,cost:0,needsPricing:true,needsUnitReview:!row.catalogUnit,catalogInfo:metadataFor(row,fitRows)});
  }
 }
 const other=new Map((state.catalogFitReferences||[]).map(f=>[hash(f),f]));
 for(const fit of fits)if(!assignedFits.has(hash(fit))&&!(fit.brand&&input.has(partKey(fit.brand,fit.mpn))))other.set(hash(fit),fit);
 if(other.size>maxRows)throw Error('Too many general fit references');
 const otherFits=[...other.values()];
 const summary={fingerprint:hash([items,fits,touched,pending,updates,unchanged,conflicts,otherFits]),
  total:items.length,new:pending.length,matched:updates.length+unchanged.length,updated:updates.length,unchanged:unchanged.length,
  skipped:conflicts.reduce((n,c)=>n+c.count,0),
  conflicts,examples:pending.slice(0,8).map(row=>row.name),photoCount:items.filter(row=>row.photoId).length,fitReferenceCount:fits.length};
 return {summary,pending,updates,otherFits};
}

export function importCatalogPack(state,data,actor,availablePhotos){
 if(actor?.role!=='admin')throw Error('Admin access required');
 const plan=planCatalogPack(state,data.pack,availablePhotos);
 if(typeof data.fingerprint!=='string'||data.fingerprint!==plan.summary.fingerprint)throw Error('Catalog or pack changed. Preview the import again');
 if(plan.summary.conflicts.length&&data.skipConflicts!==true)throw Error('Resolve or explicitly skip catalog pack conflicts before applying; no items were changed');
 for(const row of plan.pending)state.catalog.push({...row,id:'mfr_'+randomUUID(),createdAt:new Date().toISOString(),createdBy:actor.email});
 for(const update of plan.updates)state.catalog.find(item=>item.id===update.id).catalogInfo=update.info;
 state.catalogFitReferences=plan.otherFits;
 return {...plan.summary};
}
