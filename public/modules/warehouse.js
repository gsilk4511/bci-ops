// Warehouse presentation. Write actions go through the permission-checked app.
import { billingName, can, card, catalog, data, esc, fmt, head, me, modal, send, table, wo } from '../app.js';
import {warehouseFiles} from './warehouse-roundtrip.js';
import {readReceiptPhoto} from './work-entry.js';
import {partCategory,partColor,partMeta} from './catalog-photos.js';
import {facetLabels,partFacets,unclassified,warehouseFacetKeys,warehouseFacets} from './warehouse-facets.js';

function sourceLink(raw,label){
 try{const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';
 return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;}catch{return '';}
}
function partDetails(item){
 const info=item?.catalogInfo;if(!info)return '';
 const fields=[['Manufacturer',info.brand],['Manufacturer part #',info.mpn],['Category',partCategory(item)],['Family',info.family],['Specifications',info.spec],['Grade',info.grade],['Trade size',info.tradeSize],['Length',[info.length,info.lengthUnit].filter(x=>x!==null&&x!==undefined&&x!=='').join(' ')],['Catalog unit',info.catalogUnit||(item.needsUnitReview?'Not listed. Verify before pricing.':'')],['Pack quantity',info.packQty],['Ports',info.ports],['Color',info.color],['Shielding',info.shielding],['Work type',info.workType],['Installation method',info.installMethod],['Finish',info.finishCode],['Monitoring',info.monitoringOption],['Documented fit',info.documentedFit]];
 const links=[sourceLink(info.sourceUrl,'Manufacturer specifications')].filter(Boolean);
 const fits=Array.isArray(info.fitReferences)?info.fitReferences:[];
 return `<details class="bci-warehouse-details"><summary>Part details<span class="bci-visually-hidden"> for ${esc(item.name)}</span></summary><dl>${fields.filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
 ${fits.length?`<h3>Manufacturer fit references</h3><ul>${fits.map(f=>`<li>${esc([f.part,f.fits,f.relationship,f.limit].filter(Boolean).join(' · '))}${f.sourceUrl?' '+sourceLink(f.sourceUrl,'Fit source'):''}</li>`).join('')}</ul>`:''}
 ${links.length?`<p class="bci-warehouse-source-links">${links.join(' · ')}</p>`:''}</details>`;
}
export const warehouseName='BCI Warehouse';
const pageSize=40;
const filters={query:'',brand:'',category:'',type:'',color:'',service:'',stock:'',page:0};
let selectionOrder=[];
const isFiltered=()=>Boolean(filters.query||warehouseFacetKeys.some(key=>filters[key]));
const options=(values,selected)=>values.map(([value,label,count])=>`<option value="${esc(value)}"${value===selected?' selected':''}>${esc(label)} (${count.toLocaleString()})</option>`).join('');
const moneyText=(n,pending)=>n==null||(pending&&Number(n)===0)?'—':fmt(n);
const num=(n,fallback=0)=>n==null||!Number.isFinite(Number(n))?fallback:Number(n);
const qty=n=>Math.round((n+Number.EPSILON)*100)/100;
const priced=()=>can('inventory.view')&&can('pricing.view')&&can('catalog.update');
const counts=()=>can('inventory.view')&&can('inventory.adjust');
const unknownCost=c=>c.needsUnitCost===true||(c.needsUnitCost!==false&&!c.warehouseUnitCostOverride&&Number(c.cost)===0);
const showCost=()=>can('finance.view');
const showPrice=()=>can('pricing.view');
function rowsFor(materials){
 const warehouse=new Map(),legacy=new Map();
 for(const stock of data.inventory){
  if(stock.location===warehouseName){
   const current=warehouse.get(stock.catalogId)||{onHand:0,demand:0,projected:0};
   current.onHand=qty(current.onHand+num(stock.quantity));
   current.demand=qty(current.demand+num(stock.reserved));
   current.projected=qty(current.projected+num(stock.projected,num(stock.quantity)-num(stock.reserved)));
   warehouse.set(stock.catalogId,current);
  }else if(num(stock.quantity)||num(stock.reserved)||num(stock.projected)){
   if(!legacy.has(stock.catalogId))legacy.set(stock.catalogId,[]);
   legacy.get(stock.catalogId).push(stock);
  }
 }
 return materials.map(item=>({item,...(warehouse.get(item.id)||{onHand:0,demand:0,projected:0}),legacy:legacy.get(item.id)||[]}));
}
const input=(key,label,value,max,kind='text')=>`<label class="field"><span>${esc(label)}</span><input name="${esc(key)}" type="${kind}" value="${esc(value)}" ${kind==='number'?`min="0" max="${max}" step="0.01"`:`maxlength="${max}"`}></label>`;
const statusLine='<p class="form-error" role="alert" hidden></p>';
function editable({item:c,onHand}){
 if(!counts()&&!priced())return '';
 const label=esc(billingName(c));
 return `<div class="bci-wh-editors">
 ${counts()?`<details><summary>Edit count<span class="bci-visually-hidden"> for ${label}</span></summary>
 <form data-bci-wh-form="count" data-id="${esc(c.id)}" data-expected="${onHand}">
 <label class="field"><span>Counted on hand</span><input name="quantity" type="number" step="0.01" min="0" max="1000000" value="${onHand<0?'':onHand}" required></label>
 <label class="field"><span>Reason</span><input name="reason" placeholder="e.g. Physical count" maxlength="400" required></label>
 ${statusLine}<button class="secondary small" type="submit">Save count</button></form></details>`:''}
 ${priced()?`<details><summary>Edit part &amp; pricing<span class="bci-visually-hidden"> for ${label}</span></summary>
 <form data-bci-wh-form="pricing" data-id="${esc(c.id)}">
 ${input('brand','Brand',c.catalogInfo?.brand,80)}${input('mpn','Manufacturer part #',c.catalogInfo?.mpn,100)}
 ${input('system','Category',c.catalogInfo?.system,100)}${input('partType','Type',c.catalogInfo?.partType,100)}
 ${showCost()?input('cost','Unit cost',knownNumber(c.cost,unknownCost(c)),1000000,'number'):''}
 ${input('price','Sell price',knownNumber(c.price,c.needsPricing),1000000,'number')}
 ${input('changePrice','Change-order price',knownNumber(c.changePrice,c.needsPricing),1000000,'number')}
 ${statusLine}<button class="secondary small" type="submit">Save part &amp; pricing</button></form></details>`:''}</div>`;
}
const knownNumber=(n,pending)=>n==null||(pending&&Number(n)===0)?'':n;
const stat=(label,value,warn=false)=>`<div role="cell"><span class="bci-wh-cell-label">${esc(label)}</span><span class="${warn?'warn':''}">${esc(value)}</span></div>`;
const gridHead=label=>`<span role="columnheader">${esc(label)}</span>`;
function stockPlans(rows){
 const rowsBySku=new Map(rows.map(r=>[String(r.item.sku||'').toLowerCase(),r]));
 const groups=(data.warehouseStockGroups||[]).map(g=>({label:g.label,target:g.target,onHand:qty(g.skus.reduce((n,sku)=>n+num(rowsBySku.get(sku.toLowerCase())?.onHand),0)),unit:'each across colors'}));
 const individual=rows.filter(r=>r.item.stockTarget!=null).map(r=>({label:r.item.name,target:r.item.stockTarget,onHand:r.onHand,unit:r.item.unit}));
 const plans=[...groups,...individual];
 if(!plans.length)return '';
 return '<details class="panel"><summary><b>Stock targets</b> · '+plans.length+' tracked</summary><p class="muted">Targets are separate from physical counts. Gap is based on on-hand stock only. No orders are placed.</p>'+table(['Item / shared group','Unit','On hand','Target','Gap'],plans.map(p=>`<tr><td>${esc(p.label)}</td><td>${esc(p.unit)}</td><td>${esc(p.onHand)}</td><td>${esc(p.target)}</td><td>${esc(Math.max(0,qty(p.target-p.onHand)))}</td></tr>`))+'</details>';
}
function grid(rows){
 if(!rows.length)return '<p class="empty">No matching parts.</p>';
 const layout=[showCost()?'bci-wh-with-cost':'',showPrice()?'bci-wh-with-price':''].join(' ');
 return `<div class="bci-wh-grid ${layout}" role="table" aria-label="BCI Warehouse parts"><div class="bci-wh-row bci-wh-header" role="row">${['Part', 'On hand','Draft demand','Projected',...(showCost()?['Unit cost']:[]),...(showPrice()?['Sell price']:[])].map(gridHead).join('')}</div>
 ${rows.map(row=>{
  const {item:c,onHand,demand,projected,legacy}=row;
  const detail=[c.sku,partMeta(c),[partFacets.category(c),partFacets.type(c)].filter(x=>x!==unclassified).join(' / '),c.catalogInfo?.serviceCategory,c.unit].filter(Boolean).map(esc).join(' · ');
  return `<div class="bci-wh-record" role="rowgroup"><div class="bci-wh-row" role="row"><div class="bci-wh-part" role="rowheader"><b>${esc(billingName(c))}</b><div class="muted tiny">${detail}</div><div class="bci-wh-variant tiny"><b>Color / Finish:</b> ${esc(partColor(c)||'Not specified')}</div>${partDetails(c)}
  ${legacy.length?`<details class="bci-warehouse-details"><summary>Legacy stock, not in warehouse count</summary><ul>${legacy.map(x=>`<li>${esc(x.location)}: ${esc(x.quantity)} on hand${x.reserved?`, ${esc(x.reserved)} draft demand`:''}</li>`).join('')}</ul></details>`:''}</div>
  ${stat('On hand',onHand,onHand<0)}${stat('Draft demand',demand)}${stat('Projected',projected,projected<0)}${showCost()?stat('Unit cost',moneyText(c.cost,unknownCost(c))):''}${showPrice()?stat('Sell price',moneyText(c.price,c.needsPricing)):''}
  </div>${editable(row)}</div>`;
 }).join('')}</div>`;
}
function listPage(rows){
 const {matched,options:available,cleared}=warehouseFacets(rows,filters,selectionOrder);
 selectionOrder=selectionOrder.filter(key=>filters[key]);
 matched.sort((a,b)=>a.item.name.localeCompare(b.item.name)||a.item.id.localeCompare(b.item.id));
 filters.page=Math.min(Math.max(0,filters.page),Math.max(0,Math.ceil(matched.length/pageSize)-1));
 const start=filters.page*pageSize, end=Math.min(start+pageSize,matched.length);
 return {start,end,matched,available,cleared,html:grid(matched.slice(start,end)),
  caption:matched.length?`Showing ${start+1}–${end} of ${matched.length} parts`:'No matching parts.'};
}
const receiveParts=()=>can('inventory.view')&&can('inventory.receive');
const fieldReceipts=()=>can('inventory.view')&&can('workorders.view')&&can('receipt.read');
const timeText=at=>{
 const date=new Date(at);
 return at&&!Number.isNaN(+date)?date.toLocaleString():'—';
};
const receiptButton=id=>`<button type="button" class="rowlink" data-warehouse-photo="${esc(id)}">View receipt</button>`;
function fieldPurchases(){
 if(!fieldReceipts())return '';
 const purchases=data.warehouseFieldPurchases||[];
 if(!purchases.length)return '<div class="bci-wh-field"><h3>Field purchases</h3><p class="muted">Photos attached to a work-order material entry will show here.</p></div>';
 const pending=purchases.filter(x=>x.status==='pending').length;
 const cardFor=x=>{
  const part=catalog(x.catalogId);
  const state=x.status==='committed'?'Committed':x.status==='pending'?'Pending':'Needs review';
  return `<li class="bci-wh-receipt">
   <div class="bci-wh-receipt-main"><b>${esc(x.partName||part?.name||'Material entry')}</b>
   <div>${esc(x.quantity)} ${esc(x.unit||'')} · ${esc(x.workorderTitle||wo(x.workorderId)?.title||'Work order')}</div>
   <div class="muted tiny">Receipt added ${esc(timeText(x.at))}</div>
   ${x.status==='committed'&&x.committedAt?`<div class="muted tiny">Committed ${esc(timeText(x.committedAt))}</div>`:''}
   ${x.status==='review'?'<div class="muted tiny">This receipt cannot be matched to an eligible issue. No stock was added.</div>':''}</div>
   <div class="bci-wh-receipt-actions"><span class="status ${x.status==='committed'?'approved':x.status==='pending'?'pending':''}">${state}</span>
   ${receiptButton(x.id)}
   ${x.status==='pending'&&receiveParts()?`<button type="button" class="secondary small" data-warehouse-commit="${esc(x.id)}">Commit to Warehouse</button>`:''}</div>
   </li>`;
 };
 return `<div class="bci-wh-field"><h3>Field purchases ${pending?`<span class="status pending">${pending} pending</span>`:''}</h3>
 <p class="muted">Commit a field purchase only for parts bought for that work order, not stock already received into Warehouse. It offsets the work-order issue once and leaves the job’s materials unchanged.</p>
 <ul class="bci-wh-receipts">${purchases.map(cardFor).join('')}</ul></div>`;
}
function warehouseActivity(){
 const directReceipts=receiveParts(), orderReceipts=fieldReceipts();
 const receipts=directReceipts||orderReceipts;
 return `<section class="panel"><h2>Activity</h2>${fieldPurchases()}<h3>Stock movements</h3>${table(['When','Type','Part','Location','Quantity','Work order','Notes',...(receipts?['Receipt']:[])],data.movements.slice(0,50).map(x=>`<tr><td>${esc(timeText(x.at))}</td><td>${esc(x.type==='field-purchase'?'Field purchase committed':x.type)}</td><td>${esc(catalog(x.catalogId)?.name)}</td><td>${esc(x.location)}</td><td class="${x.quantity<0?'warn':''}">${esc(x.quantity)}</td><td>${esc(wo(x.workorderId)?.title||x.sourceWorkorderTitle||'—')}</td><td>${esc(x.note||'—')}</td>${receipts?`<td>${x.warehouseReceiptId&&(x.type==='field-purchase'?orderReceipts:directReceipts)?receiptButton(x.warehouseReceiptId):'—'}</td>`:''}</tr>`))}</section>`;
}
document.addEventListener('click',event=>{
 const photo=event.target.closest?.('[data-warehouse-photo]');
 if(photo&&(receiveParts()||fieldReceipts()))return readReceiptPhoto('inventory.receiptRead',{id:photo.dataset.warehousePhoto});
 const button=event.target.closest?.('[data-warehouse-commit]');
 if(!button||!receiveParts()||!fieldReceipts())return;
 const entry=(data.warehouseFieldPurchases||[]).find(x=>x.id===button.dataset.warehouseCommit&&x.status==='pending');
 if(!entry)return;
 const label=entry.partName||catalog(entry.catalogId)?.name||'the part';
 modal('Commit field purchase to Warehouse','',()=>send('inventory.commitFieldPurchase',{id:entry.id,workorderId:entry.workorderId,revision:entry.revision}),
  `<p>Add back <b>${esc(entry.quantity)} ${esc(entry.unit||'')} · ${esc(label)}</b> to offset the issue for <b>${esc(entry.workorderTitle||'this work order')}</b>.</p><p>Continue only if these parts were bought for this job and have not already been received into Warehouse. The work-order material entry will stay as recorded.</p>`);
 document.querySelector('#actionForm button[type=submit]').textContent='Commit to Warehouse';
});
export function warehouse(){
 const allMaterials=data.catalog.filter(c=>c.type==='material');
 const materials=allMaterials.filter(c=>c.warehouseArchived!==true);
 const archived=allMaterials.length-materials.length;
 const rows=rowsFor(materials);
 const list=listPage(rows),legacy=rows.filter(x=>x.legacy.length).length;
 const qtyLabel=legacy===1?'part has':'parts have';
 const select=key=>`<div class="field"><label for="bciWarehouse-${key}">${esc(facetLabels[key][0])}</label><select id="bciWarehouse-${key}" data-bci-wh-filter="${key}">${options(list.available[key],filters[key])}</select></div>`;
 return head('Warehouse','Stock and catalog','Count, price, and filter catalog parts and warehouse stock in one place.',`<div class="gap">${can('pricing.view')&&can('catalog.create')?'<button class="secondary" data-open="warehouse-item">Add Item</button>':''}${me?.role==='admin'?'<button class="secondary" data-open="catalog-import">Import Catalog</button>':''}${receiveParts()?'<button class="primary" data-open="warehouse-receive">Receive Parts</button>':''}</div>`)+
 `<div class="cards">${card('Active material SKUs',materials.length,archived?`${archived.toLocaleString()} archived, history retained`:'All active parts')}${card('Warehouse shortages',rows.filter(x=>x.onHand<0||x.projected<0).length,'Review and reconcile','orange')}${card('Movements',data.movements.length,'Receipts, corrections and issues')}</div>
 ${warehouseFiles()}${stockPlans(rows)}<section class="panel" data-bci-warehouse><h2>${warehouseName}</h2>
 ${legacy?`<p class="muted">${legacy} ${qtyLabel} balances or draft demand at older locations. Choose “Has legacy balance” in the stock filter to review those rows. They are preserved separately and not included in warehouse counts.</p>`:''}
 <div class="bci-wh-filters"><div class="field"><label for="bciWarehouseSearch">Search parts</label><input id="bciWarehouseSearch" data-bci-wh-filter="query" type="search" value="${esc(filters.query)}" placeholder="Name, brand, color, part # or SKU"></div>
 ${warehouseFacetKeys.map(select).join('')}</div>
 <div class="gap"><button type="button" class="secondary small" data-bci-wh-clear ${isFiltered()?'':'disabled'}>Clear all filters</button>
 <p class="muted tiny" data-bci-wh-filter-notice aria-live="polite">${clearNotice(list.cleared)}</p></div>
 <p class="muted tiny" data-bci-warehouse-count role="status">${list.caption}</p><div data-bci-warehouse-results>${list.html}</div><div class="actions">
 <button type="button" class="secondary" data-bci-wh-page="-1" ${filters.page===0?'disabled':''}>Previous</button>
 <button type="button" class="secondary" data-bci-wh-page="1" ${list.end>=list.matched.length?'disabled':''}>Next</button></div></section>
 ${warehouseActivity()}`;
}
function clearNotice(cleared){
 return cleared.length?'Cleared incompatible filters: '+cleared.join(', ')+'.':'';
}
function update(section,next=0){
 if(!section)return;
 filters.page=next;
 const list=listPage(rowsFor(data.catalog.filter(c=>c.type==='material'&&c.warehouseArchived!==true)));
 section.querySelector('[data-bci-warehouse-count]').textContent=list.caption;
 section.querySelector('[data-bci-warehouse-results]').innerHTML=list.html;
 section.querySelector('[data-bci-wh-page="-1"]').disabled=filters.page===0;
 section.querySelector('[data-bci-wh-page="1"]').disabled=list.end>=list.matched.length;
 section.querySelector('[data-bci-wh-clear]').disabled=!isFiltered();
 section.querySelector('[data-bci-wh-filter-notice]').textContent=clearNotice(list.cleared);
 for(const key of warehouseFacetKeys){
  section.querySelector(`#bciWarehouse-${key}`).innerHTML=options(list.available[key],filters[key]);
 }
}
function applyFilter(event){
 const key=event.target.dataset?.bciWhFilter;
 if(key!=='query'&&!warehouseFacetKeys.includes(key))return;
 filters[key]=event.target.value;
 if(key!=='query'){
  selectionOrder=selectionOrder.filter(value=>value!==key);
  if(filters[key])selectionOrder.push(key);
 }
 update(event.target.closest('[data-bci-warehouse]'));
}
document.addEventListener('input',event=>{if(event.target.dataset?.bciWhFilter==='query')applyFilter(event);});
document.addEventListener('change',event=>{if(event.target.dataset?.bciWhFilter!=='query')applyFilter(event);});
document.addEventListener('click',event=>{
 const clear=event.target.closest?.('[data-bci-wh-clear]');
 if(clear&&!clear.disabled){
  const section=clear.closest('[data-bci-warehouse]');
  for(const key of ['query',...warehouseFacetKeys])filters[key]='';
  selectionOrder=[];
  const query=section.querySelector('#bciWarehouseSearch');
  query.value='';
  update(section);
  query.focus({preventScroll:true});return;
 }
 const button=event.target.closest?.('button[data-bci-wh-page]');if(!button||button.disabled)return;
 update(button.closest('[data-bci-warehouse]'),filters.page+Number(button.dataset.bciWhPage));
});
document.addEventListener('submit',async event=>{
 const form=event.target,mode=form.dataset?.bciWhForm;
 if(!['count','pricing'].includes(mode))return;
 event.preventDefault();
 if(form.dataset.saving)return;
 const error=form.querySelector('[role="alert"]'),button=form.querySelector('button[type=submit]');
 error.hidden=true;form.dataset.saving='true';button.disabled=true;
 try{
  const item=catalog(form.dataset.id);
  if(!item||item.type!=='material'||item.warehouseArchived===true)throw Error('Part is no longer available.');
  const values=Object.fromEntries(new FormData(form)),catalogId=item.id;
  if(mode==='count'){
   await send('inventory.adjust',{catalogId,mode:'count',quantity:values.quantity,expectedQuantity:Number(form.dataset.expected),reason:values.reason});
  }else{
   const changes={};
   for(const key of ['brand','mpn','system','partType']){
    if(values[key].trim()!==(item.catalogInfo?.[key]||''))changes[key]=values[key].trim();
   }
   for(const key of ['cost','price','changePrice']){
    if(values[key]!==undefined&&values[key]!==''&&Number(values[key])!==knownNumber(item[key],key==='cost'?unknownCost(item):item.needsPricing))changes[key]=values[key];
   }
   if(!Object.keys(changes).length){form.closest('details').open=false;return;}
   await send('catalog.update',{catalogId,inventoryEdit:true,...changes});
  }
 }catch(e){error.textContent=e.message;error.hidden=false;}
 finally{delete form.dataset.saving;button.disabled=false;}
});
