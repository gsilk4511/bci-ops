import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seed} from '../Models/lib.js';

test('read-only browser views omit write and delete controls; explicit grants expose only their action',async()=>{
 const node={dataset:{},style:{},setAttribute(){},addEventListener(){},querySelectorAll(){return []}};
 const context=vm.createContext({
  console, document:{querySelector:()=>node,addEventListener(){},documentElement:{dataset:{}}},
  matchMedia:()=>({matches:false,addEventListener(){}}), localStorage:{getItem(){return null}},
  navigator:{},window:{location:{href:'https://ops.example.invalid/'}},fetch:()=>new Promise(()=>{})
 });
 const root=fileURLToPath(new URL('../public/',import.meta.url)),modules=new Map();
 function load(file){
  if(modules.has(file))return modules.get(file);
  let source=fs.readFileSync(file,'utf8');
  if(file.endsWith('/app.js'))source+='\nglobalThis.seedBrowser=(next,screen)=>{data=next;me=next.me;view=screen;};';
  const module=new vm.SourceTextModule(source,{context,identifier:file});
  modules.set(file,module);return module;
 }
 const app=load(path.join(root,'app.js'));
 await app.link((specifier,ref)=>load(path.resolve(path.dirname(ref.identifier),specifier)));
 await app.evaluate();
 const module=name=>modules.get(path.join(root,'modules',name+'.js')).namespace;
 const actions=module('work-entry'),records=module('records');
 const state=seed(),order=state.workorders[0],entry={
  id:'time-1',type:'labor',employeeEmail:'mine@example.invalid',date:'2026-11-19',tech:'Mine',
  quantity:2,rate:90,name:'Tech',unit:'hr',description:'Installed drop'
 };
 order.approvedAt='2026-11-19T15:00:00Z';
 order.entries=[entry];
 order.receipts=[{id:'receipt-1',name:'Test photo',uploadedName:'Mine'}];
 state.notifications={pushKey:'enabled',deviceCount:1,events:[{label:'Test',title:'Receipt',url:'/',at:'2026-11-19T15:00:00Z'}]};
 const apply=(permissions,role='tech',screen='workorders')=>{
  state.me={email:'mine@example.invalid',permissions,role};context.seedBrowser(state,screen);
 };
 apply(['workorders.view','entry.add','receipt.read']);
 assert.equal(actions.workEntryControls(order,entry,true),'');
 assert.doesNotMatch(app.namespace.detail(order),/data-entry-mode|data-delete-workorder|data-receipt-add/);
 assert.match(actions.receiptPanel(order),/data-receipt-view/);
 apply(['workorders.view','entry.update','receipt.add']);
 const edit=actions.workEntryControls(order,entry,true);
 assert.match(edit,/data-entry-edit="time-1"/);
 assert.doesNotMatch(edit,/data-entry-remove|×/);
 assert.match(actions.receiptPanel(order),/data-receipt-add/);
 assert.doesNotMatch(actions.receiptPanel(order),/data-receipt-view|Test photo/);
 assert.equal(actions.workEntryControls(order,{...entry,employeeEmail:'other@example.invalid'},true),'');
 apply(['workorders.view','entry.update','entry.manage']);
 assert.match(actions.workEntryControls(order,{...entry,employeeEmail:'other@example.invalid'},true),/data-entry-edit/);
 apply(['workorders.view','entry.remove','workorder.delete']);
 const remove=actions.workEntryControls(order,entry,true);
 assert.match(remove,/data-entry-remove="time-1"/);
 assert.doesNotMatch(remove,/data-entry-edit/);
 assert.equal(records.workorderDeleteButton(order),'');
 apply(['workorders.view','workorder.delete'],'admin');
 assert.match(records.workorderDeleteButton(order),/data-delete-workorder/);
 assert.doesNotMatch(app.namespace.detail(order),/data-open="log-time"|data-open="log-materials"|data-open="close"/);
 apply(['projects.view'],'tech','projects');
 assert.doesNotMatch(app.namespace.projectsHub(),/data-open="new-project"/);
 assert.equal(records.recordManager(),'');
 apply(['projects.view','project.update'],'tech','projects');
 assert.match(records.recordTools(),/Manage records/);
 assert.doesNotMatch(records.recordTools(),/delete/i);
 assert.doesNotMatch(records.recordManager(),/delete/i);
 apply(['inventory.view']);
 assert.doesNotMatch(app.namespace.warehouse(),/data-open="(?:warehouse-receive|warehouse-item|catalog-import)"/);
 apply(['notification.view']);
 assert.doesNotMatch(app.namespace.notificationsPage(),/data-notify=/);
 apply(['training.view']);
 assert.doesNotMatch(app.namespace.trainingPage(),/data-training=/);
});
