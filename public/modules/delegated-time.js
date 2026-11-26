import {travelEntryFields,bindTravelEntryFields,travelEntryPayload} from './travel-entry-fields.js';
import {can,data,esc,f,me,modal,practiceMode,send,today,wo} from '../app.js';

const targets=()=>me?.role==='admin'&&can('workorders.view')&&can('entry.add')&&can('staff.manage')&&!practiceMode?
 (data?.staff?.entryTargets||[]):[];
export function delegatedTimeButton(order){
 if(!order.approvedAt||order.closeout||order.invoice||!targets().length)return '';
 return `<button type="button" class="secondary" data-delegated-time="${esc(order.id)}">Log time for employee</button>`;
}
function open(order){
 const employees=targets();
 if(!employees.length||!order?.approvedAt||order.closeout||order.invoice)return;
 const approved=(order.changes||[]).filter(change=>change.status==='approved');
 const submissionId=crypto.randomUUID();
 modal('Log time for employee',
  f('employeeEmail','Employee',{required:true,select:[['','Select employee'],...employees.map(person=>[person.email,person.name+' · '+person.email]) ]})+
  f('date','Work date',{type:'date',required:true,value:today()})+
  f('type','Time type',{select:[['labor','Work'],['travel','Travel']]})+
  (approved.length?f('changeId','Approved scope',{select:[['','Original scope'],...approved.map(change=>[change.id,change.description])]}):'')+
  f('catalogId','Service',{required:true,select:[['','Select service']]})+
  f('how','Record by',{select:[['clock','Start and end'],['duration','Total hours']]})+
  '<div class="grid2" data-delegated-clock>'+f('startTime','Start',{type:'time',required:true})+f('endTime','End',{type:'time',required:true})+'</div>'+
  '<div data-delegated-duration hidden>'+f('quantity','Total hours',{type:'number',min:.01,max:24,step:'any',required:true})+'</div>'+
  travelEntryFields(f)+
  f('description','Work notes',{required:true,textarea:true}),
  values=>send('entry.addForEmployee',{employeeEmail:values.employeeEmail,date:values.date,type:values.type,changeId:values.changeId,catalogId:values.catalogId,
   startTime:values.startTime,endTime:values.endTime,quantity:values.quantity,...(values.type==='travel'?travelEntryPayload(values):{}),
   description:values.description,submissionId,workorderId:order.id}),
  '<p>The time belongs to the selected employee. The journal records who entered it.</p>');
 const form=document.querySelector('#actionForm');
 bindTravelEntryFields(form,{isTravel:()=>form.elements.type.value==='travel',hasSignedRate:()=>!!form.elements.changeId?.value});
 const {catalogId,changeId,endTime,how,quantity,startTime,type}=form.elements;
 function refresh(){
  const change=approved.find(row=>row.id===changeId?.value);
  const choices=(data.catalog||[]).filter(row=>row.type===type.value&&/^(hr|hour|hours|h)$/i.test(row.unit)&&
   (row.type==='travel'||!row.needsPricing||order.effectivePricing?.id||change)&&(!change||change.lines.some(line=>line.catalogId===row.id)));
  const current=catalogId.value;
  catalogId.replaceChildren(new Option('Select service',''),...choices.map(row=>new Option(row.name,row.id)));
  catalogId.value=choices.some(row=>row.id===current)?current:choices.length===1?choices[0].id:'';
  const duration=how.value==='duration';
  form.querySelector('[data-delegated-clock]').hidden=duration;startTime.disabled=endTime.disabled=duration;
  form.querySelector('[data-delegated-duration]').hidden=!duration;quantity.disabled=!duration;

 }
 for(const field of [changeId,how,type])field?.addEventListener('change',refresh);
 refresh();
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-delegated-time]');
 if(button)open(wo(button.dataset.delegatedTime));
});
