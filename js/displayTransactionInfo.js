function displayTransactionInfo(data, isRerender) {
    var isCoinbase = data.vin.some(function(vin) { return vin.coinbase != undefined })

    var vin_amount = 0
    data.vin.forEach(function(vin) {
        if (vin.value != undefined) vin_amount += vin.value
    })

    var vout_amount = 0
    data.vout.forEach(function(vout) {
        if (vout.value != undefined) vout_amount += vout.value
    })

    var fee = isCoinbase ? 0 : vin_amount - vout_amount
    var confirmed = data.blockhash != undefined

    // On-chain game assets (Miners World: Onchain Adventures): if any output
    // carries an MWC Game Asset OP_RETURN payload, show a decoded NFT banner.
    var gameAssets = (typeof collectGameAssets === 'function') ? collectGameAssets(data) : []

    // COMMITMENT-mode payloads carry only a hash on chain. Ask the game
    // registry for the full body + metadata. Runs on EVERY render: the first
    // one schedules the fetch (hash-only view until it lands), while re-
    // renders apply the cached result to the freshly decoded objects BEFORE
    // the HTML below is built — a re-render that skipped this would decode
    // brand-new objects and throw the enrichment away (hash-only card
    // forever). Safe against loops: one fetch per txid; once cached, the
    // call applies synchronously and schedules nothing.
    if (gameAssets.length && typeof enhanceGameAssets === 'function') {
        enhanceGameAssets(data.txid, gameAssets, function() {
            // Only re-render if this tx is still on screen — fast navigation
            // could have swapped the view to another transaction.
            var shown = $('#tx-info-hash').data('tx-info-hash')
            if (!shown || shown === data.txid) displayTransactionInfo(data, true)
        })
    }

    var status = confirmed
        ? `<span class="badge badge-ok">${fmtNum(data.confirmations)} confirmations</span>`
        : `<span class="badge badge-pending">Unconfirmed</span>`

    if (gameAssets.length) status += ` <span class="badge badge-gameasset"><i class="fa-solid fa-gamepad"></i> Game Asset</span>`

    var content = `
        <div class="card kv-card mb-3">
            <div class="kv-head">
                <div>
                    <h2>Transaction</h2>
                    ${data.time != undefined ? `<div class="kv-sub">${timeFormat(data.time)} &middot; <span data-age="${esc(data.time)}">${timeAgo(data.time)}</span></div>` : ''}
                </div>
                <div>${status}${isCoinbase ? ' <span class="badge badge-coinbase">Coinbase</span>' : ''}</div>
            </div>
            ${kvRow('Transaction hash', `<span id="tx-info-hash" data-tx-info-hash="${esc(data.txid)}">${esc(data.txid)}</span>${copyBtn(data.txid)}`, 'mono')}
            ${kvRow('Block', confirmed
                ? `<a href="#/block/${esc(data.blockhash)}">#${fmtNum(data.height)}</a>`
                : `<span class="text-danger">In the memory pool, not yet included in a block</span>`)}
            ${data.time != undefined ? kvRow('Timestamp', `${timeFormat(data.time)} <span class="text-muted">(${esc(data.time)})</span>`) : ''}
            ${kvRow('Amount transferred', amountHtml(data.amount) + ' ' + fiatHtml(data.amount))}
            ${isCoinbase ? '' : kvRow('Fee', amountHtml(fee) + ' ' + fiatHtml(fee))}
            ${kvRow('Size', `${fmtNum(data.size)} bytes`)}
            ${kvRow('Version', esc(data.version))}
            ${data.locktime != 0 ? kvRow('Locktime', esc(data.locktime)) : ''}
        </div>`

    $('#tx-info-table').html((gameAssets.length ? gameAssetBannerHtml(gameAssets) : '') + content)
    $('#tx-vout-count').text(data.vout.length)
    $('#tx-vin-count').text(data.vin.length)
    $('#tx-vout-list').empty()
    $('#tx-vin-list').empty()

    displayTxVout(data.vout, fee, data.txid)
    displayTxVin(data.vin)

    $('#tx-info-vout-total').removeClass('d-none')
    $('#tx-info-vin-total').removeClass('d-none')
}
