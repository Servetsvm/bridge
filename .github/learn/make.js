// Makes the convention lessons (lessons.js) in the ten languages from each language's Stayman lesson (its head, style,
// header and footer), links every lesson to every other one ("More lessons"), lists them on the language pages and in
// the sitemap. Run from the repository root: node .github/learn/make.js
const fs = require('fs');
const { cta: CTA, lessons: NEW } = require('./lessons.js');
const LANGS = ['en', 'tr', 'no', 'es', 'fr', 'it', 'de', 'ru', 'pl', 'zh'];
const OLD = ['how-to-play', 'scoring', 'stayman', 'transfers', 'rkcb'];
const SITE = 'https://servetsvm.github.io/bridge/';
const day = new Date().toISOString().slice(0, 10);
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const red = s => s.replace(/[♥♦]/g, c => `<span class="r">${c}</span>`);
const one = (s, re, what) => { const m = s.match(re); if (!m) throw new Error('not found: ' + what); return m; };

// the title of every lesson in every language (the old ones from their pages, the new ones from lessons.js)
const titles = {};
for (const L of LANGS) {
  titles[L] = {};
  for (const k of OLD) titles[L][k] = one(read(`${L}/learn/${k}.html`), /<h1>([^<]*)<\/h1>/, L + ' ' + k)[1];
  for (const n of NEW) titles[L][n.slug] = n[L].t;
}
const ALL = [...OLD, ...NEW.map(n => n.slug)];
const moreList = (L, self) => '<ul>' + ALL.filter(k => k !== self).map(k => `<li><a href="${k}.html">${red(titles[L][k])}</a></li>`).join('') + '</ul>';

for (const L of LANGS) {
  const tpl = read(`${L}/learn/stayman.html`);
  const tT = one(tpl, /<h1>([^<]*)<\/h1>/, 'h1')[1], tD = one(tpl, /<meta name="description" content="([^"]*)">/, 'desc')[1];
  const play = one(tpl, /<div class="cta"><p>[^<]*<\/p><a href="[^"]*">([^<]*)<\/a><\/div>/, 'cta')[1];
  for (const n of NEW) {
    const c = n[L], esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    let h = tpl.split('learn/stayman.html').join(`learn/${n.slug}.html`);
    h = h.split(`"${tT}"`).join(JSON.stringify(c.t)).split(`"${tD}"`).join(JSON.stringify(c.d));   // the JSON-LD
    h = h.split(tT).join(esc(c.t)).split(tD).join(esc(c.d));                                       // title, meta, og
    h = h.replace(/"datePublished":"[^"]*","dateModified":"[^"]*"/, `"datePublished":"${day}","dateModified":"${day}"`);
    h = h.replace(/<h1>[^<]*<\/h1>\n<p class="lead">[^\n]*<\/p>\n[\s\S]*?<div class="cta">[\s\S]*?<\/div>/,
      `<h1>${red(c.t)}</h1>\n<p class="lead">${red(c.d)}</p>\n` + c.s.map(([hd, body]) => `<h2>${red(hd)}</h2>\n${red(body)}`).join('\n') +
      `\n<div class="cta"><p>${CTA[L]}</p><a href="../../?lang=${L}&amp;prac=${n.prac}">${play}</a></div>`);
    h = h.replace(/<div class="more"><h2>([^<]*)<\/h2><ul>[\s\S]*?<\/ul><\/div>/, (_, t) => `<div class="more"><h2>${t}</h2>${moreList(L, n.slug)}</div>`);
    fs.writeFileSync(`${L}/learn/${n.slug}.html`, h);
  }
  // the old lessons: "More lessons" with the new ones too
  for (const k of OLD) {
    const f = `${L}/learn/${k}.html`, s = read(f);
    fs.writeFileSync(f, s.replace(/<div class="more"><h2>([^<]*)<\/h2><ul>[\s\S]*?<\/ul><\/div>/, (_, t) => `<div class="more"><h2>${t}</h2>${moreList(L, k)}</div>`));
  }
  // the language page: every lesson in its list
  const f = `${L}/index.html`, s = read(f);
  const t = s.replace(/(<!--learn--><section class="learn"><h2>[^<]*<\/h2>)<ul>[\s\S]*?<\/ul>/, (_, a) => a + '<ul>' + ALL.map(k => `<li><a href="learn/${k}.html">${red(titles[L][k])}</a></li>`).join('') + '</ul>');
  if (t === s && !NEW.every(n => s.includes(`learn/${n.slug}.html`))) throw new Error('learn list not found ' + f);
  fs.writeFileSync(f, t);
}
// the sitemap
let sm = read('sitemap.xml');
const add = LANGS.flatMap(L => NEW.map(n => `${SITE}${L}/learn/${n.slug}.html`)).filter(u => !sm.includes(`<loc>${u}</loc>`));
sm = sm.replace('</urlset>', add.map(u => `  <url><loc>${u}</loc><lastmod>${day}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`).join('') + '</urlset>');
fs.writeFileSync('sitemap.xml', sm);
console.log('lessons', LANGS.length * NEW.length, 'sitemap +', add.length);
