import { createHash, randomUUID } from 'node:crypto';
import {stockMovement} from './work-entry.js';
import {reconcileStock} from './stock-demand.js';

// This registry is the only mapping from public record names to stored collections.
// User-provided table names never become SQL identifiers or arbitrary object paths.
const collections = {
 customer:'customers', project:'projects', workorder:'workorders',
 catalog:'catalog', inventory:'inventory', ticket:'tickets'
};
const requiredText=(value,label,max=250)=>{
 if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(label+' is required (max '+max+' characters)');
 return value.trim();
};
function collection(state,kind,parentId){
 if(kind==='contact'){
  const parent=state.customers.find(c=>c.id===parentId);
  if(!parent)throw Error('Restore the billing client first.');
  return parent.contacts??=[];
 }
 const name=collections[kind];
 if(!name)throw Error('Unsupported record type');
 return state[name]??=[];
}
const recordLabel=record=>record.name||record.title||record.location||record.id;

function deletionPlans(state,ids){
 if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw Error('Select 1–100 unique work orders');
 return ids.map(id=>{
  const order=state.workorders.find(item=>item.id===id);
  if(!order)throw Error('Work order changed. Refresh and try again.');
  const receipts=order.receipts||[];
  const tickets=(state.tickets||[]).filter(ticket=>ticket.workorderId===id);
  const payroll=order.entries.filter(entry=>['labor','travel'].includes(entry.type));
  // Physical replenishment is independent of an archived job's issued material.
  const movements=(state.movements||[]).filter(movement=>movement.workorderId===id&&movement.type!=='field-purchase');
  const groups=new Map();
  for(const move of movements){
   const key=JSON.stringify([move.catalogId,move.location]);
   const item=groups.get(key)||{catalogId:move.catalogId,location:move.location,quantity:0};
   item.quantity=Math.round((item.quantity+move.quantity)*100)/100;
   groups.set(key,item);
  }
  const stock=[...groups.values()].filter(move=>move.quantity).map(move=>({...move,quantity:-move.quantity}));
  const blockers=[];
  if(order.invoice||(state.projectInvoices||[]).some(invoice=>invoice.orders?.some(item=>item.id===id||item.workorderId===id)))blockers.push('This work order is on a recorded invoice; use a billing adjustment.');
  if((state.activeClocks||[]).some(clock=>clock.workorderId===id))blockers.push('Stop running timers on this work order first.');
  if((state.payrollRuns||[]).some(run=>payroll.some(entry=>(entry.date>=run.start&&entry.date<=run.end)||run.entries?.some(row=>row.id===entry.id))))blockers.push('This work order includes time in a finalized pay period; use a payroll adjustment.');
  // Compare the material issue history to the still-active material entries.
  // If legacy stock data cannot be accounted for, block instead of fabricating stock.
  const expected=new Map(),actual=new Map();
  for(const line of order.entries.filter(entry=>entry.type==='material'))expected.set(line.catalogId,(expected.get(line.catalogId)||0)+line.quantity);
  for(const line of stock)actual.set(line.catalogId,(actual.get(line.catalogId)||0)+line.quantity);
  if([...new Set([...expected.keys(),...actual.keys()])].some(key=>Math.abs((expected.get(key)||0)-(actual.get(key)||0))>0.005)||
     stock.some(line=>!line.location||!state.catalog.some(item=>item.id===line.catalogId)))blockers.push('Inventory movements do not match the work order’s materials; reconcile inventory first.');
  const revision=createHash('sha256').update(JSON.stringify([order,tickets,movements,blockers])).digest('hex');
  return {order,tickets,payroll,stock,receipts,blockers,revision};
 });
}
export function previewWorkorderRemoval(state,ids){
 return deletionPlans(state,ids).map(({order,tickets,payroll,stock,receipts,blockers,revision})=>({
  id:order.id,title:order.title,entries:order.entries.length,receipts:receipts.length,tickets:tickets.length,paidTimeEntries:payroll.length,
  stockLocations:stock.length,blockers,revision
 }));
}
function moveOrdersToTrash(state,data,actor){
 if(actor.role!=='admin')throw Error('Admin access required to delete work orders');
 if(data.confirmation!=='delete')throw Error('Type delete to confirm');
 const reason=requiredText(data.reason,'Reason',500);
 const plans=deletionPlans(state,data.ids);
 for(const {order,blockers,revision} of plans){
  if(blockers.length)throw Error(order.title+': '+blockers.join(' '));
  if(!data.revisions||data.revisions[order.id]!==revision)throw Error('Review the current work order and dependencies before confirming deletion.');
 }
 for(const {order,tickets,payroll,stock} of plans){
  (state.trash??=[]).push({id:randomUUID(),kind:'workorder',record:structuredClone(order),
   dependencies:{tickets:structuredClone(tickets),stock},deletedAt:new Date().toISOString(),deletedBy:actor.email,reason});
  for(const move of stock)stockMovement(state,order,null,move,move.quantity,'workorder-archive',actor);
  for(const row of payroll)(state.payrollOther??=[]).push({...structuredClone(row),deletedWorkorderId:order.id,job:order.title,
    projectNumber:state.projects.find(item=>item.id===order.projectId)?.number||'',
    recordedBy:row.createdBy||actor.email,archiveReason:reason});
  state.tickets=(state.tickets||[]).filter(ticket=>ticket.workorderId!==order.id);
 }
 state.workorders=state.workorders.filter(order=>!data.ids.includes(order.id));
 reconcileStock(state);
 audit(state,actor,'workorder.delete',plans.map(({order})=>recordLabel(order)).join(', ')+' — '+reason);
 return {count:plans.length};
}

// Removal is recoverable, but references still need to remain valid.
// History-bearing work orders and inventory movements are never silently discarded.
function checkRemoval(state,kind,record){
 if((state.estimates||[]).some(estimate=>kind==='customer'&&estimate.clientId===record.id||kind==='project'&&estimate.projectId===record.id))throw Error('This record is linked to an estimate.');
 const linkKey={customer:'clientId',project:'projectId',workorder:'workorderId'}[kind];
 if(kind!=='workorder'&&linkKey&&(state.tickets||[]).some(ticket=>ticket[linkKey]===record.id))throw Error('This record is linked to a ticket.');

 if(kind==='customer'&&state.projects.some(p=>p.customerId===record.id))throw Error('Client has projects. Remove or restore related records first.');
 if(kind==='project'&&state.workorders.some(w=>w.projectId===record.id))throw Error('Project has work orders. Remove draft work orders first.');
 if(kind==='catalog'){
  const used=state.workorders.some(w=>w.entries.some(e=>e.catalogId===record.id)||w.changes.some(c=>c.lines.some(l=>l.catalogId===record.id)));
  if(used||state.inventory.some(s=>s.catalogId===record.id)||state.purchases.some(p=>p.catalogId===record.id)||state.movements.some(m=>m.catalogId===record.id))throw Error('This pricing item has inventory or job history.');
 }
 if(kind==='inventory'&&(record.quantity!==0||state.movements.some(m=>m.catalogId===record.catalogId&&m.location===record.location)))throw Error('Only empty stock locations without movements can be deleted.');
}
function checkParents(state,kind,record){
 if(kind==='ticket'){
  const client=state.customers.find(item=>item.id===record.clientId);
  if(record.kind==='prospect'&&!record.clientId)return;
  if(!client||record.contactId&&!client.contacts?.some(item=>item.id===record.contactId)||
     record.projectId&&!state.projects.some(item=>item.id===record.projectId)||
     record.workorderId&&!state.workorders.some(item=>item.id===record.workorderId))throw Error('Restore the ticket’s linked records first.');
 }

 if(kind==='project'&&!state.customers.some(c=>c.id===record.customerId))throw Error('Restore the billing client first.');
 if(kind==='workorder'&&!state.projects.some(p=>p.id===record.projectId))throw Error('Restore the project first.');
 if(kind==='inventory'&&!state.catalog.some(c=>c.id===record.catalogId))throw Error('Restore the pricing item first.');
}
function audit(state,actor,action,detail){
 (state.events??=[]).unshift({id:randomUUID(),at:new Date().toISOString(),action,reference:'records',detail,actor:actor.email});
 state.events=state.events.slice(0,2500);
}
export function handleRecordAction(state,action,data,actor){
 const [kind,verb]=action.split('.');
 if(kind==='workorder'&&verb==='delete')return moveOrdersToTrash(state,data,actor);
 if(kind==='trash'){
  if(!['restore','purge'].includes(verb))throw Error('Unsupported Trash action');
  const ids=data.ids;
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw Error('Select 1–100 unique Trash records');
  const selected=ids.map(id=>{
   const item=(state.trash||[]).find(item=>item.id===id);
   if(!item)throw Error('Trash record already changed. Refresh and try again.');
   return item;
  });
  // Validate every restore before mutating any collection, so bulk operations are atomic.
  if(verb==='restore')for(const item of selected){
   const rows=collection(state,item.kind,item.parentId);
   if(rows.some(row=>row.id===item.record.id))throw Error('Record already exists');
   checkParents(state,item.kind,item.record);
   if(item.kind==='catalog'&&state.catalog.some(row=>row.sku===item.record.sku))throw Error('A pricing item already uses this SKU');
   if(item.kind==='project'&&item.record.number&&state.projects.some(row=>row.number===item.record.number))throw Error('Project number already exists');
   if(item.kind==='workorder'){
    if(item.record.workorderNumber&&state.workorders.some(row=>row.projectId===item.record.projectId&&row.workorderNumber===item.record.workorderNumber))throw Error('Work order number already exists in this project.');
    if(item.dependencies?.tickets?.some(ticket=>(state.tickets||[]).some(row=>row.id===ticket.id)))throw Error('A linked ticket already exists.');
    if(item.dependencies?.stock?.some(move=>!state.catalog.some(part=>part.id===move.catalogId)))throw Error('Restore the linked catalog items first.');
   }
  }
  // Purging a parent must not strand a child that is still recoverable in Trash.
  if(verb==='purge')for(const item of selected){
   if(item.kind==='workorder'&&(item.record.entries?.length||item.record.receipts?.length||item.record.approvedAt||item.record.closeout||item.record.changes?.length||item.record.approval||item.record.estimateId||item.record.entryHistory?.length||item.dependencies?.tickets?.length||item.dependencies?.stock?.length))throw Error('Keep this work order in Trash because it contains linked or operational history.');
   const dependent=(state.trash||[]).some(other=>!ids.includes(other.id)&&(
    item.kind==='customer'&&(other.parentId===item.record.id||(other.record.customerId===item.record.id||other.record.clientId===item.record.id))||
    item.kind==='project'&&other.record.projectId===item.record.id||
    item.kind==='workorder'&&other.record.workorderId===item.record.id||
    item.kind==='contact'&&other.record.contactId===item.record.id||
    item.kind==='catalog'&&other.record.catalogId===item.record.id));
   if(dependent)throw Error('Trash contains dependent records. Restore or review those records first.');
  }
  if(verb==='purge'&&data.confirmation!=='PERMANENTLY DELETE')throw Error('Type PERMANENTLY DELETE to confirm');
  for(const item of selected)if(verb==='restore'){
   collection(state,item.kind,item.parentId).push(item.record);
   if(item.kind==='workorder'){
    const order=item.record;
    for(const move of item.dependencies?.stock||[])stockMovement(state,order,null,move,-move.quantity,'workorder-restore',actor);
    (state.tickets??=[]).push(...(item.dependencies?.tickets||[]));
    state.payrollOther=(state.payrollOther||[]).filter(entry=>entry.deletedWorkorderId!==order.id);
   }
  }
  if(verb==='restore'&&selected.some(item=>item.kind==='workorder'))reconcileStock(state);
  state.trash=(state.trash||[]).filter(item=>!ids.includes(item.id));
  audit(state,actor,action,selected.map(item=>recordLabel(item.record)).join(', '));
  return {count:selected.length};
 }
 const rows=collection(state,kind);
 if(verb==='delete'){
  const reason=requiredText(data.reason,'Reason',500);
  if(data.confirmed!==true)throw Error('Confirm deletion');
  if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>100||new Set(data.ids).size!==data.ids.length)throw Error('Select 1–100 unique records');
  const selected=data.ids.map(id=>{
   const record=rows.find(row=>row.id===id);
   if(!record)throw Error('Record already changed. Refresh and try again.');
   checkRemoval(state,kind,record);
   return record;
  });
  state.trash??=[];
  for(const record of selected)state.trash.push({id:randomUUID(),kind,record:structuredClone(record),deletedAt:new Date().toISOString(),deletedBy:actor.email,reason});
  state[collections[kind]]=rows.filter(row=>!data.ids.includes(row.id));
  audit(state,actor,action,selected.map(recordLabel).join(', ')+' — '+reason);
  return {count:selected.length};
 }
 if(verb!=='update')throw Error('Unsupported record action');
 const record=rows.find(row=>row.id===data.id);
 if(!record)throw Error('Record not found');
 // An old edit form must not overwrite somebody else's more recent correction.
 if(!Object.hasOwn(data,'expectedUpdatedAt')||(record.updatedAt??null)!==data.expectedUpdatedAt)throw Error('This record changed. Refresh before editing.');
 const patch={};
 if(kind==='customer'){
  patch.name=requiredText(data.name,'Name',100);
  patch.business=String(data.business||'').trim().slice(0,150);
  patch.email=requiredText(data.email,'Email',150);patch.phone=requiredText(data.phone,'Phone',80);
  patch.financeEmail=String(data.financeEmail||'').trim().slice(0,150);
  patch.address=requiredText(data.address,'Address',300);
 }else if(kind==='project'){
  patch.name=requiredText(data.name,'Project name');
  patch.site=requiredText(data.site,'Jobsite');
  patch.po=String(data.po||'').trim().slice(0,80);
 }else if(kind==='workorder'){
  patch.title=requiredText(data.title,'Work order title');
  if(data.description!==record.description){
   if(record.approval||record.approvedAt||record.entries.length||record.closeout||record.invoice)throw Error('Approved scope must be changed through a change order.');
   patch.description=requiredText(data.description,'Scope',1500);
  }
 }else throw Error('Use the module-specific editing form for this record');
 const before=structuredClone(record);
 Object.assign(record,patch,{updatedAt:new Date().toISOString()});
 audit(state,actor,action,JSON.stringify({id:record.id,before,after:patch}));
 return record;
}

// Contacts are nested under billing clients, so their ownership is explicit.
export function handleContactEdit(state,action,data,actor){
 const client=state.customers.find(c=>c.id===data.customerId);
 const contact=client?.contacts?.find(c=>c.id===data.id);
 if(!contact)throw Error('Contact not found');
 if(action==='contact.delete'){
  if(data.confirmed!==true)throw Error('Confirm deletion');
  const reason=requiredText(data.reason,'Reason',500);
  if((state.tickets||[]).some(ticket=>ticket.contactId===contact.id))throw Error('This contact is linked to a ticket.');
  if(state.projects.some(p=>p.contactId===contact.id))throw Error('Reassign this contact on linked projects first.');
  (state.trash??=[]).push({id:randomUUID(),kind:'contact',parentId:client.id,record:structuredClone(contact),deletedAt:new Date().toISOString(),deletedBy:actor.email,reason});
  client.contacts=client.contacts.filter(c=>c.id!==contact.id);
  audit(state,actor,action,contact.id+' — '+reason);
  return {count:1};
 }
 if(!Object.hasOwn(data,'expectedUpdatedAt')||(contact.updatedAt??null)!==data.expectedUpdatedAt)throw Error('This contact changed. Refresh before editing.');
 const patch={name:requiredText(data.name,'Name',100),phone:requiredText(data.phone,'Phone',80),email:String(data.email||'').trim().slice(0,150)};
 Object.assign(contact,patch,{updatedAt:new Date().toISOString()});
 audit(state,actor,action,contact.id);
 return contact;
}
