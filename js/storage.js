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
  return { loadLocal, saveLocal, initCloud, saveRec, saveSettings, periods, get online() { return !!cloud; } };
})();
