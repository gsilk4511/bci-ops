import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

test('Warehouse purge controls are admin-only and require exact reviewed confirmation',async()=>{
 const context=vm.createContext({document:{addEventListener(){}}});
 const source=fs.readFileSync(new URL('../public/modules/warehouse-purge.js',import.meta.url),'utf8');
 let role='office',warehouse=true,practice=false;
 const shell=new vm.SyntheticModule(['can','esc','me','practiceMode','reload','show'],function(){
  this.setExport('can',key=>warehouse&&key==='inventory.view');
  this.setExport('esc',String);
  this.setExport('me',{get role(){return role;}});
  this.setExport('practiceMode',practice);
  this.setExport('reload',async()=>{});
  this.setExport('show',()=>{});
 },{context});
 const module=new vm.SourceTextModule(source,{context});
 await module.link(()=>shell);await module.evaluate();
 const ui=module.namespace;
 assert.equal(ui.warehousePurgeDialog(),'');
 assert.equal(ui.warehousePurgeAction(),'');
 role='admin';warehouse=false;
 assert.equal(ui.warehousePurgeAction(),'');
 warehouse=true;practice=true;shell.setExport('practiceMode',practice);
 assert.equal(ui.warehousePurgeAction(),'');
 practice=false;shell.setExport('practiceMode',practice);
 assert.match(ui.warehousePurgeAction(),/Delete Imported Parts/);
 assert.match(ui.warehousePurgeDialog(),/data-warehouse-purge-apply disabled/);
 assert.match(ui.warehousePurgeDialog(),/type="checkbox"/);
 const frozen=ui.validatedPurgePreview({batch:'one',manifestCount:4,eligible:2,protected:2,missing:0,drift:0,fingerprint:'a'.repeat(64)});
 assert.equal(Object.isFrozen(frozen),true);
 assert.equal(ui.warehousePurgePayload(frozen,'DELETE 2',false),null);
 assert.equal(ui.warehousePurgePayload(frozen,'delete 2',true),null);
 assert.equal(ui.warehousePurgePayload(frozen,'DELETE 2 ',true),null);
 assert.equal(ui.warehousePurgePayload({...frozen,drift:1},'DELETE 2',true),null);
 assert.equal(ui.warehousePurgePayload({...frozen,eligible:0},'DELETE 0',true),null);
 assert.deepEqual({...ui.warehousePurgePayload(frozen,'DELETE 2',true)},
  {fingerprint:'a'.repeat(64),confirmation:'DELETE 2',backupConfirmed:true});
 assert.throws(()=>ui.validatedPurgePreview({...frozen,fingerprint:'bad'}),/verify/);
});
