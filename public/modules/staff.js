import {can, data, esc, f, head, modal, render, send, table, today} from '../app.js';

import {profileCard, personalProfileFields, personalProfilePayload} from './staff-profile.js';
import {contributionPanel} from './staff-contribution.js';
import {businessManagerPanel} from './business-manager.js';

let firstDay='',lastDay='';
const categories={work:'Customer work',travel:'Travel',internal:'Internal work',vacation:'Vacation',sick:'Sick'};
const number=value=>Number(value || 0).toLocaleString(undefined,{maximumFractionDigits:2});
const inRange=record=>(!firstDay||record.date>=firstDay)&&(!lastDay||record.date<=lastDay);
const ordered=rows=>rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.type.localeCompare(b.type));
const action=(key,label,id='')=>`<button type="button" class="secondary" data-staff-action="${key}" data-staff-id="${esc(id)}">${label}</button>`;
function timeLink(row) {
 return row.workorderId?`<button type="button" class="rowlink" data-wo="${esc(row.workorderId)}">${esc(row.workorder)}</button>`:esc(row.workorder);
}
export function staffPage() {
 const staff=data.staff;
 if(!staff)return head('My Time & Profile','Staff','This section is not available in the current session.');
 const profile=staff.profile;
 const entries=ordered(staff.time.filter(inRange));
 const leave=ordered(staff.leave.filter(inRange));
 const admin=Array.isArray(staff.staffProfiles);
 const totals=Object.fromEntries(Object.keys(categories).map(type=>[type,[...entries,...leave.filter(row=>row.status==='Approved')].filter(e=>e.type===type).reduce((sum,e)=>sum+e.quantity,0)]));
 return head('My Time & Profile','Staff','Review your work orders, record time off, or start a new internal task.',
  (can('staff.leave')?action('leave','+ Add Time Off'):'')+(staff.internalAvailable&&can('staff.internal')?action('internal','+ New Internal Work Order'):''))
  +`<section class="panel"><h2>My profile</h2>
   ${profileCard(profile)}
   <p class="bci-staff-private"><strong>Only visible to you and authorized admins:</strong> ${esc(profile.contactEmail||'')} · Pay scale: ${esc(profile.payScale||'Not set')} · Vacation: ${number(profile.vacationHours)} h · Sick: ${number(profile.sickHours)} h</p>
   ${can('staff.profile')?action('profile','Edit my profile'):''}</section>`
  +(can('businessManager.view')?businessManagerPanel(staff.businessManager,can('businessManager.manage')):'')
  +`<section class="panel"><h2>My work orders &amp; projects</h2>
   <div class="bci-staff-totals">
    <div><strong>${number(staff.overview?.workorders)}</strong><span>Work orders</span></div>
    <div><strong>${number(staff.overview?.projects)}</strong><span>Projects</span></div>
   </div>
   ${table(['Project','Work orders','Logged hours'],(staff.projects||[]).map(row=>`<tr><td>${row.id&&can('projects.view')?`<button type="button" class="rowlink" data-staff-action="project" data-staff-id="${esc(row.id)}">${esc(row.name)}</button>`:esc(row.name)}</td><td>${number(row.workorders)}</td><td>${number(row.hours)}</td></tr>`))}
   </section>`
  +contributionPanel(staff.contribution,staff.projects||[])
  +`   <section class="panel"><h2>My time by date</h2><form id="myTimeFilter" class="filters">
    ${f('start','Week or pay period start',{type:'date',value:firstDay})}
    ${f('end','Week or pay period end',{type:'date',value:lastDay})}
    <button class="secondary">Filter</button></form>
    <p>${Object.entries(totals).map(([type,hours])=>esc(categories[type])+' '+number(hours)+' h').join(' · ')}</p>
    ${table(['Date','Category','Hours','Work order','Project','Notes','Status'],entries.map(row=>`<tr><td>${esc(row.date)}</td><td>${esc(categories[row.type])}</td><td>${number(row.quantity)}</td><td>${timeLink(row)}</td><td>${esc(row.project||'')}</td><td>${esc(row.note)}</td><td>${esc(row.status)}</td></tr>`))}</section>
   <section class="panel"><h2>Time off</h2>${table(['Date','Category','Hours','Status'],leave.map(row=>`<tr><td>${esc(row.date)}</td><td>${esc(categories[row.type])}</td><td>${number(row.quantity)}</td><td>${esc(row.status)}</td></tr>`))}</section>`
  +`<section class="panel"><h2>Team directory</h2><p>Read-only profiles shared internally.</p>
   ${staff.directory?.length?`<div class="bci-staff-directory">${staff.directory.map(peer=>`<article>${profileCard({displayName:peer.displayName,bio:peer.bio,avatarUrl:peer.avatarUrl,socialLinks:peer.socialLinks})}</article>`).join('')}</div>`:'<p>No other team profiles are available.</p>'}</section>`
  +(admin?`<section class="panel"><h2>Staff profiles</h2>${table(['Employee','Sign-in','Vacation','Sick',''],staff.staffProfiles.map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(row.email)}</td><td>${number(row.vacationHours)} h</td><td>${number(row.sickHours)} h</td><td>${can('staff.manage')?action('manage','Edit',row.email):''}</td></tr>`))}</section>
   <section class="panel"><h2>Pending time off</h2>${table(['Employee','Date','Category','Hours',''],staff.requests.map(row=>`<tr><td>${esc(staff.staffProfiles.find(member=>member.email===row.email)?.name||row.email)}</td><td>${esc(row.date)}</td><td>${esc(categories[row.type])}</td><td>${number(row.quantity)}</td><td>${can('staff.leaveReview')?action('review','Review',row.id):''}</td></tr>`))}</section>`:'');
}
function profileFields(row,admin) {
 const common=f('name','Name',{required:true,value:row.name})+f('contactEmail','Contact email',{type:'email',required:true,value:row.contactEmail});
 return common+(admin?f('payScale','Pay scale',{value:row.payScale})+
  f('vacationHours','Available vacation hours',{type:'number',required:true,min:0,step:'0.01',value:String(row.vacationHours)})+
  f('sickHours','Available sick hours',{type:'number',required:true,min:0,step:'0.01',value:String(row.sickHours)}):'');
}
document.addEventListener('submit',event=>{
 if(event.target.id!=='myTimeFilter'||!can('staff.view'))return;
 event.preventDefault();
 const values=Object.fromEntries(new FormData(event.target));
 if(values.start&&values.end&&values.end<values.start){
  const input=event.target.elements.end;
  input.setCustomValidity('End date must be on or after the start date');
  input.reportValidity();input.setCustomValidity('');return;
 }
 firstDay=values.start;lastDay=values.end;render();
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-staff-action]');
 if(!button||!can('staff.view')||!data.staff)return;
 const id=button.dataset.staffId,staff=data.staff;
 switch(button.dataset.staffAction){
  case 'profile': if(can('staff.profile'))modal('Edit my profile',personalProfileFields(staff.profile),async values=>send('staff.profile',await personalProfilePayload(values)));break;
  case 'project': if(can('projects.view')&&staff.projects?.some(row=>String(row.id)===id))document.dispatchEvent(new CustomEvent('bci:open-project',{detail:id}));break;
  case 'manage': {
   const row=staff.staffProfiles?.find(item=>item.email===id);
   if(row&&can('staff.manage'))modal('Edit staff profile',profileFields(row,true),values=>send('staff.manage',{...values,email:id}),`<p>Sign-in: ${esc(row.email)} (unchanged)</p>`);break;
  }
  case 'leave': if(can('staff.leave'))modal('Add time off',f('type','Type',{select:[['vacation','Vacation'],['sick','Sick time']]})+
   f('date','Date',{type:'date',required:true,value:today()})+f('quantity','Hours',{type:'number',required:true,min:'0.01',step:'0.01'}),
   values=>send('staff.leave',values));break;
  case 'review': if(can('staff.leaveReview')&&staff.requests?.some(row=>row.id===id))modal('Review time off',
   f('decision','Decision',{required:true,select:[['','Select a decision'],['approve','Approve and record for payroll'],['decline','Decline']]}),
   values=>send('staff.leaveReview',{...values,id}));break;
  case 'internal': if(staff.internalAvailable&&can('staff.internal'))modal('New internal work order',
   f('description','What are you working on?',{required:true,textarea:true,placeholder:'Example: rebuild the parts rack in Truck 2'}),
   async values=>{const order=await send('staff.internal',values);if(order?.id)document.dispatchEvent(new CustomEvent('bci:open-workorder',{detail:order.id}));},
   '<p>Randy Bevins · BCI ELITE ADMIN · Nonbillable</p>');break;
 }
});
