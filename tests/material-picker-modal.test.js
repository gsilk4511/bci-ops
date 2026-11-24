import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const element=()=>({
 dataset:{},style:{},attrs:{},events:{},value:'',innerHTML:'',hidden:false,options:[],textContent:'',
 classList:{add(){},remove(){},toggle(){}},
 setAttribute(name,value){this.attrs[name]=value;},removeAttribute(name){delete this.attrs[name];},
 addEventListener(kind,fn){(this.events[kind]??=[]).push(fn);},
 replaceChildren(...nodes){this.options=nodes;this.value=nodes[0]?.value||'';},
 querySelectorAll(){return [];},querySelector(){return null;},
 focus(){this.focused=true;},click(){this.clicked=true;},
 dispatchEvent(event){event.target=this;this.events[event.type]?.forEach(fn=>fn(event));if(event.bubbles&&this.form)this.form.dispatchFrom(event);},
 async fire(type,target=this){const event={type,target,preventDefault(){this.prevented=true;}};for(const fn of this.events[type]||[])await fn(event);return event;},
});
test('Log Materials grid shows ten selections, keeps selection across filters, and validates the work scope on submit',async()=>{
 if(!vm.SourceTextModule)return;
 const form=element(),dialog=element(),modalContent=element(),placeholder=element(),nodes=new Map();
 const controlNames=['catalogId','partSearchText','partCategoryFilter','partTypeFilter','partBrandFilter','quantity','location','changeId','date'];
 form.elements=Object.fromEntries(controlNames.map(name=>[name,{...element(),name,form}]));
 Object.assign(form.elements.quantity,{validity:{valid:true},value:'2'});
 Object.assign(form.elements.location,{value:'BCI Warehouse'});
 form.elements.date.value='2026-11-20';
 for(const id of ['#materialPreview','#materialMatches','#materialRows','#materialPrevious','#materialNext','#materialStock','.bci-material-shortcuts','.form-error','button[type=submit]'])nodes.set(id,element());
 form.querySelector=selector=>nodes.get(selector)||null;
 form.dispatchFrom=event=>{for(const fn of form.events[event.type]||[])fn(event);};
 const selectors=new Map([['#actionForm',form],['#modal',dialog],['#modalContent',modalContent]]);
 const calls=[], timers=new Map();
 let saved=false, timerCount=0;
 const context=vm.createContext({
  console, Intl, Date, Map, Set, URL, Number, String, Object, Array, Promise,
  document:{querySelector(sel){return selectors.get(sel)||placeholder;},addEventListener(){},documentElement:{dataset:{}}},
  matchMedia(){return {matches:false,addEventListener(){}}},localStorage:{getItem(){return null}},
  navigator:{},window:{location:{href:'https://ops.example.invalid/'}},crypto:{randomUUID},
  setTimeout(fn){const id=++timerCount;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},setInterval(){return 1;},clearInterval(){},
  MutationObserver:class {observe(){} disconnect(){};},
  Event:class {constructor(type,{bubbles}={}){Object.assign(this,{type,bubbles});}},
  Option:class {constructor(label,value){Object.assign(this,{label,value});}},
  FormData:class {constructor(form){this.form=form;}[Symbol.iterator](){return Object.entries(this.form.elements).map(([name,input])=>[name,input.value])[Symbol.iterator]();}},
  fetch(url,opts){
   if(url!=='/api/action'){
    if(saved)return Promise.reject(Error('Test does not reload the page after save'));
    return new Promise(()=>{});
   }
   const body=JSON.parse(opts.body);calls.push(body);
   if(body.action==='entry.add')saved=true;
   return Promise.resolve({ok:true,json:async()=>({ok:true,result:body.data.clear?{cleared:true}:{projected:4}})});
  },
 });
 const root=fileURLToPath(new URL('../public/',import.meta.url));
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file);
  let source=fs.readFileSync(file,'utf8');
  if(file.endsWith('/app.js'))source+='\nglobalThis.injectTestData=(value)=>{data=value;me=value.me;};';
  const module=new vm.SourceTextModule(source,{context,identifier:file});cache.set(file,module);return module;
 }
 const app=load(path.join(root,'app.js'));
 await app.link((specifier,ref)=>load(path.resolve(path.dirname(ref.identifier),specifier)));
 await app.evaluate();
 const material=(id,name,unit,info={})=>({id,sku:id,type:'material',name,unit,catalogInfo:{brand:'Example',mpn:id,system:'Copper',partType:'Jacks',...info}});
 const pack=material('PACK-25','Cat6 Jack Pack','box',{catalogUnit:'Pack',packQty:25});
 const piece=material('JACK-EA','Cat6 Jack','ea',{catalogUnit:'Each',photoId:'a'.repeat(64)});
 const legacy={id:'OLD',sku:'LEG-001',name:'Old Jack',unit:'ea',type:'material'};
 const order={id:'wo-1',approvedAt:'2026-11-19',effectivePricing:{},entries:[],changes:[{id:'co-1',status:'approved',description:'Scope addition',lines:[{catalogId:piece.id}]}]};
 const state={me:{permissions:['entry.add','receipt.add'],email:'tech@example.invalid'},workorders:[order],inventory:[],catalog:[
  pack,piece,legacy,...Array.from({length:60},(_,i)=>material('X-'+i,'X Jack '+i,'ea',{catalogUnit:'Each'})),
 ]};
 context.injectTestData(state);
 app.namespace.openWorkEntry(order,true);
 assert.match(modalContent.innerHTML,/Quick material filters/);
 assert.match(modalContent.innerHTML,/\+ Add Receipt/);
 const rows=nodes.get('#materialRows');
 const shown=()=>[...rows.innerHTML.matchAll(/data-material-choice="([^"]+)"/g)].map(match=>match[1]);
 assert.doesNotMatch(modalContent.innerHTML,/materialQuickChoices|Select part<|<select[^>]*name="catalogId"/);
 assert.match(modalContent.innerHTML,/<input type="hidden" name="catalogId">/);
 assert.equal(shown().length,10);
 assert.equal(form.elements.catalogId.value,'');
 await form.fire('submit');
 assert.match(nodes.get('.form-error').textContent,/Select a part/);
 assert.equal(calls.some(call=>call.action==='entry.add'),false);
 const page1=shown();
 const next=nodes.get('#materialNext'),prev=nodes.get('#materialPrevious');
 assert.equal(prev.disabled,true);assert.equal(next.disabled,false);
 await next.fire('click');
 assert.equal(shown().length,10);
 assert.ok(shown().every(id=>!page1.includes(id)));
 assert.match(nodes.get('#materialMatches').textContent,/Showing 11–20/);
 await prev.fire('click');assert.deepEqual(shown(),page1);
 const search=form.elements.partSearchText;
 search.value='PACK-25';
 await search.fire('input');
 assert.deepEqual(shown(),[pack.id]);
 assert.match(rows.innerHTML,/Unit: box.*Pack qty: 25/);
 const enter={type:'keydown',key:'Enter',preventDefault(){this.prevented=true;}};
 search.dispatchEvent(enter);assert.equal(enter.prevented,true);
 // Tap the exact box SKU row.
 const choose=async id=>rows.fire('click',{closest(){return {dataset:{materialChoice:id}};}});
 await choose(pack.id);
 assert.equal(form.elements.catalogId.value,pack.id);
 assert.match(nodes.get('#materialPreview').innerHTML,/Pack qty: 25/);
 assert.equal(form.elements.quantity.attrs['aria-describedby'],'materialUnitHint');
 search.value='X-24';await search.fire('input');
 assert.equal(form.elements.catalogId.value,pack.id);
 assert.match(nodes.get('#materialMatches').textContent,/selected part is outside/);
 search.value='';await search.fire('input');
 await next.fire('click');
 assert.equal(form.elements.catalogId.value,pack.id);
 for(const fn of [...timers.values()])fn();
 timers.clear();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.at(-1).action,'entry.materialDraft');
 assert.equal(calls.at(-1).data.catalogId,pack.id);
 assert.equal(calls.at(-1).data.quantity,'2');
 // Selecting an approved change clears a part outside its signed scope.
 form.elements.changeId.value='co-1';
 form.elements.changeId.dispatchEvent({type:'change',bubbles:true});
 assert.equal(form.elements.catalogId.value,'');
 search.value='';await search.fire('input');
 assert.deepEqual(shown(),[piece.id]);
 await choose(piece.id);
 assert.equal(form.elements.catalogId.value,piece.id);
 assert.match(nodes.get('#materialPreview').innerHTML,/Selected: Cat6 Jack/);
 form.elements.changeId.value='';
 form.elements.changeId.dispatchEvent({type:'change',bubbles:true});
 search.value='PACK-25';await search.fire('input');
 await choose(pack.id);
 await form.fire('submit');
 const submission=calls.find(body=>body.action==='entry.add').data;
 assert.equal(submission.catalogId,pack.id);
 assert.equal(submission.type,'material');
 assert.equal(submission.quantity,'2');
 assert.equal(submission.location,'BCI Warehouse');
 assert.equal(submission.receipt,null);
 for(const field of ['partSearchText','partCategoryFilter','partTypeFilter','partBrandFilter','unit'])assert.equal(Object.hasOwn(submission,field),false);
 assert.equal(saved,true);
});
