import {esc} from '../app.js';
import {profileTheme,profileIcon,studioFields,styleFromValues,bindStudio} from './profile-studio.js';

export const maxSocialLinks=6;
export const maxPhotoBytes=240*1024;
const initials=name=>String(name||'Team member').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
export function safeProfileLink(value){
 try{
  const url=new URL(String(value||''));
  return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.includes('.')&&!url.port&&url.href.length<=512?url.href:'';
 }catch{return '';}
}
function safePhotoUrl(value){
 // Never load a remote image from a profile. Only the authenticated avatar route.
 const url=String(value||'');
 return /^\/api\/[a-zA-Z0-9/_-]+(?:\?[a-zA-Z0-9_=&%-]+)?$/.test(url)?url:'';
}
function profileIdentity(profile,name,previewPhoto=''){
 const photo=previewPhoto||safePhotoUrl(profile.avatarUrl);
 return `<div class="bci-profile-ring"><div class="bci-staff-avatar">${photo?`<img src="${esc(photo)}" alt="" width="72" height="72" decoding="async">`:`<span aria-hidden="true">${esc(initials(name))}</span>`}</div></div>`;
}
export function profileCard(profile,{preview=false,previewPhoto='',directoryId=''}={}){
 const name=profile.displayName||profile.name||'Team member';
 const links=(Array.isArray(profile.socialLinks)?profile.socialLinks:[]).slice(0,maxSocialLinks)
  .map(link=>[safeProfileLink(link?.url),String(link?.label||'Social profile')]).filter(([url])=>url);
 const identity=profileIdentity(profile,name,previewPhoto);
 const avatar=directoryId?`<button type="button" class="secondary bci-directory-open" data-staff-action="directory-open" data-staff-id="${esc(directoryId)}" aria-label="Open full profile: ${esc(name)}">${identity}</button>`:identity;
 return profileTheme(profile.style,`<div class="bci-profile-identity">${avatar}
  <div><h3>${esc(name)}</h3>${profileIcon(profile.style)}</div></div>
  <div class="bci-profile-about"><h4>About</h4><p class="bci-staff-bio">${esc(profile.bio||'No introduction added yet.')}</p>
  ${links.length?`<ul class="bci-staff-social" aria-label="Social links">${links.map(([url,label])=>`<li>${preview?esc(label):`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`}</li>`).join('')}</ul>`:''}</div>`,preview?'preview':'');
}
export function directoryProfile(peer,open=false){
 const shared={displayName:peer.displayName,bio:peer.bio,avatarUrl:peer.avatarUrl,socialLinks:peer.socialLinks,style:peer.style};
 return `<details class="bci-profile-disclosure" data-directory-id="${esc(peer.id)}"${open?' open':''}><summary>
  ${profileIcon(shared.style,false)}<span>${esc(shared.displayName||'Team member')}</span><span class="bci-profile-open-label" aria-hidden="true">View profile</span>
  </summary>${profileCard(shared,{directoryId:peer.id})}</details>`;
}
export function personalProfileFields(row){
 const links=Array.isArray(row.socialLinks)?row.socialLinks:[];
 return `<p>Your display name, photo, about, social links and appearance can be seen by signed-in coworkers. Social links are optional.</p>
 ${studioFields(row.style,profileCard(row,{preview:true}))}
 <details class="bci-profile-editor-details"><summary>Profile details, photo and social links</summary>
 <div class="field"><label for="staffDisplayName">Display name</label><input id="staffDisplayName" name="displayName" maxlength="100" required value="${esc(row.displayName||row.name||'')}"></div>
 <div class="field"><label for="staffBio">About me</label><textarea id="staffBio" name="bio" maxlength="1200" rows="4">${esc(row.bio||'')}</textarea></div>
 <div class="field"><label for="staffAvatar">New profile photo</label><input id="staffAvatar" type="file" name="avatarFile" accept="image/jpeg,image/png" aria-describedby="staffPhotoHint"><small id="staffPhotoHint">JPEG or PNG. Resized before saving.</small></div>
 ${row.avatarUrl?'<label><input type="checkbox" name="removeAvatar"> Remove my current photo</label>':''}
 <fieldset class="bci-staff-links-form"><legend>Social links</legend>
 ${Array.from({length:maxSocialLinks},(_,i)=>`<div><div class="field"><label for="staffSocialLabel${i}">Link ${i+1} label</label><input id="staffSocialLabel${i}" name="socialLabel${i}" maxlength="40" value="${esc(links[i]?.label||'')}"></div>
 <div class="field"><label for="staffSocialUrl${i}">Link ${i+1} HTTPS address</label><input id="staffSocialUrl${i}" name="socialUrl${i}" type="url" maxlength="512" placeholder="https://" value="${esc(links[i]?.url||'')}"></div></div>`).join('')}
 </fieldset></details>
 <p class="bci-profile-sr" role="status" id="profileStudioStatus"></p>`;
}
async function photoToBase64(file){
 if(!['image/jpeg','image/png'].includes(file.type)||file.size>15*1024*1024)throw Error('Choose a JPEG or PNG photo under 15 MB.');
 let bitmap;
 try{
  bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas');
  const side=Math.min(bitmap.width,bitmap.height), out=Math.min(side,400);
  if(!side)throw Error('This file does not contain a valid photo.');
  canvas.width=canvas.height=out;
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,out,out);
  ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,out,out);
  for(const quality of [.86,.7,.52]){
   const url=canvas.toDataURL('image/jpeg',quality);
   if(url.startsWith('data:image/jpeg;base64,')){
    const payload=url.split(',')[1];
    if(payload.length*3/4<=maxPhotoBytes)return payload;
   }
  }
 }catch{throw Error('Could not read this photo. Try another JPEG or PNG.');}
 finally{bitmap?.close();}
 throw Error('Could not resize this photo. Try a smaller image.');
}
export async function personalProfilePayload(values){
 const socialLinks=[];
 for(let i=0;i<maxSocialLinks;i++){
  const input=String(values['socialUrl'+i]||'').trim(), label=String(values['socialLabel'+i]||'').trim();
  if(!input&&!label)continue;
  const url=safeProfileLink(input);
  if(!url||!label)throw Error('Each social link needs a label and a valid HTTPS address.');
  socialLinks.push({label,url});
 }
 const payload={displayName:values.displayName,bio:values.bio,socialLinks,style:styleFromValues(values)};
 if(values.removeAvatar&&values.avatarFile?.size)throw Error('Choose a replacement photo or remove the current one, not both.');
 if(values.removeAvatar)payload.avatarBase64='';
 if(values.avatarFile?.size)payload.avatarBase64=await photoToBase64(values.avatarFile);
 return payload;
}

export function bindProfileEditor(form,row){
 if(!form)return;
 const target=form.querySelector('#bciProfilePreview'), status=form.querySelector('#profileStudioStatus');
 if(!target)return;
 let previewPhoto='',currentFile=null,requestId=0;
 function refresh(){
  const values=Object.fromEntries(new FormData(form));
  const socialLinks=Array.from({length:maxSocialLinks},(_,i)=>({label:values['socialLabel'+i],url:values['socialUrl'+i]}));
  target.innerHTML=profileCard({...row,displayName:values.displayName||'Team member',bio:values.bio||'',socialLinks,
   avatarUrl:values.removeAvatar?'':row.avatarUrl,style:styleFromValues(values)},{preview:true,previewPhoto:values.removeAvatar?'':previewPhoto});
 }
 bindStudio(form,refresh,status);
 form.addEventListener('invalid',event=>{
  const details=event.target.closest('details');
  if(details)details.open=true;
 },true);
 form.addEventListener('input',event=>{
  if(event.target.name!=='avatarFile')refresh();
 });
 form.addEventListener('change',async event=>{
  if(event.target.name!=='avatarFile')return;
  const file=event.target.files?.[0]||null;
  if(file===currentFile)return;
  currentFile=file;
  const request=++requestId;
  previewPhoto='';refresh();
  if(!file)return;
  try{
   const result=await photoToBase64(file);
   if(request===requestId&&form.isConnected){previewPhoto='data:image/jpeg;base64,'+result;refresh();status.textContent='Photo preview updated.';}
  }catch(error){if(request===requestId&&form.isConnected)status.textContent=error.message;}
 });
 form.elements.namedItem('profileStyle-ring')?.focus();
}
