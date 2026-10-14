/* Bridge Table — social bridge: a game played with real cards at real tables (up to 12); the app only keeps the
   scores. Anyone at a table enters the result of a board that table played (contract, declarer, tricks); the boards
   are played in any order and need not all be played. A table sees what the other tables did on a board only after
   entering its own result there. Rankings by matchpoints and IMPs. Games are kept in the online database (sb/<code>,
   with a list in sbi/<code>) and can be opened later; the administrator can delete them. */
const SB = (() => {
  'use strict';
  const sb = { list: null, id: null, g: null, view: 'boards', board: 0, form: null, err: '', busy: false, timer: 0, setup: null, rank: 'mp' };
  const C = () => Net.Cloud;
  const myTableKey = id => 'bridge-sb-table-' + id;
  const myTable = () => { try { return +localStorage.getItem(myTableKey(sb.id)) || 0; } catch (e) { return 0; } };
  const setMyTable = t => { try { localStorage.setItem(myTableKey(sb.id), String(t)); } catch (e) {} };
  const SUITS = ['♣', '♦', '♥', '♠', 'NT'];
  const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
  const fmtDate = ts => new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const signed = v => (v > 0 ? '+' : '') + v;
  const sym = s => s === 4 ? 'NT' : `<span class="${s === 1 || s === 2 ? 'red' : ''}">${SUITS[s]}</span>`;
  const isAdm = () => Net.isAdmin && Net.isAdmin();
  const done = () => sb.g && sb.g.m && sb.g.m.st === 'done';

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
    return L.sort((a, b) => sb.rank === 'imp' ? b.imp - a.imp || (b.pct ?? -1) - (a.pct ?? -1) : (b.pct ?? -1) - (a.pct ?? -1) || b.imp - a.imp);
  }
  function pairName(t, dir) {
    const p = ((sb.g.t || {})[t]) || {}, a = dir === 'ns' ? [p.n, p.s] : [p.e, p.w];
    const s = a.filter(Boolean).join(' – ');
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
  const lastGame = () => { try { return localStorage.getItem(LAST) || ''; } catch (e) { return ''; } };
  const setLast = id => { try { if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST); } catch (e) {} };
  // the game this device was last entering scores in opens again at once (ready for the next board) while it is running
  async function open() {
    sb.id = null; sb.g = null; sb.setup = null; sb.err = '';
    const last = lastGame();
    if (last) { openOv('sb', `<div class="muted">${T('Loading…')}</div>`); try { if (await loadGame(last) && !done()) return openGame(last); } catch (e) {} sb.id = null; sb.g = null; setLast(''); }
    show(); await loadList(); if (ui.overlay === 'sb' && !sb.id && !sb.setup) show();
  }
  function show() {
    // a redraw of the same screen (a button tapped, a score saved) keeps the page where it was; a new screen starts at the top
    const key = sb.setup ? 'setup' : !sb.id ? 'list' : sb.id + ':' + sb.board + ':' + sb.view, old = document.querySelector('#ov .sheet');
    const top = ui.overlay === 'sb' && sb.key === key && old ? old.scrollTop : 0;
    sb.key = key;
    openOv('sb', sb.setup ? setupHtml() : !sb.id ? listHtml() : gameHtml());
    const s = document.querySelector('#ov .sheet'); if (s && top) s.scrollTop = top;
  }
  function listHtml() {
    const rows = (sb.list || []).map(g => `<tr><td><b>🃏 ${esc(g.n)}</b><small>${fmtDate(g.ts)}${g.byn ? ' · ' + esc(g.byn) : ''}</small></td>
      <td data-l="${T('Tables')}" class="n">${g.tb}</td><td data-l="${T('Boards')}" class="n">${g.bd}</td>
      <td data-l="${T('Status')}">${g.st === 'done' ? `<span class="tst">${T('Finished')}</span>` : `<span class="tst run">${T('Running')}</span>`}</td>
      <td class="tact"><button class="btn new" data-sbopen="${g.id}">${T('Open')}</button>${isAdm() ? `<button class="btn tdel" data-sbdel="${g.id}" title="${T('Delete')}">✕</button>` : ''}</td></tr>`).join('');
    return `<h2>🃏 ${T('Social bridge')}</h2>
      <div class="muted">${T('Played with real cards at real tables: the app keeps the scores. Anyone at a table enters the boards that table played, in any order.')}</div>
      <div class="row2"><button class="btn gold" id="sbNew">➕ ${T('New game')}</button></div>
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      ${sb.list == null ? `<div class="muted">${T('Loading…')}</div>` : rows ? `<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th>${T('Game')}</th><th class="n">${T('Tables')}</th><th class="n">${T('Boards')}</th><th>${T('Status')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="muted">${T('No games yet.')}</div>`}
      <div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`;
  }
  const seg = (name, opts, cur) => `<div class="seg" data-sbseg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  function setupHtml() {
    const s = sb.setup;
    const grid = [...Array(s.tb).keys()].map(i => `<div class="tsetrow sbrow"><b>${T('Table {0}', i + 1)}</b>${['n', 's', 'e', 'w'].map((k, j) => `<label><small>${SEAT[[0, 2, 1, 3][j]]}</small><input class="tok" maxlength="20" data-sbname="${i + 1}:${k}" value="${esc((s.names[i + 1] || {})[k] || '')}"></label>`).join('')}</div>`).join('');
    return `<h2>🃏 ${T('New game')}</h2>
      <div class="grp"><span>${T('Name')}</span><input class="tok wide" id="sbName" maxlength="40" value="${esc(s.n)}"></div>
      <div class="grp"><span>${T('Tables')}</span>${seg('tb', [...Array(12).keys()].map(i => [i + 1, i + 1]), s.tb)}</div>
      <div class="grp"><span>${T('Boards')}</span>${seg('bd', [8, 12, 16, 20, 24, 28, 32, 36].map(n => [n, n]), s.bd)}</div>
      <div class="grp"><span>${T('Players')}</span><div class="muted">${T('The players at each table (they stay at their table).')}</div>${grid}</div>
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      <div class="row2"><button class="btn new" id="sbCreate"${sb.busy ? ' disabled' : ''}>${T('Start the game')}</button><button class="btn" id="sbBack">${T('Back')}</button></div>`;
  }
  function readSetup() {
    const s = sb.setup; if (!s) return;
    const n = $('sbName'); if (n) s.n = n.value.trim().slice(0, 40);
    document.querySelectorAll('[data-sbname]').forEach(i => { const [t, k] = i.dataset.sbname.split(':'); (s.names[t] = s.names[t] || {})[k] = i.value.trim().slice(0, 20); });
  }
  function gameHtml() {
    const g = sb.g, m = g.m, mt = myTable(), mine = C().uidNow && C().uidNow() === m.by;
    const tabs = `<div class="seg ttabs">${[['boards', T('Board list')], ['rank', T('Standings')], ['tables', T('Tables')]].map(([v, l]) => `<button data-sbview="${v}" class="${sb.view === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const tsel = `<div class="grp sbme"><span>${T('My table')}</span>${seg('me', [...Array(m.tb).keys()].map(i => [i + 1, i + 1]), mt)}</div>`;
    let body = '';
    if (sb.board) body = boardHtml(sb.board);
    else if (sb.view === 'rank') body = rankHtml();
    else if (sb.view === 'tables') body = tablesHtml();
    else body = boardsHtml();
    return `<h2>🃏 ${esc(m.n)}</h2>
      <div class="muted">${T('{0} tables', m.tb)} · ${T('{0} boards', m.bd)} · ${done() ? T('Finished') : T('Running')}</div>
      ${done() ? '' : tsel}${sb.board ? '' : tabs}${body}
      ${sb.err ? `<div class="no">${esc(sb.err)}</div>` : ''}
      <div class="row2">${sb.board ? `<button class="btn gold" id="sbBoards">← ${T('Board list')}</button>` : `<button class="btn" id="sbList">← ${T('All games')}</button>`}
        ${!sb.board && !done() && (mine || isAdm()) ? `<button class="btn" id="sbEnd">${T('Finish the game')}</button>` : ''}
        ${!sb.board && isAdm() ? `<button class="btn tdel" data-sbdel="${sb.id}">✕ ${T('Delete')}</button>` : ''}
        ${sb.board ? '' : `<button class="btn gold" id="oClose">${T('Close')}</button>`}</div>`;
  }
  function boardsHtml() {
    const g = sb.g, mt = myTable();
    const cells = [...Array(g.m.bd).keys()].map(i => {
      const b = i + 1, R = (g.r || {})[b] || {}, n = Object.keys(R).length, me = mt && R[mt];
      return `<button class="sbb${me ? ' me' : ''}${n ? ' some' : ''}" data-sbboard="${b}"><b>${b}</b><small>${me ? (me.ok ? '✓ ' : '⏳ ') : ''}${n ? T('{0} tables', n) : '—'}</small></button>`;
    }).join('');
    return `<div class="muted">${done() ? T('Tap a board to see what was played.') : mt ? T('Tap a board your table played to enter its score.') : T('First choose your table above.')}</div><div class="sbgrid">${cells}</div>`;
  }
  function boardHtml(b) {
    const g = sb.g, mt = myTable(), R = (g.r || {})[b] || {}, ts = Object.keys(R).sort((x, y) => x - y);
    const vul = [E.vulOf(b, 0), E.vulOf(b, 1)], vt = vul[0] && vul[1] ? T('All vulnerable') : vul[0] ? T('{0} vulnerable', SEAT_AB[0] + SEAT_AB[2]) : vul[1] ? T('{0} vulnerable', SEAT_AB[1] + SEAT_AB[3]) : T('None vulnerable');
    const head = `<h3>${T('Board {0}', b)} <small class="muted">${T('Dealer')}: ${SEAT[E.dealerOf(b)]} · ${vt}</small></h3>`;
    const mine = mt && R[mt], others = ts.filter(t => +t !== mt).length;
    if (sb.form || (!done() && mt && !mine)) return head + formHtml(b) + (others && !sb.formT ? `<div class="muted">${T('{0} tables have played this board. You will see their results after entering yours.', others)}</div>` : '');
    if (!done() && !mt) return head + `<div class="muted">${T('First choose your table above.')}</div>`;
    if (!done() && !mine.ok) return head + `<div class="sbform"><div class="muted">${T('Table {0}', mt)}: ${esc(pairName(mt, 'ns'))} — ${esc(pairName(mt, 'ew'))}</div>
      <div class="sbprev"><b>${conTxt(mine)} ${resTxt(mine)} · ${scoreTxt(b, mine)}</b></div>
      <div class="sbwait">⏳ ${T('The other pair checks the score and confirms it.')}</div>
      <div class="row2"><button class="btn new" id="sbOk">✓ ${T('We confirm')}</button><button class="btn" id="sbFix">✎ ${T('Correct')}</button></div>
      ${others ? `<div class="muted">${T('Results of the other tables appear after the confirmation.')}</div>` : ''}</div>`;
    const c = boardCmp(b), wait = ts.filter(t => !R[t].ok).length;
    const rows = ts.map(t => { const r = R[t], x = c[t] || { ns: nsScore(b, r), cmp: null }; return `<tr class="${+t === mt ? 'me' : ''}"><td data-l="${T('Table')}" class="n">${t}</td><td data-l="${T('Pairs')}"><small>${esc(pairName(t, 'ns'))}<br>${esc(pairName(t, 'ew'))}</small></td>
      <td data-l="${T('Contract')}"><b>${conTxt(r)}</b> ${resTxt(r)}</td><td data-l="${SEAT_AB[0] + SEAT_AB[2]}" class="n">${x.ns > 0 ? x.ns : ''}</td><td data-l="${SEAT_AB[1] + SEAT_AB[3]}" class="n">${x.ns < 0 ? -x.ns : ''}</td>
      <td data-l="MP %" class="n">${!r.ok ? '⏳' : x.cmp ? x.cmp.mp : '—'}</td><td data-l="IMP" class="n">${x.cmp ? signed(x.cmp.imp) : '—'}</td>${isAdm() ? `<td class="tact"><button class="btn mini-btn" data-sbadm="${t}" title="${T('Correct')}">✎</button></td>` : ''}</tr>`; }).join('');
    return head + `<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th class="n">${T('Table')}</th><th>${T('Pairs')}</th><th>${T('Contract')}</th><th class="n">${SEAT_AB[0] + SEAT_AB[2]}</th><th class="n">${SEAT_AB[1] + SEAT_AB[3]}</th><th class="n">MP %</th><th class="n">IMP</th>${isAdm() ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="muted">${T('MP % and IMP from North-South’s side, against the other tables.')}${wait ? ' ⏳ ' + T('{0} tables waiting for confirmation', wait) : ''} ${T('Only the administrator can change a confirmed score.')}</div>`;
  }
  const scoreTxt = (b, r) => { const ns = nsScore(b, r), ew = r.l && E.sideOf(r.d) === 1; return `${ew ? SEAT_AB[1] + SEAT_AB[3] : SEAT_AB[0] + SEAT_AB[2]} ${signed(ew ? -ns : ns)}`; };
  function formHtml(b) {
    const mt = sb.formT || myTable(), R = (sb.g.r || {})[b] || {};
    const f = sb.form || (sb.form = R[mt] ? { ...R[mt] } : { l: null, s: null, x: 0, d: null, k: null });
    const need = f.l ? f.l + 6 : 0;
    const res = f.l ? [...Array(14).keys()].map(k => [k, k - need === 0 ? '=' : signed(k - need)]) : [];
    let preview = '';
    if (f.l === 0) preview = T('Passed out') + ' · 0';
    else if (f.l && f.s != null && f.d != null && f.k != null) { const ns = nsScore(b, f), ew = E.sideOf(f.d) === 1; preview = `${conTxt(f)} ${resTxt(f)} · ${ew ? SEAT_AB[1] + SEAT_AB[3] : SEAT_AB[0] + SEAT_AB[2]} ${signed(ew ? -ns : ns)}`; }
    const ok = f.l === 0 || (f.l && f.s != null && f.d != null && f.k != null);
    return `<div class="sbform"><div class="muted">${T('Table {0}', mt)}: ${esc(pairName(mt, 'ns'))} — ${esc(pairName(mt, 'ew'))}</div>
      <div class="grp"><span>${T('Contract')}</span>${seg('l', [[0, T('Pass')], ...[1, 2, 3, 4, 5, 6, 7].map(n => [n, n])], f.l)}</div>
      ${f.l ? `<div class="grp"><span>${T('Suit')}</span>${seg('s', SUITS.map((x, i) => [i, sym(i)]), f.s)}</div>
      <div class="grp"><span>${T('Doubled')}</span>${seg('x', [[0, '—'], [1, 'X'], [2, 'XX']], f.x)}</div>
      <div class="grp"><span>${T('Declarer')}</span>${seg('d', [0, 1, 2, 3].map(s => [s, SEAT[s]]), f.d)}</div>
      <div class="grp"><span>${T('Result')}</span>${seg('k', res, f.k)}</div>` : ''}
      ${preview ? `<div class="sbprev"><b>${preview}</b></div>` : ''}
      <div class="row2"><button class="btn new" id="sbSave"${ok && !sb.busy ? '' : ' disabled'}>${T('Save')}</button>${R[mt] ? `<button class="btn" id="sbCancel">${T('Cancel')}</button>` : ''}</div></div>`;
  }
  function rankHtml() {
    const L = standings();
    if (!L.length) return `<div class="muted">${T('No scores yet.')}</div>`;
    const rows = L.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b><small>${T('Table {0}', r.t)} · ${r.dir === 'ns' ? SEAT_AB[0] + SEAT_AB[2] : SEAT_AB[1] + SEAT_AB[3]}</small></td><td data-l="${T('Boards')}" class="n">${r.n}</td><td data-l="MP %" class="n">${r.pct ?? '—'}</td><td data-l="IMP" class="n">${signed(r.imp)}</td></tr>`).join('');
    return `${seg('rank', [['mp', 'MP %'], ['imp', 'IMP']], sb.rank)}<div class="ttwrap"><table class="ttab sbtab"><thead><tr><th class="n">#</th><th>${T('Pair')}</th><th class="n">${T('Boards')}</th><th class="n">MP %</th><th class="n">IMP</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="muted">${T('MP %: the average over the boards played; IMP: the total, each board against the other tables (cross-IMPs, averaged). A board played at only one table does not count yet.')}</div>`;
  }
  function tablesHtml() {
    const g = sb.g, mt = myTable(), canEdit = t => !done() && (t === mt || isAdm() || (C().uidNow && C().uidNow() === g.m.by));
    return [...Array(g.m.tb).keys()].map(i => {
      const t = i + 1, p = (g.t || {})[t] || {}, played = Object.values(g.r || {}).filter(R => R[t]).length;
      if (sb.editT === t) return `<div class="tsetrow sbrow"><b>${T('Table {0}', t)}</b>${['n', 's', 'e', 'w'].map((k, j) => `<label><small>${SEAT[[0, 2, 1, 3][j]]}</small><input class="tok" maxlength="20" data-sbtn="${k}" value="${esc(p[k] || '')}"></label>`).join('')}<button class="btn new" id="sbTSave">${T('Save')}</button></div>`;
      return `<div class="sbtrow"><b>${T('Table {0}', t)}</b><span>${SEAT_AB[0] + SEAT_AB[2]}: ${esc(pairName(t, 'ns'))}<br>${SEAT_AB[1] + SEAT_AB[3]}: ${esc(pairName(t, 'ew'))}</span><small>${T('{0} boards', played)}</small>${canEdit(t) ? `<button class="btn mini-btn" data-sbedit="${t}">✎</button>` : ''}</div>`;
    }).join('');
  }

  /* ---- actions ---- */
  async function create() {
    readSetup(); const s = sb.setup; if (sb.busy) return;
    if (!C().on) { sb.err = T('Could not reach the server. Check the internet connection.'); return show(); }
    sb.busy = true; sb.err = ''; show();
    try {
      const uid = await C().uid(), id = newCode(), ts = Date.now();
      const m = { n: s.n || T('Social bridge'), ts, tb: s.tb, bd: s.bd, st: 'open', by: uid, byn: (Net.st && localStorage.getItem('bridge-table-name')) || '' };
      const up = { ['sb/' + id + '/m']: m, ['sbi/' + id]: { n: m.n, ts, tb: m.tb, bd: m.bd, st: 'open', by: uid, byn: m.byn } };
      for (let t = 1; t <= s.tb; t++) { const p = s.names[t] || {}; up['sb/' + id + '/t/' + t] = { n: p.n || '', s: p.s || '', e: p.e || '', w: p.w || '' }; }
      await C().patch('', up);
      sb.setup = null; sb.busy = false; await loadGame(id); sb.view = 'boards'; sb.board = 0; show(); poll();
    } catch (e) { sb.busy = false; sb.err = T('Could not save. Check the internet connection and try again.'); show(); }
  }
  async function openGame(id) {
    sb.err = '';
    try { if (!(await loadGame(id))) { sb.err = T('No game with this code.'); return show(); } }
    catch (e) { sb.err = T('Could not reach the server. Check the internet connection.'); return show(); }
    sb.view = 'boards'; sb.board = 0; sb.form = null; sb.editT = 0; setLast(done() ? '' : id); show(); poll();
  }
  async function save() {
    const b = sb.board, mt = myTable(), f = sb.form; if (!b || !mt || !f || sb.busy) return;
    const t = sb.formT || mt;
    const r = f.l ? { l: f.l, s: f.s, x: f.x || 0, d: f.d, k: f.k } : { l: 0, s: 0, x: 0, d: 0, k: 0 };
    r.sc = nsScore(b, r); r.ts = Date.now();
    if (sb.formT) r.ok = true;   // the administrator's correction needs no confirmation
    sb.busy = true; show();
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
  async function finish() {
    try { await C().put('sb/' + sb.id + '/m/st', 'done'); await C().put('sbi/' + sb.id + '/st', 'done'); sb.g.m.st = 'done'; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    show();
  }
  async function del(id) {
    try { await C().patch('', { ['sb/' + id]: null, ['sbi/' + id]: null }); }
    catch (e) { sb.err = T('Could not delete.'); }
    if (sb.id === id) { sb.id = null; sb.g = null; }
    await loadList(); openOv('sb', listHtml());
  }
  async function saveTable() {
    const t = sb.editT, p = {}; document.querySelectorAll('[data-sbtn]').forEach(i => { p[i.dataset.sbtn] = i.value.trim().slice(0, 20); });
    try { await C().put('sb/' + sb.id + '/t/' + t, { n: p.n || '', s: p.s || '', e: p.e || '', w: p.w || '' }); (sb.g.t = sb.g.t || {})[t] = p; sb.editT = 0; }
    catch (e) { sb.err = T('Could not save. Check the internet connection and try again.'); }
    show();
  }

  /* running games are listed with the open tables on the home page (the list is fetched at most once a minute) */
  const lob = { L: null, ts: 0, busy: false, html: '' };
  function lobbyHtml() {
    if (!lob.busy && Date.now() - lob.ts > 60e3 && C() && C().on) {
      lob.busy = true;
      C().get('sbi').then(L => {
        lob.L = Object.entries(L || {}).map(([id, v]) => ({ id, ...v })).filter(g => g.st !== 'done' && Date.now() - g.ts < 24 * 3600e3).sort((a, b) => b.ts - a.ts);
        const h = rowsHtml(); if (h !== lob.html) { lob.html = h; if (typeof render === 'function') render(); }
      }).catch(() => {}).finally(() => { lob.busy = false; lob.ts = Date.now(); });
    }
    return lob.html = rowsHtml();
  }
  const rowsHtml = () => (lob.L || []).map(g => `<div class="otour"><div><b>🃏 ${esc(g.n)}</b><small>${T('Social bridge')} · ${T('{0} tables', g.tb)} · ${T('{0} boards', g.bd)} · ${T('Running')}</small></div><div class="otb"><button class="btn new" data-sbgo="${g.id}">${T('Open')}</button></div></div>`).join('');

  document.addEventListener('click', e => {
    if (e.target.closest('#sbOpen')) return open();
    const go = e.target.closest('[data-sbgo]'); if (go) { sb.setup = null; openOv('sb', `<div class="muted">${T('Loading…')}</div>`); return openGame(go.dataset.sbgo); }
    if (ui.overlay !== 'sb') return;
    const el = e.target.closest('button'); if (!el) return;
    const d = el.dataset, id = el.id;
    const sg = el.closest('[data-sbseg]');
    if (sg) {
      const k = sg.dataset.sbseg, v = el.dataset.v;
      if (k === 'tb' || k === 'bd') { readSetup(); sb.setup[k] = +v; }
      else if (k === 'me') { setMyTable(+v); sb.form = null; }
      else if (k === 'rank') sb.rank = v;
      else if (sb.form) { sb.form[k] = +v; if (k === 'l') { if (+v === 0) { sb.form.s = sb.form.d = sb.form.k = null; } else if (sb.form.k == null || sb.form.k < 0) sb.form.k = null; } }
      return show();
    }
    if (id === 'sbNew') { sb.setup = { n: T('Social bridge') + ' ' + new Date().toLocaleDateString(), tb: 4, bd: 24, names: {} }; sb.err = ''; return show(); }
    if (id === 'sbBack') { sb.setup = null; return show(); }
    if (id === 'sbCreate') return create();
    if (d.sbopen) return openGame(d.sbopen);
    if (d.sbdel) { const g = (sb.list || []).find(x => x.id === d.sbdel), name = g ? g.n : sb.g && sb.g.m.n; askYes(T('Delete the game “{0}” and all its scores?', name || d.sbdel), () => { openOv('sb', `<div class="muted">${T('Loading…')}</div>`); del(d.sbdel); }); return; }
    if (id === 'sbList') { setLast(''); sb.id = null; sb.g = null; show(); loadList().then(() => { if (ui.overlay === 'sb' && !sb.id) show(); }); return; }
    if (d.sbview) { sb.view = d.sbview; sb.editT = 0; return show(); }
    if (d.sbboard) { sb.board = +d.sbboard; sb.form = null; sb.formT = 0; return show(); }
    if (id === 'sbBoards') { sb.board = 0; sb.form = null; sb.formT = 0; return show(); }
    if (id === 'sbSave') return save();
    if (id === 'sbFix') { const R = sb.g.r[sb.board][myTable()]; sb.form = { ...R }; delete sb.form.ok; if (!R.l) sb.form.l = 0; return show(); }
    if (d.sbadm) { const R = sb.g.r[sb.board][d.sbadm]; sb.formT = +d.sbadm; sb.form = { ...R }; if (!R.l) sb.form.l = 0; return show(); }
    if (id === 'sbCancel') { sb.form = null; sb.formT = 0; return show(); }
    if (id === 'sbOk') return confirmScore();
    if (id === 'sbEnd') { askYes(T('Finish the game? Scores can no longer be entered.'), () => { openOv('sb', gameHtml()); finish(); }); return; }
    if (d.sbedit) { sb.editT = +d.sbedit; return show(); }
    if (id === 'sbTSave') return saveTable();
  });

  return { open, lobbyHtml };
})();
