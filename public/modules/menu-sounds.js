// A short, local sound for a deliberate menu activation. No files or network calls.
export const menuSoundOptions=[
 {id:'mechanical',name:'Mechanical',description:'A soft, tactile switch.',tones:[[390,'triangle',.09,.034,0],[1250,'sine',.044,.012,.002]]},
 {id:'soft-tick',name:'Soft Tick',description:'A light, quiet tap.',tones:[[670,'sine',.063,.024,0]]},
 {id:'digital',name:'Digital',description:'A quick, bright double tone.',tones:[[610,'sine',.062,.023,0],[915,'sine',.047,.025,.021]]},
 {id:'off',name:'Off',description:'Mute menu tabs and vehicle cards.',tones:[]}
];
const key='bci-menu-sound';
const fallback='mechanical';
const valid=id=>menuSoundOptions.some(option=>option.id===id);
export function bindMenuSounds({button,dialog,options,unavailable,host=globalThis}){
 if(!button||!unavailable||!options?.ownerDocument?.createElement||!dialog?.showModal)return {play(){}};
 const Context=host.AudioContext||host.webkitAudioContext;
 let choice=fallback, context, activation=0;
 try{const saved=host.localStorage.getItem(key);if(valid(saved))choice=saved;}catch{}
 function draw(){
  const active=menuSoundOptions.find(option=>option.id===choice);
  button.title='Menu sounds: '+(Context?active.name:'Unavailable in this browser');
  button.setAttribute('aria-label',button.title);
  button.dataset.sound=Context?choice:'off';
  for(const control of options.querySelectorAll('[data-menu-sound]')){
   control.setAttribute('aria-pressed',String(control.dataset.menuSound===choice));
  }
 }
 for(const option of menuSoundOptions){
  const control=options.ownerDocument.createElement('button');
  control.type='button';
  control.className='menu-sound-option';
  control.dataset.menuSound=option.id;
  const label=options.ownerDocument.createElement('strong');
  label.textContent=option.name;
  const detail=options.ownerDocument.createElement('span');
  detail.textContent=option.description;
  control.append(label,detail);
  options.append(control);
  control.disabled=!Context&&option.id!=='off';
 }
 unavailable.hidden=Boolean(Context);
 draw();
 button.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
 options.addEventListener('click',event=>{
  const selection=event.target.closest('[data-menu-sound]')?.dataset.menuSound;
  if(!valid(selection))return;
  ++activation;
  choice=selection;
  try{host.localStorage.setItem(key,choice);}catch{}
  draw();
  play();
 });
 function play(){
  const tones=menuSoundOptions.find(option=>option.id===choice).tones;
  if(!Context||!tones.length)return;
  const ticket=++activation;
  try{
   if(!context||context.state==='closed')context=new Context();
   const audio=context, started=host.performance.now();
   function tap(){
    if(ticket!==activation||audio.state!=='running'||host.performance.now()-started>200)return;
    const t=audio.currentTime+.001;
    for(const [frequency,type,volume,duration,offset] of tones){
     const begin=t+offset,end=begin+duration;
     const oscillator=audio.createOscillator(),gain=audio.createGain();
     oscillator.type=type;
     oscillator.frequency.value=frequency;
     gain.gain.setValueAtTime(.0001,begin);
     gain.gain.linearRampToValueAtTime(volume,begin+.002);
     gain.gain.exponentialRampToValueAtTime(.0001,end);
     oscillator.connect(gain);
     gain.connect(audio.destination);
     oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
     oscillator.start(begin);
     oscillator.stop(end+.002);
    }
   }
   // Call resume in the click gesture so browsers can unlock audio.
   if(audio.state==='running')tap();
   else audio.resume().then(tap).catch(()=>{});
  }catch{} // Restricted or unavailable audio must never block navigation.
 }
 return {play};
}
