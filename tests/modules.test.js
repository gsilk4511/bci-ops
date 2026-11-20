import { pricingOverview } from '../Models/pricing-profiles.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seed,applyAction} from '../Models/lib.js';
import {effectivePermissions,permissionGroups,modulePermissions} from '../Models/permissions.js';

// Link actual browser modules without a network connection. This catches missing
// exports and broken circular initialization before the app reaches staging.
test('each tab module links and renders with shared live state',async()=>{
 if(!vm.SourceTextModule)return; // npm test:modules enables the VM module API.
 const root=fileURLToPath(new URL('../public/',import.meta.url));
 const node={dataset:{},style:{},setAttribute(){},addEventListener(){},querySelectorAll(){return []}};
 const previewChildren=[];
 let printed=false;
 const preview={document:{createElement:()=>({style:{},querySelectorAll(){return [];},append(child){this.child=child;}}),head:{append(){}},body:{append(...children){previewChildren.push(...children);}}},print(){printed=true;}};
 const context=vm.createContext({
  console, Intl, Date, Map, Set, URL, Number, String, Object, Array, Promise,
  document:{querySelector(){return node},addEventListener(){},documentElement:{dataset:{}}},
  matchMedia(){return {matches:false,addEventListener(){}}},localStorage:{getItem(){return null}},
  navigator:{},window:{location:{href:'https://ops.example.invalid/'},open(){return preview;}},fetch(){return new Promise(()=>{})},setTimeout(){},
 });
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file);
  let source=fs.readFileSync(file,'utf8');
  if(file.endsWith('/app.js'))source+='\nglobalThis.injectTestData=(value)=>{data=value;me=value.me;};';
  const module=new vm.SourceTextModule(source,{context,identifier:file});
  cache.set(file,module);
  return module;
 }
 const entry=load(path.join(root,'app.js'));
 await entry.link((specifier,ref)=>load(path.resolve(path.dirname(ref.identifier),specifier)));
 await entry.evaluate();
 const state=seed();
 state.me={role:'admin',email:'test',permissions:effectivePermissions(state,{email:'test'},'admin')};
 state.pricingOverview=pricingOverview(state,state.me.permissions);
 state.permissionGroups=permissionGroups;state.modulePermissions=modulePermissions;
 context.injectTestData(state);
 for(const name of ['dashboard','customers','projectsHub','workorders','warehouse','moneyPage','reports','payrollPage','catalogPage','teamPage','testingPage','ticketsPage','notificationsPage','trainingPage','invoicesPage','estimatesPage','changelogPage']){
  assert.equal(typeof entry.namespace[name](),'string',name);
 }
 {
 const order=state.workorders[0];
 const originalOrder={...order};
 const originalWorkOrders=state.workorders;
 const sampleScope='Scope with literal <b>markup</b>. '+ 'Long scope text. '.repeat(12)+'End of scope.';
 Object.assign(order,{title:'A <Work Order>', description:sampleScope, createdAt:'2026-11-19T02:00:00Z'});
 state.workorders=[order,
  {...order,id:'released-sample',status:'ready-for-review',createdAt:'2026-11-17'},
  {...order,id:'legacy-sample',status:'awaiting-signoff',createdAt:null,description:''}
 ];
 const woMarkup=entry.namespace.workorders();
 const mobileMarkup=woMarkup.split('<div class="wo-mobile">')[1];
 const desktopMarkup=woMarkup.split('<div class="wo-mobile">')[0];
 assert.match(desktopMarkup,/<th>Job<\/th><th>Customer \/ project<\/th><th>State<\/th><th>Entries<\/th><th>Estimated bill<\/th>/);
 assert.doesNotMatch(desktopMarkup,/End of scope/);
 assert.match(mobileMarkup,/<dt>Client<\/dt>[\s\S]+<dt>Release<\/dt>[\s\S]+<dt>Entries<\/dt>[\s\S]+<dt>Created<\/dt>[\s\S]+<div class="wo-mobile-main">/);
 assert.match(mobileMarkup,/Sample Customer/);
 assert.ok(mobileMarkup.includes('data-wo="'+order.id+'"'));
 assert.match(mobileMarkup,/A &lt;Work Order&gt;/);
 assert.match(mobileMarkup,/&lt;b&gt;markup&lt;\/b&gt;[\s\S]+End of scope/);
 assert.match(mobileMarkup,/<time datetime="2026-11-19T02:00:00.000Z">11\/18\/26<\/time>/);
 assert.match(mobileMarkup,/<time datetime="2026-11-17">11\/17\/26<\/time>/);
 assert.match(mobileMarkup,/>Not recorded</);
 assert.match(mobileMarkup,/>No scope recorded\.</);
 assert.match(mobileMarkup,/>Released</);
 assert.match(mobileMarkup,/>Not released</);
 state.workorders=[];
 assert.match(entry.namespace.workorders(),/<div class="wo-mobile"><div class="empty">No records found/);
 state.workorders=originalWorkOrders;
 Object.assign(order,originalOrder);
 }
 assert.match(entry.namespace.catalogPage(),/Billing clients/);
 const addButton = /data-open="catalog">\+ Add item<\/button>/g;
 const pricingMarkup = entry.namespace.catalogPage();
 assert.equal((pricingMarkup.match(addButton)||[]).length,1);
 assert.ok(pricingMarkup.indexOf('data-open="catalog"') < pricingMarkup.indexOf('<details'));
 assert.equal((entry.namespace.warehouse().match(/data-open="warehouse-item">Add Item<\/button>/g)||[]).length,1);
 const savedPricingOverview=state.pricingOverview;
 state.pricingOverview=undefined;
 assert.equal((entry.namespace.catalogPage().match(addButton)||[]).length,1);
 state.pricingOverview=savedPricingOverview;
 const catalogMe=state.me;
 for (const permissions of [['inventory.view','pricing.view'],['inventory.view','catalog.create']]) {
  state.me={...catalogMe,permissions};
  context.injectTestData(state);
  assert.doesNotMatch(entry.namespace.catalogPage(),/data-open="catalog"/);
  assert.doesNotMatch(entry.namespace.warehouse(),/data-open="warehouse-item"/);
 }
 state.me=catalogMe;
 context.injectTestData(state);
 assert.equal(entry.namespace.formPermissions.catalog,'catalog.create');

 assert.match(entry.namespace.detail(state.workorders[0]),/scope/i);
 // The on-screen field journal keeps all metadata above a full-width, escaped note.
 const journalEntry={id:'layout-1',type:'labor',date:'2026-11-16',tech:'Sample Tech',name:'Cable technician',
  quantity:25/3,unit:'hr',rate:95,description:'Original note',journalNote:'First line\nSecond line <sample>'};
 const journalOrder={...state.workorders[0],approvedAt:'2026-11-16T12:00:00Z',entries:[journalEntry,{...journalEntry,id:'layout-2',type:'material',
  quantity:1.2345,unit:'box',rate:0,name:'Boxes',journalNote:undefined}]};
 const journal=entry.namespace.detail(journalOrder);
 assert.match(journal,/field-journal-meta[\s\S]*?Date \/ tech[\s\S]*?Sample Tech[\s\S]*?Qty[\s\S]*?8\.33 hr[\s\S]*?Charge[\s\S]*?\$791\.67[\s\S]*?<\/dl>[\s\S]*?field-journal-work">Cable technician[\s\S]*?field-journal-note">First line\nSecond line &lt;sample&gt;/);
 assert.match(journal,/data-entry-mode="wo_demo">Edit Work Order/);
 assert.doesNotMatch(journal,/data-entry-edit=/);
 assert.match(journal,/1\.2345 box/);
 assert.equal(journalEntry.quantity,25/3);
 const journalPrint=entry.namespace.workOrderDocument(journalOrder);
 assert.match(journalPrint, /<th scope="col">Date \/ Tech<\/th><th scope="col">Qty \/ Hours<\/th><th scope="col">Charge<\/th>/);
 assert.match(journalPrint, /<tbody class="work-order-journal-entry">\s*<tr class="work-order-journal-meta">[\s\S]*?2026-11-16[\s\S]*?Sample Tech[\s\S]*?<td>8\.33 hr<\/td><td>\$791\.67<\/td><\/tr>\s*<tr class="work-order-journal-work"><td colspan="3"><b>Cable technician<\/b><div class="ticket-text">Original note<\/div><\/td><\/tr>\s*<\/tbody>/);
 assert.match(journalPrint, /<td>1\.2345 box<\/td>/);
 assert.equal((journalPrint.match(/<tbody class="work-order-journal-entry">/g)||[]).length,2);
 assert.match(entry.namespace.workOrderDocument({...journalOrder,entries:[]}), /<td colspan="3">No records found<\/td>/);
 const escapedPrint=entry.namespace.workOrderDocument({...journalOrder,entries:[{...journalEntry,name:'<Part>',description:'First line\n<note>'}]});
 assert.match(escapedPrint,/&lt;Part&gt;<\/b><div class="ticket-text">First line\n&lt;note&gt;<\/div>/);
 const previousMe=state.me;
 state.me={...previousMe,role:'tech',permissions:[]};
 context.injectTestData(state);
 assert.doesNotMatch(entry.namespace.detail(journalOrder),/data-entry-mode=/);
 state.me=previousMe;
 context.injectTestData(state);

 assert.match(entry.namespace.projectDetail(state.projects[0]),/project/i);
 // Exercise the new grouped invoice path from a newly created job.
 const run=(action,fields)=>applyAction(state,action,fields,{email:'test'});
 const order=run('workorder.create',{projectId:state.projects[0].id,description:'Install two practice outlets'});
 const signatureData='data:image/png;base64,'+Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(200)]).toString('base64');
 run('workorder.approve',{workorderId:order.id,signedBy:'Sample client',signatureData,consent:true});
 const change=run('change.create',{workorderId:order.id,category:'add',description:'Label the outlets',lines:[{catalogId:'cat_3',quantity:1}]});
 run('change.approve',{workorderId:order.id,changeId:change.id,signedBy:'Change Approver',signatureData,consent:true});
 run('entry.add',{workorderId:order.id,type:'labor',catalogId:'cat_3',quantity:2,description:'Test labor',tech:'Test technician'});
 run('entry.add',{workorderId:order.id,type:'material',catalogId:'cat_2',quantity:2});
 run('workorder.close',{workorderId:order.id,submittedBy:'Test technician'});
 run('workorder.review',{workorderId:order.id});
 assert.match(entry.namespace.invoicesPage(),/Create invoice/);
 const workOrderMarkup=entry.namespace.workOrderDocument(order);
 assert.match(workOrderMarkup,/Approved by Change Approver/);
 assert.match(workOrderMarkup,/ORIGINAL FIELD JOURNAL/);
 assert.match(workOrderMarkup,/BILLING SUMMARY/);
 assert.doesNotMatch(workOrderMarkup,/INVOICE DETAIL|Direct job cost|Estimated gross profit/);
 const totals=entry.namespace.bill({...order,entries:order.closeout.originalEntries});
 assert.match(workOrderMarkup,/<td>Total<\/td><td>\$228\.00<\/td>/);
 assert.equal(totals.total,228);
 assert.match(entry.namespace.detail(order),/work-order-internal-financial"><span>Direct job cost/);
 assert.match(entry.namespace.detail(order),/work-order-internal-financial"><b>Estimated gross profit/);
 for (const permissions of [previousMe.permissions,['workorders.view']]) {
  state.me={...previousMe,permissions};
  context.injectTestData(state);
  assert.equal(entry.namespace.workOrderDocument(order),workOrderMarkup);
 }
 state.me=previousMe;
 context.injectTestData(state);
 const invoice=run('invoice.group',{number:'QB-TEST-228',layout:'itemized',workorderIds:[order.id]});
 const markup=entry.namespace.invoiceDocument(invoice);
 assert.match(markup,/INVOICE DETAIL/);
 assert.match(markup,/\$228\.00/);
 assert.doesNotMatch(markup,/ORIGINAL FIELD JOURNAL|Change Approver|Submit completed work order/);
 entry.namespace.printDocument(markup);
 assert.equal(previewChildren.length,2);
 assert.equal(previewChildren[1].innerHTML,markup);
 previewChildren[0].child.onclick();
 assert.equal(printed,true);
 run('invoice.pay',{workorderId:order.id,amount:228});
 assert.equal(order.status,'paid');
 assert.match(entry.namespace.invoicesPage(),/QB-TEST-228/);

});
