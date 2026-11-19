import {data, can, esc, f, modal, send, show, openForm} from '../app.js';

export function emailIntakePanel(){
  const intake=data.mailIntake;
  if(!intake)return '';
  return '<section class="panel"><h2>Email intake</h2><p>'+esc(intake.enabled?'Mailbox · '+intake.address:'Microsoft 365 mailbox setup required')+'</p>'+
    '<p>Last successful sync · '+esc(intake.lastSuccess?new Date(intake.lastSuccess).toLocaleString():'—')+'</p>'+
    (intake.error?'<p class="warn">'+esc(intake.error)+'</p>':'')+
    '<div class="actions">'+(intake.enabled?'<button class="secondary" data-mail-sync>Sync now</button>':'')+
    (can('customer.create')?'<button class="secondary" data-mail-client>Create billing client</button>':'')+'</div></section>'+
    '<section class="panel"><h2>Unassigned intake</h2>'+
    (intake.messages.length?intake.messages.map(message=>{
      const suggestions=message.suggestions.map(id=>data.ticketOverview.clients.find(client=>client.id===id)?.name).filter(Boolean);
      return '<details><summary>'+esc(message.subject)+' · '+esc(message.from)+'</summary>'+
        '<p>'+esc(new Date(message.at).toLocaleString())+' · '+message.attachmentCount+' retained attachment(s)</p>'+
        (suggestions.length?'<p>Suggested clients · '+suggestions.map(esc).join(', ')+'</p>':'')+
        '<p class="ticket-text">'+esc(message.body)+'</p>'+
        (message.truncated?'<p>Email text was shortened. See the intake mailbox for the full message.</p>':'')+
        (can('ticket.create')?'<button class="secondary" data-mail-assign="'+esc(message.key)+'">Assign client</button> <button class="secondary" data-mail-prospect="'+esc(message.key)+'">Chase or link opportunity</button>':'')+'</details>';
    }).join(''):'<p>No email needs assignment.</p>')+'</section>';
}

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-mail-sync],[data-mail-assign],[data-mail-client],[data-mail-prospect]');
  if(!button||!can('mail.intake')||!can('tickets.view'))return;
  if(button.hasAttribute('data-mail-client'))return openForm('customer');
  if(button.hasAttribute('data-mail-sync')){
    button.disabled=true;
    try{await send('mail.sync',{});show('Mailbox synced');}catch(error){show(error.message,true);}
    finally{button.disabled=false;}
    return;
  }
  if(!can('ticket.create'))return;
  const mail=data.mailIntake.messages.find(message=>message.key===(button.dataset.mailAssign || button.dataset.mailProspect));
  if(!mail)return;
  if (button.dataset.mailProspect) return modal('Chase or link opportunity',
    f('prospectId','Existing opportunity (optional)',{select:[['','Create a new opportunity'],...data.ticketOverview.tickets.filter(ticket=>ticket.kind==='prospect').map(ticket=>[ticket.id,ticket.title+' · '+ticket.status])]})+
    f('title','New opportunity title',{value:mail.subject})+f('company','Company')+f('contact','Contact',{value:mail.from})+f('due','Follow-up due',{type:'date'}),
    async fields=>{const result=await send('mail.assign',{kind:'prospect',key:mail.key,...fields});window.location.assign('/?ticket='+encodeURIComponent(result.id));},
    '<p>Check the project and prior outreach before creating a new opportunity.</p>');
  const clients=data.ticketOverview.clients;
  modal('Assign billing client',f('clientId','Billing client',{required:true,
    select:[['','Choose a client'],...clients.map(client=>[client.id,client.name])],
    value:mail.suggestions.length===1?mail.suggestions[0]:''}),async fields=>{
      const result=await send('mail.assign',{key:mail.key,clientId:fields.clientId});
      window.location.assign('/?ticket='+encodeURIComponent(result.id));
    },'<p>'+esc(mail.subject)+'</p>');
});
