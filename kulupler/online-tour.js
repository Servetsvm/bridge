/* BridgeGate — online club tournaments, played in Bridge Table (pairs against each other, each at home).
   The club's director sets one up here: its name, the day and the start time, the number of boards and the boards in
   each round, MP or IMP, the base system and the conventions everyone (robots too) bids with, and whether it comes
   back every week. Players register as pairs in Bridge Table; a player without a partner goes on the "looking for a
   partner" list, and the director can pair two of them here.
   Kept in the database at ot/<club>/<id>: info, pairs/<pair> { a, b, ka, kb, d }, seek/<player key> { n, d }.
   d = the start of the occurrence registered for (a weekly tournament has a new one each week). */
'use strict';
const OT = { list: null, meta: null, busy: false };
const otRoot = () => FB_BASE.replace(/\/gate$/, '');
async function otUrl(p) { const token = await authToken(); return otRoot() + '/ot/' + encodeURIComponent(CLUB_ID) + (p || '') + '.json' + (token ? '?auth=' + token : ''); }
// the next start of a tournament: its date, or for a weekly one the first week whose start is not more than 4 hours ago
function otNext(i) { let t = +i.at || 0; if (i.rep) while (t + 4 * 3600e3 < Date.now()) t += 7 * 864e5; return t; }
const otWhen = t => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
async function otLoad() {
  try { const r = await fetch(await otUrl(''), { cache: 'no-store' }); OT.list = r.ok ? (await r.json()) || {} : {}; OT.at = Date.now(); } catch (e) { OT.list = OT.list || {}; }
}
// the director's page (any tab): the club's online tournaments read again every 20 seconds, for the robots and the club's tabs
async function otFresh() { if (CLUB_ID && document.getElementById('adminContent') && (!OT.list || Date.now() - (OT.at || 0) > 20e3)) await otLoad(); }
// the systems and conventions, as the boards made automatically know them (kulupler/dealgen.js)
function otMeta() {
  if (OT.meta) return Promise.resolve(OT.meta);
  return new Promise(res => { let w; try { w = new Worker('dealgen.js'); } catch (e) { res(null); return; }
    w.onmessage = e => { if (e.data && e.data.meta) { OT.meta = e.data.meta; w.terminate(); res(OT.meta); } };
    w.postMessage({ meta: true }); setTimeout(() => res(OT.meta), 8000); });
}
const OT_MOV = { mitchell: 'Mitchell — NS fixed, EW moves', howell: 'Howell — all pairs move', barometer: 'Barometer — every table plays the same boards each round, then the pairs move', swiss: 'Swiss — pairings adapt to standings each round' };
// the form of an online tournament (also in Tournament Setup under 🌐 Online): what is played first, then when and how
function otFormHtml(M, ed) {
  const d0 = new Date(Date.now() + 864e5), ymd = d0.toISOString().slice(0, 10);
  if (ed) setTimeout(() => {   // a tournament to change: its values in the form
    const set = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.value = v; }, at = new Date(otNext(ed));
    set('otSys', ed.sys); set('otName', ed.n); set('otDay', at.getFullYear() + '-' + String(at.getMonth() + 1).padStart(2, '0') + '-' + String(at.getDate()).padStart(2, '0')); set('otTime', String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0'));
    set('otBpr', ed.bpr); set('otRounds', Math.max(1, Math.round((ed.b || 18) / (ed.bpr || 3)))); set('otMov', ed.mov || 'howell');
    const t = OT.list && OT.list[OT.edit], run = t && t.run && t.run[otNext(ed)];
    if (run && run.plan) {
      for (const id of ['otDay', 'otTime', 'otRounds', 'otBpr', 'otMov']) { const e = document.getElementById(id); if (e) e.disabled = true; }
      const e = document.getElementById('otTime'), note = document.createElement('div');
      note.style.cssText = 'font-size:0.75rem;color:var(--gold);margin:4px 0;'; note.innerHTML = '🟢 <span>The tournament is under way: the day, the time, the boards and the movement stay as they are (the tables already made); the other changes are saved without starting again.</span>';
      if (e) e.closest('.field-row').after(note);
    }
    const ck = (id, v) => { const e = document.getElementById(id); if (e) e.checked = !!v; }; ck('otRep', ed.rep); ck('otWatch', ed.watch);
    document.querySelectorAll('[data-otconv]').forEach(x => { x.checked = (ed.conv || []).includes(x.dataset.otconv); });
    otPreview();
  }, 0);
  return `<div class="field-row">
        <div class="field"><label>Boards per Round</label><input type="number" id="otBpr" value="3" min="1" max="8" oninput="otPreview()"></div>
        <div class="field"><label>Number of Rounds</label><input type="number" id="otRounds" value="6" min="1" max="20" oninput="otPreview()"><div style="font-size:0.72rem;color:var(--text3);margin-top:3px;" id="otCalc"></div></div>
      </div>
      <div class="field"><label>Movement</label><select id="otMov" onchange="otPreview()">${Object.entries(OT_MOV).map(([k, n]) => `<option value="${k}" ${k === 'howell' ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;">Mitchell: NS fixed, EW moves. Howell: everyone moves. Barometer: like Howell, but every table plays the same boards at the same time (one copy of the boards per table). Swiss: pairing is re-computed automatically after every round. In every movement the North-South pair of table 1 stays seated (e.g. for a player in a wheelchair).</div>
        <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;">The pairs register in Bridge Table; an odd number of pairs gets a robot pair, a pair can also play with a robot partner.</div></div>
      <div class="field"><label>Scoring</label><select id="otSc" onchange="otPreview()"><option value="both">IMP - MP</option></select></div>
      <div style="margin:12px 0 4px;padding-top:10px;border-top:1px solid var(--border);font-size:0.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">🌐 <span>Online (from home)</span></div>
      <div class="field"><label>Base system</label><select id="otSys" onchange="otPreview()">${M.systems.map(s => `<option value="${s.k}">${cleanData(s.n)}</option>`).join('')}</select></div>
      <div style="font-size:0.78rem;color:var(--text2);margin:6px 0 2px;">Conventions everyone plays (the robots too):</div>
      <div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:6px;">${M.convs.filter(x => x.basic).map(x => `<label style="display:block;"><input type="checkbox" data-otconv="${x.k}" onchange="otPreview()"> ${cleanData(x.n)}</label>`).join('')}${M.convs.filter(x => !x.basic).map(x => `<label style="display:block;"><input type="checkbox" data-otconv="${x.k}" onchange="otPreview()"> ${cleanData(x.n)}</label>`).join('')}</div>
      <div class="field"><label>Name</label><input id="otName" maxlength="60" placeholder="Empty: the system and the conventions" oninput="otPreview()"></div>
      <div class="field-row"><div class="field"><label>Day</label><input id="otDay" type="date" value="${ymd}" onchange="otPreview()"></div><div class="field"><label>Start time</label><input id="otTime" type="time" value="19:00" onchange="otPreview()"></div></div>
      <label style="display:block;margin:6px 0;"><input id="otRep" type="checkbox" onchange="otPreview()"> 🔁 <span>Every week at this time</span></label>
      <label style="display:block;margin:6px 0;"><input id="otWatch" type="checkbox" checked> 👁 <span>Spectator mode: players may watch the tables</span></label>
      <div id="otPrev" class="card" style="margin:8px 0;background:var(--bg3,rgba(0,0,0,.05));"></div>
      <button class="btn btn-gold btn-full" style="margin-top:6px;" onclick="otSave()">${ed ? '💾 <span>Save the changes</span>' : '🚀 <span>Create Tournament</span>'}</button>`;
}
// the form read: what the tournament will be called and how it is played
function otRead() {
  const v = id => (document.getElementById(id) || {}).value || '', M = OT.meta || { systems: [], convs: [] };
  const conv = [...document.querySelectorAll('[data-otconv]')].filter(x => x.checked).map(x => x.dataset.otconv);
  const sysN = ((M.systems.find(x => x.k === v('otSys')) || {}).n || v('otSys')).replace(/ \(.*\)$/, '');
  const auto = sysN + (conv.length ? ' · ' + conv.map(k => (M.convs.find(x => x.k === k) || {}).n || k).join(', ') : '');
  return { n: (v('otName').trim() || auto).slice(0, 60), at: Date.parse(v('otDay') + 'T' + (v('otTime') || '19:00')), bpr: Math.min(8, Math.max(1, +v('otBpr') || 3)), b: Math.min(8, Math.max(1, +v('otBpr') || 3)) * Math.min(20, Math.max(1, +v('otRounds') || 6)),
    sc: 'both', sys: v('otSys') || 'sayc', conv, mov: OT_MOV[v('otMov')] ? v('otMov') : 'howell', rep: (document.getElementById('otRep') || {}).checked ? 1 : 0, watch: (document.getElementById('otWatch') || {}).checked ? 1 : 0, sysN };
}
// the line shown before saving: "SAYC · RKCB 0314, Stayman · Sat 14 Nov 20:00 / 18 boards · 3 boards a round · MP · Howell"
window.otPreview = function () {
  const el = document.getElementById('otPrev'); if (!el) return;
  const i = otRead(), M = OT.meta || { convs: [] }, c = document.getElementById('otCalc');
  if (c) c.textContent = '→ ' + i.bpr + ' × ' + (i.b / i.bpr) + ' = ' + i.b + ' ' + (window.i18nText ? i18nText('boards') : 'boards');
  el.innerHTML = `<b>${cleanData(i.n)}</b>${i.at ? ' · ' + otWhen(i.at) : ''}${i.rep ? ' · 🔁' : ''}<div style="font-size:0.8rem;">${i.b} <span>boards</span> · ${i.bpr} <span>boards a round</span> · ${(i.sc === 'imp' ? 'IMP' : i.sc === 'both' ? 'IMP - MP' : 'MP')} · ${cleanData(i.sysN)}${i.conv.length ? ' · ' + i.conv.map(k => cleanData((M.convs.find(x => x.k === k) || {}).n || k)).join(', ') : ''} · ${cleanData(OT_MOV[i.mov].split(' — ')[0])}</div>`;
};
// Tournament Setup with 🌐 Online chosen: the online tournament's form in place of the club room's
let setupOnline = false;
window.setSetupOnline = function (on) { setupOnline = !!on; OT.edit = null; otRerender(); };
// the whole setup drawn again (the form too): another tournament to change, saved, cancelled
function otRerender() { OT.force = true; renderAdminTab(); }
// only the tournaments' list above the form (registrations, live state)
async function otManageRefresh() {
  const m = document.getElementById('otManage'); if (!m) return;
  if (m.querySelector('[id^=otpf-] input')) return;   // a pair being changed there
  await otLoad(); m.innerHTML = otManageHtml(OT.meta || { systems: [], convs: [] });
}
const otRefresh = () => { if (adminTab === 'setup' && setupOnline) renderAdminTab(); };
// Tournament Setup with "Online (from home)": the club's online tournaments (to change, start now, players), then the form
function otSetupCard() {
  setTimeout(async () => {
    await Promise.all([otLoad(), otMeta()]);
    const box = document.getElementById('otSetupBox'); if (!box) return;
    const M = OT.meta || { systems: [{ k: 'sayc', n: 'SAYC' }], convs: [] }, ed = OT.edit && OT.list && OT.list[OT.edit] && OT.list[OT.edit].info;
    box.innerHTML = `<div id="otManage">${otManageHtml(M)}</div>` + (typeof isSuper === 'function' && isSuper() && !ed ? `<div class="card"><button class="btn btn-sm" onclick="otTestRobots()">🧪 <span>Test tournament with robots</span></button> <small style="color:var(--text3);">Servet</small></div>` : '') + `<div class="card" id="otFormBox"><div class="card-title">${ed ? '✏️ <span>Change the tournament</span>' : '<span>⚙️</span> <span>Tournament Setup</span>'}</div>${otFormHtml(M, ed)}${ed ? '<button class="btn btn-sm" style="margin-top:6px;" onclick="setSetupOnline(true)">✖ <span>Cancel</span></button>' : ''}</div>`;
    otPreview();
    clearTimeout(OT.liveT); OT.liveT = setTimeout(function again() { if (!(adminTab === 'setup' && setupOnline)) return; otManageRefresh(); OT.liveT = setTimeout(again, 20000); }, 20000);   // only the list above the form   // new registrations and the live state, every 20 seconds
  }, 0);
  return `<div class="card"><div class="card-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span>⚙️</span> Tournament Setup
      <span style="margin-left:auto;display:flex;gap:6px;"><button class="btn btn-sm" onclick="setSetupOnline(false)">🏛 <span>At the club</span></button><button class="btn btn-sm btn-gold" disabled>🌐 <span>Online (from home)</span></button></span></div>
    <div style="font-size:0.78rem;color:var(--text2);margin-bottom:8px;">Played in Bridge Table: pairs against each other, each at home. Players register as pairs in Bridge Table and see the tournament there and here before it starts.</div></div>
    <div id="otSetupBox">⏳</div>`;
}
// the state of an evening: each round's tables with the boards finished there
function otLiveHtml(t, d) {
  const run = t.run && t.run[d], P = run && run.plan && (otP() ? otP().ctFill(run.plan, run.t) : run.plan); if (!P) return '';
  const T_ = run.t || {}, done = (r, ti) => Object.values((T_[r + '_' + ti] || {}).res || {}).filter(Boolean).length;
  const cur = P.rounds.findIndex((tb, r) => tb.some((x, ti) => done(r, ti) < P.bpr));
  const pn = p => p.robot ? '🤖' : cleanData(p.a) + ' – ' + cleanData(p.b);
  return `<div style="margin-top:6px;font-size:0.8rem;"><b>🟢 <span>Live</span></b> · ${cur < 0 ? '🏁 <span>Finished</span>' : '<span>Round</span> ' + (cur + 1) + '/' + P.rounds.length}
    ${P.rounds.map((tb, r) => r < Math.max(0, cur) - 1 || (cur >= 0 && r > cur) ? '' : `<div style="margin-top:4px;"><span>Round</span> ${r + 1}: ${tb.map(([a, b], ti) => { const n = done(r, ti); return `<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 6px;border-radius:6px;background:${n >= P.bpr ? 'rgba(31,122,46,.18)' : 'rgba(212,160,23,.2)'};"><span>Table</span> ${ti + 1}: ${pn(P.pairs[a])} / ${pn(P.pairs[b])} · ${n}/${P.bpr}</span>`; }).join('')}</div>`).join('')}</div>`;
}
// the tournaments: what is played, the pairs (change a player, remove, add), the partner search, live, and the buttons
function otManageHtml(M) {
  const L = Object.entries(OT.list || {}).filter(([, t]) => t && t.info).sort((a, b) => otNext(a[1].info) - otNext(b[1].info));
  if (!L.length) return '';
  return L.map(([id, t]) => {
    const i = t.info, d = otNext(i), started = !!(t.run && t.run[d] && t.run[d].plan);
    const P = Object.entries(t.pairs || {}).filter(([, p]) => p && p.d === d), S = Object.entries(t.seek || {}).filter(([, p]) => p && p.d === d);
    return `<div class="card"><b>🌐 ${cleanData(i.n)}</b> <small>· ${otWhen(d)}${i.rep ? ' · 🔁 <span>every week</span>' : ''}${started ? ' · 🟢 <span>Started</span>' : ''}</small>
      <div style="font-size:0.78rem;color:var(--text2);">${i.b} <span>boards</span> · ${i.bpr} <span>boards a round</span> · ${(i.sc === 'imp' ? 'IMP' : i.sc === 'both' ? 'IMP - MP' : 'MP')} · ${cleanData((M.systems.find(x => x.k === i.sys) || {}).n || i.sys)}${(i.conv || []).length ? ' · ' + (i.conv || []).map(k => cleanData((M.convs.find(x => x.k === k) || {}).n || k)).join(', ') : ''} · ${cleanData((OT_MOV[i.mov] || OT_MOV.howell).split(' — ')[0])}${i.watch ? ' · 👁' : ''}</div>
      <div style="margin-top:6px;"><b>${P.length}</b> <span>pairs registered</span></div>
      ${P.map(([pid, p], k) => `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;" id="otp-${id}-${pid}">${k + 1}. ${cleanData(p.a)} – ${cleanData(p.b)} <button class="btn btn-sm" onclick="otPairForm('${id}','${pid}')">✏️</button>${started ? '' : `<button class="btn btn-sm btn-red" onclick="otPairDel('${id}','${pid}')">🗑</button>`}</div>`).join('')}
      ${started ? '' : `<div style="margin-top:4px;"><button class="btn btn-sm" onclick="otPairForm('${id}','')">➕ <span>Add a pair</span></button></div>`}<div id="otpf-${id}"></div>
      ${S.length ? `<div style="margin-top:4px;">🔎 <span>Looking for a partner</span>: ${S.map(([k, p]) => `<label style="margin-right:8px;"><input type="checkbox" data-otseek="${id}|${cleanData(k)}|${cleanData(p.n)}"> ${cleanData(p.n)}</label>`).join('')}<button class="btn btn-sm" onclick="otPairUp('${id}',${d})">🤝 <span>Pair the two ticked</span></button></div>` : ''}
      ${otLiveHtml(t, d)}
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${started ? '' : `<button class="btn btn-sm btn-gold" onclick="otStartNow('${id}')">▶ <span>Start now</span></button>`}<button class="btn btn-sm" onclick="otEdit('${id}')">✏️ <span>Change</span></button>${started ? `<button class="btn btn-sm btn-gold" onclick="otOpenRes('${id}',${d},'live')">👁 <span>Watch</span></button>` : ''}${started && typeof isSuper === 'function' && isSuper() && !(t.run[d].bot && Date.now() - t.run[d].bot < 120e3) ? `<a class="btn btn-sm" href="https://github.com/Servetsvm/bridge/actions/workflows/clubs.yml" target="_blank" rel="noopener">🤖 <span>Start the server robots</span></a>` : ''}<button class="btn btn-sm" onclick="otResults('${id}')">📊 <span>Results</span></button><button class="btn btn-sm" onclick="otRefresh()">🔄</button><button class="btn btn-sm btn-red" onclick="otDelete('${id}')">🗑 <span>Delete</span></button></div></div>`;
  }).join('');
}
window.otEdit = function (id) { OT.edit = id; otRerender(); setTimeout(() => { const f = document.getElementById('otSys'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); };
const otPut = async (p, v, m) => { const r = await fetch(await otUrl(p), { method: m || 'PUT', headers: { 'Content-Type': 'application/json' }, body: v === undefined ? undefined : JSON.stringify(v) }); if (!r.ok) throw new Error(r.status); };
// the registrations of the occurrence old go to the occurrence nw (a new day or time, or started now)
async function otMove(id, old, nw) {
  if (old === nw) return; const t = (OT.list || {})[id] || {};
  for (const [pid, p] of Object.entries(t.pairs || {})) if (p && p.d === old) await otPut('/' + id + '/pairs/' + pid + '/d', nw);
  for (const [k, p] of Object.entries(t.seek || {})) if (p && p.d === old) await otPut('/' + id + '/seek/' + encodeURIComponent(k) + '/d', nw);
}
window.otSave = async function () {
  if (OT.busy) return;
  const f = otRead(), { n } = f, ed = OT.edit && OT.list && OT.list[OT.edit];
  const run0 = ed && ed.run && ed.run[otNext(ed.info)], started = !!(run0 && run0.plan);
  // under way: the start stays as it is; the same day and minute as before: the start to the second kept too
  const at = ed && (started || Math.floor(f.at / 6e4) === Math.floor(otNext(ed.info) / 6e4)) ? ed.info.at : f.at;
  if (!at || (!ed && at < Date.now())) { toast('❌ The start must be in the future'); return; }
  const info = { ...(ed ? ed.info : {}), n, at, b: f.b, bpr: f.bpr, sc: f.sc, sys: f.sys, conv: f.conv, mov: f.mov, rep: f.rep, watch: f.watch,
    st: ed ? ed.info.st || 'reg' : 'reg', cn: String(CLUB_NAME || '').slice(0, 40), by: String((me() || {}).name || '').slice(0, 20), ts: ed ? ed.info.ts || Date.now() : Date.now() };
  OT.busy = true;
  try {
    const id = OT.edit || Date.now().toString(36), old = ed ? otNext(ed.info) : 0;
    await otPut('/' + id + '/info', info);
    if (ed) await otMove(id, old, otNext(info));   // the pairs registered stay registered at the new time
    toast('✅ Saved'); OT.edit = null; otRerender();
  } catch (e) { toast('❌ Could not save'); } finally { OT.busy = false; }
};
// start now: the start is set to now and the evening's plan is made at once (from the pairs registered)
window.otStartNow = async function (id) {
  const t = (OT.list || {})[id]; if (!t || !await otAsk(otL('Start the tournament now?'))) return;
  const old = otNext(t.info), nw = Date.now() - 1000, P = otP();
  try {
    await otPut('/' + id + '/info/at', nw);
    await otMove(id, old, nw);
    if (P) {
      const pairs = Object.entries(t.pairs || {}).filter(([, p]) => p && p.d === old).map(([pid, p]) => ({ pid, ...p, d: nw }));
      const plan = pairs.length ? P.ctMakePlan({ id, d: nw, i: { ...t.info, at: nw }, pairs }) : null;
      if (plan) await otPut('/' + id + '/run/' + nw, plan, 'PATCH');
    }
    toast('▶ Started'); renderAdminTab(); if (P && P.ctLoad) P.ctLoad(true);
  } catch (e) { toast('❌ Could not start'); }
};
window.otDelete = async function (id) {
  if (!await otAsk(otL('Delete this online tournament with its registrations?'))) return;
  try { await otPut('/' + id, undefined, 'DELETE'); toast('🗑'); OT.edit = null; renderAdminTab(); } catch (e) { toast('❌ Could not delete'); }
};
// a player's key as Bridge Table keeps it (a robot partner has none)
const otKey = n => /^robot$/i.test(String(n).trim()) ? '' : (otP() && otP().Net && otP().Net.ruleKey ? otP().Net.ruleKey(n) : String(n).trim().toLowerCase());
// a pair: its two players (to add one, or to change a player — once started, the new player takes the seats)
window.otPairForm = function (id, pid) {
  const t = (OT.list || {})[id], p = pid && t.pairs[pid], box = document.getElementById('otpf-' + id); if (!box) return;
  box.innerHTML = `<div class="field-row" style="margin-top:6px;"><div class="field"><label>1</label><input id="otpa-${id}" maxlength="20" value="${p ? cleanData(p.a) : ''}"></div><div class="field"><label>2</label><input id="otpb-${id}" maxlength="20" value="${p ? cleanData(p.b) : ''}" placeholder="Robot"></div></div>
    <div style="font-size:0.72rem;color:var(--text3);">The players' names in Bridge Table (Robot for a robot partner).</div>
    <button class="btn btn-sm btn-gold" onclick="otPairSave('${id}','${pid || ''}')">💾 <span>Save</span></button> <button class="btn btn-sm" onclick="document.getElementById('otpf-${id}').innerHTML=''">✖</button>`;
};
window.otPairSave = async function (id, pid) {
  const t = (OT.list || {})[id], d = otNext(t.info), A = (document.getElementById('otpa-' + id).value || '').trim().slice(0, 20), Bn = (document.getElementById('otpb-' + id).value || '').trim().slice(0, 20) || 'Robot';
  if (!A) { toast('❌ Name'); return; }
  const old = pid && t.pairs[pid], np = { a: A, b: Bn, ka: otKey(A), kb: otKey(Bn), d, ts: old ? old.ts || Date.now() : Date.now() };
  try {
    await otPut('/' + id + '/pairs/' + (pid || Date.now().toString(36)), np);
    // started: the plan's pair gets the new players, and they may write at every table that pair plays
    const run = t.run && t.run[d];
    if (old && run && run.plan) {
      const k = run.plan.pairs.findIndex(q => q.ka === old.ka && q.kb === old.kb && !q.robot);
      if (k >= 0) {
        await otPut('/' + id + '/run/' + d + '/plan/pairs/' + k, { a: np.a, b: np.b, ka: np.ka, kb: np.kb });
        const add = {}; (run.plan.mov === 'swiss' ? [...Array(run.plan.nr || 1).keys()].map(r => run.plan.rounds[0]) : run.plan.rounds).forEach((tb, r) => tb.forEach(([x, y], ti) => { if (run.plan.mov === 'swiss' || x === k || y === k) { add[r + '_' + ti] = {}; for (const key of [np.ka, np.kb]) if (key) add[r + '_' + ti][key] = 1; } }));
        for (const [tbl, ks] of Object.entries(add)) if (Object.keys(ks).length) await otPut('/' + id + '/run/' + d + '/m/' + tbl, ks, 'PATCH');
      }
    }
    toast('✅ ' + A + ' – ' + Bn); renderAdminTab();
  } catch (e) { toast('❌ Could not save'); }
};
window.otPairDel = async function (id, pid) {
  const p = ((OT.list || {})[id] || {}).pairs[pid]; if (!p || !await otAsk(otL('Remove this pair?') + '<br><b>' + cleanData(p.a) + ' – ' + cleanData(p.b) + '</b>')) return;
  try { await otPut('/' + id + '/pairs/' + pid, undefined, 'DELETE'); renderAdminTab(); } catch (e) { toast('❌'); }
};
// two players looking for a partner become a pair
window.otPairUp = async function (id, d) {
  const S = [...document.querySelectorAll('[data-otseek^="' + id + '|"]')].filter(x => x.checked).map(x => x.dataset.otseek.split('|'));
  if (S.length !== 2) { toast('❌ Tick two players'); return; }
  const [[, ka, a], [, kb, b]] = S;
  try {
    await otPut('/' + id + '/pairs/' + Date.now().toString(36), { a, b, ka, kb, d, ts: Date.now() });
    for (const k of [ka, kb]) await otPut('/' + id + '/seek/' + encodeURIComponent(k), undefined, 'DELETE');
    toast('🤝 ' + a + ' – ' + b); renderAdminTab();
  } catch (e) { toast('❌ Could not pair'); }
};
// the club gate (players): the online tournaments of every club coming up, with the pairs registered
async function otUpcomingHtml() {
  let all = {};
  try { const token = await authToken(); const r = await fetch(otRoot() + '/ot.json' + (token ? '?auth=' + token : ''), { cache: 'no-store' }); all = r.ok ? (await r.json()) || {} : {}; } catch (e) {}
  const L = [];
  for (const [club, T] of Object.entries(all)) for (const [id, t] of Object.entries(T || {})) {
    if (!t || !t.info) continue; const d = otNext(t.info); if (d + 4 * 3600e3 < Date.now() || d - Date.now() > 14 * 864e5) continue;
    L.push({ club, id, i: t.info, d, n: Object.values(t.pairs || {}).filter(p => p && p.d === d).length });
  }
  if (!L.length) return '';
  L.sort((a, b) => a.d - b.d);
  return `<div style="font-size:0.72rem;color:var(--text3);margin:8px 0 4px;">🌐 Online club tournaments</div>` + L.map(x => `<div class="bg-entry" style="padding:8px 10px;"><b>🏛 ${cleanData(x.i.cn || x.club)} — ${cleanData(x.i.n)}</b><div style="font-size:0.78rem;">${otWhen(x.d)} · ${x.n} <span>pairs registered</span>${x.i.rep ? ' · 🔁' : ''}</div><div style="font-size:0.72rem;color:var(--text3);">Register as a pair on Bridge Table's home page.</div></div>`).join('');
}

// the results, double dummy, rating and watching are worked out by Bridge Table (the page the clubs program runs in)
window.otResults = function (id) {
  const P = window.parent; if (!P || P === window || typeof P.ctShowResults !== 'function') { toast('❌'); return; }
  P.CT.adminView = true;   // the director may always watch
  P.ctLoad(true).then(() => { if (typeof P.closeClubs === 'function') P.closeClubs(); P.ctShowResults(CLUB_ID, id); });
};


/* ---- the other admin tabs for the online tournaments (Movement, Tables, Boards, History, Log) ----
   The plan, the scores and the double dummy are Bridge Table's own (the page the clubs program runs in). */
const otP = () => (window.parent && window.parent !== window && typeof window.parent.ctScore === 'function') ? window.parent : null;
// the evenings of this club: started ones (with their plan) newest first, and the next one coming up
function otEvenings() {
  const out = [];
  for (const [id, t] of Object.entries(OT.list || {})) {
    if (!t || !t.info) continue;
    for (const [d, run] of Object.entries(t.run || {})) if (run && run.plan) out.push({ id, d: +d, i: t.info, plan: otP() ? otP().ctFill(run.plan, run.t) : run.plan, run, t });
  }
  return out.sort((a, b) => b.d - a.d);
}
function otComing() {
  const L = Object.entries(OT.list || {}).filter(([, t]) => t && t.info).map(([id, t]) => ({ id, t, i: t.info, d: otNext(t.info) })).filter(x => !(x.t.run && x.t.run[x.d]) && x.d - Date.now() < 14 * 864e5 && x.d + 4 * 3600e3 > Date.now());
  return L.sort((a, b) => a.d - b.d)[0] || null;
}
const otPn = p => p.robot ? '🤖 Robot' : cleanData(p.a) + ' – ' + cleanData(p.b);
let otCss = false;
function otStyle() {   // the hands and the double dummy table as Bridge Table draws them
  if (otCss) return; otCss = true;
  const st = document.createElement('style');
  st.textContent = '.otbox table{border-collapse:collapse;margin:4px 0}.otbox td,.otbox th{border:1px solid var(--border);padding:2px 6px;font-size:.8rem;text-align:center}.otbox .deal{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:.78rem;margin:6px 0}.otbox .deal .h.n{grid-column:2}.otbox .deal .h.w{grid-column:1;grid-row:2}.otbox .deal .h.e{grid-column:3;grid-row:2}.otbox .deal .h.s{grid-column:2;grid-row:3}.otbox .red,.otbox .rd{color:#c4122f}.otbox .gm{font-weight:700}';
  document.head.appendChild(st);
}
function otTabSlot(tab) {
  setTimeout(async () => { await otLoad(); const box = document.getElementById('otTabBox'); if (box && adminTab === tab) box.innerHTML = otTabHtml(tab); otStyle(); }, 0);
  return '<div id="otTabBox" class="otbox"></div>';
}
function otTabHtml(tab) {
  const P = otP(), E = otEvenings(), cur = E[0], come = otComing();
  if (!E.length && !come) return '';
  const head = x => `<div class="card-title">🌐 ${cleanData(x.i.n)} <small>· ${otWhen(x.d)}</small></div>`;
  if (!cur) return `<div class="card">${head(come)}<div style="color:var(--text3);">Starts ${otWhen(come.d)}.</div></div>`;
  if (tab === 'tables') return `<div class="card">${head(cur)}${otLiveHtml(cur.t, cur.d)}${otPresenceHtml(cur)}${P ? `<div style="margin-top:6px;"><button class="btn btn-sm" onclick="otOpenRes('${cur.id}',${cur.d},'live')">👁 <span>Watch</span></button></div>` : ''}</div>`;
  return '';
}
// the full results (ranking, boards, rating, watching) in Bridge Table
window.otOpenRes = function (id, d, tab) {
  const P = otP(); if (!P) return;
  P.CT.adminView = true;
  P.ctLoad(true).then(() => { if (typeof P.closeClubs === 'function') P.closeClubs(); P.ctShowResults(CLUB_ID, id, d, tab); });
};

// the players of the evening: here (their app in the last 90 seconds) or away (the robot plays for them)
function otPresenceHtml(x) {
  const hb = (x.run && x.run.hb) || {}, now = Date.now(), L = [];
  for (const p of x.plan.pairs) if (!p.robot) for (const [n, k] of [[p.a, p.ka], [p.b, p.kb]]) if (k) { const ts = +hb[k] || 0; L.push({ n, on: now - ts < 90e3, ts }); }
  const bot = x.run && +x.run.bot, botTxt = bot ? '<div style="margin-top:4px;">🤖 <span>Server robots</span>: ' + (now - bot < 120e3 ? '🟢 ' : '⚪ ') + new Date(bot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>' : '';
  if (!L.length) return botTxt;
  return botTxt + '<div style="margin-top:8px;font-size:0.8rem;"><b><span>Players</span></b>' + L.map(p => '<div>' + (p.on ? '🟢 ' : '🔴 ') + cleanData(p.n) + (p.on ? '' : ' · <span>away: the robot plays for them</span>' + (p.ts ? ' · <span>last seen</span> ' + new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')) + '</div>').join('') + '</div>';
}
// a board of the online evening in the club's list of boards (key table_round_board): its bidding and play, or its
// double dummy, in a pop-up
async function otClubBoard(key) {
  const st = getState(), o = st.online, P = otP(); if (!o || !P) return null;
  if (!OT.list || !OT.list[o.tid]) await otLoad();
  const t = (OT.list || {})[o.tid], run = t && t.run && t.run[o.d]; if (!run || !run.plan) return null;
  const r = await fetch(await otUrl('/' + o.tid + '/run/' + o.d + '/t'), { cache: 'no-store' }), tmap = r.ok ? (await r.json()) || {} : {};
  const [tb, rd, bn] = key.split('_').map(Number);
  return { P, plan: P.ctFill(run.plan, tmap), list: (tmap[(rd - 1) + '_' + (tb - 1)] || {}).a, r: rd - 1, bn };
}
const otPop = (title, html) => { otStyle(); openModal(title, '<div class="otbox" style="overflow-x:auto;">' + html + '</div>', '<button class="btn btn-gold" onclick="closeModal()">' + otL('OK') + '</button>'); };
window.otClubPlay = async function (key) {
  const x = await otClubBoard(key); if (!x) return;
  otPop('👁 ' + otL('Bidding and play'), x.P.ctPlayHtml(x.plan, x.r, x.list, x.bn));
};
window.otClubDD = async function (key) {
  const x = await otClubBoard(key); if (!x) return;
  otPop('🎯 ' + otL('Board') + ' ' + x.bn, '⏳'); setTimeout(() => { const m = document.getElementById('modalBody'); if (m) m.innerHTML = '<div class="otbox" style="overflow-x:auto;">' + x.P.ctDDHtml(x.plan, x.bn) + '</div>'; }, 30);
};

/* the director's page open: every table of a running evening where nobody sits is played on by its robots from here
   (one call or card at a time; written only where nothing is yet, so a player's own app is never overwritten) */
OT.headBusy = false;
async function otRobots() {
  const P = otP(); if (OT.headBusy || !P || !P.ctHeadStep || !document.getElementById('adminContent')) return;
  await otFresh(); if (!OT.list) return;
  OT.headBusy = true;
  try {
    for (const [id, t] of Object.entries(OT.list)) {
      if (!t || !t.info) continue;
      for (const [d, run] of Object.entries(t.run || {})) {
        if (!run || !run.plan || Date.now() - +d > 6 * 3600e3 || +d > Date.now()) continue;
        const base = '/' + id + '/run/' + d, get = async q => { const r = await fetch(await otUrl(base + q), { cache: 'no-store' }); return r.ok ? r.json() : null; };
        const tmap = await get('/t') || {}, plan = P.ctFill(run.plan, tmap), r = P.ctCurRound(plan, tmap); if (r < 0) continue;
        const hb = await get('/hb') || {};
        for (let ti = 0; ti < plan.rounds[r].length; ti++) {
          if (!P.ctTableEmpty(plan, r, ti, hb)) continue;
          const tb = tmap[r + '_' + ti] || {}, st = P.ctHeadStep(plan, r, tb.a, tb.res); if (!st) continue;
          const q = base + '/t/' + r + '_' + ti + (st.res ? '/res/' + st.res : '/a/' + st.n);
          if (await get(q.slice(base.length)) != null) continue;   // written meanwhile by another app: the next look reads it
          await fetch(await otUrl(q), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(st.v || st.a) });
          // one step at each table, every table at once
        }
      }
    }
  } catch (e) {} finally { OT.headBusy = false; }
}
setInterval(otRobots, 1500);

/* Servet's test: an online tournament started now where every seat is a robot (made-up names); the robots play it
   from this page (and the GitHub run), so the whole evening can be watched and its results looked at */
window.otTestRobots = async function () {
  const P = otP(); if (!P || !await otAsk(otL('Start a test tournament with 4 robot pairs now?'))) return;
  const N = ['Ingrid', 'Lars', 'Sofia', 'Mateo', 'Yuki', 'Omar', 'Elif', 'Jonas', 'Chloé', 'Viktor', 'Ananya', 'Kenji', 'Hanna', 'Karim', 'Amara', 'Felix', 'Leila', 'Tomás', 'Mei', 'Pavel'].sort(() => Math.random() - 0.5);
  const id = Date.now().toString(36), at = Date.now() - 1000, f = otRead();
  const info = { n: '🧪 Test · ' + f.sysN, at, b: f.b, bpr: f.bpr, sc: 'both', sys: f.sys, conv: f.conv, mov: f.mov, rep: 0, watch: 1, test: 1, st: 'reg', cn: String(CLUB_NAME || '').slice(0, 40), by: String((me() || {}).name || '').slice(0, 20), ts: at };
  const pairs = [0, 1, 2, 3].map(k => ({ pid: 'r' + k, a: N[2 * k] + ' 🤖', b: N[2 * k + 1] + ' 🤖', ka: '', kb: '', d: at, ts: at + k }));
  try {
    await otPut('/' + id + '/info', info);
    for (const p of pairs) { const { pid, ...v } = p; await otPut('/' + id + '/pairs/' + pid, v); }
    const plan = P.ctMakePlan({ id, d: at, i: info, pairs });
    await otPut('/' + id + '/run/' + at, plan, 'PATCH');
    toast('🧪 ' + info.n); await otLoad(); otRerender();
  } catch (e) { toast('❌ Could not start'); }
};

// a question on our own page (in the page's language), not the browser's box: true for Yes
const otL = v => window.i18nText ? i18nText(v) : v;
function otAsk(msg) {
  return new Promise(res => {
    window._otAns = v => { closeModal(); res(v); };
    openModal('⚠️ ' + otL('Are you sure?'), '<div style="font-size:1rem;line-height:1.5;">' + msg + '</div>',
      '<button class="btn btn-gold" onclick="_otAns(true)">' + otL('Yes') + '</button> <button class="btn" onclick="_otAns(false)">' + otL('Cancel') + '</button>');
  });
}

/* the online evening is the club's tournament: its pairs, tables, finished boards and hands written into the club's own
   data every few seconds while the director's page is open (the GitHub run does the same when it is closed), so
   Players, Movement, Tables, Boards, History, Log, the screen and PBN show it as a tournament at the club; a score the
   director corrects in Boards goes back to the evening (its ranking in Bridge Table); at its end it is archived */
OT.mirBusy = false;
async function otMirror() {
  const P = otP(); if (OT.mirBusy || !P || !P.ctMirror || typeof role === 'undefined' || role !== 'admin' || !CLUB_ID) return;
  await otFresh(); if (!OT.list) return;
  let best = null;
  for (const [id, t] of Object.entries(OT.list)) for (const [d, run] of Object.entries((t && t.run) || {})) if (run && run.plan && +d <= Date.now() && Date.now() - +d < 8 * 3600e3 && (!best || +d > best.d)) best = { id, d: +d, t, run };
  if (!best) return;
  OT.mirBusy = true;
  try {
    const base = '/' + best.id + '/run/' + best.d, r = await fetch(await otUrl(base + '/t'), { cache: 'no-store' }), tmap = r.ok ? (await r.json()) || {} : {};
    const plan = P.ctFill(best.run.plan, tmap), M = P.ctMirror(plan, best.t.info || {}, tmap, best.d, best.id); if (!M) return;
    const s = await DB.get('state') || {}, mine = !!(s.online && s.online.tid === best.id && +s.online.d === best.d);
    if (!mine && s.status === 'running') return;   // a tournament at the club is being played
    if (mine) {   // the director's corrections in Boards: to the evening too
      const cb = await DB.get('boards') || {}, SN = ['♣', '♦', '♥', '♠', 'NT'];
      for (const [k, v] of Object.entries(cb)) {
        if (!v || !(v.manualEdit || (v.adjusted && !v.online))) continue;
        const m = M.boards[k]; if (m && m.nsScore === v.nsScore) continue;
        const [ti, rr, bn] = k.split('_').map(Number);
        const o = v.level && SN.includes(v.suit) && 'NESW'.includes(v.declarer || '-') ? { c: [+v.level, SN.indexOf(v.suit), ['', 'X', 'XX'].indexOf(v.doubled || ''), 'NESW'.indexOf(v.declarer)], tr: +v.level + 6 + (+v.result || 0), ns: +v.nsScore || 0, adj: 1 } : v.contract === 'PASS' ? { pass: 1, ns: 0, adj: 1 } : { ns: +v.nsScore || 0, adj: 1 };
        await otPut(base + '/t/' + (rr - 1) + '_' + (ti - 1) + '/res/' + bn, o);
        M.boards[k] = { ...v };
      }
    }
    const same = (k, v) => JSON.stringify(_cache[k]) === JSON.stringify(v);
    if (!mine) { await DB.set('approvals', {}); await DB.set('tableLocks', {}); await DB.set('dd', {}); addLog('ok', '🌐 Online evening', M.state.name); }
    for (const k of ['pairs', 'movements', 'boards', 'hands']) if (!same(k, M[k])) await DB.set(k, M[k]);
    const ns = mine ? { ...s, ...M.state } : M.state, wasDone = mine && s.status === 'finished';
    if (!same('state', ns)) await DB.set('state', ns);
    if (M.state.status === 'finished' && !wasDone) {   // the evening is over: in History like a tournament at the club
      const arc = await DB.get('archives') || [];
      if (!arc.some(a => a && a.state && a.state.online && a.state.online.tid === best.id && +a.state.online.d === best.d)) {
        arc.unshift({ state: { ...ns, _finishedAt: new Date().toISOString() }, boards: M.boards, pairs: M.pairs, movements: M.movements, hands: M.hands, dd: _cache['dd'] || {}, finished: new Date().toISOString() });
        await DB.set('archives', arc); addLog('ok', 'Tournament finished & archived', M.state.name);
      }
    }
    if (typeof refreshTopbar === 'function') refreshTopbar();
  } catch (e) {} finally { OT.mirBusy = false; }
}
setInterval(otMirror, 6000);
