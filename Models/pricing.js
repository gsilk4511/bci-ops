export const serviceCategories=['Direct to client','Subcontractor','T&M'];
const cents=value=>Math.round((value+Number.EPSILON)*100)/100;
export function pricingNumber(value,label,max=1e8){
  if(!['string','number'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>max)throw Error('Enter a valid '+label);
  return Number(value);
}
export function partRule(data){
  const mode=data.mode;
  if(mode==='inherit')return null;
  if(!['fixed','markup','threshold'].includes(mode))throw Error('Select a pricing rule');
  const rule={mode};
  if(mode!=='markup')rule.fixed=pricingNumber(data.fixed,'fixed price');
  if(mode!=='fixed')rule.markup=pricingNumber(data.markup,'markup percentage',10000);
  if(mode==='threshold')rule.threshold=pricingNumber(data.threshold,'cost threshold');
  return rule;
}
export function sellingRate(item,client,project,cost){
  if(item.type!=='material')return item.serviceRates?.[project?.serviceCategory]??item.price;
  const rule=client?.partPricing?.[item.id];
  if(rule?.mode==='fixed'||(rule?.mode==='threshold'&&cost<rule.threshold))return cents(rule.fixed);
  const markup=rule?.markup??client?.partsMarkup;
  return markup==null?item.price:cents(cost*(1+markup/100));
}
export function repriceOpenOrders(state,{catalogId,customerId,projectId}={}){
  let updated=0;
  const items=new Map(state.catalog.map(item=>[item.id,item]));
  const projects=new Map(state.projects.map(project=>[project.id,project]));
  const clients=new Map(state.customers.map(client=>[client.id,client]));
  for(const order of state.workorders){
    if(order.closeout||order.invoice||['ready-for-review','reviewed','invoiced','paid','completed','closed'].includes(order.status))continue;
    const project=projects.get(order.projectId);
    if(customerId&&project?.customerId!==customerId||projectId&&order.projectId!==projectId)continue;
    const client=clients.get(project?.customerId);
    // Legacy pricing edits cannot overwrite entries governed by a saved profile.
    if(assignedPricing(state,order,project,client).profile)continue;
    // Older entries lack a change-order link. Keep any potentially signed lines at their existing price.
    const signedItems=new Set((order.changes||[]).filter(change=>change.status==='approved').flatMap(change=>change.lines.map(line=>line.catalogId)));
    for(const entry of order.entries){
      if(entry.sharedTravel)continue;
      if(catalogId&&entry.catalogId!==catalogId||customerId&&entry.type!=='material'||entry.changeId||
          !Object.hasOwn(entry,'changeId')&&signedItems.has(entry.catalogId))continue;
      const item=items.get(entry.catalogId);
      if(!item)continue;
      const rate=sellingRate(item,client,project,entry.cost??item.cost);
      if(rate!==entry.rate){entry.rate=rate;updated++;}
    }
  }
  return updated;
}

// Resolve the most specific assignment. Archived profiles cannot be assigned.
export function assignedPricing(state, order, project, client) {
  const scopes = [
    [order?.pricingProfileId, 'Work order'],
    [project?.pricingProfileId, 'Project'],
    [client?.pricingProfileId, 'Client'],
    [state.companyPricingProfileId, 'Company default']
  ];
  for (const [id, scope] of scopes) {
    if (!id) continue;
    const profile = state.pricingProfiles?.find(candidate => candidate.id === id && !candidate.archived);
    if (profile) return { profile, scope };
  }
  return { profile: null, scope: 'Existing rates' };
}

// Sort by purchase date, then entry time, to support backdated receipts.
export function latestPricingReceipt(state, itemId) {
  let latest;
  for (const receipt of state.purchases) {
    if (receipt.catalogId !== itemId || !Number.isFinite(receipt.unitCost)) continue;
    if (!latest || (receipt.date || '') > (latest.date || '') ||
      receipt.date === latest.date && (receipt.at || '') > (latest.at || '')) latest = receipt;
  }
  return latest;
}

export function profileRate(state, profile, item, project, channel) {
  const rule = profile.rules[item.id];
  if (channel === 'change' && rule?.change != null) return rule.change;
  if (rule?.fixed != null) return rule.fixed;
  if (item.type !== 'material' && item.needsPricing) return null;
  if (item.type === 'material') {
    const receipt = latestPricingReceipt(state, item.id);
    // A zero-cost receipt is valid. A missing receipt requires an explicit fixed rate.
    if (!receipt) return null;
    return cents(receipt.unitCost * (1 + (rule?.markup ?? profile.markup) / 100));
  }
  return channel === 'change' ? item.changePrice : sellingRate(item, null, project, item.cost);
}

export function orderRate(state, order, item, project, client, cost, channel = 'standard') {
  const { profile } = assignedPricing(state, order, project, client);
  if (profile) return profileRate(state, profile, item, project, channel);
  if (item.needsPricing) return null;
  return channel === 'change' ? item.changePrice : sellingRate(item, client, project, cost);
}

// An explicit client list limits the profiles offered for its jobs.
export function clientPricingChoices(state, client) {
  const ids = client?.pricingProfileIds;
  return (state.pricingProfiles || []).filter(profile=>!profile.archived &&
    (!Array.isArray(ids)||ids.includes(profile.id)||client.pricingProfileId===profile.id));
}
