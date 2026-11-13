# MWC Block Explorer

Static, dependency-light blockchain explorer for MinersWorldCoin (MWC). Open `index.html`
(or serve the folder with any static web server) and it talks to `https://api.minersworld.org`.

## On-chain game assets (NFTs) from Miners World

The game "Miners World: Onchain Adventures" anchors every in-game item/NFT to the chain with an
OP_RETURN payload (`MWC-GAME-ASSET` protocol). Transaction pages decode these payloads natively:

- **v2 protocol txs** show an "On-chain game asset" banner + a rich vout row (event type, rarity,
  metadata attributes, control UTXO, previous-event links, hash-integrity badge).
- **INLINE payloads** are fully decoded + SHA-256 verified straight off the chain.
- **COMMITMENT payloads** (only a hash fits on chain) are resolved against the game registry:
  `js/gameasset.js` fetches `GET {GAME_API_BASE}/api/assets/tx/{txid}` (public, CORS `*`), which
  returns the canonical body incl. `bodyHex` — the page then **re-derives the SHA-256 commitment
  itself** and badges the asset "✔ commitment verified" (or "⚠ mismatch"). Nothing is displayed as
  verified that isn't re-checked against this transaction's own OP_RETURN hash.
- **Legacy v1 JSON anchors** (`{"v":1,"a":"MWC1-…"}`) still decode.

Set `GAME_API_BASE` in `js/config.js` to the game server's **HTTPS** origin. The explorer is served
over HTTPS, so browsers silently block fetches to plain-`http://` origins (mixed content): until the
game API has TLS in front of it, COMMITMENT payloads fall back to the hash-only view (with registry
names whenever `/api/assets/tx/…` is reachable) — no error, no false data.

Tests (no dependencies, Node 18+):

```bash
node tools/test-gameasset.mjs           # unit tests incl. live chain fixtures
node tools/integration-gameasset.mjs    # live chain + live registry end-to-end
```

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

## Mining pool stats
`pools.html` shows which pools and miners are finding blocks. There are no pool APIs and no database: the builder reads the
coinbase transaction of each block through the existing API and records which address received the block reward.

It keeps two things in `poolstats.json`: a rolling window of the most recent blocks (default 2000) and an all-time tally per
reward address covering every block back to the genesis block. The recent blocks are read first, then the history is filled in
backwards; it can be stopped and resumed at any time.

```bash
node tools/build-poolstats.js                 # recent blocks first (minutes), then the whole history (hours); later runs only add new blocks
node tools/build-poolstats.js --skip-history  # recent window only
node tools/build-poolstats.js --window 5000   # keep a longer recent window
```

`.github/workflows/poolstats.yml` runs it every 30 minutes (in 22-minute slices, so the history scan simply continues over several
runs) and publishes `poolstats.json` to a single-commit `poolstats-data` branch (separate from the richlist branch). The page reads it
from there (URL derived automatically on `*.github.io`, otherwise edit `REMOTE_URL` in `js/pools.js`) and falls back to
`data/poolstats.json`. To skip the wait, run the script once on your own machine and upload `data/poolstats.json` in the repo's
`data` folder: the workflow continues from whichever copy has scanned the most blocks.

Naming pools: edit `data/pools.json`.
- `pools` maps a reward address to a pool name (and optional website). Several addresses can share one name and are shown as one row.
- `ignore` lists fee addresses that every coinbase pays (dev fee etc.) so they are never mistaken for the miner.
Addresses with no name show as "Unlabelled" on the page; address labels from `js/addressLabels.js` are used as a fallback.
Name changes apply to the whole history immediately because names are looked up when the page renders.
