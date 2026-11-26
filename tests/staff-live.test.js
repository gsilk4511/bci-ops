import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../Models/lib.js';
import {staffAction,staffMetrics,staffView} from '../Models/staff.js';
import {scopeState} from '../Models/record-scope.js';
import {approvePayroll,markPayrollPaid,payrollPreview} from '../Models/payroll.js';

const email='simon@example.test', other='peer@example.test';
const tech={email,role:'tech',permissions:['staff.view','workorders.view','projects.view']};
const admin={email:'owner@example.test',role:'admin',permissions:['staff.view','staff.manage','payroll.view','payroll.approve']};
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

test('Simon example: live payroll includes paid holiday and uses a 30% reserve on positive labor profit',()=>{
 const s=fixture(),w=s.workorders[0];
 s.staffProfiles[0]={email,payScale:'$31/hour',profitShareBpsByYear:{2026:1000}};
 w.entries=[row('work-1','labor','2026-11-23',20,{rate:2750}),row('work-2','labor','2026-11-24',14,{rate:45000/14}),
  row('supply','material','2026-11-24',5,{unit:'ea',rate:200}),
  row('other-person','labor','2026-11-25',4,{employeeEmail:other,rate:400}),
  row('last-year','labor','2025-12-31',3),row('future','labor','2026-12-01',9)];
 s.payrollOther=[row('holiday','holiday','2026-11-25',8),row('legacy-unlinked','holiday','2026-11-25',8,{employeeEmail:'',tech:'Simon'})];
 const live=metrics(s).contribution;
 assert.equal(live.totalAttributedCents,10000000);
 assert.equal(live.totalEmploymentCostCents,162750);
 assert.equal(live.totalNetProfitCents,9837250);
 assert.equal(live.taxReserveCents,2951175);
 assert.equal(live.totalAfterTaxProfitCents,6886075);
 assert.equal(live.bonus.projectedCents,688608);
 assert.equal(live.cash.bonus.projectedCents,0);
 const {cash:initialCash,...initialAccrual}=live;
 w.invoice={number:'QB-1',status:'sent',sentAt:'2026-11-25T10:00:00Z',amountPaid:0};
 assert.deepEqual(metrics(s).contribution.cash,initialCash);
 const preview=payrollPreview(s,'2026-11-23','2026-11-29');
 const locked=approvePayroll(s,{start:preview.start,end:preview.end,payDate:'2026-12-02',revision:preview.revision,overtime:{[email]:0,[other]:0,simon:0}},admin);
 locked.approvedAt='2026-11-30T13:00:00Z';
 const afterPayDate=new Date('2026-12-02T17:00:00Z');
 assert.equal(metrics(s,tech,s,afterPayDate).contribution.cash.totalAttributedCents,0);
 assert.throws(()=>markPayrollPaid(s,{id:locked.id,confirmation:'paid'},tech,afterPayDate),/approval access/);
 assert.throws(()=>markPayrollPaid(s,{id:locked.id},admin,afterPayDate),/Confirm payroll/);
 markPayrollPaid(s,{id:locked.id,confirmation:'paid'},admin,afterPayDate);
 assert.deepEqual(metrics(s).contribution.cash,initialCash);
 const {cash:paid}=metrics(s,tech,s,afterPayDate).contribution;
 assert.deepEqual([paid.totalAttributedCents,paid.totalEmploymentCostCents,paid.taxReserveCents,paid.bonus.projectedCents],
  [10000000,162750,2951175,688608]);
 const {cash:ignore,...accrual}=metrics(s).contribution;
 assert.deepEqual(accrual,initialAccrual);
 w.invoice={...w.invoice,status:'paid',amountPaid:100000};
 assert.deepEqual(metrics(s,tech,s,afterPayDate).contribution.cash,paid);
 w.invoice={...w.invoice,voidedAt:'2026-11-25T12:00:00Z'};
 const voided=metrics(s,tech,s,afterPayDate).contribution.cash;
 assert.equal(voided.totalAttributedCents,0);
 assert.equal(voided.totalEmploymentCostCents,31000);
 assert.equal(voided.taxReserveCents,0);
 assert.equal(metrics(s,{...tech,email:other}).contribution.bonus.projectedCents,null);
 const quiet=metrics(s,{...tech,permissions:['staff.view']}).contribution;
 assert.equal(quiet.projects[0].projectId,null);
 assert.equal(quiet.projects[0].projectName,'Project');
 const scoped=scopeState(s,{...tech,recordScopes:{workorders:'own'}});
 assert.equal(metrics(s,tech,scoped).contribution.bonus.projectedCents,null);
 assert.ok(metrics(s,tech,scoped).contribution.coverage.scopeIncomplete);
 assert.equal(metrics(s,tech,scoped).contribution.totalEmploymentCostCents,162750);
});

test('correction recomputes the live estimate without rewriting an approved payroll snapshot',()=>{
 const s=fixture();s.meta.staffWorkweekStart=1;
 const initial=payrollPreview(s,'2026-11-23','2026-11-29');
 const run=approvePayroll(s,{start:initial.start,end:initial.end,payDate:'2026-12-02',revision:initial.revision,overtime:{[email]:7,[other]:0,simon:0}},admin);
 const locked=structuredClone(run);
 s.workorders[0].entries[0].quantity=23; // Fixture represents a later source reconciliation, not a payroll write path.
 const view=metrics(s);
 assert.deepEqual(amounts(view.weeklyTime.rows[0]),[40,6,0,0,8]);
 assert.equal(view.contribution.bonus.projectedCents,8260);
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

test('Cash uses matched frozen invoice labor and paid payroll, not current rates or receipts',()=>{
 const s=fixture(),w=s.workorders[0];s.meta.staffWorkweekStart=1;
 const invoice={id:'group-1',number:'QB-2',sentAt:'2026-11-24T17:00:00Z',projectId:w.projectId,
  orders:[{id:w.id,entries:w.entries.map(({employeeEmail,...record})=>record)}]};
 s.projectInvoices=[invoice];
 w.invoice={groupId:invoice.id,number:invoice.number,status:'sent',amountPaid:0};
 const preview=payrollPreview(s,'2026-11-23','2026-11-24');
 const locked=approvePayroll(s,{start:preview.start,end:preview.end,payDate:'2026-11-24',revision:preview.revision,overtime:{[email]:7}},admin);
 locked.approvedAt='2026-11-24T13:00:00Z';
 markPayrollPaid(s,{id:locked.id,confirmation:'paid'},admin,new Date('2026-11-24T15:00:00Z'));
 w.entries[0].rate=150; // Current attribution differs from frozen invoice charge.
 s.workorders.push({...w,id:'new-unbilled',invoice:null,entries:[row('new-labor','labor','2026-11-25',2)]});
 const result=metrics(s).contribution;
 assert.equal(result.totalAttributedCents,540000);
 assert.equal(result.totalEmploymentCostCents,290000);
 assert.equal(result.cash.totalAttributedCents,400000);
 assert.equal(result.cash.totalEmploymentCostCents,202000);
 assert.equal(result.cash.bonus.projectedCents,13860);
 const hidden=scopeState(s,{...tech,recordScopes:{invoices:'none'}});
 assert.equal(metrics(s,tech,hidden).contribution.cash.bonus.projectedCents,null);
 invoice.void=true;
 assert.equal(metrics(s).contribution.cash.totalAttributedCents,0);
 invoice.void=false;
 invoice.orders[0].entries[0].date='2026-11-20';
 const incomplete=metrics(s).contribution.cash;
 assert.equal(incomplete.status,'partial');
 assert.equal(incomplete.bonus.projectedCents,null);
});

test('tax reserve is on positive annual profit after losses; project totals reconcile to the cent',()=>{
 const s=fixture(),w=s.workorders[0];
 s.payrollOther=[];
 w.entries=[row('main','labor','2026-11-25',1,{rate:40.03})];
 s.workorders.push({...w,id:'other-profit',projectId:'second',entries:[row('small','labor','2026-11-25',1,{rate:40.03})]});
 s.workorders.push({...w,id:'loss',projectId:'third',entries:[row('neg','labor','2026-11-25',1,{rate:39.99})]});
 const result=metrics(s).contribution;
 assert.equal(result.totalNetProfitCents,5);
 assert.equal(result.taxReserveCents,2);
 assert.equal(result.totalAfterTaxProfitCents,3);
 assert.equal(result.projects.reduce((sum,project)=>sum+project.afterTaxProfitCents,0),3);
 s.workorders.at(-1).entries[0].rate=35;
 const loss=metrics(s).contribution;
 assert.equal(loss.totalNetProfitCents,-494);
 assert.equal(loss.taxReserveCents,0);
 assert.equal(loss.totalAfterTaxProfitCents,-494);
 assert.equal(loss.bonus.projectedCents,0);
});

test('unreviewed Accrual uses profile fallback for a dated gap without changing Cash',()=>{
 const s=fixture(),w=s.workorders[0];
 w.entries=[row('early','labor','2026-11-17',2),row('late','labor','2026-11-24',2)];
 s.payrollOther=[];
 s.staffProfiles[0]={email,payScale:'$31/hr',hourlyWages:[{effectiveDate:'2026-11-23',hourlyCents:3500}]};
 delete w.approvedAt;
 const live=metrics(s).contribution;
 assert.equal(live.totalAttributedCents,40000);
 assert.equal(live.totalEmploymentCostCents,16500);
 assert.equal(live.taxReserveCents,7050);
 assert.equal(live.totalAfterTaxProfitCents,16450);
 assert.equal(live.bonus.projectedCents,823);
 assert.equal(live.estimate.fallbackRows,1);
 assert.equal(live.estimate.loggedHours,4);
 assert.equal(live.estimate.partial,false);
 assert.equal(live.cash.bonus.projectedCents,0);
 assert.equal(live.cash.estimate,undefined);
});

test('a missing wage or bad row does not mask priced work or pad the bonus',()=>{
 const s=fixture(),w=s.workorders[0];
 s.staffProfiles[0]={email,payScale:'Grade 3',hourlyWages:[
  {effectiveDate:'2026-01-01',hourlyCents:null},{effectiveDate:'2026-11-23',hourlyCents:3500}]};
 w.entries=[row('early','labor','2026-11-17',2),row('late','labor','2026-11-24',2),
  row('bad','labor','2026-11-24',-2)];
 s.payrollOther=[];
 const live=metrics(s).contribution;
 assert.equal(live.status,'partial');
 assert.equal(live.totalAttributedCents,40000);
 assert.equal(live.estimate.matchedRevenueCents,20000);
 assert.equal(live.totalEmploymentCostCents,8750);
 assert.equal(live.totalAfterTaxProfitCents,7875);
 assert.equal(live.bonus.projectedCents,394);
 assert.ok(live.estimate.issues.some(row=>row.reason==='missing-wage'&&row.date==='2026-11-17'));
 s.staffProfiles[0]={email,payScale:'Grade 3'};
 const empty=metrics(s).contribution;
 assert.equal(empty.estimate.loggedHours,4);
 assert.equal(empty.totalEmploymentCostCents,null);
 assert.equal(empty.bonus.projectedCents,null);
});

test('unset workweek uses straight time even over 40 worked hours, without changing payroll',()=>{
 const s=fixture();
 const snapshot=payrollPreview(s,'2026-11-23','2026-11-29');
 const {contribution:live}=metrics(s);
 assert.equal(live.estimate.straightTimeOnly,true);
 assert.equal(live.totalEmploymentCostCents,264000); // 47 worked + 19 paid leave/shop hours over YTD.
 assert.equal(live.bonus.status,'available');
 assert.deepEqual(payrollPreview(s,'2026-11-23','2026-11-29'),snapshot);
});
