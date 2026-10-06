/* Bridge Table — storage: browser storage, optional account storage when opened on claude.ai, period statistics. */
const Store = (() => {
  'use strict';
  const KEY = 'bric-masasi-v2';
  let cloud = null, months = {}, q = Promise.resolve(), setTimer = null;
  const enqueue = fn => { q = q.then(fn).catch(() => {}); };
  const monthKey = ts => { const d = new Date(ts); return 'm' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0'); };

  function loadLocal() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function saveLocal(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  /* connects to the per-person store; calls onMerge(records, settings) with what the account already has */
  async function initCloud(onMerge) {
    try {
      if (!window.claude || !window.claude.use) return false;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return false;
      const uid = await user.id(); if (!uid) return false;
      cloud = { db, col: 'data/users/' + uid };
      const snap = await db.collection(cloud.col).get();
      const recs = []; let settings = null;
      for (const d of snap.docs) {
        const v = d.data() || {};
        if (d.id === 'settings') settings = v.set || null;
        else if (d.id[0] === 'm') { months[d.id] = Array.isArray(v.recs) ? v.recs.slice() : []; recs.push(...months[d.id]); }
      }
      onMerge(recs, settings);
      return true;
    } catch (e) { cloud = null; return false; }
  }
  const compact = e => ({ id: e.id, ts: e.ts, board: e.board, seat: e.seat, passed: !!e.passed, c: e.c || null, tricks: e.tricks ?? null, ns: e.ns, us: e.us, imp: e.imp ?? null, mp: e.mp ?? null, norm: e.norm || null });
  function saveRec(e) {
    if (!cloud) return;
    const k = monthKey(e.ts), arr = months[k] || (months[k] = []);
    const i = arr.findIndex(r => r.id === e.id), c = compact(e);
    if (i >= 0) arr[i] = c; else arr.push(c);
    const body = { recs: arr.slice() };
    enqueue(() => cloud.db.collection(cloud.col).doc(k).set(body));
  }
  function saveSettings(set) {
    if (!cloud) return;
    clearTimeout(setTimer);
    setTimer = setTimeout(() => { const body = { set: JSON.parse(JSON.stringify(set)) }; enqueue(() => cloud.db.collection(cloud.col).doc('settings').set(body)); }, 1500);
  }

  /* period summaries for the statistics panel */
  function periods(hist) {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sow = sod - ((now.getDay() + 6) % 7) * 864e5;
    const som = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const soy = new Date(now.getFullYear(), 0, 1).getTime();
    return [['Today', sod], ['This week', sow], ['This month', som], ['This year', soy], ['All time', 0]].map(([name, from]) => {
      const rs = hist.filter(h => (h.ts || 0) >= from), sc = rs.filter(h => h.imp != null);
      const impSum = sc.reduce((a, h) => a + h.imp, 0), mpAvg = sc.length ? sc.reduce((a, h) => a + h.mp, 0) / sc.length : null;
      return { name, n: rs.length, scored: sc.length, impSum: Math.round(impSum * 10) / 10, impAvg: sc.length ? Math.round(impSum / sc.length * 100) / 100 : null, mpAvg: mpAvg == null ? null : Math.round(mpAvg * 10) / 10, pts: rs.reduce((a, h) => a + (h.us || 0), 0) };
    });
  }
  return { loadLocal, saveLocal, initCloud, saveRec, saveSettings, periods, compact, get online() { return !!cloud; } };
})();

/* Sync between devices through a private GitHub gist (works offline; merges when the device is back online).
   Needs a GitHub token with the "gist" scope, entered once per device in Settings. */
const GitSync = (() => {
  'use strict';
  const KEY = 'bridge-table-sync', FILE = 'bridge-table-data.json';
  let cfg = {}; try { cfg = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { cfg = {}; }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  async function api(path, opt) {
    opt = opt || {};
    const headers = { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json' };
    if (opt.body) headers['Content-Type'] = 'application/json';
    const r = await fetch('https://api.github.com' + path, { method: opt.method || 'GET', headers, body: opt.body, cache: 'no-store' });
    if (r.status === 401) throw new Error('GitHub did not accept the token. Create a new one with the "gist" scope.');
    if (!r.ok) throw new Error('GitHub error ' + r.status);
    return r.json();
  }
  async function findGist() {
    if (cfg.gistId) return cfg.gistId;
    for (let page = 1; page <= 10; page++) {
      const list = await api('/gists?per_page=100&page=' + page);
      const g = list.find(x => x.files && x.files[FILE]);
      if (g) { cfg.gistId = g.id; persist(); return g.id; }
      if (list.length < 100) break;
    }
    const g = await api('/gists', { method: 'POST', body: JSON.stringify({ description: 'Bridge Table — scores synced by the app', public: false, files: { [FILE]: { content: '{"v":1,"hist":[],"seen":[]}' } } }) });
    cfg.gistId = g.id; persist(); return g.id;
  }
  async function readRemote(id) {
    let g;
    try { g = await api('/gists/' + id); } catch (e) { if (/404/.test(e.message)) { cfg.gistId = null; persist(); return readRemote(await findGist()); } throw e; }
    const f = g.files && g.files[FILE]; if (!f) return { hist: [], seen: [] };
    const txt = f.truncated ? await fetch(f.raw_url, { cache: 'no-store' }).then(r => r.text()) : f.content;
    try { const d = JSON.parse(txt); return { hist: d.hist || [], seen: d.seen || [] }; } catch (e) { return { hist: [], seen: [] }; }
  }
  function merge(local, remote) {
    const map = new Map();
    for (const r of remote.hist) map.set(r.id, r);
    for (const l of local.hist) {
      const r = map.get(l.id);
      if (!r) { map.set(l.id, l); continue; }
      const m = { ...r, ...l };
      if (l.imp == null && r.imp != null) { m.imp = r.imp; m.mp = r.mp; m.norm = r.norm; }
      map.set(l.id, m);
    }
    const hist = [...map.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const seen = [...new Set([...remote.seen, ...local.seen])].slice(-40000);
    return { hist, seen };
  }
  let running = null;
  /* local = { hist, seen }; resolves with the merged data, or null when sync is not set up */
  function sync(local) {
    if (!cfg.token) return Promise.resolve(null);
    if (!navigator.onLine) return Promise.reject(new Error('offline'));
    if (running) return running;
    running = (async () => {
      const id = await findGist();
      const remote = await readRemote(id);
      const merged = merge(local, remote);
      const changed = merged.hist.length !== remote.hist.length || merged.seen.length !== remote.seen.length || merged.hist.some(h => h.imp != null && !remote.hist.find(r => r.id === h.id && r.imp != null));
      if (changed) {
        const body = { v: 1, updated: Date.now(), hist: merged.hist.map(Store.compact), seen: merged.seen };
        await api('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(body) } } }) });
      }
      cfg.last = Date.now(); persist();
      return merged;
    })().finally(() => { running = null; });
    return running;
  }
  return {
    sync,
    setToken(t) { cfg = { token: (t || '').trim() || null, gistId: null, last: null }; persist(); },
    get enabled() { return !!cfg.token; },
    get last() { return cfg.last || null; },
  };
})();
