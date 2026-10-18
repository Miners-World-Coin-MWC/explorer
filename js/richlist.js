// Richlist page: renders data/richlist.json (built by tools/build-richlist.js)
(function() {
    var PAGE_SIZE = 50
    var TICKER = 'MWC'
    var testnet = new URLSearchParams(location.search).get('testnet')
    var file = 'data/richlist' + (testnet ? '-testnet' : '') + '.json'

    // The GitHub Action publishes the snapshot to the "richlist-data" branch (so the site repo's history stays small).
    // If your repository has a different owner/name, change this URL. The local file above is the fallback.
    var REMOTE_URL = 'https://raw.githubusercontent.com/Miners-World-Coin-MWC/explorer/richlist-data/richlist.json'

    // When served from GitHub Pages (<owner>.github.io/<repo>/), work the URL out automatically instead
    function remoteUrlFor(hostname, pathname) {
        var m = /^([^.]+)\.github\.io$/i.exec(hostname)
        var repo = pathname.split('/').filter(Boolean)[0]
        if (m && repo && repo.indexOf('.') === -1) {
            return 'https://raw.githubusercontent.com/' + m[1] + '/' + repo + '/richlist-data/richlist.json'
        }
        return REMOTE_URL
    }

    var state = { rows: [], filtered: [], page: 0, supply: 0n }
    var $ = function(id) { return document.getElementById(id) }

    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    }

    // Exact formatting of a satoshi amount held as a string (no floating point rounding)
    function fmtSats(str, maxDec) {
        var n = BigInt(str)
        var whole = n / 100000000n
        var frac = (n % 100000000n).toString().padStart(8, '0').slice(0, maxDec).replace(/0+$/, '')
        return whole.toLocaleString('en-US') + (frac ? '.' + frac : '')
    }

    // Share of supply as a percentage string with two decimals
    function pct(big, supply, forceDecimals) {
        if (supply <= 0n) return '0%'
        var hundredths = Number(big * 10000n / supply) // e.g. 1234 = 12.34%
        if (hundredths === 0 && big > 0n && !forceDecimals) return '<0.01%'
        return (hundredths / 100).toFixed(2) + '%'
    }

    function sumTop(rows, n) {
        var s = 0n
        for (var i = 0; i < Math.min(n, rows.length); i++) s += rows[i].big
        return s
    }

    function labelOf(address) {
        return (typeof addressLabels !== 'undefined' && addressLabels[address]) || ''
    }

    function renderStats(data) {
        $('rl-holders').textContent = Number(data.holders).toLocaleString('en-US')
        $('rl-top10').textContent = pct(sumTop(state.rows, 10), state.supply, true)
        $('rl-top100').textContent = pct(sumTop(state.rows, 100), state.supply, true)
        $('rl-updated').textContent = typeof timeAgo === 'function' ? timeAgo(data.updated) : new Date(data.updated * 1000).toLocaleString()
        $('rl-updated').title = new Date(data.updated * 1000).toLocaleString()
        $('rl-height').textContent = 'At block ' + Number(data.height).toLocaleString('en-US')
        if (data.network === 'testnet') { $('net-badge').textContent = 'Testnet' }
        if (data.skipped > 0) {
            $('rl-note').textContent = data.skipped + ' transaction' + (data.skipped === 1 ? '' : 's') + ' could not be read from the blockchain API and ' + (data.skipped === 1 ? 'is' : 'are') + ' not included, so a few balances may be slightly off.'
            $('rl-note').classList.remove('d-none')
        }
    }

    function renderDistribution() {
        var t10 = sumTop(state.rows, 10)
        var t100 = sumTop(state.rows, 100)
        var t1000 = sumTop(state.rows, 1000)
        var segs = [
            { cls: 's1', name: 'Top 10', v: t10 },
            { cls: 's2', name: 'Top 11–100', v: t100 - t10 },
            { cls: 's3', name: 'Top 101–1,000', v: t1000 - t100 },
            { cls: 's4', name: 'All other addresses', v: state.supply - t1000 }
        ]
        var bar = '', legend = ''
        segs.forEach(function(s) {
            var width = state.supply > 0n ? Number(s.v * 10000n / state.supply) / 100 : 0
            if (width > 0) bar += '<span class="dist-seg ' + s.cls + '" style="width:' + width + '%" title="' + esc(s.name) + '"></span>'
            legend += '<span><i class="' + s.cls + '"></i>' + esc(s.name) + ' <b>' + pct(s.v, state.supply, true) + '</b></span>'
        })
        $('rl-dist').innerHTML = bar
        $('rl-dist-legend').innerHTML = legend
    }

    function renderTable() {
        var total = state.filtered.length
        var pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
        state.page = Math.min(state.page, pages - 1)
        var slice = state.filtered.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE)

        var html = ''
        slice.forEach(function(r) {
            var label = labelOf(r.a)
            var share = state.supply > 0n ? Number(r.big * 10000n / state.supply) / 100 : 0
            html += '<tr>' +
                '<td class="rank-cell' + (r.rank <= 3 ? ' rank-top' : '') + '">' + r.rank + '</td>' +
                '<td class="hash-cell"><a href="index.html#/address/' + encodeURIComponent(r.a) + (testnet ? '' : '') + '" title="' + esc(r.a) + '">' + esc(r.a) + '</a>' +
                    (label ? ' <span class="addr-label" style="margin:0 0 0 8px">' + esc(label) + '</span>' : '') + '</td>' +
                '<td class="col-num mono">' + fmtSats(r.b, 4) + ' <span class="text-muted">' + TICKER + '</span></td>' +
                '<td class="col-num rl-share-col mono"><span class="share-pct">' + pct(r.big, state.supply) + '</span>' +
                    '<span class="share-bar"><span style="width:' + Math.min(100, Math.max(share * 1.5, share > 0 ? 2 : 0)) + '%"></span></span></td>' +
                '</tr>'
        })
        if (!slice.length) html = '<tr><td colspan="4" class="text-center text-muted py-4">No addresses match your filter.</td></tr>'
        document.querySelector('#rl-table tbody').innerHTML = html

        $('rl-count').textContent = total === state.rows.length
            ? 'Showing top ' + total.toLocaleString('en-US')
            : total.toLocaleString('en-US') + ' of ' + state.rows.length.toLocaleString('en-US') + ' match'
        $('rl-page').textContent = 'Page ' + (state.page + 1) + ' of ' + pages
        $('rl-prev').disabled = state.page === 0
        $('rl-next').disabled = state.page >= pages - 1
        $('rl-pager').style.display = pages > 1 ? 'flex' : 'none'
    }

    function applyFilter() {
        var q = $('rl-filter').value.trim().toLowerCase()
        state.filtered = q === '' ? state.rows : state.rows.filter(function(r) {
            return r.a.toLowerCase().indexOf(q) !== -1 || labelOf(r.a).toLowerCase().indexOf(q) !== -1
        })
        state.page = 0
        renderTable()
    }

    function load(url) {
        return fetch(url, { cache: 'no-cache' }).then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status)
            return res.json()
        })
    }

    // mainnet: GitHub data branch first, then the bundled file; testnet: bundled file only
    var request = testnet ? load(file) : load(remoteUrlFor(location.hostname, location.pathname)).catch(function() { return load(file) })

    request.then(function(data) {
        state.rows = data.addresses.map(function(x, i) { return { rank: i + 1, a: x.a, b: x.b, big: BigInt(x.b) } })
        state.supply = BigInt(data.supply)
        state.filtered = state.rows

        renderStats(data)
        renderDistribution()
        renderTable()
        $('rl-content').classList.remove('d-none')

        $('rl-filter').addEventListener('input', applyFilter)
        $('rl-prev').addEventListener('click', function() { state.page--; renderTable(); window.scrollTo(0, 0) })
        $('rl-next').addEventListener('click', function() { state.page++; renderTable(); window.scrollTo(0, 0) })
    }).catch(function() {
        $('rl-empty').classList.remove('d-none')
    })
})()
