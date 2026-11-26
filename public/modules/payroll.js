// Owns the payroll presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { can, data, esc, f, head, modal, payrollDraft, practiceMode, send, table } from '../app.js';

export function payrollPage(){
 const runs=data.payrollRuns||[];
 return head('Payroll review','Time & payroll','Review individual hours independently of job closeout.',
  can('payroll.other')?'<button class="secondary" data-open="other-time">+ Shop time or leave</button>':'')+
  `<section class="panel"><form id="payrollPeriod"><div class="filters">
   ${f('start','Period start',{type:'date',required:true,value:payrollDraft?.start})}
   ${f('end','Period end',{type:'date',required:true,value:payrollDraft?.end})}
   <button class="primary" type="submit">Review period</button></div></form><div id="payrollReview"></div></section>
   <section class="panel"><h2>Approved pay periods</h2>${table(['Period','Scheduled pay date','Approved by','Payment confirmation','Exports'],runs.map(run=>
   `<tr><td>${esc(run.start)} – ${esc(run.end)}</td><td>${esc(run.payDate)}</td><td>${esc(run.approvedBy)}</td><td>${run.paidAt?`Confirmed paid · ${esc(new Date(run.paidAt).toLocaleDateString())}`:
    !practiceMode&&can('payroll.approve')?`<button type="button" class="secondary small" data-mark-payroll-paid="${esc(run.id)}">Mark payroll paid</button>`:'Not confirmed'}</td><td>
   <button class="secondary" data-payroll-csv="${esc(run.id)}">CSV</button> <button class="secondary" data-payroll-print="${esc(run.id)}">Print / PDF</button></td></tr>`))}</section>`;
}


document.addEventListener('click',event=>{
 const button=event.target.closest('[data-mark-payroll-paid]');
 if(!button||practiceMode||!can('payroll.view')||!can('payroll.approve'))return;
 const run=(data.payrollRuns||[]).find(row=>row.id===button.dataset.markPayrollPaid);
 if(!run||run.paidAt)return;
 modal('Confirm payroll is already paid',
  '<label><input type="checkbox" name="confirmation" value="paid" required> This payroll period has already been paid outside BCI Operations.</label>',
  values=>send('payroll.markPaid',{id:run.id,confirmation:values.confirmation}),
  `<p>${esc(run.start)} through ${esc(run.end)}. This records confirmation only and does not send a payment.</p>`);
});
