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

    var inputs = {}
    var outputs = {}
    var ticker = esc(getApi()['ticker'])

    var labelOf = function(address) {
        var label = (typeof addressLabels !== 'undefined') ? addressLabels[address] : undefined
        return label ? ' <span class="addr-label" style="margin:0 0 0 6px">' + esc(label) + '</span>' : ''
    }

    var row = function(address, amount, dot) {
        return `
            <a class="list-group-item list-group-item-action io-row" href="#/address/${esc(address)}">
                <span class="io-left"><span class="io-dot ${dot}"></span><span class="io-addr" title="${esc(address)}">${esc(address)}</span>${labelOf(address)}</span>
                <span class="io-amt">${esc(amountFormat(amount))} <b>${ticker}</b></span>
            </a>`
    }

    data.vin.forEach(function(vin) {
        if (vin.coinbase != undefined) {
            status.coinbase = true
            status.from += `
                <li class="list-group-item">
                    Newly generated coins <span class="badge badge-coinbase ml-1">Coinbase</span>
                </li>`
        } else if (vin.value != undefined) {
            var address = vin.scriptPubKey && vin.scriptPubKey.addresses ? vin.scriptPubKey.addresses[0] : 'Non-standard input'

            inputs[address] = (inputs[address] || 0) + vin.value
            status.input += vin.value
        }
    })

    for (var inAddress in inputs) {
        status.from += row(inAddress, inputs[inAddress], 'in')
    }

    data.vout.forEach(function(vout) {
        if (vout.value != undefined) {
            if (vout.scriptPubKey.addresses != undefined) {
                var address = vout.scriptPubKey.addresses[0]
                outputs[address] = (outputs[address] || 0) + vout.value
            }

            status.output += vout.value
        }
    })

    for (var outAddress in outputs) {
        status.to += row(outAddress, outputs[outAddress], 'out')
    }

    if (!status.coinbase) {
        status.fee = status.input - status.output
        status.to += `
            <li class="list-group-item io-fee">
                <span>Fee</span>
                <span class="mono">${esc(amountFormat(status.fee))} <b>${ticker}</b></span>
            </li>`
    }

    if (status.coinbase) {
        status.badge.text = 'Coinbase'
        status.badge.class = 'badge-coinbase'
    }

    return status
}
