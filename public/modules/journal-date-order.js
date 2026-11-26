// Journal dates are local work days (YYYY-MM-DD), not timestamps.
const dateKey = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

export function byJournalDate(entries) {
 // Sort a copy; ties keep their existing order and missing/legacy dates go last.
 return entries.map(entry=>({entry,date:dateKey(entry.date)}))
  .sort((a,b)=>a.date===b.date?0:a.date===null?1:b.date===null?-1:a.date<b.date?-1:1)
  .map(({entry})=>entry);
}
