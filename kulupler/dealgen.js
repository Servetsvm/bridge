/* BridgeGate — boards made automatically (a background worker): random deals, or deals on which the chosen conventions
   come up in the robots' auction (Bridge Table's bidding engine, js/core.js and js/bidding.js). Every deal is shuffled
   with the device's secure random numbers.
   In:  { meta: true }                                   → { meta: { systems: [{k,n}], convs: [{k,n}] } }
        { n, from, sys, convs: [keys], ms }              → { progress: i } …, then { done: [{ board, cards: [N,E,S,W] }], hit }
   A card is 0..51: suit * 13 + rank (suit 0 = ♣ … 3 = ♠, rank 0 = 2 … 12 = A). */
self.window = self;
importScripts('../js/core.js', '../js/bidding.js');
const E = {}; for (const fn of self.BRIDGE) fn(E);
const CARD_KEYS = ['lav', 'roman'];   // ways of discarding: not bids
const BASICS = ['jtr', 'strong2c', 'weak2', 'nego', 'takeout', 'bw', 'cue', 'pre', 'runout'];
const over = a => (a.length >= 4 && a.slice(-3).every(e => e.call === 'P') && a.some(e => e.call !== 'P')) || (a.length === 4 && a.every(e => e.call === 'P'));
self.onmessage = e => {
  const m = e.data || {};
  if (m.meta) {
    const name = k => (E.convInfo(k) || {}).n || k;
    const keys = BASICS.concat(E.CONVS.map(c => c.k)).filter((k, i, A) => A.indexOf(k) === i && !CARD_KEYS.includes(k) && E.convInfo(k));
    self.postMessage({ meta: { systems: E.SYSTEMS.map(s => ({ k: s.k, n: s.n })), convs: keys.map(k => ({ k, n: name(k), basic: BASICS.includes(k) })) } });
    return;
  }
  const sys = E.sysOf(m.sys).k, want = (m.convs || []).filter(k => E.convInfo(k));
  const cfg = () => { const c = { conv: { ...E.sysOf(sys).conv }, agg: 0, sys }; want.forEach(k => { c.conv[k] = true; }); return c; };
  const cards = [cfg(), cfg()], out = [], seen = new Set(); let hit = 0;
  for (let i = 0; i < m.n; i++) {
    const board = (m.from || 1) + i, dealer = E.dealerOf(board), t0 = Date.now();
    let pick = null, first = null, used = [];
    // the conventions in turn, so that each comes up: this board looks for one of them, any other one will do too
    const aim = want.length ? want[i % want.length] : null;
    for (let k = 0; k < 4000; k++) {
      const p = E.shuffle([...Array(52).keys()]), deal = [0, 1, 2, 3].map(s => p.slice(s * 13, s * 13 + 13)), key = E.dealKey(deal);
      if (seen.has(key)) continue;
      if (!want.length) { pick = deal; break; }
      if (!first) first = deal;
      const auc = [];
      while (!over(auc) && auc.length < 60) { const t = (dealer + auc.length) % 4, r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
      const u = auc.filter(x => x.m && want.includes(x.m.cv)).map(x => x.m.cv).filter((k, j, A) => A.indexOf(k) === j);
      if (u.includes(aim) || (u.length && Date.now() - t0 > (m.ms || 1500) / 2)) { pick = deal; used = u; hit++; break; }
      if (Date.now() - t0 > (m.ms || 1500)) break;
    }
    pick = pick || first;
    seen.add(E.dealKey(pick));
    out.push({ board, cards: pick, used });
    self.postMessage({ progress: i + 1 });
  }
  self.postMessage({ done: out, hit });
};
