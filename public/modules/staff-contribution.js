import {esc} from '../app.js';

const palette=['#167773','#327bc5','#994796','#cb6324','#637a1f','#7852b6','#b33a56','#437678'];
const currency=cents=>Number.isFinite(cents)?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(cents/100):'Not available';
export function contributionPanel(data, projects){
 if(!data)return '';
 const {status,totalAttributedCents,coverage}=data, names=new Map(projects.map(row=>[row.id,row.name]));
 const amounts=(Array.isArray(data.projects)?data.projects:[]).map((row,i)=>({
  name:row.name||row.projectName||names.get(row.projectId)||'Project',
  cents:row.attributedCents, color:palette[i%palette.length]
 }));
 const positives=amounts.filter(row=>Number.isFinite(row.cents)&&row.cents>0), total=positives.reduce((sum,row)=>sum+row.cents,0);
 let angle=0;
 const arcs=positives.map(row=>{
  const start=angle, size=row.cents/total*100;angle+=size;
  return `<circle cx="50" cy="50" r="37" fill="none" stroke="${row.color}" stroke-width="16" pathLength="100" stroke-dasharray="${size} ${100-size}" stroke-dashoffset="${-start}" transform="rotate(-90 50 50)" />`;
 }).join('');
 return `<section class="panel"><h2>Technician contribution</h2>
  <p>Invoiced work attributed to you based on your share of logged labor hours. This is not profit, wages, or a bonus payout.</p>
  ${status==='partial'?'<p>Partial results: Some invoiced work could not be attributed.</p>':''}
  ${status==='unavailable'?'<p>No invoiced contribution is available yet.</p>':''}
  <div class="bci-staff-contribution">
   <div class="bci-staff-donut">
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
     <circle cx="50" cy="50" r="37" fill="none" stroke="#8b9797" stroke-width="16" opacity=".25" />${arcs}</svg>
    <div class="bci-staff-total"><strong>${currency(totalAttributedCents)}</strong><span>Attributed</span></div>
   </div>
   <dl class="bci-staff-legend" aria-label="Contribution breakdown">
    ${amounts.map(row=>`<div><dt><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="6" fill="${row.color}" /></svg>${esc(row.name)}</dt><dd>${currency(row.cents)}</dd></div>`).join('')}
    <div class="bci-staff-reserved"><dt>Profit</dt><dd>Reserved</dd></div>
    <div class="bci-staff-reserved"><dt>Employment cost</dt><dd>Reserved</dd></div>
   </dl>
  </div>
  ${coverage? `<p>${Number(coverage.includedOrders)||0} invoices included · ${Number(coverage.excludedOrders)||0} excluded</p>`:''}
 </section>`;
}
