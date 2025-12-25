function displayTransactionInfo(data) {
    content = `
        <div class="card mb-3">
            <div class="table-responsive">
                <table class="table table-borderless table-md table-striped mb-0">
                    <tbody>
                        <tr>
                            <td>Transaction Hash</td>
                            <td id="tx-info-hash" data-tx-info-hash="${data.txid}">${data.txid}</td>
                        </tr>
                        ${data.time != undefined ? `
                            <tr>
                                <td>Timestamp</td>
                                <td>${timeFormat(data.time)} (<b>${data.time}</b>)</td>
                            </tr>
                        ` : ''}
                        <tr>
                            <td>Height</td>
                            <td>
                                ${data.blockhash != undefined ? `
                                    <a href="#/block/${data.blockhash}">${data.height}</a> (<b>Confirmations ${data.confirmations}</b>)
                                ` : `
                                    <span class="text-danger">This transaction located in memory pool and not included to blockchain yet!</span>
                                `}
                            </td>
                        </tr>
                        <tr>
                            <td>Amount Transferred</td>
                            <td><span class="text-monospace">${amountFormat(data.amount)}</span> <b>${getApi()['ticker']}</b></td>
                        </tr>
                        <tr>
                            <td>Size</td>
                            <td>${data.size} (bytes)</td>
                        </tr>
                        <tr>
                            <td>Version</td>
                            <td>${data.version}</td>
                        </tr>
                        <tr class="${data.locktime == 0 ? 'd-none' : ''}">
                            <td>Locktime</td>
                            <td>${data.locktime}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`

    $('#tx-info-table').html(content)
    $('#tx-info-vout-total .card-header b').text(data.vout.length)
    $('#tx-info-vin-total .card-header b').text(data.vin.length)
    $('#tx-vout-list').empty()
    $('#tx-vin-list').empty()

    var vin_amount = 0
    data.vin.forEach(function(vin) {
        vin_amount += vin.value
    })

    var vout_amount = 0
    data.vout.forEach(function(vout) {
        vout_amount += vout.value
    })

    var fee = vin_amount - vout_amount

    displayTxVout(data.vout, fee)
    displayTxVin(data.vin)

    $('#tx-info-vout-total').removeClass('d-none')
    $('#tx-info-vin-total').removeClass('d-none')
}