import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {effectivePermissions,authorizePermission} from '../Models/permissions.js';
import {visibleState} from '../Models/visibility.js';
import {previewWorkorderRemoval} from '../Models/records.js';
const owner={email:'owner',role:'admin'};
const removal=(state,ids,reason)=>({ids,reason,confirmation:'delete',revisions:Object.fromEntries(previewWorkorderRemoval(state,ids).map(p=>[p.id,p.revision]))});

test('saved view/action matrix applies to users and blocks hidden module writes',()=>{
 const state=seed();
 state.users=[{email:'tech@example.com',role:'tech',profileId:'p'}];
 state.permissionProfiles=[{id:'p',schemaVersion:2,permissions:['projects.view','project.update']}];
 const rights=effectivePermissions(state,{email:'tech@example.com'},'tech');
 authorizePermission('project.update','tech',rights);
 assert.throws(()=>authorizePermission('project.delete','tech',rights),/denied/i);
 assert.throws(()=>authorizePermission('project.update','tech',['project.update']),/view/i);
 assert.throws(()=>authorizePermission('trash.restore','tech',rights),/Admin/);
 const response=visibleState(state,'tech',rights);
 assert.equal(response.workorders.length,0);
 assert.equal(response.inventory.length,0);
 assert.equal(response.catalog.length,0);
 assert.equal(response.customers[0].address,undefined);
 assert.equal(response.users,undefined);
});
test('nested response costs are redacted without altering stored history',()=>{
 const s=seed();s.workorders[0].closeout={originalEntries:[{cost:50}]};
 const response=visibleState(s,'tech',['workorders.view']);
 assert.equal(response.workorders[0].closeout.originalEntries[0].cost,undefined);
 assert.equal(s.workorders[0].closeout.originalEntries[0].cost,50);
});
test('record corrections detect stale edits and draft deletion restores the same identity',()=>{
 const s=seed(),p=s.projects[0],w=s.workorders[0];
 applyAction(s,'project.update',{id:p.id,expectedUpdatedAt:null,name:'Fixed spelling',site:'Barre',po:'PO-42'});
 assert.equal(p.name,'Fixed spelling');
 assert.throws(()=>applyAction(s,'project.update',{id:p.id,expectedUpdatedAt:null,name:'Stale',site:'Barre'}),/changed/);
 assert.throws(()=>applyAction(s,'project.delete',{ids:[p.id],reason:'Test',confirmed:true}),/work orders/);
 applyAction(s,'workorder.delete',removal(s,[w.id],'Duplicate draft'),owner);
 assert.equal(s.workorders.length,0);
 const trash=s.trash[0];assert.equal(trash.deletedBy,'owner');
 applyAction(s,'trash.restore',{ids:[trash.id]});
 assert.equal(s.workorders[0].id,w.id);
 assert.equal(s.trash.length,0);
});
test('bulk deletion validates every row and preserves invoice or stock history',()=>{
 const s=seed();s.workorders.push({...structuredClone(s.workorders[0]),id:'invoiced',approvedAt:'today',invoice:{number:'Test-1'}});
 const snapshot=structuredClone(s);
 assert.throws(()=>applyAction(s,'workorder.delete',removal(s,[s.workorders[0].id,'invoiced'],'Oops'),owner),/recorded invoice/);
 assert.deepEqual(s,snapshot);
 assert.throws(()=>applyAction(s,'catalog.delete',{ids:['cat_2'],reason:'Oops',confirmed:true}),/history/);
});
test('contacts can be corrected, deleted and restored under their billing client',()=>{
 const s=seed(),c=s.customers[0];c.contacts=[{id:'contact',name:'Ryan',phone:'555'}];
 applyAction(s,'contact.update',{customerId:c.id,id:'contact',expectedUpdatedAt:null,name:'Ryan Jones',phone:'555'});
 applyAction(s,'contact.delete',{customerId:c.id,id:'contact',reason:'Duplicate',confirmed:true});
 assert.equal(c.contacts.length,0);
 applyAction(s,'trash.restore',{ids:[s.trash[0].id]});
 assert.equal(c.contacts[0].name,'Ryan Jones');
});
test('permanent purge requires an explicit phrase',()=>{
 const s=seed();
 applyAction(s,'workorder.delete',removal(s,[s.workorders[0].id],'Duplicate'),owner);
 const ids=[s.trash[0].id];
 assert.throws(()=>applyAction(s,'trash.purge',{ids}),/PERMANENTLY DELETE/);
 applyAction(s,'trash.purge',{ids,confirmation:'PERMANENTLY DELETE'});
 assert.equal(s.trash.length,0);
});

test('catalog creation keeps its pricing permissions and does not receive stock',()=>{
 const state=seed(), originalInventory=structuredClone(state.inventory), originalPurchases=structuredClone(state.purchases);
 assert.throws(()=>authorizePermission('catalog.create','tech',['inventory.view','catalog.create']),/view/i);
 assert.throws(()=>authorizePermission('catalog.create','tech',['inventory.view','pricing.view']),/denied/i);
 authorizePermission('catalog.create','tech',['inventory.view','pricing.view','catalog.create']);
 for (const [type,unit] of [['material','ea'],['labor','hr'],['travel','hr']]) {
  const input={type,unit,name:'Example '+type,group:'Test',sku:'new-test-'+type,price:12.34,changePrice:20,cost:2};
  const item=applyAction(state,'catalog.create',input,{email:'authorized@example.com'});
  assert.equal(item.type,type);
  assert.equal(item.sku,input.sku.toUpperCase());
  assert.equal(item.price,12.34);
  assert.throws(()=>applyAction(state,'catalog.create',input),/SKU already exists/);
 }
 assert.deepEqual(state.inventory,originalInventory);
 assert.deepEqual(state.purchases,originalPurchases);
});
