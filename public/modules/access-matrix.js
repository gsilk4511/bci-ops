export const modeLabels={hidden:'Hidden',read:'Read only',write:'Read & write'};
export const scopeLabels={own:'Own records',assigned:'Assigned records',all:'All permitted records'};
export const scopedAreas=['customers','projects','workorders','tickets','estimates','invoices','inventory'];
export const areaLabels={overview:'Home',customers:'Clients and contacts',projects:'Projects',workorders:'Work orders',estimates:'Estimates',tickets:'Tickets',
 invoices:'Invoicing',money:'Money',reports:'Reports',inventory:'Inventory',pricing:'Services and pricing',notifications:'Notifications',
 payroll:'Payroll',staff:'My Time and staff profiles',training:'Training',team:'Team and access',admin:'Administration',testing:'Database testing'};
const labels={...areaLabels};
export const areaLabel=key=>labels[key]||key;
const unique=items=>[...new Set(items.filter(Boolean))];
export function accessDescriptors(permissionMatrix={},modulePermissions={}){
 const source=Object.keys(permissionMatrix).length?permissionMatrix:Object.fromEntries(Object.entries(modulePermissions).map(([area,keys])=>
  [area,{view:keys[0],write:keys.slice(1,3),delete:keys[3]?[keys[3]]:[],actions:[]}]));
 return Object.entries(source).filter(([,d])=>d?.view).map(([area,d])=>({
  area,view:d.view,write:unique(d.write||[]),delete:unique(d.delete||[]),actions:unique(d.actions||[]),read:unique(d.read||[]),
  adminOnly:d.adminOnly===true||['team','admin'].includes(area),
 }));
}
export function effectiveModuleAccess(descriptor,profile={}){
 const keys=new Set(profile.permissions||[]);
 const visible=keys.has(descriptor.view);
 const writeKeys=unique([...descriptor.write,...descriptor.actions.filter(key=>!descriptor.read.includes(key)),...descriptor.delete]);
 const mode=visible?(writeKeys.some(key=>keys.has(key))||profile.modes?.[descriptor.area]==='write'?'write':'read'):'hidden';
 const recordScopes=profile.recordScopes||profile.scopes||{};
 return {mode,
  scope:Object.hasOwn(recordScopes,descriptor.area)?recordScopes[descriptor.area]:'',
  delete:descriptor.delete.filter(key=>keys.has(key)),
  actionLabels:writeKeys.filter(key=>keys.has(key)),
 };
}
export function profileEditorValues(descriptors,controls,extra=[]){
 const modes={},recordScopes={},permissions=new Set(extra);
 for(const d of descriptors){
  if(d.adminOnly)continue;
  const control=controls[d.area]||{};
  const mode=Object.hasOwn(modeLabels,control.mode)?control.mode:'hidden';
  modes[d.area]=mode;
  if(mode==='hidden')continue;
  if(scopedAreas.includes(d.area)&&Object.hasOwn(scopeLabels,control.scope))recordScopes[d.area]=control.scope;
  permissions.add(d.view);
  const eligible=new Set(mode==='read'?[...d.read]:[...d.read,...d.write,...d.delete,...d.actions]);
  for(const key of control.permissions||[])if(eligible.has(key)&&key!=='workorder.delete')permissions.add(key);
 }
 return {modes,recordScopes,permissions:[...permissions]};
}
