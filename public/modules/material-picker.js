import {partSearch} from './catalog-photos.js';

export const materialShortcuts=[
 ['all','All Parts'],['recent','Recent'],['inStock','In Stock'],['jacks','Jacks'],['bulkCable','Cable'],
 ['faceplates','Faceplates'],['patchCords','Patch Cords'],['supports','Support Hardware'],['racks','Racks'],
 ['fiber','Fiber'],['conduit','Conduit']
];
export const materialCategory=item=>item?.catalogInfo?.system||'Unclassified';
export const materialType=item=>item?.catalogInfo?.partType||'Unclassified';
export const materialBrand=item=>item?.catalogInfo?.brand||item?.manufacturer||'Unspecified brand';
const clean=value=>String(value||'').trim().toLowerCase();
const placeholder=/^(?:unknown|unspecified(?: brand)?|generic|none|not specified|n\s*\/\s*a)$/i;
export function materialHasIdentity(item){
 const info=item.catalogInfo||{};
 const complete=value=>Boolean(clean(value)&&!placeholder.test(clean(value)));
 return complete(info.brand||item.manufacturer)&&complete(info.mpn||item.manufacturerPartNumber);
}
const compact=value=>clean(value).replace(/[^a-z0-9]/g,'');
const compare=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'}).compare;
const day=86_400_000;

export function materialSignals(orders,inventory,{orderId,email,warehouseName,now=Date.now()}){
 const parts=new Map();
 const signal=id=>{
  if(!parts.has(id))parts.set(id,{orders:0,latest:0,mine:0,onOrder:false,onHand:0,hasStockRecord:false});
  return parts.get(id);
 };
 const employee=clean(email);
 for(const order of orders||[]){
  const used=new Set();
  for(const entry of order.entries||[]){
   if(entry.type!=='material'||!entry.catalogId)continue;
   const stats=signal(entry.catalogId),stamp=Date.parse(entry.at||entry.date);
   if(order.id===orderId)stats.onOrder=true;
   if(Number.isFinite(stamp)&&stamp<=now+day&&stamp>=now-day*90){
    stats.latest=Math.max(stats.latest,stamp);
    if(employee&&clean(entry.employeeEmail||entry.createdBy||entry.tech)===employee)stats.mine=Math.max(stats.mine,stamp);
   }
   used.add(entry.catalogId);
  }
  // Count distinct jobs, not duplicated material rows or quantities.
  for(const id of used)signal(id).orders++;
 }
 if(warehouseName)for(const stock of inventory||[]){
  if(stock.location!==warehouseName||!stock.catalogId||!Number.isFinite(stock.quantity))continue;
  const stats=signal(stock.catalogId);
  stats.onHand=Math.round((stats.onHand+stock.quantity)*100)/100;
  stats.hasStockRecord=true;
 }
 return parts;
}
const eachTokens=/^(?:ea\.?|each|pc\.?|piece|unit|single)$/i;
const packs=/\b(?:pack(?:age)?|case|box|bag|carton|bundle|kit|set|pair|bulk)\b/i;
// A placeholder catalog unit and an explicit manufacturer pack are not "each".
export function materialUnitPreference(item){
 const info=item.catalogInfo||{}, actual=clean(item.unit), manufacturer=clean(info.catalogUnit);
 const pack=Number(info.packQty)>1||packs.test(actual)||packs.test(manufacturer)||/\b(\d+)\s*[- ]?\s*(?:pack|pk)\b/i.test(item.name||'');
 if(pack)return 0;
 if(!item.needsUnitReview&&eachTokens.test(actual)&&eachTokens.test(manufacturer))return 2;
 return 1;
}
export function materialUnitLabel(item){
 const unit=String(item.unit||'').trim();
 const manufacturerUnit=String(item.catalogInfo?.catalogUnit||'').trim();
 const packSize=item.catalogInfo?.packQty;
 return [unit?'Unit: '+unit:'Unit not specified',
  manufacturerUnit&&clean(manufacturerUnit)!==clean(unit)?'Mfr unit: '+manufacturerUnit:'',
  packSize!==null&&packSize!==undefined&&String(packSize).trim()?'Pack qty: '+packSize:'',
  item.needsUnitReview?'Verify unit before logging':''].filter(Boolean).join(' · ');
}
function inShortcut(item,key,known){
 if(key==='all')return true;
 if(key==='recent')return Boolean(known?.latest);
 if(key==='inStock')return known?.onHand>0;
 const system=clean(materialCategory(item)),type=clean(materialType(item)),name=clean(item.name);
 const legacy=type==='unclassified';
 const text=legacy?name:type;
 if(key==='jacks')return /\b(?:keystone|jacks?)\b/.test(text)&&!/\b(?:patch cord|panel|tool|plug)\b/.test(text);
 if(key==='bulkCable')return /\b(?:bulk cable|osdp (?:cable|wire))\b/.test(text)||
   (legacy&&/\b(?:cat[- ]?[56]e?a?|osdp|utp|stp)\b.*\bcabl/.test(text)&&!/\b(?:patch|cord|fiber|tester|tool)\b/.test(text));
 if(key==='faceplates')return /\b(?:faceplates?|wall plates?)\b/.test(text)&&!(/\b(?:strike|lock)\b/.test(text)||system==='access control');
 if(key==='patchCords')return /\b(?:patch[- ]?cords?|patch[- ]?cables?)\b/.test(text);
 if(key==='supports')return /\b(?:j[- ]?hooks?|ladder runway|runway accessor(?:y|ies)|cable supports?|cable tray|cable managers?|mounting hardware)\b/.test(text);
 if(key==='racks')return /\b(?:rack|racks|server cabinet)\b/.test(text);
 if(key==='fiber')return system==='fiber'||system==='outside plant'&&/\bfiber\b/.test(text)||
  legacy&&/\b(?:fiber|fibre|pigtails?|otdr)\b/.test(text);
 if(key==='conduit')return system==='conduit & fittings'||/\b(?:conduit|innerduct)\b/.test(text);
 return false;
}
function searchQuality(item,query){
 const q=clean(query);
 if(!q)return 1;
 const code=compact(q);
 const identifiers=[item.sku,item.manufacturerPartNumber,item.catalogInfo?.mpn];
 if(identifiers.some(value=>clean(value)===q||code.length>=4&&compact(value)===code))return 5;
 const name=clean(item.name);
 if(name===q)return 4;
 // Keep ordinary token search across catalog details, including the finish code.
 const normalized=q.replace(/\b(cat)[ -]+([35678][ae]?)\b/g,'$1$2');
 const info=item.catalogInfo||{};
 const searchable=(!info.brand&&item.manufacturer||!info.mpn&&item.manufacturerPartNumber)?
  {...item,catalogInfo:{...info,brand:info.brand||item.manufacturer,mpn:info.mpn||item.manufacturerPartNumber}}:item;
 if(!partSearch(searchable,q)&&!partSearch(searchable,normalized))return 0;
 return name.startsWith(q)||name.startsWith(normalized)?3:2;
}
function matchingNoun(query){
 const words=clean(query);
 if(/\bpatch[- ]?(?:cords?|cables?)\b/.test(words))return 'patchCords';
 if(/\b(?:patch panels?|strike|jack shutters?)\b/.test(words))return '';
 if(/\b(?:faceplates?|wall plates?)\b/.test(words))return 'faceplates';
 if(/\b(?:j[- ]?hooks?|ladder runway|tray|support hardware)\b/.test(words))return 'supports';
 if(/\b(?:keystones?|jacks?)\b/.test(words))return 'jacks';
 if(/\b(?:conduit|innerduct)\b/.test(words))return 'conduit';
 if(/\b(?:racks?|server cabinets?)\b/.test(words))return 'racks';
 if(/\b(?:fiber|fibre)\b/.test(words))return 'fiber';
 if(/\b(?:cables?|osdp)\b/.test(words))return 'bulkCable';
 return '';
}
export function rankMaterials(items,signals,filters={},canLog=()=>true){
 const {query='',category='',type='',brand='',shortcut='all'}=filters;
 const noun=matchingNoun(query);
 return items.map(item=>{
  const signal=signals.get(item.id),quality=searchQuality(item,query);
  if(!quality||category&&category!==materialCategory(item)||type&&type!==materialType(item)||
   brand&&brand!==materialBrand(item)||!inShortcut(item,shortcut,signal))return null;
  // Only an exact SKU/MPN outranks evidence. A generic old label or leftover
  // pricing must not outrank a manufacturer-confirmed candidate by itself.
  const ranks=[Number(quality===5),Number(Boolean(noun&&inShortcut(item,noun,signal))),Number(Boolean(signal?.onOrder)),Number(signal?.onHand>0),
   Number(materialHasIdentity(item)),materialUnitPreference(item),
   signal?.mine||0,signal?.latest||0,signal?.orders||0,quality,Number(canLog(item))];
  return {item,ranks};
 }).filter(Boolean).sort((a,b)=>{
  for(let i=0;i<a.ranks.length;i++)if(a.ranks[i]!==b.ranks[i])return b.ranks[i]-a.ranks[i];
  return compare(a.item.name||'',b.item.name||'')||compare(a.item.sku||'',b.item.sku||'')||compare(a.item.id||'',b.item.id||'');
 }).map(({item})=>item);
}
export function materialFacets(items,{category='',type=''}={}){
 const unique=values=>[...new Set(values)].sort(compare);
 const byCategory=category?items.filter(item=>materialCategory(item)===category):items;
 const byType=type?byCategory.filter(item=>materialType(item)===type):byCategory;
 return {categories:unique(items.map(materialCategory)),types:unique(byCategory.map(materialType)),brands:unique(byType.map(materialBrand))};
}
