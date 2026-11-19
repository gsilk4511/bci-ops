import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {ticketOverview} from '../Models/tickets.js';
import {assignMail,importMailboxPage} from '../Models/mail-intake.js';

const owner={email:'owner@example.com',permissions:['tickets.view','ticket.create','ticket.update','ticket.note','ticket.mail']};
const outsider={email:'other@example.com',permissions:owner.permissions};
const msg=(key,conversation,from='new@example.com')=>({key,conversation,subject:'Copper install',from,body:'Can we discuss cabling?',at:'2026-11-19T15:00:00Z',recipients:[],attachments:[]});
test('manual opportunity needs no billing client and supports notes and recoverable completion',()=>{
  const state=seed();
  const {id}=applyAction(state,'ticket.create',{kind:'prospect',title:'Office expansion',company:'Acme',due:'2026-12-01'},owner);
  const current=()=>ticketOverview(state,owner).tickets.find(item=>item.id===id);
  assert.equal(current().clientId,'');
  assert.equal(current().source,'Manual');
  assert.equal(ticketOverview(state,outsider).tickets.length,0);
  applyAction(state,'ticket.note',{id,kind:'internal',message:'Will visit next Tuesday.'},owner);
  const revision=current().revision;
  applyAction(state,'ticket.update',{id,revision,transition:'complete'},owner);
  assert.equal(current().status,'Completed');
  assert.throws(()=>applyAction(state,'ticket.update',{id,revision,transition:'reopen'},owner),/Refresh/);
  applyAction(state,'ticket.update',{id,revision:current().revision,transition:'reopen'},owner);
  assert.equal(current().status,'New');
  assert.ok(current().activity.some(entry=>entry.message==='Will visit next Tuesday.'));
});
test('triaged prospect retains existing conversation and history without duplicate or silent reopening',()=>{
 const state=seed();
 const page=(messages,next)=>({messages,next});
 importMailboxPage(state,'test','',page([msg('1','thread')],'a'),'2026-11-01');
 assert.equal(state.tickets,undefined);
 const {id}=assignMail(state,{kind:'prospect',key:'1'},owner);
 assert.equal(ticketOverview(state,owner).tickets[0].source,'Email');
 assert.equal(ticketOverview(state,owner).tickets[0].mail.length,1);
 applyAction(state,'ticket.update',{id,revision:state.tickets[0].revision,transition:'complete'},owner);
 importMailboxPage(state,'test','a',page([msg('2','thread','second@example.com'),msg('3','new-thread')],'b'),'2026-11-01');
 assert.equal(state.tickets.length,1);
 assert.equal(state.tickets[0].status,'Completed');
 assert.equal(state.tickets[0].mailMessages.length,2);
 assert.throws(()=>assignMail(state,{kind:'prospect',key:'3',prospectId:id},outsider),/existing opportunity/);
 assignMail(state,{kind:'prospect',key:'3',prospectId:id},owner);
 assert.equal(state.tickets[0].mailMessages.length,3);
 assert.equal(state.tickets[0].status,'Completed');
 assert.equal(ticketOverview(state,{...owner,permissions:['tickets.view']}).tickets[0].mail.length,0);
});

test('workflow grids split current requests, sales, open projects and final billing',async()=>{
 const vm=await import('node:vm');
 if(!vm.SourceTextModule)return;
 const {readFileSync}=await import('node:fs');
 const mock={
   can:()=>true,
   data:{projects:[
     {id:'active',name:'Active office',customerId:'payer'},
     {id:'due',name:'Billing office',customerId:'payer',closedAt:'2026-10-10'},
     {id:'done',name:'Paid office',customerId:'payer',closedAt:'2026-10-10'}
   ],workorders:[
     {id:'queued',title:'Awaiting review',projectId:'active',closeout:{at:'2026-11-19'},entries:[{quantity:1,rate:10}]},
     {id:'returned',title:'Returned WO hidden',projectId:'active',entries:[]},
     {id:'remaining',title:'Remaining',projectId:'due',closeout:{reviewedAt:'2026-11-19'},entries:[{quantity:1,rate:10}]},
     {id:'linked',title:'Earlier bill',projectId:'due',closeout:{reviewedAt:'2026-11-19'},entries:[{quantity:1,rate:999}],invoice:{}},
     {id:'billed',title:'Billed',projectId:'done',entries:[{quantity:1,rate:999}],invoice:{}}
   ],ticketOverview:{clients:[{id:'payer',name:'BCI Sample'}],tickets:[
     {id:'rev',kind:'review',workorderId:'queued',status:'Ready for review'},
     {id:'rr',kind:'review',workorderId:'returned',status:'In progress'},
     {id:'opp',kind:'prospect',title:'New build opportunity',status:'New'}
   ]}},
   esc:value=>String(value??''),me:{},head:()=>'',table:(headers,rows)=>headers.join('|')+rows.join(''),
   modal:()=>{},f:()=>{},send:()=>{},show:()=>{},render:()=>{},projectLabel:p=>p.name,
   view:'tickets',fmt:value=>'$'+value,bill:order=>({total:order.entries.reduce((sum,item)=>sum+item.quantity*item.rate,0)}),today:()=> '2026-11-19'
 };
 const context=vm.createContext({document:{addEventListener(){}}});
 const app=new vm.SyntheticModule(Object.keys(mock),function(){for(const key of Object.keys(mock))this.setExport(key,mock[key]);},{context});
 const mail=new vm.SyntheticModule(['emailIntakePanel'],function(){this.setExport('emailIntakePanel',()=> '');},{context});
 const ui=new vm.SourceTextModule(readFileSync(new URL('../public/modules/tickets.js',import.meta.url),'utf8'),{context});
 await ui.link(name=>name==='../app.js'?app:mail);await ui.evaluate();
 const markup=ui.namespace.ticketsPage();
 for(const name of ['Work Order Tickets','Chasing Work','Projects','Invoicing','Awaiting review','New build opportunity','Active office','Billing office'])assert.ok(markup.includes(name),name);
 for(const absent of ['Returned WO hidden','Paid office','$999'])assert.ok(!markup.includes(absent),absent);
 assert.match(markup,/\$10 reviewed/);
});
