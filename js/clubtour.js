/* BridgePlay — online club tournaments (set up by a club's director in the Clubs program, played here by pairs
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
    if (t.info.test && ctMe() !== 'servet') continue;   // Servet's robot test
    if (d + 4 * 3600e3 < Date.now() || d - Date.now() > 14 * 864e5) continue;
    const pairs = Object.entries(t.pairs || {}).filter(([, p]) => p && p.d === d).map(([pid, p]) => ({ pid, ...p }));
    const seek = Object.entries(t.seek || {}).filter(([, p]) => p && p.d === d).map(([k, p]) => ({ k, ...p }));
    const run = (t.run || {})[d] || null;
    out.push({ club, id, i: t.info, d, pairs, seek, run, plan0: run && run.plan || null, plan: run && run.plan ? ctFill(ctSeatsApply(run.plan, run.seats), run.t) : null });
  }
  return out.sort((a, b) => a.d - b.d);
}
const ctMe = () => Net.ruleKey(myNm() || '');
/* an open evening (🌐 Online, started at once by the club's director): no registration — every pair of the plan starts
   empty (the robots play it) and a player takes an empty seat (run/<d>/seats/<pair>_<a|b> = { n, k, ts }); the seat stays
   theirs, and a seat whose player has been away for 10 minutes is free again. The plan's pairs with the seats on them: */
function ctSeatsApply(plan, seats) {
  if (!plan || !seats) return plan;
  const P = plan.pairs.map(p => ({ ...p }));
  for (const [id, v] of Object.entries(seats)) { const m = /^(\d+)_([ab])$/.exec(id), p = m && P[+m[1]]; if (!p || !v || !v.k) continue; p[m[2]] = String(v.n || '').slice(0, 20); p['k' + m[2]] = v.k; if (typeof v.sys === 'string' && !p.sys) { p.sys = v.sys.slice(0, 12); p.conv = Array.isArray(v.conv) ? v.conv.slice(0, 80) : []; } }   // the pair bids the card of its (first) player
  return { ...plan, pairs: P };
}
const ctMine = x => x.pairs.find(p => p.ka === ctMe() || p.kb === ctMe());
/* the plan of the evening, made once when the start time has come (by the first app of a registered player that sees
   it; the database keeps only the first): the pairs in the order they registered (an odd number gets a robot pair), and
   the rounds by the circle method — every pair meets another pair each round, every table of a round plays the same
   boards (so each board is compared across all the tables). m: who sits at each table (the database lets only them
   write that table). The deals come from the plan's seed, the same on every device. */
function ctSeed(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
// the board sets of a Howell or Mitchell evening: bs[round][table] = its set (boards set*bpr+1 …). No pair meets a set
// twice; the tables of a round play different sets where they can.
// Each table of the evening is an edge between its two pairs. Every pair plays every set once, so a set is a perfect
// matching of the pairs: the sets are taken one by one, each a perfect matching of the tables still free, its tables
// from rounds that do not have it yet where it can; a dead end starts again in another order. Then two sets are swapped
// along chains of tables (Kempe chains: no pair meets a set twice still) while fewer tables of a round share one.
// Seeded: every app finds the same sets
function ctBoardSets(rounds, n, seed) {
  const R = rounds.length;
  let h = (seed >>> 0) || 1; const rnd = () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clashes = bs => bs.reduce((k, row) => k + row.length - new Set(row).size, 0);
  const E0 = []; rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => E0.push({ r, ti, a, b })));
  // the sets as perfect matchings, one after the other
  const build = () => {
    const free = new Set(E0), bs = rounds.map(tb => tb.map(() => -1));
    for (let s = 0; s < R; s++) {
      const inc = [...Array(n)].map(() => []); for (const e of free) { inc[e.a].push(e); inc[e.b].push(e); }
      const taken = new Array(n).fill(false), rUsed = new Map(), pick = []; let steps = 0;
      const go = () => {
        let v = -1, best = null;   // the pair with the fewest tables left first
        for (let p = 0; p < n; p++) if (!taken[p]) { const o = inc[p].filter(e => !taken[e.a === p ? e.b : e.a]); if (!best || o.length < best.length) { v = p; best = o; if (!o.length) break; } }
        if (v < 0) return true;
        if (!best.length || ++steps > 4000) return false;
        shuffle(best).sort((x, y) => (rUsed.get(x.r) || 0) - (rUsed.get(y.r) || 0));   // a round without this set first
        for (const e of best) {
          const w = e.a === v ? e.b : e.a; taken[v] = taken[w] = true; rUsed.set(e.r, (rUsed.get(e.r) || 0) + 1); pick.push(e);
          if (go()) return true;
          taken[v] = taken[w] = false; rUsed.set(e.r, rUsed.get(e.r) - 1); pick.pop();
        }
        return false;
      };
      if (!go()) return null;
      for (const e of pick) { free.delete(e); bs[e.r][e.ti] = s; }
    }
    return bs;
  };
  // fewer tables of a round sharing a set: Kempe chains of two sets swapped
  const improve = bs0 => {
    const E = E0.map(e => ({ ...e, c: bs0[e.r][e.ti] }));
    const at = [...Array(n)].map(() => new Map()); for (const e of E) { at[e.a].set(e.c, e); at[e.b].set(e.c, e); }
    const cnt = rounds.map(() => new Map()); for (const e of E) cnt[e.r].set(e.c, (cnt[e.r].get(e.c) || 0) + 1);
    const share = (r, c) => Math.max(0, (cnt[r].get(c) || 0) - 1), move = (x, from, to) => { cnt[x.r].set(from, cnt[x.r].get(from) - 1); cnt[x.r].set(to, (cnt[x.r].get(to) || 0) + 1); };
    let cost = clashes(bs0);
    for (let it = 0; it < 6000 && cost > 0; it++) {
      const e = E[Math.floor(rnd() * E.length)], d = Math.floor(rnd() * R), c = e.c; if (d === c) continue;
      const chain = new Set([e]), todo = [e];
      while (todo.length) { const x = todo.pop(); for (const p of [x.a, x.b]) for (const k of [c, d]) { const y = at[p].get(k); if (y && !chain.has(y)) { chain.add(y); todo.push(y); } } }
      const rs = new Set([...chain].map(x => x.r)); let before = 0, after = 0;
      for (const r of rs) before += share(r, c) + share(r, d);
      for (const x of chain) move(x, x.c, x.c === c ? d : c);
      for (const r of rs) after += share(r, c) + share(r, d);
      if (after <= before) {
        for (const x of chain) { at[x.a].delete(x.c); at[x.b].delete(x.c); }
        for (const x of chain) { x.c = x.c === c ? d : c; at[x.a].set(x.c, x); at[x.b].set(x.c, x); }
        cost += after - before;
      } else for (const x of chain) move(x, x.c === c ? d : c, x.c);
    }
    const bs = rounds.map(tb => tb.map(() => -1)); for (const e of E) bs[e.r][e.ti] = e.c; return bs;
  };
  const floor = rounds.reduce((k, tb) => k + Math.max(0, tb.length - R), 0);   // more tables than sets: some must share
  let best = null;
  for (let a = 0; a < 12 && !(best && clashes(best) <= floor); a++) { const b = build(); if (b) { const v = improve(b); if (!best || clashes(v) < clashes(best)) best = v; } }
  return best || improve(rounds.map((tb, r) => tb.map(() => r)));   // none found: from every round on one set
}
// a table's boards: its own set (Howell, Mitchell), else the round's
const ctSetOf = (plan, r, ti) => ti != null && plan.bs && plan.bs[r] && plan.bs[r][ti] != null && plan.bs[r][ti] >= 0 ? plan.bs[r][ti] : r;
function ctMakePlan(x) {
  const P = x.pairs.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0) || String(a.pid).localeCompare(String(b.pid))).map(p => ({ a: p.a, b: p.b, ka: p.ka, kb: p.kb, ...(p.sys ? { sys: p.sys } : {}) }));
  // an open evening: as many empty pairs as the players asked for (an even number), the players sit down later
  if (x.i && x.i.open) { P.length = 0; const n0 = Math.max(2, Math.ceil((+x.i.np || 8) / 2)); for (let k = 0; k < n0 + (n0 % 2); k++) P.push({ a: '', b: '', ka: '', kb: '', open: 1 }); }
  if (P.length < 1) return null;   // one pair plays the robot pair
  if (P.length % 2) P.push({ a: 'Robot', b: 'Robot', ka: '', kb: '', robot: 1 });
  const n = P.length, R = Math.max(1, Math.floor((+x.i.b || 18) / (+x.i.bpr || 3)));   // after everyone has met everyone the circle goes on (the same opponents, other boards)
  const rounds = []; let arr = [...Array(n).keys()];
  if (x.i.mov === 'mitchell') { const tn = n / 2; for (let r = 0; r < R; r++) rounds.push([...Array(tn).keys()].map(i => [i, tn + (i + r) % tn])); }
  else for (let r = 0; r < R; r++) {
    const tb = []; for (let i = 0; i < n / 2; i++) { let a = arr[i], b = arr[n - 1 - i]; if (i > 0 && (r + i) % 2) [a, b] = [b, a]; tb.push([a, b]); }   // table 1: the first pair North-South every round (it never moves)
    rounds.push(tb); arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const m = {}; rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => { const id = r + '_' + ti; m[id] = {}; for (const k of [P[a].ka, P[a].kb, P[b].ka, P[b].kb]) if (k) m[id][k] = 1; }));
  // Servet's test: whoever plays in it may write at every table (his app plays the robots of the empty ones)
  if (x.i && x.i.test) { const ks = P.flatMap(p => [p.ka, p.kb]).filter(Boolean); for (const id of Object.keys(m)) for (const k of ks) m[id][k] = 1; }
  let nr;
  if (x.i.mov === 'swiss') {   // Swiss: the first round drawn, the others made from the standings; every player may write at any table
    E.seed(ctSeed(x.id + ':' + x.d + ':swiss') || 1); const o = E.shuffle([...Array(n).keys()]); E.seed(null); nr = rounds.length;
    rounds.length = 0; rounds.push([...Array(n / 2).keys()].map(i => [o[2 * i], o[2 * i + 1]]));
    const all = {}; for (const p of P) for (const k of [p.ka, p.kb]) if (k) all[k] = 1;
    for (const k of Object.keys(m)) delete m[k]; for (let r = 0; r < nr; r++) for (let ti = 0; ti < n / 2; ti++) m[r + '_' + ti] = { ...all };
  }
  const bs = !nr && rounds.length > 1 && rounds[0].length > 1 && ['howell', 'mitchell'].includes(x.i.mov || 'howell') ? ctBoardSets(rounds, n, ctSeed(x.id + ':' + x.d + ':sets')) : null;
  return { plan: { pairs: P, rounds, ...(nr ? { nr } : {}), ...(bs ? { bs } : {}), mov: x.i.mov || 'howell', bpr: +x.i.bpr || 3, sys: x.i.sys, conv: x.i.conv || [], sc: x.i.sc, seed: ctSeed(x.id + ':' + x.d), ...(Array.isArray(x.i.deals) && x.i.deals.length ? { deals: x.i.deals } : {}), at: Date.now() }, m };
}
// the plan with the Swiss rounds that can be made now (from what the tables played)
// an online evening as the club's own tournament (the Clubs admin's tabs)
function ctMirror(plan, info, tmap, at, tid) { return window.CTMIR ? CTMIR.build(E, plan, info, tmap, at, tid) : null; }
function ctFill(plan, tmap) { return plan && plan.mov === 'swiss' && window.CTSW ? CTSW.fill(plan, tmap, E) : plan; }
async function ctEnsurePlan(x) {
  if (x.plan || x.d > Date.now() || !ctMine(x) || CT.planning) return;
  const p = ctMakePlan(x); if (!p) return;
  CT.planning = true;
  try { await ctSession(); await Net.Cloud.patch(ctPath(x, '/run/' + x.d), p); } catch (e) {}   // another app was first: its plan stays
  finally { CT.planning = false; await ctLoad(true); }
}
// a board of the evening: the deal from the plan's seed (board 1, 2 … with the usual dealer and vulnerability)
function ctPbnDeal(str) { const m = /^([NESW]):\s*(.+)$/.exec(String(str || '').trim()); if (!m) return null; const first = 'NESW'.indexOf(m[1]), hs = m[2].trim().split(/\s+/); if (hs.length !== 4) return null; const out = [[], [], [], []], RK = '23456789TJQKA'; hs.forEach((h, k) => { const ss = h.split('.'); if (ss.length !== 4) return; ss.forEach((cs, j) => { for (const ch of cs.toUpperCase().replace('10', 'T')) { const r = RK.indexOf(ch); if (r >= 0) out[(first + k) % 4].push((3 - j) * 13 + r); } }); }); return out.every(h => h.length === 13) ? out.map(h => h.sort((a, b) => b - a)) : null; }
// a board: from the club's hand file when the evening has one (a dealing machine's set), else from the evening's seed
function ctDeal(plan, board) { const f = plan.deals && ctPbnDeal(plan.deals[board - 1]); if (f) return f; E.seed(((plan.seed >>> 0) + board * 7919) >>> 0 || 1); const d = E.shuffle([...Array(52).keys()]); E.seed(null); return [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13).sort((a, b) => b - a)); }
// where a pair plays: each round its table, direction, opponents and boards
function ctSched(plan, pi) {
  const out = [];
  plan.rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => {
    if (a !== pi && b !== pi) return;
    const ns = a === pi, opp = plan.pairs[ns ? b : a];
    const s = ctSetOf(plan, r, ti); out.push({ r, ti, ns, opp, from: s * plan.bpr + 1, to: s * plan.bpr + plan.bpr });
  }));
  return out;
}
const ctMyPair = plan => { const me = ctMe(); return me ? plan.pairs.findIndex(p => p.ka === me || p.kb === me) : -1; };   // a robot's empty key is nobody's
const ctPairTxt = p => p.robot || (!p.ka && !p.kb && !p.a && !p.b) ? '🤖 ' + T('Robot pair') : esc(p.a || '🤖') + ' – ' + esc(p.b || '🤖');
// the home page card: each tournament coming up, its countdown and whether you are registered
// a club's evening to show: the one being played, else the soonest
const ctFirst = L => L.slice().sort((a, b) => (b.d <= Date.now()) - (a.d <= Date.now()) || a.d - b.d)[0];
function ctOnePerClub(L) { const by = {}; for (const x of L) (by[x.club] || (by[x.club] = [])).push(x); return Object.values(by).map(ctFirst).sort((a, b) => a.d - b.d); }
function ctCardHtml() {
  const L = ctOnePerClub(ctList()); if (!L.length || !myNm()) return '';
  return L.slice(0, 3).map(x => {
    const mine = ctMine(x), seeking = x.seek.some(s => s.k === ctMe()), started = x.d <= Date.now();
    if (started && !x.plan) ctEnsurePlan(x);
    if (x.i.open && x.plan) return `<button class="hcard ctcard short reg" data-ct="${esc(x.club + '|' + x.id)}"><b>🏛 ${esc(x.i.cn || x.club)} <span class="ctonl">🟢 Online</span> ${T('Sit down')}<i class="ctmore">›</i></b></button>`;
    return `<button class="hcard ctcard short${mine ? ' reg' : ''}" data-ct="${esc(x.club + '|' + x.id)}"><b>🏛 ${esc(x.i.cn || x.club)} <span class="ctonl">Online</span><i class="ctmore">›</i></b></button>`;
  }).join('');
}
const nameKeyEq = n => Net.ruleKey(n || '') === ctMe();
const ctFind = key => { const [club, id] = String(key).split('|'); return ctList().find(x => x.club === club && x.id === id); };
// the tournament's window: what is played, the pairs, and register / look for a partner / cancel
function ctShow(key, err) {
  const x = ctFind(key); if (!x) { closeOv(); return; }
  if (x.i.open && x.plan) return ctShowOpen(key, x, err);
  const i = x.i, mine = ctMine(x), seeking = x.seek.some(s => s.k === ctMe());
  const convs = (i.conv || []).map(k => typeof pracName === 'function' ? pracName(k) : k).join(', ');
  const sys = E.sysOf(i.sys) ? E.sysOf(i.sys).n : i.sys;
  const names = typeof Net.knownNames === 'function' ? Net.knownNames() : [];
  openOv('ctour', `<h2>🏛 ${esc(i.cn || x.club)}</h2><div class="big">${esc(i.n)}</div>
    <div class="grp"><span>${T('When')}</span><b>${esc(ctWhen(x.d))}</b><div>${[i.rep ? '🔁 ' + T('every week') : '', x.d > Date.now() ? '⏳ ' + ctLeft(x.d) : '🟢 ' + T('Started')].filter(Boolean).join(' · ')}</div></div>
    <div class="grp"><span>${T('What is played')}</span>${T('{0} boards', i.b)} · ${T('{0} boards a round', i.bpr)} · ${(i.sc === 'imp' ? 'IMP' : i.sc === 'both' ? 'IMP - MP' : 'MP')} · ${T('pairs against each other')}
      <div><b>${esc(sys)}</b>${convs ? ' · ' + esc(convs) : ''}</div><div class="muted">${T('Always played')}: ${esc(PRAC_BASICS.map(pracName).join(', '))}</div><div class="muted">${T('Everyone bids with this card, the robots too.')}</div></div>
    <div class="grp"><span>${T('Pairs registered')} (${x.pairs.length}${i.np ? ' / ' + Math.floor(i.np / 2) : ''})</span>${x.pairs.length ? x.pairs.map((p, k) => `<div>${k + 1}. ${esc(p.a)} – ${esc(p.b)}</div>`).join('') : `<div class="muted">${T('Nobody yet.')}</div>`}</div>
    ${x.seek.length ? `<div class="grp"><span>🔎 ${T('Looking for a partner')}</span>${x.seek.map(s => esc(s.n)).join(', ')}<div class="muted">${T('Write to one of them, or the director pairs you.')}</div></div>` : ''}
    ${x.plan ? ctPlanHtml(x) : x.d <= Date.now() ? `<div class="grp"><span>🪑 ${T('Tables')}</span><div class="muted">${!x.pairs.length ? T('Nobody yet.') : '⏳ ' + T('The tables are being made…')}</div></div>` : ''}
    ${err ? `<div class="err">${esc(err)}</div>` : ''}
    ${x.d <= Date.now() && !mine ? `<div class="row2">` : mine ? `<div class="okmsg">✅ ${T('You are registered with {0}', esc(nameKeyEq(mine.a) ? mine.b : mine.a))}</div><div class="row2">${x.d > Date.now() ? `<button class="btn" data-ctcancel="${esc(key)}">${T('Cancel the registration')}</button>` : ''}`
      : `<div class="grp"><span>✍️ ${T('Register as a pair')}</span><input id="ctPartner" class="tok wide" list="ctNames" maxlength="20" placeholder="${T('Your partner\'s name')}"><datalist id="ctNames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="muted">${T('Your partner needs a name in BridgePlay (the same name they sign in with).')}</div></div>
        <div class="row2"><button class="btn new" data-ctreg="${esc(key)}">✍️ ${T('Register')}</button><button class="btn" data-ctrobot="${esc(key)}">🤖 ${T('Register with a robot partner')}</button><button class="btn" data-ctseek="${esc(key)}">${seeking ? '✖ ' + T('I no longer look for a partner') : '🔎 ' + T('I am looking for a partner')}</button>`}
      <button class="btn" data-ctadmin="${esc(key)}">⚙️ ${T('Admin')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
}
async function ctSession() { const n = myNm(); if (!n || !SET.pinH) throw new Error('signin'); if (!(await Net.Cloud.session(n, SET.pinH))) throw new Error('signin'); }
const ctPath = (x, p) => 'ot/' + encodeURIComponent(x.club) + '/' + encodeURIComponent(x.id) + p;
// robot: a player who wants to play with a robot partner (it bids with the tournament's card)
async function ctRegister(key, robot) {
  const x = ctFind(key), inp = $('ctPartner'), b = robot ? T('Robot') : (inp && inp.value || '').trim().slice(0, 20); if (!x || CT.busy) return;
  if (!b) { ctShow(key, T('Write your partner\'s name')); return; }
  if (!robot && Net.ruleKey(b) === ctMe()) { ctShow(key, T('Your partner cannot be you')); return; }
  if (x.i.np && x.pairs.length * 2 >= x.i.np) { ctShow(key, T('The tournament is full ({0} players).', x.i.np)); return; }
  if (!robot && x.pairs.some(p => p.ka === Net.ruleKey(b) || p.kb === Net.ruleKey(b))) { ctShow(key, T('{0} is already registered with another partner', b)); return; }
  CT.busy = true;
  try {
    if (!robot && !(await Net.Cloud.exists(b))) { ctShow(key, T('There is no player called {0} in BridgePlay', b)); return; }
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
  const res = `<div class="row2"><button class="btn gold" data-ctresopen="${esc(x.club + '|' + x.id)}" data-cttab="pair">🔀 ${T('Pairings')}</button></div>`;
  return sit + mineH + all + res + `<div class="muted">${T('{0} rounds of {1} boards; every table of a round plays the same boards.', P.nr || P.rounds.length, P.bpr)}${P.mov === 'swiss' ? ' ' + T('Swiss: each next round is made from the standings when every table has finished.') : ''}</div>`;
}
// an open evening: this round's tables, each seat its player or an empty seat (the robot plays it) to sit down at
function ctShowOpen(key, x, err) {
  const P = x.plan, r = Math.max(0, ctCurRound(P, x.run && x.run.t)), hb = (x.run && x.run.hb) || {}, me = ctMe(), pi = ctMyPair(P);
  const away = k => !k || Date.now() - (+hb[k] || 0) > 600e3;
  const seat = (ti, pIdx, w, label) => { const p = P.pairs[pIdx], k = w ? p.kb : p.ka, n = w ? p.b : p.a;
    if (k && k === me) return `<div class="ctseat me"><small>${label}</small><b>${esc(n)}</b></div>`;
    if (k && !away(k)) return `<div class="ctseat"><small>${label}</small><b>${esc(n)}</b></div>`;
    return pi >= 0 ? `<div class="ctseat free"><small>${label}</small><b>${T('Free seat')}</b></div>` : `<button class="ctseat free" data-ctopen="${esc(key + '|' + pIdx + '|' + (w ? 'b' : 'a') + '|' + r)}"><small>${label}</small><b>🪑 ${T('Sit down')}</b></button>`; };
  const tables = P.rounds[r].map(([a, b], ti) => `<div class="grp"><span>${T('Table {0}', ti + 1)}</span><div class="ctseats">${seat(ti, a, 1, SEAT[0])}${seat(ti, b, 0, SEAT[1])}${seat(ti, a, 0, SEAT[2])}${seat(ti, b, 1, SEAT[3])}</div></div>`).join('');
  openOv('ctour', `<h2>🏛 ${esc(x.i.cn || x.club)} <span class="ctonl">🟢 Online</span></h2><div class="big">${esc(x.i.n)}</div>
    <div class="muted">${T('Round {0} of {1}', r + 1, P.nr || P.rounds.length)} · ${T('Empty seats are played by robots: tap one to take it.')}</div>
    ${pi >= 0 ? `<div class="row2"><button class="btn new" data-ctsit="${esc(key)}">🪑 ${T('Sit down at your table')}</button></div>` : ''}
    ${tables}${err ? `<div class="err">${esc(err)}</div>` : ''}
    <div class="row2"><button class="btn gold" data-ctresopen="${esc(key)}" data-cttab="pair">🔀 ${T('Pairings')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// a free seat taken: written as this player's (the database lets a seat be taken while it is empty, or its player has
// been away for 10 minutes), then the table of the round
async function ctTakeSeat(v) {
  const [club, id, pIdx, w, r] = v.split('|'), key = club + '|' + id, x = ctFind(key); if (!x) return;
  try {
    await ctSession();
    const p = ctRunP(x) + '/seats/' + pIdx + '_' + w, cur = await Net.Cloud.get(p), hb = await Net.Cloud.get(ctRunP(x) + '/hb') || {};
    if (cur && cur.k && cur.k !== ctMe() && Date.now() - (+hb[cur.k] || 0) < 600e3) { await ctLoad(true); return ctShow(key, T('Someone has just taken this seat.')); }
    await Net.Cloud.put(p, { n: String(myNm()).slice(0, 20), k: ctMe(), ts: Date.now(), sys: SET.sys || 'twoone', conv: Object.keys(SET.conv || {}).filter(c => SET.conv[c]) });
    Net.Cloud.put(ctRunP(x) + '/kick/' + ctMe(), null).catch(() => {});
  } catch (e) { return ctShow(key, T('Could not send — sign in with your name and PIN first.')); }
  await ctLoad(true); ctSit(key, +r);
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
function ctCardOf(sys, conv) { const k = E.sysOf(sys).k, c = { ...E.sysOf(k).conv }; for (const x of conv || []) c[x] = true; return { conv: c, agg: 0, sys: k }; }
function ctCardsOf(plan, r, ti) { const t = r != null && plan.rounds[r] && plan.rounds[r][ti], P = t ? [plan.pairs[t[0]], plan.pairs[t[1]]] : []; return [0, 1].map(k => P[k] && P[k].sys ? ctCardOf(P[k].sys, P[k].conv || []) : ctCardOf(plan.sys, plan.conv)); }
// the four seats of a table: the North-South pair's first player South, the partner North; East-West: first East
// a robot's name at an open evening's empty seat: a first name, the same all evening
function ctBotNm(plan, pi, w) { const L = (typeof BOT_NAMES !== 'undefined' && (BOT_NAMES[SET.lang] || BOT_NAMES.en)) || ['Robot']; return L[((plan.seed >>> 0) + pi * 2 + (w ? 1 : 0) * 7) % L.length]; }
function ctSeatsOf(plan, r, ti) {
  const [ns, ew] = plan.rounds[r][ti], A = plan.pairs[ns], B = plan.pairs[ew];
  const s = (p, w) => p.robot ? { n: T('Robot'), k: '' } : { n: (w ? p.b : p.a) || ctBotNm(plan, plan.pairs.indexOf(p), w), k: w ? p.kb : p.ka };   // an empty seat of an open evening: a robot with a name
  return [s(A, 1), s(B, 0), s(A, 0), s(B, 1)];
}
const ctBoards = (plan, r, ti) => { const s = ctSetOf(plan, r, ti); return [...Array(plan.bpr).keys()].map(i => s * plan.bpr + i + 1); };
// who decides a seat now: its player (present), else the robots of the runner's device; dummy goes with declarer
function ctPresent(k) { const t = CT.tbl; return !!k && (k === ctMe() || (t && t.hb && !(t.kick && t.kick[k]) && Date.now() - (+t.hb[k] || 0) < CT_AWAY)); }
function ctRunner() { const t = CT.tbl; if (!t) return ''; const ks = t.seats.map(s => s.k).filter(ctPresent).sort(); return ks[0] || ctMe(); }
function ctSeatKey(seat) {
  const t = CT.tbl; if (!t || !G) return '';
  let s = seat;
  if (G.play && G.phase === 'play') { const c = G.play.contract, dummy = (c.decl + 2) % 4; if (s === dummy) s = c.decl; }
  return t.seats[s].k;
}
const ctBack = () => { const t = CT.tbl; return !!(t && t.waitI != null && G && G.ct && G.ct.i === t.waitI && G.phase !== 'done'); };
function ctWho(seat) {
  const t = CT.tbl; if (!t || !G) return '';
  const k = ctSeatKey(seat);
  if (k && k === ctMe() && ctBack()) return 'robot';   // back after a drop: the robot finishes this board for you
  return ctPresent(k) ? k : 'robot';
}
const ctControls = seat => !(CT.tbl && CT.tbl.watch) && ctWho(seat) === ctMe();
// a robot seat played on this device: the runner's, and your own seat while the robot finishes your board
const ctRobotHere = seat => !(CT.tbl && CT.tbl.watch) && ctWho(seat) === 'robot' && (ctRunner() === ctMe() || (ctBack() && ctSeatKey(seat) === ctMe()));
// the board the robot finished for you is over: your seat again
function ctBackCheck() {
  const t = CT.tbl; if (!t || t.waitI == null || ctBack()) return;
  t.waitI = null; flash('🪑 ' + T('You are in your seat again.'), 3500);
}
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
  try { newBoard(ctDeal(t.plan, bn), bn, null, { id: 'ct' + t.id + t.d + '-' + bn, ct: { i, seat: t.seat, seats: t.seats.map(s => s.n), name: t.name, key: t.key, r: t.r }, cards: ctCardsOf(t.plan, t.r, t.ti) }); } finally { CT.replay = false; }
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
    ctBackCheck();
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
  try { t.kick = await Net.Cloud.get(t.p + '/kick') || {}; } catch (e) {}
  if (t.kick && t.kick[ctMe()] && !t.watch) { flash('🚪 ' + T('You were taken off the table: a robot plays your seat. Sit down again to come back.'), 5000); if (typeof goHome === 'function') goHome(); else ctLeave(); return; }
  if (t.plan0) try { t.plan = ctFill(ctSeatsApply(t.plan0, await Net.Cloud.get(t.p + '/seats')), await Net.Cloud.get(t.p + '/t')); t.seats = ctSeatsOf(t.plan, t.r, t.ti); } catch (e) {}   // an open evening: who sits where now
  if (ctBack()) flash('⏳ ' + T('Wait: the robot is finishing this board for you. You take your seat when it is over.'), 4000);
  ctMyScore();
  if (G && G.ct) tick();   // a player gone (or back): the robots take the seat (or give it back)
}
// sit down at your table of the round (the first round not finished); the whole list is read, so it also brings back
// a table after a drop or another device
async function ctSit(key, r0) {
  const x = ctFind(key); if (!x || !x.plan) return;
  const pi = ctMyPair(x.plan); if (pi < 0) return;
  const S = ctSched(x.plan, pi), r = r0 != null ? r0 : +(localStorage.getItem('ct-r-' + x.id + x.d) || 0);
  let s = S.find(q => q.r === r);
  if (!s && x.plan.mov === 'swiss' && r > 0 && r < (x.plan.nr || 0)) { flash('⏳ ' + T('The next round is being made from the standings…'), 2500); setTimeout(() => ctLoad(true).then(() => ctSit(key, r)), 5000); return; }
  s = s || S[0];
  if (!s) return;
  try { await ctSession(); } catch (e) { flash(T('Could not send — sign in with your name and PIN first.'), 2500); return; }
  const seats = ctSeatsOf(x.plan, s.r, s.ti), seat = seats.findIndex(q => q.k === ctMe());
  clearInterval(CT.pollT); clearInterval(CT.beatT);
  CT.tbl = { key, id: x.id, d: x.d, p: ctRunP(x), plan: x.plan, plan0: x.i.open ? x.plan0 : null, r: s.r, ti: s.ti, tid: s.r + '_' + s.ti, seats, seat, boards: ctBoards(x.plan, s.r, s.ti), n: 0, hb: {}, name: x.i.n, rounds: x.plan.nr || x.plan.rounds.length };
  try { localStorage.setItem('ct-r-' + x.id + x.d, String(s.r)); } catch (e) {}
  CT.sc = null; closeOv();
  let hb0 = 0; try { hb0 = +(await Net.Cloud.get(CT.tbl.p + '/hb/' + Net.fbKey(myNm()))) || 0; } catch (e) {}
  const away = Date.now() - hb0 > CT_AWAY;
  await ctBeat(); await ctRebuild();
  const t = CT.tbl;
  if (t && away && G && G.ct && G.phase !== 'done' && t.n > 0 && (G.auction.length || G.play)) {
    t.waitI = G.ct.i; flash('⏳ ' + T('Wait: the robot is finishing this board for you. You take your seat when it is over.'), 5000); tick(); return CT.pollT = setInterval(ctPoll, 1500), CT.beatT = setInterval(ctBeat, 20e3);
  }
  CT.pollT = setInterval(ctPoll, 1500); CT.beatT = setInterval(ctBeat, 20e3);
  flash('🪑 ' + T('Round {0} · table {1}', s.r + 1, s.ti + 1), 2500);
}
/* Servet's online test with the BridgeScore (the test tournament's "I use the BridgeScore"): after each board at his table
   the result is entered as on a club's BridgeScore — contract, declarer, lead, tricks — the score shown, the opponents
   (robots) approve, and the entry is checked against the board as it was played; at the end of the round the
   BridgeScore's move screen (the next table, the seat, the opponents, the boards). For trying the BridgeScore only: the
   evening's results come from the play itself */
const ctBmOn = () => { const t = CT.tbl, x = t && ctFind(t.key); return !!(x && x.i && x.i.bm && !t.watch); };
const CT_BM = { e: null, then: null, v: null, done: false };
function ctBmShow(e, then) {
  CT_BM.e = e; CT_BM.then = then; CT_BM.v = { lvl: 0, st: -1, dbl: 0, decl: -1, tr: null, ls: -1, lr: -1, pass: false }; CT_BM.step = 'contract';
  ctBmDraw();
}
// the board as it was played at this table, in words (the test shows it above the keys, so the score can be entered)
function ctBmPlayed(e) {
  if (!e || e.passed) return T('Pass');
  const rc = e.c, rl = e.pl && e.pl[0] && e.pl[0][0];
  return rc ? rc.level + (rc.strain === 4 ? 'NT' : ctBmS(rc.strain)) + (rc.dbl === 2 ? ' XX' : rc.dbl ? ' X' : '') + ' ' + SEAT_AB[rc.decl] + (rl ? ' · ' + T('Lead') + ' ' + RTXT[R(rl[1])] + ctBmS(S(rl[1])) : '') + ' · ' + T('{0} tricks', e.tricks) : '';
}
function ctBmScore(v, bn) {
  if (v.pass) return 0;
  const sc = scoreOf(v.lvl, v.st, v.dbl, vulOf(bn, v.decl), v.tr);
  return sideOf(v.decl) === 0 ? sc : -sc;
}
// the BridgeScore's frame: the bar (the evening, the table and round), the board, its vulnerability and the pairs
function ctBmHead(bn) {
  const t = CT.tbl, x = ctFind(t.key) || { i: {} }, tb = (t.plan.rounds[t.r] || [])[t.ti] || [];
  const ns = vulOf(bn, 0), ew = vulOf(bn, 1), cls = ns && ew ? 'both' : ns ? 'ns' : ew ? 'ew' : 'none', vt = ns && ew ? 'BOTH VUL' : ns ? 'NS VUL' : ew ? 'EW VUL' : 'NO VUL';
  return `<div class="bm3-bar"><span class="td">🏛</span><div class="ev"><b>${esc(x.i.n || '')}</b>${T('Table {0}', t.ti + 1)} – ${T('Round {0}', t.r + 1)}</div></div>`
    + (bn ? `<div class="bm3-head"><div class="bm3-board"><small>${T('Board')}</small><b>${bn}</b><span class="bm3-vul ${cls}">${vt}</span></div><div class="bm3-pairs"><div><i>NS</i>${tb[0] != null ? tb[0] + 1 : '?'}</div><div><i>EW</i>${tb[1] != null ? tb[1] + 1 : '?'}</div></div></div>` : '');
}
const CT_BM_STEPS = ['contract', 'decl', 'lead', 'tricks', 'confirm'];
const ctBmS = s => `<span class="bmsy s${s}">${SUIT[s]}</span>`;   // a suit in its colour (the four-colour deck too)
const ctBmSym = s => s === 4 ? 'NT' : ctBmS(s);
// one step a screen, as the club's BridgeScore: the contract → who played it (the compass) → the lead → the tricks
// → the result to confirm; then the opponents' approval and the other tables on this board, then the next board
function ctBmDraw() {
  const v = CT_BM.v, e = CT_BM.e, bn = e.board, step = CT_BM.step, t = CT.tbl;
  const con = v.pass ? 'PASS' : v.lvl ? v.lvl + (v.st >= 0 ? ctBmSym(v.st) : '') + (v.dbl === 2 ? 'XX' : v.dbl ? 'X' : '') + (v.decl >= 0 ? ' ' + SEAT_AB[v.decl] : '') : '—';
  const lead = v.ls >= 0 && v.lr >= 0 ? RTXT[v.lr] + ctBmS(v.ls) : '—';
  const res = v.pass ? 'PASS' : v.tr == null ? '—' : v.tr - v.lvl - 6 === 0 ? '=' : (v.tr - v.lvl - 6 > 0 ? '+' : '') + (v.tr - v.lvl - 6);
  const full = v.pass || (v.lvl && v.st >= 0 && v.decl >= 0 && v.tr != null && v.ls >= 0 && v.lr >= 0), sc = full ? ctBmScore(v, bn) : null;
  const key = (k, l, on, cls) => `<button class="bm3-key${cls ? ' ' + cls : ''}${on ? ' active' : ''}" data-bm="${k}">${l}</button>`;
  const display = `<div class="bm3-display"><div class="bm3-contract">${con}</div><div class="bm3-sub"><span>${T('Lead')}: ${lead}</span><span>${T('Result')}: ${res}</span></div><div class="bm3-score"><small>NS</small><b>${sc == null || step !== 'confirm' && step !== 'done' ? '—' : fmtSigned(sc)}</b></div></div>`;
  const hint = `<div class="bm3-note" style="padding:2px 12px">🧪 ${T('As played at the table')}: <b>${ctBmPlayed(e)}</b></div>`;
  const backB = `<button class="bm3-cancel" data-bm="back">‹ ${T('Back')}</button>`, nextB = on => `<button class="bm3-ok" data-bm="go"${on ? '' : ' disabled'}>${T('Next')} ›</button>`;
  let body = '', actions = '';
  if (step === 'contract') {
    body = `<div class="bm3-step">${T('Contract')}</div>
      <div class="bm3-keys k4">${[1, 2, 3, 4, 5, 6, 7].map(l => key('l' + l, l, v.lvl === l)).join('')}${key('pass', 'PASS', v.pass, 'pass')}</div>
      <div class="bm3-keys k5">${[0, 1, 2, 3, 4].map(s => key('s' + s, s === 4 ? 'NT' : ctBmS(s), v.st === s, 'suit')).join('')}</div>
      <div class="bm3-keys k3">${key('x0', '—', !v.dbl)}${key('x1', 'X', v.dbl === 1, 'dbl')}${key('x2', 'XX', v.dbl === 2, 'dbl')}</div>`;
    actions = `<span></span>${nextB(v.pass || (v.lvl && v.st >= 0))}`;
  } else if (step === 'decl') {
    const tb = (t.plan.rounds[t.r] || [])[t.ti] || [], NSp = t.plan.pairs[tb[0]] || {}, EWp = t.plan.pairs[tb[1]] || {};
    const nm = [NSp.robot ? '🤖' : NSp.a, EWp.robot ? '🤖' : EWp.a, NSp.robot ? '🤖' : NSp.b, EWp.robot ? '🤖' : EWp.b];
    const seat = d => `<button class="bm3-seat ${d % 2 ? 'ew' : 'ns'}${v.decl === d ? ' active' : ''}" data-bm="d${d}"><b>${SEAT_AB[d]}</b><small>${esc(nm[d] || '')}</small></button>`;
    body = `<div class="bm3-step">${T('Who played the contract?')}</div>
      <div class="bm3-compass"><span></span>${seat(0)}<span></span>${seat(3)}<div class="bm3-tbl">${con}</div>${seat(1)}<span></span>${seat(2)}<span></span></div>`;
    actions = backB + nextB(v.decl >= 0);
  } else if (step === 'lead') {
    body = `<div class="bm3-step">${T('Lead')}</div>
      <div class="bm3-keys k4">${[0, 1, 2, 3].map(s => key('ls' + s, ctBmS(s), v.ls === s, 'suit')).join('')}</div>
      <div class="bm3-keys k7">${[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(r => key('lr' + r, RTXT[r], v.lr === r)).join('')}</div>`;
    actions = backB + nextB(v.ls >= 0 && v.lr >= 0);
  } else if (step === 'tricks') {
    body = `<div class="bm3-step">${T('Tricks taken by declarer')}</div>
      <div class="bm3-keys k7">${[...Array(14).keys()].map(n => key('t' + n, (n - v.lvl - 6 === 0 ? '=' : (n - v.lvl - 6 > 0 ? '+' : '') + (n - v.lvl - 6)) + `<small>${n}</small>`, v.tr === n, n >= v.lvl + 6 ? 'res made' : 'res down')).join('')}</div>`;
    actions = backB + nextB(v.tr != null);
  } else if (step === 'confirm') {
    const r = v.tr - v.lvl - 6, rr = v.pass ? T('Pass') : r === 0 ? T('made exactly') : r > 0 ? '+' + r : r;
    body = `<div class="bm3-step">${T('Result')}</div>
      <div class="bm3-sum">${v.pass ? '' : `<div><span>${T('Declarer')}</span><b>${SEAT_AB[v.decl]}</b></div><div><span>${T('Lead')}</span><b>${lead}</b></div><div><span>${T('Tricks')}</span><b>${v.tr}</b></div>`}<div><span>${T('Result')}</span><b>${rr}</b></div><div class="big"><span>NS</span><b>${fmtSigned(sc)}</b></div></div>`;
    actions = backB + `<button class="bm3-ok" data-bm="ok">✓ OK</button>`;
  } else if (step === 'done') {   // approved: the check against the board as played, the other tables on this board
    const rc = e.c, rl = e.pl && e.pl[0] && e.pl[0][0];
    const same = v.pass ? !!e.passed : !e.passed && rc && v.lvl === rc.level && v.st === rc.strain && v.dbl === rc.dbl && v.decl === rc.decl && v.tr === e.tricks && (!rl || (v.ls === S(rl[1]) && v.lr === R(rl[1])));
    const x = ctFind(t.key), others = [];
    if (x && x.run && x.run.t) x.plan.rounds.forEach((tb, r) => tb.forEach((_, ti) => { if (r === t.r && ti === t.ti) return; const o = ((x.run.t[r + '_' + ti] || {}).res || {})[bn]; if (o) others.push({ ti, o }); }));
    const row = (ti, c, ns, me) => `<div class="bm3-orow${me ? ' me' : ''}"><span>${T('Table {0}', ti + 1)}</span><span>${c}</span><b>${fmtSigned(ns || 0)}</b></div>`;
    const cTxt = o => o.pass ? 'PASS' : o.c ? o.c[0] + ctBmSym(o.c[1]) + (o.c[2] === 2 ? 'XX' : o.c[2] ? 'X' : '') + ' ' + SEAT_AB[o.c[3]] : '';
    body = `<div class="bm3-step">🤖 ${T('The opponents approved the score.')}</div>
      <div class="bm3-note" style="padding:2px 12px">${same ? '✅ ' + T('Your entry matches the board as played.') : '⚠ ' + T('As played at the table') + ': ' + ctBmPlayed(e)}</div>
      <div class="bm3-step">${T('Other tables on this board')}</div>
      <div class="bm3-others">${row(t.ti, con, sc, true)}${others.map(x => row(x.ti, cTxt(x.o), x.o.ns)).join('') || `<div class="bm3-note">${T('No other table has finished this board yet.')}</div>`}</div>`;
    actions = `<span></span><button class="bm3-ok" data-bm="next">${T('Continue')} ›</button>`;
  }
  const sh = () => document.querySelector('#ov .sheet'), keep = ui.overlay === 'ctbm' && sh() ? sh().scrollTop : 0;
  openOv('ctbm', `<div class="bm3 bm3w ctbm3"><div class="bm3-screen">${ctBmHead(bn)}${display}${step === 'done' ? '' : hint}<div class="bm3-body">${body}</div><div class="bm3-actions">${actions}</div></div></div>`);
  if (keep && sh()) sh().scrollTop = keep;
}
// the end of the round: where this pair goes next, as the BridgeScore shows it
function ctBmMove(then) {
  const t = CT.tbl, pi = ctMyPair(t.plan), nx = ctSched(t.plan, pi).find(s => s.r === t.r + 1);
  CT_BM.then = then; CT_BM.e = null;
  openOv('ctbm', `<div class="bm3 bm3w ctbm3"><div class="bm3-screen">${ctBmHead(0)}
    <div class="bm3-display"><div class="bm3-contract">🔔 ${T('Round over')}</div><div class="bm3-sub"><span>${T('Move instructions')}</span></div></div>
    <div class="bm3-body">${nx ? `<div class="bm3-step">${T('Round {0}', nx.r + 1)}</div><div class="bm3-note" style="padding:4px 12px;font-size:1.05rem;line-height:1.7">🪑 <b>${T('Table {0}', nx.ti + 1)}</b> · ${nx.ns ? T('North-South') : T('East-West')}<br>${T('against')} ${ctPairTxt(nx.opp)}<br>🃏 ${T('Boards {0}', nx.from + '-' + nx.to)}</div>` : ''}</div>
    <div class="bm3-actions"><span></span><button class="bm3-ok" data-bm="next">✓ OK</button></div></div></div>`);
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-bm]'); if (!b || ui.overlay !== 'ctbm') return;
  const k = b.dataset.bm, v = CT_BM.v, go = d => { let i = CT_BM_STEPS.indexOf(CT_BM.step) + d; if (v && v.pass) i = d > 0 ? CT_BM_STEPS.length - 1 : 0; CT_BM.step = CT_BM_STEPS[Math.max(0, Math.min(CT_BM_STEPS.length - 1, i))]; ctBmDraw(); };
  const auto = st => setTimeout(() => { if (CT_BM.step === st && ui.overlay === 'ctbm') go(1); }, 220);   // a step with one choice goes on by itself
  if (k === 'next') { const f = CT_BM.then; CT_BM.then = null; closeOv(); if (f) f(); return; }
  if (k === 'ok') { CT_BM.step = 'done'; ctBmDraw(); return; }
  if (k === 'go') return go(1);
  if (k === 'back') return go(-1);
  if (k === 'pass') { v.pass = !v.pass; if (v.pass) Object.assign(v, { lvl: 0, st: -1, dbl: 0, decl: -1, tr: null, ls: -1, lr: -1 }); }
  else if (/^l\d$/.test(k)) { v.lvl = +k.slice(1); v.pass = false; v.tr = null; }
  else if (/^s\d$/.test(k)) { v.st = +k.slice(1); v.pass = false; }
  else if (/^x[012]$/.test(k)) v.dbl = +k[1];
  else if (/^d\d$/.test(k)) { v.decl = +k.slice(1); ctBmDraw(); return auto('decl'); }
  else if (/^ls\d$/.test(k)) v.ls = +k.slice(2);
  else if (/^lr\d+$/.test(k)) { v.lr = +k.slice(2); if (v.ls >= 0) { ctBmDraw(); return auto('lead'); } }
  else if (/^t\d+$/.test(k)) { v.tr = +k.slice(1); ctBmDraw(); return auto('tricks'); }
  ctBmDraw();
});
// the next board of the round, or the next round's table, or the end of the evening
function ctGoNext() {
  const t = CT.tbl; if (!t || !G || !G.ct) return;
  if (t.watch) { ctLeave(); G = idleG(); save(); render(); return; }   // watching: back home
  if (G.phase !== 'done') { flash(T('Finish this tournament board first'), 2000); return; }
  // the BridgeScore test: the score entered for this board, then (the round over) the move screen
  if (ctBmOn() && G.result && !(t.bmOk || {})[G.board]) { const bn = G.board; ctBmShow(G.result, () => { (t.bmOk = t.bmOk || {})[bn] = 1; ctGoNext(); }); return; }
  if (ctBmOn() && G.ct.i + 1 >= t.boards.length && t.r + 1 < t.rounds && !t.bmMoved) { ctBmMove(() => { t.bmMoved = 1; ctGoNext(); }); return; }
  if (G.ct.i + 1 < t.boards.length) { ctStartBoard(G.ct.i + 1); ctPoll(); return; }
  if (t.r + 1 < t.rounds) { ctWaitRound(t, t.r + 1); return; }
  const bmEnd = ctBmOn() ? { key: t.key, id: t.id, d: t.d } : null;
  clearInterval(CT.pollT); clearInterval(CT.beatT); CT.tbl = null;
  flash('🏁 ' + T('The tournament is over for you — thank you!'), 4000); G = null; goHome();
  if (bmEnd) setTimeout(() => ctBmEnd(bmEnd), 400);
}
// the end of the evening on the BridgeScore (Servet's test): over for this table; the results once every table is done
async function ctBmEnd(e) {
  CT_BM.end = e;
  try { await ctLoad(true); } catch (er) {}
  const [club, id] = String(e.key).split('|'), x = ctRuns(club).find(y => y.id === id && y.d === +e.d);
  const left = x ? x.plan.rounds.reduce((k, tb, r) => k + tb.filter((_, ti) => Object.values((((x.run.t || {})[r + '_' + ti]) || {}).res || {}).filter(Boolean).length < x.plan.bpr).length, 0) : 0;
  const all = x && left === 0;
  openOv('ctbm', `<div class="bm3 bm3w ctbm3"><div class="bm3-screen">
    <div class="bm3-bar"><span class="td">🏛</span><div class="ev"><b>${esc(x ? x.i.n || '' : '')}</b>${esc(x ? x.i.cn || club : club)}</div></div>
    <div class="bm3-display"><div class="bm3-contract">🏁 ${T('The tournament is over')}</div><div class="bm3-sub"><span>${all ? T('Every table has finished: the results are ready.') : T('Over for your table; {0} tables are still playing.', left)}</span></div></div>
    <div class="bm3-body"></div>
    <div class="bm3-actions">${all ? `<button class="bm3-cancel" data-bmend="home">${T('Close')}</button><button class="bm3-ok" data-bmend="res">📊 ${T('See the results')}</button>` : `<button class="bm3-cancel" data-bmend="home">${T('Close')}</button><button class="bm3-ok" data-bmend="again">🔄 ${T('Refresh')}</button>`}</div>
  </div></div>`);
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-bmend]'); if (!b || ui.overlay !== 'ctbm' || !CT_BM.end) return;
  const k = b.dataset.bmend, e = CT_BM.end, [club, id] = String(e.key).split('|');
  if (k === 'home') { CT_BM.end = null; closeOv(); return; }
  if (k === 'again') { ctBmEnd(e); return; }
  if (k === 'res') { CT_BM.end = null; ctShowResults(club, id, e.d, 'rank'); }
});
// a board finished here: its result for the club's list (written by every app of the table: the same values)
function ctBoardDone(e) {
  const t = CT.tbl; if (!t || t.watch || !e) return;
  setTimeout(ctBackCheck, 0);
  const res = e.c ? { c: [e.c.level, e.c.strain, e.c.dbl, e.c.decl], tr: e.tricks, ns: e.ns } : { pass: 1, ns: 0 };
  const p = t.p + '/t/' + t.tid + '/res/' + e.board;
  Net.Cloud.get(p).then(o => o && o.adj ? null : Net.Cloud.put(p, res)).catch(() => {}).then(() => setTimeout(ctMyScore, 1500));
}
/* the end of a round at your table: the next round starts when every table has finished this one (the tables still
   playing are shown; after five minutes you may go on without waiting); then you are seated at your next table */
async function ctTablesLeft(p, plan, r) {
  const left = [];
  for (let ti = 0; ti < plan.rounds[r].length; ti++) {
    let res = null; try { res = await Net.Cloud.get(p + '/t/' + r + '_' + ti + '/res'); } catch (e) {}
    const n = Object.values(res || {}).filter(Boolean).length; if (n < plan.bpr) left.push({ ti, n });
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
    if (!left.length) { clearInterval(CT.waitT); CT.waiting = null; if (ui.overlay === 'ctwait') closeOv(); flash('🪑 ' + T('Every table has finished: round {0}', next + 1), 2500); ctLoad(true).then(() => ctSit(key, next)); return; }
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
setTimeout(() => { if (typeof ui !== 'undefined' && ui.saved && ui.saved.ct) ui.saved = null; if (typeof G !== 'undefined' && G && G.ct && !CT.tbl) { CT.resume = { key: G.ct.key, r: G.ct.r, id: G.id }; G = null; if (typeof render === 'function') render(); } }, 500);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-ct],[data-ctreg],[data-ctcancel],[data-ctseek],[data-ctsit],[data-ctrobot],[data-ctskip],[data-ctopen]'); if (!t) return;
  if (t.dataset.ctopen) { ctTakeSeat(t.dataset.ctopen); return; }
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
// the club tournaments' cards are in Open tables (drawn again with the home page; the reminder here)
setInterval(() => { ctRemind(); const el = $('hTables'); if (el && document.body.classList.contains('athome') && typeof Net !== 'undefined') { const h = Net.tablesHtml(); if (el.innerHTML !== h) el.innerHTML = h; } }, 30e3);

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
      if (run && run.plan) out.push({ club: c, id, d: +d, i: t.info || {}, plan: ctFill(ctSeatsApply(run.plan, run.seats), run.t), run });   // an open evening: the names of who sat
    }
  }
  return out.sort((a, b) => b.d - a.d);
}
// over: only the boards every table of their round has finished (the ranking, your score, the rating)
function ctScore(x, over) {
  const P = x.plan, boards = {};
  P.rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => {
    const res = (((x.run.t || {})[r + '_' + ti]) || {}).res || {};
    for (const [bn, v] of Object.entries(res)) if (v && (!over || ctBoardOver(x, bn))) (boards[bn] || (boards[bn] = [])).push({ r, ti, ns: a, ew: b, v });
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
// a board is over when every table of its round has played it (all the tables of a round play the same boards):
// until then its results, hands and double dummy are not shown, so nobody sees a board still being played elsewhere
const ctTablesOf = (P, bn) => { const out = []; P.rounds.forEach((tb, r) => tb.forEach((_, ti) => { if (ctBoards(P, r, ti).includes(+bn) && !ctIdle(P, r, ti)) out.push(r + '_' + ti); })); return out; };   // a table nobody sat at is not waited for
function ctBoardOver(x, bn) { const L = ctTablesOf(x.plan, bn); return L.length > 0 && L.every(k => !!(((x.run.t || {})[k] || {}).res || {})[bn]); }
const ctBoardLeft = (x, bn) => { const L = ctTablesOf(x.plan, bn); return [L.filter(k => !!(((x.run.t || {})[k] || {}).res || {})[bn]).length, L.length]; };
// the club's online rating, from every evening in turn
function ctRating(club) {
  const R = {};
  for (const x of ctRuns(club).slice().reverse()) {
    const S = ctScore(x, true);
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
// only: the Pairings button — the pairings alone (no other tabs, no PBN)
function ctShowResults(club, id, d, tab, only) {
  const x = ctRuns(club).find(y => y.id === id && (!d || y.d === +d)); if (!x) { flash(T('No results yet.'), 2000); return; }
  CT.res = { club, id, d: x.d, tab: only ? 'pair' : tab || CT.res && CT.res.tab || 'rank', only: !!only };
  if (CT.res.tab === 'live' && !(x.i.watch || CT.adminView)) CT.res.tab = 'rank';   // watching only when the director allowed it (or for the director)
  const S = ctScore(x), SR = ctScore(x, true), P = x.plan, pn = p => p.robot ? '🤖 ' + T('Robot pair') : esc(p.a) + ' – ' + esc(p.b), t = CT.res.tab;
  const tabs = `<div class="seg" data-seg="ctrestab">${[['pair', '🔀 ' + T('Pairings')], ['rank', '🏆 ' + T('Ranking')], ['boards', '🃏 ' + T('The boards')], ['rating', '🏅 ' + T('Club rating')], ...(x.i.watch || CT.adminView ? [['live', '👁 ' + T('Watch')]] : [])].map(([v, l]) => `<button data-ctres="${v}" class="${t === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (t === 'pair') body = ctPairsHtml(x);
  else if (t === 'rank') body = SR.rank.length ? `<table class="res"><thead><tr><th>#</th><th>${T('Pair')}</th><th>MP %</th><th>IMP</th><th>${T('Boards')}</th></tr></thead><tbody>${SR.rank.map((r, k) => `<tr${[r.p.ka, r.p.kb].includes(ctMe()) ? ' class="me"' : ''}><td>${k + 1}</td><td>${pn(r.p)}</td><td>${SR.imp ? '' : '<b>'}${r.pct.toFixed(1)}%${SR.imp ? '' : '</b>'}</td><td>${SR.imp ? '<b>' : ''}${fmtSigned(r.imp)}${SR.imp ? '</b>' : ''}</td><td>${r.n}</td></tr>`).join('')}</tbody></table><div class="muted">${T('Ranked by {0}', SR.imp ? 'IMP' : 'MP %')}</div>` : `<div class="muted">${T('No results yet.')}</div>`;
  else if (t === 'boards') body = Object.keys(S.boards).sort((a, b) => a - b).map(bn => !ctBoardOver(x, bn) ? `<div class="grp"><span>${T('Board {0}', bn)}</span><div class="muted">⏳ ${T('Still being played ({0} of {1} tables done): shown when every table has finished it.', ...ctBoardLeft(x, bn))}</div></div>` : `<div class="grp"><span>${T('Board {0}', bn)} <button class="btn mini-btn" data-ctdd="${bn}">🎯 ${T('Double dummy')}</button></span>
      <div id="ctdd${bn}"></div>
      <table class="res"><tbody>${S.boards[bn].map(q => `<tr><td>${pn(P.pairs[q.ns])}<br><small>${pn(P.pairs[q.ew])}</small></td><td>${ctCon(q.v)}${q.v.tr != null ? ' · ' + T('{0} tricks', q.v.tr) : ''}</td><td><b>${fmtSigned(q.v.ns || 0)}</b></td><td>${Math.round(q.mp)}%<br><small>${fmtSigned(q.imp)} IMP</small></td></tr>`).join('')}</tbody></table></div>`).join('') || `<div class="muted">${T('No results yet.')}</div>`;
  else if (t === 'rating') { const L = ctRating(club); body = L.length ? `<table class="res rtgt"><thead><tr><th>#</th><th>${T('Player')}</th><th>${T('Rating')}</th><th>${T('Evenings')}</th></tr></thead><tbody>${L.map((r, k) => `<tr><td>${k + 1}</td><td>${esc(r.n)}</td><td><b>${Math.round(r.r)}</b></td><td>${r.g}</td></tr>`).join('')}</tbody></table><div class="muted">${T('Everyone starts at 1500; each evening moves it by the pair\'s result.')}</div>` : `<div class="muted">${T('No results yet.')}</div>`; }
  else body = P.rounds.map((tb, r) => `<div class="grp"><span>${T('Round {0}', r + 1)}</span>${tb.map(([a, b], ti) => { const n = Object.values((((x.run.t || {})[r + '_' + ti]) || {}).res || {}).filter(Boolean).length; return `<div class="row2" style="align-items:center"><span>${T('Table {0}', ti + 1)}: ${pn(P.pairs[a])} / ${pn(P.pairs[b])} · ${n}/${P.bpr}</span>${n < P.bpr ? `<button class="btn mini-btn" data-ctwatch="${r}_${ti}">👁 ${T('Watch')}</button>` : ''}</div>`; }).join('')}</div>`).join('');
  if (only) { openOv('ctres', `<h2>🔀 ${esc(x.i.n || '')}</h2><div class="muted">🏛 ${esc(x.i.cn || club)} · ${esc(ctWhen(x.d))}</div>${body}<div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`); return; }
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
  const r = CT.res, x = r && ctRuns(r.club).find(y => y.id === r.id && y.d === r.d), el = $('ctdd' + bn); if (!x || !el || !ctBoardOver(x, bn)) return;
  el.innerHTML = '⏳'; setTimeout(() => { el.innerHTML = ctDDHtml(x.plan, bn); }, 30);
}
// the evening's deals as a PBN file
function ctPBN() {
  const r = CT.res, x = r && ctRuns(r.club).find(y => y.id === r.id && y.d === r.d); if (!x) return;
  const RK = '23456789TJQKA', hand = h => [3, 2, 1, 0].map(s => h.filter(c => (c / 13 | 0) === s).map(c => RK[c % 13]).sort((a, b) => RK.indexOf(b) - RK.indexOf(a)).join('')).join('.');
  const V = ['None', 'NS', 'EW', 'All'], vul = bn => { const ns = E.vulOf(bn, 0), ew = E.vulOf(bn, 1); return V[(ns ? 1 : 0) + (ew ? 2 : 0)]; };
  const n = (x.plan.nr || x.plan.rounds.length) * x.plan.bpr, out = [];
  for (let bn = 1; bn <= n; bn++) { if (!ctBoardOver(x, bn)) continue;   // only the boards every table has finished
    const d = ctDeal(x.plan, bn), dl = E.dealerOf(bn); out.push(`[Event "${String(x.i.n || '').replace(/"/g, "'")}"]\n[Date "${new Date(x.d).toISOString().slice(0, 10).replace(/-/g, '.')}"]\n[Board "${bn}"]\n[Dealer "${'NESW'[dl]}"]\n[Vulnerable "${vul(bn)}"]\n[Deal "N:${[0, 1, 2, 3].map(s => hand(d[s])).join(' ')}"]\n`); }
  if (!out.length) { flash(T('No board is over yet.'), 2200); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/plain' })); a.download = (x.i.n || 'club') .replace(/[^\w-]+/g, '_') + '-' + new Date(x.d).toISOString().slice(0, 10) + '.pbn'; a.click();
}
// watching a table (its round still going): the game read from the list as the players see it, every hand open
async function ctWatch(tid) {
  const r = CT.res, x = r && ctRuns(r.club).find(y => y.id === r.id && y.d === r.d); if (!x) return;
  const [rr, ti] = tid.split('_').map(Number);
  clearInterval(CT.pollT); clearInterval(CT.beatT);
  CT.tbl = { key: r.club + '|' + r.id, id: r.id, d: r.d, p: 'ot/' + encodeURIComponent(r.club) + '/' + encodeURIComponent(r.id) + '/run/' + r.d, plan: x.plan, r: rr, ti, tid, seats: ctSeatsOf(x.plan, rr, ti), seat: 2, boards: ctBoards(x.plan, rr, ti), n: 0, hb: {}, name: x.i.n, rounds: x.plan.rounds.length, watch: true };
  closeOv(); await ctRebuild(); CT.pollT = setInterval(ctPoll, 2000);
  flash('👁 ' + T('Round {0} · table {1}', rr + 1, ti + 1), 2000);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-ctadmin]');   // the club's admin: the Clubs sign-in (the club's password), then the tournament to change
  if (a) { const [c, i] = a.dataset.ctadmin.split('|'); closeOv(); openClubs('club=' + encodeURIComponent(c) + '&role=admin&admin=1&ot=' + encodeURIComponent(i)); return; }
  const t = e.target.closest('[data-ctres],[data-ctdd],[data-ctpbn],[data-ctwatch],[data-ctresopen],[data-ctpick]'); if (!t) return;
  if (t.dataset.ctresopen) { const [c, i] = t.dataset.ctresopen.split('|'); ctShowResults(c, i, null, t.dataset.cttab, t.dataset.cttab === 'pair'); }
  else if (t.dataset.ctpick != null && CT.res) { CT.pick = +t.dataset.ctpick === CT.pick ? null : +t.dataset.ctpick; ctShowResults(CT.res.club, CT.res.id, CT.res.d, 'pair', CT.res.only); }
  else if (t.dataset.ctres && CT.res) ctShowResults(CT.res.club, CT.res.id, CT.res.d, t.dataset.ctres);
  else if (t.dataset.ctdd) ctDD(t.dataset.ctdd);
  else if (t.dataset.ctpbn) ctPBN();
  else if (t.dataset.ctwatch) ctWatch(t.dataset.ctwatch);
});

setTimeout(async function ctResume() {
  const z = CT.resume; CT.resume = null;
  if (!z || CT.tbl || CT.waiting) return;
  try { await ctLoad(true); } catch (e) { return; }
  let key = z.key; if (!key) { const x = ctList().find(y => String(z.id || '').startsWith('ct' + y.id + y.d)); if (x) key = x.club + '|' + x.id; }
  const x = key && ctFind(key);
  if (x && x.plan && ctMyPair(x.plan) >= 0 && ctCurRound(x.plan, x.run && x.run.t) >= 0) ctSit(key, z.r);   // that evening is over (or only watched): home
}, 1500);

/* the director's look at a club table (from the Clubs admin): each board's calls and cards, from the table's list */
function ctTablePlay(plan, r, list, ti) {
  const L = Array.isArray(list) ? list : Object.keys(list || {}).sort((a, b) => a - b).map(k => list[k]), out = [];
  let i = 0;
  for (const bn of ctBoards(plan, r, ti)) {
    const auc = [], cards = [];
    while (i < L.length && L[i] && L[i].c != null && !auctionOver(auc)) { auc.push({ seat: L[i].s, call: L[i].c }); i++; }
    const over = auctionOver(auc), c = over ? contractOf(auc) : null;
    if (c) while (i < L.length && L[i] && L[i].k != null && cards.length < 52) { cards.push(L[i]); i++; }
    out.push({ bn, auc, c, cards, done: over && (!c || cards.length === 52) });
    if (!out[out.length - 1].done) break;
  }
  return out;
}
const ctCallTxt = c => isNum(c) ? LV(c) + STR[ST(c)] : c === 'P' ? T('Pass') : callTxt(c);
const ctCardTxt = k => SUIT[S(k)] + RTXT[R(k)];
// North-South's score of a contract made with tr tricks on board bn
function ctNsScore(bn, level, strain, dbl, decl, tr) { const sc = scoreOf(level, strain, dbl, vulOf(bn, decl), tr); return sideOf(decl) === 0 ? sc : -sc; }
// one board as the director sees it: the hands, the bidding and every trick (who led, who won)
function ctPlayHtml(plan, r, list, bn, ti) {
  const b = ctTablePlay(plan, r, list, ti).find(x => x.bn === bn);
  if (!b) return '<div>' + T('Not played yet') + '</div>';
  const SN = ['N', 'E', 'S', 'W'], d0 = dealerOf(bn), red = t => /[♥♦]/.test(t) ? ' style="color:#c4122f"' : '';
  const cells = []; for (let k = 0; k < d0; k++) cells.push(''); for (const a of b.auc) cells.push(ctCallTxt(a.call));
  const rows = []; for (let k = 0; k < cells.length; k += 4) rows.push(cells.slice(k, k + 4));
  let html = '<b>' + T('Board {0}', bn) + '</b><table><thead><tr>' + SN.map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' + rows.map(rw => '<tr>' + [0, 1, 2, 3].map(k => '<td' + red(rw[k] || '') + '>' + esc(rw[k] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  if (!b.c) return html + (b.done ? '<div>' + T('Passed out') + '</div>' : '');
  const c = b.c, trump = c.strain < 4 ? c.strain : -1; let won = 0;
  html += '<div><b>' + c.level + STR[c.strain] + (c.dbl === 2 ? 'XX' : c.dbl ? 'X' : '') + ' ' + SN[c.decl] + '</b></div><table><tbody>';
  for (let k = 0; k < b.cards.length; k += 4) {
    const tr = b.cards.slice(k, k + 4); let w = tr[0];
    for (const x of tr) { const sw = S(w.k), sx = S(x.k); if ((sx === sw && R(x.k) > R(w.k)) || (sx === trump && sw !== trump)) w = x; }
    if (tr.length === 4 && sideOf(w.s) === sideOf(c.decl)) won++;
    html += '<tr><td>' + (k / 4 + 1) + '</td>' + tr.map(x => '<td' + red(ctCardTxt(x.k)) + '>' + SN[x.s] + ' ' + (x === w && tr.length === 4 ? '<b>' + ctCardTxt(x.k) + '</b>' : ctCardTxt(x.k)) + '</td>').join('') + '</tr>';
  }
  return html + '</tbody></table><div>' + T('Tricks') + ': ' + won + (b.done ? ' · NS ' + ctNsScore(bn, c.level, c.strain, c.dbl, c.decl, won) : '') + '</div>';
}

/* ---- a table where nobody sits (every player gone): its robots go on from another app — the director's Clubs page,
   or a player of that table who left it (home page open). One step at a time: the next call or card, or the board's
   result; the same list every app reads, so a player who comes back is at the same point ---- */
const ctList_ = l => Array.isArray(l) ? l : Object.keys(l || {}).sort((a, b) => a - b).map(k => l[k]);
// the round being played: the first one with a table not finished
// an open evening's table where no player sits (only robots): not played, and the round does not wait for it
function ctIdle(plan, r, ti) { return !!(plan.pairs || []).some(p => p && p.open) && ctSeatsOf(plan, r, ti).every(s => !s.k); }
function ctCurRound(plan, tmap) {
  for (let r = 0; r < plan.rounds.length; r++) {
    const T = plan.rounds[r].map((x, ti) => ti).filter(ti => !ctIdle(plan, r, ti));
    if (!T.length || T.some(ti => Object.values(((tmap || {})[r + '_' + ti] || {}).res || {}).filter(Boolean).length < plan.bpr)) return r;   // nobody at any table: the evening waits
  }
  return -1;
}
// nobody of this table here (their app in the last 90 seconds)
function ctTableEmpty(plan, r, ti, hb) { return ctSeatsOf(plan, r, ti).every(s => !s.k || Date.now() - (+(hb || {})[s.k] || 0) > CT_AWAY); }
// the next step of a table played by the robots: { n, a } (the action at index n) or { res: board, v } or null (round done)
// the deal fixed the robots' dice: each decision gets fresh ones (otherwise every empty table plays the same)
const ctFresh = () => E.seed(null);   // true chance again (a deal sets the dice)
function ctHeadStep(plan, r, list, res, ti) {
  const L = ctList_(list), cards = ctCardsOf(plan, r, ti); let i = 0;
  for (const bn of ctBoards(plan, r, ti)) {
    const deal = ctDeal(plan, bn), dl = dealerOf(bn), auc = [];
    while (i < L.length && L[i] && L[i].c != null && !auctionOver(auc)) { auc.push({ seat: L[i].s, call: L[i].c }); i++; }
    if (!auctionOver(auc)) { const s = (dl + auc.length) % 4; ctFresh(); const b = E.aiBid(auc, s, deal[s], cards); return { n: i, a: { s, c: b.call } }; }
    const c = contractOf(auc);
    if (!c) { if (!(res || {})[bn]) return { res: bn, v: { pass: 1, ns: 0 } }; continue; }
    const g = E.newPlayState(deal, c, auc, cards);
    while (i < L.length && L[i] && L[i].k != null && !E.handsEmpty(g)) { if (E.applyCard(g, L[i].s, L[i].k)) E.collect(g); i++; }
    if (!E.handsEmpty(g)) { const t = g.turn; ctFresh(); return { n: i, a: { s: t, k: E.aiPlay(g, t, { budget: 250, maxSamples: 12, ddTricks: 6 }) } }; }
    if (!(res || {})[bn]) { const tr = g.tricks[sideOf(c.decl)]; return { res: bn, v: { c: [c.level, c.strain, c.dbl, c.decl], tr, ns: ctNsScore(bn, c.level, c.strain, c.dbl, c.decl, tr) } }; }
  }
  return null;
}
// a player who left a table (this app at home): that table's robots go on from here while nobody else is there
CT.headBusy = false;
async function ctHeadMine() {
  if (CT.headBusy || !myNm() || document.hidden) return;
  if (CT.tbl || CT.waiting) return;   // at a table (or waiting for the next one): that is enough for this app
  const L = ctList().filter(x => x.plan && x.d <= Date.now() && Date.now() - x.d < 6 * 3600e3);
  CT.headBusy = true;
  try {
    for (const x of L) {
      const pi = ctMyPair(x.plan); if (pi < 0) continue;
      if (await Net.Cloud.get(ctRunP(x) + '/plan/bpr') == null) continue;   // deleted meanwhile: nothing written
      const p = ctRunP(x), tmap = await Net.Cloud.get(p + '/t') || {}, plan = ctFill(x.plan, tmap), r = ctCurRound(plan, tmap); if (r < 0) continue;
      const ti = plan.rounds[r].findIndex(([a, b]) => a === pi || b === pi); if (ti < 0) continue;
      const hb = await Net.Cloud.get(p + '/hb') || {};
      if (x.i && x.i.wait && !hb[x.i.wait]) continue;   // Servet's test: nothing played before he sits down
      if (!ctTableEmpty(plan, r, ti, hb) || ctIdle(plan, r, ti)) continue;
      const tb = tmap[r + '_' + ti] || {}, st = ctHeadStep(plan, r, tb.a, tb.res, ti);
      if (!st) continue;
      if (st.res) await Net.Cloud.put(p + '/t/' + r + '_' + ti + '/res/' + st.res, st.v);
      else await Net.Cloud.put(p + '/t/' + r + '_' + ti + '/a/' + st.n, st.a).catch(() => {});
      return;
    }
  } catch (e) {} finally { CT.headBusy = false; }
}
setInterval(ctHeadMine, 2500);
// Servet's test evening: while he plays (at his table, or waiting for the next round) his own app plays the robots of
// every other empty table too — one step at each, every few seconds — so the evening goes on without the clubs
// program's page open and without the GitHub run (the database lets him write at any table of a test: his key is in m)
CT.testBusy = false;
async function ctHeadTest() {
  if (CT.testBusy || !myNm() || document.hidden) return;
  const t = CT.tbl || CT.waiting; if (!t || !t.key) return;
  const x = ctFind(t.key); if (!x || !x.i || !(x.i.test || x.i.open) || !x.plan) return;
  CT.testBusy = true;
  try {
    const p = ctRunP(x); if (await Net.Cloud.get(p + '/plan/bpr') == null) return;   // deleted meanwhile
    const tmap = await Net.Cloud.get(p + '/t') || {}, plan = ctFill(x.plan, tmap), r = ctCurRound(plan, tmap); if (r < 0) return;
    const hb = await Net.Cloud.get(p + '/hb') || {}, mine = CT.tbl && !CT.tbl.watch ? CT.tbl.ti : -1;
    try { for (const k of Object.keys(await Net.Cloud.get(p + '/kick') || {})) delete hb[k]; } catch (e) {}   // a player taken off: the robots play the seat now
    for (let ti = 0; ti < plan.rounds[r].length; ti++) {
      if (ti === mine && CT.tbl && CT.tbl.r === r) continue;   // my own table: I play it
      if (!ctTableEmpty(plan, r, ti, hb) || ctIdle(plan, r, ti)) continue;
      const tb = tmap[r + '_' + ti] || {}, st = ctHeadStep(plan, r, tb.a, tb.res, ti); if (!st) continue;
      const q = p + '/t/' + r + '_' + ti + (st.res ? '/res/' + st.res : '/a/' + st.n);
      if (await Net.Cloud.get(q) != null) continue;   // another app was quicker
      await Net.Cloud.put(q, st.v || st.a).catch(() => {});
    }
  } catch (e) {} finally { CT.testBusy = false; }
}
setInterval(ctHeadTest, 3000);

// your pair's score in this evening so far (the box at the top while you play): MP %, IMP, place, the last board
async function ctMyScore() {
  const t = CT.tbl; if (!t || t.watch) return;
  try {
    const tmap = await Net.Cloud.get(t.p + '/t') || {}, x = ctFind(t.key), pi = ctMyPair(t.plan); if (pi < 0) return;
    const S = ctScore({ plan: ctFill(t.plan, tmap), run: { t: tmap }, i: (x && x.i) || {} }, true), k = S.rank.findIndex(q => q.p === t.plan.pairs[pi]), me = S.rank[k];
    let last = null, lb = -1;
    for (const [bn, L] of Object.entries(S.boards)) for (const q of L) if ((q.ns === pi || q.ew === pi) && +bn > lb) { lb = +bn; last = q.ns === pi ? { mp: q.mp, imp: q.imp } : { mp: 100 - q.mp, imp: -q.imp }; }
    CT.sc = me ? { pct: me.pct, imp: me.imp, n: me.n, pos: k + 1, of: S.rank.length, last } : { pct: 0, imp: 0, n: 0, last: null };
    if (G && G.ct) render();
  } catch (e) {}
}

/* the round's pairings (as the club's screen has them): every table with its two pairs and boards; your pair (or the
   one tapped) shown on top: the table, the direction, the opponents, the boards */
function ctPairsHtml(x) {
  const P = x.plan, r0 = ctCurRound(P, x.run && x.run.t), r = r0 < 0 ? P.rounds.length - 1 : r0, tb = P.rounds[r] || [];
  const pn = p => p.robot ? '🤖 ' + T('Robot pair') : esc(p.a) + ' – ' + esc(p.b), mine = ctMyPair(P), pick = CT.pick != null ? CT.pick : mine;
  const ti = tb.findIndex(([a, b]) => a === pick || b === pick), fromOf = k => ctSetOf(P, r, k) * P.bpr + 1, from = fromOf(ti), to = from + P.bpr - 1;
  const found = pick >= 0 && ti >= 0 ? (() => { const [a, b] = tb[ti], ns = a === pick; return `<div class="okmsg" style="font-size:16px;line-height:1.6;"><b>${pn(P.pairs[pick])}</b><br>🪑 ${T('Table {0}', ti + 1)} · ${ns ? T('North-South') : T('East-West')}<br>${T('against')} ${pn(P.pairs[ns ? b : a])}<br>🃏 ${T('Boards {0}', from + '-' + to)}</div>`; })() : '';
  return `<div class="big">${r0 < 0 ? '🏁 ' + T('Finished') + ' · ' : ''}${T('Round {0}', r + 1)} / ${P.nr || P.rounds.length}</div>${found}
    <div class="muted">${T('Tap your pair to see your table.')}</div>
    <div class="ctcards">${tb.map(([a, b], k) => { const done = Object.values((((x.run && x.run.t || {})[r + '_' + k]) || {}).res || {}).filter(Boolean).length;
      return `<div class="ctcardt${a === pick || b === pick ? ' me' : ''}"><div class="cth"><b>🪑 ${T('Table {0}', k + 1)}</b><span>${done >= P.bpr ? '✅' : done ? '⏳ ' + done + '/' + P.bpr : ''}</span></div>`
        + `<div class="ctp" data-ctpick="${a}"><small>${T('North-South')} · ${T('Pair {0}', a + 1)}</small>${pn(P.pairs[a])}</div>`
        + `<div class="ctp" data-ctpick="${b}"><small>${T('East-West')} · ${T('Pair {0}', b + 1)}</small>${pn(P.pairs[b])}</div>`
        + `<div class="ctb">🃏 ${T('Boards {0}', `<b>${fromOf(k)}-${fromOf(k) + P.bpr - 1}</b>`)}</div></div>`; }).join('')}</div>
    ${P.mov === 'swiss' && r0 >= 0 ? '<div class="muted">' + T('Swiss: each next round is made from the standings when every table has finished.') + '</div>' : ''}`;
}

// a player at an open evening's table who does not play: anyone at the table takes them off (✕); the robots play the seat,
// which stays theirs — they sit down again from the club and are back in the same place
window.ctKick = function (k) {
  const t = CT.tbl; if (!t || !k || k === ctMe()) return;
  const n = (t.seats || []).find(s => s && s.k === k); 
  askYes(T('Remove {0} from the table? A robot plays the seat.', (n && n.n) || k), async () => { try { await Net.Cloud.put(t.p + '/kick/' + k, Date.now()); t.kick = { ...(t.kick || {}), [k]: Date.now() }; flash('✓', 1200); tick(); } catch (e) { flash(T('Could not send — sign in with your name and PIN first.'), 3000); } });
};
// 🏆 Team match online (from the club's card): any member starts it now — an open evening, robots in the empty seats,
// each pair's robot partner bids its player's card; then the seats to sit down
window.ctQuickPick = function (club, np, bpr) {
  ui.ctq = { club, np: np || (ui.ctq && ui.ctq.club === club ? ui.ctq.np : 8), bpr: bpr || (ui.ctq && ui.ctq.club === club ? ui.ctq.bpr : 3) };
  const q = ui.ctq, k = (v, on, a) => `<button class="btn${on ? ' gold' : ''}" data-ctq="${a}">${v}</button>`, pc = Math.floor(q.np / 2) + (Math.floor(q.np / 2) % 2), rounds = Math.max(1, pc - 1);
  openOv('ctq', `<h2>🏆 ${T('Team match')} · 🌐 ${T('Online')}</h2><div class="muted">${T('Played in BridgePlay, starts now; robots in the empty seats')}</div>
    <div class="grp"><span>${T('Number of players')}</span><div class="row2">${[4, 8, 12, 16, 20, 24].map(v => k(v, q.np === v, 'np|' + v)).join('')}</div></div>
    <div class="grp"><span>${T('Boards per round')}</span><div class="row2">${[2, 3, 4].map(v => k(v, q.bpr === v, 'bpr|' + v)).join('')}</div></div>
    <div class="muted">${Math.ceil(q.np / 4)} ${T('tables')} · ${rounds * q.bpr} ${T('boards')}</div>
    <div class="row2"><button class="btn new" data-ctq="go">▶ ${T('Start now')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
};
async function ctQuickStart() {
  const q = ui.ctq; if (!q) return;
  try { await ctSession(); } catch (e) { flash(T('Could not send — sign in with your name and PIN first.'), 3000); return; }
  const pc = Math.floor(q.np / 2) + (Math.floor(q.np / 2) % 2), rounds = Math.max(1, pc - 1), at = Date.now() - 1000, id = Date.now().toString(36);
  const cl = ((ui.clubLive || []).find(c => c.club === q.club) || {});
  const info = { n: T('Team match'), at, b: rounds * q.bpr, bpr: q.bpr, np: q.np, sc: 'both', sys: SET.sys || 'twoone', conv: [], mov: 'howell', rep: 0, watch: 1, open: true, tm: 1,
    st: 'reg', cn: String(cl.c || cl.name || q.club).slice(0, 40), by: String(myNm()).slice(0, 20), ts: Date.now() };
  try {
    await Net.Cloud.put('ot/' + encodeURIComponent(q.club) + '/' + id + '/info', info);
    const plan = ctMakePlan({ id, d: at, i: info, pairs: [] });
    if (plan) for (const [k, v] of Object.entries(plan)) await Net.Cloud.put('ot/' + encodeURIComponent(q.club) + '/' + id + '/run/' + at + '/' + k, v);
  } catch (e) { flash('❌ ' + T('Could not start') + ' (' + String(e && e.message || e).slice(0, 30) + ')', 4000); return; }
  await ctLoad(true); const x = ctFind(q.club + '|' + id);
  if (x && x.plan) ctShowOpen(q.club + '|' + id, x); else { closeOv(); flash('▶ ' + T('Started'), 2000); }
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-ctq],[data-ctkick]'); if (!b) return;
  if (b.dataset.ctkick) { ctKick(b.dataset.ctkick); return; }
  const [k, v] = b.dataset.ctq.split('|'); if (k === 'go') { ctQuickStart(); return; }
  ctQuickPick(ui.ctq.club, k === 'np' ? +v : ui.ctq.np, k === 'bpr' ? +v : ui.ctq.bpr);
});
