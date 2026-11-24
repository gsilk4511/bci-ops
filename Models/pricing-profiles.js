import { createHash, randomUUID } from 'node:crypto';
import { clientPricingChoices, assignedPricing, latestPricingReceipt, orderRate, pricingNumber, profileRate } from './pricing.js';

const collections = { client: 'customers', project: 'projects', workorder: 'workorders' };
const decimal = (value, label, max) => {
  const amount = pricingNumber(value, label, max);
  return Math.round(amount * 100) / 100;
};

function validatedRules(state, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid item rates');
  const items = new Map(state.catalog.map(item => [item.id, item]));
  const rules = Object.create(null);
  for (const [id, values] of Object.entries(input)) {
    const item = items.get(id);
    if (!item || !values || typeof values !== 'object') throw Error('A pricing item is unavailable');
    const rule = {};
    if (values.fixed != null) rule.fixed = decimal(values.fixed, 'fixed price');
    if (values.markup != null) {
      if (item.type !== 'material' || rule.fixed != null) throw Error('Choose either a fixed price or a parts markup');
      rule.markup = decimal(values.markup, 'markup', 10000);
    }
    if (values.change != null) rule.change = decimal(values.change, 'change-order price');
    if (Object.keys(rule).length) rules[id] = rule;
  }
  return rules;
}

function assignmentTarget(state, scope, id) {
  if (scope === 'company') return [state, 'companyPricingProfileId'];
  const collection = Object.hasOwn(collections, scope) && collections[scope];
  const record = collection && state[collection].find(item => item.id === id);
  if (!record) throw Error('Choose an assignment target');
  if (scope === 'workorder' && (record.closeout || record.invoice)) throw Error('Completed work orders retain their pricing');
  return [record, 'pricingProfileId'];
}

function applyProposal(state, proposal) {
  state.pricingProfiles ??= [];
  const profile = state.pricingProfiles.find(item => item.id === proposal.id && !item.archived);
  switch (proposal.kind) {
    case 'save': {
      if (proposal.id && !profile) throw Error('Pricing profile is unavailable');
      const name = typeof proposal.name === 'string' ? proposal.name.trim() : '';
      if (!name || name.length > 100) throw Error('Enter a profile name up to 100 characters');
      if (state.pricingProfiles.some(item => !item.archived && item.id !== profile?.id && item.name.toLowerCase() === name.toLowerCase())) throw Error('A pricing profile already uses this name');
      const updated = { id: profile?.id || 'new-profile', name, markup: decimal(proposal.markup, 'default markup', 10000), rules: validatedRules(state, proposal.rules) };
      if (profile) Object.assign(profile, updated);
      else state.pricingProfiles.push(updated);
      return updated;
    }
    case 'client-options': {
      const [client]=assignmentTarget(state,'client',proposal.targetId);
      if(!Array.isArray(proposal.ids)||proposal.ids.length>200)throw Error('Choose available profiles');
      const ids=[...new Set(proposal.ids)];
      if(ids.some(id=>!state.pricingProfiles.some(item=>item.id===id&&!item.archived)))throw Error('A profile is unavailable');
      client.pricingProfileIds=ids;
      return null;
    }
    case 'correct': {
      const order=state.workorders.find(item=>item.id===proposal.targetId);
      if(!order)throw Error('Work order unavailable');
      const project=state.projects.find(item=>item.id===order.projectId);
      const client=state.customers.find(item=>item.id===project?.customerId);
      if(proposal.id&&(!profile||!clientPricingChoices(state,client).some(item=>item.id===profile.id)))throw Error('Choose a pricing profile available to this client');
      if(typeof proposal.reason!=='string'||!proposal.reason.trim()||proposal.reason.length>500)throw Error('Enter a correction reason');
      order.pricingProfileId=profile?.id||null;
      // A posted invoice is a financial snapshot. Assignment changes here do
      // not rewrite its entries, balances, or QuickBooks references.
      if(order.invoice)return profile;
      if(order.closeout){
        (order.closeoutHistory??=[]).push(order.closeout);
        order.closeout=null;
        order.status='released';
        const ticket=(state.tickets||[]).find(item=>item.kind==='review'&&item.workorderId===order.id);
        if(ticket)ticket.status='In progress';
      }
      for(const entry of order.entries){
        if(entry.sharedTravel)continue;
        if(entry.changeId||(!Object.hasOwn(entry,'changeId')&&order.changes.some(change=>change.status==='approved'&&change.lines.some(line=>line.catalogId===entry.catalogId))))continue;
        const item=state.catalog.find(item=>item.id===entry.catalogId);
        if(!item)throw Error('A work entry is missing its pricing item');
        const rate=orderRate(state,order,item,project,client,entry.cost??item.cost);
        if(rate==null)throw Error('Set a price for '+item.name+' before correcting this work order');
        entry.rate=rate;
      }
      return profile;
    }
    case 'assign': {
      if (proposal.id && !profile) throw Error('Pricing profile is unavailable');
      const [record, key] = assignmentTarget(state, proposal.scope, proposal.targetId);
      if(profile&&['project','workorder'].includes(proposal.scope)){
        const parent=proposal.scope==='project'?record:state.projects.find(item=>item.id===record.projectId);
        const client=state.customers.find(item=>item.id===parent?.customerId);
        if(!clientPricingChoices(state,client).some(item=>item.id===profile.id))throw Error('Choose a profile available to this client');
      }
      record[key] = profile?.id || null;
      return profile;
    }
    case 'archive': {
      if (!profile) throw Error('Pricing profile is unavailable');
      if ((state.estimates||[]).some(estimate=>estimate.pricingProfileId===profile.id) || state.companyPricingProfileId === profile.id ||
        Object.values(collections).some(collection => state[collection].some(record => (record.pricingProfileId === profile.id||record.pricingProfileIds?.includes(profile.id)))) ||
        (state.trash || []).some(item => (item.record.pricingProfileId === profile.id||item.record.pricingProfileIds?.includes(profile.id)))) {
        throw Error('Remove this profile from its assignments before archiving it');
      }
      profile.archived = true;
      return profile;
    }
    default: throw Error('Invalid pricing profile action');
  }
}

function draftChanges(state, next) {
  const changes = [];
  for (const order of next.workorders) {
    // Original scope approvals and change-order lines remain historical.
    if (order.approvedAt || order.approval || order.closeout || order.invoice) continue;
    const project = next.projects.find(item => item.id === order.projectId);
    const client = next.customers.find(item => item.id === project?.customerId);
    const original = state.workorders.find(item => item.id === order.id);
    const before = assignedPricing(state, original, project && state.projects.find(item => item.id === project.id), client && state.customers.find(item => item.id === client.id)).profile;
    const after = assignedPricing(next, order, project, client).profile;
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    for (const entry of order.entries) {
      if (entry.sharedTravel||entry.changeId) continue;
      const item = next.catalog.find(candidate => candidate.id === entry.catalogId);
      if (!item) continue;
      const rate = orderRate(next, order, item, project, client, entry.cost ?? item.cost);
      if (rate == null || rate === entry.rate) continue;
      changes.push({ order: order.title, entry: entry.name, before: entry.rate, after: rate });
      entry.rate = rate;
    }
  }
  return changes;
}

// Preview is deterministic. The save rechecks it inside the existing database
// transaction, so a stale preview cannot apply against changed assignments or rates.
export function planPricing(state, proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) throw Error('Enter pricing changes');
  const next = structuredClone(state);
  const profile = applyProposal(next, proposal);
  const changes = proposal.kind==='correct'?next.workorders.find(item=>item.id===proposal.targetId).entries.flatMap(entry=>{
    const original=state.workorders.find(item=>item.id===proposal.targetId);
    const before=original.entries.find(item=>item.id===entry.id)?.rate;
    return before===entry.rate?[]:[{order:original.title,entry:entry.name,before,after:entry.rate}];
  }):draftChanges(state, next);
  const before = state.pricingProfiles?.find(item => item.id === proposal.id) ?? null;
  const assignment = proposal.kind === 'assign' ? assignmentTarget(state, proposal.scope, proposal.targetId) : null;
  const previousAssignment = assignment ? assignment[0][assignment[1]] ?? null : null;
  const assignmentRates = (snapshot, item, channel) => {
    if (proposal.scope === 'company') {
      const company = snapshot.pricingProfiles?.find(item => item.id === snapshot.companyPricingProfileId);
      return company ? profileRate(snapshot, company, item, null, channel) : orderRate(snapshot, null, item, null, null, item.cost, channel);
    }
    const order = proposal.scope === 'workorder' ? snapshot.workorders.find(item => item.id === proposal.targetId) : null;
    const projectId = proposal.scope === 'project' ? proposal.targetId : order?.projectId;
    const project = snapshot.projects.find(item => item.id === projectId);
    const clientId = proposal.scope === 'client' ? proposal.targetId : project?.customerId;
    const client = snapshot.customers.find(item => item.id === clientId);
    return orderRate(snapshot, order, item, project, client, item.cost, channel);
  };
  const rates = !['save','assign'].includes(proposal.kind) ? [] : state.catalog.flatMap(item => {
    const oldRate = proposal.kind === 'assign' ? assignmentRates(state, item, 'standard') :
      before ? profileRate(state, before, item, null, 'standard') : item.price;
    const newRate = proposal.kind === 'assign' ? assignmentRates(next, item, 'standard') : profileRate(next, profile, item, null, 'standard');
    const oldChange = proposal.kind === 'assign' ? assignmentRates(state, item, 'change') :
      before ? profileRate(state, before, item, null, 'change') : item.changePrice;
    const newChange = proposal.kind === 'assign' ? assignmentRates(next, item, 'change') : profileRate(next, profile, item, null, 'change');
    return oldRate === newRate && oldChange === newChange ? [] : [{ name: item.name, oldRate, newRate, oldChange, newChange }];
  });
  const fingerprint = createHash('sha256').update(JSON.stringify({
    proposal, before, previousAssignment, rates, changes,
    assignments: Object.values(collections).map(collection => state[collection].map(record => [record.id, record.pricingProfileId, record.pricingProfileIds])),
    correction:proposal.kind==='correct'?state.workorders.find(item=>item.id===proposal.targetId):undefined,
    company: state.companyPricingProfileId
  })).digest('hex');
  return { next, profile, changes, rates, fingerprint, before, previousAssignment };
}

export function savePricing(state, data, actor) {
  const plan = planPricing(state, data.proposal);
  if (data.fingerprint !== plan.fingerprint) throw Error('Pricing changed since the preview. Preview again before saving.');
  if (plan.profile?.id === 'new-profile') plan.profile.id = randomUUID();
  Object.assign(state, plan.next);
  (state.events ??= []).unshift({
    id: randomUUID(), at: new Date().toISOString(), action: 'pricing.' + data.proposal.kind,
    reference: plan.profile?.id || data.proposal.targetId || 'company',
    actor: actor.email, detail: JSON.stringify({ before: plan.before, previousAssignment: plan.previousAssignment, proposal: data.proposal, changes:plan.changes })
  });
  return { id: plan.profile?.id, changedEntries: plan.changes.length };
}

export function pricingOverview(state, permissions) {
  const canSeeCosts = permissions.includes('finance.view');
  const paid = new Map();
  const projects = new Map(state.projects.map(project => [project.id, project]));
  if (canSeeCosts) for (const order of state.workorders) {
    const clientId = projects.get(order.projectId)?.customerId;
    if (clientId && order.invoice) paid.set(clientId, (paid.get(clientId) || 0) + (Number(order.invoice.amountPaid) || 0));
  }
  return {
    profiles: state.pricingProfiles || [],
    companyProfileId: state.companyPricingProfileId,
    clients: state.customers.map(client => ({
      id: client.id, profileIds:client.pricingProfileIds, name: client.business || client.name, profileId: client.pricingProfileId,
      projectOverrides: state.projects.filter(project => project.customerId === client.id && project.pricingProfileId).length,
      paid: canSeeCosts ? paid.get(client.id) || 0 : null
    })),
    projects: (permissions.includes('projects.view') ? state.projects : []).map(project => ({ id: project.id, clientId:project.customerId, name: [project.number, project.name].filter(Boolean).join(' · '), profileId: project.pricingProfileId })),
    orders: (permissions.includes('workorders.view') ? state.workorders : []).map(order => ({ id: order.id, clientId:projects.get(order.projectId)?.customerId, locked:!!(order.closeout||order.invoice), invoiced:!!order.invoice, name: order.title, profileId: order.pricingProfileId })),
    items: state.catalog.map(item => {
      const receipt = latestPricingReceipt(state, item.id);
      return { id: item.id, received: Boolean(receipt), cost: canSeeCosts ? receipt?.unitCost ?? null : null, date: canSeeCosts ? receipt?.date : null };
    })
  };
}
