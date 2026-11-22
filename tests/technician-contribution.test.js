import test from 'node:test';
import assert from 'node:assert/strict';
import {technicianContribution,nearestDecemberFriday} from '../Models/technician-contribution.js';
const a='tech1@example.test',b='tech2@example.test';
const line=(id,type,quantity,rate,employeeEmail)=>({id,type,quantity,rate,employeeEmail,date:'2026-01-01',unit:type==='material'?'ea':'hr'});
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

test('only own invoiced labor and date-effective loaded wages enter the Eastern calendar-year projection',()=>{
 const state=fixture();
 const sentAt='2026-01-01T05:00:00.000Z'; // midnight Eastern
 state.projectInvoices[0].sentAt=sentAt;
 state.workorders[0].invoice.sentAt=sentAt;
 const options={year:2026,profitShareBps:1500,wageHistory:[{effectiveDate:'2025-01-01',hourlyCents:3800},{effectiveDate:'2026-01-01',hourlyCents:4000},{effectiveDate:'2026-02-01',hourlyCents:9000}],
  now:new Date('2026-12-24T20:00:00Z')};
 const result=technicianContribution(state,a,options);
 assert.equal(result.totalAttributedCents,10000);
 assert.equal(result.totalEmploymentCostCents,5000);
 assert.equal(result.totalNetProfitCents,5000);
 assert.equal(result.projects[0].netProfitCents,5000);
 assert.deepEqual(result.bonus,{status:'available',profitShareBps:1500,projectedCents:750,year:2026,payoutDate:'2026-12-18'});
 const missing=technicianContribution(state,a,{...options,wageHistory:[{effectiveDate:'2026-02-01',hourlyCents:4000}]});
 assert.equal(missing.totalAttributedCents,10000);
 assert.equal(missing.coverage.missingWageOrders,1);
 assert.equal(missing.coverage.missingCostOrders,1);
 assert.equal(missing.totalEmploymentCostCents,null);
 assert.equal(missing.totalNetProfitCents,null);
 assert.equal(missing.bonus.projectedCents,null);
 const limited=technicianContribution(state,a,{...options,scopeIncomplete:true});
 assert.equal(limited.status,'partial');
 assert.equal(limited.coverage.scopeIncomplete,true);
 assert.equal(limited.bonus.projectedCents,null);
 const midnightBoundary='2026-01-01T04:59:59.000Z'; // still previous year Eastern
 state.projectInvoices[0].sentAt=midnightBoundary;
 state.workorders[0].invoice.sentAt=midnightBoundary;
 assert.equal(technicianContribution(state,a,options).totalAttributedCents,null);
});

test('losses offset gains before bonus, explicit zeros work, and payout target does not cut off year',()=>{
 const state=fixture();
 const add=(order,group,sentAt,entries)=>{
  state.workorders.push({id:order,projectId:'project',entries,closeout:{reviewedAt:sentAt},invoice:{groupId:group,number:group,status:'paid',sentAt}});
  state.projectInvoices.push({id:group,projectId:'project',number:group,sentAt,orders:[{id:order,entries}]});
 };
 state.projectInvoices[0].sentAt='2026-12-10T10:00:00.000Z';
 state.workorders[0].invoice.sentAt=state.projectInvoices[0].sentAt;
 // The ledger keeps accruing after the target, with no financial action scheduled by this model.
 add('after','after-invoice','2026-12-22T10:00:00.000Z',[{...line('after-entry','labor',1,10,a),date:'2026-12-22'}]);
 add('future','future-invoice','2026-12-30T10:00:00.000Z',[line('future-entry','labor',1,100,a)]);
 const options={year:2026,profitShareBps:3000,wageHistory:[{effectiveDate:'2026-01-01',hourlyCents:0},{effectiveDate:'2026-12-22',hourlyCents:10400}],
  now:new Date('2026-12-23T10:00:00Z')};
 const result=technicianContribution(state,a,options);
 assert.equal(result.totalAttributedCents,11000);
 assert.equal(result.totalEmploymentCostCents,13000);
 assert.equal(result.totalNetProfitCents,-2000);
 assert.equal(result.bonus.projectedCents,0);
 const unconfigured=technicianContribution(state,a,{...options,profitShareBps:null});
 assert.equal(unconfigured.totalNetProfitCents,-2000);
 assert.equal(unconfigured.bonus.profitShareBps,500);
 assert.equal(unconfigured.bonus.projectedCents,0);
});

test('annual nearest Friday can fall before, on, or after December 15',()=>{
 assert.equal(nearestDecemberFriday(2026),'2026-12-18');
 assert.equal(nearestDecemberFriday(2027),'2027-12-17');
 assert.equal(nearestDecemberFriday(2028),'2028-12-15');
 assert.equal(nearestDecemberFriday(2029),'2029-12-14');
 assert.equal(nearestDecemberFriday('2026'),null);
});

test('linked finalized work with a missing invoice date is not silently treated as fully covered',()=>{
 const state=fixture();
 delete state.workorders[0].invoice.sentAt;
 const projection=technicianContribution(state,a,{year:2026,profitShareBps:500,wageHistory:[]});
 assert.equal(projection.coverage.excludedOrders,1);
 assert.equal(projection.bonus.projectedCents,null);
});


test('default five percent is configurable by year and explicit zero is not replaced',()=>{
 const state=fixture(), sentAt='2026-10-10T17:00:00Z';
 state.projectInvoices[0].sentAt=state.workorders[0].invoice.sentAt=sentAt;
 const options={year:2026,now:new Date('2026-11-01T00:00:00Z'),wageHistory:[{effectiveDate:'2026-01-01',hourlyCents:2400}]};
 assert.equal(technicianContribution(state,a,options).bonus.projectedCents,350);
 assert.equal(technicianContribution(state,a,{...options,profitShareBps:0}).bonus.profitShareBps,0);
 assert.equal(technicianContribution(state,a,{...options,profitShareBps:0}).bonus.projectedCents,0);
 assert.equal(technicianContribution(state,a,{...options,wageHistory:[...options.wageHistory,...options.wageHistory]}).bonus.projectedCents,null);
});

test('standalone billed labor requires an exact reviewed closeout and a unique ungrouped reference',()=>{
 const state=fixture();
 const wo=state.workorders[0],sentAt='2026-02-23T10:00:00Z';
 delete wo.invoice.groupId;
 wo.invoice.sentAt=sentAt;
 state.projectInvoices=[];
 wo.closeout.originalEntries=structuredClone(wo.entries);
 const options={year:2026,now:new Date('2026-04-01T00:00:00Z'),wageHistory:[{effectiveDate:'2026-01-01',hourlyCents:2400}]};
 assert.equal(technicianContribution(state,a,options).totalAttributedCents,10000);
 assert.equal(technicianContribution(state,a,options).bonus.projectedCents,350);
 const snapshot=structuredClone(state);
 for(const alter of [
  s=>{s.workorders[0].closeout.originalEntries[0].rate=222;},
  s=>{s.workorders[0].closeout.originalEntries.push(s.workorders[0].closeout.originalEntries[0]);},
  s=>{s.workorders[0].closeout.originalEntries[0].employeeEmail=b;},
  s=>{s.workorders.push({...structuredClone(s.workorders[0]),id:'duplicate'});},
  s=>{s.projectInvoices.push({id:'unrelated',number:'unrelated',orders:[{id:'wo'}]});},
 ]){
  const other=structuredClone(snapshot);
  alter(other);
  assert.equal(technicianContribution(other,a,options).bonus.projectedCents,null);
 }
});
