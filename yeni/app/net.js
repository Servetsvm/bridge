/* BridgePlay (new) — the connection to the database.
   The same Firebase database and the same accounts as the first BridgePlay: a hidden guest sign-in per device (shared
   with the old program on this address, so a player signed in there is signed in here), the player's name and the code
   of their PIN (sess/<account> = { k, pin }, which the database rules accept only with the right PIN).
   Reading: live streams (the value once, then only what changes). Writing: at once, or — without a connection — kept on
   the phone and sent by itself when the connection is back. */

export const DB = 'https://bridgetable-89b1a-default-rtdb.europe-west1.firebasedatabase.app';
const API_KEY = 'AIzaSyDNugZ1tf4rXu7lDYzyZg9v1V3is7xz_Mc';

// ---- the name as the database knows it (exactly as the first BridgePlay) ----
export const nameKey = n => String(n || '').trim().toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/\s+/g, '');
export const ruleKey = n => encodeURIComponent(nameKey(n)).replace(/\./g, '%2E');   // the key in sess/…/k and clubs' owner
export const userKey = n => encodeURIComponent(ruleKey(n));                         // the key in users/…, online/…
export async function pinHash(name, pin) {
  const b = new TextEncoder().encode('bridge-table:' + nameKey(name) + ':' + pin);
  const h = await crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(h)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join('');
}

// ---- the hidden guest sign-in (Firebase anonymous; the refresh token is shared with the first BridgePlay) ----
const Auth = { tok: null, exp: 0, uid: null, p: null };
async function fresh() {
  let rt = null; try { rt = localStorage.getItem('bridge-auth-rt'); } catch (e) {}
  const keep = (tok, ref, uid, sec) => { Auth.tok = tok; Auth.exp = Date.now() + (+sec || 3600) * 1000; Auth.uid = uid; try { localStorage.setItem('bridge-auth-rt', ref); } catch (e) {} return tok; };
  if (rt) {
    try {
      const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt) });
      if (r.ok) { const d = await r.json(); return keep(d.id_token, d.refresh_token, d.user_id, d.expires_in); }
    } catch (e) {}
  }
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' });
  if (!r.ok) throw new Error('auth ' + r.status);
  const d = await r.json(); return keep(d.idToken, d.refreshToken, d.localId, d.expiresIn);
}
export async function token(force) {
  if (!force && Auth.tok && Date.now() < Auth.exp - 60e3) return Auth.tok;
  return Auth.p || (Auth.p = fresh().finally(() => { Auth.p = null; }));
}
export const uid = () => Auth.uid;

// ---- reading and writing (REST) ----
const url = async p => DB + '/' + p + '.json?auth=' + await token();
export async function get(p) {
  const r = await fetch(await url(p), { cache: 'no-store' });
  if (!r.ok) throw new Error('db ' + r.status);
  return r.json();
}
export const tryGet = p => get(p).catch(() => null);

// writes: sent now, or queued on the phone (kept across a closed page) and sent when the connection is back
const QK = 'bp2-queue';
let queue = []; try { queue = JSON.parse(localStorage.getItem(QK) || '[]'); } catch (e) {}
const saveQ = () => { try { localStorage.setItem(QK, JSON.stringify(queue)); } catch (e) {} onQueue.forEach(f => f(queue.length)); };
export const onQueue = new Set();
export const queued = () => queue.length;
async function send(m, p, body) {
  const r = await fetch(await url(p), { method: m, headers: { 'Content-Type': 'application/json' }, body: body == null ? undefined : body });
  if (r.status === 401 || r.status === 403) { const e = new Error('denied'); e.denied = true; throw e; }
  if (!r.ok) throw new Error('db ' + r.status);
}
async function write(m, p, v) {
  const body = v === undefined ? null : JSON.stringify(v);
  if (queue.length) { queue.push({ m, p, body }); saveQ(); flush(); return; }   // in order behind what still waits
  try { await send(m, p, body); }
  catch (e) { if (e.denied) throw e; queue.push({ m, p, body }); saveQ(); }
}
let flushing = false;
export async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  try {
    while (queue.length) {
      const q = queue[0];
      try { await send(q.m, q.p, q.body); } catch (e) { if (!e.denied) break; }   // refused: dropped (it would never go)
      queue.shift(); saveQ();
    }
  } finally { flushing = false; }
}
setInterval(flush, 8000);
addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); });
export const put = (p, v) => write('PUT', p, v);
export const patch = (p, v) => write('PATCH', p, v);
export const del = p => write('DELETE', p);

// ---- live streams: one per path, shared by everyone listening ----
const streams = {};
function setPath(root, path, data) {
  const seg = String(path || '/').split('/').filter(Boolean);
  if (!seg.length) return data;
  const top = root && typeof root === 'object' ? (Array.isArray(root) ? root.slice() : { ...root }) : {};
  let o = top;
  for (let i = 0; i < seg.length - 1; i++) { const c = o[seg[i]]; o[seg[i]] = c && typeof c === 'object' ? (Array.isArray(c) ? c.slice() : { ...c }) : {}; o = o[seg[i]]; }
  const last = seg[seg.length - 1]; if (data === null) delete o[last]; else o[last] = data;
  return top;
}
/* listen(path, fn): fn(value) now and at every change; returns a function that stops listening */
export function listen(p, fn) {
  const S = streams[p] || (streams[p] = { fns: new Set(), val: undefined, es: null, fails: 0, poll: 0 });
  S.fns.add(fn);
  if (S.val !== undefined) try { fn(S.val); } catch (e) {}
  if (!S.es && !S.poll) open(p);
  return () => { S.fns.delete(fn); if (!S.fns.size) { try { S.es && S.es.close(); } catch (e) {} S.es = null; clearTimeout(S.poll); S.poll = 0; delete streams[p]; } };
}
function emit(p, v) { const S = streams[p]; if (!S) return; S.val = v; S.fns.forEach(f => { try { f(v); } catch (e) { console.warn(e); } }); }
async function open(p) {
  const S = streams[p]; if (!S) return;
  if (typeof EventSource === 'undefined') return poll(p);
  let es, got = false, val = null;
  try { es = new EventSource(await url(p)); } catch (e) { return poll(p); }
  if (!streams[p]) { es.close(); return; }
  S.es = es;
  const again = ms => { try { es.close(); } catch (e) {} if (S.es !== es) return; S.es = null; setTimeout(() => streams[p] && !streams[p].es && open(p), ms); };
  es.addEventListener('put', e => { try { const d = JSON.parse(e.data); val = setPath(val, d.path, d.data); got = true; S.fails = 0; emit(p, val); } catch (x) {} });
  es.addEventListener('patch', e => { try { const d = JSON.parse(e.data), b = d.path === '/' ? '' : d.path; for (const [k, v] of Object.entries(d.data || {})) val = setPath(val, b + '/' + k, v); emit(p, val); } catch (x) {} });
  es.addEventListener('auth_revoked', () => again(300));
  es.addEventListener('cancel', () => { try { es.close(); } catch (e) {} S.es = null; poll(p); });
  es.onerror = () => { S.fails++; if (!got && S.fails >= 4) { try { es.close(); } catch (e) {} S.es = null; poll(p); return; } again(Math.min(30000, 1500 * S.fails)); };
}
function poll(p) {
  const S = streams[p]; if (!S) return;
  tryGet(p).then(v => { if (streams[p]) emit(p, v); });
  S.poll = setTimeout(() => poll(p), document.hidden ? 15000 : 4000);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  for (const [p, S] of Object.entries(streams)) if (!S.poll && (!S.es || S.es.readyState === 2)) { S.fails = 0; open(p); }
});

// ---- the player ----
export const me = { name: '', pinH: '' };
// the first BridgePlay's sign-in on this phone (same address): taken over, so nobody types their PIN again
export function loadMe() {
  try {
    const n = localStorage.getItem('bp2-name') || localStorage.getItem('bridge-table-name') || '';
    let h = localStorage.getItem('bp2-pinh') || '';
    if (!h) { const st = JSON.parse(localStorage.getItem('bric-masasi-v2') || 'null'), S = st && st.SET; if (S && S.pinH && (!S.pinFor || S.pinFor === nameKey(n))) h = S.pinH; }
    me.name = n; me.pinH = h;
  } catch (e) {}
  return !!(me.name && me.pinH);
}
export function saveMe(name, pinH) {
  me.name = name; me.pinH = pinH;
  try { localStorage.setItem('bp2-name', name); localStorage.setItem('bp2-pinh', pinH); } catch (e) {}
}
export function signOut() { me.name = ''; me.pinH = ''; try { localStorage.removeItem('bp2-name'); localStorage.removeItem('bp2-pinh'); } catch (e) {} }
export const myKey = () => ruleKey(me.name);
export const isAdmin = () => myKey() === 'servet';

/* the database session for this player: accepted only with the right PIN. 'ok' | 'pin' (wrong) | 'nouser' | 'offline' */
let sessOk = '';
export async function session(name = me.name, pinH = me.pinH) {
  try { await token(); } catch (e) { return 'offline'; }
  const k = ruleKey(name), tag = Auth.uid + ':' + k + ':' + pinH;
  if (sessOk === tag) return 'ok';
  try {
    const u = await get('users/' + userKey(name) + '/name');
    if (u == null) return 'nouser';
    await send('PUT', 'sess/' + Auth.uid, JSON.stringify({ k, pin: pinH, ts: Date.now() }));
    sessOk = tag; return 'ok';
  } catch (e) { return e.denied ? 'pin' : 'offline'; }
}
/* a new name: registered with its PIN (refused when it is taken) */
export async function register(name, pinH) {
  try { await token(); } catch (e) { return 'offline'; }
  try {
    if ((await get('users/' + userKey(name) + '/name')) != null) return 'taken';
    await send('PUT', 'users/' + userKey(name), JSON.stringify({ name: String(name).slice(0, 20), pin: pinH, ts: Date.now() }));
    return (await session(name, pinH)) === 'ok' ? 'ok' : 'offline';
  } catch (e) { return 'offline'; }
}
