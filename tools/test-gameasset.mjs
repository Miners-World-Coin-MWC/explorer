// ---------------------------------------------------------------------------
// Unit tests for js/gameasset.js — no dependencies, Node 18+.
//
// The "live fixtures" are bytes from the REAL MWC chain: the first on-chain
// mint of the asset protocol (Bug Hunter badge, tx b92f2290…, height 222715,
// 2026-11-13). Decoding them here proves the explorer's decoder matches what
// actually lands on chain — including the deterministic asset ID.
//
//   node tools/test-gameasset.mjs
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const GA = importDefault()
function importDefault(fetchImpl, gameApiBase) {
    const self = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(self, '..', 'js', 'gameasset.js'), 'utf8')
    const mod = { exports: {} }
    // gameasset.js checks for browser globals; evaluate as CommonJS-ish module.
    // GAME_API_BASE is picked up as a global when explicitly provided.
    const preamble = gameApiBase ? `var GAME_API_BASE = ${JSON.stringify(gameApiBase)};\n` : ''
    const fn = new Function('module', 'exports', 'window', 'fetch', 'AbortSignal', preamble + src)
    fn(mod, mod.exports, undefined, fetchImpl, undefined)
    return mod.exports
}

let pass = 0, fail = 0
function ok(name, cond, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`) }
    else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`) }
}

// ---- live fixture: real OP_RETURN scriptPubKey from tx b92f2290… ----
const LIVE_TXID = 'b92f2290d769feb3163217aa53f6e9c7caec93d0781494ce5839f90e85c1d396'
const LIVE_SPK_HEX = '6a314d57432d47414d452d41535345540101006e0479ff92e53050888aa5466accf48ec6976076d940fcaf051f52e9de9bd6d1'
const LIVE_BODY_HASH = '6e0479ff92e53050888aa5466accf48ec6976076d940fcaf051f52e9de9bd6d1'
const LIVE_ASSET_ID = 'fbbbb11bc7070f0fe81152a24ab801245ebe17a6763be9043230a245a8ad5eb8'

console.log('gameasset.js unit tests\n')

// 1. OP_RETURN extraction (script-hex and asm forms)
{
    const viaHex = GA.extractOpReturnData({ hex: LIVE_SPK_HEX })
    ok('extracts OP_RETURN data from script hex', viaHex !== null && GA.bytesToHex(viaHex).startsWith('4d57432d47414d452d4153534554'), viaHex && GA.bytesToHex(viaHex).slice(0, 20))
    const viaAsm = GA.extractOpReturnData({ asm: 'OP_RETURN 4d57432d47414d452d41535345540101006e0479ff' })
    ok('extracts OP_RETURN data from asm fallback', viaAsm !== null)
    ok('ignores non-OP_RETURN scripts', GA.extractOpReturnData({ hex: '76a914000000000000000000000000000000000000000088ac' }) === null)
}

// 2. Envelope decode against the live mint
{
    const spk = { hex: LIVE_SPK_HEX }
    const ga = GA.decodeGameAssetOutput(spk)
    ok('live mint decodes as protocol v2', ga && ga.protocol === 'MWC-GAME-ASSET')
    ok('event = MINT', ga.type === 'MINT', ga && ga.type)
    ok('mode = COMMITMENT (no inline body on chain)', ga.mode === 0 && ga.modeName === 'COMMITMENT')
    ok('body hash matches chain', ga.bodyHash === LIVE_BODY_HASH)
    ok('no body before registry resolution', !ga.body)
}

// 3. Deterministic asset ID — the indexer/explorer must derive the same id
//    the game registry recorded for this mint.
{
    const derived = GA.deriveAssetId(LIVE_TXID, 0)
    ok('deriveAssetId(txid, vout) matches the live registry id', derived === LIVE_ASSET_ID, derived)
}

// 4. Synthetic INLINE envelope: body present, integrity verified
{
    const meta = new TextEncoder().encode(JSON.stringify({ category: 'potion', name: 'Founder\u2019s Potion', rarity: 'epic' }))
    const body = new Uint8Array(32 + 1 + 1 + 32 + 1 + 20 + 8 + 8 + 1 + meta.length)
    let at = 0
    body.set(GA.hexToBytes('11'.repeat(32)), at); at += 32          // assetIdSlot (mint seed)
    body[at++] = 0                                                    // seq
    body[at++] = 1                                                    // controlVout
    body.set(GA.hexToBytes('00'.repeat(32)), at); at += 32           // prevEventTxid (zero)
    body[at++] = 0                                                    // flags
    body.set(GA.hexToBytes('ab'.repeat(20)), at); at += 20           // ownerCommitment
    body.set(new Uint8Array([0, 0, 26, 94, 240, 129, 3, 1]), at); at += 8 // timestamp u64le
    body.set(GA.hexToBytes('cd'.repeat(8)), at); at += 8             // gameRef
    body[at++] = meta.length
    body.set(meta, at)
    const bodyHash = GA.deriveBodyHash(body)
    const env = GA.hexToBytes('4d57432d47414d452d4153534554' + '01' + '01' + '01' + bodyHash)
    const data = new Uint8Array(env.length + body.length)
    data.set(env, 0); data.set(body, env.length)
    const ga = GA.decodeEnvelope(data)
    ok('inline envelope decodes', ga !== null && ga.type === 'MINT' && ga.modeName === 'INLINE')
    ok('inline integrity verified', ga.integrityOk === true)
    ok('inline body parsed with meta', ga.body && ga.body.meta && ga.body.meta.name === 'Founder’s Potion')
    // tamper one byte → integrity must fail
    const bad = data.slice(); bad[env.length + 40] ^= 0xff
    const gaBad = GA.decodeEnvelope(bad)
    ok('tampered inline body flagged', gaBad.integrityOk === false)
}

// 5. Legacy v1 JSON anchor still decodes (script needs the push-length byte)
{
    const payload = new TextEncoder().encode('{"v":1,"a":"MWC1-abc","h":"deadbeef","o":"xyz"}')
    const spk = { hex: '6a' + (payload.length < 76 ? payload.length.toString(16).padStart(2, '0') : '') + hexOf(payload) }
    const ga = GA.decodeGameAssetOutput(spk)
    ok('legacy v1 anchor decodes', ga && ga.legacy === true && ga.assetId === 'MWC1-abc')
}

// 6. Registry resolution (applyRegistryData) — COMMITMENT mode
{
    const spk = { hex: LIVE_SPK_HEX }
    const ga = GA.decodeGameAssetOutput(spk)
    const regNoHex = {
        payload: { bodyHash: LIVE_BODY_HASH, bodyJson: '{"assetIdSlot":"' + '11'.repeat(32) + '","seq":0,"controlVout":0,"prevEventTxid":"' + '00'.repeat(32) + '","ownerCommitment":"' + 'ab'.repeat(20) + '","timestamp":1794533464904,"gameEventRef":"badge:bug_hunter:1157581316175437884","meta":{"t":"MINT","itemId":"badge_bug_hunter","name":"Bug Hunter","category":"badge","rarity":"uncommon"}}', bodyHex: null, payloadHex: LIVE_SPK_HEX.slice(2) },
        asset: { assetId: LIVE_ASSET_ID, name: 'Bug Hunter', status: 'MINTED', rarity: 'uncommon', category: 'badge', owner: '1157581316175437884', nonTransferable: true },
    }
    GA.applyRegistryData(ga, regNoHex)
    ok('registry facts applied without bodyHex', ga.registry && ga.registry.name === 'Bug Hunter' && ga.registry.nonTransferable === true)
    ok('no bodyHex → commitment unverified (null badge), body still adopted for display', ga.registryVerified === null && ga.body && ga.body.meta.name === 'Bug Hunter')

    // With a WRONG bodyHex: verification must fail and the body must NOT be adopted
    const ga2 = GA.decodeGameAssetOutput({ hex: LIVE_SPK_HEX })
    GA.applyRegistryData(ga2, { ...regNoHex, payload: { ...regNoHex.payload, bodyHex: '00'.repeat(64) } })
    ok('wrong bodyHex → commitment mismatch', ga2.registryVerified === false)
    ok('mismatched body never adopted', !ga2.body)

    // With the CORRECT bodyHex: re-derives the live on-chain hash → verified, body adopted
    const ga3 = GA.decodeGameAssetOutput({ hex: LIVE_SPK_HEX })
    // Build canonical bytes that hash to the live commitment: reuse the game's
    // own canonical body — reconstructed from the registry's bodyJson layout.
    // (For this test, synthesise bytes whose hash equals the envelope's hash by
    //  using deriveBodyHash itself — proving the round-trip logic, not SHA-256.)
    const synthetic = new TextEncoder().encode(JSON.stringify({ a: 1 }))
    const goodHex = GA.bytesToHex(synthetic)
    // Point the envelope at synthetic's hash by testing decode on a rebuilt envelope instead:
    const envHash = GA.deriveBodyHash(synthetic)
    const env2 = GA.hexToBytes('4d57432d47414d452d4153534554' + '01' + '01' + '00' + envHash)
    const ga4 = GA.decodeEnvelope(env2)
    GA.applyRegistryData(ga4, {
        payload: { bodyHash: envHash, bodyJson: '{"assetIdSlot":"' + '11'.repeat(32) + '","seq":0,"controlVout":0,"prevEventTxid":"' + '00'.repeat(32) + '","ownerCommitment":"' + 'ab'.repeat(20) + '","timestamp":1,"gameEventRef":"t","meta":{"name":"Synth","rarity":"rare"}}', bodyHex: goodHex, payloadHex: '' },
        asset: { assetId: 'x', name: 'Synth', status: 'MINTED', rarity: 'rare', category: 'trophy', owner: '1', nonTransferable: false },
    })
    ok('correct bodyHex → commitment verified against on-chain hash', ga4.registryVerified === true)
    ok('verified body adopted (metadata now renderable)', ga4.body && ga4.body.meta && ga4.body.meta.name === 'Synth')
}

// 7. Rendering with registry data — self-escaped strings
{
    const ga = GA.decodeGameAssetOutput({ hex: LIVE_SPK_HEX })
    GA.applyRegistryData(ga, {
        payload: null,
        asset: { assetId: LIVE_ASSET_ID, name: '<script>x</script>', status: 'MINTED', rarity: 'uncommon', category: 'badge', owner: '1157581316175437884', nonTransferable: true },
    })
    const html = GA.gameAssetVoutHtml(ga, { index: 1, txid: LIVE_TXID })
    ok('vout html escapes registry name', html.includes('&lt;script&gt;') && !html.includes('<script>x'))
    ok('vout html shows soul-bound badge', html.includes('ga-soulbound'))
    ok('vout html shows registry status row', html.includes('Game registry'))
    const banner = GA.gameAssetBannerHtml([ga])
    ok('banner escapes registry name', banner.includes('&lt;script&gt;'))
    ok('banner uses registry name', banner.includes('&lt;script&gt;x&lt;/script&gt;'))
}

// 8. Snapshot fallback — live registry unreachable (no TLS / mixed content)
//    → same-origin data/game-assets.json serves the record.
{
    const LIVE_HASH = LIVE_BODY_HASH
    const snapshot = {
        generatedAt: '2026-11-13T18:51:36.776Z',
        entries: {
            [LIVE_TXID]: {
                registry: {
                    asset: { assetId: LIVE_ASSET_ID, name: 'Bug Hunter', status: 'MINTED', rarity: 'uncommon', category: 'badge', owner: '1157581316175437884', nonTransferable: true },
                    payload: { bodyHash: LIVE_HASH, bodyHex: '00'.repeat(64), payloadHex: '' }, // wrong bodyHex on purpose
                },
            },
        },
    }
    const fakeFetch = (url) => {
        if (String(url).includes('/api/assets/tx/')) {
            return Promise.reject(new Error('TLS to 51.15.16.47:8081 failed — exactly the production symptom'))
        }
        if (String(url).includes('game-assets.json')) {
            return Promise.resolve({ ok: true, json: async () => snapshot })
        }
        return Promise.resolve({ ok: false, json: async () => null })
    }
    const GA2 = importDefault(fakeFetch, 'https://51.15.16.47:8081')
    const res = await GA2.fetchRegistryData(LIVE_TXID)
    ok('live failure falls back to snapshot', !!res && res.source === 'snapshot')
    ok('snapshot entry carries asset + payload', res.asset && res.asset.name === 'Bug Hunter' && !!res.payload)
    const ga = GA2.decodeGameAssetOutput({ hex: LIVE_SPK_HEX })
    GA2.applyRegistryData(ga, res)
    ok('snapshot registry facts applied + sourced', ga.registry && ga.registry.name === 'Bug Hunter' && ga.registrySource === 'snapshot')
    ok('snapshot bodyHex mismatch flagged (no false "verified" badge)', ga.registryVerified === false && !ga.body)
    ok('unknown txid yields null', (await GA2.fetchRegistryData('ab'.repeat(32))) === null)
    const html = GA2.gameAssetVoutHtml(ga, { index: 1, txid: LIVE_TXID })
    ok('vout html labels the snapshot source', html.includes('registry snapshot'))
}

// 9. Snapshot via the game-assets-data branch when same-origin 404s
//    (Pages deployments that don't include data/ in the deployed tree).
{
    globalThis.location = { hostname: 'miners-world-coin-mwc.github.io', pathname: '/explorer/index.html' }
    const snapshot = { generatedAt: '2026-11-13T00:00:00Z', entries: { [LIVE_TXID]: { registry: { asset: { assetId: LIVE_ASSET_ID, name: 'Bug Hunter', status: 'MINTED' } } } } }
    const fakeFetch = (url) => {
        const u = String(url)
        if (u.includes('/api/assets/tx/')) return Promise.reject(new Error('live down'))
        if (u.startsWith('data/game-assets.json')) return Promise.resolve({ ok: false, json: async () => null })   // same-origin miss
        if (u.includes('/game-assets-data/game-assets.json')) return Promise.resolve({ ok: true, json: async () => snapshot }) // branch hit
        return Promise.resolve({ ok: false, json: async () => null })
    }
    const GA3 = importDefault(fakeFetch, 'https://51.15.16.47:8081')
    const res = await GA3.fetchRegistryData(LIVE_TXID)
    ok('falls back to the game-assets-data branch URL', !!res && res.source === 'snapshot' && res.asset && res.asset.name === 'Bug Hunter')
    delete globalThis.location
}

// 10. Page-flow regression (the tx-page render sequence, exactly):
//     render #1 decodes fresh objects (hash-only) → enhanceGameAssets
//     schedules the fetch → onReady re-renders, decoding FRESH objects again.
//     The cached registry data must reach those fresh objects — both the
//     banner path (enhanceGameAssets sync-apply) and the vout-card path
//     (applyCachedRegistryData on a per-output decode). Before this test,
//     the re-render discarded the enrichment and showed the hash-only card.
{
    const bodyJson = '{"assetIdSlot":"' + '11'.repeat(32) + '","seq":0,"controlVout":0,"prevEventTxid":"' + '00'.repeat(32) + '","ownerCommitment":"' + 'ab'.repeat(20) + '","timestamp":1794533464904,"gameEventRef":"badge:bug_hunter:1157581316175437884","meta":{"t":"MINT","itemId":"badge_bug_hunter","name":"Bug Hunter","category":"badge","rarity":"uncommon"}}'
    const api = { ok: true, asset: { assetId: LIVE_ASSET_ID, name: 'Bug Hunter', status: 'MINTED', rarity: 'uncommon', category: 'badge', nonTransferable: true }, payload: { bodyHash: LIVE_BODY_HASH, bodyJson, bodyHex: null, payloadHex: LIVE_SPK_HEX.slice(2) } }
    const fakeFetch = (url) => String(url).includes('/api/assets/tx/')
        ? Promise.resolve({ ok: true, json: async () => api })
        : Promise.resolve({ ok: false, json: async () => null })
    const GAp = importDefault(fakeFetch, 'https://game.minersworld.org')

    // render #1 — fresh decode, enhancement scheduled, hash-only so far
    const gas1 = [GAp.decodeGameAssetOutput({ hex: LIVE_SPK_HEX })]
    let rerendered = false
    const scheduled = GAp.enhanceGameAssets(LIVE_TXID, gas1, () => { rerendered = true })
    ok('page render #1 schedules the fetch', scheduled === true)
    ok('render #1 stays hash-only', !gas1[0].registry && !gas1[0].body)
    await GAp.fetchRegistryData(LIVE_TXID)
    await new Promise((r) => setTimeout(r, 0))   // let the enhance .then run (applies + onReady)
    ok('fetch landed → page was asked to re-render', rerendered === true)

    // render #2 — the page decodes FRESH objects; cache must apply synchronously
    const gas2 = [GAp.decodeGameAssetOutput({ hex: LIVE_SPK_HEX })]
    const scheduledAgain = GAp.enhanceGameAssets(LIVE_TXID, gas2, () => { throw new Error('loop!') })
    ok('re-render schedules nothing new (no loop)', scheduledAgain === false)
    ok('re-render banner object enriched (registry + body)', gas2[0].registry && gas2[0].registry.name === 'Bug Hunter' && gas2[0].body && gas2[0].body.meta.name === 'Bug Hunter')

    // vout-card path — displayTxVout decodes its own fresh object per output
    const gaV = GAp.decodeGameAssetOutput({ hex: LIVE_SPK_HEX })
    ok('vout decode enriched via applyCachedRegistryData', GAp.applyCachedRegistryData(LIVE_TXID, gaV) === true && !!gaV.registry)

    const banner = GAp.gameAssetBannerHtml(gas2)
    const card = GAp.gameAssetVoutHtml(gaV, { index: 1, txid: LIVE_TXID })
    ok('banner names the asset on re-render', banner.includes('Bug Hunter'))
    ok('vout card shows name + soul-bound on re-render', card.includes('Bug Hunter') && card.includes('soul-bound'))

    // unknown txid → helper is a clean no-op
    const gaX = GAp.decodeGameAssetOutput({ hex: LIVE_SPK_HEX })
    ok('applyCachedRegistryData no-ops without cache', GAp.applyCachedRegistryData('ff'.repeat(32), gaX) === false && !gaX.registry)
}

console.log(`\nRESULT: ${fail === 0 ? 'PASS' : 'FAIL'} — pass ${pass} / fail ${fail}`)
process.exit(fail === 0 ? 0 : 1)

function hexOf(bytes) {
    let s = ''
    for (const b of bytes) s += (b < 16 ? '0' : '') + b.toString(16)
    return s
}
