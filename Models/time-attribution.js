import {createHash,randomUUID} from 'node:crypto';

const key=x=>typeof x==='string'?x.trim().replace(/\s+/g,' ').toLowerCase():'';
const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const workTypes=new Set(['labor','travel']);
const payTypes=new Set(['labor','travel','shop','pto','sick','holiday']);
export const attributedEmail=entry=>key(entry.employeeAttribution?.email||entry.employeeEmail);
export const attributedName=entry=>entry.employeeAttribution?.name||entry.tech;
function labelMatches(row,mode,source){
 const linked=attributedEmail(row);
 if(mode==='email')return (linked||key(row.tech))===source;
 return !linked&&key(row.tech)===source;
}
function records(state){
 return (state.workorders||[]).flatMap(w=>(w.entries||[]).filter(e=>workTypes.has(e.type)).map(row=>({location:'workorder',order:w.id,job:w.title,row})))
  .concat((state.payrollOther||[]).filter(e=>payTypes.has(e.type)).map(row=>({location:'other-time',order:'',job:row.job,row})));
}
export function planAttribution(state,input,actor){
 if(actor?.role!=='admin')throw Error('Admin access required');
 const mode=input.mode,source=key(input.source),target=key(input.target), id=String(input.rowId||'').trim();
 const start=input.start||'',end=input.end||'';
 if(!['email','label'].includes(mode)||!source||source.length>254||(mode==='email'&&!email.test(source))||
   (mode==='label'&&email.test(source))||!email.test(target)||source===target||id.length>150||
   [start,end].some(x=>x&&(!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(Date.parse(x+'T00:00:00Z'))||new Date(x+'T00:00:00Z').toISOString().slice(0,10)!==x))||
   start&&end&&start>end)throw Error('Select the exact legacy value, a different active employee, and valid optional filters');
 const dest=(state.users||[]).filter(person=>key(person.email)===target&&person.active!==false);
 if(dest.length!==1||!['tech','office','admin'].includes(dest[0].role))throw Error('Choose a single active Team account');
 const selected=records(state).filter(({row})=>row.id&&(!id||row.id===id)&&(!start||row.date>=start)&&(!end||row.date<=end)&&labelMatches(row,mode,source));
 const issues=[];
 const selectedRows=new Set();
 const review=selected.map(({location,order,job,row})=>{
  const rowKey=JSON.stringify([location,order,row.id]);
  if(selectedRows.has(rowKey))issues.push('Duplicate time row identifier: '+row.id);
  selectedRows.add(rowKey);
  const locked=(state.payrollRuns||[]).some(run=>row.date>=run.start&&row.date<=run.end);
  return {location,order,job:job||null,id:row.id,employee:attributedName(row),email:attributedEmail(row)||null,date:row.date,startTime:row.startTime||null,endTime:row.endTime||null,unit:row.unit||null,type:row.type,hours:row.quantity,locked,revision:row.revision||null,batch:row.employeeAttribution?.batch||null};
 });
 if((state.activeClocks||[]).some(clock=>[source,target].includes(key(clock.email))||mode==='label'&&key(clock.tech)===source))
  issues.push('Clock out any running timers associated with these identities before applying');
 const hours=review.reduce((sum,x)=>sum+(Number.isFinite(x.hours)?x.hours:0),0);
 const locked=review.filter(x=>x.locked).length;
 const name=String(dest[0].name||target).slice(0,120);
 const sourceEvidence=selected.map(({row})=>[row.id,row.tech,row.employeeEmail,row.date,row.startTime,row.endTime,row.unit,row.description,row.journalNote,row.createdBy,row.recordedBy,row.rate,row.cost,row.catalogId]);
 const signature={mode,source,target,id,start,end,targetId:dest[0].id||target,name,review,sourceEvidence,issues};
 return {plan:{fingerprint:createHash('sha256').update(JSON.stringify(signature)).digest('hex'),matches:review.length,hours,locked,destination:target,name,issues:[...new Set(issues)],rows:review.slice(0,200),truncated:review.length>200},selected};
}
export function applyAttribution(state,input,actor){
 const {plan,selected}=planAttribution(state,input,actor);
 if(!plan.matches||plan.issues.length||plan.truncated)throw Error('Resolve preview issues or narrow the selection before applying');
 if(input.fingerprint!==plan.fingerprint)throw Error('Time rows changed. Run a fresh preview before applying');
 if(input.confirmation!=='REASSIGN '+plan.matches)throw Error('Type REASSIGN followed by the preview count');
 const reason=typeof input.reason==='string'?input.reason.trim():'';
 if(!reason||reason.length>400)throw Error('Enter a correction reason (up to 400 characters)');
 const batch=randomUUID(),at=new Date().toISOString();
 const audit={batch,at,actor:actor.email,reason,destination:plan.destination,rows:[]};
 for(const {location,order,row} of selected){
  audit.rows.push({location,order,id:row.id,oldEmail:attributedEmail(row)||null,oldLabel:attributedName(row),date:row.date,quantity:row.quantity,previous:row.employeeAttribution||null});
  row.employeeAttribution={email:plan.destination,name:plan.name,batch};
  row.revision=randomUUID();
 }
 (state.timeAttributionHistory??=[]).unshift(audit);
 return {batch,updated:selected.length,locked:plan.locked,hours:plan.hours};
}
