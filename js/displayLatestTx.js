// "Latest transactions" on the home page: the newest transactions across the latest blocks (block rewards included),
// each with its short hash, fiat value, amount, block and age. Block and transaction lookups are cached, so a new
// block only costs a couple of requests.
var latestTx = { blockCache: {}, txCache: {}, rendering: 0 }
var LATEST_TX_COUNT = 10
var LATEST_TX_BLOCKS = 10

function latestBlockTxIds(block) {
    var cached = latestTx.blockCache[block.hash]
    if (cached) return Promise.resolve(cached)
    return blockInfo(block.hash).then(function(data) {
        var ids = data && data.error == undefined && data.result && data.result.tx ? data.result.tx : null
        if (ids) latestTx.blockCache[block.hash] = ids
        return ids
    }).catch(function() { return null })
}

function latestTxDetails(id) {
    if (latestTx.txCache[id]) return Promise.resolve(latestTx.txCache[id])
    return transactionInfo(id).then(function(data) {
        var result = data && data.error == undefined ? data.result : null
        if (result) latestTx.txCache[id] = result
        return result
    }).catch(function() { return null })
}

function displayLatestTransactions(blocks) {
    var token = ++latestTx.rendering
    var newest = blocks.slice().sort(function(a, b) { return b.height - a.height }).slice(0, LATEST_TX_BLOCKS)

    Promise.all(newest.map(latestBlockTxIds)).then(function(lists) {
        if (token !== latestTx.rendering) return // a newer refresh is already running

        // newest block first; inside a block the ordinary transactions come before the block reward
        var entries = []
        newest.forEach(function(block, i) {
            var ids = lists[i]
            if (!ids) return
            var rows = ids.map(function(id, index) { return { id: id, height: block.height, blockHash: block.hash, time: block.time, coinbase: index === 0 } })
            entries = entries.concat(rows.filter(function(r) { return !r.coinbase }), rows.filter(function(r) { return r.coinbase }))
        })
        entries = entries.slice(0, LATEST_TX_COUNT)

        return Promise.all(entries.map(function(e) { return latestTxDetails(e.id) })).then(function(details) {
            if (token !== latestTx.rendering) return
            renderLatestTransactions(entries, details)
        })
    })
}

function renderLatestTransactions(entries, details) {
    var ticker = esc(getApi()['ticker'])
    var html = ''
    entries.forEach(function(e, i) {
        var d = details[i]
        var amount = d && d.amount != null ? d.amount : null
        html += '<div class="list-group-item latest-tx">' +
            '<a class="latest-tx-block" href="#/block/' + esc(e.blockHash) + '" title="Block ' + esc(fmtNum(e.height)) + '">#' + esc(fmtNum(e.height)) + '</a>' +
            '<span class="latest-tx-tx">' +
                '<a class="latest-tx-hash" href="#/transaction/' + esc(e.id) + '" title="' + esc(e.id) + '">' + esc(shortHash(e.id)) + '</a>' +
                '<span class="latest-tx-fiat">' + (amount !== null ? fiatHtml(amount) : '') + '</span>' +
            '</span>' +
            '<span class="latest-tx-age"><span data-age="' + esc(e.time) + '" title="' + esc(timeFormat(e.time)) + '">' + esc(timeAgo(e.time)) + '</span>' +
                (e.coinbase ? '<span class="badge badge-coinbase">Coinbase</span>' : '') + '</span>' +
            '<span class="latest-tx-amount">' + (amount !== null ? esc(amountFormat(amount)) + ' <b>' + ticker + '</b>' : '<span class="text-muted">–</span>') + '</span>' +
            '</div>'
    })
    if (!html) html = '<div class="list-group-item text-muted">No transactions to show yet.</div>'
    $('#latest-tx-list').html(html)
}
