// Scope is an additional record boundary, never an action or module grant.
// No legacy row gains an owner based on billing contact, displayed name, or actor email input.
import {randomUUID} from 'node:crypto';
const collections={customers:'customers',projects:'projects',workorders:'workorders',tickets:'tickets',estimates:'estimates',invoices:'projectInvoices',inventory:'inventory'};
const areas=Object.keys(collections);
const scopeModes=['own','assigned','all'];
const emailKey=value=>typeof value==='string'?value.trim().toLowerCase():'';
const rows=(state,area)=>state[collections[area]]||[];
const has= (actor,key)=>actor.permissions?.includes(key);

export function recordPrincipal(state,user,role,permissions,scopes) {
  const profileId=(state.users||[]).find(item=>emailKey(item.email)===emailKey(user.email))?.profileId;
  const selection=scopes ?? (state.permissionProfiles||[]).find(profile=>profile.id===profileId)?.recordScopes ?? {};
  const recordScopes={};
  if(role!=='admin')for(const area of areas){
    if(Object.hasOwn(selection,area))recordScopes[area]=scopeModes.includes(selection[area])?selection[area]:'none';
  }
  return {email:emailKey(user.email),role,permissions,recordScopes};
}
const mode=(actor,area)=>actor.role==='admin'?'all':(actor.recordScopes||actor.scopes)?.[area];

function owns(record,actor) {
 return Boolean(actor.email && emailKey(record.createdBy)===actor.email);
}
function assigned(record,actor) {
 return Boolean(actor.email && [record.assignee,...(Array.isArray(record.assignedTo)?record.assignedTo:[])]
  .some(email=>emailKey(email)===actor.email));
}
export function recordCanAccess(record,area,actor) {
 if(!record)return false;
 const scope=mode(actor,area);
 if(scope==='own')return owns(record,actor);
 if(scope==='assigned')return assigned(record,actor);
 if((!scope || scope==='all') && area==='tickets' && actor.role!=='admin')
   return has(actor,'ticket.viewAll')||owns(record,actor)||assigned(record,actor)||
    (record.kind==='review'&&has(actor,'workorder.review'))||(record.kind==='stock-shortage'&&has(actor,'inventory.view'));
 return scope===undefined || scope==='all';
}
export function legacyReviewScope(order) {
 return {id:'review-'+order.id,kind:'review',createdBy:order.closeout?.submittedEmail||order.createdBy,workorderId:order.id,projectId:order.projectId};
}
export function scopeTicket(state,ticket,actor) {
 if(!recordCanAccess(ticket,'tickets',actor))return false;
 if(ticket.workorderId&&anyLimited(actor,['workorders','projects','customers'])&&!rows(state,'workorders').some(w=>w.id===ticket.workorderId))return false;
 if(ticket.projectId&&anyLimited(actor,['projects','customers'])&&!rows(state,'projects').some(p=>p.id===ticket.projectId))return false;
 if(ticket.clientId&&limited(actor,'customers')&&!rows(state,'customers').some(c=>c.id===ticket.clientId))return false;
 return true;
}
const limited=(actor,area)=>['own','assigned','none'].includes(mode(actor,area));
const anyLimited=(actor, keys=areas)=>keys.some(area=>limited(actor,area));

export function scopeState(state,actor) {
 const view={...state};
 const allowed={};
 for(const area of ['customers','projects','workorders','estimates','inventory']){
   if(!Object.hasOwn(state,collections[area]))continue;
   view[collections[area]]=rows(state,area).filter(row=>recordCanAccess(row,area,actor));
   allowed[area]=new Set(view[collections[area]].map(row=>row.id));
 }
 if(limited(actor,'customers')){
   view.projects=(view.projects||[]).filter(row=>allowed.customers.has(row.customerId));
   view.estimates=(view.estimates||[]).filter(row=>allowed.customers.has(row.clientId));
 }
 const visibleProjects=new Set((view.projects||[]).map(row=>row.id));
 if(limited(actor,'customers')||limited(actor,'projects')){
   view.workorders=(view.workorders||[]).filter(row=>visibleProjects.has(row.projectId));
   view.estimates=(view.estimates||[]).filter(row=>!row.projectId||visibleProjects.has(row.projectId));
 }
 const visibleOrders=new Set((view.workorders||[]).map(row=>row.id));
 const invoiceRecords=rows(state,'invoices');
 const invoices=invoiceRecords.filter(row=>recordCanAccess(row,'invoices',actor)&&
  (!anyLimited(actor,['customers','projects'])||!row.projectId||visibleProjects.has(row.projectId))&&
  (!anyLimited(actor,['customers','projects','workorders'])||(
   (row.orders||[]).length>0&&(row.orders||[]).every(order=>visibleOrders.has(order.id))
  )));
 if(Object.hasOwn(state,'projectInvoices'))view.projectInvoices=invoices;
 const visibleInvoices=new Set(invoices.map(row=>row.id));
 if(anyLimited(actor,['customers','projects','workorders','invoices'])){
  view.workorders=(view.workorders||[]).map(order=>{
   if(!order.invoice)return order;
   const permitted=order.invoice.groupId?visibleInvoices.has(order.invoice.groupId):recordCanAccess(order.invoice,'invoices',actor);
   return permitted?order:{...order,billingHidden:true,invoice:{status:order.invoice.status}};
  });
  // Project-level deposits can span multiple work orders and invoices. Do not expose
  // the ledger or its allocations when the project billing picture would be incomplete.
  view.projects=(view.projects||[]).map(project=>{
    const missingOrder=rows(state,'workorders').some(order=>order.projectId===project.id&&!visibleOrders.has(order.id));
    const missingInvoice=invoiceRecords.some(row=>row.projectId===project.id&&!visibleInvoices.has(row.id));
    if(!limited(actor,'invoices')&&!missingOrder&&!missingInvoice)return project;
    const {depositLedger,...rest}=project;return {...rest,billingScopeLimited:true};
  });
  view.estimates=(view.estimates||[]).map(estimate=>({...estimate,generatedOrders:estimate.generatedOrders?.filter(order=>visibleOrders.has(order.id))}));
 }
 if(Object.hasOwn(state,'tickets')){
   Object.defineProperty(view,'ticketReviewExclusions',{value:rows(state,'tickets').filter(row=>row.kind==='review').map(row=>row.workorderId)});
   view.tickets=rows(state,'tickets').filter(row=>scopeTicket(view,row,actor));
 }
 if(anyLimited(actor,['inventory','customers','projects','workorders'])){
  view.movements=(state.movements||[]).filter(row=>
    (!limited(actor,'inventory') || recordCanAccess(row,'inventory',actor)) &&
    (!row.workorderId || visibleOrders.has(row.workorderId)));
  view.purchases=(state.purchases||[]).filter(row=>
    (!limited(actor,'inventory') || recordCanAccess(row,'inventory',actor)) &&
    (!row.workorderId || visibleOrders.has(row.workorderId)) &&
    (!row.projectId || visibleProjects.has(row.projectId)) &&
    (!limited(actor,'customers') || !(row.customerId||row.clientId) || allowed.customers.has(row.customerId||row.clientId)));
 }
 return view;
}

export function authorizeRecordAction(state,actor,action,data={}) {
 data ||= {};
 if(actor.role==='admin')return;
 const deny=()=>{throw Error('Record is outside your access scope');};
 if(action==='record.assign')deny();
 if(!anyLimited(actor))return; // Existing permissions and ticket rules still apply.
 const scoped=scopeState(state,actor);
 const ensure=(area,id)=>{if(typeof id!=='string'||!rows(scoped,area).some(row=>row.id===id))deny();};
 const optional=(area,id)=>{if(id)ensure(area,id);};
 const verifyBilling=(order,requireComplete=false)=>{
   if(!order)return deny();
   ensure('workorders',order.id);
   if(anyLimited(actor,['invoices','workorders','projects','customers'])){
     const visibleOrder=rows(scoped,'workorders').find(row=>row.id===order.id);
     if(order.invoice&&(!visibleOrder?.invoice?.number||order.invoice.groupId&&!rows(scoped,'invoices').some(inv=>inv.id===order.invoice.groupId)))deny();
     if(requireComplete && (limited(actor,'invoices') || rows(state,'workorders').some(item=>item.projectId===order.projectId&&!rows(scoped,'workorders').some(row=>row.id===item.id))))deny();
   }
 };
 if(action.startsWith('ticket.')){
   if(action!=='ticket.create'){
     const ticket=rows(state,'tickets').find(row=>row.id===data.id)||rows(state,'workorders').filter(o=>o.closeout&&!o.closeout.reviewedAt&&!o.invoice).map(legacyReviewScope).find(t=>t.id===data.id);
     if(!ticket||!scopeTicket(scoped,ticket,actor))deny();
   }
   optional('customers',data.clientId);optional('projects',data.projectId);optional('workorders',data.workorderId);
 }
 if(action==='mail.assign'){
   optional('customers',data.clientId);optional('tickets',data.prospectId);
 }
 if(action.startsWith('customer.') && action!=='customer.create'){
   if(Array.isArray(data.ids))data.ids.forEach(id=>ensure('customers',id));else ensure('customers',data.id);
 }
 if(action.startsWith('contact.'))ensure('customers',data.customerId);
 if(action.startsWith('project.')){
   if(action==='project.create')ensure('customers',data.customerId);
   else if(Array.isArray(data.ids))data.ids.forEach(id=>ensure('projects',id));
   else ensure('projects',data.projectId||data.id);
 }
 if(action.startsWith('workorder.')||action.startsWith('entry.')||action.startsWith('receipt.')||action.startsWith('change.')||action==='clock.in'){
   if(action==='workorder.create')ensure('projects',data.projectId);
   else if(Array.isArray(data.ids))data.ids.forEach(id=>ensure('workorders',id));
   else ensure('workorders',data.workorderId||data.id);
 }
 if(action==='staff.internal' && anyLimited(actor,['projects','customers','workorders'])){
   const project=rows(state,'projects').find(row=>String(row.name).trim().toLowerCase()==='bci elite admin'&&rows(state,'customers').some(c=>c.id===row.customerId&&[c.name,c.business].some(name=>String(name).trim().toLowerCase()==='randy bevins')));
   ensure('projects',project?.id);
   if(['assigned','none'].includes(mode(actor,'workorders')))deny();
 }
 if(action.startsWith('estimate.')){
   if(action==='estimate.releaseWorkOrder'){
     ensure('workorders',data.workorderId);
     ensure('estimates',rows(state,'workorders').find(row=>row.id===data.workorderId)?.estimateSource?.estimateId);
   }else{
     if(!['estimate.rates','estimate.create'].includes(action))ensure('estimates',data.id);
     const estimate=rows(state,'estimates').find(row=>row.id===data.id);
     if(estimate){optional('customers',estimate.clientId);optional('projects',estimate.projectId);}
     if(action==='estimate.accept'&&estimate?.scopes?.length&&['assigned','none'].includes(mode(actor,'workorders')))deny();
     optional('customers',data.clientId);optional('projects',data.projectId);optional('estimates',data.basedOnId);
   }
 }
 if(action==='billing.deposit'){
   ensure('projects',data.projectId);
   if(limited(actor,'invoices') || rows(state,'workorders').some(order=>order.projectId===data.projectId&&!rows(scoped,'workorders').some(row=>row.id===order.id)))deny();
 }
 if(action==='invoice.group'){
   if(!Array.isArray(data.workorderIds))deny();
   if(mode(actor,'invoices')==='assigned')deny();
   data.workorderIds.forEach(id=>verifyBilling(rows(state,'workorders').find(row=>row.id===id),data.billingStage==='final'||Number(data.depositCredit)>0));
 }
 if(action==='invoice.record'){
   if(mode(actor,'invoices')==='assigned')deny();
   verifyBilling(rows(state,'workorders').find(row=>row.id===data.workorderId));
 }
 if(action==='invoice.pay')verifyBilling(rows(state,'workorders').find(row=>row.id===data.workorderId));
 if(action.startsWith('pricing.')){
   optional('customers',data.customerId);optional('projects',data.projectId);optional('workorders',data.workorderId);
   const p=data.proposal||{};
   optional('customers',p.clientId);optional('customers',p.customerId);optional('projects',p.projectId);optional('workorders',p.workorderId);
   const targetCollection={project:'projects',client:'customers',workorder:'workorders'}[p.scope];
   if(targetCollection)optional(targetCollection,p.targetId||p.id);
   // Repricing can alter linked open work, and previews can count inaccessible rows.
   // Restrict global/bulk and pricing operations to unscoped records.
   if(anyLimited(actor,['customers','projects','workorders'])&&
     ['pricing.client','pricing.part','pricing.project','pricing.profile.preview','pricing.profile.save'].includes(action))deny();
 }
 if(limited(actor,'inventory') && (action.startsWith('inventory.')||action==='purchase.create')){
   // Inventory transfers/adjustments may mutate more than one stock row or create
   // projections from catalog + location pairs. Deny shared-stock writes under narrow scope.
   deny();
 }
}

export function assignRecord(state,actor,data={}) {
 if(actor.role!=='admin')throw Error('Admin access required');
 if(!areas.includes(data.area)||typeof data.id!=='string')throw Error('Select a record');
 const target=rows(state,data.area).find(row=>row.id===data.id);
 if(!target)throw Error('Record unavailable');
 if(!Array.isArray(data.assignees)||data.assignees.length>30||data.assignees.some(value=>typeof value!=='string'||!emailKey(value)))throw Error('Enter up to 30 active team members');
 const assignees=[...new Set(data.assignees.map(emailKey))];
 const active=new Set((state.users||[]).filter(user=>user.active!==false).map(user=>emailKey(user.email)));
 if(assignees.some(email=>!active.has(email)))throw Error('Select an active team member');
 target.assignedTo=assignees;
 (state.events??=[]).unshift({id:randomUUID(),action:'record.assign',reference:target.id,at:new Date().toISOString(),detail:actor.email+' set '+data.area+' assignments'});
 return {id:target.id,assignedTo:assignees};
}

export function stampRecordOwner(action,data,state,result,actor) {
 const area={'customer.create':'customers','project.create':'projects','workorder.create':'workorders','estimate.create':'estimates','invoice.group':'invoices','staff.internal':'workorders'}[action];
 if(area&&result?.id){
   const target=rows(state,area).find(row=>row.id===result.id);
   if(target&&!target.createdBy)target.createdBy=actor.email;
 }
 if(action==='invoice.record'){
   const order=rows(state,'workorders').find(row=>row.id===data.workorderId);
   if(order?.invoice&&!order.invoice.createdBy)order.invoice.createdBy=actor.email;
 }
}
