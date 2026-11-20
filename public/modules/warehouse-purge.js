import {can,esc,me,practiceMode,reload,show} from '../app.js';

const allowed=()=>!practiceMode&&me?.role==='admin'&&can('inventory.view');
const count=v=>Number.isSafeInteger(v)&&v>=0;
const words=n=>Number(n).toLocaleString();
const expected=preview=>'DELETE '+preview.eligible;
export function validatedPurgePreview(value){
 if(!value||typeof value.batch!=='string'||!value.batch||!['manifestCount','eligible','protected','missing','drift'].every(key=>count(value[key]))||
  typeof value.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(value.fingerprint))throw Error('Could not verify the deletion preview. No records were changed.');
 return Object.freeze({...value});
}
export function warehousePurgePayload(preview,confirmation,backupConfirmed){
 if(!preview||preview.eligible===0||preview.drift!==0||confirmation!==expected(preview)||backupConfirmed!==true)return null;
 return {fingerprint:preview.fingerprint,confirmation,backupConfirmed:true};
}
const reasonLabel={
 'missing-id':'Missing from this database','identity-mismatch':'Original catalog identity changed','stock-row':'Existing stock record',
 'historical-or-live-reference':'Referenced by another record (such as an estimate or work order)','pricing-reference':'Linked to pricing',
 'catalog-reference':'Referenced by another catalog item','catalog-pricing':'Has catalog pricing','other-archive-state':'Archived for another reason'
};
function previewMarkup(p){
 const explanations=p.reasonCounts&&typeof p.reasonCounts==='object'?Object.entries(p.reasonCounts).filter(([,amount])=>count(amount)&&amount>0):[];
 return '<p><b>Imported batch:</b> '+esc(p.batch)+' · '+words(p.manifestCount)+' part records in its manifest.</p>'+
  '<ul><li><b>'+words(p.eligible)+' eligible for permanent deletion</b></li><li>'+words(p.protected)+' protected; these will stay</li><li>'+
  words(p.missing)+' already absent</li><li>'+words(p.drift)+' batch records missing or changed</li></ul>'+
  (explanations.length?'<details><summary>Why records are protected</summary><ul>'+explanations.map(([reason,amount])=>
   '<li>'+esc(Object.hasOwn(reasonLabel,reason)?reasonLabel[reason]:reason.replaceAll(/[-_]/g,' '))+': '+words(amount)+'</li>').join('')+'</ul></details>':'')+
  (p.drift?'<p><b>Deletion blocked.</b> At least one part is missing or no longer matches the original batch. Check with the person managing the catalog.</p>':
   p.eligible===0?'<p>No eligible parts remain in this batch. Nothing to delete.</p>':
   '<p>Only the eligible parts in this exact preview can be deleted. Protected parts and other batches are not included.</p>');
}
export function warehousePurgeAction(){
 return allowed()?'<button class="danger small" type="button" data-warehouse-purge-open aria-haspopup="dialog">Delete Imported Parts</button>':'';
}
export function warehousePurgeDialog(){
 if(!allowed())return '';
 return `<dialog class="bci-release-dialog" data-warehouse-purge aria-labelledby="bciWhPurgeTitle">
 <div class="bci-release-dialog-shell">
  <div class="bci-release-dialog-bar"><h2 id="bciWhPurgeTitle">Delete Imported Parts</h2><button class="secondary small" type="button" data-warehouse-purge-close>Close</button></div>
  <div class="bci-release-dialog-body">
   <p><b>Permanent deletion.</b> This is not an archive or an undoable removal. Only the one identified import batch is checked. Review a fresh preview and verify that you have a restorable database backup before proceeding.</p>
   <button class="secondary" type="button" data-warehouse-purge-preview>Preview deletion</button>
   <p data-warehouse-purge-status role="status" aria-live="polite"></p><div data-warehouse-purge-output></div>
   <fieldset data-warehouse-purge-confirm hidden><legend>Confirm permanent deletion</legend>
    <label class="signature-terms"><input data-warehouse-purge-backup type="checkbox"> I verified that I have a restorable database backup.</label>
    <div class="field"><label for="bciWhPurgePhrase">Type <b data-warehouse-purge-phrase></b> exactly</label>
     <input id="bciWhPurgePhrase" data-warehouse-purge-text autocomplete="off" spellcheck="false"></div>
    <button class="danger" type="button" data-warehouse-purge-apply disabled>Permanently Delete Imported Parts</button>
   </fieldset>
  </div>
 </div></dialog>`;
}
async function post(action,data){
 const response=await fetch('/api/action',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});
 const body=await response.json().catch(()=>null);
 if(response.status===401||response.status===403)throw Error('Administrator access is required.');
 if(!response.ok||!body?.ok)throw Error(body?.error||'The Warehouse request could not be verified.');
 return body.result;
}
function openPurge(dialog,opener){
 if(!allowed()||!dialog||dialog.open)return;
 if(dialog.dataset.wired){dialog.showModal();return;}
 dialog.dataset.wired='true';
 const pick=key=>dialog.querySelector(`[data-warehouse-purge-${key}]`);
 const close=pick('close'), preview=pick('preview'), status=pick('status'), output=pick('output'),
  confirm=pick('confirm'), backup=pick('backup'), input=pick('text'), phrase=pick('phrase'), apply=pick('apply');
 let reviewed=null,busy=false;
 const update=()=>{apply.disabled=busy||!warehousePurgePayload(reviewed,input.value,backup.checked);};
 const working=value=>{
  busy=value;preview.disabled=close.disabled=backup.disabled=input.disabled=value;update();
 };
 const clear=()=>{reviewed=null;backup.checked=false;input.value='';confirm.hidden=true;output.replaceChildren();update();};
 close.addEventListener('click',()=>{if(!busy)dialog.close();});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{
  clear();status.textContent='';
  if(opener.isConnected)opener.focus({preventScroll:true});
 });
 backup.addEventListener('change',update);
 input.addEventListener('input',update);
 preview.addEventListener('click',async()=>{
  if(busy||!allowed())return;
  clear();working(true);status.textContent='Checking imported parts and related records…';
  try{
   const result=validatedPurgePreview(await post('warehouse.purgePreview',{}));
   if(!dialog.isConnected||!allowed())return;
   reviewed=result;output.innerHTML=previewMarkup(result);status.textContent='Preview ready. Nothing was deleted.';
   confirm.hidden=!result.eligible||result.drift!==0;
   if(!confirm.hidden)phrase.textContent=expected(result);
  }catch(error){if(dialog.isConnected)status.textContent=error.message;}
  finally{working(false);}
 });
 apply.addEventListener('click',async()=>{
  const pending=warehousePurgePayload(reviewed,input.value,backup.checked);
  if(busy||!allowed()||!pending)return;
  clear();working(true);status.textContent='Applying the reviewed permanent deletion…';
  try{
   const result=await post('warehouse.purgeApply',pending);
   if(!count(result?.deleted))throw Error('Could not verify the deletion result.');
   if(!dialog.isConnected)return;
   dialog.close();
   const message=result.deleted?words(result.deleted)+' imported parts permanently deleted; '+words(result.protected)+' protected parts kept.':'No parts were deleted.';
   try{await reload();show(message);}
   catch{show(message+' Refresh Warehouse to verify the list.',true);}
  }catch(error){if(dialog.isConnected)status.textContent=error.message+' Run a new preview before trying again.';}
  finally{working(false);}
 });
 dialog.showModal();
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-warehouse-purge-open]');
 if(!button||!allowed())return;
 openPurge(button.closest('.bci-wh-files')?.querySelector('[data-warehouse-purge]'),button);
});
