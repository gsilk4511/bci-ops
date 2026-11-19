import {bill,billingName,can,card,contactLine,customer,data,esc,f,fmt,head,modal,openProjectInvoice,printDocument,invoiceDocument,projectLabel,send,table} from '../app.js';
const internal=(p,w)=>w?.internalTask||p?.name?.trim().toLowerCase()==='bci elite admin'&&[customer(p.customerId)?.name,customer(p.customerId)?.business].some(n=>n?.trim().toLowerCase()==='randy bevins');
const projectRows=p=>data.workorders.filter(w=>w.projectId===p.id&&!internal(p,w));
export const readyForProgress=(p,w)=>!!w.closeout?.reviewedAt&&!w.invoice&&!internal(p,w);
const sum=(rows,get)=>rows.reduce((s,row)=>s+get(row),0);
export function projectBilling(p){
 if(!can('finance.view')||!can('invoices.view')||!can('workorders.view')||internal(p))return '';
 const orders=projectRows(p),ledger=p.depositLedger||[],total=kind=>sum(ledger.filter(e=>e.kind===kind),e=>e.amount),ready=orders.filter(w=>readyForProgress(p,w));
 const finalReady=!p.billingScopeLimited&&!!p.closedAt&&orders.every(w=>w.invoice||w.closeout?.reviewedAt)&&!data.workorders.some(w=>w.projectId===p.id&&w.requiredForFinalBilling&&!w.closeout?.reviewedAt);
 const history=new Map();
 for(const w of orders.filter(w=>w.invoice&&!w.billingHidden)){
  const no=w.invoice.number;
  const row=history.get(no)||{id:w.invoice.groupId,orders:[],total:0,paid:0,sentAt:w.invoice.sentAt};
  row.orders.push(w.title);row.total+=bill(w).total;row.paid+=w.invoice.amountPaid||0;history.set(no,row);
 }
 const btn=(mode,w,label)=>`<button class="secondary" data-billing-mode="${mode}" data-bill-order="${esc(w.id)}">${label}</button>`;
 return `<section class="panel"><h2>Project Billing</h2>${p.billingScopeLimited?'<p>Some project billing records are outside your access scope.</p>':`<div class="cards">${card('Deposit requested',fmt(total('requested')))}${card('Received',fmt(total('received')))}${card('Applied',fmt(total('applied')))}${card('Unapplied',fmt(total('received')-total('applied')))}</div>`}
 ${can('billing.deposit')&&!p.billingScopeLimited?`<button class="secondary" data-project-flow="deposit" data-flow-id="${esc(p.id)}">Record deposit</button>`:''}
 ${ready.length&&can('invoice.group')?(!p.closedAt?btn('progress',ready[0],'Prepare progress invoice'):finalReady?btn('final',ready[0],'Prepare final invoice'):''):''}
 ${p.closedAt&&!finalReady&&!p.billingScopeLimited?'<p>Final billing is waiting for remaining work orders or closeout to be reviewed.</p>':''}
 <h3>Reviewed and ready to bill</h3>${table(['Work order','Amount'],ready.map(w=>`<tr><td><button class="rowlink" data-wo="${esc(w.id)}">${esc(w.title)}</button></td><td>${fmt(bill(w).total)}</td></tr>`))}
 <h3>QuickBooks history</h3>${table(['Reference','Date','Work orders','Net invoice','Paid'],[...history].map(([number,row])=>`<tr><td>${row.id?`<button class="rowlink" data-project-invoice-print="${esc(row.id)}">${esc(number)}</button>`:esc(number)}</td><td>${esc(row.sentAt?.slice(0,10)||'')}</td><td>${row.orders.map(esc).join('<br>')}</td><td>${fmt(row.total)}</td><td>${fmt(row.paid)}</td></tr>`))}
 ${ledger.length?'<h3>Deposit history</h3>'+table(['Date','Type','Reference','Amount'],ledger.map(e=>`<tr><td>${esc(e.at.slice(0,10))}</td><td>${esc(e.kind)}</td><td>${esc(e.reference)}</td><td>${fmt(e.amount)}</td></tr>`)):''}</section>`;
}
export function clientPortal(c){
 const projects=data.projects.filter(p=>p.customerId===c.id),visible=can('projects.view')?projects:[];
 const primary=new Set(projects.map(p=>p.contactId).filter(Boolean));
 const rows=projects.flatMap(projectRows);
 const billed=rows.filter(w=>w.invoice&&!w.billingHidden),ready=rows.filter(w=>w.closeout?.reviewedAt&&!w.invoice);
 const deps=sum(projects,p=>sum((p.depositLedger||[]).filter(e=>e.kind==='received'),e=>e.amount));
 const estimates=(data.estimates||[]).filter(e=>(e.clientId||e.customerId)===c.id||projects.some(p=>p.id===e.projectId));
 return head(billingName(c),'Client Portal','Contacts, projects and billing','<button class="secondary" data-nav="customers">All clients</button>')+
 `<section class="panel"><h2>Contact and billing information</h2><p>${[c.name,c.address,c.phone,c.email,c.financeEmail].filter(Boolean).map(esc).join('<br>')}</p>
 <h3>Contacts</h3>${table(['Contact','Role'],(c.contacts||[]).map(person=>`<tr><td>${contactLine(person)}</td><td>${primary.has(person.id)?'Project primary contact':'Contact'}</td></tr>`))}</section>`+
 (can('finance.view')&&can('money.view')?`<div class="cards">${card('Payments received',fmt(deps+sum(billed,w=>w.invoice.amountPaid||0)))}${card('Outstanding',fmt(sum(billed,w=>Math.max(0,bill(w).total-(w.invoice.amountPaid||0)))))}${card('Ready to bill',fmt(sum(ready,w=>bill(w).total)))}</div>`:'')+
 (can('projects.view')?`<section class="panel"><h2>Projects</h2>${table(['Project','Status','Primary contact'],visible.map(p=>`<tr><td><button class="rowlink" data-project="${esc(p.id)}">${esc(projectLabel(p))}</button></td><td>${p.closedAt?'Closed':'Open'}</td><td>${contactLine((c.contacts||[]).find(x=>x.id===p.contactId))}</td></tr>`))}</section>`:'')+
 (can('estimates.view')?`<section class="panel"><h2>Estimates</h2>${table(['Estimate','Status'],estimates.map(e=>`<tr><td><button class="rowlink" data-estimate-action="print" data-estimate-id="${esc(e.id)}">${esc(e.number||e.title)}</button></td><td>${esc(e.status)}</td></tr>`))}</section>`:'');
}
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-project-flow],[data-billing-mode],[data-project-invoice-print]');
 if(!b)return;
 if(b.dataset.billingMode&&can('projects.view')&&can('invoices.view')&&can('invoice.group')){
  const w=data.workorders.find(w=>w.id===b.dataset.billOrder);if(w)openProjectInvoice(w,b.dataset.billingMode);return;
 }
 if(b.dataset.projectInvoicePrint&&can('invoices.view')&&can('finance.view')){
  const i=(data.projectInvoices||[]).find(i=>i.id===b.dataset.projectInvoicePrint);if(i)printDocument(invoiceDocument(i));return;
 }
 if(!can('projects.view'))return;
 const p=data.projects.find(p=>p.id===b.dataset.flowId);
 if(!p)return;
 const post=(action,values)=>send(action,{...values,projectId:p.id});
 if(b.dataset.projectFlow==='close'&&can('project.close'))modal('Close Project','<p>This removes it from the open Projects queue. It does not send an invoice. Creating a work order will reopen it.</p>',v=>post('project.close',v));
 if(b.dataset.projectFlow==='followup'&&can('project.followup'))modal('Project follow-up',f('nextStep','Next step / blocker',{textarea:true,value:p.nextStep})+f('followUpDue','Follow-up due',{type:'date',value:p.followUpDue}),v=>post('project.followup',v));
 if(b.dataset.projectFlow==='deposit'&&can('billing.deposit'))modal('Record a project deposit',f('kind','Type',{select:[['requested','Requested'],['received','Received']]})+f('amount','Amount',{type:'number',min:.01,step:.01,required:true})+f('reference','QuickBooks or payment reference',{required:true}),v=>post('billing.deposit',v));
});
