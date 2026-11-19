import {data, can, esc, head, table, f, modal, send, show, view} from '../app.js';

let pushRegistration;
function preparePush(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||pushRegistration)return;
  navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready)
    .then(registration=>{pushRegistration=registration;}).catch(()=>{});
}
export function notificationsPage(){
  const settings=data.notifications;
  if(!settings)return '';
  const manage=can('notification.manage');
  if(manage&&settings.pushKey)preparePush();
  const devices=!manage?'':settings.pushKey ? '<button class="primary" data-notify="enable">Enable on this device</button> <button class="secondary" data-notify="test">Send test notification</button> <button class="secondary" data-notify="disable">Remove all devices</button>' :
    '<p>Phone notifications need server configuration. Your in-app inbox is available.</p>';
  return head('Notifications','Ticket updates','View your alerts and manage phone delivery.',manage?'<button class="secondary" data-notify="preferences">Preferences</button>':'')+
    '<section class="panel"><h2>Phone notifications</h2><p>Registered devices · '+settings.deviceCount+'</p><p>On iPhone or iPad, open BCI Ops from the Home Screen to enable notifications.</p><div class="actions">'+devices+'</div></section>'+
    '<section class="panel"><h2>Inbox</h2>'+table(['Alert','Record','Received',''],settings.events.map(event=>
      `<tr><td>${esc(event.label)}</td><td><a href="${esc(event.url)}">${esc(event.title)}</a></td><td>${esc(new Date(event.at).toLocaleString())}</td>
      <td>${event.read?'Read':!manage?'Unread':`<button class="secondary small" data-notify="read" data-id="${esc(event.id)}">Mark read</button>`}</td></tr>`))+'</section>';
}

function preferenceForm(){
  const preferences=data.notifications.preferences;
  const choices={assigned:'Tickets assigned to me',overdue:'Overdue tickets',review:'Work orders awaiting review',intake:'Email requiring a billing client'};
  modal('Notification preferences',Object.entries(choices).map(([key,label])=>
    `<label class="signature-terms"><input type="checkbox" name="${key}" ${preferences[key]?'checked':''}> ${label}</label>`).join('')+
    f('quietStart','Quiet hours start',{type:'time',value:preferences.quietStart})+
    f('quietEnd','Quiet hours end',{type:'time',value:preferences.quietEnd})+
    f('zone','Time zone',{required:true,value:preferences.zone || Intl.DateTimeFormat().resolvedOptions().timeZone}),
    fields=>send('notification.save',{...fields,...Object.fromEntries(Object.keys(choices).map(key=>[key,fields[key]==='on']))}),
    '<p>Quiet hours pause phone alerts. The inbox remains available.</p>');
}

async function enableDevice(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('Open the installed BCI Ops Home Screen app or a browser with Web Push support');
  if(!pushRegistration){preparePush();throw Error('Notification setup is loading. Tap Enable again in a moment.');}
  const key=data.notifications.pushKey.replace(/-/g,'+').replace(/_/g,'/');
  const applicationServerKey=Uint8Array.from(atob(key),character=>character.charCodeAt(0));
  // Call subscribe directly from the tap so iOS can display its permission prompt.
  const subscription=await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
  await send('notification.subscribe',{subscription:subscription.toJSON()});
}

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-notify]');
  if(!button||view!=='notifications'||!can('notification.view')||!can('notification.manage'))return;
  const action=button.dataset.notify;
  if(action==='preferences')return preferenceForm();
  if(action==='disable')return modal('Remove all registered devices','<p>Phone delivery will stop for all devices on your account.</p>',
    ()=>send('notification.unsubscribe',{all:true}));
  button.disabled=true;
  try{
    if(action==='enable')await enableDevice();
    if(action==='test'){
      const subscription=await pushRegistration?.pushManager.getSubscription();
      if(!subscription)throw Error('Enable notifications on this device first');
      await send('notification.test',{endpoint:subscription.endpoint});
      show('Test accepted by the push service for this device');
    }
    if(action==='read')await send('notification.read',{id:button.dataset.id});
  }catch(error){show(error.message,true);}
  finally{button.disabled=false;}
});
