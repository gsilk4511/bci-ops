import test from 'node:test';
import assert from 'node:assert/strict';
import {warehouseFacets} from '../public/modules/warehouse-facets.js';

const item=(name,brand,system,partType,color,stock={})=>({
 item:{id:name,name,catalogInfo:{brand,system,partType,color,...(name==='example-keystone'?{finishCode:'Matte'}:{})}},
 onHand:0,projected:0,legacy:[],...stock,
});
const catalog=[
 ...Array.from({length:33},(_,index)=>item('Copper patch cord '+index,'Cable Matters','Copper','Patch cord','Black')),
 item('example-keystone','Cable Matters','Copper','Jack','White',{onHand:3,projected:-2}),
 item('Wall plate','Cable Matters','Copper','Faceplate','White',{legacy:[{quantity:2}]}),
 item('Fiber coupler','Cable Matters','Fiber','Coupler','Blue'),
 item('Different white keystone','Leviton','Copper','Jack','White'),
 item('Power distribution','Other brand','Rack','PDU'),
];
const counts=(result,key)=>Object.fromEntries(result.options[key].map(([id,_,count])=>[id,count]));

test('Warehouse dependent facets count unique compatible rows and keep unknown metadata explicit',()=>{
 const filters={brand:'Cable Matters',category:'Copper'};
 let result=warehouseFacets(catalog,filters,['brand','category']);
 assert.equal(result.matched.length,35);
 assert.deepEqual(counts(result,'type'),{'':35,Faceplate:1,Jack:1,'Patch cord':33});
 assert.deepEqual(counts(result,'color'),{'':35,black:33,matte:1,white:2});
 assert.deepEqual(counts(result,'stock'),{'':35,positive:1,zero:34,negative:1,legacy:1});
 assert.equal(result.options.color.some(([id])=>id==='blue'),false);
 result=warehouseFacets(catalog,{category:'Rack'},['category']);
 assert.deepEqual(counts(result,'color'),{'':1,'not specified':1});
});

test('Warehouse new incompatible facet wins but retains all other compatible selections',()=>{
 const filters={brand:'Cable Matters',category:'Copper',type:'Jack',color:'blue',stock:'zero'};
 const result=warehouseFacets(catalog,filters,['brand','category','type','stock','color']);
 assert.deepEqual({...filters},{brand:'Cable Matters',category:'',type:'',color:'blue',stock:'zero'});
 assert.deepEqual(result.matched.map(row=>row.item.name),['Fiber coupler']);
 assert.deepEqual(result.cleared,['Type','Category']);
});

test('a no-result search does not erase active facets and its options have stable zero counts',()=>{
 const filters={brand:'Cable Matters',category:'Copper',query:'not a matching product'};
 let result=warehouseFacets(catalog,filters,['brand','category']);
 assert.deepEqual(result.matched,[]);
 assert.deepEqual(result.cleared,[]);
 assert.deepEqual(counts(result,'brand'),{'':0,'Cable Matters':0});
 filters.query='wall plate';
 result=warehouseFacets(catalog,filters,['brand','category']);
 assert.deepEqual(result.matched.map(row=>row.item.name),['Wall plate']);
 assert.deepEqual(counts(result,'type'),{'':1,Faceplate:1});
});

test('legacy rows use verified top-level manufacturer and MPN; free text never creates a manufacturer',()=>{
 const rows=[{item:{id:'legacy',name:'Legacy patch cord',manufacturer:' Cable Matters ',manufacturerPartNumber:'OLD-1'},onHand:0,projected:0,legacy:[]},
 {item:{id:'unknown',name:'Looks like a Leviton part'},onHand:0,projected:0,legacy:[]}];
 let result=warehouseFacets(rows,{},[]);
 assert.deepEqual(counts(result,'brand'),{'':2,'Cable Matters':1,'Not specified':1});
 result=warehouseFacets(rows,{query:'cable matters old-1'},[]);
 assert.deepEqual(result.matched.map(row=>row.item.id),['legacy']);
});
