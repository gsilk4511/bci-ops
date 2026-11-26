export function permissionPrerequisitePlan(grants, rules, {allow=()=>true}={}){
 const next=new Set(grants), added=new Set(), blocked=new Map(), reasons=new Map();
 let changed;
 do{
  changed=false;
  for(const grant of next)for(const prerequisite of rules[grant]||[]){
   const requiredBy=reasons.get(prerequisite)||new Set();
   requiredBy.add(grant);reasons.set(prerequisite,requiredBy);
   if(next.has(prerequisite))continue;
   if(!allow(prerequisite)){blocked.set(prerequisite,requiredBy);continue;}
   next.add(prerequisite);added.add(prerequisite);changed=true;
  }
 }while(changed);
 return {added,permissions:[...next],blocked,reasons};
}

export function dependentPermissionRemovals(grants, removed, rules){
 const plan=permissionPrerequisitePlan(grants,rules);
 const gone=new Set(removed);
 let changed;
 do{
  changed=false;
  for(const key of gone)for(const grant of plan.reasons.get(key)||[]){
   if(!gone.has(grant)){gone.add(grant);changed=true;}
  }
 }while(changed);
 return gone;
}
