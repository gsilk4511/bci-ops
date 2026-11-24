import {can,data,esc,f,modal,send,today} from '../app.js';

const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const days=(later,earlier)=>{
 if(!datePattern.test(later||'')||!datePattern.test(earlier||''))return null;
 const result=(Date.parse(later+'T00:00:00Z')-Date.parse(earlier+'T00:00:00Z'))/86400000;
 return Number.isFinite(result)?result:null;
};
const urgency=(due,date)=>{
 const diff=days(due,date);
 return diff===null?['none','Not scheduled']:diff<0?['overdue','Overdue']:diff===0?['due','Due today']:diff<=30?['soon','Due soon']:['later','Scheduled'];
};
const dateText=value=>value?esc(value):'Not set';
const sortByDue=(a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||a.name.localeCompare(b.name);
const money=value=>value!=null&&value!==''?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(Number(value)):'Not set';
const action=(key,label,id='')=>`<button type="button" class="secondary" data-manager-action="${key}" data-manager-id="${esc(id)}">${label}</button>`;
const badge=([kind,label])=>`<span class="bci-manager-status" data-kind="${kind}">${esc(label)}</span>`;
const line=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;

export function businessManagerPanel(board,manage){
 if(!board)return '';
 const date=board.today||today();
 const bills=board.bills||[];
 const open=bills.filter(row=>row.status==='open').sort(sortByDue);
 const paid=bills.filter(row=>row.status==='paid').sort((a,b)=>(b.paidDate||'').localeCompare(a.paidDate||'')||a.name.localeCompare(b.name));
 const due=[
  ...open.map(row=>({name:row.name,dueDate:row.dueDate})).filter(row=>row.dueDate)
 ].sort(sortByDue);
 const past=due.filter(row=>days(row.dueDate,date)<0), soon=due.filter(row=>['due','soon'].includes(urgency(row.dueDate,date)[0]));
 const next=due.find(row=>days(row.dueDate,date)>=0);
 const billCard=row=>`<article class="bci-manager-card"><h4>${esc(row.name)}</h4>
  <dl>${line('Vendor',esc(row.vendor||'Not set'))}${line('Due',dateText(row.dueDate))}${line('Amount',money(row.amount))}
  ${row.paidDate?line('Recorded paid',dateText(row.paidDate)):''}</dl>
  ${row.status==='paid'?badge(['paid','Paid']):badge(urgency(row.dueDate,date))}
  ${row.notes?`<p class="bci-manager-notes">${esc(row.notes)}</p>`:''}
  ${manage&&row.status==='open'?`<div class="bci-manager-actions">${action('bill','Edit bill',row.id)}${action('paid','Record paid',row.id)}</div>`:''}</article>`;
 return `<section class="panel bci-manager" aria-labelledby="businessManagerHeading">
  <div class="bci-manager-section-head"><div><h2 id="businessManagerHeading">Business Manager</h2><p>Private bill tracker. Dates and payments are recorded here only; no payments or reminders are sent.</p></div>
  ${manage?'':'<p class="bci-manager-status" data-kind="none">Read only</p>'}</div>
  <dl class="bci-manager-summary">
   ${line('Overdue',String(past.length))}${line('Due in the next 30 days',String(soon.length))}
   ${line('Next due',next?`${esc(next.name)} · ${dateText(next.dueDate)}`:'Nothing scheduled')}
  </dl>
  <section aria-labelledby="managerBillsHeading"><div class="bci-manager-section-head"><h3 id="managerBillsHeading">Open bills</h3>${manage?action('bill','+ Add bill'):''}</div>
  ${open.length?`<div class="bci-manager-grid">${open.map(billCard).join('')}</div>`:'<p>No open bills.</p>'}
  ${paid.length?`<details><summary>Paid bills (${paid.length})</summary><div class="bci-manager-grid">${paid.map(billCard).join('')}</div></details>`:''}
  </section>
 </section>`;
}

const string=value=>value==null?'':String(value);
const dateField=(field,label,value,required=false)=>f(field,label,{type:'date',value:string(value),required});
const readOnlyNote=(row,text)=>`<p><strong>${esc(row.name)}</strong> · ${esc(text)}</p>`;

function openForm(title, fields, operation, id='', note=''){
 modal(title,fields,values=>send('businessManager.manage',{operation,...(id?{id}:{}),...values}),note);
 document.querySelector('#actionForm input, #actionForm textarea')?.focus();
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-manager-action]');
 const board=data.staff?.businessManager;
 if(!button||!board||!can('staff.view')||!can('businessManager.view')||!can('businessManager.manage'))return;
 const {managerAction:key,managerId:id}=button.dataset;
 const bill=(board.bills||[]).find(item=>item.id===id);
 const date=board.today||today();
 switch(key){
  case 'bill': {
   if(id&&(!bill||bill.status==='paid'))return;
   const row=bill||{};
   openForm(id?'Edit bill':'Add bill',f('name','Bill name',{required:true,value:row.name})+
    f('vendor','Vendor (optional)',{value:row.vendor})+
    dateField('dueDate','Due date',row.dueDate,true)+
    f('amount','Amount in dollars (optional)',{type:'number',min:0,step:'0.01',value:string(row.amount)})+
    f('notes','Notes (optional)',{textarea:true,value:row.notes}),
    'saveBill',id);break;
  }
  case 'paid': {
   if(!bill||bill.status!=='open')return;
   openForm('Record bill as paid',dateField('paidDate','Date paid',date,true),'markBillPaid',id,readOnlyNote(bill,'This records a payment you already made. It does not send money.'));break;
  }
 }
});
