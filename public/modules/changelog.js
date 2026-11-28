import {esc,head,me,practiceMode} from '../app.js';

const allowed=()=>!practiceMode&&me?.role==='admin';
const validText=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const validRelease=release=>Boolean(release&&validText(release.version,80)&&validText(release.title,200)&&
 validText(release.summary,1500)&&Array.isArray(release.sections)&&release.sections.length<=40&&
 release.sections.every(section=>section&&validText(section.title,200)&&Array.isArray(section.items)&&
  section.items.length<=100&&section.items.every(item=>validText(item,2500))));
const versionText=version=>/^\d/.test(version)?'v'+version:version;
const dateText=r=>typeof r.releaseDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate)?r.releaseDate:'Date not recorded';
const minutesFor=r=>Number.isInteger(r.developmentMinutes)&&r.developmentMinutes>=0 ? r.developmentMinutes :
 Number.isFinite(r.developmentHours)&&r.developmentHours>=0 ? Math.round(r.developmentHours*60) : null;
const formatTime=minutes=>{const h=Math.floor(minutes/60),m=minutes%60;return [h?`${h} h`:'',m?`${m} m`:''].filter(Boolean).join(' ')||'0 m';};
const hoursText=r=>minutesFor(r)===null?'Not recorded':formatTime(minutesFor(r));
const ownerTimeTitle='Modeled hands-on time for idea research, prompting, review and rollout. Not a stopwatch record.';

export function changelogPage(){
 if(!allowed())return '';
 return head('Changelog','Admin','Browse BCI Operations releases, including earlier staging and test builds. Dates show when builds were shared, in Eastern time, not when they went live.')+`
 <section class="bci-changelog" data-changelog aria-label="Release history">
  <p class="muted" data-changelog-status role="status">Loading release history…</p>
  <p class="muted" data-changelog-hours aria-live="polite"></p>
  <div data-changelog-cards></div>
  <dialog class="bci-release-dialog" aria-labelledby="bciReleaseTitle">
   <div class="bci-release-dialog-shell">
    <div class="bci-release-dialog-bar"><button type="button" class="secondary small" data-changelog-back>← Back to releases</button>
     <button type="button" class="secondary small" data-changelog-close>Close</button></div>
    <div class="bci-release-dialog-body" data-changelog-detail></div>
   </div>
  </dialog>
 </section>`;
}

export function wireChangelog(root){
 if(!allowed()||!root)return;
 const cards=root.querySelector('[data-changelog-cards]'), status=root.querySelector('[data-changelog-status]');
 const dialog=root.querySelector('dialog'), detail=root.querySelector('[data-changelog-detail]');
 if(!cards||!status||!dialog||!detail)return;
 let releases=[], opener=null, loading=false;
 const back=root.querySelector('[data-changelog-back]'), close=root.querySelector('[data-changelog-close]');
 back.addEventListener('click',()=>dialog.close());
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  detail.replaceChildren();
  if(opener?.isConnected)opener.focus({preventScroll:true});
  opener=null;
 });
 root.addEventListener('click',event=>{
  if(!allowed())return;
  const retry=event.target.closest?.('[data-changelog-retry]');
  if(retry){load(true);return;}
  const button=event.target.closest?.('button[data-changelog-release]');
  if(!button||dialog.open)return;
  const release=releases[Number(button.dataset.changelogRelease)];
  if(!release)return;
  opener=button;
  detail.innerHTML=`<div class="eyebrow">${esc(versionText(release.version))} · ${esc(dateText(release))}</div>
    <aside aria-label="Hours worked" class="panel"><b>Hours worked</b><p>${esc(hoursText(release))}</p></aside>
    <h2 id="bciReleaseTitle" tabindex="-1">${esc(release.title)}</h2><p class="bci-release-intro">${esc(release.summary)}</p>
    ${release.sections.map(section=>`<section class="bci-release-note"><h3>${esc(section.title)}</h3><ul>${section.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section>`).join('')}`;
  dialog.showModal();
  detail.scrollTop=0;
  detail.querySelector('h2').focus({preventScroll:true});
 });
 async function load(retry=false){
  if(loading||!allowed())return;
  loading=true;
  cards.replaceChildren();
  status.textContent='Loading release history…';
  try{
   const response=await fetch('/api/changelog',{cache:'no-store'});
   if(!root.isConnected||!allowed())return;
   if(response.status===401||response.status===403){
    status.textContent='Changelog is available to administrators only.';return;
   }
   if(!response.ok)throw Error('Release history unavailable');
   const result=await response.json();
   if(!root.isConnected||!allowed())return;
   if(!Array.isArray(result?.releases)||result.releases.length>250||!result.releases.every(validRelease))throw Error('Invalid release notes');
   releases=result.releases;
   const hours=root.querySelector('[data-changelog-hours]');
   if(hours){
    const recorded=releases.map(minutesFor).filter(n=>n!==null);
    hours.textContent='Running total /developmentTime = '+(recorded.length?formatTime(recorded.reduce((n,m)=>n+m,0)):'Not recorded');
    hours.title=ownerTimeTitle+(recorded.length!==releases.length?' Only releases with time entries count toward the total.':'');
   }
   status.textContent=releases.length?'':'No release notes are available yet.';
   if(releases.length){
    cards.innerHTML=`<ol class="bci-release-cards">${releases.map((release,index)=>`<li class="card bci-release-card">
      <div class="bci-release-card-top"><span class="tag">${esc(versionText(release.version))}</span> <span class="muted tiny">${esc(dateText(release))} · <span data-changelog-card-time title="${ownerTimeTitle}" aria-label="Hours worked: ${esc(hoursText(release))}">${esc(hoursText(release))}</span></span>${index===0?'<span class="status approved">Latest</span>':''}</div>
      <h2>${esc(release.title)}</h2><p>${esc(release.summary)}</p>
      <button type="button" class="secondary" data-changelog-release="${index}" aria-haspopup="dialog" aria-label="Read more about ${esc(versionText(release.version))}">Read more</button></li>`).join('')}</ol>`;
    if(retry)cards.querySelector('button[data-changelog-release]')?.focus();
   }
  }catch{
   if(!root.isConnected||!allowed())return;
   status.textContent='Could not load release history.';
   cards.innerHTML='<button type="button" class="secondary" data-changelog-retry>Try again</button>';
   if(retry)cards.querySelector('[data-changelog-retry]')?.focus();
  }finally{loading=false;}
 }
 return load();
}
