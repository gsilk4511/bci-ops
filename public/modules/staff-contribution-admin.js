import {esc,f,modal,send,today} from '../app.js';
import {contributionCurrency} from './staff-contribution.js';

const isCents=value=>Number.isSafeInteger(value)&&value>=0;
const toDollars=value=>isCents(value)?(value/100).toFixed(2):'';
function asCents(value){
 const text=String(value??'').trim();
 const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
 if(!match)throw Error('Enter an hourly wage in dollars with at most two decimal places.');
 const cents=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
 if(!isCents(cents))throw Error('Enter a valid hourly wage.');
 return cents;
}
const easternYear=()=>Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/New_York'}).format(new Date()));
export const contributionYear=staff=>staff?.contribution?.bonus?.year||staff?.contribution?.year||easternYear();
export function rateLabel(row,year){
 const rate=row.profitShareByYear?.[year];
 return Number.isFinite(rate)?rate.toLocaleString(undefined,{maximumFractionDigits:2})+'%':'5% standard';
}
function wageHistory(history){
 return `<details class="bci-wage-history"><summary>Wage history (${history.length})</summary>
 ${history.length?`<ul>${history.map(record=>`<li>${esc(record.effectiveDate)}: ${contributionCurrency(record.hourlyCents)} / h</li>`).join('')}</ul>`:'<p>No wage recorded yet.</p>'}</details>`;
}
export function openCompensationProfile(row,year,profileFields){
 const history=Array.isArray(row.hourlyWages)?row.hourlyWages:[];
 const years=[...new Set([year,easternYear(),...Object.keys(row.profitShareByYear||{}).map(Number),easternYear()+1])].sort((a,b)=>b-a);
 const wageDate=today();
 const existingWage=date=>toDollars(history.find(record=>record.effectiveDate===date)?.hourlyCents);
 const existingRate=year=>String(row.profitShareByYear?.[year]??'');
 modal('Edit staff profile',profileFields+
  `<fieldset class="bci-compensation-fields"><legend>Hourly wage history</legend>`+
  f('wageEffectiveDate','Wage effective date',{type:'date',value:wageDate,hint:'A new or changed rate applies from this date until the next effective wage.'})+
  f('hourlyWage','Base hourly wage (USD)',{type:'number',value:existingWage(wageDate),min:0,step:'0.01',hint:'Enter the base wage before the app adds the 25% employment load. Leave unchanged to keep wage history.'})+
  wageHistory(history)+'</fieldset>'+
  '<fieldset class="bci-compensation-fields"><legend>Annual bonus profit share</legend>'+
  f('profitShareYear','Bonus year',{select:years.map(value=>[String(value),String(value)]),value:String(year),required:true})+
  f('profitSharePercent','Share of positive annual labor profit (%)',{type:'number',min:0,step:'0.01',value:existingRate(year),
   hint:'Standard: 5%. Enter 0% for an explicit zero-rate override.'})+
  '<p><label><input type="checkbox" name="clearRate"> Use the standard 5% for the selected year</label></p></fieldset>',
  values=>{
   const payload={email:row.email,...Object.fromEntries(['name','contactEmail','payScale','vacationHours','sickHours'].filter(key=>Object.hasOwn(values,key)).map(key=>[key,values[key]]))};
   const wage=String(values.hourlyWage??'').trim(),date=String(values.wageEffectiveDate??'').trim();
   if(wage!==existingWage(date)){
    if(!wage)throw Error('Enter the new hourly wage, or choose a date without changing its rate.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose an effective date for the hourly wage.');
    const formatted=toDollars(asCents(wage));
    if(formatted!==existingWage(date))Object.assign(payload,{wageEffectiveDate:date,hourlyWage:formatted});
   }
   const rate=String(values.profitSharePercent??'').trim(),period=String(values.profitShareYear??'');
   if(values.clearRate||rate!==existingRate(period)){
    if(!values.clearRate&&(!/^\d+(?:\.\d{1,2})?$/.test(rate)||Number(rate)>100))throw Error('Enter a percentage from 0 to 100, or select the standard 5%.');
    Object.assign(payload,{profitShareYear:Number(period),profitSharePercent:values.clearRate?'':rate});
   }
   return send('staff.manage',payload);
  },`<p>Sign-in: ${esc(row.email)} (unchanged). Wage and bonus settings are admin only and do not change payroll or pay an employee.</p>`);
 const yearInput=document.querySelector('#f_profitShareYear'),amount=document.querySelector('#f_profitSharePercent'),clear=document.querySelector('#actionForm input[name="clearRate"]');
 if(amount)amount.max='100';
 if(yearInput&&amount)yearInput.addEventListener('change',()=>{
  amount.value=existingRate(yearInput.value);
  if(clear){clear.checked=false;amount.disabled=false;}
 });
 if(clear&&amount)clear.addEventListener('change',()=>{amount.disabled=clear.checked;});
 const dateInput=document.querySelector('#f_wageEffectiveDate'), wageInput=document.querySelector('#f_hourlyWage');
 if(dateInput&&wageInput){
  let previousDate=dateInput.value;
  dateInput.addEventListener('change',()=>{
   if(wageInput.value===existingWage(previousDate))wageInput.value=existingWage(dateInput.value);
   previousDate=dateInput.value;
  });
 }
 document.querySelector('#f_name')?.focus();
}
