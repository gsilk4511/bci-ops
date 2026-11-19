import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, applyAction } from '../Models/lib.js';
import { planPricing, pricingOverview } from '../Models/pricing-profiles.js';
import { authorizePermission } from '../Models/permissions.js';

function save(state, proposal) {
  const { fingerprint } = planPricing(state, proposal);
  return applyAction(state, 'pricing.profile.save', { proposal, fingerprint }, { email: 'office@example.com' });
}
function makeProfile(state, name, rules = {}) {
  return save(state, { kind: 'save', name, markup: 25, rules }).id;
}
function recordPart(state, orderId) {
  return applyAction(state, 'entry.add', { workorderId: orderId, type: 'material', catalogId: 'cat_2', quantity: 1 }).rate;
}
function receive(state, unitCost, date) {
  applyAction(state, 'inventory.receive', { catalogId: 'cat_2', quantity: 4, unitCost, date, location: 'Shop' });
}

test('actual material entries resolve company, client, project and work order rates', () => {
  const state = seed();
  const orderId = state.workorders[0].id;
  state.workorders[0].approvedAt = '2026-10-01';
  state.workorders[0].status = 'released';
  assert.equal(recordPart(state, orderId), 19);
  receive(state, 8, '2026-11-01');
  receive(state, 5, '2026-10-01');
  const company = makeProfile(state, 'Company');
  const client = makeProfile(state, 'Client', { cat_2: { fixed: 15, change: 18 } });
  const project = makeProfile(state, 'Project', { cat_2: { fixed: 20 } });
  const order = makeProfile(state, 'Work order', { cat_2: { fixed: 30, change: 35 } });
  save(state, { kind: 'assign', scope: 'company', id: company });
  assert.equal(recordPart(state, orderId), 10);
  save(state, { kind: 'assign', scope: 'client', targetId: state.customers[0].id, id: client });
  assert.equal(recordPart(state, orderId), 15);
  save(state, { kind: 'assign', scope: 'project', targetId: state.projects[0].id, id: project });
  assert.equal(recordPart(state, orderId), 20);
  save(state, { kind: 'assign', scope: 'workorder', targetId: orderId, id: order });
  receive(state, 12, '2026-11-10');
  assert.equal(recordPart(state, orderId), 30);
  const change = applyAction(state, 'change.create', {
    workorderId: orderId, category: 'add', description: 'Add jack',
    lines: [{ catalogId: 'cat_2', quantity: 2 }]
  });
  assert.equal(change.estimatedTotal, 70);
  state.workorders[0].changes[0].status = 'approved';
  save(state, { kind: 'save', id: order, name: 'Updated', markup: 25, rules: { cat_2: { fixed: 40, change: 45 } } });
  assert.equal(state.workorders[0].entries[0].rate, 19);
  assert.equal(state.workorders[0].changes[0].lines[0].rate, 35);
  assert.equal(applyAction(state, 'entry.add', {
    workorderId: orderId, type: 'material', catalogId: 'cat_2', quantity: 1, changeId: change.id
  }).rate, 35);
});

test('pricing preview is read-only and stale changes are rejected', () => {
  const state = seed();
  receive(state, 8, '2026-11-01');
  const proposal = { kind: 'save', name: 'Standard', markup: 25, rules: {} };
  const preview = planPricing(state, proposal);
  assert.equal(state.pricingProfiles, undefined);
  receive(state, 16, '2026-11-10');
  assert.throws(() => applyAction(state, 'pricing.profile.save', { proposal, fingerprint: preview.fingerprint }), /Preview again/);
  const id = makeProfile(state, 'Standard');
  save(state, { kind: 'assign', scope: 'company', id });
  assert.throws(() => planPricing(state, { kind: 'archive', id }), /assignments/);
  state.workorders[0].invoice = { amountPaid: 99 };
  assert.equal(pricingOverview(state, ['pricing.view']).clients[0].paid, null);
  assert.equal(pricingOverview(state, ['pricing.view', 'finance.view']).clients[0].paid, 99);
});

test('profile assignment, management, and bulk controls enforce separate grants', () => {
  const assignment = { proposal: { kind: 'assign', scope: 'project' } };
  assert.throws(() => authorizePermission('pricing.profile.preview', 'office', ['pricing.view', 'pricing.profile.assign'], assignment), /target view/);
  authorizePermission('pricing.profile.save', 'office', ['pricing.view', 'pricing.profile.assign', 'projects.view'], assignment);
  assert.throws(() => authorizePermission('pricing.profile.save', 'office', ['pricing.view', 'pricing.profile.save', 'projects.view'], assignment), /denied/i);
  assert.throws(() => authorizePermission('pricing.profile.save', 'office', ['pricing.view', 'pricing.profile.save'], { proposal: { kind: 'save', bulk: true } }), /Bulk pricing/);
});

test('client profile choices constrain new jobs and corrections reopen unbilled work',()=>{
 const state=seed();
 const client=state.customers[0];
 const first=makeProfile(state,'Beta T&M',{cat_2:{fixed:15}});
 const second=makeProfile(state,'Conduit',{cat_2:{fixed:25}});
 const unavailable=makeProfile(state,'Other',{cat_2:{fixed:99}});
 save(state,{kind:'client-options',targetId:client.id,ids:[first,second]});
 const fields={projectId:state.projects[0].id,description:'Install jack'};
 assert.throws(()=>applyAction(state,'workorder.create',{...fields,pricingProfileId:unavailable}),/available/);
 const orderId=applyAction(state,'workorder.create',{...fields,pricingProfileId:first}).id;
 const order=state.workorders.find(item=>item.id===orderId);
 order.approvedAt='2026-10-01';order.status='released';
 assert.equal(recordPart(state,orderId),15);
 applyAction(state,'workorder.close',{workorderId:orderId,submittedBy:'Crew'});
 applyAction(state,'workorder.review',{workorderId:orderId});
 const proposal={kind:'correct',targetId:orderId,id:second,reason:'Use conduit profile'};
 assert.equal(planPricing(state,proposal).changes[0].after,25);
 save(state,proposal);
 const corrected=state.workorders.find(item=>item.id===orderId);
 assert.equal(corrected.closeout,null);
 assert.equal(corrected.closeoutHistory[0].originalEntries[0].rate,15);
 assert.equal(corrected.entries[0].rate,25);
 assert.equal(corrected.status,'released');
 applyAction(state,'workorder.close',{workorderId:orderId,submittedBy:'Crew'});
 applyAction(state,'workorder.review',{workorderId:orderId});
 applyAction(state,'invoice.group',{workorderIds:[orderId],number:'QB-TEST',layout:'totals'});
 save(state,{...proposal,id:first});
 assert.equal(state.workorders.find(item=>item.id===orderId).entries[0].rate,25);
 assert.equal(state.projectInvoices[0].orders[0].entries[0].rate,25);
});
