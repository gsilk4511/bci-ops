// Owns the invoice document presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { customer, detail, esc, fmt, hoursLabel, project, roundMoney, table } from '../app.js';

export function invoiceDocument(invoice){
 const entries=invoice.orders.flatMap(order=>order.entries);
 const totals={labor:0,material:0,travel:0};
 for(const e of entries)totals[e.type]+=roundMoney(e.quantity*e.rate);
 const itemized=type=>table(['Description','Quantity','Rate','Amount'],entries.filter(e=>!type||e.type===type).map(e=>
  `<tr><td><b>${esc(e.name)}</b>${e.description?`<div class="ticket-text">${esc(e.description)}</div>`:''}</td><td>${Number(e.quantity.toFixed(2))} ${esc(e.unit)}</td>
  <td>${fmt(e.rate)}</td><td>${fmt(roundMoney(e.quantity*e.rate))}</td></tr>`));
 const crew=invoice.orders.flatMap(order=>order.crew.map(row=>
  `<tr><td>${esc(order.title)}</td><td>${esc(row.date)}</td><td>${esc(order.entries.find(e=>e.catalogId===row.catalogId)?.name||'Labor')}</td>
  <td>${row.crewSize}-person crew</td><td>${hoursLabel(row.crewHours)}</td></tr>`));
 const untimed=entries.filter(e=>e.type==='labor'&&(!e.startTime||!e.endTime));
 const dates=entries.map(e=>e.date).filter(Boolean).sort();
 const serviceDates=dates.length?(dates[0]===dates.at(-1)?dates[0]:dates[0]+' – '+dates.at(-1)):'—';
 return `<article class="invoice-sheet"><div class="invoice-brand">
 <img src="/logo.png" alt="BCI ELITE logo" width="82" height="82"><div><strong>BCI <span>ELITE</span></strong>
 <small>BEVINS CABLE INTEGRATIONS LLC</small><small>Structured Cabling Specialist</small></div></div>
 <div class="print-document-heading"><h1>INVOICE DETAIL</h1><p><b>${invoice.number?'QuickBooks # '+esc(invoice.number):'Prepared for QuickBooks entry'}</b></p></div>
 <div class="invoice-accent"></div><div class="invoice-info"><section><h2>BILL TO</h2><b>${esc(invoice.customer)}</b><p class="invoice-address">${esc(invoice.address||'')}</p></section>
 <section><h2>PROJECT DETAILS</h2><dl><dt>Project</dt><dd>${esc([invoice.projectNumber,invoice.project].filter(Boolean).join(' · '))}</dd>
 <dt>Client PO</dt><dd>${esc(invoice.po||'—')}</dd><dt>Service dates</dt><dd>${esc(serviceDates)}</dd>
 ${invoice.sentAt?'<dt>Invoice recorded</dt><dd>'+esc(invoice.sentAt.slice(0,10))+'</dd>':''}</dl></section></div>
 <section class="invoice-summary"><h2>BILLING SUMMARY</h2>
 ${invoice.layout==='itemized'?itemized():`<table><thead><tr><th>Description</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
 <tr><td>Time / Labor</td><td>${hoursLabel(entries.filter(e=>e.type==='labor').reduce((sum,e)=>sum+e.quantity,0))} hr</td><td>—</td><td>${fmt(totals.labor)}</td></tr>
 <tr><td>Materials</td><td>—</td><td>—</td><td>${fmt(totals.material)}</td></tr>
 <tr><td>Travel</td><td>—</td><td>—</td><td>${fmt(totals.travel)}</td></tr></tbody></table>`}
  ${invoice.depositCredit?`<p>Deposit applied: ${fmt(invoice.depositCredit)}</p>`:''}
 <div class="print-total"><span>Total</span><strong>${fmt(roundMoney(totals.labor+totals.material+totals.travel-(invoice.depositCredit||0)))}</strong></div>
 ${invoice.layout==='itemized'?`<p>QuickBooks summary · Labor ${fmt(totals.labor)} · Materials ${fmt(totals.material)} · Travel ${fmt(totals.travel)}</p>`:''}</section>
 <p class="invoice-references">Work order reference · ${invoice.orders.map(order=>esc(order.title)).join(', ')}</p>
 <section class="invoice-detail-block">
  ${invoice.layout==='itemized'?'':invoice.layout.startsWith('crew')?
    '<h2>Crew time</h2>'+table(['Work order','Date','Labor type','Crew','Hours'],crew)+
    (untimed.length?`<p>Labor without timestamps · ${hoursLabel(untimed.reduce((sum,e)=>sum+e.quantity,0))} individual hours</p>`:''):
    `<p>Labor · ${hoursLabel(entries.filter(e=>e.type==='labor').reduce((sum,e)=>sum+e.quantity,0))} individual hours</p>`}
  ${invoice.layout==='crew-materials'?'<h2>Materials detail</h2>'+itemized('material'):''}
 </section><footer class="invoice-footer"><b>BCI ELITE</b><span>Supporting invoice detail • Time, materials and travel</span>
 <p>Attach this document to the QuickBooks invoice. See attached invoice for detail.</p></footer></article>`;

}

