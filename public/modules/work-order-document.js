import {bill,billingName,contactLine,customer,esc,fmt,jobContact,project,projectLabel,roundMoney,table} from '../app.js';

const dateTime=value=>value?new Intl.DateTimeFormat('en-US',{
 dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'
}).format(new Date(value)):'';
const hours = new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const printQty = entry => Number.isFinite(entry.quantity) && /^(hr|hours?)$/i.test(entry.unit ?? '')
 ? hours.format(entry.quantity) : entry.quantity;
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
 <div class="work-order-print-header"><div class="invoice-brand"><img src="/logo.png" alt="BCI ELITE" width="82" height="82"><div><strong>BCI <span>ELITE</span></strong>
 <small>BEVINS CABLE INTEGRATIONS LLC</small></div></div>
 <h1>WORK ORDER</h1><p><b>${esc(order.title)}</b> · ${esc(order.status.replaceAll('-',' '))}</p><div class="invoice-accent"></div></div>
 <div class="invoice-info"><section><h2>BILLING CLIENT</h2><b>${esc(billingName(payer))}</b>
 <p class="invoice-address">${esc(payer?.address)}</p></section>
 <section><h2>JOB DETAILS</h2><dl><dt>Project</dt><dd>${esc(projectLabel(parent))}</dd>
 <dt>Jobsite</dt><dd>${esc(parent?.site||'—')}</dd><dt>Job contact</dt><dd>${contactLine(jobContact(parent))||'—'}</dd>
 <dt>Client PO</dt><dd>${esc(parent?.po||'—')}</dd></dl></section></div>
 <section class="invoice-detail-block work-order-print-scope"><h2>ORIGINAL SCOPE</h2><p class="ticket-text">${esc(signoff?.scope||order.description)}</p>
 <p><b>${approval(signoff?.signedBy,signoff?.at)}</b></p>
 ${/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signoff?.signatureData||'')?`<img class="signed-image" src="${esc(signoff.signatureData)}" alt="Original scope signature">`:''}
 ${signoff?.signerIdentityUnverified?'<p>Drawn signature captured. Signer identity was not independently verified.</p>':''}
 </section>
 ${changes.length?'<section class="invoice-detail-block"><h2>CHANGE ORDERS</h2>'+changes.map(change=>`<div class="print-change"><b>${esc(change.category?.toUpperCase())} · ${esc(change.approvedSnapshot?.description||change.description)}</b>
 <p>${(change.approvedSnapshot?.lines||change.lines||[]).map(line=>esc(line.quantity)+' × '+esc(line.name)).join('<br>')}</p>
 <p>${fmt(change.approvedSnapshot?.estimate??change.estimatedTotal)} T&amp;M estimate · ${change.status==='approved'&&!change.signedBy?'Approved · signer not recorded':approval(change.signedBy,change.signedAt)}</p></div>`).join('')+'</section>':''}
 <section class="invoice-detail-block work-order-print-journal"><h2>ORIGINAL FIELD JOURNAL</h2>
 <div class="tablewrap"><table>
 <colgroup><col class="journal-date-tech"><col class="journal-qty"><col class="journal-charge"></colgroup>
 <thead><tr><th scope="col">Date / Tech</th><th scope="col">Qty / Hours</th><th scope="col">Charge</th></tr></thead>
 ${entries.length?entries.map(entry=>`<tbody class="work-order-journal-entry">
 <tr class="work-order-journal-meta"><td><span class="journal-date">${esc(entry.date)}</span> <span class="journal-tech">${esc(entry.tech)}</span></td>
 <td>${esc(printQty(entry))} ${esc(entry.unit)}</td><td>${fmt(roundMoney(entry.quantity*entry.rate))}</td></tr>
 <tr class="work-order-journal-work"><td colspan="3"><b>${esc(entry.name)}</b>${entry.description?`<div class="ticket-text">${esc(entry.description)}</div>`:''}</td></tr>
 </tbody>`).join(''):'<tbody><tr><td colspan="3">No records found</td></tr></tbody>'}
 </table></div>
 ${original?`<p>Submitted by ${esc(original.submittedBy)} · ${esc(dateTime(original.at))}</p>
 ${original.reviewedAt?`<p>Reviewed by ${esc(original.reviewedBy||'Office')} · ${esc(dateTime(original.reviewedAt))}</p>`:''}`:''}</section>
 <div class="work-order-print-end"><section class="invoice-summary"><h2>BILLING SUMMARY</h2>${table(['Description','Amount'],[
 ['Time / Labor',amounts.labor],['Materials',amounts.material],['Travel',amounts.travel],['Total',amounts.total]
 ].map(([label,amount])=>`<tr><td>${label}</td><td>${fmt(amount)}</td></tr>`))}</section>
 <footer class="invoice-footer"><b>BCI ELITE</b><span>Work order and field journal</span></footer></div></article>`;
}
