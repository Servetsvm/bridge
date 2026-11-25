/* BridgePlay (new) — play with robots. The robots' brain is the first BridgePlay's engine (js/core.js, bidding.js,
   play.js, dds.js: measured over many thousand deals), unchanged; the table, the bidding box and the play are new.
   You sit South; the robots sit North (your partner), East and West. When your side declares you play dummy too. */
import { T, lang } from './i18n.js';
import { page, go, esc, $, redraw, toast, sheet, closeSheet, SUITS } from './ui.js';

const E = {}; for (const f of (window.BRIDGE || [])) f(E);
if (typeof window.ddsFactory === 'function') window.ddsFactory().then(m => E.ddsUse && E.ddsUse(m)).catch(() => {});   // the fast double-dummy solver

const SEATS = ['N', 'E', 'S', 'W'], RANKS = '23456789TJQKA', STR = ['♣', '♦', '♥', '♠', 'NT'];
const ME = 2;
const S = c => Math.floor(c / 13), R = c => c % 13;
const side = s => s % 2;
const pref = (k, d) => { try { return localStorage.getItem('bp2-' + k) || d; } catch (e) { return d; } };
const setPref = (k, v) => { try { localStorage.setItem('bp2-' + k, v); } catch (e) {} };
const SYS = [['twoone', '2/1'], ['sayc', 'SAYC'], ['acol', 'Acol'], ['sef', 'SEF'], ['precision', 'Precision'], ['polish', 'Polish']];
const seatName = s => ({ tr: ['Kuzey', 'Doğu', 'Güney', 'Batı'], no: ['Nord', 'Øst', 'Sør', 'Vest'] }[lang] || ['North', 'East', 'South', 'West'])[s];

let G = null;   // the board being played
const cardsFor = sys => [0, 1].map(() => ({ conv: { ...E.sysOf(sys).conv }, agg: 0, sys }));
const callTxt = c => c === 'P' ? (lang === 'tr' ? 'Pas' : 'Pass') : c === 'X' ? 'X' : c === 'XX' ? 'XX' : (Math.floor(c / 5) + 1) + STR[c % 5];
const callHtml = c => typeof c === 'number' ? `${Math.floor(c / 5) + 1}<span class="su${c % 5 < 4 ? ' su' + (c % 5) : ''}">${STR[c % 5]}</span>` : esc(callTxt(c));
const cardHtml = (c, attr = '') => `<button class="cd su${S(c)}" ${attr}><b>${RANKS[R(c)] === 'T' ? '10' : RANKS[R(c)]}</b><i>${SUITS[S(c)]}</i></button>`;
const over = a => (a.length >= 4 && a.slice(-3).every(e => e.call === 'P') && a.some(e => e.call !== 'P')) || (a.length === 4 && a.every(e => e.call === 'P'));

// ---- a new board: a random deal (or one given), the dealer and vulnerability from the board number ----
function newBoard(deal) {
  const n = (+pref('board', '0') || 0) + 1; setPref('board', String(n));
  if (!deal) { const d = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } deal = [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13)); }
  const sys = pref('sys', 'twoone');
  G = { n, deal: deal.map(h => h.slice().sort((a, b) => S(b) - S(a) || R(b) - R(a))), dealer: E.dealerOf(n), auc: [], phase: 'bid', sys, cards: cardsFor(sys), g: null, sel: null };
  go('table', null, true);
  step();
}
// the robots' turns, one at a time (a short pause, so the table can be followed)
let stepT = 0;
function step() {
  clearTimeout(stepT); if (!G) return;
  if (G.phase === 'bid') {
    if (over(G.auc)) return endAuction();
    const t = (G.dealer + G.auc.length) % 4; if (t === ME) return redraw();
    stepT = setTimeout(() => { const r = E.aiBid(G.auc, t, G.deal[t], G.cards); G.auc.push({ seat: t, call: r.call, m: r.m }); redraw(); step(); }, 650);
  } else if (G.phase === 'play') {
    const g = G.g;
    if (g.trick.length === 4) { stepT = setTimeout(() => { E.collect(g); if (E.handsEmpty(g)) return endPlay(); redraw(); step(); }, 900); return; }
    if (mine(g.turn)) return redraw();
    stepT = setTimeout(() => { const c = E.aiPlay(g, g.turn); E.applyCard(g, g.turn, c); redraw(); step(); }, 550);
  }
}
// the seats I play: South, and North too when our side declares (declarer and dummy)
const mine = s => (G.mySeats || [ME]).includes(s);
function endAuction() {
  const c = E.contractOf(G.auc);
  if (!c) { G.phase = 'done'; G.res = { passed: true, ns: 0 }; return redraw(); }
  G.phase = 'play'; G.g = E.newPlayState(G.deal, c, G.auc, G.cards);
  // our side declares with North as declarer: I play North's hand (declarer) and South (dummy) from my seat
  G.mySeats = side(c.decl) === side(ME) ? [0, 2] : [ME];
  redraw(); step();
}
function endPlay() {
  const g = G.g, c = g.contract, tr = g.tricks[side(c.decl)];
  const sc = E.scoreOf(c.level, c.strain, c.dbl, E.vulOf(G.n, c.decl), tr), ns = side(c.decl) === 0 ? sc : -sc;
  let dd = null; try { dd = E.ddContract(G.deal, { level: c.level, strain: c.strain, decl: c.decl, dbl: c.dbl }); } catch (e) {}
  G.phase = 'done'; G.res = { c, tr, ns, dd };
  setPref('total', String((+pref('total', '0') || 0) + (ns || 0) * (side(ME) === 0 ? 1 : -1)));
  redraw();
}

// ---- the start: the system, then a deal (random, or from a photo) ----
page('robots', () => ({
  title: T('Play with robots'),
  html: `<div class="card"><h2>${lang === 'tr' ? 'Sistem' : lang === 'no' ? 'System' : 'System'}</h2>
      <div class="sysg">${SYS.map(([k, n]) => `<button class="btn${pref('sys', 'twoone') === k ? ' gold' : ''}" data-sys="${k}">${n}</button>`).join('')}</div></div>
    <button class="btn green" data-deal style="min-height:64px;font-size:1.15rem">▶ ${lang === 'tr' ? 'Yeni el' : lang === 'no' ? 'Nytt spill' : 'New board'}</button>
    <label class="btn" style="margin-top:10px">📷 ${lang === 'tr' ? 'Fotoğraftan el oku' : lang === 'no' ? 'Les et spill fra et bilde' : 'Read a deal from a picture'}<input type="file" accept="image/*" id="photoIn" hidden></label>
    <div class="muted" style="margin:10px 4px">${lang === 'tr' ? 'Sen Güney’desin; ortağın ve rakiplerin robot. Bir teklife dokunursan anlamını görürsün.' : lang === 'no' ? 'Du sitter Sør; makker og motspillerne er roboter. Trykk på en melding for å se hva den betyr.' : 'You sit South; your partner and the opponents are robots. Tap a call to see what it means.'}</div>`,
}));
document.addEventListener('click', e => {
  const s = e.target.closest('[data-sys]'); if (s) { setPref('sys', s.dataset.sys); return redraw(); }
  if (e.target.closest('[data-deal]')) return newBoard();
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'photoIn' || !e.target.files || !e.target.files[0]) return;
  if (typeof window.Photo === 'undefined' || !window.Photo.read) return toast('📷 —');
  toast(lang === 'tr' ? 'Resim okunuyor…' : 'Reading…', 4000);
  try {
    const r = await window.Photo.read(e.target.files[0]);
    if (!r || !r.hands || !r.hands.every(h => h && h.length === 13)) return toast(lang === 'tr' ? 'Resimdeki el tam okunamadı.' : 'The deal could not be read in full.', 3500);
    newBoard(r.hands);
  } catch (x) { toast(String(x.message || x), 3500); }
});

// ---- the table ----
page('table', () => {
  if (!G) return { title: T('Play with robots'), html: '<div class="center">…</div>' };
  const g = G.g, vul = s => E.vulOf(G.n, s);
  const head = `<div class="bd-head"><b>${T('Board')} ${G.n}</b><span>${SYS.find(x => x[0] === G.sys)[1]}</span><span>${lang === 'tr' ? 'Açan' : 'Dealer'}: ${seatName(G.dealer)}</span>
    <span class="vul">${[0, 1].map(sd => `<i class="${vul(sd) ? 'v' : ''}">${sd ? T('EW') : T('NS')}</i>`).join('')}</span></div>`;
  return { title: T('Play with robots'), right: `<button class="tb-btn" data-quit aria-label="${T('Home')}">⌂</button>`, html: head + (G.phase === 'bid' ? bidHtml() : G.phase === 'play' ? playHtml() : doneHtml()) };
});

// the auction as a grid (W N E S), each call tappable for its meaning
function auctionHtml() {
  const cols = [3, 0, 1, 2], rows = [], first = cols.indexOf(G.dealer);
  const cells = Array(first).fill(null).concat(G.auc.map((e, i) => ({ e, i })));
  if (G.phase === 'bid' && !over(G.auc)) cells.push({ wait: true });
  for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4));
  return `<div class="auc"><div class="auc-h">${cols.map(s => `<b class="${s === ME ? 'me' : ''}">${seatName(s)}</b>`).join('')}</div>
    ${rows.map(r => `<div class="auc-r">${[0, 1, 2, 3].map(k => { const x = r[k]; return x ? x.wait ? '<span class="wait">…</span>' : `<button class="call${x.e.call === 'P' ? ' p' : ''}" data-exp="${x.i}">${callHtml(x.e.call)}</button>` : '<span></span>'; }).join('')}</div>`).join('')}</div>`;
}
const handHtml = (h, attr) => { const bySuit = [3, 2, 1, 0].map(s => h.filter(c => S(c) === s)); return `<div class="hand">${bySuit.map(cs => cs.map(c => cardHtml(c, attr ? attr(c) : '')).join('')).join('')}</div>`; };
function bidHtml() {
  const t = (G.dealer + G.auc.length) % 4, myTurn = t === ME && !over(G.auc);
  const legal = c => E.isLegal(G.auc, ME, c);
  return `${auctionHtml()}
    ${myTurn ? `<div class="bbox">${[1, 2, 3, 4, 5, 6, 7].map(l => `<div class="bb-r">${[0, 1, 2, 3, 4].map(s => { const c = (l - 1) * 5 + s; return `<button class="bb${legal(c) ? '' : ' off'}" ${legal(c) ? `data-bid="${c}"` : 'disabled'}>${callHtml(c)}</button>`; }).join('')}</div>`).join('')}
      <div class="bb-r bb-x"><button class="bb pass" data-bid="P">${callTxt('P')}</button><button class="bb x${legal('X') ? '' : ' off'}" ${legal('X') ? 'data-bid="X"' : 'disabled'}>X</button><button class="bb x${legal('XX') ? '' : ' off'}" ${legal('XX') ? 'data-bid="XX"' : 'disabled'}>XX</button><button class="bb hint" data-hint>💡</button></div></div>`
      : `<div class="center"><span class="spin"></span> ${seatName(t)}</div>`}
    <div class="mine">${handHtml(G.deal[ME])}</div>`;
}
function playHtml() {
  const g = G.g, c = g.contract, dummy = g.dummy, my = G.mySeats || [ME];
  const legal = s => new Set(E.legalFor(g, s));
  const tableHand = s => {
    if (my.includes(s) || (s === dummy && g.dummyShown)) { const L = my.includes(s) && g.turn === s && g.trick.length < 4 ? legal(s) : null; return handHtml(g.hands[s], L ? (k => L.has(k) ? `data-card="${k}"` : 'disabled') : (k => 'disabled')); }
    return `<div class="backs">${g.hands[s].map(() => '<i></i>').join('')}</div>`;
  };
  const tr = g.trick, at = s => (tr.find(x => x.s === s) || {}).c;
  return `<div class="cbar"><b>${c.level}${STR[c.strain]}${c.dbl === 2 ? 'XX' : c.dbl ? 'X' : ''}</b> · ${seatName(c.decl)} · ${T('NS')} ${g.tricks[0]} – ${T('EW')} ${g.tricks[1]}</div>
    <div class="tbl2">
      <div class="seat n"><small class="${g.turn === 0 ? 'turn' : ''}">${seatName(0)}${dummy === 0 ? ' ·  🂠' : ''}</small>${tableHand(0)}</div>
      <div class="seat w"><small class="${g.turn === 3 ? 'turn' : ''}">${seatName(3)}</small>${tableHand(3)}</div>
      <div class="trick">${[0, 1, 2, 3].map(s => `<span class="tp t${s}">${at(s) != null ? cardHtml(at(s), 'disabled') : ''}</span>`).join('')}</div>
      <div class="seat e"><small class="${g.turn === 1 ? 'turn' : ''}">${seatName(1)}</small>${tableHand(1)}</div>
    </div>
    <div class="mine"><small class="${g.turn === ME ? 'turn' : ''}">${seatName(ME)}${dummy === ME ? ' · 🂠' : ''}</small>${tableHand(ME)}</div>`;
}
function doneHtml() {
  const r = G.res;
  if (r.passed) return `${auctionHtml()}<div class="card center"><b>${lang === 'tr' ? 'Herkes pas geçti' : 'Passed out'}</b></div>${againHtml()}`;
  const c = r.c, need = c.level + 6, diff = r.tr - need, made = diff >= 0, mineSide = side(c.decl) === side(ME);
  const score = r.ns * (side(ME) === 0 ? 1 : -1);
  return `<div class="card res ${score >= 0 ? 'good' : 'bad'}"><div class="big">${c.level}${STR[c.strain]}${c.dbl === 2 ? 'XX' : c.dbl ? 'X' : ''} ${seatName(c.decl)} ${made ? (diff ? '+' + diff : '=') : diff}</div>
      <div class="pts">${score > 0 ? '+' : ''}${score}</div>
      ${r.dd != null ? `<div class="muted">${lang === 'tr' ? 'Double dummy' : 'Double dummy'}: ${r.dd} ${T('Tricks').toLowerCase()} (${r.tr - r.dd >= 0 ? '+' : ''}${r.tr - r.dd})</div>` : ''}</div>
    ${auctionHtml()}${againHtml()}`;
}
const againHtml = () => `<div class="row" style="margin-top:12px"><button class="btn green" data-deal>▶ ${lang === 'tr' ? 'Yeni el' : lang === 'no' ? 'Nytt spill' : 'New board'}</button><button class="btn" data-quit>⌂ ${T('Home')}</button></div>`;

document.addEventListener('click', e => {
  if (!G) return;
  const b = e.target.closest('[data-bid]');
  if (b && G.phase === 'bid') { const v = b.dataset.bid, call = /^\d+$/.test(v) ? +v : v; if (!E.isLegal(G.auc, ME, call)) return; const m = E.explainCall(G.auc, ME, call, G.cards); G.auc.push({ seat: ME, call, m }); redraw(); step(); return; }
  const cd = e.target.closest('[data-card]');
  if (cd && G.phase === 'play') { const g = G.g, k = +cd.dataset.card, s = g.turn; if (!(G.mySeats || [ME]).includes(s) || !E.legalFor(g, s).includes(k)) return; E.applyCard(g, s, k); redraw(); step(); return; }
  const x = e.target.closest('[data-exp]');
  if (x) { const a = G.auc[+x.dataset.exp]; const m = a.m || E.explainCall(G.auc.slice(0, +x.dataset.exp), a.seat, a.call, G.cards) || {}; return sheet(`<h2>${seatName(a.seat)}: ${callHtml(a.call)}</h2><div>${esc(m.t || (lang === 'tr' ? 'Doğal' : 'Natural'))}</div>`); }
  if (e.target.closest('[data-hint]')) { const r = E.aiBid(G.auc, ME, G.deal[ME], G.cards); return sheet(`<h2>💡 ${callHtml(r.call)}</h2><div>${esc((r.m && r.m.t) || '')}</div>`); }
  if (e.target.closest('[data-quit]')) { clearTimeout(stepT); G = null; go('home', null, true); }
});
