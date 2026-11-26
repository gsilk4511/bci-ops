import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seed,applyAction} from '../Models/lib.js';
import {roleFor} from '../Models/auth.js';
import {accountOffboarded,accountRevision,clearBrowserSession,restoreAccountAccess,revokeAccount} from '../UserSecurity/lifecycle.js';
import {securityView,identityId,performEnrollment,inviteAccount} from '../UserSecurity/enrollment.js';
import {appAuthView,performAppSignIn} from '../UserSecurity/signin.js';
import {issueSecurityToken,mfaSessionCookie} from '../UserSecurity/mfa.js';

const email='retired-team@example.invalid';
const admin={email:'admin-team@example.invalid',role:'admin'};
const security={mode:'optional',key:randomBytes(32),owners:[]};
const user={email,sub:'signed-user-reference',issuer:'https://synthetic.cloudflareaccess.com'};
const id=identityId(user);
const other={...user,email:'other-member@example.invalid'};
const otherId=identityId(other);
const signIn={mode:'required',pilots:new Set(),emailEnabled:false};
const token=purpose=>issueSecurityToken(purpose,security.key);
const remove=(state,actor=admin,data={email,confirmation:email})=>applyAction(state,'users.remove',data,actor);

test('remove deletes Team record and live preferences without rewriting work or payroll',()=>{
 const s=seed();
 s.users=[admin,{email,role:'office',active:false}];
 s.notificationUsers=[{email,devices:[{}]},{email:admin.email}];
 s.dashboardLayouts=[{email,cards:['other']},{email:admin.email,cards:['own']}];
 s.staffProfiles=[{email,name:'Existing name'}];
 s.payrollRuns=[{entries:[{employeeEmail:email}]}];
 s.workorders[0].entries=[{type:'labor',employeeEmail:email,description:'Historical work'}];
 const history=structuredClone([s.staffProfiles,s.payrollRuns,s.workorders]);
 assert.throws(()=>remove(s,{email:'other@example.invalid',role:'office'}),/Admin access/);
 assert.throws(()=>remove(s,admin,{email,confirmation:'typo'}),/exact Team email/);
 assert.throws(()=>remove(s,admin,{email:admin.email,confirmation:admin.email}),/own account/);
 s.activeClocks=[{email}];
 assert.throws(()=>remove(s),/running clock/);
 s.activeClocks=[];
 assert.deepEqual(remove(s),{id:email,email,removed:true});
 assert.equal(roleFor(s,{email}),null);
 assert.deepEqual(s.users,[admin]);
 assert.deepEqual([s.staffProfiles,s.payrollRuns,s.workorders],history);
 assert.deepEqual(s.notificationUsers,[{email:admin.email}]);
 assert.deepEqual(s.dashboardLayouts,[{email:admin.email,cards:['own']}]);
 assert.throws(()=>remove(s),/missing/);
});

test('clearing this browser session leaves other browser and user sessions alone',()=>{
 const now=Date.now(),session=token('session'),peer=token('session'),secondDevice=token('session'),step=token('pass-step');
 const s={sessions:{[session.digest]:{id,expires:now+5000},[secondDevice.digest]:{id,expires:now+5000},
  [peer.digest]:{id:otherId,expires:now+5000}},passSteps:{[step.digest]:{id,expires:now+5000}}};
 assert.match(clearBrowserSession(s,security,id,mfaSessionCookie(session.token,10)),/Max-Age=0/);
 assert.equal(s.sessions[session.digest],undefined);
 assert.ok(s.sessions[peer.digest]);
 assert.ok(s.sessions[secondDevice.digest]);
 clearBrowserSession(s,security,id,mfaSessionCookie(step.token,10));
 assert.equal(s.passSteps[step.digest],undefined);
 clearBrowserSession(s,security,id,mfaSessionCookie(peer.token,10));
 assert.ok(s.sessions[peer.digest]);
});

test('offboarding revokes previous methods and starts any intentional reauthorization fresh',async()=>{
 const now=Date.now(),session=token('session'),peer=token('session'),stale=token('pass-step');
 const old={id,email,enabled:true,password:'credential-hash',secret:'encrypted-totp',recovery:['hashed-code']};
 const s={accounts:{[id]:old,[otherId]:{id:otherId,email:other.email,enabled:true}},
  sessions:{[session.digest]:{id,appPassword:true,expires:now+5000},[peer.digest]:{id:otherId,expires:now+5000}},
  invites:{dummy:{email}},reset:{[email]:true},passSteps:{[stale.digest]:{id,expires:now+5000}}};
 assert.equal(appAuthView(s,security,signIn,user,mfaSessionCookie(session.token,10),false,now).allowed,true);
 revokeAccount(s,email);
 assert.equal(accountOffboarded(s,email),true);
 assert.equal(accountRevision(s,email),1);
 assert.equal(s.accounts[id],undefined);
 assert.equal(s.invites.dummy,undefined);
 assert.equal(s.reset[email],undefined);
 assert.ok(s.accounts[otherId]&&s.sessions[peer.digest]);
 assert.equal(securityView(s,security,user,'',now).allowed,false);
 assert.throws(()=>inviteAccount(s,security,admin,email,now),/removed/);
 assert.match((await performEnrollment(s,security,user,{operation:'begin'},'',now)).error,/removed/);

 restoreAccountAccess(s,email);
 assert.equal(accountOffboarded(s,email),false);
 assert.equal(accountRevision(s,email),1);
 const legacyUnbound=token('pass-step');
 s.passSteps[legacyUnbound.digest]={id,expires:now+5000}; // A pre-upgrade password step with no email.
 assert.equal(appAuthView(s,security,signIn,user,mfaSessionCookie(legacyUnbound.token,10),false,now).passwordStep,false);
 assert.equal(appAuthView(s,security,signIn,user,mfaSessionCookie(session.token,10),false,now).allowed,false);
 const store={transact:work=>work(s)};
 const fresh=await performAppSignIn(store,security,signIn,user,{operation:'password',password:'fresh synthetic passphrase'},'',false,now);
 assert.ok(fresh.cookie);
 assert.equal(appAuthView(s,security,signIn,user,fresh.cookie,false,now).passwordStep,true);
});
