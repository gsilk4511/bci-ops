export const fleetSoundOptions=Object.freeze([
 ['off','Off (silent)'],['ram-v8','Ram 1500 · V8 startup'],['honda-v6','Honda 3.2L · V6 rev']
].map(Object.freeze));
const ids=new Set(fleetSoundOptions.map(([id])=>id));
export function fleetSound(id,strict=false){
 if(ids.has(id))return id;
 if(strict)throw Error('Choose an available vehicle sound');
 return 'off';
}
export function createFleetSoundPlayer(host=globalThis){
 let playing;
 const stop=()=>{
  if(playing){const old=playing;playing=undefined;old.pause();}
 };
 function play(value,{preview=false}={}){
  const id=fleetSound(value);
  stop();
  if(id==='off'||!host.Audio)return false;
  try{if(!preview&&host.localStorage.getItem('bci-menu-sound')==='off')return false;}catch{}
  try{
   const sample=new host.Audio('/api/vehicle-sound/'+id+'.mp3');
   playing=sample;
   sample.volume=.48;
   sample.addEventListener('ended',()=>{if(playing===sample)playing=undefined;},{once:true});
   const result=sample.play();
   if(result)void result.catch(()=>{if(playing===sample)playing=undefined;});
   return true;
  }catch{return false;}
 }
 return {play,stop};
}
