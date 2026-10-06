/* Bridge Table — bidding system.
   Each side bids with its own convention card (cards[0] = North-South, cards[1] = East-West).
   cands() lists candidate calls for the situation in priority order; the robot picks the first one its hand fits.
   The same list explains a human's calls and tells the robots what partner holds.
   To add a convention: add add(call, test, meaning) lines in the matching section and give the meaning cv:'key'. */
(window.BRIDGE = window.BRIDGE || []).push(function bidding(E) {
'use strict';
const { SUIT, pd, sideOf, B, LV, ST, isNum, aState, isLegal, ev } = E;

function ctxOf(auc, seat, cards) {
  const p = pd(seat);
  const cfg = (cards && cards[sideOf(seat)]) || { conv: E.ALL_ON, agg: 0 };
  const bids = auc.filter(e => isNum(e.call));
  const act = s => auc.filter(e => e.seat === s && e.call !== 'P');
  const oppBids = bids.filter(e => sideOf(e.seat) !== sideOf(seat));
  return {
    auc, seat, p, bids, st: aState(auc), my: act(seat), pa: act(p), oppBids, C: cfg.conv || E.ALL_ON, agg: cfg.agg || 0,
    opening: bids[0] || null, oppSuits: [...new Set(oppBids.map(e => ST(e.call)).filter(s => s < 4))],
    rhoCall: auc.length ? auc[auc.length - 1].call : null,
    passed: auc.some(e => e.seat === seat && e.call === 'P'),
  };
}
function pInfo(x) {
  let min = 0, max = 37; const len = [0, 0, 0, 0];
  for (const e of x.auc) {
    if (e.seat !== x.p || !e.m) continue; const m = e.m;
    if (m.min != null) min = Math.max(min, m.min);
    if (m.max != null) max = Math.min(max, m.max);
    if (m.len) for (const k in m.len) len[k] = Math.max(len[k], m.len[k]);
  }
  if (max < min) max = min;
  return { min, max, len };
}
const cleanAfter = (auc, idx) => auc.slice(idx + 1).every(e => sideOf(e.seat) === sideOf(auc[idx].seat) || e.call === 'P');
const ourOnly = x => x.auc.every(e => sideOf(e.seat) === sideOf(x.seat) || e.call === 'P');
const otherMajor = s => s === 2 ? 3 : 2;
const BAL = { 0: 2, 1: 2, 2: 2, 3: 2 };

function cands(x) {
  const L = []; const add = (call, test, m) => L.push({ call, test, m: m || {} });
  const { auc, p, my, pa, opening, st, C } = x;
  const pLast = pa.length ? pa[pa.length - 1] : null, myLast = my.length ? my[my.length - 1] : null;
  const pm = (pLast && pLast.m) || {}, mm = (myLast && myLast.m) || {};
  const pJust = pLast && pLast === auc[auc.length - 2];  // partner's call came right before RHO's
  const rhoPass = x.rhoCall === 'P';

  /* ===== slam conventions and relays (highest priority) ===== */
  if (pLast && pm.tag === 'stop' && pJust) { add('P', () => true, { t: 'Accepting partner\'s sign-off' }); return L; }

  if (pJust && pm.tag === 'bw') {
    const t = pm.trump;
    if (pm.rkc) {
      add(B(5, 0), h => h.kc(t) === 1 || h.kc(t) === 4, { tag: 'bwr', kc: 1, cv: 'rkc', t: 'RKCB reply: 1 or 4 key cards' });
      add(B(5, 1), h => h.kc(t) === 0 || h.kc(t) === 3, { tag: 'bwr', kc: 0, cv: 'rkc', t: 'RKCB reply: 0 or 3 key cards' });
      add(B(5, 2), h => h.kc(t) === 2 && !h.has(t, 10), { tag: 'bwr', kc: 2, cv: 'rkc', t: 'RKCB reply: 2 key cards, no trump queen' });
      add(B(5, 3), h => h.kc(t) >= 2, { tag: 'bwr', kc: 2, q: 1, cv: 'rkc', t: 'RKCB reply: 2 key cards + trump queen' });
    } else {
      [B(5, 0), B(5, 1), B(5, 2), B(5, 3)].forEach((c, k) => add(c, h => k === 0 ? (h.aces === 0 || h.aces === 4) : h.aces === k, { tag: 'bwr', kc: k, cv: 'bw', t: 'Blackwood reply: ' + (k === 0 ? '0 or 4' : k) + ' ace' + (k === 1 ? '' : 's') }));
    }
    return L;
  }
  if (myLast && mm.tag === 'bw' && pLast && pm.tag === 'bwr') {
    const t = mm.trump, P = pInfo(x), total = mm.rkc ? 5 : 4;
    const count = h => {
      const mine = mm.rkc ? h.kc(t) : h.aces; let k = pm.kc;
      const alt = k === 0 ? (mm.rkc ? 3 : 4) : (k === 1 && mm.rkc ? 4 : k);
      if (alt !== k && mine + alt <= total && P.min >= 15) k = alt;
      return mine + k;
    };
    const est = h => h.sup(t) + P.min + 2;
    add(B(7, t), h => count(h) === total && est(h) >= 36, { t: 'Grand slam: we hold every key card' });
    add(B(6, t), h => count(h) >= total - 1, { t: 'Small slam: at most one key card missing' });
    add('P', () => pLast.call === B(5, t), { t: 'Two key cards missing: stop at the five level' });
    add(B(5, t), () => true, { t: 'Two key cards missing: sign off at the five level', tag: 'stop' });
    add(B(5, 4), () => true, { t: 'Two key cards missing: to play', tag: 'stop' });
    return L;
  }
  if (pJust && pm.tag === 'gerb') {
    [B(4, 1), B(4, 2), B(4, 3), B(4, 4)].forEach((c, k) => add(c, h => k === 0 ? (h.aces === 0 || h.aces === 4) : h.aces === k, { tag: 'gerbr', kc: k, cv: 'gerber', t: 'Gerber reply: ' + (k === 0 ? '0 or 4' : k) + ' ace' + (k === 1 ? '' : 's') }));
    return L;
  }
  if (myLast && mm.tag === 'gerb' && pLast && pm.tag === 'gerbr') {
    const P = pInfo(x);
    const count = h => { let k = pm.kc; if (k === 0 && h.aces === 0) k = 4; return h.aces + k; };
    add(B(7, 4), h => count(h) === 4 && h.hcp + P.min >= 37, { t: 'Grand slam: we hold every ace' });
    add(B(6, 4), h => count(h) >= 3, { t: 'Small slam: at most one ace missing' });
    add(B(4, 4), () => true, { t: 'Sign-off: two aces missing', tag: 'stop' });
    add(B(5, 4), () => true, { t: 'Sign-off: two aces missing', tag: 'stop' });
    return L;
  }
  if (pJust && pm.tag === 'q') {
    add(B(6, 4), h => h.hcp + (pm.min || 0) >= 33, { t: 'Accepting the slam invitation' });
    add('P', () => true, { t: 'Declining the invitation' });
    return L;
  }
  if (pJust && rhoPass && pm.tag === 'leb') { add(B(3, 0), () => true, { tag: 'lebr', cv: 'leb', t: 'Lebensohl: forced 3♣ relay' }); return L; }
  if (myLast && mm.tag === 'leb' && pLast && pm.tag === 'lebr' && rhoPass) {
    const os = mm.os;
    add(B(3, 4), h => h.hcp >= 10, { min: 10, cv: 'leb', t: 'Lebensohl slow show: game values with a ' + SUIT[os] + ' stopper' });
    add('P', h => h.longest === 0, { t: 'To play in clubs' });
    for (const s of [1, 2, 3]) if (s !== os) add(B(3, s), h => h.longest === s, { len: { [s]: 5 }, t: 'To play in ' + SUIT[s] + ' (sign-off)' });
    add('P', () => true, { t: 'Pass' });
    return L;
  }
  if (pJust && rhoPass && pm.tag === 'trm') { add(pm.to, () => true, { tag: 'trc', cv: pm.cv, t: 'Completing the transfer' }); return L; }
  // Texas is completed even if the next opponent doubles it
  if (pJust && (rhoPass || x.rhoCall === 'X') && pm.tag === 'texas') { add(pm.to, () => true, { tag: 'trc', cv: pm.cv, t: 'Completing the Texas transfer' }); return L; }
  if (pLast && pm.tag === 'wjs' && pJust) { add('P', () => true, { t: 'Passing partner\'s weak suit' }); return L; }
  /* Gambling 3NT: pass or correct */
  if (pJust && pm.tag === 'poc') { add(B(4, 1), h => h.len[1] >= 7, { t: 'My long suit is diamonds' }); add('P', () => true, { t: 'My long suit is clubs' }); return L; }
  /* Ogust reply by the weak-two opener */
  if (pJust && rhoPass && pm.tag === 'ogust' && myLast && mm.tag === 'weak') {
    const s = ST(myLast.call), good = h => h.has(s, 12) + h.has(s, 11) + h.has(s, 10) >= 2;
    add(B(3, 4), h => h.has(s, 12) && h.has(s, 11) && h.has(s, 10), { cv: 'ogust', t: 'Ogust: solid suit (AKQ)' });
    add(B(3, 3), h => h.hcp >= 8 && good(h), { min: 8, max: 10, cv: 'ogust', t: 'Ogust: maximum, good suit' });
    add(B(3, 2), h => h.hcp >= 8, { min: 8, max: 10, cv: 'ogust', t: 'Ogust: maximum, bad suit' });
    add(B(3, 1), h => good(h), { min: 5, max: 7, cv: 'ogust', t: 'Ogust: minimum, good suit' });
    add(B(3, 0), () => true, { min: 5, max: 7, cv: 'ogust', t: 'Ogust: minimum, bad suit' });
    return L;
  }
  /* DONT follow-ups */
  if (my.length === 0 && pJust && pm.cv === 'dont') {
    const cheap = s => (ST(st.last) < s ? LV(st.last) : LV(st.last) + 1);
    if (pm.tag === 'dontX' && rhoPass) {
      for (const s of [3, 2, 1]) add(B(2, s), h => h.len[s] >= 6 && h.hcp >= 6, { len: { [s]: 6 }, t: 'My own long suit: ' + SUIT[s] });
      add(B(2, 0), () => true, { tag: 'dontR', cv: 'dont', t: 'DONT relay: name your suit' });
    } else if (pm.tag === 'dont2') {
      const s1 = ST(pLast.call);
      add('P', h => h.len[s1] >= 3, { t: 'Pass: fit in ' + SUIT[s1] });
      for (let s = s1 + 1; s <= 3; s++) add(B(cheap(s), s), () => true, { tag: 'dontN', cv: 'dont', t: 'Pass or correct: asking for the second suit' });
    } else if (pm.tag === 'dontM') {
      add('P', h => h.len[2] >= h.len[3], { t: 'Pass: choosing hearts' });
      add(B(2, 3), () => true, { t: 'Choosing spades' });
    } else add('P', () => true, { t: 'Pass' });
    if (L.length) return L;
  }
  if (myLast && pLast && pJust && (pm.tag === 'dontR' || pm.tag === 'dontN') && mm.cv === 'dont') {
    const s1 = isNum(myLast.call) ? ST(myLast.call) : -1;
    if (pm.tag === 'dontR') {
      add('P', h => h.longest === 0, { t: 'My suit is clubs' });
      for (const s of [1, 2, 3]) add(B(2, s), h => h.longest === s, { len: { [s]: 6 }, t: 'My suit is ' + SUIT[s] });
    } else {
      const ps = ST(pLast.call);
      add('P', h => h.len[ps] >= 4, { t: 'Yes, that is my second suit' });
      for (let s = ps + 1; s <= 3; s++) if (s !== s1) add(B(LV(pLast.call), s), h => h.len[s] >= 4, { len: { [s]: 4 }, t: 'My second suit is ' + SUIT[s] });
      add('P', () => true, { t: 'Pass' });
    }
    return L;
  }
  if (pLast && pm.tag === 'run' && pJust) { add('P', () => true, { t: 'Passing partner\'s escape suit' }); return L; }

  /* ---- Cappelletti / Michaels follow-ups ---- */
  if (my.length === 0 && pJust && pm.cv === 'capp' && pm.tag && pm.tag !== 'cappX') {
    const cheap = s => (ST(st.last) < s ? LV(st.last) : LV(st.last) + 1);
    if (pm.tag === 'capp1') {
      for (const s of [3, 2, 0]) add(B(cheap(s), s), h => h.len[s] >= 6 && h.hcp >= 6, { len: { [s]: 6 }, t: 'My own long suit: ' + SUIT[s] });
      add(B(2, 1), () => rhoPass, { tag: 'relay', cv: 'capp', t: 'Cappelletti relay: name your suit' });
    }
    if (pm.tag === 'cappM') {
      add(B(4, 3), h => h.len[3] >= 4 && h.len[3] >= h.len[2] && h.hcp >= 11, { t: 'Game with a spade fit' });
      add(B(4, 2), h => h.len[2] >= 4 && h.hcp >= 11, { t: 'Game with a heart fit' });
      add(B(cheap(3), 3), h => h.len[3] > h.len[2], { t: 'Choosing the longer major: ♠' });
      add(B(cheap(2), 2), () => true, { t: 'Choosing the longer major: ♥' });
    }
    if (pm.tag === 'cappH' || pm.tag === 'cappS') {
      const M = pm.tag === 'cappH' ? 2 : 3;
      add(B(4, M), h => h.len[M] >= 3 && h.hcp >= 12, { t: 'Game with a ' + SUIT[M] + ' fit' });
      add('P', h => h.len[M] >= 2, { t: 'Pass to play in ' + SUIT[M] });
      add(B(2, 4), () => rhoPass, { tag: 'ask', cv: 'capp', t: 'Relay: which minor?' });
    }
    if (pm.tag === 'capp2N') { add(B(3, 1), h => h.len[1] > h.len[0], { t: 'Choosing the minor: ♦' }); add(B(3, 0), () => true, { t: 'Choosing the minor: ♣' }); }
    if (L.length) return L;
  }
  if (myLast && pLast && pm.tag === 'relay' && mm.tag === 'capp1') {
    add('P', h => h.longest === 1, { t: 'My long suit is diamonds' });
    for (const s of [2, 3, 0]) add(B(s === 0 ? 3 : 2, s), h => h.longest === s, { len: { [s]: 6 }, t: 'My long suit is ' + SUIT[s] });
    return L;
  }
  if (myLast && pLast && pm.tag === 'ask' && (mm.tag === 'cappH' || mm.tag === 'cappS' || (mm.tag === 'mich' && mm.major != null))) {
    add(B(3, 1), h => h.len[1] > h.len[0], { len: { 1: 4 }, t: 'My minor is diamonds' });
    add(B(3, 0), () => true, { len: { 0: 4 }, t: 'My minor is clubs' });
    return L;
  }
  if (my.length === 0 && pLast && (pm.tag === 'mich' || pm.tag === 'unusual') && pJust) {
    const cheap = s => (ST(st.last) < s ? LV(st.last) : LV(st.last) + 1);
    if (pm.tag === 'mich' && pm.major == null) {
      for (const s of [3, 2]) add(B(4, s), h => h.len[s] >= 4 && h.len[s] >= h.len[otherMajor(s)] && h.hcp >= 10, { t: 'Game with a ' + SUIT[s] + ' fit' });
      add(B(cheap(3), 3), h => h.len[3] > h.len[2], { len: { 3: 3 }, t: 'Choosing the major: ♠' });
      add(B(cheap(2), 2), () => true, { len: { 2: 3 }, t: 'Choosing the major: ♥' });
    } else if (pm.tag === 'mich') {
      const M = pm.major;
      add(B(4, M), h => h.len[M] >= 3 && h.hcp >= 10, { t: 'Game with a ' + SUIT[M] + ' fit' });
      add(B(cheap(M), M), h => h.len[M] >= 2, { len: { [M]: 2 }, t: 'Choosing ' + SUIT[M] });
      add(B(cheap(4), 4), () => cheap(4) <= 2, { tag: 'ask', cv: 'michaels', t: 'Asking for the minor' });
    } else {
      const [a, b] = pm.suits;
      add(B(cheap(b), b), h => h.len[b] > h.len[a], { t: 'Choosing ' + SUIT[b] });
      add(B(cheap(a), a), () => true, { t: 'Choosing ' + SUIT[a] });
    }
    add('P', () => true, { t: 'Pass' });
    return L;
  }

  /* ===== opening ===== */
  if (!opening) {
    const pos = auc.length, ag = x.agg > 0 ? 1 : 0;
    add(B(2, 0), h => h.hcp >= 22 || (h.hcp >= 19 && h.lp >= 4), { min: 22, cv: 'strong2c', t: 'Strong and artificial: 22+ HCP, game forcing', f: 1, gf: 1, tag: '2c' });
    add(B(2, 4), h => h.bal && h.hcp >= 20 && h.hcp <= 21, { min: 20, max: 21, len: BAL, t: 'Balanced, 20-21 HCP', tag: 'nt2' });
    add(B(1, 4), h => h.bal && h.hcp >= 15 && h.hcp <= 17, { min: 15, max: 17, len: BAL, cv: 'nt1', t: 'Balanced, 15-17 HCP', tag: 'nt1' });
    const can = h => { const ls = [...h.len].sort((a, b) => b - a); if (pos === 3) return h.hcp >= 13 - ag || (h.hcp >= 10 && h.hcp + h.len[3] >= 15); return h.hcp >= 12 - ag || (h.hcp >= 10 && h.hcp + ls[0] + ls[1] >= 20); };
    add(B(1, 3), h => can(h) && h.len[3] >= 5 && h.len[3] >= h.len[2], { min: 11, max: 21, len: { 3: 5 }, t: '5+ ♠, 12-21 HCP' });
    add(B(1, 2), h => can(h) && h.len[2] >= 5, { min: 11, max: 21, len: { 2: 5 }, t: '5+ ♥, 12-21 HCP' });
    add(B(1, 1), h => can(h) && (h.len[1] > h.len[0] || (h.len[1] === h.len[0] && h.len[1] >= 4)), { min: 11, max: 21, len: { 1: 3 }, t: '3+ ♦, 12-21 HCP' });
    add(B(1, 0), h => can(h), { min: 11, max: 21, len: { 0: 2 }, t: '3+ ♣, 12-21 HCP' });
    if (pos < 3) {
      if (C.gamb) add(B(3, 4), h => [0, 1].some(s => h.len[s] >= 7 && h.has(s, 12) && h.has(s, 11) && h.has(s, 10)) && [0, 1, 2, 3].every(s => h.len[s] >= 7 || (!h.has(s, 12) && !h.has(s, 11))), { min: 9, max: 13, tag: 'gamb', cv: 'gamb', t: 'Gambling 3NT: solid 7+ card minor, nothing outside' });
      for (const s of [3, 2]) add(B(4, s), h => h.len[s] >= 8 && h.hcp >= 5 && h.hcp <= 11, { min: 5, max: 11, len: { [s]: 8 }, cv: 'pre', t: 'Preempt: 8+ ' + SUIT[s] + ', 5-11 HCP', tag: 'pre' });
      for (const s of [3, 2, 1]) add(B(2, s), h => h.len[s] === 6 && h.hcp >= 5 && h.hcp <= 10 && h.top5(s) >= 2, { min: 5, max: 10, len: { [s]: 6 }, cv: 'weak2', t: 'Weak two: six ' + SUIT[s] + ', 5-10 HCP', tag: 'weak' });
      for (const s of [3, 2, 1, 0]) add(B(3, s), h => h.len[s] >= 7 && h.hcp >= 5 && h.hcp <= 10 && h.top5(s) >= 2, { min: 5, max: 10, len: { [s]: 7 }, cv: 'pre', t: 'Preempt: 7+ ' + SUIT[s] + ', 5-10 HCP', tag: 'pre' });
    }
    add('P', () => true, { max: 12, t: 'No opening values' });
    return L;
  }

  const oppOpened = sideOf(opening.seat) !== sideOf(x.seat);

  /* ===== overcall position: our side has not acted yet ===== */
  if (oppOpened && my.length === 0 && pa.length === 0) {
    const ob = st.last, os = ST(ob);
    const bal4 = auc.length >= 3 && auc[auc.length - 1].call === 'P' && auc[auc.length - 2].call === 'P';
    const d = bal4 ? 3 : 0;
    const cheap = s => (ST(ob) < s ? LV(ob) : LV(ob) + 1);
    if (os === 4) {
      if (C.dont && !C.capp && ob === B(1, 4) && x.oppBids.length === 1 && !bal4) {
        add(B(2, 2), h => h.len[2] >= 4 && h.len[3] >= 4 && Math.max(h.len[2], h.len[3]) >= 5 && h.hcp >= 8, { min: 8, len: { 2: 4, 3: 4 }, tag: 'dontM', cv: 'dont', t: 'DONT: both majors' });
        add(B(2, 1), h => h.len[1] >= 5 && Math.max(h.len[2], h.len[3]) >= 4 && h.hcp >= 8, { min: 8, len: { 1: 5 }, tag: 'dont2', cv: 'dont', t: 'DONT: diamonds and a major' });
        add(B(2, 0), h => h.len[0] >= 5 && Math.max(h.len[1], h.len[2], h.len[3]) >= 4 && h.hcp >= 8, { min: 8, len: { 0: 5 }, tag: 'dont2', cv: 'dont', t: 'DONT: clubs and a higher suit' });
        add(B(2, 3), h => h.len[3] >= 6 && h.hcp >= 8, { min: 8, len: { 3: 6 }, cv: 'dont', t: 'DONT: long spades (natural)' });
        add('X', h => Math.max(h.len[0], h.len[1], h.len[2]) >= 6 && h.hcp >= 8, { min: 8, tag: 'dontX', cv: 'dont', t: 'DONT: a one-suiter (6+), not spades' });
        add('P', () => true, { t: 'Pass' });
        return L;
      }
      if (C.capp && ob === B(1, 4) && x.oppBids.length === 1 && !bal4) {
        add('X', h => h.hcp >= 15, { min: 15, tag: 'cappX', cv: 'capp', t: 'Cappelletti: penalty double, 15+ HCP' });
        add(B(2, 4), h => h.len[0] >= 5 && h.len[1] >= 5 && h.hcp >= 8, { min: 8, len: { 0: 5, 1: 5 }, tag: 'capp2N', cv: 'capp', t: 'Cappelletti: both minors (5-5)' });
        add(B(2, 1), h => h.len[2] >= 4 && h.len[3] >= 4 && Math.max(h.len[2], h.len[3]) >= 5 && h.hcp >= 8, { min: 8, len: { 2: 4, 3: 4 }, tag: 'cappM', cv: 'capp', t: 'Cappelletti: both majors (5-4 or longer)' });
        add(B(2, 2), h => h.len[2] >= 5 && Math.max(h.len[0], h.len[1]) >= 4 && h.hcp >= 8, { min: 8, len: { 2: 5 }, tag: 'cappH', cv: 'capp', t: 'Cappelletti: 5+ ♥ and a 4+ minor' });
        add(B(2, 3), h => h.len[3] >= 5 && Math.max(h.len[0], h.len[1]) >= 4 && h.hcp >= 8, { min: 8, len: { 3: 5 }, tag: 'cappS', cv: 'capp', t: 'Cappelletti: 5+ ♠ and a 4+ minor' });
        add(B(2, 0), h => Math.max(...h.len) >= 6 && h.hcp >= 8 && h.top5(h.longest) >= 2, { min: 8, tag: 'capp1', cv: 'capp', t: 'Cappelletti: a one-suiter (6+)' });
        add('P', () => true, { t: 'Pass' });
        return L;
      }
      add('X', h => h.hcp >= 15 - d, { min: 15 - d, t: 'Penalty double: 15+ HCP' });
      for (const s of [3, 2, 1, 0]) { const l = cheap(s); if (l <= 3) add(B(l, s), h => h.len[s] >= (l === 2 ? 5 : 6) && h.hcp >= 8 - d && h.hcp <= 15 && h.top5(s) >= 2, { min: 8 - d, max: 15, len: { [s]: 5 }, t: 'Natural: 5+ ' + SUIT[s] + ', 8-15 HCP' }); }
      add('P', () => true, { t: 'Pass' });
      return L;
    }
    const unbid = [0, 1, 2, 3].filter(s => !x.oppSuits.includes(s));
    if (C.michaels && LV(ob) === 1 && x.oppBids.length === 1 && !bal4) {
      if (os < 2) add(B(2, os), h => h.len[2] >= 5 && h.len[3] >= 5 && h.hcp >= 7, { min: 7, len: { 2: 5, 3: 5 }, tag: 'mich', cv: 'michaels', t: 'Michaels cue bid: both majors (5-5)' });
      else { const M = otherMajor(os); add(B(2, os), h => h.len[M] >= 5 && Math.max(h.len[0], h.len[1]) >= 5 && h.hcp >= 7, { min: 7, len: { [M]: 5 }, tag: 'mich', major: M, cv: 'michaels', t: 'Michaels cue bid: 5+ ' + SUIT[M] + ' and a 5+ minor' }); }
      const lw = unbid.slice().sort((a, b) => a - b).slice(0, 2);
      add(B(2, 4), h => h.len[lw[0]] >= 5 && h.len[lw[1]] >= 5 && h.hcp >= 7, { min: 7, len: { [lw[0]]: 5, [lw[1]]: 5 }, tag: 'unusual', suits: lw, cv: 'michaels', t: 'Unusual 2NT: ' + SUIT[lw[0]] + ' and ' + SUIT[lw[1]] + ' (5-5)' });
    }
    if (LV(ob) === 1) add(B(1, 4), h => h.bal && h.hcp >= 15 - d && h.hcp <= 18 && h.stop(os), { min: 15 - d, max: 18, len: BAL, t: 'Balanced 15-18 HCP with a stopper in their suit', tag: 'nt1' });
    add('X', h => h.hcp >= 17, { min: 17, cv: 'takeout', t: 'Strong hand: 17+ HCP' });
    for (const s of [3, 2, 1, 0]) {
      if (x.oppSuits.includes(s)) continue; const l = cheap(s);
      if (l + 1 <= 3) add(B(l + 1, s), h => !bal4 && h.len[s] >= 6 && h.hcp >= 5 && h.hcp <= 10 && h.top5(s) >= 2, { min: 5, max: 10, len: { [s]: 6 }, t: 'Weak jump overcall: 6+ ' + SUIT[s] + ', 5-10 HCP' });
    }
    for (const s of [3, 2, 1, 0]) {
      if (x.oppSuits.includes(s)) continue; const l = cheap(s);
      const mn = (l === 1 ? 8 : l === 2 ? 11 : 13) - d;
      add(B(l, s), h => h.len[s] >= (l === 3 ? 6 : 5) && h.hcp >= mn && h.hcp <= 16 && (l === 1 || h.top5(s) >= 2) && h.len[s] >= Math.max(...unbid.map(u => h.len[u])), { min: mn, max: 16, len: { [s]: 5 }, t: 'Overcall: 5+ ' + SUIT[s] + ', ' + mn + '-16 HCP' });
    }
    add('X', h => h.hcp >= 12 - d && h.len[os] <= 2 && unbid.every(u => h.len[u] >= 3 || (h.len[u] >= 2 && h.hcp >= 15)), { min: 12 - d, len: Object.fromEntries(unbid.map(u => [u, 3])), cv: 'takeout', t: 'Takeout double: 12+ HCP, support for the unbid suits' });
    add('P', () => true, { t: 'Pass' });
    return L;
  }

  /* ===== partner opened, my first action ===== */
  if (!oppOpened && opening.seat === p && my.length === 0) {
    const o = opening.call, os = ST(o), ol = LV(o);
    const fresh = opening === pLast && cleanAfter(auc, auc.indexOf(opening));
    if ((o === B(1, 4) || o === B(2, 4)) && rhoPass && fresh) { ntResponses(x, add, ol); return L; }
    // Texas after interference: 4♦/4♥ stay transfers over a double or a 2-3 level overcall (not in their own suit)
    if (o === B(1, 4) && opening === pLast && pJust && C.texas && C.texasInt && (x.rhoCall === 'X' || (isNum(x.rhoCall) && LV(x.rhoCall) <= 3 && ST(x.rhoCall) < 4))) {
      const obs = isNum(x.rhoCall) ? ST(x.rhoCall) : -1;
      // no transfer into their suit, and none using their suit as the transfer bid; then bid the major game directly
      if (obs === 1 || obs === 2) add(B(4, 2), h => obs !== 2 && h.len[2] >= 6 && h.hcp >= 8 && h.hcp <= 15, { min: 8, len: { 2: 6 }, cv: "texasInt", t: "Natural: 6+ ♥, game (Texas not possible over their suit)" });
      if (obs === 2 || obs === 3) add(B(4, 3), h => obs !== 3 && h.len[3] >= 6 && h.hcp >= 8 && h.hcp <= 15, { min: 8, len: { 3: 6 }, cv: "texasInt", t: "Natural: 6+ ♠, game (Texas not possible over their suit)" });
      if (obs !== 1 && obs !== 2 && (x.rhoCall === "X" || B(4, 1) > x.rhoCall)) add(B(4, 1), h => h.len[2] >= 6 && h.hcp >= 8 && h.hcp <= 15, { min: 8, len: { 2: 6 }, tag: 'texas', to: B(4, 2), cv: 'texasInt', t: 'Texas transfer (after interference): 6+ ♥, game — opener bids 4♥' });
      if (obs !== 2 && obs !== 3 && (x.rhoCall === "X" || B(4, 2) > x.rhoCall)) add(B(4, 2), h => h.len[3] >= 6 && h.hcp >= 8 && h.hcp <= 15, { min: 8, len: { 3: 6 }, tag: 'texas', to: B(4, 3), cv: 'texasInt', t: 'Texas transfer (after interference): 6+ ♠, game — opener bids 4♠' });
    }
    if (o === B(1, 4) && opening === pLast && pJust && x.rhoCall === 'X') {
      add('XX', h => h.hcp >= 9, { min: 9, cv: 'runout', t: 'Redouble: 9+ HCP, we have the balance of strength' });
      for (const s of [3, 2, 1, 0]) add(B(2, s), h => h.len[s] >= 5 && h.hcp <= 8 && h.len[s] >= h.len[h.longest], { max: 8, len: { [s]: 5 }, tag: 'run', cv: 'runout', t: 'Escape: 5+ ' + SUIT[s] + ', weak' });
      add('P', () => true, { t: 'Pass' });
      return L;
    }
    if (o === B(1, 4) && opening === pLast && isNum(x.rhoCall) && LV(x.rhoCall) === 2 && ST(x.rhoCall) < 4 && C.leb) {
      const ob = x.rhoCall, obs = ST(ob);
      add(B(3, 4), h => h.hcp >= 10 && !h.stop(obs), { min: 10, cv: 'leb', t: 'Lebensohl fast 3NT: game values, no ' + SUIT[obs] + ' stopper' });
      for (const s of [3, 2, 1, 0]) if (s !== obs) add(B(3, s), h => h.len[s] >= 5 && h.hcp >= 10, { min: 10, len: { [s]: 5 }, cv: 'leb', t: 'Lebensohl: direct three-level bid, 5+ ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
      for (const s of [3, 2, 1, 0]) if (s !== obs && B(2, s) > ob) add(B(2, s), h => h.len[s] >= 5 && h.hcp <= 9, { max: 9, len: { [s]: 5 }, t: 'Competing: 5+ ' + SUIT[s] + ', to play' });
      add(B(2, 4), h => (h.hcp >= 10 && h.stop(obs)) || (h.hcp <= 8 && h.len[h.longest] >= 6 && h.longest !== obs), { tag: 'leb', os: obs, cv: 'leb', t: 'Lebensohl 2NT: forces opener to bid 3♣', f: 1 });
      add('X', h => h.hcp >= 8, { min: 8, t: 'Double: 8+ HCP, penalty-oriented' });
      add('P', () => true, { t: 'Pass' });
      return L;
    }
    if (o === B(2, 0) && rhoPass) {
      for (const s of [3, 2]) add(B(2, s), h => h.hcp >= 8 && h.len[s] >= 5 && h.top5(s) >= 2, { min: 8, len: { [s]: 5 }, t: 'Positive: 5+ ' + SUIT[s] + ', 8+ HCP', gf: 1 });
      for (const s of [0, 1]) add(B(3, s), h => h.hcp >= 8 && h.len[s] >= 5 && h.top5(s) >= 2, { min: 8, len: { [s]: 5 }, t: 'Positive: 5+ ' + SUIT[s] + ', 8+ HCP', gf: 1 });
      add(B(2, 4), h => h.hcp >= 8 && h.bal, { min: 8, t: 'Positive: balanced, 8+ HCP', gf: 1 });
      add(B(2, 1), () => true, { max: 7, cv: 'strong2c', t: 'Waiting bid (artificial)', f: 1 });
      return L;
    }
    if (opening.m && opening.m.tag === 'gamb' && rhoPass) {
      add('P', h => [2, 3].every(s => h.stop(s)) && h.aces >= 1, { t: 'Pass: the other suits are stopped' });
      add(B(4, 0), () => true, { tag: 'poc', cv: 'gamb', t: 'Pass or correct: play in your minor' });
      return L;
    }
    if (opening.m && opening.m.tag === 'weak' && rhoPass && C.ogust && ol === 2) add(B(2, 4), h => h.hcp >= 15, { min: 15, tag: 'ogust', cv: 'ogust', t: 'Ogust 2NT: asking about strength and suit quality', f: 1 });
    if (opening.m && (opening.m.tag === 'weak' || opening.m.tag === 'pre') && rhoPass) {
      add(os < 2 ? B(5, os) : B(4, os), h => h.len[os] >= 3 && h.sup(os) >= 16, { min: 14, len: { [os]: 3 }, t: 'Game: support and values' });
      add(B(3, 4), h => h.hcp >= 16 && [0, 1, 2, 3].filter(s => s !== os).every(s => h.stop(s)), { min: 16, t: 'Game: stoppers in every side suit' });
      if (ol === 2) add(B(3, os), h => h.len[os] >= 3 && h.hcp <= 13, { len: { [os]: 3 }, t: 'Preemptive raise' });
      add('P', () => true, { t: 'Pass' });
      return L;
    }
    if (ol === 1 && os < 4) {
      if (fresh || (opening === pLast && pJust && x.rhoCall === 'X')) { suitResponses(x, add, o, os); return L; }
      if (isNum(x.rhoCall) && opening === pLast && pJust) { competitiveResponses(x, add, os); return L; }
    }
  }

  /* ===== advancer: partner overcalled or doubled ===== */
  if (oppOpened && my.length === 0 && pa.length > 0) {
    const pc = pa[pa.length - 1];
    const os = x.oppSuits.length ? x.oppSuits[x.oppSuits.length - 1] : -1;
    const cheap = s => (ST(st.last) < s ? LV(st.last) : LV(st.last) + 1);
    if (pc.call === 'X' && C.respx && isNum(x.rhoCall) && ST(x.rhoCall) === os && os < 4 && LV(x.rhoCall) <= 3) {
      const ub = [0, 1, 2, 3].filter(s => !x.oppSuits.includes(s));
      add('X', h => h.hcp >= 8 && ub.filter(s => h.len[s] >= 4).length >= 2, { min: 8, len: Object.fromEntries(ub.map(s => [s, 3])), cv: 'respx', t: 'Responsive double: 8+ points, both unbid suits' });
    }
    if (pc.call === 'X' && rhoPass && os >= 0) {
      const ub = [3, 2, 1, 0].filter(s => !x.oppSuits.includes(s));
      const best = h => { let b = ub[0]; for (const s of ub) { if (h.len[s] + (s >= 2 ? 0.5 : 0) > h.len[b] + (b >= 2 ? 0.5 : 0)) b = s; } return b; };
      add('P', h => h.len[os] >= 5 && h.top5(os) >= 3 && h.hcp >= 8, { t: 'Penalty pass: strong holding in their suit' });
      for (const s of ub.filter(s => s >= 2)) add(B(4, s), h => best(h) === s && h.len[s] >= 5 && h.hcp >= 12, { min: 12, len: { [s]: 5 }, t: 'Game: 5+ ' + SUIT[s] + ', 12+ HCP' });
      add(B(cheap(os), os), h => h.hcp >= 12, { min: 12, cv: 'cue', t: 'Cue bid: 12+ HCP, forcing', f: 1 });
      add(B(3, 4), h => h.stop(os) && h.hcp >= 13, { min: 13, t: 'Game: 13+ HCP with a stopper' });
      for (const s of ub) { const l = cheap(s) + 1; if (l <= 3) add(B(l, s), h => best(h) === s && h.hcp >= 9 && h.hcp <= 11 && h.len[s] >= 4, { min: 9, max: 11, len: { [s]: 4 }, t: 'Jump: 4+ ' + SUIT[s] + ', 9-11 HCP' }); }
      const nl = cheap(4);
      if (nl <= 2) add(B(nl, 4), h => h.stop(os) && h.hcp >= 6 && h.hcp <= 9 && h.bal, { min: 6, max: 9, t: '6-9 HCP with a stopper' });
      if (nl <= 2) add(B(nl + 1, 4), h => h.stop(os) && h.hcp >= 10 && h.hcp <= 12, { min: 10, max: 12, t: '10-12 HCP with a stopper' });
      for (const s of ub) add(B(cheap(s), s), h => best(h) === s, { max: 8, len: { [s]: 4 }, t: 'Cheapest suit: 4+ ' + SUIT[s] + ', 0-8 HCP' });
      return L;
    }
    if (isNum(pc.call) && pc.call === B(1, 4) && rhoPass) { ntResponses(x, add, 1); return L; }
    if (isNum(pc.call) && ST(pc.call) < 4 && os >= 0 && !x.oppSuits.includes(ST(pc.call))) {
      const ps = ST(pc.call);
      if (ps >= 2) add(B(4, ps), h => h.len[ps] >= 3 && h.sup(ps) >= 14, { min: 12, len: { [ps]: 3 }, t: 'Game: support, 14+ points' });
      if (cheap(os) <= 3) add(B(cheap(os), os), h => h.len[ps] >= 3 && h.sup(ps) >= 11, { min: 11, len: { [ps]: 3 }, cv: 'cue', t: 'Cue bid: support, 11+ points', f: 1 });
      if (cheap(ps) <= 3) add(B(cheap(ps), ps), h => h.len[ps] >= 3 && h.sup(ps) >= 6 && h.sup(ps) <= 10, { min: 6, max: 10, len: { [ps]: 3 }, t: 'Raise: 6-10 points' });
      const nl = cheap(4);
      if (nl <= 2) add(B(nl, 4), h => h.stop(os) && h.hcp >= 8 && h.hcp <= 11, { min: 8, max: 11, t: '8-11 HCP with a stopper' });
      add(B(3, 4), h => h.stop(os) && h.hcp >= 15, { min: 15, t: 'Game: 15+ HCP with a stopper' });
      for (const s of [3, 2, 1, 0]) { if (s === ps || x.oppSuits.includes(s)) continue; const l = cheap(s); if (l > 3) continue; add(B(l, s), h => h.len[s] >= 5 && h.hcp >= 8 && h.len[ps] <= 2, { min: 8, len: { [s]: 5 }, t: 'Natural: 5+ ' + SUIT[s] + ', 8+ HCP' }); }
      add('P', h => h.hcp <= 11, { t: 'Pass' });
      return L;
    }
  }

  /* ===== opener's rebid ===== */
  if (!oppOpened && opening.seat === x.seat && my.length === 1 && pa.length === 1 && isNum(pa[0].call)) {
    const tail = auc.slice(auc.indexOf(opening) + 1);
    if (tail.length === 3 && tail[0].call === 'P' && tail[2].call === 'P') { if (openerRebid(x, add, opening.call, pa[0])) return L; }
  }

  /* ===== responder's second bid: New Minor Forcing, Fourth Suit Forcing ===== */
  if (!oppOpened && opening.seat === p && my.length === 1 && pa.length === 2 && isNum(my[0].call) && isNum(pa[1].call) && ourOnly(x) && LV(opening.call) === 1 && ST(opening.call) < 4) {
    const os = ST(opening.call), ms = ST(my[0].call), r2 = pa[1].call, r2s = ST(r2);
    if (C.nmf && os < 2 && LV(my[0].call) === 1 && ms >= 2 && r2 === B(1, 4)) {
      const nm = os === 0 ? 1 : 0, om = otherMajor(ms);
      add(B(2, nm), h => h.hcp >= 11 && (h.len[ms] >= 5 || h.len[om] >= 4), { min: 11, tag: 'nmf', ms, cv: 'nmf', t: 'New Minor Forcing: asking for 3-card ' + SUIT[ms] + ' support or four ' + SUIT[om], f: 1 });
    }
    if (C.fsf && r2s < 4 && r2s !== os && r2s !== ms && ms < 4) {
      const fourth = [0, 1, 2, 3].find(s => s !== os && s !== ms && s !== r2s);
      const lvl = ST(r2) < fourth ? LV(r2) : LV(r2) + 1;
      if (lvl <= 3) add(B(lvl, fourth), h => h.hcp >= 12 && h.len[r2s] < 4 && h.len[os] < 3 && h.len[ms] < 6 && !h.stop(fourth), { min: 12, tag: 'fsf', cv: 'fsf', t: 'Fourth suit forcing: game values, asking opener to describe', f: 1, gf: 1 });
    }
  }
  if (!oppOpened && opening.seat === x.seat && pLast && pJust && rhoPass && pm.tag === 'nmf' && ourOnly(x)) {
    const ms = pm.ms, om = otherMajor(ms);
    add(B(2, ms), h => h.len[ms] >= 3, { len: { [ms]: 3 }, cv: 'nmf', t: 'New Minor Forcing reply: three-card ' + SUIT[ms] + ' support' });
    if (B(2, om) > pLast.call) add(B(2, om), h => h.len[om] >= 4, { len: { [om]: 4 }, cv: 'nmf', t: 'New Minor Forcing reply: four ' + SUIT[om] });
    add(B(2, 4), h => h.hcp <= 13, { max: 13, cv: 'nmf', t: 'New Minor Forcing reply: no fit, minimum' });
    add(B(3, 4), () => true, { min: 14, cv: 'nmf', t: 'New Minor Forcing reply: no fit, maximum' });
    return L;
  }
  /* ===== support double ===== */
  if (!oppOpened && C.supx && opening.seat === x.seat && my.length === 1 && pa.length === 1 && isNum(pa[0].call) && LV(pa[0].call) === 1 && ST(pa[0].call) >= 2 && isNum(x.rhoCall) && ST(x.rhoCall) < 4 && pJust && x.rhoCall < B(2, ST(pa[0].call))) {
    const M = ST(pa[0].call);
    add('X', h => h.len[M] === 3, { len: { [M]: 3 }, cv: 'supx', t: 'Support double: exactly three ' + SUIT[M] });
    add(B(2, M), h => h.len[M] >= 4 && h.sup(M) <= 15, { len: { [M]: 4 }, t: 'Raise: four-card support' });
    return L;
  }

  /* ===== notrump follow-ups (Stayman, transfers, Smolen) ===== */
  if (!oppOpened && (opening.call === B(1, 4) || opening.call === B(2, 4)) && ourOnly(x)) {
    const lv = LV(opening.call);
    if (opening.seat === p && my.length === 1 && pa.length === 2 && (mm.tag === 'stay' || mm.tag === 'tr')) {
      const ans = pa[1].call;
      if (mm.tag === 'stay') {
        const aS = ST(ans);
        if (aS === 2 || aS === 3) {
          add(B(4, aS), h => h.len[aS] >= 4 && (lv === 2 || h.hcp >= 10) && h.hcp <= 15, { min: lv === 1 ? 10 : 4, len: { [aS]: 4 }, t: 'Major fit: game' });
          if (lv === 1) add(B(3, aS), h => h.len[aS] >= 4 && h.hcp >= 8 && h.hcp <= 9, { min: 8, max: 9, len: { [aS]: 4 }, t: 'Major fit: invitational' });
        }
        if (aS === 1 && C.smolen && lv === 1) {
          add(B(3, 2), h => h.len[2] === 4 && h.len[3] >= 5 && h.hcp >= 10, { min: 10, len: { 2: 4, 3: 5 }, tag: 'smolen', five: 3, cv: 'smolen', t: 'Smolen: 4♥ + 5♠, game forcing', f: 1, gf: 1 });
          add(B(3, 3), h => h.len[3] === 4 && h.len[2] >= 5 && h.hcp >= 10, { min: 10, len: { 3: 4, 2: 5 }, tag: 'smolen', five: 2, cv: 'smolen', t: 'Smolen: 4♠ + 5♥, game forcing', f: 1, gf: 1 });
        }
        if (aS === 2 && lv === 1) add(B(2, 3), h => h.len[3] >= 4 && h.hcp >= 8 && h.hcp <= 9, { min: 8, max: 9, len: { 3: 4 }, t: 'Four spades, invitational' });
        if (lv === 1) add(B(2, 4), h => h.hcp <= 9, { min: 8, max: 9, t: 'Invitational: 8-9 HCP' });
        add(B(3, 4), h => h.hcp <= 15, { min: lv === 1 ? 10 : 4, max: 15, t: 'Game' });
      } else {
        const M = ST(ans);
        if (lv === 1) {
          add('P', h => h.hcp <= 7, { max: 7, t: 'Weak: play the transfer suit' });
          add(B(3, M), h => h.len[M] >= 6 && h.hcp <= 9, { min: 8, max: 9, len: { [M]: 6 }, t: 'Six-card suit, invitational' });
          add(B(4, M), h => h.len[M] >= 6 && h.hcp <= 15, { min: 10, max: 15, len: { [M]: 6 }, t: 'Six-card suit, game' });
          add(B(2, 4), h => h.hcp <= 9, { min: 8, max: 9, len: { [M]: 5 }, t: 'Five-card major, invitational' });
          add(B(3, 4), h => h.hcp <= 15, { min: 10, max: 15, len: { [M]: 5 }, t: 'Five-card major, game: opener chooses' });
        } else {
          add('P', h => h.hcp <= 3, { max: 3, t: 'Weak' });
          add(B(4, M), h => h.len[M] >= 6 && h.hcp <= 12, { len: { [M]: 6 }, t: 'Six-card suit, game' });
          add(B(3, 4), h => h.hcp <= 12, { len: { [M]: 5 }, t: 'Five-card major, game: opener chooses' });
        }
      }
      if (L.length) return L;
    }
    if (opening.seat === x.seat && pLast && pm.tag === 'smolen' && pJust) {
      const F = pm.five;
      add(B(4, F), h => h.len[F] >= 3, { t: 'Smolen reply: three-card ' + SUIT[F] + ' fit, game' });
      add(B(3, 4), () => true, { t: 'Smolen reply: no fit, 3NT' });
      return L;
    }
    if (opening.seat === x.seat && my.length === 2 && my[1].m && my[1].m.tag === 'trc' && pa.length === 2 && ST(my[1].call) >= 2) {
      const M = ST(my[1].call), r2 = pa[1].call;
      if (r2 === B(2, 4)) { add(B(4, M), h => h.len[M] >= 3 && h.hcp >= 16, { t: 'Fit and maximum: game' }); add(B(3, M), h => h.len[M] >= 3, { t: 'Fit, minimum' }); add(B(3, 4), h => h.hcp >= 16, { t: 'Maximum, no fit' }); add('P', () => true, { t: 'Minimum' }); return L; }
      if (r2 === B(3, 4)) { add(B(4, M), h => h.len[M] >= 3, { t: 'Three-card fit: major game' }); add('P', () => true, { t: 'No fit' }); return L; }
      if (r2 === B(3, M)) { add(B(4, M), h => lv === 2 || h.hcp >= 16 || h.len[M] >= 4, { t: 'Accepting the invitation' }); add('P', () => true, { t: 'Minimum' }); return L; }
      if (r2 >= B(4, 0)) { add('P', () => true, { t: 'Pass' }); return L; }
    }
    if (opening.seat === p && my.length === 1 && pa.length === 2 && mm.tag === 'trm') { add('P', () => true, { t: 'Pass to play the minor' }); return L; }
  }
  return L;
}

/* ---- responses to 1NT / 2NT (also after our 1NT overcall) ---- */
function ntResponses(x, add, lv) {
  const C = x.C, off = lv - 1;
  if (C.texas) {
    add(B(4, 1), h => h.len[2] >= 6 && h.hcp >= (lv === 1 ? 10 : 4) && h.hcp <= (lv === 1 ? 15 : 11), { min: lv === 1 ? 10 : 4, len: { 2: 6 }, tag: 'texas', to: B(4, 2), cv: 'texas', t: 'Texas transfer: 6+ ♥, game (opener bids 4♥)' });
    add(B(4, 2), h => h.len[3] >= 6 && h.hcp >= (lv === 1 ? 10 : 4) && h.hcp <= (lv === 1 ? 15 : 11), { min: lv === 1 ? 10 : 4, len: { 3: 6 }, tag: 'texas', to: B(4, 3), cv: 'texas', t: 'Texas transfer: 6+ ♠, game (opener bids 4♠)' });
  }
  if (C.gerber) add(B(4, 0), h => h.hcp >= (lv === 1 ? 18 : 13) && h.semi, { min: lv === 1 ? 18 : 13, tag: 'gerb', cv: 'gerber', t: 'Gerber: asking for aces (slam interest)' });
  if (C.stayman) add(B(2 + off, 0), h => h.len[2] >= 4 && h.len[3] >= 4 && h.hcp >= (lv === 1 ? 8 : 4), { min: lv === 1 ? 8 : 4, tag: 'stay', cv: 'stayman', t: 'Stayman: asking for a 4-card major', f: 1 });
  add(B(2 + off, 1), h => h.len[2] >= 5 && h.len[2] >= h.len[3], { len: { 2: 5 }, tag: 'tr', cv: 'jtr', t: 'Transfer: 5+ ♥ (opener bids hearts)', f: 1 });
  add(B(2 + off, 2), h => h.len[3] >= 5, { len: { 3: 5 }, tag: 'tr', cv: 'jtr', t: 'Transfer: 5+ ♠ (opener bids spades)', f: 1 });
  if (C.stayman) add(B(2 + off, 0), h => h.hcp >= (lv === 1 ? 8 : 4) && (h.len[2] === 4 || h.len[3] === 4) && h.pat !== '4333', { min: lv === 1 ? 8 : 4, tag: 'stay', cv: 'stayman', t: 'Stayman: asking for a 4-card major', f: 1 });
  if (lv === 1) {
    if (C.fourWay) {
      add(B(2, 3), h => h.len[0] >= 6 && h.hcp <= 7, { max: 7, len: { 0: 6 }, tag: 'trm', to: B(3, 0), cv: 'fourWay', t: '4-way transfer: 6+ ♣ (opener bids 3♣)' });
      add(B(2, 4), h => h.len[1] >= 6 && h.hcp <= 7, { max: 7, len: { 1: 6 }, tag: 'trm', to: B(3, 1), cv: 'fourWay', t: '4-way transfer: 6+ ♦ (opener bids 3♦)' });
      if (C.stayman) add(B(2, 0), h => h.hcp >= 8 && h.hcp <= 9, { min: 8, tag: 'stay', cv: 'stayman', t: 'Stayman (may be a balanced invitation)', f: 1 });
    } else add(B(2, 4), h => h.hcp >= 8 && h.hcp <= 9, { min: 8, max: 9, t: 'Invitational: 8-9 HCP' });
    add(B(3, 4), h => h.hcp >= 10 && h.hcp <= 15, { min: 10, max: 15, t: 'Game: 10-15 HCP' });
    add(B(4, 4), h => h.hcp >= 16 && h.hcp <= 17, { min: 16, max: 17, tag: 'q', cv: 'q', t: 'Quantitative 4NT: slam invitation, 16-17 HCP' });
    add(B(6, 4), h => h.hcp >= 18 && h.hcp <= 19, { min: 18, max: 19, t: 'Small slam' });
    add(B(7, 4), h => h.hcp >= 20, { min: 20, t: 'Grand slam' });
    add('P', h => h.hcp <= 7, { max: 7, t: 'Weak hand: 0-7 HCP' });
  } else {
    add(B(3, 4), h => h.hcp >= 4 && h.hcp <= 10, { min: 4, max: 10, t: 'Game: 4-10 HCP' });
    add(B(4, 4), h => h.hcp >= 11 && h.hcp <= 12, { min: 11, max: 12, tag: 'q', cv: 'q', t: 'Quantitative 4NT: slam invitation, 11-12 HCP' });
    add(B(6, 4), h => h.hcp >= 13 && h.hcp <= 15, { min: 13, max: 15, t: 'Small slam' });
    add(B(7, 4), h => h.hcp >= 16, { min: 16, t: 'Grand slam' });
    add('P', h => h.hcp <= 3, { max: 3, t: 'Very weak hand' });
  }
}

/* ---- responses to one of a suit, RHO passed or doubled ---- */
function suitResponses(x, add, o, os) {
  const C = x.C, maj = os >= 2, rhoX = x.rhoCall === 'X', un = !x.passed;
  const two1 = C.twoOverOne && un;
  if (rhoX) add('XX', h => h.hcp >= 10, { min: 10, t: 'Redouble: 10+ HCP' });
  if (maj) {
    if (C.drury && x.passed && !rhoX && x.auc.indexOf(x.opening) >= 2) add(B(2, 0), h => h.len[os] >= 3 && h.sup(os) >= 10 && h.sup(os) <= 12, { min: 10, max: 11, len: { [os]: 3 }, tag: "drury", cv: "drury", t: "Drury: 3+ " + SUIT[os] + " support, 10-12 points (passed hand)", f: 1 });
    if (C.splinter && un && !rhoX) for (const s of [0, 1, 2, 3]) {
      if (s === os) continue; const n = B(1, s) > o ? 1 : 2; const lvl = n + 2; if (lvl > 4) continue;
      add(B(lvl, s), h => h.len[os] >= 4 && h.len[s] <= 1 && h.hcp >= 11 && h.hcp <= 15, { min: 11, max: 15, len: { [os]: 4 }, tag: 'splinter', cv: 'splinter', t: 'Splinter: 4+ ' + SUIT[os] + ' support, singleton or void in ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
    }
    if (C.j2nt && un && !rhoX) add(B(2, 4), h => h.len[os] >= 4 && h.hcp >= 13, { min: 13, len: { [os]: 4 }, tag: 'j2nt', cv: 'j2nt', t: 'Jacoby 2NT: 4+ support, 13+ points, game forcing', f: 1, gf: 1 });
    if (C.bergen && !rhoX) {
      add(B(3, os), h => h.len[os] >= 4 && h.hcp <= 6, { max: 6, len: { [os]: 4 }, tag: 'bergenP', cv: 'bergen', t: 'Bergen: 4+ support, 0-6 points (preemptive)' });
      add(B(3, 1), h => h.len[os] >= 4 && h.sup(os) >= 10 && h.sup(os) <= 12, { min: 9, max: 12, len: { [os]: 4 }, tag: 'bergen10', cv: 'bergen', t: 'Bergen 3♦: 4+ support, 10-12 points (limit raise)', f: 1 });
      add(B(3, 0), h => h.len[os] >= 4 && h.sup(os) >= 7 && h.sup(os) <= 9, { min: 7, max: 9, len: { [os]: 4 }, tag: 'bergen7', cv: 'bergen', t: 'Bergen 3♣: 4+ support, 7-9 points', f: 1 });
    } else {
      add(B(4, os), h => h.len[os] >= 5 && h.hcp < 10, { max: 9, len: { [os]: 5 }, t: 'Preemptive: 5+ support, weak hand' });
      add(B(3, os), h => h.len[os] >= 4 && h.sup(os) >= 10 && h.sup(os) <= 12, { min: 9, max: 12, len: { [os]: 4 }, t: 'Limit raise: 4+ support, 10-12 points' });
      add(B(2, os), h => h.len[os] >= 4 && h.sup(os) >= 6 && h.sup(os) <= 9, { min: 6, max: 9, len: { [os]: 4 }, t: 'Single raise: support, 6-9 points' });
    }
    if (os === 2) add(B(1, 3), h => h.len[3] >= 4 && h.hcp >= 6, { min: 6, len: { 3: 4 }, t: '4+ ♠, 6+ HCP', f: 1 });
    add(B(2, os), h => h.len[os] >= 3 && h.sup(os) >= 6 && h.sup(os) <= 9, { min: 6, max: 9, len: { [os]: 3 }, t: 'Single raise: 3-card support, 6-9 points' });
    if (!C.bergen) add(B(3, os), h => h.len[os] === 3 && h.sup(os) >= 10 && h.sup(os) <= 12, { min: 10, max: 12, len: { [os]: 3 }, t: 'Limit raise: 3-card support, 10-12 points' });
  } else {
    if (C.invMin && un && !rhoX) {
      add(B(2, os), h => h.len[os] >= (os === 0 ? 5 : 4) && h.hcp >= 10 && h.len[2] < 4 && h.len[3] < 4, { min: 10, len: { [os]: 4 }, tag: "inv", cv: "invMin", t: "Inverted minor: 10+ points, 4+ support, no 4-card major, forcing", f: 1 });
      add(B(3, os), h => h.len[os] >= 5 && h.hcp <= 9 && h.len[2] < 4 && h.len[3] < 4, { max: 9, len: { [os]: 5 }, cv: "invMin", t: "Inverted minor: preemptive raise, 0-9 points, 5+ support" });
    }
    if (os === 0) add(B(1, 1), h => h.hcp >= 6 && ((h.len[1] >= 5 && h.len[1] > Math.max(h.len[2], h.len[3])) || (h.len[1] >= 4 && h.len[2] < 4 && h.len[3] < 4)), { min: 6, len: { 1: 4 }, t: '4+ ♦, 6+ HCP', f: 1 });
    add(B(1, 2), h => h.hcp >= 6 && h.len[2] >= 4 && !(h.len[3] >= 5 && h.len[3] > h.len[2]), { min: 6, len: { 2: 4 }, t: '4+ ♥, 6+ HCP', f: 1 });
    add(B(1, 3), h => h.hcp >= 6 && h.len[3] >= 4, { min: 6, len: { 3: 4 }, t: '4+ ♠, 6+ HCP', f: 1 });
  }
  if (C.sjs && un && !rhoX) for (const s of [1, 2, 3]) {
    if (s <= os) continue;
    add(B(2, s), h => h.len[s] >= 5 && h.hcp >= 19 && h.top5(s) >= 3, { min: 19, len: { [s]: 5 }, tag: "sjs", cv: "sjs", t: "Strong jump shift: 19+ points, good " + SUIT[s] + " suit, slam interest", f: 1, gf: 1 });
  }
  if (C.wjs && !C.sjs && !rhoX) for (const s of [1, 2, 3]) {
    if (s <= os) continue;
    add(B(2, s), h => h.len[s] >= 6 && h.hcp <= 5 && h.top5(s) >= 1, { max: 5, len: { [s]: 6 }, tag: 'wjs', cv: 'wjs', t: 'Weak jump shift: 6+ ' + SUIT[s] + ', 0-5 HCP' });
  }
  if (maj && two1) add(B(1, 4), h => h.hcp >= 6 && h.hcp <= 12 && !(h.len[os] >= 3 && h.hcp <= 9), { min: 6, max: 12, tag: 'nt1f', cv: 'twoOverOne', t: 'Forcing 1NT: 6-12 HCP', f: 1 });
  else add(B(1, 4), h => h.hcp >= 6 && h.hcp <= 10 && !(maj && h.len[os] >= 3), { min: 6, max: 10, t: '6-10 HCP, no fit' });
  for (const s of [3, 2, 1, 0]) {
    if (s === os || B(1, s) > o) continue;
    const need = (os === 3 && s === 2) ? 5 : 4;
    add(B(2, s), h => h.hcp >= (two1 ? 12 : 11) && h.len[s] >= need && h.len[s] >= Math.max(...[0, 1, 2, 3].filter(u => u !== os).map(u => h.len[u])),
      two1 ? { min: 12, len: { [s]: need }, cv: 'twoOverOne', t: '2/1: ' + need + '+ ' + SUIT[s] + ', 12+ HCP, game forcing', f: 1, gf: 1 } : { min: 11, len: { [s]: need }, t: 'New suit: ' + need + '+ ' + SUIT[s] + ', 11+ HCP', f: 1 });
  }
  if (!maj && !(C.invMin && un && !rhoX)) {
    add(B(2, 4), h => h.bal && h.hcp >= 13 && h.hcp <= 15 && h.len[2] < 4 && h.len[3] < 4, { min: 13, max: 15, t: 'Balanced 13-15 HCP, game forcing', f: 1, gf: 1 });
    add(B(3, os), h => h.len[os] >= (os === 0 ? 5 : 4) && h.hcp >= 11 && h.hcp <= 12, { min: 11, max: 12, len: { [os]: 4 }, t: 'Limit raise: 11-12 HCP' });
    add(B(2, os), h => h.len[os] >= (os === 0 ? 5 : 4) && h.hcp >= 6 && h.hcp <= 10, { min: 6, max: 10, len: { [os]: 4 }, t: 'Single raise: 6-10 HCP' });
  }
  add(B(3, 4), h => h.bal && h.hcp >= 15 && h.hcp <= 17, { min: 15, max: 17, t: 'Balanced 15-17 HCP' });
  add('P', h => h.hcp <= 5, { max: 5, t: 'Weak hand: 0-5 HCP' });
}

/* ---- responses after RHO overcalls partner's one-suit opening ---- */
function competitiveResponses(x, add, os) {
  const ob = x.rhoCall, obs = ST(ob), maj = os >= 2;
  const cheap = s => (ST(ob) < s ? LV(ob) : LV(ob) + 1);
  const cl = cheap(os), need = maj ? 3 : 4;
  if (obs < 4 && cl + 1 <= 4) add(B(cheap(obs), obs), h => h.len[os] >= need && h.sup(os) >= 11, { min: 11, len: { [os]: need }, cv: 'cue', t: 'Cue bid: support, limit raise or better', f: 1 });
  if (cl <= 3) add(B(cl, os), h => h.len[os] >= need && h.sup(os) >= 6 && h.sup(os) <= 10, { min: 6, max: 10, len: { [os]: need }, t: 'Raise: 6-10 points' });
  if (LV(ob) <= 2 && obs < 4) {
    const um = [2, 3].filter(s => s !== os && s !== obs);
    if (um.length) add('X', h => h.hcp >= (LV(ob) === 1 ? 6 : 8) && um.some(s => h.len[s] >= 4), { min: 6, len: Object.fromEntries(um.map(s => [s, 4])), cv: 'nego', t: 'Negative double: four cards in the unbid major' });
  }
  for (const s of [3, 2, 1, 0]) { if (s === os || s === obs) continue; const l = cheap(s); if (l > 3) continue; add(B(l, s), h => h.len[s] >= 5 && h.hcp >= (l === 1 ? 6 : 10), { min: l === 1 ? 6 : 10, len: { [s]: 5 }, t: 'Natural: 5+ ' + SUIT[s] + ', ' + (l === 1 ? 6 : 10) + '+ HCP', f: 1 }); }
  if (obs < 4) {
    const nl = cheap(4);
    if (nl === 1) add(B(1, 4), h => h.stop(obs) && h.hcp >= 8 && h.hcp <= 10, { min: 8, max: 10, t: '8-10 HCP with a stopper in their suit' });
    if (nl <= 2) add(B(2, 4), h => h.stop(obs) && h.hcp >= 11 && h.hcp <= 12, { min: 11, max: 12, t: '11-12 HCP with a stopper' });
    add(B(3, 4), h => h.stop(obs) && h.hcp >= 13 && h.hcp <= 16, { min: 13, max: 16, t: 'Game: 13-16 HCP with a stopper' });
  }
  add('P', h => h.hcp <= 9, { t: 'Pass' });
}

/* ---- opener's second bid, uncontested ---- */
function openerRebid(x, add, o, resp) {
  const os = ST(o), ol = LV(o), r = resp.call, rs = ST(r), rl = LV(r), rm = resp.m || {};
  if (os === 4 && (ol === 1 || ol === 2)) {
    const off = ol - 1;
    if (rm.tag === 'stay') {
      add(B(2 + off, 2), h => h.len[2] >= 4, { len: { 2: 4 }, cv: 'stayman', t: 'Stayman reply: four hearts' });
      add(B(2 + off, 3), h => h.len[3] >= 4, { len: { 3: 4 }, cv: 'stayman', t: 'Stayman reply: four spades, not four hearts' });
      add(B(2 + off, 1), () => true, { cv: 'stayman', t: 'Stayman reply: no 4-card major' });
      return true;
    }
    if (rm.tag === 'tr') { const M = r === B(2 + off, 1) ? 2 : 3; add(B(2 + off, M), () => true, { tag: 'trc', cv: 'jtr', t: 'Completing the transfer to ' + SUIT[M] }); return true; }
    if (rm.tag === 'q') { add(B(6, 4), h => h.hcp >= (ol === 1 ? 17 : 21), { t: 'Accepting the invitation' }); add('P', () => true, { t: 'Minimum: declining' }); return true; }
    if (r === B(2, 4) && ol === 1 && !rm.tag) { add(B(3, 4), h => h.hcp >= 16, { min: 16, t: 'Maximum: accepting the invitation' }); add('P', () => true, { max: 15, t: 'Minimum' }); return true; }
    if (r === B(3, 4) || (r >= B(4, 3) && !rm.tag)) { add('P', () => true, { t: 'Pass' }); return true; }
    return false;
  }
  if (o === B(2, 0) && r === B(2, 1)) {
    add(B(2, 4), h => h.bal && h.hcp <= 24, { min: 22, max: 24, t: 'Balanced 22-24 HCP' });
    add(B(3, 4), h => h.bal && h.hcp >= 25, { min: 25, max: 27, t: 'Balanced 25-27 HCP' });
    for (const s of [3, 2]) add(B(2, s), h => h.longest === s || (h.len[s] >= 5 && h.len[s] >= h.len[h.longest]), { min: 22, len: { [s]: 5 }, t: '5+ ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
    for (const s of [0, 1]) add(B(3, s), h => h.longest === s, { min: 22, len: { [s]: 5 }, t: '5+ ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
    return true;
  }
  if (ol !== 1 || os === 4) return false;
  if (rm.tag === 'wjs') { add('P', () => true, { t: 'Passing partner\'s weak suit' }); return true; }
  if (rm.tag === 'inv') {
    add(B(3, 4), h => h.bal && h.hcp >= 18, { min: 18, max: 19, cv: 'invMin', t: 'After the inverted raise: balanced 18-19' });
    add(B(2, 4), h => h.bal && h.hcp <= 14, { min: 12, max: 14, cv: 'invMin', t: 'After the inverted raise: balanced minimum' });
    for (let s = 1; s <= 3; s++) if (s !== os && B(2, s) > r) add(B(2, s), h => h.stop(s) && h.hcp >= 15, { min: 15, t: 'Stopper in ' + SUIT[s] + ', extra values', f: 1 });
    add(B(3, os), () => true, { max: 14, t: 'Minimum, unbalanced' });
    return true;
  }
  if (rm.tag === 'drury') {
    add(B(4, os), h => h.hcp >= 14, { min: 14, cv: 'drury', t: 'Drury reply: full opening, game' });
    add(B(2, os), () => true, { max: 13, cv: 'drury', t: 'Drury reply: light opening, no game' });
    return true;
  }
  if (rm.tag === 'j2nt') {
    add(B(4, os), h => h.hcp <= 14, { min: 12, max: 14, cv: 'j2nt', t: 'Jacoby 2NT reply: minimum, stop in game' });
    add(B(3, os), () => true, { min: 15, cv: 'j2nt', t: 'Jacoby 2NT reply: extras, slam interest', f: 1 });
    return true;
  }
  if (rm.tag === 'bergen7') { add(B(4, os), h => h.sup(os) >= 16, { min: 15, t: 'After Bergen: game' }); add(B(3, os), () => true, { max: 15, cv: 'bergen', t: 'After Bergen: minimum, stop at the three level' }); return true; }
  if (rm.tag === 'bergen10') { add(B(4, os), h => h.sup(os) >= 14, { min: 14, t: 'Accepting the limit raise: game' }); add(B(3, os), () => true, { max: 13, cv: 'bergen', t: 'Minimum: stop at the three level' }); return true; }
  if (rm.tag === 'bergenP') { add(B(4, os), h => h.sup(os) >= 18, { min: 17, t: 'Strong hand: game' }); add('P', () => true, { t: 'Pass' }); return true; }
  if (rs === os && rl === 2) {
    if (os >= 2) add(B(4, os), h => h.sup(os) >= 19, { min: 18, t: 'Game: 19+ points' });
    else add(B(3, 4), h => h.hcp >= 18 && h.semi, { min: 18, t: 'Game: balanced, 18+ HCP' });
    add(B(3, os), h => h.sup(os) >= 16, { min: 15, max: 18, t: 'Game invitation: 16-18 points' });
    add('P', () => true, { max: 15, t: 'Minimum hand' });
    return true;
  }
  if (rs === os && rl === 3) {
    if (os >= 2) add(B(4, os), h => h.sup(os) >= 14, { min: 14, t: 'Accepting: game' });
    else { add(B(3, 4), h => h.hcp >= 14 && h.semi, { min: 14, t: 'Accepting: 3NT' }); add(B(5, os), h => h.tp >= 17, { min: 15, t: 'Accepting: minor-suit game' }); }
    add('P', () => true, { max: 13, t: 'Minimum: declining' });
    return true;
  }
  if (rm.tag === 'splinter') return false;
  if ((rl >= 3 && rs === os) || r === B(3, 4) || r === B(4, os)) { add('P', () => true, { t: 'Pass' }); return true; }
  if (rl === 1 && rs < 4) {
    if (rs >= 2) {
      add(B(4, rs), h => h.len[rs] >= 4 && h.sup(rs) >= 19, { min: 18, len: { [rs]: 4 }, t: 'Four-card support, game: 19+ points' });
      add(B(3, rs), h => h.len[rs] >= 4 && h.sup(rs) >= 16, { min: 16, max: 18, len: { [rs]: 4 }, t: 'Jump raise: 16-18 points' });
      add(B(2, rs), h => h.len[rs] >= 4, { min: 12, max: 15, len: { [rs]: 4 }, t: 'Four-card support: 12-15 points' });
    }
    for (let s = rs + 1; s <= 3; s++) if (s !== os) add(B(1, s), h => h.len[s] >= 4, { min: 11, max: 18, len: { [s]: 4 }, t: '4+ ' + SUIT[s] + ', 12-18 HCP' });
    add(B(1, 4), h => h.bal && h.hcp <= 14, { min: 12, max: 14, t: 'Balanced, 12-14 HCP' });
    add(B(2, 4), h => h.bal && h.hcp >= 18, { min: 18, max: 19, t: 'Balanced, 18-19 HCP' });
    add(B(3, os), h => h.len[os] >= 6 && h.tp >= 16, { min: 16, max: 18, len: { [os]: 6 }, t: '6+ ' + SUIT[os] + ', 16-18 points' });
    if (rs === 1 && os === 0) add(B(2, 1), h => h.len[1] >= 4 && h.sup(1) <= 15, { len: { 1: 4 }, t: 'Four-card support' });
    add(B(2, os), h => h.len[os] >= 6, { min: 11, max: 15, len: { [os]: 6 }, t: '6+ ' + SUIT[os] + ', minimum' });
    for (let s = 0; s < os; s++) if (s !== rs) add(B(2, s), h => h.len[s] >= 4 && h.hcp <= 18, { min: 11, max: 18, len: { [s]: 4 }, t: 'Second suit: 4+ ' + SUIT[s] });
    for (let s = os + 1; s <= 3; s++) if (s !== rs && B(2, s) > r) add(B(2, s), h => h.len[s] >= 4 && h.hcp >= 17, { min: 17, len: { [s]: 4 }, t: 'Reverse: 4+ ' + SUIT[s] + ', 17+ HCP', f: 1 });
    add(B(2, os), h => h.len[os] >= 5, { min: 11, max: 15, len: { [os]: 5 }, t: '5+ ' + SUIT[os] + ', minimum' });
    add(B(1, 4), h => h.hcp <= 15, { max: 15, t: 'Minimum hand' });
    return true;
  }
  if (r === B(1, 4)) {
    const forcing = rm.tag === 'nt1f';
    add(B(2, 4), h => h.bal && h.hcp >= 18, { min: 18, max: 19, t: 'Balanced 18-19, invitational' });
    add(B(3, os), h => h.len[os] >= 6 && h.tp >= 16, { min: 16, len: { [os]: 6 }, t: '6+ ' + SUIT[os] + ', invitational' });
    add(B(2, os), h => h.len[os] >= 6, { len: { [os]: 6 }, t: '6+ ' + SUIT[os] });
    for (let s = 0; s < os; s++) add(B(2, s), h => h.len[s] >= 4 && h.hcp <= 18, { min: 11, max: 18, len: { [s]: 4 }, t: 'Second suit: 4+ ' + SUIT[s] });
    for (let s = os + 1; s <= 3; s++) add(B(2, s), h => h.len[s] >= 4 && h.hcp >= 17, { min: 17, len: { [s]: 4 }, t: 'Reverse: 17+ HCP', f: 1 });
    if (forcing) {
      for (const s of [0, 1]) if (s !== os) add(B(2, s), h => h.len[s] >= 3, { min: 11, max: 15, len: { [s]: 3 }, cv: 'twoOverOne', t: 'Reply to forcing 1NT: three-card ' + SUIT[s] });
      add(B(2, os), () => true, { len: { [os]: 5 }, t: 'Five ' + SUIT[os] + ', minimum' });
    } else add('P', () => true, { max: 15, t: 'Minimum: pass' });
    return true;
  }
  if (rl === 2 && rs < 4 && rs !== os) {
    add(B(3, rs), h => h.len[rs] >= (rs >= 2 ? 3 : 4), { len: { [rs]: 3 }, t: 'Support for ' + SUIT[rs] });
    add(B(2, os), h => h.len[os] >= 6 && B(2, os) > r, { len: { [os]: 6 }, t: '6+ ' + SUIT[os] });
    for (let s = 0; s <= 3; s++) if (s !== os && s !== rs && B(2, s) > r) add(B(2, s), h => h.len[s] >= 4, { len: { [s]: 4 }, t: '4+ ' + SUIT[s] });
    add(B(2, 4), h => h.semi, { t: 'Balanced hand' });
    if (B(2, os) > r) add(B(2, os), () => true, { len: { [os]: 5 }, t: '5+ ' + SUIT[os] });
    add(B(3, os), h => h.len[os] >= 6, { len: { [os]: 6 }, t: '6+ ' + SUIT[os] });
    return true;
  }
  return false;
}

function partnerForcing(x) {
  const i = x.auc.length - 2; if (i < 0) return false; const e = x.auc[i];
  return e.seat === x.p && e.call !== 'P' && e.m && e.m.f && x.rhoCall === 'P';
}

/* ---- general judgement when no specific rule applies ---- */
function generic(x, h) {
  const P = pInfo(x), st = x.st, last = st.last, me = x.seat;
  const forced = partnerForcing(x);
  const gf = x.auc.some(e => sideOf(e.seat) === sideOf(me) && e.m && e.m.gf);
  let majorFit = -1, minorFit = -1, mfl = 0, nfl = 0;
  for (const s of [3, 2]) { const t = h.len[s] + P.len[s]; if (t >= 8 && t > mfl) { majorFit = s; mfl = t; } }
  for (const s of [1, 0]) { const t = h.len[s] + P.len[s]; if (t >= 8 && t > nfl) { minorFit = s; nfl = t; } }
  const oppStops = x.oppSuits.every(s => h.stop(s));
  const pBidNT = x.pa.some(e => isNum(e.call) && ST(e.call) === 4);
  let t;
  if (majorFit >= 0) t = majorFit;
  else if ((pBidNT && oppStops) || ((h.bal || h.semi) && oppStops && minorFit < 0)) t = 4;
  else if (minorFit >= 0) t = minorFit;
  else {
    const ls = h.longest;
    if (h.len[ls] >= 6) t = ls;
    else { let ps = -1; for (let s = 0; s < 4; s++) if (P.len[s] >= 6 && h.len[s] >= 2) ps = s; if (ps >= 0) t = ps; else if (oppStops && !x.oppSuits.includes(ls)) t = 4; else t = h.len[ls] >= 5 ? ls : 4; }
  }
  const fitLen = t < 4 ? h.len[t] + P.len[t] : 0;
  const pEst = P.min + Math.min(2, Math.floor((P.max - P.min) / 2));
  const my = (t < 4 ? h.sup(t) : h.hcp) + x.agg;
  let est = my + pEst, lo = my + P.min; const hi = my + P.max;
  if (gf) { est = Math.max(est, 25); lo = Math.max(lo, 25); }
  const gameL = t === 4 ? 3 : t >= 2 ? 4 : 5;
  let goal;
  if (est >= 37 && lo >= 35) goal = 7;
  else if (est >= 33) goal = 6;
  else if (t < 2) { goal = est >= 29 ? 5 : (est >= 26 ? 4 : 0); if (minorFit >= 0 && est >= 25 && oppStops && est < 29) { t = 4; goal = 3; } }
  else if (lo >= 25 || est >= 26) goal = gameL;
  else if (hi >= 25 && est >= 23) goal = -1;
  else goal = 0;
  const cheapest = s => last < 0 ? 1 : (ST(last) < s ? LV(last) : LV(last) + 1);
  const cl = cheapest(t);
  const ourLast = st.lastSeat >= 0 && sideOf(st.lastSeat) === sideOf(me);
  const bwUsed = x.auc.some(e => sideOf(e.seat) === sideOf(me) && e.m && ['bw', 'q', 'gerb'].includes(e.m.tag));
  const range = { min: Math.max(0, h.hcp - 1), max: h.hcp + 2 };
  const lenm = t < 4 ? { [t]: Math.min(h.len[t], 6) } : undefined;
  let call = null, m = {};
  if (goal >= 6) {
    if (!bwUsed && last < B(4, 4) && t < 4 && (t !== 0 || h.aces >= 2)) { call = B(4, 4); m = { tag: 'bw', trump: t, rkc: x.C.rkc ? 1 : 0, cv: x.C.rkc ? 'rkc' : 'bw', t: x.C.rkc ? 'RKCB 1430: asking for key cards (trumps ' + SUIT[t] + ')' : 'Blackwood: how many aces?', ...range }; }
    else if (B(goal, t) > last) { call = B(goal, t); m = { t: (goal === 7 ? 'Grand' : 'Small') + ' slam', ...range, len: lenm }; }
  }
  if (call === null && goal >= 3 && goal < 6 && cl <= goal) { call = B(goal, t); m = { t: 'Game contract', ...range, len: lenm }; }
  if (call === null && goal === -1) {
    if (cl <= gameL - 1) { call = B(gameL - 1, t); m = { t: 'Game invitation', ...range, len: lenm }; }
    else if (cl <= gameL && est >= 24) { call = B(gameL, t); m = { t: 'Game contract', ...range, len: lenm }; }
  }
  if (call === null && goal === 0) {
    if (!(ourLast && (ST(last) === t || t === 4 || h.len[ST(last)] >= 2))) {
      const cap = fitLen >= 9 ? 3 : 2;
      if (t < 4 && cl <= cap && (fitLen >= 8 || h.len[t] >= 6) && h.hcp >= 5) { call = B(cl, t); m = { t: 'Competing in ' + SUIT[t], ...range, len: lenm }; }
    }
  }
  if (call === null && last >= 0 && !ourLast && st.dbl === 0) {
    const os = ST(last), ol = LV(last), he = h.hcp + pEst;
    if ((os < 4 && ol >= 2 && he >= 23 && h.len[os] >= 3) || (os === 4 && ol >= 2 && he >= 25) || (ol >= 4 && os < 4 && he >= 21 && h.len[os] >= 2 && h.hcp >= 10)) { call = 'X'; m = { t: 'Penalty double' }; }
  }
  if (call === null && forced) {
    let s = t, l = cheapest(s);
    if (l > 4) { s = 4; l = cheapest(4); }
    if (l <= 5) { call = B(l, s); m = { t: 'Answering a forcing bid', ...range, len: lenm }; }
  }
  if (call === null || !isLegal(x.auc, me, call)) { call = 'P'; m = { t: 'Pass' }; }
  return { call, m };
}

function aiBid(auc, seat, hand, cards) {
  const x = ctxOf(auc, seat, cards), h = ev(hand);
  for (const c of cands(x)) if (isLegal(auc, seat, c.call) && c.test(h)) return { call: c.call, m: c.m };
  return generic(x, h);
}
function explainCall(auc, seat, call, cards) {
  const x = ctxOf(auc, seat, cards);
  for (const c of cands(x)) if (c.call === call) return c.m;
  if (call === 'P') return { t: 'Pass' };
  if (call === 'X') return { t: 'Double' };
  if (call === 'XX') return { t: 'Redouble' };
  const s = ST(call);
  return s === 4 ? { t: 'Natural notrump' } : { t: 'Natural: ' + SUIT[s] + ' suit', len: { [s]: 4 } };
}

Object.assign(E, { ctxOf, pInfo, cands, generic, aiBid, explainCall });
});
