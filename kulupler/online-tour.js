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
  try { const r = await fetch(await otUrl(''), { cache: 'no-store' }); OT.list = r.ok ? (await r.json()) || {} : {}; } catch (e) { OT.list = {}; }
}
// the systems and conventions, as the boards made automatically know them (kulupler/dealgen.js)
function otMeta() {
  if (OT.meta) return Promise.resolve(OT.meta);
  return new Promise(res => { let w; try { w = new Worker('dealgen.js'); } catch (e) { res(null); return; }
    w.onmessage = e => { if (e.data && e.data.meta) { OT.meta = e.data.meta; w.terminate(); res(OT.meta); } };
    w.postMessage({ meta: true }); setTimeout(() => res(OT.meta), 8000); });
}
async function renderOnlineAdmin() {
  const c = document.getElementById('adminContent'); if (!c) return;
  c.innerHTML = '<div class="card">⏳</div>';
  await Promise.all([otLoad(), otMeta()]);
  if (adminTab !== 'online') return;
  const M = OT.meta || { systems: [{ k: 'sayc', n: 'SAYC' }], convs: [] };
  const L = Object.entries(OT.list || {}).filter(([, t]) => t && t.info).sort((a, b) => otNext(a[1].info) - otNext(b[1].info));
  const pairsOf = (t, d) => Object.entries(t.pairs || {}).filter(([, p]) => p && p.d === d);
  const seekOf = (t, d) => Object.entries(t.seek || {}).filter(([, p]) => p && p.d === d);
  const d0 = new Date(Date.now() + 864e5), ymd = d0.toISOString().slice(0, 10);
  c.innerHTML = `<div class="card"><div class="card-title">🌐 <span>Online club tournaments</span></div>
    <div style="font-size:0.78rem;color:var(--text2);margin-bottom:8px;">Played in Bridge Table: pairs against each other, each at home. Players register as pairs in Bridge Table and see the tournament there and here before it starts.</div>
    ${L.length ? L.map(([id, t]) => { const i = t.info, d = otNext(i), P = pairsOf(t, d), S = seekOf(t, d);
      return `<div class="card" style="margin:8px 0;"><b>${cleanData(i.n)}</b> <small>· ${otWhen(d)}${i.rep ? ' · 🔁 <span>every week</span>' : ''}</small>
        <div style="font-size:0.78rem;color:var(--text2);">${i.b} <span>boards</span> · ${i.bpr} <span>boards a round</span> · ${i.sc === 'imp' ? 'IMP' : 'MP'} · ${cleanData((M.systems.find(s => s.k === i.sys) || {}).n || i.sys)}${(i.conv || []).length ? ' · ' + (i.conv || []).map(k => cleanData((M.convs.find(x => x.k === k) || {}).n || k)).join(', ') : ''}</div>
        <div style="margin-top:6px;"><b>${P.length}</b> <span>pairs registered</span>${P.length ? ': ' + P.map(([, p]) => cleanData(p.a) + ' – ' + cleanData(p.b)).join(' · ') : ''}</div>
        ${S.length ? `<div style="margin-top:4px;">🔎 <span>Looking for a partner</span>: ${S.map(([k, p]) => `<label style="margin-right:8px;"><input type="checkbox" data-otseek="${id}|${cleanData(k)}|${cleanData(p.n)}"> ${cleanData(p.n)}</label>`).join('')}<button class="btn btn-sm" onclick="otPairUp('${id}',${d})">🤝 <span>Pair the two ticked</span></button></div>` : ''}
        <div style="margin-top:6px;"><button class="btn btn-sm btn-red" onclick="otDelete('${id}')">🗑 <span>Delete</span></button></div></div>`; }).join('') : '<div style="color:var(--text3);">No online tournament yet.</div>'}
    </div>
    <div class="card"><div class="card-title">➕ <span>New online tournament</span></div>
      <div class="field"><label>Name</label><input id="otName" maxlength="60" placeholder="Club night"></div>
      <div class="field-row"><div class="field"><label>Day</label><input id="otDay" type="date" value="${ymd}"></div><div class="field"><label>Start time</label><input id="otTime" type="time" value="19:00"></div></div>
      <label style="display:block;margin:6px 0;"><input id="otRep" type="checkbox"> 🔁 <span>Every week at this time</span></label>
      <div class="field-row"><div class="field"><label>Boards</label><select id="otB">${[12, 16, 18, 20, 24, 27].map(n => `<option ${n === 18 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Boards a round</label><select id="otBpr">${[2, 3, 4].map(n => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Scoring</label><select id="otSc"><option value="mp">MP</option><option value="imp">IMP</option></select></div></div>
      <div class="field"><label>Base system</label><select id="otSys">${M.systems.map(s => `<option value="${s.k}">${cleanData(s.n)}</option>`).join('')}</select></div>
      <div style="font-size:0.78rem;color:var(--text2);margin:6px 0 2px;">Conventions everyone plays (the robots too):</div>
      <div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:6px;">${M.convs.filter(x => !x.basic).map(x => `<label style="display:block;"><input type="checkbox" data-otconv="${x.k}"> ${cleanData(x.n)}</label>`).join('')}</div>
      <button class="btn-primary" style="margin-top:10px;" onclick="otSave()">💾 <span>Save the tournament</span></button></div>`;
}
window.otSave = async function () {
  if (OT.busy) return;
  const v = id => (document.getElementById(id) || {}).value || '';
  const n = v('otName').trim().slice(0, 60), at = Date.parse(v('otDay') + 'T' + (v('otTime') || '19:00'));
  if (!n) { toast('❌ Name'); return; }
  if (!at || at < Date.now()) { toast('❌ The start must be in the future'); return; }
  const conv = [...document.querySelectorAll('[data-otconv]')].filter(x => x.checked).map(x => x.dataset.otconv);
  const info = { n, at, b: +v('otB') || 18, bpr: +v('otBpr') || 3, sc: v('otSc') === 'imp' ? 'imp' : 'mp', sys: v('otSys') || 'sayc', conv, rep: document.getElementById('otRep').checked ? 1 : 0,
    st: 'reg', cn: String(CLUB_NAME || '').slice(0, 40), by: String((me() || {}).name || '').slice(0, 20), ts: Date.now() };
  OT.busy = true;
  try {
    const id = Date.now().toString(36);
    const r = await fetch(await otUrl('/' + id + '/info'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(info) });
    if (!r.ok) throw new Error(r.status);
    toast('✅ Saved'); renderOnlineAdmin();
  } catch (e) { toast('❌ Could not save'); } finally { OT.busy = false; }
};
window.otDelete = async function (id) {
  if (!confirm('Delete this online tournament with its registrations?')) return;
  try { const r = await fetch(await otUrl('/' + id), { method: 'DELETE' }); if (!r.ok) throw new Error(r.status); toast('🗑'); renderOnlineAdmin(); } catch (e) { toast('❌ Could not delete'); }
};
// two players looking for a partner become a pair
window.otPairUp = async function (id, d) {
  const S = [...document.querySelectorAll('[data-otseek^="' + id + '|"]')].filter(x => x.checked).map(x => x.dataset.otseek.split('|'));
  if (S.length !== 2) { toast('❌ Tick two players'); return; }
  const [[, ka, a], [, kb, b]] = S;
  try {
    const pid = Date.now().toString(36);
    let r = await fetch(await otUrl('/' + id + '/pairs/' + pid), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, b, ka, kb, d, ts: Date.now() }) });
    if (!r.ok) throw new Error(r.status);
    for (const k of [ka, kb]) await fetch(await otUrl('/' + id + '/seek/' + encodeURIComponent(k)), { method: 'DELETE' });
    toast('🤝 ' + a + ' – ' + b); renderOnlineAdmin();
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
