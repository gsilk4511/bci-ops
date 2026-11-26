import {me,today,can,card,catalog,data,esc,fmt,head,labelFor,modal,f,projectLabel,render,send,show,status,view} from '../app.js';
import {allowedCards,defaultLayout,addLayoutCard,orderLayout,visualOrder,GRID_COLUMNS} from './dashboard-layout.js';

let editing=null,drag=null,saving=false;
const navButton=(label,id)=>`<button type="button" class="secondary small" data-nav="${id}">${label}</button>`;
const privateLayout=()=>Array.isArray(data.dashboardLayout)?data.dashboardLayout:defaultLayout(me.permissions||[]);
const rowAction=(name,label,id='')=>`<button type="button" class="secondary small" data-dash-action="${name}" data-dash-id="${esc(id)}">${label}</button>`;
const orderLink=order=>`<button type="button" class="rowlink" data-wo="${esc(order.id)}">${esc(order.title)}</button>`;
const projectLink=project=>`<button type="button" class="rowlink" data-project="${esc(project.id)}">${esc(projectLabel(project))}</button>`;
const tickets=()=>data.ticketOverview?.tickets||[];
const compact=(rows,renderRow,blank='No work waiting.')=>rows.length?
 `<ul class="dashboard-list">${rows.map(renderRow).join('')}</ul>`:`<p class="muted">${esc(blank)}</p>`;
const dateLabel=value=>value?String(value).slice(0,10):'';
const descending=a=>[...a].sort((x,y)=>String(y.updatedAt||y.closeout?.at||y.createdAt||'').localeCompare(String(x.updatedAt||x.closeout?.at||x.createdAt||'')));

function workRows(rows,{review=false}={}){
 const reviewTickets=new Map(tickets().filter(t=>t.kind==='review'&&t.status==='Ready for review').map(t=>[t.workorderId,t.id]));
 return compact(descending(rows),order=>{
  const ticketId=review&&reviewTickets.get(order.id);
  return `<li>${orderLink(order)}<small>${esc(labelFor(order))}${ticketId?` · <a href="/?ticket=${encodeURIComponent(ticketId)}">Review details</a>`:''}</small></li>`;
 });
}
function renderProjects(rows){
 return compact(descending(rows),p=>{
  const count=(data.workorders||[]).filter(w=>w.projectId===p.id);
  const reviewed=count.filter(w=>w.closeout?.reviewedAt||w.invoice).length;
  return `<li>${projectLink(p)}<small>${[
   can('workorders.view')?`${reviewed} of ${count.length} reviewed`:'',
   p.nextStep,p.followUpDue&&'Follow up '+dateLabel(p.followUpDue)
  ].filter(Boolean).map(esc).join(' · ')||'No follow-up noted'}</small></li>`;
 },'No projects in this queue.');
}
function businessOverview(orders){
 const stats=data.stats||{};
 const tally=can('finance.view')?
  `${card('Completed • not invoiced',fmt(stats.unbilled),`${stats.unbilledCount||0} closeouts`,'orange')}
  ${card('Invoiced • outstanding',fmt(stats.outstanding),`${stats.openCount||0} invoices`)}
  ${card('Confirmed paid',fmt(stats.paid),`${stats.paidCount||0} invoices`,'green')}`:
  can('workorders.view')?`${card('Open work orders',orders.filter(x=>x.status==='released').length,'Released work orders')}
  ${card('Waiting on signoff',orders.filter(x=>x.status==='awaiting-signoff').length,'Do not start yet')}`:'';
 const inventory=can('inventory.view')?card('Warehouse shortages',(data.inventory||[]).filter(x=>x.quantity<0).length,'Audit exceptions'):'';
 return tally||inventory?`<div class="cards dashboard-overview-counts">${tally}${inventory}</div>`:'<p class="muted">No overview metrics available with your current access.</p>';
}
function content(id,orders){
 const projects=data.projects||[];
 if(id==='review')return workRows(orders.filter(o=>o.closeout&&!o.closeout.reviewedAt&&!o.invoice),{review:true});
 if(id==='ready')return workRows(orders.filter(o=>o.closeout?.reviewedAt&&!o.invoice&&!o.internalTask&&!o.billingHidden));
 if(id==='payment')return workRows(orders.filter(o=>o.invoice&&!o.billingHidden&&o.invoice.status!=='paid'));
 if(id==='open-work')return workRows(orders.filter(o=>o.status==='released'))+navButton('All work orders','workorders');
 if(id==='signoff')return workRows(orders.filter(o=>o.status==='awaiting-signoff'||(o.changes||[]).some(c=>c.status==='awaiting-signoff')));
 if(id==='timer')return workRows(orders.filter(o=>o.id===me.clock?.workorderId));
 if(id==='projects')return renderProjects(projects.filter(p=>!p.closedAt))+navButton('All projects','projects');
 if(id==='final-billing')return renderProjects(projects.filter(p=>p.closedAt&&orders.some(o=>o.projectId===p.id&&!o.invoice&&!o.internalTask&&!o.billingHidden&&(o.entries||[]).some(e=>e.rate*e.quantity>0))));
 if(id==='overview')return businessOverview(orders);
 if(id==='prospects')return compact(tickets().filter(t=>t.kind==='prospect'&&t.status!=='Completed'),t=>
  `<li><a href="/?ticket=${encodeURIComponent(t.id)}">${esc(t.title)}</a><small>${esc([t.company,t.due&&'Due '+t.due].filter(Boolean).join(' · '))}</small></li>`);
 if(id==='warehouse')return compact((data.inventory||[]).filter(x=>x.quantity<0),x=>`<li>${esc(catalog(x.catalogId)?.name||'Part')} · ${esc(x.quantity)} · ${esc(x.location)}</li>`,'No shortages.')+navButton('Open Warehouse','inventory');
 if(id==='unbilled'){
  const unbilled=(data.moneyOrders||[]).filter(row=>row.stateKey==='unbilled');
  return `<p><strong>${fmt(unbilled.reduce((sum,row)=>sum+row.total,0))}</strong> · ${unbilled.length} work orders</p>`+navButton('Open Money','money');
 }
 return '';
}
const gridStyle=row=>`grid-column:${row.x+1} / span ${row.w};grid-row:${row.y+1} / span ${row.h}`;

export function dashboard(){
 if(editing?.email!==me.email)editing=null;
 const available=allowedCards(me.permissions||[]), permitted=new Map(available.map(c=>[c.id,c]));
 const layout=(editing?.layout||privateLayout()).filter(row=>permitted.has(row.id)).sort(visualOrder);
 const orders=data.workorders||[];
 const remaining=available.filter(c=>!layout.some(row=>row.id===c.id));
 const actions=editing?`<div class="gap dash-actions">
  ${remaining.length?`<label class="bci-visually-hidden" for="dashAdd">Card to add</label><select id="dashAdd"><option value="">Choose a card to add</option>${remaining.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select>`:''}
  ${remaining.length?rowAction('add','Add card'):''}${rowAction('reset','Reset layout')}${rowAction('cancel','Cancel')}${rowAction('save','Save layout')}</div>`:
  `<div class="gap dash-actions">${rowAction('edit','Edit dashboard')}${can('tickets.view')?'<a href="/?tickets=workflow">Service desk</a>':''}
   ${can('workorder.create')?'<button class="primary" data-open="workorder">+ New Work Order</button>':''}</div>`;
 return head('Dashboard','Work queue','Review work orders, follow open projects, and keep billing moving.',actions)+
  (editing?'<p class="muted">Drag the top handle to move or the bottom corner to resize. Use Position &amp; size for keyboard controls. On phones, cards stack in grid order.</p>':'')+
  `<div class="dashboard-board${editing?' dashboard-edit':''}" aria-label="Dashboard cards">${layout.map(row=>`<section class="panel dashboard-card" data-dash-card="${row.id}" style="${gridStyle(row)}">
   <div class="dashboard-card-head"><h2>${esc(permitted.get(row.id).title)}</h2>
    ${editing?'<span class="dash-move" data-dash-drag="move" aria-hidden="true" title="Drag to move">⠿</span>':''}</div>
   ${editing?`<div class="dash-card-controls">${rowAction('position','Position &amp; size',row.id)}${rowAction('remove','Remove card',row.id)}</div>`:''}
   <div class="dashboard-card-body">${content(row.id,orders)}</div>
   ${editing?'<span class="dash-resize" data-dash-drag="resize" aria-hidden="true" title="Drag to resize">◢</span>':''}
  </section>`).join('')}</div>`+
  (layout.length?'':`<p class="muted">No cards on your dashboard. ${editing?'Choose a card to add above.':'Use Edit dashboard to add cards.'}</p>`);
}
function update(layout){
 if(!editing)return;
 editing.layout=layout;render();
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-dash-action]');
 if(!button||view!=='dashboard'||!can('dashboard.view'))return;
 const action=button.dataset.dashAction,id=button.dataset.dashId;
 if(action==='edit'){editing={email:me.email,layout:privateLayout().map(row=>({...row}))};render();return;}
 if(!editing||saving)return;
 if(action==='cancel'){editing=null;render();return;}
 if(action==='reset'){update(defaultLayout(me.permissions||[]));return;}
 if(action==='remove'){update(editing.layout.filter(row=>row.id!==id));return;}
 if(action==='add'){
  const selected=document.querySelector('#dashAdd')?.value;
  if(selected&&allowedCards(me.permissions||[]).some(c=>c.id===selected)){
   try{update(addLayoutCard(editing.layout,selected));}catch(error){show(error.message,true);}
  }
  return;
 }
 if(action==='position'){
  const row=editing.layout.find(row=>row.id===id);
  if(!row)return;
  modal('Position and size',[
   ['x','Column from left (1–12)',row.x+1,1],['y','Row from top (1–128)',row.y+1,1],
   ['w','Width in columns (3–12)',row.w,3],['h','Height in rows (2–12)',row.h,2]
  ].map(([key,label,value,min])=>f(key,label,{type:'number',min,value,step:1,required:true})).join(''),
  values=>update(orderLayout(editing.layout,id,{x:Number(values.x)-1,y:Number(values.y)-1,w:Number(values.w),h:Number(values.h)})),
  '<p>Cards snap to the grid. If another card overlaps, it moves down.</p>');
  return;
 }
 if(action==='save'){
  saving=true;const draft=editing;
  const permitted=new Set(allowedCards(me.permissions||[]).map(c=>c.id));
  send('dashboard.layout',{cards:draft.layout.filter(row=>permitted.has(row.id))}).then(()=>{
   if(editing===draft){editing=null;render();}
  }).catch(error=>show(error.message,true)).finally(()=>{saving=false;});
 }
});
document.addEventListener('pointerdown',event=>{
 const grip=event.target.closest('[data-dash-drag]');
 if(!editing||saving||view!=='dashboard'||event.button!==0||!grip||!window.matchMedia('(min-width: 801px)').matches)return;
 const element=grip.closest('[data-dash-card]'),board=grip.closest('.dashboard-board');
 if(!element||!board)return;
 const row=editing.layout.find(x=>x.id===element.dataset.dashCard);
 if(!row)return;
 const css=getComputedStyle(board),gap=parseFloat(css.columnGap)||0;
 drag={row,layout:editing.layout,startX:event.clientX,startY:event.clientY,scrollY:window.scrollY,
  stepX:(board.clientWidth+gap)/GRID_COLUMNS,stepY:(parseFloat(css.gridAutoRows)||65)+(parseFloat(css.rowGap)||0),
  pointerId:event.pointerId,mode:grip.dataset.dashDrag,grip,board,preview:editing.layout};
 grip.setPointerCapture(event.pointerId);board.dataset.drag='true';event.preventDefault();
});
document.addEventListener('pointermove',event=>{
 if(!drag||drag.pointerId!==event.pointerId)return;
 const d=drag,dx=Math.round((event.clientX-d.startX)/d.stepX),dy=Math.round((event.clientY-d.startY+window.scrollY-d.scrollY)/d.stepY);
 try{d.preview=dx===0&&dy===0?d.layout:orderLayout(d.layout,d.row.id,d.mode==='resize'?{w:d.row.w+dx,h:d.row.h+dy}:{x:d.row.x+dx,y:d.row.y+dy});}
 catch{return;}
 const items=new Map(d.preview.map(item=>[item.id,item]));
 for(const el of d.board.querySelectorAll('[data-dash-card]')){
  const row=items.get(el.dataset.dashCard);
  if(row)el.style.cssText=gridStyle(row);
 }
});
function finishDrag(event){
 if(!drag||drag.pointerId!==event.pointerId)return;
 const d=drag;drag=null;
 delete d.board.dataset.drag;
 if(editing&&view==='dashboard')update(event.type==='pointerup'?d.preview:d.layout);
}
document.addEventListener('pointerup',finishDrag);
document.addEventListener('pointercancel',finishDrag);
