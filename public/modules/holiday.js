const easternDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric',
});

export function isHolidaySeason(date = new Date()) {
  const parts = Object.fromEntries(easternDate.formatToParts(date).map(({type, value}) => [type, Number(value)]));
  const {year, month, day} = parts;
  if (month === 12) return true;
  if (month !== 11) return false;
  const firstWeekday = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const thanksgiving = 22 + ((4 - firstWeekday + 7) % 7);
  return day >= thanksgiving;
}

const editing = 'input, select, textarea, [contenteditable]:not([contenteditable="false"]), canvas';
const dialogs = 'dialog[open], [role="dialog"]:not([hidden])';

export function initHoliday(doc, win, now = () => new Date()) {
  const header = doc.querySelector('.operations-header');
  if (!header) return;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let next = null, end = null, snow = null;
  const remove = () => {
    win.clearTimeout(end);
    end = null;
    snow?.remove();
    snow = null;
  };
  const bySeason = () => {
    const active = isHolidaySeason(now());
    header.classList.toggle('bci-holiday', active);
    return active;
  };
  const blocked = () => doc.hidden || motion.matches || !bySeason() ||
    Boolean(doc.activeElement?.closest(editing) || doc.querySelector(dialogs));
  const snowOnce = () => {
    if (blocked()) return;
    snow = doc.createElement('div');
    snow.className = 'bci-snowfall';
    snow.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 12; i++) snow.append(doc.createElement('i'));
    doc.body.append(snow);
    end = win.setTimeout(remove, 4400);
  };
  const cycle = () => {
    snowOnce();
    next = win.setTimeout(cycle, 240000 + Math.floor(Math.random() * 120000));
  };
  const refresh = () => {
    win.clearTimeout(next);
    remove();
    const active = bySeason();
    if (doc.hidden) return;
    if (active && !motion.matches) next = win.setTimeout(cycle, 35000);
  };
  doc.addEventListener('visibilitychange', refresh);
  doc.addEventListener('focusin', () => { if (snow && blocked()) remove(); });
  // Dialogs may open without shifting focus (for example, via an app shortcut).
  const observer = new win.MutationObserver(() => { if (snow && blocked()) remove(); });
  for (const dialog of doc.querySelectorAll('dialog, [role="dialog"]')) {
    observer.observe(dialog, {attributes: true, attributeFilter: ['open', 'hidden']});
  }
  motion.addEventListener?.('change', refresh);
  win.addEventListener('beforeprint', remove);
  // Re-evaluate the calendar on a long-lived tab even with Reduce Motion enabled.
  win.setInterval(() => {
    if (!doc.hidden && isHolidaySeason(now()) !== header.classList.contains('bci-holiday')) refresh();
  }, 3600000);
  refresh();
}
if (typeof document !== 'undefined') initHoliday(document, window);
