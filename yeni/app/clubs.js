/* BridgePlay (new) — Clubs: the list (the ones playing now first), a club's page, its live screen, its results and info.
   The club data is the same as the first BridgePlay's (gate/clubs/<id>/…), so both programs see the same clubs. */
import { T, lang } from './i18n.js';
import { page, go, esc, $, redraw, sheet, SUITS, suitHtml } from './ui.js';
import { listen, tryGet, me, session } from './net.js';
import { standings, teamScore } from './score.js';

const C = id => 'gate/clubs/' + id;
let cache = { list: null, at: 0 };

// ---- a club's logo: a picture, or a playing card (its own, or one from its name) ----
const DEF = ['AS', 'KH', 'QD', 'JC', 'AH', 'KS', 'QC', 'JD'];
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export function logoHtml(id, v) {
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v || '')) return `<span class="logo"><img src="${v}" alt=""></span>`;
  let c = /^[AKQJT2-9][SHDC]$/.test(v || '') ? v : DEF[hash(id) % DEF.length];
  const s = 'CDHS'.indexOf(c[1]);
  return `<span class="logo${s === 1 || s === 2 ? ' r' : ''}"><span>${c[0] === 'T' ? '10' : c[0]}</span><span class="s">${SUITS[s]}</span></span>`;
}

// ---- the list of clubs ----
async function loadList(force) {
  if (!force && cache.list && Date.now() - cache.at < 60e3) return cache.list;
  await session();   // the list of tournaments being played needs the sign-in
  const [cl, live] = await Promise.all([tryGet('gate/clubList'), tryGet('gate/live')]);
  const L = Object.entries(cl || {}).filter(([, c]) => c && c.a !== false).map(([id, c]) => ({ id, name: c.n || id }));
  const lv = live || {};
  const runs = await Promise.all(L.map(c => lv[c.id] ? tryGet(C(c.id) + '/bm/state/status') : null));
  const [logos, infos] = await Promise.all([Promise.all(L.map(c => tryGet(C(c.id) + '/bm/logo'))), Promise.all(L.map(c => tryGet(C(c.id) + '/bm/info')))]);
  L.forEach((c, i) => { c.logo = logos[i]; c.info = infos[i] && typeof infos[i] === 'object' ? infos[i] : null; const t = lv[c.id]; c.live = runs[i] === 'running' && t && Date.now() - (t.ts || 0) < (t.q ? 5 : 24) * 3600e3 ? t : null; });
  L.sort((a, b) => (!!b.live - !!a.live) || a.name.localeCompare(b.name, lang));
  cache = { list: L, at: Date.now() };
  return L;
}
page('clubs', () => {
  const draw = L => {
    const el = $('#clubList'); if (!el) return;
    el.innerHTML = L.length ? L.map(c => `<button class="club" data-club="${esc(c.id)}">${logoHtml(c.id, c.logo)}<span><b>${esc(c.name)}</b>
      ${c.live ? `<small class="on">● ${esc(c.live.n || T('Being played now'))}</small>` : nextHtml(c.info) ? `<small>⏰ ${esc(nextHtml(c.info))}</small>` : ''}</span><span class="arr">›</span></button>`).join('')
      : `<div class="center">${T('No results yet.')}</div>`;
  };
  return {
    title: T('Clubs'),
    html: `<div class="clubs" id="clubList"><div class="center"><span class="spin"></span></div></div>`,
    after: () => { if (cache.list) draw(cache.list); loadList().then(draw).catch(() => { const el = $('#clubList'); if (el) el.innerHTML = `<div class="center">${T('No connection. Try again.')}</div>`; }); },
  };
});
document.addEventListener('click', e => { const b = e.target.closest('[data-club]'); if (b) go('club', b.dataset.club); });

// the next tournament day from the club's info (its weekdays and times)
const DAYS = [0, 8, 9, 1, 2, 3, 4, 5, 6, 7];
function nextHtml(info) {
  const sch = info && Array.isArray(info.sch) ? info.sch : []; if (!sch.length) return '';
  const now = new Date(); let best = null;
  for (let add = 0; add < 8; add++) {
    const d = new Date(now); d.setDate(now.getDate() + add); const wd = d.getDay() || 7;
    for (const r of sch) {
      if (!/^\d\d:\d\d$/.test(r.t || '')) continue;
      const ok = r.d === 0 || (r.d === 8 && wd <= 5) || (r.d === 9 && wd >= 6) || r.d === wd; if (!ok) continue;
      const [h, m] = r.t.split(':').map(Number); const at = new Date(d); at.setHours(h, m, 0, 0);
      if (at > now && (!best || at < best)) best = at;
    }
  }
  if (!best) return '';
  return best.toLocaleDateString(lang === 'no' ? 'nb' : lang, { weekday: 'long' }) + ' ' + best.toLocaleTimeString(lang === 'no' ? 'nb' : lang, { hour: '2-digit', minute: '2-digit' });
}

// ---- a club's page ----
page('club', id => {
  const c = (cache.list || []).find(x => x.id === id) || { id, name: id };
  const old = '../?kulup=' + encodeURIComponent('?club=' + id);
  return {
    title: c.name,
    html: `<div class="chead">${logoHtml(id, c.logo)}<div><h2>${esc(c.name)}</h2>${c.live ? `<span class="live"><i></i>${esc(c.live.n || T('Live'))}</span>` : `<div class="muted">${T('No tournament at this club now.')}</div>`}</div></div>
      <div class="actions">
        ${c.live ? `<button class="btn green wide" data-live="${esc(id)}">● ${T('Live')}</button>` : ''}
        <button class="btn" data-results="${esc(id)}">📄 ${T('Results')}</button>
        ${c.info && infoHtml(c.info) ? `<button class="btn" data-info="${esc(id)}">ℹ️ ${T('Club info')}</button>` : `<span></span>`}
        <a class="btn wide" href="${old}">🧑‍⚖️ ${T('TD')} · 🪑 ${T('Table')} <small class="muted">(${T('The old BridgePlay')})</small></a>
      </div>`,
  };
});
document.addEventListener('click', e => {
  const l = e.target.closest('[data-live]'); if (l) return go('live', l.dataset.live);
  const r = e.target.closest('[data-results]'); if (r) return go('results', r.dataset.results);
  const i = e.target.closest('[data-info]'); if (i) { const c = (cache.list || []).find(x => x.id === i.dataset.info); if (c) sheet(`<h2>ℹ️ ${esc(c.name)}</h2>${infoHtml(c.info)}`); }
});

// ---- the club's info: address (the way there), contact person, phone (call), tournament days ----
function infoHtml(x) {
  if (!x) return '';
  const adr = String(x.adr || '').trim(), kp = String(x.kp || '').trim(), tel = String(x.tel || '').trim(), num = tel.replace(/[^\d+]/g, '');
  const sch = (Array.isArray(x.sch) ? x.sch : []).filter(r => r && DAYS.includes(r.d) && /^\d\d:\d\d$/.test(r.t || ''));
  const KIND = { pairs: 'Pairs tournament', teams: 'Teams', indiv: 'Individual', begin: 'Beginners', online: 'Online' };
  const day = d => d === 0 ? T('Every day') : d === 8 ? T('Weekdays') : d === 9 ? T('Weekend') : new Date(2024, 0, d).toLocaleDateString(lang === 'no' ? 'nb' : lang, { weekday: 'long' });
  if (!adr && !kp && !num && !sch.length) return '';
  return (adr ? `<a class="inf" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}" target="_blank" rel="noopener"><span class="i">📍</span><span><small>${T('Address')}</small>${esc(adr)}<br><b>🧭 ${T('Directions')}</b></span></a>` : '')
    + (sch.length ? `<div class="inf"><span class="i">📅</span><span><small>${T('Tournament days')}</small>${sch.map(r => `<div><b>${esc(day(r.d))}</b> ${esc(r.t)}${KIND[r.k] ? ' · ' + T(KIND[r.k]) : ''}${r.n ? ' · ' + esc(r.n) : ''}</div>`).join('')}</span></div>` : '')
    + (kp ? `<div class="inf"><span class="i">👤</span><span><small>${T('Contact person')}</small>${esc(kp)}</span></div>` : '')
    + (num ? `<a class="inf" href="tel:${esc(num)}"><span class="i">📞</span><span><small>${T('Phone')}</small>${esc(tel)} · <b>${T('Call')}</b></span></a>` : '');
}

// ---- the live screen: the standings, NS / EW, the tables (live: only the changes come) ----
let liveTab = 'all';
page('live', id => {
  const c = (cache.list || []).find(x => x.id === id) || { id, name: id };
  const D = { state: null, boards: null, pairs: null, movements: null };
  const offs = Object.keys(D).map(k => listen(C(id) + '/bm/' + k, v => { D[k] = v; paint(); }));
  function paint() {
    const el = $('#liveBox'); if (!el || !D.state) return;
    const s = D.state, B = D.boards || {}, M = D.movements || {}, P = D.pairs || {};
    if (s.status !== 'running' && s.status !== 'finished') { el.innerHTML = `<div class="center">${T('No tournament at this club now.')}</div>`; return; }
    let tot = 0, done = 0;
    for (let t = 1; t <= (s.tableCount || 0); t++) { const m = M[s.currentRound + '_' + t]; if (!m) continue; for (let b = m.boardStart || 1; b <= (m.boardEnd || 0); b++) { tot++; if ((B[t + '_' + s.currentRound + '_' + b] || {}).status === 'done') done++; } }
    const rows = standings(B, M, P).sort((a, b) => (s.scoring === 'IMP' ? b.imp - a.imp : b.pct - a.pct || b.imp - a.imp));
    const show = liveTab === 'ns' ? rows.filter(r => r.dir === 'NS') : liveTab === 'ew' ? rows.filter(r => r.dir === 'EW') : rows;
    const tm = s.movement === 'team' ? teamScore(s, M, B) : null;
    el.innerHTML = `${tm ? `<div class="team"><div class="${tm.a > tm.b ? 'lead' : ''}"><small>${esc(tm.ta)}</small><b>${tm.a}</b>IMP</div><div class="${tm.b > tm.a ? 'lead' : ''}"><small>${esc(tm.tb)}</small><b>${tm.b}</b>IMP</div></div>` : ''}
      <div class="stats"><div class="stat"><b>${s.currentRound || 0}/${s.roundCount || 0}</b><small>${T('Round')}</small></div><div class="stat"><b>${s.tableCount || 0}</b><small>${T('Tables')}</small></div>
        <div class="stat"><b>${rows.length}</b><small>${T('Pairs')}</small></div><div class="stat"><b>${Object.values(B).filter(b => b && b.status === 'done').length}</b><small>${T('Boards done')}</small></div></div>
      <div class="prog"><i style="width:${tot ? Math.round(done / tot * 100) : 0}%"></i></div>
      <div class="tabs">${[['all', '🌐 ' + T('Overall')], ['ns', '🔵 ' + T('NS')], ['ew', '🟡 ' + T('EW')], ['tables', '📋 ' + T('Tables')]].map(([k, n]) => `<button class="${liveTab === k ? 'on' : ''}" data-ltab="${k}">${n}</button>`).join('')}</div>
      <div class="card" style="padding:4px 0">${liveTab === 'tables' ? tablesHtml(s, B, M, P) : show.map((r, i) => rankHtml(r, i, s)).join('') || `<div class="center">…</div>`}</div>`;
  }
  return {
    title: c.name, right: `<span class="live"><i></i>${T('Live')}</span>`,
    html: `<div id="liveBox"><div class="center"><span class="spin"></span></div></div>`,
    cleanup: () => offs.forEach(f => f()),
  };
});
document.addEventListener('click', e => { const b = e.target.closest('[data-ltab]'); if (b) { liveTab = b.dataset.ltab; redraw(); } });
const rankHtml = (r, i, s) => `<div class="rank"><span class="pos p${i + 1}">${i + 1}</span><span class="nm"><span class="dir ${r.dir === 'NS' ? 'ns' : 'ew'}">${r.dir === 'NS' ? T('NS') : T('EW')}</span>${esc(r.name)}<small>${r.boards} ${T('Boards').toLowerCase()}</small></span>
  <span class="sc">${s.scoring === 'IMP' ? (r.imp > 0 ? '+' : '') + r.imp : r.pct + '%'}<small>${s.scoring === 'IMP' ? '' : 'IMP ' + (r.imp > 0 ? '+' : '') + r.imp}</small></span></div>`;
function tablesHtml(s, B, M, P) {
  let h = '';
  for (let t = 1; t <= (s.tableCount || 0); t++) {
    const m = M[s.currentRound + '_' + t]; if (!m) continue;
    const pl = []; for (let b = m.boardStart || 1; b <= (m.boardEnd || 0); b++) if ((B[t + '_' + s.currentRound + '_' + b] || {}).status === 'done') pl.push(b);
    const n = (m.boardEnd || 0) - (m.boardStart || 1) + 1;
    h += `<div class="tbl" style="border-bottom:1px solid var(--line)"><h3>${T('Table')} ${t}<span class="pill${pl.length >= n ? ' done' : ''}">${pl.length}/${n}</span></h3>
      <div><span class="dir ns">${T('NS')}</span>${esc((P[m.ns] || {}).name || m.ns || '—')}</div><div><span class="dir ew">${T('EW')}</span>${esc((P[m.ew] || {}).name || m.ew || '—')}</div>
      ${pl.length ? `<div class="played">${pl.map(b => `<b>${b}</b>`).join('')}</div>` : ''}</div>`;
  }
  return h;
}

// ---- the results: the club's tournaments (newest first), each with its standings and its boards ----
const arcList = (A, TA) => [...(Array.isArray(A) ? A : Object.values(A || {})).filter(Boolean),
  ...Object.values(TA || {}).filter(a => a && a.state && Object.values(a.boards || {}).some(b => b && b.status === 'done'))]
  .map(a => ({ a, d: new Date(a.finished || (a.state && a.state._finishedAt) || 0) })).filter(x => x.d.getTime() > 0).sort((x, y) => y.d - x.d);
const resCache = {};
page('results', id => {
  const c = (cache.list || []).find(x => x.id === id) || { id, name: id };
  const draw = () => {
    const el = $('#resBox'); if (!el) return; const L = resCache[id] || [];
    let mon = '', h = '';
    L.forEach((x, i) => {
      const m = x.d.toLocaleDateString(lang === 'no' ? 'nb' : lang, { month: 'long', year: 'numeric' }); if (m !== mon) { mon = m; h += `<div class="mon">${esc(m)}</div>`; }
      const s = x.a.state || {}, tm = s.movement === 'team' ? teamScore(s, x.a.movements, x.a.boards) : null;
      h += `<button class="li" data-res="${esc(id)}|${i}"><span><b>${esc(tm ? `${tm.ta} ${tm.a} – ${tm.b} ${tm.tb}` : s.name || T('Results'))}</b><br><small>${x.d.toLocaleDateString(lang === 'no' ? 'nb' : lang)}${s.movement === 'team' ? ' · 🏆 ' + T('Team match') : s.movement === 'social' ? ' · 🤝 ' + T('Social Bridge') : ''}</small></span><span class="muted">›</span></button>`;
    });
    el.innerHTML = h ? `<div class="list">${h}</div>` : `<div class="center">${T('No results yet.')}</div>`;
  };
  return {
    title: T('Results') + ' · ' + c.name,
    html: `<div id="resBox"><div class="center"><span class="spin"></span></div></div>`,
    after: () => { if (resCache[id]) draw(); Promise.all([tryGet(C(id) + '/bm/archives'), tryGet(C(id) + '/bm/teamArch')]).then(([A, TA]) => { resCache[id] = arcList(A, TA); draw(); }); },
  };
});
document.addEventListener('click', e => { const b = e.target.closest('[data-res]'); if (b) { const [id, i] = b.dataset.res.split('|'); go('result', { id, i: +i }); } });

let resTab = 'all';
page('result', ({ id, i }) => {
  const x = (resCache[id] || [])[i]; if (!x) return { title: T('Results'), html: `<div class="center">…</div>` };
  const a = x.a, s = a.state || {};
  const rows = standings(a.boards, a.movements, a.pairs).sort((p, q) => (s.scoring === 'IMP' ? q.imp - p.imp : q.pct - p.pct || q.imp - p.imp));
  const tm = s.movement === 'team' ? teamScore(s, a.movements, a.boards) : null;
  const byBoard = {};
  for (const [k, b] of Object.entries(a.boards || {})) { if (!b || b.status !== 'done') continue; const [t, r, n] = k.split('_'); const m = (a.movements || {})[r + '_' + t] || {}; (byBoard[n] = byBoard[n] || []).push({ t, m, b }); }
  const nums = Object.keys(byBoard).map(Number).sort((p, q) => p - q);
  const P = a.pairs || {}, nm = id => esc(((P[id] || {}).name || id || '—'));
  const con = b => esc(String(b.contract || '')).replace(/[♣♦♥♠]/g, m => suitHtml(SUITS.indexOf(m)));
  const body = resTab === 'boards'
    ? nums.map(n => `<div class="card"><h2>${T('Board')} ${n}</h2><table class="trav"><tr><th>${T('NS')}</th><th>${T('EW')}</th><th>${T('Contract')}</th><th style="text-align:right">${T('Score')}</th></tr>
        ${byBoard[n].sort((p, q) => (q.b.nsScore || 0) - (p.b.nsScore || 0)).map(r => `<tr><td>${nm(r.m.ns)}</td><td>${nm(r.m.ew)}</td><td>${con(r.b)}</td><td style="text-align:right;font-weight:700">${typeof r.b.nsScore === 'number' ? r.b.nsScore : esc(r.b.nsScore || '')}</td></tr>`).join('')}</table></div>`).join('')
    : `<div class="card" style="padding:4px 0">${(resTab === 'ns' ? rows.filter(r => r.dir === 'NS') : resTab === 'ew' ? rows.filter(r => r.dir === 'EW') : rows).map((r, j) => rankHtml(r, j, s)).join('')}</div>`;
  return {
    title: s.name || T('Results'),
    html: `${tm ? `<div class="team"><div class="${tm.a > tm.b ? 'lead' : ''}"><small>${esc(tm.ta)}</small><b>${tm.a}</b>IMP</div><div class="${tm.b > tm.a ? 'lead' : ''}"><small>${esc(tm.tb)}</small><b>${tm.b}</b>IMP</div></div>` : ''}
      <div class="muted" style="margin:0 4px 10px">${x.d.toLocaleString(lang === 'no' ? 'nb' : lang)} · ${s.tableCount || 0} ${T('Tables').toLowerCase()} · ${nums.length} ${T('Boards').toLowerCase()}</div>
      <div class="tabs">${[['all', '🌐 ' + T('Overall')], ['ns', '🔵 ' + T('NS')], ['ew', '🟡 ' + T('EW')], ['boards', '🃏 ' + T('Boards')]].map(([k, n]) => `<button class="${resTab === k ? 'on' : ''}" data-rtab="${k}">${n}</button>`).join('')}</div>${body}`,
  };
});
document.addEventListener('click', e => { const b = e.target.closest('[data-rtab]'); if (b) { resTab = b.dataset.rtab; redraw(); } });
