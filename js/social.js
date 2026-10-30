/* Bridge Table — the team match: teams meet two by two, each match at two tables with real cards (table 1 the Open
   room, the first team North-South; table 2 the Closed room, the second team North-South; tables 3-4 the next match…);
   the app only keeps the scores: each board room against room in IMPs, the match in IMPs and VPs. (Games from before
   it, pairs at tables, still open with their matchpoints.) Anyone at a table enters the result of a board that table played (contract, declarer, tricks); the boards
   are played in any order and need not all be played. A table sees what the other tables did on a board only after
   entering its own result there. Rankings by matchpoints and IMPs. Games are kept in the online database (sb/<code>,
   with a list in sbi/<code>) and can be opened later; the administrator can delete them. */
const SB = (() => {
  'use strict';
  const sb = { list: null, id: null, g: null, view: 'boards', board: 0, form: null, err: '', busy: false, timer: 0, setup: null };
  const C = () => Net.Cloud;
  // the table is remembered per game and per player: another name on the same phone chooses its own table
  const myTableKey = id => 'bridge-sb-table-' + id + ':' + (localStorage.getItem('bridge-table-name') || '').toLowerCase();
  const myTable = () => { try { return +localStorage.getItem(myTableKey(sb.id)) || 0; } catch (e) { return 0; } };
  const setMyTable = t => { try { localStorage.setItem(myTableKey(sb.id), String(t)); } catch (e) {} };
  const SUITS = ['♣', '♦', '♥', '♠', 'NT'];
  const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  // the opening lead as saved ("♠K") and as shown (red for ♦ ♥)
  const leadHtml = ld => ld ? `<span class="${/^[♦♥]/.test(ld) ? 'red' : ''}">${ld[0]}</span>${ld.slice(1)}` : '';
  const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
  const fmtDate = ts => new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const signed = v => (v > 0 ? '+' : '') + v;
  const sym = s => s === 4 ? 'NT' : `<span class="${s === 1 || s === 2 ? 'red' : ''}">${SUITS[s]}</span>`;
  const isAdm = () => Net.isAdmin && Net.isAdmin();
  const SEATK = { n: 0, e: 1, s: 2, w: 3 };
  // the player signed in on this device (name and PIN), as the database rules know it
  const myName = () => { try { return SET.pinH ? localStorage.getItem('bridge-table-name') || '' : ''; } catch (e) { return ''; } };
  const myKey = () => { const n = myName(); return n && Net.ruleKey ? Net.ruleKey(n) : ''; };
  // the organiser: the player who opened the game, recognised by the name they are signed in with (on any device),
  // or the device it was opened on
  const isOrganiser = m => !!m && ((m.bk && m.bk === myKey()) || (C().uidNow && C().uidNow() === m.by));
  // the administrator, or the player who opened the game: they finish, open again, correct scores and delete it
  const canManage = m => isAdm() || isOrganiser(m);
  const done = () => sb.g && sb.g.m && sb.g.m.st === 'done';
  // a team match: the North-South team of table t is team t, East-West the other team of the match (tables 2k-1, 2k)
  const isTeam = m => (m || (sb.g && sb.g.m) || {}).type === 'team';
  const isOne = m => (m || (sb.g && sb.g.m) || {}).type === 'one';
  // the single table: the score expected of the side with 21+ points [not vulnerable, vulnerable]; 38-40 as 37
  const EXP = { 21: [50, 50], 22: [70, 70], 23: [110, 110], 24: [200, 290], 25: [300, 490], 26: [350, 520], 27: [400, 600], 28: [430, 630], 29: [460, 660], 30: [490, 690], 31: [630, 900], 32: [700, 1150], 33: [900, 1350], 34: [1000, 1500], 35: [1100, 1650], 36: [1200, 1800], 37: [1300, 1950] };
  const validH = h => Number.isInteger(h) && h >= 0 && h <= 40;
  // a board at the single table: the strong side, what it was expected to score, and the IMPs (North-South's view)
  function oneOf(b, r) {
    if (!r || !validH(r.h)) return null;
    const ns = nsScore(b, r);
    if (r.h === 20) return { side: null, exp: 0, imp: E.imps(ns) };
    const side = r.h > 20 ? 0 : 1, pts = side ? 40 - r.h : r.h, exp = EXP[Math.min(pts, 37)][E.vulOf(b, side) ? 1 : 0];
    const imp = E.imps((side ? -ns : ns) - exp);
    return { side, exp, imp: side ? -imp : imp };
  }
  // the players of a board (the seating when it was entered)
  const seatsOf = r => { const p = (r && r.p) || {}; return { n: p.n || SEAT[0], e: p.e || SEAT[1], s: p.s || SEAT[2], w: p.w || SEAT[3] }; };
  // each pair's IMPs (and each player's)
  function oneStand() {
    const P = {}, Q = {}, add = (O, k, name, v) => { const x = O[k] || (O[k] = { name, n: 0, imp: 0 }); x.n++; x.imp += v; };
    for (const b in (sb.g.r || {})) {
      const r = (sb.g.r[b] || {})[1]; if (!r || !r.ok) continue; const o = oneOf(+b, r); if (!o) continue; const p = seatsOf(r);
      for (const [k, v] of [['n', o.imp], ['s', o.imp], ['e', -o.imp], ['w', -o.imp]]) add(P, p[k].toLowerCase(), p[k], v);
      for (const [a, c, v] of [[p.n, p.s, o.imp], [p.e, p.w, -o.imp]]) { const nm = [a, c].sort((x, y) => x.localeCompare(y)); add(Q, nm.join('|').toLowerCase(), nm.join(' – '), v); }
    }
    const srt = O => Object.values(O).sort((a, b) => b.imp - a.imp);
    return { P: srt(P), Q: srt(Q) };
  }
  const partnerT = t => +t % 2 ? +t + 1 : +t - 1;
  const teamName = (i, m) => (((m || sb.g.m).tm || [])[i - 1]) || T('Team {0}', i);
  const roomName = t => t % 2 ? T('Open room') : T('Closed room');
  // the WBF scale of victory points (20 to share) for an IMP margin over a number of boards
  function vpOf(m, bd) {
    const tau = (Math.sqrt(5) - 1) / 2, B = 15 * Math.sqrt(bd || 1);
    const w = Math.round(Math.min(20, 10 + 10 * (1 - Math.pow(tau, 3 * Math.abs(m) / B)) / (1 - Math.pow(tau, 3))) * 100) / 100;
    return m >= 0 ? w : Math.round((20 - w) * 100) / 100;
  }
  // each match: the IMPs of both teams over the boards both rooms have confirmed, and the VPs
  function matches() {
    const g = sb.g, L = [];
    for (let k = 1; 2 * k <= g.m.tb; k++) {
      const o = 2 * k - 1, c = 2 * k, rows = []; let ih = 0, ia = 0, bh = 0;
      for (let b = 1; b <= g.m.bd; b++) {
        const R = (g.r || {})[b] || {}, ro = R[o] && R[o].ok ? R[o] : null, rc = R[c] && R[c].ok ? R[c] : null;
        const d = ro && rc ? nsScore(b, ro) - nsScore(b, rc) : null, i = d == null ? null : E.imps(d); if (i > 0) ih += i; else if (i < 0) ia -= i;
        if (d != null) bh += d > 0 ? 1 : d === 0 ? 0.5 : 0;   // matchpoints: the board won by the score
        if (ro || rc) rows.push({ b, o: ro && nsScore(b, ro), c: rc && nsScore(b, rc), i });
      }
      const vh = vpOf(ih - ia, g.m.bd), n = rows.filter(r => r.i != null).length, mh = n ? Math.round(bh / n * 1000) / 10 : null;
      L.push({ k, h: o, a: c, ih, ia, n, rows, vh, va: Math.round((20 - vh) * 100) / 100, mh, ma: mh == null ? null : Math.round((100 - mh) * 10) / 10 });
    }
    return L;
  }

  // a member number → the member's name, from the member list the federation file filled
  const members = {};
  async function memberName(num) {
    if (num in members) return members[num];
    try { const v = await C().get('gate/members/' + num); members[num] = typeof v === 'string' ? v : null; } catch (e) { return null; }
    return members[num];
  }
  document.addEventListener('change', async e => {
    const el = e.target; if (!el || !el.matches || !el.matches('#ov input[data-member]')) return;
    const v = el.value.trim(); if (!/^\d{1,8}$/.test(v)) return;
    const n = await memberName(v); if (n && el.value.trim() === v) el.value = n.slice(0, 20);
  });

  /* ---- scores ---- */
  // the North-South score of one result
  function nsScore(b, r) {
    if (!r || !r.l) return 0;
    const sc = E.scoreOf(r.l, r.s, r.x || 0, E.vulOf(b, r.d), r.k);
    return E.sideOf(r.d) === 0 ? sc : -sc;
  }
  // per board, each table's result compared with the other tables' (matchpoints % and cross-IMPs, North-South view);
  // only scores the other pair has confirmed count
  function boardCmp(b) {
    const R = (sb.g.r || {})[b] || {}, ts = Object.keys(R).filter(t => R[t].ok), out = {};
    if (isOne()) { for (const t of ts) { const o = oneOf(+b, R[t]); out[t] = { ns: nsScore(b, R[t]), cmp: o ? { imp: o.imp, mp: null } : null }; } return out; }
    if (isTeam()) { for (const t of ts) { const me = nsScore(b, R[t]), p = R[partnerT(+t)]; out[t] = { ns: me, cmp: p && p.ok ? { imp: E.imps(me - nsScore(b, p)), mp: null } : null }; } return out; }
    for (const t of ts) {
      const me = nsScore(b, R[t]), field = ts.filter(x => x !== t).map(x => nsScore(b, R[x]));
      out[t] = { ns: me, cmp: field.length ? E.compare(me, field) : null };
    }
    return out;
  }
  // every pair (the North-South and East-West pair of each table; nobody changes tables)
  function standings() {
    const g = sb.g, rows = {};
    for (let t = 1; t <= g.m.tb; t++) for (const dir of ['ns', 'ew']) rows[t + dir] = { t, dir, name: pairName(t, dir), n: 0, mp: 0, mpN: 0, imp: 0 };
    for (const b in (g.r || {})) {
      const c = boardCmp(b);
      for (const t in c) {
        if (!rows[t + 'ns']) continue;
        for (const dir of ['ns', 'ew']) {
          const r = rows[t + dir]; r.n++;
          if (c[t].cmp) { r.mp += dir === 'ns' ? c[t].cmp.mp : 100 - c[t].cmp.mp; r.mpN++; r.imp += dir === 'ns' ? c[t].cmp.imp : -c[t].cmp.imp; }
        }
      }
    }
    const L = Object.values(rows).filter(r => r.n);
    L.forEach(r => { r.pct = r.mpN ? Math.round(r.mp / r.mpN * 10) / 10 : null; r.imp = Math.round(r.imp * 10) / 10; });
    return L.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.imp - a.imp);   // MP % first, then IMP (both are shown)
  }
  function pairName(t, dir) {
    const p = ((sb.g.t || {})[t]) || {}, a = dir === 'ns' ? [p.n, p.s] : [p.e, p.w];
    const s = a.filter(Boolean).join(' – ');
    if (isTeam()) { const pl = a.filter(x => x && !SEAT.includes(x)).join(' – '); return teamName(dir === 'ns' ? t : partnerT(t)) + (pl ? ' (' + pl + ')' : ''); }
    return s || T('Table {0}', t) + ' ' + (dir === 'ns' ? SEAT_AB[0] + SEAT_AB[2] : SEAT_AB[1] + SEAT_AB[3]);
  }
  const conTxt = r => !r.l ? T('Passed out') : `${r.l}${sym(r.s)}${r.x === 1 ? 'X' : r.x === 2 ? 'XX' : ''} ${SEAT_AB[r.d]}`;
  const resTxt = r => { if (!r.l) return ''; const d = r.k - (r.l + 6); return d === 0 ? '=' : signed(d); };

  /* ---- loading ---- */
  async function loadList() {
    try { const L = await C().get('sbi'); sb.list = Object.entries(L || {}).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.ts - a.ts); sb.err = ''; }
    catch (e) { sb.list = sb.list || []; sb.err = T('Could not reach the server. Check the internet connection.'); }
  }
  async function loadGame(id) {
    const g = await C().get('sb/' + id);
    if (!g || !g.m) return false;
    // the database gives keys 1, 2, 3… back as an array (with an empty first place): turn them into plain objects again
    const obj = a => { const o = {}; if (a) for (const k of Object.keys(a)) if (a[k] != null) o[k] = a[k]; return o; };
    g.t = obj(g.t); g.r = obj(g.r); for (const b in g.r) g.r[b] = obj(g.r[b]);
    sb.g = g; sb.id = id; return true;
  }
  function poll() {
    clearInterval(sb.timer);
    sb.timer = setInterval(async () => {
      if (ui.overlay !== 'sb' || !sb.id) { clearInterval(sb.timer); return; }
      const a = document.activeElement; if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;   // not while typing
      try { const old = JSON.stringify(sb.g); if (await loadGame(sb.id) && JSON.stringify(sb.g) !== old) show(); } catch (e) {}
    }, 8000);
  }

  /* ---- screens ---- */
  const LAST = 'bridge-sb-last';
  const setLast = id => { try { if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST); } catch (e) {} };
  // the game this device was last entering scores in opens again at once (ready for the next board) while it is running
  // the Social bridge button: a game running now opens on its entry screen (table number, or Admin for its organiser);
  // without one, the list of games
  async function open() {
    sb.id = null; sb.g = null; sb.setup = null; sb.err = ''; sb.entry = true;
    openOv('sb', `<div class="muted">${T('Loading…')}</div>`);
    await loadList(); if (ui.overlay === 'sb' && !sb.id && !sb.setup) show();
  }
  const runningGames = () => (sb.list || []).filter(g => g.st !== 'done' && Date.now() - g.ts < 24 * 3600e3);
  function entryHtml() {
    const R = runningGames();
    return `<h2>🃏 ${T('Team match')}</h2>` + R.map(g => `<div class="sbentry"><b>🃏 ${esc(g.n)}</b><small>${T('{0} tables', g.tb)} · ${T('{0} boards', g.bd)}</small>
      <div class="grp"><span>${T('Table No')}</span><div class="bm3-keys k4 sbpick">${[...Array(g.tb).keys()].map(i => `<button class="bm3-key" data-sbent="${g.id}:${i + 1}">${i + 1}</button>`).join('')}</div></div>${legend(g)}
      ${canManage(g) ? `<button class="btn gold sbadmin" data-sbmng="${g.id}">⚙️ ${T('Admin')}</button>` : ''}</div>`).join('')
      + `<div class="row2"><button class="btn gold" id="sbNew">🃏 ${T('Real cards')}</button><button class="btn new" id="sbOnline">🌐 ${T('Online')}</button><button class="btn new" id="sbOne">🪑 ${T('Single table')}</button><button class="btn" id="sbList">${T('All games')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`;
  }
  // a team match: the tables of each match and who sits North-South there
  const legend = m => !isTeam(m) ? '' : `<div class="tmleg">${[...Array(Math.floor(m.tb / 2)).keys()].map(i => { const a = teamName(2 * i + 1, m), b = teamName(2 * i + 2, m);
    return `<div><b>${T('Match {0}', i + 1)}: ${esc(a)} – ${esc(b)}</b><small>${T('Table {0}', 2 * i + 1)} · ${T('Open room')}: ${esc(a)} ${SEAT_AB[0] + SEAT_AB[2]} · ${T('Table {0}', 2 * i + 2)} · ${T('Closed room')}: ${esc(b)} ${SEAT_AB[0] + SEAT_AB[2]}</small></div>`; }).join('')}</div>`;
  /* ---- seat requests: a player asks for a seat, the organiser accepts ---- */
  const reqKey = () => (myKey() || ('u' + ((C().uidNow && C().uidNow()) || ''))).replace(/[.#$\[\]\/%]/g, '_');   // a database key
  const freeSeat = v => !v || SEAT.includes(v);   // empty, or only its direction's name
  function myReq() { const k = reqKey(); if (!sb.g || !k) return null; for (const t in (sb.g.t || {})) { const q = ((sb.g.t[t] || {}).q || {})[k]; if (q) return { ...q, t: +t, k }; } return null; }
  function waitingReqs() { const L = []; for (const t in ((sb.g && sb.g.t) || {})) for (const [k, q] of Object.entries((sb.g.t[t] || {}).q || {})) if (q && q.st === 'wait') L.push({ ...q, t: +t, k }); return L.sort((a, b) => a.ts - b.ts); }
  // the player's screen until they are seated: the table, then the seat; or the request waiting
  function reqHtml() {
    const m = sb.g.m, q = myReq();
    if (q && q.st === 'wait') return `<div class="sbwait">⏳ ${T('You asked for {0}: the organiser accepts it.', T('Table {0}', q.t) + ' · ' + SEAT[SEATK[q.s]])}</div><div class="row2"><button class="btn" id="sbReqX">✕ ${T('Withdraw the request')}</button></div>`;
    const t = sb.reqT, p = t ? (sb.g.t || {})[t] || {} : null;
    return `${q && q.st === 'no' ? `<div class="no">${T('Your request was not accepted. Choose another seat.')}</div>` : ''}<div class="grp"><span>${T('My table')}</span><div class="muted">${T('Choose a table and a seat: the organiser accepts you.')}</div><div class="bm3-keys k4 sbpick" data-sbseg="rq">${[...Array(m.tb).keys()].map(i => `<button data-v="${i + 1}" class="bm3-key${t === i + 1 ? ' active' : ''}">${i + 1}</button>`).join('')}</div>${t ? '' : legend(m)}</div>
      ${t ? `<div class="grp"><span>${T('Table {0}', t)}${isTeam() ? ' · ' + roomName(t) : ''}</span><div class="sbc-table">${['n', 'w', 'mid', 'e', 's'].map(k => k === 'mid' ? `<div class="sbc-mid">${T('Table {0}', t)}</div>` : `<button class="sbc-pos sbc-${k}" data-sbrqs="${k}"${freeSeat(p[k]) ? '' : ' disabled'}><small>${SEAT[SEATK[k]]}</small><b>${freeSeat(p[k]) ? '＋' : esc(p[k])}</b></button>`).join('')}</div><div class="muted">${T('Tap a free seat to ask for it.')}</div></div>` : ''}`;
  }
  // the organiser: the requests waiting, each accepted or declined
  function reqListHtml() {
    const L = waitingReqs(); if (!L.length) return '';
    return `<div class="grp sbreqs"><span>🙋 ${T('Seat requests')}</span>${L.map(q => `<div class="sbreq"><b>${esc(q.n)}</b><small>${T('Table {0}', q.t)}${isTeam() ? ' · ' + roomName(q.t) : ''} · ${SEAT[SEATK[q.s]]}</small><button class="btn new mini-btn" data-sbacc="${q.t}:${esc(q.k)}">✓ ${T('Accept')}</button><button class="btn tdel mini-btn" data-sbrej="${q.t}:${esc(q.k)}">✕</button></div>`).join('')}</div>`;
  }
  async function sendReq(seatK) {
    const t = sb.reqT; if (!t || sb.busy) return;
    sb.busy = true;
    try {
      await C().uid(); const k = reqKey(), old = myReq(), up = {};
      if (old && old.t !== t) up['sb/' + sb.id + '/t/' + old.t + '/q/' + k] = null;
      up['sb/' + sb.id + '/t/' + t + '/q/' + k] = { n: (myName() || T('Player')).slice(0, 20), s: seatK, ts: Date.now(), st: 'wait' };
      await C().patch('', up); sb.err = '';
    } catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    sb.busy = false; try { await loadGame(sb.id); } catch (e) {} show();
  }
  async function dropReq() { const q = myReq(); if (!q) return; try { await C().put('sb/' + sb.id + '/t/' + q.t + '/q/' + q.k, null); } catch (e) {} sb.reqT = 0; try { await loadGame(sb.id); } catch (e) {} show(); }
  async function answerReq(t, k, ok) {
    const q = (((sb.g.t || {})[t] || {}).q || {})[k]; if (!q) return;
    await signIn();
    const base = 'sb/' + sb.id + '/t/' + t, up = { [base + '/q/' + k + '/st']: ok ? 'ok' : 'no' };
    if (ok) up[base + '/' + q.s] = String(q.n).slice(0, 20);
    try { await C().patch('', up); sb.err = ''; } catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    try { await loadGame(sb.id); } catch (e) {} show();
  }
  // a score this table entered that the other pair has not confirmed yet: the screen stays on that board until it is
  const pending = () => { if (!sb.g || done() || sb.formT) return 0; const mt = myTable(); if (!mt) return 0; for (const b in (sb.g.r || {})) { const r = sb.g.r[b][mt]; if (r && !r.ok) return +b; } return 0; };
  const locked = () => ui.overlay === 'sb' && !!sb.id && !sb.setup && !!pending();
  function show() {
    if (sb.id && !sb.setup && sb.g && !myTable() && !canManage(sb.g.m)) { const q = myReq(); if (q && q.st === 'ok') { setMyTable(q.t); sb.reqT = 0; } }
    if (sb.id && !sb.setup) { const p = pending(); if (p) sb.board = p; }
    // a redraw of the same screen (a button tapped, a score saved) keeps the page where it was; a new screen starts at the top
    const key = sb.setup ? 'setup' : !sb.id ? 'list' : sb.id + ':' + sb.board + ':' + sb.view, old = document.querySelector('#ov .sheet');
    const top = ui.overlay === 'sb' && sb.key === key && old ? old.scrollTop : 0;
    sb.key = key;
    openOv('sb', sb.setup ? setupHtml() : !sb.id ? (sb.entry && runningGames().length ? entryHtml() : listHtml()) : gameHtml());
    const s = document.querySelector('#ov .sheet'); if (s && top) s.scrollTop = top;
    // a player's game fills the screen (table number, players, boards, the scoring)
    if (s) s.classList.toggle('sbfull', !!(sb.id && !sb.setup && sb.g && sb.g.m && !canManage(sb.g.m)));
  }
  function listHtml() {
    const rows = (sb.list || []).map(g => `<tr><td><b>🃏 ${esc(g.n)}</b><small>${fmtDate(g.ts)}${g.byn ? ' · ' + esc(g.byn) : ''}</small></td>
      <td data-l="${T('Tables')}" class="n">${g.tb}${isTeam(g) ? `<small>${T('{0} teams', g.tb)}</small>` : ''}</td><td data-l="${T('Boards')}" class="n">${g.bd}</td>
      <td data-l="${T('Status')}">${g.st === 'done' ? `<span class="tst">${T('Finished')}</span>` : `<span class="tst run">${T('Running')}</span>`}</td>
      <td class="tact"><button class="btn new" data-sbopen="${g.id}">${T('Open')}</button>${canManage(g) ? `<button class="btn tdel" data-sbdel="${g.id}" title="${T('Delete')}">✕</button>` : ''}</td></tr>`).join('');
    return `<h2>🃏 ${T('Team match')}</h2>
      <div class="muted">🌐 ${T('Online: played in the app with its cards; robots take the empty seats. 🃏 Real cards: played at real tables, the app keeps the scores.')}</div>
      <div class="muted">${T('Teams meet two by two with real cards: one pair of each team in the Open room, the other in the Closed room, on the same boards. The app compares the rooms in IMPs and gives the match its VPs. Anyone at a table enters the boards that table played, in any order.')}</div>
      ${isAdm() ? `<div class="row2"><button class="btn gold" id="rtOpen">🤖 ${T('Team match with robots')}</button></div>` : ''}
      <div class="row2"><button class="btn gold" id="sbNew">🃏 ${T('Real cards')}</button><button class="btn new" id="sbOnline">🌐 ${T('Online')}</button><button class="btn new" id="sbOne">🪑 ${T('Single table')}</button></div>
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      ${sb.list == null ? `<div class="muted">${T('Loading…')}</div>` : rows ? `<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th>${T('Game')}</th><th class="n">${T('Tables')}</th><th class="n">${T('Boards')}</th><th>${T('Status')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="muted">${T('No games yet.')}</div>`}
      <div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`;
  }
  const seg = (name, opts, cur) => `<div class="seg" data-sbseg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  function setupHtml() {
    const s = sb.setup;
    if (s.one) { const p = s.names[1] || {};
      return `<h2>🪑 ${T('Single table')}</h2>
      <div class="muted">${T('Four players, real cards. Each board is entered with its contract and North-South’s points: the side with 21 or more points is expected the score of the table, and the difference is counted in IMPs for both partners.')}</div>
      <div class="grp"><span>${T('Name')}</span><input class="tok wide" id="sbName" maxlength="40" value="${esc(s.n)}"></div>
      <div class="grp"><span>${T('Players')}</span><div class="tsetrow sbrow">${['n', 's', 'e', 'w'].map(k => `<label><small>${SEAT[SEATK[k]]}</small><input class="tok" maxlength="20" data-sbpl="${k}" data-member placeholder="${SEAT[SEATK[k]]}" value="${esc(p[k] || '')}"></label>`).join('')}</div><div class="muted">${T('Not required: the directions are used.')}</div></div>
      <div class="grp"><span>${T('Boards')}</span>${seg('bd', [8, 12, 16, 20, 24, 28, 32].map(n => [n, n]), s.bd)}</div>
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      <div class="row2"><button class="btn new" id="sbCreate"${sb.busy ? ' disabled' : ''}>${T('Start the game')}</button><button class="btn" id="sbBack">${T('Back')}</button></div>`; }
    return `<h2>🃏 ${T('New game')}</h2>
      <div class="grp"><span>${T('Name')}</span><input class="tok wide" id="sbName" maxlength="40" value="${esc(s.n)}"></div>
      <div class="grp"><span>${T('Teams')}</span>${seg('tb', [2, 4, 6, 8, 10, 12].map(n => [n, n]), s.tb)}</div>
      <div class="grp"><span>${T('Team names')}</span><div class="tmnames">${[...Array(s.tb / 2).keys()].map(i => `<div class="tmpair"><small>${T('Match {0}', i + 1)}</small><input class="tok" maxlength="20" data-sbteam="${2 * i}" placeholder="${T('Team {0}', 2 * i + 1)}" value="${esc(s.tm[2 * i] || '')}"><span>–</span><input class="tok" maxlength="20" data-sbteam="${2 * i + 1}" placeholder="${T('Team {0}', 2 * i + 2)}" value="${esc(s.tm[2 * i + 1] || '')}"></div>`).join('')}</div></div>
      <div class="muted">${T('{0} tables: in each match the first team sits North-South in the Open room, the second in the Closed room.', s.tb)}</div>
      <div class="grp"><span>${T('Boards')}</span>${seg('bd', [8, 12, 16, 20, 24, 28, 32, 36].map(n => [n, n]), s.bd)}</div>
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      <div class="row2"><button class="btn new" id="sbCreate"${sb.busy ? ' disabled' : ''}>${T('Start the game')}</button><button class="btn" id="sbBack">${T('Back')}</button></div>`;
  }
  function readSetup() {
    const s = sb.setup; if (!s) return;
    const n = $('sbName'); if (n) s.n = n.value.trim().slice(0, 40);
    for (const i of document.querySelectorAll('[data-sbteam]')) s.tm[+i.dataset.sbteam] = i.value.trim().slice(0, 20);
    for (const i of document.querySelectorAll('[data-sbpl]')) (s.names[1] = s.names[1] || {})[i.dataset.sbpl] = i.value.trim().slice(0, 20);
  }
  function gameHtml() {
    const g = sb.g, m = g.m, mt = myTable();
    const tabs = `<div class="seg ttabs">${[['boards', T('Board list')], ['rank', T('Standings')], ['tables', T('Tables')]].map(([v, l]) => `<button data-sbview="${v}" class="${sb.view === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    // the organiser sends the players one link; a player chooses the table on a screen of its own
    const links = done() || !canManage(m) ? '' : `<div class="grp sblinks"><div class="muted">📲 ${T('Send the players the link: they open Bridge Table, tap Table No and choose their table.')}</div><div class="sblk"><span class="sblt all"><b>${T('The game’s link, for everyone')}</b>${sendBtns(0)}</span></div></div>`;
    let body = '';
    const pickTable = !mt && !done() && !canManage(m);
    const orgPick = !mt && !done() && canManage(m) && !sb.board ? `<div class="grp"><span>${T('My table')}</span><div class="muted">${T('Playing too? Choose your table to enter its scores.')}</div><div class="bm3-keys k4 sbpick" data-sbseg="me">${[...Array(m.tb).keys()].map(i => `<button data-v="${i + 1}" class="bm3-key">${i + 1}</button>`).join('')}</div>${legend(m)}</div>` : '';
    if (pickTable) body = reqHtml();
    else if (sb.board) body = boardHtml(sb.board);
    else if (sb.view === 'rank') body = rankHtml();
    else if (sb.view === 'tables') body = tablesHtml();
    else body = boardsHtml();
    // a player sees only the game (full screen, no title lines); the organiser keeps the game's details
    return `${canManage(m) ? '' : `<div class="sbbar"><span class="td">🃏</span><div class="ev"><b>${esc(m.n)}</b>${mt ? T('Table {0}', mt) + (isTeam() ? ' · ' + roomName(mt) : '') : T('Team match')}</div></div>`}${canManage(m) ? `<h2>${isOne() ? '🪑' : '🃏'} ${esc(m.n)}</h2>
      <div class="muted">${isOne() ? T('Single table') : isTeam() ? T('{0} teams', m.tb) : T('{0} tables', m.tb)} · ${T('{0} boards', m.bd)} · ${done() ? T('Finished') : T('Running')}${m.byn ? ' · 👤 ' + esc(m.byn) : ''}</div>` : ''}
      ${sb.board || !canManage(m) || done() ? '' : reqListHtml()}${sb.board ? '' : links}${orgPick}${mt && !done() && !pending() && !sb.board ? `<div class="sbchg"><span class="sbtno">${T('Table {0}', mt)}${isTeam() ? ` <small>${roomName(mt)}</small>` : ''}</span>${isOne() ? `<button class="btn gold" id="sbSeating">🔄 ${T('Change the seating')}</button>` : `<button class="btn gold" id="sbChangeT">🔄 ${T('Change table')}</button>`}</div>` : ''}${sb.board || pickTable ? '' : tabs}${body}
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      <div class="row2">${pending() ? '' : sb.board ? `<button class="btn gold" id="sbBoards">← ${T('Board list')}</button>` : canManage(m) ? `<button class="btn" id="sbList">← ${T('All games')}</button>` : ''}
        ${!sb.board && !done() && canManage(m) ? `<button class="btn" id="sbEnd">${T('Finish the game')}</button>` : ''}
        ${!sb.board && done() && canManage(m) ? `<button class="btn new" id="sbReopen">↺ ${T('Open the game again')}</button>` : ''}
        ${!sb.board && canManage(m) ? `<button class="btn tdel" data-sbdel="${sb.id}">✕ ${T('Delete')}</button>` : ''}
        ${sb.board || !canManage(m) ? '' : `<button class="btn gold" id="oClose">${T('Close')}</button>`}</div>`;   // a player stays in the game that was set up
  }
  function boardsHtml() {
    const g = sb.g, mt = myTable();
    const cells = [...Array(g.m.bd).keys()].map(i => {
      const b = i + 1, R = (g.r || {})[b] || {}, n = Object.keys(R).length, me = mt && R[mt];
      return `<button class="sbb${me ? ' me' : ''}${n ? ' some' : ''}" data-sbboard="${b}"><b>${b}</b><small>${me ? (me.ok ? '✓ ' : '⏳ ') : ''}${n ? T('{0} tables', n) : '—'}</small></button>`;
    }).join('');
    return `<div class="muted">${done() ? T('Tap a board to see what was played.') : mt ? T('Tap a board your table played to enter its score.') : canManage(g.m) ? T('Tap a board to see what was played.') : T('First choose your table above.')}</div><div class="sbgrid">${cells}</div>`;
  }
  function boardHtml(b) {
    const g = sb.g, mt = myTable(), R = (g.r || {})[b] || {}, ts = Object.keys(R).sort((x, y) => x - y);
    const vul = [E.vulOf(b, 0), E.vulOf(b, 1)], vt = vul[0] && vul[1] ? T('All vulnerable') : vul[0] ? T('{0} vulnerable', SEAT_AB[0] + SEAT_AB[2]) : vul[1] ? T('{0} vulnerable', SEAT_AB[1] + SEAT_AB[3]) : T('None vulnerable');
    const head = `<h3>${T('Board {0}', b)} <small class="muted">${T('Dealer')}: ${SEAT[E.dealerOf(b)]} · ${vt}</small></h3>`;
    const mine = mt && R[mt], others = ts.filter(t => +t !== mt).length;
    if (sb.form || (!done() && mt && !mine)) return formHtml(b) + (others && !sb.formT ? `<div class="muted">${T('{0} tables have played this board. You will see their results after entering yours.', others)}</div>` : '');
    if (!done() && !mt && !canManage(g.m)) return head + `<div class="muted">${T('First choose your table above.')}</div>`;
    if (!done() && mine && !mine.ok) return head + `<div class="sbform"><div class="muted">${T('Table {0}', mt)}: ${esc(pairName(mt, 'ns'))} — ${esc(pairName(mt, 'ew'))}</div>
      <div class="sbprev"><b>${conTxt(mine)} ${resTxt(mine)} · ${scoreTxt(b, mine)}</b></div>
      <div class="sbwait">⏳ ${T('The other pair checks the score and confirms it.')}</div>
      <div class="row2"><button class="btn new" id="sbOk">✓ ${T('We confirm')}</button><button class="btn" id="sbFix">✎ ${T('Correct')}</button></div>
      ${others ? `<div class="muted">${T('Results of the other tables appear after the confirmation.')}</div>` : ''}</div>`;
    const c = boardCmp(b), wait = ts.filter(t => !R[t].ok).length;
    const tm = isTeam() || isOne();
    const rows = ts.map(t => { const r = R[t], x = c[t] || { ns: nsScore(b, r), cmp: null }; return `<tr class="${+t === mt ? 'me' : ''}"><td data-l="${T('Table')}" class="n">${t}${isTeam() ? `<small>${roomName(+t)}</small>` : ''}</td><td data-l="${T('Pairs')}"><small>${esc(pairName(t, 'ns'))}<br>${esc(pairName(t, 'ew'))}</small></td>
      <td data-l="${T('Contract')}"><b>${conTxt(r)}</b> ${resTxt(r)}${r.ld ? ` <small>· ${leadHtml(r.ld)}</small>` : ''}${isOne() ? oneLine(b, r) : ''}</td><td data-l="${SEAT_AB[0] + SEAT_AB[2]}" class="n">${x.ns > 0 ? x.ns : ''}</td><td data-l="${SEAT_AB[1] + SEAT_AB[3]}" class="n">${x.ns < 0 ? -x.ns : ''}</td>
      ${tm ? '' : `<td data-l="MP %" class="n">${!r.ok ? '⏳' : x.cmp ? x.cmp.mp : '—'}</td>`}<td data-l="IMP" class="n">${x.cmp ? signed(x.cmp.imp) : '—'}</td>${canManage(g.m) ? `<td class="tact"><button class="btn mini-btn" data-sbadm="${t}" title="${T('Correct')}">✎</button></td>` : ''}</tr>`; }).join('');
    return head + `<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th class="n">${T('Table')}</th><th>${T('Pairs')}</th><th>${T('Contract')}</th><th class="n">${SEAT_AB[0] + SEAT_AB[2]}</th><th class="n">${SEAT_AB[1] + SEAT_AB[3]}</th>${tm ? '' : '<th class="n">MP %</th>'}<th class="n">IMP</th>${canManage(g.m) ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="muted">${isOne() ? T('IMP from North-South’s side: the score against the score expected of the side with 21 or more points.') : tm ? T('IMP from North-South’s side, against the other room of the same match.') : T('MP % and IMP from North-South’s side, against the other tables.')}${wait ? ' ⏳ ' + T('{0} tables waiting for confirmation', wait) : ''} ${T('Only the organiser or the administrator can change a confirmed score.')}</div>`;
  }
  const oneLine = (b, r) => { const o = oneOf(b, r); return o ? `<small>${T('N-S {0} points', r.h)} · ${o.side == null ? T('20–20: nothing expected') : T('{0} expected {1}', o.side ? SEAT_AB[1] + SEAT_AB[3] : SEAT_AB[0] + SEAT_AB[2], o.exp)}</small>` : ''; };
  const scoreTxt = (b, r) => { const ns = nsScore(b, r), ew = r.l && E.sideOf(r.d) === 1; return `${ew ? SEAT_AB[1] + SEAT_AB[3] : SEAT_AB[0] + SEAT_AB[2]} ${signed(ew ? -ns : ns)}`; };
  function formHtml(b) {
    const mt = sb.formT || myTable(), R = (sb.g.r || {})[b] || {};
    const f = sb.form || (sb.form = R[mt] ? { ...R[mt], ls: R[mt].ld ? SUITS.indexOf(R[mt].ld[0]) : null, lr: R[mt].ld ? RANKS.indexOf(R[mt].ld.slice(1)) : null } : { l: null, s: null, x: 0, d: null, k: null, ls: null, lr: null });
    const lead = f.ls != null && f.ls >= 0 && f.lr != null && f.lr >= 0;
    const need = f.l ? f.l + 6 : 0;
    const res = f.l ? [...Array(14).keys()].map(k => [k, k - need === 0 ? '=' : signed(k - need)]) : [];
    const okb = f.l === 0 || (f.l && f.s != null && f.d != null && f.k != null && lead), ok = okb && (!isOne() || validH(f.h));
    // the screen of a Bridgemate III: the contract and the N-S score on the display, then one row of large keys per step
    const ns = ok ? (f.l ? nsScore(b, f) : 0) : null;
    const contract = f.l === 0 ? T('Pass') : f.l ? `${f.l}${f.s != null ? sym(f.s) : ''}${f.x === 1 ? ' X' : f.x === 2 ? ' XX' : ''}${f.d != null ? ' ' + SEAT_AB[f.d] : ''}` : '—';
    const vul = [E.vulOf(b, 0), E.vulOf(b, 1)], vc = vul[0] && vul[1] ? 'both' : vul[0] ? 'ns' : vul[1] ? 'ew' : 'none';
    const vt = vul[0] && vul[1] ? T('All vulnerable') : vul[0] ? T('{0} vulnerable', SEAT_AB[0] + SEAT_AB[2]) : vul[1] ? T('{0} vulnerable', SEAT_AB[1] + SEAT_AB[3]) : T('None vulnerable');
    const keys = (name, cls, opts, cur) => `<div class="bm3-keys ${cls}" data-sbseg="${name}">${opts.map(([v, l, c]) => `<button data-v="${v}" class="bm3-key ${c || ''}${String(cur) === String(v) ? ' active' : ''}">${l}</button>`).join('')}</div>`;
    return `<div class="bm3"><div class="bm3-screen">
      <div class="bm3-bar"><span class="td">🃏</span><div class="ev"><b>${esc(sb.g.m.n)}</b>${T('Table {0}', mt)}${isTeam() ? ' · ' + roomName(mt) : ''} · ${T('Dealer')}: ${SEAT[E.dealerOf(b)]}</div></div>
      <div class="bm3-head">
        <div class="bm3-board"><small>${T('Board')}</small><b>${b}</b><span class="bm3-vul ${vc}">${vt}</span></div>
        ${R[mt] ? `<div class="bm3-edit">✎</div>` : ''}
        <div class="bm3-pairs"><div><i>${SEAT_AB[0] + SEAT_AB[2]}</i>${esc(pairName(mt, 'ns'))}</div><div><i>${SEAT_AB[1] + SEAT_AB[3]}</i>${esc(pairName(mt, 'ew'))}</div></div>
      </div>
      <div class="bm3-display">
        <div class="bm3-contract">${contract}</div>
        <div class="bm3-sub"><span>${T('Opening lead')}: ${lead ? leadHtml(SUITS[f.ls] + RANKS[f.lr]) : '—'}</span><span>${T('Result')}: ${f.l && f.k != null ? resTxt(f) : '—'}</span></div>
        <div class="bm3-score"><small>${SEAT_AB[0] + SEAT_AB[2]}</small><b class="${ns > 0 ? 'pos' : ns < 0 ? 'neg' : ''}">${ns == null ? '—' : signed(ns)}</b></div>
      </div>
      <div class="bm3-step">${T('Contract')}</div>
      ${keys('l', 'k4', [...[1, 2, 3, 4, 5, 6, 7].map(n => [n, n]), [0, T('Pass'), 'pass']], f.l)}
      ${f.l ? `${keys('s', 'k5', [0, 1, 2, 3, 4].map(i => [i, i === 4 ? 'NT' : SUITS[i], 'suit' + (i === 1 || i === 2 ? ' red' : '')]), f.s)}
      ${keys('x', 'k3', [[0, '—'], [1, 'X', 'dbl'], [2, 'XX', 'dbl']], f.x)}
      <div class="bm3-step">${T('Declarer')}</div>
      ${keys('d', 'k4', [0, 1, 2, 3].map(s => [s, SEAT_AB[s]]), f.d)}` : ''}
      ${f.l && f.s != null && f.d != null ? `<div class="bm3-step">${T('Opening lead')}</div>
      ${keys('ls', 'k4', [0, 1, 2, 3].map(i => [i, SUITS[i], 'suit' + (i === 1 || i === 2 ? ' red' : '')]), f.ls)}
      ${keys('lr', 'k7 small', RANKS.map((r, i) => [i, r]), f.lr)}` : ''}
      ${f.l && f.s != null && f.d != null && lead ? `<div class="bm3-step">${T('Result')}</div>
      ${keys('k', 'k7', res.map(([k, l]) => [k, l, 'res ' + (k - need === 0 ? 'made' : k > need ? 'over' : 'down')]), f.k)}` : ''}
      ${isOne() && (f.l === 0 || f.k != null) ? `<div class="bm3-step">${T('North-South’s points (0–40)')}</div><input class="bm3-hcp" id="sbHcp" type="number" inputmode="numeric" min="0" max="40" value="${f.h ?? ''}" placeholder="${T('High-card points')}" data-okb="${okb ? 1 : ''}">` : ''}
      <div class="bm3-actions"${R[mt] ? '' : ' style="grid-template-columns:1fr"'}>${R[mt] ? `<button class="bm3-cancel" id="sbCancel">✕ ${T('Cancel')}</button>` : ''}<button class="bm3-ok" id="sbSave"${ok && !sb.busy ? '' : ' disabled'}>✓ ${T('Save')}</button></div>
    </div></div>`;
  }
  function teamRankHtml() {
    const M = matches();
    if (!M.some(x => x.rows.length)) return `<div class="muted">${T('No scores yet.')}</div>`;
    const cards = M.map(x => `<div class="teams"><div class="tmhead">${T('Match {0}', x.k)} · ${T('{0} boards', x.n)}</div><div class="tscore"><div><b>${esc(teamName(x.h))}</b><small>VP ${x.vh} · MP ${x.mh ?? '—'}%</small></div><div class="tsn">${x.ih} – ${x.ia}</div><div><b>${esc(teamName(x.a))}</b><small>VP ${x.va} · MP ${x.ma ?? '—'}%</small></div></div>
      <details class="tmbd"><summary>${T('Board by board')}</summary><div class="resscroll"><table class="res"><thead><tr><th>${T('Bd')}</th><th class="n">${T('Open room')}</th><th class="n">${T('Closed room')}</th><th class="n">${esc(teamName(x.h))}</th><th class="n">${esc(teamName(x.a))}</th></tr></thead><tbody>${x.rows.map(r => `<tr><td>${r.b}</td><td class="n">${r.o == null ? '…' : signed(r.o)}</td><td class="n">${r.c == null ? '…' : signed(r.c)}</td><td class="n">${r.i > 0 ? r.i : ''}</td><td class="n">${r.i < 0 ? -r.i : ''}</td></tr>`).join('')}</tbody></table></div></details></div>`).join('');
    const TL = M.flatMap(x => [{ name: teamName(x.h), vp: x.vh, d: x.ih - x.ia, n: x.n, mp: x.mh }, { name: teamName(x.a), vp: x.va, d: x.ia - x.ih, n: x.n, mp: x.ma }]).sort((a, b) => b.vp - a.vp || b.d - a.d);
    const tab = M.length < 2 ? '' : `<h3>${T('Standings')}</h3><div class="ttwrap"><table class="ttab sbtab"><thead><tr><th class="n">#</th><th>${T('Team')}</th><th class="n">${T('Boards')}</th><th class="n">IMP</th><th class="n">MP %</th><th class="n">VP</th></tr></thead><tbody>${TL.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b></td><td data-l="${T('Boards')}" class="n">${r.n}</td><td data-l="IMP" class="n">${signed(r.d)}</td><td data-l="MP %" class="n">${r.mp ?? '—'}</td><td data-l="VP" class="n">${r.vp}</td></tr>`).join('')}</tbody></table></div>`;
    return cards + tab + `<div class="row2"><button class="btn sbwa" id="sbWa">${ICON_WA} ${T('Send on WhatsApp')}</button></div>
      <div class="muted">${T('Each board counts when both rooms have entered it: the difference of the two North-South scores in IMPs. VPs on the WBF scale (20 to share).')} ${T('MP: a board won by the score is 100 %, an equal score 50 %.')}</div>`;
  }
  function oneRankHtml() {
    const { Q } = oneStand(); if (!Q.length) return `<div class="muted">${T('No scores yet.')}</div>`;
    const tab = (L, h) => `<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th class="n">#</th><th>${h}</th><th class="n">${T('Boards')}</th><th class="n">IMP</th></tr></thead><tbody>${L.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b></td><td data-l="${T('Boards')}" class="n">${r.n}</td><td data-l="IMP" class="n"><b>${signed(r.imp)}</b></td></tr>`).join('')}</tbody></table></div>`;
    return `${tab(Q, T('Pair'))}<div class="row2"><button class="btn sbwa" id="sbWa">${ICON_WA} ${T('Send on WhatsApp')}</button></div>
      <div class="muted">${T('Each board: the score of the side with 21 or more points against the score expected of it (by its points and vulnerability), in IMPs; both partners get them. 38–40 points count as 37.')}</div>`;
  }
  function rankHtml() {
    if (isOne()) return oneRankHtml();
    if (isTeam()) return teamRankHtml();
    const L = standings();
    if (!L.length) return `<div class="muted">${T('No scores yet.')}</div>`;
    const rows = L.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b><small>${T('Table {0}', r.t)} · ${r.dir === 'ns' ? SEAT_AB[0] + SEAT_AB[2] : SEAT_AB[1] + SEAT_AB[3]}</small></td><td data-l="${T('Boards')}" class="n">${r.n}</td><td data-l="MP %" class="n">${r.pct ?? '—'}</td><td data-l="IMP" class="n">${signed(r.imp)}</td></tr>`).join('');
    return `<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th class="n">#</th><th>${T('Pair')}</th><th class="n">${T('Boards')}</th><th class="n">MP %</th><th class="n">IMP</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row2"><button class="btn sbwa" id="sbWa">${ICON_WA} ${T('Send on WhatsApp')}</button></div>
      <div class="muted">${T('MP %: the average over the boards played; IMP: the total, each board against the other tables (cross-IMPs, averaged). A board played at only one table does not count yet.')}</div>`;
  }
  // the standings as a plain message (as on the screen: MP % and IMP)
  function standingsText() {
    if (isOne()) {
      const m = sb.g.m, { Q } = oneStand();
      return [`🪑 ${m.n} — ${new Date(m.ts).toLocaleDateString()}`, ...Q.map((r, i) => `${i + 1}. ${r.name} ${r.imp > 0 ? '+' : ''}${r.imp} IMP (${T('{0} boards', r.n)})`)].join('\n');
    }
    if (isTeam()) {
      const m = sb.g.m;
      return [`🃏 ${m.n} — ${new Date(m.ts).toLocaleDateString()}\n${T('{0} boards', m.bd)} · ${done() ? T('Finished') : T('Running')}`,
        ...matches().map(x => `${teamName(x.h)} ${x.ih} – ${x.ia} ${teamName(x.a)} (VP ${x.vh} – ${x.va} · MP ${x.mh ?? '—'}% – ${x.ma ?? '—'}%, ${T('{0} boards', x.n)})`)].join('\n');
    }
    const m = sb.g.m, L = standings(), dir = r => r.dir === 'ns' ? SEAT_AB[0] + SEAT_AB[2] : SEAT_AB[1] + SEAT_AB[3];
    const head = `🃏 ${m.n} — ${new Date(m.ts).toLocaleDateString()}\n${T('{0} tables', m.tb)} · ${T('{0} boards', m.bd)} · ${done() ? T('Finished') : T('Running')}\n${T('Standings')} (MP % · IMP):`;
    const rows = L.map((r, i) => `${i + 1}. ${r.name} (${T('Table {0}', r.t)} ${dir(r)}) — ${r.pct != null ? r.pct + '%' : '—'} · ${r.imp > 0 ? '+' : ''}${r.imp} IMP · ${T('{0} boards', r.n)}`);
    return [head, ...rows].join('\n');
  }
  // the players get only Bridge Table's address: the game is under Open tables, and Table No opens it (no code needed)
  const appLink = () => location.origin + location.pathname.replace(/index\.html$/, '');
  const linkText = () => `🃏 ${sb.g.m.n}\n${appLink()}`;
  const sendBtns = t => `<span class="sbsend"><button class="btn mini-btn sbwa" data-sbsend="wa:${t}" title="WhatsApp">${ICON_WA}</button><button class="btn mini-btn sbsms" data-sbsend="sms:${t}" title="SMS">${ICON_SMS}</button></span>`;
  // a table's players: a member number typed into a box becomes the member's name
  // the players at the table, drawn as the table; or the box for one seat
  function compassHtml(t) {
    if (!sb.seats || sb.seats.t !== t) sb.seats = { t, n: '', s: '', e: '', w: '' };
    const st = sb.seats;
    if (sb.seatK) return `<div class="sbc-edit"><div class="sbc-head">${T('Table {0}', t)} · <b>${SEAT[SEATK[sb.seatK]]}</b></div>
      <input id="sbSeatIn" class="sbc-input" maxlength="40" autocomplete="off" placeholder="${T('Member number or name')}" value="${esc(st[sb.seatK] || '')}">
      <div id="sbSeatFound" class="sbc-found"></div>
      <div class="row2"><button class="btn" id="sbSeatCancel">✕ ${T('Cancel')}</button><button class="btn new" id="sbSeatOk">✓ OK</button></div></div>`;
    const seat = k => `<button class="sbc-pos sbc-${k}" data-sbseat="${k}"><small>${SEAT[SEATK[k]]}</small><b>${st[k] ? esc(st[k]) : '＋'}</b></button>`;
    return `<div class="grp"><span>${T('Players')}</span><div class="sbc-table">${seat('n')}${seat('w')}<div class="sbc-mid">${T('Table {0}', t)}</div>${seat('e')}${seat('s')}</div>
      <div class="row2"><button class="btn new" id="sbSeatsGo">${T('Continue')} →</button></div></div>`;
  }
  // a member number in the seat's box: the name under it at once, or ❓ (then a name is typed)
  let seatLookT = 0;
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'sbSeatIn') return;
    clearTimeout(seatLookT);
    seatLookT = setTimeout(async () => {
      const inp = $('sbSeatIn'), out = $('sbSeatFound'); if (!inp || !out) return;
      const v = inp.value.trim(); if (!/^\d{1,8}$/.test(v)) { out.textContent = ''; return; }
      const n = await memberName(v); if (inp.value.trim() !== v) return;
      out.textContent = n ? '👤 ' + n : '❓ ' + v; out.className = 'sbc-found ' + (n ? 'ok' : 'no');
    }, 250);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'sbSeatIn') $('sbSeatOk')?.click(); });
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'sbHcp' || !sb.form) return;
    const v = e.target.value.trim(), h = /^\d{1,2}$/.test(v) ? +v : null; sb.form.h = validH(h) ? h : null;
    const b = $('sbSave'); if (b) b.disabled = !(e.target.dataset.okb && sb.form.h != null) || sb.busy;
  });
  async function seatOk() {
    const inp = $('sbSeatIn'); if (!inp || !sb.seats || !sb.seatK) return;
    let v = inp.value.trim();
    if (/^\d{1,8}$/.test(v)) { const n = await memberName(v); if (!n) { const out = $('sbSeatFound'); if (out) { out.textContent = '❓ ' + v; out.className = 'sbc-found no'; } return; } v = n; }
    sb.seats[sb.seatK] = v.slice(0, 20); sb.seatK = null; show();
  }
  async function seatsGo() {
    const st = sb.seats; if (!st) return;
    await signIn();
    // a seat left empty gets its direction (North …), so the table goes on to its boards
    const p = {}; for (const k of ['n', 's', 'e', 'w']) p[k] = (st[k] || SEAT[SEATK[k]]).slice(0, 20);
    try { await C().put('sb/' + sb.id + '/t/' + st.t, p); (sb.g.t = sb.g.t || {})[st.t] = p; sb.seats = null; sb.err = ''; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    show();
  }
  function namesForm(t) {
    const p = (sb.g.t || {})[t] || {};
    return `<div class="tsetrow sbrow"><b>${T('Table {0}', t)}</b>${['n', 's', 'e', 'w'].map((k, j) => `<label><small>${SEAT[[0, 2, 1, 3][j]]}</small><input class="tok" maxlength="20" data-sbtn="${k}" data-member value="${esc(p[k] || '')}"></label>`).join('')}<button class="btn new" id="sbTSave">${T('Save')}</button></div>`;
  }
  function tablesHtml() {
    const g = sb.g, mt = myTable(), canEdit = t => !done() && (t === mt || canManage(g.m));
    return [...Array(g.m.tb).keys()].map(i => {
      const t = i + 1, p = (g.t || {})[t] || {}, played = Object.values(g.r || {}).filter(R => R[t]).length;
      if (sb.editT === t) return namesForm(t);
      return `<div class="sbtrow"><b>${T('Table {0}', t)}${isTeam() ? `<small>${roomName(t)}</small>` : ''}</b><span>${SEAT_AB[0] + SEAT_AB[2]}: ${esc(pairName(t, 'ns'))}<br>${SEAT_AB[1] + SEAT_AB[3]}: ${esc(pairName(t, 'ew'))}</span><small>${T('{0} boards', played)}</small>${canEdit(t) ? `<button class="btn mini-btn" data-sbedit="${t}">✎</button>` : ''}</div>`;
    }).join('');
  }

  /* ---- actions ---- */
  async function create() {
    readSetup(); const s = sb.setup; if (sb.busy) return;
    if (!C().on) { sb.err = T('Could not reach the server. Check the internet connection.'); return show(); }
    sb.busy = true; sb.err = ''; show();
    try {
      const uid = await C().uid(), id = newCode(), ts = Date.now();
      const type = s.one ? 'one' : 'team', tm = s.one ? [] : [...Array(s.tb).keys()].map(i => s.tm[i] || T('Team {0}', i + 1));
      const m = { n: s.n || T(s.one ? 'Single table' : 'Team match'), ts, tb: s.tb, bd: s.bd, st: 'open', by: uid, byn: myName(), bk: myKey(), type, tm };
      const up = { ['sb/' + id + '/m']: m, ['sbi/' + id]: { n: m.n, ts, tb: m.tb, bd: m.bd, st: 'open', by: uid, byn: m.byn, bk: m.bk, type, tm } };
      for (let t = 1; t <= s.tb; t++) { const p = s.names[t] || {}; up['sb/' + id + '/t/' + t] = { n: p.n || '', s: p.s || '', e: p.e || '', w: p.w || '' }; }
      await C().patch('', up);
      sb.setup = null; sb.busy = false; await loadGame(id); sb.view = s.one ? 'boards' : 'tables'; sb.board = 0; if (s.one) setMyTable(1); show(); poll();
    } catch (e) { sb.busy = false; sb.err = T('Could not save. Check the internet connection and try again.'); show(); }
  }
  async function openGame(id) {
    sb.err = '';
    try { if (!(await loadGame(id))) { sb.err = T('No game with this code.'); return show(); } }
    catch (e) { sb.err = T('Could not reach the server. Check the internet connection.'); return show(); }
    if (isOne() && !myTable() && !done()) setMyTable(1);   // the single table: everyone sits at it
    sb.view = canManage(sb.g.m) && !done() && !isOne() ? 'tables' : 'boards'; sb.board = 0; sb.form = null; sb.editT = 0; setLast(done() ? '' : id); show(); poll();
  }
  async function save() {
    const b = sb.board, mt = myTable(), f = sb.form; if (!b || !mt || !f || sb.busy) return;
    const t = sb.formT || mt;
    const r = f.l ? { l: f.l, s: f.s, x: f.x || 0, d: f.d, k: f.k, ld: SUITS[f.ls] + RANKS[f.lr] } : { l: 0, s: 0, x: 0, d: 0, k: 0 };
    r.sc = nsScore(b, r); r.ts = Date.now();
    if (isOne()) { if (!validH(f.h)) return; r.h = f.h; const p = (sb.g.t || {})[1] || {}; r.p = { n: p.n || '', s: p.s || '', e: p.e || '', w: p.w || '' }; }   // the points, and who sat where
    if (sb.formT) r.ok = true;   // the administrator's correction needs no confirmation
    sb.busy = true; show();
    if (sb.formT) await signIn();   // a correction: the organiser is known by name
    try { await C().put('sb/' + sb.id + '/r/' + b + '/' + t, r); ((sb.g.r = sb.g.r || {})[b] = sb.g.r[b] || {})[t] = r; sb.form = null; sb.formT = 0; sb.err = ''; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    sb.busy = false; try { await loadGame(sb.id); } catch (e) {} show();
  }
  // the other pair has checked the score at the table
  async function confirmScore() {
    const b = sb.board, mt = myTable(); if (!b || !mt || sb.busy) return;
    sb.busy = true;
    try { await C().put('sb/' + sb.id + '/r/' + b + '/' + mt + '/ok', true); sb.g.r[b][mt].ok = true; sb.err = ''; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    sb.busy = false; try { await loadGame(sb.id); } catch (e) {} show();
  }
  // the organiser (only) opens a finished game again, e.g. after finishing it by mistake
  // the database knows the organiser by the name signed in on this device
  async function signIn() { const n = myName(); if (n) try { await C().session(n, SET.pinH); } catch (e) {} }
  async function reopen() {
    await signIn();
    try { await C().put('sb/' + sb.id + '/m/st', 'open'); await C().put('sbi/' + sb.id + '/st', 'open'); sb.g.m.st = 'open'; setLast(sb.id); sb.err = ''; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    show();
  }
  async function finish() {
    await signIn();
    try { await C().put('sb/' + sb.id + '/m/st', 'done'); await C().put('sbi/' + sb.id + '/st', 'done'); sb.g.m.st = 'done'; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    show();
  }
  async function del(id) {
    await signIn();
    try { await C().patch('', { ['sb/' + id]: null, ['sbi/' + id]: null }); }
    catch (e) { sb.err = T('Could not delete.'); }
    if (sb.id === id) { sb.id = null; sb.g = null; }
    await loadList(); openOv('sb', listHtml());
  }
  async function saveTable() {
    await signIn();
    const t = sb.editT, p = {};
    for (const i of document.querySelectorAll('[data-sbtn]')) { let v = i.value.trim(); if (/^\d{1,8}$/.test(v)) v = (await memberName(v)) || v; p[i.dataset.sbtn] = v.slice(0, 20); }
    try { await C().put('sb/' + sb.id + '/t/' + t, { n: p.n || '', s: p.s || '', e: p.e || '', w: p.w || '' }); (sb.g.t = sb.g.t || {})[t] = p; sb.editT = 0; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    show();
  }

  /* running games are listed with the open tables on the home page (the list is fetched at most once a minute) */
  // the games running now, under Open tables: Social bridge games (sbi) and club tournaments in BridgeGate (gate/live)
  const lob = { L: null, G: null, ts: 0, busy: false, html: '' };
  const running24 = g => g && g.st !== 'done' && Date.now() - g.ts < 24 * 3600e3;
  async function loadLobby() {
    const [L, G] = await Promise.all([C().get('sbi').catch(() => null), C().get('gate/live').catch(() => null)]);
    lob.L = Object.entries(L || {}).map(([id, v]) => ({ id, ...v })).filter(running24).sort((a, b) => b.ts - a.ts);
    lob.G = Object.entries(G || {}).map(([club, v]) => ({ club, ...v })).filter(g => running24(g) && /^\d{2}$/.test(g.p || ''));
  }
  function lobbyHtml() {
    if (!lob.busy && Date.now() - lob.ts > 60e3 && C() && C().on) {
      lob.busy = true;
      loadLobby().then(() => { const h = rowsHtml(); if (h !== lob.html) { lob.html = h; if (typeof render === 'function') render(); } })
        .catch(() => {}).finally(() => { lob.busy = false; lob.ts = Date.now(); });
    }
    return lob.html = rowsHtml();
  }
  // the games running now, each with Join
  const rowsHtml = () => (lob.G || []).map((g, i) => `<div class="otour"><div><b>🏛 ${esc(g.c || '')}${g.n ? ' — ' + esc(g.n) : ''}</b><small>BridgeGate · ${T('{0} tables', g.tb)} · ${T('Running')}</small></div><div class="otb"><button class="btn new" data-bgjoin="${i}">${T('Join')}</button></div></div>`).join('')
    + (lob.L || []).map(g => `<div class="otour"><div><b>🃏 ${esc(g.n)}</b><small>${T('Team match')} · ${T('{0} tables', g.tb)} · ${T('{0} boards', g.bd)} · ${T('Running')}</small></div><div class="otb"><button class="btn new" data-sbjoin="${g.id}">${T('Join')}</button></div></div>`).join('');

  document.addEventListener('click', e => {
    if (e.target.closest('#sbOpen')) return open();
    const sj = e.target.closest('[data-sbjoin]'); if (sj) { sb.entry = false; return openLink(sj.dataset.sbjoin, 0); }
    const bj = e.target.closest('[data-bgjoin]'); if (bj && lob.G && lob.G[+bj.dataset.bgjoin]) { const g = lob.G[+bj.dataset.bgjoin]; location.href = 'bridgegate/?club=' + encodeURIComponent(g.club) + '&role=table&p=' + g.p; return; }
    const go = e.target.closest('[data-sbgo]'); if (go) { sb.setup = null; openOv('sb', `<div class="muted">${T('Loading…')}</div>`); return openGame(go.dataset.sbgo); }
    if (ui.overlay !== 'sb') return;
    const el = e.target.closest('button'); if (!el) return;
    const d = el.dataset, id = el.id;
    const sg = el.closest('[data-sbseg]');
    if (sg) {
      const k = sg.dataset.sbseg, v = el.dataset.v;
      if (k === 'tb' || k === 'bd') { readSetup(); sb.setup[k] = +v; }
      else if (k === 'me') { setMyTable(+v); sb.form = null; }
      else if (k === 'rq') { sb.reqT = +v; }
      else if (sb.form) { sb.form[k] = +v; if (k === 'l') { if (+v === 0) { sb.form.s = sb.form.d = sb.form.k = null; } else if (sb.form.k == null || sb.form.k < 0) sb.form.k = null; } }
      return show();
    }
    if (id === 'sbOne') { sb.setup = { one: true, n: T('Single table') + ' ' + new Date().toLocaleDateString(), tb: 1, bd: 8, names: {}, tm: [] }; sb.err = ''; return show(); }
    if (id === 'sbNew') { sb.setup = { n: T('Team match') + ' ' + new Date().toLocaleDateString(), tb: 2, bd: 16, names: {}, tm: [] }; sb.err = ''; return show(); }
    if (id === 'sbBack') { sb.setup = null; return show(); }
    if (id === 'sbCreate') return create();
    if (d.sbopen) return openGame(d.sbopen);
    if (d.sbsend) { const [how, t] = d.sbsend.split(':'), txt = encodeURIComponent(linkText()); if (how === 'wa') window.open('https://wa.me/?text=' + txt, '_blank', 'noopener'); else location.href = 'sms:?&body=' + txt; return; }
    if (d.sbdel) { const g = (sb.list || []).find(x => x.id === d.sbdel), name = g ? g.n : sb.g && sb.g.m.n; askYes(T('Delete the game “{0}” and all its scores?', name || d.sbdel), () => { openOv('sb', `<div class="muted">${T('Loading…')}</div>`); del(d.sbdel); }); return; }
    if (d.sbent) { const [gid, t] = d.sbent.split(':'); sb.entry = false; return openLink(gid, +t); }   // that table: the organiser sits, a player asks for a seat there
    if (d.sbrqs) return sendReq(d.sbrqs);
    if (id === 'sbReqX') return dropReq();
    if (id === 'sbSeating') { sb.view = 'tables'; sb.editT = 1; show(); return; }
    if (d.sbacc || d.sbrej) { const v = d.sbacc || d.sbrej, i = v.indexOf(':'); return answerReq(+v.slice(0, i), v.slice(i + 1), !!d.sbacc); }
    if (d.sbmng) { sb.entry = false; return openGame(d.sbmng); }
    if (id === 'sbList') { sb.entry = false; setLast(''); sb.id = null; sb.g = null; show(); loadList().then(() => { if (ui.overlay === 'sb' && !sb.id) show(); }); return; }
    if (d.sbview) { sb.view = d.sbview; sb.editT = 0; return show(); }
    if (d.sbboard) { sb.board = +d.sbboard; sb.form = null; sb.formT = 0; return show(); }
    if (id === 'sbBoards') { sb.board = 0; sb.form = null; sb.formT = 0; return show(); }
    if (id === 'sbSave') return save();
    if (id === 'sbFix') { const R = sb.g.r[sb.board][myTable()]; sb.form = { ...R }; delete sb.form.ok; if (!R.l) sb.form.l = 0; return show(); }
    if (d.sbadm) { const R = sb.g.r[sb.board][d.sbadm]; sb.formT = +d.sbadm; sb.form = { ...R }; if (!R.l) sb.form.l = 0; return show(); }
    if (id === 'sbCancel') { sb.form = null; sb.formT = 0; return show(); }
    if (id === 'sbOk') return confirmScore();
    if (id === 'sbReopen') { askYes(T('Open the game again? Scores can be entered again.'), () => { openOv('sb', gameHtml()); reopen(); }); return; }
    if (id === 'sbEnd') { askYes(T('Finish the game? Scores can no longer be entered.'), () => { openOv('sb', gameHtml()); finish(); }); return; }
    if (d.sbedit) { sb.editT = +d.sbedit; return show(); }
    if (id === 'sbTSave') return saveTable();
    if (d.sbseat) { sb.seatK = d.sbseat; show(); setTimeout(() => $('sbSeatIn')?.focus(), 80); return; }
    if (id === 'sbSeatOk') return seatOk();
    if (id === 'sbSeatCancel') { sb.seatK = null; return show(); }
    if (id === 'sbSeatsGo') return seatsGo();
    if (id === 'sbChangeT') {   // this player moves to another table (a player's accepted seat is given up: they ask again)
      const q = !canManage(sb.g.m) && myReq(); if (q) { delete sb.g.t[q.t].q[q.k]; C().put('sb/' + sb.id + '/t/' + q.t + '/q/' + q.k, null).catch(() => {}); }
      setMyTable(0); sb.seats = null; sb.seatK = null; sb.board = 0; sb.form = null; sb.reqT = 0; return show();
    }
    if (id === 'sbWa') { window.open('https://wa.me/?text=' + encodeURIComponent(standingsText()), '_blank', 'noopener'); return; }
  });

  // a table's link (#sb=CODE&t=N): this device sits at that table of that game
  async function openLink(id, t) {
    sb.setup = null; sb.reqT = t || 0; openOv('sb', `<div class="muted">${T('Loading…')}</div>`);
    await openGame(id);
    if (t && sb.g && canManage(sb.g.m)) { setMyTable(t); sb.reqT = 0; show(); }   // the organiser sits at once
  }
  return { open, openLink, lobbyHtml, locked, vpOf };
})();
