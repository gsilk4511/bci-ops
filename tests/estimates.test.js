import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {authorizePermission} from '../Models/permissions.js';
test('accepted estimates convert once and keep the quoted amount',()=>{
 const state=seed(),actor={email:'office@example.invalid'};
 const estimate=applyAction(state,'estimate.create',{clientId:state.customers[0].id,title:'New cabling',site:'Example',scope:'Install two drops',lines:[{description:'Drop',quantity:2,rate:125}]},actor);
 assert.equal(estimate.total,250);
 assert.throws(()=>applyAction(state,'estimate.convert',{id:estimate.id},actor),/acceptance/);
 applyAction(state,'estimate.accept',{id:estimate.id,revision:estimate.revision,acceptedBy:'Example Client',evidence:'Email approval'},actor);
 const project=applyAction(state,'estimate.convert',{id:estimate.id,po:'PO-42'},actor);
 assert.equal(project.po,'PO-42');
 assert.equal(project.estimateId,estimate.id);
 assert.equal(project.estimatedScope,estimate.scope);
 assert.equal(applyAction(state,'estimate.convert',{id:estimate.id},actor).id,project.id);
 assert.equal(state.projects.length,2);
 assert.throws(()=>authorizePermission('estimate.convert','office',['estimates.view','estimate.convert']),/Project creation/);
});

test('catalog rates are server controlled and incomplete drafts require pricing before acceptance',()=>{
 const state=seed(), clientId=state.customers[0].id;
 state.catalog.push({id:'needs-price',name:'New jack',type:'material',unit:'ea',needsPricing:true});
 const base={clientId,title:'Two drops',scope:'Install jacks'};
 const actor={email:'tech@example.invalid',permissions:[]};
 const draft=applyAction(state,'estimate.create',{...base,lines:[
  {catalogId:'cat_4',quantity:2,rate:1},{catalogId:'needs-price',quantity:2}
 ]},actor);
 assert.equal(draft.total,250);
 assert.equal(draft.lines[1].rate,null);
 const acceptance={id:draft.id,revision:draft.revision,acceptedBy:'Client',evidence:'Email'};
 assert.throws(()=>applyAction(state,'estimate.accept',acceptance,actor),/pricing/);
 const update={...base,id:draft.id,revision:draft.revision,lines:[{...draft.lines[1],rate:21,override:true}]};
 assert.throws(()=>applyAction(state,'estimate.update',update,actor),/permission/);
 const updated=applyAction(state,'estimate.update',update,{...actor,permissions:['estimate.override']});
 assert.equal(updated.total,42);
 assert.equal(applyAction(state,'estimate.accept',{...acceptance,revision:updated.revision},actor).status,'Accepted');
});
