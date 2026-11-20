import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {authorizePermission} from '../Models/permissions.js';
import {visibleState} from '../Models/visibility.js';
import {applyWarehousePatch,exportWarehouse,previewWarehousePatch} from '../Models/warehouse-export.js';

const admin={role:'admin',email:'admin@example.invalid'};
const cat='cat_2';
const find=(state,id=cat)=>state.catalog.find(x=>x.id===id);
const snapshot=(state,finance=false)=>exportWarehouse(state,{release:'0.8.6-catalog.7',finance,now:new Date('2026-11-20T12:00:00Z')});
const patchFor=(state,id,changes)=>{
 const {sku,revision}=snapshot(state).items.find(item=>item.id===id);
 return {id,sku,revision,changes};
};
const envelope=(...rows)=>({patch:{format:'bci-warehouse-patch-v1',items:rows}});

test('snapshot is a private catalog and stock data export, not a state dump or an import file',()=>{
 const state=seed(),item=find(state);
 item.catalogInfo={brand:'Example',mpn:'TEST',system:'Copper',partType:'Jacks',photoId:'7'.repeat(64),
  sourceUrl:'https://example.invalid/product?private=do-not-export#section',unknown:'hide',
  fitReferences:[{part:'Jack',fits:'Plate',sourceUrl:'https://example.invalid/p?token=remove-me',internal:'hide'}]};
 state.workorderReceiptData={raw:'DO NOT EXPORT RECEIPT'};
 state.workorders[0].description='DO NOT EXPORT JOB';
 state.inventory[0].createdBy='DO NOT EXPORT ACTOR';
 state.purchases.push({catalogId:cat,unitCost:999,vendor:'DO NOT EXPORT PAST PURCHASE'});
 const readOnly=snapshot(state);
 assert.equal(readOnly.format,'bci-warehouse-export-v1');
 assert.equal(readOnly.exportedAt,'2026-11-20T12:00:00.000Z');
 const row=readOnly.items.find(x=>x.id===cat);
 assert.equal(row.catalogInfo.sourceUrl,'https://example.invalid/product');
 assert.equal(row.catalogInfo.fitReferences[0].sourceUrl,'https://example.invalid/p');
 assert.equal(row.catalogInfo.unknown,undefined);
 assert.equal(row.catalogInfo.fitReferences[0].internal,undefined);
 assert.equal(row.catalogInfo.photoId,'7'.repeat(64));
 assert.deepEqual(row.stock,[{location:'BCI Warehouse',quantity:4,reserved:0,projected:4}]);
 assert.equal(readOnly.items.find(x=>x.type==='labor').stock.length,0);
 const serialized=JSON.stringify(readOnly);
 assert.doesNotMatch(serialized,/DO NOT EXPORT|do-not-export|remove-me|unitCost|"cost"/);
 assert.equal(snapshot(state,true).items.find(x=>x.id===cat).cost,7);
 assert.throws(()=>previewWarehousePatch(state,{patch:readOnly}),/not a complete/i);
});

test('dry-run protects IDs/revisions; applies only selected descriptive fields and never reprices history',()=>{
 const state=seed(),item=find(state);
 item.catalogInfo={brand:'Example',mpn:'TEST',system:'Copper',partType:'Jacks',photoId:'7'.repeat(64)};
 const data=envelope(patchFor(state,cat,{name:'Corrected Jack',description:'Jack description',system:'Cabling',partType:'Jacks',color:'Blue'}));
 const prior=structuredClone(state);
 const initial=previewWarehousePatch(state,data);
 assert.deepEqual(prior,state);
 assert.equal(initial.updated,1);
 assert.deepEqual(initial.changes[0].fields,['name','description','system','color']);
 assert.deepEqual(initial.changes[0].details.name,{before:'Cat6 keystone jack',after:'Corrected Jack'});
 assert.deepEqual(initial.changes[0].details.color,{before:'',after:'Blue'});
 assert.throws(()=>authorizePermission('warehouse.patchPreview','office',['inventory.view']),/Admin access/);
 assert.throws(()=>authorizePermission('warehouse.patchApply','tech',['inventory.view','inventory.receive']),/Admin access/);
 assert.throws(()=>applyWarehousePatch(state,data,admin),/Preview the exact/);
 applyAction(state,'inventory.adjust',{catalogId:cat,mode:'count',expectedQuantity:4,quantity:5,reason:'Counted'},admin);
 applyAction(state,'catalog.update',{inventoryEdit:true,catalogId:cat,price:42,cost:18},admin);
 assert.equal(previewWarehousePatch(state,data).fingerprint,initial.fingerprint,'price and movements are outside revision');
 const beforeApply=structuredClone(state);
 const applied=applyWarehousePatch(state,{...data,fingerprint:initial.fingerprint},admin);
 assert.equal(applied.updated,1);
 assert.equal(applied.changes[0].details,undefined);
 assert.equal(visibleState(state,'admin',['inventory.view']).warehousePatchReceipts,undefined);
 assert.equal(item.name,'Corrected Jack');
 assert.equal(item.description,'Jack description');
 assert.equal(item.catalogInfo.color,'Blue');
 assert.equal(item.catalogInfo.system,'Cabling');
 assert.equal(item.catalogInfo.photoId,'7'.repeat(64));
 assert.equal(item.catalogInfo.mpn,'TEST');
 assert.equal(item.price,42);assert.equal(item.cost,18);
 assert.deepEqual(state.workorders,beforeApply.workorders);
 assert.deepEqual(state.inventory,beforeApply.inventory);
 assert.deepEqual(state.movements,beforeApply.movements);
 assert.deepEqual(state.purchases,beforeApply.purchases);
 assert.equal(applyWarehousePatch(state,{...data,fingerprint:initial.fingerprint},admin).existing,true);
});

test('duplicates, stale changes, non-material IDs, forbidden fields, and unmatched parts never partially import',()=>{
 const state=seed();
 const good=patchFor(state,cat,{name:'Changed name'});
 const older=patchFor(state,'cat_1',{name:'Catalog cable'});
 const stale=envelope(good,older);
 const priorPreview=previewWarehousePatch(state,stale);
 find(state,'cat_1').description='someone else edited it';
 assert.equal(previewWarehousePatch(state,stale).conflicts.length,1);
 assert.throws(()=>applyWarehousePatch(state,{...stale,fingerprint:priorPreview.fingerprint},admin),/conflicts/);
 assert.equal(find(state).name,'Cat6 keystone jack');
 const duplicate=envelope(good,good);
 assert.equal(previewWarehousePatch(state,duplicate).conflicts.length,2);
 assert.equal(previewWarehousePatch(state,envelope({...good,sku:'WRONG'})).conflicts.length,1);
 assert.equal(previewWarehousePatch(state,envelope({...good,id:'new-id'})).conflicts.length,1);
 assert.match(previewWarehousePatch(state,envelope(patchFor(state,'cat_3',{name:'Service'}))).conflicts[0].reason,/Only material/);
 for(const field of ['price','cost','location','stock','quantity','photoId','manufacturer','mpn','unit','type','sku','id','group','constructor','__proto__']){
  const request=envelope({...good,changes:{[field]:'Bad'}});
  assert.throws(()=>previewWarehousePatch(state,request),/Invalid fields/);
 }
 assert.throws(()=>previewWarehousePatch(state,envelope({...good,changes:{name:'  '}})),/Invalid name/);
 assert.throws(()=>previewWarehousePatch(state,envelope(...Array.from({length:201},()=>good))),/1–200/);
 const approved=previewWarehousePatch(state,envelope(good));
 assert.throws(()=>applyWarehousePatch(state,{...envelope({...good,changes:{name:'Different'}}),fingerprint:approved.fingerprint},admin),/exact Warehouse patch/);
 state.catalog.push({...find(state),sku:'SECOND-SKU'});
 assert.match(previewWarehousePatch(state,envelope(good)).conflicts[0].reason,/Multiple saved/);
});
