function displayTxVin(vin_list) {
    var total = $('#tx-info-vin-total .card-header b').text()
    vin_list.forEach(function(vin, index) {
        if (vin['coinbase'] != undefined) {
            $('#tx-vin-list').append('Newly Generated Coins (<b>Coinbase Transaction</b>)')
        } else {
            if ($('#tx-vin-list').find(`[data-tx-vin-index="${index}"]`).length == 0) {
                var content = `
                <div class="list-group-item flex-column align-items-start" data-tx-vin-index="${vin.vin_index}">
                    <div class="row">
                        <div class="col-md-9 col-sm-12 col-xs-12">
                            <span class="text-muted mr-1">
                                <span class="entypo up text-danger"></span>
                            </span>
                            <a href="#/address/${vin.scriptPubKey.addresses[0]}">
                                ${vin.scriptPubKey.addresses[0]}
                            </a>
                            (<a href="#/tx/${vin['txid']}">Output</a>)
                        </div>
                        <div class="col-md-3 col-sm-12 col-xs-12 text-md-right">
                            <small class="text-muted">
                                <span class="text-monospace">${amountFormat(vin.value)}</span> <b>${getApi()['ticker']}</b>
                            </small>
                        </div>
                    </div>
                </div>`

                $('#tx-vin-list').append(content)
            }
        }
    })
}