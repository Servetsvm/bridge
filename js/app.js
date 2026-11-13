/* Bridge Table — screen, game flow, field comparison and settings. */
'use strict';
const E = {}; for (const f of window.BRIDGE) f(E);
const { SUIT, STR, RTXT, SEAT, S, R, pd, sideOf, B, LV, ST, isNum, vulOf, dealerOf, callTxt, legalCalls, isLegal, auctionOver, contractOf, ev, scoreOf } = E;

let SET = { style: "classic", seat: 2, speed: 1, expl: true, auto: true, mode: 'IMP', opp: 'same', sfx: true, conv: { ...E.ALL_ON } };
let G = null, HIST = [], BOARD = 0, timer = null, wdog = null;
// T_FORCE: a language for a moment (Servet's robot reports are always Turkish)
let T_FORCE = null;
function T(s, ...a) { let r = (I18N[T_FORCE || SET.lang] || {})[s] || s; a.forEach((v, i) => { r = r.split('{' + i + '}').join(v); }); return r; }

// the version of the app (the same number as in sw.js), shown at the bottom of Settings
const APP_V = 481;
let SEAT_AB = 'NESW';
// a robot bid explanation in the chosen language: the phrases of BID_PH, longest first, whole words only
const BID_RE = {};
function bidTxt(t) {
  const L = T_FORCE || SET.lang || "en", col = ["en", "tr", "no", "es", "fr", "it", "de", "ru", "pl", "zh"].indexOf(L);
  if (col < 1 || !t || typeof BID_PH === "undefined") return t;
  let r = BID_RE[L];
  if (!r) {
    const map = new Map(BID_PH.map(p => [p[0].toLowerCase(), p[col]]));
    const keys = [...map.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    r = BID_RE[L] = { map, re: new RegExp('(?<!\\p{L})(' + keys.join('|') + ')(?!\\p{L})', 'giu') };
  }
  const out = String(t).replace(r.re, w => { const v = r.map.get(w.toLowerCase()); if (v == null) return w; return w[0] !== w[0].toLowerCase() && v ? v[0].toUpperCase() + v.slice(1) : v; });
  return out.replace(/ {2,}/g, " ").replace(/ ([,:;)])/g, "$1").replace(/\( /g, "(").trim();
}
// a language not loaded yet (the site loads the visitor's own only): its file is fetched, the screen is drawn again
const LANG_LOAD = {};
function loadLang(L) {
  if (!L || L === 'en' || (typeof I18N !== 'undefined' && I18N[L])) return Promise.resolve();
  return LANG_LOAD[L] || (LANG_LOAD[L] = new Promise(res => { const s = document.createElement('script'); s.src = 'js/lang/' + L + '.js'; s.onload = () => res(); s.onerror = () => { delete LANG_LOAD[L]; res(); }; document.head.appendChild(s); }));
}
// put the chosen language's seats, convention names/descriptions and system descriptions on the screen
function applyLang() {
  { const L = SET.lang; if (L && L !== 'en' && !I18N[L]) loadLang(L).then(() => { if (SET.lang === L && I18N[L]) { applyLang(); document.querySelectorAll('[data-lang]').forEach(el => { el.dataset.lang = ''; }); if (typeof render === 'function') render(); } }); }
  const L = SET.lang || 'en'; document.documentElement.lang = L === 'no' ? 'nb' : L;
  if (typeof Net !== "undefined" && Net.ensureDaily) Net.ensureDaily();
  SEAT.splice(0, 4, ...(SEAT_T[L] || SEAT_T.en)); SEAT_AB = SEAT_AB_T[L] || 'NESW';
  const C = CONV_T[L] || {};
  for (const c of [...E.CONVS, ...Object.entries(E.XINFO).map(([k, v]) => Object.assign(v, { k: v.k || k }))]) {
    if (c._n == null) { c._n = c.n; c._d = c.d; }
    const t = C[c.k]; c.n = t ? t[0] : c._n; c.d = t ? t[1] : c._d;
  }
  const S = SYS_T[L] || {};
  for (const s of E.SYSTEMS) { if (s._d == null) s._d = s.d; s.d = S[s.k] || s._d; }
}
const ui = { selLvl: 0, hintBid: null, hintCard: null, lastExpl: null, toast: null, confirmNew: 0, overlay: null, resTab: 'list' };
const online = () => typeof Net !== "undefined" && Net.on;
const guest = () => typeof Net !== "undefined" && Net.guest;
// your seat (a tournament, and the system table watched, always from South); a spectator has no seat of their own (meSeat -1)
const U = () => (G && G.ct ? G.ct.seat : guest() ? Net.st.seat : G && (G.champ || G.rtv) ? 2 : G && G.tour && G.tour.table == null ? (G.tour.seat ?? 2) : SET.seat);
const meSeat = () => (guest() && Net.st.watching ? -1 : G && G.watch ? -1 : U());
const delay = () => G && G.watch ? 1700 : [1100, 650, 250][SET.speed];   // watching the robots: slowly, to follow every card
const $ = id => document.getElementById(id);
const red = s => s === 1 || s === 2;
const symHtml = s => s === 4 ? "NT" : `<span class="sym s${s}${red(s) ? " red" : ""}">${STR[s]}</span>`;
const callHtml = c => isNum(c) ? LV(c) + symHtml(ST(c)) : callTxt(c);
/* enlarges and colours the suit symbols inside a text */
const symText = t => String(t || "").replace(/[♣♦♥♠]/g, ch => `<span class="sym s${"♣♦♥♠".indexOf(ch)}${ch === "♥" || ch === "♦" ? " red" : ""}">${ch}</span>`);
const conKey = c => c ? `${LV(B(c.level, c.strain))}${symHtml(c.strain)}${c.dbl === 1 ? 'X' : c.dbl === 2 ? 'XX' : ''} ${SEAT_AB[c.decl]}` : 'Pass';
const conId = c => c ? `${c.level}${c.strain}${c.dbl}${c.decl}` : 'P';
const fmtSigned = v => (v > 0 ? '+' : '') + v;

function sideCards() {
  // our side (you and your robot partner) bids our system; the opponents the same, or SAYC
  const ours = { conv: { ...SET.conv }, agg: 0, sys: SET.sys || 'twoone' }, opp = SET.opp === 'same' ? { conv: { ...SET.conv }, agg: 0, sys: SET.sys || 'twoone' } : { conv: { ...E.SAYC }, agg: 0, sys: 'sayc' };
  const c = [null, null]; c[sideOf(U())] = ours; c[1 - sideOf(U())] = opp;
  // at an online table the other side bids the system of the player sitting there (their robot partner too)
  if (typeof Net !== 'undefined' && online() && !guest()) {
    const side = 1 - sideOf(U()), s = [0, 1, 2, 3].find(x => sideOf(x) === side && Net.st.seats[x] && Net.st.seats[x] !== 'host' && Net.st.profs && Net.st.profs[x] && Net.st.profs[x].sys);
    if (s != null) { const p = Net.st.profs[s]; c[side] = { conv: { ...(p.conv || E.sysOf(p.sys).conv) }, agg: 0, sys: p.sys }; }
  }
  return c;
}

/* ================= persistence ================= */
const SEEN_KEY = 'bridge-table-seen';
let SEEN = new Set();
function loadSeen() { try { SEEN = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { SEEN = new Set(); } }
function saveSeen() { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...SEEN].slice(-30000))); } catch (e) {} }
// the convention card's time: set when the base system or a convention changes, so the newer card wins across devices
var CARD_CK = null;
function cardSeen() { CARD_CK = cardCk(); }
const cardCk = () => (SET.sys || '') + JSON.stringify(SET.conv || {});
function save() {
  { const ck = cardCk(); if (CARD_CK !== null && ck !== CARD_CK) SET.cardTs = Date.now(); CARD_CK = ck; }
  if (online() && Net.host) Net.broadcast();
  const slim = HIST.map((h, i) => (i < HIST.length - 60 ? { ...h, deal: undefined, fieldList: undefined, auc: undefined, pl: undefined } : h));
  Store.saveLocal({ SET, G: guest() ? Net.st.savedG : (G && (G.phase === "idle" || G.rtv) ? ui.saved || null : G), HIST: slim, BOARD });
}
// a first visit opens in the visitor's language: the first of the browser's languages we have, else the
// language of the country the device's time zone is in, else English (nothing is sent anywhere to find it)
function detectLang() {
  const have = LANGS.map(([v]) => v);
  const of = l => { l = String(l || '').toLowerCase(); const b = /^(nb|nn|no)\b/.test(l) ? 'no' : l.slice(0, 2); return have.includes(b) ? b : null; };
  for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) { const v = of(l); if (v) return v; }
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
  const TZ = { 'Europe/Istanbul': 'tr', 'Asia/Istanbul': 'tr', 'Asia/Nicosia': 'tr', 'Asia/Famagusta': 'tr', 'Europe/Oslo': 'no', 'Arctic/Longyearbyen': 'no',
    'Europe/Madrid': 'es', 'Atlantic/Canary': 'es', 'America/Mexico_City': 'es', 'America/Argentina/Buenos_Aires': 'es', 'America/Bogota': 'es', 'America/Lima': 'es', 'America/Santiago': 'es', 'America/Caracas': 'es', 'America/Montevideo': 'es',
    'Europe/Paris': 'fr', 'Europe/Brussels': 'fr', 'Europe/Luxembourg': 'fr', 'Europe/Monaco': 'fr', 'Europe/Rome': 'it', 'Europe/San_Marino': 'it', 'Europe/Vatican': 'it',
    'Europe/Berlin': 'de', 'Europe/Vienna': 'de', 'Europe/Zurich': 'de', 'Europe/Busingen': 'de', 'Europe/Moscow': 'ru', 'Europe/Minsk': 'ru', 'Asia/Almaty': 'ru', 'Europe/Kaliningrad': 'ru', 'Europe/Samara': 'ru', 'Europe/Volgograd': 'ru', 'Asia/Yekaterinburg': 'ru', 'Asia/Novosibirsk': 'ru', 'Asia/Vladivostok': 'ru',
    'Europe/Warsaw': 'pl', 'Asia/Shanghai': 'zh', 'Asia/Chongqing': 'zh', 'Asia/Urumqi': 'zh', 'Asia/Hong_Kong': 'zh', 'Asia/Macau': 'zh', 'Asia/Taipei': 'zh' };
  return TZ[tz] || 'en';
}
// the country the visitor is in (looked up once, the same lookup as the visitor statistics) wins over the browser:
// a first visit is re-set to that country's language as soon as it is known, unless the player has picked one
const CTRY_LANG = { TR: 'tr', CY: 'tr', NO: 'no', SJ: 'no', ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', VE: 'es', UY: 'es', EC: 'es', BO: 'es', PY: 'es', CR: 'es', PA: 'es', DO: 'es', GT: 'es', HN: 'es', SV: 'es', NI: 'es', CU: 'es', PR: 'es',
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', IT: 'it', SM: 'it', VA: 'it', DE: 'de', AT: 'de', CH: 'de', LI: 'de', RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', PL: 'pl', CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh' };
window.addEventListener('load', () => langFromCountry());
function langFromCountry() {
  if (!SET.langAuto || typeof Net === 'undefined' || !Net.country) return;
  Net.country().then(c => {
    const v = c && CTRY_LANG[c];
    if (!v || !SET.langAuto || v === SET.lang) return;
    SET.lang = v; applyLang(); Store.saveSettings(SET); save(); render();
  });
}
/* the season: results played before it are kept aside on the device (bridge-hist-arch), not shown or counted */
const SEASON_TS = 1793116092089;   // 27 October 2026
const oldSeason = h => !h || !(h.ts >= SEASON_TS);
function seasonArchive(L) {
  if (!L || !L.length) return;
  try { const a = JSON.parse(localStorage.getItem('bridge-hist-arch') || '[]'), have = new Set(a.map(h => h && h.id)); for (const h of L) if (h && !have.has(h.id)) a.push(h); localStorage.setItem('bridge-hist-arch', JSON.stringify(a)); }
  catch (e) { try { localStorage.setItem('bridge-hist-arch-' + Date.now(), JSON.stringify(L.map(h => h && { ...h, deal: undefined, auc: undefined, pl: undefined, fieldList: undefined }))); } catch (x) {} }
}
function seasonStart() {
  const old = HIST.filter(oldSeason);
  if (old.length) { seasonArchive(old); HIST = HIST.filter(h => !oldSeason(h)); }
  // once on this device: its tournament list and the leaderboard it has seen start again
  let done = null; try { done = localStorage.getItem('bridge-season'); } catch (e) {}
  if (done !== String(SEASON_TS)) {
    try { const t = localStorage.getItem('bridge-tours'); if (t) localStorage.setItem('bridge-tours-arch', t); localStorage.removeItem('bridge-tours'); localStorage.removeItem('bridge-rated'); localStorage.setItem('bridge-season', String(SEASON_TS)); } catch (e) {}
    if (typeof Net !== 'undefined') { Net.st.rated = {}; Net.st.tours = {}; Net.st.tres = {}; }   // already read by the lobby
  }
  if (old.length) save();
}
function load(d) {
  d = d || Store.loadLocal();
  if (d) { SET = Object.assign(SET, d.SET || {}); G = d.G || null; HIST = d.HIST || []; BOARD = d.BOARD || 0; }
  if (G && G.phase === "lobby") G = null; // an online waiting room is not restored after a restart
  seasonStart();
  SET.conv = { ...E.ALL_ON, ...(SET.conv || {}) }; CARD_CK = cardCk(); fixedSet();
  if (!SET.lang) { SET.lang = detectLang(); SET.langAuto = true; }
  // a language page's Play button (/bridge/no/ → ?lang=no) opens the app in that language, as if picked by hand
  try {
    const q = new URLSearchParams(location.search), ql = q.get('lang');
    if (ql && LANGS.some(([v]) => v === ql)) { SET.lang = ql; SET.langAuto = false; }
    // a lesson's Practise button (?prac=puppet): that convention goes on the card and the practice panel opens
    const qp = q.get('prac'); if (qp && /^[a-zA-Z0-9]{2,20}$/.test(qp)) window.PRAC_Q = qp;
    if (q.has('lang') || q.has('prac')) { q.delete('lang'); q.delete('prac'); history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
  } catch (e) {}
  applyLang();
  // the player card's "joined" date (the first day this device played; from the oldest board for old players) and logins
  if (!SET.joined) { const t0 = Math.min(Date.now(), ...HIST.map(h => h.ts || Date.now())); SET.joined = new Date(t0).toISOString().slice(0, 10); }
  SET.logins = (SET.logins || 0) + 1;
  loadSeen();
  for (const h of HIST) if (h.deal) SEEN.add(E.dealKey(h.deal));
}
function mergeCloud(recs, settings) {
  const have = new Set(HIST.map(h => h.id)), inCloud = new Set(recs.map(r => r.id));
  for (const h of HIST) if (!inCloud.has(h.id)) Store.saveRec(h);
  for (const r of recs) if (!have.has(r.id) && !oldSeason(r)) HIST.push(r);   // not the boards from before the season
  HIST.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (settings) { SET = Object.assign(SET, settings); SET.conv = { ...E.ALL_ON, ...(SET.conv || {}) }; }
  if (SET.seatHome != null) { SET.seat = SET.seatHome; delete SET.seatHome; }   // the seat you had before an online table moved you (the app was closed there)
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
    HIST = m.hist.filter(h => !oldSeason(h)); SEEN = new Set(m.seen); saveSeen();
    BOARD = Math.max(BOARD, ...HIST.map(h => h.board || 0));
    syncState.msg = "Synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    save(); renderBar(); if (ui.overlay === "set") showSettings(); else if (ui.overlay === "res") showResults();
  }).catch(e => { syncState.msg = e.message === "offline" ? "Offline — will sync when back online" : "Sync failed: " + e.message; if (ui.overlay === "set") showSettings(); });
}
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(true), 2500); if (typeof Net !== "undefined" && Net.cloudSyncSoon) Net.cloudSyncSoon(); }

/* ================= virtual field (background worker) ================= */
/* the virtual field: 4 expert robot tables play the same deal in a background worker;
   double-dummy checks run in a third worker that is restarted for every new board, so nothing waits behind an old job */
const FIELD_N = 4, FIELD_PARTS = 1;
const Field = {
  live: {}, fw: [], dw: null, ddBoard: null, src: null,
  mk() {
    try {
      // the fast solver (js/dds.js) goes in too when the page has it
      if (!this.src) this.src = URL.createObjectURL(new Blob([(typeof ddsFactory === 'function' ? ddsFactory.toString() + '\n' : '') + 'const E={};\n' + window.BRIDGE.map(f => '(' + f.toString() + ')(E);').join('\n') + '\n(' + E.workerMain.toString() + ')(E);'], { type: 'text/javascript' }));
      const w = new Worker(this.src);
      w.onmessage = e => this.onmsg(e.data);
      return w;
    } catch (e) { return null; }
  },
  // the fast solver on the page too (claims and quick checks); the robots use it in their workers
  init() { if (typeof ddsFactory === 'function') ddsFactory().then(m => E.ddsUse(m)).catch(() => {}); },
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
    if (this.dw && key === 'table') { this.dw.postMessage({ type: 'ddtable', id, deal }); return; }
    if (key === 'table') return;   // without a worker: no lessons (too slow on the page)
    if (this.dw) this.dw.postMessage({ type: 'dd', id, key, deal, c, limit: 1.2e8 });   // most deals need a few million nodes; about one in forty needs 30-40 million
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
  // the robots' bidding lessons of a board: its double-dummy table against the field's contracts
  lessons(id, L, f, tab) { const les = bidLessons(L.deal, L.board, f.tables, tab); if (les.length && typeof Net !== 'undefined') les.forEach((x, i) => Net.roboBid(id, i, L.deal, L.board, x).catch(() => {})); },
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
      if (!f.ddt) { f.ddt = 1; this.dd(m.id, 'table', L.deal, null); }   // the double-dummy table (and the robots' bidding lessons)
      else if (f.dd.tab && !online() && !f.les) { f.les = 1; this.lessons(m.id, L, f, f.dd.tab); }   // the table came first: the lessons now
      { const r = RHIST.find(h => h.id === m.id); if (r) { applyField(r, f); r.normC = f.normC ? { ...f.normC } : null; saveRH(); scheduleSync(); } }
      const e = HIST.find(h => h.id === m.id);
      if (e) { applyField(e, f); Store.saveRec(e); scheduleSync(); if (e.tour && e.tour.table == null) tourSend(e); }
    }
    if (m.type === 'dd') { f.dd[m.key] = m.t; const e = HIST.find(h => h.id === m.id); if (e) e.dd = { ...f.dd }; const r = RHIST.find(h => h.id === m.id); if (r) { r.dd = { ...f.dd }; saveRH(); scheduleSync(); } }
    if (m.type === 'ddtable') {
      f.dd.tab = m.t; const e = HIST.find(h => h.id === m.id); if (e) { e.dd = { ...f.dd }; Store.saveRec(e); } const r = RHIST.find(h => h.id === m.id); if (r) { r.dd = { ...f.dd }; saveRH(); }
      if (f.done && !online() && !f.les) { f.les = 1; this.lessons(m.id, L, f, m.t); }
      if (G && G.id === m.id && G.phase === 'done') render();
      return;
    }
    if (m.type === 'error') this.partDone(m.id);
    if (G && G.id === m.id) { save(); if (ui.overlay === 'end') showEnd(); if (G.phase === 'done') render(); else renderBar(); }
  },
};
/* ---- checking the card play after the board (double dummy, in a background worker) ---- */
/* ---- the championship: rounds of 8 boards, the same for everyone, played whenever you like (each round once, from
   South). Every result is compared with all the other players' on that board, in IMPs and matchpoints; a board no one
   else has played yet counts against the robot tables until someone does. The ranking is per board over all boards. ---- */
const CH = { tree: null, at: 0, p: null };
const champLive = () => !!(G && G.champ && (G.phase === 'bid' || G.phase === 'play'));
function champDeal(r, b) {
  E.seed(((Math.imul(r, 2654435761) ^ 0x5bd1e995) + Math.imul(b, 40503)) >>> 0 || 1);
  const d = E.shuffle([...Array(52).keys()]); E.seed(null);
  return [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13));
}
// the championship from the database (read again after a minute, or when asked)
function champLoad(force) {
  if (typeof Net === 'undefined' || !Net.Cloud.on) return Promise.resolve(CH.tree);
  if (!force && CH.tree && Date.now() - CH.at < 60000) return Promise.resolve(CH.tree);
  if (CH.p) return CH.p;
  return CH.p = Net.champGet().then(t => { CH.tree = t || {}; CH.at = Date.now(); const L = champRank(CH.tree); CH.leader = L.length ? L[0].k : null; return CH.tree; }).catch(() => CH.tree).finally(() => { CH.p = null; render(); });
}
/* the ranking: for every player, each board compared with every other player's result on it (IMP: the average of the
   IMPs against each; MP: the share of them beaten, ties half); alone on a board: the robot tables' figures */
function champRank(tree) {
  const P = {};
  for (const [r, R] of Object.entries(tree || {})) for (const [b, B] of Object.entries(R || {})) {
    const L = Object.entries(B || {}).filter(([, x]) => x && typeof x.us === 'number');
    for (const [k, x] of L) {
      const p = P[k] || (P[k] = { k, name: x.n || k, n: 0, imp: 0, mp: 0, rounds: {}, last: 0 });
      const o = L.filter(([j]) => j !== k).map(([, y]) => y.us);
      let imp, mp;
      if (o.length) { imp = o.reduce((a, v) => a + E.imps(x.us - v), 0) / o.length; mp = 100 * o.reduce((a, v) => a + (x.us > v ? 1 : x.us === v ? 0.5 : 0), 0) / o.length; }
      else if (x.fi != null) { imp = x.fi; mp = x.fm != null ? x.fm : 50; }
      else continue;
      p.n++; p.imp += imp; p.mp += mp; p.rounds[r] = (p.rounds[r] || 0) + 1; p.last = Math.max(p.last, x.ts || 0);
    }
  }
  return Object.values(P).filter(p => Object.values(p.rounds).some(n => n >= 8)).map(p => ({ ...p, ai: p.imp / p.n, am: p.mp / p.n }))
    .sort((a, b) => b.ai - a.ai || b.am - a.am);
}
// where you are: the round you are in (a board or more played) or the next one open to you
function champWhere(tree, myIp) {
  const me = Net.fbKey(myNm()), R = tree || {}, max = Math.max(0, ...Object.keys(R).map(Number).filter(Boolean));
  for (let r = 1; r <= max + 1; r++) {
    const done = [1, 2, 3, 4, 5, 6, 7, 8].filter(b => R[r] && R[r][b] && R[r][b][me]);
    if (done.length === 8) continue;
    if (done.length) return { r, b: [1, 2, 3, 4, 5, 6, 7, 8].find(b => !done.includes(b)), n: done.length };
    // a round someone else played from this internet connection is not yours (the same boards would be known)
    const used = myIp && Object.values(R[r] || {}).some(B => Object.entries(B || {}).some(([k, x]) => k !== me && x && x.ip === myIp));
    if (used) continue;
    return { r, b: 1, n: 0 };
  }
  return { r: max + 1, b: 1, n: 0 };
}
async function startChamp() {
  if (!myNm()) { flash(T('Sign in with your name first.'), 2500); return; }
  if (typeof Net === 'undefined' || !Net.Cloud.on) { flash(T('The championship needs the online database.'), 2800); return; }
  if (online()) { flash(T('Close the online table first'), 2000); return; }
  flash('🏆 ' + T('Loading…'), 1200);
  let [tree, ip] = await Promise.all([champLoad(true), Net.ipTag()]);
  if (!tree) tree = await champLoad(true);   // a read already under way (from the home page) may have failed: once more
  if (!tree) { flash(T('The championship needs the online database.'), 2800); return; }
  // a board finished here but not in the database yet counts as played
  const w = champWhere(tree, ip && ip.ip);
  if (G && G.champ && G.champ.r === w.r && G.phase === 'done' && G.champ.b === w.b) w.b++;
  if (w.b > 8) { flash(T('Round {0} finished', w.r), 2500); showChamp(); return; }
  ui.saved = null; closeOv(); Net.st.soloPub = false;
  ui.champNext = { r: w.r, b: w.b };
  newBoard(champDeal(w.r, w.b), w.b);
  Net.shareInfo();
  flash('🏆 ' + T('Championship') + ' · ' + T('Round {0}', w.r) + ' · ' + w.b + '/8', 2400);
}
function champSend(e) {
  const c = e.c ? [e.c.level, e.c.strain, e.c.dbl || 0, e.c.decl] : null;
  const x = { us: e.us || 0, c, t: e.tricks ?? null, ...(e.imp != null ? { fi: e.imp, fm: e.mp } : {}) };
  Net.champPut(e.champ.r, e.champ.b, x).then(() => { CH.at = 0; champLoad(true); }).catch(() => flash(T('Your championship result could not be sent — check the connection.'), 3500));
}
/* ---- the months of the championship (UTC months, the same for everyone) ---- */
const MONTH_MIN = 40;
const ymOf = ts => { const d = new Date(ts); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; };
const ymStart = ym => Date.UTC(Math.floor(ym / 100), ym % 100 - 1, 1), ymNext = ym => (ym % 100 === 12 ? ym + 89 : ym + 1);
const ymName = ym => new Date(ymStart(ym) + 864e5).toLocaleDateString(SET.lang || 'en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
// a period's ranking (from a to z): its boards, each compared with the other results on that board in by z; min: the
// boards needed to win it (a month: MONTH_MIN)
function monthRank(tree, ym) { return periodRank(tree, ymStart(ym), ymStart(ymNext(ym)), MONTH_MIN); }
function periodRank(tree, a, z, min) {
  const P = {};
  for (const R of Object.values(tree || {})) for (const B of Object.values(R || {})) {
    const L = Object.entries(B || {}).filter(([, x]) => x && typeof x.us === 'number' && x.ts < z);
    for (const [k, x] of L) {
      if (x.ts < a) continue;
      const o = L.filter(([j]) => j !== k).map(([, y]) => y.us);
      let imp, mp;
      if (o.length) { imp = o.reduce((s, v) => s + E.imps(x.us - v), 0) / o.length; mp = 100 * o.reduce((s, v) => s + (x.us > v ? 1 : x.us === v ? 0.5 : 0), 0) / o.length; }
      else if (x.fi != null) { imp = x.fi; mp = x.fm != null ? x.fm : 50; } else continue;
      const p = P[k] || (P[k] = { k, name: x.n || k, n: 0, imp: 0, mp: 0 }); p.n++; p.imp += imp; p.mp += mp;
    }
  }
  const L = Object.values(P).map(p => ({ ...p, ai: p.imp / p.n, am: p.mp / p.n, ok: p.n >= (min || 0) }));
  const q = L.filter(p => p.ok);
  return { all: L.sort((x, y) => y.ai - x.ai), imp: q.slice().sort((x, y) => y.ai - x.ai).slice(0, 3), mp: q.slice().sort((x, y) => y.am - x.am).slice(0, 3) };
}
// every closed month with its champions (newest first), worked out once per reading of the championship
function champMonths(tree) {
  if (CH.monthsFor === CH.at && CH.months) return CH.months;
  let first = null; for (const R of Object.values(tree || {})) for (const B of Object.values(R || {})) for (const x of Object.values(B || {})) if (x && x.ts && (!first || x.ts < first)) first = x.ts;
  const out = [], now = ymOf(Date.now());
  if (first) for (let ym = ymOf(first); ym < now; ym = ymNext(ym)) { const r = monthRank(tree, ym); if (r.imp.length || r.mp.length) out.unshift({ ym, imp: r.imp, mp: r.mp }); }
  CH.months = out; CH.monthsFor = CH.at; return out;
}
// a player's trophies (🥇🥈🥉 of each month, IMP and MP)
function trophiesOf(name) {
  if (!CH.tree) return [];
  const k = Net.fbKey(name), out = [];
  for (const m of champMonths(CH.tree)) for (const kind of ['imp', 'mp']) { const i = m[kind].findIndex(p => p.k === k); if (i >= 0) out.push({ ym: m.ym, kind, place: i + 1 }); }
  return out;
}
const MEDAL = ['🏆', '🥈', '🥉'];
const trophyTxt = t => MEDAL[t.place - 1] + ' ' + T(t.place === 1 ? '{0} · {1} champion' : t.place === 2 ? '{0} · {1}, 2nd place' : '{0} · {1}, 3rd place', ymName(t.ym), t.kind.toUpperCase());
// last month's champions carry a golden name and 🏆 for this month
function champMark(name) {
  if (!CH.tree || !name) return '';
  const m = champMonths(CH.tree)[0]; if (!m || ymNext(m.ym) !== ymOf(Date.now())) return '';
  const k = Net.fbKey(name); return (m.imp[0] && m.imp[0].k === k) || (m.mp[0] && m.mp[0].k === k) ? ' 🏆' : '';
}
// the trophy cabinet on a player card
function trophyHtml(name) {
  const L = trophiesOf(name); if (!L.length) return '';
  return `<div class="trophies"><div class="tropht">🏆 ${T('Trophy cabinet')}</div>${L.map(t => `<div class="troph p${t.place}">${esc(trophyTxt(t))}</div>`).join('')}</div>`;
}
// the administrator hears once when a month has closed with its champions
function champMonthNote() {
  if (typeof Net === 'undefined' || !Net.isAdmin() || !CH.tree) return;
  const m = champMonths(CH.tree)[0]; if (!m || SET.champNoted === m.ym) return;
  SET.champNoted = m.ym; Store.saveSettings(SET); save();
  flash('🏆 ' + T('The champions of {0}: {1} (IMP) · {2} (MP)', ymName(m.ym), m.imp[0] ? m.imp[0].name : '—', m.mp[0] ? m.mp[0].name : '—'), 8000);
}
/* ---- the rank card: ♣2 … ♠A ---- */
const RK_S = '♣♦♥♠', RK_R = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], RK_GATE = [0, 50, 200, 500];
// the highest card the boards played allow: within each suit the 13 cards are spread over its boards (♣ 0-50, ♦ 50-200,
// ♥ 200-500); from 500 boards every card up to ♠K
function rankCap(boards) {
  for (let s = 0; s < 3; s++) { const a = RK_GATE[s], z = RK_GATE[s + 1]; if (boards < z) return s * 13 + Math.min(12, Math.floor((boards - a) * 13 / (z - a))); }
  return 50;
}
// the boards needed for a card (inverse of rankCap)
const boardsFor = i => { const s = Math.floor(i / 13); if (s >= 3) return RK_GATE[3]; const a = RK_GATE[s], z = RK_GATE[s + 1]; return a + Math.ceil((i % 13) * (z - a) / 13); };
const rankTxt = i => RK_S[Math.floor(i / 13)] + RK_R[i % 13];
// a player's card from the profile (rating, boards) and the trophies; the championship's leader holds ♠A
function cardRank(p, name) {
  if (!p) return null;
  const rt = p.rtn ? p.rt : 1350, boards = p.per && p.per[4] ? p.per[4][0] || 0 : p.n || 0;
  const tro = name ? trophiesOf(name) : [], bonus = tro.reduce((a, t) => a + (t.place === 1 ? 3 : 1), 0);
  const base = Math.max(0, Math.min(50, Math.round((rt - 1350) / 8)));
  const cap = rankCap(boards);   // experience: every player starts at ♣2 and climbs with the boards played
  let i = Math.min(base + bonus, cap, 50);
  if (name && CH.leader && CH.leader === Net.fbKey(name)) i = 51;
  return { i, cap, boards, rt, bonus, base };
}
const rankChip = r => r ? `<span class="rkc s${Math.floor(r.i / 13)}" data-rank="1" role="button" tabindex="0" title="${T('Rank card')}">${rankTxt(r.i)}</span>` : '';
// what the rank card means (tap any card)
function showRankHelp() {
  const me = typeof Net !== 'undefined' ? cardRank(Net.prof(), myNm()) : null;
  const row = (s, txt) => `<tr><td><span class="rkbig s${s}">${RK_S[s]}</span></td><td>${txt}</td></tr>`;
  openOv('rank', `<h2>${T('Rank card')}</h2>
    <div class="muted">${T('Every player is a card, from ♣2 (the lowest) to ♠A (the highest): 52 steps. Your rating and the boards you have played decide it; trophies add steps that stay.')}</div>
    <table class="res"><tbody>${row(0, T('Beginning: the first {0} boards', RK_GATE[1]))}${row(1, T('Intermediate: from {0} boards', RK_GATE[1]))}${row(2, T('Advanced: from {0} boards', RK_GATE[2]))}${row(3, T('Expert: from {0} boards — ♠A only for the championship\'s leader', RK_GATE[3]))}</tbody></table>
    <div class="muted">${T('Every 8 rating points is one card higher. A month\'s championship +3 cards, 2nd or 3rd place +1, for good.')}</div>
    ${me ? `<div class="grp"><span>${T('Your card')}</span>${rankBig(Net.prof(), myNm())}</div>` : ''}
    <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
const rankOf = (p, name) => rankChip(cardRank(p, name));
// the player card: the card large, and what the next one needs
function rankBig(p, name) {
  const r = cardRank(p, name); if (!r) return '—';
  let next;
  if (r.i === 51) next = '👑 ' + T('Leader of the championship');
  else if (r.i === 50) next = T('The top card for a player: ♠A belongs to the leader of the championship.');
  else if (r.i >= r.cap) next = T('{0} more boards to reach {1}', Math.max(1, boardsFor(r.i + 1) - r.boards), rankTxt(r.i + 1));
  else { const need = Math.max(1, Math.ceil(1350 + 8 * (r.i - r.bonus + 1) - 4 - r.rt)); next = T('{0} rating points to {1}', need, rankTxt(r.i + 1)); }
  return `<span class="rkbig s${Math.floor(r.i / 13)}">${rankTxt(r.i)}</span> <small class="muted">${next}</small>`;
}
// the home page card: the leader, your place, start or go on
function champCardHtml() {
  if (typeof Net === 'undefined' || !Net.Cloud.on) return '';
  if (!CH.tree || Date.now() - CH.at > 60000) champLoad();
  const L = CH.tree ? champRank(CH.tree) : [], me = Net.fbKey(myNm() || ''), i = L.findIndex(p => p.k === me), lead = L[0];
  const w = CH.tree && myNm() ? champWhere(CH.tree, null) : null;
  const mo = CH.tree ? champMonths(CH.tree)[0] : null, fresh = mo && ymNext(mo.ym) === ymOf(Date.now()) && new Date().getUTCDate() <= 7;
  if (mo) setTimeout(champMonthNote, 0);
  return `<div class="h2chh"><span class="h2cht">🏆 ${T('Championship')}</span>${L.length ? `<small>${T('{0} players', L.length)}</small>` : ''}</div>
    ${fresh ? `<div class="h2chnew">🎉 ${T('The champions of {0}: {1} (IMP) · {2} (MP)', ymName(mo.ym), mo.imp[0] ? esc(mo.imp[0].name) : '—', mo.mp[0] ? esc(mo.mp[0].name) : '—')}</div>` : ''}
    <div class="h2chtag">${T('Same boards for everyone, one crown. Can you take it?')}</div>
    ${lead ? `<div class="h2chl">👑 <b>${esc(lead.name)}</b> <small>${fmtSigned(Math.round(lead.ai * 100) / 100)} IMP · ${Math.round(lead.am)}%</small></div>` : ''}
    ${i >= 0 ? `<div class="h2chm">${T('You: place {0}', i + 1)}</div>` : ''}
    <div class="h2chb"><button class="btn h2go" id="chGo">▶ ${w && w.n ? T('Continue round {0} ({1}/8)', w.r, w.n) : T('Round {0}', w ? w.r : 1)}</button><button class="btn h2chs" id="chShow">${T('Standings')}</button></div>`;
}
// the championship page: the standings (every player) and your rounds
async function showChamp() {
  if (ui.overlay !== 'champ') openOv('champ', `<h2>🏆 ${T('Championship')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`);
  const tree = await champLoad(true); if (ui.overlay !== 'champ') return;
  const L = champRank(tree), me = Net.fbKey(myNm() || ''), tab = ui.chTab || 'all';
  let body;
  const per = ui.chPer || 'all';
  const perSeg = `<div class="seg" data-seg="chper">${[['day', T('Today')], ['week', T('This week')], ['month', T('This month')], ['year', T('This year')], ['all', T('All time')]].map(([v, l]) => `<button data-v="${v}" class="${per === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (tab === 'all' && per !== 'all') {
    // today, this week (from Monday), this month, this year: UTC, the same for everyone
    const d = new Date(), y = d.getUTCFullYear(), mo = d.getUTCMonth(), day = Date.UTC(y, mo, d.getUTCDate());
    const from = per === 'day' ? day : per === 'week' ? day - ((d.getUTCDay() + 6) % 7) * 864e5 : per === 'month' ? Date.UTC(y, mo, 1) : Date.UTC(y, 0, 1);
    const ym = ymOf(Date.now()), M = periodRank(tree, from, Date.now() + 1, per === 'month' ? MONTH_MIN : 0);
    body = perSeg + (per !== 'month' ? '' : `<div class="muted">${T('{0}: only this month\'s boards. At least {1} boards in the month to win it; the champions are known on the 1st.', ymName(ym), MONTH_MIN)}</div>`) + `<div class="resscroll"><table class="res"><thead><tr><th>#</th><th>${T('Player')}</th><th class="n">${T('Boards')}</th><th class="n">IMP/${T('Bd')}</th><th class="n">MP %</th></tr></thead><tbody>${M.all.map((p, i) => `<tr class="${p.k === me ? 'meRow' : ''}${p.ok ? '' : ' dim'}"><td>${i + 1}</td><td><b class="pname" data-who="${esc(p.name)}">${esc(p.name)}</b></td><td class="n">${p.n}${p.ok ? '' : ' / ' + MONTH_MIN}</td><td class="n">${fmtSigned(Math.round(p.ai * 100) / 100)}</td><td class="n">${Math.round(p.am)}%</td></tr>`).join('') || `<tr><td colspan="5">${T('No boards played yet.')}</td></tr>`}</tbody></table></div>`;
  } else if (tab === 'honour') {
    const H = champMonths(tree), cell = L => L.map((p, i) => `${MEDAL[i]} ${esc(p.name)}`).join('<br>') || '—';
    body = H.length ? `<div class="resscroll"><table class="res"><thead><tr><th>${T('Month')}</th><th>IMP</th><th>MP</th></tr></thead><tbody>${H.map(m => `<tr><td>${esc(ymName(m.ym))}</td><td>${cell(m.imp)}</td><td>${cell(m.mp)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="muted">${T('No champions yet: the first ones are known when the first month closes.')}</div>`;
  } else if (tab === 'mine') {
    const rows = [];
    for (const [r, R] of Object.entries(tree || {}).sort((a, b) => b[0] - a[0])) for (let b = 1; b <= 8; b++) {
      const B = (R || {})[b] || {}, x = B[me]; if (!x) continue;
      const o = Object.entries(B).filter(([k, y]) => k !== me && y && typeof y.us === 'number').map(([, y]) => y.us);
      const imp = o.length ? o.reduce((a, v) => a + E.imps(x.us - v), 0) / o.length : x.fi, mp = o.length ? 100 * o.reduce((a, v) => a + (x.us > v ? 1 : x.us === v ? 0.5 : 0), 0) / o.length : x.fm;
      const con = x.c ? x.c[0] + STR[x.c[1]] + (x.c[2] === 1 ? 'X' : x.c[2] === 2 ? 'XX' : '') + ' ' + SEAT_AB[x.c[3]] : T('Pass');
      rows.push(`<tr><td>${r}</td><td>${b}</td><td>${con}${x.c ? ' · ' + x.t : ''}</td><td class="n">${fmtSigned(x.us)}</td><td class="n">${o.length}</td><td class="n">${imp == null ? '—' : fmtSigned(Math.round(imp * 10) / 10)}</td><td class="n">${mp == null ? '—' : Math.round(mp) + '%'}</td></tr>`);
    }
    body = `<div class="resscroll"><table class="res"><thead><tr><th>${T('Round')}</th><th>${T('Bd')}</th><th>${T('Contract')}</th><th class="n">${T('Score')}</th><th class="n">👥</th><th class="n">IMP</th><th class="n">MP</th></tr></thead><tbody>${rows.join('') || `<tr><td colspan="7">${T('No boards played yet.')}</td></tr>`}</tbody></table></div>`;
  } else {
    body = perSeg + `<div class="resscroll"><table class="res"><thead><tr><th>#</th><th>${T('Player')}</th><th class="n">${T('Boards')}</th><th class="n">IMP/${T('Bd')}</th><th class="n">MP %</th></tr></thead><tbody>${L.map((p, i) => `<tr class="${p.k === me ? 'meRow' : ''}"><td>${i === 0 ? '👑' : i + 1}</td><td><b class="pname${champMark(p.name) ? ' champgold' : ''}" data-who="${esc(p.name)}">${esc(p.name)}${champMark(p.name)}</b> ${rankOf(Net.profOf(p.name), p.name)}</td><td class="n">${p.n}</td><td class="n">${fmtSigned(Math.round(p.ai * 100) / 100)}</td><td class="n">${Math.round(p.am)}%</td></tr>`).join('') || `<tr><td colspan="5">${T('No leader yet — finish a round to be ranked.')}</td></tr>`}</tbody></table></div>`;
  }
  openOv('champ', `<h2>🏆 ${T('Championship')}</h2>
    <div class="chintro">${T('Everyone plays the same 8 boards a round — your result is set against every other player\'s. No clock: play whenever you like. The leader wears the 👑, the month\'s best takes the trophy.')}</div>
    <div class="seg" data-seg="chtab"><button data-v="all" class="${tab === 'all' ? 'on' : ''}">${T('Standings')}</button><button data-v="honour" class="${tab === 'honour' ? 'on' : ''}">🏆 ${T('Honour roll')}</button><button data-v="mine" class="${tab === 'mine' ? 'on' : ''}">${T('My rounds')}</button></div>
    ${body}
    <div class="row2"><button class="btn gold" id="chGo">▶ ${T('Play')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
}
/* ---- the robots' bidding lessons: each robot table's contract against the best contract its side could make with
   all four hands open (double dummy); a lesson when it cost 4 IMPs or more: a missed game or slam, an overbid, a wrong
   contract. At most two per board (the costliest, one per auction). ---- */
const isGameC = (l, s) => s === 4 ? l >= 3 : s >= 2 ? l >= 4 : l >= 5;
function bidLessons(deal, board, tables, T) {
  if (!T || !tables) return [];
  const out = [], seen = new Set();
  for (const t of tables) {
    if (!t || t.passed || !t.c || !t.auc) continue;
    const c = t.c, side = sideOf(c.decl), vul = vulOf(board, c.decl), tr = T[c.decl] && T[c.decl][c.strain]; if (tr == null) continue;
    const got = scoreOf(c.level, c.strain, c.dbl, vul, tr);
    let best = null;
    // the contracts a player would bid: the lowest level of a partscore, a game, a small slam or a grand slam
    const gl = st => st === 4 ? 3 : st >= 2 ? 4 : 5;
    for (const d of [0, 1, 2, 3]) if (sideOf(d) === side) for (let st = 0; st < 5; st++) { const k = T[d][st]; if (k == null || k < 7) continue;
      for (const l of [1, gl(st), 6, 7]) { if (k < l + 6) continue; const sc = scoreOf(l, st, 0, vul, k); if (!best || sc > best.sc) best = { l, s: st, d, sc, tr: k }; } }
    if (!best) continue;
    const loss = E.imps(best.sc - got); if (loss < 4) continue;
    const key = t.auc.map(a => a[1]).join(','); if (seen.has(key)) continue; seen.add(key);
    const kind = tr < c.level + 6 ? (best.l < c.level || !isGameC(best.l, best.s) ? 'overbid' : 'wrong') : best.l >= 6 && c.level < 6 ? 'slam' : isGameC(best.l, best.s) && !isGameC(c.level, c.strain) ? 'game' : 'wrong';
    out.push({ c, auc: t.auc, tr, best, loss, kind });
  }
  return out.sort((a, b) => b.loss - a.loss).slice(0, 2);
}
/* ---- the robots' chart: the deals given to the robots (watched), kept on this device apart from your Results ---- */
const RH_KEY = 'bridge-robot-hist';
let RHIST = (() => { try { return JSON.parse(localStorage.getItem(RH_KEY) || '[]') || []; } catch (e) { return []; } })();
const saveRH = () => { try { localStorage.setItem(RH_KEY, JSON.stringify(RHIST.slice(-300))); } catch (e) {} };
// a watched board against double dummy: the declaring side's score with the tricks taken, against the tricks the contract takes double dummy
// the four expert robot tables (playing the normal way, each hand seeing only its own cards and dummy) against double
// dummy: the tables that played the most common contract, their declarer's tricks against that contract double dummy
function robotImp(e) {
  const c = e && e.normC, v = e && e.dd ? e.dd.norm : null; if (!c || v == null || !e.fieldList) return null;
  const k = conKey(c), L = e.fieldList.filter(t => t.k === k && t.t != null); if (!L.length) return null;
  const vul = vulOf(e.board, c.decl), sc = t => scoreOf(c.level, c.strain, c.dbl, vul, t);
  return L.reduce((a, t) => a + E.imps(sc(t.t) - sc(v)), 0) / L.length;
}
function robotRating() {
  const L = RHIST.map(robotImp).filter(x => x != null).slice(-200), s = L.reduce((a, x) => a + x, 0);
  return { rt: Math.round(1500 + 150 * s / (L.length + 20)), n: L.length, avg: L.length ? s / L.length : 0 };
}
/* the robots' own cards: after a board with robots (not at an online table) the cards the robots played are checked
   double dummy in a worker of their own, one board at a time; a card that gave away tricks goes to the
   administrator's list of robot mistakes, from which the robots are improved by hand */
const RoboAna = {
  w: null, q: [],
  add(e) {
    if (!e || !e.pl || e.pl.length < 2 || !e.c || !e.deal || typeof Worker === 'undefined') return;
    this.q.push(e); if (this.q.length === 1) setTimeout(() => this.next(), 5000);
  },
  next() {
    const e = this.q[0]; if (!e) return;
    const ours = e.watch ? [] : sideOf(e.c.decl) === sideOf(e.seat) ? [e.c.decl, pd(e.c.decl)] : [e.seat];   // watched: all four were robots
    const seats = [0, 1, 2, 3].filter(s => !ours.includes(s));
    const done = list => {
      clearTimeout(this.to); this.q.shift();
      if (list && list.length) Net.roboErr(e, list).catch(() => {});
      if (this.q.length) setTimeout(() => this.next(), 1000);
      else if (this.w) { this.w.terminate(); this.w = null; }   // nothing left to check: the memory is given back
    };
    this.to = setTimeout(() => { if (this.w) { this.w.terminate(); this.w = null; } done(null); }, 180000);
    if (!this.w) this.w = Field.mk();
    if (!this.w) { done(null); return; }
    this.w.onmessage = m => { const d = m.data; if (d && d.id === e.id && d.type === 'ana') done(d.list); else if (d && d.id === e.id && d.type === 'error') done(null); };
    this.w.postMessage({ type: 'ana', id: e.id, deal: e.deal, c: e.c, pl: e.pl, seats, limit: 2e7 });
  },
};
const cardH = c => RTXT[R(c)] + symHtml(S(c));
const Ana = {
  w: null,
  run(e) {
    if (!e || !e.pl || !e.c || !e.deal || e.ana === 'run') return;
    const seats = sideOf(e.c.decl) === sideOf(e.seat) ? [e.c.decl, pd(e.c.decl)] : [e.seat];
    const done = list => { clearTimeout(this.to); e.ana = list; Store.saveRec(e); save(); this.redraw(e); };
    e.ana = 'run'; this.redraw(e);
    this.to = setTimeout(() => { if (this.w) { this.w.terminate(); this.w = null; } if (e.ana === 'run') done(null); }, 120000);
    if (!this.w) { this.w = Field.mk(); }
    if (this.w) {
      this.w.onmessage = m => { if (m.data && m.data.type === 'ana' && m.data.id === e.id) done(m.data.list); else if (m.data && m.data.type === 'error') done(null); };
      this.w.postMessage({ type: 'ana', id: e.id, deal: e.deal, c: e.c, pl: e.pl, seats, limit: 2e7 });
    } else setTimeout(() => { try { done(E.analysePlay(e.deal, e.c, e.pl, seats, 4e5)); } catch (x) { done(null); } }, 50);
  },
  redraw(e) {
    if (ui.overlay === 'end' && G && G.id === e.id) showEnd();
    else if (ui.overlay === 'rev' && ui.revId === e.id) showReview(e.id);
  },
};
function anaHtml(e) {
  if (!e || !e.pl || !e.pl.length || !e.c || !e.deal) return '';
  const a = e.ana;
  const body = a === undefined ? `<button class="btn" data-ana="${e.id}">🔍 ${T('Check my card play')}</button><div class="muted">${T('Every card your side played is compared double dummy with the other cards it could have played.')}</div>`
    : a === 'run' ? `<div class="muted">⏳ ${T('Checking the play…')}</div>`
    : a === null ? `<div class="muted">${T('The check could not be finished on this device.')}</div>`
    : !a.length ? `<div class="okmsg">👍 ${T('No double-dummy mistakes in the card play.')}</div>`
    : a.map(x => `<div class="anarow">${T('Trick {0}', x.t)} · ${SEAT[x.s]}: ${cardH(x.c)} → ${cardH(x.b)} <b class="pos">+${x.lost}</b></div>`).join('') + `<div class="muted">${T('→ the better card, and how many more tricks it would have taken (double dummy).')}</div>`;
  return `<div class="grp"><span>🔍 ${T('Card play check')}</span>${body}</div>`;
}

// an individual tournament board: your side's score, and your score against the robot tables once they are done
function tourSend(e) {
  const ew = sideOf(e.seat) === 1;
  Net.tourResult(e.tour.id, e.tour.b, ew ? -e.ns : e.ns, ew ? "EW" : "", e.imp != null ? [e.imp, e.mp] : null, conTxt(e));
}
// a contract and its result in a few characters, e.g. "4♠ S +1" or "3NT× W -2"
const conTxt = e => e.passed || !e.c ? "Pass" : e.c.level + STR[e.c.strain] + (e.c.dbl === 1 ? "X" : e.c.dbl === 2 ? "XX" : "") + " " + 'NESW'[e.c.decl] + " " + (d => d > 0 ? '+' + d : d === 0 ? '=' : String(d))(e.tricks - (e.c.level + 6));
function applyField(e, f) {
  if (!f || !f.done || !f.tables.length) return;
  const fus = f.tables.map(t => sideOf(e.seat) === 0 ? t.ns : -t.ns);
  const cmp = E.compare(e.us, fus); e.imp = cmp.imp; e.mp = cmp.mp;
  e.norm = f.normC ? conKey(f.normC) : 'Pass';
  e.fieldList = f.tables.map(t => ({ k: t.passed ? 'Pass' : conKey(t.c), t: t.tricks ?? null, ns: t.ns }));
}

/* ================= game flow ================= */
/* the conventions being practised (SET.practice holds their keys, separated by commas; "" = off) */
// the basics every system plays (no switch on the card) can be practised too
const PRAC_BASICS = ['jtr', 'strong2c', 'weak2', 'nego', 'takeout', 'bw', 'cue', 'pre', 'runout'];
// Lavinthal and Roman are ways of discarding: practising them deals hands where you defend and will have to discard
const CARD_KEYS = ['lav', 'roman'];
const pracKnown = k => E.CONVS.some(c => c.k === k) || PRAC_BASICS.includes(k);
// a deal where our side defends and one of us will likely run out of a suit and have to discard: in a suit contract a
// short side suit with few trumps, in notrump declarer's long suit against our short holding
function discardLikely(deal, c) {
  const me = U(), pa = (me + 2) % 4, L = h => [0, 1, 2, 3].map(s => h.filter(x => E.S(x) === s).length);
  const dl = [0, 1, 2, 3].map(s => L(deal[c.decl])[s] + L(deal[(c.decl + 2) % 4])[s]);
  for (const who of [me, pa]) {
    const l = L(deal[who]);
    if (c.strain === 4) { if ([0, 1, 2, 3].some(s => dl[s] >= 8 && l[s] <= 2)) return true; }
    else if (l[c.strain] <= 2 && [0, 1, 2, 3].some(s => s !== c.strain && l[s] <= 1 && dl[s] >= 6)) return true;
  }
  return false;
}
function pracList() { return String(SET.practice || '').split(',').filter(pracKnown); }
const pracName = k => k === 'jtr' ? T('Transfer') : E.convInfo(k).n;   // plain "Transfer" in the practice list
function pracNames() { return pracList().map(pracName).join(', '); }
// does a practised convention ever come up in the base system? a short search in the background, one convention at a
// time; the answer is kept per system and convention, and a "no" shows a warning under the choice. Rare conventions
// (about one deal in a thousand or fewer) are not checked: a short search would miss them even where they belong.
const PRAC_CHK = {}, PRAC_RARE = new Set(['gerber', 'smolen', 'puppet', 'texasInt', 'fsf', 'respx', 'gamb', 'sjs', 'lav', 'roman']), PRAC_Q = [];
function pracCheck(k) {
  if (PRAC_RARE.has(k)) return true;
  const key = (SET.sys || 'twoone') + ':' + k;
  if (key in PRAC_CHK) return PRAC_CHK[key];
  PRAC_CHK[key] = null;   // queued / searching
  PRAC_Q.push([key, k]); if (PRAC_Q.length === 1) setTimeout(pracProbe, 50);
  return null;
}
function pracProbe() {
  const [key, k] = PRAC_Q[0];
  // the base system was changed while this one waited: drop it (it is asked again for the new system)
  if (!key.startsWith((SET.sys || 'twoone') + ':')) { delete PRAC_CHK[key]; PRAC_Q.shift(); if (PRAC_Q.length) setTimeout(pracProbe, 0); return; }
  const cards = sideCards(), t0 = performance.now();
  const done = v => { PRAC_CHK[key] = v; PRAC_Q.shift(); if (!v) { const h = document.getElementById('hPrac'); if (h) h.innerHTML = pracHtml(); } if (PRAC_Q.length) setTimeout(pracProbe, 50); };
  const step = () => {
    if (!key.startsWith((SET.sys || 'twoone') + ':')) { delete PRAC_CHK[key]; PRAC_Q.shift(); if (PRAC_Q.length) setTimeout(pracProbe, 0); return; }
    for (let i = 0; i < 15; i++) {
      const d = E.shuffle([...Array(52).keys()]), deal = [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13)), dealer = Math.floor(Math.random() * 4), auc = [];
      while (!auctionOver(auc) && auc.length < 60) { const t = (dealer + auc.length) % 4; const r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
      if (auc.some(e => sideOf(e.seat) === sideOf(U()) && e.m && e.m.cv === k)) return done(true);
    }
    if (performance.now() - t0 > 8000) return done(false);
    setTimeout(step, 0);
  };
  step();
}
function pracWarnHtml() {
  const bad = pracList().filter(k => pracCheck(k) === false);
  return bad.length ? `<div class="prwarn">⚠ ${T('{0}: no hand with it came up in your base system — it may not be part of it.', esc(bad.map(pracName).join(', ')))}</div>` : '';
}
/* rare conventions (Gambling 3NT, Gerber, Smolen, ...) come up about once in a thousand deals or less, too seldom for
   random deals: for them the hands that make the convention possible are built first (the rest of the pack is dealt
   at random) and the auction then checks, as for any practice deal, that the convention really comes up. The roles
   follow the dealer: the first of our pair to speak is the opener. Suits: 0 ♣, 1 ♦, 2 ♥, 3 ♠; ranks 12 = ace. */
const hcpOf = h => h.reduce((a, c) => a + Math.max(0, E.R(c) - 8), 0);
const lensOf = h => { const l = [0, 0, 0, 0]; h.forEach(c => l[E.S(c)]++); return l; };
const balOf = l => l.every(x => x >= 2) && l.filter(x => x === 2).length <= 1;
const honOf = (h, s, rs) => h.filter(c => E.S(c) === s && rs.includes(E.R(c))).length;
// a hand of 13 from the cards left that passes ok, or null. shape (optional) first picks the suit lengths (from the
// natural spread of hands, kept when shape accepts them) and the cards are then drawn suit by suit: far faster for
// hands of a rare shape
const SUITS52 = [...Array(52).keys()].map(c => E.S(c));
function drawHand(left, ok, shape, tries = 20000) {
  const bySuit = [0, 1, 2, 3].map(s => left.filter(c => E.S(c) === s)), rest = left.slice();
  for (let i = 0; i < tries; i++) {
    let h;
    if (shape) {
      let l = null;
      for (let j = 0; j < 2000 && !l; j++) {
        const x = [0, 0, 0, 0];
        for (let n = 0; n < 13; n++) { const r = n + E.rnd(52 - n); [SUITS52[n], SUITS52[r]] = [SUITS52[r], SUITS52[n]]; x[SUITS52[n]]++; }
        if (shape(x) && x.every((v, s) => v <= bySuit[s].length)) l = x;
      }
      if (!l) return null;
      h = [].concat(...[0, 1, 2, 3].map(s => E.shuffle(bySuit[s]).slice(0, l[s])));
    } else { E.shuffle(rest); h = rest.slice(0, 13); }
    if (ok(h)) return h;
  }
  return null;
}
const ntShape = l => balOf(l) && l[0] <= 5 && l[1] <= 5;
const ntOpen = (noMajor) => h => { const l = lensOf(h), p = hcpOf(h); return p >= 15 && p <= 17 && balOf(l) && l[0] <= 5 && l[1] <= 5 && (!noMajor || (l[2] < 4 && l[3] < 4)); };
const PRAC_GEN = {
  gerber: () => [['open', ntOpen(), null, ntShape], ['resp', h => { const l = lensOf(h), p = hcpOf(h); return p >= 18 && p <= 20 && l.every(x => x >= 2) && l[2] < 4 && l[3] < 4; }, null, l => l.every(x => x >= 2) && l[2] < 4 && l[3] < 4]],
  // Puppet Stayman: a 2NT opening (20-21) with a 4- or 5-card major, a responder with game values and a 3- or 4-card major
  puppet: () => [['open', h => { const l = lensOf(h), p = hcpOf(h); return p >= 20 && p <= 21 && balOf(l) && l[0] <= 5 && l[1] <= 5 && (l[2] >= 4 || l[3] >= 4); }, null, l => balOf(l) && l[0] <= 5 && l[1] <= 5 && (l[2] >= 4 || l[3] >= 4)],
    ['resp', h => { const l = lensOf(h), p = hcpOf(h); return p >= 5 && p <= 10 && l[2] <= 4 && l[3] <= 4 && (l[2] >= 3 || l[3] >= 3) && l[0] <= 5 && l[1] <= 5; }]],
  // Minor Transfer: a 1NT opening, a weak responder with a six-card minor
  minorTr: () => [['open', ntOpen()], ['resp', h => { const l = lensOf(h), p = hcpOf(h); return p <= 7 && (l[0] >= 6 || l[1] >= 6) && l[2] <= 3 && l[3] <= 3; }, null, l => (l[0] >= 6 || l[1] >= 6) && l[2] <= 3 && l[3] <= 3]],
  smolen: () => [['open', ntOpen(true)], ['resp', h => { const l = lensOf(h), p = hcpOf(h); return p >= 10 && p <= 14 && ((l[2] === 4 && l[3] === 5) || (l[2] === 5 && l[3] === 4)); }]],
  texasInt: () => [['open', ntOpen()], ['lho', h => { const l = lensOf(h), p = hcpOf(h); return p >= 9 && p <= 14 && (l[0] >= 6 || l[1] >= 6) && l[2] <= 2 && l[3] <= 2; }],
    ['resp', h => { const l = lensOf(h), p = hcpOf(h); return p >= 8 && p <= 13 && (l[2] >= 6 || l[3] >= 6); }]],
  fsf: () => [['open', h => { const l = lensOf(h), p = hcpOf(h); return p >= 12 && p <= 15 && l[1] === 5 && l[0] === 4 && l[2] <= 2 && l[3] <= 2; }, null, l => l[1] === 5 && l[0] === 4],
    ['resp', h => { const l = lensOf(h), p = hcpOf(h); return p >= 12 && p <= 16 && l[3] >= 5 && l[2] >= 2 && l[2] <= 3 && honOf(h, 2, [10, 11, 12]) === 0 && l[1] <= 2 && l[0] <= 3; }, null, l => l[3] >= 5 && l[2] >= 2 && l[2] <= 3 && l[1] <= 2 && l[0] <= 3]],
  sjs: () => [['open', h => { const l = lensOf(h), p = hcpOf(h); return p >= 12 && p <= 14 && (l[0] >= 5 || l[1] >= 5) && l[2] <= 3 && l[3] <= 3; }, null, l => (l[0] >= 5 || l[1] >= 5) && l[2] <= 3 && l[3] <= 3],
    ['resp', h => { const l = lensOf(h), p = hcpOf(h); return p >= 19 && p <= 21 && [2, 3].some(s => l[s] >= 5 && honOf(h, s, [8, 9, 10, 11, 12]) >= 3); }, null, l => l[2] >= 5 || l[3] >= 5]],
  // Gambling 3NT: built card by card (a solid seven-card minor, nothing outside)
  gamb: () => [['open', null, left => {
    const m = Math.random() < 0.5 ? 0 : 1, top = [12, 11, 10].map(r => m * 13 + r);
    if (!top.every(c => left.includes(c))) return null;
    const minor = E.shuffle(left.filter(c => E.S(c) === m && !top.includes(c))).slice(0, 4);
    const other = E.shuffle(left.filter(c => E.S(c) !== m && E.R(c) < 9)).slice(0, 6);   // no honour outside: with 12+ the hand would open one of the minor
    return minor.length === 4 && other.length === 6 ? top.concat(minor, other) : null;
  }]],
  // after their opening, partner's takeout double and their raise: the responsive double
  respx: () => [['opp1', h => { const l = lensOf(h), p = hcpOf(h); return p >= 12 && p <= 14 && (l[2] >= 5 || l[3] >= 5); }, null, l => l[2] >= 5 || l[3] >= 5],
    ['x', (h, H) => { const M = lensOf(H.opp1)[3] >= 5 ? 3 : 2, l = lensOf(h), p = hcpOf(h); return p >= 12 && p <= 14 && l[M] <= 2 && l.every((x, s) => s === M || x >= 3 && x <= 4); }, null, (l, H) => { const M = lensOf(H.opp1)[3] >= 5 ? 3 : 2; return l[M] <= 2 && l.every((x, s) => s === M || x >= 3 && x <= 4); }],
    // the last opponent gets what is left: it must be a simple raise (6-9, three or four cards in their suit)
    ['y', (h, H, left) => { const M = lensOf(H.opp1)[3] >= 5 ? 3 : 2, l = lensOf(h), p = hcpOf(h); if (!(p >= 8 && p <= 11 && l[M] <= 2 && l.filter((x, s) => s !== M && x >= 4).length >= 2)) return false; const o = left.filter(c => !h.includes(c)), lo = lensOf(o), po = hcpOf(o); return po >= 6 && po <= 9 && lo[M] >= 3 && lo[M] <= 4 && lo.every(x => x <= 5); }, null, (l, H) => { const M = lensOf(H.opp1)[3] >= 5 ? 3 : 2; return l[M] <= 2 && l.filter((x, s) => s !== M && x >= 4).length >= 2; }]],
};
// a deal for a rare convention k with this dealer (null if the hands could not be built)
function genDeal(k, dealer) {
  const me = U(), pa = (me + 2) % 4, first = [0, 1, 2, 3].map(i => (dealer + i) % 4).find(s => s === me || s === pa);
  const seat = { open: first, resp: (first + 2) % 4, lho: (first + 1) % 4 };
  // their opening, our double, their raise, our responsive double: the opener is the first opponent to speak
  // (if one of us deals, that player passes first and doubles last)
  const o1 = sideOf(dealer) !== sideOf(me) ? dealer : (dealer + 1) % 4;
  Object.assign(seat, { opp1: o1, x: (o1 + 1) % 4, opp2: (o1 + 2) % 4, y: (o1 + 3) % 4 });
  const deal = [null, null, null, null], H = {};
  let left = [...Array(52).keys()];
  for (const [role, ok, build, shape] of PRAC_GEN[k]()) {
    const h = build ? build(left) : drawHand(left, x => ok(x, H, left), shape && (l => shape(l, H)), shape ? 400 : 20000);
    if (!h) return null;
    H[role] = h; deal[seat[role]] = h; left = left.filter(c => !h.includes(c));
  }
  E.shuffle(left);
  for (let s = 0; s < 4; s++) if (!deal[s]) deal[s] = left.splice(0, 13);
  const out = deal.map(h => h.slice().sort((a, b) => a - b));
  // act: whether you are the one to make the conventional call (with this dealer it may have to be partner)
  out.act = seat[k === 'gamb' ? 'open' : k === 'respx' ? 'y' : 'resp'] === me;
  return out;
}
/* the balance between declaring and defending: over your last twelve boards with robots, if your side declared two or
   more boards more often than the opponents (or the other way round), the next deal is one where the other side
   declares. Practising conventions would otherwise give your side most of the contracts. */
function declTarget() {
  let us = 0, them = 0;
  for (const e of HIST.filter(h => h.c && !h.online && !h.tour && !h.passed).slice(-12)) { if (sideOf(e.c.decl) === sideOf(e.seat)) us++; else them++; }
  return us - them >= 2 ? 'them' : them - us >= 2 ? 'us' : null;
}
/* a never-seen deal; in practice mode, one where our side gets to use one of the chosen conventions */
function freshDeal(dealer) {
  const want = pracList(), cards = sideCards(), t0 = performance.now(), tgt = declTarget();
  let fbMine = null, fbOurs = null, other = null;
  // rare conventions among the chosen: every other deal (every deal if all are rare) is built for one of them
  const gens = want.filter(k => PRAC_GEN[k]), allRare = gens.length && gens.length === want.length;
  const take = d => { SEEN.add(d.key); saveSeen(); return d.deal; };
  for (let i = 0; i < 20000; i++) {
    let deal = gens.length && (allRare || i % 2 === 0) ? genDeal(gens[i % gens.length], dealer) : null;
    if (!deal) { const d = E.shuffle([...Array(52).keys()]); deal = [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13)); }
    const key = E.dealKey(deal);
    if (SEEN.has(key)) continue;
    if (!want.length && !tgt) return take({ deal, key });
    const auc = [];
    while (!auctionOver(auc) && auc.length < 60) { const t = (dealer + auc.length) % 4; const r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
    const c = contractOf(auc), side = c ? (sideOf(c.decl) === sideOf(U()) ? 'us' : 'them') : null, okSide = !tgt || side === tgt;
    // normal deals: only the balance matters (a few hundred tries at most)
    if (!want.length) { if (okSide || i > 300) return take({ deal, key }); continue; }
    let mine = auc.some(e => e.seat === U() && e.m && want.includes(e.m.cv));
    // practising discards: we defend and will likely have to discard
    if (!mine && want.some(k => CARD_KEYS.includes(k))) { if (c && side === 'them' && discardLikely(deal, c)) mine = true; }
    const ours = auc.some(e => sideOf(e.seat) === sideOf(U()) && e.m && want.includes(e.m.cv));
    // the opponents using the convention: a board to see it from the other side, when they should declare
    const theirs = auc.some(e => sideOf(e.seat) !== sideOf(U()) && e.m && want.includes(e.m.cv));
    if (okSide && (mine || (ours && deal.act === false) || (tgt === 'them' && theirs))) return take({ deal, key });
    if (okSide && ours && !fbOurs) fbOurs = { deal, key };
    if (mine && !fbMine) fbMine = { deal, key };
    if (tgt && side === tgt && !other) other = { deal, key };
    const t = performance.now() - t0;
    if (t < 2500) continue;
    // time is up: keep the balance first (a board the other side declares), then the convention
    const pick = (tgt && (fbOurs || other)) || fbMine || fbOurs;
    if (pick) return take(pick);
    if (t < 4000) continue;
    flash('📚 ' + T('No hand with {0} came up quickly — here is a normal deal', pracNames()), 3000);
    return take({ deal, key });
  }
  throw new Error('could not find an unseen deal');
}
/* replay: a deal to play again or an entered deal; boardNo: board number for an entered deal (sets dealer and vulnerability) */
function newBoard(replay, boardNo, tour, extra) {
  clearTimeout(timer);
  // the cards are dealt: they fly into the hands one after the other
  document.body.classList.add("dealing"); clearTimeout(ui.dealT); ui.dealT = setTimeout(() => document.body.classList.remove("dealing"), 1100);
  if (!replay) BOARD++;
  const bn = boardNo || BOARD;
  const deal = replay ? replay.map(h => h.slice()) : freshDeal(dealerOf(bn));
  UNDO.length = 0;
  G = { id: Date.now().toString(36) + E.rnd(1e6).toString(36), board: bn, dealer: dealerOf(bn), deal, auction: [], phase: 'bid', play: null, result: null, claimed: false, field: null, tour: tour || null, cards: sideCards() };
  if (extra) Object.assign(G, extra);   // a club tournament's board (js/clubtour.js): its id, seats and the tournament's card
  if (ui.champNext) { G.champ = ui.champNext; ui.champNext = null; }   // a championship board (from South, a closed table)
  Object.assign(ui, { selLvl: 0, hintBid: null, hintCard: null, lastExpl: null, toast: null, overlay: null, photoMsg: null, photoHands: null, signal: null, fixSeat: null, fixCard: null });
  $('ov').hidden = true;
  Field.start(G);
  save(); render(); tick();
}
const bidTurn = () => (G.dealer + G.auction.length) % 4;

/* ---- undo: a snapshot is taken right before each call or card of yours ---- */
const UNDO = [];
const ME = () => (online() ? Net.me : "local");
// who acted at a seat: a human id ("local" offline) or "robot"
const actor = seat => (G && G.watch ? 'robot' : G && G.ct ? (userControls(seat) ? 'local' : ctWho(seat) === 'robot' ? 'robot' : 'remote') : online() ? Net.owner(seat) : (G.phase === "bid" ? (seat === U() ? "local" : "robot") : (userControls(seat) ? "local" : "robot")));
function pushUndo(by, x) { const { field, ...rest } = G; UNDO.push({ by: by || "local", s: JSON.stringify(rest), ...(x || {}) }); if (UNDO.length > 120) UNDO.shift(); }
// correcting the robots: offline, outside tournaments, when switched on in the settings
const canFix = () => !!SET.fixBot && !online() && !guest() && !G.tour && !G.tprac;
/* take back the last robot card: that robot's seat is then played by you, once (the card it should have played) */
function fixUndo() {
  let i = UNDO.length - 1; while (i >= 0 && UNDO[i].by !== 'robotfix') i--;
  if (i < 0) { flash('🤖 ' + T('No robot card to take back'), 1800); return; }
  const snap = UNDO[i]; ui.fixSeat = snap.seat; ui.fixCard = snap.c;   // set first: the robot must not play it again at once
  undo('robotfix');
  flash('↩ ' + T('Play the card {0} should have played', SEAT[snap.seat]), 2600);
}
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
// al: an alert from a person at an online table (what the call means, shown to everyone when they tap it)
function makeCall(seat, call, m, al) {
  if (guest()) { if (bidTurn() === seat && userControls(seat)) { ui.selLvl = 0; ui.hintBid = null; Net.send({ t: "call", call, al }); } return; }
  if (G.phase !== "bid" || bidTurn() !== seat || !isLegal(G.auction, seat, call)) return;
  { const who = actor(seat); if (who !== "robot") pushUndo(who); }
  if (!m) m = E.explainCall(G.auction, seat, call, G.cards);
  // while practising: what the system (the robot's own choice) bids here, to look back on when the board ends
  let sg = null;
  if (pracList().length && !online() && !G.tour && !G.ct && actor(seat) !== 'robot') { const r = E.aiBid(G.auction, seat, G.deal[seat], G.cards); sg = { c: r.call, cv: (r.m && r.m.cv) || '', t: (r.m && r.m.t) || '' }; }
  G.auction.push(al ? { seat, call, m, al: String(al).slice(0, 120) } : { seat, call, m });
  if (sg) G.auction[G.auction.length - 1].sg = sg;
  if (G.ct) ctAct({ s: seat, c: call });   // a club table: the call goes to the table in the database
  ui.selLvl = 0; ui.hintBid = null;
  if (auctionOver(G.auction)) {
    const c = contractOf(G.auction);
    if (!c) { finishBoard(); return; }
    G.play = E.newPlayState(G.deal, c, G.auction, G.cards);
    G.play.rb = [0, 1, 2, 3].filter(s => actor(s) === 'robot');   // the seats whose calls the robots made (their hands are checked against them)
    G.phase = 'play';
    Field.dd(G.id, 'you', G.deal, c);
    { const L = Field.live[G.id]; if (L && !L.f.ddt) { L.f.ddt = 1; Field.dd(G.id, 'table', G.deal, null); } }   // the double-dummy table for the end of the board
    const us = sideOf(c.decl) === sideOf(U());
    flash(T(us ? (c.decl === U() ? "You are declarer" : "Partner is declarer — you play both hands") : "You are defending"), 1800);
  }
  save(); render(); tick();
}
function userControls(seat) {
  if (G && G.watch) return false;   // the robots play every seat
  if (online()) return Net.owner(seat) === Net.me;
  if (G && G.ct) return ctControls(seat);   // a club table: your seat, and dummy when you are declarer
  if (ui.fixSeat != null && G.play && G.phase === 'play' && G.play.turn === ui.fixSeat && seat === ui.fixSeat) return true;   // correcting a robot's card
  if (!G.play) return seat === U();
  return seat === U() || (sideOf(G.play.contract.decl) === sideOf(U()) && sideOf(seat) === sideOf(U()));
}
function playCard(seat, c) {
  const g = G.play;
  if (guest()) { if (userControls(seat)) Net.send({ t: "card", c }); return; }
  if (G.phase !== "play" || g.turn !== seat || g.trick.length >= 4 || !E.legalFor(g, seat).includes(c)) return;
  // your card in a robot's place: kept as a correction (the robot's card and yours)
  if (ui.fixSeat === seat) { if (c !== ui.fixCard) (G.fixes || (G.fixes = [])).push([g.history.length + 1, seat, ui.fixCard, c]); ui.fixSeat = null; ui.fixCard = null; }
  else if (actor(seat) === 'robot' && canFix()) pushUndo('robotfix', { seat, c });
  { const who = actor(seat); if (who !== "robot") pushUndo(who); }
  // explain the signal when your robot partner (on defence) discards or encourages
  const cardPrac = pracList().some(k => CARD_KEYS.includes(k)) && !online() && !G.tour;
  if (!userControls(seat) && (g.history.length < 3 || cardPrac) && sideOf(seat) === sideOf(U()) && sideOf(g.contract.decl) !== sideOf(U())) { const t = E.signalText(g, seat, c); if (t) ui.signal = T(...t); }
  else if (userControls(seat) && !g.trick.length) ui.signal = null;
  // practising discards: your first discard on defence is compared with what the agreement says (the suit it asks for)
  if (cardPrac && actor(seat) !== 'robot' && g.trick.length && sideOf(seat) !== sideOf(g.contract.decl) && !(G.dsg || []).some(x => x.s === seat)) {
    const k = E.cardMethod(g, seat), sug = E.discardFor(g, seat);
    if (k && pracList().includes(k) && sug != null && E.S(c) !== E.S(g.trick[0].c) && E.S(c) !== g.trump) {
      const a = E.signalOf(g, seat, c), b = E.signalOf(g, seat, sug);
      (G.dsg || (G.dsg = [])).push({ s: seat, k, c, sc: sug, a, b, ok: c === sug || a === b });
    }
  }
  E.applyCard(g, seat, c); ui.hintCard = null; ui.showLast = false; sfx("card");
  if (G.ct) ctAct({ s: seat, k: c });
  save(); render(); tick();
}
function collectTrick() {
  const g = G.play; if (!g || g.trick.length < 4) return;
  E.collect(g); sfx("trick");
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
  if (G.ct && typeof CT !== 'undefined' && CT.tbl && CT.tbl.watch) { G.result = e; G.phase = 'done'; save(); render(); return; }   // watching a club table: not in your results
  if (G.pz && g) { G.result = e; G.phase = 'done'; sfx(e.tricks >= G.pz.need ? 'good' : 'bad'); pzPlayDone(e); save(); render(); return; }   // the daily puzzle: not in the results
  if (G.watch) { e.watch = true; e.normC = G.field && G.field.normC ? { ...G.field.normC } : null; G.result = e; G.phase = 'done'; RHIST = RHIST.filter(h => h.id !== e.id); RHIST.push(e); saveRH(); render(); if (g) RoboAna.add(e); return; }   // watched: in the robots' chart, not your Results   // watched: shown, not recorded (the robots' cards are checked)
  const act = { mode: G.tour ? "t" : online() ? "o" : "r", cv: [], ok: 0, n: 0 };   // for the day's activity (administrator statistics)
  // a practice board where the convention really came up counts for it (shown on its tile)
  if (pracList().length && !online() && !G.tour) {
    const used = pracList().filter(k => G.auction.some(a => sideOf(a.seat) === sideOf(U()) && a.m && a.m.cv === k) || (G.dsg || []).some(d => d.k === k));
    act.cv = used;
    if (used.length) { SET.pracN = SET.pracN || {}; used.forEach(k => { SET.pracN[k] = (SET.pracN[k] || 0) + 1; }); Store.saveSettings(SET); }
    // your calls where a practised convention came up (the system used it, or you did): right when you bid what
    // the system bids there; each counts towards that convention's score
    const want = pracList(), rv = [];
    G.auction.forEach((a, i) => {
      if (!a.sg) return;
      const k = want.includes(a.sg.cv) ? a.sg.cv : a.m && want.includes(a.m.cv) ? a.m.cv : null;
      if (k) rv.push({ i, k, call: a.call, sc: a.sg.c, ok: a.call === a.sg.c, st: a.sg.t, ut: (a.m && a.m.t) || '' });
    });
    // your first discard on defence, when practising discards
    (G.dsg || []).forEach((d, j) => rv.push({ i: 1000 + j, k: d.k, cd: 1, card: d.c, sc: d.sc, ok: d.ok, a: d.a, b: d.b }));
    // partner's calls with a practised convention: shown with what they mean (not scored)
    G.auction.forEach((a, i) => { if (a.seat === (U() + 2) % 4 && a.m && want.includes(a.m.cv)) rv.push({ i, k: a.m.cv, call: a.call, pd: 1, ut: a.m.t || '' }); });
    rv.sort((a, b) => a.i - b.i);
    if (rv.length) {
      e.prv = rv; SET.pracS = SET.pracS || {};
      rv.filter(r => !r.pd).forEach(r => { const s = SET.pracS[r.k] || (SET.pracS[r.k] = { n: 0, ok: 0 }); s.n++; if (r.ok) s.ok++; });
      rv.filter(r => !r.pd).forEach(r => { act.n++; if (r.ok) act.ok++; });
      Store.saveSettings(SET);
    }
  }
  if (typeof Net !== 'undefined' && Net.noteBoard && !guest()) Net.noteBoard(act);
  G.result = e; G.phase = 'done'; if (!e.passed) sfx(e.us >= 0 ? 'good' : 'bad');
  if (online() && !guest()) Net.boardDone(e);
  if (G.ct) ctBoardDone(e);
  if (G.tprac) { const c = tourCompare(G.tprac.id, G.tprac.b, e); if (c) { e.tprac = c; flash('🏆 ' + T('Against the tournament ({0} players): {1} IMP · {2}%', c.n, fmtSigned(c.imp), c.mp), 4500); } }
  if (G.tour && G.tour.table != null) tourMark(G.tour.id);   // still playing at this tournament table
  if (G.tour && G.tour.table == null && !guest()) { e.tour = G.tour; tourSend(e); }   // an individual board (also while someone watches)
  else if (G.tour && G.tour.table != null && online() && !guest()) { e.tour = G.tour; Net.tourTableResult(G.tour.id, G.tour.table, G.tour.b, e.ns, conTxt(e)); }
  // where it was played, for the Results list: a tournament (with its name), an online table, or alone with robots
  e.kind = G.tour || G.tprac || G.champ ? 't' : online() ? 'o' : 'r';
  if (G.champ && !online()) { e.champ = { ...G.champ }; e.tn = T('Championship') + ' · ' + T('Round {0}', G.champ.r); champSend(e); }
  if (e.kind === 't' && (G.tour || G.tprac)) { const id = (G.tour || G.tprac).id, t = typeof Net !== 'undefined' && Net.st.tours && Net.st.tours[id]; if (t && t.name) e.tn = String(t.name).slice(0, 40); }
  HIST = HIST.filter(h => h.id !== e.id); HIST.push(e);
  Store.saveRec(e);
  save(); render();
  scheduleSync();
  if (g && !online()) RoboAna.add(e);   // the robots' cards are checked for mistakes
  // the cards you played in a robot's place go to the robot mistakes list
  if (g && G.fixes && G.fixes.length && !online()) { e.fx = G.fixes.slice(); Net.roboErr(e, G.fixes.map(([t, s, c, b]) => ({ t, s, c, b, lost: 0 })), true).then(() => flash('🤖 ' + T('Your corrections were sent to improve the robots'), 2600)).catch(() => {}); }
}
function tick() {
  clearTimeout(timer); if (!G || guest() || G.rtv) return;   // the system table: the file plays it // when you are a guest, the host runs the table
  const robot = s => G.ct ? ctRobotHere(s) : online() ? Net.owner(s) === "robot" : (G.phase === "bid" ? G.watch || s !== U() : !userControls(s));
  if (G.phase === "bid") {
    const t = bidTurn();
    if (robot(t)) timer = setTimeout(() => { const r = E.aiBid(G.auction, t, G.deal[t], G.cards); makeCall(t, r.call, r.m); }, delay());
  } else if (G.phase === 'play') {
    const g = G.play;
    if (g.trick.length === 4) timer = setTimeout(collectTrick, Math.max(700, delay() + 300));
    else if (robot(g.turn)) {
      const t = g.turn, left = g.hands[t].length;
      // a robot side about to lead may claim the rest (asked once per trick, near the end of the board)
      const mayClaim = !G.watch && !G.ct && !g.trick.length && g.rcl !== g.history.length && robot(pd(t)) && left >= 2 && left <= 8;
      // the robot starts thinking at once (in the background); its card goes down after the usual pause, or when it is ready
      const think = mayClaim ? null : robotCardAsync(g, t);
      timer = setTimeout(async () => {
        if (mayClaim && await robotClaim(g, t)) return;
        const c = await (think || robotCardAsync(g, t));
        if (G && G.play === g && g.turn === t && !userControls(t) && !g.trick.some(x => x.s === t)) playCard(t, c);
        else if (G && G.phase === 'play' && G.play !== g) tick();
      }, delay());
      // a robot that has done nothing for 30 seconds (its thinking lost or stuck) starts again
      clearTimeout(wdog);
      wdog = setTimeout(() => {
        if (!G || G.phase !== 'play' || G.play !== g || g.turn !== t || userControls(t) || g.trick.some(x => x.s === t) || ui.overlay) return;
        if (Bot.w) { Bot.w.terminate(); Bot.w = null; } Bot.wait = null; Bot.key = null; tick();
      }, 30000);
    }
    else if (!userControls(g.turn)) { /* a friend is to play */ }
    else { const leg = E.legalFor(g, g.turn); if (leg.length === 1 && g.trick.length > 0 && SET.auto) timer = setTimeout(() => playCard(g.turn, leg[0]), 450); }
  }
}
/* ---- claims: the claimer says how many of the remaining tricks they take; the other side accepts or not.
   Robots on the other side check the claim double dummy (they accept only what can really be made). ---- */
const tricksLeft = () => G.play.hands[G.play.leader].length;
// the claimer picks the number of tricks (all of them first)
function claim(seat) {
  if (G && G.ct) return;
  const g = G.play; if (!g || G.phase !== "play" || g.trick.length) return;
  const left = tricksLeft();
  openOv('claim', `<h2>${T('Claim')}</h2><div class="muted">${T('How many of the remaining {0} tricks do you take?', left)}</div>
    <div class="claimn">${Array.from({ length: left + 1 }, (_, i) => left - i).map(n => `<button class="btn ${n === left ? 'new' : ''}" data-claimn="${n}">${n === left ? T('All {0}', n) : n}</button>`).join('')}</div>
    <div class="row2"><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
function claimChosen(n) {
  closeOv();
  if (guest()) { Net.send({ t: "claim", n }); flash(T('Claim sent — waiting for the other side'), 2000); return; }
  requestClaim(G.play.turn, n);
}
// humans on the side that has to agree (online: their ids; "host" is this device)
function agreeOwners(side) {
  if (!online()) return [];
  return [...new Set([0, 1, 2, 3].filter(s => sideOf(s) !== side).map(s => Net.owner(s)).filter(o => o !== 'robot'))];
}
async function requestClaim(seat, n, who) {
  const g = G.play; if (!g || G.phase !== 'play' || g.trick.length) return;
  const side = sideOf(seat), left = tricksLeft(), id = G.id, name = who || (online() ? Net.st.names[seat] || SEAT[seat] : T('You'));
  const humans = agreeOwners(side);
  let ok;
  if (humans.length) ok = await Net.askOwners(humans, { kind: 'claim', who: name, n, left, hands: g.hands });
  else {
    const v = E.ddFull(g.hands, g.leader, side, g.trump, 3e6);
    ok = v != null && n <= v;
    if (!ok) flash(v == null ? T('Could not work it out yet — play a little longer') : T('The robots do not accept: {0} tricks at most', v), 2600);
  }
  if (!G || G.id !== id || G.phase !== 'play' || G.play !== g) return;
  if (online()) Net.note(ok ? T('{0} claimed {1} of the last {2} tricks — accepted', name, n, left) : T('{0} claimed {1} of the last {2} tricks — not accepted', name, n, left));
  if (ok) applyClaim(side, n);
}
function applyClaim(side, n) {
  const g = G.play, left = tricksLeft();
  g.tricks[side] += n; g.tricks[1 - side] += left - n; g.hands = g.hands.map(() => []); G.claimed = true;
  finishBoard();
}
/* a robot side that will surely take every remaining trick claims them and asks the humans on the other side */
async function robotClaim(g, seat) {
  g.rcl = g.history.length;
  const side = sideOf(seat), left = tricksLeft();
  const v = E.ddFull(g.hands, g.leader, side, g.trump, 1e6);
  if (v !== left) return false;
  const owners = online() ? agreeOwners(side) : ['host'];
  if (!owners.length) return false;
  const ok = await Net.askOwners(owners, { kind: 'rclaim', who: T('Robots'), n: left, left, hands: g.hands });
  if (!G || G.play !== g || G.phase !== 'play') return true;
  if (online()) Net.note(ok ? T('The robots claimed the last {0} tricks — accepted', left) : T('The robots claimed the last {0} tricks — play goes on', left));
  if (ok) applyClaim(side, left); else tick();
  return true;
}
/* an undo at an online table: the humans on the other side agree first (with robots there it happens at once) */
async function requestUndo(owner, name, seat) {
  const what = G.phase === 'bid' ? 'call' : 'move';
  const humans = seat == null ? [] : agreeOwners(sideOf(seat)).filter(o => o !== owner);
  if (humans.length && !(await Net.askOwners(humans, { kind: 'undo', who: name, what }))) return false;
  const ok = undo(owner);
  // no note in the table chat: the cards simply go back
  return ok;
}
// the text of a question to the other side (claim, robot claim, undo)
function askText(a) {
  if (a.kind === 'claim') return T('{0} claims {1} of the last {2} tricks', a.who, a.n, a.left);
  if (a.kind === 'rclaim') return T('The robots claim all of the last {0} tricks', a.left);
  if (a.kind === 'nd') return T('{0} asks for a new deal', a.who);
  return T('{0} wants to take back their last {1}', a.who, T(a.what || 'move'));
}
// a yes/no question inside the page (instead of the browser's own pop-up with the site's address)
function askYes(text, yes) {
  ui.yesFn = yes;
  openOv('yes', `<div class="big">${esc(text)}</div><div class="row2"><button class="btn new" id="yesOk">${T('Yes')}</button><button class="btn" id="oClose">${T('No')}</button></div>`);
}
// a question shown on this device: Accept / Decline
function askLocal(a, fin) {
  ui.askFin = fin;
  // a claim: every remaining card is shown open on the table itself, with a small Accept / Decline in the middle
  const hs = Array.isArray(a.hands) && a.hands.length === 4 ? a.hands.map(h => (Array.isArray(h) ? h : []).map(Number).filter(c => c >= 0 && c < 52)) : null;
  if (hs && G && G.phase === 'play') { ui.ask = { a, hands: hs }; render(); beep(); return; }
  openOv('ask', `<h2>❓ ${T('Do you agree?')}</h2><div class="big">${esc(askText(a))}</div>
    <div class="row2"><button class="btn new" data-askr="1">${T('Accept')}</button><button class="btn" data-askr="0">${T('Decline')}</button></div>`);
  beep();
}
// the question is over (answered here, answered by someone else, or timed out)
function askClose() {
  if (ui.ask) { ui.ask = null; render(); }
  if (ui.overlay === 'ask') closeOv();
}
/* play the same deal again (at an online table: for everyone) */
function replayDeal() {
  if (guest()) { Net.send({ t: "replay" }); HIST = HIST.filter(h => h.id !== G.id); closeOv(); return; }
  const d = G.deal; HIST = HIST.filter(h => h.id !== G.id); BOARD = G.board; newBoard(d);
}
function flash(msg, ms) { ui.toastChat = false; msg = T(msg); notify(String(msg).replace(/<[^>]*>/g, "")); ui.toast = msg; render(); setTimeout(() => { if (ui.toast === msg) { ui.toast = null; render(); } }, ms); }

/* ================= rendering ================= */
// the seat drawn at the bottom: normally yours; while your robot partner declares and you play both hands,
// the declarer's hand (for that board only — it switches back when the board ends)
const viewSeat = () => { if (G && G.phase === 'play' && G.play) { const d = G.play.contract.decl; if (d === pd(U()) && userControls(d)) return d; } return U(); };
const rel = seat => (seat - viewSeat() + 4) % 4;
const ORDER = [3, 2, 0, 1];
const sortHand = h => h.slice().sort((a, b) => ORDER.indexOf(S(a)) - ORDER.indexOf(S(b)) || R(b) - R(a));
function cardHtml(c, cls) {
  const s = S(c), r = R(c), face = r >= 9 && r <= 11;
  return `<div class="card s${s}${red(s) ? " rd" : ""}${face ? ' face' : ''}${cls ? ' ' + cls : ''}" data-c="${c}"><span class="ix"><b>${RTXT[r]}</b><i>${SUIT[s]}</i></span><span class="pip">${face ? `<em>${RTXT[r]}</em>` : ''}${SUIT[s]}</span></div>`;
}
const handsNow = () => G.phase === "play" ? (ui.ask && ui.ask.hands) || G.play.hands : G.deal;   // a claim being asked shows every remaining card
function isVisible(seat) {
  if (G && G.watch) return true;
  if (G && G.ct && typeof CT !== 'undefined' && CT.tbl && CT.tbl.watch) return true;   // watching a club table: every hand
  if (ui.ask && ui.ask.hands && G.phase === "play") return true;
  if (guest()) return handsNow()[seat].every(c => c >= 0); // the host only sends the cards you may see
  if (seat === U() || G.phase === "done") return true;
  if (ui.fixSeat === seat && G.phase === "play") return true;   // correcting a robot: its hand is shown to pick the card
  if (G.phase !== 'play') return false;
  const g = G.play;
  if (seat === g.dummy && g.dummyShown) return true;
  return sideOf(g.contract.decl) === sideOf(U()) && seat === pd(U()) && g.dummyShown;
}
function ctlInfo(seat) {
  const g = G.play; const ctl = !ui.ask && G.phase === 'play' && g.turn === seat && userControls(seat) && g.trick.length < 4;
  return { ctl, leg: ctl ? E.legalFor(g, seat) : [] };
}
function fanHtml(seat, max) {
  const { ctl, leg } = ctlInfo(seat);
  const h = sortHand(handsNow()[seat]);
  return `<div class="fan" data-max="${max}">${h.map(c => cardHtml(c, (ctl ? (leg.includes(c) ? 'play' : 'dim') : '') + (c === ui.hintCard ? ' hint' : ''))).join('')}</div>`;
}
function dummyCols(seat) {
  const { ctl, leg } = ctlInfo(seat), h = handsNow()[seat];
  // the card size follows the screen height, so the longest suit fits and the page never has to scroll
  const n = Math.max(1, ...ORDER.map(s => E.inSuit(h, s).length)), fit = ui.dwFit && ui.dwFit.h === innerHeight && ui.dwFit.w === innerWidth ? ui.dwFit.dw : 99;
  const dw = Math.round(Math.max(26, Math.min(innerWidth <= 600 ? 40 : 52, fit, innerHeight * 0.25 / (1.3 + (n - 1) * 0.5))));
  return `<div class="dcols" style="--dw:${dw}" data-dw="${dw}" data-n="${n}">${ORDER.map(s => `<div class="dcol">${E.desc(E.inSuit(h, s)).map(c => cardHtml(c, 'dc' + (ctl ? (leg.includes(c) ? ' play' : ' dim') : '') + (c === ui.hintCard ? ' hint' : ''))).join('')}</div>`).join('')}</div>`;
}
function vHand(seat) {
  const { ctl, leg } = ctlInfo(seat);
  let o = '<div class="vh">';
  for (const s of ORDER) {
    const cs = E.desc(E.inSuit(handsNow()[seat], s));
    o += `<div class="row"><span class="sy s${s}${red(s) ? " red" : ""}">${SUIT[s]}</span>${cs.map(c => `<span class="mini s${s}${red(s) ? " rd" : ""}${ctl ? (leg.includes(c) ? " play" : " dim") : ""}${c === ui.hintCard ? " hint" : ""}" data-c="${c}">${RTXT[R(c)]}<i>${SUIT[s]}</i></span>`).join('')}</div>`;
  }
  return o + '</div>';
}
// the name of the player at a seat (you, a player at an online table, or a robot)
function seatName(seat) {
  if (G && G.ct) return seat === U() ? (myNm() || T('You')) : G.ct.seats[seat];
  if (G && G.rtv) return rtName(seat, RT.all[G.rtv.k]);
  if (seat === meSeat()) return (online() && Net.st.names[U()]) || myNm() || T('You');
  // a robots' table's seat taken: the robots keep their names (while the system stays that table's)
  if (!online() && SET.rtNames && SET.rtNames.sys === SET.sys && SET.rtNames.n[seat]) return SET.rtNames.n[seat];
  return online() && Net.st.names[seat] ? Net.st.names[seat] : T('Robot');
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
  let who = seat === meSeat() ? (mine || T("You")) : nm ? nm + (Net.st.away && Net.st.away[seat] ? " (" + T("away · robot plays") + ")" : g && userControls(seat) ? " (" + T("you play") + ")" : "") : (g && userControls(seat) ? T("You play") : esc(seatName(seat)));   // a robots' table's robot: its name
  // the host can tap a player's name to remove them from the table (a robot takes the seat)
  if (online() && !guest() && nm && seat !== meSeat()) who = `<b class="pname" data-kickask="${seat}" title="${T('Remove')}">${esc(who)}</b><button class="kickx" data-kickask="${seat}" title="${T('Remove')}">✕</button>`;
  else if (seat === meSeat()) who = `<b class="pname" data-who="${esc(mine || T('You'))}">${esc(who)}</b>`;   // your own label opens your card (to change what the others see)
  const turn = (G.phase === 'bid' && bidTurn() === seat) || (G.phase === 'play' && g.turn === seat);
  return `<span class="lbl${turn ? ' turn' : ''}"><span class="${vulOf(G.board, seat) ? 'vn' : ''}">${SEAT[seat]}</span> ${who} ${tags.join('')}</span>`;
}
const backs = n => `<span class="backs">${'<i></i>'.repeat(Math.min(n, 13))}</span>`;
function renderBar() {
  if (!G) return;
  const b = G.board, u = U(), uNS = sideOf(u) === 0;
  const topbot = uNS ? vulOf(b, 0) : vulOf(b, 1), lr = uNS ? vulOf(b, 1) : vulOf(b, 0);
  const dst = ['bottom:-1px;left:50%;transform:translateX(-50%)', 'left:1px;top:50%;transform:translateY(-50%)', 'top:-1px;left:50%;transform:translateX(-50%)', 'right:1px;top:50%;transform:translateY(-50%)'][rel(G.dealer)];
  let con = '—', tr = '';
  if (G.play) { const c = G.play.contract; con = `${callHtml(B(c.level, c.strain))}${c.dbl === 1 ? ' X' : c.dbl === 2 ? ' XX' : ''} <span class="sm">${SEAT[c.decl]}</span>`; const us = sideOf(u); tr = `${T('Us')} <b class="tk">${G.play.tricks[us]}</b> · ${T('Them')} <b class="tk">${G.play.tricks[1 - us]}</b>`; }
  if (G.rtv) { const b = G.rtv.b;
    $('bar').innerHTML = `<div class="vulbox" title="Board ${b.bn}" style="border-color:${topbot ? 'var(--vul)' : '#f4f4f0'} ${lr ? 'var(--vul)' : '#f4f4f0'}">${b.bn}<span class="dl" style="${dst}">D</span></div>
     <button class="box" id="bAuc"><small>${T('Contract')}</small><b>${con}</b><span class="tr">${tr || '&nbsp;'}</span></button>
     <div class="box"><b>🔴 ${esc(RT_SYS[b.sys] || b.sys)}</b></div>
     <button class="btn hbtn" id="bHome" title="${T('Home')}"><b aria-hidden="true">🏠</b><small>${T('Home')}</small></button><button class="btn gold hbtn" id="bRtList" title="${T('Tables')}"><b aria-hidden="true">📊</b><small>${T('Tables')}</small></button><button class="btn new hbtn" id="bRtSit" title="${T('Sit down')}"><b aria-hidden="true">🪑</b><small>${T('Sit down')}</small></button>`;
    return; }
  const g = G.play;
  const canClaim = !G.ct && G.phase === "play" && !g.trick.length && userControls(g.turn) && g.hands[g.turn].length <= 8 && g.hands[g.turn].length > 0;
  const last = HIST.length ? HIST[HIST.length - 1] : null;
  const lastTxt = last ? (last.imp != null ? (fmtSigned(last.imp) + ' IMP · ' + last.mp + '%') : fmtSigned(last.us || 0)) : '&nbsp;';
  const per = Store.periods(HIST)[0];
  // at an online table the box shows the table score (North-South against East-West), not your own day
  const tblScore = online() && typeof Net !== "undefined" && Net.st.on ? (Net.st.score || { ns: 0, ew: 0, n: 0 }) : null;
  const dayTxt = per.scored ? fmtSigned(per.impSum) + ' IMP' + (per.mpAvg != null ? ' · ' + per.mpAvg + '%' : '') : '—';
  $('bar').innerHTML = `
   <div class="vulbox" title="Board ${b}" style="border-color:${topbot ? 'var(--vul)' : '#f4f4f0'} ${lr ? 'var(--vul)' : '#f4f4f0'}">${b}<span class="dl" style="${dst}">D</span></div>
   <button class="box" id="bAuc" title="Show the auction"><small>${T('Contract')}</small><b>${con}</b><span class="tr">${tr || '&nbsp;'}</span></button>
   ${tblScore ? `<button class="box" id="bTblScore" title="${T('Table score')}"><small>${T('Table score')}</small><b>NS ${tblScore.ins || 0} – EW ${tblScore.iew || 0}</b><span class="tr">IMP${tblScore.mpn ? ' · NS ' + Math.round(tblScore.mp / tblScore.mpn) + '% MP' : ''} · ${tblScore.n} ${T('boards')}${tblScore.wait ? ' ⏳' : ''}</span></button>` : `<div class="box"><small>${T('Today')}</small><b>${dayTxt}</b><span class="tr">${T('last:')} ${lastTxt}</span></div>`}
   <button class="btn hbtn" id="bHome" title="${T('Home')}"><b aria-hidden="true">🏠</b><small>${T('Home')}</small></button>
   <div class="spacer"></div>
   <div class="tools">
     <button class="btn new${ui.confirmNew > Date.now() ? ' warn' : ''}" id="bNew">${ui.confirmNew > Date.now() ? T('Sure?') : T('New Deal')}</button>
     <button class="btn" id="bUndo" ${(guest() ? G.phase !== "done" || true : UNDO.some(u => u.by === ME()) || (canFix() && UNDO.some(u => u.by === 'robotfix'))) ? "" : "disabled"}${canFix() ? ` title="${T("Take back the robot's card")}"` : ''}>${canFix() ? '↩ 🤖' : T('Undo')}</button>
     <button class="btn gold" id="bHint">${T('Hint')}</button>
     <button class="btn" id="bClaim" ${canClaim ? '' : 'disabled'}>${T('Claim')}</button>
     ${guest() ? `<button class="btn" id="nLeave" title="${T("Leave")}">🚪<span class="lbt"> ${T("Leave")}</span></button>` : online() ? `<button class="btn" id="nStop" title="${T("Close table")}">🚪<span class="lbt"> ${T("Close table")}</span></button><button class="btn" id="nHostLeave" title="${T("Leave")}">🚶<span class="lbt"> ${T("Leave")}</span></button>` : ''}
     ${typeof Net !== "undefined" ? (n => `<button class="btn narrowonly${n ? " gold" : ""}" id="bChat" title="${T("Chat")}">💬${n ? `<span class="cbn">${n}</span>` : ""}</button>`)((Net.st.unread || 0) + (Net.st.lunread || 0)) : ""}
     <span class="menuwrap">${(n => `<button class="btn${n ? " gold" : ""}" id="bMenu" title="${T('Menu')}" aria-expanded="${ui.menu ? 'true' : 'false'}">☰${n ? `<span class="cbn">${n}</span>` : ""}</button>`)(typeof Net !== "undefined" ? (Net.st.unread || 0) + (Net.st.lunread || 0) : 0)}${ui.menu ? `<div class="menu" role="menu">
       <button class="btn${online() ? " gold" : ""}" id="bNet">${online() ? T("Online") + " ●" : T("Online")}</button>
       <button class="btn" id="bBell" title="${T("Sound when it is your turn")}">${(SET.alert || "online") === "off" ? "🔕 " + T("Turn sound off") : "🔔 " + T("Turn sound on")}</button>
       <button class="btn" id="bHist">📜 ${T('History')}</button>
       <button class="btn" id="bRes">📊 ${T('Results')}</button>
       <button class="btn" id="bSet">⚙ ${T('Settings')}</button>
       <button class="btn" id="bHelp">❔ ${T('Help')}</button>
     </div>` : ''}</span>
   </div>`;
}
function explHtml(e, prefix) {
  if (!e) return T('Tap any call to see what it means.');
  const m = e.m || {}, ci = m.cv ? E.convInfo(m.cv) : null;
  if (e.al) return `<b>${prefix || SEAT[e.seat] + ':'} ${callHtml(e.call)}</b> <span class="al">⚠ ${T('Alert')}</span> ${esc(e.al)}<div class="muted">${T('Robot reading')}: ${symText(bidTxt(m.t))}</div>`;
  return `<b>${prefix || SEAT[e.seat] + ':'} ${callHtml(e.call)}</b> — ${symText(bidTxt(m.t))}${ci ? `<div class="cv"><span>${ci.n}</span>${symText(ci.d)}</div>` : ''}`;
}
// rv: a finished board from Results ({ board, dealer, seat, sel }): its calls are tapped with data-ri
function auctionTable(auction, phaseBid, rv) {
  const aucKey = G ? G.id + ":" + auction.length : "";   // the newest call drops in once
  setTimeout(() => { if (!rv) ui.aucSeen = aucKey; }, 0);
  const cols = [3, 0, 1, 2], board = rv ? rv.board : G.board, me = rv ? rv.seat : U(), sel = rv ? rv.sel : ui.lastExpl;
  const turnS = !rv && phaseBid && G && G.phase === 'bid' ? bidTurn() : -1;
  let o = '<table><thead><tr>' + cols.map(s => `<th class="${vulOf(board, s) ? 'v' : ''} ${s === me ? 'me' : ''}${s === turnS ? ' turn' : ''}">${SEAT[s]}${rv ? '' : `<small>${esc(seatName(s))}</small>`}</th>`).join('') + '</tr></thead><tbody><tr>';
  let col = cols.indexOf(rv ? rv.dealer : G.dealer); for (let i = 0; i < col; i++) o += '<td></td>';
  auction.forEach((e, i) => { o += `<td><span class="c${i === sel ? " sel" : ""}${!rv && i === auction.length - 1 && G && G.phase === "bid" && ui.aucSeen !== G.id + ":" + auction.length ? " newc" : ""}${e.m && e.m.cv ? ' cvb' : ''}${e.al ? ' alrt' : ''}" ${rv ? 'data-ri' : 'data-ai'}="${i}">${callHtml(e.call)}${e.al ? '!' : ''}</span></td>`; col++; if (col === 4) { o += '</tr><tr>'; col = 0; } });
  if (phaseBid) o += '<td>?</td>';
  return o + '</tr></tbody></table>';
}
function auctionPanel() {
  // the explanation appears only when you tap a call (or ask for a hint); tap again to close it
  const e = ui.hintBid ? { call: ui.hintBid.call, m: ui.hintBid.m } : (ui.lastExpl != null ? G.auction[ui.lastExpl] : null);
  const ex = e ? explHtml(e, ui.hintBid ? 'Suggestion:' : null) : '';
  return `<div class="auction">${auctionTable(G.auction, G.phase === 'bid')}</div>${e && SET.expl ? `<div class="expl" id="dExpl" role="button" tabindex="0">${ex}</div>` : `<div class="muted tap">${T("Tap a call to see what it means")}</div>`}`;
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
    if (!who) return `<i>${T("Robot")}</i>${guest() ? `<button class="btn" data-sit="${s}">${T("Sit here")}</button>` : ""}`;
    return `<b>${esc(who)}${s === me ? " " + T("(you)") : ""}</b>${away[s] ? `<em>${T("away · robot plays")}</em>` : ""}${!guest() && s !== me ? `<button class="btn" data-kick="${s}">${T("Remove")}</button>` : ""}`;
  };
  const mid = guest() ? `<div class="muted">${T("Waiting for the host to start.")}<br>${T("“Sit here” asks the host to move you.")}</div><button class="btn" id="nLeave">🚪 ${T("Leave the table")}</button>`
    : `<button class="btn new" id="bStart">${T("Start")}</button><button class="btn" id="bNet">${T("Online")}</button>`;
  const inv = guest() ? "" : `<div class="grp"><span>👥 ${T("Invite players")}${Net.st.priv ? " · 🔒 " + T("Private table") : ""}</span>${Net.peopleHtml()}</div>`;
  return `<div class="lobby"><h3>${T("Online table")}</h3>${guest() ? "" : Net.pendHtml()}${seatTable([0, 1, 2, 3].map(cell), mid, me)}${inv}${Net.scoreHtml()}</div>`;
}
function renderTable() {
  for (let seat = 0; seat < 4; seat++) {
    const r = rel(seat), el = $('pos' + r);
    if (r === 0) { el.innerHTML = fanHtml(seat, 78) + seatLabel(seat); continue; }
    let inner = '';
    // dummy opposite you is laid out as on a real table: one column per suit
    if (isVisible(seat)) inner = r === 2 ? fanHtml(seat, 78) : vHand(seat);   // your partner's dummy opposite: a fan like your own hand, easy to pick from
    else if (G.phase === 'play') inner = backs(G.play.hands[seat].length);
    else if (G.phase === 'bid' && G.deal && G.deal[seat]) inner = backs(G.deal[seat].length);   // wider screens show the players beside you while bidding
    el.innerHTML = seatLabel(seat) + inner;
  }
  $('table').classList.toggle('bidding', G.phase === 'bid');
  const C = $('center');
  $("table").classList.toggle("lobby", G.phase === "lobby" || G.phase === "idle"); document.body.classList.toggle("inlobby", G.phase === "lobby" || G.phase === "idle");
  if (G.phase === "lobby" || G.phase === "idle") { C.innerHTML = G.phase === "idle" ? idleHtml() : lobbyHtml(); return; }
  if (G.phase === 'bid') C.innerHTML = auctionPanel();
  else if (G.phase === 'play' && G.rtv && G.rtv.done) C.innerHTML = rtDoneHtml(G.rtv.b);   // a system table's board over: the result and the double-dummy table in the middle
  else if (G.phase === 'play' && ui.ask) C.innerHTML = `<div class="askbox"><div>❓ ${esc(askText(ui.ask.a))}</div><div class="row2"><button class="btn new" data-askr="1">${T('Accept')}</button><button class="btn" data-askr="0">${T('Decline')}</button></div></div>`;   // a claim: the hands are open, the question sits in the middle
  else if (G.phase === 'play') {
    // tap the table to look at the last finished trick; tap again (or wait) to come back
    const H = G.play.history, last = ui.showLast && H.length ? H[H.length - 1] : null;
    const tr = last ? last.cards : G.play.trick, w = last ? last.w : (tr.length === 4 ? E.trickWinner(tr, G.play.trump) : -1);
    // the card just played slides in from its player; a full trick then slides to the side that won it
    const akey = G.id + ':' + H.length + ':' + G.play.trick.length, fresh = ui.animKey !== akey; ui.animKey = akey;
    C.innerHTML = `<div class="trick${last ? " lasttrick" : ""}" id="trickArea">` + tr.map((x, i) => cardHtml(x.c, "tc p" + rel(x.s) + (x.s === w ? " win" : "") + (!last && i === tr.length - 1 && fresh ? " fly" : "") + (!last && tr.length === 4 ? " gather g" + rel(w) : ""))).join("") + (last ? `<div class="lastlbl">Last trick (${H.length}) — won by ${SEAT[last.w]}</div>` : (H.length && !tr.length ? `<div class="lasthint">${T("Tap here to see the last trick")}</div>` : "")) + "</div>";
  } else {
    // end of board: all four hands stay open on the table, the result sits in a banner in the middle
    const e = G.result;
    { const first = ui.doneSeen !== G.id; if (first) setTimeout(() => { ui.doneSeen = G.id; }, 0); var doneCls = first ? (e && e.us > 0 ? " good" : e && e.us < 0 ? " bad" : "") : ""; }
    const tab = (e && e.dd && e.dd.tab) || (G.field && G.field.dd && G.field.dd.tab);
    C.innerHTML = e && tab ? `<button class="rtdone ddend" id="oShow"><span class="rtres">${resultLine(e)}${e.imp != null ? `<small>${fmtSigned(e.imp)} IMP · ${e.mp}% MP</small>` : ''}</span>${ddTabHtml(tab)}<span class="ddtap">👆 ${T('Tap for the details')}</span></button><button class="btn new ddnext" id="oNext2">▶ ${T('Next deal')}</button>` : e ? `<button class="donebanner${doneCls}" id="oShow">${resultLine(e)}${e.imp != null ? `<small>${fmtSigned(e.imp)} IMP · ${e.mp}% MP</small>` : (G.field && !G.field.done ? `<small>Robot tables: ${G.field.tables.length}/${G.field.n || 10}…</small>` : "")}${e.prv ? `<small class="prvsum">${prvSum(e.prv)}</small>` : ""}<small>${T("Tap for details")}</small></button><button class="btn new" id="oNext2" style="align-self:center;margin-top:8px">${T("Next deal")}</button>` : '';
  }
  if (ui.toast) C.insertAdjacentHTML('beforeend', `<div class="toast" id="toast">${ui.toast}</div>`);
  layoutFans(); fitTable(); updateRcpt();
}
// still taller than the window (a long suit in dummy): make the dummy's cards smaller until the page fits
function fitTable() {
  // the cards of the trick: North's on top and South's at the bottom of the middle must never meet, so their size follows the room
  { const c = $("center"); if (c && c.clientHeight) { const hand = parseFloat(getComputedStyle($("pos0")).getPropertyValue("--fcw")) || 64; const w = Math.max(26, Math.min(hand >= 45 ? hand : 80, 80, (c.clientHeight - 12) / 3.05, (c.clientWidth - 8) / 2.65));  /* on a phone (small hand cards) the trick may be bigger */ c.style.setProperty("--tcw", w.toFixed(1) + "px"); } }
  const d = document.querySelector(".dcols"); if (!d || !G || G.phase === "idle") return;
  const over = document.documentElement.scrollHeight - innerHeight; if (over <= 0) return;
  const n = +d.dataset.n || 1, cur = +d.dataset.dw || 52, dw = Math.max(26, Math.floor(cur - over / (1.3 + (n - 1) * 0.5)) - 1);
  if (dw >= cur) return;
  ui.dwFit = { h: innerHeight, w: innerWidth, dw }; d.style.setProperty("--dw", dw); d.dataset.dw = dw;
}
function layoutFans() {
  document.querySelectorAll('.fan').forEach(el => {
    const n = el.children.length; if (!n) return;
    const W = el.clientWidth, max = +el.dataset.max || 70;
    // classic cards: as wide as fits, and on short screens low enough for the hand to stay in view
    const big = SET.big ? 1.3 : 1;
    if (SET.style !== "modern") {
      // short cards (as on the big bridge sites): the name plate covers their lower part, the rank and suit stay in view
      const hmax = innerHeight * (innerHeight < 450 ? 0.14 : innerHeight < 600 ? 0.155 : 0.2) * big / 1.25, side = (W - (n - 1)) / n;
      let cw = Math.max(20, Math.min(64 * big, side, hmax)), ov = 1;
      // a narrow screen: the cards overlap a little (the rank stays in view at the left) so they can be bigger
      if (side < 44 && n > 1) { cw = Math.max(20, Math.min(64 * big, hmax, W / (1 + (n - 1) * 0.68))); ov = Math.min(1, (W - cw) / (n - 1) - cw); }
      el.classList.toggle("ovl", ov < 0);
      el.style.setProperty("--cw", cw + "px"); el.style.setProperty("--ov", ov + "px"); if (el.parentElement) el.parentElement.style.setProperty("--fcw", cw + "px"); return;
    }
    const cw = Math.max(28, Math.min(max * big, W / (1 + (n - 1) * 0.44)));
    const step = n > 1 ? Math.min(cw * 1.04, (W - cw) / (n - 1)) : 0;
    el.style.setProperty('--cw', cw + 'px'); el.style.setProperty('--ov', (step - cw) + 'px');
  });
}
// practising with "show the chance" on: a quiet sign over the bidding box when the system would use a practised
// convention right now (it does not say which call)
function pracHintHtml() {
  if (!SET.pracHint || !pracList().length || online() || G.tour || G.phase !== 'bid' || bidTurn() !== U()) return '';
  const key = G.id + ':' + G.auction.length;
  if (!ui.pracOpp || ui.pracOpp.key !== key) { const r = E.aiBid(G.auction, U(), G.deal[U()], G.cards); ui.pracOpp = { key, on: !!(r.m && pracList().includes(r.m.cv)) }; }
  return ui.pracOpp.on ? `<div class="prhint">📚 ${T('A convention you are practising can be used here')}</div>` : '';
}
function renderBidbox() {
  const bb = $('bidbox');
  if (G.phase !== 'bid' || bidTurn() !== meSeat()) { bb.innerHTML = ''; bb.dataset.k = ''; bb.hidden = true; return; }
  bb.hidden = false; const L = legalCalls(G.auction, U());
  const lv = [1, 2, 3, 4, 5, 6, 7].map(l => `<button data-lvl="${l}" class="${ui.selLvl === l ? 'sel' : ''}" ${L.some(c => isNum(c) && LV(c) === l) ? '' : 'disabled'}>${l}</button>`).join('');
  const sts = [0, 1, 2, 3, 4].map(s => { const c = ui.selLvl ? B(ui.selLvl, s) : -1; return `<button data-call="${c}" class="st s${s}${red(s) ? " r" : ""}${s === 4 ? ' nt' : ''}" ${ui.selLvl && L.includes(c) ? '' : 'disabled'}>${STR[s]}</button>`; }).join('');
  // two rows, as on the big bridge sites: Pass, X, XX and the levels; then the suits of the chosen level
  let html = pracHintHtml() + `<div class="row r1"><button data-call="P" class="pass">${T("Pass")}</button><button data-call="X" class="dbl" title="${T("Double")}" ${L.includes("X") ? "" : "disabled"}>X</button><button data-call="XX" class="rdbl" title="${T("Redouble")}" ${L.includes("XX") ? "" : "disabled"}>XX</button>${lv}</div><div class="row r2">${sts}</div>`;
  // what the calls of the chosen level mean, before one is made (the call under the mouse shows in #bidHover)
  const mean = c => { const m = E.explainCall(G.auction, U(), c, G.cards) || {}; return `<div class="bpk"><b>${callHtml(c)}</b> ${symText(bidTxt(m.t || ''))}</div>`; };
  html += `<div class="bpeek" id="bidHover" hidden></div>` + (ui.selLvl && SET.expl ? `<div class="bpeek">${[0, 1, 2, 3, 4].map(st => B(ui.selLvl, st)).filter(c => L.includes(c)).map(mean).join('')}</div>` : '');
  // redraw only when something changed, so the alert text being typed keeps its focus
  if (bb.dataset.k !== html) { bb.dataset.k = html; bb.innerHTML = html; const i = $('alTxt'); if (i) i.value = ui.alertTxt || ''; }
}
document.addEventListener('click', e => { const r = e.target.closest && e.target.closest('[data-rank]'); if (r) { e.stopPropagation(); showRankHelp(); } }, true);
document.addEventListener('mouseover', e => {
  const b = e.target.closest && e.target.closest('#bidbox [data-call]'), h = $('bidHover'); if (!h) return;
  if (!SET.expl) { h.hidden = true; return; }   // the meanings only with Bid explanations on
  if (!b || b.disabled || !G || G.phase !== 'bid') { h.hidden = true; return; }
  const c = /^\d+$/.test(b.dataset.call) ? +b.dataset.call : b.dataset.call; if (c === -1) { h.hidden = true; return; }
  const m = E.explainCall(G.auction, U(), c, G.cards) || {};
  h.innerHTML = `<div class="bpk"><b>${callHtml(c)}</b> ${symText(bidTxt(m.t || ''))}</div>`; h.hidden = false;
});
function renderStatus() {
  let s = "";
  // at an online table the player's name is shown when a friend (not a robot) is to act
  const nameOf = seat => { if (!online()) return SEAT[seat]; const o = Net.owner(seat), at = Object.keys(Net.st.names).find(k => (Net.guest ? Net.st.ctl[k] : (Net.st.seats[k] || "robot")) === o); return o !== "robot" && at != null ? Net.st.names[at] : SEAT[seat]; };
  if (G.rtv) { const b = G.rtv.b; s = '🔴 ' + (RT_SYS[b.sys] || b.sys) + ' · ' + rtConv(b) + ' · ' + T('Board {0} of {1}', b.k, b.of); }   // the end of a board: in the middle of the table (rtDoneHtml)
  else if (G.watch && (G.phase === 'bid' || G.phase === 'play')) s = '🤖 ' + T('The robots are playing this deal — watch');
  else if (G.phase === 'bid') s = bidTurn() === meSeat() ? T('Your call') : T('{0} is thinking…', nameOf(bidTurn()));
  else if (G.phase === "play" && ui.ask) s = T("Do you agree?");
  else if (G.phase === 'play') { const g = G.play; if (g.trick.length === 4) s = T('Gathering the trick…'); else if (userControls(g.turn)) s = g.turn === U() ? T('Your turn: play a card') : T("Play from {0}'s hand", SEAT[g.turn]); else s = T('{0} is playing…', nameOf(g.turn)); }
  else if (G.phase === "idle") s = T("Press Start to deal");
  else if (G.phase === "lobby") s = guest() ? T("Waiting for the host to start") : T("Waiting for players — press Start when everyone is seated");
  else s = T('Board finished');
  // a robot's card taken back: the strip stays until you play its card (or cancel, and the robot plays its own again)
  const fix = ui.fixSeat != null && G.phase === 'play' ? `<div class="fixbar">🤖 ${T("Choose {0}'s card", SEAT[ui.fixSeat])}<button class="btn mini-btn" id="fixCancel">${T('Cancel')}</button></div>` : '';
  $("status").innerHTML = fix + s + (ui.signal && G.phase === "play" ? `<div class="sig">${symText(ui.signal)}</div>` : "");
}
function render() {
  if (!G) return; document.body.classList.toggle("classic", SET.style !== "modern"); applyLook();
  const home = G.phase === 'idle';
  document.body.classList.toggle('athome', home); $('home').hidden = !home;
  // the open practice drop-down keeps where it was scrolled to (a tick, or the lobby's updates, draw it again)
  if (home) { const pp = document.querySelector('.pdpanel'), top = pp ? pp.scrollTop : 0, win = window.scrollY; renderHome(); renderDock(); const np = document.querySelector('.pdpanel'); if (np && top) np.scrollTop = top; if (pp && Math.abs(window.scrollY - win) > 2) window.scrollTo(0, win); return; }
  renderBar(); renderTable(); renderBidbox(); renderStatus(); turnAlert(); renderDock();
}
/* ---- chat while playing: a column on the right on a wide screen; on a phone (or a narrow window) a panel that
   opens from the bottom with 💬 and closes after Send. At an online table there are two tabs: table and lobby. ---- */
// who is in the lobby: tap a name to write to that player privately
function whoHtml() {
  friendsCheck();
  const names = Net.knownNames().sort((a, b) => isFriend(b) - isFriend(a)), un = n => { const c = Object.entries(Net.st.dmUnread).find(([k, v]) => v && Net.st.dms[k] && Net.st.dms[k].name.toLowerCase() === n.toLowerCase()); return c ? ` <span class="badge">${c[1]}</span>` : ''; };
  return names.length ? `<small>${T('In the lobby')}:</small> ${names.map(n => `<button class="whob" data-who="${esc(n)}">${isFriend(n) ? '★' : '●'} ${esc(n)}${(s => s ? ` <small>${s}</small>` : '')(Net.sysShort(Net.profOf(n)))} 💬${un(n)}</button>`).join('')}` : `<small>${T('Nobody else is in the lobby right now.')}</small>`;
}
const dockWide = () => window.matchMedia('(min-width:1100px)').matches;
function toggleDock() {
  if (dockWide()) { const i = $('dMsg'); if (i) i.focus(); return; }
  ui.dockOpen = !ui.dockOpen; renderDock();
  if (ui.dockOpen) setTimeout(() => { const i = $('dMsg'); if (i) i.focus(); }, 50);
}
// the new-message count on 💬 in the top bar
function chatBadge() {
  const n = (Net.st.unread || 0) + (Net.st.lunread || 0);
  for (const bc of [$('bMenu'), $('bChat')]) { if (!bc) continue;
  let s = bc.querySelector('.cbn');
  if (n) { if (!s) { s = document.createElement('span'); s.className = 'cbn'; bc.appendChild(s); } s.textContent = n; } else if (s) s.remove();
  bc.classList.toggle('gold', !!n); }
}
function renderDock() {
  const d = $('dock'); if (!d || typeof Net === 'undefined' || !G) return;
  const athome = G.phase === 'idle', wide = dockWide();
  chatBadge();
  const cb = $('chatBtn'); if (cb) { cb.hidden = athome || wide; const n = (Net.st.unread || 0) + (Net.st.lunread || 0); const s = $('chatBtnN'); if (s) s.textContent = n ? '(' + n + ')' : ''; }
  const show = !athome && (wide || ui.dockOpen);
  document.body.classList.toggle('withdock', !athome && wide);
  d.hidden = !show; if (!show) return;
  const tbl = online(), tab = tbl ? (ui.dockTab || 'table') : 'lobby';
  const key = tab + ':' + tbl + ':' + SET.lang;
  if (d.dataset.key !== key) {
    d.dataset.key = key;
    const tabs = tbl ? `<div class="dtabs"><button data-dtab="table" class="${tab === 'table' ? 'on' : ''}">${T('Table')} <span id="dTn"></span></button><button data-dtab="lobby" class="${tab === 'lobby' ? 'on' : ''}">${T('Lobby')} <span id="dLn"></span></button></div>` : `<b>💬 ${T('Lobby chat')}</b>`;
    d.innerHTML = `<div class="grip gripx" data-grip="dockw" title="${T('Drag to resize')}"></div><div class="dhead">${tabs}<span class="dbtns"><button class="btn mini-btn" id="dClear" title="${T('Clear the chat')}">🗑</button><button class="btn mini-btn dclose" id="dClose">✕</button></span></div>
      <div class="${tab === 'table' ? 'dbody' : 'lsplit dsplit'}">${tab === 'table' ? '' : `<div class="lplayers"><div id="dPlayers"></div>${playersFoot()}</div><div class="grip gripc" data-grip="plw" title="${T('Drag to resize')}"></div>`}<div class="lcol"><div class="lmsgs" id="dList"></div>
      ${tab === 'table' ? `<div class="quick">${Net.QUICK.map(q => `<button data-dq="${esc(T(q))}">${esc(T(q))}</button>`).join('')}</div>` : ''}
      <div class="pmto" id="dPmTo"></div>
      </div></div><div class="composer"><button class="btn rcpt" id="dRcpt" title="${T("Who gets the message")}">${rcptLabel("dock")}</button><textarea class="cmsg" id="dMsg" rows="1" maxlength="300" placeholder="${T('Write a message…')}"></textarea><button class="btn sendb" id="dSend" title="${T("Send")}" aria-label="${T("Send")}">➤</button></div>`;
  }
  const html = tab === 'table' ? Net.tchatHtml() : Net.lchatHtml(), L = $('dList');
  { const p = $('dPlayers'), h = tab === 'table' ? '' : Net.playersHtml(); if (p && p.innerHTML !== h) p.innerHTML = h; }   // the players beside the lobby chat
  updateRcpt();
  { const p = $("dPmTo"), h = tab !== "table" && ui.pmTo ? `🔒 ${T("Private message to {0}", esc(ui.pmTo))} <button class="btn mini-btn" data-pmx="1">✕</button>` : ""; if (p && p.innerHTML !== h) p.innerHTML = h; }
  if (L && L.innerHTML !== html) { L.innerHTML = html; L.scrollTop = L.scrollHeight; }
  friendsCheck();   // the players are listed under 👥, not above the chat; a friend's arrival is still announced
  if (tab === 'table') Net.st.unread = 0; else Net.st.lunread = 0;
  const tn = $('dTn'), ln = $('dLn');
  if (tn) tn.textContent = Net.st.unread ? '(' + Net.st.unread + ')' : '';
  if (ln) ln.textContent = Net.st.lunread ? '(' + Net.st.lunread + ')' : '';
  chatBadge();
}
function dockSend(text) {
  text = String(text || '').trim(); if (!text) return;
  if (champLive()) { flash(T('The lobby chat is closed while you play in the championship.'), 2600); return; }
  if (online() && (ui.dockTab || 'table') === 'table') Net.sendChat(text); else lobbySend(text);
  // the panel stays open after sending; it is closed with ✕
  renderDock();
}
window.addEventListener('resize', () => renderDock());
/* the table is waiting for you: a sound and a note even with the turn sound off */
function nudged(secs) {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  beep(); flash('⏰ ' + T('Your turn — the table is waiting ({0} s)', secs), 3500);
}
/* the host keeps an eye on the clock: a player who has not called or played for 45 seconds is reminded, again
   at 90; the host is told and can tap the name to remove a player who has gone */
setInterval(() => {
  if (!G || !online() || guest() || (G.phase !== 'bid' && G.phase !== 'play')) { ui.slow = null; return; }
  const g = G.play, s = G.phase === 'bid' ? bidTurn() : g.turn;
  if (G.phase === 'play' && g.trick.length === 4) return;
  const id = Net.owner(s), key = G.id + ':' + G.auction.length + ':' + (g ? g.history.length * 4 + g.trick.length : 0);
  if (id === 'robot') { ui.slow = null; return; }
  if (!ui.slow || ui.slow.key !== key) { ui.slow = { key, t0: Date.now(), n: 0 }; return; }
  const secs = Math.round((Date.now() - ui.slow.t0) / 1000);
  if ((secs >= 45 && ui.slow.n === 0) || (secs >= 90 && ui.slow.n === 1)) {
    ui.slow.n++; Net.nudge(id, secs);
    const who = Net.st.names[s] || SEAT[s];
    if (id !== Net.me && id !== 'host') flash('⏰ ' + T('{0} has not played for {1} s — tap the name to remove', who, secs), 4000);
  }
}, 5000);
/* a short sound and a buzz when it becomes your turn to bid or play (Settings: at online tables, always, or off) */
let AC = null;
function beep() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1175, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.24);
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate(90); } catch (e) {}
}
/* table sounds (Settings): a soft click for each card, a swish when a trick is gathered, a short tune at the end
   (rising when we made our contract or beat theirs, falling when we went down or they made it) */
function sfx(k) {
  if (!SET.sfx) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime, out = AC.createGain(); out.connect(AC.destination);
    const noise = (dur, f, q, vol) => {
      const n = AC.createBuffer(1, Math.ceil(AC.sampleRate * dur), AC.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
      const s = AC.createBufferSource(), b = AC.createBiquadFilter(); s.buffer = n; b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      out.gain.value = vol; s.connect(b); b.connect(out); s.start(t);
    };
    const tune = (notes, type) => notes.forEach((fq, i) => {
      const o = AC.createOscillator(), g = AC.createGain(), s = t + i * 0.12;
      o.type = type; o.frequency.value = fq; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.14, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.28);
      o.connect(g); g.connect(AC.destination); o.start(s); o.stop(s + 0.3);
    });
    if (k === 'card') noise(0.05, 2400, 1.2, 0.5);
    else if (k === 'trick') noise(0.16, 900, 0.7, 0.35);
    else if (k === 'good') tune([523, 659, 784], 'triangle');
    else if (k === 'bad') tune([440, 370, 294], 'sine');
  } catch (e) {}
}
// light or dark screens and larger cards (Settings); "automatic" follows the phone or PC
// what every player has (no longer chosen in Settings)
function fixedSet() {
  if (SET.explV !== 1) { SET.explV = 1; SET.expl = false; }   // the bid explanations start hidden (once; Settings turns them on)
  Object.assign(SET, { homeV: 'new', style: 'modern', felt: 'green', back: 'blue', four: true, big: true, opp: 'same', robotLvl: 'expert', speed: 0 });
}
function applyLook() {
  fixedSet();
  const dark = SET.theme === 'dark' || (SET.theme !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.body.classList.toggle('bigcards', !!SET.big);
  document.body.classList.toggle('four', !!SET.four);   // four-colour deck
  for (const k of ['green', 'red', 'navy']) document.body.classList.toggle('back-' + k, SET.back === k);   // card backs
  for (const k of ['blue', 'wood', 'dark', 'red']) document.body.classList.toggle('felt-' + k, SET.felt === k);   // table cloth
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyLook()); } catch (e) {}
// browsers only allow sound after a tap: unlock it on the first one
document.addEventListener('pointerdown', () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} }, { once: true });
function turnAlert() {
  const mode = SET.alert || 'online';
  const g = G.play, me = meSeat();
  const mine = me >= 0 && ((G.phase === 'bid' && bidTurn() === me) || (G.phase === 'play' && g.trick.length < 4 && userControls(g.turn)));
  const key = mine ? G.id + ':' + G.auction.length + ':' + (g ? g.history.length * 4 + g.trick.length : 0) : '';
  if (mine && key !== ui.alertKey && mode !== 'off' && (mode === 'always' || online())) { beep(); if (online()) notify(T('Your turn')); }
  ui.alertKey = key;
}

/* ================= home page: start, open tables, our convention card and the lobby chat ================= */
// a base system chosen: another system starts with no conventions ticked (the player ticks the ones they play)
// a new base system keeps the conventions already on the card (the player adds or removes them; nothing is wiped)
function setSys(k) { SET.sys = k; SET.practice = ''; }
const sysIs = k => (SET.sys || 'twoone') === k;   // 'none' (a new player's empty card) marks none
const myNm = () => { try { return localStorage.getItem('bridge-table-name') || ''; } catch (e) { return ''; } };
/* ---- several people on one device: each name keeps its own results, settings, progress, friends and messages.
   Logging out puts them away under the name (bridge-acct:<name>) and the device starts fresh; signing in with a
   name used here before brings that player's things back. The look of the app (language, theme, cards, speed,
   sounds) belongs to the device and stays. ---- */
const ACCT_LS = ['bridge-friends', 'bridge-dms', 'bridge-dm-out', 'bridge-dm-seen', 'bridge-rated', 'bridge-req-mute', 'bridge-tour-seats'];
const DEVICE_SET = ['lang', 'langAuto', 'theme', 'style', 'big', 'speed', 'sfx', 'felt', 'back', 'four', 'expl', 'auto', 'instNo'];   // the welcome counts per player
const acctKey = k => 'bridge-acct:' + k;
function acctStash(k) {
  if (!k) return;
  const ls = {}; for (const x of ACCT_LS) { try { const v = localStorage.getItem(x); if (v != null) ls[x] = v; } catch (e) {} }
  const saved = G && G.phase !== 'idle' && !online() ? G : ui.saved || null;
  try { localStorage.setItem(acctKey(k), JSON.stringify({ set: SET, hist: HIST, board: BOARD, saved, ls, ts: Date.now() })); } catch (e) {
    // too big for the browser's storage: keep it without the older boards' cards
    try { localStorage.setItem(acctKey(k), JSON.stringify({ set: SET, hist: HIST.map((h, i) => i < HIST.length - 30 ? { ...h, deal: undefined, auc: undefined, pl: undefined, fieldList: undefined } : h), board: BOARD, saved, ls, ts: Date.now() })); } catch (x) {}
  }
}
// the device as for a new player (keeping its own look); with a stash, that player's things instead
function acctLoad(k) {
  let a = null; try { a = k && JSON.parse(localStorage.getItem(acctKey(k)) || 'null'); } catch (e) {}
  const dev = {}; for (const x of DEVICE_SET) if (SET[x] !== undefined) dev[x] = SET[x];
  SET = Object.assign({ style: "classic", seat: 2, speed: 1, expl: true, auto: true, mode: 'IMP', opp: 'same', sfx: true, conv: { ...E.ALL_ON } }, a ? a.set : {}, dev);
  HIST = a ? a.hist || [] : []; BOARD = a ? a.board || 0 : 0; G = idleG(); ui.saved = a ? a.saved || null : null;
  seasonStart();   // a player put away before the season: their old boards are kept aside too
  for (const x of ACCT_LS) { try { if (a && a.ls && a.ls[x] != null) localStorage.setItem(x, a.ls[x]); else localStorage.removeItem(x); } catch (e) {} }
  SET.cloudSet = 0;
  return !!a;
}
/* ---- practise a convention: the heart of the home page. Pick one and the robots deal hands where our side uses
   it (freshDeal looks for them); every call can be tapped to see what it means. ---- */
const PRAC_GROUPS = [
  ['After 1NT', ['stayman', 'puppet', 'fourWay', 'minorTr', 'smolen', 'texas', 'texasInt', 'leb']],
  ['Major openings', ['j2nt', 'bergen', 'splinter', 'drury']],
  ['Slam bidding', ['rkc', 'rkc0314', 'gerber']],
  ['When they bid', ['capp', 'dont', 'michaels', 'supx', 'respx']],
  ['Responses and more', ['twoOverOne', 'invMin', 'wjs', 'sjs', 'nmf', 'fsf', 'ogust', 'gamb']],
];
// the same choice as in Settings, on the home page: the convention the next deals are dealt for
function pracHtml() {
  // the title with its explanation; under it two drop-downs: the base system (one) and the conventions to practise
  // (any number, your system's first); under each, what is chosen
  const sel = pracList(), cur = E.sysOf(SET.sys);
  const sysName = k => ({ twoone: '2/1 Game Force', sayc: 'SAYC', acol: 'Acol', sef: 'French Standard', precision: 'Precision Club', polish: 'Polish Club' })[k] || (E.SYSTEMS.find(s => s.k === k) || {}).n || k;
  const bid = c => pracKnown(c.k) && !CARD_KEYS.includes(c.k), on = E.CONVS.filter(c => SET.conv[c.k] && bid(c)), off = E.CONVS.filter(c => !SET.conv[c.k] && bid(c));
  const item = (attr, k, label, checked) => `<label class="pdi${checked ? ' on' : ''}"><input type="checkbox" ${attr}="${k}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
  const sysPanel = ui.pracDrop === 'sys' ? `<div class="pdpanel">${E.SYSTEMS.map(s => item('data-pdsys', s.k, esc(sysName(s.k)), sysIs(s.k))).join('')}</div>` : '';
  const convPanel = ui.pracDrop === 'conv' ? `<div class="pdpanel wide"><div class="pdh">1. ${T('Base system')}</div>${E.SYSTEMS.map(s => item('data-pdsys', s.k, esc(sysName(s.k)), sysIs(s.k))).join('')}
      <div class="pdh">2. ${T('Practice a convention')}</div>${item('data-pdoff', '1', T('Off — normal random deals'), !sel.length)}
      <div class="pdh">${T('Basics (every system)')}</div>${PRAC_BASICS.map(k => item('data-pdconv', k, esc(pracName(k)), sel.includes(k))).join('')}
      ${on.length ? `<div class="pdh">${T('In your system')}</div>${on.map(c => item('data-pdconv', c.k, esc(c.n), sel.includes(c.k))).join('')}` : ''}
      ${off.length ? `<div class="pdh">${T('Not in your system')}</div>${off.map(c => item('data-pdconv', c.k, esc(c.n), sel.includes(c.k))).join('')}` : ''}
      <div class="pdh">${T('On defence: discards')}</div>${CARD_KEYS.map(k => item('data-pdconv', k, esc(pracName(k)), sel.includes(k))).join('')}
      <button class="btn gold pddone" id="pdDone">${T('Done')}</button></div>` : '';
  return `<div class="prtop"><div class="prhd"><h2 class="prtitle">📚 ${T('Practise conventions')}</h2><button class="btn prplay" id="pdPlay">▶ ${T('Deal practice')}</button><button class="btn mini-btn prx" id="pdClose" title="${T('Close')}">✕</button></div></div>
    <div class="prrow2">
      <div class="prf"><button class="prdrop sys" id="pdSys" aria-expanded="${ui.pracDrop === 'sys'}">${T('Base system')} <i>▾</i></button><div class="prval">${SET.sys === 'none' ? '—' : esc(sysName(cur.k))}</div>${sysPanel}</div>
      <div class="prf"><button class="prdrop${sel.length ? ' on' : ''}" id="pdConv" aria-expanded="${ui.pracDrop === 'conv'}">${T('Practice a convention')} <i>▾</i></button><div class="prval">${sel.length ? esc(pracNames()) : T('Off — normal random deals')}</div>${convPanel}</div>
    </div>
    <div class="prhintrow"><label class="prhintsw"><input type="checkbox" id="pdHint" ${SET.pracHint ? "checked" : ""}> 📚 ${T("Notify me")}</label><button class="btn hconv prconv" data-hsec="conv">📋 ${T('Convention card')}</button></div>
    ${pracWarnHtml()}
    ${pracProgHtml()}
    <div class="praskrow"><button class="prask" id="hConvAsk">➕ <span class="lg">${T('Add a convention')}</span><span class="sh">${T('Convention')}</span></button>${typeof Net !== 'undefined' && Net.isAdmin() ? '' : `<button class="prask" id="hSup">✉️ <span class="lg">${T('Write to the administrator')}</span><span class="sh">${T('Admin')}</span></button>`}</div>`;
}
// tick or untick a convention to practise (it goes on the card; the one it replaces comes off)
function togglePractice(k, add) {
  if (!pracKnown(k)) return;
  const c = E.CONVS.find(y => y.k === k) || { k };
  let L = pracList().filter(x => x !== k);
  if (add) { L.push(k); if (c.n) SET.conv[k] = true; if (c.x) { SET.conv[c.x] = false; L = L.filter(x => x !== c.x); } }
  SET.practice = L.join(','); Store.saveSettings(SET); save();
}
// the convention to practise ('' = off): it goes on our card (and the one it replaces off); games started from now on use it
function setPractice(k) {
  const c = k && E.CONVS.find(y => y.k === k);
  SET.practice = c ? k : '';
  if (c) { SET.conv[k] = true; if (c.x) SET.conv[c.x] = false; }
  Store.saveSettings(SET); save();
  flash(c ? '📚 ' + T('Practising {0}: the next deals use it', c.n) : T('Practice ended — normal random deals'), 2200);
}
function startPractice(k) { setPractice(k); }
function stopPractice() { SET.practice = ''; Store.saveSettings(SET); save(); render(); flash(T('Practice ended — normal random deals'), 2000); }
function homeShell() { return homeShell2(); }
// the new home page: the you strip, the Play card (a fan of four cards) with three tiles, the practice box, the open
// tables; the lobby chat beside them (under them on a phone). Same ids as the classic page.
function homeShell2() {
  const fan = [['A', '♠', ''], ['K', '♥', ' rd'], ['Q', '♦', ' rd'], ['J', '♣', '']].map(([r, su, c], i) => `<span class="h2c${c}" style="--i:${i}"><b>${r}</b><i>${su}</i></span>`).join('');
  const tile = (attrs, ico, title, sub) => `<${attrs.startsWith('href') ? 'a' : 'button'} class="h2tile" ${attrs}><span class="h2ti" aria-hidden="true">${ico}</span><b>${title}</b><small>${sub}</small></${attrs.startsWith('href') ? 'a' : 'button'}>`;
  return `<div class="home v2">
  <header class="h2head"><div class="brand"><span class="suits">♠<i>♥</i><i>♦</i>♣</span>${T('Bridge Table')}</div><button class="h2lobby" data-hsec="chat" title="${T('Lobby chat')}">💬 ${T('Lobby')} <b class="h2unr" id="hChatN"></b></button>
    <div class="h2tools"><label class="hlang" title="${T('Language')}"><span aria-hidden="true">🌐</span><select id="hLang" class="sel" aria-label="${T('Language')}">${LANGS.map(([v, l]) => `<option value="${v}" ${SET.lang === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <span id="hInst"></span><button class="hico" id="bTheme" title="${T("Day / night")}" aria-label="${T("Day / night")}"></button><button class="hico" id="bRes" title="${T('Results')}" aria-label="${T('Results')}">🕘</button><button class="hico" id="bHelp" title="${T('Help')}" aria-label="${T('Help')}">?</button><button class="hico" id="bSet" title="${T('Settings')}" aria-label="${T('Settings')}">⚙︎</button><button class="hico hwa" id="bShareApp" title="${T('Send the app')}" aria-label="${T('Send the app')}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3z"/></svg></button></div></header>
  <div class="hgrid">
    <section class="hmain"><div class="h2cola"><div id="hPend"></div><div id="hClubT"></div>
      <div class="h2me"><button id="hNameBtn" class="h2name" title="${T('Edit my card')}"></button><div class="h2mid"><div class="h2chips" id="hMe"></div><button class="hpz" id="hPuzzle"></button><span id="hAdm"></span></div><button class="hstats" id="hStats" title="${T('Your rating')}"></button></div>
      <div class="h2pr"><div class="h2play">
        <button class="h2fan h2fango" id="bGoFan" aria-hidden="true" tabindex="-1">${fan}</button>
        <div class="h2ptx"><h2><button class="h2ptitle" id="bGoTitle">${T('Play offline')}</button></h2><p id="hGoSub"></p><div class="h2btns"><button class="btn h2go" id="bGo"><span id="hGo"></span></button><button class="btn h2go h2conv" id="bConvGo">📚 ${T('Practise conventions')}</button></div></div>
      </div>
      </div>
      <div class="h2tiles">
        ${tile('id="hOpen" type="button"', '🌐', T('Open an online table'), T('Play with friends; robots take the empty seats.'))}
        ${tile('id="hClubs" type="button"', '🏛', T('Clubs'), T('Club tournaments with movements and results.'))}
        ${tile('id="sbOpen" type="button"', '🃏', T('Team match'), T('Two teams, two rooms, real cards: the app scores IMPs and VPs.'))}
      </div>
      </div><div class="h2colb">
      <div class="hcard prac" id="hPrac"></div>
      <div class="hcard rtcard" id="hRobot"></div>   <!-- the robots' live table, then the open tables (right column on a wide screen, under the ways to play on a phone) -->
      <div class="hcard htables"><h3>${T('Open tables')}</h3><div id="hTables"></div></div>
      <div id="hSec"></div>
    </div></section>
  </div><div id="hSheet"></div></div>`;
}
// the section opened with the buttons at the top of the home page (tournaments, our card, players, chat on a phone)
function homeSection(k) {
  if (k === 'tours') return `<div class="hcard"><h3>🏆 ${T('Tournaments')}<button class="btn mini-btn" data-hsec="">✕</button></h3><div id="hTours"></div></div>`;
  if (k === 'conv') return `<div class="hcard"><h3>📋 ${T('Our convention card (with partner)')}<button class="btn mini-btn" data-hsec="">✕</button></h3><div id="hConv"></div></div>`;
  if (k === 'chat') return `<div class="hcard pchat"><h3>💬 ${T('Lobby chat')} <small id="pCount"></small><button class="btn mini-btn" data-hsec="">✕</button><button class="btn mini-btn" id="lClear">🗑</button></h3><div class="lsplit"><div class="lplayers"><div id="pPlayers"></div>${playersFoot()}</div><div class="grip gripc" data-grip="plw" title="${T('Drag to resize')}"></div><div class="lcol"><div class="lmsgs" id="pChat"></div><div class="pmto" id="pPmTo"></div>
    </div></div><div class="composer"><button class="btn rcpt" id="pRcpt" title="${T("Who gets the message")}">🌐 ▾</button><textarea class="cmsg" id="lMsg2" rows="1" maxlength="300" placeholder="${T('Write a message…')}"></textarea><button class="btn sendb" id="lSend2" title="${T("Send")}" aria-label="${T("Send")}">➤</button></div></div>`;
  return '';
}
// our card: every convention with a switch; tap a name for its description
function convCardHtml() {
  // first the base system (your robot partner bids it too), then the conventions within it
  const cur = E.sysOf(SET.sys);
  return `<div class="grp"><span>${T('Base system')}</span><div class="seg sysseg" data-seg="sys">${E.SYSTEMS.map(s => `<button data-v="${s.k}" class="${sysIs(s.k) ? 'on' : ''}">${esc(s.n.replace(/ \(.*\)/, ''))}</button>`).join('')}</div>
    <div class="muted">${SET.sys === 'none' ? T('No base system chosen yet.') : symText(cur.d)}</div></div>
    <div class="grp"><span>${T('Conventions')}</span><div class="convs">${E.CONVS.map(c => `<label class="cvchip${SET.conv[c.k] ? ' on' : ''}" title="${esc(c.d)}"><input type="checkbox" data-conv="${c.k}" ${SET.conv[c.k] ? 'checked' : ''}>${esc(c.n)}</label>`).join('')}</div></div>
    <div class="row2"><button class="btn new" id="convWa">📲 ${T('Send on WhatsApp')}</button><button class="btn sms" id="convSms">${ICON_SMS} SMS</button></div>`;
}
// the convention card as a message: the system and the names of the conventions switched on (no descriptions)
// the message that sends the app to someone
const appInvite = () => 'Bridge https://servetsvm.github.io/bridge/?install=1';
function convCardText() {
  // the app's address, then the conventions that are on
  const on = E.CONVS.filter(c => SET.conv[c.k]);
  return ['https://servetsvm.github.io/bridge', '', `${T('Conventions')}:`, ...on.map(c => `• ${c.n}`)].join('\n');
}
function renderHome() {
  const h = $('home'), N = typeof Net !== 'undefined' ? Net : null;
  if (h.dataset.lang !== SET.lang) { h.dataset.lang = SET.lang; h.innerHTML = homeShell(); }
  document.body.classList.add('homev2');
  const set = (id, html) => { const el = $(id); if (el && el.innerHTML !== html) { el.innerHTML = html; return true; } return false; };
  const cont = ui.saved && ui.saved.phase !== 'done';
  set('hGo', $('hGoSub') ? '▶ ' + T(cont ? 'Continue' : 'Start') : cont ? T('Continue') : '🤖 ' + T('Play offline'));   // the new page names the card "Play offline"; its button starts
  set('hPrac', ui.pracOpen ? pracHtml() : '');   // practise a convention: opened with 📚 Practise conventions
  set('hRobot', rtCardHtml());   // the robots' table, live
  set('hInst', instHtml());
  { const b = $('hNameBtn'), v2 = b && b.classList.contains('h2name'), nm = myNm(), p = typeof Net !== 'undefined' ? Net.prof() : null;
    const h = v2 ? `<span class="h2av">${p && p.av ? p.av : esc(((nm || '?').trim()[0] || '?').toUpperCase())}</span>` : (nm ? esc(nm) : `<i>${T('Name')}</i>`) + ' ✏️';
    if (b && b.innerHTML !== h) b.innerHTML = h; }   // your name (the new page: your picture or initial), after a change on your card
  { const p = typeof Net !== 'undefined' ? Net.prof() : null, m = p && p.rtn ? measuredLvl(p) : '';   // the you strip: rating and the measured level
    set('hMe', p ? `${rankOf(p, myNm())}<span class="h2chip"><small>${T('Rating')}</small><b>${p.rtn ? p.rt : '—'}</b></span>${m ? `<span class="h2chip"><small>${T('measured')}</small><span class="plvl l-${m}">${T(LEVEL_N[m])}</span></span>` : ''}` : ''); }
  set('hGoSub', cont ? T('Your last board is waiting.') : T('Bid and play with three robots; every board counts for your rating.'));   // your name, after a change on your card
  { const hs = $('hSys'), v = SET.sys || 'twoone'; if (hs && hs.value !== v) hs.value = v; }   // also when it was changed on the convention card

  // the daily tournament: your progress and your place so far
  if (N && N.dailyId) {
    const id = N.dailyId(), t = N.st.tours[id];
    if (false && t && t.state !== "off") {   // the daily tournament is no more
      const done = Object.keys(myTour(id)).length, rows = tourRank(id), i = rows.findIndex(r => r.k === N.devId());
      set("hDaily", `🗓 <b>${T("Daily tournament")}</b> · ${done >= t.n ? T("finished") : done ? T("{0} of {1} boards", done, t.n) : T("{0} boards — play now", t.n)}${i >= 0 && rows.length > 1 ? " · " + T("place {0} of {1}", i + 1, rows.length) : rows.length ? " · " + T("{0} players", rows.length) : ""} ›`);
    } else set("hDaily", "");
  }
  { const pzS = pzState(), pzP = pzProg(), wait = pzS.day === 'p' + pzP.i && pzS.ok === false && !pzLive();   // the puzzle: its rating; ⏳ while the next waits
    set("hPuzzle", `${wait ? "⏳" : pzS.day === 'p' + pzP.i && pzS.ok ? "✅" : "🧩"} ${T("Puzzle")}${pzP.t ? " " + Math.round(pzP.r) : ""}`); }

  const per = Store.periods(HIST)[0];
  set("bTheme", document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙");   // day / night at the top
  set('hStats', `${N && N.isAdmin && N.isAdmin() ? `<span class="hadm" data-stats="1" title="${T("Visitor statistics")}">👑 ${T("Logins today")}: ${N.loginsToday()} 📊</span> · ` : ""}${T('Today')}: ${per.n} ${T('boards')}${per.scored ? ' · ' + fmtSigned(per.impSum) + ' IMP' : ''}${per.mpAvg != null ? ' · ' + per.mpAvg + '% MP' : ''}${cont ? ' · ' + T('Your last board is waiting.') : ''}`);
  // the open section is rebuilt only when it changes (so typing in it is not lost); its contents are refreshed
  // the chat opens as a panel at the bottom of the screen (phones and narrow windows); the others under the buttons
  const hs = $('hSec'), want = ui.hsec || '', top = want === 'chat' ? '' : want;
  if (hs && hs.dataset.sec !== top) { hs.dataset.sec = top; hs.innerHTML = homeSection(top); }
  const sh = $('hSheet'), bot = want === 'chat' ? 'chat' : '';
  if (sh && sh.dataset.sec !== bot) { sh.dataset.sec = bot; sh.innerHTML = bot ? homeSection('chat') : ''; }
  document.querySelectorAll('[data-hsec]').forEach(b => b.classList.toggle('on', !!want && b.dataset.hsec === want));
  if (N) {
    // a new message: for the administrator from a player, for a player the administrator's answer
    const sup = N.supNew ? (N.isAdmin() ? `<button class="hcard supnew" id="hSupIn">✉️ ${T('{0} new messages from players', N.supNew)}</button>` : `<button class="hcard supnew" id="hSup">✉️ ${T('The administrator answered you')}</button>`) : '';
    // the database cannot be reached: results, progress and messages are not saved; say why and what to do
    const bad = N.cloudBad && myNm() ? `<div class="hcard cloudbad"><b>⚠ ${T('Cannot reach the server: your results, progress and messages are not saved.')}</b><small>${T('Turn off an ad or privacy blocker for this site, check the internet connection, then reload the page.')}</small></div>` : '';
    const cvn = N.isAdmin() && N.cvNew ? `<button class="hcard supnew" id="hConvReq">📥 ${T('{0} new convention requests', N.cvNew)}</button>` : '';
    // the administrator's card: always on the home page (players, messages, requests, robots)
    const admN = (N.supNew || 0) + (N.cvNew || 0) + (ui.learnNew || 0);
    set('hAdm', N.isAdmin() ? `<button class="hadmb" id="admTog" title="${T('Admin')}">👑${admN ? `<b class="supc">${admN}</b>` : ''}</button>` : '');
    set('hPend', bad + sup + cvn + (N.pendHtml() ? `<div class="hcard">${N.pendHtml()}</div>` : ''));
    set('hTables', (typeof ctCardHtml === 'function' ? ctCardHtml() : '') + N.tablesHtml());
    if (set('hChat', N.lchatHtml())) { const c = $('hChat'); c.scrollTop = c.scrollHeight; }
    if (set('pChat', N.lchatHtml())) { const c = $('pChat'); c.scrollTop = c.scrollHeight; }
    set('hCount', T('{0} in the lobby', N.lobbyCount())); set('pCount', T('{0} in the lobby', N.lobbyCount()));
    { const un = want !== 'chat' ? N.st.lunread || 0 : 0, lb = document.querySelector('.h2lobby');   // the new page: a red count on the Lobby button
      set('hChatN', un ? (lb ? String(un) : '(' + un + ')') : ''); if (lb) lb.classList.toggle('unr', !!un); }
    if (want === 'chat') N.st.lunread = 0;
    set('hTours', toursHtml()); set('nTours', toursHtml()); updateRcpt();
    const pl = N.playersHtml(); set('hPlayers', pl); set('pPlayers', pl);
    const pm = ui.pmTo ? `🔒 ${T('Private message to {0}', esc(ui.pmTo))} <button class="btn mini-btn" data-pmx="1">✕</button>` : '';
    set('hPmTo', pm); set('pPmTo', pm);
    friendsCheck();
  }
  set('hConv', convCardHtml());
}
/* ---- tournaments: the deals come from the tournament's number, so every player and table gets the same boards ---- */
function tourDeal(t, b) {
  E.seed((t.seed ^ Math.imul(b, 2654435761)) >>> 0 || 1);
  const d = E.shuffle([...Array(52).keys()]);
  E.seed(null);
  return [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13));
}
const myTour = id => ((Net.st.tres[id] || {})[Net.devId()] || { ns: {} }).ns;
const tableDone = (id, ti) => ((Net.st.tres[id] || {})['T' + ti + 'NS'] || { ns: {} }).ns;
// individual format: play the next board you have not played yet (or show the ranking when all are done)
function playTour(id) {
  const t = Net.st.tours[id]; if (!t) return;
  if (/^daily-/.test(id) && id !== Net.dailyId()) { showStandings(id); return; }   // an earlier day: only its ranking
  if (t.state !== 'live') { flash(T('This tournament has not started yet'), 2000); return; }
  if (t.format === 'tables') { if (t.joined[Net.devId()]) tableBoard(); return; }
  if (!t.joined[Net.devId()]) Net.tourAnswer(id, true);   // an individual tournament: anyone in the lobby can join it
  // spectators may watch your tournament boards; another player at your table means it is a different game
  if (online() && (guest() || Object.keys(Net.st.seats || {}).length > 1)) { flash(T('Close the online table first'), 2000); return; }
  const done = myTour(id); let b = 1; while (b <= t.n && done[b] != null) b++;
  if (b > t.n) { showStandings(id); return; }
  // the first time you play a tournament you choose your seat; you keep it for all its boards
  const seat = tourSeats()[id] ?? (Object.keys(done).length || /^daily-/.test(id) ? 2 : null);   // boards already played from South keep South; the daily one is played from South
  if (seat == null) { showTourSeat(id); return; }
  ui.saved = null; closeOv();
  newBoard(tourDeal(t, b), b, { id, b, n: t.n, seat });
  Net.shareInfo();   // the lobby sees this table with the tournament on it
  flash(T('Tournament board {0} of {1} — you sit {2}', b, t.n, SEAT[seat]), 2200);
}
const tourSeats = () => { try { return JSON.parse(localStorage.getItem('bridge-tour-seats') || '{}') || {}; } catch (e) { return {}; } };
function showTourSeat(id) {
  const t = Net.st.tours[id]; if (!t) return;
  openOv('tseat', `<h2>🏆 ${esc(t.name)}</h2><div class="big">${T('Where do you sit?')}</div>
    <div class="muted">${T('N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.')}</div>
    <div class="row2">${[0, 1, 2, 3].map(s => `<button class="btn${s === 2 ? ' new' : ''}" data-tsit="${s}" data-tid="${t.id}">${SEAT[s]}</button>`).join('')}</div>
    <div class="row2"><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
// tables format: the table's host deals the next board this table has not played
function tableBoard() {
  const tt = Net.st.tour; if (!tt || !Net.host) return;
  const t = Net.st.tours[tt.id]; if (!t) return;
  const done = tableDone(tt.id, tt.ti); let b = 1; while (b <= t.n && done[b] != null) b++;
  if (b > t.n) { showStandings(tt.id); return; }
  closeOv();
  newBoard(tourDeal(t, b), b, { id: tt.id, b, n: t.n, table: tt.ti });
  Net.note(T('Tournament board {0} of {1}', b, t.n));
}
// the next deal after a board: tournaments go on with their own boards
function nextDeal() { if (G && G.champ) { startChamp(); return; } if (G && G.tour) nextTourBoard(); else if (G && G.tprac) practiceTour(G.tprac.id, G.tprac.b + 1); else if (!(ui.dealQ && nextFileDeal())) newBoard(); }
/* practice a tournament's boards again (yours or one you did not play): nothing is recorded in the tournament;
   after each board your score is compared with everyone who played it there */
function practiceTour(id, b) {
  const t = Net.st.tours[id]; if (!t) return;
  if (b > t.n) { G = idleG(); ui.saved = null; render(); showStandings(id); return; }
  if (online()) { flash(T('Close the online table first'), 2000); return; }
  ui.saved = null; closeOv();
  newBoard(tourDeal(t, b), b);
  G.tprac = { id, b, n: t.n }; save();
  flash('🔁 ' + T('Practice: board {0} of {1}', b, t.n), 2000);
}
// your result on a tournament board against the results of the players who played it in the tournament
function tourCompare(id, b, e) {
  const R = Net.st.tres[id] || {}, me = Net.devId(), ns = sideOf(e.seat) === 0;
  const L = Object.entries(R).filter(([k, r]) => k !== me && !(k[0] === 'T' && r.dir === 'EW') && r.ns && r.ns[b] != null).map(([, r]) => { const v = r.dir === 'EW' ? -r.ns[b] : r.ns[b]; return ns ? v : -v; });
  if (!L.length) return null;
  const c = E.compare(e.us, L); return { imp: c.imp, mp: c.mp, n: L.length };
}
// the ranking: matchpoints between the entries on each board, and cross-IMPs (average over the others).
// At tables, N-S pairs are compared with N-S pairs and E-W pairs with E-W pairs.
function tourRank(id) {
  const t = Net.st.tours[id], R = Net.st.tres[id] || {}, keys = Object.keys(R);
  const rows = keys.map(k => ({ k, name: R[k].name, dir: R[k].dir || '', n: 0, mp: 0, mpMax: 0, imp: 0, pts: 0 }));
  for (let b = 1; b <= t.n; b++) {
    for (const dir of [...new Set(rows.map(r => r.dir))]) {
      const P = rows.filter(r => r.dir === dir && R[r.k].ns[b] != null);
      for (const r of P) {
        r.n++; const me = R[r.k].ns[b]; r.pts += me;
        const others = P.filter(o => o !== r); if (!others.length) continue;
        let imp = 0;
        for (const o of others) { const v = R[o.k].ns[b]; r.mp += me > v ? 2 : me === v ? 1 : 0; r.mpMax += 2; imp += E.imps(me - v); }
        r.imp += imp / others.length;
      }
    }
  }
  rows.forEach(r => { r.pct = r.mpMax ? Math.round(r.mp / r.mpMax * 1000) / 10 : null; r.imp = Math.round(r.imp * 10) / 10; });
  // every board is also played at 10 robot tables: each entry's average IMPs and MP % against them, so there
  // is a ranking even before anyone else has played
  rows.forEach(r => {
    const F = Object.values(R[r.k].f || {});
    r.fn = F.length; r.fImp = F.length ? Math.round(F.reduce((a, x) => a + x[0], 0) / F.length * 100) / 100 : null;
    r.fMp = F.length ? Math.round(F.reduce((a, x) => a + x[1], 0) / F.length * 10) / 10 : null;
  });
  const byImp = tourSort(t) === 'imp', vsOthers = rows.some(r => r.mpMax);
  const field = (a, b) => byImp ? (b.fImp ?? -99) - (a.fImp ?? -99) : (b.fMp ?? -1) - (a.fMp ?? -1);
  return rows.sort((a, b) => (vsOthers ? (byImp ? b.imp - a.imp : (b.pct ?? -1) - (a.pct ?? -1)) || (byImp ? (b.pct ?? -1) - (a.pct ?? -1) : b.imp - a.imp) : 0) || field(a, b) || b.pts - a.pts);
}
// the order of the standings (MP % and IMP are both shown): MP %, or IMP for a tournament set up in IMPs before
function tourSort(t) { return t.scoring === 'imp' ? 'imp' : 'mp'; }
function standingsHtml(id) {
  const t = Net.st.tours[id], me = Net.devId(), rows = tourRank(id);
  if (!rows.length) return `<div class="muted">${T('Nobody has played yet.')}</div>`;
  const dirs = [...new Set(rows.map(r => r.dir))];
  return dirs.map(dir => {
    const L = rows.filter(r => r.dir === dir);
    return `${dir ? `<h3>${dir === 'NS' ? 'N–S' : 'E–W'}</h3>` : ''}<div class="resscroll"><table class="res"><thead><tr><th>#</th><th>${T(t.format === 'tables' ? 'Pair' : 'Player')}</th><th class="n">${T('boards')}</th><th class="n">MP %</th><th class="n">IMP</th><th class="n">${T('Points')}</th><th class="n" title="${T('Against 10 robot tables')}">🤖 IMP</th><th class="n" title="${T('Against 10 robot tables')}">🤖 MP %</th></tr></thead><tbody>${L.map((r, i) => `<tr class="${r.k === me ? 'meRow' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td class="n">${r.n}/${t.n}</td><td class="n">${r.pct ?? '—'}</td><td class="n">${r.mpMax ? fmtSigned(r.imp) : '—'}</td><td class="n">${fmtSigned(r.pts)}</td><td class="n">${r.fImp == null ? '…' : fmtSigned(r.fImp)}</td><td class="n">${r.fMp == null ? '…' : r.fMp}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('');
}
function showStandings(id) {
  const t = Net.st.tours[id]; if (!t) return;
  // boards you played before the robot scores were shared: send them now from your own results
  const mine = (Net.st.tres[id] || {})[Net.devId()];
  for (const e of HIST) if (e.tour && e.tour.id === id && e.tour.table == null && e.imp != null && !(mine && mine.f && mine.f[e.tour.b] && mine.c && mine.c[e.tour.b])) tourSend(e);
  const done = t.format === 'tables' ? 0 : Object.keys(myTour(id)).length;
  openOv('tour', `<h2>🏆 ${esc(t.name)}</h2><div class="muted">${T('{0} boards', t.n)} · ${t.format === 'tables' ? T('{0} tables', t.tables.length) : T('individual')} · ${T('ranked by {0}', tourSort(t) === 'imp' ? 'IMP' : 'MP %')}</div><div class="muted">${Net.tourBy(t)}</div>
    ${t.kind === 'teams' ? teamsHtml(t) : ''}${standingsHtml(id)}<div class="muted">🤖 ${T('= your score against 4 robot tables that played the same boards; it ranks the players until others have played.')}</div>
    ${otherTablesHtml(id)}
    <div class="row2">${t.format !== 'tables' && t.state === 'live' && done < t.n ? `<button class="btn new" data-tplay="${t.id}">${done ? T('Continue') : T('Play')}</button>` : ''}${t.format === 'tables' || done >= t.n ? `<button class="btn" data-tprac="${t.id}">🔁 ${T('Practice these boards')}</button>` : ''}<button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
/* "Other tables": pick a board and see what everyone did on it (contract, result, score, IMPs against the robots);
   your own board opens in the replay */
function otherTablesHtml(id) {
  const t = Net.st.tours[id], R = Net.st.tres[id] || {}, me = Net.devId();
  const played = b => Object.values(R).some(r => r.ns && r.ns[b] != null);
  const bd = ui.tbd && ui.tbd.id === id ? ui.tbd.b : ([...Array(t.n).keys()].map(i => i + 1).find(played) || 1);
  const L = Object.entries(R).filter(([, r]) => r.ns && r.ns[bd] != null).sort((a, b) => b[1].ns[bd] - a[1].ns[bd]);
  const myE = HIST.slice().reverse().find(e => e.tour && e.tour.id === id && e.tour.b === bd);
  const rows = L.map(([k, r]) => `<tr class="${k === me ? 'meRow' : ''}${k === me && myE ? ' rev' : ''}"${k === me && myE ? ` data-rev="${myE.id}"` : ''}><td>${esc(r.name)}${r.dir === 'EW' ? ' <small>E–W</small>' : ''}</td><td>${esc((r.c || {})[bd] || '—')}</td><td class="n">${fmtSigned(r.ns[bd])}</td><td class="n">${r.f && r.f[bd] ? fmtSigned(r.f[bd][0]) : '…'}</td></tr>`).join('');
  return `<div class="grp"><span>${T('Other tables')}</span>
    <div class="seg tbds">${[...Array(t.n).keys()].map(i => i + 1).map(b => `<button data-tbd="${b}" data-tid="${t.id}" class="${b === bd ? 'on' : ''}${played(b) ? '' : ' dim'}">${b}</button>`).join('')}</div>
    ${L.length ? `<div class="resscroll"><table class="res"><thead><tr><th>${T('Player')}</th><th>${T('Contract')}</th><th class="n">${T('Score')}</th><th class="n">🤖 IMP</th></tr></thead><tbody>${rows}</tbody></table></div>${myE ? `<div class="muted">${T('Tap your own row to replay the board.')}</div>` : ''}`
      : `<div class="muted">${T('Nobody has played this board yet.')}</div>`}</div>`;
}
/* the organiser started a tournament you registered for: you are seated at once (as on the big bridge sites).
   Individual: your first board is dealt. At tables: the first player named at your table opens it, the others
   join it as soon as it shows in the lobby. Someone in the middle of a board only gets a notice. */
function tourAutoStart(t) {
  if (!t || t.state !== 'live' || !t.joined[Net.devId()] || Net.isMine(t)) return;
  const busy = online() || (G && (G.phase === 'bid' || G.phase === 'play'));
  if (busy) { flash('🏆 ' + T('{0} has started — open Tournaments to play', t.name), 5000); beep(); return; }
  beep(); flash('🏆 ' + T('{0} has started — you are seated', t.name), 3500);
  if (t.format !== 'tables') { closeOv(); playTour(t.id); return; }
  const s = Net.myTourSeat(t); if (!s) return;
  tourSit(t, s);
}
// sit at your tournament table: open it if you are its first named player, otherwise join it once it is in the
// lobby (tried for about a minute); until then a robot plays your seat
function tourSit(t, s) {
  tourMark(t.id);
  if (s.seat === s.hostSeat) { Net.openTourTable(t.id); return; }
  let tries = 0;
  const tryJoin = () => {
    if (Net.on) return;
    const tb = (Net.st.tables || []).find(x => x.tour && x.tour.id === t.id && x.tour.ti === s.ti);
    if (tb) { Net.joinTourTable(t.id); return; }
    if (tries++ < 12) { Net.findTables(); setTimeout(tryJoin, 5000); }
  };
  setTimeout(tryJoin, 1500);
}
/* back online (the app opened again): if a tournament you play at tables is still running and your table has
   boards left, you go straight back to your seat (a robot played it while you were away) */
// the tournament table you last sat at, and when (a closing sent while this device was off may never arrive)
function tourMark(id) { try { localStorage.setItem('bridge-tour-last', JSON.stringify({ id, ts: Date.now() })); } catch (e) {} }
function tourResume() {
  if (online() || (G && (G.phase === 'bid' || G.phase === 'play'))) return;
  let last = null; try { last = JSON.parse(localStorage.getItem('bridge-tour-last') || 'null'); } catch (e) {}
  if (!last || Date.now() - last.ts > 30 * 60e3) return;   // only straight back: not hours later
  for (const t of Object.values(Net.st.tours)) {
    if (t.state !== 'live' || t.format !== 'tables' || !t.joined[Net.devId()]) continue;
    if (t.id !== last.id || Date.now() > t.ts + (t.hours || 72) * 3600e3) continue;
    const s = Net.myTourSeat(t); if (!s) continue;
    if (Object.keys(tableDone(t.id, s.ti)).length >= t.n) continue;
    flash('🏆 ' + T('Back to your seat in {0}', t.name), 3000);
    tourSit(t, s); return;
  }
}
/* tournament types, as on the big bridge sites: each fills in the options (custom keeps them as they are) */
// every tournament is scored in both MP % and IMP, shown together; IMP pairs is only kept for old tournaments
const TOUR_KINDS = {
  speed: { icon: '⚡', n: 'Speedball', d: 'Individual with robots, 4 boards, 3 hours: a quick tournament.', set: { format: 'ind', n: 4, scoring: 'mp', hours: 3 } },
  robot: { icon: '🤖', n: 'Robot individual', d: 'Everyone plays the same 8 boards with robots, kept for a day.', set: { format: 'ind', n: 8, scoring: 'mp', hours: 24 } },
  daylong: { icon: '🌙', n: 'Daylong', d: '12 boards with robots, play them any time during the day.', set: { format: 'ind', n: 12, scoring: 'imp', hours: 24 } },
  pairs: { icon: '👥', n: 'Pairs', d: 'Pairs at tables: every table plays the same 8 boards; N–S and E–W pairs are scored in both matchpoints and IMPs.', set: { format: 'tables', n: 8, scoring: 'mp', hours: 72, tables: 2 } },
  imppairs: { old: 1, icon: '💼', n: 'IMP pairs', d: 'Pairs at tables, the same 8 boards, ranked by IMPs (cross-IMPs).', set: { format: 'tables', n: 8, scoring: 'imp', hours: 72, tables: 2 } },
  teams: { icon: '🏅', n: 'Team match', d: 'Two teams of four: team A sits N–S at table 1 and E–W at table 2; the same boards are compared table against table in IMPs.', set: { format: 'tables', n: 8, scoring: 'imp', hours: 72, tables: 2 } },
  custom: { icon: '⚙', n: 'Custom', d: 'Choose every option yourself.' },
};
// a team match: table 1 against table 2, board by board, in IMPs (team A = table 1 N–S + table 2 E–W)
function teamsHtml(t) {
  const R = Net.st.tres[t.id] || {}, a = (R.T0NS || {}).ns || {}, b = (R.T1NS || {}).ns || {};
  const row = t.tables[0] || [], row2 = t.tables[1] || [], nm = (x, y) => [x, y].map(n => n || T('Robot')).join(' & ');
  const teamA = nm(row[0], row[2]) + ' · ' + nm(row2[1], row2[3]), teamB = nm(row[1], row[3]) + ' · ' + nm(row2[0], row2[2]);
  let ia = 0, ib = 0;
  const lines = [];
  for (let bd = 1; bd <= t.n; bd++) {
    if (a[bd] == null || b[bd] == null) { lines.push(`<tr><td>${bd}</td><td class="n">${a[bd] ?? '…'}</td><td class="n">${b[bd] ?? '…'}</td><td class="n">—</td><td class="n">—</td></tr>`); continue; }
    const imp = E.imps(a[bd] - b[bd]); if (imp > 0) ia += imp; else ib -= imp;
    lines.push(`<tr><td>${bd}</td><td class="n">${fmtSigned(a[bd])}</td><td class="n">${fmtSigned(b[bd])}</td><td class="n">${imp > 0 ? imp : ''}</td><td class="n">${imp < 0 ? -imp : ''}</td></tr>`);
  }
  return `<div class="teams"><div class="tscore"><div><b>A</b> ${esc(teamA)}</div><div class="tsn">${ia} – ${ib}</div><div><b>B</b> ${esc(teamB)}</div></div>
    <div class="resscroll"><table class="res"><thead><tr><th>${T('Bd')}</th><th class="n">${T('Table {0}', 1)} N–S</th><th class="n">${T('Table {0}', 2)} N–S</th><th class="n">IMP A</th><th class="n">IMP B</th></tr></thead><tbody>${lines.join('')}</tbody></table></div></div>`;
}
// the tournaments you organise, have joined, or are invited to
// tournaments removed from this player's list (with ✕)
function toursHtml() {
  const me = Net.devId();
  const L = Object.values(Net.st.tours).filter(t => t.state !== 'off' && (Net.isMine(t) || t.joined[me] || Net.invitedTo(t) || Net.openTour(t))).sort((a, b) => b.ts - a.ts);
  // a tournament list as on the big bridge sites: tabs, then one row per tournament with its details and actions
  const tab = ui.ttab || 'all';
  const inTab = t => tab === 'all' || (tab === 'reg' && t.state === 'setup') || (tab === 'run' && t.state === 'live') || (tab === 'mine' && (Net.isMine(t) || t.joined[me]));
  const left = t => { const ms = t.ts + t.hours * 3600e3 - Date.now(), h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return ms <= 0 ? '—' : h >= 24 ? T('{0} d {1} h', Math.floor(h / 24), h % 24) : T('{0} h {1} min', h, m); };
  const tabs = `<div class="seg ttabs">${[['all', T('All')], ['reg', T('Registering')], ['run', T('Running')], ['mine', T('Mine')]].map(([v, l]) => `<button data-tlist="${v}" class="${tab === v ? 'on' : ''}">${l} <small>${L.filter(t => v === 'all' || (v === 'reg' && t.state === 'setup') || (v === 'run' && t.state === 'live') || (v === 'mine' && (Net.isMine(t) || t.joined[me]))).length}</small></button>`).join('')}</div>`;
  const rows = L.filter(inTab).map(t => {
    const players = Math.max(Object.keys(t.joined).length, Object.keys(Net.st.tres[t.id] || {}).length);
    const status = t.state === 'setup' ? `<span class="tst reg">${T('Registering')}</span>` : `<span class="tst run">${T('Running')}</span>`;
    const r = tourRowBtns(t, me);
    return `<tr><td data-l=""><b>🏆 ${esc(t.name)}</b>${t.club ? ` <span class="tclub">🏛 ${esc(t.club)}</span>` : ""}<small>${Net.tourBy(t)}</small>${r.note ? `<small class="tnote">${r.note}</small>` : ''}</td>
      <td data-l="${T('Format')}">${TOUR_KINDS[t.kind] && t.kind !== 'custom' ? `${TOUR_KINDS[t.kind].icon} ${T(TOUR_KINDS[t.kind].n)}` : t.format === 'tables' ? T('{0} tables', t.tables.length) : T('individual')}</td><td data-l="${T('Boards')}" class="n">${t.n}</td><td data-l="${T('Ranking')}">${t.kind === 'teams' ? 'IMP' : 'MP % · IMP'}</td>
      <td data-l="${T('Players')}" class="n">${players}</td><td data-l="${T('Status')}">${status}</td><td data-l="${T('Ends in')}">${left(t)}</td>
      <td data-l="" class="tact">${r.btns}${Net.isMine(t) || Net.isAdmin() ? `<button class="btn tdel" data-tdel="${t.id}" title="${T('Cancel the tournament')}">✕</button>` : ''}</td></tr>`;
  }).join('');
  const table = rows ? `<div class="ttwrap"><table class="ttab"><thead><tr><th>${T('Tournament')}</th><th>${T('Format')}</th><th class="n">${T('Boards')}</th><th>${T('Ranking')}</th><th class="n">${T('Players')}</th><th>${T('Status')}</th><th>${T('Ends in')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="muted">${L.length ? T('No tournaments here.') : T('No tournaments yet. Create one and invite the players you want.')}</div>`;
  // the online tournaments (shown in the online table window; Clubs on the home page opens the club tournaments)
  return `${tabs}${table}<div class="row2 tnew"><button class="btn gold" id="tNew">➕ ${T('New tournament')}</button></div>`;
}
// the action buttons of one tournament row (and a short note: an invitation, your table, how far you are)
function tourRowBtns(t, me) {
  const r = { btns: '', note: '' };
  if (t.state === 'setup') {
    r.btns = Net.isMine(t) ? `<button class="btn gold" data-tset="${t.id}">${T('Players and start')}</button>`
      : Net.invitedTo(t) ? `<button class="btn new" data-tyes="${t.id}">${T('Accept')}</button><button class="btn" data-tno="${t.id}">${T('Decline')}</button>`
      : Net.openTour(t) && !t.joined[me] ? `<button class="btn new" data-tyes="${t.id}">${T('Register')}</button>`
      : `<span class="muted">${T('Waiting for {0} to start', esc(t.by))}</span>`;
    if (Net.invitedTo(t)) r.note = `<b class="inv">${T('{0} invites you', esc(t.by))}</b>`;
  } else if (t.format === 'tables') {
    const seat = Net.myTourSeat(t), done = seat ? Object.keys(tableDone(t.id, seat.ti)).length : 0;
    if (seat) r.note = `${T('table {0}, you sit {1}', seat.ti + 1, SEAT[seat.seat])} · ${done}/${t.n}`;
    r.btns = (seat && done < t.n ? (seat.host && seat.seat === seat.hostSeat ? `<button class="btn new" data-ttab="${t.id}">${T('Open table {0}', seat.ti + 1)}</button>` : `<button class="btn new" data-tjtab="${t.id}">${T('Join table {0}', seat.ti + 1)}</button>`) : '') + `<button class="btn" data-tstand="${t.id}">${T('Standings')}</button>`;
  } else {
    const done = Object.keys(myTour(t.id)).length;
    if (t.joined[me]) r.note = T('you: {0}/{1}', done, t.n);
    r.btns = `${done < t.n ? `<button class="btn new" data-tplay="${t.id}">${done ? T('Continue') : t.joined[me] ? T('Play') : T('Register')}</button>` : ''}<button class="btn" data-tstand="${t.id}">${T('Standings')}</button>`;
  }
  return r;
}
/* the organiser's set-up: name, number of boards, format (individual, or tables with the players' seats named
   in advance), ranking, how long it is kept, and the players; then the invitations and Start */
function showTourSetup(id) {
  const t = Net.st.tours[id]; if (!t || !Net.isMine(t)) return;
  if (ui.overlay === 'tsetup' && ui.tsetId === id) readTourSeats();   // keep what was typed when the screen is redrawn
  if (ui.tsetId !== id) ui.tsetMsg = null;
  ui.tsetId = id;
  const sel = ui.tsel && ui.tsel.id === id ? ui.tsel : (ui.tsel = { id, names: new Set(t.inv) });
  const known = [...new Set([...Net.knownNames(), ...sel.names])];
  const st = n => {
    const lk = String(n).toLowerCase();
    return Object.values(t.joined).some(v => v.toLowerCase() === lk) ? '<span class="ok">✓</span>' : Object.values(t.declined).some(v => v.toLowerCase() === lk) ? '<span class="no">✗</span>' : t.inv.some(x => x.toLowerCase() === lk) ? '<span class="wait">…</span>' : '';
  };
  const opt = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tables = t.format === 'tables' ? (t.tables.length ? t.tables : [['', '', '', '']]) : [];
  const seatGrid = tables.map((row, ti) => `<div class="tsetrow"><b>${T('Table {0}', ti + 1)}</b>${[0, 1, 2, 3].map(s => `<label><small>${SEAT[s]}</small><input class="tok" list="tNames" maxlength="20" data-tseat="${ti}:${s}" value="${esc(row[s])}" placeholder="${T('Robot')}">${row[s] ? st(row[s]) : ''}</label>`).join('')}</div>`).join('');
  const accepted = Object.keys(t.joined).length - 1;
  const kind = TOUR_KINDS[t.kind] ? t.kind : 'custom';
  const team = ui.tsetTeam === id && t.kind === 'teams';   // opened as a team match: no types, no format, two tables
  openOv('tsetup', `<h2>${team ? '🏅 ' + T('Team match') : '🏆 ' + T('New tournament')}</h2>
    ${team ? `<div class="muted">${T(TOUR_KINDS.teams.d)}</div>` : `<div class="grp"><span>${T('Type')}</span><div class="seg tkinds" data-seg="tkind">${Object.keys(TOUR_KINDS).filter(k => !TOUR_KINDS[k].old || k === kind).map(k => `<button data-v="${k}" class="${kind === k ? 'on' : ''}">${TOUR_KINDS[k].icon} ${T(TOUR_KINDS[k].n)}</button>`).join('')}</div>
      <div class="muted">${T(TOUR_KINDS[kind].d)}</div></div>`}
    <div class="grp"><span>${T('Tournament name')}</span><input class="tok wide" id="tName" maxlength="40" value="${esc(t.name)}"></div>
    <div class="grp"><span>${T('Boards')}</span>${opt('tn', [4, 6, 8, 10, 12, 16, 20, 24].map(n => [n, n]), t.n)}</div>
    ${team ? '' : `<div class="grp"><span>${T('Format')}</span>${opt('tformat', [['ind', '👤 ' + T('individual')], ['tables', '🃏 ' + T('at tables')]], t.format)}
      <div class="muted">${t.format === 'tables' ? T('Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.') : T('Everyone plays the same deals at their own table, sitting South.')}</div></div>`}
    ${t.format === 'tables' ? `<div class="grp"><span>${T('Tables')}</span>${team ? '' : opt('ttables', [1, 2, 3, 4, 5, 6].map(n => [n, n]), tables.length)}<datalist id="tNames">${known.map(n => `<option value="${esc(n)}">`).join('')}</datalist>${seatGrid}</div>`
      : `<div class="grp"><span>${T('Players to invite')}</span>
      <div class="invlist">${known.length ? known.map(n => `<label class="invrow"><input type="checkbox" data-tinv="${esc(n)}" ${sel.names.has(n) ? 'checked' : ''}><b>${esc(n)}</b>${st(n)}</label>`).join('') : `<div class="muted">${T('Nobody else is in the lobby right now — type a name below.')}</div>`}</div>
      <div class="row2"><input class="tok" id="tAdd" maxlength="20" placeholder="${T('Add a player by name')}"><button class="btn" id="tAddBtn">${T('Add')}</button></div></div>`}
    ${SET.club && t.format !== 'tables' ? `<div class="grp"><span>${T('Who can play')}</span>${opt('tclub', [['', '🌍 ' + T('Everyone')], ['club', '🏛 ' + esc(SET.club)]], t.club ? 'club' : '')}<div class="muted">${T('A club tournament is shown only to the players who wrote the same club on their card.')}</div></div>` : ''}
    <div class="grp"><span>${T('Keep the tournament for')}</span>${opt('thours', [[3, T('{0} hours', 3)], [24, T('1 day')], [72, T('3 days')]], t.hours)}</div>
    <div class="grp"><span>${T('Answers')}</span><div>${esc(t.by)} <span class="ok">✓ ${T('organiser')}</span>${Object.values(t.joined).filter(n => n !== t.by).map(n => ` · ${esc(n)} <span class="ok">✓</span>`).join('')}${Object.values(t.declined).map(n => ` · ${esc(n)} <span class="no">✗</span>`).join('')}</div></div>
    ${ui.tsetMsg ? `<div class="${ui.tsetMsg.no ? 'no' : 'okmsg'}">${esc(ui.tsetMsg.txt)}</div>` : ''}
    <div class="row2"><button class="btn gold" id="tSend">${T('Send the invitations')}</button><button class="btn new" id="tGo">${T('Start the tournament')}</button></div>
    <div class="row2"><button class="btn" id="tCancel">${T('Cancel the tournament')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// read the seat names typed in the set-up into the tournament (organiser only)
function readTourSeats() {
  const t = Net.st.tours[ui.tsetId]; if (!t) return;
  document.querySelectorAll('[data-tseat]').forEach(i => { const [ti, s] = i.dataset.tseat.split(':').map(Number); if (t.tables[ti]) t.tables[ti][s] = i.value.trim().slice(0, 20); });
  const nm = $('tName'); if (nm && nm.value.trim()) t.name = nm.value.trim().slice(0, 40);
}
// a player's card: tap a name in the lobby to see their system and rating (your own Results stay on your device)
function showPlayer(name) {
  if (!CH.tree && typeof Net !== 'undefined' && Net.Cloud.on) champLoad().then(() => { if (ui.overlay === 'player' && CH.tree) showPlayer(name); });
  const me = name === T('You') || name.trim().toLowerCase() === (myNm() || '').trim().toLowerCase();
  const p = me ? Net.prof() : Net.profOf(name);
  const shown = me ? (myNm() || T('You')) : name, lvl = p && p.lvl, ctry = p && p.ctry;
  const w = me ? null : Net.whereIs(name);
  const where = me ? '' : Net.statusOf ? (Net.statusOf(name) || {}).at || '' : !w ? '' : w.lobby ? T('In the lobby') : w.online ? T("At {0}'s table", w.host) : T('playing with robots');
  // all-time results only: boards, IMPs per board, MP %
  const tot = p && p.per ? p.per[4] : p ? [p.n, p.imp, p.mp] : null;
  const boards = tot ? tot[0] || 0 : 0;
  const fields = [
    [T('Rank card'), rankBig(p, shown)],
    [T("Rating"), p && p.rtn ? `<b class="prt">${p.rt}</b> <small>(${p.rtn} ${T("boards")})</small>` : "—"],
    [T('Puzzle'), p && p.pz && p.pz.t ? `🧩 <b>${p.pz.r}</b> · ${T(LEVEL_N[pzLvl(p.pz.r)])} · ${T('{0} of {1} solved', p.pz.s, p.pz.t)}` : '—'],
    [T('Club'), p && p.club ? `🏛 ${esc(p.club)}` : '—'],
    [T('Skill level'), lvlHtml(lvl, p)],
    [T('Joined'), p && p.joined ? esc(p.joined) : '—'],
    [T('Logins'), p && p.logins ? loginsTxt(p.logins) : '—'],
    [T('Title'), `<b>${T(titleOf(boards))}</b>`],
  ];
  const conv = p ? convLine(p) : '';
  // your own card: change what the others see (name, system, level, country; the conventions on the card itself)
  const edit = me ? `<div class="pedit"><div class="pedh">✏️ ${T('Edit my card')}</div>
      <label><span>${T('Name')}</span><button id="pRename" class="tok prename">${esc(myNm())} ✏️</button></label>
      <label><span>${T('System')}</span><select id="pSys" class="sel">${SET.sys === 'none' ? '<option value="none" selected>—</option>' : ''}${E.SYSTEMS.map(s => `<option value="${s.k}" ${(SET.sys || 'twoone') === s.k ? 'selected' : ''}>${esc(({ twoone: '2/1 GF', sayc: 'SAYC', acol: 'Acol', sef: 'SEF', precision: 'Precision', polish: 'Polish Club' })[s.k] || s.n)}</option>`).join('')}</select></label>
      <label><span>${T('Level')}</span><select id="pLvl" class="sel"><option value="">${T('Not set')}</option>${LEVELS.map(l => `<option value="${l}" ${SET.lvl === l ? 'selected' : ''}>${T(LEVEL_N[l])}</option>`).join('')}</select></label>
      <label><span>${T('Country')}</span><select id="pCtry" class="sel"><option value="">${T('Not set')}</option>${COUNTRIES.map(c => [c, ctryName(c)]).sort((x, y) => x[1].localeCompare(y[1])).map(([c, n]) => `<option value="${c}" ${SET.ctry === c ? 'selected' : ''}>${flagOf(c)} ${esc(n)}</option>`).join('')}</select></label>
      <label><span>${T('Club')}</span><input id="pClub" class="tok" maxlength="24" value="${esc(SET.club || '')}" placeholder="${T('Your bridge club (optional)')}"></label>
      <div class="pavpick"><span>${T("Picture")}</span><div>${["", ...Net.AVATARS].map(a => `<button class="${(SET.av || "") === a ? "on" : ""}" data-av="${a}">${a || "Aa"}</button>`).join("")}</div></div>
      <button class="btn pconvb" data-hsec="conv">📋 ${T('Convention card')}</button></div>` : '';
  openOv('player', `<div class="pcard">
    <div class="phead"><div class="pav${p && p.av ? " emo" : ""}">${p && p.av ? p.av : esc((shown.trim()[0] || "?").toUpperCase())}</div>
      <div class="pmain"><div class="pnm${champMark(shown) ? ' champgold' : ''}">${esc(shown)}${champMark(shown)} ${rankOf(p, shown)}${ctry ? ` <span class="pctry">${flagOf(ctry)} ${esc(ctryName(ctry))}</span>` : ''}${!me && isFriend(name) ? ' <span class="pstar">★</span>' : ''}</div>
        <div class="psub">${where ? `<span class="pwhere">● ${esc(where)}</span>` : ''}</div></div></div>
    <table class="pfields">${fields.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
    ${trophyHtml(shown)}
    ${me ? `<textarea id="pCline" class="tok pconv pclin" maxlength="300" rows="3" placeholder="${T('Your conventions, e.g. 2/1, 5-card majors, 1NT 15-17, RKCB 1430, Stayman…')}">${esc(SET.cline || (p ? convLine({ ...p, cline: '' }) : ''))}</textarea>` : conv ? `<div class="pconv">${conv}</div>` : ''}
    ${edit}
    ${tot ? `<table class="res ptot"><thead><tr><th></th><th class="n">${T('boards')}</th><th class="n">${T('IMP / board')}</th><th class="n">MP %</th></tr></thead><tbody><tr><td>${T('Total')}</td><td class="n">${boards}</td><td class="n">${tot[1] == null ? '—' : fmtSigned(tot[1])}</td><td class="n">${tot[2] == null ? '—' : tot[2] + '%'}</td></tr></tbody></table>`
      : `<div class="muted">${T('No rating yet — it shows once this player has played (with the new version).')}</div>`}
    </div>
    <div class="row2">${me ? '' : `<button class="btn gold" data-dm="${esc(name)}">💬 ${T('Message')}</button><button class="btn new" data-pairwith="${esc(name)}">🤝 ${T('Play as partners')}</button><button class="btn" data-friend="${esc(name)}">${isFriend(name) ? '★ ' + T('Friend') : '☆ ' + T('Add as friend')}</button>${Net.isAdmin && Net.isAdmin() ? `<button class="btn" data-akick="${esc(name)}">⛔ ${T('Out of the lobby')}</button>` : ''}`}<button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// how many times the app was opened, rounded the way profiles show it (5000+, 1000+, 500+ …)
function loginsTxt(n) { for (const s of [10000, 5000, 1000, 500, 100, 50]) if (n >= s) return s + '+'; return String(n); }
// a title from the boards played
function titleOf(n) { return n >= 5000 ? 'Grandmaster' : n >= 2000 ? 'Master' : n >= 500 ? 'Strategist' : n >= 100 ? 'Player' : 'Newcomer'; }
// the convention card in one line: system, notrump range and the conventions switched on (short names)
const CONV_SHORT = { rkc: 'RKCB 1430', rkc0314: 'RKCB 0314', gerber: 'Gerber', bergen: 'Bergen', capp: 'Capp', j2nt: 'Jacoby 2NT', wjs: 'WJS', stayman: 'Stayman', puppet: 'Puppet Stayman', fourWay: '4-way transfers', minorTr: 'Minor Transfer', smolen: 'Smolen', michaels: 'Michaels', splinter: 'Splinter', texas: 'Texas', texasInt: 'Texas over interference', leb: 'Lebensohl', lav: 'Lavinthal', roman: 'Roman discards', invMin: 'Inverted minors', drury: 'Drury', nmf: 'NMF', fsf: '4th suit forcing', ogust: 'Ogust', supx: 'Support X', respx: 'Responsive X', sjs: 'Strong jump shifts', dont: 'DONT', gamb: 'Gambling 3NT' };
function convLine(p) {
  if (p.cline && p.cline.trim()) return esc(p.cline.trim());   // the player wrote it themselves
  const y = p.sys && p.sys !== 'none' ? E.sysOf(p.sys) : null;
  const head = y ? [{ twoone: '2/1', sayc: 'SAYC', acol: 'Acol', sef: 'SEF', precision: 'Precision', polish: 'Polish Club' }[y.k] || y.k, y.maj5 ? '5-card majors' : '4-card majors', '1NT ' + y.nt[0] + '-' + y.nt[1]] : [];
  const on = p.conv ? Object.keys(CONV_SHORT).filter(k => p.conv[k]).map(k => CONV_SHORT[k]) : [];
  return esc([...head, ...on].join(', '));
}
// the player card's level and country lists
const LEVELS = ['beg', 'int', 'adv', 'exp', 'wc'];
/* the measured level: from the rating (1500 = as good as the robot tables; about 136 points per IMP a board over 200
   boards), from the first scored board */
const MEASURE_MIN = 1;   // from the first scored board
const measuredLvl = p => !p || !(p.rtn >= MEASURE_MIN) || !p.rt ? '' : p.rt < 1400 ? 'beg' : p.rt < 1500 ? 'int' : p.rt < 1580 ? 'adv' : p.rt < 1680 ? 'exp' : 'wc';
// the player card's line: "Expert (own choice) · measured: Intermediate"
function lvlHtml(lvl, p) {
  const chip = l => `<span class="plvl l-${l}">${T(LEVEL_N[l])}</span>`, m = measuredLvl(p);
  const own = lvl ? `${chip(lvl)} <small>(${T('own choice')})</small>` : '—';
  const meas = m ? ` · <small>${T('measured')}:</small> ${chip(m)}` : p && p.rtn ? ` · <small class="muted">${T('measured after {0} boards ({1} so far)', MEASURE_MIN, p.rtn)}</small>` : '';
  return `<span title="${T('Measured from the rating: the last 200 boards against the robot tables.')}">${own}${meas}</span>`;
}
const LEVEL_N = { beg: 'Beginner', int: 'Intermediate', adv: 'Advanced', exp: 'Expert', wc: 'World class' };
const COUNTRIES = ['TR', 'NO', 'SE', 'DK', 'FI', 'IS', 'GB', 'IE', 'FR', 'DE', 'NL', 'BE', 'LU', 'CH', 'AT', 'IT', 'ES', 'PT', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'CY', 'HR', 'SI', 'RS', 'BA', 'UA', 'RU', 'EE', 'LV', 'LT', 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CN', 'TW', 'HK', 'JP', 'KR', 'IN', 'ID', 'PK', 'AU', 'NZ', 'ZA', 'EG', 'IL', 'MA', 'AZ', 'GE', 'KZ'];
const flagOf = c => /^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map(x => 127397 + x.charCodeAt(0))) : '';
function ctryName(c) { try { return new Intl.DisplayNames([SET.lang || 'en'], { type: 'region' }).of(c) || c; } catch (e) { return c; } }
/* friends: ★ on a player's card; friends come first in the lobby list and you hear when one arrives */
const friends = () => { try { return JSON.parse(localStorage.getItem('bridge-friends') || '[]') || []; } catch (e) { return []; } };
const isFriend = n => friends().some(f => f.toLowerCase() === String(n).trim().toLowerCase());
function toggleFriend(n) {
  const L = friends().filter(f => f.toLowerCase() !== n.trim().toLowerCase());
  if (!isFriend(n)) L.push(n.trim().slice(0, 20));
  try { localStorage.setItem('bridge-friends', JSON.stringify(L.slice(-100))); } catch (e) {}
}
// the players at a table in the lobby right now (from the tables' information)
function lobbyNow() {
  const s = new Set();
  for (const t of (Net.st.tables || [])) for (const n of [t.host, ...Object.values(t.names || {})]) if (n) s.add(n.trim().toLowerCase());
  return s;
}
function friendsCheck() {
  const now = lobbyNow(), seen = ui.friendsHere || (ui.friendsHere = new Set());
  for (const f of friends()) {
    const k = f.toLowerCase();
    if (now.has(k) && !seen.has(k)) { seen.add(k); setTimeout(() => flash('★ ' + T('{0} is in the lobby', f), 3000), 0); }
    else if (!now.has(k)) seen.delete(k);
  }
}
// a private conversation with one player in the lobby
function showDm(name) {
  ui.dmWith = name; Net.st.dmUnread[name.trim().toLowerCase()] = 0;
  for (const k in Net.st.dmUnread) if (Net.st.dms[k] && Net.st.dms[k].name === name) Net.st.dmUnread[k] = 0;
  const conv = Object.values(Net.st.dms).find(c => c.name.toLowerCase() === name.toLowerCase());
  const t = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const list = conv && conv.list.length ? conv.list.map(m => `<div class="cm${m.me ? ' me' : ''}"><b>${esc(m.from)}</b> ${esc(m.text)}<small>${t(m.ts)}${m.me && m.id ? (m.ok ? ' ✓' : ' ⏳') : ''}</small></div>`).join('') : `<div class="muted">${T('Write a private message to {0}.', esc(name))}</div>`;
  const draft = $('dmMsg') ? $('dmMsg').value : '';
  openOv('dm', `<h2>✉ ${esc(name)}</h2><div class="lmsgs pop" id="dmList">${list}</div>
    <div class="row2"><input class="tok" id="dmMsg" maxlength="300" placeholder="${T('Write a message…')}" value="${esc(draft)}"><button class="btn sendb" id="dmSend" title="${T("Send")}" aria-label="${T("Send")}">➤</button></div>
    <div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`);
  const L = $('dmList'); if (L) L.scrollTop = L.scrollHeight;
  const i = $('dmMsg'); if (i) i.focus();
}
// lobby chat as a pop-up window (on phones the chat column is hidden)
function showLChat() {
  Net.st.lunread = 0;
  const draft = $('lMsg2') ? $('lMsg2').value : '';
  openOv('lchat', `<h2>💬 ${T('Lobby chat')} <small class="muted">${T('{0} in the lobby', Net.lobbyCount())}</small></h2><div class="lmsgs pop" id="ovLChat">${Net.lchatHtml()}</div>
    <div class="row2"><input class="tok" id="lMsg2" maxlength="200" placeholder="${T('Write a message…')}" value="${esc(draft)}"><button class="btn sendb" id="lSend2" title="${T("Send")}" aria-label="${T("Send")}">➤</button></div>
    <div class="row2"><button class="btn" id="lClear">🗑 ${T('Clear the chat')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
  const c = $('ovLChat'); if (c) c.scrollTop = c.scrollHeight;
  if (document.activeElement !== $('lMsg2') && draft) $('lMsg2').focus();
}
// after a tournament board: the next one, or the ranking when you have played them all
function nextTourBoard() {
  const id = G.tour.id, t = Net.st.tours[id];
  if (G.tour.table != null) { const left = t ? t.n - Object.keys(tableDone(id, G.tour.table)).length : 0; if (left > 0) tableBoard(); else { G = lobbyG(); render(); showStandings(id); } return; }
  const left = t ? t.n - Object.keys(myTour(id)).length : 0;
  if (left > 0) playTour(id); else { const s = G; G = idleG(); ui.saved = null; render(); showStandings(id); if (s) save(); }
}
// opening an online table always asks first: public (listed in the lobby) or private (only invited players)
function showOpenChoice() {
  if (online()) { Net.panel(); return; }
  openOv('open', `<h2>🌐 ${T('Open an online table')}</h2>
    <button class="btn new choice" data-open="pub"><b>🌍 ${T('Open table')}</b></button>
    <button class="btn choice" data-open="priv"><b>🔒 ${T('Private table')}</b></button>
    <button class="btn choice" id="olTeam"><b>🏅 ${T('Team match')}</b></button>
    <div class="row2"><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
// back to the home page from a board played alone (the board is kept for Continue)
function goHome() {
  if (G && G.ct) { ctLeave(); G = idleG(); closeOv(); save(); render(); return; }   // a club table goes on without you (the card brings you back)
  if (online()) { flash(T('Online') + ' ●', 1200); Net.panel(); return; }
  // an unfinished board is kept: "Play with robots" carries on from where it was
  clearTimeout(timer); ui.saved = G && !G.rtv && (G.phase === 'bid' || G.phase === 'play') ? G : G && G.rtv ? ui.saved : null;
  G = idleG(); closeOv(); save(); render();
  if (typeof Net !== "undefined" && Net.shareInfo) Net.shareInfo();   // the lobby sees you are back on the home page
}

/* ================= overlays ================= */
function suitLine(cards, s) { const cs = E.desc(E.inSuit(cards, s)); return `${symHtml(s)} ${cs.length ? cs.map(c => RTXT[R(c)]).join(' ') : '—'}`; }
function dealHtml(deal, u) {
  const pos = ['s', 'w', 'n', 'e'];
  return '<div class="deal">' + [0, 1, 2, 3].map(seat => { const r = (seat - u + 4) % 4; return `<div class="h ${pos[r]}"><b>${SEAT[seat]}${seat === u ? ' (' + T('you') + ')' : ''} · ${ev(deal[seat]).hcp} HCP</b>${ORDER.map(s => suitLine(deal[seat], s)).join('<br>')}</div>`; }).join('') + '</div>';
}
function resultLine(e) {
  if (e.passed) return T('Passed out');
  const c = e.c, d = e.tricks - (c.level + 6);
  return `${conKey(c)} · ${T('{0} tricks', e.tricks)} (${d >= 0 ? (d ? '+' + d : '=') : d}) · <span class="${e.us >= 0 ? 'pos' : 'neg'}">${fmtSigned(e.us)}</span>`;
}
function openOv(name, html) {
  if (ui.overlay === "gate" && name !== "gate" && needGate()) return;
  // the end of a board (or a board in Results) drawn again while you type in it (a robot mistake): it waits until you
  // leave the box, so the page does not jump under your fingers on a phone
  const ae = document.activeElement;
  if ((name === 'end' || name === 'rev') && ui.overlay === name && ae && $('ov').contains(ae) && ae.tagName === 'TEXTAREA') {
    ui.ovLater = [name, html];
    let off = 0;
    if (!ui.ovWait) ui.ovWait = setInterval(() => {   // drawn once the box has been left for a moment (a tap on Send goes through first)
      if (document.activeElement === ae && ae.isConnected) { off = 0; return; }
      if (++off < 2) return;
      clearInterval(ui.ovWait); ui.ovWait = null; const l = ui.ovLater; ui.ovLater = null; if (l && ui.overlay === l[0]) openOv(l[0], l[1]);
    }, 400);
    return;
  }
  // during a game on a wider screen, a player card or a private chat is a small window you can drag aside (the table stays usable)
  const fl = ["player", "dm", "net", "lead"].includes(name) && G && G.phase !== "idle" && innerWidth >= 700, ov = $("ov");
  const keep = ui.overlay === name && ov.firstChild ? [ov.firstChild.scrollTop, ov.scrollTop] : null;   // the same window again: it stays where it was
  const typed = keep ? [...ov.querySelectorAll('textarea[id],input[id]:not([type=checkbox]):not([type=radio]):not([type=file])')].map(x => [x.id, x.value, document.activeElement === x ? [x.selectionStart, x.selectionEnd] : null]) : [];
  ui.overlay = name; ov.classList.toggle("float", fl);
  const bar = fl || (name !== "gate" && innerWidth >= 900 && matchMedia("(pointer:fine)").matches);   // on a computer every window can be dragged by its top bar
  ov.innerHTML = `<div class="sheet${fl ? " fsheet" : ""}${["end", "res", "rev", "set", "hist", "tour", "tsetup", "deal", "help", "auc", "sb"].includes(name) ? " wide" : ""}" data-ov="${name}">${bar ? `<div class="fbar" title="${T("Drag to move")}"><span>⠿</span><button class="btn mini-btn" id="oClose">✕</button></div>` : ""}${html}</div>`;
  ov.hidden = false;
  if (keep) { ov.firstChild.scrollTop = keep[0]; ov.scrollTop = keep[1]; }
  for (const [id, v, sel] of typed) { const x = document.getElementById(id); if (!x || !ov.contains(x)) continue; if (v && !x.value) x.value = v; if (sel) { x.focus({ preventScroll: true }); try { x.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  if (fl && typeof SIZES !== "undefined" && SIZES.fw2) { const s = ov.firstChild; s.style.width = SIZES.fw2 + "px"; s.style.height = SIZES.fh2 + "px"; }
  if (fl && ui.fpos) { const s = ov.firstChild; s.style.left = ui.fpos.x + "px"; s.style.top = ui.fpos.y + "px"; s.style.right = "auto"; }
}
function closeOv() { if (ui.overlay === "gate" && needGate()) return;   // no way past the name and PIN
  if (typeof SB !== "undefined" && SB.locked()) return;   // social bridge: a score waits for the other pair's confirmation
  if (ui.overlay === 'deal') { ui.photoHands = null; ui.photoMsg = null; } if (ui.overlay === 'rev' || ui.overlay === 'frev') stopRev(); ui.overlay = null; $('ov').hidden = true; $('ov').classList.remove('float'); }
/* ---- the problem of the day: the same deal and question for everyone each day (from the date), in turn
   "what do you open?", "partner opened: what do you answer?" and "what do you lead?". The answer is the robot's call
   (with its meaning), or for a lead the cards that give the defence the most tricks (double dummy). ---- */
function pzState() { const PZ_KEY = 'bridge-puzzle'; try { return JSON.parse(localStorage.getItem(PZ_KEY) || '{}') || {}; } catch (e) { return {}; } }
function pzSave(s) { const PZ_KEY = 'bridge-puzzle'; try { localStorage.setItem(PZ_KEY, JSON.stringify(s)); } catch (e) {} }
// the bank of leads that alone beat the contract, double dummy (.github/puzzles/make.js): one for each day from PZB_FROM
const PZB_FROM = '2026-11-10';
let PZB;   // undefined: not read yet; null: could not be read (the generated problems are used)
// the declarer problems (.github/puzzles/makeplay.js): one for each day from PZP_FROM, in place of the leads
const PZP_FROM = '2026-11-12';
let PZP;
const pzWait = () => PZB === undefined || PZP === undefined;
/* the puzzles one after another (not one a day): solved, the next comes at once; failed, the next comes 24 hours after
   the try. Each answer moves the puzzle rating (start 1200) and with it the puzzle level; kept on the player's card. */
const PZ_HOLD = 864e5;
const pzLive = () => !!(G && G.pz && G.pz.first && G.phase === 'play') || !!(ui.saved && ui.saved.pz && ui.saved.pz.first && ui.saved.phase === 'play');   // the first try is being played now (or waits, kept, to be continued)
const pzProg = () => ({ r: 1200, s: 0, t: 0, i: 0, st: 0, ...(SET.pz || {}) });
function pzProgSave(p) { SET.pz = { r: Math.round(p.r), s: p.s, t: p.t, i: p.i, st: p.st }; Store.saveSettings(SET); save(); scheduleSync(); if (typeof Net !== 'undefined' && Net.shareInfo) Net.shareInfo(); }
const pzLvl = r => r < 1100 ? 'beg' : r < 1300 ? 'int' : r < 1500 ? 'adv' : r < 1700 ? 'exp' : 'wc';
// the puzzle that is up now (its number); a failed one past its 24 hours gives way to the next
function pzIdx() {
  const p = pzProg(), s = pzState();
  if (s.day === 'p' + p.i && s.ok === false && Date.now() - (s.at || 0) >= PZ_HOLD) { p.i++; pzProgSave(p); pzSave({}); ui.pz = null; }
  return p.i;
}
// the rating, the level, how many solved; then Next puzzle (solved) or how long until the next (failed)
function pzProgHtml(done) {
  const p = pzProg(), s = pzState();
  let nx = '';
  if (done && s.ok) nx = `<button class="btn new pznext" id="pzNext">▶ ${T('Next puzzle')}</button>`;
  else if (done && s.ok === false && !pzLive()) { const mn = Math.ceil(Math.max(0, (s.at || 0) + PZ_HOLD - Date.now()) / 6e4), h = Math.floor(mn / 60), m = mn % 60; nx = `<div class="pzwait">⏳ ${T('New puzzle in {0}', h + ':' + String(m).padStart(2, '0'))}</div>`; }
  return `<div class="pzprog">🧩 ${T('Puzzle rating')} <b>${Math.round(p.r)}</b> · ${T(LEVEL_N[pzLvl(p.r)])} · ${T('{0} of {1} solved', p.s, p.t)}${p.st ? ' · 🔥 ' + p.st : ''}</div>${nx}`;
}
function pzLoad() { if (ui.pzLoading) return; ui.pzLoading = 1; const get = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null); Promise.all([get('js/puzzles.json'), get('js/puzzles-play.json')]).then(([j, k]) => { PZB = j && j.length ? j : null; PZP = k && k.length ? k : null; ui.pzLoading = 0; ui.pz = null; showPuzzle(); }); }
function pzBank(n) {
  const e = PZB[n % PZB.length], cfg = { conv: { ...E.sysOf('twoone').conv }, agg: 0, sys: 'twoone' }, cards = [cfg, cfg], auction = [];
  e.a.forEach((call, i) => { const seat = (e.l + i) % 4; auction.push({ seat, call, m: E.explainCall(auction, seat, call, cards) }); });
  return { kind: 'lead', deal: e.d, dealer: e.l, auction, c: { level: e.c[0], strain: e.c[1], dbl: 0, decl: 1 }, vals: Object.fromEntries(e.v) };
}
// the declarer problem's window: dummy above your hand, the auction, the contract, the lead; then Play (the first try
// counts: it is marked as failed from the moment it starts, and as made only when the contract is made)
function showPlayPuzzle(pz) {
  const st = pzState(), going = st.day === pz.day && st.ans === 'play' && st.pend && pzLive(), done = st.day === pz.day && st.ans === 'play' && !going ? st : null, me = pz.c.decl, dm = (me + 2) % 4, ld = (me + 1) % 4;
  const card = c => `<b class="${(c / 13 | 0) === 1 || (c / 13 | 0) === 2 ? 'red' : ''}">${RTXT[R(c)]}${STR[S(c)]}</b>`;
  const con = `${pz.c.level}${symHtml(pz.c.strain)}${pz.c.dbl === 2 ? 'XX' : pz.c.dbl ? 'X' : ''}`;
  let res = '';
  if (done) {
    res = done.ok ? `<div class="okmsg">✅ ${T('Well done! You made it with {0} tricks.', done.tr)}</div>`
      : `<div class="err">❌ ${done.tr != null ? T('Failed: {0} tricks, {1} needed.', done.tr, pz.need) : T('The game was left unfinished: it counts as failed.')}</div>`;
    res += `<div class="muted">${T('The key: at trick one, play {0} from dummy.', `${RTXT[R(pz.pick)]}${symHtml(S(pz.pick))}`)}</div>
      <details class="pzdeal"><summary class="pzsum">👁 ${T('Show all four hands')}</summary>${dealHtml(pz.deal, me)}</details>
      `;
  }
  res += pzProgHtml(!!done);
  openOv('puzzle', `<h2>🧩 ${T('Puzzle')}</h2>
    <div class="big">${T('Make the contract: you have one chance.')}</div>
    <div class="pzline">${T('Contract')}: <b>${con}</b> · ${T('Declarer')}: ${SEAT[me]} · ${T('The opening lead: {0}', SEAT[ld] + ' ' + RTXT[R(pz.lead)] + symHtml(S(pz.lead)))}</div>
    <div class="pzbox"><div class="pzpair"><small>${T('Dummy')} (${SEAT[dm]})</small>${pzHand(pz.deal[dm])}<small>${T('You')} (${SEAT[me]})</small>${pzHand(pz.deal[me])}</div>
    <div class="auction">${auctionTable(pz.auction, false, { board: pz.bn, dealer: pz.dealer, seat: me, sel: null })}</div></div>
    ${done ? '' : `<div class="muted">${going ? T('Your try has started: continue it, it is the one that counts.') : T('Your first try is the one that counts: plan the play before you start.')}</div>`}${res}
    ${typeof Net !== 'undefined' && Net.isAdmin() ? `<div class="row2"><button class="btn mini-btn" id="pzReset">🔄 ${T('Reset my puzzle rating')}</button></div>` : ''}
    <div class="row2">${done ? `<button class="btn" id="pzAgain">🔁 ${T('Try again (does not count)')}</button>` : going ? `<button class="btn gold" id="pzCont">▶ ${T('Continue')}</button>` : `<button class="btn gold" id="pzGo">▶ ${T('Play')}</button>`}<button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// the problem on the normal table: the auction is already made, the lead is on the table's first trick, the robots defend
// seeing every card
function pzPlayStart(pz, first) {
  if (first) {
    const p = pzProg(), next = { day: pz.day, ans: 'play', tr: null, prevSt: p.st, at: Date.now(), ok: false, scored: 1, pend: 1 };
    p.t++; p.r = Math.max(800, p.r - 15); p.st = 0; pzProgSave(p); pzSave(next); render();   // a try started counts as failed until the contract is made
  }
  closeOv();
  newBoard(pz.deal.map(h => h.slice()), pz.bn);
  clearTimeout(timer);
  G.pz = { day: pz.day, first: !!first, lead: pz.lead, need: pz.need };
  G.auction = pz.auction.map(a => ({ ...a }));
  const c = { ...pz.c };
  G.play = E.newPlayState(G.deal, c, G.auction, G.cards); G.play.rb = [0, 1, 2, 3].filter(s => s !== c.decl && s !== (c.decl + 2) % 4);
  G.phase = 'play';
  Field.dd(G.id, 'you', G.deal, c);
  flash(T('You are declarer'), 1500);
  save(); render(); tick();
}
function pzPlayDone(e) {
  const made = e.tricks >= G.pz.need;
  if (G.pz.first) { const s = pzState(); if (s.day === G.pz.day && s.ans === 'play') { s.tr = e.tricks; pzFinish(s, made); } setTimeout(showPuzzle, 1600); }   // pend: the start's failure is undone when made
  else { flash(made ? '✅ ' + T('This time you made it (it does not count).') : '❌ ' + T('Not made this time.'), 2500); setTimeout(showPuzzle, 2600); }
}
// a declarer problem turned so that you are the declarer (your seat), dummy opposite; the board number gives its dealer
function pzPlayBank(n) {
  const e = PZP[n % PZP.length], me = U(), rot = (me - e.c[3] + 4) % 4;
  const deal = [0, 1, 2, 3].map(() => null); e.d.forEach((h, s) => { deal[(s + rot) % 4] = h.slice(); });
  const dealer = (e.l + rot) % 4, cfg = { conv: { ...E.sysOf('twoone').conv }, agg: 0, sys: 'twoone' }, cards = [cfg, cfg], auction = [];
  e.a.forEach((call, i) => { const seat = (dealer + i) % 4; auction.push({ seat, call, m: E.explainCall(auction, seat, call, cards) }); });
  return { kind: 'play', deal, dealer, bn: dealer + 1, auction, c: { level: e.c[0], strain: e.c[1], dbl: e.c[2], decl: me }, lead: e.ld, pick: e.pk, need: e.c[0] + 6 };
}
function pzToday() {
  const day = new Date().toISOString().slice(0, 10);
  if (ui.pz && ui.pz.day === day && ui.pz.sys === (SET.sys || 'twoone') && !(PZP || PZB)) return ui.pz;
  if (PZP || PZB) {   // the banks: a declarer problem and a lead in turn
    const i = pzIdx(), key = 'p' + i;
    if (ui.pz && ui.pz.day === key) return ui.pz;
    const play = PZP && (!PZB || i % 2 === 0), b = play ? pzPlayBank(PZB ? i >> 1 : i) : pzBank(PZP ? i >> 1 : i);
    b.day = key; b.idx = i; b.sys = SET.sys || 'twoone'; ui.pz = b; return b;
  }
  let seed = 2166136261; for (const ch of 'puzzle-' + day) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const hard = day >= '2026-11-09', nDay = Math.floor(Date.parse(day) / 864e5), cards = sideCards();
  const kind = hard ? ['answer', 'rebid', 'compete', 'lead'][nDay % 4] : ['open', 'answer', 'lead'][nDay % 3];
  let pz = null;
  for (let k = 0; k < (hard ? 3000 : 400) && !pz; k++) {
    E.seed(((seed >>> 0) + k * 7919) >>> 0 || 1);
    const d = E.shuffle([...Array(52).keys()]), deal = [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13));
    const hcp = ev(deal[2]).hcp;
    if (hard) { pz = pzHard(kind, deal, hcp, k, cards); continue; }
    if (kind === 'open') { if (hcp >= 11 && hcp <= 21) pz = { kind, deal, dealer: 2, auction: [] }; }
    else if (kind === 'answer') {
      if (hcp < 6) continue;
      const auc = [], a1 = E.aiBid(auc, 0, deal[0], cards); auc.push({ seat: 0, call: a1.call, m: a1.m });
      if (a1.call === 'P') continue;
      const a2 = E.aiBid(auc, 1, deal[1], cards); auc.push({ seat: 1, call: a2.call, m: a2.m });
      if (a2.call !== 'P') continue;
      pz = { kind, deal, dealer: 0, auction: auc };
    } else {
      const dealer = k % 4, auc = [];
      while (!auctionOver(auc) && auc.length < 40) { const t = (dealer + auc.length) % 4, r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
      const c = contractOf(auc);
      if (c && c.decl === 1 && c.level >= 2 && !c.dbl) pz = { kind, deal, dealer, auction: auc, c };
    }
  }
  E.seed(null);
  if (!pz) return null;
  pz.day = day; pz.sys = SET.sys || 'twoone';
  if (pz.kind !== 'lead') { const r = E.aiBid(pz.auction, 2, pz.deal[2], cards); pz.best = r.call; pz.bestM = r.m; }
  ui.pz = pz; return pz;
}
/* a hard problem: a hand and an auction with a real decision. A bidding problem needs a call the robots can explain and
   that is not a pass; a lead has no sequence or singleton to reach for and no suit partner has bid */
function pzHard(kind, deal, hcp, k, cards) {
  const len = [0, 1, 2, 3].map(s => deal[2].filter(c => S(c) === s).length), sorted = [...len].sort((a, b) => b - a);
  const say = (auc, seat) => { const r = E.aiBid(auc, seat, deal[seat], cards); auc.push({ seat, call: r.call, m: r.m }); return r.call; };
  const problem = (dealer, auc) => {
    const r = E.aiBid(auc, 2, deal[2], cards);
    if (r.call === 'P' || !r.m || !r.m.t) return null;
    // the answer has to fit what it says it shows, and not be a forced or memorised reply
    if ((r.m.min != null && hcp < r.m.min) || (r.m.max != null && hcp > r.m.max)) return null;
    if (r.m.len && Object.entries(r.m.len).some(([s, n]) => len[+s] < n)) return null;
    if (/stayman|jtr|texas/.test(r.m.cv || '') || /reply|relay|forced/i.test(r.m.t)) return null;
    if (kind === 'answer' && typeof r.call === 'number' && r.call < 5) return null;   // a one-level reply: no decision
    return { kind, deal, dealer, auction: auc };
  };
  if (kind === 'answer' || kind === 'compete') {
    if (hcp < (kind === 'answer' ? 11 : 8)) return null;
    const auc = []; const op = say(auc, 0); if (op === 'P' || ST(op) === 4) return null;
    const rho = say(auc, 1); if (kind === 'answer' ? rho !== 'P' : typeof rho !== 'number') return null;
    return problem(0, auc);
  }
  if (kind === 'rebid') {
    if (hcp < 15 && sorted[0] < 6 && !(sorted[0] === 5 && sorted[1] === 5)) return null;
    const auc = [], op = say(auc, 2); if (op === 'P' || LV(op) !== 1 || ST(op) === 4 || say(auc, 3) !== 'P') return null;
    const re = say(auc, 0); if (re === 'P' || (auc[2].m && auc[2].m.cv) || say(auc, 1) !== 'P') return null;
    return problem(2, auc);
  }
  // the lead: a game or higher, nothing obvious to lead
  if (sorted[3] < 2) return null;
  for (let s = 0; s < 4; s++) { const rk = deal[2].filter(c => S(c) === s).map(R).sort((a, b) => b - a); if (rk.length > 1 && rk[0] >= 9 && rk[0] - rk[1] === 1) return null; }
  const dealer = k % 4, auc = [];
  while (!auctionOver(auc) && auc.length < 40) say(auc, (dealer + auc.length) % 4);
  const c = contractOf(auc);
  if (!c || c.decl !== 1 || c.dbl || !(c.level >= 4 || (c.level === 3 && c.strain === 4))) return null;
  if (auc.some(e => e.seat === 0 && typeof e.call === 'number' && e.call % 5 < 4)) return null;   // partner named a suit
  return { kind, deal, dealer, auction: auc, c };
}
function pzQuestion(k) { return T(k === 'open' ? 'What do you open?' : k === 'answer' ? 'Partner opened. What do you answer?' : k === 'lead' ? 'What do you lead?' : 'What do you bid?'); }
function pzHand(h) { return `<div class="pzhand">${[3, 2, 1, 0].map(s => `<div>${symHtml(s)} ${E.desc(E.inSuit(h, s)).map(c => RTXT[R(c)]).join(' ') || '—'}</div>`).join('')}<small>${ev(h).hcp} HCP</small></div>`; }
function showPuzzle() {
  if (pzWait()) { pzLoad(); return; }
  { const p0 = pzToday(); if (p0 && p0.kind === 'play') { showPlayPuzzle(p0); return; } }
  const pz = pzToday(); if (!pz) { flash(T('No problem today — try again later'), 2000); return; }
  const st = pzState(), done = st.day === pz.day ? st : null;
  const auc = pz.auction.length || pz.kind !== 'open' ? `<div class="auction">${auctionTable(pz.auction, pz.kind !== 'lead' && !done, { board: 1, dealer: pz.dealer, seat: 2, sel: done ? ui.pzSel ?? null : null }).replace(/data-ri=/g, "data-pzi=")}${done && ui.pzSel != null && pz.auction[ui.pzSel] ? `<div class="expl">${explHtml(pz.auction[ui.pzSel])}</div>` : ''}</div>` : `<div class="muted">${T('You are the dealer. Nobody is vulnerable.')}</div>`;
  let ctl = '';
  if (!done) {
    if (pz.kind === 'lead') ctl = `<div class="pzcards">${pz.deal[2].slice().sort((a, b) => S(b) - S(a) || R(b) - R(a)).map(c => `<button class="pzc s${S(c)}${red(S(c)) ? ' rd' : ''}" data-pzc="${c}">${RTXT[R(c)]}${STR[S(c)]}</button>`).join('')}</div>`;
    else {
      const L = legalCalls(pz.auction, 2);
      const lv = [1, 2, 3, 4, 5, 6, 7].map(l => `<div class="pzrow">${[0, 1, 2, 3, 4].map(s => { const c = B(l, s); return L.includes(c) ? `<button data-pzb="${c}">${callHtml(c)}</button>` : '<span></span>'; }).join('')}</div>`).join('');
      ctl = `<div class="pzbids"><div class="pzrow"><button class="pass" data-pzb="P">${T('Pass')}</button>${L.includes('X') ? `<button data-pzb="X">X</button>` : ''}</div>${lv}</div>`;
    }
  }
  let res = '';
  if (done) {
    if (pz.kind === 'lead') {
      if (!done.full) { pzLeads(); const n = Object.keys(done.vals || {}).length; res = `<div class="muted">⏳ ${T('Working out every lead…')} ${n}/${pz.deal[2].length}</div>`; }
      else {
        const v = done.vals, best = Math.max(...Object.values(v).filter(x => x != null)), mine = v[done.ans];
        res = `<div class="${mine === best ? 'okmsg' : 'err'}">${mine === best ? '✅ ' + T(pz.vals ? 'Only one lead beats this contract.' : 'Well done! That is a best lead.') : '❌ ' + T('Not the best lead.')}</div>
          <div>${T('Your lead')} <b>${RTXT[R(done.ans)]}${symHtml(S(done.ans))}</b>: ${T('the defence takes {0} tricks', mine)}. </div>
          <div class="pzvals">${[...new Set(Object.values(v))].sort((a, b) => (b ?? -1) - (a ?? -1)).map(n => `<div${n === best ? ' class="best"' : ''}><b>${n == null ? '?' : T('{0} tricks', n)}</b> ${Object.keys(v).filter(c => v[c] === n).map(Number).sort((a, b) => S(b) - S(a) || R(b) - R(a)).map(c => RTXT[R(c)] + symHtml(S(c))).join(' ')}</div>`).join('')}</div>
          <div class="muted">${T('Contract')} ${conKey(pz.c)} · ${T('double dummy: every hand open, best play on both sides.')}</div>`;
      }
    } else {
      const ok = done.ans === String(pz.best), ex = c => { const m = E.explainCall(pz.auction, 2, c, sideCards()); return m && m.t ? symText(bidTxt(m.t)) : ''; };
      const ans = done.ans === 'P' || done.ans === 'X' ? done.ans : +done.ans;
      res = `<div class="${ok ? 'okmsg' : 'err'}">${ok ? '✅ ' + T('Well done! The robot bids the same.') : '❌ ' + T('The robot bids differently.')}</div>
        <div>${T('Your answer')} <b>${callHtml(ans)}</b> — ${ex(ans)}</div>
        ${ok ? '' : `<div>${T('Robot')}: <b>${callHtml(pz.best)}</b> — ${ex(pz.best)}</div>`}
        <div class="muted">${T('With your system ({0}).', esc(E.sysOf(SET.sys).n))}</div>`;
    }
    if (done.dd) res += `<div class="pzdd"><b>Double dummy</b>${ddTabHtml(done.dd)}</div>`; else if (ui.pzDdFail !== pz.day) { pzDD(pz); res += `<div class="muted">⏳ Double dummy…</div>`; }
    if (done.ok != null) res += `<details class="pzdeal"><summary class="pzsum">👁 ${T('Show all four hands')}</summary>${dealHtml(pz.deal, 2)}</details>`;
    if (done.ok != null) res += /^p\d+$/.test(pz.day) ? pzProgHtml(true) : `<div class="muted">🔥 ${T('Days in a row: {0}', st.streak || 0)}</div>`;
  }
  else if (/^p\d+$/.test(pz.day)) res += pzProgHtml(false);
  openOv('puzzle', `<h2>🧩 ${T('Puzzle')}</h2><div class="big">${pzQuestion(pz.kind)}</div>${pz.vals ? `<div class="muted">${T('Only one lead beats this contract.')} · ${esc(E.sysOf('twoone').n)}</div>` : ''}
    <div class="pzbox">${pzHand(pz.deal[2])}${auc}</div>${ctl}${res}
    ${typeof Net !== 'undefined' && Net.isAdmin() && /^p\d+$/.test(pz.day) ? `<div class="row2"><button class="btn mini-btn" id="pzReset">🔄 ${T('Reset my puzzle rating')}</button></div>` : ''}
    <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
function pzAnswer(ans) {
  const pz = pzToday(); if (!pz) return;
  const st = pzState(); if (st.day === pz.day) return;
  const next = { day: pz.day, ans: pz.kind === 'lead' ? +ans : String(ans), streak: st.streak || 0, lastOk: st.lastOk, prev: st.lastOk, prevStreak: st.streak || 0 };
  if (pz.vals) { next.vals = pz.vals; next.full = true; pzFinish(next, pz.vals[next.ans] === Math.max(...Object.values(pz.vals))); return; }
  if (pz.kind === 'lead') { next.vals = {}; pzSave(next); pzLeads(); showPuzzle(); return; }
  pzFinish(next, String(ans) === String(pz.best));
}
/* a right answer on the day after the last right one makes the run longer */
function pzFinish(s, ok) {
  const p = pzProg(), lead = s.ans !== 'play', up = lead ? 15 : 20, dn = lead ? 10 : 15;
  if (s.pend) { if (ok) { p.r += dn + up; p.s++; p.st = (s.prevSt || 0) + 1; } delete s.pend; }   // a declarer try: counted as failed when it started
  else if (!s.scored) { p.t++; if (ok) { p.r += up; p.s++; p.st++; } else { p.r = Math.max(800, p.r - dn); p.st = 0; } }
  s.scored = 1; s.ok = ok; s.at = s.at || Date.now(); s.streak = p.st;
  if (/^p\d+$/.test(s.day || '')) pzProgSave(p);
  pzSave(s); if (ui.overlay === 'puzzle') showPuzzle(); render();
}
/* the leads are worked out in the background; each value shows as it comes */
// after the answer: the double-dummy table of the deal, worked out once and kept with the day's answer
function pzDD(pz) {
  if (ui.pzDdRun === pz.day) return; const w = Field.mk(); if (!w) { ui.pzDdFail = pz.day; return; }
  ui.pzDdRun = pz.day;
  const end = t => { w.terminate(); ui.pzDdRun = null; if (t) { const s = pzState(); if (s.day === pz.day) { s.dd = t; pzSave(s); } } else ui.pzDdFail = pz.day; if (ui.overlay === 'puzzle') showPuzzle(); };
  w.onerror = () => end(null);
  w.onmessage = m => { const d = m.data || {}; if (d.type === 'ddtable') end(d.t); if (d.type === 'error') end(null); };
  w.postMessage({ type: 'ddtable', id: 'pzdd', deal: pz.deal });
}
function pzLeads() {
  const pz = pzToday(); if (!pz || ui.pzRun === pz.day) return; ui.pzRun = pz.day;
  const got = (x, v) => { const s = pzState(); if (s.day !== pz.day) return; s.vals = s.vals || {}; s.vals[x] = v; pzSave(s); if (ui.overlay === 'puzzle') showPuzzle(); };
  const end = v => { ui.pzRun = null; const s = pzState(); if (s.day !== pz.day) return; s.vals = v; s.full = true; const best = Math.max(...Object.values(v).filter(x => x != null)); pzFinish(s, v[s.ans] === best); };
  const w = Field.mk();
  if (w) { w.onmessage = m => { const d = m.data || {}; if (d.type === 'lead1') got(d.x, d.v); if (d.type === 'leads') { w.terminate(); end(d.v); } }; w.postMessage({ type: 'leads', id: 'pz', deal: pz.deal, c: pz.c, limit: 2e7 }); }
  else setTimeout(() => end(E.leadValues(pz.deal, pz.c, 3e6)), 50);
}
document.addEventListener('click', e => {
  if (e.target.closest('#pzReset')) { askYes(T('Reset your puzzle rating to 1200 and the solved count to 0?'), () => { const p = pzProg(); pzSave({}); pzProgSave({ r: 1200, s: 0, t: 0, i: p.i + 1, st: 0 }); ui.pz = null; render(); showPuzzle(); flash('🔄 ' + T('Puzzle rating reset'), 2000); }); return; }
  if (e.target.closest('#pzCont')) { closeOv(); if (!(G && G.pz && G.phase === 'play') && ui.saved) resume(); return; }
  if (e.target.closest('#pzGo') || e.target.closest('#pzAgain')) { const p = pzToday(); if (p && p.kind === 'play') pzPlayStart(p, !!e.target.closest('#pzGo')); return; }
  const b = e.target.closest('[data-pzb]'); if (b) { pzAnswer(b.dataset.pzb); return; }
  const c = e.target.closest('[data-pzc]'); if (c) { pzAnswer(+c.dataset.pzc); return; }
  const pi = e.target.closest('[data-pzi]'); if (pi) { const i = +pi.dataset.pzi; ui.pzSel = ui.pzSel === i ? null : i; showPuzzle(); return; }
  if (e.target.closest('#hPuzzle')) { ui.pzSel = null; showPuzzle(); }
  if (e.target.closest('#pzNext')) { const p = pzProg(); p.i++; pzProgSave(p); pzSave({}); ui.pz = null; ui.pzSel = null; showPuzzle(); }
});
// the practice review of a board: per convention ✓ when every call where it came up was the system's, else ✗
function prvSum(rv) {
  const ks = [...new Set(rv.map(r => r.k))];
  return '📚 ' + ks.map(k => { const mine = rv.filter(r => r.k === k && !r.pd); return esc(pracName(k)) + ' ' + (!mine.length ? '🤝' : mine.every(r => r.ok) ? '✓' : '✗'); }).join(' · ');
}
function prvHtml(rv) {
  const ask = s => s >= 0 ? T('asks for {0}', symHtml(s)) : T('asks for no suit');
  return rv.map(r => {
    // a discard on defence (Lavinthal or Roman)
    if (r.cd) return `<div class="prv ${r.ok ? 'ok' : 'no'}"><b>${r.ok ? '✓' : '✗'} ${esc(pracName(r.k))}</b>
      <div>${T('You discarded')} ${cardH(r.card)} — ${ask(r.a)}</div>
      ${r.ok ? '' : `<div class="prvfix">${T('By the agreement')} ${cardH(r.sc)} — ${ask(r.b)}</div>`}</div>`;
    if (r.pd) { const ci = E.convInfo(r.k); return `<div class="prv pd"><b>🤝 ${esc(pracName(r.k))}</b>
      <div>${T("Partner's call")} ${callHtml(r.call)} — ${symText(bidTxt(r.ut))}</div>${ci && ci.d ? `<div class="prvd">${symText(ci.d)}</div>` : ''}</div>`; }
    return `<div class="prv ${r.ok ? 'ok' : 'no'}"><b>${r.ok ? '✓' : '✗'} ${esc(pracName(r.k))}</b>
    <div>${T('You bid')} ${callHtml(r.call)}${r.ok ? ` — ${symText(bidTxt(r.st || r.ut))}` : `${r.ut ? ` (${symText(bidTxt(r.ut))})` : ''}`}</div>
    ${r.ok ? '' : `<div class="prvfix">${T('The system bids')} ${callHtml(r.sc)} — ${symText(bidTxt(r.st))}</div>`}</div>`;
  }).join('');
}
// the conventions you get wrong most (under 80% right), the weakest first, at most three
function pracWeak() {
  const S = SET.pracS || {};
  return Object.keys(S).filter(k => pracKnown(k) && S[k].n && S[k].ok / S[k].n < 0.8).sort((a, b) => S[a].ok / S[a].n - S[b].ok / S[b].n || S[b].n - S[a].n).slice(0, 3);
}
// how you are doing with each convention you have practised: hands played, and how often your calls were right
// closed it is one line (how many conventions, right overall); a tap opens the list
function pracProgHtml() {
  const S = SET.pracS || {}, ks = Object.keys(S).filter(k => S[k] && S[k].n && pracKnown(k)).sort((a, b) => S[b].n - S[a].n);
  if (!ks.length) return '';
  const weak = pracWeak(), open = !!SET.progOpen;
  const tot = ks.reduce((a, k) => [a[0] + S[k].ok, a[1] + S[k].n], [0, 0]), pAll = Math.round(100 * tot[0] / tot[1]);
  const rows = open ? ks.map(k => { const s = S[k], p = Math.round(100 * s.ok / s.n), h = (SET.pracN || {})[k] || 0;
    return `<div class="prpr"><span class="prpn">${esc(pracName(k))}</span><span class="prpbar"><i style="width:${p}%" class="${p >= 80 ? 'g' : p >= 50 ? 'm' : 'b'}"></i></span><span class="prpv">${p}%</span><small>${T('{0} hands', h)} · ${T('{0} of {1} calls right', s.ok, s.n)}</small></div>`; }).join('') : '';
  return `<div class="prprog${open ? ' open' : ''}"><div class="prph"><button class="prptog" id="pdProg" aria-expanded="${open}">${T('Your progress')} <i>${open ? '▴' : '▾'}</i><small>${T('{0} conventions · {1}% right', ks.length, pAll)}</small></button>${weak.length ? `<button class="prweak" id="pdWeak">🎯 ${T('Practise my weak spots')}</button>` : ''}</div>${rows}</div>`;
}
function showEnd() {
  const e = G.result; if (!e) return;
  const f = G.field || { tables: [], done: false, dd: {} };
  const ddTxt = (k, c) => { const v = f.dd[k]; if (v === undefined) return T('calculating…'); if (v === null) return T('not available'); const d = v - (c.level + 6); return `${T('{0} tricks', v)} (${d >= 0 ? T('makes') : T('down {0}', -d)})`; };
  let fieldHtml;
  if (!f.done) fieldHtml = `<div class="muted">${T('The robot tables are playing this deal…')} (${f.tables.length}/${f.n || 10})</div>`;
  else {
    const fus = t => sideOf(e.seat) === 0 ? t.ns : -t.ns;
    // the robot table with the best score for our side (★) can be opened: how the robots bid it and played it
    let best = -1; f.tables.forEach((t, i) => { if (t.pl && (best < 0 || fus(t) > fus(f.tables[best]))) best = i; });
    fieldHtml = (best >= 0 ? `<div class="muted">${T('Tap the best robot table (★) to see how it was bid and played.')}</div>` : '') + `<table class="res"><thead><tr><th>${T('Table')}</th><th>${T('Contract')}</th><th>${T('Tricks')}</th><th class="n">${T('Score')}</th><th class="n">IMP</th></tr></thead><tbody>${f.tables.map((t, i) => `<tr${i === best ? ` class="rev fbest" data-ftab="${i}"` : ''}><td>${i + 1}${i === best ? ' ★' : ''}</td><td>${t.passed ? T('Pass') : conKey(t.c)}</td><td>${t.tricks ?? ''}</td><td class="n">${fmtSigned(fus(t))}</td><td class="n">${fmtSigned(E.imps(e.us - fus(t)))}</td></tr>`).join('')}</tbody></table>`;
  }
  const scoreTxt = e.imp != null ? `<div class="score2"><div class="on"><small>IMP</small><b>${fmtSigned(e.imp)}</b></div><div class="on"><small>MP</small><b>${e.mp}%</b></div></div>` : '';
  const norm = f.normC;
  openOv('end', `<h2>${T('Board')} ${e.board}</h2><div class="big">${resultLine(e)}</div>${G.claimed ? `<div class="muted">${T('The remaining tricks were settled by claim.')}</div>` : ''}
   ${scoreTxt}
   ${e.prv ? `<div class="grp"><span>📚 ${T('Convention review')}</span>${prvHtml(e.prv)}${e.prv.some(r => !r.ok && !r.pd) && !G.tour && !G.champ ? `<button class="btn gold prretry" id="oReplayP">🔁 ${T('Play this hand again and find the right call')}</button>` : ''}</div>` : ''}
   <div class="grp"><span>${T('Par check')}</span><div>${T('Normal contract (most common at the robot tables)')}: ${f.done ? (norm ? conKey(norm) + ' — ' + T('double dummy') + ' ' + ddTxt('norm', norm) : T('Pass')) : '…'}</div>
   </div>${e.c ? ddBox(e.c, f.dd.you) : ''}
   <div class="grp"><span>${T('Robot tables')}</span>${fieldHtml}</div>
   ${dealHtml(G.deal, U())}
   ${anaHtml(HIST.find(h => h.id === e.id) || e)}
   ${rbNoteHtml(HIST.find(h => h.id === e.id) || e)}
   <div class="row2"><button class="btn gold" id="oNext">${T('Next deal')}</button>${G.champ ? '' : `<button class="btn" id="oReplay">${T('Replay this deal')}</button>`}${G.tour ? "" : `<button class="btn" id="oShare">🔗 ${T("Share")}</button>`}<button class="btn" id="oClose">${T('Close')}</button></div>`);
}
function showAuction() {
  if (!G.auction.length) return;
  openOv('auc', `<h2>${T('Auction')}</h2><div class="auction">${auctionTable(G.auction, false)}</div><div class="expl">${explHtml(ui.lastExpl != null ? G.auction[ui.lastExpl] : null)}</div><div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
// Servet's switch (Settings, his alone): the robots see every hand, partners and opponents
// and for every player practising conventions alone with the robots
// never at online tables or in tournaments: there the robots bid and play only by the convention cards
// what the robots have newly learned: Servet is told once, when he opens the app after the update
const ROBOT_LEARNED = [
  { v: 475, tr: 'Bütün konvansiyonları her sistemde 3.000’er elde denedim. Gambling 3SA kartında açıksa artık gerçekten açıyorum (sağlam 7’li minör 1♣/1♦ ile açılıyordu, 3SA hiç çıkmıyordu). Ortağım bir renkte oyuna çıktıktan sonra (1SA–2♦–2♥–3♦–4♥–4SA) bir oyuncunun 4SA’sı artık o renkte RKCB diye açıklanıyor, kantitatif değil.', en: 'I tried every convention in every system on 3,000 deals each. With Gambling 3NT on your card I now really open it (a solid seven-card minor was opened 1♣/1♦, so 3NT never came). After partner bids game in a suit (1NT–2♦–2♥–3♦–4♥–4NT) a player’s 4NT is now read as RKCB in that suit, not quantitative.' },
  { v: 460, tr: 'Uyum belli değilken 5’li renkle oyuna atlamıyorum, davet ediyorum: 1♦–1♠–1SA ile ♠AKQ84 ♥973 ♦95 ♣A76: 4♠ değil 3♠; ortak uyumsuz bir renk söylediyse 5’li kupamla 4♥’e çıkmıyorum. 9.000 elde eski robotlarla yarıştırıldı: +131 IMP. Denenip kaybettirdiği için alınmayanlar: kontraya cevapta oyuna atlamamak (−67 IMP) ve 6’lı minör desteğiyle 1SA yerine yükseltmek.', en: 'With no known fit I no longer jump to game in a five-card suit, I invite: 1♦–1♠–1NT with ♠AKQ84 ♥973 ♦95 ♣A76: 3♠, not 4♠; after partner names a suit that does not fit, no 4♥ on my five hearts. Played against the old robots on 9,000 deals: +131 IMP. Tried and left out because they lost: no game jump when answering a takeout double (−67 IMP), and raising partner’s minor with six instead of 1NT.' },
  { v: 459, tr: 'Minörde 4’ü artık “oyun” diye açıklamıyorum: 4♣/4♦ davettir, oyun 5’tir; oyuna zorlayan dizide doğrudan 5♣/5♦ diyorum (1♥–2♣–2♥ ile ♠987 ♥J ♦AJ2 ♣AJ9653: 4♣ = davet). 3.000 elde denendi; 3SA’ya daha sık geçmek ve rakibin oyununun üstünde 5’e çıkmak IMP kaybettirdiği için alınmadı.', en: 'I no longer explain four of a minor as game: 4♣/4♦ invites, game is five; in a game-forcing auction I bid 5♣/5♦ at once (1♥–2♣–2♥ with ♠987 ♥J ♦AJ2 ♣AJ9653: 4♣ invites). Tried on 3,000 deals: going to 3NT more often and pushing to five over their game lost IMPs, so they were left out.' },
  { v: 458, tr: 'Minör Transfer’i öğrendim: kartında açıksa 1SA’ya 2♠ sineğe, 3♣ karoya transfer (6’lı minörlü zayıf el, açan 3♣/3♦ der, ben pas). Rakip yapay transfer teklifimi kontr ederse artık transferi yine tamamlıyorum; eskiden 2♠ kontrlü bırakılabiliyordu.', en: 'I learned Minor Transfer: when it is on your card, over 1NT 2♠ transfers to clubs and 3♣ to diamonds (a weak hand with a six-card minor; opener bids 3♣/3♦, I pass). If an opponent doubles the artificial transfer bid I still complete it; 2♠ doubled used to be left in.' },
  { v: 452, tr: 'Puppet Stayman’ı öğrendim (Sigride’nin isteği): kartında açıksa 2SA’dan sonra 3♣ 4’lü veya 5’li majör sorar; 3♦ = 4’lü majör var, 3♥/3♠ = 5’li, 3SA = yok. 3♦’dan sonra elimde olmayan majörü söylüyorum (3♥ = 4 pik, 3♠ = 4 kupa, 4♦ = ikisi de), böylece 2SA açan oynar.', en: 'I learned Puppet Stayman (Sigride’s request): when it is on your card, 3♣ over 2NT asks for a 4- or 5-card major; 3♦ = a 4-card major, 3♥/3♠ = five, 3NT = none. After 3♦ I bid the major I do not hold (3♥ = four spades, 3♠ = four hearts, 4♦ = both), so the 2NT opener declares.' },
  { v: 442, tr: '1♠–1SA gibi bir dizide 19+ puanlık güçlü açışla artık pas geçmiyor ya da minimum teklif vermiyorum: ikinci 4’lü renkle atlamalı söylüyorum (oyuna zorlayıcı), 6’lı majörle doğrudan oyuna çıkıyorum, dengeli 20-21 ile 3SA. Ortağın weak two ya da baraj açışına 19+ puan, destek ve iki asla doğrudan oyuna atlamıyorum, önce 4SA ile anahtar kart soruyorum.', en: 'With a strong opening (19+) after partner’s 1NT answer I no longer pass or make a minimum bid: a jump in a second suit (game forcing), game with six cards in my major, or 3NT balanced. With 19+, support and two aces opposite partner’s weak two or preempt I ask for key cards before bidding game.' },
  { v: 420, tr: 'Ortak araya girdikten sonra fitim yoksa ve 5 kartlı majörüm varsa önce majörü söylüyorum, 2SA’yı ondan sonra düşünüyorum (1♥–2♣–pas, ♠K10943 ♥Q73 ♦AJ98 ♣8: 2♠).', en: 'After partner’s overcall, with no fit and a five-card major, I bid the major before notrump.' },
  { v: 411, tr: 'Kartta Gerber kapalı olsa bile, ortağın 1NT, 2NT veya 3NT’sinin hemen üzerine, renk anlaşması yokken gelen 4♣ as sorusu: 4♦/4♥/4♠/4NT ile cevap veriyorum.', en: 'Even with Gerber off the card, 4♣ straight after partner’s 1NT, 2NT or 3NT with no suit agreed asks for aces, and I answer it.' },
  { v: 410, tr: 'Kartta Gerber varsa, ortağın 1NT, 2NT veya 3NT’sinin hemen üzerine, renk anlaşması yokken gelen 4♣ artık her dizide as sorusu: pas geçmiyorum, 4♦/4♥/4♠/4NT ile as sayımı veriyorum (1♣–1♥–2NT–3NT–4♣).', en: 'With Gerber on the card, 4♣ straight after partner’s 1NT, 2NT or 3NT with no suit agreed now asks for aces in every sequence: I answer instead of passing.' },
  { v: 378, tr: 'Ortak Cappelletti, DONT, Michaels ya da Unusual 2SA ile girdikten sonra rakip araya deklare yaparsa artık renk seçmek zorunda değilim: fitim varsa deklare ediyorum, yoksa pas (1SA–2♦–4♦: ♥ tek kâğıtla 4♥ yok). Ortağın eski takeout kontrasını, arada deklareler olduysa cevaplamıyorum.', en: 'After partner\'s Cappelletti, DONT, Michaels or Unusual 2NT and an opponent\'s bid over it I no longer have to choose a suit: I bid with a fit, else pass. An old takeout double is not answered once other calls came in between.' },
  { v: 378, tr: 'Stayman, transfer gibi yapay bir deklarenin kontrası takeout değil: o renkte iyi 5+ kâğıt, atak isteği. Ortağın böyle kontrasını takeout gibi cevaplamıyorum.', en: 'A double of an artificial bid (Stayman, a transfer) is lead-directing: a good 5+ suit, not takeout.' },
  { v: 378, tr: 'Game forcing bir dizide fit ve iki as varsa 31 puandan itibaren şlem arıyorum (1♠–2♦–3♦, 17 puan ve üç asla: 4SA).', en: 'In a game force with a fit and two aces I look for slam from 31 points.' },
  { v: 405, tr: 'Büyük şlemi artık sadece koz damesi de bizdeyse, en az 8 kartlık koz fitiyle ve 13 levée için yeterli puanla (birlikte 33+) söylüyorum; değilse küçük şlemde kalıyorum, koz fiti yoksa 6SA diyorum. Ortağım anahtar kart sorup kontratı seçince pas geçiyorum. Elimde sağlam 6’lı majör (ilk 5 onörden 4’ü) varken minör fit yerine o rengi koz seçiyorum (♠AKQJT6 ile 5♦ değil ♠).', en: 'A grand slam only with the trump queen, an 8-card fit and 33+ points together; a solid six-card major chosen over a minor fit.' },
  { v: 404, tr: 'Artık kendi hatalarımdan öğreniyorum: sistem masalarında her el bir de kapalı kartla oynanıyor, hatalarım double dummy ile bulunup bir ders defterine yazılıyor. Defterdeki dersler önce denemeye giriyor (ellerin yarısı derslerle, yarısı derssiz); sadece kaybedilen levéeyi gerçekten azaltan dersler kabul ediliyor ve oyunlarınızdaki robotlar onları kullanıyor. Her kabul edilen defteri size yazacağım. Sistem masalarında gösterilen oyunda ise dört eli de görüyorum.', en: 'I now learn from my own mistakes: a lesson book is tried on the system tables and used only when it loses fewer tricks.' },
  { v: 400, tr: 'Rakip levéeyi zaten almışsa ve elimdeki o renkteki kartların hepsi onunkinden küçükse, boşuna büyük kart vermiyorum, en küçüğünü veriyorum (3SA, deklaran ♦A çekti, bende ♦K9: Papaz değil 9). Sistem masalarında robotlar da artık uygulamadaki kadar uzun düşünüyor.', en: 'When an opponent has already won the trick beyond my reach, I follow with my lowest card, not an honour.' },
  { v: 387, tr: 'Rakibin zayıf ikili açışına (ör. 2♥) karşı 15+ puanla, onların renginde üç kâğıdım olsa da takeout kontra veriyorum; dengeli ve durdurucuyla 2SA diyorum (Board 512: ♠AJ ♥J82 ♦AQ73 ♣AT65 ile pas değil kontra, ortak 4♠ der).', en: 'Over their weak two I double for takeout with 15+ even with three of their suit, and bid 2NT with 15-18 balanced and a stopper.' },
  { v: 380, tr: 'Konvansiyon çalışan her oyuncunun masasında da bütün elleri görüyorum (deklarede ortağın gerçek eli, oyunda dört el).', en: 'I also see every hand at the table of any player practising conventions.' },
  { v: 379, tr: 'Servet açınca (Ayarlar → Robotlar tüm elleri görsün) bütün elleri görüyorum: deklarede ortağımın gerçek elini, kart oyununda ve defansta dört eli (double dummy en iyi kart). Rakip robotlar için de geçerli.', en: 'With Servet\'s switch on I see every hand: partner\'s real hand in the bidding, all four in the play and defence (the double-dummy best card). The opponents too.' },
];
// the lesson book the robots learned by themselves (accepted on the system tables): our games' robots use it
let LESSONS = null;
fetch('https://raw.githubusercontent.com/Servetsvm/bridge/robots-data/lessons.json?t=' + Math.floor(Date.now() / 600e3), { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
  .then(d => { if (d && d.acc && d.acc.book) { LESSONS = d.acc; BOT_OPT.lessons = d.acc.book; } }).catch(() => {});
function learnedMsg() {
  if (typeof Net === 'undefined' || !Net.isAdmin()) return;
  const seen = SET.learnedSeen || 0, L = ROBOT_LEARNED.filter(x => x.v > seen);
  // what the robots learned by themselves since Servet last looked
  if (LESSONS && LESSONS.v > (SET.lessonSeen || 0) && LESSONS.tr) L.push({ tr: `Robotlar kendi hatalarından öğrendi (ders defteri ${LESSONS.v}): kaybedilen levée %${LESSONS.gain} azaldı. ` + LESSONS.tr.join(' · ') });
  if (!L.length || ui.overlay) return;
  SET.learnedSeen = Math.max(...ROBOT_LEARNED.map(x => x.v)); if (LESSONS) SET.lessonSeen = LESSONS.v; Store.saveSettings(SET); save();
  openOv('learned', `<h2>🤖 Robot yeni öğrendi</h2>${L.map(x => `<div class="cvreq"><div class="cvb">${esc(x.tr)}</div></div>`).join('')}<div class="row2"><button class="btn gold" id="oClose">Kapat</button></div>`);
}
setTimeout(learnedMsg, 6000); setInterval(learnedMsg, 30000);   // shown when no other window is open
/* opponent robots by level (only when you play alone with robots): a beginner looks less far ahead and sometimes plays a careless card */
function robotCard(g, t) {
  const lv = SET.robotLvl || 'expert';
  if (lv === 'expert' || online() || G.tour || G.tprac || sideOf(t) === sideOf(U())) return E.aiPlay(g, t);
  if (lv === 'mid') return E.aiPlay(g, t, { budget: 250, maxSamples: 12, ddTricks: 6 });
  const leg = E.legalFor(g, t);
  return Math.random() < 0.25 ? leg[Math.floor(Math.random() * leg.length)] : E.aiPlay(g, t, { budget: 40, maxSamples: 3, ddTricks: 2 });
}
/* robots' cards: an expert robot looks at every card with double-dummy samples from the first trick on, which takes up
   to a second or two, so it is worked out in a background worker (the page stays smooth); without a worker, at once */
// at least 40 deals for every card: fewer leave close choices to chance (seen on real boards: 20 deals swung the defence
// between the right and the wrong suit)
const BOT_OPT = { budget: 2500, maxSamples: 150, ddTricks: 12, ddDecl: 13, evLim: 1500000, minSamples: 40, cap: 6000,
  lead: { budget: 4000, maxSamples: 100, evLim: 3000000, minSamples: 40, cap: 8000 } };   // both sides look ahead from the first trick (the defence after the opening lead, which is chosen by simulation)
const Bot = {
  w: null, n: 0, wait: null,
  ask(g, seat, opt) {
    if (this.w && this.stale && !this.wait) { this.w.terminate(); this.w = null; this.stale = false; }   // made before the fast solver was in
    if (!this.w) { this.w = Field.mk(); if (this.w) { this.w.onmessage = e => { const d = e.data || {}; if (d.type === 'engine') Bot.dds = d.dds; if (this.wait && d.id === this.wait.id) { const f = this.wait.f; this.wait = null; f(d.type === 'card' ? d.c : null); } }; this.w.onerror = () => { this.w = null; if (this.wait) { const f = this.wait.f; this.wait = null; f(null); } }; } }
    if (!this.w) return Promise.resolve(E.aiPlay(g, seat, opt));
    const id = ++this.n;
    return new Promise(res => {
      this.wait = { id, f: res };
      this.w.postMessage({ type: 'card', id, g, seat, opt });   // the play state is plain data: it goes to the worker as is
      // no time limit: the robot thinks as long as it needs (never its plain rules); only if the worker fails does the
      // same thinking run here instead
    }).then(c => c != null && E.legalFor(g, seat).includes(c) ? c : E.aiPlay(g, seat, opt));
  },
};
function robotCardAsync(g, t) {
  // one answer per position (the robot's turn can be looked at more than once while it thinks)
  const key = G.id + ':' + g.history.length + ':' + g.trick.length + ':' + t;
  if (Bot.key === key) return Bot.p;
  Bot.key = key; return Bot.p = robotCardFor(g, t);
}
async function robotCardFor(g, t) {
  const lv = SET.robotLvl || 'expert';
  if (G.pz && !g.history.length && !g.trick.length && G.pz.lead != null && g.hands[t].includes(G.pz.lead)) return G.pz.lead;   // the problem's lead
  if (G.watch || G.pz) return Bot.ask(g, t, { ...BOT_OPT, open: true });   // a deal given to the robots, or the puzzle's defence: played with every hand open
  if (lv === 'expert' || online() || G.tour || G.tprac || sideOf(t) === sideOf(U())) return Bot.ask(g, t, BOT_OPT);
  return robotCard(g, t);
}
/* ---- the robots' tables (🤖 Robot table — live): six tables, one per system, where four robots with made-up names
   play each other all day, each of the system's conventions in turn (.github/robots/robots.js plays the boards ahead of
   time, each with its start time, on the robots-data branch); every watcher sees each call and card at its time, so
   all see the same moment. A player can take a robot's seat: the next boards with those robots, on their device ---- */
const RT_URL = 'https://raw.githubusercontent.com/Servetsvm/bridge/robots-data/';
const RT_KEYS = ['sayc', 'twoone', 'acol', 'sef', 'precision', 'polish'];
const RT = { all: {}, data: null, cur: 'sayc', at: 0, busy: null, tab: 'live', sel: null, view: null, timer: null };
const RT_SYS = { twoone: '2/1 Game Force', sayc: 'SAYC', acol: 'Acol', sef: 'French Standard', precision: 'Precision Club', polish: 'Polish Club' };
const rtGet = f => fetch(RT_URL + f + '?t=' + Math.floor(Date.now() / 120e3), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
function rtLoad(force) {
  if (RT.busy) return RT.busy;
  if (!force && RT.at && Date.now() - RT.at < 60 * 60e3) return Promise.resolve(RT.data);
  return RT.busy = Promise.all(RT_KEYS.map(k => rtGet('live-' + k + '.json'))).then(L => {
    L.forEach((d, i) => { if (d && d.boards) RT.all[RT_KEYS[i]] = d; });
    RT.data = RT.all[RT.cur] || null; RT.at = Date.now(); return RT.data;
  }).finally(() => { RT.busy = null; });
}
function rtPick(k) { RT.cur = k; RT.data = RT.all[k] || null; RT.sel = null; RT.view = null; }
const rtConv = b => b.conv ? pracName(b.conv) : T('The system itself');
const rtPair = i => { const p = RT.data && RT.data.league && RT.data.league.pairs[i]; return p ? p.n.join(' & ') : ''; };
// the league as it stands after the last board played (the file has the boards still to come too)
const rtLast = D => { const t = Date.now(); let b = null; for (const x of (D && D.boards) || []) if (x.t1 <= t && x.rt) b = x; return b; };
const rtR = (D, i) => { const b = rtLast(D); if (b) return { r: b.rt[i], b: b.pb[i] }; const p = D && D.league && D.league.pairs[i]; return p ? { r: p.r, b: p.b } : null; };
const rtRating = i => { const p = rtR(RT.data, i); return p ? Math.round(p.r) : ''; };
function rtCur(t, D) {
  const B = ((D || RT.data) && (D || RT.data).boards) || [];
  const b = B.find(x => x.t0 <= t && t < x.t1); if (b) return { b };
  const w = B.find(x => x.t0 > t); return w ? { wait: w } : null;
}
// who played each card (the leader and the trick winners worked out once)
function rtSeq(b) {
  if (b._seq) return b._seq;
  const trump = b.c[1] < 4 ? b.c[1] : -1, out = []; let lead = b.lead;
  for (let i = 0; i < b.p.length; i += 4) {
    const tr = b.p.slice(i, i + 4).map((c, j) => ({ s: (lead + j) % 4, c }));
    out.push(...tr); if (tr.length === 4) lead = E.trickWinner(tr, trump);
  }
  return b._seq = out;
}
// where the board is at time t: the calls made, the cards played, the trick on the table, the tricks won
function rtPos(b, t) {
  const tm = RT.data.tm, calls = Math.max(0, Math.min(b.a.length, Math.floor((t - b.t0) / tm.call) + 1));
  const A = b.t0 + tm.call * b.a.length, seq = rtSeq(b);
  let m = 0, at = 0;
  if (t >= A) { let tc = A + tm.lead; while (m < seq.length && t >= tc) { at = tc; m++; tc += tm.card + (m % 4 === 0 ? tm.trick : 0); } }
  const full = m && m % 4 === 0 && t < at + tm.trick;
  const trick = full ? seq.slice(m - 4, m) : seq.slice(m - (m % 4), m);
  const won = [0, 0], trump = b.c[1] < 4 ? b.c[1] : -1;
  for (let i = 0; i + 4 <= m; i += 4) won[sideOf(E.trickWinner(seq.slice(i, i + 4), trump))]++;
  const done = m === seq.length && t >= at + tm.trick;
  return { calls, m, trick, won, done, seq };
}
const rtCon = c => c ? conKey({ level: c[0], strain: c[1], dbl: c[2], decl: c[3] }) : T('Pass');
function rtAuction(b, n, sel) {
  const cols = [3, 0, 1, 2];
  let o = '<table><thead><tr>' + cols.map(s => `<th class="${vulOf(b.bn, s) ? 'v' : ''}">${SEAT[s]}</th>`).join('') + '</tr></thead><tbody><tr>';
  let col = cols.indexOf(b.dealer); for (let i = 0; i < col; i++) o += '<td></td>';
  b.a.slice(0, n).forEach(([s, call, , cv], i) => { o += `<td><button class="c${i === sel ? ' sel' : ''}${cv ? ' cvb' : ''}" data-rti="${i}">${callHtml(call)}</button></td>`; if (++col === 4 && i < n - 1) { o += '</tr><tr>'; col = 0; } });
  return o + '</tr></tbody></table>';
}
function rtExpl(b, i) {
  const e = b.a[i]; if (!e) return T('Tap any call to see what it means.');
  const ci = e[3] ? E.convInfo(e[3]) : null;
  return `<b>${SEAT[e[0]]}: ${callHtml(e[1])}</b> — ${symText(bidTxt(e[2] || 'Pass'))}${ci ? `<div class="cv"><span>${ci.n}</span>${symText(ci.d)}</div>` : ''}`;
}
// the robot in a seat: North-South the first pair (North its first name), East-West the second
const rtName = (s, D) => { const P = ((D || RT.data).league || {}).pairs || [], n = (P[sideOf(s)] || { n: ['', ''] }).n; return n[s < 2 ? 0 : 1]; };
// the four hands (the cards still held) round the trick on the table; live: a seat to take (🪑)
function rtTable(b, P, live) {
  const gone = new Set(P.seq.slice(0, P.m).map(x => x.c)), pos = { 0: 'n', 1: 'e', 2: 's', 3: 'w' };
  const hand = s => `<div class="h ${pos[s]}"><b>${SEAT[s]} · ${esc(rtName(s))}${live ? ` <button class="btn mini-btn rtsit" data-rtsit="${s}" title="${T('Take this seat')}">🪑</button>` : ''}</b>${ORDER.map(su => suitLine(b.d[s].filter(c => !gone.has(c)), su)).join('<br>')}</div>`;
  // the auction (until the opening lead): each robot's last call in the middle, in front of its hand (the newest marked)
  const bidding = live && P.calls && !P.m, calls = bidding ? b.a.slice(0, P.calls) : [];
  const tr = [0, 1, 2, 3].map(s => {
    if (bidding) { const i = calls.map(e => e[0]).lastIndexOf(s); return `<span class="rt${pos[s]} rtbid${i === calls.length - 1 ? ' new' : ''}">${i >= 0 ? callHtml(calls[i][1]) : ''}</span>`; }
    const x = P.trick.find(y => y.s === s); return `<span class="rt${pos[s]}">${x ? RTXT[R(x.c)] + symHtml(S(x.c)) : ''}</span>`;
  }).join('');
  return `<div class="deal rtdeal">${[0, 1, 2, 3].map(hand).join('')}<div class="rttrick">${tr}</div></div>`;
}
function rtLive() {
  if (!RT.data) return `<div class="muted">${T('The robots will be back soon.')}</div>`;
  const t = Date.now(), x = rtCur(t);
  if (!x) return `<div class="muted">${T('The robots will be back soon.')}</div>`;
  if (x.wait) return `<div class="muted">⏳ ${T('The next board starts in {0} s', Math.ceil((x.wait.t0 - t) / 1000))}</div>`;
  const b = x.b, P = rtPos(b, t), aucDone = P.calls >= b.a.length;
  const sel = RT.sel != null && RT.sel < P.calls ? RT.sel : P.calls - 1;
  const res = P.done ? `<div class="okmsg">${rtCon(b.c)} · ${T('{0} tricks', b.tr)} · NS <b>${fmtSigned(b.sc)}</b><br>${T('Best contract (double dummy)')}: ${b.pc ? rtCon(b.pc) : T('Pass')} ${fmtSigned(b.par)} · <b>${fmtSigned(b.imp)} IMP</b></div>` : '';
  return `<div class="rthd"><b>${esc(RT_SYS[b.sys] || b.sys)} · ${esc(rtConv(b))}</b><small>${T('Board {0} of {1}', b.k, b.of)}</small></div>
    <div class="rtpairs"><span>NS: ${esc(rtPair(b.ns))} <small>${rtRating(b.ns)}</small></span><span>EW: ${esc(rtPair(b.ew))} <small>${rtRating(b.ew)}</small></span></div>
    ${aucDone ? `<div class="rtcon">${T('Contract')} <b>${rtCon(b.c)}</b> · NS ${P.won[0]} – EW ${P.won[1]}</div>` : ''}
    ${rtTable(b, P, true)}${res}
    <div class="auction">${rtAuction(b, P.calls, sel)}</div><div class="expl">${rtExpl(b, sel)}</div>
    <div class="row2"><button class="btn gold" data-rtwatch="1">🃏 ${T('Watch on the table')}</button></div>`;
}
function rtBoards() {
  const t = Date.now(), B = ((RT.data && RT.data.boards) || []).filter(b => b.t1 <= t).reverse();
  if (RT.view != null) {
    const b = B.find(x => x.n === RT.view); if (b) { const sel = RT.sel != null ? RT.sel : b.a.length - 1;
      return `<div class="row2"><button class="btn mini-btn" data-rtb="-1">← ${T('Boards')}</button></div><div class="rthd"><b>${esc(RT_SYS[b.sys] || b.sys)} · ${esc(rtConv(b))}</b><small>${T('Board {0} of {1}', b.k, b.of)}</small></div>
        ${rtTable(b, { seq: [], m: 0, trick: [] })}<div class="auction">${rtAuction(b, b.a.length, sel)}</div><div class="expl">${rtExpl(b, sel)}</div>
        <div class="okmsg">${rtCon(b.c)} · ${T('{0} tricks', b.tr)} · NS <b>${fmtSigned(b.sc)}</b> · ${T('Best contract (double dummy)')}: ${b.pc ? rtCon(b.pc) : T('Pass')} ${fmtSigned(b.par)} · <b>${fmtSigned(b.imp)} IMP</b></div>`; }
  }
  return B.length ? B.map(b => `<button class="rtrow" data-rtb="${b.n}"><b>${esc(rtConv(b))}</b> <small>${b.k}/${b.of}</small><span>${rtCon(b.c)} · ${T('{0} tricks', b.tr)} · NS ${fmtSigned(b.sc)} · ${fmtSigned(b.imp)} IMP</span></button>`).join('') : `<div class="muted">${T('No boards yet.')}</div>`;
}
// the league of all six tables: the pairs, the systems, the conventions (of the table on view)
function rtLeague() {
  const T6 = RT_KEYS.filter(k => RT.all[k] && RT.all[k].league);
  if (!T6.length) return `<div class="muted">${T('No boards yet.')}</div>`;
  const pairs = T6.flatMap(k => RT.all[k].league.pairs.map((p, i) => ({ ...p, ...(rtR(RT.all[k], i) || {}), k })));
  const pr = pairs.sort((a, b) => b.r - a.r).map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.n.join(' & '))}<br><small>${esc(RT_SYS[p.k])}</small></td><td><b>${Math.round(p.r)}</b></td><td>${p.b}</td></tr>`).join('');
  const row = (n, x) => `<tr><td>${esc(n)}</td><td>${x.b}</td><td>${(x.abs / x.b).toFixed(1)}</td><td>${Math.round(100 * x.hit / x.b)}%</td></tr>`;
  const sy = T6.map(k => { const b = rtLast(RT.all[k]); return [k, b && b.sy ? b.sy : RT.all[k].league.sys[k]]; }).filter(([, x]) => x && x.b).sort((a, b) => a[1].abs / a[1].b - b[1].abs / b[1].b).map(([k, x]) => row(RT_SYS[k] || k, x)).join('');
  const L = RT.data && RT.data.league;
  const cv = L ? Object.entries(L.conv).filter(([k, x]) => x.b && k !== '-').sort((a, b) => b[1].b - a[1].b).slice(0, 30).map(([k, x]) => row(pracName(k), x)).join('') : '';
  const head = `<tr><th></th><th>${T('Boards')}</th><th>${T('IMPs from the best')}</th><th>${T('Best reached')}</th></tr>`;
  return `<h3>🏆 ${T('Robot league')}</h3><div class="muted">${T('A pair\'s rating moves with its IMPs against the double-dummy best contract.')}</div>
    <table class="rttab"><tr><th>#</th><th></th><th>${T('Rating')}</th><th>${T('Boards')}</th></tr>${pr}</table>
    <h3>${T('Systems')}</h3><div class="muted">${T('How close the robots come to the best contract with each system (fewer IMPs is better).')}</div><table class="rttab">${head}${sy}</table>
    ${cv ? `<h3>${T('Conventions')} · ${esc(RT_SYS[RT.cur])}</h3><table class="rttab">${head}${cv}</table>` : ''}`;
}
function rtBody() {
  if (!RT.at) return `<div class="muted">⏳ ${T('Loading…')}</div>`;
  const tab = (k, l) => `<button class="${RT.tab === k ? 'on' : ''}" data-rtt="${k}">${l}</button>`;
  const tables = `<div class="rtchips">${RT_KEYS.map(k => `<button class="rtchip${RT.cur === k ? ' on' : ''}" data-rtk="${k}">${esc(RT_SYS[k])}</button>`).join('')}</div>`;
  return `${tables}<div class="seg rtseg">${tab('live', '🔴 ' + T('Live'))}${tab('boards', T('Boards'))}${tab('league', T('League'))}</div>
    ${RT.tab === 'live' ? rtLive() : RT.tab === 'boards' ? rtBoards() : rtLeague()}`;
}
function rtDraw() { const el = $('rtBody'); if (!el) return; const h = rtBody(); if (el.innerHTML !== h) el.innerHTML = h; }
function rtOpen(k) {
  RT.tab = 'live'; rtPick(k || RT.cur);
  openOv('rt', `<h2>🤖 ${T('System table — live')}</h2><div id="rtBody">${rtBody()}</div><div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
  rtLoad().then(() => { rtPick(RT.cur); rtDraw(); });
  if (RT.timer) clearInterval(RT.timer);
  RT.timer = setInterval(() => {
    if (ui.overlay !== 'rt') { clearInterval(RT.timer); RT.timer = null; return; }
    // the boards ahead running short: read the files again (they are written every two hours)
    const B = (RT.data && RT.data.boards) || [], last = B.length ? B[B.length - 1].t1 : 0;
    if (RT.at && last - Date.now() < 40 * 60e3 && Date.now() - RT.at > 5 * 60e3) rtLoad(true).then(() => { RT.data = RT.all[RT.cur] || null; });
    if (RT.tab === 'live') { const x = rtCur(Date.now()); if (x && x.b && RT.sel != null && x.b.n !== RT.lastN) RT.sel = null; RT.lastN = x && x.b ? x.b.n : null; rtDraw(); }
  }, 500);
}
// the double-dummy table of a board: the tricks each declarer takes in each strain (a game or more marked)
function rtDdHtml(b) { return b.dd ? ddTabHtml(b.dd) : ''; }
function ddTabHtml(dd) {
  const b = { dd };
  const st = [4, 3, 2, 1, 0], gm = (t, s) => t - 6 >= (s === 4 ? 3 : s >= 2 ? 4 : 5);
  return `<table class="rtdd"><tr><th>🎯</th>${st.map(s => `<th>${symHtml(s)}</th>`).join('')}</tr>${[0, 2, 1, 3].map(d => `<tr><th>${SEAT[d]}</th>${st.map(s => { const t = b.dd[d][s]; return `<td class="${t >= 7 ? (gm(t, s) ? 'gm' : 'ok') : ''}">${t >= 7 ? t - 6 : '–'}</td>`; }).join('')}</tr>`).join('')}</table>`;
}
// a system table's board over, in the middle of the table: the result, the double-dummy table, watch again / continue
function rtDoneHtml(b) {
  return `<div class="rtdone"><div class="rtres">${rtCon(b.c)} · ${T('{0} tricks', b.tr)} · NS <b>${fmtSigned(b.sc)}</b><small>${T('Best contract (double dummy)')}: ${b.pc ? rtCon(b.pc) : T('Pass')} (${fmtSigned(b.imp)} IMP)</small></div>${rtDdHtml(b)}<div class="row2 rtend"><button class="btn" id="bRtAgain">🔁 ${T('Watch again')}</button><button class="btn gold" id="bRtNext">▶ ${T('Continue')}</button></div></div>`;
}
// the system table on the game's own table: the board as it stands at time t (every hand open; the robots act, not us)
function rtGameOf(b, t) {
  const P = rtPos(b, t), c = { level: b.c[0], strain: b.c[1], dbl: b.c[2], decl: b.c[3] };
  const auction = b.a.slice(0, P.calls).map(([seat, call, tx, cv]) => ({ seat, call, m: { t: tx, cv } }));
  const cards = [0, 1].map(() => ({ conv: { ...E.sysOf(b.sys).conv }, agg: 0, sys: b.sys }));
  const bidding = P.calls < b.a.length;
  let play = null;
  if (!bidding) {
    play = E.newPlayState(b.d, c, auction, cards);
    const keepLast = P.trick.length === 4;   // a full trick stays on the table a moment before it is gathered
    for (let i = 0; i < P.m; i++) { const x = P.seq[i]; E.applyCard(play, x.s, x.c); if (play.trick.length === 4 && !(keepLast && i === P.m - 1)) E.collect(play); }
  }
  return { id: 'rt-' + b.sys + '-' + b.n, board: b.bn, dealer: b.dealer, deal: b.d, auction, phase: bidding ? 'bid' : 'play', play, result: null, claimed: false, field: null, tour: null, cards, watch: true, rtv: { k: b.sys, b, done: P.done } };
}
function rtWatch(k) {
  if (online()) { flash(T('Online') + ' ●', 1500); return; }
  if (k) rtPick(k);
  rtLoad().then(() => {
    rtPick(RT.cur);
    const now = Date.now(), x = rtCur(now); if (!x) { flash(T('The robots will be back soon.'), 2500); return; }
    // an unfinished board of your own is kept (Play offline carries on with it)
    if (G && !G.rtv && (G.phase === 'bid' || G.phase === 'play')) ui.saved = G;
    clearTimeout(timer); closeOv();
    // the board on the table now, from where it is (the next one: from its start)
    rtShow(x.b || x.wait, x.b ? 0 : now - x.wait.t0);
    clearInterval(RT.wt);
    RT.wt = setInterval(() => {
      if (!G || !G.rtv) { clearInterval(RT.wt); RT.wt = null; return; }
      const B = (RT.all[G.rtv.k] || {}).boards || [], last = B.length ? B[B.length - 1].t1 : 0;
      if (RT.at && last - Date.now() < 40 * 60e3 && Date.now() - RT.at > 5 * 60e3) rtLoad(true).then(() => { RT.data = RT.all[RT.cur] || null; });
      const b = RT.pb, t = Date.now() - RT.off, P = rtPos(b, t);
      const key = b.sys + b.n + ':' + P.calls + ':' + P.m + ':' + P.trick.length + ':' + (P.done ? 1 : 0);
      if (key === RT.wkey) return; RT.wkey = key;   // a finished board stays until Continue
      G = rtGameOf(b, t); if (!ui.overlay) render();
    }, 300);
  });
}
// watch board b, its clock off ms behind the real one
function rtShow(b, off) { RT.pb = b; RT.off = off; RT.wkey = null; G = rtGameOf(b, Date.now() - off); render(); }
// 🔁 the same board again from its start; ▶ the table's next board, from its start
function rtAgain() { if (G && G.rtv) rtShow(RT.pb, Date.now() - RT.pb.t0); }
function rtNext() {
  if (!G || !G.rtv) return;
  const find = () => ((RT.all[G.rtv.k] || {}).boards || []).find(x => x.n > RT.pb.n);
  const go = n => { if (n) rtShow(n, Date.now() - n.t0); else flash(T('The robots will be back soon.'), 2500); };
  const n = find(); if (n) go(n); else rtLoad(true).then(() => go(find()));
}
// a player takes a robot's seat: the next boards at their own table with these robots (their names) in the other
// seats; the robots (the partner too) play the player's own system and conventions, not the table's
function rtSit(s) {
  const x = rtCur(Date.now()), b = x && (x.b || x.wait); if (!b) return;
  const mine = (RT_SYS[SET.sys] || SET.sys) + (pracList()[0] ? ' · ' + pracName(pracList()[0]) : '');
  askYes(T('Take {0}\'s seat? You play the next boards as {1} with these robots. Your robot partner plays your own system and conventions ({2}).', rtName(s), SEAT[s], mine), () => {
    SET.rtNames = { sys: SET.sys, n: [0, 1, 2, 3].map(q => rtName(q)) };
    SET.seat = s;
    Store.saveSettings(SET); save();
    closeOv(); ui.saved = null; Net.st.soloPub = true; resume();
  });
}
// 🪑 Sit down on the system table's bar: the four seats with their robots' names
function rtSitPick() {
  const x = rtCur(Date.now()), b = x && (x.b || x.wait); if (!b) return;
  openOv('rtsit', `<h2>🪑 ${T('Sit down')} · ${esc(RT_SYS[b.sys] || b.sys)}</h2>
    <div class="muted">${T('Choose a seat: you play the next boards in it with these robots.')} ${T('Your robot partner plays your own system and conventions.')}</div>
    <div class="rtseats">${[2, 3, 0, 1].map(s => `<button class="btn gold" data-rtsit="${s}">${SEAT[s]}<small>${esc(rtName(s))}</small></button>`).join('')}</div>
    <div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// the home page's card: the six tables (their systems' names)
function rtCardHtml() {
  return `<div class="rtgo"><b>🔴 🤖 ${T('System table — live')}</b></div><div class="rtrows">${RT_KEYS.map(k => `<button class="rtchip" data-rtk="${k}" data-rtopen="1">${esc(RT_SYS[k])}</button>`).join('')}</div>`;
}
setTimeout(() => rtLoad().then(() => { const el = $('hRobot'); if (el) el.innerHTML = rtCardHtml(); }), 3000);
setInterval(() => { const el = $('hRobot'); if (!el || !document.body.classList.contains('athome')) return; rtLoad().then(() => { const h = rtCardHtml(); if (el.innerHTML !== h) el.innerHTML = h; }); }, 30000);
function showSettings() {
  const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const convs = E.CONVS.map(c => `<label class="cvrow"><input type="checkbox" data-conv="${c.k}" ${SET.conv[c.k] ? 'checked' : ''}><span><b>${c.n}</b>${c.x ? `<em class="xo">${T('replaces')} ${E.CONVS.find(y => y.k === c.x).n}</em>` : ''}<small>${symText(c.d)}</small></span></label>`).join('');
  openOv('set', `<h2>${T('Settings')}</h2>
   <button class="btn gold guide" id="bHelp2">📘 ${T('User guide')}</button>
   <div class="grp"><span>${T('Practice a convention')}</span><select id="sPractice" class="sel"><option value="">${T('Off — normal random deals')}</option>${E.CONVS.map(c => `<option value="${c.k}" ${pracList()[0] === c.k ? 'selected' : ''}>${c.n}</option>`).join('')}</select><div class="muted">${T('New deals are chosen so that you (or your partner) get to use this convention. It is switched on in your card automatically.')}</div></div>
   <div class="grp"><span>${T('Play a specific deal')}</span><button class="btn" id="sDeal">${T('Enter a deal (from a photo or a hand record)')}</button></div>
   <div class="grp"><span>${T('Your seat')}</span>${seg('seat', [0, 1, 2, 3].map(s => [s, SEAT[s]]), SET.seat)}</div>
   <div class="grp"><span>${T('Bid explanations')}</span>${seg('expl', [[1, T('Show')], [0, T('Hide')]], SET.expl ? 1 : 0)}</div>
   <div class="grp"><span>${T('Correct the robots')}</span>${seg('fixbot', [[1, T('On')], [0, T('Off')]], SET.fixBot ? 1 : 0)}<div class="muted">${T("When a robot plays a wrong card, ↩ 🤖 takes it back and you play the card it should have played. Your corrections are sent to improve the robots.")}</div></div>
   <div class="grp"><span>${T('Play a forced card automatically')}</span>${seg('auto', [[1, T('On')], [0, T('Off')]], SET.auto ? 1 : 0)}</div>
   <div class="grp"><span>${T('Sound and buzz when it is your turn')}</span>${seg('alert', [['online', T('At online tables')], ['always', T('Always')], ['off', T('Off')]], SET.alert || 'online')}</div>
   <div class="grp"><span>${T('Notifications when the app is in the background')}</span>${seg('notify', [[1, T('On')], [0, T('Off')]], SET.notify !== false ? 1 : 0)}<div class="muted">${T('Join requests, messages, invitations and your turn — while the app is open in the background. A closed app cannot be reached.')}</div></div>
   <div class="grp"><span>${T('Table sounds')}</span>${seg('sfx', [[1, T('On')], [0, T('Off')]], SET.sfx ? 1 : 0)}</div>
   <div class="muted">${T('Changes apply from the next deal.')} ${Store.online ? T('Settings and scores are saved to your account.') : T('Scores are saved on this device.')} ${T('Every deal you get is new — a deal is never dealt to you twice.')}</div>
   <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button>${typeof Net !== 'undefined' && Net.isAdmin() ? `<button class="btn" id="sReset">${T('Delete score history')}</button>` : ''}</div>
   <div class="row2"><button class="btn" id="sLogout">🚪 ${T('Log out')} (${esc(myNm())})</button></div>
   <div class="muted ver">v${APP_V} · ${innerWidth}×${innerHeight} · ×${Math.round(devicePixelRatio * 100) / 100} · 🤖 ${Bot.dds ? 'DDS' : Bot.dds === false || typeof ddsFactory !== 'function' ? 'JS' : 'DDS…'}</div>`);
}
/* ---- user guide in three languages: open it, or download it to read offline ---- */
function showHelp() {
  const base = /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) ? "" : "https://servetsvm.github.io/bridge/";
  const row = (file, name, flag) => `<div class="helprow"><span>${flag} <b>${name}</b></span><a class="btn" href="${base}${file}" target="_blank" rel="noopener">${T('Open')}</a><a class="btn gold" href="${base}${file}" download="${file.replace(".html", "")}-bridge-table.html">${T('Download')}</a></div>`;
  openOv("help", `<h2>${T('User guide')}</h2>
   <div class="muted">${T('Explains every button and every option in Settings, the convention card, reading a deal from a photo, and syncing your phone and PC. Download it to keep it on your device and read it offline.')}</div>
   ${[["en", "guide-en.html", "English", "🇬🇧"], ["tr", "guide.html", "Türkçe", "🇹🇷"], ["no", "guide-no.html", "Norsk", "🇳🇴"], ["es", "guide-es.html", "Español", "🇪🇸"], ["fr", "guide-fr.html", "Français", "🇫🇷"], ["it", "guide-it.html", "Italiano", "🇮🇹"], ["de", "guide-de.html", "Deutsch", "🇩🇪"], ["ru", "guide-ru.html", "Русский", "🇷🇺"], ["pl", "guide-pl.html", "Polski", "🇵🇱"], ["zh", "guide-zh.html", "中文", "🇨🇳"]].sort((a, b) => (b[0] === SET.lang) - (a[0] === SET.lang)).map(([, f, n, fl]) => row(f, n, fl)).join("")}
   <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
/* ---- entering a deal (hand record, PBN, or the code Claude reads from a photo) ---- */
const RANKS = { A: 12, K: 11, Q: 10, J: 9, T: 8, '9': 7, '8': 6, '7': 5, '6': 4, '5': 3, '4': 2, '3': 1, '2': 0 };
/* "AKQ2.K73.J5.T942" (spades.hearts.diamonds.clubs) or "S AKQ2 H K73 D J5 C T942" / "♠AKQ2 ♥K73 …" */
function parseHand(txt) {
  txt = String(txt || '').toUpperCase().replace(/10/g, 'T').trim();
  if (!txt) return null;
  const out = [], put = (s, str) => { for (const ch of str.replace(/[^AKQJT2-9]/g, '')) out.push(s * 13 + RANKS[ch]); };
  if (txt.includes('.')) { const parts = txt.split('.'); if (parts.length !== 4) throw new Error(T('Use four groups separated by dots: spades.hearts.diamonds.clubs')); [3, 2, 1, 0].forEach((s, i) => put(s, parts[i])); }
  else {
    const map = { S: 3, '♠': 3, H: 2, '♥': 2, D: 1, '♦': 1, C: 0, '♣': 0 };
    const re = /([SHDC♠♥♦♣])\s*:?\s*([AKQJT2-9\-—]*)/g; let m, any = false;
    while ((m = re.exec(txt))) { any = true; put(map[m[1]], m[2]); }
    if (!any) throw new Error(T('Could not read "{0}"', txt));
  }
  return out;
}
function parsePBN(txt) {
  const m = String(txt).match(/([NESW])\s*:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i); if (!m) return null;
  const first = 'NESW'.indexOf(m[1].toUpperCase()), hands = [[], [], [], []];
  for (let i = 0; i < 4; i++) hands[(first + i) % 4] = m[i + 2] === '-' ? null : parseHand(m[i + 2]);
  return hands;
}
/* ---- hand records as files: PBN (all boards from Results, or one board) and LIN (one board) out; PBN or LIN files in,
   their deals played one after the other ---- */
const RK = '23456789TJQKA', SL = 'CDHS';
const handStr = h => [3, 2, 1, 0].map(s => h.filter(c => S(c) === s).sort((a, b) => R(b) - R(a)).map(c => RK[R(c)]).join('')).join('.');
const pbnCall = c => c === 'P' ? 'Pass' : c === 'X' || c === 'XX' ? c : LV(c) + (ST(c) === 4 ? 'NT' : SL[ST(c)]);
const vulTag = b => vulOf(b, 0) && vulOf(b, 1) ? 'All' : vulOf(b, 0) ? 'NS' : vulOf(b, 1) ? 'EW' : 'None';
function pbnOf(e) {
  const d = new Date(e.ts || Date.now()), q = v => `"${String(v).replace(/"/g, "'")}"`;
  const who = s => s === e.seat ? (myNm() || 'You') : 'Robot';
  const tag = (k, v) => `[${k} ${q(v)}]\n`;
  let o = tag('Event', 'Bridge Table') + tag('Site', location.host || 'Bridge Table') + tag('Date', `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`)
    + tag('Board', e.board) + tag('West', who(3)) + tag('North', who(0)) + tag('East', who(1)) + tag('South', who(2))
    + tag('Dealer', 'NESW'[e.dealer ?? dealerOf(e.board)]) + tag('Vulnerable', vulTag(e.board))
    + tag('Deal', 'N:' + [0, 1, 2, 3].map(s => handStr(e.deal[s])).join(' ')) + tag('Scoring', SET.mode === 'MP' ? 'MP' : 'IMP');
  if (e.passed || !e.c) o += tag('Declarer', '') + tag('Contract', 'Pass') + tag('Result', '');
  else o += tag('Declarer', 'NESW'[e.c.decl]) + tag('Contract', LV(B(e.c.level, e.c.strain)) + (e.c.strain === 4 ? 'NT' : SL[e.c.strain]) + (e.c.dbl === 1 ? 'X' : e.c.dbl === 2 ? 'XX' : '')) + tag('Result', e.tricks);
  if (e.auc && e.auc.length) {
    o += `[Auction "${'NESW'[e.dealer ?? dealerOf(e.board)]}"]\n`;
    for (let i = 0; i < e.auc.length; i += 4) o += e.auc.slice(i, i + 4).map(a => pbnCall(a[1])).join(' ') + '\n';
  }
  if (e.pl && e.pl.length && e.c) {
    const L = (e.c.decl + 1) % 4; o += `[Play "${'NESW'[L]}"]\n`;
    for (const t of e.pl) { const by = {}; for (const [s, c] of t) by[s] = SL[S(c)] + RK[R(c)]; o += [0, 1, 2, 3].map(k => by[(L + k) % 4] || '-').join(' ') + '\n'; }
    if (e.pl.length < 13) o += '*\n';
  }
  return o;
}
/* LIN: the seats go South, West, North, East; the dealer is 1 = South … 4 = East */
function linOf(e) {
  const hs = h => [3, 2, 1, 0].map(s => SL[s] + h.filter(c => S(c) === s).sort((a, b) => R(b) - R(a)).map(c => RK[R(c)]).join('')).join('');
  const who = s => s === e.seat ? (myNm() || 'You') : 'Robot', dl = e.dealer ?? dealerOf(e.board);
  let o = `pn|${[2, 3, 0, 1].map(who).join(',')}|st||md|${(dl + 2) % 4 + 1}${[2, 3, 0].map(s => hs(e.deal[s])).join(',')},${hs(e.deal[1])}|rh||ah|Board ${e.board}|sv|${({ None: 'o', NS: 'n', EW: 'e', All: 'b' })[vulTag(e.board)]}|`;
  for (const [, c] of e.auc || []) o += `mb|${c === 'P' ? 'p' : c === 'X' ? 'd' : c === 'XX' ? 'r' : LV(c) + (ST(c) === 4 ? 'N' : SL[ST(c)])}|`;
  for (const t of e.pl || []) { o += 'pg||'; for (const [, c] of t) o += `pc|${SL[S(c)]}${RK[R(c)]}|`; }
  if (e.c && e.pl && e.pl.length < 13) o += `mc|${e.tricks}|`;
  return o + 'pg||\n';
}
function saveFile(name, text) {
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const fileDay = () => new Date().toISOString().slice(0, 10);
function exportPBN(list) {
  const L = list.filter(e => e.deal); if (!L.length) { flash(T('No boards to save yet'), 2000); return; }
  saveFile(`bridge-${fileDay()}.pbn`, '% PBN 2.1\n% EXPORT\n' + L.map(e => pbnOf(e)).join('\n'));
}
/* the board number with this dealer and vulnerability (1–16) */
function boardFor(dealer, vul) { for (let b = 1; b <= 16; b++) if (dealerOf(b) === dealer && vulTag(b) === vul) return b; return dealer + 1; }
/* every deal in a PBN or LIN file: [{ hands, bn }] */
function readDealFile(txt) {
  const out = [];
  if (/\bmd\|/.test(txt)) {
    for (const m of txt.matchAll(/md\|(\d)([^|]*)\|([\s\S]*?)(?=md\||$)/g)) {
      const dl = (+m[1] + 1) % 4, parts = m[2].split(','), seats = [2, 3, 0, 1], hands = [null, null, null, null];
      parts.forEach((p, i) => { if (i < 4 && p) hands[seats[i]] = parseLinHand(p); });
      const sv = (m[3].match(/sv\|(\w)/) || [])[1] || 'o', bm = m[3].match(/ah\|Board (\d+)/);
      const vul = ({ o: 'None', n: 'NS', e: 'EW', b: 'All' })[sv.toLowerCase()] || 'None';
      out.push({ hands, bn: bm && dealerOf(+bm[1]) === dl && vulTag(+bm[1]) === vul ? +bm[1] : boardFor(dl, vul) });
    }
  } else {
    for (const rec of txt.split(/\n\s*\n|(?=\[Event )/)) {
      const tag = k => { const m = rec.match(new RegExp('\\[' + k + '\\s+"([^"]*)"\\]', 'i')); return m ? m[1] : null; };
      const deal = tag('Deal'); if (!deal) continue;
      const hands = parsePBN(deal); if (!hands) continue;
      const dl = Math.max(0, 'NESW'.indexOf((tag('Dealer') || 'N').toUpperCase())), vul = ({ none: 'None', love: 'None', '-': 'None', ns: 'NS', ew: 'EW', all: 'All', both: 'All' })[(tag('Vulnerable') || 'None').toLowerCase()] || 'None';
      const b = +(tag('Board') || 0);
      out.push({ hands, bn: b && dealerOf(b) === dl && vulTag(b) === vul ? b : boardFor(dl, vul) });
    }
  }
  // a missing fourth hand gets the cards left over; only complete deals are kept
  return out.filter(d => {
    const used = new Set(d.hands.flat().filter(c => c != null)), empty = d.hands.map((h, s) => h && h.length ? -1 : s).filter(s => s >= 0);
    if (empty.length === 1) d.hands[empty[0]] = [...Array(52).keys()].filter(c => !used.has(c));
    return d.hands.every(h => h && h.length === 13) && new Set(d.hands.flat()).size === 52;
  });
}
function parseLinHand(p) {
  const h = []; let s = -1;
  for (const ch of p.toUpperCase()) { if ("SHDC".includes(ch)) { s = SL.indexOf(ch); continue; } const r = RK.indexOf(ch); if (s >= 0 && r >= 0) h.push(s * 13 + r); }
  return h;
}
async function importDeals(file) {
  try {
    const list = readDealFile(await file.text());
    if (!list.length) { showDealEntry(T('No deals found in this file.')); return; }
    ui.dealQ = { list, i: 0 };
    ui.photoHands = null; ui.photoMsg = null; ui.dealForm = null; closeOv();
    newBoard(list[0].hands, list[0].bn);
    flash(T('{0} deals read from the file. Deal 1 of {0}.', list.length), 2500);
  } catch (e) { showDealEntry(e.message); }
}
/* the next deal from the file; false when there is none left */
function nextFileDeal() {
  const q = ui.dealQ; if (!q) return false;
  q.i++; if (q.i >= q.list.length) { ui.dealQ = null; newBoard(); flash(T('That was the last deal from the file.'), 2500); return true; }
  newBoard(q.list[q.i].hands, q.list[q.i].bn);
  flash(T('Deal {0} of {1} from the file.', q.i + 1, q.list.length), 2000);
  return true;
}
function showDealEntry(err) {
  const v = ui.dealForm || { pbn: '', h: ['', '', '', ''], dealer: 0, vul: 0 };
  ui.dealForm = v;
  const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([val, l]) => `<button data-v="${val}" class="${String(cur) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  openOv('deal', `<h2>${T('Enter a deal')}</h2>
   <div class="row2"><label class="btn gold" for="dPhoto" role="button">📷 ${T('Read from a photo or screenshot')}</label><input type="file" id="dPhoto" accept="image/*" hidden></div>
   <div class="row2"><label class="btn" for="dFile" role="button">📄 ${T('Open a PBN or LIN file')}</label><input type="file" id="dFile" accept=".pbn,.lin,.txt,text/plain" hidden></div>
   <div class="muted">${T('Works with the end-of-board screen of your bridge app (four open hands) and with hand records that list ♠ ♥ ♦ ♣ for each hand. The picture is only read on this device: it is not saved or uploaded, and it is cleared from memory as soon as the cards are read. The cards it reads appear below as a code — check them before you play.')} ${T('You can also type the hands: spades.hearts.diamonds.clubs, e.g.')} <b>AKQ2.K73.J5.T942</b> (T = 10). ${T('Leave one hand empty and it is filled with the remaining cards.')}</div>
   ${ui.photoMsg ? `<div class="${ui.photoErr ? "err" : "okmsg"}">${ui.photoMsg}</div>` : ""}
   ${ui.photoHands ? dealHtml(ui.photoHands.map(h => h || []), U()) : ""}
   <div class="grp"><span>${T('PBN code (optional)')}</span><input id="dPbn" class="tok wide" placeholder="N:AKQ2.K73.J5.T942 ..." value="${v.pbn.replace(/"/g, '&quot;')}"></div>
   ${[0, 1, 2, 3].map(s => `<div class="grp"><span>${SEAT[s]}</span><input id="dH${s}" class="tok wide" placeholder="AKQ2.K73.J5.T942" value="${v.h[s].replace(/"/g, '&quot;')}"></div>`).join('')}
   <div class="grp"><span>${T('Dealer')}</span>${seg('ddealer', [0, 1, 2, 3].map(s => [s, SEAT[s]]), v.dealer)}</div>
   <div class="grp"><span>${T('Vulnerable')}</span>${seg('dvul', [[0, T('None')], [1, SEAT_AB[0] + '-' + SEAT_AB[2]], [2, SEAT_AB[1] + '-' + SEAT_AB[3]], [3, T('Both')]], v.vul)}</div>
   ${err ? `<div class="err">${err}</div>` : ''}
   <div class="row2"><button class="btn gold" id="dPlay">${T('Play this deal')}</button><button class="btn new" id="dWatch">🤖 ${T('Let the robots play it')}</button></div>
   <div class="muted">${T('Let the robots play it: the four hands are open, the robots bid and play slowly, and you watch. It does not count for your rating.')}</div>
   <div class="row2"><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
async function readPhoto(file) {
  readDealForm();
  ui.photoMsg = T("Reading the picture…"); ui.photoErr = false; ui.photoHands = null; showDealEntry();
  await new Promise(r => setTimeout(r, 30));
  try {
    const r = await Photo.read(file);
    const counts = r.hands.map((h, s) => SEAT[s] + ' ' + (h ? h.length : 0));
    const total = r.hands.reduce((a, h) => a + (h ? h.length : 0), 0);
    ui.dealForm.pbn = r.pbn; ui.dealForm.h = ["", "", "", ""]; ui.photoHands = r.hands;
    // the dealer (the seat in the black disc) and the vulnerability (the red triangles), when the picture shows them
    if (r.dealer != null) ui.dealForm.dealer = r.dealer; if (r.vul != null) ui.dealForm.vul = r.vul;
    const full = r.hands.filter(h => h && h.length === 13).length;
    ui.photoErr = full < 3;
    ui.photoMsg = (full >= 3 ? T('Read {0} cards ({1}). Check the code, then press Play this deal.', total, counts.join(', ')) : T('Only part of the deal could be read ({0}). Fix the code below before playing.', counts.join(', ')));
  } catch (e) { ui.photoErr = true; ui.photoMsg = e.message; }
  showDealEntry();
}
function readDealForm() {
  const v = ui.dealForm; if (!$('dPbn')) return v;
  v.pbn = $('dPbn').value; for (let s = 0; s < 4; s++) v.h[s] = $('dH' + s).value; return v;
}
function startEnteredDeal(watch) {
  const v = readDealForm();
  try {
    let hands = v.pbn.trim() ? parsePBN(v.pbn) : v.h.map(parseHand);
    if (!hands) throw new Error(T('Could not read the PBN code. It should look like N:AKQ2.K73.J5.T942 … with four hands.'));
    const used = new Set(), empty = [];
    hands.forEach((h, s) => { if (!h) { empty.push(s); return; } for (const c of h) { if (used.has(c)) throw new Error(T('The card {0} appears twice.', RTXT[R(c)] + SUIT[S(c)])); used.add(c); } });
    if (empty.length === 1) hands[empty[0]] = [...Array(52).keys()].filter(c => !used.has(c));
    else if (empty.length) throw new Error(T('Enter at least three hands.'));
    hands.forEach((h, s) => { if (h.length !== 13) throw new Error(T('{0} has {1} cards, it needs 13.', SEAT[s], h.length)); });
    let bn = 1; for (let b = 1; b <= 16; b++) if (dealerOf(b) === v.dealer && vulOf(b, 0) === (v.vul === 1 || v.vul === 3) && vulOf(b, 1) === (v.vul === 2 || v.vul === 3)) { bn = b; break; }
    ui.photoHands = null; ui.photoMsg = null; ui.dealForm = null;
    closeOv(); newBoard(hands, bn);
    if (watch) { G.watch = true; clearTimeout(timer); render(); tick(); flash('🤖 ' + T('The robots are playing this deal — watch'), 2500); }
  } catch (e) { showDealEntry(e.message); }
}

const kindOf = e => e.kind || (e.tour || e.tprac ? 't' : e.online ? 'o' : 'r');
const KIND_TIP = { t: 'Played in a tournament', o: 'Played at an online table', r: 'Played offline, with robots' };
const kindMark = e => { const k = kindOf(e), tip = T(KIND_TIP[k]) + (k === 't' && e.tn ? ': ' + e.tn : ''); return `<span class="kmark" title="${esc(tip)}">${k === 't' ? '🏆' : k === 'o' ? '🌐' : '🤖'}</span>`; };
function showResults() {
  const adm = typeof Net !== 'undefined' && Net.isAdmin();
  const per = Store.periods(HIST), isImp = SET.mode === 'IMP', tab = ui.resTab === 'robot' && !adm ? 'list' : ui.resTab;   // the robots' tab: the administrator only
  let body;
  if (tab === 'robot') {
    const rr = robotRating();
    const rows = RHIST.slice(-100).reverse().map(e => { const v = e.dd ? e.dd.norm : null, d = robotImp(e), k = e.normC ? conKey(e.normC) : null;
      const tr = k && e.fieldList ? e.fieldList.filter(t => t.k === k && t.t != null).map(t => t.t).join(' ') : '';
      return `<tr><td>${new Date(e.ts || 0).toLocaleDateString()}</td><td>${e.board}</td><td>${k || '…'}</td><td class="n">${tr || '…'}</td><td class="n">${v == null ? '…' : v}</td><td class="n">${d == null ? '' : `<b class="${d < 0 ? 'neg' : d > 0 ? 'pos' : ''}">${fmtSigned(Math.round(d * 10) / 10)}</b>`}</td></tr>`; }).join('');
    body = `<div class="okmsg">🤖 ${T('Robot rating')}: <b>${rr.n ? rr.rt : '—'}</b> · ${T('{0} boards', rr.n)}${rr.n ? ' · ' + fmtSigned(Math.round(rr.avg * 100) / 100) + ' IMP / ' + T('Bd') : ''}</div>
      <div class="muted">${T('The deals you let the robots play (they play them with every hand open, double dummy): not in your Results or your rating. The rating: the same deal is also played at four expert robot tables the normal way; their declarer\'s tricks against double dummy, in IMPs.')}</div>
      <div class="resscroll"><table class="res"><thead><tr><th>${T('Date')}</th><th>${T('Bd')}</th><th>${T('Contract')}</th><th class="n">${T('Tr')}</th><th class="n">DD</th><th class="n">IMP</th></tr></thead><tbody>${rows || `<tr><td colspan="6">${T('No deals given to the robots yet. Enter a deal, then Let the robots play it.')}</td></tr>`}</tbody></table></div>`;
  } else if (tab === 'stats') {
    body = `<div class="resscroll"><table class="res"><thead><tr><th>${T('Period')}</th><th class="n">${T('Boards')}</th><th class="n">IMP</th><th class="n">IMP/${T('Bd')}</th><th class="n">MP %</th><th class="n">${T('Points')}</th></tr></thead><tbody>${per.map(p => `<tr><td>${T(p.name)}</td><td class="n">${p.n}</td><td class="n">${p.scored ? fmtSigned(p.impSum) : "—"}</td><td class="n">${p.impAvg != null ? fmtSigned(p.impAvg) : "—"}</td><td class="n">${p.mpAvg != null ? p.mpAvg : "—"}</td><td class="n">${fmtSigned(p.pts)}</td></tr>`).join("")}</tbody></table></div>
     <div class="muted">${T('Every board is also played at 4 expert robot tables. IMP: your result against each table, averaged (cross-IMPs). MP: the percentage of the field you beat.')}</div>`;
  } else {
    const rows = HIST.slice(-100).reverse().map(e => `<tr class="rev" data-rev="${e.id}"><td>${kindMark(e)} ${new Date(e.ts || 0).toLocaleDateString()}${e.tn ? `<small class="rtn">${esc(e.tn)}</small>` : ''}</td><td>${e.board}</td><td>${e.passed ? T('Pass') : conKey(e.c)}</td><td>${e.passed ? '' : e.tricks}</td><td class="n">${fmtSigned(e.us || 0)}</td><td class="n">${e.imp == null ? "—" : fmtSigned(e.imp)}</td><td class="n">${e.mp == null ? "—" : e.mp + "%"}</td></tr>`).join('');
    body = `<div class="muted">${T('Tap a board to see the auction and how it was played.')}</div><div class="muted kkey">🏆 ${T('tournament')} · 🌐 ${T('online table')} · 🤖 ${T('offline')}</div><div class="resscroll"><table class="res"><thead><tr><th>${T('Date')}</th><th>${T('Bd')}</th><th>${T('Contract')}</th><th>${T('Tr')}</th><th class="n">${T('Score')}</th><th class="n">IMP</th><th class="n">MP</th></tr></thead><tbody>${rows || `<tr><td colspan="7">${T('No boards played yet.')}</td></tr>`}</tbody></table></div>`;
  }
  openOv('res', `<h2>${T('Results')}</h2><div class="seg" data-seg="restab"><button data-v="list" class="${tab === 'list' ? 'on' : ''}">${T('Board list')}</button><button data-v="stats" class="${tab === 'stats' ? 'on' : ''}">${T('Statistics')}</button>${adm ? `<button data-v="robot" class="${tab === 'robot' ? 'on' : ''}">🤖 ${T('Robots')}</button>` : ''}</div>${body}<div class="row2"><button class="btn" id="rPbn">💾 ${T('Save as PBN file')}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
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
    const tag = s === e.c.decl ? ' · ' + T('Decl') : s === pd(e.c.decl) ? ' · ' + T('Dummy') : '';
    return `<div class="h ${pos[rel_(s)]}${s === next ? ' turn' : ''}"><b>${SEAT[s]}${s === e.seat && !e.robot ? ' (' + T('you') + ')' : ''}${tag}</b>${ORDER.map(su => { const cs = E.desc(E.inSuit(left, su)); return `${symHtml(su)} ${cs.length ? cs.map(c => RTXT[R(c)]).join(' ') : '—'}`; }).join('<br>')}</div>`;
  };
  const mid = `<div class="rtrick" data-rs="next">${trick.map(([s, c]) => `<span class="rc ${pos[rel_(s)]}${s === w ? ' win' : ''}">${RTXT[R(c)]}${symHtml(S(c))}</span>`).join('')}</div>`;
  const tally = `${T('declarer')} ${t1}, ${T('defence')} ${t2}`;
  const status = k === 0 ? `${T('Opening lead')}: ${SEAT[next]}` : k >= n ? `${T('End of play')} · ${tally}${n < 52 ? ' · ' + T('the rest was claimed') : ''}`
    : `${T('Trick {0} of {1}', ti + 1, e.pl.length)} · ${tally}${w >= 0 ? ' · ' + T('won by {0}', SEAT[w]) : ''}`;
  return `<div class="deal replay">${[0, 1, 2, 3].map(hand).join('')}${mid}</div>
    <div class="rstat">${status}</div>
    <div class="rctl"><button class="btn" data-rs="first" ${k ? '' : 'disabled'}>⏮</button><button class="btn" data-rs="prev" ${k ? '' : 'disabled'}>◀</button>
      <button class="btn gold" data-rs="auto">${ui.revTimer ? T('Pause') : T('Play')}</button>
      <button class="btn" data-rs="next" ${k < n ? '' : 'disabled'}>▶</button><button class="btn" data-rs="last" ${k < n ? '' : 'disabled'}>⏭</button></div>`;
}
const revRec = () => ui.overlay === 'frev' ? ui.fRec : HIST.find(h => h.id === ui.revId);
function revStep(a) {
  const e = revRec(); if (!e || !e.pl) return;
  const n = e.pl.flat().length, k = ui.revStep || 0;
  if (a === 'auto') { if (ui.revTimer) stopRev(); else { if (k >= n) ui.revStep = 0; ui.revTimer = setInterval(() => { if ((ui.revStep || 0) >= n || ui.overlay !== 'rev' && ui.overlay !== 'frev') { stopRev(); return; } ui.revStep++; revDraw(); }, 900); } }
  else { stopRev(); ui.revStep = a === 'first' ? 0 : a === 'last' ? n : a === 'prev' ? Math.max(0, k - 1) : Math.min(n, k + 1); }
  revDraw();
}
function stopRev() { clearInterval(ui.revTimer); ui.revTimer = null; }
function revDraw() { const e = revRec(), el = $('revPlay'); if (e && el) el.innerHTML = revPlayHtml(e); }

/* a finished board from Results: the four hands, the auction (tap a call for its meaning) and every trick */
/* a finished board looked at again: the contract double dummy (worked out now in a worker when the board was left
   before it was ready) */
// the contract double dummy, shown large: how many tricks it takes with every hand open, and whether it makes
function ddBox(c, v) {
  const d = v == null ? null : v - (c.level + 6);
  const res = v === undefined ? `<span class="ddres">${T('calculating…')}</span>` : v === null ? `<span class="ddres">${T('not available')}</span>`
    : `<b class="ddn">${v}</b><span class="ddres">${T('{0} tricks', v).replace(String(v), '').trim()}</span><span class="ddchip ${d >= 0 ? 'ok' : 'no'}">${d >= 0 ? T('makes') + (d ? ' +' + d : '') : T('down {0}', -d)}</span>`;
  return `<div class="ddbox"><div class="ddhd">🎯 ${T('Your contract')} · ${T('double dummy')}</div><div class="ddrow"><span class="ddc">${conKey(c)}</span>${res}</div></div>`;
}
function revDdHtml(e) {
  if (!e.c || !e.deal) return '';
  const v = e.dd && e.dd.you;
  if (v == null && !(e.dd && e.dd.you === null)) {
    if (ui.revDd !== e.id) {
      ui.revDd = e.id;
      const got = t => { e.dd = { ...(e.dd || {}), you: t }; Store.saveRec(e); if (ui.overlay === 'rev' && ui.revId === e.id) showReview(e.id); };
      const w = Field.mk();
      if (w) { w.onmessage = m => { const d = m.data || {}; if (d.type === 'dd' || d.type === 'error') { w.terminate(); got(d.type === 'dd' ? d.t : null); } }; w.onerror = () => { w.terminate(); got(null); }; w.postMessage({ type: 'dd', id: e.id, key: 'you', deal: e.deal, c: e.c, limit: 1.2e8 }); }
      else setTimeout(() => got(E.ddContract(e.deal, e.c, 1.5e6)), 50);
    }
    return ddBox(e.c, undefined);
  }
  return v == null ? '' : ddBox(e.c, v);
}
function showReview(id, sel) {
  const e = HIST.find(h => h.id === id); if (!e) return;
  ui.revId = id; const hi = HIST.findIndex(h => h.id === id);
  const dealer = e.dealer != null ? e.dealer : dealerOf(e.board);
  const auc = (e.auc || []).map(([seat, call]) => ({ seat, call }));
  const cards = sideCards();
  auc.forEach((a, i) => { a.m = E.explainCall(auc.slice(0, i), a.seat, a.call, cards); });
  const aucHtml = e.auc
    ? `<div class="auction">${auctionTable(auc, false, { board: e.board, dealer, seat: e.seat, sel })}</div>` +
      (sel != null && auc[sel] ? `<div class="expl">${explHtml(auc[sel])}</div>` : `<div class="muted tap">${T('Tap a call to see what it means')}</div>`)
    : `<div class="muted">${T('The auction was not saved for this board (played before this feature was added).')}</div>`;
  const canPlay = e.pl && e.pl.length && e.c && e.deal;
  const playHtml = canPlay ? `<div class="grp"><span>${T("The play — tap ▶ (or the table) to play the next card")}</span><div id="revPlay">${revPlayHtml(e)}</div></div>`
    : (e.passed ? '' : `<div class="muted">${T('The play was not saved for this board (played before this feature was added).')}</div>`);
  openOv('rev', `<h2>${T('Board')} ${e.board}</h2><div class="big">${resultLine(e)}</div>
    ${revDdHtml(e)}
    ${canPlay ? '' : e.deal ? dealHtml(e.deal, e.seat) : ''}
    ${playHtml}
    ${anaHtml(e)}
    <div class="grp"><span>${T('Auction')}</span>${aucHtml}</div>
    <div class="row2"><button class="btn" data-revgo="-1" ${hi > 0 ? '' : 'disabled'}>◀ ${T('Previous deal')}</button><button class="btn" data-revgo="1" ${hi >= 0 && hi < HIST.length - 1 ? '' : 'disabled'}>${T('Next deal')} ▶</button></div>
    ${e.deal && !e.tour ? `<div class="row2">${e.champ ? "" : `<button class="btn" id="oRevReplay">🔁 ${T("Replay this deal")}</button>`}<button class="btn" id="oRevPbn">💾 PBN</button><button class="btn" id="oRevLin">💾 LIN</button></div>` : ""}
    ${rbNoteHtml(e)}
    <div class="row2"><button class="btn" id="oRevCopy">📋 ${T('Copy for analysis')}</button></div>
    <div class="row2"><button class="btn" id="oRevBack">${T('Back to the list')}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
/* one robot table of the board just played: how the robots bid it and played it, card by card */
function showFieldTable(i, sel) {
  const e = G && G.result, f = G && G.field, t = f && f.tables[i]; if (!e || !t || !t.pl) return;
  const rec = ui.fIdx === i && ui.fRec && ui.fRec.id === e.id ? ui.fRec : { id: e.id, board: e.board, seat: e.seat, deal: G.deal, c: t.c, tricks: t.tricks, us: sideOf(e.seat) === 0 ? t.ns : -t.ns, pl: t.pl, auc: t.auc, robot: true };
  ui.fIdx = i; ui.fRec = rec;
  const dealer = dealerOf(e.board), cards = sideCards();
  const auc = (t.auc || []).map(([seat, call]) => ({ seat, call }));
  auc.forEach((a, k) => { a.m = E.explainCall(auc.slice(0, k), a.seat, a.call, cards); });
  openOv('frev', `<h2>${T('Board')} ${e.board} · ${T('Robot tables')} ${i + 1}</h2><div class="big">${resultLine(rec)}</div>
    <div class="grp"><span>${T("The play — tap ▶ (or the table) to play the next card")}</span><div id="revPlay">${revPlayHtml(rec)}</div></div>
    <div class="grp"><span>${T('Auction')}</span><div class="auction">${auctionTable(auc, false, { board: e.board, dealer, seat: e.seat, sel })}</div>${sel != null && auc[sel] ? `<div class="expl">${explHtml(auc[sel])}</div>` : `<div class="muted tap">${T('Tap a call to see what it means')}</div>`}</div>
    <div class="row2"><button class="btn" id="oFtCopy">📋 ${T('Copy for analysis')}</button></div>
    <div class="row2"><button class="btn" id="oFtBack">◀ ${T('Back')}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
/* the boards played today, from the table: contract, result, score, IMPs and MP against the
   robot field, with the totals; tap a board to replay it */
function showHist() {
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const L = HIST.filter(e => (e.ts || 0) >= sod.getTime()).slice(-60);
  const sc = L.filter(e => e.imp != null), imp = Math.round(sc.reduce((a, e) => a + e.imp, 0) * 10) / 10;
  const mp = sc.length ? Math.round(sc.reduce((a, e) => a + e.mp, 0) / sc.length * 10) / 10 : null;
  const pts = L.reduce((a, e) => a + (e.us || 0), 0);
  const rows = L.slice().reverse().map(e => `<tr class="rev" data-rev="${e.id}" data-from="hist"><td>${e.board}</td><td>${e.passed ? T('Pass') : conKey(e.c)}</td><td>${e.passed ? '' : (e => { const d = e.tricks - (e.c.level + 6); return d >= 0 ? (d ? '+' + d : '=') : d; })(e)}</td><td class="n">${fmtSigned(e.us || 0)}</td><td class="n">${e.imp != null ? fmtSigned(e.imp) : '…'}</td><td class="n">${e.mp != null ? e.mp + '%' : '…'}</td></tr>`).join('');
  openOv('hist', `<h2>📜 ${T('History')}</h2><div class="muted">${T('Boards played today — tap one to see the hands, the auction and the play.')}</div>
    ${L.length ? `<div class="resscroll"><table class="res"><thead><tr><th>${T('Bd')}</th><th>${T('Contract')}</th><th></th><th class="n">${T('Score')}</th><th class="n">IMP</th><th class="n">MP</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3"><b>${T('Total')}</b> · ${L.length}</td><td class="n"><b>${fmtSigned(pts)}</b></td><td class="n"><b>${sc.length ? fmtSigned(imp) : '—'}</b></td><td class="n"><b>${mp != null ? mp + '%' : '—'}</b></td></tr></tfoot></table></div>`
      : `<div class="muted">${T('No boards yet today.')}</div>`}
    <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}

/* ================= events ================= */
// what you type as an alert is kept while the bidding box is redrawn
document.addEventListener('input', e => { if (e.target && e.target.id === 'alTxt') ui.alertTxt = e.target.value; if (e.target && e.target.id === 'plQ') { ui.plQ = e.target.value; ui.plFocus = 1; showPlayers(); } });
document.addEventListener('change', e => {
  if (e.target.dataset && e.target.dataset.plk) { const s = ui.plSel || (ui.plSel = new Set()), k = e.target.dataset.plk; if (e.target.checked) s.add(k); else s.delete(k); ui.plFocus = 0; showPlayers(); return; }
  const t = e.target;
  if (t.dataset.conv) {
    const k = t.dataset.conv, c = E.CONVS.find(y => y.k === k);
    SET.conv[k] = t.checked;
    if (t.checked && c && c.x) SET.conv[c.x] = false;
    if (!t.checked && pracList().includes(k)) SET.practice = pracList().filter(x => x !== k).join(',');   // taken off the card: no longer practised
    Store.saveSettings(SET); save(); if (ui.overlay === "set") showSettings(); else if (ui.overlay === 'cardconv') { render(); showCardConv(); } else render();
  }
  if (t.dataset.tinv != null && ui.tsel) { if (t.checked) ui.tsel.names.add(t.dataset.tinv); else ui.tsel.names.delete(t.dataset.tinv); return; }
  // your own player card: level, country and a few words, sent with your profile
  if (t.id === 'pSys') { setSys(t.value); Store.saveSettings(SET); save(); Net.shareInfo(); render(); showPlayer(myNm() || T('You')); return; }
  if (t.id === 'pClub') { SET.club = t.value.trim().replace(/\s+/g, ' ').slice(0, 24); Store.saveSettings(SET); save(); Net.shareInfo(); showPlayer(myNm() || T('You')); return; }
  if (t.id === 'pCline') { SET.cline = t.value.trim().slice(0, 300); Store.saveSettings(SET); save(); Net.shareInfo(); flash('✓', 800); return; }   // your convention line, written by hand
  if (t.id === 'pLvl' || t.id === 'pCtry') { SET[{ pLvl: 'lvl', pCtry: 'ctry' }[t.id]] = t.value; Store.saveSettings(SET); save(); Net.shareInfo(); showPlayer(myNm() || T('You')); return; }
  if (t.id === 'hLang') { SET.lang = t.value; SET.langAuto = false; applyLang(); Store.saveSettings(SET); save(); render(); return; }
  if (t.id === 'hSys') { setSys(t.value); Store.saveSettings(SET); save(); render(); flash(E.sysOf(t.value).n + ' — ' + T('your robot partner bids it too'), 2400); return; }
  if (t.id === 'hName') { try { localStorage.setItem('bridge-table-name', t.value.trim().slice(0, 20)); } catch (e) {} return; }
  if (t.id === 'dPhoto' && t.files && t.files[0]) { readPhoto(t.files[0]); t.value = ''; return; }
  if (t.id === 'dFile' && t.files && t.files[0]) { importDeals(t.files[0]); t.value = ''; return; }
  if (t.id === "hPracSel") { setPractice(t.value); render(); return; }
  if (t.id === "pdHint") { SET.pracHint = t.checked; Store.saveSettings(SET); save(); return; }
  if (t.dataset && t.dataset.wipek) { const s = ui.wipeSel || (ui.wipeSel = new Set()); if (t.checked) s.add(t.dataset.wipek); else s.delete(t.dataset.wipek); showWipe(); return; }
  // the two drop-downs on the home page: a base system (one), conventions to practise (any number)
  if (t.dataset.pdsys) { setSys(t.dataset.pdsys); Store.saveSettings(SET); save(); if (ui.pracDrop !== 'conv') ui.pracDrop = null; render(); flash(E.sysOf(SET.sys).n + ' — ' + T('your robot partner bids it too'), 2400); return; }
  if (t.dataset.pdconv) { togglePractice(t.dataset.pdconv, t.checked); render(); return; }
  if (t.dataset.pdoff) { SET.practice = ''; Store.saveSettings(SET); save(); render(); return; }
  if (t.id === "sPractice") { SET.practice = t.value; if (t.value) { SET.conv[t.value] = true; const c = E.CONVS.find(y => y.k === t.value); if (c && c.x) SET.conv[c.x] = false; } Store.saveSettings(SET); save(); showSettings(); }
});
document.addEventListener('click', ev_ => {
  // the ☰ menu closes after any tap outside its button (a menu item still does its job)
  if (ui.pracDrop && !ev_.target.closest('.prf')) { ui.pracDrop = null; setTimeout(render, 0); }   // a home drop-down closes after a tap outside it
  if (ui.menu && !ev_.target.closest('#bMenu')) { ui.menu = false; setTimeout(() => { if (G && G.phase !== 'idle') renderBar(); }, 0); }
  if (G && G.phase === "play" && ev_.target.closest("#center") && !ev_.target.closest("[data-c].play,button")) {
    if (G.play.history.length) { ui.showLast = !ui.showLast; clearTimeout(ui.lastTimer); if (ui.showLast) ui.lastTimer = setTimeout(() => { ui.showLast = false; render(); }, 4000); render(); }
    return;
  }
  // Results: open a finished board, tap its calls, or go back to the list
  const hsb = ev_.target.closest('[data-hsec]'); if (hsb && hsb.dataset.hsec === 'chat' && document.querySelector('.hchat')) { const c = document.querySelector('.hchat');   /* the new page has no chat beside it: the Lobby button opens it as a panel (below) */ if (c) c.scrollIntoView({ behavior: 'smooth', block: 'end' }); const i = $('lMsg'); if (i) setTimeout(() => i.focus(), 300); return; }
  if (hsb && hsb.closest('#ov')) closeOv();   // from the player card: close it and open the section
  if (hsb) { const v = hsb.dataset.hsec; ui.hsec = !v || ui.hsec === v ? null : v; render(); if (ui.hsec && hsb.classList.contains('prconv') && $('hSec')) $('hSec').scrollIntoView({ behavior: 'smooth', block: 'start' }); if (ui.hsec === 'chat') { const i = $('lMsg2'); if (i) i.focus(); } return; }
  const opb = ev_.target.closest('[data-open]'); if (opb) { closeOv(); ui.saved = null; Net.openTable(opb.dataset.open === 'priv'); return; }
  const ar = ev_.target.closest('[data-askr]'); if (ar) { const f = ui.askFin; ui.askFin = null; askClose(); if (f) f(ar.dataset.askr === '1'); return; }
  const cn = ev_.target.closest('[data-claimn]'); if (cn) { claimChosen(+cn.dataset.claimn); return; }
  const tp = ev_.target.closest('[data-tplay]'); if (tp) { playTour(tp.dataset.tplay); return; }
  const tbd = ev_.target.closest('[data-tbd]'); if (tbd) { ui.tbd = { id: tbd.dataset.tid, b: +tbd.dataset.tbd }; showStandings(tbd.dataset.tid); return; }
  const tpr = ev_.target.closest('[data-tprac]'); if (tpr) { practiceTour(tpr.dataset.tprac, 1); return; }
  // the administrator takes a player out of the lobby (they can come back); the player comes back
  { const ak = ev_.target.closest('[data-akick]'); if (ak) { const n = ak.dataset.akick; askYes(T('Take {0} out of the lobby? They can come back in.', n), () => { Net.adminKick(n); flash(T('{0} is out of the lobby.', n), 2500); }); return; } }
  // the same text in an SMS (iPhone and Android both read "sms:?&body=")
  if (ev_.target.closest('#convSms')) { location.href = 'sms:?&body=' + encodeURIComponent(convCardText()); return; }
  if (ev_.target.closest('#convWa')) { window.open('https://wa.me/?text=' + encodeURIComponent(convCardText()), '_blank', 'noopener'); return; }
  if (ev_.target.closest('#lobbyBack')) { closeOv(); Net.lobbyBack(); return; }
  if (ev_.target.closest('#fixCancel')) { const st = ui.fixSeat, c = ui.fixCard; ui.fixSeat = null; ui.fixCard = null; if (st != null && G && G.play && G.play.turn === st && E.legalFor(G.play, st).includes(c)) playCard(st, c); else { render(); tick(); } return; }
  if (ev_.target.closest('#yesOk')) { const f = ui.yesFn; ui.yesFn = null; closeOv(); if (f) f(); return; }
  const tsit = ev_.target.closest('[data-tsit]'); if (tsit) { const S = tourSeats(); S[tsit.dataset.tid] = +tsit.dataset.tsit; try { localStorage.setItem('bridge-tour-seats', JSON.stringify(S)); } catch (e) {} closeOv(); playTour(tsit.dataset.tid); return; }
  const tl = ev_.target.closest('[data-tlist]'); if (tl) { ui.ttab = tl.dataset.tlist; render(); return; }   // the tournament list's tabs
  const tt = ev_.target.closest('[data-ttab],[data-tjtab]'); if (tt) { if (tt.dataset.ttab) Net.openTourTable(tt.dataset.ttab); else Net.joinTourTable(tt.dataset.tjtab); return; }
  // a name in the players list (or a private message): write to that player privately
  const pmb = ev_.target.closest("[data-pm]"); if (pmb) { pmTo(pmb.dataset.pm); return; }
  if (ev_.target.closest("[data-pmx]")) { ui.pmTo = null; render(); renderDock(); return; }
  { const ls = ev_.target.closest("[data-lscope] button"); if (ls) { ui.lscope = ls.dataset.v; showLead(); return; } }
  if (ev_.target.closest("#lLead")) { showLead(); return; }
  function showLead() { openOv("lead", `<h2>🏅 ${T("Leaderboard")}</h2>${Net.leaderHtml(ui.lscope === "club") || `<div class="muted">${T("Nobody has a rating yet.")}</div>`}<div class="row2"><button class="btn gold" id="oClose">${T("Close")}</button></div>`); }
  { const av = ev_.target.closest("[data-av]"); if (av) { SET.av = av.dataset.av; Store.saveSettings(SET); save(); Net.shareInfo(); showPlayer(myNm() || T("You")); return; } }   // your picture
  { const pc = ev_.target.closest("div.pconv"); if (pc) { pc.classList.toggle("open"); return; } }   // the convention line on a card: tap to read it all
  { const gs = ev_.target.closest("[data-gsug]"); if (gs) { const i = $("gName"); if (i) i.value = gs.dataset.gsug; ui.gateErr = null; ui.gateSug = null; showGate(ui.gateRename); return; } }   // a free name offered on the name screen
  if (ev_.target.closest("[data-stats]")) { ui.statData = null; showStats(); return; }   // the administrator's visitor statistics
  const pw = ev_.target.closest('[data-who]'); if (pw) { showPlayer(pw.dataset.who); return; }
  const pwx = ev_.target.closest('[data-pairwith]'); if (pwx) { closeOv(); Net.playWith(pwx.dataset.pairwith); return; }
  const fr = ev_.target.closest('[data-friend]'); if (fr) { toggleFriend(fr.dataset.friend); showPlayer(fr.dataset.friend); render(); return; }
  const ka = ev_.target.closest('[data-kickask]'); if (ka) { const s = +ka.dataset.kickask, n = Net.st.names[s] || SEAT[s]; askYes(T('Remove {0} from the table? A robot plays the seat.', n), () => Net.kick(s)); return; }
  if (ev_.target.closest('#hNameBtn')) { showPlayer(myNm() || T('You')); return; }   // your name on the home page opens your card, where you change it
  { const an = ev_.target.closest("[data-ana]"); if (an) { const e = HIST.find(h => String(h.id) === an.dataset.ana); if (e) Ana.run(e); return; } }
  if (ev_.target.closest("#hDaily")) { const id = Net.dailyId(), t = Net.st.tours[id]; if (t && Object.keys(myTour(id)).length >= t.n) showStandings(id); else playTour(id); return; }
  if (ev_.target.closest('#hStats')) { showPlayer(myNm() || T('You')); return; }   // your own rating (the Results of this device)
  const dmb = ev_.target.closest('[data-dm]'); if (dmb) { showDm(dmb.dataset.dm); return; }
  const tq = ev_.target.closest('[data-tset],[data-tyes],[data-tno]'); if (tq) { if (tq.dataset.tset) { ui.tsel = null; showTourSetup(tq.dataset.tset); } else Net.tourAnswer(tq.dataset.tyes || tq.dataset.tno, !!tq.dataset.tyes); return; }
  // ✕ on a tournament (shown to its organiser only): cancel it for everyone
  const td = ev_.target.closest('[data-tdel]'); if (td) { const t = Net.st.tours[td.dataset.tdel]; if (!t) return; if (Net.isMine(t)) askYes(T("Cancel the tournament?"), () => { Net.tourCancel(t.id); render(); }); else if (Net.isAdmin()) askYes(T("Close this tournament for everyone?"), () => { Net.adminCloseTour(t.id); render(); }); return; }
  const ts = ev_.target.closest('[data-tstand]'); if (ts) { showStandings(ts.dataset.tstand); return; }
  const rv = ev_.target.closest('[data-rev]'); if (rv) { ui.revFrom = rv.dataset.from || 'res'; ui.revSel = null; ui.revStep = 0; stopRev(); showReview(rv.dataset.rev); return; }
  // previous / next deal in the replay
  const rg = ev_.target.closest('[data-revgo]'); if (rg) { const i = HIST.findIndex(h => h.id === ui.revId) + +rg.dataset.revgo; if (HIST[i]) { ui.revSel = null; ui.revStep = 0; stopRev(); showReview(HIST[i].id); } return; }
  const rs = ev_.target.closest('[data-rs]'); if (rs) { if (!rs.disabled) revStep(rs.dataset.rs); return; }
  const ri = ev_.target.closest('[data-ri]'); if (ri && ui.overlay === 'frev') { const i = +ri.dataset.ri; ui.revSel = ui.revSel === i ? null : i; showFieldTable(ui.fIdx, ui.revSel); return; }
  const ft = ev_.target.closest('[data-ftab]'); if (ft) { ui.revSel = null; ui.revStep = 0; stopRev(); showFieldTable(+ft.dataset.ftab); return; }
  if (ev_.target.closest('#oFtBack')) { stopRev(); showEnd(); return; }
  // our board and the robot table's (its contract, auction and tricks; the hands are the same), to paste for Claude
  if (ev_.target.closest('#oFtCopy') && ui.fRec) { const e = HIST.find(h => h.id === ui.fRec.id), rt = boardText(ui.fRec).split('\n').slice(1).filter(l => !/^[NESW]  /.test(l));
    const txt = (e ? boardText(e) + '\n\n' : '') + `Robot table ${ui.fIdx + 1}\n` + rt.join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => flash(T('Copied — paste it into your message'), 2500)).catch(() => prompt(T('Copy'), txt)); return; }
  if (ri) { const i = +ri.dataset.ri; showReview(ui.revId, ui.revSel === i ? null : i); ui.revSel = ui.revSel === i ? null : i; return; }
  if (ev_.target.closest('#oRevCopy')) { const e = HIST.find(h => h.id === ui.revId); if (e) { const txt = boardText(e); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => flash(T('Copied — paste it into your message'), 2500)).catch(() => { ui.copyTxt = txt; openOv('copy', `<h2>${T('Copy for analysis')}</h2><textarea class="tok copytxt" rows="12" readonly>${esc(txt)}</textarea><div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`); }); } return; }
  if (ev_.target.closest('#oRevBack')) { stopRev(); if (ui.revFrom === 'hist') showHist(); else { ui.resTab = 'list'; showResults(); } return; }
  const t = ev_.target.closest('button,[data-c],[data-ai],#toast,#dExpl'); if (!t) return;
  if (t.id === 'dExpl') { ui.lastExpl = null; ui.hintBid = null; render(); return; }
  if (t.id === 'toast') { if (ui.toastChat && G && G.phase !== 'idle') { ui.toastChat = false; ui.dockOpen = true; renderDock(); } ui.toast = null; render(); return; }   // a message: tap it to open the chat
  if (t.dataset.sit != null) { Net.sit(+t.dataset.sit); return; }
  // Start: you play with robots; your table shows in the lobby and others can ask to join (you accept)
  if (t.id === "pdProg") { SET.progOpen = !SET.progOpen; Store.saveSettings(SET); render(); return; }
  if (t.id === "pdWeak") { const w = pracWeak(); if (!w.length) return; SET.practice = ""; w.forEach(k => togglePractice(k, true)); flash("🎯 " + T("Practising {0}: the next deals use it", pracNames()), 2200); ui.pracDrop = null; Net.st.soloPub = true; closeOv(); resume(); return; }
  if (t.id === "pdPlay") { if (!pracList().length) { ui.pracDrop = "conv"; render(); return; } ui.pracDrop = null; Net.st.soloPub = true; closeOv(); resume(); return; }
  // Play offline: the title and the fan of cards start too
  if (t.id === "bGo" || t.id === "bGoTitle" || t.id === "bGoFan") { Net.st.soloPub = true; closeOv(); resume(); return; }
  if (t.id === 'pdSys' || t.id === 'pdConv') { const k = t.id === 'pdSys' ? 'sys' : 'conv'; ui.pracDrop = ui.pracDrop === k ? null : k; render(); return; }
  if (t.id === 'pdDone') { ui.pracDrop = null; render(); return; }
  if (t.id === 'hConvAsk') { showConvAsk(); return; }
  if (t.id === 'instGo') { instGo(); return; }
  if (t.id === 'welGo' || t.id === 'welClose') { welcomeClose(t.id === 'welGo'); return; }
  if (t.dataset.pldet) { ev_.preventDefault(); ui.plOpen = ui.plOpen === t.dataset.pldet ? null : t.dataset.pldet; showPlayers(); return; }
  if (t.id === 'admTog') { const N = Net; openOv('adm', `<h2>👑 ${T('Admin')}</h2><div class="admmenu"><button class="btn" data-stats="1">📊 ${T('Visitor statistics')}</button><button class="btn" id="admPlayers">👥 ${T('All players')}</button><button class="btn" id="hSupIn">📨 ${T('Messages')}${N.supNew ? ` <b class="supc">${N.supNew}</b>` : ''}</button><button class="btn" id="hConvReq">📥 ${T('Convention requests')}${N.cvNew ? ` <b class="supc">${N.cvNew}</b>` : ''}</button><button class="btn" id="hRoboErr">🤖 ${T('Robot mistakes')}</button><button class="btn" id="hLearn">📈 ${T('Learning report')}${ui.learnNew ? ` <b class="supc">${ui.learnNew}</b>` : ''}</button></div><div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`); return; }
  if (t.id === 'admPlayers') { ui.plList = null; ui.plSel = new Set(); ui.plQ = ''; ui.plFocus = 0; showPlayers(); return; }
  if (t.id === 'plDel') { playersDelete(); return; }
  if (t.dataset.plpin) { ev_.preventDefault(); playerPin(t.dataset.plpin); return; }
  if (t.dataset.plmsg) { ev_.preventDefault(); ui.supNm = t.dataset.plmsg; showSupThread(Net.fbKey(t.dataset.plmsg)); return; }
  if (t.id === 'ppGo') { playerPinGo(); return; }
  if (t.id === 'ppBack') { ui.plPinK = null; closeOv(); showPlayers(); return; }
  if (t.id === 'hSup') { showSup(); return; }
  if (t.id === 'hSupIn' && Net.isAdmin()) { Net.supInbox().then(L => { const u = L.filter(x => x.unread); if (u.length === 1) showSupThread(u[0].k); else showSupInbox(); }).catch(() => showSupInbox()); return; }
  if (t.id === 'hSupIn' || t.id === 'supBack') { showSupInbox(); return; }
  if (t.dataset.supdel) { const k = t.dataset.supdel, x = (ui.supList || []).find(y => y.k === k); askYes(T('Delete the conversation with {0}?', esc(x ? x.n : decodeURIComponent(k))), async () => { try { await Net.supDelete(k); } catch (e) { flash(T('Could not remove'), 2000); } showSupInbox(); }); return; }
  if (t.id === 'supSend') { sendSup(); return; }
  if (t.id === 'supReply') { sendSupReply(); return; }
  if (t.dataset.supk) { showSupThread(t.dataset.supk); return; }
  if (t.id === 'cvaSend') { sendConvAsk(); return; }
  if (t.id === 'hConvReq') { showConvRequests(); return; }
  if (t.id === 'cvCopy') { const txt = (ui.cvList || []).map(r => '# ' + r.ad + ' (' + (r.kim || '') + ', ' + new Date(r.ts).toLocaleDateString() + ')\n' + (r.acik || '') + (r.ornek ? '\n' + r.ornek : '')).join('\n\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => flash('📋 ' + T('Copied'), 1500)).catch(() => prompt(T('Copy'), txt)); return; }
  // beside Play offline: the conventions to practise open (the drop-down of the practice card, scrolled to)
  if (t.id === 'pdClose') { ui.pracOpen = 0; ui.pracDrop = null; render(); return; }
  if (t.id === 'bConvGo') { ui.pracOpen = 1; ui.pracDrop = 'conv'; render(); const p = $('hPrac'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (t.id === 'hRoboErr') { showRoboErrs(); return; }
  // the robots' table: open it, its tabs, a call's meaning, a board played before
  if (t.dataset.rtk) { if (t.dataset.rtopen) rtWatch(t.dataset.rtk); else { rtPick(t.dataset.rtk); rtDraw(); } return; }
  if (t.dataset.rtwatch) { rtWatch(RT.cur); return; }
  if (t.id === 'bRtAgain') { rtAgain(); return; }
  if (t.id === 'bRtNext') { rtNext(); return; }
  if (t.id === 'bRtSit') { rtSitPick(); return; }
  if (t.id === 'bTblScore') { Net.panel(); return; }
  if (t.id === 'bRtList') { rtOpen(G && G.rtv ? G.rtv.k : RT.cur); return; }
  if (t.dataset.rtsit != null) { rtSit(+t.dataset.rtsit); return; }
  if (t.dataset.rtt) { RT.tab = t.dataset.rtt; RT.view = null; RT.sel = null; rtDraw(); return; }
  if (t.dataset.rti != null) { RT.sel = +t.dataset.rti; rtDraw(); return; }
  if (t.dataset.rtb != null) { RT.view = +t.dataset.rtb < 0 ? null : +t.dataset.rtb; RT.sel = null; rtDraw(); return; }
  if (t.id === 'hLearn') { showLearn(); return; }
  if (t.id === 'chGo') { startChamp(); return; }
  if (t.id === 'hClubs') { ui.clubOpen = null; showClubs(); return; }
  if (t.dataset.clubopen != null) { ui.clubOpen = ui.clubOpen === t.dataset.clubopen ? null : t.dataset.clubopen; const c = ui.clubOpen; showClubs(); if (c) clubTaken(c).then(x => { (ui.clubTaken = ui.clubTaken || {})[c] = x.taken; if (ui.overlay === 'clubs') showClubs(); }); return; }
  if (t.dataset.clubmov) { closeOv(); openClubs('?club=' + encodeURIComponent(t.dataset.clubmov) + '&movement=1'); return; }
  if (t.dataset.clubscr) { closeOv(); openClubs('?club=' + encodeURIComponent(t.dataset.clubscr) + '&role=screen'); return; }
  if (t.dataset.clubres) { closeOv(); openClubs('?club=' + encodeURIComponent(t.dataset.clubres) + '&results=1'); return; }
  if (t.dataset.clubadmin) { closeOv(); openClubs('?club=' + encodeURIComponent(t.dataset.clubadmin) + '&role=admin'); return; }
  if (t.dataset.clubtn) { const [c, p, n] = t.dataset.clubtn.split('|'); closeOv(); openClubs('?club=' + encodeURIComponent(c) + '&role=table&p=' + p + '&tn=' + n); return; }
  // the online team match: a new tournament of the Team match type, set up at once
  if (t.id === 'olTeam') {
    const tt = Net.newTour(8), k = TOUR_KINDS.teams;
    Object.assign(tt, { kind: 'teams', format: k.set.format, n: k.set.n, scoring: k.set.scoring, hours: k.set.hours, name: (T('Online team match') + ' · ' + new Date().toLocaleDateString()).slice(0, 40) });
    while (tt.tables.length < 2) tt.tables.push(['', '', '', '']); tt.tables.length = 2;
    ui.tsel = null; ui.tsetTeam = tt.id; closeOv(); render(); showTourSetup(tt.id); return;   // its own setup: a team match only
  }
  if (t.id === 'wipeGo') { wipeGo(); return; }
  if (t.id === 'chShow') { showChamp(); return; }
  if (t.id === 'learnCopy') { const txt = JSON.stringify(ui.learnCopy || {}); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => flash(T('Copied — paste it into your message'), 2200)).catch(() => prompt(T('Copy'), txt)); return; }
  if (t.dataset.casys) { setSys(t.dataset.casys); Store.saveSettings(SET); save(); render(); showCardConv(); return; }
  if (t.id === 'caBack') { showCardSys(); return; }
  if (t.id === 'caDone') { closeOv(); render(); flash(E.sysOf(SET.sys).n + ' — ' + T('your robot partner bids it too'), 2400); checkSharedDeal(); setTimeout(installAsk, 800); return; }
  if (t.id === 'rbNoteSend') { const e = HIST.find(h => String(h.id) === t.dataset.id) || (G && G.result && String(G.result.id) === t.dataset.id ? G.result : null), txt = ($('rbNote') || {}).value || '';
    if (!e || txt.trim().length < 3) { flash(T('Write what the robot did wrong'), 2000); return; }
    t.disabled = true; Net.roboNote(e, txt.trim()).then(() => { flash('✅ ' + T('Sent to the robot mistakes'), 2500); if ($('rbNote')) $('rbNote').value = ''; }).catch(() => flash(T('Could not send — sign in with your name and PIN first.'), 2500)).finally(() => { t.disabled = false; }); return; }
  if (t.dataset.rbok) { rbFixed(t.dataset.rbok, t.dataset.v === '1').then(showRoboErrs).catch(() => flash(T('Could not save'), 2000)); return; }
  if (t.id === 'rbDelAll') { const P = (ui.rbAll || []).slice(); if (!P.length || !confirm(T('Delete all') + ' — ' + T('Robot mistakes') + ' (' + P.length + ')?')) return; Promise.all(P.map(x => rbDone(x))).then(() => { flash('🗑 ' + P.length, 1800); showRoboErrs(); }).catch(() => flash(T('Could not remove'), 2000)); return; }
  if (t.id === 'rbOld') { ui.rbOld = !ui.rbOld; showRoboErrs(); return; }
  if (t.id === 'rbSmall') { ui.rbSmall = !ui.rbSmall; showRoboErrs(); return; }
  if (t.id === 'rbShowOk') { ui.rbShowOk = !ui.rbShowOk; showRoboErrs(); return; }
  if (t.dataset.rbdone) { rbDone(t.dataset.rbdone).then(showRoboErrs).catch(() => flash(T('Could not remove'), 2000)); return; }
  if (t.id === 'rbCopy') { const txt = JSON.stringify(ui.rbList || []); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => flash(T('Copied — paste it into your message'), 2200)).catch(() => prompt(T('Copy'), txt)); return; }
  if (t.dataset.cvdone) { Net.convDone(t.dataset.cvdone).then(showConvRequests).catch(() => flash(T('Could not remove'), 2000)); return; }
  const sol = ev_.target.closest("[data-solo]"); if (sol) { Net.st.soloPub = sol.dataset.solo === "pub"; closeOv(); resume(); return; }
  const dtb = ev_.target.closest("[data-dtab]"); if (dtb) { ui.dockTab = dtb.dataset.dtab; renderDock(); return; }
  const dq = ev_.target.closest("[data-dq]"); if (dq) { dockSend(dq.dataset.dq); return; }
  if (t.id === "dSend") { const i = $("dMsg"); if (i) { dockSend(i.value); i.value = ""; } return; }
  if (t.id === "dClose") { ui.dockOpen = false; renderDock(); return; }
  // clear the chat shown in the panel on this device (the lobby chat stays cleared; the table chat until new messages)
  if (t.id === "dClear") { if (online() && (ui.dockTab || "table") === "table") { Net.st.chat.length = 0; Net.st.unread = 0; renderDock(); } else Net.lclear(); return; }
  if (t.id === "chatBtn" || t.id === "bChat") { ui.menu = false; toggleDock(); renderBar(); return; }
  if (t.id === "bStart") { if (online() && !guest() && G.phase === "lobby") { Net.note((Net.st.names[SET.seat] || "Host") + " started the game"); if (Net.st.tour) tableBoard(); else newBoard(); } return; }
  if (t.dataset.ai != null) { ui.lastExpl = ui.lastExpl === +t.dataset.ai ? null : +t.dataset.ai; ui.hintBid = null; if (ui.overlay === 'auc') showAuction(); else render(); return; }
  if (t.dataset.lvl) { ui.selLvl = +t.dataset.lvl; renderBidbox(); return; }
  if (t.dataset.call != null && G.phase === 'bid' && bidTurn() === U()) { const v = t.dataset.call; const c = (v === 'P' || v === 'X' || v === 'XX') ? v : +v; if (c !== -1) { const al = ui.alertOn ? (ui.alertTxt || '').trim() || T('Alert') : null; ui.alertOn = false; ui.alertTxt = ''; makeCall(U(), c, undefined, al); } return; }
  if (t.dataset.c != null && t.classList.contains('play')) { const c = +t.dataset.c; const seat = G.play.turn; if (G.play.hands[seat].includes(c)) playCard(seat, c); return; }
  if (t.closest('.seg') && ui.overlay !== 'sb') {   // social bridge handles its own (social.js)
    const seg = t.closest('.seg').dataset.seg, v = t.dataset.v;
    if (seg === 'lang') { SET.lang = v; SET.langAuto = false; applyLang(); Store.saveSettings(SET); save(); render(); return; }
    if (seg === 'sys') { setSys(v); Store.saveSettings(SET); save(); if (ui.overlay === 'set') showSettings(); else render(); flash(E.sysOf(v).n + ' — ' + T('from the next deal'), 2200); return; }
    if (ui.overlay === 'tsetup' && ['tn', 'tformat', 'ttables', 'tscoring', 'thours', 'tkind', 'tclub'].includes(seg)) {
      readTourSeats(); const t = Net.st.tours[ui.tsetId]; if (!t) return;
      // a tournament type fills in the options at once (they can still be changed one by one)
      if (seg === 'tkind') { const k = TOUR_KINDS[v]; t.kind = v; if (k.set) { Object.assign(t, { format: k.set.format, n: k.set.n, scoring: k.set.scoring, hours: k.set.hours }); if (k.set.tables) { while (t.tables.length < k.set.tables) t.tables.push(['', '', '', '']); t.tables.length = k.set.tables; if (!t.tables[0][0]) t.tables[0][0] = t.by; } } }
      if (seg === 'tformat' && t.kind === 'teams' && v !== 'tables') t.kind = 'custom';
      if (seg === 'tclub') t.club = v ? SET.club || '' : '';
      if (seg === 'tn') t.n = +v; if (seg === 'tscoring') t.scoring = v; if (seg === 'thours') t.hours = +v;
      if (seg === 'tformat') { t.format = v; if (v === 'tables' && !t.tables.length) t.tables = [[Net.st.tours[ui.tsetId].by, '', '', '']]; }
      if (seg === 'ttables') { const n = +v; while (t.tables.length < n) t.tables.push(['', '', '', '']); t.tables.length = n; }
      showTourSetup(ui.tsetId); return;
    }
    if (seg === 'restab') { ui.resTab = v; showResults(); return; }
    if (seg === 'learnd') { ui.learnDays = +v; showLearn(); return; }
    if (seg === 'chtab') { ui.chTab = v; showChamp(); return; }
    if (seg === 'chper') { ui.chPer = v; showChamp(); return; }
    if (seg === "stattab") { ui.statTab = v; showStats(); return; }
    if (seg === "gmode") { ui.gateMode = v; ui.gateErr = null; ui.gateSug = null; showGate(ui.gateRename); return; }
    if (seg === 'ddealer' || seg === 'dvul') { readDealForm(); ui.dealForm[seg === 'ddealer' ? 'dealer' : 'vul'] = +v; showDealEntry(); return; }
    if (seg === "seat" && online()) { flash("Close the online table before changing your seat", 2000); return; }
    if (seg === "seat") SET.seat = +v; if (seg === 'speed') SET.speed = +v; if (seg === 'rlvl') SET.robotLvl = v; if (seg === 'expl') SET.expl = v === '1'; if (seg === 'auto') SET.auto = v === '1'; if (seg === 'fixbot') SET.fixBot = v === '1';
    if (seg === 'alert') { SET.alert = v; if (v !== 'off') beep(); }
    if (seg === 'notify') { setNotify(v === '1'); return; }
    if (seg === 'four') SET.four = v === '1'; if (seg === 'felt') SET.felt = v; if (seg === 'back') SET.back = v;
    if (seg === 'sfx') { SET.sfx = v === '1'; sfx('card'); } if (seg === 'theme') SET.theme = v; if (seg === 'big') SET.big = v === '1';
    if (seg === "style") SET.style = v; if (seg === 'homev') SET.homeV = v;
    if (seg === "mode") SET.mode = v; if (seg === 'opp') SET.opp = v;
    Store.saveSettings(SET); save(); showSettings(); render(); return;
  }
  switch (t.id) {
    case "bNew": case "oNext2":
      if (G && G.ct) { ctGoNext(); break; }   // a club table: the next board of the round, or the next round
      if (G && G.tour && !guest()) { if (G.phase === 'done') nextTourBoard(); else flash(T('Finish this tournament board first'), 2000); break; }
      if (guest()) { if (G.phase === "done") Net.send({ t: "next" }); else Net.askNewDeal(); break; }
      if (online() && (G.phase === "bid" || G.phase === "play")) {
        const humans = [...new Set([0, 1, 2, 3].map(s => Net.owner(s)))].filter(o => o && o !== "robot" && o !== "host");
        if (humans.length) {
          flash(T("Asked the other players for a new deal"), 2000);
          Net.askOwners(humans, { kind: "nd", who: Net.st.names[SET.seat] || T("Host") }).then(ok => { if (ok) newBoard(); else flash(T("The other players said no"), 2200); });
          break;
        }
      }
      if (t.id === "oNext2" || G.phase === "done" || ui.confirmNew > Date.now()) { ui.confirmNew = 0; newBoard(); }
      else { ui.confirmNew = Date.now() + 3000; renderBar(); setTimeout(renderBar, 3100); }
      break;
    case 'bAuc': showAuction(); break;
    case 'oShow': showEnd(); break;
    case 'bHint':
      if (G.pz && G.pz.first) { flash('🧩 ' + T('No hints in the puzzle'), 1800); break; }
      if (guest() && G.phase === "play") { if (userControls(G.play.turn) && G.play.trick.length < 4) Net.send({ t: "hint" }); break; } // the host works it out
      if (G.phase === 'bid' && bidTurn() === U()) { ui.hintBid = E.aiBid(G.auction, U(), G.deal[U()], G.cards); SET.expl = true; render(); }
      else if (G.phase === 'play' && userControls(G.play.turn) && G.play.trick.length < 4) { ui.hintCard = E.aiPlay(G.play, G.play.turn); render(); }
      break;
    case "bClaim": claim(); break;
    case "bUndo": {
      if (G && G.ct) break;   // a club table: no taking back
      if (online() && !guest()) { requestUndo("host", Net.st.names[SET.seat] || "Host", SET.seat).then(ok => { if (ok === false) flash(T("Nothing to take back, or the other side said no"), 1800); }); break; }
      if (guest()) { undo(); break; }
      if (canFix()) { if (UNDO.some(u => u.by === 'robotfix')) askYes(T("Take back the robot's card?"), fixUndo); else fixUndo(); break; }
      flash('🤖 ' + T('The robots do not accept an undo'), 1800); break;
    }
    case "sDeal": showDealEntry(); break;
    case "dPlay": startEnteredDeal(); break;
    case "dWatch": startEnteredDeal(true); break;
    case "dExpl": ui.lastExpl = null; ui.hintBid = null; render(); break;
    case "bHelp": case "bHelp2": showHelp(); break;
    case "bHist": showHist(); break;
    case "bMenu": ui.menu = !ui.menu; renderBar(); break;
    case "bLeave": askYes(T("Leave the table?"), goHome); break;   // playing alone with robots: back to a fresh home page
    case "bAlert": ui.alertOn = !ui.alertOn; renderBidbox(); if (ui.alertOn) setTimeout(() => { const i = $('alTxt'); if (i) i.focus(); }, 30); break;
    // the turn sound on and off from the top bar
    case "bBell": { const on = (SET.alert || "online") !== "off"; if (on) { SET.alertOn = SET.alert || "online"; SET.alert = "off"; SET.sfxOn = SET.sfx; SET.sfx = false; } else { SET.alert = SET.alertOn || "online"; SET.sfx = SET.sfxOn !== false; beep(); } Store.saveSettings(SET); save(); render(); flash(on ? "🔕 " + T("Turn sound off") : "🔔 " + T("Turn sound on"), 1400); break; }
    case "bSet": showSettings(); break;
    case 'bShareApp': openOv('share', `<h2>📲 ${T('Send the app')}</h2><div class="muted">${T('Whoever opens the link can install Bridge Table as an app.')}</div>
      <div class="row2"><button class="btn wa" id="shareWa">${ICON_WA} WhatsApp</button><button class="btn sms" id="shareSms">${ICON_SMS} SMS</button></div>
      <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`); break;
    case 'shareWa': closeOv(); window.open('https://wa.me/?text=' + encodeURIComponent(appInvite()), '_blank', 'noopener'); break;
    // an SMS with the text filled in (iPhone and Android both read "sms:?&body=")
    case 'shareSms': closeOv(); location.href = 'sms:?&body=' + encodeURIComponent(appInvite()); break;
    case 'bRes': ui.resTab = 'list'; ui.menu = false; showResults(); break;
    case 'bHome': goHome(); break;
    case 'hWatch': Net.quickWatch(); break;
    case 'hOpen': showOpenChoice(); break;
    case 'lSend': { const i = $('lMsg'); if (i && i.value.trim()) { lobbySend(i.value); i.value = ""; } break; }
    case 'lSend2': { const i = $('lMsg2'); if (i && i.value.trim()) { lobbySend(i.value); i.value = ""; } break; }
    case 'lClear': Net.lclear(); break;
    case 'dmSend': { const i = $('dmMsg'); if (i && i.value.trim() && ui.dmWith) { Net.dmSend(ui.dmWith, i.value); i.value = ''; showDm(ui.dmWith); } break; }
    case 'lFab': showLChat(); break;
    case 'oClose': closeOv(); break;
    case 'sReset': if (typeof Net !== 'undefined' && Net.isAdmin()) showWipe(); break;   // the administrator only: whose history
    case "sSave": { const v = ($("syncToken") || {}).value; if (v) { GitSync.setToken(v); syncState.msg = ""; syncNow(); showSettings(); } break; }
    case "sNow": syncNow(); break;
    case "sOff": GitSync.setToken(null); syncState.msg = ""; showSettings(); break;
    case "oNext": if (guest()) { Net.send({ t: "next" }); closeOv(); } else if (G && G.tour) { closeOv(); nextTourBoard(); } else newBoard(); break;
    case 'tNew': { const t = Net.newTour(8); ui.tsel = null; render(); showTourSetup(t.id); break; }
    case 'tAddBtn': { const i = $('tAdd'), v = i && i.value.trim().slice(0, 20); if (v && ui.tsel) { ui.tsel.names.add(v); showTourSetup(ui.tsetId); } break; }
    case 'tSend': { readTourSeats(); const t = Net.st.tours[ui.tsetId]; const names = t && t.format === 'tables' ? [].concat(...t.tables).filter(n => n && n.toLowerCase() !== (myNm() || '').toLowerCase()) : [...((ui.tsel && ui.tsel.names) || [])]; if (!names.length) { ui.tsetMsg = { no: 1, txt: t && t.format === 'tables' ? T('Nobody to invite: write the players\' names at the tables (robots take the empty seats). To play with robots only, tap Start the tournament.') : T('Pick at least one player') }; showTourSetup(ui.tsetId); break; }
      Net.tourInvite(ui.tsetId, names); ui.tsetMsg = { txt: '✉️ ' + T('Invitations sent: {0}. Players in the lobby now see them at once; their answers show above (✓).', names.join(', ')) }; showTourSetup(ui.tsetId); break; }
    case 'tGo': { readTourSeats(); const id = ui.tsetId, t = Net.st.tours[id]; Net.tourStart(id); closeOv(); flash(T('The tournament has started'), 2000); render();
      // you can start alone: robots take the empty seats; at tables, your own table opens at once
      if (t && t.format === 'tables') { const me = Net.myTourSeat(t); if (me && me.seat === me.hostSeat) Net.openTourTable(id); } else if (t) playTour(id);
      break; }
    case 'tCancel': Net.tourCancel(ui.tsetId); closeOv(); render(); break;
    case "oReplay": case "oReplayP": closeOv(); replayDeal(); break;
    case "bTheme": case "bTheme2": { SET.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; Store.saveSettings(SET); save(); applyLook(); ui.menu = false; render(); if (ui.overlay === "set") showSettings(); break; }
    case "gGo": gateGo(); break;
    case "sRefresh": ui.statData = null; showStats(); break;
    case "sLogout": askYes(T('Log out? You can sign in again with your name and PIN, or choose another name.'), async () => {
      if (online()) { flash(T('Close the online table first'), 2000); return; }
      await Net.goOffline();   // off the online list at once
      // this player's things are put away under the name; the device starts fresh for the next one
      acctStash(SET.pinFor || Net.nameKey(myNm()));
      try { localStorage.removeItem('bridge-table-name'); } catch (e) {}
      acctLoad(null); SET.pinH = null; SET.pinFor = null; Store.saveSettings(SET); save();
      location.reload();   // the lobby, friends and messages are read again for nobody
    }); break;
    case "pRename": showGate(true); break;
    case "oShared": { const d = ui.sharedDeal; ui.sharedDeal = null; closeOv(); if (d) { ui.saved = null; newBoard(d.hands, d.b); } break; }
    case "oShare": if (G && G.deal) shareDeal(G.deal, G.board); break;
    // a board from Results dealt again (same cards and number); its old result stays in the list. A board being played is left only after a yes
    case "oRevReplay": { const e = HIST.find(h => h.id === ui.revId); if (!e || !e.deal) break; const go = () => { stopRev(); closeOv(); newBoard(e.deal, e.board); };
      if (G && (G.phase === "bid" || G.phase === "play")) askYes(T("Leave the current board?"), go); else go(); break; }
    case "oRevPbn": case "oRevLin": { const e = HIST.find(h => h.id === ui.revId); if (e && e.deal) { if (t.id === "oRevPbn") saveFile(`bridge-board-${e.board}.pbn`, '% PBN 2.1\n' + pbnOf(e)); else saveFile(`bridge-board-${e.board}.lin`, linOf(e)); } break; }
    case "rPbn": exportPBN(HIST.filter(e => !e.tour)); break;
  }
});
$('ov').addEventListener('click', e => { if (e.target.id === 'ov') closeOv(); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && /^g(Name|Pin|Pin2)$/.test(e.target.id)) { e.preventDefault(); gateGo(); return; } if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.id === 'dMsg') { e.preventDefault(); const v = e.target.value; e.target.value = ''; dockSend(v); return; } if (e.key === 'Enter' && e.target && e.target.id === 'dmMsg') { e.preventDefault(); $('dmSend').click(); return; } if (e.key === 'Enter' && e.target && e.target.id === 'tAdd') { e.preventDefault(); $('tAddBtn').click(); return; } if (e.key === 'Enter' && !e.shiftKey && e.target && (e.target.id === 'lMsg' || e.target.id === 'lMsg2') && e.target.value.trim()) { e.preventDefault(); lobbySend(e.target.value); e.target.value = ""; } });
window.addEventListener('resize', () => { layoutFans(); clearTimeout(ui.rsz); ui.rsz = setTimeout(() => { if (G && G.phase !== 'idle') render(); }, 150); });   // the dummy's card size follows the window height

/* ---- a deal as a link: 2 bits a card (who holds it) make 13 bytes, 18 letters in the address after #d= ---- */
/* a played board as plain text (hands, auction, every trick, the double-dummy result), to paste into a message about
   the robots' play */
function boardText(e) {
  const SL = ['C', 'D', 'H', 'S'], RK = '23456789TJQKA', N = ['N', 'E', 'S', 'W'];
  const cd = c => SL[S(c)] + RK[R(c)];
  const hand = h => [3, 2, 1, 0].map(s => SL[s] + ':' + h.filter(c => S(c) === s).sort((a, b) => b - a).map(c => RK[R(c)]).join('')).join(' ');
  const dealer = e.dealer != null ? e.dealer : dealerOf(e.board), v = [vulOf(e.board, 0), vulOf(e.board, 1)];
  const out = [`Bridge Table v${APP_V} · Board ${e.board} · Dealer ${N[dealer]} · Vul ${v[0] && v[1] ? 'All' : v[0] ? 'NS' : v[1] ? 'EW' : 'None'} · Me: ${N[e.seat]}`];
  if (e.c) { const won = e.tricks != null ? e.tricks : e.pl ? e.pl.filter(t => t.length === 4).filter(t => sideOf(E.trickWinner(t.map(([s, c]) => ({ s, c })), e.c.strain < 4 ? e.c.strain : -1)) === sideOf(e.c.decl)).length : null;
    out.push(`Contract ${e.c.level}${'CDHSN'[e.c.strain]}${e.c.dbl === 1 ? 'X' : e.c.dbl === 2 ? 'XX' : ''} by ${N[e.c.decl]}` + (won != null ? ` · ${won} tricks` : '') + (e.dd && e.dd.you != null ? ` · double dummy ${e.dd.you}` : '')); }
  if (e.deal) e.deal.forEach((h, s) => out.push(`${N[s]}  ${hand(h)}`));
  if (e.auc) out.push('Auction: ' + e.auc.map(([s, call]) => `${N[s]}:${call === 'P' ? 'P' : call === 'X' ? 'X' : call === 'XX' ? 'XX' : LV(call) + 'CDHSN'[ST(call)]}`).join(' '));
  if (e.pl) e.pl.forEach((t, i) => out.push(`Trick ${i + 1}: ` + t.map(([s, c]) => `${N[s]}:${cd(c)}`).join(' ')));
  return out.join('\n');
}
function dealCode(deal) {
  const a = new Uint8Array(13);
  deal.forEach((h, s) => h.forEach(c => { a[c >> 2] |= s << ((c & 3) * 2); }));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function dealFromCode(code) {
  try {
    const b = atob(code.replace(/-/g, '+').replace(/_/g, '/')); if (b.length !== 13) return null;
    const h = [[], [], [], []]; for (let c = 0; c < 52; c++) h[(b.charCodeAt(c >> 2) >> ((c & 3) * 2)) & 3].push(c);
    return h.every(x => x.length === 13) ? h : null;
  } catch (e) { return null; }
}
// send a deal to a friend: the phone's share sheet, or the link is copied
function shareDeal(deal, board) {
  const url = 'https://servetsvm.github.io/bridge/#d=' + dealCode(deal) + '&b=' + board, text = T('How would you play this deal?');
  if (navigator.share) { navigator.share({ title: T('Bridge Table'), text, url }).catch(() => {}); return; }
  (navigator.clipboard ? navigator.clipboard.writeText(text + ' ' + url) : Promise.reject()).then(() => flash(T('Link copied'), 1500)).catch(() => prompt(T('Copy link'), url));
}
// the app was opened from a shared deal: offer to play it (the link is taken out of the address)
/* the welcome: what the site is for, in a few lines. Shown once, on a player's first visit (after the name and PIN); not over a shared deal, an invitation or a board in play. */
function welcome() {
  if (SET.welNo || (SET.welN || 0) >= 1 || ui.welDone || ui.overlay || (G && G.phase !== 'idle')) return;
  ui.welDone = 1; SET.welN = (SET.welN || 0) + 1; Store.saveSettings(SET);
  openOv('welcome', `<h2 class="welh">♠<i>♥</i><i>♦</i>♣ ${T('Welcome to Bridge Table')}</h2>
    <div class="welmain"><span>📚</span><div><b>${T('Practise conventions')}</b><small>${T('Pick the conventions you want to learn: the robots deal hands where they come up, and after each board you see which of your calls were right.')}</small></div></div>
    <div class="row2"><button class="btn new" id="welGo">📚 ${T('Choose conventions')}</button><button class="btn" id="welClose">${T('Close')}</button></div>`);
}
function welcomeClose(go) {
  if ($('welNo') && $('welNo').checked) { SET.welNo = 1; Store.saveSettings(SET); }
  closeOv();
  if (go) { ui.pracOpen = 1; ui.pracDrop = 'conv'; render(); const p = $('hPrac'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
// the WhatsApp logo and an SMS speech bubble for the buttons that send a message
const ICON_WA = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41z"/></svg>';
const ICON_SMS = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 2.8h16A2.2 2.2 0 0 1 22.2 5v10.2a2.2 2.2 0 0 1-2.2 2.2H9.6L5 21.2v-3.8H4a2.2 2.2 0 0 1-2.2-2.2V5A2.2 2.2 0 0 1 4 2.8z"/><text x="12" y="12.9" font-size="7.4" font-weight="900" text-anchor="middle" fill="currentColor" font-family="Arial,Helvetica,sans-serif">SMS</text></svg>';
// a link tapped while Bridge Table is already open only changes the address's # part (no reload): read it then too
window.addEventListener('hashchange', () => { if (/[#&](bg|sb|d)=/.test(location.hash)) checkSharedDeal(); });
function checkSharedDeal() {
  // an organiser's link from before (a club tournament #bg=club.prefix, or a Social bridge game #sb=CODE)
  const g = location.hash.match(/[#&]bg=([\w%-]+)\.(\d{2})/), sg = location.hash.match(/[#&]sb=([A-Z0-9]{4,12})(?:&t=(\d{1,2}))?/);
  if (g) {   // an older club link with a code: Table No finds the game anyway
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    flash('🃏 ' + T('Table No'), 2500); return;
  }
  // a Social bridge table's own link: that game opens with the table chosen
  const s = sg;
  if (s && typeof SB !== 'undefined') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} SB.openLink(s[1], +s[2] || 0); return; }
  const m = location.hash.match(/[#&]d=([\w-]{18})(?:&b=(\d+))?/); if (!m) { welcome(); return; }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  const hands = dealFromCode(m[1]); if (!hands) return;
  ui.sharedDeal = { hands, b: Math.min(16, Math.max(1, +m[2] || 1)) };
  openOv('shared', `<h2>🔗 ${T('A shared deal')}</h2><div class="muted">${T('Someone sent you this deal. Play it with robots, then compare.')}</div>
    <div class="row2"><button class="btn new" id="oShared">${T('Play this deal')}</button><button class="btn" id="oClose">${T('Not now')}</button></div>`);
}

/* ================= boot ================= */
// the fast solver (js/dds.js) is loaded after the app has started, so the first screen does not wait for it; once it is
// in, the page uses it and every worker made from now on has it (the robots' worker, if it is not thinking, is made again)
function ddsReady() {
  Field.src = null; Field.init();
  if (Bot.w && !Bot.wait) { Bot.w.terminate(); Bot.w = null; } else if (Bot.w) Bot.stale = true;
}
function start(data) {
  load(data && data.G ? data : null);
  Field.init();
  // the app opens on a quiet start screen: nothing is dealt until you press Start (a board in progress is kept for it)
  // an unfinished board (bidding or play) waits for "Play with robots" to carry on
  ui.saved = G && G.id !== 'idle' && (G.phase === 'bid' || G.phase === 'play') ? G : null;
  G = idleG(); render();
  { const kq = new URLSearchParams(location.search).get('kulup');
    if (kq != null) { try { history.replaceState(null, '', location.pathname); } catch (e) {} openClubs(kq); }
    const go = () => { if (typeof Net === "undefined") { setTimeout(go, 50); return; } if (kq != null) return; if (needGate()) showGate(); else checkSharedDeal(); }; setTimeout(go, 0); }   // once net.js is loaded too
  Store.initCloud(mergeCloud);
  syncNow(true);
  window.addEventListener("online", () => syncNow(true));
  // installable/offline app when served from a normal web address
  if ('serviceWorker' in navigator && document.querySelector('link[rel=manifest]') && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname)) {
    /* a new version: switched to at a quiet moment — not in the middle of bidding or play, not at an online table (the
       others would lose the table), not with a window open (a message being written); the game in progress is kept.
       While the app stays open it looks for a new version every ten minutes and whenever it comes back to the screen,
       so players who never close it get updates too. */
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false, want = false;
    const quiet = () => !(typeof Net !== 'undefined' && Net.st && Net.st.on) && !ui.overlay && (!G || G.rtv || !['bid', 'play'].includes(G.phase));
    const go = () => { if (want && !reloaded && quiet()) { reloaded = true; save(); location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) { want = true; go(); } });
    setInterval(go, 15000);
    const look = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
    navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
    setInterval(look, 10 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { look(); go(); } });
  }
}
window.claude?.hot?.snapshot?.(() => ({ SET, G, HIST, BOARD }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
// with nobody else in the lobby there is no tournament sync to wait for: check the running tournaments a little after opening
setTimeout(() => { if (typeof Net !== 'undefined' && !Net.st.tourResumed) { Net.st.tourResumed = true; tourResume(); } }, 9000);
/* a phone or PC notification while the app is in the background (Settings → Notifications): join requests,
   messages, invitations and your turn at an online table. It needs the app open somewhere: a closed app gets nothing */
function notify(text) {
  if (SET.notify === false || !document.hidden || !text || !('Notification' in window) || Notification.permission !== 'granted') return;
  const o = { body: text, icon: 'icons/icon-192.png', tag: 'bridge-table', renotify: true };
  try {
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(T('Bridge Table'), o) : new Notification(T('Bridge Table'), o)).catch(() => {});
    else new Notification(T('Bridge Table'), o);
  } catch (e) {}
}
function setNotify(on) {
  if (!on) { SET.notify = false; Store.saveSettings(SET); save(); showSettings(); return; }
  if (!('Notification' in window)) { flash(T('This browser cannot show notifications'), 2500); return; }
  Notification.requestPermission().then(p => {
    SET.notify = p === 'granted'; Store.saveSettings(SET); save(); showSettings();
    if (p !== 'granted') flash(T('Notifications are blocked — allow them in the browser settings'), 3500);
  }).catch(() => {});
}
// notifications are on unless switched off: the browser's question comes once, with the first tap after the name
document.addEventListener('pointerdown', function askNotify() {
  if (!myNm() || SET.notify === false || SET.notifyAsked || !('Notification' in window)) return;
  document.removeEventListener('pointerdown', askNotify);
  SET.notifyAsked = 1; Store.saveSettings(SET); save();
  if (Notification.permission === 'default') Notification.requestPermission().then(p => { if (p === 'denied') { SET.notify = false; Store.saveSettings(SET); save(); } }).catch(() => {});
});
/* private messages in the lobby chat: tap a player's name, the next message goes only to them (✕ ends it) */
function pmTo(name) {
  ui.pmTo = name; Net.st.dmUnread[Net.nameKey ? Net.nameKey(name) : name.toLowerCase()] = 0;
  for (const k in Net.st.dms) if (Net.st.dms[k].name.toLowerCase() === name.toLowerCase()) Net.st.dmUnread[k] = 0;
  if (G && G.phase !== 'idle') { ui.dockOpen = true; ui.dockTab = 'lobby'; renderDock(); }
  else { const c = document.querySelector('.hchat'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'end' }); }
  render();
  setTimeout(() => { const i = ['dMsg', 'lMsg2', 'lMsg'].map($).find(x => x && x.offsetParent); if (i) i.focus(); }, 50);
}
function lobbySend(text) {
  text = String(text || '').trim(); if (!text) return;
  if (champLive()) { flash(T('The lobby chat is closed while you play in the championship.'), 2600); return; }
  if (ui.pmTo) Net.dmSend(ui.pmTo, text); else Net.lsend(text);
  // the new home page: the lobby panel closes once the message is sent (a reply lights the Lobby button)
  if (ui.hsec === 'chat' && document.body.classList.contains('homev2')) { ui.hsec = null; flash('✓ ' + T('Message sent'), 1500); }
  render(); renderDock();
}
/* ---- your name and PIN: nothing can be done before a name is chosen, and every name gets a 4-digit PIN (old
   players too). A name in use by someone else is refused. With the online database the PIN also lets you take
   your name to another phone or PC. ---- */
async function pinHash(name, pin) {
  const b = new TextEncoder().encode('bridge-table:' + Net.nameKey(name) + ':' + pin);
  const h = await crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(h)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join('');
}
const needGate = () => typeof Net !== 'undefined' && (!myNm() || !SET.pinH || SET.pinFor !== Net.nameKey(myNm()));
function showGate(rename) {
  ui.gateRename = !!rename;
  { let r = null; try { r = localStorage.getItem('bridge-removed'); localStorage.removeItem('bridge-removed'); } catch (e) {} if (r) ui.gateErr = T('The name {0} was removed by the administrator. Choose a name to play.', r); }
  const mode = ui.gateMode || 'new';
  const keep = id => $(id) ? $(id).value : '';
  const nm = $('gName') ? keep('gName') : rename ? '' : myNm();
  const sug = ui.gateSug && ui.gateSug.length ? `<div class="gsug">${T('Free names:')} ${ui.gateSug.map(s => `<button class="btn mini-btn" data-gsug="${esc(s)}">${esc(s)}</button>`).join(' ')}</div>` : '';
  openOv('gate', `<h2>👋 ${T(rename ? 'Change your name' : 'Welcome!')}</h2>
    <div class="seg gmode" data-seg="gmode"><button data-v="new" class="${mode === 'new' ? 'on' : ''}">🆕 ${T("I'm new here")}</button><button data-v="login" class="${mode === 'login' ? 'on' : ''}">🔑 ${T('I have a name')}</button></div>
    <div class="muted">${T(mode === 'new' ? 'Choose a name nobody uses yet and a 4-digit PIN. With the name and the PIN you can sign in on another phone or PC too.' : 'Write your name and your PIN.')}</div>
    <div class="grp"><span>${T('Name')}</span><input id="gName" class="tok" maxlength="20" value="${esc(nm)}" autocomplete="nickname"></div>
    <div class="grp"><span>${T('PIN (4 digits)')}</span><input id="gPin" class="tok gpin" inputmode="numeric" pattern="[0-9]*" maxlength="4" type="password" autocomplete="off" value="${esc(keep('gPin'))}"></div>
    ${mode === 'new' ? `<div class="grp"><span>${T('PIN again')}</span><input id="gPin2" class="tok gpin" inputmode="numeric" pattern="[0-9]*" maxlength="4" type="password" autocomplete="off" value="${esc(keep('gPin2'))}"></div>` : ''}
    ${ui.gateErr ? `<div class="err">${esc(ui.gateErr)}</div>` : ''}${sug}
    <div class="row2"><button class="btn new" id="gGo">${T(mode === 'new' ? 'Continue' : 'Sign in')}</button>${rename ? `<button class="btn" id="oClose">${T('Cancel')}</button>` : ''}</div>`);
  setTimeout(() => { const i = $(nm ? 'gPin' : 'gName'); if (i) i.focus(); }, 50);
}
async function gateGo() {
  const mode = ui.gateMode || 'new';
  const name = ($('gName') ? $('gName').value : '').trim().replace(/\s+/g, ' ').slice(0, 20), pin = $('gPin') ? $('gPin').value : '', pin2 = $('gPin2') ? $('gPin2').value : pin;
  const err = (m, sug) => { ui.gateErr = m; ui.gateSug = sug || null; showGate(ui.gateRename); };
  if (name.length < 2) return err(T('Write a name of at least 2 letters.'));
  if (['player', 'guest', 'robot', 'you', 'host'].includes(Net.nameKey(name))) return err(T('Choose another name.'));
  if (!/^\d{4}$/.test(pin)) return err(T('The PIN is 4 digits.'));
  if (mode === 'new' && pin !== pin2) return err(T('The two PINs are not the same.'));
  ui.gateErr = T('Checking…'); ui.gateSug = null; showGate(ui.gateRename);
  const h = await pinHash(name, pin);
  if (mode === 'new') {
    // a new player: the name must be free; if it is taken, say so and offer free names close to it
    const r = await Net.register(name, h);
    if (r === 'taken') return err(T('The name {0} is already taken. Please choose another name.', name), await Net.suggestNames(name));
    if (!ui.gateRename) ui.askCard = true;   // a new player chooses a system first
  } else {
    const r = await Net.login(name, h);
    if (r === 'nouser') return err(T('Nobody has the name {0} yet. Choose "I\'m new here" to take it.', name));
    if (r === 'pin') return err(T('Wrong PIN for {0}.', name));
    if (r === 'offline') return err(T('The online database could not be reached.'));
  }
  // another name is another player (also from "Change your name"): the one signed in now has their things put away
  // under their own name, and the new name starts with its own (it used to take the results along, so a test name
  // came into the leaderboard with someone else's boards)
  let back = false, switched = false;
  if (ui.gateRename && myNm() && Net.nameKey(name) !== Net.nameKey(myNm())) {
    if (online()) return err(T('Close the online table first'));
    acctStash(SET.pinFor || Net.nameKey(myNm())); acctLoad(null); switched = true;
  }
  // a name used on this device before: that player's results, settings, friends and messages come back
  if (!ui.gateRename || switched) { try { back = !!localStorage.getItem(acctKey(Net.nameKey(name))); } catch (e) {} }
  const own = back;
  if (back) { acctLoad(Net.nameKey(name)); try { localStorage.removeItem(acctKey(Net.nameKey(name))); } catch (e) {} }
  // a name new to this device always starts with a clean page: whatever is still here from someone else (left by an
  // older version's log-out) is put aside on the device, not lost, and not added to this account
  else if (!ui.gateRename && HIST.length) { acctStash('_kept' + Date.now()); acctLoad(null); back = true; }
  // a new player's card is empty until they choose: no base system, no conventions (it used to be the app's 2/1 with
  // every convention on, which looked like the administrator's card)
  if (mode === 'new' && (!ui.gateRename || switched) && !own) { SET.sys = 'none'; SET.conv = Object.fromEntries(E.CONVS.map(c => [c.k, false])); SET.practice = ''; SET.cardV = 1; Store.saveSettings(SET); save(); }
  gateDone(name, h, back || switched);   // another player: the page is read again for them
}
// the administrator removed this device's name: signed out, with nothing of that name kept here; the name screen says why
function nameRemoved(name) {
  try { localStorage.removeItem('bridge-table-name'); localStorage.setItem('bridge-removed', String(name).slice(0, 20)); } catch (e) {}
  acctLoad(null); SET.pinH = null; SET.pinFor = null; Store.saveSettings(SET); save();
  location.reload();
}
function gateDone(name, h, back) {
  try { localStorage.setItem('bridge-table-name', name); } catch (e) {}
  SET.pinH = h; SET.pinFor = Net.nameKey(name); Store.saveSettings(SET); save();
  if (back) { location.reload(); return; }
  ui.gateErr = null; ui.gateSug = null; ui.overlay = null; $('ov').hidden = true;
  Net.st.claimed = true; Net.shareInfo(); Net.Cloud.beat(); render();
  SET.cloudSet = 0; Net.cloudSync();   // your results and settings from your other devices
  flash(T('Welcome, {0}!', name), 2000);
  if (ui.askCard) { ui.askCard = false; showCardSys(); return; }
  checkSharedDeal();
  setTimeout(installAsk, 800);   // a new player who came through a shared link: install the app now?
}
// drag the small window by its top bar
document.addEventListener('pointerdown', e => {
  const bar = e.target.closest('.fbar'); if (!bar || e.target.closest('button')) return;
  const s = bar.parentElement, r = s.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
  // a centred window starts moving from where it is
  if (getComputedStyle(s).position !== "fixed") Object.assign(s.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", margin: "0" });
  bar.setPointerCapture(e.pointerId);
  const move = ev => {
    const x = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)), y = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy));
    s.style.left = x + "px"; s.style.top = y + "px"; s.style.right = "auto"; if (s.classList.contains("fsheet")) ui.fpos = { x, y };
  };
  const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
  bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
});
/* sizes you set by dragging: the lobby chat column, the chat panel at the table, the players list beside the chat and
   the small card window; kept on this device */
const SIZES = (() => { try { return JSON.parse(localStorage.getItem('bridge-sizes') || '{}') || {}; } catch (e) { return {}; } })();
function applySizes() {
  const r = document.documentElement.style;
  if (SIZES.chatw) r.setProperty('--chatw', SIZES.chatw + 'px');
  if (SIZES.dockw) r.setProperty('--dockw', SIZES.dockw + 'px');
  if (SIZES.plw) r.setProperty('--plw', SIZES.plw + 'px');
}
applySizes();
const saveSizes = () => { try { localStorage.setItem('bridge-sizes', JSON.stringify(SIZES)); } catch (e) {} };
document.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-grip]'); if (!g) return;
  e.preventDefault(); g.setPointerCapture(e.pointerId); g.classList.add('drag');
  const k = g.dataset.grip, box = g.parentElement;
  const move = ev => {
    const R = box.getBoundingClientRect();
    if (k === 'chatw') SIZES.chatw = Math.round(Math.max(300, Math.min(Math.min(900, innerWidth - 420), R.right - ev.clientX)));
    else if (k === 'dockw') SIZES.dockw = Math.round(Math.max(280, Math.min(Math.min(900, innerWidth - 480), R.right - ev.clientX)));
    else if (k === 'plw') SIZES.plw = Math.round(Math.max(80, Math.min(R.width - 150, ev.clientX - R.left)));
    applySizes(); layoutFans();
  };
  const up = () => { g.classList.remove('drag'); g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); saveSizes(); if (G && G.phase !== 'idle') render(); };
  g.addEventListener('pointermove', move); g.addEventListener('pointerup', up);
});
// the card window keeps the size you give it by dragging its lower right corner (only then is it remembered)
document.addEventListener('pointerdown', e => {
  const s = e.target.closest && e.target.closest('.fsheet'); if (!s) return;
  const r = s.getBoundingClientRect(); if (r.right - e.clientX > 22 || r.bottom - e.clientY > 22) return;
  const up = () => { document.removeEventListener('pointerup', up); SIZES.fw2 = Math.round(s.offsetWidth); SIZES.fh2 = Math.round(s.offsetHeight); saveSizes(); };
  document.addEventListener('pointerup', up);
});
/* ---- the administrator's visitor statistics: today, the last 7, 30 and 365 days, by country (once per internet address) ---- */
/* "Add a convention": a player describes a convention the robots do not know; the request goes to the administrator,
   and it is then added to the robots' bidding (and to the list above) */
/* ---- writing to the administrator: the player's thread, and the administrator's inbox ---- */
function supMsgsHtml(m, mine) {
  if (!m.length) return `<div class="muted">${T('No messages yet.')}</div>`;
  return `<div class="supmsgs" id="supMsgs">${m.map(x => {
    const own = mine ? x.by === 'p' : x.by === 'a', who = x.by === 'p' ? '' : x.by === 'auto' ? '🤖 ' : '👑 ';
    const txt = x.by === 'auto' && x.cv ? T('Thank you for your convention request: {0}. It will be added to the robots soon, and you will get a message here when it is ready.', '<b>' + esc(x.t) + '</b>') : x.by === 'auto' ? T('Thank you! Your message will be answered as soon as possible.') : esc(x.t);
    return `<div class="supm ${own ? 'own' : ''} ${x.by}"><div>${who}${txt.replace(/\n/g, '<br>')}</div><small>${new Date(x.ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</small></div>`;
  }).join('')}</div>`;
}
const supBox = (id, ph) => `<textarea id="${id}" class="tok wide" rows="3" maxlength="1000" placeholder="${ph}"></textarea>`;
// the player: their messages to the administrator and the answers
async function showSup() {
  openOv('sup', `<h2>✉️ ${T('Write to the administrator')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`);
  let th = null, err = '';
  try { th = await Net.supThread(); } catch (e) { err = e.message === 'offline' ? T('No internet connection — try again later.') : T('Could not send — sign in with your name and PIN first.'); }
  if (ui.overlay !== 'sup') return;
  openOv('sup', `<h2>✉️ ${T('Write to the administrator')}</h2>
    <div class="muted">${T('A question, a wish or a problem? Only the administrator reads this. The answer appears here and on the home page.')}</div>
    ${err ? `<div class="err">${err}</div>` : supMsgsHtml(th.m, true)}
    ${err ? '' : supBox('supTxt', T('Write your message…'))}
    <div class="row2">${err ? '' : `<button class="btn new" id="supSend">📨 ${T('Send')}</button>`}<button class="btn" id="oClose">${T('Close')}</button></div>`);
  const b = $('supMsgs'); if (b) b.scrollTop = b.scrollHeight;
  if (th) Net.supRead();
}
async function sendSup() {
  const t = ($('supTxt') && $('supTxt').value || '').trim();
  if (t.length < 2) { flash(T('Write your message…'), 1800); return; }
  try { await Net.supSend(t); await showSup(); }
  catch (e) { flash(e.message === 'offline' ? T('No internet connection — try again later.') : T('Could not send — sign in with your name and PIN first.'), 3000); }
}
// the administrator: every player who wrote, the newest first; unread ones marked
async function showSupInbox() {
  if (!Net.isAdmin()) return;
  openOv('supin', `<h2>📨 ${T('Messages')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`);
  let L = []; try { L = await Net.supInbox(); } catch (e) {}
  if (ui.overlay !== 'supin') return;
  ui.supList = L;
  const row = x => `<div class="suprow${x.unread ? '' : ' read'}"><button class="supth${x.unread ? ' new' : ''}" data-supk="${esc(x.k)}"><b>${x.unread ? '🔵 ' : ''}${esc(x.n)}</b>
      <span>${x.last.by === 'auto' && x.last.cv ? '📥 ' : x.last.by === 'auto' ? '🤖 ' : x.last.by === 'a' ? '👑 ' : ''}${esc(x.last.by === 'auto' && !x.last.cv ? T('Thank you! Your message will be answered as soon as possible.') : x.last.t).slice(0, 90)}</span>
      <small>${new Date(x.last.ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</small><em class="supgo">💬 ${T('Reply')} ›</em></button><button class="btn mini-btn supdel" data-supdel="${esc(x.k)}" title="${T('Delete the conversation')}">🗑</button></div>`;
  const U = L.filter(x => x.unread), Rd = L.filter(x => !x.unread);
  openOv('supin', `<h2>📨 ${T('Messages')}</h2>
    ${L.length ? U.map(row).join('') + (Rd.length ? `<div class="supsep">${T('Read')}</div>` + Rd.map(row).join('') : '') : `<div class="muted">${T('No messages yet.')}</div>`}
    <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
async function showSupThread(k) {
  if (!Net.isAdmin()) return;
  ui.supK = k;
  openOv('supth', `<h2>📨 ${T('Messages')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`);
  let th = null; try { th = await Net.supThread(k); } catch (e) {}
  if (ui.overlay !== 'supth') return;
  if (th && !th.n && ui.supNm && Net.fbKey(ui.supNm) === k) th.n = ui.supNm;
  openOv('supth', `<h2>📨 ${esc(th && th.n || '')}</h2>
    ${th ? supMsgsHtml(th.m, false) : `<div class="err">${T('The online database could not be reached.')}</div>`}
    ${th ? supBox('supRe', T('Your answer…')) : ''}
    <div class="row2">${th ? `<button class="btn new" id="supReply">📨 ${T('Send')}</button><button class="btn" data-supdel="${esc(k)}">🗑 ${T('Delete the conversation')}</button>` : ''}<button class="btn" id="supBack">← ${T('Messages')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
  const b = $('supMsgs'); if (b) b.scrollTop = b.scrollHeight;
  if (th) Net.supRead(k);
}
async function sendSupReply() {
  const t = ($('supRe') && $('supRe').value || '').trim(); if (t.length < 1 || !ui.supK) return;
  try { const nm = ui.supNm && Net.fbKey(ui.supNm) === ui.supK ? ui.supNm : ''; await Net.supReply(ui.supK, t, nm); await showSupThread(ui.supK); } catch (e) { flash(T('The online database could not be reached.'), 2500); }
}
function showConvAsk(err) {
  openOv('convask', `<h2>➕ ${T('Add a convention')}</h2>
    <div class="muted">${T('Describe a convention the robots do not play yet. Your request goes to the administrator, and it is added to the robots and to the list.')}</div>
    <div class="grp"><span>${T('Name of the convention')}</span><input id="cvaName" class="tok wide" maxlength="40" placeholder="${T('e.g. Puppet Stayman')}"></div>
    <div class="grp"><span>${T('How does it work?')}</span><textarea id="cvaHow" class="tok wide" rows="5" maxlength="1000" placeholder="${T('When is it used, what does each bid mean, how does partner answer?')}"></textarea></div>
    <div class="grp"><span>${T('An example auction (optional)')}</span><input id="cvaEx" class="tok wide" maxlength="300" placeholder="1NT – 3♣ – 3♦ …"></div>
    ${err ? `<div class="err">${err}</div>` : ''}
    <div class="row2"><button class="btn new" id="cvaSend">📨 ${T('Send')}</button><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
async function sendConvAsk() {
  const ad = ($('cvaName').value || '').trim(), how = ($('cvaHow').value || '').trim(), ex = ($('cvaEx').value || '').trim();
  if (ad.length < 2 || how.length < 10) { flash(T('Write the name and how it works'), 2200); return; }
  try { await Net.convAsk(ad, how, ex); closeOv(); flash('✅ ' + T('Thank you! Your request was sent to the administrator.') + ' ' + T('The answer comes in your messages (✉️).'), 4000); }
  catch (e) { const keep = [ad, how, ex]; showConvAsk(e.message === 'offline' ? T('No internet connection — try again later.') : T('Could not send — sign in with your name and PIN first.')); $('cvaName').value = keep[0]; $('cvaHow').value = keep[1]; $('cvaEx').value = keep[2]; }
}
async function showConvRequests() {
  if (!Net.isAdmin()) return;
  openOv('convreq', `<h2>📥 ${T('Convention requests')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`);
  let L = []; try { L = await Net.convRequests(); } catch (e) {}
  if (ui.overlay !== 'convreq') return;
  SET.cvSeen = Date.now(); Store.saveSettings(SET); Net.st.cvNew = 0; ui.cvList = L;
  openOv('convreq', `<h2>📥 ${T('Convention requests')}</h2>
    <div class="muted">${T('Ask Claude to add these conventions to the robots; then remove them from the list.')}</div>
    ${L.length ? L.map(r => `<div class="cvreq"><div class="cvh"><b>${esc(r.ad)}</b><small>${esc(r.kim || '')} · ${new Date(r.ts).toLocaleDateString()}</small></div>
      <div class="cvb">${symText(esc(r.acik))}</div>${r.ornek ? `<div class="cvx">${symText(esc(r.ornek))}</div>` : ''}
      <button class="btn mini-btn" data-cvdone="${esc(r.path)}">✓ ${T('Done — remove')}</button></div>`).join('') : `<div class="muted">${T('No requests yet.')}</div>`}
    <div class="row2">${L.length ? `<button class="btn new" id="cvCopy">📋 ${T('Copy all')}</button>` : ''}<button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
/* the robots' mistakes (administrator): each board where a robot's card gave away tricks double dummy, with the
   cards; copied for Claude, who improves the robots, and then removed */
async function showRoboErrs() { return inTurkish(showRoboErrs0); }
async function showRoboErrs0() {
  if (!Net.isAdmin()) return;
  // read again after a removal: the list stays where it was (no "Loading…" in between, which sent it to the top)
  if (ui.overlay !== 'roboerr') openOv('roboerr', `<h2>🤖 ${T('Robot mistakes')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`);
  let L = []; try { L = await Net.roboErrs(); } catch (e) {}
  L = L.concat(await rtErrs()).sort((a, b) => b.ts - a.ts);   // the robots' table's too
  if (ui.overlay !== 'roboerr') return;
  L = L.filter(r => r.kind !== 'bid');   // the bidding lessons are in the learning report
  // the mistakes from before the last robot fix (a system table's: played by the robots of then) leave the list
  // (a system table's mistake without the time it was played: from before that time was kept, so from before the fix)
  const when = r => String(r.path).startsWith('rt:') ? (r.g || 0) : r.ts;
  const nOld = L.filter(r => when(r) < ROBOT_FIX_AT).length; if (!ui.rbOld) L = L.filter(r => when(r) >= ROBOT_FIX_AT);
  ui.rbAll = L.map(r => r.path);
  // the records marked fixed are hidden (a toggle shows them) and never copied for Claude
  const nOk = L.filter(r => r.ok).length; if (!ui.rbShowOk) L = L.filter(r => !r.ok);
  ui.rbList = L.filter(r => !r.ok);
  for (const r of L) r.er = (r.er || []).filter(x => x[0] > 0);   // a note has no card of its own
  // only the cards that cost two tricks or more (a toggle shows every one); a board left with none drops out (a note stays)
  if (!ui.rbSmall) { for (const r of L) r.er = r.er.filter(x => x[4] >= 2); L = L.filter(r => r.er.length || r.not); ui.rbList = ui.rbList.filter(r => L.includes(r)); }
  const n = L.reduce((a, r) => a + (r.er || []).length, 0);
  // who made it: the player's partner or an opponent (records from before the seat was kept: not known), declarer or defence
  const mine = (r, x) => r.me != null && sideOf(x[1]) === sideOf(r.me), theirs = (r, x) => r.me != null && sideOf(x[1]) !== sideOf(r.me);
  const role = (r, x) => [mine(r, x) ? T('partner') : theirs(r, x) ? T('opponent') : '', sideOf(x[1]) === sideOf(r.c[3]) ? T('declarer') : T('defence')].filter(Boolean).join(', ');
  const all = L.flatMap(r => (r.er || []).map(x => [r, x]));
  const sum = p => { const m = all.filter(([r, x]) => p(r, x)); return `${m.length} (${T('{0} tricks', m.reduce((a, [, x]) => a + x[4], 0))})`; };
  const split = all.some(([r]) => r.me != null) ? `<div class="okmsg">🤝 ${T('partner')}: ${sum(mine)} · ⚔️ ${T('opponent')}: ${sum(theirs)}</div>` : '';
  const nd = L.reduce((a, r) => a + (r.er || []).filter(x => sideOf(x[1]) === sideOf(r.c[3])).length, 0);
  // the summary: the opening lead, the declarer's side, the defence (after the lead): how many cards, how many tricks
  const isLead = (r, x) => x[0] === 1 && x[1] === (r.c[3] + 1) % 4, tk = a => a.reduce((t, [, x]) => t + x[4], 0);
  const gLead = all.filter(([r, x]) => isLead(r, x)), gDecl = all.filter(([r, x]) => sideOf(x[1]) === sideOf(r.c[3])), gDef = all.filter(([r, x]) => sideOf(x[1]) !== sideOf(r.c[3]) && !isLead(r, x));
  const summary = all.length ? `<div class="okmsg">📊 Özet · ilk atak <b>${gLead.length}</b> (${tk(gLead)} levée) · deklaran <b>${gDecl.length}</b> (${tk(gDecl)}) · savunma <b>${gDef.length}</b> (${tk(gDef)})</div>` : '';
  openOv('roboerr', `<h2>🤖 ${T('Robot mistakes')}</h2>
    <div class="muted">${T('Cards the robots played that gave away tricks (double dummy). Copy them for Claude to improve the robots; then remove them.')}</div>
    ${nOld ? `<div class="row2"><button class="btn mini-btn" id="rbOld">${ui.rbOld ? 'Son düzeltmeden öncekileri gizle' : `Son düzeltmeden (${new Date(ROBOT_FIX_AT).toLocaleDateString()}) önceki ${nOld} el gizli — göster`}</button></div>` : ''}
    <div class="row2"><button class="btn mini-btn" id="rbSmall">${ui.rbSmall ? 'Sadece 2+ levée kaybettirenler' : 'Hepsini göster (1 levée dahil)'}</button></div>
    ${summary}
    ${nOk ? `<div class="row2"><button class="btn mini-btn" id="rbShowOk">${ui.rbShowOk ? T('Hide the fixed ones') : '✔ ' + T('Fixed: {0} (hidden) — show', nOk)}</button></div>` : ''}
    ${L.length ? `<div class="okmsg">${T('{0} boards', L.length)} · ${T('declarer')} ${nd} · ${T('defence')} ${n - nd}</div>${split}<div class="row2"><button class="btn gold" id="rbCopy">📋 ${T('Copy all for Claude')}</button></div>` : ''}
    ${ui.rbAll.length ? `<div class="row2"><button class="btn" id="rbDelAll">🗑 ${T('Delete all')} (${ui.rbAll.length})</button></div>` : ''}
    ${L.length > 150 ? `<div class="muted">İlk 150 el gösteriliyor (toplam ${L.length}); kopyalama hepsini alır.</div>` : ''}
    ${L.length ? L.slice(0, 150).map(r => `<div class="cvreq"><div class="cvh"><b>${T('Board')} ${r.b} · ${r.c[0] ? conKey({ level: r.c[0], strain: r.c[1], dbl: r.c[2], decl: r.c[3] }) : T('Pass')}</b><small>${esc(r.kim || '')} · ${new Date(r.ts).toLocaleString()}</small>${r.ok ? ` <b class="pos">✔ ${T('Fixed')}</b>` : ''}</div>
      ${r.not ? `<div class="cvb">📝 ${esc(r.not)}</div>` : ''}
      ${(r.er || []).map(x => `<div class="anarow">${T('Trick {0}', x[0])} · ${SEAT[x[1]]} (${role(r, x)}): ${cardH(x[2])} → ${cardH(x[3])} ${r.u ? `<b class="pos">✍️ ${T('player')}</b>` : `<b class="pos">+${x[4]}</b>`}</div>`).join('')}
      <button class="btn mini-btn" data-rbok="${esc(r.path)}" data-v="${r.ok ? 0 : 1}">${r.ok ? '↩ ' + T('Not fixed') : '✔ ' + T('Fixed')}</button> <button class="btn mini-btn" data-rbdone="${esc(r.path)}">✓ ${T('Remove')}</button></div>`).join('') : `<div class="muted">${T('No mistakes recorded yet.')}</div>`}
    <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
// the robots' table's mistakes (every card of its boards checked double dummy by the job): shown with the players'
// ones; Remove, Fixed and Delete all hide them on this device
const RT_HIDE = 'bridge-rt-hide';
// the last robot fix (set with each one): the mistakes played before it leave the list by themselves
const ROBOT_FIX_AT = Date.parse('2026-11-13T20:35:01Z');
const rtHidden = () => { try { return new Set(JSON.parse(localStorage.getItem(RT_HIDE) || '[]')); } catch (e) { return new Set(); } };
function rtHide(path) { const h = rtHidden(); h.add(path); try { localStorage.setItem(RT_HIDE, JSON.stringify([...h].slice(-2000))); } catch (e) {} return Promise.resolve(); }
async function rtErrs() {
  try {
    const L = (await Promise.all(RT_KEYS.map(k => rtGet('errors-' + k + '.json')))).flat().filter(Boolean);
    const h = rtHidden();
    return L.map(x => ({ ...x, er: (x.er || []).map(e => Array.isArray(e) ? e : [e.t, e.s, e.c, e.b, e.lost]), path: 'rt:' + x.sys + ':' + x.n, kim: '🤖 ' + T('System table — live') + ' · ' + (RT_SYS[x.sys] || x.sys) + (x.conv ? ' · ' + pracName(x.conv) : '') })).filter(x => !h.has(x.path));
  } catch (e) { return []; }
}
const rbDone = path => String(path).startsWith('rt:') ? rtHide(path) : Net.roboErrDone(path);
const rbFixed = (path, on) => String(path).startsWith('rt:') ? rtHide(path) : Net.roboErrFixed(path, on);
// a report of Servet's drawn in Turkish (the words, the bid meanings, the seats), then the app's language again
async function inTurkish(f) {
  await loadLang('tr');
  const seats = SEAT.slice(), ab = SEAT_AB; T_FORCE = 'tr'; SEAT.splice(0, 4, ...(SEAT_T.tr || seats)); SEAT_AB = SEAT_AB_T.tr || ab;
  try { return await f(); } finally { T_FORCE = null; SEAT.splice(0, 4, ...seats); SEAT_AB = ab; }
}
// the player tells what a robot did wrong on this board (the bidding too, which the card check cannot see)
const rbNoteHtml = e => e && e.deal && !online() ? `<div class="grp"><span>🤖 ${T('Report a robot mistake')}</span><textarea id="rbNote" class="tok" rows="2" maxlength="500" placeholder="${T('What did the robot do wrong? The bidding, a card…')}"></textarea><div class="row2"><button class="btn" id="rbNoteSend" data-id="${esc(String(e.id))}">📨 ${T('Send to the robot mistakes')}</button></div></div>` : '';
// the administrator sees on the report button how many new lessons came in since the report was last opened
async function learnCheck() {
  if (typeof Net === "undefined" || !Net.isAdmin()) return;
  try { const L = await Net.roboErrs(); const n = L.filter(r => !r.u && !r.ok && r.ts > (SET.learnSeen || 0)).length; if (n !== ui.learnNew) { ui.learnNew = n; render(); } } catch (e) {}
}
setTimeout(() => { const k = window.PRAC_Q; window.PRAC_Q = null; if (!k || !pracKnown(k)) return; togglePractice(k, true); ui.pracOpen = 1; ui.pracDrop = null; render(); const p = $('hPrac'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 1200);
setTimeout(learnCheck, 20000); setInterval(learnCheck, 15 * 60000);
/* ---- the robots' learning report (the administrator only): what the robots got wrong on the boards played, from
   every player — the cards (double dummy, as in Robot mistakes) and the bidding (the robot tables' contracts against
   the best contract with all hands open) — by period, with the costliest examples, to copy for Claude ---- */
async function showLearn() { return inTurkish(showLearn0); }
async function showLearn0() {
  if (!Net.isAdmin()) return;
  if (ui.overlay !== 'learn') openOv('learn', `<h2>📈 ${T('Learning report')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`);
  let L = []; try { L = await Net.roboErrs(); } catch (e) {}
  // the lesson book and the six tables' trial of it
  const LB = await rtGet('lessons.json'); await rtLoad();
  if (ui.overlay !== 'learn') return;
  SET.learnSeen = Date.now(); Store.saveSettings(SET); save(); ui.learnNew = 0;
  const days = ui.learnDays || 7, from = days ? Date.now() - days * 864e5 : 0, R = L.filter(r => r.ts >= from);
  const bids = R.filter(r => r.kind === 'bid'), cards = R.filter(r => r.kind !== 'bid' && !r.u);
  const SN = '♣♦♥♠', cn = (l, s) => l + (s === 4 ? 'NT' : SN[s]);
  // the cards: opening lead, declarer, defence; how often and how many tricks
  const cat = { lead: [0, 0], decl: [0, 0], def: [0, 0] };
  for (const r of cards) for (const x of r.er || []) { if (!(x[0] > 0)) continue; const k = x[0] === 1 && x[1] === (r.c[3] + 1) % 4 ? 'lead' : sideOf(x[1]) === sideOf(r.c[3]) ? 'decl' : 'def'; cat[k][0]++; cat[k][1] += x[4] || 0; }
  const KB = { game: T('Missed game'), slam: T('Missed slam'), overbid: T('Overbid'), wrong: T('Wrong contract') };
  const bk = {}; for (const r of bids) { const b = bk[r.bk] || (bk[r.bk] = [0, 0]); b[0]++; b[1] += (r.er && r.er[0] && r.er[0][4]) || 0; }
  const ex = bids.slice().sort((a, b) => (b.er[0][4] || 0) - (a.er[0][4] || 0)).slice(0, 8);
  const aucTxt = a => (a || []).map(([s, c]) => typeof c === 'number' ? callTxt(c) : c === 'P' ? '–' : c).join(' ');
  const row = (label, v, unit) => `<tr><td>${label}</td><td class="n">${v[0]}</td><td class="n">${v[1]} ${unit}</td></tr>`;
  ui.learnCopy = { days, cards: { boards: cards.length, ...cat }, bidding: bk, examples: ex.map(r => ({ board: r.b, deal: r.d, auction: aucTxt(r.a), robots: cn(r.c[0], r.c[1]) + ' ' + SEAT_AB[r.c[3]], tricks: r.ddT, best: r.best ? cn(r.best[0], r.best[1]) + ' ' + SEAT_AB[r.best[2]] : '', imp: -(r.er[0][4] || 0), kind: r.bk })) };
  openOv('learn', `<h2>📈 ${T('Learning report')}</h2>
    <div class="muted">${T('What the robots got wrong on the boards played by everyone, against double dummy: their cards, and the contracts the robot tables reached against the best contract with all hands open. Copy it for Claude: the robots are improved from it.')}</div>
    <div class="seg" data-seg="learnd">${[[7, T('Last 7 days')], [30, T('Last 30 days')], [0, T('All')]].map(([v, l]) => `<button data-v="${v}" class="${days === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <h3 class="sth">🃏 ${T('Card play')} <small>(${T('{0} boards', cards.length)})</small></h3>
    <table class="res stats"><tbody>${row(T('Opening lead'), cat.lead, T('tricks'))}${row(T('Declarer play'), cat.decl, T('tricks'))}${row(T('Defence'), cat.def, T('tricks'))}</tbody></table>
    <h3 class="sth">🗣 ${T('Bidding')} <small>(${T('{0} boards', bids.length)})</small></h3>
    ${Object.keys(bk).length ? `<table class="res stats"><tbody>${Object.entries(bk).sort((a, b) => b[1][1] - a[1][1]).map(([k, v]) => row(KB[k] || k, v, 'IMP')).join('')}</tbody></table>` : `<div class="muted">${T('No bidding lessons yet.')}</div>`}
    ${ex.length ? `<h3 class="sth">${T('Costliest examples')}</h3>${ex.map(r => `<div class="anarow">${T('Board')} ${r.b}: ${aucTxt(r.a)} → <b>${cn(r.c[0], r.c[1])} ${SEAT_AB[r.c[3]]}</b> (${T('{0} tricks', r.ddT)}) · ${T('best')}: <b>${r.best ? cn(r.best[0], r.best[1]) + ' ' + SEAT_AB[r.best[2]] : ''}</b> · <b class="neg">−${r.er[0][4]} IMP</b> · ${KB[r.bk] || ''}</div>`).join('')}` : ''}
    ${lessonBookHtml(LB)}
    <div class="row2"><button class="btn gold" id="learnCopy">📋 ${T('Copy the report for Claude')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// the lesson book in the learning report (Servet's, so Turkish): the trial of the candidate, the accepted lessons
function lessonBookHtml(LB) {
  const H = (LB && LB.hist) || [], per = a => a.b ? (a.lost / a.b).toFixed(2) : '—';
  return `<h3 class="sth">📒 Ders defteri</h3>
    <div class="muted">Durduruldu: denenen defterlerin hiçbiri kaybı azaltmadı. Robotlar ders kullanmadan oynuyor.</div>
    ${H.length ? `<table class="res stats"><tbody><tr><td>Defter</td><td class="n">Derslerle</td><td class="n">Derssiz</td></tr>${H.map(h => `<tr><td>${h.v}</td><td class="n">${per(h.L)} levée/el</td><td class="n">${per(h.B)} levée/el</td></tr>`).join('')}</tbody></table>` : ''}`;
}
// the team match with the robots is gone: its saved match on this device is forgotten
try { localStorage.removeItem('bridge-rteam'); } catch (e) {}
/* Clubs: every club by its name, those with a tournament running first (tapped: its table numbers, and a number goes
   to that table); a club without one offers its admin Set up a tournament (then its password, in the clubs program) */
// a club tournament's tables taken in its current round (the real one, or the super admin's test one)
async function clubTaken(club, test) {
  const base = 'gate/clubs/' + club + '/bm' + (test ? '/test' : '');
  try {
    const [st, lk] = await Promise.all([Net.Cloud.get(base + '/state'), Net.Cloud.get(base + '/tableLocks')]);
    const r = st && st.currentRound, out = new Set();
    for (const [k, v] of Object.entries(lk || {})) if (r && k.startsWith(r + '_')) out.add(+k.split('_')[1] || (v && +v.tableNo));
    return { st, taken: out };
  } catch (e) { return { st: null, taken: new Set() }; }
}
async function showClubs() {
  const draw = () => {
    const L = ui.clubLive || [];
    const otOf = c => typeof ctList === 'function' ? ctList().filter(x => x.club === c) : [];
    const lastRun = c => typeof ctRuns === 'function' ? ctRuns(c)[0] : null;
    const otRows = c => (lastRun(c) ? `<button class="btn" data-ctresopen="${esc(c + '|' + lastRun(c).id)}">📊 ${T('Results')}: ${esc(lastRun(c).i.n || '')} · ${esc(ctWhen(lastRun(c).d))}</button>` : '') + otOf(c).map(x => `<button class="hcard ctcard${ctMine(x) ? ' reg' : ''}" data-ct="${esc(x.club + '|' + x.id)}"><b>🌐 ${esc(x.i.n)}</b><span>${esc(ctWhen(x.d))}${x.i.rep ? ' · 🔁' : ''} · ${x.d <= Date.now() ? '🟢 ' + T('Started') : '⏳ ' + ctLeft(x.d)} · ${T('{0} pairs', x.pairs.length)}</span></button>`).join('');
    const rows = L.map(t => `<div class="clubrow${ui.clubOpen === t.club ? ' open' : ''}${t.tb ? ' live' : ''}"><button class="clubname" data-clubopen="${esc(t.club)}"><b>🏛 ${esc(t.c || t.club)}</b>${t.tb ? `<small>🟢 ${esc(t.n || T('Running'))}</small>` : ''}${otOf(t.club).length ? `<small>🌐 ${esc(otOf(t.club)[0].i.n)} · ${esc(ctWhen(otOf(t.club)[0].d))}</small>` : ''}<span class="clubarr">${ui.clubOpen === t.club ? '▾' : '▸'}</span></button>` + (ui.clubOpen === t.club ? otRows(t.club) : '') +
      (ui.clubOpen !== t.club ? '' : t.tb ? (ui.clubTaken && ui.clubTaken[t.club] ? (L => L.length ? `<div class="grp"><span>${T('Table No')}</span><div class="bm3-keys k4 sbpick">${L.map(n => `<button class="bm3-key" data-clubtn="${esc(t.club)}|${t.p}|${n}">${n}</button>`).join('')}</div></div>` : `<div class="muted">${T('Every table is taken.')}</div>`)([...Array(t.tb).keys()].map(i => i + 1).filter(n => !ui.clubTaken[t.club].has(n))) : `<div class="muted">${T('Loading…')}</div>`) + `<div class="row2"><button class="btn" data-clubadmin="${esc(t.club)}">⚙️ ${T('Admin')}</button></div>`
        : `<div class="muted">${T('No tournament at this club now.')}</div><div class="row2"><button class="btn gold" data-clubadmin="${esc(t.club)}">➕ ${T('Set up a tournament')}</button></div>`) + (ui.clubOpen === t.club ? `<div class="row3 clubtools"><button class="btn" data-clubres="${esc(t.club)}">📄 ${T('Results')}</button><button class="btn" data-clubmov="${esc(t.club)}">🔀 ${T('Movement')}</button><button class="btn" data-clubscr="${esc(t.club)}">📺 ${T('Screen')}</button></div>` : '') + `</div>`).join('');
    openOv('clubs', `<h2>🏛 ${T('Clubs')}</h2>
      ${ui.clubLive == null ? `<div class="muted">${T('Loading…')}</div>` : rows || `<div class="muted">${T('No clubs yet.')}</div>`}
      <div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`);
  };
  if (ui.overlay !== 'clubs') ui.clubLive = null;
  if (typeof ctLoad === 'function') ctLoad(true).then(() => { if (ui.overlay === 'clubs') draw(); });
  draw();
  if (ui.clubLive == null) {
    const [v, cl] = await Promise.all([Net.Cloud.get('gate/live').catch(() => null), Net.Cloud.get('gate/clubList').catch(() => null)]);
    // a club's running tournament: only a club in the list and switched on (a deleted club's entry may be left over); its name from the list
    const known = id => !cl || (cl[id] && cl[id].a !== false);
    let live = Object.entries(v || {}).map(([club, t]) => ({ club, ...t, c: (cl && cl[club] && cl[club].n) || t.c })).filter(t => t && known(t.club) && /^\d{2}$/.test(t.p || '') && Date.now() - (t.ts || 0) < 24 * 3600e3).sort((a, b) => b.ts - a.ts);
    // only a tournament that really runs (an entry left behind by a finished or new one is not)
    const runs = await Promise.all(live.map(t => Net.Cloud.get('gate/clubs/' + t.club + '/bm/state/status').catch(() => null)));
    live = live.filter((t, i) => runs[i] === 'running');
    // the running tournaments first, then every other club (switched off ones are left out)
    const rest = Object.entries(cl || {}).filter(([id, c]) => c && c.a !== false && !live.some(t => t.club === id)).map(([club, c]) => ({ club, c: c.n })).sort((a, b) => String(a.c).localeCompare(String(b.c)));
    ui.clubLive = [...live, ...rest];
    if (ui.overlay === 'clubs') draw();
  }
}
/* Clubs: the club tournaments (in kulupler/, once BridgeGate) open here, full screen above the home page, under a bar with
   Home; the phone's Back closes them too. q: the club address's query (?club=…&role=table…), or '' for the clubs' page */
function openClubs(q) {
  let v = $('clubView');
  if (!v) {
    v = document.createElement('div'); v.id = 'clubView';
    v.innerHTML = `<div class="cvbar"><button class="btn" id="cvHome">⌂ ${T('Home')}</button><button class="cvclubs" id="cvClubs">🏛 ${T('Clubs')}</button></div><iframe id="cvFrame"></iframe>`;
    document.body.appendChild(v);
    v.querySelector('#cvHome').addEventListener('click', () => history.state && history.state.clubs ? history.back() : closeClubs());
    // the Clubs list again (the clubs program closes)
    v.querySelector('#cvClubs').addEventListener('click', () => { if (history.state && history.state.clubs) history.back(); else closeClubs(); setTimeout(() => { ui.overlay = null; showClubs(); }, 60); });
  }
  const p = new URLSearchParams(String(q || '').replace(/^\?/, '')); p.set('embed', '1'); p.set('lang', SET.lang || 'en');   // the clubs program in Bridge Table's language
  const fr = document.createElement('iframe'); fr.id = 'cvFrame'; fr.title = T('Clubs'); fr.src = 'kulupler/index.html?' + p.toString();   // a new frame: its first page adds no step to Back
  $('cvFrame').replaceWith(fr);
  v.hidden = false; document.body.classList.add('clubsopen');
  try { if (!(history.state && history.state.clubs)) history.pushState({ clubs: 1 }, ''); } catch (e) {}
}
function closeClubs() { const v = $('clubView'); if (!v || v.hidden) return; v.hidden = true; $('cvFrame').replaceWith(Object.assign(document.createElement('iframe'), { id: 'cvFrame' })); document.body.classList.remove('clubsopen'); if (typeof needGate === 'function' && needGate()) showGate(); }
window.addEventListener('popstate', () => { if (!(history.state && history.state.clubs)) closeClubs(); });
/* the administrator deletes score history: the players listed (himself too), the ticked ones' boards removed */
async function showWipe() {
  if (!Net.isAdmin()) return;
  if (!ui.wipeList) { openOv('wipe', `<h2>🗑 ${T('Delete score history')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`); try { ui.wipeList = await Net.adminUsers(); } catch (e) { ui.wipeList = []; } ui.wipeSel = new Set(); }
  const L = ui.wipeList || [], sel = ui.wipeSel || (ui.wipeSel = new Set());
  const rows = L.map(x => `<label class="plrow${sel.has(x.k) ? ' on' : ''}"><input type="checkbox" data-wipek="${esc(x.k)}" ${sel.has(x.k) ? 'checked' : ''}><b>${esc(x.name)}</b>${x.me ? ` <small>(${T('You')})</small>` : ''}</label>`).join('');
  openOv('wipe', `<h2>🗑 ${T('Delete score history')}</h2>
    <div class="muted">${T('Tick the players whose score history is deleted: their boards, results and rating start again (their name, settings and championship results stay). Boards played after this are kept.')}</div>
    <div class="pllist">${rows || `<div class="muted">${T('Nobody yet.')}</div>`}</div>
    <div class="row2"><button class="btn bad" id="wipeGo" ${sel.size ? '' : 'disabled'}>🗑 ${T('Delete the ticked ({0})', sel.size)}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
function wipeGo() {
  const sel = ui.wipeSel; if (!sel || !sel.size) return;
  const names = (ui.wipeList || []).filter(x => sel.has(x.k)).map(x => x.name);
  askYes(T('Delete the score history of {0}?', names.join(', ')), async () => {
    openOv('wipe', `<h2>🗑 ${T('Delete score history')}</h2><div class="muted">⏳ ${T('Removing…')}</div>`);
    let ok = 0; const me = (ui.wipeList || []).find(x => x.me);
    for (const k of [...sel]) { try { if (await Net.adminWipe(k)) ok++; } catch (e) {} }
    if (me && sel.has(me.k)) { HIST = []; SET.wipeSeen = Date.now(); Store.saveSettings(SET); save(); render(); }   // your own, here at once
    ui.wipeSel = new Set(); ui.wipeList = null; closeOv(); flash('🗑 ' + T('{0} removed', ok), 2500);
  });
}
/* the administrator's list of players: every registered name, when it was made and last signed in; tick the ones
   to remove (test names, for instance) and remove them with all their data */
async function showPlayers() {
  if (!Net.isAdmin()) return;
  if (!ui.plList) { openOv('players', `<h2>👥 ${T('Players')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`); try { ui.plList = await Net.adminUsers(); } catch (e) { ui.plList = null; } }
  if (ui.overlay !== 'players' && ui.overlay) return;
  const L = ui.plList || [], q = (ui.plQ || '').toLowerCase(), sel = ui.plSel || (ui.plSel = new Set());
  const when = ts => ts ? new Date(ts).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const hm = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–';
  // a name opened: its days, newest first (30): in and out, and what was played that day
  const plDays = x => `<div class="pldays">${(x.hist || []).slice(0, 30).map(h => { const a = h.a || {}, cv = Object.keys(a.cv || {}).concat(String(h.pr || '').split(',')).filter((k, i, A) => k && A.indexOf(k) === i && E.convInfo(k));
    const did = [a.r ? '🤖 ' + T('With robots') + ' ' + a.r : '', a.o ? '🌐 ' + T('At a table') + ' ' + a.o : '', a.t ? '🏆 ' + T('Tournaments') + ' ' + a.t : '', a.p ? '📚 ' + T('Practise conventions') + ' ' + a.p : ''].filter(Boolean).join(' · ');
    return `<div class="plday"><b>${new Date(h.day).toLocaleDateString()}</b><span>${T('Logged in')} ${hm(h.in)} · ${T('Last seen')} ${hm(h.out)}</span><span>${did || '—'}${a.b ? ' · ' + T('Boards') + ' ' + a.b : ''}</span>${cv.length ? `<small>${cv.map(k => esc(pracName(k))).join(', ')}</small>` : ''}</div>`; }).join('') || `<div class="muted">—</div>`}${x.me ? '' : `<button class="btn mini-btn plpin" data-plpin="${esc(x.k)}">🔑 ${T('New PIN')}</button><button class="btn mini-btn plpin" data-plmsg="${esc(x.name)}">✉️ ${T('Write a message…')}</button>`}</div>`;
  const rows = L.filter(x => !q || x.name.toLowerCase().includes(q)).map(x => `<label class="plrow${sel.has(x.k) ? ' on' : ''}">
      <input type="checkbox" data-plk="${esc(x.k)}" ${sel.has(x.k) ? 'checked' : ''} ${x.me ? 'disabled' : ''}>
      <b>${esc(x.name)}</b><small>${T('Made')}: ${when(x.ts)} · ${T('Last seen')}: ${x.hist && x.hist[0] ? when(x.hist[0].out || x.hist[0].in) : '–'} · ${T('{0} days', x.days)}</small><button class="pldet" data-pldet="${esc(x.k)}">${ui.plOpen === x.k ? '▾' : '▸'}</button></label>${ui.plOpen === x.k ? plDays(x) : ''}`).join('');
  openOv('players', `<h2>👥 ${T('All players')} <small>(${L.length})</small></h2>
    <input id="plQ" class="tok wide" placeholder="🔍 ${T('Search a name…')}" value="${esc(ui.plQ || '')}">
    <div class="pllist">${rows || `<div class="muted">${T('Nobody yet.')}</div>`}</div>
    <div class="muted">${T('Removing a name deletes it for good with its results, settings, logins and messages; the name becomes free again.')}</div>
    <div class="row2"><button class="btn bad" id="plDel" ${sel.size ? '' : 'disabled'}>🗑 ${T('Remove the ticked ({0})', sel.size)}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
  const i = $('plQ'); if (i && ui.plFocus) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
// a new PIN for a player who forgot theirs: typed here by the administrator, who tells it to the player
function playerPin(k) {
  const x = (ui.plList || []).find(y => y.k === k); if (!x) return;
  ui.plPinK = k;
  openOv('plpin', `<h2>🔑 ${T('New PIN for {0}', esc(x.name))}</h2>
    <div class="muted">${T('The name stays. Tell the player the new PIN; results saved with the old PIN do not come along.')}</div>
    <div class="grp"><span>${T('PIN (4 digits)')}</span><input id="ppPin" class="tok gpin" inputmode="numeric" pattern="[0-9]*" maxlength="4" type="password" autocomplete="off"></div>
    <div class="grp"><span>${T('PIN again')}</span><input id="ppPin2" class="tok gpin" inputmode="numeric" pattern="[0-9]*" maxlength="4" type="password" autocomplete="off"></div>
    <div class="err" id="ppErr"></div>
    <div class="row2"><button class="btn new" id="ppGo">🔑 ${T('Save')}</button><button class="btn" id="ppBack">${T('Cancel')}</button></div>`);
}
async function playerPinGo() {
  const x = (ui.plList || []).find(y => y.k === ui.plPinK), a = $('ppPin') ? $('ppPin').value : '', b = $('ppPin2') ? $('ppPin2').value : '';
  const err = m => { const e = $('ppErr'); if (e) e.textContent = m; };
  if (!x) return;
  if (!/^\d{4}$/.test(a)) return err(T('The PIN is 4 digits.'));
  if (a !== b) return err(T('The two PINs are not the same.'));
  let ok = false; try { ok = await Net.adminSetPin(x.k, await pinHash(x.name, a)); } catch (e) {}
  if (!ok) return err(T('The online database could not be reached.'));
  flash('🔑 ' + T('The PIN of {0} is changed.', x.name), 2500); ui.plPinK = null; closeOv(); showPlayers();
}
function playersDelete() {
  const sel = ui.plSel; if (!sel || !sel.size) return;
  const names = (ui.plList || []).filter(x => sel.has(x.k)).map(x => x.name);
  askYes(T('Remove {0} for good? Their results, settings, logins and messages are deleted.', names.join(', ')), async () => {
    openOv('players', `<h2>👥 ${T('Players')}</h2><div class="muted">⏳ ${T('Removing…')}</div>`);
    let ok = 0; for (const k of [...sel]) { try { if (await Net.adminDelete(k)) ok++; } catch (e) {} }
    for (const n of names) delete Net.st.rated[Net.nameKey(n)]; try { localStorage.setItem('bridge-rated', JSON.stringify(Net.st.rated)); } catch (e) {}
    ui.plSel = new Set(); ui.plList = null; flash('🗑 ' + T('{0} removed', ok), 2500); showPlayers();
  });
}
// the administrator's statistics: who is on the site now and what they are doing
const cvNames = s => String(s || '').split(',').filter(k => k && E.convInfo(k)).map(k => esc(pracName(k))).join(', ');
function statOnlineHtml(on) {
  const at = x => x.at === 'robots' ? '🤖 ' + T('With robots') + (x.pr ? ' · 📚 ' + cvNames(x.pr) : '') : x.at === 'table' ? '🌐 ' + T('At a table') : '🏠 ' + T('In the lobby');
  return `<h3 class="sth">🟢 ${T('Online now')} (${on.length})</h3>` + (on.length
    ? `<table class="res stats">${on.sort((a, b) => a.name.localeCompare(b.name)).map(x => `<tr><td><b>${esc(x.name)}</b>${x.direct ? ` <span class="stdirect">⚠ ${T('not connected to the database')}</span>` : ''}</td><td>${at(x)}</td><td class="muted">${esc(Net.sysShort({ sys: x.sys }))}</td></tr>`).join('')}</table>`
    : `<div class="muted">${T('Nobody yet.')}</div>`)
    + (on.some(x => x.direct) ? `<div class="muted">⚠ ${T('Seen only in the lobby: the device cannot reach the database (an ad or privacy blocker, or an old version), so its boards and messages are not recorded. The player sees a notice about it.')}</div>` : '');
}
// what was played in the chosen period: boards by kind, practice, the conventions practised most, and each player
function statActHtml(a) {
  if (!a || !a.b) return `<h3 class="sth">🎯 ${T('Activity')}</h3><div class="muted">${T('No boards recorded yet.')}</div>`;
  const pct = (ok, n) => n ? Math.round(100 * ok / n) + '%' : '–';
  const cv = Object.entries(a.cv).filter(([k]) => E.convInfo(k)).sort((x, y) => y[1] - x[1]);
  const pl = Object.entries(a.pl).sort((x, y) => y[1].b - x[1].b);
  return `<h3 class="sth">🎯 ${T('Activity')}</h3>
    <div class="stact"><span>🃏 <b>${a.b}</b> ${T('Boards')}</span><span>🤖 ${a.r}</span><span>🌐 ${a.o}</span><span>🏆 ${a.t}</span><span>📚 <b>${a.p}</b> ${T('Practice')} · ${T('Right')} ${pct(a.ok, a.n)}</span></div>
    ${cv.length ? `<div class="stcv"><small>${T('Most practised')}:</small> ${cv.slice(0, 12).map(([k, n]) => `<span>${esc(pracName(k))} <b>${n}</b></span>`).join('')}</div>` : ''}
    <table class="res stats"><thead><tr><th>${T('Player')}</th><th class="n">${T('Boards')}</th><th class="n">📚</th><th class="n">${T('Right')}</th><th>${T('Most practised')}</th></tr></thead><tbody>
    ${pl.map(([nm, q]) => `<tr><td><b>${esc(nm)}</b></td><td class="n">${q.b}</td><td class="n">${q.p}</td><td class="n">${pct(q.ok, q.n)}</td><td class="muted">${Object.entries(q.cv).filter(([k]) => E.convInfo(k)).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => esc(pracName(k))).join(', ')}</td></tr>`).join('')}</tbody></table>`;
}
// where the visitors came from (Google first): each device once a day, the first-time ones apart
const VIS_N = { google: '🔎 Google', bing: '🔎 Bing', yandex: '🔎 Yandex', duckduckgo: '🔎 DuckDuckGo', yahoo: '🔎 Yahoo', ecosia: '🔎 Ecosia', facebook: '📘 Facebook', instagram: '📷 Instagram', x: '𝕏 X', whatsapp: '💬 WhatsApp', github: '🐙 GitHub', askim: '🏛 Askim BK', other: '🔗 ', direct: '🏠 ' };
function statVisHtml(V) {
  if (!V) return '';
  const L = Object.entries(V.by).sort((a, b) => (b[0] === 'google') - (a[0] === 'google') || b[1][0] - a[1][0]), max = Math.max(1, ...L.map(x => x[1][0]));
  const nm = k => k === 'other' ? VIS_N.other + T('Other sites') : k === 'direct' ? VIS_N.direct + T('Direct (app, bookmark, typed)') : VIS_N[k] || esc(k);
  return `<h3>🧭 ${T('Where they came from')}</h3>${L.length ? `<table class="res stats">${L.map(([k, v]) => `<tr><td>${nm(k)}</td><td class="n"><b>${v[0]}</b>${v[1] ? ` <small>(${T('{0} new', v[1])})</small>` : ''}</td><td class="sbar"><i style="width:${Math.round(v[0] / max * 100)}%"></i></td></tr>`).join('')}</table>` : `<div class="muted">${T('Nobody yet.')}</div>`}
    <div class="muted">${T('Every device once a day, guests too; new = its first visit. Counted from {0}.', '13.11.2026')}</div>`;
}
async function showStats() {
  if (!Net.isAdmin()) return;
  ui.statTab = ui.statTab || 'day';
  if (!ui.statData) { openOv('stats', `<h2>📊 ${T('Visitor statistics')}</h2><div class="muted">⏳ ${T('Loading…')}</div>`); try { [ui.statData, ui.statOn, ui.statVis] = await Promise.all([Net.loginStats(), Net.onlineNow().catch(() => []), Net.visitStats().catch(() => null)]); } catch (e) { ui.statData = null; } }
  const d = ui.statData;
  if (!d) { openOv('stats', `<h2>📊 ${T('Visitor statistics')}</h2><div class="muted">${T('The online database could not be reached.')}</div><div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`); return; }
  const P = d[ui.statTab], L = Object.entries(P.by).sort((a, b) => b[1] - a[1]), max = Math.max(1, ...L.map(x => x[1]));
  const tabs = [['day', T('Today')], ['week', T('7 days')], ['month', T('30 days')], ['year', T('365 days')]];
  const rows = L.map(([c, n]) => `<tr><td>${c === '?' ? '❔ ' + T('Unknown') : flagOf(c) + ' ' + esc(ctryName(c))}</td><td class="n"><b>${n}</b></td><td class="sbar"><i style="width:${Math.round(n / max * 100)}%"></i></td></tr>`).join('');
  openOv('stats', `<h2>📊 ${T('Visitor statistics')}</h2>
    <div class="seg" data-seg="stattab">${tabs.map(([v, l]) => `<button data-v="${v}" class="${ui.statTab === v ? 'on' : ''}">${l} <small>(${d[v].total})</small></button>`).join('')}</div>
    <div class="big">${T('{0} visitors', P.total)}</div>
    ${L.length ? `<table class="res stats">${rows}</table>` : `<div class="muted">${T('Nobody yet.')}</div>`}
    ${statVisHtml(ui.statVis && ui.statVis[ui.statTab])}
    ${statOnlineHtml(ui.statOn || [])}
    ${statActHtml(P.act)}
    <div class="muted">${T('Each internet address counts once in each period. Only you (the administrator) see this page.')}</div>
    <div class="row2"><button class="btn" id="sRefresh">🔄 ${T('Refresh')}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
// an app installed while it was still locked upright keeps that lock until the phone or tablet updates it: free it now
try { if (screen.orientation && screen.orientation.lock && matchMedia('(display-mode: standalone)').matches) screen.orientation.lock('any').catch(() => {}); } catch (e) {}
/* ---- under the players list: show the offline players or not, add a friend by name, the leaderboard ---- */
function playersFoot() {
  return `<div class="lpfoot"><label class="lpoff"><input type="checkbox" data-showoff="1" ${SET.showOff ? 'checked' : ''}> ${T('Show offline')}</label>
    <div class="lpadd"><input class="tok" data-fadd="1" maxlength="20" placeholder="${T('Add friend')}"><button class="btn mini-btn" data-faddbtn="1">${T('Add')}</button></div>
    <button class="btn mini-btn lplead" id="lLead">🏅 ${T('Leaderboard')}</button></div>`;
}
function addFriendFrom(btn) {
  const i = btn.parentElement.querySelector('[data-fadd]'), n = i ? i.value.trim().slice(0, 20) : '';
  if (!n) return;
  if (!isFriend(n)) toggleFriend(n);
  i.value = ''; flash('★ ' + T('{0} is now a friend', n), 1800); render(); renderDock();
}
/* ---- who the message goes to: the button beside the message box shows it; tap it to choose the table, the lobby
   or one player (a private message) ---- */
function rcptLabel(where) {
  if (ui.pmTo) return '🔒 ' + ui.pmTo + ' ▾';
  if (where === 'dock' && online() && (ui.dockTab || 'table') === 'table') return '🃏 ▾';
  return '🌐 ▾';
}
function updateRcpt() {
  for (const [id, w] of [['dRcpt', 'dock'], ['lRcpt', 'home'], ['pRcpt', 'home']]) { const b = $(id); if (b) { const t = rcptLabel(w); if (b.textContent !== t) b.textContent = t; } }
}
function showRcptMenu(btn) {
  const where = btn.id === 'dRcpt' ? 'dock' : 'home';
  const people = [...new Set([...Net.knownNames(), ...friends()])].slice(0, 30);
  const opts = (where === 'dock' && online() ? [['table', '🃏 ' + T('Table')]] : []).concat([['lobby', '🌐 ' + T('Lobby')]], people.map(n => ['pm:' + n, '🔒 ' + n]));
  const old = document.querySelector('.rcptmenu'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'rcptmenu';
  m.innerHTML = opts.map(([v, l]) => `<button data-rcpt="${esc(v)}">${esc(l)}</button>`).join('');
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect(); m.style.left = Math.max(4, Math.min(innerWidth - 220, r.left)) + 'px'; m.style.bottom = (innerHeight - r.top + 4) + 'px';
  m.dataset.where = where;
}
document.addEventListener('click', e => {
  const opt = e.target.closest('[data-rcpt]');
  const menu = document.querySelector('.rcptmenu');
  if (opt) {
    const v = opt.dataset.rcpt;
    if (v === 'table') { ui.pmTo = null; ui.dockTab = 'table'; }
    else if (v === 'lobby') { ui.pmTo = null; ui.dockTab = 'lobby'; }
    else ui.pmTo = v.slice(3), ui.dockTab = 'lobby';
    menu && menu.remove(); render(); renderDock(); updateRcpt();
    const i = ['dMsg', 'lMsg', 'lMsg2'].map($).find(x => x && x.offsetParent); if (i) i.focus();
    return;
  }
  if (menu && !e.target.closest('.rcpt')) menu.remove();
  const rb = e.target.closest('.rcpt'); if (rb) { if (menu) menu.remove(); else showRcptMenu(rb); return; }
  const fb = e.target.closest('[data-faddbtn]'); if (fb) addFriendFrom(fb);
}, true);
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.showoff) { SET.showOff = e.target.checked; Store.saveSettings(SET); save(); render(); renderDock(); } });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.fadd) { e.preventDefault(); addFriendFrom(e.target); } });
// the message box grows with the text (up to three lines) and shrinks back when it is sent
function fitMsg(t) { if (!t || !t.classList || !t.classList.contains('cmsg')) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 96) + 'px'; }
document.addEventListener('input', e => fitMsg(e.target));
document.addEventListener('keyup', e => { if (e.key === 'Enter') fitMsg(e.target); });
document.addEventListener('click', () => setTimeout(() => document.querySelectorAll('.cmsg').forEach(t => { if (!t.value) t.style.height = ''; }), 0));
/* ---- keyboard on a computer: bidding "1" then "s" = 1♠ (c d h s n), p = pass, x = double, r = redouble;
   playing: ← → pick among the cards you can play and Enter (or Space) plays it, or type the card: "a" then "s" = A♠ ---- */
const KB = { lvl: 0, rank: null, sel: -1 };
function kbCards() {
  if (!G || G.phase !== 'play') return [];
  const g = G.play, s = g.turn; if (g.trick.length >= 4 || !userControls(s)) return [];
  const leg = E.legalFor(g, s);
  return [...document.querySelectorAll('.card[data-c].play')].map(e => +e.dataset.c).filter(c => leg.includes(c));
}
function kbMark() {
  document.querySelectorAll('.card.kb').forEach(e => e.classList.remove('kb'));
  const L = kbCards(); if (KB.sel < 0 || !L.length) return;
  KB.sel = Math.min(KB.sel, L.length - 1);
  const el = document.querySelector(`.card[data-c="${L[KB.sel]}"].play`); if (el) el.classList.add('kb');
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || !G) return;
  const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
  if (ui.overlay) return;
  const k = e.key.toLowerCase();
  if (G.phase === 'bid' && bidTurn() === meSeat()) {
    const L = legalCalls(G.auction, U()), call = c => { if (L.includes(c)) { e.preventDefault(); KB.lvl = 0; ui.selLvl = 0; makeCall(U(), c); return true; } return false; };
    if (/^[1-7]$/.test(k)) { KB.lvl = +k; ui.selLvl = +k; renderBidbox(); e.preventDefault(); return; }
    if (KB.lvl && 'cdhsn'.includes(k) && k.length === 1) { call(B(KB.lvl, 'cdhsn'.indexOf(k))); return; }
    if (k === 'p') { call('P'); return; }
    if (k === 'x') { call('X'); return; }
    if (k === 'r') { call('XX'); return; }
    return;
  }
  const L = kbCards(); if (!L.length) return;
  if (k === 'arrowright' || k === 'arrowleft') { e.preventDefault(); KB.sel = KB.sel < 0 ? 0 : (KB.sel + (k === 'arrowright' ? 1 : L.length - 1)) % L.length; kbMark(); return; }
  if ((k === 'enter' || k === ' ') && KB.sel >= 0) { e.preventDefault(); const c = L[Math.min(KB.sel, L.length - 1)]; KB.sel = -1; playCard(G.play.turn, c); return; }
  const rk = { a: 12, k: 11, q: 10, j: 9, t: 8, '1': 8, '9': 7, '8': 6, '7': 5, '6': 4, '5': 3, '4': 2, '3': 1, '2': 0 };
  if (k in rk && KB.rank == null) { KB.rank = rk[k]; setTimeout(() => { KB.rank = null; }, 1500); e.preventDefault(); return; }
  if (KB.rank != null && 'cdhs'.includes(k) && k.length === 1) { const c = 'cdhs'.indexOf(k) * 13 + KB.rank; KB.rank = null; if (L.includes(c)) { e.preventDefault(); playCard(G.play.turn, c); } else flash(T('You cannot play that card'), 1200); return; }
  if (k === '0' && KB.rank === 8) return;   // "10" typed as 1 then 0
});
/* ---- install as an app: Chrome and Edge (Android, PC) offer their own install window; Safari on iPhone and iPad
   only through Share → Add to Home Screen, so there the steps are shown. Not shown inside the installed app, nor
   once installed. ---- */
var INST = null;   // var and function declarations: the home page can be drawn before this part of the file has run
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST = e; if (typeof render === 'function') render(); });
window.addEventListener('appinstalled', () => { INST = null; SET.instNo = 1; Store.saveSettings(SET); render(); });
function isStandalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
// a small button in the top bar (beside the language and settings): always in view, takes no room on the page
function instHtml() {
  if (SET.instNo || isStandalone() || (!INST && !isIOS())) return '';
  return `<button class="hinstb" id="instGo" title="${T('Install Bridge Table as an app')}">📲 ${T('Install')}</button>`;
}
/* the app sent to someone (the WhatsApp button): their link carries ?install=1, and the app asks at once whether to
   install it (after the name and PIN for a new player). The phone itself confirms the install: no page can install on
   its own */
var INST_ASKED = false;
function installAsk() {
  if (INST_ASKED || !/[?&]install=1/.test(location.search) || isStandalone() || needGate()) return;
  INST_ASKED = true;
  openOv('instask', `<h2>📲 Bridge Table</h2><div class="big">${T('Install Bridge Table on your phone as an app?')}</div>
    <div class="muted">${T('Then it opens like any app, from your home screen.')}</div>
    <div class="row2"><button class="btn new" id="instGo">📲 ${T('Install')}</button><button class="btn" id="oClose">${T('Not now')}</button></div>`);
}
setTimeout(installAsk, 1500);
/* once for every player (October 2026): the base system and the conventions are emptied and each player makes their
   own card. Returns true when it asked. */
function cardReset() {
  if (SET.cardV === 1 || !myNm() || online()) return false;
  SET.sys = 'none'; SET.conv = Object.fromEntries(E.CONVS.map(c => [c.k, false])); SET.practice = ''; SET.cline = ''; SET.cardV = 1;
  Store.saveSettings(SET); save(); render(); if (typeof Net !== 'undefined') Net.shareInfo();
  const ask = () => { if (ui.overlay && !/^card(sys|conv)$/.test(ui.overlay)) { setTimeout(ask, 1500); return; } if (!ui.overlay) showCardSys(); };
  ask(); return true;
}
setTimeout(cardReset, 20000);   // normally right after the database was asked (Net.cloudSync); this when it cannot be reached
async function instGo() {
  if (!INST && !isIOS()) {
    // Chrome has not offered its install window (yet): the browser menu does it
    openOv('inst', `<h2>📲 ${T('Install Bridge Table as an app')}</h2><div class="big">${T('Open the browser menu {0} and choose {1}.', '<b>⋮</b>', `<b>${T('Install app')}</b> / <b>${T('Add to Home Screen')}</b>`)}</div>
      <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
    return;
  }
  if (INST) { const p = INST; INST = null; p.prompt(); try { const r = await p.userChoice; if (r && r.outcome === 'accepted') { SET.instNo = 1; Store.saveSettings(SET); } } catch (e) {} render(); return; }
  openOv('inst', `<h2>📲 ${T('Install Bridge Table as an app')}</h2>
    <ol class="inststeps"><li>${T('Tap the Share button {0} at the bottom (on iPad at the top) of Safari.', '<b>⬆︎</b>')}</li><li>${T('Choose {0}.', `<b>${T('Add to Home Screen')}</b>`)}</li><li>${T('Tap {0}: Bridge Table appears on your home screen.', `<b>${T('Add')}</b>`)}</li></ol>
    <div class="muted">${T('In another browser on iPhone, open this page in Safari first.')}</div>
    <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}

// a player's own card (a new player, and everyone once): step 1 the base system (each with a few words), then step 2
// the conventions, none ticked until the player ticks them
function showCardSys() {
  const cur = E.sysOf(SET.sys);
  openOv('cardsys', `<h2>📋 ${T('Your convention card')}</h2><h3>1. ${T('Base system')}</h3><div class="muted">${T('Your robot partner bids it too.')}</div>
    <div class="cardsys">${E.SYSTEMS.map(x => `<button class="btn${sysIs(x.k) ? ' new' : ''}" data-casys="${x.k}"><b>${esc(x.n)}</b><small>${symText(x.d)}</small></button>`).join('')}</div>`);
}
function showCardConv() {
  openOv('cardconv', `<h2>2. ${T('Conventions')}</h2><div class="muted">${T('Base system')}: <b>${esc(E.sysOf(SET.sys).n)}</b> · ${T('Tick the ones you play.')}</div>
    <div class="convs">${E.CONVS.map(c => `<label class="cvchip${SET.conv[c.k] ? ' on' : ''}" title="${esc(c.d)}"><input type="checkbox" data-conv="${c.k}" ${SET.conv[c.k] ? 'checked' : ''}>${esc(c.n)}</label>`).join('')}</div>
    <div class="row2"><button class="btn" id="caBack">◀ ${T('Back')}</button><button class="btn gold" id="caDone">${T('Done')}</button></div>`);
}
