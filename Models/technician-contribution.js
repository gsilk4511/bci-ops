import {internalOrder} from './project-workflow.js';

const emailKey=value=>typeof value==='string'?value.trim().toLowerCase():'';
const trustedEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey(value))?emailKey(value):'';
const invoiceKey=invoice=>typeof invoice?.number==='string'?invoice.number.trim().toLowerCase():'';
const validNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const validHours=n=>validNumber(n)&&n>0;
const finalized=invoice=>['sent','paid'].includes(invoice?.status)&&!!invoice.sentAt&&!invoice.voidedAt&&!invoice.void;
const rounding=n=>Math.round((n+Number.EPSILON)*100);
const excludedTypes=new Set(['tax','deposit','deposit-credit']);
const billableTypes=new Set(['labor','material','travel']);

function indexUnique(rows,getKey){
 const map=new Map(),duplicates=new Set();
 for(const row of rows){
  const key=getKey(row);
  if(!key)continue;
  if(map.has(key))duplicates.add(key);
  else map.set(key,row);
 }
 return {map,duplicates};
}
function allocate(totalCents,hours,email){
 const totalHours=[...hours.values()].reduce((sum,h)=>sum+h,0);
 const shares=[...hours].map(([key,h])=>{
  const exact=h/totalHours*totalCents,whole=Math.floor(exact);
  return {key,whole,remainder:exact-whole};
 }).sort((a,b)=>b.remainder-a.remainder||(a.key<b.key?-1:a.key>b.key?1:0));
 const extra=totalCents-shares.reduce((sum,s)=>sum+s.whole,0);
 const rank=shares.findIndex(item=>item.key===email);
 return {cents:rank<0?0:shares[rank].whole+(rank<extra?1:0),totalHours};
}

export function technicianContribution(state,identity){
 const email=trustedEmail(identity);
 const scope=state?.workorders||[];
 const snapshots=state?.projectInvoices||[];
 const {map:orders,duplicates:duplicateOrders}=indexUnique(scope,w=>w.id);
 const {map:documents,duplicates:duplicateDocuments}=indexUnique(snapshots,i=>i.id);
 const byNumber=new Map(),linkedOrders=new Map();
 const register=(reference,key)=>{
  if(!reference)return;
  if(!byNumber.has(reference))byNumber.set(reference,new Set());
  byNumber.get(reference).add(key);
 };
 for(const invoice of snapshots){
  register(invoiceKey(invoice),'group:'+invoice.id);
  for(const row of Array.isArray(invoice.orders)?invoice.orders:[]){
   if(!linkedOrders.has(row.id))linkedOrders.set(row.id,new Set());
   linkedOrders.get(row.id).add(invoice.id);
  }
 }
 for(const order of scope){
  if(order.invoice)register(invoiceKey(order.invoice),order.invoice.groupId?'group:'+order.invoice.groupId:'single:'+order.id);
 }
 const projects=new Map();
 const coverage={includedOrders:0,excludedOrders:0,unlinkedLaborOrders:0,unsupportedLegacyOrders:0};
 let totalAttributedCents=0;
 for(const order of orders.values()){
  // A material or travel entry alone is not participation; never match on display name.
  if(!email||order.billingHidden||internalOrder(state,order)||!finalized(order.invoice))continue;
  const entries=Array.isArray(order.entries)?order.entries:[];
  if(!entries.some(entry=>entry.type==='labor'&&trustedEmail(entry.employeeEmail)===email))continue;
  const group=order.invoice.groupId;
  if(!group){coverage.unsupportedLegacyOrders++;coverage.excludedOrders++;continue;}
  const invoice=documents.get(group), number=invoiceKey(order.invoice);
  if(duplicateOrders.has(order.id)||duplicateDocuments.has(group)||!invoice||invoice.voidedAt||invoice.void||!invoice.sentAt||
    (invoice.status&&!['sent','paid','open'].includes(invoice.status))||!number||invoiceKey(invoice)!==number||byNumber.get(number)?.size!==1||
    invoice.projectId!==order.projectId||!order.closeout?.reviewedAt||linkedOrders.get(order.id)?.size!==1||
    !Array.isArray(invoice.orders)){
   coverage.excludedOrders++;continue;
  }
  const invoiceOrders=invoice.orders.filter(row=>row.id===order.id);
  if(invoiceOrders.length!==1||!Array.isArray(invoiceOrders[0].entries)){coverage.excludedOrders++;continue;}
  const source=invoiceOrders[0].entries;
  const current=indexUnique(entries,e=>e.id);
  const snap=indexUnique(source,e=>e.id);
  const hours=new Map();
  let grossCents=0,unsafe=false,unlinked=false;
  for(const line of source){
   if(excludedTypes.has(line.type))continue;
   if(!billableTypes.has(line.type)||!line.id||snap.duplicates.has(line.id)||!validHours(line.quantity)||!validNumber(line.rate)){
    unsafe=true;break;
   }
   grossCents+=rounding(line.quantity*line.rate);
   if(!Number.isSafeInteger(grossCents)){unsafe=true;break;}
   if(line.type!=='labor')continue;
   if(line.unit!=='hr'){unsafe=true;break;}
   const attached=current.map.get(line.id);
   const corroborated=attached&&attached.type===line.type&&attached.quantity===line.quantity&&attached.rate===line.rate&&
    attached.unit===line.unit&&attached.catalogId===line.catalogId&&attached.date===line.date&&!current.duplicates.has(line.id);
   const key=corroborated?trustedEmail(attached.employeeEmail):'';
   if(!key)unlinked=true;
   hours.set(key,(hours.get(key)||0)+line.quantity);
  }
  // Do not award all revenue to confirmed employees when someone else's snapshot labor is anonymous.
  // Anonymous hours remain in the denominator and their share is left unattributed.
  if(unsafe||!validHours(hours.get(email))){coverage.excludedOrders++;continue;}
  const {cents,totalHours}=allocate(grossCents,hours,email);
  if(!Number.isSafeInteger(totalAttributedCents+cents)){coverage.excludedOrders++;continue;}
  if(unlinked)coverage.unlinkedLaborOrders++;
  coverage.includedOrders++;
  totalAttributedCents+=cents;
  const existing=projects.get(order.projectId)||{projectId:order.projectId,attributedCents:0,laborHours:0,totalLaborHours:0,orderCount:0};
  existing.attributedCents+=cents;
  existing.laborHours+=hours.get(email);
  existing.totalLaborHours+=totalHours;
  existing.orderCount++;
  projects.set(order.projectId,existing);
 }
 return {
  status:!coverage.includedOrders?'unavailable':coverage.excludedOrders||coverage.unlinkedLaborOrders?'partial':'available',
  basis:'Grouped invoice work-order charges before deposits or tax, allocated by recorded on-job labor hours. Travel hours do not earn credit; legacy invoices without a matching snapshot are excluded.',
  totalAttributedCents:coverage.includedOrders?totalAttributedCents:null,
  projects:[...projects.values()].sort((a,b)=>b.attributedCents-a.attributedCents||(a.projectId<b.projectId?-1:1)),
  coverage,profit:null,employmentCost:null,
 };
}
