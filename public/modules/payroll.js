// Owns the payroll presentation.
// Shared state is imported as live bindings from the application shell.
// Write actions still pass through the shared permission-checked API.
import { can, data, esc, f, head, payrollDraft, table } from '../app.js';

export function payrollPage(){
 const runs=data.payrollRuns||[];
 return head('Payroll review','Time & payroll','Review individual hours independently of job closeout.',
  can('payroll.other')?'<button class="secondary" data-open="other-time">+ Shop time or leave</button>':'')+
  `<section class="panel"><form id="payrollPeriod"><div class="filters">
   ${f('start','Period start',{type:'date',required:true,value:payrollDraft?.start})}
   ${f('end','Period end',{type:'date',required:true,value:payrollDraft?.end})}
   <button class="primary" type="submit">Review period</button></div></form><div id="payrollReview"></div></section>
   <section class="panel"><h2>Approved pay periods</h2>${table(['Period','Pay date','Approved by','Exports'],runs.map(run=>
   `<tr><td>${esc(run.start)} – ${esc(run.end)}</td><td>${esc(run.payDate)}</td><td>${esc(run.approvedBy)}</td><td>
   <button class="secondary" data-payroll-csv="${esc(run.id)}">CSV</button> <button class="secondary" data-payroll-print="${esc(run.id)}">Print / PDF</button></td></tr>`))}</section>`;
}

