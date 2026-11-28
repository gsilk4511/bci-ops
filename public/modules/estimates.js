import {estimateWorkspace,startEstimate} from './estimate-workspace.js';
import {partCategory,partMeta,partSearch,photoThumbnail} from './catalog-photos.js';
import {normalizeEstimateScopes,scopeLines} from './estimate-scope-math.js';
import {data,can,esc,fmt,head,table,modal,f,send,billingName,customer,printDocument,show,initSignature,practiceMode} from '../app.js';

const button=(action,label,id='')=>`<button class="secondary small" data-estimate-action="${action}" data-estimate-id="${esc(id)}">${label}</button>`;
const linesTable=estimate=>table(['Description','Qty','Rate','Amount'],estimate.lines.map(line=>
 `<tr><td>${esc(line.description)}</td><td>${line.quantity}</td><td>${line.rate==null?'Needs rate':fmt(line.rate)}</td><td>${line.amount==null?'—':fmt(line.amount)}</td></tr>`));
const approvedAmounts=estimate=>{
 const known=estimate.lines.filter(line=>line.cost!=null);
 const unknown=estimate.lines.length-known.length;
 if(!can('finance.view')||!estimate.lines.length)return '';
 const cost=known.reduce((total,line)=>total+line.quantity*line.cost,0);
 return `<p>Estimated cost ${fmt(cost)}${unknown?' · '+unknown+' line(s) lack cost; margin incomplete':' · Gross margin '+fmt(estimate.total-cost)+(estimate.total?' ('+((estimate.total-cost)/estimate.total*100).toFixed(1)+'%)':'')}</p>`;
};
export function estimatesPage(){
 const workspace=practiceMode?null:estimateWorkspace();if(workspace)return workspace;
 return head('Estimates','Sales','Build and sign a whole-job estimate, then release its work orders.',can('estimate.create')?button('new','+ New Estimate'):'')+
  (data.estimates||[]).map(estimate=>`<section class="panel"><h2>${esc(estimate.number)} · ${esc(estimate.title)}</h2>
   <p>${esc(billingName(customer(estimate.clientId)))} · ${esc(estimate.status)} · <b>${fmt(estimate.total)}</b></p>
   <details><summary>Scope and line items</summary><p class="ticket-text">${esc(estimate.scope)}</p>${linesTable(estimate)}</details>
   ${approvedAmounts(estimate)}
   ${estimate.workOrderChanges?.length?`<details><summary>Work-order differences for office review</summary>${estimate.workOrderChanges.map(item=>`<p><b>${esc(item.change)} · ${esc(item.label)}</b><br>Before: ${esc(item.before||'None')}<br>After: ${esc(item.after||'None')}</p>`).join('')}</details>`:''}
   ${estimate.generatedOrders?.length?`<details><summary>Estimate work orders</summary>${estimate.generatedOrders.map(item=>{
      const order=data.workorders.find(order=>order.id===item.id);
      return `<div class="list-item">${can('workorders.view')&&order?`<button class="rowlink" data-wo="${esc(item.id)}">${esc(item.label)}</button>`:esc(item.label)}
        ${order&&!order.approvedAt&&can('estimate.releaseWorkOrder')&&can('workorder.approve')&&can('workorders.view')?button('release','Release to crew',item.id):''}</div>`;
   }).join('')}</details>`:''}
   ${estimate.acceptedBy?`<p>Accepted by ${esc(estimate.acceptedBy)} · ${esc(estimate.evidence)}</p>`:''}
   <div class="actions">${!estimate.workflow?button('print','Print / PDF',estimate.id):''}
   ${estimate.billingEmail&&(can('estimate.create')||can('estimate.update'))?button('email','Email estimate',estimate.id):''}
   ${estimate.workflow?button('workspace',estimate.status==='Draft'?'Open estimate':'Open agreement',estimate.id):estimate.status==='Draft'&&can('estimate.update')?button('edit','Edit legacy draft',estimate.id):''}
   ${!estimate.workflow&&estimate.status==='Draft'&&can('estimate.accept')&&(!estimate.scopes?.length||can('workorder.create')&&can('workorders.view'))?button('accept','Record acceptance',estimate.id)+button('sign','Sign on this device',estimate.id):''}
   ${!estimate.workflow&&estimate.approvalSnapshot&&estimate.projectId&&can('estimate.create')?button('revise','Draft a revision',estimate.id):''}
   ${estimate.status==='Accepted'&&!estimate.projectId&&can('estimate.convert')&&can('project.create')&&can('projects.view')?button('convert','Create project',estimate.id):''}
   ${estimate.projectId&&can('projects.view')?`<button class="secondary small" data-project="${esc(estimate.projectId)}">Open project</button>`:''}
   </div></section>`).join('');
}

const types={labor:'Labor',travel:'Travel',material:'Part',custom:'Custom line'};
const draftRows=estimate=>estimate?.lines.map(line=>({...line,type:line.type||'custom'}))||[];
const contactOptions=client=>[['','No job contact'],...(client?.contacts||[]).map(contact=>[contact.id,contact.name])];

const scopeLabels={copper:'Copper',fiber:'Fiber',lift:'Scissor lift',shared:'Other shared cost'};
const numbers=(key,label,opts={})=>[key,label,{type:'number',step:'any',min:0,...opts}];
const copperFields=[
 ['label','Section label (optional)'],['building','Building type',{required:true}],['access','Access / pathway difficulty',{required:true}],
 ['category','Cable category',{select:[['','Choose category'],['Cat5e','Cat5e'],['Cat6','Cat6'],['Cat6A','Cat6A'],['Cat8','Cat8']],required:true}],
 ['cableType','Cable construction (e.g. plenum UTP)',{required:true}],['jack','Compatible jack brand / model',{required:true}],
 numbers('drops','Number of drops',{required:true,min:1}),numbers('avgLength','Average feet per drop',{required:true,min:1}),numbers('boxLength','Feet per box',{required:true,min:1,value:'1000'}),
 numbers('waste','Cable allowance (%)',{required:true,value:'10'}),numbers('jacksPerDrop','Jacks per drop',{required:true,value:'1'}),
 numbers('portsPerPlate','Ports per plate',{required:true,min:1,value:'1'}),numbers('portsPerPanel','Ports per patch panel',{required:true,min:1,value:'24'}),
 numbers('hoursPerDrop','Tech-hours per drop',{required:true,min:0.001,hint:'Enter your own assumption. Two techs for one hour is two tech-hours.'})
];
const fiberFields=[
 ['label','Section label (optional)'],['route','Route',{required:true}],['fiberType','Fiber type',{required:true}],
 numbers('length','Run length (feet)',{required:true,min:1}),numbers('strands','Strand count',{required:true,min:1}),numbers('terminatedPerEnd','Strands to terminate per end',{required:true}),
 ['endA','Termination at end A',{required:true}],['endB','Termination at end B',{required:true}],
 ['testing','Testing and labeling requirements',{required:true}],numbers('hours','Estimated total tech-hours',{required:true,min:0.01})
];
const sharedFields=[
 ['label','Shared cost description',{required:true}],['requirements','Requirements / delivery or pickup details'],
 ['rateMode','Scissor lift rate method',{select:[['flat','Flat quote'],['daily','Daily rate + delivery / pickup']]}],
 numbers('flat','Flat quoted cost',{value:'0'}),numbers('days','Number of rental days',{min:1,value:'1'}),numbers('daily','Daily rental cost',{value:'0'}),
 numbers('delivery','Delivery cost',{value:'0'}),numbers('pickup','Pickup cost',{value:'0'}),numbers('markup','Shared cost markup (%)',{required:true,value:'0'})
];
function edit(estimate,{revisionOf}={}){
 const rows=draftRows(estimate||revisionOf);
 const origin=estimate||revisionOf;
 let scopes=structuredClone(origin?.scopes||[]),dirtyScopes=false;
 let appliedProject=origin?.projectId||'';

 let quote=null, appliedClient=origin?.clientId||'', appliedProfile=origin?.pricingProfileId||'';
 let pending=0, requestCounter=0;
 const allowOverride=can('estimate.override');
 const options=[['','Select billing client'],...data.customers.map(client=>[client.id,billingName(client)])];
 modal(estimate?'Edit estimate':revisionOf?'Draft estimate revision':'Create Estimate',
  '<h3>1. Client and project</h3><div class="estimate-header">'+f('clientId','Billing client',{required:true,select:options,value:appliedClient})+
  (can('customer.create')&&!revisionOf?`<details><summary>+ New billing client</summary>${f('newClientName','Client name')}${f('newClientEmail','Billing email',{type:'email'})}${f('newClientPhone','Phone')}${f('newClientAddress','Billing address')}<button type="button" class="secondary" data-new-est-client>Create and link client</button></details>`:'')+
  f('projectId','Project',{select:[['','Select project']]})+
  (can('project.create')&&!revisionOf?`<details><summary>+ New project</summary>${f('newProjectName','Project name')}${f('newProjectSite','Jobsite')}<button type="button" class="secondary" data-new-est-project>Create and link project</button></details>`:'')+
  f('pricingProfileId','Pricing profile',{select:[['','Client default']]})+
  '<p id="estimateBilling" class="muted"></p>'+f('title','Estimate title',{required:true,value:origin?.title})+
  f('site','Jobsite',{value:origin?.site})+f('contactId','Job contact',{select:contactOptions(customer(appliedClient)),value:origin?.contactId})+
  f('po','Client PO',{value:origin?.po})+'</div>'+f('scope','Scope of work',{required:true,textarea:true,value:origin?.scope})+
  f('options','Included options',{textarea:true,value:origin?.options})+f('exclusions','Exclusions',{textarea:true,value:origin?.exclusions})+
  '<section class="estimate-items"><h3>2. Job scopes</h3><p>Add one or more Copper and Fiber sections. Add shared costs once. Select matching catalog items or manually price the takeoff rows.</p><div class="actions">'+
  Object.entries(scopeLabels).map(([kind,label])=>`<button type="button" class="secondary small" data-add-job-scope="${kind}">Add ${label}</button>`).join('')+
  '</div><div id="guidedScopes"></div><button type="button" class="secondary small" id="calculateScope">Build / refresh takeoff</button>'+
  '<h3>3. Review pricing and line items</h3><div class="actions">'+Object.entries(types).filter(([key])=>key!=='custom'||allowOverride).map(([key,label])=>
   '<button type="button" class="secondary small" data-estimate-add="'+key+'">Add '+label+'</button>').join('')+'</div>'+
  '<p id="estimateRateSource" aria-live="polite"></p><div id="estimateRatePreview"></div><div id="estimateLines"></div>'+
  '<div class="estimate-total" aria-live="polite"><strong>Estimate total</strong><strong id="estimateTotal"></strong></div></section>',
  fields=>{
   if(pending||!quote)throw Error('Load the client pricing first');
   if(form.querySelector('#estimateRatePreview').childElementCount)throw Error('Apply or cancel the pricing preview first');
   if(dirtyScopes)throw Error('Build or refresh the takeoff before saving');
   if(rows.some(row=>row.type!=='custom'&&!row.catalogId))throw Error('Select an item or remove the unfinished line');
   return send(estimate?'estimate.update':'estimate.create',{clientId:fields.clientId||appliedClient,projectId:fields.projectId||appliedProject,pricingProfileId:fields.pricingProfileId,contactId:fields.contactId,title:fields.title,site:fields.site,po:fields.po,scope:fields.scope,options:fields.options,exclusions:fields.exclusions,id:estimate?.id,revision:estimate?.revision,basedOnId:revisionOf?.id,scopes,lines:rows});
  });
 const form=document.querySelector('#actionForm');
 const box=form.querySelector('#estimateLines');
 const scopesBox=form.querySelector('#guidedScopes');
 const scopeControl=(s,key,label,options={})=>f(`scope_${s.key}_${key}`,label,{...options,required:false,value:s[key]??options.value});
 const readScopes=()=>{for(const input of scopesBox.querySelectorAll('input,select,textarea')){
  const section=input.closest('[data-job-scope]'),s=scopes.find(item=>item.key===section.dataset.jobScope);
  s[input.name.slice(('scope_'+s.key+'_').length)]=input.value;
 }};
 const scopesDrawing=()=>{
  scopesBox.innerHTML=scopes.map(s=>{
   const fieldList=s.kind==='copper'?copperFields:s.kind==='fiber'?fiberFields:s.kind==='lift'?sharedFields:sharedFields.filter(([k])=>!['rateMode','days','daily','delivery','pickup'].includes(k));
   const catalogKeys=s.kind==='copper'?[['cableId','Cable box','material'],['jackId','Compatible jack','material'],['plateId','Faceplate','material'],['panelId','Patch panel','material'],['laborId','Copper labor','labor']]:
    s.kind==='fiber'?[['fiberId','Fiber sold by foot','material'],['terminationAId','End A connection','material'],['terminationBId','End B connection','material'],['laborId','Fiber labor','labor']]:[];
   return `<fieldset class="estimate-line" data-job-scope="${esc(s.key)}"><legend>${scopeLabels[s.kind]}</legend>${fieldList.map(([k,label,opts])=>scopeControl(s,k,label,opts)).join('')}
    ${catalogKeys.map(([k,label,type])=>scopeControl(s,k,label,{select:[['','No catalog match / manual pricing'],...(quote?.items||[]).filter(i=>i.type===type&&(k!=='cableId'||/^(box(?:es)?|reels?|spools?)$/i.test(i.unit))&&(k!=='fiberId'||/^(ft|feet|foot)$/i.test(i.unit))).map(i=>[i.id,i.name+' · '+i.unit])]})).join('')}
    ${s.kind==='copper'||s.kind==='fiber'?scopeControl(s,'options','Included options')+scopeControl(s,'exclusions','Exclusions'):''}
    <button type="button" class="secondary small" data-remove-job-scope>Remove scope</button></fieldset>`;
  }).join('');
 };
 const projectsFor=(clientId, selectId)=>{
  const options=[new Option('Select a project', ''),...(data.projects||[]).filter(item=>item.customerId===clientId).map(item=>new Option([item.number,item.name].filter(Boolean).join(' · '),item.id))];
  form.elements.projectId.replaceChildren(...options);form.elements.projectId.value=selectId||'';
 };
 const applyProject=(id)=>{
  appliedProject=id;
  const project=(data.projects||[]).find(item=>item.id===id);
  if(project){form.elements.title.value ||= project.name;form.elements.site.value ||= project.site||'';form.elements.po.value ||= project.po||'';if(project.contactId)form.elements.contactId.value=project.contactId;}
 };
 projectsFor(appliedClient,appliedProject);
 if(revisionOf){form.elements.clientId.disabled=true;form.elements.projectId.disabled=true;}
 form.elements.projectId.addEventListener('change',()=>applyProject(form.elements.projectId.value));
 const makeClient=form.querySelector('[data-new-est-client]');
 if(makeClient)makeClient.onclick=async()=>{
  try{makeClient.disabled=true;const obj=await send('customer.create',{name:form.elements.newClientName.value,email:form.elements.newClientEmail.value,phone:form.elements.newClientPhone.value,address:form.elements.newClientAddress.value});
   form.elements.clientId.add(new Option(billingName(obj),obj.id));form.elements.clientId.value=obj.id;form.elements.pricingProfileId.value='';makeClient.closest('details').open=false;await loadQuote();}
  catch(error){show(error.message,true);}finally{makeClient.disabled=false;}
 };
 const makeProject=form.querySelector('[data-new-est-project]');
 if(makeProject)makeProject.onclick=async()=>{
  try{makeProject.disabled=true;const obj=await send('project.create',{customerId:form.elements.clientId.value,name:form.elements.newProjectName.value,site:form.elements.newProjectSite.value});
   projectsFor(form.elements.clientId.value,obj.id);applyProject(obj.id);makeProject.closest('details').open=false;}
  catch(error){show(error.message,true);}finally{makeProject.disabled=false;}
 };
 scopesBox.addEventListener('input',()=>{readScopes();dirtyScopes=true;});
 scopesBox.addEventListener('click',event=>{const trigger=event.target.closest('[data-remove-job-scope]');if(!trigger)return;
  readScopes();scopes=scopes.filter(s=>s.key!==trigger.closest('[data-job-scope]').dataset.jobScope);dirtyScopes=true;scopesDrawing();
 });
 for(const trigger of form.querySelectorAll('[data-add-job-scope]'))trigger.onclick=()=>{
  readScopes();const kind=trigger.dataset.addJobScope;
  if(scopes.length>=12||kind==='lift'&&scopes.some(s=>s.kind==='lift'))return show('Use up to 12 scopes and only one shared scissor lift',true);
  scopes.push({kind,key:'section-'+globalThis.crypto.randomUUID(),label:kind==='lift'?'Scissor lift':''});
  dirtyScopes=true;scopesDrawing();
 };
 form.querySelector('#calculateScope').onclick=()=>{
  try{
   if(!quote||pending)throw Error('Choose a billing client first');
   readScopes();const finalized=normalizeEstimateScopes(scopes);
   const next=scopeLines(finalized).map(line=>{
    const rate=quote.items.find(item=>item.id===line.catalogId);
    return {...line,itemName:rate?.name,unit:rate?.unit,rate:rate?rate.rate:line.rate,rateSource:rate?quote.profileName:''};
   });
   const kept=rows.filter(line=>!line.scopeKey);
   if(kept.length+next.length>100)throw Error('Use up to 100 estimate lines');
   scopes=finalized;rows.splice(0,rows.length,...kept,...next);dirtyScopes=false;draw();
  }catch(error){show(error.message,true);}
 };

 const modalBox=form.closest('.modal-box')||form.parentElement;
 modalBox.classList.add('estimate-editor');
 form.querySelector('[type=submit]').textContent='Save draft';
 const rateSource=form.querySelector('#estimateRateSource');
 const preview=form.querySelector('#estimateRatePreview');
 const save=form.querySelector('[type=submit]');
 const total=()=>{
  const missing=rows.filter(line=>line.rate==null||line.rate===''||!line.catalogId&&line.type!=='custom').length;
  form.querySelector('#estimateTotal').textContent=fmt(rows.reduce((sum,line)=>sum+Math.round(Number(line.quantity)*Number(line.rate)*100)/100,0))+
   (missing?' · '+missing+' need pricing or an item':'');
 };
 const catalogById=new Map((data.catalog||[]).map(item=>[item.id,item]));
 const details=item=>catalogById.get(item.id)||item;
 const detailsFor=id=>catalogById.get(id)||quote?.items?.find(item=>item.id===id);
 const categories=()=>[...new Set((quote?.items||data.catalog||[]).filter(item=>item.type==='material').map(item=>partCategory(details(item))))].sort((a,b)=>a.localeCompare(b));
 const draw=()=>{
  box.innerHTML=rows.map((line,index)=>`<fieldset class="estimate-line" data-estimate-row="${index}"><legend>${types[line.type]||'Custom line'} ${index+1}</legend>
   ${line.type!=='custom'?`<div class="estimate-picker"><label>Find ${types[line.type]?.toLowerCase()||'item'}<input type="search" autocomplete="off" data-item-search placeholder="Name, brand, part # or SKU" value="${esc(line.itemName||'')}"></label>${line.type==='material'?`<label>Category<select data-item-category><option value="">All categories</option>${categories().map(value=>`<option>${esc(value)}</option>`).join('')}</select></label>`:''}${line.catalogId?photoThumbnail(detailsFor(line.catalogId)):''}<div data-item-results></div></div>`:''}
   <label>Description<input data-line-field="description" value="${esc(line.description)}"></label>
   <label>${line.unit==='hr'?'Hours':'Quantity'}<input type="number" min="0.001" step="any" data-line-field="quantity" value="${esc(line.quantity??1)}"></label>
   <label>Rate ${esc(line.unit||'')}<input type="number" min="0" step="0.01" data-line-field="rate" value="${esc(line.rate??'')}" ${allowOverride?'':'readonly'}></label>
   <div><b>Amount</b><p data-line-amount>${line.rate==null||line.rate===''?'Needs rate':fmt(Number(line.quantity)*Number(line.rate))}</p>
   <small data-line-source>${line.override?'Manual rate':esc(line.rateSource||'')}</small></div>
   <button type="button" class="secondary small" data-remove-estimate-line>Remove</button></fieldset>`).join('');
  total();
 };
 const syncOptions=()=>{
  form.elements.pricingProfileId.replaceChildren(new Option('Client / company default',''),
   ...((quote?.profiles||[]).map(profile=>new Option(profile.name,profile.id))));
  form.elements.pricingProfileId.value=appliedProfile;
  const payer=customer(appliedClient);
  form.querySelector('#estimateBilling').textContent=[payer?.address,payer?.email].filter(Boolean).join(' · ');
  rateSource.textContent=quote?'Rates · '+quote.profileName:'Select a billing client to load rates.';
  save.disabled=!quote;
 };
 async function loadQuote(initial=false){
  const clientId=form.elements.clientId.value, profileId=initial?appliedProfile:form.elements.pricingProfileId.value;
  const request=++requestCounter;pending=request;
  save.disabled=true;preview.replaceChildren();
  if(!clientId){quote=null;pending=0;syncOptions();return;}
  try{
   const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'estimate.rates',data:{clientId,pricingProfileId:profileId}})});
   const body=await response.json();
   if(request!==pending)return;
   if(!response.ok)throw Error(body.error||'Could not load rates');
   const next=body.result;
   const apply=()=>{
    if(clientId!==appliedClient){
     appliedProject='';projectsFor(clientId,'');
     const payer=customer(clientId);
     form.elements.contactId.replaceChildren(...contactOptions(payer).map(([id,name])=>new Option(name,id)));
     if(payer?.contacts?.some(contact=>contact.id===payer.defaultContactId))form.elements.contactId.value=payer.defaultContactId;
    }
    readScopes();quote=next;appliedClient=clientId;appliedProfile=profileId;scopesDrawing();
    rows.forEach(row=>{
     const item=quote.items.find(item=>item.id===row.catalogId);
     if(item){
      row.itemName=item.name;row.type=item.type;row.unit=item.unit;
      if(!initial&&!row.override)row.rate=item.rate;
      row.rateSource=quote.profileName;
     }
    });
    preview.replaceChildren();syncOptions();draw();
   };
   if(initial||!rows.some(row=>row.catalogId)){apply();return;}
   const changes=rows.filter(row=>row.catalogId&&!row.override).map(row=>{
    const item=next.items.find(item=>item.id===row.catalogId);
    return {name:row.description,before:row.rate,after:item?.rate??null};
   }).filter(row=>row.before!==row.after);
   preview.innerHTML='<p>Review rates for '+esc(next.profileName)+'. Manual rates are kept.</p>'+
    (changes.length?table(['Item','Before','After'],changes.map(change=>'<tr><td>'+esc(change.name)+'</td><td>'+
     (change.before==null?'Needs rate':fmt(change.before))+'</td><td>'+(change.after==null?'Needs rate':fmt(change.after))+'</td></tr>')):'<p>No line rates change.</p>')+
    '<button type="button" class="primary" data-apply-rates>Apply pricing</button> <button type="button" class="secondary" data-cancel-rates>Cancel</button>';
   preview.querySelector('[data-apply-rates]').onclick=apply;
   preview.querySelector('[data-cancel-rates]').onclick=()=>{
    form.elements.clientId.value=appliedClient;preview.replaceChildren();syncOptions();
   };
  }catch(error){
   if(request!==pending)return;
   form.elements.clientId.value=appliedClient;syncOptions();show(error.message,true);
  }finally{if(request===pending)pending=0;}
 }
 form.elements.clientId.addEventListener('change',()=>{form.elements.pricingProfileId.value='';loadQuote();});
 form.elements.pricingProfileId.addEventListener('change',()=>loadQuote());
 for(const add of form.querySelectorAll('[data-estimate-add]'))add.onclick=()=>{
  if(!quote||pending||preview.childElementCount){show('Select a client and apply pricing first',true);return;}
  if(rows.length>=100)return;
  rows.push({type:add.dataset.estimateAdd,quantity:1,rate:null});draw();
  box.lastElementChild.querySelector('input')?.focus();
 };
 function showMatches(element,row){
  const query=element.querySelector('[data-item-search]')?.value||'';
  const category=element.querySelector('[data-item-category]')?.value||'';
  element.querySelector('[data-item-results]').innerHTML=(quote?.items||[]).filter(item=>item.type===row.type&&
   partSearch(details(item),query)&&(!category||partCategory(details(item))===category)).slice(0,10).map(item=>
    '<div class="bci-estimate-match">'+photoThumbnail(details(item))+'<button type="button" class="secondary small" data-select-item="'+esc(item.id)+'">'+esc([item.name,partMeta(details(item))].filter(Boolean).join(' · '))+' · '+(item.rate==null?'Pricing needed':fmt(item.rate))+'</button></div>').join('')||'<p class="muted tiny" role="status">No matching items.</p>';
 }
 box.addEventListener('change',event=>{
  if(!event.target.hasAttribute('data-item-category'))return;
  const element=event.target.closest('[data-estimate-row]');
  showMatches(element,rows[Number(element.dataset.estimateRow)]);
 });
 box.addEventListener('input',event=>{
  const input=event.target,element=input.closest('[data-estimate-row]');
  if(!element)return;
  const row=rows[Number(element.dataset.estimateRow)];
  if(input.hasAttribute('data-item-search')){showMatches(element,row);return;}
  if(!input.hasAttribute('data-line-field'))return;
  const field=input.dataset.lineField;
  row[field]=input.value;
  if(field==='rate'){row.override=true;element.querySelector('[data-line-source]').textContent='Manual rate';}
  element.querySelector('[data-line-amount]').textContent=row.rate==null||row.rate===''?'Needs rate':fmt(Number(row.rate)*Number(row.quantity));
  total();
 });
 box.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||(!button.hasAttribute('data-remove-estimate-line')&&!button.hasAttribute('data-select-item')))return;
  const index=Number(button.closest('[data-estimate-row]').dataset.estimateRow);
  if(button.hasAttribute('data-remove-estimate-line'))rows.splice(index,1);
  else{
   const item=quote?.items.find(item=>item.id===button.dataset.selectItem);
   if(!item)return;
   Object.assign(rows[index],{catalogId:item.id,itemName:item.name,description:item.name,unit:item.unit,rate:item.rate,override:false,rateSource:quote.profileName});
  }
  draw();
  if(button.dataset.selectItem)box.children[index]?.querySelector('[data-line-field=quantity]')?.focus();
 });
 scopesDrawing();draw();
 loadQuote(true);
}

document.addEventListener('click',event=>{
 const control=event.target.closest('[data-estimate-action]');
 if(!control||!can('estimates.view'))return;
 const {estimateAction:action,estimateId}=control.dataset;
 const estimate=(data.estimates||[]).find(item=>item.id===estimateId);
 if(action==='new'&&can('estimate.create'))return practiceMode?edit():startEstimate();
 if(action==='release'&&can('estimate.releaseWorkOrder')&&can('workorder.approve')&&can('workorders.view'))
  return modal('Release estimate work order','<p>Release the signed scope for the crew. This does not place purchases or send email.</p>',()=>send('estimate.releaseWorkOrder',{workorderId:estimateId}));
 if(!estimate)return;
 if(action==='workspace'&&estimate.workflow&&!practiceMode)return startEstimate(estimate.id);
 if(action==='revise'&&can('estimate.create')&&estimate.approvalSnapshot)return edit(undefined,{revisionOf:estimate});
 if(action==='sign'&&can('estimate.accept')){
  modal('Sign estimate '+estimate.number,'<p class="ticket-text">'+esc(estimate.scope)+'</p>'+estimateScopeDetails(estimate)+linesTable(estimate)+'<p><b>Total '+fmt(estimate.total)+'</b></p>'+
   f('acceptedBy','Customer approver',{required:true})+`<label for="estimateSignature">Draw your signature</label><canvas id="estimateSignature" class="sign-canvas" width="440" height="160" aria-label="Signature drawing area"></canvas>
   <button type="button" class="secondary small" id="clearSig">Clear signature</button><label class="signature-terms"><input type="checkbox" name="consent" required> I approve this estimate, its included options, exclusions, and price as shown above.</label>`,
   fields=>send('estimate.accept',{...fields,id:estimate.id,revision:estimate.revision}));
  return initSignature();
 }
 if(action==='email'&&(can('estimate.create')||can('estimate.update'))&&estimate.billingEmail){
  const subject=encodeURIComponent('BCI ELITE estimate '+estimate.number+' · '+estimate.title);
  const body=encodeURIComponent('Please see the attached BCI ELITE estimate for '+estimate.title+'.');
  return modal('Prepare estimate email','<p>Save the estimate with Print / PDF, then attach the PDF to the email draft. Nothing is sent automatically.</p>',()=>{window.location.href='mailto:'+encodeURIComponent(estimate.billingEmail)+'?subject='+subject+'&body='+body;});
 }
 if(action==='edit'&&can('estimate.update'))return edit(estimate);
 if(action==='accept'&&can('estimate.accept'))return modal('Record client acceptance',
  f('acceptedBy','Client approver',{required:true})+f('evidence','Approval reference or email date',{required:true,textarea:true}),
  fields=>send('estimate.accept',{...fields,id:estimate.id,revision:estimate.revision}));
 if(action==='convert'&&can('estimate.convert'))return modal('Create project from estimate',
  f('title','Project name',{required:true,value:estimate.title})+f('site','Jobsite',{value:estimate.site})+
  f('contactId','Job contact',{select:contactOptions(customer(estimate.clientId)),value:estimate.contactId})+
  f('po','Client PO (optional)',{value:estimate.po}),async fields=>{
   const project=await send('estimate.convert',{...fields,id:estimate.id});
   document.dispatchEvent(new CustomEvent('bci:open-project',{detail:project.id}));
  },
  '<p>Pricing · '+esc(estimate.pricingProfileName||'Client default')+'</p>');
 if(action==='print')return printDocument(estimateDocument(estimate));
});

function estimateScopeDetails(estimate){
 const sections=(estimate.scopes||[]).map(section=>{
  const description=section.kind==='copper'?`${section.drops} ${section.category} ${section.cableType} drops, average ${section.avgLength} ft · ${section.jack} · run, terminate, test and label.`:
    section.kind==='fiber'?`${section.strands}-strand ${section.fiberType}, ${section.length} ft via ${section.route}. End A: ${section.endA}. End B: ${section.endB}. Test and label: ${section.testing}.`:section.requirements;
  return `<div><b>${esc(section.label||scopeLabels[section.kind])}</b><p>${esc(description)}</p>${section.options?`<p>Included: ${esc(section.options)}</p>`:''}${section.exclusions?`<p>Excluded: ${esc(section.exclusions)}</p>`:''}</div>`;
 }).join('');
 return sections+(estimate.options?`<p>Included options: ${esc(estimate.options)}</p>`:'')+
  (estimate.exclusions?`<p>Exclusions: ${esc(estimate.exclusions)}</p>`:'');
}
export function estimateDocument(estimate){
 const doc=estimate.approvalSnapshot||estimate;
 return `<article class="invoice-sheet"><div class="invoice-brand"><img src="/logo.png" alt="BCI ELITE" width="82" height="82"><h1>ESTIMATE · ${esc(doc.number)}</h1></div>
  <div class="invoice-accent"></div><h2>${esc(doc.title)}</h2><p>${esc(doc.billingName)} · ${esc(doc.site)}</p>
  ${doc.billingAddress?`<p>${esc(doc.billingAddress)}</p>`:''}<p class="ticket-text">${esc(doc.scope)}</p>${estimateScopeDetails(doc)}${linesTable(doc)}
  <p><b>Estimated total ${fmt(doc.total)}</b></p>${doc.acceptedBy?`<p><b>Accepted by ${esc(doc.acceptedBy)} · ${esc(doc.acceptedAt)}</b></p>
  ${/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(doc.signatureData||'')?`<img class="signed-image" src="${esc(doc.signatureData)}" alt="Customer signature">`:''}`:''}</article>`;
}
