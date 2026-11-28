import {createHash} from 'node:crypto';
import worker,{loadData,rss,snapshot} from './SpendClock/index.js';
import {buildModel,buildingAssumptions} from './SpendClock/construction.js';

export const spendRoot='/admin/spend-clock';
const compact=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const integer=new Intl.NumberFormat('en-US');
const percent=new Intl.NumberFormat('en-US',{signDisplay:'always',maximumFractionDigits:1});
const wall=market=>spendRoot+'/?market='+encodeURIComponent(market);
const detail=market=>spendRoot+'/details?market='+encodeURIComponent(market)+'#market-title';
const campaign=market=>spendRoot+'/campaigns?market='+encodeURIComponent(market);
const xml=s=>String(s??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[k]));

export function createSpendData({clock=Date.now,refresh=loadData,seed=snapshot}={}){
 let data, pending, nextCheck=0;
 return function spendData(){
  data??=seed();
  if(!pending&&clock()>=nextCheck){
   const started=clock();
   pending=Promise.resolve().then(()=>refresh(new Request('http://localhost'+spendRoot+'/api/economy.json')))
   .then(next=>{
    if(next?.fetched?.length){data=next;nextCheck=started+3600000;}
    else nextCheck=started+300000;
   }).catch(()=>{nextCheck=started+300000;}).finally(()=>{pending=null});
  }
  return {data, refreshing:Boolean(pending)};
 };
}
export const readSpendData=createSpendData();

export function profileSpendFeed(d,refreshing=false){
 const c=d.construction;
 const rows=c.rows;
 const market=rows.find(r=>r.id==='metro'), vt=rows.find(r=>r.id==='vt');
 const central=rows.find(r=>r.id==='vt-central');
 const items=[];
 const add=(kind,title,value,period,note,href,source)=>items.push({kind,title,value,period,note,href,source});
 for(const row of [market,central]){
  const key=String(c.monthly), now=row?.bps?.[key];
  if(!now||now[5]===0)continue;
  const year=2000+Number(key.slice(0,2)), mon=Number(key.slice(2));
  const prior=row.bps?.[String(year-2001).padStart(2,'0')+key.slice(2)];
  const label=new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(Date.UTC(year,mon-1,1));
  const change=prior?.[0]>0?' ('+percent.format((now[0]/prior[0]-1)*100)+'% vs. same months last year)':'';
  add('Census permits',row.label+' · new housing',integer.format(now[0])+' units'+change,'Year to '+label,
    'Housing authorizations, not finished buildings or confirmed jobs. Check multifamily plans for shared-entry access, cameras and fiber.',detail(row.id),c.sources.bps);
 }
 const privateCapital=d.capitalByState.vt[0];
 if(privateCapital?.value>0){
  add('Census spending','Vermont · private nonresidential',compact.format(privateCapital.value*1e6),privateCapital.date.slice(0,4),
   'Published value of work put in place, including new construction and improvements. Not a low-voltage bid total.',detail('vt'),privateCapital.url);
  const lanes=buildModel(market,privateCapital.value*1e6,vt.econ,buildingAssumptions,'smooth',c.annual).slice(2);
  if(lanes.every(Boolean)){
   const [low,high]=lanes.reduce(([lo,hi],row)=>[lo+row.low,hi+row.high],[0,0]);
   add('Modeled range','Greater Burlington · low-voltage opportunity',compact.format(low)+' to '+compact.format(high),'Annual scenario',
    'Commercial and industrial only. Uses the default trade shares, not live bids or your editable browser assumptions. Look for tenant fit-outs or facility retrofits.',campaign('metro'),c.sources.annual);
  }
 }
 const jobs=d.signals.find(r=>r.id==='VTCONS');
 if(jobs?.value!=null)add('BLS employment','Vermont · construction payroll',integer.format(Math.round(jobs.value*1000))+' jobs',jobs.date.slice(0,7),
   'Statewide payroll jobs, not a count of job openings or contractors.',wall('vt'),jobs.url);
 items.sort((a,b)=>Number(b.kind==='Modeled range')-Number(a.kind==='Modeled range'));
 return {items,checked:d.checked&&d.fetched?.length?d.checked:null,refreshing};
}

export function writeSpendClock(req,res,url,data=readSpendData){
 // Only the protected app router calls this. Host is not used for upstream data fetches.
 return serve();
 async function serve(){
  const route=url.pathname.slice(spendRoot.length)||'/';
  const json=route==='/api/economy.json';
  const curated=route==='/market-feed.xml';
  if(json||route==='/feed.xml'||curated){
   const {data:economy,refreshing}=data();
   if(json){res.writeHead(200,privateHeaders('application/json; charset=utf-8'));return res.end(req.method==='HEAD'?undefined:JSON.stringify(economy));}
   const host=String(req.headers.host||'');
   const local=/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/i.test(host);
   const inferred=(local?'http://':'https://')+(/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)?host:'localhost');
   const origin=new URL(process.env.PUBLIC_ORIGIN||inferred).origin;
   const state=url.searchParams.get('state');
   const body=curated?marketRss(profileSpendFeed(economy,refreshing),origin):rss(economy,origin+spendRoot,state==='all'||economy.marketStates.some(r=>r.id===state)?state:'vt');
   res.writeHead(200,privateHeaders('application/rss+xml; charset=utf-8'));return res.end(req.method==='HEAD'?undefined:body);
  }
  if(route==='/'&&url.pathname===spendRoot){res.writeHead(308,{location:spendRoot+'/'+url.search,'cache-control':'no-store'});return res.end();}
  const target=new URL('http://localhost');target.pathname=route;target.search=url.search;
  const response=await worker.fetch(new Request(target));
  if(!response.ok){res.writeHead(response.status,privateHeaders('text/plain; charset=utf-8'));return res.end(req.method==='HEAD'?undefined:'Not found');}
  const html=await response.text();
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(([,code])=>"'sha256-"+createHash('sha256').update(code).digest('base64')+"'");
  res.writeHead(200,{
   ...privateHeaders('text/html; charset=utf-8'),
   'x-frame-options':'SAMEORIGIN',
   'content-security-policy':"default-src 'none'; script-src "+(scripts.join(' ')||"'none'")+"; style-src 'unsafe-inline'; img-src data: 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'"
  });
  return res.end(req.method==='HEAD'?undefined:html);
 }
}

function privateHeaders(type){
 return {'content-type':type,'cache-control':'private, no-store','referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"};
}
function marketRss(feed,origin){
 const home=origin+spendRoot+'/';
 return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>BCI Market Signals</title><link>'+xml(home)+'</link><description>Vermont construction observations and labeled trade opportunity estimates. Not live bids.</description>'+
 feed.items.map(i=>'<item><title>'+xml(i.title+' | '+i.value)+'</title><guid isPermaLink="false">'+xml(home+encodeURIComponent(i.title)+'/'+encodeURIComponent(i.period)+'/'+encodeURIComponent(i.value))+'</guid><link>'+xml(origin+i.href)+'</link><description>'+xml(i.kind+' · '+i.period+'. '+i.note)+'</description></item>').join('')+'</channel></rss>';
}
