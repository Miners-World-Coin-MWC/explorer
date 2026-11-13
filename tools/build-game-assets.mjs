// ---------------------------------------------------------------------------
// Build data/game-assets.json — a registry snapshot for the block explorer.
//
// WHY: the explorer (HTTPS, GitHub Pages) resolves COMMITMENT-mode game-asset
// payloads (hash-only on chain) against the game registry at GAME_API_BASE.
// Until the game server has TLS, browsers block that cross-origin HTTP fetch
// (mixed content). This script runs where plain HTTP is fine (CI runner, your
// box): it walks the chain, finds every MWC-GAME-ASSET transaction, pulls its
// registry record (incl. the canonical bodyHex), and writes a snapshot the
// explorer reads same-origin. The browser still re-verifies SHA-256(commitment)
// itself, so a stale/tampered snapshot can never fake an asset.
//
// USAGE (Node 18+, zero dependencies):
//   node tools/build-game-assets.js                     # incremental scan + refresh
//   node tools/build-game-assets.js --start 222000      # first run: scan from a height
//   node tools/build-game-assets.js --txid <hex>        # force-include/refresh a tx
//   node tools/build-game-assets.js --max-blocks 500    # cap blocks per run
//   node tools/build-game-assets.js --game http://51.15.16.47:8081
//   node tools/build-game-assets.js --testnet
//
// State:  data/.game-assets-state.json  (scan cursor + known txids — keep on
//         the machine/branch that runs the job, same policy as richlist state)
// Output: data/game-assets.json         (publish with the site)
//
// Scheduled refresh: .github/workflows/game-assets.yml (like the richlist job).
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SELF, '..')

// ---- flags -----------------------------------------------------------------
const opt = { api: '', game: '', start: 0, txid: [], maxBlocks: 1200, delay: 60, concurrency: 6, testnet: false, out: '' }
for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a === '--api') opt.api = process.argv[++i]
    else if (a === '--game') opt.game = process.argv[++i]
    else if (a === '--start') opt.start = Number(process.argv[++i])
    else if (a === '--txid') opt.txid.push(String(process.argv[++i]).toLowerCase())
    else if (a === '--max-blocks') opt.maxBlocks = Number(process.argv[++i])
    else if (a === '--delay') opt.delay = Number(process.argv[++i])
    else if (a === '--concurrency') opt.concurrency = Number(process.argv[++i])
    else if (a === '--testnet') opt.testnet = true
    else if (a === '--out') opt.out = process.argv[++i]
    else if (a === '--help' || a === '-h') { console.log('See header of this file'); process.exit(0) }
}

const API = (opt.api || 'https://api.minersworld.org').replace(/\/+$/, '') + (opt.testnet ? '/testnet' : '')
const GAME = (opt.game || 'http://51.15.16.47:8081').replace(/\/+$/, '')
const STATE_FILE = join(ROOT, 'data', '.game-assets-state.json')
const OUT_FILE = opt.out || join(ROOT, 'data', 'game-assets.json')
const RANGE = 30
// First-ever protocol mint: Nov 2026, height ~2227xx (Bug Hunter badge).
const DEFAULT_START = 222000

// ---- decoder (reuse the explorer's own OP_RETURN decoder) -------------------
const gaSrc = readFileSync(join(ROOT, 'js', 'gameasset.js'), 'utf8')
const GA = (() => { const m = { exports: {} }; new Function('module', 'exports', 'window', 'fetch', 'AbortSignal', gaSrc)(m, m.exports, undefined, undefined, undefined); return m.exports })()

// ---- http helpers (patterned on build-richlist.js) --------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(url, tries = 5, timeoutMs = 15000) {
    for (let t = 1; t <= tries; t++) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), timeoutMs)
        try {
            const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
            clearTimeout(timer)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            if (data && data.error) throw new Error(String(data.error.message || data.error))
            return data.result !== undefined ? data.result : data
        } catch (e) {
            clearTimeout(timer)
            if (t === tries) throw new Error(`${url} → ${e.message}`)
            await sleep(400 * t * t)
        }
    }
}
async function mapLimit(items, limit, fn) {
    const out = []
    let i = 0
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]) }
    })
    await Promise.all(workers)
    return out
}

// ---- state ------------------------------------------------------------------
function loadState() {
    try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch { return { cursorHeight: null, txids: [] } }
}
function writeAtomic(file, text) {
    const tmp = file + '.tmp'
    writeFileSync(tmp, text)
    renameSync(tmp, file)
}
function saveState(state) { writeAtomic(STATE_FILE, JSON.stringify(state)) }

// ---- scan -------------------------------------------------------------------
async function blockRange(lo, hi) {
    // /range returns up to RANGE blocks ENDING at `hi` (descending)
    const res = await get(`${API}/range/${hi}?offset=${RANGE}`)
    if (!Array.isArray(res)) throw new Error('bad /range response')
    return res.filter((b) => b.height >= lo && b.height <= hi).sort((a, b) => a.height - b.height)
}

async function txIdsOfBlock(block) {
    const ids = []
    const want = block.txcount != null ? block.txcount : 1
    while (ids.length < want) {
        const b = await get(`${API}/block/${block.hash}?offset=${ids.length}`)
        const page = b?.tx || []
        if (page.length === 0) break
        ids.push(...page)
    }
    return ids.map(String)
}

async function gameAssetsOfTx(txid) {
    const tx = await get(`${API}/transaction/${txid}`)
    const found = GA.collectGameAssets(tx)
    return { tx, found }
}

async function registryOfTx(txid) {
    try {
        const r = await get(`${GAME}/api/assets/tx/${txid}`, 2, 8000)
        if (!r || r.ok !== true) return null
        return { asset: r.asset ?? null, payload: r.payload ?? null, explorer: r.explorer ?? null }
    } catch { return null } // game server down → chain-side data still recorded
}

async function main() {
    const t0 = Date.now()
    const info = await get(`${API}/info`)
    const tip = Number(info.blocks)
    if (!Number.isFinite(tip) || tip <= 0) throw new Error('could not read chain tip from /info')

    const state = loadState()
    const entries = (() => { try { return JSON.parse(readFileSync(OUT_FILE, 'utf8')).entries || {} } catch { return {} } })()

    // Heights to scan: from cursor+1 (or --start / DEFAULT_START on first run) up to tip.
    const from = Math.max(1, opt.start || (state.cursorHeight !== null ? state.cursorHeight + 1 : DEFAULT_START))
    const to = Math.min(tip, from + opt.maxBlocks - 1)
    console.log(`chain tip ${tip} · scanning ${from}..${to} (${to - from + 1} blocks) · ${opt.txid.length} forced txids · ${Object.keys(entries).length} known entries`)

    // 1. Walk blocks, find game-asset txs (chain is the discovery source —
    //    nothing is missed even if the game registry forgets a tx).
    let discovered = 0, scanned = 0, completeThrough = from - 1
    for (let lo = from; lo <= to; lo += RANGE) {
        const hi = Math.min(to, lo + RANGE - 1)
        let blocks
        try { blocks = await blockRange(lo, hi) } catch (e) { console.error(`  ! range ${lo}-${hi}: ${e.message}`); break }
        let rangeFullyScanned = true
        for (const b of blocks) {
            scanned++
            let ids
            try { ids = await txIdsOfBlock(b) } catch (e) { console.error(`  ! block ${b.height}: ${e.message}`); rangeFullyScanned = false; continue }
            if (opt.delay) await sleep(opt.delay)
            const hits = await mapLimit(ids, opt.concurrency, async (txid) => {
                try {
                    const { found } = await gameAssetsOfTx(txid)
                    return found.length ? { txid, found } : null
                } catch (e) { rangeFullyScanned = false; return null } // transient failure → rescan next run
            })
            for (const h of hits) {
                if (!h) continue
                discovered++
                entries[h.txid] = entries[h.txid] || {}
                entries[h.txid].height = b.height
                entries[h.txid].blockhash = b.hash
                entries[h.txid].events = h.found.map((ga) => ({
                    voutIndex: ga.voutIndex, type: ga.type, mode: ga.mode, modeName: ga.modeName,
                    bodyHash: ga.bodyHash, integrityOk: ga.integrityOk ?? null,
                    name: ga.body?.meta?.name ?? null, // inline-mode metadata (on chain)
                }))
                console.log(`  + ${h.txid} @ ${b.height}: ${h.found.map((g) => g.type).join(',')}`)
            }
            if (rangeFullyScanned) completeThrough = b.height
        }
    }

    // 2. Refresh every known + forced txid against the game registry
    //    (keeps status/metadata/bodyHex current without rescanning history).
    const toRefresh = [...new Set([...Object.keys(entries), ...opt.txid.map((t) => t.toLowerCase())])]
    let refreshed = 0, registryHits = 0
    await mapLimit(toRefresh, opt.concurrency, async (txid) => {
        entries[txid] = entries[txid] || {}
        const reg = await registryOfTx(txid)
        entries[txid].registry = reg
        entries[txid].fetchedAt = Date.now()
        refreshed++
        if (reg) registryHits++
        if (!entries[txid].events) {
            // forced txid without a scan: pull chain data too so the entry is useful
            try {
                const { found } = await gameAssetsOfTx(txid)
                if (found.length) {
                    entries[txid].events = found.map((ga) => ({
                        voutIndex: ga.voutIndex, type: ga.type, mode: ga.mode, modeName: ga.modeName,
                        bodyHash: ga.bodyHash, integrityOk: ga.integrityOk ?? null,
                        name: ga.body?.meta?.name ?? null,
                    }))
                }
            } catch { /* chain API hiccup — entry stays minimal */ }
        }
    })

    // 3. Publish snapshot + state
    const snapshot = {
        _readme: 'Game-asset registry snapshot for the explorer. Browsers re-verify every bodyHex against the on-chain OP_RETURN commitment — a stale or forged snapshot cannot fake an asset. Refreshed by tools/build-game-assets.js (see .github/workflows/game-assets.yml).',
        generatedAt: new Date().toISOString(),
        api: API,
        game: GAME,
        scannedThrough: completeThrough,
        counts: { entries: Object.keys(entries).length, registryHits, discovered, blocks: scanned },
        entries,
    }
    writeAtomic(OUT_FILE, JSON.stringify(snapshot))
    state.cursorHeight = completeThrough
    state.txids = Object.keys(entries)
    saveState(state)
    console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${discovered} new tx(s), ${registryHits}/${refreshed} registry hits → ${OUT_FILE}`)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
