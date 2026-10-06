# Bridge Table

Play bridge against three robots from any seat, with a full convention card, bid explanations and IMP/MP scoring against a virtual field of robot tables.

## Running it without Claude

**One file, works offline anywhere:** `dist/bridge-table.html`

- **PC:** double-click `dist/bridge-table.html`. It opens in your browser and needs no internet.
- **Phone:** copy `dist/bridge-table.html` to the phone (USB cable, Google Drive, e-mail to yourself, WhatsApp, …) and open it with Chrome or the Files app → *Open with* → Chrome. Scores are kept in that browser.

**Installed app on the phone (recommended):** put the folder on any free static host and open the address on the phone, then *Add to Home screen*. It then runs full-screen and offline like a normal app.

- *GitHub Pages:* create a repository, upload everything in this folder (except `dist` and `.claude`), Settings → Pages → Deploy from branch `main`. Your address is `https://<username>.github.io/<repository>/`.
- *Netlify Drop:* drag this folder onto https://app.netlify.com/drop.

After changing files on a host, raise `VERSION` in `sw.js` so installed phones pick up the update.

## Rebuilding the single file

```
powershell -ExecutionPolicy Bypass -File build.ps1
```

## Files

| File | Contents |
|---|---|
| `js/core.js` | constants, auction rules, scoring, IMP table, convention card texts |
| `js/bidding.js` | bidding system and conventions (add a convention here) |
| `js/play.js` | robot card play and the double-dummy solver |
| `js/field.js` | robot tables that play the same deal for IMP/MP |
| `js/storage.js` | saved scores and period statistics |
| `js/app.js` | screen, game flow, settings |
| `css/style.css` | look and layout |
| `manifest.webmanifest`, `sw.js`, `icons/` | installable / offline app |
