// The smoke test: before a publish, a real Chrome (headless) opens the site from this folder and plays two whole boards
// against the robots (the test bids and plays your seat with the robots' own choice), then checks the result was
// scored and nothing went wrong on the page. Exit code 0 = fine, 1 = something is broken (the publish stops).
// Run: node tools/smoke/smoke.mjs            (Chrome from CHROME, else the usual places on Windows and Linux)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BOARDS = +process.env.SMOKE_BOARDS || 1;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };

// the site from this folder (the same files GitHub Pages serves)
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const chrome = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
if (!chrome) { console.error('smoke: no Chrome found (set CHROME)'); process.exit(1); }

const problems = [];
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 600000, args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900'] });
let ok = false;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  // nothing leaves this computer: the online database, the chat AI, fonts … are refused (the game works without them)
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort(); });
  page.on('pageerror', e => problems.push('page error: ' + (e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|ERR_INTERNET|ERR_NAME|ERR_CONNECTION/i.test(m.text())) problems.push('console: ' + m.text()); });
  await page.goto(base + '?smoke=1', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof G !== 'undefined' && G && typeof newBoard === 'function' && window.BRIDGE, { timeout: 30000 });

  for (let n = 1; n <= BOARDS; n++) {
    const t0 = Date.now();
    // a new board, fast (the robots think briefly: this checks that the game runs, not how well they play); your seat
    // is bid and played by the test with the robots' own choice
    const start = await page.evaluate(() => { try { closeOv(); } catch (e) {} ui.overlay = null; SET.speed = 2; if (typeof BOT_OPT !== 'undefined') { Object.assign(BOT_OPT, { budget: 80, maxSamples: 10, minSamples: 4, cap: 400 }); if (BOT_OPT.lead) Object.assign(BOT_OPT.lead, { budget: 80, maxSamples: 10, minSamples: 4, cap: 400 }); } const h0 = HIST.length; newBoard(); return { h0, phase: G.phase }; });
    if (start.phase !== 'bid') throw new Error(`board ${n}: did not start (phase ${start.phase})`);
    const res = await page.evaluate(async h0 => {
      const until = Date.now() + 360000;   // a busy computer can take a few minutes
      while (Date.now() < until) {
        await new Promise(r => setTimeout(r, 120));
        if (G.phase === 'done') break;
        try { closeOv(); } catch (e) {}
        if (G.phase === 'bid' && bidTurn() === U()) { const r = E.aiBid(G.auction, U(), G.deal[U()], G.cards); makeCall(U(), r.call, r.m); continue; }
        if (G.phase === 'play') { const g = G.play; if (g.trick.length < 4 && g.turn >= 0 && userControls(g.turn) && g.hands[g.turn].length) { const c = E.aiPlay(g, g.turn, { budget: 60, maxSamples: 12, cap: 600 }); playCard(g.turn, c); } }
      }
      const bar = document.getElementById('bar'), table = document.getElementById('table');
      return { phase: G.phase, saved: HIST.length > h0, ns: G.result && G.result.ns, passed: !!(G.result && G.result.passed), bar: !!(bar && bar.offsetHeight > 20), table: !!(table && table.offsetHeight > 100), cards: document.querySelectorAll('.card').length };
    }, start.h0);
    const s = ((Date.now() - t0) / 1000).toFixed(0);
    if (res.phase !== 'done') throw new Error(`board ${n}: not finished in 6 minutes (phase ${res.phase})`);
    if (!res.saved) throw new Error(`board ${n}: the result was not saved`);
    if (!res.bar || !res.table) throw new Error(`board ${n}: the screen is broken (bar ${res.bar}, table ${res.table})`);
    console.log(`smoke: board ${n} played in ${s} s — ${res.passed ? 'passed out' : 'NS ' + res.ns}`);
  }
  // the screen after the boards: the results window opens
  const shot = await page.evaluate(() => { try { closeOv(); showResults(); } catch (e) { return String(e); } return ui.overlay; });
  if (shot !== 'res') problems.push('the results window did not open (' + shot + ')');
  ok = !problems.length;
} catch (e) {
  problems.push(String(e.message || e));
} finally {
  await browser.close();
  server.close();
}
for (const p of problems) console.error('smoke: ' + p);
console.log(ok ? 'smoke: OK' : 'smoke: FAILED');
process.exit(ok ? 0 : 1);
