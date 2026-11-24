export function agentApiPage(){
  return `<section class="panel" data-agent-api><h1>Agent API</h1>
  <p>This staging endpoint only checks the connection. A credential cannot read your business records or do work in the app. Creating a credential does not connect your Dot.</p>
  <p><code>GET /api/agent/v1/status</code> · <code>status:read</code></p>
  <form data-agent-create><label>Credential name<input name="name" maxlength="80" required autocomplete="off"></label>
  <label>Expires in days<input name="days" type="number" value="14" min="1" max="90" step="1" required></label>
  <button type="submit" class="primary">Create credential</button></form>
  <p data-agent-feedback role="status" aria-live="polite"></p>
  <section data-agent-token-panel hidden><p>Copy this token now into your approved secure credential store. It will not be shown again. Do not send it in chat or email.</p>
  <label>New credential<input data-agent-token readonly autocomplete="off" spellcheck="false"></label>
  <button type="button" class="secondary" data-agent-hide>Hide token</button></section>
  <h2>Credentials</h2><ul data-agent-list></ul></section>`;
}

export function wireAgentApi(container){
  const root=container?.matches?.('[data-agent-api]')?container:container?.querySelector?.('[data-agent-api]');
  if(!root||root.dataset.wired)return;
  root.dataset.wired='1';
  const form=root.querySelector('[data-agent-create]');
  const feedback=root.querySelector('[data-agent-feedback]');
  const token=root.querySelector('[data-agent-token]');
  const tokenPanel=root.querySelector('[data-agent-token-panel]');
  const list=root.querySelector('[data-agent-list]');
  const api='/api/security/agent-credentials';
  let busy=false;
  async function request(data){
    const response=await fetch(api,data?{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(data)}:
      {credentials:'same-origin',cache:'no-store'});
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Sign in again to manage credentials.');
    const body=await response.json();
    if(!response.ok)throw Error(body.error||'Agent API request failed.');
    return body;
  }
  function hide(){
    token.value='';
    tokenPanel.hidden=true;
  }
  root.querySelector('[data-agent-hide]').onclick=hide;
  function render({credentials}){
    list.replaceChildren();
    for(const entry of credentials||[]){
      const row=document.createElement('li');
      const revoked=entry.revokedAt!=null;
      const expired=entry.expiresAt<=Date.now();
      row.textContent=entry.name+' · '+entry.scope+' · '+(revoked?'Revoked':expired?'Expired':'Expires '+new Date(entry.expiresAt).toLocaleString())+' ';
      if(!revoked&&!expired){
        const button=document.createElement('button');
        button.type='button';button.className='secondary';
        button.textContent='Revoke';
        button.setAttribute('aria-label','Revoke '+entry.name);
        button.onclick=()=>mutate({operation:'revoke',id:entry.id});
        row.append(button);
      }
      list.append(row);
    }
    if(!list.children.length){
      const row=document.createElement('li');row.textContent='No credentials';list.append(row);
    }
  }
  async function mutate(data){
    if(busy)return;
    busy=true;
    try{
      if(data.operation==='issue')hide();
      const result=await request(data);
      if(data.operation==='issue'){
        token.value=result.token;
        tokenPanel.hidden=false;
        form.reset();
      } else if(token.value.startsWith('bci1_'+data.id+'.'))hide();
      feedback.textContent=data.operation==='issue'?'Credential created.':'Credential revoked.';
      try{render(await request());}catch{feedback.textContent+=' Refresh this page to see the current credentials.';}
    }catch(error){feedback.textContent=error.message;}
    finally{busy=false;}
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const values=new FormData(form);
    mutate({operation:'issue',name:values.get('name'),days:Number(values.get('days'))});
  });
  request().then(render).catch(error=>{feedback.textContent=error.message;});
}
