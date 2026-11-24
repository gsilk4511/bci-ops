import {randomUUID} from 'node:crypto';
import {validDate} from './payroll.js';

const idPattern=/^[0-9a-f-]{36}$/i;
const own=(x,k)=>Object.hasOwn(x,k);
const allowed=(actor,key)=>Boolean(actor?.email&&actor.permissions?.includes(key));
const rows=state=>state.businessManager?.vehicles||[];
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York'}).format(new Date());
const kinds=['oil','registration','inspection','service','repair'];
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
function view(row,at=today()){
 const entries=history(row);
 const current=entries.reduce((n,x)=>x.mileage!=null?Math.max(n??0,x.mileage):n,row.odometer??null);
 const deadline=(x,isOil=false)=>({dueDate:x?.dueDate??null,lastCompletedDate:x?.lastCompletedDate??null,
  status:status(x?.dueDate,isOil?x?.dueMileage:null,at,current),
  ...(isOil?{dueMileage:x?.dueMileage??null,lastCompletedMileage:x?.lastMileage??null}:{})});
 return {id:row.id,name:row.name,make:row.make||'',model:row.model||'',vin:row.vin||'',color:row.color||'',plate:row.plate||'',
  about:row.about??row.notes??'',health:row.health||'',odometer:current,photoUrl:row.photoDataUrl?'/api/vehicle-photo/'+encodeURIComponent(row.id):null,
  registration:deadline(row.registration),oil:deadline(row.oil,true),inspection:deadline(row.inspection),
  serviceHistory:[...entries].sort((a,b)=>b.date.localeCompare(a.date))};
}
export function vehiclesView(state,actor){
 if(!allowed(actor,'vehicles.view'))return undefined;
 const at=today();return {today:at,records:rows(state).map(x=>view(x,at))};
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
  const row={...old,id:old?.id||randomUUID(),serviceHistory:old?history(old):[]};
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
  if(own(data,'odometer'))row.odometer=miles(data.odometer);
  if(own(data,'photoDataUrl')){
   if(data.photoDataUrl==null||data.photoDataUrl==='')delete row.photoDataUrl;
   else {image(data.photoDataUrl);row.photoDataUrl=data.photoDataUrl;}
  }
  const tracker=state.businessManager??{vehicles:[],bills:[]};
  const records=tracker.vehicles??[];
  tracker.vehicles=old?records.map(x=>x===old?row:x):[...records,row];
  state.businessManager=tracker;
  return view(row);
 }
 if(data.operation!=='recordService'||!old||!kinds.includes(data.type))throw Error('Invalid service operation');
 const at=date(data.date);
 if(!at||at>today())throw Error('Enter a service date no later than today');
 const mileage=miles(data.mileage),nextDueDate=date(data.nextDueDate),nextDueMileage=miles(data.nextDueMileage);
 const standard=['oil','registration','inspection'].includes(data.type);
 if(nextDueDate&&(!standard||nextDueDate<=at))throw Error('Next date must be after a tracked completion');
 if(nextDueMileage!=null&&(data.type!=='oil'||nextDueMileage<=(mileage??old.oil?.lastMileage??-1)))throw Error('Next mileage must exceed the completed oil mileage');
 const previous=old[data.type]||{};
 const latest=!previous.lastCompletedDate||at>=previous.lastCompletedDate;
 if(data.type==='oil'&&latest&&mileage!=null&&previous.lastMileage!=null&&mileage<previous.lastMileage)throw Error('Oil mileage cannot decrease');
 const entry={id:randomUUID(),type:data.type,date:at,mileage,notes:str(data.notes,'service notes',1200),nextDueDate,nextDueMileage};
 const row={...old,serviceHistory:[...history(old),entry]};
 if(standard&&latest)row[data.type]={...previous,dueDate:nextDueDate,lastCompletedDate:at,
  ...(data.type==='oil'?{dueMileage:nextDueMileage,lastMileage:mileage??previous.lastMileage??null}:{})};
 Object.assign(old,row);return view(row);
}
