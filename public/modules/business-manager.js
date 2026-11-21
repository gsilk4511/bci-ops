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
const miles=value=>value!=null&&value!==''?`${Number(value).toLocaleString()} mi`:'Not set';
const money=value=>value!=null&&value!==''?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(Number(value)):'Not set';
const action=(key,label,id='')=>`<button type="button" class="secondary" data-manager-action="${key}" data-manager-id="${esc(id)}">${label}</button>`;
const badge=([kind,label])=>`<span class="bci-manager-status" data-kind="${kind}">${esc(label)}</span>`;
const line=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;
const fleetDate=vehicle=>[vehicle.registration?.dueDate,vehicle.oil?.dueDate].filter(Boolean).sort()[0]||'';

export function businessManagerPanel(board,manage){
 if(!board)return '';
 const date=board.today||today();
 const vehicles=board.vehicles||[], bills=board.bills||[];
 const orderedVehicles=vehicles.map(row=>({...row,dueDate:fleetDate(row)})).sort(sortByDue);
 const open=bills.filter(row=>row.status==='open').sort(sortByDue);
 const paid=bills.filter(row=>row.status==='paid').sort((a,b)=>(b.paidDate||'').localeCompare(a.paidDate||'')||a.name.localeCompare(b.name));
 const due=[
  ...vehicles.flatMap(row=>[['Registration',row.registration],['Oil change',row.oil]].filter(([,entry])=>entry?.dueDate).map(([type,entry])=>({name:`${row.name}: ${type}`,dueDate:entry.dueDate}))),
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
  <div class="bci-manager-section-head"><div><h2 id="businessManagerHeading">Business Manager</h2><p>Private fleet and bill tracker. Dates and payments are recorded here only; no payments or reminders are sent.</p></div>
  ${manage?'':'<p class="bci-manager-status" data-kind="none">Read only</p>'}</div>
  <dl class="bci-manager-summary">
   ${line('Overdue',String(past.length))}${line('Due in the next 30 days',String(soon.length))}
   ${line('Next due',next?`${esc(next.name)} · ${dateText(next.dueDate)}`:'Nothing scheduled')}
  </dl>
  <section aria-labelledby="managerFleetHeading"><div class="bci-manager-section-head"><h3 id="managerFleetHeading">Fleet</h3>${manage?action('vehicle','+ Add vehicle'):''}</div>
   ${orderedVehicles.length?`<div class="bci-manager-grid">${orderedVehicles.map(row=>{
     const reg=row.registration||{}, oil=row.oil||{};
     return `<article class="bci-manager-card"><h4>${esc(row.name)}</h4>${row.plate?`<p>Plate: ${esc(row.plate)}</p>`:''}
      <div class="bci-manager-maintenance"><h5>Registration</h5>
       <dl>${line('Due',dateText(reg.dueDate))}${line('Last renewed',dateText(reg.lastCompletedDate))}</dl>${badge(urgency(reg.dueDate,date))}
       ${manage?action('registration','Record renewal',row.id):''}</div>
      <div class="bci-manager-maintenance"><h5>Oil change</h5>
       <dl>${line('Due',dateText(oil.dueDate))}${line('Due odometer',miles(oil.dueMileage))}
       ${line('Last serviced',dateText(oil.lastCompletedDate))}${line('Last service odometer',miles(oil.lastMileage))}</dl>
       ${badge(!oil.dueDate&&oil.dueMileage!=null?['none','Odometer only']:urgency(oil.dueDate,date))}
       ${manage?action('oil','Record oil change',row.id):''}</div>
      ${row.notes?`<p class="bci-manager-notes">${esc(row.notes)}</p>`:''}
      ${manage?action('vehicle','Edit vehicle',row.id):''}
     </article>`;
   }).join('')}</div>`:'<p>No vehicles are being tracked yet.</p>'}
  </section>
  <section aria-labelledby="managerBillsHeading"><div class="bci-manager-section-head"><h3 id="managerBillsHeading">Open bills</h3>${manage?action('bill','+ Add bill'):''}</div>
  ${open.length?`<div class="bci-manager-grid">${open.map(billCard).join('')}</div>`:'<p>No open bills.</p>'}
  ${paid.length?`<details><summary>Paid bills (${paid.length})</summary><div class="bci-manager-grid">${paid.map(billCard).join('')}</div></details>`:''}
  </section>
 </section>`;
}

const string=value=>value==null?'':String(value);
const dateField=(field,label,value,required=false)=>f(field,label,{type:'date',value:string(value),required});
const mileageField=(field,label,value)=>f(field,label,{type:'number',value:string(value),min:0,step:'1'});
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
 const vehicle=board.vehicles.find(item=>item.id===id), bill=board.bills.find(item=>item.id===id);
 const date=board.today||today();
 switch(key){
  case 'vehicle':{
   if(id&&!vehicle)return;
   const row=vehicle||{};
   openForm(id?'Edit vehicle':'Add vehicle',
    f('name','Vehicle name',{required:true,value:row.name,placeholder:'Example: Truck 2'})+
    f('plate','License plate (optional)',{value:row.plate})+
    dateField('registrationDueDate','Next registration due',row.registration?.dueDate)+
    dateField('oilDueDate','Next oil change due',row.oil?.dueDate)+
    mileageField('oilDueMileage','Next oil change odometer (miles)',row.oil?.dueMileage)+
    f('notes','Notes (optional)',{textarea:true,value:row.notes}),
    'saveVehicle',id);break;
  }
  case 'registration':
  case 'oil': {
   if(!vehicle)return;
   const oil=key==='oil';
   openForm(oil?'Record oil change':'Record registration renewal',
    dateField('completedDate',oil?'Service date':'Renewal date',date,true)+
    dateField('nextDueDate','Next due date (optional)','')+
    (oil?mileageField('completedMileage','Odometer at service (miles)','')+
    mileageField('nextDueMileage','Next oil change odometer (miles)',''):''),
    oil?'completeOil':'completeRegistration',id,readOnlyNote(vehicle,'Records completion and replaces the previous due target.'));break;
  }
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
