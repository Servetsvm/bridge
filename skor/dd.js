/* BricSkor — double-dummy analysis of the boards: how many tricks each player can take as declarer in each
   strain with all four hands open and best play on both sides, and the par result of the board.
   The solver (partition search with a transposition table) comes from Bridge Table
   (https://servetsvm.github.io/bridge). This file runs both in the page (BGDD.*) and as a background worker. */
(function (G) {
'use strict';
// cards are 0..51: suit * 13 + rank, suit 0 = clubs, 1 = diamonds, 2 = hearts, 3 = spades; rank 0 = 2 … 12 = ace
const S = c => (c / 13) | 0, R = c => c % 13, sideOf = s => s & 1;

const DD = { M: new Int32Array(16), pS: new Int8Array(64), pC: new Int8Array(64), ply: 0, tn: 0, leader: 0, left: 0, trump: -1, side: 0, nodes: 0, limit: 0, ws: 0, wm: 0 };
const DDX = { limit: true };
const DDF = { hint: true, qt: true, ord: true, ttMin: 3, lord: 900, lord2: 500, sec: -20, disc: 3, qx: true, olen: 0, lt: 0, rt: 0, wh: true, kt: true, k2: false, scan: 250, k0: false, cut: true };
const pc32 = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return Math.imul((x + (x >>> 4)) & 0x0F0F0F0F, 0x01010101) >>> 24; };
/* transposition table for positions at the start of a trick (partition search). The search also reports which cards'
   ranks mattered for its result: a card that won a trick over a card of its own suit, the top cards behind the sure-trick
   bounds, the ranks behind a table entry it used. An entry then stores, per suit, only the owners of the cards from the top
   down to the lowest card that mattered, and it holds for every position with the same leader, the same suit lengths in
   each hand and the same owners of those top cards: the smaller cards are interchangeable. Each entry is a fact about such
   positions (the side counted and the trump suit are in the key), so the table is kept between probes, evaluations and deals. */

let TTH = 0, TTP = 0, THead = null, EK = null, EP = null, ED = null, EV = null, ER = null, ENx = null, EN = 0;
const RW = new Int32Array(66 * 4), PV = new Int32Array(66 * 4), PL = new Int8Array(66 * 4), QD = new Int8Array(4);
// best card by suit lengths alone (leader, side and trump too): a first try when the table has no entry for the position
let KTB = 0, KTK = null, KTV = null;
// 2^bits entries of 37 bytes (+4 for the bucket heads): sized by the node limit, so a robot playing a card keeps a small table
function ttInit(limit) {
  const bits = DDF.ttBits || (limit >= 2e7 ? 20 : limit >= 2e6 ? 18 : 16);
  if (TTP >= 1 << bits) return;
  TTH = bits; TTP = 1 << bits; EN = 0;
  THead = new Int32Array(1 << TTH).fill(-1); EK = new Int32Array(TTP * 3); EP = new Int32Array(TTP * 4);
  ED = new Uint16Array(TTP); EV = new Int8Array(TTP * 3); ER = new Int8Array(TTP); ENx = new Int32Array(TTP);
  KTB = bits - 2; KTK = new Int32Array(2 << KTB); KTV = new Int8Array(1 << KTB).fill(-1);
}
function ttHash(lk0, lk1, lk2) {
  let h = Math.imul(lk0, 0x9E3779B1) ^ Math.imul(lk1 ^ 0x5BD1E995, 0x85EBCA77) ^ Math.imul(lk2, 0xC2B2AE3D);
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 13;
  return h >>> (32 - TTH);
}
/* the table is full: keep the entries with the most tricks left (about half of them, they save the most work) */
function ttCompact() {
  const cnt = new Int32Array(14);
  for (let e = 0; e < EN; e++) cnt[ER[e]]++;
  let keep = 0, cut = 13;
  while (cut > 0 && keep + cnt[cut] <= TTP >> 1) keep += cnt[cut--];
  THead.fill(-1); let j = 0;
  for (let e = 0; e < EN; e++) {
    if (ER[e] <= cut) continue;
    if (j !== e) {
      EK.copyWithin(j * 3, e * 3, e * 3 + 3); EP.copyWithin(j * 4, e * 4, e * 4 + 4); EV.copyWithin(j * 3, e * 3, e * 3 + 3);
      ED[j] = ED[e]; ER[j] = ER[e];
    }
    const hb = ttHash(EK[j * 3], EK[j * 3 + 1], EK[j * 3 + 2]);
    ENx[j] = THead[hb]; THead[hb] = j; j++;
  }
  EN = j;
}
/* the top k remaining cards of suit s, as a rank mask */
function topMask(s, k) {
  const M = DD.M; let all = M[s] | M[4 + s] | M[8 + s] | M[12 + s], m = 0;
  while (k-- > 0 && all) { const b = 1 << (31 - Math.clz32(all)); m |= b; all ^= b; }
  return m;
}
/* winner of the trick just completed; DD.ws / DD.wm: suit and rank bit of the winning card when it beat a card of its own
   suit (then its rank mattered), else DD.wm = 0 */
function ddWinner() {
  const b0 = DD.ply - 4; let bs = DD.pS[b0], bc = DD.pC[b0];
  for (let i = b0 + 1; i < DD.ply; i++) { const c = DD.pC[i]; if ((((c / 13) | 0) === ((bc / 13) | 0) && c > bc) || (((c / 13) | 0) === DD.trump && ((bc / 13) | 0) !== DD.trump)) { bc = c; bs = DD.pS[i]; } }
  const su = (bc / 13) | 0; let same = false;
  for (let i = b0; i < DD.ply; i++) { const c = DD.pC[i]; if (c !== bc && ((c / 13) | 0) === su) { same = true; break; } }
  DD.ws = su; DD.wm = same ? 1 << (bc % 13) : 0;
  return bs;
}
/* can opponent o still beat a card of suit s, rank r, in a trick led in suit ls? */
function beatsAt(o, s, r, ls) {
  const M = DD.M, tr = DD.trump, oL = M[o * 4 + ls];
  if (s === ls) return (oL >> (r + 1)) !== 0 || (!oL && tr >= 0 && ls !== tr && M[o * 4 + tr] !== 0);
  return !oL && (M[o * 4 + tr] >> (r + 1)) !== 0;
}
/* legal cards of `seat` (one per run of equal cards), best first, into MVB at this ply; returns how many */
const MVB = new Int8Array(64 * 14), MVS = new Int16Array(64 * 14);
function ddMoves(seat, hint) {
  const M = DD.M, tn = DD.tn, t0 = DD.ply - tn, base = DD.ply * 14, tr = DD.trump;
  let n = 0, s0 = 0, s1 = 4, bc = -1, bs = -1, bSu = -1;
  if (tn > 0) {
    const ls = (DD.pC[t0] / 13) | 0; if (M[seat * 4 + ls]) { s0 = ls; s1 = ls + 1; }
    bs = DD.pS[t0]; bc = DD.pC[t0]; bSu = ls;
    for (let i = t0 + 1; i < DD.ply; i++) { const c = DD.pC[i], cs = (c / 13) | 0; if ((cs === bSu && c > bc) || (cs === tr && bSu !== tr)) { bc = c; bs = DD.pS[i]; bSu = cs; } }
  }
  const pWin = tn > 0 && (bs & 1) === (seat & 1), p = (seat + 2) & 3, bR = bc % 13;
  const ls = tn > 0 ? (DD.pC[t0] / 13) | 0 : -1, oNext = tn === 1 || tn === 2 ? (seat + 1) & 3 : -1;
  for (let s = s0; s < s1; s++) {
    const my = M[seat * 4 + s]; if (!my) continue;
    let all = M[s] | M[4 + s] | M[8 + s] | M[12 + s];
    for (let i = t0; i < DD.ply; i++) { const c = DD.pC[i]; if (((c / 13) | 0) === s) all |= 1 << (c % 13); }
    const len = pc32(my), top = 31 - Math.clz32(all), pTop = (M[p * 4 + s] >> top) & 1;
    // trump play for a lead: an opponent who can ruff it, partner who can ruff it
    let lAdj = 0;
    if (tn === 0 && (DDF.olen || DDF.lt || DDF.rt)) {
      const lh = (seat + 1) & 3, rh = (seat + 3) & 3, tb = 1 << top;
      lAdj -= DDF.olen * (pc32(M[lh * 4 + s]) + pc32(M[rh * 4 + s]));
      if (!(my & tb) && !pTop) lAdj -= (M[lh * 4 + s] & tb ? DDF.lt : 0) + (M[rh * 4 + s] & tb ? DDF.rt : 0);
    }
    if (tn === 0 && DDF.lord && tr >= 0 && s !== tr) {
      const lh = (seat + 1) & 3, rh = (seat + 3) & 3;
      if ((!M[lh * 4 + s] && M[lh * 4 + tr]) || (!M[rh * 4 + s] && M[rh * 4 + tr])) lAdj -= DDF.lord;
      else if (!M[p * 4 + s] && M[p * 4 + tr]) lAdj += DDF.lord2;
    }
    let inG = false;
    for (let r = 12; r >= 0; r--) {
      const bit = 1 << r;
      if (my & bit) {
        if (inG) continue;
        inG = true; const c = s * 13 + r; let sc;
        // leader: cash winners first, then lead toward partner's winners, then low from long suits;
        // others: if partner is winning play low, otherwise the cheapest winner first
        if (c === hint) sc = 10000;
        else if (tn === 0) sc = (r === top ? 1000 + 10 * len : pTop ? 600 - 10 * r : 200 + 10 * len - 2 * r) + lAdj;
        else if (DDF.ord) {
          const win = (s === bSu && r > bR) || (s === tr && bSu !== tr);
          if (pWin) sc = oNext >= 0 && beatsAt(oNext, bSu, bR, ls) ? (beatsAt(oNext, s, r, ls) || !win ? -r : 300 - r) : s === tr && ls !== tr ? -50 - r : -r;
          else sc = !win ? (s !== ls && s !== tr && DDF.disc ? DDF.disc * pc32(my) - r : -r) : oNext < 0 || !beatsAt(oNext, s, r, ls) ? 300 - r : tn === 1 ? DDF.sec - r : 100 - r;
        }
        else if (pWin) sc = -r;
        else sc = (s === bSu && r > bR) || (s === tr && bSu !== tr) ? 100 - r : -r;
        let j = n++;
        while (j > 0 && MVS[base + j - 1] < sc) { MVB[base + j] = MVB[base + j - 1]; MVS[base + j] = MVS[base + j - 1]; j--; }
        MVB[base + j] = c; MVS[base + j] = sc;
      } else if (all & bit) inG = false;
    }
  }
  return n;
}
/* sure tricks the leader's side can cash without losing the lead: the leader's top cards (capped where an opponent could
   ruff), plus partner's top cards in one suit the leader can cross in, when partner can keep them while the leader cashes.
   QD[s]: how many top cards of each suit this relies on */
function quickTricks(ld, left) {
  const M = DD.M, tr = DD.trump, p = (ld + 2) & 3, o1 = (ld + 1) & 3, o2 = (ld + 3) & 3;
  let q = 0, cross = 0, pq = 0, ent = false;
  QD[0] = QD[1] = QD[2] = QD[3] = 0;
  for (let s = 0; s < 4; s++) {
    const mine = M[ld * 4 + s], pm = M[p * 4 + s]; if (!mine && !pm) continue;
    let all = M[s] | M[4 + s] | M[8 + s] | M[12 + s];
    const tb = 1 << (31 - Math.clz32(all)), hold = (mine & tb) ? mine : (pm & tb) ? pm : 0;
    if (!hold) continue;
    let k = 0;
    while (all) { const bit = 1 << (31 - Math.clz32(all)); if (!(hold & bit)) break; k++; all ^= bit; }
    if (tr >= 0 && s !== tr) {
      if (M[o1 * 4 + tr]) k = Math.min(k, pc32(M[o1 * 4 + s]));
      if (M[o2 * 4 + tr]) k = Math.min(k, pc32(M[o2 * 4 + s]));
    }
    QD[s] = k;
    if (hold === mine) q += k;
    else if (DDF.qx) { pq += k; if (mine && k) ent = true; }
    else if (mine && k > cross) cross = k;
  }
  if (DDF.qx) cross = ent ? pq : 0;
  return q + cross <= left ? q + cross : Math.min(left, Math.max(q, cross));
}
/* trumps of one hand of side `sd` above every opponent's trump: each of them wins a trick whenever it is played */
function sureTrumps(sd) {
  const M = DD.M, t = DD.trump, o = M[((sd + 1) & 3) * 4 + t] | M[((sd + 3) & 3) * 4 + t];
  let above = -1;
  if (o) {
    const ot = 31 - Math.clz32(o), d = pc32((M[t] | M[4 + t] | M[8 + t] | M[12 + t]) >>> ot);
    above = ~((1 << (ot + 1)) - 1); if (d > QD[t]) QD[t] = d;
  }
  return Math.max(pc32(M[sd * 4 + t] & above), pc32(M[(sd + 2) * 4 + t] & above));
}
function lastTrick(ld) {
  const M = DD.M, tr = DD.trump; let bs = ld, bSu = -1, bR = -1, same = false;
  for (let i = 0; i < 4; i++) {
    const s = (ld + i) & 3; let su = 0; while (!M[s * 4 + su]) su++;
    const r = 31 - Math.clz32(M[s * 4 + su]);
    if (i === 0 || (su === bSu && r > bR) || (su === tr && bSu !== tr)) { same = su === bSu; bs = s; bSu = su; bR = r; }
    else if (su === bSu) same = true;
  }
  DD.ws = bSu; DD.wm = same ? 1 << bR : 0;
  return (bs & 1) === DD.side ? 1 : 0;
}
/* tricks for DD.side from here (fail-soft alpha-beta). RW at this ply gets the ranks the result depends on. */
function ddSearch(alpha, beta) {
  if (++DD.nodes > DD.limit) throw DDX;
  const M = DD.M, P4 = DD.ply * 4;
  let hb = -1, ki = 0, a0 = alpha, b0 = beta, hint = -1, r = 0, lk0 = 0, lk1 = 0, lk2 = 0;
  RW[P4] = RW[P4 + 1] = RW[P4 + 2] = RW[P4 + 3] = 0;
  if (DD.tn === 0) {
    const ld = DD.leader; r = DD.left;
    if (r === 0) return 0;
    if (alpha >= r) return r; if (beta <= 0) return 0;
    if (r === 1) { const v = lastTrick(ld); RW[P4 + DD.ws] = DD.wm; return v; }
    const ST_ = DDF.stats; if (ST_) ST_[r * 4]++;
    if (DDF.qt) {
      const q = quickTricks(ld, r), sm = DD.trump >= 0 ? sureTrumps(ld & 1) : 0, so = DD.trump >= 0 ? sureTrumps((ld & 1) ^ 1) : 0;
      const lbL = q > sm ? q : sm, mine = (ld & 1) === DD.side, lo = mine ? lbL : so, hi = r - (mine ? so : lbL);
      if (lo > alpha || hi < beta) {
        for (let s = 0; s < 4; s++) if (QD[s]) RW[P4 + s] = topMask(s, QD[s]);
        if (lo >= beta || hi <= alpha) { if (ST_) ST_[r * 4 + 1]++; return lo >= beta ? lo : hi; }
        if (lo > alpha) alpha = lo; if (hi < beta) beta = hi;
      }
    }
    if (r >= DDF.ttMin) {
      // the position: owners of the remaining cards of each suit from the top, suit lengths of each hand
      lk2 = ld | (DD.side << 2) | ((DD.trump + 1) << 3);
      for (let s = 0; s < 4; s++) {
        const a = M[s], b = M[4 + s], c = M[8 + s], d = M[12 + s]; let all = a | b | c | d, v = 1, L = 0;
        while (all) { const bit = 1 << (31 - Math.clz32(all)); all ^= bit; v = (v << 2) | ((b & bit) ? 1 : (c & bit) ? 2 : (d & bit) ? 3 : 0); L++; }
        PV[P4 + s] = v; PL[P4 + s] = L;
        if (L && !DDF.k0) lk2 |= ((v >>> (2 * L - 2)) & 3) << (6 + 2 * s);
        if (DDF.k2 && L >= 2) lk2 |= ((v >>> (2 * L - 4)) & 3) << (14 + 2 * s);
        const ln = pc32(a) | (pc32(b) << 4) | (pc32(c) << 8) | (pc32(d) << 12);
        if (s < 2) lk0 |= ln << (16 * s); else lk1 |= ln << (16 * (s - 2));
      }
      hb = ttHash(lk0, lk1, lk2);
      let wh = -1;
      if (ST_) ST_[57]++;
      for (let e = THead[hb], n = 0; e >= 0 && n < DDF.scan; e = ENx[e], n++) {
        const e3 = e * 3, e4 = e * 4, dp = ED[e];
        if (ST_) ST_[56]++;
        if (EK[e3] !== lk0 || EK[e3 + 1] !== lk1 || EK[e3 + 2] !== lk2) continue;
        if (PV[P4] >>> 2 * (PL[P4] - (dp & 15)) !== EP[e4] || PV[P4 + 1] >>> 2 * (PL[P4 + 1] - (dp >> 4 & 15)) !== EP[e4 + 1] ||
            PV[P4 + 2] >>> 2 * (PL[P4 + 2] - (dp >> 8 & 15)) !== EP[e4 + 2] || PV[P4 + 3] >>> 2 * (PL[P4 + 3] - (dp >> 12)) !== EP[e4 + 3]) { if (wh < 0) wh = EV[e3 + 2]; continue; }
        const lo = EV[e3], hi = EV[e3 + 1], hc = EV[e3 + 2];
        if (DDF.hint && hint < 0 && hc >= 0) {
          // best card last time: suit and how many remaining cards of that suit are above it
          const s = hc >> 4; let all = M[s] | M[4 + s] | M[8 + s] | M[12 + s];
          for (let k = hc & 15; k > 0 && all; k--) all ^= 1 << (31 - Math.clz32(all));
          if (all) hint = s * 13 + 31 - Math.clz32(all);
        }
        if (lo > alpha || hi < beta) {
          for (let s = 0; s < 4; s++) RW[P4 + s] |= topMask(s, (dp >> (4 * s)) & 15);
          if (lo >= beta || hi <= alpha || lo === hi) { if (ST_) ST_[r * 4 + 2]++; return lo >= beta ? lo : hi <= alpha ? hi : lo; }
          if (lo > alpha) alpha = lo; if (hi < beta) beta = hi;
        }
      }
      const kx = lk1 ^ Math.imul(lk2 & 63, 0x9E3779B1); ki = (Math.imul(lk0 ^ (kx >>> 7), 0x2C1B3C6D) ^ Math.imul(kx, 0x85EBCA77)) >>> (32 - KTB);
      if (DDF.kt && wh < 0 && KTK[2 * ki] === lk0 && KTK[2 * ki + 1] === kx) wh = KTV[ki];
      if (DDF.wh && hint < 0 && wh >= 0) { const s = wh >> 4; let all = M[s] | M[4 + s] | M[8 + s] | M[12 + s]; for (let k = wh & 15; k > 0 && all; k--) all ^= 1 << (31 - Math.clz32(all)); if (all) hint = s * 13 + 31 - Math.clz32(all); }
    }
    a0 = alpha; b0 = beta;
  }
  const seat = (DD.leader + DD.tn) & 3, isMax = (seat & 1) === DD.side;
  const n = ddMoves(seat, hint), base = DD.ply * 14, C4 = P4 + 4;
  let best = isMax ? -1 : 99, bestC = -1, m0 = 0, m1 = 0, m2 = 0, m3 = 0;
  for (let i = 0; i < n; i++) {
    const c = MVB[base + i], su = (c / 13) | 0, bit = 1 << (c % 13);
    M[seat * 4 + su] ^= bit; DD.pS[DD.ply] = seat; DD.pC[DD.ply] = c; DD.ply++; DD.tn++;
    let v;
    if (DD.tn === 4) {
      const w = ddWinner(), ws = DD.ws, wm = DD.wm, won = (w & 1) === DD.side ? 1 : 0, sl = DD.leader;
      DD.leader = w; DD.tn = 0; DD.left--;
      v = won + ddSearch(alpha - won, beta - won);
      DD.left++; DD.tn = 4; DD.leader = sl;
      RW[C4 + ws] |= wm;
    } else v = ddSearch(alpha, beta);
    DD.ply--; DD.tn--; M[seat * 4 + su] ^= bit;
    const c0 = RW[C4], c1 = RW[C4 + 1], c2 = RW[C4 + 2], c3 = RW[C4 + 3];
    RW[P4] |= c0; RW[P4 + 1] |= c1; RW[P4 + 2] |= c2; RW[P4 + 3] |= c3;
    if (isMax ? v > best : v < best) { m0 = c0; m1 = c1; m2 = c2; m3 = c3; }
    if (isMax) { if (v > best) { best = v; bestC = c; } if (best > alpha) alpha = best; } else { if (v < best) { best = v; bestC = c; } if (best < beta) beta = best; }
    if (alpha >= beta) { if (DDF.st2) { const z = (DD.tn * 2 + (isMax ? 1 : 0)) * 4; DDF.st2[z] += 1; DDF.st2[z + 1] += i === 0 ? 1 : 0; DDF.st2[z + 2] += i; } break; }
  }
  if (DDF.st2 && alpha < beta) { const z = (DD.tn * 2 + (isMax ? 1 : 0)) * 4; DDF.st2[z + 3] += 1; }
  // a cutoff rests on the one card that gave it: only the ranks that mattered below that card count
  if (DDF.cut && (isMax ? best >= b0 : best <= a0)) { RW[P4] = m0; RW[P4 + 1] = m1; RW[P4 + 2] = m2; RW[P4 + 3] = m3; }
  if (hb >= 0) {
    // the class of positions this result holds for: per suit, the cards from the top down to the lowest that mattered
    let dp = 0;
    for (let s = 0; s < 4; s++) {
      const L = PL[P4 + s]; if (!L) continue;
      const rel = RW[P4 + s], dm = DDF.k0 ? 0 : DDF.k2 && L >= 2 ? 2 : 1; let d = dm;
      if (rel) { d = pc32((M[s] | M[4 + s] | M[8 + s] | M[12 + s]) >>> (31 - Math.clz32(rel & -rel))); if (d < dm) d = dm; }
      dp |= d << (4 * s); RW[P4 + s] = topMask(s, d);
    }
    const p0 = PV[P4] >>> 2 * (PL[P4] - (dp & 15)), p1 = PV[P4 + 1] >>> 2 * (PL[P4 + 1] - (dp >> 4 & 15));
    const p2 = PV[P4 + 2] >>> 2 * (PL[P4 + 2] - (dp >> 8 & 15)), p3 = PV[P4 + 3] >>> 2 * (PL[P4 + 3] - (dp >> 12));
    let f = -1;
    for (let e = THead[hb], k = 0; e >= 0 && k < DDF.scan; e = ENx[e], k++) {
      const e3 = e * 3, e4 = e * 4;
      if (ED[e] === dp && EK[e3] === lk0 && EK[e3 + 1] === lk1 && EK[e3 + 2] === lk2 && EP[e4] === p0 && EP[e4 + 1] === p1 && EP[e4 + 2] === p2 && EP[e4 + 3] === p3) { f = e; break; }
    }
    if (f < 0) {
      if (EN >= TTP) ttCompact();
      f = EN++; ENx[f] = THead[hb]; THead[hb] = f; ER[f] = r;
      if (DDF.stats) DDF.stats[r * 4 + 3]++;
      const e3 = f * 3, e4 = f * 4;
      EK[e3] = lk0; EK[e3 + 1] = lk1; EK[e3 + 2] = lk2; ED[f] = dp;
      EP[e4] = p0; EP[e4 + 1] = p1; EP[e4 + 2] = p2; EP[e4 + 3] = p3;
      EV[e3] = 0; EV[e3 + 1] = 13; EV[e3 + 2] = -1;
    }
    const e3 = f * 3; let lo = EV[e3], hi = EV[e3 + 1];
    if (best <= a0) { if (best < hi) hi = best; } else if (best >= b0) { if (best > lo) lo = best; } else lo = hi = best;
    EV[e3] = lo; EV[e3 + 1] = hi;
    if (bestC >= 0) {
      const s = (bestC / 13) | 0; EV[e3 + 2] = s * 16 + pc32((M[s] | M[4 + s] | M[8 + s] | M[12 + s]) >>> (bestC % 13 + 1));
      if (DDF.kt) { KTK[2 * ki] = lk0; KTK[2 * ki + 1] = lk1 ^ Math.imul(lk2 & 63, 0x9E3779B1); KTV[ki] = EV[e3 + 2]; }
    }
  }
  return best;
}
function ddLoad(hands, skipSeat, skipCard, limit) {
  ttInit(limit);
  const M = DD.M; M.fill(0);
  for (let s = 0; s < 4; s++) for (const k of hands[s]) if (!(s === skipSeat && k === skipCard)) M[s * 4 + S(k)] |= 1 << R(k);
}
/* exact value in [lo, hi]: null-window probes starting from a guess, each fail-soft result narrowing the range (MTD(f)) */
function ddSolve(lo, hi, guess) {
  let t = guess == null ? (lo + hi + 1) >> 1 : guess;
  while (lo < hi) {
    if (t <= lo) t = lo + 1; if (t > hi) t = hi;
    const v = ddSearch(t - 1, t);
    if (DDF.trace) DDF.trace.push([t, v, DD.nodes, EN]);
    if (v >= t) { lo = Math.min(v, hi); t = lo + 1; } else { hi = Math.max(v, lo); t = hi; }
  }
  return lo;
}
/* set up the position after `seat` plays c to the trick so far; returns the trick already won by seat's side (0/1) */
function ddSetup(hands, trickSoFar, seat, c, limit) {
  ddLoad(hands, seat, c, limit);
  DD.ply = 0; DD.tn = 0;
  for (const t of trickSoFar) { DD.pS[DD.ply] = t.s; DD.pC[DD.ply] = t.c; DD.ply++; DD.tn++; }
  DD.pS[DD.ply] = seat; DD.pC[DD.ply] = c; DD.ply++; DD.tn++;
  DD.leader = trickSoFar.length ? trickSoFar[0].s : seat; DD.side = seat & 1; DD.nodes = 0; DD.limit = limit;
  let base = 0;
  if (DD.tn === 4) { const w = ddWinner(); base = (w & 1) === DD.side ? 1 : 0; DD.leader = w; DD.tn = 0; DD.ply = 0; }
  DD.left = hands[seat].length - (DD.tn === 0 ? 1 : 0);
  return base;
}
/* tricks the side of `seat` takes from here (current trick included) after `seat` plays c; DD.trump must be set */
function ddEval(hands, trickSoFar, seat, c, limit, guess) {
  const base = ddSetup(hands, trickSoFar, seat, c, limit);
  return base + ddSolve(0, DD.left, guess == null ? null : guess - base);
}
/* one null-window probe: does the side of `seat` take at least t tricks from here after `seat` plays c? */
function ddAtLeast(hands, trickSoFar, seat, c, limit, t) {
  const base = ddSetup(hands, trickSoFar, seat, c, limit), tt = t - base;
  if (tt <= 0) return true; if (tt > DD.left) return false;
  return ddSearch(tt - 1, tt) >= tt;
}
/* exact tricks for `side` with `leader` on lead at a trick boundary; null when the node limit is reached */
function ddFull(hands, leader, side, trump, limit, guess) {
  ddLoad(hands, -1, -1, limit); DD.trump = trump; DD.side = side; DD.limit = limit; DD.nodes = 0;
  DD.ply = 0; DD.tn = 0; DD.leader = leader; DD.left = hands[leader].length;
  try { return ddSolve(0, DD.left, guess); } catch (e) { if (e === DDX) return null; throw e; }
}
function ddContract(deal, c, limit, guess) { return ddFull(deal, (c.decl + 1) % 4, sideOf(c.decl), c.strain < 4 ? c.strain : -1, limit || 4e6, guess); }

/* ---- BricSkor API ---- */
const SEATS = 'NESW', RANKS = '23456789TJQKA';
// a PBN deal "N:AKQ2.K73.J5.T942 …" (also "E:", "S:", "W:"; "-" or an empty hand is filled with the cards left over)
function parseDeal(str) {
  const m = String(str || '').trim().match(/^([NESW])\s*:\s*(.*)$/i); if (!m) return null;
  const first = SEATS.indexOf(m[1].toUpperCase()), parts = m[2].trim().split(/\s+/);
  const hands = [null, null, null, null], used = new Set();
  for (let i = 0; i < 4; i++) {
    const p = parts[i]; if (p == null || p === '-' || p === '') continue;
    const sp = p.split('.'); if (sp.length !== 4) return null;
    const h = [];
    for (let k = 0; k < 4; k++) for (const ch of sp[k].toUpperCase().replace(/10/g, 'T')) {
      const r = RANKS.indexOf(ch); if (r < 0) return null;
      const c = (3 - k) * 13 + r; if (used.has(c)) return null; used.add(c); h.push(c);
    }
    hands[(first + i) % 4] = h;
  }
  const empty = hands.map((h, s) => h ? -1 : s).filter(s => s >= 0);
  if (empty.length === 1) hands[empty[0]] = [...Array(52).keys()].filter(c => !used.has(c));
  if (hands.some(h => !h || h.length !== 13)) return null;
  return hands;
}
// hands back to a PBN deal string, North first
function dealString(hands) {
  return 'N:' + hands.map(h => [3, 2, 1, 0].map(s => h.filter(c => S(c) === s).sort((a, b) => R(b) - R(a)).map(c => RANKS[R(c)]).join('')).join('.')).join(' ');
}
/* tricks[declarer 0..3 = N E S W][strain 0..4 = ♣ ♦ ♥ ♠ NT] */
function ddTable(hands) {
  // every solve counts North-South's tricks (the side is part of the table's key, so positions met from one opening
  // leader are reused from the others); a declarer's tricks follow from the leader on their left
  const out = [[], [], [], []];
  for (let strain = 4; strain >= 0; strain--) {
    let guess = null;
    for (const lead of [1, 3, 0, 2]) {
      const ns = ddFull(hands, lead, 0, strain < 4 ? strain : -1, 3e8, guess);
      const decl = (lead + 3) % 4;
      out[decl][strain] = ns == null ? null : decl & 1 ? 13 - ns : ns;
      if (ns != null) guess = ns;
    }
  }
  return out;
}
/* the score of a contract for the declaring side (doubled when it goes down) */
function contractScore(level, strain, tricks, vul, dbl) {
  const need = level + 6;
  if (tricks < need) {
    const u = need - tricks;
    if (!dbl) return -u * (vul ? 100 : 50);
    if (vul) return -(u === 1 ? 200 : 200 + 300 * (u - 1));
    return -(u === 1 ? 100 : u === 2 ? 300 : u === 3 ? 500 : 500 + 300 * (u - 3));
  }
  const per = strain <= 1 ? 20 : 30, mult = dbl ? 2 : 1;
  let trickScore = (strain === 4 ? 40 + 30 * (level - 1) : per * level) * mult;
  let s = trickScore + (trickScore >= 100 ? (vul ? 500 : 300) : 50);
  if (level === 6) s += vul ? 750 : 500;
  if (level === 7) s += vul ? 1500 : 1000;
  const over = tricks - need;
  s += over * (dbl ? (vul ? 200 : 100) : per);
  if (dbl) s += 50;
  return s;
}
/* par: both sides bid as high as pays for them (a sacrifice is doubled). vul = { ns, ew } */
function par(table, vul) {
  const best = side => [0, 1, 2, 3, 4].map(st => { const a = table[side][st], b = table[side + 2][st]; return a >= b ? { t: a, decl: side } : { t: b, decl: side + 2 }; });
  const B = [best(0), best(1)], V = [vul.ns, vul.ew];
  const play = (side, rank) => { const level = ((rank / 5) | 0) + 1, strain = rank % 5, b = B[side][strain]; const made = b.t >= level + 6; return { side, rank, level, strain, decl: b.decl, tricks: b.t, dbl: !made, score: contractScore(level, strain, b.t, V[side], !made) }; };
  // the best contract each side could choose above a given one
  const top = (side, above, minScore) => { let r = null; for (let k = above + 1; k < 35; k++) { const p = play(side, k); if (p.score > minScore && (!r || p.score > r.score)) r = p; } return r; };
  let cur = null;
  const a = top(0, -1, 0), b = top(1, -1, 0);
  if (!a && !b) return { score: 0, text: 'Pass' };
  cur = !b || (a && a.score >= b.score) ? a : b;
  for (let guard = 0; guard < 40; guard++) {
    const o = 1 - cur.side, reply = top(o, cur.rank, -cur.score);
    if (!reply) break;
    cur = reply;
  }
  const ns = cur.side === 0 ? cur.score : -cur.score, diff = cur.tricks - (cur.level + 6);
  const sym = ['♣', '♦', '♥', '♠', 'NT'][cur.strain];
  return { score: ns, level: cur.level, strain: cur.strain, decl: SEATS[cur.decl], dbl: cur.dbl, tricks: cur.tricks,
    text: cur.level + sym + (cur.dbl ? 'X' : '') + ' ' + SEATS[cur.decl] + ' ' + (diff === 0 ? '=' : diff > 0 ? '+' + diff : diff) + ', NS ' + (ns > 0 ? '+' : '') + ns };
}
const VUL16 = ['None', 'NS', 'EW', 'Both', 'NS', 'EW', 'Both', 'None', 'Both', 'EW', 'NS', 'None', 'Both', 'NS', 'EW', 'None'];
function vulOf(board, given) {
  const v = String(given || '').toLowerCase();
  const t = v === 'ns' ? 'NS' : v === 'ew' ? 'EW' : v === 'all' || v === 'both' ? 'Both' : v === 'none' || v === 'love' || v === '-' ? 'None' : VUL16[(board - 1) % 16];
  return { ns: t === 'NS' || t === 'Both', ew: t === 'EW' || t === 'Both', text: t };
}
// everything for one board: the table of tricks and the par
function analyse(deal, board, vulnerable) {
  const hands = parseDeal(deal); if (!hands) return null;
  const t = ddTable(hands), v = vulOf(board, vulnerable);
  return { t, par: par(t, v) };
}

G.BGDD = { parseDeal, dealString, ddTable, par, analyse, contractScore, vulOf };

// as a background worker: { boards: [{ board, deal, vulnerable }] } in, one { board, res } per board out, then { done }
if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts === 'function') {
  self.onmessage = e => {
    const list = (e.data && e.data.boards) || [];
    for (const b of list) {
      let res = null; try { res = analyse(b.deal, +b.board, b.vulnerable); } catch (x) { res = null; }
      self.postMessage({ board: String(b.board), res });
    }
    self.postMessage({ done: true });
  };
}
})(typeof self !== 'undefined' ? self : this);
