// The pictures shown when a page is shared or found (icons/og-<language>.png, 1200×630): the name, a title, three
// points, and a fan of cards, in each language. Run: node tools/og/og.mjs  (uses the Chrome driver of tools/smoke)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'tools/smoke/package.json'));
const puppeteer = require('puppeteer-core');
const T = {
  tr: ['Ücretsiz online briç', ['Usta robotlarla her an oyna', 'Arkadaşlarınla online oyna', 'Herkes aynı eller: seviyeni ölç'], 'Ücretsiz · reklamsız'],
  en: ['Free online bridge', ['Play expert robots any time', 'Play online with friends', 'Same hands for all: measure your level'], 'Free · no ads'],
  no: ['Gratis bridge på nett', ['Spill mot dyktige roboter når som helst', 'Spill på nett med venner', 'Samme kort for alle: mål nivået ditt'], 'Gratis · uten reklame'],
  es: ['Bridge online gratis', ['Juega contra robots expertos cuando quieras', 'Juega online con amigos', 'Mismas manos para todos: mide tu nivel'], 'Gratis · sin anuncios'],
  fr: ['Bridge en ligne gratuit', ['Jouez contre des robots experts à tout moment', 'Jouez en ligne avec vos amis', 'Mêmes donnes pour tous : mesurez votre niveau'], 'Gratuit · sans publicité'],
  it: ['Bridge online gratis', ['Gioca con robot esperti quando vuoi', 'Gioca online con gli amici', 'Stesse mani per tutti: misura il tuo livello'], 'Gratis · senza pubblicità'],
  de: ['Kostenloses Online-Bridge', ['Spiele jederzeit gegen starke Roboter', 'Spiele online mit Freunden', 'Gleiche Hände für alle: miss dein Niveau'], 'Kostenlos · ohne Werbung'],
  ru: ['Бесплатный онлайн-бридж', ['Играйте с сильными роботами в любое время', 'Играйте онлайн с друзьями', 'Одни сдачи для всех: оцените свой уровень'], 'Бесплатно · без рекламы'],
  pl: ['Darmowy brydż online', ['Graj z mocnymi robotami o każdej porze', 'Graj online ze znajomymi', 'Te same rozdania dla wszystkich: zmierz swój poziom'], 'Za darmo · bez reklam'],
  zh: ['免费在线桥牌', ['随时与专家机器人对局', '与朋友在线打牌', '人人同一副牌：测出你的水平'], '免费 · 无广告'],
};
const card = (r, s, red, i) => `<div class="c" style="transform:rotate(${-24 + i * 12}deg) translateY(${Math.abs(i - 2) * 8}px);z-index:${i}"><b class="${red ? 'r' : ''}">${r}<br>${s}</b>${i === 4 ? `<i>${s}</i>` : ''}</div>`;
const html = (l, [title, pts, foot]) => `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;font-family:"Segoe UI",Roboto,"Noto Sans","Microsoft YaHei",Arial,sans-serif;color:#f7f1df;
background:radial-gradient(ellipse at 70% 45%,#248a46 0%,#16683a 45%,#0e3f24 100%);position:relative;overflow:hidden}
.brand{position:absolute;left:70px;top:78px;font-size:30px;font-weight:700;color:#f4c430;letter-spacing:.5px}.brand>span{color:#fff;margin-right:14px}.brand .rd{color:#e34b4b}
h1{position:absolute;left:70px;top:150px;width:600px;font-size:66px;line-height:1.08;font-weight:800}
ul{position:absolute;left:70px;top:${l === 'zh' ? 300 : 320}px;list-style:none;padding:0;width:620px}li{font-size:27px;margin:0 0 18px;display:flex;align-items:center;gap:14px}
li:before{content:"✓";flex:none;width:34px;height:34px;border-radius:50%;background:#f4c430;color:#2a2108;font-weight:900;font-size:21px;display:grid;place-items:center}
.foot{position:absolute;left:70px;bottom:46px;font-size:24px;opacity:.9}.url{position:absolute;right:60px;bottom:46px;font-size:24px;opacity:.9}
.fan{position:absolute;right:120px;top:120px;width:360px;height:360px}
.c{position:absolute;left:90px;top:10px;width:210px;height:300px;border-radius:18px;background:linear-gradient(160deg,#fffdf6,#efe8d6);box-shadow:0 14px 30px rgba(0,0,0,.35);transform-origin:50% 120%}
.c b{position:absolute;left:18px;top:14px;font:700 40px/1 Georgia,serif;color:#1b1b1b;text-align:center}.c b.r{color:#c4122f}.c i{position:absolute;left:50%;top:50%;transform:translate(-50%,-40%);font-style:normal;font-size:110px;color:#1b1b1b}
</style><div class="brand"><span>♠<span class="rd">♥♦</span>♣</span>BridgePlay</div><h1>${title}</h1><ul>${pts.map(p => `<li>${p}</li>`).join('')}</ul>
<div class="foot">${foot}</div><div class="url">servetsvm.github.io/bridge</div>
<div class="fan">${[['A', '♠', 0], ['K', '♥', 1], ['Q', '♦', 1], ['J', '♣', 0], ['10', '♠', 0]].map(([r, s, red], i) => card(r, s, red, i)).join('')}</div>`;
const chrome = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 630 });
for (const [l, t] of Object.entries(T)) { await p.setContent(html(l, t), { waitUntil: 'load' }); await p.screenshot({ path: path.join(ROOT, 'icons', 'og-' + l + '.png') }); console.log('icons/og-' + l + '.png'); }
await b.close();
