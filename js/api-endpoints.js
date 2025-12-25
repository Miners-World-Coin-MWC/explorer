// Bocks request
function getBlocks(start, offset = 30) {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/range/' + start + '?offset=' + offset,
    })).then(function(data) {
        return data
    })
}

// Block info
function blockInfo(hash, offset = 0) {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/block/' + hash + '?offset=' + offset,
    })).then(function(data) {
        return data
    })
}

// Get transaction info
function transactionInfo(hash) {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/transaction/' + hash,
    })).then(function(data) {
        return data
    })
}

// Get address balance
function addressBalance(address) {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/balance/' + address,
    })).then(function(data) {
        return data
    })
}

// Get address history
function addressHistory(address, offset = 0) {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/history/' + address + '?offset=' + offset,
    })).then(function(data) {
        return data
    })
}

// Get current network info
function networkInfo() {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/info',
    })).then(function(data) {
        return data
    })
}

// Get circulating supply
function networkSupply() {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/supply',
    })).then(function(data) {
        return data
    })
}

// Get block by height
function blockHeight(height) {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/height/' + height,
    })).then(function(data) {
        return data
    })
}

function loadPeers() {
    return Promise.resolve($.ajax({
        'url': getApi()['api'] + '/peers/',
    })).then(function(data) {
        return data
    })
}