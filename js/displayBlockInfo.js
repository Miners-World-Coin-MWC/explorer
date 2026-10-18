function displayBlockInfo(data) {
    $('#block-transactions').empty()

    var prev = 'previousblockhash' in data
        ? `<a href="#/block/${esc(data.previousblockhash)}" title="Previous block" aria-label="Previous block"><i class="fa-solid fa-chevron-left"></i></a>`
        : `<span><i class="fa-solid fa-chevron-left"></i></span>`
    var next = data.nextblockhash != undefined
        ? `<a href="#/block/${esc(data.nextblockhash)}" title="Next block" aria-label="Next block"><i class="fa-solid fa-chevron-right"></i></a>`
        : `<span><i class="fa-solid fa-chevron-right"></i></span>`

    var prevRow = 'previousblockhash' in data
        ? `<a href="#/block/${esc(data.previousblockhash)}">${esc(data.previousblockhash)}</a>`
        : `<span class="text-muted">Genesis block</span>`
    var nextRow = data.nextblockhash != undefined
        ? `<a href="#/block/${esc(data.nextblockhash)}">${esc(data.nextblockhash)}</a>`
        : `<span class="text-muted">This is the latest block</span>`

    var content = `
        <div class="card kv-card mb-3">
            <div class="kv-head">
                <div>
                    <h2>Block #${fmtNum(data.height)}</h2>
                    <div class="kv-sub">${timeFormat(data.time)} &middot; <span data-age="${esc(data.time)}">${timeAgo(data.time)}</span></div>
                </div>
                <div class="d-flex align-items-center" style="gap:10px">
                    <span class="badge badge-ok">${fmtNum(data.confirmations)} confirmations</span>
                    <span class="kv-nav">${prev}${next}</span>
                </div>
            </div>
            ${kvRow('Block hash', `<span id="block-info-hash" data-block-info-hash="${esc(data.hash)}">${esc(data.hash)}</span>${copyBtn(data.hash)}`, 'mono')}
            ${kvRow('Height', `<span id="block-info-height" data-block-info-height="${esc(data.height)}">${fmtNum(data.height)}</span>`)}
            ${kvRow('Timestamp', `${timeFormat(data.time)} <span class="text-muted">(${esc(data.time)})</span>`)}
            ${kvRow('Transactions', `<span class="pill">${esc(data.txcount)}</span>`)}
            ${kvRow('Previous block', prevRow, 'mono')}
            ${kvRow('Next block', nextRow, 'mono')}
            ${kvRow('Merkle root', `${esc(data.merkleroot)}${copyBtn(data.merkleroot)}`, 'mono')}
            ${kvRow('Difficulty', fmtDifficulty(data.difficulty), 'mono')}
            ${kvRow('Size', `${fmtNum(data.size)} bytes <span class="text-muted">(stripped ${fmtNum(data.strippedsize)})</span>`)}
            ${kvRow('Nonce', esc(data.nonce), 'mono')}
            ${kvRow('Bits', esc(data.bits), 'mono')}
            ${kvRow('Version', esc(data.versionHex), 'mono')}
        </div>`

    $('#block-info-table').html(content)

    $('#block-tx-title').show().html('<span>Transactions</span><small>' + fmtNum(data.txcount) + ' total</small>')
    displayTransactions($('#block-transactions'), data.tx)

    if (data.txcount > $('#block-transactions').children().length) {
        $('#more-block-transactions').removeClass('d-none')
    } else {
        $('#more-block-transactions').addClass('d-none')
    }
}
