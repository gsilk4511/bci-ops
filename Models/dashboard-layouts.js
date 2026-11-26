import {allowedCards,defaultLayout,validateLayout} from '../public/modules/dashboard-layout.js';

const owner=actor=>actor.email?.trim().toLowerCase();
export function dashboardLayout(state,actor){
 if(!owner(actor)||!actor.permissions?.includes('dashboard.view'))return undefined;
 const available=new Set(allowedCards(actor.permissions).map(c=>c.id));
 const saved=(state.dashboardLayouts||[]).find(row=>row.email===owner(actor))?.cards;
 if(!Array.isArray(saved))return defaultLayout(actor.permissions);
 const filtered=saved.filter(row=>available.has(row?.id));
 try{return validateLayout(filtered,actor.permissions);}catch{return defaultLayout(actor.permissions);}
}
export function saveDashboardLayout(state,actor,data){
 const email=owner(actor);
 if(!email||!actor.permissions?.includes('dashboard.view'))throw Error('Dashboard access required');
 if(Object.keys(data).length!==1||!Object.hasOwn(data,'cards'))throw Error('Invalid dashboard layout request');
 const next=validateLayout(data.cards,actor.permissions);
 state.dashboardLayouts=(state.dashboardLayouts||[]).filter(row=>row.email!==email);
 state.dashboardLayouts.push({email,cards:next});
 return next;
}
