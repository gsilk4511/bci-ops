import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('My Time shows the five-week grid and refreshes the current session without leaking practice or peer data',async()=>{
 const lookup={isConnected:true,dataset:{},innerHTML:'',replaceChildren(){this.innerHTML='';}};
 const callbacks={},timers=[];
 const summary={workweekStart:1,rows:Array.from({length:5},(_,i)=>({start:'2026-11-'+(23-i),end:'2026-11-29',current:i===0,
  worked:47,regular:40,overtime:7,pto:0,sick:0,holiday:8,openHours:55,pendingLeave:0,lockedHours:0,issues:0}))};
 const staff={profile:{email:'owner@example.test'},staffProfiles:[],projects:[],time:[],leave:[],requests:[],
  weeklyTime:summary,contribution:{bonus:{projectedCents:24000}}};
 const data={staff};
 let response={ok:true,json:async()=>({email:'other@example.test',weeklyTime:{...summary,workweekStart:2},contribution:{bonus:{projectedCents:7}}})};
 let fetchCount=0;
 const doc={hidden:false,addEventListener(type,callback){callbacks[type]=callback;},querySelector(){return lookup;}};
 const context=vm.createContext({document:doc,setInterval(handler,period){timers.push([handler,period]);},
  async fetch(endpoint,options){assert.equal(endpoint,'/api/staff-summary');assert.equal(options.cache,'no-store');fetchCount++;return response;}});
 const app={can:()=>true,data,esc:x=>String(x??''),f:()=>'',head:()=>'',modal:()=>{},practiceMode:false,render(){},send(){},table:(columns,rows)=>columns.join('|')+rows.join(''),today:()=>''};
 const exports={
  '../app.js':app,
  './staff-profile.js':{profileCard:()=>'',directoryProfile:()=>'',personalProfileFields:()=>'',personalProfilePayload:()=>'',bindProfileEditor:()=>''},
  './staff-contribution.js':{contributionPanel:d=>'bonus:'+d?.bonus?.projectedCents},
  './staff-contribution-admin.js':{contributionYear:()=>2026,openCompensationProfile:()=>'',rateLabel:()=>''},
  './business-manager.js':{businessManagerPanel:()=>''},
  './staff-workspace-theme.js':{staffWorkspaceTheme:(_style,content)=>content}
 };
 const screen=new vm.SourceTextModule(readFileSync(new URL('../public/modules/staff.js',import.meta.url),'utf8'),{context});
 await screen.link(specifier=>{
  const values=exports[specifier];
  return new vm.SyntheticModule(Object.keys(values),function(){for(const [name,value] of Object.entries(values))this.setExport(name,value);},{context});
 });
 await screen.evaluate();
 const html=screen.namespace.staffPage();
 assert.match(html,/My last five weeks/);
 assert.match(html,/Regular\|Overtime\|PTO\|Sick\|Holiday/);
 assert.match(html,/Weeks start Monday/);
 assert.match(html,/bonus:24000/);
 assert.match(html,/Set profile workweek/);
 assert.equal((html.match(/47 h/g)||[]).length,5);
 assert.equal(timers[0][1],30000);
 await timers[0][0]();
 assert.equal(fetchCount,1);
 assert.equal(lookup.innerHTML,'');
 lookup.dataset.practice='true';
 await callbacks.visibilitychange();
 assert.equal(fetchCount,1);
 lookup.dataset.practice='false';
 response={ok:true,json:async()=>({email:staff.profile.email,weeklyTime:{...summary,workweekStart:2},contribution:{bonus:{projectedCents:23400}}})};
 await timers[0][0]();
 assert.match(lookup.innerHTML,/Weeks start Tuesday/);
 assert.match(lookup.innerHTML,/bonus:23400/);
 response={status:403};
 await timers[0][0]();
 assert.equal(lookup.innerHTML,'');
});
