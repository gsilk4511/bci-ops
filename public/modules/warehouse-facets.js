import {partColorValues,partSearch} from './catalog-photos.js';

export const warehouseFacetKeys=['brand','category','type','color','stock'];
export const unclassified='Unclassified';
export const partFacets={
 brand:item=>[item.catalogInfo?.brand,item.manufacturer].find(value=>typeof value==='string'&&value.trim())?.trim()||'Not specified',
 category:item=>item.catalogInfo?.system||item.group||unclassified,
 type:item=>item.catalogInfo?.partType||unclassified,
};
const stockLabels=[
 ['positive','In stock'],['zero','Zero on hand'],
 ['negative','Negative / projected short'],['legacy','Has legacy balance'],
];
export const facetLabels={
 brand:['Brand','All brands'],category:['Category','All categories'],type:['Type','All types'],
 color:['Color / Finish','All colors and finishes'],stock:['Stock','All stock levels'],
};
const colorValues=item=>{
 const values=partColorValues(item);
 return values.length?values:['Not specified'];
};
function facetValues({item,onHand,projected,legacy}){
 return {
  ...Object.fromEntries(Object.entries(partFacets).map(([key,get])=>{
   const label=get(item);return [key,[[label,label]]];
  })),
  color:colorValues(item).map(label=>[label.toLowerCase(),label]),
  stock:stockLabels.filter(([value])=>value==='positive'?onHand>0:value==='zero'?onHand===0:
   value==='negative'?onHand<0||projected<0:legacy.length>0),
 };
}
const compatible=(records,key,value)=>records.filter(record=>record.values[key].some(([id])=>id===value));

// Reconcile dropdown changes in reverse order of selection. Query text filters without
// changing saved facets, so a partially typed search can be corrected without rebuilding them.
export function warehouseFacets(rows,filters,selectionOrder){
 const records=rows.map(row=>({row,values:facetValues(row)}));
 const checkedKeys=new Set();
 let compatibleRows=records;
 const cleared=[];
 for(const key of [...selectionOrder].reverse().concat(warehouseFacetKeys)){
  if(checkedKeys.has(key)||!warehouseFacetKeys.includes(key)||!filters[key])continue;
  checkedKeys.add(key);
  const kept=compatible(compatibleRows,key,filters[key]);
  if(kept.length)compatibleRows=kept;
  else {filters[key]='';cleared.push(facetLabels[key][0]);}
 }
 const searched=filters.query?records.filter(({row:{item}})=>{
  if(!item.manufacturer)return partSearch(item,filters.query);
  const catalogInfo={...item.catalogInfo,brand:partFacets.brand(item),mpn:item.catalogInfo?.mpn||item.manufacturerPartNumber||item.mpn};
  return partSearch({...item,catalogInfo},filters.query);
 }):records;
 const options=Object.fromEntries(warehouseFacetKeys.map(key=>{
  const other=warehouseFacetKeys.reduce((base,other)=>other===key||!filters[other]?base:compatible(base,other,filters[other]),searched);
  const counts=new Map();
  for(const row of other)for(const [value,display] of row.values[key]){
   const current=counts.get(value);
   counts.set(value,[display,(current?.[1]||0)+1]);
  }
  // A typed search may yield zero rows; keep the current value at 0 so
  // the selected value can still be inspected and independently cleared.
  if(filters[key]&&!counts.has(filters[key])){
   const label=compatibleRows[0]?.values[key].find(([value])=>value===filters[key])?.[1];
   if(label)counts.set(filters[key],[label,0]);
  }
  const choices=[...counts].map(([value,[label,count]])=>[value,label,count]);
  const order=choices.sort((a,b)=>key==='stock'?
   stockLabels.findIndex(([value])=>value===a[0])-stockLabels.findIndex(([value])=>value===b[0]):a[1].localeCompare(b[1]));
  return [key,[['',facetLabels[key][1],other.length],...order]];
 }));
 const matched=warehouseFacetKeys.reduce((base,key)=>filters[key]?compatible(base,key,filters[key]):base,searched).map(({row})=>row);
 return {options,matched,cleared};
}
