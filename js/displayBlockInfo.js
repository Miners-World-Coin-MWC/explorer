function displayBlockInfo(data) {
    $('#block-transactions').empty()
    content = `
        <div class="card mb-3">
            <div class="table-responsive">
                <table class="table table-borderless table-md table-striped mb-0">
                    <tbody>
                        <tr>
                            <td>Height</td>
                            <td id="block-info-height" data-block-info-height="${data.height}">${data.height} (<b>Confirmations ${data.confirmations}</b>)</td>
                        </tr>
                        <tr>
                            <td>Timestamp</td>
                            <td>${timeFormat(data.time)} (<b>${data.time}</b>)</td>
                        </tr>
                        <tr>
                            <td>Block Hash</td>
                            <td id="block-info-hash" data-block-info-hash="${data.hash}">${data.hash}</td>
                        </tr>
                        <tr>
                            <td>Previous Block</td>
                            <td>
                                <a class="${'previousblockhash' in data ? '' : 'd-none'}" href="#/block/${data.previousblockhash}">${data.previousblockhash}</a>
                                <span class=${'previousblockhash' in data ? 'd-none' : ''}>
                                    <b>Genesis Block</b>
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td>Next Block</td>
                            <td>
                                ${data.nextblockhash != undefined ? `
                                    <a href="#/block/${data.nextblockhash}">
                                        ${data.nextblockhash}
                                    </a>
                                ` : `
                                    <b>This is latest block</b>
                                `}
                            </td>
                        </tr>
                        <tr>
                            <td>Merkle Root</td>
                            <td>
                                ${data.merkleroot}
                            </td>
                        </tr>
                        <tr>
                            <td>Nonce</td>
                            <td>${data.nonce}</td>
                        </tr>
                        <tr>
                            <td>Version</td>
                            <td>${data.versionHex}</td>
                        </tr>
                        <tr>
                            <td>Bits</td>
                            <td>${data.bits}</td>
                        </tr>
                        <tr>
                            <td>Size</td>
                            <td>${data.size} Bytes</td>
                        </tr>
                        <tr>
                            <td>Stripped Size</td>
                            <td>${data.strippedsize} Bytes</td>
                        </tr>
                        <tr>
                            <td>Difficulty</td>
                            <td>${data.difficulty}</td>
                        </tr>
                        <tr>
                            <td>Transactions</td>
                            <td>${data.txcount}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`

    $('#block-info-table').html(content)

    displayTransactions($('#block-transactions'), data.tx)

    if (data.txcount > $('#block-transactions').children().length) {
        $('#more-block-transactions').removeClass('d-none')
    } else {
        $('#more-block-transactions').addClass('d-none')
    }

    $('#block-info-tx-total').removeClass('d-none')
}