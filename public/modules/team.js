// Owns the team presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { data, me, esc, head, table, modal } from '../app.js';
import { accessDescriptors, effectiveModuleAccess, modeLabels, scopeLabels, scopedAreas, areaLabel } from './access-matrix.js';

export function teamPage(){
 const sync=data.accessSync;
 const syncText=!sync?.enabled?'Disabled · configure the token and IDs in .env.secure':
  sync.state==='synced'?`Synced · ${sync.count} approved emails`:
  sync.state==='failed'?sync.message:sync.state==='syncing'?'Syncing…':'Ready to sync';
 const profiles=data.permissionProfiles||[];
 const descriptors=accessDescriptors(data.permissionMatrix,data.modulePermissions);
 const accounts=data.teamAccess||{};
 const users=Object.entries(accounts).map(([email,access])=>{
  const user=(data.users||[]).find(member=>member.email.toLowerCase()===email.toLowerCase());
  const label=access.protectedAdmin?'Deployment administrator':profiles.find(profile=>profile.id===user?.profileId)?.name||user?.role||'—';
  return `<tr><td>${esc(email)}</td><td>${esc(label)}</td><td>${access.role?'Active':'Disabled'}</td>
   <td><button class="secondary small" data-team-access="${esc(email)}">View effective access</button>
   ${user&&!access.protectedAdmin?`<button class="secondary small" data-user-email="${esc(user.email)}">Edit</button>`:''}</td></tr>`;
 });
 const saved=profiles.map(profile=>`<tr><td>${esc(profile.name)}</td><td>${descriptors.filter(d=>!d.adminOnly&&effectiveModuleAccess(d,profile).mode!=='hidden').length} visible areas</td><td>${(data.users||[]).filter(u=>u.profileId===profile.id&&u.active!==false).length}</td><td><button class="secondary small" data-profile-id="${esc(profile.id)}">Edit</button></td></tr>`);
 return head('Admin permissions','Access control','Manage teammates and save reusable permission profiles.', '<div class="gap"><button class="secondary" data-open="import">Import clients &amp; projects</button><button class="primary" data-open="user">+ Teammate</button></div>')+
 `<section class="panel"><h2>Cloudflare Access sync</h2><p>${esc(syncText)}</p>
  ${sync?.enabled?'<button class="secondary" data-open="access-sync">Sync / retry</button>':''}</section>
 <section class="panel"><h2>Teammates</h2>${table(['Email','Access level','Status',''],users)}</section>
 <section class="panel"><div class="flex"><h2>Saved access levels</h2><button class="primary" data-open="profile">+ Profile</button></div>
 ${table(['Profile','Access summary','Active users',''],saved)}</section>
 ${data.mailIntake?`<section class="panel"><h2>Microsoft 365 intake</h2>
 <p>${esc(data.mailIntake.enabled?data.mailIntake.address:'Mailbox setup required')}</p>
 <p>Last successful sync · ${esc(data.mailIntake.lastSuccess?new Date(data.mailIntake.lastSuccess).toLocaleString():'—')}</p>
 ${data.mailIntake.error?`<p class="warn">${esc(data.mailIntake.error)}</p>`:''}
 <a href="/?intake=1">Open email intake</a></section>`:''}`;
}



document.addEventListener('click',event=>{
 const button=event.target.closest('[data-team-access]');
 if(!button||me?.role!=='admin')return;
 const email=button.dataset.teamAccess;
 const access=data.teamAccess?.[email];
 if(!access)return;
 const labels=Object.assign({},...Object.values(data.permissionGroups||{}));
 const modules=accessDescriptors(data.permissionMatrix,data.modulePermissions).map(descriptor=>{
  const {mode,scope,delete:deleteKeys}=effectiveModuleAccess(descriptor,access);
  const effectiveMode=access.role==='admin'&&descriptor.adminOnly?'write':mode;
  const deleteText=descriptor.area==='workorders'?(access.role==='admin'&&access.permissions.includes('workorder.delete')?'Whole orders and entries':deleteKeys.includes('entry.remove')?'Own entries only':'Not allowed'):(deleteKeys.length?'Allowed':'Not allowed');
  const scopeText=effectiveMode==='hidden'||!scopedAreas.includes(descriptor.area)?'—':scopeLabels[scope]||(access.role==='admin'?'All permitted records':descriptor.area==='tickets'?'Existing ticket visibility':'All permitted records');
  return '<tr><th scope="row">'+esc(areaLabel(descriptor.area))+'</th><td>'+esc(modeLabels[effectiveMode])+'</td><td>'+esc(scopeText)+'</td><td>'+(descriptor.delete.length?esc(deleteText):'—')+'</td></tr>';
 });
 modal('Effective access','<p>'+esc(email)+' · '+esc(access.role||'Disabled')+'</p>'+
  (access.protectedAdmin?'<p>This administrator is configured in the deployment environment.</p>':'')+
  table(['Area','Access','Record scope','Delete'],modules)+'<details><summary>Effective granted actions</summary><ul>'+
  access.permissions.map(key=>'<li>'+esc(labels[key]||key)+'</li>').join('')+'</ul></details>',()=>{});
 document.querySelector('#actionForm button[type=submit]').hidden=true;
});
