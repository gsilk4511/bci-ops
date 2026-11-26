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
 const charge=applyAction(state,'entry.add',{...base,sharedTravel:false,travelBilling:'hourly'},first);
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

test('travel rate is chosen explicitly; the vehicle charge and logged payroll hours stay separate through billing',async()=>{
 const {entryCharge}=await import('../public/modules/work-entry-charge.js');
 const {moneyWorkOrderRows}=await import('../Models/lib.js');
 const {repriceOpenOrders}=await import('../Models/pricing.js');
 const s=seed(),w=s.workorders[0],date='2026-11-11';
 const driver={email:'driver@example.test'}, rider={email:'rider@example.test'};
 const base={workorderId:w.id,type:'travel',catalogId:'cat_5',date,quantity:2.5,description:'Actual travel'};
 applyAction(s,'workorder.approve',{workorderId:w.id,signedBy:'Demo Customer',...signed},driver);
 assert.throws(()=>applyAction(s,'entry.add',base,driver),/Yes or No/);
 assert.throws(()=>applyAction(s,'entry.add',{...base,sharedTravel:false},driver),/base trip or hourly/);
 assert.throws(()=>applyAction(s,'entry.add',{...base,sharedTravel:true,travelBilling:'trip'},rider),/no.*client charge|cannot have/);
 const first=applyAction(s,'entry.add',{...base,sharedTravel:false,travelBilling:'trip'},driver);
 const passenger=applyAction(s,'entry.add',{...base,sharedTravel:true},rider);
 const hourly=applyAction(s,'entry.add',{...base,quantity:1.25,sharedTravel:false,travelBilling:'hourly',travelCharge:'72.50'},driver);
 const second=applyAction(s,'entry.add',{...base,quantity:.75,sharedTravel:false,travelBilling:'trip',travelCharge:'150.25'},driver);
 assert.deepEqual([first,passenger,hourly,second].map(row=>[row.quantity,entryCharge(row)]),[[2.5,120],[2.5,0],[1.25,90.63],[.75,150.25]]);
 assert.deepEqual(payrollPreview(s,date,date).rows.map(row=>row.travel),[4.5,2.5]);
 assert.equal(invoiceFor(s,w).travel,360.88);
 assert.equal(moneyWorkOrderRows(s)[0].travel,360.88);
 s.catalog.find(item=>item.id==='cat_5').price=75;
 repriceOpenOrders(s,{catalogId:'cat_5'});
 assert.equal(invoiceFor(s,w).travel,360.88);
 applyAction(s,'workorder.close',{workorderId:w.id},driver);
 applyAction(s,'workorder.review',{workorderId:w.id},driver);
 const inv=applyAction(s,'invoice.group',{workorderIds:[w.id],number:'TRIP-1',layout:'itemized'},driver);
 assert.deepEqual(inv.orders[0].entries.map(row=>[row.quantity,entryCharge(row)]),[[2.5,120],[1.25,90.63],[.75,150.25]]);
 assert.equal(inv.orders[0].entries[0].travelBilling,'trip');
 assert.equal(entryCharge({type:'travel',quantity:2,rate:65}),130);
});

test('travel selections do not replace a signed change-order rate or accept an invalid override',()=>{
 const s=seed(),w=s.workorders[0],actor={email:'driver@example.test'};
 applyAction(s,'workorder.approve',{workorderId:w.id,signedBy:'Demo Customer',...signed},actor);
 w.changes=[{id:'signed-travel',status:'approved',lines:[{catalogId:'cat_5',rate:85}]}];
 const base={workorderId:w.id,type:'travel',catalogId:'cat_5',date:'2026-11-11',quantity:2,sharedTravel:false,description:'Drive to site'};
 assert.throws(()=>applyAction(s,'entry.add',{...base,travelBilling:'trip',travelCharge:'90.123'},actor),/dollars and cents/);
 assert.throws(()=>applyAction(s,'entry.add',{...base,travelBilling:'trip',changeId:'signed-travel'},actor),/approved hourly/);
 assert.throws(()=>applyAction(s,'entry.add',{...base,travelBilling:'hourly',travelCharge:'90',changeId:'signed-travel'},actor),/approved/);
 const trip=applyAction(s,'entry.add',{...base,travelBilling:'hourly',changeId:'signed-travel'},actor);
 assert.equal(trip.rate,85);
});

test('itemized invoice presents a flat travel charge as one trip, while legacy travel still shows billable hours',async()=>{
 const vm=await import('node:vm');if(!vm.SourceTextModule)return;
 const {readFileSync}=await import('node:fs');
 const context=vm.createContext({});
 const appExports={esc:String,fmt:n=>'$'+n.toFixed(2),hoursLabel:String,roundMoney:n=>Math.round(n*100)/100,
  customer:()=>null,detail:()=>'',project:()=>null,table:(_heading,rows)=>rows.join('')};
 const app=new vm.SyntheticModule(Object.keys(appExports),function(){for(const [key,value] of Object.entries(appExports))this.setExport(key,value);},{context});
 const read=name=>new vm.SourceTextModule(readFileSync(new URL('../public/modules/'+name,import.meta.url),'utf8'),{context});
 const doc=read('invoice-document.js'), charge=read('work-entry-charge.js');
 await doc.link(name=>name==='../app.js'?app:charge);await doc.evaluate();
 const html=doc.namespace.invoiceDocument({number:'DEMO',layout:'itemized',orders:[{title:'Test',crew:[],entries:[
  {type:'travel',name:'Base trip',quantity:2.5,unit:'hr',rate:120,travelBilling:'trip'},
  {type:'travel',name:'Earlier travel',quantity:2,unit:'hr',rate:65}
 ]}]});
 assert.match(html,/1 trip<\/td>\s*<td>\$120\.00 \/ trip<\/td><td>\$120\.00/);
 assert.match(html,/2 hr<\/td>\s*<td>\$65\.00<\/td><td>\$130\.00/);
 assert.match(html,/<strong>\$250\.00<\/strong>/);
});

test('printed Original Field Journal sorts across types without rewriting closeout or corrected notes',()=>{
 const entries=[
  {id:'time',type:'labor',date:'2026-11-21',description:'Old in snapshot'},
  {id:'trip',type:'travel',date:'2026-11-14',description:'Trip'},
  {id:'part',type:'material',date:'2026-11-17',description:'Part'}
 ];
 const order={entries:[{...entries[0],journalNote:'Corrected description'},...entries.slice(1)]};
 const openPrint=printJournalEntries(order);
 assert.deepEqual(openPrint.map(e=>e.id),['trip','part','time']);
 order.closeout={originalEntries:entries};
 const before=JSON.stringify(order);
 const closedPrint=printJournalEntries(order);
 assert.deepEqual(closedPrint.map(({id,date,description})=>[id,date,description]),openPrint.map(({id,date,description})=>[id,date,description]));
 assert.equal(closedPrint[2].description,'Corrected description');
 assert.equal(JSON.stringify(order),before);
});
