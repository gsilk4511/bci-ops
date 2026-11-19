import {randomUUID} from 'node:crypto';
import {addOtherTime, validDate} from './payroll.js';

export const staffKey = value => String(value || '').trim().toLowerCase();
const has = (actor, grant) => actor.permissions?.includes(grant);
const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const profileAt = (state, email) => (state.staffProfiles || []).find(row => row.email === staffKey(email));
export function staffName(state,email) {
 const normalized=staffKey(email);
 return profileAt(state,normalized)?.name || (state.users||[]).find(user=>staffKey(user.email)===normalized)?.name || normalized;
}

export function isInternalProject(state, project) {
 if (!project || staffKey(project.name) !== 'bci elite admin') return false;
 const client = (state.customers||[]).find(row => row.id === project.customerId);
 return Boolean(client && [client.name,client.business].some(name => staffKey(name) === 'randy bevins'));
}

function hours(value, label, max=10000) {
 if (value === null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max) throw Error('Enter '+label+' between 0 and '+max);
 return Math.round(Number(value) * 100) / 100;
}
function ensureProfile(state,email) {
 let row = profileAt(state,email);
 if (!row) {
  row={email,name:'',contactEmail:email,payScale:'',vacationHours:0,sickHours:0};
  (state.staffProfiles ??=[]).push(row);
 }
 return row;
}
function safeProfile(state,email) {
 const existing=profileAt(state,email);
 return {email,name:existing?.name || staffName(state,email),contactEmail:existing?.contactEmail || email,
  payScale:existing?.payScale || '',vacationHours:existing?.vacationHours || 0,sickHours:existing?.sickHours || 0};
}
function internalChoice(state) {
 const rows=(state.projects||[]).filter(project=>isInternalProject(state,project));
 return rows.length===1?rows[0]:null;
}
function staffTarget(state,actor,input) {
 const target=staffKey(input);
 if (!target || (target!==staffKey(actor.email) && !(state.users||[]).some(user=>staffKey(user.email)===target))) throw Error('Select an existing user');
 return target;
}

export function staffView(state,actor,visibleOrderIds) {
 const email=staffKey(actor?.email);
 if (!email || !has(actor,'staff.view')) return undefined;
 const own = entry => staffKey(entry.employeeEmail || entry.tech) === email;
 const time=(state.workorders||[]).flatMap(order=>{
  const project=(state.projects||[]).find(p=>p.id===order.projectId);
  const internal=order.internalTask||isInternalProject(state,project);
  const canLink=has(actor,'workorders.view')&&(!visibleOrderIds||visibleOrderIds.has(order.id));
  const status=(order.invoice||order.closeout?.reviewedAt)?'Reviewed':order.closeout?'Submitted':order.correctionRequest?'Returned':'Draft';
  return (order.entries||[]).filter(e=>['labor','travel'].includes(e.type)&&own(e)).map(e=>({
   id:e.id,date:e.date,quantity:e.quantity,type:e.type==='travel'?'travel':internal?'internal':'work',status,
   workorderId:canLink?order.id:null,workorder:canLink?order.title:'Work order',
   note:e.description
  }));
 });
 for(const entry of state.payrollOther||[])if(entry.deletedWorkorderId&&own(entry)){
  time.push({id:entry.id,date:entry.date,quantity:entry.quantity,type:entry.type==='travel'?'travel':entry.internalTask?'internal':'work',
   status:'Archived — payroll review',workorderId:null,workorder:has(actor,'workorders.view')&&!visibleOrderIds?entry.job:'Archived work order',note:entry.description});
 }
 const admin=actor.role==='admin'&&has(actor,'staff.manage');
 const records=state.staffLeave||[];
 const internalProject=has(actor,'staff.internal')&&has(actor,'workorder.create')&&has(actor,'workorders.view')?internalChoice(state):null;
 return {profile:safeProfile(state,email),time,leave:records.filter(row=>row.email===email),
  ...(admin?{staffProfiles:[...new Set([email,...(state.users||[]).map(user=>staffKey(user.email))])].filter(Boolean).map(key=>safeProfile(state,key)),
   requests:records.filter(row=>row.status==='Pending')}:{}),internalAvailable:Boolean(internalProject)};
}

export function staffAction(state,action,data,actor, createOrder) {
 const email=staffKey(actor?.email);
 if (!email || !has(actor,'staff.view') || !has(actor,action)) throw Error('Staff permission required');
 if (action==='staff.profile'||action==='staff.manage') {
  const admin=action==='staff.manage';
  if (admin && actor.role!=='admin') throw Error('Admin access required');
  const target=admin?staffTarget(state,actor,data.email):email;
  const name=clean(data.name,100),contactEmail=staffKey(data.contactEmail);
  if (!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)||contactEmail.length>180) throw Error('Enter a name and valid contact email');
  const changes={name,contactEmail};
  if (admin) Object.assign(changes,{payScale:clean(data.payScale,80),vacationHours:hours(data.vacationHours,'vacation balance'),sickHours:hours(data.sickHours,'sick balance')});
  Object.assign(ensureProfile(state,target),changes);
  return {id:target,...safeProfile(state,target)};
 }
 if (action==='staff.leave') {
  const date=validDate(data.date);
  const category=data.type;
  if (!['vacation','sick'].includes(category)) throw Error('Select vacation or sick time');
  const quantity=hours(data.quantity,'leave hours',24);
  if (quantity<=0) throw Error('Enter leave hours greater than zero');
  if ((state.payrollRuns||[]).some(run=>date>=run.start&&date<=run.end)) throw Error('This pay period is finalized. Ask payroll to make the correction.');
  const records=state.staffLeave||[];
  const sameDay=records.filter(row=>row.email===email&&row.date===date&&row.status!=='Declined');
  if (sameDay.some(row=>row.type===category&&row.quantity===quantity)) throw Error('An identical leave request already exists');
  if (sameDay.reduce((sum,row)=>sum+row.quantity,quantity)>24) throw Error('Leave requests cannot exceed 24 hours on the same day');
  const row={id:randomUUID(),email,date,type:category,quantity,status:'Pending',createdAt:new Date().toISOString()};
  (state.staffLeave??=[]).push(row);return row;
 }
 if (action==='staff.leaveReview') {
  if (actor.role!=='admin'||!has(actor,'staff.manage')) throw Error('Admin access required');
  const row=(state.staffLeave||[]).find(item=>item.id===data.id);
  if (!row||row.status!=='Pending') throw Error('This leave request has already been reviewed or does not exist');
  if (!['approve','decline'].includes(data.decision)) throw Error('Choose a review decision');
  if (data.decision==='approve') {
   const profile=profileAt(state,row.email);
   const bucket=row.type==='sick'?'sickHours':'vacationHours';
   if (!profile||profile[bucket]<row.quantity) throw Error('Insufficient available leave balance');
   const entry=addOtherTime(state,{tech:staffName(state,row.email),date:row.date,type:row.type==='sick'?'sick':'pto',quantity:row.quantity,description:'Approved staff leave'},actor);
   entry.employeeEmail=row.email;
   row.payrollEntryId=entry.id;
   profile[bucket]=Math.round((profile[bucket]-row.quantity)*100)/100;
  }
  Object.assign(row,{status:data.decision==='approve'?'Approved':'Declined',reviewedAt:new Date().toISOString(),reviewedBy:email});
  return row;
 }
 if (action==='staff.internal') {
  const project=internalChoice(state);
  if (!project) throw Error('Ask an admin to set up exactly one BCI ELITE ADMIN project under Randy Bevins');
  if (!has(actor,'workorders.view')||!has(actor,'workorder.create')) throw Error('Work-order creation permission required');
  const description=clean(data.description,2000);
  if (!description) throw Error('Describe the internal task');
  const order=createOrder({projectId:project.id,description});
  Object.assign(order,{internalTask:true,internalCreatedBy:email});
  // For this named nonbillable project, staff can immediately record actual work.
  order.approvedAt=new Date().toISOString();
  order.approval={signedBy:'BCI internal',recordedBy:email,at:order.approvedAt,scope:description,method:'internal-work',acknowledged:true};
  order.status='released';
  return order;
 }
 throw Error('Unknown staff action');
}
