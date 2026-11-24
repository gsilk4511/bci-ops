export function showAppSignIn(root,state,controls){
 const {request,refresh,setFeedback,agentApiPage,wireAgentApi}=controls;
 root.hidden=false;
 if(state.identityChanged){root.textContent='Your Cloudflare identity changed. Contact the administrator through a trusted channel.';return;}
 if(!root.dataset.ready){
  root.dataset.ready='1';
  root.innerHTML=`<button type="button" data-login>Log in to BCI Operations</button>
  <section data-password hidden><h2>BCI Operations sign-in</h2><p data-password-intro></p>
  <form data-op="password"><label>BCI password <input name="password" type="password" required maxlength="1024"></label><button>Continue</button></form></section>
  <section data-factor hidden><h2>Verify your sign-in</h2>
  <p data-factor-intro></p>
  <div data-totp><button type="button" data-action="begin-totp">Set up an authenticator</button>
  <div data-scan hidden><p>Scan this private QR in Apple Passwords, Google Authenticator, or Bitwarden. Never share it.</p><img data-qr alt="Private setup QR" width="256" height="256"></div>
  <form data-op="totp-verify" hidden><label>Authenticator code <input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label><button>Verify authenticator</button></form></div>
  <div data-email><p>Email verification is lower assurance, and may use the same mailbox as Cloudflare. It is not available for privileged accounts.</p>
  <button type="button" data-action="email-send">Send code to my verified email</button>
  <form data-op="email-verify"><label>Email code <input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label><button>Verify email code</button></form></div>
  <form data-op="recovery" hidden><label>One-time recovery code <input name="code" type="password" autocomplete="off" required></label><button>Use recovery code</button></form>
  </section><section data-complete hidden><p>BCI sign-in verified.</p>
  <button data-action="logout" type="button">Sign out of BCI</button>
  <button data-action="replace-recovery" type="button">Replace recovery codes</button></section>
  <section data-recovery-codes hidden><h2>Save these one-time codes</h2><p>Save outside this device. They'll be shown only once.</p><ul></ul><button type="button" data-clear-codes>Clear codes from screen</button></section>
  <section data-rollout hidden><p>Waiting for protected administrator recovery drills before this staging rollout can open.</p></section>
  <div data-app-agent hidden></div>`;
  const find=x=>root.querySelector(x);
  find('[data-login]').onclick=()=>{
   find('[data-login]').hidden=true;find('[data-password]').hidden=false;find('[name=password]').focus();
  };
  const clear=()=>{find('[data-recovery-codes]').hidden=true;find('[data-recovery-codes] ul').replaceChildren();};
  find('[data-clear-codes]').onclick=clear;
  const action=async(op,fields,button)=>{
   if(button.disabled)return false;
   if(op==='replace-recovery'&&!window.confirm('Invalidate every existing recovery code?'))return false;
   try{
    button.disabled=true;setFeedback('');
    const result=await request('/api/security/session',{operation:op,...fields});
    if(result.qr){
     find('[data-qr]').src=result.qr;find('[data-scan]').hidden=false;find('[data-op="totp-verify"]').hidden=false;
    }
    if(result.codes){
     find('[data-recovery-codes] ul').replaceChildren(...result.codes.map(code=>{const li=document.createElement('li');li.textContent=code;return li;}));
     find('[data-recovery-codes]').hidden=false;
    }
    if(op==='email-send')setFeedback('Code sent to your verified email address.');
    else if(op!=='begin-totp'){
     find('[data-qr]').removeAttribute('src');find('[data-scan]').hidden=true;
     if(op==='logout')clear();
     await refresh();
    }
    return true;
   }catch(error){setFeedback(error.message);return false;}
   finally{button.disabled=false;}
  };
  for(const form of root.querySelectorAll('[data-op]'))form.onsubmit=async event=>{
   event.preventDefault();
   const data=Object.fromEntries(new FormData(form));form.reset();
   await action(form.dataset.op,data,form.querySelector('button'));
  };
  for(const button of root.querySelectorAll('[data-action]'))button.onclick=()=>action(button.dataset.action,{},button);
 }
 const find=x=>root.querySelector(x);
 find('[data-password-intro]').textContent=state.passwordSet?'Enter the password you set for BCI Operations.':'Create a BCI passphrase of at least 15 characters. Your current work and profile stay on the same account.';
 find('[name=password]').autocomplete=state.passwordSet?'current-password':'new-password';
 find('[data-password]').hidden=true;
 find('[data-login]').hidden=state.verified||state.passwordStep;
 find('[data-login]').textContent='Log in to BCI Operations';
 find('[data-factor]').hidden=!state.passwordStep;
 find('[data-factor-intro]').textContent=state.enrolled?'Use your already-enrolled authenticator.':'Choose an available verification method.';
 find('[data-totp]').hidden=state.method==='email';
 find('[data-action="begin-totp"]').hidden=state.enrolled;
 find('[data-op="totp-verify"]').hidden=!state.enrolled&&find('[data-scan]').hidden;
 find('[data-op="recovery"]').hidden=!state.enrolled||!state.passwordSet;
 find('[data-email]').hidden=!state.emailAllowed;
 find('[data-complete]').hidden=!state.verified;
 find('[data-action="replace-recovery"]').hidden=!state.recent;
 find('[data-rollout]').hidden=state.rolloutReady;
 const agent=find('[data-app-agent]');
 agent.hidden=!(state.agent&&state.recent&&state.rolloutReady);
 if(!agent.hidden&&!agent.firstChild){agent.innerHTML=agentApiPage();wireAgentApi(agent);}
}
