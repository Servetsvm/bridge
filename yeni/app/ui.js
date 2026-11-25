/* BridgePlay (new) — the screen: one page at a time (with the phone's Back), a top bar, sheets and short messages. */
import { T } from './i18n.js';

export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---- pages: each a function that draws into the main area; Back goes to the one before (the phone's Back too) ----
const pages = {}, stack = [];
let cleanup = null;
export function page(name, fn) { pages[name] = fn; }
export function go(name, arg, replace) {
  if (!pages[name]) return;
  if (replace) stack.pop();
  stack.push({ name, arg });
  try { history.pushState({ d: stack.length }, ''); } catch (e) {}
  draw();
}
export function back() { if (stack.length > 1) history.back(); }
addEventListener('popstate', () => { if (stack.length > 1) { stack.pop(); draw(); } else try { history.pushState({ d: 1 }, ''); } catch (e) {} });
export const current = () => stack[stack.length - 1] || {};
export function redraw() { draw(true); }
function draw(keepScroll) {
  const top = stack[stack.length - 1]; if (!top) return;
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  const main = $('#main'), y = keepScroll ? main.scrollTop : 0;
  const r = pages[top.name](top.arg) || {};
  $('#bar').innerHTML = `${stack.length > 1 ? `<button class="tb-back" data-back aria-label="${T('Back')}">‹</button>` : '<span class="tb-logo">♠♥♦♣</span>'}
    <h1>${esc(r.title || 'BridgePlay')}</h1><div class="tb-right">${r.right || ''}</div>`;
  main.innerHTML = r.html || '';
  main.scrollTop = y;
  cleanup = r.cleanup || null;
  if (r.after) r.after(main);
}
document.addEventListener('click', e => { if (e.target.closest('[data-back]')) back(); });

// ---- a short message at the bottom ----
let toastT = 0;
export function toast(msg, ms = 2200) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms);
}
// ---- a sheet from the bottom (closed by its ✕, by tapping outside, or by Back) ----
export function sheet(html, onOpen) {
  closeSheet();
  const w = document.createElement('div'); w.id = 'sheet';
  w.innerHTML = `<div class="sh-bg" data-shclose></div><div class="sh"><button class="sh-x" data-shclose aria-label="${T('Close')}">✕</button>${html}</div>`;
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('on'));
  if (onOpen) onOpen(w);
  return w;
}
export function closeSheet() { const w = $('#sheet'); if (w) w.remove(); }
document.addEventListener('click', e => { if (e.target.closest('[data-shclose]')) closeSheet(); });

// ---- suits ----
export const SUITS = ['♣', '♦', '♥', '♠'];
export const suitHtml = (s, t = SUITS[s]) => `<span class="su su${s}">${t}</span>`;
// a contract or a call as text with coloured suits: "4♠", "3NT X"
export const contractHtml = c => {
  if (!c) return '—';
  if (typeof c === 'string') return esc(c).replace(/[♣♦♥♠]/g, m => suitHtml(SUITS.indexOf(m)));
  return '';
};
