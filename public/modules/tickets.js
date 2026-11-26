import {entryCharge} from './work-entry-charge.js';
import {emailIntakePanel} from './mail-intake.js';
// Tickets owns the client queue, ticket forms, and review actions.
import {data, me, can, esc, head, table, modal, f, send, show, render, projectLabel, view, fmt, bill, today} from '../app.js';

let queue = 'workflow';
let clientId = '';
let ticketId = '';
let query = '';
let statusFilter = '';
let queueScroll=0;

export function selectTicketLink(id, intake, list){
  ticketId=id||'';clientId='';query='';statusFilter='';
  queue=intake?'intake':['mine','overdue'].includes(list)?list:'workflow';
}
const overview = () => data.ticketOverview || {tickets:[], clients:[], statuses:[], priorities:[], assignees:[]};
const clientName = id => !id ? 'No billing client' : overview().clients.find(client => client.id === id)?.name || 'Billing client';
const isActive = ticket => ticket.status !== 'Completed';
const overdue = ticket => isActive(ticket) && ticket.due && ticket.due < today();
const pick = (id, label, attribute) => `<button type="button" class="rowlink" ${attribute}="${esc(id)}">${esc(label)}</button>`;
const action = (name, label, id = '') => `<button type="button" class="secondary small" data-ticket-action="${name}" data-ticket-id="${esc(id)}">${label}</button>`;

function filters() {
  return `<form id="ticketFilters" class="filters">
    <label>Search <input name="query" type="search" value="${esc(query)}"></label>
    <label>Status <select name="status"><option value="">All statuses</option>${overview().statuses.map(status =>
      `<option value="${esc(status)}" ${status === statusFilter ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select></label>
    <button class="secondary" type="submit">Filter</button></form>`;
}

function ticketTable(tickets) {
  const visible = tickets.filter(ticket => (!statusFilter || ticket.status === statusFilter) &&
    [ticket.title, ticket.number, clientName(ticket.clientId), ticket.assignee].join(' ').toLowerCase().includes(query));
  return table(['Ticket','Client','Status','Priority','Assigned to','Due'], visible.map(ticket => `<tr>
    <td>${pick(ticket.id, ticket.number + ' · ' + ticket.title, 'data-ticket-open')}</td>
    <td>${esc(clientName(ticket.clientId))}</td><td>${esc(ticket.status)}</td><td>${esc(ticket.priority)}</td>
    <td>${esc(ticket.assignee || 'Unassigned')}</td><td class="${overdue(ticket) ? 'warn' : ''}">${esc(ticket.due || '—')}</td></tr>`));
}

function clientDetails(client) {
  const projects = data.projects.filter(project => project.customerId === client.id);
  const orders = data.workorders.filter(order => projects.some(project => project.id === order.projectId));
  return `<section class="panel"><h2>${esc(client.name)}</h2>
    ${can('customers.view') ? `<p>${esc([client.email, client.phone].filter(Boolean).join(' · '))}</p>
      <h3>Job contacts</h3><ul>${(client.contacts || []).map(contact => `<li>${esc([contact.name, contact.phone, contact.email].filter(Boolean).join(' · '))}</li>`).join('')}</ul>` : ''}
    ${can('projects.view') ? `<h3>Projects</h3><ul>${projects.map(project => `<li>${pick(project.id,projectLabel(project),'data-project')}</li>`).join('')}</ul>` : ''}
    ${can('workorders.view') ? `<h3>Work orders</h3><ul>${orders.map(order => `<li>${pick(order.id,order.title,'data-wo')} · ${esc(order.status)}${can('finance.view') && order.invoice ? ' · ' + fmt(bill(order).total) : ''}</li>`).join('')}</ul>` : ''}
  </section>`;
}

const dateLabel = value => value ? String(value).slice(0,10) : '—';
const orderById = id => data.workorders.find(order=>order.id===id);
const forProject = id => data.workorders.filter(order=>order.projectId===id);
const relevantReview = ticket => {
  const order=orderById(ticket.workorderId);
  return ticket.kind==='review' && ticket.status==='Ready for review' && order?.closeout && !order.closeout.reviewedAt && !order.invoice;
};
function reviewGrid(tickets) {
  return table(['Work order','Client / project','Submitted by','Submitted date','Entries','Status'],
    tickets.filter(relevantReview).map(ticket=>{
      const order=orderById(ticket.workorderId);
      const project=data.projects.find(p=>p.id===order.projectId);
      return `<tr><td>${pick(ticket.id,order.title,'data-ticket-open')}</td><td>${esc([clientName(ticket.clientId),project&&projectLabel(project)].filter(Boolean).join(' · '))}</td><td>${esc(order.closeout.submittedBy || order.closeout.submittedEmail || '—')}</td><td>${esc(dateLabel(order.closeout.at))}</td><td>${order.entries?.length || 0}</td><td>Ready for review</td></tr>`;
    }));
}
function prospectsGrid(tickets) {
  return table(['Opportunity','Company / contact','Source','Added','Follow-up due'],tickets
    .filter(ticket=>ticket.kind==='prospect' && isActive(ticket))
    .map(ticket=>`<tr><td>${pick(ticket.id,ticket.title,'data-ticket-open')}</td><td>${esc([ticket.company,ticket.contact].filter(Boolean).join(' · ') || '—')}</td><td>${esc(ticket.source || 'Manual')}</td><td>${esc(dateLabel(ticket.createdAt))}</td><td class="${overdue(ticket)?'warn':''}">${esc(ticket.due || '—')}</td></tr>`));
}
function projectsGrid() {
  if (!can('projects.view')) return '<p>Project access is required to view this queue.</p>';
  return table(['Project','Client','Reviewed / total','Last activity','Next step / blocker','Follow-up due'],data.projects
    .filter(project=>!project.closedAt)
    .map(project=>{
      const orders=forProject(project.id);
      const last=[project.updatedAt,project.createdAt,...orders.flatMap(order=>[order.updatedAt,order.createdAt,order.closeout?.at])].filter(Boolean).sort().at(-1);
      return `<tr><td>${pick(project.id,projectLabel(project),'data-project')}</td><td>${esc(clientName(project.customerId))}</td><td>${can('workorders.view')?orders.filter(order=>order.closeout?.reviewedAt || order.invoice).length+' / '+orders.length:'—'}</td><td>${esc(dateLabel(last))}</td><td>${esc(project.nextStep || '—')}</td><td>${esc(project.followUpDue || '—')}</td></tr>`;
    }));
}
function invoicingGrid() {
  if(!can('projects.view') || !can('finance.view') || !can('workorders.view') || !can('invoices.view'))return '<p>Project and billing access are required to view this queue.</p>';
  return table(['Project','Billing client','Closed','Unbilled work / amount','Billing stage'],data.projects
    .filter(project=>project.closedAt)
    .flatMap(project=>{
      const orders=forProject(project.id);
      const billable=orders.filter(order=>!order.internalTask && !order.invoice && (order.entries || []).some(entry=>entryCharge(entry)>0));
      if(!billable.length)return [];
      const ready=billable.filter(order=>order.closeout?.reviewedAt);
      const blockedCloseout=orders.some(order=>order.requiredForFinalBilling && !order.closeout?.reviewedAt && !order.invoice);
      return [`<tr><td>${pick(project.id,projectLabel(project),'data-project')}</td><td>${esc(clientName(project.customerId))}</td><td>${esc(dateLabel(project.closedAt))}</td><td>${billable.length} · ${fmt(ready.reduce((sum,order)=>sum+bill(order).total,0))} reviewed</td><td>${blockedCloseout?'Closeout outstanding':ready.length<billable.length?'Awaiting work order review':'Ready for final billing'}</td></tr>`];
    }));
}
function prospectDetail(ticket) {
  return head(ticket.title,ticket.number,[ticket.company,ticket.contact].filter(Boolean).join(' · '),action('back','Back to queue'))+
    `<section class="panel"><p>${esc(ticket.source || 'Manual')} · ${esc(ticket.status)}${ticket.due?' · Due '+esc(ticket.due):''}</p><p class="ticket-text">${esc(ticket.description)}</p>
    ${can('ticket.note')?action('note','Add note',ticket.id):''}
    ${can('ticket.update')?(isActive(ticket)?action('complete','Complete',ticket.id):action('reopen','Undo completion',ticket.id)):''}
    </section>`+mailAndActivity(ticket);
}
function mailAndActivity(ticket) {
  return (ticket.mail?.length ? '<section class="panel"><h2>Originating email and replies</h2>'+ticket.mail.map(message=>
    `<details><summary>${esc(message.subject)} · ${esc(message.from)}</summary><p>${esc(new Date(message.at).toLocaleString())}</p><p class="ticket-text">${esc(message.body)}</p>${can('ticket.attachment')?message.attachments.map(file=>`<p><button class="rowlink" data-ticket-download="${esc(file.id)}" data-ticket-id="${esc(ticket.id)}">${esc(file.name)}</button></p>`).join(''):''}</details>`).join('')+'</section>' : '')+
    '<section class="panel"><h2>Activity</h2>'+ticket.activity.slice().reverse().map(entry=>`<div class="list-item"><div><p class="ticket-text">${esc(entry.message)}</p><small>${esc(entry.by)} · ${esc(new Date(entry.at).toLocaleString())}</small></div></div>`).join('')+'</section>';
}
function ticketDetail(ticket) {
  if(ticket.kind==='prospect')return prospectDetail(ticket);
  const order = can('workorders.view') && data.workorders.find(record => record.id === ticket.workorderId);
  const reviewable = ticket.kind === 'review' && order?.closeout && !order.closeout.reviewedAt && !order.invoice;
  const undoable=ticket.kind==='review'&&order?.closeout&&!order.invoice&&!order.billingHidden&&!(order.entries||[]).some(entry=>entry.payrollLocked);
  const buttons = [
    can('ticket.watch') && action('follow',ticket.following?'Unfollow ticket':'Follow ticket',ticket.id),
    can('ticket.watch') && action('mute',ticket.muted?'Unmute ticket':'Mute ticket',ticket.id),
    can('ticket.update') && ticket.kind !== 'stock-shortage' && action('edit','Edit ticket',ticket.id),
    can('ticket.note') && action('note','Add note',ticket.id),
    can('ticket.update') && ticket.kind==='manual' && action(isActive(ticket)?'complete':'reopen',isActive(ticket)?'Complete':'Undo completion',ticket.id),
    can('ticket.mail') && ticket.mail?.length && action('reply','Reply in email',ticket.id),
    can('ticket.mail') && can('ticket.update') && ticket.kind==='manual' && ticket.mail?.length && action('convert-prospect','Move to Chasing Work',ticket.id),
    can('ticket.attach') && action('attach','Attach file',ticket.id),
    can('ticket.delete') && ticket.kind === 'manual' && action('delete','Delete ticket',ticket.id)
  ].filter(Boolean).join('');
  return head(ticket.title, ticket.number, clientName(ticket.clientId), action('back','Back to queue')) +
    `<section class="panel"><p><b>${esc(ticket.status)}</b> · ${esc(ticket.priority)} · ${esc(ticket.assignee || 'Unassigned')}${ticket.due ? ' · Due ' + esc(ticket.due) : ''}</p>
    <p class="ticket-text">${esc(ticket.description)}</p>${ticket.nextAction?'<p><b>Next action</b> · '+esc(ticket.nextAction)+'</p>':''}
    ${order ? `<p>Work order · ${pick(order.id,order.title,'data-wo')}</p>` : ''}
    <div class="actions">${buttons}
    ${reviewable && can('workorder.review') ? action('review','Mark reviewed',ticket.id) : ''}
    ${undoable && can('workorder.return') ? action('undo-closeout','Undo Closeout',ticket.id) : ''}
    ${order?.closeout?.reviewedAt && can('invoice.group') ? `<button class="secondary small" data-ticket-invoice="${esc(order.id)}">Prepare invoice</button>` : ''}
    </div></section>
    ${can('ticket.attachment')?`<section class="panel"><h2>Attachments</h2>${ticket.attachments.length ? ticket.attachments.map(file =>
      `<p><button class="rowlink" data-ticket-download="${esc(file.id)}" data-ticket-id="${esc(ticket.id)}">${esc(file.name)}</button> · ${Math.ceil(file.bytes / 1024)} KB</p>`).join('') : '<p>No attachments.</p>'}</section>`:''}
    ${ticket.mail?.length ? '<section class="panel"><h2>Imported email</h2>'+ticket.mail.map(message=>
      `<details><summary>${esc(message.subject)} · ${esc(message.from)}</summary>
       <p>${esc(new Date(message.at).toLocaleString())} · To ${esc(message.recipients.join(', '))}</p>
       <p class="ticket-text">${esc(message.body)}</p>
       ${message.truncated ? '<p>Email text was shortened. See the intake mailbox for the full message.</p>' : ''}
       ${can('ticket.attachment')?message.attachments.map(file=>`<p><button class="rowlink" data-ticket-download="${esc(file.id)}" data-ticket-id="${esc(ticket.id)}">${esc(file.name)}</button></p>`).join(''):''}</details>`).join('')+'</section>' : ''}
    <section class="panel"><h2>Activity</h2>${ticket.activity.slice().reverse().map(entry =>
      `<div class="list-item"><div><b>${esc({internal:'Internal note', correspondence:'Client correspondence', event:'Update'}[entry.kind])}</b>
      <p class="ticket-text">${esc(entry.message)}</p><small>${esc(entry.by)} · ${esc(new Date(entry.at).toLocaleString())}</small></div></div>`).join('') || '<p>No activity yet.</p>'}</section>`;
}

export function ticketsPage() {
  const {tickets, clients} = overview();
  const selected = tickets.find(ticket => ticket.id === ticketId);
  if (selected) return ticketDetail(selected);
  const client = clients.find(record => record.id === clientId);
  const create = can('ticket.create') ? action('create','New ticket') : '';
  const buttons = `<div class="gap">${action('workflow','Workflow grids')}${action('history','Cleared / History')}${action('clients','Billing clients')}${action('mine','My work')}${action('reviews','Review queue')}${action('board','Status board')}${data.mailIntake?action('intake','Email intake'):''}${create}</div>`;
  const title = queue === 'mine' ? 'My work' : queue === 'reviews' ? 'Work order review queue' : 'Tickets';
  const header = head(title, 'Service desk', 'Track client requests and work orders awaiting review.', buttons);
  if (queue === 'workflow') return header+
    '<section class="panel"><h2>Work Order Tickets</h2>'+reviewGrid(tickets)+'</section>'+
    '<section class="panel"><h2>Chasing Work</h2>'+(can('ticket.create')?action('prospect','New opportunity'):'')+prospectsGrid(tickets)+'</section>'+
    '<section class="panel"><h2>Projects</h2>'+projectsGrid()+'</section>'+
    '<section class="panel"><h2>Invoicing</h2>'+invoicingGrid()+'</section>'+
    '<section class="panel"><h2>Other follow-ups and purchasing</h2>'+ticketTable(tickets.filter(ticket=>!['prospect','review'].includes(ticket.kind)&&isActive(ticket)))+'</section>';
  if (queue === 'history') return header+'<section class="panel"><h2>Cleared / History</h2>'+filters()+ticketTable(tickets.filter(ticket=>!isActive(ticket) || (ticket.kind==='review' && !relevantReview(ticket))))+'</section>';
  if (queue === 'intake' && data.mailIntake) return header + emailIntakePanel();
  if(queue==='board')return header+filters()+'<div class="ticket-board">'+overview().statuses.map(status=>
    '<section class="panel"><h2>'+esc(status)+'</h2>'+ticketTable(tickets.filter(ticket=>ticket.status===status))+'</section>').join('')+'</div>';
  if(queue==='overdue')return header+'<section class="panel"><h2>Overdue tickets</h2>'+filters()+ticketTable(tickets.filter(overdue))+'</section>';
  if (queue === 'mine') return header + '<section class="panel">' + filters() + ticketTable(tickets.filter(ticket => ticket.assignee === me.email)) + '</section>';
  if (queue === 'reviews') return header + '<section class="panel">' + filters() + reviewGrid(tickets) + '</section>';
  if (client) return header + clientDetails(client) + '<section class="panel"><h2>Client tickets</h2>' + filters() + ticketTable(tickets.filter(ticket => ticket.clientId === client.id)) + '</section>';
  return header + '<section class="panel">' + filters() + table(['Billing client','Active','Completed','Overdue','Assigned staff'],
    clients.filter(client => client.name.toLowerCase().includes(query)).map(client => {
      const rows = tickets.filter(ticket => ticket.clientId === client.id && (!statusFilter || ticket.status === statusFilter));
      return `<tr><td>${pick(client.id,client.name,'data-ticket-client')}</td><td>${rows.filter(isActive).length}</td>
        <td>${rows.filter(ticket => !isActive(ticket)).length}</td><td>${rows.filter(overdue).length}</td>
        <td>${esc([...new Set(rows.filter(isActive).map(ticket => ticket.assignee).filter(Boolean))].join(', ') || '—')}</td></tr>`;
    })) + '</section><section class="panel"><h2>Purchasing tickets</h2>' + ticketTable(tickets.filter(ticket => ticket.kind === 'stock-shortage')) + '</section>';
}

function newOpportunity() {
  return modal('New opportunity',f('title','Opportunity',{required:true})+f('company','Company')+f('contact','Contact')+
    f('description','Notes',{textarea:true})+f('due','Follow-up due',{type:'date'}),async fields=>{
      const result=await send('ticket.create',{kind:'prospect',...fields});
      ticketId=result.id;render();
    });
}
function replyToEmail(ticket) {
  const original=ticket.mail?.at(-1);
  if(!original || !/^[^@,\s]+@[^@,\s]+$/.test(original.from))return show('No reply address is available',true);
  const subject=/^re:/i.test(original.subject)?original.subject:'Re: '+original.subject;
  const link=document.createElement('a');
  link.href='mailto:'+encodeURIComponent(original.from)+'?subject='+encodeURIComponent(subject);
  link.click();
}
function ticketForm(ticket) {
  const options = overview();
  const review = ticket?.kind === 'review';
  const links = review ? '' : f('clientId','Billing client',{required:true,select:[['','Select a client'], ...options.clients.map(client => [client.id,client.name])],value:ticket?.clientId || clientId}) +
    (can('projects.view') ? f('projectId','Project',{select:[['','No project']]}) : '') +
    (can('workorders.view') && can('projects.view') ? f('workorderId','Work order',{select:[['','No work order']]}) : '') +
    (can('customers.view') ? f('contactId','Job contact',{select:[['','No contact']]}) : '');
  const members = [...new Set([me.email, ticket?.assignee, ...options.assignees].filter(Boolean))];
  modal(ticket ? 'Edit ticket' : 'New ticket',
    links + f('title','Title',{required:true,value:ticket?.title}) + f('description','Description',{textarea:true,value:ticket?.description}) +
    (review ? '' : f('status','Status',{select:options.statuses.map(value=>[value,value]),value:ticket?.status || 'New'})) +
    (ticket?f('nextAction','Next action',{value:ticket.nextAction}):'')+f('priority','Priority',{select:options.priorities.map(value=>[value,value]),value:ticket?.priority || 'Normal'}) +
    f('assignee','Assigned to',{select:[['','Unassigned'],...members.map(email=>[email,email])],value:ticket?.assignee || ''}) +
    f('due','Due date',{type:'date',value:ticket?.due}), async fields => {
      const result = await send(ticket ? 'ticket.update' : 'ticket.create', {
        clientId:ticket?.clientId, projectId:ticket?.projectId, workorderId:ticket?.workorderId,
        contactId:ticket?.contactId, status:ticket?.status, ...fields, id:ticket?.id, revision:ticket?.revision
      });
      ticketId = result.id;
      render();
    });
  const form = document.querySelector('#actionForm');
  const fill = (name, label, rows, selected) => {
    if (!form.elements[name]) return;
    form.elements[name].replaceChildren(new Option(label,''), ...rows.map(([id,name])=>new Option(name,id)));
    form.elements[name].value = selected || '';
    if (form.elements[name].selectedIndex < 0) form.elements[name].value = '';
  };
  const refreshOrders = selected => fill('workorderId','No work order',data.workorders.filter(order=>order.projectId===form.elements.projectId?.value).map(order=>[order.id,order.title]),selected);
  const refresh = existing => {
    const client = options.clients.find(record=>record.id===form.elements.clientId?.value);
    fill('projectId','No project',data.projects.filter(project=>project.customerId===client?.id).map(project=>[project.id,projectLabel(project)]),existing?.projectId);
    fill('contactId','No contact',(client?.contacts || []).map(contact=>[contact.id,contact.name]),existing?.contactId);
    refreshOrders(existing?.workorderId);
  };
  if (!review) {
    refresh(ticket);
    form.elements.clientId.addEventListener('change',()=>refresh());
    form.elements.projectId?.addEventListener('change',()=>refreshOrders());
  }
}

async function download(button) {
  const response = await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'ticket.attachment',data:{id:button.dataset.ticketId,fileId:button.dataset.ticketDownload}})});
  const body = await response.json();
  if (!response.ok) throw Error(body.error || 'Could not download attachment');
  const file = body.result;
  const bytes = Uint8Array.from(atob(file.content), character=>character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  const link = document.createElement('a');
  link.href=url;link.download=file.name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

document.addEventListener('submit', event => {
  if (event.target.id !== 'ticketFilters') return;
  event.preventDefault();
  const values = new FormData(event.target);
  query = String(values.get('query') || '').trim().toLowerCase();
  statusFilter = String(values.get('status') || '');
  render();
});

document.addEventListener('click', event => {
  if (view !== 'tickets' || !can('tickets.view')) return;
  const button = event.target.closest('[data-ticket-action],[data-ticket-open],[data-ticket-client],[data-ticket-download],[data-ticket-invoice]');
  if (!button) return;
  const {ticketAction, ticketOpen, ticketClient, ticketDownload, ticketInvoice} = button.dataset;
  if (ticketOpen) {queueScroll=window.scrollY;ticketId=ticketOpen;render();window.scrollTo(0,0);return;}
  if (ticketClient) {clientId=ticketClient;queue='clients';query='';statusFilter='';render();return;}
  if (ticketDownload) {if(!can('ticket.attachment'))return;download(button).catch(error=>show(error.message,true));return;}
  if (ticketInvoice) {
    document.dispatchEvent(new CustomEvent('bci:ticket-invoice',{detail:ticketInvoice}));
    return;
  }
  if (['workflow','history','clients','mine','reviews','intake','board','back'].includes(ticketAction)) {
    ticketId='';
    if (ticketAction !== 'back') {queue=ticketAction;clientId='';query='';statusFilter='';}
    render();
    if(ticketAction==='back')window.scrollTo(0,queueScroll);
    return;
  }
  const ticket = overview().tickets.find(record=>record.id===button.dataset.ticketId);
  if (ticketAction === 'create' && can('ticket.create')) return ticketForm();
  if(ticketAction==='prospect' && can('ticket.create'))return newOpportunity();
  if (!ticket) return;
  if(ticketAction==='reply' && can('ticket.mail'))return replyToEmail(ticket);
  if(ticketAction==='convert-prospect' && can('ticket.mail') && can('ticket.update'))return modal('Move to Chasing Work',
    f('company','Company',{value:ticket.clientId?clientName(ticket.clientId):''})+f('contact','Contact',{value:ticket.mail?.[0]?.from}),
    fields=>send('ticket.update',{id:ticket.id,revision:ticket.revision,transition:'prospect',...fields}),
    '<p>Only move an opportunity you have not already pursued. Existing notes and email stay with the ticket.</p>');
  if(['complete','reopen'].includes(ticketAction) && can('ticket.update'))return modal(ticketAction==='complete'?'Complete ticket':'Undo completion',
    '<p>'+esc(ticket.title)+'</p>',async ()=>{
      await send('ticket.update',{id:ticket.id,revision:ticket.revision,transition:ticketAction});ticketId='';render();
    });
  if(can('ticket.watch')&&(ticketAction==='follow'||ticketAction==='mute')){
    send('ticket.watch',ticketAction==='follow'?{id:ticket.id,follow:!ticket.following}:{id:ticket.id,mute:!ticket.muted}).catch(error=>show(error.message,true));
    return;
  }
  if (ticketAction === 'edit' && can('ticket.update')) return ticketForm(ticket);
  if (ticketAction === 'note' && can('ticket.note')) return modal('Add note',
    (ticket.kind==='prospect'?'':f('kind','Note type',{select:[['internal','Internal note'],['correspondence','Client correspondence']]})) +
    f('message','Message',{required:true,textarea:true}), fields=>send('ticket.note',{id:ticket.id,kind:'internal',...fields}));
  if (ticketAction === 'attach' && can('ticket.attach')) return modal('Attach file',
    '<label>File up to 250 KB<input id="ticketFile" type="file" required></label>', async () => {
      const file = document.querySelector('#ticketFile').files[0];
      if (!file || file.size > 250000) throw Error('Choose a file up to 250 KB');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const content = btoa(bytes.reduce((result,byte)=>result+String.fromCharCode(byte),''));
      await send('ticket.attach',{id:ticket.id,name:file.name,content});
    });
  if (ticketAction === 'review' && can('workorder.review')) return modal('Mark reviewed','<p>Confirm that the work order entries and approvals were reviewed.</p>',
    ()=>send('workorder.review',{workorderId:ticket.workorderId}));
  if (ticketAction==='undo-closeout'&&can('workorder.return')) {
    const order=data.workorders.find(row=>row.id===ticket.workorderId);
    if(!order?.closeout)return;
    return modal('Undo Closeout',
      '<p>Return the work order to Released so the crew can continue. Existing time, notes, materials and receipts stay in place. The prior submission stays in history.</p>'+
      f('reason','What still needs to be done?',{required:true,textarea:true}),
      fields=>send('workorder.undoCloseout',{workorderId:order.id,closeoutAt:order.closeout.at,reviewedAt:order.closeout.reviewedAt||null,...fields}));
  }
  if (ticketAction === 'delete' && ticket.kind==='manual' && can('ticket.delete')) {
    modal('Delete ticket','<div class="delete-warning"><strong>You could get fired if you delete this, be sure you are confident in your decision</strong><p>'+esc(ticket.title)+'</p></div>'+
      f('reason','Reason for deletion',{required:true,textarea:true}),fields=>send('ticket.delete',{id:ticket.id,revision:ticket.revision,confirmed:true,...fields}));
    const submit=document.querySelector('#actionForm button[type=submit]');
    submit.className='danger';submit.textContent='Delete ticket';
    const cancel=document.createElement('button');
    cancel.type='button';cancel.className='secondary';cancel.textContent='Cancel';
    cancel.onclick=()=>{document.querySelector('#modal').hidden=true;};
    submit.after(cancel);
  }
});
