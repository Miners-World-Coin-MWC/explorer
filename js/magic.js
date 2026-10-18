// All starts here
$(document).ready(function() {
    initRouter()
    displayNetworks()
    $('#year').text(new Date().getFullYear())

    // Click the supply tile to refresh the home stats
    $('#supply').click(function() {
        $('#supply .stat-value span').text('Loading...')
        displayHome()
    })

    $('#more').click(function() {
        var height = Number($('tr[data-height]').last().attr('data-height'))
        getBlocks(height).then(function(blocks) {
            if (blocks['error'] == undefined) {
                displayBlocks(blocks['result'])
                refreshAges()
            }
        })
    })

    $('#more-block-transactions').click(function() {
        var btn = $(this)
        var data_block_hash = $('#block-info-hash').text()
        var offset = Number($('#block-transactions [data-transaction-index]').last().attr('data-transaction-index')) + 1
        blockInfo(data_block_hash, offset).then(function(data) {
            if (data.error == undefined) {
                if (data.result.txcount > 10 && data.result.tx.length >= 10) {
                    btn.removeClass('d-none')
                } else {
                    btn.addClass('d-none')
                }

                displayTransactions($('#block-transactions'), data.result.tx, offset)
            }
        })
    })

    $('#more-address-transactions').click(function() {
        var btn = $(this)
        var data_address_link = $('#data-address').attr('data-address')
        var offset = Number($('#address-transactions [data-transaction-index]').last().attr('data-transaction-index')) + 1
        addressHistory(data_address_link, offset).then(function(data) {
            if (data.error == undefined) {
                if (data.result.txcount > 10 && data.result.tx.length >= 10) {
                    btn.removeClass('d-none')
                } else {
                    btn.addClass('d-none')
                }

                displayTransactions($('#address-transactions'), data.result.tx, offset)
            }
        })
    })

    $('#search-form').submit(function(e) {
        var search = $('#search-form input').val().trim()

        if (search != '') {
            if (isNumeric(search)) {
                switchPage('height', [search])
            } else {
                if (search.length == 64) {
                    // 64 hex chars is either a block hash or a transaction id
                    blockInfo(search).then(function(data) {
                        if (data.error == undefined) {
                            switchPage('block', [search])
                        } else {
                            switchPage('transaction', [search])
                        }
                    }).catch(function() {
                        switchPage('transaction', [search])
                    })
                } else if (search.length == 34 || search.substring(0, 5) == getApi()['hrp']) {
                    switchPage('address', [search])
                } else {
                    showError(errorMessages['search-error'])
                }
            }
        }

        $('#search-form input').val('')
        e.preventDefault()
    })

    // Press "/" anywhere to jump to the search box
    $(document).on('keydown', function(e) {
        if (e.key == '/' && !$(e.target).is('input, textarea, select')) {
            e.preventDefault()
            $('#search-field').focus()
        }
    })

    // Live refresh (home page only) + keep "x ago" labels fresh
    window.setInterval(function() {
        if ($('#homepage').is(':visible')) {
            displayHome()
        }
    }, 10000)

    if (typeof refreshAges === 'function') {
        window.setInterval(refreshAges, 15000)
    }
})
