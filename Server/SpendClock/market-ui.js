export const marketMarkup=`
<section class="build-market" aria-labelledby="market-title">
  <div class="row header"><h2 id="market-title">Construction opportunity clock</h2><span class="chip">Actual permits + editable low-voltage scenarios</span></div>
  <p class="small header">Pick a state, a regional market, or a town. Compare new construction and renovations, and see which trade scopes are worth a closer look.</p>
  <div class="market-controls">
    <label for="market-state">State <select id="market-state"></select></label><label for="market-region">Region <select id="market-region"></select></label><label for="market-town">Town or city <select id="market-town"></select></label>
    <label for="market-basis">New housing pace <select id="market-basis"><option value="smooth">Latest 3 full years, averaged</option><option value="annual">Latest full year</option></select></label>
    <label class="market-check"><input id="market-us" type="checkbox"> Apply national nonresidential trend to the model</label>
  </div>
  <div id="market-profile"></div>
  <div id="market-cards" class="market-cards"></div>
  <div id="market-trades" class="market-profile"></div>
  <details class="market-settings" id="trade-assumptions"><summary>Change the trade shares and construction assumptions</summary>
  <p class="small">These are starting scenarios, not published Vermont trade-share averages. Set shares as a percentage of total project value for work BCI would actually scope. Exclude fire alarm, electrical power, carrier-only contracts or other trades unless they’re part of your package.</p>
  <div id="market-settings"></div><p class="small" id="market-assumption-note"></p><button id="market-reset" class="action" type="button">Reset construction and low-voltage assumptions</button><div id="market-trade-inputs"></div></details>
  <h3>Compare local markets</h3>
  <p class="small">Rows are drill-downs within the selected state and can overlap. Click a market for the construction cards and local research link.</p>
  <div class="market-table" tabindex="0" role="region" aria-label="Construction comparisons"><table><thead><tr><th scope="col">Market</th><th scope="col" id="mt-year">Housing permits</th><th scope="col" id="mt-ytd">2026 YTD</th><th scope="col">Private jobs<br><small>2023 unless noted</small></th><th scope="col">Low-voltage pool<br><small>modeled annual range</small></th></tr></thead><tbody id="market-rows"></tbody></table></div>
  <p class="small" id="market-fresh"></p>
  <details><summary>Sources, definitions and what not to add together</summary><div id="market-sources"></div></details>
</section>`;
export const marketCss=`
.build-market{margin-top:1.5rem}.market-controls{display:flex;flex-wrap:wrap;align-items:end;gap:.8rem;margin:1rem 0}
.market-controls label,.market-inputs label{display:grid;gap:.3rem;font-size:.91rem}
.market-controls select,.market-inputs input{background:#0a171b;color:var(--text);border:1px solid var(--line);border-radius:.45rem;font:inherit;padding:.5rem;max-width:100%}
.market-controls .market-check{display:flex;align-items:center;padding:.3rem 0}
.market-profile{padding:.85rem 1rem;border:1px solid var(--line);border-radius:.7rem;margin:.7rem 0;background:#0c1b20}
.market-profile h3{margin:0 0 .35rem}.market-profile p{margin:.35rem 0}
.market-kpis{display:flex;flex-wrap:wrap;gap:.4rem .95rem;margin:.55rem 0}.market-kpis span{color:var(--muted)}
.market-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin:.9rem 0}
.market-card{background:var(--pane);border:1px solid var(--line);border-top:2px solid var(--blue);border-radius:.65rem;padding:.8rem;min-width:0}
.market-card:nth-child(n+3){border-top-color:var(--mint)}.market-card:nth-child(n+5){border-top-color:var(--gold)}
.market-card h3{font-size:1rem;margin:.35rem 0}.market-card p{margin:.38rem 0}
.market-pace{font:700 clamp(1.05rem,2.2vw,1.8rem)/1.2 system-ui;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.market-lv{font-variant-numeric:tabular-nums;color:var(--mint);display:flex;align-items:center;gap:.45rem}.market-pie{width:1.2rem;height:1.2rem;flex:none;border-radius:50%;border:1px solid #3e6670;background:conic-gradient(var(--mint) 0 var(--slice),#294048 var(--slice) 100%)}
.market-settings{margin:.85rem 0}.market-inputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.6rem;margin:.65rem 0}.market-share-pair{display:flex;gap:.4rem}.market-share-pair label{min-width:0}
.market-table{overflow-x:auto;width:100%;margin:.7rem 0}.market-table table{width:100%;min-width:660px;border-collapse:collapse;font-variant-numeric:tabular-nums}.market-table th,.market-table td{text-align:left;padding:.55rem .65rem;border-bottom:1px solid var(--line);white-space:nowrap}.market-table button{background:none;border:0;color:var(--mint);font:inherit;padding:.18rem .1rem;cursor:pointer;text-align:left}.market-table tr.chosen{background:#10292a}.market-table tr.subrow button{padding-left:1rem}.household-archive{margin-top:1rem}
@media(max-width:850px){.market-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.market-cards{grid-template-columns:1fr}}
`;
export function mountMarket(buildModel, paceDollars, zoneYear, marketSelection, configureTradeInputs, readTradeShares, tradeEstimates) {
 const $=id=>document.getElementById('market-'+id);
 const labels=['Residential new','Residential renovations','Commercial new','Commercial renovations','Industrial new','Industrial renovations'];
 const tags=['Census permit value · not actual outlays','Proxy: owner households × U.S. benchmark','Modeled allocation · private','Modeled allocation · private','Modeled allocation · private','Modeled allocation · private'];
 const scopes=['Common-area access, cameras, fiber and data','Existing homes; excludes rental-only and seasonal stock','Tenant-ready data, pathways, Wi-Fi and doors','Tenant fit-outs, closet rework, security refreshes','Production and warehouse fiber, pathways, data and cameras','Phased cutovers, fiber, cameras and plant expansions'];
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[x]);
 const whole=v=>v==null?'—':v.toLocaleString('en-US');
 const fmt=(v,d)=>v.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:d,maximumFractionDigits:d});
 const abbr=v=>v===null?'Not available':v>=1e9?'$'+(v/1e9).toFixed(2)+'B':v>=1e6?'$'+(v/1e6).toFixed(2)+'M':v>=1000?'$'+Math.round(v/1000).toLocaleString('en-US')+'K':fmt(v,0);
 const period=k=>new Date(Date.UTC(2000+Number(k.slice(0,2)),Number(k.slice(2))-1,1)).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
 const defaultData=JSON.parse(document.querySelector('#initial').textContent);
 let view=defaultData, a, chosen='metro', selectedRegion='', basis='smooth', showTrend=false, active=[], dom=[], time=Date.now();
 const getConfig=()=>{
   const defaults=structuredClone(defaultData.construction.assumptions);
   try{
    const pref=JSON.parse(localStorage.getItem('bci-construction-v1')||'null');
    if(!pref||!Array.isArray(pref.lv)||pref.lv.length!==6||!pref.lv.every(x=>Array.isArray(x)&&x.length===2&&x.every(v=>Number.isFinite(v)&&v>=0&&v<=100))||!['perOwner','commercial','industrial','commercialRen','industrialRen'].every(k=>Number.isFinite(pref[k])&&pref[k]>=0&&pref[k]<=(k==='perOwner'?100000:100)))return defaults;
    return pref;
   }catch{return defaults;}
 };
 a=getConfig();
 const normalized=()=>{
   let s=Math.max(100,a.commercial+a.industrial)/100;
   return {...a,commercial:a.commercial/s,industrial:a.industrial/s,lv:a.lv.map(p=>[Math.min(...p),Math.max(...p)])};
 };
 function drawInputs(){
   const fields=[['perOwner','Home improvement / owner ($)',100000,100],['commercial','Private anchor to commercial (%)',100,1],['industrial','Private anchor to industrial (%)',100,1],['commercialRen','Commercial renovation share (%)',100,1],['industrialRen','Industrial renovation share (%)',100,1]];
   $('settings').innerHTML='<div class="market-inputs">'+fields.map(([k,label,max,step])=>'<label>'+label+'<input type="number" min="0" max="'+max+'" step="'+step+'" data-input="'+k+'" value="'+a[k]+'"></label>').join('')+'</div><div class="market-inputs">'+labels.map((label,i)=>'<div><strong class="small">'+label+'</strong><div class="market-share-pair">'+a.lv[i].map((p,j)=>'<label>'+(j?'High %':'Low %')+'<input type="number" min="0" max="100" step=".05" data-input="'+i+':'+j+'" value="'+p+'"></label>').join('')+'</div></div>').join('')+'</div>';
 }
 const d=()=>view.construction;
 const typical=id=>view.capitalByState[id]?.[0]?.value*1e6;
 const factor=()=>{const r=view.trend.find(x=>x.id==='PNRESCON');return showTrend&&r?.prior>0?r.value/r.prior:1};
 const model=row=>buildModel(row,typical(row.state)*factor(),(d().rows.find(r=>r.id===row.state)||d().rows[0]).econ,normalized(),basis,d().annual);
 function totals(mod){
   return mod.reduce((sum,v)=>[sum[0]+(v?.low||0),sum[1]+(v?.high||0)], [0,0]);
 }
 const bins=(row,key)=>row.bps[key];
 function updatePace(now=time){
   const paused=document.getElementById('motion').getAttribute('aria-pressed')==='true';
   if(!paused)time=now;
   const [y0,y1]=zoneYear(time);
   for(let i=0;i<active.length;i++){
     const v=active[i];if(!v)continue;
     const sec=(y1-y0)/1000;
     const paced=fmt(paceDollars(v.annual,time),2);
     const low=fmt(paceDollars(v.low,time),2),high=fmt(paceDollars(v.high,time),2);
     if(dom[i][0].textContent!==paced)dom[i][0].textContent=paced;
     const display=low+' to '+high;
     if(dom[i][1].textContent!==display)dom[i][1].textContent=display;
     dom[i][2].textContent=fmt(v.annual/sec/2,4)+' construction per tick';
   }
 }
 function redraw(){
   const back=document.getElementById('clock-back');if(back)back.href='/admin/spend-clock/?market='+encodeURIComponent(chosen)+(selectedRegion?'&region='+encodeURIComponent(selectedRegion):'');
   const group=d(), row=group.rows.find(r=>r.id===chosen)||group.rows[1], p=row.bps[group.annual], month=row.bps[group.monthly], py=String(Number(group.monthly.slice(0,2))-1).padStart(2,'0')+group.monthly.slice(2), prev=row.bps[py];
   const growth=prev?.[1]>0&&month?((month[1]/prev[1]-1)*100):null;
   const [population,housing,owners,income,jobs,_,mfg]=row.econ;
   const jobStamp=jobs==null?'':(' ('+(row.jobYear||2023)+' '+esc(row.jobSource||'LODES')+')');
   const weak=p&&row.kind==='town'&&p[5]===0;
   const historical=[group.annual-3,group.annual-2,group.annual-1,group.annual].filter(y=>row.bps[y]).map(y=>{const b=row.bps[y];return y+': '+whole(b[0])+(b[0]===1?' unit / ':' units / ')+abbr(b[1])+(b[5]===0?' (0 months reported)':'');}).join(' · ');
   const direct=month&&month[0]>0?Math.round(month[4]/month[0]*100):null;
   $('profile').innerHTML='<div class="market-profile"><h3>'+esc(row.label)+' <span class="small">· '+esc(row.parent)+'</span></h3><div class="market-kpis"><span><strong>'+whole(population)+'</strong> residents</span><span><strong>'+whole(housing)+'</strong> housing units</span><span><strong>'+whole(owners)+'</strong> owner households</span>'+(income?'<span><strong>'+fmt(income,0)+'</strong> median household income</span>':'')+'<span><strong>'+whole(jobs)+'</strong> private workplace jobs'+jobStamp+'</span><span><strong>'+whole(mfg)+'</strong> manufacturing jobs</span></div><p class="small"><strong>'+group.annual+' housing permits:</strong> '+(p?abbr(p[1])+' / '+whole(p[0])+(p[0]===1?' unit, ':' units, ')+whole(p[2])+' in buildings of 5+ units':'not available')+(weak?' · <strong>Zero months reported; excluded from the housing clock.</strong>':'')+'</p><p class="small"><strong>Through '+period(group.monthly)+':</strong> '+(month?abbr(month[1])+' / '+whole(month[0])+(month[0]===1?' unit':' units'):'not available')+(growth===null?'':' · '+(growth>0?'+':'')+growth.toFixed(0)+'% permit value vs same prior-year months')+(direct===null?'':' · '+direct+'% of units directly reported')+'</p><p class="small"><strong>Full-year history:</strong> '+(historical||'No municipal permit series.')+'</p><p>'+esc(row.desc)+' <a href="'+esc(row.url)+'">Local project research</a></p></div>';
   active=model(row);
   const reported=view.nonres?.[row.id];
   if(reported){
     if(reported.related){const p=document.createElement('p'), link=document.createElement('a');p.className='small';p.textContent=reported.related.note+' ';link.href=reported.related.url;link.textContent='Colchester planning statistics';p.append(link);$('profile').firstElementChild.append(p);}
     for(const [id,label] of [['commercial','New commercial permits'],['industrial','New industrial permits']]){
       const m=reported[id];if(!m)continue;
       const p=document.createElement('p'),a=document.createElement('a');p.className='small';p.textContent=label+': '+m.value+' · '+m.period+' · '+m.notes+' ';a.href=m.url;a.textContent='Source';p.append(a);$('profile').firstElementChild.append(p);
     }
   }
   $('trades').innerHTML='<h3>Annual trade opportunity ranges</h3><p class="small">Private commercial and industrial only. Planning assumptions, not measured spending or open bids.</p><div class="market-kpis">'+tradeEstimates(active,readTradeShares(view.tradeDefaults)).map(t=>'<span><strong>'+esc(t.name)+':</strong> '+(t.annual?abbr(t.annual[0])+'–'+abbr(t.annual[1]):'not available')+'</span>').join('')+'</div>';
   const play=document.createElement('a');play.href='/admin/spend-clock/campaigns?market='+encodeURIComponent(chosen)+(selectedRegion?'&region='+encodeURIComponent(selectedRegion):'');play.textContent='Low voltage campaign ideas';$('trades').append(play);
   const config=normalized();
   $('cards').innerHTML=active.map((v,i)=>'<article class="market-card"><div class="kicker">'+tags[i]+'</div><h3>'+labels[i]+'</h3>'+(v?'<div class="market-pace" data-con>—</div><p class="small">Construction pace YTD · <span data-tick></span></p><p class="small">Annual basis: <strong title="'+fmt(v.annual,0)+'">'+abbr(v.annual)+'</strong></p><p class="market-lv"><span class="market-pie" aria-hidden="true" style="--slice:'+((config.lv[i][0]+config.lv[i][1])/2)+'%"></span><strong data-lv>—</strong></p><p class="small">Low-voltage pace YTD · '+config.lv[i].join('–')+'%</p><p class="small">Annual low-voltage slice: <strong title="'+fmt(v.low,0)+' to '+fmt(v.high,0)+'">'+abbr(v.low)+'–'+abbr(v.high)+'</strong></p>':'<p>Not enough reported data for this pace.</p>')+'<p class="small">'+scopes[i]+'</p></article>').join('');
   dom=[...$('cards').children].map(el=>['con','lv','tick'].map(k=>el.querySelector('[data-'+k+']')));
   document.getElementById('mt-year').textContent=group.annual+' new housing';
   document.getElementById('mt-ytd').textContent='Through '+period(group.monthly);
   $('rows').innerHTML=group.rows.filter(r=>r.state===row.state).map(r=>{
      const x=bins(r,group.annual),y=bins(r,group.monthly), m=model(r), t=totals(m);
      return '<tr class="'+(r.id===chosen?'chosen ':'')+(r.kind==='county'||r.id==='burlington'?'subrow':'')+'"><th scope="row"><button type="button" data-market="'+r.id+'"'+(r.id===chosen?' aria-current="true"':'')+'>'+esc(r.label)+'</button></th><td>'+(x?abbr(x[1])+' / '+whole(x[0])+(x[5]===0?' †':''):'—')+'</td><td>'+(y?abbr(y[1])+' / '+whole(y[0]):'—')+'</td><td>'+whole(r.econ[4])+(r.econ[4]!=null&&(r.jobYear&&r.jobYear!==2023||r.jobSource&&r.jobSource!=='Census LODES')?' <small>('+esc((r.jobYear||2023)+' '+(r.jobSource||'LODES'))+')</small>':'')+'</td><td>'+abbr(t[0])+'–'+abbr(t[1])+(m.some(i=>i===null)?' (partial)':'')+'</td></tr>';
   }).join('');
   $('assumption-note').textContent=(a.commercial+a.industrial>100?'Allocations exceed 100%; both shares are scaled down proportionally. ':'')+(100-config.commercial-config.industrial).toFixed(1)+'% of the private statewide anchor is left out, for categories outside this model. Current anchor: '+abbr(typical(row.state)*factor())+(showTrend?' after national trend sensitivity.':' actual statewide before allocations.');
   $('fresh').textContent='† 0 annual reporting months. Monthly permit estimates may include imputation and revisions. '+(group.monthlyVerified?'Monthly files checked upstream.':'Showing the last verified monthly snapshot.')+' '+(group.annualVerified?'Annual files checked upstream.':'Showing the last verified annual snapshot.');
   updatePace(Date.now());
 }
 const s=d().sources;
 $('sources').innerHTML='<ul><li><a href="'+s.bps+'">Census Building Permits Survey</a>: new private dwellings only; estimated permit valuation, not cash spent. A full-year average smooths one-off projects and excludes town years with zero months reported. Monthly data can include estimates for nonreporting places. Monthly YTD is context, not the projection.</li><li><a href="'+s.annual+'">Census construction put in place</a>: statewide private nonresidential anchor only. Commercial and industrial allocations, new/renovation splits and low-voltage shares are scenarios. Local values distribute the statewide slices using selected service-sector and manufacturing jobs, not observed local contracts. Larger plants and individual projects can break that proxy. Public construction is separate below and not included in these six slices.</li><li><a href="'+s.acs+'">2020–24 ACS</a>: residents, housing stock, owner households and median household income. <a href="'+s.lodes+'">Census LEHD/LODES 2023</a>: private workplace jobs by place of work, not residents and not spending. <a href="'+s.metro+'">BLS area definition</a>: Chittenden, Franklin and Grand Isle.</li><li><a href="'+s.remodel+'">Harvard JCHS / 2023 American Housing Survey</a>: the default $4,700 per owner is a national average used as a local proxy, not verified local renovation dollars.</li><li>Check <a href="'+s.acts+'">Act 250 records</a>, <a href="'+s.fire+'">Vermont construction permits</a> and the <a href="'+s.bids+'">state bid registry</a> for named projects. Confirm the package, prime and bid stage before counting it as a lead.</li></ul>';
 const picker=marketSelection(d().rows,view.marketStates,$('state'),$('region'),$('town'),(key,reg)=>{chosen=key;selectedRegion=reg;redraw();});
 configureTradeInputs($('trade-inputs'),view.tradeDefaults,readTradeShares,redraw);
 if(location.hash==='#trade-assumptions')document.getElementById('trade-assumptions').open=true;
 $('basis').addEventListener('change',e=>{basis=e.target.value;redraw();});
 $('us').addEventListener('change',e=>{showTrend=e.target.checked;redraw();});
 $('rows').addEventListener('click',e=>{const b=e.target.closest('[data-market]');if(!b)return;picker.select(b.dataset.market);$('town').focus({preventScroll:true});$('town').scrollIntoView({block:'nearest'});});
 $('settings').addEventListener('input',e=>{const k=e.target.dataset.input;if(!k||e.target.value===''||!e.target.validity.valid)return;const v=Number(e.target.value);if(k.includes(':')){const [i,j]=k.split(':');a.lv[i][j]=v;}else a[k]=v;try{localStorage.setItem('bci-construction-v1',JSON.stringify(a));}catch{}redraw();});
 $('reset').onclick=()=>{a=structuredClone(defaultData.construction.assumptions);try{localStorage.removeItem('bci-construction-v1')}catch{}drawInputs();redraw();};
 window.updateConstructionView=next=>{if(next.construction){view=next;redraw();}};
 drawInputs();redraw();setInterval(()=>updatePace(Date.now()),500);
}
