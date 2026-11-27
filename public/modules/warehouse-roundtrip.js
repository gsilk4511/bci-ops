import {warehousePurgeAction,warehousePurgeDialog} from './warehouse-purge.js';
import {can,esc,me,practiceMode,reload,show,today} from '../app.js';

const allowed=()=>!practiceMode&&me?.role==='admin'&&can('inventory.view');
const patchLimit=490_000;
const safeCount=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const fields={name:'Name',description:'Description',system:'Category',partType:'Type',color:'Color',serviceCategory:'Material service category',brand:'Brand',price:'Sell price',cost:'Unit cost',stockTarget:'Stock target'};

export function warehouseFiles(){
 if(!allowed())return '';
 return `<section class="panel bci-wh-files" aria-label="Warehouse files">
 <div><h2>Warehouse files</h2><p class="muted">Export a current snapshot of active and archived records to share with your update instructions. Preview a prepared Warehouse update file to add parts, update eligible fields and set stock targets.</p></div>
 <div class="gap"><button class="secondary small" type="button" data-warehouse-export>Export Warehouse &amp; Catalog</button>
 <button class="secondary small" type="button" data-warehouse-patch-open aria-haspopup="dialog">Import Warehouse Updates</button>${warehousePurgeAction()}</div>
 <dialog class="bci-release-dialog bci-wh-patch-dialog" data-warehouse-patch aria-labelledby="bciWhPatchTitle">
  <div class="bci-release-dialog-shell">
   <div class="bci-release-dialog-bar"><h2 id="bciWhPatchTitle">Import Warehouse Updates</h2>
    <button class="secondary small" type="button" data-warehouse-patch-close>Close</button></div>
   <div class="bci-release-dialog-body">
    <p>Choose the update JSON prepared from a recent Warehouse export. The preview lists new parts, updates, stock targets and held rows. Applying does not change on-hand counts, work orders or invoices, or delete parts.</p>
    <form data-warehouse-patch-form><div class="field"><label for="bciWhPatchFile">Warehouse update JSON</label>
     <input type="file" id="bciWhPatchFile" accept=".json,application/json" required></div>
     <button type="submit" class="primary">Preview updates</button></form>
    <p data-warehouse-patch-status role="status"></p><div data-warehouse-patch-output></div>
    <button type="button" class="primary" data-warehouse-patch-apply hidden>Apply updates</button>
   </div>
  </div></dialog>${warehousePurgeDialog()}</section>`;
}

async function download(button){
 if(!allowed()||button.disabled)return;
 button.disabled=true;
 try{
  const response=await fetch('/api/warehouse-export',{cache:'no-store'});
  if(response.status===401||response.status===403)throw Error('Only administrators can export Warehouse.');
  if(!response.ok||!/^application\/json\b/i.test(response.headers.get('content-type')||''))throw Error('Could not download the Warehouse export. Try again.');
  const blob=await response.blob();
  if(!button.isConnected||!allowed())return;
  if(!blob.size)throw Error('The Warehouse export was empty. Try again.');
  const link=document.createElement('a');
  const url=URL.createObjectURL(blob);
  const disposition=response.headers.get('content-disposition')||'';
  link.download=disposition.match(/(?:^|;\s*)filename="?([\w.-]{1,110}\.json)"?(?:;|$)/i)?.[1]||`BCI-Warehouse-${today()}.json`;
  link.href=url;
  document.body.append(link);
  try{link.click();show('Warehouse export is ready. Check Downloads.');}
  finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 }catch(error){if(button.isConnected)show(error.message,true);}
 finally{button.disabled=false;}
}
async function request(action,data){
 const response=await fetch('/api/action',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});
 const body=await response.json().catch(()=>null);
 if(response.status===401||response.status===403)throw Error('Only administrators can import Warehouse updates.');
 if(!response.ok||!body?.ok)throw Error(body?.error||'Warehouse update request failed. Check the file and preview again.');
 return body.result;
}
function previewMarkup(result,patch){
 const conflicts=Array.isArray(result.conflicts)?result.conflicts:[];
 const changes=Array.isArray(result.changes)?result.changes:[];
 const proposed=new Map((patch.items||[]).map(item=>[item.id,item.changes||{}]));
 const previewValue=value=>{
  if(value===''||value==null)return 'Not specified';
  return ['string','number'].includes(typeof value)?String(value):'Not specified';
 };
 const details=(label,rows)=>rows.length?`<details${label==='Conflicts'?' open':''}><summary>${label} (${rows.length})</summary>
  <ul>${rows.join('')}</ul></details>`:'';
 return `<p><b>${safeCount(result.total)} rows checked</b> · ${safeCount(result.added)} to add · ${safeCount(result.updated)} to update · ${safeCount(result.groupsUpdated)} shared targets · ${safeCount(result.unchanged)} unchanged · ${conflicts.length} conflicts.</p>
 ${details('Conflicts',conflicts.map(x=>`<li><b>${esc(x.sku||x.id||'Item')}</b>: ${esc(x.reason||'Review this row')}</li>`))}
 ${details('Held for review (not applied)',(result.held||[]).map(x=>`<li><b>${esc(x.sku)}</b>: ${esc(x.reason)}</li>`))}
 ${details('Shared stock targets',(result.stockGroups||[]).map(g=>`<li><b>${esc(g.label)}</b>: ${esc(previewValue(g.before))} → ${esc(g.target)} across ${esc(g.skus.length)} variants</li>`))}
 ${details('New parts',(result.newItems||[]).map(x=>`<li><b>${esc(x.name)}</b> · ${esc(x.sku)} · ${esc(x.unit)} · ${esc([x.info?.system,x.info?.serviceCategory,x.info?.partType,x.info?.brand,x.info?.color].filter(Boolean).join(' / '))} · Sell: ${esc(previewValue(x.price))}; Cost: ${esc(previewValue(x.cost))}; Change: ${esc(previewValue(x.changePrice))}${x.stockTarget!=null?'; Target: '+esc(x.stockTarget):''}</li>`))}
 ${details('Updated fields',changes.map(x=>{
  const row=proposed.get(x.id)||{};
  const deltas=x.details||{};
  const labels=(Array.isArray(x.fields)?x.fields:[]).map(key=>{
   const label=esc(fields[key]||key), delta=Object.hasOwn(deltas,key)?deltas[key]:null;
   return delta?`<li><b>${label}:</b> <span class="bci-wh-prior muted">${esc(previewValue(delta.before))}</span> → <span class="bci-wh-proposed">${esc(previewValue(delta.after))}</span></li>`:
    `<li><b>${label}:</b> ${esc(previewValue(row[key]))}</li>`;
  });
  return `<li><b>${esc(x.sku||x.id||'Item')}</b><ul>${labels.join('')}</ul></li>`;
 }))}
 ${conflicts.length?'<p>Nothing can be applied until the conflicts are resolved. Export a fresh snapshot if any rows are stale.</p>':(result.updated||result.added||result.groupsUpdated)>0?'<p>Review the preview, then select Apply updates to save these changes.</p>':''}`;
}

function openPatch(dialog,opener){
 if(!allowed()||!dialog||dialog.open)return;
 if(dialog.dataset.wired){dialog.showModal();return;}
 dialog.dataset.wired='true';
 const form=dialog.querySelector('[data-warehouse-patch-form]'), file=dialog.querySelector('input[type=file]'),
  close=dialog.querySelector('[data-warehouse-patch-close]'), preview=form.querySelector('button[type=submit]'),
  status=dialog.querySelector('[data-warehouse-patch-status]'), output=dialog.querySelector('[data-warehouse-patch-output]'),
  apply=dialog.querySelector('[data-warehouse-patch-apply]');
 let patch=null,fingerprint=null,busy=false;
 function clear(){
  patch=null;fingerprint=null;output.replaceChildren();apply.hidden=true;
 }
 function working(value){
  busy=value;preview.disabled=file.disabled=close.disabled=apply.disabled=value;
 }
 close.addEventListener('click',()=>{if(!busy)dialog.close();});
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{
  clear();form.reset();status.textContent='';
  if(opener.isConnected)opener.focus({preventScroll:true});
 });
 file.addEventListener('change',()=>{clear();status.textContent='';});
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!allowed()||busy)return;
  clear();working(true);status.textContent='Checking Warehouse update file…';
  try{
   const selected=file.files[0];
   if(!selected||selected.size>patchLimit)throw Error('Choose a Warehouse update JSON file under 490 KB.');
   let candidate;
   try{candidate=JSON.parse(await selected.text());}catch{throw Error('This file is not valid JSON.');}
   if(!['bci-warehouse-patch-v1','bci-warehouse-updates-v2'].includes(candidate?.format))throw Error('Choose a Warehouse update file, not the original Warehouse export or catalog import.');
   const result=await request('warehouse.patchPreview',{patch:candidate});
   if(!dialog.isConnected||!allowed())return;
   if(!result||!Array.isArray(result.conflicts))throw Error('Could not read the preview. Try again.');
   output.innerHTML=previewMarkup(result,candidate);
   status.textContent='Preview ready. Nothing changed yet.';
   if(typeof result.fingerprint==='string'&&result.fingerprint&&(safeCount(result.updated)+safeCount(result.added)+safeCount(result.groupsUpdated))>0&&!result.conflicts.length){
    patch=candidate;fingerprint=result.fingerprint;apply.hidden=false;
   }
  }catch(error){if(dialog.isConnected)status.textContent=error.message;}
  finally{working(false);}
 });
 apply.addEventListener('click',async()=>{
  if(!allowed()||busy||!patch||!fingerprint)return;
  const pending={patch,fingerprint};
  patch=null;fingerprint=null;apply.hidden=true;
  working(true);status.textContent='Saving matching Warehouse updates…';
  try{
   const result=await request('warehouse.patchApply',pending);
   if(!dialog.isConnected)return;
   working(false);dialog.close();
   try{await reload();show(pending.patch.format==='bci-warehouse-updates-v2'?`Saved ${safeCount(result?.added)} new parts, ${safeCount(result?.updated)} item updates and ${safeCount(result?.groupsUpdated)} shared stock targets.`:`Saved ${safeCount(result?.updated)} Warehouse item updates.`);}
   catch{show('Warehouse updates saved. Refresh the page to see them.',true);}
  }catch(error){if(dialog.isConnected){status.textContent=error.message+' Preview again before retrying.';output.replaceChildren();}}
  finally{working(false);}
 });
 dialog.showModal();
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-warehouse-export],[data-warehouse-patch-open]');
 if(!button||!allowed())return;
 if(button.hasAttribute('data-warehouse-export'))return download(button);
 openPatch(button.closest('.bci-wh-files')?.querySelector('[data-warehouse-patch]'),button);
});
