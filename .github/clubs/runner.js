// Online club tournaments (Bridge Table → Clubs → Online): a table everyone has left goes on with its robots.
// There is no server: every few minutes .github/workflows/clubs.yml starts this script; while an evening is being
// played it stays (up to almost six hours) and, at each table of the round where none of the players' apps has been
// seen for 90 seconds, adds the robots' next call or card to the table's list (the same list the apps read), and the
// board's result when it is over. A player who comes back is seated at the same point (the app waits for the robot to
// finish the board). Nothing is written where something already is.
// The database is written with FIREBASE_DB_SECRET (a GitHub Actions secret: Firebase console → Project settings →
// Service accounts → Database secrets).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '../..') + '/';
const DB = 'https://bridgetable-89b1a-default-rtdb.europe-west1.firebasedatabase.app';
const SECRET = process.env.FIREBASE_DB_SECRET || '';
if (!SECRET) { console.log('::warning::No FIREBASE_DB_SECRET secret: nothing to do.'); process.exit(0); }
const LIMIT = Date.now() + (+process.env.RUN_MIN || 345) * 60e3;   // GitHub stops a job after six hours
const AWAY = 90e3, LIVE = 6 * 3600e3;

// the engine, as in the page
const ctx = { window: {}, console, performance, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder, URL, crypto: globalThis.crypto, atob: globalThis.atob };
ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx);
for (const file of ['dds.js', 'core.js', 'bidding.js', 'play.js', 'clubswiss.js', 'clubmirror.js']) vm.runInContext(fs.readFileSync(root + 'js/' + file, 'utf8'), ctx, { filename: file });
const E = {}; for (const fn of ctx.window.BRIDGE) fn(E);
const ctFill = (plan, tmap) => plan && plan.mov === 'swiss' ? ctx.window.CTSW.fill(plan, tmap, E) : plan;   // the Swiss rounds made so far

const url = p => DB + '/' + p.split('/').map(encodeURIComponent).join('/') + '.json?auth=' + encodeURIComponent(SECRET);
async function get(p) { const r = await fetch(url(p)); if (!r.ok) throw new Error('GET ' + r.status); return r.json(); }
async function put(p, v) { const r = await fetch(url(p), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) }); if (!r.ok) throw new Error('PUT ' + r.status); }
const wait = ms => new Promise(r => setTimeout(r, ms));

// as js/clubtour.js has them
function ctCardOf(sys, conv) { const k = E.sysOf(sys).k, c = { ...E.sysOf(k).conv }; for (const x of conv || []) c[x] = true; return { conv: c, agg: 0, sys: k }; }
function ctCardsOf(plan, r, ti) { const t = r != null && plan.rounds[r] && plan.rounds[r][ti], P = t ? [plan.pairs[t[0]], plan.pairs[t[1]]] : []; return [0, 1].map(k => P[k] && P[k].sys ? ctCardOf(P[k].sys, []) : ctCardOf(plan.sys, plan.conv)); }
const ctBoards = (plan, r) => [...Array(plan.bpr).keys()].map(i => r * plan.bpr + i + 1);
function ctPbnDeal(str) { const m = /^([NESW]):\s*(.+)$/.exec(String(str || '').trim()); if (!m) return null; const first = 'NESW'.indexOf(m[1]), hs = m[2].trim().split(/\s+/); if (hs.length !== 4) return null; const out = [[], [], [], []], RK = '23456789TJQKA'; hs.forEach((h, k) => { const ss = h.split('.'); if (ss.length !== 4) return; ss.forEach((cs, j) => { for (const ch of cs.toUpperCase().replace('10', 'T')) { const r = RK.indexOf(ch); if (r >= 0) out[(first + k) % 4].push((3 - j) * 13 + r); } }); }); return out.every(h => h.length === 13) ? out.map(h => h.sort((a, b) => b - a)) : null; }
function ctDeal(plan, board) { const f = plan.deals && ctPbnDeal(plan.deals[board - 1]); if (f) return f; E.seed(((plan.seed >>> 0) + board * 7919) >>> 0 || 1); const d = E.shuffle([...Array(52).keys()]); E.seed(null); return [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13).sort((a, b) => b - a)); }
function ctSeatKeys(plan, r, ti) { const [ns, ew] = plan.rounds[r][ti], A = plan.pairs[ns], B = plan.pairs[ew], k = (p, w) => p.robot ? '' : (w ? p.kb : p.ka) || ''; return [k(A, 1), k(B, 0), k(A, 0), k(B, 1)]; }
const ctList_ = l => Array.isArray(l) ? l : Object.keys(l || {}).sort((a, b) => a - b).map(k => l[k]);
function ctCurRound(plan, tmap) {
  for (let r = 0; r < plan.rounds.length; r++) if (plan.rounds[r].some((x, ti) => Object.values(((tmap || {})[r + '_' + ti] || {}).res || {}).filter(Boolean).length < plan.bpr)) return r;
  return -1;
}
const ctTableEmpty = (plan, r, ti, hb) => ctSeatKeys(plan, r, ti).every(k => !k || Date.now() - (+(hb || {})[k] || 0) > AWAY);
function ctNsScore(bn, level, strain, dbl, decl, tr) { const sc = E.scoreOf(level, strain, dbl, E.vulOf(bn, decl), tr); return E.sideOf(decl) === 0 ? sc : -sc; }
// the deal fixed the robots' dice: each decision gets fresh ones (otherwise every empty table plays the same)
const ctFresh = () => E.seed(null);   // true chance again (a deal sets the dice)
function ctHeadStep(plan, r, list, res, ti) {
  const L = ctList_(list), cards = ctCardsOf(plan, r, ti); let i = 0;
  for (const bn of ctBoards(plan, r)) {
    const deal = ctDeal(plan, bn), dl = E.dealerOf(bn), auc = [];
    while (i < L.length && L[i] && L[i].c != null && !E.auctionOver(auc)) { auc.push({ seat: L[i].s, call: L[i].c }); i++; }
    if (!E.auctionOver(auc)) { const s = (dl + auc.length) % 4; ctFresh(); const b = E.aiBid(auc, s, deal[s], cards); return { n: i, a: { s, c: b.call } }; }
    const c = E.contractOf(auc);
    if (!c) { if (!(res || {})[bn]) return { res: bn, v: { pass: 1, ns: 0 } }; continue; }
    const g = E.newPlayState(deal, c, auc, cards);
    while (i < L.length && L[i] && L[i].k != null && !E.handsEmpty(g)) { if (E.applyCard(g, L[i].s, L[i].k)) E.collect(g); i++; }
    if (!E.handsEmpty(g)) { const t = g.turn; ctFresh(); return { n: i, a: { s: t, k: E.aiPlay(g, t) } }; }
    if (!(res || {})[bn]) { const tr = g.tricks[E.sideOf(c.decl)]; return { res: bn, v: { c: [c.level, c.strain, c.dbl, c.decl], tr, ns: ctNsScore(bn, c.level, c.strain, c.dbl, c.decl, tr) } }; }
  }
  return null;
}

// the evening as the club's own tournament (as the director's Clubs page does it): pairs, tables, boards, hands, archive
async function mirror(x) {
  const bm = 'gate/clubs/' + x.club + '/bm', tmap = await get(x.p + '/t') || {}, plan = ctFill(x.plan, tmap);
  const M = ctx.window.CTMIR.build(E, plan, x.info, tmap, x.d, x.tid), s = await get(bm + '/state') || {};
  const mine = !!(s.online && s.online.tid === x.tid && +s.online.d === x.d);
  if (!mine && s.status === 'running') return;   // a tournament at the club
  if (!mine) for (const k of ['approvals', 'tableLocks', 'dd']) await put(bm + '/' + k, {});
  for (const k of ['pairs', 'movements', 'hands']) await put(bm + '/' + k, M[k]);
  const cb = mine ? await get(bm + '/boards') || {} : {};
  for (const [k, v] of Object.entries(cb)) if (v && (v.manualEdit || (v.adjusted && !v.online))) M.boards[k] = v;   // the director's corrections stay (the page sends them to the evening)
  await put(bm + '/boards', M.boards);
  const ns = mine ? { ...s, ...M.state } : M.state;
  await put(bm + '/state', ns);
  if (M.state.status === 'finished' && !(mine && s.status === 'finished')) {
    const arc = await get(bm + '/archives') || [];
    if (!arc.some(a => a && a.state && a.state.online && a.state.online.tid === x.tid && +a.state.online.d === x.d)) { arc.unshift({ state: { ...ns, _finishedAt: new Date().toISOString() }, boards: M.boards, pairs: M.pairs, movements: M.movements, hands: M.hands, dd: {}, finished: new Date().toISOString() }); await put(bm + '/archives', arc); }
  }
}
// the evenings being played now: [{ p: 'ot/<club>/<tid>/run/<d>', plan }]
let WHY = {};   // what the last look found (said in the run's notice)
async function evenings() {
  const out = [], ot = await get('ot') || {}; WHY = { tournaments: 0, evenings: 0, noTables: 0, coming: 0, old: 0, finished: 0 };
  for (const [club, T] of Object.entries(ot)) for (const [tid, t] of Object.entries(T || {})) { WHY.tournaments++; for (const [d, run] of Object.entries((t && t.run) || {})) {
    WHY.evenings++;
    if (!run || !run.plan) { WHY.noTables++; continue; }
    if (+d > Date.now()) { WHY.coming++; continue; }
    if (Date.now() - +d > LIVE) { WHY.old++; continue; }
    if (ctCurRound(ctFill(run.plan, run.t), run.t) < 0) { WHY.finished++; continue; }   // finished
    out.push({ p: 'ot/' + club + '/' + tid + '/run/' + d, plan: run.plan, name: (t.info && t.info.n) || tid, club, tid, d: +d, info: t.info || {} });
  } }
  return out;
}
(async () => {
  let L = await evenings(), seen = Date.now(), look = Date.now(), steps = 0;
  if (!L.length) { console.log('::notice::Database reached; no online club evening being played now. Found: ' + Object.entries(WHY).map(([k, v]) => k + ' ' + v).join(', ')); return; }
  console.log('::notice::Playing on: ' + L.map(x => x.name).join(', '));
  let beat = 0, mirAt = 0;
  while (Date.now() < LIMIT) {
    if (Date.now() - look > 60e3) { L = await evenings().catch(() => L); look = Date.now(); if (L.length) seen = Date.now(); }
    if (!L.length && Date.now() - seen > 10 * 60e3) break;   // nothing for ten minutes: the next run looks again
    let moved = false;
    if (Date.now() - (mirAt || 0) > 10e3) { mirAt = Date.now(); for (const x of L) await mirror(x).catch(e => console.log('mirror', e.message)); }
    if (Date.now() - beat > 30e3) { beat = Date.now(); for (const x of L) await put(x.p + '/bot', Date.now()).catch(() => {}); }   // the director sees the server's robots at work
    for (const x of L) {
      try {
        if (await get(x.p + '/plan/bpr') == null) continue;   // deleted meanwhile: nothing written
        const tmap = await get(x.p + '/t') || {}, plan = ctFill(x.plan, tmap), r = ctCurRound(plan, tmap); if (r < 0) continue;
        const hb = await get(x.p + '/hb') || {};
        for (let ti = 0; ti < plan.rounds[r].length; ti++) {
          if (!ctTableEmpty(plan, r, ti, hb)) continue;
          const tb = tmap[r + '_' + ti] || {}, st = ctHeadStep(plan, r, tb.a, tb.res, ti); if (!st) continue;
          const q = x.p + '/t/' + r + '_' + ti + (st.res ? '/res/' + st.res : '/a/' + st.n);
          if (await get(q) != null) continue;   // an app was quicker
          await put(q, st.v || st.a); moved = true; steps++;
        }
      } catch (e) { console.log(x.name, e.message); }
    }
    await wait(moved ? 1000 : 4000);
  }
  console.log('Steps played:', steps);
  // stopped by the time limit with an evening still being played: the next run at once
  if (L.length && Date.now() >= LIMIT && process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY) {
    const r = await fetch('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + '/actions/workflows/clubs.yml/dispatches', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.GH_TOKEN, Accept: 'application/vnd.github+json' }, body: JSON.stringify({ ref: 'main' }) }).catch(() => null);
    console.log('::notice::Next run started: ' + (r && r.status));
  }
})().catch(e => { console.log('::error::' + e.message); process.exit(0); });
