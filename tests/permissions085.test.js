import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizePermission,effectiveAccess,normalizeProfileAccess,permissionMatrix,profileAccess,resolvedProfilePermissions} from '../Models/permissions.js';

const email='employee@example.invalid';
const actorFor=(profile)=>({users:[{email,role:'tech',profileId:'profile'}],permissionProfiles:[{id:'profile',...profile}]});
const rights=data=>effectiveAccess(actorFor(normalizeProfileAccess(data)),{email},'tech').permissions;
const check=(action,grants,data)=>authorizePermission(action,'tech',grants,data);

test('hidden modules strip even stale direct-action and read grants',()=>{
 const access=effectiveAccess(actorFor(normalizeProfileAccess({
  modes:{workorders:'hidden',tickets:'read',estimates:'hidden'},permissions:['workorders.view','receipt.read','entry.add','entry.remove','mail.intake','ticket.mail','estimate.accept','estimate.update']
 })),{email},'tech');
 assert.ok(access.permissions.includes('tickets.view'));
 assert.ok(access.permissions.includes('ticket.mail'));
 for(const denied of ['workorders.view','receipt.read','entry.add','entry.remove','mail.intake','estimates.view','estimate.accept','estimate.update']) {
  assert.ok(!access.permissions.includes(denied),denied);
  assert.throws(()=>check(denied,access.permissions),/denied/i);
 }
});

test('read-only keeps selected read permissions but denies otherwise eligible writes',()=>{
 const grants=rights({modes:{workorders:'read',tickets:'read',notifications:'read'},permissions:[
  'receipt.read','entry.add','entry.update','entry.remove','receipt.add','clock.in','ticket.note','ticket.watch','ticket.attachment','notification.manage'
 ]});
 check('receipt.read',grants);
 check('ticket.attachment',grants);
 for(const action of ['entry.add','entry.materialDraft','entry.update','entry.editNote','entry.remove','receipt.add','clock.in','clock.out','clock.cancel','ticket.note','ticket.watch','notification.save','notification.read','notification.subscribe']){
  assert.throws(()=>check(action,grants),/denied/i);
 }
});

test('ordinary writes, removal, and privileged mutations require distinct grants',()=>{
 const modes={workorders:'write',projects:'write',estimates:'write',customers:'write',pricing:'write'};
 const ordinary=['entry.update','project.update','workorder.create','estimate.create','pricing.profile.save'];
 const grants=rights({modes,permissions:ordinary});
 for(const action of ordinary)check(action,grants);
 for(const action of ['entry.remove','entry.manage','project.delete','project.close','workorder.approve','workorder.review','workorder.return','estimate.accept'])assert.throws(()=>check(action,grants),/denied/i);
 assert.throws(()=>check('pricing.profile.save',grants,{proposal:{kind:'archive'}}),/denied/i);
 const elevated=rights({modes,permissions:[...ordinary,'entry.remove','project.delete','pricing.profile.archive']});
 for(const action of ['entry.remove','project.delete'])check(action,elevated);
 check('pricing.profile.save',elevated,{proposal:{kind:'archive'}});
 assert.throws(()=>check('workorder.delete',[...elevated,'workorder.delete']),/Admin/);
 assert.throws(()=>check('record.assign',elevated),/Admin/);
});

test('legacy users retain own-row edits/removal and migrated read and helper grants only',()=>{
 const legacy={schemaVersion:3,permissions:['entry.add','workorders.view','tickets.view','notification.view','training.view']};
 const grants=resolvedProfilePermissions(legacy);
 for(const action of ['entry.update','entry.remove','receipt.add','receipt.read','ticket.watch','ticket.attachment','notification.manage','training.start'])assert.ok(grants.includes(action),action);
 for(const action of ['entry.manage','project.close','workorder.delete','staff.manage','staff.leaveReview'])assert.ok(!grants.includes(action),action);
 const explicit=normalizeProfileAccess({modes:{workorders:'write'},permissions:['entry.add']});
 assert.ok(!resolvedProfilePermissions(explicit).includes('entry.remove'));
});

test('matrix checks finance and cross-module work requirements',()=>{
 assert.throws(()=>rights({modes:{invoices:'read',workorders:'read'},permissions:[]}),/financial visibility/);
 assert.throws(()=>rights({modes:{invoices:'read'},permissions:['finance.view']}),/Work Orders/);
 const modes={invoices:'write',workorders:'read',projects:'read',estimates:'write',staff:'write'};
 const grants=rights({modes,permissions:['finance.view','billing.deposit','invoice.group','estimate.releaseWorkOrder','staff.internal']});
 check('billing.deposit',grants);check('invoice.group',grants);
 assert.throws(()=>check('estimate.releaseWorkOrder',grants),/Work order approval/);
 assert.throws(()=>check('staff.internal',grants),/Work order creation/);
});

test('scope inputs and admin retention are canonical and fail closed',()=>{
 assert.ok(permissionMatrix.workorders.delete.includes('entry.remove'));
 assert.ok(!permissionMatrix.workorders.delete.includes('workorder.delete'));
 assert.throws(()=>normalizeProfileAccess({permissions:[],modes:{unknown:'read'}}),/Invalid module/);
 assert.throws(()=>normalizeProfileAccess({permissions:[],recordScopes:{invoice:'own'}}),/Invalid record/);
 assert.throws(()=>normalizeProfileAccess({permissions:[],recordScopes:{projects:'unsafe'}}),/Invalid record/);
 const config=normalizeProfileAccess({modes:{projects:'read',team:'write'},recordScopes:{projects:'assigned'},permissions:['team.view','staff.manage','workorder.delete']});
 const result=profileAccess(config);
 assert.equal(result.modes.team,'hidden');
 assert.equal(result.recordScopes.projects,'assigned');
 assert.equal(result.recordScopes.workorders,'all');
 assert.ok(!result.permissions.includes('staff.manage'));
 const admin=effectiveAccess(actorFor(config),{email},'admin');
 assert.ok(admin.permissions.includes('workorder.delete')&&admin.permissions.includes('staff.manage'));
 assert.equal(admin.recordScopes.projects,'all');
 const corrupted=profileAccess({schemaVersion:4,modes:{projects:'all'},permissions:['projects.view']});
 assert.deepEqual(corrupted.permissions,[]);
});
