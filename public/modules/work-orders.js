import {workOrderTechnicianIcons} from './work-order-technician-icon.js';
import {recordTools, recordManager, managingRecords} from './records.js';
// Owns the work orders presentation. Shared state comes from the application shell.
import { can, bill, billingName, customer, data, empty, esc, fmt, head, labelFor, project, status, table } from '../app.js';

const releasedStates = new Set(['released', 'ready-for-review', 'reviewed', 'invoiced', 'paid']);
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'numeric', day: 'numeric', year: '2-digit', timeZone: 'America/New_York'
});

function createdDate(value) {
  if (!value) return 'Not recorded';
  // A date-only legacy value is already a calendar day, not midnight UTC.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const date = new Date(dateOnly ? value + 'T12:00:00Z' : value);
  if (!Number.isFinite(date.getTime())) return 'Not recorded';
  return `<time datetime="${dateOnly ? esc(value) : date.toISOString()}">${dateFormat.format(date)}</time>`;
}

function titleButton(w) {
  return `<button type="button" class="rowlink" data-wo="${esc(w.id)}">${esc(w.title)}</button>`;
}

function mobileRow(w) {
  const client = billingName(customer(project(w.projectId)?.customerId));
  const released = Boolean(w.approvedAt) || releasedStates.has(w.status);
  return `<li class="wo-mobile-item">
    <dl class="wo-mobile-meta">
      <div><dt>Client</dt><dd>${esc(client)}</dd></div>
      <div><dt>Release</dt><dd class="${released ? 'wo-release-yes' : 'wo-release-no'}">${released ? 'Released' : 'Not released'}</dd></div>
      <div><dt>Entries</dt><dd>${w.entries.length}</dd></div>
      <div><dt>Created</dt><dd>${createdDate(w.createdAt)}</dd></div>
    </dl>
    <div class="wo-mobile-main">
      ${titleButton(w)}${workOrderTechnicianIcons(w.entries,esc)}
      <p class="muted wo-mobile-scope">${esc(w.description || 'No scope recorded.')}</p>
    </div>
  </li>`;
}

export function workorders() {
  const actions=recordTools(true)+(can('workorder.create')?'<button class="primary" data-open="workorder">+ New Work Order</button>':'');
  const title=head('Work orders', 'Operations', 'Scope approval comes before job entries. Every entry stays linked to the work order.', actions?`<div class="gap workorders-list-actions">${actions}</div>`:'');
  if(managingRecords())return title+recordManager();
  const orders = data.workorders;
  const desktop = table(['Job', 'Customer / project', 'State', 'Entries', 'Estimated bill'], orders.map(w => `<tr><td>${titleButton(w)}${workOrderTechnicianIcons(w.entries,esc)}<div class="muted tiny">${esc((w.description || '').slice(0, 80))}</div></td><td>${esc(labelFor(w))}</td><td>${status(w.status)}</td><td>${w.entries.length}</td><td>${fmt(bill(w).total)}</td></tr>`));
  const mobile = orders.length ? `<ul class="wo-mobile-list" aria-label="Work orders">${orders.map(mobileRow).join('')}</ul>` : empty('No records found');
  return title
    + `<section class="panel"><div class="wo-desktop">${desktop}</div><div class="wo-mobile">${mobile}</div></section>`;
}
