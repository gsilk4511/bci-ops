import {stockProjection} from './stock-demand.js';
import { clientPricingChoices, assignedPricing } from './pricing.js';
import { profileAccess } from './permissions.js';
// All API read filtering lives here, shared by normal screens and Database Testing.
// Always clone first: redacting a response must never mutate live accounting data.
export function visibleState(current,role,permissions) {
 const state=structuredClone(current);
 if(role==='admin')state.permissionProfiles=(state.permissionProfiles||[]).map(profile=>({...profile,...profileAccess(profile)}));
 const has=key=>permissions.includes(key);
 delete state.tickets;
 delete state.materialDrafts;
 delete state.workorderReceiptData;
 delete state.warehousePatchReceipts;
 delete state.timeCorrections;
 if(!has('estimates.view'))delete state.estimates;
 delete state.trainingWorkspaces;
 delete state.mailQueue;
 delete state.mailSeen;
 delete state.mailSync;
 delete state.notificationUsers;
 if(state.trash)state.trash=state.trash.map(item=>item.kind==='ticket'?{...item,record:{id:item.record.id,title:item.record.title}}:item);
 delete state.pricingProfiles;
 delete state.companyPricingProfileId;
 const work=has('workorders.view')||has('money.view')||has('dashboard.view');
 const project=has('projects.view')||work;
 const client=has('customers.view')||project||has('pricing.view')||has('estimates.view');
 if(!has('customers.view'))state.customers=client?state.customers.map(c=>({
  id:c.id,name:c.name,business:c.business,

  ...(has('pricing.view')?{partsMarkup:c.partsMarkup,partPricing:c.partPricing}:{})
 })):[];
 if(!has('projects.view'))state.projects=project?state.projects.map(p=>({
  id:p.id,name:p.name,number:p.number,customerId:p.customerId
 })):[];
 if(!work)state.workorders=[];
 else if(!has('workorders.view'))
  state.workorders=state.workorders.map(order=>({id:order.id,title:order.title,projectId:order.projectId,status:order.status,
   internalTask:order.internalTask,changes:(order.changes||[]).map(change=>({status:change.status})),
   entries:has('money.view')&&has('finance.view')?(order.entries||[]).map(({type,quantity,rate,cost})=>({type,quantity,rate,cost})):[],
   invoice:has('money.view')&&has('finance.view')&&order.invoice?{status:order.invoice.status,amountPaid:order.invoice.amountPaid,depositCredit:order.invoice.depositCredit}:undefined,
   closeout:order.closeout?{reviewedAt:order.closeout.reviewedAt}:null}));

 // Show the effective profile's name in job views without exposing its rules.
 const label = (order, project, client) => {
  const {profile, scope} = assignedPricing(current, order, project, client);
  return {id:profile?.id, name:profile?.name || 'Existing rates', scope};
 };
 for (const project of state.projects) project.effectivePricing = label(null, current.projects.find(item => item.id === project.id), current.customers.find(client => client.id === project.customerId));
 for (const order of state.workorders) {
  const project = current.projects.find(item => item.id === order.projectId);
  order.effectivePricing = label(order, project, current.customers.find(client => client.id === project?.customerId));
 }

 if(has('workorder.create'))for(const project of state.projects){
  const client=current.customers.find(item=>item.id===project.customerId);
  project.pricingChoices=clientPricingChoices(current,client).map(({id,name})=>({id,name}));
 }
 if(has('inventory.view'))state.inventory=stockProjection(current);
 if(!has('inventory.view')){state.inventory=[];state.movements=[];}
 if(has('inventory.view')){
  const sourceIds=new Set(has('workorders.view')&&has('receipt.read')?current.workorders.map(order=>order.id):[]);
  if(role==='admin'&&has('workorders.view')&&has('receipt.read'))
   for(const row of current.trash||[])if(row.kind==='workorder')sourceIds.add(row.record.id);
  for(const move of state.movements){
   if(move.type==='field-purchase'&&!sourceIds.has(move.sourceWorkorderId)){
    delete move.sourceWorkorderId;delete move.sourceWorkorderTitle;delete move.warehouseReceiptId;
   }else if(move.type==='receive'&&!has('inventory.receive'))delete move.warehouseReceiptId;
  }
 }
 if(!has('finance.view')||!has('inventory.view')&&!has('reports.view'))state.purchases=[];
 else for(const purchase of state.purchases){delete purchase.warehouseFingerprint;delete purchase.warehouseSubmissionId;}
 if(!has('pricing.view')&&!has('inventory.view')&&!has('workorders.view')&&!has('reports.view'))state.catalog=[];
 if(!has('pricing.view')&&!has('inventory.view')&&!has('estimates.view')&&(!has('workorders.view')||!has('entry.add')))delete state.catalogFitReferences;
 if(has('reports.view')&&!has('pricing.view')&&!has('inventory.view')&&!has('workorders.view'))
  state.catalog=state.catalog.map(item=>({id:item.id,name:item.name,type:item.type}));
 if(!has('payroll.view'))delete state.payrollRuns;
 delete state.staffProfiles;delete state.staffLeave;delete state.businessManager;delete state.technicianJobCosts;
 delete state.payrollOther;delete state.activeClocks;delete state.clockDefaults;
 if(!has('finance.view')||!has('invoices.view'))delete state.projectInvoices;
 if(role!=='admin'){
  delete state.users;delete state.permissionProfiles;delete state.events;delete state.trash;
 }
 for(const order of state.workorders)for(const entry of order.entries||[]){
  if(['labor','travel'].includes(entry.type))entry.payrollLocked=(current.payrollRuns||[]).some(run=>entry.date>=run.start&&entry.date<=run.end);
 }
 if(role!=='admin')for(const order of state.workorders)delete order.entryHistory;
 if(!has('finance.view')||!has('invoices.view')&&!has('money.view'))for(const p of state.projects)delete p.depositLedger;
 if(!has('finance.view')){
  // Strip nested costs, including immutable closeout snapshots and invoice summaries.
  const costFields=new Set(['cost','unitCost','directCost','grossProfit','reserve','quickBooksPurchasePrice']);
  const redact=value=>{
   if(!value||typeof value!=='object')return;
   for(const key of Object.keys(value)){
    if(costFields.has(key))delete value[key];
    else redact(value[key]);
   }
  };
  redact(state);
  for(const order of state.workorders)if(order.invoice)order.invoice={status:order.invoice.status};
 }
 return state;
}
