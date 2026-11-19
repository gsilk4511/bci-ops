import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction,invoiceFor,seed} from '../Models/lib.js';
import {deposits} from '../Models/project-workflow.js';
import {visibleState} from '../Models/visibility.js';
const admin={email:'owner@example.invalid',role:'admin',permissions:['finance.view','invoice.group']};
function reviewed(order) {
 order.closeout={at:'2026-11-19',reviewedAt:'2026-11-19'};
 order.entries=[{id:'test',type:'labor',date:'2026-11-19',name:'Labor',quantity:2,rate:80,cost:25}];
 order.status='reviewed';
 return order;
}
test('project deposit, progress, closeout blocker, final and reopen do not rebill earlier work',()=>{
 const s=seed(),p=s.projects[0],w=reviewed(s.workorders[0]),go=(a,v)=>applyAction(s,a,v,admin);
 for(const kind of ['requested','received'])go('billing.deposit',{projectId:p.id,kind,amount:80,reference:'DEP-01'});
 assert.throws(()=>go('billing.deposit',{projectId:p.id,kind:'received',amount:80,reference:'DEP-01'}),/already recorded/);
 const invoice=(ids,ref,stage,credit)=>go('invoice.group',{workorderIds:ids,number:ref,layout:'totals',billingStage:stage,depositCredit:credit});
 assert.throws(()=>invoice([w.id],'P-00','final',0),/Close the project/);
 const earlier=invoice([w.id],'P-01','progress',65);
 assert.equal(p.closedAt,undefined);assert.equal(earlier.depositCredit,65);assert.equal(invoiceFor(s,w).total,95);
 assert.equal(deposits(p).remaining,15);
 go('invoice.pay',{workorderId:w.id,amount:95});assert.equal(w.invoice.status,'paid');
 const future=reviewed(go('workorder.create',{projectId:p.id,description:'Fiber'}));
 const closeout=go('workorder.create',{projectId:p.id,description:'Documentation'});
 closeout.internalTask=true;closeout.requiredForFinalBilling=true;
 go('project.close',{projectId:p.id});
 assert.throws(()=>invoice([future.id],'P-02','final',0),/Complete and review/);
 reviewed(closeout);
 assert.throws(()=>invoice([closeout.id],'P-02','final',0),/Select reviewed/);
 assert.throws(()=>invoice([future.id],'P-02','final',16),/exceeds/);
 assert.equal(deposits(p).remaining,15);
 assert.equal(invoice([future.id],'P-02','final',15).billingStage,'final');
 assert.equal(deposits(p).remaining,0);
 go('workorder.create',{projectId:p.id,description:'Additional requested scope'});
 assert.ok(!p.closedAt&&p.reopenedAt);
 assert.equal(w.invoice.groupId,earlier.id);
 go('project.close',{projectId:p.id});
 assert.throws(()=>invoice([future.id],'P-03','final',0),/Select reviewed/);
 const view=visibleState(s,'tech',['projects.view']);
 assert.equal(view.projects[0].depositLedger,undefined);
});
test('internal work creates no customer bill and cannot invoice',()=>{
 const s=seed();
 s.customers[0].name='Randy Bevins';s.projects[0].name='BCI ELITE ADMIN';
 const w=reviewed(applyAction(s,'workorder.create',{projectId:s.projects[0].id,description:'Organize inventory'},admin));
 assert.equal(w.internalTask,true);
 assert.equal(invoiceFor(s,w).total,0);
 assert.throws(()=>applyAction(s,'invoice.record',{workorderId:w.id,number:'X'},admin),/uninvoiced/);
});
