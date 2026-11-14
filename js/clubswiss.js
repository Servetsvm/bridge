/* Swiss for the online club tournaments (Bridge Table → Clubs → Online, movement "Swiss"). The first round is made
   with the plan; each later round is made when every table has finished the round before: the pairs ranked by the
   result so far (MP %, or IMP when the tournament is scored in IMP), then paired down the list — first with second,
   third with fourth — leaving out a pair already met where it can. Nothing is written: every app (and the GitHub run,
   .github/clubs/runner.js) works the rounds out the same way from the calls and cards the tables wrote, which nobody
   can change afterwards (a director's corrected score does not move the pairings already made). */
(function (W) {
  // the boards a table has finished, with North-South's score: { board: ns }
  function played(E, plan, r, list) {
    const L = Array.isArray(list) ? list : Object.keys(list || {}).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b).map(k => list[k]);
    const out = {}; let i = 0;
    for (let k = 0; k < plan.bpr; k++) {
      const bn = r * plan.bpr + k + 1, auc = [];
      while (i < L.length && L[i] && L[i].c != null && !E.auctionOver(auc)) { auc.push({ seat: L[i].s, call: L[i].c }); i++; }
      if (!E.auctionOver(auc)) break;
      const c = E.contractOf(auc);
      if (!c) { out[bn] = 0; continue; }
      const trump = c.strain < 4 ? c.strain : -1; let n = 0, won = 0;
      while (i < L.length && L[i] && L[i].k != null && n < 52) {
        const tr = L.slice(i, i + 4); if (tr.length < 4 || tr.some(x => !x || x.k == null)) { i += tr.length; n = 99; break; }
        if (E.sideOf(E.trickWinner(tr.map(x => ({ s: x.s, c: x.k })), trump)) === E.sideOf(c.decl)) won++;
        i += 4; n += 4;
      }
      if (n !== 52) break;
      const sc = E.scoreOf(c.level, c.strain, c.dbl, E.vulOf(bn, c.decl), won);
      out[bn] = E.sideOf(c.decl) === 0 ? sc : -sc;
    }
    return out;
  }
  // the pairs best first after the rounds made so far (ties: the pair registered first)
  function standing(E, plan, rounds, scores) {
    const n = plan.pairs.length, tot = plan.pairs.map(() => ({ mp: 0, n: 0, imp: 0 })), B = {};
    rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => { for (const [bn, ns] of Object.entries(scores[r + '_' + ti] || {})) (B[bn] || (B[bn] = [])).push({ a, b, ns }); }));
    for (const L of Object.values(B)) {
      const avg = Math.round(L.reduce((s, q) => s + q.ns, 0) / L.length / 10) * 10;
      for (const q of L) {
        const o = L.filter(z => z !== q), mp = o.length ? o.reduce((s, z) => s + (q.ns > z.ns ? 2 : q.ns === z.ns ? 1 : 0), 0) / (2 * o.length) * 100 : 50, imp = E.imps(q.ns - avg);
        tot[q.a].mp += mp; tot[q.a].n++; tot[q.a].imp += imp;
        tot[q.b].mp += 100 - mp; tot[q.b].n++; tot[q.b].imp -= imp;
      }
    }
    const val = i => plan.sc === 'imp' ? tot[i].imp : (tot[i].n ? tot[i].mp / tot[i].n : 50);
    return [...Array(n).keys()].sort((x, y) => val(y) - val(x) || x - y);
  }
  // the plan with every round that can be made now (the plan itself when it is not Swiss)
  function fill(plan, tmap, E) {
    if (!plan || plan.mov !== 'swiss' || !E) return plan;
    const R = plan.nr || plan.rounds.length, rounds = [plan.rounds[0]], scores = {};
    for (let r = 0; r < R; r++) {
      if (r > 0) {
        // the round before over at every table: the next one is made
        const met = new Set(); rounds.forEach(tb => tb.forEach(([a, b]) => met.add(Math.min(a, b) + '|' + Math.max(a, b))));
        const left = standing(E, plan, rounds, scores), tb = [];
        while (left.length > 1) {
          const a = left.shift(); let j = left.findIndex(b => !met.has(Math.min(a, b) + '|' + Math.max(a, b))); if (j < 0) j = 0;
          const b = left.splice(j, 1)[0];
          tb.push(r % 2 ? [b, a] : [a, b]);   // North-South in turn
        }
        rounds.push(tb);
      }
      let done = true;
      rounds[r].forEach((x, ti) => { const s = played(E, plan, r, ((tmap || {})[r + '_' + ti] || {}).a); scores[r + '_' + ti] = s; if (Object.keys(s).length < plan.bpr) done = false; });
      if (!done) break;
    }
    return { ...plan, rounds, nr: R };
  }
  W.CTSW = { fill, played };
})(typeof window !== 'undefined' ? window : globalThis);
