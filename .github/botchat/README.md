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
