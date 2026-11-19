import {bill,billingName,can,contactLine,customer,esc,fmt,jobContact,project,projectLabel,roundMoney,table} from '../app.js';

const dateTime=value=>value?new Intl.DateTimeFormat('en-US',{
 dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'
}).format(new Date(value)):'';
const approval=(name,at)=>name?'Approved by '+esc(name)+(at?' · '+esc(dateTime(at)):''):'Awaiting approval';

export function workOrderDocument(order){
 const parent=project(order.projectId);
 const payer=customer(parent?.customerId);
 const original=order.closeout;
 const entries=original?.originalEntries||order.entries;
 const changes=original?.originalChanges||order.changes;
 const signoff=original?.originalApproval||order.approval;
 const amounts=bill({...order,entries});
 return `<article class="invoice-sheet work-order-sheet">
 <div class="invoice-brand"><img src="/logo.png" alt="BCI ELITE" width="82" height="82"><div><strong>BCI <span>ELITE</span></strong>
 <small>BEVINS CABLE INTEGRATIONS LLC</small></div></div>
 <h1>WORK ORDER</h1><p><b>${esc(order.title)}</b> · ${esc(order.status.replaceAll('-',' '))}</p><div class="invoice-accent"></div>
 <div class="invoice-info"><section><h2>BILLING CLIENT</h2><b>${esc(billingName(payer))}</b>
 <p class="invoice-address">${esc(payer?.address)}</p></section>
 <section><h2>JOB DETAILS</h2><dl><dt>Project</dt><dd>${esc(projectLabel(parent))}</dd>
 <dt>Jobsite</dt><dd>${esc(parent?.site||'—')}</dd><dt>Job contact</dt><dd>${contactLine(jobContact(parent))||'—'}</dd>
 <dt>Client PO</dt><dd>${esc(parent?.po||'—')}</dd></dl></section></div>
 <section class="invoice-detail-block"><h2>ORIGINAL SCOPE</h2><p class="ticket-text">${esc(signoff?.scope||order.description)}</p>
 <p><b>${approval(signoff?.signedBy,signoff?.at)}</b></p>
 ${/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signoff?.signatureData||'')?`<img class="signed-image" src="${esc(signoff.signatureData)}" alt="Original scope signature">`:''}
 ${signoff?.signerIdentityUnverified?'<p>Drawn signature captured. Signer identity was not independently verified.</p>':''}
 ${changes.length?'<h2>CHANGE ORDERS</h2>'+changes.map(change=>`<div class="print-change"><b>${esc(change.category?.toUpperCase())} · ${esc(change.approvedSnapshot?.description||change.description)}</b>
 <p>${(change.approvedSnapshot?.lines||change.lines||[]).map(line=>esc(line.quantity)+' × '+esc(line.name)).join('<br>')}</p>
 <p>${fmt(change.approvedSnapshot?.estimate??change.estimatedTotal)} T&amp;M estimate · ${change.status==='approved'&&!change.signedBy?'Approved · signer not recorded':approval(change.signedBy,change.signedAt)}</p></div>`).join(''):''}
 <h2>ORIGINAL FIELD JOURNAL</h2>
 ${table(['Date / Technician','Work','Quantity','Charge'],entries.map(entry=>`<tr><td>${esc(entry.date)}<br>${esc(entry.tech)}</td>
 <td><b>${esc(entry.name)}</b><div class="ticket-text">${esc(entry.description)}</div></td><td>${esc(entry.quantity)} ${esc(entry.unit)}</td><td>${fmt(roundMoney(entry.quantity*entry.rate))}</td></tr>`))}
 ${original?`<p>Submitted by ${esc(original.submittedBy)} · ${esc(dateTime(original.at))}</p>
 ${original.reviewedAt?`<p>Reviewed by ${esc(original.reviewedBy||'Office')} · ${esc(dateTime(original.reviewedAt))}</p>`:''}`:''}</section>
 <section class="invoice-summary"><h2>BILLING SUMMARY</h2>${table(['Description','Amount'],[
 ['Time / Labor',amounts.labor],['Materials',amounts.material],['Travel',amounts.travel],['Total',amounts.total],
 ...(can('finance.view')?[['Direct job cost',amounts.cost],['Estimated gross profit',amounts.profit]]:[])
 ].map(([label,amount])=>`<tr><td>${label}</td><td>${fmt(amount)}</td></tr>`))}</section>
 <footer class="invoice-footer"><b>BCI ELITE</b><span>Work order and field journal</span></footer></article>`;
}
