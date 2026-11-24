import test from 'node:test';
import assert from 'node:assert/strict';
import {planAttribution,applyAttribution,attributedEmail} from '../Models/time-attribution.js';
import {payrollPreview,checkTimeEntry,approvePayroll} from '../Models/payroll.js';
import {mayEditWorkEntry} from '../Models/work-entry.js';
import {authorizePermission} from '../Models/permissions.js';
import {staffView} from '../Models/staff.js';
const simon='simon.m@bcielite.tech', date='2026-11-17';
const admin={role:'admin',email:'owner@example.invalid'};
const tech={role:'tech',email:simon,permissions:['staff.view','workorders.view','projects.view']};
const src={mode:'label',source:'Simon',target:simon};
const row=(id,type,quantity,tech,employeeEmail)=>({id,type,quantity,tech,employeeEmail,date,unit:'hr',description:'historic note'});
function fixture(){
 return {users:[{id:'existing-simon',email:simon,name:'Simon Mulligan',role:'tech',active:true},{id:'disabled',email:'disabled@example.invalid',role:'tech',active:false}],
  projects:[{id:'p',name:'Test project',number:'TEST'}], staffProfiles:[{email:simon,name:'Simon initial'}],
  workorders:[{id:'w',title:'Test Order',projectId:'p',entries:[row('record1','labor',19,'Simon'),row('record2','travel',7.5,'  Simon  '),row('current1','labor',14,simon,simon),row('current2','travel',5,simon,simon),row('unknown','labor',27,'unconfirmed@example.invalid'),row('distinct','labor',3,'Simon','other@example.invalid')],
  closeout:{originalEntries:[row('record1','labor',19,'Simon')]}}],
  payrollOther:[],payrollRuns:[],projectInvoices:[{id:'existing',orders:[{id:'w',entries:[row('record1','labor',19,'Simon')]}]}]};
}
test('reviewed exact name maps Simon to one 45.50 hour payroll row and preserves unrelated identities/snapshots',()=>{
 const state=fixture();
 Object.assign(state.workorders[0].entries[0],{rate:120,cost:46,catalogId:'same-labor'});
 const old=payrollPreview(state,date,date);
 const frozen=JSON.stringify([state.projectInvoices,state.workorders[0].closeout,state.users,state.staffProfiles]);
 const preview=planAttribution(state,src,admin).plan;
 assert.equal(preview.matches,2);assert.equal(preview.hours,26.5);
 const input={...src,fingerprint:preview.fingerprint,confirmation:'REASSIGN 2',reason:'Confirmed historical name belongs to Simon'};
 const result=applyAttribution(state,input,admin);
 assert.equal(result.updated,2);
 const next=payrollPreview(state,date,date), employee=next.rows.find(x=>x.key===simon);
 assert.equal(employee.work,33);assert.equal(employee.travel,12.5);assert.equal(employee.worked,45.5);
 assert.equal(next.rows.find(x=>x.key==='unconfirmed@example.invalid').work,27);
 assert.equal(next.rows.find(x=>x.key==='other@example.invalid').work,3);
 const corrected=state.workorders[0].entries[0];
 assert.equal(corrected.tech,'Simon');
 assert.deepEqual([corrected.rate,corrected.cost,corrected.catalogId,corrected.quantity,corrected.date],[120,46,'same-labor',19,date]);
 assert.equal(attributedEmail(state.workorders[0].entries[0]),simon);
 assert.equal(mayEditWorkEntry(state.workorders[0].entries[0],tech),true);
 assert.notEqual(next.revision,old.revision);
 assert.equal(JSON.stringify([state.projectInvoices,state.workorders[0].closeout,state.users,state.staffProfiles]),frozen);
 assert.equal(staffView(state,tech).time.length,4);
 assert.throws(()=>approvePayroll(state,{start:date,end:date,payDate:date,revision:old.revision},admin),/changed/);
 assert.throws(()=>applyAttribution(state,input,admin),/preview issues/);
});
test('admin, dry-run fingerprint, typo and destination validity fail closed; locked export stays unchanged',()=>{
 const state=fixture();
 state.payrollRuns=[{id:'paid',start:date,end:date,rows:[{employee:'Simon',work:19}]}];
 const locked=JSON.stringify(state.payrollRuns);
 assert.throws(()=>authorizePermission('timeAttribution.preview','tech',[],{}),/Admin/);
 assert.throws(()=>planAttribution(state,src,tech),/Admin/);
 assert.throws(()=>planAttribution(state,{...src,target:'disabled@example.invalid'},admin),/active Team/);
 const preview=planAttribution(state,{...src,rowId:'record1'},admin).plan;
 assert.equal(preview.locked,1);
 const input={...src,rowId:'record1',fingerprint:preview.fingerprint,confirmation:'REASSIGN 1',reason:'Confirmed exact entry'};
 assert.throws(()=>applyAttribution(state,{...input,confirmation:'okay'},admin),/Type REASSIGN/);
 state.workorders[0].entries[0].description='Same ID, newer legacy notes';
 assert.throws(()=>applyAttribution(state,input,admin),/fresh preview/);
 state.workorders[0].entries[0].description='historic note';
 state.workorders[0].entries[0].quantity=18;
 assert.throws(()=>applyAttribution(state,input,admin),/fresh preview/);
 state.workorders[0].entries[0].quantity=19;
 assert.equal(applyAttribution(state,input,admin).locked,1);
 assert.equal(JSON.stringify(state.payrollRuns),locked);
});
test('date-scoped alias also handles other time and catches overlaps without deduplicating measured hours',()=>{
 const state=fixture();
 Object.assign(state.workorders[0].entries[0],{quantity:2,startTime:'08:00',endTime:'10:00',tech:'simon-old@example.invalid',employeeEmail:'simon-old@example.invalid'});
 Object.assign(state.workorders[0].entries[2],{quantity:2,startTime:'09:00',endTime:'11:00'});
 state.payrollOther.push({...row('shop','shop',1,'simon-old@example.invalid'),recordedBy:admin.email});
 const criteria={mode:'email',source:'simon-old@example.invalid',target:simon,start:date,end:date};
 const p=planAttribution(state,criteria,admin).plan;
 assert.equal(p.matches,2);
 applyAttribution(state,{...criteria,confirmation:'REASSIGN 2',fingerprint:p.fingerprint,reason:'Verified alias'},admin);
 const review=payrollPreview(state,date,date);
 assert.equal(review.rows.find(x=>x.key===simon).shop,1);
 assert.ok(review.issues.some(x=>x.includes('overlapping')));
 assert.throws(()=>checkTimeEntry(state,{date,employeeEmail:simon,startTime:'08:30',endTime:'09:15'}),/overlapping/);
});
