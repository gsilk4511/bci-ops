import {entryCharge,isTripCharge} from './work-entry-charge.js';
import {delegatedTimeButton} from './delegated-time.js';
import {scheduleButton} from './calendar.js';
import {workOrderTechnicianIcon} from './work-order-technician-icon.js';
import {canEditJournalNote,workEntryControls,editOrderButton,receiptPanel} from './work-entry.js';
import {workorderDeleteButton} from './records.js';
import {fieldJournal} from './field-journal.js';
// Owns the work order detail presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { bill, billingName, can, clockPanel, contactLine, customer, customerLaborSummary, empty, esc, fmt, jobContact, me, project, projectLabel, status } from '../app.js';

const journalHours = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
function journalEntries(order) {
 return fieldJournal(order.entries,me?.email,(entry,owned,hidden) => {
  const qty = Number.isFinite(entry.quantity) && /^(hr|hours?)$/i.test(entry.unit ?? '')
   ? journalHours.format(entry.quantity) : entry.quantity;
  const note = entry.journalNote ?? entry.description;
  return `<li class="field-journal-entry" data-journal-owned="${owned}"${hidden?' hidden':''}>
   <dl class="field-journal-meta">
    <div><dt>Date / tech</dt><dd>${esc(entry.date)} <span class="muted"><span class="work-order-tech-identity">${workOrderTechnicianIcon(entry.technicianIcon,esc)}<span>${esc(entry.tech)}</span></span></span></dd></div>
    <div><dt>Qty</dt><dd>${esc(qty)} ${esc(entry.unit)}</dd></div>
    <div><dt>Charge</dt><dd>${fmt(entryCharge(entry))}${entry.sharedTravel?' <small>Shared travel</small>':isTripCharge(entry)?' <small>Base trip</small>':''}</dd></div>
   </dl>
   <div class="field-journal-work">${esc(entry.name)}</div>
   ${note ? `<div class="ticket-text field-journal-note">${esc(note)}</div>` : ''}
   ${canEditJournalNote(order,entry)?`<button class="secondary small no-print" data-open="entry-note" data-entry-id="${esc(entry.id)}">Edit notes</button>`:''}
   ${workEntryControls(order,entry)}
  </li>`;
 },empty);
}

function orderActions(order){
 const actions=[
  '<button type="button" class="secondary small" data-open="workorder-print">Print work order</button>',
  editOrderButton(order),
  can('pricing.profile.assign')&&!order.closeout&&!order.invoice?`<button type="button" class="secondary small" data-assign-price="workorder" data-target="${esc(order.id)}">Assign pricing</button>`:'',
  can('pricing.workorder.correct')?`<button type="button" class="secondary small" data-assign-price="correct" data-target="${esc(order.id)}">Correct pricing</button>`:''
 ].filter(Boolean).join('');
 const remove=workorderDeleteButton(order);
 return `<div class="workorder-action-menu no-print">
  <button type="button" class="secondary small" data-workorder-actions aria-expanded="false" aria-controls="workorderActionsPanel">Actions <span aria-hidden="true">▾</span></button>
  <div id="workorderActionsPanel" class="workorder-action-panel" hidden>${actions}${remove?`<div class="workorder-action-danger">${remove}</div>`:''}</div>
 </div>`;
}

export function detail(w){const p=project(w.projectId),c=customer(p?.customerId),b=bill(w);return `<div class="pagehead workorder-detail-head"><div><div class="eyebrow"><button class="rowlink" data-nav="workorders">← Work orders</button> / ${p?`<button class="rowlink" data-project="${esc(p.id)}">${esc(projectLabel(p))}</button>`:esc(w.id)}</div><div class="detail-title">${esc(w.title)}</div><div class="muted">${esc(billingName(c))} • ${esc(projectLabel(p))} • ${esc(p?.site)}</div></div><div class="gap">${status(w.status)}${scheduleButton('workorder',w.id)}${orderActions(w)}</div></div><div class="brandline"></div><section class="panel"><b>Primary contact</b> · ${contactLine(jobContact(p))||contactLine({name:c?.contact||c?.name,phone:c?.phone,email:c?.email})||'Unassigned'} ${p?`<button class="rowlink" data-project="${esc(p.id)}">Open project</button>`:''}</section>${w.correctionRequest?'<div class="notice">Corrections requested · '+esc(w.correctionRequest.note)+'</div>':''}${clockPanel(w)}<div class="two-panel"><div><section class="panel"><h2>Approved scope</h2><p>${esc(w.description)}</p>${w.approval?`<div class="notice green">Signed by: ${esc(w.approval.signedBy)} • ${new Date(w.approval.at).toLocaleString()}<div class="tiny">Drawn signature captured; signer identity not independently verified.</div>${w.approval.signatureData?`<img class="signed-image" src="${esc(w.approval.signatureData)}" alt="Original scope signature">`:''}</div>`:`<div class="notice">No customer signoff yet. The job is locked against work entries.</div>`}<div class="actions">${!w.approvedAt&&can('workorder.approve')?`<button class="primary" data-open="approve">Approve Original Scope</button>`:''}${w.approvedAt&&!w.closeout&&can('change.create')?`<button class="primary" data-open="change">+ Change Order</button>`:''}</div></section><section class="panel"><div class="flex"><h2>Change orders</h2><span class="tag">${w.changes.length} total</span></div>${w.changes.map(co=>`<div class="list-item"><div><b>${esc(co.category.toUpperCase())} • ${esc(co.description)}</b><div class="muted tiny">${co.lines.map(l=>`${l.quantity} × ${l.name}`).join(', ')}</div><div>${fmt(co.estimatedTotal)} T&M estimate • ${status(co.status)}</div>${co.signedBy?`<p>Approved by ${esc(co.signedBy)}${co.signedAt?' · '+esc(new Date(co.signedAt).toLocaleString('en-US',{timeZone:'America/New_York'})):''}</p>`:''}</div>${co.status==='awaiting-signoff'&&can('change.approve')?`<button class="primary small" data-change="${esc(co.id)}">Approve</button>`:co.signatureData?`<img class="signed-image" src="${esc(co.signatureData)}" alt="Signed change order">`:''}</div>`).join('')||empty('No change orders yet')}</section><section class="panel"><div class="flex"><h2>Original field journal</h2><span class="tag">${w.entries.length} entries</span></div>${journalEntries(w)}${w.closeout?`<div class="notice green">Immutable closeout snapshot captured ${new Date(w.closeout.at).toLocaleString()} by ${esc(w.closeout.submittedBy)}.</div>`:''}${w.approvedAt&&!w.closeout&&!w.invoice?`<div class="actions">${can('entry.add')?'<button class="primary" data-open="log-time">+ Log Time</button><button class="secondary" data-open="log-materials">+ Log Materials</button>':''}${delegatedTimeButton(w)}${can('workorder.close')?'<button class="green" data-open="close">Submit Completed Work Order</button>':''}</div>`:''}</section></div><div>${receiptPanel(w)}<section class="panel"><h2>Billing summary</h2><div class="list-item"><b>Time</b><b>${fmt(b.labor)}</b></div><div class="list-item"><b>Materials</b><b>${fmt(b.material)}</b></div><div class="list-item"><b>Travel</b><b>${fmt(b.travel)}</b></div><div class="list-item"><b>Total</b><b class="lineTotal">${fmt(b.total)}</b></div>${can('finance.view')?`<div class="list-item work-order-internal-financial"><span>Direct job cost</span><b>${fmt(b.cost)}</b></div><div class="list-item work-order-internal-financial"><b>Estimated gross profit</b><b>${fmt(b.profit)}</b></div>`:''}${w.billingHidden?'<p>Invoice details are outside your access scope.</p>':w.invoice?`<div class="notice green">QuickBooks #${esc(w.invoice.number)} • ${status(w.invoice.status)} • paid ${fmt(w.invoice.amountPaid)}</div>`:''}<div class="actions">${w.closeout&&!w.closeout.reviewedAt&&can('workorder.review')?`<button class="green" data-open="review">Mark Closeout Reviewed</button>`:''}${w.closeout?.reviewedAt&&!w.invoice&&(can('invoice.record')||can('invoice.group'))?`<button class="primary" data-open="invoice">Record QuickBooks Invoice</button><button class="primary" data-open="project-invoice">Create project invoice</button>`:''}${w.invoice&&!w.billingHidden&&w.invoice.status!=='paid'&&can('invoice.pay')?`<button class="green" data-open="payment">Record Payment</button>`:''}${can('invoices.view')&&can('finance.view')&&!w.billingHidden?(w.invoice?.groupId?'<button class="secondary" data-open="project-invoice-print">Print project invoice / PDF</button>':'<button class="secondary" data-open="legacy-print">Print detailed invoice / PDF</button>'):''}</div><p class="muted tiny">QuickBooks manual entry: Time, Materials, Travel. Attach this PDF. See attached BCI invoice for detail.</p></section><section class="panel"><h2>Customer-facing labor summary</h2>${customerLaborSummary(w)}<p class="tiny muted">Original dated technician journal remains above and in the submitted closeout snapshot.</p></section><section class="panel"><h2>Job details</h2><p><b>Customer:</b> ${esc(billingName(c))}<br><b>Billing contact:</b> ${esc(c?.contact||c?.name||'—')}<br><b>Job contact:</b> ${contactLine(jobContact(p))||'Billing client leads'}<br><b>Site:</b> ${esc(p?.site)}<br><b>PO:</b> ${esc(p?.po||'—')}</p></section></div></div><div class="print-only"><h2>Invoice detail — ${esc(w.title)}</h2><p>BCI ELITE | Customer: ${esc(billingName(c))} | Jobsite: ${esc(p?.site)} | Project: ${esc(projectLabel(p))}${p?.po?' | Client PO: '+esc(p.po):''}<br>Time ${fmt(b.labor)} • Materials ${fmt(b.material)} • Travel ${fmt(b.travel)} • Total ${fmt(b.total)}</p><p>See original work journal and change approvals above. This is a PILOT document, not a tax invoice.</p></div>`;}

