// Fixed city-level forecast. No location detection, credentials, or user data leave BCI.
const latitude=44.197, longitude=-72.502;
const origin='https://api.weather.gov';
const freshFor=15*60_000, staleFor=2*60*60_000, retryAfter=60_000;
const location='Barre, VT';
const clip=(value,limit)=>typeof value==='string'?value.slice(0,limit):'';
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const shortPeriod=period=>({
 name:clip(period.name,35),start:clip(period.startTime,40),
 temp:Number.isFinite(period.temperature)?period.temperature:null,unit:period.temperatureUnit==='C'?'C':'F',
 forecast:clip(period.shortForecast,100),wind:clip([period.windSpeed,period.windDirection].filter(v=>typeof v==='string').join(' '),35),
 rain:Number.isFinite(period.probabilityOfPrecipitation?.value)?period.probabilityOfPrecipitation.value:null
});
export function createProfileWeather({fetcher=globalThis.fetch,clock=Date.now}={}){
 let last, pending, failedAt=-Infinity, grid, gridAt=-Infinity;
 async function get(url){
  const address=new URL(url,origin);
  if(address.origin!==origin||address.username||address.password)throw Error('Invalid weather source');
  const res=await fetcher(address.href,{redirect:'error',headers:{Accept:'application/geo+json','User-Agent':'BCI Operations Weather (https://www.bcielite.tech)'},signal:AbortSignal.timeout(6500)});
  if(!res.ok)throw Error('Weather feed unavailable');
  return res.json();
 }
 function value(){
  const age=last?clock()-Date.parse(last.checkedAt):Infinity;
  return age<=staleFor?{...last,status:age>freshFor?'stale':'ok'}:{location,status:'unavailable'};
 }
 async function refresh(){
  try{
   if(!grid||clock()-gridAt>24*60*60_000){
    const {properties}=await get('/points/'+latitude+','+longitude);
    for(const [value,suffix] of [[properties?.forecast,'forecast'],[properties?.forecastHourly,'forecast/hourly']]){
     if(typeof value!=='string'||!value.startsWith(origin+'/')||!/^\/gridpoints\/[A-Z]{3}\/-?\d+,-?\d+\/forecast(?:\/hourly)?$/.test(new URL(value).pathname)||!value.endsWith('/'+suffix))throw Error('Invalid forecast endpoint');
    }
    grid=properties;gridAt=clock();
   }
   const [dayResult,hourResult,alertResult]=await Promise.allSettled([get(grid.forecast),get(grid.forecastHourly),get('/alerts/active?point='+latitude+','+longitude)]);
   const upcoming=(result)=>{const periods=result.value?.properties?.periods;return Array.isArray(periods)?periods.filter(p=>p&&validDate(p.startTime)&&validDate(p.endTime)&&Date.parse(p.endTime)>clock()).map(shortPeriod):[];};
   const days=upcoming(dayResult).slice(0,4),hours=upcoming(hourResult).slice(0,6);
   if(!days.length&&!hours.length)throw Error('No forecast');
   const features=alertResult.value?.features;
   const alerts=Array.isArray(features)?features.filter(row=>row?.properties?.event).slice(0,4).map(({properties:p})=>({
    event:clip(p.event,80),headline:clip(p.headline,210)
   })):null;
   last={location,checkedAt:new Date(clock()).toISOString(),days,hours,alerts};failedAt=-Infinity;
  }catch{failedAt=clock();}
  return value();
 }
 return async function weather(){
  const cached=value();
  if(cached.status==='ok'||clock()-failedAt<retryAfter)return cached;
  if(!pending)pending=refresh().finally(()=>{pending=null;});
  return pending;
 };
}
