function displayAddressInfo(data, address) {
    $('#address-transactions').empty()
    $('#address-tx-title').hide()

    var h160 = '–'
    try { h160 = hash160(address) } catch (e) {}

    var label = (typeof addressLabels !== 'undefined') ? addressLabels[address] : undefined

    var content = `
        <div class="card kv-card mb-3">
            <div class="kv-head">
                <div style="min-width:0">
                    <h2>Address</h2>
                    ${label ? `<span class="addr-label"><i class="fa-solid fa-tag"></i> ${esc(label)}</span>` : ''}
                </div>
                <button type="button" class="btn btn-sm btn-outline-dark" data-qr="${esc(address)}"><i class="fa-solid fa-qrcode"></i> QR code</button>
            </div>
            <div class="balance-hero">
                <div>
                    <div class="stat-label"><i class="fa-solid fa-wallet"></i> Balance</div>
                    <div class="stat-value">${esc(amountFormat(data.balance))} <span class="text-muted" style="font-size:14px">${esc(getApi()['ticker'])}</span></div>
                </div>
                <div>
                    <div class="stat-label"><i class="fa-solid fa-arrow-down"></i> Total received</div>
                    <div class="stat-value">${esc(amountFormat(data.received))} <span class="text-muted" style="font-size:14px">${esc(getApi()['ticker'])}</span></div>
                </div>
                <div>
                    <div class="stat-label"><i class="fa-solid fa-right-left"></i> Transactions</div>
                    <div class="stat-value" id="address-tx-count">&ndash;</div>
                </div>
            </div>
            ${kvRow('Address', `<span id="data-address" data-address="${esc(address)}">${esc(address)}</span>${copyBtn(address)}`, 'mono')}
            ${kvRow('Hash160', `${esc(h160)}${h160 != '–' ? copyBtn(h160) : ''}`, 'mono')}
        </div>`

    $('#address-info-table').html(content)

    addressHistory(address).then(function(data) {
        if (data.error == undefined) {
            if (data.result.txcount > 10 && data.result.tx.length >= 10) {
                $('#more-address-transactions').removeClass('d-none')
            } else {
                $('#more-address-transactions').addClass('d-none')
            }

            $('#address-tx-count').text(fmtNum(data.result.txcount))
            $('#address-tx-title').show().html('<span>Transactions</span><small>' + fmtNum(data.result.txcount) + ' total</small>')
            displayTransactions($('#address-transactions'), data.result.tx)
        }
    })
}
