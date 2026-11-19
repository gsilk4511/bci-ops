import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {ticketOverview,ticketAttachment} from '../Models/tickets.js';
import {authorizePermission} from '../Models/permissions.js';

const office={email:'office@example.com',permissions:['tickets.view','ticket.viewAll','ticket.assign','customers.view','projects.view','workorders.view','workorder.review','workorder.return']};
const tech={email:'tech@example.com',permissions:['tickets.view','projects.view','workorders.view']};

test('retries, corrections, resubmission and review reuse one ticket',()=>{
 const state=seed(), order=state.workorders[0];
 order.approvedAt='2026-11-10';order.status='released';
 applyAction(state,'entry.add',{workorderId:order.id,type:'material',catalogId:'cat_2',quantity:1},tech);
 const submit=()=>applyAction(state,'workorder.close',{workorderId:order.id,submittedBy:'Technician'},tech);
 submit();submit();
 assert.equal(state.tickets.length,1);
 const id=state.tickets[0].id;
 assert.equal(state.tickets[0].activity.length,1);
 assert.equal(ticketOverview(state,tech).tickets.length,1);
 applyAction(state,'workorder.return',{workorderId:order.id,reason:'Record travel'},office);
 assert.equal(order.closeout,null);
 assert.equal(order.closeoutHistory[0].originalEntries.length,1);
 assert.equal(state.tickets[0].status,'In progress');
 submit();
 assert.equal(state.tickets[0].id,id);
 applyAction(state,'workorder.review',{workorderId:order.id},office);
 assert.equal(state.tickets[0].status,'Completed');
 assert.equal(order.status,'reviewed');
 assert.equal(order.invoice,null);
});

test('existing pending closeout appears without writing a migration',()=>{
 const state=seed();
 state.workorders[0].closeout={at:'2026-11-10',submittedBy:'Crew'};
 assert.equal(ticketOverview(state,office).tickets[0].status,'Ready for review');
 assert.equal(state.tickets,undefined);
 applyAction(state,'workorder.review',{workorderId:state.workorders[0].id},office);
 assert.equal(state.tickets[0].status,'Completed');
});

test('manual ticket, attachment permission, link validation and Trash',()=>{
 const state=seed();
 const clientId=state.customers[0].id;
 assert.throws(()=>applyAction(state,'ticket.create',{clientId,projectId:'other',title:'Bad link'},office),/accessible project/);
 const {id}=applyAction(state,'ticket.create',{clientId,title:'Request',projectId:state.projects[0].id,workorderId:state.workorders[0].id},office);
 const content=Buffer.from('test file').toString('base64');
 applyAction(state,'ticket.attach',{id,name:'sample.txt',content},office);
 const [ticket]=ticketOverview(state,office).tickets;
 assert.equal(ticket.attachments[0].content,undefined);
 const fileId=ticket.attachments[0].id;
 assert.throws(()=>ticketAttachment(state,{id,fileId},tech),/unavailable/);
 assert.equal(ticketAttachment(state,{id,fileId},office).content,content);
 assert.throws(()=>applyAction(state,'workorder.delete',{ids:[state.workorders[0].id],confirmed:true,reason:'Testing'},office),/Admin access/);
 applyAction(state,'ticket.delete',{id,confirmed:true,revision:ticket.revision,reason:'Duplicate'},office);
 assert.equal(state.tickets.length,0);
 applyAction(state,'trash.restore',{ids:[state.trash[0].id]},office);
 assert.equal(state.tickets[0].id,id);
 assert.throws(()=>authorizePermission('ticket.attachment','tech',[]),/denied/i);
});
