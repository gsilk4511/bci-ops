import assert from 'node:assert/strict';
import test from 'node:test';
import {bindMenuSounds} from '../public/modules/menu-sounds.js';

function setup(saved, {supportsAudio=true, startsSuspended=false}={}){
 const played=[];
 const element=()=>({dataset:{},attributes:{},children:[],events:{},
  setAttribute(key,value){this.attributes[key]=value;},append(...children){this.children.push(...children);},
  addEventListener(key,listener){this.events[key]=listener;},querySelectorAll(){return this.children;},
  closest(){return this;}
 });
 const button=element(),dialog=element(),options=element(),unavailable=element();
 options.ownerDocument={createElement:element};
 dialog.showModal=()=>{dialog.open=true;};
 let constructed=0,resume;
 class Audio{
  constructor(){constructed++;this.state=startsSuspended?'suspended':'running';this.currentTime=0;}
  resume(){return new Promise(resolve=>{resume=()=>{this.state='running';resolve();};});}
  createOscillator(){return {frequency:{},connect(){},start(){played.push(this.frequency.value);},stop(){}};}
  createGain(){return {connect(){},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}};}
 }
 const storage=new Map([['bci-menu-sound',saved]]);
 const host={AudioContext:supportsAudio?Audio:undefined,performance:{now:()=>50},
  localStorage:{getItem:key=>storage.get(key),setItem:(k,v)=>storage.set(k,v)}};
 const player=bindMenuSounds({button,dialog,options,unavailable,host});
 return {player,button,dialog,unavailable,options,played,storage,host,
  resume:()=>resume(),constructed:()=>constructed,
  choose:id=>options.events.click({target:options.children.find(c=>c.dataset.menuSound===id)})};
}
test('menu audio is lazy, supports three distinct previews, and persists Off',()=>{
 const app=setup('unrecognized');
 assert.equal(app.constructed(),0);
 assert.equal(app.button.dataset.sound,'mechanical');
 app.button.events.click();
 assert.equal(app.dialog.open,true);
 assert.equal(app.constructed(),0);
 app.player.play();
 app.choose('soft-tick');
 app.choose('digital');
 assert.deepEqual(app.played,[390,1250,670,610,915]);
 assert.equal(app.button.dataset.sound,'digital');
 assert.equal(app.storage.get('bci-menu-sound'),'digital');
 app.choose('off');
 app.player.play();
 assert.deepEqual(app.played,[390,1250,670,610,915]);
 assert.equal(app.storage.get('bci-menu-sound'),'off');
 assert.equal(app.options.children.at(-1).attributes['aria-pressed'],'true');
 const refreshed=setup(app.storage.get('bci-menu-sound'));
 refreshed.player.play();
 assert.equal(refreshed.constructed(),0);
});
test('stale suspended audio does not play after the user chooses Off',async()=>{
 const app=setup('mechanical',{startsSuspended:true});
 app.player.play();
 app.choose('off');
 app.resume();
 await Promise.resolve();
 assert.deepEqual(app.played,[]);
});
test('browsers without Web Audio retain navigation and show the audio limitation',()=>{
 const app=setup('mechanical',{supportsAudio:false});
 assert.equal(app.unavailable.hidden,false);
 assert.equal(app.button.dataset.sound,'off');
 assert.ok(app.options.children.slice(0,3).every(x=>x.disabled));
 assert.doesNotThrow(app.player.play);
});
