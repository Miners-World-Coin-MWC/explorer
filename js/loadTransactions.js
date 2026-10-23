function loadTransactions(holder) {
    holder.find('[data-transaction][data-transaction-loaded=false]').each(function() {
        var tx = $(this)
        // Mark immediately so a second call doesn't fetch the same transaction twice
        tx.attr('data-transaction-loaded', 'loading')

        var fail = function(reason) {
            tx.attr('data-transaction-loaded', 'false')
            if (tx.find('.tx-unavailable').length == 0) {
                tx.find('.card-body').append(
                    '<div class="tx-unavailable"><span><i class="fa-solid fa-triangle-exclamation"></i> ' + reason + '</span>' +
                    '<a href="#" class="tx-retry">Retry</a></div>')
            }
        }

        transactionInfo(tx.attr('data-transaction'), true).then(function(data) {
            if (data.error == undefined) {
                tx.find('.tx-unavailable').remove()
                tx.find('.transaction-time').text(timeFormat(data.result.time)).removeClass('d-none')
                tx.find('.transaction-fiat').html(fiatHtml(data.result.amount))

                var status = parseTransactionDetails(data.result)

                if (status.hide) {
                    tx.addClass('d-none')
                } else {
                    tx.find('.transaction-from').removeClass('d-none')
                    tx.find('.transaction-to').removeClass('d-none')

                    if (status.badge.text) {
                        tx.find('.transaction-badge .badge').text(status.badge.text).addClass(status.badge.class).removeClass('d-none')
                    }

                    tx.find('.transaction-from ul').append(status.from)
                    tx.find('.transaction-to ul').append(status.to)
                }

                tx.attr('data-transaction-loaded', 'true')
            } else {
                fail('The API has no record of this transaction.')
            }
        }).catch(function() {
            fail('Could not load this transaction (the API did not respond in time).')
        })
    })
}
