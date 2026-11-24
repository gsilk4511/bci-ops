import assert from 'node:assert/strict';
import test from 'node:test';
import {createEmailChannel} from '../UserSecurity/email-channel.js';

const base={BCI_EMAIL_SMTP_HOST:'smtp.example.test',BCI_EMAIL_SMTP_PORT:'587',
 BCI_EMAIL_SMTP_USER:'sender',BCI_EMAIL_SMTP_PASSWORD:'smtp-secret-test',BCI_EMAIL_FROM:'security@example.test'};
test('verified TLS and SMTP auth are mandatory; only the trusted identity is the envelope destination',async()=>{
 for(const port of ['465','587']){
  let calls=0;
  const channel=await createEmailChannel({...base,BCI_EMAIL_SMTP_PORT:port},{createTransport(options){
   assert.equal(options.secure,port==='465');assert.equal(options.requireTLS,port==='587');
   assert.equal(options.ignoreTLS,false);assert.deepEqual(options.auth,{user:'sender',pass:'smtp-secret-test'});
   assert.deepEqual(options.tls,{servername:base.BCI_EMAIL_SMTP_HOST,rejectUnauthorized:true,minVersion:'TLSv1.2'});
   assert.equal(options.logger,false);assert.equal(options.debug,false);
   return {async sendMail(message){
    calls++;assert.deepEqual(message.envelope,{from:base.BCI_EMAIL_FROM,to:['worker@example.test']});
    assert.equal(message.to.address,'worker@example.test');assert.match(message.text,/012345/);
    assert.doesNotMatch(message.subject,/012345/);assert.equal(message.html,undefined);
    return {accepted:['worker@example.test']};
   }};
  }});
  assert.equal(calls,0);
  await channel.sendCode({email:'worker@example.test',to:'bystander@example.test'},'012345');
  await assert.rejects(channel.sendCode({email:'worker@example.test,other@example.test'},'012345'),/^Error: Unable to deliver a sign-in code\.$/);
  await assert.rejects(channel.sendCode({email:'worker@example.test'},'12345'),/^Error: Unable to deliver a sign-in code\.$/);
  assert.equal(calls,1);
 }
});
test('bad config never reaches transport and SMTP errors/recipients do not leak to callers',async()=>{
 for(const config of [{BCI_EMAIL_SMTP_PORT:'25'},{BCI_EMAIL_SMTP_PASSWORD:''},{BCI_EMAIL_SMTP_HOST:'https://host.test'},{BCI_EMAIL_FROM:'Display <user@example.test>'}]){
  await assert.rejects(createEmailChannel({...base,...config},{createTransport(){assert.fail('invalid SMTP config used');}}),/^Error: Email sign-in delivery is not configured\.$/);
 }
 for(const sendMail of [async()=>{throw Error('vendor details and smtp-secret-test');},async()=>({accepted:[],rejected:['worker@example.test']})]){
  const channel=await createEmailChannel(base,{createTransport:()=>({sendMail})});
  await assert.rejects(channel.sendCode({email:'worker@example.test'},'012345'),error=>{
   assert.equal(error.message,'Unable to deliver a sign-in code.');
   assert.equal(error.cause,undefined);
   return true;
  });
 }
});
