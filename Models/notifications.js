import {createHash} from 'node:crypto';
import {ticketOverview} from './tickets.js';

const defaults = {assigned:true,overdue:true,review:true,intake:true,quietStart:'',quietEnd:'',zone:'America/New_York'};
const allowedHost = host => ['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com',
  'web.push.apple.com','notify.windows.com'].some(domain=>host===domain||host.endsWith('.'+domain));
const fingerprint = endpoint => createHash('sha256').update(endpoint).digest('hex');

export function subscriptionFrom(data) {
  const endpoint = new URL(data?.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.port ||
      !allowedHost(endpoint.hostname) || endpoint.href.length > 2048) throw Error('Unsupported push service');
  const keys = data.keys || {};
  const publicKey = typeof keys.p256dh === 'string' && /^[\w-]+$/.test(keys.p256dh) ? Buffer.from(keys.p256dh,'base64url') : null;
  const auth = typeof keys.auth === 'string' && /^[\w-]+$/.test(keys.auth) ? Buffer.from(keys.auth,'base64url') : null;
  if (!publicKey || publicKey.length !== 65 || publicKey[0] !== 4 || !auth || auth.length !== 16) throw Error('Invalid push subscription');
  return {endpoint:endpoint.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}

export function createPush(env, sender) {
  const publicKey = env.BCI_PUSH_PUBLIC_KEY;
  const privateKey = env.BCI_PUSH_PRIVATE_KEY;
  const subject = env.BCI_PUSH_SUBJECT;
  const enabled = /^[\w-]{87}$/.test(publicKey || '') && /^[\w-]{43}$/.test(privateKey || '') && /^mailto:[^\s@]+@[^\s@]+$/.test(subject || '');
  return {enabled, publicKey:enabled ? publicKey : undefined, async send(subscription, event) {
    if (!enabled) throw Error('Configure Web Push keys first');
    const webPush = sender || (await import('web-push')).default;
    // Only the destination and a generic label go to the phone lock screen.
    await webPush.sendNotification(subscription,JSON.stringify({title:'BCI Operations',body:event.label,tag:event.id,url:event.url}),
      {vapidDetails:{subject,publicKey,privateKey},TTL:3600,timeout:10000});
  }};
}

function userRecord(state,email) {
  const users = state.notificationUsers ??= [];
  let record = users.find(item=>item.email===email);
  if (!record) {record={email,preferences:{...defaults},devices:[],read:[]};users.push(record);}
  return record;
}

export function notificationEvents(state, actor, now = new Date()) {
  const record = state.notificationUsers?.find(item=>item.email===actor.email);
  const preferences = {...defaults,...record?.preferences};
  const today = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:preferences.zone}).format(now);
  const events = [];
  if (actor.permissions.includes('tickets.view')) for (const ticket of ticketOverview(state,actor).tickets) {
    if (ticket.muted || ticket.status === 'Completed') continue;
    const url = '/?ticket='+encodeURIComponent(ticket.id);
    const add = (type, label, at, marker) => events.push({id:type+':'+ticket.id+':'+marker,type,label,title:ticket.title,url,at});
    if (preferences.assigned && ticket.assignee===actor.email) add('assigned','A ticket is assigned to you.',ticket.assignedAt || ticket.createdAt,ticket.assignedAt || actor.email);
    if(preferences.assigned && ticket.following && ticket.assignee!==actor.email && ticket.activity.length){
      const update=ticket.activity.at(-1);
      if(update.by!==actor.email)add('follow','A ticket you follow was updated.',update.at,update.id);
    }
    if (preferences.overdue && ticket.due && ticket.due < today) add('overdue','A ticket is overdue.',today+'T12:00:00Z',ticket.due);
    if (preferences.review && ticket.kind==='review' && ticket.status==='Ready for review' && actor.permissions.includes('workorder.review')) {
      const at = state.workorders.find(order=>order.id===ticket.workorderId)?.closeout?.at;
      if (at) add('review','A work order awaits review.',at,at);
    }
  }
  if (preferences.intake && actor.permissions.includes('mail.intake') && actor.permissions.includes('tickets.view')) for (const mail of state.mailQueue || []) {
    events.push({id:'intake:'+mail.key,type:'intake',label:'An email needs a billing client.',title:mail.subject,url:'/?intake=1',at:mail.at});
  }
  return events.sort((a,b)=>b.at.localeCompare(a.at)).map(event=>({...event,read:record?.read.includes(event.id)||false}));
}

export function notificationView(state, actor, push) {
  const record = state.notificationUsers?.find(item=>item.email===actor.email);
  return {preferences:{...defaults,...record?.preferences},events:notificationEvents(state,actor),deviceCount:record?.devices.length || 0,pushKey:push.publicKey};
}

export function notificationAction(state, action, data, actor) {
  const record = userRecord(state,actor.email);
  if (action==='notification.save') {
    const preferences = Object.fromEntries(['assigned','overdue','review','intake'].map(key=>[key,data[key]===true]));
    const zone = typeof data.zone==='string' && data.zone.length<=100 ? data.zone : defaults.zone;
    try {new Intl.DateTimeFormat('en',{timeZone:zone});}catch{throw Error('Choose a valid time zone');}
    for (const key of ['quietStart','quietEnd']) {
      if (data[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data[key])) throw Error('Enter quiet hours as hours and minutes');
      preferences[key]=data[key] || '';
    }
    if (Boolean(preferences.quietStart)!==Boolean(preferences.quietEnd)) throw Error('Enter both quiet-hour times');
    record.preferences={...preferences,zone};
  } else if (action==='notification.subscribe') {
    const subscription = subscriptionFrom(data.subscription);
    const id = fingerprint(subscription.endpoint);
    const existing = record.devices.find(item=>item.id===id);
    if (!existing && record.devices.length>=8) throw Error('Remove a device before adding another');
    // A browser subscription can belong to only one signed-in account.
    for (const user of state.notificationUsers) if(user!==record)user.devices=user.devices.filter(device=>device.id!==id);
    if (existing) existing.subscription=subscription;
    else record.devices.push({id,subscription,sent:[],registeredAt:new Date().toISOString()});
  } else if (action==='notification.unsubscribe') {
    if(data.all===true)record.devices=[];
    else record.devices=record.devices.filter(item=>item.id!==fingerprint(String(data.endpoint || '')));
  } else if (action==='notification.read') {
    if (!notificationEvents(state,actor).some(event=>event.id===data.id)) throw Error('Notification unavailable');
    if (!record.read.includes(data.id)) record.read.push(data.id);
  } else throw Error('Unknown notification action');
  return {deviceCount:record.devices.length};
}

function quiet(preferences, now) {
  const {quietStart:start,quietEnd:end,zone} = preferences;
  if (!start || !end || start===end) return false;
  const time = new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:zone}).format(now);
  return start<end ? time>=start && time<end : time>=start || time<end;
}

export function pendingPush(state, actor, now = new Date()) {
  const record = state.notificationUsers?.find(item=>item.email===actor.email);
  if (!record || quiet(record.preferences,now)) return [];
  const events = notificationEvents(state,actor,now);
  return record.devices.flatMap(device=>events
    .filter(event=>!event.read && event.at>=device.registeredAt && !device.sent.includes(event.id))
    .slice(-5).map(event=>({device,event,email:actor.email})));
}

export function recordPush(state, email, deviceId, eventId, expired) {
  const record = state.notificationUsers?.find(item=>item.email===email);
  if (!record) return;
  if (expired) {record.devices=record.devices.filter(device=>device.id!==deviceId);return;}
  const device = record.devices.find(item=>item.id===deviceId);
  if (device && !device.sent.includes(eventId)) device.sent.push(eventId);
}
