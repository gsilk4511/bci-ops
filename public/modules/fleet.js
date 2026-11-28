import {createFleetSoundPlayer,fleetSound,fleetSoundOptions} from './fleet-sounds.js';
import {can,data,esc,f,modal,render,send,today} from '../app.js';
import {receiptPayload} from './work-entry.js';
import {fleetStyle,fleetStyleFields,fleetStyleVars,profileStyleOptions} from './fleet-style.js';

const kinds={insurance:'Insurance',oil:'Oil change',registration:'Registration',inspection:'Inspection',rotation:'Tire rotation',cleaning:'Cab cleanup',service:'General service',repair:'Repair'};
const types=[['insurance','Insurance card'],['registration','Registration'],['inspection','Inspection'],['dmv','DMV / restricted'],['other','Other / restricted']];
const colors=[['slate','Slate'],['blue','Blue'],['green','Green'],['amber','Amber'],['red','Red']];
const colorNames=new Set(colors.map(([key])=>key));
const miles=value=>value!=null&&value!==''?Number(value).toLocaleString()+' mi':'Not set';
const line=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;
const action=(key,label,id='',type='')=>`<button type="button" class="secondary small" data-fleet-action="${key}" data-fleet-id="${esc(id)}" data-fleet-type="${esc(type)}">${esc(label)}</button>`;
const status={overdue:'Overdue',due:'Due now',soon:'Due soon',upcoming:'Upcoming','not-set':'Not scheduled'};
const badge=(kind,label)=>`<span class="bci-manager-status" data-kind="${esc(kind)}">${esc(label)}</span>`;
const dateField=(key,label,value,required=false)=>f(key,label,{type:'date',value:value||'',required});
const numberField=(key,label,value,min=0)=>f(key,label,{type:'number',min,step:'1',value:value==null?'':String(value)});
const dateText=value=>esc(value||'Not set');
const staffOptions=(board,row,key='assignedEmail')=>{
 const options=[['','Unassigned'],...(board.staff||[]).map(p=>[p.email,p.name])], value=row[key]||'';
 if(value&&!options.some(([email])=>email===value))options.push([value,value+' (inactive)']);
 return f(key,'Assigned to',{select:options,value});
};
const manageOnly=(set,html)=>set?html:'';

const vehiclePlayer=createFleetSoundPlayer();
let selectedVehicle='',fleetFilter='all',fleetScroll=0;
const sections=new Map();
const sectionOpen=(row,key,defaultOpen=false)=>((sections.get(row.id)?.[key]??defaultOpen)?' open':'');
const level={overdue:0,due:1,soon:2};
function attention(row,today){
 const schedules=row.schedules||{};
 const urgent=Object.entries(schedules).filter(([,e])=>Object.hasOwn(level,e.status)).sort(([,a],[,b])=>level[a.status]-level[b.status]);
 if(urgent.length){
  const [key,e]=urgent[0];
  const delta=e.dueMileage==null||row.odometer==null?null:e.dueMileage-row.odometer;
  const suffix=e.status==='soon'&&!row.odometerStale&&delta>0&&delta<=500?' due in '+miles(delta):
   e.status==='soon'&&e.dueDate?' due '+e.dueDate:' '+(status[e.status]||'').toLowerCase();
  return {kind:e.status,text:(kinds[key]||'Service')+suffix,extra:urgent.length-1};
 }
 if(row.needsCleanup)return {kind:'soon',text:'Needs cleanup'};
 const booked=Object.entries(schedules).filter(([,e])=>e.appointment?.date>=today).sort(([,a],[,b])=>a.appointment.date.localeCompare(b.appointment.date))[0];
 if(booked)return {kind:'booked',text:(kinds[booked[0]]||'Service')+' booked '+booked[1].appointment.date};
 if(['registration','inspection','oil'].some(key=>!schedules[key]?.dueDate&&schedules[key]?.dueMileage==null))
  return {kind:'not-set',text:'Setup needed'};
 return {kind:'upcoming',text:'No service due soon'};
}
const modelName=row=>[row.year,row.make,row.model].filter(Boolean).join(' ');
const photo=(row,large=false)=>`<span class="fleet-photo-trim">${row.photoUrl?
 `<img src="${esc(row.photoUrl)}" alt="" width="${large?220:90}" height="${large?150:70}"${large?'':' loading="lazy"'}>`:
 '<span class="fleet-photo-placeholder" aria-hidden="true">◇</span>'}</span>`;
function miniCard(row,at,preview=false){
 const info=attention(row,at), tag=preview?'div':'button';
 return `<${tag} class="fleet-mini" style="${esc(fleetStyleVars(row.style,row.color))}"${preview?'':` type="button" data-fleet-action="open" data-fleet-id="${esc(row.id)}"`}>
 ${photo(row)}<span class="fleet-mini-copy"><strong>${esc(row.name)}</strong>
 <span class="fleet-model">${esc(modelName(row)||'Vehicle')}</span>
 ${badge(info.kind,info.text+(info.extra?' +'+info.extra:''))}</span><span class="fleet-arrow" aria-hidden="true">›</span></${tag}>`;
}
function showFleetLocation(selector,y,vehicleId=''){
 render();
 const restore=()=>{
  const card=vehicleId&&Array.from(document.querySelectorAll('[data-fleet-action="open"]')).find(el=>el.dataset.fleetId===vehicleId);
  const node=card||document.querySelector(selector);
  node?.focus({preventScroll:true});
  window.scrollTo(0,y);
 };
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(restore);
 else if(typeof window!=='undefined')restore();
}
export function selectFleetVehicle(id){
 if(!(data?.vehicles?.records||[]).some(row=>row.id===id))return false;
 selectedVehicle=id;return true;
}
export function fleetPage(){
 const fleet=data?.vehicles;
 if(!fleet||!can('vehicles.view'))return '<section class="panel"><h1>Vehicles</h1><p>Fleet data is unavailable.</p></section>';
 const manage=can('vehicles.manage'),records=fleet.records||[];
 const active=records.find(row=>row.id===selectedVehicle);
 if(!active)selectedVehicle='';
 const count=key=>records.filter(row=>matchesFilter(row,key)).length;
 const person=email=>esc(fleet.staff?.find(x=>x.email===email)?.name||email||'Unassigned');
 const renderVehicle=row=>{
  const profile=modelName(row), next=attention(row,fleet.today);
  const layout=Object.keys(kinds).map(key=>{
   const entry=row.schedules?.[key]||{}, visit=entry.appointment;
   return `<div class="bci-manager-maintenance"><h4>${kinds[key]}</h4><dl>${line('Next due',dateText(entry.dueDate))}
     ${entry.dueMileage==null?'':line('Next at odometer',miles(entry.dueMileage))}
     ${entry.intervalDays||entry.intervalMiles?line('Repeats',[entry.intervalDays&&`every ${entry.intervalDays} days`,entry.intervalMiles&&`every ${miles(entry.intervalMiles)}`].filter(Boolean).join(' or ')):''}
     ${line('Last completed',dateText(entry.lastCompletedDate))}${line('Assigned to',person(entry.assignedEmail||row.assignedEmail))}
     ${visit?line('Booked',esc([visit.date,visit.time&&[visit.time,visit.endTime].filter(Boolean).join('–'),visit.location].filter(Boolean).join(' · '))):''}</dl>
     ${badge(entry.status||'not-set',status[entry.status]||'Not scheduled')}
     ${visit&&visit.date>=fleet.today?badge('booked','Booked'):''}
     ${key==='cleaning'&&row.needsCleanup?badge('soon','Needs cleanup'):''}
     ${manageOnly(manage,`<div class="bci-manager-actions">${action('schedule','Schedule',row.id,key)}${action('book',visit?'Change booking':'Book',row.id,key)}${action('complete','Record done',row.id,key)}</div>`)}
     ${!manage&&key==='cleaning'&&row.mayClean?action('assigned-cleanup','Mark cleanup done',row.id):''}</div>`;
  }).join('');
  const entries=(row.serviceHistory||[]).map(item=>`<li><b>${esc(kinds[item.type]||(item.type==='tires'?'Tire set change':'Service'))} · ${dateText(item.date)}</b>
   ${item.mileage==null?'':` · ${miles(item.mileage)}`}${item.notes?`<p>${esc(item.notes)}</p>`:''}</li>`).join('');
  const sets=(row.tireSets||[]).map(x=>`<li><b>${esc(x.name)}</b> · ${esc([x.type,x.size].filter(Boolean).join(' · ')||'No type/size')} · ${miles(x.mileage)} on set · ${x.mountedAt==null?'Stored':`Mounted at ${miles(x.mountedAt)}`}</li>`).join('');
  const docs=(row.documents||[]).map(x=>`<li><a href="${esc(x.url)}">${esc(x.name)}</a> · ${esc(types.find(([k])=>k===x.type)?.[1]||'Document')}${x.date?' · '+dateText(x.date):''} ${manageOnly(manage,action('remove-doc','Remove',row.id,x.id))}</li>`).join('');
  return `<div class="fleet-profile-shell">
   ${action('back','‹ Back to Fleet')}
   <article class="fleet-profile" style="${esc(fleetStyleVars(row.style,row.color))}">
   <div class="fleet-hero">${photo(row,true)}<div class="fleet-hero-copy">
    <h1 id="fleetProfileHeading" tabindex="-1">${esc(row.name)}</h1>
    ${profile?`<p class="fleet-model">${esc(profile)}</p>`:''}
    ${badge(next.kind,next.text+(next.extra?' +'+next.extra+' more':''))}
    ${manageOnly(manage,`<div class="bci-manager-actions">${action('edit','Edit vehicle',row.id)}${action('odometer','Update odometer',row.id)}${action('style','Customize profile',row.id)}</div>`)}
   </div></div>
   <div class="fleet-profile-body">
   <section class="fleet-section bci-manager-card" aria-label="Vehicle information"><dl>${line('VIN',esc(row.vin||'Not set'))}${line('Plate',esc(row.plate||'Not set'))}${line('Driver',person(row.assignedEmail))}
    ${line('Odometer',miles(row.odometer)+(row.odometerDate?' · '+dateText(row.odometerDate):''))}
    ${line('Health notes',esc(row.health||'Not recorded'))}</dl>
   ${row.odometerStale&&row.odometer!=null?'<p class="fleet-model">Odometer is undated or more than 30 days old.</p>':''}
   ${row.about?`<p class="bci-manager-notes">${esc(row.about)}</p>`:''}</section>
   <details class="fleet-section" data-fleet-section="maintenance"${sectionOpen(row,'maintenance',['overdue','due','soon'].includes(next.kind))}><summary>Maintenance &amp; Cleaning</summary>
   ${manageOnly(manage,action('cleanup',row.needsCleanup?'Clear cleanup flag':'Flag for cleanup',row.id))}
   <div class="bci-vehicle-maintenance">${layout}</div></details>
   <details class="fleet-section" data-fleet-section="tires"${sectionOpen(row,'tires')}><summary>Tires (${row.tireSets?.length||0})</summary>${sets?`<ul>${sets}</ul>`:'<p>No tire sets recorded.</p>'}
   ${manageOnly(manage,`<div class="bci-manager-actions">${action('add-set','Add tire set',row.id)}${row.tireSets?.length?action('swap','Mount / swap / remove',row.id):''}</div>`)}</details>
   <details class="fleet-section" data-fleet-section="documents"${sectionOpen(row,'documents')}><summary>Documents (${row.documents?.length||0})</summary>${docs?`<ul>${docs}</ul>`:'<p>No documents visible to you.</p>'}
   ${manageOnly(manage,action('upload','Add document',row.id))}</details>
   <details class="fleet-section" data-fleet-section="history"${sectionOpen(row,'history')}><summary>Service History (${row.serviceHistory?.length||0})</summary>${entries?`<ul>${entries}</ul>`:'<p>No completed work recorded.</p>'}</details>
   </div></article></div>`;
 };
 if(active)return renderVehicle(active);
 const filtered=records.filter(row=>matchesFilter(row,fleetFilter));
 return `<div class="pagehead"><div><h1>Vehicles</h1><p>Choose a vehicle to see its profile.</p></div>${manageOnly(manage,action('edit','+ Add vehicle'))}</div>
  <div class="fleet-filters" aria-label="Filter vehicles">${[['all','All vehicles'],['overdue','Overdue'],['soon','Due now / soon']].map(([key,label])=>
   `<button type="button" class="secondary" data-fleet-action="filter" data-fleet-type="${key}" aria-pressed="${key===fleetFilter}">${label} <b>${key==='all'?records.length:count(key)}</b></button>`).join('')}</div>
  ${filtered.length?`<div class="fleet-card-grid">${filtered.map(row=>miniCard(row,fleet.today)).join('')}</div>`:
   `<p class="muted">${records.length?'No vehicles match this filter.':'No vehicles yet.'}</p>`}`;
}
function matchesFilter(row,key){
 if(key==='all')return true;
 const schedules=Object.values(row.schedules||{});
 return key==='overdue'?schedules.some(e=>e.status==='overdue'):
  Boolean(row.needsCleanup||schedules.some(e=>e.status==='due'||e.status==='soon'));
}

function documentContent(file){
 if(!file?.size||file.size>350000||!['application/pdf','image/jpeg','image/png'].includes(file.type))throw Error('Choose a PDF, JPEG or PNG up to 350 KB.');
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read document.'));
  reader.readAsDataURL(file);
 });
}
document.addEventListener('toggle',event=>{
 const el=event.target, key=el.dataset?.fleetSection;
 if(!key||!selectedVehicle||!el.isConnected)return;
 sections.set(selectedVehicle,{...sections.get(selectedVehicle),[key]:el.open});
},true);
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-fleet-action]'), board=data?.vehicles;
 if(!button||!board||!can('vehicles.view'))return;
 const {fleetAction:key,fleetId:id,fleetType:type}=button.dataset;
 const row=(board.records||[]).find(item=>item.id===id);
 if(id&&!row)return;
 if(key==='open'&&row){
  vehiclePlayer.play(row.clickSound);
  fleetScroll=typeof window==='undefined'?0:window.scrollY;
  selectedVehicle=id;showFleetLocation('#fleetProfileHeading',0);return;
 }
 if(key==='back'){
  vehiclePlayer.stop();
  const returnId=selectedVehicle;
  selectedVehicle='';showFleetLocation('[data-fleet-action="filter"][aria-pressed="true"]',fleetScroll,returnId);return;
 }
 if(key==='filter'&&['all','overdue','soon'].includes(type)){
  fleetFilter=type;showFleetLocation('[data-fleet-action="filter"][aria-pressed="true"]',typeof window==='undefined'?0:window.scrollY);return;
 }
 if(key==='assigned-cleanup'){
  if(row?.mayClean)modal('Mark cab cleanup done',f('notes','Cleanup notes (optional)',{textarea:true}),
   values=>send('vehicles.cleanup',{id,...values}));
  return;
 }
 if(!can('vehicles.manage'))return;
 const submit=(operation,values={})=>send('vehicles.manage',{operation,...(id?{id}:{}),...values});
 const now=board.today||today();
 if(key==='edit'){
  const item=row||{};
  modal(row?'Edit vehicle':'Add vehicle',
   f('name','Vehicle name',{required:true,value:item.name})+numberField('year','Model year',item.year,1886)+f('make','Make',{value:item.make})+f('model','Model',{value:item.model})+
   f('vin','VIN',{value:item.vin})+f('plate','License plate',{value:item.plate})+staffOptions(board,item)+
   (!row?numberField('odometer','Current odometer (optional)',''):'')+
   f('color','Profile color',{select:colors,value:colorNames.has(item.color)?item.color:'slate'})+
   f('about','About the vehicle',{textarea:true,value:item.about})+f('health','Vehicle health notes',{value:item.health})+
   '<div class="field"><label for="vehicle-photo">Profile photo (JPEG or PNG)</label><input id="vehicle-photo" name="vehiclePhoto" type="file" accept="image/jpeg,image/png"></div>'+
   (item.photoUrl?'<label><input type="checkbox" name="removePhoto" value="yes"> Remove current photo</label>':''),
   async ({vehiclePhoto,removePhoto,...values})=>{
    if(vehiclePhoto?.size&&removePhoto)throw Error('Choose a new photo or remove the current one, not both.');
    if(vehiclePhoto?.size){const payload=await receiptPayload(vehiclePhoto,crypto.randomUUID());values.photoDataUrl='data:image/jpeg;base64,'+payload.content;}
    else if(removePhoto)values.photoDataUrl='';
    return submit('saveVehicle',values);
   });return;
 }
 if(!row)return;
 if(key==='style'){
  const fields=Object.keys(fleetStyleFields),chosen=fleetStyle(row.style,row.color);
  const prefix='fleetStyle_';
  const draft=values=>Object.fromEntries(fields.map(field=>[field,values[prefix+field]]));
  modal('Customize vehicle profile',`<div class="fleet-style-fields">${fields.map(field=>f(prefix+field,fleetStyleFields[field],{
   select:profileStyleOptions[field].map(option=>[option.id,option.label]),value:chosen[field]
  })).join('')}</div><div class="actions">${f('clickSound','Vehicle click sound',{select:fleetSoundOptions,value:fleetSound(row.clickSound)})}<button type="button" class="secondary small" data-fleet-sound-preview>Preview sound</button></div><p class="muted">Fleet card preview</p><div data-fleet-preview>${miniCard(row,now,true)}</div>
   <button type="button" class="secondary small" data-fleet-reset>Reset appearance</button>`,
   values=>submit('saveStyle',{style:draft(values),clickSound:fleetSound(values.clickSound,true)}),
   '<p>The selected sound plays when someone opens this vehicle’s card. Menu Sounds → Off mutes automatic playback on this device.</p>');
  const form=document.querySelector('#actionForm');
  const redraw=()=>{const preview=form?.querySelector('[data-fleet-preview]');if(preview)preview.innerHTML=miniCard({...row,style:draft(Object.fromEntries(new FormData(form)))},now,true);};
  form?.addEventListener('change',redraw);
  form?.querySelector('[data-fleet-sound-preview]')?.addEventListener('click',()=>{
   vehiclePlayer.play(form.elements.namedItem('clickSound').value,{preview:true});
  });
  form?.querySelector('[data-fleet-reset]')?.addEventListener('click',()=>{
   const defaults=fleetStyle(null,row.color);
   for(const field of fields)form.elements.namedItem(prefix+field).value=defaults[field];
   redraw();
  });
  return;
 }
 const entry=row.schedules?.[type]||{};
 const repeat=['oil','rotation','cleaning','service'].includes(type), mileage=repeat&&type!=='cleaning';
 if(key==='schedule'&&Object.hasOwn(kinds,type)){
  const month=type==='inspection'&&entry.dueDate?.length===7;
  modal('Schedule '+kinds[type].toLowerCase(),dateField('dueDate','Due date',month?'':entry.dueDate)+
   (type==='inspection'?f('dueMonth','Or inspection month from certificate (YYYY-MM)',{value:month?entry.dueDate:''}):'')+
   (repeat?numberField('intervalDays','Repeat every N days',entry.intervalDays,1):'')+
   (mileage?numberField('dueMileage','Due at odometer',entry.dueMileage)+numberField('intervalMiles','Repeat every N miles',entry.intervalMiles,1):'')+staffOptions(board,entry),
   values=>submit('saveSchedule',{...values,type}),
   '<p>Due dates are independent of appointments. Enter the first due date or odometer to start a recurring reminder.</p>');return;
 }
 if(key==='book'&&Object.hasOwn(kinds,type)){
  modal('Book '+kinds[type].toLowerCase(),dateField('appointmentDate','Appointment date (blank to clear)',entry.appointment?.date)+
   f('appointmentTime','Start time',{type:'time',value:entry.appointment?.time})+f('appointmentEndTime','Finish time (optional)',{type:'time',value:entry.appointment?.endTime})+f('location','Location',{value:entry.appointment?.location}),
   values=>submit('bookService',{...values,type}),'<p>Updates Vehicles only. No calendar invite is sent.</p>');return;
 }
 if(key==='complete'&&Object.hasOwn(kinds,type)){
  modal('Record '+kinds[type].toLowerCase(),dateField('date','Completed on',now,true)+numberField('mileage','Odometer at service'+(entry.intervalMiles?' (required for mileage schedule)':''),'')+
   dateField('nextDueDate','Next due date (optional override)','')+
   (type==='inspection'?f('nextDueMonth','Or next inspection month from certificate (YYYY-MM)'):'')+
   (mileage?numberField('nextDueMileage','Next due odometer (optional override)',''):'')+f('notes','Service notes',{textarea:true}),
   values=>submit('recordService',{...values,type}),
   '<p>For registration and inspection, enter a new deadline only when supported by the updated document. Recurring maintenance derives its next deadline from completion.</p>');return;
 }
 if(key==='cleanup'){
  modal(row.needsCleanup?'Clear cleanup flag':'Flag for cleanup','',()=>submit('saveVehicle',{needsCleanup:!row.needsCleanup}),
   '<p>This changes the immediate flag without changing the recurring cleaning schedule.</p>');return;
 }
 if(key==='odometer'){
  modal('Update odometer',dateField('odometerDate','Reading date',now,true)+numberField('odometer','Odometer (miles)',row.odometer),
   values=>{if(values.odometer==='')throw Error('Enter an odometer reading');return submit('saveVehicle',values);});return;
 }
 if(key==='add-set'){
  modal('Add tire set',f('name','Label (e.g. winter set)',{required:true})+f('type','Tire type')+f('size','Tire size')+
   numberField('priorMiles','Miles already on this set',''),values=>submit('saveTireSet',values));return;
 }
 if(key==='swap'){
  modal('Mount, swap or remove tires',f('tireSetId','Set to mount',{select:[['','Remove current set only'],...(row.tireSets||[]).filter(x=>x.mountedAt==null).map(x=>[x.id,x.name])],value:''})+
   dateField('date','Date',now,true)+numberField('mileage','Odometer at swap',row.odometer),values=>submit('tireSwap',values));return;
 }
 if(key==='upload'){
  modal('Add vehicle document',f('name','Document label',{required:true})+f('type','Document type',{select:types,value:'insurance'})+
   dateField('date','Document date (optional)','')+
   '<div class="field"><label for="fleet-document">PDF, JPEG or PNG (up to 350 KB)</label><input id="fleet-document" name="file" type="file" accept="application/pdf,image/jpeg,image/png" required></div>',
   async ({file,...values})=>submit('saveDocument',{...values,content:await documentContent(file)}),
   '<p>Authorized fleet managers may read all vehicle documents. Assigned drivers with Vehicles access can read insurance, registration and inspection documents only. Keep verification letters under DMV / restricted.</p>');return;
 }
 if(key==='remove-doc'){
  modal('Remove vehicle document','',()=>submit('removeDocument',{documentId:type}),'<p>Only remove this document if it is obsolete or was attached in error.</p>');
 }
});
