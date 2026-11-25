/* BridgePlay (new) — a club tournament's standings from its boards: matchpoints (2 for each result beaten, 1 for each
   one equalled, compared with every other table that played the same board number) and cross-IMPs averaged over the
   other results; an adjusted score (A+, A, A−, 0) gives its share of the top and ±3 IMPs. */
const IMP_STEPS = [20, 50, 90, 130, 170, 220, 270, 320, 370, 430, 500, 600, 750, 900, 1100, 1300, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000];
export const imps = d => { const a = Math.abs(d); let i = 0; while (i < IMP_STEPS.length && a >= IMP_STEPS[i]) i++; return d < 0 ? -i : i; };
const ADJ_PCT = { 'A+': 0.6, A: 0.5, 'A-': 0.4, 0: 0 }, ADJ_IMP = { 'A+': 3, A: 0, 'A-': -3, 0: -8 };

export function standings(boards, movements, pairs) {
  const B = boards || {}, M = movements || {}, byBoard = {};
  for (const [key, b] of Object.entries(B)) {
    if (!b || b.status !== 'done' || b.notPlayed) continue;
    const [t, r, bn] = key.split('_'), m = M[r + '_' + t] || {};
    (byBoard[bn] = byBoard[bn] || []).push({ ns: m.ns, ew: m.ew, s: typeof b.nsScore === 'number' ? b.nsScore : null, adj: typeof b.nsScore === 'number' ? null : [b.nsScore, b.ewScore] });
  }
  const P = {};
  const add = (id, mp, top, imp) => { if (!id) return; const x = P[id] || (P[id] = { mp: 0, top: 0, imp: 0, boards: 0 }); x.mp += mp; x.top += top; x.imp += imp; x.boards++; };
  for (const all of Object.values(byBoard)) {
    const sc = all.filter(x => x.s != null), n = sc.length, atop = Math.max(2, (n - 1) * 2);
    for (const x of all) if (x.adj && ADJ_PCT[x.adj[0]] != null) { const [a, b] = x.adj, bb = ADJ_PCT[b] != null ? b : a; add(x.ns, ADJ_PCT[a] * atop, atop, ADJ_IMP[a]); add(x.ew, ADJ_PCT[bb] * atop, atop, ADJ_IMP[bb]); }
    if (n < 2) continue;
    const top = (n - 1) * 2;
    for (const x of sc) {
      let mp = 0, imp = 0;
      for (const y of sc) if (y !== x) { mp += x.s > y.s ? 2 : x.s === y.s ? 1 : 0; imp += imps(x.s - y.s); }
      imp /= n - 1;
      add(x.ns, mp, top, imp); add(x.ew, top - mp, top, -imp);
    }
  }
  const pp = pairs || {};
  return Object.values(pp).filter(p => p && !p.isPhantom).map(p => {
    const x = P[p.id] || { mp: 0, top: 0, imp: 0, boards: 0 };
    return { id: p.id, name: p.name || p.id, dir: p.dir || '', mp: Math.round(x.mp * 10) / 10, pct: x.top ? Math.round(x.mp / x.top * 1000) / 10 : 0, imp: Math.round(x.imp * 10) / 10, boards: x.boards };
  });
}
// a team match: each board's IMPs to the team that won it (the first table of each match against its mirror)
export function teamScore(state, movements, boards) {
  const s = state || {}, mv = movements || {}, B = boards || {}; let a = 0, b = 0;
  for (let r = 1; r <= (s.roundCount || 1); r++) for (let t = 1; t <= (s.tableCount || 0); t += 2) {
    const m = mv[r + '_' + t]; if (!m) continue;
    for (let n = m.boardStart; n <= m.boardEnd; n++) {
      const d1 = B[t + '_' + r + '_' + n], d2 = B[(t + 1) + '_' + r + '_' + n];
      if (!d1 || !d2 || d1.status !== 'done' || d2.status !== 'done' || typeof d1.nsScore !== 'number' || typeof d2.nsScore !== 'number') continue;
      const i = imps(d1.nsScore - d2.nsScore); if (i > 0) a += i; else b -= i;
    }
  }
  return { a, b, ta: (s.teams && s.teams.A && s.teams.A.name) || 'A', tb: (s.teams && s.teams.B && s.teams.B.name) || 'B' };
}
