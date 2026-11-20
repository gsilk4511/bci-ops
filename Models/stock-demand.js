import {randomUUID} from 'node:crypto';

export const WAREHOUSE_LOCATION = 'BCI Warehouse';

const key = (catalogId, location) => JSON.stringify([catalogId, location]);
const round = value => Math.round(value * 100) / 100;
const leaseMs = 10 * 60 * 1000;
const open = order => order?.approvedAt && !order.closeout && !order.invoice;

export function stockProjection(state, now = Date.now()) {
  const rows = new Map(state.inventory.map(row => [
    key(row.catalogId, row.location), {...row, reserved:0}
  ]));
  for (const draft of state.materialDrafts || []) {
    if (draft.expiresAt <= now || !open(state.workorders.find(order => order.id === draft.workorderId))) continue;
    const id = key(draft.catalogId, draft.location);
    const row = rows.get(id) || {catalogId:draft.catalogId, location:draft.location, quantity:0, reserved:0};
    row.reserved = round(row.reserved + draft.quantity);
    rows.set(id, row);
  }
  return [...rows.values()].map(row => ({...row, projected:round(row.quantity - row.reserved)}));
}

export function reconcileStock(state, now = Date.now()) {
  state.materialDrafts = (state.materialDrafts || []).filter(draft =>
    draft.expiresAt > now && open(state.workorders.find(order => order.id === draft.workorderId)));
  const tickets = state.tickets ??= [];
  const shortages = new Map(stockProjection(state, now).filter(row => row.projected < 0)
    .map(row => [key(row.catalogId, row.location), row]));
  const timestamp = new Date(now).toISOString();
  for (const ticket of tickets.filter(ticket => ticket.kind === 'stock-shortage')) {
    if (shortages.has(ticket.stockKey) || ticket.status === 'Completed') continue;
    ticket.status = 'Completed';
    ticket.activity.push({id:randomUUID(), at:timestamp, by:'Inventory', message:'Projected stock is no longer below zero.', kind:'event'});
    ticket.revision = randomUUID();
  }
  for (const [stockKey, row] of shortages) {
    const part = state.catalog.find(item => item.id === row.catalogId);
    if (!part) continue;
    const description = `Buy ${-row.projected} ${part.unit} for ${row.location}. On hand: ${row.quantity}. Draft demand: ${row.reserved}.`;
    let ticket = tickets.find(ticket => ticket.kind === 'stock-shortage' && ticket.stockKey === stockKey);
    if (!ticket) {
      const id = randomUUID();
      ticket = {id, number:'STK-' + id.slice(0,8).toUpperCase(), kind:'stock-shortage', stockKey,
        title:'Buy more: ' + part.name, clientId:'', projectId:'', workorderId:'', contactId:'',
        priority:'Normal', assignee:'', due:'', createdAt:timestamp, createdBy:'Inventory', attachments:[], activity:[]};
      tickets.push(ticket);
    }
    if (ticket.description === description && ticket.status !== 'Completed') continue;
    if (!ticket.status || ticket.status === 'Completed') ticket.status = 'New';
    ticket.description = description;
    ticket.revision = randomUUID();
  }
}

export function updateMaterialDraft(state, data, actor) {
  if (!/^[a-f0-9-]{36}$/i.test(data.draftId || '')) throw Error('Invalid material draft');
  const drafts = state.materialDrafts ??= [];
  const index = drafts.findIndex(draft => draft.id === data.draftId && draft.email === actor.email && draft.workorderId === data.workorderId);
  if (data.clear === true) {
    if (index !== -1) drafts.splice(index, 1);
    return {cleared:true};
  }
  const order = state.workorders.find(item => item.id === data.workorderId);
  if (!open(order)) throw Error('Select an approved, open work order');
  const part = state.catalog.find(item => item.id === data.catalogId && item.type === 'material');
  const location = WAREHOUSE_LOCATION;
  const quantity = round(Number(data.quantity));
  if (!part || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e6)
    throw Error('Select a part and valid quantity');
  const change = data.changeId && order.changes.find(item => item.id === data.changeId);
  if (data.changeId && (change?.status !== 'approved' || !change.lines.some(line => line.catalogId === part.id)))
    throw Error('Choose a part on the approved change order');
  const draft = {id:data.draftId, email:actor.email, workorderId:order.id, catalogId:part.id, location, quantity, expiresAt:Date.now()+leaseMs};
  if (index === -1) drafts.push(draft);
  else drafts[index] = draft;
  return stockProjection(state).find(row => row.catalogId === part.id && row.location === location);
}
