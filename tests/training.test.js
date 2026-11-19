import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../Models/lib.js';
import {trainingAction,trainingState} from '../Models/training.js';
import {effectivePermissions} from '../Models/permissions.js';
import {visibleState} from '../Models/visibility.js';

function admin(state,email='randy@example.invalid'){
 return {email,role:'admin',permissions:effectivePermissions(state,{email},'admin')};
}

test('practice inventory, entries and review tickets stay in one user workspace',()=>{
 const live=seed(),actor=admin(live);
 const original=structuredClone(live);
 const run=(action,data)=>trainingAction(live,action,data,actor);
 run('training.start',{});
 const before=trainingState(live,actor);
 assert.equal(before.inventory.length,0); // Inventory is outside the exercise screens.
 run('entry.add',{workorderId:'training_released',catalogId:'cat_2',type:'material',quantity:2});
 run('workorder.close',{workorderId:'training_released',submittedBy:'Practice technician'});
 run('workorder.review',{workorderId:'training_released'});
 assert.equal(trainingState(live,actor).workorders.find(order=>order.id==='training_released').status,'reviewed');
 assert.equal(live.trainingWorkspaces[0].state.inventory[0].quantity,2);
 assert.equal(live.trainingWorkspaces[0].state.tickets.length,1);
 assert.equal(trainingState(live,admin(live,'crew@example.invalid')).workorders.find(order=>order.id==='training_released').status,'released');
 const {trainingWorkspaces,...operational}=live;
 assert.deepEqual(operational,original);
 assert.equal(visibleState(live,'admin',actor.permissions).trainingWorkspaces,undefined);
});

test('practice grants, progress and admin-only reset are enforced',()=>{
 const live=seed(),actor=admin(live);
 const technician={email:'crew@example.invalid',role:'tech',permissions:['training.view','training.start','workorders.view']};
 assert.throws(()=>trainingState(live,{...technician,permissions:[]}),/permission/);
 assert.throws(()=>trainingAction(live,'workorder.review',{workorderId:'training_review'},technician),/denied/i);
 assert.throws(()=>trainingAction(live,'mail.sync',{},actor),/unavailable/);
 assert.throws(()=>trainingAction(live,'training.reset',{all:true},technician),/Administrator/);
 trainingAction(live,'training.progress',{step:6},technician);
 assert.equal(trainingState(live,technician).training.step,6);
 trainingAction(live,'training.reset',{all:true},actor);
 assert.equal(trainingState(live,technician).training.step,0);
});

test('training read-only access cannot create or reset a practice workspace',()=>{
 const state=seed();
 const actor={role:'tech',email:'observer@example.invalid',permissions:['training.view']};
 assert.equal(trainingState(state,actor).training.step,0);
 assert.throws(()=>trainingAction(state,'training.start',{},actor),/write permission/);
 assert.throws(()=>trainingAction(state,'training.reset',{},actor),/write permission/);
 assert.equal(state.trainingWorkspaces,undefined);
});
