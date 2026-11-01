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
  // the table this player sits at (in a moving game: in the round of board b, or of the board open, or now)
  const myTable = b => { try { if (sb.g && moving(sb.g.m)) return tableOfMe(roundOf(b || sb.board) || curRound()); return +localStorage.getItem(myTableKey(sb.id)) || 0; } catch (e) { return 0; } };
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
  // the moving games: a team round robin (every team meets every other, one match a round, two tables a match) and a
  // Howell pairs game (every pair meets every other); all the tables of a round play the same boards (round r: boards
  // (r-1)·bpr+1 … r·bpr). The players move, so a player is a pair or a team's pair, and the table follows each round
  const isRR = m => ((m || (sb.g && sb.g.m) || {}).fmt) === 'rr';
  const isHow = m => (m || (sb.g && sb.g.m) || {}).type === 'howell';
  const moving = m => isRR(m) || isHow(m);
  // the circle method: each round's meetings of n sides (an odd number: one sits out each round)
  function rounds(n) {
    const N = n % 2 ? n + 1 : n, a = [...Array(N).keys()].map(i => i + 1), out = [];
    for (let r = 0; r < N - 1; r++) { const L = []; for (let i = 0; i < N / 2; i++) { const x = a[i], y = a[N - 1 - i]; if (x <= n && y <= n) L.push([x, y]); } out.push(L); a.splice(1, 0, a.pop()); }
    return out;
  }
  const sidesOf = m => isHow(m) ? m.np : m.nt;
  const roundOf = (b, m) => b ? Math.ceil(b / ((m || sb.g.m).bpr || 1)) : 0;
  const roundBoards = (r, m) => { const p = (m || sb.g.m).bpr; return [...Array(p).keys()].map(i => (r - 1) * p + i + 1); };
  // who sits at table t in round r: the North-South and East-West pair (Howell, changing direction from round to
  // round) or team (round robin: table 2k-1 the Open room, the first team North-South; 2k the Closed room)
  function seatsAt(r, t, m) {
    m = m || sb.g.m; const L = rounds(sidesOf(m))[r - 1] || [];
    if (isHow(m)) { const x = L[t - 1]; if (!x) return null; return (r + t) % 2 ? { ns: x[1], ew: x[0] } : { ns: x[0], ew: x[1] }; }
    const x = L[Math.ceil(t / 2) - 1]; if (!x) return null; return t % 2 ? { ns: x[0], ew: x[1] } : { ns: x[1], ew: x[0] };
  }
  const pairLabel = (p, m) => (((m || sb.g.m).pn || [])[p - 1]) || T('Pair {0}', p);
  // who this player is in a moving game: a pair ("p3") or a team's North-South or East-West pair ("t2.1", "t2.2")
  const meKey = id => 'bridge-sb-me-' + id + ':' + (localStorage.getItem('bridge-table-name') || '').toLowerCase();
  const myMe = () => { try { return localStorage.getItem(meKey(sb.id)) || ''; } catch (e) { return ''; } };
  const setMe = v => { try { if (v) localStorage.setItem(meKey(sb.id), v); else localStorage.removeItem(meKey(sb.id)); } catch (e) {} };
  function tableOfMe(r) {
    const me = myMe(), m = sb.g && sb.g.m; if (!me || !m || !r) return 0;
    for (let t = 1; t <= m.tb; t++) {
      const x = seatsAt(r, t); if (!x) continue;
      if (isHow(m) && (x.ns === +me.slice(1) || x.ew === +me.slice(1))) return t;
      if (isRR(m)) { const [tm, pr] = me.slice(1).split('.').map(Number); if ((pr === 1 ? x.ns : x.ew) === tm) return t; }
    }
    return 0;
  }
  // the round this player is in now: the first one their table has not finished
  function curRound() {
    const m = sb.g.m, R = Math.ceil(m.bd / m.bpr);
    for (let r = 1; r <= R; r++) { const t = tableOfMe(r); if (t && roundBoards(r).some(b => !(((sb.g.r || {})[b] || {})[t] || {}).ok)) return r; }
    return R;
  }
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
  // each match: the IMPs of both teams over the boards both rooms have confirmed, and the VPs (a round robin: every
  // round's matches, on that round's boards)
  function matches() {
    const g = sb.g, L = [];
    if (isRR()) {
      const R = Math.ceil(g.m.bd / g.m.bpr);
      for (let r = 1; r <= R; r++) for (let k = 1; 2 * k <= g.m.tb; k++) { const x = seatsAt(r, 2 * k - 1); if (x) L.push(matchOf(2 * k - 1, 2 * k, roundBoards(r), x.ns, x.ew, k, r)); }
      return L;
    }
    for (let k = 1; 2 * k <= g.m.tb; k++) L.push(matchOf(2 * k - 1, 2 * k, [...Array(g.m.bd).keys()].map(i => i + 1), 2 * k - 1, 2 * k, k, 0));
    return L;
  }
  function matchOf(o, c, boards, h, a, k, rd) {
    const g = sb.g; {
      const rows = []; let ih = 0, ia = 0, bh = 0;
      for (const b of boards) {
        const R = (g.r || {})[b] || {}, ro = R[o] && R[o].ok ? R[o] : null, rc = R[c] && R[c].ok ? R[c] : null;
        const d = ro && rc ? nsScore(b, ro) - nsScore(b, rc) : null, i = d == null ? null : E.imps(d); if (i > 0) ih += i; else if (i < 0) ia -= i;
        if (d != null) bh += d > 0 ? 1 : d === 0 ? 0.5 : 0;   // matchpoints: the board won by the score
        if (ro || rc) rows.push({ b, o: ro && nsScore(b, ro), c: rc && nsScore(b, rc), i });
      }
      const vh = vpOf(ih - ia, boards.length), n = rows.filter(r => r.i != null).length, mh = n ? Math.round(bh / n * 1000) / 10 : null;
      return { k, rd, h, a, ih, ia, n, rows, vh, va: Math.round((20 - vh) * 100) / 100, mh, ma: mh == null ? null : Math.round((100 - mh) * 10) / 10 };
    }
  }

  // the game's federation: NBF (Norway, gate/members) or TBF (Turkey, gate/membersTbf)
  const FED_KEY = 'bridge-sb-fed';
  const curFed = () => (sb.setup && sb.setup.fed) || (sb.g && sb.g.m && sb.g.m.fed) || 'nbf';
  const fedPath = () => curFed() === 'tbf' ? 'gate/membersTbf' : 'gate/members';
  // the one offered first: this device's last choice, the language, the player's country, then NBF
  async function fedDefault() {
    try { const f = localStorage.getItem(FED_KEY); if (f === 'nbf' || f === 'tbf') return f; } catch (e) {}
    if (SET.lang === 'tr') return 'tbf'; if (SET.lang === 'no') return 'nbf';
    let c = SET.ctry || ''; if (!c) try { c = (await Net.country()) || ''; } catch (e) {}
    return c === 'TR' ? 'tbf' : 'nbf';
  }
  // a member number → the member's name, from the game's federation list
  const members = {};
  async function memberName(num) {
    const k = fedPath() + '/' + num;
    if (k in members) return members[k];
    try { const v = await C().get(k); members[k] = typeof v === 'string' ? v : null; } catch (e) { return null; }
    return members[k];
  }
  // a name or surname → the members it fits (the whole list is fetched once per federation); letters without Turkish marks too
  const allMembers = {};
  const fold = s => String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  async function memberSearch(q) {
    const words = fold(q).split(/\s+/).filter(Boolean); if (!words.length) return [];
    const p = fedPath();
    if (!allMembers[p]) { try { const v = await C().get(p); allMembers[p] = Object.entries(v || {}).filter(([, n]) => typeof n === 'string').map(([num, n]) => [num, n, fold(n)]); } catch (e) { return []; } }
    const seen = new Set(), out = [];
    for (const [num, n, f] of allMembers[p]) { const parts = f.split(/[\s-]+/); if (!words.every(w => parts.some(x => x.startsWith(w)))) continue; const key = num.replace(/^0+/, '') + '|' + f; if (seen.has(key)) continue; seen.add(key); out.push({ num, name: n }); if (out.length >= 8) break; }
    return out;
  }
  // a name box (data-member): letters typed offer the members they fit, under the box
  let memberLookT = 0;
  document.addEventListener('input', e => {
    const el = e.target; if (!el || !el.matches || !el.matches('#ov input[data-member]')) return;
    clearTimeout(memberLookT);
    memberLookT = setTimeout(async () => {
      const v = el.value.trim(); let dl = document.getElementById('sbMembers');
      if (!dl) { dl = document.createElement('datalist'); dl.id = 'sbMembers'; document.body.appendChild(dl); }
      el.setAttribute('list', 'sbMembers');
      if (v.length < 2 || /^\d+$/.test(v)) { dl.innerHTML = ''; return; }
      const L = await memberSearch(v); if (el.value.trim() !== v) return;
      dl.innerHTML = L.map(m => `<option value="${esc(m.name.slice(0, 20))}" label="${esc(m.num)}"></option>`).join('');
    }, 250);
  });
  document.addEventListener('change', async e => {
    const el = e.target; if (!el || !el.matches || !el.matches('#ov input[data-member]')) return;
    const v = el.value.trim(); if (!/^\d{1,8}$/.test(v)) return;
    const n = await memberName(v); if (n && el.value.trim() === v) el.value = n.slice(0, 20);
  });

  /* ---- scores ---- */
  // the North-South score of one result
  function nsScore(b, r) {
    if (r && r.m) return r.sc || 0;   // the single table: the score as it was typed
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
  // a Howell game: each pair's matchpoints and IMPs over the boards it played, at whatever table
  function howStand() {
    const m = sb.g.m, P = {};
    for (let p = 1; p <= m.np; p++) P[p] = { p, name: pairLabel(p), n: 0, mp: 0, mpN: 0, imp: 0 };
    for (const b in (sb.g.r || {})) {
      const c = boardCmp(b), r = roundOf(+b);
      for (const t in c) { const x = seatsAt(r, +t); if (!x) continue;
        for (const dir of ['ns', 'ew']) { const q = P[x[dir]]; if (!q) continue; q.n++; if (c[t].cmp) { q.mp += dir === 'ns' ? c[t].cmp.mp : 100 - c[t].cmp.mp; q.mpN++; q.imp += dir === 'ns' ? c[t].cmp.imp : -c[t].cmp.imp; } } }
    }
    const L = Object.values(P).filter(q => q.n);
    L.forEach(q => { q.pct = q.mpN ? Math.round(q.mp / q.mpN * 10) / 10 : null; q.imp = Math.round(q.imp * 10) / 10; });
    return L.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.imp - a.imp);
  }
  function pairName(t, dir, b) {
    if (moving()) { const x = seatsAt(roundOf(b || sb.board) || curRound(), t); if (!x) return '—'; return isHow() ? pairLabel(x[dir]) : teamName(x[dir]); }
    const p = ((sb.g.t || {})[t]) || {}, a = dir === 'ns' ? [p.n, p.s] : [p.e, p.w];
    const s = a.filter(Boolean).join(' – ');
    if (isTeam()) { const pl = a.filter(x => x && !SEAT.includes(x)).join(' – '); return teamName(dir === 'ns' ? t : partnerT(t)) + (pl ? ' (' + pl + ')' : ''); }
    return s || T('Table {0}', t) + ' ' + (dir === 'ns' ? SEAT_AB[0] + SEAT_AB[2] : SEAT_AB[1] + SEAT_AB[3]);
  }
  // the declarer (at the single table: the side, N-S or E-W)
  const declTxt = d => isOne() ? (E.sideOf(d) ? SEAT_AB[1] + SEAT_AB[3] : SEAT_AB[0] + SEAT_AB[2]) : SEAT_AB[d];
  const conTxt = r => r.m ? (r.pa ? T('Passed out') : `${declTxt(r.d)} ${signed(E.sideOf(r.d) ? -(r.sc || 0) : (r.sc || 0))}`) : !r.l ? T('Passed out') : `${r.l}${sym(r.s)}${r.x === 1 ? 'X' : r.x === 2 ? 'XX' : ''} ${declTxt(r.d)}`;
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
  const seen = g => !g.test;
  const tests = () => isAdm() ? (sb.list || []).filter(g => g.test).sort((a, b) => b.ts - a.ts) : [];
  // the super admin's Test column: his test games and a new one (every kind: matches, round robin, Howell, single table)
  const testHtml = () => !isAdm() ? '' : `<div class="grp sbtest"><span>🧪 ${T('Test')}</span><div class="muted">${T('Only you see it: the players have names from the TBF list and the robots play the other tables by themselves.')}</div>
    ${tests().map(g => `<div class="sbtrow"><b>${esc(g.n)}</b><small>${fmtDate(g.ts)} · ${g.st === 'done' ? T('Finished') : T('Running')}</small><button class="btn new mini-btn" data-sbopen="${g.id}">${T('Open')}</button><button class="btn tdel mini-btn" data-sbdel="${g.id}">✕</button></div>`).join('')}
    <div class="row2"><button class="btn gold" id="sbNewTest">🧪 ${T('New test game')}</button><button class="btn" id="sbOneTest">🧪 🪑 ${T('Single table')}</button>${tests().length ? `<button class="btn tdel" id="sbDelTests">🗑 ${T('Delete all test games')}</button>` : ''}</div></div>`;
  const runningGames = () => (sb.list || []).filter(g => seen(g) && g.st !== 'done' && Date.now() - g.ts < 24 * 3600e3);
  function entryHtml() {
    const R = runningGames();
    return `<h2>🃏 ${T('Team match')}</h2>` + R.map(g => `<div class="sbentry"><b>🃏 ${esc(g.n)}</b><small>${T('{0} tables', g.tb)} · ${T('{0} boards', g.bd)}</small>
      ${g.fmt === 'rr' || g.type === 'howell' ? `<div class="row2"><button class="btn new" data-sbent="${g.id}:0">▶ ${T('Open')}</button></div>` : `<div class="grp"><span>${T('Table No')}</span><div class="bm3-keys k4 sbpick">${[...Array(g.tb).keys()].map(i => `<button class="bm3-key" data-sbent="${g.id}:${i + 1}">${i + 1}</button>`).join('')}</div></div>${legend(g)}`}
      ${canManage(g) ? `<button class="btn gold sbadmin" data-sbmng="${g.id}">⚙️ ${T('Admin')}</button>` : ''}</div>`).join('')
      + `<div class="row2"><button class="btn gold" id="sbNew">🃏 ${T('Team match')}</button><button class="btn new" id="sbOne">🪑 ${T('Single table')}</button><button class="btn" id="sbList">${T('All games')}</button><button class="btn" id="oClose">${T('Close')}</button></div>` + testHtml();
  }
  // a team match: the tables of each match and who sits North-South there
  const legend = m => !isTeam(m) || isRR(m) ? '' : `<div class="tmleg">${[...Array(Math.floor(m.tb / 2)).keys()].map(i => { const a = teamName(2 * i + 1, m), b = teamName(2 * i + 2, m);
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
  const pending = () => { if (!sb.g || done() || sb.formT) return 0; for (const b in (sb.g.r || {})) { const mt = myTable(+b); if (!mt) continue; const r = sb.g.r[b][mt]; if (r && !r.ok) return +b; } return 0; };
  const locked = () => ui.overlay === 'sb' && !!sb.id && !sb.setup && !!pending();
  function show() {
    if (sb.id && !sb.setup && sb.g && !moving(sb.g.m) && !myTable() && !canManage(sb.g.m)) { const q = myReq(); if (q && q.st === 'ok') { setMyTable(q.t); sb.reqT = 0; } }
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
    const rows = (sb.list || []).filter(seen).map(g => `<tr><td><b>🃏 ${esc(g.n)}</b><small>${fmtDate(g.ts)}${g.byn ? ' · ' + esc(g.byn) : ''}</small></td>
      <td data-l="${T('Tables')}" class="n">${g.tb}${isTeam(g) ? `<small>${T('{0} teams', g.tb)}</small>` : ''}</td><td data-l="${T('Boards')}" class="n">${g.bd}</td>
      <td data-l="${T('Status')}">${g.st === 'done' ? `<span class="tst">${T('Finished')}</span>` : `<span class="tst run">${T('Running')}</span>`}</td>
      <td class="tact"><button class="btn new" data-sbopen="${g.id}">${T('Open')}</button>${canManage(g) ? `<button class="btn tdel" data-sbdel="${g.id}" title="${T('Delete')}">✕</button>` : ''}</td></tr>`).join('');
    return `<h2>🃏 ${T('Team match')}</h2>
      <div class="muted">${T('Teams meet two by two with real cards: one pair of each team in the Open room, the other in the Closed room, on the same boards. The app compares the rooms in IMPs and gives the match its VPs. Anyone at a table enters the boards that table played, in any order.')} ${T('A round robin of teams or a Howell pairs game can be chosen too.')}</div>
      <div class="row2"><button class="btn gold" id="sbNew">🃏 ${T('Team match')}</button><button class="btn new" id="sbOne">🪑 ${T('Single table')}</button></div>
      ${testHtml()}
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      ${sb.list == null ? `<div class="muted">${T('Loading…')}</div>` : rows ? `<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th>${T('Game')}</th><th class="n">${T('Tables')}</th><th class="n">${T('Boards')}</th><th>${T('Status')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="muted">${T('No games yet.')}</div>`}
      <div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`;
  }
  const seg = (name, opts, cur) => `<div class="seg" data-sbseg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  // whose member list the players' numbers and names come from
  const fedSeg = s => `<div class="grp"><span>${T('Member numbers')}</span>${seg('fed', [['nbf', '🇳🇴 NBF'], ['tbf', '🇹🇷 TBF']], s.fed || 'nbf')}</div>`;
  function setupHtml() {
    const s = sb.setup;
    if (s.one) { const p = s.names[1] || {};
      return `<h2>${s.test ? '🧪 ' : ''}🪑 ${T('Single table')}</h2>
      <div class="muted">${T('Four players, real cards. Each board is entered with its contract and North-South’s points: the side with 21 or more points is expected the score of the table, and the difference is counted in IMPs for both partners.')}</div>
      <div class="grp"><span>${T('Name')}</span><input class="tok wide" id="sbName" maxlength="40" value="${esc(s.n)}"></div>
      <div class="grp"><span>${T('Players')}</span><div class="tsetrow sbrow">${['n', 's', 'e', 'w'].map(k => `<label><small>${SEAT[SEATK[k]]}</small><input class="tok" maxlength="20" data-sbpl="${k}" data-member placeholder="${SEAT[SEATK[k]]}" value="${esc(p[k] || '')}"></label>`).join('')}</div><div class="muted">${T('Not required: the directions are used.')}</div></div>
      <div class="grp"><span>${T('Boards')}</span>${seg('bd', [8, 12, 16, 20, 24, 28, 32].map(n => [n, n]), s.bd)}</div>
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      <div class="row2"><button class="btn new" id="sbCreate"${sb.busy ? ' disabled' : ''}>${T('Start the game')}</button><button class="btn" id="sbBack">${T('Back')}</button></div>`; }
    const fmt = s.fmt || 'team', R = fmt === 'rr' ? rounds(s.nt).length : fmt === 'howell' ? rounds(s.np).length : 0;
    const bprs = [2, 3, 4, 5, 6, 7, 8, 10, 12].filter(n => R * n <= 36);
    const test = '';
    const head = `<h2>${s.test ? '🧪 ' + T('Test game') : '🃏 ' + T('New game')}</h2>
      <div class="grp"><span>${T('Name')}</span><input class="tok wide" id="sbName" maxlength="40" value="${esc(s.n)}"></div>
      <div class="grp"><span>${T('How it is played')}</span>${seg('fmt', [['team', T('Matches')], ['rr', T('Round robin')], ['howell', T('Howell pairs')]], fmt)}</div>`;
    const foot = `${fedSeg(s)}${test}
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      <div class="row2"><button class="btn new" id="sbCreate"${sb.busy ? ' disabled' : ''}>${T('Start the game')}</button><button class="btn" id="sbBack">${T('Back')}</button></div>`;
    if (fmt === 'rr') return head + `<div class="muted">${T('Every team meets every other team, one match a round: the first team North-South in the Open room, the second in the Closed room; the rounds are added up in VPs.')}</div>
      <div class="grp"><span>${T('Teams')}</span>${seg('nt', [3, 4, 5, 6, 8, 10, 12].map(n => [n, n]), s.nt)}</div>
      <div class="grp"><span>${T('Team names')}</span><div class="tmnames">${[...Array(s.nt).keys()].map(i => `<input class="tok" maxlength="20" data-sbteam="${i}" placeholder="${T('Team {0}', i + 1)}" value="${esc(s.tm[i] || '')}">`).join('')}</div></div>
      <div class="grp"><span>${T('Boards per round')}</span>${seg('bpr', bprs.map(n => [n, n]), s.bpr)}</div>
      <div class="muted">${T('{0} rounds · {1} boards · {2} tables', R, R * s.bpr, 2 * Math.floor(s.nt / 2))}</div>` + foot;
    if (fmt === 'howell') return head + `<div class="muted">${T('Every pair meets every other pair: the pairs move from table to table, all the tables of a round play the same boards; matchpoints and IMPs against the other tables.')}</div>
      <div class="grp"><span>${T('Pairs')}</span>${seg('np', [4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map(n => [n, n]), s.np)}</div>
      <div class="grp"><span>${T('Pair names')}</span><div class="tmnames">${[...Array(s.np).keys()].map(i => `<input class="tok" maxlength="40" data-sbpair="${i}" placeholder="${T('Pair {0}', i + 1)}" value="${esc(s.pn[i] || '')}">`).join('')}</div><div class="muted">${T('Not required: Pair 1, Pair 2… are used.')}</div></div>
      <div class="grp"><span>${T('Boards per round')}</span>${seg('bpr', bprs.map(n => [n, n]), s.bpr)}</div>
      <div class="muted">${T('{0} rounds · {1} boards · {2} tables', R, R * s.bpr, Math.floor(s.np / 2))}</div>` + foot;
    return head + `
      <div class="grp"><span>${T('Teams')}</span>${seg('tb', [2, 4, 6, 8, 10, 12].map(n => [n, n]), s.tb)}</div>
      <div class="grp"><span>${T('Team names')}</span><div class="tmnames">${[...Array(s.tb / 2).keys()].map(i => `<div class="tmpair"><small>${T('Match {0}', i + 1)}</small><input class="tok" maxlength="20" data-sbteam="${2 * i}" placeholder="${T('Team {0}', 2 * i + 1)}" value="${esc(s.tm[2 * i] || '')}"><span>–</span><input class="tok" maxlength="20" data-sbteam="${2 * i + 1}" placeholder="${T('Team {0}', 2 * i + 2)}" value="${esc(s.tm[2 * i + 1] || '')}"></div>`).join('')}</div></div>
      <div class="muted">${T('{0} tables: in each match the first team sits North-South in the Open room, the second in the Closed room.', s.tb)}</div>
      <div class="grp"><span>${T('Boards')}</span>${seg('bd', [8, 12, 16, 20, 24, 28, 32, 36].map(n => [n, n]), s.bd)}</div>` + foot;
  }
  // boards per round: the most the database takes (36 boards in all) for this many rounds
  function fitBpr(s) { const R = s.fmt === 'rr' ? rounds(s.nt).length : s.fmt === 'howell' ? rounds(s.np).length : 0; if (R) while (s.bpr > 2 && R * s.bpr > 36) s.bpr--; }
  function readSetup() {
    const s = sb.setup; if (!s) return;
    const n = $('sbName'); if (n) s.n = n.value.trim().slice(0, 40);
    for (const i of document.querySelectorAll('[data-sbteam]')) s.tm[+i.dataset.sbteam] = i.value.trim().slice(0, 20);
    for (const i of document.querySelectorAll('[data-sbpair]')) (s.pn = s.pn || [])[+i.dataset.sbpair] = i.value.trim().slice(0, 40);
    for (const i of document.querySelectorAll('[data-sbpl]')) (s.names[1] = s.names[1] || {})[i.dataset.sbpl] = i.value.trim().slice(0, 20);
  }
  function gameHtml() {
    const g = sb.g, m = g.m, mt = myTable();
    const tabs = `<div class="seg ttabs">${[['boards', T('Board list')], ['rank', T('Standings')], ...(isOne() ? [] : [['tables', T('Tables')]])].map(([v, l]) => `<button data-sbview="${v}" class="${sb.view === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    // the organiser sends the players one link; a player chooses the table on a screen of its own
    const links = done() || !canManage(m) || isOne() ? '' : `<div class="grp sblinks"><div class="muted">📲 ${T('Send the players the link: they open Bridge Table, tap Table No and choose their table.')}</div><div class="sblk"><span class="sblt all"><b>${T('The game’s link, for everyone')}</b>${sendBtns(0)}</span></div></div>`;
    let body = '';
    const pickTable = !moving() && !mt && !done() && !canManage(m), pickMe = moving() && !myMe() && !done() && !sb.board;
    const orgPick = !moving() && !mt && !done() && canManage(m) && !sb.board ? `<div class="grp"><span>${T('My table')}</span><div class="muted">${T('Playing too? Choose your table to enter its scores.')}</div><div class="bm3-keys k4 sbpick" data-sbseg="me">${[...Array(m.tb).keys()].map(i => `<button data-v="${i + 1}" class="bm3-key">${i + 1}</button>`).join('')}</div>${legend(m)}</div>` : '';
    if (pickTable) body = reqHtml();
    else if (pickMe && !canManage(m)) body = meHtml();
    else if (sb.board) body = boardHtml(sb.board);
    else if (sb.view === 'rank') body = rankHtml();
    else if (sb.view === 'tables') body = tablesHtml();
    else body = boardsHtml();
    // a player sees only the game (full screen, no title lines); the organiser keeps the game's details
    return `${canManage(m) ? '' : `<div class="sbbar"><span class="td">🃏</span><div class="ev"><b>${esc(m.n)}</b>${mt ? (moving() ? T('Round {0}', roundOf(sb.board) || curRound()) + ' · ' : '') + T('Table {0}', mt) + (isTeam() ? ' · ' + roomName(mt) : '') : T('Team match')}</div></div>`}${canManage(m) ? `<h2>${isOne() ? '🪑' : '🃏'} ${esc(m.n)}</h2>
      <div class="muted">${m.test ? '🧪 ' + T('Test game: only you see it') + ' · ' : ''}${isOne() ? T('Single table') : isHow() ? T('Howell') + ' · ' + T('{0} pairs', m.np) : isRR() ? T('Round robin') + ' · ' + T('{0} teams', m.nt) : isTeam() ? T('{0} teams', m.tb) : T('{0} tables', m.tb)} · ${T('{0} boards', m.bd)} · ${done() ? T('Finished') : T('Running')}${m.byn ? ' · 👤 ' + esc(m.byn) : ''}</div>` : ''}
      ${sb.board || !canManage(m) || done() ? '' : reqListHtml()}${sb.board || m.test ? '' : links}${orgPick}${pickMe && canManage(m) ? meHtml() : ''}${m.test && canManage(m) && !done() && !sb.board ? `<div class="muted">🧪 ${(moving(m) ? myMe() : myTable()) ? T('The robots play the other tables by themselves.') : T('Choose your table: then the robots play the other tables by themselves.')}</div>` : ''}${mt && !done() && !pending() && !sb.board && !isOne() ? `<div class="sbchg"><span class="sbtno">${moving() ? `<small>${T('Round {0}', curRound())}</small> ` : ''}${T('Table {0}', mt)}${isTeam() ? ` <small>${roomName(mt)}</small>` : ''}</span><button class="btn gold" id="sbChangeT">🔄 ${T('Change table')}</button></div>` : ''}${sb.board || pickTable ? '' : tabs}${body}
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
      const b = i + 1, R = (g.r || {})[b] || {}, n = Object.keys(R).length, t = moving() ? myTable(b) : mt, me = t && R[t];
      return `${moving() && (b - 1) % g.m.bpr === 0 ? `<div class="sbround">${T('Round {0}', roundOf(b))}${myTable(b) ? ' · ' + T('Table {0}', myTable(b)) : ''}</div>` : ''}<button class="sbb${me ? ' me' : ''}${n ? ' some' : ''}" data-sbboard="${b}"><b>${b}</b><small>${me ? (me.ok ? '✓ ' : '⏳ ') : ''}${isOne() ? oneTile(b, me) : n ? T('{0} tables', n) : '—'}</small></button>`;
    }).join('');
    return `<div class="muted">${done() ? T('Tap a board to see what was played.') : mt || (moving() && myMe()) ? T('Tap a board your table played to enter its score.') : canManage(g.m) ? T('Tap a board to see what was played.') : T('First choose your table above.')}</div><div class="sbgrid">${cells}</div>`;
  }
  function boardHtml(b) {
    const g = sb.g, mt = myTable(), R = (g.r || {})[b] || {}, ts = Object.keys(R).sort((x, y) => x - y);
    const vul = [E.vulOf(b, 0), E.vulOf(b, 1)], vt = vul[0] && vul[1] ? T('All vulnerable') : vul[0] ? T('{0} vulnerable', SEAT_AB[0] + SEAT_AB[2]) : vul[1] ? T('{0} vulnerable', SEAT_AB[1] + SEAT_AB[3]) : T('None vulnerable');
    const head = `<h3>${T('Board {0}', b)} <small class="muted">${T('Dealer')}: ${SEAT[E.dealerOf(b)]} · ${vt}</small></h3>`;
    const mine = mt && R[mt], others = ts.filter(t => +t !== mt).length;
    if (sb.form || (!done() && mt && !mine)) return formHtml(b) + (others && !sb.formT ? `<div class="muted">${T('{0} tables have played this board. You will see their results after entering yours.', others)}</div>` : '');
    if (!done() && !mt && !canManage(g.m)) return head + `<div class="muted">${T('First choose your table above.')}</div>`;
    if (!done() && mine && !mine.ok) return head + `<div class="sbform"><div class="muted">${T('Table {0}', mt)}: ${esc(pairName(mt, 'ns', b))} — ${esc(pairName(mt, 'ew', b))}</div>
      <div class="sbprev"><b>${conTxt(mine)} ${resTxt(mine)} · ${scoreTxt(b, mine)}</b></div>
      <div class="sbwait">⏳ ${T('The other pair checks the score and confirms it.')}</div>
      <div class="row2"><button class="btn new" id="sbOk">✓ ${T('We confirm')}</button><button class="btn" id="sbFix">✎ ${T('Correct')}</button></div>
      ${others ? `<div class="muted">${T('Results of the other tables appear after the confirmation.')}</div>` : ''}</div>`;
    const c = boardCmp(b), wait = ts.filter(t => !R[t].ok).length;
    const tm = isTeam() || isOne();
    const rows = ts.map(t => { const r = R[t], x = c[t] || { ns: nsScore(b, r), cmp: null }; return `<tr class="${+t === mt ? 'me' : ''}"><td data-l="${T('Table')}" class="n">${t}${isTeam() ? `<small>${roomName(+t)}</small>` : ''}</td><td data-l="${T('Pairs')}"><small>${esc(pairName(t, 'ns', b))}<br>${esc(pairName(t, 'ew', b))}</small></td>
      <td data-l="${T('Contract')}"><b>${conTxt(r)}</b> ${resTxt(r)}${r.ld ? ` <small>· ${leadHtml(r.ld)}</small>` : ''}${isOne() ? oneLine(b, r) : ''}</td><td data-l="${SEAT_AB[0] + SEAT_AB[2]}" class="n">${x.ns > 0 ? x.ns : ''}</td><td data-l="${SEAT_AB[1] + SEAT_AB[3]}" class="n">${x.ns < 0 ? -x.ns : ''}</td>
      ${tm ? '' : `<td data-l="MP %" class="n">${!r.ok ? '⏳' : x.cmp ? x.cmp.mp : '—'}</td>`}<td data-l="IMP" class="n">${x.cmp ? signed(x.cmp.imp) : '—'}</td>${canManage(g.m) ? `<td class="tact"><button class="btn mini-btn" data-sbadm="${t}" title="${T('Correct')}">✎</button></td>` : ''}</tr>`; }).join('');
    return head + `<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th class="n">${T('Table')}</th><th>${T('Pairs')}</th><th>${T('Contract')}</th><th class="n">${SEAT_AB[0] + SEAT_AB[2]}</th><th class="n">${SEAT_AB[1] + SEAT_AB[3]}</th>${tm ? '' : '<th class="n">MP %</th>'}<th class="n">IMP</th>${canManage(g.m) ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="muted">${isOne() ? T('IMP from North-South’s side: the score against the score expected of the side with 21 or more points.') : tm ? T('IMP from North-South’s side, against the other room of the same match.') : T('MP % and IMP from North-South’s side, against the other tables.')}${wait ? ' ⏳ ' + T('{0} tables waiting for confirmation', wait) : ''} ${T('Only the organiser or the administrator can change a confirmed score.')}</div>`;
  }
  // a board's tile at the single table: the IMPs and to which side
  const oneTile = (b, r) => { const o = r && r.ok && oneOf(b, r); return !o ? (r ? '' : '—') : o.imp === 0 ? '0 IMP' : `${o.imp > 0 ? SEAT_AB[0] + SEAT_AB[2] : SEAT_AB[1] + SEAT_AB[3]} +${Math.abs(o.imp)}`; };
  const oneLine = (b, r) => { const o = oneOf(b, r); return o ? `<small>${T('N-S {0} points', r.h)} · ${o.side == null ? T('20–20: nothing expected') : T('{0} expected {1}', o.side ? SEAT_AB[1] + SEAT_AB[3] : SEAT_AB[0] + SEAT_AB[2], o.exp)}</small>` : ''; };
  const scoreTxt = (b, r) => { const ns = nsScore(b, r), ew = r.l && E.sideOf(r.d) === 1; return `${ew ? SEAT_AB[1] + SEAT_AB[3] : SEAT_AB[0] + SEAT_AB[2]} ${signed(ew ? -ns : ns)}`; };
  // the single table's form: the side that scored and its points, North-South's points
  const oneOk = f => !!f && validH(f.h) && (f.od === 2 || ((f.od === 0 || f.od === 1) && Number.isInteger(f.score) && f.score >= 10 && f.score <= 7600));
  function oneFormHtml(b) {
    const mt = sb.formT || myTable(), R = (sb.g.r || {})[b] || {}, old = R[mt];
    if (!sb.form) {   // a board entered before: its side and score (a contract kept before: worked out)
      // the side that scored (N-S, E-W; passed out) and its points
      const ns = old ? nsScore(b, old) : 0, od = !old ? null : (old.m ? old.pa : !old.l) || !ns ? 2 : ns > 0 ? 0 : 1;
      sb.form = { od, score: old && od !== 2 ? Math.abs(ns) : null, h: old ? old.h : null };
    }
    const f = sb.form, ok = oneOk(f);
    const vul = [E.vulOf(b, 0), E.vulOf(b, 1)], vc = vul[0] && vul[1] ? 'both' : vul[0] ? 'ns' : vul[1] ? 'ew' : 'none';
    const vt = vul[0] && vul[1] ? T('All vulnerable') : vul[0] ? T('{0} vulnerable', SEAT_AB[0] + SEAT_AB[2]) : vul[1] ? T('{0} vulnerable', SEAT_AB[1] + SEAT_AB[3]) : T('None vulnerable');
    const keys = (name, cls, opts, cur) => `<div class="bm3-keys ${cls}" data-sbseg="${name}">${opts.map(([v, l, c]) => `<button data-v="${v}" class="bm3-key ${c || ''}${String(cur) === String(v) ? ' active' : ''}">${l}</button>`).join('')}</div>`;
    const side = f.od === 0 || f.od === 1;
    return `<div class="bm3"><div class="bm3-screen">
      <div class="bm3-head"><div class="bm3-board"><small>${T('Board')}</small><b>${b}</b><span class="bm3-vul ${vc}">${vt}</span></div>${old ? `<div class="bm3-edit">✎</div>` : ''}</div>
      <div class="bm3-step">${T('Who scored')}</div>
      ${keys('od', 'k3', [[0, SEAT_AB[0] + SEAT_AB[2]], [1, SEAT_AB[1] + SEAT_AB[3]], [2, T('Pass'), 'pass']], f.od)}
      ${side ? `<div class="bm3-step">${T('Score')}</div>
      <input class="bm3-hcp" id="sbScore" type="number" inputmode="numeric" min="10" max="7600" step="10" value="${f.score ?? ''}" placeholder="${T('e.g. 420')}">` : ''}
      ${f.od != null ? `<div class="bm3-step">${T('North-South’s points (0–40)')}</div><input class="bm3-hcp" id="sbHcp" type="number" inputmode="numeric" min="0" max="40" value="${f.h ?? ''}" placeholder="${T('High-card points')}">` : ''}
      <div class="bm3-actions"${old ? '' : ' style="grid-template-columns:1fr"'}>${old ? `<button class="bm3-cancel" id="sbCancel">✕ ${T('Cancel')}</button>` : ''}<button class="bm3-ok" id="sbSave"${ok && !sb.busy ? '' : ' disabled'}>✓ ${T('Save')}</button></div>
    </div></div>`;
  }
  function formHtml(b) {
    if (isOne()) return oneFormHtml(b);
    const mt = sb.formT || myTable(), R = (sb.g.r || {})[b] || {};
    const f = sb.form || (sb.form = R[mt] ? { ...R[mt], ls: R[mt].ld ? SUITS.indexOf(R[mt].ld[0]) : null, lr: R[mt].ld ? RANKS.indexOf(R[mt].ld.slice(1)) : null } : { l: null, s: null, x: 0, d: null, k: null, ls: null, lr: null });
    const need = f.l ? f.l + 6 : 0;
    const res = f.l ? [...Array(14).keys()].map(k => [k, k - need === 0 ? '=' : signed(k - need)]) : [];
    const okb = f.l === 0 || (f.l && f.s != null && f.d != null && f.k != null), ok = okb && (!isOne() || validH(f.h));
    // the screen of a Bridgemate III: the contract and the N-S score on the display, then one row of large keys per step
    const ns = ok ? (f.l ? nsScore(b, f) : 0) : null;
    const contract = f.l === 0 ? T('Pass') : f.l ? `${f.l}${f.s != null ? sym(f.s) : ''}${f.x === 1 ? ' X' : f.x === 2 ? ' XX' : ''}${f.d != null ? ' ' + declTxt(f.d) : ''}` : '—';
    const vul = [E.vulOf(b, 0), E.vulOf(b, 1)], vc = vul[0] && vul[1] ? 'both' : vul[0] ? 'ns' : vul[1] ? 'ew' : 'none';
    const vt = vul[0] && vul[1] ? T('All vulnerable') : vul[0] ? T('{0} vulnerable', SEAT_AB[0] + SEAT_AB[2]) : vul[1] ? T('{0} vulnerable', SEAT_AB[1] + SEAT_AB[3]) : T('None vulnerable');
    const keys = (name, cls, opts, cur) => `<div class="bm3-keys ${cls}" data-sbseg="${name}">${opts.map(([v, l, c]) => `<button data-v="${v}" class="bm3-key ${c || ''}${String(cur) === String(v) ? ' active' : ''}">${l}</button>`).join('')}</div>`;
    return `<div class="bm3"><div class="bm3-screen">
      ${isOne() ? '' : `<div class="bm3-bar"><span class="td">🃏</span><div class="ev"><b>${esc(sb.g.m.n)}</b>${moving() ? T('Round {0}', roundOf(b)) + ' · ' : ''}${T('Table {0}', mt)}${isTeam() ? ' · ' + roomName(mt) : ''} · ${T('Dealer')}: ${SEAT[E.dealerOf(b)]}</div></div>`}
      <div class="bm3-head">
        <div class="bm3-board"><small>${T('Board')}</small><b>${b}</b><span class="bm3-vul ${vc}">${vt}</span></div>
        ${R[mt] ? `<div class="bm3-edit">✎</div>` : ''}
        ${isOne() ? '' : `<div class="bm3-pairs"><div><i>${SEAT_AB[0] + SEAT_AB[2]}</i>${esc(pairName(mt, 'ns', b))}</div><div><i>${SEAT_AB[1] + SEAT_AB[3]}</i>${esc(pairName(mt, 'ew', b))}</div></div>`}
      </div>
      <div class="bm3-display">
        <div class="bm3-contract">${contract}</div>
        <div class="bm3-sub"><span>${T('Result')}: ${f.l && f.k != null ? resTxt(f) : '—'}</span></div>
        <div class="bm3-score"><small>${SEAT_AB[0] + SEAT_AB[2]}</small><b class="${ns > 0 ? 'pos' : ns < 0 ? 'neg' : ''}">${ns == null ? '—' : signed(ns)}</b></div>
      </div>
      <div class="bm3-step">${T('Contract')}</div>
      ${keys('l', 'k4', [...[1, 2, 3, 4, 5, 6, 7].map(n => [n, n]), [0, T('Pass'), 'pass']], f.l)}
      ${f.l ? `${keys('s', 'k5', [0, 1, 2, 3, 4].map(i => [i, i === 4 ? 'NT' : SUITS[i], 'suit' + (i === 1 || i === 2 ? ' red' : '')]), f.s)}
      ${keys('x', 'k3', [[0, '—'], [1, 'X', 'dbl'], [2, 'XX', 'dbl']], f.x)}
      <div class="bm3-step">${T('Declarer')}</div>
      ${isOne() ? keys('d', 'k2', [[0, SEAT_AB[0] + SEAT_AB[2]], [1, SEAT_AB[1] + SEAT_AB[3]]], f.d == null ? null : E.sideOf(f.d)) : keys('d', 'k4', [0, 1, 2, 3].map(s => [s, SEAT_AB[s]]), f.d)}` : ''}
      ${f.l && f.s != null && f.d != null ? `<div class="bm3-step">${T('Result')}</div>
      ${keys('k', 'k7', res.map(([k, l]) => [k, l, 'res ' + (k - need === 0 ? 'made' : k > need ? 'over' : 'down')]), f.k)}` : ''}
      ${isOne() && (f.l === 0 || f.k != null) ? `<div class="bm3-step">${T('North-South’s points (0–40)')}</div><input class="bm3-hcp" id="sbHcp" type="number" inputmode="numeric" min="0" max="40" value="${f.h ?? ''}" placeholder="${T('High-card points')}" data-okb="${okb ? 1 : ''}">` : ''}
      <div class="bm3-actions"${R[mt] ? '' : ' style="grid-template-columns:1fr"'}>${R[mt] ? `<button class="bm3-cancel" id="sbCancel">✕ ${T('Cancel')}</button>` : ''}<button class="bm3-ok" id="sbSave"${ok && !sb.busy ? '' : ' disabled'}>✓ ${T('Save')}</button></div>
    </div></div>`;
  }
  function teamRankHtml() {
    const M = matches();
    if (!M.some(x => x.rows.length)) return `<div class="muted">${T('No scores yet.')}</div>`;
    const cards = M.filter(x => x.rows.length).map(x => `<div class="teams"><div class="tmhead">${x.rd ? T('Round {0}', x.rd) + ' · ' : ''}${T('Match {0}', x.k)} · ${T('{0} boards', x.n)}</div><div class="tscore"><div><b>${esc(teamName(x.h))}</b><small>VP ${x.vh} · MP ${x.mh ?? '—'}%</small></div><div class="tsn">${x.ih} – ${x.ia}</div><div><b>${esc(teamName(x.a))}</b><small>VP ${x.va} · MP ${x.ma ?? '—'}%</small></div></div>
      <details class="tmbd"><summary>${T('Board by board')}</summary><div class="resscroll"><table class="res"><thead><tr><th>${T('Bd')}</th><th class="n">${T('Open room')}</th><th class="n">${T('Closed room')}</th><th class="n">${esc(teamName(x.h))}</th><th class="n">${esc(teamName(x.a))}</th></tr></thead><tbody>${x.rows.map(r => `<tr><td>${r.b}</td><td class="n">${r.o == null ? '…' : signed(r.o)}</td><td class="n">${r.c == null ? '…' : signed(r.c)}</td><td class="n">${r.i > 0 ? r.i : ''}</td><td class="n">${r.i < 0 ? -r.i : ''}</td></tr>`).join('')}</tbody></table></div></details></div>`).join('');
    // each team over its matches (a round robin: added up over the rounds; MP % over the boards)
    const TA = {}; for (const x of M) for (const [id, vp, d, mp] of [[x.h, x.vh, x.ih - x.ia, x.mh], [x.a, x.va, x.ia - x.ih, x.ma]]) { if (!x.n) continue; const q = TA[id] || (TA[id] = { name: teamName(id), vp: 0, d: 0, n: 0, mps: 0 }); q.vp += vp; q.d += d; q.n += x.n; q.mps += (mp || 0) * x.n; }
    const TL = Object.values(TA).map(q => ({ ...q, vp: Math.round(q.vp * 100) / 100, mp: q.n ? Math.round(q.mps / q.n * 10) / 10 : null })).sort((a, b) => b.vp - a.vp || b.d - a.d);
    const tab = M.length < 2 ? '' : `<h3>${T('Standings')}</h3><div class="ttwrap"><table class="ttab sbtab"><thead><tr><th class="n">#</th><th>${T('Team')}</th><th class="n">${T('Boards')}</th><th class="n">IMP</th><th class="n">MP %</th><th class="n">VP</th></tr></thead><tbody>${TL.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b></td><td data-l="${T('Boards')}" class="n">${r.n}</td><td data-l="IMP" class="n">${signed(r.d)}</td><td data-l="MP %" class="n">${r.mp ?? '—'}</td><td data-l="VP" class="n">${r.vp}</td></tr>`).join('')}</tbody></table></div>`;
    return cards + tab + `<div class="row2"><button class="btn sbwa" id="sbWa">${ICON_WA} ${T('Send on WhatsApp')}</button></div>
      <div class="muted">${T('Each board counts when both rooms have entered it: the difference of the two North-South scores in IMPs. VPs on the WBF scale (20 to share).')} ${T('MP: a board won by the score is 100 %, an equal score 50 %.')}</div>`;
  }
  function oneRankHtml() {
    // board by board: who sat North-South and East-West, the contract, North-South's points, the score, the IMPs of each side
    let tn = 0, te = 0;
    const rows = Object.keys(sb.g.r || {}).map(Number).sort((a, b) => a - b).map(b => { const r = (sb.g.r[b] || {})[1]; if (!r || !r.ok) return ''; const o = oneOf(b, r); if (!o) return ''; const p = seatsOf(r);
      if (o.imp > 0) tn += o.imp; else te -= o.imp;
      return `<tr><td>${b}</td><td><small>${esc(p.n)} – ${esc(p.s)}<br>${esc(p.e)} – ${esc(p.w)}</small></td><td><b>${conTxt(r)}</b> ${resTxt(r)}</td><td class="n">${r.h}</td><td class="n">${signed(nsScore(b, r))}</td><td class="n"><b>${o.imp > 0 ? o.imp : ''}</b></td><td class="n"><b>${o.imp < 0 ? -o.imp : ''}</b></td></tr>`; }).join('');
    // the next board not entered yet at this table
    let nx = 0; if (myTable() && !done()) for (let b = 1; b <= sb.g.m.bd; b++) if (!((sb.g.r || {})[b] || {})[1]) { nx = b; break; }
    const ns = SEAT_AB[0] + '/' + SEAT_AB[2], ew = SEAT_AB[1] + '/' + SEAT_AB[3];
    return `${nx ? `<div class="row2"><button class="btn new sbnext" data-sbboard="${nx}">▶ ${T('Next board')} (${nx})</button></div>` : ''}` + (rows ? `<div class="onebd"><div class="resscroll"><table class="res"><thead><tr><th>${T('Bd')}</th><th>${T('Pairs')}</th><th>${T('Contract')}</th><th class="n">${SEAT_AB[0] + SEAT_AB[2]} ${T('Points')}</th><th class="n">${T('Score')}</th><th class="n">${ns}</th><th class="n">${ew}</th></tr></thead><tbody>${rows}<tr class="onetot"><td colspan="5"><b>${T('Total')}</b></td><td class="n"><b>${tn}</b></td><td class="n"><b>${te}</b></td></tr></tbody></table></div></div>` : `<div class="muted">${T('No scores yet.')}</div>`);
  }
  function rankHtml() {
    if (isOne()) return oneRankHtml();
    if (isTeam()) return teamRankHtml();
    const L = isHow() ? howStand() : standings();
    if (!L.length) return `<div class="muted">${T('No scores yet.')}</div>`;
    const rows = L.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b>${isHow() ? '' : `<small>${T('Table {0}', r.t)} · ${r.dir === 'ns' ? SEAT_AB[0] + SEAT_AB[2] : SEAT_AB[1] + SEAT_AB[3]}</small>`}</td><td data-l="${T('Boards')}" class="n">${r.n}</td><td data-l="MP %" class="n">${r.pct ?? '—'}</td><td data-l="IMP" class="n">${signed(r.imp)}</td></tr>`).join('');
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
        ...matches().filter(x => x.n).map(x => `${x.rd ? T('Round {0}', x.rd) + ': ' : ''}${teamName(x.h)} ${x.ih} – ${x.ia} ${teamName(x.a)} (VP ${x.vh} – ${x.va} · MP ${x.mh ?? '—'}% – ${x.ma ?? '—'}%, ${T('{0} boards', x.n)})`)].join('\n');
    }
    const m = sb.g.m, L = isHow() ? howStand() : standings(), dir = r => isHow() ? '' : ' ' + (r.dir === 'ns' ? SEAT_AB[0] + SEAT_AB[2] : SEAT_AB[1] + SEAT_AB[3]);
    const head = `🃏 ${m.n} — ${new Date(m.ts).toLocaleDateString()}\n${T('{0} tables', m.tb)} · ${T('{0} boards', m.bd)} · ${done() ? T('Finished') : T('Running')}\n${T('Standings')} (MP % · IMP):`;
    const rows = L.map((r, i) => `${i + 1}. ${r.name}${isHow() ? '' : ` (${T('Table {0}', r.t)}${dir(r)})`} — ${r.pct != null ? r.pct + '%' : '—'} · ${r.imp > 0 ? '+' : ''}${r.imp} IMP · ${T('{0} boards', r.n)}`);
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
    if (!e.target || !sb.form || !['sbHcp', 'sbScore'].includes(e.target.id)) return;
    const v = e.target.value.trim();
    if (e.target.id === 'sbScore') sb.form.score = /^\d{1,4}$/.test(v) ? +v : null;
    else { const h = /^\d{1,2}$/.test(v) ? +v : null; sb.form.h = validH(h) ? h : null; }
    const b = $('sbSave'); if (b) b.disabled = !oneOk(sb.form) || sb.busy;
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
  function moveHtml() {
    const m = sb.g.m, R = Math.ceil(m.bd / m.bpr), cur = myMe() ? curRound() : 0;
    return [...Array(R).keys()].map(i => { const r = i + 1, bs = roundBoards(r);
      const rows = [...Array(m.tb).keys()].map(j => { const t = j + 1, x = seatsAt(r, t); if (!x) return '';
        const mine = t === tableOfMe(r);
        return `<div class="sbtrow${mine ? ' me' : ''}"><b>${T('Table {0}', t)}${isRR() ? `<small>${roomName(t)}</small>` : ''}</b><span>${SEAT_AB[0] + SEAT_AB[2]}: ${esc(isHow() ? pairLabel(x.ns) : teamName(x.ns))}<br>${SEAT_AB[1] + SEAT_AB[3]}: ${esc(isHow() ? pairLabel(x.ew) : teamName(x.ew))}</span></div>`; }).join('');
      const out = isHow() && m.np % 2 ? [...Array(m.np).keys()].map(p => p + 1).find(p => ![...Array(m.tb).keys()].some(j => { const x = seatsAt(r, j + 1); return x && (x.ns === p || x.ew === p); })) : null;
      const outT = isRR() && m.nt % 2 ? [...Array(m.nt).keys()].map(p => p + 1).find(p => ![...Array(m.tb).keys()].some(j => { const x = seatsAt(r, j + 1); return x && (x.ns === p || x.ew === p); })) : null;
      return `<details class="sbrd"${r === cur || (!cur && r === 1) ? ' open' : ''}><summary>${T('Round {0}', r)} · ${T('Boards {0}–{1}', bs[0], bs[bs.length - 1])}</summary>${rows}${out ? `<div class="muted">${T('Sits out: {0}', esc(pairLabel(out)))}</div>` : ''}${outT ? `<div class="muted">${T('Sits out: {0}', esc(teamName(outT)))}</div>` : ''}</details>`; }).join('');
  }
  // a player of a moving game says who they are (once): the app shows their table in every round
  function meHtml() {
    const m = sb.g.m;
    const opts = isHow() ? [...Array(m.np).keys()].map(i => ['p' + (i + 1), pairLabel(i + 1)])
      : [...Array(m.nt).keys()].flatMap(i => [['t' + (i + 1) + '.1', teamName(i + 1) + ' · ' + SEAT_AB[0] + SEAT_AB[2]], ['t' + (i + 1) + '.2', teamName(i + 1) + ' · ' + SEAT_AB[1] + SEAT_AB[3]]]);
    return `<div class="grp"><span>${isHow() ? T('My pair') : T('My team')}</span><div class="muted">${isHow() ? T('Choose your pair: the app shows your table in every round.') : T('Choose your team and your pair (North-South or East-West): the app shows your table in every round.')}</div><div class="sbme">${opts.map(([v, l]) => `<button class="btn" data-sbme="${v}">${esc(l)}</button>`).join('')}</div></div>`;
  }
  function tablesHtml() {
    if (moving()) return moveHtml();
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
      const fmt = s.one ? '' : s.fmt || 'team', test = !!(s.test && isAdm());
      let pool = []; if (test) { try { const v = await C().get('gate/membersTbf'); pool = Object.values(v || {}).filter(n => typeof n === 'string' && n.trim()).map(n => n.trim()); } catch (e) {} }
      const fake = i => pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0].slice(0, 20) : T('Test Player {0}', i);
      const type = s.one ? 'one' : fmt === 'howell' ? 'howell' : 'team', nt = fmt === 'rr' ? s.nt : s.tb;
      const tm = s.one || fmt === 'howell' ? [] : [...Array(nt).keys()].map(i => (test ? '' : s.tm[i]) || (test ? T('Test team {0}', i + 1) : T('Team {0}', i + 1)));
      const fed = s.fed === 'tbf' ? 'tbf' : 'nbf';
      const m = { n: (test ? '🧪 ' : '') + (s.n || T(s.one ? 'Single table' : 'Team match')), ts, tb: s.tb, bd: s.bd, st: 'open', by: uid, byn: myName(), bk: myKey(), type, tm, fed };
      if (fmt === 'rr') Object.assign(m, { fmt, nt: s.nt, bpr: s.bpr, tb: 2 * Math.floor(s.nt / 2), bd: rounds(s.nt).length * s.bpr });
      if (fmt === 'howell') Object.assign(m, { fmt, np: s.np, bpr: s.bpr, tb: Math.floor(s.np / 2), bd: rounds(s.np).length * s.bpr, pn: [...Array(s.np).keys()].map(i => test ? (fake(2 * i + 1) + ' – ' + fake(2 * i + 2)).slice(0, 40) : (s.pn[i] || '')) });
      if (test) m.test = 1;
      m.n = m.n.slice(0, 40);
      const up = { ['sb/' + id + '/m']: m, ['sbi/' + id]: { n: m.n, ts, tb: m.tb, bd: m.bd, st: 'open', by: uid, byn: m.byn, bk: m.bk, type, tm, fed, ...(m.fmt ? { fmt: m.fmt } : {}), ...(test ? { test: 1 } : {}) } };
      // a test game's tables: fake players (a moving game's players are its pairs and teams)
      for (let t = 1; t <= m.tb; t++) { const p = s.names[t] || {}, k = 4 * (t - 1); up['sb/' + id + '/t/' + t] = test && !m.fmt && (type === 'team' || type === 'one') ? { n: fake(k + 1), s: fake(k + 2), e: fake(k + 3), w: fake(k + 4) } : { n: p.n || '', s: p.s || '', e: p.e || '', w: p.w || '' }; }
      await C().patch('', up);
      sb.setup = null; sb.busy = false; await loadGame(id); sb.view = s.one || moving(m) ? 'boards' : 'tables'; sb.board = 0; if (s.one) setMyTable(1); show(); poll();
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
    if (isOne() && !oneOk(f)) return;
    const r = isOne() ? { l: 0, s: 0, x: 0, d: f.od === 1 ? 1 : 0, k: 0, m: 1, pa: f.od === 2 ? 1 : 0 } : f.l ? { l: f.l, s: f.s, x: f.x || 0, d: f.d, k: f.k } : { l: 0, s: 0, x: 0, d: 0, k: 0 };
    if (f.l && f.ls != null && f.ls >= 0 && f.lr != null && f.lr >= 0) r.ld = SUITS[f.ls] + RANKS[f.lr];   // an opening lead entered before (it is no longer asked)
    r.sc = isOne() ? (f.od === 2 ? 0 : (f.od === 1 ? -1 : 1) * f.score) : nsScore(b, r); r.ts = Date.now();
    if (isOne()) { if (!validH(f.h)) return; r.h = f.h; const p = (sb.g.t || {})[1] || {}; r.p = { n: p.n || '', s: p.s || '', e: p.e || '', w: p.w || '' }; }   // the points, and who sat where
    if (sb.formT) r.ok = true;   // the administrator's correction needs no confirmation
    sb.busy = true; show();
    if (sb.formT) await signIn();   // a correction: the organiser is known by name
    try { await C().put('sb/' + sb.id + '/r/' + b + '/' + t, r); ((sb.g.r = sb.g.r || {})[b] = sb.g.r[b] || {})[t] = r; sb.form = null; sb.formT = 0; sb.err = ''; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    sb.busy = false; try { await loadGame(sb.id); } catch (e) {} show();
  }
  /* a test game: each board's deal (the same at every table, from the game's code), bid by robots of a little more or
     less daring at each table, with the tricks double dummy give or take one: the other tables' scores, confirmed */
  function simRnd(key) { let h = 2166136261; for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function simDeal(b) { const r = simRnd(sb.id + ':deal:' + b), p = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return [0, 1, 2, 3].map(x => p.slice(13 * x, 13 * x + 13)); }
  function simResult(b, t, deal) {
    const r = simRnd(sb.id + ':' + b + ':' + t), agg = () => Math.floor(r() * 4) - 1;
    const cards = [0, 1].map(() => ({ conv: { ...E.sysOf('twoone').conv }, agg: agg(), sys: 'twoone' }));
    const auc = []; let s = E.dealerOf(b);
    const over = a => (a.length >= 4 && a.slice(-3).every(e => e.call === 'P') && a.some(e => e.call !== 'P')) || (a.length === 4 && a.every(e => e.call === 'P'));
    while (!over(auc) && auc.length < 60) { const x = E.aiBid(auc, s, deal[s], cards); auc.push({ seat: s, call: x.call, m: x.m }); s = (s + 1) % 4; }
    const bids = auc.filter(e => typeof e.call === 'number'); if (!bids.length) return { l: 0, s: 0, x: 0, d: 0, k: 0 };
    const last = bids[bids.length - 1], st = E.ST(last.call), side = E.sideOf(last.seat);
    const d = auc.find(e => typeof e.call === 'number' && E.ST(e.call) === st && E.sideOf(e.seat) === side).seat;
    let x = 0; for (let i = auc.indexOf(last) + 1; i < auc.length; i++) { if (auc[i].call === 'X') x = 1; if (auc[i].call === 'XX') x = 2; }
    let k = E.ddContract(deal, { level: E.LV(last.call), strain: st, decl: d, dbl: x }); if (k == null) k = E.LV(last.call) + 6;
    k = Math.max(0, Math.min(13, k + [-1, 0, 0, 0, 1][Math.floor(r() * 5)]));
    return { l: E.LV(last.call), s: st, x, d, k };
  }
  async function simTick() {
    const g = sb.g, m = g && g.m;
    if (ui.overlay !== 'sb' || !m || !m.test || !canManage(m) || done() || sb.busy || sb.simBusy) return;
    if (sb.board || (document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName))) return;   // not while a score is being entered
    sb.simBusy = true;
    try {
      if (!(moving(m) ? myMe() : myTable())) { sb.simBusy = false; return; }   // until I sit down, nobody plays
      const human = new Set(); for (const b in (g.r || {})) for (const t in g.r[b]) if (g.r[b][t] && !g.r[b][t].sim) human.add(+t);
      const up = {}, upto = moving(m) && myMe() ? curRound() : Infinity;
      for (let t = 1; t <= m.tb; t++) {
        for (let b = 1; b <= m.bd; b++) {
          if (moving(m) && roundOf(b) > upto) break;
          if (t === myTable(b) || (!moving(m) && human.has(t)) || (moving(m) && !seatsAt(roundOf(b), t)) || (((g.r || {})[b] || {})[t])) continue;
          if (isOne(m)) break;
          const r = simResult(b, t, simDeal(b)); r.sc = nsScore(b, r); r.ts = Date.now(); r.ok = true; r.sim = 1;
          up['sb/' + sb.id + '/r/' + b + '/' + t] = r; break;   // one board a table each time
        }
      }
      if (Object.keys(up).length) { await signIn(); await C().patch('', up); await loadGame(sb.id); if (!sb.board) show(); }
    } catch (e) {}
    sb.simBusy = false;
  }
  setInterval(simTick, 3000);
  async function simFill() {
    const g = sb.g, m = g.m; if (!m.test || sb.busy) return;
    sb.busy = true; let up = {}, n = 0;
    try {
      await signIn();
      for (let b = 1; b <= m.bd; b++) {
        const deal = simDeal(b), mine = myTable(b);
        for (let t = 1; t <= m.tb; t++) {
          if (t === mine || (((g.r || {})[b] || {})[t]) || (moving(m) && !seatsAt(roundOf(b), t))) continue;
          const r = simResult(b, t, deal); r.sc = nsScore(b, r); r.ts = Date.now(); r.ok = true; r.sim = 1;
          up['sb/' + sb.id + '/r/' + b + '/' + t] = r; n++;
        }
        sb.simMsg = T('Filling in… {0}/{1}', b, m.bd); show(); await new Promise(res => setTimeout(res, 0));
        if (Object.keys(up).length >= 60) { await C().patch('', up); up = {}; }
      }
      if (Object.keys(up).length) await C().patch('', up);
      sb.err = '';
    } catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    sb.busy = false; sb.simMsg = ''; try { await loadGame(sb.id); } catch (e) {} flash('🤖 ' + T('{0} scores entered', n), 2200); show();
  }
  // the other pair has checked the score at the table
  async function confirmScore() {
    const b = sb.board, mt = myTable(); if (!b || !mt || sb.busy) return;
    sb.busy = true;
    try { await C().put('sb/' + sb.id + '/r/' + b + '/' + mt + '/ok', true); sb.g.r[b][mt].ok = true; sb.err = ''; if (isOne()) { sb.board = 0; sb.view = 'rank'; } }   // the single table: on to the table of the boards
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

  document.addEventListener('click', e => {
    if (e.target.closest('#sbOpen')) return open();
    const go = e.target.closest('[data-sbgo]'); if (go) { sb.setup = null; openOv('sb', `<div class="muted">${T('Loading…')}</div>`); return openGame(go.dataset.sbgo); }
    if (ui.overlay !== 'sb') return;
    const el = e.target.closest('button'); if (!el) return;
    const d = el.dataset, id = el.id;
    const sg = el.closest('[data-sbseg]');
    if (sg) {
      const k = sg.dataset.sbseg, v = el.dataset.v;
      if (k === 'tb' || k === 'bd' || k === 'nt' || k === 'np' || k === 'bpr') { readSetup(); sb.setup[k] = +v; fitBpr(sb.setup); }
      else if (k === 'fmt') { readSetup(); sb.setup.fmt = v; fitBpr(sb.setup); }
      else if (k === 'test') { readSetup(); sb.setup.test = v === '1'; }
      else if (k === 'fed') { readSetup(); sb.setup.fed = v === 'tbf' ? 'tbf' : 'nbf'; try { localStorage.setItem(FED_KEY, sb.setup.fed); } catch (err) {} }
      else if (k === 'me') { setMyTable(+v); sb.form = null; }
      else if (k === 'rq') { sb.reqT = +v; }
      else if (sb.form) { sb.form[k] = +v; if (k === 'l') { if (+v === 0) { sb.form.s = sb.form.d = sb.form.k = null; } else if (sb.form.k == null || sb.form.k < 0) sb.form.k = null; } }
      return show();
    }
    if (id === 'sbDelTests') { const L = tests(); askYes(T('Delete all {0} test games?', L.length), async () => { await signIn(); const up = {}; for (const g of L) { up['sb/' + g.id] = null; up['sbi/' + g.id] = null; } try { await C().patch('', up); } catch (e) {} await loadList(); show(); }); return; }
    if (id === 'sbOneTest' || id === 'sbNewTest') { const one = id === 'sbOneTest'; sb.setup = one ? { one: true, test: true, n: T('Single table') + ' ' + new Date().toLocaleDateString(), tb: 1, bd: 8, names: {}, tm: [], fed: 'tbf' } : { test: true, n: T('Team match') + ' ' + new Date().toLocaleDateString(), tb: 2, bd: 16, names: {}, tm: [], fed: 'tbf', fmt: 'team', nt: 4, np: 8, bpr: 4, pn: [] }; sb.err = ''; return show(); }
    if (id === 'sbOne' || id === 'sbNew') {
      sb.setup = id === 'sbOne' ? { one: true, n: T('Single table') + ' ' + new Date().toLocaleDateString(), tb: 1, bd: 8, names: {}, tm: [], fed: 'nbf' } : { n: T('Team match') + ' ' + new Date().toLocaleDateString(), tb: 2, bd: 16, names: {}, tm: [], fed: 'nbf', fmt: 'team', nt: 4, np: 8, bpr: 4, pn: [] };
      const s0 = sb.setup; sb.err = ''; show();
      fedDefault().then(f => { if (sb.setup === s0 && f !== s0.fed) { readSetup(); s0.fed = f; show(); } });   // the federation offered first
      return;
    }
    if (id === 'sbBack') { sb.setup = null; return show(); }
    if (id === 'sbCreate') return create();
    if (d.sbopen) return openGame(d.sbopen);
    if (d.sbsend) { const [how, t] = d.sbsend.split(':'), txt = encodeURIComponent(linkText()); if (how === 'wa') window.open('https://wa.me/?text=' + txt, '_blank', 'noopener'); else location.href = 'sms:?&body=' + txt; return; }
    if (d.sbdel) { const g = (sb.list || []).find(x => x.id === d.sbdel), name = g ? g.n : sb.g && sb.g.m.n; askYes(T('Delete the game “{0}” and all its scores?', name || d.sbdel), () => { openOv('sb', `<div class="muted">${T('Loading…')}</div>`); del(d.sbdel); }); return; }
    if (d.sbent) { const [gid, t] = d.sbent.split(':'); sb.entry = false; return openLink(gid, +t); }   // that table: the organiser sits, a player asks for a seat there
    if (d.sbrqs) return sendReq(d.sbrqs);
    if (id === 'sbReqX') return dropReq();
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
      setMyTable(0); setMe(''); sb.seats = null; sb.seatK = null; sb.board = 0; sb.form = null; sb.reqT = 0; return show();
    }
    if (d.sbme) { setMe(d.sbme); sb.board = 0; sb.form = null; sb.view = 'boards'; return show(); }
    if (id === 'sbWa') { window.open('https://wa.me/?text=' + encodeURIComponent(standingsText()), '_blank', 'noopener'); return; }
  });

  // a table's link (#sb=CODE&t=N): this device sits at that table of that game
  async function openLink(id, t) {
    sb.setup = null; sb.reqT = t || 0; openOv('sb', `<div class="muted">${T('Loading…')}</div>`);
    await openGame(id);
    if (t && sb.g && canManage(sb.g.m)) { setMyTable(t); sb.reqT = 0; show(); }   // the organiser sits at once
  }
  return { open, openLink, locked, vpOf };
})();
