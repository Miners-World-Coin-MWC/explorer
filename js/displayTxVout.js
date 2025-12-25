function displayTxVout(vout_list, fee = 0) {
    vout_list.forEach(function(vout, index) {
        if ($('#tx-vout-list').find(`[data-tx-vout-index="${index}"]`).length == 0) {
            if (vout.scriptPubKey.type != 'nulldata') {
                var content = `
                    <a href="#/address/${vout.scriptPubKey.addresses[0]}" data-tx-vout-index="${vout.vout_index}" class="list-group-item list-group-item-action flex-column align-items-start">
                        <div class="row">
                            <div class="col-md-9 col-sm-12 col-xs-12">
                                <span class="text-muted mr-1">
                                    <span class="entypo down text-success"></span>
                                </span>
                                <span class="text-primary">${vout.scriptPubKey.addresses[0]}</span>
                            </div>
                            <div class="col-md-3 col-sm-12 col-xs-12 text-md-right">
                                <small class="text-muted">
                                    <span class="text-monospace">${amountFormat(vout.value)}</span> <b>${getApi()['ticker']}</b>
                                </small>
                            </div>
                        </div>
                    </a>`

                $('#tx-vout-list').append(content)
            } else {
                var content = `
                    <li class="list-group-item">
                        <code>${vout.scriptPubKey.asm}</code>
                    </li>
                `

                $('#tx-vout-list').append(content)
            }
        }
    })

    if (fee > 0) {
        $('#tx-vout-list').append(`
            <li class="list-group-item">
                <b>Total fee:</b>
                <small class="float-right text-muted">
                    <span class="text-monospace">${amountFormat(fee)}</span> <b>${getApi()['ticker']}</b>
                </small>
            </li>
        `)
    }
}