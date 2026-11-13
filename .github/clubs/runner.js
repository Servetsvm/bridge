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
if (!SECRET) { console.log('No FIREBASE_DB_SECRET: nothing to do.'); process.exit(0); }
const LIMIT = Date.now() + (+process.env.RUN_MIN || 345) * 60e3;   // GitHub stops a job after six hours
const AWAY = 90e3, LIVE = 6 * 3600e3;

// the engine, as in the page
const ctx = { window: {}, console, performance, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder, URL, crypto: globalThis.crypto, atob: globalThis.atob };
ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx);
for (const file of ['dds.js', 'core.js', 'bidding.js', 'play.js']) vm.runInContext(fs.readFileSync(root + 'js/' + file, 'utf8'), ctx, { filename: file });
const E = {}; for (const fn of ctx.window.BRIDGE) fn(E);

const url = p => DB + '/' + p.split('/').map(encodeURIComponent).join('/') + '.json?auth=' + encodeURIComponent(SECRET);
async function get(p) { const r = await fetch(url(p)); if (!r.ok) throw new Error('GET ' + r.status); return r.json(); }
async function put(p, v) { const r = await fetch(url(p), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) }); if (!r.ok) throw new Error('PUT ' + r.status); }
const wait = ms => new Promise(r => setTimeout(r, ms));

// as js/clubtour.js has them
const ctCardsOf = plan => { const sys = E.sysOf(plan.sys).k, conv = { ...E.sysOf(sys).conv }; for (const k of plan.conv || []) conv[k] = true; return [{ conv, agg: 0, sys }, { conv: { ...conv }, agg: 0, sys }]; };
const ctBoards = (plan, r) => [...Array(plan.bpr).keys()].map(i => r * plan.bpr + i + 1);
function ctDeal(plan, board) { E.seed(((plan.seed >>> 0) + board * 7919) >>> 0 || 1); const d = E.shuffle([...Array(52).keys()]); return [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13).sort((a, b) => b - a)); }
function ctSeatKeys(plan, r, ti) { const [ns, ew] = plan.rounds[r][ti], A = plan.pairs[ns], B = plan.pairs[ew], k = (p, w) => p.robot ? '' : (w ? p.kb : p.ka) || ''; return [k(A, 1), k(B, 0), k(A, 0), k(B, 1)]; }
const ctList_ = l => Array.isArray(l) ? l : Object.keys(l || {}).sort((a, b) => a - b).map(k => l[k]);
function ctCurRound(plan, tmap) {
  for (let r = 0; r < plan.rounds.length; r++) if (plan.rounds[r].some((x, ti) => Object.keys(((tmap || {})[r + '_' + ti] || {}).res || {}).length < plan.bpr)) return r;
  return -1;
}
const ctTableEmpty = (plan, r, ti, hb) => ctSeatKeys(plan, r, ti).every(k => !k || Date.now() - (+(hb || {})[k] || 0) > AWAY);
function ctNsScore(bn, level, strain, dbl, decl, tr) { const sc = E.scoreOf(level, strain, dbl, E.vulOf(bn, decl), tr); return E.sideOf(decl) === 0 ? sc : -sc; }
function ctHeadStep(plan, r, list, res) {
  const L = ctList_(list), cards = ctCardsOf(plan); let i = 0;
  for (const bn of ctBoards(plan, r)) {
    const deal = ctDeal(plan, bn), dl = E.dealerOf(bn), auc = [];
    while (i < L.length && L[i] && L[i].c != null && !E.auctionOver(auc)) { auc.push({ seat: L[i].s, call: L[i].c }); i++; }
    if (!E.auctionOver(auc)) { const s = (dl + auc.length) % 4, b = E.aiBid(auc, s, deal[s], cards); return { n: i, a: { s, c: b.call } }; }
    const c = E.contractOf(auc);
    if (!c) { if (!(res || {})[bn]) return { res: bn, v: { pass: 1, ns: 0 } }; continue; }
    const g = E.newPlayState(deal, c, auc, cards);
    while (i < L.length && L[i] && L[i].k != null && !E.handsEmpty(g)) { if (E.applyCard(g, L[i].s, L[i].k)) E.collect(g); i++; }
    if (!E.handsEmpty(g)) { const t = g.turn; return { n: i, a: { s: t, k: E.aiPlay(g, t) } }; }
    if (!(res || {})[bn]) { const tr = g.tricks[E.sideOf(c.decl)]; return { res: bn, v: { c: [c.level, c.strain, c.dbl, c.decl], tr, ns: ctNsScore(bn, c.level, c.strain, c.dbl, c.decl, tr) } }; }
  }
  return null;
}

// the evenings being played now: [{ p: 'ot/<club>/<tid>/run/<d>', plan }]
async function evenings() {
  const out = [], ot = await get('ot') || {};
  for (const [club, T] of Object.entries(ot)) for (const [tid, t] of Object.entries(T || {})) for (const [d, run] of Object.entries((t && t.run) || {})) {
    if (!run || !run.plan || +d > Date.now() || Date.now() - +d > LIVE) continue;
    if (ctCurRound(run.plan, run.t) < 0) continue;   // finished
    out.push({ p: 'ot/' + club + '/' + tid + '/run/' + d, plan: run.plan, name: (t.info && t.info.n) || tid });
  }
  return out;
}
(async () => {
  let L = await evenings(), seen = Date.now(), look = Date.now(), steps = 0;
  if (!L.length) { console.log('No online club evening now.'); return; }
  console.log('Playing on:', L.map(x => x.name).join(', '));
  while (Date.now() < LIMIT) {
    if (Date.now() - look > 60e3) { L = await evenings().catch(() => L); look = Date.now(); if (L.length) seen = Date.now(); }
    if (!L.length && Date.now() - seen > 10 * 60e3) break;   // nothing for ten minutes: the next run looks again
    let moved = false;
    for (const x of L) {
      try {
        const tmap = await get(x.p + '/t') || {}, r = ctCurRound(x.plan, tmap); if (r < 0) continue;
        const hb = await get(x.p + '/hb') || {};
        for (let ti = 0; ti < x.plan.rounds[r].length; ti++) {
          if (!ctTableEmpty(x.plan, r, ti, hb)) continue;
          const tb = tmap[r + '_' + ti] || {}, st = ctHeadStep(x.plan, r, tb.a, tb.res); if (!st) continue;
          const q = x.p + '/t/' + r + '_' + ti + (st.res ? '/res/' + st.res : '/a/' + st.n);
          if (await get(q) != null) continue;   // an app was quicker
          await put(q, st.v || st.a); moved = true; steps++;
        }
      } catch (e) { console.log(x.name, e.message); }
    }
    await wait(moved ? 1000 : 4000);
  }
  console.log('Steps played:', steps);
})().catch(e => { console.log(e.message); process.exit(0); });
