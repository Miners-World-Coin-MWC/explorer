// Get current network config
function getApi() {
    var network = readCookie('network')
    if (network == null || networksConfigs[network] == undefined) {
        setCookie('network', Object.keys(networksConfigs)[0], 60)
        network = readCookie('network')
    }

    return networksConfigs[network]
}

// Switch network
function switchApi(network, page = '') {
    network = network.toUpperCase()
    if (networksConfigs[network] != undefined & networksConfigs[network] != getApi()) {
        setCookie("network", network, 60)
        $('#blocks-table tbody').empty()
        $('#block-info-hash').empty()
        $('#data-address').empty()
        $('#tx-info-hash').empty()
        $('#charts').addClass('d-none')
        displayNetworks()
        displayHome()
    }
    switchPage(page)
}

// Display networks list
function displayNetworks() {
    network = getApi()
    $('#network-versions').text(network['name'])
    $('#network-list .dropdown-menu').empty()

    for (var key in networksConfigs) {
        $('#network-list .dropdown-menu').append(`<a class="dropdown-item ${networksConfigs[key]['name'] == network['name'] ? 'active' : ''}" href="#/network/${key}">${networksConfigs[key]['name']}</a>`)
    }
}