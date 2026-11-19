// Owns the customers presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { billingName, can, contactLine, creationGuide, customer, data, esc, head, jobContact, project, projectLabel, table } from '../app.js';

export function customers(){
 const actions=can('customer.create')?'<button class="primary" data-open="customer">+ Billing Client</button>':'';
 const rows=data.customers.map(c=>{
  const projects=data.projects.filter(p=>p.customerId===c.id);
  return `<tr><td><button class="rowlink" data-client-portal="${esc(c.id)}">${esc(billingName(c))}</button>${c.business?`<div>${esc(c.name)}</div>`:''}<div class="muted tiny">${[c.address,c.phone,c.email,c.financeEmail].filter(Boolean).map(esc).join('<br>')}</div></td>
   <td>${(c.contacts||[]).map(contact=>`<div>${contactLine(contact)}</div>`).join('')||(c.contact?esc(c.contact):'—')}</td>
   <td>${projects.map(p=>`<div><button class="rowlink" data-project="${esc(p.id)}">${esc(projectLabel(p))}</button>${p.site?` <span class="muted">(${esc(p.site)})</span>`: ''}<div class="tiny muted">${contactLine(jobContact(p))||'Billing client leads'}</div></div>`).join('')||'—'}</td>
   <td>${new Date(c.createdAt).toLocaleDateString()}</td></tr>`;
 });
 return head('Customers','Client management','Billing clients, job contacts, and projects.',actions)+creationGuide()+`<section class="panel">${table(['Billing client','Job contacts','Projects','Created'],rows)}</section>`;
}

