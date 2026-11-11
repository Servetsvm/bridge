// The daily puzzle's declarer problems (js/puzzles-play.json): deals bid by the robots (2/1) to a game or a slam where the
// natural card from dummy at trick one goes down and one line makes, judged as the hand of the day's declarer problems
// (.github/daily/daily.js playProblem: this deal and 200 deals of the defenders' cards, double dummy after the card).
// Run by hand: node .github/puzzles/makeplay.js <out.json> <how many> <minutes>
// Each entry: d = the four hands (N E S W), l = dealer, a = the calls, c = [level, strain, dbl, declarer], ld = the lead,
// pk = the card from dummy that makes it, gd = every card that makes it as surely, nt = the natural card, np = its %.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const OUT = process.argv[2], WANT = +process.argv[3] || 10, MIN = +process.argv[4] || 10;
const file = path.join(__dirname, '..', 'daily', 'daily.js');
let src = fs.readFileSync(file, 'utf8');
const cut = src.indexOf("\n(async () => {\n  const m = await vm.runInContext('ddsFactory', ctx)(); E.ddsUse(m);");
if (cut < 0) throw new Error('daily.js changed: the main part was not found');
src = src.slice(0, cut) + `
(async () => {
  const m = await vm.runInContext('ddsFactory', ctx)(); E.ddsUse(m);
  const res = [], t0 = Date.now(), why = {}; let tried = 0;
  while (res.length < ${WANT} && Date.now() - t0 < ${MIN} * 60e3) {
    tried++;
    const p = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = require('crypto').randomInt(i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    const deal = [0, 1, 2, 3].map(s => p.slice(s * 13, s * 13 + 13));
    const dl = require('crypto').randomInt(4), auc = []; while (!over(auc) && auc.length < 60) { const t = (dl + auc.length) % 4, r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
    let pp; try { pp = playProblem(deal, auc); } catch (e) { pp = 'error ' + e.message; }
    if (typeof pp === 'string') { why[pp] = (why[pp] || 0) + 1; continue; }
    const c = contractOf(auc);
    res.push({ d: deal, l: dl, a: auc.map(e => e.call), c: [c.level, c.strain, c.dbl, c.decl], ld: pp.lead, pk: pp.pick, gd: pp.good, nt: pp.nat, np: pp.natPct });
    fs.writeFileSync(${JSON.stringify(OUT)}, JSON.stringify(res));
    console.log('found', res.length, Math.round((Date.now() - t0) / 1000) + 's');
  }
  console.log(JSON.stringify({ made: res.length, tried, why }));
})().catch(e => { console.error(e); process.exit(1); });
`;
// the daily file's own bidAll uses its fixed dealer: here each deal is bid from its own dealer (above)
const tmp = path.join(__dirname, '..', 'daily', '_makeplay_tmp.js');
fs.writeFileSync(tmp, src);
try { require(tmp); } finally { setTimeout(() => { try { fs.unlinkSync(tmp); } catch (e) {} }, 3000); }
