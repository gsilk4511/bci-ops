import {entryCharge} from './work-entry-charge.js';
import {readyForProgress} from './project-billing.js';
import {data,can,esc,fmt,head,table,bill,project,projectLabel,customer,billingName,openProjectInvoice,printDocument,invoiceDocument,modal,f,send} from '../app.js';

function recordedInvoices(){
 const groups=new Map();
 for(const order of data.workorders.filter(order=>order.invoice&&!order.billingHidden)){
  const key=order.invoice.groupId||order.id;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(order);
 }
 return [...groups.values()].map(orders=>{
  const first=orders[0],projectRecord=project(first.projectId),payer=customer(projectRecord?.customerId);
  const snapshot=(data.projectInvoices||[]).find(invoice=>invoice.id===first.invoice.groupId);
  const invoice=snapshot||{number:first.invoice.number,sentAt:first.invoice.sentAt,
   customer:billingName(payer),address:payer?.address,project:projectRecord?.name,projectNumber:projectRecord?.number,po:projectRecord?.po,
   layout:'totals',orders:orders.map(order=>({title:order.title,entries:order.entries,crew:[]}))};
  const total=invoice.orders.flatMap(order=>order.entries).reduce((sum,entry)=>sum+entryCharge(entry),0);
  const paid=orders.reduce((sum,order)=>sum+(order.invoice.amountPaid||0),0);
  return {first:orders.find(w=>w.invoice.status!=='paid')||first,invoice,total:Math.max(0,total-(invoice.depositCredit||0)),paid};
 }).sort((a,b)=>String(b.invoice.sentAt||'').localeCompare(String(a.invoice.sentAt||'')));
}
const control=(action,id,label)=>`<button class="secondary small" data-invoice-action="${action}" data-order="${esc(id)}">${label}</button>`;

export function invoicesPage(){
 const ready=data.workorders.filter(order=>readyForProgress(project(order.projectId),order));
 const rows=recordedInvoices();
 return head('Invoices','Billing','Prepare invoice detail, track QuickBooks references, and record payments.')+
  '<section class="panel"><h2>Ready to invoice</h2>'+table(['Project','Reviewed work order','Amount',''],ready.map(order=>{
   const parent=project(order.projectId);
   return `<tr><td>${esc(projectLabel(parent))}</td><td>${esc(order.title)}</td><td>${fmt(bill(order).total)}</td><td>${can('invoice.group')?control('create',order.id,'Create invoice'):''}</td></tr>`;
  }))+'</section><section class="panel"><h2>Recorded invoices</h2>'+
  table(['QuickBooks #','Billing client','Total','Paid','Balance',''],rows.map(({first,invoice,total,paid})=>
   `<tr><td>${esc(invoice.number)}</td><td>${esc(invoice.customer)}</td><td>${fmt(total)}</td><td>${fmt(paid)}</td><td>${fmt(Math.max(0,total-paid))}</td>
   <td>${control('print',first.id,'Preview / Print PDF')}${can('invoice.pay')&&first.invoice.status!=='paid'?control('pay',first.id,'Record payment'):''}</td></tr>`))+'</section>';
}

document.addEventListener('click',event=>{
 const button=event.target.closest('[data-invoice-action]');
 if(!button||!can('invoices.view')||!can('finance.view')||!can('workorders.view'))return;
 const order=data.workorders.find(item=>item.id===button.dataset.order);
 if(!order)return;
 if(button.dataset.invoiceAction==='create'&&can('invoice.group'))return openProjectInvoice(order);
 const row=recordedInvoices().find(item=>item.first.id===order.id);
 if(!row)return;
 if(button.dataset.invoiceAction==='print')return printDocument(invoiceDocument(row.invoice));
 if(button.dataset.invoiceAction==='pay'&&can('invoice.pay'))return modal('Record QuickBooks payment',
  f('amount','Amount received',{type:'number',step:'0.01',min:0.01,required:true,value:Math.max(0,row.total-row.paid).toFixed(2)}),
  values=>send('invoice.pay',{...values,workorderId:order.id}));
});
