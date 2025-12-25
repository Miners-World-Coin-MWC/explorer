function displayHistory(address, history_list) {
    var total = $('#address-history .card-header b').text()
    history_list.forEach(function(tx_info, index) {
        if ($('#address-history-list').find(`[data-address-history-index="${tx_info.tx_index}"]`).length == 0) {
            var content = `
                <a href="#/tx/${tx_info.data.txid}" data-address-history-index="${tx_info.tx_index}" class="list-group-item list-group-item-action flex-column align-items-start">
                    <div class="row">
                        <div class="col-md-9 col-sm-12 col-xs-12">
                            <!-- <span class="text-muted mr-1">
                                <span class="entypo up text-danger"></span>
                            </span> -->
                            <span class="text-primary">${tx_info.data.txid}</span>
                        </div>
                        <div class="col-md-3 col-sm-12 col-xs-12 text-md-right">
                            <small class="text-muted">
                                ${tx_info.data.height > 0 ? '#' + tx_info.data.height : 'Mempool'}
                            </small>
                        </div>
                    </div>
                </a>`

            $('#address-history-list').append(content)
        }
    })
}