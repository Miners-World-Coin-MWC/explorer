#!/usr/bin/env node
/**
 * MWC mining pool statistics builder
 * ----------------------------------
 * Works out who is finding blocks from the blockchain itself (no pool APIs, no database):
 * for every block it reads the coinbase transaction and records which address got the block reward.
 * Two things are written to data/poolstats.json, which pools.html reads:
 *   - a rolling window of the most recent blocks (who found each one)
 *   - an ALL-TIME tally per reward address covering every block back to the genesis block
 * The recent blocks are read first (so the page is useful within minutes); the history is then filled in backwards,
 * and the run can be stopped and resumed at any time.
 *
 *   node tools/build-poolstats.js              # first run: recent blocks, then the full history (hours); later runs only add new blocks
 *   node tools/build-poolstats.js --testnet
 *
 * Options
 *   --api <url>            API base (default https://api.minersworld.org)
 *   --testnet              use <api>/testnet
 *   --out <file>           output JSON (default data/poolstats.json, or poolstats-testnet.json)
 *   --pools <file>         pool/ignore list (default data/pools.json) - "ignore" lists fee addresses to skip
 *   --window <n>           blocks to keep (default 2000)
 *   --concurrency <n>      parallel requests (default 6)
 *   --timeout <sec>        per-request timeout (default 30)
 *   --confirmations <n>    stay this many blocks behind the tip (default 3)
 *   --skip-history         only keep the recent window (no all-time tally)
 *   --max-minutes <n>      stop cleanly after n minutes (progress is saved)
 *
 * Requires Node 18+ (built-in fetch). No npm packages.
 */
'use strict'
const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
const opt = {}
for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2), next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) opt[key] = true
    else { opt[key] = next; i++ }
}
const ROOT = path.resolve(__dirname, '..')
const API = String(opt.api || 'https://api.minersworld.org').replace(/\/+$/, '') + (opt.testnet ? '/testnet' : '')
const OUT = path.resolve(ROOT, opt.out || (opt.testnet ? 'data/poolstats-testnet.json' : 'data/poolstats.json'))
const POOLS = path.resolve(ROOT, opt.pools || 'data/pools.json')
const WINDOW = Math.max(10, parseInt(opt.window || 2000, 10))
const CONCURRENCY = Math.max(1, parseInt(opt.concurrency || 6, 10))
const TIMEOUT = Math.round(parseFloat(opt.timeout || 30) * 1000)
const CONFIRMATIONS = parseInt(opt.confirmations || 3, 10)
const MAX_MINUTES = opt['max-minutes'] ? parseFloat(opt['max-minutes']) : Infinity
const SKIP_HISTORY = !!opt['skip-history']
const RANGE = 30
const SAVE_EVERY = 10

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function get(endpoint, tries = 6) {
    let lastErr
    for (let attempt = 0; attempt < tries; attempt++) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
        try {
            const res = await fetch(API + endpoint, { signal: ctrl.signal, headers: { accept: 'application/json' } })
            if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status)
            return await res.json()
        } catch (e) {
            lastErr = e
            await sleep(Math.min(15000, 400 * 2 ** attempt))
        } finally {
            clearTimeout(timer)
        }
    }
    throw new Error('Request failed after retries: ' + endpoint + ' (' + (lastErr && lastErr.message) + ')')
}

async function mapLimit(items, limit, fn) {
    const results = new Array(items.length)
    let next = 0
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++
            if (i >= items.length) return
            results[i] = await fn(items[i], i)
        }
    }))
    return results
}

function writeAtomic(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, text)
    fs.renameSync(tmp, file)
}

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { return null }
}

// Fee outputs that every coinbase pays (dev fee etc.) must not be mistaken for the miner
const IGNORE = new Set(((readJson(POOLS) || {}).ignore) || [])

// The miner/pool is the receiver of the largest coinbase output that is not a fee address
function pickMiner(vouts) {
    const outs = []
    for (const v of vouts || []) {
        const addr = v.scriptPubKey && v.scriptPubKey.addresses && v.scriptPubKey.addresses[0]
        if (addr && v.value > 0) outs.push({ addr, value: Math.round(v.value) })
    }
    const candidates = outs.filter(o => !IGNORE.has(o.addr))
    const pool = candidates.length ? candidates : outs
    pool.sort((a, b) => b.value - a.value)
    return pool.length ? pool[0] : null
}

async function minerOfBlock(block) {
    try {
        const b = await get(`/block/${block.hash}?offset=0`)
        const txid = b.result && b.result.tx && b.result.tx[0]
        if (!txid) return null
        const t = await get(`/transaction/${txid}`)
        if (t.error || !t.result) return null
        return pickMiner(t.result.vout)
    } catch (e) {
        return null
    }
}

async function getBlocks(start, end) {
    const data = await get(`/range/${end}?offset=${RANGE}`)
    if (data.error || !Array.isArray(data.result)) throw new Error('bad /range response for ' + end)
    const blocks = data.result.filter(b => b.height >= start && b.height <= end).sort((a, b) => a.height - b.height)
    if (blocks.length !== end - start + 1) throw new Error(`/range returned ${blocks.length} blocks for ${start}-${end}`)
    return blocks
}

// ---- all-time tally -------------------------------------------------------------------------------
// allTime = { scanLow, fromTime, unknown:[count,lastHeight,lastTime], miners:{ addr:[count,lastHeight,lastTime,firstHeight] } }
// Every block with height >= scanLow (up to lastHeight) is counted exactly once. scanLow == 0 means the whole chain is covered.
function newAllTime() { return { scanLow: null, fromTime: 0, unknown: [0, 0, 0], miners: {} } }

function tally(all, height, time, addr) {
    if (addr === null) {
        const u = all.unknown
        u[0]++
        if (height > u[1]) { u[1] = height; u[2] = time }
        return
    }
    const m = all.miners[addr]
    if (!m) { all.miners[addr] = [1, height, time, height]; return }
    m[0]++
    if (height > m[1]) { m[1] = height; m[2] = time }
    if (height < m[3]) m[3] = height
}

function coveredBlocks(out) {
    return out.allTime.scanLow === null ? 0 : out.lastHeight - out.allTime.scanLow + 1
}

async function main() {
    const info = await get('/info')
    if (!info.result) throw new Error('Could not read /info from ' + API)
    const tip = info.result.blocks
    const target = tip - CONFIRMATIONS

    let prev = readJson(OUT)
    if (prev && (prev.api !== API || !Array.isArray(prev.blocks))) prev = null
    const out = prev || { api: API, network: opt.testnet ? 'testnet' : 'mainnet', lastHeight: -1, progress: 0, tip, updated: 0, window: WINDOW, nethash: 0, unresolved: 0, allTime: newAllTime(), blocks: [] }
    out.window = WINDOW

    // a file from the earlier version (recent window only): seed the tally from the blocks it already holds
    if (!out.allTime) {
        out.allTime = newAllTime()
        if (out.blocks.length) {
            out.allTime.scanLow = out.blocks[0][0]
            out.allTime.fromTime = out.blocks[0][1]
            out.blocks.forEach(b => tally(out.allTime, b[0], b[1], b[2]))
        }
    }
    const all = out.allTime

    // New blocks: continue from the last one. On a cold start only the recent window is read first.
    const start = all.scanLow !== null ? out.lastHeight + 1 : Math.max(target - WINDOW + 1, 0)
    console.log(`API: ${API}`)
    console.log(`Chain tip ${tip.toLocaleString()}  |  window ${WINDOW}  |  new blocks ${start.toLocaleString()} -> ${target.toLocaleString()}` +
        (SKIP_HISTORY ? '' : `  |  history scanned back to ${all.scanLow === null ? '–' : all.scanLow.toLocaleString()}`))

    let stop = false
    process.on('SIGINT', () => { if (stop) process.exit(1); stop = true; console.log('\nStopping after this batch (progress is saved)...') })
    const begun = Date.now()
    let batches = 0, requests = 0

    const save = () => {
        out.blocks = out.blocks.filter(b => b[0] > target - WINDOW).sort((a, b) => a[0] - b[0])
        out.tip = tip
        out.updated = Math.floor(Date.now() / 1000)
        out.unresolved = out.blocks.filter(b => b[2] === null).length
        out.progress = coveredBlocks(out)
        // lastHeight and progress stay near the top of the file: the CI scripts read them without parsing the whole file
        const { api, network, lastHeight, progress, tip: t, updated, window: w, nethash, unresolved, allTime, blocks } = out
        writeAtomic(OUT, JSON.stringify({ api, network, lastHeight, progress, tip: t, updated, window: w, nethash, unresolved, allTime, blocks }))
    }
    const timeUp = () => (Date.now() - begun) / 60000 >= MAX_MINUTES

    try {
        // ---- 1) new blocks, oldest first (these also feed the recent window)
        for (let s = start; s <= target && !stop; s += RANGE) {
            if (timeUp()) { console.log('Time limit reached; saving progress.'); stop = true; break }
            const e = Math.min(s + RANGE - 1, target)
            const blocks = await getBlocks(s, e)
            const miners = await mapLimit(blocks, CONCURRENCY, minerOfBlock)
            blocks.forEach((b, i) => {
                const m = miners[i]
                const addr = m ? m.addr : null
                out.blocks.push([b.height, b.time, addr, m ? m.value : 0])
                if (b.nethash) out.nethash = b.nethash
                tally(all, b.height, b.time, addr)
            })
            if (all.scanLow === null) { all.scanLow = s; all.fromTime = blocks[0].time }
            out.lastHeight = e
            batches++; requests += blocks.length * 2 + 1
            if (batches % SAVE_EVERY === 0) save()
            if (batches % 5 === 0 || e === target) console.log(`  new blocks up to ${e.toLocaleString()}`)
        }

        // ---- 2) history, newest first, back to the genesis block
        if (!SKIP_HISTORY && !stop && all.scanLow !== null && all.scanLow > 0) {
            const historyStart = all.scanLow
            console.log(`Scanning the history: ${historyStart.toLocaleString()} blocks to go...`)
            while (all.scanLow > 0 && !stop) {
                if (timeUp()) { console.log('Time limit reached; saving progress.'); stop = true; break }
                const e = all.scanLow - 1
                const s = Math.max(0, e - RANGE + 1)
                const blocks = await getBlocks(s, e)
                const miners = await mapLimit(blocks, CONCURRENCY, minerOfBlock)
                blocks.forEach((b, i) => tally(all, b.height, b.time, miners[i] ? miners[i].addr : null))
                all.scanLow = s
                all.fromTime = blocks[0].time
                batches++; requests += blocks.length * 2 + 1
                if (batches % SAVE_EVERY === 0) save()
                if (batches % 10 === 0 || s === 0) {
                    const done = historyStart - s, elapsed = (Date.now() - begun) / 1000
                    const eta = elapsed > 0 && done > 0 ? (historyStart - done) / (done / elapsed) : 0
                    const dur = x => { x = Math.round(x); return x >= 3600 ? `${Math.floor(x / 3600)}h ${Math.floor(x % 3600 / 60)}m` : x >= 60 ? `${Math.floor(x / 60)}m ${x % 60}s` : `${x}s` }
                    console.log(`  history: ${(done / historyStart * 100).toFixed(1)}%  (down to block ${s.toLocaleString()})  ~${(requests / elapsed).toFixed(0)} req/s  ETA ${dur(eta)}`)
                }
            }
        }
    } finally {
        save()
    }

    // short summary
    const entries = Object.entries(all.miners).map(([a, m]) => [a, m[0]]).sort((x, y) => y[1] - x[1])
    const covered = coveredBlocks(out)
    console.log(`\nDone. Recent window: ${out.blocks.length} blocks (${out.unresolved} without a readable coinbase), up to block ${out.lastHeight.toLocaleString()}.`)
    console.log(`All-time tally: ${covered.toLocaleString()} blocks` + (all.scanLow === 0 ? ' (the whole chain)' : ` (from block ${all.scanLow.toLocaleString()}; history scan not finished - run again to continue)`) +
        `, ${entries.length.toLocaleString()} distinct reward addresses, ${all.unknown[0]} unreadable.`)
    entries.slice(0, 8).forEach(([addr, n]) => console.log(`  ${String(n).padStart(7)}  ${(n / Math.max(1, covered) * 100).toFixed(1).padStart(5)}%  ${addr}`))
    console.log(`Wrote ${path.relative(process.cwd(), OUT)}`)
}

main().catch(e => { console.error('\nError: ' + e.message); process.exit(1) })
