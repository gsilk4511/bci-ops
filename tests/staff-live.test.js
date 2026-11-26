import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../Models/lib.js';
import {staffAction,staffMetrics,staffView} from '../Models/staff.js';
import {scopeState} from '../Models/record-scope.js';
import {approvePayroll,payrollPreview} from '../Models/payroll.js';

const email='simon@example.test', other='peer@example.test';
const tech={email,role:'tech',permissions:['staff.view','workorders.view','projects.view']};
const admin={email:'owner@example.test',role:'admin',permissions:['staff.view','staff.manage']};
const now=new Date('2026-11-25T14:00:00Z');
const row=(id,type,date,quantity,extra={})=>({id,type,date,quantity,unit:'hr',employeeEmail:email,rate:100,...extra});
function fixture(){
 const s=seed(),w=s.workorders[0];
 s.users=[{email,name:'Simon',role:'tech'},{email:other,name:'Other',role:'tech'}];
 s.staffProfiles=[{email,hourlyWages:[{effectiveDate:'2026-01-01',hourlyCents:3200}],profitShareBpsByYear:{2026:1000}}];
 w.status='released';w.approvedAt='2026-11-20T13:00:00Z';
 w.entries=[
  row('field','labor','2026-11-23',24),
  row('field-2','labor','2026-11-24',16),
  row('shared','travel','2026-11-24',7,{sharedTravel:true,rate:0}),
  row('supply','material','2026-11-24',5,{unit:'ea',rate:200}),
  row('peer','labor','2026-11-25',4,{employeeEmail:other,rate:400}),
 ];
 s.payrollOther=[row('holiday','holiday','2026-11-25',8),row('pto','pto','2026-11-17',5),
  row('sick','sick','2026-11-10',4),row('shop','shop','2026-11-09',2),
  row('future-holiday','holiday','2026-11-26',8),row('peer-sick','sick','2026-11-25',7,{employeeEmail:other}),
  row('legacy-unlinked','holiday','2026-11-25',8,{employeeEmail:'',tech:'Simon'})];
 s.staffLeave=[{id:'pending',email,status:'Pending',date:'2026-11-27',quantity:2,type:'vacation'},
  {id:'approved',email,status:'Approved',date:'2026-11-17',quantity:5,type:'vacation',payrollEntryId:'pto'}];
 return s;
}
const metrics=(s,actor=tech,scoped=s,date=now)=>staffMetrics(s,actor,scoped,2026,undefined,date);
const amounts=row=>[row.regular,row.overtime,row.pto,row.sick,row.holiday];

test('employee-only dashboard uses five configured workweeks, with compensable shared travel and separate leave',()=>{
 const s=fixture();
 const unset=metrics(s).weeklyTime;
 assert.equal(unset.workweekStart,null);
 assert.deepEqual(amounts(unset.rows[0]),[null,null,0,0,8]);
 assert.equal(unset.rows[0].worked,47);
 assert.throws(()=>staffAction(s,'staff.manage',{workweekStart:1},tech),/permission/i);
 assert.throws(()=>staffAction(s,'staff.manage',{workweekStart:'1'},admin),/first day/);
 assert.deepEqual(staffAction(s,'staff.manage',{workweekStart:1},admin),{workweekStart:1});
 const weeks=metrics(s).weeklyTime.rows;
 assert.equal(weeks.length,5);
 assert.equal(weeks[0].start,'2026-11-23');
 assert.equal(weeks[0].end,'2026-11-29');
 assert.equal(weeks[4].start,'2026-10-26');
 assert.deepEqual(amounts(weeks[0]),[40,7,0,0,8]);
 assert.equal(weeks[0].pendingLeave,2);
 assert.deepEqual(amounts(weeks[1]),[0,0,5,0,0]);
 assert.deepEqual(amounts(weeks[2]),[2,0,0,4,0]);
 assert.deepEqual(amounts(metrics(s,{...tech,email:other}).weeklyTime.rows[0]),[4,0,0,7,0]);
 assert.equal(metrics(s,{...tech,permissions:[]}),undefined);
 assert.ok(!JSON.stringify(staffView(s,tech).directory).includes('weeklyTime'));
 s.workorders[0].entries[2].sharedTravel=false;
 s.workorders[0].entries[2].rate=200;
 assert.deepEqual(amounts(metrics(s).weeklyTime.rows[0]),[40,7,0,0,8]);
 // Midnight Eastern is the chosen week boundary, not midnight UTC.
 assert.equal(metrics(s,tech,s,new Date('2026-11-23T04:59:00Z')).weeklyTime.rows[0].start,'2026-11-16');
 assert.equal(metrics(s,tech,s,new Date('2026-11-23T05:00:00Z')).weeklyTime.rows[0].start,'2026-11-23');
});

test('live bonus is based on the work date, costs and own labor before invoices, independent of collection',()=>{
 const s=fixture(),w=s.workorders[0];
 w.entries.push(row('last-year','labor','2025-12-31',3),row('future','labor','2026-12-01',9),
  row('old-name','labor','2026-11-25',7,{employeeEmail:undefined,tech:email}));
 s.workorders.push({...w,id:'internal-fixture',internalTask:true,entries:[row('shop-labor','labor','2026-11-25',10)]});
 const live=metrics(s).contribution;
 assert.equal(live.totalAttributedCents,400000);
 assert.equal(live.totalEmploymentCostCents,160000);
 assert.equal(live.totalNetProfitCents,240000);
 assert.equal(live.bonus.projectedCents,24000);
 w.invoice={status:'sent',sentAt:'2027-01-05T10:00:00Z',amountPaid:0};
 assert.deepEqual(metrics(s).contribution,live);
 w.invoice={...w.invoice,status:'paid',amountPaid:5000};
 assert.deepEqual(metrics(s).contribution,live);
 assert.equal(metrics(s,{...tech,email:other}).contribution.bonus.projectedCents,null);
 const quiet=metrics(s,{...tech,permissions:['staff.view']}).contribution;
 assert.equal(quiet.projects[0].projectId,null);
 assert.equal(quiet.projects[0].projectName,'Project');
 const scoped=scopeState(s,{...tech,recordScopes:{workorders:'own'}});
 assert.equal(metrics(s,tech,scoped).contribution.bonus.projectedCents,null);
 assert.ok(metrics(s,tech,scoped).contribution.coverage.scopeIncomplete);
});

test('correction recomputes the live estimate without rewriting an approved payroll snapshot',()=>{
 const s=fixture();s.meta.staffWorkweekStart=1;
 const initial=payrollPreview(s,'2026-11-23','2026-11-29');
 const run=approvePayroll(s,{start:initial.start,end:initial.end,payDate:'2026-12-02',revision:initial.revision,overtime:{[email]:7,[other]:0,simon:0}},admin);
 const locked=structuredClone(run);
 s.workorders[0].entries[0].quantity=23; // Fixture represents a later source reconciliation, not a payroll write path.
 const view=metrics(s);
 assert.deepEqual(amounts(view.weeklyTime.rows[0]),[40,6,0,0,8]);
 assert.equal(view.contribution.bonus.projectedCents,23400);
 assert.deepEqual(s.payrollRuns,[locked]);
});

test('other payroll entries linked by verified Team sign-in count even when the display name changes',async()=>{
 const {addOtherTime}=await import('../Models/payroll.js');
 const s=fixture();
 const input={employeeEmail:email.toUpperCase(),date:'2026-11-25',type:'holiday',quantity:3};
 assert.throws(()=>addOtherTime(s,{...input,employeeEmail:'not-on-team@example.test'},admin),/active employee/);
 const result=addOtherTime(s,input,admin);
 assert.equal(result.tech,'Simon');
 assert.equal(result.employeeEmail,email);
 s.users[0].name='New Display Name';
 assert.equal(metrics(s).weeklyTime.rows[0].holiday,11);
 assert.equal(metrics(s,{...tech,email:other}).weeklyTime.rows[0].holiday,0);
});
