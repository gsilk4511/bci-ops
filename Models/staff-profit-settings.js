import {attributedEmail} from './time-attribution.js';
import {validDate} from './payroll.js';
import {internalOrder} from './project-workflow.js';

const eastYear=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric'});
export const contributionYear=date=>Number(eastYear.format(date??new Date()));
export function validatedContributionYear(value){
 if(!['string','number'].includes(typeof value)||!/^\d{4}$/.test(String(value))||Number(value)<2000||Number(value)>2200)
  throw Error('Choose a contribution year from 2000 to 2200');
 return Number(value);
}
function profitShareBps(raw){
 if(!['string','number'].includes(typeof raw)||!/^\d{1,3}(?:\.\d{1,2})?$/.test(String(raw).trim())||Number(raw)>100)
  throw Error('Enter a profit share from 0% to 100%, with up to two decimal places');
 return Math.round(Number(raw)*100);
}
const validBps=value=>Number.isInteger(value)&&value>=0&&value<=10000;
export function profileProfitShare(profile){
 return Object.fromEntries(Object.entries(profile?.profitShareBpsByYear||{}).filter(([key,value])=>/^\d{4}$/.test(key)&&Number(key)>=2000&&Number(key)<=2200&&validBps(value)).map(([year,bps])=>[year,bps/100]));
}
export function rateForYear(profile,year){
 const bps=profile?.profitShareBpsByYear?.[year];
 return validBps(bps)?bps:undefined;
}
export function updatedProfitRates(profile,data){
 if(!Object.hasOwn(data,'profitShareYear')||!Object.hasOwn(data,'profitSharePercent'))
  throw Error('Choose a year and enter a profit share, or leave the percentage blank to clear that year');
 const year=validatedContributionYear(data.profitShareYear);
 const next={...profile?.profitShareBpsByYear};
 if(typeof data.profitSharePercent==='string'&&data.profitSharePercent.trim()==='')delete next[year];
 else next[year]=profitShareBps(data.profitSharePercent);
 return next;
}
const wageMax=1000000;
function wageDate(value){
 const date=validDate(value);
 if(Number(date.slice(0,4))<2000||Number(date.slice(0,4))>2200)throw Error('Choose a wage effective date from 2000 to 2200');
 return date;
}
export function contributionWageHistory(profile){
 const rows=Array.isArray(profile?.hourlyWages)?profile.hourlyWages:[];
 // Transitional input: only an explicit legacy hourly dollar rate, never a pay tier,
 // annual salary, or ambiguous free-text number. Dated wages take precedence.
 if(!rows.length){
  const match=/^\s*\$(\d{1,5}(?:\.\d{1,2})?)\s*(?:\/\s*(?:hr|hour)|(?:an?|per)\s+hour)\s*$/i.exec(profile?.payScale||'');
  if(match&&Number(match[1])<=wageMax/100)return [{effectiveDate:'2000-01-01',hourlyCents:Math.round(Number(match[1])*100)}];
 }
 return rows.flatMap(row=>{
  try{
   const effectiveDate=wageDate(row?.effectiveDate);
   return [{effectiveDate,hourlyCents:Number.isSafeInteger(row.hourlyCents)&&row.hourlyCents>=0&&row.hourlyCents<=wageMax?row.hourlyCents:null}];
  }catch{return [];}
 });
}
export function verifiedWageHistory(profile){
 const rows=profile?.hourlyWages;
 if(!Array.isArray(rows))return [];
 const counts=new Map();
 for(const row of rows)if(typeof row?.effectiveDate==='string')counts.set(row.effectiveDate,(counts.get(row.effectiveDate)||0)+1);
 return rows.filter(row=>{
  try{return counts.get(row.effectiveDate)===1&&Number.isSafeInteger(row.hourlyCents)&&row.hourlyCents>=0&&row.hourlyCents<=wageMax&&!!wageDate(row.effectiveDate);}catch{return false;}
 }).map(({effectiveDate,hourlyCents})=>({effectiveDate,hourlyCents})).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate));
}
export function changedWageHistory(profile,data){
 const effectiveDate=wageDate(data.wageEffectiveDate), supplied=data.hourlyWage;
 if(!['string','number'].includes(typeof supplied)||!/^\d{1,5}(?:\.\d{1,2})?$/.test(String(supplied).trim())||Number(supplied)>wageMax/100)
  throw Error('Enter a verified hourly wage from $0 to $10,000, with up to two decimal places');
 const hourlyCents=Math.round(Number(supplied)*100);
 return [...contributionWageHistory({...profile,payScale:''}).filter(row=>row.effectiveDate!==effectiveDate),{effectiveDate,hourlyCents}]
  .sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate));
}
function recordedDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 const day=value.slice(0,10), midnight=new Date(day+'T00:00:00Z'), parsed=new Date(value);
 return Number.isFinite(+parsed)&&Number.isFinite(+midnight)&&midnight.toISOString().slice(0,10)===day?parsed:null;
}
export function contributionScopeLimited(state,scoped,email,year){
 const visible=new Map((scoped.workorders||[]).map(order=>[order.id,order]));
 return (state.workorders||[]).some(order=>{
  if(order.billingHidden||internalOrder(state,order)||!['sent','paid'].includes(order.invoice?.status)||
   order.invoice.void||order.invoice.voidedAt||visible.has(order.id)&&!visible.get(order.id).billingHidden)return false;
  const date=recordedDate(order.invoice.sentAt);
  if(date&&Number.isFinite(+date)&&(date>new Date()||contributionYear(date)!==year))return false;
  const match=(order.entries||[]).some(entry=>entry.type==='labor'&&attributedEmail(entry)===email);
  return match;
 });
}
