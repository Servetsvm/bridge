/* BridgePlay (new) — at the club's table: the table chosen (a table someone sits at is not offered; this phone's own is),
   the four names, the boards of the round; each board's score entered on one sheet (level, suit, double, declarer, the
   result, the opening lead) and saved once the opponents agree; at the round's end, where everyone goes next. */
import { T } from './i18n.js';
import { page, go, esc, $, toast, sheet, closeSheet, redraw, SUITS, suitHtml } from './ui.js';
import { get, tryGet, patch, del, sendNow, listen, session, uid, me, myKey } from './net.js';
import { BM, C, vulnOf, dealerOf, calcScore, boardRecord, tableBoards, afterScore, nextRound } from './tourn.js';

// ---- this phone's seat: the club, the tournament (its start), the table, who sat down ----
const SK = 'bp2-seat';
export const seatOf = club => { try { const v = JSON.parse(localStorage.getItem(SK) || 'null'); return v && v.club === club && v.u === myKey() ? v : null; } catch (e) { return null; } };
const setSeat = v => { try { if (v) localStorage.setItem(SK, JSON.stringify(v)); else localStorage.removeItem(SK); } catch (e) {} };
const lockKey = (s, t) => s.currentRound + '_' + t;
const split = n => { const v = String(n || '').trim(); if (!v || /^(NS|EW|Pair)\s*\d+$/.test(v)) return ['', '']; const p = v.split(/\s*&\s*/); return [p[0] || '', p[1] || '']; };
const join = (a, b) => { a = (a || '').trim(); b = (b || '').trim(); return a && b ? a + ' & ' + b : a || b || ''; };
const pairName = (P, id) => { const p = P[id]; if (!p) return '—'; if (p.isPhantom) return '👻'; return split(p.name).filter(Boolean).join(' & ') || p.name || id; };

// ---- choosing the table ----
page('seat', club => ({
  title: T('Table'),
  html: `<div id="seatBox"><div class="center"><span class="spin"></span></div></div>`,
  after: async () => {
    const box = () => $('#seatBox');
    if ((await session()) !== 'ok') { if (box()) box().innerHTML = `<div class="center">${T('No connection. Try again.')}</div>`; return; }
    const [s, lk] = await Promise.all([tryGet(BM(club) + '/state'), tryGet(BM(club) + '/tableLocks')]);
    if (!box()) return;
    if (!s || s.status !== 'running') { box().innerHTML = `<div class="center">⏳ ${T('No tournament at this club now.')}</div>`; return; }
    const sv = seatOf(club);
    if (sv && sv.sid === s._startedAt) return go('ctable', { club, t: sv.t }, true);   // this phone sits there already
    const t0 = Date.parse(s._startedAt || 0) || 0, taken = new Set(Object.entries(lk || {}).filter(([k, l]) => k.startsWith(s.currentRound + '_') && ((l && l.lockedAt) || 0) >= t0).map(([k]) => +k.split('_')[1]));
    const n = s.tableCount || 0, free = Array.from({ length: n }, (_, i) => i + 1).filter(x => !taken.has(x));
    box().innerHTML = `<div class="card"><h2>${esc(s.name || '')}</h2><div class="muted">${T('Choose your table')}</div></div>
      ${free.length ? `<div class="tkeys">${free.map(x => `<button data-sit="${x}">${x}</button>`).join('')}</div>` : `<div class="center">🔒 ${T('Every table is taken')}</div>`}
      ${taken.size ? `<div class="muted" style="margin:12px 4px">🔒 ${T('Taken')}: ${[...taken].sort((a, b) => a - b).join(', ')}</div>` : ''}`;
    box().onclick = e => { const b = e.target.closest('[data-sit]'); if (b) names(club, s, +b.dataset.sit); };
  },
}));

// the four players at that table (North at the top): their names go to the pairs sitting there
async function names(club, s, t) {
  const [M, P] = await Promise.all([tryGet(BM(club) + '/movements'), tryGet(BM(club) + '/pairs')]);
  const m = (M || {})[s.currentRound + '_' + t] || {}, pp = P || {};
  const [n1, s1] = split((pp[m.ns] || {}).name), [e1, w1] = split((pp[m.ew] || {}).name);
  const v = { N: n1, S: s1, E: e1, W: w1 }; if (!n1 && !s1 && !e1 && !w1) v.S = me.name;
  const inp = k => `<label class="seatin s${k}"><small>${T({ N: 'North', S: 'South', E: 'East', W: 'West' }[k])}</small><input id="nm${k}" maxlength="40" value="${esc(v[k])}" autocomplete="off"></label>`;
  const L = tableBoards(m);
  sheet(`<h2>🪑 ${T('Table')} ${t}</h2>
    ${L.length ? `<div class="takeb">${T('Boards')} <b>${L[0]}${L.length > 1 ? ' – ' + L[L.length - 1] : ''}</b><small>${m.social || m.teamMatch ? T('Any free board') : T('Take these boards to the table')}</small></div>` : ''}
    <div class="seatgrid">${inp('N')}${inp('W')}<div class="mid">${T('Table')} ${t}</div>${inp('E')}${inp('S')}</div>
    <div id="codeRow" style="display:none"><label for="tCode">${T('Table code')}</label><input id="tCode" class="pin" inputmode="numeric" maxlength="4" autocomplete="off"></div>
    <div class="err" id="sitErr"></div>
    <button class="btn gold" id="sitGo">${T('Sit down')} ›</button>`, w => {
    w.querySelector('#sitGo').onclick = async () => {
      const btn = w.querySelector('#sitGo'); btn.disabled = true;
      const r = await sit(club, t, { N: $('#nmN').value, S: $('#nmS').value, E: $('#nmE').value, W: $('#nmW').value }, ($('#tCode') || {}).value);
      btn.disabled = false;
      if (r === 'ok') { closeSheet(); go('ctable', { club, t }, true); return; }
      if (r === 'code') { $('#codeRow').style.display = ''; $('#tCode').focus(); $('#sitErr').textContent = $('#tCode').value ? T('Wrong table code.') : T('Type the table code (ask the TD).'); return; }
      $('#sitErr').textContent = r === 'taken' ? '🔒 ' + T('This table is taken') : T('No connection. Try again.');
    };
  });
}
async function sit(club, t, nm, typed) {
  const [s, lk, lv] = await Promise.all([get(BM(club) + '/state'), tryGet(BM(club) + '/tableLocks'), tryGet('gate/live/' + club)]).catch(() => []);
  if (!s) return 'offline';
  const l = (lk || {})[lockKey(s, t)], t0 = Date.parse(s._startedAt || 0) || 0, sv = seatOf(club);
  if (l && (l.lockedAt || 0) >= t0 && !(sv && +sv.t === t && sv.sid === s._startedAt)) return 'taken';
  // signed in at the table: a quick one needs only the player's BridgePlay session; else the table's code
  if (!(s._quickTeam || (lv && lv.q))) {
    const code = /^\d{4}$/.test(typed || '') ? typed : lv && lv.k && lv.k['t' + t] ? lv.k['t' + t] : lv && lv.p ? lv.p + String(t).padStart(2, '0') : '';
    if (!code || !await sendNow('PUT', 'gate/tsess/' + uid(), { club, code })) return 'code';
  }
  if (!await sendNow('PATCH', BM(club) + '/tableLocks', { [lockKey(s, t)]: { lockedAt: Date.now(), tableNo: t } })) return 'code';
  const M = await tryGet(BM(club) + '/movements'), m = (M || {})[s.currentRound + '_' + t] || {};
  const up = {}; if (m.ns && (nm.N || nm.S)) up[m.ns + '/name'] = join(nm.N, nm.S).slice(0, 80); if (m.ew && (nm.E || nm.W)) up[m.ew + '/name'] = join(nm.E, nm.W).slice(0, 80);
  if (Object.keys(up).length) await patch(BM(club) + '/pairs', up);
  setSeat({ club, sid: s._startedAt, t, u: myKey(), r: s.currentRound });
  return 'ok';
}

// ---- at the table: the round's boards (live), each one's score; at the end of the round, the way to the next ----
page('ctable', ({ club, t }) => {
  const D = { state: null, movements: null, pairs: null, boards: null, boardLocks: null };
  const offs = Object.keys(D).map(k => listen(BM(club) + '/' + k, v => { D[k] = v; paint(); }));
  let lockedRound = 0;
  function paint() {
    const el = $('#tblBox'); if (!el || !D.state) return;
    const s = D.state, M = D.movements || {}, P = D.pairs || {}, B = D.boards || {}, r = s.currentRound;
    if (s.status !== 'running') {
      setSeat(null);
      el.innerHTML = `<div class="card" style="text-align:center"><div style="font-size:2.4rem">🏁</div><h2>${T('Tournament finished')}</h2><div class="muted">${esc(s.name || '')}</div></div>
        <button class="btn gold" data-results="${esc(club)}">📄 ${T('Results')}</button>`;
      return;
    }
    const sv = seatOf(club);
    if (sv && sv.sid !== s._startedAt) { setSeat(null); go('seat', club, true); return; }   // a new tournament: choose again
    if (r !== lockedRound) { lockedRound = r; patch(BM(club) + '/tableLocks', { [lockKey(s, t)]: { lockedAt: Date.now(), tableNo: t } }).catch(() => {}); if (sv) setSeat({ ...sv, r }); }
    const m = M[r + '_' + t];
    if (!m) { el.innerHTML = `<div class="center">☕ ${T('This table sits out this round.')}</div>`; return; }
    const L = tableBoards(m), key = b => t + '_' + r + '_' + b, done = L.filter(b => (B[key(b)] || {}).status === 'done');
    const free = m.social || m.teamMatch, locks = D.boardLocks || {}, lk = b => m.teamMatch ? (m.matchId || 'M') + '_' + b : String(b);
    const busy = b => { if (!free) return 0; const l = locks[lk(b)]; if (!l || +l.t === +t || Date.now() - (l.at || 0) > 40 * 60e3) return 0; return (B[l.t + '_' + r + '_' + b] || {}).status === 'done' ? 0 : +l.t; };
    const cell = b => {
      const x = B[key(b)], v = vulnOf(b), by = busy(b);
      const sc = x && x.status === 'done' ? (typeof x.nsScore === 'number' ? (x.nsScore > 0 ? '+' : '') + x.nsScore : esc(x.nsScore || '—')) : '';
      return `<button class="bcell${x && x.status === 'done' ? ' done' : ''}${by ? ' busy' : ''}" data-board="${b}"><span class="bn">${b}<i class="vul v${v}"></i></span>
        <span class="bc">${x && x.status === 'done' ? conHtml(x.contract) : by ? '🔒 ' + T('Table') + ' ' + by : T('Enter')}</span>${sc ? `<span class="bs">${sc}</span>` : ''}</button>`;
    };
    let end = '';
    if (done.length === L.length) {
      const nx = nextRound(s, M, t);
      end = nx ? `<div class="card guide"><h2>✅ ${T('Round {0} done', r)}</h2>
          ${nx.ns ? `<div><span class="dir ns">${T('NS')}</span>${esc(pairName(P, m.ns))} ➜ <b>${nx.ns.t === t && nx.ns.dir === 'NS' ? T('Stay at this table') : T('Table') + ' ' + nx.ns.t + ' · ' + T(nx.ns.dir)}</b></div>` : ''}
          ${nx.ew ? `<div><span class="dir ew">${T('EW')}</span>${esc(pairName(P, m.ew))} ➜ <b>${nx.ew.t === t && nx.ew.dir === 'EW' ? T('Stay at this table') : T('Table') + ' ' + nx.ew.t + ' · ' + T(nx.ew.dir)}</b></div>` : ''}
          ${nx.boardsTo && nx.boardsTo !== t ? `<div>🃏 ${T('These boards go to table {0}', nx.boardsTo)}</div>` : ''}
          ${nx.mine.boardStart ? `<div>📥 ${T('Next at this table: boards {0}', nx.mine.boardStart + (nx.mine.boardEnd !== nx.mine.boardStart ? '–' + nx.mine.boardEnd : ''))}</div>` : ''}
          <div class="muted">⏳ ${T('The next round starts when every table is done.')}</div></div>`
        : `<div class="card guide"><h2>✅ ${T('All your boards are done')}</h2><div class="muted">⏳ ${T('The results come when every table is done.')}</div></div>`;
    }
    el.innerHTML = `<div class="card tcard"><div class="thead"><b>${T('Table')} ${t}</b><span>${T('Round')} ${r}/${s.roundCount || 1}</span><span class="pill${done.length === L.length ? ' done' : ''}">${done.length}/${L.length}</span></div>
        <div><span class="dir ns">${T('NS')}</span>${esc(pairName(P, m.ns))}</div><div><span class="dir ew">${T('EW')}</span>${esc(pairName(P, m.ew))}</div></div>
      ${end}<div class="bgrid">${L.map(cell).join('')}</div>
      <button class="btn ghost" id="leaveT" style="margin-top:14px">🚪 ${T('Leave the table')}</button>`;
    el.onclick = e => {
      const b = e.target.closest('[data-board]'); if (b) { const n = +b.dataset.board, by = busy(n); if (by) return toast('🔒 ' + T('Table {0} has this board now', by)); return entry({ club, s, m, t, r, b: n, existing: B[key(n)], P }); }
      if (e.target.closest('#leaveT')) leave(club, s, t);
    };
  }
  return {
    title: T('Table') + ' ' + t, right: `<span class="live"><i></i>${T('Live')}</span>`,
    html: `<div id="tblBox"><div class="center"><span class="spin"></span></div></div>`,
    cleanup: () => offs.forEach(f => f()),
  };
});
async function leave(club, s, t) {
  if (!confirm(T('Leave the table?'))) return;
  await del(BM(club) + '/tableLocks/' + lockKey(s, t)); setSeat(null); go('club', club, true);
}
const conHtml = c => esc(String(c || '')).replace(/[♣♦♥♠]/g, x => suitHtml(SUITS.indexOf(x)));

/* ---- one board's score: everything on one sheet, the score shown as it is made; saved when the opponents agree ----
   td: the director's correction (also Not played and an adjusted score; saved at once) */
export function entry({ club, s, m, t, r, b, existing, P, td, onDone }) {
  const vuln = vulnOf(b), ask = !s._noLead && !td, key = t + '_' + r + '_' + b;
  const x = existing && existing.status === 'done' && existing.level ? existing : null;
  const f = { level: x ? x.level : 0, suit: x ? x.suit : '', doubled: x ? x.doubled || '' : '', declarer: x ? x.declarer : '', result: x ? x.result || 0 : 0, leadSuit: x ? x.leadSuit || '' : '', leadRank: x ? x.leadRank || '' : '', pass: !!(existing && existing.contract === 'PASS') };
  // a board that only one table can have at a time (Social Bridge, a team match): this table holds it while the sheet is open
  const lk = m && (m.social || m.teamMatch) && !td ? (m.teamMatch ? (m.matchId || 'M') + '_' + b : String(b)) : null;
  if (lk) sendNow('PUT', BM(club) + '/boardLocks/' + lk, { t, at: Date.now() });
  const release = () => { if (lk) sendNow('DELETE', BM(club) + '/boardLocks/' + lk); };
  const k = (on, txt, attr) => `<button class="key${on ? ' on' : ''}" ${attr}>${txt}</button>`;
  const complete = () => f.pass || (f.level && f.suit && f.declarer && (!ask || (f.leadSuit && f.leadRank)));
  const draw = () => {
    const w = $('#sheet .sh'); if (!w) return;
    const sc = f.pass ? 0 : f.level && f.suit && f.declarer ? calcScore(f.level, f.suit, f.declarer, f.result, vuln, f.doubled) : null;
    const con = f.pass ? T('All pass') : f.level ? f.level + (f.suit ? (f.suit === 'NT' ? 'NT' : suitHtml(SUITS.indexOf(f.suit))) : '…') + (f.doubled ? ' ' + f.doubled : '') + (f.declarer ? ' ' + T(f.declarer) : '') + (f.suit && f.declarer ? ' ' + (f.result > 0 ? '+' + f.result : f.result === 0 ? '=' : f.result) : '') : '…';
    const res = []; if (f.level) { res.push(0); for (let i = 1; i <= 7 - f.level; i++) res.push(i); for (let i = -1; i >= -(f.level + 6); i--) res.push(i); }   // made first, then over- and undertricks
    w.querySelector('.ent').innerHTML = `
      <div class="lcd"><div><small>${T('Board')} ${b} · ${T('Dealer')} ${T(dealerOf(b))} · ${vuln === 'None' ? T('None vul') : vuln === 'Both' ? T('All vul') : T(vuln) + ' ' + T('vul')}</small><b>${con}</b></div><div class="lsc ${sc > 0 ? 'up' : sc < 0 ? 'dn' : ''}">${sc == null ? '' : `<small>${T('NS')}</small>${sc > 0 ? '+' : ''}${sc}`}</div></div>
      <div class="krow k8">${[1, 2, 3, 4, 5, 6, 7].map(l => k(f.level === l && !f.pass, l, `data-e="level" data-v="${l}"`)).join('')}${k(f.pass, T('Pass'), 'data-e="pass"')}</div>
      ${f.pass ? '' : `<div class="krow k5">${['♣', '♦', '♥', '♠', 'NT'].map(x => k(f.suit === x, x === 'NT' ? 'NT' : suitHtml(SUITS.indexOf(x)), `data-e="suit" data-v="${x}"`)).join('')}</div>
      <div class="krow k3">${['', 'X', 'XX'].map(x => k(f.doubled === x, x || '—', `data-e="doubled" data-v="${x}"`)).join('')}</div>
      <div class="krow k4">${['N', 'E', 'S', 'W'].map(x => k(f.declarer === x, T(x), `data-e="declarer" data-v="${x}"`)).join('')}</div>
      ${res.length ? `<div class="step">${T('Result')}</div><div class="krow scroll">${res.map(i => k(f.result === i, i > 0 ? '+' + i : i === 0 ? '=' : i, `data-e="result" data-v="${i}"`)).join('')}</div>` : ''}
      ${ask ? `<div class="step">${T('Opening lead')}</div><div class="krow k4">${SUITS.map((x, i) => k(f.leadSuit === x, suitHtml(i), `data-e="leadSuit" data-v="${x}"`)).join('')}</div>
        <div class="krow k7">${['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map(x => k(f.leadRank === x, x, `data-e="leadRank" data-v="${x}"`)).join('')}</div>` : ''}`}
      ${td ? `<div class="step">${T('Director')}</div><div class="krow k3">${k(0, T('Not played'), 'data-e="np"')}${k(0, 'A+ / A−', 'data-e="adj" data-v="A+|A-"')}${k(0, 'A / A', 'data-e="adj" data-v="A|A"')}${k(0, 'A− / A+', 'data-e="adj" data-v="A-|A+"')}${existing ? k(0, '🗑 ' + T('Delete'), 'data-e="del"') : ''}</div>` : ''}
      <button class="btn green" id="entOk"${complete() ? '' : ' disabled'}>✓ ${td ? T('Save') : T('OK — the opponents agree')}</button>`;
  };
  const save = async rec => {
    if (td) Object.assign(rec, { td: true, manualEdit: true });
    await patch(BM(club) + '/boards', { [key]: rec });
    release(); lkHeld = false; closeSheet(); toast('✅ ' + T('Saved'));
    if (onDone) onDone(); else afterScore(club);
  };
  let lkHeld = true;
  sheet(`<h2>${T('Board')} ${b}</h2><div class="ent"></div>`, w => {
    draw();
    w.addEventListener('click', e => {
      const q = e.target.closest('[data-e]'); if (q) {
        const a = q.dataset.e, v = q.dataset.v;
        if (a === 'pass') { f.pass = !f.pass; if (f.pass) Object.assign(f, { level: 0, suit: '', doubled: '', declarer: '', result: 0, leadSuit: '', leadRank: '' }); }
        else if (a === 'level') { f.pass = false; f.level = +v; f.result = Math.max(-(f.level + 6), Math.min(7 - f.level, f.result)); }
        else if (a === 'result') f.result = +v;
        else if (a === 'np') return save({ contract: 'Not played', notPlayed: true, vuln, status: 'done', time: new Date().toISOString() });
        else if (a === 'adj') { const [ns, ew] = v.split('|'); return save({ contract: `ADJ(${ns}/${ew})`, nsScore: ns, ewScore: ew, vuln, status: 'done', adjusted: true, time: new Date().toISOString() }); }
        else if (a === 'del') { if (!confirm(T('Delete this score?'))) return; del(BM(club) + '/boards/' + key).then(() => { closeSheet(); toast('🗑'); if (onDone) onDone(); }); return; }
        else f[a] = v;
        draw(); return;
      }
      if (e.target.closest('#entOk') && complete()) save(boardRecord(f, vuln));
    });
  }, () => { if (lkHeld) release(); });
}
