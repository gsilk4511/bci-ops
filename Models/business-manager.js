import {vehiclesAction} from './vehicles.js';
import {randomUUID} from 'node:crypto';
import {validDate} from './payroll.js';

const can=(actor,grant)=>Boolean(actor?.email&&actor.permissions?.includes(grant));
const trackedId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const own=(data,key)=>Object.hasOwn(data,key);
const eastDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
function today(){
 const {year,month,day}=Object.fromEntries(eastDate.formatToParts().map(({type,value})=>[type,value]));
 return year+'-'+month+'-'+day;
}

function string(value,label,max,required=false){
 if(value==null&&!required)return '';
 if(typeof value!=='string'||value.trim().length>max||required&&!value.trim())throw Error('Enter '+label+' ('+max+' characters maximum)');
 return value.trim();
}
function date(value,optional=true){
 if(optional&&(value==null||value===''))return null;
 if(typeof value!=='string')throw Error('Enter a valid date');
 return validDate(value);
}
function number(value,label,max,decimal=false){
 if(value==null||value==='')return null;
 const pattern=decimal?/^\d+(?:\.\d{1,2})?$/:/^\d+$/;
 if(!['string','number'].includes(typeof value)||!pattern.test(String(value))||Number(value)>max)throw Error('Enter '+label+' from 0 to '+max);
 return Number(value);
}
const dollars=value=>number(value,'the bill amount',99999999.99,true);
const requiredRow=(rows,id,label)=>{
 if(typeof id!=='string'||!trackedId.test(id))throw Error('Invalid '+label+' ID');
 const row=rows.find(item=>item.id===id);
 if(!row)throw Error(label+' not found');
 return row;
};
function completedDate(value){
 const result=date(value,false);
 if(result>today())throw Error('Completion or paid date cannot be in the future');
 return result;
}
const completionDates=record=>({dueDate:record?.dueDate??null,lastCompletedDate:record?.lastCompletedDate??null});
const vehicleView=row=>({id:row.id,name:row.name,plate:row.plate||'',notes:row.notes||'',registration:completionDates(row.registration),
 oil:{...completionDates(row.oil),dueMileage:row.oil?.dueMileage??null,lastMileage:row.oil?.lastMileage??null}});
const billView=row=>({id:row.id,name:row.name,vendor:row.vendor||'',dueDate:row.dueDate,amount:row.amount??null,notes:row.notes||'',
 status:row.paidDate?'paid':'open',paidDate:row.paidDate??null});

export function businessManagerView(state,actor){
 if(!can(actor,'staff.view')||!can(actor,'businessManager.view'))return undefined;
 return {today:today(),vehicles:can(actor,'vehicles.view')?(state.businessManager?.vehicles||[]).map(vehicleView):[],
  bills:(state.businessManager?.bills||[]).map(billView)};
}

export function businessManagerAction(state,data,actor){
 if(!['admin','office','tech'].includes(actor?.role)||!can(actor,'staff.view')||!can(actor,'businessManager.view')||
  !can(actor,'businessManager.manage'))throw Error('Business Manager edit permission required');
 if(data===null||typeof data!=='object'||Array.isArray(data))throw Error('Invalid Business Manager update');
 const tracker=state.businessManager??{vehicles:[],bills:[]};
 const {vehicles,bills}=tracker;
 switch(data.operation){
  case 'saveVehicle': {
   const result=vehiclesAction(state,{...data,about:data.notes},actor);
   const row=state.businessManager.vehicles.find(item=>item.id===result.id);
   if(data.notes!==undefined)row.notes=row.about;
   return vehicleView(row);
  }
  case 'completeRegistration':
  case 'completeOil': {
   const type=data.operation==='completeOil'?'oil':'registration';
   const row=requiredRow(vehicles,data.id,'Vehicle');
   if(row[type]?.lastCompletedDate&&data.completedDate<row[type].lastCompletedDate)throw Error('Completion cannot be before the last recorded date');
   vehiclesAction(state,{...data,type,operation:'recordService',date:data.completedDate,mileage:data.completedMileage},actor);
   return vehicleView(row);
  }
  case 'saveBill': {
   const existing=own(data,'id')?requiredRow(bills,data.id,'Bill'):null;
   if(existing?.paidDate)throw Error('Paid bills cannot be edited');
   const row={id:existing?.id||randomUUID(),name:string(data.name,'a bill name',120,true),vendor:string(data.vendor,'vendor',120),
    dueDate:date(data.dueDate,false),amount:dollars(data.amount),notes:string(data.notes,'notes',1200),paidDate:null};
   if(existing)Object.assign(existing,row);else bills.push(row);
   state.businessManager=tracker;
   return billView(row);
  }
  case 'markBillPaid': {
   const row=requiredRow(bills,data.id,'Bill');
   if(row.paidDate)throw Error('Bill already marked paid');
   row.paidDate=completedDate(data.paidDate);
   return billView(row);
  }
  default: throw Error('Unknown Business Manager operation');
 }
}
