/* Bridge Table — play online with friends.
   One device hosts the table: the rules, the robots and the scoring run there. Friends join through a link
   (…/bridge/#join-CODE) and sit as partner or opponents; empty seats are robots.
   Devices talk directly (WebRTC), found through the free PeerJS service. Each player is sent only the cards
   they are allowed to see. */
const Net = (() => {
  'use strict';
  // ?ns=name in the address gives a separate lobby (for testing without disturbing real players)
  const NS = (location.search.match(/[?&]ns=([a-z0-9]{1,12})/i) || [])[1];
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
    v.ctl = [0, 1, 2, 3].map(owner); v.names = st.names; v.score = st.score; v.profs = st.profs || {};
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
      prof: prof(), profs: st.host ? st.profs || {} : {}, watchers: st.watch ? st.watch.size : 0 };
  }
  /* a player's profile, shown next to their name: boards played today and the average IMPs (or MP %) */
  function prof() {
    const p = Store.periods(HIST)[0];
    return { n: p.n, imp: p.impAvg, mp: p.mpAvg };
  }
  function profTxt(p) {
    if (!p || !p.n) return '';
    return `${p.n} ${T('boards')}${p.imp != null ? ' · ' + (p.imp > 0 ? '+' : '') + p.imp + ' IMP' : p.mp != null ? ' · ' + p.mp + '%' : ''}`;
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
      joined: obj20(t.joined), declined: obj20(t.declined), v: +t.v || 0 };
  }
  function mergeTour(t) {
    if (!t || !t.id) return false;
    if (Date.now() - (+t.ts || 0) > 3 * 864e5) return false;   // tournaments are kept for three days
    const cur = st.tours[t.id];
    if (cur && ((+t.v || 0) <= cur.v || (cur.byKey && t.byKey !== cur.byKey))) return false;
    st.tours[t.id] = cleanTour(t);
    return true;
  }
  function mergeRes(id, key, r) {
    if (!st.tours[id] || !r || !key) return false;
    const R = st.tres[id] || (st.tres[id] = {}), ns = {};
    for (const b in (r.ns || {})) if (+b >= 1 && +b <= st.tours[id].n) ns[b] = +r.ns[b] || 0;
    const cur = R[key];
    if (cur && Object.keys(cur.ns).length >= Object.keys(ns).length) return false;   // results only grow
    R[key] = { name: String(r.name || 'Player').slice(0, 20), ns };
    return true;
  }
  try { const d = JSON.parse(localStorage.getItem('bridge-tours') || '{}'); for (const id in (d.tours || {})) mergeTour(d.tours[id]); for (const id in (d.res || {})) for (const k in d.res[id]) mergeRes(id, k, d.res[id][k]); } catch (e) {}
  function meshSend(m) { for (const c of (st.mesh || new Map()).values()) if (c.open) { try { c.send(m); } catch (e) {} } }
  const isMine = t => !!t && t.byKey === devId();
  // the organiser publishes a new version of the tournament
  function pubTour(t) { t.v = (t.v || 0) + 1; saveTours(); meshSend({ t: 'tour', tour: t }); renderL(); }
  function newTour(n) {
    const me = myName() || 'Player';
    const t = cleanTour({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: me + ' · ' + new Date().toLocaleDateString(), by: me, byKey: devId(), n,
      seed: (Math.random() * 4294967295) >>> 0, ts: Date.now(), state: 'setup', inv: [], joined: { [devId()]: me }, declined: {}, v: 1 });
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
  function tourResult(id, b, ns) {
    const t = st.tours[id]; if (!t) return;
    const R = st.tres[id] || (st.tres[id] = {}), key = devId();
    const me = R[key] || (R[key] = { name: myName() || 'Player', ns: {} });
    me.name = myName() || me.name; me.ns[b] = ns;
    saveTours(); meshSend({ t: 'tres', id, key, r: me });
  }
  function onTourData(d) {
    if (d.t === 'tour') {
      if (mergeTour(d.tour)) { saveTours(); const t = st.tours[d.tour.id]; if (invitedTo(t)) flash(T('{0} invites you to a tournament', t.by), 3500); renderL(); }
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
    renderL();
  }
  function gotInfo(d) {
    if (st.slot && d.k === st.slot.k) return;   // our own table
    if (st.collect && !st.collect.some(o => o.k === d.k)) st.collect.push(d);
    if (d.busy) { st.tables = (st.tables || []).filter(t => t.k !== d.k); }
    else st.tables = [...(st.tables || []).filter(t => t.k !== d.k), d].sort((a, b) => a.k - b.k);   // show each table as soon as it answers
    render(); panelRefresh();
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
  const listed = t => t.online || (t.phase && t.phase !== 'idle');
  function tablesHtml() {
    // tables in play are listed: online tables, and players at a board with robots (not someone on the home page)
    const L = st.tables && st.tables.filter(listed);
    // each table is drawn as a table: the player's name or "Robot" at every side
    const rows = !L ? '' : L.length ? `<div class="tbls">${L.map(t => {
      const nm = t.names || {}, away = t.away || [];
      const pf = t.profs || {};
      const cells = [0, 1, 2, 3].map(s => nm[s] ? `<b>${esc(nm[s])}</b>${(pf[s] || (!t.online && t.prof)) && profTxt(pf[s] || t.prof) ? `<span class="pb">${esc(profTxt(pf[s] || t.prof))}</span>` : ''}${away.includes(s) ? `<em>${T('away · robot plays')}</em>` : ''}` : `<i>${T('Robot')}</i>`);
      const mid = `<div class="tname">${T("{0}'s table", esc(t.host))}</div><div class="tstate">${t.online ? T('online') : T('playing with robots')}${t.phase === 'lobby' ? ' · ' + T('waiting to start') : t.board && t.phase !== 'idle' ? ' · ' + T('board {0}', t.board) : ''}${t.watchers ? ' · 👁 ' + t.watchers : ''}</div><button class="btn gold" data-jt="${t.k}">${T('Ask to join')}</button>${t.online ? `<button class="btn" data-jw="${t.k}">👁 ${T('Watch')}</button>` : ''}`;
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
    L.push({ id: String(m.id).slice(0, 40), from: String(m.from || 'Player').slice(0, 20), text: String(m.text).slice(0, 200), ts: +m.ts || Date.now(), p: m.p && typeof m.p === 'object' ? { n: +m.p.n || 0, imp: m.p.imp == null ? null : +m.p.imp, mp: m.p.mp == null ? null : +m.p.mp } : null });
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
    return L.length ? L.slice(-60).map(m => `<div class="cm${m.from === me ? ' me' : ''}"><b>${esc(m.from)}</b>${m.p && m.p.n ? `<span class="pb">${esc(profTxt(m.p))}</span>` : ''} ${esc(m.text)}<small>${t(m.ts)}</small></div>`).join('') : `<div class="muted">${T('No messages yet — say hello!')}</div>`;
  }
  const lobbyCount = () => 1 + [...(st.mesh || new Map()).values()].filter(c => c.open).length;
  // redraw what shows lobby things: the home page, the chat window (phones) and the tournament set-up
  const renderL = () => { if (G && G.phase === 'idle') render(); if (ui.overlay === 'lchat') showLChat(); if (ui.overlay === 'tsetup') showTourSetup(ui.tsetId); };
  // clear the lobby chat on this device
  function lclear() { st.lchat = []; st.lunread = 0; try { localStorage.removeItem('bridge-lobby-chat'); localStorage.setItem('bridge-lobby-cleared', String(Date.now())); } catch (e) {} renderL(); }
  try { (JSON.parse(localStorage.getItem('bridge-lobby-chat') || '[]') || []).forEach(m => addL(m, true)); } catch (e) {}
  /* ---- "seat me at a table": ask the best table that still has a robot for a seat ---- */
  function quickJoin() {
    if (!navigator.onLine) { flash(T('You are offline'), 1500); return; }
    const L = (st.tables || []).filter(t => listed(t) && Object.keys(t.names || {}).length < 4);
    if (!L.length) { flash(T('No table has a free seat right now.'), 2500); if (!st.finding) findTables(); return; }
    // tables already online with friends first (more people to play with), then players alone
    L.sort((a, b) => (b.online - a.online) || (Object.keys(b.names || {}).length - Object.keys(a.names || {}).length) || a.k - b.k);
    const t = L[0], name = myName() || 'Guest';
    st.offer = t; st.want = 'any'; st.msg = '';
    flash(T('Asked {0} for a seat…', t.host), 2000);
    join('room-' + t.k, name, 'any');
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
  async function host() {
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
    const s = back != null ? back : pref.length ? pref[0] : free[0];
    if (s == null) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); return; }
    if (back != null && away[s]) { clearTimeout(away[s].t); delete away[s]; }
    if (d.tok) { for (const k in toks) if (toks[k] === d.tok) delete toks[k]; toks[s] = d.tok; }
    st.seats[s] = conn.peer; st.names[s] = String(d.name || 'Guest').slice(0, 20); st.conns.set(conn.peer, conn);
    (st.profs || (st.profs = {}))[s] = d.prof && typeof d.prof === 'object' ? { n: +d.prof.n || 0, imp: d.prof.imp == null ? null : +d.prof.imp, mp: d.prof.mp == null ? null : +d.prof.mp } : null;
    conn.send({ t: 'welcome', seat: s, id: conn.peer, code: st.code, chat: st.chat.slice(-50) });
    addChat(null, st.names[s] + (back != null ? ' is back' : ' joined as ' + SEAT[s]));
    ping();
    broadcast(); panelRefresh(); render(); tick();
  }
  // the host answers a join request
  function accept(id) {
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
  function decline(id) {
    const p = st.pending && st.pending[id]; if (!p) return; delete st.pending[id];
    try { p.conn.send({ t: 'declined' }); } catch (e) {} setTimeout(() => { try { p.conn.close(); } catch (e) {} }, 500);
    panelRefresh(); render();
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
        (st.pending || (st.pending = {}))[conn.peer] = { conn, d };
        conn.send({ t: 'wait' });
        conn.on('close', () => { if (st.pending && st.pending[conn.peer]) { delete st.pending[conn.peer]; panelRefresh(); render(); } });
        flash(String(d.name || 'Guest').slice(0, 20) + (d.want === 'watch' ? ' wants to watch' : ' wants to join the table'), 3000); panel();
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
    if (d.t === "undo") { if (undo(conn.peer)) addChat(null, who + " took back their last " + (G.phase === "bid" ? "call" : "move")); return; }
    if (d.t === "claim") { if (G.phase === "play" && !G.play.trick.length && owner(G.play.turn) === conn.peer) { addChat(null, who + " claimed the rest"); claim(seat); } return; }
    if (d.t === "replay") { if (G.phase === "done") { addChat(null, who + " asked to replay this deal"); replayDeal(); } return; }
    if (d.t === "hint") { if (G.phase === "play" && owner(G.play.turn) === conn.peer && G.play.trick.length < 4) conn.send({ t: "hint", c: E.aiPlay(G.play, G.play.turn), id: G.id }); return; }
    if (d.t === "call" && G.phase === "bid" && owner(bidTurn()) === conn.peer) makeCall(bidTurn(), d.call);
    else if (d.t === 'card' && G.phase === 'play' && owner(G.play.turn) === conn.peer) playCard(G.play.turn, d.c);
    else if (d.t === 'next' && G.phase === 'done') newBoard();
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
    for (const c of st.conns.values()) { try { c.send({ t: 'bye' }); } catch (e) {} }
    for (const w of (st.watch || new Map()).values()) { try { w.conn.send({ t: 'bye' }); } catch (e) {} setTimeout(() => { try { w.conn.close(); } catch (e) {} }, 500); }
    st.watch = new Map(); st.watchToks = [];
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
  async function join(code, name, want, retry) {
    setName(name);
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
      conn.on('open', () => conn.send({ t: 'hello', name, want, tok: devTok(), prof: prof(), seat: retry ? st.seat : undefined }));
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
    join(t.code, t.name, st.want);
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
    st.ctl = v.ctl; st.names = v.names || {}; st.score = v.score || null;
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
    if (ui.overlay === 'chat') { chatPanel(); return; }
    if (m.from !== myTableName()) { st.unread++; flash((m.from ? m.from + ': ' : '') + m.text, 2600); }
    renderBar();
  }
  function sendChat(text) {
    text = String(text || '').trim(); if (!text) return;
    if (st.host) addChat(myTableName(), text); else send({ t: 'chat', text });
  }
  const QUICK = ['Hi!', 'Well played', 'Thanks partner', 'Sorry partner', 'Good luck', 'Ready?', 'One more?', '👍', '😂', '🙈'];
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
        <div class="row2"><button class="btn" id="nLeave">Leave the table</button><button class="btn gold" id="oClose">Close</button></div>`);
      return;
    }
    if (st.host) {
      const L = link(), wa = 'https://wa.me/?text=' + encodeURIComponent('Bridge: open ' + L + ' and ask to join my table');
      openOv('net', `<h2>Your online table</h2>
        ${pendHtml()}
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
    if (t.dataset.mva) { moveAnswer(t.dataset.mva, true); return; }
    if (t.dataset.mvd) { moveAnswer(t.dataset.mvd, false); return; }
    if (t.dataset.jt) { const tb = (st.tables || []).find(x => x.k === +t.dataset.jt); st.offer = tb || null; st.msg = ''; showJoin('room-' + t.dataset.jt); return; }
    if (t.dataset.jw) { const tb = (st.tables || []).find(x => x.k === +t.dataset.jw); st.offer = tb || null; st.msg = ''; st.want = 'watch'; showJoin('room-' + t.dataset.jw); return; }
    if (t.dataset.want) { st.want = t.dataset.want; const n = document.getElementById('nName'); if (n) setName(n.value.trim()); showJoin(st.joinCode); return; }
    switch (t.id) {
      case "bNet": panel(); break;
      case "bChat": chatPanel(); break;
      case "nSend": { const i = document.getElementById("nMsg"); if (i && i.value.trim()) { sendChat(i.value); st.draft = ""; i.value = ""; } break; }
      case 'nStart': {
        const n = document.getElementById('nName');
        setName((n && n.value.trim()) || myName() || 'Host');
        host(); break;
      }
      case 'nFind': findTables(); break;
      case 'nCancel': st.waiting = false; st.msg = ''; try { st.joinPeer && st.joinPeer.destroy(); } catch (e) {} closeOv(); break;
      case 'nStop': stop(); closeOv(); break;
      case 'nLeave': leave(); closeOv(); break;
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
  return { st, owner, broadcast, send, panel, sit, openTable: () => { if (!st.on) host(); else panel(); }, tablesHtml, findTables, pendHtml, lsend, lchatHtml, lobbyCount, quickJoin, boardDone, askNewDeal, scoreHtml, newTour, tourResult, devId, prof, profTxt, tourInvite, tourStart, tourCancel, tourAnswer, invitedTo, isMine, knownNames, lclear, note: t => addChat(null, t), get on() { return st.on; }, get host() { return st.host; }, get guest() { return st.guest; }, get me() { return st.me; } };
})();
