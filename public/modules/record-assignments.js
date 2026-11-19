import {data,esc,me,modal,projectLabel,send} from '../app.js';
const label=(x,area)=>area==='projects'?projectLabel(x):[x.number,x.name||x.title||x.business||x.location||x.customer].filter(Boolean).join(' · ')||x.id;
function chooseRecords(){
 const collections={
  customers:data.customers,projects:data.projects,workorders:data.workorders,tickets:data.ticketOverview?.tickets,
  estimates:data.estimates,invoices:data.projectInvoices,inventory:data.inventory
 };
 const users=(data.users||[]).filter(u=>u.active!==false).map(u=>u.email).sort();
 const areas=Object.entries(collections).filter(([,rows])=>rows?.length);
 if(!areas.length||!users.length)return modal('Record assignments','<p>Add an active team member and at least one record before managing assignments.</p>',()=>{});
 modal('Record assignments',
  '<label class="field">Area<select name="area" id="assignmentArea">'+areas.map(([k])=>`<option value="${esc(k)}">${esc(k)}</option>`).join('')+'</select></label>'+
  '<label class="field">Record<select name="id" id="assignmentRecord"></select></label><fieldset id="assignmentMembers" class="permission-group"><legend>Assigned users</legend></fieldset>',
  values=>send('record.assign',{area:values.area,id:values.id,assignees:new FormData(document.getElementById('actionForm')).getAll('assignee')}),
  '<p>Scope “Assigned” uses these explicit row assignments. If a profile also limits a parent record, assign the necessary project or client as well. Saving replaces the assignments on the selected record.</p>');
 const area=document.getElementById('assignmentArea'),record=document.getElementById('assignmentRecord'),members=document.getElementById('assignmentMembers');
 const roster=()=>{
  const saved=collections[area.value].find(r=>r.id===record.value)?.assignedTo||[];
  members.innerHTML='<legend>Assigned users</legend>'+users.map(email=>`<label><input type="checkbox" name="assignee" value="${esc(email)}" ${saved.includes(email)?'checked':''}> ${esc(email)}</label>`).join('');
 };
 const change=()=>{record.innerHTML=collections[area.value].map(row=>`<option value="${esc(row.id)}">${esc(label(row,area.value))}</option>`).join('');roster();};
 area.addEventListener('change',change);record.addEventListener('change',roster);change();
}
document.addEventListener('click',e=>{if(e.target.closest('[data-record-assignments]')&&me?.role==='admin')chooseRecords();});
export const assignmentLink=()=>me?.role==='admin'?'<button class="secondary" data-record-assignments>Assign records to staff</button>':'';
