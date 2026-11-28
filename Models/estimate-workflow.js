import {createHash,randomUUID} from 'node:crypto';
import {normalizeDraft,computeWorkflow,methods,trades,taskNames} from '../public/modules/estimator-engine.js';
const hash=x=>createHash('sha256').update(x).digest('hex');
const uniq=x=>[...new Set(x)];
const field=(s,max,required=false)=>{if(typeof s!=='string'||s.length>max||required&&!s.trim())throw Error('Enter a valid estimate field');return s.trim();};
const getRules=(state,id)=>state.estimateRuleSets?.find(r=>r.id===id);
const currentRules=state=>state.estimateRuleSets?.at(-1);
const titleFor=s=>s.label||trades[s.kind];

export function estimatorRules(state){
 return {current:currentRules(state)||null,versions:(state.estimateRuleSets||[]).map(({id,label,releasedAt})=>({id,label,releasedAt}))};
}
export function releaseEstimatorRules(state,raw,actor){
 if(actor.role!=='admin')throw Error('Only an administrator can release estimating rules');
 const label=field(raw.label,80,true);
 const basis=field(raw.basis,600,true);
 const n=(x,max,min=0)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw Error('Invalid rule coefficient');return x;};
 const tradesIn={};
 for(const k of Object.keys(trades).filter(x=>x!=='shared')){
  if(raw.trades?.[k]==null)continue;
  const tasks={};
  for(const task of Object.keys(taskNames)){
   const p=raw.trades[k][task];if(!p)continue;
   tasks[task]=Object.fromEntries(['fixed','perUnit','perFoot','perEnd'].map(key=>[key,n(p[key]??0,1000)]));
  }
  tradesIn[k]=tasks;
 }
 if(!Object.values(tradesIn).some(x=>Object.keys(x).length))throw Error('Enter at least one trade task recipe');
 const sets=state.estimateRuleSets??=[];
 if(sets.length>=75)throw Error('Estimator rule history is full');
 const out={id:randomUUID(),label,basis,trades:tradesIn,congestedPull:n(raw.congestedPull??1,8,1),hepaPull:n(raw.hepaPull??1,8,1),releasedAt:new Date().toISOString(),releasedBy:actor.email};
 sets.push(out);return out;
}
export function resolveWorkflow(state,data,existing,previous,quotedItems,actor){
 const workflow=normalizeDraft(data.workflow);
 if(previous&&!workflow.relationship)throw Error('Choose replacement, additive or credit for this revision');
 if(!previous&&workflow.relationship)throw Error('A quote relationship requires an approved base');
 const original=existing?.workflow;
 if(actor.permissions&&!actor.permissions.includes('finance.view')){
  const priorCost=new Map((original?.scopes||previous?.workflow?.scopes||[]).map(x=>[x.id,x]));
  for(const s of workflow.scopes){
   if(s.laborUnitCost!=null||s.items.some(i=>i.unitCost!=null))throw Error('Finance permission required to set estimate costs');
   const old=priorCost.get(s.id);
   if(old){s.laborUnitCost=old.laborUnitCost??null;for(const [j,i] of s.items.entries())if(JSON.stringify([i.catalogId,i.description,i.type,i.owner])===JSON.stringify([old.items[j]?.catalogId,old.items[j]?.description,old.items[j]?.type,old.items[j]?.owner]))i.unitCost=old.items[j].unitCost??null;}
  }
 }
 const fast=(w)=>JSON.stringify({scopes:w.scopes.map(s=>({role:s.role,selected:s.selected,pricing:s.pricing,items:s.items.filter(i=>i.rate!=null||!i.catalogId).map(i=>[i.rate,i.override,i.owner]),laborRate:s.laborRate,shared:s.kind==='shared'?s.answers.amount:null})),tax:w.terms.tax,packagePrice:w.packagePrice,overallCap:w.overallCap});
 const manual=workflow.terms.tax||workflow.packagePrice!=null||workflow.overallCap!=null||workflow.scopes.some(s=>s.pricing.rate!=null||s.pricing.high!=null||s.pricing.cap!=null||s.laborRate!=null||s.kind==='shared'&&s.answers.amount?.value!=null||s.items.some(i=>i.rate!=null&&(!i.catalogId||i.override)));
 if(manual&&actor.permissions&&!actor.permissions.includes('estimate.override')&&(!original||fast(workflow)!==fast(original)))throw Error('Manual estimate pricing permission required');
 const allowed=new Set((existing?.planFiles||previous?.planFiles||[]).map(x=>x.id));
 if(workflow.plans.some(p=>!p.id||!allowed.has(p.id)))throw Error('Choose a plan uploaded to this draft');
 const allPlans=existing?.planFiles||previous?.planFiles||[];
 workflow.plans=workflow.plans.map(p=>({...p,name:allPlans.find(x=>x.id===p.id).name}));
 const priorRule=original?.ruleVersion??previous?.workflow?.ruleVersion;
 const defaultRule=currentRules(state)?.id||'';
 if(original&&!data.refreshRules)workflow.ruleVersion=priorRule||'';
 else if(previous&&!data.refreshRules)workflow.ruleVersion=priorRule||'';
 else workflow.ruleVersion=defaultRule;
 const profileChanged=existing&&((existing.pricingProfileId||'')!==(data.appliedProfileId||''));
 const prices={};
 const ids=new Set(workflow.scopes.flatMap(s=>[s.laborItem,...Object.values(s.matches),...s.items.map(x=>x.catalogId)]).filter(Boolean));
 const items=quotedItems.filter(i=>ids.has(i.id)).map(i=>{
  const catalog=state.catalog.find(x=>x.id===i.id);
  const prior=!(data.refreshRates||profileChanged)&&existing?.priceSnapshot?.[i.id];
  const cost=catalog?.cost==null||catalog.cost===''?null:Number(catalog.cost);
  const current={rate:i.rate,cost:Number.isFinite(cost)?cost:null};
  prices[i.id]=prior?{rate:prior.rate??null,cost:prior.cost??null}:current;
  return {...i,...prices[i.id]};
 });
 const calc=computeWorkflow(workflow,{items,rules:getRules(state,workflow.ruleVersion)});
 const invalidPlan=workflow.plans.filter(x=>x.role==='governing'&&!x.revision);
 for(const p of invalidPlan)calc.issues.push({scope:'',message:'Identify the revision of governing drawing '+p.name});
 return {workflow,calc,prices};
}
export function workflowScopeRecords(calc){
 return calc.scoped.filter(x=>x.included).map(s=>({key:s.key,kind:s.kind,label:titleFor(s),requirements:s.scope,options:s.options,exclusions:s.exclusions}));
}
const publishScope=s=>{
 const p=s.pricing;
 return {key:s.key,label:s.label,trade:trades[s.kind],scope:s.scope,options:s.options,exclusions:s.exclusions,
  method:p.method,methodLabel:methods[p.method],amount:s.amount,high:s.high,cap:p.method==='nte'?p.cap:null,
  furnished:s.lines.filter(l=>l.owner!=='BCI').map(({owner,description,quantity,unit})=>({owner,description,quantity,unit})),
  qty:p.method==='unit'?s.qty:null,unit:p.method==='unit'?p.unit:'',
  rate:p.method==='unit'?p.rate:null,billing:p.method==='unit'?p.billing:'',includes:p.includes,
  basis:['tm','nte'].includes(p.method)?p.basis:'',
  lines:['tm','nte'].includes(p.method)?s.lines.filter(l=>l.rate!=null&&l.owner==='BCI').map(({description,quantity,unit,rate,amount})=>({description,quantity,unit,rate,amount})):[]};
};
export function agreementView(estimate){
 if(estimate.approvalSnapshot?.agreement)return estimate.approvalSnapshot.agreement;
 if(!estimate.workflow)throw Error('This is a legacy estimate');
 const w=estimate.workflow,c=estimate.workflowResult;
 const include=c.scoped.filter(s=>s.included);
 const cap=include.reduce((a,s)=>a+(s.pricing.method==='nte'?s.pricing.cap??0:s.pricing.method==='rom'?s.high??s.amount:s.amount),c.tax);
 const payload={version:2,revision:estimate.revision,number:estimate.number,issuedAt:estimate.updatedAt||estimate.createdAt,title:estimate.title,site:estimate.site,po:estimate.po,
  billingName:estimate.billingName,billingAddress:estimate.billingAddress,contactName:estimate.contactName||'',
  scope:estimate.scope,scopes:include.map(s=>{const p=publishScope(s);return w.packagePrice==null?p:{...p,method:'package',methodLabel:'Included in package',amount:null,lines:[],rate:null,cap:null,basis:''};}),options:estimate.options,exclusions:estimate.exclusions,
  excluded:c.scoped.filter(x=>!x.included&&x.role==='excluded').map(x=>({label:x.label,scope:x.scope})),
  scopeRelationship:w.relationship,reason:w.reason,plans:w.plans.map(({id,name,revision,role})=>({name,revision,role,sha256:estimate.planFiles?.find(x=>x.id===id)?.sha})),
  packagePrice:w.packagePrice,overallCap:w.overallCap,packageNote:w.packageNote,
  terms:{note:w.terms.note,deliverables:w.terms.deliverables,warranty:w.terms.warranty,change:w.terms.change},
  payments:c.payments,subtotal:c.subtotal,tax:c.tax,total:c.total,
  budgetHigh:include.some(s=>s.pricing.method==='rom')?cap:null,
  ready:c.issues.length===0};
 return {...payload,digest:hash(JSON.stringify(payload))};
}
export function saveEstimatePlan(estimate,data){
 if(estimate.status!=='Draft'||estimate.revision!==data.revision)throw Error('Upload to the current draft');
 const raw=data.pdf;
 const name=field(data.name,180,true).replace(/[\\/]/g,'_');
 if(!/\.pdf$/i.test(name)||typeof raw!=='string'||raw.length>14_000_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw Error('Upload a PDF up to 10 MB');
 const b=Buffer.from(raw,'base64');
 if(b.length<12||b.length>10_000_000||b.subarray(0,5).toString()!=='%PDF-'||!b.subarray(Math.max(0,b.length-4096)).toString().includes('%%EOF'))throw Error('Invalid or oversized PDF');
 const list=estimate.planFiles??=[];
 const sha=hash(b);
 const existing=list.find(x=>x.sha===sha);
 if(existing)return {id:existing.id,name:existing.name,bytes:existing.bytes};
 if(list.length>=8||list.reduce((a,x)=>a+x.bytes,0)+b.length>24_000_000)throw Error('This estimate has reached the plan storage limit');
 const metadata={id:randomUUID(),name,bytes:b.length,sha};
 list.push({...metadata,privatePlanData:raw});
 return {id:metadata.id,name,bytes:b.length};
}
export function draftRuleIds(state,workflow){return uniq((workflow?.scopes||[]).map(s=>s.kind)).filter(Boolean);}
