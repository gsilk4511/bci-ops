import {createHash,randomUUID} from 'node:crypto';
import {checkReceiptPhoto} from './work-entry.js';
import {reconcileStock, WAREHOUSE_LOCATION} from './stock-demand.js';

const at=()=>new Date().toISOString();
const warehouseDate=timestamp=>{
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));
 const field=value=>date.find(part=>part.type===value)?.value;
 return [field('year'),field('month'),field('day')].join('-');
};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const short=(value,label,max)=>{
 if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(label+' is required (max '+max+' characters)');
 return value.trim();
};
const warehouseNumber=(value,label,{positive=false}={})=>{
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)>1e6||
    (positive?Number(value)<=0:Number(value)<0))throw Error('Enter a valid '+label);
 return Number(value);
};
const hasPhoto=(state,receiptId)=>Boolean(receiptId&&typeof state.workorderReceiptData?.[receiptId]==='string');
const positiveCount=quantity=>typeof quantity==='number'&&Number.isFinite(quantity)&&quantity>0&&quantity<=1e6&&round(quantity)===quantity;
const need=(principal,...keys)=>keys.every(key=>principal.permissions.includes(key));
const narrow=scope=>['own','assigned','none'].includes(scope);
const usableWarehouse=principal=>need(principal,'inventory.view')&&(!narrow(principal.recordScopes?.inventory)||principal.role==='admin');
const usableField=principal=>usableWarehouse(principal)&&need(principal,'workorders.view','receipt.read');

function addReceiptMovement(state,actor,{catalogId,quantity,type,note,warehouseReceiptId,sourceWorkorderId,sourceWorkorderTitle,at:timestamp=at()}){
 let stock=state.inventory.find(x=>x.catalogId===catalogId&&x.location===WAREHOUSE_LOCATION);
 if(!stock){stock={id:randomUUID(),catalogId,quantity:0,location:WAREHOUSE_LOCATION};state.inventory.push(stock);}
 stock.quantity=round(stock.quantity+quantity);
 const movement={id:randomUUID(),at:timestamp,type,catalogId,quantity,location:WAREHOUSE_LOCATION,
  workorderId:null,note,actor:actor.email,warehouseReceiptId:warehouseReceiptId||null};
 if(sourceWorkorderId)Object.assign(movement,{sourceWorkorderId,sourceWorkorderTitle});
 state.movements.unshift(movement);
 return movement;
}
export function receiveWarehouseParts(state,data,actor){
 const item=state.catalog.find(row=>row.id===data.catalogId&&row.type==='material');
 if(!item)throw Error('Select a material part');
 const quantity=round(warehouseNumber(data.quantity,'quantity',{positive:true}));
 if(!positiveCount(quantity)||quantity!==Number(data.quantity))throw Error('Enter a positive quantity to two decimal places');
 const unitCost=data.unitCost==null?null:warehouseNumber(data.unitCost,'unit cost');
 const vendor=data.vendor==null||data.vendor===''?'Unspecified vendor':short(data.vendor,'Supplier',250);
 const reference=data.reference==null||data.reference===''?'':short(data.reference,'Reference',100);
 if(!uuid(data.submissionId))throw Error('Invalid Warehouse receipt submission');
 const receipt=data.receipt==null?null:checkReceiptPhoto(data.receipt);
 const fingerprint=hash([item.id,quantity,unitCost,vendor,reference,receipt?.content||null]);
 const previous=state.purchases.find(row=>row.warehouseSubmissionId===data.submissionId&&row.receivedBy===actor.email);
 if(previous){
  if(previous.warehouseFingerprint!==fingerprint)throw Error('This Warehouse receipt was already recorded. Reopen Receive Parts to start a new receipt.');
  return warehouseReceiptResult(previous);
 }
 const timestamp=at(), receiptId=receipt?randomUUID():null;
 const purchase={id:randomUUID(),at:timestamp,date:warehouseDate(timestamp),vendor,catalogId:item.id,quantity,unitCost,
  location:WAREHOUSE_LOCATION,card:'',reference,category:'Materials',receiptId,receivedBy:actor.email,
  warehouseSubmissionId:data.submissionId,warehouseFingerprint:fingerprint};
 if(receiptId){
  const {content,mime,bytes}=receipt;
  (state.workorderReceiptData??={})[receiptId]=content;
  Object.assign(purchase,{receiptMime:mime,receiptBytes:bytes});
 }
 state.purchases.unshift(purchase);
 addReceiptMovement(state,actor,{catalogId:item.id,quantity,type:'receive',note:[vendor,reference].filter(Boolean).join(' · '),warehouseReceiptId:receiptId,at:timestamp});
 reconcileStock(state);
 return warehouseReceiptResult(purchase);
}
function warehouseReceiptResult({id,at,date,catalogId,quantity,location,receiptId}){
 return {id,at,date,catalogId,quantity,location,receiptId};
}

function evidenceIndex(state){
 const issues=new Map();
 for(const row of state.movements){
  if(row.type!=='issue'||!row.workorderId)continue;
  if(row.id)issues.set(row.id,row);
  const key=row.entryId&&row.workorderId+'\0'+row.entryId;
  // Movements are newest first. The current issue may have been corrected.
  if(key&&!issues.has(key))issues.set(key,row);
 }
 return issues;
}
function matchesIssue(move,order,entry){
 return Boolean(move&&move.workorderId===order.id&&move.catalogId===entry.catalogId&&
  (!move.entryId||move.entryId===entry.id)&&move.location===WAREHOUSE_LOCATION&&-move.quantity===entry.quantity);
}
function fieldEvidence(state,order,receipt,issues){
 if(!receipt.entryId&&!receipt.materialAtUpload?.entryId)return null; // Never infer from a general order receipt.
 const sourceId=receipt.materialAtUpload?.entryId||receipt.entryId;
 const entry=order.entries.find(item=>item.id===sourceId&&item.type==='material');
 const saved=receipt.materialAtUpload;
 const move=entry&&(issues.get(entry.stockMovementId)||issues.get(order.id+'\0'+entry.id));
 const attached=entry&&receipt.entryId===entry.id&&(!saved||
  saved.catalogId===entry.catalogId&&saved.quantity===entry.quantity&&saved.stockLocation===WAREHOUSE_LOCATION&&
  (!saved.stockMovementId||saved.stockMovementId===move?.id));
 const existed=Boolean(move?.at&&receipt.uploadedAt&&move.at<=receipt.uploadedAt);
 const legacyStockEdit=!saved&&(order.entryHistory||[]).some(change=>change.before?.id===sourceId&&change.at>=receipt.uploadedAt&&
   (change.before.catalogId!==change.after?.catalogId||change.before.quantity!==change.after?.quantity));
 const eligible=Boolean(attached&&!legacyStockEdit&&positiveCount(entry.quantity)&&matchesIssue(move,order,entry)&&existed&&hasPhoto(state,receipt.id));
 const source=saved||entry||{};
 return {eligible,entryId:sourceId,catalogId:source.catalogId,partName:source.partName||source.name,
  quantity:source.quantity,unit:source.unit,
  revision:hash([order.id,receipt.id,sourceId,source.catalogId,source.quantity,move?.id,move?.at,receipt.uploadedAt])};
}
function projectOrder(state,order,issues,archived=false){
 const receipts=order.receipts||[];
 const committedEntries=new Set(receipts.filter(receipt=>receipt.warehouseCommit).map(receipt=>receipt.warehouseCommit.entryId));
 const candidates=new Set();
 return receipts.flatMap(receipt=>{
  const commit=receipt.warehouseCommit;
  const evidence=!commit&&!archived&&fieldEvidence(state,order,receipt,issues);
  if(!commit&&!evidence)return [];
  const eligible=evidence?.eligible&&!committedEntries.has(evidence.entryId)&&!candidates.has(evidence.entryId);
  if(eligible)candidates.add(evidence.entryId);
  const source=commit||evidence;
  return [{id:receipt.id,workorderId:order.id,workorderTitle:order.title,entryId:source.entryId,catalogId:source.catalogId,
    partName:source.partName,quantity:source.quantity,unit:source.unit,at:receipt.uploadedAt,
    status:commit?'committed':eligible?'pending':'review',committedAt:commit?.at,
    revision:evidence?.revision,hasPhoto:hasPhoto(state,receipt.id),archived}];
 });
}
export function warehouseFieldPurchases(state,scoped,principal){
 if(!usableField(principal))return [];
 const orderList=(scoped.workorders||[]).filter(order=>order.receipts?.some(receipt=>receipt.entryId||receipt.materialAtUpload||receipt.warehouseCommit));
 const archived=principal.role==='admin'?(state.trash||[]).filter(row=>row.kind==='workorder'&&row.record.receipts?.some(file=>file.warehouseCommit)).map(row=>row.record):[];
 if(!orderList.length&&!archived.length)return [];
 const issues=orderList.length?evidenceIndex(state):new Map();
 return [...orderList.flatMap(order=>projectOrder(state,order,issues)),
  ...archived.flatMap(order=>projectOrder(state,order,issues,true))]
  .sort((a,b)=>String(b.at??'').localeCompare(String(a.at??'')));
}
export function commitFieldPurchase(state,data,actor){
 const order=state.workorders.find(row=>row.id===data.workorderId);
 const receipt=order?.receipts?.find(file=>file.id===data.id);
 if(!receipt)throw Error('Field receipt unavailable');
 if(receipt.warehouseCommit)return {...receipt.warehouseCommit,id:receipt.id,existing:true};
 const line=projectOrder(state,order,evidenceIndex(state)).find(row=>row.id===receipt.id);
 if(line?.status!=='pending')throw Error('This receipt cannot be matched to one unchanged Warehouse material issue. Review the order before adjusting stock.');
 if(data.revision!==line.revision)throw Error('The source material entry changed. Refresh Warehouse Activity before committing.');
 const {entryId,catalogId,quantity,unit,partName}=line;
 const movement=addReceiptMovement(state,actor,{catalogId,quantity,type:'field-purchase',note:'Field purchase committed to Warehouse',warehouseReceiptId:receipt.id,
  sourceWorkorderId:order.id,sourceWorkorderTitle:order.title});
 const commit={entryId,catalogId,quantity,unit,partName,at:movement.at,movementId:movement.id,committedBy:actor.email};
 receipt.warehouseCommit=commit;
 reconcileStock(state);
 return {...commit,id:receipt.id};
}

export function readWarehouseReceipt(state,scoped,principal,data){
 const unavailable=()=>{throw Error('Warehouse receipt unavailable');};
 if(!usableWarehouse(principal)||!uuid(data.id)||!hasPhoto(state,data.id))return unavailable();
 const direct=(scoped.purchases||[]).find(row=>row.receiptId===data.id&&row.warehouseSubmissionId);
 if(direct&&need(principal,'inventory.receive'))return {name:'Warehouse receipt',mime:direct.receiptMime,content:state.workorderReceiptData[data.id]};
 if(!usableField(principal))return unavailable();
 const archived=principal.role==='admin'?(state.trash||[]).filter(row=>row.kind==='workorder').map(row=>row.record):[];
 const orders=[...(scoped.workorders||[]),...archived];
 for(const order of orders){
  const receipt=order.receipts?.find(row=>row.id===data.id);
  if(receipt&&(receipt.entryId||receipt.materialAtUpload||receipt.warehouseCommit))
   return {name:receipt.name,mime:receipt.mime,content:state.workorderReceiptData[data.id]};
 }
 return unavailable();
}
