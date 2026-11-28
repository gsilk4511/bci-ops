import {data,can,me,esc,fmt,head,render,send,show,billingName,customer,modal,f,printDocument,initSignature} from '../app.js';
import {trades,methods,presets,questions,siteQuestions,taskNames,newDraft,newScope,getAnswer,takeoffGroups} from './estimator-engine.js';

let opening=false, draft=null, active='', step='site', index=0, mode='guided', dirty=false, saving=false, problem='', quote=null, doc=null, imported=null, admin=null, acknowledged=false, askDelete='';
const query=()=>window.location?.search?new URLSearchParams(window.location.search).get('estimate'):null;
const button=(action,label,extra='',primary=false)=>`<button type="button" class="${primary?'primary':'secondary'}" data-ew="${action}" ${extra}>${esc(label)}</button>`;
const attr=(key,value)=>`data-${key}="${esc(value)}"`;
const option=(v,label,selected)=>`<option value="${esc(v)}" ${String(selected??'')===String(v)?'selected':''}>${esc(label)}</option>`;
const control=(path,label,value,{choices,type='text',long=false,placeholder='',disabled=false,step='any',min=0}={})=>`<label class="ew-field"><span>${esc(label)}</span>${choices?`<select data-ew-field="${esc(path)}" ${disabled?'disabled':''}>${choices.map(x=>option(x[0],x[1],value)).join('')}</select>`:long?`<textarea data-ew-field="${esc(path)}" maxlength="3000" placeholder="${esc(placeholder)}" ${disabled?'disabled':''}>${esc(value??'')}</textarea>`:`<input data-ew-field="${esc(path)}" type="${type}" ${type==='number'?`step="${step}" min="${min}" inputmode="decimal"`:''} ${disabled?'disabled':''} value="${esc(value??'')}" placeholder="${esc(placeholder)}"></label>`}${choices||long?'</label>':''}`;
const checkbox=(path,label,checked)=>`<label class="ew-check"><input type="checkbox" data-ew-field="${esc(path)}" ${checked?'checked':''}> ${esc(label)}</label>`;
const editAllowed=()=>draft?.id?can('estimate.update'):can('estimate.create');
const pricingAllowed=()=>can('estimate.override');
const root=()=>document.querySelector('[data-estimator-workspace]');
const byScope=()=>draft?.workflow?.scopes?.find(s=>s.id===active);
const snapshot=()=>data?.estimates?.find(x=>x.id===query());
const choices=values=>[['','Choose…'],...values.map(x=>[x,x])];
const setView=(id)=>{const u=new URL(location.href);if(id)u.searchParams.set('estimate',id);else u.searchParams.delete('estimate');history.replaceState(null,'',u);};
const cleanstate=()=>{draft=null;active='';step='site';index=0;mode='guided';dirty=false;saving=false;problem='';quote=null;doc=null;imported=null;admin=null;askDelete='';};
export function startEstimate(id='new'){
 cleanstate();opening=true;setView(id);render();opening=false;
}
export function guardEstimateNavigation(){
 if(!root()||!dirty||confirm('Leave this workspace with unsaved estimate changes?'))return true;
 return false;
}
async function call(action,data,endpoint='/api/action'){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});
 const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error||'Could not load estimate information');return b.result;
}
function defaults(){
 const live=snapshot();
 if(draft&&draft.id===live?.id)return;
 if(draft&&query()==='new'&&!draft.id)return;
 if(live?.workflow){
  draft=structuredClone({id:live.id,revision:live.revision,clientId:live.clientId,projectId:live.projectId,pricingProfileId:live.pricingProfileId,contactId:live.contactId,
   title:live.title,site:live.site,po:live.po,scope:live.scope,options:live.options,exclusions:live.exclusions,workflow:live.workflow});
  step=live.status!=='Draft'?'review':live.workflow.path?(live.workflow.scopes?.length?'review':'site'):'path';
  active=live.workflow.scopes?.[0]?.id||'';index=0;
  if(live.status==='Draft')scheduleRates();
 }else if(query()==='new'&&can('estimate.create')){
  draft={clientId:'',projectId:'',contactId:'',title:'',site:'',scope:'',workflow:newDraft()};step='intake';
 }else draft=null;
}
const available=()=>data?.customers||[];
const clientRow=()=>customer(draft?.clientId);
const proj=()=>data?.projects?.find(p=>p.id===draft?.projectId);
function selectProject(e){const p=proj();if(!p)return;for(const [k,v] of Object.entries({title:p.name,site:p.site,po:p.po,contactId:p.contactId}))if(v&&!draft[k])draft[k]=v;}
function scheduleRates(){
 const key=[draft?.clientId,draft?.pricingProfileId||'',draft?.projectId||''].join('|');
 if(!draft?.clientId||quote?.key===key)return;
 quote={key,items:[],profiles:[],loading:true};
 call('estimate.rates',{clientId:draft.clientId,pricingProfileId:draft.pricingProfileId||'',projectId:draft.projectId||''}).then(r=>{
  if(quote?.key===key){quote={...r,key};if(['pricing','review','intake'].includes(step)&&root()&&!root().contains(document.activeElement))render();}
 }).catch(e=>{if(quote?.key===key){quote={key,items:[],profiles:[],error:e.message};if(root())render();}});
}
function intake(){
 const clients=[['','Select billing client'],...available().map(c=>[c.id,billingName(c)])];
 const projs=[['','Select project'],...(data?.projects||[]).filter(p=>p.customerId===draft.clientId).map(p=>[p.id,[p.number,p.name].filter(Boolean).join(' · ')])];
 return `<h2>Client and site</h2><div class="ew-grid">
 ${control('clientId','Billing client',draft.clientId,{choices:clients,disabled:Boolean(draft.id)})}
 ${!draft.id&&can('customer.create')?button('new-client','+ New billing client'):''}
 ${control('projectId','Project',draft.projectId,{choices:projs,disabled:Boolean(draft.id)})}
 ${!draft.id&&can('project.create')&&draft.clientId?button('new-project','+ New project'):''}
 ${control('contactId','Primary job contact',draft.contactId,{choices:[['','No contact selected'],...(clientRow()?.contacts||[]).map(c=>[c.id,c.name])]})}
 ${can('contact.create')&&draft.clientId?button('new-contact','+ New contact'):''}
 ${control('pricingProfileId','Pricing profile',draft.pricingProfileId,{choices:[['','Client default'],...(quote?.profiles||[]).map(p=>[p.id,p.name])]})}
 ${control('title','Estimate name',draft.title)}${control('site','Jobsite',draft.site)}${control('po','Purchase order (optional)',draft.po)}
 </div><div class="actions">${button('save-intake','Save & Build Estimate','',true)}</div>`;
}
function pathPanel(){return `<h2>How are you measuring this job?</h2><div class="ew-tiles">
 <button type="button" data-ew="path" data-value="plan"><strong>Plan Takeoff</strong><span>I have drawings</span></button>
 <button type="button" data-ew="path" data-value="walkthrough"><strong>Site Walkthrough</strong><span>I’m onsite</span></button></div>
 <p class="muted">You can mix drawing counts and field measurements later.</p>`;}
function question(q,base,answers){
 const ans=answers?.[q.key],k=base+'.'+q.key+'.value';
 const input=q.choices?`<div class="ew-tiles">${q.choices.map(v=>`<button type="button" data-ew="answer" ${attr('question',k)} ${attr('value',v)} aria-pressed="${ans?.value===v}">${esc(v)}</button>`).join('')}</div>`:control(k,q.number?q.unit||'Quantity':'Your answer',ans?.value,{type:q.number?'number':'text',long:q.long,min:q.min??0,step:q.integer?1:'any'});
 return `<section class="ew-question"><h2>${esc(q.label)}</h2>${input}
 <p class="muted">${ans?.mode==='later'?'Answer later · flagged for review':ans?.mode==='none'?'Marked not needed':ans?.mode==='suggested'?'Using suggested value':q.required?'Required for this scope':'Optional; leave blank if it does not affect the scope.'}</p>
 <div class="actions">${button('mark-none','Not needed',attr('question',k))}${q.suggest!==undefined?button('suggest','Use suggested: '+q.suggest,attr('question',k)):''}${button('later','Answer later',attr('question',k))}</div></section>`;
}
function stepControls(total){
 return `<div class="actions ew-next">${button('prev','Back')}${button('next',mode==='all'||index>=total-1?'Continue':'Save & Next','',true)}${button('mode',mode==='all'?'One at a time':'Edit all answers')}</div>`;
}
function scopeQs(s){return questions[s.kind].filter(q=>!(s.kind==='copper'&&s.preset==='Test / label existing'&&['length','longest','slack','waste','box','cable','ends','plates','panels'].includes(q.key))&&!(s.kind==='fiber'&&s.preset==='New preterminated'&&['endsA','endsB'].includes(q.key)));}
function questionsPanel(s){
 const qs=s?scopeQs(s):siteQuestions,base=s?'group.answers':'workflow.site',obj=s?s.answers:draft.workflow.site;
 const items=mode==='all'?qs:[qs[Math.min(Math.max(0,index),qs.length-1)]];
 return `${s?`<div class="ew-grid">${control('group.label','Scope label',s.label)}${control('group.area','Area / route group',s.area)}${control('group.preset','Preset',s.preset,{choices:choices(presets[s.kind])})}</div>`:''}
 ${items.map(q=>question(q,base,obj)).join('')}${stepControls(qs.length)}`;
}
function addPanel(){return `<h2>What are we quoting?</h2><div class="ew-tiles">${Object.entries(trades).map(([k,name])=>button('add',name,attr('kind',k))).join('')}</div>`;}
function pricing(s){
 const p=s.pricing, items=quote?.items||[], material=items.filter(x=>x.type==='material'),labor=items.filter(x=>x.type==='labor');
 const unit=s.kind==='access'?'opening':s.kind==='copper'?'cable':'unit';const ma=pricingAllowed();
 const picker=(k,l,list,current)=>`<label class="ew-field"><span>${esc(l)}</span><input type="search" placeholder="Filter by name or SKU" data-ew-filter="${esc(k)}"><select data-ew-field="${esc(k)}" data-ew-select="${esc(k)}">${option('','No match selected',current)}${list.filter(i=>i.id===current).map(i=>option(i.id,i.name+' · '+i.unit,current)).join('')}</select></label>`;
 const num=(p,l,v)=>control(p,l,v,{type:'number',disabled:!ma});
 const linked=s.kind==='copper'?['cable','jack','plate','panel']:s.kind==='fiber'?['cable','splice']:[];
 const cx=liveCalc()?.scoped?.find(g=>g.key===s.id);
 return `<h2>${esc(s.label||trades[s.kind])} · Labor, materials & price</h2>
 <p class="muted">${esc(quote?.loading?'Loading catalog…':quote?.error||'Pricing profile: '+(quote?.profileName||'client default'))}</p>${button('reload-price','Reload catalog')}
 <div class="ew-grid">
 ${control('group.role','Include this scope as',s.role,{choices:[['base','Base scope'],['option','Optional'],['excluded','Excluded from agreement']]})}
 ${s.role==='option'?checkbox('group.selected','Include this option',s.selected)+control('group.optionGroup','Mutually exclusive group (e.g. display)',s.optionGroup):''}
 ${s.kind==='shared'?control('group.resourceKey','Shared resource reference (same lift or trip only once)',s.resourceKey):''}
 ${control('group.source','Measurement source / plan note',s.source)}
 ${control('group.notes','Included work or notes for the agreement',s.notes,{long:true})}
 ${control('group.exclusions','Scope exclusions',s.exclusions,{long:true})}</div>
 ${s.kind!=='shared'?`<details><summary>Area conditions override</summary><div class="ew-grid">${siteQuestions.map(q=>control('group.conditions.'+q.key+'.value',q.label,getAnswer(s.conditions,q.key),{choices:q.choices?choices(q.choices):undefined,type:q.number?'number':'text',placeholder:'Use job default'})).join('')}</div></details>
 <h3>Labor plan</h3>${checkbox('group.noLabor','No BCI labor in this scope',s.noLabor)}
 <div class="ew-grid">${control('group.laborMode','Labor source',s.laborMode||'manual',{choices:[['manual','Manual task hours'],['rules','Use released rules, override below']]})}
 ${control('group.laborBasis','Entered hours are',s.laborBasis||'person',{choices:[['person','Person-hours'],['crew','Crew-hours']]})}${control('group.crew','Crew size',s.crew||1,{type:'number',min:1,step:1})}
 ${Object.entries(taskNames).map(([k,l])=>control('group.labor.'+k,l,s.labor?.[k],{type:'number'})).join('')}
 ${picker('group.laborItem','Labor service rate',labor,s.laborItem)}
 ${num('group.laborRate','Manual sell rate (without catalog service)',s.laborRate)}
 ${can('finance.view')?control('group.laborUnitCost','Internal cost per person-hour (override)',s.laborUnitCost,{type:'number'}):''}
 ${control('group.laborRateUnit','Manual sell-rate unit',s.laborRateUnit||'person',{choices:[['person','Per person-hour'],['crew','Per crew-hour']]})}</div>`:''}
 ${linked.length?`<h3>Calculated material matches</h3>${checkbox('group.skipDerived','Use manual material list instead of calculated suggestions',s.skipDerived)}
 <div class="ew-grid">${linked.map(k=>picker('group.matches.'+k,k.charAt(0).toUpperCase()+k.slice(1),material,s.matches[k])).join('')}</div>`:''}
 <h3>Additional materials, labor or allowances</h3>
 ${(s.items||[]).map((m,i)=>`<fieldset class="ew-box"><legend>Line ${i+1}</legend><div class="ew-grid">
 ${control('group.items.'+i+'.type','Line type',m.type||'material',{choices:Object.entries({material:'Material',labor:'Labor',travel:'Travel',custom:'Allowance / custom'})})}
 ${picker('group.items.'+i+'.catalogId','Find catalog item',items.filter(x=>x.type===(m.type||'material')),m.catalogId)}
 ${control('group.items.'+i+'.description','Description',m.description)}${control('group.items.'+i+'.qty','Quantity',m.qty,{type:'number'})}
 ${control('group.items.'+i+'.unit','Manual unit',m.unit)} ${num('group.items.'+i+'.rate','Manual sell rate',m.rate)}
 ${can('finance.view')?control('group.items.'+i+'.unitCost','Internal unit cost (override)',m.unitCost,{type:'number'}):''}
 ${checkbox('group.items.'+i+'.override','Override catalog rate',m.override)}
 ${control('group.items.'+i+'.owner','Furnished by',m.owner||'BCI',{choices:choices(['BCI','Client','Other contractor'])})}</div>
 ${button('remove-item','Remove line',attr('value',i))}</fieldset>`).join('')}
 ${button('add-item','+ Add line')}
 <h3>Customer pricing</h3><div class="ew-grid">
 ${control('group.pricing.method','Billing method',p.method,{choices:Object.entries(methods)})}
 ${['fixed','unit','rom'].includes(p.method)?num('group.pricing.rate',p.method==='unit'?'Price per unit':p.method==='rom'?'Low budget':'Fixed amount',p.rate):''}
 ${p.method==='rom'?num('group.pricing.high','High budget',p.high):''}
 ${p.method==='nte'?num('group.pricing.cap','Authorized ceiling',p.cap):''}
 ${p.method==='unit'?control('group.pricing.qty','Quantity (blank = scope count)',p.qty,{type:'number'})+control('group.pricing.unit','Unit (e.g. '+unit+')',p.unit)+
 control('group.pricing.billing','Bill quantity as',p.billing||'agreed',{choices:[['agreed','Agreed quantity'],['actual','Actual installed quantity']]})+
 control('group.pricing.includes','What is included in the unit rate?',p.includes,{long:true}):''}
 ${['tm','nte'].includes(p.method)?control('group.pricing.basis','How are labor, material, travel and equipment billed?',p.basis,{long:true}):''}</div>
 ${cx?`<p class="muted">Last saved: ${esc(Object.values(cx.taskHours).reduce((a,b)=>a+b,0).toFixed(2))} person-hours · ${fmt(cx.amount)} customer price</p>`:''}
 <div class="actions">${button('questions','Back to questions')}${button('save-review','Save & Review','',true)}${button('duplicate','Duplicate this group')}${button('remove-scope','Remove this group')}</div>
 ${askDelete===s.id?`<p class="ew-alert">Remove this scope from the draft?</p>${button('confirm-remove','Yes, remove')}${button('cancel-remove','Keep scope')}`:''}`;
}
function tick(name,on){return on?`<span class="ew-count">${esc(name)}</span>`:'';}
const liveCalc=()=>snapshot()?.workflowResult;
function review(){
 const live=snapshot(),c=liveCalc(),t=draft.workflow.terms;const frozen=live?.status!=='Draft'||!can('estimate.update');
 let allocated=c?.payments||[];
 return `<h2>${live?.status!=='Draft'?'Accepted estimate':'Review estimate'}</h2>
 <p>${dirty?'Save your latest changes to refresh these numbers.':''}</p>
 ${c?.issues?.length&&!frozen?`<section class="ew-alert"><b>Still needs attention</b><ul>${c.issues.map(x=>`<li>${esc(x.message)} ${x.scope?button('scope','Open scope',attr('value',x.scope)):''}</li>`).join('')}</ul></section>`:''}
 <div class="ew-rows">${(c?.scoped||[]).map(g=>`<section class="ew-box"><b>${esc(g.label)}</b> · ${esc(methods[g.pricing.method])} · ${fmt(g.amount)}
 ${tick(g.included?'Included':g.role==='option'?'Unselected option':'Excluded',true)} <p>${esc(g.scope)}</p>
 ${g.desc?`<p class="muted">Source: ${esc(g.desc)}</p>`:''}
 ${!frozen?button('scope','Edit scope',attr('value',g.key))+button('price-scope','Pricing',attr('value',g.key)):''}
 ${g.lines.length?`<details><summary>Internal supplies and labor (${g.lines.length})</summary><ul>${g.lines.map(l=>`<li>${esc(l.quantity+' '+l.unit+' · '+l.description+' · '+l.owner)} ${l.rate==null?'· No sell rate':''}</li>`).join('')}</ul></details>`:''}</section>`).join('')}</div>
 ${c?`<h3>${c.scoped?.some(x=>x.included&&x.pricing.method==='rom')?'Low budget':'Estimated total'} ${fmt(c.total)}</h3>
 ${can('finance.view')?`<p>Known direct cost ${fmt(c.cost)} · ${c.unknownCost?esc(c.unknownCost+' line(s) need cost; margin unavailable'):'Expected gross profit '+fmt(c.total-c.cost)}</p>`:''}`:''}
 ${allocated.length?`<p>${allocated.map(x=>esc(x.label)+' '+fmt(x.amount)).join(' · ')}</p>`:''}
 <div class="actions">${!frozen?button('go','+ Add Scope',attr('value','add'))+button('go','Edit terms',attr('value','terms'))+button('save','Save Draft'):''}
 ${button('preview','Preview Client Agreement','',true)} ${frozen&&can('estimate.create')?button('revise','Draft a revision'):''}</div>
 ${live?.workOrderChanges?.length?`<details><summary>Work-order differences</summary>${live.workOrderChanges.map(x=>`<p>${esc(x.change+' · '+x.label+' · '+x.before+' → '+x.after)}</p>`).join('')}</details>`:''}
 ${live?.generatedOrders?.length?`<h3>Generated work orders</h3>${live.generatedOrders.map(x=>`<p>${esc(x.label)} ${can('workorders.view')?`<button type="button" class="secondary" data-wo="${esc(x.id)}">Open work order</button>`:''}${can('estimate.releaseWorkOrder')&&can('workorder.approve')&&data.workorders?.some(o=>o.id===x.id&&!o.approvedAt)?button('release-order','Release to crew',attr('value',x.id)):''}</p>`).join('')}`:''}`;
}
function terms(){
 const t=draft.workflow.terms;
 return `<h2>Agreement and payment terms</h2><div class="ew-grid">${control('scope','Project overview / description',draft.scope,{long:true})}
 ${control('exclusions','Job-wide exclusions',draft.exclusions,{long:true})}${control('options','Included options note',draft.options,{long:true})}
 ${control('workflow.terms.deliverables','Deliverables and closeout',t.deliverables,{long:true})}
 ${control('workflow.terms.warranty','Warranty if included',t.warranty,{long:true})}
 ${control('workflow.terms.note','Approved payment and project terms',t.note,{long:true})}
 ${control('workflow.terms.change','Change-order terms',t.change,{long:true})}
 ${control('workflow.terms.tax','Reviewed tax amount (not automatically calculated)',t.tax,{type:'number',disabled:!pricingAllowed()})}
 ${control('workflow.packagePrice','Project fixed package (optional)',draft.workflow.packagePrice,{type:'number',disabled:!pricingAllowed()})}
 ${control('workflow.overallCap','Project not-to-exceed ceiling (optional)',draft.workflow.overallCap,{type:'number',disabled:!pricingAllowed()})}
 ${control('workflow.packageNote','What the package or ceiling covers',draft.workflow.packageNote,{long:true})}
 ${draft.basedOnId||snapshot()?.basedOnId?control('workflow.relationship','This revision is',draft.workflow.relationship,{choices:[['','Choose…'],['replacement','Replacement'],['additive','Additive change'],['credit','Credit']]})+control('workflow.reason','What changed?',draft.workflow.reason,{long:true}):''}
 ${control('workflow.terms.basis','Payment allocation',t.basis,{choices:[['percent','Percent'],['amount','Fixed dollars']]})}</div>
 ${(t.payments||[]).map((p,i)=>`<div class="ew-grid ew-box">${control('workflow.terms.payments.'+i+'.label','Milestone',p.label)}${control('workflow.terms.payments.'+i+'.value',t.basis==='amount'?'Amount':'Percent',p.value,{type:'number'})}
 ${control('workflow.terms.payments.'+i+'.due','Due (e.g. Net 15)',p.due)}${button('remove-payment','Remove milestone',attr('value',i))}</div>`).join('')}
 <div class="actions">${button('add-payment','Add a payment milestone')}${button('pay-preset','Use 15 / 35 / 50 example')}${button('save-review','Save & Review','',true)}</div>`;
}
function plans(){
 const live=snapshot();return `<h2>Plan takeoff and attachments</h2>
 <p>Use the offline BCI Takeoff Lab to count and measure PDFs, then import the reviewed Takeoff JSON here. Upload the original or marked-up PDF as a private estimate reference.</p>
 <a class="secondary" href="/estimator-tools/BCI-Takeoff-Lab.html" download>Download BCI Takeoff Lab</a>
 <div class="ew-grid"><label class="ew-field">Upload PDF (up to 10 MB)<input data-ew-pdf type="file" accept="application/pdf,.pdf"></label>
 <label class="ew-field">Import reviewed Takeoff Lab JSON<input data-ew-import type="file" accept=".json,application/json"></label></div>
 ${(live?.planFiles||[]).map(p=>{const ref=draft.workflow.plans?.findIndex(r=>r.id===p.id)??-1;
 return `<section class="ew-box"><a href="/api/estimator/plan/${encodeURIComponent(live.id)}/${encodeURIComponent(p.id)}">${esc(p.name)}</a>
 ${ref<0?button('link-plan','Include reference',attr('value',p.id)):`<div class="ew-grid">${control('workflow.plans.'+ref+'.role','Attachment role',draft.workflow.plans[ref].role,{choices:[['reference','Reference only'],['governing','Governing scope']]})}${control('workflow.plans.'+ref+'.revision','Drawing revision / sheet set',draft.workflow.plans[ref].revision)}${button('unlink-plan','Remove from agreement',attr('value',ref))}</div>`}</section>`;}).join('')}
 ${imported?`<h3>Review ${esc(imported.name||'drawing counts')}</h3><p>Choose which existing scope to add to or replace. Route footage only fills copper/fiber average when the scope has a verified count. Raw markups stay in the Takeoff Lab project.</p>
 ${imported.groups.map((g,i)=>`<section class="ew-box"><b>Sheet ${g.sheet} · ${esc(g.label)}</b> · ${g.count} ${g.feet!=null?'route(s), '+g.routedFeet.toFixed(1)+' cable-ft':'mark(s)'}
 ${g.unscaled?`<p class="ew-alert">${g.unscaled} unscaled route(s); measure in Takeoff Lab first.</p>`:''}
 <div class="ew-grid"><label>Target<select data-ew-import-target="${i}">${option('','Select scope','')}${draft.workflow.scopes.filter(s=>s.kind!=='shared').map(s=>option(s.id,s.label||trades[s.kind],'')).join('')}</select></label>
 ${button('import-add','Add',attr('value',i))}${button('import-replace','Replace',attr('value',i))}${button('import-reference','Reference only',attr('value',i))}</div></section>`).join('')}`:''}
 <div class="actions">${button('go','Add or review scopes',attr('value','add'))}${button('save','Save Draft')}${button('go','Site conditions',attr('value','site'))}</div>`;
}
export function agreementMarkup(doc){
 const lineTable=lines=>lines.length?`<table><thead><tr><th>Work or material</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${esc(l.description)}</td><td>${esc(l.quantity+' '+l.unit)}</td><td>${fmt(l.rate)}</td><td>${fmt(l.amount)}</td></tr>`).join('')}</tbody></table>`:'';
 return `<article class="invoice-sheet ew-agreement"><div class="invoice-brand"><img src="/logo.png" width="72" height="72" alt="BCI Elite"><div><h1>Estimate &amp; Agreement</h1><p>${esc(doc.number+' · '+(doc.issuedAt||'').slice(0,10)+' · Revision '+doc.revision.slice(0,8))}</p></div></div><div class="invoice-accent"></div>
 <h2>${esc(doc.title)}</h2><p>${esc([doc.billingName,doc.billingAddress,doc.site,doc.contactName,doc.po?'PO '+doc.po:''].filter(Boolean).join(' · '))}</p>
 ${doc.scopeRelationship?`<p>Revision type: ${esc(doc.scopeRelationship)}. ${esc(doc.reason)}</p>`:''}
 ${doc.scope?`<p>${esc(doc.scope)}</p>`:''}
 ${doc.scopes.map(s=>`<section class="ew-agreement-scope"><h3>${esc(s.label)} · ${esc(s.methodLabel)}</h3>
 <p>${esc(s.scope)}</p>${s.options?`<p>Includes: ${esc(s.options)}</p>`:''}${s.exclusions?`<p>Excludes: ${esc(s.exclusions)}</p>`:''}
 ${s.method==='unit'?`<p>${esc(s.qty)} ${esc(s.unit)} at ${fmt(s.rate)}. Billed on ${s.billing==='actual'?'actual installed quantity':'the agreed quantity'}. ${esc(s.includes)}</p>`:''}
 ${s.basis?`<p>Billing basis: ${esc(s.basis)}</p>`:''}${s.furnished?.length?`<ul>${s.furnished.map(l=>`<li>${esc(l.quantity+' '+l.unit+' · '+l.description+' provided by '+l.owner)}</li>`).join('')}</ul>`:''}${lineTable(s.lines)}
 ${s.amount==null?'':`<p><b>${s.method==='rom'?'Budget range':s.method==='nte'?'Working budget':'Scope amount'}: ${fmt(s.amount)}${s.high==null?'':' to '+fmt(s.high)}${s.cap==null?'':' · Not to exceed '+fmt(s.cap)}</b></p>`}</section>`).join('')}
 ${doc.options?`<p>Included options: ${esc(doc.options)}</p>`:''}
 ${doc.exclusions?`<p>Exclusions: ${esc(doc.exclusions)}</p>`:''}
 ${doc.excluded.map(x=>`<p>Excluded: ${esc(x.label+' · '+x.scope)}</p>`).join('')}
 ${doc.plans.length?`<h3>Drawings and references</h3><ul>${doc.plans.map(p=>`<li>${esc(p.name+' · '+(p.revision||'revision not specified')+' · '+(p.role==='governing'?'Governing scope':'Reference only'))}</li>`).join('')}</ul>`:''}
 ${Object.entries({deliverables:'Deliverables',warranty:'Warranty',note:'Terms',change:'Change orders'}).map(([k,label])=>doc.terms[k]?`<h3>${label}</h3><p class="ticket-text">${esc(doc.terms[k])}</p>`:'').join('')}
 ${doc.packageNote?`<p>${esc(doc.packageNote)}</p>`:''}${doc.overallCap==null?'':`<p><b>Project ceiling: ${fmt(doc.overallCap)}</b></p>`}
 ${doc.tax?`<p>Subtotal: ${fmt(doc.subtotal)} · Tax: ${fmt(doc.tax)}</p>`:''}
 <h2>${doc.budgetHigh==null?'Total':'Planning range only'} ${fmt(doc.total)}${doc.budgetHigh==null?'':' to '+fmt(doc.budgetHigh)}</h2>
 ${doc.payments.length?`<h3>Payment schedule</h3><ul>${doc.payments.map(p=>`<li>${esc(p.label)} · ${fmt(p.amount)}${p.due?' · '+esc(p.due):''}</li>`).join('')}</ul>`:''}
 ${doc.acceptedBy?`<h3>Authorization to proceed</h3><p>${esc(doc.acceptedBy+' · '+(doc.signerTitle||'')+' · '+doc.acceptedAt)} · ${doc.approvalMethod==='staff-recorded'?'Staff-recorded acceptance':'Signed on device'}</p>
 ${/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(doc.signatureData||'')?`<img class="signed-image" src="${esc(doc.signatureData)}" alt="Customer signature">`:''}`:doc.ready?'<h3>Authorization to proceed</h3><p>Signature authorizes the included scope, price and terms shown above.</p>':'<p><b>Draft or budget only. Not ready to authorize work.</b></p>'}</article>`;
}
function previewPanel(){
 const canSign=can('estimate.accept')&&can('workorder.create')&&can('workorders.view');
 return doc?`<div class="actions">${button('go','Back to estimate',attr('value','review'))}${button('print','Print / Save PDF')}
 ${doc.ready&&!doc.acceptedBy&&!dirty&&canSign?button('sign','Sign on this device','',true)+button('record','Record external acceptance'):''}
 ${snapshot()?.billingEmail&&(can('estimate.update')||can('estimate.create'))?button('email','Prepare email'):''}</div>${agreementMarkup(doc)}`:'<p>Loading customer agreement…</p>';
}
function rulesPanel(){
 const template=JSON.stringify({label:'',basis:'',congestedPull:1,hepaPull:1,trades:{copper:{setup:{fixed:0},pull:{perUnit:0,perFoot:0},end:{perEnd:0},test:{perUnit:0}}}},null,2);
 return `<h2>Estimator rule versions</h2><p>Only release coefficients you have checked against BCI job data. All coefficients produce person-hours. Setup fixed time is multiplied by number of visits.</p>
 <p>${esc(admin?.current?'Current: '+admin.current.label+' · '+admin.current.releasedAt.slice(0,10):'No released configuration. Use manually reviewed task hours.')}</p>
 <p class="muted">${(admin?.versions||[]).map(x=>esc(x.label)).join(' · ')}</p>
 <label class="ew-field">Rule configuration (JSON)<textarea id="ewRulesJson" rows="16" spellcheck="false">${esc(admin?.text??(admin?.current?JSON.stringify({...admin.current,label:'',basis:''},null,2):template))}</textarea></label>
 <p>For each trade/task, enter fixed, perUnit, perFoot, or perEnd as applicable. Pull multipliers affect only the pull task. Release creates a new version; it does not change signed estimates.</p>
 ${button('release-rules','Release new rule version')}${button('go','Back to estimate',attr('value',draft.id?'review':'intake'))}`;
}
export function estimateWorkspace(){
 if(!opening&&!query())return null;
 defaults();if(!draft)return `<section class="panel" data-estimator-workspace><h1>Estimate unavailable</h1>${button('back-list','Back to Estimates')}</section>`;
 const s=byScope(),live=snapshot(),frozen=live&&(live.status!=='Draft'||!can('estimate.update'));
 const screen=frozen&&!['preview','review'].includes(step)?'review':step;
 const body=screen==='intake'?intake():screen==='path'?pathPanel():screen==='site'?questionsPanel(null):screen==='questions'&&s?questionsPanel(s):
 screen==='pricing'&&s?pricing(s):screen==='terms'?terms():screen==='plans'?plans():screen==='preview'?previewPanel():screen==='rules'?rulesPanel():screen==='add'?addPanel():review();
 const hide=screen==='preview';const navItem=(x,l)=>button('go',l,attr('value',x));
 return `<div class="ew-root" data-estimator-workspace>${hide?'':head(draft.title||'New estimate','Estimates',live?.number||'Client intake',button('back-list','‹ Estimates'))}
 <p class="ew-save" role="status">${saving?'Saving…':dirty?'Unsaved changes':live?esc(live.status)+' · Saved':'New draft · not saved'}</p>
 ${problem?`<p role="alert" class="ew-alert">${esc(problem)}</p>`:''}
 <div class="ew-layout ${hide?'ew-client':''}"><main class="panel ew-main">${body}</main>
 ${hide||!draft.id||frozen?'':`<aside class="panel ew-outline"><details open><summary>Jump to</summary>
 ${navItem('intake','Client, contact & site')}${navItem('path','Measurement path')}${navItem('site','Job conditions')}${navItem('plans','Plans & takeoff')}
 ${draft.workflow.scopes.map(s=>button('scope',s.label||trades[s.kind],attr('value',s.id))).join('')}
 ${navItem('add','+ Add Scope')}${navItem('terms','Payment & terms')}${navItem('review','Review estimate')}
 ${me?.role==='admin'?button('rules','Estimator rules'):''}
 ${button('refresh','Refresh rates / rules')}${button('save','Save Draft')}</details></aside>`}</div></div>`;
}
function atPath(path){
 const keys=path.split('.'),base=keys[0]==='group'?byScope():draft;
 if(keys[0]==='group')keys.shift();let obj=base;
 for(const k of keys.slice(0,-1)){if(!obj)return {};obj[k]??={};obj=obj[k];}
 return {obj,key:keys.at(-1)};
}
function storeField(path,value,amode='answer'){
 const {obj,key}=atPath(path);if(!obj)return;
 if(key==='value'&&/\.(answers|conditions|site)\./.test(path))obj.mode=amode;
 obj[key]=value;dirty=true;problem='';doc=null;
 const label=root()?.querySelector('.ew-save');if(label)label.textContent='Unsaved changes';
}
const fileToBase64=file=>new Promise((resolve,reject)=>{const r=new FileReader;r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('Could not read PDF'));r.readAsDataURL(file);});
async function save(refresh=false){
 if(saving)throw Error('A save is already in progress');
 if(!editAllowed())throw Error('You do not have permission to edit this estimate');
 if(!draft.clientId||!draft.projectId||!draft.title?.trim())throw Error('Choose a billing client, project and estimate name');
 saving=true;problem='';render();
 try{
  const out=await send(draft.id?'estimate.update':'estimate.create',{...draft,refreshRules:refresh,refreshRates:refresh});
  draft.id=out.id;draft.revision=out.revision;draft.workflow=out.workflow;draft.basedOnId=out.basedOnId;draft.pricingProfileId=out.pricingProfileId;
  setView(out.id);dirty=false;doc=null;return out;
 }finally{saving=false;}
}
const showError=e=>{problem=e.message||String(e);render();};
function scopeJump(id,target='questions'){active=id;step=target;index=0;mode='guided';}
function setChoice(c){
 const path=c.dataset.question,{obj,key}=atPath(path);if(!obj)return;
 const q=(path.includes('conditions')||path.startsWith('workflow.site')?siteQuestions:scopeQs(byScope())).find(q=>path.split('.').at(-2)===q.key);
 if(c.dataset.ew==='answer')storeField(path,c.dataset.value);
 if(c.dataset.ew==='mark-none'){obj[key]=undefined;obj.mode='none';dirty=true;doc=null;}
 if(c.dataset.ew==='later'){obj[key]=undefined;obj.mode='later';dirty=true;doc=null;}
 if(c.dataset.ew==='suggest')storeField(path,q?.suggest,'suggested');
 if(!['answer','suggest'].includes(c.dataset.ew)&&mode==='guided')return navigateQuestion(1,true);
 render();
}
async function navigateQuestion(delta,persist){
 const list=step==='site'?siteQuestions:scopeQs(byScope());const was=step;
 if(persist&&dirty)await save();
 if(delta<0&&index===0){step=was==='site'?'path':'add';mode='guided';}
 else if(mode==='all'&&delta>0||index+delta>=list.length){step=was==='site'?'add':'pricing';mode='guided';}
 else index=Math.max(0,index+delta);
 render();
}
async function clientPreview(){
 if(dirty)await save();
 doc=await call('estimate.agreement',{id:draft.id});step='preview';render();
}
function approve(withSignature){
 if(!doc?.ready||doc.acceptedBy||dirty)throw Error('Save and review the current agreement before accepting');
 const d=doc, id=draft.id; if(!withSignature)modal('Record external acceptance',f('acceptedBy','Client approver',{required:true})+f('signerTitle','Title')+f('evidence','Approval reference',{required:true,textarea:true}),async p=>{await send('estimate.accept',{...p,id,revision:d.revision,agreementDigest:d.digest});await clientPreview();});
 else {
  modal('Sign '+d.number,agreementMarkup(d)+f('acceptedBy','Printed name',{required:true})+f('signerTitle','Title / signing role',{required:true})+
   '<label for="ewSignature">Draw your signature</label><canvas id="ewSignature" class="sign-canvas" width="440" height="160" aria-label="Draw your signature"></canvas><button type="button" id="clearSig" class="secondary">Clear signature</button><label class="signature-terms"><input name="consent" type="checkbox" required> I authorize the included work and agree to the price and terms shown above.</label>',
   async p=>{await send('estimate.accept',{...p,id,revision:d.revision,agreementDigest:d.digest});await clientPreview();});
  initSignature();
 }
}
function applyImport(action,i){
 const g=imported?.groups[i];if(!g)throw Error('Review the takeoff first');
 const k=imported.fingerprint+':'+g.key;
 if(draft.workflow.importKeys.includes(k)&&action==='import-add')throw Error('This drawing count was already added');
 const id=root()?.querySelector('[data-ew-import-target="'+i+'"]')?.value;
 const s=draft.workflow.scopes.find(s=>s.id===id);
 if(!s&&action!=='import-reference')throw Error('Select a target scope');
 if(g.unscaled&&action!=='import-reference')throw Error('Calibrate the route sheet or keep it as reference only');
 const mode=action==='import-add'?'add':'replace';
 const src='Sheet '+g.sheet+' '+g.label+' ('+(imported.name||'reviewed takeoff')+')';
 if(s){
  s.source=[s.source,src].filter(Boolean).join(' · ').slice(0,250);
  if(action!=='import-reference'){
   const a=(key,n)=>{s.answers[key]={mode:'answer',value:n};};
   if(g.feet!=null){
    if(!['copper','fiber'].includes(s.kind))throw Error('Use a copper or fiber group for route length');
    const count=s.kind==='fiber'?getAnswer(s.answers,'runs'):getAnswer(s.answers,'locations')*getAnswer(s.answers,'each',1);
    if(!count)throw Error('Enter the destination run count first');
    const feet=s.kind==='fiber'?g.feet:g.routedFeet;
    a('length',Math.round((mode==='add'?(getAnswer(s.answers,'length',0)*count+feet)/count:feet/count)*10)/10);
   }else{
    const key=s.kind==='copper'?'locations':s.kind==='fiber'?'runs':'count';
    a(key,(mode==='add'?getAnswer(s.answers,key,0):0)+g.count);
    if(s.kind==='copper'&&g.jacks&&mode==='replace')a('each',g.jacks);
   }
  }
 }
 if(!draft.workflow.importKeys.includes(k)){
  if(draft.workflow.importKeys.length>=30)throw Error('Takeoff history is full; make a new draft');
  draft.workflow.importKeys.push(k);
 }
 dirty=true;render();
}
function setProblem(e){showError(e);}
document.addEventListener('input',e=>{
 if(!root()?.contains(e.target))return;
 const x=e.target;
 if(x.matches('#ewRulesJson')){if(admin)admin.text=x.value;return;}
 if(x.hasAttribute('data-ew-filter')){
  const k=x.dataset.ewFilter, select=[...root().querySelectorAll('[data-ew-select]')].find(z=>z.dataset.ewSelect===k);
  const {obj,key}=atPath(k);const curr=obj?.[key]||'';
  const s=byScope(), parts=k.includes('laborItem')?'labor':k.includes('items.')?s?.items?.[Number(k.split('.')[2])]?.type||'material':'material';
  const t=x.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const avail=(quote?.items||[]).filter(i=>i.type===parts&&(i.id===curr||t.every(q=>(i.name+' '+(i.sku||'')+' '+(i.catalogInfo?.brand||'')+' '+(i.catalogInfo?.mpn||'')).toLowerCase().includes(q)))).slice(0,24);
  select.innerHTML=option('','No match selected',curr)+avail.map(i=>option(i.id,i.name+' · '+i.unit,i.id===curr?curr:'invalid')).join('');
  select.value=curr;return;
 }
 if(x.dataset.ewField){
  storeField(x.dataset.ewField,x.type==='checkbox'?x.checked:x.type==='number'&&x.value!==''?Number(x.value):x.value);
 }
});
document.addEventListener('change',async e=>{
 if(!root()?.contains(e.target))return;
 const x=e.target;
 try{
  if(x.dataset.ewField==='clientId'){draft.projectId='';draft.contactId='';draft.pricingProfileId='';quote=null;scheduleRates();render();}
  else if(x.dataset.ewField==='projectId'){selectProject();quote=null;scheduleRates();render();}
  else if(x.dataset.ewField==='pricingProfileId'){quote=null;scheduleRates();render();}
  else if(x.dataset.ewField==='group.role'){if(x.value==='option')byScope().selected=false;render();}
  else if(/group\.(preset|pricing\.method|items\.\d+\.type)|workflow\.terms\.basis/.test(x.dataset.ewField||''))render();
  else if(x.hasAttribute('data-ew-import')&&x.files[0]){
   const file=x.files[0];if(file.size>4_000_000)throw Error('Takeoff file exceeds 4 MB');
   imported=takeoffGroups(JSON.parse(await file.text()));problem='';render();
  }else if(x.hasAttribute('data-ew-pdf')&&x.files[0]){
   const file=x.files[0];if(file.size>10_000_000)throw Error('Choose a PDF up to 10 MB');
   const out=await call('estimate.planAttach',{id:draft.id,revision:draft.revision,name:file.name,pdf:await fileToBase64(file)},'/api/estimator/plan');
   if(!draft.workflow.plans.some(p=>p.id===out.id)){draft.workflow.plans.push({id:out.id,name:out.name,role:'reference',revision:''});dirty=true;}
   await save();step='plans';render();
  }
 }catch(err){setProblem(err);}
});
document.addEventListener('click',async e=>{
 const c=e.target.closest('[data-ew]');
 if(!c||!root()?.contains(c)||saving)return;
 const a=c.dataset.ew, x=c.dataset.value, s=byScope();
 problem='';
 try{
  if(a==='back-list'){
   if(!guardEstimateNavigation())return;
   cleanstate();setView('');render();return;
  }
  if(a==='answer'||a==='mark-none'||a==='later'||a==='suggest')return await setChoice(c);
  if(a==='save'){await save();render();return;}
  if(a==='save-intake'){await save();step=draft.workflow.path?'site':'path';render();return;}
  if(a==='new-client'||a==='new-project'||a==='new-contact'){
   const kind=a.split('-')[1],clientId=draft.clientId;
   const fields=kind==='client'?f('name','Billing name',{required:true})+f('email','Billing email',{required:true,type:'email'})+f('phone','Billing phone',{required:true})+f('address','Billing address',{required:true}):
    kind==='project'?f('name','Project name',{required:true})+f('site','Jobsite'):
    f('name','Contact name',{required:true})+f('email','Email',{type:'email'})+f('phone','Phone',{required:true});
   return modal('New '+kind,fields,async p=>{
    const obj=await send({client:'customer.create',project:'project.create',contact:'contact.create'}[kind],{...p,customerId:clientId});
    if(kind==='client'){draft.clientId=obj.id;draft.projectId='';draft.contactId='';quote=null;scheduleRates();}
    else if(kind==='project'){draft.projectId=obj.id;selectProject();quote=null;scheduleRates();}
    else draft.contactId=obj.id;
    dirty=true;render();
   });
  }
  if(a==='path'){draft.workflow.path=x;dirty=true;await save();step=x==='plan'?'plans':'site';index=0;}
  if(a==='go'){step=x;index=0;mode='guided';if(step==='review'&&dirty)await save();}
  if(a==='next'||a==='prev')return await navigateQuestion(a==='next'?1:-1,a==='next');
  if(a==='mode')mode=mode==='all'?'guided':'all';
  if(a==='add'){
   if(draft.workflow.scopes.length>=18)throw Error('Use up to 18 scope groups');
   const g=newScope(c.dataset.kind,crypto.randomUUID());g.preset=presets[g.kind][0];g.label=trades[g.kind];draft.workflow.scopes.push(g);dirty=true;scopeJump(g.id);
  }
  if(a==='scope'||a==='price-scope'){scopeJump(x,a==='scope'?'questions':'pricing');if(a==='price-scope')scheduleRates();}
  if(a==='questions'){step='questions';index=0;}
  if(a==='save-review'){await save();step='review';}
  if(a==='reload-price'){quote=null;scheduleRates();}
  if(a==='add-item'){
   if(s.items.length>=32)throw Error('Use up to 32 additional lines');
   s.items.push({type:'material',qty:1,owner:'BCI'});dirty=true;
  }
  if(a==='remove-item'){s.items.splice(Number(x),1);dirty=true;}
  if(a==='duplicate'){if(draft.workflow.scopes.length>=18)throw Error('Use up to 18 scope groups');
   const g=structuredClone(s);g.id=crypto.randomUUID();g.label=(g.label||trades[g.kind])+' copy';g.source='';draft.workflow.scopes.push(g);dirty=true;scopeJump(g.id);}
  if(a==='remove-scope')askDelete=s.id;
  if(a==='cancel-remove')askDelete='';
  if(a==='confirm-remove'){draft.workflow.scopes=draft.workflow.scopes.filter(g=>g.id!==s.id);askDelete='';dirty=true;step='add';active='';}
  if(a==='add-payment'){if(draft.workflow.terms.payments.length>=8)throw Error('Use up to eight milestones');draft.workflow.terms.payments.push({label:'',value:'',due:''});dirty=true;}
  if(a==='remove-payment'){draft.workflow.terms.payments.splice(Number(x),1);dirty=true;}
  if(a==='pay-preset'){draft.workflow.terms.basis='percent';draft.workflow.terms.payments=[{label:'Deposit',value:15,due:'At acceptance'},{label:'Cable pull complete',value:35,due:'Net 15'},{label:'Completion',value:50,due:'Net 15'}];dirty=true;}
  if(a==='link-plan'){const plan=snapshot()?.planFiles?.find(p=>p.id===x);if(plan&&!draft.workflow.plans.some(p=>p.id===x)){draft.workflow.plans.push({id:x,name:plan.name,revision:'',role:'reference'});dirty=true;}}
  if(a==='unlink-plan'){draft.workflow.plans.splice(Number(x),1);dirty=true;}
  if(a.startsWith('import-'))return applyImport(a,Number(x));
  if(a==='refresh'){
   return modal('Refresh pricing and estimating rules','<p>Apply the latest available approved rules and catalog rates to this draft, then review before sending or signing. Signed agreements are not changed.</p>',async()=>{await save(true);step='review';render();});
  }
  if(a==='rules'){const r=await fetch('/api/estimator/rules');const b=await r.json();if(!r.ok)throw Error(b.error||'Rules unavailable');admin=b;step='rules';}
  if(a==='release-rules'){const payload=JSON.parse(root().querySelector('#ewRulesJson').value);
   return modal('Release this rule version','<p>This only affects new drafts or drafts explicitly refreshed.</p>',async()=>{await send('estimate.rulesRelease',payload);const r=await fetch('/api/estimator/rules');admin=await r.json();render();});}
  if(a==='preview')return await clientPreview();
  if(a==='sign'||a==='record')return approve(a==='sign');
  if(a==='print'&&doc)return printDocument(agreementMarkup(doc));
  if(a==='email'&&doc){
   const live=snapshot();return modal('Prepare estimate email','<p>Use Print / Save PDF first, then attach that file to your email draft. Nothing is sent automatically.</p>',()=>{
    location.href='mailto:'+encodeURIComponent(live.billingEmail)+'?subject='+encodeURIComponent('BCI Elite '+doc.number+' · '+doc.title)+'&body='+encodeURIComponent('Please see the attached BCI Elite estimate.');});
  }
  if(a==='release-order')return modal('Release this work order','<p>Release the signed scope to the crew. No purchasing or email is triggered.</p>',()=>send('estimate.releaseWorkOrder',{workorderId:x}));
  if(a==='revise'){
   return modal('Draft a revision',f('relationship','Relationship',{select:[['replacement','Replacement'],['additive','Additive change'],['credit','Credit']],required:true})+f('reason','What changed?',{required:true,textarea:true}),async p=>{
    const live=snapshot(),base=structuredClone(draft.workflow);
    base.relationship=p.relationship;base.reason=p.reason;
    if(p.relationship!=='replacement'){base.scopes=[];base.terms.payments=[];base.terms.tax=0;base.packagePrice=null;base.overallCap=null;base.packageNote='';}
    const out=await send('estimate.create',{...draft,id:undefined,revision:undefined,basedOnId:live.id,workflow:base});
    startEstimate(out.id);
   });
  }
  render();
 }catch(err){setProblem(err);}
});
window.addEventListener?.('beforeunload',e=>{if(root()&&dirty){e.preventDefault();e.returnValue='';}});
