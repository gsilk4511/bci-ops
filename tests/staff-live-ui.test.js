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
  weeklyTime:summary,contribution:{bonus:{projectedCents:16800},cash:{bonus:{projectedCents:5000}}}};
 const data={staff};
 let response={ok:true,json:async()=>({email:'other@example.test',weeklyTime:{...summary,workweekStart:2},contribution:{bonus:{projectedCents:7}}})};
 let fetchCount=0;
 const doc={hidden:false,addEventListener(type,callback){callbacks[type]=callback;},querySelector(){return lookup;}};
 const context=vm.createContext({document:doc,setInterval(handler,period){timers.push([handler,period]);},
  async fetch(endpoint,options){assert.equal(endpoint,'/api/staff-summary');assert.equal(options.cache,'no-store');fetchCount++;return response;}});
 const app={can:()=>true,data,esc:x=>String(x??''),f:()=>'',head:()=>'',me:{email:'owner@example.test',role:'admin'},modal:()=>{},practiceMode:false,render(){},send(){},show(){},table:(columns,rows)=>columns.join('|')+rows.join(''),today:()=>''};
 const exports={
  '../app.js':app,
  './staff-profile.js':{profileCard:()=>'',directoryProfile:()=>'',personalProfileFields:()=>'',personalProfilePayload:()=>'',bindProfileEditor:()=>''},
  './staff-contribution.js':{contributionPanel:(d,_p,mode)=>'bonus:'+(mode==='cash'?d?.cash:d)?.bonus?.projectedCents},
  './staff-contribution-admin.js':{contributionYear:()=>2026,openCompensationProfile:()=>'',rateLabel:()=>''},
  './business-manager.js':{businessManagerPanel:()=>''},
  './profile-weather.js':{profileWeatherCard:()=>'<aside>Weather · Barre</aside>'},
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
 assert.match(html,/bonus:16800/);
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
 const cash={dataset:{staffAction:'contribution-mode',staffId:'cash'},closest:()=>lookup};
 callbacks.click({target:{closest:()=>cash}});
 assert.match(lookup.innerHTML,/bonus:5000/);
 response={ok:true,json:async()=>({email:staff.profile.email,weeklyTime:{...summary,workweekStart:2},contribution:{bonus:{projectedCents:16380},cash:{bonus:{projectedCents:5500}}}})};
 await timers[0][0]();
 assert.match(lookup.innerHTML,/Weeks start Tuesday/);
 assert.match(lookup.innerHTML,/bonus:5500/);
 const own=screen.namespace.staffPage();
 assert.match(own,/bonus:5500/);
 data.staff={...staff,profile:{email:'different@example.test'}};
 assert.match(screen.namespace.staffPage(),/bonus:16380/);
 response={status:403};
 await timers[0][0]();
 assert.equal(lookup.innerHTML,'');
});

test('live profile panels inherit workspace theme and contribution shows both bases and the tax reserve',async()=>{
 const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
 for(const property of ['background-color:var(--staff-workspace-surface)','border-color:var(--staff-workspace-border)','color:var(--staff-workspace-text)']){
  assert.ok(css.split('}').some(rule=>rule.includes('[id="staffLiveMetrics"]>.panel)')&&rule.includes(property)),property);
 }
 const context=vm.createContext({});
 const panel=new vm.SourceTextModule(readFileSync(new URL('../public/modules/staff-contribution.js',import.meta.url),'utf8'),{context});
 await panel.link(()=>new vm.SyntheticModule(['esc'],function(){this.setExport('esc',s=>String(s??''));},{context}));
 await panel.evaluate();
 const amounts={totalAttributedCents:140000,totalEmploymentCostCents:43750,totalNetProfitCents:96250,taxReserveCents:28875,totalAfterTaxProfitCents:67375,
  bonus:{status:'available',year:2026,projectedCents:3369,profitShareBps:500},status:'available',coverage:{includedOrders:1}};
 const data={...amounts,cash:{...amounts,totalAttributedCents:0,coverage:{includedOrders:0},bonus:{...amounts.bonus,projectedCents:0}}};
 const render=panel.namespace.contributionPanel;
 const live=render(data);
 assert.match(live,/aria-pressed="true">Accrual · logged work/);
 assert.match(live,/\$33\.69/);
 assert.match(live,/sets aside an estimated 30%/);
 assert.doesNotMatch(live,/Labor profit before tax reserve|\$288\.75/);
 assert.match(live,/Labor profit after tax reserve/);
 assert.doesNotMatch(live,/Private estimate/);
 const cash=render(data,[],'cash');
 assert.match(cash,/aria-pressed="true">Cash · invoiced and payroll paid/);
 assert.match(cash,/locked payroll is marked paid/);
 assert.match(cash,/No invoiced work with confirmed paid payroll yet/);
 assert.doesNotMatch(cash,/\$33\.69/);
});
