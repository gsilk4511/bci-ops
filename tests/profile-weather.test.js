import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProfileWeather} from '../Server/profile-weather.js';
import {renderProfileWeather,profileWeatherCard} from '../public/modules/profile-weather.js';

test('profile forecast reads only the fixed NWS location, coalesces, caches and signals outage without stale alerts',async()=>{
 let now=Date.parse('2026-11-26T15:00:00Z'), fail=false, calls=[];
 const period={startTime:'2026-11-26T10:00:00-05:00',endTime:'2026-11-26T23:00:00-05:00',shortForecast:'Light snow',temperature:29,temperatureUnit:'F',probabilityOfPrecipitation:{value:60}};
 const url='https://api.weather.gov/gridpoints/BTV/125,69/forecast';
 const weather=createProfileWeather({clock:()=>now,fetcher:async(u,options)=>{
  calls.push(u);
  assert.equal(options.redirect,'error');
  assert.match(options.headers['User-Agent'],/BCI Operations/);
  if(fail)throw Error('boom');
  return {ok:true,json:async()=>u.includes('/points/')?{properties:{forecast:url,forecastHourly:url+'/hourly'}}:
   u.includes('/alerts/')?{features:[{properties:{event:'Winter hazard',headline:'<img src=x> Winter hazard'}}]}:{properties:{periods:[period]}}};
 }});
 const [first,second]=await Promise.all([weather(),weather()]);
 assert.deepEqual(first,second);
 assert.deepEqual(calls, ['https://api.weather.gov/points/44.197,-72.502', url,url+'/hourly','https://api.weather.gov/alerts/active?point=44.197,-72.502']);
 assert.equal(first.status,'ok');
 assert.match(renderProfileWeather(first),/29°F/);
 assert.match(renderProfileWeather(first),/60% precip/);
 assert.match(renderProfileWeather(first),/&lt;img src=x&gt;/);
 assert.doesNotMatch(renderProfileWeather(first),/<img/);
 await weather();assert.equal(calls.length,4);
 now+=16*60_000;fail=true;
 const stale=await weather();
 assert.equal(stale.status,'stale');
 assert.match(renderProfileWeather(stale),/Current alerts unavailable/);
 assert.doesNotMatch(renderProfileWeather(stale),/Winter hazard/);
 now+=2*60*60_000;
 assert.equal((await weather()).status,'unavailable');
});

test('upstream cannot redirect the profile server to an arbitrary host',async()=>{
 const calls=[];
 const weather=createProfileWeather({fetcher:async(url)=>{
  calls.push(url);
  return {ok:true,json:async()=>({properties:{forecast:'http://127.0.0.1:3306/forecast',forecastHourly:'http://127.0.0.1:3306/forecast/hourly'}})};
 }});
 assert.equal((await weather()).status,'unavailable');
 assert.equal(calls.length,1);
});

test('wide CSS changes do not apply when printing or on a phone and mobile panel starts collapsed',()=>{
 const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
 assert.match(css,/@media screen and \(min-width:1440px\)\{\s*\.shell>main\{max-width:none\}/);
 assert.match(css,/\.bci-staff-columns\.has-weather>\.bci-profile-weather\{grid-area:1\/2\}/);
 assert.match(css,/@media print\{\.bci-profile-weather\{display:none!important\}\}/);
 assert.match(profileWeatherCard(),/<details><summary>/);
 assert.doesNotMatch(profileWeatherCard(),/geolocation/);
});
