function displayHome() {
    $('#supply span').text('Loading...')
    networkInfo().then(function(data) {
        var height = data.result.blocks
        var display_height = Number($('#blocks-table tbody tr:first-child').attr('data-height'))

        circulatingSupply = parseInt(amountFormat(data.result.supply))
        $('#supply span').text(circulatingSupply.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ' + getApi()['ticker']);

        if (height != display_height || $('#blocks-table tbody tr').length > 0) {
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

                    $.each(blocks['result'].reverse(), function(index, block) {
                        chart_data['diffs'].push(block['difficulty'])
                        chart_data['blocks'].push(block['height'])
                        chart_data['sizes'].push(block['size'])
                        chart_data['timestamps'].push(block['time'])
                        chart_data['txs'].push(block['txcount'])
                        chart_data['nethash'].push(block['nethash'])
                    })

                    showCharts(chart_data)
                } else {
                    showError(errorMessages['blocks-load-error'])
                }
            })
        }
    })
}