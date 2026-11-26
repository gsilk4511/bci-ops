import {profileStyleOptions,findProfileStyleOption} from './profile-style-catalog.js';

export const fleetStyleFields=Object.freeze({ring:'Photo trim',lighting:'Profile lighting',banner:'Banner',section:'Section color',text:'Text color'});
const choices=Object.fromEntries(Object.keys(fleetStyleFields).map(key=>[key,new Set(profileStyleOptions[key].map(option=>option.id))]));
const legacy={
 slate:['silver-coax','steel','plain-slate','slate'],
 blue:['signal-blue','cobalt','blueprint','navy'],
 green:['emerald','sage','forest-conduit','pine'],
 amber:['gold-contact','amber','heat-map','oxide'],
 red:['ruby-signal','ember','service-ticket','black-cherry']
};
export function fleetStyle(value,color='slate',strict=false){
 const keys=Object.keys(fleetStyleFields);
 if(strict&&(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(fleetStyleFields,key))))
  throw Error('Choose valid vehicle style options');
 const defaults=[...(Object.hasOwn(legacy,color)?legacy[color]:legacy.slate),'soft-white'];
 return Object.fromEntries(keys.map((key,index)=>{
  if(!Object.hasOwn(value??{},key))return [key,defaults[index]];
  const id=value[key];
  if(choices[key].has(id))return [key,id];
  if(strict)throw Error('Choose an available vehicle style');
  return [key,defaults[index]];
 }));
}
export function fleetStyleVars(value,color){
 const selected=fleetStyle(value,color), option=key=>findProfileStyleOption(key,selected[key]);
 return [
  ['--fleet-ring',option('ring').background],['--fleet-light',option('lighting').gradient],['--fleet-banner',option('banner').background],
  ['--fleet-surface',option('section').background],['--fleet-border',option('section').border],
  ['--fleet-text',option('text').color],['--fleet-muted',option('text').muted]
 ].map(([key,value])=>key+':'+value).join(';');
}
export {profileStyleOptions};
