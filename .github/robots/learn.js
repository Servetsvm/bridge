// The robots' lesson book (run by .github/workflows/robots.yml after the six tables: node .github/robots/learn.js <dir>).
// From every mistake of the robots' closed-hand play on the six tables, old and new (the counts add up run after run) (errors-<system>.json: each mistake's context and
// the kinds of the card played and of the better one, double dummy) it writes the candidate lessons: for each kind of
// position, how often one kind of card was played where another was better (net). The tables then play every other
// board with the candidate lessons (league.ab in live-<system>.json counts the tricks lost by each arm); once both arms
// have enough boards, the candidate is accepted if it loses clearly fewer tricks (the app's robots then use it, and
// Servet is told what was learned), else dropped; either way a new candidate is made from the mistakes so far.
const fs = require('fs'), path = require('path');
const DIR = path.resolve(process.argv[2] || 'out') + '/';
const SYS = ['sayc', 'twoone', 'acol', 'sef', 'precision', 'polish'];
const MIN = 3;          // a lesson: a kind better at least this many times more often than the reverse (net)
const TRIAL = 300;      // boards each arm needs before the candidate is judged
const GAIN = 0.95;      // the candidate is accepted when its arm loses at most 95% of the tricks the other arm loses

const read = f => { try { return JSON.parse(fs.readFileSync(DIR + f, 'utf8')); } catch (e) { return null; } };
let L = read('lessons.json') || { cand: null, acc: null, hist: [] };

// the engine (the card kinds of the mistakes kept from before they were written down)
const vm = require('vm'), ROOT = path.resolve(__dirname, '../..') + '/';
const ctx = { window: {}, console, performance, setTimeout, clearTimeout, URL };
ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx);
for (const file of ['core.js', 'play.js']) vm.runInContext(fs.readFileSync(ROOT + 'js/' + file, 'utf8'), ctx, { filename: file });
const E = {}; for (const fn of ctx.window.BRIDGE) fn(E);
function kindsOf(r, x) {
  const c = { level: r.c[0], strain: r.c[1], dbl: r.c[2], decl: r.c[3] }, g = E.newPlayState(r.d, c, [], null);
  for (let ti = 0; ti < x[0] - 1; ti++) { for (const [s, k] of r.p[ti]) E.applyCard(g, s, k); E.collect(g); }
  for (const [s, k] of r.p[x[0] - 1]) { if (s === x[1]) break; E.applyCard(g, s, k); }
  return [E.cardCtx(g, x[1]), E.cardKind(g, x[1], x[2]), E.cardKind(g, x[1], x[3])];
}
// every mistake of the six tables not counted yet goes into the counts (weighted by the tricks it lost); then the book:
// for each context the kinds better clearly more often than the reverse (net)
function makeBook() {
  const raw = L.raw || (L.raw = {}), seen = L.seen || (L.seen = {});
  let added = 0;
  for (const k of SYS) {
    const list = read('errors-' + k + '.json') || [], was = new Set(seen[k] || []);
    for (const r of list) {
      if (was.has(r.n) || !r.p || !r.d) continue;
      for (const e of r.er || []) {
        const x = Array.isArray(e) ? e : [e.t, e.s, e.c, e.b, e.lost];
        let kk = x.length >= 8 ? x.slice(5, 8) : null;
        if (!kk) { try { kk = kindsOf(r, x); } catch (er) { continue; } }
        const [cx, kp, kb] = kk; if (kp === kb) continue;
        const m = raw[cx] || (raw[cx] = {}); m[kp + '>' + kb] = (m[kp + '>' + kb] || 0) + x[4]; added++;
      }
    }
    seen[k] = list.map(r => r.n);   // what this table's file holds now: counted
  }
  console.log('mistakes added to the counts', added);
  const book = {};
  for (const [cx, m] of Object.entries(raw)) for (const [k, v] of Object.entries(m)) {
    const [pa, pb] = k.split('>'), net = v - (m[pb + '>' + pa] || 0);
    if (net >= MIN) (book[cx] || (book[cx] = {}))[k] = net;
  }
  return book;
}
const size = b => Object.values(b || {}).reduce((t, m) => t + Object.keys(m).length, 0);

// the trial so far: the six tables' boards of each arm against the candidate
const ab = { L: { b: 0, lost: 0 }, B: { b: 0, lost: 0 } };
for (const k of SYS) { const d = read('live-' + k + '.json'), a = d && d.league && d.league.ab; if (!a || !L.cand || a.v !== L.cand.v) continue; for (const arm of ['L', 'B']) { ab[arm].b += a[arm].b; ab[arm].lost += a[arm].lost; } }
const per = a => a.b ? a.lost / a.b : 0;
console.log('candidate', L.cand && L.cand.v, 'lessons', size(L.cand && L.cand.book), 'with', JSON.stringify(ab.L), 'without', JSON.stringify(ab.B));

const book = makeBook();   // the counts brought up to date every run
let fresh = false;
if (!L.cand || !size(L.cand.book)) fresh = true;   // none yet, or an empty one (the mistakes had no kinds yet)
else if (ab.L.b >= TRIAL && ab.B.b >= TRIAL) {
  const ok = per(ab.L) <= per(ab.B) * GAIN;
  L.hist = (L.hist || []).concat([{ v: L.cand.v, at: Date.now(), n: size(L.cand.book), L: ab.L, B: ab.B, ok }]).slice(-50);
  if (ok) L.acc = { v: L.cand.v, at: Date.now(), book: L.cand.book, gain: Math.round(100 * (1 - per(ab.L) / per(ab.B))), tr: describe(L.cand.book) };
  console.log(ok ? 'accepted' : 'dropped', per(ab.L).toFixed(3), 'against', per(ab.B).toFixed(3));
  fresh = true;
}
if (fresh) { L.cand = { v: ((L.cand && L.cand.v) || 0) + 1, at: Date.now(), book }; console.log('new candidate', L.cand.v, 'lessons', size(book)); }
fs.writeFileSync(DIR + 'lessons.json', JSON.stringify(L));

// the lessons in Turkish, for Servet (the strongest first)
function describe(book) {
  const ctxT = c => (c[0] === 'D' ? 'Deklaran tarafı' : 'Savunma') + ', ' + (c[1] === 'N' ? 'SA' : 'renk kontratı') + ', ' + ['levéeyi açarken', '2. elde', '3. elde', '4. elde'][+c[2]];
  const kindT = { T: 'koz', Lh: 'uzun renkten onör', Lx: 'uzun renkten küçük kart', Mh: 'üçlü renkten onör', Mx: 'üçlü renkten küçük kart', Sh: 'kısa renkten onör', Sx: 'kısa renkten küçük kart', W: 'levéeyi alan kart', l: 'en küçük kart', m: 'aradan bir kart', R: 'koz kesmek', dh: 'onör ıskarta', dx: 'küçük ıskarta' };
  return Object.entries(book).flatMap(([c, m]) => Object.entries(m).map(([k, v]) => [c, k, v])).sort((a, b) => b[2] - a[2]).slice(0, 5)
    .map(([c, k, v]) => { const [a, b] = k.split('>'); return `${ctxT(c)}: ${kindT[a] || a} yerine ${kindT[b] || b} (${v} kez daha iyi çıktı)`; });
}
