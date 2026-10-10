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
  DD.trump = g.trump;
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
      // each value is the first guess for the next card; a sample counts only when every card was solved
      const vs = []; let gs = null;
      for (const c of leg) { gs = ddEval(hands, g.trick, seat, c, 250000, gs); vs.push(gs); }
      leg.forEach((c, i) => tot.set(c, tot.get(c) + vs[i]));
      n++;
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

/* after the board: every card our side played is checked double dummy against the other legal cards. A card that
   gave away tricks is reported with the best card instead (trick number, seat, played, better, tricks lost). */
/* the opening lead: how many tricks the defence takes after each card the leader could lead (double dummy).
   One solve gives the defence's best; every lead then starts its search there, and touching cards (K Q, J 10 9) share a value.
   each(card, value) is told every result as it comes. */
function leadValues(deal, c, limit, each) {
  const L = (c.decl + 1) % 4, hands = deal.map(h => h.slice()), out = {}, trump = c.strain < 4 ? c.strain : -1;
  let best = ddFull(hands, L, sideOf(L), trump, limit || 2e7, null);
  DD.trump = trump;
  const mine = hands[L].slice().sort((a, b) => S(b) - S(a) || R(b) - R(a));
  for (let i = 0; i < mine.length; i++) {
    const x = mine[i], up = mine[i - 1];
    if (i && S(up) === S(x) && R(up) === R(x) + 1 && up in out) out[x] = out[up];   // the card just above it in the same suit
    else { try { out[x] = ddEval(hands, [], L, x, limit || 2e7, best); } catch (e) { if (e !== DDX) throw e; out[x] = null; } }
    if (each) each(x, out[x]);
  }
  return out;
}
function analysePlay(deal, c, pl, seats, limit) {
  const hands = deal.map(h => h.slice()), trump = c.strain < 4 ? c.strain : -1, out = [], lim = limit || 3e6;
  DD.trump = trump;
  // first guesses for the solver: the last value found for that side, less the tricks it then won in the play
  const won = pl.map(t => t.length === 4 ? sideOf(trickWinner(t.map(([s, x]) => ({ s, c: x })), trump)) : -1);
  const wonFrom = (side, a, b) => { let n = 0; for (let i = a; i < b; i++) if (won[i] === side) n++; return n; };
  const last = [null, null];
  let trick = [];
  for (let ti = 0; ti < pl.length; ti++) {
    for (const [s, card] of pl[ti]) {
      if (seats.includes(s) && hands[s].length > 1) {
        const led = trick.length ? S(trick[0].c) : -1, has = led >= 0 && hands[s].some(x => S(x) === led);
        const legal = hands[s].filter(x => !has || S(x) === led);
        if (legal.length > 1) {
          // one card from each run of touching cards is enough (they give the same tricks)
          const cand = legal.filter(x => !legal.some(y => S(y) === S(x) && R(y) === R(x) + 1 && !hands.some(h => h.some(z => S(z) === S(x) && R(z) > R(x) && R(z) < R(y)))));
          if (!cand.includes(card)) cand.push(card);
          const sd = s & 1, L = last[sd], v = {};
          const guess = L ? L.v - wonFrom(sd, L.ti, ti) : wonFrom(sd, ti, pl.length);
          try { v[card] = ddEval(hands, trick, s, card, lim, guess); last[sd] = { v: v[card], ti }; } catch (e) { if (e !== DDX) throw e; }
          if (v[card] != null) {
            // another card needs its exact value only when it does better than the card played
            for (const x of cand) {
              if (x === card) continue;
              try { if (ddAtLeast(hands, trick, s, x, lim, v[card] + 1)) v[x] = ddEval(hands, trick, s, x, lim, v[card] + 1); } catch (e) { if (e !== DDX) throw e; }
            }
            let best = card; for (const x of cand) if (v[x] != null && v[x] > v[best]) best = x;
            if (v[best] > v[card]) out.push({ t: ti + 1, s, c: card, b: best, lost: v[best] - v[card] });
          }
        }
      }
      hands[s] = hands[s].filter(x => x !== card); trick.push({ s, c: card });
      if (trick.length === 4) trick = [];
    }
  }
  return out;
}

Object.assign(E, { DD, DDF, analysePlay, leadValues, ddEval, DEFF, signalText, readSignals, newPlayState, trickWinner, legalFor, applyCard, collect, handsEmpty, aiPlay, heurPlay, ddFull, ddContract, PLAY_OPT, asc, desc, inSuit });
});
