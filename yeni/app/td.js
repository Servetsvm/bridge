/* BridgePlay (new) — the director (TD): the club's owner (their BridgePlay sign-in is enough) or anyone with the club's
   password. Starts a quick team match or Social Bridge; while a tournament runs: its tables (taken ones can be freed),
   any board corrected (also Not played, an adjusted score), the next round, Finish (to the results), Delete. */
import { T } from './i18n.js';
import { page, go, esc, $, toast, sheet, closeSheet, redraw } from './ui.js';
import { get, tryGet, del, patch, sendNow, listen, session, uid, myKey } from './net.js';
import { BM, C, tableBoards, progress, finish, wipe, quickStart } from './tourn.js';
import { entry } from './table.js';

const okKey = club => 'bp2-td-' + club;
const tdOk = club => { try { return sessionStorage.getItem(okKey(club)) === uid(); } catch (e) { return false; } };
/* the director's rights at this club: 'owner', 'pw' (the club's password typed on this phone) or '' */
async function rights(club) {
  if ((await session()) !== 'ok') return '';
  const owner = await tryGet(C(club) + '/info/owner');
  if (owner && owner === myKey()) return 'owner';
  if (tdOk(club)) try { await get(C(club) + '/secret/tprefix'); return 'pw'; } catch (e) {}
  return '';
}
async function signInPw(club, pw) {
  if (!await sendNow('PUT', 'gate/csess/' + uid(), { club, pw })) return false;
  try { await get(C(club) + '/secret/tprefix'); } catch (e) { return false; }   // readable only with the right password
  try { sessionStorage.setItem(okKey(club), uid()); } catch (e) {}
  return true;
}

// ---- starting a quick one (any member, when the club shows its button; the director always) ----
export async function startQuick(club, name, kind) {
  if (kind === 'social') {
    let pl = 12, nb = 12;
    const PL = [8, 12, 16, 20, 24, 28, 32, 36, 40], NB = [8, 12, 16, 20, 24, 28, 32, 36];
    const body = () => `<h2>🤝 ${T('Social Bridge')}</h2><div class="step">${T('Number of players')}</div><div class="krow k5">${PL.map(v => `<button class="key${v === pl ? ' on' : ''}" data-pl="${v}">${v}</button>`).join('')}</div>
      <div class="step">${T('Number of boards')}</div><div class="krow k4">${NB.map(v => `<button class="key${v === nb ? ' on' : ''}" data-nb="${v}">${v}</button>`).join('')}</div>
      <div class="lcd"><div><b>${pl / 4} ${T('Tables').toLowerCase()} · ${nb} ${T('Boards').toLowerCase()}</b></div></div><button class="btn green" id="qsGo">▶ ${T('Start now')}</button>`;
    sheet(`<div id="qsBox">${body()}</div>`, w => w.addEventListener('click', async e => {
      const a = e.target.closest('[data-pl]'), b = e.target.closest('[data-nb]');
      if (a) pl = +a.dataset.pl; if (b) nb = +b.dataset.nb;
      if (a || b) { w.querySelector('#qsBox').innerHTML = body(); return; }
      if (e.target.closest('#qsGo')) { e.target.disabled = true; await go2(club, name, 'social', { players: pl, boards: nb }); }
    }));
    return;
  }
  if (!confirm(T('Start a team match now? (2 teams, 2 tables, boards 1–8)'))) return;
  await go2(club, name, 'team', {});
}
async function go2(club, name, kind, o) {
  if ((await session()) !== 'ok') return toast(T('No connection. Try again.'));
  const r = await quickStart(club, name, kind, { ...o, label: T(kind === 'team' ? 'Team match' : 'Social Bridge') });
  closeSheet();
  if (r === 'busy') return toast('⏳ ' + T('A tournament is being played at this club.'));
  if (r !== 'ok') return toast('❌ ' + T('Not allowed.'));
  toast('▶ ' + T('Started'));
  go('seat', club);
}

// ---- the director's page ----
page('td', club => {
  const D = { state: null, movements: null, boards: null, pairs: null, tableLocks: null };
  let offs = [], who = null;
  const start = () => { offs = Object.keys(D).map(k => listen(BM(club) + '/' + k, v => { D[k] = v; paint(); })); };
  function paint() {
    const el = $('#tdBox'); if (!el || !who) return;
    const s = D.state || {}, M = D.movements || {}, B = D.boards || {}, P = D.pairs || {}, L = D.tableLocks || {};
    if (s.status !== 'running') {
      el.innerHTML = `<div class="card"><h2>🧑‍⚖️ ${T('TD')}</h2><div class="muted">${T('No tournament at this club now.')}</div></div>
        <div class="actions"><button class="btn gold wide" data-q="team">🏆 ${T('Team match')}</button><button class="btn gold wide" data-q="social">🤝 ${T('Social Bridge')}</button>
        <a class="btn wide" href="../?kulup=${encodeURIComponent('?club=' + club + '&role=admin')}">⚙️ ${T('Other tournaments (Mitchell, Howell…)')} <small class="muted">(${T('The old BridgePlay')})</small></a>
        ${s.status === 'setup' && s.tableCount ? `<button class="btn ghost wide" data-del>🗑 ${T('Delete the tournament set up')}</button>` : ''}</div>`;
      return;
    }
    const r = s.currentRound, t0 = Date.parse(s._startedAt || 0) || 0, pr = progress(s, M, B);
    let h = '';
    for (let t = 1; t <= (s.tableCount || 0); t++) {
      const m = M[r + '_' + t]; if (!m) continue;
      const Lb = tableBoards(m), d = Lb.filter(b => (B[t + '_' + r + '_' + b] || {}).status === 'done').length, lk = L[r + '_' + t], taken = lk && (lk.lockedAt || 0) >= t0;
      h += `<button class="li" data-tt="${t}"><span><b>${T('Table')} ${t}</b> ${taken ? '🔒' : ''}<br><small>${T('NS')} ${esc((P[m.ns] || {}).name || m.ns)} · ${T('EW')} ${esc((P[m.ew] || {}).name || m.ew)}</small></span><span class="pill${d >= Lb.length ? ' done' : ''}">${d}/${Lb.length}</span></button>`;
    }
    el.innerHTML = `<div class="card"><h2>${esc(s.name || '')}</h2><div class="muted">${T('Round')} ${r}/${s.roundCount || 1} · ${pr.done}/${pr.total} ${T('Boards').toLowerCase()}</div><div class="prog"><i style="width:${pr.total ? Math.round(pr.done / pr.total * 100) : 0}%"></i></div></div>
      <div class="list">${h}</div>
      <div class="actions" style="margin-top:14px">
        ${r < (s.roundCount || 1) ? `<button class="btn wide" data-next>⏭ ${T('Next round')}</button>` : ''}
        <button class="btn green wide" data-fin>🏁 ${T('Finish the tournament')}</button>
        <button class="btn ghost wide" data-del>🗑 ${T('Delete the tournament')}</button></div>`;
  }
  function table(t) {
    const s = D.state || {}, M = D.movements || {}, B = D.boards || {}, P = D.pairs || {}, r = s.currentRound, m = M[r + '_' + t] || {}, L = D.tableLocks || {};
    const lk = L[r + '_' + t];
    sheet(`<h2>${T('Table')} ${t} · ${T('Round')} ${r}</h2>
      <div class="list">${tableBoards(m).map(b => { const x = B[t + '_' + r + '_' + b]; return `<button class="li" data-tb="${b}"><span><b>${T('Board')} ${b}</b></span><span>${x && x.status === 'done' ? esc(x.contract || '') + ' · ' + (typeof x.nsScore === 'number' ? x.nsScore : esc(x.nsScore || '')) : '—'}</span></button>`; }).join('')}</div>
      ${lk ? `<button class="btn ghost" data-unlock style="margin-top:10px">🔓 ${T('Free the table')}</button>` : ''}`, w => w.addEventListener('click', async e => {
      const b = e.target.closest('[data-tb]'); if (b) { const n = +b.dataset.tb; closeSheet(); entry({ club, s, m, t, r, b: n, existing: B[t + '_' + r + '_' + n], P, td: true, onDone: () => {} }); return; }
      if (e.target.closest('[data-unlock]')) { await del(BM(club) + '/tableLocks/' + r + '_' + t); closeSheet(); toast('🔓'); }
    }));
  }
  return {
    title: T('TD'),
    html: `<div id="tdBox"><div class="center"><span class="spin"></span></div></div>`,
    after: async () => {
      cur.club = club; cur.table = table; tryGet(C(club) + '/info/name').then(n => { cur.name = n || club; });
      who = await rights(club);
      const el = $('#tdBox'); if (!el) return;
      if (who) { start(); return; }
      el.innerHTML = `<div class="card"><h2>🔑 ${T('Club password')}</h2><div class="muted">${T('The TD signs in with the club’s password (the club’s owner needs none).')}</div>
        <form id="tdForm"><input id="tdPw" type="password" autocomplete="current-password"><div class="err" id="tdErr"></div><button class="btn gold" type="submit">${T('Sign in')}</button></form></div>`;
      $('#tdForm').onsubmit = async e => {
        e.preventDefault(); const pw = $('#tdPw').value.trim(); if (!pw) return;
        if (await signInPw(club, pw)) { who = 'pw'; el.innerHTML = `<div class="center"><span class="spin"></span></div>`; start(); }
        else $('#tdErr').textContent = T('Wrong password.');
      };
    },
    cleanup: () => offs.forEach(f => f()),
  };
});
// the TD page's buttons act on its club (the page drawn last)
const cur = { club: '', name: '', table: () => {} };
document.addEventListener('click', async e => {
  if (!e.target.closest('#tdBox') || !cur.club) return;
  const tdClub = cur.club;
  const q = e.target.closest('[data-q]'); if (q) return startQuick(tdClub, cur.name, q.dataset.q);
  const t = e.target.closest('[data-tt]'); if (t) return cur.table(+t.dataset.tt);
  if (e.target.closest('[data-next]')) {
    const s = await tryGet(BM(tdClub) + '/state'); if (!s || s.status !== 'running' || !(s.currentRound < s.roundCount)) return;
    if (!confirm(T('Start round {0}? Tables still playing keep their scores.', s.currentRound + 1))) return;
    await patch(BM(tdClub) + '/state', { currentRound: s.currentRound + 1, _roundStartedAt: new Date().toISOString() }); toast('⏭');
  }
  if (e.target.closest('[data-fin]')) { if (!confirm(T('Finish the tournament and put it in the results?'))) return; if (await finish(tdClub)) { toast('🏁 ' + T('Tournament finished')); go('results', tdClub, true); } }
  if (e.target.closest('[data-del]')) { if (!confirm(T('Delete this tournament completely?'))) return; await wipe(tdClub); toast('🗑 ' + T('Deleted')); }
});
