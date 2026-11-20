// Owns the overview presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { me, today, can, card, catalog, data, esc, fmt, head, labelFor, nav, project, status, table, view, wo, workorders } from '../app.js';

function businessOverview(){const s=data.stats||{unbilled:0,outstanding:0,paid:0,unbilledCount:0,openCount:0,paidCount:0};const recent=data.workorders.slice(0,7);return head('Business overview','Your business at a glance','Work orders, approvals, warehouse exceptions, and estimated income.',`<button class="primary" data-open="workorder">+ New Work Order</button><button class="secondary" data-open="other-time">+ Shop time or leave</button>`)+`<div class="cards">${!can('finance.view')?`${card('Assigned work orders',data.workorders.length,'Available jobs')}${card('Waiting on signoff',data.workorders.filter(w=>w.status==='awaiting-signoff').length,'Do not start yet')}${card('Warehouse shortages',data.inventory.filter(x=>x.quantity<0).length,'Audit exceptions')}`:`${card('Completed • not invoiced',fmt(s.unbilled),`${s.unbilledCount} closeouts`,'orange')}${card('Invoiced • outstanding',fmt(s.outstanding),`${s.openCount} invoices`)}${card('Confirmed paid',fmt(s.paid),`${s.paidCount} invoices`,'green')}${card('Negative stock lines',data.inventory.filter(x=>x.quantity<0).length,'Audit required')}`}</div><div class="two-panel"><section class="panel"><div class="flex"><h2>Recent work orders</h2><button class="secondary small" data-nav="workorders">See all</button></div>${table(['Work order','Customer / project','Status'],recent.map(w=>`<tr><td><button class="rowlink" data-wo="${w.id}">${esc(w.title)}</button></td><td>${esc(labelFor(w))}</td><td>${status(w.status)}</td></tr>`))}</section><section class="panel"><h2>Needs attention</h2><div class="stack">${data.workorders.filter(w=>w.status==='awaiting-signoff').length?`<div class="notice">${data.workorders.filter(w=>w.status==='awaiting-signoff').length} work orders waiting for initial signoff</div>`:''}${data.workorders.reduce((s,w)=>s+w.changes.filter(c=>c.status==='awaiting-signoff').length,0)?`<div class="notice">${data.workorders.reduce((s,w)=>s+w.changes.filter(c=>c.status==='awaiting-signoff').length,0)} change orders awaiting signature</div>`:''}${data.inventory.filter(x=>x.quantity<0).map(x=>`<div class="notice">${esc(catalog(x.catalogId)?.name)}: ${x.quantity} at ${esc(x.location)}</div>`).join('')||'<div class="notice green">No warehouse shortages in the sample data.</div>'}</div></section></div>`;}


export function dashboard(){
 const tickets=data.ticketOverview?.tickets||[];
 const orders=data.workorders||[];
 const workLink=order=>`<p><button class="rowlink" data-wo="${esc(order.id)}">${esc(order.title)}</button></p>`;
 const section=(title,rows)=>`<section class="panel"><h2>${title}</h2>${rows.slice(0,6).map(workLink).join('')||'<p>No work waiting.</p>'}</section>`;
 const assigned=tickets.filter(ticket=>ticket.assignee===me.email&&ticket.status!=='Completed');
 const overdue=tickets.filter(ticket=>ticket.status!=='Completed'&&ticket.due&&ticket.due<today());
 const link=(label,count,url)=>`<p><a href="${url}">${label} · ${count}</a></p>`;
 const office=can('workorder.review')||can('invoice.group');
 return head('Home','Work queue',office?'Review jobs and keep billing moving.':'Pick up your next task.')+
  '<div class="two-panel">'+
  (office?section('Work orders awaiting review',orders.filter(order=>order.status==='ready-for-review'))+
    section('Reviewed and ready to invoice',orders.filter(order=>order.closeout?.reviewedAt&&!order.invoice))+
    (can('finance.view')?section('Invoices awaiting payment',orders.filter(order=>order.invoice&&order.invoice.status!=='paid')):''):
    (me.clock?section('Active timer',orders.filter(order=>order.id===me.clock.workorderId)):'')+
    (can('workorders.view')?section('Open work orders',orders.filter(order=>order.status==='released')):''))+
  (can('tickets.view')?`<section class="panel"><h2>Tickets</h2>${link('Assigned to me',assigned.length,'/?tickets=mine')}${link('Overdue',overdue.length,'/?tickets=overdue')}</section>`:'')+
  '</div><details class="panel"><summary>Business overview</summary>'+businessOverview()+'</details>';
}
