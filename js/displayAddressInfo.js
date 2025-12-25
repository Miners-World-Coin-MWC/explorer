function displayAddressInfo(data, address) {
    $('#address-transactions').empty()
    content = `
        <div class="card mb-3">
            <div class="table-responsive">
                <table class="table table-borderless table-md table-striped mb-0">
                    <tbody>
                        <tr>
                            <td>Address</td>
                            <td id="data-address" data-address="${address}">
                                ${address}
                                <a href="#" onclick="showQrModal(event, '${address}')">(QR)</a>
                            </td>
                        </tr>
                        <tr>
                            <td>Hash160</td>
                            <td>${hash160(address)}</td>
                        </tr>
                        <tr>
                            <td>Received</td>
                            <td><span class="text-monospace">${amountFormat(data.received)}</span> <b>${getApi()['ticker']}</b></td>
                        </tr>
                        <tr>
                            <td>Balance</td>
                            <td><span class="text-monospace">${amountFormat(data.balance)}</span> <b>${getApi()['ticker']}</b></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`

    $('#address-info-table').html(content)

    const label = addressLabels[address];
    if (label) {
        $('#data-address').append(`<div id="addressLabels" style="margin-top: 10px; font-weight: bold;">Label: ${label}</div>`);
    }

    addressHistory(address).then(function(data) {
        if (data.error == undefined) {
            if (data.result.txcount > 10 && data.result.tx.length >= 10) {
                $('#more-address-transactions').removeClass('d-none')
            } else {
                $('#more-address-transactions').addClass('d-none')
            }

            $('#address-info .address-tx-count').text(data.result.txcount)
            displayTransactions($('#address-transactions'), data.result.tx)
        }
    })
}