/* Bridge Table — online club tournaments (set up by a club's director in the Clubs program, played here by pairs
   against each other). This part: the tournaments coming up on the home page with a countdown, registering as a pair
   (with a partner who has a name here), the "looking for a partner" list, cancelling, and a reminder 15 minutes before
   the start. Kept in the database at ot/<club>/<id>: info, pairs/<pair> { a, b, ka, kb, d }, seek/<player key> { n, d }
   (d = the start registered for; a weekly tournament has a new one each week). */
'use strict';
const CT = { all: null, at: 0, busy: false, told: {} };
// the next start: the date, or for a weekly tournament the first week whose start is not more than 4 hours ago
const ctNext = i => { let t = +i.at || 0; if (i.rep) while (t + 4 * 3600e3 < Date.now()) t += 7 * 864e5; return t; };
const ctWhen = t => new Date(t).toLocaleString(SET.lang || undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
function ctLeft(t) {
  const m = Math.max(0, Math.round((t - Date.now()) / 6e4)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
  return d ? T('{0} d {1} h', d, h) : h ? T('{0} h {1} min', h, mm) : T('{0} min', mm);
}
async function ctLoad(force) {
  if (typeof Net === 'undefined' || !Net.Cloud || !Net.Cloud.on) return;
  if (!force && Date.now() - CT.at < 4 * 60e3) return;
  CT.at = Date.now();
  try { await Net.Cloud.uid(); CT.all = await Net.Cloud.get('ot') || {}; } catch (e) { CT.all = CT.all || {}; }
  ctRemind(); if (typeof render === 'function') render();
}
// the tournaments coming up (the next two weeks; one that started less than 4 hours ago is still shown)
function ctList() {
  const out = [];
  for (const [club, L] of Object.entries(CT.all || {})) for (const [id, t] of Object.entries(L || {})) {
    if (!t || !t.info) continue; const d = ctNext(t.info);
    if (d + 4 * 3600e3 < Date.now() || d - Date.now() > 14 * 864e5) continue;
    const pairs = Object.entries(t.pairs || {}).filter(([, p]) => p && p.d === d).map(([pid, p]) => ({ pid, ...p }));
    const seek = Object.entries(t.seek || {}).filter(([, p]) => p && p.d === d).map(([k, p]) => ({ k, ...p }));
    const run = (t.run || {})[d] || null;
    out.push({ club, id, i: t.info, d, pairs, seek, run, plan: run && run.plan || null });
  }
  return out.sort((a, b) => a.d - b.d);
}
const ctMe = () => Net.ruleKey(myNm() || '');
const ctMine = x => x.pairs.find(p => p.ka === ctMe() || p.kb === ctMe());
/* the plan of the evening, made once when the start time has come (by the first app of a registered player that sees
   it; the database keeps only the first): the pairs in the order they registered (an odd number gets a robot pair), and
   the rounds by the circle method — every pair meets another pair each round, every table of a round plays the same
   boards (so each board is compared across all the tables). m: who sits at each table (the database lets only them
   write that table). The deals come from the plan's seed, the same on every device. */
function ctSeed(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function ctMakePlan(x) {
  const P = x.pairs.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0) || String(a.pid).localeCompare(String(b.pid))).map(p => ({ a: p.a, b: p.b, ka: p.ka, kb: p.kb }));
  if (P.length < 2) return null;
  if (P.length % 2) P.push({ a: 'Robot', b: 'Robot', ka: '', kb: '', robot: 1 });
  const n = P.length, R = Math.max(1, Math.floor((+x.i.b || 18) / (+x.i.bpr || 3)));   // after everyone has met everyone the circle goes on (the same opponents, other boards)
  const rounds = []; let arr = [...Array(n).keys()];
  for (let r = 0; r < R; r++) {
    const tb = []; for (let i = 0; i < n / 2; i++) { let a = arr[i], b = arr[n - 1 - i]; if ((r + i) % 2) [a, b] = [b, a]; tb.push([a, b]); }
    rounds.push(tb); arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const m = {}; rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => { const id = r + '_' + ti; m[id] = {}; for (const k of [P[a].ka, P[a].kb, P[b].ka, P[b].kb]) if (k) m[id][k] = 1; }));
  return { plan: { pairs: P, rounds, bpr: +x.i.bpr || 3, sys: x.i.sys, conv: x.i.conv || [], sc: x.i.sc, seed: ctSeed(x.id + ':' + x.d), at: Date.now() }, m };
}
async function ctEnsurePlan(x) {
  if (x.plan || x.d > Date.now() || !ctMine(x) || CT.planning) return;
  const p = ctMakePlan(x); if (!p) return;
  CT.planning = true;
  try { await ctSession(); await Net.Cloud.patch(ctPath(x, '/run/' + x.d), p); } catch (e) {}   // another app was first: its plan stays
  finally { CT.planning = false; await ctLoad(true); }
}
// a board of the evening: the deal from the plan's seed (board 1, 2 … with the usual dealer and vulnerability)
function ctDeal(plan, board) { E.seed(((plan.seed >>> 0) + board * 7919) >>> 0 || 1); const d = E.shuffle([...Array(52).keys()]); return [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13).sort((a, b) => b - a)); }
// where a pair plays: each round its table, direction, opponents and boards
function ctSched(plan, pi) {
  const out = [];
  plan.rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => {
    if (a !== pi && b !== pi) return;
    const ns = a === pi, opp = plan.pairs[ns ? b : a];
    out.push({ r, ti, ns, opp, from: r * plan.bpr + 1, to: r * plan.bpr + plan.bpr });
  }));
  return out;
}
const ctMyPair = plan => plan.pairs.findIndex(p => p.ka === ctMe() || p.kb === ctMe());
const ctPairTxt = p => p.robot ? '🤖 ' + T('Robot pair') : esc(p.a) + ' – ' + esc(p.b);
// the home page card: each tournament coming up, its countdown and whether you are registered
function ctCardHtml() {
  const L = ctList(); if (!L.length || !myNm()) return '';
  return L.slice(0, 3).map(x => {
    const mine = ctMine(x), seeking = x.seek.some(s => s.k === ctMe()), started = x.d <= Date.now();
    return `<button class="hcard ctcard${mine ? ' reg' : ''}" data-ct="${esc(x.club + '|' + x.id)}"><b>🏛 ${esc(x.i.cn || x.club)} · ${esc(x.i.n)}</b>
      <span>${esc(ctWhen(x.d))}${x.i.rep ? ' · 🔁' : ''} · ${started ? '🟢 ' + T('Started') : '⏳ ' + ctLeft(x.d)} · ${T('{0} pairs', x.pairs.length)}</span>
      <small>${(() => { if (x.plan && mine) { const pi = ctMyPair(x.plan), S = pi >= 0 ? ctSched(x.plan, pi) : []; return S.length ? '🪑 ' + T('Round {0} · table {1} · {2} against {3} · boards {4}-{5}', S[0].r + 1, S[0].ti + 1, S[0].ns ? T('North-South') : T('East-West'), ctPairTxt(S[0].opp), S[0].from, S[0].to) : ''; } if (started && !x.plan) ctEnsurePlan(x); return mine ? '✅ ' + T('You are registered with {0}', esc(nameKeyEq(mine.a) ? mine.b : mine.a)) : seeking ? '🔎 ' + T('You are looking for a partner') : started ? '' : '✍️ ' + T('Register as a pair'); })()}</small></button>`;
  }).join('');
}
const nameKeyEq = n => Net.ruleKey(n || '') === ctMe();
const ctFind = key => { const [club, id] = String(key).split('|'); return ctList().find(x => x.club === club && x.id === id); };
// the tournament's window: what is played, the pairs, and register / look for a partner / cancel
function ctShow(key, err) {
  const x = ctFind(key); if (!x) { closeOv(); return; }
  const i = x.i, mine = ctMine(x), seeking = x.seek.some(s => s.k === ctMe());
  const convs = (i.conv || []).map(k => typeof pracName === 'function' ? pracName(k) : k).join(', ');
  const sys = E.sysOf(i.sys) ? E.sysOf(i.sys).n : i.sys;
  const names = typeof Net.knownNames === 'function' ? Net.knownNames() : [];
  openOv('ctour', `<h2>🏛 ${esc(i.cn || x.club)}</h2><div class="big">${esc(i.n)}</div>
    <div class="grp"><span>${T('When')}</span><b>${esc(ctWhen(x.d))}</b>${i.rep ? ' · 🔁 ' + T('every week') : ''} · ${x.d > Date.now() ? '⏳ ' + ctLeft(x.d) : '🟢 ' + T('Started')}</div>
    <div class="grp"><span>${T('What is played')}</span>${T('{0} boards', i.b)} · ${T('{0} boards a round', i.bpr)} · ${i.sc === 'imp' ? 'IMP' : 'MP'} · ${T('pairs against each other')}
      <div><b>${esc(sys)}</b>${convs ? ' · ' + esc(convs) : ''}</div><div class="muted">${T('Everyone bids with this card, the robots too.')}</div></div>
    <div class="grp"><span>${T('Pairs registered')} (${x.pairs.length})</span>${x.pairs.length ? x.pairs.map((p, k) => `<div>${k + 1}. ${esc(p.a)} – ${esc(p.b)}</div>`).join('') : `<div class="muted">${T('Nobody yet.')}</div>`}</div>
    ${x.seek.length ? `<div class="grp"><span>🔎 ${T('Looking for a partner')}</span>${x.seek.map(s => esc(s.n)).join(', ')}<div class="muted">${T('Write to one of them, or the director pairs you.')}</div></div>` : ''}
    ${x.plan ? ctPlanHtml(x) : x.d <= Date.now() ? `<div class="grp"><span>🪑 ${T('Tables')}</span><div class="muted">${x.pairs.length < 2 ? T('At least two pairs are needed.') : '⏳ ' + T('The tables are being made…')}</div></div>` : ''}
    ${err ? `<div class="err">${esc(err)}</div>` : ''}
    ${x.d <= Date.now() && !mine ? `<div class="row2">` : mine ? `<div class="okmsg">✅ ${T('You are registered with {0}', esc(nameKeyEq(mine.a) ? mine.b : mine.a))}</div><div class="row2">${x.d > Date.now() ? `<button class="btn" data-ctcancel="${esc(key)}">${T('Cancel the registration')}</button>` : ''}`
      : `<div class="grp"><span>✍️ ${T('Register as a pair')}</span><input id="ctPartner" class="tok wide" list="ctNames" maxlength="20" placeholder="${T('Your partner\'s name')}"><datalist id="ctNames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="muted">${T('Your partner needs a name in Bridge Table (the same name they sign in with).')}</div></div>
        <div class="row2"><button class="btn new" data-ctreg="${esc(key)}">✍️ ${T('Register')}</button><button class="btn" data-ctseek="${esc(key)}">${seeking ? '✖ ' + T('I no longer look for a partner') : '🔎 ' + T('I am looking for a partner')}</button>`}
      <button class="btn" id="oClose">${T('Close')}</button></div>`);
}
async function ctSession() { const n = myNm(); if (!n || !SET.pinH) throw new Error('signin'); if (!(await Net.Cloud.session(n, SET.pinH))) throw new Error('signin'); }
const ctPath = (x, p) => 'ot/' + encodeURIComponent(x.club) + '/' + encodeURIComponent(x.id) + p;
async function ctRegister(key) {
  const x = ctFind(key), inp = $('ctPartner'), b = (inp && inp.value || '').trim().slice(0, 20); if (!x || CT.busy) return;
  if (!b) { ctShow(key, T('Write your partner\'s name')); return; }
  if (Net.ruleKey(b) === ctMe()) { ctShow(key, T('Your partner cannot be you')); return; }
  if (x.pairs.some(p => p.ka === Net.ruleKey(b) || p.kb === Net.ruleKey(b))) { ctShow(key, T('{0} is already registered with another partner', b)); return; }
  CT.busy = true;
  try {
    if (!(await Net.Cloud.exists(b))) { ctShow(key, T('There is no player called {0} in Bridge Table', b)); return; }
    await ctSession();
    const pid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    await Net.Cloud.put(ctPath(x, '/pairs/' + pid), { a: myNm(), b, ka: ctMe(), kb: Net.ruleKey(b), d: x.d, ts: Date.now() });
    try { await Net.Cloud.put(ctPath(x, '/seek/' + Net.fbKey(myNm())), null); } catch (e) {}
    await ctLoad(true); flash('✅ ' + T('Registered: {0} – {1}', myNm(), b), 2500); ctShow(key);
  } catch (e) { ctShow(key, e.message === 'signin' ? T('Could not send — sign in with your name and PIN first.') : T('The online database could not be reached.')); }
  finally { CT.busy = false; }
}
async function ctCancel(key) {
  const x = ctFind(key), mine = x && ctMine(x); if (!mine) return;
  askYes(T('Cancel your registration for {0}?', esc(x.i.n)), async () => {
    try { await ctSession(); await Net.Cloud.put(ctPath(x, '/pairs/' + mine.pid), null); await ctLoad(true); ctShow(key); } catch (e) { ctShow(key, T('The online database could not be reached.')); }
  });
}
async function ctSeek(key) {
  const x = ctFind(key); if (!x) return; const on = x.seek.some(s => s.k === ctMe());
  try { await ctSession(); await Net.Cloud.put(ctPath(x, '/seek/' + Net.fbKey(myNm())), on ? null : { n: myNm(), d: x.d, ts: Date.now() }); await ctLoad(true); ctShow(key); }
  catch (e) { ctShow(key, T('The online database could not be reached.')); }
}
function ctPlanHtml(x) {
  const P = x.plan, pi = ctMyPair(P), S = pi >= 0 ? ctSched(P, pi) : [];
  const mineH = S.length ? `<div class="grp"><span>🪑 ${T('Your rounds')}</span>${S.map(s => `<div>${T('Round {0} · table {1} · {2} against {3} · boards {4}-{5}', s.r + 1, s.ti + 1, s.ns ? T('North-South') : T('East-West'), ctPairTxt(s.opp), s.from, s.to)}</div>`).join('')}</div>` : '';
  const all = `<div class="grp"><span>${T('The tables, round {0}', 1)}</span>${P.rounds[0].map(([a, b], ti) => `<div>${T('Table {0}', ti + 1)}: ${ctPairTxt(P.pairs[a])} – ${ctPairTxt(P.pairs[b])}</div>`).join('')}</div>`;
  return mineH + all + `<div class="muted">${T('{0} rounds of {1} boards; every table of a round plays the same boards.', P.rounds.length, P.bpr)}</div>`;
}
// 15 minutes before the start a registered player is told (once), on any screen
function ctRemind() {
  for (const x of ctList()) {
    const left = x.d - Date.now(), k = x.club + x.id + x.d;
    if (ctMine(x) && left > 0 && left <= 15 * 60e3 && !CT.told[k]) {
      CT.told[k] = 1; flash('🏛 ' + T('{0} starts in {1}', x.i.n, ctLeft(x.d)), 8000);
      try { if (typeof sfx === 'function') sfx('good'); } catch (e) {}
    }
  }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ct],[data-ctreg],[data-ctcancel],[data-ctseek]'); if (!t) return;
  if (t.dataset.ct) ctShow(t.dataset.ct);
  else if (t.dataset.ctreg) ctRegister(t.dataset.ctreg);
  else if (t.dataset.ctcancel) ctCancel(t.dataset.ctcancel);
  else if (t.dataset.ctseek) ctSeek(t.dataset.ctseek);
});
setTimeout(() => ctLoad(true), 6000);
setInterval(() => ctLoad(false), 60e3);
setInterval(() => { ctRemind(); const el = $('hClubT'); if (el && document.body.classList.contains('athome')) { const h = ctCardHtml(); if (el.innerHTML !== h) el.innerHTML = h; } }, 30e3);
