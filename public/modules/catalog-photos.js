const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const photoId=item=>{const id=item?.catalogInfo?.photoId;return typeof id==='string'&&/^[0-9a-f]{64}$/.test(id)?id:'';};
export const partMeta=item=>[item?.catalogInfo?.brand,item?.catalogInfo?.mpn].filter(Boolean).join(' · ');
export const partCategory=item=>[item?.catalogInfo?.system,item?.catalogInfo?.partType].filter(Boolean).join(' / ')||'Unclassified';
export const partColorValues=item=>[item?.catalogInfo?.color,item?.catalogInfo?.finishCode]
 .filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim())
 .filter((value,index,array)=>array.findIndex(item=>item.toLowerCase()===value.toLowerCase())===index);
export const partColor=item=>partColorValues(item).join(' / ');
export const partSearch=(item,query)=>{
 const info=item?.catalogInfo||{};
 const text=[item?.name,item?.sku,item?.description,item?.group,info.brand,info.mpn,info.system,info.partType,...partColorValues(item)].join(' ').toLowerCase();
 return String(query||'').trim().toLowerCase().split(/\s+/).filter(Boolean).every(token=>text.includes(token));
};
export function photoThumbnail(item){
 const id=photoId(item);if(!id)return '';
 const name=item.name||partMeta(item)||'Catalog item';
 const family=String(item.catalogInfo.photoStatus||'').toLowerCase().includes('family');
 return `<button type="button" class="bci-photo-thumb" data-bci-photo="${id}" data-bci-photo-name="${h(name)}" data-bci-photo-family="${family?'yes':'no'}" aria-label="Enlarge ${family?'representative ':''}photo for ${h(name)}"><img src="/api/catalog-photo/${id}.jpg" width="54" height="54" alt="" loading="lazy" decoding="async"><span class="bci-photo-missing" hidden>Unavailable</span></button>`;
}
let viewer,activeTrigger;
function getViewer(){
 if(viewer)return viewer;
 const dialog=document.createElement('dialog');dialog.className='bci-photo-viewer';dialog.setAttribute('aria-labelledby','bci-photo-heading');
 dialog.innerHTML='<div class="bci-photo-frame"><div class="bci-photo-title"><h2 id="bci-photo-heading">Part photo</h2><button type="button" class="secondary bci-photo-close" autofocus>Close</button></div><p class="bci-photo-caption" hidden>Manufacturer family photo. Exact variant may differ.</p><div class="bci-photo-stage"><img alt=""><p role="status" hidden>Photo unavailable.</p></div><button type="button" class="secondary bci-photo-zoom" aria-pressed="false">Zoom in</button></div>';
 document.body.append(dialog);
 const stage=dialog.querySelector('.bci-photo-stage'),image=stage.querySelector('img'),message=stage.querySelector('p'),zoom=dialog.querySelector('.bci-photo-zoom');
 const setZoom=on=>{stage.classList.toggle('bci-photo-zoomed',on);stage.scrollTop=stage.scrollLeft=0;zoom.setAttribute('aria-pressed',String(on));zoom.textContent=on?'Zoom out':'Zoom in';};
 zoom.addEventListener('click',()=>setZoom(zoom.getAttribute('aria-pressed')!=='true'));
 image.addEventListener('error',()=>{image.hidden=true;message.hidden=false;zoom.hidden=true;});
 dialog.querySelector('.bci-photo-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{image.removeAttribute('src');if(activeTrigger?.isConnected)activeTrigger.focus({preventScroll:true});});
 viewer={dialog,open(trigger){
  const {bciPhoto:id,bciPhotoName:name,bciPhotoFamily:family}=trigger.dataset;
  if(!/^[0-9a-f]{64}$/.test(id||'')||dialog.open)return;
  activeTrigger=trigger;
  dialog.querySelector('h2').textContent=name;
  dialog.querySelector('.bci-photo-caption').hidden=family!=='yes';
  setZoom(false);image.hidden=false;message.hidden=true;zoom.hidden=false;
  image.alt=family==='yes'?'Representative photo for '+name:name;
  image.src='/api/catalog-photo/'+id+'.jpg';
  dialog.showModal();dialog.querySelector('.bci-photo-close').focus();
 }};
 return viewer;
}
if(typeof document!=='undefined'){
 document.addEventListener('click',event=>{
  const trigger=event.target.closest?.('button[data-bci-photo]');
  if(!trigger)return;
  event.preventDefault();
  getViewer().open(trigger);
 });
 document.addEventListener('error',event=>{
  const image=event.target;
  if(!image?.parentElement?.matches('.bci-photo-thumb'))return;
  image.hidden=true;image.parentElement.querySelector('.bci-photo-missing').hidden=false;
 },true);
}
