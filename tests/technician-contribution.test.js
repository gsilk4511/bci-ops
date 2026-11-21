import test from 'node:test';
import assert from 'node:assert/strict';
import {technicianContribution} from '../Models/technician-contribution.js';
const a='tech1@example.test',b='tech2@example.test';
const line=(id,type,quantity,rate,employeeEmail)=>({id,type,quantity,rate,employeeEmail,unit:type==='material'?'ea':'hr'});
const labor=[line('one','labor',1,100,a),line('two','labor',3,100,b)];
function fixture(){
 const entries=[...labor,line('material','material',1,300,a),line('travel','travel',2,50,a)];
 const order={id:'wo',projectId:'project',entries,closeout:{reviewedAt:'today'},invoice:{groupId:'inv',number:' 123 ',status:'sent',sentAt:'today',depositCredit:300}};
 const invoice={id:'inv',number:'123',projectId:'project',sentAt:'today',depositCredit:300,orders:[{id:order.id,entries:entries.map(({employeeEmail,...row})=>row)}]};
 return {workorders:[order],projectInvoices:[invoice],projects:[{id:'project',name:'Commercial job',customerId:'client'}],customers:[{id:'client',name:'Commercial account'}]};
}
test('allocates grouped billed contribution before deposit, only by labor hours, per work order',()=>{
 const state=fixture();
 const result=technicianContribution(state,a);
 assert.equal(result.status,'available');
 assert.equal(result.totalAttributedCents,20000);
 assert.deepEqual(result.projects,[{projectId:'project',attributedCents:20000,laborHours:1,totalLaborHours:4,orderCount:1}]);
 assert.equal(technicianContribution(state,b).totalAttributedCents,60000);
 assert.equal(result.profit,null);
 assert.equal(result.employmentCost,null);
 assert.equal(technicianContribution(state,'travel-only@example.test').totalAttributedCents,null);
});
test('keeps anonymous labor in the denominator, never matching a legacy display name',()=>{
 const state=fixture();
 state.workorders[0].entries[1]={...state.workorders[0].entries[1],tech:b,employeeEmail:undefined};
 const result=technicianContribution(state,a);
 assert.equal(result.status,'partial');
 assert.equal(result.totalAttributedCents,20000);
 assert.equal(result.coverage.unlinkedLaborOrders,1);
 assert.equal(technicianContribution(state,b).totalAttributedCents,null);
});
test('does not count duplicates, voided billing, unsnapshotted legacy invoices, or internal jobs',()=>{
 for(const tweak of [
  s=>s.projectInvoices.push({...s.projectInvoices[0],id:'duplicate',number:'123'}),
  s=>s.workorders.push({...s.workorders[0]}),
  s=>s.projectInvoices[0].orders.push({...s.projectInvoices[0].orders[0]}),
  s=>s.projectInvoices[0].voidedAt='today',
  s=>delete s.workorders[0].invoice.groupId,
  s=>s.workorders[0].internalTask=true,
  s=>s.workorders[0].invoice.status='draft',
  s=>s.workorders[0].entries=s.workorders[0].entries.map(x=>({...x,quantity:x.quantity+1})),
 ]){
  const state=fixture();tweak(state);
  assert.equal(technicianContribution(state,a).totalAttributedCents,null);
 }
});
test('separates project totals from work orders the technician did not work and excludes explicit tax/deposit lines',()=>{
 const state=fixture();
 const invoice=state.projectInvoices[0];
 invoice.orders[0].entries.push(line('tax','tax',1,30),line('deposit','deposit',1,30));
 const other={...state.workorders[0],id:'other-wo',entries:[line('only','labor',8,275,b)]};
 state.workorders.push(other);
 invoice.orders.push({id:other.id,entries:other.entries});
 assert.equal(technicianContribution(state,a).totalAttributedCents,20000);
 assert.equal(technicianContribution(state,b).totalAttributedCents,280000);
});
