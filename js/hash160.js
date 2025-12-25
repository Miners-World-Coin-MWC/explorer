function hash160(string) {
    try {
        var result = hexString(base58Data(string)) 
        return result.substring(2, result.length - 8)
    } catch {
        var result = hexString(bech32Data(string).program) 
        return result
    }
}