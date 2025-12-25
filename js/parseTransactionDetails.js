function parseTransactionDetails(data) {
    var status = {
        'coinbase': false,
        'input': 0,
        'output': 0,
        'fee': 0,
        'from': '',
        'to': '',
        'badge': {
            'text': '',
            'class': ''
        }
    }

    inputs = {}
    outputs = {}

    data.vin.forEach(function(vin, index) {
        if (vin.coinbase != undefined) {
            status.coinbase = true
            status.from += `
                <li class="list-group-item">
                    Newly Generated Coins (<b>Coinbase Transaction</b>)
                </li>`
        } else if (vin.value != undefined) {
            var address = vin.scriptPubKey.addresses[0]

            if (address in inputs) {
                inputs[address] += vin.value
            } else {
                inputs[address] = vin.value
            }

            status.input += vin.value
        }
    })

    for (address in inputs) {
        var transfer_amount = amountFormat(inputs[address]) + ' <b>' + getApi()['ticker'] + '</b>'

        content = `
            <a class="list-group-item list-group-item-action" href="#/address/${address}">
                <span class="entypo up text-danger"></span>
                <span class="text-primary">${address}</span>
                <small class="float-right text-muted">
                    <span class="text-monospace">${transfer_amount}</span>
                </small>
            </a>`

        status.from += content
    }

    data.vout.forEach(function(vout, index) {
        if (vout.value != undefined) {
            if (vout.scriptPubKey.addresses != undefined) {
                var address = vout.scriptPubKey.addresses[0]

                if (address in outputs) {
                    outputs[address] += vout.value
                } else {
                    outputs[address] = vout.value
                }
            }

            status.output += vout.value
        }
    })

    for (address in outputs) {
        var transfer_amount = amountFormat(outputs[address]) + ' <b>' + getApi()['ticker'] + '</b>'

        content = `
            <a class="list-group-item list-group-item-action" href="#/address/${address}">
                <span class="entypo down text-success"></span>
                <span class="text-primary">${address}</span>
                <small class="float-right text-muted">
                    <span class="text-monospace">${transfer_amount}</span>
                </small>
            </a>`

        status.to += content
    }

    if (!status.coinbase) {
        status.fee = status.input - status.output
        content = `
            <li class="list-group-item">
                <b>Total fee:</b>
                <small class="float-right text-muted">
                    <span class="text-monospace">${amountFormat(status.fee)}</span> <b>${getApi()['ticker']}</b>
                </small>
            </li>`

        status.to += content
    }

    if (status.coinbase) {
        status.badge.text = 'Coinbase'
        status.badge.class = 'badge-primary'
    }

    return status
}