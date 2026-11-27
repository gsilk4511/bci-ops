import assert from 'node:assert/strict';
import test from 'node:test';
import {seed} from '../Models/lib.js';
import {orderRate} from '../Models/pricing.js';
import {applyWarehousePatch,exportWarehouse,previewWarehousePatch} from '../Models/warehouse-export.js';

function fixture(){
 const state=seed();
 const x=exportWarehouse(state,{finance:true}).items.find(row=>row.id==='cat_1');
 const patch={format:'bci-warehouse-updates-v2',items:[
  {id:x.id,sku:x.sku,revision:x.revision,expectedPrice:x.price,changes:{price:.47}},
  {sku:'TEST-JACK',changes:{name:'White Jack',system:'Jacks',serviceCategory:'Copper Cabling',partType:'Cat6A',brand:'Cable Matters',color:'White',unit:'each',price:11.41,cost:3.75,stockTarget:150}},
  ...['Blue','White'].map(color=>({sku:'TEST-PLATE-'+color,changes:{name:color+' plate',system:'Faceplates',serviceCategory:'Copper Cabling',partType:'2-port',brand:'Signamax',color,unit:'each',price:4,cost:1.2}})),
 ],stockGroups:[{id:'signamax-2',label:'2-port across colors',target:100,skus:['TEST-PLATE-Blue','TEST-PLATE-White']}],
 holds:[{sku:'HOLD-ME',reason:'Needs stock review'}]};
 return {state,patch};
}
const admin={role:'admin',email:'admin@example.invalid'};
test('Warehouse v2: preview adds prices and targets separately from stock, and a re-preview is a no-op',()=>{
 const {state,patch}=fixture(); const before=structuredClone(state);
 const result=previewWarehousePatch(state,{patch});
 assert.deepEqual(state,before);
 assert.deepEqual([result.added,result.updated,result.groupsUpdated,result.held.length],[3,1,1,1]);
 assert.equal(result.conflicts.length,0);
 assert.throws(()=>applyWarehousePatch(state,{patch,fingerprint:result.fingerprint},{role:'tech'}),/Admin/);
 applyWarehousePatch(state,{patch,fingerprint:result.fingerprint},admin);
 const existing=state.catalog.find(r=>r.id==='cat_1'), jack=state.catalog.find(r=>r.sku==='TEST-JACK');
 assert.deepEqual([existing.unit,existing.price,existing.changePrice,existing.cost],['ft',.47,1.1,.29]);
 assert.deepEqual([jack.price,jack.cost,jack.changePrice,jack.stockTarget,jack.catalogInfo.serviceCategory],[11.41,3.75,null,150,'Copper Cabling']);
 assert.equal(orderRate(state,{},jack,{},null,jack.cost),11.41);
 assert.equal(orderRate(state,{},jack,{},null,jack.cost,'change'),null);
 assert.equal(orderRate(state,{pricingProfileId:'fixed'},jack,{},null,jack.cost),11.41);
 state.pricingProfiles=[{id:'fixed',rules:{[jack.id]:{fixed:12}}}];
 assert.equal(orderRate(state,{pricingProfileId:'fixed'},jack,{},null,jack.cost),12);
 for(const k of ['inventory','movements','workorders','purchases'])assert.deepEqual(state[k],before[k]);
 const again=previewWarehousePatch(state,{patch});
 assert.deepEqual([again.added,again.updated,again.groupsUpdated,again.unchanged],[0,0,0,4]);
 assert.equal(state.warehouseStockGroups[0].target,100);
 const x=exportWarehouse(state,{finance:true});
 assert.equal(x.items.find(r=>r.id===jack.id).stockTarget,150);
 assert.equal(x.stockGroups[0].target,100);
});
test('Warehouse v2: mismatches, stale previews, invalid stock inputs and colliding groups fail closed',()=>{
 const {state,patch}=fixture();
 const {fingerprint}=previewWarehousePatch(state,{patch});
 const before=structuredClone(state);
 assert.throws(()=>applyWarehousePatch(state,{patch,fingerprint:'bad'},admin),/Preview/);
 assert.throws(()=>previewWarehousePatch(state,{patch:{...patch,items:[{...patch.items[1],changes:{...patch.items[1].changes,quantity:15}}]}}),/Invalid catalog fields/);
 const bad={...patch,stockGroups:[...patch.stockGroups,{id:'another',label:'Duplicate',target:10,skus:['TEST-PLATE-White']}]};
 assert.ok(previewWarehousePatch(state,{patch:bad}).conflicts.length);
 assert.throws(()=>applyWarehousePatch(state,{patch:bad,fingerprint},admin),/conflicts/);
 assert.deepEqual(state,before);
 state.catalog.find(r=>r.id==='cat_1').price=.99;
 assert.throws(()=>applyWarehousePatch(state,{patch,fingerprint},admin),/conflicts/);
 assert.equal(state.catalog.filter(r=>r.sku.startsWith('TEST-')).length,0);
});
