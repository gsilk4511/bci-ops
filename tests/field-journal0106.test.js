import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,applyAction} from '../Models/lib.js';
import {fieldJournal,isOriginalSubmitter} from '../public/modules/field-journal.js';

test('journal submitter is independent from payroll attribution and editing',()=>{
 const state=seed(), order=state.workorders[0];
 order.approvedAt='2026-11-19T13:00:00.000Z';order.status='released';
 const worker={email:'worker@example.invalid',role:'tech'};
 const manager={email:'manager@example.invalid',role:'admin'};
 const time={workorderId:order.id,type:'labor',catalogId:'cat_3',date:'2026-11-19',quantity:2,description:'Original entry'};
 const added=applyAction(state,'entry.add',time,worker);
 applyAction(state,'entry.update',{...time,entryId:added.id,revision:'',description:'Manager edit'},manager);
 const edited=order.entries[0];
 assert.equal(edited.updatedBy,manager.email);
 assert.ok(isOriginalSubmitter(edited,worker.email.toUpperCase()));
 assert.ok(!isOriginalSubmitter(edited,manager.email));
 assert.ok(isOriginalSubmitter({...edited,employeeEmail:manager.email},worker.email));
 assert.ok(!isOriginalSubmitter({...edited,createdBy:undefined},worker.email));
 assert.ok(!isOriginalSubmitter({...edited,createdBy:''},''));
});

test('all journal types begin with all authors and ten rows per category',()=>{
 const entries=[
  ...Array.from({length:11},(_,i)=>({type:'labor',id:String(i),createdBy:i%2?'worker@example.invalid':undefined})),
  {type:'travel',id:'travel',employeeEmail:'worker@example.invalid'},
  {type:'material',id:'material',createdBy:'worker@example.invalid'}
 ];
 const markup=fieldJournal(entries,'worker@example.invalid',(row,owned,hidden)=>`<li data-row="${row.id}" data-owner="${owned}"${hidden?' hidden':''}></li>`,text=>text);
 assert.match(markup,/data-journal-filter="all" aria-pressed="true"/);
 assert.match(markup,/data-journal-filter="mine" aria-pressed="false">My entries <span class="journal-count">6<\/span>/);
 assert.match(markup,/data-journal-tab="labor">Time <span class="journal-count" data-journal-count>11<\/span>/);
 assert.match(markup,/data-journal-tab="travel">Travel <span class="journal-count" data-journal-count>1<\/span>/);
 assert.match(markup,/data-journal-tab="material">Parts <span class="journal-count" data-journal-count>1<\/span>/);
 assert.match(markup,/data-row="10" data-owner="false" hidden/);
 assert.match(markup,/data-row="travel" data-owner="false"/);
 assert.match(markup,/data-row="material" data-owner="true"/);
 assert.match(markup,/data-journal-more>Show more \(1 remaining\)/);
 assert.equal(entries.length,13);
});

test('journal groups sort by work date before applying the ten-row limit',()=>{
 const day=n=>'2026-11-'+String(n).padStart(2,'0');
 const entries=[
  ...Array.from({length:10},(_,i)=>({type:'labor',id:'L'+(i+10),date:day(i+10)})),
  {type:'labor',id:'L01',date:day(1)},
  {type:'travel',id:'T15',date:day(15)}, {type:'travel',id:'T12',date:day(12)},
  {type:'material',id:'M14',date:day(14)}, {type:'material',id:'M05',date:day(5)},
  {type:'material',id:'M00',date:''}, {type:'material',id:'M05b',date:day(5)}
 ];
 const original=structuredClone(entries);
 const render=(row,owned,hidden)=>`<li data-row="${row.id}"${hidden?' hidden':''}></li>`;
 const ids=()=>[...fieldJournal(entries,'',render,text=>text).matchAll(/data-row="([^"]+)"( hidden)?/g)];
 let rows=ids();
 assert.deepEqual(rows.map(m=>m[1]),['L01',...Array.from({length:10},(_,i)=>'L'+(i+10)),'T12','T15','M05','M05b','M14','M00']);
 assert.deepEqual(rows.filter(m=>m[2]).map(m=>m[1]),['L19']);
 assert.deepEqual(entries,original);
 entries[10].date=day(20);
 rows=ids();
 assert.equal(rows[0][1],'L10');
 assert.deepEqual(rows.filter(m=>m[2]).map(m=>m[1]),['L01']);
});
