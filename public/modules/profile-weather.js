const localForecast='https://forecast.weather.gov/MapClick.php?lat=44.197&lon=-72.502';
const refreshMs=15*60_000;
let newest, lastCheck=0, pending, preference, wide;
const escapeText=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const when=(value,options)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',...options}).format(new Date(value));
const displayTemp=p=>p.temp===null?'':p.temp+'°'+p.unit;
const link='<a href="'+localForecast+'" target="_blank" rel="noopener noreferrer">Open National Weather Service forecast</a>';
export function profileWeatherCard(){
 return '<section role="complementary" id="profileWeather" class="panel bci-profile-weather" aria-labelledby="profileWeatherTitle"><details><summary><h2 id="profileWeatherTitle">Weather · Barre, VT</h2></summary><div class="bci-weather-details" aria-live="polite"><p>Loading the local forecast…</p><p>'+link+'</p></div></details></section>';
}
export function renderProfileWeather(data){
 if(!data||data.status==='unavailable')return '<p>Forecast temporarily unavailable.</p><p>'+link+'</p>';
 const next=data.hours[0]||data.days[0];
 const time=p=>when(p.start,{hour:'numeric'});
 return '<div class="bci-weather-next"><strong>'+escapeText(displayTemp(next))+'</strong><span>'+escapeText(next.forecast)+'</span></div>'
  +'<p class="muted">'+(data.hours.length?'Hourly outlook · '+time(next):escapeText(next.name))+(next.wind?' · Wind '+escapeText(next.wind):'')+'</p>'
  +(data.hours.length?'<ul class="bci-weather-list" aria-label="Upcoming hours">'+data.hours.slice(0,4).map(p=>'<li><span>'+time(p)+' · '+escapeText(p.forecast)+'</span><span>'+escapeText(displayTemp(p))+(p.rain!==null?' · '+p.rain+'% precip.':'')+'</span></li>').join('')+'</ul>':'')
  +(data.days.length?'<ul class="bci-weather-list" aria-label="Day and night forecast">'+data.days.slice(0,3).map(p=>'<li><span>'+escapeText(p.name)+' · '+escapeText(p.forecast)+'</span><span>'+escapeText(displayTemp(p))+'</span></li>').join('')+'</ul>':'')
  +(data.status==='stale'||data.alerts===null?'<p class="muted">Current alerts unavailable. Check NWS for updates.</p>':
    data.alerts.length?'<div class="bci-weather-alerts"><strong>Active NWS alerts</strong>'+data.alerts.map(a=>'<p>'+escapeText(a.headline||a.event)+'</p>').join('')+'</div>':'')
  +'<p class="muted">'+(data.status==='stale'?'Saved forecast · ':'Updated ')+when(data.checkedAt,{hour:'numeric',minute:'2-digit',timeZoneName:'short'})+'</p><p>'+link+'</p>';
}
export function wireProfileWeather(panel){
 if(!panel)return;
 const details=panel.querySelector('details'), body=panel.querySelector('.bci-weather-details');
 if(!wide){
  wide=window.matchMedia('(min-width: 1440px)');
  const refresh=()=>document.getElementById('profileWeather')?.updateWeather?.();
  wide.addEventListener('change',refresh);
  document.addEventListener('visibilitychange',refresh);
  setInterval(refresh,60_000);
 }
 let expected=preference??wide.matches;
 details.open=expected;
 async function show(){
  if(!details.open||!panel.isConnected||document.hidden)return;
  if(newest)body.innerHTML=renderProfileWeather(newest);
  if(Date.now()-lastCheck<(newest?.status==='ok'?refreshMs:60_000))return;
  if(!pending)pending=(async()=>{
   try{
    const response=await fetch('/api/profile-weather',{cache:'no-store'});
    const data=response.ok?await response.json():null;
    newest=data||{status:'unavailable'};
   }catch{newest={status:'unavailable'};}
   finally{lastCheck=Date.now();pending=null;}
  })();
  await pending;
  if(details.open&&panel.isConnected)body.innerHTML=renderProfileWeather(newest);
 }
 details.addEventListener('toggle',()=>{
  if(details.open!==expected){preference=details.open;expected=details.open;}
  void show();
 });
 panel.updateWeather=()=>{
  if(preference===undefined&&expected!==wide.matches){expected=wide.matches;details.open=expected;}
  void show();
 };
 void show();
}
