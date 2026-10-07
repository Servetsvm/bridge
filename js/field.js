/* Bridge Table — virtual field: the same deal is played at robot tables (for IMP/MP comparison). */
(window.BRIDGE = window.BRIDGE || []).push(function field(E) {
'use strict';
const { dealerOf, auctionOver, contractOf, sideOf, vulOf, scoreOf } = E;

const FIELD_AGG = [0, 1, -1, 0, 1, 0, -1, 0, 1, -1];
// quick settings for the fallback without workers; the workers play at expert strength
const FIELD_OPT = { budget: 90, maxSamples: 10, ddTricks: 6 };
const EXPERT_OPT = { budget: 350, maxSamples: 16, ddTricks: 9 };

function simulateTable(deal, board, cards, agg, opt) {
  const dealer = dealerOf(board), auc = [];
  const cs = [{ conv: cards[0].conv, agg }, { conv: cards[1].conv, agg }];
  while (!auctionOver(auc) && auc.length < 80) {
    const t = (dealer + auc.length) % 4;
    const r = E.aiBid(auc, t, deal[t], cs);
    auc.push({ seat: t, call: r.call, m: r.m });
  }
  const c = contractOf(auc);
  if (!c) return { passed: true, ns: 0 };
  const g = E.newPlayState(deal, c, auc, cs);
  while (!E.handsEmpty(g) || g.trick.length) {
    if (g.trick.length === 4) { E.collect(g); continue; }
    const s = g.turn; E.applyCard(g, s, E.aiPlay(g, s, opt || FIELD_OPT));
  }
  const tricks = g.tricks[sideOf(c.decl)];
  const sc = scoreOf(c.level, c.strain, c.dbl, vulOf(board, c.decl), tricks);
  return { c, tricks, ns: sideOf(c.decl) === 0 ? sc : -sc };
}

/* body of the background worker; receives the engine object */
function workerMain(E) {
  self.onmessage = ev => {
    const m = ev.data;
    try {
      if (m.type === "field") {
        for (let i = m.from; i < m.to; i++) {
          const r = E.simulateTable(m.deal, m.board, m.cards, E.FIELD_AGG[i % E.FIELD_AGG.length], E.EXPERT_OPT);
          self.postMessage({ type: "table", id: m.id, i, r });
        }
        self.postMessage({ type: "part", id: m.id });
      } else if (m.type === 'dd') {
        self.postMessage({ type: 'dd', id: m.id, key: m.key, t: E.ddContract(m.deal, m.c, m.limit || 1.5e8) });
      }
    } catch (e) { self.postMessage({ type: 'error', id: m.id, msg: String(e) }); }
  };
}

Object.assign(E, { simulateTable, workerMain, FIELD_AGG, FIELD_OPT, EXPERT_OPT });
});
