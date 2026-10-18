#!/usr/bin/env node
/**
 * MWC richlist snapshot builder
 * -----------------------------
 * Replays the chain through the public explorer API (blocks -> transactions) and keeps a running
 * balance per address, then writes data/richlist.json which richlist.html reads.
 *
 *   node tools/build-richlist.js --estimate        # count requests + estimate time, changes nothing
 *   node tools/build-richlist.js                   # first run: full crawl (resumable, Ctrl+C is safe)
 *   node tools/build-richlist.js                   # later runs: only processes new blocks
 *   node tools/build-richlist.js --testnet
 *   node tools/build-richlist.js --verify 10       # cross-check top 10 against /balance/<address>
 *
 * Options
 *   --api <url>            API base (default https://api.minersworld.org)
 *   --testnet              use <api>/testnet
 *   --out <file>           output JSON       (default data/richlist.json, or richlist-testnet.json)
 *   --state <file>         resume state      (default data/.richlist-state.json)
 *   --concurrency <n>      parallel requests (default 6)
 *   --delay <ms>           pause between batches, to be gentle on the API (default 0)
 *   --top <n>              addresses kept in the output file (default 5000)
 *   --confirmations <n>    stay this many blocks behind the tip to avoid reorgs (default 10)
 *   --timeout <sec>        per-request timeout (default 30)
 *   --strict               stop on the first transaction the API cannot return (default: skip it, record it, carry on)
 *   --retry-skipped        re-try transactions skipped by earlier runs (their balance changes are applied if they now load)
 *   --max-minutes <n>      stop cleanly after n minutes and save progress (for CI jobs with a time limit)
 *   --max-blocks <n>       stop after n blocks (testing)
 *
 * Requires Node 18+ (built-in fetch). No npm packages.
 */
'use strict'
const fs = require('fs')
const path = require('path')

// ---------- options ----------
const argv = process.argv.slice(2)
const opt = {}
for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) opt[key] = true
    else { opt[key] = next; i++ }
}
const ROOT = path.resolve(__dirname, '..')
const API = String(opt.api || 'https://api.minersworld.org').replace(/\/+$/, '') + (opt.testnet ? '/testnet' : '')
const OUT = path.resolve(ROOT, opt.out || (opt.testnet ? 'data/richlist-testnet.json' : 'data/richlist.json'))
const STATE = path.resolve(ROOT, opt.state || (opt.testnet ? 'data/.richlist-state-testnet.json' : 'data/.richlist-state.json'))
const CONCURRENCY = Math.max(1, parseInt(opt.concurrency || 6, 10))
const DELAY = parseInt(opt.delay || 0, 10)
const TOP = parseInt(opt.top || 5000, 10)
const CONFIRMATIONS = parseInt(opt.confirmations || 10, 10)
const MAX_BLOCKS = opt['max-blocks'] ? parseInt(opt['max-blocks'], 10) : Infinity
const MAX_MINUTES = opt['max-minutes'] ? parseFloat(opt['max-minutes']) : Infinity
const TIMEOUT = Math.round(parseFloat(opt.timeout || 30) * 1000)
const STRICT = !!opt.strict
const TX_TRIES = 5          // a transaction the API cannot serve is given up on after this many attempts
const MAX_CONSECUTIVE_FAILURES = 20   // this many different requests failing in a row = the API is down, stop and resume later
const RANGE = 30          // blocks per /range request
const SAVE_EVERY = 20     // batches between checkpoints

// ---------- helpers ----------
let requestCount = 0
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function get(endpoint, tries = 7) {
    let lastErr
    for (let attempt = 0; attempt < tries; attempt++) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
        try {
            requestCount++
            const res = await fetch(API + endpoint, { signal: ctrl.signal, headers: { accept: 'application/json' } })
            if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status)
            const json = await res.json()
            return json
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
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++
            if (i >= items.length) return
            results[i] = await fn(items[i], i)
        }
    })
    await Promise.all(workers)
    return results
}

function loadState() {
    try {
        const s = JSON.parse(fs.readFileSync(STATE, 'utf8'))
        if (s.api !== API) throw new Error('state was built for another API/network (' + s.api + ')')
        return { api: API, lastHeight: s.lastHeight, skipped: s.skipped || [], balances: new Map(Object.entries(s.balances).map(([k, v]) => [k, BigInt(v)])) }
    } catch (e) {
        if (e.code !== 'ENOENT') console.warn('! ignoring saved state: ' + e.message)
        return { api: API, lastHeight: -1, skipped: [], balances: new Map() }
    }
}

function writeAtomic(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, text)
    fs.renameSync(tmp, file)
}

function saveState(state) {
    const balances = {}
    for (const [k, v] of state.balances) balances[k] = v.toString()
    writeAtomic(STATE, JSON.stringify({ api: state.api, lastHeight: state.lastHeight, skipped: state.skipped, balances }))
}

function writeOutput(state, tipHeight) {
    const positive = [...state.balances].filter(([, v]) => v > 0n)
    positive.sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1))
    const supply = positive.reduce((sum, [, v]) => sum + v, 0n)
    const out = {
        network: opt.testnet ? 'testnet' : 'mainnet',
        height: state.lastHeight,
        tip: tipHeight,
        updated: Math.floor(Date.now() / 1000),
        holders: positive.length,
        supply: supply.toString(),
        skipped: state.skipped.length,
        addresses: positive.slice(0, TOP).map(([a, v]) => ({ a, b: v.toString() }))
    }
    writeAtomic(OUT, JSON.stringify(out))
    return out
}

const fmtDur = s => {
    s = Math.round(s)
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
    return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`
}

// Fetch block summaries for heights [start, end] (ascending)
async function getBlocks(start, end) {
    const data = await get(`/range/${end}?offset=${RANGE}`)
    if (data.error || !Array.isArray(data.result)) throw new Error('bad /range response for ' + end)
    const blocks = data.result.filter(b => b.height >= start && b.height <= end).sort((a, b) => a.height - b.height)
    if (blocks.length !== end - start + 1) throw new Error(`/range returned ${blocks.length} blocks for ${start}-${end}`)
    return blocks
}

// All transaction ids of a block (the API pages them)
async function getTxIds(block) {
    const ids = []
    const want = block.txcount != null ? block.txcount : 1
    while (ids.length < want) {
        const data = await get(`/block/${block.hash}?offset=${ids.length}`)
        if (data.error || !data.result) throw new Error('block lookup failed: ' + block.hash)
        const page = data.result.tx || []
        if (page.length === 0) break
        ids.push(...page)
    }
    return ids
}

// Transactions the API could not return during the current batch (moved into the saved state once the batch completes)
let pendingSkipped = []
let consecutiveFailures = 0

function skipTx(txid, height, reason, outage) {
    if (height === 0) return null // genesis coinbase is usually not retrievable, and is unspendable anyway
    if (STRICT) throw new Error(`transaction lookup failed: ${txid} (${reason})`)
    if (outage && ++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(`${MAX_CONSECUTIVE_FAILURES} requests in a row failed - the API looks unavailable. Progress is saved; run again later to resume.`)
    }
    console.warn(`  ! skipping transaction ${txid} (block ${height}): ${reason}`)
    pendingSkipped.push({ txid, height, reason })
    return null
}

// Balance changes caused by one transaction (null = could not be read, already recorded)
async function getTxDelta(txid, height) {
    let data
    try {
        data = await get(`/transaction/${txid}`, TX_TRIES)
    } catch (e) {
        return skipTx(txid, height, e.message.replace(/^Request failed after retries: \S+ /, ''), true)
    }
    if (data.error || !data.result) {
        // a clean "not found" answer is a data gap, not an outage
        return skipTx(txid, height, 'API answered: ' + JSON.stringify(data.error || data).slice(0, 80), false)
    }
    consecutiveFailures = 0

    const delta = []
    for (const vin of data.result.vin || []) {
        if (vin.coinbase !== undefined || vin.value === undefined) continue
        const addr = vin.scriptPubKey && vin.scriptPubKey.addresses && vin.scriptPubKey.addresses[0]
        if (addr) delta.push([addr, -BigInt(Math.round(vin.value))])
    }
    for (const vout of data.result.vout || []) {
        const addr = vout.scriptPubKey && vout.scriptPubKey.addresses && vout.scriptPubKey.addresses[0]
        if (addr && vout.value) delta.push([addr, BigInt(Math.round(vout.value))])
    }
    return delta
}

// ---------- main ----------
let liveState = null

async function main() {
    const info = await get('/info')
    if (!info.result) throw new Error('Could not read /info from ' + API)
    const tip = info.result.blocks
    const target = Math.min(tip - CONFIRMATIONS, MAX_BLOCKS === Infinity ? Infinity : MAX_BLOCKS - 1)
    const state = opt.estimate ? { lastHeight: loadState().lastHeight } : loadState()
    liveState = opt.estimate ? null : state
    const from = state.lastHeight + 1

    console.log(`API: ${API}`)
    console.log(`Chain tip: ${tip.toLocaleString()}  |  processing ${from.toLocaleString()} -> ${target.toLocaleString()}`)

    if (!opt.estimate && opt['retry-skipped'] && state.skipped.length) {
        console.log(`Retrying ${state.skipped.length} previously skipped transaction(s)...`)
        const still = []
        for (const item of state.skipped) {
            pendingSkipped = []
            const d = await getTxDelta(item.txid, item.height)
            if (d) {
                for (const [addr, amount] of d) state.balances.set(addr, (state.balances.get(addr) || 0n) + amount)
                console.log(`  recovered ${item.txid}`)
            } else {
                still.push(item)
            }
        }
        pendingSkipped = []
        state.skipped = still
        saveState(state)
    }

    if (target < from) {
        console.log('Nothing new to process.')
        if (!opt.estimate) { const o = writeOutput(state, tip); console.log(`Snapshot refreshed (${o.holders} holders).`) }
        return
    }

    // ----- estimate mode: count transactions only -----
    if (opt.estimate) {
        const started = Date.now()
        const ranges = []
        for (let s = from; s <= target; s += RANGE) ranges.push([s, Math.min(s + RANGE - 1, target)])
        let txTotal = 0, blocksSeen = 0
        // sample evenly across the whole chain (early blocks usually carry fewer transactions than recent ones)
        const step = Math.max(1, Math.floor(ranges.length / 20))
        const sample = ranges.filter((_, i) => i % step === 0).slice(0, 20)
        // measure with a sample, then extrapolate the rest from per-range averages
        await mapLimit(sample, CONCURRENCY, async ([s, e]) => {
            const blocks = await getBlocks(s, e)
            for (const b of blocks) { txTotal += b.txcount != null ? b.txcount : 1; blocksSeen++ }
        })
        const perSec = requestCount / ((Date.now() - started) / 1000)
        const avgTx = txTotal / blocksSeen
        const nBlocks = target - from + 1
        const estTx = Math.round(avgTx * nBlocks)
        // per block: 1+ block page request, per tx: 1 request; plus 1 range request per 30 blocks
        const estPages = Math.round(nBlocks * 1.1)
        const requests = ranges.length + estPages + estTx
        console.log(`\nSampled ${blocksSeen} blocks: ${avgTx.toFixed(2)} transactions per block on average`)
        console.log(`Estimated work: ~${estTx.toLocaleString()} transactions, ~${requests.toLocaleString()} API requests total`)
        console.log(`Measured speed: ~${perSec.toFixed(1)} requests/sec at concurrency ${CONCURRENCY}`)
        console.log(`Estimated first-run time: ~${fmtDur(requests / perSec)} (resumable; later runs only handle new blocks)`)
        return
    }

    // ----- real run -----
    let stopRequested = false
    process.on('SIGINT', () => {
        if (stopRequested) process.exit(1)
        stopRequested = true
        console.log('\nStopping after the current batch (progress is saved; richlist.json is only written when complete)...')
    })

    const begun = Date.now()
    const startRequests = requestCount
    let batches = 0
    for (let s = from; s <= target && !stopRequested; s += RANGE) {
        if ((Date.now() - begun) / 60000 >= MAX_MINUTES) {
            console.log(`Reached the ${MAX_MINUTES} minute limit; saving progress.`)
            stopRequested = true
            break
        }
        const e = Math.min(s + RANGE - 1, target)
        const blocks = await getBlocks(s, e)

        pendingSkipped = []
        // fetch every transaction in the batch, then apply all deltas together so a crash never leaves a half-applied batch
        const perBlockIds = await mapLimit(blocks, CONCURRENCY, b => getTxIds(b))
        const jobs = []
        blocks.forEach((b, i) => perBlockIds[i].forEach(id => jobs.push([id, b.height])))
        const deltas = await mapLimit(jobs, CONCURRENCY, ([id, h]) => getTxDelta(id, h))
        for (const d of deltas) {
            if (!d) continue
            for (const [addr, amount] of d) state.balances.set(addr, (state.balances.get(addr) || 0n) + amount)
        }
        state.skipped.push(...pendingSkipped)
        pendingSkipped = []
        state.lastHeight = e
        batches++

        const done = e - from + 1, total = target - from + 1
        const elapsed = (Date.now() - begun) / 1000
        const rate = done / elapsed
        if (batches % 5 === 0 || e === target) {
            console.log(`  block ${e.toLocaleString()}  ${(done / total * 100).toFixed(1)}%  ${(requestCount - startRequests) / elapsed | 0} req/s  ETA ${fmtDur((total - done) / rate)}`)
        }
        if (batches % SAVE_EVERY === 0) saveState(state)
        if (DELAY) await sleep(DELAY)
    }

    saveState(state)
    if (state.lastHeight < target) {
        // Stopped early (Ctrl+C or time limit): balances are incomplete, so do NOT write a richlist file.
        console.log(`\nStopped at block ${state.lastHeight.toLocaleString()} of ${target.toLocaleString()}. Progress saved - run the same command again to continue.`)
        console.log('(richlist.json is only written once the whole chain has been processed.)')
        return
    }
    const out = writeOutput(state, tip)
    console.log(`\nDone. Height ${state.lastHeight.toLocaleString()}, ${out.holders.toLocaleString()} addresses with a balance.`)
    console.log(`Wrote ${path.relative(process.cwd(), OUT)}`)
    if (state.skipped.length) {
        const skippedFile = OUT.replace(/\.json$/, '') + '-skipped.json'
        writeAtomic(skippedFile, JSON.stringify(state.skipped, null, 2))
        console.log(`\n! ${state.skipped.length} transaction(s) could not be read from the API and were left out, so a few balances may be slightly off.`)
        console.log(`  List saved to ${path.relative(process.cwd(), skippedFile)}. After the API is fixed: node tools/build-richlist.js --retry-skipped`)
    }

    // ----- optional verification against the live API -----
    if (opt.verify) {
        const n = opt.verify === true ? 5 : parseInt(opt.verify, 10)
        console.log(`\nVerifying top ${n} balances against ${API}/balance/<address> ...`)
        let bad = 0
        for (const { a, b } of out.addresses.slice(0, n)) {
            const data = await get(`/balance/${a}`)
            const live = data.result ? BigInt(Math.round(data.result.balance)) : null
            const ok = live === BigInt(b)
            if (!ok) bad++
            console.log(`  ${ok ? 'OK ' : 'DIFF'} ${a}  snapshot=${b}  live=${live}`)
        }
        console.log(bad ? `${bad} difference(s): small gaps are expected if new blocks arrived since the snapshot.` : 'All verified.')
    }
}

main().catch(e => {
    if (liveState) {
        try { saveState(liveState); console.error(`\n(progress saved at block ${liveState.lastHeight.toLocaleString()})`) } catch (err) {}
    }
    console.error('\nError: ' + e.message)
    process.exit(1)
})
