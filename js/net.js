/* Bridge Table — play online with friends.
   One device hosts the table: the rules, the robots and the scoring run there. Friends join through a link
   (…/bridge/#join-CODE) and sit as partner or opponents; empty seats are robots.
   Devices talk directly (WebRTC), found through the free PeerJS service. Each player is sent only the cards
   they are allowed to see. */
const Net = (() => {
  'use strict';
  const PREFIX = 'bridgetable-', OWNER_CODE = '1726', LIB = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  /* Every open app holds one of ROOMS fixed addresses ("rooms"): its table, played alone with robots, is then
     listed in everyone's lobby. When someone asks to join and the player accepts, that table goes online
     and the player is its host. */
  const ROOMS = 20, ROOM = k => PREFIX + 'room-' + k;
  const st = { chat: [], unread: 0, on: false, host: false, guest: false, me: 'local', seat: 2, code: null, peer: null, conn: null, conns: new Map(), seats: {}, names: {}, ctl: null, savedG: null, msg: '', wake: null, want: 'partner' };
  const NAME_KEY = 'bridge-table-name';
  const myName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } };
  // a random id for this tab (kept across reloads), so a host can recognise a returning player
  const devTok = () => { try { let t = sessionStorage.getItem('bridge-table-tok'); if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('bridge-table-tok', t); } return t; } catch (e) { return st.tok || (st.tok = Math.random().toString(36).slice(2)); } };
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
      const show = G.phase === 'done' || owner(s) === id || (G.play && G.play.dummyShown && s === G.play.dummy);
      if (show) continue;
      v.deal[s] = v.deal[s].map(() => -1);
      if (v.play) v.play.hands[s] = v.play.hands[s].map(() => -1);
    }
    v.ctl = [0, 1, 2, 3].map(owner); v.names = st.names;
    return v;
  }
  function broadcast() {
    if (!st.host || !G) return;
    for (const [id, c] of st.conns) if (c.open) { try { c.send({ t: 'state', v: viewFor(id) }); } catch (e) {} }
  }
  function send(m) { if (st.conn && st.conn.open) st.conn.send(m); }
  async function wakeOn() { try { st.wake = await navigator.wakeLock.request('screen'); } catch (e) {} }
  function wakeOff() { try { st.wake && st.wake.release(); } catch (e) {} st.wake = null; }

  /* ---- your table's address (room) and the lobby ---- */
  async function claimSlot() {
    if (st.slot || st.claiming || !navigator.onLine) return; st.claiming = true;
    try { await loadLib(); } catch (e) { st.claiming = false; return; }
    for (let k = 1; k <= ROOMS && !st.slot; k++) {
      const p = await new Promise(res => {
        const p = new Peer(ROOM(k)), t = setTimeout(() => { try { p.destroy(); } catch (e) {} res(null); }, 8000);
        p.on('open', () => { clearTimeout(t); res(p); });
        p.on('error', () => { clearTimeout(t); try { p.destroy(); } catch (e) {} res(null); });   // taken by another player: try the next room
      });
      if (!p) continue;
      st.slot = { peer: p, k };
      p.on('connection', conn => { conn.on('data', d => onSlotData(conn, d)); conn.on('close', () => drop(conn)); conn.on('error', () => drop(conn)); });
      p.on('disconnected', () => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} });
      p.on('close', () => { if (st.slot && st.slot.peer === p) st.slot = null; });
    }
    st.claiming = false;
  }
  // what the lobby sees of this table
  function tableInfo() {
    return { t: 'info', k: st.slot ? st.slot.k : 0, away: Object.keys(st.away || {}).map(Number), host: (st.host ? st.names[SET.seat] : '') || myName() || 'Player', names: st.host ? st.names : { [SET.seat]: myName() || 'Player' }, online: st.host, busy: st.guest, phase: G ? G.phase : null, board: G ? G.board : 0 };
  }
  function onSlotData(conn, d) {
    if (!d || !d.t) return;
    if (d.t === 'info') { try { conn.send(tableInfo()); } catch (e) {} setTimeout(() => { try { conn.close(); } catch (e) {} }, 1500); return; }
    if (d.t === 'hello' && st.guest) { try { conn.send({ t: 'declined' }); } catch (e) {} return; }   // sitting at someone else's table
    onHostData(conn, d);
  }
  // the tables in the lobby: ask every room who is there (rooms nobody holds simply do not answer)
  async function findTables() {
    if (st.finding) return; st.finding = true; render(); panelRefresh();
    const out = [];
    try {
      await loadLib();
      const p = await new Promise(res => { const p = new Peer(); p.on('open', () => res(p)); p.on('error', () => res(null)); setTimeout(() => res(null), 8000); });
      if (p) {
        await new Promise(res => {
          for (let k = 1; k <= ROOMS; k++) {
            if (st.slot && st.slot.k === k) continue;
            const c = p.connect(ROOM(k), { reliable: true });
            c.on('open', () => c.send({ t: 'info' }));
            c.on('data', d => { if (d && d.t === 'info' && !d.busy && !out.some(o => o.k === d.k)) out.push(d); try { c.close(); } catch (e) {} });
          }
          setTimeout(res, 5000);
        });
        try { p.destroy(); } catch (e) {}
      }
    } catch (e) {}
    st.tables = out.sort((a, b) => a.k - b.k); st.tablesAt = Date.now(); st.finding = false;
    render(); panelRefresh();
  }
  // the lobby list, used on the start screen and in the Online panel
  function tablesHtml() {
    const L = st.tables;
    // each table is drawn as a table: the player's name or "Robot" at every side
    const rows = !L ? '' : L.length ? `<div class="tbls">${L.map(t => {
      const nm = t.names || {}, away = t.away || [];
      const cells = [0, 1, 2, 3].map(s => nm[s] ? `<b>${esc(nm[s])}</b>${away.includes(s) ? '<em>away · robot plays</em>' : ''}` : '<i>Robot</i>');
      const mid = `<div class="tname">${esc(t.host)}'s table</div><div class="tstate">${t.online ? 'online' : 'playing with robots'}${t.phase === 'lobby' ? ' · waiting to start' : t.board ? ' · board ' + t.board : ''}</div><button class="btn gold" data-jt="${t.k}">Ask to join</button>`;
      return seatTable(cells, mid, 2);
    }).join('')}</div>` : '<div class="muted">No other tables are open right now.</div>';
    return `<div class="tables">${rows}<button class="btn" id="nFind" ${st.finding ? 'disabled' : ''}>${st.finding ? 'Looking for tables…' : L ? 'Refresh the list' : 'Show open tables'}</button></div>`;
  }
  // this player's own table goes online: they become its host (requests are accepted one by one)
  function becomeHost() {
    if (st.host || !st.slot) return !!st.host;
    Object.assign(st, { peer: st.slot.peer, on: true, host: true, guest: false, me: 'host', code: 'room-' + st.slot.k, seats: { [SET.seat]: 'host' }, names: { [SET.seat]: myName() || 'Host' }, msg: '' });
    wakeOn(); ping();
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
    const used = Object.keys(names).filter(s => +s !== except).map(s => names[s]).concat(Object.values(st.pending || {}).map(p => p.d.name));
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
    becomeHost();   // the first accepted player turns this table into an online table
    seatPlayer(p.conn, p.d, null);
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
        flash(String(d.name || 'Guest').slice(0, 20) + ' wants to join the table', 3000); panel();
        return;
      }
      seatPlayer(conn, d, back);
      return;
    }
    const seat = seatOf(conn.peer); if (Number.isNaN(seat)) return;
    const who = st.names[seat] || SEAT[seat];
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
      const fail = msg => { if (welcomed || failed) return; failed = true; try { peer.destroy(); } catch (e) {} if (retry) { retry(false); return; } st.msg = msg; showJoin(code); };
      setTimeout(() => { if (!welcomed && !waiting) fail('The table could not be reached. Check the link, and that the host still has the app open. Some mobile networks block direct connections — try Wi-Fi.'); }, retry ? 8000 : 15000);
      peer.on('error', e => { if (e.type === 'peer-unavailable') fail('That table is not open any more.'); });
      peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} });
      conn.on('open', () => conn.send({ t: 'hello', name, want, tok: devTok(), seat: retry ? st.seat : undefined }));
      conn.on('data', d => {
        if (!d) return;
        if (d.t === 'welcome') {
          welcomed = true; clearTimeout(timer);
          st.waiting = false;
          Object.assign(st, { peer, conn, on: true, guest: true, host: false, me: peer.id, seat: d.seat, code, msg: "", savedG: st.savedG || (G && G.phase === "idle" ? ui.saved : G), chat: d.chat || st.chat || [], unread: 0, rejoin: { code, name, want } });
          if (retry) retry(true); else closeOv();
          wakeOn(); ping();
        } else if (d.t === 'state') applyState(d.v);
        else if (d.t === "full") fail("That table is full.");
        else if (d.t === "chat") gotChat(d.m);
        else if (d.t === "seat") { st.seat = d.seat; render(); }
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
    st.ctl = v.ctl; st.names = v.names || {};
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
    try { st.conn && st.conn.close(); } catch (e) {}
    try { st.peer && st.peer.destroy(); } catch (e) {}
    wakeOff();
    const back = st.savedG;
    Object.assign(st, { on: false, guest: false, me: 'local', peer: null, conn: null, ctl: null, names: {}, code: null, savedG: null, rejoin: null, reconnecting: false });
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

  /* ---- screens ---- */
  // players asking to join this table, each with Accept / Decline
  function pendHtml() {
    const pend = Object.entries(st.pending || {}), mv = Object.entries(st.moves || {});
    const moves = mv.length ? `<div class="grp"><span>Asking to change seats</span>${mv.map(([id, m]) => `<div class="helprow"><span><b>${esc(st.names[m.from] || SEAT[m.from])}</b> ${SEAT[m.from]} → ${SEAT[m.to]}</span><span><button class="btn gold" data-mva="${esc(id)}">Accept</button> <button class="btn" data-mvd="${esc(id)}">Decline</button></span></div>`).join('')}</div>` : '';
    const join = pend.length ? `<div class="grp"><span>Asking to join</span>${pend.map(([id, p]) => `<div class="helprow"><span><b>${esc(String(p.d.name || 'Guest').slice(0, 20))}</b> ${p.d.want === 'opp' ? '(opponent)' : '(partner)'}</span><span><button class="btn gold" data-accept="${esc(id)}">Accept</button> <button class="btn" data-decline="${esc(id)}">Decline</button></span></div>`).join('')}</div>` : '';
    return moves + join;
  }
  function panel() {
    if (st.guest) {
      openOv('net', `<h2>Online table ${esc(st.code)}</h2><div>You sit <b>${SEAT[st.seat]}</b>. The host's device runs the table; robots fill the empty seats.</div>
        ${G && (G.phase === 'lobby' || G.phase === 'done') ? `<div class="grp"><span>Move to another seat (the host decides)</span><div class="row2">${[0, 1, 2, 3].filter(s => s !== st.seat && !(st.names || {})[s]).map(s => `<button class="btn" data-sit="${s}">${SEAT[s]}</button>`).join('') || '<span class="muted">No free seat</span>'}</div></div>` : ''}
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
        <div class="row2"><button class="btn" id="nStop">Close the table</button><button class="btn gold" id="oClose">Done</button></div>`);
      return;
    }
    openOv('net', `<h2>Play online</h2>
      ${pendHtml()}
      <div class="muted">Your table is listed in everyone's lobby while you play${st.slot ? '' : ' (connecting…)'}. When someone asks to join and you accept, your table goes online and you are its host. Or ask to join one of the tables below.</div>
      <div class="grp"><span>Your name</span><input class="tok wide" id="nName" maxlength="20" value="${esc(myName())}" placeholder="Your name"></div>
      <div class="grp"><span>Open tables</span>${tablesHtml()}</div>
      <div class="grp"><span>Empty waiting room (table owner, host code)</span><input class="tok wide" id="nPin" type="password" inputmode="numeric" maxlength="12" autocomplete="off" value="" placeholder="Host code"></div>
      ${st.msg ? `<div class="${/…$/.test(st.msg) ? 'okmsg' : 'err'}">${esc(st.msg)}</div>` : ''}
      <div class="row2"><button class="btn" id="nStart">Open a waiting room</button><button class="btn gold" id="oClose">Close</button></div>`);
  }
  const panelRefresh = () => { if (ui.overlay === 'net') panel(); };
  function showJoin(code) {
    st.joinCode = code;
    const offer = st.offer && 'room-' + st.offer.k === code ? st.offer : null;
    openOv('net', `<h2>${offer ? 'Join ' + esc(offer.host) + "'s table" : 'Join table ' + esc(code)}</h2>
      ${offer ? `<div class="muted">${[0, 1, 2, 3].map(s => SEAT[s] + ': ' + esc((offer.names || {})[s] || 'robot')).join(' · ')}. ${esc(offer.host)} decides whether you can sit.</div>` : ''}
      <div class="grp"><span>Your name</span><input class="tok wide" id="nName" maxlength="20" value="${esc(myName())}" placeholder="Your name"></div>
      <div class="grp"><span>Sit as</span><div class="seg2">${[['partner', "The host's partner"], ['opp', 'An opponent']].map(([v, l]) => `<button data-want="${v}" class="${st.want === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${st.msg ? `<div class="${/…$/.test(st.msg) ? 'okmsg' : 'err'}">${esc(st.msg)}</div>` : ''}
      <div class="row2">${st.waiting ? '' : '<button class="btn gold" id="nJoin">Join</button>'}<button class="btn" id="${st.waiting ? 'nCancel' : 'oClose'}">${st.waiting ? 'Cancel' : 'Not now'}</button></div>`);
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.q) { sendChat(t.dataset.q); return; }
    if (t.dataset.kick != null) { kick(+t.dataset.kick); return; }
    if (t.dataset.accept) { accept(t.dataset.accept); return; }
    if (t.dataset.decline) { decline(t.dataset.decline); return; }
    if (t.dataset.mva) { moveAnswer(t.dataset.mva, true); return; }
    if (t.dataset.mvd) { moveAnswer(t.dataset.mvd, false); return; }
    if (t.dataset.jt) { const tb = (st.tables || []).find(x => x.k === +t.dataset.jt); st.offer = tb || null; st.msg = ''; showJoin('room-' + t.dataset.jt); return; }
    if (t.dataset.want) { st.want = t.dataset.want; const n = document.getElementById('nName'); if (n) setName(n.value.trim()); showJoin(st.joinCode); return; }
    switch (t.id) {
      case "bNet": panel(); break;
      case "bChat": chatPanel(); break;
      case "nSend": { const i = document.getElementById("nMsg"); if (i && i.value.trim()) { sendChat(i.value); st.draft = ""; i.value = ""; } break; }
      case 'nStart': {
        const n = document.getElementById('nName'), p = document.getElementById('nPin'), pin = p ? p.value.trim() : '';
        setName((n && n.value.trim()) || 'Host');
        if (pin !== OWNER_CODE) { st.msg = 'Only the table owner can open a waiting room: enter the host code.'; panel(); break; }
        host(); break;
      }
      case 'nFind': findTables(); break;
      case 'nCancel': st.waiting = false; st.msg = ''; try { st.joinPeer && st.joinPeer.destroy(); } catch (e) {} closeOv(); break;
      case 'nStop': stop(); closeOv(); break;
      case 'nLeave': leave(); closeOv(); break;
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
  window.addEventListener('hashchange', boot);
  // take a room so this table shows up in the lobby, and look at the other tables
  setTimeout(() => { claimSlot().then(() => { if (!st.tables) findTables(); }); }, 800);
  window.addEventListener('online', () => claimSlot());
  return { st, owner, broadcast, send, panel, sit, tablesHtml, findTables, pendHtml, note: t => addChat(null, t), get on() { return st.on; }, get host() { return st.host; }, get guest() { return st.guest; }, get me() { return st.me; } };
})();
