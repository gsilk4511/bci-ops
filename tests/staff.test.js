import {test} from 'node:test';
import assert from 'node:assert/strict';
import {staffAction,staffAvatar,staffName,staffTechnicianIcons,staffView,isInternalProject} from '../Models/staff.js';
import {authorizePermission,effectivePermissions} from '../Models/permissions.js';
import {visibleState} from '../Models/visibility.js';
import {defaultProfileStyle,profileStyleOptions} from '../public/modules/profile-style-catalog.js';
import {payrollPreview} from '../Models/payroll.js';

const a='worker@example.com',b='other@example.com',o='admin@example.com';
const tech={role:'tech',email:a,permissions:['staff.view','staff.profile','staff.leave','staff.internal','workorder.create','workorders.view']};
const manager={role:'admin',email:o,permissions:['staff.view','staff.manage','staff.leaveReview']};
function state(){return {users:[{email:a},{email:b}],customers:[{id:'r',name:'Randy Bevins'}],projects:[{id:'p',name:'BCI ELITE ADMIN',customerId:'r'}],workorders:[],meta:{},catalog:[]};}

test('staff profile has immutable login and privileged balance controls',()=>{
 const s=state();
 staffAction(s,'staff.manage',{email:a,name:'Worker',contactEmail:a,payScale:'Tier 1',vacationHours:40,sickHours:16},manager);
 staffAction(s,'staff.profile',{email:b,displayName:'A Worker',bio:'A short bio',socialLinks:[{label:'Portfolio',url:'https://example.com/work'}],name:'Ignored',contactEmail:'contact@example.com',payScale:'Override',vacationHours:999},tech);
 assert.equal(staffName(s,a),'Worker');
 const own=staffView(s,tech).profile;
 assert.deepEqual([own.email,own.name,own.contactEmail,own.payScale,own.vacationHours,own.sickHours,own.displayName],[a,"Worker",a,"Tier 1",40,16,"A Worker"]);
 const peer=staffView(s,{...tech,email:b}).directory.find(row=>row.id===own.id);
 assert.deepEqual(Object.keys(peer).sort(),["avatarUrl","bio","displayName","id","socialLinks","style"]);
 assert.equal(peer.bio,"A short bio");
 assert.deepEqual(peer.socialLinks,[{label:"Portfolio",url:"https://example.com/work"}]);
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

test('unsafe social and image payloads are rejected; avatar is separately permissioned',()=>{
 const s=state();
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jefkAAAAASUVORK5CYII=';
 assert.throws(()=>staffAction(s,'staff.profile',{displayName:'Name',socialLinks:[{label:'bad',url:'javascript:alert(1)'}]},tech),/HTTPS/);
 assert.throws(()=>staffAction(s,'staff.profile',{displayName:'Name',avatarBase64:Buffer.from('<svg onload=alert(1)>').toString('base64')},tech),/JPEG or PNG/);
 const saved=staffAction(s,'staff.profile',{displayName:'Name',avatarBase64:png},tech);
 assert.ok(!JSON.stringify(staffView(s,tech)).includes(png));
 assert.equal(staffAvatar(s,{...tech,email:b},saved.id).mime,'image/png');
 assert.equal(staffAvatar(s,{...tech,permissions:[]},saved.id),null);
 assert.equal(staffAvatar(s,{...tech,email:b},a),null);
 s.users[0].active=false;
 assert.equal(staffAvatar(s,{...tech,email:b},saved.id),null);
 s.users[0].active=true;
 staffAction(s,'staff.profile',{displayName:'Name',avatarBase64:''},tech);
 assert.equal(staffAvatar(s,tech,saved.id),null);
});

test('work and project counts are personal; project titles and links respect permissions and record scope',()=>{
 const s=state();
 s.projects.push({id:'secret',name:'Out of scope'});
 s.workorders=[
  {id:'w',projectId:'p',title:'Task 1',entries:[{type:'labor',employeeEmail:a,quantity:2},{type:'travel',employeeEmail:a,quantity:1}]},
  {id:'w2',projectId:'secret',title:'Secret order',entries:[{type:'labor',employeeEmail:a,quantity:2}]},
  {id:'other',projectId:'p',entries:[{type:'labor',employeeEmail:b,quantity:99}]}
 ];
 const view=staffView(s,{...tech,permissions:[...tech.permissions,'projects.view']},new Set(['w']),new Set(['p']));
 assert.deepEqual(view.overview,{workorders:2,projects:2});
 assert.deepEqual(view.projects,[{id:'p',name:'BCI ELITE ADMIN',workorders:1,hours:3}]);
 assert.equal(view.time.at(-1).projectId,null);
 assert.ok(!JSON.stringify(view).includes('Secret order'));
 assert.ok(!JSON.stringify(view).includes('Out of scope'));
});

test('staff customization preserves valid legacy defaults and strictly accepts only configured IDs',()=>{
 const s=state();
 assert.deepEqual(staffView(s,tech).profile.style,defaultProfileStyle);
 const style=Object.fromEntries(Object.keys(defaultProfileStyle).map(key=>[key,profileStyleOptions[key].find(option=>option.id!==defaultProfileStyle[key]).id]));
 const save=(stylePatch)=>staffAction(s,'staff.profile',{displayName:'One',...stylePatch},tech);
 assert.deepEqual(save({style}).style,style);
 assert.deepEqual(save({}).style,style);
 const ring=defaultProfileStyle.ring;
 assert.deepEqual(save({style:{ring}}).style,{...style,ring});
 assert.throws(()=>save({style:{ring:'<script>'}}),/available profile style/);
 assert.throws(()=>save({style:{custom:'any'}}),/available profile style/);
 assert.throws(()=>save({style:JSON.parse('{"__proto__":"x"}')}),/available profile style/);
 assert.throws(()=>save({style:null}),/valid profile style/);
 assert.deepEqual(staffView(s,{...tech,email:b}).directory.find(row=>row.displayName==='One').style,{...style,ring});
});

test('staff technician icons use stable employee identity not display name or actor',()=>{
 const s=state(),icon=profileStyleOptions.icon.find(option=>option.id!==defaultProfileStyle.icon).id;
 staffAction(s,'staff.profile',{displayName:'One',style:{icon}},tech);
 const orders=[{id:'one',entries:[{id:1,type:'labor',employeeEmail:a},{id:2,type:'labor',tech:a},{id:3,type:'labor',createdBy:a},{id:4,type:'labor',employeeEmail:b}]}];
 const result=staffTechnicianIcons(s,tech,orders);
 assert.deepEqual(result[0].entries.map(row=>row.technicianIcon),[icon,undefined,undefined,undefined]);
 assert.equal(orders[0].entries[0].technicianIcon,undefined);
 assert.equal(staffTechnicianIcons(s,{...tech,email:b,permissions:['staff.view']},orders),orders);
 s.users[0].active=false;
 assert.equal(staffTechnicianIcons(s,{...tech,email:b},orders)[0].entries[0].technicianIcon,undefined);
});
