// Reporting only; the server supplies the already scoped, classified order totals.
import {can,card,data,esc,fmt,head,moneyCustomer,moneyStatus,project,roundMoney,status,table} from '../app.js';

const states={unbilled:'Unbilled',outstanding:'Invoiced / outstanding',paid:'Paid'};
const accrual=(scope,order)=>order.stateKey==='unbilled'?
 {...scope,unbilled:roundMoney(scope.unbilled+order.total),profit:roundMoney(scope.profit+order.grossProfit)}:
 order.stateKey==='paid'?{...scope,paid:roundMoney(scope.paid+order.total)}:
 {...scope,outstanding:roundMoney(scope.outstanding+order.openBalance)};
const total=(rows,key)=>rows.reduce((sum,row)=>roundMoney(sum+row[key]),0);
const orderLink=order=>can('workorders.view')?
 `<button type="button" class="rowlink" data-wo="${esc(order.id)}">${esc(order.title)}</button>`:esc(order.title);
const orderDetail=rows=>table(['Work order','Billing status','Time','Materials','Travel','Total','Direct cost','Gross profit'],
 rows.map(row=>`<tr><td>${orderLink(row)}${row.stateKey==='unbilled'&&row.workStatus?`<div class="muted tiny">${esc(row.workStatus.replaceAll('-',' '))}</div>`:''}</td>
 <td>${status(row.stateKey==='outstanding'?'invoiced':row.stateKey)}</td><td>${fmt(row.time)}</td><td>${fmt(row.materials)}</td><td>${fmt(row.travel)}</td>
 <td>${fmt(row.total)}</td><td>${fmt(row.directCost)}</td><td>${fmt(row.grossProfit)}</td></tr>`));

export function moneyPage(){
 if(!can('finance.view')||!can('money.view'))return '<h2>Office access required</h2>';
 const rows=(data.moneyOrders||[]).filter(row=>(moneyCustomer==='all'||project(row.projectId)?.customerId===moneyCustomer)&&
  (moneyStatus==='all'||row.stateKey===moneyStatus));
 const summary=rows.reduce(accrual,{unbilled:0,outstanding:0,paid:0,profit:0});
 const groups=new Map();
 for(const row of rows.filter(row=>row.stateKey==='unbilled')){
  const key=row.projectId||'';
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 }
 const billed=rows.filter(row=>row.stateKey!=='unbilled');
 const customerById=new Map(data.customers.map(c=>[c.id,c]));
 const unbilledSection=moneyStatus==='all'||moneyStatus==='unbilled'?
  `<section class="panel"><h2>Unbilled by project</h2><p class="muted">Logged work with no QuickBooks invoice attached, whether the work order is open or completed.</p>
   ${[...groups].sort(([,a],[,b])=>total(b,'total')-total(a,'total')).map(([id,orders])=>{
    const info=project(id), client=customerById.get(info?.customerId);
    return `<details class="money-project" open><summary><span><strong>${esc([info?.number,info?.name].filter(Boolean).join(' · ')||'No project')}</strong>
     <small class="muted">${esc(client?.business||client?.name||'')} ${client?'· ':''}${orders.length} work order${orders.length===1?'':'s'}</small></span>
     <b>${fmt(total(orders,'total'))}</b></summary>${orderDetail(orders)}</details>`;
   }).join('')||'<p>No unbilled work orders match these filters.</p>'}</section>`:'';
 const billedSection=moneyStatus==='unbilled'?'':`<section class="panel"><h2>Billed work orders</h2>
  ${billed.length?orderDetail(billed):'<p>No billed work orders match these filters.</p>'}</section>`;
 const reserveRate=Number(data.meta?.reserveRate)||0;
 return head('Money dashboard','Working numbers','Estimated job margins, not financial statements. Office overhead stays in QuickBooks.',`<button class="secondary" data-print="1">Print / PDF</button>`)+
  `<div class="filters"><select id="moneyCustomer" aria-label="Customer"><option value="all">All customers</option>${data.customers.map(c=>`<option value="${esc(c.id)}" ${moneyCustomer===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
  <select id="moneyStatus" aria-label="Billing status"><option value="all">All statuses</option>${Object.entries(states).map(([key,label])=>`<option value="${key}" ${moneyStatus===key?'selected':''}>${label}</option>`).join('')}</select></div>
  <div class="cards">${card('Unbilled',fmt(summary.unbilled),'Open and completed work without an invoice','orange')}
  ${card('Open invoice balance',fmt(summary.outstanding),'Manual QB confirmation')}${card('Confirmed paid',fmt(summary.paid),'Manually recorded','green')}
  ${card('Unbilled gross profit',fmt(summary.profit),'Before overhead')}</div>
  <section class="panel"><div class="flex"><h2>Estimated reserve: ${reserveRate}%</h2><button class="secondary small" data-open="reserve">Change reserve %</button></div>
  <div class="lineTotal">${fmt(Math.max(summary.profit,0)*reserveRate/100)}</div><p class="muted tiny">Planning estimate based on unbilled work shown above, not actual tax owed, cash on hand, or an expense ledger.</p></section>
  ${unbilledSection}${billedSection}`;
}
