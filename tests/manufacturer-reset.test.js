import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plan,mutate} from '../scripts/archive-manufacturer-import-nov20-2026.js';

const manifest=JSON.parse(readFileSync(new URL('../scripts/manufacturer-import-nov20-2026.manifest.json',import.meta.url),'utf8'));
test('bulk archive scopes by exact inserted identity, preserves active dependencies, and reverses only its batch',()=>{
 assert.equal(manifest.items.length,3843);
 const candidates=manifest.items.map(({id,sku,brand,mpn})=>({id,sku,type:'material',manufacturer:brand,manufacturerPartNumber:mpn,cost:0,price:0,changePrice:0}));
 const [stock,review,estimate,draft,priced,rule,eligible,foreign]=candidates;
 const originals=[{id:'cat-original',sku:'ORIGINAL',type:'material',price:8},{id:'labor-original',sku:'LABOR',type:'labor',price:120}];
 const state={catalog:[...originals,...candidates],inventory:[{catalogId:stock.id,quantity:-1}],workorders:[
  {status:'ready-for-review',closeout:{},entries:[{catalogId:review.id}]},
  {status:'invoiced',invoice:{status:'sent'},entries:[{catalogId:eligible.id}]}
 ],estimates:[{status:'Draft',scopes:[{cableId:estimate.id}]}],materialDrafts:[{catalogId:draft.id,expiresAt:6}],
 pricingProfiles:[{rules:{[rule.id]:{fixed:4}}}]};
 priced.price=10;eligible.warehouseArchived=false;foreign.warehouseArchived=true;foreign.warehouseArchiveBatch='other';
 const before=structuredClone(state), preview=plan(state,manifest,{now:5});
 assert.equal(preview.missing+preview.mismatches,0);
 assert.equal(preview.changes.length,3843-7);
 assert.equal(Object.keys(preview.skip).length,7);
 assert.deepEqual(state,before);
 mutate(preview.changes);
 assert.deepEqual(state.catalog.slice(0,2),originals);
 assert.equal(plan(state,manifest,{now:5}).changes.length,0);
 mutate(plan(state,manifest,{rollback:true}).changes,{rollback:true});
 assert.deepEqual(state,before);
 eligible.sku='changed';
 assert.equal(plan(state,manifest).mismatches,1);
});
