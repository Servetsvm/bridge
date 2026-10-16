/* Club tournaments (BricSkor inside Bridge Table): the sign-in is Bridge Table's own. The same hidden database
   account as the app on this device (its refresh token is shared through this address's storage), and the player's
   Bridge name and PIN: the database session sess/<account> = { k: name, pin } is what the rules check.
   Servet is the super admin; the player who opens a club is its admin; a table signs in with its 4-digit code. */
(function () {
  'use strict';
  // Ctrl+Shift+R (a reload that bypasses this page's offline worker) goes back to Bridge Table's home page; a plain
  // reload (a table's phone refreshed in the middle of a tournament) stays here
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload' && 'serviceWorker' in navigator && !navigator.serviceWorker.controller && localStorage.getItem('bric-skor-sw')) { location.replace('../'); return; }
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => { try { localStorage.setItem('bric-skor-sw', '1'); } catch (e) {} });
  } catch (e) {}
  const NS = (location.search.match(/[?&]ns=([a-z0-9]{1,12})/i) || [])[1] || (/^(localhost|127.0.0.1)$/.test(location.hostname) ? 'dev' : undefined);
  const ROOT = 'https://bridgetable-89b1a-default-rtdb.europe-west1.firebasedatabase.app' + (NS ? '/test/' + NS.toLowerCase() : '');
  const API_KEY = 'AIzaSyDNugZ1tf4rXu7lDYzyZg9v1V3is7xz_Mc';
  // the language: the one chosen here last time (English or Turkish: BricSkor keeps it); the first time, the one used
  // in Bridge Table, or the phone's own
  try { if (!localStorage.getItem('bricskor_language')) { const st = JSON.parse(localStorage.getItem('bric-masasi-v2') || 'null'), L = st && st.SET && st.SET.lang; localStorage.setItem('bricskor_language', (L ? L === 'tr' : /^tr/i.test(navigator.language || '')) ? 'tr' : 'en'); } } catch (e) {}
  window.GATE_ROOT = ROOT;                 // the Bridge Table database (its test part on a test server)
  window.GATE_BASE = ROOT + '/gate';       // where the club tournaments live
  let tok = null, exp = 0, uid = null, p = null;
  async function fresh() {
    let rt = null; try { rt = localStorage.getItem('bridge-auth-rt'); } catch (e) {}
    const keep = (t, ref, u, sec) => { tok = t; exp = Date.now() + (+sec || 3600) * 1000; uid = u; window._authUid = u; window._authToken = t; try { localStorage.setItem('bridge-auth-rt', ref); } catch (e) {} return t; };
    if (rt) {
      try {
        const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt) });
        if (r.ok) { const d = await r.json(); return keep(d.id_token, d.refresh_token, d.user_id, d.expires_in); }
      } catch (e) {}
    }
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' });
    if (!r.ok) throw new Error('auth ' + r.status);
    const d = await r.json(); return keep(d.idToken, d.refreshToken, d.localId, d.expiresIn);
  }
  window._getAuthToken = async function () {
    if (tok && Date.now() < exp - 60e3) return tok;
    try { return await (p || (p = fresh().finally(() => { p = null; }))); } catch (e) { return null; }
  };
  // the player signed in on Bridge Table on this device: name, the name as the rules know it, and the PIN's code
  const nameKey = n => String(n || '').trim().toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/\s+/g, '');
  window.bridgeUser = function () {
    let name = '', pin = null;
    try { name = localStorage.getItem('bridge-table-name') || ''; const st = JSON.parse(localStorage.getItem('bric-masasi-v2') || 'null'); pin = st && st.SET && st.SET.pinH; } catch (e) {}
    if (!name || !pin) return null;
    return { name, key: encodeURIComponent(nameKey(name)).replace(/\./g, '%2E'), pin };
  };
  // the database session for that player (as Bridge Table makes it): true when the PIN is right
  // the PIN's code exactly as Bridge Table makes it (the database keeps only this)
  window.bridgePinHash = async function (name, pin) {
    const b = new TextEncoder().encode('bridge-table:' + nameKey(name) + ':' + pin);
    const h = await crypto.subtle.digest('SHA-256', b);
    return [...new Uint8Array(h)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join('');
  };
  // pin: a PIN typed now (the admin signs in with it); without it, the one saved on this device
  window.bridgeSession = async function (pin) {
    const u0 = window.bridgeUser(); if (!u0) return false;
    const u = pin != null ? { ...u0, pin: await window.bridgePinHash(u0.name, String(pin).trim()) } : u0;
    const t = await window._getAuthToken(); if (!t) return false;
    try { const r = await fetch(ROOT + '/sess/' + uid + '.json?auth=' + t, { method: 'PUT', body: JSON.stringify({ k: u.key, pin: u.pin, ts: Date.now() }) }); return r.ok; } catch (e) { return false; }
  };
  window._getAuthToken();
})();
