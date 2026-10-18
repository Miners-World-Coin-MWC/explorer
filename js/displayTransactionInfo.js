function displayTransactionInfo(data) {
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

    var status = confirmed
        ? `<span class="badge badge-ok">${fmtNum(data.confirmations)} confirmations</span>`
        : `<span class="badge badge-pending">Unconfirmed</span>`

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
            ${kvRow('Amount transferred', amountHtml(data.amount))}
            ${isCoinbase ? '' : kvRow('Fee', amountHtml(fee))}
            ${kvRow('Size', `${fmtNum(data.size)} bytes`)}
            ${kvRow('Version', esc(data.version))}
            ${data.locktime != 0 ? kvRow('Locktime', esc(data.locktime)) : ''}
        </div>`

    $('#tx-info-table').html(content)
    $('#tx-vout-count').text(data.vout.length)
    $('#tx-vin-count').text(data.vin.length)
    $('#tx-vout-list').empty()
    $('#tx-vin-list').empty()

    displayTxVout(data.vout, fee)
    displayTxVin(data.vin)

    $('#tx-info-vout-total').removeClass('d-none')
    $('#tx-info-vin-total').removeClass('d-none')
}
