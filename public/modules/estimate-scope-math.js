const money=n=>Math.round(n*100)/100;
const num=(input,label,{min=0,max=1e6,integer=false}={})=>{
 if(!['string','number'].includes(typeof input)||String(input).trim()===''||!Number.isFinite(Number(input))||Number(input)<min||Number(input)>max||(integer&&!Number.isInteger(Number(input))))throw Error('Enter a valid '+label);
 return Number(input);
};
const str=(input,label,max=160,required=false)=>{
 const value=typeof input==='string'?input.trim():'';
 if(value.length>max||(required&&!value))throw Error('Enter '+label);
 return value;
};
export function normalizeEstimateScopes(input){
 if(!Array.isArray(input)||input.length>12)throw Error('Use at most 12 scope sections');
 const ids=new Set();
 return input.map((raw,index)=>{
  if(!raw||!['copper','fiber','lift','shared'].includes(raw.kind))throw Error('Choose a scope type');
  const {kind}=raw,key=str(raw.key||String(index+1),'scope key',60,true);
  if(!/^[a-zA-Z0-9_-]+$/.test(key)||ids.has(key)||['inventory','closeout'].includes(key))throw Error('Each scope must have a distinct reference');ids.add(key);
  const entry={kind,key,label:str(raw.label,'a scope label',120),exclusions:str(raw.exclusions,'scope exclusions',500),options:str(raw.options,'scope options',500)};
  const t=(k,label,max,required=true)=>entry[k]=str(raw[k],label,max,required);
  const n=(k,label,min,max,integer=false)=>entry[k]=num(raw[k],label,{min,max,integer});
  const catalogs=keys=>keys.forEach(k=>t(k,k,100,false));
  if(kind==='copper'){
   t('building','building type',100);t('access','pathway/access conditions',100);t('category','cable category',50);t('cableType','cable type',80);t('jack','jack brand/model',100);
   n('drops','drop count',1,100000,true);n('avgLength','average run length',1,10000);n('boxLength','cable length per box',1,10000);
   n('waste','cable allowance %',0,100);n('jacksPerDrop','jacks per drop',0,8,true);n('portsPerPlate','ports per plate',1,100,true);n('portsPerPanel','ports per panel',1,100,true);n('hoursPerDrop','tech-hours per drop',0.001,100);
   catalogs(['cableId','jackId','plateId','panelId','laborId']);
  }else if(kind==='fiber'){
   t('route','fiber route',400);t('fiberType','fiber type',100);t('endA','termination A',100);t('endB','termination B',100);t('testing','testing and labeling requirements',220);
   n('length','fiber length',1,1e6);n('strands','strand count',1,1728,true);n('hours','estimated tech-hours',0.01,100000);
   n('terminatedPerEnd','terminated strands per end',0,1728,true);
   if(entry.terminatedPerEnd>entry.strands)throw Error('Terminated strands exceed the strand count');
   catalogs(['fiberId','terminationAId','terminationBId','laborId']);
  }else{
   t('label','equipment or shared cost description',120);t('requirements','requirements',400,false);
   if(kind==='lift'&&!['flat','daily'].includes(raw.rateMode))throw Error('Select a lift rate method');
   entry.rateMode=kind==='shared'?'flat':raw.rateMode;
   if(entry.rateMode==='daily'){n('days','rental days',1,365,true);n('daily','daily rental cost',0,1e6);n('delivery','delivery cost',0,1e6);n('pickup','pickup cost',0,1e6);}
   else n('flat','flat cost',0,1e7);
   n('markup','shared cost markup %',0,10000);
  }
  return entry;
 });
}
export function scopeLines(scopes){
 const lines=[];
 for(const s of scopes){
  const add=(type,id,description,quantity,rate=null,inputCost=null)=>{
   if(quantity>0)lines.push({scopeKey:s.key,takeoffType:type,type:id?type:'custom',catalogId:id||undefined,description,quantity,rate,inputCost,override:false});
  };
  if(s.kind==='copper'){
   const match=(label,category)=>{
    const pattern=/(?:cat(?:egory)?[\s-]*)?(6a|6|5e|8)(?:\b|$)/i;
    return pattern.exec(label)?.[1]?.toLowerCase()===pattern.exec(category)?.[1]?.toLowerCase();
   };
   if(!match(s.jack,s.category)&&/cat(?:egory)?[\s-]*(?:6a|6|5e|8)\b/i.test(s.jack))throw Error('Choose a jack rated for '+s.category);
   add('material',s.cableId,s.category+' '+s.cableType+' cable · boxes',Math.ceil(s.drops*s.avgLength*(1+s.waste/100)/s.boxLength));
   add('material',s.jackId,s.jack+' jacks',s.drops*s.jacksPerDrop);
   add('material',s.plateId,'Faceplates',Math.ceil(s.drops/s.portsPerPlate));
   add('material',s.panelId,'Patch panels',Math.ceil(s.drops/s.portsPerPanel));
   add('labor',s.laborId,'Copper install, terminate, test and label · tech-hours',s.drops*s.hoursPerDrop);
  }else if(s.kind==='fiber'){
   add('material',s.fiberId,s.strands+'-strand '+s.fiberType+' cable · feet',s.length);
   add('material',s.terminationAId,'End A · '+s.endA,s.terminatedPerEnd);
   add('material',s.terminationBId,'End B · '+s.endB,s.terminatedPerEnd);
   add('labor',s.laborId,'Fiber install, terminate, test and label · tech-hours',s.hours);
  }else{
   const cost=money(s.rateMode==='daily'?s.days*s.daily+s.delivery+s.pickup:s.flat);
   add('custom','',s.label,1,money(cost*(1+s.markup/100)),cost);
  }
 }
 return lines;
}
