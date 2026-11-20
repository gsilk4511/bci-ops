// Inventory presentation. Write actions go through the permission-checked app.
import { billingName, can, card, catalog, data, esc, fmt, head, me, table, wo } from '../app.js';
import {partCategory,partMeta,partSearch,photoThumbnail} from './catalog-photos.js';

function sourceLink(raw,label){
 try{const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';
 return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;}catch{return '';}
}
function partDetails(item){
 const info=item?.catalogInfo;if(!info)return '';
 const fields=[['Manufacturer',info.brand],['Manufacturer part #',info.mpn],['Category',partCategory(item)],['Family',info.family],['Specifications',info.spec],['Grade',info.grade],['Trade size',info.tradeSize],['Length',[info.length,info.lengthUnit].filter(x=>x!==null&&x!==undefined&&x!=='').join(' ')],['Catalog unit',info.catalogUnit||(item.needsUnitReview?'Not listed. Verify before pricing.':'')],['Pack quantity',info.packQty],['Ports',info.ports],['Color',info.color],['Shielding',info.shielding],['Work type',info.workType],['Installation method',info.installMethod],['Finish',info.finishCode],['Monitoring',info.monitoringOption],['Documented fit',info.documentedFit],['Photo status',info.photoStatus]];
 const links=[sourceLink(info.sourceUrl,'Manufacturer specifications'),sourceLink(info.photoEvidencePage,'Manufacturer photo source')].filter(Boolean);
 const fits=Array.isArray(info.fitReferences)?info.fitReferences:[];
 return `<details class="bci-inventory-details"><summary>Part details<span class="bci-visually-hidden"> for ${esc(item.name)}</span></summary><dl>${fields.filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
 ${fits.length?`<h3>Manufacturer fit references</h3><ul>${fits.map(f=>`<li>${esc([f.part,f.fits,f.relationship,f.limit].filter(Boolean).join(' · '))}${f.sourceUrl?' '+sourceLink(f.sourceUrl,'Fit source'):''}</li>`).join('')}</ul>`:''}
 ${links.length?`<p class="bci-inventory-source-links">${links.join(' · ')}</p>`:''}</details>`;
}
const pageSize=40;
const stockTable=(rows)=>table(['Part / barcode value','Location','On hand','Draft demand','Projected','Estimated cost'],rows.map(({stock:x,item:c})=>{
 const detail=[c?.sku,partMeta(c),partCategory(c)].filter(Boolean).map(esc).join(' · ');
 return `<tr><td><div class="bci-photo-line">${photoThumbnail(c)}<div><b>${esc(billingName(c))}</b><div class="muted tiny">${detail}</div>${partDetails(c)}</div></div></td><td>${esc(x.location)}</td><td class="${x.quantity<0?'warn':''}">${x.quantity}</td><td>${x.reserved??0}</td><td class="${(x.projected??x.quantity)<0?'warn':''}">${x.projected??x.quantity}</td><td>${c?.cost==null||(c.needsPricing&&Number(c.cost)===0)?'—':fmt(x.quantity*c.cost)}</td></tr>`;
}));
const allTable=rows=>table(['Part / barcode value','Category','Unit','Stock locations'],rows.map(({item,locations})=>
 `<tr><td><div class="bci-photo-line">${photoThumbnail(item)}<div><b>${esc(billingName(item))}</b><div class="muted tiny">${esc([item.sku,partMeta(item)].filter(Boolean).join(' · '))}</div>${partDetails(item)}</div></div></td><td>${esc(partCategory(item))}</td><td>${esc(item.unit||'—')}</td><td>${locations}</td></tr>`));
function inventoryRows(mode,query,category){
 const parts=new Map(data.catalog.map(item=>[item.id,item]));
 const matches=item=>partSearch(item,query)&&(!category||partCategory(item)===category);
 if(mode==='stock')return data.inventory.map(stock=>({stock,item:parts.get(stock.catalogId)})).filter(({item})=>matches(item));
 const locations=new Map();for(const row of data.inventory)locations.set(row.catalogId,(locations.get(row.catalogId)||0)+1);
 return data.catalog.filter(item=>item.type==='material'&&matches(item)).map(item=>({item,locations:locations.get(item.id)||0}));
}
export function inventory(){
 const materials=data.catalog.filter(c=>c.type==='material');
 const categories=[...new Set(materials.map(partCategory))].sort((a,b)=>a.localeCompare(b));
 const initial=inventoryRows('stock','','');
 return head('Parts & inventory','Stock control','All issued parts are tied to a job. Negative stock is allowed and flagged.',`<div class="gap">${can('pricing.view')&&can('catalog.create')?'<button class="secondary" data-open="catalog">+ Add item</button>':''}${can('purchase.create')?'<button class="secondary" data-open="expense">+ Card Purchase</button>':''}${can('inventory.receive')?'<button class="primary" data-open="receive">+ Receive Parts</button>':''}${can('inventory.transfer')?'<button class="secondary" data-open="transfer">Transfer</button>':''}${can('inventory.adjust')?'<button class="secondary" data-open="adjust">Adjust stock</button>':''}${me?.role==='admin'?'<button class="primary" data-open="catalog-import">Import catalog</button>':''}</div>`)+`<div class="cards">${card('Material SKUs',materials.length,'All catalog materials')}${card('Negative stock locations',data.inventory.filter(x=>(x.projected??x.quantity)<0).length,'Review and reconcile','orange')}${card('Purchase records',data.purchases.length,'Parts and other expenses')}${card('Movements',data.movements.length,'Receipts and issues')}</div>
 <section class="panel" data-bci-inventory data-page="0"><h2>Inventory</h2><div class="bci-inv-filters"><div class="field"><label for="bciInventoryView">View</label><select id="bciInventoryView"><option value="stock">BCI Stock by location</option><option value="all">All Parts</option></select></div>
 <div class="field"><label for="bciInventorySearch">Search parts</label><input id="bciInventorySearch" type="search" placeholder="Name, brand, part # or SKU"></div>
 <div class="field"><label for="bciInventoryCategory">Category</label><select id="bciInventoryCategory"><option value="">All categories</option>${categories.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div></div>
 <p class="muted tiny" data-bci-inventory-count role="status">${initial.length} stock location rows</p><div data-bci-inventory-results>${stockTable(initial.slice(0,pageSize))}</div><div class="actions">
 <button type="button" class="secondary" data-bci-inv-page="-1" disabled>Previous</button>
 <button type="button" class="secondary" data-bci-inv-page="1" ${initial.length<=pageSize?'disabled':''}>Next</button></div></section>
 <section class="panel"><h2>Activity</h2>${table(['When','Type','Part','Location','Quantity','Work order'],data.movements.slice(0,50).map(x=>`<tr><td>${new Date(x.at).toLocaleString()}</td><td>${esc(x.type)}</td><td>${esc(catalog(x.catalogId)?.name)}</td><td>${esc(x.location)}</td><td class="${x.quantity<0?'warn':''}">${x.quantity}</td><td>${esc(wo(x.workorderId)?.title||'—')}</td></tr>`))}</section>`;
}
function update(section,next=0){
 const mode=section.querySelector('#bciInventoryView').value;
 const rows=inventoryRows(mode,section.querySelector('#bciInventorySearch').value,section.querySelector('#bciInventoryCategory').value);
 const page=Math.min(Math.max(0,next),Math.max(0,Math.ceil(rows.length/pageSize)-1));
 section.dataset.page=String(page);
 const start=page*pageSize, end=Math.min(start+pageSize,rows.length);
 section.querySelector('[data-bci-inventory-count]').textContent=rows.length?`Showing ${start+1}–${end} of ${rows.length} ${mode==='stock'?'stock location rows':'parts'}`:'No matching parts.';
 section.querySelector('[data-bci-inventory-results]').innerHTML=(mode==='stock'?stockTable:allTable)(rows.slice(start,end));
 section.querySelector('[data-bci-inv-page="-1"]').disabled=page===0;
 section.querySelector('[data-bci-inv-page="1"]').disabled=end>=rows.length;
}
document.addEventListener('input',event=>{if(event.target.id==='bciInventorySearch')update(event.target.closest('[data-bci-inventory]'));});
document.addEventListener('change',event=>{if(['bciInventoryView','bciInventoryCategory'].includes(event.target.id))update(event.target.closest('[data-bci-inventory]'));});
document.addEventListener('click',event=>{
 const button=event.target.closest?.('button[data-bci-inv-page]');if(!button)return;
 const section=button.closest('[data-bci-inventory]');update(section,Number(section.dataset.page)+Number(button.dataset.bciInvPage));
});
