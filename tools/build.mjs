// Builds dist/bridge-table.html, the same as build.ps1 (for a computer without PowerShell):  node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => readFileSync(join(root, f), 'utf8');
execFileSync(process.execPath, [join(root, '.github/lang/split.js')], { stdio: 'inherit' });   // js/lang/<language>.js
let html = rd('index.html');
const lm = html.match(/<!--lang-->[\s\S]*?<!--\/lang-->/);
if (lm) html = html.split(lm[0]).join(`<script>\n${rd('js/lang.js')}\n</script>`);
html = html.split('<link rel="stylesheet" href="css/style.css">').join(`<style>\n${rd('css/style.css')}\n</style>`);
for (const m of [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)]) html = html.split(m[0]).join(`<script>\n${rd(m[1])}\n</script>`);
const icon = readFileSync(join(root, 'icons/icon-192.png')).toString('base64');
html = html.split('<link rel="manifest" href="manifest.webmanifest">').join('');
html = html.split('href="icons/icon-192.png"').join(`href="data:image/png;base64,${icon}"`);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/bridge-table.html'), html);
console.log('Built dist/bridge-table.html');
