import test from 'node:test';
import assert from 'node:assert/strict';
import {printJournalEntries} from '../public/modules/work-order-journal.js';
import {payrollPreview} from '../Models/payroll.js';
import {seed,applyAction,invoiceFor,moneyStats} from '../Models/lib.js';
const signatureData='data:image/png;base64,'+Buffer.from(Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(400,7)])).toString('base64');
const signed={signatureData,consent:true};
test('requires customer approval, records entries, allows negative stock and invoices manually',()=>{
const s=seed(), w=s.workorders[0];
assert.throws(()=>applyAction(s,'entry.add',{workorderId:w.id,type:'labor',catalogId:'cat_3',tech:'Simon',quantity:8,description:'Pulled cable'}),/signoff/);
applyAction(s,'workorder.approve',{workorderId:w.id,signedBy:'Demo Customer',...signed});
const change=applyAction(s,'change.create',{workorderId:w.id,category:'add',description:'Additional network drops',lines:[{catalogId:'cat_2',quantity:6},{catalogId:'cat_3',quantity:3}]});
assert.equal(change.estimatedTotal,6*24+3*115);
assert.throws(()=>applyAction(s,'workorder.close',{workorderId:w.id,submittedBy:'Simon'}),/pending changes/);
applyAction(s,'change.approve',{workorderId:w.id,changeId:change.id,signedBy:'Approver Example',...signed});
applyAction(s,'entry.add',{workorderId:w.id,type:'material',catalogId:'cat_2',tech:'Simon',quantity:6,location:'Shop',description:'Used six jacks'});
assert.equal(s.inventory.find(x=>x.catalogId==='cat_2').quantity,-2);
applyAction(s,'entry.add',{workorderId:w.id,type:'labor',catalogId:'cat_3',tech:'Simon',quantity:8,description:'Cable pulls',date:'2026-11-05'});
assert.equal(invoiceFor(s,w).total,6*19+8*95);
applyAction(s,'workorder.close',{workorderId:w.id,submittedBy:'Simon'});
assert.equal(w.closeout.originalEntries.length,2);
assert.equal(moneyStats(s).unbilled,874);
applyAction(s,'workorder.review',{workorderId:w.id},{email:'admin@example.com'});
applyAction(s,'invoice.record',{workorderId:w.id,number:'QB-TEST-001'});
assert.equal(moneyStats(s).outstanding,874);
applyAction(s,'invoice.pay',{workorderId:w.id,amount:300});
assert.equal(moneyStats(s).outstanding,574);
applyAction(s,'invoice.pay',{workorderId:w.id,amount:574});
assert.equal(moneyStats(s).paid,874);
});
test('inventory receipt records purchase',()=>{
const s=seed();applyAction(s,'inventory.receive',{catalogId:'cat_2',quantity:3,location:'Shop',vendor:'Supplier',unitCost:6.5,card:'Company card'});assert.equal(s.inventory[0].quantity,7);assert.equal(s.purchases[0].unitCost,6.5);
});

test('signed approval requires drawing and explicit consent',()=>{
const s=seed(),w=s.workorders[0];
assert.throws(()=>applyAction(s,'workorder.approve',{workorderId:w.id,signedBy:'Someone'}),/signature/);
assert.throws(()=>applyAction(s,'workorder.approve',{workorderId:w.id,signedBy:'Someone',signatureData}),/accept/);
assert.equal(applyAction(s,'workorder.approve',{workorderId:w.id,signedBy:'Someone',...signed},{email:'simon@example.com'}).recordedBy,'simon@example.com');
});
test('new catalog item, transfer and negative inventory audit',()=>{
const s=seed();const item=applyAction(s,'catalog.create',{group:'Fiber',name:'LC connector',type:'material',unit:'ea',price:28,changePrice:35,cost:5});
assert.match(item.sku,/BCI-/);
applyAction(s,'inventory.transfer',{catalogId:item.id,from:'Shop',to:'Truck',quantity:3},{email:'admin@example.com'});
assert.equal(s.inventory.find(i=>i.catalogId===item.id&&i.location==='Shop').quantity,-3);
assert.equal(s.inventory.find(i=>i.catalogId===item.id&&i.location==='Truck').quantity,3);
applyAction(s,'inventory.adjust',{catalogId:item.id,location:'Shop',quantity:3,reason:'Missing receipt audit'});
assert.equal(s.inventory.find(i=>i.catalogId===item.id&&i.location==='Shop').quantity,0);
});
import {crewSummary} from '../Models/lib.js';
test('overlapping timestamps form separate two- and three-person crew blocks',()=>{
 const rows=[
 {type:'labor',date:'2026-11-05',catalogId:'cat_3',tech:'Simon',startTime:'08:00',endTime:'12:00'},
 {type:'labor',date:'2026-11-05',catalogId:'cat_3',tech:'Alex',startTime:'08:00',endTime:'12:00'},
 {type:'labor',date:'2026-11-05',catalogId:'cat_3',tech:'Pat',startTime:'10:00',endTime:'12:00'}];
 const out=crewSummary(rows);
 assert.deepEqual(out.map(x=>[x.crewSize,x.crewHours]),[[2,2],[3,2]]);
});

test('journal note corrections preserve submitted entries and grouped invoice descriptions',()=>{
 const state=seed(),order=state.workorders[0],actor={email:'office@example.invalid'};
 applyAction(state,'workorder.approve',{workorderId:order.id,signedBy:'Demo Customer',...signed},actor);
 const entry=applyAction(state,'entry.add',{workorderId:order.id,type:'labor',catalogId:'cat_3',quantity:2,description:'Original dictation'},actor);
 const edit={workorderId:order.id,entryId:entry.id,note:'Corrected wording',revision:''};
 applyAction(state,'entry.editNote',edit,actor);
 applyAction(state,'workorder.close',{workorderId:order.id,submittedBy:'Tech'},actor);
 applyAction(state,'workorder.review',{workorderId:order.id},actor);
 const invoice=applyAction(state,'invoice.group',{workorderIds:[order.id],number:'QA-NOTE',layout:'itemized'},actor);
 assert.equal(invoice.orders[0].entries[0].description,'Original dictation');
 assert.throws(()=>applyAction(state,'entry.editNote',edit,actor),/changed/);
 assert.equal(printJournalEntries(order)[0].description,'Corrected wording');
 const prior=JSON.stringify(invoice),closeout=JSON.stringify(order.closeout);
 state.payrollRuns=[{start:entry.date,end:entry.date}];
 applyAction(state,'entry.editNote',{...edit,note:'Final correction',revision:entry.journalNoteRevision},actor);
 assert.equal(entry.journalNote,'Final correction');
 assert.equal(printJournalEntries(order)[0].description,'Final correction');
 assert.equal(JSON.stringify(invoice),prior);
 assert.equal(JSON.stringify(order.closeout),closeout);
 assert.equal(entry.quantity,2);
 assert.equal(order.closeout.originalEntries[0].description,'Original dictation');
 assert.equal(invoice.orders[0].entries[0].description,'Original dictation');
});

test('shared travel records both employees for payroll without a second billable charge',()=>{
 const state=seed(),order=state.workorders[0],first={email:'driver@example.invalid'},second={email:'rider@example.invalid'};
 const base={workorderId:order.id,type:'travel',catalogId:'cat_5',date:'2026-11-11',startTime:'08:00',endTime:'09:00',description:'Travel'
 };
 applyAction(state,'workorder.approve',{workorderId:order.id,signedBy:'Demo Customer',...signed},first);
 const charge=applyAction(state,'entry.add',base,first);
 const shared=applyAction(state,'entry.add',{...base,description:'Rode with driver',sharedTravel:true},second);
 assert.equal(charge.rate,65);
 assert.equal(shared.quantity,1);
 assert.equal(shared.rate,0);
 assert.equal(invoiceFor(state,order).total,65);
 assert.equal(shared.cost,20);
 assert.deepEqual(payrollPreview(state,base.date,base.date).rows.map(row=>row.travel),[1,1]);
 applyAction(state,'workorder.close',{workorderId:order.id},first);
 applyAction(state,'workorder.review',{workorderId:order.id},first);
 assert.equal(printJournalEntries(order).length,2);
 const invoice=applyAction(state,'invoice.group',{workorderIds:[order.id],number:'SHARED-1',layout:'itemized'},first);
 assert.deepEqual(invoice.orders[0].entries.map(row=>row.id),[charge.id]);
 assert.equal(order.entries.length,2);
});
