import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {estimateRates} from '../Models/estimates.js';
import {normalizeEstimateScopes,scopeLines} from '../public/modules/estimate-scope-math.js';

const copper={key:'office',kind:'copper',building:'Office',access:'Open ceiling',category:'Cat6',cableType:'Plenum',jack:'Cat6 Example',
 drops:60,avgLength:100,boxLength:1000,waste:10,jacksPerDrop:1,portsPerPlate:2,portsPerPanel:24,hoursPerDrop:2,cableId:'cat-box',jackId:'cat_2',laborId:'cat_3'};
const fiber={key:'backbone',kind:'fiber',route:'MDF to IDF',fiberType:'OS2',endA:'LC',endB:'LC',testing:'Tier 1 + label',length:500,strands:12,terminatedPerEnd:12,hours:20,fiberId:'fiber-ft',laborId:'cat_4'};
const lift={key:'shared-lift',kind:'lift',label:'Scissor lift',rateMode:'daily',days:2,daily:300,delivery:60,pickup:40,markup:10,requirements:'Confirm delivery window'};
const fakePng='data:image/png;base64,'+Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(200)]).toString('base64');
function fixture(){
 const state=seed(),clientId=state.customers[0].id,projectId=state.projects[0].id;
 state.catalog.push({id:'cat-box',type:'material',unit:'box',name:'Cat6 UTP',price:200,cost:99},{id:'fiber-ft',type:'material',unit:'ft',name:'OS2 fiber',price:1.5,cost:1});
 return {state,clientId,projectId};
}
const actor={email:'office@example.invalid'};
const linesFor=scopes=>scopeLines(normalizeEstimateScopes(scopes)).map(line=>({...line,rate:line.rate??(line.catalogId?null:10)}));
test('calculates combined takeoff with one shared uplift and validates scope assumptions',()=>{
 const rows=linesFor([copper,fiber,lift]);
 assert.equal(rows.find(line=>line.catalogId==='cat-box').quantity,7);
 assert.equal(rows.find(line=>line.catalogId==='cat_3').quantity,120);
 assert.equal(rows.find(line=>line.catalogId==='cat_2').quantity,60);
 assert.equal(rows.find(line=>line.catalogId==='fiber-ft').quantity,500);
 assert.deepEqual(rows.filter(line=>line.scopeKey==='shared-lift').map(line=>[line.quantity,line.rate,line.inputCost]),[[1,770,700]]);
 assert.throws(()=>linesFor([{...fiber,terminatedPerEnd:13}]),/exceed/);
 assert.throws(()=>linesFor([{...copper,jack:'Cat6A Example'}]),/rated/);
 const {state,clientId,projectId}=fixture();
 assert.ok(!('cost' in estimateRates(state,{clientId}).items[0]));
 const scopes=[copper,fiber,lift,{...lift,key:'extra'}];
 assert.throws(()=>applyAction(state,'estimate.create',{clientId,projectId,title:'Network',scope:'Test work',scopes,lines:linesFor(scopes)},actor),/one shared/);
});
test('on-site approval keeps exact signed revision, creates draft orders once, and exposes revisions without rewriting released work',()=>{
 const {state,clientId,projectId}=fixture();
 const scopes=[copper,fiber,lift];
 const fields={clientId,projectId,title:'Network',scope:'Install copper and fiber',options:'Two patch panels',exclusions:'No core drilling',scopes,lines:linesFor(scopes)};
 const estimate=applyAction(state,'estimate.create',fields,actor);
 const acceptance={id:estimate.id,revision:estimate.revision,acceptedBy:'Customer Example',signatureData:fakePng,consent:true};
 assert.throws(()=>applyAction(state,'estimate.accept',{...acceptance,consent:false},actor),/consent/);
 const accepted=applyAction(state,'estimate.accept',acceptance,actor);
 assert.equal(accepted.approvalSnapshot.revision,acceptance.revision);
 assert.equal(accepted.approvalSnapshot.signatureData,fakePng);
 assert.equal(accepted.approvalSnapshot.options,'Two patch panels');
 const orders=state.workorders.filter(order=>order.estimateSource?.estimateId===estimate.id);
 assert.deepEqual(new Set(orders.map(order=>order.estimateSource.kind)),new Set(['inventory','lift','copper','fiber','closeout']));
 assert.ok(orders.every(order=>order.status==='awaiting-signoff'&&!order.approvedAt));
 assert.equal(orders.filter(order=>order.requiredForFinalBilling).length,1);
 assert.equal(orders.filter(order=>order.internalTask).length,3);
 assert.equal(applyAction(state,'estimate.accept',acceptance,actor).id,estimate.id);
 assert.equal(state.workorders.length,6);
 const copperOrder=orders.find(order=>order.estimateSource.kind==='copper');
 assert.throws(()=>applyAction(state,'estimate.releaseWorkOrder',{workorderId:copperOrder.id},{email:'tech@example.invalid',permissions:[]}),/permission/);
 applyAction(state,'estimate.releaseWorkOrder',{workorderId:copperOrder.id},actor);
 assert.equal(copperOrder.status,'released');
 assert.equal(copperOrder.approval.signedBy,'Customer Example');
 assert.throws(()=>applyAction(state,'estimate.update',{...fields,id:estimate.id,revision:estimate.revision},actor),/latest draft/);
 const updatedScopes=[{...copper,drops:70},fiber,lift];
 const revised=applyAction(state,'estimate.create',{...fields,basedOnId:accepted.id,scopes:updatedScopes,lines:linesFor(updatedScopes)},actor);
 applyAction(state,'estimate.accept',{id:revised.id,revision:revised.revision,acceptedBy:'Customer Example',evidence:'Email approval'},actor);
 assert.ok(revised.workOrderChanges.some(change=>change.scopeKey==='office'&&change.after.includes('70')));
 assert.equal(state.workorders.length,6);
 assert.ok(copperOrder.description.includes('60'));
 assert.equal(accepted.approvalSnapshot.scopes[0].drops,60);
});
