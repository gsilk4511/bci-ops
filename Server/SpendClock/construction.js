import {nationalMarketRows,nationalMarketStates} from './national-markets.js';
import {withVermontCounties} from './vt-counties.js';
import {expandMarketRows} from './expansion.js';
const BASE='https://www2.census.gov/econ/bps/';
export const buildingSources={
 bps:'https://www.census.gov/construction/bps/',
 annual:'https://www.census.gov/construction/c30/historical_data.html',
 metro:'https://www.bls.gov/oes/current/msa_def.htm',
 acs:'https://www.census.gov/programs-surveys/acs/data/summary-file.2024.html',
 lodes:'https://lehd.ces.census.gov/data/',
 remodel:'https://www.jchs.harvard.edu/improving-americas-housing-2025',
 acts:'https://anrweb.vt.gov/ANR/Act250/default.aspx',
 fire:'https://firesafety.vermont.gov/buildingcode/permits',
 bids:'https://www.vermontbusinessregistry.com/'
};
export const buildingAssumptions={perOwner:4700,commercial:65,industrial:20,commercialRen:60,industrialRen:50,lv:[[.35,1],[.1,.5],[.75,2.5],[1,3],[.5,1.75],[.75,2.5]]};
const buildingSeed=[{"id":"vt","label":"Vermont","parent":"Statewide","kind":"state","econ":[647106,339042,200079,81203,256495,200514,28943],"bps":{"2022":[2403,548783403,919,129686231,1797,null],"2023":[2456,573228153,962,125098005,1910,null],"2024":[2654,674722583,1065,178842776,2031,null],"2025":[2294,717706125,876,239150094,1897,null],"2510":[2234,646916101,941,237670526,1364,null],"2610":[1330,500306120,188,129428294,580,null]},"desc":"State reference. Private nonresidential actual is not the same measure as new housing permit value.","url":"https://www.vermontbusinessregistry.com/"},{"id":"metro","label":"Greater Burlington","parent":"Chittenden \u00b7 Franklin \u00b7 Grand Isle","kind":"metro","econ":[227846,103233,63950,null,102591,80090,12177],"bps":{"2022":[1124,244265489,603,93565905,995,null],"2023":[1196,259846496,669,92090747,1099,null],"2024":[1102,278428254,574,95731565,968,null],"2025":[1258,395107039,732,217584953,1123,null],"2510":[1122,357638014,681,207004911,937,null],"2610":[531,250358625,168,126836789,332,null]},"desc":"One three-county market. Burlington city is already in Chittenden; never add it to this total.","url":"https://www.ccrpcvt.org/"},{"id":"co007","label":"Chittenden County","parent":"Greater Burlington","kind":"county","econ":[169758,74888,45679,96759,88207,70819,9441],"bps":{"2022":[940,197447994,583,92642829,879,null],"2023":[942,193848599,582,77112651,893,null],"2024":[880,217549370,549,94577720,831,null],"2025":[1026,329014865,702,216200339,945,null],"2510":[926,302859554,656,205851066,816,null],"2610":[327,199800929,88,118490637,227,null]},"desc":"Best commercial base: track Williston, Essex, South Burlington and Burlington fit-outs, properties and campuses.","url":"https://www.ccrpcvt.org/"},{"id":"co011","label":"Franklin County","parent":"Greater Burlington","kind":"county","econ":[50638,23019,15449,81313,13582,8751,2715],"bps":{"2022":[162,40318160,20,923076,94,null],"2023":[229,57763160,87,14978096,181,null],"2024":[200,53397233,25,1153845,115,null],"2025":[209,58321394,30,1384614,155,null],"2510":[173,47024867,25,1153845,99,null],"2610":[184,43593673,80,8346152,95,null]},"desc":"Lead with food production, plants and commercial sites around St. Albans and I-89. Fiber, pathways and work in scheduled shutdowns.","url":"https://www.nrpcvt.com/"},{"id":"co013","label":"Grand Isle County","parent":"Greater Burlington","kind":"county","econ":[7450,5326,2822,97396,802,520,21],"bps":{"2022":[22,6499335,0,0,22,null],"2023":[25,8234737,0,0,25,null],"2024":[22,7481651,0,0,22,null],"2025":[23,7770780,0,0,23,null],"2510":[23,7753593,0,0,22,null],"2610":[20,6964023,0,0,10,null]},"desc":"Lower-density market: named public facilities, hospitality properties and building-to-building links, not a volume campaign.","url":"https://www.nrpcvt.com/"},{"id":"burlington","label":"Burlington city","parent":"Chittenden County","kind":"town","econ":[44675,18079,7267,71109,28296,26601,1146],"bps":{"2022":[149,6033496,94,2896496,149,12],"2023":[21,3612650,0,0,21,12],"2024":[228,30610816,218,29120816,228,12],"2025":[543,198086840,496,185839015,543,12],"2510":[530,195963840,496,185839015,530,null],"2610":[10,2135782,0,0,10,null]},"desc":"Push multifamily common areas, tenant fit-outs, clinics, and closet refreshes. One large apartment job can dominate the permit tape.","url":"https://www.burlingtonvt.gov/731/Permit-Status-Reports","permitId":"085000"},{"id":"rutland","label":"Rutland city","parent":"Rutland County","kind":"town","econ":[15712,8517,4068,57675,10354,9384,620],"bps":{"2022":[1,246016,0,0,0,0],"2023":[2,400000,0,0,2,12],"2024":[1,200000,0,0,0,0],"2025":[1,200000,0,0,0,0],"2510":[1,200000,0,0,0,null],"2610":[1,200000,0,0,0,null]},"desc":"Start with existing facilities and the city\u2019s development docket. The annual residential row had zero reporting months in 2025; do not read it as a local market total.","url":"https://www.rutlandcity.org/development-review-board/","permitId":"419000"},{"id":"hartford","label":"Hartford / White River Junction","parent":"Windsor County","kind":"town","econ":[10736,6007,3176,78125,9104,8493,132],"bps":{"2022":[16,9785187,0,0,16,12],"2023":[15,11660500,0,0,15,12],"2024":[253,62375584,240,55000000,253,12],"2025":[16,9302593,0,0,16,12],"2510":[15,9127593,0,0,15,null],"2610":[11,5278577,0,0,11,null]},"desc":"Look for commercial fit-outs and healthcare/facilities projects along the Upper Valley corridor. Hartford town includes White River Junction; these dollars exclude New Hampshire.","url":"https://www.hartfordvt.gov/2463/Planning-Zoning","permitId":"215000"},{"id":"brattleboro","label":"Brattleboro","parent":"Windham County","kind":"town","econ":[12122,5890,3221,58241,8993,7073,1268],"bps":{"2022":[14,2463000,0,0,14,12],"2023":[3,425000,0,0,3,12],"2024":[43,7233000,0,0,43,12],"2025":[4,4205500,0,0,4,12],"2510":[3,4135000,0,0,3,null],"2610":[33,7690000,6,500000,33,null]},"desc":"Watch reused downtown buildings, healthcare and plant retrofit work. Confirm the low-voltage package and prime before making the drive.","url":"https://brattleboro.gov/planning","permitId":"063000"},{"id":"bennington","label":"Bennington","parent":"Bennington County","kind":"town","econ":[15249,6997,3716,59446,7979,6895,802],"bps":{"2022":[6,1210000,0,0,6,12],"2023":[11,1705818,0,0,11,12],"2024":[11,2698715,0,0,11,12],"2025":[22,4745000,6,1600000,22,12],"2510":[19,3975000,6,1600000,19,null],"2610":[9,3347500,0,0,9,null]},"desc":"Watch clinics and senior living, manufacturing sites and downtown fit-outs. Check the procurement stage before treating a capital approval as open work.","url":"https://anrweb.vt.gov/ANR/Act250/default.aspx","permitId":"041000"},{"id":"stowe","label":"Stowe","parent":"Lamoille County","kind":"town","econ":[5285,3895,1908,93618,4565,4180,124],"bps":{"2022":[69,13212385,25,2559395,0,0],"2023":[57,11631601,15,1529391,0,0],"2024":[60,11660686,15,1531473,0,0],"2025":[97,17830965,73,10739438,97,12],"2510":[95,17209371,73,10739438,95,null],"2610":[37,10147005,9,1324040,27,null]},"desc":"Start with hospitality operators and multi-building properties: guest Wi-Fi, fiber, cameras and doors. Seasonal homes are not fully represented in owner-occupied renovation estimates.","url":"https://www.stowevt.gov/Departments/Planning-Zoning","permitId":"473000"},{"id":"middlesex","label":"Middlesex","parent":"Washington County","kind":"town","econ":[1943,785,722,109632,607,374,97],"bps":{"2022":[8,2233496,0,0,8,12],"2023":[8,2202485,0,0,0,0],"2024":[19,5775172,0,0,19,12],"2025":[7,2500838,0,0,7,12],"2510":[15,4285341,0,0,0,null],"2610":[8,2806540,0,0,0,null]},"desc":"Small and close to home: pursue the named project or existing-business upgrade rather than a broad cold campaign.","url":"https://anrweb.vt.gov/ANR/Act250/default.aspx","permitId":"295000"},{"id":"barre","label":"Barre city","parent":"Washington County","kind":"town","econ":[8412,4335,2062,65625,3365,2533,553],"bps":{"2022":[0,0,0,0,0,12],"2023":[0,0,0,0,0,12],"2024":[3,700000,0,0,3,12],"2025":[1,398000,0,0,1,12],"2510":[3,699999,0,0,0,null],"2610":[1,233333,0,0,0,null]},"desc":"Use proximity for small jobs: downtown fit-outs, public facilities and door/camera refreshes. Barre Town is a separate market below.","url":"https://anrweb.vt.gov/ANR/Act250/default.aspx","permitId":"027000"},{"id":"barre-town","label":"Barre town","parent":"Washington County","kind":"town","econ":[8005,3630,3117,93210,1439,971,267],"bps":{"2022":[32,9345000,0,0,32,12],"2023":[28,7868500,0,0,28,12],"2024":[25,7062998,0,0,25,12],"2025":[23,4910000,0,0,23,12],"2510":[21,4530000,0,0,21,null],"2610":[11,3278232,0,0,11,null]},"desc":"Look for contractor relationships and shared-building or warehouse work; keep it separate from Barre City.","url":"https://anrweb.vt.gov/ANR/Act250/default.aspx","permitId":"029000"}];
export const makeConstruction=()=>({rows:[...withVermontCounties(expandMarketRows(structuredClone(buildingSeed))),...structuredClone(nationalMarketRows)],annual:2025,monthly:'2610',annualVerified:false,monthlyVerified:false,sources:buildingSources,assumptions:buildingAssumptions});
export function parsePermits(raw,period,place,expanded=false){
 const out=new Map();
 for(const line of raw.split(/\r?\n/)){
  const row=line.split(','), at=place?17:6;
  if(row[0]!==String(period)||!(expanded?validStateFips.has(row[1]):row[1]==='50')||!/^\d+$/.test(row[2])||row.length<at+24)continue;
  const values=row.slice(at,at+24).map(s=>Number(s.trim()));
  if(values.some(x=>!Number.isFinite(x)||x<0))continue;
  const sum=(from)=>[0,3,6,9].reduce((a,i)=>a+values[from+i],0);
  out.set(expanded?row[1]+row[2]:row[2],[sum(1),sum(2),values[10],values[11],sum(13),place&&String(period).length===4?Number(row[15]):null]);
 }
 return out;
}
const stateFips=Object.fromEntries(nationalMarketStates.map(x=>[x.id,x.fips]));
const validStateFips=new Set(Object.values(stateFips));
function transportResults(d,key,counts,place){
 const seen=new Set([...counts.keys()].map(k=>k.slice(0,2)));
 if(![...validStateFips].every(f=>seen.has(f))||place.size<1000)return false;
 const combine=arr=>[0,1,2,3,4].map(i=>arr.reduce((s,r)=>s+r[i],0)).concat(null);
 for(const row of d.rows){
   const f=stateFips[row.state];
   if(row.permitId){
    const v=place.get(f+String(row.permitId).padStart(6,'0'));if(v)row.bps[key]=v;
   }else if(row.kind!=='town'){
    const ids=row.kind==='state'?[...counts.keys()].filter(k=>k.startsWith(f)):row.counties||[];
    if(ids.length&&ids.every(k=>counts.has(k)))row.bps[key]=combine(ids.map(k=>counts.get(k)));
   }
 }
 return true;
}
async function readPermits(url,cap){
 const r=await fetch(url,{signal:AbortSignal.timeout(5500)});
 if(!r.ok||Number(r.headers.get('content-length'))>cap)throw Error('Census response unavailable');
 const t=await r.text();if(t.length>cap)throw Error('Census response too large');return t;
}
export async function refreshConstruction(){
 const d=makeConstruction(), now=new Date(), yr=now.getUTCFullYear(), county=BASE+'County/', place=BASE+'Place/';
 const regions=[['Northeast','ne'],['Midwest','mw'],['South','so'],['West','we']];
 const files=async(key,annual)=>{
   const suffix=key+(annual?'a':'y')+'.txt', period=annual?key:'20'+key;
   const [c,...p]=await Promise.all([readPermits(county+'co'+suffix,950000),...regions.map(([label,code])=>readPermits(place+label+'%20Region/'+code+suffix,4100000))]);
   const combined=new Map();for(const file of p)for(const [key,value] of parsePermits(file,period,true,true))combined.set(key,value);
   return [parsePermits(c,period,false,true),combined];
 };
 const monthly=async()=>{
   const dir=await readPermits(county,500000).catch(()=>null);
   const k=dir?[...dir.matchAll(/href="co(\d\d(?:0[1-9]|1[0-2]))y\.txt"/g)].map(m=>m[1]).filter(x=>x>=d.monthly).sort().at(-1):null;
   if(!k)return;
   const py=String(Number(k.slice(0,2))-1).padStart(2,'0')+k.slice(2);
   const [fresh,previous]=await Promise.all([files(k,false),files(py,false)]);
   if(transportResults(d,py,...previous)&&transportResults(d,k,...fresh)){d.monthly=k;d.monthlyVerified=true;}
 };
 const annual=async()=>{
   const candidate=Math.max(d.annual,yr-(now.getUTCMonth()<4?2:1));
   if(transportResults(d,candidate,...await files(candidate,true))){d.annual=candidate;d.annualVerified=true;}
 };
 await Promise.allSettled([monthly(),annual()]);
 return d;
}
export function buildModel(row, pri, stateEconomy, a, permitBasis, year){
 const recent=[year-2,year-1,year].map(y=>row.bps[y]).filter(p=>p&&(row.kind!=='town'||p[5]>0));
 const current=row.bps[year];
 const permit=permitBasis==='smooth'
   ?(recent.length? recent.reduce((total,p)=>total+p[1],0)/recent.length:null)
   :(current&&(row.kind!=='town'||current[5]>0)?current[1]:null);
 const portion=(index)=>row.kind==='state'?1:Number.isFinite(row.econ[index])&&stateEconomy[index]>0?row.econ[index]/stateEconomy[index]:null;
 const commShare=portion(5),indShare=portion(6);
 const comm=Number.isFinite(pri)&&commShare!==null?pri*a.commercial/100*commShare:null;
 const ind=Number.isFinite(pri)&&indShare!==null?pri*a.industrial/100*indShare:null;
 const split=(n,ren)=>n===null?[null,null]:[n*(1-ren/100),n*ren/100];
 return [permit,Number.isFinite(row.econ[2])?row.econ[2]*a.perOwner:null,...split(comm,a.commercialRen),...split(ind,a.industrialRen)].map((v,i)=>v===null?null:({annual:v,low:v*a.lv[i][0]/100,high:v*a.lv[i][1]/100}));
}
