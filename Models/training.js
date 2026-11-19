import {seed, applyAction} from './lib.js';
import {authorizePermission} from './permissions.js';
import {visibleState} from './visibility.js';

const practiceActions = new Set([
  'customer.create','contact.create','project.create','project.contact','workorder.create',
  'workorder.approve','entry.add','entry.materialDraft','entry.editNote','workorder.close','workorder.review','invoice.group'
]);
const practiceViews = ['training.view','training.start','customers.view','projects.view','workorders.view','invoices.view','finance.view'];

function examples() {
  const state = seed();
  const client = state.customers[0];
  Object.assign(client,{name:'Training Client',business:'Example Property Company',phone:'802-555-0100',
    contacts:[{id:'contact_demo',name:'Jamie Example',phone:'802-555-0101',email:'jamie@example.invalid'}]});
  state.projects[0].name='Practice network expansion';
  state.workorders[0].title='Practice scope approval';
  const approved = {...structuredClone(state.workorders[0]),id:'training_released',title:'Practice time and materials',
    status:'released',approvedAt:'2026-01-01T12:00:00.000Z',approval:{signedBy:'Example Customer',at:'2026-01-01T12:00:00.000Z'}};
  const entry = {id:'training_entry',type:'labor',catalogId:'cat_3',name:'Cable technician labor',
    unit:'hr',quantity:1,rate:95,cost:34,tech:'Training Technician',date:'2026-01-01',description:'Installed a sample network outlet.'};
  const review = {...structuredClone(approved),id:'training_review',title:'Practice closeout review',
    status:'ready-for-review',entries:[entry],closeout:{at:'2026-01-01T15:00:00.000Z',
      submittedBy:'Training Technician',originalEntries:[structuredClone(entry)],originalChanges:[],originalApproval:approved.approval}};
  const invoice = {...structuredClone(review),id:'training_invoice',title:'Practice invoice detail',status:'reviewed'};
  invoice.closeout.reviewedAt='2026-01-01T16:00:00.000Z';
  state.workorders.push(approved,review,invoice);
  return {state,step:0,finished:false};
}

function workspace(live,email) {
  return (live.trainingWorkspaces || []).find(item=>item.email===email);
}

function permissionsFor(permissions) {
  return permissions.filter(key=>practiceActions.has(key)||practiceViews.includes(key));
}

export function trainingState(live, actor) {
  if (!actor.permissions.includes('training.view')) throw Error('Training permission required');
  const practice = workspace(live,actor.email) || examples();
  const permissions = permissionsFor(actor.permissions);
  const state = visibleState(practice.state,'tech',permissions);
  return {...state, training:{step:practice.step,finished:practice.finished},
    me:{email:actor.email,role:'tech',permissions},stats:null};
}

export function trainingAction(live, action, data, actor) {
  if (!actor.permissions.includes('training.view')||!actor.permissions.includes('training.start')) throw Error('Training write permission required');
  if (action==='training.reset' && data.all===true) {
    if (actor.role!=='admin') throw Error('Administrator access required');
    live.trainingWorkspaces=[];
    return {reset:true};
  }
  const workspaces = live.trainingWorkspaces ??= [];
  let practice = workspace(live,actor.email);
  if (action==='training.reset') {
    live.trainingWorkspaces=workspaces.filter(item=>item.email!==actor.email);
    return {reset:true};
  }
  if (!practice) {practice={email:actor.email,...examples()};workspaces.push(practice);}
  if (action==='training.start') return {started:true};
  if (action==='training.progress') {
    if (!Number.isSafeInteger(data.step)||data.step<0||data.step>10) throw Error('Invalid training step');
    practice.step=data.step;
    practice.finished=data.finished===true;
    return {step:practice.step};
  }
  // The endpoint accepts only the exercise's actions. Every action is checked
  // against the user's actual grants and receives only their practice state.
  if (!practiceActions.has(action)) throw Error('Action unavailable in practice');
  const permissions = permissionsFor(actor.permissions);
  authorizePermission(action,actor.role,permissions,data);
  if (action==='project.create'||action==='project.contact') {
    if (data.newContact) authorizePermission('contact.create',actor.role,permissions,data);
    if (data.serviceCategory) throw Error('Practice projects use the base rate');
  }
  return applyAction(practice.state,action,data,{email:actor.email,permissions});
}
