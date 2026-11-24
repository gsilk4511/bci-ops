import test from 'node:test';
import assert from 'node:assert/strict';
import {pricingGridPage,pricingPageSizes} from '../public/modules/pricing-grid.js';

test('pricing lists sort before pagination, search across records, and offer all requested limits',()=>{
 const rows=Array.from({length:51},(_,i)=>({name:'Part '+(i+1),price:(i+1)*3,search:'part sku-'+(i+1)+' brand'}));
 assert.deepEqual(pricingPageSizes,[10,20,30,40,50,100,200,500]);
 assert.deepEqual(pricingGridPage(rows,{sort:'-price',page:1}).rows.map(x=>x.price),[123,120,117,114,111,108,105,102,99,96]);
 assert.equal(pricingGridPage(rows,{query:'brand SKU-49',page:5}).rows[0],rows[48]);
 assert.equal(pricingGridPage(rows,{reveal:rows[50]}).page,5);
 assert.equal(pricingGridPage(rows,{query:'missing',page:9}).total,0);
});
