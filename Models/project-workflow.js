import {randomUUID} from 'node:crypto';
const amount=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const text=(value,max)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
export function internalProject(state,p){
 const c=state.customers.find(c=>c.id===p?.customerId);
 return !!p&&p.name.trim().toLowerCase()==='bci elite admin'&&[c?.name,c?.business].some(n=>n?.trim().toLowerCase()==='randy bevins');
}
export const internalOrder=(state,w)=>!!w.internalTask||internalProject(state,state.projects.find(p=>p.id===w.projectId));
export function projectWorkflow(state,action,data,actor){
 const p=state.projects.find(p=>p.id===data.projectId);
 if(!p)throw Error('Project not found');
 if(action==='project.close'){
  if(!p.closedAt){p.closedAt=now();p.closedBy=actor.email;}
 }else if(action==='project.followup'){
  const due=text(data.followUpDue,10);
  if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))throw Error('Enter a valid follow-up date');
  p.nextStep=text(data.nextStep,500);p.followUpDue=due;
 }else if(action==='billing.deposit'){
  if(internalProject(state,p))throw Error('Internal projects cannot take deposits');
  const value=amount(data.amount),kind=data.kind,reference=text(data.reference,120);
  if(!Number.isFinite(value)||value<=0||value>1e8||!reference||!['requested','received'].includes(kind))throw Error('Enter a positive amount and QuickBooks or payment reference');
  const ledger=(p.depositLedger??=[]);
  if(ledger.some(e=>e.kind===kind&&e.reference.toLowerCase()===reference.toLowerCase()))throw Error('Reference already recorded');
  ledger.push({id:randomUUID(),kind,amount:value,reference,at:now(),by:actor.email});
 }else throw Error('Unknown workflow action');
 return p;
}
export function deposits(project){
 const ledger=project?.depositLedger||[];
 const total=kind=>amount(ledger.filter(e=>e.kind===kind).reduce((s,e)=>s+e.amount,0));
 const requested=total('requested'),received=total('received'),applied=total('applied');
 return {requested,received,applied,remaining:amount(received-applied)};
}
export function applyDepositCredit(project,orders,raw,number,actor,grossFor){
 const credit=amount(raw||0);
 if(!Number.isFinite(credit)||credit<0||credit>deposits(project).remaining||credit>amount(orders.reduce((sum,w)=>sum+grossFor(w),0)))throw Error('Deposit credit exceeds the available deposit or invoice total');
 if(credit)(project.depositLedger??=[]).push({id:randomUUID(),kind:'applied',amount:credit,reference:number,at:now(),by:actor.email});
 let remaining=credit;
 return Object.fromEntries(orders.map(order=>{
  const used=amount(Math.min(remaining,Math.max(0,grossFor(order))));
  remaining=amount(remaining-used);
  return [order.id,used];
 }));
}
export function verifyFinalBilling(state,p,orders,kind){
 if(kind!=='final'&&kind!=='progress')throw Error('Invalid billing stage');
 if(kind==='progress'){if(p.closedAt)throw Error('Use final billing on a closed project');return;}
 if(!p.closedAt)throw Error('Close the project before recording the final invoice');
 const job=state.workorders.filter(w=>w.projectId===p.id);
 if(job.some(w=>w.requiredForFinalBilling&&!w.closeout?.reviewedAt))throw Error('Complete and review the closeout work order before final billing');
 if(job.some(w=>!internalOrder(state,w)&&!w.invoice&&!orders.includes(w)))throw Error('Include all remaining billable work orders before final billing');
}
