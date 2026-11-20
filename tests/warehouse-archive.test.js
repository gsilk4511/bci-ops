import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,seed} from '../Models/lib.js';
import {estimateRates} from '../Models/estimates.js';
import {stockProjection} from '../Models/stock-demand.js';

test('archived materials retain historical entries and stock but reject new issues, receipts, quotes and reservations',()=>{
 const state=seed(),order=state.workorders[0],part=state.catalog.find(i=>i.id==='cat_2');
 order.status='released';order.approvedAt=new Date().toISOString();
 const actor={role:'admin',email:'admin@example.invalid'};
 const perform=(action,data)=>applyAction(state,action,data,actor);
 const entry=perform('entry.add',{workorderId:order.id,type:'material',catalogId:part.id,quantity:2});
 part.warehouseArchived=true;
 assert.equal(state.catalog.find(i=>i.id===part.id).name,entry.name);
 assert.ok(stockProjection(state).some(row=>row.catalogId===part.id));
 assert.equal(estimateRates(state,{clientId:state.customers[0].id}).items.some(row=>row.id===part.id),false);
 assert.equal(estimateRates(state,{clientId:state.customers[0].id}).items.some(row=>row.type==='labor'),true);
 assert.throws(()=>perform('entry.add',{workorderId:order.id,type:'material',catalogId:part.id,quantity:1}),/archived/);
 assert.throws(()=>perform('entry.materialDraft',{workorderId:order.id,catalogId:part.id,quantity:1,draftId:randomUUID()}),/archived/);
 assert.throws(()=>perform('inventory.receive',{catalogId:part.id,quantity:1}),/archived/);
 assert.throws(()=>perform('inventory.receive',{catalogId:part.id,quantity:1,warehouseReceive:true}),/archived/);
 assert.throws(()=>perform('change.create',{workorderId:order.id,category:'add',description:'More',lines:[{catalogId:part.id,quantity:1}]}),/archived/);
 const revision=entry.revision||'';
 assert.throws(()=>perform('entry.update',{workorderId:order.id,entryId:entry.id,catalogId:part.id,date:entry.date,quantity:3,revision}),/archived/);
 assert.doesNotThrow(()=>perform('entry.update',{workorderId:order.id,entryId:entry.id,catalogId:part.id,date:entry.date,quantity:1,revision}));
 assert.equal(order.entries[0].quantity,1);
 assert.equal(order.entries[0].catalogId,part.id);
});
