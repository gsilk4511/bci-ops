import {DEFAULT_TRIP_CHARGE} from './work-entry-charge.js';

export function travelEntryFields(f,entry){
 const mode=entry?.travelBilling||(entry&&!entry.sharedTravel?'hourly':'');
 return '<div data-travel-fields hidden>'+
  f('sharedTravel','Shared travel?',{required:true,value:entry?(entry.sharedTravel?'yes':'no'):'',
   select:[['','Choose Yes or No'],['no','No · I am recording the vehicle charge'],['yes','Yes · someone else is recording this vehicle charge']],
   hint:'Enter your own hours for payroll either way. Record the vehicle charge once per round trip, per vehicle.'})+
  '<div data-travel-charge-fields hidden>'+f('travelBilling','Travel billing',{required:true,value:mode,
   select:[['','Choose base trip or hourly'],['trip','Base trip charge · one round trip'],['hourly','Hourly charge']]})+
  '<div data-travel-trip hidden>'+f('travelTripRate','Base trip charge (USD)',{type:'number',min:0,step:'0.01',
   value:entry?.travelBilling==='trip'?String(entry.rate):String(DEFAULT_TRIP_CHARGE),
   hint:'Default $120 per vehicle for the round trip. The charge does not multiply by payroll hours.'})+'</div>'+
  '<div data-travel-hourly hidden>'+f('travelHourlyRate','Hourly travel rate (USD)',{type:'number',min:0,step:'0.01',
   value:entry?.travelRateOverride&&mode==='hourly'?String(entry.rate):'',
   hint:'Leave blank to use the work order’s travel service rate.'})+'</div>'+
  '<p class="muted tiny" data-travel-signed hidden>Uses the hourly rate already approved on this change order.</p></div></div>';
}
export function bindTravelEntryFields(form,{isTravel,hasSignedRate}){
 const section=form.querySelector('[data-travel-fields]');
 if(!section)return ()=>{};
 const {sharedTravel,travelBilling,travelTripRate,travelHourlyRate}=form.elements;
 function refresh(){
  const travel=isTravel(),billing=travel&&sharedTravel.value==='no',signed=billing&&hasSignedRate();
  section.hidden=!travel;sharedTravel.disabled=!travel;
  section.querySelector('[data-travel-charge-fields]').hidden=!billing;
  if(signed)travelBilling.value='hourly';
  travelBilling.disabled=!billing;
  const trip=billing&&travelBilling.value==='trip'&&!signed;
  const hourly=billing&&travelBilling.value==='hourly'&&!signed;
  travelBilling.querySelector('option[value="trip"]').disabled=!!signed;
  section.querySelector('[data-travel-trip]').hidden=!trip;travelTripRate.disabled=!trip;
  section.querySelector('[data-travel-hourly]').hidden=!hourly;travelHourlyRate.disabled=!hourly;
  section.querySelector('[data-travel-signed]').hidden=!signed;
 }
 for(const element of [sharedTravel,travelBilling,form.elements.type,form.elements.changeId])element?.addEventListener('change',refresh);
 refresh();
 return refresh;
}
export function travelEntryPayload(values){
 if(!['yes','no'].includes(values.sharedTravel))throw Error('Choose Yes or No for shared travel.');
 if(values.sharedTravel==='yes')return {sharedTravel:true};
 if(!['trip','hourly'].includes(values.travelBilling))throw Error('Choose base trip or hourly travel billing.');
 return {sharedTravel:false,travelBilling:values.travelBilling,
  travelCharge:values.travelBilling==='trip'?values.travelTripRate:values.travelHourlyRate};
}
