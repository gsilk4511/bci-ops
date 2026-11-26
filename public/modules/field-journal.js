const sections=[['labor','Time'],['travel','Travel'],['material','Parts']];
const batch=10;

export function isOriginalSubmitter(entry,email){
 // Use the authenticated author set by the server, not the payroll owner or editor.
 return typeof email==='string'&&Boolean(email.trim())&&typeof entry.createdBy==='string'&&
  email.trim().toLowerCase()===entry.createdBy.trim().toLowerCase();
}

export function fieldJournal(entries,email,renderRow,empty){
 const primary=sections.find(([key])=>entries.some(row=>row.type===key))?.[0]||'labor';
 const owned=entries.filter(row=>isOriginalSubmitter(row,email)).length;
 return `<div class="field-journal" data-field-journal>
  <div class="field-journal-controls no-print">
   <div role="group" aria-label="Journal entry ownership" class="field-journal-ownership">
    <button type="button" class="secondary small" data-journal-filter="all" aria-pressed="true">All entries</button>
    <button type="button" class="secondary small" data-journal-filter="mine" aria-pressed="false">My entries <span class="journal-count">${owned}</span></button>
   </div>
   <div role="tablist" aria-label="Journal entry type" class="field-journal-types">
    ${sections.map(([key,label])=>`<button type="button" class="secondary small" role="tab" id="field-journal-tab-${key}" aria-controls="field-journal-panel-${key}" aria-selected="${key===primary}" tabindex="${key===primary?0:-1}" data-journal-tab="${key}">${label} <span class="journal-count" data-journal-count>${entries.filter(row=>row.type===key).length}</span></button>`).join('')}
   </div>
  </div>
  ${sections.map(([key,label])=>{
   const rows=entries.filter(row=>row.type===key);
   return `<div role="tabpanel" tabindex="0" id="field-journal-panel-${key}" aria-labelledby="field-journal-tab-${key}" data-journal-panel="${key}"${key===primary?'':' hidden'}>
    <ul class="field-journal-list" data-journal-rows${rows.length?'':' hidden'}>${rows.map((row,i)=>renderRow(row,isOriginalSubmitter(row,email),i>=batch)).join('')}</ul>
    <div data-journal-empty${rows.length?' hidden':''}>${empty('No '+label.toLowerCase()+' entries to show')}</div>
    <button type="button" class="secondary no-print" data-journal-more${rows.length>batch?'':' hidden'}>Show more${rows.length>batch?' ('+(rows.length-batch)+' remaining)':''}</button>
   </div>`;
  }).join('')}
 </div>`;
}

export function wireFieldJournal(region){
 const tabs=[...region.querySelectorAll('[data-journal-tab]')];
 const panels=[...region.querySelectorAll('[data-journal-panel]')];
 const filters=[...region.querySelectorAll('[data-journal-filter]')];
 let tab=tabs.find(button=>button.getAttribute('aria-selected')==='true').dataset.journalTab,mine=false;
 const limits=new Map();
 function refresh(){
  for(const filter of filters)filter.setAttribute('aria-pressed',String((filter.dataset.journalFilter==='mine')===mine));
  for(const button of tabs){
   const key=button.dataset.journalTab,active=key===tab;
   button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
   const panel=panels.find(item=>item.dataset.journalPanel===key);
   panel.hidden=!active;
   const limit=limits.get(key)||batch;
   let count=0;
   for(const row of panel.querySelectorAll('[data-journal-owned]')){
    const matches=!mine||row.dataset.journalOwned==='true';
    if(matches)count++;
    row.hidden=!matches||count>limit;
   }
   panel.querySelector('[data-journal-rows]').hidden=count===0;
   panel.querySelector('[data-journal-empty]').hidden=count>0;
   const more=panel.querySelector('[data-journal-more]');
   more.hidden=count<=limit;
   if(!more.hidden)more.textContent=`Show more (${count-limit} remaining)`;
   button.querySelector('[data-journal-count]').textContent=String(count);
  }
 }
 region.addEventListener('click',event=>{
  const filter=event.target.closest('[data-journal-filter]');
  const tabButton=event.target.closest('[data-journal-tab]');
  const more=event.target.closest('[data-journal-more]');
  if(filter){mine=filter.dataset.journalFilter==='mine';limits.clear();}
  else if(tabButton)tab=tabButton.dataset.journalTab;
  else if(more)limits.set(tab,(limits.get(tab)||batch)+batch);
  else return;
  refresh();
  if(more&&more.hidden)more.closest('[data-journal-panel]').focus();
 });
 region.addEventListener('keydown',event=>{
  const current=tabs.indexOf(event.target);
  const i=event.key==='Home'?0:event.key==='End'?tabs.length-1:
   event.key==='ArrowLeft'?(current+tabs.length-1)%tabs.length:
   event.key==='ArrowRight'?(current+1)%tabs.length:-1;
  if(current<0||i<0)return;
  event.preventDefault();tab=tabs[i].dataset.journalTab;refresh();tabs[i].focus();
 });
}
