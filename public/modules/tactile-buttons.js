// Visual key-down feedback only. Native mouse/touch/keyboard activation remains intact.
const controls='button, a.button, input[type=button], input[type=submit], input[type=reset], summary.bci-action-trigger';
let pressed;
function release(){
 pressed?.removeAttribute('data-bci-key-pressed');
 pressed=undefined;
}
if(typeof document!=='undefined'){
 document.addEventListener('keydown',event=>{
  if(!['Enter',' '].includes(event.key)||event.repeat||!event.target?.matches?.(controls)||event.target.matches(':disabled,[aria-disabled=true]'))return;
  if(event.key===' '&&event.target.matches('a.button'))return;
  release();
  pressed=event.target;
  pressed.setAttribute('data-bci-key-pressed','');
 });
 document.addEventListener('keyup',event=>{if(['Enter',' '].includes(event.key))release();});
 document.addEventListener('focusout',event=>{if(event.target===pressed)release();});
 globalThis.addEventListener?.('blur',release);
}
