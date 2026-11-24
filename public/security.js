import {showAppSignIn} from './signin.js';
import {agentApiPage,wireAgentApi} from './modules/agent-api.js';
const $=id=>document.getElementById(id);
const endpoint='/api/security/session';
function setFeedback(message){$('feedback').textContent=message;}
async function request(path,body){
 const response=await fetch(path,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Request failed');
 return result;
}
async function refresh(){
 const state=await request(endpoint);
 if(state.appLogin){
  $('setup').hidden=true;$('signin').hidden=true;$('admin').hidden=true;$('agent').hidden=true;
  $('continue').hidden=!(state.allowed&&state.rolloutReady);
  showAppSignIn($('app-signin'),state,{request,refresh,setFeedback,agentApiPage,wireAgentApi});
  return;
 }
 $('setup').hidden=state.enrolled;
 $('signin').hidden=!state.enrolled;
 $('continue').hidden=!state.allowed;
 $('logout').hidden=!state.verified;
 $('replace-recovery').hidden=!state.recent;
 $('admin').hidden=!state.admin||(!state.recent&&state.enrolled);
 $('agent').hidden=!(state.agent&&state.recent);
 if(!$('agent').hidden&&!$('agent').firstChild){
  $('agent').innerHTML=agentApiPage();
  wireAgentApi($('agent'));
 }
}
function run(operation,handler){
 const form=$(operation);
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const fields=Object.fromEntries(new FormData(form));
  const button=form.querySelector('button');
  button.disabled=true;
  try{setFeedback('');await handler(fields);form.reset();}catch(error){setFeedback(error.message);}
  finally{button.disabled=false;}
 });
}
function displayCodes(codes){
 $('codes').querySelector('ul').replaceChildren(...codes.map(code=>{const li=document.createElement('li');li.textContent=code;return li;}));
 $('codes').hidden=false;
}
run('replace-recovery',async()=>{
 if(!window.confirm('Invalidate every existing recovery code?'))return;
 const result=await request(endpoint,{operation:'replace-recovery'});
 displayCodes(result.codes);await refresh();
});
run('begin',async fields=>{
 $('qr').removeAttribute('src');$('scan').hidden=true;
 const result=await request(endpoint,{operation:'begin',...fields});
 $('qr').src=result.qr;$('scan').hidden=false;
});
run('confirm',async fields=>{
 const result=await request(endpoint,{operation:'confirm',...fields});
 $('qr').removeAttribute('src');$('scan').hidden=true;
 displayCodes(result.codes);await refresh();
});
for(const operation of ['verify','recovery'])run(operation,async fields=>{
 await request(endpoint,{operation,...fields});
 await refresh();setFeedback(operation==='recovery'?'Recovery code accepted and consumed.':'Authenticator verified.');
});
run('invite',async fields=>{
 $('invitation').querySelector('input').value='';$('invitation').hidden=true;
 const result=await request('/api/security/invite',fields);
 $('invitation').querySelector('input').value=result.invitation;$('invitation').hidden=false;
});
$('hideCodes').onclick=()=>{$('codes').querySelector('ul').replaceChildren();$('codes').hidden=true;};
$('logout').onclick=async()=>{
 try{await request(endpoint,{operation:'logout'});location.assign('/security');}catch(error){setFeedback(error.message);}
};
refresh().catch(error=>setFeedback(error.message));
