import {test} from 'node:test';
import assert from 'node:assert/strict';
import {staffAction,staffView} from '../Models/staff.js';
import {contributionScopeLimited,contributionYear,validatedContributionYear} from '../Models/staff-profit-settings.js';
import {authorizePermission,effectivePermissions} from '../Models/permissions.js';
import {visibleState} from '../Models/visibility.js';
import {seed} from '../Models/lib.js';

const employee='alice@example.invalid', other='bob@example.invalid', admin='admin@example.invalid';
const grants=['staff.view','staff.manage','staff.jobCosts','workorders.view','finance.view'];
const boss={email:admin,role:'admin',permissions:grants};
const worker={email:employee,role:'tech',permissions:['staff.view','staff.profile','workorders.view']};
const year=contributionYear();
function fixture(){
 const state=seed(),order=state.workorders[0],sentAt=year+'-01-01T12:00:00.000Z';
 state.users=[{email:employee,role:'tech'},{email:other,role:'tech'}];
 order.entries=[{id:'own',date:year+'-01-01',type:'labor',employeeEmail:employee,rate:100,cost:0,quantity:2,unit:'hr',catalogId:'cat_3'}];
 order.closeout={reviewedAt:sentAt,originalEntries:[]};
 order.invoice={number:'100',groupId:'group',status:'sent',sentAt};
 state.projectInvoices=[{id:'group',projectId:order.projectId,number:'100',status:'open',sentAt,orders:[{id:order.id,entries:structuredClone(order.entries)}]}];
 return state;
}

test('percentage is distinct from absence, year-specific, admin-only, and never visible in a peer directory',()=>{
 const s=fixture();
 const save=(year,value)=>staffAction(s,'staff.manage',{email:employee,profitShareYear:year,profitSharePercent:value},boss);
 assert.deepEqual(save(2025,'10.25').profitShareByYear,{2025:10.25});
 assert.deepEqual(save(2026,0).profitShareByYear,{2025:10.25,2026:0});
 assert.throws(()=>save(2026,10.555),/two decimal/);
 assert.throws(()=>save(2026,'101'),/100%/);
 assert.throws(()=>save(2026,null),/100%/);
 assert.throws(()=>save(2026,{}),/100%/);
 assert.throws(()=>save('xyz',1),/contribution year/);
 assert.equal(validatedContributionYear('2026'),2026);
 assert.deepEqual(staffView(s,boss).staffProfiles.find(profile=>profile.email===employee).profitShareByYear,{2025:10.25,2026:0});
 assert.ok(!JSON.stringify(staffView(s,{...worker,email:other})).includes('profitShareByYear'));
 assert.throws(()=>staffAction(s,'staff.manage',{email:employee,profitShareYear:2026,profitSharePercent:30},{...worker,permissions:grants}),/Admin/);
 assert.deepEqual(save(2026,'').profitShareByYear,{2025:10.25});
});

test('hourly wages are effective-dated, editable only by admins, and not exposed to peers',()=>{
 const s=fixture();
 const save=(effective,value,by=boss)=>staffAction(s,'staff.manage',{email:employee,wageEffectiveDate:effective,hourlyWage:value},by);
 assert.throws(()=>save('2026-02-30','20'),/valid date/);
 assert.throws(()=>save('2026-01-01','20.001'),/two decimal/);
 assert.throws(()=>save('2026-01-01',''),/hourly wage/);
 assert.throws(()=>save('2026-01-01',-1),/hourly wage/);
 assert.throws(()=>save('2026-01-01',23,{...worker,permissions:grants}),/Admin/);
 save('2025-01-01','27.50');
 save('2026-01-01',30);
 assert.deepEqual(save('2026-01-01',0).hourlyWages,[{effectiveDate:'2026-01-01',hourlyCents:0},{effectiveDate:'2025-01-01',hourlyCents:2750}]);
 const live=staffView(s,boss).staffProfiles.find(person=>person.email===employee);
 assert.equal(live.hourlyWages[0].hourlyCents,0);
 assert.equal(staffView(s,boss).jobCostSetup,undefined);
 assert.ok(!JSON.stringify(staffView(s,{...worker,email:other})).includes('hourlyWages'));
 assert.ok(!JSON.stringify(staffView(s,worker)).includes('hourlyWages'));
 assert.equal(visibleState(s,'admin',grants).staffProfiles,undefined);
 assert.equal(effectivePermissions(s,{email:other},'office').includes('staff.jobCosts'),false);
 assert.throws(()=>authorizePermission('staff.jobCosts','admin',grants),/Permission denied/);
 s.technicianJobCosts={wo_demo:{employmentCents:100,directCents:0,overheadCents:0}};
 assert.equal(visibleState(s,'admin',grants).technicianJobCosts,undefined);
 assert.equal(staffView(s,worker,undefined,undefined,s).contribution.bonus.profitShareBps,500);
});

test('scope flag only marks an omitted or hidden own billed order in selected Eastern year',()=>{
 const s=fixture(),id=s.workorders[0].id;
 assert.equal(contributionScopeLimited(s,s,employee,year),false);
 assert.equal(contributionScopeLimited(s,{workorders:[]},employee,year),true);
 assert.equal(contributionScopeLimited(s,{workorders:[{id,billingHidden:true}]},employee,year),true);
 assert.equal(contributionScopeLimited(s,{workorders:[]},other,year),false);
 assert.equal(contributionScopeLimited(s,{workorders:[]},employee,year-1),false);
 delete s.workorders[0].invoice.sentAt;
 assert.equal(contributionScopeLimited(s,{workorders:[]},employee,year),true);

});

test('one staff-profile save can update leave, pay details, a dated wage and the annual rate atomically',()=>{
 const s=fixture();
 const combined={email:employee,name:'Alice Tech',contactEmail:employee,payScale:'Technician',vacationHours:40,sickHours:16,
  wageEffectiveDate:year+'-01-01',hourlyWage:'35.00',profitShareYear:year,profitSharePercent:'6.25'};
 const saved=staffAction(s,'staff.manage',combined,boss);
 assert.equal(saved.vacationHours,40);
 assert.equal(saved.sickHours,16);
 assert.equal(saved.payScale,'Technician');
 assert.deepEqual(saved.hourlyWages,[{effectiveDate:year+'-01-01',hourlyCents:3500}]);
 assert.equal(saved.profitShareByYear[year],6.25);
 const before=structuredClone(s.staffProfiles);
 assert.throws(()=>staffAction(s,'staff.manage',{...combined,vacationHours:99,hourlyWage:'-1'},boss),/hourly wage/);
 assert.deepEqual(s.staffProfiles,before);
 const self=staffView(s,worker,undefined,undefined,s).contribution;
 assert.equal(self.totalAttributedCents,20000);
 assert.equal(self.totalEmploymentCostCents,8750);
 assert.equal(self.totalNetProfitCents,11250);
 assert.equal(self.bonus.projectedCents,703);
 const settingsOnly=Object.fromEntries(Object.entries(combined).filter(([key])=>!['wageEffectiveDate','hourlyWage','profitShareYear','profitSharePercent'].includes(key)));
 staffAction(s,'staff.manage',{...settingsOnly,sickHours:22},boss);
 const after=staffView(s,boss).staffProfiles.find(profile=>profile.email===employee);
 assert.equal(after.sickHours,22);
 assert.equal(after.profitShareByYear[year],6.25);
 assert.deepEqual(after.hourlyWages,saved.hourlyWages);
});
