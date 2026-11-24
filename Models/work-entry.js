import {attributedEmail} from './time-attribution.js';
import {randomUUID} from 'node:crypto';
import {checkTimeEntry, employeeKey} from './payroll.js';
import {staffName} from './staff.js';
import {queueReview} from './tickets.js';
import {reconcileStock} from './stock-demand.js';

const at=()=>new Date().toISOString();
const timeTypes=new Set(['labor','travel']);
const own=(entry, actor)=>Boolean(actor?.email)&&Boolean(attributedEmail(entry)||String(entry.tech||'').includes('@'))&&employeeKey(attributedEmail(entry)||entry.tech)===employeeKey(actor.email);
export const mayEditWorkEntry=(entry,actor)=>actor?.role==='admin'||actor?.permissions?.includes('entry.manage')||own(entry,actor);
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export function stockMovement(state,order,entry,stock,quantity,type,actor){
 if(!quantity)return;
 let row=state.inventory.find(item=>item.catalogId===stock.catalogId&&item.location===stock.location);
 if(!row){row={id:randomUUID(),catalogId:stock.catalogId,location:stock.location,quantity:0};state.inventory.push(row);}
 const id=randomUUID();
 row.quantity=round(row.quantity+quantity);
 state.movements.unshift({id,at:at(),type,catalogId:stock.catalogId,location:stock.location,quantity,workorderId:order.id,
  entryId:entry?.id,note:entry?.description||'Work order archived/restored',actor:actor.email});
 return id;
}
function stockSource(state,order,entry){
 const location=entry.stockLocation;
 if(location)return {catalogId:entry.catalogId,location};
 const moves=(state.movements||[]).filter(move=>move.type==='issue'&&move.workorderId===order.id&&move.catalogId===entry.catalogId);
 const linked=moves.find(move=>move.entryId===entry.id||entry.stockMovementId===move.id);
 if(linked)return linked;
 const legacy=moves.filter(move=>!move.entryId&&round(move.quantity)===-round(entry.quantity));
 if(legacy.length===1&&(order.entries||[]).filter(row=>row.type==='material'&&row.catalogId===entry.catalogId&&!row.stockLocation&&round(row.quantity)===round(entry.quantity)).length===1)return legacy[0];
 throw Error('The original stock issue cannot be matched safely. Ask an administrator to reconcile stock before correcting this legacy row.');
}
export function logEntryChange(state,order,action,actor,before,after){
 (order.entryHistory??=[]).push({id:randomUUID(),action,actor:actor.email,at:at(),before:structuredClone(before),after:structuredClone(after)});
 (state.events??=[]).unshift({id:randomUUID(),action,actor:actor.email,at:at(),reference:order.id,detail:before.id});
}
export function editWorkEntry(state,order,action,data,actor,buildEntry){
 const before=order.entries.find(row=>row.id===data.entryId);
 if(!before||!mayEditWorkEntry(before,actor))throw Error('You can only edit entries recorded under your account');
 if((before.revision||'')!==data.revision)throw Error('This entry changed. Refresh and try again.');
 if(order.invoice||(state.projectInvoices||[]).some(inv=>inv.orders?.some(item=>item.id===order.id||item.workorderId===order.id)))throw Error('An invoice already contains this order. Use an invoice adjustment instead.');
 if(timeTypes.has(before.type))checkTimeEntry(state,{date:before.date});
 if(!order.approvedAt)throw Error('Release this work order before editing');
 if(action==='entry.remove'&&data.confirmation!=='remove')throw Error('Confirm this entry’s removal');
 if(action==='entry.remove'&&(typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>500))throw Error('Enter a removal reason up to 500 characters');
 const newEntry=action==='entry.update'?buildEntry(before):null;
 const samePart=before.type==='material'&&newEntry&&before.catalogId===newEntry.catalogId;
 const changesStock=before.type==='material'&&(!samePart||before.quantity!==newEntry.quantity);
 const source=changesStock?stockSource(state,order,before):null;
 if(newEntry){
  // Keep the original entry's identity and author, even when an administrator edits it.
  Object.assign(newEntry,{id:before.id,at:before.at,tech:before.tech,employeeEmail:before.employeeEmail,employeeAttribution:before.employeeAttribution,
   createdBy:before.createdBy,revision:randomUUID(),updatedAt:at(),updatedBy:actor.email});
  if(samePart)Object.assign(newEntry,{rate:before.rate,cost:before.cost});
  if(before.type==='material')newEntry.stockLocation=newEntry.stockLocation||source?.location||before.stockLocation;
 }
 if(changesStock){
  stockMovement(state,order,before,source,before.quantity,'entry-return',actor);
  if(newEntry){
   const destination={catalogId:newEntry.catalogId,location:newEntry.stockLocation||source.location};
   newEntry.stockLocation=destination.location;
   newEntry.stockMovementId=stockMovement(state,order,newEntry,destination,-newEntry.quantity,'issue',actor);
  }
 }
 order.entries=order.entries.flatMap(row=>row.id!==before.id?[row]:newEntry?[newEntry]:[]);
 if(!newEntry)for(const receipt of order.receipts||[])if(receipt.entryId===before.id)receipt.entryId=null;
 if(order.closeout){
  (order.closeoutHistory??=[]).push(structuredClone(order.closeout));
  if(order.entries.length){
   order.closeout={at:at(),submittedEmail:order.closeout.submittedEmail,submittedBy:order.closeout.submittedBy,
    originalEntries:structuredClone(order.entries),originalChanges:structuredClone(order.changes),originalApproval:structuredClone(order.approval)};
   order.status='ready-for-review';
   queueReview(state,order,actor);
  }else{
   order.closeout=null;order.status='released';
   const ticket=(state.tickets||[]).find(t=>t.kind==='review'&&t.workorderId===order.id);
   if(ticket){ticket.status='In progress';ticket.revision=randomUUID();}
  }
 }
 if(!newEntry&&timeTypes.has(before.type)){
  // Preserve the original evidence of an explicitly removed, erroneous time row.
  (state.timeCorrections??=[]).push({entry:structuredClone(before),workorderId:order.id,actor:actor.email,at:at(),reason:String(data.reason||'').slice(0,500)});
 }
 logEntryChange(state,order,action,actor,before,newEntry);
 reconcileStock(state);
 return {id:before.id};
}
export const receiptLimit=8;
const receiptByteLimit=240000;
const pngPrefix=Buffer.from([137,80,78,71,13,10,26,10]);
export function checkReceiptPhoto(data){
 // Current work-order read access permits receipt retrieval. Named files are never trusted
 // as paths; allow JPEG and PNG only, and expose no raw photo in state/overview responses.
 const content=typeof data.content==='string'?data.content:'';
 if(!content||content.length>Math.ceil(receiptByteLimit/3)*4||content.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(content))throw Error('Add a JPEG or PNG photo up to 240 KB');
 const bytes=Buffer.from(content,'base64');
 if(bytes.toString('base64')!==content||bytes.length>receiptByteLimit)throw Error('Invalid receipt photo');
 const mime=bytes.length>=12&&bytes.subarray(0,8).equals(pngPrefix)&&bytes.subarray(12,16).toString()==='IHDR'?'image/png':
  bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217?'image/jpeg':null;
 if(!mime)throw Error('Receipt must be a JPEG or PNG photo');
 const uploadId=typeof data.uploadId==='string'&&/^[\da-f-]{36}$/i.test(data.uploadId)?data.uploadId:null;
 return {uploadId,content,mime,bytes:bytes.length};
}
export function checkWorkReceipt(order,data,actor){
 if(!order.approvedAt)throw Error('Release the work order before attaching a receipt');
 if((order.receipts||[]).length>=receiptLimit)throw Error('This work order has reached its receipt limit of '+receiptLimit);
 const entryId=data.entryId||null;
 if(entryId&&!order.entries.some(entry=>entry.id===entryId&&entry.type==='material'&&mayEditWorkEntry(entry,actor)))throw Error('Choose one of your material entries');
 return {...checkReceiptPhoto(data),entryId};
}
export function saveWorkReceipt(state,order,data,actor,checked){
 const previous=(order.receipts||[]).find(file=>file.uploadId&&file.uploadId===data.uploadId&&file.uploadedBy===actor.email);
 if(previous)return {id:previous.id,existing:true};
 const {content,...file}=checked||checkWorkReceipt(order,data,actor);
 const id=randomUUID();
 const receipt={id,...file,name:'Receipt '+((order.receipts||[]).length+1),uploadedAt:at(),uploadedBy:actor.email,uploadedName:staffName(state,actor.email)};
 const entry=order.entries.find(row=>row.id===file.entryId&&row.type==='material');
 if(entry)receipt.materialAtUpload={entryId:entry.id,catalogId:entry.catalogId,quantity:entry.quantity,
  unit:entry.unit,partName:entry.name,stockLocation:entry.stockLocation,stockMovementId:entry.stockMovementId};
 (state.workorderReceiptData??={})[id]=content;
 (order.receipts??=[]).push(receipt);
 (state.events??=[]).unshift({id:randomUUID(),action:'receipt.add',actor:actor.email,reference:order.id,detail:id,at:at()});
 return {id};
}
export function readWorkReceipt(state,data){
 const order=state.workorders.find(order=>order.id===data.workorderId);
 const file=order?.receipts?.find(file=>file.id===data.id);
 if(!file||!Object.hasOwn(state.workorderReceiptData||{},file.id))throw Error('Receipt unavailable');
 return {name:file.name,mime:file.mime,content:state.workorderReceiptData[file.id]};
}
