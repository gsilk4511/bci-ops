import test from 'node:test';
import assert from 'node:assert/strict';
import {recordPrincipal,recordCanAccess,scopeState,authorizeRecordAction,assignRecord} from '../Models/record-scope.js';
import {ticketOverview} from '../Models/tickets.js';

const fixtures=()=>({
 customers:[{id:'c0',createdBy:'b@example.com'},{id:'c1',createdBy:'a@example.com',assignedTo:['a@example.com']}],
 projects:[{id:'p0',customerId:'c0',createdBy:'b@example.com'},{id:'p1',customerId:'c1',createdBy:'a@example.com',depositLedger:[{amount:52}],assignedTo:['a@example.com']}],
 workorders:[{id:'w0',projectId:'p0',createdBy:'b@example.com'},
 {id:'w1',projectId:'p1',createdBy:'a@example.com',invoice:{number:'qb-45',groupId:'g1',status:'sent'}},
 {id:'w2',projectId:'p1',createdBy:'b@example.com',closeout:{at:'2026-11-19',submittedEmail:'a@example.com'},invoice:{number:'qb-45',groupId:'g1',status:'sent'}}],
 tickets:[{id:'t0',kind:'manual',createdBy:'b@example.com',clientId:'c0',projectId:'p0',workorderId:'w0',attachments:[]},
 {id:'t1',kind:'manual',createdBy:'b@example.com',clientId:'c1',projectId:'p1',workorderId:'w1',assignedTo:['a@example.com'],attachments:[]},
 {id:'t2',kind:'review',createdBy:'b@example.com',clientId:'c1',projectId:'p1',workorderId:'w2',assignedTo:['a@example.com'],attachments:[]}],
 estimates:[{id:'e1',clientId:'c1',projectId:'p1',createdBy:'a@example.com'},{id:'e0',clientId:'c0',projectId:'p0',createdBy:'a@example.com'}],
 projectInvoices:[{id:'g1',projectId:'p1',createdBy:'a@example.com',orders:[{id:'w1'},{id:'w2'}]}],
 users:[{email:'a@example.com',active:true},{email:'inactive@example.com',active:false}]
});
const user={email:'A@Example.Com'};
const permissions=['tickets.view','ticket.viewAll','ticket.mail','workorder.review'];
const actor=(state,scopes)=>recordPrincipal(state,user,'office',permissions,scopes);
test('own and assigned scopes intersect linked records and hide incomplete billing summaries',()=>{
 const state=fixtures();
 const principal=actor(state,{customers:'assigned',projects:'assigned',workorders:'own',tickets:'assigned',estimates:'own',invoices:'own'});
 const visible=scopeState(state,principal);
 assert.deepEqual(visible.customers.map(x=>x.id),['c1']);
 assert.deepEqual(visible.projects.map(x=>x.id),['p1']);
 assert.deepEqual(visible.workorders.map(x=>x.id),['w1']);
 assert.deepEqual(visible.workorders[0].invoice,{status:'sent'});
 assert.equal(visible.projects[0].depositLedger,undefined);
 assert.deepEqual(visible.estimates.map(x=>x.id),['e1']);
 assert.deepEqual(visible.projectInvoices,[]);
 assert.deepEqual(ticketOverview(visible,principal).tickets.map(x=>x.id),['t1']);
 assert.equal(state.workorders[1].invoice.number,'qb-45');
 assert.equal(state.projects[1].depositLedger[0].amount,52);
});
test('direct references, grouped invoices, hidden linked receipts and bulk operations cannot escape scope',()=>{
 const state=fixtures();
 const principal=actor(state,{customers:'assigned',projects:'assigned',workorders:'own',tickets:'assigned',estimates:'own',invoices:'own'});
 for(const [action,data] of [
   ['workorder.update',{id:'w0'}],['receipt.read',{workorderId:'w0'}],['ticket.attachment',{id:'t2'}],
   ['invoice.pay',{workorderId:'w1'}],['invoice.group',{workorderIds:['w1','w2']}],
   ['estimate.update',{id:'e0',clientId:'c1'}],['project.close',{projectId:'p0'}],['billing.deposit',{projectId:'p1'}],
   ['workorder.deletePreview',{ids:['w1','w2']}],['workorder.create',{projectId:'p0'}]
 ]) assert.throws(()=>authorizeRecordAction(state,principal,action,data),/outside your access scope/,action);
 assert.doesNotThrow(()=>authorizeRecordAction(state,principal,'entry.add',{workorderId:'w1'}));
 assert.doesNotThrow(()=>authorizeRecordAction(state,principal,'ticket.note',{id:'t1'}));
});
test('unowned legacy records fail closed, assignment is admin only and default tickets retain existing checks',()=>{
 const state=fixtures();
 const principal=actor(state,{workorders:'own'});
 assert.equal(recordCanAccess({id:'legacy',title:'A@Example.Com'},'workorders',principal),false);
 const failClosed=actor(state,{projects:'unexpected'});
 assert.equal(recordCanAccess(state.projects[0],'projects',failClosed),false);
 assert.throws(()=>assignRecord(state,principal,{area:'projects',id:'p0',assignees:['a@example.com']}),/Admin access/);
 const admin={role:'admin',email:'admin@example.com'};
 assert.throws(()=>assignRecord(state,admin,{area:'projects',id:'p0',assignees:['inactive@example.com']}),/active team member/);
 assert.deepEqual(assignRecord(state,admin,{area:'projects',id:'p0',assignees:['A@example.com','a@example.com']}).assignedTo,['a@example.com']);
 assert.deepEqual(scopeState(state,actor(state,{projects:'assigned'})).projects.map(x=>x.id),['p0','p1']);
 assert.equal(recordCanAccess(state.tickets[0],'tickets',recordPrincipal(state,user,'office',['tickets.view'],{tickets:'all'})),false);
});
