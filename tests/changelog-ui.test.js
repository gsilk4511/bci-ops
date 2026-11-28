import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('admin changelog loads cards and opens escaped, focus-managed release details',async()=>{
 const latest={version:'0.8.6-catalog.6',releaseDate:'2026-11-20',developmentMinutes:135,title:'Warehouse & <script>',summary:'A short update.',sections:[{title:'Details',items:['Safe <markup> text']} ]};
 const older={version:'0.8.6-catalog.5',releaseDate:'2026-11-19',developmentMinutes:50,title:'Previous notes',summary:'An earlier update.',sections:[]};
 const requests=[];
 const context=vm.createContext({fetch:async(path,options)=>{
  requests.push([path,options.cache]);
  return {ok:true,json:async()=>({releases:[latest,older]})};
 }});
 const app=new vm.SyntheticModule(['esc','head','me','practiceMode'],function(){
  this.setExport('esc',s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
  this.setExport('head',s=>'<h1>'+s+'</h1>');
  this.setExport('me',{role:'admin'});
  this.setExport('practiceMode',false);
 },{context});
 const page=new vm.SourceTextModule(readFileSync(new URL('../public/modules/changelog.js',import.meta.url),'utf8'),{context});
 await page.link(()=>app);
 await page.evaluate();
 assert.match(page.namespace.changelogPage(),/<h1>Changelog<\/h1>[\s\S]*Back to releases[\s\S]*Close/);
 function node(o={}){
  const listeners={};
  return {listeners,isConnected:true,innerHTML:'',addEventListener(k,f){listeners[k]=f;},replaceChildren(){this.innerHTML='';},focus(){this.focused=true;},...o};
 }
 const title=node(),readMore=node({dataset:{changelogRelease:'0'}});
 const hours=node(),cards=node(),status=node(),back=node(),close=node(),detail=node({querySelector:()=>title,scrollTop:88});
 const dialog=node({showModal(){this.open=true;},close(){this.open=false;this.listeners.close();}});
 const children={'[data-changelog-cards]':cards,'[data-changelog-status]':status,'[data-changelog-hours]':hours,'[data-changelog-detail]':detail,'[data-changelog-back]':back,'[data-changelog-close]':close,dialog};
 const root=node({querySelector:key=>children[key]});
 await page.namespace.wireChangelog(root);
 assert.deepEqual(requests,[['/api/changelog','no-store']]);
 assert.match(cards.innerHTML,/v0\.8\.6-catalog\.6[\s\S]*Latest[\s\S]*Warehouse &amp; &lt;script&gt;[\s\S]*Read more[\s\S]*v0\.8\.6-catalog\.5/);
 assert.doesNotMatch(cards.innerHTML,/Safe|<script>|Date not recorded/);
 assert.match(cards.innerHTML,/2026-11-20 · <span[^>]+>2 h 15 m/);
 assert.match(cards.innerHTML,/2026-11-19 · <span[^>]+>50 m/);
 assert.equal(hours.textContent,'Running total /developmentTime = 3 h 5 m');
 const read=()=>root.listeners.click({target:{closest:key=>key==='button[data-changelog-release]'?readMore:null}});
 read();
 assert.equal(dialog.open,true);
 assert.equal(detail.scrollTop,0);
 assert.equal(title.focused,true);
 assert.match(detail.innerHTML,/Safe &lt;markup&gt; text/);
 back.listeners.click();
 assert.equal(dialog.open,false);
 assert.equal(detail.innerHTML,'');
 assert.equal(readMore.focused,true);
 read();
 close.listeners.click();
 assert.equal(dialog.open,false);
 app.setExport('me',{role:'tech'});
 assert.equal(page.namespace.changelogPage(),'');
 await page.namespace.wireChangelog(root);
 app.setExport('me',{role:'admin'});
 app.setExport('practiceMode',true);
 assert.equal(page.namespace.changelogPage(),'');
 await page.namespace.wireChangelog(root);
 assert.equal(requests.length,1);
});
