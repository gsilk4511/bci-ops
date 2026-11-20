import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {estimateRates} from '../Models/estimates.js';
import {authorizePermission} from '../Models/permissions.js';
import {planCatalogPack,importCatalogPack} from '../Models/catalog-pack.js';

const person={role:'admin',email:'admin@example.invalid'};
const photo='f'.repeat(64);
const part={brand:'Example',mpn:'KJ-100',name:'Cat6 keystone',system:'Copper',partType:'Jack',catalogUnit:'each',
 spec:'Cat6, UTP',length:1,packQty:25,sourceUrl:'https://example.invalid/cat6',photoStatus:'Exact',photoId:photo,
 photoEvidencePage:'https://example.invalid/product',originalPhotoUrl:'https://example.invalid/a.jpg'};
const fit={brand:'Example',mpn:'KJ-100',part:'KJ-100',fits:'Example KJ-Panel',relationship:'Manufacturer specification',sourceUrl:'https://example.invalid/fit'};
const pack={format:'bci-catalog-pack-v1',items:[part],fitReferences:[fit]};
const assets=new Set([photo]);
function apply(state,doc=pack){const {summary}=planCatalogPack(state,doc,assets);return importCatalogPack(state,{pack:doc,fingerprint:summary.fingerprint},person,assets);}

test('preview and reimport are additive, preserve inventory/purchases, and do not enable automatic pricing',()=>{
 const state=seed(),original=structuredClone(state), order=state.workorders[0];
 const preview=planCatalogPack(state,pack,assets).summary;
 assert.equal(preview.new,1);assert.equal(preview.photoCount,1);assert.deepEqual(state,original);
 apply(state);
 const added=state.catalog.at(-1);
 assert.equal(added.manufacturerPartNumber,'KJ-100');assert.equal(added.needsPricing,true);
 assert.equal(added.catalogInfo.fitReferences[0].fits,'Example KJ-Panel');
 assert.deepEqual(state.inventory,original.inventory);assert.deepEqual(state.purchases,original.purchases);
 assert.deepEqual(state.workorders,original.workorders);
 const second=apply(state);
 assert.equal(second.new,0);assert.equal(second.matched,1);assert.equal(second.unchanged,1);
 assert.equal(state.catalog.length,original.catalog.length+1);
 order.approvedAt='2026-11-20T00:00:00Z';order.status='released';
 assert.throws(()=>applyAction(state,'entry.add',{workorderId:order.id,type:'material',catalogId:added.id,quantity:1},person),/fixed price|purchase cost/i);
 const rates=estimateRates(state,{clientId:state.customers[0].id});
 assert.equal(rates.items.find(item=>item.id===added.id).rate,null);
});

test('only a unique brand+MPN fills existing metadata without changing pricing, labels, or stock units',()=>{
 const state=seed();const target=state.catalog.find(item=>item.id==='cat_2');
 Object.assign(target,{manufacturer:'EXAMPLE',manufacturerPartNumber:'kj-100',unit:'special',price:42,cost:11,changePrice:48});
 const before=structuredClone(target);
 const result=apply(state);
 assert.equal(result.updated,1);assert.equal(result.new,0);
 assert.deepEqual({...target,catalogInfo:undefined},{...before,catalogInfo:undefined});
 assert.equal(target.catalogInfo.photoStatus,'Exact');
 assert.equal(target.catalogInfo.photoId,photo);
 const alternate={...pack,items:[{...part,photoStatus:'Family',photoId:'a'.repeat(64)}]};
 const plan=planCatalogPack(state,alternate,new Set([photo,'a'.repeat(64)]));
 assert.equal(plan.summary.unchanged,1);
});

test('duplicate identity, unknown photo, stale preview, malformed rows and non-admin never mutate the catalog',()=>{
 const state=seed(),before=structuredClone(state);
 const original=planCatalogPack(state,pack,assets).summary;
 assert.throws(()=>importCatalogPack(state,{pack,fingerprint:original.fingerprint},{role:'tech'},assets),/admin/i);
 assert.throws(()=>authorizePermission('catalog.packImport','tech',['pricing.view','catalog.create']),/admin/i);
 assert.throws(()=>importCatalogPack(state,{pack,fingerprint:'0'.repeat(64)},person,assets),/preview/i);
 const duplicate={...pack,items:[part,{...part,mpn:'kj-100',name:'Duplicate'}]};
 assert.equal(planCatalogPack(state,duplicate,assets).summary.conflicts.length,1);
 assert.throws(()=>apply(state,duplicate),/conflicts/i);
 assert.equal(planCatalogPack(state,pack,new Set()).summary.conflicts.length,1);
 assert.throws(()=>planCatalogPack(state,{...pack,items:[{...part,photoId:'../a.jpg'}]},assets),/photo/i);
 assert.throws(()=>planCatalogPack(state,{...pack,items:[{...part,sourceUrl:'javascript:alert(1)'}]},assets),/sourceUrl/);
 assert.throws(()=>planCatalogPack(state,{...pack,items:[{...part,price:55}]},assets),/fields/);
 assert.deepEqual(state,before);
});

test('ambiguous legacy SKU halts apply; name alone is never used as identity',()=>{
 const state=seed(),existing=state.catalog.find(item=>item.id==='cat_2');
 Object.assign(existing,{sku:'KJ-100'});
 assert.equal(planCatalogPack(state,pack,assets).summary.conflicts.length,1);
 existing.sku='UNRELATED';
 existing.name=part.name;
 assert.equal(planCatalogPack(state,pack,assets).summary.new,1);
});

test('reviewed skip applies the exact safe subset and leaves conflicted fitting references untouched',()=>{
 const state=seed(),collision={...part,brand:'Unverified',mpn:'BCI-JACK',photoStatus:'Not matched yet',photoId:''};
 const input={...pack,items:[part,collision],fitReferences:[fit,{...fit,brand:'Unverified',mpn:'BCI-JACK'}]};
 const preview=planCatalogPack(state,input,assets).summary;
 assert.equal(preview.skipped,1);
 assert.throws(()=>importCatalogPack(state,{pack:input,fingerprint:preview.fingerprint},person,assets),/explicitly skip/);
 assert.throws(()=>importCatalogPack(state,{pack:input,fingerprint:'a'.repeat(64),skipConflicts:true},person,assets),/preview/i);
 assert.equal(importCatalogPack(state,{pack:input,fingerprint:preview.fingerprint,skipConflicts:true},person,assets).skipped,1);
 assert.equal(state.catalog.at(-1).catalogInfo.mpn,part.mpn);
 assert.equal(state.catalog.at(-2).catalogInfo,undefined);
 assert.deepEqual(state.catalogFitReferences,[]);
});
