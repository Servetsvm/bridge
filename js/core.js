/* Bridge Table — core: constants, auction helpers, hand evaluation, scoring, convention card.
   Engine modules push themselves into window.BRIDGE; the page and the background worker run the same code. */
(window.BRIDGE = window.BRIDGE || []).push(function core(E) {
'use strict';
const SUIT = ['♣', '♦', '♥', '♠'], STR = ['♣', '♦', '♥', '♠', 'NT'];
const RTXT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SEAT = ['North', 'East', 'South', 'West'];
const S = c => (c / 13) | 0, R = c => c % 13, pd = s => (s + 2) % 4, sideOf = s => s & 1;
const B = (l, s) => (l - 1) * 5 + s, LV = b => ((b / 5) | 0) + 1, ST = b => b % 5;
const isNum = c => typeof c === 'number';
const VULT = [0, 1, 2, 3, 1, 2, 3, 0, 2, 3, 0, 1, 3, 0, 1, 2];
const vulOf = (board, seat) => { const v = VULT[(board - 1) % 16]; return v === 3 || (v === 1 && sideOf(seat) === 0) || (v === 2 && sideOf(seat) === 1); };
const dealerOf = b => (b - 1) % 4;
const callTxt = c => c === 'P' ? 'Pass' : c === 'X' ? 'X' : c === 'XX' ? 'XX' : LV(c) + STR[ST(c)];
const popc = x => { let n = 0; while (x) { x &= x - 1; n++; } return n; };
/* random numbers; tests can fix the sequence with E.seed(n) so two versions see the same luck */
let SEED = null;
function seed(n) { SEED = n == null ? null : (n >>> 0) || 1; }
function rnd(n) {
  if (SEED !== null) { SEED ^= SEED << 13; SEED >>>= 0; SEED ^= SEED >>> 17; SEED ^= SEED << 5; SEED >>>= 0; return SEED % n; }
  const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/* order-independent fingerprint of a deal (who holds which card) */
function dealKey(deal) { const o = new Array(52); deal.forEach((h, s) => h.forEach(c => { o[c] = s; })); let k = ''; for (let i = 0; i < 52; i += 3) k += String.fromCharCode(65 + o[i] * 16 + (o[i + 1] ?? 0) * 4 + (o[i + 2] ?? 0)); return k; }

/* ---- auction ---- */
function aState(auc) { let last = -1, lastSeat = -1, dbl = 0; for (const e of auc) { if (isNum(e.call)) { last = e.call; lastSeat = e.seat; dbl = 0; } else if (e.call === 'X') dbl = 1; else if (e.call === 'XX') dbl = 2; } return { last, lastSeat, dbl }; }
function legalCalls(auc, seat) {
  const st = aState(auc), o = ['P'];
  if (st.last >= 0 && st.dbl === 0 && sideOf(st.lastSeat) !== sideOf(seat)) o.push('X');
  if (st.last >= 0 && st.dbl === 1 && sideOf(st.lastSeat) === sideOf(seat)) o.push('XX');
  for (let b = st.last + 1; b < 35; b++) o.push(b);
  return o;
}
const isLegal = (auc, seat, c) => legalCalls(auc, seat).includes(c);
const auctionOver = auc => auc.length >= 4 && auc.slice(-3).every(e => e.call === 'P');
function contractOf(auc) {
  const st = aState(auc); if (st.last < 0) return null;
  const t = ST(st.last), sd = sideOf(st.lastSeat);
  const decl = auc.find(e => isNum(e.call) && ST(e.call) === t && sideOf(e.seat) === sd).seat;
  return { level: LV(st.last), strain: t, dbl: st.dbl, decl };
}

/* ---- hand evaluation ---- */
function ev(cards) {
  const len = [0, 0, 0, 0], rk = [[], [], [], []]; let hcp = 0;
  for (const c of cards) { const s = S(c), r = R(c); len[s]++; rk[s].push(r); if (r >= 9) hcp += r - 8; }
  rk.forEach(a => a.sort((x, y) => y - x));
  const pat = [...len].sort((a, b) => b - a).join('');
  const bal = ['4333', '4432', '5332'].includes(pat);
  const semi = bal || ['5422', '6322'].includes(pat);
  const lp = len.reduce((a, l) => a + Math.max(0, l - 4), 0);
  const top5 = s => rk[s].filter(r => r >= 8).length;
  const has = (s, r) => rk[s].includes(r);
  const stop = s => { const r = rk[s], l = len[s]; return r.includes(12) || (r.includes(11) && l >= 2) || (r.includes(10) && l >= 3) || (r.includes(9) && l >= 4); };
  const sup = t => { const L = len[t]; if (L < 3) return hcp + lp; let p = hcp; for (let s = 0; s < 4; s++) { if (s === t) continue; const l = len[s]; p += L >= 4 ? (l === 0 ? 5 : l === 1 ? 3 : l === 2 ? 1 : 0) : (l === 0 ? 3 : l === 1 ? 2 : l === 2 ? 1 : 0); } return p; };
  const aces = rk.reduce((a, r) => a + (r[0] === 12 ? 1 : 0), 0);
  const kc = t => aces + (t >= 0 && t < 4 && has(t, 11) ? 1 : 0);
  let longest = 3; for (let s = 3; s >= 0; s--) if (len[s] > len[longest]) longest = s;
  return { len, rk, hcp, pat, bal, semi, lp, tp: hcp + lp, top5, has, stop, sup, aces, kc, longest };
}

/* ---- scoring ---- */
function scoreOf(level, strain, dbl, vul, tricks) {
  const need = level + 6;
  if (tricks >= need) {
    const per = strain < 2 ? 20 : 30, mult = dbl === 2 ? 4 : dbl === 1 ? 2 : 1;
    const tp = (per * level + (strain === 4 ? 10 : 0)) * mult;
    let s = tp + (tp >= 100 ? (vul ? 500 : 300) : 50);
    if (level === 6) s += vul ? 750 : 500;
    if (level === 7) s += vul ? 1500 : 1000;
    if (dbl) s += dbl === 2 ? 100 : 50;
    const over = tricks - need;
    s += dbl === 0 ? over * per : over * (vul ? 200 : 100) * (dbl === 2 ? 2 : 1);
    return s;
  }
  const d = need - tricks; let s;
  if (!dbl) s = d * (vul ? 100 : 50);
  else { s = vul ? 200 + (d - 1) * 300 : (d === 1 ? 100 : d === 2 ? 300 : 500 + (d - 3) * 300); if (dbl === 2) s *= 2; }
  return -s;
}
const IMPT = [20, 50, 90, 130, 170, 220, 270, 320, 370, 430, 500, 600, 750, 900, 1100, 1300, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000];
const imps = d => { const a = Math.abs(d); let i = 0; while (i < IMPT.length && a >= IMPT[i]) i++; return d < 0 ? -i : i; };
/* one result (from the player's side) against the field (same side): average cross-IMPs and matchpoint % */
function compare(us, field) {
  if (!field.length) return null;
  let imp = 0, mp = 0;
  for (const f of field) { imp += imps(us - f); mp += us > f ? 2 : us === f ? 1 : 0; }
  return { imp: Math.round(imp / field.length * 10) / 10, mp: Math.round(mp / (2 * field.length) * 1000) / 10 };
}

/* ---- convention card ---- */
const CONVS = [
  { k: 'twoOverOne', n: '2/1 Game Force', d: 'Over a 1♥/1♠ (or minor) opening, an unpassed responder\'s new suit at the two level is forcing to game (12+ HCP). 1NT over a major opening is forcing for one round (6-12 HCP).' },
  { k: 'rkc', n: 'RKCB 1430', d: '4NT asks for five key cards (four aces + trump king). 5♣ = 1 or 4, 5♦ = 3 or 0, 5♥ = 2 without the trump queen, 5♠ = 2 with the trump queen.' },
  { k: 'gerber', n: 'Gerber', d: 'Directly over 1NT/2NT, 4♣ asks for aces. 4♦ = 0 or 4, 4♥ = 1, 4♠ = 2, 4NT = 3. The asker can sign off in 4NT.' },
  { k: 'bergen', n: 'Bergen Raises', d: 'Over 1♥/1♠: 3♣ = 4-card support, 7-9 points; 3♦ = 4-card support, 10-12 (limit); 3 of the major = 4-card support, 0-6 (preemptive). A single raise shows 3-card support.' },
  { k: 'capp', n: 'Cappelletti', d: 'Over the opponents\' 1NT: X = penalty (15+), 2♣ = a one-suiter (6+), 2♦ = both majors, 2♥ = hearts + a minor, 2♠ = spades + a minor, 2NT = both minors (5-5).' },
  { k: 'j2nt', n: 'Jacoby 2NT', d: '2NT over a major opening = 4+ card support, 13+ points, game forcing. Opener signs off in 4 of the major with a minimum or bids 3 of the major with extras.' },
  { k: 'wjs', n: 'Weak Jump Shifts', d: 'A single jump in a new suit by responder (e.g. 1♦–2♠) shows a 6+ card suit and a weak hand (0-5 HCP). It is to play; opener usually passes.' },
  { k: 'stayman', n: 'Stayman', d: '2♣ over 1NT (3♣ over 2NT) asks for a 4-card major. Replies: ♦ = no 4-card major, ♥ = four hearts, ♠ = four spades and not four hearts.' },
  { k: 'fourWay', n: '4-Way Transfers', d: 'Over 1NT: 2♦ → hearts, 2♥ → spades (Jacoby), 2♠ → clubs (opener bids 3♣), 2NT → diamonds (opener bids 3♦). Balanced invitations go through 2♣ Stayman.' },
  { k: 'smolen', n: 'Smolen', d: 'After 1NT–2♣–2♦, a game-forcing hand with 5-4 in the majors bids its 4-card major at the three level: 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥, so the strong hand declares.' },
  { k: 'michaels', n: 'Michaels Cue Bid / Unusual 2NT', d: 'A direct cue bid of the opponent\'s suit shows a 5-5 two-suiter: both majors over a minor, the other major + a minor over a major. A jump to 2NT (Unusual) shows the two lowest unbid suits.' },
  { k: 'splinter', n: 'Splinters', d: 'A double jump in a new suit over a major opening = 4+ card support, a singleton or void in the bid suit, 12-15 points, game forcing. Shows slam potential.' },
  { k: 'texas', n: 'Texas Transfers', d: 'Over 1NT/2NT: 4♦ → 4♥, 4♥ → 4♠. A 6+ card major with game values; the strong hand (opener) declares.' },
  { k: "texasInt", n: "Texas after interference", d: "Texas transfers stay on when the opponents double our 1NT or overcall at the two or three level: 4♦ → hearts, 4♥ → spades. A bid in the opponents' own suit is not a transfer (after a 2♥ overcall, 4♥ is a cue bid and 4♦ still shows hearts). Opener completes the transfer." },
  { k: 'leb', n: 'Lebensohl', d: 'After our 1NT is overcalled at the two level: 2NT forces opener to bid 3♣ (to sign off in a suit or as a slow show). A direct three-level suit is forcing. A direct 3NT denies a stopper; 2NT then 3NT shows one.' },
  { k: "lav", n: "Lavinthal Discards", d: "Defensive carding. The suit you discard is the one you do not want; a high card asks for the higher of the two other suits, a low card for the lower (trumps and the suit led are left out). On partner's lead a high spot card encourages, the lowest discourages." },
  { k: 'invMin', n: 'Inverted Minors', off: 1, d: 'Over 1♣/1♦: a raise to 2 of the minor is strong (10+ points, 4+ support, no 4-card major) and forcing; a jump raise to 3 is preemptive (0-9 points, 5+ support).' },
  { k: 'drury', n: 'Drury', off: 1, d: 'A passed hand answers partner\'s third/fourth-seat 1♥/1♠ with 2♣ = 3+ card support and 10-12 points. Opener bids 2 of the major with a light opening, 4 of the major with a full one.' },
  { k: 'nmf', n: 'New Minor Forcing', off: 1, d: 'After 1m–1M–1NT, responder\'s 2 of the other minor is artificial and forcing (11+): it asks opener for 3-card support of responder\'s major or the other 4-card major.' },
  { k: 'fsf', n: 'Fourth Suit Forcing', off: 1, d: 'When three suits have been bid by our side, responder\'s bid of the fourth suit is artificial and game forcing; it asks opener to describe further (stopper, support or extra length).' },
  { k: 'ogust', n: 'Ogust', off: 1, d: 'Over partner\'s weak two, 2NT asks: 3♣ = minimum, bad suit; 3♦ = minimum, good suit; 3♥ = maximum, bad suit; 3♠ = maximum, good suit; 3NT = solid suit (AKQ).' },
  { k: 'supx', n: 'Support Double', off: 1, d: 'After 1m–(P)–1M–(overcall below 2M), opener\'s double shows exactly three-card support for responder\'s major; a direct raise shows four.' },
  { k: 'respx', n: 'Responsive Double', off: 1, d: 'After their opening, partner\'s takeout double and their raise, a double by advancer is for takeout: 8+ points and both unbid suits (usually the majors), no clear bid.' },
  { k: 'sjs', n: 'Strong Jump Shifts', off: 1, x: 'wjs', d: 'A single jump in a new suit by responder shows a strong hand (19+ points) with a good suit and slam interest. Replaces Weak Jump Shifts.' },
  { k: 'dont', n: 'DONT', off: 1, x: 'capp', d: 'Over their 1NT: X = a one-suiter (6+), 2♣ = clubs and a higher suit, 2♦ = diamonds and a major, 2♥ = both majors, 2♠ = spades only. Replaces Cappelletti.' },
  { k: 'gamb', n: 'Gambling 3NT', off: 1, d: 'A 3NT opening shows a solid 7+ card minor (AKQ at the top) with no ace or king outside. Partner passes with stoppers, otherwise bids 4♣ (pass or correct).' },
];
CONVS.forEach(c => { if (c.x) { const o = CONVS.find(y => y.k === c.x); if (o) o.x = c.k; } });
const XINFO = {
  jtr: { n: 'Jacoby Transfer', d: 'Over 1NT, 2♦ asks opener to bid hearts and 2♥ asks for spades, so the strong hand declares.' },
  bw: { n: 'Blackwood', d: '4NT asks for aces: 5♣ = 0 or 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.' },
  q: { n: 'Quantitative 4NT', d: 'After a notrump bid, 4NT does not ask for aces; it invites slam. Partner bids 6NT with a maximum.' },
  nego: { n: 'Negative Double', d: 'After partner opens and the opponent overcalls, double is not for penalty: it shows four cards in the unbid major and enough values to bid.' },
  takeout: { n: 'Takeout Double', d: 'A double of an opening bid: opening values, shortness in their suit and support for the other suits. Partner must bid.' },
  weak2: { n: 'Weak Two', d: '2♦/2♥/2♠ opening: a good 6-card suit, 5-10 HCP. A preemptive opening.' },
  strong2c: { n: 'Strong 2♣', d: '2♣ opening: 22+ HCP or equivalent playing strength, artificial and game forcing. 2♦ is the waiting response.' },
  cue: { n: 'Cue Bid', d: 'Bidding the opponents\' suit is not natural: it shows support for partner with a limit raise or better and is forcing.' },
  nt1: { n: '1NT Opening', d: '15-17 HCP, balanced.' },
  pre: { n: 'Preempt', d: 'An opening at the three or four level: a long suit (7+) and a weak hand, taking bidding space from the opponents.' },
  runout: { n: 'Escape after 1NT doubled', d: 'When our 1NT is doubled, a weak responder runs to a 5+ card suit; redouble shows values (9+).' },
};
/* default card = the player's own card; conventions marked off start disabled */
const ALL_ON = Object.fromEntries(CONVS.map(c => [c.k, !c.off]));
const SAYC = Object.fromEntries(CONVS.map(c => [c.k, ['gerber', 'j2nt', 'stayman'].includes(c.k)]));
const convInfo = k => CONVS.find(c => c.k === k) || XINFO[k] || null;

Object.assign(E, { SUIT, STR, RTXT, SEAT, S, R, pd, sideOf, B, LV, ST, isNum, vulOf, dealerOf, callTxt, popc, rnd, seed, shuffle, dealKey,
  aState, legalCalls, isLegal, auctionOver, contractOf, ev, scoreOf, imps, compare, CONVS, XINFO, ALL_ON, SAYC, convInfo });
});
