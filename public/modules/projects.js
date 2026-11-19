// Owns the projects presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { billingName, can, customer, customers, data, esc, head, project, projectClient, projectFilter, projectLabel, table, workorders } from '../app.js';

export function projectsHub(){
 const payer=customer(projectClient);
 const query=projectFilter.trim().toLowerCase();
 const ordersByProject=new Map();
 for(const order of data.workorders){
  if(!ordersByProject.has(order.projectId))ordersByProject.set(order.projectId,[]);
  ordersByProject.get(order.projectId).push(order);
 }
 const rows=data.projects.filter(p=>(!payer||p.customerId===payer.id)&&
  [p.number,p.name,p.site,p.po,billingName(customer(p.customerId))].some(value=>String(value||'').toLowerCase().includes(query)));
 return head('Projects','Project hub','Find a project by number, name, client, jobsite, or PO.',
  can('project.create')?'<button class="primary" data-open="new-project">+ New Project</button>':'')+
  `<section class="panel"><form id="projectSearch" class="filters">
   <label>Search projects<input name="query" type="search" value="${esc(projectFilter)}"></label>
   <label>Billing client<select name="customerId"><option value="">All clients</option>${data.customers.map(c=>
    `<option value="${esc(c.id)}" ${c.id===projectClient?'selected':''}>${esc(billingName(c))}</option>`).join('')}</select></label>
   <button class="secondary" type="submit">Filter</button></form>
   ${table(['Project','Billing client','Jobsite','Progress'],rows.map(p=>{
    const orders=ordersByProject.get(p.id)||[];
    const done=orders.filter(w=>w.closeout||w.invoice).length;
    const progress=orders.length?`${done} of ${orders.length} work orders submitted`:p.legacyStatus?`Imported · ${p.legacyStatus}`:'No work orders';
    return `<tr><td><button class="rowlink" data-project="${esc(p.id)}">${esc(projectLabel(p))}</button></td>
     <td>${esc(billingName(customer(p.customerId)))}</td><td>${esc(p.site||'—')}</td><td>${esc(progress)}</td></tr>`;
   }))}</section>`;
}

