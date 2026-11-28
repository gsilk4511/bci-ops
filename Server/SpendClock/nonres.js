// Municipal figures are permit records, not buildings completed. The federal BPS
// discontinued collection of nonresidential permits in 1995.
const nonresSources={
 census:'https://www.census.gov/construction/bps/sample.html',
 williston:'https://www.town.williston.vt.us/vertical/sites/%7BF506B13C-605B-4878-8062-87E5927E49F0%7D/uploads/Planning_QR_FY_25_Q2__2025_02_03.pdf',
 boston:'https://data.boston.gov/dataset/approved-building-permits',
 nashua:'https://newgis.nashuanh.gov/arcgisapp3/rest/services/CommunityDevelopment/Building_Permits_for_AGOL/MapServer/1',
 bostonApi:'https://data.boston.gov/api/3/action/datastore_search_sql'
};
const nonresBostonQuery='SELECT COUNT(DISTINCT permitnumber) AS n FROM "6ddcd912-32a0-43df-9908-63574f8c7e77" WHERE issued_date >= \'2025-01-01\' AND issued_date < \'2026-01-01\' AND permittypedescr = \'Erect/New Construction\' AND worktype = \'ERECT\' AND occupancytype = \'Comm\'';
const checkedNonres={
 'VT:colchester':{
  commercial:null, industrial:null, year:2026,
  source:'https://colchestervt.gov/156/Development-Statistics',
  related:'Colchester’s New Commercial line shows 2 town-classified permits in calendar 2025 and 2 from January through October 2026. This category also includes some renovations and additions; it does not establish the number of new commercial or industrial buildings.',
  audit:'https://colchestervt.gov/DocumentCenter/View/12329/2026-10-PZ-Monthly-Report-October-2026#page=1'
 },
 'VT:williston':{
  commercial:2, industrial:null, year:'FY25 Q2', period:'FY25 Q2 · Taft Corners only',
  note:'The Williston Planning and Zoning quarterly report identifies two newly permitted commercial buildings in the Taft Corners Form-Based Code District. This is a published district subset, not a town-wide total or completed buildings.',
  commercialNote:'Two new commercial buildings permitted in the Taft Corners district in fiscal 2025 Q2 (October–December 2024). The report does not give a complete town-wide count.',
  industrialNote:'The quarterly report discusses permits in industrial zoning districts but does not separately count new industrial buildings.',
  source:nonresSources.williston, scope:'District subset in Williston; one quarter'
 },
 'NH:nashua':{
  commercial:2, industrial:1, year:2025, period:'2025 · confirmed minimum',
  note:'Nashua issued-permit GIS, calendar 2025. Manually reviewed records with commercial use codes. Shown are clearly described new buildings in these particular categories, not a citywide count; permits do not establish completion.',
  commercialNote:'At least two verified new commercial buildings: one multi-tenant shell (permit 25-3072 at 340 Amherst St) and one auto-service building (25-1316 at 593 Amherst St). Excludes a tenant fit-up and accessory storage, schools and utility buildings.',
  industrialNote:'At least one verified new industrial building: city permit 25-2799, tagged Commercial Factory/Industrial and described as new auxiliary-building construction. This is a confirmed minimum, not the full market.',
  source:nonresSources.nashua, audit:nonresSources.nashua+'/query?where=Issue_Year%3D2025%20AND%20ImprovementType%20IN%20(%27C08%27%2C%27C18%27%2C%27C42%27)&outFields=ProjectNumber%2CDescription%2CImprovementType%2CStatus&f=pjson',scope:'City-issued permit subset'
 },
 'MA:boston':{
  commercial:12, industrial:null, year:2025,
  note:'City of Boston only. Distinct issued permit numbers tagged Erect/New Construction, ERECT and Commercial; not a count of buildings completed. Mixed-use, foundation-only and records outside that classification are not included.',
  commercialNote:'Twelve distinct commercial-tagged new-construction permit numbers. The portal does not separately identify industrial projects in this permit category, so the commercial-tagged records may include projects that would be classified as industrial elsewhere.',
  industrialNote:'The official Boston permit feed has no separate industrial code in these new-construction records. Unknown, not zero.',
  source:nonresSources.boston, audit:nonresSources.bostonApi+'?'+new URLSearchParams({sql:nonresBostonQuery}).toString(), scope:'City-issued permit subset'
 }
};
export function nonresCounts(stateCode,rowLabel){
 const key=String(stateCode||'').toUpperCase()+':'+String(rowLabel||'').trim().toLowerCase().replace(/,\s*(ma|nh|vt|ny|ct)$/,'').replace(/\s+(city|town)$/,'').replace(/^city of\s+/,'');
 return checkedNonres[key]||null;
}
