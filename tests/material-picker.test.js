import test from 'node:test';
import assert from 'node:assert/strict';
import {
 materialFacets, materialHasIdentity, materialShortcuts, materialSignals, materialUnitLabel, materialUnitPreference, rankMaterials,
} from '../public/modules/material-picker.js';

const create=(id,name,category,type,meta={},unit='ea')=>({id,name,sku:id,unit,catalogInfo:{system:category,partType:type,...meta}});
const white=create('CAT6-WH','Cat6 Keystone Jack','Copper','Jacks',{brand:'Leviton',mpn:'JA-WH',catalogUnit:'Each',color:'White'});
const blue=create('CAT6-BL','Cat6 Keystone Jack','Copper','Jacks',{brand:'Leviton',mpn:'JA-BL',catalogUnit:'each',color:'Blue'});
const pack=create('CAT6-25','Cat6 Keystone Jack 25-pack','Copper','Jacks',{brand:'Leviton',mpn:'JA-25',catalogUnit:'Pack',packQty:25},'box');
const cable=create('BULK','Cat6 UTP Cable','Copper','Bulk Cable',{brand:'Berk-Tek',catalogUnit:'Reel'},'reel');
const labels=create('FACE','Faceplate with label window','Copper','Faceplates',{brand:'Signamax',catalogUnit:'Each'});
const strike=create('STR','Electric strike faceplate','Access Control','Strike Faceplates',{brand:'HES'});
const aux=create('SUP','Ladder runway wall mount','Cable Support & Racks','Runway Accessories',{brand:'Chatsworth'});
const rack=create('RCK','42U floor rack','Cable Support & Racks','Racks',{brand:'NavePoint'});
const cord=create('CORD','Cat6 patch cable','Copper','Patch Cords',{brand:'Cable Matters',catalogUnit:'Each'});
const fiber=create('FIB','LC to LC fiber patch cord','Fiber','Fiber Patch Cords',{brand:'Corning',catalogUnit:'Each'});
const conduit=create('ELB','Conduit elbow','Conduit & Fittings','Elbows');
const items=[white,blue,pack,cable,labels,strike,aux,rack,cord,fiber,conduit];
const at=Date.parse('2026-11-20T12:00:00Z');
const use=(item,date,email='tech@example.invalid')=>({type:'material',catalogId:item.id,date,employeeEmail:email});
const ids=rows=>rows.map(row=>row.id);

test('technician shortcuts match actual catalog classifications and keep the full list available',()=>{
 const signals=new Map();
 for(const [shortcut,expected] of [
  ['jacks',[white.id,blue.id,pack.id]],['bulkCable',[cable.id]],['faceplates',[labels.id]],
  ['patchCords',[cord.id,fiber.id]],['supports',[aux.id]],['racks',[rack.id]],['fiber',[fiber.id]],['conduit',[conduit.id]],
 ]){
  assert.ok(materialShortcuts.some(row=>row[0]===shortcut));
  assert.deepEqual(ids(rankMaterials(items,signals,{shortcut})).sort(),expected.sort(),shortcut);
 }
 assert.equal(rankMaterials(items,signals).length,items.length);
 assert.deepEqual(rankMaterials(items,signals,{shortcut:'recent'}),[]);
 assert.deepEqual(rankMaterials(items,signals,{shortcut:'inStock'}),[]);
 assert.deepEqual(materialFacets(items,{category:'Copper',type:'Jacks'}).brands,['Leviton']);
 assert.deepEqual(ids(rankMaterials(items,signals,{category:'Copper',type:'Jacks',brand:'Leviton',query:'cat 6 blue'})),[blue.id]);
 const legacy={id:'legacy',sku:'X ',name:'Legacy',manufacturer:'Leviton',manufacturerPartNumber:'123XY'};
 assert.deepEqual(ids(rankMaterials([legacy],signals,{query:'leviton 123xy'})),['legacy']);
});

test('ranked field search keeps exact packs findable, favors verified each units, and never edits the saved unit or SKU',()=>{
 const before=JSON.stringify(items);
 const signals=materialSignals([],[
  {catalogId:pack.id,location:'BCI Warehouse',quantity:2},{catalogId:white.id,location:'BCI Warehouse',quantity:2},
  {catalogId:blue.id,location:'Truck',quantity:200},
 ],{warehouseName:'BCI Warehouse',now:at});
 assert.deepEqual(ids(rankMaterials(items,signals,{shortcut:'inStock'})),[white.id,pack.id]);
 assert.equal(rankMaterials(items,signals,{query:'JA25'})[0].id,pack.id);
 assert.equal(rankMaterials(items,signals,{query:'CAT6-25'})[0].unit,'box');
 assert.equal(materialUnitPreference(pack),0);
 assert.equal(materialUnitPreference(white),2);
 assert.equal(materialUnitPreference({...white,needsUnitReview:true}),1);
 assert.equal(materialUnitPreference({...white,catalogInfo:{...white.catalogInfo,catalogUnit:'Pack',packQty:10}}),0);
 assert.match(materialUnitLabel(pack),/Unit: box · Mfr unit: Pack · Pack qty: 25/);
 assert.match(materialUnitLabel({...white,needsUnitReview:true}),/Verify unit before logging/);
 assert.equal(JSON.stringify(items),before);
});

test('recent, stocked, and common order are based only on visible posted work and warehouse balance',()=>{
 const work=[
  {id:'job',entries:[use(blue,'2026-11-18'),use(blue,'2026-11-18')]},
  {id:'shop',entries:[use(white,'2026-11-19','other@example.invalid'),use(pack,'2026-01-01')]},
  {id:'job2',entries:[use(white,'2026-06-18','other@example.invalid')]},
 ];
 const signals=materialSignals(work,[
  {catalogId:blue.id,location:'BCI Warehouse',quantity:0,reserved:2,projected:-2},
  {catalogId:white.id,location:'Warehouse old',quantity:100},
 ],{orderId:'job',email:'tech@example.invalid',warehouseName:'BCI Warehouse',now:at});
 assert.equal(signals.get(blue.id).orders,1);
 assert.equal(signals.get(white.id).orders,2);
 assert.equal(signals.get(white.id).onHand,0);
 assert.equal(signals.get(blue.id).onHand,0);
 assert.equal(signals.get(blue.id).onOrder,true);
 assert.deepEqual(ids(rankMaterials(items,signals,{shortcut:'recent'})),[blue.id,white.id]);
 assert.deepEqual(ids(rankMaterials(items,signals,{shortcut:'inStock'})),[]);
 assert.equal(signals.get(pack.id).latest,0);
 assert.equal(rankMaterials([blue,white],signals,{},part=>part.id!==blue.id)[0].id,blue.id);
 // Inputs are already scoped by the work order/change selector, so unavailable items cannot be synthesized.
 assert.deepEqual(rankMaterials([white],signals,{query:'JA-BL'}),[]);
});


test('generic searches favor complete manufacturer identity over legacy price status but legacy SKU stays searchable',()=>{
 const generic={id:'legacy-jack',sku:'LEG-JACK',name:'Cat6 Keystone Jack',unit:'ea',price:4};
 const authentic={...white,needsPricing:true};
 const signals=new Map();
 assert.equal(materialHasIdentity(generic),false);
 assert.equal(materialHasIdentity({catalogInfo:{brand:'Unknown',mpn:'1234'}}),false);
 assert.equal(materialHasIdentity(authentic),true);
 assert.equal(rankMaterials([generic,authentic],signals,{query:'Cat6 Keystone Jack'},p=>!p.needsPricing)[0].id,authentic.id);
 assert.deepEqual(ids(rankMaterials([generic,authentic],signals,{query:'LEG-JACK'},p=>!p.needsPricing)),[generic.id]);
});

test('typed trade nouns surface the actual product over parts merely named for it',()=>{
 const panel=create('PP-1','Cat6 Jack Shutter Patch Panel','Copper','Patch Panels',{brand:'Example',mpn:'PP-1',catalogUnit:'Each'});
 const signals=materialSignals([], [{location:'BCI Warehouse',catalogId:panel.id,quantity:20}],{warehouseName:'BCI Warehouse'});
 assert.deepEqual(ids(rankMaterials([panel,white],signals,{query:'cat6 jack'})),[white.id,panel.id]);
 assert.equal(rankMaterials([panel,white],signals,{query:'PP-1'})[0].id,panel.id);
 assert.equal(rankMaterials([panel,white],signals,{query:'jack shutter'})[0].id,panel.id);
});
