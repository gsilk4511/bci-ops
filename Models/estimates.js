import {clientPricingChoices,assignedPricing,profileRate,sellingRate} from './pricing.js';
import {randomUUID} from 'node:crypto';
import {normalizeEstimateScopes,scopeLines} from '../public/modules/estimate-scope-math.js';

function field(value,label,limit,optional=false){
 if(typeof value!=='string'||(!optional&&!value.trim())||value.length>limit)throw Error('Enter '+label);
 return value.trim();
}
function context(state,data){
 const client=state.customers.find(item=>item.id===data.clientId);
 if(!client)throw Error('Choose a billing client');
 const profiles=clientPricingChoices(state,client);
 const inherited=assignedPricing(state,null,null,client);
 if(inherited.profile&&!profiles.some(item=>item.id===inherited.profile.id))profiles.unshift(inherited.profile);
 const profile=data.pricingProfileId?profiles.find(item=>item.id===data.pricingProfileId):inherited.profile;
 if(data.pricingProfileId&&!profile)throw Error('Choose an available client pricing profile');
 return {client,profile,profiles};
}
export function estimateRates(state,data){
 const {client,profile,profiles}=context(state,data);
 return {profileId:profile?.id||'',profileName:profile?.name||'Client and catalog rates',
  profiles:profiles.map(({id,name})=>({id,name})),
  items:state.catalog.map(item=>({
   id:item.id,name:item.name,sku:item.sku,unit:item.unit,type:item.type,
   catalogInfo:item.catalogInfo?Object.fromEntries(['photoId','photoStatus','brand','mpn','system','partType','spec']
    .filter(key=>Object.hasOwn(item.catalogInfo,key)).map(key=>[key,item.catalogInfo[key]])):undefined,
   rate:profile?profileRate(state,profile,item,null,'standard'):item.needsPricing?null:sellingRate(item,client,null,item.cost)
  }))};
}
const now=()=>new Date().toISOString();
const officeGrant=(actor,key)=>!actor.permissions||actor.permissions.includes(key);
const price=n=>Math.round(n*100)/100;
const clone=v=>structuredClone(v);
const scopeSummary=s=>{
 if(s.kind==='copper')return [
  `${s.drops} ${s.category} ${s.cableType} copper drops; average ${s.avgLength} ft; ${s.jack} jacks.`,
  `Building: ${s.building}. Pathway/access: ${s.access}. Run, terminate, test, and label.`
 ].join(' ');
 if(s.kind==='fiber')return `${s.strands}-strand ${s.fiberType}; ${s.length} ft via ${s.route}. End A: ${s.endA}. End B: ${s.endB}. Run and terminate ${s.terminatedPerEnd} strands per end. Test and label: ${s.testing}.`;
 return s.requirements||s.label;
};
function optionalSignature(data){
 if(data.signatureData==null||data.signatureData==='')return '';
 const raw=data.signatureData;
 if(typeof raw!=='string'||raw.length>230000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(raw)||data.consent!==true)throw Error('Customer consent and a PNG signature are required');
 const bytes=Buffer.from(raw.slice(22),'base64');
 if(bytes.length<180||bytes.length>170000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG signature');
 return raw;
}
function workOrderPlans(estimate){
 const scopes=estimate.approvalSnapshot.scopes;
 if(!scopes.length)return [];
 const result=[];
 const materials=estimate.approvalSnapshot.lines.filter(line=>line.type==='material'||line.takeoffType==='material').map(line=>`${line.quantity} × ${line.description}`);
 if(materials.length)result.push({key:'inventory',kind:'inventory',label:'Check inventory and order shortages',internal:true,
  description:'Check stock against the approved takeoff. Flag shortages for ordering; do not assume items are available. Approved takeoff (see signed estimate for full list): '+materials.join('; ')});
 for(const scope of scopes){
  if(scope.kind==='shared')continue;
  result.push({key:scope.key,kind:scope.kind,label:scope.label||(scope.kind==='lift'?'Arrange scissor lift':scope.kind==='fiber'?'Install fiber':'Install copper'),
   internal:scope.kind==='lift',description:[scopeSummary(scope),scope.options?'Accepted options: '+scope.options:'',scope.exclusions?'Excluded: '+scope.exclusions:''].filter(Boolean).join(' ')});
 }
 result.push({key:'closeout',kind:'closeout',label:'Complete closeout',internal:true,
  description:'Collect test reports, as-built drawings, and photos. Prepare the closeout email and submit this work order for review before final billing.'});
 return result;
}
function createEstimateOrders(state,estimate,createWorkOrder){
 const project=state.projects.find(project=>project.id===estimate.projectId&&project.customerId===estimate.clientId);
 if(!project||!createWorkOrder)throw Error('A linked project is required to prepare work orders');
 const plans=workOrderPlans(estimate);
 const previous=estimate.basedOnId&&state.estimates.find(item=>item.id===estimate.basedOnId);
 if(previous){
  const prior=new Map(workOrderPlans(previous).map(plan=>[plan.key,plan]));
  const current=new Map(plans.map(plan=>[plan.key,plan]));
  estimate.workOrderChanges=[...new Set([...prior.keys(),...current.keys()])].flatMap(key=>{
   const from=prior.get(key),to=current.get(key);
   return JSON.stringify(from)===JSON.stringify(to)?[]:[{scopeKey:key,before:from?.description||'',after:to?.description||'',label:to?.label||from?.label,change:from&&to?'Changed':to?'Added':'Removed'}];
  });
  return; // A revised approval must never silently supersede released work.
 }
 estimate.generatedOrders=plans.map(plan=>{
  const order=createWorkOrder({projectId:project.id,description:('Approved estimate '+estimate.number+' · '+plan.label+'. '+plan.description).slice(0,2000)});
  order.estimateSource={estimateId:estimate.id,revision:estimate.approvalSnapshot.revision,scopeKey:plan.key,kind:plan.kind};
  order.estimateTaskLabel=plan.label;
  order.internalTask=plan.internal;
  if(plan.kind==='closeout')order.requiredForFinalBilling=true;
  return {id:order.id,label:plan.label};
 });
}
export function estimateAction(state,action,data,actor,createProject,createWorkOrder){
 const estimates=state.estimates??=[];
 if(action==='estimate.releaseWorkOrder'){
  if(!officeGrant(actor,'estimate.releaseWorkOrder')||!officeGrant(actor,'workorder.approve')||!officeGrant(actor,'workorders.view'))throw Error('Estimate work order release permission required');
  const order=state.workorders.find(item=>item.id===data.workorderId);
  const source=order?.estimateSource;
  const estimate=source&&estimates.find(item=>item.id===source.estimateId&&item.projectId===order.projectId&&item.approvalSnapshot?.revision===source.revision);
  if(!estimate||!estimate.generatedOrders?.some(item=>item.id===order.id))throw Error('Approved estimate work order unavailable');
  if(order.approvedAt)return order;
  const plan=workOrderPlans(estimate).find(item=>item.key===source.scopeKey&&item.kind===source.kind);
  if(!plan||order.description!==('Approved estimate '+estimate.number+' · '+plan.label+'. '+plan.description).slice(0,2000))throw Error('Draft scope differs from the approved estimate; obtain approval for the revised scope');
  order.approvedAt=now();order.status='released';
  order.approval={signedBy:estimate.approvalSnapshot.acceptedBy,at:estimate.approvalSnapshot.acceptedAt,scope:order.description,method:'approved-estimate',
   recordedBy:actor.email,releasedAt:order.approvedAt,estimateId:estimate.id,signerIdentityUnverified:true};
  return order;
 }
 if(action==='estimate.create'||action==='estimate.update'){
  const existing=action==='estimate.update'?estimates.find(item=>item.id===data.id):null;
  if(action==='estimate.update'&&(!existing||existing.status!=='Draft'||existing.revision!==data.revision))throw Error('Open the latest draft before editing');
  const {client,profile}=context(state,data);
  const basedOnId=existing?.basedOnId||data.basedOnId||'';
  const previousEstimate=basedOnId&&estimates.find(item=>item.id===basedOnId&&item.approvalSnapshot&&item.clientId===client.id);
  if(basedOnId&&!previousEstimate)throw Error('Choose an approved estimate from this billing client');
  const projectId=data.projectId??existing?.projectId??previousEstimate?.projectId??'';
  const project=projectId&&state.projects.find(item=>item.id===projectId&&item.customerId===client.id);
  if(projectId&&!project)throw Error('Choose a project for this billing client');
  if(previousEstimate&&previousEstimate.projectId!==projectId)throw Error('Revisions must stay on the original project');
  const scopes=normalizeEstimateScopes(data.scopes??existing?.scopes??[]);
  if(scopes.length&&!project)throw Error('Choose a project for the guided estimate');
  if(scopes.length&&scopes.filter(x=>x.kind==='lift').length>1)throw Error('Use one shared scissor lift scope per estimate');
  const calculated=scopeLines(scopes);
  for(const s of scopes){
   for(const key of ['cableId','jackId','plateId','panelId','fiberId','terminationAId','terminationBId','laborId']){
    if(!s[key])continue;
    const catalog=state.catalog.find(item=>item.id===s[key]);
    if(!catalog||catalog.type!==(key==='laborId'?'labor':'material'))throw Error('Choose an available catalog item for '+key);
    const unit=String(catalog.unit||'').trim().toLowerCase();
    if(key==='cableId'&&!/^(box(?:es)?|reels?|spools?)$/.test(unit))throw Error('Copper cable takeoff requires a catalog item sold by the box, reel, or spool');
    if(key==='fiberId'&&!/^(ft|feet|foot)$/.test(unit))throw Error('Fiber cable takeoff requires a catalog item sold by the foot');
    if(key==='jackId'){
      const known=/(?:cat(?:egory)?[\s-]*)(6a|6|5e|8)\b/i.exec(catalog.name||'')?.[1]?.toLowerCase();
      if(known&&known!==s.category.toLowerCase().replace(/^cat/,'').trim())throw Error('Choose a catalog jack compatible with '+s.category);
    }
   }
  }
  if(scopes.length&&!scopes.some(x=>x.kind==='fiber'||x.kind==='copper'))throw Error('Add a copper or fiber scope');
  if(data.contactId&&!client.contacts?.some(item=>item.id===data.contactId))throw Error('Choose a contact for this client');
  if(!Array.isArray(data.lines)||data.lines.length>100)throw Error('Use up to 100 estimate lines');
  const options=new Map(estimateRates(state,data).items.map(item=>[item.id,item]));
  const lines=data.lines.map((line,index)=>{
   const quantity=Number(line.quantity);
   if(!Number.isFinite(quantity)||quantity<=0||quantity>1e6)throw Error('Enter a valid quantity');
   const item=options.get(line.catalogId);
   if(line.catalogId&&!item)throw Error('An estimate item is unavailable');
   const previous=line.id?existing?.lines.find(item=>item.id===line.id):existing?.lines[index]?.id?undefined:existing?.lines[index];
   const keep=previous&&existing.clientId===client.id&&(existing.pricingProfileId||'')===(profile?.id||'')&&
     previous.catalogId===line.catalogId&&Boolean(previous.override)===Boolean(line.override)&&
     String(previous.rate??'')===String(line.rate??'');
   const scopeKey=typeof line.scopeKey==='string'&&scopes.some(scope=>scope.key===line.scopeKey)?line.scopeKey:'';
   const shared=calculated.find(row=>scopeKey&&row.scopeKey===scopeKey&&row.inputCost!=null);
   const takeoffType=scopeKey&&['material','labor','custom'].includes(line.takeoffType)?line.takeoffType:'';
   const manual=!item||line.override===true;
   let rate=item?.rate??null;
   if(keep)rate=previous.rate;
   else if(manual&&line.rate!==''&&line.rate!=null){
    if(actor.permissions&&!actor.permissions.includes('estimate.override'))throw Error('Manual estimate pricing permission required');
    rate=Number(line.rate);
    if(!Number.isFinite(rate)||rate<0||rate>1e8)throw Error('Enter a valid rate');
   }else if(manual)rate=null;
   let cost=null;
   if(item){const catalog=state.catalog.find(row=>row.id===item.id);if(catalog?.cost!=null&&Number.isFinite(Number(catalog.cost)))cost=Number(catalog.cost);}
   if(shared&&!item){
    if(!officeGrant(actor,'estimate.override'))throw Error('Manual estimate pricing permission required');
    rate=shared.rate;cost=shared.inputCost;
   }
   return {scopeKey,takeoffType,cost,id:previous?.id||randomUUID(),catalogId:item?.id,type:item?.type||'custom',unit:item?.unit||'ea',
    override:Boolean(line.override),description:field(line.description||item?.name,'a line description',300),quantity,rate,
    amount:rate==null?null:Math.round(quantity*rate*100)/100};
  });
  const sharedKeys=calculated.filter(line=>line.inputCost!=null).map(line=>line.scopeKey);
  for(const key of sharedKeys)if(lines.filter(line=>line.scopeKey===key).length!==1||lines.find(line=>line.scopeKey===key).quantity!==1||lines.find(line=>line.scopeKey===key).catalogId)throw Error('Include one calculated line for each shared cost');
  const details={scopes,basedOnId,projectId,options:field(data.options||'','chosen options',1200,true),exclusions:field(data.exclusions||'','exclusions',1200,true),clientId:client.id,pricingProfileId:profile?.id||'',pricingProfileName:profile?.name||'Client and catalog rates',
   billingName:client.business||client.name,billingAddress:client.address,billingEmail:client.email,
   contactId:data.contactId||'',po:field(data.po||'','a client PO',80,true),
   title:field(data.title,'a project name',200),site:field(data.site||'','a jobsite',250,true),
   scope:field(data.scope,'the scope',3000),lines,total:Math.round(lines.reduce((sum,line)=>sum+(line.amount||0),0)*100)/100,revision:randomUUID()};
  if(existing){Object.assign(existing,details);return existing;}
  const sequence=state.meta.estimateSequence=(state.meta.estimateSequence||0)+1;
  const estimate={...details,id:randomUUID(),number:'EST-'+String(sequence).padStart(5,'0'),status:'Draft',createdAt:new Date().toISOString()};
  estimates.unshift(estimate);
  return estimate;
 }
 const estimate=estimates.find(item=>item.id===data.id);
 if(!estimate)throw Error('Estimate unavailable');
 if(action==='estimate.accept'){
  if(estimate.approvalSnapshot?.revision===data.revision)return estimate;
  if(estimate.status!=='Draft'||estimate.revision!==data.revision)throw Error('Only the current draft can be accepted');
  if(!estimate.lines.length||estimate.lines.some(line=>line.rate==null))throw Error('Complete the estimate pricing before recording acceptance');
  const acceptedBy=field(data.acceptedBy,'the client approver',150);
  const signatureData=optionalSignature(data);
  const evidence=signatureData?'Drawn on device':field(data.evidence,'the approval reference',1000);
  if(estimate.scopes?.length){
   if(!officeGrant(actor,'workorder.create')||!officeGrant(actor,'workorders.view'))throw Error('Work-order creation permission required to approve a guided estimate');
   if(!createWorkOrder||!state.projects.some(project=>project.id===estimate.projectId&&project.customerId===estimate.clientId))throw Error('Restore the linked project before approving this estimate');
  }
  const acceptedAt=now();
  estimate.approvalSnapshot=clone({revision:estimate.revision,number:estimate.number,title:estimate.title,site:estimate.site,po:estimate.po,
   billingName:estimate.billingName,billingAddress:estimate.billingAddress,scope:estimate.scope,scopes:estimate.scopes||[],lines:estimate.lines,total:estimate.total,
   options:estimate.options||'',exclusions:estimate.exclusions||'',acceptedBy,evidence,signatureData,acceptedAt,recordedBy:actor.email});
  Object.assign(estimate,{status:'Accepted',acceptedBy,evidence,recordedBy:actor.email,acceptedAt,revision:randomUUID()});
  if(estimate.scopes?.length)createEstimateOrders(state,estimate,createWorkOrder);
  return estimate;
 }
 if(action==='estimate.convert'){
  if(estimate.projectId&&['Accepted','Converted'].includes(estimate.status))return {id:estimate.projectId};
  if(estimate.status!=='Accepted')throw Error('Record client acceptance first');
  const {client}=context(state,{clientId:estimate.clientId});
  const profile=(state.pricingProfiles||[]).find(item=>item.id===estimate.pricingProfileId&&!item.archived);
  if(estimate.pricingProfileId&&!profile)throw Error('Restore the estimate pricing profile before conversion');
  const contactId=data.contactId??estimate.contactId;
  if(contactId&&!client.contacts?.some(item=>item.id===contactId))throw Error('Choose a contact for this client');
  const project=createProject({customerId:estimate.clientId,name:data.title??estimate.title,site:data.site??estimate.site,contactId,po:data.po??estimate.po??''});
  if(estimate.pricingProfileId&&profile)project.pricingProfileId=profile.id;
  project.estimateId=estimate.id;
  project.estimatedScope=estimate.scope;
  Object.assign(estimate,{projectId:project.id,status:'Converted'});
  return project;
 }
 throw Error('Unknown estimate action');
}
