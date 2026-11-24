# The robots' chat (Cloudflare Worker + Workers AI)

When you play with the robots, what you write to them in the table chat goes to this Worker. The Worker answers as the
robot, in your language, with a free Workers AI model. It gets only what everyone at the table sees (the contract, the
auction, the tricks) and the last few chat messages. It never gets a hand. Bidding explanations do not come from here:
the site gives them from the robots' own system.

If the Worker can't be reached (not set up yet, the day's free allowance used up, offline), the robots answer with the
site's own short replies. On the free plan nothing is ever billed: once the daily allowance is used up, requests fail
until the next day.

## Set up (once)

1. Create a free account at https://dash.cloudflare.com/sign-up (no card needed).
2. In this folder, sign in and deploy:

   ```bash
   cd .github/botchat
   npx wrangler login
   npx wrangler deploy
   ```

   `deploy` prints the address, like `https://bridge-bots.<your-subdomain>.workers.dev`.
3. Put that address in `js/app.js` as `BOT_AI` (now `https://bridge-bots.bridgetable.workers.dev/`), then build
   and publish the site as usual.

## Gemini (optional)

With a Gemini API key the robots answer with Gemini, and Workers AI answers only when Gemini gives nothing (its free
allowance used up, the model busy). Without the key nothing changes.

1. Get a free key at https://aistudio.google.com/apikey (with your own Google account).
2. In this folder run `npx wrangler secret put GEMINI_KEY` and paste the key when it asks. The key is kept by
   Cloudflare as a secret: it is never in the site or in this repository.
3. The model is `GEMINI_MODEL` in `wrangler.toml` (`gemini-flash-lite-latest`: about 1 s an answer; `gemini-flash-latest` took over 9 s). Remove the key with
   `npx wrangler secret delete GEMINI_KEY`.

On Gemini's free tier Google may use what is sent to improve its models: the robots' chat lines (no names, no hands)
then go to Google.

The review page's `src` column says which one answered: `gemini` or `ai` (Workers AI).

## Weather and looking things up

- Asked about the weather, the Worker finds the town in the message and gives the robot the real forecast from
  Open-Meteo (free, no key; cached 30 minutes).
- Gemini is asked with Google Search, so it can look up what it does not know. On a free Gemini key Google Search may
  have no allowance (the answer is 429): the Worker then asks without it for an hour. Enabling billing on the key in
  Google AI Studio gives it Google Search.
- The site waits 18 s for an answer.

## Test before publishing

In the browser console on the site or a local preview, run:

```js
localStorage.setItem('bridge-bot-ai', 'https://bridge-bots.<your-subdomain>.workers.dev/')
```

Then reload. `localStorage.removeItem('bridge-bot-ai')` turns the test address off again.

## Settings

- `MODEL` in `wrangler.toml`: `@cf/meta/llama-3.1-8b-instruct-fp8-fast` uses about 5 Neurons per answer. The free
  allowance is 10,000 Neurons a day, about 2,000 answers. A bigger model answers better but uses more of the allowance.
- The allowed sites (`ORIGINS`) and the per-address limits (`PER_MIN`, `PER_DAY`) are at the top of `worker.js`.

## The log, 👍/👎 and the review

Every answer is kept in the D1 database `bridge-botchat` (binding `DB`, table in `schema.sql`) for 90 days. It holds what
the player wrote, what the robot answered, the language, the robot's name and role, the phase, the player's 👍/👎, and
whether the answer was held back (⛔: the model said it was a person). It never holds the player's name, a card or an IP
address.

- Players rate an AI answer with 👍/👎 under it in the table chat.
- The administrator reads the log in the site: 👑 Admin → 💬 Robots' chats. The first time, enter the review key there;
  it is kept on that device only. Set the key once on the Worker (it asks for the value; choose a long one):

  ```bash
  cd .github/botchat
  npx wrangler secret put REVIEW_KEY
  ```

- From the command line: `npx wrangler d1 execute bridge-botchat --remote --command "SELECT * FROM chat WHERE rate < 0 ORDER BY ts DESC LIMIT 50"`.
- A new table on a new database: `npx wrangler d1 execute bridge-botchat --remote --file=schema.sql`.

## Notifications while the app is closed (Web Push)

The same Worker wakes the players' phones when something happens (a message or a club request to the administrator,
the administrator's answer, a club opened). The push itself carries nothing; the phone asks the Worker what it was about
(`/push/last`) and shows it in its own language. Set up once, in this folder (the Worker makes its "push" table by itself):

```bash
node vapid.mjs | npx wrangler secret put VAPID_JWK                  # the key pair, straight into a Worker secret
npx wrangler deploy
```

Phones subscribe by themselves once notifications are on and allowed (Settings → Notifications when the app is in the
background). The administrator's phone is marked as the administrator's with the review key kept on it (the same key as
for the robots' chat review); a push to a player is only sent with that key. Until VAPID_JWK is set nothing changes:
the site goes on without these notifications.
