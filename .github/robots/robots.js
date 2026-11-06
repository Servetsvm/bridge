// The robots' table (Bridge Table's home page: 🤖 Robot table — live): four robots with made-up names play each other
// all day, one system after another (SAYC first, then 2/1, Acol, French Standard, Precision, Polish Club) and in each
// system every convention, ten boards each, on deals where the convention comes up. There is no server: this script
// plays the boards ahead of time and gives each one its start time; the page shows every call and card at its time, so
// everyone watching sees the same card at the same moment. Each board is compared with the double-dummy best contract
// (the robots' and the systems' league) and checked card by card (the robots' mistakes, for Servet's report).
// Run by .github/workflows/robots.yml every two hours: node .github/robots/robots.js <dir> (the dir holds live.json).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '../..') + '/';
const OUT = path.resolve(process.argv[2] || root + 'robots-out') + '/';
const AHEAD = (+process.env.AHEAD_MIN || 300) * 60e3;   // boards are ready this far ahead of now (the run every two hours may start late)
const KEEP = 40;            // boards already played kept for the page's list
const ERRS = 300;           // the robots' mistakes kept
const PER = 10;             // boards of each system / convention
// the pace the page shows them at (it reads these from the file)
const TM = { call: 2500, lead: 3000, card: 2200, trick: 1800, end: 15000 };

// the engine, as in the page (the fast solver too)
const ctx = { window: {}, console, performance, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder, URL, crypto: globalThis.crypto, atob: globalThis.atob };
ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx);
for (const file of ['dds.js', 'core.js', 'bidding.js', 'play.js']) vm.runInContext(fs.readFileSync(root + 'js/' + file, 'utf8'), ctx, { filename: file });
const E = {}; for (const fn of ctx.window.BRIDGE) fn(E);

// the robots: made-up names from many countries, in eight pairs; two pairs sit down for each system / convention
const PAIRS = [['Astrid Halvorsen', 'Mateo Ferrari'], ['Leila Haddad', 'Jonas Becker'], ['Yuki Tanaka', 'Rafael Moreno'], ['Ingrid Novak', 'Omar Benali'],
  ['Chloé Laurent', 'Viktor Petrov'], ['Ananya Rao', 'Lukas Kowalski'], ['Sofia Lindgren', 'Kenji Mori'], ['Elif Aydın', 'Daniel Okafor']];
const SYS = ['sayc', 'twoone', 'acol', 'sef', 'precision', 'polish'];
const CARD_KEYS = ['lav', 'roman'];   // ways of discarding, not bids
const BASICS = ['jtr', 'strong2c', 'weak2', 'nego', 'takeout', 'bw', 'cue', 'pre', 'runout'];
// the program: each system on its own first, then each of its conventions
const BLOCKS = [];
for (const k of SYS) {
  const on = E.sysOf(k).conv;
  BLOCKS.push({ sys: k, conv: '' });
  for (const c of E.CONVS) if (on[c.k] && !CARD_KEYS.includes(c.k)) BLOCKS.push({ sys: k, conv: c.k });
  for (const b of BASICS) BLOCKS.push({ sys: k, conv: b });
}
const OPT = { budget: 500, maxSamples: 40, ddTricks: 12, ddDecl: 13, evLim: 800000, minSamples: 16, cap: 2000,
  lead: { budget: 1500, maxSamples: 60, minSamples: 30, evLim: 1500000, cap: 4000 } };

const over = a => (a.length >= 4 && a.slice(-3).every(e => e.call === 'P') && a.some(e => e.call !== 'P')) || (a.length === 4 && a.every(e => e.call === 'P'));
function bidAll(deal, dealer, cards) {
  const auc = [];
  while (!over(auc) && auc.length < 60) { const t = (dealer + auc.length) % 4, r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
  return auc;
}
const cardsFor = (sys, conv) => [0, 1].map(() => { const c = { conv: { ...E.sysOf(sys).conv }, agg: 0, sys }; if (conv) c.conv[conv] = true; return c; });
// a deal for the block: the convention is used in the auction (either side); the system's own block: any played deal
function findDeal(blk, dealer, cards) {
  for (let i = 0; i < 3000; i++) {
    const d = E.shuffle([...Array(52).keys()]), deal = [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13));
    const auc = bidAll(deal, dealer, cards), c = E.contractOf(auc);
    if (!c) continue;
    if (!blk.conv || auc.some(e => e.m && e.m.cv === blk.conv)) return { deal, auc, c };
  }
  return null;
}
// the double-dummy best contract (no sacrifices): the side with the higher score that makes
function best(deal, bn) {
  const tab = [0, 1, 2, 3].map(d => [0, 1, 2, 3, 4].map(st => E.ddContract(deal, { level: 1, strain: st, decl: d, dbl: 0 })));
  let top = [null, null];
  for (let d = 0; d < 4; d++) for (let st = 0; st < 5; st++) {
    const tr = tab[d][st]; if (tr < 7) continue;
    for (let l = 1; l <= tr - 6; l++) { const s = E.scoreOf(l, st, 0, E.vulOf(bn, d), tr), sd = E.sideOf(d); if (!top[sd] || s > top[sd].s) top[sd] = { s, c: [l, st, 0, d] }; }
  }
  const ns = top[0] ? top[0].s : 0, ew = top[1] ? top[1].s : 0;
  return ns >= ew ? { par: ns, c: top[0] ? top[0].c : null } : { par: -ew, c: top[1].c };
}
// a board's length on the page (as the page counts it)
const dur = b => TM.call * b.a.length + (b.p.length ? TM.lead + TM.card * (b.p.length - 1) + TM.trick * 13 : 0) + TM.end;

let prev = null; try { prev = JSON.parse(fs.readFileSync(OUT + 'live.json', 'utf8')); } catch (e) {}
const st = prev && prev.st ? prev.st : { blk: 0, k: 0, n: 0, end: 0, skip: {} };
const league = prev && prev.league ? prev.league : { pairs: PAIRS.map((n, i) => ({ i, n, r: 1500, b: 0 })), sys: {}, conv: {} };
let boards = prev && prev.boards ? prev.boards : [], errs = []; try { errs = JSON.parse(fs.readFileSync(OUT + 'errors.json', 'utf8')); } catch (e) {}
const now = Date.now();
if (!st.end || st.end < now) st.end = now + 20e3;   // nothing ahead (the first run, or a long stop): start now
const t0 = performance.now();

async function main() {
  try { const m = await vm.runInContext('ddsFactory', ctx)(); E.ddsUse(m); } catch (e) { console.log('no DDS', e.message); }
  let made = 0;
  while (st.end < now + AHEAD && performance.now() - t0 < 80 * 60e3) {
    const blk = BLOCKS[st.blk % BLOCKS.length], key = blk.sys + ':' + blk.conv;
    if (st.skip[key]) { st.blk++; st.k = 0; continue; }
    const bn = st.n % 16 + 1, dealer = E.dealerOf(bn), cards = cardsFor(blk.sys, blk.conv);
    const f = findDeal(blk, dealer, cards);
    if (!f) { st.skip[key] = 1; st.blk++; st.k = 0; console.log('no deal for', key); continue; }
    const { deal, auc, c } = f;
    const g = E.newPlayState(deal, { level: c.level, strain: c.strain, dbl: c.dbl, decl: c.decl }, auc, cards);
    while (g.history.length < 13) { if (g.trick.length === 4) { E.collect(g); continue; } const s = g.turn, x = E.aiPlay(g, s, OPT); if (E.applyCard(g, s, x)) E.collect(g); }
    const pl = g.history.map(t => t.cards.map(x => [x.s, x.c])), tricks = g.tricks[E.sideOf(c.decl)];
    const sd = E.scoreOf(c.level, c.strain, c.dbl, E.vulOf(bn, c.decl), tricks), ns = E.sideOf(c.decl) === 0 ? sd : -sd;
    const bp = best(deal, bn), imp = E.imps(ns - bp.par);
    const pi = (2 * st.blk) % PAIRS.length, pj = (2 * st.blk + 1) % PAIRS.length;
    const b = { n: st.n, t0: st.end, sys: blk.sys, conv: blk.conv, k: st.k + 1, of: PER, bn, dealer, ns: pi, ew: pj, d: deal,
      a: auc.map(e => [e.seat, e.call, (e.m && e.m.t) || '', (e.m && e.m.cv) || '']), p: pl.flat().map(x => x[1]), lead: (c.decl + 1) % 4,
      c: [c.level, c.strain, c.dbl, c.decl], tr: tricks, sc: ns, par: bp.par, pc: bp.c, imp };
    b.t1 = b.t0 + dur(b);
    boards.push(b); made++;
    // the league: each pair's rating moves with its IMPs against the best contract; each system / convention: how
    // close to it the robots come (both pairs play the same system, so the IMPs themselves add up to nothing there)
    const P = league.pairs; P[pi].r += 2 * imp; P[pj].r -= 2 * imp; P[pi].b++; P[pj].b++;
    for (const [m, k] of [[league.sys, blk.sys], [league.conv, blk.conv || '-']]) { const x = m[k] || (m[k] = { b: 0, abs: 0, hit: 0 }); x.b++; x.abs += Math.abs(imp); if (!imp) x.hit++; }
    // the robots' mistakes: every card checked double dummy (for Servet's report)
    try {
      const er = E.analysePlay(deal, c, pl, [0, 1, 2, 3], 1e6);
      if (er.length) errs.unshift({ n: b.n, ts: b.t0, b: bn, sys: blk.sys, conv: blk.conv, c: b.c, d: deal, a: auc.map(e => [e.seat, e.call]), p: pl, er: er.map(x => [x.t, x.s, x.c, x.b, x.lost]) });
    } catch (e) {}
    st.end = b.t1; st.n++; st.k++;
    if (st.k >= PER) { st.blk++; st.k = 0; }
    console.log(key, 'board', b.n, c.level + 'CDHSN'[c.strain] + ['', 'X', 'XX'][c.dbl], 'NESW'[c.decl], tricks, ns, 'par', bp.par, 'imp', imp, Math.round(performance.now() - t0) / 1000 + 's');
  }
  const played = boards.filter(b => b.t1 <= now); boards = played.slice(-KEEP).concat(boards.filter(b => b.t1 > now));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(OUT + 'live.json', JSON.stringify({ v: 1, at: now, tm: TM, pairs: PAIRS, st, league, boards }));
  fs.writeFileSync(OUT + 'errors.json', JSON.stringify(errs.slice(0, ERRS)));
  console.log('made', made, 'boards; ahead until', new Date(st.end).toISOString());
}
main().catch(e => { console.error(e); process.exit(1); });
