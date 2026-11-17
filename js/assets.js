// ---------------------------------------------------------------------------
// Game Assets page — every MWC Game Asset anchored on chain, from the same
// registry snapshot the transaction pages use (data/game-assets.json,
// refreshed by the GitHub Action running tools/build-game-assets.js).
//
// The chain stays the authority: each row links to the anchoring transaction
// where the visitor can verify the OP_RETURN commitment themselves.
// ---------------------------------------------------------------------------
(function () {
    var snap = null

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        })
    }
    function shortId(s) {
        s = String(s == null ? '' : s)
        return s.length > 20 ? s.slice(0, 10) + '…' + s.slice(-6) : s
    }
    function iconFor(cat) {
        if (cat === 'creature') return '🐾'
        if (cat === 'badge' || cat === 'trophy') return '🏅'
        return '🎁'
    }
    function statusChip(status) {
        var s = String(status || '').toUpperCase()
        if (s === 'BURNED' || s === 'PENDING_BURN' || s === 'CONSUMED') return '<span class="ga-type ga-e-burn">burned</span>'
        if (s === 'PENDING_MINT' || s === 'PENDING_TRANSFER') return '<span class="ga-type ga-e-craft">' + esc(String(status).toLowerCase()) + '</span>'
        if (s === 'LISTED') return '<span class="ga-type ga-e-market">listed</span>'
        return '<span class="ga-type ga-e-mint">active</span>'
    }
    function rarityChip(r) {
        r = String(r || '').toLowerCase()
        if (!r) return ''
        return '<span class="ga-rarity ga-r-' + esc(r) + '">' + esc(r) + '</span>'
    }
    function assetPageHref(id) {
        var base = (typeof GAME_API_BASE === 'string' ? GAME_API_BASE : '').replace(/\/+$/, '')
        return base ? base + '/api/assets/' + encodeURIComponent(id) : '#'
    }

    // Group snapshot entries (keyed by txid) into per-asset rows.
    function rowsFromSnapshot(data) {
        var byAsset = {}
        var unresolved = 0
        var entries = (data && data.entries) || {}
        Object.keys(entries).forEach(function (txid) {
            var e = entries[txid] || {}
            var reg = (e.registry && e.registry.asset) || null
            var evs = e.events || []
            if (!reg || !reg.assetId) { unresolved++; return }
            var id = reg.assetId
            if (!byAsset[id]) {
                byAsset[id] = {
                    assetId: id,
                    name: reg.name || id,
                    category: reg.category || '',
                    rarity: reg.rarity || '',
                    status: reg.status || '',
                    owner: reg.owner || '',
                    controlAddress: reg.controlAddress || null,
                    nonTransferable: !!reg.nonTransferable,
                    mintTxid: reg.mintTxid || null,
                    legacy: /^MWC1-/i.test(id),
                    events: [],
                    heights: [],
                }
            }
            var row = byAsset[id]
            var type = null
            for (var i = 0; i < evs.length; i++) type = type || evs[i].type
            if (!type && e.registry && e.registry.payload) {
                try { type = (JSON.parse(e.registry.payload.bodyJson).meta || {}).t } catch (err) { /* opaque */ }
            }
            row.events.push({ type: type || 'ASSET', txid: txid, height: e.height })
            if (e.height) row.heights.push(e.height)
        })
        var rows = Object.keys(byAsset).map(function (k) { return byAsset[k] })
        rows.forEach(function (r) {
            r.heights.sort(function (a, b) { return a - b })
            r.events.sort(function (a, b) { return a.height - b.height })
        })
        rows.sort(function (a, b) {
            var ha = a.heights[0] || 0, hb = b.heights[0] || 0
            return hb - ha || String(a.name).localeCompare(String(b.name))
        })
        return { rows: rows, unresolved: unresolved }
    }

    function render() {
        var result = rowsFromSnapshot(snap)
        var rows = result.rows
        $('#ga-count').text(rows.length + ' asset' + (rows.length === 1 ? '' : 's'))
        $('#ga-updated').text(snap && snap.generatedAt ? new Date(snap.generatedAt).toLocaleString() : '–')
        $('#ga-height').text(snap && snap.scannedThrough ? 'scanned through block ' + snap.scannedThrough : '')
        $('#ga-unresolved').text(result.unresolved ? result.unresolved + ' on-chain asset event(s) not yet resolved by the registry snapshot' : '')
        var filter = ($('#ga-filter').val() || '').toString().toLowerCase()
        var shown = rows.filter(function (r) {
            if (!filter) return true
            return (r.name + ' ' + r.assetId + ' ' + r.category + ' ' + r.rarity + ' ' + r.status + ' ' + (r.controlAddress || '')).toLowerCase().indexOf(filter) !== -1
        })
        var tbody = $('#ga-table tbody').empty()
        if (!shown.length) {
            $('#ga-empty').removeClass('d-none')
            return
        }
        $('#ga-empty').addClass('d-none')
        shown.forEach(function (r) {
            var custody = r.controlAddress
                ? '<a class="io-addr" href="#/address/' + esc(r.controlAddress) + '" title="' + esc(r.controlAddress) + '">' + esc(shortId(r.controlAddress)) + '</a>'
                : '<span class="text-muted">–</span>'
            var evLinks = r.events.slice(-4).map(function (ev, i) {
                var last = i === Math.min(r.events.length, 4) - 1
                var label = ev.type + (r.events.length > 4 && last ? ' +' + (r.events.length - 4) : '')
                return '<a class="ga-evlink" href="#/transaction/' + esc(ev.txid) + '" title="' + esc(ev.txid) + '">' + esc(label) + '</a>'
            }).join(' ')
            var tr = '<tr>' +
                '<td><div class="ga-name-cell">' + iconFor(r.category) + ' <a href="' + esc(assetPageHref(r.assetId)) + '" target="_blank" rel="noopener"><b>' + esc(r.name) + '</b></a> ' + rarityChip(r.rarity) +
                    (r.legacy ? ' <span class="ga-legacy" title="Minted before the asset protocol (v1 JSON anchor)">legacy</span>' : '') +
                    (r.nonTransferable ? ' <span class="ga-soulbound">soul-bound</span>' : '') + '</div>' +
                    '<div class="mono text-muted" style="font-size:11px">' + esc(shortId(r.assetId)) + '</div></td>' +
                '<td>' + esc(r.category || '–') + '</td>' +
                '<td>' + statusChip(r.status) + '</td>' +
                '<td>' + custody + '</td>' +
                '<td>' + (r.mintTxid ? '<a class="tx-hash" href="#/transaction/' + esc(r.mintTxid) + '" title="' + esc(r.mintTxid) + '">' + esc(shortId(r.mintTxid)) + '</a>' : '<span class="text-muted">–</span>') + '</td>' +
                '<td>' + evLinks + '</td>' +
                '</tr>'
            tbody.append(tr)
        })
    }

    function boot() {
        $('#ga-filter').on('input', render)
        var load = (window.GA_PROTOCOL && window.GA_PROTOCOL.loadSnapshot)
            ? window.GA_PROTOCOL.loadSnapshot()
            : Promise.reject(new Error('gameasset.js missing'))
        load.then(function (data) {
            snap = data
            if (!snap) {
                $('#ga-empty').removeClass('d-none')
                $('#ga-count').text('–')
                return
            }
            render()
        }).catch(function () {
            $('#ga-empty').removeClass('d-none')
        })
    }

    if (typeof $ !== 'undefined') $(boot)
    else if (document.readyState !== 'loading') boot()
    else document.addEventListener('DOMContentLoaded', boot)
})()
