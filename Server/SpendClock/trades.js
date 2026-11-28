export const tradeDefaults=[
 {id:'low-voltage',name:'Low voltage',scope:'Structured cabling, fiber, security, access, and communications wiring. Excludes HVAC building controls and branch power.'},
 {id:'electrical',name:'Electrical',low:5,high:12,scope:'Service, distribution, branch circuit, lighting, and equipment power. Excludes low voltage and building automation in this model.'},
 {id:'hvac',name:'HVAC',low:6,high:15,scope:'Heating, ventilation, cooling, and mechanical distribution. Excludes separately scoped building automation and plumbing.'},
 {id:'automation',name:'Building automation',low:.5,high:2.5,scope:'Building controls, sensors, integration, and commissioning. Excludes general business networking and stand-alone plant process controls.'},
 {id:'plumbing',name:'Plumbing',low:3,high:9,scope:'Domestic water, sanitary/drainage, fixtures, and related plumbing. Excludes hydronic HVAC and fire suppression.'},
 {id:'carpentry',name:'Carpentry',low:4,high:12,scope:'Framing, blocking, interior finish and trim. Does not include every structural system, or all casework.'}
];
export function readTradeShares(defaults){
 let saved=null;try{saved=JSON.parse(localStorage.getItem('bci-trade-shares-v1')||'null');}catch{}
 return defaults.map(t=>{
  const v=saved?.[t.id];
  return t.id!=='low-voltage'&&Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&n>=0&&n<=100)?{...t,low:Math.min(...v),high:Math.max(...v)}:t;
 });
}
export function tradeEstimates(model,shares){
 const scope=model.slice(2), value=scope.reduce((v,p)=>v+(p?.annual||0),0);
 return shares.map(t=>({...t,annual:scope.some(x=>!x)?null:t.id==='low-voltage'?scope.reduce((a,v)=>[a[0]+v.low,a[1]+v.high],[0,0]):[value*t.low/100,value*t.high/100]}));
}
export function marketSelection(rows,states,stateBox,regionBox,townBox,onChange){
 const p=new URLSearchParams(location.search);
 const market=p.get('market'), requested=(p.get('state')||'').toLowerCase();
 let chosen=rows.find(r=>r.id===market);
 if(!chosen)chosen=rows.find(r=>r.id===requested)||rows.find(r=>r.id==='metro')||rows[0];
 const regions=key=>rows.filter(r=>r.state===key&&r.kind!=='town'&&r.kind!=='state');
 const countyOf=r=>r.fips?.length===10?r.fips.slice(0,5):rows.find(x=>x.state===r.state&&x.kind==='county'&&x.label===r.parent)?.fips;
 const scopeHas=(r,scope)=>!scope||r.region===scope.id||((scope.counties||[]).includes(countyOf(r)));
 const reqRegion=regions(chosen.state).find(r=>r.id===p.get('region'));
 let state=chosen.state, region=chosen.kind==='state'?'':chosen.kind!=='town'?chosen.id:reqRegion&&scopeHas(chosen,reqRegion)?reqRegion.id:(chosen.region||''), town=chosen.kind==='town'?chosen.id:'';
 const opts=(box,list,active)=>{box.replaceChildren(...list.map(([value,label])=>new Option(label,value)));box.value=active;};
 function draw(){
  const available=regions(state);
  opts(stateBox,states.map(r=>[r.id,r.label]),state);
  if(state==='vt'){
   const group=(label,list)=>{const g=document.createElement('optgroup');g.label=label;g.append(...list.map(r=>new Option(r.label,r.id)));return g;};
   const counties=available.filter(r=>r.kind==='county').sort((a,b)=>a.label.localeCompare(b.label));
   const areas=available.filter(r=>r.kind!=='county');
   regionBox.replaceChildren(new Option('Entire state',''),group('County groups',areas.filter(r=>r.counties?.length>1)),group('All 14 Vermont counties',counties),group('City-area shortcuts',areas.filter(r=>!(r.counties?.length>1))));
   regionBox.value=region;
  }else opts(regionBox,[['','Entire state'],...available.map(r=>[r.id,r.label])],region);
  const scope=available.find(r=>r.id===region);
  const towns=rows.filter(r=>r.state===state&&r.kind==='town'&&scopeHas(r,scope)).sort((a,b)=>(b.econ?.[0]||0)-(a.econ?.[0]||0)||a.label.localeCompare(b.label));
  opts(townBox,[['',region?'Entire region':'No town selected'],...towns.map(r=>[r.id,r.label+(r.econ?.[0]>0?' · '+r.econ[0].toLocaleString('en-US'):'')])],town);
  townBox.disabled=!towns.length;
 }
 function apply(remember=true){
  const key=town||region||state;
  const selected=rows.find(r=>r.id===key)||rows.find(r=>r.id===state);
  draw();
  if(remember){const u=new URL(location.href);u.searchParams.set('state',state);u.searchParams.set('market',selected.id);if(region)u.searchParams.set('region',region);else u.searchParams.delete('region');history.replaceState(null,'',u);}
  onChange(selected.id,region);
 }
 stateBox.onchange=()=>{state=stateBox.value;region='';town='';apply();};
 regionBox.onchange=()=>{region=regionBox.value;town='';apply();};
 townBox.onchange=()=>{town=townBox.value;apply();};
 apply(false);
 return {select:(key)=>{const r=rows.find(x=>x.id===key);if(!r)return;state=r.state;region=r.kind==='state'?'':r.kind!=='town'?r.id:scopeHas(r,regions(r.state).find(x=>x.id===region))&&regions(r.state).some(x=>x.id===region)?region:(r.region||'');town=r.kind==='town'?r.id:'';apply();}};
}
export function configureTradeInputs(host,defaults,readTradeShares,onChange){
 const title=document.createElement('h3');title.textContent='Other trade share assumptions';
 const p=document.createElement('p');p.className='small';p.textContent='Starting scenario percentages of modeled private commercial and industrial construction, not measured trade shares. Power, controls, HVAC, plumbing and carpentry are separate scope definitions here; packages often overlap in real bids.';
 const grid=document.createElement('div');grid.className='market-inputs';
 const fields=[];
 for(const t of readTradeShares(defaults).slice(1)){
  const box=document.createElement('div'), h=document.createElement('strong');h.className='small';h.textContent=t.name;h.title=t.scope;box.append(h);
  const pair=document.createElement('div');pair.className='market-share-pair';
  for(const [i,value] of [t.low,t.high].entries()){
   const lab=document.createElement('label'), input=document.createElement('input');lab.textContent=i?'High %':'Low %';input.setAttribute('aria-label',t.name+' '+(i?'high':'low')+' percent');
   input.type='number';input.min='0';input.max='100';input.step='.1';input.value=value;
   fields.push({id:t.id,input,i});lab.append(input);pair.append(lab);
  }
  box.append(pair);grid.append(box);
 }
 grid.addEventListener('input',()=>{
  if(fields.some(x=>x.input.value===''||!x.input.validity.valid))return;
  const values={};for(const {id,i,input} of fields)(values[id]??=[])[i]=Number(input.value);
  try{localStorage.setItem('bci-trade-shares-v1',JSON.stringify(values));}catch{}
  onChange();
 });
 const reset=document.createElement('button');reset.type='button';reset.className='action';reset.textContent='Reset trade shares';reset.onclick=()=>{
  try{localStorage.removeItem('bci-trade-shares-v1');}catch{}
  configureTradeInputs(host,defaults,readTradeShares,onChange);onChange();
 };
 host.replaceChildren(title,p,grid,reset);
}
