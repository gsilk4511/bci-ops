import {vehiclesAction} from './vehicles.js';
import {checkWorkReceipt,saveWorkReceipt,stockMovement,editWorkEntry,mayEditWorkEntry,logEntryChange} from './work-entry.js';
import {staffName} from './staff.js';
import {businessManagerAction} from './business-manager.js';
import {staffAction} from './staff.js';
import {projectWorkflow,internalOrder,internalProject,verifyFinalBilling,applyDepositCredit} from './project-workflow.js';
import {reconcileStock, updateMaterialDraft, WAREHOUSE_LOCATION} from './stock-demand.js';
import {commitFieldPurchase,receiveWarehouseParts} from './warehouse-receipts.js';
import {estimateAction} from './estimates.js';
import { ticketAction, queueReview, completeReview, requestCorrections } from './tickets.js';
import { savePricing } from './pricing-profiles.js';
import { handleRecordAction, handleContactEdit } from './records.js';
import { createHash } from 'node:crypto';
import { clientPricingChoices, serviceCategories, pricingNumber, partRule, orderRate, repriceOpenOrders } from './pricing.js';
import { addOtherTime, approvePayroll, checkTimeEntry, validDate, timeMinutes, employeeKey } from './payroll.js';
import { normalizeProfileAccess } from './permissions.js';
export const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const text = (value, field, max = 250) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${field} is required (max ${max} characters)`);
  return value.trim();
};
const nonneg = (value, field) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be a non-negative number`);
  return n;
};
const pos = (value, field) => { const n = nonneg(value, field); if (n === 0) throw new Error(`${field} must exceed zero`); return n; };
const find = (items, key, label) => { const item = items.find(x => x.id === key); if (!item) throw new Error(`${label} not found`); return item; };
const partInfoFields = {brand:['Brand',100,'manufacturer'],mpn:['Manufacturer part number',150,'manufacturerPartNumber'],
  system:['Category',120],partType:['Part type',120]};
const identityKey = value => String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const itemIdentity = item => [item.catalogInfo?.brand||item.manufacturer,item.catalogInfo?.mpn||item.manufacturerPartNumber].map(identityKey);
function updatedPartInfo(state,item,data) {
  const patch={};
  const info={...item.catalogInfo};
  let edit=false;
  for (const [field,[label,max,alias]] of Object.entries(partInfoFields)) {
    if(data[field]===undefined)continue;
    edit=true;
    const value=typeof data[field]==='string'&&data[field].trim()===''?'':text(data[field],label,max);
    if(value)info[field]=value;else delete info[field];
    if(alias)patch[alias]=value;
  }
  if(!edit)return patch;
  patch.catalogInfo=info;
  const [brand,mpn]=itemIdentity({...item,...patch});
  const [oldBrand,oldMpn]=itemIdentity(item);
  if((oldBrand||oldMpn)&&(oldBrand!==brand||oldMpn!==mpn)&&(item.catalogInfo?.photoId||item.catalogInfo?.fitReferences?.length))
    throw Error('This manufacturer and part number are linked to a verified photo or fit reference and cannot be changed here');
  if(brand&&mpn&&state.catalog.some(other=>{
    if(other.id===item.id)return false;
    const [b,m]=itemIdentity(other);
    return b===brand&&m===mpn;
  }))throw Error('That brand and manufacturer part number already exist');
  return patch;
}
const warehouseNumber = (value, field, signed=false) => {
  if(!['string','number'].includes(typeof value)||String(value).trim()==='')throw Error(field+' is required');
  const n=Number(value);
  if(!Number.isFinite(n)||Math.abs(n)>1000000||!signed&&n<0)throw Error('Invalid '+field.toLowerCase());
  return n;
};
const approved = (wo) => wo.status !== 'awaiting-signoff' && !!wo.approvedAt;

export function seed() {
  const c = 'customer_demo', p = 'project_demo', w = 'wo_demo';
  return {
    meta: { schema: 1, seededAt: now(), demo: true, reserveRate: 25 },
    customers: [{ id:c, name:'Sample Customer — Demo', email:'billing@example.invalid', contact:'Jamie Example', phone:'', address:'100 Example St, Sample City', createdAt:now() }],
    users: [],
    projects: [{ id:p, customerId:c, name:'Sample Network Expansion', site:'Demo Office — Floor 2', po:'DEMO-PO-17', createdAt:now() }],
    catalog: [
      {id:'cat_1', group:'Cabling', name:'Cat6 cable (ft)', unit:'ft', price:0.85, changePrice:1.1, cost:0.29, type:'material', sku:'BCI-CAT6'},
      {id:'cat_2', group:'Cabling', name:'Cat6 keystone jack', unit:'ea', price:19, changePrice:24, cost:7, type:'material', sku:'BCI-JACK'},
      {id:'cat_3', group:'Labor', name:'Cable technician labor', unit:'hr', price:95, changePrice:115, cost:34, type:'labor', sku:'BCI-LAB-CABLE'},
      {id:'cat_4', group:'Labor', name:'Lead technician labor', unit:'hr', price:125, changePrice:150, cost:45, type:'labor', sku:'BCI-LAB-LEAD'},
      {id:'cat_5', group:'Travel', name:'Travel / mobilization', unit:'hr', price:65, changePrice:75, cost:20, type:'travel', sku:'BCI-TRAVEL'}
    ],
    inventory: [{id:'stock_1', catalogId:'cat_2', location:WAREHOUSE_LOCATION, quantity:4}],
    movements: [],
    purchases: [],
    workorders: [{id:w, projectId:p, title:'Sample additional cable drops', status:'awaiting-signoff', description:'Install and test two additional data drops at the shipping desk.', createdAt:now(), approvedAt:null, approval:null, changes:[], entries:[], closeout:null, invoice:null}],
    events: [{id:id('evt'), at:now(), action:'seed.demo', reference:w, detail:'Sample records only'}]
  };
}

function event(state, action, reference, detail) { state.events.unshift({id:id('evt'), at:now(), action, reference, detail}); state.events = state.events.slice(0, 1000); }
function woFor(state, workorderId) { return find(state.workorders, workorderId, 'Work order'); }
function scopedCatalog(state, catalogId, type) { const cat = find(state.catalog, catalogId, 'Catalog item'); if (type && cat.type !== type) throw new Error(`Choose a ${type} catalog item`); return cat; }
function activeMaterial(item){
 if(item.type==='material'&&item.warehouseArchived===true)throw Error('This warehouse material is archived and cannot be selected for new work or stock activity');
 return item;
}

export function invoiceFor(state, wo) {
  const rows = wo.entries.map(e => ({type:e.type, amount:money(e.quantity * e.rate), cost:money(e.quantity * e.cost)}));
  const subtotal = type => money(rows.filter(e => e.type === type).reduce((s,e) => s + e.amount, 0));
  const cost = money(rows.reduce((s,e) => s + e.cost, 0));
  const time = subtotal('labor'), materials = subtotal('material'), travel = subtotal('travel');
  const gross = money(time + materials + travel);
  const total = internalOrder(state,wo)&&!wo.invoice?0:money(gross-(wo.invoice?.depositCredit||0));
  return {time, materials, travel, total, directCost:cost, grossProfit:money(total-cost), reserve:money(Math.max(total-cost,0)*state.meta.reserveRate/100)};
}
export function moneyStats(state) {
  const sums = {unbilled:0, outstanding:0, paid:0, grossProfit:0, reserve:0, unbilledCount:0, openCount:0, paidCount:0};
  const countedInvoices=new Set();
  for (const wo of state.workorders) {
    if(wo.billingHidden||internalOrder(state,wo)&&!wo.invoice)continue;
    const invoiceKey=wo.invoice?.groupId||wo.id;
    const first=!countedInvoices.has(invoiceKey);
    countedInvoices.add(invoiceKey);
    const x = invoiceFor(state,wo);
    if (!wo.invoice) {
      if (wo.closeout) {sums.unbilled = money(sums.unbilled+x.total); sums.unbilledCount++; sums.grossProfit = money(sums.grossProfit+x.grossProfit); sums.reserve = money(sums.reserve+x.reserve);}
    } else if (wo.invoice.status === 'paid') { sums.paid = money(sums.paid+x.total); if(first)sums.paidCount++; }
    else { sums.outstanding = money(sums.outstanding+Math.max(0,x.total-(wo.invoice.amountPaid||0))); if(first)sums.openCount++; }
  }
  return sums;
}
// Roll up timestamped labor into 1-, 2-, 3-person crew segments by labor type/day.
// Untimed duration entries remain available in the raw work journal and total labor hours.
export function crewSummary(entries) {
  const groups=new Map();
  for(const e of entries)if(e.type==='labor' && e.startTime && e.endTime){
    const key=`${e.date}|${e.catalogId}`;
    if(!groups.has(key))groups.set(key,[]);
    const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
    groups.get(key).push({t:minutes(e.startTime),delta:1,tech:e.tech});
    groups.get(key).push({t:minutes(e.endTime),delta:-1,tech:e.tech});
  }
  const result=[];
  for(const [key,edges] of groups){
    edges.sort((a,b)=>a.t-b.t||a.delta-b.delta);
    const active=new Map(),bucket=new Map();let previous=null;
    for(const edge of edges){
      if(previous!==null && edge.t>previous){
        const crewSize=[...active.values()].filter(x=>x>0).length;
        if(crewSize>0)bucket.set(crewSize,(bucket.get(crewSize)||0)+(edge.t-previous)/60);
      }
      active.set(edge.tech,(active.get(edge.tech)||0)+edge.delta);previous=edge.t;
    }
    const [date,catalogId]=key.split('|');
    for(const [crewSize,crewHours] of bucket)result.push({date,catalogId,crewSize,crewHours:money(crewHours),personHours:money(crewHours*crewSize)});
  }
  return result.sort((a,b)=>a.date.localeCompare(b.date)||a.crewSize-b.crewSize);
}
const addWorkEntry = (state, wo, data, actor, previous=null) => {
  if (!approved(wo)) throw new Error('Work is not released until customer signoff');
  if (!previous&&(wo.closeout || wo.invoice)) throw new Error('Closed work order: entries cannot be added');
  const type = text(data.type, 'Entry type', 20);
  if (!['labor','material','travel'].includes(type)) throw new Error('Invalid entry type');
  const cat = scopedCatalog(state, data.catalogId, type);
  const date=validDate(data.date||now().slice(0,10));
  const startTime=String(data.startTime||'').trim(),endTime=String(data.endTime||'').trim();
  const timed=Boolean(startTime||endTime);
  if(timed&&type==='material')throw Error('Materials use quantities');
  const quantity=timed?pos((timeMinutes(endTime)-timeMinutes(startTime))/60,'Elapsed time'):pos(data.quantity,'Quantity');
  if(previous?.catalogId!==cat.id||quantity>previous.quantity)activeMaterial(cat);
  const project=state.projects.find(p=>p.id===wo.projectId);
  const client=state.customers.find(c=>c.id===project?.customerId);
  const location=type==='material'?(previous?.stockLocation||WAREHOUSE_LOCATION):null;
  const receipt=type==='material'?state.purchases.find(p=>p.catalogId===cat.id&&p.location===location&&Number.isFinite(p.unitCost)):null;
  const cost=previous?.catalogId===cat.id?previous.cost:cat.warehouseUnitCostOverride?cat.cost:receipt?.unitCost??cat.cost;
  const changeId=data.changeId||null;
  const change=changeId?find(wo.changes,changeId,'Change order'):null;
  const signedLine=change?.lines.find(line=>line.catalogId===cat.id);
  if(change&&(change.status!=='approved'||!signedLine))throw Error('Choose an item on the approved change order');
  const sharedTravel=type==='travel'&&(data.sharedTravel===undefined?previous?.sharedTravel===true:data.sharedTravel===true);
  const rate=internalOrder(state,wo)||sharedTravel?0:previous?.catalogId===cat.id&&!previous.sharedTravel?previous.rate:signedLine?.rate??orderRate(state,wo,cat,project,client,cost);
  if(rate==null)throw Error('Set a fixed price or record a purchase cost before billing this part');
  const description=type==='material'?text(data.description||'Materials used','Description',1000):text(data.description,'Work notes',1000);
  const entry = {id:id('entry'), at:now(), date, startTime:startTime||null, endTime:endTime||null, type, catalogId:cat.id, name:cat.name, quantity, unit:cat.unit, rate, cost,
    changeId, tech:previous?.tech??staffName(state,actor.email),employeeEmail:previous?previous.employeeEmail:employeeKey(actor.email),createdBy:previous?.createdBy??actor.email,description};
  if(sharedTravel)entry.sharedTravel=true;
  if(type!=='material')checkTimeEntry(state,entry,previous?.id);
  if(previous){
    if(type==='material'){entry.stockLocation=previous.stockLocation;entry.stockMovementId=previous.stockMovementId;}
    if(previous.clockStartedAt)entry.clockStartedAt=previous.clockStartedAt;
    if(previous.clockEndedAt)entry.clockEndedAt=previous.clockEndedAt;
    return entry;
  }
  const checked=data.receipt?checkWorkReceipt(wo,data.receipt,actor):null;
  wo.entries.push(entry);
  if (type === 'material') {
    entry.stockLocation=location;
    entry.stockMovementId=stockMovement(state,wo,entry,{catalogId:cat.id,location},-quantity,'issue',actor);
    if(checked)saveWorkReceipt(state,wo,{...data.receipt,entryId:entry.id},actor,{...checked,entryId:entry.id});
  }
  event(state, 'entry.add', wo.id, `${type}: ${quantity} ${cat.unit} — ${entry.tech}`);
  return entry;
};

const clockFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function clockLocal(timestamp){
  const parts=Object.fromEntries(clockFormat.formatToParts(new Date(timestamp)).map(({type,value})=>[type,value]));
  return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};
}
function projectContact(state,customer,data,action){
  let contactId=data.contactId;
  if(data.newContact){
    contactId=applyAction(state,'contact.create',{...data.newContact,customerId:customer.id}).id;
  }else if(contactId===undefined&&action==='project.create')contactId=customer.defaultContactId;
  const contact=contactId?find(customer.contacts||[],contactId,'Contact for this billing client'):null;
  if(data.makeDefault===true){
    if(!contact)throw Error('Choose a contact to make it the billing client default');
    customer.defaultContactId=contact.id;
  }
  return contact?.id||null;
}
const signature = (data) => {
  const raw = String(data.signatureData || '');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raw) || raw.length > 230000) throw new Error('Drawn PNG signature is required (max 170 KB)');
  const buf = Buffer.from(raw.slice(22), 'base64');
  if (buf.length < 180 || buf.length > 170000 || buf.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG signature');
  if (data.consent !== true) throw new Error('Approver must accept the estimate and terms');
  return raw;
};
export function planCatalogImport(state, data) {
  const rows = data.catalog?.materials;
  if (data.format !== 'bci-operations-catalog-staging-v1' || !Array.isArray(rows) || !rows.length || rows.length > 2000) {
    throw Error('Choose a BCI Operations catalog staging JSON file');
  }
  const key = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const names = new Set(state.catalog.map(item => key(item.name)));
  const skus = new Set(state.catalog.map(item => key(item.sku)));
  const sources = new Set(state.catalog.map(item => key(item.importSource)));
  const pending = [], skipped = [];
  const amount = (value, field) => {
    if (value == null || value === '') return 0;
    if (!['number','string'].includes(typeof value) || !/^\d+(?:\.\d+)?$/.test(String(value))) throw Error('Invalid ' + field);
    return nonneg(value, field);
  };
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw Error('Invalid material row');
    const name = text(row.name, 'Item name', 200);
    const importSource = text(row.sourceName, 'Source item name', 250);
    const manufacturer = row.manufacturer ? text(row.manufacturer, 'Manufacturer', 70) : '';
    const partNumber = row.manufacturerPartNumber ? text(row.manufacturerPartNumber, 'Part number', 64) : '';
    const sku = partNumber || 'BCI-IMP-' + createHash('sha256').update(key(importSource)).digest('hex').slice(0, 24).toUpperCase();
    if (names.has(key(name)) || skus.has(key(sku)) || sources.has(key(importSource))) {
      skipped.push(name);
      continue;
    }
    const price = amount(row.quickBooksSalesPrice, 'sell price');
    const cost = amount(row.quickBooksPurchasePrice, 'purchase cost');
    const review = Array.isArray(row.review) ? row.review.filter(note => typeof note === 'string').slice(0, 20) : [];
    const needsPricing = !price || row.pricingStatus === 'needs_pricing' || review.some(note => /historical billing unit/i.test(note));
    pending.push({
      type:'material', name, sku, group:manufacturer || 'Imported materials',
      unit:row.itemType === 'Cable' ? 'package' : 'each', price, changePrice:price, cost,
      importSource, manufacturer, manufacturerPartNumber:partNumber,
      description:String(row.description ?? '').slice(0, 2000),
      sourceUrl:typeof row.sourceUrl === 'string' ? row.sourceUrl.slice(0, 2000) : '',
      packageLengthFt:Number.isSafeInteger(row.packageLengthFt) && row.packageLengthFt > 0 ? row.packageLengthFt : null,
      needsPricing, review
    });
    names.add(key(name)); skus.add(key(sku)); sources.add(key(importSource));
  }
  return {pending, skipped, ignored:Object.entries(data.catalog).reduce((count,[group,items]) =>
    count + (group !== 'materials' && Array.isArray(items) ? items.length : 0), 0)};
}

export function catalogImportSummary({pending, skipped, ignored}) {
  return {added:pending.length, skipped:skipped.length, ignored,
    needsPricing:pending.filter(item => item.needsPricing).length, examples:pending.slice(0, 8).map(item => item.name)};
}

export function applyAction(state, action, data={}, actor={email:'system'}) {
  if (!state || typeof action !== 'string' || !data || typeof data !== 'object') throw new Error('Invalid action');
  if(action.startsWith('trash.')||/^(customer|project|workorder|inventory|catalog)\.delete$/.test(action)||/^(customer|project|workorder)\.update$/.test(action))return handleRecordAction(state,action,data,actor);
  if(['contact.update','contact.delete'].includes(action))return handleContactEdit(state,action,data,actor);
  if(action==='pricing.profile.save')return savePricing(state,data,actor);
  if(action.startsWith('ticket.'))return ticketAction(state,action,data,actor);
  if(action.startsWith('estimate.'))return estimateAction(state,action,data,actor,fields=>applyAction(state,'project.create',fields,actor),fields=>applyAction(state,'workorder.create',fields,actor));
  if(action==='vehicles.manage')return vehiclesAction(state,data,actor);
  if(action==='businessManager.manage')return businessManagerAction(state,data,actor);
  if(action.startsWith('staff.'))return staffAction(state,action,data,actor,fields=>applyAction(state,'workorder.create',fields,actor));
  if(['project.close','project.followup','billing.deposit'].includes(action))return projectWorkflow(state,action,data,actor);
  let result = {};
  switch(action) {
    case 'customer.create': {
      const customer = {
        id:id('customer'), name:text(data.name,'Billing client name',100), business:String(data.business||'').trim().slice(0,150),
        email:text(data.email,'Billing client email',150), financeEmail:String(data.financeEmail||'').trim().slice(0,150),
        phone:text(data.phone,'Billing client phone',80), address:text(data.address,'Billing address',300),
        contacts:[], createdAt:now(),createdBy:actor.email
      };
      state.customers.push(customer); event(state,action,customer.id,customer.name); result=customer; break;
    }
    case 'contact.create': {
      const customer = find(state.customers,data.customerId,'Billing client');
      const contact = {id:id('contact'), name:text(data.name,'Contact name',100),
        phone:text(data.phone,'Contact phone',80), email:String(data.email||'').trim().slice(0,150)};
      (customer.contacts ??= []).push(contact);
      event(state,action,contact.id,customer.id); result=contact; break;
    }
    case 'project.create': {
      const customer = find(state.customers,data.customerId,'Billing client');
      const contactId=projectContact(state,customer,data,action);
      const project = {id:id('project'), customerId:customer.id, contactId, name:text(data.name,'Project name'), site:text(data.site||'Site not specified','Site',250), po:String(data.po||'').slice(0,80), createdAt:now(),createdBy:actor.email};
      const largest=state.projects.reduce((max,p)=>/^\d{2}-\d{3,}$/.test(p.number||'')?Math.max(max,Number(p.number.split('-')[1])):max,283);
      state.meta??={};
      const sequence=Math.max(largest,state.meta.projectSequence||0)+1;
      const year=new Intl.DateTimeFormat('en-US',{year:'2-digit',timeZone:'America/New_York'}).format(new Date());
      project.number=year+'-'+String(sequence).padStart(3,'0');
      state.meta.projectSequence=sequence;
      if(data.serviceCategory){
        if(!serviceCategories.includes(data.serviceCategory))throw Error('Select a service rate category');
        project.serviceCategory=data.serviceCategory;
      }
      state.projects.push(project); event(state,action,project.id,project.name); result=project; break;
    }
    case 'project.contact': {
      const project=find(state.projects,data.projectId,'Project');
      const customer=find(state.customers,project.customerId,'Billing client');
      project.contactId=projectContact(state,customer,data,action);
      event(state,action,project.id,project.contactId||'Contact cleared');result=project;break;
    }
    case 'workorder.create': {
      const project=find(state.projects,data.projectId,'Project');
      if(data.pricingProfileId&&!clientPricingChoices(state,state.customers.find(item=>item.id===project.customerId)).some(profile=>profile.id===data.pricingProfileId))throw Error('Choose a pricing profile available to this client');
      const existing=[...state.workorders,...(state.trash||[]).filter(item=>item.kind==='workorder').map(item=>item.record)].filter(order=>order.projectId===project.id);
      const workorderNumber=existing.reduce((max,order)=>Math.max(max,order.workorderNumber||0),existing.length)+1;
      const title=`${project.number||project.name} · Work Order ${workorderNumber}`;
      const wo = {id:id('wo'), projectId:data.projectId, title, workorderNumber, description:text(data.description,'Scope',2000), status:'awaiting-signoff', createdAt:now(), approvedAt:null, approval:null, changes:[], entries:[], closeout:null, invoice:null};
      if(data.pricingProfileId)wo.pricingProfileId=data.pricingProfileId;
      wo.createdBy=actor.email;
      if(internalProject(state,project))wo.internalTask=true;
      if(project.closedAt){project.reopenedAt=now();project.reopenedBy=actor.email;delete project.closedAt;delete project.closedBy;event(state,'project.reopen',project.id,actor.email);}
      state.workorders.unshift(wo); event(state,action,wo.id,wo.title); result=wo; break;
    }
    case 'workorder.approve': {
      const wo = woFor(state,data.workorderId);
      if (wo.approvedAt) throw new Error('Original scope has already been approved');
      const signedBy = text(data.signedBy,'Approver name',120);
      wo.approval={signedBy, at:now(), scope:wo.description, acknowledged:true, method:'drawn-on-device', signatureData:signature(data), recordedBy:actor.email, signerIdentityUnverified:true};
      wo.approvedAt=now(); wo.status='released'; event(state,action,wo.id,`Demo acknowledgment by ${signedBy}`); result=wo.approval; break;
    }
    case 'change.create': {
      const wo=woFor(state,data.workorderId);
      if (!approved(wo) || wo.closeout) throw new Error('Change requires a released, open work order');
      const category=text(data.category,'Change type',20);
      if (!['add','move','remove'].includes(category)) throw new Error('Choose Add, Move, or Remove');
      const project=state.projects.find(item=>item.id===wo.projectId);
      const client=state.customers.find(item=>item.id===project?.customerId);
      const lines=(Array.isArray(data.lines)?data.lines:[]).map(line=>{
        const item=activeMaterial(scopedCatalog(state,line.catalogId));
        const rate=orderRate(state,wo,item,project,client,item.cost,'change');
        if(rate==null)throw Error('Set a price before quoting '+item.name);
        return {catalogId:item.id,name:item.name,type:item.type,unit:item.unit,quantity:pos(line.quantity,'Quantity'),rate};
      });
      if (!lines.length) throw new Error('Add at least one catalog item');
      const change={id:id('co'), at:now(), category, description:text(data.description,'Change scope',1500), lines, estimatedTotal:money(lines.reduce((s,l)=>s+l.quantity*l.rate,0)), status:'awaiting-signoff', signedBy:null, signedAt:null, note:'Estimated T&M: final amount may be higher or lower. Expedited shipping and office coordination may apply; receipts on request.'};
      wo.changes.push(change); event(state,action,wo.id,change.description); result=change; break;
    }
    case 'change.approve': {
      const wo=woFor(state,data.workorderId);
      const co=find(wo.changes,data.changeId,'Change order');
      if (co.status !== 'awaiting-signoff') throw new Error('Change already approved');
      const signedBy=text(data.signedBy,'Approver name',120);
      co.status='approved'; co.signedBy=signedBy; co.signedAt=now(); co.signatureData=signature(data); co.recordedBy=actor.email; co.signerIdentityUnverified=true; co.approvedSnapshot=JSON.parse(JSON.stringify({description:co.description,lines:co.lines,estimate:co.estimatedTotal,note:co.note}));
      event(state,action,wo.id,`Change ${co.id} demo acknowledged by ${signedBy}`); result=co; break;
    }
    case 'inventory.commitFieldPurchase': return commitFieldPurchase(state,data,actor);
    case 'inventory.receive': {
      if(data.warehouseReceive===true)return receiveWarehouseParts(state,data,actor);
      if(data.receipt!=null)throw Error('Use Receive Parts to attach a Warehouse receipt');
      const cat=activeMaterial(scopedCatalog(state,data.catalogId,'material'));
      const location=WAREHOUSE_LOCATION, quantity=pos(data.quantity,'Quantity');
      let stock=state.inventory.find(x=>x.catalogId===cat.id&&x.location===location);
      if(!stock){stock={id:id('stock'),catalogId:cat.id,location,quantity:0};state.inventory.push(stock);}
      stock.quantity=money(stock.quantity+quantity);
      const purchase={id:id('purchase'),at:now(),date:text(data.date||now().slice(0,10),'Date',10),vendor:text(data.vendor||'Unspecified vendor','Vendor'),catalogId:cat.id,quantity,unitCost:nonneg(data.unitCost??cat.cost,'Unit cost'),location,card:text(data.card||'Unspecified card','Card',100),reference:String(data.reference||'').slice(0,100),category:'Materials'};
      state.purchases.unshift(purchase);
      state.movements.unshift({id:id('move'),at:now(),type:'receive',catalogId:cat.id,quantity,location,workorderId:null,note:`${purchase.vendor} / ${purchase.reference}`});
      event(state,action,purchase.id,`${cat.name} +${quantity} at ${location}`); result=purchase; break;
    }
    case 'purchase.create': {
      const purchase={id:id('purchase'),at:now(),date:text(data.date||now().slice(0,10),'Date',10),vendor:text(data.vendor,'Vendor'),catalogId:null,quantity:1,unitCost:nonneg(data.amount,'Amount'),location:'',card:text(data.card||'Unspecified card','Card',100),reference:String(data.reference||'').slice(0,100),category:text(data.category||'Other','Category',60)};
      state.purchases.unshift(purchase);event(state,action,purchase.id,`${purchase.vendor} — ${purchase.category}`);result=purchase;break;
    }
    case 'entry.editNote': {
      const wo=woFor(state,data.workorderId);
      const entry=find(wo.entries,data.entryId,'Field journal entry');
      if(!mayEditWorkEntry(entry,actor))throw Error('You can only edit entries recorded under your account');
      if((entry.journalNoteRevision||'')!==data.revision)throw Error('This note changed. Refresh the work order and try again');
      // Note overlay is journal-only; neither the approved payroll row nor billing snapshot changes.
      const old=structuredClone(entry);
      entry.journalNote=text(data.note,'Work notes',1000);
      entry.journalNoteRevision=id('note');
      logEntryChange(state,wo,action,actor,old,entry);
      result={id:entry.id};break;
    }
    case 'entry.update':
    case 'entry.remove': {
      const wo=woFor(state,data.workorderId);
      return editWorkEntry(state,wo,action,data,actor,entry=>addWorkEntry(state,wo,{
        type:entry.type,catalogId:data.catalogId||entry.catalogId,date:data.date,
        startTime:data.startTime,endTime:data.endTime,quantity:data.quantity,
        description:data.description,sharedTravel:data.sharedTravel,changeId:entry.changeId,location:entry.stockLocation
      },actor,entry));
    }
    case 'receipt.add': return saveWorkReceipt(state,woFor(state,data.workorderId),data,actor);
    case 'entry.materialDraft': {
      result=updateMaterialDraft(state,data,actor);break;
    }
    case 'entry.add': {
      const wo=woFor(state,data.workorderId);
      if(data.crew)throw Error('Each employee must record their own time.');
      if(data.receipt&&data.type!=='material')throw Error('Attach receipts to materials or the work order.');
      if(data.submissionId&&typeof data.submissionId==='string'&&/^[0-9a-f-]{36}$/i.test(data.submissionId)){
        const existing=wo.entries.find(entry=>entry.submissionId===data.submissionId&&entry.employeeEmail===employeeKey(actor.email));
        if(existing)return existing;
      }
      result=addWorkEntry(state,wo,data,actor);
      if(data.submissionId&&typeof data.submissionId==='string'&&/^[0-9a-f-]{36}$/i.test(data.submissionId))result.submissionId=data.submissionId;
      if(data.type==='material'&&data.draftId)updateMaterialDraft(state,{...data,clear:true},actor);
      break;
    }
    case 'clock.in': {
      const wo=woFor(state,data.workorderId);
      if(!approved(wo)||wo.closeout||wo.invoice)throw Error('Clock in requires an approved, open work order');
      const clocks=state.activeClocks??=[];
      if(clocks.some(clock=>clock.email===actor.email))throw Error('Clock out of your current work order first');
      const defaults=(state.clockDefaults??=[]);
      const previous=defaults.find(value=>value.email===actor.email);
      const tech=staffName(state,actor.email);
      const catalogId=scopedCatalog(state,data.catalogId??previous?.catalogId,'labor').id;
      const startedAt=now();
      checkTimeEntry(state,{tech,employeeEmail:employeeKey(actor.email),date:clockLocal(startedAt).date});
      if(clocks.some(clock=>employeeKey(clock.email)===employeeKey(actor.email)))throw Error('That employee already has a running clock');
      const clock={id:id('clock'),email:actor.email,workorderId:wo.id,tech,catalogId,startedAt,workDate:clockLocal(startedAt).date};
      clocks.push(clock);
      if(previous)Object.assign(previous,{tech,catalogId});else defaults.push({email:actor.email,tech,catalogId});
      event(state,action,wo.id,tech);result=clock;break;
    }
    case 'clock.out':
    case 'clock.cancel': {
      const clocks=state.activeClocks||[];
      const clock=clocks.find(c=>c.email===actor.email&&c.id===data.clockId&&c.workorderId===data.workorderId);
      if(!clock)throw Error('This clock is no longer running');
      const wo=woFor(state,clock.workorderId);
      if(action==='clock.out'){
        const endedAt=now(),start=clockLocal(clock.startedAt),end=clockLocal(endedAt);
        const elapsed=Math.floor(Date.parse(endedAt)/60000)-Math.floor(Date.parse(clock.startedAt)/60000);
        const localElapsed=timeMinutes(end.time)-timeMinutes(start.time);
        if(start.date!==end.date||elapsed!==localElapsed)throw Error('Clock crossed midnight or a time change. Cancel it and log the time manually by date.');
        if(elapsed<=0)throw Error('Clock out after at least one recorded minute');
        const entry=addWorkEntry(state,wo,{type:'labor',catalogId:clock.catalogId,tech:clock.tech,date:start.date,startTime:start.time,endTime:end.time,description:data.description},actor);
        Object.assign(entry,{clockStartedAt:clock.startedAt,clockEndedAt:endedAt});
        result=entry;
      }else result={id:clock.id};
      state.activeClocks=clocks.filter(c=>c.id!==clock.id);
      event(state,action,wo.id,clock.tech);break;
    }
    case 'payroll.other': result=addOtherTime(state,data,actor);break;
    case 'payroll.approve': result=approvePayroll(state,data,actor);break;
    case 'workorder.close': {
      const wo=woFor(state,data.workorderId);
      if(wo.closeout){result=wo.closeout;break;}
      if(!approved(wo))throw Error('Work order cannot be closed');
      if((state.activeClocks||[]).some(clock=>clock.workorderId===wo.id))throw Error('Clock out before submitting this work order');
      if (wo.changes.some(c=>c.status!=='approved')) throw new Error('Approve or remove pending changes before closeout');
      if (!wo.entries.length) throw new Error('Add at least one work entry');
      wo.closeout={at:now(), submittedEmail:actor.email, submittedBy:staffName(state,actor.email), originalEntries:JSON.parse(JSON.stringify(wo.entries)), originalChanges:JSON.parse(JSON.stringify(wo.changes)), originalApproval:JSON.parse(JSON.stringify(wo.approval))};
      wo.status='ready-for-review';delete wo.correctionRequest;queueReview(state,wo,actor);event(state,action,wo.id,`Submitted by ${wo.closeout.submittedBy}`);result=wo.closeout;break;
    }
    case 'invoice.group': {
      const ids=data.workorderIds;
      if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Select at least one work order');
      const orders=ids.map(id=>woFor(state,id));
      const project=find(state.projects,orders[0].projectId,'Project');
      if(orders.some(w=>w.projectId!==project.id||!w.closeout?.reviewedAt||w.invoice||internalOrder(state,w)))throw Error('Select reviewed, uninvoiced work orders from one project');
      const number=text(data.number,'QuickBooks invoice number',80);
      if(state.workorders.some(w=>w.invoice?.number?.trim().toLowerCase()===number.toLowerCase()))throw Error('QuickBooks invoice number already recorded');
      if(!['totals','crew','crew-materials','itemized'].includes(data.layout))throw Error('Select an invoice layout');
      const customer=find(state.customers,project.customerId,'Billing client');
      const sentAt=now();
      const billingStage=data.billingStage||'progress';
      verifyFinalBilling(state,project,orders,billingStage);
      const allocations=applyDepositCredit(project,orders,data.depositCredit,number,actor,w=>invoiceFor(state,w).total);
      const snapshot={id:id('invoice'),number,layout:data.layout,sentAt,projectId:project.id,billingStage,depositCredit:money(Object.values(allocations).reduce((s,v)=>s+v,0)),customer:customer.business||customer.name,
        address:customer.address,project:project.name,projectNumber:project.number,po:project.po,
        orders:orders.map(w=>({id:w.id,title:w.title,crew:crewSummary(w.entries),
          entries:w.entries.filter(e=>!e.sharedTravel).map(e=>({id:e.id,type:e.type,date:e.date,name:e.name,catalogId:e.catalogId,unit:e.unit,quantity:e.quantity,
            startTime:e.startTime,endTime:e.endTime,rate:e.rate,description:String(data.notes?.[e.id]??e.description??'').trim().slice(0,1000)}))}))};
      (state.projectInvoices??=[]).push(snapshot);
      for(const w of orders){
        w.invoice={groupId:snapshot.id,status:invoiceFor(state,w).total===allocations[w.id]?'paid':'sent',number,sentAt,depositCredit:allocations[w.id],amountPaid:0,paidAt:null};
        w.status=w.invoice.status==='paid'?'paid':'invoiced';
      }
      event(state,action,snapshot.id,number);result=snapshot;break;
    }
    case 'invoice.record': {
      const wo=woFor(state,data.workorderId);
      if (!wo.closeout?.reviewedAt || wo.invoice || internalOrder(state,wo)) throw new Error('Office-reviewed, uninvoiced work order required');
      if(state.projects.find(p=>p.id===wo.projectId)?.closedAt)throw Error('Use final billing on a closed project');
      const number=text(data.number,'QuickBooks invoice number',80);
      if(state.workorders.some(w=>w.invoice?.number?.trim().toLowerCase()===number.toLowerCase()))throw Error('QuickBooks invoice number already recorded');
      wo.invoice={status:'sent',number,sentAt:now(),amountPaid:0,paidAt:null};wo.status='invoiced';event(state,action,wo.id,wo.invoice.number);result=wo.invoice;break;
    }
    case 'invoice.pay': {
      const wo=woFor(state,data.workorderId);
      if (!wo.invoice || wo.invoice.status==='paid') throw new Error('Open invoice required');
      const orders=wo.invoice.groupId?state.workorders.filter(w=>w.invoice?.groupId===wo.invoice.groupId):[wo];
      const totalDue=money(orders.reduce((sum,w)=>sum+Math.max(0,invoiceFor(state,w).total-w.invoice.amountPaid),0));
      let amount=money(pos(data.amount,'Payment amount'));
      if(amount<=0||amount>totalDue)throw Error('Payment exceeds outstanding balance or rounds to zero');
      const payment=amount;
      for(const order of orders){
        const due=Math.max(0,money(invoiceFor(state,order).total-order.invoice.amountPaid));
        const applied=Math.min(due,amount);
        amount=money(amount-applied);
        order.invoice.amountPaid=money(order.invoice.amountPaid+applied);
      }
      if(payment===totalDue)for(const order of orders){
        order.invoice.status='paid';order.invoice.paidAt=now();order.status='paid';
      }
      event(state,action,wo.id,`Payment confirmed: ${payment}`);result=wo.invoice;break;
    }
    case 'catalog.import': {
      const plan = planCatalogImport(state, data);
      for (const item of plan.pending) state.catalog.push({id:id('cat'), ...item});
      result = catalogImportSummary(plan);
      if (result.added) event(state, action, 'catalog', 'Imported ' + result.added + ' materials');
      break;
    }
    case 'catalog.create': {
      const type=text(data.type,'Item type',30);
      if(!['material','labor','travel'].includes(type))throw new Error('Invalid catalog type');
      const serviceEntry=data.serviceEntry===true;
      if(serviceEntry&&(type==='material'||data.inventoryEdit===true))throw Error('Choose a labor or travel service');
      const name=text(data.name,'Item name',200), group=text(serviceEntry&&!String(data.group||'').trim()?(type==='labor'?'Labor':'Travel'):data.group,'Group',70);
      let sku=String(data.sku||'').trim().toUpperCase().slice(0,64);
      if(!sku)sku=`BCI-${Math.random().toString(36).slice(2,10).toUpperCase()}`;
      if(state.catalog.some(x=>x.sku===sku))throw new Error('SKU already exists');
      const item={id:id('cat'),group,name,type,sku,unit:text(serviceEntry?'hr':data.unit,'Unit',15)};
      if(serviceEntry)Object.assign(item,{price:0,changePrice:0,cost:0,needsPricing:true});
      else if(data.inventoryEdit===true){
        if(type!=='material')throw Error('Inventory can only add material items');
        const standard=data.price===undefined?0:warehouseNumber(data.price,'Base rate');
        const change=data.changePrice===undefined?standard:warehouseNumber(data.changePrice,'Change rate');
        const cost=data.cost===undefined?0:warehouseNumber(data.cost,'Unit cost');
        Object.assign(item,updatedPartInfo(state,item,data),{price:standard,changePrice:change,cost,
          needsPricing:!(standard>0&&change>0),needsUnitCost:data.cost===undefined,warehouseUnitCostOverride:data.cost!==undefined});
      }else Object.assign(item,{price:nonneg(data.price,'Base rate'),changePrice:nonneg(data.changePrice,'Change rate'),cost:nonneg(data.cost,'Estimated cost')});
      state.catalog.push(item);event(state,action,item.id,sku);result=item;break;
    }
    case 'pricing.client': {
      const client=find(state.customers,data.customerId,'Billing client');
      if(data.markup==='')delete client.partsMarkup;
      else client.partsMarkup=pricingNumber(data.markup,'markup percentage',10000);
      const updated=repriceOpenOrders(state,{customerId:client.id});
      event(state,action,client.id,'Updated default parts markup');result={updated};break;
    }
    case 'pricing.part': {
      const item=scopedCatalog(state,data.catalogId,'material');
      const client=find(state.customers,data.customerId,'Billing client');
      const rule=partRule(data);
      const targets=data.copyAll===true?state.customers:[client];
      for(const target of targets){
        if(rule)(target.partPricing??={})[item.id]={...rule};
        else if(target.partPricing)delete target.partPricing[item.id];
      }
      const updated=repriceOpenOrders(state,{catalogId:item.id,...(data.copyAll===true?{}:{customerId:client.id})});
      event(state,action,item.id,'Applied part rule to '+targets.length+' billing clients');result={updated,clients:targets.length};break;
    }
    case 'pricing.project': {
      const project=find(state.projects,data.projectId,'Project');
      if(data.serviceCategory&&!serviceCategories.includes(data.serviceCategory))throw Error('Select a service rate category');
      project.serviceCategory=data.serviceCategory||null;
      const updated=repriceOpenOrders(state,{projectId:project.id});
      event(state,action,project.id,'Updated service category');result={updated};break;
    }
    case 'catalog.update': {
      const item=scopedCatalog(state,data.catalogId);
      if(data.inventoryEdit===true){
        if(item.type!=='material')throw Error('Inventory can only edit material items');
        const patch=updatedPartInfo(state,item,data);
        for(const field of ['price','changePrice','cost'])if(data[field]!==undefined)
          patch[field]=warehouseNumber(data[field],field==='cost'?'Unit cost':field==='price'?'Base rate':'Change rate');
        if('cost' in patch){patch.warehouseUnitCostOverride=true;patch.needsUnitCost=false;}
        if(('price' in patch||'changePrice' in patch)&&item.needsPricing)
          patch.needsPricing=!((patch.price??item.price)>0&&(patch.changePrice??item.changePrice)>0);
        // Inventory edits only set defaults for future entries, never existing work or invoices.
        Object.assign(item,patch);
        event(state,action,item.id,item.name);result=item;break;
      }
      for(const field of ['price','changePrice','cost'])if(data[field]!==undefined)item[field]=nonneg(data[field],field);
      if(data.price!==undefined && item.price > 0 && item.changePrice > 0) item.needsPricing = false;
      if(data.serviceRates!==undefined){
        if(item.type==='material'||!data.serviceRates||typeof data.serviceRates!=='object'||Array.isArray(data.serviceRates))throw Error('Invalid service rates');
        const rates={};
        for(const category of serviceCategories){
          const value=data.serviceRates[category];
          if(value!==''&&value!=null)rates[category]=pricingNumber(value,'service rate');
        }
        item.serviceRates=rates;
      }
      if(data.price!==undefined||data.serviceRates!==undefined)repriceOpenOrders(state,{catalogId:item.id});
      event(state,action,item.id,item.name);result=item;break;
    }
    case 'inventory.transfer': {
      const cat=activeMaterial(scopedCatalog(state,data.catalogId,'material')), from=text(data.from,'From',100),to=text(data.to,'To',100),quantity=pos(data.quantity,'Quantity');
      if(from===to)throw new Error('Locations must be different');
      for(const [location,delta] of [[from,-quantity],[to,quantity]]){
        let stock=state.inventory.find(x=>x.catalogId===cat.id&&x.location===location);
        if(!stock){stock={id:id('stock'),catalogId:cat.id,location,quantity:0};state.inventory.push(stock);}
        stock.quantity=money(stock.quantity+delta);
        state.movements.unshift({id:id('move'),at:now(),type:'transfer',catalogId:cat.id,quantity:delta,location,workorderId:null,note:`Transfer ${from} → ${to} by ${actor.email}`});
      }
      event(state,action,cat.id,`${quantity} ${from} → ${to}`);result={quantity,from,to};break;
    }
    case 'inventory.adjust': {
      const cat=activeMaterial(scopedCatalog(state,data.catalogId,'material'));
      const isCount=data.mode==='count';
      if(data.mode!==undefined&&!isCount)throw Error('Invalid adjustment mode');
      const location=isCount?WAREHOUSE_LOCATION:text(data.location,'Location',100);
      let stock=state.inventory.find(x=>x.catalogId===cat.id&&x.location===location);
      const current=stock?.quantity??0;
      let quantity;
      if(isCount){
        const expected=warehouseNumber(data.expectedQuantity,'Previous on-hand count',true);
        if(expected!==current)throw Error('The warehouse count changed. Refresh the inventory grid and count again.');
        quantity=money(warehouseNumber(data.quantity,'New on-hand count')-current);
      }else quantity=Number(data.quantity);
      if(!Number.isFinite(quantity)||Math.abs(quantity)>(isCount?2e6:1e5))throw new Error('Invalid adjustment amount');
      const reason=text(data.reason,'Audit reason',400);
      if(isCount&&quantity===0){result=stock??{catalogId:cat.id,location,quantity:0};break;}
      if(!stock){stock={id:id('stock'),catalogId:cat.id,location,quantity:0};state.inventory.push(stock);}
      stock.quantity=money(stock.quantity+quantity);
      state.movements.unshift({id:id('move'),at:now(),type:'audit-adjustment',catalogId:cat.id,quantity,location,workorderId:null,note:`${reason} — ${actor.email}`});
      event(state,action,cat.id,reason);result=stock;break;
    }
    case 'profiles.save': {
      const name=text(data.name,'Profile name',80);
      const profiles=state.permissionProfiles ??= [];
      const existing=data.id ? find(profiles,data.id,'Permission profile') : null;
      if(profiles.some(profile=>profile.id!==existing?.id&&profile.name.toLowerCase()===name.toLowerCase())) throw new Error('A profile already uses that name');
      const next=normalizeProfileAccess(data);
      const before=existing?structuredClone(existing):null;
      const profile=existing||{id:id('profile')};
      Object.assign(profile,{name,...next});
      if(!existing) profiles.push(profile);
      event(state,action,profile.id,name);
      state.events[0].actor=actor.email;
      state.events[0].changes={before,after:structuredClone(profile)};
      result=profile;break;
    }
    case 'users.set': {
      const email=text(data.email,'Email',180).toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Invalid email');
      const role=text(data.role,'Role',30);
      if(!['tech','office','admin'].includes(role))throw new Error('Invalid role');
      const profileId=data.profileId ? find(state.permissionProfiles||[],data.profileId,'Permission profile').id : null;
      if(profileId&&role!=='tech') throw new Error('Custom profiles require a custom profile assignment');
      state.users ||= [];
      const user=state.users.find(x=>x.email.trim().toLowerCase()===email);
      const active=data.active!==false;
      const protectedAdmin=(process.env.BCI_ADMIN_EMAILS||'').split(',').some(x=>x.trim().toLowerCase()===email)||process.env.APP_AUTH_MODE==='local'&&email==='local-admin@example.invalid';
      if(protectedAdmin&&(!active||role!=='admin'))throw Error('This deployment administrator is protected');
      if(user?.role==='admin'&&user.active!==false&&(!active||role!=='admin')&&
        !protectedAdmin&&!(process.env.BCI_ADMIN_EMAILS||'').split(',').some(x=>x.trim())&&
        !(state.users||[]).some(x=>x!==user&&x.role==='admin'&&x.active!==false)&&process.env.APP_AUTH_MODE!=='local')throw Error('Keep at least one active administrator');
      const before=user?{role:user.role,profileId:user.profileId,active:user.active!==false}:null;
      if(user){user.email=email;user.role=role;user.profileId=profileId;user.active=active;}
      else state.users.push({email,role,profileId,active:data.active!==false});
      event(state,action,email,`role=${role}, active=${active}, profile=${profileId||'built-in'}`);state.events[0].actor=actor.email;state.events[0].changes={before,after:{role,profileId,active}};result={email,role};break;
    }
    case 'workorder.return': return requestCorrections(state,woFor(state,data.workorderId),data.reason,actor);
    case 'workorder.review': {
      const wo=woFor(state,data.workorderId);
      if(!wo.closeout||wo.invoice)throw new Error('Closeout awaiting review required');
      if(wo.closeout.reviewedAt){result=wo.closeout;break;}
      wo.closeout.reviewedBy=actor.email;wo.closeout.reviewedAt=now();
      wo.status='reviewed';completeReview(state,wo,actor);event(state,action,wo.id,'Reviewed');result=wo.closeout;break;
    }
    case 'settings.reserve': {
      const rate=nonneg(data.rate,'Reserve percentage');if(rate>100) throw new Error('Reserve cannot exceed 100%');state.meta.reserveRate=rate;event(state,action,'settings',`${rate}%`);result={rate};break;
    }
    default:throw new Error(`Unknown action: ${action}`);
  }
  if(['entry.materialDraft','entry.add','inventory.receive','inventory.adjust','inventory.transfer','workorder.close'].includes(action))reconcileStock(state);
  return result;
}
