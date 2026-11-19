import test from 'node:test';
import assert from 'node:assert/strict';
import {accessDescriptors,effectiveModuleAccess,profileEditorValues} from '../public/modules/access-matrix.js';

const descriptors=accessDescriptors({
 workorders:{view:'workorders.view',write:['entry.add'],actions:['workorder.review'],delete:['entry.remove','workorder.delete'],read:['receipt.read']},
 tickets:{view:'tickets.view',write:['ticket.create'],delete:['ticket.delete'],actions:['ticket.assign'],read:['ticket.mail']},
 team:{view:'team.view',write:['users.set'],adminOnly:true}
});

test('permission editor uses Hidden / Read / Write with separate destructive controls',()=>{
 const result=profileEditorValues(descriptors,{
  workorders:{mode:'read',scope:'assigned',permissions:['entry.add','workorder.review','entry.remove','receipt.read']},
  tickets:{mode:'write',scope:'own',permissions:['ticket.create','ticket.assign','workorders.view']},
  team:{mode:'write',permissions:['users.set']}
 });
 assert.deepEqual(result.modes,{workorders:'read',tickets:'write'});
 assert.deepEqual(result.recordScopes,{workorders:'assigned',tickets:'own'});
 assert.deepEqual(result.permissions,['workorders.view','receipt.read','tickets.view','ticket.create','ticket.assign']);
 assert.ok(!result.permissions.includes('ticket.delete'));
 const hidden=profileEditorValues(descriptors,{workorders:{mode:'hidden',scope:'all',permissions:['entry.add','receipt.read']}});
 assert.deepEqual(hidden.permissions,[]);
 assert.deepEqual(hidden.recordScopes,{});
});

test('effective access shows exact legacy rights and saved scope, not merely role name',()=>{
 const [work]=descriptors;
 const baseline=effectiveModuleAccess(work,{permissions:['workorders.view','receipt.read']});
 assert.equal(baseline.mode,'read');
 assert.equal(baseline.delete.length,0);
 const scoped=effectiveModuleAccess(work,{permissions:['workorders.view','entry.add','entry.remove'],recordScopes:{workorders:'own'}});
 assert.equal(scoped.mode,'write');
 assert.equal(scoped.scope,'own');
 assert.deepEqual(scoped.delete,['entry.remove']);
 assert.equal(effectiveModuleAccess(work,{permissions:['workorder.review']}).mode,'hidden');
});

test('permissions chosen in the editor round-trip through the server authorization model',async()=>{
 const {permissionMatrix,normalizeProfileAccess,effectiveAccess,authorizePermission}=await import('../Models/permissions.js');
 const real=accessDescriptors(permissionMatrix);
 const payload=profileEditorValues(real,{
  customers:{mode:'read',scope:'assigned',permissions:['customer.update']},
  workorders:{mode:'write',scope:'own',permissions:['entry.add','entry.remove','workorder.delete']},
  invoices:{mode:'hidden',scope:'all',permissions:['invoice.group','finance.view']},
  inventory:{mode:'read',scope:'assigned',permissions:['inventory.receive']}
 });
 const profile={id:'field-P',...normalizeProfileAccess(payload)};
 const user={email:'tech@example.invalid',role:'tech',profileId:profile.id};
 const access=effectiveAccess({users:[user],permissionProfiles:[profile]},user,'tech');
 assert.equal(access.modes.customers,'read');
 assert.equal(access.recordScopes.customers,'assigned');
 assert.equal(access.recordScopes.workorders,'own');
 assert.equal(access.recordScopes.inventory,'assigned');
 assert.equal(access.modes.invoices,'hidden');
 assert.ok(access.permissions.includes('entry.remove'));
 assert.ok(!access.permissions.includes('workorder.delete'));
 assert.ok(!access.permissions.includes('finance.view'));
 authorizePermission('entry.add','tech',access.permissions);
 assert.throws(()=>authorizePermission('customer.update','tech',access.permissions),/denied|permission/i);
});
