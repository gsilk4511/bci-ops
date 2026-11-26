import {esc} from '../app.js';

const palette=['#157f76','#327bc5','#994796','#bb5b21','#627a24','#7852b6','#b33a56','#437678'];
export const contributionCurrency=cents=>Number.isFinite(cents)?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(cents/100):'Not available';
const percent=value=>Number.isFinite(value)?new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value)+'%':'Not configured';
const dateLabel=date=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return 'Not available';
 const fixed=new Date(date+'T12:00:00Z');
 return Number.isFinite(fixed.getTime())?new Intl.DateTimeFormat(undefined,{dateStyle:'full',timeZone:'UTC'}).format(fixed):'Not available';
};
function pie(title,description,total,rows,net=false){
 const chartable=Number.isFinite(total), positives=chartable?rows.filter(row=>Number.isFinite(row.cents)&&row.cents>0):[];
 const loss=chartable&&net?rows.filter(row=>Number.isFinite(row.cents)&&row.cents<0):[];
 const sum=positives.reduce((acc,row)=>acc+row.cents,0);
 let angle=0;
 const arcs=positives.map(row=>{
  const start=angle, size=row.cents/sum*100;angle+=size;
  return `<circle cx="50" cy="50" r="36" fill="none" stroke="${row.color}" stroke-width="16" pathLength="100" stroke-dasharray="${size} ${100-size}" stroke-dashoffset="${-start}" transform="rotate(-90 50 50)" />`;
 }).join('');
 const legendRows=(items,withColor)=>items.map(row=>`<div><dt>${withColor?`<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="6" fill="${row.color}" /></svg>`:''}${esc(row.name)}</dt><dd>${contributionCurrency(row.cents)}</dd></div>`).join('');
 return `<section class="bci-profit-card"><h3>${title}</h3><p>${description}</p>
  <div class="bci-profit-ring"><div class="bci-staff-donut">
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
     <circle cx="50" cy="50" r="36" fill="none" stroke="#8b9797" stroke-width="16" opacity=".25" />${arcs}</svg>
    <div class="bci-staff-total"><strong>${contributionCurrency(total)}</strong></div>
  </div></div>
  ${chartable?(positives.length?`<dl class="bci-staff-legend" aria-label="${net?'Profitable projects':'Breakdown by project'}">${legendRows(positives,true)}</dl>`:
   `<p>${net?'No positive project profit to chart.':'No positive amounts to chart.'}</p>`):'<p>Not enough verified information to chart a total.</p>'}
  ${loss.length?`<p class="bci-profit-loss-note">Project losses reduce the total but are not pie slices.</p>
   <dl class="bci-staff-legend" aria-label="Project losses">${legendRows(loss,false)}</dl>`:''}
 </section>`;
}
function bonusPanel(view,cash){
 const {bonus,estimate}=view;
 const share=Number.isFinite(bonus?.profitShareBps)?bonus.profitShareBps/100:null;
 const gross=bonus?.status==='available'&&Number.isSafeInteger(bonus.projectedCents)?bonus.projectedCents:null;
 const net=gross===null?null:Number((BigInt(gross)*70n+50n)/100n);
 const milestone=gross===null?null:Math.max(25000,Math.ceil(gross/25000)*25000);
 const partial=estimate?.partial?'Partial estimate':estimate?.straightTimeOnly?'Straight-time estimate':'';
 return `<section class="bci-profit-bonus" aria-labelledby="bonusHeading">
  <div class="bci-profit-bonus-copy">
   <p>${cash?'Invoiced work · payroll paid':'Live estimate · year to date'}</p>
   <h3 id="bonusHeading">Estimated bonus so far</h3>
   <strong>${contributionCurrency(gross)}</strong>
   ${gross===null?'<p>See the ? guide for what’s missing.</p>':
     `<p><strong>~${contributionCurrency(net)} estimated take-home</strong> · 30% planning assumption</p>`}
   ${partial?`<small class="bci-profit-status">${partial}</small>`:''}
  </div>
  <div class="bci-bonus-progress">
   ${milestone===null?'':`<label for="bonusMilestone">Progress to ${contributionCurrency(milestone)} gross</label>
    <progress id="bonusMilestone" max="${milestone}" value="${gross}"></progress>`}
   <p><strong>Profit share:</strong> ${percent(share)} · <strong>Target payout:</strong> ${esc(dateLabel(bonus?.payoutDate))}</p>
  </div></section>`;
}
const issueLabels={'invalid-hours':'Unusable logged hours, date, or duplicate entry','missing-wage':'No usable hourly rate','invalid-revenue':'Unusable customer labor amount or duplicate entry','cost-overflow':'Employment cost is outside the supported range','revenue-overflow':'Labor revenue is outside the supported range'};
const typeLabels={labor:'Customer or shop labor',travel:'Travel',shop:'Shop',pto:'PTO',sick:'Sick',holiday:'Holiday'};
function helpPanel(view,cash){
 const {estimate,coverage}=view;
 return `<dialog class="bci-contribution-help" aria-labelledby="contributionHelpTitle">
  <div class="bci-contribution-head"><h3 id="contributionHelpTitle">How Technician Contribution works</h3>
   <form method="dialog"><button type="submit" class="secondary" autofocus>Close</button></form></div>
  <p><strong>Accrual:</strong> Logged time counts right away. Review, submission, invoicing and payroll payment aren’t required. Edits can change the estimate.</p>
  <p><strong>Cash:</strong> Invoiced work counts after its locked payroll is marked paid. Customer payment is not required. Paid nonbillable payroll time contributes cost, not revenue.</p>
  <p><strong>Labor revenue:</strong> Customer work hours × recorded labor charge. Materials and travel don’t earn labor revenue.</p>
  <p><strong>Employment cost:</strong> Wages × 1.25, including payable travel, internal work and paid leave. Accrual uses the rate effective on the work date, or an available profile hourly rate when no older rate is on file.</p>
  <p><strong>Labor profit after tax reserve:</strong> BCI sets aside an estimated 30% of positive labor profit after employment cost. Your profit-share percentage applies to the positive amount remaining.</p>
  <p><strong>Estimated take-home:</strong> For example, $1,000 gross is roughly $700 using the separate 30% employee-tax assumption. Actual withholding and final tax can differ. This is not a payroll calculation or a payment promise. Meter milestones are display guides, not payout goals.</p>
  <h4>${cash?'Cash coverage':'Accrual coverage'}</h4>
  <p>${Number(coverage?.includedOrders)||0} work orders included · ${Number(coverage?.excludedOrders)||0} work orders with revenue that couldn’t be used.</p>
  ${coverage?.scopeIncomplete?'<p>Some work is outside this profile’s view. A full profit or bonus is unavailable.</p>':''}
  ${estimate?`<p>${Number(estimate.loggedHours||0).toLocaleString(undefined,{maximumFractionDigits:2})} logged payroll hours.
   ${estimate.fallbackRows?Number(estimate.fallbackRows)+' entries use a fallback hourly rate. ':''}
   ${estimate.straightTimeOnly?'A workweek is not set. This estimate excludes overtime premiums.':''}</p>
   ${estimate.partial?'<p>Some data is missing or unusable. The profit and bonus estimates do not treat labor without a usable wage as free.</p>':''}
   ${estimate.issueCount?`<p>${Number(estimate.issueCount)} checks need attention (dates and categories only):</p><ul>
    ${(estimate.issues||[]).map(issue=>`<li>${esc(issue.date||'Date unavailable')} · ${esc(typeLabels[issue.type]||'Time')} · ${esc(issueLabels[issue.reason]||'Needs review')}</li>`).join('')}</ul>
    ${estimate.issueCount>(estimate.issues||[]).length?'<p>Showing the first 50 checks.</p>':''}`:''}`:''}
 </dialog>`;
}
export function contributionPanel(data, projects=[], mode='accrual'){
 if(!data)return '';
 const cash=mode==='cash'&&!!data.cash;
 const view=cash?data.cash:data;
 const {status,totalAttributedCents,totalEmploymentCostCents,totalAfterTaxProfitCents,coverage}=view;
 const names=new Map(projects.map(row=>[row.id,row.name]));
 const amounts=Array.isArray(view.projects)?view.projects:[];
 const metric=field=>amounts.map((row,i)=>({
  name:row.name||row.projectName||names.get(row.projectId)||'Project',
  cents:row[field],color:palette[i%palette.length]
 }));
 return `<section class="panel" aria-labelledby="contributionHeading">
  <div class="bci-contribution-head"><h2 id="contributionHeading">Technician contribution</h2>
  <button type="button" class="secondary bci-contribution-help-button" data-staff-action="contribution-help" aria-label="How technician contribution works" aria-haspopup="dialog">?</button></div>
  ${data.cash?`<div class="bci-contribution-modes" role="group" aria-label="Technician contribution basis">
    <button type="button" class="secondary" data-staff-action="contribution-mode" data-staff-id="accrual" aria-pressed="${!cash}">Accrual · logged work</button>
    <button type="button" class="secondary" data-staff-action="contribution-mode" data-staff-id="cash" aria-pressed="${cash}">Cash · invoiced and payroll paid</button>
  </div>`:''}
  ${cash&&status==='available'&&!coverage?.includedOrders?'<p>No invoiced work with confirmed paid payroll yet.</p>':''}
  ${bonusPanel(view,cash)}
  <div class="bci-profit-grid">
   ${pie('Labor revenue','Qualifying hours at the recorded customer labor rate.',totalAttributedCents,metric('attributedCents'))}
   ${pie('Employment cost','Payroll wages plus 25%.',totalEmploymentCostCents,metric('employmentCostCents'))}
   ${pie('Labor profit after tax reserve','After BCI’s estimated reserve.',totalAfterTaxProfitCents,metric('afterTaxProfitCents'),true)}
  </div>
  ${helpPanel(view,cash)}
 </section>`;
}
