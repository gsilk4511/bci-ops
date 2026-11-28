import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpendData,profileSpendFeed} from '../Server/spend-clock.js';
import {snapshot} from '../Server/SpendClock/index.js';
import {marketFeedCard,renderMarketFeed,spendClockPage} from '../public/modules/spend-clock.js';

test('market feed uses real snapshot values and labels modeled data; stage paths stay in Admin',()=>{
 const feed=profileSpendFeed(snapshot());
 assert.equal(feed.items.length,5);
 assert.equal(feed.checked,null);
 const [lv,burlington,barre,spending,jobs]=feed.items;
 assert.equal(lv.kind,'Modeled range');
 assert.match(lv.href,/\/campaigns\?market=metro/);
 assert.match(burlington.value,/531 units/);
 assert.match(barre.value,/156 units/);
 assert.equal(spending.value,'$429M');
 assert.equal(jobs.value,'16,300 jobs');
 assert.ok(feed.items.every(item=>item.href.startsWith('/admin/spend-clock/')));
 assert.match(renderMarketFeed(feed),/Showing saved figures/);
 assert.match(marketFeedCard(),/market-feed\.xml/);
 assert.match(spendClockPage(),/<iframe src="\/admin\/spend-clock\//);
 assert.doesNotMatch(renderMarketFeed({items:[{title:'<script>x</script>',href:'javascript:alert(1)'}]}),/<script>|javascript:/);
});

test('refresh shares one upstream batch, keeps last good result, and backs off on outage',async()=>{
 let now=1000,calls=0,done;
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 const data=createSpendData({clock:()=>now, seed:()=>({baseline:true}),refresh:()=>{
  calls++;return new Promise(resolve=>{done=resolve});
 }});
 assert.equal(data().data.baseline,true);
 assert.equal(data().refreshing,true);
 await tick();assert.equal(calls,1);
 done({fetched:['BPS'],checked:'complete'});await tick();
 assert.equal(data().refreshing,false);assert.equal(data().data.checked,'complete');
 now+=3600001;assert.equal(data().refreshing,true);await tick();
 done({fetched:[],checked:'failed'});await tick();
 assert.equal(data().data.checked,'complete');assert.equal(calls,2);
 now+=299999;assert.equal(data().refreshing,false);
});
