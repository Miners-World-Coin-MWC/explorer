// Decode base58 encoded string to byte array
function base58Data(string) {
    bs58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var bs58AlphabetMap = {}
    var base = bs58Alphabet.length
    var leader = bs58Alphabet.charAt(0)

    for (var i = 0; i < bs58Alphabet.length; i++) {
        bs58AlphabetMap[bs58Alphabet.charAt(i)] = i
    }

    if (string.length === 0) return []

    var bytes = [0]
    for (var i = 0; i < string.length; i++) {
        var value = bs58AlphabetMap[string[i]]
        if (value === undefined) throw new Error('Non-base' + base + ' character')

        var carry = bytes[0] * base + value
        bytes[0] = carry & 0xff
        carry >>= 8

        for (var j = 1; j < bytes.length; ++j) {
            carry += bytes[j] * base
            bytes[j] = carry & 0xff
            carry >>= 8
        }

        while (carry > 0) {
            bytes.push(carry & 0xff)
            carry >>= 8
        }
    }

    for (var k = 0; string[k] === leader && k < string.length - 1; ++k) {
        bytes.push(0)
    }

    return bytes.reverse()
}