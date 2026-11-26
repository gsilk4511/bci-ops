// All business bookings use Vermont local time, independently of the device timezone.
export const ZONE='America/New_York';
const zoned=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,month:'2-digit',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const parts=value=>Object.fromEntries(zoned.formatToParts(value).map(({type,value})=>[type,value]));
export function calendarToday(value=new Date()){
 const p=parts(value);
 return p.year+'-'+p.month+'-'+p.day;
}
export function dayShift(date,days){
 return new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
}
export function monthShift(date,months){
 const [year,month,day]=date.split('-').map(Number);
 const next=new Date(Date.UTC(year,month-1+months,1));
 const end=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
 next.setUTCDate(Math.min(day,end));
 return next.toISOString().slice(0,10);
}
export function daySpan(start,end,limit=93){
 const length=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
 if(!Number.isInteger(length)||length<1||length>limit)throw new Error('Choose a date range of '+limit+' days or fewer.');
 return Array.from({length},(_,i)=>dayShift(start,i));
}
export function easternInstant(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||dayShift(date,0)!==date)throw Error('Enter a valid date and time.');
 const target=date+'T'+time;
 const naive=Date.parse(target+'Z');
 // New York is either UTC-4 or UTC-5 in the supported booking years.
 const matches=[4,5].map(n=>naive+n*3600000).filter(n=>{const p=parts(n);return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute===target;});
 if(matches.length!==1)throw Error('Choose an unambiguous time outside the daylight saving clock change.');
 return new Date(matches[0]).toISOString();
}
const stamp=iso=>iso.replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');
const icsText=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/[;,]/g,c=>'\\'+c).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'');
function fold(text){
 const utf8=new TextEncoder();
 let line='',bytes=0;
 const lines=[];
 for(const char of text){
  const size=utf8.encode(char).length;
  if(bytes+size>75){lines.push(line);line=' ';bytes=1;}
  line+=char;bytes+=size;
 }
 return [...lines,line].join('\r\n');
}
export function scheduleIcs(order,now=new Date()){
 const updated=order.updatedAt?new Date(order.updatedAt):now;
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BCI Operations//Schedule Snapshot//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const visit of order.visits||[]){
  lines.push('BEGIN:VEVENT','UID:'+String(visit.id).replace(/[^a-z0-9-]/gi,'')+'@bci-operations',
   'DTSTAMP:'+stamp(now.toISOString()),'LAST-MODIFIED:'+stamp(updated.toISOString()),'SEQUENCE:'+Number(order.revision||0),
   'DTSTART:'+stamp(easternInstant(visit.date,visit.start)),'DTEND:'+stamp(easternInstant(visit.date,visit.end)),
   'SUMMARY:'+icsText(order.title),'LOCATION:'+icsText(order.site),'TRANSP:OPAQUE','END:VEVENT');
 }
 return [...lines,'END:VCALENDAR',''].map(fold).join('\r\n');
}
export function outlookCompose({date,start,end,title,location,notes}){
 const first=easternInstant(date,start),last=easternInstant(date,end);
 if(first>=last)throw Error('Finish must be after start.');
 const url=new URL('https://outlook.office.com/calendar/deeplink/compose');
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 url.search=new URLSearchParams({path:'/calendar/action/compose',rru:'addevent',allday:'false',
  startdt:first,enddt:last,subject:title,location,body:escape(notes).replace(/\r?\n/g,'<br>')}).toString();
 return url.href;
}
