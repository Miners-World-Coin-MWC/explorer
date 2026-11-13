// ---------------------------------------------------------------------------
// MWC GAME ASSET PROTOCOL — on-chain NFT decoding for the explorer.
//
// The game "Miners World: Onchain Adventures" anchors every item asset to the
// chain with an OP_RETURN payload. Two generations exist:
//
//   v1 (legacy anchors): compact JSON  {"v":1,"a":"MWC1-…","h":"hash8","o":"…"}
//   v2 (asset protocol): binary envelope
//        0..13  magic     "MWC-GAME-ASSET" (ASCII)
//        14     version   uint8 (1)
//        15     event     uint8 (1=MINT 2=TRANSFER 3=TRADE 4=MARKETPLACE
//                                  5=REWARD 6=CRAFT 7=BURN)
//        16     mode      uint8 (0=COMMITMENT, 1=INLINE body follows)
//        17..48 bodyHash  SHA-256(domain-sep ‖ canonical body)
//        [49..] canonical body, only in INLINE mode
//
//   canonical body: assetIdSlot(32) seq(varint) controlVout(varint)
//        prevEventTxid(32) flags(u8) [prevControlTxid(32)+vout(varint)]
//        ownerCommitment(20) timestamp(u64le) gameRef(8) meta(varint+JSON)
//
// Source of truth: server/src/assets/{protocol,codec}.ts in the game repo.
// This file has NO dependencies and also runs under Node (unit tests).
// ---------------------------------------------------------------------------

var GA = (function () {
    'use strict'

    // ---- protocol constants (mirror of protocol.ts) ------------------------
    var MAGIC = 'MWC-GAME-ASSET'
    var MAGIC_HEX = '4d57432d47414d452d4153534554'   // "MWC-GAME-ASSET" ASCII
    var PROTO_VERSION = 1
    var ENVELOPE_SIZE = 49
    var EVENT_NAMES = { 1: 'MINT', 2: 'TRANSFER', 3: 'TRADE', 4: 'MARKETPLACE', 5: 'REWARD', 6: 'CRAFT', 7: 'BURN' }
    var NO_SUCCESSOR = 0xffff_ffff + 1                // BURN sentinel (2^32)
    var NETWORK_MAGIC_HEX = 'ad5aeb9f'                // MWC message-start bytes
    var DOM_ASSET_ID = 'MWC-GAME-ASSET:ASSET-ID:v1:'
    var DOM_EVENT_BODY = 'MWC-GAME-ASSET:EVENT-BODY:v1:'
    var BURN_ADDRESS = '9BuRnXTZBMvVVRW5GtP1KxkYd22QKmtNuW'

    // ---- byte helpers -------------------------------------------------------
    var HEX_RE = /^[0-9a-fA-F]*$/

    function hexToBytes(hex) {
        if (!hex || hex.length % 2 !== 0 || !HEX_RE.test(hex)) return null
        var out = new Uint8Array(hex.length / 2)
        for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
        return out
    }

    function bytesToHex(b) {
        var s = ''
        for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16)
        return s
    }

    function utf8(b) {
        try { return new TextDecoder('utf-8', { fatal: false }).decode(b) } catch (e) { /* very old browsers */ }
        var s = ''
        for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
        return decodeURIComponent(escape(s))
    }

    function concatBytes(chunks) {
        var n = 0
        for (var i = 0; i < chunks.length; i++) n += chunks[i].length
        var out = new Uint8Array(n), at = 0
        for (var j = 0; j < chunks.length; j++) { out.set(chunks[j], at); at += chunks[j].length }
        return out
    }

    function u32le(n) {
        return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])
    }

    function varintBytes(n) {
        var bytes = [], v = n
        do {
            var b = v & 0x7f
            v = Math.floor(v / 128)
            if (v > 0) b |= 0x80
            bytes.push(b)
        } while (v > 0)
        return new Uint8Array(bytes)
    }

    // ---- SHA-256 (compact, dependency-free; vector-tested against node:crypto)
    var K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]

    function sha256Bytes(msg) {
        var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
        var len = msg.length
        var bitLenHi = Math.floor(len / 0x20000000), bitLenLo = (len << 3) >>> 0
        // minimal padding: 0x80 + zeros + 8-byte bit length, total = multiple of 64
        var padded = new Uint8Array(((len + 9 + 63) >> 6) << 6)
        padded.set(msg)
        padded[len] = 0x80
        var dv = new DataView(padded.buffer)
        dv.setUint32(padded.length - 8, bitLenHi)
        dv.setUint32(padded.length - 4, bitLenLo)

        var w = new Array(64)
        for (var off = 0; off < padded.length; off += 64) {
            for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4)
            for (var t = 16; t < 64; t++) {
                var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
                var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
                w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0
            }
            var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]
            for (var t2 = 0; t2 < 64; t2++) {
                var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
                var ch = (e & f) ^ (~e & g)
                var temp1 = (h + S1 + ch + K[t2] + w[t2]) >>> 0
                var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
                var maj = (a & b) ^ (a & c) ^ (b & c)
                var temp2 = (S0 + maj) >>> 0
                h = g; g = f; f = e
                e = (d + temp1) >>> 0
                d = c; c = b; b = a
                a = (temp1 + temp2) >>> 0
            }
            H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
            H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
        }

        var out = new Uint8Array(32)
        var odv = new DataView(out.buffer)
        for (var i2 = 0; i2 < 8; i2++) odv.setUint32(i2 * 4, H[i2])
        return out
    }

    function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0 }

    // Domain-separated protocol hash:
    //   SHA-256( domain ‖ networkMagic ‖ concat( u32le(len) ‖ part ) )
    function protoHash(domain, parts) {
        var chunks = [encBytes(domain), hexToBytes(NETWORK_MAGIC_HEX)]
        for (var i = 0; i < parts.length; i++) {
            chunks.push(u32le(parts[i].length))
            chunks.push(parts[i])
        }
        return sha256Bytes(concatBytes(chunks))
    }

    function asciiBytes(s) {
        var out = new Uint8Array(s.length)
        for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
        return out
    }

    var textEncoder = null
    function encBytes(s) {
        if (typeof TextEncoder !== 'undefined') { if (!textEncoder) textEncoder = new TextEncoder(); return textEncoder.encode(s) }
        return asciiBytes(s) // protocol domains/JSON are ASCII in practice
    }

    function deriveBodyHash(bodyBytes) { return bytesToHex(protoHash(DOM_EVENT_BODY, [bodyBytes])) }
    function deriveAssetId(mintTxidHex, controlVout) {
        return bytesToHex(protoHash(DOM_ASSET_ID, [hexToBytes(mintTxidHex), varintBytes(controlVout)]))
    }

    // ---- OP_RETURN data extraction from an Insight-style scriptPubKey ------
    // Prefers the full script hex (6a + push opcodes); falls back to asm
    // ("OP_RETURN <hex>"). Multi-push data is concatenated.
    function extractOpReturnData(spk) {
        if (!spk) return null
        if (spk.hex && HEX_RE.test(spk.hex) && spk.hex.length >= 2) {
            var b = hexToBytes(spk.hex)
            if (!b || b[0] !== 0x6a) return null
            var i = 1, chunks = []
            while (i < b.length) {
                var op = b[i++], len = -1
                if (op >= 0x01 && op <= 0x4b) len = op
                else if (op === 0x4c) { if (i + 1 > b.length) break; len = b[i++] }
                else if (op === 0x4d) { if (i + 2 > b.length) break; len = b[i] | (b[i + 1] << 8); i += 2 }
                else if (op === 0x4e) { if (i + 4 > b.length) break; len = ((b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0); i += 4 }
                else break // any other opcode terminates the data section
                if (len < 0 || i + len > b.length) break
                if (len > 0) chunks.push(b.subarray(i, i + len))
                i += len
            }
            return chunks.length ? concatBytes(chunks) : null
        }
        if (spk.asm) {
            var m = /^\s*OP_RETURN\s+(.+)$/.exec(spk.asm)
            if (m) {
                var hx = m[1].replace(/[^0-9a-fA-F]/g, '')
                if (hx.length >= 2) { var d = hexToBytes(hx); if (d) return d }
            }
        }
        return null
    }

    // ---- canonical body reader (mirror of codec.ts decodeBody) -------------
    function Reader(buf) { this.buf = buf; this.off = 0 }
    Reader.prototype.take = function (n) {
        if (this.off + n > this.buf.length) throw new Error('unexpected end')
        var b = this.buf.subarray(this.off, this.off + n)
        this.off += n
        return b
    }
    Reader.prototype.u8 = function () { return this.take(1)[0] }
    Reader.prototype.u64le = function () {
        var b = this.take(8), v = 0
        for (var i = 7; i >= 0; i--) v = v * 256 + b[i]  // little-endian, safe to 2^53
        return v
    }
    Reader.prototype.varint = function () {
        var result = 0, shift = 0
        for (;;) {
            var b = this.take(1)[0]
            result += (b & 0x7f) * Math.pow(2, shift)
            if ((b & 0x80) === 0) return result
            shift += 7
            if (shift > 56) throw new Error('varint too long')
        }
    }
    Reader.prototype.bytes32hex = function () { return bytesToHex(this.take(32)) }

    function parseBody(buf, eventType) {
        var r = new Reader(buf)
        var out = {}
        out.assetIdSlot = r.bytes32hex()
        out.seq = r.varint()
        out.controlVout = r.varint()
        out.prevEventTxid = r.bytes32hex()
        var flags = r.u8()
        if (flags & 0x01) out.prevControl = { txid: r.bytes32hex(), vout: r.varint() }
        out.burnToBurnAddress = Boolean(flags & 0x02)
        out.ownerCommitment = bytesToHex(r.take(20))
        out.timestamp = r.u64le()
        out.gameRef = bytesToHex(r.take(8))
        var metaLen = r.varint()
        var metaBytes = r.take(metaLen)
        if (r.off !== buf.length) out.trailingBytes = buf.length - r.off
        try { out.meta = JSON.parse(utf8(metaBytes)) } catch (e) { out.meta = null; out.metaError = true }
        return out
    }

    // ---- envelope decode -----------------------------------------------------
    // Returns null when the data is not a v2 protocol payload (never throws).
    function decodeEnvelope(data) {
        if (data.length < ENVELOPE_SIZE) return null
        if (bytesToHex(data.subarray(0, 14)) !== MAGIC_HEX.toLowerCase()) return null
        var version = data[14]
        if (version !== PROTO_VERSION) return null
        var eventName = EVENT_NAMES[data[15]]
        if (!eventName) return null
        var mode = data[16]
        if (mode !== 0 && mode !== 1) return null
        var bodyHash = bytesToHex(data.subarray(17, 49))

        var out = { protocol: 'MWC-GAME-ASSET', version: version, type: eventName, mode: mode, modeName: mode === 1 ? 'INLINE' : 'COMMITMENT', bodyHash: bodyHash, body: null, integrityOk: null }

        if (mode === 1) {
            var bodyBytes = data.subarray(ENVELOPE_SIZE)
            out.integrityOk = deriveBodyHash(bodyBytes) === bodyHash
            if (out.integrityOk) {
                try { out.body = parseBody(bodyBytes, eventName) }
                catch (e) { out.bodyError = e.message }
            } else {
                out.bodyError = 'inline body hash mismatch'
            }
        }
        return out
    }

    // ---- public: decode a vout's scriptPubKey into a game-asset record -----
    function decodeGameAssetOutput(spk) {
        var data = extractOpReturnData(spk)
        if (!data) return null

        var env = decodeEnvelope(data)
        if (env) return env

        // legacy v1 JSON anchor: {"v":1,"a":"MWC1-…","h":"hash8","o":"suffix"}
        var text = utf8(data)
        if (text.charAt(0) === '{') {
            try {
                var j = JSON.parse(text)
                if (j && j.v === 1 && typeof j.a === 'string' && typeof j.h === 'string') {
                    return { protocol: 'MWC1', legacy: true, assetId: j.a, metaHashPrefix: j.h, ownerSuffix: j.o }
                }
            } catch (e) { /* not game data */ }
        }
        return null
    }

    // ---- scan a whole transaction (Insight-style result object) -----------
    function collectGameAssets(txData) {
        var found = []
        if (!txData || !txData.vout) return found
        for (var i = 0; i < txData.vout.length; i++) {
            var v = txData.vout[i]
            var spk = v && v.scriptPubKey
            if (!spk) continue
            var ga = decodeGameAssetOutput(spk)
            if (ga) { ga.voutIndex = (v.n !== undefined ? v.n : i); found.push(ga) }
        }
        return found
    }

    // =========================================================================
    // Rendering — pure string builders (no jQuery), self-escaped.
    // =========================================================================
    var CATEGORY_ICON = {
        potion: '🧪', revive: '💠', capture: '🔮', orb: '🔮', booster: '⚗️', estone: '🪨',
        food: '🫐', berry: '🫐', weapon: '⛏️', armor: '🦺', accessory: '🎐', key: '🗝️',
        quest: '📜', collectible: '✨', cosmetic: '🎩', badge: '🎖️', trophy: '🏆',
        creature: '🐉', material: '🧱', equipment: '🎒'
    }
    var RARITY_CLASS = {
        common: 'ga-r-common', uncommon: 'ga-r-uncommon', rare: 'ga-r-rare',
        epic: 'ga-r-epic', legendary: 'ga-r-legendary', mythic: 'ga-r-mythic'
    }
    var EVENT_CLASS = {
        MINT: 'ga-e-mint', TRANSFER: 'ga-e-transfer', TRADE: 'ga-e-trade',
        MARKETPLACE: 'ga-e-market', REWARD: 'ga-e-reward', CRAFT: 'ga-e-craft', BURN: 'ga-e-burn'
    }

    function gaEsc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    }

    function iconFor(ga) {
        var meta = ga.body && ga.body.meta
        var cat = meta && (meta.category || '').toLowerCase()
        if (cat && CATEGORY_ICON[cat]) return CATEGORY_ICON[cat]
        if (ga.legacy) return '🔗'
        return '🎮'
    }

    function gaKv(key, valueHtml, cls) {
        return '<div class="ga-kv"><span class="ga-k">' + gaEsc(key) + '</span><span class="ga-v ' + (cls || '') + '">' + valueHtml + '</span></div>'
    }

    /** Link to the game server's public asset page (registry asset id). */
    function registryAssetHref(ga) {
        var id = ga.registry && ga.registry.assetId
        var base = (typeof GAME_API_BASE === 'string' ? GAME_API_BASE : '').replace(/\/+$/, '')
        if (!id || !base) return '#'
        return base + '/api/assets/' + encodeURIComponent(id) + '/history'
    }

    function shortHex(h) {
        h = String(h == null ? '' : h)
        return h.length > 18 ? h.slice(0, 10) + '…' + h.slice(-8) : h
    }

    // Full row for the transaction's Outputs list
    function gameAssetVoutHtml(ga, opts) {
        opts = opts || {}
        var idx = opts.index !== undefined ? opts.index : (ga.voutIndex !== undefined ? ga.voutIndex : '')
        var meta = (ga.body && ga.body.meta) || {}
        var name = meta.name || (ga.registry && ga.registry.name) || (ga.legacy ? 'Legacy NFT anchor' : 'Game asset')
        var icon = iconFor(ga)
        var rarity = (meta.rarity || (ga.registry && ga.registry.rarity) || '').toString().toLowerCase()
        var type = ga.type || 'ANCHOR'
        var head = ''

        head += '<span class="ga-icon">' + icon + '</span>'
        head += '<span class="ga-name">' + gaEsc(name) + '</span>'
        head += '<span class="ga-type ' + (EVENT_CLASS[type] || '') + '">' + gaEsc(type === 'ANCHOR' ? 'v1 ANCHOR' : type) + '</span>'
        if (rarity) head += '<span class="ga-rarity ' + (RARITY_CLASS[rarity] || '') + '">' + gaEsc(rarity) + '</span>'
        if (ga.registry && ga.registry.nonTransferable) head += '<span class="ga-soulbound" title="Soul-bound: can never be transferred, traded or listed">soul-bound</span>'
        if (ga.integrityOk === true) head += '<span class="ga-check" title="SHA-256 body hash verified">✔ hash verified</span>'
        else if (ga.integrityOk === false) head += '<span class="ga-check ga-check-bad" title="Body hash mismatch">⚠ hash mismatch</span>'
        if (ga.registryVerified === true) head += '<span class="ga-check" title="Registry body re-hashes to the on-chain commitment in this transaction">✔ commitment verified</span>'
        else if (ga.registryVerified === false) head += '<span class="ga-check ga-check-bad" title="Registry body does NOT match the on-chain commitment">⚠ commitment mismatch</span>'

        var body = ''

        if (ga.legacy) {
            body += '<div class="ga-desc">Legacy (v1) game-asset anchor from Miners World: Onchain Adventures. The compact payload carries the asset id and a metadata-hash prefix; full metadata lives in the game\'s registry.</div>'
            body += '<details class="ga-details"><summary>Payload details</summary>'
            body += gaKv('Asset ID', '<span class="mono">' + gaEsc(ga.assetId) + '</span>')
            body += gaKv('Meta-hash prefix', '<span class="mono">' + gaEsc(ga.metaHashPrefix) + '</span>')
            if (ga.ownerSuffix) body += gaKv('Owner suffix', '<span class="mono">' + gaEsc(ga.ownerSuffix) + '</span>')
            body += gaKv('Protocol', 'MWC1 (legacy JSON anchor)')
            body += '</details>'
        } else {
            if (meta.description) body += '<div class="ga-desc">' + gaEsc(meta.description) + '</div>'

            if (meta.attributes) {
                var attrs = ''
                for (var k in meta.attributes) {
                    if (!Object.prototype.hasOwnProperty.call(meta.attributes, k)) continue
                    attrs += '<span class="ga-attr"><b>' + gaEsc(k) + '</b> ' + gaEsc(meta.attributes[k]) + '</span>'
                }
                if (attrs) body += '<div class="ga-attrs">' + attrs + '</div>'
            }

            body += '<details class="ga-details"><summary>Protocol details</summary>'
            var isMint = ga.type === 'MINT'
            var assetIdHtml
            if (isMint && ga.body) {
                var derived = ''
                if (opts.txid && ga.body.controlVout !== undefined && ga.body.controlVout !== NO_SUCCESSOR) {
                    derived = deriveAssetId(opts.txid, ga.body.controlVout)
                }
                assetIdHtml = derived
                    ? '<span class="mono" title="Derived from this mint transaction (SHA-256 of txid ‖ control vout)">' + gaEsc(derived) + '</span>'
                    : '<span class="text-muted">derived from this mint tx (txid ‖ control vout ' + gaEsc(ga.body.controlVout) + ')</span>'
            } else {
                assetIdHtml = '<span class="mono">' + gaEsc(ga.body ? ga.body.assetIdSlot : '') + '</span>'
            }
            if (!ga.legacy && ga.body) {
                body += gaKv('Asset ID', assetIdHtml)
                body += gaKv('Event sequence', gaEsc(ga.body.seq))
                if (ga.body.controlVout === NO_SUCCESSOR) body += gaKv('Control output', 'none — terminal event')
                else body += gaKv('Control output', 'vout ' + gaEsc(ga.body.controlVout))
                if (ga.registryVerified === true) body += gaKv('Payload mode', gaEsc(ga.modeName) + (ga.modeName === 'COMMITMENT' ? ' — body resolved from the game registry, SHA-256 re-verified against this transaction' : ''))
                else if (ga.body && ga.modeName === 'COMMITMENT') body += gaKv('Payload mode', gaEsc(ga.modeName) + ' — body resolved from the game registry (commitment not independently verifiable)')
                else body += gaKv('Payload mode', gaEsc(ga.modeName) + (ga.modeName === 'COMMITMENT' ? ' — body lives content-addressed in the game registry' : ''))
                body += gaKv('Body hash', '<span class="mono">' + gaEsc(ga.bodyHash) + '</span>')
                body += gaKv('Owner commitment', '<span class="mono">' + gaEsc(ga.body.ownerCommitment) + '</span>')
                if (ga.body.prevEventTxid && ga.body.prevEventTxid !== '0000000000000000000000000000000000000000000000000000000000000000') {
                    body += gaKv('Previous event', '<a href="#/transaction/' + gaEsc(ga.body.prevEventTxid) + '" class="mono">' + gaEsc(shortHex(ga.body.prevEventTxid)) + '</a>')
                }
                if (ga.body.prevControl) {
                    body += gaKv('Previous control', '<a href="#/transaction/' + gaEsc(ga.body.prevControl.txid) + '" class="mono">vout ' + gaEsc(ga.body.prevControl.vout) + ' ← ' + gaEsc(shortHex(ga.body.prevControl.txid)) + '</a>')
                }
                if (ga.body.burnToBurnAddress) body += gaKv('Burn', 'terminal — paid to the MWC burn address')
                if (ga.body.timestamp) body += gaKv('Event time', new Date(ga.body.timestamp).toUTCString())
                if (meta.issuer) body += gaKv('Issuer', gaEsc(meta.issuer))
                if (meta.gameVersion) body += gaKv('Game version', gaEsc(meta.gameVersion))
                if (meta.itemId) body += gaKv('Item ID', '<span class="mono">' + gaEsc(meta.itemId) + '</span>')
                if (meta.note) body += gaKv('Note', gaEsc(meta.note))
            } else if (ga.modeName === 'COMMITMENT') {
                body += gaKv('Payload mode', 'COMMITMENT — the 32-byte hash above commits to the full event body stored in the game registry')
                body += gaKv('Body hash', '<span class="mono">' + gaEsc(ga.bodyHash) + '</span>')
            }
            if (ga.bodyError) body += gaKv('Decode', '<span class="text-danger">' + gaEsc(ga.bodyError) + '</span>')
            body += '</details>'
        }

        // Registry-sourced facts render for every protocol event, with or
        // without an inline/resolved body — clearly marked as off-chain data.
        if (!ga.legacy && ga.registry) {
            var regNote = '<span class="ga-src">' + gaEsc(ga.registry.status) + (ga.registry.nonTransferable ? ' · soul-bound' : '') + ' · <a href="' + gaEsc(registryAssetHref(ga)) + '" target="_blank" rel="noopener">asset page</a></span>'
            body += gaKv('Game registry', regNote)
        }

        return '<div class="list-group-item ga-vout" data-tx-vout-index="' + gaEsc(idx) + '">' +
            '<div class="ga-head">' + head + '</div>' + body + '</div>'
    }

    // Summary banner for the top of the transaction page
    function gameAssetBannerHtml(events) {
        if (!events.length) return ''
        var lines = ''
        for (var i = 0; i < events.length; i++) {
            var ga = events[i]
            var meta = (ga.body && ga.body.meta) || {}
            var name = meta.name || (ga.registry && ga.registry.name) || ga.assetId || 'Game asset'
            var rarity = (meta.rarity || (ga.registry && ga.registry.rarity) || '') ? ' · ' + (meta.rarity || (ga.registry && ga.registry.rarity)) : ''
            lines += '<div class="ga-banner-line">' + iconFor(ga) + ' <b>' + gaEsc(name) + '</b>' +
                gaEsc(rarity) + ' — <b>' + gaEsc(ga.type || 'v1 ANCHOR') + '</b>' +
                (ga.integrityOk === false ? ' <span class="ga-check ga-check-bad">⚠ hash mismatch</span>' : '') +
                (ga.registryVerified === true ? ' <span class="ga-check">✔ commitment verified</span>' : '') +
                (ga.registryVerified === false ? ' <span class="ga-check ga-check-bad">⚠ commitment mismatch</span>' : '') +
                '<span class="text-muted"> · output #' + gaEsc(ga.voutIndex !== undefined ? ga.voutIndex : '?') + '</span></div>'
        }
        return '<div class="card ga-banner mb-3">' +
            '<div class="card-header"><i class="fa-solid fa-gamepad"></i> On-chain game asset <span class="text-muted">(Miners World: Onchain Adventures)</span></div>' +
            '<div class="card-body">' + lines + '<div class="text-muted ga-banner-note">This transaction carries an MWC Game Asset record in its OP_RETURN output — see Outputs below for the decoded payload.</div></div></div>'
    }

    // ---- registry resolution (COMMITMENT-mode metadata) ---------------------
    // On-chain envelopes in COMMITMENT mode carry only a SHA-256 commitment;
    // the full canonical body lives content-addressed in the game registry.
    // GET {GAME_API_BASE}/api/assets/tx/{txid} returns it (public, CORS: *),
    // including bodyHex so the client can RE-DERIVE the commitment itself and
    // never take the registry's word for anything.
    var registryCache = {}   // txid -> { state: 'pending'|'done'|'error', res: object|null }

    function registryEndpoint(txid) {
        var base = (typeof GAME_API_BASE === 'string' ? GAME_API_BASE : '').replace(/\/+$/, '')
        return base ? base + '/api/assets/tx/' + encodeURIComponent(txid) : null
    }

    /** Fetch (cached, never throws, 6s timeout). Promise<object|null>. */
    function fetchRegistryData(txid) {
        var c = registryCache[txid]
        if (c) return c.promise
        var url = registryEndpoint(txid)
        var entry = { state: 'error', res: null, promise: null }
        entry.promise = !url
            ? Promise.resolve(null)
            : fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined })
                .then(function (r) { return r.ok ? r.json() : null })
                .then(function (j) {
                    if (j && j.ok) { entry.state = 'done'; entry.res = j; return j }
                    entry.state = 'error'; return null
                })
                .catch(function () { entry.state = 'error'; return null })
        registryCache[txid] = entry
        return entry.promise
    }

    /**
     * Enrich a decoded event with registry data (mutates ga):
     *  - ga.body: parsed canonical body (COMMITMENT mode gets its body back)
     *  - ga.registry: { assetId, name, status, rarity, category, owner, nonTransferable }
     *  - ga.registryVerified: bodyHex re-hashes to the ON-CHAIN envelope hash
     */
    function applyRegistryData(ga, res) {
        if (!res) return false
        var changed = false
        // 1. Independent commitment verification: hash the registry's canonical
        //    body bytes and compare with the hash decoded from the tx itself.
        //    (Only possible when the registry serves bodyHex.)
        var verified = null
        if (res.payload && res.payload.bodyHex && /^[0-9a-fA-F]+$/.test(res.payload.bodyHex)) {
            try { verified = deriveBodyHash(hexToBytes(res.payload.bodyHex)) === ga.bodyHash } catch (e) { verified = null }
        }
        ga.registryVerified = verified
        // 2. Fill in the body the chain couldn't carry (COMMITMENT mode).
        //    Adopted unless PROVEN wrong; the badge only appears when the
        //    commitment could actually be re-derived and matched.
        if (!ga.body && res.payload && res.payload.bodyJson) {
            try {
                var body = JSON.parse(res.payload.bodyJson)
                if (verified !== false) { ga.body = body; changed = true }
            } catch (e) { /* leave hash-only view */ }
        }
        // 3. Registry-side asset facts (rendered alongside, clearly sourced).
        if (res.asset) {
            ga.registry = {
                assetId: res.asset.assetId, name: res.asset.name, status: res.asset.status,
                rarity: res.asset.rarity, category: res.asset.category, owner: res.asset.owner,
                nonTransferable: !!res.asset.nonTransferable,
            }
            changed = true
        }
        return changed
    }

    /**
     * Called from the transaction page after the first render. If any event is
     * COMMITMENT-mode, fetches the registry data, enriches the events and asks
     * the caller to re-render once. Safe to call on every render: cached per
     * txid, and synchronous application when the data is already in cache.
     * Returns true when a re-render was scheduled (caller must not re-invoke).
     */
    function enhanceGameAssets(txid, gameAssets, onReady) {
        if (!gameAssets || !gameAssets.length) return false
        var needs = false
        for (var i = 0; i < gameAssets.length; i++) {
            var ga = gameAssets[i]
            if (!ga.legacy && ga.mode === 0 && (!ga.body || !ga.registry)) needs = true
        }
        if (!needs) return false
        var cached = registryCache[txid]
        if (cached && cached.state === 'done') {
            // Data already fetched on a previous render of this tx: apply
            // synchronously, no re-render loop.
            for (var j = 0; j < gameAssets.length; j++) applyRegistryData(gameAssets[j], cached.res)
            return false   // caller renders with enriched events right now
        }
        if (cached && cached.state === 'pending') return false
        fetchRegistryData(txid).then(function (res) {
            if (!res) return
            for (var k = 0; k < gameAssets.length; k++) applyRegistryData(gameAssets[k], res)
            if (typeof onReady === 'function') onReady()
        })
        return true   // a re-render is scheduled; caller shouldn't schedule another
    }

    return {
        MAGIC: MAGIC, BURN_ADDRESS: BURN_ADDRESS, EVENT_NAMES: EVENT_NAMES, NO_SUCCESSOR: NO_SUCCESSOR,
        sha256Bytes: sha256Bytes, protoHash: protoHash, deriveBodyHash: deriveBodyHash, deriveAssetId: deriveAssetId,
        hexToBytes: hexToBytes, bytesToHex: bytesToHex, extractOpReturnData: extractOpReturnData,
        decodeEnvelope: decodeEnvelope, decodeGameAssetOutput: decodeGameAssetOutput, collectGameAssets: collectGameAssets,
        gameAssetVoutHtml: gameAssetVoutHtml, gameAssetBannerHtml: gameAssetBannerHtml,
        fetchRegistryData: fetchRegistryData, applyRegistryData: applyRegistryData, enhanceGameAssets: enhanceGameAssets,
        registryCache: registryCache
    }
})()

// Browser: plain globals (matching the explorer's no-module style)
if (typeof window !== 'undefined') {
    window.decodeGameAssetOutput = GA.decodeGameAssetOutput
    window.collectGameAssets = GA.collectGameAssets
    window.gameAssetVoutHtml = GA.gameAssetVoutHtml
    window.gameAssetBannerHtml = GA.gameAssetBannerHtml
    window.enhanceGameAssets = GA.enhanceGameAssets
    window.GA_PROTOCOL = GA
}
// Node (unit tests)
if (typeof module !== 'undefined' && module.exports) module.exports = GA
