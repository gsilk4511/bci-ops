import { createPublicKey, verify } from 'node:crypto';

const mode = process.env.APP_AUTH_MODE || 'cloudflare';
const team = (process.env.CF_ACCESS_TEAM_DOMAIN || '').replace(/\/$/, '');
const audience = process.env.CF_ACCESS_AUD || '';
let jwks = null;
let fetchedAt = 0;

function parse64(input) { return JSON.parse(Buffer.from(input, 'base64url').toString('utf8')); }
async function getKeys(force = false) {
  if (!force && jwks && Date.now() - fetchedAt < 60 * 60 * 1000) return jwks;
  const response = await fetch(`${team}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Cannot retrieve Cloudflare Access signing keys');
  const data = await response.json();
  if (!Array.isArray(data.keys)) throw new Error('Invalid Access key response');
  jwks = data.keys; fetchedAt = Date.now(); return jwks;
}
export async function identity(req) {
  if (mode === 'local') {
    if (process.env.NODE_ENV === 'production') throw new Error('Local authentication forbidden in production');
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw new Error('Local mode only permits loopback');
    return { email: 'local-admin@example.invalid', sub: 'local-development' };
  }
  if (mode !== 'cloudflare' || !team.startsWith('https://') || !team.endsWith('.cloudflareaccess.com') || !audience) throw new Error('Cloudflare Access verification is not configured');
  const token = req.headers['cf-access-jwt-assertion'];
  if (typeof token !== 'string' || token.length > 12000) throw new Error('Cloudflare Access token required');
  const segments = token.split('.');
  if (segments.length !== 3) throw new Error('Invalid Access token');
  const header = parse64(segments[0]);
  const payload = parse64(segments[1]);
  if (header.alg !== 'RS256' || !header.kid || typeof header.kid !== 'string') throw new Error('Unsupported Access token');
  const currentTime = Math.floor(Date.now()/1000);
  if (payload.iss !== team || !((Array.isArray(payload.aud) ? payload.aud : [payload.aud]).includes(audience)) ||
      typeof payload.exp !== 'number' || payload.exp <= currentTime ||
      typeof payload.nbf === 'number' && payload.nbf > currentTime + 30 ||
      typeof payload.iat === 'number' && payload.iat > currentTime + 30) throw new Error('Access token claims rejected');
  let key = (await getKeys()).find(k => k.kid === header.kid);
  if (!key) key = (await getKeys(true)).find(k => k.kid === header.kid);
  if (!key) throw new Error('Unknown Access signing key');
  let ok = false;
  try { ok = verify('RSA-SHA256', Buffer.from(`${segments[0]}.${segments[1]}`), createPublicKey({key, format:'jwk'}), Buffer.from(segments[2], 'base64url')); } catch {}
  if (!ok) throw new Error('Invalid Access token signature');
  const email = String(payload.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Access identity has no verified email');
  return {email, sub:String(payload.sub||'')};
}
export function roleFor(state, user) {
  const admins = (process.env.BCI_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (user.email === 'local-admin@example.invalid' && mode === 'local') return 'admin';
  if (admins.includes(user.email.toLowerCase())) return 'admin';
  const match = (state.users||[]).find(x => x.email.trim().toLowerCase() === user.email.toLowerCase() && x.active !== false);
  return ['tech','office','admin'].includes(match?.role)?match.role:null;
}
export function authorize(action, role) {
  if (!role) throw new Error('User not on the BCI Operations allowlist');
  const office = new Set(['invoice.record','invoice.pay','workorder.review','settings.reserve','catalog.create','catalog.update','purchase.create','inventory.adjust','inventory.transfer','users.set']);
  const admin = new Set(['users.set','settings.reserve','catalog.create','catalog.update']);
  if (admin.has(action) && role !== 'admin') throw new Error('Admin access required');
  if (office.has(action) && !['admin','office'].includes(role)) throw new Error('Office access required');
  if (!['admin','office','tech'].includes(role)) throw new Error('Unknown role');
}
export function projectState(state, role) {
  if (role !== 'tech') return state;
  const data = structuredClone(state);
  delete data.users; delete data.events;
  delete data.permissionProfiles;
  data.purchases = [];
  data.catalog.forEach(x => { delete x.cost; });
  data.inventory.forEach(x => {delete x.unitCost;});
  data.workorders.forEach(w => {
    w.entries.forEach(e=>{ delete e.cost; });
    w.closeout?.originalEntries?.forEach(e=>{ delete e.cost; });
    delete w.invoice;
  });
  return data;
}
