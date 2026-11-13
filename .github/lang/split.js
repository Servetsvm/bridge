// Splits js/lang.js (every language, the file the texts are edited in) into js/lang/<language>.js: each holds only its
// own language, so a visitor downloads one language instead of ten. The page loads the visitor's file first (the small
// loader in index.html) and app.js fetches another one when the language is changed. build.ps1 runs this.
// The files use `var` and add their language to what is already there, so a second language can be loaded later.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '../..') + '/';
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root + 'js/lang.js', 'utf8') + '\n;this.__L = { I18N, LANGS, SEAT_T, SEAT_AB_T, CONV_T, SYS_T, BID_PH };', ctx);
const { I18N, LANGS, SEAT_T, SEAT_AB_T, CONV_T, SYS_T, BID_PH } = ctx.__L;
const J = v => JSON.stringify(v);
fs.mkdirSync(root + 'js/lang', { recursive: true });
let total = 0;
for (const [L] of LANGS) {
  const out = `/* Bridge Table — the texts in one language (${L}), made from js/lang.js by .github/lang/split.js: do not edit here. */
var I18N = window.I18N || {};${L === 'en' ? '' : ` I18N[${J(L)}] = ${J(I18N[L] || {})};`}
var CONV_T = window.CONV_T || {};${L === 'en' ? '' : ` CONV_T[${J(L)}] = ${J(CONV_T[L] || {})};`}
var SYS_T = window.SYS_T || {};${L === 'en' ? '' : ` SYS_T[${J(L)}] = ${J(SYS_T[L] || {})};`}
var LANGS = ${J(LANGS)};
var SEAT_T = ${J(SEAT_T)};
var SEAT_AB_T = ${J(SEAT_AB_T)};
var BID_PH = ${J(BID_PH)};
`;
  fs.writeFileSync(root + 'js/lang/' + L + '.js', out);
  total += out.length;
}
console.log('lang files', LANGS.length, Math.round(total / 1024) + 'KB in all');
