// Owns the pricing presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { can, catalog, data, esc, fmt, head, table, modal, f, send, show } from '../app.js';

const activeItems=()=>data.catalog.filter(item=>item.type!=='material'||item.warehouseArchived!==true);
const addCatalogItem=()=>can('pricing.view')&&can('catalog.create')?'<button class="primary" data-open="catalog">+ Add item</button>':'';
function baseRates({showHeader = true} = {}) {
 const controls = `${can('pricing.client')?'<button class="secondary" data-open="client-markup">Client parts markup</button>':''}${can('pricing.project')?'<button class="secondary" data-open="project-rate">Project rate category</button>':''}`;
 const header = showHeader ? head('Pricing','Pricing control','Set service rates and billing-client parts pricing. Open work updates when you save.',`<div class="gap">${addCatalogItem()}${controls}</div>`)
  : controls ? `<div class="gap">${controls}</div>` : '';
 return header + `<section class="panel">${table(['Group','Item / SKU','Type','Base','Change order','Cost',''],activeItems().map(x=>`<tr><td>${esc(x.group)}</td><td><b>${esc(x.name)}</b><div class="tiny muted">${esc(x.sku)}</div></td><td>${esc(x.type)}${x.needsPricing?'<div class="warn tiny">Needs pricing</div>':''}</td><td>${fmt(x.price)}</td><td>${fmt(x.changePrice)}</td><td>${can('finance.view')?fmt(x.cost):'—'}</td><td>${can('catalog.update')?`<button class="secondary small" data-edit-catalog="${esc(x.id)}">Edit rates</button>`:''}${x.type==='material'&&can('pricing.part')?` <button class="secondary small" data-part-pricing="${esc(x.id)}">Client price</button>`:''}</td></tr>`))}</section>`;
}

const profileAccess = () => can('pricing.profile.save');
const archiveAccess = () => can('pricing.profile.archive');
const assignAccess = () => can('pricing.profile.assign');
const bulkAccess = () => can('pricing.profile.bulk');
const activeProfiles = () => (data.pricingOverview?.profiles || []).filter(profile => !profile.archived);
const rateLabel = value => value == null ? 'Needs price' : fmt(value);

export function catalogPage() {
  const overview = data.pricingOverview;
  if (!overview) return baseRates();
  const profiles = activeProfiles();
  const profileName = id => profiles.find(profile => profile.id === id)?.name || 'Existing rates';
  const clientRows = overview.clients.map(client => `<tr>
    <td>${esc(client.name)}</td><td>${esc(profileName(client.profileId || overview.companyProfileId))}</td>
    <td>${client.projectOverrides}</td>${can('finance.view') ? '<td>' + fmt(client.paid) + '</td>' : ''}
    <td>${assignAccess() ? `<button class="secondary small" data-assign-price="client" data-target="${esc(client.id)}">Default profile</button> <button class="secondary small" data-assign-price="client-options" data-target="${esc(client.id)}">Available profiles</button>` : ''}</td></tr>`);
  return head('Pricing', 'Rates and profiles', 'Assign prices to clients, projects, and work orders.',
    `<div class="gap">${addCatalogItem()}${profileAccess() ? '<button class="primary" data-price-profile="">New profile</button>' : ''}</div>`) +
    '<section class="panel"><h2>Billing clients</h2>' +
    table(['Client', 'Effective profile', 'Project overrides', ...(can('finance.view') ? ['Confirmed payments'] : []), ''], clientRows) +
    '</section><section class="panel"><h2>Pricing profiles</h2><p>Company default · ' + esc(profileName(overview.companyProfileId)) + '</p>' +
    (assignAccess() ? '<button class="secondary" data-assign-price="company">Set company default</button>' : '') +
    table(['Profile', 'Parts markup', 'Item rules', ''], profiles.map(profile => `<tr><td>${esc(profile.name)}</td><td>${profile.markup}%</td>
      <td>${Object.keys(profile.rules).length}</td><td>${profileAccess() ? `
      <button class="secondary small" data-price-profile="${esc(profile.id)}">Edit</button>
      <button class="secondary small" data-price-copy="${esc(profile.id)}">Duplicate</button>` : ''}${archiveAccess()?`
      <button class="secondary small" data-price-archive="${esc(profile.id)}">Archive</button>`:''}</td></tr>`)) +
    '</section><details class="panel"><summary>Base catalog rates and existing pricing rules</summary>' + baseRates({showHeader:false}) + '</details>';
}

// Both assignments and profile edits use the same server preview before Save.
function pricingDialog(title, fields, proposal, intro = '') {
  let preview;
  modal(title, fields + `<button type="button" class="secondary" data-preview-price>Preview changes</button>
    <div data-price-preview aria-live="polite"></div>`, async () => {
    const current = proposal(form);
    if (!preview || preview.input !== JSON.stringify(current)) throw Error('Preview the current changes before saving');
    await send('pricing.profile.save', { proposal: current, fingerprint: preview.fingerprint });
  }, intro);
  const form = document.querySelector('#actionForm');
  const result = form.querySelector('[data-price-preview]');
  const save = form.querySelector('button[type=submit]');
  save.disabled = true;
  form.addEventListener('input', () => {
    preview = undefined;
    save.disabled = true;
    result.replaceChildren();
  });
  form.querySelector('[data-preview-price]').addEventListener('click', async event => {
    const button = event.currentTarget;
    save.disabled = true;
    button.disabled = true;
    preview = undefined;
    try {
      if (!form.reportValidity()) return;
      const current = proposal(form);
      const input = JSON.stringify(current);
      const response = await fetch('/api/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pricing.profile.preview', data: { proposal: current } })
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Pricing preview failed');
      if (input !== JSON.stringify(proposal(form))) return;
      const { rates, changes, changedEntries, fingerprint } = body.result;
      result.innerHTML = '<p>' + rates.length + ' item rates changed · ' + changedEntries + ' existing work entries affected</p>' +
        (rates.length ? table(['Item', 'Standard before', 'Standard after', 'Change before', 'Change after'], rates.map(row =>
          `<tr><td>${esc(row.name)}</td><td>${rateLabel(row.oldRate)}</td><td>${rateLabel(row.newRate)}</td><td>${rateLabel(row.oldChange)}</td><td>${rateLabel(row.newChange)}</td></tr>`)) : '') +
        (changes.length ? table(['Work order', 'Item', 'Before', 'After'], changes.map(row =>
          `<tr><td>${esc(row.order)}</td><td>${esc(row.entry)}</td><td>${fmt(row.before)}</td><td>${fmt(row.after)}</td></tr>`)) : '');
      preview = { input, fingerprint };
      save.disabled = false;
    } catch (error) {
      result.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  return form;
}

function profileEditor(profile, duplicate) {
  const items = activeItems();
  const inventory = new Map(data.pricingOverview.items.map(item => [item.id, item]));
  const rules = profile?.rules || {};
  const preservedArchivedRules=Object.fromEntries(data.catalog.filter(item=>item.type==='material'&&item.warehouseArchived===true&&Object.hasOwn(rules,item.id)).map(item=>[item.id,rules[item.id]]));
  const overview = data.pricingOverview;
  const uses = [overview.companyProfileId === profile?.id && profile ? 'Company default' : '',
    ...[...overview.clients, ...overview.projects, ...overview.orders].filter(item => profile && item.profileId === profile.id).map(item => item.name)
  ].filter(Boolean);
  let bulk = false;
  const input = (name, label, value) => `<input aria-label="${esc(label)}" name="${name}" type="number" step="0.01" min="0" value="${esc(value ?? '')}">`;
  const rows = items.map((item, index) => {
    const rule = rules[item.id] || {};
    const receipt = inventory.get(item.id);
    return `<tr data-price-row="${index}" data-item-type="${esc(item.type)}" data-search="${esc([item.name, item.sku, item.group, item.type, item.manufacturer].join(' ').toLowerCase())}">
      ${bulkAccess() ? `<td><input type="checkbox" aria-label="Select ${esc(item.name)}" data-bulk-select></td>` : ''}
      <td>${esc(item.name)}<div class="tiny muted">${esc([item.type, item.unit, item.sku, item.manufacturer].filter(Boolean).join(' · '))}</div>
      ${item.type === 'material' && !receipt?.received ? '<div class="warn tiny">No purchase receipt</div>' : ''}</td>
      ${can('finance.view') ? '<td>' + rateLabel(receipt?.cost) + (receipt?.date ? '<br>' + esc(receipt.date) : '') + '</td>' : ''}
      <td>${input('fixed' + index, 'Fixed rate for ' + item.name, rule.fixed)}</td>
      <td>${item.type === 'material' ? input('markup' + index, 'Markup for ' + item.name, rule.markup) : '—'}</td>
      <td>${input('change' + index, 'Change-order rate for ' + item.name, rule.change)}</td></tr>`;
  });
  const form = pricingDialog(profile && !duplicate ? 'Edit pricing profile' : 'New pricing profile',
    f('name', 'Profile name', { required: true, value: duplicate ? profile.name + ' copy' : profile?.name }) +
    (profile && !duplicate ? '<label class="signature-terms"><input type="checkbox" name="saveCopy"> Save as a new profile (enter a new name)</label>' : '') +
    f('markup', 'Default parts markup %', { type: 'number', required: true, min: 0, step: '0.01', value: String(profile?.markup ?? 25) }) +
    '<p>Enter either a fixed rate or a markup for each part. Blank part rates use the default markup. Blank service rates use the base rate.</p>' +
    (uses.length && !duplicate ? '<details><summary>Current assignments (' + uses.length + ')</summary><p>' + uses.map(esc).join('<br>') + '</p></details>' : '') +
    '<div class="filters"><label>Find items<input type="search" data-price-search placeholder="Name, SKU, group or manufacturer"></label>' +
    '<label>Item type<select data-price-type><option value="">All types</option><option value="material">Parts</option><option value="labor">Labor</option><option value="travel">Travel</option></select></label></div>' +
    (bulkAccess() ? '<div class="actions"><button type="button" class="secondary" data-select-prices>Select visible</button><button type="button" class="secondary" data-clear-prices>Clear selection</button></div>' +
    '<div class="filters"><label>Bulk change<select name="bulkMode"><option value="markup">Set parts markup %</option><option value="scale">Adjust standard rate %</option><option value="change">Set change-order rate</option><option value="round">Round standard rate to increment</option></select></label>' +
    '<label>Value<input name="bulkValue" type="number" step="0.01"></label><label class="signature-terms"><input type="checkbox" name="preserveFixed" checked> Preserve fixed standard rates</label>' +
    '<button type="button" class="secondary" data-apply-bulk>Apply to selected</button></div><p data-bulk-feedback aria-live="polite"></p>' : '') +
    table([...(bulkAccess() ? ['Select'] : []), 'Item', ...(can('finance.view') ? ['Last received cost'] : []), 'Fixed rate', 'Markup %', 'Change-order rate'], rows),
    form => {
      const values = new FormData(form);
      const result = Object.fromEntries(items.flatMap((item, index) => {
        const rule = Object.fromEntries(['fixed', 'markup', 'change'].flatMap(key => {
          const value = values.get(key + index);
          return value == null || value === '' ? [] : [[key, value]];
        }));
        return Object.keys(rule).length ? [[item.id, rule]] : [];
      }));
      return { kind: 'save', id: duplicate || values.has('saveCopy') ? undefined : profile?.id, name: values.get('name'), markup: values.get('markup'), rules: {...preservedArchivedRules,...result}, bulk };
    });
  const itemRows = [...form.querySelectorAll('[data-price-row]')];
  const selection = row => row.querySelector('[data-bulk-select]');
  const search = form.querySelector('[data-price-search]');
  const type = form.querySelector('[data-price-type]');
  const filterRows = () => {
    const query = search.value.trim().toLowerCase();
    for (const row of itemRows) row.hidden = !row.dataset.search.includes(query) || (type.value && type.value !== row.dataset.itemType);
  };
  search.addEventListener('input', filterRows);
  type.addEventListener('change', filterRows);
  if (!bulkAccess()) return;
  form.querySelector('[data-select-prices]').onclick = () => itemRows.filter(row => !row.hidden).forEach(row => { selection(row).checked = true; });
  form.querySelector('[data-clear-prices]').onclick = () => itemRows.forEach(row => { selection(row).checked = false; });
  form.querySelector('[data-apply-bulk]').onclick = () => {
    const value = form.elements.bulkValue.valueAsNumber;
    const mode = form.elements.bulkMode.value;
    const feedback = form.querySelector('[data-bulk-feedback]');
    if (!Number.isFinite(value) || (mode === 'scale' ? value < -100 : value < 0) || (mode === 'round' && value === 0)) {
      feedback.textContent = 'Enter a valid bulk value.';
      return;
    }
    let changed = 0;
    for (const row of itemRows.filter(row => selection(row).checked)) {
      const index = Number(row.dataset.priceRow);
      const item = items[index];
      const fixed = form.elements['fixed' + index];
      const markup = form.elements['markup' + index];
      if (mode === 'change') form.elements['change' + index].value = value.toFixed(2);
      else {
        if (fixed.value !== '' && form.elements.preserveFixed.checked) continue;
        if (mode === 'markup') {
          if (!markup) continue;
          fixed.value = '';
          markup.value = value.toFixed(2);
        } else {
          const cost = inventory.get(item.id)?.cost;
          const standard = fixed.value !== '' ? Number(fixed.value) : item.type !== 'material' ? item.price :
            cost == null ? null : Math.round(cost * (1 + Number(markup.value || form.elements.markup.value) / 100) * 100) / 100;
          if (standard == null) continue;
          fixed.value = (mode === 'round' ? Math.round(standard / value) * value : standard * (1 + value / 100)).toFixed(2);
          if (markup) markup.value = '';
        }
      }
      changed++;
    }
    if (changed) bulk = true;
    form.dispatchEvent(new Event('input'));
    feedback.textContent = changed + ' rows changed in this draft.' + (mode === 'scale' || mode === 'round' ? ' Adjusted rates become fixed rates.' : '') + ' Preview before saving.';
  };
}

function assignmentDialog(scope, id) {
  const overview = data.pricingOverview;
  if(scope==='client-options'){
    const client=overview.clients.find(item=>item.id===id);
    if(!client)return;
    return pricingDialog('Available client pricing profiles',activeProfiles().map(profile=>
      `<label class="signature-terms"><input type="checkbox" name="profileId" value="${esc(profile.id)}" ${!client.profileIds||client.profileIds.includes(profile.id)?'checked':''}> ${esc(profile.name)}</label>`).join(''),
      form=>({kind:'client-options',targetId:id,ids:new FormData(form).getAll('profileId')}),'<p>'+esc(client.name)+'</p>');
  }
  const list = { correct:overview.orders, client: overview.clients, project: overview.projects, workorder: overview.orders }[scope];
  const target = list?.find(item => item.id === id);
  if (scope !== 'company' && !target) return;
  const client=overview.clients.find(item=>item.id===target?.clientId);
  const choices=activeProfiles().filter(profile=>!client?.profileIds||client.profileIds.includes(profile.id)||client.profileId===profile.id);
  const correcting=scope==='correct';
  pricingDialog(correcting?'Correct work order pricing':'Assign pricing profile',
    f('profile', 'Pricing profile', { select: [['', scope === 'company' ? 'Existing rates' : 'Inherit from parent'], ...choices.map(profile => [profile.id, profile.name])],
      value: (scope === 'company' ? overview.companyProfileId : target.profileId) || '' })+(correcting?f('reason','Reason for correction',{required:true,textarea:true}):''),
    form => ({ kind: correcting?'correct':'assign', scope, targetId: id, id: form.elements.profile.value, reason:form.elements.reason?.value }),
    '<p>' + esc(target?.name || 'Company default') + '</p>'+(correcting?'<p>'+(target.invoiced?'The saved invoice and billed amounts stay as recorded.':'Recalculate standard entries. Submitted orders return to Released for resubmission and review. Signed change rates stay in place.')+'</p>':''));
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-price-profile],[data-price-copy],[data-price-archive],[data-assign-price]');
  if (!button) return;
  const { priceProfile, priceCopy, priceArchive, assignPrice, target } = button.dataset;
  if (assignPrice) return (assignPrice==='correct'?can('pricing.workorder.correct'):assignAccess()) && assignmentDialog(assignPrice, target);
  if (priceArchive?!archiveAccess():!profileAccess()) return;
  const id = priceProfile || priceCopy || priceArchive;
  const profile = activeProfiles().find(item => item.id === id);
  if (priceArchive && profile) return pricingDialog('Archive pricing profile', '', () => ({ kind: 'archive', id }), '<p>' + esc(profile.name) + '</p>');
  if (priceProfile === '' || profile) profileEditor(profile, Boolean(priceCopy));
});
