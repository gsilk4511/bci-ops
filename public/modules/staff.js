import {can, data, esc, f, head, modal, practiceMode, render, send, table, today} from '../app.js';

import {profileCard, directoryProfile, personalProfileFields, personalProfilePayload, bindProfileEditor} from './staff-profile.js';
import {contributionPanel} from './staff-contribution.js';
import {contributionYear,openCompensationProfile,rateLabel} from './staff-contribution-admin.js';
import {businessManagerPanel} from './business-manager.js';
import {profileWeatherCard} from './profile-weather.js';
import {staffWorkspaceTheme} from './staff-workspace-theme.js';

let firstDay='',lastDay='';
const categories={work:'Customer work',travel:'Travel',internal:'Internal work',vacation:'Vacation',sick:'Sick'};
const number=value=>Number(value || 0).toLocaleString(undefined,{maximumFractionDigits:2});
const inRange=record=>(!firstDay||record.date>=firstDay)&&(!lastDay||record.date<=lastDay);
const ordered=rows=>rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.type.localeCompare(b.type));
const action=(key,label,id='')=>`<button type="button" class="secondary" data-staff-action="${key}" data-staff-id="${esc(id)}">${label}</button>`;
function timeLink(row) {
 return row.workorderId?`<button type="button" class="rowlink" data-wo="${esc(row.workorderId)}">${esc(row.workorder)}</button>`:esc(row.workorder);
}
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const weeklyCell=value=>value===null?'—':number(value)+' h';
function weeklyTimePanel(summary,admin){
 if(!summary)return '';
 return `<section class="panel" aria-labelledby="weeklyTimeHeading">
  <h2 id="weeklyTimeHeading">My last five weeks</h2>
  <p>Live logged time for you only. The split is a weekly estimate, not a payroll statement. Running timers and pending time-off requests are not counted.</p>
  ${summary.workweekStart===null?'<p><strong>Workweek not configured.</strong> Dates are grouped Monday–Sunday for now. Ask an administrator to set the first day of your established payroll workweek to see the Regular and Overtime split.</p>':`<p>Weeks start ${esc(weekdays[summary.workweekStart])}. The estimated split uses a 40-worked-hour threshold. Paid time off is listed separately.</p>`}
  ${admin?action('workweek','Set profile workweek'):''}
  ${table(['Week','Worked','Regular','Overtime','PTO','Sick','Holiday','Time status'],summary.rows.map(row=>`<tr>
   <td>${esc(row.start)} to ${esc(row.end)}${row.current?' (current)':''}</td>
   ${['worked','regular','overtime','pto','sick','holiday'].map(key=>`<td>${weeklyCell(row[key])}</td>`).join('')}
   <td>${row.lockedHours?esc(number(row.lockedHours))+' h in a finalized period. ':''}${row.openHours?esc(number(row.openHours))+' h not finalized. ':''}${row.pendingLeave?esc(number(row.pendingLeave))+' h pending leave, excluded. ':''}${row.issues?'One or more time entries need review. ':''}${!row.lockedHours&&!row.openHours&&!row.pendingLeave&&!row.issues?'No logged time.':''}</td>
  </tr>`))}
 </section>`;
}
let refreshing=false, contributionOwner=null, contributionMode='accrual';
function renderLiveMetrics(target,staff,focusMode){
 target.innerHTML=staffLiveContent(staff);
 if(focusMode)target.querySelector?.(`[data-staff-action="contribution-mode"][data-staff-id="${focusMode}"]`)?.focus({preventScroll:true});
}
async function refreshStaffMetrics(){
 const target=document.querySelector('#staffLiveMetrics'), staff=target&&data?.staff;
 if(document.hidden||refreshing||!staff||!can('staff.view')||target.dataset.practice==='true')return;
 refreshing=true;
 try{
  const response=await fetch('/api/staff-summary',{cache:'no-store'});
  if(data?.staff!==staff||!target.isConnected)return;
  if(response.status===401||response.status===403){target.replaceChildren();return;}
  if(!response.ok)return;
  const next=await response.json();
  if(data?.staff!==staff||!target.isConnected||next.email!==staff.profile.email||!next.weeklyTime)return;
  if(JSON.stringify([staff.contribution,staff.weeklyTime])===JSON.stringify([next.contribution,next.weeklyTime]))return;
  Object.assign(staff,{contribution:next.contribution,weeklyTime:next.weeklyTime});
  const focused=document.activeElement;
  renderLiveMetrics(target,staff,focused?.dataset.staffAction==='contribution-mode'&&target.contains?.(focused)?focused.dataset.staffId:null);
 }catch{/* A connection failure should not discard the last loaded summary. */}
 finally{refreshing=false;}
}
function staffLiveContent(staff){
 const owner=staff.profile.email+'|'+practiceMode;
 if(owner!==contributionOwner){contributionOwner=owner;contributionMode='accrual';}
 return contributionPanel(staff.contribution,staff.projects||[],contributionMode)+weeklyTimePanel(staff.weeklyTime,Array.isArray(staff.staffProfiles)&&can('staff.manage'));
}
document.addEventListener('visibilitychange',refreshStaffMetrics);
if(typeof setInterval==='function')setInterval(refreshStaffMetrics,30000);

export function staffPage() {
 const staff=data.staff;
 if(!staff)return head('My Time & Profile','Staff','This section is not available in the current session.');
 const profile=staff.profile;
 const entries=ordered(staff.time.filter(inRange));
 const leave=ordered(staff.leave.filter(inRange));
 const admin=Array.isArray(staff.staffProfiles);
 const rateYear=contributionYear(staff);
 const totals=Object.fromEntries(Object.keys(categories).map(type=>[type,[...entries,...leave.filter(row=>row.status==='Approved')].filter(e=>e.type===type).reduce((sum,e)=>sum+e.quantity,0)]));
 const heading=head('My Time & Profile','Staff','Review your work orders, record time off, or start a new internal task.',
  (can('staff.leave')?action('leave','+ Add Time Off'):'')+(staff.internalAvailable&&can('staff.internal')?action('internal','+ New Internal Work Order'):''));
 const content=`<section class="panel"><h2>My profile</h2>
   ${profileCard(profile)}
   <p class="bci-staff-private"><strong>Only visible to you and authorized admins:</strong> ${esc(profile.contactEmail||'')} · Pay scale: ${esc(profile.payScale||'Not set')} · Vacation: ${number(profile.vacationHours)} h · Sick: ${number(profile.sickHours)} h</p>
   ${can('staff.profile')?action('profile','Open Profile Studio'):''}</section>`
  +(can('businessManager.view')?businessManagerPanel(staff.businessManager,can('businessManager.manage')):'')
  +`<section class="panel"><h2>My work orders &amp; projects</h2>
   <div class="bci-staff-totals">
    <div><strong>${number(staff.overview?.workorders)}</strong><span>Work orders</span></div>
    <div><strong>${number(staff.overview?.projects)}</strong><span>Projects</span></div>
   </div>
   ${table(['Project','Work orders','Logged hours'],(staff.projects||[]).map(row=>`<tr><td>${row.id&&can('projects.view')?`<button type="button" class="rowlink" data-staff-action="project" data-staff-id="${esc(row.id)}">${esc(row.name)}</button>`:esc(row.name)}</td><td>${number(row.workorders)}</td><td>${number(row.hours)}</td></tr>`))}
   </section>`
  +`<div id="staffLiveMetrics" data-practice="${practiceMode?'true':'false'}">${staffLiveContent(staff)}</div>`
  +`   <section class="panel"><h2>My time by date</h2><form id="myTimeFilter" class="filters">
    ${f('start','Week or pay period start',{type:'date',value:firstDay})}
    ${f('end','Week or pay period end',{type:'date',value:lastDay})}
    <button class="secondary">Filter</button></form>
    <p>${Object.entries(totals).map(([type,hours])=>esc(categories[type])+' '+number(hours)+' h').join(' · ')}</p>
    ${table(['Date','Category','Hours','Work order','Project','Notes','Status'],entries.map(row=>`<tr><td>${esc(row.date)}</td><td>${esc(categories[row.type])}</td><td>${number(row.quantity)}</td><td>${timeLink(row)}</td><td>${esc(row.project||'')}</td><td>${esc(row.note)}</td><td>${esc(row.status)}</td></tr>`))}</section>
   <section class="panel"><h2>Time off</h2>${table(['Date','Category','Hours','Status'],leave.map(row=>`<tr><td>${esc(row.date)}</td><td>${esc(categories[row.type])}</td><td>${number(row.quantity)}</td><td>${esc(row.status)}</td></tr>`))}</section>`
  +`<section class="panel"><h2>Team directory</h2><p>Read-only profiles shared internally.</p>
   ${staff.directory?.length?`<div class="bci-staff-directory">${staff.directory.map(directoryProfile).join('')}</div>`:'<p>No other team profiles are available.</p>'}</section>`
  +(admin?`<section class="panel"><h2>Staff profiles</h2>${table(['Employee','Sign-in','Vacation','Sick',rateYear+' profit share',''],staff.staffProfiles.map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(row.email)}</td><td>${number(row.vacationHours)} h</td><td>${number(row.sickHours)} h</td><td>${esc(rateLabel(row,rateYear))}</td><td>${can('staff.manage')?action('manage','Edit staff profile',row.email):''}</td></tr>`))}</section>
   <section class="panel"><h2>Pending time off</h2>${table(['Employee','Date','Category','Hours',''],staff.requests.map(row=>`<tr><td>${esc(staff.staffProfiles.find(member=>member.email===row.email)?.name||row.email)}</td><td>${esc(row.date)}</td><td>${esc(categories[row.type])}</td><td>${number(row.quantity)}</td><td>${can('staff.leaveReview')?action('review','Review',row.id):''}</td></tr>`))}</section>`:'');
 return staffWorkspaceTheme(profile.style,heading+`<div class="bci-staff-columns${practiceMode?'':' has-weather'}">${practiceMode?'':profileWeatherCard()}<div class="bci-staff-primary">${content}</div></div>`);
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
  case 'contribution-mode': {
   const target=button.closest('#staffLiveMetrics');
   if(target&&staff.contribution?.cash&&['accrual','cash'].includes(id)){
    contributionMode=id;renderLiveMetrics(target,staff,id);
   }
   break;
  }
  case 'workweek': if(Array.isArray(staff.staffProfiles)&&can('staff.manage')){
   modal('Set staff profile workweek',f('workweekStart','Established workweek starts',{required:true,value:String(staff.weeklyTime?.workweekStart??''),
    select:[['','Choose a day'],...weekdays.map((day,i)=>[String(i),day])],hint:'Use the first day your payroll already uses. This changes the estimate display only.'}),
    values=>send('staff.manage',{workweekStart:values.workweekStart===''?null:Number(values.workweekStart)}));
  }break;
  case 'profile': if(can('staff.profile')){
   modal('Profile Studio',personalProfileFields(staff.profile),async values=>send('staff.profile',await personalProfilePayload(values)));
   const form=document.querySelector('#actionForm');
   form?.classList.add('bci-profile-editor');
   bindProfileEditor(form,staff.profile);
  }break;
  case 'project': if(can('projects.view')&&staff.projects?.some(row=>String(row.id)===id))document.dispatchEvent(new CustomEvent('bci:open-project',{detail:id}));break;
  case 'manage': {
   const row=staff.staffProfiles?.find(item=>item.email===id);
   if(row&&can('staff.manage'))openCompensationProfile(row,contributionYear(staff),profileFields(row,true));break;
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
