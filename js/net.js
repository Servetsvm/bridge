/* Bridge Table — play online with friends.
   One device hosts the table: the rules, the robots and the scoring run there. Friends join through a link
   (…/bridge/#join-CODE) and sit as partner or opponents; empty seats are robots.
   Devices talk directly (WebRTC), found through the free PeerJS service. Each player is sent only the cards
   they are allowed to see. */
const Net = (() => {
  'use strict';
  const PREFIX = 'bridgetable-', LIB = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const st = { on: false, host: false, guest: false, me: 'local', seat: 2, code: null, peer: null, conn: null, conns: new Map(), seats: {}, names: {}, ctl: null, savedG: null, msg: '', wake: null, want: 'partner' };
  const NAME_KEY = 'bridge-table-name';
  const myName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } };
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
  const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[E.rnd(A.length)]; return s; };
  const link = () => location.origin + location.pathname.replace(/[^/]*$/, '') + '#join-' + st.code;

  /* who plays a seat: a human's id, or 'robot'. The declaring side's humans also play the dummy. */
  function owner(seat) {
    if (st.guest) return st.ctl ? st.ctl[seat] : 'robot';
    const at = s => st.seats[s] || null;
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

  /* ---- host ---- */
  async function host() {
    st.msg = 'Opening the table…'; panel();
    try {
      await loadLib();
      let peer = null;
      for (let i = 0; i < 3 && !peer; i++) {
        st.code = newCode();
        peer = await new Promise(res => { const p = new Peer(PREFIX + st.code); p.on('open', () => res(p)); p.on('error', () => { p.destroy(); res(null); }); });
      }
      if (!peer) throw new Error('Could not reach the connection service. Try again in a moment.');
      Object.assign(st, { peer, on: true, host: true, guest: false, me: 'host', seats: { [SET.seat]: 'host' }, names: { [SET.seat]: myName() || 'Host' }, msg: '' });
      peer.on('connection', conn => {
        conn.on('data', d => onHostData(conn, d));
        conn.on('close', () => drop(conn)); conn.on('error', () => drop(conn));
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
      wakeOn();
    } catch (e) { st.msg = e.message; }
    panel(); render(); tick();
  }
  function onHostData(conn, d) {
    if (!d || !d.t) return;
    const seatOf = id => +Object.keys(st.seats).find(s => st.seats[s] === id);
    if (d.t === 'hello') {
      const hs = SET.seat, free = [0, 1, 2, 3].filter(s => !st.seats[s]);
      const pref = (d.want === 'partner' ? [(hs + 2) % 4] : d.want === 'opp' ? [(hs + 1) % 4, (hs + 3) % 4] : []).filter(s => free.includes(s));
      const s = pref.length ? pref[0] : free[0];
      if (s == null) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); return; }
      st.seats[s] = conn.peer; st.names[s] = String(d.name || 'Guest').slice(0, 20); st.conns.set(conn.peer, conn);
      conn.send({ t: 'welcome', seat: s, id: conn.peer, code: st.code });
      broadcast(); panelRefresh(); render(); tick();
      return;
    }
    const seat = seatOf(conn.peer); if (Number.isNaN(seat)) return;
    if (d.t === 'call' && G.phase === 'bid' && owner(bidTurn()) === conn.peer) makeCall(bidTurn(), d.call);
    else if (d.t === 'card' && G.phase === 'play' && owner(G.play.turn) === conn.peer) playCard(G.play.turn, d.c);
    else if (d.t === 'next' && G.phase === 'done') newBoard();
  }
  function drop(conn) {
    const s = Object.keys(st.seats).find(k => st.seats[k] === conn.peer);
    if (s != null) { delete st.seats[s]; delete st.names[s]; }
    st.conns.delete(conn.peer);
    if (st.host) { broadcast(); panelRefresh(); render(); tick(); }
  }
  function stop() {
    for (const c of st.conns.values()) { try { c.close(); } catch (e) {} }
    try { st.peer && st.peer.destroy(); } catch (e) {}
    wakeOff();
    Object.assign(st, { on: false, host: false, guest: false, me: 'local', peer: null, conn: null, conns: new Map(), seats: {}, names: {}, ctl: null, code: null, msg: '' });
    render(); tick();
  }

  /* ---- guest ---- */
  async function join(code, name, want) {
    setName(name);
    st.msg = 'Connecting to table ' + code + '…'; showJoin(code);
    try {
      await loadLib();
      const peer = await new Promise((res, rej) => { const p = new Peer(); p.on('open', () => res(p)); p.on('error', e => rej(new Error('Could not reach the connection service (' + (e.type || 'error') + ').'))); });
      const conn = peer.connect(PREFIX + code, { reliable: true });
      let welcomed = false;
      const fail = msg => { try { peer.destroy(); } catch (e) {} if (!welcomed) { st.msg = msg; showJoin(code); } };
      setTimeout(() => { if (!welcomed) fail('The table could not be reached. Check the link, and that the host still has the app open. Some mobile networks block direct connections — try Wi-Fi.'); }, 15000);
      peer.on('error', e => { if (e.type === 'peer-unavailable') fail('No table with code ' + code + ' is open right now.'); });
      conn.on('open', () => conn.send({ t: 'hello', name, want }));
      conn.on('data', d => {
        if (!d) return;
        if (d.t === 'welcome') {
          welcomed = true; clearTimeout(timer);
          Object.assign(st, { peer, conn, on: true, guest: true, host: false, me: peer.id, seat: d.seat, code, msg: '', savedG: st.savedG || G });
          closeOv(); wakeOn();
        } else if (d.t === 'state') applyState(d.v);
        else if (d.t === 'full') fail('That table is full.');
      });
      conn.on('close', () => { if (st.guest) leave('The host closed the table.'); });
    } catch (e) { st.msg = e.message; showJoin(code); }
  }
  function applyState(v) {
    clearTimeout(timer);
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
    Object.assign(st, { on: false, guest: false, me: 'local', peer: null, conn: null, ctl: null, names: {}, code: null, savedG: null });
    G = back; if (!G) newBoard(); else { render(); tick(); }
    if (msg) flash(msg, 3000);
  }

  /* ---- screens ---- */
  function panel() {
    if (st.guest) {
      openOv('net', `<h2>Online table ${esc(st.code)}</h2><div>You sit <b>${SEAT[st.seat]}</b>. The host's device runs the table; robots fill the empty seats.</div>
        <div class="row2"><button class="btn" id="nLeave">Leave the table</button><button class="btn gold" id="oClose">Close</button></div>`);
      return;
    }
    if (st.host) {
      const L = link(), wa = 'https://wa.me/?text=' + encodeURIComponent('Join my bridge table: ' + L);
      openOv('net', `<h2>Your online table</h2>
        <div class="grp"><span>Table code</span><div class="bigcode">${esc(st.code)}</div></div>
        <div class="grp"><span>Invite link</span><input class="tok wide" id="nLink" readonly value="${esc(L)}"></div>
        <div class="row2"><a class="btn gold" href="${wa}" target="_blank" rel="noopener">Send on WhatsApp</a><button class="btn" id="nCopy">Copy link</button></div>
        <div class="grp"><span>Seats</span>${[0, 1, 2, 3].map(s => `<div class="helprow"><span><b>${SEAT[s]}</b></span><span>${st.seats[s] === 'host' ? esc(st.names[s]) + ' (you)' : st.seats[s] ? esc(st.names[s]) : '<i>Robot</i>'}</span></div>`).join('')}</div>
        <div class="muted">Friends who open the link choose to sit as your partner or as an opponent. Keep this app open while you play: your device runs the table. Robots play any seat that is empty or whose player leaves.</div>
        ${st.msg ? `<div class="err">${esc(st.msg)}</div>` : ''}
        <div class="row2"><button class="btn" id="nStop">Close the table</button><button class="btn gold" id="oClose">Done</button></div>`);
      return;
    }
    openOv('net', `<h2>Play online</h2>
      <div class="muted">Start a table and send the link to your partner or opponents (e.g. on WhatsApp). They open it, choose a seat and play with you; robots fill the empty seats. To join a friend's table, just open the link they sent you.</div>
      <div class="grp"><span>Your name</span><input class="tok wide" id="nName" maxlength="20" value="${esc(myName())}" placeholder="Your name"></div>
      ${st.msg ? `<div class="${/…$/.test(st.msg) ? 'okmsg' : 'err'}">${esc(st.msg)}</div>` : ''}
      <div class="row2"><button class="btn gold" id="nStart">Start a table</button><button class="btn" id="oClose">Close</button></div>`);
  }
  const panelRefresh = () => { if (ui.overlay === 'net') panel(); };
  function showJoin(code) {
    st.joinCode = code;
    openOv('net', `<h2>Join table ${esc(code)}</h2>
      <div class="grp"><span>Your name</span><input class="tok wide" id="nName" maxlength="20" value="${esc(myName())}" placeholder="Your name"></div>
      <div class="grp"><span>Sit as</span><div class="seg2">${[['partner', "The host's partner"], ['opp', 'An opponent']].map(([v, l]) => `<button data-want="${v}" class="${st.want === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${st.msg ? `<div class="${/…$/.test(st.msg) ? 'okmsg' : 'err'}">${esc(st.msg)}</div>` : ''}
      <div class="row2"><button class="btn gold" id="nJoin">Join</button><button class="btn" id="oClose">Not now</button></div>`);
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.want) { st.want = t.dataset.want; const n = document.getElementById('nName'); if (n) setName(n.value.trim()); showJoin(st.joinCode); return; }
    switch (t.id) {
      case 'bNet': panel(); break;
      case 'nStart': { const n = document.getElementById('nName'); setName((n && n.value.trim()) || 'Host'); host(); break; }
      case 'nStop': stop(); closeOv(); break;
      case 'nLeave': leave(); closeOv(); break;
      case 'nCopy': { const L = link(); (navigator.clipboard ? navigator.clipboard.writeText(L) : Promise.reject()).then(() => flash('Link copied', 1200)).catch(() => { const i = document.getElementById('nLink'); if (i) { i.select(); } }); break; }
      case 'nJoin': { const n = document.getElementById('nName'); const name = (n && n.value.trim()) || 'Guest'; st.msg = ''; join(st.joinCode, name, st.want); break; }
    }
  });
  // opened through an invite link
  function boot() {
    const m = location.hash.match(/^#join-([A-Z0-9]{6})$/i);
    if (m) { history.replaceState(null, '', location.pathname); st.savedG = null; setTimeout(() => showJoin(m[1].toUpperCase()), 300); }
  }
  boot();
  window.addEventListener('hashchange', boot);
  return { st, owner, broadcast, send, panel, get on() { return st.on; }, get host() { return st.host; }, get guest() { return st.guest; }, get me() { return st.me; } };
})();
