import {byJournalDate} from './journal-date-order.js';

export function printJournalEntries(order){
 const current=new Map((order.entries||[]).map(entry=>[entry.id,entry]));
 return byJournalDate(order.closeout?.originalEntries||order.entries||[]).map(entry=>{
  const live=current.get(entry.id);
  return {...entry,description:live?.journalNote??live?.description??entry.journalNote??entry.description};
 });
}
