function displayHome() {
    networkInfo().then(function(data) {
        var height = data.result.blocks
        var display_height = Number($('#blocks-table tbody tr[data-height]').first().attr('data-height'))

        if (typeof fiatNetworkChanged === 'function') fiatNetworkChanged()
        setSupply(data.result.supply)
        $('#stat-height').removeClass('loading').text(fmtNum(height))
        displayBurn(data.result.supply, height)

        // Only reload the table when there is a new block
        if (height != display_height) {
            getBlocks(height).then(function(blocks) {
                if (blocks['error'] == undefined) {
                    displayBlocks(blocks['result'], true)

                    var chart_data = {
                        'diffs': [],
                        'blocks': [],
                        'sizes': [],
                        'timestamps': [],
                        'txs': [],
                        'nethash': []
                    }

                    // After displayBlocks the list is oldest-first; flip it to newest-first
                    $.each(blocks['result'].reverse(), function(index, block) {
                        chart_data['diffs'].push(block['difficulty'])
                        chart_data['blocks'].push(block['height'])
                        chart_data['sizes'].push(block['size'])
                        chart_data['timestamps'].push(block['time'])
                        chart_data['txs'].push(block['txcount'])
                        chart_data['nethash'].push(block['nethash'])
                    })

                    // Stat tiles (index 0 is the newest block)
                    if (chart_data.blocks.length > 0) {
                        $('#stat-hashrate').removeClass('loading').text(convertHashes(chart_data.nethash[0]))
                        $('#stat-difficulty').removeClass('loading').text(fmtDifficulty(chart_data.diffs[0]))

                        var n = chart_data.timestamps.length
                        if (n > 1) {
                            var avg = (chart_data.timestamps[0] - chart_data.timestamps[n - 1]) / (n - 1)
                            $('#stat-blocktime').text('Avg block time ' + (avg >= 60 ? (avg / 60).toFixed(1) + ' min' : Math.round(avg) + ' sec'))
                        }
                    }

                    displayLatestTransactions(blocks['result'])
                    showCharts(chart_data)
                    refreshAges()
                } else {
                    showError(errorMessages['blocks-load-error'])
                }
            }).catch(function() {
                showError(errorMessages['blocks-load-error'])
            })
        }
    }).catch(function() {
        $('#blocks-table tbody .skeleton-row').first().closest('tbody').html(
            '<tr class="skeleton-row"><td colspan="4" class="text-center text-muted py-4">Could not reach the API. Retrying automatically…</td></tr>'
        )
    })
}
