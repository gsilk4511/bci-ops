import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('Warehouse files are admin only and updates need a clean preview before an explicit apply',async()=>{
 const requests=[],notices=[], events={},patch={format:'bci-warehouse-patch-v1',items:[{id:'part-1',sku:'SKU-1',revision:'r-1',changes:{color:'White'}}]};
 let conflicts=[{sku:'SKU <1>',reason:'Stale <row>'}], reloads=0, downloaded=false;
 const anchor={click(){downloaded=true;},remove(){}};
 const context=vm.createContext({
  URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
  setTimeout(fn){fn();},
  document:{addEventListener(event,listener){events[event]=listener;},createElement(){return anchor;},body:{append(){}}},
  fetch:async(path,options)=>{
   requests.push([path,options.body?JSON.parse(options.body):null]);
   if(path==='/api/warehouse-export')return {ok:true,headers:{get:key=>key==='content-type'?'application/json; charset=utf-8':'attachment; filename="Randy-Warehouse.json"'},blob:async()=>({size:100})};
   const action=JSON.parse(options.body).action;
   if(action==='warehouse.patchPreview')return {ok:true,json:async()=>({ok:true,result:{total:1,updated:1,unchanged:0,conflicts,changes:[{id:'part-1',sku:'SKU-1',fields:['color'],details:{color:{before:'<Ivory>',after:'White'}}}],fingerprint:'f-1'}})};
   return {ok:true,json:async()=>({ok:true,result:{updated:1}})};
  }
 });
 const exports={
  can:key=>key==='inventory.view',esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),
  me:{role:'admin'},practiceMode:false,reload:async()=>{reloads++;},show:msg=>notices.push(msg),today:()=>'2026-11-20',
 };
 const app=new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});
 const roundtrip=new vm.SourceTextModule(readFileSync(new URL('../public/modules/warehouse-roundtrip.js',import.meta.url),'utf8'),{context});
 await roundtrip.link(()=>app);await roundtrip.evaluate();
 assert.match(roundtrip.namespace.warehouseFiles(),/Export Warehouse &amp; Catalog[\s\S]+Import Warehouse Updates/);
 app.setExport('me',{role:'tech'});
 assert.equal(roundtrip.namespace.warehouseFiles(),'');
 app.setExport('me',{role:'admin'});
 app.setExport('practiceMode',true);
 assert.equal(roundtrip.namespace.warehouseFiles(),'');
 app.setExport('practiceMode',false);
 function el(o={}){
  const handlers={};
  return {handlers,isConnected:true,dataset:{},innerHTML:'',disabled:false,addEventListener(k,f){handlers[k]=f;},replaceChildren(){this.innerHTML='';},focus(){this.focused=true;},...o};
 }
 const button=el({hasAttribute:key=>key==='data-warehouse-export'}), click=target=>events.click({target:{closest:()=>target}});
 await click(button);
 assert.equal(downloaded,true);
 assert.equal(anchor.download,'Randy-Warehouse.json');
 assert.match(notices.at(-1),/Check Downloads/);
 const file=el({files:[{size:93,text:async()=>JSON.stringify(patch)}]});
 const preview=el(),form=el({reset(){this.resetCalled=true;},querySelector:()=>preview});
 const close=el(),status=el(),output=el(),apply=el({hidden:true});
 const children={'[data-warehouse-patch-form]':form,'input[type=file]':file,'[data-warehouse-patch-close]':close,'[data-warehouse-patch-status]':status,'[data-warehouse-patch-output]':output,'[data-warehouse-patch-apply]':apply};
 const dialog=el({querySelector:key=>children[key],showModal(){this.open=true;},close(){this.open=false;this.handlers.close();}});
 const opener=el({hasAttribute:()=>false,closest:()=>({querySelector:()=>dialog})});
 click(opener);
 assert.equal(dialog.open,true);
 const submit=()=>form.handlers.submit({preventDefault(){}});
 await submit();
 assert.match(output.innerHTML,/SKU &lt;1&gt;[\s\S]*Stale &lt;row&gt;/);
 assert.equal(apply.hidden,true);
 await apply.handlers.click();
 assert.equal(requests.at(-1)[1].action,'warehouse.patchPreview');
 conflicts=[];
 await submit();
 assert.equal(apply.hidden,false);
 assert.match(output.innerHTML,/Color:<\/b>.*&lt;Ivory&gt;.*→ .*White/);
 assert.equal(reloads,0);
 await apply.handlers.click();
 assert.deepEqual(requests.at(-1),['/api/action',{action:'warehouse.patchApply',data:{patch,fingerprint:'f-1'}}]);
 assert.equal(dialog.open,false);
 assert.equal(opener.focused,true);
 assert.equal(reloads,1);
 assert.equal(form.resetCalled,true);
});
