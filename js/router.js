// SPA router function
function routePage() {
    var urlParams = readParams()
    if (window.location.hash == '') {
        window.location.replace(window.location.href.split('#')[0] + '#/')
    }

    if (urlParams[0] == '#') {
        var pageName = urlParams[1] != '' ? urlParams[1] : 'homepage'
        var templateName = '#' + pageName
        
        if ($('.router-page:visible').attr('id') != urlParams[1]) {
            $('div.router-page').hide()
            if ($(templateName).length) {
                $(templateName).show()
            }
        }

        switch(pageName) {
            // Block info page
            case 'block':
                var block_hash = urlParams[2]
                var api = urlParams[3]
                var data_block_hash = $('#block-info-hash').attr('data-block-info-hash')
                if (block_hash != undefined && block_hash.length == 64) {
                    if (api != undefined) {
                        page = urlParams[1] + '/' + urlParams[2]
                        switchApi(api, page)
                    } else {
                        if (data_block_hash != urlParams[2]) {
                            $('#block-info-tx-total').addClass('d-none')
                            $('#block-info-table').empty()
                            blockInfo(block_hash).then(function(block) {
                                if (block['error'] == undefined) {
                                    setTitle('Block #' + block.result.height)
                                    displayBlockInfo(block.result)
                                } else {
                                    showError(errorMessages['blocks-not-found'])
                                    switchPage()
                                }
                            })
                        } else {
                            setTitle('Block #' + block_hash)
                        }
                    }

                } else {
                    showError(errorMessages['no-block-specified'])
                    switchPage()
                }

                break

            // Transaction info page
            case 'transaction':
                var tx_hash = urlParams[2]
                var api = urlParams[3]
                var data_tx_hash = $('#tx-info-hash').attr('data-tx-info-hash')
                if (tx_hash != undefined) {
                    if (api != undefined) {
                        page = urlParams[1] + '/' + urlParams[2]
                        switchApi(api, page)
                    } else {
                        if (data_tx_hash != urlParams[2]) {
                            $('#tx-info-vout-total').addClass('d-none')
                            $('#tx-info-vin-total').addClass('d-none')
                            $('#tx-info-table').empty()
                            transactionInfo(tx_hash).then(function(tx) {
                                if (tx['error'] == undefined) {
                                    setTitle('Transaction ' + tx_hash)
                                    displayTransactionInfo(tx.result)
                                } else {
                                    showError(errorMessages['tx-not-found'])
                                    switchPage()
                                }
                            })
                        } else {
                            setTitle('Transaction ' + data_tx_hash)
                        }
                    }
                } else {
                    showError(errorMessages['no-tx-specified'])
                    switchPage()
                }

                break

            case 'address':
                var address = urlParams[2]
                var api = urlParams[3]
                var data_address = $('#data-address').attr('data-address')
                if (address != undefined) {
                    if (api != undefined) {
                        page = urlParams[1] + '/' + urlParams[2]
                        switchApi(api, page)
                    } else {
                        if (data_address != urlParams[2]) {
                            $('#address-history').addClass('d-none')
                            $('#address-info-table').empty()
                            addressBalance(address).then(function(data) {
                                if (data['error'] == undefined) {
                                    setTitle('Address ' + address)
                                    displayAddressInfo(data.result, address)
                                } else {
                                    showError(errorMessages['not-valid-address'])
                                    switchPage()
                                }
                            })
                        } else {
                            setTitle('Address ' + data_address)
                        }
                    }
                } else {
                    showError(errorMessages['not-valid-address'])
                    switchPage()
                }

                break

            // Redirect to block page by block height
            case 'height':
                block_height = urlParams[2]
                if (block_height != undefined && isNumeric(block_height)) {
                    blockHeight(urlParams[2]).then(function(block) {
                        setTitle('Loading')
                        if (block['error'] == undefined) {
                            switchPage('block', [block['result']['hash']])
                        } else {
                            showError(errorMessages['blocks-load-error'])
                            switchPage()
                        }
                    })
                } else {
                    showError(errorMessages['nan-error'])
                    switchPage()
                }

                break

            // Home page ¯\_(ツ)_/¯
            case 'homepage':
                setTitle('Latest Blocks')
                displayHome()

                break

            // Swith network to explore
            case 'network':
                network = urlParams[2]
                if (network != undefined) {
                    switchApi(network)
                }

                break

            default:
                switchPage()

                break
        }
    }
}

// Switch router page
function switchPage(url = '', params = []) {
    params = params.length > 0 ? '/' + params.join('/') : ''
    window.location.hash = '#' + '/' + url + params;
}

// Read URL params
function readParams() {
    return window.location.hash.split('/')
}