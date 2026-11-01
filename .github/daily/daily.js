// The hand of the day (/bridge/<lang>/daily/): every night a new deal, bid by the robots, solved double dummy, written
// as a page in each language, with the question "what do you bid as South?" and the answer below it; the list of the
// last days, the sitemap and a link from the language pages. Run by .github/workflows/daily.yml (or by hand:
// node .github/daily/daily.js [YYYY-MM-DD]).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '../..') + '/';
const SITE = 'https://servetsvm.github.io/bridge/';
const LANGS = ['en', 'tr', 'no', 'es', 'fr', 'it', 'de', 'ru', 'pl', 'zh'];
const NAMES = { en: 'English', tr: 'Türkçe', no: 'Norsk', es: 'Español', fr: 'Français', it: 'Italiano', de: 'Deutsch', ru: 'Русский', pl: 'Polski', zh: '中文' };
const KEEP = 60;   // days kept in the sitemap and the list
const T = {
  en: { h: 'Hand of the day', home: 'Bridge Table', seats: 'NESW', nt: 'NT', pass: 'Pass', d: 'Daily bridge hand for {0}: what would you bid as South? The robots\' auction, the contract, the double-dummy result and every makeable contract.', board: 'Board {0}', dealer: 'Dealer', vul: 'Vulnerable', none: 'None', all: 'All', q: 'Your turn as South: what do you bid?', you: 'Your hand (South)', sofar: 'The auction so far', show: 'Show the answer', robot: 'The robot bid', full: 'The whole deal', auction: 'Auction', contract: 'Contract', passed: 'Passed out', lead: 'Opening lead', ddr: 'Double dummy, declarer takes {0} tricks: {1}.', made: 'made', over: 'made with {0} overtrick(s)', down: '{0} down', table: 'Makeable contracts (double dummy)', tricks: 'tricks', play: '▶ Play this deal against the robots', prev: 'Previous hands', learn: 'Learn bridge' },
  tr: { h: 'Günün eli', home: 'Briç Masası', seats: 'KDGB', nt: 'SA', pass: 'Pas', d: '{0} günün briç eli: Güney olarak ne derdin? Robotların deklarasyonu, kontrat, double dummy sonuç ve yapılabilen bütün kontratlar.', board: 'El {0}', dealer: 'Dağıtan', vul: 'Zon', none: 'Yok', all: 'Herkes', q: 'Sıra Güney\'de, yani sende: ne dersin?', you: 'Elin (Güney)', sofar: 'Şu ana kadar deklarasyon', show: 'Cevabı göster', robot: 'Robotun deklarasyonu', full: 'Bütün el', auction: 'Deklarasyon', contract: 'Kontrat', passed: 'Pas geçildi', lead: 'İlk atak', ddr: 'Double dummy deklaran {0} löve alır: {1}.', made: 'yapılır', over: '{0} fazlayla yapılır', down: '{0} batar', table: 'Yapılabilen kontratlar (double dummy)', tricks: 'löve', play: '▶ Bu eli robotlara karşı oyna', prev: 'Önceki eller', learn: 'Briç öğren' },
  no: { h: 'Dagens spill', home: 'Bridgebord', seats: 'NØSV', nt: 'NT', pass: 'Pass', d: 'Dagens bridgespill {0}: hva melder du som Syd? Robotenes meldinger, kontrakten, resultatet med åpne kort og alle kontrakter som står.', board: 'Spill {0}', dealer: 'Giver', vul: 'Sone', none: 'Ingen', all: 'Alle', q: 'Din tur som Syd: hva melder du?', you: 'Din hånd (Syd)', sofar: 'Meldingene så langt', show: 'Vis svaret', robot: 'Roboten meldte', full: 'Hele spillet', auction: 'Meldinger', contract: 'Kontrakt', passed: 'Passet rundt', lead: 'Utspill', ddr: 'Med åpne kort tar spilleføreren {0} stikk: {1}.', made: 'står', over: 'står med {0} overstikk', down: '{0} beit', table: 'Kontrakter som står (åpne kort)', tricks: 'stikk', play: '▶ Spill dette spillet mot robotene', prev: 'Tidligere spill', learn: 'Lær bridge' },
  es: { h: 'La mano del día', home: 'Mesa de Bridge', seats: 'NESO', nt: 'ST', pass: 'Paso', d: 'Mano de bridge del día {0}: ¿qué dirías como Sur? La subasta de los robots, el contrato, el resultado a doble muerto y todos los contratos que se cumplen.', board: 'Mano {0}', dealer: 'Reparte', vul: 'Vulnerables', none: 'Nadie', all: 'Todos', q: 'Te toca como Sur: ¿qué dices?', you: 'Tu mano (Sur)', sofar: 'La subasta hasta ahora', show: 'Ver la respuesta', robot: 'El robot dijo', full: 'La mano completa', auction: 'Subasta', contract: 'Contrato', passed: 'Pasada', lead: 'Salida', ddr: 'A doble muerto el declarante hace {0} bazas: {1}.', made: 'se cumple', over: 'se cumple con {0} de más', down: '{0} multa(s)', table: 'Contratos que se cumplen (doble muerto)', tricks: 'bazas', play: '▶ Juega esta mano contra los robots', prev: 'Manos anteriores', learn: 'Aprende bridge' },
  fr: { h: 'La donne du jour', home: 'Table de Bridge', seats: 'NESO', nt: 'SA', pass: 'Passe', d: 'Donne de bridge du {0} : que dites-vous en Sud ? Les enchères des robots, le contrat, le résultat à cartes ouvertes et tous les contrats gagnants.', board: 'Donne {0}', dealer: 'Donneur', vul: 'Vulnérables', none: 'Personne', all: 'Tous', q: 'À vous en Sud : que dites-vous ?', you: 'Votre main (Sud)', sofar: 'Les enchères jusqu’ici', show: 'Voir la réponse', robot: 'Le robot a dit', full: 'La donne complète', auction: 'Enchères', contract: 'Contrat', passed: 'Passe générale', lead: 'Entame', ddr: 'À cartes ouvertes le déclarant fait {0} levées : {1}.', made: 'contrat réussi', over: 'réussi avec {0} de mieux', down: '{0} de chute', table: 'Contrats gagnants (cartes ouvertes)', tricks: 'levées', play: '▶ Jouez cette donne contre les robots', prev: 'Donnes précédentes', learn: 'Apprendre le bridge' },
  it: { h: 'La smazzata del giorno', home: 'Tavolo di Bridge', seats: 'NESO', nt: 'SA', pass: 'Passo', d: 'Smazzata di bridge del {0}: cosa diresti da Sud? La licita dei robot, il contratto, il risultato a carte viste e tutti i contratti che si fanno.', board: 'Smazzata {0}', dealer: 'Mazziere', vul: 'In zona', none: 'Nessuno', all: 'Tutti', q: 'Tocca a te da Sud: cosa dichiari?', you: 'La tua mano (Sud)', sofar: 'La licita finora', show: 'Mostra la risposta', robot: 'Il robot ha dichiarato', full: 'La smazzata intera', auction: 'Licita', contract: 'Contratto', passed: 'Tutti passano', lead: 'Attacco', ddr: 'A carte viste il giocante fa {0} prese: {1}.', made: 'contratto fatto', over: 'fatto con {0} in più', down: '{0} down', table: 'Contratti che si fanno (carte viste)', tricks: 'prese', play: '▶ Gioca questa smazzata contro i robot', prev: 'Smazzate precedenti', learn: 'Impara il bridge' },
  de: { h: 'Das Board des Tages', home: 'Bridgetisch', seats: 'NOSW', nt: 'SA', pass: 'Passe', d: 'Bridge-Board des Tages vom {0}: Was bietest du als Süd? Die Reizung der Roboter, der Kontrakt, das Double-Dummy-Ergebnis und alle erfüllbaren Kontrakte.', board: 'Board {0}', dealer: 'Teiler', vul: 'In Gefahr', none: 'Niemand', all: 'Alle', q: 'Du bist als Süd dran: Was bietest du?', you: 'Dein Blatt (Süd)', sofar: 'Die Reizung bisher', show: 'Antwort zeigen', robot: 'Der Roboter bot', full: 'Das ganze Board', auction: 'Reizung', contract: 'Kontrakt', passed: 'Alle passen', lead: 'Ausspiel', ddr: 'Double Dummy macht der Alleinspieler {0} Stiche: {1}.', made: 'erfüllt', over: 'erfüllt mit {0} Überstich(en)', down: '{0} Faller', table: 'Erfüllbare Kontrakte (Double Dummy)', tricks: 'Stiche', play: '▶ Dieses Board gegen die Roboter spielen', prev: 'Frühere Boards', learn: 'Bridge lernen' },
  ru: { h: 'Сдача дня', home: 'Бридж-стол', seats: 'СВЮЗ', nt: 'БК', pass: 'Пас', d: 'Бриджевая сдача дня {0}: что бы вы заявили за Юга? Торговля роботов, контракт, результат в открытую и все выполнимые контракты.', board: 'Сдача {0}', dealer: 'Сдающий', vul: 'В зоне', none: 'Никто', all: 'Все', q: 'Ваша очередь за Юга: что вы заявите?', you: 'Ваша рука (Юг)', sofar: 'Торговля до вас', show: 'Показать ответ', robot: 'Робот заявил', full: 'Вся сдача', auction: 'Торговля', contract: 'Контракт', passed: 'Все пас', lead: 'Первый ход', ddr: 'В открытую разыгрывающий берёт {0} взяток: {1}.', made: 'контракт выполнен', over: 'выполнен с {0} лишними', down: 'без {0}', table: 'Выполнимые контракты (в открытую)', tricks: 'взяток', play: '▶ Сыграйте эту сдачу против роботов', prev: 'Прошлые сдачи', learn: 'Учим бридж' },
  pl: { h: 'Rozdanie dnia', home: 'Stół Brydżowy', seats: 'NESW', nt: 'BA', pass: 'Pas', d: 'Brydżowe rozdanie dnia {0}: co licytujesz jako S? Licytacja robotów, kontrakt, wynik w widne karty i wszystkie realne kontrakty.', board: 'Rozdanie {0}', dealer: 'Rozdaje', vul: 'Po partii', none: 'Nikt', all: 'Wszyscy', q: 'Twoja kolej jako S: co licytujesz?', you: 'Twoja ręka (S)', sofar: 'Dotychczasowa licytacja', show: 'Pokaż odpowiedź', robot: 'Robot zalicytował', full: 'Całe rozdanie', auction: 'Licytacja', contract: 'Kontrakt', passed: 'Wszyscy pasują', lead: 'Wist', ddr: 'W widne karty rozgrywający bierze {0} lew: {1}.', made: 'kontrakt ugrany', over: 'ugrany z {0} nadróbką', down: '{0} bez', table: 'Realne kontrakty (widne karty)', tricks: 'lew', play: '▶ Zagraj to rozdanie z robotami', prev: 'Poprzednie rozdania', learn: 'Nauka brydża' },
  zh: { h: '每日一牌', home: '桥牌桌', seats: '北东南西', nt: 'NT', pass: '不叫', d: '{0}的每日桥牌:你坐南家会叫什么?机器人的叫牌、定约、双明手结果以及所有能做成的定约。', board: '第{0}副', dealer: '发牌', vul: '有局', none: '双无', all: '双有', q: '轮到南家的你:你叫什么?', you: '你的牌(南)', sofar: '到目前为止的叫牌', show: '查看答案', robot: '机器人叫了', full: '全副牌', auction: '叫牌', contract: '定约', passed: '四家不叫', lead: '首攻', ddr: '双明手庄家拿{0}墩:{1}。', made: '完成', over: '超{0}墩完成', down: '宕{0}', table: '能做成的定约(双明手)', tricks: '墩', play: '▶ 与机器人打这副牌', prev: '往日牌例', learn: '学桥牌' },
};
const f = (s, ...a) => s.replace(/\{(\d)\}/g, (m, i) => a[i]);
const hl = l => l === 'no' ? 'nb' : l;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// the engine, as in the page (the fast solver too)
const ctx = { window: {}, console, performance, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder, URL, crypto: globalThis.crypto, atob: globalThis.atob };
ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx);
for (const file of ['dds.js', 'core.js', 'bidding.js', 'play.js']) vm.runInContext(fs.readFileSync(root + 'js/' + file, 'utf8'), ctx, { filename: file });
const E = {}; for (const fn of ctx.window.BRIDGE) fn(E);

// the day (Istanbul time) and a deal of its own: the same date always gives the same deal
const today = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
let s0 = 0; for (const ch of 'bridge-table-daily-' + today) s0 = (s0 * 31 + ch.charCodeAt(0)) >>> 0;
const rnd = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const dayNo = Math.round((Date.parse(today) - Date.parse(today.slice(0, 4) + '-01-01')) / 864e5);
const board = dayNo % 16 + 1, dealer = E.dealerOf(board);
const cards = [0, 1].map(() => ({ conv: { ...E.sysOf('twoone').conv }, agg: 0, sys: 'twoone' }));
const over = a => (a.length >= 4 && a.slice(-3).every(e => e.call === 'P') && a.some(e => e.call !== 'P')) || (a.length === 4 && a.every(e => e.call === 'P'));
function tryDeal() {
  const p = [...Array(52).keys()]; for (let k = 51; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [p[k], p[j]] = [p[j], p[k]]; }
  const deal = [0, 1, 2, 3].map(s => p.slice(s * 13, s * 13 + 13)); const auc = []; let t = dealer;
  while (!over(auc) && auc.length < 60) { const r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); t = (t + 1) % 4; }
  return { deal, auc };
}
// a deal worth looking at: South has a real decision (a bid, not a pass, at the first turn) and the contract is a game or more
let D = null;
// a day already written keeps its deal (written again after a change in the robots, the cards stay the same)
const kept = path.join(root, 'daily', today + '.json');
if (fs.existsSync(kept)) {
  const deal = JSON.parse(fs.readFileSync(kept, 'utf8')).deal, auc = []; let t = dealer;
  while (!over(auc) && auc.length < 60) { const r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); t = (t + 1) % 4; }
  D = { deal, auc, first: auc.findIndex(e => e.seat === 2) };
}
for (let k = 0; k < 400 && !D; k++) {
  const x = tryDeal(), first = x.auc.findIndex(e => e.seat === 2), bids = x.auc.filter(e => typeof e.call === 'number');
  if (first >= 0 && x.auc[first].call !== 'P' && bids.length && E.LV(bids[bids.length - 1].call) >= 3) D = { ...x, first };
}
if (!D) throw new Error('no deal');
const bids = D.auc.filter(e => typeof e.call === 'number'), last = bids[bids.length - 1];
const strain = E.ST(last.call), side = last.seat & 1;
const decl = D.auc.find(e => typeof e.call === 'number' && E.ST(e.call) === strain && (e.seat & 1) === side).seat;
let dbl = 0; for (let i = D.auc.indexOf(last) + 1; i < D.auc.length; i++) { if (D.auc[i].call === 'X') dbl = 1; if (D.auc[i].call === 'XX') dbl = 2; }
const con = { level: E.LV(last.call), strain, decl, dbl };
(async () => {
  const m = await vm.runInContext('ddsFactory', ctx)(); E.ddsUse(m);
  const tricks = E.ddContract(D.deal, con);
  // every strain for every declarer
  const table = [0, 1, 2, 3].map(d => [0, 1, 2, 3, 4].map(st => E.ddContract(D.deal, { level: 1, strain: st, decl: d, dbl: 0 })));
  // the robot's opening lead
  const g = E.newPlayState(D.deal, con, D.auc, cards); const lead = E.aiPlay(g, (decl + 1) % 4, { budget: 3000, maxSamples: 100, ddTricks: 12, lead: { budget: 6000, maxSamples: 100, minSamples: 40, evLim: 3000000, cap: 12000 } });
  const code = (() => { const a = new Uint8Array(13); D.deal.forEach((h, s) => h.forEach(c => { a[c >> 2] |= s << ((c & 3) * 2); })); return Buffer.from(a).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); })();
  const data = { date: today, board, dealer, deal: D.deal, auc: D.auc.map(e => [e.seat, e.call]), first: D.first, con, tricks, table, lead, code };
  fs.mkdirSync(root + 'daily', { recursive: true });
  fs.writeFileSync(root + 'daily/' + today + '.json', JSON.stringify(data));
  writeAll();
  console.log(today, 'board', board, 'contract', con.level + 'CDHSN'[strain], 'by', 'NESW'[decl], 'dd', tricks);
})().catch(e => { console.error(e); process.exit(1); });

// ---- the pages, from the days kept in daily/*.json ----
const RANK = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], SYM = ['♣', '♦', '♥', '♠'];
const sym = s => s === 1 || s === 2 ? `<span class="r">${SYM[s]}</span>` : SYM[s];
const suitRow = (h, s) => `<div>${sym(s)} ${h.filter(c => (c / 13 | 0) === s).sort((a, b) => b - a).map(c => RANK[c % 13]).join(' ') || '—'}</div>`;
const handHtml = (h, label) => `<div class="hand"><b>${label}</b>${[3, 2, 1, 0].map(s => suitRow(h, s)).join('')}</div>`;
const callTxt = (t, c) => c === 'P' ? t.pass : c === 'X' ? 'X' : c === 'XX' ? 'XX' : E.LV(c) + (E.ST(c) === 4 ? t.nt : sym(E.ST(c)));
const conTxt = (t, c) => c.level + (c.strain === 4 ? t.nt : sym(c.strain)) + (c.dbl === 1 ? 'X' : c.dbl === 2 ? 'XX' : '') + ' ' + t.seats[c.decl];
const vulTxt = (t, b) => { const n = E.vulOf(b, 0), e = E.vulOf(b, 1); return n && e ? t.all : n ? t.seats[0] + t.seats[2] : e ? t.seats[1] + t.seats[3] : t.none; };
function aucTable(t, auc, dealer, upto) {
  const cells = []; for (let i = 0; i < dealer; i++) cells.push('');
  auc.slice(0, upto).forEach(([, c]) => cells.push(callTxt(t, c)));
  if (upto < auc.length) cells.push('<b class="q">?</b>');
  const rows = []; for (let i = 0; i < cells.length; i += 4) rows.push('<tr>' + [0, 1, 2, 3].map(k => `<td>${cells[i + k] ?? ''}</td>`).join('') + '</tr>');
  return `<table class="auc"><tr>${[...t.seats].map(x => `<th>${x}</th>`).join('')}</tr>${rows.join('')}</table>`;
}
function page(l, d, days) {
  const t = T[l], date = new Date(d.date + 'T12:00:00Z').toLocaleDateString(l === 'no' ? 'nb-NO' : l, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const title = `${t.h}: ${date}`, desc = f(t.d, date), url = `${SITE}${l}/daily/${d.date}.html`;
  const res = d.con && d.tricks != null ? (() => { const need = d.con.level + 6, k = d.tricks - need; return f(t.ddr, d.tricks, k === 0 ? t.made : k > 0 ? f(t.over, k) : f(t.down, -k)); })() : '';
  const tbl = `<table class="dd"><tr><th></th>${[4, 3, 2, 1, 0].map(s => `<th>${s === 4 ? t.nt : sym(s)}</th>`).join('')}</tr>${[0, 2, 1, 3].map(p => `<tr><th>${t.seats[p]}</th>${[4, 3, 2, 1, 0].map(s => { const n = d.table[p][s]; return `<td${n >= 7 ? ' class="ok"' : ''}>${n >= 7 ? n - 6 : '–'}</td>`; }).join('')}</tr>`).join('')}</table>`;
  const i = days.indexOf(d.date), list = days.slice().reverse().filter(x => x !== d.date).slice(0, 14);
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, inLanguage: hl(l), datePublished: d.date, dateModified: d.date, image: SITE + 'icons/og-' + l + '.png', author: { '@type': 'Organization', name: 'Bridge Table', url: SITE }, publisher: { '@type': 'Organization', name: 'Bridge Table', logo: { '@type': 'ImageObject', url: SITE + 'icons/icon-512.png' } }, mainEntityOfPage: url };
  return `<!doctype html>
<html lang="${hl(l)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(t.home)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${LANGS.map(k => `<link rel="alternate" hreflang="${hl(k)}" href="${SITE}${k}/daily/${d.date}.html">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${SITE}en/daily/${d.date}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Bridge Table">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}icons/og-${l}.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0c1a14">
<link rel="icon" href="../../icons/icon-192.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  :root{--ink:#1d241f;--muted:#5d6a60;--felt:#1f7a2e;--line:#dcdccf;--soft:#f3f6f1;--gold:#f2c230}
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:var(--ink);font:17px/1.55 "Segoe UI",Roboto,Arial,sans-serif}
  header{background:#0c1a14;padding:10px 16px}header a{color:var(--gold);text-decoration:none;font-weight:700}
  main{max-width:720px;margin:0 auto;padding:18px 16px 48px}
  h1{font-size:28px;margin:4px 0 4px;line-height:1.2}p.lead{color:var(--muted);margin:0 0 12px}
  h2{font-size:20px;margin:26px 0 8px;padding-top:10px;border-top:2px solid var(--felt)}
  .meta{display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--muted);font-size:15px;margin-bottom:8px}.meta b{color:var(--ink)}
  .r{color:#c4122f}
  .hand{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:18px;line-height:1.5;min-width:150px}
  .hand b{display:block;font-size:14px;color:var(--muted)}
  .solo{display:inline-block}
  .compass{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:center;max-width:560px}
  .compass .n{grid-column:2}.compass .w{grid-column:1;grid-row:2}.compass .e{grid-column:3;grid-row:2}.compass .s{grid-column:2;grid-row:3}
  .compass .mid{grid-column:2;grid-row:2;text-align:center;color:var(--felt);font-weight:700}
  @media (max-width:520px){.compass{grid-template-columns:1fr 1fr}.compass .n{grid-column:1/3;justify-self:center}.compass .w{grid-column:1;grid-row:2}.compass .e{grid-column:2;grid-row:2}.compass .s{grid-column:1/3;grid-row:3;justify-self:center}.compass .mid{display:none}.hand{font-size:16px;min-width:0}}
  table.auc,table.dd{border-collapse:collapse;margin:6px 0;font-size:17px}
  table.auc th,table.auc td{width:64px;text-align:center;padding:4px;border-bottom:1px solid var(--line)}
  table.dd th,table.dd td{width:46px;text-align:center;padding:4px;border:1px solid var(--line)}table.dd td.ok{background:#e6f4e8;font-weight:700}
  .q{color:var(--felt);font-size:20px}
  .ask{font-size:20px;font-weight:700;color:var(--felt);margin:16px 0 6px}
  details{background:#fffdf3;border:1px solid #eadfae;border-radius:10px;padding:10px 14px;margin:14px 0}
  summary{cursor:pointer;font-weight:700;color:#8a6d00}
  .big{font-size:24px;font-weight:700}
  .cta{text-align:center;margin:26px 0}.cta a{display:inline-block;background:var(--gold);color:#1d1a0c;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:18px}
  ul.days{columns:2;padding-left:18px}ul.days a,.langs a,.nav a{color:var(--felt)}
  .nav{display:flex;justify-content:space-between;margin:16px 0}
  .langs{font-size:14px;color:var(--muted);margin-top:26px;border-top:1px solid var(--line);padding-top:12px;display:flex;flex-wrap:wrap;gap:6px 14px}
</style>
</head>
<body>
<header><a href="../">♠<span style="color:#ff6b6b">♥♦</span>♣ ${esc(t.home)}</a></header>
<main>
<h1>${esc(t.h)}</h1>
<p class="lead">${esc(date)}</p>
<div class="meta"><span>${f(t.board, d.board)}</span><span>${t.dealer}: <b>${t.seats[d.dealer]}</b></span><span>${t.vul}: <b>${vulTxt(t, d.board)}</b></span></div>
${handHtml(d.deal[2], t.you).replace('class="hand"', 'class="hand solo"')}
<h2>${t.sofar}</h2>
${aucTable(t, d.auc, d.dealer, d.first)}
<p class="ask">${t.q}</p>
<details><summary>${t.show}</summary>
<p>${t.robot}: <span class="big">${callTxt(t, d.auc[d.first][1])}</span></p>
<h2>${t.full}</h2>
<div class="compass">${handHtml(d.deal[0], t.seats[0]).replace('class="hand"', 'class="hand n"')}${handHtml(d.deal[3], t.seats[3]).replace('class="hand"', 'class="hand w"')}<div class="mid">${f(t.board, d.board)}</div>${handHtml(d.deal[1], t.seats[1]).replace('class="hand"', 'class="hand e"')}${handHtml(d.deal[2], t.seats[2]).replace('class="hand"', 'class="hand s"')}</div>
<h2>${t.auction}</h2>
${aucTable(t, d.auc, d.dealer, d.auc.length)}
<p>${t.contract}: <b>${d.con ? conTxt(t, d.con) : t.passed}</b>${d.lead != null ? ` · ${t.lead}: <b>${sym(d.lead / 13 | 0)}${RANK[d.lead % 13]}</b>` : ''}</p>
<p>${res}</p>
<h2>${t.table}</h2>
${tbl}
</details>
<div class="cta"><a href="../../?lang=${l}#d=${d.code}&b=${d.board}">${t.play}</a></div>
<div class="nav">${i > 0 ? `<a href="${days[i - 1]}.html">← ${days[i - 1]}</a>` : '<span></span>'}${i < days.length - 1 ? `<a href="${days[i + 1]}.html">${days[i + 1]} →</a>` : ''}</div>
${list.length ? `<h2>${t.prev}</h2><ul class="days">${list.map(x => `<li><a href="${x}.html">${x}</a></li>`).join('')}</ul>` : ''}
<p><a href="../learn/how-to-play.html" style="color:var(--felt)">${t.learn}</a></p>
<nav class="langs">${LANGS.filter(k => k !== l).map(k => `<a href="../../${k}/daily/${d.date}.html" hreflang="${hl(k)}">${NAMES[k]}</a>`).join('')}</nav>
</main>
</body>
</html>
`;
}
function writeAll() {
  let days = fs.readdirSync(root + 'daily').filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).map(x => x.slice(0, 10)).sort();
  // only the last KEEP days stay; older days' data and pages are removed
  for (const x of days.slice(0, Math.max(0, days.length - KEEP))) { fs.rmSync(root + 'daily/' + x + '.json'); for (const l of LANGS) fs.rmSync(root + l + '/daily/' + x + '.html', { force: true }); }
  days = days.slice(-KEEP);
  for (const l of LANGS) {
    fs.mkdirSync(root + l + '/daily', { recursive: true });
    for (const x of days) {
      const d = JSON.parse(fs.readFileSync(root + 'daily/' + x + '.json', 'utf8'));
      fs.writeFileSync(root + l + '/daily/' + x + '.html', page(l, d, days));
    }
    // the newest day at /daily/ too (its address does not change, so it can be linked)
    const newest = days[days.length - 1];
    fs.writeFileSync(root + l + '/daily/index.html', fs.readFileSync(root + l + '/daily/' + newest + '.html', 'utf8'));
    // the language page: a link to the hand of the day
    const lp = root + l + '/index.html', t = T[l];
    if (fs.existsSync(lp)) {
      let s = fs.readFileSync(lp, 'utf8');
      const block = `<!--daily--><p class="more"><a href="daily/">🃏 ${esc(t.h)}</a></p><!--/daily-->`;
      s = s.includes('<!--daily-->') ? s.replace(/<!--daily-->[\s\S]*?<!--\/daily-->/, block) : s.replace('<p class="more">', block + '\n<p class="more">');
      fs.writeFileSync(lp, s);
    }
  }
  // the sitemap: the days kept and each language's /daily/
  let sm = fs.readFileSync(root + 'sitemap.xml', 'utf8').replace(/\s*<url><loc>[^<]*\/daily\/[^<]*<\/loc>.*?<\/url>/g, '');
  const add = LANGS.map(l => `  <url><loc>${SITE}${l}/daily/</loc><lastmod>${days[days.length - 1]}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`)
    .concat(days.flatMap(x => LANGS.map(l => `  <url><loc>${SITE}${l}/daily/${x}.html</loc><lastmod>${x}</lastmod><changefreq>yearly</changefreq><priority>0.5</priority></url>`)));
  fs.writeFileSync(root + 'sitemap.xml', sm.replace('</urlset>', add.join('\n') + '\n</urlset>'));
}
