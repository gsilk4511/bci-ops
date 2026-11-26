import {randomUUID} from 'node:crypto';
import {validDate} from './payroll.js';
import {fleetStyle} from '../public/modules/fleet-style.js';

const idPattern=/^[0-9a-f-]{36}$/i;
const own=(x,k)=>Object.hasOwn(x,k);
const allowed=(actor,key)=>Boolean(actor?.email&&actor.permissions?.includes(key));
const rows=state=>state.businessManager?.vehicles||[];
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York'}).format(new Date());
const kinds=['oil','registration','inspection','rotation','cleaning','service','repair'];
const recurring=['oil','rotation','cleaning','service'];
const schedulable=[...recurring,'registration','inspection','repair'];
const types=['insurance','registration','inspection','dmv','other'];
const dayShift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const month=x=>x==null||x===''?null:(typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x)?x:(()=>{throw Error('Enter a valid inspection month');})());
const assigned=(row,actor)=>!!row.assignedEmail&&row.assignedEmail===actor.email?.toLowerCase();
const maySeeDoc=(doc,row,actor)=>allowed(actor,'vehicles.manage')||(assigned(row,actor)&&['insurance','registration','inspection'].includes(doc.type));
const getDocs=row=>row.documents||[];
const odometerFrom=(row,entries=history(row))=>{
 const old=entries.reduce((n,x)=>x.mileage!=null?Math.max(n??0,x.mileage):n,row.odometer??null);
 const dates=[...(row.odometerHistory||[])];
 return dates.at(-1)||{mileage:old,date:null};
};
function recordReading(row,at,num){
 const readings=[...(row.odometerHistory||[])], previous=readings.filter(x=>x.date<=at).at(-1), next=readings.find(x=>x.date>at);
 const legacy=odometerFrom({...row,odometerHistory:[]}).mileage;
 if(previous&&num<previous.mileage||next&&num>next.mileage||!readings.length&&num<(legacy??0))
  throw Error('Odometer is inconsistent with the recorded readings for that date');
 const item={date:at,mileage:num};
 readings.push(item);readings.sort((a,b)=>a.date.localeCompare(b.date));row.odometerHistory=readings;
}
function attachment(content){
 if(typeof content!=='string'||content.length>468000)throw Error('Document must be a PDF, JPEG, or PNG under 350 KB');
 if(content.startsWith('data:image/')){
  const result=image(content);if(result.bytes.length>350000)throw Error('Document exceeds 350 KB');return result;
 }
 const m=/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/.exec(content);
 if(!m)throw Error('Document must be a PDF, JPEG, or PNG');
 const bytes=Buffer.from(m[1],'base64');
 if(bytes.length>350000||bytes.toString('base64')!==m[1]||!/^%PDF-[12]\.\d/.test(bytes.subarray(0,8).toString())||
  !/%%EOF\s*$/.test(bytes.subarray(-1024).toString()))throw Error('Invalid PDF document');
 return {mime:'application/pdf',bytes};
}
function str(x,label,max){
 if(x==null)return '';
 if(typeof x!=='string'||x.trim().length>max)throw Error('Invalid '+label);
 return x.trim();
}
const date=x=>x==null||x===''?null:validDate(x);
function miles(x){
 if(x==null||x==='')return null;
 if(!['number','string'].includes(typeof x)||!/^\d{1,7}$/.test(String(x)))throw Error('Invalid mileage');
 return Number(x);
}
function image(data){
 if(typeof data!=='string'||data.length>700000)throw Error('Photo must be JPEG or PNG under 500 KB');
 const m=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!m)throw Error('Photo must be JPEG or PNG');
 const bytes=Buffer.from(m[2],'base64');
 const jpeg=m[1]==='image/jpeg';
 if(bytes.length>500000||bytes.toString('base64')!==m[2]||
 (jpeg?bytes.length<5||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes.at(-2)!==255||bytes.at(-1)!==217:
 bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR'))throw Error('Invalid photo');
 return {mime:m[1],bytes};
}
function history(row){
 if(Array.isArray(row.serviceHistory))return row.serviceHistory;
 return ['registration','oil','inspection'].flatMap(type=>{
  const item=row[type];
  return item?.lastCompletedDate?[{id:'legacy-'+type,type,date:item.lastCompletedDate,mileage:item.lastMileage??null,notes:'Imported last recorded completion',nextDueDate:item.dueDate??null,nextDueMileage:item.dueMileage??null}]:[];
 });
}
const status=(d,n,at,current)=>d&&d<at||n!=null&&current!=null&&current>n?'overdue':
 d===at||n!=null&&current===n?'due':d||n!=null?'upcoming':'not-set';
const mayClean=(row,actor)=>allowed(actor,'vehicles.manage')||Boolean(actor.email&&(row.cleaning?.assignedEmail||row.assignedEmail)===actor.email.toLowerCase());
function view(row,actor,at=today()){
 const entries=history(row), reading=odometerFrom(row,entries), current=reading.mileage;
 const deadline=x=>{
  const effectiveDate=x?.dueMonth?dayShift(x.dueMonth+'-01',new Date(Date.UTC(+x.dueMonth.slice(0,4),+x.dueMonth.slice(5),0)).getUTCDate()-1):x?.dueDate;
  let check=status(effectiveDate,x?.dueMileage,at,current);
  if(check==='upcoming'&&(effectiveDate&&effectiveDate<=dayShift(at,14)||x?.dueMileage!=null&&current!=null&&x.dueMileage-current<=500))check='soon';
  return {dueDate:x?.dueMonth??x?.dueDate??null,lastCompletedDate:x?.lastCompletedDate??null,status:check,
   dueMileage:x?.dueMileage??null,lastCompletedMileage:x?.lastMileage??null,intervalDays:x?.intervalDays??null,
   intervalMiles:x?.intervalMiles??null,assignedEmail:x?.assignedEmail??'',appointment:x?.appointment??null};
 };
 const schedules=Object.fromEntries(schedulable.map(k=>[k,deadline(row[k])]));
 return {id:row.id,name:row.name,year:row.year??null,make:row.make||'',model:row.model||'',vin:row.vin||'',color:row.color||'',plate:row.plate||'',
  style:fleetStyle(row.style,row.color),about:row.about??row.notes??'',health:row.health||'',assignedEmail:row.assignedEmail||'',needsCleanup:!!row.needsCleanup,
  odometer:current,odometerDate:reading.date,odometerStale:!reading.date||reading.date<dayShift(at,-30),
  photoUrl:row.photoDataUrl?'/api/vehicle-photo/'+encodeURIComponent(row.id):null,
  registration:schedules.registration,oil:schedules.oil,inspection:schedules.inspection,schedules,
  mayClean:mayClean(row,actor),tireSets:(row.tireSets||[]).map(({id,name,type,size,totalMiles,mountedAt})=>({id,name,type,size,mountedAt,
   mileage:totalMiles+(mountedAt!=null&&current!=null?Math.max(0,current-mountedAt):0)})),
  documents:getDocs(row).filter(x=>maySeeDoc(x,row,actor)).map(({id,type,name,date,uploadedAt})=>({id,type,name,date,uploadedAt,url:'/api/vehicle-document/'+row.id+'/'+id})),
  serviceHistory:[...entries].sort((a,b)=>b.date.localeCompare(a.date))};
}
export function vehiclesView(state,actor){
 if(!allowed(actor,'vehicles.view'))return undefined;
 const at=today();return {today:at,records:rows(state).map(x=>view(x,actor,at)),
  ...(allowed(actor,'vehicles.manage')?{staff:(state.users||[]).filter(x=>x.active!==false&&x.email).map(x=>({email:x.email.toLowerCase(),name:x.name||x.email}))}:{})};
}
export function vehicleDocument(state,actor,vehicleId,docId){
 if(!allowed(actor,'vehicles.view')||!idPattern.test(vehicleId)||!idPattern.test(docId))return undefined;
 const row=rows(state).find(x=>x.id===vehicleId), doc=row&&getDocs(row).find(x=>x.id===docId);
 return doc&&maySeeDoc(doc,row,actor)?attachment(doc.content):undefined;
}
function assignee(state,input){
 const email=str(input,'assignee',254).toLowerCase();
 if(email&&!(state.users||[]).some(x=>x.active!==false&&x.email?.toLowerCase()===email))throw Error('Select an active Team member');
 return email;
}
export function vehiclePhoto(state,actor,id){
 if(!allowed(actor,'vehicles.view')||!idPattern.test(id))return undefined;
 const found=rows(state).find(row=>row.id===id)?.photoDataUrl;
 return found?image(found):undefined;
}
export function vehiclesAction(state,data,actor){
 if(!allowed(actor,'vehicles.view')||!allowed(actor,'vehicles.manage'))throw Error('Vehicle edit permission required');
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid vehicle update');
 const old=own(data,'id')&&typeof data.id==='string'&&idPattern.test(data.id)&&rows(state).find(x=>x.id===data.id);
 if(own(data,'id')&&!old)throw Error('Vehicle not found');
 if(data.operation==='saveVehicle'){
  const year=own(data,'year')?miles(data.year):old?.year;
  if(year!=null&&(year<1886||year>Number(today().slice(0,4))+2))throw Error('Enter a valid vehicle model year');
  const row={...old,id:old?.id||randomUUID(),year:year??null,serviceHistory:old?history(old):[]};
  if(own(data,'assignedEmail'))row.assignedEmail=assignee(state,data.assignedEmail);
  if(own(data,'needsCleanup'))row.needsCleanup=data.needsCleanup===true;
  for(const [key,max] of Object.entries({name:100,make:80,model:80,vin:17,about:1200,color:60,plate:30,health:240}))
   if(own(data,key))row[key]=str(data[key],key,max);
  if(!row.name)throw Error('Enter a vehicle name');
  if(row.vin){
   row.vin=row.vin.toUpperCase();
   if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(row.vin))throw Error('Enter a valid 17-character VIN');
   if(rows(state).some(x=>x.id!==row.id&&x.vin?.toUpperCase()===row.vin))throw Error('VIN already assigned');
  }
  for(const k of ['registration','inspection','oil']){
   row[k]={...old?.[k]};
   if(own(data,k+'DueDate'))row[k].dueDate=date(data[k+'DueDate']);
   if(row[k].dueDate&&row[k].lastCompletedDate&&row[k].dueDate<=row[k].lastCompletedDate)throw Error('Due date must follow last completion');
  }
  if(own(data,'oilDueMileage'))row.oil.dueMileage=miles(data.oilDueMileage);
  if(row.oil.dueMileage!=null&&row.oil.lastMileage!=null&&row.oil.dueMileage<=row.oil.lastMileage)throw Error('Next oil mileage must exceed last oil mileage');
  if(own(data,'odometer')&&miles(data.odometer)!=null){
   const readingDate=date(data.odometerDate)||today();
   if(readingDate>today())throw Error('Odometer reading cannot be in the future');
   recordReading(row,readingDate,miles(data.odometer));
  }
  if(own(data,'photoDataUrl')){
   if(data.photoDataUrl==null||data.photoDataUrl==='')delete row.photoDataUrl;
   else {image(data.photoDataUrl);row.photoDataUrl=data.photoDataUrl;}
  }
  const tracker=state.businessManager??{vehicles:[],bills:[]};
  const records=tracker.vehicles??[];
  tracker.vehicles=old?records.map(x=>x===old?row:x):[...records,row];
  state.businessManager=tracker;
  return view(row,actor);
 }
 if(!old)throw Error('Vehicle not found');
 const row={...old,serviceHistory:[...history(old)]};
 const finish=()=>{Object.assign(old,row);return view(row,actor);};
 if(data.operation==='saveStyle'){
  row.style=data.style===null?undefined:fleetStyle(data.style,row.color,true);
  return finish();
 }
 if(data.operation==='saveSchedule'){
  const key=data.type;
  if(!schedulable.includes(key))throw Error('Invalid schedule type');
  const dueDate=date(data.dueDate), dueMonth=key==='inspection'?month(data.dueMonth):null;
  if(dueDate&&dueMonth)throw Error('Enter an inspection date or month, not both');
  const intervalDays=miles(data.intervalDays),intervalMiles=miles(data.intervalMiles),dueMileage=miles(data.dueMileage);
  if((!recurring.includes(key)&&(intervalDays!=null||intervalMiles!=null||dueMileage!=null))||intervalDays===0||intervalDays>3650||intervalMiles===0)throw Error('Invalid service interval');
  if(key==='cleaning'&&(intervalMiles!=null||dueMileage!=null))throw Error('Use a date for cleaning');
  row[key]={...old[key],dueDate,dueMonth,intervalDays,intervalMiles,dueMileage,assignedEmail:assignee(state,data.assignedEmail)};
  return finish();
 }
 if(data.operation==='bookService'){
  const key=data.type;
  if(!schedulable.includes(key))throw Error('Invalid appointment type');
  const booked=date(data.appointmentDate);
  const time=str(data.appointmentTime,'appointment time',5);
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Invalid appointment time');
  row[key]={...old[key],appointment:booked?{date:booked,time,location:str(data.location,'location',160)}:null};
  return finish();
 }
 if(data.operation==='saveDocument'){
  if(!types.includes(data.type))throw Error('Invalid document type');
  const name=str(data.name,'document name',100);
  if(!name)throw Error('Enter a document name');
  const bytes=attachment(data.content).bytes.length;
  const total=rows(state).flatMap(getDocs).reduce((n,x)=>n+(x.content?.length||0),0);
  if(getDocs(old).length>=12||total+data.content.length>2800000)throw Error('Fleet document storage limit reached; remove an outdated file before adding another');
  row.documents=[...getDocs(old),{id:randomUUID(),type:data.type,name,date:date(data.date),uploadedAt:today(),bytes,content:data.content}];
  return finish();
 }
 if(data.operation==='removeDocument'){
  if(!getDocs(old).some(x=>x.id===data.documentId))throw Error('Document not found');
  row.documents=getDocs(old).filter(x=>x.id!==data.documentId);return finish();
 }
 if(data.operation==='saveTireSet'){
  const name=str(data.name,'tire set name',80);
  if(!name)throw Error('Enter a tire set name');
  const sets=old.tireSets||[];
  if(sets.length>=20)throw Error('Vehicle already has 20 tire sets');
  row.tireSets=[...sets,{id:randomUUID(),name,type:str(data.type,'tire type',80),size:str(data.size,'tire size',80),totalMiles:miles(data.priorMiles)??0,mountedAt:null}];
  return finish();
 }
 if(data.operation==='tireSwap'){
  const sets=(old.tireSets||[]).map(x=>({...x})),mounted=sets.find(x=>x.mountedAt!=null);
  const replacement=data.tireSetId?sets.find(x=>x.id===data.tireSetId):null;
  const at=date(data.date),n=miles(data.mileage);
  if(!at||at>today()||at<(old.lastTireSwapDate||'')||n==null||data.tireSetId&&!replacement||replacement===mounted||(!replacement&&!mounted))
   throw Error('Select a different tire set and a valid swap date and mileage');
  if(mounted&&n<mounted.mountedAt)throw Error('Removal odometer cannot precede installation');
  recordReading(row,at,n);
  if(mounted){mounted.totalMiles+=n-mounted.mountedAt;mounted.mountedAt=null;}
  if(replacement)replacement.mountedAt=n;
  row.tireSets=sets;row.lastTireSwapDate=at;
  row.serviceHistory.push({id:randomUUID(),type:'tires',date:at,mileage:n,notes:[mounted?'Removed '+mounted.name:'',replacement?'Mounted '+replacement.name:''].filter(Boolean).join('; ')});
  return finish();
 }
 if(data.operation!=='recordService'||!kinds.includes(data.type))throw Error('Invalid service operation');
 const at=date(data.date);
 if(!at||at>today())throw Error('Enter a service date no later than today');
 const mileage=miles(data.mileage);
 const previous=old[data.type]||{};
 const latest=!previous.lastCompletedDate||at>=previous.lastCompletedDate;
 let nextDueDate=date(data.nextDueDate), nextDueMileage=miles(data.nextDueMileage);
 const nextDueMonth=data.type==='inspection'?month(data.nextDueMonth):null;
 if(nextDueDate&&nextDueMonth)throw Error('Enter an inspection date or month, not both');
 if(nextDueMonth&&nextDueMonth<at.slice(0,7))throw Error('Inspection month cannot precede completion');
 if(recurring.includes(data.type)&&latest){
  if(!nextDueDate&&previous.intervalDays)nextDueDate=dayShift(at,previous.intervalDays);
  if(nextDueMileage==null&&previous.intervalMiles){
   if(mileage==null)throw Error('Enter the odometer to recalculate the mileage schedule');
   nextDueMileage=mileage+previous.intervalMiles;
  }
 }
 if(nextDueDate&&nextDueDate<=at)throw Error('Next date must follow completion');
 if(nextDueMileage!=null&&(!recurring.includes(data.type)||nextDueMileage<=(mileage??previous.lastMileage??-1)))throw Error('Next mileage must exceed the completed mileage');
 if(data.type==='oil'&&latest&&mileage!=null&&previous.lastMileage!=null&&mileage<previous.lastMileage)throw Error('Oil mileage cannot decrease');
 if(mileage!=null&&((row.odometerHistory||[]).length||mileage>=(odometerFrom(old).mileage??0)))recordReading(row,at,mileage);
 row.serviceHistory.push({id:randomUUID(),type:data.type,date:at,mileage,notes:str(data.notes,'service notes',1200),nextDueDate,nextDueMileage,nextDueMonth});
 if(latest){
  const compliance=['inspection','registration'].includes(data.type);
  row[data.type]={...previous,lastCompletedDate:at,appointment:previous.appointment?.date>at?previous.appointment:null,
   dueDate:compliance&&!nextDueDate&&!nextDueMonth?previous.dueDate??null:nextDueDate,
   dueMonth:compliance&&!nextDueDate&&!nextDueMonth?previous.dueMonth??null:nextDueMonth,
   ...(recurring.includes(data.type)?{dueMileage:nextDueMileage,lastMileage:mileage??previous.lastMileage??null}:{})};
  if(data.type==='cleaning')row.needsCleanup=false;
 }
 return finish();
}

export function completeAssignedCleanup(state,data,actor){
 if(!allowed(actor,'vehicles.view'))throw Error('Vehicle access required');
 const row=rows(state).find(x=>x.id===data.id);
 if(!row||!mayClean(row,actor))throw Error('Cleanup must be assigned to you');
 const at=today();
 if(row.cleaning?.lastCompletedDate===at&&!row.needsCleanup)throw Error('Cleanup already completed today');
 vehiclesAction(state,{operation:'recordService',id:row.id,type:'cleaning',date:at,notes:str(data.notes,'cleanup notes',1200)},
  {...actor,permissions:['vehicles.view','vehicles.manage']});
 return view(row,actor);
}
