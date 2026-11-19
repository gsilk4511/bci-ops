import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {roleFor} from '../Models/auth.js';
import {authorizePermission,effectivePermissions} from '../Models/permissions.js';
import {visibleState} from '../Models/visibility.js';

test('the same signed-in identity gets updated views and grants after Team changes',()=>{
 const state=seed();
 const actor={email:'crew@example.invalid'};
 const profile=applyAction(state,'profiles.save',{name:'Field',permissions:['workorders.view','entry.add']});
 applyAction(state,'users.set',{email:'CREW@example.invalid',role:'tech',profileId:profile.id,active:true});
 const rights=()=>effectivePermissions(state,actor,roleFor(state,actor));
 assert.ok(rights().includes('entry.add'));
 assert.equal(visibleState(state,'tech',rights()).workorders.length,1);
 applyAction(state,'profiles.save',{id:profile.id,name:'Field',permissions:['customers.view']});
 assert.equal(visibleState(state,'tech',rights()).workorders.length,0);
 assert.throws(()=>authorizePermission('entry.add','tech',rights()),/view permission/);
 applyAction(state,'users.set',{email:actor.email,role:'office',active:true});
 assert.ok(rights().includes('invoices.view'));
 applyAction(state,'users.set',{email:actor.email,role:'office',active:false});
 assert.equal(roleFor(state,actor),null);
});
test('legacy finance profiles retain invoice visibility until edited',()=>{
 const state=seed(),actor={email:'bookkeeper@example.invalid'};
 state.users.push({email:actor.email,role:'tech',profileId:'old'});
 state.permissionProfiles=[{id:'old',name:'Office custom',schemaVersion:2,permissions:['finance.view','workorders.view']}];
 assert.ok(effectivePermissions(state,actor,'tech').includes('invoices.view'));
 applyAction(state,'profiles.save',{id:'old',name:'Office custom',permissions:['finance.view','workorders.view']});
 assert.ok(!effectivePermissions(state,actor,'tech').includes('invoices.view'));
 assert.throws(()=>authorizePermission('invoice.pay','office',['invoice.pay','workorders.view']),/Finance access/);
});
