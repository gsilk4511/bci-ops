const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountPattern=/^[a-f0-9]{32}$/i;
const groupPattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function createAccessSync(env,request=fetch){
  const token=env.CF_ACCESS_SYNC_TOKEN?.trim();
  const account=env.CF_ACCESS_ACCOUNT_ID?.trim();
  const group=env.CF_ACCESS_GROUP_ID?.trim();
  const enabled=Boolean(token&&accountPattern.test(account||'')&&groupPattern.test(group||''));
  let status={enabled,state:enabled?'pending':'disabled'};
  const url=enabled?`https://api.cloudflare.com/client/v4/accounts/${account}/access/groups/${group}`:'';
  async function call(method,body){
    const response=await request(url,{
      method,redirect:'error',signal:AbortSignal.timeout(5000),
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const result=await response.json();
    if(!response.ok||result.success!==true)throw Error('Cloudflare rejected the group request (HTTP '+response.status+').');
    return result.result;
  }
  return {
    status:()=>status,
    async sync(users){
      if(!enabled)return status;
      status={enabled,state:'syncing'};
      try{
        const emails=[...new Set(users.filter(u=>u.active!==false).map(u=>u.email.trim().toLowerCase()).filter(e=>emailPattern.test(e)))].sort();
        const current=await call('GET');
        if(current?.id!==group||typeof current.name!=='string'||!Array.isArray(current.include)||
          current.include.some(rule=>!rule||Object.keys(rule).length!==1||typeof rule.email?.email!=='string')){
          status={enabled,state:'failed',message:'Use a dedicated Access group with email-only Include rules.'};return status;
        }
        const existing=current.include.map(rule=>rule.email.email.toLowerCase()).sort();
        if(JSON.stringify(existing)!==JSON.stringify(emails)){
          await call('PUT',{name:current.name,include:emails.map(email=>({email:{email}})),
            require:current.require||[],exclude:current.exclude||[]});
        }
        status={enabled,state:'synced',count:emails.length,at:new Date().toISOString()};
      }catch{
        status={enabled,state:'failed',message:'Cloudflare sync failed. Check the token, account ID, group ID, and group rules, then retry.'};
      }
      return status;
    }
  };
}
