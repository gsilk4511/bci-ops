import { renderCampaign } from './campaigns.js';
import {nationalMarketStates,nationalMarketAnchors} from './national-markets.js';
import {tradeDefaults,marketSelection,tradeEstimates,readTradeShares,configureTradeInputs} from './trades.js';
import {heatmapHtml} from './heatmap.js';
import {nonresCounts} from './nonres.js';
import {wallMarkup,wallCss,mountWall} from './wall.js';
import {makeConstruction,refreshConstruction,buildModel} from './construction.js';
import {marketMarkup,marketCss,mountMarket} from './market-ui.js';
const C={"pce":[["VTPCE","Household spending total",42350.3,40363.5],["VTPCEHOUSUTL","Housing & utilities",7420,7108.6],["VTPCEHLTHCARE","Health care",7957.1,7453.5],["VTPCEG","Goods & retail purchases",12632,12302.1],["VTPCEFDSRVACCMD","Food service & lodging",2852.5,2760.4],["VTPCEFININS","Financial services & insurance",2584.2,2423.8],["VTPCESRECSRV","Recreation services",1685.7,1599.6],["VTPCETRANS","Transportation services",1395.6,1314.4],["VTPCEOSRV","Other services",3297.4,3146.6],["VTPCEFCENPISH","Nonprofit services to households",2525.9,2254.5]],"gdp":[["VTNQGSP","All-industry output",51624.5,49390.9],["VTHLTHSOCASSNQGSP","Health care & social assistance",5534.5,5244.7],["VTMANNQGSP","Manufacturing & industrial",4092.7,null],["VTPROBUSNQGSP","Professional, scientific & technical (includes engineering)",3789.8,null],["VTRETAILNQGSP","Retail trade",4007.6,3885.6],["VTWHOLENQGSP","Wholesale & distribution",2538.7,null],["VTEDCATNQGSP","Private educational services",1005.9,1024.3],["VTGOVNQGSP","Government & public enterprises",6303.2,null],["VTINFONQGSP","Information & telecom",null,null],["VTRERENTLEANQGSP","Real estate & leasing",null,null],["VTUTILNQGSP","Utilities",null,null],["VTCONSTNGSP","Construction trades (annual value added)",1787.8,1758.9],["VTACCFDNGSP","Accommodation & food services (annual value added)",2978.7,2863.7]],"capital":[["Private nonresidential construction",429,[434,452,479],"https://www.census.gov/construction/c30/pdf/nrstate.pdf"],["State & local public construction",754,[667,597,674],"https://www.census.gov/construction/c30/pdf/slstate.pdf"]],"sources":{"bids":"https://www.vermontbusinessregistry.com/BidSearch.aspx?type=1","bgs":"https://bgs.vermont.gov/Bid%20Opportunity","permits":"https://dec.vermont.gov/permits/environmental-notice-bulletin","water":"https://dec.vermont.gov/water-investment/water-financing/srf/priority-lists-state-revolving-funds","state":"https://legislature.vermont.gov/assets/Legislative-Reports/2026-Act-Summary-Book.pdf","gf":"https://www.nist.gov/news-events/news/2026/10/department-commerce-announces-agreement-globalfoundries-amend-its-existing","erate":"https://opendata.usac.org/stories/s/E-Rate-Open-Data-Home/9s6i-myen"}};
const CSS="\n:root{color-scheme:dark;--bg:#081114;--pane:#101e22;--line:#294048;--text:#eff7f2;--muted:#b0c4c6;--mint:#83efbe;--gold:#ffcf88;--blue:#a6d8ff;font-family:system-ui,-apple-system,sans-serif}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 72% 0%,#163c39 1%,var(--bg) 55%);color:var(--text)}main{max-width:1410px;margin:auto;padding:32px clamp(16px,4vw,60px) 64px}a{color:var(--blue);text-underline-offset:.22em}a:hover{color:white}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--gold);outline-offset:3px}.mast{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:20px}.brand,.kicker{text-transform:uppercase;font:700 .84rem/1.45 ui-monospace,monospace;letter-spacing:.16em;color:var(--mint)}.brand{margin-bottom:8px}h1,h2,h3,p{margin:0}h1{font-size:clamp(2.35rem,7vw,5.2rem);line-height:1;letter-spacing:-.075em;margin-bottom:16px}h2{font-size:clamp(1.55rem,4vw,2.25rem);letter-spacing:-.04em}h3{font-size:1.15rem;line-height:1.25}.sub,.small,.desc{color:var(--muted);line-height:1.5}.sub{max-width:62ch}.small{font-size:.9rem}.meta{text-align:right;display:grid;gap:10px}.chip{font:700 .78rem/1.2 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;padding:7px 10px;border:1px solid #3f625d;border-radius:100px;color:var(--mint);width:max-content;max-width:100%}section{margin-top:31px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:14px}.hero{margin-top:22px;grid-template-columns:repeat(auto-fit,minmax(min(100%,325px),1fr))}.card,.panel{background:linear-gradient(145deg,#14272a,#101b20);border:1px solid var(--line);border-radius:15px;padding:18px;min-width:0}.hero .card:first-child{border-color:#498776;background:linear-gradient(140deg,#173a34,#102523)}.metric{font-family:ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums;font-size:clamp(1.35rem,3.25vw,2.7rem);font-weight:750;letter-spacing:-.07em;color:var(--mint);margin:.45em 0 .24em;overflow-wrap:anywhere}.metric.mini{font-size:clamp(1.35rem,3vw,2.1rem)}.rate{color:var(--text);font-size:1rem}.row{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;align-items:center}.header{margin-bottom:12px}.hash{font:700 1.08rem ui-monospace,monospace;color:var(--mint)}.gold{color:var(--gold)}.tabs{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0}.tabs button,button.action{color:var(--text);background:#15282e;border:1px solid #37505a;padding:9px 13px;border-radius:8px;font:inherit;cursor:pointer}.tabs button[aria-pressed=true]{color:#081914;background:var(--mint);border-color:var(--mint);font-weight:730}.lane{display:grid;gap:10px}.lane .rank{color:var(--mint);font-family:ui-monospace,monospace}.lane .desc{font-size:.96rem}.scenario{display:grid;grid-template-columns:1.35fr 1fr;gap:24px;align-items:center}.scenario .inputs{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}.scenario label{display:grid;gap:5px;font-size:.9rem}.scenario input{width:126px;font:inherit;color:var(--text);padding:7px 9px;border-radius:7px;border:1px solid #456068;background:#081619}.scenario .big{font:750 clamp(1.5rem,4.3vw,3.25rem) ui-monospace,monospace;letter-spacing:-.08em;color:var(--gold);margin:9px 0}.trail{display:flex;flex-wrap:wrap;gap:8px 17px;margin-top:12px}.tip{margin-top:12px;border-left:3px solid #5d9085;padding:8px 12px;background:#0f2021}.strip{border-block:1px solid var(--line);padding:10px 0;overflow:hidden;margin-top:16px;background:#091418}.ticker{display:flex;width:max-content;animation:tape 40s linear infinite;color:var(--mint);font:650 .84rem ui-monospace,monospace}.ticker span{padding:0 20px;white-space:nowrap}.strip:hover .ticker,.strip:focus-within .ticker{animation-play-state:paused}.strip.paused .ticker{animation-play-state:paused}@keyframes tape{to{transform:translateX(-50%)}}details{border-top:1px solid var(--line);padding:14px 0}summary{cursor:pointer;color:var(--mint);font-weight:700;margin-bottom:10px}footer{margin-top:34px;color:var(--muted)}@media(max-width:670px){.scenario{grid-template-columns:1fr;gap:13px}.meta{text-align:left}.hero{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.ticker{animation:none}.strip{overflow:auto}}\n\n.metric,.scenario .big{font-variant-numeric:tabular-nums lining-nums} #household-detail{margin-top:12px}";
const MARKUP="\n<main>\n<header class=\"mast\"><div><div class=\"brand\">BCI ELITE / Vermont construction radar</div><h1>Construction market details</h1><p class=\"sub\">New builds, renovations and where the low-voltage work might be.</p></div><div class=\"meta\"><div class=\"chip\" id=\"status\">Published baseline</div><div class=\"small\" id=\"fresh\">Checking source releases…</div><div class=\"row\"><a id=\"clock-back\" href=\"/admin/spend-clock/\">Clock dashboard</a><a href=\"/admin/spend-clock/map\">U.S. heat map</a><a href=\"/admin/spend-clock/feed.xml\">RSS feed</a><a href=\"/admin/spend-clock/api/economy.json\">JSON feed</a><button class=\"action\" id=\"motion\" type=\"button\" aria-pressed=\"false\">Pause motion</button></div></div></header>\n__MARKET_MARKUP__\n<div class=\"grid hero\" id=\"hero\" aria-label=\"Vermont reference data\"></div>\n<div class=\"strip\" id=\"strip\" aria-hidden=\"true\"><div class=\"ticker\" id=\"tape\"></div></div>\n<p class=\"small tip\"><strong>These are pacing estimates, not live transactions.</strong> Each dollar clock adds half its per-second rate on every tick, twice a second. The yearly baseline and $/sec are shown underneath for comparison. A new release can move the baseline up or down. Household spending, industry output and construction are separate lenses; never add them together.</p><div class=\"trail small\"><label><input id=\"trend-toggle\" type=\"checkbox\"> Apply U.S. construction trend to Vermont benchmark (scenario)</label><span id=\"trend-text\"></span></div>\n<details class=\"household-archive\"><summary>Secondary lens: household spending and technology</summary><section aria-labelledby=\"household-title\"><div class=\"row header\"><h2 id=\"household-title\">What households spend on</h2><span class=\"chip\">BEA detail · Vermont residents</span></div><p class=\"small header\">This includes bills and purchases, plus spending on households’ behalf and estimates such as the rental value of owner-occupied homes. It is not take-home pay or cash left after bills.</p><div class=\"grid\" id=\"household-cut\"></div><p class=\"small tip\">Selected leisure means recreation, purchased meals and drinks, and lodging. It is a proxy, not a complete measure of optional spending. Some recreation and tech overlap. Internet and phone service can also be essentials; none of these lines is BCI’s addressable contract market.</p><details><summary>Show the equipment, service and leisure lines</summary><div class=\"grid\" id=\"household-detail\"></div></details></section></details>\n<section id=\"campaign\"><div class=\"row header\"><h2>Where I’d campaign first in Vermont</h2><span class=\"chip\">Low-voltage fit · editorial ranking</span></div><div class=\"grid\" id=\"lanes\"></div><div class=\"trail small\" id=\"links\"></div></section>\n<section><div class=\"row header\"><h2>Vermont by sector</h2><span class=\"small\">Source period shown on every card</span></div><div class=\"tabs\" aria-label=\"Choose an economic lens\"><button type=\"button\" data-mode=\"pce\" aria-pressed=\"false\">Household spending</button><button type=\"button\" data-mode=\"gdp\" aria-pressed=\"false\">Industry output</button><button type=\"button\" data-mode=\"capital\" aria-pressed=\"true\">Construction spending</button><button type=\"button\" data-mode=\"signals\" aria-pressed=\"false\">Permits & jobs</button></div><p class=\"small header\" id=\"lens-note\"></p><div class=\"grid\" id=\"sector\"></div></section>\n<section class=\"panel scenario\"><div><div class=\"kicker\">Planning sandbox · not a forecast</div><h2>Size a campaign from the bottom up</h2><p class=\"small\">Use jobs you could actually bid. The defaults are placeholders, not Vermont market data. No percentage of health care or road spending gets counted as cabling.</p><div class=\"inputs\"><label>Qualified jobs / year <input id=\"jobs\" type=\"number\" min=\"0\" max=\"100000\" step=\"1\" value=\"30\"></label><label>Avg. low-voltage package ($)<input id=\"pkg\" type=\"number\" min=\"0\" max=\"1000000000\" step=\"100\" value=\"22000\"></label><label>Win rate (%)<input id=\"win\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" value=\"25\"></label></div></div><div><div class=\"small\" id=\"pool\"></div><div class=\"big\" id=\"scenario-pace\"></div><div class=\"small\">Modeled award pace to date</div><div class=\"small\" id=\"scenario-out\"></div><div class=\"small\">At your assumed win rate. Not booked revenue.</div></div></section>\n<footer><details><summary>How the clock refreshes</summary><p class=\"small\">The page checks automatically on load and every 15 minutes while open. The JSON and RSS endpoints check upstream as requested, with up to one hour of server caching. BEA and Census published observations are served via FRED for the connected series (annual household, quarterly GDP and monthly jobs/permits; detailed household lines come from BEA’s SAPCE4 archive). A fetch can verify the same period; it does not mean a new release landed. The Census annual state construction workbooks and local housing permit files are checked for revisions and new releases. The optional scenario multiplies those two Vermont benchmarks by the latest U.S. year-to-date spending ratio versus the same prior-year months. It is a sensitivity test, not a Vermont estimate. If an upstream feed is unavailable or older than the verified snapshot, that metric keeps its snapshot and is not labeled refreshed. Annualized GDP is industry value added, not business revenue or owner budgets. Change is year-over-year except for the two construction benchmarks, which use the previous three years’ average.</p></details><p class=\"small\">The campaign list links to official research sources. It is not a scraped bid list or a guarantee of funded work.</p></footer></main>\n";
const CLIENTTEMPLATE="\nconst data0=JSON.parse(document.querySelector('#initial').textContent);let data=data0,mode='capital',applyTrend=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,clockCards=[],scenarioAnnual=0;\nconst zoneYear=__ZONE_YEAR__,paceDollars=__PACE__;\nconst $=s=>document.querySelector(s),fmt=(n,k=0)=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:k,minimumFractionDigits:k}),num=n=>n.toLocaleString('en-US');\nconst compact=n=>n>=1e9?'$'+(n/1e9).toFixed(2)+'B':'$'+(n/1e6).toLocaleString('en-US',{maximumFractionDigits:1})+'M';\nconst E=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'})[m]);\nconst label=(x,k)=>k==='gdp'&&!x.id.endsWith('NGSP')?'Q'+Math.ceil(Number(x.date.slice(5,7))/3)+' '+x.date.slice(0,4):k==='signals'?new Date(x.date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}):x.date.slice(0,4);\nconst basis={pce:'BEA household expenditures. The total includes the listed categories; do not sum it with them.',gdp:'BEA industry value added at an annualized rate. No direct capital spending inference.',capital:'Census spending put in place. The public total includes roads, water and non-building work. Values are nominal and small-state estimates can be noisy.',signals:'Monthly Vermont construction employment and housing permits. Permits authorize units; they do not measure starts, completion, or cabling revenue.'};\nconst period=(x,k)=>x.date?label(x,k)+' · '+(x.updated?'source checked':'published snapshot'):'No verified reading';\nfunction delta(x){if(!x.prior||!x.value)return '';const d=(x.value/x.prior-1)*100;return ' · <span class=\"'+(d<0?'gold':'hash')+'\">'+(d>=0?'+':'')+d.toFixed(1)+'%</span> '+(x.base?'vs '+E(x.base):'YoY');}\nfunction dollarNode(x,mini=false){return '<div class=\"metric'+(mini?' mini':'')+'\" data-annual=\"'+(x.value*1e6)+'\"></div>';}\nfunction rate(x){const [a,b]=zoneYear(Date.now());return compact(x.value*1e6)+' / year · '+fmt(x.value*1e9/(b-a),2)+'/sec';}\nfunction clockCard(x,title){return '<article class=\"card\"><div class=\"kicker\">'+E(title)+'</div>'+dollarNode(x)+'<p class=\"small\">Modeled year-to-date pace</p><p class=\"rate\">'+rate(x)+'</p><p class=\"small\"><a href=\"'+E(x.url)+'\">Source</a> · '+(x.model?'U.S.-indexed scenario · ':'')+period(x,title.includes('construction')?'capital':'pce')+'</p></article>';}\nfunction detailCard(x,showShare=false){\n const h=data.pce[0],share=showShare&&h.date===x.date&&x.value!==null?' · '+(100*x.value/h.value).toFixed(1)+'% of household spending':'';\n return '<article class=\"card\"><h3>'+E(x.name)+'</h3>'+(x.value===null?'<div class=\"metric mini\">Not available</div>':dollarNode(x,true)+'<p class=\"small\">Modeled year-to-date pace</p><p class=\"rate\">'+rate(x)+'</p>')+'<p class=\"small\">'+period(x,'pce')+delta(x)+share+'</p><p class=\"small\"><a href=\"'+E(x.url)+'\">BEA source</a></p></article>';\n}\nfunction paint(){\n const trendText=data.trend.map(t=>{const delta=(t.value/t.prior-1)*100;return (delta>=0?'+':'')+delta.toFixed(1)+'%';});\n $('#trend-text').textContent=(applyTrend?'Scenario on · ':'Scenario off · ')+'U.S. private '+trendText[0]+' / public '+trendText[1]+' through '+label(data.trend[0],'signals')+' (not measured Vermont growth).';\n const displayed=data.capital.map((x,i)=>applyTrend?{...x,value:x.value*(data.trend[i].value/data.trend[i].prior),model:true}:x);\n const hero=[[data.pce[0],'Household spend'],[displayed[0],'Private nonres construction'],[displayed[1],'State/local public construction']];\n $('#hero').innerHTML=hero.map(([x,t])=>clockCard(x,t)).join('');\n $('#household-cut').innerHTML=data.detail.groups.map(x=>detailCard(x,true)).join('');\n $('#household-detail').innerHTML=data.detail.rows.map(x=>detailCard(x)).join('');\n const s=[compact(data.pce[0].value*1e6)+' household annual baseline',compact(data.capital[0].value*1e6)+' private nonres construction',compact(data.capital[1].value*1e6)+' state/local public construction',num(data.signals[0].value*1000)+' construction payroll jobs',data.signals[1].value+' housing units authorized in '+label(data.signals[1],'signals')];\n $('#tape').innerHTML=[...s,...s].map(y=>'<span>◆ '+E(y)+'</span>').join('');\n $('#lens-note').textContent=basis[mode];\n $('#sector').innerHTML=data[mode].map(x=>{\n  const val=x.value===null?'Not available':mode==='signals'?num(x.value*(x.id==='VTCONS'?1000:1))+(x.id==='VTCONS'?' jobs':' units'):compact(x.value*1e6);\n  const metric=x.value!==null&&mode!=='signals'?dollarNode(x,true)+'<p class=\"small\">Modeled year-to-date '+(mode==='gdp'?'output':'pace')+'</p><p class=\"rate\">'+rate(x)+'</p>':'<div class=\"metric mini\">'+val+'</div>';\n  return '<article class=\"card\"><h3>'+E(x.name)+'</h3>'+metric+'<p class=\"small\">'+period(x,mode)+delta(x)+'</p><p class=\"small\"><a href=\"'+E(x.url)+'\">Source data</a></p></article>';\n }).join('');\n if(mode==='signals'){\n   const a=data.housing.at(-1), y=a?.date.slice(0,4), m=a?.date.slice(5,7);\n   if(y&&m){\n     const cur=data.housing.filter(x=>x.date.startsWith(y)&&x.date.slice(5,7)<=m);\n     const prev=data.housing.filter(x=>x.date.startsWith(String(Number(y)-1))&&x.date.slice(5,7)<=m);\n     if(cur.length===Number(m)){\n       const sum = a=>a.reduce((t,p)=>t+p.value,0);\n       $('#sector').insertAdjacentHTML('beforeend','<article class=\"card\"><h3>Housing authorizations · YTD</h3><div class=\"metric mini\">'+num(sum(cur))+' units</div><p class=\"small\">January through '+label(a,'signals')+(prev.length===cur.length?' · '+num(sum(prev))+' in the same months a year earlier':'')+'</p></article>');\n     }\n   }\n }\n clockCards=[...document.querySelectorAll('[data-annual]')].map(el=>[el,Number(el.dataset.annual)]);\n tick();\n}\nfunction tick(){\n const now=Date.now();\n for(const [el,a] of clockCards)el.textContent=fmt(paceDollars(a,now),2);\n $('#scenario-pace').textContent=fmt(paceDollars(scenarioAnnual,now),2);\n}\nfunction motion(){document.querySelector('#strip').classList.toggle('paused',paused);$('#motion').setAttribute('aria-pressed',String(paused));$('#motion').textContent=paused?'Resume motion':'Pause motion';}\n$('#motion').onclick=()=>{paused=!paused;motion();if(!paused)tick();};\nconst laneData=__LANES__,sites=__SOURCES__;\n$('#lanes').innerHTML=laneData.map(x=>'<article class=\"card lane\"><div class=\"row\"><span class=\"rank\">'+x[0]+'</span><span class=\"chip\">'+E(x[2])+'</span></div><h3>'+E(x[1])+'</h3><p class=\"desc\">'+E(x[3])+'</p><p class=\"small\">'+E(x[4])+'</p><a href=\"'+E(sites[x[5]])+'\">Open source</a></article>').join('');\n$('#links').innerHTML=[['bids','Vermont open bids'],['bgs','BGS planholders & upcoming'],['permits','Environmental notices'],['water','Water project priority lists'],['state','Enacted capital changes'],['erate','E-Rate data']].map(x=>'<a href=\"'+E(sites[x[0]])+'\">'+E(x[1])+'</a>').join('');\nfor(const b of document.querySelectorAll('.tabs button'))b.onclick=()=>{mode=b.dataset.mode;for(const x of document.querySelectorAll('.tabs button'))x.setAttribute('aria-pressed',String(x===b));paint();};\nconst fields=['jobs','pkg','win'].map(x=>$('#'+x));try{const v=JSON.parse(localStorage.getItem('vt-spend-assumptions'));if(Array.isArray(v)&&v.length===3)fields.forEach((el,i)=>{if(v[i]!==''&&Number.isFinite(Number(v[i])))el.value=v[i];});}catch{}\nfunction scenario(){\n const a=fields.map(x=>Math.min(Number(x.max),Math.max(Number(x.min),Number(x.value)||0)));\n $('#pool').textContent=fmt(a[0]*a[1])+' in modeled bid opportunities / year';\n scenarioAnnual=a[0]*a[1]*a[2]/100;\n $('#scenario-out').textContent=fmt(scenarioAnnual)+' / year modeled awards';\n tick();\n try{localStorage.setItem('vt-spend-assumptions',JSON.stringify(fields.map(x=>x.value)));}catch{}\n}\nfields.forEach(el=>el.addEventListener('input',scenario));\nasync function refresh(){\n try{\n   const r=await fetch('/admin/spend-clock/api/economy.json');if(!r.ok)throw Error();const next=await r.json();\n   const dynamic=next.fetched.length, partial=next.unavailable.length;data=next;window.updateConstructionView?.(next);\n   $('#status').textContent=dynamic?(partial?'Mixed source coverage':'Source feeds connected'):'Published snapshot fallback';\n   $('#fresh').textContent=(dynamic?dynamic+' series verified · ':'Upstream unavailable · ') +new Date(data.checked).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET'+(dynamic&&partial?' · '+partial+' fallback / unavailable':'');\n   paint();\n }catch{$('#status').textContent='Source refresh unavailable';$('#fresh').textContent='Showing last available readings';}\n}\n$('#trend-toggle').onchange=e=>{applyTrend=e.target.checked;paint();};paint();motion();scenario();refresh();\nsetInterval(()=>{if(!paused)tick();},500);setInterval(refresh,900000);\n";

const fred='https://fred.stlouisfed.org/';
const source=id=>fred+'series/'+id;
const PCEKEEP=new Set(C.pce.map(x=>x[0]));
const pceTable=fred+'release/tables?eid=217235&rid=391';
const permitPoints=[['2025-10-01',229],['2026-01-01',197],['2026-02-01',77],['2026-03-01',109],['2026-04-01',134],['2026-05-01',125],['2026-06-01',179],['2026-07-01',138],['2026-08-01',146],['2026-09-01',152],['2026-10-01',119]];
const point=(id,name,value,prior,date,url=source(id))=>({id,name,value,prior,date,url,updated:false});

const beaZip='https://apps.bea.gov/regional/zip/SAPCE.zip';
const beaSource='https://www.bea.gov/data/consumer-spending/state';
const detailRows=[
 [73,'Recreation',3615.4,3825.9],[102,'Purchased meals & drinks',2003,2076.7],[104,'Lodging',683,698],
 [76,'Computers & information-processing equipment',275.1,298.8],[75,'Video & audio equipment',100.8,107.8],
 [67,'Phone & communications equipment',24.4,25.2],[72,'Internet access',123.9,131.9],
 [71,'Telecommunications services',223.8,229.5],[77,'Services related to AV & computers',217.9,213.8]
];
const detailGroups=[
 ['leisure','Selected leisure categories',[73,102,104]],
 ['tech','Selected household tech & connectivity',[76,75,67,72,71,77]],
 ['hardware','Tech equipment only',[76,75,67]],
 ['connect','Internet & telecom services',[72,71]]
];
function detailData(table={}, checked=false) {
 const p={};
 for(const [line,name,prior,value] of detailRows){
   const x=table[line],use=x&&x.date>='2025-01-01';
   p[line]=point('SAPCE4-'+line,name,use?x.value:value,use?x.prior:prior,use?x.date:'2025-01-01',beaSource);
   p[line].updated=Boolean(use&&checked);
 }
 const groups=detailGroups.map(([id,name,lines])=>{
   const members=lines.map(n=>p[n]), date=members[0].date, same=members.every(x=>x.date===date);
   const sum=key=>members.every(x=>x[key]!==null)?Math.round(10*members.reduce((a,x)=>a+x[key],0))/10:null;
   return {...point('SAPCE4-'+id,name,same?sum('value'):null,same?sum('prior'):null,same?date:null,beaSource),updated:same&&members.every(x=>x.updated)};
 });
 return {groups,rows:Object.values(p), source:beaSource};
}
const csvFields=line=>[...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map(m=>m[1]===undefined?m[2]:m[1].replaceAll('""','"'));
export function beaTable(csv) {
 const [first,...lines]=csv.replace(/^\uFEFF/,'').split(/\r?\n/), header=csvFields(first);
 const years=header.filter(x=>/^20\d\d$/.test(x)).sort(), y=years.at(-1);
 if(!y||Number(y)<2025)throw Error('Missing current BEA observation');
 const yi=header.indexOf(y),old=header.indexOf(String(Number(y)-1)),geo=header.indexOf('GeoFIPS'),lc=header.indexOf('LineCode');
 if(geo<0||lc<0||old<0)throw Error('Invalid BEA layout');
 const known=new Set(detailRows.map(x=>x[0])),out={};
 for(const l of lines){
   const v=csvFields(l.trimStart());if(v[geo]?.trim()!=='50000')continue;const id=Number(v[lc]);if(!known.has(id))continue;
   const n=s=>s?.trim()&&Number.isFinite(Number(s))&&Number(s)>=0?Number(s):null;
   const value=n(v[yi]);if(value!==null)out[id]={value,prior:n(v[old]),date:y+'-01-01'};
 }
 if(Object.keys(out).length!==known.size)throw Error('Missing component in BEA archive');
 return out;
}
async function unzipMember(buffer,matches){
 const b=new Uint8Array(buffer),v=new DataView(buffer),u16=i=>v.getUint16(i,true),u32=i=>v.getUint32(i,true);
 if(b.length>12*1024*1024||b.length<22)throw Error('Unusable BEA archive size');
 let e=b.length-22;while(e>=Math.max(0,b.length-65557)&&u32(e)!==0x06054b50)e--;
 if(e<Math.max(0,b.length-65557))throw Error('Missing ZIP directory');
 const count=u16(e+10),decoder=new TextDecoder();let off=u32(e+16);
 for(let i=0;i<count;i++){
   if(off+46>b.length||u32(off)!==0x02014b50)throw Error('Invalid ZIP directory');
   const len=u16(off+28),extra=u16(off+30),comment=u16(off+32),name=decoder.decode(b.subarray(off+46,off+46+len));
   if(matches(name)){
     const l=u32(off+42),size=u32(off+20),raw=u32(off+24),method=u16(off+10);
     if(l+30>b.length||u32(l)!==0x04034b50||size>180000||raw>300000)throw Error('Invalid BEA member');
     const start=l+30+u16(l+26)+u16(l+28);if(start+size>b.length)throw Error('Truncated BEA member');
     const payload=b.subarray(start,start+size);
     if(method===0)return decoder.decode(payload);
     if(method!==8)throw Error('Unsupported ZIP compression');
     const body=await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
     if(body.byteLength!==raw)throw Error('Wrong BEA member length');
     return decoder.decode(body);
   }
   off+=46+len+extra+comment;
 }
 throw Error('ZIP member not found');
}
export const unzipBEA=buffer=>unzipMember(buffer,name=>/(?:^|\/)SAPCE4_VT_\d{4}_\d{4}\.csv$/i.test(name));
async function capitalWorkbook(buffer){
 const [sheet,strings]=await Promise.all(['xl/worksheets/sheet1.xml','xl/sharedStrings.xml'].map(k=>unzipMember(buffer,n=>n===k)));
 const shared=[...strings.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>t[1]).join('').trim());
 const read=line=>Object.fromEntries([...line.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(m=>{
   const name=m[1].match(/\br="([A-Z]+)\d+"/)?.[1], val=m[2]?.match(/<v>([^<]+)<\/v>/)?.[1];
   return [name,/\bt="s"/.test(m[1])?shared[Number(val)]:val];
 }).filter(x=>x[0]&&x[1]!==undefined));
 const rows=[...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(m=>read(m[1]));
 const dates=rows.find(r=>Object.values(r).filter(v=>/^20\d{2}$/.test(v)).length>=4);
 if(!dates)throw Error('Missing workbook year');
 return {entries:new Map(rows.filter(r=>r.B||r.A).map(r=>[r.B||r.A,r])),dates};
}
function capitalRow(book,name){
 const entry=book.entries.get(name);if(!entry)return null;
 const vals=Object.entries(book.dates).filter(([col,y])=>/^20\d{2}$/.test(y)).map(([col,y])=>[Number(y),entry[col]===undefined?NaN:Number(entry[col])]).sort((a,b)=>a[0]-b[0]).slice(-4);
 if(vals.length!==4||vals[3][0]<2025||!vals.every(([y,v],i)=>v>=0&&Number.isFinite(v)&&y===vals[0][0]+i))return null;
 return {year:vals[3][0],value:vals[3][1],prior:vals.slice(0,3).reduce((sum,x)=>sum+x[1],0)/3};
}
export async function parseCensusCapital(buffer,stateName='Vermont'){const value=capitalRow(await capitalWorkbook(buffer),stateName);if(!value)throw Error('Missing state workbook row');return value;}
async function fetchCapital(id){
 const key=id==='private'?'nrstate':'slstate';
 const r=await fetch('https://www.census.gov/construction/c30/xlsx/'+key+'.xlsx',{signal:AbortSignal.timeout(6500)});
 if(!r.ok||Number(r.headers.get('content-length'))>500000)throw Error('Workbook unavailable');
 const book=await capitalWorkbook(await r.arrayBuffer());
 return Object.fromEntries(nationalMarketStates.flatMap(t=>{const v=capitalRow(book,t.label);return v?[[t.id,v]]:[];}));
}
async function fetchDetails(){
 const r=await fetch(beaZip,{signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('BEA HTTP '+r.status);
 if(Number(r.headers.get('content-length'))>12*1024*1024)throw Error('BEA archive too large');
 return beaTable(await unzipBEA(await r.arrayBuffer()));
}
export function zoneYear(now) {
 const year=new Date(now-18000000).getUTCFullYear();
 return [Date.UTC(year,0,1,5),Date.UTC(year+1,0,1,5)];
}
export function paceDollars(annual,now){
 const [start,end]=zoneYear(now);
 const steps=Math.min((end-start)/500,Math.max(0,Math.floor((now-start)/500)));
 return annual/((end-start)/500)*steps;
}


const blsJobsArchive='https://www.bls.gov/news.release/archives/laus_11202026.htm';
const blsJobsCurrent='https://www.bls.gov/news.release/laus.t03.htm';
const jobsBaseline={"Alabama":[112.8,110.4],"Alaska":[18.3,18.9],"Arizona":[229.5,221.7],"Arkansas":[67.9,65.9],"California":[880.6,880.8],"Colorado":[187.8,185.4],"Connecticut":[65.3,64.1],"Delaware":[25.7,24.5],"District of Columbia":[14.2,13.9],"Florida":[655.2,650.3],"Georgia":[230.8,237.1],"Hawaii":[40.6,40.4],"Idaho":[78.7,76.1],"Illinois":[255.3,239.2],"Indiana":[184.1,176.4],"Iowa":[89.9,82.9],"Kansas":[78.7,74.7],"Kentucky":[93.7,92.5],"Louisiana":[153.4,135.8],"Maine":[35.0,35.6],"Maryland":[164.8,165.4],"Massachusetts":[167.7,163.5],"Michigan":[202.0,203.1],"Minnesota":[150.9,144.6],"Mississippi":[53.9,54.4],"Missouri":[161.1,152.2],"Montana":[36.3,37.5],"Nebraska":[69.2,64.9],"Nevada":[116.2,114.4],"New Hampshire":[32.0,32.6],"New Jersey":[161.4,166.7],"New Mexico":[57.9,53.9],"New York":[380.5,385.0],"North Carolina":[293.2,281.0],"North Dakota":[30.8,30.1],"Ohio":[276.5,258.5],"Oklahoma":[94.0,90.8],"Oregon":[111.8,112.8],"Pennsylvania":[264.3,263.7],"Rhode Island":[23.1,22.7],"South Carolina":[129.0,123.9],"South Dakota":[30.4,30.2],"Tennessee":[169.7,166.7],"Texas":[930.5,903.6],"Utah":[147.2,141.8],"Vermont":[16.3,16.0],"Virginia":[227.3,227.0],"Washington":[218.2,216.5],"West Virginia":[33.9,35.5],"Wisconsin":[155.8,147.6],"Wyoming":[24.4,23.1]};
const stateJobs=nationalMarketStates.flatMap(({id,label})=>{const n=jobsBaseline[label];return n?[point(id.toUpperCase()+'CONS',label+' construction payroll jobs',...n,'2026-10-01',blsJobsArchive)]:[];});
export function parseJobsTable(raw){
 const t=raw.match(/<table\b[^>]*\bid="sae_table3a"[^>]*>([\s\S]*?)<\/table>/i)?.[1];if(!t)return [];
 const header=t.match(/id="sae_table3a\.h\.2\.9"[^>]*>\s*([A-Za-z]+)\.?\s*<br\s*\/?>\s*(20\d{2})/i);
 if(!header)return [];
 const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(header[1].slice(0,3));
 if(m<0)return [];
 const date=header[2]+'-'+String(m+1).padStart(2,'0')+'-01';
 if(date<'2026-10-01')return [];
 const codes=new Map(nationalMarketStates.map(x=>[x.label,x.id.toUpperCase()+'CONS']));
 const out=[];
 for(const [,r] of t.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
   const name=r.match(/<p\b[^>]*class="sub0"[^>]*>([^<]+)/)?.[1]?.trim(),id=codes.get(name);
   if(!id)continue;
   const values=[...r.matchAll(/<span class="datavalue">([^<]+)/g)].map(x=>Number(x[1].replaceAll(',','')));
   if(values.length>=8&&values[7]>0&&values[4]>0)out.push({id,value:values[7],prior:values[4],date,url:blsJobsCurrent,updated:true});
 }
 return out;
}
async function fetchStateJobs(){
 const r=await fetch(blsJobsCurrent,{signal:AbortSignal.timeout(5500)});
 if(!r.ok||Number(r.headers.get('content-length'))>1000000)return [];
 const body=await r.text();return body.length<1000000?parseJobsTable(body):[];
}

const marketCapital=()=>Object.fromEntries(nationalMarketStates.map(({id})=>[id,['private','public'].map((k,i)=>{
 const sourceUrl=C.capital[i][3];
 return point(k,C.capital[i][0],nationalMarketAnchors[id]?.[k]/1e6,null,'2025-01-01',sourceUrl);
})]));
const countLookup=rows=>Object.fromEntries(rows.flatMap(row=>{
 const r=nonresCounts(row.state,row.label);
 if(!r)return [];
 const pack=(value,k)=>value==null?null:{value,period:r.period||String(r.year)+' · permit records',notes:[r.note,r[k+'Note']].filter(Boolean).join(' '), url:r.audit||r.source};
 return [[row.id,{commercial:pack(r.commercial,'commercial'),industrial:pack(r.industrial,'industrial'),...(r.related?{related:{note:r.related,url:r.source}}:{})}]];
}));
export const snapshot=()=>{
 const construction=makeConstruction();
 return {
 construction, marketStates:nationalMarketStates, tradeDefaults, capitalByState:marketCapital(), nonres:countLookup(construction.rows), detail:detailData(),
 pce:C.pce.map(x=>point(...x,'2025-01-01',PCEKEEP.has(x[0])?source(x[0]):pceTable)),
 gdp:C.gdp.map(x=>point(...x,x[2]===null?null:x[0].endsWith('NGSP')?'2025-01-01':'2026-04-01')),
 capital:C.capital.map((x,i)=>({...point(i?'public':'private',x[0],x[1],x[2].reduce((a,b)=>a+b)/3,'2025-01-01',x[3]),base:'2022–24 average'})),
 signals:[point('VTBPPRIV','Privately owned housing: units authorized',119,229,'2026-10-01'),...structuredClone(stateJobs)],
 trend:[point('PNRESCON','U.S. private nonresidential YTD',569028,590697,'2026-09-01','https://www.census.gov/construction/c30/pdf/release.pdf'),point('TLPBLCON','U.S. public construction YTD',409281,404754,'2026-09-01','https://www.census.gov/construction/c30/pdf/release.pdf')], housing:permitPoints.map(([date,value])=>({date,value})), checked:null, fetched:[], unavailable:[]
};};
const money=(v,d=0)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:d,minimumFractionDigits:d}).format(v);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
const xt=s=>esc(s).replaceAll('&#39;','&apos;');
const dateFloor=(d,months)=>{let t=new Date(d+'T00:00:00Z');t.setUTCMonth(t.getUTCMonth()-months);return t.toISOString().slice(0,10)};
export function parseCSV(raw, ids) {
 const [head,...lines]=raw.trim().replace(/^\uFEFF/,'').split(/\r?\n/);
 const names=head.split(',').map(s=>s.trim().replaceAll('"',''));
 if(!['DATE','observation_date'].includes(names[0]))throw Error('Missing date header');
 const out={};
 for(const id of ids){
   const j=names.indexOf(id);if(j<1)continue;
   out[id]=lines.flatMap(line=>{const a=line.split(',');const date=a[0]?.trim(), t=a[j]?.trim(), value=Number(t);
    return /^\d{4}-\d{2}-\d{2}$/.test(date)&&t&&Number.isFinite(value)&&value>=0?[{date,value}]:[]});
 }
 return out;
}
async function download(ids){
 const u=new URL('graph/fredgraph.csv',fred); u.searchParams.set('id',ids.join(','));u.searchParams.set('cosd','2022-01-01');
 const r=await fetch(u,{signal:AbortSignal.timeout(6500),headers:{Accept:'text/csv'}});
 if(!r.ok)throw Error('Source HTTP '+r.status);return parseCSV(await r.text(),ids);
}
function merge(s,series, frequency){
 const latest=series?.at(-1); if(!latest||latest.value<=0||latest.date<(s.date||''))return false;
 const ago=series.find(x=>x.date===dateFloor(latest.date,12));
 if(latest.date!==s.date){s.prior=ago?.value??null;}
 else if(ago)s.prior=ago.value;
 s.value=latest.value;s.date=latest.date;s.url=source(s.id);s.updated=true;return true;
}
export async function loadData(req,ctx){
 const key=new Request(new URL('/__economy_cache_v7',req.url));const cache=globalThis.caches?.default;
 try{const hit=await cache?.match(key);if(hit)return await hit.json();}catch{}
 const d=snapshot(), ids1=d.pce.filter(x=>PCEKEEP.has(x.id)).map(x=>x.id),ids2=d.gdp.slice(0,6).map(x=>x.id),ids3=d.gdp.slice(6).map(x=>x.id),ids4=['VTBPPRIV','VTCONS'],ids5=d.trend.map(x=>x.id);
 const jobs=fetchStateJobs().catch(()=>[]);
 const capital=Promise.allSettled(d.capital.map(x=>fetchCapital(x.id)));
 const construction=refreshConstruction().catch(()=>makeConstruction());
 const details=fetchDetails().catch(()=>null);
 const got=await Promise.allSettled([ids1.slice(0,5),ids1.slice(5),ids2,ids3.slice(0,3),ids3.slice(3,5),ids3.slice(5),ids4,ids5].map(download));
 const map=Object.assign({},...got.filter(g=>g.status==='fulfilled').map(g=>g.value));
 for(const row of [...d.pce,...d.gdp,...d.signals]){if(merge(row,map[row.id]))d.fetched.push(row.id);}
 for(const t of d.trend){
  const points=map[t.id]||[], latest=points.at(-1);if(!latest||latest.date<t.date)continue;
  const year=latest.date.slice(0,4), month=Number(latest.date.slice(5,7));
  const ytd=yr=>points.filter(x=>x.date.startsWith(yr)&&Number(x.date.slice(5,7))<=month);
  const now=ytd(year), prev=ytd(String(Number(year)-1));
  if(now.length!==month||prev.length!==month)continue;
  const sum=a=>a.reduce((sum,x)=>sum+x.value,0);
  t.value=sum(now);t.prior=sum(prev);t.date=latest.date;t.url=source(t.id);t.updated=true;d.fetched.push(t.id);
 }
 if(map.VTBPPRIV?.at(-1)?.date>='2026-10-01')d.housing=map.VTBPPRIV.slice(-30);
 for(const id of [...ids1,...ids2,...ids3,...ids4,...ids5])if(!d.fetched.includes(id))d.unavailable.push(id);
 const detailed=await details;
 if(detailed){
  d.detail=detailData(detailed,true);
  d.fetched.push(...d.detail.rows.filter(x=>x.updated).map(x=>x.id));
 }else d.unavailable.push('BEA-SAPCE4');
 d.construction=await construction;
 for(const j of await jobs){const r=d.signals.find(x=>x.id===j.id);if(r&&j.date>=r.date){Object.assign(r,j);if(!d.fetched.includes(r.id))d.fetched.push(r.id);}}
 for(const [i,r] of (await capital).entries()){
  const c=d.capital[i];
  if(r.status!=='fulfilled'){d.unavailable.push('CENSUS-'+c.id);continue;}
  for(const st of nationalMarketStates){
   const v=r.value[st.id];if(!v)continue;
   const next={value:v.value,prior:v.prior,date:v.year+'-01-01',base:(v.year-3)+'–'+String(v.year-1).slice(2)+' average',updated:true};
   Object.assign(d.capitalByState[st.id][i],next);
   if(st.id==='vt')Object.assign(c,next);
   d.fetched.push('CENSUS-'+st.id+'-'+c.id);
  }
 }
 d.checked=new Date().toISOString();
 if(cache&&ctx?.waitUntil)ctx.waitUntil(cache.put(key,Response.json(d,{headers:{'Cache-Control':'public,max-age='+(d.fetched.length?3600:300)}})).catch(()=>{}));
 return d;
}
const lanes=[
['01','Facilities & public buildings','Best first campaign','Town offices, public safety, existing schools and municipal facilities. Lead with door and camera refreshes, structured cabling, fiber between buildings and usable as-builts.','Check approved capital, named projects, addenda, and electrical prime lists.','bgs'],
['02','Healthcare & clinics','High fit','Lead with phased closet cleanups, new AP drops, copper certification and secure door upgrades. Target existing facilities and expansions, not total patient spending.','Start with facility managers and renovation packages.','bids'],
['03','Food plants & industrial','High fit','Pitch washdown-aware pathways where appropriate, fiber backbones, production-area cameras and scheduled cutovers. Vermont fab investment is a signal, not an open subcontract.','Prioritize expansions and shutdown windows confirmed by the owner or prime.','gf'],
['04','Water, utility & engineering projects','Selective','Find plant and pump-station fiber, access, camera and network scope through the engineer or controls/electrical prime. Engineering output itself is not a cabling budget.','A priority-list entry is not an award; look for bid-ready project documents.','water'],
['05','Schools & libraries','Selective','Track funded network refreshes, camera and access work. For eligible connectivity and internal-network work, watch E-Rate alongside approved local bonds.','Do not count unfunded statewide school needs as a pipeline.','erate'],
['06','Hospitality, retail & offices','Targeted retrofit','Look for one owner managing multiple sites, weak Wi-Fi, outdated MDFs and new tenants. Retrofit campaigns can work even when ground-up starts are soft.','Use actual permits, construction schedules and named operators.','permits'],
['07','Housing & multifamily','Watch only','ISP contracts can capture much of the per-unit work. Target common-area Wi-Fi, building-to-building fiber, shared-entry access and cameras when separately scoped.','Do not translate every permitted unit into a BCI lead.','permits']
];
const CLIENT=CLIENTTEMPLATE.replace('__LANES__',()=>JSON.stringify(lanes)).replace('__SOURCES__',()=>JSON.stringify(C.sources)).replace('__ZONE_YEAR__',()=>zoneYear.toString()).replace('__PACE__',()=>paceDollars.toString());
const dataJSON=s=>JSON.stringify(s).replaceAll('<','\\u003c');
const detailsHtml=()=> '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Construction market details | Spend Clock</title><link rel="alternate" type="application/rss+xml" title="Vermont Spend Clock" href="/admin/spend-clock/feed.xml"><style>'+CSS+marketCss+'</style></head><body>'+MARKUP.replace('__MARKET_MARKUP__',()=>marketMarkup)+'<script id="initial" type="application/json">'+dataJSON(snapshot())+'</script><script>'+CLIENT+';('+mountMarket.toString()+')('+buildModel.toString()+','+paceDollars.toString()+','+zoneYear.toString()+','+marketSelection.toString()+','+configureTradeInputs.toString()+','+readTradeShares.toString()+','+tradeEstimates.toString()+');</script></body></html>';
const wallHtml=()=> '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vermont Spend Clock</title><meta name="description" content="Vermont construction spending, renovations, building permits and trade opportunity"><link rel="alternate" type="application/rss+xml" title="Vermont Spend Clock" href="/admin/spend-clock/feed.xml"><style>'+wallCss+'</style></head><body>'+wallMarkup+'<script id="initial" type="application/json">'+dataJSON(snapshot())+'</script><script>const zoneYear='+zoneYear.toString()+';('+mountWall.toString()+')('+buildModel.toString()+','+paceDollars.toString()+',zoneYear,'+marketSelection.toString()+','+tradeEstimates.toString()+','+readTradeShares.toString()+');</script></body></html>';
export function rss(d,origin,filter='vt'){
 const rows=[...d.pce,...d.gdp,...d.capital,...d.signals,...d.trend,...d.detail.groups,...d.detail.rows].filter(r=>r.value!==null);
 const items=rows.map(r=>{
   const unit=r.id==='VTBPPRIV'?r.value+' authorized units in this month':/^[A-Z]{2}CONS$/.test(r.id)?Math.round(r.value*1000).toLocaleString('en-US')+' payroll jobs':money(r.value*1e6)+' published '+(d.gdp.includes(r)?'industry output; not spending':'amount; not real-time');
   return '<item><title>'+xt(r.name+' | '+r.date)+'</title><link>'+xt(r.url)+'</link><guid isPermaLink="false">'+xt(origin+'/'+r.id+'/'+r.date+'/'+r.value)+'</guid><description>'+xt(unit)+'</description></item>';
 }).join('')+d.construction.rows.filter(row=>row.state===filter||filter==='all').flatMap(row=>[d.construction.annual,d.construction.monthly].map((period,i)=>{
  const b=row.bps[period];if(!b)return '';
  const label=i?'20'+String(period).slice(0,2)+' through month '+String(period).slice(2):String(period)+' full year';
  const value=money(b[1])+' in authorized new private housing permit valuation, '+b[0]+' units; not actual outlays.'+(b[5]===0?' Zero months reported.':'');
  return '<item><title>'+xt(row.label+' | New housing | '+label)+'</title><link>'+xt(d.construction.sources.bps)+'</link><guid isPermaLink="false">'+xt(origin+'/construction/'+row.id+'/'+period+'/'+b[0]+'/'+b[1])+'</guid><description>'+xt(value)+'</description></item>';
 })).join('');
 return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Vermont Spend Clock | Release readings</title><link>'+xt(origin)+'</link><description>Economic observations, not real-time transactions or bids. New periods and revisions get their own IDs.</description>'+items+'</channel></rss>';
}
export default {async fetch(req,env,ctx){
 const u=new URL(req.url);
 if(u.pathname==='/api/economy.json'||u.pathname==='/feed.xml'){
   const d=await loadData(req,ctx);const headers={'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'};
   return u.pathname.endsWith('.json')?Response.json(d,{headers}):new Response(rss(d,u.origin,(u.searchParams.get('state')==='all'||nationalMarketStates.some(x=>x.id===u.searchParams.get('state')))?u.searchParams.get('state'):'vt'),{headers:{...headers,'Content-Type':'application/rss+xml; charset=utf-8'}});
 }
 if(/^\/campaigns(?:\/[a-z0-9-]+)?\/?$/.test(u.pathname)){
   const d=makeConstruction();
   const html=renderCampaign(u,d.rows,nationalMarketStates,d.annual);
   if(html)return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
 }
 if(u.pathname==='/map'||u.pathname==='/map/')return new Response(heatmapHtml(),{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
 if(u.pathname==='/'||u.pathname==='/details'||u.pathname==='/details/')return new Response(u.pathname==='/'?wallHtml():detailsHtml(),{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
 return new Response('Not found',{status:404});
}};

