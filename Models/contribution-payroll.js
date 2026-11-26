import {employeeKey,payrollEntries,validDate} from './payroll.js';
import {isWorkedTime,profileTimeRows} from './staff-weekly-time.js';

const types=new Set(['labor','travel','shop','pto','sick','holiday']);
const worked=new Set(['labor','travel','shop']);
const epsilon=1e-7;
const day=value=>{try{return Boolean(validDate(value));}catch{return false;}};
const periodOrder=(a,b)=>a.date.localeCompare(b.date)||(a.startTime||'').localeCompare(b.startTime||'')||String(a.id).localeCompare(String(b.id));
const allocateOvertime=(rows,total,output)=>{
 let remaining=total;
 for(const row of [...rows].sort(periodOrder).reverse()){
  const overtime=Math.min(row.quantity,remaining);
  output.set(row.id,Math.max(0,overtime));
  remaining-=overtime;
 }
};
// The payroll ledger is the authoritative source for payable time. Invoice
// status is applied separately as a Cash eligibility filter to billable jobs.
export function contributionPayroll(state,email,{today,year,mode,wages,fallbackWage,isCashJob,asOf}){
 const runs=state.payrollRuns||[];
 const live=mode==='cash'?payrollEntries({...state,projects:state.projects||[],workorders:state.workorders||[]})
  .filter(row=>employeeKey(row.employeeEmail||row.tech)===email&&types.has(row.type)&&row.date<=today):[];
 const cashRevenueIds=new Set(), currentById=new Map(), duplicates=new Set(), source=[];
 const workToOrder=new Map();
 for(const order of state.workorders||[])for(const row of order.entries||[]){
  if(row.type==='labor'||row.type==='travel')workToOrder.set(row.id,order);
 }
 const overtime=new Map();
 for(const row of live){if(currentById.has(row.id))duplicates.add(row.id);else currentById.set(row.id,row);}
 const valid=row=>day(row.date)&&Boolean(row.id)&&!duplicates.has(row.id)&&Number.isFinite(row.quantity)&&row.quantity>0&&
  (!row.unit||/^(hr|hour|hours|h)$/i.test(row.unit));
 let missingHours=0, fallbackRows=0;
 const issues=[], pricedIds=new Set();
 const flag=(row,reason)=>{
  missingHours++;
  if(mode==='accrual')issues.push({date:day(row.date)?row.date:null,type:row.type,reason});
 };
 if(mode==='cash'){
  const seen=new Set();
  for(const run of runs){
   if(!day(run.start)||!day(run.end)||!Number.isFinite(Date.parse(run.approvedAt))||!Number.isFinite(Date.parse(run.paidAt))||
     Date.parse(run.paidAt)<Date.parse(run.approvedAt)||
     Date.parse(run.paidAt)>+asOf||
     !Array.isArray(run.entries))continue;
   const approved=run.entries.filter(row=>employeeKey(row.employeeEmail||row.tech)===email&&types.has(row.type)&&
     row.date>=run.start&&row.date<=run.end&&row.date<=today);
   const approvedHours=approved.filter(row=>worked.has(row.type)&&valid(row));
   const approvedOT=run.rows?.find(row=>row.key===email)?.overtime;
   if(Number.isFinite(approvedOT)&&approvedOT>=0&&approvedOT<=approvedHours.reduce((sum,row)=>sum+row.quantity,0)+epsilon)
    allocateOvertime(approvedHours,approvedOT,overtime);
   for(const row of approved){
    if(!row.date.startsWith(year+'-'))continue;
    const order=workToOrder.get(row.id);
    if(order&&isCashJob(order,row)===null)continue;
    if(!valid(row)||seen.has(row.id)||worked.has(row.type)&&!overtime.has(row.id)){missingHours++;continue;}
    seen.add(row.id);
    // Match the locked labor to current immutable identifiers before recognizing invoice revenue.
    const current=currentById.get(row.id);
    if(order&&(!current||current.date!==row.date||current.quantity!==row.quantity||current.type!==row.type||
     current.startTime!==row.startTime||current.endTime!==row.endTime)){missingHours++;continue;}
    if(order&&row.type==='labor')cashRevenueIds.add(row.id);
    source.push(row);
   }
  }
 }else{
  for(const {row,valid:usable} of profileTimeRows(state,email,year+'-01-01',today)){
   if(!isWorkedTime(row))continue;
   if(!usable){flag(row,'invalid-hours');continue;}
   source.push(row);
  }
 }
 const wagesByOrder=new Map();
 let grossWages=0, hours=0, incomplete=false;
 for(const row of source){
  const wage=wages.find(wage=>wage.date<=row.date);
  const fallback=mode==='accrual'&&!wage&&Number.isSafeInteger(fallbackWage)&&fallbackWage>=0;
  const cents=fallback?fallbackWage:wage?.cents;
  hours+=row.quantity;
  if(cents==null){flag(row,'missing-wage');continue;}
  const gross=(row.quantity+(overtime.get(row.id)||0)*.5)*cents;
  if(!Number.isFinite(gross)||grossWages+gross>Number.MAX_SAFE_INTEGER/2){incomplete=true;if(mode==='accrual')flag(row,'cost-overflow');continue;}
  grossWages+=gross;
  pricedIds.add(row.id);
  if(fallback)fallbackRows++;
  const order=workToOrder.get(row.id)?.id??null;
  wagesByOrder.set(order,(wagesByOrder.get(order)||0)+gross);
 }
 // Compute wages to cents first, then load by 25% at the employee-period level.
 // Allocate the resulting cents back to project buckets without losing a cent.
 const total=Math.round(Math.round(grossWages)*1.25);
 const allocations=[...wagesByOrder].map(([key,value])=>{
  const exact=grossWages?total*(value/grossWages):0,floor=Math.floor(exact);
  return {key,floor,remainder:exact-floor};
 }).sort((a,b)=>b.remainder-a.remainder||String(a.key).localeCompare(String(b.key)));
 const leftover=total-allocations.reduce((sum,row)=>sum+row.floor,0);
 const costs=new Map(allocations.map((row,index)=>[row.key,row.floor+(index<leftover?1:0)]));
 const unassignedCost=costs.get(null)||0;
 costs.delete(null);
 return {hrs:hours,hasRows:source.length>0,total,unassignedCost,costs,cashRevenueIds,missingHours,incomplete,pricedIds,fallbackRows,issues,straightTimeOnly:mode==='accrual'&&source.length>0};
}
