/* An online club evening as the club's own tournament (Clubs admin: Players, Movement, Tables, Boards, History, Log,
   the screen, PBN, the archive): the pairs, the rounds' tables, each finished board (as a table device enters it:
   contract, declarer, result, lead, scores) and the hands, made from the evening's plan and what its tables played.
   Used by the director's Clubs page and by the GitHub run (.github/clubs/runner.js); the table devices are not used. */
(function (W) {
  const SN = ['♣', '♦', '♥', '♠', 'NT'], SUIT = ['♣', '♦', '♥', '♠'], DIR = 'NESW', RK = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], PB = '23456789TJQKA';
  const VUL = ['None', 'NS', 'EW', 'Both', 'NS', 'EW', 'Both', 'None', 'Both', 'EW', 'NS', 'None', 'Both', 'NS', 'EW', 'None'];
  const vul = bn => VUL[(bn - 1) % 16];
  const listOf = l => Array.isArray(l) ? l : Object.keys(l || {}).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b).map(k => l[k]);
  function ctPbnDeal(str) { const m = /^([NESW]):\s*(.+)$/.exec(String(str || '').trim()); if (!m) return null; const first = 'NESW'.indexOf(m[1]), hs = m[2].trim().split(/\s+/); if (hs.length !== 4) return null; const out = [[], [], [], []], RK = '23456789TJQKA'; hs.forEach((h, k) => { const ss = h.split('.'); if (ss.length !== 4) return; ss.forEach((cs, j) => { for (const ch of cs.toUpperCase().replace('10', 'T')) { const r = RK.indexOf(ch); if (r >= 0) out[(first + k) % 4].push((3 - j) * 13 + r); } }); }); return out.every(h => h.length === 13) ? out.map(h => h.sort((a, b) => b - a)) : null; }
  function deal(E, plan, bn) { const f = plan.deals && ctPbnDeal(plan.deals[bn - 1]); if (f) return f; E.seed(((plan.seed >>> 0) + bn * 7919) >>> 0 || 1); const d = E.shuffle([...Array(52).keys()]); E.seed(null); return [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13).sort((a, b) => b - a)); }
  // each board's opening lead at a table (the first card after the bidding)
  function leads(E, plan, r, list) {
    const L = listOf(list), out = {}; let i = 0;
    for (let k = 0; k < plan.bpr; k++) {
      const bn = r * plan.bpr + k + 1, auc = [];
      while (i < L.length && L[i] && L[i].c != null && !E.auctionOver(auc)) { auc.push({ seat: L[i].s, call: L[i].c }); i++; }
      if (!E.auctionOver(auc)) break;
      if (!E.contractOf(auc)) continue;
      if (i < L.length && L[i] && L[i].k != null) out[bn] = L[i].k;
      while (i < L.length && L[i] && L[i].k != null) i++;   // the board's cards (to the next board's first call)
    }
    return out;
  }
  // the club's tournament: state, pairs, movements, boards, hands
  function build(E, plan, info, tmap, at, tid) {
    const R = plan.nr || plan.rounds.length, bpr = plan.bpr, cur = (() => { for (let r = 0; r < plan.rounds.length; r++) if (plan.rounds[r].some((x, ti) => Object.values(((tmap || {})[r + '_' + ti] || {}).res || {}).filter(Boolean).length < bpr)) return r; return plan.rounds.length < R ? plan.rounds.length : -1; })();
    const pairs = {}, movements = {}, boards = {}, hands = [];
    plan.pairs.forEach((p, i) => { pairs['p' + (i + 1)] = { id: 'p' + (i + 1), name: p.robot ? '🤖 Robot' : (p.a + ' – ' + p.b), dir: '', startTable: 0, isPhantom: false, online: 1 }; });
    plan.rounds.forEach((tb, r) => tb.forEach(([a, b], ti) => {
      movements[(r + 1) + '_' + (ti + 1)] = { ns: 'p' + (a + 1), ew: 'p' + (b + 1), boardStart: r * bpr + 1, boardEnd: r * bpr + bpr };
      const T = (tmap || {})[r + '_' + ti] || {}, ld = leads(E, plan, r, T.a);
      for (const [bn, v] of Object.entries(T.res || {})) {
        if (!v) continue;
        const key = (ti + 1) + '_' + (r + 1) + '_' + bn, base = { vuln: vul(+bn), status: 'done', online: 1, adjusted: !!v.adj, time: new Date(at + 60e3 * (r * bpr + 1)).toISOString() };
        if (v.pass || !v.c) { boards[key] = { ...base, contract: v.pass ? 'PASS' : 'ADJ(' + (v.ns || 0) + '/' + (-(v.ns || 0)) + ')', nsScore: v.ns || 0, ewScore: -(v.ns || 0), level: null, suit: null, declarer: null, result: 0, doubled: '', lead: '' }; continue; }
        const [lv, st, db, dc] = v.c, res = (v.tr != null ? v.tr : lv + 6) - (lv + 6), dbl = ['', 'X', 'XX'][db || 0], lk = ld[bn];
        boards[key] = { ...base, contract: lv + SN[st] + dbl + ' ' + DIR[dc] + (res >= 0 ? ' +' + (res || '=') : res), level: lv, suit: SN[st], declarer: DIR[dc], result: res, doubled: dbl,
          lead: lk != null ? SUIT[(lk / 13) | 0] + RK[lk % 13] : '', leadSuit: lk != null ? SUIT[(lk / 13) | 0] : '', leadRank: lk != null ? RK[lk % 13] : '', nsScore: v.ns || 0, ewScore: -(v.ns || 0) };
      }
    }));
    const hand = h => [3, 2, 1, 0].map(s => h.filter(c => ((c / 13) | 0) === s).map(c => PB[c % 13]).join('')).join('.');
    for (let bn = 1; bn <= R * bpr; bn++) hands.push({ board: String(bn), deal: 'N:' + deal(E, plan, bn).map(hand).join(' '), vulnerable: vul(bn), dealer: DIR[E.dealerOf(bn)] });
    const state = { name: String(info.n || 'Online'), tableCount: (plan.rounds[0] || []).length, boardsPerRound: bpr, totalBoards: R * bpr, roundCount: R, phantom: false,
      status: cur < 0 ? 'finished' : 'running', currentRound: cur < 0 ? R : cur + 1, movement: plan.mov || 'howell', scoring: 'BOTH', online: { tid, d: at }, _startedAt: new Date(at).toISOString() };
    return { state, pairs, movements, boards, hands };
  }
  W.CTMIR = { build };
})(typeof window !== 'undefined' ? window : globalThis);
