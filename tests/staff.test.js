import {test} from 'node:test';
import assert from 'node:assert/strict';
import {staffAction,staffName,staffView,isInternalProject} from '../Models/staff.js';
import {authorizePermission,effectivePermissions} from '../Models/permissions.js';
import {visibleState} from '../Models/visibility.js';
import {payrollPreview} from '../Models/payroll.js';

const a='worker@example.com',b='other@example.com',o='admin@example.com';
const tech={role:'tech',email:a,permissions:['staff.view','staff.profile','staff.leave','staff.internal','workorder.create','workorders.view']};
const manager={role:'admin',email:o,permissions:['staff.view','staff.manage','staff.leaveReview']};
function state(){return {users:[{email:a},{email:b}],customers:[{id:'r',name:'Randy Bevins'}],projects:[{id:'p',name:'BCI ELITE ADMIN',customerId:'r'}],workorders:[],meta:{},catalog:[]};}

test('staff profile has immutable login and privileged balance controls',()=>{
 const s=state();
 staffAction(s,'staff.manage',{email:a,name:'Worker',contactEmail:a,payScale:'Tier 1',vacationHours:40,sickHours:16},manager);
 staffAction(s,'staff.profile',{email:b,name:'A Worker',contactEmail:'contact@example.com',payScale:'Override',vacationHours:999},tech);
 assert.equal(staffName(s,a),'A Worker');
 assert.deepEqual(staffView(s,tech).profile,{email:a,name:'A Worker',contactEmail:'contact@example.com',payScale:'Tier 1',vacationHours:40,sickHours:16});
 assert.equal(staffView(s,tech).staffProfiles,undefined);
 assert.equal(visibleState(s,'tech',tech.permissions).staffProfiles,undefined);
 assert.throws(()=>authorizePermission('staff.manage','tech',['staff.view','staff.manage']),/Admin/);
 assert.ok(effectivePermissions(s,{email:a},'tech').includes('staff.leave'));
});

test('My Time only reads entries tied to employee identity and links to permitted work orders',()=>{
 const s=state(),row={date:'2026-11-19',type:'labor',description:'Task',quantity:2};
 s.workorders.push({id:'w',projectId:'p',title:'Task 1',internalTask:true, closeout:{at:'now'},entries:[{...row,id:'a',employeeEmail:a},{...row,id:'b',employeeEmail:b,tech:a}]});
 const result=staffView(s,tech);
 assert.deepEqual(result.time.map(({id,type,status,workorderId})=>[id,type,status,workorderId]),[['a','internal','Submitted','w']]);
 assert.equal(staffView(s,{...tech,permissions:['staff.view']}).time[0].workorderId,null);
});

test('approved leave records once in payroll and reduces balance once',()=>{
 const s=state();
 staffAction(s,'staff.manage',{email:a,name:'Worker',contactEmail:a,payScale:'Tier 1',vacationHours:40,sickHours:16},manager);
 const data={date:'2026-11-19',type:'vacation',quantity:4};
 const request=staffAction(s,'staff.leave',data,tech);
 assert.throws(()=>staffAction(s,'staff.leave',data,tech),/identical/);
 assert.equal(staffView(s,tech).profile.vacationHours,40);
 staffAction(s,'staff.leaveReview',{id:request.id,decision:'approve'},manager);
 assert.throws(()=>staffAction(s,'staff.leaveReview',{id:request.id,decision:'approve'},manager),/already/);
 assert.equal(staffView(s,tech).profile.vacationHours,36);
 assert.equal(payrollPreview(s,data.date,data.date).rows[0].pto,4);
});

test('new internal work order targets exactly one approved client/project and gets nonbillable flag',()=>{
 const s=state();
 assert.ok(isInternalProject(s,s.projects[0]));
 assert.ok(staffView(s,tech).internalAvailable);
 const result=staffAction(s,'staff.internal',{projectId:'wrong',description:'Inventory'},tech,params=>({...params}));
 assert.equal(result.projectId,'p');
 assert.equal(result.internalTask,true);
 assert.equal(result.status,'released');
 s.projects.push({...s.projects[0],id:'p2'});
 assert.equal(staffView(s,tech).internalAvailable,false);
 assert.throws(()=>staffAction(s,'staff.internal',{description:'Inventory'},tech,()=>{}),/exactly one/);
});

test('My Time shows retained payroll evidence without reopening or linking archived orders',()=>{
 const s=state();
 s.payrollOther=[{id:'clock1',employeeEmail:a,deletedWorkorderId:'gone',job:'Old work',type:'labor',date:'2026-11-19',description:'Actual work',quantity:2},{id:'clock2',employeeEmail:b,deletedWorkorderId:'gone',job:'Old work',type:'labor',date:'2026-11-19',quantity:2}];
 assert.deepEqual(staffView(s,tech).time.map(({id,workorderId,status})=>[id,workorderId,status]),[['clock1',null,'Archived — payroll review']]);
});

test('cannot approve leave in a subsequently finalized period',()=>{
 const s=state(),date='2026-11-19';
 staffAction(s,'staff.manage',{email:a,name:'Worker',contactEmail:a,vacationHours:40,sickHours:16},manager);
 const request=staffAction(s,'staff.leave',{date,type:'sick',quantity:4},tech);
 s.payrollRuns=[{start:date,end:date}];
 assert.throws(()=>staffAction(s,'staff.leaveReview',{id:request.id,decision:'approve'},manager),/approved/);
 assert.equal(staffView(s,tech).profile.sickHours,16);
 assert.equal(staffView(s,tech).leave[0].status,'Pending');
});
