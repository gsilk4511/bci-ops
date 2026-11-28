export const trades={copper:'Copper',fiber:'Fiber',cameras:'Cameras',access:'Access Control',audio:'Audio',video:'Video',shared:'Shared cost'};
export const methods={fixed:'Fixed price',tm:'Time & materials',unit:'Unit price',nte:'T&M not to exceed',rom:'ROM (budget only)'};
export const presets={
 copper:['Standard drops','Test / label existing','Small service','Restricted / phased'],
 fiber:['New preterminated','New field-spliced','Repair / test'],
 cameras:['New','Replace / reuse','Relocate','Cabling only'],
 access:['Standard openings','Cabling only','Client-furnished hardware','Full retrofit','T&M exception'],
 audio:['Paging / music','Event audio','Install only'],video:['Display','Projection','Signage','Conference'],shared:['Lift','Travel','Pathway','Subcontract','Other']
};
const sel=(key,label,choices,opts={})=>({key,label,choices,...opts});
const num=(key,label,unit,opts={})=>({key,label,unit,number:true,...opts});
const txt=(key,label,opts={})=>({key,label,...opts});
export const siteQuestions=[
 sel('building','What kind of site is this?',['New construction','Occupied renovation','Unoccupied renovation','Service call']),
 sel('hours','When can we work?',['Normal hours','After hours','Mixed / phased']),
 sel('ceiling','What is above the ceiling?',['Open structure','Clear drop ceiling','Normal drop ceiling','Congested / ducts','Hard lid','No overhead work']),
 num('height','What is the typical working height?','ft'),
 sel('access','What access is available?',['Ladder','Lift','Escort / restricted','HEPA / containment','Other']),
 sel('pathway','Who provides the pathway?',['Existing usable','BCI installs','Other contractor','No new pathway']),
 num('visits','How many visits or phases?','visits',{suggest:1,min:1,integer:true}),txt('siteNotes','Site conditions, phases or who provides power/backing',{long:true})
];
const count=(k,l,u='each',opts={})=>num(k,l,u,{required:true,min:1,integer:true,...opts});
const responsibility={supply:['BCI','Client','Other contractor']};
export const questions={
 copper:[count('locations','How many locations?','locations'),count('each','How many cables per location?','runs',{suggest:1}),sel('cable','Which cable is specified?',['Cat6 CMR','Cat6 CMP','Cat6A CMR','Cat6A CMP','Outdoor / direct-bury','Other'],{required:true}),num('length','How long is a typical routed run?','ft',{required:true,min:1}),num('longest','What is the longest run?','ft'),num('slack','Service loop per run','ft',{suggest:0}),num('waste','Purchasing waste allowance','%',{suggest:10,max:100}),num('box','Cable per box or reel','ft',{suggest:1000,min:1}),txt('route','Shared route or wall-fishing notes'),num('ends','How many jack ends per cable?','ends',{suggest:2,max:8,integer:true}),num('plates','Faceplates required','each',{suggest:0,integer:true}),num('panels','New patch panels after existing capacity','each',{suggest:0,integer:true}),sel('test','What testing is included?',['Verify and label','Certify and label','Inspect / label only','None']),txt('finish','Color, jack, endpoint or support requirements')],
 fiber:[txt('route','From where to where?',{required:true}),count('runs','How many fiber runs?','runs'),num('length','Routed length per run','ft',{required:true,min:1}),num('slack','Slack per run','ft',{suggest:0}),sel('fiber','What fiber is specified?',['OS2 single-mode','OM3 multimode','OM4 multimode','Other'],{required:true}),count('strands','How many strands per cable?','strands'),sel('routeType','What is the pathway?',['Interior','Riser','Underground','Direct bury','Aerial','Existing']),txt('finish','Armor, end A/B method, connector or enclosure notes'),num('endsA','Strands to splice at end A per run','splices',{suggest:0,integer:true}),num('endsB','Strands to splice at end B per run','splices',{suggest:0,integer:true}),sel('test','What tests are included?',['Loss testing','OTDR','Loss and OTDR','None']),txt('cutover','Outage, optics, patch cords or cutover notes')],
 cameras:[count('count','How many cameras?','cameras'),sel('device','What kind of work?',['New','Replace','Relocate','Cabling only'],{required:true}),sel('environment','Indoor or outdoor?',['Indoor','Outdoor','Mixed']),num('mount','Mounting height','ft'),txt('finish','Camera type, mounting surface and brackets'),sel('cabling','Who is doing the cable?',['New in this scope','Existing / reuse','Already in Copper','Other contractor']),num('length','Typical cable route','ft'),txt('gear','Who provides cameras, network, recording / storage and licenses?'),sel('handoff','What turnover is included?',['Install only','Aim and verify','Commission and train','Other'])],
 access:[count('count','How many openings?','openings'),sel('device','What kind of opening?',['Single','Double','Garage','Mixed / special'],{required:true}),txt('finish','Existing and proposed door/frame, lock, reader, contact and power transfer'),sel('cabling','Who is doing the cable?',['New in this scope','Existing / reuse','Already in Copper','Other contractor']),num('length','Typical route to controller','ft'),txt('gear','Controller, power, credentials and who owns operator/fire coordination'),sel('egress','Is egress/release in this scope resolved?',['Verified and documented','No locking / release work in scope','Needs review'],{required:true}),txt('review','Document the egress review or scope exclusion'),sel('handoff','What turnover is included?',['Install only','Test and hand over','Commission and train','Other'])],
 audio:[count('count','How many speakers or other endpoints?','endpoints'),count('zones','How many audio zones?','zones'),sel('use','What is the room used for?',['Paging','Music','Events','Speech','Mixed'],{required:true}),txt('gear','Speakers, mics, subs, racks, controls and who supplies them'),num('mount','Typical mounting height','ft'),num('length','Typical routed wire length per endpoint','ft'),txt('finish','Mounting style, wire type and reused equipment'),sel('handoff','Who handles commissioning?',['BCI','Client / AV vendor','Install-only handoff']),txt('review','Rack handoff, tests, tuning or training')],
 video:[count('count','How many screens or endpoints?','endpoints'),sel('use','What will the room do?',['Presentation','Signage','TV','Conferencing','Mixed'],{required:true}),sel('device','What are we installing?',['TV / display','Projector and screen','Conferencing equipment','Other']),txt('gear','Size, viewing distance, daylight, mount/lift and backing/power owners'),num('mount','Typical mounting height','ft'),num('length','Typical routed signal cable length','ft'),txt('finish','Sources, HDMI/wireless, room audio and Teams/BYOD'),sel('handoff','Setup and turnover',['Install only','Commission','Commission and train','Other'])],
 shared:[txt('requirements','What is this shared charge for?',{required:true}),num('amount','What is the quoted amount?','$',{required:true}),txt('finish','Delivery, rental days, or party providing the equipment')]
};
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
const clean=(x,max=500)=>{if(typeof x!=='string')return '';if(x.length>max)throw Error('A text field is too long');return x.trim();};
const value=(x,min=0,max=1e7,integer=false)=>{
 if(x===undefined||x===null||x==='')return null;
 if(typeof x==='boolean'||!['string','number'].includes(typeof x)||!String(x).trim()||!Number.isFinite(Number(x))||Number(x)<min||Number(x)>max||integer&&!Number.isInteger(Number(x)))throw Error('Enter a valid number within the indicated range.');
 return Number(x);
};
export const cents=(n)=>Math.round((Number(n)+Number.EPSILON)*100);
const dollars=n=>n/100;
const bounded=(a,n,label)=>{if(a==null)return [];if(!Array.isArray(a)||a.length>n)throw Error('Too many '+label);return a;};
const sanitizeAnswers=(obj,qs)=>{
 const out={};
 for(const q of qs){
  if(!Object.hasOwn(obj||{},q.key))continue;
  const a=obj[q.key];if(a?.mode==='later'||a?.mode==='none'){out[q.key]={mode:a.mode};continue;}
  const mode=a?.mode==='suggested'?'suggested':'answer';
  let v=mode==='suggested'&&q.suggest!==undefined?q.suggest:a?.value;
  if(q.number)v=value(v,q.min??0,q.max??1e6,q.integer);
  else {v=clean(v,1400);if(q.choices&&v&&!q.choices.includes(v))throw Error('Invalid selection: '+q.label);}
  if(v!==''&&v!==null)out[q.key]={mode,value:v};
 }
 return out;
};
export function getAnswer(o,key,fallback=null){const p=o?.[key];return p?.mode==='answer'||p?.mode==='suggested'?p.value:fallback;}
export const taskNames={setup:'Setup / cleanup',pull:'Pull / place / route',mount:'Mount / install',end:'Terminate / splice',test:'Test / label',commission:'Commission / cutover',close:'Closeout'};
export function normalizeDraft(raw){
 if(!raw||raw.version!==2)throw Error('Use the current estimator draft');
 const keys=new Set();
 const scopes=bounded(raw.scopes,18,'scope groups').map(o=>{
  if(!o||!validId(o.id)||keys.has(o.id)||!Object.hasOwn(trades,o.kind)||['inventory','closeout'].includes(o.id))throw Error('Use distinct scope groups');keys.add(o.id);
  const role=['base','option','excluded'].includes(o.role)?o.role:'base';
  const pricing=o.pricing||{};const method=Object.hasOwn(methods,pricing.method)?pricing.method:o.kind==='access'?'unit':o.kind==='shared'?'fixed':'tm';
  return {id:o.id,kind:o.kind,label:clean(o.label,120),area:clean(o.area,120),preset:clean(o.preset,80),role,selected:role==='base'||role==='option'&&o.selected===true,optionGroup:clean(o.optionGroup,70),
   resourceKey:clean(o.resourceKey,80),notes:clean(o.notes,1200),exclusions:clean(o.exclusions,800),source:clean(o.source,250),answers:sanitizeAnswers(o.answers,questions[o.kind]),
   conditions:sanitizeAnswers(o.conditions,siteQuestions),
   labor:Object.fromEntries(Object.keys(taskNames).map(k=>[k,value(o.labor?.[k],0,100000)])),
   laborMode:o.laborMode==='rules'?'rules':'manual', laborBasis:o.laborBasis==='crew'?'crew':'person',crew:value(o.crew,1,50,true)??1,
   laborItem:clean(o.laborItem,100),laborRate:value(o.laborRate),laborUnitCost:value(o.laborUnitCost),laborRateUnit:o.laborRateUnit==='crew'?'crew':'person',noLabor:o.noLabor===true,
   pricing:{method,rate:value(pricing.rate),qty:value(pricing.qty,0,1e6),cap:value(pricing.cap),high:value(pricing.high),
    unit:clean(pricing.unit,60),basis:clean(pricing.basis,500),includes:clean(pricing.includes,500),billing:pricing.billing==='actual'?'actual':'agreed'},
   skipDerived:o.skipDerived===true,
   items:bounded(o.items,32,'scope lines').map((line,j)=>({key:'m'+j,catalogId:clean(line.catalogId,100),description:clean(line.description,240),
    type:['material','labor','custom','travel'].includes(line.type)?line.type:'material',
    unit:clean(line.unit,40),qty:value(line.qty,0,1e6),rate:value(line.rate),unitCost:value(line.unitCost),owner:['BCI','Client','Other contractor'].includes(line.owner)?line.owner:'BCI',override:line.override===true})),
   matches:{cable:clean(o.matches?.cable,100),jack:clean(o.matches?.jack,100),plate:clean(o.matches?.plate,100),panel:clean(o.matches?.panel,100),splice:clean(o.matches?.splice,100)}
  };
 });
 const term=raw.terms||{};
 return {version:2,path:['plan','walkthrough'].includes(raw.path)?raw.path:'',site:sanitizeAnswers(raw.site,siteQuestions),scopes,
  importKeys:bounded(raw.importKeys,30,'takeoff revisions').map(x=>clean(x,160)).filter(Boolean),
  plans:bounded(raw.plans,16,'plan references').map(x=>({id:clean(x.id,80),name:clean(x.name,180),revision:clean(x.revision,100),role:x.role==='governing'?'governing':'reference'})),
  terms:{note:clean(term.note,1500),deliverables:clean(term.deliverables,1400),warranty:clean(term.warranty,700),change:clean(term.change,900),tax:value(term.tax)??0,basis:term.basis==='amount'?'amount':'percent',
   payments:bounded(term.payments,8,'payment milestones').map(x=>({label:clean(x.label,140),due:clean(x.due,80),value:value(x.value)}))},
  packagePrice:value(raw.packagePrice),overallCap:value(raw.overallCap),packageNote:clean(raw.packageNote,800),
  relationship:['replacement','additive','credit'].includes(raw.relationship)?raw.relationship:'',reason:clean(raw.reason,500),ruleVersion:clean(raw.ruleVersion,80)};
}
export function newDraft(){return {version:2,path:'',site:{},scopes:[],terms:{payments:[],basis:'percent'},plans:[],importKeys:[]};}
export function newScope(kind,id){return {kind,id,role:'base',selected:true,answers:{},conditions:{},items:[],matches:{},labor:{},pricing:{method:kind==='access'?'unit':kind==='shared'?'fixed':'tm'}};}
const quoted=(q,label)=>q===null?null:label+' '+q;
export function scopeQuantities(s){
 const a=(k,f=null)=>getAnswer(s.answers,k,f), t={};
 if(s.kind==='copper'){
  const k=s.preset==='Test / label existing';const locations=a('locations'), each=a('each',1);t.runs=locations==null?null:locations*each;
  t.ft=k?0:t.runs==null||a('length')==null?null:t.runs*(a('length')+a('slack',0));
  t.boxes=t.ft==null?null:Math.ceil(t.ft*(1+a('waste',10)/100)/a('box',1000));
  t.ends=k?0:t.runs==null?null:t.runs*a('ends',2);t.plates=a('plates',0);t.panels=a('panels',0);
 }else if(s.kind==='fiber'){t.runs=a('runs');t.ft=t.runs==null||a('length')==null?null:t.runs*(a('length')+a('slack',0));t.splices=t.runs==null?null:t.runs*(a('endsA',0)+a('endsB',0));}
 else if(s.kind==='shared') t.runs=1;
 else t.runs=a('count');
 return t;
}
export function scopeDescription(s){
 const q=scopeQuantities(s), bits=[s.area, s.preset];
 if(s.kind==='copper')bits.push(q.runs==null?'':q.runs+' cable runs', getAnswer(s.answers,'cable',''),quoted(q.ft,'Routed feet:'));
 else if(s.kind==='fiber')bits.push(getAnswer(s.answers,'route',''),getAnswer(s.answers,'fiber',''),quoted(q.runs,'Runs:'),quoted(q.ft,'Routed feet:'),quoted(q.splices,'Splices:'));
 else if(s.kind==='shared')bits.push(getAnswer(s.answers,'requirements',''));
 else bits.push(quoted(q.runs,s.kind==='access'?'Openings:':'Endpoints:'),getAnswer(s.answers,'device',''),getAnswer(s.answers,'use',''));
 for(const k of ['finish','test','gear','cabling','handoff','cutover']){const a=getAnswer(s.answers,k);if(a)bits.push(a);}
 return bits.filter(Boolean).join(' · ');
}
const units={cable:/^(box(?:es)?|reel[s]?|spool[s]?)$/i,foot:/^(ft|feet|foot|linear foot)$/i,each:/^(ea|each|pcs?|unit[s]?)$/i,hour:/^(h|hr[s]?|hours?|person.hours?|tech.hours?|crew.hours?)$/i};
export function computeWorkflow(w,{items=[],rules=null}={}){
 const itemsById=new Map(items.map(x=>[x.id,x])), issues=[], scoped=[], lines=[], groups=new Set(),resources=new Set();let money=0, cost=0, unknownCost=0;
 const issue=(scope,message)=>issues.push({scope:scope?.id||'',message});
 for(const s of w.scopes){
  const included=s.selected&&s.role!=='excluded', q=scopeQuantities(s), a=(k,f=null)=>getAnswer(s.answers,k,f);
  const local=(message)=>{if(included)issue(s,message);};
  if(included&&s.kind==='shared'&&s.resourceKey){const k=s.resourceKey.toLowerCase();if(resources.has(k))local('Duplicate shared resource: '+s.resourceKey);resources.add(k);}
  if(included&&s.optionGroup){if(groups.has(s.optionGroup))local('Select only one option in '+s.optionGroup);groups.add(s.optionGroup);}
  for(const p of questions[s.kind])if(s.answers[p.key]?.mode==='later'&&!p.required)local('Confirm deferred answer: '+p.label);
  for(const p of questions[s.kind])if(p.required&&a(p.key)==null&&!(s.kind==='copper'&&s.preset==='Test / label existing'&&['length','cable'].includes(p.key)))local(p.label);
  if(s.kind==='copper'&&s.preset!=='Test / label existing'&&a('longest')!=null&&a('longest')+a('slack',0)>a('box',1000))local('Longest cut exceeds a box or reel; choose a viable cable package');
  if(s.kind==='fiber'&&(a('endsA',0)>a('strands',0)||a('endsB',0)>a('strands',0)))local('Splices per end exceed strand count');
  if(s.kind==='copper'&&a('longest')!=null&&a('length')!=null&&a('longest')<a('length'))local('Longest run cannot be shorter than the average');
  if(s.kind==='access'&&(a('egress')==='Needs review'||a('egress')==='Verified and documented'&&!a('review')))local('Resolve and document egress/release, or exclude this opening');
  const sl=[];
  const add=(line, unitCheck)=>{
   if(!line.quantity)return;let i;
   if(line.catalogId){i=itemsById.get(line.catalogId);if(!i){local('Catalog item unavailable: '+line.description);return;}
    if(i.type!==line.type){local('Choose a catalog item of the correct type: '+line.description);return;}
    if(unitCheck&&!units[unitCheck].test(String(i.unit||'').trim())){local('Catalog unit does not match '+line.description);return;}
   }
   const rate=line.owner&&line.owner!=='BCI'?0:line.override||!i?line.rate??null:i.rate??null;
   const c=line.owner&&line.owner!=='BCI'?0:line.unitCost??i?.cost??null;
   const amount=rate==null?null:cents(line.quantity*rate);
   sl.push({scopeKey:s.id,takeoffType:line.type,type:line.type,catalogId:i?.id,description:line.description||i?.name||'',quantity:line.quantity,unit:i?.unit||line.unit||'ea',rate,amount:amount==null?null:dollars(amount),cost:c,override:Boolean(line.override),owner:line.owner||'BCI'});
  };
  if(!s.skipDerived){
   const d=(k,desc,n,check,unit)=>add({catalogId:s.matches[k],description:desc,quantity:n,type:'material',unit},check);
   if(s.kind==='copper'){
    const hit=itemsById.get(s.matches.cable);
    const byFoot=units.foot.test(String(hit?.unit||'').trim());
    const actualBox=Number(hit?.catalogInfo?.packageLengthFt??hit?.packageLengthFt);
    if(!byFoot&&Number.isFinite(actualBox)&&actualBox>0&&actualBox!==a('box',1000))local('Cable package length differs from the selected catalog item');
    const cableCat=/^Cat(?:egory)?[ -]*(6A|6)\b/i.exec(a('cable',''))?.[1]?.toLowerCase();
    const jackCat=/Cat(?:egory)?[ -]*(6A|6|5e|8)\b/i.exec(itemsById.get(s.matches.jack)?.name||'')?.[1]?.toLowerCase();
    if(cableCat&&jackCat&&cableCat!==jackCat)local('Selected jack does not match the specified cable category');
    d('cable',(a('cable','Copper'))+' cable',byFoot?q.ft:q.boxes,byFoot?'foot':'cable',byFoot?'ft':'box');d('jack','Cable jacks',q.ends,'each','ea');d('plate','Faceplates',q.plates,'each','ea');d('panel','Patch panels',q.panels,'each','ea');}
   if(s.kind==='fiber'){if(s.preset!=='Repair / test')d('cable',(a('fiber','Fiber'))+' cable',q.ft,'foot','ft');d('splice','Splice consumables',q.splices,'each','ea');}
  }
  const rated=s.laborMode==='rules'&&rules?.trades?.[s.kind];
  const condition=(k)=>getAnswer(s.conditions,k,getAnswer(w.site,k));
  const taskHours={};
  if(s.kind!=='shared'&&!s.noLabor){
   for(const k of Object.keys(taskNames)){
    let h=s.labor[k];
    if(h==null&&rated){
     const z=rated[k];
     if(z){h=(z.fixed||0)*(k==='setup'?getAnswer(s.conditions,'visits',getAnswer(w.site,'visits',1)):1)+(z.perUnit||0)*(q.runs??0)+(z.perFoot||0)*(q.ft??0)+(z.perEnd||0)*(s.kind==='fiber'?q.splices??0:q.ends??0);
      if(k==='pull'&&condition('ceiling')==='Congested / ducts')h*=rules.congestedPull??1;
      if(k==='pull'&&condition('access')==='HEPA / containment')h*=rules.hepaPull??1;
     }
    }else if(h!=null&&s.laborBasis==='crew')h*=s.crew;
    if(h>0)taskHours[k]=Math.round(h*1000)/1000;
   }
   if(!Object.keys(taskHours).length)local('Enter measured labor or use a released recipe; confirm no BCI labor if applicable');
   const item=itemsById.get(s.laborItem);
   if(s.laborItem&&/crew/i.test(item?.name||'')&&!/crew.hours?/i.test(item?.unit||''))local('Crew service rate has an ambiguous unit; choose explicit crew-hour or person-hour');
   if(s.laborItem&&/crew.hours?/i.test(item?.unit||'')&&s.crew<2)local('Enter the crew size for this crew-hour service');
   const crewRate=(/crew.hours?/i.test(item?.unit||'')||!item&&s.laborRateUnit==='crew')&&s.crew>1;
   if(!item&&s.laborRate!=null&&s.laborRateUnit==='crew'&&s.crew<2)local('Enter the crew size for the manual crew-hour rate');
   for(const [k,h] of Object.entries(taskHours))add({catalogId:s.laborItem,description:taskNames[k],quantity:crewRate?h/s.crew:h,type:'labor',unit:crewRate?'crew-hour':'person-hour',rate:s.laborRate,unitCost:s.laborUnitCost==null?null:s.laborUnitCost*(crewRate?s.crew:1)},'hour');
  }
  for(const m of s.items){
   if(m.description||m.catalogId){if(!m.qty)local('Enter quantity for '+(m.description||'catalog line'));
    add({catalogId:m.catalogId,description:m.description,quantity:m.qty,unit:m.unit,rate:m.rate,unitCost:m.unitCost,type:m.type,owner:m.owner,override:m.override},null);}
  }
  if(s.kind==='shared')add({description:a('requirements','Shared cost'),quantity:1,type:'custom',unit:'each',rate:a('amount')},null);
  const p=s.pricing, subtotal=sl.reduce((x,y)=>x+(y.amount==null?0:cents(y.amount)),0);
  let sell=subtotal, high=null;
  if(p.method==='unit'){const n=p.qty??(/^(ft|foot|feet)$/i.test(p.unit)?q.ft:/splic/i.test(p.unit)?q.splices:q.runs);s.resolvedQty=n;if(p.rate==null||!n||!p.unit||!p.includes)local('Set unit price, quantity, unit and included work');sell=p.rate!=null&&n?cents(p.rate*n):0;}
  if(p.method==='fixed'){if(p.rate==null&&s.kind!=='shared')local('Enter the fixed scope price');sell=p.rate==null?subtotal:cents(p.rate);}
  if(p.method==='rom'){if(p.rate==null||p.high==null||p.high<p.rate)local('Enter a valid low and high budget');sell=cents(p.rate??0);high=cents(p.high??0);if(included)issue(s,'ROM is budget only and cannot authorize work');}
  if(p.method==='tm'||p.method==='nte'){
   if(sl.some(x=>x.rate==null)||(!sl.length&&s.kind!=='shared'))local('Price all T&M lines');
   if(!p.basis)local('State material, labor, travel and equipment billing basis');
   if(p.method==='nte'&&(p.cap==null||cents(p.cap)<sell))local('Set a ceiling no lower than the working budget');
  }
  if(included){
   money+=sell;
   for(const l of sl){if(l.cost==null){unknownCost++;}else cost+=cents(l.cost*l.quantity);}
   lines.push(...sl);
  }
  scoped.push({key:s.id,kind:s.kind,label:s.label||trades[s.kind],scope:scopeDescription(s),options:s.notes,exclusions:s.exclusions,included,role:s.role,desc:s.source,pricing:p,qty:s.resolvedQty??p.qty??q.runs,amount:dollars(sell),high:high==null?null:dollars(high),q,taskHours,lines:sl});
 }
 if(Object.keys(w.site).some(k=>w.site[k].mode==='later'))issue(null,'Review deferred job conditions');
 if(!w.path)issue(null,'Choose plan takeoff or site walkthrough');
 if(!scoped.some(x=>x.included&&x.kind!=='shared'))issue(null,'Include at least one trade scope');
 const working=money;
 if(w.packagePrice!=null){
  if(!w.packageNote)issue(null,'Define what the fixed package covers');
  if(scoped.some(x=>x.included&&['rom','nte'].includes(x.pricing.method)))issue(null,'Resolve budget/capped options before offering a fixed package');
  money=cents(w.packagePrice);
 }
 const sign=w.relationship==='credit'?-1:1, tax=cents(w.terms.tax)*sign, total=money*sign+tax;
 if(w.overallCap!=null){
  if(!w.packageNote)issue(null,'State what the project ceiling covers');
  if(w.relationship==='credit'||w.packagePrice!=null||scoped.some(s=>s.included&&s.pricing.method==='rom'))issue(null,'An overall ceiling cannot be combined with a credit, ROM or fixed package');
  if(cents(w.overallCap)<total)issue(null,'Project ceiling is below the working total');
 }
 const pays=w.terms.payments;let payments=[];
 if(pays.length){
  if(pays.some(p=>!p.label||p.value==null))issue(null,'Complete each payment milestone');
  const target=w.terms.basis==='amount'?total:10000;
  const allocation=pays.reduce((a,p)=>a+cents(p.value??0),0);
  if(allocation!==target)issue(null,w.terms.basis==='amount'?'Milestones must equal the agreement total':'Milestone percentages must total 100%');
  let spent=0;payments=pays.map((p,i)=>{const n=w.terms.basis==='amount'?cents(p.value??0):i===pays.length-1?total-spent:Math.round(total*(p.value??0)/100);spent+=n;return {...p,amount:dollars(n)};});
 }
 if(w.relationship&&!w.reason)issue(null,'Describe what this revision changes');
 if(w.relationship==='credit'&&w.terms.payments.length)issue(null,'Do not enter payment milestones for a credit; record it with the base agreement');
 return {scoped,lines,issues,payments,working:dollars(working),subtotal:dollars(money*sign),tax:dollars(tax),total:dollars(total),cost:dollars(cost),unknownCost};
}
export function takeoffGroups(input){
 if(!input||input.version!==1||typeof input.fingerprint!=='string'||!/^[a-zA-Z0-9_-]{5,160}$/.test(input.fingerprint)||!Number.isInteger(input.pageCount)||input.pageCount<1||input.pageCount>2000||!Array.isArray(input.types)||input.types.length>80||!Array.isArray(input.marks)||input.marks.length>15000)throw Error('Choose a BCI Takeoff Lab project JSON');
 const types=new Map(input.types.map(t=>[t.id,{label:clean(t.label,120),jacks:value(t.jacks,0,20,true)??0}]));
 const out=new Map();
 for(const m of input.marks){
  if(!Number.isInteger(m?.page)||m.page<1||m.page>input.pageCount)throw Error('Invalid takeoff sheet');
  if(m.kind==='count'&&types.has(m.type)){
   const k=m.page+'|'+m.type,o=out.get(k)||{key:k,sheet:m.page,...types.get(m.type),count:0};o.count++;out.set(k,o);
  }else if(m.kind==='route'){
   const k=m.page+'|route|'+clean(m.label||'Route',90),scale=value(input.scales?.[m.page],0,1e6);let feet=null;
   const points=bounded(m.points,3000,'route points');
   if(scale&&points.length>1){feet=0;for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],x=value(b?.x,0,1e6),y=value(b?.y,0,1e6),xx=value(a?.x,0,1e6),yy=value(a?.y,0,1e6);if([x,y,xx,yy].some(p=>p===null))throw Error('Invalid point');feet+=Math.hypot(x-xx,y-yy)*scale;}}
   const o=out.get(k)||{key:k,sheet:m.page,label:clean(m.label||'Route',90),feet:0,routedFeet:0,unscaled:0,count:0};o.count++;if(feet==null)o.unscaled++;else{o.feet+=feet;o.routedFeet+=feet*(value(m.cables,1,100000,true)??1);}out.set(k,o);
  }
 }
 return {fingerprint:input.fingerprint,name:clean(input.name,180),groups:[...out.values()].slice(0,300)};
}
