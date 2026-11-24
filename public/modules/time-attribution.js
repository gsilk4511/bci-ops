import {data,me,f,modal,esc,table,send,show} from '../app.js';
export function openTimeAttribution(){
 if(me?.role!=='admin')return;
 const active=Object.entries(data.teamAccess||{}).filter(([_,record])=>record.role&&!record.protectedAdmin).map(([email])=>{
  const row=(data.users||[]).find(user=>user.email.toLowerCase()===email.toLowerCase());
  return [email,(row?.name?row.name+' · ':'')+email];
 });
 const fields=f('mode','Legacy value type',{select:[['label','Exact historical name (no linked email)'],['email','Exact legacy email']],required:true})+
  f('source','Exact value as shown in Payroll',{required:true,placeholder:'Example: Simon'})+
  f('target','Active destination employee',{select:[['','Select…'],...active],required:true})+
  '<div class="filters">'+f('start','From (optional)',{type:'date'})+f('end','Through (optional)',{type:'date'})+'</div>'+
  f('rowId','Exact row ID (optional)')+'<button class="secondary" type="button" data-preview-attribution>Preview without changing anything</button><div data-attribution-result aria-live="polite"></div>'+
  f('reason','Correction reason',{textarea:true})+f('confirmation','Confirmation phrase');
 let reviewed;
 modal('Reconcile employee time',fields,async values=>{
  if(!reviewed||JSON.stringify(readSelection())!==reviewed.selection)throw Error('Review the exact current selection first');
  if(!String(values.reason||'').trim()||values.confirmation!=='REASSIGN '+reviewed.result.matches)
   throw Error('Enter a reason and type REASSIGN followed by the preview count');
  const receipt=await send('timeAttribution.apply',{...readSelection(),fingerprint:reviewed.result.fingerprint,confirmation:values.confirmation,reason:values.reason});
  show('Reassigned '+receipt.updated+' time rows. Run Payroll Review again before locking the period.');
 },'<p>Use only a legacy name or email you know belongs to this employee. This reassigns employee time only, not logins, staff profiles, payroll approvals, or invoice records. Review before locking payroll.</p>');
 const form=document.querySelector('#actionForm'), output=form.querySelector('[data-attribution-result]'), submit=form.querySelector('[type=submit]');
 submit.textContent='Apply reviewed attribution';
 submit.disabled=true;
 function readSelection(){return Object.fromEntries(['mode','source','target','start','end','rowId'].map(field=>[field,form.elements[field].value]));}
 form.addEventListener('input',event=>{
  if(['reason','confirmation'].includes(event.target.name))return;
  reviewed=null;output.textContent='';submit.disabled=true;
 });
 form.querySelector('[data-preview-attribution]').onclick=async event=>{
  if(!form.reportValidity())return;
  const button=event.currentTarget;
  submit.disabled=true;button.disabled=true;reviewed=null;
  const payload=readSelection(),selection=JSON.stringify(payload);
  try{
   const res=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'timeAttribution.preview',data:payload})});
   const {result,error}=await res.json();
   if(!res.ok)throw Error(error||'Preview failed');
   if(JSON.stringify(readSelection())!==selection)return;
   const okay=result.matches&&!result.issues.length&&!result.truncated;
   output.innerHTML=`<p><b>${result.matches} rows · ${Number(result.hours).toFixed(2)} hours</b> → ${esc(result.name)} (${esc(result.destination)}).</p>
   ${result.locked?`<p class="warn">${result.locked} rows fall in approved periods. This updates current attribution only; any finalized payroll export remains unchanged.</p>`:''}
   ${result.issues.map(issue=>'<p class="warn">'+esc(issue)+'</p>').join('')}
   ${result.truncated?'<p class="warn">More than 200 rows; choose dates or a specific row, then preview again.</p>':''}
   ${result.rows.length?table(['Date / time','Current label / email','Work order','Type','Hours','Row ID'],result.rows.map(row=>`<tr><td>${esc(row.date)}<br>${esc([row.startTime,row.endTime].filter(Boolean).join(' – '))}</td><td>${esc(row.employee)}<br>${esc(row.email||'Unlinked')}</td><td>${esc(row.job||row.location)}</td><td>${esc(row.type)}</td><td>${Number(row.hours).toFixed(2)}</td><td>${esc(row.id)}</td></tr>`)):''}
   ${okay?`<p>Review each listed row; type <b>REASSIGN ${result.matches}</b> when ready.</p>`:''}`;
   if(okay){reviewed={result,selection};submit.disabled=false;}
  }catch(error){output.textContent=error.message;}
  finally{button.disabled=false;}
 };
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-time-attribution]'))openTimeAttribution();
});
