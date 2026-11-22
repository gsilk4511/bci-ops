import {profileStyleOptions} from './profile-style-catalog.js';

const icons=new Map(profileStyleOptions.icon.map(icon=>[icon.id,icon]));

// Identity is assigned by the authorized work-order response. Never infer it
// from a display name or try to fetch an employee profile from the browser.
export function workOrderTechnicianIcon(id,esc){
 const icon=icons.get(id);
 if(!icon)return '';
 const name=esc('Technician icon: '+icon.label);
 return `<svg class="work-order-tech-icon" role="img" aria-label="${name}" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><title>${name}</title><path d="${esc(icon.path)}"></path></svg>`;
}

export function workOrderTechnicianIcons(entries,esc){
 const ids=[...new Set((entries||[]).map(entry=>entry.technicianIcon).filter(id=>icons.has(id)))].slice(0,3);
 return ids.length?`<span class="work-order-tech-icon-group" role="group" aria-label="Technician styles on this work order">${ids.map(id=>workOrderTechnicianIcon(id,esc)).join('')}</span>`:'';
}
