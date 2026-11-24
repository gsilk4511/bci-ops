import {can,data,esc,f,modal,send,today} from '../app.js';
import {receiptPayload} from './work-entry.js';

const kinds={oil:'Oil change',registration:'Registration',inspection:'Inspection',service:'Service',repair:'Repair'};
const colors=[['slate','Slate'],['blue','Blue'],['green','Green'],['amber','Amber'],['red','Red']];
const colorNames=new Set(colors.map(([key])=>key));
const miles=value=>value!=null&&value!==''?Number(value).toLocaleString()+' mi':'Not set';
const dateText=value=>value?esc(value):'Not set';
const line=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;
const action=(key,label,id='')=>`<button type="button" class="secondary small" data-fleet-action="${key}" data-fleet-id="${esc(id)}">${label}</button>`;
const status={overdue:'Overdue',due:'Due now',upcoming:'Scheduled','not-set':'Not scheduled'};
const badge=entry=>`<span class="bci-manager-status" data-kind="${esc(entry.status||'none')}">${esc(status[entry.status]||'Not scheduled')}</span>`;
const dateField=(key,label,value,required=false)=>f(key,label,{type:'date',value:value||'',required});
const mileField=(key,label,value)=>f(key,label,{type:'number',min:0,step:'1',value:value==null?'':String(value)});

export function fleetPage(){
 const fleet=data?.vehicles;
 if(!fleet||!can('vehicles.view'))return '<section class="panel"><h1>Vehicles</h1><p>Fleet data is unavailable.</p></section>';
 const manage=can('vehicles.manage'),records=fleet.records||[];
 const tasks=records.flatMap(row=>['oil','registration','inspection'].map(key=>row[key]||{}));
 const overdue=tasks.filter(row=>row.status==='overdue').length;
 const due=tasks.filter(row=>row.status==='due').length;
 const renderVehicle=row=>{
  const profile=[row.make,row.model].filter(Boolean).join(' ');
  const layout=['oil','registration','inspection'].map(key=>{
   const entry=row[key]||{};
   return `<div class="bci-manager-maintenance"><h4>${kinds[key]}</h4><dl>${line('Next due',dateText(entry.dueDate))}
     ${key==='oil'?line('Next at odometer',miles(entry.dueMileage)):''}${line('Last completed',dateText(entry.lastCompletedDate))}</dl>
     ${badge(entry)}${manage?action(key,'Record '+kinds[key].toLowerCase(),row.id):''}</div>`;
  }).join('');
  const entries=(row.serviceHistory||[]).map(item=>`<li><b>${esc(kinds[item.type]||'Service')} · ${dateText(item.date)}</b>
   ${item.mileage==null?'':` · ${miles(item.mileage)}`}${item.notes?`<p>${esc(item.notes)}</p>`:''}</li>`).join('');
  return `<article class="panel bci-manager-card bci-vehicle-card" data-vehicle-color="${colorNames.has(row.color)?row.color:'slate'}">
   <header class="bci-vehicle-header">${row.photoUrl?`<img class="bci-vehicle-photo" src="${esc(row.photoUrl)}" alt="" width="96" height="72" loading="lazy">`:''}
    <div><h3>${esc(row.name)}</h3>${profile?`<p>${esc(profile)}</p>`:''}</div></header>
   <dl>${line('VIN',esc(row.vin||'Not set'))}${line('Plate',esc(row.plate||'Not set'))}${line('Odometer',miles(row.odometer))}
    ${line('Health notes',esc(row.health||'Not recorded'))}</dl>
   ${row.about?`<p class="bci-manager-notes">${esc(row.about)}</p>`:''}
   <div class="bci-vehicle-maintenance">${layout}</div>
   <details><summary>Service and repair history (${(row.serviceHistory||[]).length})</summary>${entries?`<ul>${entries}</ul>`:'<p>No completed work recorded.</p>'}</details>
   ${manage?`<div class="bci-manager-actions">${action('edit','Edit vehicle',row.id)}${action('service','Log service',row.id)}${action('repair','Log repair',row.id)}</div>`:''}
  </article>`;
 };
 return `<div class="pagehead"><div><h1>Vehicles</h1><p>Company vehicle profiles, due dates and completed maintenance.</p></div>${manage?action('edit','+ Add vehicle'):''}</div>
  <section class="panel bci-manager"><dl class="bci-manager-summary">${line('Vehicles',records.length)}${line('Overdue',overdue)}${line('Due now',due)}</dl>
  ${manage?'':'<p class="muted">Read only</p>'}</section>
  ${records.length?`<div class="bci-manager-grid">${records.map(renderVehicle).join('')}</div>`:'<p>No vehicles yet.</p>'}`;
}

document.addEventListener('click',event=>{
 const button=event.target.closest('[data-fleet-action]'), board=data?.vehicles;
 if(!button||!board||!can('vehicles.view')||!can('vehicles.manage'))return;
 const {fleetAction:key,fleetId:id}=button.dataset;
 const row=(board.records||[]).find(item=>item.id===id);
 if(id&&!row)return;
 if(key==='edit'){
  const item=row||{};
  modal(row?'Edit vehicle':'Add vehicle',
   f('name','Vehicle name',{required:true,value:item.name})+f('make','Make',{value:item.make})+f('model','Model',{value:item.model})+
   f('vin','VIN',{value:item.vin})+f('plate','License plate',{value:item.plate})+mileField('odometer','Current odometer in miles',item.odometer)+
   f('color','Profile color',{select:colors,value:colorNames.has(item.color)?item.color:'slate'})+
   f('about','About the vehicle',{textarea:true,value:item.about})+f('health','Vehicle health notes',{value:item.health})+
   '<div class="field"><label for="vehicle-photo">Profile photo (JPEG or PNG)</label><input id="vehicle-photo" name="vehiclePhoto" type="file" accept="image/jpeg,image/png"></div>'+
   (item.photoUrl?'<label><input type="checkbox" name="removePhoto" value="yes"> Remove current photo</label>':'')+
   dateField('registrationDueDate','Next renewal date',item.registration?.dueDate)+dateField('inspectionDueDate','Next inspection date',item.inspection?.dueDate)+
   dateField('oilDueDate','Next oil change date',item.oil?.dueDate)+mileField('oilDueMileage','Next oil change at odometer',item.oil?.dueMileage),
   async ({vehiclePhoto,removePhoto,...values})=>{
    if(vehiclePhoto?.size&&removePhoto)throw Error('Choose a new photo or remove the current one, not both.');
    if(vehiclePhoto?.size){const payload=await receiptPayload(vehiclePhoto,crypto.randomUUID());values.photoDataUrl='data:image/jpeg;base64,'+payload.content;}
    else if(removePhoto)values.photoDataUrl='';
    return send('vehicles.manage',{operation:'saveVehicle',...(id?{id}:{}),...values});
   });return;
 }
 if(!row||!Object.hasOwn(kinds,key))return;
 const standard=['oil','registration','inspection'].includes(key);
 modal('Record '+kinds[key].toLowerCase(),dateField('date','Completed on',board.today||today(),true)+
  mileField('mileage','Odometer at service (optional)','')+
  (standard?dateField('nextDueDate','Next due date (optional)',''):'')+
  (key==='oil'?mileField('nextDueMileage','Next oil change at odometer (optional)',''):'')+
  f('notes','Service notes',{textarea:true}),
  values=>send('vehicles.manage',{operation:'recordService',id,type:key,...values}),
  '<p>Use this for completed work only. Update future due dates in the vehicle profile.</p>');
});
