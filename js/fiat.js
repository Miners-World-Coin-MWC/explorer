// Fiat values for transactions, at TODAY's price (one price for the whole page, refreshed every couple of minutes).
// Price source: CoinPaprika, with LiveCoinWatch as the backup. Nothing is shown if neither answers.
var FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'BTC']
var fiat = { currency: 'USD', price: null, priceCurrency: null, requestId: 0 }

try {
    var savedCurrency = localStorage.getItem('mwc-currency')
    if (savedCurrency && FIAT_CURRENCIES.indexOf(savedCurrency) !== -1) fiat.currency = savedCurrency
} catch (e) {}

function fiatValidPrice(value) {
    var price = Number(value)
    return isFinite(price) && price > 0 ? price : null
}

// CoinPaprika only returns USD unless the currency is requested with ?quotes=
function fiatFromCoinPaprika(currency) {
    return fetch('https://api.coinpaprika.com/v1/tickers/mwc-minersworldcoin?quotes=' + encodeURIComponent(currency))
        .then(function(res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json() })
        .then(function(data) { return fiatValidPrice(data && data.quotes && data.quotes[currency] && data.quotes[currency].price) })
        .catch(function() { return null })
}

// MinersWorldCoin is listed as "__MWC" on LiveCoinWatch (plain "MWC" is a different coin)
function fiatFromLiveCoinWatch(currency) {
    return fetch('https://api.livecoinwatch.com/coins/single', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': window.LCW_API_KEY || '9d7d070a-a798-4a0e-a8ec-e0391b5392c9' },
        body: JSON.stringify({ currency: currency, code: '__MWC', meta: true })
    }).then(function(res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json() })
        .then(function(data) { return fiatValidPrice(data && data.rate) })
        .catch(function() { return null })
}

// Enough decimals to show about 3 significant digits of a small number (never fewer than `base`)
function fiatDecimals(value, base) {
    if (!(value > 0) || value >= 1) return base
    return Math.min(18, Math.max(base, 3 - Math.floor(Math.log10(value))))
}

function fiatFormat(value, currency, base) {
    base = base || 2
    if (currency === 'BTC') {
        return '\u20BF' + value.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: fiatDecimals(value, 8) })
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.max(2, value >= 1 ? 2 : fiatDecimals(value, Math.max(4, base)))
    }).format(value)
}

function fiatReady() { return fiat.price !== null && fiat.priceCurrency === fiat.currency }

function fiatText(satoshis) {
    var sat = Number(satoshis)
    if (!fiatReady() || satoshis == null || !isFinite(sat)) return ''
    return '\u2248 ' + fiatFormat(sat / 1e8 * fiat.price, fiat.currency)
}

function fiatTitle() {
    return fiatReady() ? 'Value at today\'s price: 1 ' + getApi()['ticker'] + ' = ' + fiatFormat(fiat.price, fiat.currency, 8) : ''
}

// Markup for a fiat value. It is filled in (and kept up to date) by refreshFiat().
function fiatHtml(satoshis) {
    if (satoshis == null || !isFinite(Number(satoshis))) return ''
    return '<span class="fiat" data-sat="' + esc(satoshis) + '" title="' + esc(fiatTitle()) + '">' + esc(fiatText(satoshis)) + '</span>'
}

function refreshFiat() {
    var title = fiatTitle()
    $('.fiat[data-sat]').each(function() {
        $(this).text(fiatText($(this).attr('data-sat'))).attr('title', title)
    })
}

function updateFiatPrice() {
    var id = ++fiat.requestId
    var currency = fiat.currency
    return fiatFromCoinPaprika(currency).then(function(price) {
        return price !== null ? price : fiatFromLiveCoinWatch(currency)
    }).then(function(price) {
        if (id !== fiat.requestId) return // the currency changed meanwhile: drop this answer
        if (price !== null) {
            fiat.price = price
            fiat.priceCurrency = currency
        } else if (fiat.priceCurrency !== currency) {
            fiat.price = null
        }
        refreshFiat()
    })
}

$(document).ready(function() {
    var select = $('#currencySelect')
    select.val(fiat.currency)
    select.on('change', function() {
        var chosen = $(this).val()
        if (FIAT_CURRENCIES.indexOf(chosen) === -1) return
        fiat.currency = chosen
        try { localStorage.setItem('mwc-currency', chosen) } catch (e) {}
        refreshFiat() // clears values until the price for the new currency arrives (never shows a value in the wrong currency)
        updateFiatPrice()
    })
    updateFiatPrice()
    window.setInterval(updateFiatPrice, 120000)
})
