import {randomUUID} from 'node:crypto';
import {recordCanAccess, scopeTicket} from './record-scope.js';

export const ticketStatuses = ['New', 'In progress', 'Waiting on client', 'Waiting on parts', 'Ready for review', 'Completed'];
const priorities = ['Low', 'Normal', 'High', 'Urgent'];
const timestamp = () => new Date().toISOString();

function text(value, label, limit, required = true) {
  const result = typeof value === 'string' ? value.trim() : '';
  if ((required && !result) || result.length > limit) throw Error('Enter ' + label + ' up to ' + limit + ' characters');
  return result;
}

function addActivity(ticket, actor, message, kind = 'event') {
  ticket.activity.push({id:randomUUID(), at:timestamp(), by:actor.email, message, kind});
  ticket.revision = randomUUID();
}

function reviewTicket(state, order) {
  const project = state.projects.find(record => record.id === order.projectId);
  if (!project) return null;
  return {
    id:'review-' + order.id, number:'REV-' + order.id.slice(-8).toUpperCase(), kind:'review',
    title:'Review ' + order.title, description:'Review time, materials, travel, journal entries, and approvals.',
    clientId:project.customerId, projectId:project.id, workorderId:order.id, contactId:project.contactId || '',
    status:'Ready for review', priority:'Normal', assignee:'', due:'', createdAt:order.closeout.at,
    createdBy:order.closeout.submittedEmail || '', attachments:[], activity:[], revision:order.closeout.at
  };
}

// Existing pending closeouts appear immediately. Read requests never modify storage.
function availableTickets(state) {
  const stored = state.tickets || [];
  const linked = new Set([...(state.ticketReviewExclusions||[]),...stored.filter(ticket => ticket.kind === 'review').map(ticket => ticket.workorderId)]);
  const legacy = state.workorders.filter(order => order.closeout && !order.closeout.reviewedAt && !order.invoice && !linked.has(order.id));
  return [...stored, ...legacy.map(order => reviewTicket(state, order)).filter(Boolean)];
}

export function queueReview(state, order, actor) {
  const tickets = state.tickets ??= [];
  let ticket = tickets.find(record => record.kind === 'review' && record.workorderId === order.id);
  if (!ticket) {
    ticket = reviewTicket(state, order);
    if (!ticket) return;
    tickets.push(ticket);
  }
  ticket.status = 'Ready for review';
  addActivity(ticket, actor, 'Work order submitted for review.');
}

export function completeReview(state, order, actor) {
  let ticket = (state.tickets || []).find(record => record.kind === 'review' && record.workorderId === order.id);
  if (!ticket) {
    ticket = reviewTicket(state, order);
    if (!ticket) return;
    (state.tickets ??= []).push(ticket);
  }
  ticket.status = 'Completed';
  addActivity(ticket, actor, 'Closeout reviewed. Work order is ready for invoicing.');
}

function canSee(ticket, actor) {
  const permissions = actor.permissions || [];
  return permissions.includes('tickets.view') && recordCanAccess(ticket,'tickets',actor);
}

function ticketFor(state, id, actor) {
  const ticket = availableTickets(state).find(record => record.id === id);
  if (!ticket || !canSee(ticket, actor)) throw Error('Ticket is unavailable');
  return ticket;
}

function validateLinks(state, input, actor) {
  const client = state.customers.find(record => record.id === input.clientId);
  if (!client) throw Error('Select a billing client');
  const permissions = actor.permissions || [];
  const project = state.projects.find(record => record.id === input.projectId && record.customerId === client.id);
  if (input.projectId && (!project || !permissions.includes('projects.view'))) throw Error('Select an accessible project for this client');
  const order = state.workorders.find(record => record.id === input.workorderId && record.projectId === project?.id);
  if (input.workorderId && (!order || !permissions.includes('workorders.view'))) throw Error('Select a work order for this project');
  if (input.contactId && (!permissions.includes('customers.view') || !client.contacts?.some(record => record.id === input.contactId))) throw Error('Select an accessible job contact for this client');
  return {clientId:client.id, projectId:project?.id || '', workorderId:order?.id || '', contactId:input.contactId || ''};
}

function assigneeFor(state, input, actor, previous) {
  const email = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (email === previous || (!email && previous === actor.email)) return email;
  if (!actor.permissions.includes('ticket.assign') && (email !== actor.email || previous && previous !== actor.email)) throw Error('Assignment permission required');
  if (email && email !== actor.email && !state.users?.some(user => user.email === email && user.active !== false)) throw Error('Select an active team member');
  return email;
}

function settings(state, data, actor, ticket) {
  const status = data.status || 'New';
  const priority = data.priority || 'Normal';
  if (!ticketStatuses.includes(status) || !priorities.includes(priority)) throw Error('Invalid status or priority');
  const due = data.due || '';
  if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due)) ||
    new Date(due).toISOString().slice(0,10) !== due)) throw Error('Choose a valid due date');
  return {status, priority, due, assignee:assigneeFor(state, data.assignee, actor, ticket?.assignee || '')};
}

function attachment(data, actor) {
  const name = text(data.name, 'file name', 160).replace(/[\\/\x00-\x1f]/g, '_');
  const content = data.content;
  if (typeof content !== 'string' || content.length > 340000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content) || content.length % 4 !== 0) throw Error('Choose a file up to 250 KB');
  const bytes = Buffer.from(content, 'base64').length;
  if (!bytes || bytes > 250000) throw Error('Choose a file up to 250 KB');
  return {id:randomUUID(), name, content, bytes, by:actor.email, at:timestamp()};
}

export function ticketAttachment(state, data, actor) {
  const ticket = ticketFor(state, data.id, actor);
  const emailFiles = actor.permissions.includes('ticket.mail') ? (ticket.mailMessages || []).flatMap(message=>
    message.attachments.map((file,index)=>({...file,id:message.key+':'+index}))) : [];
  const file = [...ticket.attachments,...emailFiles].find(item => item.id === data.fileId);
  if (!file) throw Error('Attachment is unavailable');
  return file;
}

export function ticketAction(state, action, data, actor) {
  if (action === 'ticket.create') {
    const prospect = data.kind === 'prospect';
    const links = prospect && !data.clientId ? {clientId:'',projectId:'',workorderId:'',contactId:''} : validateLinks(state, data, actor);
    const prospectFields = prospect ? {company:text(data.company,'company',180,false),contact:text(data.contact,'contact',180,false),source:actor.email==='mail-intake'?'Email':'Manual'} : {};
    const fields = settings(state, data, actor);
    const title = text(data.title, 'title', 180);
    const description = text(data.description, 'description', 5000, false);
    state.meta.ticketSequence = (state.meta.ticketSequence || 0) + 1;
    const ticket = {
      id:randomUUID(), number:'T-' + String(state.meta.ticketSequence).padStart(5,'0'),
      kind:prospect?'prospect':'manual', title, description, ...links, ...prospectFields, ...fields, createdAt:timestamp(), createdBy:actor.email,
      activity:[], attachments:[], assignedAt:fields.assignee ? timestamp() : undefined
    };
    addActivity(ticket, actor, 'Ticket created.');
    (state.tickets ??= []).push(ticket);
    return {id:ticket.id};
  }

  const ticket = ticketFor(state, data.id, actor);
  if(action==='ticket.watch'){
    const watchers=ticket.watchers??=[];
    const muted=ticket.mutedBy??=[];
    if(data.follow===true&&!watchers.includes(actor.email))watchers.push(actor.email);
    if(data.follow===false)ticket.watchers=watchers.filter(email=>email!==actor.email);
    if(data.mute===true&&!muted.includes(actor.email))muted.push(actor.email);
    if(data.mute===false)ticket.mutedBy=muted.filter(email=>email!==actor.email);
  } else if (action === 'ticket.update') {
    if(ticket.kind==='stock-shortage')throw Error('Projected stock controls purchasing tickets');
    if (ticket.revision !== data.revision) throw Error('Ticket changed. Refresh before editing.');
    if (data.transition === 'prospect') {
      if(ticket.kind!=='manual'||!actor.permissions.includes('ticket.mail')||!ticket.mailMessages?.length)throw Error('Select an accessible email follow-up to convert');
      const threads=ticket.mailThreads||[];
      if(threads.some(thread=>(state.tickets||[]).some(other=>other.kind==='prospect'&&other.mailThreads?.includes(thread))))
        throw Error('This conversation already has an opportunity');
      const company=text(data.company,'company',180,false);
      const contact=text(data.contact,'contact',180,false);
      Object.assign(ticket,{kind:'prospect',source:'Email',company,contact});
      if(ticket.status==='Completed')ticket.status='New';
      addActivity(ticket,actor,'Moved to Chasing Work.');
      return {id:ticket.id};
    }
    if (['complete','reopen'].includes(data.transition)) {
      if (ticket.kind === 'review') throw Error('Use the work order review actions to change this status');
      if ((data.transition === 'complete') === (ticket.status === 'Completed')) return {id:ticket.id};
      if (data.transition === 'complete') {
        ticket.previousStatus = ticket.status;
        ticket.status = 'Completed';
      } else {
        ticket.status = ticket.previousStatus || 'In progress';
      }
      addActivity(ticket, actor, data.transition === 'complete' ? 'Completed ticket.' : 'Reopened ticket.');
      return {id:ticket.id};
    }
    const fields = settings(state, data, actor, ticket);
    if (ticket.kind === 'review' && fields.status !== ticket.status) throw Error('Use the work order review actions to change this status');
    const description = text(data.description, 'description', 5000, false);
    const title = text(data.title, 'title', 180);
    const links = ticket.kind === 'review' || (ticket.kind === 'prospect' && !data.clientId) ? {} : validateLinks(state, data, actor);
    const changed = Object.entries({...links, ...fields, title, description}).filter(([key,value]) => ticket[key] !== value).map(([key]) => key);
    if(fields.assignee!==ticket.assignee)ticket.assignedAt=timestamp();
    Object.assign(ticket, links, fields, {title,description,nextAction:text(data.nextAction,'next action',300,false)});
    addActivity(ticket, actor, 'Updated ' + (changed.join(', ') || 'ticket details') + '.');
  } else if (action === 'ticket.note') {
    if (!['internal','correspondence'].includes(data.kind)) throw Error('Choose a note type');
    addActivity(ticket, actor, text(data.message, 'note', 5000), data.kind);
  } else if (action === 'ticket.attach') {
    if (ticket.attachments.length >= 8) throw Error('Ticket already has eight attachments');
    const file = attachment(data, actor);
    ticket.attachments.push(file);
    addActivity(ticket, actor, 'Attached ' + file.name + '.');
  } else if (action === 'ticket.delete') {
    if (ticket.kind === 'review') throw Error('Linked review tickets are retained with the work order');
    const reason = text(data.reason, 'deletion reason', 500);
    if (data.confirmed !== true || ticket.revision !== data.revision) throw Error('Confirm deletion of the current ticket');
    (state.trash ??= []).push({id:randomUUID(),kind:'ticket',record:ticket,deletedAt:timestamp(),deletedBy:actor.email,reason});
    state.tickets = state.tickets.filter(item => item.id !== ticket.id);
    return {id:ticket.id};
  } else throw Error('Unknown ticket action');

  const tickets = state.tickets ??= [];
  if (!tickets.some(record => record.id === ticket.id)) tickets.push(ticket);
  return {id:ticket.id};
}

export function requestCorrections(state, order, reason, actor) {
  if (!order.closeout || order.closeout.reviewedAt || order.invoice) throw Error('Work order must be awaiting review');
  const note = text(reason, 'correction request', 2000);
  let ticket = (state.tickets || []).find(record => record.kind === 'review' && record.workorderId === order.id);
  if (!ticket) {
    ticket = reviewTicket(state, order);
    if (!ticket) throw Error('Work order is missing its project');
    (state.tickets ??= []).push(ticket);
  }
  (order.closeoutHistory ??= []).push(order.closeout);
  order.closeout = null;
  order.status = 'released';
  order.correctionRequest = {note, by:actor.email, at:timestamp()};
  ticket.status = 'In progress';
  addActivity(ticket, actor, 'Corrections requested: ' + note, 'internal');
  return {id:order.id};
}

export function ticketOverview(state, actor) {
  const permissions = actor.permissions;
  const tickets = availableTickets(state).filter(ticket => canSee(ticket, actor) && scopeTicket(state,ticket,actor)).map(ticket => {
    const {mailMessages,mailThreads,watchers,mutedBy,...record} = ticket;
    const allowMail = permissions.includes('ticket.mail');
    const mail = allowMail ? (mailMessages || []).map(({attachments,...message})=>({
      ...message, attachments:attachments.map((file,index)=>({id:message.key+':'+index,name:file.name}))
    })) : [];
    return {...record, ...(!allowMail && ticket.source==='Email'?{contact:''}:{}), following:watchers?.includes(actor.email)||false, muted:mutedBy?.includes(actor.email)||false, mail, attachments:ticket.attachments.map(({content,...metadata})=>metadata)};
  });
  const clientIds = new Set(tickets.map(ticket => ticket.clientId));
  const clients = state.customers.filter(client => clientIds.has(client.id) || permissions.includes('customers.view') || permissions.includes('ticket.create'))
    .map(client => ({
      id:client.id, name:client.business || client.name,
      ...(permissions.includes('customers.view') ? {email:client.email, phone:client.phone, contacts:client.contacts || []} : {})
    }));
  return {
    tickets, clients,
    assignees:permissions.includes('ticket.assign') ? (state.users || []).filter(user => user.active !== false).map(user => user.email) : [],
    statuses:ticketStatuses, priorities
  };
}
