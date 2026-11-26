export const DEFAULT_TRIP_CHARGE=120;
export const isTripCharge=entry=>entry.type==='travel'&&entry.travelBilling==='trip';
export const hasTravelRateOverride=entry=>entry.type==='travel'&&(isTripCharge(entry)||entry.travelRateOverride===true);
export const entryCharge=entry=>entry.type==='travel'&&entry.sharedTravel?0:
 Math.round(((isTripCharge(entry)?Number(entry.rate):Number(entry.rate)*Number(entry.quantity))+Number.EPSILON)*100)/100;
