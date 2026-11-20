import {can,data,esc,head,table} from '../app.js';

export function servicesPage(){
 if(!can('pricing.view'))return '';
 const services=(data.catalog||[]).filter(item=>item.type==='labor'||item.type==='travel')
  .sort((a,b)=>a.name.localeCompare(b.name)||a.sku.localeCompare(b.sku));
 const actions=(can('catalog.create')?'<button class="primary" data-open="service">+ Add Service</button>':'')+
  '<button class="secondary" data-nav="catalog">Pricing</button>';
 return head('Services','Operations','Manage the labor and travel names used on estimates and work orders. Parts and stock stay in Warehouse.',
  '<div class="actions">'+actions+'</div>')+
  '<section class="panel">'+table(['Service','Type','Group','SKU','Unit','Pricing status'],services.map(item=>
   '<tr><td><b>'+esc(item.name)+'</b></td><td>'+esc(item.type==='labor'?'Labor':'Travel')+'</td><td>'+esc(item.group)+
   '</td><td>'+esc(item.sku)+'</td><td>'+esc(item.unit)+'</td><td>'+(item.needsPricing?'Needs pricing':'See Pricing')+'</td></tr>'))+
  '<p class="muted">Set or review service rates in Pricing. Existing work order and invoice records keep their original service.</p></section>';
}
