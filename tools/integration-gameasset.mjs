// ---------------------------------------------------------------------------
// End-to-end integration test: real chain tx + real game registry.
//
// 1. Fetches the live mint tx b92f2290… from the public MWC explorer API
// 2. Decodes its OP_RETURN envelope with the explorer's own decoder
// 3. Resolves the COMMITMENT-mode body from the live game registry
//    (http://51.15.16.47:8081 — public, CORS *)
// 4. Renders banner + vout HTML and asserts the NFT metadata appears
//
// Network-dependent: skips (exit 0, marked SKIP) if either host is down.
//
//   node tools/integration-gameasset.mjs
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const self = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(self, '..', 'js', 'gameasset.js'), 'utf8')
const mod = { exports: {} }
// Give the module a working GAME_API_BASE + fetch/AbortSignal (browser globals)
const GAME_API_BASE = process.env.GAME_API_BASE || 'http://51.15.16.47:8081'
globalThis.GAME_API_BASE = GAME_API_BASE
new Function('module', 'exports', 'window', 'fetch', 'AbortSignal', src)(
    mod, mod.exports, undefined, globalThis.fetch.bind(globalThis), globalThis.AbortSignal)
const GA = mod.exports

const TXID = 'b92f2290d769feb3163217aa53f6e9c7caec93d0781494ce5839f90e85c1d396'
const API = 'https://api.minersworld.org'

let pass = 0, fail = 0, skipped = false
function ok(name, cond, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`) }
    else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`) }
}

console.log('gameasset.js end-to-end integration (live chain + live registry)\n')

const tx = await fetch(`${API}/transaction/${TXID}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()).then(j => j.result).catch(() => null)
if (!tx) {
    console.log('SKIP: explorer API unreachable')
    process.exit(0)
}
const reg = await GA.fetchRegistryData(TXID).catch(() => null)
if (!reg) {
    console.log('NOTE: game registry unreachable — testing chain-side only')
}

// --- chain side ---
const gameAssets = GA.collectGameAssets(tx)
ok('live tx yields exactly one game-asset event', gameAssets.length === 1, `got ${gameAssets.length}`)
const ga = gameAssets[0]
ok('event is MINT in COMMITMENT mode', ga.type === 'MINT' && ga.mode === 0)
ok('on-chain body hash present (64 hex)', /^[0-9a-f]{64}$/.test(ga.bodyHash))

// --- registry side ---
if (reg) {
    GA.applyRegistryData(ga, reg)
    ok('registry returns the asset record', ga.registry && ga.registry.assetId === 'fbbbb11bc7070f0fe81152a24ab801245ebe17a6763be9043230a245a8ad5eb8')
    ok('registry name is the Bug Hunter badge', ga.registry.name === 'Bug Hunter')
    ok('registry reports soul-bound', ga.registry.nonTransferable === true)
    if (reg.payload && reg.payload.bodyHex) {
        ok('commitment re-verified from bodyHex', ga.registryVerified === true)
        ok('canonical body adopted', !!ga.body)
    } else {
        console.log('  ℹ️  live server predates bodyHex serving — commitment badge appears after game redeploy')
        ok('bodyJson truncated on old server → body not adopted (no false data)', !ga.body || ga.body.meta !== undefined)
    }
}

// --- render ---
const banner = GA.gameAssetBannerHtml(gameAssets)
ok('banner renders', banner.includes('ga-banner'))
ok('banner names the asset', banner.includes(reg && ga.registry ? ga.registry.name : 'Game asset'))
const vout = GA.gameAssetVoutHtml(ga, { index: ga.voutIndex, txid: TXID })
ok('vout row renders', vout.includes('ga-vout'))
ok('vout row carries protocol details', vout.includes(ga.bodyHash.slice(0, 16)))
ok('vout row links the game registry when resolved', !reg || vout.includes('Game registry'))

console.log(`\nRESULT: ${fail === 0 ? 'PASS' : 'FAIL'} — pass ${pass} / fail ${fail}`)
process.exit(fail === 0 ? 0 : 1)
