# MWC Block Explorer

Static, dependency-light blockchain explorer for MinersWorldCoin (MWC). Open `index.html`
(or serve the folder with any static web server) and it talks to `https://api.minersworld.org`.

## What changed in this version
- New design system in `css/style.css` (tokens for dark/light, one accent colour, Inter + JetBrains Mono)
- Cleaner navigation (Wallets / Network / Ecosystem / API), network switcher pill, theme toggle that
  respects system preference *and* a saved choice
- Home: live stat tiles (height, hashrate, difficulty, supply, avg block time), themed chart,
  "x min ago" ages, loading skeletons, highlight on new blocks, polling only while the home page is visible
- Block / transaction / address pages rebuilt as key-value cards with copy buttons, prev/next block
  arrows, confirmation badges, balance summary, labelled addresses
- Search: press `/` to focus, transaction-id fallback no longer fails silently
- Security: all API/URL data is HTML-escaped (`esc()` in `js/ui.js`); jQuery 2.1.1 -> 3.7.1;
  Highcharts pinned to 11.4.8
- Bug fixes: input links pointed to `#/tx/...` (a route that doesn't exist) -> `#/transaction/...`;
  coinbase transactions no longer produce `NaN` fees; "load more" buttons used the wrong `this`;
  home page re-downloaded blocks and redrew the chart every 10s even with no new block;
  `loadPeers.js` was being run on the home page; duplicate script includes; manifest icon paths

## Structure
- `index.html` – explorer (hash-routed SPA: `#/block/…`, `#/transaction/…`, `#/address/…`, `#/height/…`)
- `js/ui.js` – shared helpers (escaping, number formatting, copy/QR handlers)
- `js/display*.js` – one renderer per page/section
- `css/style.css` – everything visual; other pages (`peers.html`, `webwallet.html`, …) share it

## Richlist
`richlist.html` shows the top addresses by balance. The explorer API has no "all balances" endpoint, so a
small script builds a snapshot by replaying the chain through the existing API (no dependencies, Node 18+):

```bash
node tools/build-richlist.js --estimate   # count transactions + estimate how long the first run takes
node tools/build-richlist.js              # first run = full crawl (resumable: Ctrl+C is safe, just run it again)
node tools/build-richlist.js --verify 10  # optional: cross-check the top 10 against /balance/<address>
node tools/build-richlist.js --testnet    # testnet snapshot -> data/richlist-testnet.json (page: richlist.html?testnet=1)
```

The first run walks every block and transaction. Later runs only process blocks added since the last run,
so schedule it, for example every 15 minutes:

```cron
*/15 * * * * cd /path/to/explorer && node tools/build-richlist.js >> richlist.log 2>&1
```

Then publish `data/richlist.json` with the site. Useful flags: `--concurrency 6`, `--delay <ms>` (pause between
batches to go easy on the API), `--top 5000` (addresses kept in the file), `--confirmations 10` (stay behind the tip).
`data/.richlist-state.json` is the resume state: keep it on the machine that runs the job, don't publish it.

### Automating the richlist with GitHub Actions
`.github/workflows/richlist.yml` runs `tools/build-richlist.js` every 30 minutes (and on demand from the Actions tab).
Each run restores the saved crawl state, processes only new blocks, and force-pushes `richlist.json` + the state to a
single-commit `richlist-data` branch, so the repository never accumulates snapshot history. `richlist.html` loads
`https://raw.githubusercontent.com/Miners-World-Coin-MWC/explorer/richlist-data/richlist.json` first (derived automatically on `*.github.io`;
otherwise edit `REMOTE_URL` in `js/richlist.js`) and falls back to `data/richlist.json`.

Setup is just uploading the project (including the `.github` folder and, if you already ran the crawl locally, the `data` folder,
which holds the resume file `data/.richlist-state.json`). The workflow starts by itself and continues from that file; if it is
absent it simply does the first crawl itself.

The first crawl, if the workflow has to do it, runs in chunks of up to 330 minutes per run.
