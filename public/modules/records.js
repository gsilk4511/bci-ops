// Shared record editor used by Customers, Projects, Work Orders, and Pricing.
// Only allowlisted fields are sent; the server independently checks permissions,
// record links, approval history, and concurrent edits.
import { data, me, can, esc, f, modal, send, render, show, view, openCatalogEditor, practiceMode } from '../app.js';
const kinds={customers:'customer',projects:'project',workorders:'workorder',catalog:'catalog',inventory:'inventory'};
const arrays={customer:'customers',project:'projects',workorder:'workorders',catalog:'catalog',inventory:'inventory'};
let managing='';
const deleteGrant=kind=>!practiceMode&&can(kind+'.delete')&&(kind!=='workorder'||me?.role==='admin');
const editGrant=kind=>!practiceMode&&can(kind+'.update');
const allowedFor=kind=>Boolean(kind)&&(editGrant(kind)||deleteGrant(kind)||kind==='customer'&&(editGrant('contact')||deleteGrant('contact')));
const label=row=>row.name||row.title||row.location||row.id;
function records(kind){
 if(kind==='contact')return data.customers.flatMap(c=>(c.contacts||[]).map(contact=>({...contact,customerId:c.id,clientName:c.business||c.name})));
 return data[arrays[kind]]||[];
}
export function recordTools(){
 const kind=kinds[view];
 if(!allowedFor(kind))return '';
 return '<div class="actions"><button class="secondary" id="manageRecords">'+(managing===view?'Return to overview':'Manage records')+'</button></div>';
}
export function managingRecords(){return managing===view&&allowedFor(kinds[view]);}
export function recordManager(){
 const kind=kinds[view];
 if(!allowedFor(kind))return '';
 const types=kind==='customer'?'<label>Record type<select id="recordKind">'+
  (editGrant('customer')||deleteGrant('customer')?'<option value="customer">Billing clients</option>':'')+
  (editGrant('contact')||deleteGrant('contact')?'<option value="contact">Job contacts</option>':'')+'</select></label>':'';
 return '<section class="panel"><h2>Manage records</h2><p>Find the record you want to update.</p>'+types+
 '<label>Search<input id="recordSearch" type="search" placeholder="Find a record"></label><div id="recordRows"></div></section>';
}
function showRows(){
 const kind=document.querySelector('#recordKind')?.value||kinds[view];
 const query=document.querySelector('#recordSearch').value.trim().toLowerCase();
 const rows=records(kind).filter(row=>(label(row)+' '+(row.number||'')+' '+(row.clientName||'')).toLowerCase().includes(query));
 const deleteAllowed=deleteGrant(kind);
 document.querySelector('#recordRows').innerHTML=
 '<div class="actions">'+(deleteAllowed?'<button type="button" class="danger" id="deleteRecords">Delete selected</button>':'')+'</div>'+
 '<div class="tablewrap"><table><thead><tr><th>'+(deleteAllowed?'<input id="selectRecords" aria-label="Select all visible records" type="checkbox">':'')+'</th><th>Record</th><th>Actions</th></tr></thead><tbody>'+
 rows.map(row=>'<tr><td>'+(deleteAllowed?'<input class="record-select" type="checkbox" value="'+esc(row.id)+'" aria-label="Select '+esc(label(row))+'">':'')+'</td><td>'+esc([row.number,label(row),row.clientName].filter(Boolean).join(' · '))+'</td><td>'+
 (editGrant(kind)?'<button class="secondary small" data-record-edit="'+esc(row.id)+'">Edit</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
 document.querySelector('#selectRecords')?.addEventListener('change',event=>{
  document.querySelectorAll('.record-select').forEach(input=>{input.checked=event.target.checked;});
 });
 document.querySelectorAll('[data-record-edit]').forEach(button=>button.addEventListener('click',()=>editRecord(kind,rows.find(row=>row.id===button.dataset.recordEdit))));
 document.querySelector('#deleteRecords')?.addEventListener('click',()=>{
  const ids=[...document.querySelectorAll('.record-select:checked')].map(input=>input.value);
  if(!ids.length){show('Select at least one record',true);return;}
  if(kind==='contact'&&ids.length>1){show('Delete job contacts individually so the parent client is explicit.',true);return;}
  confirmDelete(kind,rows.filter(row=>ids.includes(row.id)));
 });
}
function editRecord(kind,row){
 if(!row||!editGrant(kind))return;
 if(kind==='catalog'){openCatalogEditor(row);return;}
 let fields='';
 if(kind==='customer')fields=f('name','Name',{required:true,value:row.name})+f('business','Business',{value:row.business})+
  f('email','Email',{type:'email',required:true,value:row.email})+f('financeEmail','Finance email',{type:'email',value:row.financeEmail})+
  f('phone','Phone',{required:true,value:row.phone})+f('address','Billing address',{required:true,textarea:true,value:row.address});
 if(kind==='project')fields=f('name','Project name',{required:true,value:row.name})+f('site','Jobsite',{required:true,value:row.site})+f('po','Client PO',{value:row.po});
 if(kind==='workorder')fields=f('title','Work order title',{required:true,value:row.title})+f('description','Scope',{required:true,textarea:true,value:row.description});
 if(kind==='contact')fields=f('name','Name',{required:true,value:row.name})+f('phone','Phone',{required:true,value:row.phone})+f('email','Email',{type:'email',value:row.email});
 if(!fields){show('Use Receive, Transfer or Adjust stock for inventory changes.',true);return;}
 modal('Edit '+kind,fields,values=>send(kind+'.update',{...values,id:row.id,customerId:row.customerId,expectedUpdatedAt:row.updatedAt??null}),
  kind==='workorder'?'<p>Approved scope changes require a change order.</p>':'');
}
export function workorderDeleteButton(order){
 return !practiceMode&&deleteGrant('workorder')
  ?'<button class="danger small" data-delete-workorder="'+esc(order.id)+'">Delete Work Order</button>':'';
}
async function confirmWorkorderDelete(rows){
 if(practiceMode||!deleteGrant('workorder'))return;
 try{
  const ids=rows.map(row=>row.id),response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'workorder.deletePreview',data:{ids}})});
  const body=await response.json();
  if(!response.ok||!body.ok)throw Error(body.error||'Could not review work-order dependencies');
  const plans=body.result;
  const blocked=plans.some(group=>group.blockers.length);
  const summary=plans.map(plan=>'<li><b>'+esc(plan.title)+'</b><br>'+
   esc(plan.entries)+' entries, '+esc(plan.typedTimeEntries??plan.paidTimeEntries)+' time entries, '+esc(plan.receipts)+' receipts, '+esc(plan.tickets)+' tickets, '+
   esc(plan.stockLocations)+' stock locations. '+plan.blockers.map(message=>'<b>'+esc(message)+'</b>').join(' ')+'</li>').join('');
  modal(blocked?'Work order cannot be deleted':'Delete work order',
   '<div class="delete-warning"><ul>'+summary+'</ul></div>'+
   (blocked?'':f('reason','Reason for deletion',{required:true,textarea:true})+f('confirmation','Type delete to continue',{required:true})),
   values=>blocked?undefined:send('workorder.delete',{ids,reason:values.reason,confirmation:values.confirmation,
    revisions:Object.fromEntries(plans.map(plan=>[plan.id,plan.revision]))}),
   blocked?'<p>Resolve these dependencies first. No records will change.</p>':
   '<p>The work order, linked tickets and receipts move to Trash. Inventory is reconciled, and actual time remains in payroll for review.</p>');
  const submit=document.querySelector('#actionForm button[type=submit]');
  submit.textContent=blocked?'Close':'Delete from active records';submit.className=blocked?'secondary':'danger';
  if(!blocked)addCancel();
 }catch(error){show(error.message,true);}
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-delete-workorder]');
 if(!button)return;
 const order=data.workorders.find(row=>row.id===button.dataset.deleteWorkorder);
 if(order)void confirmWorkorderDelete([order]);
});
function confirmDelete(kind,rows){
 if(!deleteGrant(kind)||!rows.length)return;
 if(kind==='workorder')return confirmWorkorderDelete(rows);
 modal('Confirm deletion',
 '<div class="delete-warning"><strong>You could get fired if you delete this, be sure you are confident in your decision</strong>'+
 '<p>You selected '+rows.length+' record(s).</p><ul>'+rows.map(row=>'<li>'+esc(label(row))+'</li>').join('')+'</ul>'+
 '<p>These records will move to owner-only Trash. Linked or approved records may block this action.</p></div>'+
 f('reason','Reason for deletion',{required:true,textarea:true}),
 values=>send(kind+'.delete',kind==='contact'?{id:rows[0].id,customerId:rows[0].customerId,reason:values.reason,confirmed:true}:{ids:rows.map(row=>row.id),reason:values.reason,confirmed:true}));
 const button=document.querySelector('#actionForm button[type=submit]');
 button.textContent='Delete '+rows.length+' record(s)';button.className='danger';
 addCancel();
}
function addCancel(){
 const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Cancel';
 cancel.addEventListener('click',()=>{document.querySelector('#modal').hidden=true;});
 document.querySelector('#actionForm').append(cancel);
}
export function wireRecords(){
 document.querySelector('#manageRecords')?.addEventListener('click',()=>{managing=managing===view?'':view;render();});
 if(!managingRecords())return;
 showRows();
 document.querySelector('#recordSearch').addEventListener('input',showRows);
 document.querySelector('#recordKind')?.addEventListener('change',showRows);
}
export function trashPage(){
 return '<section class="panel"><h1>Trash</h1><p>Restore deleted records, or permanently delete reviewed items.</p><div class="tablewrap"><table><thead><tr><th>Record</th><th>Deleted by / date</th><th>Reason</th><th>Actions</th></tr></thead><tbody>'+
 (data.trash||[]).map(item=>'<tr><td>'+esc(item.kind+' · '+label(item.record))+'</td><td>'+esc(item.deletedBy)+'<br>'+esc(item.deletedAt)+'</td><td>'+esc(item.reason)+'</td><td><button class="secondary small" data-trash-restore="'+esc(item.id)+'">Restore</button> <button class="danger small" data-trash-purge="'+esc(item.id)+'">Permanently delete</button></td></tr>').join('')+'</tbody></table></div></section>';
}
export function wireTrash(){
 document.querySelectorAll('[data-trash-restore]').forEach(button=>button.addEventListener('click',async()=>{
  try{button.disabled=true;await send('trash.restore',{ids:[button.dataset.trashRestore]});}catch(error){show(error.message,true);button.disabled=false;}
 }));
 document.querySelectorAll('[data-trash-purge]').forEach(button=>button.addEventListener('click',()=>{
  modal('Permanently delete record','<div class="delete-warning"><strong>You could get fired if you delete this, be sure you are confident in your decision</strong><p>This permanently removes the record from Trash.</p></div>'+
   f('confirmation','Type PERMANENTLY DELETE',{required:true}),values=>send('trash.purge',{ids:[button.dataset.trashPurge],confirmation:values.confirmation}));
  const submit=document.querySelector('#actionForm button[type=submit]');submit.className='danger';submit.textContent='Permanently delete';addCancel();
 }));
}
