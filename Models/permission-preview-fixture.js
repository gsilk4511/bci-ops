import {previewEmail} from '../UserSecurity/permission-preview.js';
import {seed} from './lib.js';

export function permissionPreviewFixture(role,profile){
 const s=seed();s.meta.permissionPreview=true; const sample=s.workorders[0];
 const owner={createdBy:previewEmail,assignedTo:[previewEmail]};
 const day=new Date().toISOString().slice(0,10);
 const customer=s.customers[0],project=s.projects[0];
 Object.assign(customer,owner,{id:'preview-customer',name:'Test Client (fictional)'});
 Object.assign(project,owner,{id:'preview-project',customerId:customer.id,number:'26-001',name:'Test Network Build'});
 Object.assign(sample,owner,{id:'preview-approval',projectId:project.id});
 const sampleEntry={id:'preview-entry',type:'labor',catalogId:'cat_3',name:'Cable technician labor',unit:'hr',
  quantity:2,rate:95,cost:34,tech:'Preview Technician',employeeEmail:previewEmail,createdBy:previewEmail,date:day,description:'Installed sample data cables.'};
 const open={...structuredClone(sample),id:'preview-work',title:'Test work order',status:'released',approvedAt:day+'T12:00:00Z',
  approval:{signedBy:'Test Client',at:day+'T12:00:00Z'},entries:[sampleEntry]};
 const closed={...structuredClone(open),id:'preview-review',title:'Test work submitted',status:'ready-for-review'};
 closed.closeout={at:day+'T13:00:00Z',originalEntries:closed.entries,originalApproval:closed.approval,originalChanges:[]};
 const billed={...structuredClone(closed),id:'preview-billed',title:'Test billed work',status:'invoiced'};
 billed.closeout.reviewedAt=day+'T14:00:00Z';
 billed.invoice={id:'preview-invoice',number:'PREVIEW-100',createdBy:previewEmail,assignedTo:[previewEmail],status:'invoiced',amountPaid:0};
 const restricted={...structuredClone(open),id:'preview-other-work',title:'Other technician’s work',createdBy:'other-preview@example.invalid',assignedTo:['other-preview@example.invalid']};
 s.workorders.push(open,closed,billed,restricted);
 s.inventory.forEach(row=>Object.assign(row,owner));
 s.permissionProfiles=profile?[profile]:[];
 s.users=[{email:previewEmail,name:'Permission Test User',role,profileId:profile?.id},
  {email:'other-preview@example.invalid',name:'Other Test Technician',role:'tech'}];
 s.events=[];
 return s;
}
