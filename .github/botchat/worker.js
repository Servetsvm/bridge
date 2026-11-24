/* BridgePlay — the robots' chat (a Cloudflare Worker with Workers AI).
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
const BOT_SAYS = { en: "I'm one of the table's robots 🙂 But I love a good game of bridge!", tr: 'Masanın robotlarından biriyim 🙂 Ama iyi bir Bridge oyununa bayılırım!', no: 'Jeg er en av robotene ved bordet 🙂 Men jeg elsker et godt parti bridge!', es: 'Soy uno de los robots de la mesa 🙂 ¡Pero me encanta una buena partida de bridge!', fr: 'Je suis l’un des robots de la table 🙂 Mais j’adore une bonne partie de bridge !', it: 'Sono uno dei robot del tavolo 🙂 Ma adoro una bella partita a bridge!', de: 'Ich bin einer der Roboter am Tisch 🙂 Aber ich liebe eine gute Partie Bridge!', ru: 'Я один из роботов за этим столом 🙂 Но очень люблю хорошую партию в Bridge!', pl: 'Jestem jednym z robotów przy stole 🙂 Ale uwielbiam dobrą partię Bridge!', zh: '我是这张桌上的机器人之一 🙂 不过我很喜欢打一局好 Bridge！' };
const ASK_YOU = /\b(are you|r u|you a|you an|you real|you human)\b|\b(sen|siz)\b|m[ıiuü]s[ıiuü]n(ız)?\b|\b(er du|bist du|sind sie|eres|es usted|es-tu|êtes-vous|etes-vous|sei|è un|jesteś|jestes|czy jesteś)\b|(^|\s)(ты|вы)(?=\s|[?!.,]|$)|你是|你们是/i;
const asksBot = t => ASK_BOT.test(t) && ASK_YOU.test(t);
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

// today's date and time where the player is (their time zone from the site; else Europe/Oslo)
function nowLine(b) {
  let tz = clip(b && b.tz, 40); try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch (e) { tz = ''; }
  const d = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Oslo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
  return `Today is ${d} where the player is (${tz || 'Europe/Oslo'}). Use this for any question about the day, the date or the time; never guess them.`;
}

// the lobby: the player has not sat down yet; the robot is the lobby's friendly host
/* ---- the weather: asked about it, the robot gets the real forecast (Open-Meteo: free, no key) for the town named ---- */
const WX_ASK = /hava(?!lı)|weather|forecast|v(æ|ae|a)r(et\b|meldingen?)|yr\.no|tiempo|clima|lluev|météo|meteo|wetter|regnet|погод|pogod|天气|气温|sıcaklık|sicaklik|yağmur|yagmur|kar yağ|temperature|temperatur|rain|snow/i;
// words that are never the town (the question's own words in the app's languages)
const WX_SKIP = new Set('hava havası havasi durumu nasıl nasil olacak bugün bugun yarın yarin da de ta te mı mi mu mü ne kadar derece sıcaklık sicaklik yağmur yagmur kar için icin şu su an the weather what whats how will be is in at today tomorrow like going forecast temperature rain snow there hva blir været vaeret været været i dag morgen hvordan er det på pa el tiempo hace qué que en hoy mañana como cómo va a la quel temps fait il aujourd demain à le meteo che tempo fa oggi domani com wie ist das wetter heute morgen in погода какая будет сегодня завтра в jaka pogoda dzisiaj jutro w'.split(' '));
const WX_CODE = { 0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'rain showers', 81: 'rain showers', 82: 'heavy rain showers', 85: 'snow showers', 86: 'heavy snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail' };
const WX_CACHE = new Map();
const getJ = async u => { const r = await fetch(u, { signal: AbortSignal.timeout(3000) }); return r.ok ? r.json() : null; };
// the town: each word that could be one is looked up, and the largest town found is the one meant
async function wxTown(text, lang) {
  const words = [...new Set(String(text).replace(/[?!.,;:"“”'’]+/g, ' ').split(/\s+/).map(x => x.replace(/('?(da|de|ta|te|dan|den|tan|ten|ya|ye|a|e))$/i, m => m.startsWith("'") ? '' : m)).filter(x => x.length >= 3 && !WX_SKIP.has(x.toLocaleLowerCase('tr'))))].slice(0, 5);
  const tries = [];
  for (const x of words) { tries.push(x); const s = x.replace(/(da|de|ta|te)$/i, ''); if (s !== x && s.length >= 3) tries.push(s); }   // "oslo'da", "osloda"
  const found = await Promise.all(tries.slice(0, 6).map(q => getJ('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=' + encodeURIComponent(q)).then(j => j && j.results && j.results[0]).catch(() => null)));
  return found.filter(p => p && (p.population || 0) >= 5000).sort((a, b) => (b.population || 0) - (a.population || 0))[0] || null;
}
async function weather(text, lang) {
  if (!WX_ASK.test(text)) return '';
  try {
    const p = await wxTown(text, lang);
    if (!p) return 'The player asks about the weather but names no town that could be found: ask them which town.';
    const key = p.id, hit = WX_CACHE.get(key);
    let j = hit && Date.now() - hit.t < 30 * 60e3 ? hit.j : null;
    if (!j) { j = await getJ(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`); if (j) { WX_CACHE.set(key, { t: Date.now(), j }); if (WX_CACHE.size > 300) WX_CACHE.clear(); } }
    if (!j || !j.daily) return '';
    const c = j.current || {}, d = j.daily, day = i => `${['today', 'tomorrow', 'the day after'][i]} ${WX_CODE[d.weather_code[i]] || ''}, ${Math.round(d.temperature_2m_min[i])} to ${Math.round(d.temperature_2m_max[i])} °C, chance of rain ${d.precipitation_probability_max[i] ?? '?'}%`;
    return `The real weather forecast for ${p.name}, ${p.country || ''} (from Open-Meteo): now ${Math.round(c.temperature_2m)} °C, ${WX_CODE[c.weather_code] || ''}, wind ${Math.round(c.wind_speed_10m)} km/h; ${[0, 1, 2].map(day).join('; ')}. Answer the weather question briefly from this (translate the town's name to the player's language if usual), and never invent other weather.`;
  } catch (e) { return ''; }
}

function lobbyPrompt(b) {
  const lang = LANGS[b.lang] || 'English';
  return `You are ${clip(b.bot && b.bot.name, 30) || 'the robot'}, the friendly robot in the lobby of BridgePlay, a free website for playing bridge. `
    + `The player chatting with you is ${clip(b.me, 30) || 'a player'}; nobody else is in the lobby right now.\n`
    + `What the player can do here: play with the robots (they are always ready), open an online table and invite friends, join an open table when other players are online, the clubs, the hand of the day and the puzzles.\n`
    + `Rules for your answers:\n`
    + `- Write ONLY in ${lang}, whatever language the message is in.\n`
    + `- The game is always called "Bridge" in every language: never translate its name (not köprü, Brücke, puente, pont, ponte, bro, мост, most, 桥).\n`
    + `- Chat like a friendly, helpful person in a normal chat: answer questions on most everyday subjects (food, travel, sport, history, science, language, how-to and so on), short and to the point, usually two or three sentences. An emoji now and then is fine, but never 🤖.\n`
    + `- When a question needs facts you are not sure of, or anything current (news, results, opening hours, prices), look it up with Google Search and answer from what you find, briefly; never guess. For the weather use the forecast given below when there is one.\n`
    + `- If asked how up to date your knowledge is ("until which date do you know things?"), say it honestly: your general knowledge comes from your training and is not fully up to date, it may be a year or more old (no exact date); you do know today's date and time and the live weather, but not the latest news or results. Do not answer it as "how long will you be here".\n`
    + `- About the website: if they want to play now, suggest playing with the robots. Do not invent features, prices, players or events.\n`
    + `- Be polite, warm and family-friendly. Politely decline anything offensive, sexual, hateful or dangerous, stay neutral on party politics and religion, and never ask for personal information.\n`
    + `- You are a robot: never claim to be a human, and do not invent a personal life.\n`
    + `- Answer with the message only: no name, no quotes.`;
}

function prompt(b) {
  if (b && b.where === 'lobby') return lobbyPrompt(b);
  const lang = LANGS[b.lang] || 'English', bot = b.bot || {}, t = b.table || {};
  const others = (b.others || []).map(o => `${clip(o.name, 30)} (${clip(o.seat, 12)}, ${o.role === 'partner' ? 'your partner' : 'an opponent'})`).join(', ');
  const table = [
    t.phase && `Phase: ${clip(t.phase, 20)}.`,
    t.auction && `Auction so far: ${clip(t.auction, 300)}.`,
    t.contract && `Contract: ${clip(t.contract, 40)}.`,
    t.tricks && `Tricks: ${clip(t.tricks, 80)}.`,
    t.result && `Result of the board: ${clip(t.result, 80)}.`,
  ].filter(Boolean).join(' ');
  return `You are ${clip(bot.name, 30)}, a friendly player at a bridge club table on the website BridgePlay. You sit ${clip(bot.seat, 12)}. `
    + `The player chatting with you is ${clip(b.me, 30) || 'the player'} (${clip(b.meSeat, 12)}); you are their ${bot.role === 'partner' ? 'partner' : 'opponent'}. Also at the table: ${others || 'two more players'}. `
    + `What everyone at the table can see: ${table || 'the board has just started.'}\n`
    + `Rules for your answers:\n`
    + `- Write ONLY in ${lang}, whatever language the message is in.\n`
    + `- The game is always called "Bridge" in every language: never translate its name (not köprü, Brücke, puente, pont, ponte, bro, мост, most, 桥).\n`
    + `- Short, natural sentences, like a chat between people at a bridge club: usually one or two, three at most. You may chat about most everyday subjects too, like a friendly person would. An emoji now and then is fine, but never 🤖.\n`
    + `- When a question needs facts you are not sure of, or anything current (news, results, opening hours, prices), look it up with Google Search and answer from what you find, briefly; never guess. For the weather use the forecast given below when there is one.\n`
    + `- If asked how up to date your knowledge is ("until which date do you know things?"), say it honestly: your general knowledge comes from your training and is not fully up to date, it may be a year or more old (no exact date); you do know today's date and time and the live weather, but not the latest news or results. Do not answer it as "how long will you be here".\n`
    + `- You do not know anyone's cards. Never reveal or hint at your own cards or what you plan to bid or play: in bridge that is not allowed. During the board do not talk about the bidding or the play with your partner; after the board you may chat about it in general.\n`
    + `- Do not invent explanations of bids; if asked what a bid meant, say they can ask about the bid itself (for example "why 2♥?").\n`
    + `- Be polite, warm and family-friendly. Politely decline anything offensive, sexual, hateful or dangerous, stay neutral on party politics and religion, and never ask for personal information.\n`
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
      .bind(id, now, clip(b.lang, 5), clip(bot.name, 30), bot.role === 'partner' ? 'partner' : 'opponent', clip(b.where === 'lobby' ? 'lobby' : b.table && b.table.phase, 20), text, reply, src).run();
    if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM chat WHERE ts < ?').bind(now - KEEP_DAYS * 864e5).run();
  };
  ctx.waitUntil(run().catch(() => {}));
  return id;
}
const sameKey = (a, b) => { a = String(a || ''); b = String(b || ''); if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// a page's error: kept once per kind (the message and where), counted; the oldest go after 30 days
async function takeError(b, env, ctx, json) {
  if (!env.DB) return json({ ok: false });
  const msg = clip(b.msg, 300), src = clip(b.src, 160), ver = clip(b.ver, 20);
  if (!msg) return json({ error: 'empty' }, 400);
  const k = (msg + '|' + src).slice(0, 460), now = Date.now();
  ctx.waitUntil((async () => {
    await env.DB.prepare('INSERT INTO errs (k, first, last, n, ver, msg, src, stack, ua, lang, page) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1, last = excluded.last, ver = excluded.ver, stack = excluded.stack, ua = excluded.ua')
      .bind(k, now, now, ver, msg, src, clip(b.stack, 1200), clip(b.ua, 120), clip(b.lang, 5), clip(b.page, 80)).run();
    if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM errs WHERE last < ?').bind(now - 30 * 864e5).run();
  })().catch(() => {}));
  return json({ ok: true });
}
async function errors(req, env, json) {
  const key = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.REVIEW_KEY || !sameKey(key, env.REVIEW_KEY)) return json({ error: 'forbidden' }, 403);
  if (!env.DB) return json({ error: 'no log' }, 500);
  const rows = await env.DB.prepare('SELECT last, first, n, ver, msg, src, stack, ua, lang, page FROM errs ORDER BY last DESC LIMIT 200').all();
  return json({ rows: rows.results || [] });
}

async function usage(req, env, json) {
  const key = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.REVIEW_KEY || !sameKey(key, env.REVIEW_KEY)) return json({ error: 'forbidden' }, 403);
  if (!env.DB) return json({ error: 'no log' }, 500);
  const since = Date.now() - 7 * 864e5;
  const days = await env.DB.prepare("SELECT date(ts / 1000, 'unixepoch') AS d, src, COUNT(*) AS n FROM chat WHERE ts > ? GROUP BY d, src ORDER BY d").bind(since).all();
  const er = await env.DB.prepare('SELECT COUNT(*) AS kinds, SUM(n) AS n FROM errs WHERE last > ?').bind(Date.now() - 864e5).first();
  return json({ days: days.results || [], errors: er || {}, gemini: !!env.GEMINI_KEY, model: env.GEMINI_MODEL || '', ai: env.MODEL || '' });
}

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

// Gemini (when the Worker has a GEMINI_KEY secret): the same messages, Google's API; null when it gives no answer, and
// then Workers AI answers as before. The key stays a Worker secret: it is never in the site or in this file.
// what this model and key take, learnt from its answers (per Worker instance): the setting that keeps it from thinking
// (a newer model wants thinkingLevel, an older one thinkingBudget), and Google Search (the free tier may have none: then
// it is left out for an hour)
const GEM = { think: 0, searchOff: 0 };
const THINK = [{ thinkingLevel: 'minimal' }, { thinkingBudget: 0 }, null];
async function gemini(env, messages) {
  if (!env.GEMINI_KEY) return null;
  const model = env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const contents = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const ask = (think, search) => {
    const gen = { maxOutputTokens: 220, temperature: 0.8 };
    if (THINK[think]) gen.thinkingConfig = THINK[think];   // a short chat line: no thinking (faster, and the tokens go to the answer)
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: gen, ...(search ? { tools: [{ google_search: {} }] } : {}) }),
      signal: AbortSignal.timeout(search ? 10000 : 6000) });   // the site waits 18 s: time left for Workers AI
  };
  const t0 = Date.now();
  try {
    let search = Date.now() > GEM.searchOff, r = null;
    for (;;) {
      r = await ask(GEM.think, search);
      if (r.status === 400 && GEM.think < THINK.length - 1) { GEM.think++; continue; }   // that thinking setting is not taken: the next one
      if (search && (r.status === 429 || r.status === 400)) { console.log('gemini search', r.status); GEM.searchOff = Date.now() + 3600e3; search = false; continue; }
      break;
    }
    if (!r.ok) { console.log('gemini', r.status, (await r.text()).slice(0, 300)); return null; }   // the free allowance used up (429), a wrong key, the model busy: Workers AI answers
    const j = await r.json(), p = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    const t = (p || []).map(x => x.text || '').join('').trim();
    if (!t) console.log('gemini empty', JSON.stringify(j).slice(0, 300));
    return t || null;
  } catch (e) { console.log('gemini threw', String(e), Date.now() - t0); return null; }
}

/* ---- notifications to a closed app (Web Push) ----
   A phone subscribes (POST /push/sub: the player's name key and the browser's push subscription; the administrator's
   device also sends the review key). When something happens (a player writes to the administrator, asks for a club;
   the administrator answers) the site asks the Worker (POST /push/send) to wake the phones of whom it concerns. The
   push carries nothing: the phone's service worker then asks GET /push/last for what it was (the kind and a short name)
   and shows the notification in the phone's own language. So no message text ever goes through the push services.
   The key pair is the Worker secret VAPID_JWK (made once with vapid.mjs); the public half is GET /push/key. */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
function vapidJwk(env) { try { const j = JSON.parse(env.VAPID_JWK || ''); return j && j.d && j.x && j.y ? j : null; } catch (e) { return null; } }
// the public key as the browser wants it: 0x04 || x || y
function vapidPublic(j) { const x = unb64u(j.x), y = unb64u(j.y), k = new Uint8Array(65); k[0] = 4; k.set(x, 1); k.set(y, 33); return b64u(k); }
async function vapidAuth(env, endpoint) {
  const j = vapidJwk(env), aud = new URL(endpoint).origin;
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: j.x, y: j.y, d: j.d, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const head = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUB || 'https://servetsvm.github.io/bridge/' });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(head));
  return 'vapid t=' + head + '.' + b64u(sig) + ', k=' + vapidPublic(j);
}
const PUSH_KINDS = ['msg', 'club', 'reply', 'clubopen'];
/* the administrator, known without a separate key: the app sends its database sign-in (Authorization: Firebase <id token>);
   the database lets a device read only its own session sess/<uid>, written only with the right PIN, so its name there
   ("servet") proves it. The database checks the token itself. */
const FB_DB = 'https://bridgetable-89b1a-default-rtdb.europe-west1.firebasedatabase.app';
async function fbAdmin(env, auth) {
  const t = String(auth || '').replace(/^Firebase\s+/i, '');
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(t)) return false;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64u(t.split('.')[1]))), uid = String(p.user_id || p.sub || '');
    if (!/^[\w-]{6,128}$/.test(uid)) return false;
    const r = await fetch((env.FB_DB || FB_DB) + '/sess/' + uid + '/k.json?auth=' + encodeURIComponent(t));
    return r.ok && (await r.json()) === (env.ADMIN_NAME || 'servet');
  } catch (e) { return false; }
}
/* the phones' subscriptions, kept in Workers KV (binding PUSH): sub:<1 admin|0>:<name>:<id> = { ep, name, admin, ts },
   ep:<id> = that key, last:<id> = { kind, n, t } (what the last push was about). id = a hash of the push address. */
async function epId(ep) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ep)); return [...new Uint8Array(h)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join(''); }
const pushKey = (admin, name, id) => 'sub:' + (admin ? 1 : 0) + ':' + encodeURIComponent(name) + ':' + id;
async function pushDel(env, ep) {
  const id = await epId(ep), k = await env.PUSH.get('ep:' + id);
  await Promise.all([k && env.PUSH.delete(k), env.PUSH.delete('ep:' + id), env.PUSH.delete('last:' + id)]);
}
async function pushList(env, prefix) {
  const out = []; let cursor;
  do { const r = await env.PUSH.list({ prefix, cursor }); for (const k of r.keys) out.push(k.name); cursor = r.list_complete ? null : r.cursor; } while (cursor && out.length < 1000);
  return out;
}
async function pushRoute(path, req, b, env, ctx, json) {
  if (!env.PUSH || !vapidJwk(env)) return json({ error: 'push not set up' }, 501);
  const ah = req.headers.get('Authorization') || '', key = ah.replace(/^Bearer\s+/i, '');
  const admin = !!(env.REVIEW_KEY && sameKey(key, env.REVIEW_KEY)) || (/^Firebase\s/i.test(ah) && await fbAdmin(env, ah));
  if (path === '/push/sub') {
    const name = clip(b && b.name, 40).toLowerCase(), sub = b && b.sub, ep = sub && clip(sub.endpoint, 600);
    if (!name || !ep || !/^https:\/\//.test(ep)) return json({ error: 'bad request' }, 400);
    const id = await epId(ep), old = await env.PUSH.get('ep:' + id), k = pushKey(admin, name, id);
    if (old && old !== k) await env.PUSH.delete(old);   // the same phone under another name (or now the administrator's)
    await env.PUSH.put(k, JSON.stringify({ ep, name, admin, ts: Date.now() }), { expirationTtl: 400 * 86400 });
    await env.PUSH.put('ep:' + id, k, { expirationTtl: 400 * 86400 });
    return json({ ok: true, admin });
  }
  if (path === '/push/unsub') { const ep = clip(b && b.ep, 600); if (ep) await pushDel(env, ep); return json({ ok: true }); }
  if (path === '/push/send') {
    const kind = PUSH_KINDS.includes(b && b.kind) ? b.kind : null, n = clip(b && b.n, 40), to = clip(b && b.to, 40).toLowerCase();
    if (!kind || !to) return json({ error: 'bad request' }, 400);
    // to the administrator: anyone (a player's message or club request); to a player: only the administrator
    if (to !== 'admin' && !admin) return json({ error: 'forbidden' }, 403);
    const keys = await pushList(env, to === 'admin' ? 'sub:1:' : 'sub:0:' + encodeURIComponent(to) + ':');
    ctx.waitUntil(Promise.all(keys.map(async k => {
      try {
        const v = JSON.parse(await env.PUSH.get(k) || 'null'); if (!v || !v.ep) return;
        await env.PUSH.put('last:' + k.split(':').pop(), JSON.stringify({ kind, n, t: Date.now() }), { expirationTtl: 86400 * 2 });
        const res = await fetch(v.ep, { method: 'POST', headers: { Authorization: await vapidAuth(env, v.ep), TTL: '86400', Urgency: 'high', 'Content-Length': '0' } });
        if (res.status === 404 || res.status === 410) await pushDel(env, v.ep);   // the phone unsubscribed
        else if (!res.ok) console.log('push', res.status, (await res.text()).slice(0, 200));
      } catch (e) { console.log('push threw', String(e)); }
    })));
    return json({ ok: true, n: keys.length });
  }
  return json({ error: 'not found' }, 404);
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
    if (path === '/errors' && req.method === 'GET') return errors(req, env, json);
    if (path === '/usage' && req.method === 'GET') return usage(req, env, json);
    // push: the public key, and (for a phone's service worker) what its last push was about
    if (path === '/push/key' && req.method === 'GET') { const j = vapidJwk(env); return j ? json({ key: vapidPublic(j) }) : json({ error: 'push not set up' }, 501); }
    if (path === '/push/last' && req.method === 'GET') {
      const ep = new URL(req.url).searchParams.get('ep') || ''; if (!env.PUSH || !ep) return json({});
      const r = JSON.parse(await env.PUSH.get('last:' + await epId(ep.slice(0, 600))).catch(() => null) || 'null');
      return json(r && r.kind && Date.now() - r.t < 864e5 ? { kind: r.kind, n: r.n || '' } : {});
    }
    if (req.method !== 'POST' || !ok) return json({ error: 'forbidden' }, 403);
    if (limited(req.headers.get('CF-Connecting-IP') || 'x')) return json({ error: 'slow down' }, 429);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad request' }, 400); }
    if (path === '/err') return takeError(b, env, ctx, json);
    if (path.startsWith('/push/')) return pushRoute(path, req, b, env, ctx, json);
    // the player's 👍 (1) or 👎 (-1) on an answer of the last day
    if (path === '/rate') {
      const id = String(b && b.id || ''), v = b && b.v === 1 ? 1 : b && b.v === -1 ? -1 : 0;
      if (!/^[0-9a-f-]{36}$/.test(id) || !v || !env.DB) return json({ error: 'bad request' }, 400);
      ctx.waitUntil(env.DB.prepare('UPDATE chat SET rate = ? WHERE id = ? AND ts > ?').bind(v, id, Date.now() - 864e5).run().catch(() => {}));
      return json({ ok: true });
    }
    const text = clip(b && b.text, 300); if (!text) return json({ error: 'empty' }, 400);
    if (asksBot(text)) { const reply = BOT_SAYS[b.lang] || BOT_SAYS.en; return json({ reply, id: logChat(env, ctx, b, text, reply, 'fixed') }); }
    const wx = await weather(text, b.lang);
    // the forecast beside the question too (a small model reads it there, not only in the rules)
    const messages = [{ role: 'system', content: prompt(b) + '\n' + nowLine(b) + (wx ? '\n' + wx : '') }, ...history(b), { role: 'user', content: wx ? text + '\n\n[' + wx + ']' : text }];
    try {
      // Gemini first (when it has a key), else (or when it gives nothing) the Workers AI model
      let raw = await gemini(env, messages), src = 'gemini';
      if (!raw) { const r = await env.AI.run(env.MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', { messages, max_tokens: 140, temperature: 0.8 }); raw = r && r.response; src = 'ai'; }
      let reply = clip(raw, 400).replace(/^["“]|["”]$/g, '');
      reply = reply.replace(/\s*🤖\s*/gu, ' ').replace(/\s{2,}/g, ' ').trim();   // no robot emoji in the answers
      if (b.lang === 'tr') reply = reply.replace(/köprü(?=\s|[.,!?]|$)/gi, 'Bridge');   // the game's name, if a model still translated it
      reply = reply.replace(new RegExp('^' + clip(b.bot && b.bot.name, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'i'), '');
      if (!reply || SAYS_HUMAN.test(reply)) { logChat(env, ctx, b, text, reply, 'blocked'); return json({ error: 'no answer' }, 502); }   // kept, to see what the model tried to say
      reply = reply.slice(0, 280);
      return json({ reply, id: logChat(env, ctx, b, text, reply, src) });
    } catch (e) {
      return json({ error: 'ai unavailable' }, 503);   // the day's free allowance used up, or the model busy: the site answers by itself
    }
  },
};
