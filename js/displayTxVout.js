function displayTxVout(vout_list, fee = 0, txid = '') {
    vout_list.forEach(function(vout, index) {
        if ($('#tx-vout-list').find(`[data-tx-vout-index="${index}"]`).length == 0) {
            var spk = vout.scriptPubKey || {}

            if (spk.type == 'nulldata') {
                // Game-asset payloads (Miners World: Onchain Adventures) render
                // as decoded NFT cards; everything else stays raw data.
                var ga = (typeof decodeGameAssetOutput === 'function') ? decodeGameAssetOutput(spk) : null
                if (ga) {
                    // This is a FRESH decode — on re-renders, pull in the
                    // already-fetched registry data (name/rarity/verified
                    // commitment) so the card doesn't fall back to hash-only.
                    if (typeof applyCachedRegistryData === 'function') applyCachedRegistryData(txid, ga)
                    $('#tx-vout-list').append(gameAssetVoutHtml(ga, { index: index, txid: txid }))
                } else {
                    $('#tx-vout-list').append(`
                        <div class="list-group-item" data-tx-vout-index="${index}">
                            <span class="text-muted mr-2">Data</span><code>${esc(spk.asm)}</code>
                        </div>`)
                }
            } else if (spk.addresses != undefined) {
                $('#tx-vout-list').append(`
                    <a href="#/address/${esc(spk.addresses[0])}" data-tx-vout-index="${index}" class="list-group-item list-group-item-action">
                        <div class="io-row">
                            <span class="io-left"><span class="io-dot out"></span><span class="io-addr" title="${esc(spk.addresses[0])}">${esc(spk.addresses[0])}</span></span>
                            <span class="io-amt">${amountHtml(vout.value)}${fiatHtml(vout.value)}</span>
                        </div>
                    </a>`)
            } else {
                $('#tx-vout-list').append(`
                    <div class="list-group-item" data-tx-vout-index="${index}">
                        <div class="io-row">
                            <span class="io-left"><span class="io-dot out"></span><span class="io-addr text-muted">Non-standard output</span></span>
                            <span class="io-amt">${amountHtml(vout.value)}${fiatHtml(vout.value)}</span>
                        </div>
                    </div>`)
            }
        }
    })

    collapseList('#tx-vout-list', '[data-tx-vout-index]', 50)

    if (fee > 0) {
        $('#tx-vout-list').append(`
            <div class="list-group-item io-fee">
                <span>Fee</span>
                <span class="io-amt">${amountHtml(fee)}${fiatHtml(fee)}</span>
            </div>`)
    }
}
