import {can,data,esc,head,me,practiceMode,render,send,view} from '../app.js';
import {calendarToday,dayShift,daySpan,monthShift,easternInstant,outlookCompose,scheduleIcs} from './calendar-time.js';

const modes={overview:'Overview',combined:'Combined',projects:'Projects',workorders:'Work Orders',crew:'Crew Timeline',mine:'My Schedule'};
const types={project:'Projects','project-due':'Project deadlines',workorder:'Work orders','workorder-due':'Work order deadlines',leave:'Staff days off',vehicle:'Vehicle bookings','vehicle-reminder':'Vehicle reminders',appointment:'Business appointments'};
const ranges={'1':'1 Day','3':'3 Days','5':'5 Days','month':'1 Month','quarter':'3 Months'};
const short=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'});
const monthFmt=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',year:'numeric'});
const mini=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',day:'numeric'});
const dateText=(day,fmt=short)=>fmt.format(new Date(day+'T00:00:00Z'));
const minutes=time=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
const timeText=time=>{
 if(!time)return '';
 const [h,m]=time.split(':').map(Number);
 return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?'a':'p');
};
const timeRange=(start,end)=>[timeText(start),timeText(end)].filter(Boolean).join('–');
const get=()=>data?.calendar;
const w=()=>typeof window==='undefined'?null:window;
const today=()=>calendarToday();
let state,back,activeDialog;
function calendarState(){
 if(!state)state={mode:w()?.matchMedia?.('(max-width: 700px)').matches&&me?.role==='tech'?'mine':'overview',range:'5',anchor:today(),type:'',staff:'',vehicle:'',mineDays:'tomorrow',gridScroll:0};
 return state;
}
export function clearCalendar(){
 activeDialog?.close();
 state=undefined;back=undefined;
}
const toggle=(name,key,label,active,classes='secondary small')=>'<button type="button" class="'+classes+'" data-cal-'+name+'="'+esc(key)+'"'+(active===undefined?'':' aria-pressed="'+String(active)+'"')+'>'+esc(label)+'</button>';
const valueField=(name,label,value,{type='text',required=false,max=0}={})=>`<label class="bci-cal-field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value||'')}" ${required?'required':''} ${max?'maxlength="'+max+'"':''}></label>`;
const selects=(name,label,options,chosen)=>`<label class="bci-cal-field">${label}<select data-cal-filter="${name}">${options.map(([v,t])=>`<option value="${esc(v)}" ${v===chosen?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
const crewLabel=crew=>(crew||[]).map(x=>x.name).filter(Boolean).join(' / ');
const caps=(row,category)=>(row?.crew||[]).filter(member=>category==='self'?member.self:!member.self);
const crewMatches=(members,value)=>!value||(members||[]).some(p=>String(p.email||p.name)===value);
const isMine=row=>caps(row,'self').length>0;
function frame(st){
 if(st.mode==='mine'){
  const d=today(),day=st.mineDays==='tomorrow'?dayShift(d,1):d;
  return {days:daySpan(day,st.mineDays==='week'?dayShift(d,6):day),start:day,end:st.mineDays==='week'?dayShift(d,6):day};
 }
 const month=st.anchor.slice(0,7)+'-01';
 const start=['month','quarter'].includes(st.range)?month:st.anchor;
 const end=st.range==='quarter'?dayShift(monthShift(start,3),-1):st.range==='month'?dayShift(monthShift(start,1),-1):dayShift(start,Number(st.range)-1);
 return {start,end,days:daySpan(start,end)};
}
const inSpan=(date,{start,end})=>date&&date>=start&&date<=end;
const eventAttrs=event=>event.type.startsWith('project')?`data-cal-link="project" data-cal-id="${esc(event.id)}"`:
 event.type.startsWith('workorder')?`data-cal-link="workorder" data-cal-id="${esc(event.id)}"`:
 event.type.startsWith('vehicle')?`data-cal-link="vehicle" data-cal-id="${esc(event.id)}"`:
 event.type==='appointment'?`data-cal-appointment="${esc(event.id)}"`:'';
function allEvents(board,st,span,includeWindows=true){
 const out=[];
 const push=event=>{if(inSpan(event.date,span)&&(!st.type||st.type===event.type)&&crewMatches(event.crew,st.staff)&&(!st.vehicle||event.type.startsWith('vehicle')&&event.id===st.vehicle))out.push(event);};
 if(includeWindows)for(const project of board.projects){
  if(project.start&&project.due){
   const {start,due:end}=project;
   for(const date of span.days.filter(day=>day>=start&&day<=end))push({type:'project',id:project.id,title:project.title,date});
  }else if(project.start)push({type:'project',id:project.id,title:project.title,date:project.start});
  if(project.due)push({type:'project-due',id:project.id,title:project.title+' · due',date:project.due});
 }
 for(const order of board.orders){
  for(const visit of order.visits)push({...visit,visitId:visit.id,type:'workorder',id:order.id,title:order.title,site:order.site,crew:order.crew});
  if(order.due)push({type:'workorder-due',id:order.id,title:order.title+' · due',date:order.due,crew:order.crew});
 }
 for(const event of board.fleetEvents)push(event);
 for(const row of board.daysOff)push({...row,type:'leave',title:row.person.name+' · Away',crew:[row.person]});
 for(const row of board.appointments)push({...row,type:'appointment',site:row.location});
 return out.sort((a,b)=>a.date.localeCompare(b.date)||String(a.start||'').localeCompare(String(b.start||''))||a.title.localeCompare(b.title));
}
function eventCard(event,brief=false){
 const attrs=eventAttrs(event),tag=attrs?'button':'div',series=crewLabel(event.crew);
 return `<${tag} ${attrs?'type="button" '+attrs:''} data-cal-event-date="${esc(event.date)}" class="bci-cal-event" data-event-kind="${esc(event.type)}">${event.start?`<small>${esc(timeRange(event.start,event.end))}${event.type==='vehicle'&&!event.end?' · finish not set':''}</small>`:''}
 <strong>${esc(event.title)}</strong>${!brief&&series?`<small>${esc(series)}</small>`:''}
 ${!brief&&event.outsidePlan?'<small class="bci-cal-warn">Outside project dates</small>':''}</${tag}>`;
}
function timedDay(day,events,firstHour,lastHour,hasAllDay){
 const untimed=events.filter(row=>!row.start),timed=events.filter(row=>row.start);
 const hours=Array.from({length:lastHour-firstHour},(_,i)=>i+firstHour);
 // Each time block is positioned by clock time. Greedy lanes separate overlapping blocks.
 const lanes=[];
 const placed=timed.map(event=>{
  const start=minutes(event.start),end=event.end?minutes(event.end):start+30;
  let lane=lanes.findIndex(until=>until<=start);
  if(lane<0)lane=lanes.length;
  lanes[lane]=end;
  return {event,start,end,lane};
 });
 return `<section class="bci-cal-timed-day"><h3>${esc(dateText(day))}${day===today()?'<small>Today</small>':''}</h3><div class="bci-cal-all-day ${hasAllDay?'has-items':''}">${untimed.map(event=>eventCard(event,true)).join('')||'<small class="muted">No all-day items</small>'}</div>
 <div class="bci-cal-clock" style="--hours:${hours.length};--lanes:${Math.max(1,lanes.length)}"><div class="bci-cal-hour-marks">${hours.map(h=>`<div>${timeText(String(h).padStart(2,'0')+':00')}</div>`).join('')}</div>
 <div class="bci-cal-hour-slots">${placed.map(({event,start,end,lane})=>`<div class="bci-cal-timed-block" style="--start:${((start-firstHour*60)/60).toFixed(4)};--duration:${Math.max(.42,(end-start)/60).toFixed(4)};--lane:${lane}">${eventCard(event)}</div>`).join('')}</div></div></section>`;
}
function timedView(span,events){
 const timed=events.filter(row=>row.start);
 const first=Math.min(7,...timed.map(row=>Math.floor(minutes(row.start)/60)));
 const last=Math.max(18,...timed.map(row=>Math.ceil((row.end?minutes(row.end):minutes(row.start)+30)/60)));
 const hasAllDay=events.some(event=>!event.start);
 return `<div class="bci-cal-days" data-cal-scroll style="--days:${span.days.length}">${span.days.map(day=>timedDay(day,events.filter(row=>row.date===day),first,last,hasAllDay)).join('')}</div>`;
}
function calendarMonth(st,span,events){
 const dayZero=new Date(span.start+'T00:00:00Z').getUTCDay();
 return `<div class="bci-cal-month" data-cal-scroll><div class="bci-cal-month-grid">
 ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<b class="bci-cal-dow">${day}</b>`).join('')}
 ${'<div class="bci-cal-month-blank"></div>'.repeat(dayZero)}
 ${span.days.map(day=>{
  const rows=events.filter(event=>event.date===day);
  return `<section class="bci-cal-month-cell ${day===today()?'is-today':''}">${toggle('day',day,String(Number(day.slice(-2))),undefined,'bci-cal-date')}
   ${rows.slice(0,3).map(event=>eventCard(event,true)).join('')}
   ${rows.length>3?toggle('day',day,'+'+(rows.length-3)+' more',undefined,'rowlink'):''}</section>`;
 }).join('')}</div></div>`;
}
function quarter(st,span,events){
 const starts=[0,1,2].map(i=>monthShift(span.start,i));
 return `<div class="bci-cal-quarter">${starts.map(month=>{
  const rows=events.filter(event=>event.date.startsWith(month.slice(0,7)));
  const projectIds=new Set(rows.filter(event=>event.type==='project').map(event=>event.id));
  const count=rows.reduce((acc,r)=>{if(r.type!=='project')acc[r.type]=(acc[r.type]||0)+1;return acc;},{});
  return `<section class="panel"><h3>${esc(dateText(month,monthFmt))}</h3><dl>
   <div><dt>Projects in progress</dt><dd>${projectIds.size}</dd></div>
   ${Object.entries(count).map(([type,n])=>`<div><dt>${esc(types[type])}</dt><dd>${n}</dd></div>`).join('')}
   </dl>${toggle('month',month,'Open month',undefined,'secondary small')}</section>`;
 }).join('')}</div>`;
}
const hue=id=>[150,207,35,259,331,173][[...String(id)].reduce((n,c)=>n+c.charCodeAt(0),0)%6];
function combined(board,st,span,events){
 const jobs=events.filter(row=>row.type==='workorder');
 const weekdays=span.days.map((day,i)=>`<div style="grid-column:${i+1}" class="${day===today()?'is-today':''}">${esc(dateText(day,mini))}</div>`).join('');
 const relevant=board.projects.filter(p=>jobs.some(j=>board.orders.find(o=>o.id===j.id)?.projectId===p.id)||(!st.staff&&!st.vehicle&&(!st.type||st.type.startsWith('project'))&&p.start&&p.due&&p.start<=span.end&&p.due>=span.start));
 const ungrouped=jobs.filter(row=>!relevant.some(p=>p.id===board.orders.find(o=>o.id===row.id)?.projectId));
 const row=(project,orders)=>{
  const scheduled=span.days.map((day,i)=>{
   const todays=orders.filter(job=>job.date===day);
   return todays.length?`<div class="bci-cal-combined-bookings" style="grid-column:${i+1}">${todays.map(event=>eventCard(event)).join('')}</div>`:'';
  }).join('');
  const first=project&&span.days.findIndex(d=>d>=project.start&&d<=project.due),ending=project&&span.days.findLastIndex(d=>d>=project.start&&d<=project.due);
  const bar=project&&project.start&&project.due&&first>=0&&ending>=first;
  return `<div class="bci-cal-combined-row" style="--h:${hue(project?.id||'unlinked')}">
   ${project?`<button class="rowlink bci-cal-project-label" data-cal-link="project" data-cal-id="${esc(project.id)}">${esc(project.title)}</button>`:'<strong>Other work-order bookings</strong>'}
   <div class="bci-cal-combined-lane">${bar?`<div class="bci-cal-project-fill" style="grid-column:${first+1}/${ending+2}"></div>`:''}${scheduled}</div>
  </div>`;
 };
 return `<div data-cal-scroll class="bci-cal-combined"><div class="bci-cal-combined-grid" style="--days:${span.days.length}"><div class="bci-cal-combined-head">${weekdays}</div>
  ${relevant.map(p=>row(p,jobs.filter(j=>board.orders.find(o=>o.id===j.id)?.projectId===p.id))).join('')}${ungrouped.length?row(null,ungrouped):''}
  ${!relevant.length&&!ungrouped.length?'<div class="empty">No project plans or booked work in this range.</div>':''}</div></div>`;
}
function crewTimeline(board,st,span,events){
 const crew=board.staff.length?board.staff:[...new Map(events.flatMap(e=>(e.crew||[]).map(p=>[p.email||p.name,p]))).values()];
 const people=crew.filter(p=>!st.staff||(p.email||p.name)===st.staff);
 return `<div data-cal-scroll class="bci-cal-crew"><table><thead><tr><th>Team member</th>${span.days.map(day=>`<th>${esc(dateText(day,mini))}</th>`).join('')}</tr></thead>
 <tbody>${people.map(p=>`<tr><th scope="row">${esc(p.name)}</th>${span.days.map(day=>`<td>${events.filter(e=>e.date===day&&crewMatches(e.crew,p.email||p.name)).map(e=>eventCard(e,true)).join('')||'<small class="muted" title="No internal schedule known; not a guarantee of availability">—</small>'}</td>`).join('')}</tr>`).join('')}</tbody></table>
 ${people.length?'':'<div class="empty">No crew activity in the selected range.</div>'}</div>`;
}
function mineView(span,events){
 return `<div class="bci-cal-mine">${span.days.map(day=>{
  const rows=events.filter(row=>row.date===day&&isMine(row));
  return `<section class="panel"><h2>${esc(dateText(day))}</h2>${rows.map(event=>{
    const partners=crewLabel(caps(event,'others'));
    return `<article data-event-kind="${esc(event.type)}">${event.start?`<p class="bci-cal-report">Report at <strong>${esc(timeText(event.start))}</strong>${event.end?' · until '+esc(timeText(event.end)):''}</p>`:''}
     ${eventCard({...event,crew:[]})}
     ${event.site?`<p><b>Where:</b> ${esc(event.site)}</p>`:''}
     ${event.type==='workorder'?`<p><b>Partner${caps(event,'others').length===1?'':'s'}:</b> ${esc(partners||'Solo')}</p>`:''}</article>`;
   }).join('')||'<p class="muted">No booking or approved time away on this day.</p>'}</section>`;
 }).join('')}</div>`;
}
export function calendarPage(){
 const board=get();
 if(!board)return '<section class="panel"><h1>Calendar</h1><p>Calendar data is unavailable.</p></section>';
 const st=calendarState(),span=frame(st);
 let events=allEvents(board, st.mode==='mine'?{...st,type:'',staff:'',vehicle:''}:st,span,st.mode!=='mine');
 if(st.mode==='projects')events=events.filter(row=>row.type.startsWith('project'));
 if(st.mode==='workorders')events=events.filter(row=>row.type.startsWith('workorder'));
 const activeStaff=board.staff.length?board.staff:[...new Map(allEvents(board,{staff:'',type:'',vehicle:''},span,false).flatMap(event=>(event.crew||[]).map(p=>[p.email||p.name,p]))).values()];
 const layout=st.mode==='mine'?mineView(span,events):st.range==='quarter'?quarter(st,span,events):
  st.mode==='combined'?combined(board,st,span,events):st.mode==='crew'?crewTimeline(board,st,span,events):
  st.range==='month'?calendarMonth(st,span,events):timedView(span,events);
 const headerActions=board.manageAppointments?toggle('appointment','new','+ Appointment',undefined,'primary'):'';
 return head('Calendar','Operations scheduling','All bookings shown in Eastern Time. No external availability or Outlook sync.',headerActions)+`<div class="bci-cal-shell">
 <section class="panel bci-cal-controls">
 <div class="bci-cal-switches" aria-label="Calendar views">${Object.entries(modes).filter(([key])=>!['projects','combined'].includes(key)||can('projects.view')).filter(([key])=>key!=='workorders'||can('workorders.view')).map(([key,label])=>toggle('mode',key,label,key===st.mode)).join('')}</div>
 ${st.mode==='mine'?`<div class="bci-cal-switches" aria-label="My schedule dates">${[['today','Today'],['tomorrow','Tomorrow'],['week','This Week']].map(([key,label])=>toggle('mine',key,label,key===st.mineDays)).join('')}</div>`:
 `<div class="bci-cal-toolbar"><div class="bci-cal-switches" aria-label="Date range">${Object.entries(ranges).map(([key,label])=>toggle('range',key,label,key===st.range)).join('')}</div>
 <div class="bci-cal-switches" aria-label="Calendar dates">${toggle('move','prev','‹ Previous')}${toggle('move','today','Today')}${toggle('move','next','Next ›')}<label class="bci-cal-sr" for="calendarDate">Go to date</label><input id="calendarDate" type="date" min="2000-01-01" max="2100-12-31" value="${esc(st.anchor)}"></div></div>
 <div class="bci-cal-filters">${selects('type','Event type',[['','All events'],...Object.entries(types)],st.type)}${selects('staff','Crew',[['','All crew'],...activeStaff.map(p=>[p.email||p.name,p.name])],st.staff)}${board.vehicles.length?selects('vehicle','Vehicle',[['','All vehicles'],...board.vehicles.map(row=>[row.id,row.name])],st.vehicle):''}</div>`}
 <h2 id="calendar-range-caption">${esc(dateText(span.start))}${span.start===span.end?'':' – '+esc(dateText(span.end))}</h2></section>${layout}</div>`;
}
export function scheduleButton(kind,id){
 if(practiceMode||!get()||kind==='project'&&!can('projects.view')||kind==='workorder'&&!can('workorders.view'))return '';
 return `<button type="button" class="secondary small" data-cal-schedule="${kind}" data-cal-id="${esc(id)}">Schedule</button>`;
}
export function calendarBackButton(){
 if(!back||!['workorders','projects','fleet'].includes(view))return '';
 return toggle('back','1','‹ Back to Calendar',undefined,'secondary small bci-cal-back');
}
export function restoreCalendarScroll(){
 const scroller=document.querySelector('[data-cal-scroll]');
 if(scroller)scroller.scrollLeft=calendarState().gridScroll;
}
function makeDialog(title,body,drawer=true){
 if(activeDialog?.open)activeDialog.close();
 const shell=document.createElement('dialog');
 shell.className='bci-cal-dialog'+(drawer?' bci-cal-drawer':'');
 shell.setAttribute('aria-labelledby','bci-calendar-dialog-heading');
 shell.innerHTML=`<div class="bci-cal-dialog-top"><div><p class="eyebrow">BCI OPERATIONS</p><h2 id="bci-calendar-dialog-heading">${esc(title)}</h2></div><button type="button" class="secondary" data-cal-close aria-label="Close schedule">×</button></div><div class="bci-cal-dialog-body">${body}</div><p class="bci-cal-error" role="alert" hidden></p>`;
 shell.querySelector('[data-cal-close]').onclick=()=>shell.close();
 shell.addEventListener('close',()=>{shell.remove();if(activeDialog===shell)activeDialog=undefined;});
 document.body.append(shell);activeDialog=shell;shell.showModal();
 return shell;
}
function error(shell,reason){
 const out=shell.querySelector('.bci-cal-error');
 out.textContent=reason instanceof Error?reason.message:String(reason);
 out.hidden=false;
}
function bindSave(shell,handler){
 const form=shell.querySelector('form');
 if(!form)return;
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const disabled=[...form.querySelectorAll('button')].filter(button=>!button.disabled);
  disabled.forEach(button=>button.disabled=true);
  shell.querySelector('.bci-cal-error').hidden=true;
  try{await handler(new FormData(form),form);shell.close();}
  catch(e){error(shell,e);}
  finally{disabled.forEach(button=>button.disabled=false);}
 });
}
const actions=(caption,pre='')=>`<div class="bci-cal-form-actions">${pre}<button type="submit" class="primary">${esc(caption)}</button></div>`;
const plannedDates=row=>row.start||row.due?[row.start&&'Start '+row.start,row.due&&'Due '+row.due].filter(Boolean).join(' · '):'No planned dates';
function openProjectSchedule(id){
 const board=get(),record=board?.projects.find(p=>p.id===id);
 if(!record)return;
 const edit=can('project.update');
 const child=board.orders.filter(o=>o.projectId===id);
 const shell=makeDialog('Project schedule',`
  <p class="bci-cal-record">${esc(record.title)}</p><p class="muted">These dates draw the project bar. To reserve a crew, schedule a work order below.</p>
  ${edit?`<form><div class="bci-cal-form-grid">${valueField('start','Planned start',record.start,{type:'date'})}${valueField('due','Due date',record.due,{type:'date'})}</div>${actions('Save project dates')}</form>`:`<p>${esc(plannedDates(record))}</p>`}
  <section class="bci-cal-child-orders"><h3>Schedule a work order</h3>${child.map(row=>`<div><strong>${esc(row.title)}</strong><span>${row.visits.length} booked day${row.visits.length===1?'':'s'}</span>${scheduleButton('workorder',row.id)}</div>`).join('')||'<p class="muted">No work orders visible for this project.</p>'}</section>`);
 bindSave(shell,values=>send('project.schedule',{projectId:id,revision:record.revision,start:values.get('start'),due:values.get('due')}));
}
const crewPicker=(board,selected=[])=>`<fieldset class="bci-cal-crew-picker"><legend>Crew</legend>${board.staff.map(member=>`<label><input type="checkbox" name="crew" value="${esc(member.email)}" ${selected.includes(member.email)?'checked':''}> ${esc(member.name)}</label>`).join('')||'<p class="muted">Add active Team members before assigning crew.</p>'}</fieldset>`;
function savedVisitPanel(record){
 return record.visits.length?`<section class="bci-cal-saved"><h3>Saved bookings</h3><p class="muted">${esc(crewLabel(record.crew))}</p>
 <ul>${record.visits.map(visit=>`<li><div><strong>${esc(dateText(visit.date))}</strong> <span>${esc(timeRange(visit.start,visit.end))}</span>
 ${visit.outsidePlan?'<span class="bci-cal-warn">Outside project dates</span>':''}</div>${toggle('invite',visit.id,'Prepare client invite')}</li>`).join('')}</ul>
 ${record.site?`<p>Site: ${esc(record.site)}</p>`:''}
 ${toggle('export',record.id,'Export schedule (.ics)')}</section>`:'<p class="muted">No booked days yet.</p>';
}
function openWorkSchedule(id){
 const board=get(),record=board?.orders.find(o=>o.id===id);
 if(!record)return;
 const project=board.projects.find(row=>row.id===record.projectId),edit=can('workorder.update');
 const start=record.visits[0]?.date||today(),finish=record.visits.at(-1)?.date||start;
 const shell=makeDialog('Work order schedule',`<p class="bci-cal-record">${esc(record.title)}</p><p class="muted">Book a date and hours for each visit in Eastern Time. The due date is a deadline, not a crew booking.</p>
  ${edit?`<form>${valueField('due','Work order due date',record.due,{type:'date'})}
   <h3>Booking dates</h3><div class="bci-cal-form-grid">${valueField('from','First date',start,{type:'date',required:true})}${valueField('through','Last date',finish,{type:'date',required:true})}</div>
   <div class="bci-cal-row-tools"><button type="button" class="secondary small" data-cal-copy>Copy first day’s hours</button><button type="button" class="secondary small" data-cal-clear>Skip all days</button></div>
   <div data-cal-rows></div>${crewPicker(board,record.crew.map(x=>x.email))}
   <p class="muted">No Microsoft 365 availability is checked. Open slots are unverified.</p>${actions('Save schedule')}</form>`:`<p class="muted">Due: ${esc(record.due||'Not set')}</p>`}${savedVisitPanel(record)}`);
 const form=shell.querySelector('form');
 if(form){
  const container=form.querySelector('[data-cal-rows]'),days=new Map(record.visits.map(v=>[v.date,{...v,use:true}]));
  const remember=()=>{for(const row of container.querySelectorAll('[data-cal-draft]')){
   const date=row.dataset.calDraft;
   days.set(date,{date,use:row.querySelector('[data-use]').checked,start:row.querySelector('[data-start]').value,end:row.querySelector('[data-end]').value});
  }};
  const saveRow=()=>{const dates=daySpan(form.elements.from.value,form.elements.through.value,90);return dates.map(date=>days.get(date)||{date});};
  const checked=()=>[...form.querySelectorAll('[name="crew"]:checked')].map(el=>el.value);
  const applyWarnings=()=>{
   const crew=checked();
   for(const row of container.querySelectorAll('[data-cal-draft]')){
    const date=row.dataset.calDraft, start=row.querySelector('[data-start]').value,end=row.querySelector('[data-end]').value,on=row.querySelector('[data-use]').checked;
    const overlap=on&&start&&end&&[...board.busy.filter(slot=>slot.orderId!==id),...board.appointments.map(slot=>({...slot,crew:slot.crew.map(person=>person.email)}))].some(slot=>slot.date===date&&slot.start<end&&start<slot.end&&slot.crew.some(email=>crew.includes(email)));
    const leave=on&&board.daysOff.some(slot=>slot.date===date&&crew.includes(slot.person.email));
    const outside=on&&(project?.start&&date<project.start||project?.due&&date>project.due);
    row.querySelector('[data-cal-day-warning]').textContent=[overlap&&'Confirmed crew conflict',leave&&'Crew member marked away',outside&&'Outside project dates'].filter(Boolean).join(' · ');
    for(const input of row.querySelectorAll('input[type="time"]')){input.required=on;input.disabled=!on;}
   }
  };
  const redraw=()=>{
   try{container.innerHTML=saveRow().map(({date,use,start,end})=>`<div class="bci-cal-draft-row" data-cal-draft="${date}">
    <label class="bci-cal-book-day"><input type="checkbox" data-use ${use?'checked':''}> Book ${esc(dateText(date))}</label>
    <label>Start<input type="time" data-start value="${esc(start||'')}"></label>
    <label>Finish<input type="time" data-end value="${esc(end||'')}"></label><span class="bci-cal-warn" data-cal-day-warning></span></div>`).join('');
    applyWarnings();shell.querySelector('.bci-cal-error').hidden=true;
   }catch(e){container.replaceChildren();error(shell,e);}
  };
  redraw();
  form.addEventListener('change',event=>{
   if(['from','through'].includes(event.target.name)){remember();redraw();}
   else applyWarnings();
  });
  form.querySelector('[data-cal-copy]').onclick=()=>{
   remember();
   try{
    const rows=saveRow(),first=rows.find(row=>row.use);
    if(!first?.start||!first.end)throw Error('Book a day and enter its start and finish before copying.');
    for(const row of rows)if(row.use)days.set(row.date,{...row,start:first.start,end:first.end});
    redraw();
   }catch(e){error(shell,e);}
  };
  form.querySelector('[data-cal-clear]').onclick=()=>{
   remember();
   for(const row of days.values())row.use=false;
   redraw();
  };
  bindSave(shell,values=>{
   remember();
   const visits=saveRow().filter(row=>row.use).map(({date,start,end})=>({date,start,end}));
   return send('workorder.schedule',{workorderId:id,revision:record.revision,due:values.get('due'),crew:values.getAll('crew'),visits});
  });
 }
 shell.querySelector('[data-cal-export]')?.addEventListener('click',()=>{
  try{
   const blob=new Blob([scheduleIcs(record)],{type:'text/calendar;charset=utf-8'});
   download(blob,(record.title||'BCI-work-order').replace(/[^a-z0-9_-]+/gi,'-').replace(/-+$/,'').slice(0,80)+'-schedule.ics');
  }catch(e){error(shell,e);}
 });
 for(const button of shell.querySelectorAll('[data-cal-invite]'))button.addEventListener('click',()=>{
  const visit=record.visits.find(item=>item.id===button.dataset.calInvite);
  if(visit)openInvite({...visit,location:record.site,title:'BCI service visit'});
 });
}
function download(blob,filename){
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.hidden=true;anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function openAppointment(id){
 const board=get(),current=board?.appointments.find(row=>row.id===id);
 if(!board||(!current&&id!=='new'))return;
 const appointment=current||{},mayEdit=board.manageAppointments;
 const shell=makeDialog(current?'Business appointment':'New business appointment',mayEdit?
  `<form>${valueField('title','Appointment title',appointment.title,{required:true,max:120})}
    <div class="bci-cal-form-grid">${valueField('date','Date',appointment.date||calendarState().anchor,{type:'date',required:true})}${valueField('start','Start (Eastern)',appointment.start,{type:'time',required:true})}${valueField('end','Finish (Eastern)',appointment.end,{type:'time',required:true})}</div>
    ${valueField('location','Location',appointment.location,{max:160})}
    ${crewPicker(board,appointment.crew?.map(p=>p.email))}
    <label class="bci-cal-book-day"><input type="checkbox" name="shared" ${appointment.shared?'checked':''}> Show to people with Dashboard access</label>
    <p class="muted">Leave unchecked for client/private appointments. Administrators and assigned crew can still see them.</p>
    ${actions('Save appointment',current?toggle('remove-appointment','1','Remove appointment'):'' )}</form>`:
  `<p class="bci-cal-record">${esc(appointment.title)}</p><p>${esc(dateText(appointment.date))} · ${esc(timeRange(appointment.start,appointment.end))}</p><p>${esc(appointment.location)}</p>`);
 bindSave(shell,values=>send('calendar.appointment',{id:current?.id,revision:current?.revision||0,...Object.fromEntries(values),crew:values.getAll('crew'),shared:values.has('shared')}));
 shell.querySelector('[data-cal-remove-appointment]')?.addEventListener('click',async event=>{
  const button=event.currentTarget;
  if(button.dataset.confirm!=='yes'){button.dataset.confirm='yes';button.textContent='Confirm remove appointment';return;}
  button.disabled=true;
  try{await send('calendar.appointment',{id:current.id,revision:current.revision,remove:true});shell.close();}
  catch(e){error(shell,e);button.disabled=false;}
 });
 if(current){
  const body=shell.querySelector('.bci-cal-dialog-body');
  body.insertAdjacentHTML('beforeend',`<div class="bci-cal-saved">${toggle('prepare','1','Prepare client invite')}</div>`);
  body.querySelector('[data-cal-prepare]').onclick=()=>openInvite({...current,title:'BCI appointment',location:''});
 }
}
function openInvite(visit){
 const shell=makeDialog('Prepare client invite',`<p class="muted">Nothing is sent by BCI Operations. Review the client-facing invitation here, then finish it in your Outlook account.</p>
  <form>${valueField('title','Meeting title',visit.title,{required:true,max:150})}
   ${valueField('recipient','Client email address (copy to Outlook)',visit.recipient,{type:'email',required:true,max:254})}
   <div class="bci-cal-form-grid">${valueField('date','Date',visit.date,{type:'date',required:true})}${valueField('start','Start',visit.start,{type:'time',required:true})}${valueField('end','Finish',visit.end,{type:'time',required:true})}</div>
   <p class="muted">Time zone: Eastern (America/New_York)</p>
   ${valueField('location','Site address or meeting link',visit.location,{max:250})}
   <label class="bci-cal-field">Client-facing notes <textarea name="notes" rows="4" maxlength="1000"></textarea></label>
   ${actions('Review invite draft')}
  </form><div data-invite-preview></div>`);
 const form=shell.querySelector('form'),preview=shell.querySelector('[data-invite-preview]');
 form.addEventListener('input',()=>{preview.replaceChildren();shell.querySelector('.bci-cal-error').hidden=true;});
 form.addEventListener('submit',event=>{
  event.preventDefault();
  try{
   const info=Object.fromEntries(new FormData(form)),href=outlookCompose(info);
   const copy=[info.title,'Invite: '+info.recipient,dateText(info.date)+' · '+timeRange(info.start,info.end)+' Eastern',info.location,info.notes].filter(Boolean).join('\n');
   preview.innerHTML=`<section class="bci-cal-saved"><h3>Review before opening Outlook</h3><pre>${esc(copy)}</pre>
     <p>In Outlook, add <b>${esc(info.recipient)}</b> as an attendee, make sure the meeting is on your organizer calendar, and then select <b>Send</b>. If Outlook opens a blank draft, use the details above.</p>
     <div class="bci-cal-form-actions"><button type="button" class="secondary small" data-invite-copy>Copy attendee</button><a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="button primary">Open Outlook draft</a></div></section>`;
   preview.querySelector('[data-invite-copy]').onclick=async event=>{
    try{await navigator.clipboard.writeText(info.recipient);event.target.textContent='Attendee copied';}
    catch{error(shell,'Copy the email address shown in the invite preview.');}
   };
   shell.querySelector('.bci-cal-error').hidden=true;
   preview.querySelector('h3').setAttribute('tabindex','-1');
   preview.querySelector('h3').focus();
  }catch(e){error(shell,e);}
 });
}

document.addEventListener('click',event=>{
 const button=event.target.closest('[data-cal-schedule],[data-cal-back],[data-cal-appointment],[data-cal-link],[data-cal-mode],[data-cal-range],[data-cal-mine],[data-cal-move],[data-cal-day],[data-cal-month]');
 if(!button||!get()||practiceMode)return;
 const option=button.dataset,st=calendarState();
 if(option.calSchedule==='project')return openProjectSchedule(option.calId);
 if(option.calSchedule==='workorder')return openWorkSchedule(option.calId);
 if(option.calAppointment)return openAppointment(option.calAppointment);
 if(option.calLink){
  const scroller=document.querySelector('[data-cal-scroll]');
  back={y:w()?.scrollY||0,x:scroller?.scrollLeft||0,focus:option.calLink,id:option.calId,date:option.calEventDate};
  document.dispatchEvent(new CustomEvent('bci:calendar-open',{detail:{kind:option.calLink,id:option.calId}}));
  if(view!=='calendar')w()?.scrollTo(0,0);
  return;
 }
 if(option.calBack&&back){
  const restore=back;back=undefined;st.gridScroll=restore.x;
  document.dispatchEvent(new CustomEvent('bci:calendar-open',{detail:{kind:'calendar'}}));
  w()?.requestAnimationFrame(()=>{restoreCalendarScroll();w()?.scrollTo(0,restore.y);
    [...document.querySelectorAll('[data-cal-link]')].find(el=>el.dataset.calLink===restore.focus&&el.dataset.calId===restore.id&&el.dataset.calEventDate===restore.date)?.focus({preventScroll:true});});
  return;
 }
 if(option.calMode&&Object.hasOwn(modes,option.calMode))st.mode=option.calMode;
 if(option.calRange&&Object.hasOwn(ranges,option.calRange))st.range=option.calRange;
 if(option.calMine)st.mineDays=option.calMine;
 if(option.calDay){st.range='1';st.anchor=option.calDay;}
 if(option.calMonth){st.range='month';st.anchor=option.calMonth;}
 if(option.calMove){
  if(option.calMove==='today')st.anchor=today();
  else {
   const direction=option.calMove==='next'?1:-1;
   st.anchor=['month','quarter'].includes(st.range)?monthShift(st.anchor,direction*(st.range==='quarter'?3:1)):dayShift(st.anchor,direction*Number(st.range));
  }
 }
 st.gridScroll=0;render();
 const key=Object.keys(option)[0];
 [...document.querySelectorAll('.bci-cal-controls button')].find(el=>el.dataset[key]===option[key])?.focus({preventScroll:true});
});
document.addEventListener('change',event=>{
 if(view!=='calendar'||!get())return;
 const el=event.target,st=calendarState();
 if(el.id==='calendarDate'&&el.validity.valid&&el.value){st.anchor=el.value;st.gridScroll=0;render();document.querySelector('#calendarDate')?.focus({preventScroll:true});return;}
 if(['type','staff','vehicle'].includes(el.dataset.calFilter)){
  st[el.dataset.calFilter]=el.value;st.gridScroll=document.querySelector('[data-cal-scroll]')?.scrollLeft||0;render();
  document.querySelector('[data-cal-filter="'+el.dataset.calFilter+'"]')?.focus({preventScroll:true});
 }
});
