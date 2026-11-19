import {projectBilling} from './project-billing.js';
// Owns the project detail presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { billingName, can, card, choose, contactLine, customer, data, detail, esc, head, jobContact, nav, project, projectLabel, status, table, wo, workorders } from '../app.js';

export function projectDetail(p){
 const payer=customer(p.customerId);
 const estimate=can('estimates.view')?(data.estimates||[]).find(item=>item.id===p.estimateId&&item.status!=='draft'):null;
 const orders=data.workorders.filter(w=>w.projectId===p.id);
 const waiting=orders.filter(w=>!w.approvedAt).length;
 const active=orders.filter(w=>w.approvedAt&&!w.closeout&&!w.invoice).length;
 const submitted=orders.filter(w=>w.closeout&&!w.invoice).length;
 const billed=orders.filter(w=>w.invoice).length;
 return head(projectLabel(p),'Project detail',billingName(payer),
  `<div class="gap"><button class="secondary" data-nav="projects">All projects</button>${can('workorder.create')?'<button class="primary" data-open="workorder">+ New Work Order</button>':''}${!p.closedAt&&can('project.close')?`<button class="secondary" data-project-flow="close" data-flow-id="${esc(p.id)}">Close Project</button>`:''}</div>`)+
  `<section class="panel"><b>${p.closedAt?'Closed '+esc(p.closedAt.slice(0,10)):'Open'}</b><p>Next step: ${esc(p.nextStep||'—')} · Follow-up due: ${esc(p.followUpDue||'—')}</p>${can('project.followup')?`<button class="secondary" data-project-flow="followup" data-flow-id="${esc(p.id)}">Edit follow-up</button>`:''}</section>`+
  `${p.effectivePricing?' <p class="muted">Pricing · '+esc(p.effectivePricing.name)+' · '+esc(p.effectivePricing.scope)+'</p>':''}${can('pricing.profile.assign')?`<button class="secondary small" data-assign-price="project" data-target="${esc(p.id)}">Assign pricing profile</button>`:''}<section class="panel"><p><b>Billing client:</b> ${can('customers.view')&&payer?`<button class="rowlink" data-client-portal="${esc(payer.id)}">${esc(billingName(payer))}</button>`:esc(billingName(payer))}<br><b>Primary contact:</b> ${contactLine(jobContact(p))||'Billing client leads / choose later'} ${can('project.contact')?'<button class="rowlink" data-open="project-contact">Assign contact</button>':''}<br>
  <b>Jobsite:</b> ${esc(p.site||'—')}${p.po?'<br><b>Client PO:</b> '+esc(p.po):''}
  ${p.legacyStatus?'<br><b>Imported status:</b> '+esc(p.legacyStatus):''}</p>${p.description?`<p>${esc(p.description)}</p>`:''}</section>
  ${estimate?`<section class="panel"><h2>Accepted estimate · ${esc(estimate.number)}</h2><p class="ticket-text">${esc(estimate.scope)}</p><button class="secondary small" data-estimate-action="print" data-estimate-id="${esc(estimate.id)}">Print accepted estimate</button></section>`:''}
  <div class="cards">${card('Awaiting signoff',waiting)}${card('In progress',active)}${card('Submitted / unbilled',submitted)}${card('Invoiced',billed)}</div>
  <section class="panel"><h2>Work orders</h2>${table(['Work order','Status','Field entries'],orders.map(w=>
   `<tr><td><button class="rowlink" data-wo="${esc(w.id)}">${esc(w.title)}</button></td><td>${status(w.status)}</td><td>${w.entries.length}</td></tr>`))}</section>`+projectBilling(p);
}

