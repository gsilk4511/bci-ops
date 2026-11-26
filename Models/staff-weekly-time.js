import {employeeKey,payrollEntries,validDate} from './payroll.js';

const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
export const workweekStart=value=>Number.isInteger(value)&&value>=0&&value<=6?value:null;
const advance=(day,delta)=>new Date(Date.parse(day+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);
const worked=new Set(['labor','travel','shop']);
export const isWorkedTime=row=>worked.has(row.type);
const leave=new Set(['pto','sick','holiday']);
const round=value=>Math.round((value+Number.EPSILON)*100)/100;

// Shared selection and validity for the profile's Worked column and YTD Accrual.
export function profileTimeRows(state,email,first,today){
 const time=payrollEntries({...state,projects:state.projects||[],workorders:state.workorders||[]}).filter(
  row=>employeeKey(row.employeeEmail||row.tech)===email&&typeof row.date==='string'&&row.date>=first&&row.date<=today);
 const seen=new Set(),duplicates=new Set();
 for(const row of time)if(row.id){if(seen.has(row.id))duplicates.add(row.id);seen.add(row.id);}
 return time.map(row=>{
  let validDateValue=true;
  try{validDate(row.date);}catch{validDateValue=false;}
  const valid=validDateValue&&Boolean(row.id)&&!duplicates.has(row.id)&&Number.isFinite(row.quantity)&&row.quantity>0&&
   (!row.unit||/^(hr|hour|hours|h)$/i.test(row.unit));
  return {row,valid};
 });
}

// Read current time only. Never derive a weekly split from a multiweek payroll
// snapshot and never modify a saved approval. Only confirmed identity counts.
export function staffWeeklyTime(state,actor,now=new Date()){
 const today=dayFormat.format(now);
 const configured=workweekStart(state.meta?.staffWorkweekStart);
 // Monday is a display grouping only when the actual payroll week is unconfirmed.
 const date=new Date(today+'T00:00:00Z');
 const anchor=advance(today,-((date.getUTCDay()-(configured??1)+7)%7));
 const email=employeeKey(actor.email);
 const time=profileTimeRows(state,email,advance(anchor,-28),today);
 const approvedRuns=state.payrollRuns||[];
 const rows=Array.from({length:5},(_,i)=>{
  const start=advance(anchor,-i*7),end=advance(start,6);
  const sums={worked:0,pto:0,sick:0,holiday:0,locked:0,open:0};
  let issues=0;
  for(const {row,valid} of time){
   if(row.date<start||row.date>end||!worked.has(row.type)&&!leave.has(row.type))continue;
   if(!valid){issues++;continue;}
   sums[worked.has(row.type)?'worked':row.type]+=row.quantity;
   sums[approvedRuns.some(run=>row.date>=run.start&&row.date<=run.end)?'locked':'open']+=row.quantity;
  }
  const pendingLeave=round((state.staffLeave||[]).filter(row=>employeeKey(row.email)===email&&row.status==='Pending'&&
   row.date>=start&&row.date<=end&&Number.isFinite(row.quantity)&&row.quantity>0).reduce((sum,row)=>sum+row.quantity,0));
  const total=round(sums.worked), split=configured!==null&&!issues;
  const regular=split?Math.min(40,total):null, overtime=split?round(Math.max(0,total-40)):null;
  return {start,end,current:i===0,worked:total,regular,overtime,pto:round(sums.pto),sick:round(sums.sick),holiday:round(sums.holiday),
   lockedHours:round(sums.locked),openHours:round(sums.open),pendingLeave,issues};
 });
 return {workweekStart:configured,rows};
}
