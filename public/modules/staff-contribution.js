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
  ${loss.length?`<p class="bci-profit-loss-note">Project losses are included in the net total, but cannot appear as pie slices.</p>
   <dl class="bci-staff-legend" aria-label="Project losses">${legendRows(loss,false)}</dl>`:''}
 </section>`;
}
function bonusPanel(bonus, year){
 const share=Number.isFinite(bonus?.profitShareBps)?bonus.profitShareBps/100:null, available=bonus?.status==='available'&&Number.isFinite(bonus?.projectedCents);
 let reason='';
 if(!available)reason=share===null?'The projection is not available yet.':'The projection needs complete work-order labor and matching wage history.';
 return `<section class="bci-profit-bonus" aria-labelledby="bonusHeading">
  <div class="bci-profit-bonus-copy">
   <p>Private estimate</p><h3 id="bonusHeading">${esc(bonus?.year??year??'')} estimated year-end bonus</h3>
   <strong>${contributionCurrency(available?bonus.projectedCents:null)}</strong>
   ${reason?`<p>${reason}</p>`:''}
  </div>
  <div><p><strong>Target date:</strong> ${esc(dateLabel(bonus?.payoutDate))}</p>
   <p><strong>Profit share:</strong> ${percent(share)}</p>
   ${share!==null?`<meter class="bci-profit-meter" min="0" max="100" value="${share}" aria-label="Share of positive annual labor profit">${percent(share)}</meter>`:''}
   <p>The estimate applies the shown share to positive annual labor profit. It updates with qualifying work-order entries and effective wages, before an invoice is sent or paid. It does not create or schedule a payroll payment.</p>
  </div></section>`;
}
export function contributionPanel(data, projects=[]){
 if(!data)return '';
 const {status,totalAttributedCents,totalEmploymentCostCents,totalNetProfitCents,coverage,bonus}=data;
 const year=data.year??bonus?.year;
 const names=new Map(projects.map(row=>[row.id,row.name]));
 const amounts=Array.isArray(data.projects)?data.projects:[];
 const metric=field=>amounts.map((row,i)=>({
  name:row.name||row.projectName||names.get(row.projectId)||'Project',
  cents:row[field],color:palette[i%palette.length]
 }));
 return `<section class="panel" aria-labelledby="contributionHeading">
  <h2 id="contributionHeading">Technician contribution</h2>
  <p>${year?esc(year)+' year to date. ':''}Only your logged customer work at the recorded labor rate counts. Parts, travel, vacation and other paid time off are excluded. Labor profit is labor revenue minus your loaded employment cost. It is not total company profit.</p>
  ${status==='partial'?'<p><strong>Partial revenue:</strong> Some qualifying work could not be verified or included.</p>':''}
  ${status==='unavailable'?'<p>No qualifying work-order contribution is available yet.</p>':''}
  <div class="bci-profit-grid">
   ${pie('Estimated labor revenue','Your logged customer work at the recorded labor rate.',totalAttributedCents,metric('attributedCents'))}
   ${pie('Employment cost','Effective hourly wage × qualifying work hours × 1.25.',totalEmploymentCostCents,metric('employmentCostCents'))}
   ${pie('Labor profit','Estimated labor revenue less loaded employment cost.',totalNetProfitCents,metric('netProfitCents'),true)}
  </div>
  ${coverage?`<p>${Number(coverage.includedOrders)||0} work orders included · ${Number(coverage.excludedOrders)||0} excluded${coverage.missingWageOrders? ` · ${Number(coverage.missingWageOrders)||0} included orders missing wage coverage`:''}</p>`:''}
  ${bonusPanel(bonus,year)}
 </section>`;
}
