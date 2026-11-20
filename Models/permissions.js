export const permissionGroups = {
  'Clients and projects': {
    'customer.create':'Add billing clients', 'contact.create':'Add job contacts', 'project.create':'Add projects', 'project.contact':'Assign project contacts','project.close':'Close projects','project.followup':'Edit project follow-up'
  },
  'Work orders': {
    'workorder.create':'Create work orders', 'workorder.approve':'Record scope approval',
    'change.create':'Create change orders', 'change.approve':'Record change approval',
    'entry.add':'Log labor, materials and travel', 'entry.update':'Edit own journal entries',
    'entry.remove':'Remove own time and parts rows', 'entry.manage':'Adjust other employees’ rows',
    'receipt.read':'View work-order receipts','receipt.add':'Upload work-order receipts','clock.in':'Use work-order clock', 'workorder.close':'Submit closeouts',
    'workorder.review':'Review closeouts', 'workorder.return':'Request closeout corrections'
  },
  'Tickets': {
    'ticket.create':'Create tickets','ticket.update':'Edit tickets','ticket.delete':'Delete manual tickets',
    'ticket.note':'Add ticket notes','ticket.attach':'Attach files','ticket.assign':'Assign tickets to team members',
    'ticket.viewAll':'View all tickets', 'ticket.watch':'Follow or mute tickets','ticket.attachment':'Download allowed ticket attachments', 'ticket.mail':'Read imported ticket email', 'mail.intake':'Triage intake email', 'notification.view':'Read notification inbox','notification.manage':'Manage own notifications and devices'
  },
  'Inventory and purchasing': {
    'inventory.receive':'Receive Warehouse parts and commit field purchases', 'inventory.transfer':'Transfer inventory',
    'inventory.adjust':'Adjust stock counts', 'purchase.create':'Record card purchases'
  },
  'Database Testing': {
    'database.view':'Open Database Testing',
    'database.clients':'Inspect clients and projects',
    'database.workorders':'Inspect work orders',
    'database.stock':'Inspect catalog and inventory',
    'database.finance':'Inspect purchases and invoices',
    'database.payroll':'Inspect approved payroll'
  },
  'My Time and staff profiles': {'staff.view':'View My Time and profile','staff.profile':'Edit own staff contact details',
    'staff.leave':'Request vacation or sick time','staff.internal':'Create internal work orders',
    'staff.manage':'Administer staff profiles and pay scales','staff.leaveReview':'Review staff leave'},
  'Payroll': {'payroll.view':'View payroll review and exports','payroll.other':'Log shop time or leave','payroll.approve':'Approve pay periods'},
  'Billing and pricing': {
    'billing.deposit':'Record project deposits','finance.view':'View financial reports and internal costs', 'invoice.record':'Record QuickBooks invoices',
    'invoice.group':'Record project invoice','invoice.pay':'Record payments', 'catalog.create':'Create catalog items',
    'catalog.update':'Update catalog items', 'pricing.profile.save':'Manage pricing profiles', 'pricing.profile.assign':'Assign pricing profiles', 'pricing.workorder.correct':'Correct recorded work order pricing', 'pricing.profile.bulk':'Use bulk pricing controls', 'pricing.client':'Set client parts markup', 'pricing.part':'Set client part pricing', 'pricing.project':'Set project service rate category', 'settings.reserve':'Change tax reserve setting'
  }
};
// Each screen has an explicit read gate. Existing action keys remain compatible.
export const modulePermissions = {
  training:['training.view'],
  estimates:['estimates.view','estimate.create','estimate.update'],
  notifications:['notification.view'],
  tickets:['tickets.view','ticket.create','ticket.update','ticket.delete'],
  overview:['dashboard.view'], customers:['customers.view','customer.create','customer.update','customer.delete'],
  projects:['projects.view','project.create','project.update','project.delete'],
  workorders:['workorders.view','workorder.create','workorder.update','workorder.delete'],
  inventory:['inventory.view','inventory.receive','inventory.adjust','inventory.delete'],
  pricing:['pricing.view','catalog.create','catalog.update','catalog.delete'],
  money:['money.view'], reports:['reports.view'], payroll:['payroll.view'],
  invoices:['invoices.view'], testing:['database.view'],staff:['staff.view'],team:['team.view']
};
permissionGroups['Estimates']={'estimate.override':'Enter manual estimate rates','estimate.create':'Create estimates','estimate.update':'Edit draft estimates','estimate.accept':'Record estimate acceptance','estimate.convert':'Convert accepted estimate to project','estimate.releaseWorkOrder':'Release work orders from approved estimates'};
permissionGroups['Module visibility'] = Object.fromEntries(Object.entries(modulePermissions)
  .filter(([,keys])=>!['payroll.view','database.view'].includes(keys[0]))
  .map(([name,keys])=>[keys[0],'View '+name]));
permissionGroups['Edit and delete records'] = {
  'customer.update':'Edit billing clients','customer.delete':'Delete billing clients',
  'contact.update':'Edit job contacts','contact.delete':'Delete job contacts',
  'project.update':'Edit projects','project.delete':'Delete projects',
  'workorder.update':'Edit work orders','workorder.delete':'Move eligible work orders to Trash',
'inventory.delete':'Delete empty stock locations',
  'catalog.delete':'Delete unused pricing items'
};

const modes = ['hidden','read','write'];
const scopeOptions = ['own','assigned','all'];
export const recordScopedModules = ['customers','projects','workorders','tickets','estimates','invoices','inventory'];
const makeModule=(view,write=[],remove=[],actions=[],read=[])=>({view,write,delete:remove,actions,read});
export const permissionMatrix = {
 overview:makeModule('dashboard.view'),
 customers:makeModule('customers.view',['customer.create','customer.update','contact.create','contact.update'],['customer.delete','contact.delete']),
 projects:makeModule('projects.view',['project.create','project.update','project.contact','project.followup'],['project.delete'],['project.close']),
 workorders:makeModule('workorders.view',['workorder.create','workorder.update','entry.add','entry.update','receipt.add','clock.in','change.create'],['entry.remove'],[
  'entry.manage','workorder.approve','workorder.close','workorder.review','workorder.return','change.approve','pricing.workorder.correct'],['receipt.read']),
 tickets:makeModule('tickets.view',['ticket.create','ticket.update','ticket.note','ticket.attach','ticket.watch'],['ticket.delete'],['ticket.assign','mail.intake'],['ticket.viewAll','ticket.mail','ticket.attachment']),
 estimates:makeModule('estimates.view',['estimate.create','estimate.update'],[],['estimate.override','estimate.accept','estimate.convert','estimate.releaseWorkOrder']),
 invoices:makeModule('invoices.view',[],[],['invoice.record','invoice.group','invoice.pay','billing.deposit'],['finance.view']),
 inventory:makeModule('inventory.view',['inventory.receive','inventory.adjust','inventory.transfer'],['inventory.delete'],['purchase.create']),
 money:makeModule('money.view',[],[],['settings.reserve'],['finance.view']),
 reports:makeModule('reports.view',[],[],[],['finance.view']),
 payroll:makeModule('payroll.view',[],[],['payroll.other','payroll.approve']),
 staff:makeModule('staff.view',['staff.profile','staff.leave','staff.internal']),
 pricing:makeModule('pricing.view',['catalog.create','catalog.update'],['catalog.delete','pricing.profile.archive'],[
  'pricing.profile.save','pricing.profile.assign','pricing.profile.bulk','pricing.client','pricing.part','pricing.project']),
 notifications:makeModule('notification.view',['notification.manage']),
 training:makeModule('training.view',['training.start']),
 testing:makeModule('database.view',[],[],[],['database.clients','database.workorders','database.stock','database.finance','database.payroll','finance.view']),
 team:makeModule('team.view')
};
permissionGroups['Training']={'training.start':'Start and edit personal training practice'};
permissionGroups['Edit and delete records']['pricing.profile.archive']='Archive pricing profiles';

const adminOnly = new Set(['warehouse.patchPreview','warehouse.patchApply','trash.restore','trash.purge','workorder.delete','workorder.deletePreview','catalog.import','catalog.importPreview','catalog.packPreview','catalog.packImport','access.sync','staff.manage','staff.leaveReview','users.set','profiles.save','customers.import','customers.importPreview','record.assign']);
const adminOnlyGrants = new Set(['staff.manage','staff.leaveReview','workorder.delete','team.view']);
const profilePermissions = new Set(Object.values(permissionGroups).flatMap(Object.keys));
const viewToMode = Object.fromEntries(Object.entries(permissionMatrix).map(([name,descriptor])=>[descriptor.view,name]));
const requiresFinance = new Set(['billing.deposit','invoices.view','money.view','reports.view','invoice.record','invoice.group','invoice.pay','settings.reserve']);
const nonDelegablePassThrough = [...adminOnlyGrants];
const actionGroups = new Map();
for(const [module, descriptor] of Object.entries(permissionMatrix)){
 const register=(grants,minimum)=>{
  for(const key of grants){
   if(!actionGroups.has(key))actionGroups.set(key,[]);
   actionGroups.get(key).push({module,minimum});
  }
 };
 register([descriptor.view,...descriptor.read],'read');
 register([...descriptor.write,...descriptor.delete,...descriptor.actions],'write');
}
if([...profilePermissions].some(permission=>!adminOnlyGrants.has(permission)&&!actionGroups.has(permission))) throw Error('Permission matrix omits a grant');

const unique=values=>[...new Set(values)];
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const noScopes=()=>Object.fromEntries(recordScopedModules.map(name=>[name,'all']));
function canonicalScopes(value) {
 if(value!==undefined&&(!isObject(value)||Object.entries(value).some(([key, scope])=>!recordScopedModules.includes(key)||!scopeOptions.includes(scope)))) throw Error('Invalid record scope');
 return {...noScopes(),...value};
}
function inferModes(grants) {
 return Object.fromEntries(Object.entries(permissionMatrix).map(([key,descriptor])=>[key,
  !grants.includes(descriptor.view)?'hidden':[...descriptor.write,...descriptor.delete,...descriptor.actions].some(grant=>grants.includes(grant))?'write':'read']));
}
function selectedForModes(grants, selectedModes) {
 return unique([
  ...Object.entries(selectedModes).filter(([,mode])=>mode!=='hidden').map(([module])=>permissionMatrix[module].view),
  ...grants.filter(grant=>actionGroups.get(grant)?.some(({module,minimum})=>minimum==='read'?selectedModes[module]!=='hidden':selectedModes[module]==='write'))
 ]).filter(grant=>!(grant in viewToMode)||selectedModes[viewToMode[grant]]!=='hidden');
}
function validateDependencies(grants) {
 if([...requiresFinance].some(key=>grants.includes(key))&&!grants.includes('finance.view')) throw Error('Enable financial visibility for invoicing, payments, or reserve settings');
 if(grants.includes('invoices.view')&&!grants.includes('workorders.view'))throw Error('Enable Work Orders view for Invoices');
 if(grants.includes('payroll.approve')&&!grants.includes('payroll.view'))throw Error('Enable payroll review to approve pay periods');
 for(const grant of grants){
  if(actionGroups.has(grant)&&!actionGroups.get(grant).some(({module})=>grants.includes(permissionMatrix[module].view))) throw Error('Enable module visibility for '+grant);
 }
 return grants;
}
export function validatePermissions(permissions) {
 if(!Array.isArray(permissions)||permissions.some(value=>!profilePermissions.has(value)))throw Error('Invalid profile permissions');
 return validateDependencies(unique(permissions));
}
export function normalizeProfileAccess(data) {
 const selected=data.permissions??[];
 if(!Array.isArray(selected)||selected.some(key=>!profilePermissions.has(key)))throw Error('Invalid profile permissions');
 const grants=selected.filter(key=>!adminOnlyGrants.has(key));
 let selectedModes={...inferModes(grants),team:'hidden'};
 if(data.modes!==undefined){
  if(!isObject(data.modes)||Object.entries(data.modes).some(([key,mode])=>!Object.hasOwn(permissionMatrix,key)||!modes.includes(mode)))throw Error('Invalid module access mode');
  selectedModes={...selectedModes,...data.modes,team:'hidden'};
 }
 const recordScopes=canonicalScopes(data.recordScopes??data.scopes);
 return {schemaVersion:4,modes:selectedModes,recordScopes,permissions:validateDependencies(selectedForModes(grants,selectedModes))};
}

function legacyGrants(profile) {
 if(!profile)return [];
 const selected=(profile.permissions||[]).filter(key=>profilePermissions.has(key)&&!adminOnlyGrants.has(key));
 const version=profile.schemaVersion||1;
 const views=version<2?['dashboard.view','customers.view','projects.view','workorders.view','inventory.view']:[];
 if(version<2){
  if(selected.includes('finance.view'))views.push('money.view','reports.view','pricing.view');
  if(selected.some(key=>key.startsWith('catalog.')||key.startsWith('pricing.')))views.push('pricing.view');
 }
 const grants=unique([...selected,...views]);
 if(grants.includes('finance.view')&&grants.includes('workorders.view')&&(version<3||grants.some(key=>['invoice.record','invoice.group','invoice.pay'].includes(key))))grants.push('invoices.view');
 if(grants.includes('entry.add')&&grants.includes('workorders.view'))grants.push('entry.update','entry.remove','receipt.add');
 if(grants.includes('workorders.view'))grants.push('receipt.read');
 if(grants.includes('tickets.view'))grants.push('ticket.watch','ticket.attachment');
 if(grants.includes('notification.view'))grants.push('notification.manage');
 if(grants.includes('training.view'))grants.push('training.start');
 if(grants.includes('pricing.view')&&grants.includes('pricing.profile.save'))grants.push('pricing.profile.archive');
 return unique(grants);
}
export function profileAccess(profile) {
 if(!profile) return {permissions:[],modes:inferModes([]),recordScopes:noScopes()};
 if(profile.schemaVersion>=4){
  try {
   const {modes,recordScopes,permissions}=normalizeProfileAccess(profile);
   return {modes,recordScopes,permissions};
  } catch {
   return {permissions:[],modes:inferModes([]),recordScopes:noScopes()};
  }
 }
 const permissions=legacyGrants(profile);
 return {permissions,modes:inferModes(permissions),recordScopes:noScopes()};
}
export function resolvedProfilePermissions(profile){return profileAccess(profile).permissions;}
export function effectiveAccess(state,user,role) {
 if(!role||!user)return profileAccess(null);
 if(role==='admin')return {permissions:[...profilePermissions],modes:Object.fromEntries(Object.keys(permissionMatrix).map(name=>[name,'write'])),recordScopes:noScopes()};
 const assignment=(state.users||[]).find(member=>member.email.toLowerCase()===user.email.toLowerCase());
 if(assignment?.profileId)return profileAccess((state.permissionProfiles||[]).find(profile=>profile.id===assignment.profileId));
 const blocked=['project.close','project.followup','billing.deposit','estimate.releaseWorkOrder','ticket.mail','mail.intake','ticket.viewAll','ticket.assign','workorder.return','payroll.view','payroll.approve','invoice.group','finance.view','invoice.record','invoice.pay','workorder.review','purchase.create','inventory.adjust','inventory.transfer','money.view','reports.view','pricing.view','invoices.view','team.view','estimate.accept','estimate.convert','estimate.override'];
 const owner=['pricing.workorder.correct','pricing.profile.save','pricing.profile.assign','pricing.profile.bulk','pricing.client','pricing.part','pricing.project','settings.reserve','catalog.create','catalog.update','catalog.delete','pricing.profile.archive','entry.manage'];
 const permissions=[...profilePermissions].filter(key=>!owner.includes(key)&&!nonDelegablePassThrough.includes(key)&&
  (!key.endsWith('.delete')||key==='entry.remove')&&!['customer.update','contact.update','project.update','workorder.update'].includes(key)&&
  (role==='office'||!blocked.includes(key)));
 return {permissions,modes:inferModes(permissions),recordScopes:noScopes()};
}
export function effectivePermissions(state,user,role){return effectiveAccess(state,user,role).permissions;}

const aliases={
 'inventory.commitFieldPurchase':'inventory.receive','inventory.receiptRead':'inventory.view',
 'entry.materialDraft':'entry.add','entry.editNote':'entry.update','estimate.rates':'estimates.view',
 'payroll.preview':'payroll.view','mail.assign':'mail.intake','mail.sync':'mail.intake','clock.out':'clock.in','clock.cancel':'clock.in'
};
export function authorizePermission(action,role,permissions,data) {
 if(!role)throw Error('App access required');
 if(adminOnly.has(action)){
  if(role!=='admin')throw Error('Admin access required');
  if(action.startsWith('workorder.delete')&&(!permissions.includes('workorder.delete')||!permissions.includes('workorders.view')))throw Error('Admin work order deletion permission required');
  return;
 }
 if(action.startsWith('notification.')) action='notification.manage';
 if(action.startsWith('training.')) action='training.start';
 if(action==='pricing.profile.preview'||action==='pricing.profile.save'){
  if(data?.proposal?.kind==='archive'){
   action='pricing.profile.archive';
  }else if(data?.proposal?.kind==='correct'){
   action='pricing.workorder.correct';
  }else if(data?.proposal?.kind==='client-options'||data?.proposal?.kind==='assign'){
   action='pricing.profile.assign';
   const view={project:'projects.view',workorder:'workorders.view'}[data.proposal.scope];
   if(view&&!permissions.includes(view))throw Error('Assignment target view permission required');
  }else{
   action='pricing.profile.save';
   if(data?.proposal?.bulk&&!permissions.includes('pricing.profile.bulk'))throw Error('Bulk pricing permission required');
  }
 }
 if(action==='mail.assign'&&!permissions.includes('ticket.create'))throw Error('Create ticket permission required');
 if(action==='entry.add'&&data?.receipt!=null&&!permissions.includes('receipt.add'))throw Error('Work-order receipt upload permission required');
 if(action==='inventory.commitFieldPurchase'&&(!permissions.includes('workorders.view')||!permissions.includes('receipt.read')))throw Error('Work-order receipt access required');
 if(action==='inventory.receive'&&data?.warehouseReceive===true&&data.unitCost!=null&&!permissions.includes('finance.view'))throw Error('Finance access required to record unit cost');
 action=aliases[action]||action;
 if(requiresFinance.has(action)&&!permissions.includes('finance.view'))throw Error('Finance access required');
 if(['catalog.create','catalog.update'].includes(action)&&data?.inventoryEdit===true){
  if(!permissions.includes('inventory.view'))throw Error('Inventory view permission required');
  if(data.cost!==undefined&&!permissions.includes('finance.view'))throw Error('Finance access required to change unit cost');
 }
 if(action==='billing.deposit'&&(!permissions.includes('projects.view')||!permissions.includes('invoices.view')))throw Error('Projects and invoices view required');
 if(action==='estimate.releaseWorkOrder'&&(!permissions.includes('workorders.view')||!permissions.includes('workorder.approve')))throw Error('Work order approval permission required');
 if(action==='estimate.convert'&&(!permissions.includes('projects.view')||!permissions.includes('project.create')))throw Error('Project creation permission required');
 if(action==='staff.internal'&&(!permissions.includes('workorders.view')||!permissions.includes('workorder.create')))throw Error('Work order creation permission required');
 if(action==='pricing.workorder.correct'&&!permissions.includes('finance.view'))throw Error('Finance access required');
 const memberships=actionGroups.get(action);
 if(!memberships||action.startsWith('database.')||action==='finance.view')throw Error('Permission denied');
 if(!memberships.some(({module})=>permissions.includes(permissionMatrix[module].view)))throw Error('Module view permission denied');
 if(!permissions.includes(action))throw Error('Permission denied');
}
