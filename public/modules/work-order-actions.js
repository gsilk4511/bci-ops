// Normal focusable buttons preserve Tab/Enter semantics inside the disclosure.
export function wireWorkorderActions(doc){
 const close=restoreFocus=>{
  const open=doc.querySelector('[data-workorder-actions][aria-expanded="true"]');
  if(!open)return;
  open.setAttribute('aria-expanded','false');
  doc.querySelector('#workorderActionsPanel').hidden=true;
  if(restoreFocus)open.focus();
 };
 doc.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-workorder-actions]');
  if(trigger){
   if(trigger.getAttribute('aria-expanded')==='true')close(false);
   else {
    trigger.setAttribute('aria-expanded','true');
    doc.querySelector('#workorderActionsPanel').hidden=false;
   }
  }else{
   const action=event.target.closest('#workorderActionsPanel button');
   if(action||!event.target.closest('.workorder-action-menu'))close(doc.activeElement===action&&Boolean(action));
  }
 });
 doc.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&doc.querySelector('#modal')?.hidden!==false)close(true);
 });
}
