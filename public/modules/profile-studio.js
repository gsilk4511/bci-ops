import {esc} from '../app.js';
import {profileStyleOptions,defaultProfileStyle,normalizeProfileStyle,findProfileStyleOption} from './profile-style-catalog.js';

export const styleFields=Object.freeze({ring:'Avatar ring',lighting:'Profile lighting',banner:'Banner',section:'Section color',text:'Text color',icon:'Technician icon'});
const attr=value=>esc(value);
const props=style=>{
 const clean=normalizeProfileStyle(style);
 const get=key=>findProfileStyleOption(key,clean[key]);
 const ring=get('ring'),lighting=get('lighting'),banner=get('banner'),section=get('section'),text=get('text');
 return attr([
  ['--profile-ring',ring.background],['--profile-light',lighting.gradient],
  ['--profile-glow',lighting.glow],['--profile-banner',banner.background],['--profile-surface',section.background],
  ['--profile-border',section.border],['--profile-text',text.color],['--profile-muted',text.muted]
 ].map(([key,value])=>key+':'+value).join(';'));
};
export function profileIcon(style,label=true){
 const option=findProfileStyleOption('icon',normalizeProfileStyle(style).icon);
 return `<span class="bci-profile-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${attr(option.path)}" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>${label?`<span>${esc(option.label)}</span>`:''}</span>`;
}
export function profileTheme(style,content,kind=''){
 return `<div class="bci-profile-theme${kind==='preview'?' bci-profile-preview':''}" style="${props(style)}">
 <div class="bci-profile-arrival" aria-hidden="true"></div><div class="bci-profile-banner" aria-hidden="true"></div>
 <div class="bci-profile-body">${content}</div></div>`;
}
export function studioFields(style,preview){
 const selected=normalizeProfileStyle(style);
 return `<section class="bci-profile-studio" aria-labelledby="profileStudioTitle">
 <div class="bci-profile-studio-head"><div><h3 id="profileStudioTitle">Appearance</h3><p>Mix and match 20 presets in each category. Changes show below before you save.</p></div>
 <button type="button" class="secondary" data-profile-style-reset>Reset appearance</button></div>
 <div class="bci-profile-studio-layout"><div class="bci-profile-studio-grid">${Object.entries(styleFields).map(([key,title])=>
  `<div class="field"><label for="profileStyle-${key}">${esc(title)}</label><select id="profileStyle-${key}" name="profileStyle-${key}" data-profile-style>
  ${profileStyleOptions[key].map(option=>`<option value="${attr(option.id)}"${option.id===selected[key]?' selected':''}>${esc(option.label)}</option>`).join('')}</select></div>`).join('')}</div>
 <div><p class="bci-profile-preview-label">Preview</p><div id="bciProfilePreview">${preview}</div></div></div>
 <p class="bci-profile-editor-hint">Your icon can appear beside your verified technician entries on work orders.</p></section>`;
}
export function styleFromValues(values){
 return normalizeProfileStyle(Object.fromEntries(Object.keys(styleFields).map(key=>[key,values['profileStyle-'+key]])));
}
export function bindStudio(controls,renderPreview,announce){
 const onReset=event=>{
  if(!event.target.closest('[data-profile-style-reset]'))return;
  for(const key of Object.keys(styleFields))controls.elements.namedItem('profileStyle-'+key).value=defaultProfileStyle[key];
  renderPreview();
  if(announce)announce.textContent='Default appearance selected. Save to apply.';
 };
 controls.addEventListener('click',onReset);
}
