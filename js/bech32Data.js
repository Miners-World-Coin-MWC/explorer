function bech32Data(addr) {
    var hrp = getApi()['hrp']
    var dec = bech32Decode(addr)
    if (dec === null || dec.hrp !== hrp || dec.data.length < 1 || dec.data[0] > 16) {
        return null
    }

    var res = convertBits(dec.data.slice(1), 5, 8, false)
    if (res === null || res.length < 2 || res.length > 40) {
        return null
    }

    if (dec.data[0] === 0 && res.length !== 20 && res.length !== 32) {
        return null
    }

    return {'version': dec.data[0], 'program': res}
}