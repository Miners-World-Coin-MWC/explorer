// Convert satoshis to readable amount
function amountFormat(amount) {
    var decimals = getApi()['decimals']
    return parseFloat((amount / Math.pow(10, decimals)).toFixed(decimals))
}