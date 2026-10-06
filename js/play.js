/* Bridge Table — card play: play state, robot play (rules + double-dummy sampling), double-dummy solver. */
(window.BRIDGE = window.BRIDGE || []).push(function play(E) {
'use strict';
const { S, R, pd, sideOf, isNum, ST, rnd, shuffle, popc } = E;

/* ---- play state ---- */
function newPlayState(hands, contract, auction, cards) {
  return {
    lav: cards ? [0, 1].map(i => !(cards[i] && cards[i].conv && cards[i].conv.lav === false)) : [true, true],
    hands: hands.map(h => h.slice()), auction: auction || [], contract, trump: contract.strain < 4 ? contract.strain : -1,
    dummy: pd(contract.decl), dummyShown: false, leader: (contract.decl + 1) % 4, turn: (contract.decl + 1) % 4,
    trick: [], history: [], tricks: [0, 0], voids: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  };
}
function trickWinner(tr, trump) {
  let b = tr[0];
  for (let i = 1; i < tr.length; i++) { const x = tr[i]; if ((S(x.c) === S(b.c) && R(x.c) > R(b.c)) || (S(x.c) === trump && S(b.c) !== trump)) b = x; }
  return b.s;
}
const beats = (c, w, trump) => (S(c) === S(w) && R(c) > R(w)) || (S(c) === trump && S(w) !== trump);
function legalFor(g, seat) {
  const h = g.hands[seat]; if (!g.trick.length) return h.slice();
  const ls = S(g.trick[0].c), f = h.filter(c => S(c) === ls); return f.length ? f : h.slice();
}
/* play one card; returns true when the trick is now complete (call collect next) */
function applyCard(g, seat, c) {
  g.hands[seat] = g.hands[seat].filter(k => k !== c);
  if (g.trick.length && S(c) !== S(g.trick[0].c)) g.voids[seat][S(g.trick[0].c)] = 1;
  g.trick.push({ s: seat, c }); g.dummyShown = true;
  if (g.trick.length === 4) { g.turn = -1; return true; }
  g.turn = (seat + 1) % 4; return false;
}
function collect(g) {
  const w = trickWinner(g.trick, g.trump); g.tricks[sideOf(w)]++;
  g.history.push({ leader: g.trick[0].s, cards: g.trick, w }); g.trick = []; g.leader = w; g.turn = w;
  return w;
}
const handsEmpty = g => g.hands.every(h => !h.length);

/* ---- knowledge helpers ---- */
function playedSet(g) { const p = new Set(); for (const t of g.history) for (const x of t.cards) p.add(x.c); for (const x of g.trick) p.add(x.c); return p; }
function knownOurs(g, seat) {
  const s = new Set(g.hands[seat]); const decl = g.contract.decl;
  if (g.dummyShown && (seat === decl || seat === g.dummy)) for (const c of g.hands[pd(seat)]) s.add(c);
  return s;
}
function isMaster(g, c, seat) { const pl = playedSet(g), own = knownOurs(g, seat); for (let r = R(c) + 1; r < 13; r++) { const k = S(c) * 13 + r; if (!pl.has(k) && !own.has(k)) return false; } return true; }
const asc = a => a.slice().sort((x, y) => R(x) - R(y)), desc = a => a.slice().sort((x, y) => R(y) - R(x));
const inSuit = (a, s) => a.filter(c => S(c) === s);

/* ---- rule-based play ---- */
function heurPlay(g, seat) {
  const leg = legalFor(g, seat); if (leg.length === 1) return leg[0];
  const tr = g.trump, trick = g.trick, pos = trick.length;
  if (pos === 0) return sideOf(seat) === sideOf(g.contract.decl) ? declLead(g, seat) : defLead(g, seat);
  const ls = S(trick[0].c);
  const ws = trickWinner(trick, tr), wc = trick.find(t => t.s === ws).c;
  const pdWin = sideOf(ws) === sideOf(seat);
  const following = leg.some(c => S(c) === ls);
  const low = asc(leg)[0];
  if (following) {
    const mine = asc(leg), bt = mine.filter(c => beats(c, wc, tr));
    const declSide = sideOf(seat) === sideOf(g.contract.decl);
    // hold-up: in notrump, declarer ducks the opening suit once while holding a single stopper
    if (declSide && tr < 0 && g.history.length === 0 && sideOf(trick[0].s) !== sideOf(seat) && !pdWin) {
      const ours = inSuit(g.hands[seat].concat(g.hands[pd(seat)]), ls);
      const masters = ours.filter(c => isMaster(g, c, seat));
      if (masters.length === 1 && ours.length <= 3 && (pos === 3 || pos === 1)) return low;
    }
    // finesse: declarer in third seat plays the lower card of a tenace (e.g. Q from AQ) when one honour is missing between them
    if (declSide && pos === 2 && bt.length >= 2 && sideOf(trick[0].s) === sideOf(seat)) {
      const d = desc(bt), pl = playedSet(g), own = knownOurs(g, seat);
      let gap = 0; for (let r = R(d[1]) + 1; r < R(d[0]); r++) { const k = ls * 13 + r; if (!pl.has(k) && !own.has(k)) gap++; }
      if (gap === 1 && isMaster(g, d[0], seat)) return d[1];
    }
    const pLed = trick[0].s === pd(seat) && !declSide;
    if (pos === 3) return pdWin ? (pLed ? attitudeCard(g, seat, leg) : low) : (bt[0] ?? (pLed ? attitudeCard(g, seat, leg) : low));
    if (pos === 2) {
      const fourth = (seat + 1) % 4, fourthVis = g.dummyShown && fourth === g.dummy;
      if (pdWin) {
        if (fourthVis) { const fh = inSuit(g.hands[fourth], ls); const fv = fh.length ? fh : g.hands[fourth].filter(c => S(c) === tr); if (!fv.some(c => beats(c, wc, tr))) return low; }
        else if (isMaster(g, wc, seat) || R(wc) >= 9) return pLed ? attitudeCard(g, seat, leg) : low;
      }
      if (bt.length) {
        if (fourthVis) { const fh = inSuit(g.hands[fourth], ls); const top = fh.length ? desc(fh)[0] : -1; const over = bt.filter(c => top < 0 || R(c) > R(top)); return over.length ? over[0] : bt[0]; }
        const d = desc(bt), pl = playedSet(g); let pick = d[0];
        for (let i = 1; i < d.length; i++) { let eq = true; for (let r = R(d[i]) + 1; r < R(pick); r++) { if (!pl.has(ls * 13 + r)) { eq = false; break; } } if (eq) pick = d[i]; else break; }
        return pick;
      }
      return pLed ? attitudeCard(g, seat, leg) : low;
    }
    if (R(trick[0].c) >= 9 && bt.length) { const hon = bt.filter(c => R(c) >= 9); if (hon.length) return hon[0]; }
    if (bt.length && isMaster(g, desc(bt)[0], seat) && g.hands[seat].length <= 3) return desc(bt)[0];
    return low;
  }
  const trumps = asc(leg.filter(c => S(c) === tr));
  if (tr >= 0 && trumps.length) {
    const safe = pdWin && (pos === 3 || isMaster(g, wc, seat));
    if (!safe) { const win = trumps.filter(c => beats(c, wc, tr)); if (win.length) return win[0]; }
  }
  if (sideOf(seat) !== sideOf(g.contract.decl) && lavOn(g, seat)) { const c = lavDiscard(g, seat, leg, ls); if (c != null) return c; }
  return discard(g, seat, leg);
}
function discard(g, seat, leg) {
  let best = null, bs = 1e9;
  for (let s = 0; s < 4; s++) {
    if (s === g.trump) continue; const cs = asc(inSuit(leg, s)); if (!cs.length) continue;
    const masters = cs.filter(c => isMaster(g, c, seat)).length;
    const sc = masters * 10 + R(cs[cs.length - 1]) - cs.length * 0.6;
    if (sc < bs) { bs = sc; best = cs[0]; }
  }
  return best ?? asc(leg)[0];
}
/* ---- defensive signals ----
   Attitude: on partner's lead a high spot card encourages, the lowest discourages.
   Lavinthal discards: the suit discarded is not wanted; a high card asks for the higher of the two
   remaining suits (trumps and the suit led left out), a low card for the lower one. */
const DEFF = { lav: true, att: true, sig: true, dd: true };
const lavOn = (g, seat) => DEFF.lav && (!g.lav || g.lav[sideOf(seat)] !== false);
const HON = r => (r === 12 ? 4 : r === 11 ? 3 : r === 10 ? 2 : r === 9 ? 1 : 0);
/* the suit this defender would like partner to lead (needs real strength there) */
function wantSuit(g, seat, exclude) {
  let best = -1, bs = 4.5;
  for (let s = 0; s < 4; s++) {
    if (s === g.trump || exclude.includes(s)) continue;
    const cs = desc(inSuit(g.hands[seat], s)); if (!cs.length) continue;
    const r = cs.map(R);
    let sc = cs.filter(c => isMaster(g, c, seat)).length * 4 + r.reduce((a, x) => a + HON(x), 0) + cs.length * 0.4;
    if (r[0] === 11 && r[1] === 10) sc += 2;
    if (sc > bs) { bs = sc; best = s; }
  }
  return best;
}
function lavCandidates(g, x, ls) { return [0, 1, 2, 3].filter(s => s !== x && s !== g.trump && s !== ls); }
function lavDiscard(g, seat, leg, ls) {
  const want = wantSuit(g, seat, [ls]);
  let best = -1, bs = 1e9;
  for (let s = 0; s < 4; s++) {
    if (s === g.trump || s === want) continue; const cs = inSuit(leg, s); if (!cs.length) continue;
    const masters = cs.filter(c => isMaster(g, c, seat)).length;
    // keep length where dummy has a long suit we must guard
    const dl = g.dummyShown && sideOf(g.dummy) !== sideOf(seat) ? inSuit(g.hands[g.dummy], s).length : 0;
    const sc = masters * 10 + R(desc(cs)[0]) - cs.length * 0.6 + (dl >= cs.length && dl >= 3 ? 6 : 0);
    if (sc < bs) { bs = sc; best = s; }
  }
  if (best < 0) return null;
  const cs = asc(inSuit(leg, best)).filter(c => !isMaster(g, c, seat)), pool = cs.length ? cs : asc(inSuit(leg, best));
  const cand = lavCandidates(g, best, ls);
  if (want >= 0 && cand.length === 2 && cand.includes(want)) {
    const high = want === Math.max(...cand);
    const spots = pool.filter(c => R(c) <= 6);
    return high ? (spots.length ? spots[spots.length - 1] : pool[pool.length - 1]) : pool[0];
  }
  return pool[0];
}
/* attitude card when partner led the suit and we are not trying to win the trick */
function attitudeCard(g, seat, follow) {
  const ls = S(g.trick[0].c), mine = asc(follow);
  if (mine.length < 2 || !DEFF.att) return mine[0];
  const myAll = inSuit(g.hands[seat], ls).map(R);
  const like = myAll.some(r => r >= 10 && isMaster(g, ls * 13 + r, seat)) || (myAll.includes(10) && myAll.includes(9)) ||
    (g.trump >= 0 && ls !== g.trump && mine.length === 2 && inSuit(g.hands[seat], g.trump).length > 0);
  if (!like) return mine[0];
  const spots = mine.filter(c => R(c) <= 8 && !isMaster(g, c, seat));
  return spots.length >= 2 ? spots[spots.length - 1] : mine[0];
}
/* what partner's cards told us: a suit to lead, or "continue the suit I led" */
function readSignals(g, seat) {
  const p = pd(seat), tr = g.trump;
  for (let i = g.history.length - 1; i >= 0; i--) {
    const t = g.history[i], ls = S(t.cards[0].c), pc = t.cards.find(x => x.s === p); if (!pc) continue;
    if (S(pc.c) !== ls && S(pc.c) !== tr && lavOn(g, p)) {
      const cand = lavCandidates(g, S(pc.c), ls), r = R(pc.c);
      if (cand.length === 1) return { suit: cand[0], why: 'lav' };
      if (cand.length === 2 && (r >= 5 || r <= 3)) return { suit: r >= 5 ? Math.max(...cand) : Math.min(...cand), why: 'lav' };
    }
    if (t.leader === seat && S(pc.c) === ls && t.w !== p) return { suit: R(pc.c) >= 5 && R(pc.c) <= 8 ? ls : -1, why: 'att', led: ls };
  }
  return null;
}
/* text for the screen: what a partner's card means */
function signalText(g, seat, c) {
  if (!g.trick.length) return null;
  const ls = S(g.trick[0].c), s = S(c), r = R(c), SU = ['♣', '♦', '♥', '♠'], RT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  if (s !== ls && s !== g.trump && lavOn(g, seat)) {
    const cand = lavCandidates(g, s, ls);
    if (cand.length === 2 && (r >= 5 || r <= 3)) return `Partner discards ${RT[r]}${SU[s]} (Lavinthal): ${r >= 5 ? 'high — asks for the higher suit ' + SU[Math.max(...cand)] : 'low — asks for the lower suit ' + SU[Math.min(...cand)]}`;
    if (cand.length === 1) return `Partner discards ${RT[r]}${SU[s]} (Lavinthal): asks for ${SU[cand[0]]}`;
    return `Partner discards ${RT[r]}${SU[s]}: not interested in ${SU[s]}`;
  }
  if (s === ls && g.trick[0].s === pd(seat) && r <= 8) return `Partner plays ${RT[r]}${SU[s]} on your lead: ${r >= 5 ? 'high — encourages, continue the suit' : 'low — discourages'}`;
  return null;
}
const bidSuitsOf = (g, seat) => g.auction.filter(e => e.seat === seat && isNum(e.call) && ST(e.call) < 4 && !(e.m && e.m.cv && e.m.cv !== 'twoOverOne')).map(e => ST(e.call));
function leadCardFrom(cs, nt) {
  cs = desc(cs); const n = cs.length; if (n === 1) return cs[0];
  const r = cs.map(R);
  if (r[0] === 12 && r[1] === 11) return cs[0];
  if (r[0] >= 9 && r[1] === r[0] - 1) return cs[0];
  if (n >= 3 && r[0] >= 8 && r[1] === r[0] - 2 && r[2] === r[0] - 1) return cs[1];
  // interior sequence (KJ10x, AJ10x, Q109x, K109x): lead the top of the inner sequence
  if (n >= 3 && r[1] >= 8 && r[2] === r[1] - 1 && r[0] >= r[1] + 2 && (nt || r[0] !== 12)) return cs[1];
  if (n === 2) return cs[0];
  if (r[0] >= 9) return n >= 4 ? cs[3] : cs[n - 1];
  return n >= 4 && nt ? cs[3] : cs[0];
}
function defLead(g, seat) {
  const H = g.hands[seat], tr = g.trump, nt = tr < 0, first = g.history.length === 0, p = pd(seat);
  const decl = g.contract.decl, dm = g.dummy, lho = (seat + 1) % 4;
  const D = g.dummyShown ? g.hands[dm] : [];
  const declHasTrumps = tr >= 0 && !g.voids[decl][tr];
  // a lead that gives a ruff-and-discard: declarer and dummy are both out of the suit and still hold trumps
  const sluff = s => tr >= 0 && s !== tr && g.dummyShown && g.voids[decl][s] && !inSuit(D, s).length && (inSuit(D, tr).length > 0 || declHasTrumps);
  const ruffable = s => tr >= 0 && s !== tr && ((g.dummyShown && !inSuit(D, s).length && inSuit(D, tr).length > 0) || (g.voids[decl][s] && declHasTrumps));
  const avoid = new Set();
  if (!first) {
    const myLed = g.history.filter(t => t.leader === seat).map(t => S(t.cards[0].c));
    // 1. cash the setting tricks when we can see them
    const need = 14 - (g.contract.level + 6) - g.tricks[sideOf(seat)];
    let sure = 0; const cash = [];
    for (let s = 0; s < 4; s++) {
      if (s === tr || ruffable(s)) continue;
      const cs = desc(inSuit(H, s)); let k = 0; for (const c of cs) { if (isMaster(g, c, seat)) k++; else break; }
      if (k) { sure += Math.min(k, nt ? k : Math.min(k, g.dummyShown ? Math.max(1, inSuit(D, s).length) : k)); cash.push(cs[0]); }
    }
    if (cash.length && (sure >= need || !nt)) return cash[0];
    if (nt) for (const s of myLed) { const cs = desc(inSuit(H, s)); if (cs.length && isMaster(g, cs[0], seat)) return cs[0]; }
    // 2. follow partner's signal
    const sig = DEFF.sig ? readSignals(g, seat) : null;
    if (sig && sig.suit >= 0 && sig.suit !== tr && !sluff(sig.suit)) { const cs = desc(inSuit(H, sig.suit)); if (cs.length) return isMaster(g, cs[0], seat) || cs.length <= 2 ? cs[0] : cs[cs.length - 1]; }
    if (sig && sig.why === 'att' && sig.suit === -1) avoid.add(sig.led);
    // 3. return partner's suit, 4. keep setting up our long suit in notrump
    const pLed = g.history.filter(t => t.leader === p).map(t => S(t.cards[0].c)).filter(s => s !== tr && !sluff(s));
    if (pLed.length) { const cs = inSuit(H, pLed[pLed.length - 1]); if (cs.length) return desc(cs)[0]; }
    if (nt && myLed.length && !avoid.has(myLed[0])) { const cs = inSuit(H, myLed[0]); if (cs.length) return leadCardFrom(cs, nt); }
  }
  const ps = bidSuitsOf(g, p).filter(s => s !== tr && !sluff(s));
  for (let i = ps.length - 1; i >= 0; i--) { const cs = inSuit(H, ps[i]); if (cs.length) { const d = desc(cs); return cs.length >= 3 && R(d[0]) >= 9 && R(d[0]) !== 12 ? d[d.length - 1] : d[0]; } }
  const oppS = new Set([...bidSuitsOf(g, (seat + 1) % 4), ...bidSuitsOf(g, (seat + 3) % 4)]);
  const slam = g.contract.level >= 6, myTr = tr >= 0 ? inSuit(H, tr).length : 0;
  let best = null, bs = -1e9;
  for (let s = 0; s < 4; s++) {
    if (s === tr) continue; const cs = desc(inSuit(H, s)); if (!cs.length) continue; const r = cs.map(R);
    let sc = nt ? cs.length * 2 : cs.length;
    if (r.length >= 2 && r[0] >= 9 && r[1] === r[0] - 1) sc += 8 + r[0] / 4;
    if (r.length >= 3 && r[1] >= 8 && r[2] === r[1] - 1 && r[0] >= r[1] + 2) sc += 4;
    if (r[0] === 12 && r[1] === 11) sc += 6;
    if (!nt && r[0] === 12 && r[1] !== 11) sc -= slam && g.contract.level === 6 ? -2 : 5;
    if (!nt && r[0] === 11 && r[1] !== 10) sc -= 3;
    if (nt && r[0] === 12 && r[1] !== 11 && cs.length <= 3) sc -= 2;
    if (!nt && cs.length === 1 && myTr >= 1 && myTr <= 3 && !slam) sc += 4;
    if (oppS.has(s)) sc -= 4;
    if (sluff(s)) sc -= 30;
    if (avoid.has(s)) sc -= 8;
    if (g.dummyShown) {
      const dh = desc(inSuit(D, s)).map(R);
      if (dm === lho) { if (dh.length && dh[0] >= 9 && dh[0] < 12) sc += 3; }           // lead through dummy's honours
      else { if (dh.includes(12) && (dh.includes(10) || dh.includes(11))) sc -= 6; else if (!dh.length || dh[0] < 9) sc += 2; } // not into a tenace, up to weakness
    }
    if (sc > bs) { bs = sc; best = s; }
  }
  // a trump lead: when every side suit is a dangerous lead, against a grand slam, or after partner's penalty double
  if (tr >= 0 && myTr >= 1 && myTr <= 3 && !inSuit(H, tr).some(c => R(c) >= 9)) {
    const pX = g.auction.some(e => e.seat === p && e.call === 'X') && g.contract.dbl === 1;
    if (bs < 0 || g.contract.level === 7 || pX) return asc(inSuit(H, tr))[0];
  }
  if (best === null) return asc(H)[0];
  return leadCardFrom(inSuit(H, best), nt);
}
function declLead(g, seat) {
  const H1 = g.hands[seat], H2 = g.hands[pd(seat)], tr = g.trump;
  const pl = playedSet(g), ours = new Set([...H1, ...H2]);
  const mast = c => { for (let r = R(c) + 1; r < 13; r++) { const k = S(c) * 13 + r; if (!pl.has(k) && !ours.has(k)) return false; } return true; };
  const need = g.contract.level + 6 - g.tricks[sideOf(seat)];
  const sureIn = s => { let k = 0; for (let r = 12; r >= 0; r--) { const c = s * 13 + r; if (pl.has(c)) continue; if (ours.has(c)) k++; else break; } return Math.min(k, Math.max(inSuit(H1, s).length, inSuit(H2, s).length)); };
  let sure = 0; for (let s = 0; s < 4; s++) sure += sureIn(s);
  if (tr >= 0) {
    const t1 = inSuit(H1, tr), t2 = inSuit(H2, tr);
    let oppTr = 13; for (let r = 0; r < 13; r++) { const k = tr * 13 + r; if (pl.has(k) || ours.has(k)) oppTr--; }
    // ruff losers in the short-trump hand before drawing trumps
    if (t2.length > 0 && t2.length < t1.length) for (let s = 0; s < 4; s++) {
      if (s === tr || inSuit(H2, s).length) continue;
      const losers = asc(inSuit(H1, s)).filter(c => !mast(c));
      if (losers.length) return losers[0];
    }
    if (oppTr > 0 && t1.length && t1.length + t2.length > oppTr) {
      const m1 = desc(t1).filter(mast);
      if (m1.length) return m1[0];
      if (t2.some(mast)) return asc(t1)[0];
      if (t1.length + t2.length >= oppTr + 3) return desc(t1)[0];
    }
  }
  // not enough top tricks yet: set up the longest suit we do not fully control (knock out their stopper)
  if (sure < need) {
    let ds = -1, dl = 0;
    for (let s = 0; s < 4; s++) {
      if (s === tr) continue; const a = inSuit(H1, s), b = inSuit(H2, s); if (!a.length) continue;
      const tot = a.length + b.length; if (sureIn(s) >= Math.max(a.length, b.length)) continue;
      if (tot > dl) { dl = tot; ds = s; }
    }
    if (ds >= 0 && dl >= 5) {
      const a = desc(inSuit(H1, ds));
      if (a.length >= 2 && R(a[0]) >= 9 && R(a[1]) === R(a[0]) - 1) return a[0];
      return a[a.length - 1];
    }
  }
  let best = null, bs = -1e9;
  for (let s = 0; s < 4; s++) {
    const a = desc(inSuit(H1, s)), b = desc(inSuit(H2, s)); if (!a.length) continue;
    const ma = a.filter(mast).length, mb = b.filter(mast).length;
    let sc, card = a[a.length - 1];
    if (ma && (a.length <= b.length || !mb)) { sc = 20 + ma + (s === tr ? -30 : 0); card = a[0]; }
    else if (mb) { sc = 15 + mb + (s === tr ? -30 : 0); card = a[a.length - 1]; }
    else {
      sc = a.length + b.length - (s === tr ? 20 : 0);
      if (R(a[0]) >= 9 && a.length >= 2 && R(a[1]) === R(a[0]) - 1) card = a[0];
      if (tr >= 0 && b.length === 0 && inSuit(H2, tr).length && s !== tr) { sc += 12; card = a[a.length - 1]; }
    }
    if (sc > bs) { bs = sc; best = card; }
  }
  return best ?? asc(H1)[0];
}

/* ---- double-dummy solver ---- */
const DD = { M: new Int32Array(16), pS: new Int8Array(64), pC: new Int8Array(64), ply: 0, tn: 0, leader: 0, trump: -1, side: 0, nodes: 0, limit: 0, TT: new Map() };
const DDX = { limit: true };
const DDF = { order: true, hint: false, qt: true };
function ddWinner() {
  const b0 = DD.ply - 4; let bs = DD.pS[b0], bc = DD.pC[b0];
  for (let i = b0 + 1; i < DD.ply; i++) { const c = DD.pC[i]; if ((((c / 13) | 0) === ((bc / 13) | 0) && c > bc) || (((c / 13) | 0) === DD.trump && ((bc / 13) | 0) !== DD.trump)) { bc = c; bs = DD.pS[i]; } }
  return bs;
}
function ddMoves(seat) {
  const M = DD.M, out = []; let suits = [0, 1, 2, 3];
  const t0 = DD.ply - DD.tn;
  if (DD.tn > 0) { const ls = (DD.pC[t0] / 13) | 0; if (M[seat * 4 + ls]) suits = [ls]; }
  for (const s of suits) {
    const my = M[seat * 4 + s]; if (!my) continue;
    let all = M[s] | M[4 + s] | M[8 + s] | M[12 + s];
    for (let i = t0; i < DD.ply; i++) { const c = DD.pC[i]; if (((c / 13) | 0) === s) all |= 1 << (c % 13); }
    let inG = false;
    for (let r = 12; r >= 0; r--) { const bit = 1 << r; if (my & bit) { if (!inG) { out.push(s * 13 + r); inG = true; } } else if (all & bit) inG = false; }
  }
  if (DDF.order && DD.tn === 0 && out.length > 1) {
    // leader ordering: cash winners first, then lead toward partner's winners, then low from long suits
    const p = (seat + 2) & 3, sc = {};
    for (const c of out) {
      const s = (c / 13) | 0, all = M[s] | M[4 + s] | M[8 + s] | M[12 + s];
      let top = 12; while (top >= 0 && !(all & (1 << top))) top--;
      const pTop = (M[p * 4 + s] >> top) & 1;
      sc[c] = (c % 13) === top ? 100 + popc(M[seat * 4 + s]) : pTop ? 60 - (c % 13) : 20 + popc(M[seat * 4 + s]) - (c % 13) * 0.2;
    }
    out.sort((a, b) => sc[b] - sc[a]);
  }
  if (DD.tn > 0 && out.length > 1) {
    // ordering: if partner is winning play low first, otherwise cheapest winner first
    let bs = DD.pS[t0], bc = DD.pC[t0];
    for (let i = t0 + 1; i < DD.ply; i++) { const c = DD.pC[i]; if ((((c / 13) | 0) === ((bc / 13) | 0) && c > bc) || (((c / 13) | 0) === DD.trump && ((bc / 13) | 0) !== DD.trump)) { bc = c; bs = DD.pS[i]; } }
    const win = c => (((c / 13) | 0) === ((bc / 13) | 0) && c > bc) || (((c / 13) | 0) === DD.trump && ((bc / 13) | 0) !== DD.trump);
    if ((bs & 1) === (seat & 1)) out.sort((a, b) => (a % 13) - (b % 13));
    else out.sort((a, b) => { const wa = win(a), wb = win(b); if (wa !== wb) return wa ? -1 : 1; return (a % 13) - (b % 13); });
  }
  return out;
}
/* position key on relative ranks: only the order of the remaining cards matters, so equivalent endings share an entry */
function relKey(ld) {
  const M = DD.M; let k = String.fromCharCode(48 + ld);
  for (let s = 0; s < 4; s++) {
    const a = M[s], b = M[4 + s], c = M[8 + s], d = M[12 + s], all = a | b | c | d;
    let v = 1;
    for (let r = 12; r >= 0; r--) { const bit = 1 << r; if (all & bit) v = v * 4 + ((b & bit) ? 1 : (c & bit) ? 2 : (d & bit) ? 3 : 0); }
    k += v.toString(36) + '.';
  }
  return k;
}
/* sure tricks the leader can cash from the top without losing the lead (capped where an opponent could ruff) */
function quickTricks(ld) {
  const M = DD.M, tr = DD.trump, o1 = (ld + 1) & 3, o2 = (ld + 3) & 3;
  let q = 0;
  for (let s = 0; s < 4; s++) {
    const mine = M[ld * 4 + s]; if (!mine) continue;
    const all = M[s] | M[4 + s] | M[8 + s] | M[12 + s];
    let k = 0;
    for (let r = 12; r >= 0; r--) { const bit = 1 << r; if (!(all & bit)) continue; if (mine & bit) k++; else break; }
    if (!k) continue;
    if (tr >= 0 && s !== tr) {
      if (M[o1 * 4 + tr]) k = Math.min(k, popc(M[o1 * 4 + s]));
      if (M[o2 * 4 + tr]) k = Math.min(k, popc(M[o2 * 4 + s]));
    }
    q += k;
  }
  return q;
}
function ddSearch(alpha, beta) {
  if (++DD.nodes > DD.limit) throw DDX;
  const M = DD.M; let key = null, a0 = 0, b0 = 0, hintSuit = -1, bestC = -1;
  if (DD.tn === 0) {
    const ld = DD.leader; const r = popc(M[ld * 4]) + popc(M[ld * 4 + 1]) + popc(M[ld * 4 + 2]) + popc(M[ld * 4 + 3]);
    if (r === 0) return 0;
    if (alpha >= r) return r; if (beta <= 0) return 0;
    const qt = DDF.qt ? Math.min(r, quickTricks(ld)) : 0;
    if ((ld & 1) === DD.side) { if (qt >= beta) return qt; if (qt > alpha) alpha = qt; }
    else { const ub = r - qt; if (ub <= alpha) return ub; if (ub < beta) beta = ub; }
    key = relKey(ld); const e = DD.TT.get(key);
    if (e) { hintSuit = e[2]; if (e[0] >= beta) return e[0]; if (e[1] <= alpha) return e[1]; if (e[0] > alpha) alpha = e[0]; if (e[1] < beta) beta = e[1]; if (e[0] === e[1]) return e[0]; }
    a0 = alpha; b0 = beta;
  }
  const seat = (DD.leader + DD.tn) % 4, isMax = (seat & 1) === DD.side;
  let mv = ddMoves(seat);
  if (DDF.hint && hintSuit >= 0 && mv.length > 1) mv = mv.filter(c => ((c / 13) | 0) === hintSuit).concat(mv.filter(c => ((c / 13) | 0) !== hintSuit));
  let best = isMax ? -1 : 99;
  for (const c of mv) {
    const su = (c / 13) | 0, rk = c % 13;
    M[seat * 4 + su] &= ~(1 << rk); DD.pS[DD.ply] = seat; DD.pC[DD.ply] = c; DD.ply++; DD.tn++;
    let v;
    if (DD.tn === 4) { const w = ddWinner(), won = (w & 1) === DD.side ? 1 : 0, sl = DD.leader; DD.leader = w; DD.tn = 0; v = won + ddSearch(alpha - won, beta - won); DD.tn = 4; DD.leader = sl; }
    else v = ddSearch(alpha, beta);
    DD.ply--; DD.tn--; M[seat * 4 + su] |= (1 << rk);
    if (isMax) { if (v > best) { best = v; bestC = c; } if (best > alpha) alpha = best; } else { if (v < best) { best = v; bestC = c; } if (best < beta) beta = best; }
    if (alpha >= beta) break;
  }
  if (key !== null) {
    let e = DD.TT.get(key) || [0, 13, -1];
    const hs = bestC >= 0 ? (bestC / 13) | 0 : e[2];
    if (best <= a0) e = [e[0], Math.min(e[1], best), hs]; else if (best >= b0) e = [Math.max(e[0], best), e[1], hs]; else e = [best, best, hs];
    if (DD.TT.size > 1500000) DD.TT.clear();
    DD.TT.set(key, e);
  }
  return best;
}
function ddLoad(hands, skipSeat, skipCard) {
  const M = DD.M; M.fill(0);
  for (let s = 0; s < 4; s++) for (const k of hands[s]) if (!(s === skipSeat && k === skipCard)) M[s * 4 + S(k)] |= 1 << R(k);
}
/* tricks the side of `seat` takes from here (current trick included) after `seat` plays c */
function ddEval(hands, trickSoFar, seat, c, limit) {
  ddLoad(hands, seat, c);
  DD.ply = 0; DD.tn = 0;
  for (const t of trickSoFar) { DD.pS[DD.ply] = t.s; DD.pC[DD.ply] = t.c; DD.ply++; DD.tn++; }
  DD.pS[DD.ply] = seat; DD.pC[DD.ply] = c; DD.ply++; DD.tn++;
  DD.leader = trickSoFar.length ? trickSoFar[0].s : seat; DD.side = seat & 1; DD.nodes = 0; DD.limit = limit;
  let base = 0;
  if (DD.tn === 4) { const w = ddWinner(); base = (w & 1) === DD.side ? 1 : 0; DD.leader = w; DD.tn = 0; DD.ply = 0; }
  // null-window binary search on the remaining tricks (reuses the transposition table between probes)
  let lo = 0, hi = hands[seat].length - (base || DD.tn === 0 ? 1 : 0);
  if (DD.tn > 0) hi = hands[seat].length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ddSearch(mid - 1, mid) >= mid) lo = mid; else hi = mid - 1; }
  return base + lo;
}
/* exact tricks for `side` with `leader` on lead at a trick boundary (null-window binary search) */
function ddFull(hands, leader, side, trump, limit) {
  ddLoad(hands, -1, -1); DD.trump = trump; DD.TT = new Map(); DD.side = side; DD.limit = limit; DD.nodes = 0;
  const n = hands[leader].length; let lo = 0, hi = n;
  try {
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      DD.ply = 0; DD.tn = 0; DD.leader = leader;
      if (ddSearch(mid - 1, mid) >= mid) lo = mid; else hi = mid - 1;
    }
  } catch (e) { if (e === DDX) return null; throw e; }
  return lo;
}
function ddContract(deal, c, limit) { return ddFull(deal, (c.decl + 1) % 4, sideOf(c.decl), c.strain < 4 ? c.strain : -1, limit || 4e6); }

function sampleHands(g, seat) {
  const known = new Set([seat]); const decl = g.contract.decl, dm = g.dummy;
  if (g.dummyShown) known.add(dm);
  if (g.dummyShown && (seat === decl || seat === dm)) { known.add(decl); known.add(dm); }
  const hidden = [0, 1, 2, 3].filter(s => !known.has(s));
  const pool = hidden.flatMap(s => g.hands[s]);
  // what the auction told us about each hidden hand (HCP range and suit lengths of the original 13 cards)
  const played = [[], [], [], []];
  for (const t of g.history) for (const x of t.cards) played[x.s].push(x.c);
  for (const x of g.trick) played[x.s].push(x.c);
  const cons = {};
  for (const s of hidden) {
    let min = 0, max = 37; const len = [0, 0, 0, 0];
    for (const e of g.auction) if (e.seat === s && e.m) {
      if (e.m.min != null) min = Math.max(min, e.m.min);
      if (e.m.max != null) max = Math.min(max, e.m.max);
      if (e.m.len) for (const k in e.m.len) len[k] = Math.max(len[k], e.m.len[k]);
    }
    cons[s] = { min: min - 1, max: max + 1, len };
  }
  const fits = out => hidden.every(s => {
    const c = cons[s], full = out[s].concat(played[s]);
    let hcp = 0; const ln = [0, 0, 0, 0];
    for (const k of full) { ln[S(k)]++; if (R(k) >= 9) hcp += R(k) - 8; }
    return hcp >= c.min && hcp <= c.max && ln.every((l, i) => l >= c.len[i]);
  });
  let fallback = null;
  for (let tries = 0; tries < 160; tries++) {
    shuffle(pool); const out = g.hands.map(h => h.slice()); const room = {};
    for (const s of hidden) { out[s] = []; room[s] = g.hands[s].length; }
    let ok = true;
    for (const c of pool) {
      const cand = hidden.filter(s => room[s] > 0 && !g.voids[s][S(c)]);
      if (!cand.length) { ok = false; break; }
      let tot = 0; for (const s of cand) tot += room[s];
      let k = rnd(tot), pick = cand[0];
      for (const s of cand) { if (k < room[s]) { pick = s; break; } k -= room[s]; }
      out[pick].push(c); room[pick]--;
    }
    if (!ok) continue;
    if (fits(out)) return out;
    if (!fallback) fallback = out;
  }
  return fallback || g.hands.map(h => h.slice());
}
function ddChoose(g, seat, leg, opt) {
  DD.trump = g.trump; DD.TT = new Map();
  // equal cards (no unplayed outside card between them) are equivalent: evaluate one per group
  {
    const pl = playedSet(g), mine = new Set(g.hands[seat]), reps = [];
    for (const c of desc(leg)) {
      const prev = reps.length ? reps[reps.length - 1] : -1;
      let same = prev >= 0 && S(prev) === S(c);
      if (same) for (let r = R(c) + 1; r < R(prev); r++) { const k = S(c) * 13 + r; if (!pl.has(k) && !mine.has(k)) { same = false; break; } }
      if (same) reps[reps.length - 1] = c; else reps.push(c);
    }
    leg = reps;
  }
  if (leg.length === 1) return leg[0];
  const tot = new Map(leg.map(c => [c, 0])); let n = 0; const t0 = performance.now();
  try {
    while (n < opt.maxSamples && (n < 2 || performance.now() - t0 < opt.budget)) {
      const hands = sampleHands(g, seat);
      for (const c of leg) tot.set(c, tot.get(c) + ddEval(hands, g.trick, seat, c, 250000));
      n++;
      if (DD.TT.size > 300000) DD.TT = new Map();
    }
  } catch (e) { if (e !== DDX) throw e; }
  if (n === 0) return null;
  let best = null, bv = -1; for (const c of asc(leg)) { const v = tot.get(c); if (v > bv + 1e-9) { bv = v; best = c; } }
  return best;
}
const PLAY_OPT = { budget: 900, maxSamples: 40, ddTricks: 9 };
function aiPlay(g, seat, opt) {
  opt = opt || PLAY_OPT;
  const leg = legalFor(g, seat); if (leg.length === 1) return leg[0];
  const ddLim = opt.ddTricks + (DEFF.dd && sideOf(seat) !== sideOf(g.contract.decl) ? 1 : 0);
  if (g.hands[seat].length <= ddLim) { const r = ddChoose(g, seat, leg, opt); if (r != null) return r; }
  return heurPlay(g, seat);
}

Object.assign(E, { DD, DDF, DEFF, signalText, readSignals, newPlayState, trickWinner, legalFor, applyCard, collect, handsEmpty, aiPlay, heurPlay, ddFull, ddContract, PLAY_OPT, asc, desc, inSuit });
});
