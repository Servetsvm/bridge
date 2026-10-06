/* Bridge Table — read a deal from a picture, on the device, without any online service.
   Two kinds of pictures are understood:
   1. the end-of-board screen of a club bridge app: four open hands drawn as white card tiles
      (rank on top, suit below); North across the top, South across the bottom, West/East in the middle;
   2. a hand record (results page, hand diagram): each hand is four lines ♠ ♥ ♦ ♣ followed by the ranks,
      North at the top, South at the bottom, West left, East right.
   Everything works by finding the dark/red glyphs on white and comparing them with small templates. */
const Photo = (() => {
  'use strict';
  const GW = 12, GH = 16;
  /* glyph templates taken from a real end-of-board screenshot (12x16 bitmaps, hex) */
  const TILE = {"R":{"2":["1fc3fe7fe70ff0ff0f00f01e03c0f81f03c0780fffffffff","2f07fc7fcf1ee0e00e00f01f03e0f81e07c0780fd8ffeffe","1f87fcfbc60f60700f01c01c07c1e03c0780780ffcffe7fc","1f83fc7fef0ee0ee0e60e01e07c1f83e03c0780fffffffff"],"3":["1f83fc79ef0ff0f00e07c07c07f00fe0ff0ff0f7fe3fc0f0","0601fc3fc70c60400c03e03c03c01e00fc0fe0ef9c3fc3e0","03c03e01e00e00e01e03e01e01e00e00f60ef1efbc7fc178","1f87fc7fef0ee0e00e07c0fc07e00ee0fe0ff1e7fe7fc1f8"],"4":["01c03c07c0fc0fc1dc39c71c61cfffffffff7fc01c01c01c","03c03c07c0fc1fc1fc3bc73ce3cffcffffffffe03c03c03c","03c07e03c0fc03c19c39c51c21c71ef1efffffe01e01e00e","03803803e07e078018418508e1effffff5fe0ff03e01c008"],"5":["0783fc7d8700f00f00fbc7fe01f00e00600700ef1cffc7f8","3fe7fe7e87007707fc7fcf9e00f00f00fe0ff1e7fc3f8060","1807f83f0e00f00fc0f704f401f00e00e00ee1e7fc7f0060","3fe7fe7807807007fc7fe79e70f007207e0ff0f7fe3fc1f8"],"6":["1fc3fe78e70ff00f78ffcffef0ff0ff0ff0f78f3fe1fc0f8","1f87f871c700700f70ffcffcf0fe07e0e70f71f3fc1f0070","3e83f831c700600eb8ff8ffcf0ff0ee0e60f30e3fc3fc160","1f83fc79ff0ff00ef8ffcffef0ff0ff07f0ff0f7fe3fc1f8"],"7":["fffffffff01e01c0380780f00f00e01e01e01e01e01e03c0","7fdfffffc01c01c0000300700600e00a01c01c0380780600","ffcffefff01e00e02c0180300601e01f01e01c01c01c00c0","fffffffff01e03c0380700700e01e01e01e03c03c03c03c0"],"8":["3fc3fc70e70670e70c7fc3fc77ce0ee0f60770e78e7fc2e0","0243ff75f70660730f7ef7ff7fee064066077063ef1ff0ec","1f87fc7fef0ee0e71e7fc7fc7fee0fe0fe0ff1f7fe3fc040","1f83fc71e70e70e70e3fc3fc7fee0ee0fe0ff0e7fe3fc1f8"],"9":["3f87fcfbef0ee0fe0fe0ff1f7ff3ef00fe0ef1e7fc3f81e0","1f83fc7fef0ef0ff0ff0ff0f7ff3ff00f60ff0e7fc3f81f0","0b01f83fc70ff0ff0e70f7ff7ff04f00e00f70c3ec1f8060","3f07707f8e1ae0ec0ee0fe0fe1ffff7ff4af00c00c01c028"],"10":["33e33ff77f77f7777777777777777777777777777773f73e","33e73ff77f77f7777777777777777777777777777773e33e","787f87f87f9ff9f79f79f79f79f79e79e79f71f78f78f78e","e3fe67ee7e67e67e63663663e63e63e636636676e767f272"],"K":["e1ee3ce38e78ef0ee0fe0fe0ff0f78e38e3ce3ee1ee0ee0f","e1ee3ce38e78ef0ee0fe0fe0ff0f78e78e3ce3ce1ee0ee0f","40ec1cc3cc78c70ef0ff0ff0ff0ff8e38e3cc1ec0ec0f003","605e1ee38e78ef0ff0ff0ff0ff8f38e1ce1ce1fe0f403001"],"J":["01f01f01f01f01f01f01f01f01f61ff1ff1ff1e7fe3fc1f8","00e00e00f00f00f00f00f00f00f00f00f61ef2e7fc3f41e0","00200f00e01e01e01e00e00e01e01e01e61ef1effe5f4110","00f00f00f00f00f00f00f00f00fe0ff0ff0ff1fffe7fc1f8"],"Q":["1f83fc7fef0ee07e07e07e07e07e07e3ff3e7fe3fe1f7002","1f83fc7fe70ee07e07e07e07e07e17e3f73e7fe3fe0ff002","1f03fc3fe706606e07e07e07e07e06e0ef1f7be1fe1fe012","0fe1fe3fc700f00f00e00e00c00c0060070778f3ff0fe0b6"],"A":["0f00f00f01f81f81f819c39c39c7bc7fe7fe7fef0ee07e07","0600f00f00f81f839839c39c39c3fc3fe7ff70fe07c03800","0f00f01f01f81f81f83b83bc79c79e7fe7feffee0fe0fe07","0700fc0fc0fe1fe18f18f38f38f39f7ff7c7f04e00400400"]},"S":{"♠":["0400e00e01f01f83f87fc7fcffefffffffdff5ff4e0400e0","0400e00f01f01f83f87fc7feffefffffffdff5fe4e0600e0","0400e00e01f01f83f87fc7fcffefffffffdff5ff4e040060","0400600f00f01f83f83fc7feffefffffffdffcff4e060060","0400600f00f01f83f83fc7feffeffffffffffcff4e060060","0400600f00f01f83f83fc7feffeffffffffffcff6e264060","0400e00f01f81f83f87fc7feffefffffffdff4f64e0600e0","0400600f00f01f83f83fc7feffefffffffdffdff4e064060","0400600f00f01f83f83fc7feffefffffffdffdff4e264060","0600e00f01f81f83fc7fe7feffefffffffdff5f76e060060","0400e00f01f01f83fc7fc7feffefffffffdff5f74e060060","0600600f01f81f83fc3fe7fe7feffffffffffff76e060060","0200700f01f81f83fc3fe7fe7fffffffffbffaf72e060060"],"♥":["39efffffffffffffffffe7fe7fc7fe3fc1f01f00f0060060","f067befffffffffffeffe7feffe7fc3f83f81f01e00e0040","e18f1cffefffffffffffcffeffc7fc7f83f81f01f00e00c0","78e79e7fefffffefff7fe3fe7fe3fc1f81f81f80f0070060","61c73fffffffffffff7ff7ff3fe3fc3f81f81f80f00e0040","78a79efffffffff7fe7feffe7fc7fc3fc3f81f80f00e0060","60e79fffeffeffeffe7feffe7fc7fc1f81f81f01f0060060","31c7befffffffff7ffffe7fc7fc1f81f81f01f00e0040040","20e79e7fffffffe7fe7ff7fe7fe3fc3f81f80f01f00f00f0","20473e7feffeffe7ff7fc7fc3f83f83f81f01f00e0040040","608f9cffe7fffffffeffc7fc7fc7fc3f81f81f01f00e0080","30c7fefffffeffe7fe7fe7fe3fe3fc1fc1f01f80f00f0060","30479fffeffefffffeffeffe7fe7fc3fc3f83fc1f81f80f0"],"♣":["0f01f81f81f81f80f076effffffffffffffff6e666060060","0e01f81f81f81f80f066efffffffffffff7ff6e666060060","0f01f81f81f81f80f076effffffffffffffff6f666060060","0f01f81f81f81f80f076effffffffffffffff6e666060060","0e01f01f81f81f80f06eeffeffffffffff7ff6e666060060","0f01f01f81f81f00f06e6ffefffffffffffff6e6660600e0","0e01f01f81f81f81f06eeffeffffffffff7ff4e66e060060","0f01f81f81f81f80f0feefffffffffffffdff4e064060020","0f00f81f81f80f80f0ffefffffffffffffeff6f66e0600e0","0f00f81f81f81f80f07feffffffffffffffff6f66e0600e0","0e01f01f81f81f00f076efffffffffffff7ff6e264060060","0e01f01f81f81f00f076efffffffffffff7ff6e264060060","0e01f01f81f81f80f076efffffffffffff7ff6e264060060"],"♦":["0701f81f01f87fc7ffffffffffe7fe3fc3f83f81f00f0040","0201f01f83f87f8ffcffdffe7ffffe3fe3fc3f81e0050020","0400c01f01f83fc7fcffeffefff7fe7fe3fc3f81f81f00c0","0601f03f83f83fc3fc7feffefffffe7fc3fc3f81f01f0050","0d00e83f87fe7feffffffffffff7ff3fe3fe2f81f80f0080","1e03f01f07fe7feffdffffffffd7ff3fe7fe3f40f81e00c0","0780fc3fe3fe7fe7feffffffffd7ff7fe3fe3ff1fe04c030","0401f01f83fc7fe7feffeffeffe7ff7fe3fe2f81f80e00a0","0700f01f83fc7fe7fe7fffffffffffffe3fc3f83e81f00a0","0601e01f01fc3fcffe7fffff7fe7fe3fc7f81f81f00f0040","0c01e03f07f87f87f8ffefffffe7fcff87fc5f03f01e0140","0300f81f83fe7fcbff7ffffefff7ff7fc1fc2f81f00a0020"]}};
  const unhex = h => [...h].map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
  const T = { R: {}, S: {} };
  for (const k in TILE.R) T.R[k] = TILE.R[k].map(t => ({ b: unhex(t), ar: null }));
  for (const k in TILE.S) T.S[k] = TILE.S[k].map(t => ({ b: unhex(t), ar: null }));

  /* templates for printed text: rendered once from the fonts this device has */
  let TXT = null;
  function textTemplates() {
    if (TXT) return TXT;
    TXT = { R: {}, S: {} };
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 120; const cx = cv.getContext('2d', { willReadFrequently: true });
    const fonts = ['Roboto', 'Arial', 'Helvetica', 'Verdana', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Georgia', 'sans-serif', 'serif'];
    const chars = { A: 'A', K: 'K', Q: 'Q', J: 'J', T: 'T', '9': '9', '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2', '1': '1', '0': '0' };
    const suits = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
    const add = (bag, key, ch, font, weight) => {
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, 120, 120); cx.fillStyle = '#000'; cx.font = `${weight} 80px ${font}`; cx.textBaseline = 'middle'; cx.fillText(ch, 20, 60);
      const d = cx.getImageData(0, 0, 120, 120).data; const px = []; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let i = 0; i < 120 * 120; i++) if (d[i * 4] < 128) { const x = i % 120, y = (i / 120) | 0; px.push(i); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (!px.length) return;
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      (bag[key] = bag[key] || []).push({ b: bits(px, 120, x0, y0, w, h), ar: w / h });
    };
    for (const f of fonts) for (const wt of ['400', '700']) { for (const k in chars) add(TXT.R, k, chars[k], f, wt); for (const k in suits) add(TXT.S, k, suits[k], f, wt); }
    return TXT;
  }

  function bits(px, W, x0, y0, w, h) {
    const cnt = new Float32Array(GW * GH), area = new Float32Array(GW * GH);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) area[Math.min(GH - 1, (y * GH / h) | 0) * GW + Math.min(GW - 1, (x * GW / w) | 0)]++;
    for (const p of px) { const x = p % W - x0, y = ((p / W) | 0) - y0; cnt[Math.min(GH - 1, (y * GH / h) | 0) * GW + Math.min(GW - 1, (x * GW / w) | 0)]++; }
    let s = ''; for (let i = 0; i < GW * GH; i++) s += cnt[i] / Math.max(1, area[i]) > 0.3 ? '1' : '0';
    return s;
  }
  const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
  function nearest(bag, keys, b, ar) {
    let best = null, bd = 1e9;
    for (const k of keys) for (const t of bag[k] || []) { const d = ham(b, t.b) + (ar != null && t.ar != null ? Math.abs(Math.log(ar / t.ar)) * 40 : 0); if (d < bd) { bd = d; best = k; } }
    return { k: best, d: bd };
  }

  /* ---- image → glyphs ---- */
  function raster(img, s) {
    const W = Math.round(img.naturalWidth * s), H = Math.round(img.naturalHeight * s);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.imageSmoothingQuality = "high"; cx.drawImage(img, 0, 0, W, H);
    return { W, H, d: cx.getImageData(0, 0, W, H).data, img, s };
  }
  function loadImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const W = img.naturalWidth;
        res(raster(img, W > 1400 ? 1400 / W : W < 520 ? 2 : 1));
      };
      img.onerror = () => rej(new Error('This file could not be opened as a picture.'));
      img.src = url;
    });
  }
  function glyphs(im, soft) {
    const { W, H, d } = im, N = W * H;
    // 1 white, 2 dark ink, 3 red ink; "soft" accepts the grey edges of small anti-aliased print
    const wMin = soft ? 190 : 215, kMax = soft ? 150 : 120, rd = soft ? 50 : 70;
    const cls = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b); if (mn > wMin && mx - mn < 40) cls[i] = 1; else if (r > 120 && r - g > rd && r - b > rd - 10) cls[i] = 3; else if (mx < kMax && mx - mn < 45) cls[i] = 2; }
    const lab = new Int32Array(N).fill(-1), out = [];
    const minH = Math.max(7, Math.round(W / 90));
    for (let i = 0; i < N; i++) {
      if (cls[i] < 2 || lab[i] >= 0) continue;
      const c = cls[i], st = [i], px = []; lab[i] = 1; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      while (st.length) {
        const p = st.pop(), x = p % W, y = (p / W) | 0; px.push(p);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (cls[q] === c && lab[q] < 0) { lab[q] = 1; st.push(q); } }
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (h > W / 6 || w > W / 6 || px.length < 12) continue;
      let wh = 0, tot = 0;
      for (let x = x0 - 2; x <= x1 + 2; x++) for (const y of [y0 - 2, y1 + 2]) { if (x < 0 || y < 0 || x >= W || y >= H) continue; tot++; if (cls[y * W + x] === 1) wh++; }
      for (let y = y0 - 2; y <= y1 + 2; y++) for (const x of [x0 - 2, x1 + 2]) { if (x < 0 || y < 0 || x >= W || y >= H) continue; tot++; if (cls[y * W + x] === 1) wh++; }
      if (!tot || wh / tot < 0.55) continue;
      out.push({ c, x0, y0, x1, y1, w, h, px, small: h < minH });
    }
    return out;
  }
  const grow = (m, f) => { m.px = m.px.concat(f.px); m.x0 = Math.min(m.x0, f.x0); m.y0 = Math.min(m.y0, f.y0); m.x1 = Math.max(m.x1, f.x1); m.y1 = Math.max(m.y1, f.y1); m.w = m.x1 - m.x0 + 1; m.h = m.y1 - m.y0 + 1; };
  /* glue split strokes; join "1"+"0" into one glyph */
  function tidy(list, minH, noTen) {
    const frag = list.filter(o => o.h < minH && o.w >= 3), main = list.filter(o => o.h >= minH && o.w >= 2);
    for (const f of frag) { const m = main.find(o => o.c === f.c && f.x0 <= o.x1 + 2 && f.x1 >= o.x0 - 2 && f.y1 >= o.y0 - 3 && f.y0 <= o.y1 + 3); if (m) grow(m, f); }
    const L = main.sort((a, b) => a.x0 - b.x0), used = new Set(), M = [];
    for (const a of L) {
      if (used.has(a)) continue; used.add(a);
      const b = !noTen && a.w <= 0.45 * a.h ? L.find(o => !used.has(o) && o.c === a.c && o.x0 > a.x1 && o.x0 - a.x1 <= Math.max(6, 0.25 * a.h) && Math.abs(o.y0 - a.y0) <= Math.max(4, a.h * 0.15) && Math.abs(o.h - a.h) <= Math.max(5, a.h * 0.2)) : null;
      if (b) { used.add(b); const m = { ...a, px: a.px.slice() }; grow(m, b); m.ten = true; M.push(m); } else M.push(a);
    }
    return M;
  }

  /* ---- 1. card tiles (club app end-of-board screen) ---- */
  function readTiles(im) {
    const W = im.W, all = glyphs(im), M = tidy(all, Math.max(14, W / 41));
    M.sort((a, b) => a.y0 - b.y0);
    const taken = new Set(), cards = [];
    for (const r of M) {
      if (taken.has(r)) continue;
      const s = M.find(o => o !== r && !taken.has(o) && o.c === r.c && o.y0 > r.y1 - 2 && o.y0 - r.y1 < 0.7 * r.h && Math.abs((o.x0 + o.x1) / 2 - (r.x0 + r.x1) / 2) < Math.max(r.w, o.w) * 0.75 && o.h > r.h * 0.55 && o.h < r.h * 1.3);
      if (s) { taken.add(r); taken.add(s); cards.push({ r, s, cx: (r.x0 + r.x1) / 2, cy: r.y0, h: r.h, red: r.c === 3 }); }
    }
    for (const r of M) {
      if (taken.has(r)) continue;
      const nb = cards.filter(p => p.red === (r.c === 3) && Math.abs(p.cy - r.y0) <= r.h * 0.25 && Math.abs(p.h - r.h) <= r.h * 0.25).sort((a, b) => Math.abs(a.cx - r.x0) - Math.abs(b.cx - r.x0))[0];
      if (nb) { taken.add(r); cards.push({ r, s: null, borrow: nb, cx: (r.x0 + r.x1) / 2, cy: r.y0, h: r.h, red: r.c === 3 }); }
    }
    if (cards.length < 30) return null;
    for (const p of cards) {
      const rk = nearest(T.R, Object.keys(T.R), bits(p.r.px, W, p.r.x0, p.r.y0, p.r.w, p.r.h));
      p.rank = p.r.ten ? '10' : rk.k; p.rd = rk.d;
      const src = p.s || (p.borrow && p.borrow.s);
      p.suit = src ? nearest(T.S, p.red ? ['♥', '♦'] : ['♠', '♣'], bits(src.px, W, src.x0, src.y0, src.w, src.h)).k : null;
    }
    // hands by position: top row = North, bottom row = South, middle = West/East
    const ys = cards.map(p => p.cy).sort((a, b) => a - b), tol = Math.max(...cards.map(p => p.h)) * 0.6;
    const top = ys[0], bottom = ys[ys.length - 1];
    const hands = [[], [], [], []];
    for (const p of cards) {
      const seat = p.cy - top <= tol ? 0 : bottom - p.cy <= tol ? 2 : p.cx < W / 2 ? 3 : 1;
      hands[seat].push(p);
    }
    return { kind: 'tiles', hands: hands.map(h => h.map(p => ({ rank: p.rank, suit: p.suit }))) };
  }

  /* ---- 2. printed hand record ---- */
  /* the ranks of one suit are printed from high to low: pick the best strictly descending reading ("1" + "0" counts as a ten) */
  const ORD = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  function tokens(gs) {
    const tok = [];
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i], n = gs[i + 1];
      if (n && g.rank.k === "1" && n.rank.k === "0") { tok.push(Object.fromEntries(ORD.map(k => [k, k === "T" ? 0 : 999]))); i++; continue; }
      tok.push(Object.fromEntries(ORD.map(k => [k, k === "T" ? Math.min(g.dist.T, g.dist["1"] + 20) : g.dist[k]])));
    }
    return tok;
  }
  /* one suit across the four hands: the 13 ranks are split between the lines, each line high to low */
  function solveSuit(lines) {
    const n = lines.map(t => t.length), key = p => p.join(","), INF = 1e9;
    let cur = new Map([[key([0, 0, 0, 0]), { c: 0, p: [0, 0, 0, 0], a: [[], [], [], []] }]]);
    for (let r = 0; r < 13; r++) {
      const nxt = new Map();
      for (const st of cur.values()) for (let h = 0; h < 4; h++) {
        if (st.p[h] >= n[h]) continue;
        const c = st.c + lines[h][st.p[h]][ORD[r]], p = st.p.slice(); p[h]++;
        const k = key(p), o = nxt.get(k);
        if (!o || c < o.c) { const a = st.a.map(x => x.slice()); a[h].push(ORD[r]); nxt.set(k, { c, p, a }); }
      }
      cur = nxt;
    }
    const fin = cur.get(key(n));
    return fin ? fin.a : null;
  }
  function decode(gs) {
    const tok = [];
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i], n = gs[i + 1];
      if (n && g.rank.k === "1" && n.rank.k === "0") { tok.push(Object.fromEntries(ORD.map(k => [k, k === "T" ? 0 : 999]))); i++; continue; }
      tok.push(Object.fromEntries(ORD.map(k => [k, k === "T" ? Math.min(g.dist.T, g.dist["1"] + 20) : g.dist[k]])));
    }
    const n = tok.length; if (!n) return [];
    if (n > 13) return tok.map(t => ORD.reduce((a, k) => t[k] < t[a] ? k : a, "A"));
    const INF = 1e9, dp = [...Array(n)].map(() => new Array(13).fill(INF)), from = [...Array(n)].map(() => new Array(13).fill(-1));
    for (let r = 0; r < 13; r++) dp[0][r] = tok[0][ORD[r]];
    for (let i = 1; i < n; i++) for (let r = 0; r < 13; r++) { let b = INF, bi = -1; for (let q = 0; q < r; q++) if (dp[i - 1][q] < b) { b = dp[i - 1][q]; bi = q; } if (bi >= 0) { dp[i][r] = b + tok[i][ORD[r]]; from[i][r] = bi; } }
    let r = 0; for (let q = 1; q < 13; q++) if (dp[n - 1][q] < dp[n - 1][r]) r = q;
    if (dp[n - 1][r] >= INF) return tok.map(t => ORD.reduce((a, k) => t[k] < t[a] ? k : a, "A"));
    const out = new Array(n); for (let i = n - 1; i >= 0; i--) { out[i] = ORD[r]; r = from[i][r]; }
    return out;
  }
  function readRecord(im) {
    const W = im.W, X = textTemplates();
    const raw = glyphs(im, true);
    if (raw.length < 20) return null;
    const hs = raw.map(o => o.h).sort((a, b) => a - b), medH = hs[hs.length >> 1];
    const M0 = tidy(raw, Math.max(6, medH * 0.45), true), M = [];
    // letters printed close together can touch ("KJ"): cut glyphs that are too wide at their thinnest columns
    for (const o of M0) {
      if (o.c === 3 || o.w < o.h * 0.95) { M.push(o); continue; }
      const one = o => { const b = bits(o.px, W, o.x0, o.y0, o.w, o.h), ar = o.w / o.h; return Math.min(nearest(X.R, Object.keys(X.R), b, ar).d, nearest(X.S, ["♠", "♣"], b, ar).d); };
      const cut = (o, k) => {
        const col = new Array(o.w).fill(0); for (const p of o.px) col[p % W - o.x0]++;
        const cuts = [];
        for (let i = 1; i < k; i++) { const c = Math.round(o.w * i / k), r = Math.max(1, Math.round(o.w / k * 0.35)); let b = c; for (let x = c - r; x <= c + r; x++) if (x > 0 && x < o.w && col[x] < col[b]) b = x; cuts.push(b); }
        const edges = [0, ...cuts, o.w], parts = [];
        for (let i = 0; i < k; i++) {
          const px = o.px.filter(p => { const x = p % W - o.x0; return x >= edges[i] && x < edges[i + 1]; }); if (px.length < 8) return null;
          let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const p of px) { const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          parts.push({ c: o.c, px, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 });
        }
        return parts;
      };
      let best = [o], bc = one(o);
      for (let k = 2; k <= Math.min(4, Math.ceil(o.w / (o.h * 0.45))); k++) {
        const parts = cut(o, k); if (!parts) continue;
        const c = parts.reduce((a, p) => a + one(p), 0) / k + 6;
        if (c < bc) { bc = c; best = parts; }
      }
      M.push(...best);
    }
    // classify every glyph as a suit symbol or a rank character
    for (const o of M) {
      const b = bits(o.px, W, o.x0, o.y0, o.w, o.h), ar = o.w / o.h;
      const su = nearest(X.S, o.c === 3 ? ['♥', '♦'] : ['♠', '♣'], b, ar), su2 = nearest(T.S, o.c === 3 ? ['♥', '♦'] : ['♠', '♣'], b, null);
      o.suit = su2.d < su.d ? su2 : su;
      o.rank = nearest(X.R, Object.keys(X.R), b, ar);
      o.dist = {}; for (const k of Object.keys(X.R)) o.dist[k] = nearest(X.R, [k], b, ar).d;
      o.isSuit = o.c === 3 ? o.suit.d < 70 : o.suit.d + 8 < o.rank.d;
    }
    // text lines
    const L = M.slice().sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1)), lines = [];
    for (const o of L) {
      const cy = (o.y0 + o.y1) / 2, ln = lines.find(l => Math.abs(l.cy - cy) < Math.max(l.h, o.h) * 0.45);
      if (ln) { ln.g.push(o); ln.h = Math.max(ln.h, o.h); } else lines.push({ cy, h: o.h, g: [o] });
    }
    // a hand line: a suit symbol followed by rank characters; one text line may hold two hands (West and East)
    const hl = [];
    for (const l of lines) {
      const g = l.g.sort((a, b) => a.x0 - b.x0);
      for (let i = 0; i < g.length; i++) {
        if (!g[i].isSuit) continue;
        const sym = g[i], ranks = []; let last = sym;
        for (let j = i + 1; j < g.length && !g[j].isSuit; j++) {
          if (g[j].x0 - last.x1 > Math.max(sym.h, g[j].h) * 1.6) break;
          if (g[j].rank.d > 110) break;
          ranks.push(g[j]); last = g[j];
        }
        hl.push({ x: sym.x0, y: (sym.y0 + sym.y1) / 2, h: sym.h, red: sym.c === 3, ranks: decode(ranks), toks: tokens(ranks) });
      }
    }
    // four lines under each other, black-red-red-black = one hand (♠ ♥ ♦ ♣)
    hl.sort((a, b) => a.y - b.y);
    const used = new Set(), groups = [];
    for (const a of hl) {
      if (used.has(a)) continue;
      const col = hl.filter(o => !used.has(o) && Math.abs(o.x - a.x) < a.h * 0.8 && o.y >= a.y).sort((p, q) => p.y - q.y);
      if (col.length < 4) continue;
      const four = col.slice(0, 4), gap = four[1].y - four[0].y;
      if (gap <= 0 || four.some((o, i) => i && Math.abs((o.y - four[i - 1].y) - gap) > gap * 0.45)) continue;
      if (four[0].red || !four[1].red || !four[2].red || four[3].red) continue;
      four.forEach(o => used.add(o));
      groups.push({ x: a.x, y: four[0].y, lines: four });
    }
    if (groups.length < 3) return null;
    // compass: North top, South bottom, West left, East right
    const g4 = groups.slice(0, 4), seats = [null, null, null, null];
    const byY = g4.slice().sort((a, b) => a.y - b.y);
    seats[0] = byY[0];
    if (g4.length === 4) { seats[2] = byY[3]; const mid = [byY[1], byY[2]].sort((a, b) => a.x - b.x); seats[3] = mid[0]; seats[1] = mid[1]; }
    else { const rest = byY.slice(1).sort((a, b) => a.x - b.x); if (Math.abs(rest[0].y - rest[1].y) < rest[0].lines[0].h * 2) { seats[3] = rest[0]; seats[1] = rest[1]; } else { seats[2] = byY[2]; seats[byY[1].x < byY[0].x ? 3 : 1] = byY[1]; } }
    // with all four hands found and 13 cards in a suit, choose the split that uses every rank once
    if (seats.every(Boolean)) for (let i = 0; i < 4; i++) {
      const ls = seats.map(g => g.lines[i].toks);
      if (ls.reduce((a, t) => a + t.length, 0) !== 13) continue;
      const sol = solveSuit(ls); if (sol) seats.forEach((g, s) => { g.lines[i].ranks = sol[s]; });
    }
    const SU = ['♠', '♥', '♦', '♣'];
    return { kind: 'record', hands: seats.map(g => g ? g.lines.flatMap((l, i) => l.ranks.map(rk => ({ rank: rk === 'T' ? '10' : rk, suit: SU[i] }))) : null) };
  }

  /* ---- result → card numbers (0-51) and a PBN code ---- */
  const RI = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, J: 9, Q: 10, K: 11, A: 12 }, SI = { '♣': 0, '♦': 1, '♥': 2, '♠': 3 };
  function toCards(res) { return res.hands.map(h => h ? h.filter(c => c.rank in RI && c.suit in SI).map(c => SI[c.suit] * 13 + RI[c.rank]) : null); }
  function pbn(hands) {
    const RT = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    return 'N:' + hands.map(h => h ? [3, 2, 1, 0].map(s => h.filter(c => ((c / 13) | 0) === s).map(c => c % 13).sort((a, b) => b - a).map(r => RT[r]).join('')).join('.') : '-').join(' ');
  }
  async function read(file) {
    const im = await loadImage(file);
    let res = readTiles(im);
    const okT = res && toCards(res).filter(h => h && h.length === 13).length >= 3;
    if (!okT) {
      // printed text: enlarge small print so that letters are about 32 pixels high, then read
      const raw = glyphs(im), hs = raw.map(o => o.h).sort((a, b) => a - b), medH = hs.length ? hs[hs.length >> 1] : 30;
      const f = Math.min(3, Math.max(1, 32 / Math.max(8, medH)));
      const im2 = f > 1.15 ? raster(im.img, im.s * f) : im;
      const r2 = readRecord(im2); if (r2) res = r2;
    }
    if (!res) throw new Error('No hands found in this picture. Use the end-of-board screen of the app, or a hand record with ♠ ♥ ♦ ♣ lines.');
    const hands = toCards(res);
    return { kind: res.kind, hands, pbn: pbn(hands) };
  }
  return { read, _internals: { loadImage, glyphs, readTiles, readRecord, toCards, pbn } };
})();
