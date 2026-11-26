import {materialGridPage,validMaterialSelection} from './modules/material-grid.js';
import {servicesPage} from './modules/services.js';
import {changelogPage,wireChangelog} from './modules/changelog.js';
import {assignmentLink} from './modules/record-assignments.js';
import {canEditJournalNote,receiptPicker,receiptPayload} from './modules/work-entry.js';
import {clientPortal,readyForProgress} from './modules/project-billing.js';
import {wireProfileWeather} from './modules/profile-weather.js';
import {staffPage} from './modules/staff.js';
import {fleetPage} from './modules/fleet.js';
import {workOrderDocument} from './modules/work-order-document.js';
import {invoicesPage} from './modules/invoices.js';
import {estimatesPage} from './modules/estimates.js';
import {trainingPage, renderTrainingGuide} from './modules/training.js';
import {notificationsPage} from './modules/notifications.js';
import { ticketsPage, selectTicketLink } from './modules/tickets.js';
import { recordTools, recordManager, managingRecords, wireRecords, trashPage, wireTrash } from './modules/records.js';
import { dashboard } from './modules/overview.js';
import { customers } from './modules/customers.js';
import { projectsHub } from './modules/projects.js';
import { workorders } from './modules/work-orders.js';
import { warehouse, warehouseName } from './modules/warehouse.js';
import {partCategory,partColor,partMeta,partSearch,photoThumbnail} from './modules/catalog-photos.js';
import {materialBrand,materialFacets,materialHasIdentity,materialShortcuts,materialSignals,materialUnitLabel,rankMaterials} from './modules/material-picker.js';
import { moneyPage } from './modules/money.js';
import { reports } from './modules/reports.js';
import { payrollPage } from './modules/payroll.js';
import { catalogPage, wirePricingPage } from './modules/pricing.js';
import { teamPage } from './modules/team.js';
import { accessDescriptors, effectiveModuleAccess, profileEditorValues, modeLabels, scopeLabels, scopedAreas, areaLabel } from './modules/access-matrix.js';
import { testingPage } from './modules/database-testing.js';
import { detail } from './modules/work-order-detail.js';
import { projectDetail } from './modules/project-detail.js';
import { invoiceDocument } from './modules/invoice-document.js';

const $=s=>document.querySelector(s);
const themeToggle=$('#themeToggle');
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
let themeChoice;
try{themeChoice=localStorage.getItem('bci-theme');}catch{}
const themeOptions=['device','light','field','dark'];
function applyTheme(){
 const choice=themeOptions.includes(themeChoice)?themeChoice:'device';
 const dark=choice==='dark'||choice==='device'&&systemTheme.matches;
 document.documentElement.dataset.theme=dark?'dark':'light';
 document.documentElement.dataset.field=String(choice==='field');
 themeToggle.textContent='Theme · '+({device:'Follow device',light:'BCI Classic',field:'Field',dark:'Dark'}[choice]);
 themeToggle.setAttribute('aria-label','Change theme. Current: '+themeToggle.textContent);
}
themeToggle.addEventListener('click',()=>{
 themeChoice=themeOptions[(themeOptions.indexOf(themeChoice||'device')+1)%themeOptions.length];
 try{localStorage.setItem('bci-theme',themeChoice);}catch{}
 applyTheme();
});
systemTheme.addEventListener?.('change',applyTheme);
applyTheme();
const fmt=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{
 const now=new Date(), pad=n=>String(n).padStart(2,'0');
 return [now.getFullYear(),pad(now.getMonth()+1),pad(now.getDate())].join('-');
};
const roundMoney=value=>Math.round((value+Number.EPSILON)*100)/100;
const navItems=[['dashboard','◫','Dashboard'],['training','▷','Training'],['customers','♙','Customers'],['projects','▦','Projects'],['estimates','≡','Estimates'],['invoices','▤','Invoices'],['workorders','▤','Work Orders'],['tickets','◇','Tickets'],['notifications','◉','Notifications'],['inventory','▣','Warehouse'],['money','◈','Money'],['reports','▥','Reports'],['payroll','▤','Payroll'],['staff','◷','My Time & Profile'],['services','≡','Services'],['catalog','▦','Pricing'],['team','♧','Team'],['fleet','▰','Vehicles'],['testing','▦','Database Testing'],['changelog','▤','Changelog'],['trash','▤','Trash']];
let data=null,me=null,view='dashboard',selectedWO=null,reportType='purchases',reportStart='',reportEnd='',moneyCustomer='all',moneyStatus='all';
const customer=id=>data.customers.find(c=>c.id===id),project=id=>data.projects.find(p=>p.id===id),catalog=id=>data.catalog.find(c=>c.id===id),wo=id=>data.workorders.find(w=>w.id===id);
let selectedClientPortal=null;
let selectedProject=null, projectFilter='', projectClient='';
const projectLabel=p=>p?[p.number,p.name].filter(Boolean).join(' · '):'Unknown';
const labelFor=w=>{const p=project(w.projectId);return `${billingName(customer(p?.customerId))} • ${projectLabel(p)}`};
const status=s=>`<span class="status ${esc(s)}">${esc((s||'').replaceAll('-',' '))}</span>`;
const empty=(s)=>`<div class="empty">${esc(s)}</div>`;
function bill(w){const buckets={labor:0,material:0,travel:0,cost:0};for(const e of w.entries){buckets[e.type]+=roundMoney(e.rate*e.quantity);buckets.cost+=roundMoney((e.cost||0)*e.quantity);}buckets.total=w.internalTask&&!w.invoice?0:roundMoney(buckets.labor+buckets.material+buckets.travel-(w.invoice?.depositCredit||0));buckets.profit=roundMoney(buckets.total-buckets.cost);return buckets;}
const can=key=>me?.permissions?.includes(key);
const viewPermissions={fleet:'vehicles.view',staff:'staff.view',estimates:'estimates.view',training:'training.view',notifications:'notification.view',tickets:'tickets.view',dashboard:'dashboard.view',customers:'customers.view',projects:'projects.view',workorders:'workorders.view',inventory:'inventory.view',money:'money.view',reports:'reports.view',payroll:'payroll.view',services:'pricing.view',catalog:'pricing.view',team:'team.view',testing:'database.view'};
const visibleView=id=>id==='invoices'?!practiceMode&&can('invoices.view')&&can('finance.view')&&can('workorders.view'):practiceMode&&!['training','customers','projects','workorders'].includes(id)?false:id==='trash'?me?.role==='admin':['team','changelog'].includes(id)?me?.role==='admin':can(viewPermissions[id]);

const formPermissions={customer:'customer.create',contact:'contact.create',project:'project.create','new-project':'project.create','project-contact':'project.contact','clock-setup':'clock.in',
 workorder:'workorder.create',approve:'workorder.approve',change:'change.create','log-time':'entry.add','log-materials':'entry.add','client-markup':'pricing.client','project-rate':'pricing.project','other-time':'payroll.other','project-invoice':'invoice.group',
 'entry-note':'entry.update','workorder-print':'workorders.view','project-invoice-print':'invoices.view','legacy-print':'invoices.view',
 close:'workorder.close',review:'workorder.review','warehouse-receive':'inventory.receive',
 'warehouse-item':'catalog.create',service:'catalog.create',invoice:'invoice.record',payment:'invoice.pay',catalog:'catalog.create',reserve:'settings.reserve'};
function nav(){
 const groups=[['Field work',['dashboard','workorders',...(!can('dashboard.view')?['tickets']:[]),'projects','customers','inventory','notifications','staff']],
  ['Office',['estimates','invoices','services','catalog','money','reports','payroll']],['Admin',['training','team','fleet','testing','changelog','trash']]];
 const rail=$('#nav'), priorScroll=rail.scrollLeft;
 rail.setAttribute('aria-label','Workspace navigation');
 rail.innerHTML=groups.map(([label,ids])=>{
  const buttons=ids.filter(visibleView).map(id=>{
   const [,icon,name]=navItems.find(item=>item[0]===id);
   return `<button class="nav-item ${view===id?'active':''}" data-nav="${id}"${view===id?' aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon}</span>${name}</button>`;
  }).join('');
  return buttons?`<div class="nav-group"><div class="nav-group-label">${label}</div>${buttons}</div>`:'';
 }).join('');
 if(priorScroll)rail.scrollLeft=priorScroll;
 const active=rail.querySelector?.('[aria-current="page"]');
 if(active&&rail.scrollWidth>rail.clientWidth){
  const start=active.offsetLeft-rail.offsetLeft,end=start+active.offsetWidth;
  if(start<rail.scrollLeft)rail.scrollLeft=start;
  else if(end>rail.scrollLeft+rail.clientWidth)rail.scrollLeft=end-rail.clientWidth;
 }
}

function head(title,kicker,sub,button=''){return `<div class="pagehead"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><div class="muted">${esc(sub)}</div></div>${button}</div>`;}
function card(name,val,sub='',color=''){return `<div class="card"><div class="kicker">${esc(name)}</div><div class="value ${color}">${val}</div><div class="sub">${esc(sub)}</div></div>`;}
function table(headers,rows){return `<div class="tablewrap"><table><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}">No records found</td></tr>`}</tbody></table></div>`;}
const billingName=c=>c?.business||c?.name||'Unknown';
const jobContact=p=>customer(p?.customerId)?.contacts?.find(c=>c.id===p.contactId);
const contactLine=c=>[c?.name,c?.phone,c?.email].filter(Boolean).map(esc).join(' · ');
let guidedClient='', guidedContact='', contactQuery='';
function creationGuide(){
 const payer=customer(guidedClient);
 const contacts=(payer?.contacts||[]).filter(c=>[c.name,c.phone,c.email].some(value=>String(value||'').toLowerCase().includes(contactQuery.toLowerCase())));
 const options=[['','Select a billing client'],...data.customers.map(c=>[c.id,billingName(c)])];
 const picker=`<label for="guidedClient">Type 1 · Billing client</label><select id="guidedClient">${options.map(([id,name])=>`<option value="${esc(id)}" ${id===guidedClient?'selected':''}>${esc(name)}</option>`).join('')}</select>`;
 return `<section class="panel"><h2>Guided creation</h2><div class="field">${picker}</div>${payer?`
  <label for="guidedContactSearch">Type 2 · Find a job contact (optional)</label>
  <input id="guidedContactSearch" type="search" value="${esc(contactQuery)}" placeholder="Type a name or phone">
  <div id="guidedMatches" class="guided-matches">${contactOptions(contacts)}</div>
  <p id="guidedSelection">Job contact · ${esc(payer.contacts?.find(c=>c.id===guidedContact)?.name||'Billing client leads / choose later')}</p>
  <div class="actions"><button class="secondary" data-open="contact">+ Job Contact</button><button class="primary" data-open="project">+ Project</button></div>`:'<p class="muted">Select or add a billing client to continue.</p>'}</section>`;
}
function contactOptions(contacts){
 return `<button type="button" class="secondary small" data-guided-contact="">Use billing client only</button>`+
 contacts.map(c=>`<button type="button" class="secondary small" data-guided-contact="${esc(c.id)}">${contactLine(c)}</button>`).join('');
}
function contactFields(){
 return f('contactId','Primary contact (optional)',{select:[['','Billing client leads / choose later']]})+
  (can('contact.create')?`<div id="newProjectContact" hidden>${f('contactName','Contact name')}${f('contactPhone','Contact phone',{type:'tel'})}${f('contactEmail','Contact email (optional)',{type:'email'})}</div>`:'')+
  '<label class="signature-terms"><input type="checkbox" name="makeDefault"> Prefill this contact for future projects under this billing client</label>';
}
function wireContactFields(form, getPayer, initial){
 const picker=form.elements.contactId;
 function refresh(){
  const payer=getPayer();
  picker.replaceChildren(new Option('Billing client leads / choose later',''),...(payer?.contacts||[]).map(c=>new Option(c.name+(c.phone?' · '+c.phone:''),c.id)));
  if(payer&&can('contact.create'))picker.add(new Option('+ Add new contact','__new'));
  picker.value=initial??payer?.defaultContactId??'';
  if(picker.selectedIndex<0)picker.value='';
  form.elements.makeDefault.checked=false;
  showNew();
 }
 function showNew(){
  const fields=form.querySelector('#newProjectContact');
  if(!fields)return;
  const adding=picker.value==='__new';
  fields.hidden=!adding;
  for(const input of fields.querySelectorAll('input')){
   input.disabled=!adding;input.required=adding&&input.name!=='contactEmail';
  }
 }
 picker.addEventListener('change',showNew);
 form.elements.customerId?.addEventListener('change',()=>{initial=undefined;refresh();});
 refresh();
}
function contactPayload(values){
 const {contactId,makeDefault,contactName,contactPhone,contactEmail,...fields}=values;
 return {...fields,contactId:contactId==='__new'?'':contactId,makeDefault:makeDefault==='on',
  ...(contactId==='__new'?{newContact:{name:contactName,phone:contactPhone,email:contactEmail}}:{})};
}
function createProjectFromHub(payer,contact){
 if(!data.customers.length){show('Create a billing client in Customers first',true);return;}
 modal('New project',(payer?`<p>Billing client · ${esc(billingName(payer))}</p>`:
  f('customerId','Type 1 billing client',{select:clientOptions(),required:true,value:projectClient}))+contactFields()+
  f('name','Project name',{required:true})+f('site','Jobsite / site name')+f('po','Client PO number (optional)')+
  (can('pricing.project')?serviceCategoryField():''),async values=>{
   const saved=await send('project.create',{...contactPayload(values),customerId:payer?.id||values.customerId});
   selectedProject=saved.id;selectedWO=null;view='projects';render();
  },'<p>Choose a saved contact under the billing client, add one, or leave it blank.</p>');
 const form=$('#actionForm');
 wireContactFields(form,()=>payer||customer(form.elements.customerId.value),contact?.id);
}
function assignProjectContact(p){
 const payer=customer(p?.customerId);
 if(!payer)return;
 modal('Assign primary contact',`<p>Billing client · ${esc(billingName(payer))}</p>`+contactFields(),
  values=>send('project.contact',{...contactPayload(values),projectId:p.id}));
 wireContactFields($('#actionForm'),()=>payer,p.contactId||'');
}
function clockPanel(w){
 const clock=me?.clock;
 if(clock?.workorderId===w.id)return `<section class="panel"><h2>Work-order clock</h2><p>${esc(clock.tech)} · Clocked in at ${esc(new Date(clock.startedAt).toLocaleString())}</p>
  <button class="primary" data-clock="out">Clock out</button> <button class="secondary" data-clock="cancel">Cancel timer</button></section>`;
 if(!can('clock.in')||!w.approvedAt||w.closeout||w.invoice)return '';
 return `<section class="panel"><h2>Work-order clock</h2>${clock?
  `<p>Clock running on <button class="rowlink" data-wo="${esc(clock.workorderId)}">${esc(wo(clock.workorderId)?.title||'another work order')}</button>.</p>`:
  `<div class="actions"><button class="primary" data-clock="in">Clock in</button>${me?.clockDefault?'<button class="secondary" data-open="clock-setup">Change clock settings</button>':''}</div>
  ${me?.clockDefault?`<p class="muted">${esc(me.clockDefault.tech)} · ${esc(catalog(me.clockDefault.catalogId)?.name||'Labor')}</p>`:''}`}</section>`;
}
function setupClock(w){
 const defaults=me?.clockDefault;
 return modal('Clock in',f('catalogId','Labor type',{required:true,value:defaults?.catalogId,select:[['','Choose labor'],...choose(data.catalog.filter(item=>item.type==='labor'))]}),
  values=>send('clock.in',{...values,workorderId:w.id}),'<p>Time is recorded under your signed-in profile.</p>');
}
function customerLaborSummary(w){const by=new Map();for(const e of w.entries.filter(e=>e.type==='labor')){const key=e.catalogId;let g=by.get(key);if(!g){g={name:e.name,qty:0,amount:0,start:e.date,end:e.date};by.set(key,g);}g.qty+=Number(e.quantity);g.amount+=Number(e.quantity)*Number(e.rate);if(e.date<g.start)g.start=e.date;if(e.date>g.end)g.end=e.date;}return [...by.values()].map(g=>`<div class="list-item"><span>${esc(g.name)} · ${g.qty.toFixed(2)} labor hours<div class="tiny muted">${esc(g.start)} to ${esc(g.end)}</div></span><b>${fmt(g.amount)}</b></div>`).join('')||'<div class="muted tiny">No labor entries yet</div>';}
function openCatalogImport(){
 if(practiceMode){show('Catalog imports are not available in Practice Mode',true);return;}
 const node=$('#modal');
 node.querySelector('.modal-box')?.classList.remove('estimate-editor');
 $('#modalContent').innerHTML=`<h2 id="dialogTitle">Import parts catalog</h2>
 <p>Choose <strong>BCI Catalog Import.json</strong> from the release and review the preview. This does not receive stock or set prices.</p>
 <form id="catalogImport"><label for="catalogImportFile">Catalog JSON file</label>
 <input id="catalogImportFile" type="file" accept=".json,application/json" required>
 <button class="primary" type="submit">Preview import</button></form>
 <div id="catalogImportResult" aria-live="polite"></div>`;
 node.hidden=false;
 const form=$('#catalogImport'),input=$('#catalogImportFile'),result=$('#catalogImportResult');
 const preview=form.querySelector('button');
 const isOpen=()=>form.isConnected&&!node.hidden;
 async function request(endpoint,action,data){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,data})});
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body?.ok){
   if(response.status===401||response.status===403)await refreshAccess();
   throw Error(body?.error||'The catalog request failed. Check the file and preview again.');
  }
  return body.result;
 }
 input.addEventListener('change',()=>result.replaceChildren());
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(preview.disabled)return;
  preview.disabled=input.disabled=true;
  result.textContent='Reading catalog…';
  try{
   const file=input.files[0];
   if(!file||file.size>7_500_000)throw Error('Choose a catalog JSON file under 7.5 MB');
   const payload=JSON.parse(await file.text());
   const pack=payload?.format==='bci-catalog-pack-v1';
   if(!pack&&file.size>490000)throw Error('Choose BCI Catalog Import.json or a legacy catalog file under 490 KB');
   const endpoint=pack?'/api/catalog-pack':'/api/action';
   const r=await request(endpoint,pack?'catalog.packPreview':'catalog.importPreview',pack?{pack:payload}:payload);
   if(!isOpen())return;
   const conflicts=pack?r.conflicts:[];
   result.innerHTML=pack?`
    <p><b>${r.total.toLocaleString()} parts</b> · ${r.new.toLocaleString()} new · ${r.updated.toLocaleString()} existing parts to add details to · ${r.unchanged.toLocaleString()} unchanged</p>
    <p>${r.photoCount.toLocaleString()} parts have photos in this file · ${r.fitReferenceCount.toLocaleString()} documented fit references</p>
    <p>Stock counts, existing prices, and work-order history stay unchanged. New items need pricing review before billing.</p>
    ${conflicts.length?`<details class="panel"><summary>${conflicts.length} conflicts (not imported)</summary><ul>
       ${conflicts.map(c=>`<li><b>${esc(c.brand)} ${esc(c.mpn)}</b>: ${esc(c.reason)}</li>`).join('')}</ul></details>`:''}
    ${r.new||r.updated?`<button class="primary" type="button" id="catalogApply">${conflicts.length?'Skip conflicts and import the rest':'Apply catalog import'}</button>`:'<p>No catalog changes to apply.</p>'}`:`
    <p>${r.added} to add · ${r.skipped} existing or duplicate · ${r.ignored} reference rows skipped · ${r.needsPricing} need pricing review</p>
    <ul>${r.examples.map(name=>`<li>${esc(name)}</li>`).join('')}</ul>
    ${r.added?'<button class="primary" id="catalogApply" type="button">Import materials</button>':''}`;
   const apply=result.querySelector('#catalogApply');
   if(apply)apply.addEventListener('click',async()=>{
    if(apply.disabled)return;
    apply.disabled=preview.disabled=input.disabled=true;
    form.dataset.saving='1';
    result.textContent='Importing catalog…';
    try{
     const saved=await request(endpoint,pack?'catalog.packImport':'catalog.import',pack?{pack:payload,fingerprint:r.fingerprint,skipConflicts:conflicts.length>0}:payload);
     if(isOpen())result.textContent=pack?`Added ${saved.new} parts and updated details on ${saved.updated}. ${saved.skipped||0} conflicts skipped. Stock and prices unchanged.`:`Added ${saved.added} materials. Skipped ${saved.skipped} existing or duplicate entries.`;
     try{await reload();}catch{show('Import saved. Refresh the page to see the new catalog.',true);}
    }catch(error){if(isOpen())result.textContent=error.message;}
    finally{delete form.dataset.saving;preview.disabled=input.disabled=false;}
   });
  }catch(error){if(isOpen())result.textContent=error instanceof SyntaxError?'That file is not valid catalog JSON. Select the .json file, not the ZIP.':error.message;}
  finally{preview.disabled=input.disabled=false;}
 });
}

function openCustomerImport(){
 const node=$('#modal');
 node.querySelector('.modal-box')?.classList.remove('estimate-editor');
 $('#modalContent').innerHTML=`<h2>Import clients &amp; projects</h2><form id="customerImport">
  <label for="importFile">QuickBooks Customer Contact List CSV or BCI Operations JSON</label><input id="importFile" type="file" accept=".csv,text/csv,.json,application/json" required>
  <button class="primary" type="submit">Preview import</button>
 </form><div id="importResult" aria-live="polite"></div>`;
 node.hidden=false;
 const form=$('#customerImport'), result=$('#importResult'), fileInput=$('#importFile');
 fileInput.addEventListener('change',()=>{result.replaceChildren();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=event.submitter;
  button.disabled=true;fileInput.disabled=true;result.textContent='Checking records…';
  try{
   const file=fileInput.files[0];
   if(file.size>450000)throw Error('Import file exceeds 450 KB');
   const content=await file.text();
   const payload=/\.csv$/i.test(file.name)?{csv:content}:JSON.parse(content);
   const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'customers.importPreview',data:payload})});
   const json=await response.json();
   if(!response.ok||!json.ok)throw Error(json.error||'Preview failed');
   const r=json.result;
   const list=(label,items)=>items.length?`<details><summary>${label} (${items.length})</summary><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:'';
   result.innerHTML=`<p><b>${r.clientsAdded}</b> clients and <b>${r.projectsAdded}</b> projects to add.
    ${r.clientsMatched} clients and ${r.projectsMatched} projects matched. ${r.referencesAdded} legacy references to attach.</p>
    ${list('New clients',r.newClients)}${list('New projects',r.newProjects)}
    ${list('Clients missing billing details',r.incompleteClients)}${list('Held projects skipped',r.held)}
    ${list('Conflicts blocking import',r.conflicts)}
    ${r.conflicts.length?'':'<button class="primary" id="applyCustomerImport" type="button">Apply import</button>'}`;
   result.querySelector('#applyCustomerImport')?.addEventListener('click',async event=>{
    const apply=event.currentTarget;apply.disabled=true;fileInput.disabled=true;button.disabled=true;
    try{
     const saved=await send('customers.import',payload);
     result.textContent=`Saved ${saved.clientsAdded} clients and ${saved.projectsAdded} projects. ${saved.held.length} projects held.`;
    }catch(error){show(error.message,true);apply.disabled=false;}
    finally{fileInput.disabled=false;button.disabled=false;}
   });
  }catch(error){result.textContent=error.message;}
  finally{button.disabled=false;fileInput.disabled=false;}
 });
}
function profileForm(profile){
 const selected=new Set(profile?.permissions||[]);
 const descriptors=accessDescriptors(data.permissionMatrix,data.modulePermissions);
 const catalog=Object.assign({},...Object.values(data.permissionGroups||{}));
 const covered=new Set(descriptors.flatMap(d=>[d.view,...d.write,...d.delete,...d.actions,...d.read]));
 const rows=descriptors.map(d=>{
  const {mode,scope}=effectiveModuleAccess(d,profile);
  const name=areaLabel(d.area);
  if(d.adminOnly)return '<tr><th>'+esc(name)+'</th><td colspan="3">Administrator accounts only</td></tr>';
  const deleteKeys=d.delete.filter(key=>key!=='workorder.delete');
  return '<tr data-permission-area="'+esc(d.area)+'"><th scope="row">'+esc(name)+'</th><td><label class="sr-only" for="permission-mode-'+esc(d.area)+'">'+esc(name)+' access</label>'+
   '<select id="permission-mode-'+esc(d.area)+'" data-access-mode>'+Object.entries(modeLabels).map(([key,label])=>
    '<option value="'+esc(key)+'" '+(key===mode?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></td>'+
   '<td>'+(scopedAreas.includes(d.area)?'<label class="sr-only" for="record-scope-'+esc(d.area)+'">'+esc(name)+' record scope</label>'+
    '<select id="record-scope-'+esc(d.area)+'" data-record-scope><option value="">Existing visibility</option>'+Object.entries(scopeLabels).map(([key,label])=>
     '<option value="'+esc(key)+'" '+(key===scope?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select>':'Not scoped')+'</td>'+
   '<td>'+(deleteKeys.length?deleteKeys.map(key=>allowance(key,d.area,'delete')).join(''):
    d.delete.includes('workorder.delete')?'Administrator only':'Not applicable')+(d.area==='workorders'?'<small class="muted">Whole orders: administrator only</small>':'')+'</td></tr>';
 });
 function allowance(key,area,kind){
  return '<label><input type="checkbox" data-area-grant="'+esc(area)+'" data-grant-kind="'+esc(kind)+'" value="'+esc(key)+'" '+(selected.has(key)?'checked':'')+'> '+esc(catalog[key]||key)+'</label>';
 }
 const advanced=descriptors.filter(d=>!d.adminOnly).map(d=>{
  const extras=[...new Set([...d.write,...d.actions,...d.read])].filter(key=>!d.delete.includes(key));
  if(!extras.length)return '';
  return '<fieldset class="permission-group" data-area-details="'+esc(d.area)+'"><legend>'+esc(areaLabel(d.area))+'</legend>'+
   extras.map(key=>allowance(key,d.area,d.read.includes(key)?'read':d.write.includes(key)?'ordinary':'special')).join('')+'</fieldset>';
 }).join('');
 // Retain older unclassified grants on this profile, but never silently add them.
 const retained=[...selected].filter(key=>!covered.has(key)&&!['workorder.delete','staff.manage','staff.leaveReview','team.view'].includes(key));
 modal(profile?'Edit permission profile':'New permission profile',
  f('name','Profile name',{required:true,value:profile?.name})+
  '<div class="permission-matrix tablewrap"><table><thead><tr><th scope="col">Area</th><th scope="col">Access</th><th scope="col">Record scope</th><th scope="col">Delete access</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'+
  '<details class="permission-group" open><summary>Allowed actions within each area</summary><p>Switching an area to Read &amp; write checks its regular create and edit actions. Check specialized actions individually. Read only disables mutations, including delete. Shared read grants, such as financial detail, stay in sync wherever they appear.</p>'+advanced+'</details>'+
  (retained.length?'<p>Existing legacy grants preserved: '+esc(retained.map(key=>catalog[key]||key).join(', '))+'.</p>':''),
  values=>{
   const controls=Object.fromEntries([...form.querySelectorAll('[data-permission-area]')].map(row=>{
    const area=row.dataset.permissionArea;
    return [area,{mode:row.querySelector('[data-access-mode]').value,scope:row.querySelector('[data-record-scope]')?.value,
     permissions:grants.get(area).filter(input=>input.checked&&!input.disabled).map(input=>input.value)}];
   }));
   return send('profiles.save',{id:profile?.id,name:values.name,...profileEditorValues(descriptors,controls,retained)});
  },
  '<p>These settings apply to assigned users. Hidden areas return no protected records. Read only opens permitted records without changing them. Delete and specialized actions are granted separately. Built-in administrators retain administrator access.</p>');
 const form=$('#actionForm');
 const allGrants=[...form.querySelectorAll('[data-area-grant]')];
 const grants=new Map(descriptors.map(d=>[d.area,allGrants.filter(input=>input.dataset.areaGrant===d.area)]));
 function checkGrant(input,value){for(const linked of allGrants)if(linked.value===input.value)linked.checked=value;}
 for(const input of allGrants)input.addEventListener('change',()=>checkGrant(input,input.checked));
 function sync(row,preselect=false){
  const area=row.dataset.permissionArea,mode=row.querySelector('[data-access-mode]').value;
  const scope=row.querySelector('[data-record-scope]');
  if(scope)scope.disabled=mode==='hidden';
  for(const input of grants.get(area)){
   const kind=input.dataset.grantKind;
   input.disabled=mode==='hidden'||mode==='read'&&kind!=='read';
   if(preselect&&mode==='write'&&kind==='ordinary')checkGrant(input,true);
  }
 }
 for(const row of form.querySelectorAll('[data-permission-area]')){
  sync(row);row.querySelector('[data-access-mode]').addEventListener('change',()=>sync(row,true));
 }
}

document.addEventListener('click',event=>{
 const button=event.target.closest('#signOut');
 if(!button)return;
 modal('Sign out of BCI Operations?', '<p>On the hosted app this also signs you out of other sites using the same Cloudflare Access team.</p>', async()=>{
  const response=await fetch('/api/signout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
  if(!response.ok)throw Error('Sign-out did not complete. Try again.');
  const {redirect}=await response.json();
  if(!['/cdn-cgi/access/logout','/signed-out'].includes(redirect))throw Error('Sign-out did not complete. Try again.');
  try{sessionStorage.removeItem('bci-practice');}catch{}
  clearSession('Signing out…');
  window.location.replace(redirect);
 });
 const submit=document.querySelector('#actionForm button[type="submit"]');
 if(submit)submit.textContent='Sign out';
});
window.addEventListener?.('pageshow',event=>{
 if(event.persisted)refreshAccess();
});

function userForm(user){
 const options=[['tech','Technician'],['office','Office'],['admin','Administrator'],...(data.permissionProfiles||[]).map(p=>[p.id,p.name])];
 const contents=f('email','Cloudflare login email',{required:true,type:'email',value:user?.email})+
  f('access','Access level',{select:options,value:user?.profileId||user?.role||'tech'})+
  f('active','Status',{select:[['true','Active'],['false','Disabled']],value:user?.active===false?'false':'true'});
 modal(user?'Edit teammate':'Authorize teammate',contents,x=>{
  const profile=(data.permissionProfiles||[]).find(p=>p.id===x.access);
  return send('users.set',{email:x.email,role:profile?'tech':x.access,profileId:profile?.id,active:x.active==='true'});
 });
 if(user) $('#f_email').readOnly=true;
}
let testingRequest=0, databaseMode='records';
async function showDatabase(tableName='',page=0){
 const target=$('#databaseResults');
 if(!target) return;
 const request=++testingRequest;
 target.textContent='Loading database…';
 const params=new URLSearchParams({page,mode:databaseMode});
 if(tableName) params.set('table',tableName);
 try{
  const response=await fetch('/api/testing/database?'+params,{cache:'no-store'});
  const result=await response.json();
  if(request!==testingRequest||!target.isConnected) return;
  if(!response.ok) throw Error(result.error||'Database inspection failed');
  const {tables,name,columns,rows,more}=result;
  if(!tables.length){target.textContent="No sections are enabled for this access profile.";return;}
  const tabs=tables.map(t=>`<button class="${name===t.name?'primary':'secondary'}" aria-pressed="${name===t.name}" data-db-table="${esc(t.name)}">${esc(t.name)}</button>`).join('');
  target.innerHTML=`<div class="actions">${tabs}</div><div class="actions"><button class="secondary" data-db-table="${esc(name)}" data-db-page="${page}">Refresh</button>
   <button class="secondary" data-db-table="${esc(name)}" data-db-page="${page-1}" ${page?'':'disabled'}>Previous</button>
   <span>Page ${page+1}</span><button class="secondary" data-db-table="${esc(name)}" data-db-page="${page+1}" ${more?'':'disabled'}>Next</button></div>
   ${table(columns.map(c=>c.name+' · '+c.type),rows.map(row=>'<tr>'+columns.map(c=>'<td>'+databaseCell(row[c.name])+'</td>').join('')+'</tr>'))}`;
 }catch(error){if(request===testingRequest) target.textContent=error.message;}
}
function databaseCell(value){
 if(value===null) return '<span class="muted">NULL</span>';
 let parsed=value;
 if(typeof value==='string'&&/^[{\[]/.test(value.trim())){
  try{parsed=JSON.parse(value);}catch{}
 }
 if(typeof parsed==='object') return `<details><summary>View structured value</summary><pre class="database-value">${esc(JSON.stringify(parsed,null,2))}</pre></details>`;
 return `<span class="database-value">${esc(parsed)}</span>`;
}
let payrollDraft=null;
const hoursLabel=n=>Number(n||0).toFixed(2);
function payrollDetail(entries){
 return table(['Date','Employee','Project / work order','Category','Hours','Notes'],entries.map(e=>
  `<tr><td>${esc(e.date)}</td><td>${esc(e.tech)}</td><td>${esc([e.projectNumber,e.job].filter(Boolean).join(' · '))}</td>
  <td>${esc(e.type)}</td><td>${hoursLabel(e.quantity)}</td><td>${esc(e.description)}</td></tr>`));
}
function showPayrollReview(result){
 const box=$('#payrollReview');
 if(!box)return;
 box.innerHTML=`<h3>Employee totals</h3>${me?.role==='admin'?'<p>See the same employee under multiple labels? Reconcile their time and run this review again before approving.</p><button type="button" class="secondary" data-time-attribution>Reconcile employee time</button>':''}${result.issues.length?`<div class="notice">${result.issues.map(esc).join('<br>')}</div>`:''}
  <form id="payrollApprove">${table(['Employee','Work','Travel','Shop','Worked','PTO','Sick','Holiday','Confirm OT hours'],result.rows.map((row,i)=>
  `<tr><td>${esc(row.employee)}</td>${['work','travel','shop','worked','pto','sick','holiday'].map(k=>`<td>${hoursLabel(row[k])}</td>`).join('')}
  <td><input aria-label="Overtime for ${esc(row.employee)}" name="ot${i}" type="number" required min="0" max="${row.worked}" step="0.01" placeholder="0.00"></td></tr>`))}
  ${can('payroll.approve')&&result.rows.length&&!result.issues.length?f('payDate','Pay date',{type:'date',required:true})+'<button class="primary" type="submit">Approve and lock period</button>':''}</form>
  <details><summary>Supporting time entries (${result.entries.length})</summary>${payrollDetail(result.entries)}</details>`;
}
const csvValue=value=>'"'+String(value??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
function payrollExport(run){
 const rows=[['Employee','Period start','Period end','Pay date','Regular','Overtime','PTO','Sick','Holiday','Work','Travel','Shop','Approved by'],
  ...run.rows.map(r=>[r.employee,run.start,run.end,run.payDate,r.regular,r.overtime,r.pto,r.sick,r.holiday,r.work,r.travel,r.shop,run.approvedBy])];
 const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(csvValue).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='BCI-Payroll-'+run.end+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printDocument(markup){
 // Print from an independent document. The active work order never enters
 // the print context, even when the browser delays its print dialog.
 const preview=window.open('','_blank');
 if(!preview){show('Allow pop-ups for BCI Operations to open the print preview.',true);return;}
 preview.opener=null;
 const document=preview.document;
 const base=document.createElement('base');base.href=window.location.origin+'/';document.head.append(base);
 const stylesheet=document.createElement('link');
 stylesheet.rel='stylesheet';stylesheet.href=new URL('/app.css',window.location.href).href;
 const stylesReady=new Promise(resolve=>{stylesheet.onload=stylesheet.onerror=resolve;});
 document.head.append(stylesheet);
 document.title='BCI Operations · Print preview';
 document.body.className='document-print';
 const toolbar=document.createElement('div');
 toolbar.className='print-preview-toolbar';
 const button=document.createElement('button');button.className='primary';button.textContent='Print / Save PDF';
 button.disabled=true;button.onclick=()=>preview.print();
 toolbar.append(button);
 const paper=document.createElement('section');paper.id='bciPrintDocument';paper.style.display='block';
 paper.innerHTML=(practiceMode?'<p class="practice-print">PRACTICE INVOICE · TRAINING ONLY</p>':'')+markup;
 document.body.append(toolbar,paper);
 Promise.all([stylesReady,...[...paper.querySelectorAll('img')].map(image=>image.decode().catch(()=>{}))]).then(()=>{button.disabled=false;});
}
const invoiceLayouts=[['totals','Total time + total materials'],['crew','Crew time + total materials'],
 ['crew-materials','Crew time + itemized materials'],['itemized','Itemized time + itemized materials']];
function openProjectInvoice(w,billingStage='progress'){
 const existing=(data.projectInvoices||[]).find(invoice=>invoice.id===w.invoice?.groupId);
 if(existing){printDocument(invoiceDocument(existing));return;}
 const projectRecord=project(w.projectId), payer=customer(projectRecord.customerId);
 if(projectRecord.closedAt)billingStage='final';
 const eligible=data.workorders.filter(order=>order.projectId===w.projectId&&readyForProgress(projectRecord,order));
 if(!eligible.length){show('Review at least one uninvoiced work order first',true);return;}
 modal(billingStage==='final'?'Prepare final invoice':'Prepare progress invoice',
  '<fieldset class="permission-group"><legend>Reviewed work orders</legend>'+eligible.map(order=>
  `<label><input type="checkbox" name="invoiceOrder" value="${esc(order.id)}" ${order.id===w.id||billingStage==='final'?'checked':''}> ${esc(order.title)}</label>`).join('')+'</fieldset>'+
  f('layout','Customer detail',{select:invoiceLayouts,hint:'Changes what the customer sees. Billable totals stay the same.'})+
  f('depositCredit','Deposit credit applied in QuickBooks',{type:'number',min:0,step:.01,hint:'Apply only a recorded, received deposit.'})+
  '<div id="invoiceNotes"></div><button class="secondary" id="invoicePreview" type="button">Preview / Print PDF</button>'+
  f('number','QuickBooks invoice number · enter after creating in QuickBooks',{required:true}),
  async values=>{
   const draft=buildDraft();
   await send('invoice.group',{number:values.number,layout:draft.layout,workorderIds:draft.orders.map(o=>o.id),notes:draft.notes,billingStage,depositCredit:draft.depositCredit});
  },'<p>Choose one or more work orders. Preview the PDF, then enter the QuickBooks invoice number to record billing.</p>');
 const form=$('#actionForm');
 const draftNotes=new Map();
 const selected=()=>eligible.filter(order=>[...form.querySelectorAll('[name=invoiceOrder]:checked')].some(input=>input.value===order.id));
 function buildDraft(){
  const orders=selected();if(!orders.length)throw Error('Select at least one work order');
  const depositCredit=Number(form.elements.depositCredit.value||0);
  const depositRemaining=(projectRecord.depositLedger||[]).reduce((sum,row)=>sum+(row.kind==='received'?row.amount:row.kind==='applied'?-row.amount:0),0);
  if(!Number.isFinite(depositCredit)||depositCredit<0||roundMoney(depositCredit)>roundMoney(depositRemaining)||depositCredit>roundMoney(orders.reduce((sum,w)=>sum+bill(w).total,0)))throw Error('Credit exceeds the received deposit or invoice.');
  if(billingStage==='final'&&orders.length!==eligible.length)throw Error('Include all remaining billable orders in the final invoice');
  return {customer:payer.business||payer.name,address:payer.address,project:projectRecord.name,projectNumber:projectRecord.number,po:projectRecord.po,
   layout:form.elements.layout.value,number:form.elements.number.value,depositCredit,notes:Object.fromEntries(draftNotes),
   orders:orders.map(order=>({id:order.id,title:order.title,crew:order.crewSummary||[],
     entries:order.entries.filter(e=>!e.sharedTravel).map(e=>({...e,description:draftNotes.get(e.id)??e.description}))}))};
 }
 function updateNotes(){
  const details=$('#invoiceNotes');
  details.innerHTML=form.elements.layout.value==='itemized'?'<details><summary>Edit customer-facing descriptions</summary>'+
   selected().flatMap(order=>order.entries.filter(entry=>!entry.sharedTravel)).map(e=>`<label class="field">${esc(e.date)} · ${esc(e.name)}
     <textarea data-invoice-note="${esc(e.id)}" maxlength="1000">${esc(draftNotes.get(e.id)??e.description)}</textarea></label>`).join('')+'</details>':'';
 }
 form.addEventListener('change',event=>{if(['invoiceOrder','layout'].includes(event.target.name))updateNotes();});
 form.addEventListener('input',event=>{if(event.target.dataset.invoiceNote)draftNotes.set(event.target.dataset.invoiceNote,event.target.value);});
 $('#invoicePreview').addEventListener('click',()=>{try{printDocument(invoiceDocument(buildDraft()));}catch(error){show(error.message,true);}});
}
// The shell selects a screen and binds shared UI controls. Each screen owns its markup.
function render(){
 nav();
 const views={fleet:fleetPage,staff:staffPage,invoices:invoicesPage,estimates:estimatesPage,training:trainingPage,notifications:notificationsPage,tickets:ticketsPage,dashboard,customers,projects:projectsHub,workorders,inventory:warehouse,money:moneyPage,reports,payroll:payrollPage,services:servicesPage,catalog:catalogPage,team:teamPage,testing:testingPage,changelog:changelogPage,trash:trashPage};
 const allowed=visibleView(view);
 const content=!allowed?'<section class="panel"><h1>No module access</h1><p>Ask your administrator to assign a permission profile.</p></section>':
  managingRecords()?recordManager():
  selectedWO&&can('workorders.view')&&wo(selectedWO)?detail(wo(selectedWO)):
  view==='customers'&&customer(selectedClientPortal)?clientPortal(customer(selectedClientPortal)):
  view==='projects'&&project(selectedProject)?projectDetail(project(selectedProject)):views[view]();
 $('#app').innerHTML=(allowed?recordTools()+(view==='team'?assignmentLink():''):'')+content;
 for(const button of $('#app').querySelectorAll('[data-open],[data-change]')){
  const permission=button.hasAttribute('data-change')?'change.approve':formPermissions[button.dataset.open];
  if(permission&&!can(permission))button.remove();
 }
 if(view==='staff'&&allowed)wireProfileWeather($('#profileWeather'));
 wireRecords();
 if(view==='catalog'&&allowed)wirePricingPage($('#app'));
 if(view==='trash'&&me?.role==='admin')wireTrash();
 if(view==='changelog'&&allowed)wireChangelog($('#app').querySelector('[data-changelog]'));
 if(view==='testing'&&allowed){if(!me?.rawDatabaseTesting)databaseMode='records';showDatabase();}
 if(view==='payroll'&&allowed&&payrollDraft)showPayrollReview(payrollDraft);
 renderTrainingGuide();
}

function show(msg,error=false){const el=$('#flash');el.textContent=msg;el.className=error?'error':'';el.style.display='block';setTimeout(()=>el.style.display='none',4800);}
let initialLink=true;
let practiceMode=false;
try{
 const link=new URLSearchParams(window.location.search);
 const liveLink=['ticket','tickets','intake','notifications'].some(key=>link.has(key));
 practiceMode=!liveLink&&sessionStorage.getItem('bci-practice')==='1';
 if(liveLink)sessionStorage.removeItem('bci-practice');
}catch{}
async function practiceRequest(action,data){
 const response=await fetch('/api/training/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});
 const body=await response.json();
 if(!response.ok||!body.ok)throw Error(body.error||'Training action failed');
 return body.result;
}
async function setPracticeMode(enabled,options={}){
 if(options.reset)await practiceRequest('training.reset',{all:options.all===true});
 if(enabled)await practiceRequest('training.start',{});
 const oldMode=practiceMode;
 practiceMode=enabled;
 view='training';selectedWO=null;selectedProject=null;guidedClient='';guidedContact='';contactQuery='';
 try{await reload();}
 catch(error){practiceMode=oldMode;throw error;}
 try{sessionStorage.setItem('bci-practice',enabled?'1':'0');}catch{}
}
function practiceNavigate(screen,form){
 if(!practiceMode||!visibleView(screen))return;
 view=screen;selectedWO=null;selectedProject=null;
 const payer=data.customers.findLast(client=>client.id!=='customer_demo')||data.customers[0];
 guidedClient=payer?.id||'';
 guidedContact=payer?.contacts?.at(-1)?.id||'';
 const projects=data.projects.filter(project=>project.customerId===guidedClient);
 selectedProject=(projects.at(-1)||data.projects.at(-1))?.id||null;
 if(form==='workorder'){
  if(can('projects.view')&&selectedProject)view='projects';
 }else if(screen==='workorders'){
  const matches=order=>{
   if(form==='approve')return !order.approvedAt;
   if(form==='review')return order.closeout&&!order.closeout.reviewedAt&&!order.invoice;
   if(form==='project-invoice')return order.closeout?.reviewedAt&&!order.invoice;
   if(form==='close')return order.approvedAt&&!order.closeout&&order.entries.length;
   return order.approvedAt&&!order.closeout;
  };
  // Prefer the trainee's own order, then a sample at the required stage.
  const order=data.workorders.find(order=>order.projectId===selectedProject&&matches(order))||data.workorders.find(matches);
  selectedWO=order?.id||null;
 }
 render();
}
let loadSequence=0;
function clearSession(message){
 $('.bci-photo-viewer[open]')?.close();
 ++loadSequence;
 accessFingerprint='';data=null;me=null;selectedWO=null;selectedProject=null;selectedClientPortal=null;
 $('#nav').replaceChildren();$('#modalContent').replaceChildren();$('#modal').hidden=true;
 document.querySelector('#trainingGuide')?.remove();
 $('#app').textContent=message;
}
async function reload(){
 const sequence=++loadSequence;
 const res=await fetch(practiceMode?'/api/training/state':'/api/state',{cache:'no-store'});
 if(sequence!==loadSequence)return;
 if(res.status===401||res.status===403){
  if(practiceMode&&res.status===403){
   practiceMode=false;
   try{sessionStorage.removeItem('bci-practice');}catch{}
   return reload();
  }
  clearSession('Your access has changed. Sign in again or contact your administrator.');
  return;
 }
 if(!res.ok)throw Error('Could not load app data');
 const snapshot=await res.json();
 if(sequence!==loadSequence)return;
 data=snapshot;me=data.me;
 const access=practiceMode?data.liveAccess||me:me;
 accessFingerprint=JSON.stringify([access.email,access.role,[...access.permissions].sort(),access.recordScopes||{},access.accessRevision||0]);
 document.body.classList.toggle('practice-mode',practiceMode);
 if(initialLink&&!practiceMode){
  initialLink=false;
  const query=new URLSearchParams(window.location?.search||'');
  if(query.has('notifications')&&can('notification.view'))view='notifications';
  if((query.has('ticket')||query.has('tickets')||query.has('intake'))&&can('tickets.view')){
   view='tickets';selectTicketLink(query.get('ticket'),query.has('intake')&&Boolean(data.mailIntake),query.get('tickets'));
  }
 }
 if(!visibleView(view)){view=navItems.find(([id])=>visibleView(id))?.[0]||'dashboard';selectedWO=null;selectedProject=null;}render();}
// Check only the effective grants while idle. Reload the full state when they
// change, so a role edit does not interrupt an unrelated form.
let checkingAccess=false;
async function refreshAccess(){
 if(document.hidden||checkingAccess)return;
 checkingAccess=true;
 try{
  const sequence=loadSequence;
  const response=await fetch('/api/me',{cache:'no-store'});
  if(sequence!==loadSequence)return;
  if(response.status===401||response.status===403){
   if(me)clearSession('Your access has changed. Sign in again or contact your administrator.');
   return;
  }
  if(!response.ok)return;
  const account=await response.json();
  if(sequence!==loadSequence)return;
  const fingerprint=JSON.stringify([account.email,account.role,[...account.permissions].sort(),account.recordScopes||{},account.accessRevision||0]);
  if(fingerprint===accessFingerprint)return;
  $('#modalContent').replaceChildren();$('#modal').hidden=true;
  await reload();
 }catch{/* Keep the current screen during temporary connection failures. */}
 finally{checkingAccess=false;}
}
let accessFingerprint='';
window.addEventListener?.('focus',refreshAccess);
document.addEventListener('visibilitychange',refreshAccess);
if(typeof setInterval==='function')setInterval(refreshAccess,15000);
async function send(action,payload){
 if(practiceMode){
  const result=await practiceRequest(action,payload);
  await reload();show('Saved in practice');return result;
 }
 const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data:payload})});const j=await r.json();if(!r.ok||!j.ok){if(r.status===401||r.status===403)await refreshAccess();throw Error(j.error||'Could not save');}if(action==='timeAttribution.apply')payrollDraft=null;try{await reload();show('Saved');}catch{show('Saved. Refresh the page to see the update.',true);}return j.result;}
const f=(name,label,opts={})=>`<div class="field"><label for="f_${name}">${esc(label)}</label>${opts.select?`<select id="f_${name}" name="${name}" ${opts.hint?`aria-describedby="hint_${name}"`:''} ${opts.required?'required':''}>${opts.select.map(([val,txt])=>`<option value="${esc(val)}" ${val===opts.value?'selected':''}>${esc(txt)}</option>`).join('')}</select>`:opts.textarea?`<textarea id="f_${name}" name="${name}" ${opts.hint?`aria-describedby="hint_${name}"`:''} ${opts.required?'required':''} placeholder="${esc(opts.placeholder||'')}">${esc(opts.value||'')}</textarea>`:`<input id="f_${name}" name="${name}" ${opts.hint?`aria-describedby="hint_${name}"`:''} type="${opts.type||'text'}" ${opts.required?'required':''} ${opts.min!=null?`min="${opts.min}"`:''} ${opts.step?`step="${opts.step}"`:''} value="${esc(opts.value||'')}" placeholder="${esc(opts.placeholder||'')}">`}${opts.hint?`<small class="inlinehint" id="hint_${name}">${esc(opts.hint)}</small>`:''}</div>`;
const choose=arr=>arr.map(x=>[x.id,x.name]);
function modal(title,contents,action,pre=''){
 const node=$('#modal');
 node.querySelector('.modal-box')?.classList.remove('estimate-editor');
 $('#modalContent').innerHTML=`${practiceMode?'<p class="practice-print">PRACTICE MODE</p>':''}<h2 id="dialogTitle">${esc(title)}</h2>${pre}<form id="actionForm">${contents}
 <p class="form-error" role="alert" hidden></p><button class="primary" type="submit">Save</button></form>`;
 node.hidden=false;
 const form=$('#actionForm');
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(form.dataset.saving)return;
  const values=Object.fromEntries(new FormData(form)), errorBox=form.querySelector('.form-error');
  const button=form.querySelector('button[type=submit]');
  form.dataset.saving='true';button.disabled=true;errorBox.hidden=true;
  try{
   const canvas=form.querySelector('canvas');
   if(canvas){
    if(!form.querySelector('input[name=consent]').checked)throw Error('Approval terms must be accepted');
    if(!form.dataset.signed)throw Error('Please sign using your finger or pointer');
    values.signatureData=canvas.toDataURL('image/png');values.consent=true;
   }
   await action(values);node.hidden=true;
  }catch(error){errorBox.textContent=error.message;errorBox.hidden=false;}
  finally{delete form.dataset.saving;button.disabled=false;}
 });
}
function warehousePartModal(title,fields,action){
 const filter='<div class="field"><label for="warehousePartSearch">Search parts</label><input id="warehousePartSearch" type="search" placeholder="Name, brand, color, part # or SKU"></div>';
 modal(title,filter+f('catalogId','Part',{required:true,select:[['','Select part']]})+'<div class="bci-photo-line bci-part-match" id="warehousePartPreview"></div>'+fields,action);
 const search=$('#warehousePartSearch'), select=$('#f_catalogId'), preview=$('#warehousePartPreview');
 const materials=data.catalog.filter(item=>item.type==='material'&&item.warehouseArchived!==true);
 const label=item=>[item.name,partMeta(item)||item.sku,partColor(item)].filter(Boolean).join(' · ');
 function showPart(){
  const item=materials.find(candidate=>candidate.id===select.value);
  preview.innerHTML=item?photoThumbnail(item)+'<span class="muted tiny">'+esc([partCategory(item),item.unit].filter(Boolean).join(' · '))+'</span>':'';
 }
 function list(){
  const selected=materials.find(item=>item.id===select.value);
  const result=materials.filter(item=>partSearch(item,search.value));
  if(selected&&!result.includes(selected))result.unshift(selected);
  select.replaceChildren(new Option(result.length?'Select part':'No matching parts',''),...result.map(item=>new Option(label(item),item.id)));
  select.value=selected?.id||'';
  showPart();
 }
 search.addEventListener('input',list);
 select.addEventListener('change',showPart);
 list();
}
const customerHelp=(title,body)=>`<details class="customer-help"><summary>${esc(title)}</summary><p>${esc(body)}</p></details>`;
function openWorkEntry(w,material){
 const approved=w.changes.filter(change=>change.status==='approved');
 const changeField=approved.length?f('changeId','Approved scope',{select:[['','Original scope'],...approved.map(change=>[change.id,change.description])]}):'';
 const shared=f('date','Work date',{type:'date',value:today(),required:true})+changeField;
 const item=material?'<input type="hidden" name="catalogId">':f('catalogId','Labor or travel rate',{required:true,select:[['','Select']]});
 const materialFilters='<div class="bci-material-picker">'+f('partSearchText','Search parts',{type:'search',placeholder:'Name, brand, color, part # or SKU'})+
  '<div class="bci-material-shortcuts" role="group" aria-label="Quick material filters">'+materialShortcuts.map(([key,label])=>
   `<button class="secondary small" type="button" data-material-filter="${key}" aria-pressed="${key==='all'}">${esc(label)}</button>`).join('')+'</div>'+
  '<details class="bci-material-facets"><summary>Filter by category, type, or brand</summary><div class="bci-part-filters">'+
  f('partCategoryFilter','Category',{select:[['','All categories']]})+
  f('partTypeFilter','Type',{select:[['','All types']]})+
  f('partBrandFilter','Brand',{select:[['','All brands']]})+
  '</div></details><p class="muted tiny" id="materialMatches" role="status"></p>'+
  '<div class="bci-material-grid" role="region" aria-label="Matching parts"><div class="bci-material-grid-head" aria-hidden="true"><span>Part / item number</span><span>Category / unit</span><span>Availability</span></div><ul id="materialRows" aria-label="Matching parts"></ul></div>'+
  '<div class="bci-material-pager"><button type="button" class="secondary small" id="materialPrevious">Previous 10</button><button type="button" class="secondary small" id="materialNext">Next 10</button></div></div>';
 const fields=material?materialFilters+item+
  '<div class="bci-material-selected" id="materialPreview" role="status">No part selected.</div>'+f('quantity','Quantity used',{type:'number',min:0.01,step:'any',required:true})+
  '<input type="hidden" name="location" value="'+esc(warehouseName)+'"><p class="muted tiny">Stock source: '+esc(warehouseName)+'</p><p id="materialStock" role="status"></p>'+shared+
  (!practiceMode&&can('receipt.add')?'<button type="button" class="secondary" id="addEntryReceipt">+ Add Receipt</button><div id="entryReceiptFields" hidden>'+receiptPicker()+'</div>':''):
  f('type','Time type',{select:[['labor','Work'],['travel','Travel']]})+item+
  '<div id="sharedTravelChoice" class="shared-travel-choice" hidden><label><input type="checkbox" name="sharedTravel" value="yes" disabled> Shared travel (record my time, no client charge)</label><p class="muted tiny">Use when another employee is logging the travel charge.</p></div>'+
  shared+
  '<div class="grid2">'+f('startTime','Start',{type:'time',required:true})+f('endTime','End',{type:'time',required:true})+'</div>'+
  f('description','What did you work on?',{textarea:true,required:true,hint:'Time is saved under your signed-in profile.'});
 const submissionId=crypto.randomUUID();
 const draftId=material?submissionId:undefined;
 const draftEndpoint=practiceMode?'/api/training/action':'/api/action';
 const needsPartPricing=(item,changeId)=>Boolean(item?.needsPricing&&!w.effectivePricing?.id&&!approved.some(change=>change.id===changeId&&change.lines.some(line=>line.catalogId===item.id)));
 let queue=Promise.resolve(), saved=false, timer;
 modal(material?'Log materials':'Log time',fields,async values=>{
  clearTimeout(timer);
  await queue;
  const {receiptPhoto,partSearchText,partCategoryFilter,partTypeFilter,partBrandFilter,...entryValues}=values;
  if(material&&!entryValues.catalogId)throw Error('Select a part from the results first.');
  if(material&&needsPartPricing(data.catalog.find(item=>item.id===entryValues.catalogId),entryValues.changeId))throw Error('Pricing needed: set a price or use a priced profile or approved change before logging this part.');
  const receipt=material?await receiptPayload(receiptPhoto,submissionId):null;
  await send('entry.add',{...entryValues,sharedTravel:!material&&values.type==='travel'&&values.sharedTravel==='yes',receipt,draftId,submissionId,type:material?'material':values.type,workorderId:w.id});
  saved=true;
 });
 const form=$('#actionForm');
 const {catalogId,partCategoryFilter,partTypeFilter,partBrandFilter,partSearchText}=form.elements;
 const preview=form.querySelector('#materialPreview');
 const matches=form.querySelector('#materialMatches'),rowsBox=form.querySelector('#materialRows');
 const nextPage=form.querySelector('#materialNext'),prevPage=form.querySelector('#materialPrevious');
 const catalogById=material?new Map(data.catalog.filter(item=>item.type==='material').map(item=>[item.id,item])):null;
 const signals=material?materialSignals(data.workorders,data.inventory,{orderId:w.id,email:me?.email,warehouseName}):null;
 const filters=material?new Set([partCategoryFilter,partTypeFilter,partBrandFilter,partSearchText]):null;
 let shortcut='all', page=0;
 const identityLabel=item=>materialHasIdentity(item)?'':'Legacy / identity unverified';
 const pricingHelp='Pricing needed before this part can be logged. Ask the office to set pricing for this SKU or choose a record already priced for this scope.';
 const relevantSignal=item=>{
  const known=signals?.get(item.id);
  return [known?.onOrder?'Used on this order':known?.mine?'Recently used by you':known?.latest?'Recently used':'',
   known?.onHand>0?'Warehouse on hand: '+known.onHand:''].filter(Boolean).join(' · ');
 };
 function refreshPreview(){
  if(!preview)return;
  const item=catalogById.get(catalogId.value);
  const blocked=needsPartPricing(item,form.elements.changeId?.value);
  preview.innerHTML=item?
   '<strong>Selected: '+esc(item.name)+'</strong><span id="materialUnitHint">'+esc([partMeta(item)||item.sku,materialUnitLabel(item)].filter(Boolean).join(' · '))+'</span>'+
   (blocked?'<span class="warn tiny">'+pricingHelp+'</span>':''):'No part selected.';
  if(item)form.elements.quantity.setAttribute('aria-describedby','materialUnitHint');
  else form.elements.quantity.removeAttribute('aria-describedby');
  for(const button of rowsBox.querySelectorAll('button[data-material-choice]')){
   const selected=button.dataset.materialChoice===item?.id;
   button.setAttribute('aria-pressed',String(selected));
   button.querySelector('[data-selection-marker]').textContent=selected?'Selected':'Select';
  }
 }
 function fillFacet(select,items,label){
  const prior=select.value;
  select.replaceChildren(new Option(label,''),...items.map(value=>new Option(value,value)));
  if(items.includes(prior))select.value=prior;
 }
 function refreshItems(){
  const type=material?'material':form.elements.type.value;
  const change=approved.find(change=>change.id===form.elements.changeId?.value);
  const previous=catalogId.value;
  const scoped=change?new Set(change.lines.map(line=>line.catalogId)):null;
  const choices=data.catalog.filter(item=>item.type===type&&(item.type!=='material'||item.warehouseArchived!==true)&&(material||!item.needsPricing||w.effectivePricing?.id||change)&&(!scoped||scoped.has(item.id)));
  if(material){
   fillFacet(partCategoryFilter,materialFacets(choices).categories,'All categories');
   const category=partCategoryFilter.value;
   fillFacet(partTypeFilter,materialFacets(choices,{category}).types,'All types');
   const facetType=partTypeFilter.value;
   fillFacet(partBrandFilter,materialFacets(choices,{category,type:facetType}).brands,'All brands');
   const rankFilters={query:partSearchText.value,category,type:facetType,brand:partBrandFilter.value,shortcut};
   const result=rankMaterials(choices,signals,rankFilters,item=>!needsPartPricing(item,change?.id));
   const grid=materialGridPage(result,page);
   page=grid.page;
   const selected=validMaterialSelection(choices,previous);
   catalogId.value=selected?.id||'';
   const outside=selected&&!result.some(item=>item.id===selected.id);
   matches.textContent=grid.total?
    `Showing ${grid.start}–${grid.end} of ${grid.total} parts.${change?' Approved change parts only.':''}`:
    shortcut==='recent'?'No matching recently used parts. Try All Parts.':
    shortcut==='inStock'?'No matching parts on hand. Try All Parts.':'No matching parts. Change the filters.';
   if(outside)matches.textContent+=' Your selected part is outside these filters.';
   if(previous&&!selected)matches.textContent+=' Selection cleared because it is not available in this work scope.';
   rowsBox.innerHTML=grid.rows.map(item=>{
    const details=[materialBrand(item),item.catalogInfo?.mpn||item.sku,partColor(item),identityLabel(item)].filter(Boolean).join(' · ');
    const available=[relevantSignal(item),needsPartPricing(item,change?.id)?'Pricing needed':''].filter(Boolean).join(' · ');
    return `<li><button type="button" class="secondary bci-material-row" data-material-choice="${esc(item.id)}" aria-pressed="${item.id===selected?.id}">
     <span class="bci-material-row-name"><b>${esc(item.name)}</b><small>${esc(details)}</small></span>
     <span class="bci-material-row-unit">${esc([partCategory(item),materialUnitLabel(item)].filter(Boolean).join(' · '))}</span>
     <span class="bci-material-row-stock"><small>${esc(available)}</small><span data-selection-marker>${item.id===selected?.id?'Selected':'Select'}</span></span>
    </button></li>`;
   }).join('');
   prevPage.disabled=page===0;nextPage.disabled=page+1>=grid.pages;
   for(const button of form.querySelectorAll('[data-material-filter]'))button.setAttribute('aria-pressed',String(button.dataset.materialFilter===shortcut));
   refreshPreview();return;
  }
  catalogId.replaceChildren(new Option('Select rate',''),...choices.map(item=>new Option(item.name,item.id)));
  catalogId.value=choices.some(item=>item.id===previous)?previous:
   choices.some(item=>item.id===me.clockDefault?.catalogId)?me.clockDefault.catalogId:choices.length===1?choices[0].id:'';
 }
 const filterChanged=()=>{page=0;refreshItems();};
 const showSharedTravel=()=>{if(material)return;const enabled=form.elements.type.value==='travel';form.querySelector('#sharedTravelChoice').hidden=!enabled;form.elements.sharedTravel.disabled=!enabled;if(!enabled)form.elements.sharedTravel.checked=false;};
 form.elements.type?.addEventListener('change',()=>{showSharedTravel();refreshItems();});
 showSharedTravel();
 form.elements.changeId?.addEventListener('change',filterChanged);
 partSearchText?.addEventListener('input',filterChanged);
 partSearchText?.addEventListener('keydown',event=>{if(event.key==='Enter')event.preventDefault();});
 for(const control of [partCategoryFilter,partTypeFilter,partBrandFilter])control?.addEventListener('change',filterChanged);
 catalogId.addEventListener('change',refreshPreview);
 if(material){
  form.querySelector('.bci-material-shortcuts').addEventListener('click',event=>{
   const button=event.target.closest('button[data-material-filter]');
   if(!button)return;
   shortcut=button.dataset.materialFilter;
   if(shortcut==='all'){partSearchText.value='';partCategoryFilter.value='';partTypeFilter.value='';partBrandFilter.value='';}
   else{partCategoryFilter.value='';partTypeFilter.value='';partBrandFilter.value='';}
   filterChanged();
  });
  rowsBox.addEventListener('click',event=>{
   const button=event.target.closest('button[data-material-choice]');
   if(!button)return;
   // The selected result is the sole source of the submitted Catalog ID.
   catalogId.value=button.dataset.materialChoice;
   catalogId.dispatchEvent(new Event('change',{bubbles:true}));
  });
  nextPage.addEventListener('click',()=>{page++;refreshItems();});
  prevPage.addEventListener('click',()=>{page--;refreshItems();});
 }
 refreshItems();
 if(!material)return;
 form.querySelector('#addEntryReceipt')?.addEventListener('click',()=>{const fields=form.querySelector('#entryReceiptFields');fields.hidden=false;fields.querySelector('input').click();});
 const status=form.querySelector('#materialStock');
 const dialog=$('#modal');
 function sync(clear=false){
  const {catalogId,location,quantity,changeId}=Object.fromEntries(new FormData(form));
  const valid=catalogId&&!needsPartPricing(data.catalog.find(item=>item.id===catalogId),changeId)&&location?.trim()&&Number(quantity)>0&&form.elements.quantity.validity.valid;
  queue=queue.then(async()=>{
   const response=await fetch(draftEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'entry.materialDraft',data:{workorderId:w.id,draftId,catalogId,location,quantity,changeId,clear:clear||!valid}})});
   const {result,error}=await response.json();
   if(!response.ok)throw Error(error||'Could not update projected stock');
   status.textContent=result.cleared?'':`Projected stock: ${result.projected}. ${result.projected<0?'Purchasing ticket opened.':''}`;
  }).catch(error=>{status.textContent=error.message;});
 }
 const scheduleDraft=()=>{
  clearTimeout(timer);
  timer=setTimeout(()=>{if(!form.dataset.saving)sync();},300);
 };
 form.addEventListener('input',event=>{if(!filters.has(event.target))scheduleDraft();});
 // Direct grid selections and approved-scope changes refresh projected stock.
 form.addEventListener('change',event=>{if(event.target===catalogId||event.target===form.elements.changeId)scheduleDraft();});
 const heartbeat=setInterval(()=>{if(!form.dataset.saving)sync();},180000);
 const observer=new MutationObserver(()=>{
  if(!dialog.hidden&&form.isConnected)return;
  clearTimeout(timer);clearInterval(heartbeat);observer.disconnect();
  if(!saved)sync(true);
 });
 observer.observe(dialog,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});
}
function openForm(kind,entryId){if(formPermissions[kind]&&!can(formPermissions[kind]))return;if(['profile','user','import','access-sync','catalog-import'].includes(kind)&&me?.role!=='admin')return;const w=wo(selectedWO);switch(kind){
 case 'customer': return modal('New billing client',f('name','Name',{required:true})+f('business','Business (if applicable)')+
  f('email','Email 1',{type:'email',required:true})+f('financeEmail','Email 2 · Finance (optional)',{type:'email'})+
  f('phone','Phone',{type:'tel',required:true})+f('address','Billing address',{required:true}),async x=>{const saved=await send('customer.create',x);guidedClient=saved.id;guidedContact='';contactQuery='';render();},
  customerHelp('Who is the billing client?','Choose whoever pays BCI ELITE. If an EC pays us, the EC is the billing client and its foreman can be the job contact.'));
 case 'contact': {
  const payer=customer(guidedClient);
  if(!payer) return;
  return modal('New job contact',f('name','Name',{required:true,value:contactQuery})+f('phone','Phone',{type:'tel',required:true})+
   f('email','Email (optional)',{type:'email'}),async x=>{
    const saved=await send('contact.create',{...x,customerId:payer.id});guidedContact=saved.id;contactQuery='';render();
   },`<p>Billing client · ${esc(billingName(payer))}</p>`+
   customerHelp('Who is the job contact?','Add the foreman or person directing the work under this billing client.'));
 }
 case 'new-project':return createProjectFromHub();
 case 'project': {
  const payer=customer(guidedClient);
  if(payer)return createProjectFromHub(payer,payer.contacts?.find(c=>c.id===guidedContact));
  return;
 }
 case 'project-contact':return assignProjectContact(project(selectedProject));
 case 'clock-setup':return setupClock(w);
 case 'workorder': {
  const parent=view==='projects'&&!selectedWO?project(selectedProject):null;
  const picker=parent?`<p>Project · ${esc(projectLabel(parent))}</p>`:
   f('projectId','Project',{required:true,select:[['','Select project'],...data.projects.map(p=>[p.id,`${billingName(customer(p.customerId))} — ${projectLabel(p)}`])]});
  modal('Create work order',picker+f('pricingProfileId','Pricing profile',{select:[['','Inherit project / client pricing']]})+
   f('description','Scope to be approved',{textarea:true,required:true,value:'Complete the project',
    hint:'Examples: Complete the project · Run 50 cables for this phase · Fix cable IDF K D47.'}),async values=>{
    const saved=await send('workorder.create',{...values,projectId:parent?.id||values.projectId});
    selectedWO=saved.id;view='workorders';render();
   });
  const form=$('#actionForm');
  const updateProfiles=()=>{
   const selected=parent||project(form.elements.projectId?.value);
   const choices=selected?.pricingChoices||[];
   form.elements.pricingProfileId.replaceChildren(new Option('Inherit project / client pricing',''),...choices.map(item=>new Option(item.name,item.id)));
  };
  form.elements.projectId?.addEventListener('change',updateProfiles);
  updateProfiles();

 }
 case 'approve': {const m=modal('Customer original-scope signoff',`<div class="notice">Original scope: ${esc(w.description)}</div>`+f('signedBy','Approver full name',{required:true})+signFields(),x=>send('workorder.approve',{...x,workorderId:w.id}),'<div class="notice">By signing, the client approves the displayed original scope. Signer identity is not independently verified.</div>');initSignature();return m;}
 case 'change': {
   const options=[['','— None —'],...data.catalog.filter(c=>(c.type!=='material'||c.warehouseArchived!==true)&&(!c.needsPricing||w.effectivePricing?.id)).map(c=>[c.id,`${c.group} · ${c.name} / ${c.unit}`])];
   const line=(n,required)=>f(`catalog${n}`,`Line ${n} · Part or labor`,{select:required?options.slice(1):options})+f(`qty${n}`,`Line ${n} · Estimated quantity`,{type:'number',min:0,step:'any',value:required?1:0});
   return modal('Create change order',f('category','Change category',{select:[['add','Add'],['move','Move'],['remove','Remove']]})+f('description','Requested scope',{textarea:true,required:true})+line(1,true)+line(2,false)+line(3,false),x=>{
      const lines=[1,2,3].filter(n=>x[`catalog${n}`]&&Number(x[`qty${n}`])>0).map(n=>({catalogId:x[`catalog${n}`],quantity:Number(x[`qty${n}`])}));
      return send('change.create',{workorderId:w.id,category:x.category,description:x.description,lines});
   },'<div class="notice">Uses elevated change-order catalog rates. This is an estimated time-and-materials total, not a guaranteed price. Additional expedited freight or office coordination can affect final billing.</div>');
 }
 case 'client-markup':return openClientMarkup();
 case 'project-rate':return openProjectRate();
 case 'log-time':return openWorkEntry(w,false);
 case 'entry-note': {
  const entry=w?.entries.find(item=>item.id===entryId);
  if(!entry||!canEditJournalNote(w,entry))return;
  return modal('Edit field journal notes',
   f('note','Notes',{textarea:true,value:entry.journalNote??entry.description}),
   values=>send('entry.editNote',{workorderId:w.id,entryId:entry.id,revision:entry.journalNoteRevision||'',note:values.note}),
   '<p class="muted">Applies to the work-order journal. Payroll and invoice descriptions are preserved.</p>');
 }
 case 'log-materials':return openWorkEntry(w,true);
 case 'close':return modal('Submit completed work order','',()=>send('workorder.close',{workorderId:w.id}),'<div class="notice green">A snapshot of every entry and signed change will be preserved for review.</div>');
 case 'other-time':return modal('Log shop time or leave',f('employeeEmail','Employee Team sign-in email',{type:'email',required:true,hint:'Use the account’s sign-in email so the hours appear on the right staff profile.'})+f('date','Date',{type:'date',required:true,value:today()})+
  f('type','Category',{select:[['shop','Shop / non-job work'],['pto','PTO'],['sick','Sick'],['holiday','Holiday']]})+
  f('quantity','Hours',{type:'number',min:0.01,step:'0.01',required:true})+f('description','Notes'),x=>send('payroll.other',x));
 case 'workorder-print':return w&&can('workorders.view')?printDocument(workOrderDocument(w)):undefined;
 case 'project-invoice':return can('invoice.group')&&w?openProjectInvoice(w):undefined;
 case 'project-invoice-print': {
  if(!can('finance.view')||!can('invoices.view')||!w?.invoice?.groupId)return;
  const snapshot=(data.projectInvoices||[]).find(item=>item.id===w.invoice.groupId);
  return snapshot?printDocument(invoiceDocument(snapshot)):undefined;
 }
 case 'legacy-print': {
  if(!w||!can('finance.view')||!can('invoices.view'))return;
  const p=project(w.projectId), payer=customer(p?.customerId);
  return printDocument(invoiceDocument({customer:billingName(payer),address:payer?.address,
   project:p?.name,projectNumber:p?.number,po:p?.po,number:w.invoice?.number,layout:'totals',
   orders:[{title:w.title,entries:w.entries.filter(entry=>!entry.sharedTravel),crew:[]}]}));
 }
 case 'invoice':return modal('Record manually entered QuickBooks invoice',f('number','QuickBooks invoice number',{required:true}),x=>send('invoice.record',{...x,workorderId:w.id}),'<div class="notice">First enter three summary lines (Time, Materials, Travel) in QuickBooks and attach your detailed BCI PDF. There is no QuickBooks API integration.</div>');
 case 'payment': {
  const orders=w.invoice?.groupId?data.workorders.filter(order=>order.invoice?.groupId===w.invoice.groupId):[w];
  const due=roundMoney(orders.reduce((sum,order)=>sum+Math.max(0,bill(order).total-(order.invoice?.amountPaid||0)),0));
  return modal('Confirm a QuickBooks payment',f('amount','Payment received',{type:'number',step:'0.01',min:0.01,required:true,value:due.toFixed(2)}),
   x=>send('invoice.pay',{...x,workorderId:w.id}),`<p>QuickBooks #${esc(w.invoice.number)} · Outstanding ${fmt(due)}</p>`);
 }
 case 'warehouse-receive': {
  if(practiceMode||!can('inventory.view'))return;
  const submissionId=crypto.randomUUID();
  return warehousePartModal('Receive Parts at BCI Warehouse',
   f('quantity','Quantity received',{type:'number',step:'0.01',min:0.01,value:1,required:true})+
   (can('finance.view')?f('unitCost','Actual unit cost including tax (optional)',{type:'number',step:'0.01',min:0}):'')+
   f('vendor','Supplier (optional)')+f('reference','Receipt or order reference (optional)')+receiptPicker(),
   async ({receiptPhoto,...values})=>{
    const photo=await receiptPayload(receiptPhoto,submissionId);
    if(values.unitCost==='')delete values.unitCost;
    await send('inventory.receive',{...values,submissionId,warehouseReceive:true,receipt:photo??undefined});
   });
 }
 case 'warehouse-item': {
  if(!can('inventory.view')||!can('pricing.view'))return;
  const partPrice=(key,label)=>f(key,label,{type:'number',min:0,step:'0.01'});
  return modal('Add warehouse item',
   f('name','Part name',{required:true})+f('brand','Brand')+f('mpn','Manufacturer part #')+
   f('system','Category',{required:true,placeholder:'e.g. Copper cabling'})+f('partType','Type',{required:true,placeholder:'e.g. Jack'})+
   f('unit','Unit of measure',{required:true,value:'ea'})+f('sku','SKU (blank = generated)')+
   (can('finance.view')?partPrice('cost','Unit cost (optional)'):'')+
   partPrice('price','Sell price (optional)')+partPrice('changePrice','Change-order price (optional)'),
   values=>{
    const payload={...values,group:values.system,type:'material',inventoryEdit:true};
    for(const key of ['cost','price','changePrice'])if(payload[key]==='')delete payload[key];
    return send('catalog.create',payload);
   },'<p class="muted">Adds the part to Warehouse. Use Edit count in its row to enter the stock you have at BCI Warehouse. Leave unknown prices blank.</p>');
 }
 case 'service':
  if(!can('pricing.view'))return;
  return modal('Add Service',f('name','Service name',{required:true})+
   f('type','Service type',{required:true,select:[['labor','Labor'],['travel','Travel']]})+
   f('group','Group (optional)')+f('sku','SKU (optional)'),
   values=>send('catalog.create',{...values,serviceEntry:true}),
   '<p>This creates an hourly service, not a stock item. Set the rates separately in Pricing before using it.</p>');
 case 'catalog':return modal('New priced item',f('group','Group',{required:true})+f('name','Item name',{required:true})+f('type','Type',{select:[['material','Material'],['labor','Labor'],['travel','Travel']]})+f('unit','Unit (ea / hr / ft)',{required:true,value:'ea'})+f('sku','SKU (blank = generated)')+f('price','Normal price',{type:'number',min:0,step:'0.01',value:0})+f('changePrice','Change-order price',{type:'number',min:0,step:'0.01',value:0})+f('cost','Estimated cost',{type:'number',min:0,step:'0.01',value:0}),x=>send('catalog.create',x));
 case 'access-sync':return modal('Sync Cloudflare Access','<p>Replace the dedicated group’s email list with active BCI teammates.</p>',async()=>{
  const result=await send('access.sync',{});
  if(result.state==='failed')show(result.message,true);
 });
 case 'user':return userForm();
 case 'profile':return profileForm();
 case 'catalog-import':return openCatalogImport();
 case 'import':return openCustomerImport();
 case 'review':return modal('Review closeout',`<div class="notice">Confirm all original field entries were reviewed before allowing invoicing.</div>`,x=>send('workorder.review',{workorderId:w.id}));
 case 'reserve':return modal('Estimated reserve percentage',f('rate','Reserve %',{type:'number',step:'0.1',min:0,value:data.meta.reserveRate}),x=>send('settings.reserve',x));
 }}
function signFields(){return `<div class="field"><label>Customer signature (draw below)</label><canvas class="sign-canvas" width="440" height="160" aria-label="Signature drawing area"></canvas><button type="button" class="secondary small" id="clearSig">Clear signature</button></div><label class="signature-terms"><input type="checkbox" name="consent" required> I approve the scope and accept the estimated T&M terms shown above.</label>`;}
function initSignature(){const c=document.querySelector('.sign-canvas');if(!c)return;const form=c.closest('form'),ctx=c.getContext('2d');ctx.strokeStyle='#182022';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';let drawing=false;function point(e){const b=c.getBoundingClientRect();return {x:(e.clientX-b.left)*c.width/b.width,y:(e.clientY-b.top)*c.height/b.height};}c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);drawing=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.15,p.y+.15);ctx.stroke();form.dataset.signed='1';});c.addEventListener('pointermove',e=>{if(!drawing)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();});c.addEventListener('pointerup',()=>drawing=false);c.addEventListener('pointercancel',()=>drawing=false);document.getElementById('clearSig').addEventListener('click',()=>{ctx.clearRect(0,0,c.width,c.height);delete form.dataset.signed;});}
function approveChange(changeId){if(!can('change.approve'))return;const w=wo(selectedWO),co=w.changes.find(c=>c.id===changeId);if(!co)return;modal('Approve change order',`<p><b>${esc(co.description)}</b></p>${co.lines.map(l=>`<div class="list-item">${esc(l.name)} × ${l.quantity} <b>${fmt(l.quantity*l.rate)}</b></div>`).join('')}<p class="lineTotal">Estimated ${fmt(co.estimatedTotal)}</p><div class="notice">BCI ELITE must procure parts within your timeline, which may increase shipping and office coordination costs. This is an elevated time-and-materials estimate, not a fixed price. Final charges may be lower or higher. Supporting receipts are available upon request with the final invoice.</div>`+f('signedBy','Approver full name',{required:true})+signFields(),x=>send('change.approve',{workorderId:w.id,changeId,...x}),'<p class="muted tiny">Drawn signature captured. The app records the technician account, but cannot independently verify the identity or authority of the signer.</p>');initSignature();}
document.addEventListener('click',e=>{const target=e.target.closest('[data-nav],[data-project],[data-wo],[data-open],[data-change],[data-print],[data-client-portal]');if(!target)return;if(target.dataset.nav&&visibleView(target.dataset.nav)){view=target.dataset.nav;selectedWO=null;selectedProject=null;selectedClientPortal=null;render();if(e.detail===0&&target.classList.contains('nav-item'))$('#nav').querySelector?.('[aria-current="page"]')?.focus({preventScroll:true});}if(target.dataset.clientPortal&&can('customers.view')&&customer(target.dataset.clientPortal)){selectedClientPortal=target.dataset.clientPortal;selectedWO=null;selectedProject=null;view='customers';render();}if(target.dataset.project&&can('projects.view')){selectedProject=target.dataset.project;selectedWO=null;view='projects';render();}if(target.dataset.wo&&can('workorders.view')){selectedWO=target.dataset.wo;view='workorders';render();}if(target.dataset.open)openForm(target.dataset.open,target.dataset.entryId);if(target.dataset.change)approveChange(target.dataset.change);if(target.dataset.print)window.print();});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!$('.bci-photo-viewer[open]')&&!$('#modal').hidden&&!$('#actionForm')?.dataset.saving&&!$('#catalogImport')?.dataset.saving)$('#modal').hidden=true;
});
$('#closeModal').addEventListener('click',()=>{if(!$('#actionForm')?.dataset.saving&&!$('#catalogImport')?.dataset.saving)$('#modal').hidden=true;});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')&&!$('#actionForm')?.dataset.saving&&!$('#catalogImport')?.dataset.saving)$('#modal').hidden=true;});
document.addEventListener('change',e=>{if(e.target.id==='moneyCustomer'){moneyCustomer=e.target.value;render();}if(e.target.id==='moneyStatus'){moneyStatus=e.target.value;render();}if(e.target.id==='reportType'){reportType=e.target.value;render();}if(e.target.id==='reportStart'){reportStart=e.target.value;render();}if(e.target.id==='reportEnd'){reportEnd=e.target.value;render();}});
reload().catch(e=>{
 $('#app').textContent=`Unable to load ${practiceMode?'practice workspace':'BCI Operations'}: ${e.message}`;
 if(practiceMode){
  const exit=document.createElement('button');exit.className='secondary';exit.textContent='Exit training';
  exit.onclick=()=>setPracticeMode(false).catch(error=>show(error.message,true));
  $('#app').append(exit);
 }
});

document.addEventListener('change',event=>{
 if(event.target.id!=='guidedClient') return;
 guidedClient=event.target.value;guidedContact='';contactQuery='';render();
});
document.addEventListener('input',event=>{
 if(event.target.id!=='guidedContactSearch') return;
 contactQuery=event.target.value;
 const needle=contactQuery.toLowerCase();
 const contacts=customer(guidedClient)?.contacts||[];
 $('#guidedMatches').innerHTML=contactOptions(contacts.filter(c=>[c.name,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(needle))));
});
document.addEventListener('click',event=>{
 const contact=event.target.closest('[data-guided-contact]');
 if(contact){
  guidedContact=contact.dataset.guidedContact;
  const selected=customer(guidedClient)?.contacts?.find(c=>c.id===guidedContact);
  $('#guidedSelection').textContent='Job contact · '+(selected?.name||'Billing client leads / choose later');
 }
 const mode=event.target.closest('[data-db-mode]');
 if(mode&&me?.rawDatabaseTesting){databaseMode=mode.dataset.dbMode;showDatabase();return;}
 const database=event.target.closest('[data-db-table]');
 if(database&&!database.disabled&&me?.databaseTesting) showDatabase(database.dataset.dbTable,Number(database.dataset.dbPage||0));
});

document.addEventListener('click',event=>{
 if(me?.role!=='admin') return;
 const profile=event.target.closest('[data-profile-id]');
 if(profile) profileForm(data.permissionProfiles.find(p=>p.id===profile.dataset.profileId));
 const remove=event.target.closest('[data-remove-user]');
 if(remove){
  const email=remove.dataset.removeUser;
  if(email===me.email||!data.teamAccess?.[email]||data.teamAccess[email].protectedAdmin||!(data.users||[]).some(user=>user.email.toLowerCase()===email))return;
  modal('Remove teammate',f('confirmation','Type the Team email to confirm',{type:'email',required:true}),
   values=>send('users.remove',{email,confirmation:values.confirmation}),
   '<p>Remove access for <strong>'+esc(email)+'</strong>. Work orders, time, payroll and other history stay on record. This also clears BCI sign-in setup, where enabled. Cloudflare Access changes are separate.</p>');
  const submit=document.querySelector('#actionForm button[type="submit"]');
  if(submit)submit.textContent='Remove teammate';
  return;
 }
 const user=event.target.closest('[data-user-email]');
 if(user) userForm(data.users.find(u=>u.email===user.dataset.userEmail));
});

const serviceCategories=['Direct to client','Subcontractor','T&M'];
const serviceCategoryField=()=>f('serviceCategory','Service rate category',{select:[['','Catalog base rate'],...serviceCategories.map(x=>[x,x])]});
const clientOptions=()=>[['','Select billing client'],...data.customers.map(c=>[c.id,billingName(c)])];
const priceField=(name,label,value='',required=false)=>f(name,label,{type:'number',min:0,step:'any',value:String(value??''),required});
function openClientMarkup(){
 modal('Billing client parts markup',f('customerId','Type 1 billing client',{select:clientOptions(),required:true})+
  priceField('markup','Default markup % (blank = catalog price)'),values=>send('pricing.client',values),
  '<p class="muted">Part-specific rules take priority. Applies to open work only.</p>');
 const form=$('#actionForm');
 form.elements.customerId.addEventListener('change',()=>{form.elements.markup.value=customer(form.elements.customerId.value)?.partsMarkup??'';});
}
function openProjectRate(){
 modal('Project service rate category',f('projectId','Project',{required:true,select:[['','Select project'],...data.projects.map(p=>[p.id,billingName(customer(p.customerId))+' · '+projectLabel(p)])]})+
  serviceCategoryField(),values=>send('pricing.project',values));
 const form=$('#actionForm');
 form.elements.projectId.addEventListener('change',()=>{form.elements.serviceCategory.value=project(form.elements.projectId.value)?.serviceCategory||'';});
}
function openPartPricing(item){
 modal('Client pricing · '+item.name,f('customerId','Type 1 billing client',{select:clientOptions(),required:true})+
  f('mode','Rule',{select:[['inherit','Use client default'],['fixed','Fixed selling price'],['markup','Percentage markup'],['threshold','Fixed below threshold, markup at or above']]})+
  priceField('fixed','Fixed selling price')+priceField('threshold','Unit cost threshold (including purchase tax)')+
  priceField('markup','Markup %')+
  '<label class="signature-terms"><input type="checkbox" name="copyAll"> Copy price to all Type 1 clients</label><p id="bulkPricingNote" aria-live="polite"></p>',
  values=>{
   if(values.copyAll&&!window.confirm($('#bulkPricingNote').textContent+' Continue?'))throw Error('Bulk change canceled');
   return send('pricing.part',{...values,catalogId:item.id,copyAll:values.copyAll==='on'});
  },'<p class="muted">The selected rule applies to this part. Completed work orders and signed pricing keep their existing amounts.</p>');
 const form=$('#actionForm');
 function refresh(){
  const mode=form.elements.mode.value;
  const fields={fixed:['fixed','threshold'],threshold:['threshold'],markup:['markup','threshold']};
  for(const [name,modes] of Object.entries(fields)){
   const input=form.elements[name],enabled=modes.includes(mode);
   input.closest('.field').hidden=!enabled;input.disabled=!enabled;input.required=enabled;
  }
  const count=data.customers.filter(c=>c.partPricing?.[item.id]).length;
  $('#bulkPricingNote').textContent=form.elements.copyAll.checked?
   `${mode==='inherit'?'Clear the override for':'Copy the full rule to'} ${data.customers.length} billing clients. ${count} existing overrides will be replaced or removed.`:'';
 }
 form.elements.customerId.addEventListener('change',()=>{
  const rule=customer(form.elements.customerId.value)?.partPricing?.[item.id];
  form.elements.mode.value=rule?.mode||'inherit';
  for(const name of ['fixed','threshold','markup'])form.elements[name].value=rule?.[name]??'';
  form.elements.copyAll.checked=false;refresh();
 });
 form.elements.mode.addEventListener('change',refresh);
 form.elements.copyAll.addEventListener('change',refresh);
 refresh();
}
document.addEventListener('click',event=>{
 const pricing=event.target.closest('[data-part-pricing]');
 if(pricing&&can('pricing.part')){
  const item=catalog(pricing.dataset.partPricing);
  if(item?.type==='material')openPartPricing(item);
  return;
 }
 const edit=event.target.closest('[data-edit-catalog]');
 if(!edit||!can('catalog.update')) return;
 openCatalogEditor(catalog(edit.dataset.editCatalog));
});

function openCatalogEditor(item){
 if(!item) return;
 const categoryFields=item.type==='material'?'':serviceCategories.map((category,i)=>priceField('service'+i,category+' (blank = base rate)',item.serviceRates?.[category])).join('');
 modal('Edit catalog rates',priceField('price','Base selling rate',item.price,true)+priceField('changePrice','Change-order rate',item.changePrice,true)+categoryFields+
  (can('finance.view')?priceField('cost','Unit cost including purchase tax',item.cost,true):''),values=>{
   const serviceRates=item.type==='material'?undefined:Object.fromEntries(serviceCategories.map((category,i)=>[category,values['service'+i]]));
   return send('catalog.update',{...values,catalogId:item.id,serviceRates});
  });
}

document.addEventListener('submit',async event=>{
 if(!['payrollPeriod','payrollApprove'].includes(event.target.id))return;
 event.preventDefault();
 const values=Object.fromEntries(new FormData(event.target)), button=event.submitter;
 if(button)button.disabled=true;
 try{
  if(event.target.id==='payrollPeriod'){
   const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'payroll.preview',data:values})});
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||'Payroll review failed');
   payrollDraft=body.result;showPayrollReview(payrollDraft);
  }else{
   const overtime=Object.fromEntries(payrollDraft.rows.map((row,i)=>[row.key,values['ot'+i]]));
   await send('payroll.approve',{start:payrollDraft.start,end:payrollDraft.end,payDate:values.payDate,revision:payrollDraft.revision,overtime});
   payrollDraft=null;render();
  }
 }catch(error){show(error.message,true);}
 finally{if(button)button.disabled=false;}
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-payroll-csv],[data-payroll-print]');
 if(!button||!can('payroll.view'))return;
 const run=(data.payrollRuns||[]).find(run=>run.id===(button.dataset.payrollCsv||button.dataset.payrollPrint));
 if(!run)return;
 if(button.dataset.payrollCsv){payrollExport(run);return;}
 printDocument(`<h1>BCI ELITE · Approved payroll</h1><p>${esc(run.start)} – ${esc(run.end)} · Pay date ${esc(run.payDate)} · Approved by ${esc(run.approvedBy)}</p>
 ${table(['Employee','Regular','Overtime','PTO','Sick','Holiday'],run.rows.map(row=>`<tr><td>${esc(row.employee)}</td>${['regular','overtime','pto','sick','holiday'].map(key=>'<td>'+hoursLabel(row[key])+'</td>').join('')}</tr>`))}
 <h2>Supporting entries</h2>${payrollDetail(run.entries)}`);
});

document.addEventListener('submit',event=>{
 if(event.target.id!=='projectSearch')return;
 event.preventDefault();
 const values=new FormData(event.target);
 projectFilter=String(values.get('query')||'');
 projectClient=String(values.get('customerId')||'');
 render();
});

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-clock]');
 if(!button||button.disabled)return;
 const order=wo(selectedWO), action=button.dataset.clock;
 if(!order||!can('workorders.view')||action==='in'&&!can('clock.in')||action!=='in'&&me?.clock?.workorderId!==order.id)return;
 if(action==='in'&&(!me.clockDefault||!catalog(me.clockDefault.catalogId)))return setupClock(order);
 if(action==='out')return modal('Clock out',f('description','What did you work on?',{textarea:true,required:true}),
  values=>send('clock.out',{...values,workorderId:order.id,clockId:me.clock?.id}));
 if(action==='cancel'&&!window.confirm('Cancel this timer without recording hours?'))return;
 button.disabled=true;
 try{await send('clock.'+action,{workorderId:order.id,clockId:me.clock?.id});}
 catch(error){show(error.message,true);}
 finally{button.disabled=false;}
});



// Shared presentation contract. Screen modules read these live bindings.
document.addEventListener('bci:ticket-invoice',event=>{
 if(!can('workorders.view')||!can('invoice.group'))return;
 const order=wo(event.detail);
 if(order)openProjectInvoice(order);
});
export { workOrderDocument, invoicesPage, printDocument, estimatesPage, trainingPage, practiceMode, setPracticeMode, practiceNavigate, notificationsPage, ticketsPage, openCatalogEditor, applyTheme, approveChange, assignProjectContact, bill, billingName, can, card, catalog, catalogPage, choose, clientOptions, clockPanel, contactFields, contactLine, contactOptions, contactPayload, contactQuery, createProjectFromHub, creationGuide, csvValue, customer, customerHelp, customerLaborSummary, customers, dashboard, data, databaseCell, databaseMode, detail, empty, esc, f, fmt, formPermissions, guidedClient, guidedContact, head, hoursLabel, initSignature, warehouse, invoiceDocument, invoiceLayouts, jobContact, labelFor, me, modal, moneyCustomer, moneyPage, moneyStatus, nav, navItems, openCatalogImport, openClientMarkup, openCustomerImport, openForm, openPartPricing, openProjectInvoice, openProjectRate, openWorkEntry, payrollDetail, payrollDraft, payrollExport, payrollPage, priceField, profileForm, project, projectClient, projectDetail, projectFilter, projectLabel, projectsHub, reload, render, reportEnd, reportStart, reportType, reports, roundMoney, selectedProject, selectedWO, send, serviceCategories, serviceCategoryField, setupClock, show, showDatabase, showPayrollReview, signFields, status, systemTheme, table, teamPage, testingPage, testingRequest, changelogPage, servicesPage, themeToggle, today, userForm, view, visibleView, wireContactFields, wo, workorders };

document.addEventListener('bci:open-project',event=>{
 if(!can('projects.view')||!project(event.detail))return;
 selectedProject=event.detail;selectedWO=null;view='projects';render();
});

document.addEventListener('bci:open-workorder',event=>{
 if(!can('workorders.view')||!wo(event.detail))return;
 selectedWO=event.detail;selectedProject=null;view='workorders';render();
});
