import test from 'node:test';
import assert from 'node:assert/strict';
import {photoId,photoThumbnail,partMeta,partCategory,partSearch} from '../public/modules/catalog-photos.js';

const hash='ab'.repeat(32);
const part={name:'Cat6 Jack <sample>',sku:'BCI-127',catalogInfo:{brand:'Test Maker',mpn:'J-127A',system:'Copper',partType:'Jack',photoStatus:'Family',photoId:hash}};
test('part search matches all terms across name, SKU and manufacturer fields',()=>{
 assert.ok(partSearch(part,'MAKER j-127A cat6'));
 assert.ok(partSearch(part,'BCI-127 Copper'));
 assert.ok(!partSearch(part,'Cat6 Switch'));
 assert.equal(partCategory(part),'Copper / Jack');
 assert.equal(partCategory({}),'Unclassified');
 assert.equal(partMeta(part),'Test Maker · J-127A');
});
test('photo thumbnail serves a same-origin hash and marks family photographs',()=>{
 const html=photoThumbnail(part);
 assert.equal(photoId(part),hash);
 assert.ok(html.includes('src="/api/catalog-photo/'+hash+'.jpg"'));
 assert.ok(html.includes('data-bci-photo-family="yes"'));
 assert.ok(html.includes('Cat6 Jack &lt;sample&gt;'));
 assert.ok(!html.includes('Cat6 Jack <sample>'));
 assert.equal(photoThumbnail({catalogInfo:{photoId:'../../secret'}}),'');
 assert.equal(photoThumbnail({catalogInfo:{photoId:'https://cdn.example.invalid/photo.jpg'}}),'');
});

test('click opens a labeled viewer, zoom toggles, and closing restores the part button',async()=>{
 class Element{
  listeners={};attributes={};hidden=false;isConnected=true;
  addEventListener(event,fn){this.listeners[event]=fn;}
  focus(){this.focused=true;}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return this.attributes[key];}
  removeAttribute(key){delete this[key];}
  querySelector(key){return this.children[key];}
  showModal(){this.open=true;}
  close(){this.open=false;this.listeners.close?.();}
 }
 const make=()=>new Element();
 const dialog=make(),stage=make(),image=make(),message=make(),zoom=make(),title=make(),caption=make(),close=make();
 stage.children={img:image,p:message};
 stage.classList={toggle(name,value){this[name]=value;}};
 dialog.children={'.bci-photo-stage':stage,'.bci-photo-zoom':zoom,'h2':title,'.bci-photo-caption':caption,'.bci-photo-close':close};
 const events={};
 globalThis.document={createElement(){return dialog;},body:{append(){}},addEventListener(key,fn){events[key]=fn;}};
 try{
  await import('../public/modules/catalog-photos.js?viewer-test');
  const trigger=make();
  trigger.dataset={bciPhoto:hash,bciPhotoName:part.name,bciPhotoFamily:'yes'};
  const event={target:{closest:()=>trigger},preventDefault(){this.prevented=true;}};
  events.click(event);
  assert.equal(event.prevented,true);
  assert.equal(dialog.open,true);
  assert.equal(title.textContent,part.name);
  assert.equal(caption.hidden,false);
  assert.equal(close.focused,true);
  assert.equal(image.src,'/api/catalog-photo/'+hash+'.jpg');
  zoom.listeners.click();
  assert.equal(stage.classList['bci-photo-zoomed'],true);
  assert.equal(zoom.getAttribute('aria-pressed'),'true');
  zoom.listeners.click();
  assert.equal(stage.classList['bci-photo-zoomed'],false);
  close.listeners.click();
  assert.equal(dialog.open,false);
  assert.equal(trigger.focused,true);
  assert.equal(image.src,undefined);
  trigger.dataset.bciPhotoFamily='no';
  events.click(event);
  assert.equal(caption.hidden,true);
  image.listeners.error();
  assert.equal(zoom.hidden,true);
  assert.equal(message.hidden,false);
  close.listeners.click();
 }finally{delete globalThis.document;}
});
