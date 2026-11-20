import {data,me,can,esc,f,modal,send,render,show,practiceMode,wo} from '../app.js';

export const receiptPicker=()=>'<div class="field"><label for="workReceiptPhoto">Receipt photo</label><input id="workReceiptPhoto" name="receiptPhoto" type="file" accept="image/*" capture="environment"><p class="tiny muted">Take a photo or select an existing photo. Check that the text is readable.</p></div>';
export async function receiptPayload(file, uploadId){
 if(!(file?.size>0))return null;
 if(file.size>30000000)throw Error('Choose a photo under 30 MB');
 let image;
 try{image=await createImageBitmap(file);}
 catch{throw Error('This photo format will not open. Try the camera again or choose a JPEG or PNG.');}
 try{
  const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
  const attempts=[[1600,.8],[1400,.72],[1280,.67],[1040,.62]];
  for(const [size,quality] of attempts){
   const scale=Math.min(1,size/Math.max(image.width,image.height));
   canvas.width=Math.max(1,Math.round(image.width*scale));
   canvas.height=Math.max(1,Math.round(image.height*scale));
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const content=canvas.toDataURL('image/jpeg',quality).split(',')[1];
   if(content&&content.length<=320000)return {content,uploadId};
  }
  throw Error('Could not fit the photo. Crop the image to the receipt and try again.');
 }finally{image.close();}
}
const entryOwner=(entry)=>Boolean(me?.email)&&Boolean(entry.employeeEmail||String(entry.tech||'').includes('@'))&&
 String(entry.employeeEmail||entry.tech).toLowerCase()===me.email.toLowerCase();
const entryAvailable=(order,entry)=>!practiceMode&&can('workorders.view')&&!order.invoice&&Boolean(order.approvedAt)&&
 (me?.role==='admin'||can('entry.manage')||entryOwner(entry))&&!entry.payrollLocked;
export const canEditEntry=(order,entry)=>entryAvailable(order,entry)&&can('entry.update');
export const canRemoveEntry=(order,entry)=>entryAvailable(order,entry)&&can('entry.remove');
let editingOrder=null;
export const entryEditing=order=>editingOrder===order.id;
const anyEntryAction=order=>order.entries.some(entry=>canEditEntry(order,entry)||canRemoveEntry(order,entry));
export function editOrderButton(order){
 if(!anyEntryAction(order))return '';
 return '<button class="secondary small" data-entry-mode="'+esc(order.id)+'">'+(entryEditing(order)?'Done editing':'Edit Work Order')+'</button>';
}
export function workEntryControls(order,entry,active=entryEditing(order)){
 if(!active)return '';
 const target=' data-workorder-id="'+esc(order.id)+'"';
 const edit=canEditEntry(order,entry)?'<button class="secondary small"'+target+' data-entry-edit="'+esc(entry.id)+'">Edit</button>':'';
 const remove=canRemoveEntry(order,entry)?'<button class="danger small" aria-label="Remove journal entry"'+target+' data-entry-remove="'+esc(entry.id)+'">×</button>':'';
 return edit||remove?'<div class="actions">'+edit+remove+'</div>':'';
}
function editEntry(order,entry){
 const scoped=order.changes?.find(change=>change.id===entry.changeId);
 const canPickOther=entry.type==='material'&&!scoped;
 const available=data.catalog.filter(item=>item.type==='material'&&(item.warehouseArchived!==true||item.id===entry.catalogId)&&(!item.needsPricing||order.effectivePricing?.id||item.id===entry.catalogId));
 if(!available.some(item=>item.id===entry.catalogId))available.unshift({id:entry.catalogId,name:entry.name});
 const values=canPickOther?f('catalogId','Part',{select:available.map(item=>[item.id,item.name]),required:true,value:entry.catalogId}):'';
 const timed=entry.startTime&&entry.endTime;
 const quantity=timed?'<div class="grid2">'+f('startTime','Start',{type:'time',required:true,value:entry.startTime})+
  f('endTime','End',{type:'time',required:true,value:entry.endTime})+'</div>':
  f('quantity',entry.type==='material'?'Quantity':'Hours',{type:'number',min:0.001,step:'any',value:entry.quantity,required:true});
 return modal('Edit work-order entry',values+f('date','Date',{type:'date',required:true,value:entry.date})+quantity+
  f('description',entry.type==='material'?'Notes':'What did you work on?',{textarea:true,required:entry.type!=='material',value:entry.journalNote??entry.description}),
  patch=>send('entry.update',{...patch,workorderId:order.id,entryId:entry.id,revision:entry.revision||''}),
  '<p>Changes affect work-order totals. A submitted work order will be reviewed again.</p>');
}
function removeEntry(order,entry){
 modal('Remove work-order entry',f('reason','Why is this entry wrong?',{required:true,textarea:true}),
  values=>send('entry.remove',{...values,workorderId:order.id,entryId:entry.id,revision:entry.revision||'',confirmation:'remove'}),
  '<div class="notice">'+esc(entry.name)+' · '+esc(entry.date)+' · '+esc(entry.quantity)+' '+esc(entry.unit)+
  '. Remove only entries that should not be counted. If the hours were worked, correct them instead.</div>');
 const submit=document.querySelector('#actionForm button[type=submit]');
 submit.className='danger';submit.textContent='Remove entry';
}
export function receiptPanel(order){
 const read=can('receipt.read'),add=can('receipt.add')&&order.approvedAt;
 if(practiceMode||!can('workorders.view')||!read&&!add)return '';
 const images=read?(order.receipts||[]):[];
 return '<section class="panel"><div class="flex"><h2>Receipts</h2>'+
  (add?'<button class="secondary small" data-receipt-add="'+esc(order.id)+'">+ Add Receipt</button>':'')+'</div>'+
  (images.length?images.map(file=>'<div class="list-item"><div><b>'+esc(file.name)+
  '</b><div class="muted tiny">'+esc(file.uploadedName||'')+' · '+esc(String(file.uploadedAt||'').slice(0,10))+
  (file.entryId?' · '+esc(order.entries.find(entry=>entry.id===file.entryId)?.name||'Material entry'):'')+
  '</div></div><button class="rowlink" data-receipt-view="'+esc(file.id)+'" data-workorder-id="'+esc(order.id)+'">View photo</button></div>').join(''):
  read?'<p class="muted">No receipt photos recorded.</p>':'')+'</section>';
}
function addReceipt(order){
 const material=order.entries.filter(entry=>entry.type==='material'&&(me?.role==='admin'||can('entry.manage')||entryOwner(entry)));
 const selected=material.length?f('entryId','Attach to',{select:[['','Work order'],...material.map(entry=>[entry.id,entry.name+' · '+entry.date])] }):'';
 const uploadId=crypto.randomUUID();
 modal('Add receipt photo',selected+receiptPicker(),async values=>{
  const photo=await receiptPayload(values.receiptPhoto,uploadId);
  if(!photo)throw Error('Take or select a receipt photo');
  await send('receipt.add',{...photo,workorderId:order.id,entryId:values.entryId||null});
 });
}
export async function readReceiptPhoto(action,payload){
 try{
  const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data:payload})});
  const file=await response.json();
  if(!response.ok||!file.ok)throw Error(file.error||'Could not open receipt');
  const {name,mime,content}=file.result;
  if(!['image/jpeg','image/png'].includes(mime)||typeof content!=='string'||content.length>320000||!(/^[A-Za-z0-9+/]+={0,2}$/).test(content))throw Error('Receipt photo could not be displayed');
  modal(name||'Receipt photo','<img class="bci-receipt-photo" src="data:'+mime+';base64,'+content+'" alt="Receipt photo">',()=>{});
  document.querySelector('#actionForm button[type=submit]').textContent='Close';
 }catch(error){show(error.message,true);}
}
function viewReceipt(order,id){return readReceiptPhoto('receipt.read',{workorderId:order.id,id});}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-entry-mode],[data-entry-edit],[data-entry-remove],[data-receipt-add],[data-receipt-view]');
 if(!button||practiceMode)return;
 const order=wo(button.dataset.entryMode||button.dataset.workorderId||button.dataset.receiptAdd);
 if(!order)return;
 if(button.dataset.entryMode){
  if(!anyEntryAction(order))return;
  editingOrder=entryEditing(order)?null:order.id;render();return;
 }
 if(button.dataset.receiptAdd&&can('workorders.view')&&can('receipt.add')&&order.approvedAt)return addReceipt(order);
 if(button.dataset.receiptView&&can('workorders.view')&&can('receipt.read'))return viewReceipt(order,button.dataset.receiptView);
 const entry=order.entries.find(row=>row.id===(button.dataset.entryEdit||button.dataset.entryRemove));
 if(!entry||!entryEditing(order))return;
 if(button.dataset.entryEdit&&canEditEntry(order,entry))return editEntry(order,entry);
 if(button.dataset.entryRemove&&canRemoveEntry(order,entry))return removeEntry(order,entry);
});
