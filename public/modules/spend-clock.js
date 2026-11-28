const root='/admin/spend-clock';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const internal=path=>typeof path==='string'&&path.startsWith(root+'/')?path:root+'/';

export function spendClockPage(){
 return `<section class="panel bci-spend-clock"><div class="pagehead"><div><div class="eyebrow">Admin</div>
  <h1>Spend Clock</h1><p class="muted">Construction activity, trade opportunities and campaign ideas.</p></div>
  <a href="${root}/" class="secondary" target="_blank" rel="noopener noreferrer">Open full screen</a></div>
  <iframe src="${root}/" title="Spend Clock dashboard and campaign playbooks"></iframe></section>`;
}

export function marketFeedCard(){
 return '<section class="panel bci-market-feed" id="profileMarketFeed" aria-labelledby="profileMarketTitle"><h2 id="profileMarketTitle">Market Signals · Vermont</h2>'
  +'<p class="muted">Construction indicators and low-voltage campaign ideas.</p><div aria-live="polite" data-market-content><p>Loading market signals…</p></div>'
  +'<div class="market-feed-links"><a href="/?spend-clock=1">Open Spend Clock</a><a href="'+root+'/market-feed.xml" target="_blank" rel="noopener noreferrer">Market RSS</a></div></section>';
}

export function renderMarketFeed(data){
 const items=Array.isArray(data?.items)?data.items.slice(0,5):[];
 const when=data?.checked?new Date(data.checked):null;
 const status=when&&!Number.isNaN(+when)?'Sources last checked '+new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}).format(when):data?.refreshing?'Showing saved figures while checking sources.':'Showing saved figures. Live sources are not available right now.';
 return '<p class="market-feed-status muted">'+esc(status)+'</p>'+(items.length?'<ul>'+items.map(item=>
  '<li><span class="market-feed-period">'+esc(item.kind)+' · '+esc(item.period)+'</span><a href="'+esc(internal(item.href))+'">'+esc(item.title)+'</a><strong>'+esc(item.value)+'</strong><small>'+esc(item.note)+'</small></li>').join('')+'</ul>':'<p>No market readings are available yet.</p>');
}

export function wireMarketFeed(panel){
 if(!panel||panel.dataset.wired)return;
 panel.dataset.wired='true';
 const body=panel.querySelector('[data-market-content]');
 const load=async(retry=true)=>{
  if(!panel.isConnected)return;
  try{
   const response=await fetch('/api/profile-market-feed',{cache:'no-store'});
   if(!response.ok)throw Error('Feed unavailable');
   const data=await response.json();
   if(!panel.isConnected)return;
   body.innerHTML=renderMarketFeed(data);
   if(data.refreshing&&retry)setTimeout(()=>load(false),15000);
  }catch{if(panel.isConnected)body.textContent='Market data is unavailable right now. The Spend Clock can still open its saved figures.';}
 };
 void load();
}
