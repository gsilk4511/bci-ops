import {createHash} from 'node:crypto';
import {ticketAction} from './tickets.js';
import {recordCanAccess} from './record-scope.js';

const graph = 'https://graph.microsoft.com';
const address = value => String(value || '').trim().toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const intakeActor = {email:'mail-intake',permissions:['ticket.assign','tickets.view','ticket.viewAll']};

export function createMailbox(env, request = fetch) {
  const tenant = env.BCI_MAIL_TENANT_ID;
  const client = env.BCI_MAIL_CLIENT_ID;
  const mailbox = env.BCI_MAIL_ADDRESS?.trim();
  const secret = env.BCI_MAIL_CLIENT_SECRET;
  const enabled = Boolean(uuid.test(tenant || '') && uuid.test(client || '') && secret && /^[^@/\s]+@[^@/\s]+$/.test(mailbox || ''));
  const root = graph + '/v1.0/users/' + encodeURIComponent(mailbox || '');
  const identity = enabled ? tenant + ':' + address(mailbox) : '';
  const initial = root + '/mailFolders/inbox/messages/delta?$select=id,internetMessageId,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,body,hasAttachments';
  let access;
  async function json(url, options, label) {
    const response = await request(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
    if (!response.ok) {
      const error = Error(label + ' returned HTTP ' + response.status);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
  async function token() {
    if (access && Date.now() < access.expires) return access.value;
    const response = await json('https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0/token',{
      method:'POST',body:new URLSearchParams({client_id:client,client_secret:secret,scope:graph+'/.default',grant_type:'client_credentials'})
    },'Microsoft sign-in');
    if (typeof response.access_token !== 'string') throw Error('Microsoft sign-in did not return a token');
    access = {value:response.access_token,expires:Date.now()+Math.max(0,Number(response.expires_in)-120)*1000};
    return access.value;
  }
  async function read(url) {
    const target = new URL(url);
    if (target.origin !== graph || !target.pathname.toLowerCase().startsWith(new URL(root).pathname.toLowerCase() + '/')) throw Error('Invalid mailbox continuation');
    return json(target,{
      headers:{Authorization:'Bearer '+await token(),Prefer:'outlook.body-content-type="text", IdType="ImmutableId", odata.maxpagesize=20'}
    },'Microsoft Graph');
  }
  async function attachments(id) {
    const base = root+'/messages/'+encodeURIComponent(id)+'/attachments';
    const list = await read(base+'?$select=id,name,size,isInline&$top=20');
    const result = [];
    for (const file of list.value || []) {
      if (file.isInline || file.size > 250000 || !file.id || result.length >= 8) continue;
      const detail = await read(base+'/'+encodeURIComponent(file.id));
      if (detail['@odata.type'] === '#microsoft.graph.fileAttachment' &&
          typeof detail.contentBytes === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(detail.contentBytes) &&
          Buffer.from(detail.contentBytes,'base64').length <= 250000) {
        result.push({name:String(detail.name || 'Attachment').slice(0,160).replace(/[\\/\x00-\x1f]/g,'_'), content:detail.contentBytes});
      }
    }
    return result;
  }
  return {enabled, identity, mailbox, async page(cursor, since) {
    if (!enabled) throw Error('Configure the Microsoft 365 intake mailbox first');
    const response = await read(cursor || initial);
    const next = response['@odata.nextLink'] || response['@odata.deltaLink'];
    if (!next || !Array.isArray(response.value)) throw Error('Microsoft Graph did not return a continuation');
    const messages = [];
    for (const message of response.value) {
      if (!message.id || message['@removed'] || !message.receivedDateTime || message.receivedDateTime < since) continue;
      messages.push({
        key:createHash('sha256').update(identity+'|'+(message.internetMessageId || message.id)).digest('hex'),
        conversation:String(message.conversationId || '').slice(0,500), subject:String(message.subject || '(No subject)').slice(0,180),
        from:address(message.from?.emailAddress?.address).slice(0,254),
        recipients:[...(message.toRecipients || []),...(message.ccRecipients || [])].slice(0,30).map(item=>address(item.emailAddress?.address).slice(0,254)),
        at:message.receivedDateTime, body:String(message.body?.content || '').slice(0,100000),
        truncated:String(message.body?.content || '').length > 100000,
        attachments:message.hasAttachments ? await attachments(message.id) : []
      });
    }
    return {messages,next,more:Boolean(response['@odata.nextLink'])};
  }};
}

function candidates(state, message) {
  // Outlook forwards come from the forwarder. Quoted From lines are suggestions only.
  const forwarded = /^\s*(fw|fwd):/i.test(message.subject);
  const quoted = [...message.body.matchAll(/^\s*From:.*?([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/gim)].map(match=>address(match[1]));
  const emails = new Set(forwarded ? quoted : [message.from]);
  const matches = state.customers.filter(client => [client.email,client.financeEmail,...(client.contacts || []).map(contact=>contact.email)].some(email=>email && emails.has(address(email))));
  return {matches, automatic:!forwarded && matches.length===1};
}

function linkMessage(state, message, clientId) {
  const prior = (state.tickets || []).filter(ticket=>ticket.clientId===clientId &&
    message.conversation && ticket.mailThreads?.includes(message.conversation));
  let ticket = prior.length===1 && prior[0].status!=='Completed' ? prior[0] : null;
  if (!ticket) {
    const {id} = ticketAction(state,'ticket.create',{clientId,title:message.subject.trim() || '(No subject)'},intakeActor);
    ticket = state.tickets.find(record=>record.id===id);
  }
  (ticket.mailThreads ??= []);
  if (message.conversation && !ticket.mailThreads.includes(message.conversation)) ticket.mailThreads.push(message.conversation);
  (ticket.mailMessages ??= []).push(message);
  return ticket.id;
}

export function importMailboxPage(state, identity, expectedCursor, page, since) {
  const previous = state.mailSync;
  if (previous?.identity === identity && (previous.cursor || '') !== (expectedCursor || '')) return false;
  const seen = state.mailSeen ??= {};
  for (const message of page.messages) {
    if (Object.hasOwn(seen,message.key)) continue;
    const {matches, automatic} = candidates(state,message);
    const prospectMatches = message.conversation ? (state.tickets || []).filter(t=>t.kind==='prospect' && t.mailThreads?.includes(message.conversation)) : [];
    if (prospectMatches.length === 1) (prospectMatches[0].mailMessages ??= []).push(message);
    else if (automatic && !prospectMatches.length) linkMessage(state,message,matches[0].id);
    else (state.mailQueue ??= []).push({...message,suggestions:matches.map(client=>client.id)});
    seen[message.key] = message.at;
  }
  state.mailSync = {identity,cursor:page.next,since,lastSuccess:new Date().toISOString()};
  return true;
}

export function assignMail(state, data, actor = intakeActor) {
  const queue = state.mailQueue || [];
  const message = queue.find(item=>item.key===data.key);
  if (!message) throw Error('Email was already processed');
  const existing = data.prospectId && (state.tickets || []).find(t => t.id === data.prospectId && t.kind === 'prospect' && recordCanAccess(t,'tickets',actor));
  if (data.prospectId && !existing) throw Error('Choose an existing opportunity');
  if (!existing && data.kind !== 'prospect' && !state.customers.some(client=>client.id===data.clientId)) throw Error('Select a billing client');
  const {suggestions,...original} = message;
  let id;
  if (existing || data.kind === 'prospect') {
    if (!existing && original.conversation && (state.tickets || []).some(t => t.kind === 'prospect' && t.mailThreads?.includes(original.conversation))) {
      throw Error('This conversation already has an opportunity. Link to it instead.');
    }
    id = existing?.id || ticketAction(state,'ticket.create',{kind:'prospect',title:data.title || original.subject,company:data.company,contact:data.contact || original.from,due:data.due},actor).id;
    const prospect = (state.tickets || []).find(t=>t.id===id);
    if (!existing) prospect.source = 'Email';
    (prospect.mailMessages ??= []).push(original);
    const threads = prospect.mailThreads ??= [];
    if (original.conversation && !threads.includes(original.conversation)) threads.push(original.conversation);
  } else id = linkMessage(state,original,data.clientId);
  state.mailQueue = queue.filter(item=>item.key!==message.key);
  return {id};
}
