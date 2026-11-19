// The walkthrough uses ordinary BCI forms with the practice API selected.
import {data, me, can, esc, head, modal, send, show, openForm, practiceMode, setPracticeMode, practiceNavigate, view} from '../app.js';

const lessons = [
  {title:'Billing client', grant:'customer.create', screen:'customers', form:'customer',
    tip:'A billing client pays BCI for the work. Create a fictional company using an example.invalid email address.'},
  {title:'Job contact', grant:'contact.create', screen:'customers', form:'contact',
    tip:'A job contact is the foreman or person who coordinates work onsite. Add one under your practice billing client, or skip this optional step.'},
  {title:'Project', grant:'project.create', screen:'customers', form:'project',
    tip:'A project groups work for one billing client. Add a project and a practice jobsite.'},
  {title:'Work order', grant:'workorder.create', screen:'workorders', form:'workorder',
    tip:'A work order defines a specific job scope. Create one for the practice project and describe what the crew will do.'},
  {title:'Customer approval', grant:'workorder.approve', screen:'workorders', form:'approve',
    tip:'Open the scope approval form, enter a fictional approver name, draw a practice signature, and accept the terms.'},
  {title:'Labor', grant:'entry.add', screen:'workorders', form:'log-time',
    tip:'Log labor on the approved work order. Select a labor type and enter practice times and notes.'},
  {title:'Travel', grant:'entry.add', screen:'workorders', form:'log-time',
    tip:'Open Log time and select Travel. Enter a practice travel period that does not overlap your labor entry.'},
  {title:'Materials', grant:'entry.add', screen:'workorders', form:'log-materials',
    tip:'Add a practice material and quantity. The exercise uses its own stock counts.'},
  {title:'Submit closeout', grant:'workorder.close', screen:'workorders', form:'close',
    tip:'Submit the finished work order. This saves a snapshot of the practice entries and sends the order for review.'},
  {title:'Review closeout', grant:'workorder.review', screen:'workorders', form:'review',
    tip:'Check the scope and entries, then mark the closeout reviewed.'},
  {title:'Invoice detail', grant:'invoice.group', screen:'workorders', form:'project-invoice',
    tip:'Choose a reviewed order and preview its invoice. Use a fictional invoice number if you practice recording it.'}
];
let highlighted;
let guideBusy=false;
const usable = lesson => can(lesson.grant) && can(lesson.screen+'.view') &&
  (lesson.grant!=='invoice.group'||can('finance.view'));

function currentLesson() {
  const index = data.training?.step ?? 0;
  return lessons.findIndex((lesson, position)=>position>=index && usable(lesson));
}

export function trainingPage() {
  const allowed=can('training.start');
  const choices = !allowed?'':practiceMode ? '<button class="primary" data-training="locate">Open current lesson</button> <button class="secondary" data-training="exit">Exit training</button>' :
    '<button class="primary" data-training="start">'+(data.training?.started?'Resume training':'Start training')+'</button>';
  return head('Guided Training','Practice workspace','Learn the job workflow using sample records.',choices)+
    '<section class="panel"><h2>Practice a job from start to finish</h2><p>Available steps follow your account permissions.</p>'+
    '<ol>'+lessons.map(lesson=>'<li>'+esc(lesson.title)+'</li>').join('')+'</ol>'+
    '<p>In BCI Ops, a ticket tracks a request or follow-up. A work order records the field scope, approvals, time and materials for a job.</p>'+
    (allowed?'<button class="secondary" data-training="restart">Reset my practice workspace</button>':'')+
    (allowed&&!practiceMode&&me.role==='admin' ? ' <button class="secondary" data-training="reset-all">Reset all practice workspaces</button>' : '')+'</section>';
}

export function clearTrainingHighlight() {
  highlighted?.classList.remove('training-highlight');
  highlighted=undefined;
}

export function renderTrainingGuide() {
  clearTrainingHighlight();
  document.querySelector('#trainingGuide')?.remove();
  if(!practiceMode||!can('training.start'))return;
  const panel=document.createElement('aside');
  panel.id='trainingGuide';
  panel.setAttribute('aria-label','Training instructions');
  const index=currentLesson();
  const lesson=lessons[index];
  const done=data.training.finished||!lesson;
  panel.innerHTML='<div class="training-guide-title">PRACTICE MODE</div>'+
    (done ? '<h2>Walkthrough complete</h2><p>You can exit training or reset your practice workspace to repeat it.</p>' :
      '<h2>'+esc(lesson.title)+'</h2><p>'+esc(lesson.tip)+'</p><div class="actions">'+
      '<button type="button" class="secondary small" data-training="locate">Show me</button>'+
      '<button type="button" class="secondary small" data-training="back">Back</button>'+
      '<button type="button" class="secondary small" data-training="skip">Skip</button>'+
      '<button type="button" class="primary small" data-training="next">Next</button></div>')+
    '<button type="button" class="secondary small" data-training="exit">Exit training</button>';
  document.body.append(panel);
  if(!done && (view===lesson.screen || lesson.form==='workorder' && view==='projects')) {
    const candidates=[...document.querySelectorAll('#app [data-open="'+lesson.form+'"]')];
    highlighted=candidates.find(button=>!button.hidden);
    highlighted?.classList.add('training-highlight');
  }
}

function locate() {
  const lesson=lessons[currentLesson()];
  if (!lesson || data.training.finished) return;
  practiceNavigate(lesson.screen,lesson.form);
  highlighted?.scrollIntoView({block:'center',behavior:'smooth'});
  highlighted?.focus({preventScroll:true});
  // If the form is available through the current record but has no button
  // in this layout, the same permission-checked form can open directly.
  if(!highlighted && lesson.form==='contact')openForm('contact');
}

async function advance(direction) {
  const index=currentLesson();
  if (index<0) return;
  const next=direction<0 ? lessons.findLastIndex((lesson,position)=>position<index&&usable(lesson)) :
    lessons.findIndex((lesson,position)=>position>index&&usable(lesson));
  if(direction<0&&next<0)return;
  await send('training.progress',{step:next<0?index:next,finished:next<0});
  if(next>=0)locate();
}

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-training]');
  if(!button||!can('training.view')||guideBusy)return;
  const action=button.dataset.training;
  if(action!=='exit'&&!can('training.start'))return;
  if(action==='restart'||action==='reset-all'){
    const all=action==='reset-all';
    return modal(all?'Reset all practice workspaces':'Reset my practice workspace',
      '<p>'+ (all?'Everyone’s practice records and progress will be cleared.':'Your practice records and progress will be cleared.') +'</p>',
      async()=>{
        await setPracticeMode(practiceMode,{reset:true,all});
        if(practiceMode)locate();
      });
  }
  guideBusy=true;
  try {
    if(action==='start'){await setPracticeMode(true);locate();}
    if(action==='exit')await setPracticeMode(false);
    if(action==='locate')locate();
    if(action==='back')await advance(-1);
    if(action==='next'||action==='skip')await advance(1);
  } catch(error){show(error.message,true);}
  finally{guideBusy=false;}
});
