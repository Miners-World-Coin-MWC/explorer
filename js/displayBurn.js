// Burned coins: stat tiles on the home page + a "latest burns" panel.
// Coins sent to the network's burn address can never be spent again.
var burnState = { address: null, height: null, txcount: null }

function burnAmount(tx, address) {
    var total = 0
    ;(tx.vout || []).forEach(function(vout) {
        var addrs = vout.scriptPubKey && vout.scriptPubKey.addresses
        if (addrs && addrs.indexOf(address) !== -1 && vout.value) total += vout.value
    })
    return total
}

function burnTx(id) {
    return transactionInfo(id).then(function(data) {
        return data && data.error == undefined ? data.result : null
    }).catch(function() { return null })
}

// Newest burns first. The history endpoint may list oldest-first or newest-first, so check the order instead of assuming.
function loadRecentBurns(address, page) {
    var ids = page.tx || []
    var total = page.txcount
    var limit = 5
    var pageSize = ids.length

    var done = function(txs) {
        var burns = txs.filter(function(t) { return t && t.time }).map(function(t) {
            return { id: t.txid, time: t.time, amount: burnAmount(t, address) }
        }).sort(function(a, b) { return b.time - a.time }).slice(0, limit)
        renderRecentBurns(address, burns, total)
    }

    if (ids.length === 0) return done([])

    // Everything fits on one page: load it all and sort by time
    if (total <= pageSize) {
        return Promise.all(ids.map(burnTx)).then(done)
    }

    // More than one page: compare the first and last entries to learn the order
    Promise.all([burnTx(ids[0]), burnTx(ids[ids.length - 1])]).then(function(ends) {
        if (!ends[0] || !ends[1]) return done([])
        if (ends[0].time >= ends[1].time) {
            // newest first: the first entries are the latest burns
            Promise.all(ids.slice(0, limit).map(burnTx)).then(done)
        } else {
            // oldest first: the latest burns are at the end, which may mean reaching back past a part-filled last page
            var collect = function(offset, collected) {
                return addressHistory(address, offset).then(function(p) {
                    collected = ((p.result && p.result.tx) || []).concat(collected)
                    return collected.length >= limit || offset <= 0 ? collected : collect(offset - pageSize, collected)
                })
            }
            var lastOffset = Math.floor((total - 1) / pageSize) * pageSize
            collect(lastOffset, []).then(function(tail) {
                return Promise.all(tail.slice(-limit).map(burnTx))
            }).then(done).catch(function() { done([]) })
        }
    })
}

function renderRecentBurns(address, burns, total) {
    var ticker = esc(getApi()['ticker'])
    var html = ''
    burns.forEach(function(b) {
        html += '<a class="list-group-item list-group-item-action io-row" href="#/transaction/' + esc(b.id) + '">' +
            '<span class="io-left"><i class="fa-solid fa-fire" style="color:var(--accent);margin-right:10px"></i>' +
            '<span class="io-addr" title="' + esc(timeFormat(b.time)) + '">' + esc(timeAgo(b.time)) + ' <span class="text-muted">&middot; ' + esc(shortHash(b.id)) + '</span></span></span>' +
            '<span class="io-amt">' + esc(amountFormat(b.amount)) + ' <b>' + ticker + '</b>' + fiatHtml(b.amount) + '</span></a>'
    })
    if (!html) html = '<div class="list-group-item text-muted">No burns yet.</div>'
    $('#burn-recent-list').html(html)

    if (total > burns.length) {
        $('#burn-all-link').removeClass('d-none').attr('href', '#/address/' + address).text('View all ' + fmtNum(total) + ' burn transactions')
    } else {
        $('#burn-all-link').addClass('d-none')
    }
}

function displayBurn(supplySatoshis, height) {
    var address = getApi()['burnAddress']
    if (!address) { // networks without a burn address (testnet) simply don't show any of it
        $('.burn-tile, #burn-recent-card').addClass('d-none')
        $('#stat-burned-fiat').empty()
        burnState.address = null
        setBurned(null)
        return
    }
    $('.burn-tile').removeClass('d-none')

    // Burns only change when a block arrives, so don't ask again until the chain moves
    if (burnState.address === address && burnState.height === height) return
    burnState.address = address
    burnState.height = height

    $('#burn-address-link').attr('href', '#/address/' + address)

    addressBalance(address).then(function(data) {
        if (data.error != undefined || !data.result) return
        var burned = Number(data.result.balance)
        $('#stat-burned').removeClass('loading').text(coinsText(burned))

        var supply = totalSupplySat(Number(supplySatoshis), burned) // share of everything ever issued (circulating + burned)
        var share = ''
        if (supply > 0) {
            var pct = burned / supply * 100
            share = (pct > 0 && pct < 0.01 ? '<0.01' : pct.toFixed(2)) + '% of supply'
        }
        $('#stat-burned-sub').text(getApi()['ticker'] + (share ? ' · ' + share : ''))
        $('#stat-burned-fiat').html(fiatHtml(burned))
        setBurned(burned) // circulating supply = total supply - burned
    }).catch(function() {
        $('#stat-burned').text('Unavailable')
        burnState.height = null // try again on the next refresh
    })

    addressHistory(address).then(function(data) {
        if (data.error != undefined || !data.result) return
        $('#stat-burncount').removeClass('loading').text(fmtNum(data.result.txcount))
        // reload the list only when there is a new burn transaction
        if (burnState.txcount !== data.result.txcount || $('#burn-recent-list').children().length === 0) {
            burnState.txcount = data.result.txcount
            loadRecentBurns(address, data.result)
        }
    }).catch(function() {
        burnState.height = null
    })
}

// "Show latest burns" under the burn transactions tile
$(document).on('click', '#burn-toggle', function(e) {
    e.preventDefault()
    var card = $('#burn-recent-card')
    card.toggleClass('d-none')
    $(this).text(card.hasClass('d-none') ? 'Show latest burns' : 'Hide latest burns')
})
