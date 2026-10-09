/* Bridge Table — play online with friends.
   One device hosts the table: the rules, the robots and the scoring run there. Friends join through a link
   (…/bridge/#join-CODE) and sit as partner or opponents; empty seats are robots.
   Devices talk directly (WebRTC), found through the free PeerJS service. Each player is sent only the cards
   they are allowed to see. */
const Net = (() => {
  'use strict';
  // ?ns=name in the address gives a separate lobby (for testing without disturbing real players)
  // on this computer's own test server (localhost) the app always uses a test lobby, so tests never reach real players
  const NS = (location.search.match(/[?&]ns=([a-z0-9]{1,12})/i) || [])[1] || (/^(localhost|127.0.0.1)$/.test(location.hostname) ? 'dev' : undefined);
  const PREFIX = 'bridgetable-' + (NS ? NS.toLowerCase() + '-' : ''), LIB = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  /* Every open app holds one of ROOMS fixed addresses ("rooms"): its table, played alone with robots, is then
     listed in everyone's lobby. When someone asks to join and the player accepts, that table goes online
     and the player is its host. */
  const ROOMS = 20, ROOM = k => PREFIX + 'room-' + k;
  const st = { chat: [], unread: 0, on: false, host: false, guest: false, me: 'local', seat: 2, code: null, peer: null, conn: null, conns: new Map(), seats: {}, names: {}, ctl: null, savedG: null, msg: '', wake: null, want: 'partner' };
  const NAME_KEY = 'bridge-table-name';
  const myName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } };
  // a random id for this tab (kept across reloads), so a host can recognise a returning player
  // this device's id: a host recognises a returning player by it (also after the app was closed and opened again)
  const devTok = () => devId();
  // the host code is never stored: it has to be typed each time (an older version kept it; forget that copy)
  try { localStorage.removeItem('bridge-table-pin'); } catch (e) {}
  const setName = n => { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} };
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function loadLib() {
    return new Promise((res, rej) => {
      if (window.Peer) return res();
      const s = document.createElement('script'); s.src = LIB;
      s.onload = () => res(); s.onerror = () => rej(new Error('Could not load the online module. Check the internet connection.'));
      document.head.appendChild(s);
    });
  }
  // players join from the plain app address; the host accepts each one
  const link = () => location.origin + location.pathname.replace(/[^/]*$/, '');

  /* who plays a seat: a human's id, or 'robot'. The declaring side's humans also play the dummy. */
  function owner(seat) {
    if (st.guest) return st.ctl ? st.ctl[seat] : 'robot';
    // a player whose connection dropped keeps the seat, but a robot plays it until they are back
    const at = s => (st.seats[s] && !(st.away && st.away[s]) ? st.seats[s] : null);
    if (G && G.phase === 'play' && G.play) { const d = G.play.contract.decl, dm = G.play.dummy; if (seat === d || seat === dm) return at(d) || at(dm) || 'robot'; }
    return at(seat) || 'robot';
  }
  /* the state a player may see: hidden hands become face-down placeholders */
  function viewFor(id) {
    const v = JSON.parse(JSON.stringify(G));
    for (let s = 0; s < 4; s++) {
      const show = G.phase === 'done' || id === '*watch' || owner(s) === id || (G.play && G.play.dummyShown && s === G.play.dummy);
      if (show) continue;
      v.deal[s] = v.deal[s].map(() => -1);
      if (v.play) v.play.hands[s] = v.play.hands[s].map(() => -1);
    }
    v.ctl = [0, 1, 2, 3].map(owner); v.names = st.names; v.away = Object.keys(st.away || {}).map(Number); v.score = st.score; v.profs = st.profs || {};
    v.watchers = [...(st.watch || new Map()).values()].map(w => w.name);
    return v;
  }
  function broadcast() {
    if (!st.host || !G) return;
    for (const [id, c] of st.conns) if (c.open) { try { c.send({ t: 'state', v: viewFor(id) }); } catch (e) {} }
    // spectators see all four hands
    if (st.watch && st.watch.size) { const w = viewFor('*watch'); for (const x of st.watch.values()) if (x.conn.open) { try { x.conn.send({ t: 'state', v: w }); } catch (e) {} } }
  }
  function send(m) { if (st.conn && st.conn.open) st.conn.send(m); }
  async function wakeOn() { try { st.wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
  function wakeOff() { try { st.wake && st.wake.release(); } catch (e) {} st.wake = null; }

  /* ---- your table's address (room) and the lobby ---- */
  // the same promise for everyone who asks while a claim is running (so the lobby waits for our own address)
  function claimSlot() { if (st.slot || !navigator.onLine) return Promise.resolve(); return st.claimP || (st.claimP = claimSlot0().finally(() => { st.claimP = null; })); }
  async function claimSlot0() {
    st.claiming = true;
    try { await loadLib(); } catch (e) { st.claiming = false; return; }
    for (let k = 1; k <= ROOMS && !st.slot; k++) {
      const p = await new Promise(res => {
        const p = new Peer(ROOM(k)); let opened = false;
        const t = setTimeout(() => { try { p.destroy(); } catch (e) {} res(null); }, 8000);
        p.on('open', () => { opened = true; clearTimeout(t); res(p); });
        // taken by another player: try the next room (only while claiming — later errors, such as asking an
        // empty room in the lobby, must not give the address away)
        p.on('error', () => { if (opened) return; clearTimeout(t); try { p.destroy(); } catch (e) {} res(null); });
      });
      if (!p) continue;
      st.slot = { peer: p, k };
      p.on('connection', conn => { conn.on('data', d => onSlotData(conn, d)); conn.on('close', () => drop(conn)); conn.on('error', () => drop(conn)); });
      p.on('disconnected', () => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} });
      p.on('close', () => { if (st.slot && st.slot.peer === p) st.slot = null; });
      // the address can be lost (e.g. the phone slept and the service gave it away): drop it, keepSlot takes a new one
      p.on('error', e => { if (e && ['unavailable-id', 'server-error', 'socket-closed'].includes(e.type) && !st.host) { try { p.destroy(); } catch (x) {} if (st.slot && st.slot.peer === p) st.slot = null; } });
    }
    st.claiming = false;
  }
  // what the lobby sees of this table
  function tableInfo() {
    return { t: 'info', k: st.slot ? st.slot.k : 0, away: Object.keys(st.away || {}).map(Number), host: (st.host ? st.names[SET.seat] : '') || myName() || 'Player', names: st.host ? st.names : { [SET.seat]: myName() || 'Player' }, online: st.host, busy: st.guest, phase: G ? G.phase : null, board: G ? G.board : 0,
      prof: prof(), profs: st.host ? st.profs || {} : {}, watchers: st.watch ? st.watch.size : 0, priv: !!(st.host && st.priv), tour: st.host && st.tour ? st.tour : null, pub: !st.host && !!st.soloPub, solo: !st.host && !st.guest, tplay: tplay() };
  }
  // an individual tournament board played here: shown on this table in the lobby, and others can join the tournament
  function tplay() {
    const g = !st.host && !st.guest && G && G.tour && G.tour.table == null ? G.tour : null, t = g && st.tours[g.id];
    return t && t.format !== 'tables' && t.state === 'live' ? { id: t.id, name: t.name, b: g.b, n: t.n } : null;
  }
  /* a player's profile, shown next to their name: boards played today and the average IMPs (or MP %) */
  function prof() {
    const p = Store.periods(HIST)[0];
    // with the system this player bids, and the rating over each period (today, week, month, year, all time)
    return { n: p.n, imp: p.impAvg, mp: p.mpAvg, sys: SET.sys || "twoone", conv: { ...SET.conv }, per: Store.periods(HIST).map(x => [x.n, x.impAvg, x.mpAvg]) };
  }
  // a profile received from another app, kept to the fields we know
  const num = v => v == null || !isFinite(+v) ? null : Math.round(+v * 100) / 100;
  function cleanProf(q, conv) {
    if (!q || typeof q !== 'object') return null;
    return { n: +q.n || 0, imp: num(q.imp), mp: num(q.mp), sys: typeof q.sys === 'string' ? q.sys.slice(0, 12) : undefined,
      conv: conv && q.conv && typeof q.conv === 'object' ? Object.fromEntries(E.CONVS.map(c => [c.k, !!q.conv[c.k]])) : undefined,
      per: Array.isArray(q.per) ? q.per.slice(0, 5).map(r => Array.isArray(r) ? [+r[0] || 0, num(r[1]), num(r[2])] : [0, null, null]) : undefined };
  }
  // the profile of a player seen in the lobby (from the table information)
  function profOf(name) {
    const k = nameKey(name);
    for (const t of (st.tables || [])) { if (nameKey(t.host) === k && t.prof) return cleanProf(t.prof); for (const s in (t.names || {})) if (nameKey(t.names[s]) === k && t.profs && t.profs[s]) return cleanProf(t.profs[s]); }
    for (const m of (st.lchat || []).slice().reverse()) if (nameKey(m.from) === k && m.p) return m.p;   // from the lobby chat
    if (k === nameKey(myName() || '')) return prof();
    return null;
  }
  const sysShort = p => p && p.sys ? ({ twoone: '2/1', sayc: 'SAYC', acol: 'Acol', sef: 'SEF', precision: 'Precision', polish: 'Polish' })[p.sys] || '' : '';
  function profTxt(p) {
    if (!p) return "";
    const s = p.sys ? ({ twoone: "2/1", sayc: "SAYC", acol: "Acol", sef: "SEF", precision: "Precision", polish: "Polish" })[p.sys] || "" : "";
    const st = p.n ? `${p.n} ${T("boards")}${p.imp != null ? " · " + (p.imp > 0 ? "+" : "") + p.imp + " IMP" : p.mp != null ? " · " + p.mp + "%" : ""}` : "";
    return [s, st].filter(Boolean).join(" · ");
  }

  /* ---- tournaments: the same deals for everyone (from a shared number), played alone with robots from
     South; results travel along the lobby lines and every app works out the same ranking ---- */
  const devId = () => { try { let t = localStorage.getItem('bridge-dev-id'); if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bridge-dev-id', t); } return t; } catch (e) { return st.devId || (st.devId = Math.random().toString(36).slice(2)); } };
  st.tours = {}; st.tres = {};
  function saveTours() { try { localStorage.setItem('bridge-tours', JSON.stringify({ tours: st.tours, res: st.tres })); } catch (e) {} }
  /* A tournament starts in 'setup': its organiser invites players by name; each invited player accepts or
     declines; the organiser presses Start ('live') and only then can the players play. Only the organiser's
     device changes a tournament (a higher version number v replaces the older copy everywhere). */
  const obj20 = o => { const r = {}; for (const k in (o || {})) r[String(k).slice(0, 40)] = String(o[k]).slice(0, 20); return r; };
  function cleanTour(t) {
    return { id: String(t.id).slice(0, 30), name: String(t.name || '').slice(0, 40), by: String(t.by || '').slice(0, 20), byKey: String(t.byKey || '').slice(0, 40),
      n: Math.min(32, Math.max(1, +t.n || 8)), seed: (+t.seed >>> 0) || 1, ts: +t.ts || Date.now(),
      state: ['setup', 'live', 'off'].includes(t.state) ? t.state : 'live',
      inv: (Array.isArray(t.inv) ? t.inv : []).slice(0, 40).map(x => String(x).slice(0, 20)),
      joined: obj20(t.joined), declined: obj20(t.declined), v: +t.v || 0,
      // options: format "ind" (everyone alone with robots) or "tables" (players sit together; seats N E S W named
      // in advance, empty = robot), ranking by matchpoints or IMPs, and how many hours the tournament is kept
      format: t.format === "tables" ? "tables" : "ind", scoring: t.scoring === "imp" ? "imp" : "mp", hours: [3, 24, 72].includes(+t.hours) ? +t.hours : 72,
      tables: (Array.isArray(t.tables) ? t.tables : []).slice(0, 8).map(r => [0, 1, 2, 3].map(s => String((r || [])[s] || "").slice(0, 20))) };
  }
  // tournaments made by test devices while the app was being built (they reached the real lobby by mistake)
  const TEST_KEYS = ['hdr4fnhkte9muzjte04', '8bx5flpiljomv046g5q', 'yzx7gpx2u5emuzjw34j'];
  function mergeTour(t) {
    if (!t || !t.id || TEST_KEYS.includes(t.byKey)) return false;
    if (Date.now() - (+t.ts || 0) > ([3, 24, 72].includes(+t.hours) ? +t.hours : 72) * 3600e3) return false;   // kept for the chosen time
    const cur = st.tours[t.id];
    if (cur && ((+t.v || 0) <= cur.v || (cur.byKey && t.byKey !== cur.byKey))) return false;
    st.tours[t.id] = cleanTour(t);
    return true;
  }
  function mergeRes(id, key, r) {
    if (!st.tours[id] || !r || !key) return false;
    const R = st.tres[id] || (st.tres[id] = {}), ns = {};
    for (const b in (r.ns || {})) if (+b >= 1 && +b <= st.tours[id].n) ns[b] = +r.ns[b] || 0;
    // f: the score of each board against the robot field (10 robot tables): [IMP, MP %]
    const f = {};
    for (const b in (r.f || {})) if (+b >= 1 && +b <= st.tours[id].n && Array.isArray(r.f[b])) f[b] = [num(r.f[b][0]) || 0, num(r.f[b][1]) || 0];
    const c = {};
    for (const b in (r.c || {})) if (+b >= 1 && +b <= st.tours[id].n) c[b] = String(r.c[b]).slice(0, 16);
    const cur = R[key], size = x => Object.keys(x.ns || {}).length + Object.keys(x.f || {}).length + Object.keys(x.c || {}).length;
    if (cur && size(cur) >= size({ ns, f, c })) return false;   // results only grow
    R[key] = { name: String(r.name || 'Player').slice(0, 40), ns, f, c, dir: r.dir === 'NS' || r.dir === 'EW' ? r.dir : undefined };
    return true;
  }
  try { const d = JSON.parse(localStorage.getItem('bridge-tours') || '{}'); for (const id in (d.tours || {})) mergeTour(d.tours[id]); for (const id in (d.res || {})) for (const k in d.res[id]) mergeRes(id, k, d.res[id][k]); } catch (e) {}
  function meshSend(m) { for (const c of (st.mesh || new Map()).values()) if (c.open) { try { c.send(m); } catch (e) {} } }
  const isMine = t => !!t && t.byKey === devId();
  // an individual tournament is open to everyone in the lobby: anyone can join and play its boards while it is kept
  const openTour = t => !!t && t.format !== 'tables' && t.state !== 'off';
  // the organiser publishes a new version of the tournament
  function pubTour(t) { t.v = (t.v || 0) + 1; saveTours(); meshSend({ t: 'tour', tour: t }); renderL(); }
  function newTour(n) {
    const me = myName() || 'Player';
    const t = cleanTour({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: me + ' · ' + new Date().toLocaleDateString(), by: me, byKey: devId(), n,
      seed: (Math.random() * 4294967295) >>> 0, ts: Date.now(), state: 'setup', inv: [], joined: { [devId()]: me }, declined: {}, v: 1,
      format: 'tables', tables: [[me, '', '', ''], ['', '', '', '']] });   // two tables to start with; every seat can be typed in
    st.tours[t.id] = t; saveTours(); renderL(); return t;
  }
  function tourInvite(id, names) {
    const t = st.tours[id]; if (!isMine(t)) return;
    const seen = new Set(); t.inv = names.map(x => String(x).trim().slice(0, 20)).filter(x => x && !seen.has(nameKey(x)) && seen.add(nameKey(x)));
    pubTour(t);
  }
  function tourStart(id) { const t = st.tours[id]; if (!isMine(t)) return; t.state = 'live'; pubTour(t); }
  function tourCancel(id) { const t = st.tours[id]; if (!isMine(t)) return; t.state = 'off'; pubTour(t); }
  // an invited player answers; the organiser records it and publishes the new list
  function tourAnswer(id, ok) {
    const t = st.tours[id]; if (!t) return;
    const key = devId(), name = myName() || 'Player';
    if (ok) { t.joined[key] = name; delete t.declined[key]; } else { t.declined[key] = name; delete t.joined[key]; }
    saveTours(); meshSend({ t: 'tjoin', id, key, name, ok: !!ok }); renderL();
  }
  // is this player invited to a tournament that is still being set up (and has not answered yet)?
  const invitedTo = t => !!t && t.state === 'setup' && !isMine(t) && !t.joined[devId()] && !t.declined[devId()] && t.inv.some(x => nameKey(x) === nameKey(myName() || ''));
  // a board finished at a tournament table: the result counts for that table's N-S pair and its E-W pair
  function tourTableResult(id, ti, b, ns, con) {
    const t = st.tours[id]; if (!t) return;
    const R = st.tres[id] || (st.tres[id] = {}), row = t.tables[ti] || [];
    const nm = (a, c) => [row[a], row[c]].map(x => x || 'Robot').join(' & ');
    for (const [dir, val, a, c] of [['NS', ns, 0, 2], ['EW', -ns, 1, 3]]) {
      const key = 'T' + ti + dir, cur = R[key] || (R[key] = { name: (ti + 1) + ' · ' + nm(a, c), dir, ns: {} });
      cur.ns[b] = val; if (con) (cur.c || (cur.c = {}))[b] = con;
      meshSend({ t: 'tres', id, key, r: cur });
    }
    saveTours(); renderL();
  }
  // where a player sits in a tournament played at tables (the first named player of a table opens it)
  function myTourSeat(t, name) {
    const k = nameKey(name || myName() || '');
    for (let ti = 0; ti < t.tables.length; ti++) for (let s = 0; s < 4; s++) if (t.tables[ti][s] && nameKey(t.tables[ti][s]) === k) {
      const hs = [0, 1, 2, 3].find(x => t.tables[ti][x]);
      return { ti, seat: s, hostSeat: hs, host: t.tables[ti][hs] };
    }
    return null;
  }
  // open your tournament table: a private online table, the other players are invited straight to their seats
  async function openTourTable(id) {
    const t = st.tours[id], me = t && myTourSeat(t); if (!me || st.on) return;
    st.seatBak = SET.seat; SET.seat = me.seat;
    await host(false);   // listed in the lobby: a newcomer can ask for a robot's seat (you accept)
    if (!st.host) { SET.seat = st.seatBak; st.seatBak = null; return; }
    st.tour = { id, ti: me.ti }; st.invSeat = {};
    t.tables[me.ti].forEach((n, s) => {
      if (!n || s === me.seat) return;
      const k = nameKey(n); st.invited.push(k); st.invSeat[k] = s;
      meshSend({ t: 'tblinv', k: st.slot.k, host: myName() || 'Host', to: n, priv: true, tour: t.name, seat: s });
    });
    closeOv(); render();
  }
  // a player of a tournament table joins it (the table's own address is in the lobby information)
  function joinTourTable(id) {
    const t = st.tours[id], me = t && myTourSeat(t); if (!me) return;
    const tb = (st.tables || []).find(x => x.tour && x.tour.id === id && x.tour.ti === me.ti);
    if (!tb) { flash(T('Waiting for {0} to open the table', me.host), 2500); if (!st.finding) findTables(); return; }
    st.offer = tb; st.want = 'any'; st.msg = '';
    join('room-' + tb.k, myName() || 'Guest', 'any');
  }
  /* ---- private messages to one player in the lobby (sent along that player's own lobby line) ---- */
  st.dms = {}; try { st.dms = JSON.parse(localStorage.getItem('bridge-dms') || '{}') || {}; } catch (e) {}
  st.dmUnread = {}; st.dmSeen = new Set();
  // mail: a message to a player who is not in the lobby waits here and is delivered when they come (kept 7 days)
  st.dmOut = []; try { st.dmOut = JSON.parse(localStorage.getItem('bridge-dm-out') || '[]') || []; } catch (e) {}
  try { st.dmSeen = new Set(JSON.parse(localStorage.getItem('bridge-dm-seen') || '[]')); } catch (e) {}
  const saveOut = () => { try { localStorage.setItem('bridge-dm-out', JSON.stringify(st.dmOut)); localStorage.setItem('bridge-dm-seen', JSON.stringify([...st.dmSeen].slice(-300))); } catch (e) {} };
  function deliverOut() {
    const now = Date.now();
    st.dmOut = st.dmOut.filter(m => now - m.ts < 7 * 864e5);
    for (const m of st.dmOut) {
      if (m.tried && now - m.tried < 15000) continue;
      const c = dmConn(m.to); if (!c) continue;
      m.tried = now; try { c.send(m); } catch (e) {}
    }
    saveOut();
  }
  function dmAcked(d) {
    if (!d || nameKey(d.to) !== nameKey(myName() || '')) return;
    const n = st.dmOut.length; st.dmOut = st.dmOut.filter(m => m.id !== d.id);
    if (st.dmOut.length === n) return;
    for (const k in st.dms) for (const x of st.dms[k].list) if (x.id === d.id) x.ok = true;
    saveDms(); saveOut(); if (ui.overlay === 'dm') showDm(ui.dmWith);
  }
  function saveDms() { try { localStorage.setItem('bridge-dms', JSON.stringify(st.dms)); } catch (e) {} }
  function addDm(other, m) {
    const k = nameKey(other), L = st.dms[k] || (st.dms[k] = { name: other, list: [] });
    L.name = other; L.list.push(m); if (L.list.length > 100) L.list.shift(); saveDms();
  }
  function dmConn(name) {
    const k = nameKey(name), t = (st.tables || []).find(x => nameKey(x.host) === k || Object.values(x.names || {}).some(n => nameKey(n) === k));
    const r = (st.roomOf || {})[k] ?? (t && t.k);
    const c = r != null && (st.mesh || new Map()).get(ROOM(r));
    return c && c.open ? c : null;
  }
  function dmSend(name, text) {
    text = String(text || '').trim().slice(0, 300); if (!text) return;
    const m = { t: 'dm', id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), from: myName() || 'Player', to: name, text, ts: Date.now() };
    const c = dmConn(name);
    if (c) { m.tried = Date.now(); try { c.send(m); } catch (e) {} }
    else flash('✉ ' + T('{0} is not in the lobby — the message is delivered when they come', name), 3000);
    st.dmOut.push(m); saveOut();   // kept until the other app confirms it arrived
    addDm(name, { id: m.id, from: m.from, text, ts: m.ts, me: true });
  }
  function gotDm(d) {
    if (!d || !d.text || nameKey(d.to) !== nameKey(myName() || '')) return;
    meshSend({ t: 'dmack', id: d.id, to: d.from });   // tell the sender it arrived (also when it came twice)
    if (st.dmSeen.has(d.id)) return;
    st.dmSeen.add(d.id); saveOut();
    const from = String(d.from || 'Player').slice(0, 20), text = String(d.text).slice(0, 300);
    addDm(from, { from, text, ts: +d.ts || Date.now(), me: false });
    if (ui.overlay === 'dm' && nameKey(ui.dmWith || '') === nameKey(from)) showDm(from);
    else { const k = nameKey(from); st.dmUnread[k] = (st.dmUnread[k] || 0) + 1; flash('✉ ' + from + ': ' + text.slice(0, 60), 3500); beep(); renderL(); }
  }
  // an individual board played: the score for your side (dir 'EW' when you sit East or West) and, once the
  // robot tables have played it, your IMPs and MP % against them
  function tourResult(id, b, ns, dir, f, con) {
    const t = st.tours[id]; if (!t) return;
    const R = st.tres[id] || (st.tres[id] = {}), key = devId();
    const me = R[key] || (R[key] = { name: myName() || 'Player', ns: {} });
    me.name = myName() || me.name; me.ns[b] = ns; if (dir === 'EW') me.dir = 'EW';
    if (f) (me.f || (me.f = {}))[b] = f;
    if (con) (me.c || (me.c = {}))[b] = con;   // the contract and result, shown under "Other tables"
    saveTours(); meshSend({ t: 'tres', id, key, r: me });
  }
  function onTourData(d) {
    if (d.t === 'tour') {
      const fresh = d.tour && !st.tours[d.tour.id];
      if (mergeTour(d.tour)) { saveTours(); const t = st.tours[d.tour.id]; if (invitedTo(t)) flash(T('{0} invites you to a tournament', t.by), 3500); else if (fresh && openTour(t) && t.state === 'live') flash('🏆 ' + T('{0} started a tournament — everyone can play it', t.by), 3500); renderL(); }
      return true;
    }
    if (d.t === 'tjoin') {
      const t = st.tours[d.id];
      if (isMine(t) && d.key) { const name = String(d.name || 'Player').slice(0, 20); if (d.ok) { t.joined[d.key] = name; delete t.declined[d.key]; } else { t.declined[d.key] = name; delete t.joined[d.key]; } pubTour(t); }
      return true;
    }
    if (d.t === 'tres') { if (mergeRes(d.id, d.key, d.r)) { saveTours(); renderL(); } return true; }
    if (d.t === 'tsync') {
      let ch = false;
      for (const id in (d.tours || {})) ch = mergeTour(d.tours[id]) || ch;
      for (const id in (d.res || {})) for (const k in d.res[id]) ch = mergeRes(id, k, d.res[id][k]) || ch;
      if (ch) { saveTours(); renderL(); }
      return true;
    }
    return false;
  }
  // names of the other players seen in the lobby (tables and recent chat), to pick from when inviting
  function knownNames() {
    const me = nameKey(myName() || ''), out = new Map();
    for (const t of (st.tables || [])) for (const n of [t.host, ...Object.values(t.names || {})]) if (n) out.set(nameKey(n), n);
    for (const m of (st.lchat || [])) if (Date.now() - m.ts < 6 * 3600e3) out.set(nameKey(m.from), m.from);
    out.delete(me); out.delete(nameKey('Player'));
    return [...out.values()].sort((a, b) => a.localeCompare(b));
  }
  /* The lobby is a small mesh: every open app keeps a line to every other room it has found. The lines carry
     table information (who sits where) and the lobby chat. A request is 'inforeq' ('info' without a room
     number from older versions); the answer is 'info' with the room number k. */
  function onLobbyData(conn, d) {
    if (d.t === 'inforeq' || (d.t === 'info' && d.k == null)) { try { conn.send(tableInfo()); } catch (e) {} meshAdd(conn); return true; }
    if (d.t === 'info') { gotInfo(d); return true; }
    if (d.t === 'lchat') { addL(d.m); return true; }
    if (d.t === 'lhist') { (d.list || []).forEach(m => addL(m, true)); renderL(); return true; }
    if (d.t === 'tblinv') { gotTableInvite(d); return true; }
    if (d.t === 'dm') { gotDm(d); return true; }
    if (d.t === 'dmack') { dmAcked(d); return true; }
    if (onTourData(d)) return true;
    return false;
  }
  function onSlotData(conn, d) {
    if (!d || !d.t) return;
    if (onLobbyData(conn, d)) return;
    if (d.t === 'hello' && st.guest) { try { conn.send({ t: 'declined' }); } catch (e) {} return; }   // sitting at someone else's table
    onHostData(conn, d);
  }
  // keep a lobby line (once per other app) and share the recent chat with it
  function meshAdd(conn) {
    const m = st.mesh || (st.mesh = new Map()), old = m.get(conn.peer);
    if (old === conn) return;
    m.set(conn.peer, conn);
    conn.on('close', () => { if (m.get(conn.peer) === conn) { m.delete(conn.peer); renderL(); } });
    try { conn.send({ t: 'lhist', list: (st.lchat || []).slice(-30) }); conn.send({ t: 'tsync', tours: st.tours, res: st.tres }); } catch (e) {}
    renderL(); deliverOut();
  }
  function gotInfo(d) {
    if (st.slot && d.k === st.slot.k) return;   // our own table
    if (st.collect && !st.collect.some(o => o.k === d.k)) st.collect.push(d);
    if (d.host) (st.roomOf || (st.roomOf = {}))[nameKey(d.host)] = d.k;   // each player's own lobby line (also when sitting elsewhere)
    if (d.busy) { st.tables = (st.tables || []).filter(t => t.k !== d.k); }
    else st.tables = [...(st.tables || []).filter(t => t.k !== d.k), d].sort((a, b) => a.k - b.k);   // show each table as soon as it answers
    render(); panelRefresh(); deliverOut();
  }
  // the tables in the lobby: ask every room who is there (rooms nobody holds simply do not answer)
  async function findTables() {
    if (st.finding) return; st.finding = true; render(); panelRefresh();
    const out = st.collect = [];
    try {
      await loadLib();
      await claimSlot();   // use our own address, so the lines stay open for chat and tournaments
      // our own room's address keeps the lines open for the chat; without one, a short-lived address is used
      const own = st.slot && !st.slot.peer.destroyed ? st.slot.peer : null;
      const p = own || await new Promise(res => { const p = new Peer(); p.on('open', () => res(p)); p.on('error', () => res(null)); setTimeout(() => res(null), 8000); });
      if (p) {
        const mesh = st.mesh || (st.mesh = new Map());
        for (let k = 1; k <= ROOMS; k++) {
          if (st.slot && st.slot.k === k) continue;
          const have = mesh.get(ROOM(k));
          if (have && have.open) { try { have.send({ t: 'inforeq' }); } catch (e) {} continue; }
          const c = p.connect(ROOM(k), { reliable: true });
          c.on('open', () => { c.send({ t: 'inforeq' }); if (own) meshAdd(c); });
          c.on('data', d => { if (d && d.t) onLobbyData(c, d); if (!own && d && d.t === 'info') { try { c.close(); } catch (e) {} } });
        }
        await new Promise(res => setTimeout(res, 8000));
        if (!own) { try { p.destroy(); } catch (e) {} }
      }
    } catch (e) {}
    st.tables = out.filter(t => !t.busy).sort((a, b) => a.k - b.k); st.tablesAt = Date.now(); st.finding = false; st.collect = null;
    render(); panelRefresh();
  }
  // the lobby list, used on the home page and in the Online panel
  // a private table is never listed (only invited players come)
  // listed: public online tables, and players at a board with robots who chose "open to others" (never someone on
  // the home page, a private table, or a player who chose to play alone)
  const listed = t => (t.online || ((t.pub || t.tplay || t.solo) && t.phase && t.phase !== 'idle'));   // every table in play shows (alone with robots: no joining)
  function tablesHtml() {
    // tables in play are listed: online tables, and players at a board with robots (not someone on the home page)
    const L = st.tables && st.tables.filter(listed);
    // each table is drawn as a table: the player's name or "Robot" at every side
    const rows = !L ? '' : L.length ? `<div class="tbls">${L.map(t => {
      const nm = t.names || {}, away = t.away || [];
      const pf = t.profs || {};
      const cells = [0, 1, 2, 3].map(s => nm[s] ? `<b class="pname" data-who="${esc(nm[s])}">${esc(nm[s])}</b>${(pf[s] || (!t.online && t.prof)) && profTxt(pf[s] || t.prof) ? `<span class="pb">${esc(profTxt(pf[s] || t.prof))}</span>` : ''}${away.includes(s) ? `<em>${T('away · robot plays')}</em>` : ''}` : `<i>${T('Robot')}</i>`);
      // a tournament is named on its table: an individual one can be joined (you play the same boards at your own table)
      const tp = t.tplay && typeof t.tplay === 'object' ? t.tplay : null, tt = t.tour && st.tours[t.tour.id];
      const tinfo = tp ? `<div class="ttour">🏆 ${esc(String(tp.name || '').slice(0, 40))} · ${T('board {0}', (+tp.b || 0) + '/' + (+tp.n || 0))}</div>`
        : tt ? `<div class="ttour">🏆 ${esc(tt.name)} · ${T('Table {0}', (+t.tour.ti || 0) + 1)}</div>` : '';
      const mid = `<div class="tname">${t.priv ? '🔒 ' : ''}${T("{0}'s table", esc(t.host))}</div>${tinfo}<div class="tstate">${t.online ? (t.priv ? T('Private table') : T('online')) : T('playing with robots')}${t.phase === 'lobby' ? ' · ' + T('waiting to start') : t.board && t.phase !== 'idle' && !tp ? ' · ' + T('board {0}', t.board) : ''}${t.watchers ? ' · 👁 ' + t.watchers : ''}</div>${tp ? `<button class="btn new" data-tjoin="${esc(String(tp.id))}">🏆 ${T('Join the tournament')}</button>` : `<button class="btn gold" data-jt="${t.k}">${T('Ask to join')}</button>`}${t.online && !t.priv ? `<button class="btn" data-jw="${t.k}">👁 ${T('Watch')}</button>` : ''}`;
      return seatTable(cells, mid, 2);
    }).join('')}</div>` : `<div class="muted">${T('No other tables are open right now.')}</div>`;
    return `<div class="tables">${rows}<button class="btn" id="nFind" ${st.finding ? 'disabled' : ''}>${st.finding ? T('Looking for tables…') : L ? T('Refresh the list') : T('Show open tables')}</button></div>`;
  }
  /* ---- lobby chat: everyone with the app open can talk; each message goes along every lobby line ---- */
  const lclearTs = () => { try { return +localStorage.getItem('bridge-lobby-cleared') || 0; } catch (e) { return 0; } };
  function addL(m, quiet) {
    if (!m || !m.id || !m.text) return;
    const L = st.lchat || (st.lchat = []);
    if ((+m.ts || 0) <= lclearTs()) return;   // cleared on this device: older messages do not come back from the others
    if (L.some(x => x.id === m.id)) return;
    L.push({ id: String(m.id).slice(0, 40), from: String(m.from || 'Player').slice(0, 20), text: String(m.text).slice(0, 200), ts: +m.ts || Date.now(), p: cleanProf(m.p) });
    L.sort((a, b) => a.ts - b.ts); if (L.length > 100) L.splice(0, L.length - 100);
    try { localStorage.setItem('bridge-lobby-chat', JSON.stringify(L.slice(-50))); } catch (e) {}
    if (!quiet) { if (m.from !== (myName() || 'Player') && ui.overlay !== 'lchat') st.lunread = (st.lunread || 0) + 1; renderL(); }
  }
  function lsend(text) {
    text = String(text || '').trim(); if (!text) return;
    if (!navigator.onLine) { flash(T('You are offline'), 1500); return; }
    const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), from: myName() || 'Player', text: text.slice(0, 200), ts: Date.now(), p: prof() };
    addL(m);
    for (const c of (st.mesh || new Map()).values()) if (c.open) { try { c.send({ t: 'lchat', m }); } catch (e) {} }
  }
  function lchatHtml() {
    const t = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), me = myName() || 'Player';
    const L = st.lchat || [];
    return L.length ? L.slice(-60).map(m => `<div class="cm${m.from === me ? ' me' : ''}"><b class="pname" data-who="${esc(m.from)}">${esc(m.from)}</b> ${esc(m.text)}</div>`).join('') : `<div class="muted">${T('No messages yet — say hello!')}</div>`;
  }
  const lobbyCount = () => 1 + [...(st.mesh || new Map()).values()].filter(c => c.open).length;
  // redraw what shows lobby things: the home page, the chat window (phones) and the tournament set-up
  const renderL = () => { if (typeof renderDock === 'function') renderDock(); if (G && G.phase === 'idle') render(); if (ui.overlay === 'lchat') showLChat(); if (ui.overlay === 'tsetup') showTourSetup(ui.tsetId); };
  // clear the lobby chat on this device
  function lclear() { st.lchat = []; st.lunread = 0; try { localStorage.removeItem('bridge-lobby-chat'); localStorage.setItem('bridge-lobby-cleared', String(Date.now())); } catch (e) {} renderL(); }
  try { (JSON.parse(localStorage.getItem('bridge-lobby-chat') || '[]') || []).forEach(m => addL(m, true)); } catch (e) {}
  /* ---- "seat me at a table": ask the best table that still has a robot for a seat ---- */
  function quickJoin() {
    if (!navigator.onLine) { flash(T('You are offline'), 1500); return; }
    const L = (st.tables || []).filter(t => listed(t) && !t.priv && !t.tplay && Object.keys(t.names || {}).length < 4);
    if (!L.length) { flash(T('No table has a free seat right now.'), 2500); if (!st.finding) findTables(); return; }
    // tables already online with friends first (more people to play with), then players alone
    L.sort((a, b) => (b.online - a.online) || (Object.keys(b.names || {}).length - Object.keys(a.names || {}).length) || a.k - b.k);
    const t = L[0], name = myName() || 'Guest';
    st.offer = t; st.want = 'any'; st.msg = '';
    flash(T('Asked {0} for a seat…', t.host), 2000);
    join('room-' + t.k, name, 'any');
  }
  // watch the most interesting table: an online table with the most people at it, already playing
  function quickWatch() {
    if (!navigator.onLine) { flash(T('You are offline'), 1500); return; }
    if (st.on) { flash(T('Leave the table you are at first'), 2000); return; }
    const L = (st.tables || []).filter(t => t.online && !t.priv && !t.busy);
    if (!L.length) { flash(T('No table to watch right now.'), 2500); if (!st.finding) findTables(); return; }
    const people = t => Object.keys(t.names || {}).length - (t.away || []).length;
    L.sort((a, b) => people(b) - people(a) || ((b.phase === 'play' || b.phase === 'bid') - (a.phase === 'play' || a.phase === 'bid')) || (b.watchers || 0) - (a.watchers || 0));
    const t = L[0];
    st.offer = t; st.want = 'watch'; st.msg = '';
    flash('👁 ' + T("{0}'s table", t.host), 2000);
    join('room-' + t.k, myName() || 'Guest', 'watch');
  }
  // this player's own table goes online: they become its host (requests are accepted one by one)
  function becomeHost() {
    if (st.host || !st.slot) return !!st.host;
    Object.assign(st, { peer: st.slot.peer, on: true, host: true, guest: false, me: 'host', code: 'room-' + st.slot.k, seats: { [SET.seat]: 'host' }, names: { [SET.seat]: myName() || 'Host' }, msg: '' });
    wakeOn(); ping(); st.score = { ns: 0, ew: 0, n: 0 }; st.asks = {}; st.profs = { [SET.seat]: prof() }; st.watch = new Map();
    if (!G || G.phase === 'idle') { clearTimeout(timer); G = lobbyG(); }
    save(); return true;
  }

  /* ---- host ---- */
  // the table owner opens an empty waiting room on purpose (with the host code)
  async function host(priv) {
    st.priv = !!priv; st.invited = [];
    st.msg = 'Opening the table…'; panel();
    try {
      await claimSlot();
      if (!st.slot) throw new Error('Could not reach the connection service. Try again in a moment.');
      becomeHost();
      // the table starts as an empty waiting room: no cards until everyone is seated and the host presses Start
      clearTimeout(timer); G = lobbyG(); save();
    } catch (e) { st.msg = e.message; }
    panel(); render(); tick();
  }
  // the host removes a player: a robot takes the seat and that player cannot come back to this table
  function kick(s) {
    if (!st.host) return; const id = st.seats[s]; if (!id || id === 'host') return;
    const who = st.names[s] || SEAT[s], c = st.conns.get(id), tok = (st.toks || {})[s];
    if (tok) (st.banned || (st.banned = [])).push(tok);
    st.conns.delete(id); delete st.seats[s]; delete st.names[s]; if (st.toks) delete st.toks[s];
    if (st.away && st.away[s]) { clearTimeout(st.away[s].t); delete st.away[s]; }
    if (c) { try { c.send({ t: 'kick' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 500); }
    addChat(null, who + ' was removed from the table; a robot plays ' + SEAT[s]);
    broadcast(); panelRefresh(); render(); tick();
  }
  // a seated guest moves to another empty seat while the table waits for Start
  function sit(s) { if (st.guest) { send({ t: 'sit', s }); flash('Asked the host to move you to ' + SEAT[s], 2000); } }
  /* seat a player: back is the seat a returning player gets back, otherwise a free seat is chosen
     (the partner's or an opponent's seat as they asked, or any free one) */
  // names are unique at a table: "Servet", "SERVET" and "Sérvet" count as the same name
  const nameKey = n => String(n || '').trim().toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/\s+/g, '');
  function nameTaken(n, except) {
    const k = nameKey(n || 'Guest');
    const names = st.host ? st.names : { [SET.seat]: myName() || 'Player' };   // before going online, only the player is at the table
    const watching = [...(st.watch || new Map()).values()].map(w => w.name);
    const used = Object.keys(names).filter(s => +s !== except).map(s => names[s]).concat(Object.values(st.pending || {}).map(p => p.d.name), watching);
    return used.some(u => nameKey(u) === k);
  }
  function seatPlayer(conn, d, back) {
    const hs = SET.seat, away = st.away || (st.away = {}), toks = st.toks || (st.toks = {});
    if (back != null) { const old = st.conns.get(st.seats[back]); st.conns.delete(st.seats[back]); if (old && old !== conn) { try { old.close(); } catch (e) {} } }
    const free = [0, 1, 2, 3].filter(s => !st.seats[s]);
    const pref = (d.want === 'partner' ? [(hs + 2) % 4] : d.want === 'opp' ? [(hs + 1) % 4, (hs + 3) % 4] : []).filter(s => free.includes(s));
    const assigned = st.invSeat && st.invSeat[nameKey(d.name)];   // a tournament table seats each player where the organiser put them
    const s = back != null ? back : assigned != null && free.includes(assigned) ? assigned : pref.length ? pref[0] : free[0];
    if (s == null) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); return; }
    if (back != null && away[s]) { clearTimeout(away[s].t); delete away[s]; }
    if (d.tok) { for (const k in toks) if (toks[k] === d.tok) delete toks[k]; toks[s] = d.tok; }
    st.seats[s] = conn.peer; st.names[s] = String(d.name || 'Guest').slice(0, 20); st.conns.set(conn.peer, conn);
    (st.profs || (st.profs = {}))[s] = cleanProf(d.prof, true);
    conn.send({ t: 'welcome', seat: s, id: conn.peer, code: st.code, chat: st.chat.slice(-50) });
    addChat(null, st.names[s] + (back != null ? ' is back' : ' joined as ' + SEAT[s]));
    ping();
    broadcast(); panelRefresh(); render(); tick();
  }
  // the host answers a join request
  function accept(id) {
    setTimeout(reqRefresh, 50);
    const p = st.pending && st.pending[id]; if (!p) return; delete st.pending[id];
    if (nameTaken(p.d.name)) { try { p.conn.send({ t: 'nametaken' }); } catch (e) {} setTimeout(() => { try { p.conn.close(); } catch (e) {} }, 500); panelRefresh(); render(); return; }
    if (!p.conn.open) { panelRefresh(); render(); return; }
    if (p.d.want === 'watch') { if (st.host) addWatcher(p.conn, p.d); return; }
    becomeHost();   // the first accepted player turns this table into an online table
    seatPlayer(p.conn, p.d, null);
  }
  // a spectator: sees all four hands, cannot bid or play, can chat
  function addWatcher(conn, d) {
    const name = String(d.name || 'Guest').slice(0, 20);
    (st.watch || (st.watch = new Map())).set(conn.peer, { conn, name });
    if (d.tok) { const w = st.watchToks || (st.watchToks = []); if (!w.includes(d.tok)) w.push(d.tok); }
    try { conn.send({ t: 'welcome', seat: SET.seat, watch: true, id: conn.peer, code: st.code, chat: st.chat.slice(-50) }); } catch (e) {}
    addChat(null, name + ' is watching 👁');
    ping(); broadcast(); panelRefresh(); render();
  }
  // requests answered on this device, remembered for 30 minutes by name: 'no' (declined) or 'later' (window closed)
  function reqMute(name, kind) {
    let m = {}; try { m = JSON.parse(localStorage.getItem('bridge-req-mute') || '{}') || {}; } catch (e) {}
    const now = Date.now(); for (const k in m) if (now - m[k].ts > 30 * 60e3) delete m[k];
    const k = nameKey(name || 'Guest');
    if (kind) { m[k] = { kind, ts: now }; try { localStorage.setItem('bridge-req-mute', JSON.stringify(m)); } catch (e) {} }
    return m[k] ? m[k].kind : null;
  }
  // close the request window without answering: the request waits in the Online panel and does not pop up again
  function reqLater(id) {
    const p = st.pending && st.pending[id]; if (p) { p.quiet = true; reqMute(p.d.rq ? "rq:" + p.d.rq : p.d.name, 'later'); }
    if (ui.overlay === 'req') closeOv(); showReq(); panelRefresh();
  }
  function decline(id) {
    setTimeout(reqRefresh, 50);
    const p = st.pending && st.pending[id]; if (!p) return; delete st.pending[id];
    reqMute(p.d.rq ? "rq:" + p.d.rq : p.d.name, 'no');
    try { p.conn.send({ t: 'declined' }); } catch (e) {} setTimeout(() => { try { p.conn.close(); } catch (e) {} }, 500);
    panelRefresh(); render();
  }
  /* a join request opens its own window (with a sound), so it is not missed during play; when it is answered
     the next one, if any, is shown */
  function showReq() {
    const pend = Object.entries(st.pending || {}).filter(([, p]) => !p.quiet);
    if (!pend.length) { if (ui.overlay === 'req') closeOv(); return; }
    if (ui.overlay && ui.overlay !== 'req' && ui.overlay !== 'net' && ui.overlay !== 'lchat') { flash(String(pend[0][1].d.name || 'Guest').slice(0, 20) + ' — ' + T('Asking to join'), 3000); return; }
    const [id, p] = pend[0], name = esc(String(p.d.name || 'Guest').slice(0, 20));
    const what = p.d.want === 'watch' ? T('wants to watch your table') : T('wants to join your table');
    openOv('req', `<h2>🔔 ${name}</h2><div class="big">${what}${p.d.want === 'opp' ? ' ' + T('(opponent)') : p.d.want === 'partner' ? ' ' + T('(partner)') : ''}</div>
      ${p.d.prof && profTxt(p.d.prof) ? `<div class="muted">${esc(profTxt(p.d.prof))}</div>` : ''}
      ${pend.length > 1 ? `<div class="muted">+${pend.length - 1} ${T('more waiting')}</div>` : ''}
      <div class="row2"><button class="btn new" data-accept="${esc(id)}">${T('Accept')}</button><button class="btn" data-decline="${esc(id)}">${T('Decline')}</button></div>
      <div class="row2"><button class="btn" data-reqlater="${esc(id)}">✕ ${T('Close — answer later')}</button></div>`);
  }
  const reqRefresh = () => { if (ui.overlay === 'req') showReq(); else panelRefresh(); };
  /* invitations to your table: sent along the lobby lines to a player by name; they join with one tap and sit
     down without waiting (this is the way into a private table) */
  // seat: where the invited player sits (your partner's seat when you play together)
  function inviteToTable(name, seat) {
    if (!st.host || !st.slot) { flash(T('Open an online table first'), 2000); return; }
    const inv = st.invited || (st.invited = []); if (!inv.includes(nameKey(name))) inv.push(nameKey(name));
    if (seat != null) (st.invSeat || (st.invSeat = {}))[nameKey(name)] = seat;
    meshSend({ t: 'tblinv', k: st.slot.k, host: myName() || 'Host', to: name, priv: !!st.priv, partner: seat != null && seat === (SET.seat + 2) % 4 });
    flash(T('Invitation sent to {0}', name), 2000); render();
  }
  function gotTableInvite(d) {
    if (!d || nameKey(d.to) !== nameKey(myName() || '') || st.on) return;
    st.tinv = d; beep();
    openOv('tinv', `<h2>🔔 ${esc(d.host)}</h2><div class="big">${d.partner ? '🤝 ' + T('wants to play with you as partners') : T('invites you to their table')}</div>
      <div class="row2"><button class="btn new" id="tinvYes">${T('Join')}</button><button class="btn" id="oClose">${T('Not now')}</button></div>`);
  }
  function joinInvite() {
    const d = st.tinv; if (!d) return; st.tinv = null;
    st.offer = { k: d.k, host: d.host, names: {} }; st.want = 'any'; st.msg = '';
    join('room-' + d.k, myName() || 'Guest', 'any');
  }
  // the players seen in the lobby; with your table open, each can be invited with one tap
  function peopleHtml() {
    const names = knownNames();
    if (!names.length) return `<div class="muted">${T('Nobody else is in the lobby right now.')}</div>`;
    const sent = st.invited || [];
    const un = n => st.dmUnread[nameKey(n)] ? ` <span class="badge">${st.dmUnread[nameKey(n)]}</span>` : "";
    return `<div class="people">${names.map(n => `<div class="person"><b>${esc(n)}</b><span class="pbtns"><button class="btn" data-dm="${esc(n)}" title="${T("Message")}">💬${un(n)}</button>${st.host ? (sent.includes(nameKey(n)) ? `<span class="muted">${T('invited')}</span>` : `<button class="btn gold" data-tblinv="${esc(n)}">${T('Invite to my table')}</button>`) : ''}</span></div>`).join('')}</div>
      ${st.host ? '' : `<div class="muted">${T('Open an online table to invite players to it.')}</div>`}`;
  }
  function onHostData(conn, d) {
    if (!d || !d.t) return;
    const seatOf = id => +Object.keys(st.seats).find(s => st.seats[s] === id);
    // a seated player asks to move to an empty seat: the host decides (between boards or in the waiting room)
    if (d.t === 'sit') {
      const from = seatOf(conn.peer), to = +d.s;
      if (Number.isNaN(from) || !(to >= 0 && to < 4) || st.seats[to] || !G || !(G.phase === 'lobby' || G.phase === 'done')) { try { conn.send({ t: 'movedeclined' }); } catch (e) {} return; }
      (st.moves || (st.moves = {}))[conn.peer] = { from, to };
      flash((st.names[from] || SEAT[from]) + ' wants to move to ' + SEAT[to], 3000); panel(); render();
      return;
    }
    if (d.t === 'hello') {
      if (d.tok && (st.banned || []).includes(d.tok)) { conn.send({ t: 'kick' }); setTimeout(() => conn.close(), 500); return; }
      // spectators: a solo table cannot be watched; a spectator who comes back is let in again at once
      if (d.want === 'watch' && !st.host) { try { conn.send({ t: 'declined' }); } catch (e) {} return; }
      if (d.want === 'watch' && d.tok && (st.watchToks || []).includes(d.tok)) { addWatcher(conn, d); return; }
      const away = st.away || (st.away = {});
      // a player coming back after a dropped connection gets the seat that was kept for them
      // (recognised by the device token, even before this side has noticed the old connection died)
      const toks = st.toks || (st.toks = {});
      const byTok = d.tok ? Object.keys(toks).find(k => toks[k] === d.tok && st.seats[k] && st.seats[k] !== 'host') : null;
      const back = byTok != null ? +byTok : d.seat != null && away[d.seat] ? +d.seat : null;
      // a new player waits until the host accepts them
      if (back == null) {
        if (nameTaken(d.name)) { conn.send({ t: 'nametaken' }); setTimeout(() => conn.close(), 500); return; }
        // someone you invited sits down at once; a private table (🔒 in the lobby) takes no spectators, others ask the host
        const inv = (st.invited || []).includes(nameKey(d.name));
        if (inv && st.host && d.want !== 'watch') { st.invited = st.invited.filter(x => x !== nameKey(d.name)); seatPlayer(conn, d, null); return; }
        // a public online table takes spectators at once; the players see who is watching
        if (d.want === 'watch' && st.host && !st.priv) { addWatcher(conn, d); return; }
        if (st.priv && st.host && !inv && d.want === 'watch') { try { conn.send({ t: 'declined' }); } catch (e) {} return; }
        // a request answered recently (also before a page refresh) is not asked again: declined stays declined,
        // "later" waits quietly in the Online panel
        const mu = reqMute(d.rq ? "rq:" + d.rq : d.name);
        if (mu === 'no') { try { conn.send({ t: 'declined' }); } catch (e) {} setTimeout(() => { try { conn.close(); } catch (e) {} }, 500); return; }
        (st.pending || (st.pending = {}))[conn.peer] = { conn, d, quiet: mu === 'later' };
        conn.send({ t: 'wait' });
        conn.on('close', () => { if (st.pending && st.pending[conn.peer]) { delete st.pending[conn.peer]; reqRefresh(); render(); } });
        if (mu === 'later') { panelRefresh(); return; }
        showReq(); beep();
        return;
      }
      seatPlayer(conn, d, back);
      return;
    }
    // a spectator may only chat
    const wt = st.watch && st.watch.get(conn.peer);
    if (wt) { if (d.t === 'chat') addChat(wt.name + ' 👁', d.text); if (d.t === 'leave') { st.watch.delete(conn.peer); addChat(null, wt.name + ' stopped watching'); broadcast(); panelRefresh(); render(); } return; }
    const seat = seatOf(conn.peer); if (Number.isNaN(seat)) return;
    // a guest asks for a new deal during play, or for the table score to be reset: the host decides
    if (d.t === 'ndreq' || d.t === 'rsreq') { (st.asks || (st.asks = {}))[conn.peer] = { kind: d.t === 'ndreq' ? 'nd' : 'rs', seat }; flash((st.names[seat] || SEAT[seat]) + ' ' + T(d.t === 'ndreq' ? 'asks for a new deal' : 'asks to reset the table score'), 3000); panel(); render(); return; }
    const who = st.names[seat] || SEAT[seat];
    if (d.t === 'leave') { delete st.seats[seat]; delete st.names[seat]; if (st.toks) delete st.toks[seat]; if (st.away && st.away[seat]) { clearTimeout(st.away[seat].t); delete st.away[seat]; } st.conns.delete(conn.peer); addChat(null, who + ' left the table — a robot plays ' + SEAT[seat]); broadcast(); panelRefresh(); render(); tick(); return; }
    if (d.t === "chat") { addChat(who, d.text); return; }
    if (d.t === "undo") { requestUndo(conn.peer, who, seat); return; }   // the other side may say no
    if (d.t === "claim") { if (G.phase === "play" && !G.play.trick.length && owner(G.play.turn) === conn.peer) { const left = G.play.hands[G.play.turn].length, n = Number.isFinite(+d.n) ? Math.max(0, Math.min(+d.n, left)) : left; requestClaim(G.play.turn, n, who); } return; }
    if (d.t === "askreply") { const f = askP[d.id]; if (f && f.who.includes(conn.peer)) f.fin(!!d.ok); return; }
    if (d.t === "replay") { if (G.phase === "done") { addChat(null, who + " asked to replay this deal"); replayDeal(); } return; }
    if (d.t === "hint") { if (G.phase === "play" && owner(G.play.turn) === conn.peer && G.play.trick.length < 4) conn.send({ t: "hint", c: E.aiPlay(G.play, G.play.turn), id: G.id }); return; }
    if (d.t === "call" && G.phase === "bid" && owner(bidTurn()) === conn.peer) makeCall(bidTurn(), d.call, undefined, d.al ? String(d.al).slice(0, 120) : undefined);
    else if (d.t === 'card' && G.phase === 'play' && owner(G.play.turn) === conn.peer) playCard(G.play.turn, d.c);
    else if (d.t === 'next' && G.phase === 'done') nextDeal();
  }
  // a guest's connection dropped: a robot plays the seat at once, and the seat is kept for them for 10 minutes
  // (they get it back without asking when they return)
  function drop(conn) {
    const wt = st.watch && st.watch.get(conn.peer);
    if (wt && wt.conn === conn) { st.watch.delete(conn.peer); addChat(null, wt.name + ' stopped watching'); broadcast(); panelRefresh(); render(); return; }
    if (st.conns.get(conn.peer) !== conn) return;
    const s = Object.keys(st.seats).find(k => st.seats[k] === conn.peer);
    st.conns.delete(conn.peer);
    if (s == null || !st.host) return;
    const away = st.away || (st.away = {}), who = st.names[s] || SEAT[s];
    if (st.moves) delete st.moves[conn.peer];
    addChat(null, who + ' lost the connection — a robot plays ' + SEAT[s] + ' until they are back');
    away[s] = { t: setTimeout(() => {
      if (!away[s] || st.seats[s] !== conn.peer) return;
      delete away[s]; delete st.seats[s]; delete st.names[s]; if (st.toks) delete st.toks[s];
      addChat(null, who + ' did not come back — the seat is free');
      broadcast(); panelRefresh(); render(); tick();
    }, 600000) };
    broadcast(); panelRefresh(); render(); tick();
  }
  // the host answers a request to change seats
  function moveAnswer(id, ok) {
    const m = st.moves && st.moves[id]; if (!m) return; delete st.moves[id];
    const c = st.conns.get(id);
    if (ok && !st.seats[m.to] && st.seats[m.from] === id && G && (G.phase === 'lobby' || G.phase === 'done')) {
      const from = m.from, to = m.to;
      st.seats[to] = st.seats[from]; st.names[to] = st.names[from]; delete st.seats[from]; delete st.names[from];
      const toks = st.toks || {}; if (toks[from]) { toks[to] = toks[from]; delete toks[from]; }
      try { c && c.send({ t: 'seat', seat: to }); } catch (e) {}
      addChat(null, st.names[to] + ' moved to ' + SEAT[to]);
    } else { try { c && c.send({ t: 'movedeclined' }); } catch (e) {} }
    broadcast(); panelRefresh(); render(); tick();
  }
  function stop() {
    if (st.seatBak != null) { SET.seat = st.seatBak; st.seatBak = null; } st.tour = null; st.invSeat = {};
    for (const c of st.conns.values()) { try { c.send({ t: 'bye' }); } catch (e) {} }
    for (const w of (st.watch || new Map()).values()) { try { w.conn.send({ t: 'bye' }); } catch (e) {} setTimeout(() => { try { w.conn.close(); } catch (e) {} }, 500); }
    st.watch = new Map(); st.watchToks = []; st.priv = false; st.invited = [];
    for (const a of Object.values(st.away || {})) clearTimeout(a.t); st.away = {};
    const cs = [...st.conns.values()];   // close a moment later so the goodbye arrives first (the room address is kept)
    setTimeout(() => { for (const c of cs) { try { c.close(); } catch (e) {} } }, 500);
    wakeOff();
    Object.assign(st, { on: false, host: false, guest: false, me: 'local', peer: null, conn: null, conns: new Map(), seats: {}, names: {}, ctl: null, code: null, msg: '' });
    if (G && G.phase === "lobby") { G = idleG(); render(); return; }   // nobody started: back to the start screen
    render(); tick();
  }

  /* ---- guest ---- */
  // retry: reconnecting after a dropped connection (screen locked, app switched, network blip) — same seat, no join screen
  async function join(code, name, want, retry, auto) {
    setName(name);
    // each request you make has its own number; automatic tries (reconnecting, coming back after a refresh) reuse it,
    // so the host is not asked again for a request already answered, but a new request of yours is always asked
    let rq = null; try { rq = localStorage.getItem("bridge-req-id"); } catch (e) {}
    if (!(retry || auto) || !rq) { rq = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); try { localStorage.setItem("bridge-req-id", rq); } catch (e) {} }
    if (!retry) { st.msg = 'Connecting to table ' + code + '…'; showJoin(code); }
    try {
      await loadLib();
      const peer = await new Promise((res, rej) => { const p = new Peer(); p.on('open', () => res(p)); p.on('error', e => rej(new Error('Could not reach the connection service (' + (e.type || 'error') + ').'))); });
      const conn = peer.connect(PREFIX + code, { reliable: true });
      st.joinPeer = peer;
      let welcomed = false, failed = false, waiting = false;
      const fail = msg => { if (welcomed || failed) return; failed = true; try { peer.destroy(); } catch (e) {} if (retry) { retry(false); return; } forgetTable(); st.msg = msg; showJoin(code); };
      setTimeout(() => { if (!welcomed && !waiting) fail('The table could not be reached. Check the link, and that the host still has the app open. Some mobile networks block direct connections — try Wi-Fi.'); }, retry ? 8000 : 15000);
      peer.on('error', e => { if (e.type === 'peer-unavailable') fail('That table is not open any more.'); });
      peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} });
      conn.on('open', () => conn.send({ t: 'hello', name, want, rq, tok: devTok(), prof: prof(), seat: retry ? st.seat : undefined }));
      conn.on('data', d => {
        if (!d) return;
        if (d.t === 'welcome') {
          welcomed = true; clearTimeout(timer);
          st.waiting = false; st.watching = !!d.watch;
          rememberTable({ code, name, want, watch: !!d.watch });
          Object.assign(st, { peer, conn, on: true, guest: true, host: false, me: peer.id, seat: d.seat, code, msg: "", savedG: st.savedG || (G && G.phase === "idle" ? ui.saved : G), chat: d.chat || st.chat || [], unread: 0, rejoin: { code, name, want } });
          if (retry) retry(true); else closeOv();
          wakeOn(); ping();
        } else if (d.t === 'state') applyState(d.v);
        else if (d.t === "full") fail("That table is full.");
        else if (d.t === "chat") gotChat(d.m);
        else if (d.t === "seat") { st.seat = d.seat; render(); }
        else if (d.t === "askno") flash(T('The host said no'), 2500);
        else if (d.t === "ask") { st.askId = d.id; askLocal(d.a || {}, ok => { send({ t: 'askreply', id: d.id, ok }); askClose(); }); }
        else if (d.t === "askdone") { if (st.askId === d.id) askClose(); }
        else if (d.t === "nudge") nudged(+d.s || 0);
        else if (d.t === "movedeclined") flash('The host did not agree to the move', 2500);
        else if (d.t === "wait") { waiting = true; st.waiting = true; st.msg = 'Waiting for the host to accept you…'; showJoin(code); }
        else if (d.t === "nametaken") { waiting = false; st.waiting = false; failed = true; try { peer.destroy(); } catch (e) {} st.msg = 'The name ' + name + ' is already used at this table. Choose another name.'; showJoin(code); }
        else if (d.t === "declined") { waiting = false; st.waiting = false; failed = true; try { peer.destroy(); } catch (e) {} st.msg = 'The host did not accept the request.'; showJoin(code); }
        else if (d.t === "kick") { st.rejoin = null; if (st.guest) leave('The host removed you from the table.'); else { st.msg = 'The host removed you from this table.'; showJoin(code); } }
        else if (d.t === "bye") { st.rejoin = null; if (st.guest) leave('The host closed the table.'); }
        else if (d.t === "hint" && G && d.id === G.id && G.phase === "play") { ui.hintCard = d.c; render(); }
      });
      conn.on('close', () => { if (st.guest && st.conn === conn) lost(); });
    } catch (e) { if (retry) retry(false); else { st.msg = e.message; showJoin(code); } }
  }
  /* the table you sit at is remembered on the device: if the app is closed or the phone drops out, opening
     the app again takes you straight back to the same table and seat (the host knows you by your device id) */
  const LAST_KEY = 'bridge-last-table';
  function rememberTable(t) { try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...t, ts: Date.now() })); } catch (e) {} }
  function forgetTable() { try { localStorage.removeItem(LAST_KEY); } catch (e) {} }
  function touchTable() { try { const t = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); if (t && Date.now() - t.ts > 30000) { t.ts = Date.now(); localStorage.setItem(LAST_KEY, JSON.stringify(t)); } } catch (e) {} }
  function autoRejoin() {
    if (st.on || st.waiting || /#join-/.test(location.hash)) return;
    let t = null; try { t = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) {}
    if (!t || !t.code) return;
    if (Date.now() - t.ts > 10 * 60000) { forgetTable(); return; }   // the host keeps a seat for 10 minutes
    st.want = t.watch ? 'watch' : t.want || 'partner'; st.offer = null;
    flash(T('Going back to your table…'), 2500);
    join(t.code, t.name, st.want, undefined, true);
  }
  // the connection dropped: keep the table on screen and try to get back in for two minutes
  function lost() {
    if (st.reconnecting || !st.rejoin) { if (!st.reconnecting) leave('The connection to the table was lost.'); return; }
    st.reconnecting = true; st.conn = null;
    const until = Date.now() + 120000, r = st.rejoin;
    const tryOnce = () => {
      if (!st.guest || st.rejoin !== r) { st.reconnecting = false; return; }
      if (Date.now() > until) { st.reconnecting = false; leave('Could not get back to the table. Open the invite link again to rejoin.'); return; }
      flash('Connection lost — reconnecting…', 2500);
      try { st.peer && st.peer.destroy(); } catch (e) {}
      join(r.code, r.name, r.want, ok => { if (ok) { st.reconnecting = false; flash('Back at the table', 1500); } else setTimeout(tryOnce, 2500); });
    };
    tryOnce();
  }
  // a small message every 10 s keeps mobile networks from closing an idle connection
  let pingT = null;
  function ping() {
    clearInterval(pingT);
    pingT = setInterval(() => {
      if (st.guest) { if (st.conn && st.conn.open) { try { st.conn.send({ t: 'ping' }); } catch (e) {} } }
      else if (st.host) { for (const c of st.conns.values()) if (c.open) { try { c.send({ t: 'ping' }); } catch (e) {} } }
      else clearInterval(pingT);
    }, 10000);
  }
  // back from the lock screen or another app: reconnect at once if the line went dead meanwhile
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (st.guest && !st.reconnecting && !(st.conn && st.conn.open)) lost();
    if ((st.guest || st.host) && (!st.wake || st.wake.released)) wakeOn();
    if (st.host && st.peer && st.peer.disconnected && !st.peer.destroyed) { try { st.peer.reconnect(); } catch (e) {} }
  });
  function applyState(v) {
    clearTimeout(timer);
    if (v.phase !== "done") HIST = HIST.filter(h => !(h.id === v.id && h.online)); // a finished board was taken back
    st.ctl = v.ctl; st.names = v.names || {}; st.away = Object.fromEntries((Array.isArray(v.away) ? v.away : []).map(s => [+s, {}])); st.score = v.score || null;
    touchTable();
    G = v;
    if (G.phase === 'done' && G.result) {
      // keep the board in your own results and statistics
      let e = HIST.find(h => h.id === G.id);
      if (!e) {
        const r = G.result; e = { ...r, seat: st.seat, us: sideOf(st.seat) === 0 ? r.ns : -r.ns, imp: null, mp: null, online: true };
        HIST.push(e); SEEN.add(E.dealKey(G.deal)); saveSeen();
      }
      if (e.imp == null && G.field && G.field.done) applyField(e, G.field);
      Store.saveRec(e); save();
    }
    render();
    if (ui.overlay === 'end') showEnd();
  }
  function leave(msg) {
    forgetTable();
    // leave the table first, then close the line: closing can report "connection lost" at once, and that
    // must not start a reconnection
    const c = st.conn, p = st.peer, back = st.savedG;
    Object.assign(st, { on: false, guest: false, me: 'local', peer: null, conn: null, ctl: null, names: {}, code: null, savedG: null, rejoin: null, reconnecting: false, watching: false });
    try { if (c && c.open && !msg) c.send({ t: 'leave' }); } catch (e) {}   // tell the host, so the seat is freed at once
    setTimeout(() => { try { c && c.close(); } catch (e) {} try { p && p.destroy(); } catch (e) {} }, 300);
    wakeOff();
    G = back && back.phase !== "lobby" ? back : idleG(); render(); tick();
    if (msg) flash(msg, 3000);
  }

  /* ---- chat (the host relays every message to the whole table) ---- */
  const myTableName = () => st.names[st.guest ? st.seat : SET.seat] || myName() || 'Me';
  function addChat(from, text) {
    text = String(text || '').trim().slice(0, 200); if (!text || !st.host) return;
    const m = { from, text, ts: Date.now() };
    st.chat.push(m); if (st.chat.length > 200) st.chat.shift();
    for (const c of st.conns.values()) if (c.open) { try { c.send({ t: 'chat', m }); } catch (e) {} }
    gotChat(m, true);
  }
  function gotChat(m, mine) {
    if (!mine) { st.chat.push(m); if (st.chat.length > 200) st.chat.shift(); }
    if (typeof renderDock === 'function') renderDock();
    if (ui.overlay === 'chat') { chatPanel(); return; }
    if (m.from !== myTableName() && !(ui.dockOpen || dockWide())) { st.unread++; flash((m.from ? m.from + ': ' : '') + m.text, 2600); }
    renderBar();
  }
  function sendChat(text) {
    text = String(text || '').trim(); if (!text) return;
    if (st.host) addChat(myTableName(), text); else send({ t: 'chat', text });
  }
  const QUICK = ['Hi!', 'Well played', 'Thanks partner', 'Sorry partner', 'Good luck', 'Ready?', 'One more?', '👍', '😂', '🙈'];
  // the table chat as a list (for the chat column)
  function tchatHtml() {
    const t = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return st.chat.slice(-80).map(m => m.from ? `<div class="cm${m.from === myTableName() ? ' me' : ''}"><b>${esc(m.from)}</b> ${esc(m.text)}<small>${t(m.ts)}</small></div>` : `<div class="cm sys">${esc(m.text)}<small>${t(m.ts)}</small></div>`).join('') || `<div class="muted">${T('No messages yet — say hello!')}</div>`;
  }
  function chatPanel() {
    const draft = document.getElementById('nMsg'); if (draft) st.draft = draft.value;
    st.unread = 0;
    const t = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const list = st.chat.slice(-60).map(m => m.from ? `<div class="cm${m.from === myTableName() ? ' me' : ''}"><b>${esc(m.from)}</b> ${esc(m.text)}<small>${t(m.ts)}</small></div>` : `<div class="cm sys">${esc(m.text)}<small>${t(m.ts)}</small></div>`).join('') || '<div class="muted">No messages yet — say hello!</div>';
    openOv('chat', `<h2>Table chat</h2><div class="chatlist" id="nList">${list}</div>
      <div class="quick">${QUICK.map(q => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="row2"><input class="tok" id="nMsg" maxlength="200" placeholder="Write a message…" value="${esc(st.draft || '')}"><button class="btn gold" id="nSend">Send</button></div>
      <div class="row2"><button class="btn" id="oClose">Close</button></div>`);
    const L = document.getElementById('nList'); if (L) L.scrollTop = L.scrollHeight;
    renderBar();
  }

  /* ---- questions to players (a claim, a robot claim, an undo): the first answer decides; no answer in 90 s = no.
     "host" is this device (asked on screen), other owners are asked over their line. ---- */
  const askP = {};
  function askOwners(owners, a) {
    return new Promise(res => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      let done = false;
      const fin = ok => { if (done) return; done = true; delete askP[id]; askClose(); for (const o of owners) { const c = st.conns.get(o); if (c && c.open) { try { c.send({ t: 'askdone', id }); } catch (e) {} } } res(ok); };
      askP[id] = { fin, who: owners };
      for (const o of owners) {
        if (o === 'host' || o === 'local') askLocal(a, fin);
        else { const c = st.conns.get(o); if (c && c.open) { try { c.send({ t: 'ask', id, a }); } catch (e) {} } }
      }
      setTimeout(() => fin(false), 90000);
    });
  }

  /* ---- table score (NS against EW, points of every board played at this online table) ---- */
  function boardDone(e) {
    if (!st.host || !e) return;
    const s = st.score || (st.score = { ns: 0, ew: 0, n: 0 });
    if (e.ns > 0) s.ns += e.ns; else s.ew -= e.ns || 0;
    s.n++; broadcast();
  }
  function scoreHtml() {
    const s = st.score; if (!st.on) return '';
    const line = s ? `NS <b>${s.ns}</b> – EW <b>${s.ew}</b> · ${s.n} ${T('boards')}` : '—';
    const btns = st.host ? `<button class="btn" id="nRst">${T('Reset the score')}</button>`
      : st.watching ? '' : `<button class="btn" id="nRstQ">${T('Ask to reset the score')}</button>${G && (G.phase === 'bid' || G.phase === 'play') ? `<button class="btn" id="nNdQ">${T('Ask for a new deal')}</button>` : ''}`;
    return `<div class="grp"><span>${T('Table score')}</span><div>${line}</div><div class="row2">${btns}</div></div>`;
  }
  // the host answers a guest's request (a new deal during play, or a fresh score)
  function askAnswer(id, ok) {
    const a = st.asks && st.asks[id]; if (!a) return; delete st.asks[id];
    const who = st.names[a.seat] || SEAT[a.seat], c = st.conns.get(id);
    if (!ok) { try { c && c.send({ t: 'askno' }); } catch (e) {} panelRefresh(); render(); return; }
    if (a.kind === 'rs') { st.score = { ns: 0, ew: 0, n: 0 }; addChat(null, 'The table score was reset (asked by ' + who + ')'); broadcast(); }
    else { addChat(null, 'New deal (asked by ' + who + ')'); newBoard(); }
    panelRefresh(); render();
  }
  function resetScore() { if (!st.host) return; st.score = { ns: 0, ew: 0, n: 0 }; addChat(null, 'The table score was reset'); broadcast(); panelRefresh(); render(); }
  function askNewDeal() { send({ t: 'ndreq' }); flash(T('Asked the host for a new deal'), 2000); }

  /* ---- screens ---- */
  // players asking to join this table, each with Accept / Decline
  function pendHtml() {
    const pend = Object.entries(st.pending || {}), mv = Object.entries(st.moves || {});
    const moves = mv.length ? `<div class="grp"><span>${T('Asking to change seats')}</span>${mv.map(([id, m]) => `<div class="helprow"><span><b>${esc(st.names[m.from] || SEAT[m.from])}</b> ${SEAT[m.from]} → ${SEAT[m.to]}</span><span><button class="btn gold" data-mva="${esc(id)}">${T('Accept')}</button> <button class="btn" data-mvd="${esc(id)}">${T('Decline')}</button></span></div>`).join('')}</div>` : '';
    const join = pend.length ? `<div class="grp"><span>${T('Asking to join')}</span>${pend.map(([id, p]) => `<div class="helprow"><span><b>${esc(String(p.d.name || 'Guest').slice(0, 20))}</b> ${p.d.want === 'opp' ? T('(opponent)') : p.d.want === 'watch' ? '👁 ' + T('Watch') : p.d.want === 'any' ? '' : T('(partner)')}</span><span><button class="btn gold" data-accept="${esc(id)}">${T('Accept')}</button> <button class="btn" data-decline="${esc(id)}">${T('Decline')}</button></span></div>`).join('')}</div>` : '';
    const asks = Object.entries(st.asks || {}).map(([id, a]) => `<div class="helprow"><span><b>${esc(st.names[a.seat] || SEAT[a.seat])}</b> ${T(a.kind === 'nd' ? 'asks for a new deal' : 'asks to reset the table score')}</span><span><button class="btn gold" data-aska="${esc(id)}">${T('Accept')}</button> <button class="btn" data-askd="${esc(id)}">${T('Decline')}</button></span></div>`).join('');
    return (asks ? `<div class="grp">${asks}</div>` : '') + moves + join;
  }
  function panel() {
    if (st.guest) {
      openOv('net', `<h2>${T('Online table')}</h2><div>${st.watching ? '👁 ' + T('You are watching this table.') : `You sit <b>${SEAT[st.seat]}</b>. The host's device runs the table; robots fill the empty seats.`}</div>
        ${!st.watching && G && (G.phase === 'lobby' || G.phase === 'done') ? `<div class="grp"><span>Move to another seat (the host decides)</span><div class="row2">${[0, 1, 2, 3].filter(s => s !== st.seat && !(st.names || {})[s]).map(s => `<button class="btn" data-sit="${s}">${SEAT[s]}</button>`).join('') || '<span class="muted">No free seat</span>'}</div></div>` : ''}
        ${scoreHtml()}
        <div class="row2"><button class="btn" id="nLeave">🚪 ${T('Leave the table')}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
      return;
    }
    if (st.host) {
      const L = link(), wa = 'https://wa.me/?text=' + encodeURIComponent('Bridge: open ' + L + ' and ask to join my table');
      openOv('net', `<h2>Your online table</h2>
        ${pendHtml()}
        <div class="grp"><span>👥 ${T('Invite players')}${st.priv ? ' · 🔒 ' + T('Private table') : ''}</span>${peopleHtml()}</div>
        <div class="grp"><span>App link</span><input class="tok wide" id="nLink" readonly value="${esc(L)}"></div>
        <div class="row2"><a class="btn gold" href="${wa}" target="_blank" rel="noopener">Send on WhatsApp</a><button class="btn" id="nCopy">Copy link</button></div>
        <div class="grp"><span>Seats</span>${[0, 1, 2, 3].map(s => `<div class="helprow"><span><b>${SEAT[s]}</b></span><span>${st.seats[s] === 'host' ? esc(st.names[s]) + ' (you)' : st.seats[s] ? esc(st.names[s]) + ` <button class="btn" data-kick="${s}">Remove</button>` : '<i>Robot</i>'}</span></div>`).join('')}</div>
        <div class="muted">Anyone who opens the app link while your table is open can ask to join; you accept or decline each request. Keep this app open while you play: your device runs the table. Robots play any seat that is empty or whose player leaves.</div>
        ${st.msg ? `<div class="err">${esc(st.msg)}</div>` : ''}
        ${scoreHtml()}
        <div class="row2"><button class="btn" id="nStop">Close the table</button><button class="btn gold" id="oClose">Done</button></div>`);
      return;
    }
    openOv('net', `<h2>Play online</h2>
      ${pendHtml()}
      <div class="muted">${T('Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.')}${st.slot ? '' : ' (connecting…)'}</div>
      <div class="grp"><span>Your name</span><input class="tok wide" id="nName" maxlength="20" value="${esc(myName())}" placeholder="Your name"></div>
      <div class="grp"><span>Open tables</span>${tablesHtml()}</div>
      ${st.msg ? `<div class="${/…$/.test(st.msg) ? 'okmsg' : 'err'}">${esc(st.msg)}</div>` : ''}
      <div class="row2"><button class="btn new" id="nStart">${T('Open an online table')}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
  }
  const panelRefresh = () => { if (ui.overlay === 'net') panel(); };
  function showJoin(code) {
    st.joinCode = code;
    const offer = st.offer && 'room-' + st.offer.k === code ? st.offer : null;
    openOv('net', `<h2>${offer ? T("Join {0}'s table", esc(offer.host)) : 'Join table ' + esc(code)}</h2>
      ${offer ? `<div class="muted">${[0, 1, 2, 3].map(s => SEAT[s] + ': ' + esc((offer.names || {})[s] || T('Robot'))).join(' · ')}. ${T('{0} decides whether you can sit.', esc(offer.host))}</div>` : ''}
      <div class="grp"><span>${T('Your name')}</span><input class="tok wide" id="nName" maxlength="20" value="${esc(myName())}" placeholder="${T('Your name')}"></div>
      <div class="grp"><span>${T('Sit as')}</span><div class="seg2">${[['partner', T("The host's partner")], ['opp', T('An opponent')], ['any', T('Any free seat')], ['watch', '👁 ' + T('Watch')]].map(([v, l]) => `<button data-want="${v}" class="${st.want === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${st.msg ? `<div class="${/…$/.test(st.msg) ? 'okmsg' : 'err'}">${esc(T(st.msg))}</div>` : ''}
      <div class="row2">${st.waiting ? '' : `<button class="btn gold" id="nJoin">${T('Join')}</button>`}<button class="btn" id="${st.waiting ? 'nCancel' : 'oClose'}">${st.waiting ? T('Cancel') : T('Not now')}</button></div>`);
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.q) { sendChat(t.dataset.q); return; }
    if (t.dataset.kick != null) { kick(+t.dataset.kick); return; }
    if (t.dataset.aska) { askAnswer(t.dataset.aska, true); return; }
    if (t.dataset.askd) { askAnswer(t.dataset.askd, false); return; }
    if (t.dataset.accept) { accept(t.dataset.accept); return; }
    if (t.dataset.decline) { decline(t.dataset.decline); return; }
    if (t.dataset.tblinv) { inviteToTable(t.dataset.tblinv); return; }
    if (t.id === 'tinvYes') { joinInvite(); return; }
    if (t.dataset.mva) { moveAnswer(t.dataset.mva, true); return; }
    if (t.dataset.mvd) { moveAnswer(t.dataset.mvd, false); return; }
    if (t.dataset.reqlater) { reqLater(t.dataset.reqlater); return; }
    if (t.dataset.tjoin) { const id = t.dataset.tjoin; if (!st.tours[id]) { flash(T('This tournament has not reached you yet — try again in a moment'), 2500); findTables(); return; } closeOv(); playTour(id); return; }
    if (t.dataset.jt) { const tb = (st.tables || []).find(x => x.k === +t.dataset.jt); st.offer = tb || null; st.msg = ''; showJoin('room-' + t.dataset.jt); return; }
    if (t.dataset.jw) { const tb = (st.tables || []).find(x => x.k === +t.dataset.jw); st.offer = tb || null; st.msg = ''; st.want = 'watch'; showJoin('room-' + t.dataset.jw); return; }
    if (t.dataset.want) { st.want = t.dataset.want; const n = document.getElementById('nName'); if (n) setName(n.value.trim()); showJoin(st.joinCode); return; }
    switch (t.id) {
      case "bNet": panel(); break;
      case "bChat": toggleDock(); break;
      case "nSend": { const i = document.getElementById("nMsg"); if (i && i.value.trim()) { sendChat(i.value); st.draft = ""; i.value = ""; } break; }
      case 'nStart': {
        const n = document.getElementById('nName');
        setName((n && n.value.trim()) || myName() || 'Host');
        showOpenChoice(); break;   // public or private first
      }
      case 'nFind': findTables(); break;
      case 'nCancel': st.waiting = false; st.msg = ''; try { st.joinPeer && st.joinPeer.destroy(); } catch (e) {} closeOv(); break;
      case 'nStop': if (ui.overlay === 'net') { stop(); closeOv(); } else askYes(T('Close the table?'), () => { stop(); closeOv(); goHome(); }); break;
      case 'nLeave': if (ui.overlay === 'net') { leave(); closeOv(); } else askYes(T('Leave the table?'), () => { leave(); closeOv(); }); break;
      case 'nRst': resetScore(); break;
      case 'nRstQ': send({ t: 'rsreq' }); flash(T('Ask to reset the score') + ' ✓', 1500); break;
      case 'nNdQ': askNewDeal(); closeOv(); break;
      case 'nCopy': { const L = link(); (navigator.clipboard ? navigator.clipboard.writeText(L) : Promise.reject()).then(() => flash('Link copied', 1200)).catch(() => { const i = document.getElementById('nLink'); if (i) { i.select(); } }); break; }
      case 'nJoin': { const n = document.getElementById('nName'); const name = (n && n.value.trim()) || 'Guest'; st.msg = ''; join(st.joinCode, name, st.want); break; }
    }
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target && ev.target.id === "nMsg") { ev.preventDefault(); const i = ev.target; if (i.value.trim()) { sendChat(i.value); st.draft = ""; i.value = ""; } } });
  // opened through an invite link
  function boot() {
    const m = location.hash.match(/^#join-([A-Za-z0-9-]{4,10})$/i);
    // a new invite while sitting at another table: leave that one cleanly first (stops any reconnect attempts)
    if (m && st.guest) leave();
    if (m) { history.replaceState(null, '', location.pathname); st.savedG = null; setTimeout(() => showJoin(m[1]), 300); }
  }
  boot();
  setTimeout(autoRejoin, 700);
  window.addEventListener('hashchange', boot);
  // take a room so this table shows up in the lobby, and look at the other tables
  setTimeout(() => { claimSlot().then(() => { if (!st.tables) findTables(); }); }, 800);
  window.addEventListener('online', () => claimSlot());
  // keep this table listed (take an address again if it was lost) and keep the lobby list fresh
  function keepSlot() {
    if (!navigator.onLine) return;
    if (!st.slot) claimSlot();
    else if (st.slot.peer.disconnected && !st.slot.peer.destroyed) { try { st.slot.peer.reconnect(); } catch (e) {} }
  }
  const lobbyOpen = () => document.visibilityState === 'visible' && !st.guest && ((G && G.phase === 'idle') || ui.overlay === 'net');
  // the lobby lines also carry tournaments and chat, so they are rebuilt during play too when none is open
  setInterval(() => { keepSlot(); if (!st.finding && (lobbyOpen() || (document.visibilityState === 'visible' && lobbyCount() <= 1 && st.slot))) findTables(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepSlot(); if (lobbyOpen()) findTables(); } });
  // a player who keeps the table waiting gets a sound and a note (the host's own seat: on this device)
  function nudge(id, secs) {
    if (id === st.me || id === 'host') { nudged(secs); return; }
    const c = st.conns.get(id); if (c && c.open) { try { c.send({ t: 'nudge', s: secs }); } catch (e) {} }
  }
  /* play together: open a table that is listed in the lobby (if yours is not open yet) and invite the other
     player to the seat opposite you; the two free seats are left for opponents (robots play them meanwhile) */
  async function playWith(name) {
    if (st.guest) { flash(T('Leave the table you are at first'), 2000); return; }
    if (!st.host) { await host(false); if (!st.host) return; }
    inviteToTable(name, (SET.seat + 2) % 4);
  }
  // tell the lobby at once what is played here (e.g. a tournament board started)
  const shareInfo = () => { if (st.slot) meshSend(tableInfo()); };
  return { st, owner, shareInfo, kick, nudge, playWith, quickWatch, broadcast, send, panel, sit, askOwners, profOf, sysShort, sendChat, tchatHtml, QUICK, openTable: priv => { if (!st.on) host(priv); else panel(); }, peopleHtml, joinInvite, inviteToTable, tourTableResult, myTourSeat, openTourTable, joinTourTable, dmSend, tablesHtml, findTables, pendHtml, lsend, lchatHtml, lobbyCount, quickJoin, boardDone, askNewDeal, scoreHtml, newTour, tourResult, devId, prof, profTxt, tourInvite, tourStart, tourCancel, tourAnswer, invitedTo, isMine, openTour, knownNames, lclear, note: t => addChat(null, t), get on() { return st.on; }, get host() { return st.host; }, get guest() { return st.guest; }, get me() { return st.me; } };
})();
