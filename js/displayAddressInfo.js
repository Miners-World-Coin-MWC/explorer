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

    // On-chain game assets custodied by this address (per-player control
    // address from the game registry snapshot). Chain stays the authority —
    // every card links to the anchoring transaction for verification.
    try {
        if (window.GA_PROTOCOL && typeof window.GA_PROTOCOL.loadSnapshot === 'function') {
            window.GA_PROTOCOL.loadSnapshot().then(function (snap) {
                var entries = (snap && snap.entries) || {}
                var assets = []
                Object.keys(entries).forEach(function (txid) {
                    var reg = entries[txid] && entries[txid].registry && entries[txid].registry.asset
                    if (reg && reg.controlAddress === address && !assets.some(function (a) { return a.assetId === reg.assetId })) {
                        assets.push(reg)
                    }
                })
                if (!assets.length) return
                var gameBase = (typeof GAME_API_BASE === 'string' ? GAME_API_BASE : '').replace(/\/+$/, '')
                var icon = function (cat) { return cat === 'creature' ? '🐾' : (cat === 'badge' || cat === 'trophy') ? '🏅' : '🎁' }
                var rows = assets.map(function (a) {
                    var burned = /BURN/i.test(String(a.status || ''))
                    return '<div class="list-group-item io-row">' +
                        '<a class="io-addr" href="#/transaction/' + esc(a.mintTxid || '') + '" title="Mint transaction">' + icon(a.category) + ' <b>' + esc(a.name || a.assetId) + '</b></a>' +
                        (a.rarity ? ' <span class="ga-rarity ga-r-' + esc(String(a.rarity).toLowerCase()) + '">' + esc(a.rarity) + '</span>' : '') +
                        (burned ? ' <span class="ga-type ga-e-burn">burned</span>' : ' <span class="ga-type ga-e-mint">active</span>') +
                        (a.nonTransferable ? ' <span class="ga-soulbound">soul-bound</span>' : '') +
                        (/^MWC1-/i.test(String(a.assetId)) ? ' <span class="ga-legacy">legacy</span>' : '') +
                        '<div class="mono text-muted" style="font-size:11px">' + esc(a.assetId) +
                        (gameBase ? ' · <a href="' + esc(gameBase + '/api/assets/' + encodeURIComponent(a.assetId)) + '" target="_blank" rel="noopener" style="text-decoration:underline">asset page ↗</a>' : '') + '</div></div>'
                }).join('')
                var card = '<div class="card kv-card mb-3" id="address-game-assets">' +
                    '<div class="kv-head"><h2>Game assets <span class="pill" style="font-size:11px;vertical-align:middle">' + assets.length + '</span></h2>' +
                    '<a class="btn btn-sm btn-outline-dark" href="assets.html">All assets</a></div>' +
                    '<div class="list-group">' + rows + '</div>' +
                    '<div class="card-body py-2 text-muted" style="font-size:12px">On-chain game assets custodied by this address (Miners World control UTXOs). Names link to the mint transaction.</div></div>'
                $('#address-game-assets').remove()
                $('#address-info-table').after(card)
            }).catch(function () { /* snapshot unavailable — stay silent */ })
        }
    } catch (e) { /* gameasset lib missing — address page still works */ }

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
