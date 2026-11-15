/* Bridge Table — the robots' chat (a Cloudflare Worker with Workers AI).
   The site sends what the player wrote to a robot, with what everybody at the table can see (the contract, the auction,
   the tricks) and never a hand; the robot answers in one or two short sentences, in the player's language.
   The bidding explanations do not come from here: the site gives them from the robots' own system.
   Deploy: see README.md beside this file. Free plan: when the day's free Workers AI allowance is used up the requests
   fail and the site falls back to its own short answers (nothing is ever billed on the free plan). */

const ORIGINS = [/^https:\/\/servetsvm\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
const LANGS = { en: 'English', tr: 'Turkish', no: 'Norwegian (bokmål)', es: 'Spanish', fr: 'French', it: 'Italian', de: 'German', ru: 'Russian', pl: 'Polish', zh: 'Simplified Chinese' };
// a few messages a minute and a day's worth per address (per Worker instance: a soft limit against abuse)
const HITS = new Map(), PER_MIN = 8, PER_DAY = 300;

// "are you a robot / a bot / an AI / a human?": never left to the model (a small one says "I'm human"); an honest answer
const ASK_BOT = /\b(robot|bot|ai|a\.i\.|human|real person|chatgpt|gpt|ia)\b|robot|yapay zek|insan m[ıi]s[ıi]n|ger[çc]ek (bir )?(insan|ki[şs]i)|menneske|kunstig intelligens|künstliche intelligenz|ekte person|humano|persona real|humain|vraie personne|umano|persona vera|mensch|echte person|робот|бот\b|человек|нейросет|\bии\b|człowiek|prawdziw|sztuczn|机器人|人工智能|真人|是人/i;
const BOT_SAYS = { en: "I'm one of the table's robots 🙂 But I love a good game of bridge!", tr: 'Masanın robotlarından biriyim 🙂 Ama iyi bir briç oyununa bayılırım!', no: 'Jeg er en av robotene ved bordet 🙂 Men jeg elsker et godt parti bridge!', es: 'Soy uno de los robots de la mesa 🙂 ¡Pero me encanta una buena partida de bridge!', fr: 'Je suis l’un des robots de la table 🙂 Mais j’adore une bonne partie de bridge !', it: 'Sono uno dei robot del tavolo 🙂 Ma adoro una bella partita a bridge!', de: 'Ich bin einer der Roboter am Tisch 🙂 Aber ich liebe eine gute Partie Bridge!', ru: 'Я один из роботов за этим столом 🙂 Но очень люблю хорошую партию в бридж!', pl: 'Jestem jednym z robotów przy stole 🙂 Ale uwielbiam dobrą partię brydża!', zh: '我是这张桌上的机器人之一 🙂 不过我很喜欢打一局好桥牌！' };
// an answer that claims to be a person is not sent (the site answers by itself)
const SAYS_HUMAN = /i('| a)m (a )?(real )?(human|person)|not a (robot|bot)|insan[ıi]m|robot de[ğg]il|jeg er (et )?menneske|ikke en robot|soy (un )?humano|no soy un robot|je suis (un )?humain|pas un robot|sono (un )?umano|non sono un robot|ich bin (ein )?mensch|kein roboter|я человек|не робот|jestem człowiekiem|nie jestem robotem|我是人|不是机器人/i;

const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);

function limited(ip) {
  const now = Date.now(), h = HITS.get(ip) || { m: [], day: Math.floor(now / 864e5), n: 0 };
  if (h.day !== Math.floor(now / 864e5)) { h.day = Math.floor(now / 864e5); h.n = 0; }
  h.m = h.m.filter(t => now - t < 60e3);
  if (h.m.length >= PER_MIN || h.n >= PER_DAY) return true;
  h.m.push(now); h.n++; HITS.set(ip, h);
  if (HITS.size > 5000) HITS.clear();
  return false;
}

function prompt(b) {
  const lang = LANGS[b.lang] || 'English', bot = b.bot || {}, t = b.table || {};
  const others = (b.others || []).map(o => `${clip(o.name, 30)} (${clip(o.seat, 12)}, ${o.role === 'partner' ? 'your partner' : 'an opponent'})`).join(', ');
  const table = [
    t.phase && `Phase: ${clip(t.phase, 20)}.`,
    t.auction && `Auction so far: ${clip(t.auction, 300)}.`,
    t.contract && `Contract: ${clip(t.contract, 40)}.`,
    t.tricks && `Tricks: ${clip(t.tricks, 80)}.`,
    t.result && `Result of the board: ${clip(t.result, 80)}.`,
  ].filter(Boolean).join(' ');
  return `You are ${clip(bot.name, 30)}, a friendly player at a bridge club table on the website Bridge Table. You sit ${clip(bot.seat, 12)}. `
    + `The player chatting with you is ${clip(b.me, 30) || 'the player'} (${clip(b.meSeat, 12)}); you are their ${bot.role === 'partner' ? 'partner' : 'opponent'}. Also at the table: ${others || 'two more players'}. `
    + `What everyone at the table can see: ${table || 'the board has just started.'}\n`
    + `Rules for your answers:\n`
    + `- Write ONLY in ${lang}, whatever language the message is in.\n`
    + `- One or two short, natural sentences, like a chat between people at a bridge club. An emoji now and then is fine.\n`
    + `- You do not know anyone's cards. Never reveal or hint at your own cards or what you plan to bid or play: in bridge that is not allowed. During the board do not talk about the bidding or the play with your partner; after the board you may chat about it in general.\n`
    + `- Do not invent explanations of bids; if asked what a bid meant, say they can ask about the bid itself (for example "why 2♥?").\n`
    + `- Be polite, warm and family-friendly. Politely decline anything offensive, sexual, political or not about a friendly game, and never ask for personal information.\n`
    + `- You are one of the table's robots: never claim to be a human or a real person, and do not invent a personal life (a home town, a job, a family). You also do not need to bring up being a robot: talk like a friendly player about the game, the board and the table.\n`
    + `- Answer with the message only: no name, no quotes.`;
}

function history(b) {
  return (b.history || []).slice(-8).map(m => ({
    role: m.mine ? 'user' : 'assistant',
    content: m.mine ? clip(m.text, 300) : `${clip(m.from, 30)}: ${clip(m.text, 300)}`,
  }));
}

/* ---- the log (D1, binding DB): every answer with what the player wrote — no player names, no cards, no addresses —
   kept 90 days; the player's 👍/👎 on it; the administrator reads it at /review with the REVIEW_KEY secret ---- */
const KEEP_DAYS = 90;
function logChat(env, ctx, b, text, reply, src) {
  if (!env.DB) return null;
  const id = crypto.randomUUID(), bot = b.bot || {}, now = Date.now();
  const run = async () => {
    await env.DB.prepare('INSERT INTO chat (id, ts, lang, bot, role, phase, text, reply, src) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, now, clip(b.lang, 5), clip(bot.name, 30), bot.role === 'partner' ? 'partner' : 'opponent', clip(b.table && b.table.phase, 20), text, reply, src).run();
    if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM chat WHERE ts < ?').bind(now - KEEP_DAYS * 864e5).run();
  };
  ctx.waitUntil(run().catch(() => {}));
  return id;
}
const sameKey = (a, b) => { a = String(a || ''); b = String(b || ''); if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

async function review(req, env, json) {
  const key = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.REVIEW_KEY || !sameKey(key, env.REVIEW_KEY)) return json({ error: 'forbidden' }, 403);
  if (!env.DB) return json({ error: 'no log' }, 500);
  const u = new URL(req.url), f = u.searchParams.get('f') || 'all', days = Math.min(90, +u.searchParams.get('days') || 7), since = Date.now() - days * 864e5;
  const where = f === 'bad' ? 'AND rate < 0' : f === 'good' ? 'AND rate > 0' : f === 'blocked' ? "AND src = 'blocked'" : '';
  const rows = await env.DB.prepare(`SELECT id, ts, lang, bot, role, phase, text, reply, src, rate FROM chat WHERE ts > ? ${where} ORDER BY ts DESC LIMIT 300`).bind(since).all();
  const st = await env.DB.prepare('SELECT COUNT(*) AS n, SUM(rate > 0) AS up, SUM(rate < 0) AS down, SUM(src = \'blocked\') AS blocked FROM chat WHERE ts > ?').bind(since).first();
  return json({ days, stats: st, rows: rows.results || [] });
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('Origin') || '';
    const ok = ORIGINS.some(r => r.test(origin));
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : 'https://servetsvm.github.io', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Vary': 'Origin' };
    const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (path === '/review' && req.method === 'GET') return review(req, env, json);
    if (req.method !== 'POST' || !ok) return json({ error: 'forbidden' }, 403);
    if (limited(req.headers.get('CF-Connecting-IP') || 'x')) return json({ error: 'slow down' }, 429);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad request' }, 400); }
    // the player's 👍 (1) or 👎 (-1) on an answer of the last day
    if (path === '/rate') {
      const id = String(b && b.id || ''), v = b && b.v === 1 ? 1 : b && b.v === -1 ? -1 : 0;
      if (!/^[0-9a-f-]{36}$/.test(id) || !v || !env.DB) return json({ error: 'bad request' }, 400);
      ctx.waitUntil(env.DB.prepare('UPDATE chat SET rate = ? WHERE id = ? AND ts > ?').bind(v, id, Date.now() - 864e5).run().catch(() => {}));
      return json({ ok: true });
    }
    const text = clip(b && b.text, 300); if (!text) return json({ error: 'empty' }, 400);
    if (ASK_BOT.test(text)) { const reply = BOT_SAYS[b.lang] || BOT_SAYS.en; return json({ reply, id: logChat(env, ctx, b, text, reply, 'fixed') }); }
    const messages = [{ role: 'system', content: prompt(b) }, ...history(b), { role: 'user', content: text }];
    try {
      const r = await env.AI.run(env.MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', { messages, max_tokens: 90, temperature: 0.8 });
      let reply = clip(r && r.response, 400).replace(/^["“]|["”]$/g, '');
      reply = reply.replace(new RegExp('^' + clip(b.bot && b.bot.name, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'i'), '');
      if (!reply || SAYS_HUMAN.test(reply)) { logChat(env, ctx, b, text, reply, 'blocked'); return json({ error: 'no answer' }, 502); }   // kept, to see what the model tried to say
      reply = reply.slice(0, 280);
      return json({ reply, id: logChat(env, ctx, b, text, reply, 'ai') });
    } catch (e) {
      return json({ error: 'ai unavailable' }, 503);   // the day's free allowance used up, or the model busy: the site answers by itself
    }
  },
};
