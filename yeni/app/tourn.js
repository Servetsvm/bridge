/* BridgePlay (new) — a club tournament's rules: the score of a contract, a board's vulnerability and dealer, the next round,
   the end of a tournament (its archive), the quick team match and Social Bridge. The data is the first BridgePlay's
   (gate/clubs/<id>/bm/…, the same records), so both programs work on the same tournament. */
import { get, tryGet, put, patch, del, sendNow, me, myKey } from './net.js';

export const C = id => 'gate/clubs/' + id;
export const BM = id => C(id) + '/bm';

// ---- a board: its vulnerability and dealer (the 16-board cycle) ----
const VUL = ['None', 'NS', 'EW', 'Both', 'NS', 'EW', 'Both', 'None', 'EW', 'Both', 'None', 'NS', 'Both', 'None', 'NS', 'EW'];
export const vulnOf = b => VUL[(b - 1) % 16];
export const dealerOf = b => 'NESW'[(b - 1) % 4];

// ---- the score of a contract, signed for North-South (as the first BridgePlay's calcScore) ----
const VAL = { '♣': 20, '♦': 20, '♥': 30, '♠': 30, NT: 30 }, FIRST = { '♣': 20, '♦': 20, '♥': 30, '♠': 30, NT: 40 };
export function calcScore(level, suit, declarer, result, vuln, doubled) {
  const ns = declarer === 'N' || declarer === 'S';
  const v = (ns && (vuln === 'NS' || vuln === 'Both')) || (!ns && (vuln === 'EW' || vuln === 'Both'));
  const dbl = doubled === 'XX' ? 4 : doubled === 'X' ? 2 : 1;
  if (result < 0) {
    const u = -result; let pen;
    if (dbl === 1) pen = u * (v ? 100 : 50);
    else if (dbl === 2) pen = !v ? (u === 1 ? 100 : u === 2 ? 300 : 500 + (u - 3) * 300) : (u === 1 ? 200 : u === 2 ? 500 : 800 + (u - 3) * 300);
    else pen = !v ? (u === 1 ? 200 : u === 2 ? 600 : 1000 + (u - 3) * 600) : (u === 1 ? 400 : u === 2 ? 1000 : 1600 + (u - 3) * 600);
    return ns ? -pen : pen;
  }
  let trick = FIRST[suit] + (level - 1) * VAL[suit]; trick *= dbl;
  let bonus = trick >= 100 ? (v ? 500 : 300) : 50;
  if (level === 6) bonus += v ? 750 : 500;
  if (level === 7) bonus += v ? 1500 : 1000;
  if (dbl === 2) bonus += 50; if (dbl === 4) bonus += 100;
  const over = result > 0 ? (dbl === 1 ? result * VAL[suit] : dbl === 2 ? result * (v ? 200 : 100) : result * (v ? 400 : 200)) : 0;
  const t = trick + over + bonus;
  return ns ? t : -t;
}
/* the board's record (the first BridgePlay's): contract text, the parts, the score */
export function boardRecord(f, vuln) {
  const time = new Date().toISOString();
  if (f.pass) return { contract: 'PASS', nsScore: 0, ewScore: 0, level: null, suit: null, declarer: null, result: 0, doubled: '', lead: '', vuln, adjusted: false, status: 'done', time };
  const ns = calcScore(f.level, f.suit, f.declarer, f.result, vuln, f.doubled);
  const contract = f.level + f.suit + (f.doubled || '') + ' ' + f.declarer + (f.result > 0 ? ' +' + f.result : f.result === 0 ? ' =' : ' ' + f.result);
  const lead = f.leadSuit && f.leadRank ? f.leadSuit + f.leadRank : '';
  return { contract, level: f.level, suit: f.suit, declarer: f.declarer, result: f.result, doubled: f.doubled || '', lead, leadSuit: f.leadSuit || '', leadRank: f.leadRank || '', vuln, nsScore: ns, ewScore: -ns, adjusted: false, status: 'done', time };
}

// ---- this round at a table: its boards and how many are done ----
export const tableBoards = m => { const L = []; if (m) for (let b = m.boardStart || 1; b <= (m.boardEnd || 0); b++) L.push(b); return L; };
export function progress(s, M, B, onlyPlayed) {
  let total = 0, done = 0;
  for (let t = 1; t <= (s.tableCount || 0); t++) {
    const m = M[s.currentRound + '_' + t]; if (!m) continue;
    const L = tableBoards(m), d = L.filter(b => (B[t + '_' + s.currentRound + '_' + b] || {}).status === 'done').length;
    if (onlyPlayed && !d) continue;   // a table nobody sat at is left out
    total += L.length; done += d;
  }
  return { total, done };
}

/* after a score: every table done → the next round (read afresh: two phones may try at once); the last round done
   (at every table that played) → the tournament is finished and archived */
let stepping = false;
export async function afterScore(club) {
  if (stepping) return; stepping = true;
  try {
    const [s, M, B, P] = await Promise.all([get(BM(club) + '/state'), get(BM(club) + '/movements'), get(BM(club) + '/boards'), tryGet(BM(club) + '/pairs')]);
    if (!s || s.status !== 'running' || s.online) return;
    if (s.currentRound < s.roundCount) {
      const pp = P || {}; let total = 0, done = 0;
      for (let t = 1; t <= (s.tableCount || 0); t++) {
        const m = (M || {})[s.currentRound + '_' + t]; if (!m || (pp[m.ns] || {}).isPhantom || (pp[m.ew] || {}).isPhantom) continue;
        for (const b of tableBoards(m)) { total++; if (((B || {})[t + '_' + s.currentRound + '_' + b] || {}).status === 'done') done++; }
      }
      if (!total || done < total || (s.movement === 'swiss' && !(M || {})[(s.currentRound + 1) + '_1'])) return;
      const f = await get(BM(club) + '/state'); if (!f || f.status !== 'running' || f.currentRound !== s.currentRound) return;
      await patch(BM(club) + '/state', { currentRound: s.currentRound + 1, _roundStartedAt: new Date().toISOString() });
      return;
    }
    const pr = progress(s, M || {}, B || {}, true);
    if (pr.total && pr.done >= pr.total) await finish(club, s, { auto: true });
  } catch (e) { console.warn('after score', e); }
  finally { stepping = false; }
}

// ---- the end: the tournament finished, its record in the club's results, the tables free, off the list being played ----
export const quickArcId = s => 'q' + (Date.parse(s._startedAt || 0) || Date.now());
export async function finish(club, s0, { auto } = {}) {
  const s = { ...(s0 || await get(BM(club) + '/state')) }; if (!s || s.status !== 'running') return false;
  const [B, P, M, H, DD] = await Promise.all(['boards', 'pairs', 'movements', 'hands', 'dd'].map(k => tryGet(BM(club) + '/' + k)));
  s.status = 'finished'; s._finishedAt = new Date().toISOString(); if (auto) s._autoFinished = 1;
  await put(BM(club) + '/state', s);
  const rec = { state: { ...s }, boards: B || {}, pairs: P || {}, movements: M || {}, hands: H || [], dd: DD || {}, finished: s._finishedAt };
  const played = Object.values(B || {}).some(b => b && b.status === 'done');
  if (s._quickTeam) { if (played) await sendNow('PUT', BM(club) + '/teamArch/' + quickArcId(s), rec); }
  else {
    const A = await tryGet(BM(club) + '/archives'), arc = Array.isArray(A) ? A.filter(Boolean) : Object.values(A || {}).filter(Boolean);
    if (!arc.some(a => a && a.state && a.state._startedAt === s._startedAt)) { arc.unshift(rec); await put(BM(club) + '/archives', arc); }
  }
  await del('gate/live/' + club);
  await put(BM(club) + '/tableLocks', {});
  return true;
}
/* the tournament deleted (as the first BridgePlay's Delete): nothing of it is kept */
export async function wipe(club) {
  await Promise.all(['state', 'pairs', 'boards', 'movements', 'logs', 'approvals', 'hands', 'dd', 'ready', 'kicks', 'tdcalls', 'tableLocks', 'boardLocks'].map(k => del(BM(club) + '/' + k)));
  await del('gate/live/' + club);
}

// ---- the quick ones: started at once, no codes at the tables, no opening lead asked, ends by itself ----
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
/* kind 'team': two teams of two pairs, two tables, boards 1–8 (each table in any order, the other table's open board busy);
   kind 'social': players/4 tables, each pair stays, every table plays any free board of 1..boards */
export async function quickStart(club, clubName, kind, { players = 12, boards = 12, label = '' } = {}) {
  const old = (await tryGet(BM(club) + '/state')) || {};
  if (old.status === 'running' && !old._quickTeam) return 'busy';
  let movements = {}, pairs = {}, tables, extra;
  if (kind === 'team') {
    for (let i = 1; i <= 4; i++) pairs['p' + i] = { id: 'p' + i, name: 'Pair ' + i, dir: '', startTable: 0, isPhantom: false, team: i <= 2 ? 'A' : 'B', teamName: i <= 2 ? 'Team A' : 'Team B', teamPair: i <= 2 ? i : i - 2 };
    const common = { boardStart: 1, boardEnd: 8, teamMatch: true, matchId: 'M1', sitoutA: null, sitoutB: null };
    movements['1_1'] = { ...common, ns: 'p1', ew: 'p3', teamA: 'p1', teamB: 'p3', mirrorTable: 2 };
    movements['1_2'] = { ...common, ns: 'p4', ew: 'p2', teamA: 'p2', teamB: 'p4', mirrorTable: 1 };
    tables = 2;
    extra = { boardsPerRound: 8, totalBoards: 8, movement: 'team', scoring: 'IMP', teams: { A: { id: 'A', name: 'Team A', pairs: ['p1', 'p2'] }, B: { id: 'B', name: 'Team B', pairs: ['p3', 'p4'] } }, _teamPairs: 2, _teamAName: 'Team A', _teamBName: 'Team B', _teamScoring: 'IMP', _setupPlayers: 8 };
  } else {
    tables = Math.floor(players / 4);
    for (let t = 1; t <= tables; t++) {
      pairs['ns_' + t] = { id: 'ns_' + t, name: 'NS ' + t, dir: 'NS', startTable: t, isPhantom: false };
      pairs['ew_' + t] = { id: 'ew_' + t, name: 'EW ' + t, dir: 'EW', startTable: t, isPhantom: false };
      movements['1_' + t] = { ns: 'ns_' + t, ew: 'ew_' + t, boardStart: 1, boardEnd: boards, social: true };
    }
    extra = { boardsPerRound: boards, totalBoards: boards, movement: 'social', scoring: 'BOTH', _setupPlayers: players, _quickKind: 'social' };
  }
  const at = new Date().toISOString();
  const s = { ...old, name: stamp() + (label ? ' · ' + label : ''), tableCount: tables, roundCount: 1, phantom: false, status: 'setup', currentRound: 0, ...extra, _quickTeam: true, _noLead: true };
  if (kind !== 'team') for (const k of ['teams', '_teamPairs', '_teamAName', '_teamBName', '_teamScoring']) delete s[k];
  if (kind === 'team') delete s._quickKind;
  for (const k of ['_finishedAt', '_autoFinished', '_idleWarnAt']) delete s[k];
  const W = (k, v) => sendNow('PUT', BM(club) + '/' + k, v);
  if (old.status === 'running') await sendNow('PATCH', BM(club) + '/state', { status: 'setup' });   // a quick one left running is replaced
  const ok = await W('movements', movements) && await W('pairs', pairs);
  if (!ok) return 'denied';
  await Promise.all([W('boards', {}), W('approvals', {}), W('tableLocks', {}), W('boardLocks', {}), W('ready', {}), W('hands', []), W('dd', {}), sendNow('DELETE', BM(club) + '/kicks'), sendNow('DELETE', BM(club) + '/tdcalls')]);
  Object.assign(s, { status: 'running', currentRound: 1, _startedAt: at, _roundStartedAt: at, _by: myKey() });
  if (!await W('state', s)) return 'denied';
  await sendNow('PUT', 'gate/live/' + club, { n: String(s.name).slice(0, 40), c: String(clubName || club).slice(0, 40), tb: tables, p: '00', ts: Date.now(), k: {}, q: 1 });
  try { localStorage.setItem('bp_myTourn', JSON.stringify({ club, sid: at, n: String(clubName || '').slice(0, 40), k: myKey() })); } catch (e) {}
  return 'ok';
}

// ---- where everyone goes next round: each pair's next table, and where this table's boards go ----
export function nextRound(s, M, t) {
  const r = s.currentRound, n = r + 1; if (n > (s.roundCount || 0)) return null;
  const here = M[r + '_' + t] || {}, at = id => { for (let x = 1; x <= (s.tableCount || 0); x++) { const m = M[n + '_' + x]; if (m && (m.ns === id || m.ew === id)) return { t: x, dir: m.ns === id ? 'NS' : 'EW' }; } return null; };
  let boardsTo = null;
  for (let x = 1; x <= (s.tableCount || 0); x++) { const m = M[n + '_' + x]; if (m && m.boardStart === here.boardStart && m.boardEnd === here.boardEnd) { boardsTo = x; break; } }
  const mine = M[n + '_' + t] || {};
  return { round: n, ns: at(here.ns), ew: at(here.ew), boardsTo, mine };
}
export const meName = () => me.name;
