/* BridgePlay — bidding system.
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
    // the side's bidding system; ntShift moves the notrump ranges (e.g. 3 for a 12-14 notrump)
    sys: E.sysOf(cfg.sys), ntShift: 15 - E.sysOf(cfg.sys).nt[0],
    opening: bids[0] || null, oppSuits: [...new Set(oppBids.map(e => ST(e.call)).filter(s => s < 4))],
    rhoCall: auc.length ? auc[auc.length - 1].call : null,
    passed: auc.some(e => e.seat === seat && e.call === 'P'),
  };
}
// the robots see every hand (Servet's switch): partner's real values and lengths, not only what the calls showed
let SEE = null;
function pInfo(x) {
  if (SEE && SEE[x.p] && SEE[x.p].length) { const h = ev(SEE[x.p]); return { min: h.hcp, max: h.hcp, len: h.len.slice() }; }
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

/* 2♣–2♦–2NT is treated like a 2NT opening (systems on): drop the 2♣ and 2♦ round and bid as over 2NT */
// a strong artificial 2♣ (not the natural 2♣ of Precision or Polish Club)
const strong2 = o => !!(o && o.m && (o.m.tag === '2c' || o.m.cv === 'strong2c'));
function virt2N(x) {
  const o = x.opening, a = x.auc; if (!o || o.call !== B(2, 0) || sideOf(o.seat) !== sideOf(x.seat) || !strong2(o)) return null;
  const i = a.indexOf(o);
  if (a.length <= i + 4 || a[i + 1].call !== 'P' || a[i + 2].call !== B(2, 1) || a[i + 3].call !== 'P') return null;
  if (!ourOnly(x)) return null;
  const cfg = { conv: x.C, agg: x.agg };
  if (a[i + 4].call === B(2, 4)) return ctxOf(a.slice(0, i).concat(a.slice(i + 4)), x.seat, [cfg, cfg]);
  // Kokish: 2♣–2♦–2♥–2♠–2NT is the 22-24 balanced hand, bid as over a 2NT opening too
  if (a.length > i + 8 && a[i + 4].call === B(2, 2) && a[i + 4].m && a[i + 4].m.tag === 'kok' && a[i + 6].call === B(2, 3) && a[i + 8].call === B(2, 4) && a[i + 5].call === 'P' && a[i + 7].call === 'P')
    return ctxOf(a.slice(0, i).concat(a.slice(i + 8)), x.seat, [cfg, cfg]);
  return null;
}

function cands(x) {
  const v = virt2N(x); if (v) return cands(v);
  const L = []; const add = (call, test, m) => L.push({ call, test, m: m || {} });
  const { auc, p, my, pa, opening, st, C } = x;
  const pLast = pa.length ? pa[pa.length - 1] : null, myLast = my.length ? my[my.length - 1] : null;
  const pm = (pLast && pLast.m) || {}, mm = (myLast && myLast.m) || {};
  const pJust = pLast && pLast === auc[auc.length - 2];  // partner's call came right before RHO's
  const rhoPass = x.rhoCall === 'P';

  /* ===== slam conventions and relays (highest priority) ===== */
  if (pLast && pm.tag === 'stop' && pJust) { add('P', () => true, { t: 'Accepting partner\'s sign-off' }); return L; }

  if (pJust && pm.tag === 'bw') {
    // the answers are the four steps above the ask (4NT: 5♣-5♠; Minorwood 4♦: 4♥, 4♠, 4NT, 5♣; Voidwood 5♣: 5♦-5NT);
    // Voidwood leaves out the ace of the void suit (four key cards)
    const t = pm.trump, b0 = pLast.call, stp = k => b0 + k, vd = pm.void;
    const kc = h => h.kc(t) - (vd != null && h.has(vd, 12) ? 1 : 0);
    const nm = pm.cv === 'minorwood' ? 'Minorwood' : pm.cv === 'voidwood' ? 'Voidwood' : 'RKCB', cv = pm.cv;
    if (pm.rkc === 2) {
      // 0314: the two lowest answers the other way round
      add(stp(1), h => kc(h) === 0 || kc(h) === 3, { tag: 'bwr', kc: 0, cv, t: nm + ' reply: 0 or 3 key cards' });
      add(stp(2), h => kc(h) === 1 || kc(h) === 4, { tag: 'bwr', kc: 1, cv, t: nm + ' reply: 1 or 4 key cards' });
      add(stp(3), h => kc(h) === 2 && !h.has(t, 10), { tag: 'bwr', kc: 2, cv, t: nm + ' reply: 2 key cards, no trump queen' });
      add(stp(4), h => kc(h) === 2 || kc(h) === 5, { tag: 'bwr', kc: 2, q: 1, cv, t: nm + ' reply: 2 key cards + trump queen' });
    } else if (pm.rkc) {
      add(stp(1), h => kc(h) === 1 || kc(h) === 4, { tag: 'bwr', kc: 1, cv, t: nm + ' reply: 1 or 4 key cards' });
      add(stp(2), h => kc(h) === 0 || kc(h) === 3, { tag: 'bwr', kc: 0, cv, t: nm + ' reply: 0 or 3 key cards' });
      add(stp(3), h => kc(h) === 2 && !h.has(t, 10), { tag: 'bwr', kc: 2, cv, t: nm + ' reply: 2 key cards, no trump queen' });
      add(stp(4), h => kc(h) === 2 || kc(h) === 5, { tag: 'bwr', kc: 2, q: 1, cv, t: nm + ' reply: 2 key cards + trump queen' });
    } else {
      [B(5, 0), B(5, 1), B(5, 2), B(5, 3)].forEach((c, k) => add(c, h => k === 0 ? (h.aces === 0 || h.aces === 4) : h.aces === k, { tag: 'bwr', kc: k, cv: 'bw', t: 'Blackwood reply: ' + (k === 0 ? '0 or 4' : k) + ' ace' + (k === 1 ? '' : 's') }));
    }
    return L;
  }
  // I answered partner's key-card ask and partner has now named the contract (not 5NT, the king ask): partner is the
  // captain, so pass (1♦–1♥–3♦–4NT–5♣–6♥: not 6NT)
  if (pJust && myLast && mm.tag === 'bwr' && isNum(pLast.call) && pLast.call !== B(5, 4)) { add('P', () => true, { t: 'Partner, who asked for key cards, has chosen the contract' }); return L; }
  if (myLast && mm.tag === 'bw' && pLast && pm.tag === 'bwr') {
    const t = mm.trump, P = pInfo(x), vd = mm.void, total = vd != null ? 4 : mm.rkc ? 5 : 4;
    const count = h => {
      const mine = mm.rkc ? h.kc(t) - (vd != null && h.has(vd, 12) ? 1 : 0) : h.aces; let k = pm.kc;
      const alt = k === 0 ? (mm.rkc ? 3 : 4) : k === 1 && mm.rkc ? 4 : k === 2 && mm.rkc ? 5 : k;
      // the higher reading whenever it fits (the asker has room for it): measured double dummy, this finds far more of the
      // slams than it loses by going one too high (+1300 IMP in 60000 deals); 1♣–1♥–1♠–4♥–4NT–5♦ with three key cards: 7♥
      if (alt !== k && mine + alt <= total) k = alt;
      return mine + k;
    };
    const est = h => h.sup(t) + P.min + 2;
    // (a grand slam also with a trump fit, every key card and the queen and 31+ HCP between us: partner's minimum is often
    // more than the auction showed — 1♣–2♥–3♣–4NT–5♥ with ♥AKQJ972 opposite ♣A86532 ♦AKQ4: 7♥)
    // a grand slam: every key card, the trump queen known (RKCB) and the points for thirteen tricks (33+ HCP together);
    // without them the small slam (1♦–1♥–3♦–4NT–5♥ with ♦A7 and the queen missing: 6♦, not 7♦)
    const queen = h => !mm.rkc || t >= 4 || h.has(t, 10) || !!pm.q;
    // a grand slam needs a trump suit worth the name: eight cards together, or a solid seven of my own (♥AKQJ87 opposite
    // a void: not 7♥); a small slam a six-card suit at least, else it is played in notrump
    const fitOK = h => t >= 4 || h.len[t] + P.len[t] >= 8 || (h.len[t] >= 7 && h.top5(t) >= 4), fit6 = h => t >= 4 || h.len[t] + P.len[t] >= 8 || h.len[t] >= 6;
    add(B(7, t), h => count(h) === total && queen(h) && fitOK(h) && ((est(h) >= 36 && h.hcp + P.min >= 33) || (t < 4 && h.len[t] + P.len[t] >= 8 && est(h) >= 34 && h.hcp + P.min >= 31)), { t: 'Grand slam: we hold every key card' });
    if (t < 4) add(B(6, 4), h => count(h) >= total - 1 && !fit6(h), { t: 'Small slam in notrump: no trump fit' });
    // a key card and the trump queen both missing (the queen shown missing by the answer, or not shown and only an
    // eight-card fit): two losers, so five (1♥–2♦–2♥–4NT–5♥ with ♥A9843 and one ace out: 5♥)
    // (only when the answer itself denied the queen and the fit is eight cards: with nine the queen often drops, and
    // an answer that said nothing about it is no reason to stop — 1♦–1♥–2♥–4NT–5♣–6♥ made, 5♥ lost 13 IMP)
    const qOut = h => t < 4 && mm.rkc && !h.has(t, 10) && pm.kc === 2 && !pm.q && h.len[t] + P.len[t] <= 8;
    add(B(6, t), h => count(h) >= total - 1 && !(count(h) === total - 1 && qOut(h)), { t: 'Small slam: at most one key card missing' });
    add('P', () => pLast.call === B(5, t), { t: 'Two key cards missing: stop at the five level' });
    add(B(5, t), () => true, { t: 'Two key cards missing: sign off at the five level', tag: 'stop' });
    if (!mm.cv || !['minorwood', 'voidwood'].includes(mm.cv)) add(B(5, 4), () => true, { t: 'Two key cards missing: to play', tag: 'stop' });
    add(B(6, t), () => true, { t: 'Small slam (no lower sign-off left)', tag: 'stop' });
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
    if (os < 4 && (mm.um || []).length) add(B(3, os), h => h.hcp >= 10 && mm.um.some(s => h.len[s] === 4), { min: 10, len: Object.fromEntries(mm.um.map(s => [s, 4])), tag: 'lebcue', cv: 'leb', t: 'Lebensohl slow cue bid: Stayman with a ' + SUIT[os] + ' stopper', f: 1, gf: 1 });
    add(B(3, 4), h => h.hcp >= 10, { min: 10, cv: 'leb', t: 'Lebensohl slow show: game values with a ' + SUIT[os] + ' stopper' });
    add('P', h => h.longest === 0, { t: 'To play in clubs' });
    for (const s of [1, 2, 3]) if (s !== os) add(B(3, s), h => h.longest === s, { len: { [s]: 5 }, t: 'To play in ' + SUIT[s] + ' (sign-off)' });
    add('P', () => true, { t: 'Pass' });
    return L;
  }
  if (pJust && rhoPass && myLast && mm.tag === 'muider' && (pm.tag === 'muask' || pm.tag === 'mupc')) {
    if (pm.tag === 'muask') { add(B(3, 0), h => h.len[0] >= 4 && h.len[0] >= h.len[1], { len: { 0: 4 }, tag: 'muans', cv: 'muider', t: 'Muiderberg: my minor is clubs' }); add(B(3, 1), () => true, { len: { 1: 4 }, tag: 'muans', cv: 'muider', t: 'Muiderberg: my minor is diamonds' }); }
    else { add('P', h => h.len[0] >= 4, { len: { 0: 4 }, cv: 'muider', t: 'Muiderberg: my minor is clubs' }); add(B(3, 1), () => true, { len: { 1: 4 }, tag: 'stop', cv: 'muider', t: 'Muiderberg: my minor is diamonds' }); }
    return L;
  }
  // Muiderberg: after the opener named the minor, the asker places the contract
  if (pJust && rhoPass && myLast && mm.tag === 'muask' && pm.tag === 'muans') {
    const M = ST(x.opening.call), m = ST(pLast.call);
    add(B(4, M), h => h.len[M] >= 3, { tag: 'stop', cv: 'muider', t: 'Game in the major: a fit' });
    add(B(5, m), h => h.len[m] >= 4 && h.hcp >= 17 && !(h.bal && h.hcp <= 19), { tag: 'stop', cv: 'muider', t: 'Game in the minor: a fit' });
    add(B(3, 4), h => h.hcp >= 15, { tag: 'stop', cv: 'muider', t: 'Game in notrump' });
    add('P', () => true, { cv: 'muider', t: 'To play in the minor' });
    return L;
  }
  // Multi 2♦: the opener shows the major
  if (pJust && rhoPass && myLast && mm.tag === 'multi' && pm.tag === 'mpoc2') { add('P', h => h.len[3] >= 6, { len: { 3: 6 }, cv: 'multi', t: 'Multi: my suit is spades' }); add(B(3, 2), () => true, { len: { 2: 6 }, tag: 'stop', cv: 'multi', t: 'Multi: my suit is hearts' }); return L; }
  if (pJust && rhoPass && myLast && mm.tag === 'multi' && (pm.tag === 'mpoc' || pm.tag === 'mask')) {
    if (pm.tag === 'mpoc') { add('P', h => h.len[2] >= 6, { len: { 2: 6 }, cv: 'sys', t: 'Multi: my suit is hearts' }); add(B(2, 3), () => true, { len: { 3: 6 }, cv: 'sys', t: 'Multi: my suit is spades' }); }
    else { add(B(3, 2), h => h.len[2] >= 6, { len: { 2: 6 }, cv: 'sys', t: 'Multi: hearts' }); add(B(3, 3), () => true, { len: { 3: 6 }, cv: 'sys', t: 'Multi: spades' }); }
    return L;
  }
  if (pJust && rhoPass && pm.tag === 'lebcue') {
    for (const s of [2, 3]) if (pm.len && pm.len[s]) add(B(3, s) > pLast.call ? B(3, s) : B(4, s), h => h.len[s] >= 4, { len: { [s]: 4 }, cv: 'leb', t: 'Reply to Lebensohl Stayman: four ' + SUIT[s] });
    add(B(3, 4), () => true, { cv: 'leb', t: 'Reply to Lebensohl Stayman: no four-card major' });
    return L;
  }
  // a minor transfer is completed even if the next opponent doubles it (their double of the artificial bid must not be left in)
  if (pJust && (rhoPass || x.rhoCall === 'X') && pm.tag === 'trm') { add(pm.to, () => true, { tag: 'trc', cv: pm.cv, t: 'Completing the transfer' }); return L; }
  // Texas is completed even if the next opponent doubles it
  if (pJust && (rhoPass || x.rhoCall === 'X') && pm.tag === 'texas') { add(pm.to, () => true, { tag: 'trc', cv: pm.cv, t: 'Completing the Texas transfer' }); return L; }
  // preference: I passed partner's opening, partner has now shown a second, lower suit at the two level in competition
  // (1♥–P–P–1NT–2♦–P): with as many cards in the first suit, back to it — it is the longer one (♠Q53 ♥987 ♦T76 ♣K542: 2♥)
  if (pJust && rhoPass && opening && opening.seat === p && !my.length && auc.some(e => e.seat === x.seat) && isNum(opening.call) && isNum(pLast.call) && pLast !== opening) {
    const s1 = ST(opening.call), s2 = ST(pLast.call), om = opening.m || {};
    if (LV(opening.call) === 1 && s1 < 4 && s2 < s1 && LV(pLast.call) === 2 && ((om.len || {})[s1] || 0) >= 4 && ((pm.len || {})[s2] || 0) >= 4)
      add(B(2, s1), h => h.len[s1] >= 2 && h.len[s1] >= h.len[s2], { len: { [s1]: 2 }, t: 'Preference: back to partner\'s first suit, the longer one' });
  }
  if (pLast && pm.tag === 'wjs' && pJust) { add('P', () => true, { t: 'Passing partner\'s weak suit' }); return L; }
  /* Gambling 3NT: pass or correct */
  if (pJust && pm.tag === 'poc') { add(B(4, 1), h => h.len[1] >= 7, { t: 'My long suit is diamonds' }); add('P', () => true, { t: 'My long suit is clubs' }); return L; }
  /* Ogust reply by the weak-two opener */
  // the asker after the Ogust answer: never passes the artificial reply — game opposite a maximum (or a minimum and a
  // big hand with a fit), 3NT opposite a solid suit or without a fit but with stoppers, else three of partner's suit
  if (pJust && rhoPass && myLast && mm.tag === 'ogust' && pm.cv === 'ogust') {
    // (a hand with slam chances, 19+, goes on as usual: key cards, slam)
    const s = ST(opening.call), mx = pLast.call === B(3, 2) || pLast.call === B(3, 3), solid = pLast.call === B(3, 4), G = s < 2 ? 5 : 4, sm = h => h.hcp <= 18;
    const stops = h => [0, 1, 2, 3].filter(u => u !== s).every(u => h.stop(u));
    if (solid) { add('P', h => sm(h) && stops(h), { t: 'Pass: 3NT with the solid suit' }); add(B(G, s), sm, { t: 'Game in partner\'s suit' }); return L; }
    add(B(3, 4), h => sm(h) && (s < 2 || h.len[s] <= 1) && h.hcp >= (mx ? 15 : 17) && stops(h), { t: '3NT' });
    add(B(G, s), h => sm(h) && h.len[s] >= 2 && (mx ? h.hcp >= 15 : h.hcp >= 17), { t: 'Game in partner\'s suit' });
    add(B(3, s), h => sm(h) && B(3, s) > pLast.call, { t: 'Partscore in partner\'s suit' });
    add(B(4, s), h => sm(h) && s >= 2, { t: 'Partner\'s suit' });
    if (L.length) return L;
  }
  if (pJust && rhoPass && pm.tag === 'ogust' && myLast && mm.tag === 'weak') {
    const s = ST(myLast.call), good = h => h.has(s, 12) + h.has(s, 11) + h.has(s, 10) >= 2;
    add(B(3, 4), h => h.has(s, 12) && h.has(s, 11) && h.has(s, 10), { cv: 'ogust', t: 'Ogust: solid suit (AKQ)' });
    add(B(3, 3), h => h.hcp >= 8 && good(h), { min: 8, max: 10, cv: 'ogust', t: 'Ogust: maximum, good suit' });
    add(B(3, 2), h => h.hcp >= 8, { min: 8, max: 10, cv: 'ogust', t: 'Ogust: maximum, bad suit' });
    add(B(3, 1), h => good(h), { min: 5, max: 7, cv: 'ogust', t: 'Ogust: minimum, good suit' });
    add(B(3, 0), () => true, { min: 5, max: 7, cv: 'ogust', t: 'Ogust: minimum, bad suit' });
    return L;
  }
  /* ---- partner's conventional overcall (Cappelletti, DONT, Michaels, Unusual 2NT) and the next opponent bid over it:
     no longer forced to choose; one of partner's suits only with a fit, else pass (1NT–2♦–4♦: not 4♥ with ♥2) ---- */
  if (my.length === 0 && pJust && isNum(x.rhoCall) && ['capp', 'dont', 'michaels', 'landy', 'ghestem'].includes(pm.cv) && pm.tag && !['cappX', 'dontX', 'landyQ'].includes(pm.tag)) {
    const cheap = s => (ST(st.last) < s ? LV(st.last) : LV(st.last) + 1);
    const ps = Object.keys(pm.len || {}).map(Number).filter(s => s < 4).sort((a, b) => b - a);
    for (const s of ps) { const l = cheap(s); if (l <= 4) add(B(l, s), h => h.len[s] >= 4 && (l <= 3 || h.len[s] >= 5 || Math.min(...h.len) <= 1), { len: { [s]: 4 }, t: 'Competing in partner\'s ' + SUIT[s] + ': a fit' }); }
    add('P', () => true, { t: 'Pass: no fit for partner' });
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

  /* ---- Landy follow-ups: partner's 2♣ showed both majors ---- */
  if (my.length === 0 && pJust && rhoPass && pm.tag === 'landy') {
    add(B(4, 3), h => h.len[3] >= 4 && h.len[3] >= h.len[2] && h.sup(3) >= 13, { tag: 'stop', cv: 'landy', t: 'Game in spades' });
    add(B(4, 2), h => h.len[2] >= 4 && h.sup(2) >= 13, { tag: 'stop', cv: 'landy', t: 'Game in hearts' });
    add(B(2, 4), h => h.hcp >= 12, { min: 12, tag: 'landyQ', cv: 'landy', f: 1, t: 'Landy 2NT: asking for strength and shape (forcing)' });
    add(B(3, 3), h => h.len[3] >= 4 && h.len[3] >= h.len[2] && h.sup(3) >= 10, { min: 10, max: 12, len: { 3: 4 }, cv: 'landy', t: 'Invitation in spades (10-12)' });
    add(B(3, 2), h => h.len[2] >= 4 && h.sup(2) >= 10, { min: 10, max: 12, len: { 2: 4 }, cv: 'landy', t: 'Invitation in hearts (10-12)' });
    add('P', h => h.len[0] >= 6 && Math.max(h.len[2], h.len[3]) <= 2, { len: { 0: 6 }, cv: 'landy', t: 'Pass: long clubs, no major' });
    add(B(2, 1), h => h.len[2] === h.len[3], { tag: 'landyA', cv: 'landy', t: 'Landy 2♦: which major is longer?' });
    add(B(2, 3), h => h.len[3] > h.len[2], { tag: 'stop', cv: 'landy', t: 'Spades, to play' });
    add(B(2, 2), () => true, { tag: 'stop', cv: 'landy', t: 'Hearts, to play' });
    return L;
  }
  if (myLast && mm.tag === 'landy' && pJust && rhoPass && (pm.tag === 'landyA' || pm.tag === 'landyQ')) {
    if (pm.tag === 'landyA') {
      add(B(2, 3), h => h.len[3] > h.len[2], { len: { 3: 5 }, tag: 'stop', cv: 'landy', t: 'My longer major: spades' });
      add(B(2, 2), () => true, { len: { 2: 5 }, tag: 'stop', cv: 'landy', t: 'My longer major (or equal): hearts' });
    } else {
      add(B(3, 3), h => h.len[2] >= 5 && h.len[3] >= 5 && h.hcp >= 12, { len: { 2: 5, 3: 5 }, min: 12, cv: 'landy', t: 'Landy: 5-5, maximum' });
      add(B(3, 2), h => h.len[2] >= 5 && h.len[3] >= 5, { len: { 2: 5, 3: 5 }, max: 11, cv: 'landy', t: 'Landy: 5-5, minimum' });
      add(B(3, 1), h => h.hcp >= 12, { min: 12, cv: 'landy', t: 'Landy: 5-4, maximum (12+)' });
      add(B(3, 0), () => true, { max: 11, cv: 'landy', t: 'Landy: 5-4, minimum (8-11)' });
    }
    return L;
  }
  if (my.length === 1 && mm.tag === 'landyQ' && pJust && rhoPass && pa.length === 2 && pa[0].m && pa[0].m.tag === 'landy') {
    const P = pInfo(x), mx = pLast.call === B(3, 1) || pLast.call === B(3, 3), M = h => h.len[3] >= h.len[2] ? 3 : 2;
    for (const s of [3, 2]) add(B(4, s), h => M(h) === s && h.len[s] >= 3 && (mx || h.hcp >= 14), { tag: 'stop', t: 'Game in ' + SUIT[s] });
    add(B(3, 4), h => h.hcp >= 14 && h.stop(0) && h.stop(1), { tag: 'stop', t: '3NT' });
    for (const s of [3, 2]) add(B(3, s), h => M(h) === s && B(3, s) > pLast.call, { tag: 'stop', t: 'Partscore in ' + SUIT[s] });
    for (const s of [3, 2]) add(B(4, s), h => M(h) === s, { tag: 'stop', t: 'Game in ' + SUIT[s] });
    void P; return L;
  }
  /* ---- Cappelletti / Michaels follow-ups ---- */
  if (my.length === 0 && pJust && pm.cv === 'capp' && pm.tag && pm.tag !== 'cappX') {
    const cheap = s => (ST(st.last) < s ? LV(st.last) : LV(st.last) + 1);
    if (pm.tag === 'capp1') {
      for (const s of [3, 2, 0]) add(B(cheap(s), s), h => h.len[s] >= 6 && h.hcp >= 6, { len: { [s]: 6 }, t: 'My own long suit: ' + SUIT[s] });
      add(B(2, 1), () => rhoPass, { tag: 'relay', cv: 'capp', t: 'Cappelletti relay: name your suit' });
    }
    if (pm.tag === 'cappM') {
      add(B(4, 3), h => h.len[3] >= 4 && h.len[3] >= h.len[2] && h.sup(3) >= 13, { t: 'Game with a spade fit' });
      add(B(4, 2), h => h.len[2] >= 4 && h.sup(2) >= 13, { t: 'Game with a heart fit' });
      add(B(3, 3), h => h.len[3] >= 4 && h.len[3] >= h.len[2] && h.sup(3) >= 10, { min: 10, max: 12, len: { 3: 4 }, t: 'Jump in ♠: invitational, 10-12' });
      add(B(3, 2), h => h.len[2] >= 4 && h.sup(2) >= 10, { min: 10, max: 12, len: { 2: 4 }, t: 'Jump in ♥: invitational, 10-12' });
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
  if (my.length === 0 && pLast && pm.tag === 'gh' && pJust) {
    const cheap = s => (ST(st.last) < s ? LV(st.last) : LV(st.last) + 1), [a, b] = pm.suits;
    for (const s of [b, a]) if (s >= 2) add(B(4, s), h => h.len[s] >= 3 && h.len[s] >= h.len[s === a ? b : a] && h.hcp >= 10 && cheap(s) <= 4, { tag: 'stop', cv: 'ghestem', t: 'Game with a ' + SUIT[s] + ' fit' });
    for (const s of [b, a]) if (s < 2) add(B(5, s), h => h.len[s] >= 4 && h.hcp >= 12 && cheap(s) <= 5, { tag: 'stop', cv: 'ghestem', t: 'Game with a ' + SUIT[s] + ' fit' });
    add(B(cheap(b), b), h => h.len[b] > h.len[a] || (h.len[b] === h.len[a] && b >= 2), { len: { [b]: 3 }, cv: 'ghestem', t: 'Choosing ' + SUIT[b] });
    add(B(cheap(a), a), () => true, { len: { [a]: 3 }, cv: 'ghestem', t: 'Choosing ' + SUIT[a] });
    add('P', () => true, { t: 'Pass' });
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

  /* ===== opening (by the side's system) ===== */
  if (!opening) {
    const pos = auc.length, ag = x.agg > 0 ? 1 : 0, Y = x.sys, sk = Y.k;
    const [n1, n2] = Y.nt, [t1, t2] = Y.nt2, Z = Y.n;
    const can = h => { const ls = [...h.len].sort((a, b) => b - a); if (pos === 3) return h.hcp >= 13 - ag || (h.hcp >= 10 && h.hcp + h.len[3] >= 15); return h.hcp >= 12 - ag || (h.hcp >= 10 && h.hcp + ls[0] + ls[1] >= 20); };
    const ntBal = (lo, hi) => h => h.bal && h.hcp >= lo && h.hcp <= hi;
    const weakTwo = s => h => h.len[s] === 6 && h.hcp >= 5 && h.hcp <= 10 && h.top5(s) >= 2;
    // Gambling 3NT: asked before the one-level openings (a solid seven-card minor with 10-12 used to open 1♣/1♦ first)
    let gambDone = false;
    const gambling = () => { if (gambDone || pos >= 3 || !C.gamb) return; gambDone = true; add(B(3, 4), h => [0, 1].some(s => h.len[s] >= 7 && h.has(s, 12) && h.has(s, 11) && h.has(s, 10)) && [0, 1, 2, 3].every(s => h.len[s] >= 7 || (!h.has(s, 12) && !h.has(s, 11))), { min: 9, max: 13, tag: 'gamb', cv: 'gamb', t: 'Gambling 3NT: solid 7+ card minor, nothing outside' }); };
    const preempts = () => {
      if (pos >= 3) return;
      gambling();
      for (const s of [3, 2]) add(B(4, s), h => h.len[s] >= 8 && h.hcp >= 5 && h.hcp <= 11, { min: 5, max: 11, len: { [s]: 8 }, cv: 'pre', t: 'Preempt: 8+ ' + SUIT[s] + ', 5-11 HCP', tag: 'pre' });
    };
    const threes = () => { if (pos < 3) for (const s of [3, 2, 1, 0]) add(B(3, s), h => h.len[s] >= 7 && h.hcp >= 5 && h.hcp <= 10 && h.top5(s) >= 2, { min: 5, max: 10, len: { [s]: 7 }, cv: 'pre', t: 'Preempt: 7+ ' + SUIT[s] + ', 5-10 HCP', tag: 'pre' }); };
    // Muiderberg: 2♥/2♠ = five of the major and four or more of a minor, 5-10 (in place of the weak two in the majors)
    const muider = h => s => h.len[s] === 5 && Math.max(h.len[0], h.len[1]) >= 4 && h.hcp >= 5 && h.hcp <= 10 && h.top5(s) >= 1;
    // Multi 2♦ (weak): a weak two in either major, six cards, 5-11 (the natural systems whose 2♦ is free)
    const multiOn = C.multi && !C.flannery && !['sef', 'precision', 'polish'].includes(sk);
    // Flannery 2♦: five hearts and four spades, 11-15 (the natural systems whose 2♦ is free); no weak 2♦ then
    const flanOn = C.flannery && !['sef', 'precision', 'polish'].includes(sk);
    const weakTwo6 = s => h => h.len[s] === 6 && h.hcp >= 5 && h.hcp <= 10 && h.top5(s) >= 2 && h.len[otherMajor(s)] < 4;
    const weakTwos = suits => {
      if (pos >= 3) return;
      if (multiOn) add(B(2, 1), h => weakTwo6(2)(h) || weakTwo6(3)(h), { min: 5, max: 10, tag: 'multi', cv: 'multi', t: 'Multi 2♦: a weak two (six cards) in ♥ or ♠, 5-10 HCP' });
      if (C.muider) for (const s of [3, 2]) add(B(2, s), h => muider(h)(s), { min: 5, max: 10, len: { [s]: 5 }, tag: 'muider', cv: 'muider', t: 'Muiderberg: five ' + SUIT[s] + ' and a 4+ card minor, 5-10 HCP' });
      suits = suits.filter(s => !(s === 1 && (multiOn || flanOn)) && !(s >= 2 && (C.muider || multiOn)));
      _weakTwos(suits);
    };
    const _weakTwos = suits => { if (pos < 3) for (const s of suits) add(B(2, s), weakTwo(s), { min: 5, max: 10, len: { [s]: 6 }, cv: 'weak2', t: 'Weak two: six ' + SUIT[s] + ', 5-10 HCP', tag: 'weak' }); };
    const nts = () => {
      add(B(2, 4), ntBal(t1, t2), { min: t1, max: t2, len: BAL, t: 'Balanced, ' + t1 + '-' + t2 + ' HCP', tag: 'nt2' });
      add(B(1, 4), ntBal(n1, n2), { min: n1, max: n2, len: BAL, cv: 'nt1', t: 'Balanced, ' + n1 + '-' + n2 + ' HCP (' + Z + ')', tag: 'nt1' });
    };
    if (sk === 'precision') {
      // strong club: every 16+ hand opens 1♣ (except the 2NT range); the other openings show 11-15
      nts();
      add(B(1, 0), h => h.hcp >= 16, { min: 16, tag: 'sclub', cv: 'sys', f: 1, t: 'Precision 1♣: 16+ HCP, any shape (artificial, forcing)' });
      preempts();
      const lim = h => can(h) && h.hcp <= 15;
      add(B(1, 3), h => lim(h) && h.len[3] >= 5 && h.len[3] >= h.len[2], { min: 11, max: 15, len: { 3: 5 }, t: '5+ ♠, 11-15 HCP (Precision)' });
      add(B(1, 2), h => lim(h) && h.len[2] >= 5, { min: 11, max: 15, len: { 2: 5 }, t: '5+ ♥, 11-15 HCP (Precision)' });
      add(B(2, 0), h => lim(h) && (h.len[0] >= 6 || (h.len[0] >= 5 && Math.max(h.len[2], h.len[3]) === 4)), { min: 11, max: 15, len: { 0: 6 }, cv: 'sys', t: 'Precision 2♣: 6+ ♣ (or 5♣ and a 4-card major), 11-15 HCP' });
      add(B(2, 1), h => lim(h) && h.len[2] >= 4 && h.len[3] >= 4 && h.len[1] <= 1 && h.len[0] >= 4, { min: 11, max: 15, len: { 0: 4, 2: 4, 3: 4 }, cv: 'sys', t: 'Precision 2♦: three-suited, short in ♦ (4-4-1-4 or 4-4-0-5), 11-15 HCP' });
      weakTwos([3, 2]); threes();
      add(B(1, 1), h => lim(h), { min: 11, max: 15, len: { 1: 2 }, cv: 'sys', t: 'Precision 1♦: 11-15 HCP, 2+ ♦ (no 5-card major, not 1NT, not 2♣)' });
    } else if (sk === 'polish') {
      // Polish Club: 1♣ covers 12-14 balanced, 15+ with long clubs and every strong hand (18+)
      add(B(2, 4), ntBal(t1, t2), { min: t1, max: t2, len: BAL, t: 'Balanced, ' + t1 + '-' + t2 + ' HCP', tag: 'nt2' });
      add(B(1, 4), ntBal(n1, n2), { min: n1, max: n2, len: BAL, cv: 'nt1', t: 'Balanced, ' + n1 + '-' + n2 + ' HCP (' + Z + ')', tag: 'nt1' });
      add(B(1, 0), h => h.hcp >= 18 || (h.bal && h.hcp >= 12 && h.hcp <= 14), { min: 12, tag: 'pclub', cv: 'sys', f: 1, t: 'Polish 1♣: 12-14 balanced, or 15+ with long clubs, or 18+ any shape' });
      preempts();
      const lim = h => can(h) && h.hcp <= 17;
      add(B(1, 3), h => lim(h) && h.len[3] >= 5 && h.len[3] >= h.len[2], { min: 12, max: 17, len: { 3: 5 }, t: '5+ ♠, 12-17 HCP (Polish Club)' });
      add(B(1, 2), h => lim(h) && h.len[2] >= 5, { min: 12, max: 17, len: { 2: 5 }, t: '5+ ♥, 12-17 HCP (Polish Club)' });
      add(B(2, 0), h => lim(h) && h.hcp <= 15 && h.len[0] >= 6 && !h.bal, { min: 11, max: 15, len: { 0: 6 }, cv: 'sys', t: 'Polish 2♣: 6+ ♣, 11-15 HCP' });
      if (pos < 3) add(B(2, 1), h => weakTwo(2)(h) || weakTwo(3)(h), { min: 5, max: 10, tag: 'multi', cv: 'sys', t: 'Multi 2♦: a weak two (six cards) in ♥ or ♠, 5-10 HCP' });
      threes();
      add(B(1, 1), h => lim(h) && h.len[1] >= 4 && !h.bal, { min: 12, max: 17, len: { 1: 4 }, t: '4+ ♦, 12-17 HCP, unbalanced (Polish Club)' });
      add(B(1, 0), h => can(h), { min: 12, tag: 'pclub', cv: 'sys', f: 1, t: 'Polish 1♣: 12-14 balanced, or 15+ with long clubs, or 18+ any shape' });
    } else {
      // natural systems: SAYC, 2/1, Acol, French Standard
      if (sk === 'sef') {
        add(B(2, 1), h => h.hcp >= 23 || (h.hcp >= 20 && h.lp >= 4), { min: 23, tag: '2c', cv: 'sys', f: 1, gf: 1, t: 'SEF 2♦: artificial game force (23+ HCP or about nine tricks)' });
        add(B(2, 0), h => h.hcp >= 20 && !h.bal, { min: 20, max: 22, cv: 'strong2c', f: 1, t: 'SEF 2♣: strong (20-22, unbalanced), forcing for one round' });
      } else add(B(2, 0), h => h.hcp >= (sk === 'acol' ? 23 : 22) || (h.hcp >= 19 && h.lp >= 4), { min: sk === 'acol' ? 23 : 22, cv: 'strong2c', t: 'Strong and artificial: ' + (sk === 'acol' ? 23 : 22) + '+ HCP, game forcing', f: 1, gf: 1, tag: '2c' });
      gambling(); nts();
      if (flanOn) add(B(2, 1), h => h.len[2] === 5 && h.len[3] === 4 && h.hcp >= 11 && h.hcp <= 15 && can(h), { min: 11, max: 15, len: { 2: 5, 3: 4 }, tag: 'flan', cv: 'flannery', t: 'Flannery 2♦: five hearts and four spades, 11-15 HCP' });
      if (Y.maj5) {
        add(B(1, 3), h => can(h) && h.len[3] >= 5 && h.len[3] >= h.len[2], { min: 11, max: 21, len: { 3: 5 }, t: '5+ ♠, 12-21 HCP' });
        add(B(1, 2), h => can(h) && h.len[2] >= 5, { min: 11, max: 21, len: { 2: 5 }, t: '5+ ♥, 12-21 HCP' });
        add(B(1, 1), h => can(h) && (h.len[1] > h.len[0] || (h.len[1] === h.len[0] && h.len[1] >= 4)), { min: 11, max: 21, len: { 1: 3 }, t: '3+ ♦, 12-21 HCP' });
        add(B(1, 0), h => can(h), { min: 11, max: 21, len: { 0: 2 }, t: '3+ ♣, 12-21 HCP' });
      } else {
        // Acol: 4-card majors; open the longest suit (with 4-4 in the majors, 1♥; a 4-card major before a 4-card minor)
        const top = h => Math.max(...h.len);
        add(B(1, 3), h => can(h) && h.len[3] >= 4 && h.len[3] === top(h) && h.len[2] < h.len[3], { min: 11, max: 22, len: { 3: 4 }, t: '4+ ♠, 12-22 HCP (Acol: a 4-card major)' });
        add(B(1, 2), h => can(h) && h.len[2] >= 4 && h.len[2] === top(h), { min: 11, max: 22, len: { 2: 4 }, t: '4+ ♥, 12-22 HCP (Acol: a 4-card major)' });
        add(B(1, 3), h => can(h) && h.len[3] >= 4 && h.len[3] === top(h), { min: 11, max: 22, len: { 3: 4 }, t: '4+ ♠, 12-22 HCP (Acol: a 4-card major)' });
        add(B(1, 1), h => can(h) && h.len[1] >= h.len[0] && h.len[1] >= 4, { min: 11, max: 22, len: { 1: 4 }, t: '4+ ♦, 12-22 HCP (Acol)' });
        add(B(1, 0), h => can(h), { min: 11, max: 22, len: { 0: 3 }, t: '3+ ♣, 12-22 HCP (Acol)' });
      }
      preempts();
      weakTwos(sk === 'sef' ? [3, 2] : [3, 2, 1]);
      threes();
    }
    add('P', () => true, { max: 12, t: 'No opening values' });
    return L;
  }

  const oppOpened = sideOf(opening.seat) !== sideOf(x.seat);

  /* ===== overcall position: our side has not acted yet ===== */
  if (oppOpened && my.length === 0 && pa.length === 0) {
    const ob = st.last, os = ST(ob);
    const bal4 = auc.length >= 3 && auc[auc.length - 1].call === 'P' && auc[auc.length - 2].call === 'P';
    // balancing lowers the values needed only at a low level: over a game (1♠–3♦–3♠–4♠ passed round) 9 HCP pass
    const d = bal4 && LV(ob) <= 2 ? 3 : 0;
    const cheap = s => (ST(ob) < s ? LV(ob) : LV(ob) + 1);
    if (os === 4) {
      // Landy: 2♣ = both majors (5-4 or longer), 8+ (in place of Cappelletti's and DONT's 2♣); the rest stays natural
      if (C.landy && ob === B(1, 4) && x.oppBids.length === 1 && !bal4) {
        add(B(2, 0), h => h.len[2] >= 4 && h.len[3] >= 4 && Math.max(h.len[2], h.len[3]) >= 5 && h.hcp >= 8, { min: 8, len: { 2: 4, 3: 4 }, tag: 'landy', cv: 'landy', t: 'Landy 2♣: both majors (5-4 or longer), 8+ HCP' });
      }
      if (C.dont && !C.capp && !C.landy && ob === B(1, 4) && x.oppBids.length === 1 && !bal4) {
        add(B(2, 2), h => h.len[2] >= 4 && h.len[3] >= 4 && Math.max(h.len[2], h.len[3]) >= 5 && h.hcp >= 8, { min: 8, len: { 2: 4, 3: 4 }, tag: 'dontM', cv: 'dont', t: 'DONT: both majors' });
        add(B(2, 1), h => h.len[1] >= 5 && Math.max(h.len[2], h.len[3]) >= 4 && h.hcp >= 8, { min: 8, len: { 1: 5 }, tag: 'dont2', cv: 'dont', t: 'DONT: diamonds and a major' });
        add(B(2, 0), h => h.len[0] >= 5 && Math.max(h.len[1], h.len[2], h.len[3]) >= 4 && h.hcp >= 8, { min: 8, len: { 0: 5 }, tag: 'dont2', cv: 'dont', t: 'DONT: clubs and a higher suit' });
        add(B(2, 3), h => h.len[3] >= 6 && h.hcp >= 8, { min: 8, len: { 3: 6 }, cv: 'dont', t: 'DONT: long spades (natural)' });
        add('X', h => Math.max(h.len[0], h.len[1], h.len[2]) >= 6 && h.hcp >= 8, { min: 8, tag: 'dontX', cv: 'dont', t: 'DONT: a one-suiter (6+), not spades' });
        add('P', () => true, { t: 'Pass' });
        return L;
      }
      if (C.capp && !C.landy && ob === B(1, 4) && x.oppBids.length === 1 && !bal4) {
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
    // their last bid is artificial (Stayman, a transfer, a relay…): a double of it shows that suit, good, for the lead;
    // no takeout double (1NT–2♣ Stayman–X with ♣AT: pass)
    const oe = auc.slice().reverse().find(e => e.call === ob);
    const art = !!(oe && oe !== opening && os < 4 && oe.m && (oe.m.cv || oe.m.tag) && !(oe.m.len && oe.m.len[os] >= 3));
    if (art) add('X', h => h.len[os] >= 5 && h.top5(os) >= 3 && h.hcp >= 8, { min: 8, len: { [os]: 5 }, tag: 'ldx', t: 'Lead-directing double: a good ' + SUIT[os] + ' suit (their bid is artificial)' });
    // Ghestem: two-suiters (5-5) over their one-level suit opening: 2NT = the two lowest unbid suits, their suit = the two
    // highest, 3♣ (3♦ over 1♣) = the lowest and the highest (in place of Michaels and Unusual 2NT)
    if (C.ghestem && LV(ob) === 1 && x.oppBids.length === 1 && !bal4) {
      const [a, b, c] = unbid.slice().sort((p, q) => p - q);
      const gh = (call, pair, what) => add(call, h => h.len[pair[0]] >= 5 && h.len[pair[1]] >= 5 && h.hcp >= 8, { min: 8, len: { [pair[0]]: 5, [pair[1]]: 5 }, tag: 'gh', suits: pair, cv: 'ghestem', t: 'Ghestem ' + what + ': ' + SUIT[pair[0]] + ' and ' + SUIT[pair[1]] + ' (5-5)' });
      gh(B(2, os), [b, c], 'cue bid (the two highest)');
      gh(B(2, 4), [a, b], '2NT (the two lowest)');
      gh(B(3, os === 0 ? 1 : 0), [a, c], (os === 0 ? '3♦' : '3♣') + ' (the lowest and the highest)');
    }
    if (C.michaels && !C.ghestem && LV(ob) === 1 && x.oppBids.length === 1 && !bal4) {
      if (os < 2) add(B(2, os), h => h.len[2] >= 5 && h.len[3] >= 5 && h.hcp >= 7, { min: 7, len: { 2: 5, 3: 5 }, tag: 'mich', cv: 'michaels', t: 'Michaels cue bid: both majors (5-5)' });
      else { const M = otherMajor(os); add(B(2, os), h => h.len[M] >= 5 && Math.max(h.len[0], h.len[1]) >= 5 && h.hcp >= 7, { min: 7, len: { [M]: 5 }, tag: 'mich', major: M, cv: 'michaels', t: 'Michaels cue bid: 5+ ' + SUIT[M] + ' and a 5+ minor' }); }
      const lw = unbid.slice().sort((a, b) => a - b).slice(0, 2);
      add(B(2, 4), h => h.len[lw[0]] >= 5 && h.len[lw[1]] >= 5 && h.hcp >= 7, { min: 7, len: { [lw[0]]: 5, [lw[1]]: 5 }, tag: 'unusual', suits: lw, cv: 'michaels', t: 'Unusual 2NT: ' + SUIT[lw[0]] + ' and ' + SUIT[lw[1]] + ' (5-5)' });
    }
    if (LV(ob) === 1) add(B(1, 4), h => h.bal && h.hcp >= 15 - d && h.hcp <= 18 && h.stop(os), { min: 15 - d, max: 18, len: BAL, t: 'Balanced 15-18 HCP with a stopper in their suit', tag: 'nt1' });
    if (!art) add('X', h => h.hcp >= 17, { min: 17, cv: 'takeout', t: 'Strong hand: 17+ HCP' });
    for (const s of [3, 2, 1, 0]) {
      if (x.oppSuits.includes(s)) continue; const l = cheap(s);
      if (l + 1 <= 3) add(B(l + 1, s), h => !bal4 && h.len[s] >= 6 && h.hcp >= 5 && h.hcp <= 10 && h.top5(s) >= 2, { min: 5, max: 10, len: { [s]: 6 }, t: 'Weak jump overcall: 6+ ' + SUIT[s] + ', 5-10 HCP' });
    }
    for (const s of [3, 2, 1, 0]) {
      if (x.oppSuits.includes(s)) continue; const l = cheap(s);
      const mn = (l === 1 ? 8 : l === 2 ? 11 : 13) - d;
      add(B(l, s), h => h.len[s] >= (l === 3 ? 6 : 5) && h.hcp >= mn && h.hcp <= 16 && (l === 1 || h.top5(s) >= 2) && h.len[s] >= Math.max(...unbid.map(u => h.len[u])), { min: mn, max: 16, len: { [s]: 5 }, t: 'Overcall: 5+ ' + SUIT[s] + ', ' + mn + '-16 HCP' });
    }
    // over their weak two: 2NT with 15-18 balanced and a stopper; with 15+ and no stopper a takeout double, three of
    // their suit or not (2♥ with ♠AJ ♥J82 ♦AQ73 ♣AT65: X, not pass — partner has the spades)
    const weak2 = LV(ob) === 2 && os < 4 && x.oppBids.length === 1 && opening.m && opening.m.tag === 'weak';
    if (weak2) add(B(2, 4), h => h.bal && h.hcp >= 15 && h.hcp <= 18 && h.stop(os), { min: 15, max: 18, len: BAL, t: 'Balanced 15-18 HCP with a stopper in their suit' });
    if (weak2 && !art) add('X', h => h.hcp >= 15 && h.len[os] <= 3 && unbid.every(u => h.len[u] >= 2) && unbid.filter(u => h.len[u] >= 4).length >= 2, { min: 15, len: Object.fromEntries(unbid.map(u => [u, 3])), cv: 'takeout', t: 'Takeout double: 15+ HCP over a weak two' });
    if (!art) add('X', h => h.hcp >= 12 - d && h.len[os] <= 2 && unbid.every(u => h.len[u] >= 3 || (h.len[u] >= 2 && h.hcp >= 15)), { min: 12 - d, len: Object.fromEntries(unbid.map(u => [u, 3])), cv: 'takeout', t: 'Takeout double: 12+ HCP, support for the unbid suits' });
    add('P', () => true, { t: 'Pass' });
    return L;
  }

  /* ===== partner opened, my first action ===== */
  if (!oppOpened && opening.seat === p && my.length === 0) {
    const o = opening.call, os = ST(o), ol = LV(o);
    const fresh = opening === pLast && cleanAfter(auc, auc.indexOf(opening));
    const otag = opening.m && opening.m.tag;
    // strong club (Precision / Polish Club): 1♦ is negative (Polish: or waiting), other bids are natural positives
    if (o === B(1, 0) && (otag === 'sclub' || otag === 'pclub') && rhoPass && fresh) {
      const pol = otag === 'pclub', lo = pol ? 7 : 8, mj = pol ? 4 : 5;
      for (const s of [3, 2]) add(B(1, s), h => h.hcp >= lo && h.len[s] >= mj && h.len[s] >= h.len[otherMajor(s)], { min: lo, len: { [s]: mj }, cv: 'sys', f: 1, gf: pol ? 0 : 1, t: 'Positive: ' + mj + '+ ' + SUIT[s] + ', ' + lo + '+ HCP' + (pol ? '' : ', game forcing') });
      add(B(1, 4), h => h.bal && h.hcp >= 8 && h.hcp <= 13, { min: 8, max: 13, cv: 'sys', f: 1, t: 'Positive: balanced, 8-13 HCP' });
      for (const s of [0, 1]) add(B(2, s), h => h.hcp >= 8 && h.len[s] >= 5, { min: 8, len: { [s]: 5 }, cv: 'sys', f: 1, gf: pol ? 0 : 1, t: 'Positive: 5+ ' + SUIT[s] + ', 8+ HCP' });
      add(B(2, 4), h => h.bal && h.hcp >= 14, { min: 14, cv: 'sys', f: 1, gf: 1, t: 'Positive: balanced, 14+ HCP' });
      add(B(1, 1), () => true, { max: pol ? 11 : 7, tag: 'neg', cv: 'sys', f: 1, t: pol ? 'Polish 1♦: negative (0-7) or a waiting bid' : 'Precision 1♦: negative, 0-7 HCP (artificial)' });
      return L;
    }
    // Flannery 2♦ (5♥ + 4♠, 11-15): game in a fit, 2NT asks the shape, three of a major invites, 2♠ a mild invitation, 2♥ to play
    if (o === B(2, 1) && otag === 'flan' && rhoPass && fresh) {
      add(B(4, 3), h => h.len[3] >= 4 && h.sup(3) >= 13 && h.sup(3) < 18, { min: 12, len: { 3: 4 }, tag: 'stop', cv: 'flannery', t: 'Flannery: game in spades' });
      add(B(4, 2), h => h.len[2] >= 3 && h.sup(2) >= 13 && h.sup(2) < 18, { min: 12, len: { 2: 3 }, tag: 'stop', cv: 'flannery', t: 'Flannery: game in hearts' });
      add(B(2, 4), h => h.hcp >= 12, { min: 12, tag: 'flanask', cv: 'flannery', f: 1, gf: 1, t: 'Flannery 2NT: asking for opener\'s minor-suit shape (game forcing)' });
      add(B(3, 3), h => h.len[3] >= 4 && h.sup(3) >= 10, { min: 10, max: 12, len: { 3: 4 }, tag: 'flaninv', cv: 'flannery', t: 'Flannery: invitation in spades (10-11)' });
      add(B(3, 2), h => h.len[2] >= 3 && h.sup(2) >= 10, { min: 10, max: 12, len: { 2: 3 }, tag: 'flaninv', cv: 'flannery', t: 'Flannery: invitation in hearts (10-11)' });
      add(B(2, 3), h => h.len[3] >= 4 && h.len[3] > h.len[2] && h.hcp >= 6, { min: 6, max: 9, len: { 3: 4 }, tag: 'flan2s', cv: 'flannery', t: 'Flannery: 4+ spades, 6-9 (opener with 14-15 bids game)' });
      for (const s of [1, 0]) add(B(3, s), h => h.len[s] >= 6 && h.len[2] <= 1 && h.hcp <= 9, { max: 9, len: { [s]: 6 }, tag: 'stop', cv: 'flannery', t: 'Flannery: a long ' + SUIT[s] + ' suit, to play' });
      add('P', h => h.len[1] >= 5 && h.len[2] <= 1 && h.len[3] <= 2 && h.hcp <= 9, { max: 9, len: { 1: 5 }, cv: 'flannery', t: 'Pass: diamonds, no fit for the majors' });
      add(B(2, 3), h => h.len[3] > h.len[2] && h.len[3] >= 3, { max: 9, len: { 3: 3 }, tag: 'stop', cv: 'flannery', t: 'Flannery: spades, to play' });
      add(B(2, 2), () => true, { max: 9, tag: 'stop', cv: 'flannery', t: 'Flannery: hearts, to play (weak)' });
      return L;
    }
    // Multi 2♦ (Polish Club): 2♥ = pass or correct, 2NT asks which major
    // Muiderberg doubled and left in for penalty (2♠–P–P–X–P–P; not straight over a takeout double): no fit for the major, both minors — run to 3♣,
    // pass or correct, opener's 4+ card minor (2♠X with ♠T ♥K7653 ♦9764 ♣Q32 opposite ♠J9432 ♣AT876: three down)
    if ((o === B(2, 2) || o === B(2, 3)) && otag === 'muider' && opening === pLast) {
      const after = auc.slice(auc.indexOf(opening) + 1);
      if (x.rhoCall === 'P' && after.filter(e => e.call === 'X').length === 1 && after.every(e => e.call === 'P' || (e.call === 'X' && sideOf(e.seat) !== sideOf(x.seat)))) {
        add(B(3, 0), h => h.len[os] <= 1 && h.len[0] >= 3 && h.len[1] >= 3, { len: { 0: 3, 1: 3 }, tag: 'mupc', cv: 'muider', t: 'Out of the double: pass or correct, play your minor' });
      }
    }
    if ((o === B(2, 2) || o === B(2, 3)) && otag === 'muider' && rhoPass && fresh) {
      add(B(4, os), h => h.len[os] >= 3 && (h.hcp >= 14 || (h.len[os] >= 4 && h.hcp >= 10)), { min: 10, len: { [os]: 3 }, tag: 'stop', cv: 'muider', t: 'Game: support for the major' });
      add(B(2, 4), h => h.hcp >= 14, { min: 14, tag: 'muask', cv: 'muider', f: 1, t: 'Muiderberg 2NT: which minor? (14+ HCP, forcing)' });
      add(B(3, os), h => h.len[os] >= 3, { len: { [os]: 3 }, tag: 'stop', cv: 'muider', t: 'Preemptive raise: 3+ support, to play' });
      add(B(3, 0), h => h.len[os] <= 1 && h.len[0] >= 3 && h.len[1] >= 3 && h.hcp >= 6, { len: { 0: 3, 1: 3 }, tag: 'mupc', cv: 'muider', t: 'Pass or correct: no fit for the major, play your minor' });
      add('P', () => true, { t: 'Pass' });
      return L;
    }
    if (o === B(2, 1) && otag === 'multi' && opening.m.cv === 'multi' && rhoPass && fresh) {
      add(B(2, 4), h => h.hcp >= 15, { min: 15, tag: 'mask', cv: 'multi', f: 1, t: 'Asking: which major is it?' });
      for (const m of [0, 1]) add(B(3, m), h => h.len[m] >= 6 && h.len[2] <= 2 && h.len[3] <= 2, { len: { [m]: 6 }, tag: 'stop', cv: 'multi', t: 'Natural: to play in ' + SUIT[m] });
      add(B(2, 3), h => h.len[2] >= 3 && h.len[3] >= 2 && h.len[3] < h.len[2] && h.hcp >= 8, { tag: 'mpoc2', cv: 'multi', t: 'Pass or correct: pass with spades, 3♥ with hearts' });
      add(B(2, 2), () => true, { tag: 'mpoc', cv: 'multi', t: 'Pass or correct: pass with hearts, bid 2♠ with spades' });
      return L;
    }
    if (o === B(2, 1) && otag === 'multi' && rhoPass && fresh) {
      add(B(2, 4), h => h.hcp >= 15, { min: 15, tag: 'mask', cv: 'sys', f: 1, t: 'Asking: which major is it?' });
      add(B(2, 2), () => true, { tag: 'mpoc', cv: 'sys', t: 'Pass or correct: pass with hearts, bid 2♠ with spades' });
      return L;
    }
    // SEF 2♦ (artificial game force): 2♥ is the waiting reply
    if (o === B(2, 1) && otag === '2c' && x.sys.k === 'sef' && rhoPass && fresh) {
      for (const s of [3, 0, 1]) add(B(s === 3 ? 2 : 3, s), h => h.hcp >= 7 && h.len[s] >= 5 && h.top5(s) >= 2, { min: 7, len: { [s]: 5 }, cv: 'sys', t: 'Positive: 5+ ' + SUIT[s] + ', 7+ HCP' });
      add(B(2, 2), () => true, { cv: 'sys', tag: 'relay', t: 'Waiting reply (artificial)' });
      return L;
    }
    if ((o === B(1, 4) || o === B(2, 4)) && rhoPass && fresh) { ntResponses(x, add, ol, true); return L; }
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
      const um = [2, 3].filter(s => s !== obs);   // unbid major(s) for cue-bid Stayman
      const has4M = h => um.some(s => h.len[s] === 4);
      // a five-card major (or a good minor) game force comes first
      for (const s of [3, 2]) if (s !== obs) add(B(3, s), h => h.len[s] >= 5 && h.hcp >= 10, { min: 10, len: { [s]: 5 }, cv: 'leb', t: 'Lebensohl: direct three-level bid, 5+ ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
      // cue bid = Stayman without a stopper ("fast denies"); 2NT then cue = Stayman with a stopper
      if (um.length && obs < 4) add(B(3, obs), h => h.hcp >= 10 && has4M(h) && !h.stop(obs), { min: 10, len: Object.fromEntries(um.map(s => [s, 4])), tag: 'lebcue', cv: 'leb', t: 'Lebensohl cue bid: Stayman, no ' + SUIT[obs] + ' stopper (fast denies)', f: 1, gf: 1 });
      add(B(3, 4), h => h.hcp >= 10 && !h.stop(obs), { min: 10, cv: 'leb', t: 'Lebensohl fast 3NT: game values, no ' + SUIT[obs] + ' stopper' });
      for (const s of [1, 0]) if (s !== obs) add(B(3, s), h => h.len[s] >= 5 && h.hcp >= 10 && !h.stop(obs), { min: 10, len: { [s]: 5 }, cv: 'leb', t: 'Lebensohl: direct three-level bid, 5+ ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
      for (const s of [3, 2, 1, 0]) if (s !== obs && B(2, s) > ob) add(B(2, s), h => h.len[s] >= 5 && h.hcp <= 9, { max: 9, len: { [s]: 5 }, t: 'Competing: 5+ ' + SUIT[s] + ', to play' });
      add(B(2, 4), h => (h.hcp >= 10 && h.stop(obs)) || (h.hcp <= 8 && h.len[h.longest] >= 5 && h.longest !== obs && B(2, h.longest) < ob), { tag: 'leb', os: obs, um, cv: 'leb', t: 'Lebensohl 2NT: forces opener to bid 3♣ (weak sign-off, or slow: shows a stopper)', f: 1 });
      add('X', h => h.hcp >= 8, { min: 8, t: 'Double: 8+ HCP, penalty-oriented' });
      add('P', () => true, { t: 'Pass' });
      return L;
    }
    if (o === B(2, 0) && rhoPass && strong2(opening)) {
      for (const s of [3, 2]) add(B(2, s), h => h.hcp >= 8 && h.len[s] >= 5 && h.top5(s) >= 2, { min: 8, len: { [s]: 5 }, t: 'Positive: 5+ ' + SUIT[s] + ', 8+ HCP', gf: 1 });
      for (const s of [0, 1]) add(B(3, s), h => h.hcp >= 8 && h.len[s] >= 5 && h.top5(s) >= 2, { min: 8, len: { [s]: 5 }, t: 'Positive: 5+ ' + SUIT[s] + ', 8+ HCP', gf: 1 });
      add(B(2, 4), h => h.hcp >= 8 && h.bal, { min: 8, t: 'Positive: balanced, 8+ HCP', gf: 1 });
      add(B(2, 1), () => true, { max: 7, cv: 'strong2c', t: 'Waiting bid (artificial)', f: 1 });
      return L;
    }
    if (opening.m && opening.m.tag === 'gamb' && rhoPass) {
      add('P', h => [2, 3].every(s => h.stop(s)) && (h.stop(0) || h.stop(1)) && h.aces >= 1, { t: 'Pass: the other suits are stopped' });
      add(B(4, 0), () => true, { tag: 'poc', cv: 'gamb', t: 'Pass or correct: play in your minor' });
      return L;
    }
    if (opening.m && opening.m.tag === 'weak' && rhoPass && C.ogust && ol === 2) add(B(2, 4), h => h.hcp >= 15, { min: 15, tag: 'ogust', cv: 'ogust', t: 'Ogust 2NT: asking about strength and suit quality', f: 1 });
    if (opening.m && (opening.m.tag === 'weak' || opening.m.tag === 'pre') && rhoPass) {
      // slam values with support (19+ HCP, two aces): key cards first (2♦ weak – ? with ♠KJT62 ♥AK2 ♦A54 ♣AQ: 4NT, not 5♦)
      add(B(4, 4), h => h.len[os] >= 3 && h.hcp >= 19 && h.sup(os) >= 21 && h.aces >= 2, { min: 19, len: { [os]: 3 }, tag: 'bw', trump: os, rkc: C.rkc0314 ? 2 : C.rkc ? 1 : 0, cv: C.rkc0314 ? 'rkc0314' : C.rkc ? 'rkc' : 'bw', t: C.rkc0314 || C.rkc ? (C.rkc0314 ? 'RKCB 0314' : 'RKCB 1430') + ': asking for key cards (trumps ' + SUIT[os] + ')' : 'Blackwood: how many aces?', f: 1 });
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
    // answering partner's takeout double: only right after it (not an old double, other calls since, 1NT–2♣–X–…–3NT–4♥),
    // and not a lead-directing one
    if (pc.call === 'X' && rhoPass && pJust && !(pc.m && pc.m.tag === 'ldx') && os >= 0) {
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
      // no fit for partner: a five-card major comes before notrump, or a fit there is never found (1♥–2♣–P with ♠K10943 ♥Q73 ♦AJ98 ♣8: 2♠, not 2NT)
      for (const s of [3, 2]) { if (s === ps || x.oppSuits.includes(s)) continue; const l = cheap(s); if (l > 3) continue; add(B(l, s), h => h.len[s] >= 5 && h.hcp >= 8 && h.len[ps] <= 2, { min: 8, len: { [s]: 5 }, t: 'Natural: 5+ ' + SUIT[s] + ', 8+ HCP' }); }
      const nl = cheap(4);
      if (nl <= 2) add(B(nl, 4), h => h.stop(os) && h.hcp >= 8 && h.hcp <= 11, { min: 8, max: 11, t: '8-11 HCP with a stopper' });
      add(B(3, 4), h => h.stop(os) && h.hcp >= 15, { min: 15, t: 'Game: 15+ HCP with a stopper' });
      for (const s of [3, 2, 1, 0]) { if (s === ps || x.oppSuits.includes(s)) continue; const l = cheap(s); if (l > 3) continue; add(B(l, s), h => h.len[s] >= 5 && h.hcp >= 8 && h.len[ps] <= 2, { min: 8, len: { [s]: 5 }, t: 'Natural: 5+ ' + SUIT[s] + ', 8+ HCP' }); }
      add('P', h => h.hcp <= 11, { t: 'Pass' });
      return L;
    }
  }

  /* ===== 1NT overcaller: "systems on" — answer Stayman, complete transfers, judge invitations as after a 1NT opening ===== */
  if (oppOpened && my.length === 1 && my[0].call === B(1, 4) && pa.length === 1 && isNum(pa[0].call) && pJust && (rhoPass || x.rhoCall === "X")) {
    if (openerRebid(x, add, B(1, 4), pa[0])) return L;
  }

  /* ===== Kokish: responder relays 2♠; opener then shows 22-24 balanced (2NT) or the hearts ===== */
  if (!oppOpened && opening.call === B(2, 0) && strong2(opening) && opening.seat === p && my.length === 1 && pa.length === 2 && pJust && rhoPass && pm.tag === 'kok') {
    add(B(2, 3), () => true, { tag: 'kokr', cv: 'kokish', f: 1, t: 'Kokish: forced 2♠ relay' });
    return L;
  }
  if (!oppOpened && opening.call === B(2, 0) && opening.seat === x.seat && my.length === 2 && mm.tag === 'kok' && pJust && rhoPass && pm.tag === 'kokr') {
    add(B(2, 4), h => h.bal && h.hcp <= 24, { min: 22, max: 24, len: BAL, cv: 'kokish', t: 'Kokish: balanced 22-24 HCP' });
    for (const s of [3, 1, 0]) add(B(3, s), h => h.len[2] >= 5 && h.len[s] >= 4, { min: 22, len: { 2: 5, [s]: 4 }, cv: 'kokish', f: 1, gf: 1, t: 'Kokish: hearts and ' + SUIT[s] + ', game forcing' });
    add(B(3, 2), () => true, { min: 22, len: { 2: 6 }, cv: 'kokish', f: 1, gf: 1, t: 'Kokish: long hearts, game forcing' });
    return L;
  }
  // responder after opener showed the hearts: a heart fit raises (key cards with slam values), a fit for the second
  // suit, else 3NT
  if (!oppOpened && opening.call === B(2, 0) && opening.seat === p && my.length === 2 && mm.tag === 'kokr' && pJust && rhoPass && LV(pLast.call) === 3 && ST(pLast.call) < 4) {
    const s2 = ST(pLast.call), hf = h => h.len[2] >= (s2 === 2 ? 2 : 3);
    const ask = t => ({ tag: 'bw', trump: t, rkc: C.rkc0314 ? 2 : C.rkc ? 1 : 0, cv: C.rkc0314 ? 'rkc0314' : C.rkc ? 'rkc' : 'bw', t: 'Asking for key cards (trumps ' + SUIT[t] + ')' });
    // heart support with values: the cheapest step (3♠ over 3♥, 3♥ over a minor) so the strong hand can ask for key cards
    if (s2 === 2) add(B(3, 3), h => hf(h) && h.hcp >= 4, { min: 4, len: { 2: 2 }, f: 1, cv: 'kokish', t: 'Heart support with some values (slam try)' });
    if (s2 < 2) add(B(3, 2), h => hf(h) && h.hcp >= 4, { min: 4, len: { 2: 3 }, f: 1, cv: 'kokish', t: 'Heart support with some values (slam try)' });
    if (s2 === 3) add(B(4, 4), h => hf(h) && h.hcp >= 9 && h.aces >= 1, ask(2));
    add(B(4, 2), h => hf(h), { max: 3, len: { 2: 2 }, t: 'Game in hearts (weak)' });
    if (s2 === 3) add(B(4, 3), h => h.len[3] >= 4, { len: { 3: 4 }, t: 'Game in spades' });
    if (s2 < 2) add(B(5, s2), h => h.len[s2] >= 4 && !h.stop(s2 === 0 ? 1 : 0), { len: { [s2]: 4 }, t: 'Game in ' + SUIT[s2] });
    // no heart fit: my own five-card suit with some values (partner may have a fit for it), else notrump
    for (const t of [3, 1, 0]) { if (t === s2 || (t === 3 && s2 === 2)) continue; const l = B(3, t) > pLast.call ? 3 : 4; if (l === 4 && t >= 2) continue;
      add(B(l, t), h => h.len[t] >= 5 && h.hcp >= 4 && h.top5(t) >= 2 && !hf(h), { min: 4, len: { [t]: 5 }, f: 1, t: 'My own suit: 5+ ' + SUIT[t] }); }
    add(B(6, 4), h => h.hcp >= 11, { t: 'Slam in notrump' });
    add(B(3, 4), () => true, { t: 'No fit: 3NT' });
    return L;
  }
  /* ===== 2♣–2♦–(suit): responder's second call; 3♣ over a major is the second negative ===== */
  if (!oppOpened && opening.call === B(2, 0) && strong2(opening) && opening.seat === p && my.length === 1 && my[0].call === B(2, 1) && pa.length === 2 && pJust && rhoPass && ourOnly(x) && ST(pa[1].call) < 4) {
    const r = pa[1].call, s = ST(r);
    if (s >= 2) {
      add(B(4, s), h => h.len[s] >= 3 && h.hcp <= 4 && h.lp + h.hcp <= 5 && h.aces === 0, { max: 4, len: { [s]: 3 }, t: 'Support, but nothing else (fast arrival)' });
      add(B(3, s), h => h.len[s] >= 3, { min: 3, len: { [s]: 3 }, t: 'Support for ' + SUIT[s] + ': slam try', f: 1 });
      if (r === B(2, 2)) add(B(2, 3), h => h.len[3] >= 5 && h.hcp >= 4, { min: 4, len: { 3: 5 }, t: '5+ ♠, some values', f: 1 });
      add(B(3, 0), h => h.hcp <= 3, { max: 3, tag: '2neg', cv: 'strong2c', t: 'Second negative: 0-3 HCP' });
      for (const t of [1, 0]) add(B(3, t), h => h.len[t] >= 5 && h.hcp >= 4, { min: 4, len: { [t]: 5 }, t: '5+ ' + SUIT[t] + ', some values', f: 1 });
      add(B(2, 4), () => true, { min: 4, t: 'Natural: no fit, some values', f: 1 });
      return L;
    }
    add(B(3, 2), h => h.len[2] >= 5 && h.hcp >= 3, { len: { 2: 5 }, t: '5+ ♥', f: 1 });
    add(B(3, 3), h => h.len[3] >= 5 && h.hcp >= 3, { len: { 3: 5 }, t: '5+ ♠', f: 1 });
    add(B(4, s), h => h.len[s] >= 4, { len: { [s]: 4 }, t: 'Support for ' + SUIT[s], f: 1 });
    add(B(3, 4), () => true, { t: 'Natural: no fit', f: 1 });
    return L;
  }
  if (!oppOpened && opening.call === B(2, 0) && opening.seat === x.seat && my.length === 2 && pJust && rhoPass && pm.tag === '2neg') {
    const s = ST(myLast.call);
    add(B(4, s), h => h.hcp >= 25 || h.len[s] >= 7, { t: 'Game opposite a bust' });
    add(B(3, s), () => true, { len: { [s]: 6 }, t: 'Rebidding the suit: not forcing' });
    return L;
  }
  if (!oppOpened && opening.call === B(2, 0) && opening.seat === p && my.length === 2 && mm.tag === '2neg' && pJust && rhoPass && LV(pLast.call) === 3) {
    const s = ST(pLast.call);
    add(B(4, s), h => h.len[s] >= 2 && (h.hcp >= 2 || h.len[s] >= 3), { t: 'Raising to game' });
    add('P', () => true, { t: 'Bust: pass' });
    return L;
  }

  /* ===== opener after partner's negative double ===== */
  if (!oppOpened && opening.seat === x.seat && my.length === 1 && pa.length === 1 && pa[0].call === 'X' && pJust && rhoPass && pm.cv === 'nego') {
    const os = ST(opening.call), obs = x.oppSuits.length ? x.oppSuits[0] : -1;
    const cheap = s => (ST(st.last) < s ? LV(st.last) : LV(st.last) + 1);
    for (const s of [3, 2]) if (s !== obs && s !== os && pm.len && pm.len[s]) {
      const l = cheap(s);
      if (l + 1 <= 4) add(B(l + 1 === 4 ? 4 : l + 1, s), h => h.len[s] >= 4 && h.sup(s) >= 17, { min: 16, len: { [s]: 4 }, t: 'Jump in ' + SUIT[s] + ': four-card support, 17+ points' });
      add(B(l, s), h => h.len[s] >= 4, { min: 12, max: 16, len: { [s]: 4 }, t: 'Four ' + SUIT[s] + ' for partner\'s double' });
    }
    if (obs >= 0) {
      if (cheap(4) <= 1) add(B(1, 4), h => h.stop(obs) && h.bal && h.hcp <= 14, { min: 12, max: 14, t: 'Balanced 12-14 with a ' + SUIT[obs] + ' stopper' });
      add(B(cheap(4) + (cheap(4) <= 1 ? 1 : 0), 4), h => h.stop(obs) && h.bal && h.hcp >= 18, { min: 18, max: 19, t: 'Balanced 18-19 with a stopper' });
    }
    add(B(cheap(os), os), h => h.len[os] >= 6 || (h.len[os] >= 5 && h.hcp <= 15), { len: { [os]: 5 }, t: 'Rebidding my suit' });
    for (let s = 0; s < 4; s++) if (s !== os && s !== obs && cheap(s) <= 2) add(B(cheap(s), s), h => h.len[s] >= 4, { len: { [s]: 4 }, t: '4+ ' + SUIT[s] });
    add('P', h => h.len[obs] >= 4 && h.top5(obs) >= 3, { t: 'Converting to penalties' });
    add(B(cheap(os), os), () => true, { t: 'Cheapest rebid in my suit' });
    return L;
  }

  /* ===== Inverted Minors: opener after the preemptive raise (1♣–3♣, 6-9): pass unless strong ===== */
  if (!oppOpened && opening.seat === x.seat && my.length === 1 && pa.length === 1 && pJust && rhoPass && pm.cv === 'invMin' && pLast.call === B(3, ST(opening.call))) {
    const os = ST(opening.call);
    add(B(3, 4), h => h.hcp >= 18 && [0, 1, 2, 3].filter(s => s !== os).every(s => h.stop(s) || h.len[s] >= 4), { min: 18, t: 'Strong and stoppers: 3NT opposite the weak raise' });
    add(B(5, os), h => h.hcp >= 19 || (h.hcp >= 17 && h.len[os] >= 6), { min: 17, t: 'Game in the minor: strong opener' });
    add('P', () => true, { t: 'Pass: partner\'s raise is weak (6-9)' });
    return L;
  }
  /* ===== Jordan 2NT: opener signs off in three of the major with a minimum, else game ===== */
  if (!oppOpened && opening.seat === x.seat && my.length === 1 && pa.length === 1 && pm.tag === 'jordan' && pJust) {
    const os = ST(opening.call);
    add(B(4, os), h => h.hcp >= 13 || (h.hcp >= 12 && h.lp >= 1), { min: 13, tag: 'stop', cv: 'jordan', t: 'Accepting Jordan: game' });
    add(B(3, os), () => B(3, os) > st.last, { max: 12, tag: 'jordan3', cv: 'jordan', t: 'Minimum (12): three of the major' });
    add('P', () => true, { t: 'Pass' });
    return L;
  }
  if (!oppOpened && opening.seat === p && my.length === 1 && mm.tag === 'jordan' && pa.length === 2 && pJust && pm.tag === 'jordan3') {
    const os = ST(opening.call);
    add(B(4, os), h => h.sup(os) >= 12, { tag: 'stop', t: 'Game: more than a limit raise' });
    add('P', () => true, { t: 'A limit raise only: pass' });
    return L;
  }
  /* ===== Flannery: opener after an invitation or the 2NT ask; responder after the answer ===== */
  if (!oppOpened && opening.seat === x.seat && opening.m && opening.m.tag === 'flan' && my.length === 1 && pa.length === 1 && pJust && rhoPass) {
    if (pm.tag === 'flan2s') { add(B(4, 3), h => h.hcp >= 14, { min: 14, tag: 'stop', cv: 'flannery', t: 'Accepting: game in spades (14-15)' }); add('P', () => true, { t: 'Minimum: pass' }); return L; }
    if (pm.tag === 'flaninv') { const M = ST(pLast.call); add(B(4, M), h => h.hcp >= 14 || (h.hcp >= 13 && h.lp >= 1), { min: 13, tag: 'stop', cv: 'flannery', t: 'Accepting the invitation' }); add('P', () => true, { t: 'Minimum: pass' }); return L; }
    if (pm.tag === 'flanask') {
      const A = (call, test, len, t, mn, mx) => add(call, test, { len, min: mn, max: mx, tag: 'flanans', cv: 'flannery', t: 'Flannery answer: ' + t });
      A(B(4, 0), h => h.len[1] === 0, { 0: 4 }, '4-5-0-4');
      A(B(4, 1), h => h.len[0] === 0, { 1: 4 }, '4-5-4-0');
      A(B(3, 0), h => h.len[0] >= 3, { 0: 3 }, 'three clubs (a singleton diamond)');
      A(B(3, 1), h => h.len[1] >= 3, { 1: 3 }, 'three diamonds (a singleton club)');
      A(B(3, 3), h => h.hcp >= 14, { 0: 2, 1: 2 }, '4-5-2-2, maximum (14-15)', 14, 15);
      A(B(3, 2), () => true, { 0: 2, 1: 2 }, '4-5-2-2, minimum (11-13)', 11, 13);
      return L;
    }
  }
  if (!oppOpened && opening.seat === p && opening.m && opening.m.tag === 'flan' && my.length === 1 && mm.tag === 'flanask' && pJust && rhoPass && pm.tag === 'flanans') {
    const P = pInfo(x);
    const tr = h => h.len[3] >= 4 ? 3 : h.len[2] >= 3 ? 2 : -1;
    for (const t of [3, 2]) add(B(4, 4), h => tr(h) === t && h.sup(t) + P.min + 2 >= 32 && h.aces >= 1, { tag: 'bw', trump: t, rkc: C.rkc0314 ? 2 : C.rkc ? 1 : 0, cv: C.rkc0314 ? 'rkc0314' : C.rkc ? 'rkc' : 'bw', t: 'Asking for key cards (trumps ' + SUIT[t] + ')' });
    add(B(4, 3), h => h.len[3] >= 4, { tag: 'stop', t: 'Game in the 4-4 spade fit' });
    add(B(4, 2), h => h.len[2] >= 3, { tag: 'stop', t: 'Game in the heart fit' });
    add(B(3, 4), () => B(3, 4) > pLast.call, { tag: 'stop', t: '3NT: no major fit' });
    add(B(5, 0), h => h.len[0] >= 5 && P.len[0] >= 3, { tag: 'stop', t: 'Game in clubs' });
    add(B(5, 1), h => h.len[1] >= 5, { tag: 'stop', t: 'Game in diamonds' });
    add(B(4, 2), () => true, { tag: 'stop', t: 'Game in the 5-2 heart fit' });
    return L;
  }
  /* ===== opener's rebid ===== */
  if (!oppOpened && opening.seat === x.seat && my.length === 1 && pa.length === 1 && isNum(pa[0].call)) {
    const tail = auc.slice(auc.indexOf(opening) + 1);
    if (tail.length === 3 && tail[0].call === 'P' && tail[2].call === 'P') { if (openerRebid(x, add, opening.call, pa[0])) return L; }
  }

  /* ===== Gazilli: responder after opener's 2♣ (1♥/1♠–1NT–2♣); opener after the 2♦ relay ===== */
  if (!oppOpened && opening.seat === p && my.length === 1 && my[0].call === B(1, 4) && pa.length === 2 && pJust && rhoPass && pm.tag === 'gaz') {
    const M = ST(opening.call);
    add(B(2, 1), h => h.hcp >= 8, { min: 8, tag: 'gazr', cv: 'gazilli', f: 1, t: 'Gazilli 2♦: 8+ points (relay)' });
    add('P', h => h.len[0] >= 5 && h.len[M] <= 1 && h.hcp <= 5, { max: 5, len: { 0: 5 }, cv: 'gazilli', t: 'Pass: long clubs, very weak' });
    for (const z of [3, 2]) if (z !== M && B(2, z) > B(2, 1)) add(B(2, z), h => h.len[z] >= 6 && h.len[M] <= 1, { max: 7, len: { [z]: 6 }, cv: 'gazilli', t: 'To play: 6+ ' + SUIT[z] + ', weak' });
    add(B(2, M), () => true, { max: 7, len: { [M]: 2 }, tag: 'stop', cv: 'gazilli', t: 'Preference: ' + SUIT[M] + ', weak (0-7)' });
    return L;
  }
  if (!oppOpened && opening.seat === x.seat && my.length === 2 && mm.tag === 'gaz' && pJust && rhoPass && pm.tag === 'gazr') {
    const M = ST(opening.call);
    add(B(2, M), h => h.hcp <= 15, { max: 15, len: { [M]: 5, 0: 4 }, cv: 'gazilli', t: 'Gazilli: the minimum with clubs (11-15)' });
    add(B(3, M), h => h.len[M] >= 6, { min: 16, len: { [M]: 6 }, cv: 'gazilli', f: 1, gf: 1, t: 'Gazilli: 16+ with six ' + SUIT[M] + ', game forcing' });
    if (M === 2) add(B(2, 3), h => h.len[3] >= 4, { min: 16, len: { 3: 4 }, cv: 'gazilli', f: 1, gf: 1, t: 'Gazilli: 16+ with four spades' });
    if (M === 3) add(B(3, 2), h => h.len[2] >= 4 && h.len[2] >= Math.max(h.len[0], h.len[1]), { min: 16, len: { 2: 4 }, cv: 'gazilli', f: 1, gf: 1, t: 'Gazilli: 16+ with hearts, game forcing' });
    add(B(2, 4), h => h.bal && h.hcp >= 18, { min: 18, max: 19, len: BAL, cv: 'gazilli', f: 1, t: 'Gazilli: balanced 18-19' });
    for (const z of [0, 1]) add(B(3, z), h => h.len[z] >= 4 && h.len[z] >= h.len[z === 0 ? 1 : 0], { min: 16, len: { [z]: 4 }, cv: 'gazilli', f: 1, gf: 1, t: 'Gazilli: 16+ with ' + SUIT[z] + ', game forcing' });
    add(B(2, 4), () => true, { min: 16, cv: 'gazilli', f: 1, t: 'Gazilli: 16+, no second suit' });
    return L;
  }
  /* ===== responder's second bid: New Minor Forcing, Fourth Suit Forcing ===== */
  if (!oppOpened && opening.seat === p && my.length === 1 && pa.length === 2 && isNum(my[0].call) && isNum(pa[1].call) && ourOnly(x) && LV(opening.call) === 1 && ST(opening.call) < 4) {
    const os = ST(opening.call), ms = ST(my[0].call), r2 = pa[1].call, r2s = ST(r2);
    if (C.nmf && os < 2 && LV(my[0].call) === 1 && ms >= 2 && r2 === B(1, 4)) {
      const nm = os === 0 ? 1 : 0, om = otherMajor(ms);
      add(B(2, nm), h => h.hcp >= 10 && (h.len[ms] >= 5 || h.len[om] >= 4), { min: 10, tag: 'nmf', ms, cv: 'nmf', t: 'New Minor Forcing: asking for 3-card ' + SUIT[ms] + ' support or four ' + SUIT[om], f: 1 });
    }
    // after our Forcing 1NT and opener's forced two-level rebid (not a reverse): place the contract or invite
    // (6-9: pass with a fit for opener's second suit, a long suit of my own to play, else preference to 2 of the major;
    // 10-11: three-card limit raise to three of the major, a raise of opener's suit, or 2NT)
    if ((my[0].m || {}).tag === 'nt1f' && rhoPass && isNum(r2) && LV(r2) === 2 && r2s < 4 && !(r2s !== os && r2s > os)) {
      const top = Math.min(11, (my[0].m || {}).max || 11), M = os, fit2 = r2s !== M ? r2s : -1;   // an invitation is 10-11 (with 12, game)
      add(B(4, M), h => h.len[M] >= 3 && h.sup(M) >= top + 1, { min: top, len: { [M]: 3 }, cv: 'fnt', t: 'Game: three-card support' });
      add(B(3, M), h => h.len[M] >= (r2s === M ? 2 : 3) && h.sup(M) >= 10 && h.sup(M) <= 11, { min: 10, max: top, len: { [M]: r2s === M ? 2 : 3 }, cv: 'fnt', t: r2s === M ? 'Invitation: ' + SUIT[M] + ' support, 10-' + top : 'Three-card limit raise, invitational: 10-' + top });
      if (fit2 >= 0) add(B(3, fit2), h => h.len[fit2] >= (fit2 >= 2 ? 4 : 5) && (fit2 >= 2 ? h.sup(fit2) >= 10 && h.sup(fit2) <= 11 : h.hcp >= 10 && h.hcp <= 11) && h.len[M] <= 2, { min: 10, max: top, len: { [fit2]: 4 }, cv: 'fnt', t: 'Invitation: 4+ ' + SUIT[fit2] + ' support, 10-' + top });
      if (r2s !== M) for (const z of [3, 2, 1, 0]) if (z !== M && z !== r2s) {   // (over a rebid six-card major: pass, not a suit of my own)
        const lv = B(2, z) > r2 ? 2 : 3;
        if (lv === 2 || z < 2) add(B(lv, z), h => h.len[z] >= 6 && h.hcp <= 9 && h.len[M] <= 2 && !(fit2 >= 0 && h.len[fit2] >= 4), { max: 9, len: { [z]: 6 }, cv: 'fnt', t: 'To play: 6+ ' + SUIT[z] + ', weak' });
      }
      add(B(2, 4), h => h.hcp >= 10 && h.hcp <= 11 && h.len[M] <= 2 && h.semi, { min: 10, max: top, cv: 'fnt', t: 'Invitation: 10-' + top + ', no fit' });
      if (fit2 >= 0) add('P', h => h.hcp <= 9 && h.len[fit2] >= (fit2 >= 2 ? 4 : 3) && h.len[fit2] > h.len[M], { max: 9, cv: 'fnt', t: 'Pass: ' + SUIT[fit2] + ' fit, weak' });
      if (r2s === M) add('P', h => h.hcp <= 9, { max: 9, cv: 'fnt', t: 'Pass: weak' });
      else if (B(2, M) > r2) add(B(2, M), h => h.hcp <= 9 && h.len[M] >= 2, { max: 9, len: { [M]: 2 }, cv: 'fnt', t: 'Preference: ' + SUIT[M] + ' (two cards), 6-9' });
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

  /* ===== Baron: responder places the contract after opener's four-card suit ===== */
  if (!oppOpened && (opening.call === B(1, 4) || opening.call === B(2, 4)) && opening.seat === p && my.length === 1 && mm.tag === 'baron' && pJust && rhoPass && pm.tag === 'baronans') {
    const n = (opening.m && opening.m.min) || (LV(opening.call) === 1 ? 15 : 20), s = ST(pLast.call);
    if (s < 4) add(B(6, s), h => h.len[s] >= 4 && h.hcp + n >= 32, { tag: 'stop', cv: 'baron', t: 'Slam in the 4-4 ' + SUIT[s] + ' fit' });
    add(B(7, 4), h => h.hcp + n >= 37, { t: 'Grand slam in notrump' });
    add(B(6, 4), h => h.hcp + n >= 33, { tag: 'stop', t: 'Small slam in notrump' });
    add(B(4, 4), () => B(4, 4) > pLast.call, { tag: 'q', cv: 'q', min: mm.min, t: 'Quantitative 4NT: no fit found, slam invitation' });
    add(B(6, 4), () => true, { tag: 'stop', t: 'Small slam in notrump' });
    return L;
  }
  /* ===== notrump follow-ups (Stayman, transfers, Smolen) ===== */
  if (!oppOpened && (opening.call === B(1, 4) || opening.call === B(2, 4)) && ourOnly(x)) {
    const lv = LV(opening.call);
    const A = shiftAdd(add, lv === 1 ? x.ntShift : 0, opening.seat === p);   // the system's notrump range
    if (opening.seat === p && my.length === 1 && pa.length === 2 && (mm.tag === 'stay' || mm.tag === 'tr' || mm.tag === 'pup')) {
      const ans = pa[1].call;
      if (mm.tag === 'pup') {
        if (ans === B(3, 2) || ans === B(3, 3)) {
          const M = ST(ans);
          A(B(4, M), h => h.len[M] >= 3, { len: { [M]: 3 }, cv: 'puppet', t: 'Major fit: game' });
          A(B(3, 4), () => true, { t: 'No major fit: 3NT' });
        } else if (ans === B(3, 1)) {
          // the major not held, so the 2NT opener declares
          A(B(4, 1), h => h.len[2] === 4 && h.len[3] === 4, { len: { 2: 4, 3: 4 }, cv: 'puppet', t: 'Puppet Stayman: four hearts and four spades', f: 1 });
          A(B(3, 2), h => h.len[3] === 4, { len: { 3: 4 }, cv: 'puppet', t: 'Puppet Stayman: four spades, not four hearts', f: 1 });
          A(B(3, 3), h => h.len[2] === 4, { len: { 2: 4 }, cv: 'puppet', t: 'Puppet Stayman: four hearts, not four spades', f: 1 });
          A(B(3, 4), () => true, { cv: 'puppet', t: 'Puppet Stayman: no 4-card major' });
        } else A('P', () => true, { t: 'Pass' });
      } else if (mm.tag === 'stay') {
        const aS = ST(ans);
        if (aS === 2 || aS === 3) {
          A(B(4, aS), h => h.len[aS] >= 4 && (lv === 2 || h.hcp >= 10) && h.hcp <= 15, { min: lv === 1 ? 10 : 4, len: { [aS]: 4 }, t: 'Major fit: game' });
          if (lv === 1) A(B(3, aS), h => h.len[aS] >= 4 && h.hcp >= 8 && h.hcp <= 9, { min: 8, max: 9, len: { [aS]: 4 }, t: 'Major fit: invitational' });
        }
        if (aS === 1 && C.smolen) {
          const g = lv === 1 ? 10 : 4;
          A(B(3, 2), h => h.len[2] === 4 && h.len[3] >= 5 && h.hcp >= g, { min: g, len: { 2: 4, 3: 5 }, tag: 'smolen', five: 3, cv: 'smolen', t: 'Smolen: 4♥ + 5♠, game forcing', f: 1, gf: 1 });
          A(B(3, 3), h => h.len[3] === 4 && h.len[2] >= 5 && h.hcp >= g, { min: g, len: { 3: 4, 2: 5 }, tag: 'smolen', five: 2, cv: 'smolen', t: 'Smolen: 4♠ + 5♥, game forcing', f: 1, gf: 1 });
        }
        // 5-4 in the majors, invitational: bid the five-card major at the two level
        if (aS === 1 && lv === 1) for (const M of [3, 2]) A(B(2, M), h => h.len[M] >= 5 && h.len[otherMajor(M)] >= 4 && h.hcp >= 8 && h.hcp <= 9, { min: 8, max: 9, len: { [M]: 5, [otherMajor(M)]: 4 }, cv: 'stayman', t: 'Five ' + SUIT[M] + ' and four ' + SUIT[otherMajor(M)] + ', invitational' });
        if (aS === 2 && lv === 1) A(B(2, 3), h => h.len[3] >= 4 && h.hcp >= 8 && h.hcp <= 9, { min: 8, max: 9, len: { 3: 4 }, t: 'Four spades, invitational' });
        if (lv === 1) A(B(2, 4), h => h.hcp <= 9, { min: 8, max: 9, t: 'Invitational: 8-9 HCP' });
        A(B(3, 4), h => h.hcp <= 15, { min: lv === 1 ? 10 : 4, max: 15, t: 'Game' });
      } else {
        const M = ST(ans);
        if (lv === 1 && ans === B(3, M)) {
          A(B(4, M), h => h.hcp >= 6, { t: 'Partner super-accepted: game' });
          A('P', () => true, { t: 'Weak: stop in three' });
        } else if (lv === 1) {
          A('P', h => h.hcp <= 7, { max: 7, t: 'Weak: play the transfer suit' });
          // 5-5 majors (after ♥ transfer, 2♠ is invitational; after ♠, 3♥ is game forcing)
          if (M === 2) A(B(2, 3), h => h.len[3] >= 5 && h.hcp >= 8 && h.hcp <= 9, { min: 8, max: 9, len: { 2: 5, 3: 5 }, t: '5-5 in the majors, invitational' });
          // a second suit at the three level: natural, game forcing
          for (const s of [0, 1, 2]) if (s !== M && B(3, s) > ans) A(B(3, s), h => h.len[s] >= (s === 2 ? 5 : 4) && h.hcp >= 10 && h.hcp <= 15 && !(h.bal && h.len[M] === 5), { min: 10, len: { [M]: 5, [s]: s === 2 ? 5 : 4 }, t: 'Second suit: 4+ ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
          A(B(3, M), h => h.len[M] >= 6 && h.hcp <= 9, { min: 8, max: 9, len: { [M]: 6 }, t: 'Six-card suit, invitational' });
          A(B(4, M), h => h.len[M] >= 6 && h.hcp <= 15, { min: 10, max: 15, len: { [M]: 6 }, t: 'Six-card suit, game' });
          A(B(2, 4), h => h.hcp <= 9, { min: 8, max: 9, len: { [M]: 5 }, t: 'Five-card major, invitational' });
          A(B(3, 4), h => h.hcp <= 15, { min: 10, max: 15, len: { [M]: 5 }, t: 'Five-card major, game: opener chooses' });
        } else {
          A('P', h => h.hcp <= 3, { max: 3, t: 'Weak' });
          A(B(4, M), h => h.len[M] >= 6 && h.hcp <= 12, { len: { [M]: 6 }, t: 'Six-card suit, game' });
          A(B(3, 4), h => h.hcp <= 12, { len: { [M]: 5 }, t: 'Five-card major, game: opener chooses' });
        }
      }
      if (L.length) return L;
    }
    // opener after Puppet 3♦: 3♥ shows four spades, 3♠ four hearts, 4♦ both
    if (opening.seat === x.seat && lv === 2 && my.length === 2 && pa.length === 2 && pa[0].m && pa[0].m.tag === 'pup' && my[1].call === B(3, 1)) {
      const r2 = pa[1].call;
      if (r2 === B(3, 2)) { A(B(4, 3), h => h.len[3] >= 4, { len: { 3: 4 }, t: 'Spade fit: game' }); A(B(3, 4), () => true, { t: 'No spade fit: 3NT' }); return L; }
      if (r2 === B(3, 3)) { A(B(4, 2), h => h.len[2] >= 4, { len: { 2: 4 }, t: 'Heart fit: game' }); A(B(3, 4), () => true, { t: 'No heart fit: 3NT' }); return L; }
      if (r2 === B(4, 1)) { A(B(4, 2), h => h.len[2] >= 4, { len: { 2: 4 }, t: 'Heart fit: game' }); A(B(4, 3), () => true, { len: { 3: 4 }, t: 'Spade fit: game' }); return L; }
      if (r2 === B(3, 4)) { A('P', () => true, { t: 'Pass' }); return L; }
    }
    // opener after Stayman: responder's 2NT/3NT/2♠ may hide the other major (responder promised one)
    if (opening.seat === x.seat && my.length === 2 && pa.length === 2 && pa[0].m && pa[0].m.tag === 'stay' && ST(my[1].call) === 2) {
      const r2 = pa[1].call, top = lv === 1 ? 16 : 21;
      if (r2 === B(3, 4)) { A(B(4, 3), h => h.len[3] >= 4, { len: { 3: 4 }, t: 'Four spades too: partner has them' }); A('P', () => true, { t: 'Pass' }); return L; }
      if (r2 === B(2, 4)) {
        A(B(4, 3), h => h.len[3] >= 4 && h.hcp >= top, { min: top, len: { 3: 4 }, t: 'Four spades too, maximum' });
        A(B(3, 3), h => h.len[3] >= 4, { len: { 3: 4 }, t: 'Four spades too, minimum' });
        A(B(3, 4), h => h.hcp >= top, { min: top, t: 'Maximum: accepting' }); A('P', () => true, { t: 'Minimum' }); return L;
      }
      if (r2 === B(2, 3)) {
        A(B(4, 3), h => h.len[3] >= 4 && h.hcp >= top, { min: top, t: 'Spade fit, maximum: game' });
        A(B(3, 3), h => h.len[3] >= 4, { t: 'Spade fit, minimum' });
        A(B(3, 4), h => h.hcp >= top, { min: top, t: 'No spade fit, maximum' }); A(B(2, 4), () => true, { t: 'No spade fit, minimum' }); return L;
      }
    }
    if (opening.seat === x.seat && lv === 1 && my.length === 2 && pa.length === 2 && pa[0].m && pa[0].m.tag === 'stay' && my[1].call === B(2, 1) && (pa[1].call === B(2, 2) || pa[1].call === B(2, 3))) {
      const M = ST(pa[1].call);
      A(B(4, M), h => h.len[M] >= 3 && h.hcp >= 16, { t: 'Fit and maximum: game' });
      A('P', h => h.len[M] >= 3, { t: 'Fit, minimum: pass' });
      A(B(3, 4), h => h.hcp >= 16, { t: 'No fit, maximum' });
      A(B(2, 4), () => true, { t: 'No fit, minimum' });
      return L;
    }
    if (opening.seat === x.seat && pLast && pm.tag === 'smolen' && pJust) {
      const F = pm.five;
      A(B(4, F), h => h.len[F] >= 3, { t: 'Smolen reply: three-card ' + SUIT[F] + ' fit, game' });
      A(B(3, 4), () => true, { t: 'Smolen reply: no fit, 3NT' });
      return L;
    }
    if (opening.seat === x.seat && my.length === 2 && my[1].m && my[1].m.tag === 'trc' && pa.length === 2 && ST(my[1].call) >= 2) {
      const M = ST(my[1].call), r2 = pa[1].call;
      if (r2 === B(2, 4)) { A(B(4, M), h => h.len[M] >= 3 && h.hcp >= 16, { t: 'Fit and maximum: game' }); A(B(3, M), h => h.len[M] >= 3, { t: 'Fit, minimum' }); A(B(3, 4), h => h.hcp >= 16, { t: 'Maximum, no fit' }); A('P', () => true, { t: 'Minimum' }); return L; }
      if (r2 === B(3, 4)) { A(B(4, M), h => h.len[M] >= 3, { t: 'Three-card fit: major game' }); A('P', () => true, { t: 'No fit' }); return L; }
      if (r2 === B(3, M)) { A(B(4, M), h => lv === 2 || h.hcp >= 16 || h.len[M] >= 4, { t: 'Accepting the invitation' }); A('P', () => true, { t: 'Minimum' }); return L; }
      if (r2 >= B(4, 0)) { A('P', () => true, { t: 'Pass' }); return L; }
    }
    if (opening.seat === p && my.length === 1 && pa.length === 2 && mm.tag === 'trm') { A('P', () => true, { t: 'Pass to play the minor' }); return L; }
  }
  return L;
}

/* Notrump ranges other than 15-17 (Acol 12-14, Precision 13-15): the 15-17 rules are used with every hand moved
   by the difference d — the responder counts d points less, the opener d points more — and the ranges in the
   meanings (and their texts) are moved back. */
function shiftAdd(add, d, resp) {
  if (!d) return add;
  const sh = h => Object.assign(Object.create(h), { hcp: h.hcp + (resp ? -d : d) });
  const fix = m => {
    if (!m || !resp) return m;
    const n = { ...m }; if (n.min != null) n.min += d; if (n.max != null) n.max += d;
    if (n.t) n.t = n.t.replace(/(\d+)-(\d+) HCP/g, (_, a, b) => (+a ? +a + d : 0) + '-' + (+b + d) + ' HCP').replace(/(\d+)\+ HCP/g, (_, a) => (+a + d) + '+ HCP');
    return n;
  };
  return (c, t, m) => add(c, h => t(sh(h)), fix(m));
}
/* ---- responses to 1NT / 2NT (also after our 1NT overcall; own: our own opening, whose range the system sets) ---- */
function ntResponses(x, add, lv, own) {
  if (own && lv === 1) add = shiftAdd(add, x.ntShift, true);
  const C = x.C, off = lv - 1;
  if (C.texas) {
    add(B(4, 1), h => h.len[2] >= 6 && h.hcp >= (lv === 1 ? 10 : 4) && h.hcp <= (lv === 1 ? 15 : 11), { min: lv === 1 ? 10 : 4, len: { 2: 6 }, tag: 'texas', to: B(4, 2), cv: 'texas', t: 'Texas transfer: 6+ ♥, game (partner bids 4♥)' });
    add(B(4, 2), h => h.len[3] >= 6 && h.hcp >= (lv === 1 ? 10 : 4) && h.hcp <= (lv === 1 ? 15 : 11), { min: lv === 1 ? 10 : 4, len: { 3: 6 }, tag: 'texas', to: B(4, 3), cv: 'texas', t: 'Texas transfer: 6+ ♠, game (partner bids 4♠)' });
  }
  if (C.gerber) add(B(4, 0), h => h.hcp >= (lv === 1 ? 18 : 13) && h.semi, { min: lv === 1 ? 18 : 13, tag: 'gerb', cv: 'gerber', t: 'Gerber: asking for aces (slam interest)' });
  const pup = lv === 2 && C.puppet;   // Puppet Stayman over 2NT (Stayman stays over 1NT)
  if (pup) add(B(3, 0), h => h.hcp >= 4 && h.len[2] <= 4 && h.len[3] <= 4 && (h.len[2] >= 4 || h.len[3] >= 4), { min: 4, tag: 'pup', cv: 'puppet', t: 'Puppet Stayman: asking for a 4- or 5-card major', f: 1 });
  if (C.stayman && !pup) add(B(2 + off, 0), h => h.len[2] >= 4 && h.len[3] >= 4 && h.hcp >= (lv === 1 ? 8 : 4), { min: lv === 1 ? 8 : 4, tag: 'stay', cv: 'stayman', t: 'Stayman: asking for a 4-card major', f: 1 });
  add(B(2 + off, 1), h => h.len[2] >= 5 && h.len[2] >= h.len[3], { len: { 2: 5 }, tag: 'tr', cv: 'jtr', t: 'Transfer: 5+ ♥ (partner bids hearts)', f: 1 });
  add(B(2 + off, 2), h => h.len[3] >= 5, { len: { 3: 5 }, tag: 'tr', cv: 'jtr', t: 'Transfer: 5+ ♠ (partner bids spades)', f: 1 });
  if (pup) add(B(3, 0), h => h.hcp >= 4 && h.hcp <= 10 && h.len[2] <= 4 && h.len[3] <= 4 && (h.len[2] === 3 || h.len[3] === 3), { min: 4, tag: 'pup', cv: 'puppet', t: 'Puppet Stayman: asking for a 4- or 5-card major', f: 1 });
  if (C.stayman && !pup) add(B(2 + off, 0), h => h.hcp >= (lv === 1 ? 8 : 4) && (h.len[2] === 4 || h.len[3] === 4) && h.pat !== '4333', { min: lv === 1 ? 8 : 4, tag: 'stay', cv: 'stayman', t: 'Stayman: asking for a 4-card major', f: 1 });
  // Baron: a balanced slam try with no four-card major (1NT–2♠, 2NT–3♠): opener shows four-card suits up the line
  if (C.baron && (lv === 2 || (!C.fourWay && !C.minorTr))) add(B(lv + 1, 3), h => h.semi && h.len[2] < 4 && h.len[3] < 4 && h.hcp >= (lv === 1 ? 16 : 11) && h.hcp <= (lv === 1 ? 19 : 15), { min: lv === 1 ? 16 : 11, max: lv === 1 ? 19 : 15, tag: 'baron', cv: 'baron', f: 1, t: 'Baron: balanced slam try, show your four-card suits up the line' });
  if (lv === 1) {
    // Minor Transfer (in place of the 4-way ones): 2♠ → 3♣, 3♣ → 3♦; 2NT stays natural
    if (C.minorTr) {
      add(B(2, 3), h => h.len[0] >= 6 && h.hcp <= 7, { max: 7, len: { 0: 6 }, tag: 'trm', to: B(3, 0), cv: 'minorTr', t: 'Minor transfer: 6+ ♣ (partner bids 3♣)' });
      add(B(3, 0), h => h.len[1] >= 6 && h.hcp <= 7, { max: 7, len: { 1: 6 }, tag: 'trm', to: B(3, 1), cv: 'minorTr', t: 'Minor transfer: 6+ ♦ (partner bids 3♦)' });
    }
    if (C.fourWay && !C.minorTr) {
      add(B(2, 3), h => h.len[0] >= 6 && h.hcp <= 7, { max: 7, len: { 0: 6 }, tag: 'trm', to: B(3, 0), cv: 'fourWay', t: '4-way transfer: 6+ ♣ (partner bids 3♣)' });
      add(B(2, 4), h => h.len[1] >= 6 && h.hcp <= 7, { max: 7, len: { 1: 6 }, tag: 'trm', to: B(3, 1), cv: 'fourWay', t: '4-way transfer: 6+ ♦ (partner bids 3♦)' });
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
  // Forcing 1NT (its own convention; a card saved before it existed follows 2/1, as it did): over 1♥/1♠ by an unpassed
  // hand, 1NT is forcing one round, 6-11 (6-12 with 2/1, where a two-level new suit needs 12); a three-card limit raise
  // goes through it (1NT, then a jump to three of the major)
  const fntOn = 'fnt' in C ? !!C.fnt : !!C.twoOverOne, fnt = maj && fntOn && un, fntMax = two1 ? 12 : 11;
  // a strong jump shift (19+, a good suit) comes before the ordinary new-suit responses that the same hand also fits
  if (C.sjs && un && !rhoX) for (const s of [1, 2, 3]) {
    if (s <= os) continue;
    add(B(2, s), h => h.len[s] >= 5 && h.hcp >= 17 && h.top5(s) >= 3, { min: 17, len: { [s]: 5 }, tag: "sjs", cv: "sjs", t: "Strong jump shift: 17+ points, good " + SUIT[s] + " suit, slam interest", f: 1, gf: 1 });
  }
  // Jordan 2NT: over the takeout double of our major, four-card support and a limit raise or better
  if (C.jordan && maj && rhoX) add(B(2, 4), h => h.len[os] >= 4 && h.sup(os) >= 10 && h.sup(os) <= 12 && h.hcp >= 8, { min: 10, len: { [os]: 4 }, tag: 'jordan', cv: 'jordan', f: 1, t: 'Jordan 2NT: 4+ ' + SUIT[os] + ' support, a limit raise or better (10+)' });
  if (rhoX) add('XX', h => h.hcp >= 10, { min: 10, t: 'Redouble: 10+ HCP' });
  if (maj) {
    if (C.drury && x.passed && !rhoX && x.auc.indexOf(x.opening) >= 2) add(B(2, 0), h => h.len[os] >= 3 && h.sup(os) >= 9 && h.hcp <= 11, { min: 9, max: 11, len: { [os]: 3 }, tag: "drury", cv: "drury", t: "Drury: 3+ " + SUIT[os] + " support, 9-11 points (passed hand)", f: 1 });
    if (C.splinter && un && !rhoX) for (const s of [0, 1, 2, 3]) {
      if (s === os) continue; const n = B(1, s) > o ? 1 : 2; const lvl = n + 2; if (lvl > 4) continue;
      add(B(lvl, s), h => h.len[os] >= 4 && h.len[s] <= 1 && h.hcp >= 11 && h.hcp <= 15, { min: 11, max: 15, len: { [os]: 4 }, tag: 'splinter', cv: 'splinter', t: 'Splinter: 4+ ' + SUIT[os] + ' support, singleton or void in ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
    }
    if (C.j2nt && un && !rhoX) add(B(2, 4), h => h.len[os] >= 4 && h.hcp >= 11 && h.sup(os) >= 13, { min: 12, len: { [os]: 4 }, tag: 'j2nt', cv: 'j2nt', t: 'Jacoby 2NT: 4+ support, 13+ points, game forcing', f: 1, gf: 1 });
    if (C.bergen && !rhoX) {
      add(B(3, os), h => h.len[os] >= 4 && h.hcp <= 6, { max: 6, len: { [os]: 4 }, tag: 'bergenP', cv: 'bergen', t: 'Bergen: 4+ support, 0-6 points (preemptive)' });
      add(B(3, 1), h => h.len[os] >= 4 && h.sup(os) >= 10 && (h.sup(os) <= 12 || h.hcp <= 10), { min: 9, max: 12, len: { [os]: 4 }, tag: 'bergen10', cv: 'bergen', t: 'Bergen 3♦: 4+ support, 10-12 points (limit raise)', f: 1 });
      add(B(3, 0), h => h.len[os] >= 4 && h.sup(os) >= 7 && h.sup(os) <= 9, { min: 7, max: 9, len: { [os]: 4 }, tag: 'bergen7', cv: 'bergen', t: 'Bergen 3♣: 4+ support, 7-9 points', f: 1 });
    } else {
      add(B(4, os), h => h.len[os] >= 5 && h.hcp < 10, { max: 9, len: { [os]: 5 }, t: 'Preemptive: 5+ support, weak hand' });
      add(B(3, os), h => h.len[os] >= 4 && h.sup(os) >= 10 && (h.sup(os) <= 12 || h.hcp <= 10), { min: 9, max: 12, len: { [os]: 4 }, t: 'Limit raise: 4+ support, 10-12 points' });
      add(B(2, os), h => h.len[os] >= 4 && h.sup(os) >= 6 && h.sup(os) <= 9, { min: 6, max: 9, len: { [os]: 4 }, t: 'Single raise: support, 6-9 points' });
    }
    if (os === 2) add(B(1, 3), h => h.len[3] >= 4 && h.hcp >= 6, { min: 6, len: { 3: 4 }, t: '4+ ♠, 6+ HCP', f: 1 });
    if (x.sys.maj5) add(B(2, os), h => h.len[os] >= 3 && h.sup(os) >= 6 && h.sup(os) <= 9, { min: 6, max: 9, len: { [os]: 3 }, t: 'Single raise: 3-card support, 6-9 points' });   // a 4-card major (Acol) needs four
    if (!C.bergen && x.sys.maj5 && !fnt) add(B(3, os), h => h.len[os] === 3 && h.sup(os) >= 10 && h.sup(os) <= 12, { min: 10, max: 12, len: { [os]: 3 }, t: 'Limit raise: 3-card support, 10-12 points' });
  } else {
    if (C.invMin && un && !rhoX) {
      add(B(2, os), h => h.len[os] >= (os === 0 ? 5 : 4) && h.hcp >= 10 && h.len[2] < 4 && h.len[3] < 4, { min: 10, len: { [os]: 4 }, tag: "inv", cv: "invMin", t: "Inverted minor: 10+ points, 4+ support, no 4-card major, forcing", f: 1 });
      add(B(3, os), h => h.len[os] >= 5 && h.hcp >= 6 && h.hcp <= 9 && h.len[2] < 4 && h.len[3] < 4, { min: 6, max: 9, len: { [os]: 5 }, cv: "invMin", t: "Inverted minor: preemptive raise, 6-9 points, 5+ support" });
    }
    // Walsh: over 1♣ a weak or invitational hand (6-11) with a four-card major bids it at once, skipping five diamonds
    // (1♦ = six diamonds, or five with game values)
    if (os === 0 && C.walsh && !rhoX) {
      add(B(1, 2), h => h.hcp >= 6 && h.hcp <= 11 && h.len[1] === 5 && h.len[2] >= 4 && !(h.len[3] > h.len[2]), { min: 6, len: { 2: 4 }, cv: 'walsh', t: 'Walsh: 4+ ♥, 6+ HCP (diamonds not shown)', f: 1 });
      add(B(1, 3), h => h.hcp >= 6 && h.hcp <= 11 && h.len[1] === 5 && h.len[3] >= 4, { min: 6, len: { 3: 4 }, cv: 'walsh', t: 'Walsh: 4+ ♠, 6+ HCP (diamonds not shown)', f: 1 });
    }
    if (os === 0) add(B(1, 1), h => h.hcp >= 6 && ((h.len[1] >= 5 && h.len[1] > Math.max(h.len[2], h.len[3])) || (h.len[1] >= 4 && h.len[2] < 4 && h.len[3] < 4)), { min: 6, len: { 1: 4 }, t: '4+ ♦, 6+ HCP', f: 1 });
    add(B(1, 2), h => h.hcp >= 6 && h.len[2] >= 4 && !(h.len[3] >= 5 && h.len[3] > h.len[2]), { min: 6, len: { 2: 4 }, t: '4+ ♥, 6+ HCP', f: 1 });
    add(B(1, 3), h => h.hcp >= 6 && h.len[3] >= 4, { min: 6, len: { 3: 4 }, t: '4+ ♠, 6+ HCP', f: 1 });
  }
  if (C.wjs && !C.sjs && !rhoX) for (const s of [1, 2, 3]) {
    if (s <= os) continue;
    add(B(2, s), h => h.len[s] >= 6 && h.hcp >= 3 && h.hcp <= 6 && h.top5(s) >= 1, { min: 3, max: 6, len: { [s]: 6 }, tag: 'wjs', cv: 'wjs', t: 'Weak jump shift: 6+ ' + SUIT[s] + ', 3-6 HCP' });
  }
  if (fnt) add(B(1, 4), h => h.hcp >= 6 && h.hcp <= fntMax && h.len[os] <= 3 && !(h.len[os] === 3 && h.sup(os) <= 9), { min: 6, max: fntMax, tag: 'nt1f', cv: 'fnt', t: 'Forcing 1NT: 6-' + fntMax + ' HCP, forcing one round', f: 1 });
  else add(B(1, 4), h => h.hcp >= 6 && h.hcp <= 10 && !(maj && h.len[os] >= 3), { min: 6, max: 10, t: '6-10 HCP, no fit' });
  for (const s of [3, 2, 1, 0]) {
    if (s === os || B(1, s) > o) continue;
    const need = (os === 3 && s === 2) ? 5 : 4;
    // a passed hand (Forcing 1NT played): a two-level new suit is 9-11 and not forcing — the passed hand's 1NT is not forcing either
    const ph = x.passed && fntOn && maj;
    const nsMin = ['sayc', 'acol'].includes((x.sys || {}).k) ? 10 : 11;   // SAYC and Acol: a two-level new suit is 10+ (forcing one round)
    add(B(2, s), h => h.hcp >= (two1 ? 12 : ph ? 9 : nsMin) && (!ph || h.hcp <= 11) && h.len[s] >= need && h.len[s] >= Math.max(...[0, 1, 2, 3].filter(u => u !== os).map(u => h.len[u])),
      two1 ? { min: 12, len: { [s]: need }, cv: 'twoOverOne', t: '2/1: ' + need + '+ ' + SUIT[s] + ', 12+ HCP, game forcing', f: 1, gf: 1 } : ph ? { min: 9, max: 11, len: { [s]: need }, cv: 'fnt', t: 'Passed hand: ' + need + '+ ' + SUIT[s] + ', 9-11 HCP, not forcing' } : { min: nsMin, len: { [s]: need }, t: 'New suit: ' + need + '+ ' + SUIT[s] + ', ' + nsMin + '+ HCP', f: 1 });
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
  const raise = () => { if (cl <= 3) add(B(cl, os), h => h.len[os] >= need && h.sup(os) >= 6 && h.sup(os) <= 10, { min: 6, max: 10, len: { [os]: need }, t: 'Raise: 6-10 points' }); };
  if (maj) raise();
  for (const s of [3, 2]) if (s !== os && s !== obs && cheap(s) === 1) add(B(1, s), h => h.len[s] >= 5 && h.hcp >= 6, { min: 6, len: { [s]: 5 }, t: 'Natural: 5+ ' + SUIT[s] + ', 6+ HCP', f: 1 });
  if (LV(ob) <= 2 && obs < 4) {
    const um = [2, 3].filter(s => s !== os && s !== obs);
    if (um.length) add('X', h => h.hcp >= (LV(ob) === 1 ? 6 : 8) && um.some(s => h.len[s] >= 4), { min: 6, len: Object.fromEntries(um.map(s => [s, 4])), cv: 'nego', t: 'Negative double: four cards in the unbid major' });
  }
  if (!maj) raise();
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
    // our own 1NT opening: its range comes from the system (see shiftAdd)
    if (ol === 1 && x.opening && x.opening.call === B(1, 4) && sideOf(x.opening.seat) === sideOf(x.seat)) add = shiftAdd(add, x.ntShift, false);
    const off = ol - 1;
    if (rm.tag === 'pup') {
      add(B(3, 2), h => h.len[2] >= 5, { len: { 2: 5 }, cv: 'puppet', t: 'Puppet Stayman reply: five hearts' });
      add(B(3, 3), h => h.len[3] >= 5, { len: { 3: 5 }, cv: 'puppet', t: 'Puppet Stayman reply: five spades' });
      add(B(3, 1), h => h.len[2] >= 4 || h.len[3] >= 4, { tag: 'pupd', cv: 'puppet', t: 'Puppet Stayman reply: one or two 4-card majors, no five-card major', f: 1 });
      add(B(3, 4), () => true, { cv: 'puppet', t: 'Puppet Stayman reply: no 4-card major' });
      return true;
    }
    if (rm.tag === 'baron') {
      // up the line: the cheapest four-card suit; none (only spades over 2NT) → notrump
      for (const s of [0, 1, 2, 3]) { const c = B(ol === 1 ? 3 : 4, s); if (c > r && !(ol === 2 && s === 3)) add(c, h => h.len[s] >= 4 && [0, 1, 2, 3].filter(u => u < s).every(u => h.len[u] < 4), { len: { [s]: 4 }, tag: 'baronans', cv: 'baron', f: 1, t: 'Baron: my cheapest four-card suit is ' + SUIT[s] }); }
      add(B(3, 4), () => true, { tag: 'baronans', cv: 'baron', t: 'Baron: no four-card suit to show' });
      return true;
    }
    if (rm.tag === 'stay') {
      add(B(2 + off, 2), h => h.len[2] >= 4, { len: { 2: 4 }, cv: 'stayman', t: 'Stayman reply: four hearts' });
      add(B(2 + off, 3), h => h.len[3] >= 4, { len: { 3: 4 }, cv: 'stayman', t: 'Stayman reply: four spades, not four hearts' });
      add(B(2 + off, 1), () => true, { cv: 'stayman', t: 'Stayman reply: no 4-card major' });
      return true;
    }
    if (rm.tag === 'tr') {
      const M = r === B(2 + off, 1) ? 2 : 3;
      // super-accept: four-card support and a maximum
      if (ol === 1) add(B(3, M), h => h.len[M] >= 4 && h.hcp >= 17, { tag: 'trc', min: 17, max: 17, len: { [M]: 4 }, cv: 'jtr', t: 'Super-accept: four ' + SUIT[M] + ' and a maximum' });
      add(B(2 + off, M), () => true, { tag: 'trc', cv: 'jtr', t: 'Completing the transfer to ' + SUIT[M] });
      return true;
    }
    if (rm.tag === 'q') { add(B(6, 4), h => h.hcp >= (ol === 1 ? 17 : 21), { t: 'Accepting the invitation' }); add('P', () => true, { t: 'Minimum: declining' }); return true; }
    if (r === B(2, 4) && ol === 1 && !rm.tag) { add(B(3, 4), h => h.hcp >= 16, { min: 16, t: 'Maximum: accepting the invitation' }); add('P', () => true, { max: 15, t: 'Minimum' }); return true; }
    if (r === B(3, 4) || (r >= B(4, 3) && !rm.tag)) { add('P', () => true, { t: 'Pass' }); return true; }
    return false;
  }
  if (o === B(2, 0) && r === B(2, 1) && strong2(x.opening) && x.C.kokish) {
    // Kokish: 2♥ = hearts or a balanced 22-24 (partner relays 2♠); spades and the minors stay natural
    const sp = h => h.longest === 3 || (h.len[3] >= 5 && h.len[3] >= h.len[h.longest] && h.len[3] > h.len[2]);
    add(B(3, 4), h => h.bal && h.hcp >= 25, { min: 25, max: 27, t: 'Balanced 25-27 HCP' });
    add(B(2, 3), h => !(h.bal && h.hcp <= 24) && sp(h), { min: 22, len: { 3: 5 }, t: '5+ ♠, forcing (3♣ by partner = second negative)', f: 1 });
    add(B(2, 2), h => (h.bal && h.hcp <= 24) || h.longest === 2 || (h.len[2] >= 5 && h.len[2] >= h.len[h.longest]), { min: 22, tag: 'kok', cv: 'kokish', f: 1, t: 'Kokish 2♥: hearts, or balanced 22-24 (partner bids 2♠)' });
    add(B(3, 4), h => h.bal && h.hcp >= 25, { min: 25, max: 27, t: 'Balanced 25-27 HCP' });
    for (const s of [0, 1]) add(B(3, s), h => h.longest === s, { min: 22, len: { [s]: 5 }, t: '5+ ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
    return true;
  }
  if (o === B(2, 0) && r === B(2, 1) && strong2(x.opening)) {
    add(B(2, 4), h => h.bal && h.hcp <= 24, { min: 22, max: 24, t: 'Balanced 22-24 HCP' });
    add(B(3, 4), h => h.bal && h.hcp >= 25, { min: 25, max: 27, t: 'Balanced 25-27 HCP' });
    for (const s of [3, 2]) add(B(2, s), h => h.longest === s || (h.len[s] >= 5 && h.len[s] >= h.len[h.longest]), { min: 22, len: { [s]: 5 }, t: '5+ ' + SUIT[s] + ', forcing (3♣ by partner = second negative)', f: 1 });
    for (const s of [0, 1]) add(B(3, s), h => h.longest === s, { min: 22, len: { [s]: 5 }, t: '5+ ' + SUIT[s] + ', game forcing', f: 1, gf: 1 });
    return true;
  }
  if (ol !== 1 || os === 4) return false;
  // strong club after the 1♦ reply: the opener describes the hand (Polish: first the 12-14 balanced type)
  const ctag = x.opening && x.opening.m && x.opening.m.tag;
  if (o === B(1, 0) && rm.tag === 'neg' && (ctag === 'sclub' || ctag === 'pclub')) {
    const pol = ctag === 'pclub', st = pol ? 18 : 16;
    if (pol) {
      add(B(1, 4), h => h.bal && h.hcp <= 14, { min: 12, max: 14, cv: 'sys', t: 'Polish 1♣: the 12-14 balanced type' });
      add(B(2, 0), h => h.hcp <= 17 && h.len[0] >= 5, { min: 15, max: 17, len: { 0: 5 }, cv: 'sys', t: 'Polish 1♣: 15-17 with long clubs' });
      for (const s of [3, 2]) add(B(1, s), h => h.hcp <= 17 && h.len[s] >= 4, { min: 12, max: 17, len: { [s]: 4 }, t: '4+ ' + SUIT[s] + ', not strong' });
      add(B(2, 4), h => h.bal && h.hcp >= 18, { min: 18, max: 20, cv: 'sys', t: 'Strong: 18-20 balanced' });
    } else {
      add(B(1, 4), h => h.bal && h.hcp <= 18, { min: 16, max: 18, cv: 'sys', t: 'Precision: 16-18 balanced' });
      add(B(2, 4), h => h.bal && h.hcp >= 19, { min: 19, max: 21, cv: 'sys', t: 'Precision: 19-21 balanced' });
    }
    for (const s of [3, 2]) add(B(1, s), h => h.len[s] >= 5 || (h.len[s] >= 4 && !h.bal), { min: st, len: { [s]: 5 }, f: 1, t: '5+ ' + SUIT[s] + ', strong' });
    add(B(2, 1), h => h.len[1] >= 5, { min: st, len: { 1: 5 }, f: 1, t: '5+ ♦, strong' });
    add(B(2, 0), h => h.len[0] >= 5, { min: st, len: { 0: 5 }, f: 1, t: '5+ ♣, strong' });
    add(B(1, 4), () => true, { min: st, t: 'Strong hand' });
    return true;
  }
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
    const sides = [0, 1, 2, 3].filter(s => s !== os);
    // 4 of a new suit: a good five-card side suit
    for (const s of sides) if (s < os) add(B(4, s), h => h.len[s] >= 5 && h.top5(s) >= 2 && h.hcp >= 12, { min: 12, len: { [s]: 5 }, tag: 'j2r', cv: 'j2nt', t: 'Jacoby 2NT reply: a good five-card ' + SUIT[s] + ' side suit', f: 1 });
    // 3 of a new suit: singleton or void there
    for (const s of sides) add(B(3, s), h => h.len[s] <= 1, { len: { [os]: 5 }, tag: 'j2r', cv: 'j2nt', t: 'Jacoby 2NT reply: singleton or void in ' + SUIT[s], f: 1 });
    add(B(3, os), h => h.hcp >= 18, { min: 18, tag: 'j2r', cv: 'j2nt', t: 'Jacoby 2NT reply: 18+, no shortness, slam interest', f: 1 });
    add(B(3, 4), h => h.hcp >= 15, { min: 15, max: 17, tag: 'j2r', cv: 'j2nt', t: 'Jacoby 2NT reply: 15-17, no shortness', f: 1 });
    add(B(4, os), () => true, { min: 12, max: 14, cv: 'j2nt', t: 'Jacoby 2NT reply: minimum, no shortness' });
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
    // jump shift: 19+ with a second suit, forcing to game
    for (const s of [0, 1, 2, 3]) {
      if (s === os || s === rs) continue; const l = (B(1, s) > r ? 1 : 2) + 1;
      if (l <= 3) add(B(l, s), h => h.len[s] >= 4 && h.hcp >= 19 && !h.bal && h.len[os] >= 5 && !(rs >= 2 && h.len[rs] >= 4), { min: 19, len: { [s]: 4 }, t: 'Jump shift: 4+ ' + SUIT[s] + ', 19+ HCP, game forcing', f: 1, gf: 1 });
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
    // Gazilli (after 1♥/1♠–1NT): 2♣ = a natural minimum with clubs, or any strong hand (16+) — every 2♣ carries it
    if (x.C.gazilli && os >= 2) {
      const add0 = add;
      add = (c, t, m) => add0(c, t, c === B(2, 0) ? { ...m, max: undefined, tag: 'gaz', cv: 'gazilli', f: 1, t: 'Gazilli 2♣: ' + (m.t || '') + ' (or any 16+ hand)' } : m);
      add(B(2, 0), h => h.hcp >= 16 && !(h.bal && h.hcp >= 20) && !(h.len[os] >= 6 && h.tp >= 19), { min: 16, t: 'a strong hand, 16+' });
    }
    // a strong opener (19+): a jump in a second suit forces to game; six cards in the major opened: game; balanced 20-21: 3NT
    // (1♠–1NT with ♠AKJT7 ♥75 ♦AQT7 ♣AK: 3♦, not pass or a minimum 2♦)
    for (const s of [0, 1, 2, 3]) if (s !== os) add(B(3, s), h => h.len[s] >= 4 && h.hcp >= 19 && h.len[os] >= 5, { min: 19, len: { [s]: 4 }, t: 'Jump shift: 4+ ' + SUIT[s] + ', 19+ HCP, game forcing', f: 1, gf: 1 });
    if (os >= 2) add(B(4, os), h => h.len[os] >= 6 && h.tp >= 19, { min: 18, len: { [os]: 6 }, t: 'Game: 6+ ' + SUIT[os] + ', 19+ points' });
    add(B(3, 4), h => h.bal && h.hcp >= 20, { min: 20, max: 21, t: 'Balanced 20-21: game' });
    add(B(2, 4), h => h.bal && h.hcp >= 18, { min: 18, max: 19, t: 'Balanced 18-19, invitational' });
    add(B(3, os), h => h.len[os] >= 6 && h.tp >= 16, { min: 16, len: { [os]: 6 }, t: '6+ ' + SUIT[os] + ', invitational' });
    add(B(2, os), h => h.len[os] >= 6, { len: { [os]: 6 }, t: '6+ ' + SUIT[os] });
    for (let s = 0; s < os; s++) add(B(2, s), h => h.len[s] >= 4 && h.hcp <= 18, { min: 11, max: 18, len: { [s]: 4 }, t: 'Second suit: 4+ ' + SUIT[s] });
    for (let s = os + 1; s <= 3; s++) add(B(2, s), h => h.len[s] >= 4 && h.hcp >= 17, { min: 17, len: { [s]: 4 }, t: 'Reverse: 17+ HCP', f: 1 });
    if (forcing) {
      for (const s of [0, 1]) if (s !== os) add(B(2, s), h => h.len[s] >= 3, { min: 11, max: 17, len: { [s]: 3 }, cv: 'fnt', t: 'Forcing 1NT reply: 3+ ' + SUIT[s] });
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
  const gf = x.auc.some(e => sideOf(e.seat) === sideOf(me) && e.m && e.m.gf) && !x.auc.some(e => e.m && e.m.tag === '2neg');
  let majorFit = -1, minorFit = -1, mfl = 0, nfl = 0;
  for (const s of [3, 2]) { const t = h.len[s] + P.len[s]; if (t >= 8 && t > mfl) { majorFit = s; mfl = t; } }
  for (const s of [1, 0]) { const t = h.len[s] + P.len[s]; if (t >= 8 && t > nfl) { minorFit = s; nfl = t; } }
  // partner's natural notrump (an opening, or a rebid after an earlier call) shows a balanced hand, so two or more in
  // every suit: a six-card major of mine is an eight-card fit (1♦–1♥–1NT with ♥KQT643: 4♥, not 3NT)
  const pCalls = x.pa.filter(e => e.call !== 'P');
  const pNatNT = pCalls.some((e, i) => isNum(e.call) && ST(e.call) === 4 && !(e.m && e.m.tag && !['nt1', 'nt2'].includes(e.m.tag)) && (i > 0 || !x.auc.slice(0, x.auc.indexOf(e)).some(a => a.call !== 'P')));
  if (majorFit < 0 && pNatNT) for (const s of [3, 2]) { const t = h.len[s] + Math.max(2, P.len[s]); if (h.len[s] >= 6 && t > mfl) { majorFit = s; mfl = t; } }
  const oppStops = x.oppSuits.every(s => h.stop(s));
  const pBidNT = x.pa.some(e => isNum(e.call) && ST(e.call) === 4);
  let t;
  // no major fit, but a solid six-card major of my own (four of the top five honours): it is trumps, not a minor fit
  // (♠AKQJT6 ♥– ♦75 ♣KJT73 after 1♦–1♠–2♦: spades, not 5♦)
  const solidM = [3, 2].find(s => h.len[s] >= 6 && h.top5(s) >= 4);
  // partner invited the game in his minor (four of it, after notrump too): with a fit that minor is the strain
  const pInvL = x.pa.filter(e => e.call !== 'P').pop(), pInvS = pInvL && pInvL.m && /^Invitation: game is 5/.test(pInvL.m.t || '') && isNum(pInvL.call) ? ST(pInvL.call) : -1;
  if (majorFit >= 0) t = majorFit;
  else if (pInvS >= 0 && pInvS < 2 && h.len[pInvS] + P.len[pInvS] >= 8) t = pInvS;
  else if (solidM != null) t = solidM;
  else if ((pBidNT && oppStops) || ((h.bal || h.semi) && oppStops && minorFit < 0)) t = 4;
  else if (minorFit >= 0) t = minorFit;
  else {
    const ls = h.longest;
    if (h.len[ls] >= 6) t = ls;
    else {
      // no stopper in their suit: a suit partner has shown four of (with three of mine) before notrump
      let ps = -1; for (let s = 0; s < 4; s++) if (P.len[s] >= 6 && h.len[s] >= 2) ps = s;
      const oppShown = s => x.oppSuits.includes(s) || x.auc.some(e => sideOf(e.seat) !== sideOf(me) && e.m && e.m.len && e.m.len[s] >= 4);
      if (ps < 0 && !oppStops && !pBidNT && h.len[ls] < 5) for (let s = 0; s < 4; s++) if (!oppShown(s) && P.len[s] >= 4 && h.len[s] >= 3 && (ps < 0 || h.len[s] + P.len[s] > h.len[ps] + P.len[ps])) ps = s;
      if (ps >= 0) t = ps; else if (oppStops && !x.oppSuits.includes(ls)) t = 4; else t = h.len[ls] >= 5 ? ls : 4; }
  }
  const fitLen = t < 4 ? h.len[t] + P.len[t] : 0;
  const pEst = P.min + Math.min(2, Math.floor((P.max - P.min) / 2));
  const my = (t < 4 ? h.sup(t) : h.hcp) + x.agg;
  let est = my + pEst, lo = my + P.min; const hi = my + P.max;
  if (gf) { est = Math.max(est, 25); lo = Math.max(lo, 25); }
  const gameL = t === 4 ? 3 : t >= 2 ? 4 : 5;
  let goal;
  if (est >= 37 && lo >= 35) goal = 7;
  // a game force with a fit and two aces: a little less is enough to look for slam (1♠–2♦–3♦ with 17 and three aces)
  // an eight-card fit and about 32 between us: look for slam (key cards first, so a missing pair of them stops at five)
  // (2NT–3♣–3♥ with ♥K843 and 10: 4NT, not 4♥)
  else if (est >= 33 || (gf && fitLen >= 8 && est >= 31 && h.aces >= 2) || (t < 4 && fitLen >= 8 && est >= 32)) goal = 6;
  else if (t < 2) {
    goal = est >= 29 ? 5 : (est >= 26 ? 4 : 0);
    // 3NT instead of a minor game only without a singleton or void in a suit our side has not bid (1♦–1♥–3♦ with ♠T and
    // 7 HCP: not 3NT, the spades run against it)
    const ourSuits = new Set(x.auc.filter(e => sideOf(e.seat) === sideOf(me) && isNum(e.call) && ST(e.call) < 4).map(e => ST(e.call)));
    const unbidShort = [0, 1, 2, 3].some(s => !ourSuits.has(s) && h.len[s] <= 1);
    // partner invited the minor game (four of the minor): a fit and a little more than a minimum accept it
    // (1♠–1NT–2♥–4♣ with 17 and ♣T7: 5♣)
    if (pInvS === t && fitLen >= 8 && est >= 27 && goal < 5) goal = 5;
    if (minorFit >= 0 && est >= 25 && oppStops && est < 29 && !unbidShort && pInvS !== t) { t = 4; goal = 3; }
  }
  else if (lo >= 25 || est >= 26) goal = gameL;
  else if (hi >= 25 && est >= 23) goal = -1;
  else goal = 0;
  const cheapest = s => last < 0 ? 1 : (ST(last) < s ? LV(last) : LV(last) + 1);
  const cl = cheapest(t);
  // no known fit and only a five-card suit: invite, do not jump to game in it (1♦–1♠–1NT with ♠AKQ84 and 13: not 4♠)
  const shortTrump = t < 4 && h.len[t] <= 5 && fitLen < 8 && !gf;
  if (shortTrump && goal >= 3 && goal < 6) goal = -1;
  const ourLast = st.lastSeat >= 0 && sideOf(st.lastSeat) === sideOf(me);
  // four of a minor is not game: in our own game-forcing auction (they have not bid, partner has not bid a game) the
  // minor game is five
  if (t < 2 && goal === 4 && !x.oppSuits.length && gf && !(st.lastSeat === x.p && last >= B(4, 2))) goal = 5;
  const bwUsed = x.auc.some(e => sideOf(e.seat) === sideOf(me) && e.m && ['bw', 'q', 'gerb'].includes(e.m.tag));
  const range = { min: Math.max(0, h.hcp - 1), max: h.hcp + 2 };
  const lenm = t < 4 ? { [t]: Math.min(h.len[t], 6) } : undefined;
  let call = null, m = {};
  // partner chose 3NT: respect it unless we have slam values or a known 8-card major fit
  if (last === B(3, 4) && st.lastSeat === x.p && st.dbl === 0 && goal < 6 && !(t >= 2 && t < 4 && fitLen >= 8) && !(t < 4 && h.len[t] >= 7)) return { call: 'P', m: { t: 'Accepting partner\'s 3NT' } };
  // slam values but no trump agreed yet (partner has not shown three of it, and we have not bid it naturally): name it
  // first, below game, so partner's key-card answer is about the right suit (2♣–2♠ with ♣AKQJT3: 3♣, not 4NT)
  // (only in a game-forcing auction, with a strong suit of six or more of our own and partner showing another five-card suit)
  const agreed = t < 4 && (P.len[t] >= 3 || x.my.some(e => e.m && e.m.len && e.m.len[t] >= 4));
  const ownSuit = t < 4 && gf && h.len[t] >= 6 && h.top5(t) >= 3 && [0, 1, 2, 3].some(s => s !== t && P.len[s] >= 5);
  if (goal >= 6 && ownSuit && !agreed && !bwUsed && cl <= 4 && B(cl, t) < B(4, 4)) { call = B(cl, t); m = { t: 'Natural: ' + SUIT[t] + ' suit, slam interest', ...range, len: lenm, f: 1 }; }
  // partner opened a strong 2♣ and named his minor: he is the captain, so raise it below 4NT and let him ask for key
  // cards (2♣–2♠–3♣ with ♣42 and 9 HCP: 4♣, not 6♣; partner then finds the grand)
  const pStrong = x.opening && x.opening.seat === x.p && x.opening.m && x.opening.m.cv === 'strong2c';
  if (goal >= 6 && call === null && pStrong && t < 2 && st.lastSeat === x.p && ST(last) === t && P.len[t] >= 5 && h.len[t] >= 2 && !bwUsed && cl <= 4) {
    call = B(cl, t); m = { t: 'Support for ' + SUIT[t] + ': slam interest, partner asks', ...range, len: { [t]: 2 }, f: 1 };
  }
  if (goal >= 6 && call === null && !bwUsed && t < 4 && fitLen >= 8) {
    // Voidwood: a void in a lower suit our side has not bid, a jump to five of it (below five of the trumps, so a
    // missing pair of key cards still stops there)
    const ours = new Set(x.auc.filter(e => sideOf(e.seat) === sideOf(me) && isNum(e.call) && ST(e.call) < 4).map(e => ST(e.call)));
    const vd = x.C.voidwood ? [0, 1, 2, 3].find(v => v < t && h.len[v] === 0 && !ours.has(v) && last < B(4, v)) : undefined;
    if (vd != null) { call = B(5, vd); m = { tag: 'bw', trump: t, void: vd, rkc: 1, cv: 'voidwood', f: 1, t: 'Voidwood: a void in ' + SUIT[vd] + ', asking for key cards outside it (trumps ' + SUIT[t] + ')' }; }
    // Minorwood: four of the agreed minor asks for key cards (4NT would leave no room to stop in five)
    else if (x.C.minorwood && t < 2 && last < B(4, t)) { call = B(4, t); m = { tag: 'bw', trump: t, rkc: 1, cv: 'minorwood', f: 1, t: 'Minorwood: asking for key cards (trumps ' + SUIT[t] + ')' }; }
  }
  if (goal >= 6 && call === null) {
    if (!bwUsed && last < B(4, 4) && t < 4 && (t !== 0 || h.aces >= 2)) { call = B(4, 4); m = { tag: 'bw', trump: t, rkc: x.C.rkc0314 ? 2 : x.C.rkc ? 1 : 0, cv: x.C.rkc0314 ? 'rkc0314' : x.C.rkc ? 'rkc' : 'bw', t: x.C.rkc0314 || x.C.rkc ? (x.C.rkc0314 ? 'RKCB 0314' : 'RKCB 1430') + ': asking for key cards (trumps ' + SUIT[t] + ')' : 'Blackwood: how many aces?', ...range }; }
    else if (B(goal, t) > last) { call = B(goal, t); m = { t: (goal === 7 ? 'Grand' : 'Small') + ' slam', ...range, len: lenm }; }
  }
  if (call === null && goal >= 3 && goal < 6 && cl <= goal) { call = B(goal, t); m = { t: t < 2 && goal === 4 ? 'Invitation: game is 5' + SUIT[t] : 'Game contract', ...range, len: lenm }; }
  if (call === null && goal === -1) {
    if (cl <= gameL - 1) { call = B(gameL - 1, t); m = { t: 'Game invitation', ...range, len: lenm }; }
    else if (cl <= gameL && est >= 24 && !shortTrump) { call = B(gameL, t); m = { t: 'Game contract', ...range, len: lenm }; }
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
  const r = generic(x, h);
  // a call the explanations read more narrowly (responder's invitational 2NT after a one-level reply: 11-12) carries
  // that meaning, so partner reads a robot's call as a player's (1♣–1♦–1♠–2NT: opener with 12 passes, both times)
  if (r.call === B(2, 4)) { const em = explainCall(auc, seat, r.call, cards); if (em && em.min != null && em.max != null) return { call: r.call, m: em }; }
  return r;
}
function explainCall(auc, seat, call, cards) {
  const x = ctxOf(auc, seat, cards);
  const known = cands(x).find(c => c.call === call);
  // 4♣ right after partner's natural 1NT, 2NT or 3NT, no suit agreed: asks for aces, on any card, in any
  // sequence (1♣–1♥–2NT–3NT–4♣). The robots only answer it: they start Gerber in the cases cands() lists
  if (call === B(4, 0) && !(known && (known.m.tag || known.m.cv))) {   // a convention of the list keeps its meaning; a plain natural 4♣ does not
    const ours = auc.filter(e => sideOf(e.seat) === sideOf(seat) && isNum(e.call)), pl = ours.filter(e => e.seat !== seat), last = pl[pl.length - 1];
    const natural = e => ST(e.call) < 4 && !(e.m && (e.m.cv || e.m.tag === 'trm' || e.m.tag === 'splinter' || e.m.tag === 'drury'));
    const agreed = ours.some(a => a.seat === seat && natural(a) && pl.some(b => natural(b) && ST(b.call) === ST(a.call)));
    if (last && last === auc[auc.length - 2] && ST(last.call) === 4 && LV(last.call) <= 3 && !(last.m && last.m.cv && !['leb', 'nt1', 'nt2'].includes(last.m.cv)) && !agreed) return { tag: 'gerb', cv: 'gerber', t: 'Gerber: asking for aces (slam interest)' };
  }
  // Minorwood / Voidwood by a player: four of our agreed minor, or a jump to five of an unbid lower suit, asks for key cards
  if (isNum(call) && !(known && (known.m.tag || known.m.cv)) && (x.C.minorwood || x.C.voidwood)) {
    const ours = auc.filter(e => sideOf(e.seat) === sideOf(seat) && isNum(e.call) && ST(e.call) < 4);
    const both = s => ours.some(e => e.seat === seat && ST(e.call) === s) && ours.some(e => e.seat !== seat && ST(e.call) === s);
    const asked = auc.some(e => sideOf(e.seat) === sideOf(seat) && e.m && ['bw', 'gerb', 'q'].includes(e.m.tag)), last = x.st.last;
    const t = [3, 2, 1, 0].find(both);
    if (!asked && t != null) {
      if (x.C.minorwood && t < 2 && call === B(4, t)) return { tag: 'bw', trump: t, rkc: 1, cv: 'minorwood', f: 1, t: 'Minorwood: asking for key cards (trumps ' + SUIT[t] + ')' };
      const v = ST(call);
      if (x.C.voidwood && LV(call) === 5 && v < t && !ours.some(e => ST(e.call) === v) && last < B(4, v)) return { tag: 'bw', trump: t, void: v, rkc: 1, cv: 'voidwood', f: 1, t: 'Voidwood: a void in ' + SUIT[v] + ', asking for key cards outside it (trumps ' + SUIT[t] + ')' };
    }
  }
  if (known) return known.m;
  if (call === 'P') return { t: 'Pass' };
  // 4NT after our side has bid a suit (and not notrump last) asks for key cards, whoever bids it
  if (call === B(4, 4)) {
    const ours = auc.filter(e => sideOf(e.seat) === sideOf(seat) && isNum(e.call));
    const lastOur = ours[ours.length - 1];
    if (lastOur && ST(lastOur.call) < 4 && !ours.some(e => e.m && ['bw', 'gerb'].includes(e.m.tag))) {
      const P = pInfo(x), mine = [0, 0, 0, 0], pl = [0, 0, 0, 0];
      ours.forEach(e => { if (ST(e.call) < 4 && !(e.m && (e.m.cv === 'jtr' || e.m.cv === 'stayman' || e.m.cv === 'puppet' || e.m.tag === 'texas' || e.m.tag === 'trm' || e.m.tag === 'bergen7' || e.m.tag === 'bergen10' || e.m.tag === 'splinter' || e.m.tag === 'drury'))) (e.seat === seat ? mine : pl)[ST(e.call)]++; });
      let t = -1; for (const s of [3, 2, 1, 0]) if (mine[s] && pl[s]) { t = s; break; }
      // partner has just bid game in a suit (1NT–2♦–2♥–3♦–4♥–4NT): that suit is agreed, 4NT asks for key cards in it
      if (t < 0 && lastOur.seat !== seat && LV(lastOur.call) >= 4) t = ST(lastOur.call);
      if (t < 0 && ours.some(e => ST(e.call) === 4 && e.m && (e.m.tag === 'nt1' || e.m.tag === 'nt2'))) return { tag: 'q', cv: 'q', min: 16, t: 'Quantitative 4NT: slam invitation' };
      if (t < 0) for (let s = 0; s < 4; s++) if (P.len[s] >= 4 && (t < 0 || P.len[s] > P.len[t])) t = s;
      if (t < 0) t = ST(lastOur.call);
      return { tag: 'bw', trump: t, rkc: x.C.rkc0314 ? 2 : x.C.rkc ? 1 : 0, cv: x.C.rkc0314 ? 'rkc0314' : x.C.rkc ? 'rkc' : 'bw', t: x.C.rkc0314 || x.C.rkc ? (x.C.rkc0314 ? 'RKCB 0314' : 'RKCB 1430') + ': asking for key cards (trumps ' + SUIT[t] + ')' : 'Blackwood: how many aces?' };
    }
  }
  if (call === 'X') return { t: 'Double' };
  if (call === 'XX') return { t: 'Redouble' };
  // responder's 2NT after a one-level reply and opener's rebid (the other side silent): natural and invitational, so
  // opener with the top of a minimum goes on to 3NT (1♣–1♠–2♣–2NT with 15 HCP: 3NT)
  if (call === B(2, 4)) {
    const my = auc.filter(e => e.seat === seat && e.call !== 'P'), pa = auc.filter(e => e.seat === (seat + 2) % 4 && e.call !== 'P');
    if (my.length === 1 && isNum(my[0].call) && LV(my[0].call) === 1 && ST(my[0].call) < 4 && pa.length === 2 && isNum(pa[0].call) && LV(pa[0].call) === 1
      && !auc.some(e => sideOf(e.seat) !== sideOf(seat) && e.call !== 'P')) return { min: 11, max: 12, t: 'Invitational: 11-12 HCP, balanced' };
  }
  const s = ST(call);
  return s === 4 ? { t: 'Natural notrump' } : { t: 'Natural: ' + SUIT[s] + ' suit', len: { [s]: 4 } };
}

Object.assign(E, { ctxOf, pInfo, cands, generic, aiBid, explainCall, see: d => { SEE = d || null; } });
});
