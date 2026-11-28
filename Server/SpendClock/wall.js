export const wallMarkup=`
<main class="wall">
 <header class="wall-head">
   <div><div class="eyebrow">TRADE MARKET CLOCK</div><h1>Vermont Spend Clock</h1><p>Where construction dollars turn into trade work.</p></div>
   <div class="head-controls"><a class="button" href="/admin/spend-clock/map">U.S. heat map</a><a class="button" id="details-top" href="/admin/spend-clock/details">Market details</a><button id="pause" class="button" type="button" aria-pressed="false">Pause clock</button></div>
 </header>
 <div class="wall-status"><span id="source-status">Checking data releases</span><span id="clock-date">Vermont time</span></div>
 <div class="filters" role="group" aria-label="Choose a trade market"><label for="state-wall-select">State <select id="state-wall-select"></select></label><label for="region-wall-select">Region <select id="region-wall-select"></select></label><label for="town-wall-select">Town or city <select id="town-wall-select"></select></label></div>
 <section aria-labelledby="vt-head"><div class="section-head"><h2 id="vt-head">Statewide economy</h2><span>PUBLIC DATA</span></div><div class="clock-grid" id="state-wall"></div></section>
 <section aria-labelledby="market-head">
   <div class="section-head select-head"><div><h2 id="market-head">Local construction</h2><div class="subline" id="market-scope"></div></div></div>
   <div class="clock-grid" id="local-wall"></div>
 </section>
 <section aria-labelledby="trade-head"><div class="section-head"><h2 id="trade-head">Local trade signals</h2><span>NEW BUILDING ACTIVITY</span></div><div class="clock-grid" id="trade-wall"></div></section>
 <section aria-labelledby="opportunity-head"><div class="section-head"><h2 id="opportunity-head">Trade opportunity</h2><span>PRIVATE COMMERCIAL + INDUSTRIAL · MODELED</span></div><div class="clock-grid" id="opportunity-wall"></div></section>
 <footer class="wall-footer"><span>Dollar clocks pace annual estimates at two ticks per second. They don’t show live payments. Tiles overlap; don’t add them together.</span><nav aria-label="More data"><a id="wall-details" href="/admin/spend-clock/details">Town comparisons &amp; assumptions</a><a id="wall-campaigns" href="/admin/spend-clock/campaigns">Campaign ideas</a><a href="/admin/spend-clock/feed.xml">RSS</a><a href="/admin/spend-clock/api/economy.json">JSON</a></nav></footer>
 <dialog id="metric-info" aria-labelledby="metric-title"><div class="dialog-top"><span id="metric-kind"></span><form method="dialog"><button class="button" type="submit" aria-label="Close number details">Close</button></form></div><h2 id="metric-title"></h2><p id="metric-reading"></p><p id="metric-text"></p><div id="metric-links"></div></dialog>
</main>`;
export const wallCss=`
:root{color-scheme:dark;--bg:#111816;--panel:#19231e;--border:#39493f;--fg:#f1f4e9;--sub:#aebdb0;--mint:#adf1bc;--gold:#f5d391;--sky:#a3ddfa;--rose:#ffc0b1;font:16px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}a{color:var(--sky)}button,select{font:inherit}button{cursor:pointer}
.wall{max-width:1640px;margin:auto;padding:1.45rem clamp(.8rem,2vw,2.5rem) 1.5rem}
.wall-head,.section-head,.head-controls,.wall-status{display:flex;align-items:center;justify-content:space-between;gap:.6rem}
.wall-head{align-items:end}.head-controls{justify-content:flex-end;flex-wrap:wrap}
.eyebrow{color:var(--mint);font-size:.73rem;font-weight:800;letter-spacing:.2em}
h1{margin:.13rem 0;font-size:clamp(2rem,4vw,4.4rem);line-height:1.06;letter-spacing:-.055em}
.wall-head p{margin:.35rem 0 .08rem;color:var(--sub)}
.button,select{border:1px solid var(--border);border-radius:.22rem;background:var(--panel);color:var(--fg);padding:.4rem .65rem;text-decoration:none;font-size:.87rem;white-space:nowrap}
.button:hover,select:hover,.info:hover{border-color:var(--mint);color:var(--mint)}:focus-visible{outline:2px solid var(--sky);outline-offset:3px}
.wall-status{margin:.85rem 0 .9rem;min-height:1.8rem;border-block:1px solid var(--border);font-size:.77rem;color:var(--sub);font-variant-numeric:tabular-nums}.wall-status span:first-child::before{content:'●';color:var(--mint);font-size:.6rem;margin-right:.4rem}
section+section{margin-top:1.05rem}
.section-head{align-items:end;margin:0 0 .4rem;border-bottom:1px solid var(--border);padding-bottom:.38rem}.section-head h2{font-size:clamp(1.05rem,1.6vw,1.4rem);margin:0;letter-spacing:-.025em}.section-head>span,.subline{color:var(--sub);font-size:.72rem;letter-spacing:.08em}.subline{letter-spacing:0}
.filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;margin-bottom:.95rem}.filters label{color:var(--sub);font-size:.78rem;display:grid;gap:.2rem}.filters select{width:100%;min-width:0}
.clock-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.4rem}
#local-wall,#opportunity-wall{grid-template-columns:repeat(6,minmax(0,1fr))}#trade-wall{grid-template-columns:repeat(3,minmax(0,1fr))}
.tile{--accent:var(--mint);container-type:inline-size;display:flex;flex-direction:column;min-width:0;min-height:6.55rem;border:1px solid var(--border);border-top:2px solid var(--accent);border-radius:.26rem;background:var(--panel);padding:.43rem .55rem .48rem}
.tile.has-campaign{position:relative;border-top-color:var(--mint)}.tile.has-campaign:hover,.tile.has-campaign:focus-within{border-color:var(--mint);background:#20342a}.tile.has-campaign .info{position:relative;z-index:1}.tile-campaign{color:var(--mint);font-size:.82rem;margin-top:.35rem;font-weight:750;text-decoration:none}.tile-campaign::after{content:"";position:absolute;inset:0}.tile-campaign:focus-visible{outline:none}.tile.has-campaign:has(.tile-campaign:focus-visible){outline:2px solid var(--sky);outline-offset:3px}
.tile.model{--accent:var(--gold)}.tile.signal{--accent:var(--sky)}.tile.trade{--accent:var(--rose)}
.tile h3{margin:0;line-height:1.2;font-size:.88rem;color:var(--accent)}
.tile-head{display:flex;gap:.25rem;justify-content:space-between;align-items:start;margin-bottom:.35rem;min-height:1.36rem}
.info{border:1px solid var(--border);border-radius:50%;padding:0;width:1.29rem;height:1.29rem;flex:0 0 1.29rem;line-height:1;background:transparent;color:var(--sub);font-size:.77rem;font-weight:800}
.reading{display:block;margin:auto 0;padding:.2rem .27rem;border:1px solid #3c5042;border-radius:.15rem;background:#0b110e;color:#f2f7df;font:bold clamp(.82rem,9.35cqi,1.92rem)/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap;letter-spacing:-.044em;font-variant-numeric:tabular-nums}
.tile[data-format=delta] .reading{color:var(--sky)}.tile[data-format=delta] .reading.neg{color:var(--rose)}
.tile-meta{color:var(--sub);font-size:.72rem;line-height:1.2;margin:.29rem 0 0}
.wall-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem 1rem;font-size:.77rem;color:var(--sub);margin-top:1rem;border-top:1px solid var(--border);padding-top:.7rem}.wall-footer nav{display:flex;gap:.45rem .9rem;flex-wrap:wrap}
dialog{width:min(92vw,560px);color:var(--fg);background:var(--panel);border:1px solid var(--border);border-radius:.35rem;padding:1.15rem;box-shadow:0 20px 70px #0009}dialog::backdrop{background:#070c0ac9}.dialog-top,#metric-links{display:flex;flex-wrap:wrap;gap:.6rem 1rem}.dialog-top{justify-content:space-between;align-items:center}#metric-kind{font-size:.76rem;font-weight:bold;letter-spacing:.1em;color:var(--gold);text-transform:uppercase}dialog h2{margin:.7rem 0 .25rem;font-size:1.4rem}#metric-reading{font-weight:700;font-variant-numeric:tabular-nums}#metric-text{color:var(--sub)}#metric-links{font-size:.88rem}
@media(max-width:1120px){#local-wall,#opportunity-wall{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.wall-head{align-items:start;flex-direction:column}.head-controls{justify-content:start}.clock-grid,#local-wall,#trade-wall,#opportunity-wall{grid-template-columns:repeat(2,minmax(0,1fr))}.tile{min-height:6.45rem}.section-head>span{font-size:.67rem;text-align:right}.select-head label{align-items:end;flex-direction:column}.select-head select{max-width:51vw}.clock-grid{gap:.35rem}}
@media(max-width:480px){.filters{grid-template-columns:1fr}.filters label{grid-template-columns:5.2rem minmax(0,1fr);align-items:center}}@media(max-width:345px){.reading{font-size:9cqi}.tile h3{font-size:.78rem}}
`;
export function mountWall(buildModel,paceDollars,zoneYear,marketSelection,tradeEstimates,readTradeShares){
 const $=id=>document.getElementById(id);
 const fromPage=JSON.parse($('initial').textContent);
 let selected='metro', selectedRegion='';
 let data=fromPage, ticks=Date.now(), paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let active=new Map(), refs=new Map(), focus=null;
 const formats=new Map();
 const money=(n,dp=0)=>{if(!formats.has(dp))formats.set(dp,new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:dp,maximumFractionDigits:dp}));return formats.get(dp).format(n);};
 const localDate=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'medium'});
 const num=n=>n.toLocaleString('en-US');
 const tiny=n=>n>=1e9?'$'+(n/1e9).toFixed(2)+'B':n>=1e6?'$'+(n/1e6).toFixed(1)+'M':n>=1000?'$'+Math.round(n/1000).toLocaleString('en-US')+'K':money(n);
 const delta=n=>new Intl.NumberFormat('en-US',{signDisplay:'exceptZero',maximumFractionDigits:1}).format(n)+'%';
 const fmtPeriod=k=>new Date(Date.UTC(2000+Number(k.slice(0,2)),Number(k.slice(2))-1,1)).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
 const detailUrl=(hash='#market-title')=>'/admin/spend-clock/details?market='+encodeURIComponent(selected)+(selectedRegion?'&region='+encodeURIComponent(selectedRegion):'')+hash;
 const playbookUrl=()=>'/admin/spend-clock/campaigns?market='+encodeURIComponent(selected)+(selectedRegion?'&region='+encodeURIComponent(selectedRegion):'');
 const goPause=()=>{$('pause').setAttribute('aria-pressed',String(paused));$('pause').textContent=paused?'Resume clock':'Pause clock';};
 const settings=()=>{
  const defaults=data.construction.assumptions;
  try{
   const a=JSON.parse(localStorage.getItem('bci-construction-v1')||'null');
   if(!a||!Array.isArray(a.lv)||a.lv.length!==6||!a.lv.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=100))||!['perOwner','commercial','industrial','commercialRen','industrialRen'].every(k=>Number.isFinite(a[k])&&a[k]>=0&&a[k]<=(k==='perOwner'?100000:100)))return defaults;
   const sum=Math.max(100,a.commercial+a.industrial)/100;
   return {...a,commercial:a.commercial/sum,industrial:a.industrial/sum,lv:a.lv.map(p=>[Math.min(...p),Math.max(...p)])};
  }catch{return defaults;}
 };
 function derive(){

  const c=data.construction, s=c.sources, row=c.rows.find(r=>r.id===selected)||c.rows[1], state=c.rows.find(r=>r.id===row.state)||c.rows[0];
  const stateLabel=state.label,[priv,pub]=data.capitalByState[row.state]||data.capital;
  const ct=data.signals.find(x=>x.id===row.state.toUpperCase()+'CONS');
  const newState=state.bps[c.annual], current=row.bps[c.monthly];
  const assumed=settings();
  const model=buildModel(row,priv.value*1e6,state.econ,assumed,'smooth',c.annual);
  const base=(id,name,amount,tone,kind,foot,text,source,format='clock')=>({id,name,amount,tone,kind,foot,text,source,format});
  const sv=[
   base('private','Private nonresidential',priv.value*1e6,'actual','Published spending',priv.date.slice(0,4)+' Census','Value of '+stateLabel+' private nonresidential construction put in place. Covers more than buildings and includes both new work and improvements. This is the state benchmark, not a directory of local jobs.',priv.url),
   base('public','State & local construction',pub.value*1e6,'actual','Published spending',pub.date.slice(0,4)+' Census','Includes state and local highways, utilities and public buildings in '+stateLabel+'. For building trades, start with facility and school projects in actual capital plans and bid notices rather than applying your trade share to this broad statewide total.',pub.url),
   base('homes','New housing units',newState?.[0]??null,'signal','Published permit count',c.annual+' Census','Statewide full-year count of newly authorized private housing units, including apartments. Units are not separate buildings, construction starts, or completed homes.',s.bps,'count'),
   base('workers','Construction payroll jobs',ct?.value!=null?Math.round(ct.value*1000):null,'signal','Published jobs',ct?.date?.slice(0,7)||'Latest release','Statewide construction payroll jobs in the latest source period. It measures jobs, not contractors or dollars.',ct?.url,'count')
  ];
  const names=['Residential new','Residential renovations','Commercial new','Commercial renovations','Industrial new','Industrial renovations'];
  const detail=[
   'Average permit valuation from the latest three full years with usable reporting. Permits lead construction and aren’t cash spending. Separately scope multifamily common areas rather than assuming every unit is a trade opportunity.',
   'Owner-occupied households × '+money(assumed.perOwner)+' per year. The default comes from a national remodeling study; it’s not measured local spending and leaves out rental-only and seasonal units.',
   'Estimated from the statewide private nonresidential benchmark, the commercial allocation, local workplace jobs, and the assumed new-build split. Use this to choose where to look, then verify the project and scope.',
   'A modeled share of the commercial allocation. Market tenant fit-outs, office and clinic retrofits, and upgrades across multiple sites rather than waiting on ground-up starts.',
   'Estimated from the statewide private nonresidential benchmark and local manufacturing workplace jobs. This is an allocation, not a count of plant or warehouse projects.',
   'A modeled part of the industrial allocation. For trade outreach, look for plant expansions, reliability upgrades and scheduled shutdowns.'
  ];
  const loc=model.map((m,i)=>base('lane'+i,names[i],m?.annual??null,i===0?'actual':'model',i===0?'Permit-based pace':'Modeled allocation',i===0?'Multi-year permits':'Local estimate',detail[i]+(m?' Low-voltage sensitivity: '+money(m.low)+' to '+money(m.high)+' per year.':' No usable local pace for this source period.'),i===0?s.bps:i===1?s.remodel:s.annual));

  const localCount=data.nonres?.[row.id];
  const sig=[
   base('permits-ytd','New housing units authorized',current?.[0]??null,'signal','Published permit count','Through '+fmtPeriod(c.monthly),'Latest calendar year-to-date new private housing units authorized for the selected market. This counts units, not building permits or starts. Monthly records can include estimates for nonreporting areas.',s.bps,'count'),
   ...[['commercial','New commercial buildings'],['industrial','New industrial buildings']].map(([k,label])=>{
    const count=localCount?.[k];
    return base(k+'-count',label,count?.value??null,'signal',count?'Local permit records, not a building census':'No comparable count',count?.period||'No verified local series',count?.notes||(localCount?.related&&k==='commercial'?localCount.related.note:'The current federal Building Permits Survey does not count commercial or industrial buildings. No verified count covering this entire market is available here. A blank is not zero, and construction dollars are not converted into a made-up building count.'),count?.url||(k==='commercial'?localCount?.related?.url:null)||'https://www.census.gov/construction/bps/sample.html','count');
   })
  ];
  const opp=tradeEstimates(model,readTradeShares(data.tradeDefaults)).map(t=>{
   const range=t.annual;
   return base('scope-'+t.id,t.name,range?(range[0]+range[1])/2:null,'trade','Modeled trade opportunity','Midpoint of editable range',t.scope+' '+(range?'Illustrative annual range: '+money(range[0])+' to '+money(range[1])+'. ':'')+(t.id==='low-voltage'?'Uses the separate low-voltage shares for each new and renovation segment. ':'Applies editable scope shares of '+t.low+'%–'+t.high+'%. ')+'Private commercial and industrial work only. Not bids, measured spending for this trade, or booked revenue. Trade scopes can overlap in real contracts.',s.annual);
  });
  return {sv,loc,sig,opp,c,row,state};

 }
 function update(){
  if(!paused)ticks=Date.now();
  $('clock-date').textContent=localDate.format(ticks)+' ET';
  for(const [id,m] of active){
   const {read}=refs.get(id);
   const out=m.amount===null?'—':m.format==='clock'?money(paceDollars(m.amount,ticks),2):m.format==='delta'?delta(m.amount):num(m.amount);
   if(read.textContent!==out)read.textContent=out;
   read.classList.toggle('neg',m.format==='delta'&&m.amount<0);
  }
 }
 function createTile(m){
  const el=document.createElement('article');el.className='tile '+m.tone;el.dataset.format=m.format;
  el.innerHTML='<div class="tile-head"><h3></h3><button class="info" type="button" aria-haspopup="dialog">i</button></div><span class="reading"></span><p class="tile-meta"></p>';
  const info=el.querySelector('button'), read=el.querySelector('.reading');
  info.setAttribute('aria-label','About '+m.name);el.querySelector('h3').textContent=m.name;
  el.querySelector('.tile-meta').textContent=m.amount===null?m.foot:m.format==='clock'?m.foot+' · '+tiny(m.amount)+'/yr':m.foot;
  if(m.id==='scope-low-voltage'){
   const link=document.createElement('a');link.className='tile-campaign';link.href=playbookUrl();link.textContent='Campaign ideas';link.setAttribute('aria-label','Low voltage campaign ideas');el.classList.add('has-campaign');el.append(link);
  }
  info.onclick=()=>{
   const item=active.get(m.id);focus=info;
   $('metric-kind').textContent=item.kind;$('metric-title').textContent=item.name;
   const [start,end]=zoneYear(ticks);
   $('metric-reading').textContent=item.amount===null?'Not available':item.format==='clock'?money(item.amount)+' annual basis · '+money(item.amount*1000/(end-start),4)+'/sec':item.format==='delta'?delta(item.amount)+' compared with the same months last year':num(item.amount);
   $('metric-text').textContent=item.text;
   const links=$('metric-links');links.replaceChildren();
   for(const [label,url] of [['Source data',item.source],[item.tone==='trade'?'Edit trade assumptions':'Market breakdown & assumptions',detailUrl(item.tone==='trade'?'#trade-assumptions':'#market-title')]]){
    if(!url)continue;
    const a=document.createElement('a');a.href=url;a.textContent=label;links.append(a);
   }
   if(m.id==='scope-low-voltage'){const a=document.createElement('a');a.href=playbookUrl();a.textContent='Low voltage campaign ideas';links.append(a);}
   $('metric-info').showModal();
  };
  return {el,read};
 }
 function draw(){
  const {sv,loc,sig,opp,c,row,state}=derive();
  active=new Map([...sv,...loc,...sig,...opp].map(m=>[m.id,m]));refs=new Map();
  for(const [id,metrics] of [['state-wall',sv],['local-wall',loc],['trade-wall',sig],['opportunity-wall',opp]]){
   $(id).replaceChildren(...metrics.map(m=>{const t=createTile(m);refs.set(m.id,t);return t.el;}));
  }
  $('vt-head').textContent=state.label+' statewide';
  $('market-scope').textContent=row.label+' · '+row.parent;
  $('details-top').href=detailUrl();$('wall-details').href=detailUrl();$('wall-campaigns').href=playbookUrl();
  $('source-status').textContent=c.annualVerified&&c.monthlyVerified?'Census permits checked · through '+fmtPeriod(c.monthly):'Census permit snapshot · through '+fmtPeriod(c.monthly);
  update();
 }
 marketSelection(data.construction.rows,data.marketStates,$('state-wall-select'),$('region-wall-select'),$('town-wall-select'),(id,reg)=>{selected=id;selectedRegion=reg;draw();});
 $('metric-info').addEventListener('close',()=>{if(focus?.isConnected)focus.focus();focus=null;});
 $('pause').onclick=()=>{paused=!paused;goPause();update();};
 async function refresh(){try{const response=await fetch('/admin/spend-clock/api/economy.json');if(!response.ok)return;const next=await response.json();if(!next.construction?.rows?.length)return;data=next;if(!$('metric-info').open)draw();else $('metric-info').addEventListener('close',draw,{once:true});}catch{}}
 goPause();setInterval(()=>{if(!paused)update();},500);refresh();setInterval(refresh,900000);
}
