// Shared dashboard layout schema: the browser edits the same grid the server validates.
export const GRID_COLUMNS=12, GRID_ROWS=128;
export const cards=Object.freeze([
 {id:'review',title:'Work orders awaiting review',needs:['workorders.view','workorder.review'],w:7,h:3},
 {id:'ready',title:'Reviewed and ready to invoice',needs:['workorders.view','invoice.group','finance.view'],w:5,h:3},
 {id:'payment',title:'Invoices awaiting payment',needs:['finance.view','invoices.view','workorders.view'],w:7,h:3},
 {id:'projects',title:'Open projects',needs:['projects.view'],w:5,h:3},
 {id:'open-work',title:'Open work orders',needs:['workorders.view'],w:7,h:3},
 {id:'timer',title:'Active timer',needs:['workorders.view','clock.in'],w:5,h:2},
 {id:'overview',title:'Business overview',needs:[],w:12,h:3},
 {id:'prospects',title:'Chasing Work',needs:['tickets.view'],w:6,h:3},
 {id:'final-billing',title:'Projects awaiting final billing',needs:['projects.view','finance.view','workorders.view','invoices.view'],w:6,h:3},
 {id:'warehouse',title:'Warehouse shortages',needs:['inventory.view'],w:6,h:3},
 {id:'signoff',title:'Waiting on signoff',needs:['workorders.view'],w:6,h:3},
 {id:'unbilled',title:'Unbilled work',needs:['money.view','finance.view'],w:5,h:2}
].map(Object.freeze));
export const allowedCards=permissions=>cards.filter(c=>c.needs.every(key=>permissions.includes(key)));
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const index=new Map(cards.map(c=>[c.id,c]));
const attrKeys=['id','x','y','w','h'];
export function validateLayout(input,permissions){
 const available=new Set(allowedCards(permissions).map(c=>c.id)), seen=new Set();
 if(!Array.isArray(input)||input.length>cards.length)throw Error('Invalid dashboard layout');
 return input.map((item,i)=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).length!==attrKeys.length||
   !attrKeys.every(k=>Object.hasOwn(item,k))||!available.has(item.id)||seen.has(item.id)||
   ![item.x,item.y,item.w,item.h].every(Number.isInteger)||
   item.x<0||item.y<0||item.w<3||item.w>12||item.h<2||item.h>12||
   item.x+item.w>GRID_COLUMNS||item.y+item.h>GRID_ROWS||
   input.slice(0,i).some(other=>intersects(item,other)))throw Error('Invalid or overlapping dashboard cards');
  seen.add(item.id);
  return Object.fromEntries(attrKeys.map(k=>[k,item[k]]));
 });
}
export const visualOrder=(a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id);
export function orderLayout(layout,activeId,delta){
 const target=layout.find(row=>row.id===activeId);
 if(!target)return layout;
 const next={...target,...delta,id:activeId};
 if(![next.x,next.y,next.w,next.h].every(Number.isInteger))throw Error('Enter whole grid coordinates');
 next.w=clamp(next.w,3,12);next.h=clamp(next.h,2,12);
 next.x=clamp(next.x,0,GRID_COLUMNS-next.w);next.y=clamp(next.y,0,GRID_ROWS-next.h);
 const placed=[next];
 for(const item of layout.filter(x=>x.id!==activeId).sort(visualOrder)){
  const row={...item};
  let bumps=placed.filter(x=>intersects(row,x));
  while(bumps.length){row.y=Math.max(...bumps.map(x=>x.y+x.h));bumps=placed.filter(x=>intersects(row,x));}
  if(row.y+row.h>GRID_ROWS)throw Error('No room below those cards. Move the card closer to the top.');
  placed.push(row);
 }
 return placed.sort(visualOrder);
}
export function addLayoutCard(layout,id){
 if(layout.some(c=>c.id===id)||!index.has(id))return layout;
 const d=index.get(id), y=Math.max(0,...layout.map(x=>x.y+x.h));
 return orderLayout([...layout,{id,x:0,y,w:d.w,h:d.h}],id,{});
}
export function defaultLayout(permissions){
 const allowed=new Set(allowedCards(permissions).map(x=>x.id));
 const office=allowed.has('review')||allowed.has('ready');
 const spec=office?[
  ['review',0,0],['ready',7,0],['payment',0,3],['projects',7,3],['overview',0,6]
 ]:[['open-work',0,0],['timer',7,0],['projects',0,3],['overview',0,6]];
 const rows=spec.filter(([id])=>allowed.has(id)).map(([id,x,y])=>({id,x,y,w:index.get(id).w,h:index.get(id).h}));
 const levels=[...new Set(rows.map(x=>x.y))].sort((a,b)=>a-b);
 return rows.map(row=>{
  const level=levels.indexOf(row.y), y=levels.slice(0,level).reduce((n,a)=>n+Math.max(...rows.filter(r=>r.y===a).map(r=>r.h)),0);
  const peers=rows.filter(r=>r.y===row.y);
  return {...row,x:peers.length===1?0:row.x,w:peers.length===1?12:row.w,y};
 });
}
