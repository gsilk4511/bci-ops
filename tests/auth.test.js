import test from 'node:test';
import assert from 'node:assert/strict';
import {roleFor,authorize,projectState} from '../Models/auth.js';
import {seed} from '../Models/lib.js';
test('allowlist restricts unknown user and role permissions',()=>{
 const s=seed(); assert.equal(roleFor(s,{email:'no@example.com'}),null);
 s.users=[{email:'field@example.com',role:'tech',active:true}];
 assert.equal(roleFor(s,{email:'field@example.com'}),'tech');
 assert.throws(()=>authorize('invoice.record','tech'),/Office/);
 assert.throws(()=>authorize('users.set','office'),/Admin/);
 assert.doesNotThrow(()=>authorize('entry.add','tech'));
 assert.throws(()=>authorize('entry.add',null),/allowlist/);
});
test('field state does not contain direct costs or purchases',()=>{
 const s=seed();const x=projectState(s,'tech');
 assert.equal(x.purchases.length,0);assert.equal('cost' in x.catalog[0],false);
 assert.equal('users' in x,false);
});
