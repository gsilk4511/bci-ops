import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {createMailbox,importMailboxPage,assignMail} from '../Models/mail-intake.js';
import {ticketOverview,ticketAttachment} from '../Models/tickets.js';
import {createPush,notificationAction,notificationEvents,pendingPush,recordPush,subscriptionFrom} from '../Models/notifications.js';
import {visibleState} from '../Models/visibility.js';

const identity='tenant:intake@example.com';
const principal={email:'office@example.com',permissions:['tickets.view','ticket.viewAll','ticket.mail','mail.intake','notification.view','ticket.assign']};
const message=(key,overrides={})=>({key,conversation:'thread',subject:'Cable repair',from:'billing@example.invalid',
  at:'2026-11-10T20:00:00.000Z',body:'Please help',recipients:['intake@example.com'],attachments:[],...overrides});

test('email import deduplicates, attaches replies, and queues forwarded or ambiguous messages',()=>{
 const state=seed(),client=state.customers[0];
 const first=message('one',{attachments:[{name:'test.txt',content:'dGVzdA=='}]});
 const forward=message('two',{subject:'FW: Change request',from:'office@example.com',body:'From: billing@example.invalid',conversation:'forward'});
 const firstPage={messages:[first,first,forward],next:'cursor-one'};
 assert.equal(importMailboxPage(state,identity,null,firstPage,'2026-11-01'),true);
 assert.equal(importMailboxPage(state,identity,null,firstPage,'2026-11-01'),false);
 assert.equal(state.tickets.length,1);
 assert.deepEqual(state.mailQueue[0].suggestions,[client.id]);
 importMailboxPage(state,identity,'cursor-one',{messages:[message('three',{subject:'Re: Cable repair'})],next:'cursor-two'},'2026-11-01');
 assert.equal(state.tickets.length,1);
 assert.equal(state.tickets[0].mailMessages.length,2);
 const {id}=assignMail(state,{key:'two',clientId:client.id});
 assert.ok(id);assert.equal(state.mailQueue.length,0);
 const [ticket]=ticketOverview(state,principal).tickets;
 const file=ticket.mail[0].attachments[0];
 assert.equal(file.content,undefined);
 assert.equal(ticketAttachment(state,{id:ticket.id,fileId:file.id},principal).content,'dGVzdA==');
 const limited={...principal,permissions:['tickets.view','ticket.viewAll']};
 assert.equal(ticketOverview(state,limited).tickets[0].mail.length,0);
 assert.throws(()=>ticketAttachment(state,{id:ticket.id,fileId:file.id},limited),/unavailable/);
 assert.equal(visibleState(state,'admin',principal.permissions).mailSeen,undefined);
});

test('Graph transport requests plain text and rejects external cursor origins',async()=>{
 const tenant='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const calls=[];
 const mailbox=createMailbox({BCI_MAIL_TENANT_ID:tenant,BCI_MAIL_CLIENT_ID:tenant,BCI_MAIL_CLIENT_SECRET:'test',BCI_MAIL_ADDRESS:'intake@example.com'},async(url,options)=>{
  calls.push({url:String(url),options});
  if(String(url).includes('login.microsoftonline.com'))return Response.json({access_token:'token',expires_in:3600});
  return Response.json({value:[{id:'m',internetMessageId:'test',receivedDateTime:'2026-11-10T20:00:00Z',
    subject:'Test',body:{content:'<script>text only</script>'},from:{emailAddress:{address:'billing@example.invalid'}}}],
    '@odata.deltaLink':'https://graph.microsoft.com/v1.0/users/intake%40example.com/mailFolders/inbox/messages/delta?token=test'});
 });
 const page=await mailbox.page(null,'2026-11-01');
 assert.equal(page.messages.length,1);
 assert.match(calls[1].options.headers.Prefer,/body-content-type="text"/);
 await assert.rejects(()=>mailbox.page('https://example.com/steal','2026-11-01'),/Invalid mailbox continuation/);
 assert.equal(calls.length,2);
});

test('phone events obey scope, preferences, quiet hours and per-device delivery receipts',async()=>{
 const state=seed();
 const {id}=applyAction(state,'ticket.create',{clientId:state.customers[0].id,title:'Private ticket',assignee:principal.email},principal);
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url'),auth:Buffer.alloc(16).toString('base64url')}};
 assert.throws(()=>subscriptionFrom({...subscription,endpoint:'https://localhost/test'}),/Unsupported/);
 notificationAction(state,'notification.subscribe',{subscription},principal);
 state.notificationUsers[0].devices[0].registeredAt='2026-01-01T00:00:00.000Z';
 const now=new Date('2026-11-10T22:00:00.000Z');
 assert.equal(notificationEvents(state,{email:'other@example.com',permissions:['tickets.view']},now).length,0);
 notificationAction(state,'notification.save',{assigned:true,quietStart:'21:00',quietEnd:'06:00',zone:'UTC'},principal);
 assert.equal(pendingPush(state,principal,now).length,0);
 notificationAction(state,'notification.save',{assigned:true,zone:'UTC'},principal);
 const [pending]=pendingPush(state,principal,now);
 assert.match(pending.event.url,new RegExp(id));
 let payload;
 const push=createPush({BCI_PUSH_PUBLIC_KEY:'a'.repeat(87),BCI_PUSH_PRIVATE_KEY:'a'.repeat(43),BCI_PUSH_SUBJECT:'mailto:ops@example.com'},
  {sendNotification:async(_,body)=>{payload=JSON.parse(body);}});
 await push.send(subscription,pending.event);
 assert.equal(payload.title,'BCI Operations');
 assert.ok(!JSON.stringify(payload).includes('Private ticket'));
 recordPush(state,principal.email,pending.device.id,pending.event.id,false);
 assert.equal(pendingPush(state,principal,now).length,0);
 notificationAction(state,'notification.read',{id:pending.event.id},principal);
 assert.equal(notificationEvents(state,principal,now)[0].read,true);
});
