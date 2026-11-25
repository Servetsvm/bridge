/* BridgePlay (new) — the start: the sign-in (the same name and PIN as BridgePlay; signed in already when the first
   BridgePlay is on this phone), the home page, the settings. */
import { T, LANGS, lang, setLang } from './i18n.js';
import { page, go, esc, $, toast, sheet, closeSheet, redraw } from './ui.js';
import { me, loadMe, saveMe, signOut, session, register, pinHash, onQueue, queued, flush } from './net.js';
import './clubs.js';
import './play.js';
import './table.js';
import './td.js';

// ---- the look: theme and large text (kept on the phone) ----
const pref = (k, d) => { try { return localStorage.getItem('bp2-' + k) || d; } catch (e) { return d; } };
const setPref = (k, v) => { try { localStorage.setItem('bp2-' + k, v); } catch (e) {} };
function applyLook() {
  const th = pref('theme', 'auto'); if (th === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
  document.documentElement.classList.toggle('big', pref('big', '0') === '1');
}
applyLook(); setLang(lang);

// ---- sign in / a new player ----
let gateMode = 'in';
page('gate', () => ({
  title: 'BridgePlay',
  html: `<div class="gate"><div class="logo">♠♥♦♣</div><h2>BridgePlay</h2><div class="muted">${T('Your name and PIN as in BridgePlay.')}</div>
    <div class="seg" style="margin-top:16px"><button class="${gateMode === 'in' ? 'on' : ''}" data-gm="in">${T('Sign in')}</button><button class="${gateMode === 'new' ? 'on' : ''}" data-gm="new">${T('New player')}</button></div>
    <form id="gForm" autocomplete="on">
      <label for="gName">${T('Name')}</label><input id="gName" maxlength="20" autocomplete="username" value="${esc(me.name)}">
      <label for="gPin">${T('PIN (4 digits)')}</label><input id="gPin" class="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" type="password" autocomplete="current-password">
      <div class="err" id="gErr"></div>
      <button class="btn gold" type="submit">${gateMode === 'in' ? T('Sign in') : T('Register')}</button>
    </form></div>`,
}));
document.addEventListener('click', e => { const b = e.target.closest('[data-gm]'); if (b) { gateMode = b.dataset.gm; redraw(); } });
document.addEventListener('submit', async e => {
  if (e.target.id !== 'gForm') return; e.preventDefault();
  const name = $('#gName').value.trim(), pin = $('#gPin').value.trim(), err = m => { $('#gErr').textContent = m; };
  if (!name) return err(T('Write your name.'));
  if (!/^\d{4}$/.test(pin)) return err(T('The PIN is 4 digits.'));
  err(''); const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  const h = await pinHash(name, pin);
  const r = gateMode === 'in' ? await session(name, h) : await register(name, h);
  btn.disabled = false;
  if (r === 'ok') { saveMe(name, h); go('home', null, true); toast(T('Signed in as {0}', name)); return; }
  err(r === 'pin' ? T('Wrong PIN for this name.') : r === 'nouser' ? T('No player with this name.') : r === 'taken' ? T('This name is taken.') : T('No connection. Try again.'));
});

// ---- home: three ways to play ----
page('home', () => ({
  title: 'BridgePlay',
  right: `<button class="tb-btn" data-settings aria-label="${T('Settings')}">⚙️</button>`,
  html: `<div class="hello"><span class="av">${esc((me.name || '?').trim()[0].toUpperCase())}</span><div><div class="muted">${T('Welcome back')}</div><b>${esc(me.name)}</b></div></div>
    <div class="tiles">
      <button class="tile primary" data-go="robots"><span class="ic">🤖</span><span><b>${T('Play with robots')}</b><small>SAYC · 2/1 · Acol · SEF · Precision · Polish</small></span></button>
      <button class="tile" data-go="clubs"><span class="ic">🏛</span><span><b>${T('Clubs')}</b><small>${T('Live')} · ${T('Results')} · ${T('Club info')}</small></span></button>
      <button class="tile soon" data-soon><span class="ic">🌐</span><span><b>${T('Online table')} · ${T('Lobby')}</b><small>${T('Coming soon')}</small></span></button>
    </div>
    <div class="beta">🧪 ${T('Beta: the new BridgePlay. Your name, PIN and results are the same as in BridgePlay.')}<br><a href="../">${T('The old BridgePlay')}</a></div>`,
}));
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
  if (e.target.closest('[data-soon]')) return toast(T('Coming soon'));
  if (e.target.closest('[data-settings]')) return settings();
});

// ---- settings: language, theme, large text, sign out ----
function settings() {
  sheet(`<h2>⚙️ ${T('Settings')}</h2>
    <div class="set"><span>🌐 ${T('Language')}</span><select id="sLang">${LANGS.map(([k, n]) => `<option value="${k}"${k === lang ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="set"><span>🌓 ${T('Theme')}</span><select id="sTheme">${[['auto', T('Auto')], ['dark', T('Dark')], ['light', T('Light')]].map(([k, n]) => `<option value="${k}"${k === pref('theme', 'auto') ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="set"><span>🔠 ${T('Large text')}</span><select id="sBig"><option value="0">${T('Off')}</option><option value="1"${pref('big', '0') === '1' ? ' selected' : ''}>${T('On')}</option></select></div>
    <div class="set"><span>👤 ${esc(me.name)}</span><button class="btn ghost" style="width:auto;min-height:40px" id="sOut">🚪 ${T('Sign out')}</button></div>`);
}
document.addEventListener('change', e => {
  if (e.target.id === 'sLang') { setLang(e.target.value); closeSheet(); redraw(); }
  if (e.target.id === 'sTheme') { setPref('theme', e.target.value); applyLook(); }
  if (e.target.id === 'sBig') { setPref('big', e.target.value); applyLook(); }
});
document.addEventListener('click', e => { if (e.target.id === 'sOut') { signOut(); closeSheet(); go('gate', null, true); } });

// ---- what still waits for the connection ----
function queueBadge(n) {
  let el = $('#queue'); if (!n) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'queue'; document.body.appendChild(el); }
  el.textContent = '⏳ ' + T('Waiting for the connection: {0} to send', n);
}
onQueue.add(queueBadge); queueBadge(queued()); flush();

// ---- start: signed in (here or in the first BridgePlay) → home; else the sign-in ----
(async () => {
  if (loadMe()) {
    go('home');
    const r = await session();
    if (r === 'pin' || r === 'nouser') { signOut(); go('gate', null, true); }
  } else go('gate');
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
