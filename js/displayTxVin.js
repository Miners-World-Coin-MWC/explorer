function displayTxVin(vin_list) {
    vin_list.forEach(function(vin, index) {
        if (vin['coinbase'] != undefined) {
            $('#tx-vin-list').append(`
                <div class="list-group-item">
                    Newly generated coins <span class="badge badge-coinbase ml-1">Coinbase</span>
                </div>`)
        } else if ($('#tx-vin-list').find(`[data-tx-vin-index="${index}"]`).length == 0) {
            var address = vin.scriptPubKey && vin.scriptPubKey.addresses ? vin.scriptPubKey.addresses[0] : undefined
            var addr = address != undefined
                ? `<a class="io-addr" href="#/address/${esc(address)}" title="${esc(address)}">${esc(address)}</a>`
                : `<span class="io-addr text-muted">Non-standard input</span>`

            $('#tx-vin-list').append(`
                <div class="list-group-item" data-tx-vin-index="${index}">
                    <div class="io-row">
                        <span class="io-left"><span class="io-dot in"></span>${addr}${vin['txid'] != undefined ? `<a class="ml-2 text-muted" style="white-space:nowrap" href="#/transaction/${esc(vin['txid'])}" title="Spent output">source tx</a>` : ''}</span>
                        <span class="io-amt">${vin.value != undefined ? amountHtml(vin.value) + fiatHtml(vin.value) : ''}</span>
                    </div>
                </div>`)
        }
    })

    collapseList('#tx-vin-list', '[data-tx-vin-index]', 50)
}
