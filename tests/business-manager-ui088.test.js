import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('manager bills retain due and paid statuses while vehicles are absent',async()=>{
 const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const context=vm.createContext({document:{addEventListener(){}}});
 const values={can:()=>false,data:{},esc:escape,f:()=>'',modal:()=>{},send:()=>{},today:()=>'2026-11-21'};
 const fakeApp=new vm.SyntheticModule(Object.keys(values),function(){
  for(const key of Object.keys(values))this.setExport(key,values[key]);
 },{context});
 const screen=new vm.SourceTextModule(readFileSync(new URL('../public/modules/business-manager.js',import.meta.url),'utf8'),{context});
 await screen.link(specifier=>{
  assert.equal(specifier,'../app.js');
  return fakeApp;
 });
 await screen.evaluate();
 const model={today:'2026-11-21',vehicles:[
  {name:'Van one <Test>',id:'van1',registration:{dueDate:'2026-11-20'},oil:{dueDate:'2026-11-21'}},
  {name:'Van two',id:'van2',registration:{dueDate:'2026-12-20'},oil:{dueMileage:50000}},
 ],bills:[
  {id:'due',name:'Open bill due',dueDate:'2026-12-25',status:'open'},
  {id:'paid',name:'Previously paid bill',dueDate:'2026-11-19',paidDate:'2026-11-19',status:'paid'},
 ]};
 assert.equal(screen.namespace.businessManagerPanel(undefined,true),'');
 const readOnly=screen.namespace.businessManagerPanel(model,false);
 assert.match(readOnly,/Overdue<\/dt><dd>0/);
 assert.match(readOnly,/Due in the next 30 days<\/dt><dd>0/);
 assert.match(readOnly,/Next due<\/dt><dd>Open bill due/);
 assert.doesNotMatch(readOnly,/Van one|Van two|Registration|Oil change|managerFleetHeading/);
 assert.match(readOnly,/Read only/);
 assert.doesNotMatch(readOnly,/data-manager-action/);
 assert.match(readOnly,/Open bills[\s\S]*Open bill due[\s\S]*<summary>Paid bills \(1\)<\/summary>[\s\S]*Previously paid bill/);
 const write=screen.namespace.businessManagerPanel(model,true);
 assert.match(write,/data-manager-action="paid" data-manager-id="due"/);
 assert.doesNotMatch(write,/data-manager-action="(?:paid|bill)" data-manager-id="paid"/);
});
