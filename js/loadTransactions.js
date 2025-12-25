function loadTransactions(holder) {
    holder.find('[data-transaction][data-transaction-loaded=false]').each(function() {
        var tx = $(this)
        transactionInfo(tx.attr('data-transaction'), true).then(function(data) {
            if (data.error == undefined) {
                tx.find('.transaction-time').text(timeFormat(data.result.time)).removeClass('d-none')

                var status = parseTransactionDetails(data.result)

                if (status.hide) {
                    tx.addClass('d-none')
                } else {
                    tx.find('hr').removeClass('d-none')
                    tx.find('.transaction-from').removeClass('d-none')
                    tx.find('.transaction-to').removeClass('d-none')

                    tx.find('.transaction-badge .badge').text(status.badge.text).removeClass('d-none')
                    tx.find('.transaction-badge .badge').addClass(status.badge.class)
                    tx.find('.transaction-badge').removeClass('d-none')

                    tx.find('.transaction-from ul').append(status.from)
                    tx.find('.transaction-to ul').append(status.to)
                }

                tx.attr('data-transaction-loaded', true)
            }
        })
    })
}