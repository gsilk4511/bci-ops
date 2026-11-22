import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {addOtherTime, validDate} from './payroll.js';
import {businessManagerView} from './business-manager.js';
import {changedWageHistory,contributionScopeLimited,contributionWageHistory,contributionYear,profileProfitShare,rateForYear,updatedProfitRates,verifiedWageHistory} from './staff-profit-settings.js';
import {technicianContribution} from './technician-contribution.js';
import {defaultProfileStyle,profileStyleOptions} from '../public/modules/profile-style-catalog.js';

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
const directoryKey=randomBytes(32);
const profileId=email=>createHmac('sha256',directoryKey).update(email).digest('hex');
const avatarLimit=240*1024;
function safeDimensions(width,height){
 if(width<1||width>2048||height<1||height>2048)throw Error('Profile photo must fit within 2048 × 2048 pixels');
}
function stripPng(bytes){
 const safe=[bytes.subarray(0,8)];
 let pos=8,hasData=false;
 while(pos+12<=bytes.length){
  const len=bytes.readUInt32BE(pos),end=pos+12+len,type=bytes.subarray(pos+4,pos+8).toString();
  if(end>bytes.length)break;
  if(type==='IHDR'){if(pos!==8||len!==13)break;safeDimensions(bytes.readUInt32BE(pos+8),bytes.readUInt32BE(pos+12));}
  if(type==='IDAT')hasData=true;
  if(['IHDR','PLTE','tRNS','IDAT','IEND'].includes(type))safe.push(bytes.subarray(pos,end));
  if(type==='IEND'&&hasData&&end===bytes.length&&len===0)return Buffer.concat(safe);
  pos=end;
 }
 throw Error('Invalid PNG profile photo');
}
function stripJpeg(bytes){
 const safe=[bytes.subarray(0,2)];
 let pos=2,hasDimensions=false;
 while(pos+4<=bytes.length){
  if(bytes[pos]!==255)break;
  const type=bytes[pos+1],len=bytes.readUInt16BE(pos+2),end=pos+2+len;
  if(len<2||end>bytes.length)break;
  if([192,193,194].includes(type)){
   if(len<8)break;
   safeDimensions(bytes.readUInt16BE(pos+7),bytes.readUInt16BE(pos+5));
   hasDimensions=true;
  }
  // Do not retain upload comments, GPS/EXIF, embedded thumbnails, or other APP metadata.
  if(type===218&&hasDimensions){safe.push(bytes.subarray(pos));return Buffer.concat(safe);}
  if(type!==254&&(type<224||type>239))safe.push(bytes.subarray(pos,end));
  pos=end;
 }
 throw Error('Invalid JPEG profile photo');
}
function avatarImage(value){
 if(!value)return null;
 if(typeof value!=='string'||value.length>Math.ceil(avatarLimit/3)*4||value.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Choose a JPEG or PNG photo up to 240 KB');
 const bytes=Buffer.from(value,'base64');
 if(bytes.length>avatarLimit||bytes.toString('base64')!==value)throw Error('Invalid profile photo');
 const png=bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(8)===13&&bytes.subarray(12,16).toString()==='IHDR'&&bytes.subarray(-8,-4).toString()==='IEND';
 const jpeg=bytes.length>=16&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
 if(!png&&!jpeg)throw Error('Profile photo must be JPEG or PNG');
 return {bytes:png?stripPng(bytes):stripJpeg(bytes),mime:png?'image/png':'image/jpeg'};
}
function socialLinks(value){
 if(!Array.isArray(value)||value.length>6)throw Error('Add up to six social links');
 return value.map(link=>{
  if(!link||typeof link.label!=='string'||typeof link.url!=='string'||!link.label.trim()||link.label.trim().length>40||link.url.length>512)throw Error('Every social link needs a label and a valid HTTPS address');
  let url;try{url=new URL(link.url);}catch{throw Error('Enter a valid HTTPS social link');}
  if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||url.port)throw Error('Enter a public HTTPS social link');
  return {label:link.label.trim(),url:url.href};
 });
}
const styleKeys=Object.keys(defaultProfileStyle);
const allowedStyles=Object.fromEntries(styleKeys.map(key=>[key,new Set(profileStyleOptions[key].map(option=>option.id))]));
function normalizedStyle(value){
 return Object.fromEntries(styleKeys.map(key=>[key,allowedStyles[key].has(value?.[key])?value[key]:defaultProfileStyle[key]]));
}
function updatedStyle(previous,next){
 if(!next||typeof next!=='object'||Array.isArray(next))throw Error('Choose valid profile style options');
 const result=normalizedStyle(previous);
 for(const [key,value] of Object.entries(next)){
  if(!Object.hasOwn(allowedStyles,key)||typeof value!=='string'||!allowedStyles[key].has(value))
   throw Error('Choose an available profile style');
  result[key]=value;
 }
 return result;
}
export function staffTechnicianIcons(state,actor,orders){
 if(!actor?.email||!has(actor,'workorders.view'))return orders;
 const active=new Set(directoryEmails(state,actor));
 const icons=new Map((state.staffProfiles||[]).filter(profile=>active.has(staffKey(profile.email)))
  .map(profile=>[staffKey(profile.email),normalizedStyle(profile.style).icon]));
 return orders.map(order=>({...order,entries:(order.entries||[]).map(entry=>{
  const match=typeof entry.employeeEmail==='string'&&icons.get(staffKey(entry.employeeEmail));
  return match&&['labor','travel','material'].includes(entry.type)?{...entry,technicianIcon:match}:entry;
 })}));
}
function publicProfile(state,email){
 const row=profileAt(state,email);
 const id=profileId(email);
 return {id,displayName:row?.displayName||row?.name||(state.users||[]).find(user=>staffKey(user.email)===email)?.name||'Team member',bio:row?.bio||'',
  avatarUrl:row?.avatarBase64?'/api/staff-avatar/'+id:'',socialLinks:row?.socialLinks||[],style:normalizedStyle(row?.style)};
}
function directoryEmails(state,actor){
 return [...new Set([staffKey(actor.email),...(state.users||[]).filter(row=>row.active!==false).map(row=>staffKey(row.email)),
 ...(process.env.BCI_ADMIN_EMAILS||'').split(',').map(staffKey)])].filter(Boolean);
}
export function staffAvatar(state,actor,id){
 if(!actor?.email||!has(actor,'staff.view')||!/^[0-9a-f]{64}$/.test(id||''))return null;
 const email=directoryEmails(state,actor).find(email=>profileId(email)===id);
 return email?avatarImage(profileAt(state,email)?.avatarBase64):null;
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

export function staffView(state,actor,visibleOrderIds,visibleProjectIds,metricsState,year=contributionYear()) {
 const email=staffKey(actor?.email);
 if (!email || !has(actor,'staff.view')) return undefined;
 const own = entry => staffKey(entry.employeeEmail || entry.tech) === email;
 const ordersWorked=new Set(),projectsWorked=new Set(),projects=new Map();
 const time=(state.workorders||[]).flatMap(order=>{
  const project=(state.projects||[]).find(p=>p.id===order.projectId);
  const internal=order.internalTask||isInternalProject(state,project);
  const canLink=has(actor,'workorders.view')&&(!visibleOrderIds||visibleOrderIds.has(order.id));
  const status=(order.invoice||order.closeout?.reviewedAt)?'Reviewed':order.closeout?'Submitted':order.correctionRequest?'Returned':'Draft';
  const canProject=Boolean(project&&has(actor,'projects.view')&&(!visibleProjectIds||visibleProjectIds.has(project.id)));
  const entries=(order.entries||[]).filter(e=>['labor','travel'].includes(e.type)&&own(e));
  if(entries.length){ordersWorked.add(order.id);if(project)projectsWorked.add(project.id);}
  if(entries.length&&canProject){
   const info=projects.get(project.id)||{id:project.id,name:project.name,workorders:0,hours:0};
   info.workorders++;info.hours+=entries.reduce((sum,e)=>sum+(Number(e.quantity)||0),0);projects.set(project.id,info);
  }
  return entries.map(e=>({
   id:e.id,date:e.date,quantity:e.quantity,startTime:e.startTime||null,endTime:e.endTime||null,type:e.type==='travel'?'travel':internal?'internal':'work',status,
   workorderId:canLink?order.id:null,workorder:canLink?order.title:'Work order',
   projectId:canProject?project.id:null,project:canProject?project.name:null,
   note:e.description
  }));
 });
 for(const entry of state.payrollOther||[])if(entry.deletedWorkorderId&&own(entry)){
  ordersWorked.add(entry.deletedWorkorderId);
  time.push({id:entry.id,date:entry.date,quantity:entry.quantity,type:entry.type==='travel'?'travel':entry.internalTask?'internal':'work',
   status:'Archived — payroll review',workorderId:null,workorder:has(actor,'workorders.view')&&!visibleOrderIds?entry.job:'Archived work order',note:entry.description});
 }
 const admin=actor.role==='admin'&&has(actor,'staff.manage');
 const records=state.staffLeave||[];
 const internalProject=has(actor,'staff.internal')&&has(actor,'workorder.create')&&has(actor,'workorders.view')?internalChoice(state):null;
 const contribution=metricsState?technicianContribution(metricsState,email,{year,profitShareBps:rateForYear(profileAt(state,email),year),
  wageHistory:contributionWageHistory(profileAt(state,email)),scopeIncomplete:contributionScopeLimited(state,metricsState,email,year)}):undefined;
 if(contribution)contribution.projects=contribution.projects.map(row=>{
  const visible=projects.get(row.projectId);
  return {attributedCents:row.attributedCents,laborHours:row.laborHours,orderCount:row.orderCount,employmentCostCents:row.employmentCostCents,netProfitCents:row.netProfitCents,projectId:visible?.id??null,projectName:visible?.name??'Project'};
 });
 return {businessManager:businessManagerView(state,actor),contribution,profile:{...safeProfile(state,email),...publicProfile(state,email)},directory:directoryEmails(state,actor).map(email=>publicProfile(state,email)).sort((a,b)=>a.displayName.localeCompare(b.displayName)),
  overview:{workorders:ordersWorked.size,projects:projectsWorked.size},projects:[...projects.values()].map(project=>({...project,hours:Math.round(project.hours*100)/100})),time,leave:records.filter(row=>row.email===email),
  ...(admin?{staffProfiles:[...new Set([email,...(state.users||[]).map(user=>staffKey(user.email))])].filter(Boolean).map(key=>({...safeProfile(state,key),profitShareByYear:profileProfitShare(profileAt(state,key)),hourlyWages:verifiedWageHistory(profileAt(state,key))})),
   requests:records.filter(row=>row.status==='Pending')}:{}),internalAvailable:Boolean(internalProject)};
}

export function staffAction(state,action,data,actor, createOrder) {
 const email=staffKey(actor?.email);
 if (!email || !has(actor,'staff.view') || !has(actor,action)) throw Error('Staff permission required');
 if(action==='staff.profile'){
  const displayName=clean(data.displayName,100),bio=clean(data.bio,1200);
  if(!displayName)throw Error('Enter a display name');
  const changes={displayName,bio,socialLinks:socialLinks(data.socialLinks??[])};
  if(Object.hasOwn(data,'style'))changes.style=updatedStyle(profileAt(state,email)?.style,data.style);
  if(Object.hasOwn(data,'avatarBase64')){
   if(typeof data.avatarBase64!=='string')throw Error('Invalid profile photo');
   const image=avatarImage(data.avatarBase64);
   changes.avatarBase64=image?.bytes.toString('base64')||'';
  }
  Object.assign(ensureProfile(state,email),changes);
  return publicProfile(state,email);
 }
 if (action==='staff.manage') {
  if (actor.role!=='admin') throw Error('Admin access required');
  const target=staffTarget(state,actor,data.email);
  const changes={};
  const rateChange=Object.hasOwn(data,'profitShareYear')||Object.hasOwn(data,'profitSharePercent');
  const wageChange=Object.hasOwn(data,'wageEffectiveDate')||Object.hasOwn(data,'hourlyWage');
  if((!rateChange&&!wageChange)||['name','contactEmail','payScale','vacationHours','sickHours'].some(key=>Object.hasOwn(data,key))){
   const name=clean(data.name,100),contactEmail=staffKey(data.contactEmail);
   if (!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)||contactEmail.length>180) throw Error('Enter a name and valid contact email');
   Object.assign(changes,{name,contactEmail,payScale:clean(data.payScale,80),vacationHours:hours(data.vacationHours,'vacation balance'),sickHours:hours(data.sickHours,'sick balance')});
  }
  if(rateChange)changes.profitShareBpsByYear=updatedProfitRates(profileAt(state,target),data);
  if(wageChange)changes.hourlyWages=changedWageHistory(profileAt(state,target),data);
  const stored=Object.assign(ensureProfile(state,target),changes);
  return {id:target,...safeProfile(state,target),profitShareByYear:profileProfitShare(stored),hourlyWages:verifiedWageHistory(stored)};
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
