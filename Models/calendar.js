import {randomUUID} from 'node:crypto';
import {validDate,timeMinutes} from './payroll.js';
import {staffName,staffKey} from './staff.js';
import {scopeState} from './record-scope.js';
import {daySpan,easternInstant} from '../public/modules/calendar-time.js';

const grants=['projects.view','workorders.view','staff.view','vehicles.view','dashboard.view'];
const can=(actor,key)=>Boolean(actor.permissions?.includes(key));
const canDispatch=actor=>actor.role==='admin'||can(actor,'workorder.update')||can(actor,'project.update');
const hasCalendar=actor=>grants.some(key=>can(actor,key));
const fleetNames={oil:'Oil change',registration:'Registration',inspection:'Inspection',insurance:'Insurance',rotation:'Tire rotation',cleaning:'Cab cleanup',service:'Service',repair:'Repair'};
const emailList=(state,actor)=>[...new Set([...(state.users||[]).filter(u=>u.active!==false).map(u=>staffKey(u.email)),staffKey(actor.email)].filter(Boolean))].sort();
const date=value=>{
 const out=validDate(value);
 if(out<'2000-01-01'||out>'2100-12-31')throw Error('Select a date between 2000 and 2100.');
 return out;
};
const dateOptional=value=>value==null||value===''?null:date(value);
const text=(value,max,label,required=false)=>{
 if(typeof value!=='string'&&value!==undefined&&value!==null)throw Error('Enter '+label+'.');
 const cleaned=String(value??'').trim();
 if(cleaned.length>max||(required&&!cleaned))throw Error('Enter '+label+' (up to '+max+' characters).');
 return cleaned;
};
const recordBy=(state,key,id)=>state[key]?.find(row=>row.id===id);
const calibration=(existing,provided)=>{
 if((existing?.revision??0)!==provided)throw Error('The schedule changed. Refresh to see the new version before saving.');
};
const overlaps=(a,b)=>a.date===b.date&&a.start<b.end&&b.start<a.end;
const ordersKey=workspace=>workspace?.orders||[];
const referenceDay=(visit,input,existing)=>{
 const startUtc=easternInstant(input.date,input.start),endUtc=easternInstant(input.date,input.end);
 if(startUtc>=endUtc)throw Error('Finish must be later than start on '+visit+'.');
 return {id:existing?.id||randomUUID(),date:visit,start:input.start,end:input.end};
};
export function calendarAction(state,action,payload,actor){
 if(!hasCalendar(actor))throw Error('Calendar access required.');
 const workspace=state.calendarWorkspace??={projects:[],orders:[],appointments:[]};
 // Always replace rows atomically; never accept a client-supplied identity or revision.
 const save=(rows,existing,record)=>{
  const row={...record,revision:(existing?.revision||0)+1,updatedAt:new Date().toISOString()};
  if(existing)rows[rows.indexOf(existing)]=row;else rows.push(row);
  return {id:row.id,revision:row.revision};
 };
 if(action==='calendar.appointment'){
  if(actor.role!=='admin')throw Error('Administrator access is required to manage business appointments.');
  const existing=workspace.appointments.find(x=>x.id===payload.id);
  if(payload.id&&!existing)throw Error('Appointment not found.');
  calibration(existing,payload.revision);
  if(payload.remove===true){
   if(!existing)throw Error('Appointment not found.');
   workspace.appointments.splice(workspace.appointments.indexOf(existing),1);
   return {id:existing.id};
  }
  if(!existing&&workspace.appointments.length>=2000)throw Error('Business appointment limit reached.');
  const on=date(payload.date);
  const slot=referenceDay(on,payload,existing),crew=validateCrew(state,payload.crew??[],actor);
  ensureNoCrewConflict(state,workspace,[slot],crew,{appointmentId:existing?.id});
  return save(workspace.appointments,existing,{...slot,
   title:text(payload.title,120,'an appointment title',true),location:text(payload.location,160,'an appointment location'),
   crew,shared:payload.shared===true});
 }
 const scoped=scopeState(state,actor);
 if(action==='project.schedule'){
  if(!can(actor,'projects.view')||!can(actor,'project.update'))throw Error('Project edit access required.');
  const project=recordBy(scoped,'projects',payload.projectId);
  if(!project)throw Error('Project unavailable in your access scope.');
  const existing=workspace.projects.find(x=>x.id===project.id);
  calibration(existing,payload.revision);
  const start=dateOptional(payload.start),due=dateOptional(payload.due);
  if(start&&due&&start>due)throw Error('Project due date cannot precede its planned start.');
  return save(workspace.projects,existing,{id:project.id,start,due});
 }
 if(action!=='workorder.schedule'||!can(actor,'workorders.view')||!can(actor,'workorder.update'))throw Error('Work order edit access required.');
 const order=recordBy(scoped,'workorders',payload.workorderId);
 if(!order)throw Error('Work order unavailable in your access scope.');
 const existing=workspace.orders.find(x=>x.id===order.id);
 calibration(existing,payload.revision);
 const due=dateOptional(payload.due);
 const crew=validateCrew(state,payload.crew,actor);
 if(!Array.isArray(payload.visits)||payload.visits.length>90)throw Error('Choose up to 90 scheduled days.');
 const seen=new Set();
 const visits=payload.visits.map(input=>{
  if(!input||typeof input!=='object')throw Error('Invalid day.');
  const on=date(input.date);
  if(seen.has(on))throw Error('Each work order can have only one booking per day.');
  seen.add(on);
  return referenceDay(on,input,existing?.visits?.find(row=>row.date===on));
 }).sort((a,b)=>a.date.localeCompare(b.date));
 if(visits.length){
  daySpan(visits[0].date,visits.at(-1).date,90);
  if(!crew.length)throw Error('Select at least one crew member for these bookings.');
  ensureNoCrewConflict(state,workspace,visits,crew,{orderId:order.id});
 }
 return save(workspace.orders,existing,{id:order.id,due,crew,visits});
}
function ensureNoCrewConflict(state,workspace,visits,crew,{orderId,appointmentId}){
 if(!crew.length)return;
 const activeOrders=new Set((state.workorders||[]).map(row=>row.id));
 const other=workspace.orders.filter(row=>row.id!==orderId&&activeOrders.has(row.id)&&row.crew.some(email=>crew.includes(email)));
 const appointments=workspace.appointments.filter(row=>row.id!==appointmentId&&row.crew?.some(email=>crew.includes(email)));
 const conflict=visits.find(visit=>other.some(row=>row.visits.some(slot=>overlaps(slot,visit)))||appointments.some(row=>overlaps(row,visit)));
 if(conflict)throw Error('Confirmed crew conflict on '+conflict.date+'. Adjust the hours or select a different crew.');
}
function validateCrew(state,value,actor){
 if(!Array.isArray(value)||value.length>30||value.some(email=>typeof email!=='string'))throw Error('Select up to 30 active crew members.');
 const members=emailList(state,actor),crew=[...new Set(value.map(staffKey))];
 if(crew.some(email=>!members.includes(email)))throw Error('Select an active Team crew member.');
 return crew;
}
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const reminderDay=value=>{
 if(!value)return null;
 if(datePattern.test(value))return value;
 if(/^\d{4}-\d{2}$/.test(value)){
  const [y,m]=value.split('-').map(Number);
  return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
 }
 return null;
};
export function calendarView(state,scoped,actor,fleet){
 if(!hasCalendar(actor))return undefined;
 const workspace=state.calendarWorkspace||{}, self=staffKey(actor.email),dispatch=canDispatch(actor);
 // For record-scoped users never display titles, schedules or locations for hidden records.
 const names=(emails=[])=>emails.map(email=>({name:staffName(state,email),...(dispatch||email===self?{email}:{}),self:email===self}));
 const visibleProjects=can(actor,'projects.view')?scoped.projects||[]:[];
 const visibleOrders=can(actor,'workorders.view')?scoped.workorders||[]:[];
 const projectMap=new Map((scoped.projects||[]).map(row=>[row.id,row]));
 const projectDates=new Map((workspace.projects||[]).map(row=>[row.id,row]));
 const orderMap=new Map(ordersKey(workspace).map(row=>[row.id,row]));
 const projects=visibleProjects.map(p=>{
  const record=projectDates.get(p.id)||{};
  return {id:p.id,title:[p.number,p.name].filter(Boolean).join(' · '),start:record.start||null,due:record.due||null,revision:record.revision||0};
 });
 const orders=visibleOrders.map(order=>{
  const parent=projectMap.get(order.projectId);
  const record=orderMap.get(order.id)||{};
  const plan=can(actor,'projects.view')?projectDates.get(order.projectId):undefined;
  return {id:order.id,projectId:can(actor,'projects.view')?order.projectId:'',title:order.workorderNumber&&parent?.number?
    `${parent.number} · Work Order ${order.workorderNumber}`:order.title,site:parent?.site||'',
    crew:names(record.crew),due:record.due||null,revision:record.revision||0,updatedAt:record.updatedAt||null,
    visits:(record.visits||[]).map(v=>({...v,outsidePlan:Boolean(plan?.start&&v.date<plan.start||plan?.due&&v.date>plan.due)}))};
 });
 const activeOrderIds=new Set((state.workorders||[]).map(row=>row.id)), visibleOrderIds=new Set(orders.map(row=>row.id));
 // Only show other people's availability to scheduling staff, and never disclose leave type/reason.
 const leave=[
  ...(state.staffLeave||[]).filter(row=>row.status==='Approved'),
  ...(state.payrollOther||[]).filter(row=>row.type==='holiday'&&row.employeeEmail).map(row=>({email:row.employeeEmail,date:row.date}))
 ];
 const seen=new Set();
 const daysOff=leave.filter(row=>{
  const email=staffKey(row.email),key=email+'|'+row.date;
  if(!email||(!dispatch&&email!==self)||!datePattern.test(row.date)||seen.has(key))return false;
  seen.add(key);return true;
 }).map(row=>({date:row.date,person:names([staffKey(row.email)])[0]}));
 const busy=[];
 if(dispatch){
  // Hidden jobs affect conflict checking, but never disclose their title, site, or record identifier.
  // The committed action checks them server-side without projecting calendar details for hidden jobs.
  for(const row of ordersKey(workspace)) if(activeOrderIds.has(row.id)&&visibleOrderIds.has(row.id))
   for(const visit of row.visits)busy.push({orderId:row.id,date:visit.date,start:visit.start,end:visit.end,crew:row.crew});
 }
 const fleetRows=fleet?.records||[];
 const fleetEvents=fleetRows.flatMap(vehicle=>{
  return Object.entries(vehicle.schedules||{}).flatMap(([key,item])=>{
   const title=vehicle.name+' · '+(fleetNames[key]||'Service'),due=reminderDay(item.dueDate),visit=item.appointment;
   const events=[];
   if(due)events.push({type:'vehicle-reminder',id:vehicle.id,title:title+' due',date:due});
   if(visit?.date)events.push({type:'vehicle',id:vehicle.id,title,date:visit.date,start:visit.time,end:visit.endTime||'',site:visit.location});
   return events;
  });
 });
 return {projects,orders,daysOff,busy,vehicles:fleetRows.map(({id,name})=>({id,name})),fleetEvents,
  appointments:(workspace.appointments||[]).filter(row=>actor.role==='admin'||row.shared&&can(actor,'dashboard.view')||row.crew?.includes(self))
   .map(({id,date,start,end,title,location,crew,revision,shared})=>({id,date,start,end,title,location,crew:names(crew),revision,shared})),
  staff:dispatch?names(emailList(state,actor)):[],manageAppointments:actor.role==='admin'};
}
