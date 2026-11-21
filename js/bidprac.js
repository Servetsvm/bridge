/* BridgePlay — bidding practice with both hands: you see your hand and your partner's and make the calls for both
   (the opponents pass), then the contract is compared double dummy with the best contract for your side, and the
   robots bid the same two hands with your convention card. Loaded after app.js (uses its helpers). */
'use strict';
const BP = { deal: null, auc: [], dealer: 2, board: 1, done: null, n: 0, imp: 0, tries: 0 };
const BP_SEATS = [0, 2];   // North (your partner) and South (you)
// the conventions you practise are on, even when your card has them off
const bpCards = () => { const on = {}; for (const k of (typeof pracList === 'function' ? pracList() : [])) on[k] = true; const o = { conv: { ...SET.conv, ...on }, agg: 0, sys: SET.sys && SET.sys !== 'none' ? SET.sys : 'twoone' }; return [o, o]; };
// the robots' auction of the two hands with your card (the opponents pass)
function bpAuction(deal, dealer) {
  const a = [], cards = bpCards();
  while (!E.auctionOver(a) && a.length < 40) {
    const t = (dealer + a.length) % 4;
    if (!BP_SEATS.includes(t)) { a.push({ seat: t, call: 'P' }); continue; }
    let r; try { r = E.aiBid(a, t, deal[t], cards); } catch (e) { r = { call: 'P' }; }
    a.push({ seat: t, call: r.call, m: r.m });
  }
  return a;
}
function bpNew() {
  // the conventions you practise (Practise conventions): deals where your system uses one of them
  const want = typeof pracList === 'function' ? pracList() : [];
  if (want.length) {
    // the game's own deal makers for the conventions that have one (rare ones come up there), else random deals; 2½ s at most
    const gens = want.filter(k => typeof PRAC_GEN !== 'undefined' && PRAC_GEN[k]), t0 = performance.now();
    for (let i = 0; i < 20000 && performance.now() - t0 < 2500; i++) {
      const board = 1 + Math.floor(Math.random() * 16);
      let deal = null; try { deal = gens.length && i % 2 === 0 ? genDeal(gens[i % gens.length], E.dealerOf(board)) : null; } catch (e) { deal = null; }
      if (!deal) { const d = [...Array(52).keys()]; for (let k = 51; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [d[k], d[j]] = [d[j], d[k]]; } deal = [0, 1, 2, 3].map(x => d.slice(x * 13, x * 13 + 13)); }
      if (bpAuction(deal, E.dealerOf(board)).some(e => e.m && want.includes(e.m.cv))) { BP.deal = deal; BP.board = board; BP.dealer = E.dealerOf(board); BP.auc = []; BP.done = null; BP.prac = want; bpPasses(); bpShow(); return; }
    }
  }
  BP.prac = null;
  const d = [...Array(52).keys()];
  for (let k = 51; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [d[k], d[j]] = [d[j], d[k]]; }
  const deal = [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13));
  BP.board = 1 + Math.floor(Math.random() * 16); BP.dealer = E.dealerOf(BP.board);
  // a deal worth bidding: your side has at least 20 points between you
  const hcp = h => h.reduce((n, c) => n + Math.max(0, E.R(c) - 8), 0);
  if (hcp(deal[0]) + hcp(deal[2]) < 20 && BP.tries++ < 40) return bpNew();
  BP.tries = 0; BP.deal = deal; BP.auc = []; BP.done = null;
  bpPasses(); bpShow();
}
// the opponents always pass; the turn moves on to your side
function bpPasses() { while (!E.auctionOver(BP.auc) && !BP_SEATS.includes(bpTurn())) BP.auc.push({ seat: bpTurn(), call: 'P' }); }
const bpTurn = () => (BP.dealer + BP.auc.length) % 4;
function bpCall(call) {
  if (BP.done || !BP.deal) return;
  const seat = bpTurn(); if (!BP_SEATS.includes(seat) || !E.legalCalls(BP.auc, seat).includes(call)) return;
  // the call's meaning goes with it: the robots (and the check of your calls) read the auction through the meanings
  let m = null; try { m = E.explainCall(BP.auc, seat, call, bpCards()); } catch (e) {}
  BP.auc.push({ seat, call, m }); bpPasses();
  if (E.auctionOver(BP.auc)) bpFinish(); else bpShow();
}
// the robots bid the same two hands (the opponents pass), with your convention card
function bpRobots() { return bpAuction(BP.deal, BP.dealer); }
// each of your calls against your system's call at that point, with what they mean
function bpCheck() {
  const cards = bpCards(), out = []; let left = false;
  BP.auc.forEach((e, i) => {
    if (!BP_SEATS.includes(e.seat)) return;
    if (left) { let mm = null; try { mm = E.explainCall(BP.auc.slice(0, i), e.seat, e.call, cards); } catch (x) {} out.push({ seat: e.seat, call: e.call, sys: undefined, mt: (mm && mm.t) || '', st: '' }); return; }
    const pre = BP.auc.slice(0, i); let r; try { r = E.aiBid(pre, e.seat, BP.deal[e.seat], cards); } catch (x) { r = null; }
    let mm = null; try { mm = E.explainCall(pre, e.seat, e.call, cards); } catch (x) {}
    out.push({ seat: e.seat, call: e.call, sys: r ? r.call : null, mt: (mm && mm.t) || '', st: (r && r.m && r.m.t) || '' });
    if (r && r.call !== e.call) { left = true; out.push({ off: 1 }); }
  });
  return out;
}
// North-South's score in a contract, double dummy (passed out: 0)
function bpScore(c, tab) {
  if (!c) return { sc: 0, tr: null };
  const tr = tab[c.strain][c.decl === 0 ? 0 : 1];
  return { sc: E.scoreOf(c.level, c.strain, c.dbl, E.vulOf(BP.board, c.decl), tr), tr };
}
function bpFinish() {
  // the tricks North and South take in each strain (double dummy), and the best contract for the side
  const tab = [0, 1, 2, 3, 4].map(st => [0, 2].map(decl => { try { const v = E.ddContract(BP.deal, { level: 1, strain: st, dbl: 0, decl }, 2e6); return v == null ? 0 : v; } catch (e) { return 0; } }));
  let best = { sc: 0, c: null };
  for (let st = 0; st < 5; st++) for (let i = 0; i < 2; i++) { const tr = tab[st][i], decl = i ? 2 : 0; for (let l = 1; l <= tr - 6; l++) { const sc = E.scoreOf(l, st, 0, E.vulOf(BP.board, decl), tr); if (sc > best.sc) best = { sc, c: { level: l, strain: st, dbl: 0, decl } }; } }
  const mine = E.contractOf(BP.auc), ra = bpRobots(), rob = E.contractOf(ra);
  const me = bpScore(mine, tab), ro = bpScore(rob, tab), imp = E.imps(me.sc - best.sc);
  BP.done = { tab, best, mine, me, ra, rob, ro, imp, chk: bpCheck() }; BP.n++; BP.imp += imp;
  bpShow();
}
const bpCon = c => c ? `${callHtml(E.B(c.level, c.strain))}${c.dbl === 1 ? 'X' : c.dbl === 2 ? 'XX' : ''} ${T(['North', 'East', 'South', 'West'][c.decl])}` : T('Passed out');
const bpAuc = a => {
  const cols = [0, 1, 2, 3], start = BP.dealer, cells = [];
  for (let i = 0; i < start; i++) cells.push('');
  for (const e of a) cells.push(e.call === 'P' ? T('Pass') : callHtml(e.call));
  const rows = []; for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4));
  return `<table class="bpauc"><tr>${cols.map(s => `<th${BP_SEATS.includes(s) ? ' class="us"' : ''}>${T(['North', 'East', 'South', 'West'][s])}</th>`).join('')}</tr>${rows.map(r => `<tr>${cols.map(i => `<td>${r[i] || ''}</td>`).join('')}</tr>`).join('')}</table>`;
};
const bpHand = (s, label) => `<div class="bphand${!BP.done && bpTurn() === s ? ' turn' : ''}"><b>${label}</b>${[3, 2, 1, 0].map(su => `<div>${suitLine(BP.deal[s], su)}</div>`).join('')}</div>`;
function bpBox() {
  const seat = bpTurn(), leg = E.legalCalls(BP.auc, seat);
  const lv = [1, 2, 3, 4, 5, 6, 7].map(l => `<div class="bprow">${[0, 1, 2, 3, 4].map(st => { const c = E.B(l, st); return `<button class="btn bpc" data-bp="${c}" ${leg.includes(c) ? '' : 'disabled'}>${callHtml(c)}</button>`; }).join('')}</div>`).join('');
  return `<div class="bpbox"><div class="bpwho">${T('Bid for {0}', T(['North', 'East', 'South', 'West'][seat]))}</div><div class="bprow"><button class="btn new bpc bpp" data-bp="P">${T('Pass')}</button></div>${lv}</div>`;
}
function bpShow() {
  const vul = s => E.vulOf(BP.board, s) ? ' 🔴' : '';
  let body = `<div class="muted">${T('You bid both hands; the opponents pass. Then your contract is compared with the best one (double dummy) and with the robots\' auction.')}</div>
    ${BP.prac ? `<div class="okmsg">📚 ${T('Practising')}: ${esc(pracNames())}</div>` : ''}<div class="bphands">${bpHand(0, T('North (partner)') + vul(0))}${bpHand(2, T('South (you)') + vul(2))}</div>${bpAuc(BP.auc)}`;
  if (!BP.done) body += bpBox();
  else {
    const d = BP.done, st = ['♣', '♦', '♥', '♠', 'NT'];
    body += `<div class="grp"><span>${T('Result')}</span>
      <div>${T('Your contract')}: <b>${bpCon(d.mine)}</b>${d.mine ? ` · ${T('{0} tricks', d.me.tr)} · <b>${fmtSigned(d.me.sc)}</b>` : ''}</div>
      <div>${T('Best contract')}: <b>${bpCon(d.best.c)}</b> · <b>${fmtSigned(d.best.sc)}</b></div>
      <div>${T('Robots')}: <b>${bpCon(d.rob)}</b>${d.rob ? ` · <b>${fmtSigned(d.ro.sc)}</b>` : ''}</div>
      <div class="bpimp ${d.imp >= 0 ? 'pos' : 'neg'}">${d.imp === 0 ? '✅ ' + T('The best contract!') : fmtSigned(d.imp) + ' IMP'}</div></div>
      <div class="grp"><span>${T('Your calls and your system')}</span>${d.chk.map(x => x.off ? `<div class="muted bpoff">↪ ${T('From here the auction left your system: no more suggestions.')}</div>` : x.sys === undefined ? `<div class="bpchk"><b>${T(['North', 'East', 'South', 'West'][x.seat])}</b> ${x.call === 'P' ? T('Pass') : callHtml(x.call)}${x.mt ? `<small>${symText(bidTxt(x.mt))}</small>` : ''}</div>` : `<div class="bpchk${x.sys === x.call ? ' ok' : ''}"><b>${T(['North', 'East', 'South', 'West'][x.seat])}</b> ${x.call === 'P' ? T('Pass') : callHtml(x.call)}${x.sys === x.call ? ' ✅' : ` → ${T('your system')}: <b>${x.sys == null ? '?' : x.sys === 'P' ? T('Pass') : callHtml(x.sys)}</b>`}${(x.sys === x.call ? x.mt : x.st) ? `<small>${symText(bidTxt(x.sys === x.call ? x.mt : x.st))}</small>` : ''}</div>`).join('')}</div>
      <details><summary>${T('The robots\' auction')}</summary>${bpAuc(d.ra)}</details>
      <details><summary>${T('Tricks double dummy')}</summary><table class="bpauc"><tr><th></th>${st.map(x => `<th>${x}</th>`).join('')}</tr>${[0, 1].map(i => `<tr><th>${T(i ? 'South' : 'North')}</th>${d.tab.map(r => `<td>${r[i]}</td>`).join('')}</tr>`).join('')}</table></details>
      <div class="muted">${T('This session: {0} deals, {1} IMP', BP.n, fmtSigned(BP.imp))}</div>`;
  }
  openOv('bp', `<h2>🎯 ${T('Bidding practice')}</h2>${body}<div class="row2">${BP.done ? `<button class="btn gold" data-bp="next">▶ ${T('Next deal')}</button>` : `<button class="btn" data-bp="skip">↻ ${T('New deal')}</button>`}<button class="btn" id="oClose">${T('Close')}</button></div>`);
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-bp]'); if (!b) return;
  ev.stopPropagation();
  const v = b.dataset.bp;
  if (v === 'next' || v === 'skip') { bpNew(); return; }
  bpCall(v === 'P' ? 'P' : +v);
}, true);
