import {attributedEmail,attributedName} from './time-attribution.js';
import {createHash,randomUUID} from 'node:crypto';

export const employeeKey = name => String(name||'').trim().replace(/\s+/g,' ').toLowerCase();
export function validDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Enter a valid date');
  const parsed=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==value) throw Error('Enter a valid date');
  return value;
}
export function timeMinutes(value){
  if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Enter valid start and end times');
  const [hour,minute]=value.split(':').map(Number);
  return hour*60+minute;
}
export function payrollEntries(state){
  return state.workorders.flatMap(w=>w.entries.filter(e=>['labor','travel'].includes(e.type)).map(e=>({
    id:e.id,tech:attributedName(e),employeeEmail:attributedEmail(e)||undefined,date:e.date,type:e.type,startTime:e.startTime,endTime:e.endTime,quantity:e.quantity,unit:e.unit,
    description:e.description,job:w.title,projectNumber:state.projects.find(p=>p.id===w.projectId)?.number||''
  }))).concat((state.payrollOther||[]).map(e=>({...e,employeeAttribution:undefined,tech:attributedName(e),employeeEmail:attributedEmail(e)||undefined})));
}
export function checkTimeEntry(state,entry,excludeId){
  if((state.payrollRuns||[]).some(run=>entry.date>=run.start&&entry.date<=run.end))throw Error('This pay period has already been approved. Ask payroll to handle the correction.');
  if(!entry.startTime||!entry.endTime)return;
  const start=timeMinutes(entry.startTime),end=timeMinutes(entry.endTime);
  if(end<=start)throw Error('End time must be later on the same date');
  if(payrollEntries(state).some(e=>e.id!==excludeId&&e.date===entry.date&&(e.employeeEmail&&entry.employeeEmail?employeeKey(e.employeeEmail)===employeeKey(entry.employeeEmail):employeeKey(e.tech)===employeeKey(entry.tech))&&e.startTime&&e.endTime&&start<timeMinutes(e.endTime)&&timeMinutes(e.startTime)<end))throw Error('This employee already has overlapping time');
}
function holidayIdentity(state,row){
  const email=employeeKey(attributedEmail(row)),name=employeeKey(attributedName(row));
  const labels=new Set([name,email].filter(Boolean));
  if(email)for(const person of [...(state.staffProfiles||[]),...(state.users||[])])
    if(employeeKey(person.email)===email){
     const label=employeeKey(person.name);
     if(label)labels.add(label);
    }
  return {email,labels};
}
function sameHolidayPerson(a,b){
  if(a.email&&b.email)return a.email===b.email;
  return [...a.labels].some(label=>b.labels.has(label));
}
export function addOtherTime(state,data,actor,{approvedLeaveEmail}={}){
  let tech=String(data.tech||'').trim();
  const date=validDate(data.date);
  let linkedEmail;
  if(Object.hasOwn(data,'employeeEmail')){
    linkedEmail=employeeKey(data.employeeEmail);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkedEmail)||linkedEmail.length>254)throw Error('Enter an active employee’s Team sign-in email');
    const matches=(state.users||[]).filter(row=>employeeKey(row.email)===linkedEmail);
    const protectedAdmins=state.meta?.permissionPreview?[]:(process.env.BCI_ADMIN_EMAILS||'').split(',').map(employeeKey);
    if(matches.length>1||matches.length===1&&matches[0].active===false||
      !matches.length&&linkedEmail!==employeeKey(actor.email)&&!protectedAdmins.includes(linkedEmail))throw Error('Enter an active employee’s Team sign-in email');
    const profile=(state.staffProfiles||[]).find(row=>employeeKey(row.email)===linkedEmail);
    tech=(profile?.name||matches[0]?.name||linkedEmail).slice(0,100);
  }
  if(approvedLeaveEmail)linkedEmail=employeeKey(approvedLeaveEmail);
  if(!tech||tech.length>100||!['shop','pto','sick','holiday'].includes(data.type))throw Error('Enter an employee and pay category');
  const quantity=Number(data.quantity);
  if(!Number.isFinite(quantity)||quantity<=0||quantity>24)throw Error('Enter hours greater than zero and no more than 24');
  const entry={id:randomUUID(),tech,date,type:data.type,quantity,description:String(data.description||'').slice(0,1000),recordedBy:actor.email};
  if(linkedEmail)entry.employeeEmail=linkedEmail;
  checkTimeEntry(state,entry);
  if(entry.type==='holiday'){
    const person=holidayIdentity(state,entry);
    if((state.payrollOther||[]).some(other=>other.type==='holiday'&&other.date===date&&sameHolidayPerson(person,holidayIdentity(state,other))))
      throw Error('Holiday time already exists or may already exist for this employee and date. Review the existing payroll entry.');
  }
  (state.payrollOther??=[]).push(entry);return entry;
}
export function payrollPreview(state,start,end){
  validDate(start);validDate(end);
  if(end<start)throw Error('Period end must be on or after start');
  const entries=payrollEntries(state).filter(e=>e.date>=start&&e.date<=end);
  const employees=new Map(), issues=[];
  const seen=new Set(), timed=new Map(), holidays=new Map();
  for(const e of entries){
    const key=employeeKey(e.employeeEmail||e.tech);
    if(!key||!Number.isFinite(e.quantity)||e.quantity<=0||(e.unit&&!/^(hr|hour|hours|h)$/i.test(e.unit))) {issues.push('Review non-hour or unnamed entry '+e.id);continue;}
    if(seen.has(e.id))issues.push('Duplicate time entry '+e.id);
    seen.add(e.id);
    if(e.type==='holiday'){
      const sameDay=holidays.get(e.date)||[];
      const person=holidayIdentity(state,e);
      for(const previous of sameDay)if(sameHolidayPerson(person,previous.person))
        issues.push('Possible duplicate Holiday hours on '+e.date+' for '+e.tech+' (entries '+previous.id+' and '+e.id+'). Review before approval.');
      sameDay.push({id:e.id,person});holidays.set(e.date,sameDay);
    }
    const day=key+'|'+e.date;
    if(e.startTime&&e.endTime){
      try{
        const begin=timeMinutes(e.startTime),end=timeMinutes(e.endTime),prior=timed.get(day)||[];
        if(end<=begin||Math.abs((end-begin)/60-e.quantity)>0.01||prior.some(([a,b])=>begin<b&&a<end))issues.push('Check overlapping or inconsistent time for '+e.tech+' on '+e.date);
        prior.push([begin,end]);timed.set(day,prior);
      }catch{issues.push('Check timestamps for '+e.tech+' on '+e.date);}
    }
    if(!employees.has(key))employees.set(key,{key,employee:e.tech,work:0,travel:0,shop:0,pto:0,sick:0,holiday:0});
    const row=employees.get(key);
    row[e.type==='labor'?'work':e.type]+=e.quantity;
  }
  const rows=[...employees.values()].map(row=>{
    for(const k of ['work','travel','shop','pto','sick','holiday'])row[k]=Math.round(row[k]*100)/100;
    row.worked=Math.round((row.work+row.travel+row.shop)*100)/100;
    return row;
  });
  const revision=createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  return {start,end,rows,entries,revision,issues:[...new Set(issues)]};
}
export function approvePayroll(state,data,actor){
  const {start,end,payDate}=data;
  validDate(payDate);
  const preview=payrollPreview(state,start,end);
  if(data.revision!==preview.revision)throw Error('Time entries changed. Review the pay period again before approval');
  if(payDate<end)throw Error('Pay date must be on or after the end of the period');
  if((state.activeClocks||[]).some(clock=>(clock.workDate||clock.startedAt.slice(0,10))<=end))throw Error('Clock out running timers before approving payroll');
  if(preview.issues.length||!preview.rows.length)throw Error('Resolve payroll exceptions before approval');
  if((state.payrollRuns||[]).some(run=>start<=run.end&&run.start<=end))throw Error('An approved payroll period already overlaps these dates');
  const rows=preview.rows.map(row=>{
    const overtime=Number(data.overtime?.[row.key]);
    if(!Number.isFinite(overtime)||overtime<0||overtime>row.worked)throw Error('Confirm overtime hours for '+row.employee);
    return {...row,overtime,regular:Math.round((row.worked-overtime)*100)/100};
  });
  const run={...preview,rows,payDate,id:randomUUID(),approvedAt:new Date().toISOString(),approvedBy:actor.email};
  (state.payrollRuns??=[]).push(run);return run;
}

// Records confirmation only; it does not run payroll, send payment or alter locked rows.
export function markPayrollPaid(state,data,actor,now=new Date()){
  if(!actor?.permissions?.includes('payroll.view')||!actor.permissions.includes('payroll.approve'))throw Error('Payroll approval access required');
  const run=(state.payrollRuns||[]).find(row=>row.id===data.id);
  if(!run?.approvedAt||!Array.isArray(run.entries))throw Error('Only an approved payroll period can be marked paid');
  if(data.confirmation!=='paid')throw Error('Confirm payroll was already paid outside this app');
  if(run.paidAt)return {id:run.id,paidAt:run.paidAt};
  run.paidAt=now.toISOString();
  run.paidBy=actor.email;
  (state.events??=[]).unshift({id:randomUUID(),at:run.paidAt,action:'payroll.markPaid',reference:run.id,detail:'Confirmed by '+actor.email});
  return {id:run.id,paidAt:run.paidAt};
}
