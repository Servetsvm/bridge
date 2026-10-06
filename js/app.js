/* Bridge Table — screen, game flow, field comparison and settings. */
'use strict';
const E = {}; for (const f of window.BRIDGE) f(E);
const { SUIT, STR, RTXT, SEAT, S, R, pd, sideOf, B, LV, ST, isNum, vulOf, dealerOf, callTxt, legalCalls, isLegal, auctionOver, contractOf, ev, scoreOf } = E;

let SET = { seat: 2, speed: 1, expl: true, auto: true, mode: 'IMP', opp: 'same', conv: { ...E.ALL_ON } };
let G = null, HIST = [], BOARD = 0, timer = null;
const ui = { selLvl: 0, hintBid: null, hintCard: null, lastExpl: null, toast: null, confirmNew: 0, overlay: null, resTab: 'stats' };
const U = () => SET.seat;
const delay = () => [1100, 650, 250][SET.speed];
const $ = id => document.getElementById(id);
const red = s => s === 1 || s === 2;
const symHtml = s => s === 4 ? 'NT' : `<span class="sym${red(s) ? ' red' : ''}">${STR[s]}</span>`;
const callHtml = c => isNum(c) ? LV(c) + symHtml(ST(c)) : callTxt(c);
/* enlarges and colours the suit symbols inside a text */
const symText = t => String(t || '').replace(/[♣♦♥♠]/g, ch => `<span class="sym${ch === '♥' || ch === '♦' ? ' red' : ''}">${ch}</span>`);
const conKey = c => c ? `${LV(B(c.level, c.strain))}${symHtml(c.strain)}${c.dbl === 1 ? 'X' : c.dbl === 2 ? 'XX' : ''} ${SEAT[c.decl][0]}` : 'Pass';
const conId = c => c ? `${c.level}${c.strain}${c.dbl}${c.decl}` : 'P';
const fmtSigned = v => (v > 0 ? '+' : '') + v;

function sideCards() {
  const ours = { conv: { ...SET.conv }, agg: 0 }, opp = { conv: SET.opp === 'same' ? { ...SET.conv } : { ...E.SAYC }, agg: 0 };
  const c = [null, null]; c[sideOf(U())] = ours; c[1 - sideOf(U())] = opp; return c;
}

/* ================= persistence ================= */
const SEEN_KEY = 'bridge-table-seen';
let SEEN = new Set();
function loadSeen() { try { SEEN = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { SEEN = new Set(); } }
function saveSeen() { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...SEEN].slice(-30000))); } catch (e) {} }
function save() {
  const slim = HIST.map((h, i) => (i < HIST.length - 60 ? { ...h, deal: undefined, fieldList: undefined } : h));
  Store.saveLocal({ SET, G, HIST: slim, BOARD });
}
function load(d) {
  d = d || Store.loadLocal();
  if (d) { SET = Object.assign(SET, d.SET || {}); G = d.G || null; HIST = d.HIST || []; BOARD = d.BOARD || 0; }
  SET.conv = { ...E.ALL_ON, ...(SET.conv || {}) };
  loadSeen();
  for (const h of HIST) if (h.deal) SEEN.add(E.dealKey(h.deal));
}
function mergeCloud(recs, settings) {
  const have = new Set(HIST.map(h => h.id)), inCloud = new Set(recs.map(r => r.id));
  for (const h of HIST) if (!inCloud.has(h.id)) Store.saveRec(h);
  for (const r of recs) if (!have.has(r.id)) HIST.push(r);
  HIST.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (settings) { SET = Object.assign(SET, settings); SET.conv = { ...E.ALL_ON, ...(SET.conv || {}) }; }
  BOARD = Math.max(BOARD, ...HIST.map(h => h.board || 0));
  save(); render();
}

/* ================= device sync (GitHub gist) ================= */
let syncTimer = null;
const syncState = { msg: "" };
function syncNow(quiet) {
  if (!GitSync.enabled) return;
  if (!navigator.onLine) { syncState.msg = "Offline — will sync when back online"; return; }
  syncState.msg = "Syncing…"; if (ui.overlay === "set") showSettings();
  GitSync.sync({ hist: HIST, seen: [...SEEN] }).then(m => {
    if (!m) return;
    HIST = m.hist; SEEN = new Set(m.seen); saveSeen();
    BOARD = Math.max(BOARD, ...HIST.map(h => h.board || 0));
    syncState.msg = "Synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    save(); renderBar(); if (ui.overlay === "set") showSettings(); else if (ui.overlay === "res") showResults();
  }).catch(e => { syncState.msg = e.message === "offline" ? "Offline — will sync when back online" : "Sync failed: " + e.message; if (ui.overlay === "set") showSettings(); });
}
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(true), 2500); }

/* ================= virtual field (background worker) ================= */
const Field = {
  worker: null, live: {},
  init() {
    try {
      const src = 'const E={};\n' + window.BRIDGE.map(f => '(' + f.toString() + ')(E);').join('\n') + '\n(' + E.workerMain.toString() + ')(E);';
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this.worker.onmessage = e => this.onmsg(e.data);
      this.worker.onerror = () => { this.worker = null; };
    } catch (e) { this.worker = null; }
  },
  start(g) {
    const f = { tables: [], done: false, dd: {}, normC: null };
    g.field = f; this.live[g.id] = { f, deal: g.deal, board: g.board };
    const msg = { type: 'field', id: g.id, deal: g.deal, board: g.board, cards: g.cards, n: 8 };
    if (this.worker) this.worker.postMessage(msg); else this.fallback(msg);
  },
  dd(id, key, deal, c) {
    const msg = { type: 'dd', id, key, deal, c };
    if (this.worker) this.worker.postMessage(msg);
    else setTimeout(() => this.onmsg({ type: 'dd', id, key, t: E.ddContract(deal, c, 1.5e6) }), 50);
  },
  fallback(msg) {
    let i = 0;
    const step = () => {
      if (i >= msg.n) { this.onmsg({ type: 'fieldDone', id: msg.id }); return; }
      const r = E.simulateTable(msg.deal, msg.board, msg.cards, E.FIELD_AGG[i]);
      this.onmsg({ type: 'table', id: msg.id, i, r }); i++; setTimeout(step, 30);
    };
    setTimeout(step, 500);
  },
  onmsg(m) {
    const L = this.live[m.id]; if (!L) return; const f = L.f;
    if (m.type === 'table') f.tables.push(m.r);
    if (m.type === 'fieldDone') {
      f.done = true;
      const cnt = {}; let best = null;
      for (const t of f.tables) { if (t.passed) continue; const k = conId(t.c); cnt[k] = (cnt[k] || 0) + 1; if (!best || cnt[k] > cnt[conId(best)]) best = t.c; }
      f.normC = best;
      if (best) this.dd(m.id, 'norm', L.deal, best);
      const e = HIST.find(h => h.id === m.id);
      if (e) { applyField(e, f); Store.saveRec(e); scheduleSync(); }
    }
    if (m.type === 'dd') { f.dd[m.key] = m.t; const e = HIST.find(h => h.id === m.id); if (e) e.dd = { ...f.dd }; }
    if (m.type === 'error') f.done = true;
    if (G && G.id === m.id) { save(); if (ui.overlay === 'end') showEnd(); renderBar(); }
  },
};
function applyField(e, f) {
  if (!f || !f.done || !f.tables.length) return;
  const fus = f.tables.map(t => sideOf(e.seat) === 0 ? t.ns : -t.ns);
  const cmp = E.compare(e.us, fus); e.imp = cmp.imp; e.mp = cmp.mp;
  e.norm = f.normC ? conKey(f.normC) : 'Pass';
  e.fieldList = f.tables.map(t => ({ k: t.passed ? 'Pass' : conKey(t.c), t: t.tricks ?? null, ns: t.ns }));
}

/* ================= game flow ================= */
/* a never-seen deal; in practice mode, one where our side gets to use the chosen convention */
function freshDeal(dealer) {
  const want = SET.practice, cards = sideCards(), t0 = performance.now();
  let fallback = null;
  for (let i = 0; i < 20000; i++) {
    const d = E.shuffle([...Array(52).keys()]);
    const deal = [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13));
    const key = E.dealKey(deal);
    if (SEEN.has(key)) continue;
    if (want) {
      const auc = [];
      while (!auctionOver(auc) && auc.length < 60) { const t = (dealer + auc.length) % 4; const r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
      const mine = auc.some(e => e.seat === U() && e.m && e.m.cv === want);
      const ours = auc.some(e => sideOf(e.seat) === sideOf(U()) && e.m && e.m.cv === want);
      if (!mine && !ours) { if (performance.now() - t0 < 4000) continue; }
      else if (!mine) { if (!fallback) fallback = { deal, key }; if (performance.now() - t0 < 2500) continue; }
      if (!mine && !ours && fallback) { SEEN.add(fallback.key); saveSeen(); return fallback.deal; }
      if (!mine && !ours) flash('No practice deal found quickly — here is a normal deal', 2500);
    }
    SEEN.add(key); saveSeen(); return deal;
  }
  throw new Error('could not find an unseen deal');
}
/* replay: a deal to play again or an entered deal; boardNo: board number for an entered deal (sets dealer and vulnerability) */
function newBoard(replay, boardNo) {
  clearTimeout(timer);
  if (!replay) BOARD++;
  const bn = boardNo || BOARD;
  const deal = replay ? replay.map(h => h.slice()) : freshDeal(dealerOf(bn));
  UNDO.length = 0;
  G = { id: Date.now().toString(36) + E.rnd(1e6).toString(36), board: bn, dealer: dealerOf(bn), deal, auction: [], phase: 'bid', play: null, result: null, claimed: false, field: null, cards: sideCards() };
  Object.assign(ui, { selLvl: 0, hintBid: null, hintCard: null, lastExpl: null, toast: null, overlay: null });
  $('ov').hidden = true;
  Field.start(G);
  save(); render(); tick();
}
const bidTurn = () => (G.dealer + G.auction.length) % 4;

/* ---- undo: a snapshot is taken right before each call or card of yours ---- */
const UNDO = [];
function pushUndo() { const { field, ...rest } = G; UNDO.push(JSON.stringify(rest)); if (UNDO.length > 80) UNDO.shift(); }
function undo() {
  if (!UNDO.length) return;
  clearTimeout(timer);
  const wasDone = G.phase === 'done', id = G.id;
  G = JSON.parse(UNDO.pop());
  G.field = Field.live[id] ? Field.live[id].f : null;
  if (wasDone) { HIST = HIST.filter(h => h.id !== id); closeOv(); }
  Object.assign(ui, { selLvl: 0, hintBid: null, hintCard: null, toast: null });
  save(); render(); tick();
}
function makeCall(seat, call, m) {
  if (G.phase !== "bid" || bidTurn() !== seat || !isLegal(G.auction, seat, call)) return;
  if (seat === U()) pushUndo();
  if (!m) m = E.explainCall(G.auction, seat, call, G.cards);
  G.auction.push({ seat, call, m });
  ui.selLvl = 0; ui.hintBid = null;
  if (auctionOver(G.auction)) {
    const c = contractOf(G.auction);
    if (!c) { finishBoard(); return; }
    G.play = E.newPlayState(G.deal, c, G.auction); G.phase = 'play';
    Field.dd(G.id, 'you', G.deal, c);
    const us = sideOf(c.decl) === sideOf(U());
    flash(us ? (c.decl === U() ? 'You are declarer' : 'Partner is declarer — you play both hands') : 'You are defending', 1800);
  }
  save(); render(); tick();
}
function userControls(seat) {
  if (!G.play) return seat === U();
  return seat === U() || (sideOf(G.play.contract.decl) === sideOf(U()) && sideOf(seat) === sideOf(U()));
}
function playCard(seat, c) {
  const g = G.play;
  if (G.phase !== "play" || g.turn !== seat || g.trick.length >= 4 || !E.legalFor(g, seat).includes(c)) return;
  if (userControls(seat)) pushUndo();
  E.applyCard(g, seat, c); ui.hintCard = null;
  save(); render(); tick();
}
function collectTrick() {
  const g = G.play; if (!g || g.trick.length < 4) return;
  E.collect(g);
  if (E.handsEmpty(g)) { finishBoard(); return; }
  save(); render(); tick();
}
function finishBoard() {
  const g = G.play; let e;
  if (!g) e = { id: G.id, ts: Date.now(), board: G.board, seat: U(), passed: true, ns: 0, us: 0 };
  else {
    const c = g.contract, dt = g.tricks[sideOf(c.decl)];
    const sc = scoreOf(c.level, c.strain, c.dbl, vulOf(G.board, c.decl), dt), ns = sideOf(c.decl) === 0 ? sc : -sc;
    e = { id: G.id, ts: Date.now(), board: G.board, seat: U(), c: { ...c }, tricks: dt, ns, us: sideOf(U()) === 0 ? ns : -ns };
  }
  e.deal = G.deal;
  if (G.field) { applyField(e, G.field); e.dd = { ...(G.field.dd || {}) }; }
  G.result = e; G.phase = 'done';
  HIST = HIST.filter(h => h.id !== e.id); HIST.push(e);
  Store.saveRec(e);
  save(); render(); showEnd();
  scheduleSync();
}
function tick() {
  clearTimeout(timer); if (!G) return;
  if (G.phase === 'bid') {
    const t = bidTurn();
    if (t !== U()) timer = setTimeout(() => { const r = E.aiBid(G.auction, t, G.deal[t], G.cards); makeCall(t, r.call, r.m); }, delay());
  } else if (G.phase === 'play') {
    const g = G.play;
    if (g.trick.length === 4) timer = setTimeout(collectTrick, Math.max(700, delay() + 300));
    else if (!userControls(g.turn)) { const t = g.turn; timer = setTimeout(() => playCard(t, E.aiPlay(g, t)), delay()); }
    else { const leg = E.legalFor(g, g.turn); if (leg.length === 1 && g.trick.length > 0 && SET.auto) timer = setTimeout(() => playCard(g.turn, leg[0]), 450); }
  }
}
function claim() {
  const g = G.play; if (!g || G.phase !== 'play' || g.trick.length) return;
  const side = sideOf(U());
  const v = E.ddFull(g.hands, g.leader, side, g.trump, 3e6);
  if (v == null) { flash('Could not work it out yet — play a little longer', 1500); return; }
  const left = g.hands[g.leader].length;
  g.tricks[side] += v; g.tricks[1 - side] += left - v; g.hands = g.hands.map(() => []); G.claimed = true;
  finishBoard();
}
function flash(msg, ms) { ui.toast = msg; render(); setTimeout(() => { if (ui.toast === msg) { ui.toast = null; render(); } }, ms); }

/* ================= rendering ================= */
const rel = seat => (seat - U() + 4) % 4;
const ORDER = [3, 2, 0, 1];
const sortHand = h => h.slice().sort((a, b) => ORDER.indexOf(S(a)) - ORDER.indexOf(S(b)) || R(b) - R(a));
function cardHtml(c, cls) {
  const s = S(c), r = R(c), face = r >= 9 && r <= 11;
  return `<div class="card${red(s) ? ' rd' : ''}${face ? ' face' : ''}${cls ? ' ' + cls : ''}" data-c="${c}"><span class="ix"><b>${RTXT[r]}</b><i>${SUIT[s]}</i></span><span class="pip">${face ? `<em>${RTXT[r]}</em>` : ''}${SUIT[s]}</span></div>`;
}
const handsNow = () => G.phase === 'play' ? G.play.hands : G.phase === 'bid' ? G.deal : [[], [], [], []];
function isVisible(seat) {
  if (seat === U()) return true;
  if (G.phase !== 'play') return false;
  const g = G.play;
  if (seat === g.dummy && g.dummyShown) return true;
  return sideOf(g.contract.decl) === sideOf(U()) && seat === pd(U()) && g.dummyShown;
}
function ctlInfo(seat) {
  const g = G.play; const ctl = G.phase === 'play' && g.turn === seat && userControls(seat) && g.trick.length < 4;
  return { ctl, leg: ctl ? E.legalFor(g, seat) : [] };
}
function fanHtml(seat, max) {
  const { ctl, leg } = ctlInfo(seat);
  const h = sortHand(handsNow()[seat]);
  return `<div class="fan" data-max="${max}">${h.map(c => cardHtml(c, (ctl ? (leg.includes(c) ? 'play' : 'dim') : '') + (c === ui.hintCard ? ' hint' : ''))).join('')}</div>`;
}
function vHand(seat) {
  const { ctl, leg } = ctlInfo(seat);
  let o = '<div class="vh">';
  for (const s of ORDER) {
    const cs = E.desc(E.inSuit(handsNow()[seat], s));
    o += `<div class="row"><span class="sy${red(s) ? ' red' : ''}">${SUIT[s]}</span>${cs.map(c => `<span class="mini${red(s) ? ' rd' : ''}${ctl ? (leg.includes(c) ? ' play' : ' dim') : ''}${c === ui.hintCard ? ' hint' : ''}" data-c="${c}">${RTXT[R(c)]}</span>`).join('')}</div>`;
  }
  return o + '</div>';
}
function seatLabel(seat) {
  const g = G.play, tags = [];
  if (seat === G.dealer && G.phase === 'bid') tags.push('<span class="tag">D</span>');
  if (g && seat === g.contract.decl) tags.push('<span class="tag">Decl</span>');
  if (g && seat === g.dummy) tags.push('<span class="tag">Dummy</span>');
  const who = seat === U() ? 'You' : (g && userControls(seat) ? 'You play' : 'Robot');
  const turn = (G.phase === 'bid' && bidTurn() === seat) || (G.phase === 'play' && g.turn === seat);
  return `<span class="lbl${turn ? ' turn' : ''}"><span class="${vulOf(G.board, seat) ? 'vn' : ''}">${SEAT[seat]}</span> · ${who} ${tags.join('')}</span>`;
}
const backs = n => `<span class="backs">${'<i></i>'.repeat(Math.min(n, 13))}</span>`;
function renderBar() {
  if (!G) return;
  const b = G.board, u = U(), uNS = sideOf(u) === 0;
  const topbot = uNS ? vulOf(b, 0) : vulOf(b, 1), lr = uNS ? vulOf(b, 1) : vulOf(b, 0);
  const dst = ['bottom:-1px;left:50%;transform:translateX(-50%)', 'left:1px;top:50%;transform:translateY(-50%)', 'top:-1px;left:50%;transform:translateX(-50%)', 'right:1px;top:50%;transform:translateY(-50%)'][rel(G.dealer)];
  let con = '—', tr = '';
  if (G.play) { const c = G.play.contract; con = `${callHtml(B(c.level, c.strain))}${c.dbl === 1 ? ' X' : c.dbl === 2 ? ' XX' : ''} <span class="sm">${SEAT[c.decl]}</span>`; const us = sideOf(u); tr = `Us ${G.play.tricks[us]} · Them ${G.play.tricks[1 - us]}`; }
  const g = G.play;
  const canClaim = G.phase === 'play' && !g.trick.length && userControls(g.turn) && g.hands[g.turn].length <= 8 && g.hands[g.turn].length > 0;
  const last = HIST.length ? HIST[HIST.length - 1] : null;
  const lastTxt = last ? (last.imp != null ? (SET.mode === 'IMP' ? fmtSigned(last.imp) + ' IMP' : last.mp + '%') : fmtSigned(last.us || 0)) : '&nbsp;';
  const per = Store.periods(HIST)[0];
  const dayTxt = SET.mode === 'IMP' ? (per.scored ? fmtSigned(per.impSum) + ' IMP' : '—') : (per.mpAvg != null ? per.mpAvg + '%' : '—');
  $('bar').innerHTML = `
   <div class="vulbox" title="Board ${b}" style="border-color:${topbot ? 'var(--vul)' : '#f4f4f0'} ${lr ? 'var(--vul)' : '#f4f4f0'}">${b}<span class="dl" style="${dst}">D</span></div>
   <button class="box" id="bAuc" title="Show the auction"><small>Contract</small><b>${con}</b><span class="tr">${tr || '&nbsp;'}</span></button>
   <div class="box"><small>Today</small><b>${dayTxt}</b><span class="tr">last: ${lastTxt}</span></div>
   <div class="spacer"></div>
   <div class="tools">
     <button class="btn new${ui.confirmNew > Date.now() ? ' warn' : ''}" id="bNew">${ui.confirmNew > Date.now() ? 'Sure?' : 'New Deal'}</button>
     <button class="btn" id="bUndo" ${UNDO.length ? "" : "disabled"}>Undo</button>
     <button class="btn gold" id="bHint">Hint</button>
     <button class="btn" id="bClaim" ${canClaim ? '' : 'disabled'}>Claim</button>
     <button class="btn" id="bSet">Settings</button>
     <button class="btn" id="bRes">Results</button>
   </div>`;
}
function explHtml(e, prefix) {
  if (!e) return 'Tap any call to see what it means.';
  const m = e.m || {}, ci = m.cv ? E.convInfo(m.cv) : null;
  return `<b>${prefix || SEAT[e.seat] + ':'} ${callHtml(e.call)}</b> — ${symText(m.t)}${ci ? `<div class="cv"><span>${ci.n}</span>${symText(ci.d)}</div>` : ''}`;
}
function auctionTable(auction, phaseBid) {
  const cols = [3, 0, 1, 2];
  let o = '<table><thead><tr>' + cols.map(s => `<th class="${vulOf(G.board, s) ? 'v' : ''} ${s === U() ? 'me' : ''}">${SEAT[s]}</th>`).join('') + '</tr></thead><tbody><tr>';
  let col = cols.indexOf(G.dealer); for (let i = 0; i < col; i++) o += '<td></td>';
  auction.forEach((e, i) => { o += `<td><span class="c${i === ui.lastExpl ? ' sel' : ''}${e.m && e.m.cv ? ' cvb' : ''}" data-ai="${i}">${callHtml(e.call)}</span></td>`; col++; if (col === 4) { o += '</tr><tr>'; col = 0; } });
  if (phaseBid) o += '<td>?</td>';
  return o + '</tr></tbody></table>';
}
function auctionPanel() {
  // the explanation appears only when you tap a call (or ask for a hint); tap again to close it
  const e = ui.hintBid ? { call: ui.hintBid.call, m: ui.hintBid.m } : (ui.lastExpl != null ? G.auction[ui.lastExpl] : null);
  const ex = e ? explHtml(e, ui.hintBid ? 'Suggestion:' : null) : '';
  return `<div class="auction">${auctionTable(G.auction, G.phase === 'bid')}</div>${e && SET.expl ? `<div class="expl" id="dExpl" role="button" tabindex="0">${ex}</div>` : `<div class="muted tap">Tap a call to see what it means</div>`}`;
}
function renderTable() {
  for (let seat = 0; seat < 4; seat++) {
    const r = rel(seat), el = $('pos' + r);
    if (r === 0) { el.innerHTML = fanHtml(seat, 78) + seatLabel(seat); continue; }
    let inner = '';
    if (isVisible(seat)) inner = r === 2 ? fanHtml(seat, 78) : vHand(seat);
    else if (G.phase === 'play') inner = backs(G.play.hands[seat].length);
    el.innerHTML = seatLabel(seat) + inner;
  }
  $('table').classList.toggle('bidding', G.phase === 'bid');
  const C = $('center');
  if (G.phase === 'bid') C.innerHTML = auctionPanel();
  else if (G.phase === 'play') {
    const tr = G.play.trick, w = tr.length === 4 ? E.trickWinner(tr, G.play.trump) : -1;
    C.innerHTML = '<div class="trick">' + tr.map(x => cardHtml(x.c, 'tc p' + rel(x.s) + (x.s === w ? ' win' : ''))).join('') + '</div>';
  } else C.innerHTML = `<div class="donebox"><b>${G.result ? resultLine(G.result) : ''}</b><button class="btn gold" id="oNext2">New Deal</button><button class="btn" id="oShow">Show result</button></div>`;
  if (ui.toast) C.insertAdjacentHTML('beforeend', `<div class="toast" id="toast">${ui.toast}</div>`);
  layoutFans();
}
function layoutFans() {
  document.querySelectorAll('.fan').forEach(el => {
    const n = el.children.length; if (!n) return;
    const W = el.clientWidth, max = +el.dataset.max || 70;
    const cw = Math.max(28, Math.min(max, W / (1 + (n - 1) * 0.44)));
    const step = n > 1 ? Math.min(cw * 1.04, (W - cw) / (n - 1)) : 0;
    el.style.setProperty('--cw', cw + 'px'); el.style.setProperty('--ov', (step - cw) + 'px');
  });
}
function renderBidbox() {
  const bb = $('bidbox');
  if (G.phase !== 'bid' || bidTurn() !== U()) { bb.innerHTML = ''; bb.hidden = true; return; }
  bb.hidden = false; const L = legalCalls(G.auction, U());
  const lv = [1, 2, 3, 4, 5, 6, 7].map(l => `<button data-lvl="${l}" class="${ui.selLvl === l ? 'sel' : ''}" ${L.some(c => isNum(c) && LV(c) === l) ? '' : 'disabled'}>${l}</button>`).join('');
  const sts = [0, 1, 2, 3, 4].map(s => { const c = ui.selLvl ? B(ui.selLvl, s) : -1; return `<button data-call="${c}" class="st${red(s) ? ' r' : ''}${s === 4 ? ' nt' : ''}" ${ui.selLvl && L.includes(c) ? '' : 'disabled'}>${STR[s]}</button>`; }).join('');
  bb.innerHTML = `<div class="row"><button data-call="P" class="pass">Pass</button><button data-call="X" class="dbl" ${L.includes('X') ? '' : 'disabled'}>Double</button><button data-call="XX" class="rdbl" ${L.includes('XX') ? '' : 'disabled'}>Redouble</button></div><div class="row">${lv}</div><div class="row">${sts}</div>`;
}
function renderStatus() {
  let s = '';
  if (G.phase === 'bid') s = bidTurn() === U() ? 'Your call' : `${SEAT[bidTurn()]} is thinking…`;
  else if (G.phase === 'play') { const g = G.play; if (g.trick.length === 4) s = 'Gathering the trick…'; else if (userControls(g.turn)) s = g.turn === U() ? 'Your turn: play a card' : `Play from ${SEAT[g.turn]}'s hand`; else s = `${SEAT[g.turn]} is playing…`; }
  else s = 'Board finished';
  $('status').textContent = s;
}
function render() { if (!G) return; renderBar(); renderTable(); renderBidbox(); renderStatus(); }

/* ================= overlays ================= */
function suitLine(cards, s) { const cs = E.desc(E.inSuit(cards, s)); return `${symHtml(s)} ${cs.length ? cs.map(c => RTXT[R(c)]).join(' ') : '—'}`; }
function dealHtml(deal, u) {
  const pos = ['s', 'w', 'n', 'e'];
  return '<div class="deal">' + [0, 1, 2, 3].map(seat => { const r = (seat - u + 4) % 4; return `<div class="h ${pos[r]}"><b>${SEAT[seat]}${seat === u ? ' (you)' : ''} · ${ev(deal[seat]).hcp} HCP</b>${ORDER.map(s => suitLine(deal[seat], s)).join('<br>')}</div>`; }).join('') + '</div>';
}
function resultLine(e) {
  if (e.passed) return 'Passed out';
  const c = e.c, d = e.tricks - (c.level + 6);
  return `${conKey(c)} · ${e.tricks} tricks (${d >= 0 ? (d ? '+' + d : '=') : d}) · <span class="${e.us >= 0 ? 'pos' : 'neg'}">${fmtSigned(e.us)}</span>`;
}
function openOv(name, html) { ui.overlay = name; $('ov').innerHTML = `<div class="sheet">${html}</div>`; $('ov').hidden = false; }
function closeOv() { ui.overlay = null; $('ov').hidden = true; }
function showEnd() {
  const e = G.result; if (!e) return;
  const f = G.field || { tables: [], done: false, dd: {} };
  const ddTxt = (k, c) => { const v = f.dd[k]; if (v === undefined) return 'calculating…'; if (v === null) return 'not available'; const d = v - (c.level + 6); return `${v} tricks (${d >= 0 ? 'makes' : 'down ' + -d})`; };
  let fieldHtml;
  if (!f.done) fieldHtml = `<div class="muted">The robot tables are playing this deal… (${f.tables.length}/8)</div>`;
  else {
    const fus = t => sideOf(e.seat) === 0 ? t.ns : -t.ns;
    fieldHtml = `<table class="res"><thead><tr><th>Table</th><th>Contract</th><th>Tricks</th><th class="n">Score</th><th class="n">IMP</th></tr></thead><tbody>${f.tables.map((t, i) => `<tr><td>${i + 1}</td><td>${t.passed ? 'Pass' : conKey(t.c)}</td><td>${t.tricks ?? ''}</td><td class="n">${fmtSigned(fus(t))}</td><td class="n">${fmtSigned(E.imps(e.us - fus(t)))}</td></tr>`).join('')}</tbody></table>`;
  }
  const scoreTxt = e.imp != null ? `<div class="score2"><div class="${SET.mode === 'IMP' ? 'on' : ''}"><small>IMP</small><b>${fmtSigned(e.imp)}</b></div><div class="${SET.mode === 'MP' ? 'on' : ''}"><small>MP</small><b>${e.mp}%</b></div></div>` : '';
  const norm = f.normC;
  openOv('end', `<h2>Board ${e.board}</h2><div class="big">${resultLine(e)}</div>${G.claimed ? '<div class="muted">The remaining tricks were settled by claim.</div>' : ''}
   ${scoreTxt}
   <div class="grp"><span>Par check</span><div>Normal contract (most common at the robot tables): ${f.done ? (norm ? conKey(norm) + ' — double dummy ' + ddTxt('norm', norm) : 'Pass') : '…'}</div>
   ${e.c ? `<div>Your contract ${conKey(e.c)} — double dummy ${ddTxt('you', e.c)}</div>` : ''}</div>
   <div class="grp"><span>Robot tables</span>${fieldHtml}</div>
   ${dealHtml(G.deal, U())}
   <div class="row2"><button class="btn gold" id="oNext">Next deal</button><button class="btn" id="oReplay">Replay this deal</button><button class="btn" id="oClose">Close</button></div>`);
}
function showAuction() {
  if (!G.auction.length) return;
  openOv('auc', `<h2>Auction</h2><div class="auction">${auctionTable(G.auction, false)}</div><div class="expl">${explHtml(ui.lastExpl != null ? G.auction[ui.lastExpl] : null)}</div><div class="row2"><button class="btn gold" id="oClose">Close</button></div>`);
}
function showSettings() {
  const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const convs = E.CONVS.map(c => `<label class="cvrow"><input type="checkbox" data-conv="${c.k}" ${SET.conv[c.k] ? 'checked' : ''}><span><b>${c.n}</b>${c.x ? `<em class="xo">replaces ${E.CONVS.find(y => y.k === c.x).n}</em>` : ''}<small>${symText(c.d)}</small></span></label>`).join('');
  openOv('set', `<h2>Settings</h2>
   <div class="grp"><span>Practice a convention</span><select id="sPractice" class="sel"><option value="">Off — normal random deals</option>${E.CONVS.map(c => `<option value="${c.k}" ${SET.practice === c.k ? 'selected' : ''}>${c.n}</option>`).join('')}</select><div class="muted">New deals are chosen so that you (or your partner) get to use this convention. It is switched on in your card automatically.</div></div>
   <div class="grp"><span>Play a specific deal</span><button class="btn" id="sDeal">Enter a deal (from a photo or a hand record)</button></div>
   <div class="grp"><span>Your seat</span>${seg('seat', [[0, 'North'], [1, 'East'], [2, 'South'], [3, 'West']], SET.seat)}</div>
   <div class="grp"><span>Scoring</span>${seg('mode', [['IMP', 'IMP'], ['MP', 'Matchpoints (%)']], SET.mode)}</div>
   <div class="grp"><span>Opponents' system</span>${seg('opp', [['same', 'Same as ours'], ['sayc', 'Standard (SAYC)']], SET.opp)}</div>
   <div class="grp"><span>Robot speed</span>${seg('speed', [[0, 'Slow'], [1, 'Normal'], [2, 'Fast']], SET.speed)}</div>
   <div class="grp"><span>Bid explanations</span>${seg('expl', [[1, 'Show'], [0, 'Hide']], SET.expl ? 1 : 0)}</div>
   <div class="grp"><span>Play a forced card automatically</span>${seg('auto', [[1, 'On'], [0, 'Off']], SET.auto ? 1 : 0)}</div>
   <div class="grp"><span>Our convention card (with partner)</span><div class="muted">Base system: 5-card majors, 15-17 1NT, weak twos, strong 2♣, Jacoby transfers, negative and takeout doubles.</div>${convs}</div>
   <div class="grp"><span>Sync between devices (GitHub)</span><div class="muted">Scores, statistics and the list of deals you have seen are kept in a private gist on your GitHub account. Play offline on any device; everything merges when it is online again.</div>
   ${GitSync.enabled ? `<div><b>Connected.</b> ${syncState.msg || (GitSync.last ? "Last sync " + new Date(GitSync.last).toLocaleString() : "")}</div><div class="row2"><button class="btn gold" id="sNow">Sync now</button><button class="btn" id="sOff">Disconnect</button></div>` : `<div class="muted">1. Open <a href="https://github.com/settings/tokens/new?scopes=gist&description=Bridge%20Table" target="_blank" rel="noopener">github.com → new token</a> (scope: <b>gist</b> only, expiration: no expiration) and copy the token.<br>2. Paste it here on each device (PC and phone).</div><div class="row2"><input id="syncToken" type="password" autocomplete="off" placeholder="ghp_…" class="tok"><button class="btn gold" id="sSave">Connect</button></div>${syncState.msg ? `<div class="muted">${syncState.msg}</div>` : ""}`}</div>
   <div class="muted">Changes apply from the next deal.${Store.online ? ' Settings and scores are saved to your account.' : ' Scores are saved on this device.'} Every deal you get is new — a deal is never dealt to you twice.</div>
   <div class="row2"><button class="btn gold" id="oClose">Close</button><button class="btn" id="sReset">Delete score history</button></div>`);
}
/* ---- entering a deal (hand record, PBN, or the code Claude reads from a photo) ---- */
const RANKS = { A: 12, K: 11, Q: 10, J: 9, T: 8, '9': 7, '8': 6, '7': 5, '6': 4, '5': 3, '4': 2, '3': 1, '2': 0 };
/* "AKQ2.K73.J5.T942" (spades.hearts.diamonds.clubs) or "S AKQ2 H K73 D J5 C T942" / "♠AKQ2 ♥K73 …" */
function parseHand(txt) {
  txt = String(txt || '').toUpperCase().replace(/10/g, 'T').trim();
  if (!txt) return null;
  const out = [], put = (s, str) => { for (const ch of str.replace(/[^AKQJT2-9]/g, '')) out.push(s * 13 + RANKS[ch]); };
  if (txt.includes('.')) { const parts = txt.split('.'); if (parts.length !== 4) throw new Error('Use four groups separated by dots: spades.hearts.diamonds.clubs'); [3, 2, 1, 0].forEach((s, i) => put(s, parts[i])); }
  else {
    const map = { S: 3, '♠': 3, H: 2, '♥': 2, D: 1, '♦': 1, C: 0, '♣': 0 };
    const re = /([SHDC♠♥♦♣])\s*:?\s*([AKQJT2-9\-—]*)/g; let m, any = false;
    while ((m = re.exec(txt))) { any = true; put(map[m[1]], m[2]); }
    if (!any) throw new Error('Could not read "' + txt + '"');
  }
  return out;
}
function parsePBN(txt) {
  const m = String(txt).match(/([NESW])\s*:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i); if (!m) return null;
  const first = 'NESW'.indexOf(m[1].toUpperCase()), hands = [[], [], [], []];
  for (let i = 0; i < 4; i++) hands[(first + i) % 4] = m[i + 2] === '-' ? null : parseHand(m[i + 2]);
  return hands;
}
function showDealEntry(err) {
  const v = ui.dealForm || { pbn: '', h: ['', '', '', ''], dealer: 0, vul: 0 };
  ui.dealForm = v;
  const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([val, l]) => `<button data-v="${val}" class="${String(cur) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  openOv('deal', `<h2>Enter a deal</h2>
   <div class="muted">Have a photo of a played board? Send it to Claude in the chat and ask for the PBN code, then paste it here. You can also type the hands: spades.hearts.diamonds.clubs, e.g. <b>AKQ2.K73.J5.T942</b> (T = 10). Leave one hand empty and it is filled with the remaining cards.</div>
   <div class="grp"><span>PBN code (optional)</span><input id="dPbn" class="tok wide" placeholder="N:AKQ2.K73.J5.T942 ..." value="${v.pbn.replace(/"/g, '&quot;')}"></div>
   ${[0, 1, 2, 3].map(s => `<div class="grp"><span>${SEAT[s]}</span><input id="dH${s}" class="tok wide" placeholder="AKQ2.K73.J5.T942" value="${v.h[s].replace(/"/g, '&quot;')}"></div>`).join('')}
   <div class="grp"><span>Dealer</span>${seg('ddealer', [[0, 'North'], [1, 'East'], [2, 'South'], [3, 'West']], v.dealer)}</div>
   <div class="grp"><span>Vulnerable</span>${seg('dvul', [[0, 'None'], [1, 'N-S'], [2, 'E-W'], [3, 'Both']], v.vul)}</div>
   ${err ? `<div class="err">${err}</div>` : ''}
   <div class="row2"><button class="btn gold" id="dPlay">Play this deal</button><button class="btn" id="oClose">Cancel</button></div>`);
}
function readDealForm() {
  const v = ui.dealForm; if (!$('dPbn')) return v;
  v.pbn = $('dPbn').value; for (let s = 0; s < 4; s++) v.h[s] = $('dH' + s).value; return v;
}
function startEnteredDeal() {
  const v = readDealForm();
  try {
    let hands = v.pbn.trim() ? parsePBN(v.pbn) : v.h.map(parseHand);
    if (!hands) throw new Error('Could not read the PBN code. It should look like N:AKQ2.K73.J5.T942 … with four hands.');
    const used = new Set(), empty = [];
    hands.forEach((h, s) => { if (!h) { empty.push(s); return; } for (const c of h) { if (used.has(c)) throw new Error('The card ' + RTXT[R(c)] + SUIT[S(c)] + ' appears twice.'); used.add(c); } });
    if (empty.length === 1) hands[empty[0]] = [...Array(52).keys()].filter(c => !used.has(c));
    else if (empty.length) throw new Error('Enter at least three hands.');
    hands.forEach((h, s) => { if (h.length !== 13) throw new Error(SEAT[s] + ' has ' + h.length + ' cards, it needs 13.'); });
    let bn = 1; for (let b = 1; b <= 16; b++) if (dealerOf(b) === v.dealer && vulOf(b, 0) === (v.vul === 1 || v.vul === 3) && vulOf(b, 1) === (v.vul === 2 || v.vul === 3)) { bn = b; break; }
    closeOv(); newBoard(hands, bn);
  } catch (e) { showDealEntry(e.message); }
}

function showResults() {
  const per = Store.periods(HIST), isImp = SET.mode === 'IMP', tab = ui.resTab;
  let body;
  if (tab === 'stats') {
    body = `<table class="res"><thead><tr><th>Period</th><th class="n">Boards</th><th class="n">${isImp ? 'IMPs' : 'MP %'}</th><th class="n">${isImp ? 'IMP/board' : 'IMPs'}</th><th class="n">Points</th></tr></thead><tbody>${per.map(p => `<tr><td>${p.name}</td><td class="n">${p.n}</td><td class="n">${isImp ? (p.scored ? fmtSigned(p.impSum) : '—') : (p.mpAvg != null ? p.mpAvg : '—')}</td><td class="n">${isImp ? (p.impAvg != null ? fmtSigned(p.impAvg) : '—') : (p.scored ? fmtSigned(p.impSum) : '—')}</td><td class="n">${fmtSigned(p.pts)}</td></tr>`).join('')}</tbody></table>
     <div class="muted">IMP: each of your results is compared with 8 robot tables (average cross-IMPs). MP: your percentage against the same field.</div>`;
  } else {
    const rows = HIST.slice(-100).reverse().map(e => `<tr><td>${new Date(e.ts || 0).toLocaleDateString()}</td><td>${e.board}</td><td>${e.passed ? 'Pass' : conKey(e.c)}</td><td>${e.passed ? '' : e.tricks}</td><td class="n">${fmtSigned(e.us || 0)}</td><td class="n">${e.imp == null ? '—' : isImp ? fmtSigned(e.imp) : e.mp + '%'}</td></tr>`).join('');
    body = `<table class="res"><thead><tr><th>Date</th><th>Board</th><th>Contract</th><th>Tricks</th><th class="n">Score</th><th class="n">${isImp ? 'IMP' : 'MP'}</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No boards played yet.</td></tr>'}</tbody></table>`;
  }
  openOv('res', `<h2>Results</h2><div class="seg" data-seg="restab"><button data-v="stats" class="${tab === 'stats' ? 'on' : ''}">Statistics</button><button data-v="list" class="${tab === 'list' ? 'on' : ''}">Boards</button></div>${body}<div class="row2"><button class="btn gold" id="oClose">Close</button></div>`);
}

/* ================= events ================= */
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.conv) {
    const k = t.dataset.conv, c = E.CONVS.find(y => y.k === k);
    SET.conv[k] = t.checked;
    if (t.checked && c && c.x) SET.conv[c.x] = false;
    if (!t.checked && SET.practice === k) SET.practice = "";
    Store.saveSettings(SET); save(); showSettings();
  }
  if (t.id === "sPractice") { SET.practice = t.value; if (t.value) { SET.conv[t.value] = true; const c = E.CONVS.find(y => y.k === t.value); if (c && c.x) SET.conv[c.x] = false; } Store.saveSettings(SET); save(); showSettings(); }
});
document.addEventListener('click', ev_ => {
  const t = ev_.target.closest('button,[data-c],[data-ai],#toast,#dExpl'); if (!t) return;
  if (t.id === 'dExpl') { ui.lastExpl = null; ui.hintBid = null; render(); return; }
  if (t.id === 'toast') { ui.toast = null; render(); return; }
  if (t.dataset.ai != null) { ui.lastExpl = ui.lastExpl === +t.dataset.ai ? null : +t.dataset.ai; ui.hintBid = null; if (ui.overlay === 'auc') showAuction(); else render(); return; }
  if (t.dataset.lvl) { ui.selLvl = +t.dataset.lvl; renderBidbox(); return; }
  if (t.dataset.call != null && G.phase === 'bid' && bidTurn() === U()) { const v = t.dataset.call; const c = (v === 'P' || v === 'X' || v === 'XX') ? v : +v; if (c !== -1) makeCall(U(), c); return; }
  if (t.dataset.c != null && t.classList.contains('play')) { const c = +t.dataset.c; const seat = G.play.turn; if (G.play.hands[seat].includes(c)) playCard(seat, c); return; }
  if (t.closest('.seg')) {
    const seg = t.closest('.seg').dataset.seg, v = t.dataset.v;
    if (seg === 'restab') { ui.resTab = v; showResults(); return; }
    if (seg === 'ddealer' || seg === 'dvul') { readDealForm(); ui.dealForm[seg === 'ddealer' ? 'dealer' : 'vul'] = +v; showDealEntry(); return; }
    if (seg === 'seat') SET.seat = +v; if (seg === 'speed') SET.speed = +v; if (seg === 'expl') SET.expl = v === '1'; if (seg === 'auto') SET.auto = v === '1';
    if (seg === 'mode') SET.mode = v; if (seg === 'opp') SET.opp = v;
    Store.saveSettings(SET); save(); showSettings(); render(); return;
  }
  switch (t.id) {
    case 'bNew': case 'oNext2':
      if (t.id === 'oNext2' || G.phase === 'done' || ui.confirmNew > Date.now()) { ui.confirmNew = 0; newBoard(); }
      else { ui.confirmNew = Date.now() + 3000; renderBar(); setTimeout(renderBar, 3100); }
      break;
    case 'bAuc': showAuction(); break;
    case 'oShow': showEnd(); break;
    case 'bHint':
      if (G.phase === 'bid' && bidTurn() === U()) { ui.hintBid = E.aiBid(G.auction, U(), G.deal[U()], G.cards); SET.expl = true; render(); }
      else if (G.phase === 'play' && userControls(G.play.turn) && G.play.trick.length < 4) { ui.hintCard = E.aiPlay(G.play, G.play.turn); render(); }
      break;
    case "bClaim": claim(); break;
    case "bUndo": undo(); break;
    case "sDeal": showDealEntry(); break;
    case "dPlay": startEnteredDeal(); break;
    case "dExpl": ui.lastExpl = null; ui.hintBid = null; render(); break;
    case 'bSet': showSettings(); break;
    case 'bRes': showResults(); break;
    case 'oClose': closeOv(); break;
    case 'sReset': HIST = []; save(); showSettings(); render(); break;
    case "sSave": { const v = ($("syncToken") || {}).value; if (v) { GitSync.setToken(v); syncState.msg = ""; syncNow(); showSettings(); } break; }
    case "sNow": syncNow(); break;
    case "sOff": GitSync.setToken(null); syncState.msg = ""; showSettings(); break;
    case 'oNext': newBoard(); break;
    case 'oReplay': { const d = G.deal; HIST = HIST.filter(h => h.id !== G.id); BOARD = G.board; newBoard(d); break; }
  }
});
$('ov').addEventListener('click', e => { if (e.target.id === 'ov') closeOv(); });
window.addEventListener('resize', layoutFans);

/* ================= boot ================= */
function start(data) {
  load(data && data.G ? data : null);
  Field.init();
  if (!G || !G.deal || !G.cards) newBoard();
  else {
    if (!G.field || !G.field.done) Field.start(G); else Field.live[G.id] = { f: G.field, deal: G.deal, board: G.board };
    render(); if (G.phase === 'done') showEnd(); tick();
  }
  Store.initCloud(mergeCloud);
  syncNow(true);
  window.addEventListener("online", () => syncNow(true));
  // installable/offline app when served from a normal web address
  if ('serviceWorker' in navigator && document.querySelector('link[rel=manifest]') && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.claude?.hot?.snapshot?.(() => ({ SET, G, HIST, BOARD }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
