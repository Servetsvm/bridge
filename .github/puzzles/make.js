// The daily puzzle's bank (js/puzzles.json): deals bid by the robots (2/1) to a game or a slam that exactly one lead beats,
// double dummy. Run by hand: node .github/puzzles/make.js <out.json> <how many> <first seed> [minutes]
// Each entry: d = the four hands (N E S W; South leads, East declares), l = dealer, a = the calls, c = [level, strain],
// v = the tricks the defence takes after each of South's cards (card:tricks).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '../..') + '/js/', OUT = process.argv[2], WANT = +process.argv[3] || 10, SEED0 = +process.argv[4] || 1, MIN = +process.argv[5] || 5;
const ctx = { window: {}, console, performance, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder, URL, crypto: globalThis.crypto, atob: globalThis.atob };
ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx);
for (const f of ['dds.js', 'core.js', 'bidding.js', 'play.js']) vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f });
const E = {}; for (const fn of ctx.window.BRIDGE) fn(E);
const cards = [0, 1].map(() => ({ conv: { ...E.sysOf('twoone').conv }, agg: 0, sys: 'twoone' }));
const over = a => (a.length >= 4 && a.slice(-3).every(e => e.call === 'P') && a.some(e => e.call !== 'P')) || (a.length === 4 && a.every(e => e.call === 'P'));
(async () => {
  E.ddsUse(await vm.runInContext('ddsFactory', ctx)());
  const res = [], t0 = Date.now(); let tried = 0, games = 0, uniq = 0;
  for (let seed = SEED0; res.length < WANT && Date.now() - t0 < MIN * 60e3; seed++) {
    tried++;
    E.seed(seed >>> 0 || 1);
    const p = E.shuffle([...Array(52).keys()]), d0 = [0, 1, 2, 3].map(s => p.slice(s * 13, s * 13 + 13)), dealer0 = seed % 4;
    E.seed(null);
    const auc = [];
    while (!over(auc) && auc.length < 40) { const t = (dealer0 + auc.length) % 4, r = E.aiBid(auc, t, d0[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
    const c = E.contractOf(auc);
    if (!c || c.dbl || !(c.level >= 4 || (c.level === 3 && c.strain === 4))) continue;
    games++;
    const rot = (1 - c.decl + 4) % 4, d = [0, 0, 0, 0]; d0.forEach((h, s) => { d[(s + rot) % 4] = h; });
    const dealer = (dealer0 + rot) % 4, hand = d[2], hands = d.map(h => h.slice());
    const vals = E.ddsValues(hands, [], 2, c.strain === 4 ? -1 : c.strain);
    if (!vals || !hand.every(x => vals.has(x))) continue;
    const need = 8 - c.level, W = hand.filter(x => vals.get(x) >= need);
    if (!W.length || !W.every(x => E.S(x) === E.S(W[0]) && vals.get(x) === vals.get(W[0]))) continue;
    const s = E.S(W[0]), suit = hand.filter(x => E.S(x) === s).sort((a, b) => b - a);
    const at = W.map(x => suit.indexOf(x)).sort((a, b) => a - b);
    if (at[at.length - 1] - at[0] !== at.length - 1) continue;
    if (!W.every((x, i) => !i || Math.abs(E.R(x) - E.R(W[i - 1])) === 1) || W.length > 2) continue;   // one card (or two equal touching ones)
    uniq++;
    // nothing that gives it away: not partner's suit, a singleton, or the top of a sequence
    const partner = (0 - rot + 4) % 4;
    if (auc.some(e => e.seat === partner && typeof e.call === 'number' && e.call % 5 === s)) continue;
    if (suit.length === 1) continue;
    if (at[0] === 0 && suit.length > 1 && E.R(suit[0]) >= 9 && E.R(suit[0]) - E.R(suit[1]) === 1) continue;
    res.push({ d, l: dealer, a: auc.map(e => e.call), c: [c.level, c.strain], v: hand.map(x => [x, vals.get(x)]) });
    fs.writeFileSync(OUT, JSON.stringify(res));
  }
  console.log(JSON.stringify({ made: res.length, tried, games, uniq, sec: Math.round((Date.now() - t0) / 1000) }));
})().catch(e => { console.error(e); process.exit(1); });
