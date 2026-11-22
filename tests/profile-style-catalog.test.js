import assert from 'node:assert/strict';
import test from 'node:test';
import {profileStyleOptions,defaultProfileStyle,normalizeProfileStyle} from '../public/modules/profile-style-catalog.js';

const keys=['ring','lighting','banner','section','text','icon'];
function luminance(hex){
 assert.match(hex,/^#[0-9a-f]{6}$/i);
 const [r,g,b]=hex.slice(1).match(/../g).map(pair=>{
  const x=parseInt(pair,16)/255;
  return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
 });
 return .2126*r+.7152*g+.0722*b;
}

test('Studio has twenty unique options in each of six categories and safe defaults',()=>{
 assert.deepEqual(Object.keys(profileStyleOptions).sort(),keys.slice().sort());
 assert.deepEqual(Object.keys(defaultProfileStyle).sort(),keys.slice().sort());
 for(const key of keys){
  const list=profileStyleOptions[key];
  assert.equal(list.length,20,key);
  assert.equal(new Set(list.map(row=>row.id)).size,20,key);
  assert.equal(new Set(list.map(row=>row.label)).size,20,key);
  assert(list.some(row=>row.id===defaultProfileStyle[key]));
  assert(list.every(row=>/^[a-z0-9-]+$/.test(row.id)&&row.label));
 }
 assert.deepEqual(normalizeProfileStyle({icon:'<script>',ring:'unknown',anything:'external'}),defaultProfileStyle);
 assert.equal(new Set(profileStyleOptions.icon.map(icon=>icon.path)).size,20);
 for(const icon of profileStyleOptions.icon)assert.match(icon.path,/^[MAHVLCZSQTAma hvlczsqt0-9.,+\-\r\n]+$/i);
});

test('Every built-in primary and secondary text color clears 4.5:1 on every chosen section',()=>{
 for(const section of profileStyleOptions.section)for(const item of profileStyleOptions.text)for(const value of [item.color,item.muted]){
  const a=luminance(section.background),b=luminance(value);
  const contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert(contrast>=4.5,`${section.id}/${item.id}: ${contrast}`);
 }
});
