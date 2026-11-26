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
function bonusPanel(bonus, year, cash){
 const share=Number.isFinite(bonus?.profitShareBps)?bonus.profitShareBps/100:null, available=bonus?.status==='available'&&Number.isFinite(bonus?.projectedCents);
 let reason='';
 if(!available)reason=share===null?'The projection is not available yet.':'A complete projection needs qualifying labor and matching wage history.';
 return `<section class="bci-profit-bonus" aria-labelledby="bonusHeading">
  <div class="bci-profit-bonus-copy" aria-live="polite">
   <p>${cash?'Recorded invoiced work':'Live year-to-date progress'}</p>
   <h3 id="bonusHeading">${esc(bonus?.year??year??'')} estimated year-end bonus</h3>
   <strong>${contributionCurrency(available?bonus.projectedCents:null)}</strong>
   ${reason?`<p>${reason}</p>`:''}
  </div>
  <div><p><strong>Target date:</strong> ${esc(dateLabel(bonus?.payoutDate))}</p>
   <p><strong>Profit share:</strong> ${percent(share)}</p>
   <p>${cash?'This view changes when qualifying work is recorded on an invoice, even if it has not been paid.':'Log your customer work and see it count toward your bonus without waiting for an invoice.'} Your rate applies to positive labor profit after the tax reserve. This projection does not schedule or send a payment.</p>
  </div></section>`;
}
export function contributionPanel(data, projects=[], mode='accrual'){
 if(!data)return '';
 const cash=mode==='cash'&&!!data.cash;
 const view=cash?data.cash:data;
 const {status,totalAttributedCents,totalEmploymentCostCents,totalNetProfitCents,taxReserveCents,totalAfterTaxProfitCents,coverage,bonus}=view;
 const year=view.year??bonus?.year;
 const names=new Map(projects.map(row=>[row.id,row.name]));
 const amounts=Array.isArray(view.projects)?view.projects:[];
 const metric=field=>amounts.map((row,i)=>({
  name:row.name||row.projectName||names.get(row.projectId)||'Project',
  cents:row[field],color:palette[i%palette.length]
 }));
 return `<section class="panel" aria-labelledby="contributionHeading">
  <h2 id="contributionHeading">Technician contribution</h2>
  ${data.cash?`<div class="bci-contribution-modes" role="group" aria-label="Technician contribution basis">
    <button type="button" class="secondary" data-staff-action="contribution-mode" data-staff-id="accrual" aria-pressed="${!cash}">Accrual · logged work</button>
    <button type="button" class="secondary" data-staff-action="contribution-mode" data-staff-id="cash" aria-pressed="${cash}">Cash · invoiced work</button>
  </div>`:''}
  <p>${year?esc(year)+' work dates, year to date. ':''}${cash?'Only work on recorded invoices counts here, paid or unpaid. Costs are estimated for that same invoiced work.':'Your logged customer labor counts right away, even before invoicing or payment.'} Parts, travel, internal work and time off are excluded.</p>
  ${status==='partial'?'<p><strong>Partial coverage:</strong> Some qualifying work could not be verified or included.</p>':''}
  ${status==='unavailable'?'<p>No qualifying work-order contribution is available yet.</p>':''}
  ${cash&&status==='available'&&!coverage?.includedOrders?'<p>No qualifying invoiced work yet. Switch to Accrual to see your logged work.</p>':''}
  ${bonusPanel(bonus,year,cash)}
  <div class="bci-profit-grid">
   ${pie('Labor revenue','Qualifying hours at the recorded customer labor rate.',totalAttributedCents,metric('attributedCents'))}
   ${pie('Employment cost','Same hours × wage effective on the work date × 1.25.',totalEmploymentCostCents,metric('employmentCostCents'))}
   ${pie('Labor profit after tax reserve','Labor revenue less employment cost and the tax reserve.',totalAfterTaxProfitCents,metric('afterTaxProfitCents'),true)}
  </div>
  <dl class="bci-staff-legend bci-profit-taxes" aria-label="Labor profit and tax reserve">
   <div><dt>Labor profit before tax reserve</dt><dd>${contributionCurrency(totalNetProfitCents)}</dd></div>
   <div><dt>Estimated tax reserve (30% of positive labor profit)</dt><dd>${contributionCurrency(taxReserveCents)}</dd></div>
   <div><dt>Labor profit after tax reserve</dt><dd>${contributionCurrency(totalAfterTaxProfitCents)}</dd></div>
  </dl>
  ${coverage?`<p>${Number(coverage.includedOrders)||0} work orders included · ${Number(coverage.excludedOrders)||0} invalid orders excluded${coverage.missingWageOrders? ` · ${Number(coverage.missingWageOrders)||0} included orders missing wage coverage`:''}.</p>`:''}
 </section>`;
}
