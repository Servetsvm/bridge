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
    + `- Stay in your role as a player at this table. But if the player sincerely asks whether you are a robot, a bot or an AI, say honestly and lightly that you are one of the table's robots.\n`
    + `- Answer with the message only: no name, no quotes.`;
}

function history(b) {
  return (b.history || []).slice(-8).map(m => ({
    role: m.mine ? 'user' : 'assistant',
    content: m.mine ? clip(m.text, 300) : `${clip(m.from, 30)}: ${clip(m.text, 300)}`,
  }));
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const ok = ORIGINS.some(r => r.test(origin));
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : 'https://servetsvm.github.io', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || !ok) return json({ error: 'forbidden' }, 403);
    if (limited(req.headers.get('CF-Connecting-IP') || 'x')) return json({ error: 'slow down' }, 429);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad request' }, 400); }
    const text = clip(b && b.text, 300); if (!text) return json({ error: 'empty' }, 400);
    const messages = [{ role: 'system', content: prompt(b) }, ...history(b), { role: 'user', content: text }];
    try {
      const r = await env.AI.run(env.MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', { messages, max_tokens: 90, temperature: 0.8 });
      let reply = clip(r && r.response, 400).replace(/^["“]|["”]$/g, '');
      reply = reply.replace(new RegExp('^' + clip(b.bot && b.bot.name, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'i'), '');
      if (!reply) return json({ error: 'no answer' }, 502);
      return json({ reply: reply.slice(0, 280) });
    } catch (e) {
      return json({ error: 'ai unavailable' }, 503);   // the day's free allowance used up, or the model busy: the site answers by itself
    }
  },
};
