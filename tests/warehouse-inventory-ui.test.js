import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('warehouse inventory gives each part one row, preserves legacy stock, and respects edit boundaries',async()=>{
 const hooks=new Map(), writes=[], receipts=[], modals=[];
 const commitLabel={};
 let section;
 const part={id:'cat-a',type:'material',name:'Cat6 <Jack>',sku:'TEST-01',cost:7,price:12,changePrice:15,unit:'ea',catalogInfo:{brand:'Brand A',system:'Copper',partType:'Jack',color:'Ivory',finishCode:'Matte',mpn:'J-01',photoId:'a'.repeat(64)}};
 const emptyPart={...part,id:'cat-b',name:'Cat6 cable',catalogInfo:{brand:'Brand B',system:'Copper',partType:'Cable'},needsUnitCost:true,cost:0};
 const archived={...part,id:'archived-id',sku:'ARCHIVED-01',name:'Archived manufacturer jack',warehouseArchived:true};
 const state={catalog:[part,emptyPart,archived],inventory:[
  {catalogId:part.id,location:'BCI Warehouse',quantity:3,reserved:5,projected:-2},
  {catalogId:part.id,location:'Truck <1>',quantity:19,projected:19}
 ],movements:[{workorderId:'wo-1',catalogId:part.id,location:'Truck <1>',type:'issue',quantity:-1,note:'Prior <notes>',warehouseReceiptId:'photo-receive',at:'2026-11-19'}],warehouseFieldPurchases:[
 {id:'photo-pending',workorderId:'wo-1',workorderTitle:'Job <pending>',entryId:'e1',catalogId:part.id,partName:part.name,quantity:2,unit:'ea',at:'2026-11-20',status:'pending',revision:'r-1'},
 {id:'photo-committed',workorderId:'wo-1',catalogId:part.id,quantity:4,unit:'ea',at:'2026-11-20',status:'committed',committedAt:'2026-11-20'},
 {id:'photo-review',workorderId:'wo-1',catalogId:part.id,quantity:6,unit:'ea',at:'2026-11-20',status:'review'}
 ]};
 const permissions=new Set(['inventory.view','inventory.adjust','pricing.view','catalog.create','catalog.update','finance.view','inventory.receive','workorders.view','receipt.read']);
 const escape=s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const values={
  can:key=>permissions.has(key),data:state,me:{role:'admin'},billingName:c=>c.name,
  card:(a,b,c)=>a+' '+b+' '+c,head:(title,sub,desc,actions)=>title+sub+desc+actions,
  catalog:id=>state.catalog.find(c=>c.id===id),wo:id=>({title:'WO '+id}),esc:escape,fmt:n=>'$'+n.toFixed(2),
  table:(cols,rows)=>cols.join('|')+rows.join(''),send:async(action,payload)=>{writes.push([action,payload]);},
  modal:(...args)=>{modals.push(args);},
 };
 const context=vm.createContext({
  document:{querySelector(selector){return selector==='[data-bci-warehouse]'?section:commitLabel;},addEventListener(name,fn){
   if(!hooks.has(name))hooks.set(name,[]);
   hooks.get(name).push(fn);
  }},
  FormData:class {constructor(f){this.values=f.values;}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}},
 });
 const app=new vm.SyntheticModule(Object.keys(values),function(){for(const key of Object.keys(values))this.setExport(key,values[key]);},{context});
 const photos=new vm.SourceTextModule(readFileSync(new URL('../public/modules/catalog-photos.js',import.meta.url),'utf8'),{context});
 const screen=new vm.SourceTextModule(readFileSync(new URL('../public/modules/warehouse.js',import.meta.url),'utf8'),{context});
 const receiptModule=new vm.SyntheticModule(['readReceiptPhoto'],function(){this.setExport('readReceiptPhoto',(...args)=>receipts.push(args));},{context});
 const roundtrip=new vm.SyntheticModule(['warehouseFiles'],function(){this.setExport('warehouseFiles',()=>'<div>Warehouse file controls</div>');},{context});
 const facets=new vm.SourceTextModule(readFileSync(new URL('../public/modules/warehouse-facets.js',import.meta.url),'utf8'),{context});
 await screen.link(s=>s==='../app.js'?app:s==='./work-entry.js'?receiptModule:s==='./warehouse-roundtrip.js'?roundtrip:s==='./warehouse-facets.js'?facets:photos);
 await screen.evaluate();
 let html=screen.namespace.warehouse();
 assert.match(html,/data-bci-wh-edit aria-pressed="false">Edit<\/button>/);
 assert.doesNotMatch(html,/data-bci-wh-form|<summary>Edit|TEST-01/);
 assert.match(html,/data-bci-wh-part="cat-a"[^>]+aria-label="View details for Cat6 &lt;Jack&gt;"/);
 assert.match(html,/data-bci-wh-filter="brand"/);
 assert.match(html,/data-bci-wh-filter="category"/);
 assert.match(html,/data-bci-wh-filter="type"/);
 assert.match(html,/data-bci-wh-filter="color"/);
 assert.match(html,/Ivory \/ Matte · ea/);
 assert.match(html,/On hand<\/span><span class="">3<\/span>/);
 assert.match(html,/Projected<\/span><span class="warn">-2<\/span>/);
 assert.match(html,/&lt;Jack&gt;/);
 assert.doesNotMatch(html,/catalog-photo|data-bci-photo|Archived manufacturer jack/);
 assert.match(html,/1 archived, history retained/);
 assert.match(html,/Add Item[\s\S]+Import Catalog[\s\S]+Receive Parts[\s\S]+Activity[\s\S]+Prior &lt;notes&gt;/);
 assert.match(html,/Job &lt;pending&gt;/);
 assert.match(html,/data-warehouse-commit="photo-pending"/);
 assert.doesNotMatch(html,/data-warehouse-commit="photo-(committed|review)"/);
 assert.match(html,/data-warehouse-photo="photo-receive"/);
 const click=(selector,button)=>{for(const hook of hooks.get('click'))hook({target:{closest:s=>s===selector?button:null}});};
 click('[data-warehouse-photo]',{dataset:{warehousePhoto:'photo-receive'}});
 click('[data-warehouse-commit]',{dataset:{warehouseCommit:'photo-pending'}});
 assert.deepEqual(JSON.parse(JSON.stringify(receipts)),[['inventory.receiptRead',{id:'photo-receive'}]]);
 assert.equal(commitLabel.textContent,'Commit to Warehouse');
 assert.match(modals[0][3],/2 ea/);
 await modals[0][2]();
 assert.deepEqual(JSON.parse(JSON.stringify(writes.pop())),['inventory.commitFieldPurchase',{id:'photo-pending',workorderId:'wo-1',revision:'r-1'}]);
 assert.doesNotMatch(html,/Card Purchase|Adjust stock|data-open="transfer"/);
 const output={};
 section={querySelector(key){return (output[key]??={focus(){this.focused=true;}});}};
 const dialog=output['[data-bci-wh-dialog]']={open:false,isConnected:true,showModal(){this.open=true;},close(){this.open=false;}};
 const openPart=()=>click('[data-bci-wh-part]',{dataset:{bciWhPart:part.id},closest:()=>section});
 openPart();
 assert.equal(dialog.open,true);
 assert.match(dialog.innerHTML,/Legacy stock, not in warehouse count[\s\S]*Truck &lt;1&gt;: 19 on hand/);
 assert.doesNotMatch(dialog.innerHTML,/data-bci-wh-form/);
 click('[data-bci-wh-dialog-close]',{closest:()=>dialog});
 const editButton={setAttribute(key,val){this[key]=val;}};
 click('[data-bci-wh-edit]',editButton);
 assert.equal(editButton['aria-pressed'],'true');
 assert.equal(editButton.textContent,'Done editing');
 assert.equal(output['[data-bci-wh-edit-hint]'].hidden,false);
 assert.match(output['[data-bci-warehouse-results]'].innerHTML,/aria-label="Edit Cat6 &lt;Jack&gt;"/);
 assert.doesNotMatch(output['[data-bci-warehouse-results]'].innerHTML,/data-bci-wh-form|TEST-01/);
 openPart();
 assert.match(dialog.innerHTML,/data-bci-wh-form="count" data-id="cat-a"/);
 assert.match(dialog.innerHTML,/data-bci-wh-form="pricing" data-id="cat-a"/);
 for(const hook of hooks.get('change'))hook({target:{value:'Brand A',dataset:{bciWhFilter:'brand'},closest:()=>section}});
 assert.match(output['[data-bci-warehouse-results]'].innerHTML,/&lt;Jack&gt;/);
 assert.doesNotMatch(output['[data-bci-warehouse-results]'].innerHTML,/Cat6 cable/);
 assert.match(screen.namespace.warehouse(),/value="Brand A" selected/);
 assert.match(output['#bciWarehouse-type'].innerHTML,/Jack \(1\)/);
 assert.doesNotMatch(output['#bciWarehouse-type'].innerHTML,/Cable/);
 const color=value=>{for(const hook of hooks.get('change'))hook({target:{value,dataset:{bciWhFilter:'color'},closest:()=>section}});};
 color('matte');
 assert.match(output['[data-bci-warehouse-results]'].innerHTML,/Ivory \/ Matte/);
 color('not specified');
 assert.match(output['[data-bci-warehouse-results]'].innerHTML,/Cat6 cable/);
 assert.doesNotMatch(output['[data-bci-warehouse-results]'].innerHTML,/&lt;Jack&gt;/);
 assert.match(output['[data-bci-wh-filter-notice]'].textContent,/Cleared incompatible filters: Brand/);
 const clear=key=>key==='[data-bci-wh-clear]'?{closest:()=>section}:null;
 for(const hook of hooks.get('click'))hook({target:{closest:clear}});
 assert.match(output['[data-bci-warehouse-results]'].innerHTML,/Cat6 cable/);
 assert.match(output['[data-bci-warehouse-results]'].innerHTML,/&lt;Jack&gt;/);
 assert.equal(output['#bciWarehouseSearch'].focused,true);
 const el={};
 const submit=(mode,values)=>hooks.get('submit')[0]({
  target:{values,dataset:{bciWhForm:mode,id:part.id,expected:'3'},closest:()=>dialog,querySelector:()=>el},preventDefault(){},
 });
 await submit('count',{quantity:'8',reason:'Physical count'});
 assert.equal(dialog.open,false);
 openPart();
 await submit('pricing',{brand:'Brand A',mpn:'J-01',system:'Copper',partType:'Jack',cost:'7',price:'13',changePrice:'15'});
 assert.deepEqual(JSON.parse(JSON.stringify(writes)),[
  ['inventory.adjust',{catalogId:part.id,mode:'count',quantity:'8',expectedQuantity:3,reason:'Physical count'}],
  ['catalog.update',{catalogId:part.id,inventoryEdit:true,price:'13'}],
 ]);
 click('[data-bci-wh-edit]',editButton);
 assert.equal(editButton['aria-pressed'],'false');
 await submit('count',{quantity:'9',reason:'Should not save'});
 assert.equal(writes.length,2);
 click('[data-bci-wh-edit]',editButton);
 permissions.delete('inventory.adjust');
 openPart();
 assert.doesNotMatch(dialog.innerHTML,/data-bci-wh-form="count"/);
 assert.match(dialog.innerHTML,/data-bci-wh-form="pricing"/);
 dialog.close();
 permissions.delete('inventory.receive');
 permissions.delete('finance.view');
 permissions.delete('catalog.update');
 html=screen.namespace.warehouse();
 assert.doesNotMatch(html,/data-bci-wh-edit aria-pressed|Edit count|Unit cost|Edit part &amp; pricing|\$7\.00|Commit to Warehouse|Receive Parts|photo-receive/);
 assert.match(html,/data-warehouse-photo="photo-pending"/);
 permissions.delete('receipt.read');
 assert.doesNotMatch(screen.namespace.warehouse(),/photo-pending|Field purchases/);
});
