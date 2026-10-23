// Mining pools page: renders data/poolstats.json (built by tools/build-poolstats.js) with names from data/pools.json
(function() {
    var testnet = new URLSearchParams(location.search).get('testnet')
    var file = 'data/poolstats' + (testnet ? '-testnet' : '') + '.json'
    var POOLS_FILE = 'data/pools.json'

    // The GitHub Action publishes the snapshot to the "poolstats-data" branch. If your repository has a different
    // owner/name, change this URL. The local file above is the fallback.
    var REMOTE_URL = 'https://raw.githubusercontent.com/Miners-World-Coin-MWC/explorer/poolstats-data/poolstats.json'

    function remoteUrlFor(hostname, pathname) {
        var m = /^([^.]+)\.github\.io$/i.exec(hostname)
        var repo = pathname.split('/').filter(Boolean)[0]
        if (m && repo && repo.indexOf('.') === -1) {
            return 'https://raw.githubusercontent.com/' + m[1] + '/' + repo + '/poolstats-data/poolstats.json'
        }
        return REMOTE_URL
    }

    var PALETTE = ['var(--accent)', 'var(--info)', 'var(--ok)', '#a78bfa', '#f472b6']
    var OTHER_COLOR = 'var(--text-faint)'
    var WINDOW_OPTIONS = [100, 500, 1000, 2000]
    var MIN_SHARE_TO_LIST = 1      // unlabelled addresses below this % are grouped into "Other miners"

    var state = { data: null, cfg: { pools: {} }, size: 0 }
    var $ = function(id) { return document.getElementById(id) }

    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    }
    function short(addr) { return addr.slice(0, 8) + '…' + addr.slice(-6) }
    function fmt(n) { return Number(n).toLocaleString('en-US') }

    function poolOf(addr) {
        var p = state.cfg.pools && state.cfg.pools[addr]
        if (p && p.name) return { name: p.name, url: p.url || '' }
        var label = (typeof addressLabels !== 'undefined') ? addressLabels[addr] : ''
        return label ? { name: label, url: '' } : null
    }

    // Turn the recent blocks into one entry per reward address
    function entriesFromBlocks(blocks) {
        var map = {}
        blocks.forEach(function(b) {
            var k = b[2] === null ? '\u0000unknown' : b[2]
            var e = map[k] || (map[k] = { addr: b[2], count: 0, lastHeight: 0, lastTime: 0 })
            e.count++
            if (b[0] > e.lastHeight) { e.lastHeight = b[0]; e.lastTime = b[1] }
        })
        return Object.keys(map).map(function(k) { return map[k] })
    }

    // The all-time tally already holds one entry per address
    function entriesFromAllTime(all) {
        var list = Object.keys(all.miners).map(function(addr) {
            var m = all.miners[addr]
            return { addr: addr, count: m[0], lastHeight: m[1], lastTime: m[2] }
        })
        if (all.unknown && all.unknown[0] > 0) list.push({ addr: null, count: all.unknown[0], lastHeight: all.unknown[1], lastTime: all.unknown[2] })
        return list
    }

    // Group entries by pool name (or by address when it has no name); fold tiny unlabelled miners together
    function aggregate(entries, total) {
        var groups = {}
        entries.forEach(function(e) {
            var addr = e.addr, key, g, pool = addr === null ? null : poolOf(addr)
            key = addr === null ? 'unknown' : (pool ? 'n:' + pool.name : 'a:' + addr)
            g = groups[key]
            if (!g) {
                g = groups[key] = { key: key, count: 0, addrs: {}, lastHeight: 0, lastTime: 0,
                    name: key === 'unknown' ? 'Unreadable coinbase' : (pool ? pool.name : null), url: pool ? pool.url : '', addr: key.charAt(0) === 'a' ? addr : null,
                    kind: key === 'unknown' ? 'unknown' : (pool ? 'pool' : 'solo') }
            }
            g.count += e.count
            if (addr) g.addrs[addr] = true
            if (e.lastHeight > g.lastHeight) { g.lastHeight = e.lastHeight; g.lastTime = e.lastTime }
            if (!g.url && pool && pool.url) g.url = pool.url
        })
        var list = Object.keys(groups).map(function(k) { return groups[k] })
        list.sort(function(a, b) { return b.count - a.count })

        // named pools are always listed; small unlabelled addresses are folded together
        var shown = [], other = null
        list.forEach(function(g) {
            var share = g.count / total * 100
            if (g.kind === 'solo' && share < MIN_SHARE_TO_LIST) {
                if (!other) other = { key: 'other', kind: 'other', name: 'Other miners', count: 0, addrs: {}, lastHeight: 0, lastTime: 0, url: '' }
                other.count += g.count
                Object.keys(g.addrs).forEach(function(a) { other.addrs[a] = true })
                if (g.lastHeight > other.lastHeight) { other.lastHeight = g.lastHeight; other.lastTime = g.lastTime }
            } else {
                shown.push(g)
            }
        })
        if (other) shown.push(other)
        shown.sort(function(a, b) { return b.count - a.count })
        return shown
    }

    function spanText(sec) {
        if (sec >= 63072000) return 'About ' + (sec / 31557600).toFixed(1) + ' years'
        if (sec >= 5184000) return 'About ' + Math.round(sec / 2629800) + ' months'
        if (sec >= 172800) return 'About ' + Math.round(sec / 86400) + ' days'
        if (sec >= 3600) return 'About ' + Math.round(sec / 3600) + ' hours'
        return sec > 0 ? 'About ' + Math.round(sec / 60) + ' minutes' : ''
    }

    function labelHtml(g) {
        if (g.kind === 'pool') {
            return '<b>' + esc(g.name) + '</b>' + (g.url ? ' <a class="pool-link" href="' + esc(g.url) + '" target="_blank" rel="noopener" title="Visit pool"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '')
        }
        if (g.kind === 'solo') {
            return '<span class="addr-label" style="margin:0 8px 0 0">Unlabelled</span><a class="mono" href="index.html#/address/' + encodeURIComponent(g.addr) + '" title="' + esc(g.addr) + '">' + esc(short(g.addr)) + '</a>'
        }
        if (g.kind === 'other') {
            var n = Object.keys(g.addrs).length
            return '<b>Other miners</b> <span class="text-muted">(' + fmt(n) + ' address' + (n === 1 ? '' : 'es') + ')</span>'
        }
        return '<span class="text-muted">' + esc(g.name) + '</span>'
    }

    function plainName(g) {
        if (g.kind === 'solo') return short(g.addr)
        return g.name
    }

    function render() {
        var data = state.data
        var isAll = state.size === 'all'
        var all = data.allTime
        var recent = data.blocks
        var entries, total, spanSec
        var lastTime = recent[recent.length - 1][1]

        if (isAll) {
            entries = entriesFromAllTime(all)
            total = entries.reduce(function(sum, e) { return sum + e.count }, 0)
            spanSec = all.fromTime ? lastTime - all.fromTime : 0
        } else {
            var blocks = recent.slice(-state.size)
            entries = entriesFromBlocks(blocks)
            total = blocks.length
            spanSec = total > 1 ? blocks[total - 1][1] - blocks[0][1] : 0
        }
        var groups = aggregate(entries, total)

        // Hashrate estimate: the pool's share of the recent blocks x the network hashrate. The all-time view uses the whole
        // recent window, so it still shows what each pool is mining with NOW (an all-time average would be meaningless).
        var hashBlocks = isAll ? recent : recent.slice(-state.size)
        var recentCounts = {}
        hashBlocks.forEach(function(b) { if (b[2]) recentCounts[b[2]] = (recentCounts[b[2]] || 0) + 1 })
        var hashOf = function(g) {
            if (!(data.nethash > 0) || g.kind === 'unknown') return null
            var n = 0
            Object.keys(g.addrs).forEach(function(a) { n += recentCounts[a] || 0 })
            return Math.round(data.nethash * n / hashBlocks.length)
        }

        var minerCount = entries.filter(function(e) { return e.addr !== null }).length

        // tiles
        $('pl-blocks').textContent = fmt(total)
        $('pl-span').textContent = spanText(spanSec)
        $('pl-miners').textContent = fmt(minerCount)
        var top = groups.filter(function(g) { return g.kind !== 'unknown' && g.kind !== 'other' })[0] || groups[0]
        var topShare = top ? top.count / total * 100 : 0
        $('pl-top').textContent = top ? topShare.toFixed(1) + '%' : '–'
        $('pl-top-name').textContent = top ? plainName(top) : ''

        // notes: unfinished history scan, and one entity controlling most blocks
        var notes = []
        var chainBlocks = data.lastHeight + 1
        if (isAll && all.scanLow > 0) {
            notes.push('The full history scan is still running: ' + fmt(total) + ' of ' + fmt(chainBlocks) + ' blocks (' + (total / chainBlocks * 100).toFixed(0) + '%) are covered so far, so the all-time figures are partial until it finishes.')
        }
        if (top && topShare >= 50) {
            notes.push(plainName(top) + ' found ' + topShare.toFixed(1) + '% of ' + (isAll ? 'all ' + fmt(total) + ' blocks scanned' : 'the last ' + fmt(total) + ' blocks') + '. One miner controlling more than half of the blocks is a risk for the network.')
        }
        var note = $('pl-note')
        note.innerHTML = notes.map(esc).join('<br>')
        note.classList.toggle('d-none', notes.length === 0)

        // distribution bar: the five biggest entities, everything else together
        var bar = '', legend = '', rest = total
        groups.slice(0, 5).forEach(function(g, i) {
            var w = g.count / total * 100
            rest -= g.count
            bar += '<span class="dist-seg" style="width:' + w + '%;background:' + PALETTE[i] + '" title="' + esc(plainName(g)) + '"></span>'
            legend += '<span><i style="background:' + PALETTE[i] + '"></i>' + esc(plainName(g)) + ' <b>' + w.toFixed(1) + '%</b></span>'
        })
        if (rest > 0) {
            var rw = rest / total * 100
            bar += '<span class="dist-seg" style="width:' + rw + '%;background:' + OTHER_COLOR + '" title="Others"></span>'
            legend += '<span><i style="background:' + OTHER_COLOR + '"></i>Everyone else <b>' + rw.toFixed(1) + '%</b></span>'
        }
        $('pl-dist').innerHTML = bar
        $('pl-legend').innerHTML = legend

        // table (the hashrate estimate only makes sense for recent blocks: it uses today's network hashrate)
        var rows = ''
        groups.forEach(function(g, i) {
            var share = g.count / total * 100
            var h = typeof convertHashes === 'function' ? hashOf(g) : null
            var hash = h === null ? '–' : h === 0 ? '<span class="text-muted" title="No blocks in the last ' + fmt(hashBlocks.length) + '">–</span>' : convertHashes(h)
            rows += '<tr>' +
                '<td class="rank-cell pl-hide-sm">' + (i + 1) + '</td>' +
                '<td>' + labelHtml(g) + '</td>' +
                '<td class="col-num mono pl-hide-sm">' + fmt(g.count) + '</td>' +
                '<td class="col-num mono"><span class="share-pct">' + share.toFixed(1) + '%</span><span class="share-bar"><span style="width:' + Math.min(100, share) + '%"></span></span></td>' +
                '<td class="col-num mono">' + hash + '</td>' +
                '<td class="time-cell pl-hide-sm">' + (g.lastHeight ? '<a href="index.html#/height/' + g.lastHeight + '">#' + fmt(g.lastHeight) + '</a> <small>' + esc(timeAgo(g.lastTime)) + '</small>' : '–') + '</td>' +
                '</tr>'
        })
        document.querySelector('#pl-table tbody').innerHTML = rows
        var netText = data.nethash > 0 && typeof convertHashes === 'function' ? ' · Network ' + convertHashes(Math.round(data.nethash)) : ''
        $('pl-table-note').textContent = (isAll ? 'All time: ' + fmt(total) + ' blocks' : 'Last ' + fmt(total) + ' blocks') + netText
        $('pl-hash-note').textContent = 'Hashrate is an estimate: each pool\'s share of the last ' + fmt(hashBlocks.length) + ' blocks multiplied by the network hashrate' +
            (isAll ? ' (so it shows current mining power, not an all-time average)' : '') + '. Pools with few blocks give only a rough figure.'


        // window buttons
        var avail = recent.length
        var opts = WINDOW_OPTIONS.filter(function(n) { return n < avail })
        opts.push(avail)
        var html = opts.map(function(n) {
            return '<button type="button" class="win-btn' + (n === state.size ? ' active' : '') + '" data-size="' + n + '">' + fmt(n) + '</button>'
        }).join('')
        if (all && all.scanLow !== null && all.scanLow < recent[0][0]) {
            html += '<button type="button" class="win-btn' + (isAll ? ' active' : '') + '" data-size="all">All time</button>'
        }
        $('pl-windows').innerHTML = html
    }

    function renderRecent() {
        var html = ''
        state.data.blocks.slice(-20).reverse().forEach(function(b) {
            var pool = b[2] ? poolOf(b[2]) : null
            var who = b[2] === null ? '<span class="text-muted">Unreadable coinbase</span>'
                : pool ? '<b>' + esc(pool.name) + '</b>'
                : '<span class="addr-label" style="margin:0 8px 0 0">Unlabelled</span><span class="mono">' + esc(short(b[2])) + '</span>'
            html += '<a class="list-group-item list-group-item-action io-row" href="index.html#/height/' + b[0] + '">' +
                '<span class="io-left"><span class="mono" style="min-width:84px;font-weight:600">#' + fmt(b[0]) + '</span><span class="io-addr">' + who + '</span></span>' +
                '<span class="io-amt"><span title="' + esc(timeFormat(b[1])) + '">' + esc(timeAgo(b[1])) + '</span></span></a>'
        })
        $('pl-recent').innerHTML = html
    }

    function pickDefaultSize(avail) { return Math.min(avail, 1000) }

    function load(url) {
        return fetch(url, { cache: 'no-cache' }).then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status)
            return res.json()
        })
    }

    var statsRequest = testnet ? load(file) : load(remoteUrlFor(location.hostname, location.pathname)).catch(function() { return load(file) })
    var poolsRequest = load(POOLS_FILE).catch(function() { return { pools: {} } })

    Promise.all([statsRequest, poolsRequest]).then(function(results) {
        var data = results[0]
        if (!data.blocks || !data.blocks.length) throw new Error('empty')
        state.data = data
        state.cfg = results[1] || { pools: {} }
        state.size = pickDefaultSize(data.blocks.length)

        if (data.network === 'testnet') { $('net-badge').textContent = 'Testnet' }
        $('pl-updated').textContent = typeof timeAgo === 'function' ? timeAgo(data.updated) : new Date(data.updated * 1000).toLocaleString()
        $('pl-updated').title = new Date(data.updated * 1000).toLocaleString()
        $('pl-height').textContent = 'At block ' + fmt(data.lastHeight)

        render()
        renderRecent()
        $('pl-content').classList.remove('d-none')

        $('pl-windows').addEventListener('click', function(e) {
            var btn = e.target.closest('.win-btn')
            if (!btn) return
            var size = btn.getAttribute('data-size')
            state.size = size === 'all' ? 'all' : parseInt(size, 10)
            render()
        })
    }).catch(function() {
        $('pl-empty').classList.remove('d-none')
    })
})()
