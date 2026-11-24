import test from 'node:test';
import assert from 'node:assert/strict';
import {listAgentCredentials,issueAgentCredential,revokeAgentCredential,authorizeAgentCredential,agentStatus} from '../UserSecurity/agent-api.js';

test('status credentials disclose secret exactly once, authenticate narrowly and honor immediate revocation',()=>{
  const store={};
  const created=issueAgentCredential(store,{name:'Randy Agent test',days:2},'admin-test',1000);
  const {token,credential}=created;
  assert.ok(token.startsWith('bci1_'+credential.id+'.'));
  assert(!JSON.stringify(store).includes(token));
  assert(!JSON.stringify(store).includes(token.split('.')[1]));
  assert.deepEqual(listAgentCredentials(store),[credential]);
  assert.equal(authorizeAgentCredential(store,'Bearer '+token.replace(/.$/,x=>x==='A'?'B':'A'),1001),null);
  assert.equal(authorizeAgentCredential(store,'Bearer '+token,credential.expiresAt),null);
  const principal=authorizeAgentCredential(store,'Bearer '+token,1001);
  assert.deepEqual(agentStatus(principal,'0.9.5'),{ok:true,release:'0.9.5',scope:'status:read'});
  assert.throws(()=>agentStatus({...principal,scope:'state:read'},'0.9.5'),/denied/);
  revokeAgentCredential(store,credential.id,'admin-test',1100);
  assert.equal(authorizeAgentCredential(store,'Bearer '+token,1101),null);
  assert.equal(listAgentCredentials(store)[0].revokedAt,1100);
  assert.deepEqual(store.agentAudit.map(x=>x.event),['agent.revoke','agent.issue']);
  assert(!Object.hasOwn(store.agentCredentials[0],'digest'));
});
test('issuance is bounded and no requested scale, long expiry or scope overrides widen the machine identity',()=>{
 const store={};
 assert.throws(()=>issueAgentCredential(store,{name:'Example',days:0},'test'),/Expiry/);
 assert.throws(()=>issueAgentCredential(store,{name:'\u0000test',days:2},'test'),/safe/);
 for(let i=0;i<20;i++)assert.equal(issueAgentCredential(store,{name:'test',days:1,scope:'admin'},'test').credential.scope,'status:read');
 assert.throws(()=>issueAgentCredential(store,{name:'test',days:1},'test'),/Revoke/);
 assert.equal(authorizeAgentCredential(store,'test-token-in-query'),null);
});
