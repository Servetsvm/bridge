/* A club tournament the TD forgot to finish (asked by the owner, 2026-11-25): one hour without a score → a message to
   the player who started it (state._by; else the club's owner) in their messages with the administrator; thirty more
   minutes without a score → the tournament is finished here and its results archived, as the TD's Finish does.
   Every club's tournament being played (gate/clubs/<id>/bm/state, status running; not an online evening, not a test):
   a quick team match / Social Bridge (_quickTeam) goes to bm/teamArch/q<start>, any other to bm/archives (newest first);
   the club leaves the list of tournaments being played (gate/live/<id>) and its tables are free again. A tournament with
   no board played is finished without an archive. DRY=1 only prints what it would do. Needs FIREBASE_DB_SECRET. */
const DB = 'https://bridgetable-89b1a-default-rtdb.europe-west1.firebasedatabase.app';
const SECRET = process.env.FIREBASE_DB_SECRET, DRY = !!process.env.DRY;
const WARN = 60 * 60e3, CLOSE = 90 * 60e3;   // an hour: the message; half an hour after it: finished
if (!SECRET) { console.log('No FIREBASE_DB_SECRET'); process.exit(1); }
const url = p => `${DB}/${p}.json?auth=${SECRET}`;
const get = async p => { const r = await fetch(url(p)); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };
const put = async (p, v) => { if (DRY) return; const r = await fetch(url(p), { method: 'PUT', body: JSON.stringify(v) }); if (!r.ok) throw new Error('PUT ' + p + ' ' + r.status); };
const patch = async (p, v) => { if (DRY) return; const r = await fetch(url(p), { method: 'PATCH', body: JSON.stringify(v) }); if (!r.ok) throw new Error('PATCH ' + p + ' ' + r.status); };
const del = async p => { if (DRY) return; await fetch(url(p), { method: 'DELETE' }); };
const t = x => Date.parse(x || 0) || 0;
const msgId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const warnText = club => `⏰ ${club}: 1 saattir skor girilmedi. Turnuva bittiyse TD → Turnuvayı bitir. 30 dakika içinde skor girilmezse turnuva otomatik bitirilecek.\n`
  + `⏰ ${club}: ingen score på 1 time. Er turneringen ferdig, trykk TL → Avslutt turneringen. Uten score innen 30 minutter avsluttes den automatisk.\n`
  + `⏰ ${club}: no score for an hour. If the tournament is over, TD → Finish the tournament. Without a score in 30 minutes it is finished automatically.`;
(async () => {
  const list = await get('gate/clubList') || {};
  for (const id of Object.keys(list)) {
    const base = 'gate/clubs/' + id + '/bm';
    let s; try { s = await get(base + '/state'); } catch (e) { console.log(id, e.message); continue; }
    if (!s || s.status !== 'running' || s.online) continue;
    const B = await get(base + '/boards').catch(() => null) || {};
    let last = Math.max(t(s._roundStartedAt), t(s._startedAt)), any = 0;
    for (const d of Object.values(B)) { if (d && d.time) last = Math.max(last, t(d.time)); if (d && d.status === 'done') any++; }
    if (!last) continue;
    const idle = Date.now() - last, club = (list[id] && list[id].n) || id;
    console.log(id, '|', s.name, '| idle', Math.round(idle / 60e3), 'min | boards done', any, s._idleWarnAt ? '| warned' : '');
    // an hour without a score: the message (once for this quiet spell)
    if (idle >= WARN && !(t(s._idleWarnAt) > last)) {
      let k = s._by;
      if (!k) { const info = await get('gate/clubs/' + id + '/info').catch(() => null); k = info && info.owner; }
      if (k) {
        const now = Date.now();
        await put('destek/' + k + '/m/' + msgId(), { by: 'a', t: warnText(club), ts: now });
        await put('destek/' + k + '/ar', now);
      }
      await patch(base + '/state', { _idleWarnAt: new Date().toISOString() });
      console.log('  →', DRY ? '(dry) would message' : 'message to', k || '(nobody)');
      continue;
    }
    // half an hour after the message, still no score: finished
    if (idle >= CLOSE && t(s._idleWarnAt) > last && Date.now() - t(s._idleWarnAt) >= 25 * 60e3) {
      s.status = 'finished'; s._finishedAt = new Date().toISOString(); s._autoFinished = 'idle';
      const [pairs, movements, hands, dd] = await Promise.all(['pairs', 'movements', 'hands', 'dd'].map(k => get(base + '/' + k).catch(() => null)));
      const rec = { state: { ...s }, boards: B, pairs: pairs || {}, movements: movements || {}, hands: hands || [], dd: dd || {}, finished: s._finishedAt };
      await put(base + '/state', s);
      if (any) {
        if (s._quickTeam) await put(base + '/teamArch/q' + (t(s._startedAt) || Date.now()), rec);
        else {
          const a = await get(base + '/archives').catch(() => null), arr = Array.isArray(a) ? a.filter(Boolean) : a ? Object.values(a) : [];
          if (!arr.some(x => x && x.state && x.state._startedAt === s._startedAt)) { arr.unshift(rec); await put(base + '/archives', arr); }
        }
      }
      await put(base + '/tableLocks', {});
      await del('gate/live/' + id);
      console.log('  →', DRY ? '(dry) would finish' : 'finished', any ? 'and archived' : '(no board played: not archived)');
    }
  }
})().catch(e => { console.log('error', e.message); process.exit(1); });
