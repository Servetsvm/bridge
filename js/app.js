/* Bridge Table — screen, game flow, field comparison and settings. */
'use strict';
const E = {}; for (const f of window.BRIDGE) f(E);
const { SUIT, STR, RTXT, SEAT, S, R, pd, sideOf, B, LV, ST, isNum, vulOf, dealerOf, callTxt, legalCalls, isLegal, auctionOver, contractOf, ev, scoreOf } = E;

let SET = { style: "classic", seat: 2, speed: 1, expl: true, auto: true, mode: 'IMP', opp: 'same', conv: { ...E.ALL_ON } };
let G = null, HIST = [], BOARD = 0, timer = null;
const ui = { selLvl: 0, hintBid: null, hintCard: null, lastExpl: null, toast: null, confirmNew: 0, overlay: null, resTab: 'stats' };
const online = () => typeof Net !== "undefined" && Net.on;
const guest = () => typeof Net !== "undefined" && Net.guest;
const U = () => (guest() ? Net.st.seat : SET.seat);
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
  if (online() && Net.host) Net.broadcast();
  const slim = HIST.map((h, i) => (i < HIST.length - 60 ? { ...h, deal: undefined, fieldList: undefined, auc: undefined, pl: undefined } : h));
  Store.saveLocal({ SET, G: guest() ? Net.st.savedG : (G && G.phase === "idle" ? ui.saved || null : G), HIST: slim, BOARD });
}
function load(d) {
  d = d || Store.loadLocal();
  if (d) { SET = Object.assign(SET, d.SET || {}); G = d.G || null; HIST = d.HIST || []; BOARD = d.BOARD || 0; }
  if (G && G.phase === "lobby") G = null; // an online waiting room is not restored after a restart
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
/* the virtual field: 10 expert robot tables play the same deal in two background workers;
   double-dummy checks run in a third worker that is restarted for every new board, so nothing waits behind an old job */
const FIELD_N = 10, FIELD_PARTS = 2;
const Field = {
  live: {}, fw: [], dw: null, ddBoard: null, src: null,
  mk() {
    try {
      if (!this.src) this.src = URL.createObjectURL(new Blob(['const E={};\n' + window.BRIDGE.map(f => '(' + f.toString() + ')(E);').join('\n') + '\n(' + E.workerMain.toString() + ')(E);'], { type: 'text/javascript' }));
      const w = new Worker(this.src);
      w.onmessage = e => this.onmsg(e.data);
      return w;
    } catch (e) { return null; }
  },
  init() {},
  start(g) {
    const f = { tables: [], n: FIELD_N, done: false, dd: {}, normC: null, parts: 0, t0: Date.now() };
    g.field = f; this.live[g.id] = { f, deal: g.deal, board: g.board };
    this.fw.forEach(w => w && w.terminate()); this.fw = [];
    const per = Math.ceil(FIELD_N / FIELD_PARTS);
    for (let p = 0; p < FIELD_PARTS; p++) {
      const w = this.mk(), msg = { type: 'field', id: g.id, deal: g.deal, board: g.board, cards: g.cards, from: p * per, to: Math.min(FIELD_N, (p + 1) * per) };
      if (!w) { this.fallback(msg); continue; }
      w.onerror = () => this.partDone(g.id);
      this.fw.push(w); w.postMessage(msg);
    }
    // safety net: if a worker is stopped by the phone, finish with the tables we have
    clearTimeout(this.watch); this.watch = setTimeout(() => { const L = this.live[g.id]; if (L && !L.f.done) { L.f.parts = FIELD_PARTS - 1; this.partDone(g.id); } }, 6 * 60000);
  },
  partDone(id) {
    const L = this.live[id]; if (!L || L.f.done) return;
    if (++L.f.parts >= FIELD_PARTS) this.onmsg({ type: 'fieldDone', id });
  },
  dd(id, key, deal, c) {
    if (this.ddBoard !== id || !this.dw) { if (this.dw) this.dw.terminate(); this.dw = this.mk(); this.ddBoard = id; if (this.dw) this.dw.onerror = () => this.onmsg({ type: 'dd', id, key, t: null }); }
    if (this.dw) this.dw.postMessage({ type: 'dd', id, key, deal, c, limit: 4e7 });
    else setTimeout(() => this.onmsg({ type: 'dd', id, key, t: E.ddContract(deal, c, 1.5e6) }), 50);
  },
  fallback(msg) {
    let i = msg.from;
    const step = () => {
      if (i >= msg.to) { this.partDone(msg.id); return; }
      const r = E.simulateTable(msg.deal, msg.board, msg.cards, E.FIELD_AGG[i % E.FIELD_AGG.length]);
      this.onmsg({ type: 'table', id: msg.id, i, r }); i++; setTimeout(step, 30);
    };
    setTimeout(step, 500);
  },
  onmsg(m) {
    const L = this.live[m.id]; if (!L) return; const f = L.f;
    if (m.type === 'table') f.tables.push(m.r);
    if (m.type === 'part') { this.partDone(m.id); return; }
    if (m.type === 'fieldDone' && !f.done) {
      f.done = true;
      const cnt = {}; let best = null;
      for (const t of f.tables) { if (t.passed) continue; const k = conId(t.c); cnt[k] = (cnt[k] || 0) + 1; if (!best || cnt[k] > cnt[conId(best)]) best = t.c; }
      f.normC = best;
      if (best) this.dd(m.id, 'norm', L.deal, best);
      const e = HIST.find(h => h.id === m.id);
      if (e) { applyField(e, f); Store.saveRec(e); scheduleSync(); }
    }
    if (m.type === 'dd') { f.dd[m.key] = m.t; const e = HIST.find(h => h.id === m.id); if (e) e.dd = { ...f.dd }; }
    if (m.type === 'error') this.partDone(m.id);
    if (G && G.id === m.id) { save(); if (ui.overlay === 'end') showEnd(); if (G.phase === 'done') render(); else renderBar(); }
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
  Object.assign(ui, { selLvl: 0, hintBid: null, hintCard: null, lastExpl: null, toast: null, overlay: null, photoMsg: null, photoHands: null, signal: null });
  $('ov').hidden = true;
  Field.start(G);
  save(); render(); tick();
}
const bidTurn = () => (G.dealer + G.auction.length) % 4;

/* ---- undo: a snapshot is taken right before each call or card of yours ---- */
const UNDO = [];
const ME = () => (online() ? Net.me : "local");
// who acted at a seat: a human id ("local" offline) or "robot"
const actor = seat => (online() ? Net.owner(seat) : (G.phase === "bid" ? (seat === U() ? "local" : "robot") : (userControls(seat) ? "local" : "robot")));
function pushUndo(by) { const { field, ...rest } = G; UNDO.push({ by: by || "local", s: JSON.stringify(rest) }); if (UNDO.length > 120) UNDO.shift(); }
/* take back the last call or card of player "who" (and everything played after it) */
function undo(who) {
  who = who || ME();
  if (guest()) { Net.send({ t: "undo" }); return; }
  let i = UNDO.length - 1; while (i >= 0 && UNDO[i].by !== who) i--;
  if (i < 0) return false;
  clearTimeout(timer);
  const wasDone = G.phase === "done", id = G.id, snap = UNDO[i];
  UNDO.length = i;
  G = JSON.parse(snap.s);
  G.field = Field.live[id] ? Field.live[id].f : null;
  if (wasDone) { HIST = HIST.filter(h => h.id !== id); closeOv(); }
  Object.assign(ui, { selLvl: 0, hintBid: null, hintCard: null, toast: null });
  save(); render(); tick();
  return true;
}
function makeCall(seat, call, m) {
  if (guest()) { if (bidTurn() === seat && userControls(seat)) { ui.selLvl = 0; ui.hintBid = null; Net.send({ t: "call", call }); } return; }
  if (G.phase !== "bid" || bidTurn() !== seat || !isLegal(G.auction, seat, call)) return;
  { const who = actor(seat); if (who !== "robot") pushUndo(who); }
  if (!m) m = E.explainCall(G.auction, seat, call, G.cards);
  G.auction.push({ seat, call, m });
  ui.selLvl = 0; ui.hintBid = null;
  if (auctionOver(G.auction)) {
    const c = contractOf(G.auction);
    if (!c) { finishBoard(); return; }
    G.play = E.newPlayState(G.deal, c, G.auction, G.cards); G.phase = 'play';
    Field.dd(G.id, 'you', G.deal, c);
    const us = sideOf(c.decl) === sideOf(U());
    flash(us ? (c.decl === U() ? 'You are declarer' : 'Partner is declarer — you play both hands') : 'You are defending', 1800);
  }
  save(); render(); tick();
}
function userControls(seat) {
  if (online()) return Net.owner(seat) === Net.me;
  if (!G.play) return seat === U();
  return seat === U() || (sideOf(G.play.contract.decl) === sideOf(U()) && sideOf(seat) === sideOf(U()));
}
function playCard(seat, c) {
  const g = G.play;
  if (guest()) { if (userControls(seat)) Net.send({ t: "card", c }); return; }
  if (G.phase !== "play" || g.turn !== seat || g.trick.length >= 4 || !E.legalFor(g, seat).includes(c)) return;
  { const who = actor(seat); if (who !== "robot") pushUndo(who); }
  // explain the signal when your robot partner (on defence) discards or encourages
  if (!userControls(seat) && g.history.length < 3 && sideOf(seat) === sideOf(U()) && sideOf(g.contract.decl) !== sideOf(U())) { const t = E.signalText(g, seat, c); if (t) ui.signal = t; }
  else if (userControls(seat) && !g.trick.length) ui.signal = null;
  E.applyCard(g, seat, c); ui.hintCard = null; ui.showLast = false;
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
  // the auction and the cards played trick by trick, for looking back at the board from Results
  e.dealer = G.dealer;
  e.auc = G.auction.map(a => [a.seat, a.call]);
  if (g) { e.pl = g.history.map(t => t.cards.map(x => [x.s, x.c])); if (G.claimed) e.claimedAt = g.history.length; }
  if (G.field) { applyField(e, G.field); e.dd = { ...(G.field.dd || {}) }; }
  G.result = e; G.phase = 'done';
  HIST = HIST.filter(h => h.id !== e.id); HIST.push(e);
  Store.saveRec(e);
  save(); render();
  scheduleSync();
}
function tick() {
  clearTimeout(timer); if (!G || guest()) return; // when you are a guest, the host runs the table
  const robot = s => online() ? Net.owner(s) === "robot" : (G.phase === "bid" ? s !== U() : !userControls(s));
  if (G.phase === "bid") {
    const t = bidTurn();
    if (robot(t)) timer = setTimeout(() => { const r = E.aiBid(G.auction, t, G.deal[t], G.cards); makeCall(t, r.call, r.m); }, delay());
  } else if (G.phase === 'play') {
    const g = G.play;
    if (g.trick.length === 4) timer = setTimeout(collectTrick, Math.max(700, delay() + 300));
    else if (robot(g.turn)) { const t = g.turn; timer = setTimeout(() => playCard(t, E.aiPlay(g, t)), delay()); }
    else if (!userControls(g.turn)) { /* a friend is to play */ }
    else { const leg = E.legalFor(g, g.turn); if (leg.length === 1 && g.trick.length > 0 && SET.auto) timer = setTimeout(() => playCard(g.turn, leg[0]), 450); }
  }
}
function claim(seat) {
  if (guest()) { Net.send({ t: "claim" }); return; }
  const g = G.play; if (!g || G.phase !== "play" || g.trick.length) return;
  const side = sideOf(seat == null ? U() : seat);
  const v = E.ddFull(g.hands, g.leader, side, g.trump, 3e6);
  if (v == null) { flash('Could not work it out yet — play a little longer', 1500); return; }
  const left = g.hands[g.leader].length;
  g.tricks[side] += v; g.tricks[1 - side] += left - v; g.hands = g.hands.map(() => []); G.claimed = true;
  finishBoard();
}
/* play the same deal again (at an online table: for everyone) */
function replayDeal() {
  if (guest()) { Net.send({ t: "replay" }); HIST = HIST.filter(h => h.id !== G.id); closeOv(); return; }
  const d = G.deal; HIST = HIST.filter(h => h.id !== G.id); BOARD = G.board; newBoard(d);
}
function flash(msg, ms) { ui.toast = msg; render(); setTimeout(() => { if (ui.toast === msg) { ui.toast = null; render(); } }, ms); }

/* ================= rendering ================= */
// the seat drawn at the bottom: normally yours; while your robot partner declares and you play both hands,
// the declarer's hand (for that board only — it switches back when the board ends)
const viewSeat = () => { if (G && G.phase === 'play' && G.play) { const d = G.play.contract.decl; if (d === pd(U()) && userControls(d)) return d; } return U(); };
const rel = seat => (seat - viewSeat() + 4) % 4;
const ORDER = [3, 2, 0, 1];
const sortHand = h => h.slice().sort((a, b) => ORDER.indexOf(S(a)) - ORDER.indexOf(S(b)) || R(b) - R(a));
function cardHtml(c, cls) {
  const s = S(c), r = R(c), face = r >= 9 && r <= 11;
  return `<div class="card${red(s) ? ' rd' : ''}${face ? ' face' : ''}${cls ? ' ' + cls : ''}" data-c="${c}"><span class="ix"><b>${RTXT[r]}</b><i>${SUIT[s]}</i></span><span class="pip">${face ? `<em>${RTXT[r]}</em>` : ''}${SUIT[s]}</span></div>`;
}
const handsNow = () => G.phase === "play" ? G.play.hands : G.deal;
function isVisible(seat) {
  if (guest()) return handsNow()[seat].every(c => c >= 0); // the host only sends the cards you may see
  if (seat === U() || G.phase === "done") return true;
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
    o += `<div class="row"><span class="sy${red(s) ? ' red' : ''}">${SUIT[s]}</span>${cs.map(c => `<span class="mini${red(s) ? " rd" : ""}${ctl ? (leg.includes(c) ? " play" : " dim") : ""}${c === ui.hintCard ? " hint" : ""}" data-c="${c}">${RTXT[R(c)]}<i>${SUIT[s]}</i></span>`).join('')}</div>`;
  }
  return o + '</div>';
}
function seatLabel(seat) {
  const g = G.play, tags = [];
  if (seat === G.dealer && G.phase === 'bid') tags.push('<span class="tag">D</span>');
  if (g && seat === g.contract.decl) tags.push('<span class="tag">Decl</span>');
  if (g && seat === g.dummy) tags.push('<span class="tag">Dummy</span>');
  const nm = online() && Net.st.names[seat];
  // your own seat shows your name (the one you use at online tables), other seats the player's name or "Robot"
  let myNm = ""; try { myNm = localStorage.getItem("bridge-table-name") || ""; } catch (e) {}
  const mine = (online() && Net.st.names[U()]) || myNm;
  const who = seat === U() ? (mine || "You") : nm ? nm + (g && userControls(seat) ? " (you play)" : "") : (g && userControls(seat) ? "You play" : "Robot");
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
  const canClaim = G.phase === "play" && !g.trick.length && userControls(g.turn) && g.hands[g.turn].length <= 8 && g.hands[g.turn].length > 0;
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
     <button class="btn" id="bUndo" ${(guest() ? G.phase !== "done" || true : UNDO.some(u => u.by === ME())) ? "" : "disabled"}>Undo</button>${online() ? `<button class="btn${Net.st.unread ? " gold" : ""}" id="bChat">Chat${Net.st.unread ? " (" + Net.st.unread + ")" : ""}</button>` : ""}
     <button class="btn gold" id="bHint">Hint</button>
     <button class="btn" id="bClaim" ${canClaim ? '' : 'disabled'}>Claim</button>
     <button class="btn${online() ? " gold" : ""}" id="bNet">${online() ? "Online ●" : "Online"}</button>
     <button class="btn" id="bHelp">Help</button>
     <button class="btn" id="bSet">Settings</button>
     <button class="btn" id="bRes">Results</button>
   </div>`;
}
function explHtml(e, prefix) {
  if (!e) return 'Tap any call to see what it means.';
  const m = e.m || {}, ci = m.cv ? E.convInfo(m.cv) : null;
  return `<b>${prefix || SEAT[e.seat] + ':'} ${callHtml(e.call)}</b> — ${symText(m.t)}${ci ? `<div class="cv"><span>${ci.n}</span>${symText(ci.d)}</div>` : ''}`;
}
// rv: a finished board from Results ({ board, dealer, seat, sel }): its calls are tapped with data-ri
function auctionTable(auction, phaseBid, rv) {
  const cols = [3, 0, 1, 2], board = rv ? rv.board : G.board, me = rv ? rv.seat : U(), sel = rv ? rv.sel : ui.lastExpl;
  let o = '<table><thead><tr>' + cols.map(s => `<th class="${vulOf(board, s) ? 'v' : ''} ${s === me ? 'me' : ''}">${SEAT[s]}</th>`).join('') + '</tr></thead><tbody><tr>';
  let col = cols.indexOf(rv ? rv.dealer : G.dealer); for (let i = 0; i < col; i++) o += '<td></td>';
  auction.forEach((e, i) => { o += `<td><span class="c${i === sel ? ' sel' : ''}${e.m && e.m.cv ? ' cvb' : ''}" ${rv ? 'data-ri' : 'data-ai'}="${i}">${callHtml(e.call)}</span></td>`; col++; if (col === 4) { o += '</tr><tr>'; col = 0; } });
  if (phaseBid) o += '<td>?</td>';
  return o + '</tr></tbody></table>';
}
function auctionPanel() {
  // the explanation appears only when you tap a call (or ask for a hint); tap again to close it
  const e = ui.hintBid ? { call: ui.hintBid.call, m: ui.hintBid.m } : (ui.lastExpl != null ? G.auction[ui.lastExpl] : null);
  const ex = e ? explHtml(e, ui.hintBid ? 'Suggestion:' : null) : '';
  return `<div class="auction">${auctionTable(G.auction, G.phase === 'bid')}</div>${e && SET.expl ? `<div class="expl" id="dExpl" role="button" tabindex="0">${ex}</div>` : `<div class="muted tap">Tap a call to see what it means</div>`}`;
}
/* online waiting room: who sits where, free seats to take, and the host's Start button */
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
// start screen: shown when the app opens, before anything is dealt
function idleG() { const g = lobbyG(); g.id = "idle"; g.phase = "idle"; return g; }
// Start on the start screen: carry on with the saved board, or deal a new one
function resume() {
  const s = ui.saved; ui.saved = null;
  if (!s || s.phase === "done") { newBoard(); return; }
  G = s; if (!G.field || !G.field.done) Field.start(G); else Field.live[G.id] = { f: G.field, deal: G.deal, board: G.board };
  render(); tick();
}
function idleHtml() {
  const cont = ui.saved && ui.saved.phase !== "done";
  return `<div class="lobby"><h3>Bridge Table</h3><div class="muted">Nothing is dealt yet. ${cont ? "Your last board is waiting." : ""}</div>
    <div class="row2"><button class="btn new" id="bGo">${cont ? "Continue" : "Start"}</button><button class="btn" id="bNet">Online</button></div>
    ${typeof Net !== "undefined" ? Net.pendHtml() + `<h3>Open tables</h3>` + Net.tablesHtml() : ""}</div>`;
}
function lobbyG() {
  const bn = BOARD + 1;
  return { id: "lobby-" + Date.now().toString(36), board: bn, dealer: dealerOf(bn), deal: [[], [], [], []], auction: [], phase: "lobby", play: null, result: null, claimed: false, field: null, cards: sideCards() };
}
/* a small card table: who sits at each side (cells by seat) and something on the felt in the middle;
   bottom: the seat drawn at the bottom */
function seatTable(cells, mid, bottom) {
  const pos = s => ["s", "w", "n", "e"][(s - bottom + 4) % 4];
  return `<div class="tbl">${[0, 1, 2, 3].map(s => `<div class="tseat ${pos(s)}"><small>${SEAT[s]}</small>${cells[s]}</div>`).join("")}<div class="tmid">${mid}</div></div>`;
}
// the waiting room of an online table, drawn as the table itself
function lobbyHtml() {
  const nm = Net.st.names || {}, me = U(), away = Net.st.away || {};
  const cell = s => {
    const who = nm[s];
    if (!who) return `<i>Robot</i>${guest() ? `<button class="btn" data-sit="${s}">Sit here</button>` : ""}`;
    return `<b>${esc(who)}${s === me ? " (you)" : ""}</b>${away[s] ? "<em>away · robot plays</em>" : ""}${!guest() && s !== me ? `<button class="btn" data-kick="${s}">Remove</button>` : ""}`;
  };
  const mid = guest() ? `<div class="muted">Waiting for the host to start.<br>“Sit here” asks the host to move you.</div>`
    : `<button class="btn new" id="bStart">Start</button><button class="btn" id="bNet">Online</button>`;
  return `<div class="lobby"><h3>Online table</h3>${guest() ? "" : Net.pendHtml()}${seatTable([0, 1, 2, 3].map(cell), mid, me)}</div>`;
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
  $("table").classList.toggle("lobby", G.phase === "lobby" || G.phase === "idle"); document.body.classList.toggle("inlobby", G.phase === "lobby" || G.phase === "idle");
  if (G.phase === "lobby" || G.phase === "idle") { C.innerHTML = G.phase === "idle" ? idleHtml() : lobbyHtml(); return; }
  if (G.phase === 'bid') C.innerHTML = auctionPanel();
  else if (G.phase === 'play') {
    // tap the table to look at the last finished trick; tap again (or wait) to come back
    const H = G.play.history, last = ui.showLast && H.length ? H[H.length - 1] : null;
    const tr = last ? last.cards : G.play.trick, w = last ? last.w : (tr.length === 4 ? E.trickWinner(tr, G.play.trump) : -1);
    C.innerHTML = `<div class="trick${last ? " lasttrick" : ""}" id="trickArea">` + tr.map(x => cardHtml(x.c, "tc p" + rel(x.s) + (x.s === w ? " win" : ""))).join("") + (last ? `<div class="lastlbl">Last trick (${H.length}) — won by ${SEAT[last.w]}</div>` : (H.length && !tr.length ? `<div class="lasthint">Tap here to see the last trick</div>` : "")) + "</div>";
  } else {
    // end of board: all four hands stay open on the table, the result sits in a banner in the middle
    const e = G.result;
    C.innerHTML = e ? `<button class="donebanner" id="oShow">${resultLine(e)}${e.imp != null ? `<small>${fmtSigned(e.imp)} IMP · ${e.mp}% MP</small>` : (G.field && !G.field.done ? `<small>Robot tables: ${G.field.tables.length}/${G.field.n || 10}…</small>` : "")}<small>Tap for details</small></button><button class="btn new" id="oNext2" style="align-self:center;margin-top:8px">Next deal</button>` : '';
  }
  if (ui.toast) C.insertAdjacentHTML('beforeend', `<div class="toast" id="toast">${ui.toast}</div>`);
  layoutFans();
}
function layoutFans() {
  document.querySelectorAll('.fan').forEach(el => {
    const n = el.children.length; if (!n) return;
    const W = el.clientWidth, max = +el.dataset.max || 70;
    if (SET.style !== "modern") { const cw = Math.max(20, Math.min(60, (W - (n - 1)) / n)); el.style.setProperty("--cw", cw + "px"); el.style.setProperty("--ov", "1px"); return; }
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
  let s = "";
  // at an online table the player's name is shown when a friend (not a robot) is to act
  const nameOf = seat => { if (!online()) return SEAT[seat]; const o = Net.owner(seat), at = Object.keys(Net.st.names).find(k => (Net.guest ? Net.st.ctl[k] : (Net.st.seats[k] || "robot")) === o); return o !== "robot" && at != null ? Net.st.names[at] : SEAT[seat]; };
  if (G.phase === 'bid') s = bidTurn() === U() ? 'Your call' : `${nameOf(bidTurn())} is thinking…`;
  else if (G.phase === 'play') { const g = G.play; if (g.trick.length === 4) s = 'Gathering the trick…'; else if (userControls(g.turn)) s = g.turn === U() ? 'Your turn: play a card' : `Play from ${SEAT[g.turn]}'s hand`; else s = `${nameOf(g.turn)} is playing…`; }
  else if (G.phase === "idle") s = "Press Start to deal";
  else if (G.phase === "lobby") s = guest() ? "Waiting for the host to start" : "Waiting for players — press Start when everyone is seated";
  else s = 'Board finished';
  $("status").innerHTML = s + (ui.signal && G.phase === "play" ? `<div class="sig">${symText(ui.signal)}</div>` : "");
}
function render() { if (!G) return; document.body.classList.toggle("classic", SET.style !== "modern"); renderBar(); renderTable(); renderBidbox(); renderStatus(); }

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
function closeOv() { if (ui.overlay === 'deal') { ui.photoHands = null; ui.photoMsg = null; } if (ui.overlay === 'rev') stopRev(); ui.overlay = null; $('ov').hidden = true; }
function showEnd() {
  const e = G.result; if (!e) return;
  const f = G.field || { tables: [], done: false, dd: {} };
  const ddTxt = (k, c) => { const v = f.dd[k]; if (v === undefined) return 'calculating…'; if (v === null) return 'not available'; const d = v - (c.level + 6); return `${v} tricks (${d >= 0 ? 'makes' : 'down ' + -d})`; };
  let fieldHtml;
  if (!f.done) fieldHtml = `<div class="muted">The robot tables are playing this deal… (${f.tables.length}/${f.n || 10})</div>`;
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
   <button class="btn gold guide" id="bHelp2">📘 User guide — English · Norsk · Türkçe</button>
   <div class="grp"><span>Practice a convention</span><select id="sPractice" class="sel"><option value="">Off — normal random deals</option>${E.CONVS.map(c => `<option value="${c.k}" ${SET.practice === c.k ? 'selected' : ''}>${c.n}</option>`).join('')}</select><div class="muted">New deals are chosen so that you (or your partner) get to use this convention. It is switched on in your card automatically.</div></div>
   <div class="grp"><span>Play a specific deal</span><button class="btn" id="sDeal">Enter a deal (from a photo or a hand record)</button></div>
   <div class="grp"><span>Card style</span>${seg("style", [["classic", "Classic tiles"], ["modern", "Modern fan"]], SET.style || "classic")}</div>
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
/* ---- user guide in three languages: open it, or download it to read offline ---- */
function showHelp() {
  const base = /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) ? "" : "https://servetsvm.github.io/bridge/";
  const row = (file, name, flag) => `<div class="helprow"><span>${flag} <b>${name}</b></span><a class="btn" href="${base}${file}" target="_blank" rel="noopener">Open</a><a class="btn gold" href="${base}${file}" download="${file.replace(".html", "")}-bridge-table.html">Download</a></div>`;
  openOv("help", `<h2>User guide</h2>
   <div class="muted">Explains every button and every option in Settings, the convention card, reading a deal from a photo, and syncing your phone and PC. Download it to keep it on your device and read it offline.</div>
   ${row("guide-en.html", "English", "🇬🇧")}${row("guide-no.html", "Norsk", "🇳🇴")}${row("guide.html", "Türkçe", "🇹🇷")}
   <div class="row2"><button class="btn gold" id="oClose">Close</button></div>`);
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
   <div class="row2"><label class="btn gold" for="dPhoto" role="button">📷 Read from a photo or screenshot</label><input type="file" id="dPhoto" accept="image/*" hidden></div>
   <div class="muted">Works with the end-of-board screen of your bridge app (four open hands) and with hand records that list ♠ ♥ ♦ ♣ for each hand. The picture is only read on this device: it is not saved or uploaded, and it is cleared from memory as soon as the cards are read. The cards it reads appear below as a code — check them before you play. You can also type the hands: spades.hearts.diamonds.clubs, e.g. <b>AKQ2.K73.J5.T942</b> (T = 10). Leave one hand empty and it is filled with the remaining cards.</div>
   ${ui.photoMsg ? `<div class="${ui.photoErr ? "err" : "okmsg"}">${ui.photoMsg}</div>` : ""}
   ${ui.photoHands ? dealHtml(ui.photoHands.map(h => h || []), U()) : ""}
   <div class="grp"><span>PBN code (optional)</span><input id="dPbn" class="tok wide" placeholder="N:AKQ2.K73.J5.T942 ..." value="${v.pbn.replace(/"/g, '&quot;')}"></div>
   ${[0, 1, 2, 3].map(s => `<div class="grp"><span>${SEAT[s]}</span><input id="dH${s}" class="tok wide" placeholder="AKQ2.K73.J5.T942" value="${v.h[s].replace(/"/g, '&quot;')}"></div>`).join('')}
   <div class="grp"><span>Dealer</span>${seg('ddealer', [[0, 'North'], [1, 'East'], [2, 'South'], [3, 'West']], v.dealer)}</div>
   <div class="grp"><span>Vulnerable</span>${seg('dvul', [[0, 'None'], [1, 'N-S'], [2, 'E-W'], [3, 'Both']], v.vul)}</div>
   ${err ? `<div class="err">${err}</div>` : ''}
   <div class="row2"><button class="btn gold" id="dPlay">Play this deal</button><button class="btn" id="oClose">Cancel</button></div>`);
}
async function readPhoto(file) {
  readDealForm();
  ui.photoMsg = "Reading the picture…"; ui.photoErr = false; ui.photoHands = null; showDealEntry();
  await new Promise(r => setTimeout(r, 30));
  try {
    const r = await Photo.read(file);
    const counts = r.hands.map((h, s) => SEAT[s] + ' ' + (h ? h.length : 0));
    const total = r.hands.reduce((a, h) => a + (h ? h.length : 0), 0);
    ui.dealForm.pbn = r.pbn; ui.dealForm.h = ["", "", "", ""]; ui.photoHands = r.hands;
    const full = r.hands.filter(h => h && h.length === 13).length;
    ui.photoErr = full < 3;
    ui.photoMsg = (full >= 3 ? `Read ${total} cards (${counts.join(', ')}). Check the code, then press Play this deal.` : `Only part of the deal could be read (${counts.join(', ')}). Fix the code below before playing.`);
  } catch (e) { ui.photoErr = true; ui.photoMsg = e.message; }
  showDealEntry();
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
    ui.photoHands = null; ui.photoMsg = null; ui.dealForm = null;
    closeOv(); newBoard(hands, bn);
  } catch (e) { showDealEntry(e.message); }
}

function showResults() {
  const per = Store.periods(HIST), isImp = SET.mode === 'IMP', tab = ui.resTab;
  let body;
  if (tab === 'stats') {
    body = `<div class="resscroll"><table class="res"><thead><tr><th>Period</th><th class="n">Boards</th><th class="n">IMPs</th><th class="n">IMP/bd</th><th class="n">MP %</th><th class="n">Points</th></tr></thead><tbody>${per.map(p => `<tr><td>${p.name}</td><td class="n">${p.n}</td><td class="n">${p.scored ? fmtSigned(p.impSum) : "—"}</td><td class="n">${p.impAvg != null ? fmtSigned(p.impAvg) : "—"}</td><td class="n">${p.mpAvg != null ? p.mpAvg : "—"}</td><td class="n">${fmtSigned(p.pts)}</td></tr>`).join("")}</tbody></table></div>
     <div class="muted">Every board is also played at 10 expert robot tables. IMP: your result against each table, averaged (cross-IMPs). MP: the percentage of the field you beat.</div>`;
  } else {
    const rows = HIST.slice(-100).reverse().map(e => `<tr class="rev" data-rev="${e.id}"><td>${new Date(e.ts || 0).toLocaleDateString()}</td><td>${e.board}</td><td>${e.passed ? 'Pass' : conKey(e.c)}</td><td>${e.passed ? '' : e.tricks}</td><td class="n">${fmtSigned(e.us || 0)}</td><td class="n">${e.imp == null ? "—" : fmtSigned(e.imp)}</td><td class="n">${e.mp == null ? "—" : e.mp + "%"}</td></tr>`).join('');
    body = `<div class="muted">Tap a board to see the auction and how it was played.</div><div class="resscroll"><table class="res"><thead><tr><th>Date</th><th>Bd</th><th>Contract</th><th>Tr</th><th class="n">Score</th><th class="n">IMP</th><th class="n">MP</th></tr></thead><tbody>${rows || "<tr><td colspan=\"7\">No boards played yet.</td></tr>"}</tbody></table></div>`;
  }
  openOv('res', `<h2>Results</h2><div class="seg" data-seg="restab"><button data-v="stats" class="${tab === 'stats' ? 'on' : ''}">Statistics</button><button data-v="list" class="${tab === 'list' ? 'on' : ''}">Boards</button></div>${body}<div class="row2"><button class="btn gold" id="oClose">Close</button></div>`);
}

/* replay of a finished board, one card at a time: ui.revStep cards have been played.
   The hands sit round the table (you at the bottom) and the current trick lies in the middle. */
function revPlayHtml(e) {
  const flat = e.pl.flat(), n = flat.length, k = Math.max(0, Math.min(ui.revStep || 0, n));
  const trump = e.c.strain < 4 ? e.c.strain : -1, decl = sideOf(e.c.decl);
  const win = t => E.trickWinner(t.map(([s, c]) => ({ s, c })), trump);
  const played = new Set(flat.slice(0, k).map(x => x[1]));
  const ti = k ? Math.floor((k - 1) / 4) : -1, trick = ti < 0 ? [] : e.pl[ti].slice(0, k - ti * 4);
  let t1 = 0, t2 = 0;
  for (let i = 0; i < e.pl.length && (i + 1) * 4 <= k; i++) { if (sideOf(win(e.pl[i])) === decl) t1++; else t2++; }
  const w = trick.length === 4 ? win(trick) : -1, next = k < n ? flat[k][0] : -1;
  const pos = ['s', 'w', 'n', 'e'], rel_ = s => (s - e.seat + 4) % 4;
  const hand = s => {
    const left = e.deal[s].filter(c => !played.has(c));
    const tag = s === e.c.decl ? ' · Decl' : s === pd(e.c.decl) ? ' · Dummy' : '';
    return `<div class="h ${pos[rel_(s)]}${s === next ? ' turn' : ''}"><b>${SEAT[s]}${s === e.seat ? ' (you)' : ''}${tag}</b>${ORDER.map(su => { const cs = E.desc(E.inSuit(left, su)); return `${symHtml(su)} ${cs.length ? cs.map(c => RTXT[R(c)]).join(' ') : '—'}`; }).join('<br>')}</div>`;
  };
  const mid = `<div class="rtrick" data-rs="next">${trick.map(([s, c]) => `<span class="rc ${pos[rel_(s)]}${s === w ? ' win' : ''}">${RTXT[R(c)]}${symHtml(S(c))}</span>`).join('')}</div>`;
  const status = k === 0 ? `Opening lead: ${SEAT[next]}` : k >= n ? `End of play · declarer ${t1}, defence ${t2}${n < 52 ? ' · the rest was claimed' : ''}`
    : `Trick ${ti + 1} of ${e.pl.length} · declarer ${t1}, defence ${t2}${w >= 0 ? ` · won by ${SEAT[w]}` : ''}`;
  return `<div class="deal replay">${[0, 1, 2, 3].map(hand).join('')}${mid}</div>
    <div class="rstat">${status}</div>
    <div class="rctl"><button class="btn" data-rs="first" ${k ? '' : 'disabled'}>⏮</button><button class="btn" data-rs="prev" ${k ? '' : 'disabled'}>◀</button>
      <button class="btn gold" data-rs="auto">${ui.revTimer ? 'Pause' : 'Play'}</button>
      <button class="btn" data-rs="next" ${k < n ? '' : 'disabled'}>▶</button><button class="btn" data-rs="last" ${k < n ? '' : 'disabled'}>⏭</button></div>`;
}
function revStep(a) {
  const e = HIST.find(h => h.id === ui.revId); if (!e || !e.pl) return;
  const n = e.pl.flat().length, k = ui.revStep || 0;
  if (a === 'auto') { if (ui.revTimer) stopRev(); else { if (k >= n) ui.revStep = 0; ui.revTimer = setInterval(() => { if ((ui.revStep || 0) >= n || ui.overlay !== 'rev') { stopRev(); return; } ui.revStep++; revDraw(); }, 900); } }
  else { stopRev(); ui.revStep = a === 'first' ? 0 : a === 'last' ? n : a === 'prev' ? Math.max(0, k - 1) : Math.min(n, k + 1); }
  revDraw();
}
function stopRev() { clearInterval(ui.revTimer); ui.revTimer = null; }
function revDraw() { const e = HIST.find(h => h.id === ui.revId), el = $('revPlay'); if (e && el) el.innerHTML = revPlayHtml(e); }

/* a finished board from Results: the four hands, the auction (tap a call for its meaning) and every trick */
function showReview(id, sel) {
  const e = HIST.find(h => h.id === id); if (!e) return;
  ui.revId = id;
  const dealer = e.dealer != null ? e.dealer : dealerOf(e.board);
  const auc = (e.auc || []).map(([seat, call]) => ({ seat, call }));
  const cards = sideCards();
  auc.forEach((a, i) => { a.m = E.explainCall(auc.slice(0, i), a.seat, a.call, cards); });
  const aucHtml = e.auc
    ? `<div class="auction">${auctionTable(auc, false, { board: e.board, dealer, seat: e.seat, sel })}</div>` +
      (sel != null && auc[sel] ? `<div class="expl">${explHtml(auc[sel])}</div>` : '<div class="muted tap">Tap a call to see what it means</div>')
    : '<div class="muted">The auction was not saved for this board (played before this feature was added).</div>';
  const canPlay = e.pl && e.pl.length && e.c && e.deal;
  const playHtml = canPlay ? `<div class="grp"><span>The play — tap ▶ (or the table) to play the next card</span><div id="revPlay">${revPlayHtml(e)}</div></div>`
    : (e.passed ? '' : '<div class="muted">The play was not saved for this board (played before this feature was added).</div>');
  openOv('rev', `<h2>Board ${e.board}</h2><div class="big">${resultLine(e)}</div>
    ${canPlay ? '' : e.deal ? dealHtml(e.deal, e.seat) : ''}
    ${playHtml}
    <div class="grp"><span>Auction</span>${aucHtml}</div>
    <div class="row2"><button class="btn" id="oRevBack">Back to the list</button><button class="btn gold" id="oClose">Close</button></div>`);
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
  if (t.id === 'dPhoto' && t.files && t.files[0]) { readPhoto(t.files[0]); t.value = ''; return; }
  if (t.id === "sPractice") { SET.practice = t.value; if (t.value) { SET.conv[t.value] = true; const c = E.CONVS.find(y => y.k === t.value); if (c && c.x) SET.conv[c.x] = false; } Store.saveSettings(SET); save(); showSettings(); }
});
document.addEventListener('click', ev_ => {
  if (G && G.phase === "play" && ev_.target.closest("#center") && !ev_.target.closest("[data-c].play,button")) {
    if (G.play.history.length) { ui.showLast = !ui.showLast; clearTimeout(ui.lastTimer); if (ui.showLast) ui.lastTimer = setTimeout(() => { ui.showLast = false; render(); }, 4000); render(); }
    return;
  }
  // Results: open a finished board, tap its calls, or go back to the list
  const rv = ev_.target.closest('[data-rev]'); if (rv) { ui.revSel = null; ui.revStep = 0; stopRev(); showReview(rv.dataset.rev); return; }
  const rs = ev_.target.closest('[data-rs]'); if (rs) { if (!rs.disabled) revStep(rs.dataset.rs); return; }
  const ri = ev_.target.closest('[data-ri]'); if (ri) { const i = +ri.dataset.ri; showReview(ui.revId, ui.revSel === i ? null : i); ui.revSel = ui.revSel === i ? null : i; return; }
  if (ev_.target.closest('#oRevBack')) { ui.resTab = 'list'; showResults(); return; }
  const t = ev_.target.closest('button,[data-c],[data-ai],#toast,#dExpl'); if (!t) return;
  if (t.id === 'dExpl') { ui.lastExpl = null; ui.hintBid = null; render(); return; }
  if (t.id === 'toast') { ui.toast = null; render(); return; }
  if (t.dataset.sit != null) { Net.sit(+t.dataset.sit); return; }
  if (t.id === "bGo") { resume(); return; }
  if (t.id === "bStart") { if (online() && !guest() && G.phase === "lobby") { Net.note((Net.st.names[SET.seat] || "Host") + " started the game"); newBoard(); } return; }
  if (t.dataset.ai != null) { ui.lastExpl = ui.lastExpl === +t.dataset.ai ? null : +t.dataset.ai; ui.hintBid = null; if (ui.overlay === 'auc') showAuction(); else render(); return; }
  if (t.dataset.lvl) { ui.selLvl = +t.dataset.lvl; renderBidbox(); return; }
  if (t.dataset.call != null && G.phase === 'bid' && bidTurn() === U()) { const v = t.dataset.call; const c = (v === 'P' || v === 'X' || v === 'XX') ? v : +v; if (c !== -1) makeCall(U(), c); return; }
  if (t.dataset.c != null && t.classList.contains('play')) { const c = +t.dataset.c; const seat = G.play.turn; if (G.play.hands[seat].includes(c)) playCard(seat, c); return; }
  if (t.closest('.seg')) {
    const seg = t.closest('.seg').dataset.seg, v = t.dataset.v;
    if (seg === 'restab') { ui.resTab = v; showResults(); return; }
    if (seg === 'ddealer' || seg === 'dvul') { readDealForm(); ui.dealForm[seg === 'ddealer' ? 'dealer' : 'vul'] = +v; showDealEntry(); return; }
    if (seg === "seat" && online()) { flash("Close the online table before changing your seat", 2000); return; }
    if (seg === "seat") SET.seat = +v; if (seg === 'speed') SET.speed = +v; if (seg === 'expl') SET.expl = v === '1'; if (seg === 'auto') SET.auto = v === '1';
    if (seg === "style") SET.style = v;
    if (seg === "mode") SET.mode = v; if (seg === 'opp') SET.opp = v;
    Store.saveSettings(SET); save(); showSettings(); render(); return;
  }
  switch (t.id) {
    case "bNew": case "oNext2":
      if (guest()) { if (G.phase === "done") Net.send({ t: "next" }); else flash("Only the host can deal a new board during play", 1800); break; }
      if (t.id === "oNext2" || G.phase === "done" || ui.confirmNew > Date.now()) { ui.confirmNew = 0; newBoard(); }
      else { ui.confirmNew = Date.now() + 3000; renderBar(); setTimeout(renderBar, 3100); }
      break;
    case 'bAuc': showAuction(); break;
    case 'oShow': showEnd(); break;
    case 'bHint':
      if (guest() && G.phase === "play") { if (userControls(G.play.turn) && G.play.trick.length < 4) Net.send({ t: "hint" }); break; } // the host works it out
      if (G.phase === 'bid' && bidTurn() === U()) { ui.hintBid = E.aiBid(G.auction, U(), G.deal[U()], G.cards); SET.expl = true; render(); }
      else if (G.phase === 'play' && userControls(G.play.turn) && G.play.trick.length < 4) { ui.hintCard = E.aiPlay(G.play, G.play.turn); render(); }
      break;
    case "bClaim": if (online() && !guest()) Net.note((Net.st.names[SET.seat] || "Host") + " claimed the rest"); claim(); break;
    case "bUndo": { const ok = undo(); if (ok === false) flash("Nothing of yours to take back", 1500); else if (ok && online() && !guest()) Net.note((Net.st.names[SET.seat] || "Host") + " took back their last move"); break; }
    case "sDeal": showDealEntry(); break;
    case "dPlay": startEnteredDeal(); break;
    case "dExpl": ui.lastExpl = null; ui.hintBid = null; render(); break;
    case "bHelp": case "bHelp2": showHelp(); break;
    case "bSet": showSettings(); break;
    case 'bRes': showResults(); break;
    case 'oClose': closeOv(); break;
    case 'sReset': HIST = []; save(); showSettings(); render(); break;
    case "sSave": { const v = ($("syncToken") || {}).value; if (v) { GitSync.setToken(v); syncState.msg = ""; syncNow(); showSettings(); } break; }
    case "sNow": syncNow(); break;
    case "sOff": GitSync.setToken(null); syncState.msg = ""; showSettings(); break;
    case "oNext": if (guest()) { Net.send({ t: "next" }); closeOv(); } else newBoard(); break;
    case "oReplay": replayDeal(); break;
  }
});
$('ov').addEventListener('click', e => { if (e.target.id === 'ov') closeOv(); });
window.addEventListener('resize', layoutFans);

/* ================= boot ================= */
function start(data) {
  load(data && data.G ? data : null);
  Field.init();
  // the app opens on a quiet start screen: nothing is dealt until you press Start (a board in progress is kept for it)
  ui.saved = G && G.deal && G.cards && G.phase !== "lobby" && G.phase !== "idle" ? G : null;
  G = idleG(); render();
  Store.initCloud(mergeCloud);
  syncNow(true);
  window.addEventListener("online", () => syncNow(true));
  // installable/offline app when served from a normal web address
  if ('serviceWorker' in navigator && document.querySelector('link[rel=manifest]') && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname)) {
    // when a new version has been installed, switch to it right away (the game in progress is kept)
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; save(); location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  }
}
window.claude?.hot?.snapshot?.(() => ({ SET, G, HIST, BOARD }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
