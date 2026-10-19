// Shared UI helpers (escaping, number formatting, copy buttons)

// Escape untrusted text before putting it into HTML
function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// 1234567.891 -> "1,234,567.89"
function fmtNum(value, maxDecimals) {
    var n = Number(value)
    if (!isFinite(n)) return '–'
    return n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals == undefined ? 0 : maxDecimals })
}

// Difficulty: keeps ~3 significant digits for small values (0.0001, 0.2) and
// uses plain thousands separators for large ones (1,236.57)
function fmtDifficulty(value) {
    var n = Number(value)
    if (!isFinite(n)) return '–'
    if (n === 0) return '0'

    var a = Math.abs(n)
    var decimals
    if (a >= 1000) {
        decimals = 2
    } else if (a >= 1) {
        decimals = 4
    } else {
        decimals = Math.min(12, Math.max(4, 2 - Math.floor(Math.log10(a))))
    }

    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

// Small copy-to-clipboard button
function copyBtn(text) {
    return '<button type="button" class="copy-inline" data-copy="' + esc(text) + '" title="Copy" aria-label="Copy to clipboard"><i class="fa-regular fa-copy"></i></button>'
}

// Amount + ticker, e.g. "12.5 MWC"
function amountHtml(satoshis) {
    return '<span class="mono">' + esc(amountFormat(satoshis)) + ' <b>' + esc(getApi()['ticker']) + '</b></span>'
}

// Key/value row used on detail pages
function kvRow(key, valueHtml, extraClass) {
    return '<div class="kv-row"><div class="kv-key">' + key + '</div><div class="kv-val ' + (extraClass || '') + '">' + valueHtml + '</div></div>'
}

// Update all "x ago" labels
function refreshAges() {
    $('[data-age]').each(function() {
        $(this).text(timeAgo(Number($(this).attr('data-age'))))
    })
}

// Delegated handlers for copy + QR buttons
$(document).on('click', '.copy-inline[data-copy]', function(e) {
    e.preventDefault()
    var btn = $(this)
    var text = btn.attr('data-copy')
    var done = function() {
        btn.addClass('copied').html('<i class="fa-solid fa-check"></i>')
        setTimeout(function() {
            btn.removeClass('copied').html('<i class="fa-regular fa-copy"></i>')
        }, 1400)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function() {})
    } else {
        var ta = $('<textarea>').val(text).css({ position: 'fixed', opacity: 0 }).appendTo('body')
        ta[0].select()
        try { document.execCommand('copy'); done() } catch (err) {}
        ta.remove()
    }
})

$(document).on('click', '[data-qr]', function(e) {
    showQrModal(e, $(this).attr('data-qr'))
})

// "Retry" on a transaction card that failed to load
$(document).on('click', '.tx-retry', function(e) {
    e.preventDefault()
    var card = $(this).closest('[data-transaction]')
    card.find('.tx-unavailable').remove()
    loadTransactions(card.parent())
})

// Very large transactions (1000+ inputs): show the first rows and fold the rest behind a button
function collapseList(list, itemSelector, limit) {
    var items = $(list).find(itemSelector)
    if (items.length <= limit) return
    items.slice(limit).addClass('d-none io-extra')
    $(list).find('.io-show-all').remove()
    items.last().after('<a href="#" class="list-group-item list-group-item-action io-show-all">Show all ' +
        fmtNum(items.length) + ' (' + fmtNum(items.length - limit) + ' more)</a>')
}

$(document).on('click', '.io-show-all', function(e) {
    e.preventDefault()
    $(this).closest('.list-group').find('.io-extra').removeClass('d-none io-extra')
    $(this).remove()
})
