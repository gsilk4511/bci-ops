import {attributedEmail} from './time-attribution.js';
import {internalOrder} from './project-workflow.js';

const emailKey=value=>typeof value==='string'?value.trim().toLowerCase():'';
const trustedEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey(value))?emailKey(value):'';
const invoiceKey=invoice=>typeof invoice?.number==='string'?invoice.number.trim().toLowerCase():'';
const validNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const validHours=n=>validNumber(n)&&n>0;
const finalized=(invoice,checkMissingDate=false)=>['sent','paid'].includes(invoice?.status)&&(checkMissingDate||!!invoice.sentAt)&&!invoice.voidedAt&&!invoice.void;
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

const easternDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
const daysOf=date=>easternDay.format(date);
const recordedTime=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return NaN;
 const day=value.slice(0,10),calendar=new Date(day+'T00:00:00.000Z');
 if(!Number.isFinite(+calendar)||calendar.toISOString().slice(0,10)!==day)return NaN;
 return Date.parse(value);
};
export function nearestDecemberFriday(year){
 if(!Number.isInteger(year)||year<1000||year>9999)return null;
 const date=new Date(Date.UTC(year,11,15));
 const daysForward=(5-date.getUTCDay()+7)%7;
 date.setUTCDate(15+(daysForward<=3?daysForward:daysForward-7));
 return date.toISOString().slice(0,10);
}
const validDay=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const calendar=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(+calendar)&&calendar.toISOString().slice(0,10)===value;
};
function wageTable(history){
 const index=indexUnique(Array.isArray(history)?history.filter(row=>row&&validDay(row.effectiveDate)):[],row=>row.effectiveDate);
 return [...index.map].sort(([a],[b])=>b.localeCompare(a)).map(([date,row])=>({
  date,cents:!index.duplicates.has(date)&&Number.isSafeInteger(row.hourlyCents)&&row.hourlyCents>=0?row.hourlyCents:null
 }));
}
export function technicianContribution(state,identity,options){
 const withCosts=options!=null;
 const asOf=options?.now instanceof Date&&Number.isFinite(+options.now)?options.now:new Date();
 const year=options?.year??Number(daysOf(asOf).slice(0,4));
 const payoutDate=nearestDecemberFriday(year);
 const profitShareBps=Number.isInteger(options?.profitShareBps)&&options.profitShareBps>=0&&options.profitShareBps<=10000?options.profitShareBps:500;
 const wages=wageTable(options?.wageHistory);
 const inYear=time=>elapsed(time)&&daysOf(new Date(time)).startsWith(year+'-');
 const elapsed=time=>Number.isFinite(time)&&time<=+asOf;
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
 if(withCosts)Object.assign(coverage,{missingCostOrders:0,missingWageOrders:0,scopeIncomplete:options.scopeIncomplete===true});
 let totalAttributedCents=0,totalEmploymentCostCents=0,totalNetProfitCents=0;
 for(const order of orders.values()){
  // A material or travel entry alone is not participation; never match on display name.
  if(!email||order.billingHidden||internalOrder(state,order)||!finalized(order.invoice,withCosts))continue;
  const entries=Array.isArray(order.entries)?order.entries:[];
  if(!entries.some(entry=>entry.type==='labor'&&trustedEmail(attributedEmail(entry))===email))continue;
  const group=order.invoice.groupId;
  const orderTime=withCosts?recordedTime(order.invoice.sentAt):null;
  if(withCosts&&Number.isFinite(orderTime)&&!inYear(orderTime))continue;
  const number=invoiceKey(order.invoice);
  let source;
  if(!group){
   // Standalone records date back to invoice.record and carry no invoice document.
   // A complete office-reviewed closeout with identical locked labor is the only safe fallback.
   const original=order.closeout?.originalEntries;
   if(!withCosts||!payoutDate||!inYear(orderTime)||duplicateOrders.has(order.id)||!number||byNumber.get(number)?.size!==1||
    linkedOrders.has(order.id)||!order.closeout?.reviewedAt||!Array.isArray(original)){
    coverage.unsupportedLegacyOrders++;coverage.excludedOrders++;continue;
   }
   const currentLabor=entries.filter(line=>line.type==='labor');
   const originalLabor=original.filter(line=>line.type==='labor');
   const laborIndex=indexUnique(currentLabor,line=>line.id);
   const frozenIndex=indexUnique(originalLabor,line=>line.id);
   const keys=['id','type','quantity','rate','unit','catalogId','date','startTime','endTime'];
   const matching=currentLabor.length===originalLabor.length&&laborIndex.map.size===currentLabor.length&&
     frozenIndex.map.size===originalLabor.length&&!laborIndex.duplicates.size&&!frozenIndex.duplicates.size&&originalLabor.every(line=>{
      const attached=laborIndex.map.get(line.id);
      return attached&&keys.every(key=>attached[key]===line[key])&&trustedEmail(line.employeeEmail)===trustedEmail(attached.employeeEmail);
     });
   if(!matching){coverage.unsupportedLegacyOrders++;coverage.excludedOrders++;continue;}
   source=originalLabor;
  }else{
   const invoice=documents.get(group);
   if(withCosts&&(!payoutDate||!inYear(orderTime)||recordedTime(invoice?.sentAt)!==orderTime)){
    coverage.excludedOrders++;continue;
   }
   if(duplicateOrders.has(order.id)||duplicateDocuments.has(group)||!invoice||invoice.voidedAt||invoice.void||!invoice.sentAt||
     (invoice.status&&!['sent','paid','open'].includes(invoice.status))||!number||invoiceKey(invoice)!==number||byNumber.get(number)?.size!==1||
     invoice.projectId!==order.projectId||!order.closeout?.reviewedAt||linkedOrders.get(order.id)?.size!==1||
     !Array.isArray(invoice.orders)){
    coverage.excludedOrders++;continue;
   }
   const invoiceOrders=invoice.orders.filter(row=>row.id===order.id);
   if(invoiceOrders.length!==1||!Array.isArray(invoiceOrders[0].entries)){coverage.excludedOrders++;continue;}
   source=invoiceOrders[0].entries;
  }
  const current=indexUnique(entries,e=>e.id);
  const snap=indexUnique(source,e=>e.id);
  const hours=new Map();
  let grossCents=0,ownCents=0,employmentCents=0,missingWage=false,unsafe=false,unlinked=false;
  for(const line of source){
   if(withCosts?line.type!=='labor':excludedTypes.has(line.type))continue;
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
   const key=corroborated?trustedEmail(attributedEmail(attached)):'';
   if(!key)unlinked=true;
   hours.set(key,(hours.get(key)||0)+line.quantity);
   if(withCosts&&key===email){
    ownCents+=rounding(line.quantity*line.rate);
    const wage=validDay(line.date)&&wages.find(item=>item.date<=line.date);
    if(!wage||wage.cents==null)missingWage=true;
    else employmentCents+=Math.round(line.quantity*wage.cents*1.25);
   }
  }
  // Do not award all revenue to confirmed employees when someone else's snapshot labor is anonymous.
  // Anonymous hours remain in the denominator and their share is left unattributed.
  if(unsafe||!validHours(hours.get(email))){coverage.excludedOrders++;continue;}
  const {cents,totalHours}=withCosts?{cents:ownCents,totalHours:[...hours.values()].reduce((sum,n)=>sum+n,0)}:allocate(grossCents,hours,email);
  if(!Number.isSafeInteger(totalAttributedCents+cents)){coverage.excludedOrders++;continue;}
  let employmentCostCents=0,netProfitCents=0;
  if(withCosts){
   employmentCostCents=employmentCents;
   netProfitCents=cents-employmentCostCents;
   if(missingWage||!Number.isSafeInteger(employmentCostCents)||!Number.isSafeInteger(totalEmploymentCostCents+employmentCostCents)||!Number.isSafeInteger(totalNetProfitCents+netProfitCents)){
    coverage.missingCostOrders++;
    coverage.missingWageOrders++;
    employmentCostCents=0;netProfitCents=0;
   }
  }
  if(unlinked)coverage.unlinkedLaborOrders++;
  coverage.includedOrders++;
  totalAttributedCents+=cents;
  const existing=projects.get(order.projectId)||{projectId:order.projectId,attributedCents:0,laborHours:0,totalLaborHours:0,orderCount:0};
  existing.attributedCents+=cents;
  existing.laborHours+=hours.get(email);
  existing.totalLaborHours+=totalHours;
  existing.orderCount++;
  if(withCosts){
   existing.employmentCostCents=(existing.employmentCostCents||0)+employmentCostCents;
   existing.netProfitCents=(existing.netProfitCents||0)+netProfitCents;
   totalEmploymentCostCents+=employmentCostCents;
   totalNetProfitCents+=netProfitCents;
  }
  projects.set(order.projectId,existing);
 }
 const verifiedCosts=withCosts&&coverage.includedOrders>0&&!coverage.excludedOrders&&!coverage.unlinkedLaborOrders&&!coverage.missingCostOrders&&!coverage.scopeIncomplete;
 if(withCosts&&!verifiedCosts)for(const row of projects.values()){
  row.employmentCostCents=null;
  row.netProfitCents=null;
 }
 const projectedCents=verifiedCosts&&profitShareBps!=null?
  Number((BigInt(Math.max(0,totalNetProfitCents))*BigInt(profitShareBps)+5000n)/10000n):null;
 return {
  ...(withCosts?{totalEmploymentCostCents:verifiedCosts?totalEmploymentCostCents:null,totalNetProfitCents:verifiedCosts?totalNetProfitCents:null,
   bonus:{status:projectedCents==null?'unavailable':'available',profitShareBps,projectedCents,year,payoutDate}}:{}),
  status:!coverage.includedOrders?'unavailable':coverage.excludedOrders||coverage.unlinkedLaborOrders||coverage.scopeIncomplete?'partial':'available',
  basis:withCosts?'Own verified invoiced work labor, at the recorded customer labor rate. Employment cost uses the effective hourly wage for each work date plus 25%. Parts, travel, and leave are excluded.':'Grouped invoice work-order charges before deposits or tax, allocated by recorded on-job labor hours. Travel hours do not earn credit; legacy invoices without a matching snapshot are excluded.',
  totalAttributedCents:coverage.includedOrders?totalAttributedCents:null,
  projects:[...projects.values()].sort((a,b)=>b.attributedCents-a.attributedCents||(a.projectId<b.projectId?-1:1)),
  coverage,profit:null,employmentCost:null,
 };
}

// Staff projection from the current work ledger, not the invoice or payment ledger.
// Leave the older invoice-only calculator intact for historical use.
export const ownLiveLabor=(line,email)=>line.type==='labor'&&trustedEmail(attributedEmail(line))===email;
export const possibleLiveDay=(day,year,today)=>!validDay(day)||(day.startsWith(year+'-')&&day<=today);
export function liveTechnicianContribution(state,identity,options={}){
 const email=trustedEmail(identity);
 const today=daysOf(options.now??new Date());
 const year=options.year??Number(today.slice(0,4));
 const basis='Own logged customer work at the recorded labor rate. Employment cost applies the wage effective for the work date plus 25%. Invoice and payment dates do not control the estimate.';
 const profitShareBps=Number.isInteger(options.profitShareBps)&&options.profitShareBps>=0&&options.profitShareBps<=10000?options.profitShareBps:500;
 const wages=wageTable(options.wageHistory);
 const coverage={includedOrders:0,excludedOrders:0,missingWageOrders:0,missingCostOrders:0,scopeIncomplete:options.scopeIncomplete===true};
 const {map:orders,duplicates}=indexUnique(state.workorders||[],row=>row.id);
 const projects=new Map();
 let revenue=0,cost=0,profit=0;
 for(const order of orders.values()){
  if(!email||order.billingHidden||internalOrder(state,order))continue;
  const entries=order.entries||[];
  const labor=entries.filter(row=>ownLiveLabor(row,email)&&possibleLiveDay(row.date,year,today));
  if(!labor.length)continue;
  const {duplicates:repeatedLines}=indexUnique(entries,row=>row.id);
  if(duplicates.has(order.id)||labor.some(row=>!validDay(row.date)||!row.id||repeatedLines.has(row.id)||
    !/^(hr|hour|hours|h)$/i.test(row.unit)||!validHours(row.quantity)||!validNumber(row.rate))){
   coverage.excludedOrders++;continue;
  }
  let amount=0,loaded=0,hours=0,missing=false;
  for(const row of labor){
   const effective=wages.find(wage=>wage.date<=row.date);
   amount+=rounding(row.quantity*row.rate);
   hours+=row.quantity;
   if(!effective||effective.cents==null)missing=true;
   else loaded+=Math.round(row.quantity*effective.cents*1.25);
  }
  if(!Number.isSafeInteger(revenue+amount)){coverage.excludedOrders++;continue;}
  if(missing||![loaded,cost+loaded,profit+amount-loaded].every(Number.isSafeInteger)){
   coverage.missingWageOrders++;coverage.missingCostOrders++;loaded=0;
  }
  coverage.includedOrders++;
  const project=projects.get(order.projectId)||{projectId:order.projectId,attributedCents:0,laborHours:0,orderCount:0,employmentCostCents:0,netProfitCents:0};
  project.attributedCents+=amount;
  project.laborHours+=hours;
  project.orderCount++;
  project.employmentCostCents+=loaded;
  project.netProfitCents+=amount-loaded;
  projects.set(order.projectId,project);
  revenue+=amount;cost+=loaded;profit+=amount-loaded;
 }
 const partial=coverage.excludedOrders>0||coverage.scopeIncomplete;
 const verified=coverage.includedOrders>0&&!partial&&!coverage.missingCostOrders;
 if(!verified)for(const row of projects.values()){row.employmentCostCents=null;row.netProfitCents=null;}
 const projectedCents=verified?Number((BigInt(Math.max(0,profit))*BigInt(profitShareBps)+5000n)/10000n):null;
 return {status:!coverage.includedOrders?'unavailable':partial?'partial':'available',basis,
  totalAttributedCents:coverage.includedOrders?revenue:null,totalEmploymentCostCents:verified?cost:null,totalNetProfitCents:verified?profit:null,
  projects:[...projects.values()].sort((a,b)=>b.attributedCents-a.attributedCents||String(a.projectId).localeCompare(String(b.projectId))),coverage,
  bonus:{status:projectedCents==null?'unavailable':'available',profitShareBps,projectedCents,year,payoutDate:nearestDecemberFriday(year)}};
}
export const liveContributionToday=daysOf;
