import {randomUUID} from 'node:crypto';
const key=value=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
function field(value,required=false){
  if(value==null&&!required)return '';
  if(typeof value!=='string'||value.length>3000||(required&&!value.trim()))throw Error('Invalid import text field');
  return value.trim();
}
export function importCustomers(state,file){
  if(file?.format!=='bci-operations-import-v1'||!Array.isArray(file.clients)||!Array.isArray(file.projects)||!Array.isArray(file.references))throw Error('Choose a BCI Operations import JSON file');
  if(file.clients.length>1000||file.projects.length>2000||file.references.length>2000)throw Error('Import exceeds row limit');
  const report={clientsAdded:0,clientsMatched:0,projectsAdded:0,projectsMatched:0,held:[],conflicts:[],referencesAdded:0,incompleteClients:[],newClients:[],newProjects:[]};
  const createdAt=new Date().toISOString(), clients=new Map(), numbers=new Set();
  for(const input of file.clients){
    const name=field(input.name,true), nameKey=key(name);
    if(clients.has(nameKey))throw Error('Duplicate billing client in file: '+name);
    const email=field(input.email), address=field(input.address), phone=field(input.phone);
    const source=field(input.source,true);
    const matches=state.customers.filter(c=>c.importSource===source||[c.name,c.business].some(n=>n&&key(n)===nameKey));
    const existing=matches[0];
    const mismatch=existing&&!existing.importSource&&((existing.email&&email&&key(existing.email)!==key(email))||(existing.address&&address&&key(existing.address)!==key(address)));
    if(matches.length>1||mismatch){
      clients.set(nameKey,null);report.conflicts.push('Billing client needs a match review: '+name);continue;
    }
    if(existing){clients.set(nameKey,existing);report.clientsMatched++;continue;}
    const client={id:randomUUID(),name,email,address,phone,contact:field(input.contact),shippingAddress:field(input.shippingAddress),contacts:[],createdAt,importSource:source};
    state.customers.push(client);clients.set(nameKey,client);report.clientsAdded++;report.newClients.push(name);
    if(!email||!address||!phone)report.incompleteClients.push(name);
  }
  for(const input of file.projects){
    const number=field(input.number,true),name=field(input.name,true),clientName=field(input.client);
    if(!/^\d{2}-\d{3,}$/.test(number)||numbers.has(number))throw Error('Invalid or repeated project number: '+number);
    numbers.add(number);
    const source=field(input.source,true);
    state.meta??={};
    const holds=state.meta.importHolds??=[];
    if(input.hold!==false){
      report.held.push(number+' '+name+' · '+(field(input.notes)||'Review before import'));
      if(source!=='Project register only'&&!holds.some(path=>key(path)===key(source)))holds.push(source);
      continue;
    }
    state.meta.importHolds=holds.filter(path=>key(path)!==key(source));
    const customer=clients.get(key(clientName));
    if(!customer){report.conflicts.push(number+' '+name+' · billing client unavailable');continue;}
    const numbered=state.projects.filter(p=>p.number===number);
    const named=state.projects.filter(p=>p.customerId===customer.id&&key(p.name)===key(name));
    const matches=[...new Set([...numbered,...named])];
    if(matches.length===1&&matches[0].number===number&&matches[0].customerId===customer.id&&key(matches[0].name)===key(name)){
      report.projectsMatched++;continue;
    }
    if(matches.length){report.conflicts.push(number+' '+name+' · existing number or name needs review');continue;}
    state.projects.push({id:randomUUID(),customerId:customer.id,contactId:null,number,name,
      site:field(input.site),description:field(input.description),legacyStatus:field(input.status),po:'',
      createdAt,importSource:field(input.source,true)});
    report.projectsAdded++;report.newProjects.push(number+' '+name);
  }
  for(const input of file.references){
    const number=field(input.number,true), source=field(input.source,true);
    const incoming=file.projects.find(p=>p.number===number&&p.hold===false);
    const project=incoming&&state.projects.find(p=>p.number===number&&p.customerId===clients.get(key(field(incoming.client)))?.id&&key(p.name)===key(incoming.name));
    if(!project)continue;
    const references=project.importReferences??=[];
    if(!references.some(r=>r.source===source)){
      references.push({source,label:field(input.label,true),kind:field(input.kind,true)});
      report.referencesAdded++;
    }
  }
  if(numbers.size){
    const max=Math.max(...[...numbers].map(n=>Number(n.split('-')[1])));
    state.meta??={};
    state.meta.projectSequence=Math.max(state.meta.projectSequence||0,max);
  }
  return report;
}

function csvRows(csv){
  if(typeof csv!=='string')throw Error('Invalid CSV file');
  const rows=[];
  let row=[], value='', quoted=false, closed=false;
  csv=csv.replace(/^\uFEFF/,'');
  for(let i=0;i<csv.length;i++){
    const ch=csv[i];
    if(quoted){
      if(ch!=='"')value+=ch;
      else if(csv[i+1]==='"'){value+='"';i++;}
      else{quoted=false;closed=true;}
    }else if(ch===','||ch==='\n'||ch==='\r'){
      row.push(value);value='';closed=false;
      if(ch!==','){rows.push(row);row=[];if(ch==='\r'&&csv[i+1]==='\n')i++;}
    }else if(ch==='"'&&!value&&!closed)quoted=true;
    else if(closed||ch==='"')throw Error('Invalid CSV quoting');
    else value+=ch;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  row.push(value);rows.push(row);
  return rows;
}

export function importQuickBooksCsv(state,csv){
  const rows=csvRows(csv);
  const headerIndex=rows.findIndex(r=>r.some(v=>key(v)==='customer full name'));
  if(headerIndex<0)throw Error('CSV needs the QuickBooks Customer Contact List headers');
  const headers=rows[headerIndex].map(key);
  const get=(row,name)=>row[headers.indexOf(name)]?.trim()||'';
  const prefix=/^(\d{2}-\d{3,})\s+(.+)$/;
  const clients=new Map(), projects=[], held=[], paths=new Set();
  const known=new Map();
  for(const project of state.projects){
    for(const source of [project.importSource,...(project.importReferences||[]).map(r=>r.source)]){
      if(!source||source==='Project register only')continue;
      const path=key(source);
      known.set(path,(known.get(path)||0)+1);
    }
  }
  let sourceMatches=0;
  for(const row of rows.slice(headerIndex+1)){
    const path=get(row,'customer full name');
    if(!path||/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),/i.test(path))continue;
    if(paths.has(key(path)))throw Error('Repeated QuickBooks path: '+path);
    paths.add(key(path));
    const [root,...children]=path.split(':').map(v=>v.trim());
    if(/^000\s+bci\b/i.test(root)||/^co[n]?structconnectestimates$/i.test(root.replace(/\s+/g,'')))continue;
    const exact=known.get(key(path))||0;
    if(exact>1)throw Error('QuickBooks path matches multiple saved projects: '+path);
    if(exact===1){sourceMatches++;continue;}
    if((state.meta?.importHolds||[]).some(source=>key(source)===key(path))){
      held.push(path+' · Previously held in the reviewed crosswalk');continue;
    }
    const rootNumber=root.match(prefix), name=rootNumber?.[2]||root;
    if(!children.length){
      if(clients.has(key(name)))throw Error('Repeated billing client after removing project number: '+name);
      clients.set(key(name),{name,source:root,contact:get(row,'full name'),email:get(row,'email'),
        phone:get(row,'phone numbers'),address:get(row,'bill address'),shippingAddress:get(row,'ship address')});
    }
    if(!children.length&&!rootNumber)continue;
    const leaf=(children.at(-1)||root).match(prefix);
    if(children.length>1||!leaf||/\bdeposit\b/i.test(path)){
      held.push(path+' · Confirm project number and hierarchy in the crosswalk');continue;
    }
    projects.push({number:leaf[1],name:leaf[2],client:name,source:path,hold:false});
  }
  const counts=new Map();
  for(const p of projects)counts.set(p.number,(counts.get(p.number)||0)+1);
  const accepted=projects.filter(p=>{
    if(counts.get(p.number)>1){held.push(p.source+' · Repeated project number in CSV');return false;}
    if(!clients.has(key(p.client))){held.push(p.source+' · Missing parent row in CSV');return false;}
    return true;
  });
  const report=importCustomers(state,{format:'bci-operations-import-v1',clients:[...clients.values()],projects:accepted,references:[]});
  report.projectsMatched+=sourceMatches;
  report.held.push(...held);
  // Reserve identifiers seen in the CSV, including held numbered jobs.
  const max=projects.reduce((largest,p)=>Math.max(largest,Number(p.number.split('-')[1])),0);
  state.meta??={};
  state.meta.projectSequence=Math.max(state.meta.projectSequence||0,max);
  return report;
}

export function runCustomerImport(state,data){
  return typeof data?.csv==='string'?importQuickBooksCsv(state,data.csv):importCustomers(state,data);
}
