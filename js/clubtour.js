/* Bridge Table — online club tournaments (set up by a club's director in the Clubs program, played here by pairs
   against each other). This part: the tournaments coming up on the home page with a countdown, registering as a pair
   (with a partner who has a name here), the "looking for a partner" list, cancelling, and a reminder 15 minutes before
   the start. Kept in the database at ot/<club>/<id>: info, pairs/<pair> { a, b, ka, kb, d }, seek/<player key> { n, d }
   (d = the start registered for; a weekly tournament has a new one each week). */
'use strict';
const CT = { all: null, at: 0, busy: false, told: {} };
window.CT = CT;   // the clubs program (in its frame) reads and sets it
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
  if (P.length < 1) return null;   // one pair plays the robot pair
  if (P.length % 2) P.push({ a: 'Robot', b: 'Robot', ka: '', kb: '', robot: 1 });
  const n = P.length, R = Math.max(1, Math.floor((+x.i.b || 18) / (+x.i.bpr || 3)));   // after everyone has met everyone the circle goes on (the same opponents, other boards)
  const rounds = []; let arr = [...Array(n).keys()];
  if (x.i.mov === 'mitchell') { const tn = n / 2; for (let r = 0; r < R; r++) rounds.push([...Array(tn).keys()].map(i => [i, tn + (i + r) % tn])); }
  else for (let r = 0; r < R; r++) {
    const tb = []; for (let i = 0; i < n / 2; i++) { let a = arr[i], b = arr[n - 1 - i]; if ((r + i) % 2) [a, b] = [b, a]; tb.push([a, b]); }
    rounds.push(tb); arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const m = {}; rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => { const id = r + '_' + ti; m[id] = {}; for (const k of [P[a].ka, P[a].kb, P[b].ka, P[b].kb]) if (k) m[id][k] = 1; }));
  return { plan: { pairs: P, rounds, mov: x.i.mov || 'howell', bpr: +x.i.bpr || 3, sys: x.i.sys, conv: x.i.conv || [], sc: x.i.sc, seed: ctSeed(x.id + ':' + x.d), at: Date.now() }, m };
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
    ${x.plan ? ctPlanHtml(x) : x.d <= Date.now() ? `<div class="grp"><span>🪑 ${T('Tables')}</span><div class="muted">${!x.pairs.length ? T('Nobody yet.') : '⏳ ' + T('The tables are being made…')}</div></div>` : ''}
    ${err ? `<div class="err">${esc(err)}</div>` : ''}
    ${x.d <= Date.now() && !mine ? `<div class="row2">` : mine ? `<div class="okmsg">✅ ${T('You are registered with {0}', esc(nameKeyEq(mine.a) ? mine.b : mine.a))}</div><div class="row2">${x.d > Date.now() ? `<button class="btn" data-ctcancel="${esc(key)}">${T('Cancel the registration')}</button>` : ''}`
      : `<div class="grp"><span>✍️ ${T('Register as a pair')}</span><input id="ctPartner" class="tok wide" list="ctNames" maxlength="20" placeholder="${T('Your partner\'s name')}"><datalist id="ctNames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="muted">${T('Your partner needs a name in Bridge Table (the same name they sign in with).')}</div></div>
        <div class="row2"><button class="btn new" data-ctreg="${esc(key)}">✍️ ${T('Register')}</button><button class="btn" data-ctrobot="${esc(key)}">🤖 ${T('Register with a robot partner')}</button><button class="btn" data-ctseek="${esc(key)}">${seeking ? '✖ ' + T('I no longer look for a partner') : '🔎 ' + T('I am looking for a partner')}</button>`}
      <button class="btn" id="oClose">${T('Close')}</button></div>`);
}
async function ctSession() { const n = myNm(); if (!n || !SET.pinH) throw new Error('signin'); if (!(await Net.Cloud.session(n, SET.pinH))) throw new Error('signin'); }
const ctPath = (x, p) => 'ot/' + encodeURIComponent(x.club) + '/' + encodeURIComponent(x.id) + p;
// robot: a player who wants to play with a robot partner (it bids with the tournament's card)
async function ctRegister(key, robot) {
  const x = ctFind(key), inp = $('ctPartner'), b = robot ? T('Robot') : (inp && inp.value || '').trim().slice(0, 20); if (!x || CT.busy) return;
  if (!b) { ctShow(key, T('Write your partner\'s name')); return; }
  if (!robot && Net.ruleKey(b) === ctMe()) { ctShow(key, T('Your partner cannot be you')); return; }
  if (!robot && x.pairs.some(p => p.ka === Net.ruleKey(b) || p.kb === Net.ruleKey(b))) { ctShow(key, T('{0} is already registered with another partner', b)); return; }
  CT.busy = true;
  try {
    if (!robot && !(await Net.Cloud.exists(b))) { ctShow(key, T('There is no player called {0} in Bridge Table', b)); return; }
    await ctSession();
    const pid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    await Net.Cloud.put(ctPath(x, '/pairs/' + pid), { a: myNm(), b, ka: ctMe(), kb: robot ? '' : Net.ruleKey(b), d: x.d, ts: Date.now() });
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
  const sit = S.length ? `<div class="row2"><button class="btn new" data-ctsit="${esc(x.club + '|' + x.id)}">🪑 ${T('Sit down at your table')}</button></div>` : '';
  const res = `<div class="row2"><button class="btn" data-ctresopen="${esc(x.club + '|' + x.id)}">📊 ${T('Results')}</button></div>`;
  return sit + mineH + all + res + `<div class="muted">${T('{0} rounds of {1} boards; every table of a round plays the same boards.', P.rounds.length, P.bpr)}</div>`;
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
/* ---- step 2b: the club tournament's table, kept in the database ----
   Every call and card of a table goes into run/<start>/t/<round_table>/a/<n> in turn (n = 0, 1, 2 …; the first app to
   write a number keeps it). Every app at the table rebuilds the game from that list, so nobody's device holds the table:
   a player who drops and comes back (or opens another device) is back at the same point. Each seat is played by its
   player; a robot pair's seats, and the seats of a player away for more than 90 seconds, are played by the robots on
   the device of the first player present at the table (another takes over when that one goes). A player counts as
   present while their app writes run/<start>/hb/<player> (every 20 seconds, at any table of the evening). */
const CT_AWAY = 90e3;
CT.tbl = null;
const ctRunP = x => ctPath(x, '/run/' + x.d);
function ctCardsOf(plan) { const sys = E.sysOf(plan.sys).k, conv = { ...E.sysOf(sys).conv }; for (const k of plan.conv || []) conv[k] = true; return [{ conv, agg: 0, sys }, { conv: { ...conv }, agg: 0, sys }]; }
// the four seats of a table: the North-South pair's first player South, the partner North; East-West: first East
function ctSeatsOf(plan, r, ti) {
  const [ns, ew] = plan.rounds[r][ti], A = plan.pairs[ns], B = plan.pairs[ew];
  const s = (p, w) => p.robot ? { n: T('Robot'), k: '' } : { n: w ? p.b : p.a, k: w ? p.kb : p.ka };
  return [s(A, 1), s(B, 0), s(A, 0), s(B, 1)];
}
const ctBoards = (plan, r) => [...Array(plan.bpr).keys()].map(i => r * plan.bpr + i + 1);
// who decides a seat now: its player (present), else the robots of the runner's device; dummy goes with declarer
function ctPresent(k) { const t = CT.tbl; return !!k && (k === ctMe() || (t && t.hb && Date.now() - (+t.hb[k] || 0) < CT_AWAY)); }
function ctRunner() { const t = CT.tbl; if (!t) return ''; const ks = t.seats.map(s => s.k).filter(ctPresent).sort(); return ks[0] || ctMe(); }
function ctWho(seat) {
  const t = CT.tbl; if (!t || !G) return '';
  let s = seat;
  if (G.play && G.phase === 'play') { const c = G.play.contract, dummy = (c.decl + 2) % 4; if (s === dummy) s = c.decl; }
  const k = t.seats[s].k; return ctPresent(k) ? k : 'robot';
}
const ctControls = seat => !(CT.tbl && CT.tbl.watch) && ctWho(seat) === ctMe();
const ctRobotHere = seat => !(CT.tbl && CT.tbl.watch) && ctWho(seat) === 'robot' && ctRunner() === ctMe();
// an action made here goes to the table's list; if another app was quicker the table is read again
function ctAct(a) {
  const t = CT.tbl; if (!t || t.watch || CT.replay || !G || !G.ct) return;
  const n = t.n++; t.wait = (t.wait || 0) + 1;
  Net.Cloud.put(t.p + '/t/' + t.tid + '/a/' + n, a).then(() => { t.wait--; }, () => { t.wait--; ctRebuild(); });
}
// a board started at the table (its deal from the plan's seed); id fixed so its result is kept once
function ctStartBoard(i) {
  const t = CT.tbl, bn = t.boards[i];
  CT.replay = true;
  try { newBoard(ctDeal(t.plan, bn), bn, null, { id: 'ct' + t.id + t.d + '-' + bn, ct: { i, seat: t.seat, seats: t.seats.map(s => s.n), name: t.name }, cards: ctCardsOf(t.plan) }); } finally { CT.replay = false; }
}
// one action from the list: a call, or a card (the trick is gathered at once while catching up)
// true when the action could be applied (a call or card refused means this device is out of step: read again)
const ctStep = () => G ? G.ct.i * 1000 + G.auction.length + (G.play ? G.play.history.length * 4 + G.play.trick.length : 0) : -1;
function ctApply(a) {
  if (!G || !G.ct) return false;
  const st0 = ctStep(), i0 = G.ct.i;
  CT.replay = true;
  try {
    // a full trick still on the table is gathered first (the last one ends the board)
    if (G.phase === 'play' && G.play && G.play.trick.length === 4) collectTrick();
    if (G.phase === 'done') { if (G.ct.i + 1 < CT.tbl.boards.length) ctStartBoard(G.ct.i + 1); else return false; }
    CT.replay = true;   // a new board's start clears it
    if (a.c != null) makeCall(a.s, a.c);
    else if (a.k != null) playCard(a.s, a.k);
  } finally { CT.replay = false; }
  return G && G.ct && (G.ct.i !== i0 || ctStep() > st0);
}
// read the table again from the start (entering it, coming back, or after a clash)
async function ctRebuild() {
  const t = CT.tbl; if (!t || t.busy) return; t.busy = true;
  try {
    const raw = await Net.Cloud.get(t.p + '/t/' + t.tid + '/a'), L = Array.isArray(raw) ? raw : Object.keys(raw || {}).sort((a, b) => a - b).map(k => raw[k]);
    ctStartBoard(0); t.n = 0;
    for (const a of L) { if (!a || !ctApply(a)) break; t.n++; }
    if (G && G.play && G.play.trick.length === 4) collectTrick();
    save(); render(); tick();
  } catch (e) {} finally { t.busy = false; }
}
// what the others did since: applied in order
async function ctPoll() {
  const t = CT.tbl; if (!t || t.busy || !G || !G.ct) return;
  try {
    const raw = await Net.Cloud.get(t.p + '/t/' + t.tid + '/a'), L = Array.isArray(raw) ? raw : Object.keys(raw || {}).sort((a, b) => a - b).map(k => raw[k]);
    if (L.length < t.n) { if (!t.wait) ctRebuild(); return; }   // our own last action may still be on its way
    let moved = false;
    while (t.n < L.length && L[t.n]) { if (!ctApply(L[t.n])) { ctRebuild(); return; } t.n++; moved = true; }
    if (moved) { save(); render(); tick(); }
    // nothing moved for a while although a robot (here) is to play or a full trick waits: the table is nudged on
    const st = ctStep(); if (st !== t.st) { t.st = st; t.stAt = Date.now(); }
    else if (Date.now() - (t.stAt || 0) > 6000 && G.phase === 'play' && G.play && (G.play.trick.length === 4 || ctRobotHere(G.play.turn))) { t.stAt = Date.now(); tick(); }
    else if (Date.now() - (t.stAt || 0) > 6000 && G.phase === 'bid' && ctRobotHere(bidTurn())) { t.stAt = Date.now(); tick(); }
  } catch (e) {}
}
async function ctBeat() {
  const t = CT.tbl; if (!t) return;
  ctSlowCheck();
  try { await Net.Cloud.put(t.p + '/hb/' + Net.fbKey(myNm()), Date.now()); t.hb = await Net.Cloud.get(t.p + '/hb') || {}; } catch (e) {}
  if (G && G.ct) tick();   // a player gone (or back): the robots take the seat (or give it back)
}
// sit down at your table of the round (the first round not finished); the whole list is read, so it also brings back
// a table after a drop or another device
async function ctSit(key, r0) {
  const x = ctFind(key); if (!x || !x.plan) return;
  const pi = ctMyPair(x.plan); if (pi < 0) return;
  const S = ctSched(x.plan, pi), r = r0 != null ? r0 : +(localStorage.getItem('ct-r-' + x.id + x.d) || 0), s = S.find(q => q.r === r) || S[0];
  if (!s) return;
  try { await ctSession(); } catch (e) { flash(T('Could not send — sign in with your name and PIN first.'), 2500); return; }
  const seats = ctSeatsOf(x.plan, s.r, s.ti), seat = seats.findIndex(q => q.k === ctMe());
  clearInterval(CT.pollT); clearInterval(CT.beatT);
  CT.tbl = { key, id: x.id, d: x.d, p: ctRunP(x), plan: x.plan, r: s.r, ti: s.ti, tid: s.r + '_' + s.ti, seats, seat, boards: ctBoards(x.plan, s.r), n: 0, hb: {}, name: x.i.n, rounds: x.plan.rounds.length };
  try { localStorage.setItem('ct-r-' + x.id + x.d, String(s.r)); } catch (e) {}
  closeOv();
  await ctBeat(); await ctRebuild();
  CT.pollT = setInterval(ctPoll, 1500); CT.beatT = setInterval(ctBeat, 20e3);
  flash('🪑 ' + T('Round {0} · table {1}', s.r + 1, s.ti + 1), 2500);
}
// the next board of the round, or the next round's table, or the end of the evening
function ctGoNext() {
  const t = CT.tbl; if (!t || !G || !G.ct) return;
  if (t.watch) { ctLeave(); G = idleG(); save(); render(); return; }   // watching: back home
  if (G.phase !== 'done') { flash(T('Finish this tournament board first'), 2000); return; }
  if (G.ct.i + 1 < t.boards.length) { ctStartBoard(G.ct.i + 1); ctPoll(); return; }
  if (t.r + 1 < t.rounds) { ctWaitRound(t, t.r + 1); return; }
  clearInterval(CT.pollT); clearInterval(CT.beatT); CT.tbl = null;
  flash('🏁 ' + T('The tournament is over for you — thank you!'), 4000); G = null; goHome();
}
// a board finished here: its result for the club's list (written by every app of the table: the same values)
function ctBoardDone(e) {
  const t = CT.tbl; if (!t || t.watch || !e) return;
  const res = e.c ? { c: [e.c.level, e.c.strain, e.c.dbl, e.c.decl], tr: e.tricks, ns: e.ns } : { pass: 1, ns: 0 };
  Net.Cloud.put(t.p + '/t/' + t.tid + '/res/' + e.board, res).catch(() => {});
}
/* the end of a round at your table: the next round starts when every table has finished this one (the tables still
   playing are shown; after five minutes you may go on without waiting); then you are seated at your next table */
async function ctTablesLeft(p, plan, r) {
  const left = [];
  for (let ti = 0; ti < plan.rounds[r].length; ti++) {
    let res = null; try { res = await Net.Cloud.get(p + '/t/' + r + '_' + ti + '/res'); } catch (e) {}
    const n = Object.keys(res || {}).length; if (n < plan.bpr) left.push({ ti, n });
  }
  return left;
}
async function ctWaitRound(t, next) {
  const { key, p, plan, r } = t;
  ctLeave(); G = idleG(); save(); render();
  CT.waiting = { key, next, since: Date.now(), p, plan, r, k: 0 };
  const beat = () => Net.Cloud.put(p + '/hb/' + Net.fbKey(myNm()), Date.now()).catch(() => {});   // still here: the next table waits for you
  beat(); clearInterval(CT.waitT);
  const check = async () => {
    const w = CT.waiting; if (!w) { clearInterval(CT.waitT); return; }
    const left = await ctTablesLeft(p, plan, r);
    if (CT.waiting !== w) return;
    if (!left.length) { clearInterval(CT.waitT); CT.waiting = null; if (ui.overlay === 'ctwait') closeOv(); flash('🪑 ' + T('Every table has finished: round {0}', next + 1), 2500); ctSit(key, next); return; }
    if (ui.overlay === 'ctwait' || !ui.overlay) ctWaitShow(left);
    if (++w.k % 4 === 0) beat();
  };
  CT.waitT = setInterval(check, 5000); check();
}
function ctWaitShow(left) {
  const w = CT.waiting; if (!w) return; const P = w.plan, long = Date.now() - w.since > 5 * 60e3;
  openOv('ctwait', `<h2>⏳ ${T('Waiting for the other tables')}</h2>
    <div class="big">${T('Round {0} is over at your table. You sit down at your next table as soon as every table has finished.', w.r + 1)}</div>
    <div class="grp"><span>${T('Tables still playing')}</span>${left.map(x => { const [a, b] = P.rounds[w.r][x.ti]; return `<div>${T('Table {0}', x.ti + 1)}: ${ctPairTxt(P.pairs[a])} – ${ctPairTxt(P.pairs[b])} · ${x.n}/${P.bpr}</div>`; }).join('')}</div>
    <div class="row2">${long ? `<button class="btn gold" data-ctskip="1">⏭ ${T('Go on without waiting')}</button>` : ''}<button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// a table still playing while the others have finished the round: its players are told (once a minute)
async function ctSlowCheck() {
  const t = CT.tbl; if (!t || !G || !G.ct || Date.now() - (t.slowAt || 0) < 60e3) return;
  t.slowAt = Date.now();
  const left = await ctTablesLeft(t.p, t.plan, t.r);
  if (left.length === 1 && left[0].ti === t.ti && t.plan.rounds[t.r].length > 1) flash('⏳ ' + T('The other tables have finished this round and wait for yours'), 5000);
}
// back to the home page from a club table: the table goes on (the robots take the seat after 90 seconds); the card
// offers to sit down again
function ctLeave() { clearInterval(CT.pollT); clearInterval(CT.beatT); CT.tbl = null; }
// a game kept from before a reload: the table is read again from the database (not the copy on this device)
setTimeout(() => { if (typeof ui !== 'undefined' && ui.saved && ui.saved.ct) ui.saved = null; if (typeof G !== 'undefined' && G && G.ct && !CT.tbl) { G = null; if (typeof render === 'function') render(); } }, 500);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-ct],[data-ctreg],[data-ctcancel],[data-ctseek],[data-ctsit],[data-ctrobot],[data-ctskip]'); if (!t) return;
  if (t.dataset.ctrobot) { ctRegister(t.dataset.ctrobot, true); return; }
  if (t.dataset.ctsit) { ctSit(t.dataset.ctsit); return; }
  if (t.dataset.ctskip && CT.waiting) { const w = CT.waiting; CT.waiting = null; clearInterval(CT.waitT); closeOv(); ctSit(w.key, w.next); return; }
  if (t.dataset.ct) ctShow(t.dataset.ct);
  else if (t.dataset.ctreg) ctRegister(t.dataset.ctreg);
  else if (t.dataset.ctcancel) ctCancel(t.dataset.ctcancel);
  else if (t.dataset.ctseek) ctSeek(t.dataset.ctseek);
});
setTimeout(() => ctLoad(true), 6000);
setInterval(() => ctLoad(false), 60e3);
setInterval(() => { ctRemind(); const el = $('hClubT'); if (el && document.body.classList.contains('athome')) { const h = ctCardHtml(); if (el.innerHTML !== h) el.innerHTML = h; } }, 30e3);

/* ---- step 3: results, double dummy, the club's online rating, watching, PBN ----
   Everything is worked out from what the tables wrote (run/<start>/t/<table>/res/<board>) and the plan (pairs, rounds,
   the deals' seed): nothing more is kept. MP: each North-South score against the others on the same board (2 for
   better, 1 for equal), East-West the rest; IMP: against the board's average. The club rating starts at 1500 and moves
   after each evening by the pair's result (MP: (% − 50) × 0.6; IMP: IMP a board × 4). */
const CT_SN = ['♣', '♦', '♥', '♠', 'NT'];
// every evening of a club that has been played (or is being played): newest first
function ctRuns(club) {
  const out = [];
  for (const [c, L] of Object.entries(CT.all || {})) {
    if (club && c !== club) continue;
    for (const [id, t] of Object.entries(L || {})) for (const [d, run] of Object.entries((t && t.run) || {})) {
      if (run && run.plan) out.push({ club: c, id, d: +d, i: t.info || {}, plan: run.plan, run });
    }
  }
  return out.sort((a, b) => b.d - a.d);
}
function ctScore(x) {
  const P = x.plan, boards = {};
  P.rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => {
    const res = (((x.run.t || {})[r + '_' + ti]) || {}).res || {};
    for (const [bn, v] of Object.entries(res)) (boards[bn] || (boards[bn] = [])).push({ r, ti, ns: a, ew: b, v });
  }));
  const tot = P.pairs.map(() => ({ mp: 0, n: 0, imp: 0 })), imp = P.sc === 'imp' || x.i.sc === 'imp';
  for (const L of Object.values(boards)) {
    const avg = Math.round(L.reduce((s, q) => s + (q.v.ns || 0), 0) / L.length / 10) * 10;
    for (const q of L) {
      const o = L.filter(z => z !== q), mp = o.length ? o.reduce((s, z) => s + ((q.v.ns || 0) > (z.v.ns || 0) ? 2 : (q.v.ns || 0) === (z.v.ns || 0) ? 1 : 0), 0) / (2 * o.length) * 100 : 50;
      q.mp = mp; q.imp = E.imps((q.v.ns || 0) - avg);
      tot[q.ns].mp += mp; tot[q.ns].n++; tot[q.ns].imp += q.imp;
      tot[q.ew].mp += 100 - mp; tot[q.ew].n++; tot[q.ew].imp -= q.imp;
    }
  }
  const rank = P.pairs.map((p, k) => ({ k, p, n: tot[k].n, pct: tot[k].n ? tot[k].mp / tot[k].n : 0, imp: tot[k].imp }))
    .filter(r => r.n).sort((a, b) => imp ? b.imp - a.imp : b.pct - a.pct);
  return { boards, rank, imp };
}
// the club's online rating, from every evening in turn
function ctRating(club) {
  const R = {};
  for (const x of ctRuns(club).slice().reverse()) {
    const S = ctScore(x);
    for (const r of S.rank) {
      if (r.p.robot) continue;
      const delta = S.imp ? (r.n ? r.imp / r.n * 4 : 0) : (r.pct - 50) * 0.6;
      for (const [n, k] of [[r.p.a, r.p.ka], [r.p.b, r.p.kb]]) {
        if (!k) continue;
        const e = R[k] || (R[k] = { n, r: 1500, g: 0 }); e.r += delta; e.g++; e.n = n;
      }
    }
  }
  return Object.values(R).sort((a, b) => b.r - a.r);
}
const ctCon = v => v.pass ? T('Pass') : v.c ? v.c[0] + CT_SN[v.c[1]] + (v.c[2] === 2 ? 'XX' : v.c[2] ? 'X' : '') + ' ' + SEAT_AB[v.c[3]] : '—';
// the evening's results: the ranking, then each board with every table, the double dummy on request
function ctShowResults(club, id, d, tab) {
  const x = ctRuns(club).find(y => y.id === id && (!d || y.d === +d)); if (!x) { flash(T('No results yet.'), 2000); return; }
  CT.res = { club, id, d: x.d, tab: tab || CT.res && CT.res.tab || 'rank' };
  if (CT.res.tab === 'live' && !(x.i.watch || CT.adminView)) CT.res.tab = 'rank';   // watching only when the director allowed it (or for the director)
  const S = ctScore(x), P = x.plan, pn = p => p.robot ? '🤖 ' + T('Robot pair') : esc(p.a) + ' – ' + esc(p.b), t = CT.res.tab;
  const tabs = `<div class="seg" data-seg="ctrestab">${[['rank', '🏆 ' + T('Ranking')], ['boards', '🃏 ' + T('The boards')], ['rating', '🏅 ' + T('Club rating')], ...(x.i.watch || CT.adminView ? [['live', '👁 ' + T('Watch')]] : [])].map(([v, l]) => `<button data-ctres="${v}" class="${t === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (t === 'rank') body = S.rank.length ? `<table class="res"><thead><tr><th>#</th><th>${T('Pair')}</th><th>MP %</th><th>IMP</th><th>${T('Boards')}</th></tr></thead><tbody>${S.rank.map((r, k) => `<tr${[r.p.ka, r.p.kb].includes(ctMe()) ? ' class="me"' : ''}><td>${k + 1}</td><td>${pn(r.p)}</td><td>${S.imp ? '' : '<b>'}${r.pct.toFixed(1)}%${S.imp ? '' : '</b>'}</td><td>${S.imp ? '<b>' : ''}${fmtSigned(r.imp)}${S.imp ? '</b>' : ''}</td><td>${r.n}</td></tr>`).join('')}</tbody></table><div class="muted">${T('Ranked by {0}', S.imp ? 'IMP' : 'MP %')}</div>` : `<div class="muted">${T('No results yet.')}</div>`;
  else if (t === 'boards') body = Object.keys(S.boards).sort((a, b) => a - b).map(bn => `<div class="grp"><span>${T('Board {0}', bn)} <button class="btn mini-btn" data-ctdd="${bn}">🎯 ${T('Double dummy')}</button></span>
      <div id="ctdd${bn}"></div>
      <table class="res"><tbody>${S.boards[bn].map(q => `<tr><td>${pn(P.pairs[q.ns])}<br><small>${pn(P.pairs[q.ew])}</small></td><td>${ctCon(q.v)}${q.v.tr != null ? ' · ' + T('{0} tricks', q.v.tr) : ''}</td><td><b>${fmtSigned(q.v.ns || 0)}</b></td><td>${Math.round(q.mp)}%<br><small>${fmtSigned(q.imp)} IMP</small></td></tr>`).join('')}</tbody></table></div>`).join('') || `<div class="muted">${T('No results yet.')}</div>`;
  else if (t === 'rating') { const L = ctRating(club); body = L.length ? `<table class="res"><thead><tr><th>#</th><th>${T('Player')}</th><th>${T('Rating')}</th><th>${T('Evenings')}</th></tr></thead><tbody>${L.map((r, k) => `<tr><td>${k + 1}</td><td>${esc(r.n)}</td><td><b>${Math.round(r.r)}</b></td><td>${r.g}</td></tr>`).join('')}</tbody></table><div class="muted">${T('Everyone starts at 1500; each evening moves it by the pair\'s result.')}</div>` : `<div class="muted">${T('No results yet.')}</div>`; }
  else body = P.rounds.map((tb, r) => `<div class="grp"><span>${T('Round {0}', r + 1)}</span>${tb.map(([a, b], ti) => { const n = Object.keys((((x.run.t || {})[r + '_' + ti]) || {}).res || {}).length; return `<div class="row2" style="align-items:center"><span>${T('Table {0}', ti + 1)}: ${pn(P.pairs[a])} / ${pn(P.pairs[b])} · ${n}/${P.bpr}</span>${n < P.bpr ? `<button class="btn mini-btn" data-ctwatch="${r}_${ti}">👁 ${T('Watch')}</button>` : ''}</div>`; }).join('')}</div>`).join('');
  openOv('ctres', `<h2>📊 ${esc(x.i.n || '')}</h2><div class="muted">🏛 ${esc(x.i.cn || club)} · ${esc(ctWhen(x.d))}</div>${tabs}${body}
    <div class="row2"><button class="btn" data-ctpbn="1">⬇ PBN</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// a board's double dummy: tricks for each declarer and strain, and the best contract
// a board of an evening: the hands, the double dummy tricks and the best contract (also used by the clubs program)
function ctDDHtml(plan, bn) {
  {
    const x = { plan };
    const deal = ctDeal(x.plan, +bn), tab = [0, 1, 2, 3].map(dc => [0, 1, 2, 3, 4].map(st => E.ddContract(deal, { level: 1, strain: st, decl: dc, dbl: 0 })));
    const top = [null, null];
    for (let dc = 0; dc < 4; dc++) for (let st = 0; st < 5; st++) { const tr = tab[dc][st]; for (let l = 1; l <= tr - 6; l++) { const sc = E.scoreOf(l, st, 0, E.vulOf(+bn, dc), tr), sd = E.sideOf(dc); if (!top[sd] || sc > top[sd].sc) top[sd] = { sc, l, st, dc }; } }
    const nsB = top[0] ? top[0].sc : 0, ewB = top[1] ? top[1].sc : 0, best = nsB >= ewB ? (top[0] && { ...top[0], v: nsB }) : (top[1] && { ...top[1], v: -ewB });
    return (typeof dealHtml === 'function' ? dealHtml(deal, 2) : '') + (typeof ddTabHtml === 'function' ? ddTabHtml(tab) : '') + (best ? `<div class="muted">${T('Best contract (double dummy)')}: ${best.l}${CT_SN[best.st]} ${SEAT_AB[best.dc]} · ${fmtSigned(best.v)}</div>` : '');
  }
}
function ctDD(bn) {
  const r = CT.res, x = r && ctRuns(r.club).find(y => y.id === r.id && y.d === r.d), el = $('ctdd' + bn); if (!x || !el) return;
  el.innerHTML = '⏳'; setTimeout(() => { el.innerHTML = ctDDHtml(x.plan, bn); }, 30);
}
// the evening's deals as a PBN file
function ctPBN() {
  const r = CT.res, x = r && ctRuns(r.club).find(y => y.id === r.id && y.d === r.d); if (!x) return;
  const RK = '23456789TJQKA', hand = h => [3, 2, 1, 0].map(s => h.filter(c => (c / 13 | 0) === s).map(c => RK[c % 13]).sort((a, b) => RK.indexOf(b) - RK.indexOf(a)).join('')).join('.');
  const V = ['None', 'NS', 'EW', 'All'], vul = bn => { const ns = E.vulOf(bn, 0), ew = E.vulOf(bn, 1); return V[(ns ? 1 : 0) + (ew ? 2 : 0)]; };
  const n = x.plan.rounds.length * x.plan.bpr, out = [];
  for (let bn = 1; bn <= n; bn++) { const d = ctDeal(x.plan, bn), dl = E.dealerOf(bn); out.push(`[Event "${String(x.i.n || '').replace(/"/g, "'")}"]\n[Date "${new Date(x.d).toISOString().slice(0, 10).replace(/-/g, '.')}"]\n[Board "${bn}"]\n[Dealer "${'NESW'[dl]}"]\n[Vulnerable "${vul(bn)}"]\n[Deal "N:${[0, 1, 2, 3].map(s => hand(d[s])).join(' ')}"]\n`); }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/plain' })); a.download = (x.i.n || 'club') .replace(/[^\w-]+/g, '_') + '-' + new Date(x.d).toISOString().slice(0, 10) + '.pbn'; a.click();
}
// watching a table (its round still going): the game read from the list as the players see it, every hand open
async function ctWatch(tid) {
  const r = CT.res, x = r && ctRuns(r.club).find(y => y.id === r.id && y.d === r.d); if (!x) return;
  const [rr, ti] = tid.split('_').map(Number);
  clearInterval(CT.pollT); clearInterval(CT.beatT);
  CT.tbl = { key: r.club + '|' + r.id, id: r.id, d: r.d, p: 'ot/' + encodeURIComponent(r.club) + '/' + encodeURIComponent(r.id) + '/run/' + r.d, plan: x.plan, r: rr, ti, tid, seats: ctSeatsOf(x.plan, rr, ti), seat: 2, boards: ctBoards(x.plan, rr), n: 0, hb: {}, name: x.i.n, rounds: x.plan.rounds.length, watch: true };
  closeOv(); await ctRebuild(); CT.pollT = setInterval(ctPoll, 2000);
  flash('👁 ' + T('Round {0} · table {1}', rr + 1, ti + 1), 2000);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ctres],[data-ctdd],[data-ctpbn],[data-ctwatch],[data-ctresopen]'); if (!t) return;
  if (t.dataset.ctresopen) { const [c, i] = t.dataset.ctresopen.split('|'); ctShowResults(c, i); }
  else if (t.dataset.ctres && CT.res) ctShowResults(CT.res.club, CT.res.id, CT.res.d, t.dataset.ctres);
  else if (t.dataset.ctdd) ctDD(t.dataset.ctdd);
  else if (t.dataset.ctpbn) ctPBN();
  else if (t.dataset.ctwatch) ctWatch(t.dataset.ctwatch);
});
