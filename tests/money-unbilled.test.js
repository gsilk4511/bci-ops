import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {moneyWorkOrderRows,seed} from '../Models/lib.js';
const order=(id,projectId,fields={})=>({id,projectId,title:id,status:'released',entries:[{type:'labor',quantity:2,rate:95,cost:35}],...fields});

test('unbilled includes open and completed work but no attached QuickBooks invoice, hidden or internal rows',()=>{
 const state=seed(),p=state.projects[0].id;
 state.workorders=[
  order('open',p,{entries:[{type:'labor',quantity:2,rate:95,cost:35},{type:'travel',quantity:1,rate:60,cost:20,sharedTravel:true}]}),
  order('closed',p,{status:'ready-for-review',closeout:{at:'2026-11-19'}}),
  order('no-number',p,{invoice:{status:'draft'}}),
  order('no-entries',p,{entries:[],status:'awaiting-signoff'}),
  order('sent',p,{invoice:{number:'QB-1',status:'sent',amountPaid:20}}),
  order('paid',p,{invoice:{number:'QB-2',status:'paid',depositCredit:10}}),
  order('group-member',p),
  order('hidden',p,{billingHidden:true,invoice:{status:'sent'}}),
  order('internal',p,{internalTask:true})
 ];
 state.projectInvoices=[{id:'inv-group',projectId:p,number:'QB-3',orders:[{id:'group-member'}]}];
 const snapshot=JSON.stringify(state),rows=moneyWorkOrderRows(state);
 assert.deepEqual(rows.filter(x=>x.stateKey==='unbilled').map(x=>x.id),['open','closed','no-number','no-entries']);
 assert.equal(rows.find(x=>x.id==='open').travel,0);
 assert.equal(rows.find(x=>x.id==='open').directCost,90);
 assert.equal(rows.find(x=>x.id==='open').grossProfit,100);
 assert.equal(rows.find(x=>x.id==='no-entries').total,0);
 assert.equal(rows.find(x=>x.id==='sent').openBalance,170);
 assert.equal(rows.find(x=>x.id==='group-member').stateKey,'outstanding');
 assert.equal(rows.find(x=>x.id==='paid').total,180);
 assert.equal(rows.find(x=>x.id==='paid').stateKey,'paid');
 assert.equal(JSON.stringify(state),snapshot);
});

test('Money view rolls up each project once and customer/status filters scope cards and rows',async()=>{
 const context=vm.createContext({});
 const projects={a:{name:'Alpha build',number:'A1',customerId:'ca'},b:{name:'Beta build',number:'B1',customerId:'cb'}};
 const row=(id,projectId,total,stateKey='unbilled')=>({id,title:id,projectId,total,stateKey,time:total,materials:0,travel:0,directCost:10,grossProfit:total-10,openBalance:total,workStatus:'released'});
 const data={customers:[{id:'ca',name:'Client A'},{id:'cb',name:'Client B'}],meta:{reserveRate:30},
  moneyOrders:[row('Released wire pull','a',100),row('Unbilled closeout','a',150),row('Another project','b',50),row('Recorded-in-QB','a',350,'outstanding')]};
 const attrs={can:()=>true,card:(label,value)=>`<p>${label}: ${value}</p>`,data,esc:String,fmt:v=>'$'+v,head:label=>`<h1>${label}</h1>`,
  moneyStatus:'all',moneyCustomer:'all',project:id=>projects[id],roundMoney:v=>Math.round(v*100)/100,status:String,table:(head,rows)=>rows.join('')};
 const link=new vm.SyntheticModule(Object.keys(attrs),function(){for(const [key,value] of Object.entries(attrs))this.setExport(key,value);},{context});
 const screen=new vm.SourceTextModule(readFileSync(new URL('../public/modules/money.js',import.meta.url),'utf8'),{context});
 await screen.link(()=>link);await screen.evaluate();
 const page=()=>screen.namespace.moneyPage();
 assert.match(page(),/Unbilled: \$300/);
 assert.match(page(),/Alpha build[\s\S]*2 work orders[\s\S]*?\$250[\s\S]*?Released wire pull/);
 assert.doesNotMatch(page(),/Completed \/ unbilled/);
 assert.match(page(),/Billed work orders[\s\S]*Recorded-in-QB/);
 link.setExport('moneyCustomer','ca');link.setExport('moneyStatus','unbilled');
 assert.match(page(),/Unbilled: \$250/);
 assert.doesNotMatch(page(),/Another project|Recorded-in-QB/);
});
