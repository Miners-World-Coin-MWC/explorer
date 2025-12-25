// Convert amount of hashes to readable form
function convertHashes(hashes) {
    if (hashes >= 1000000000000000000000) {
        return (hashes / 1000000000000000000000).toFixed(2) + ' Zh/s'
    } else if (hashes >= 1000000000000000000) {
        return (hashes / 1000000000000000000).toFixed(2) + ' Eh/s'
    } else if (hashes >= 1000000000000000) {
        return (hashes / 1000000000000000).toFixed(2) + ' Ph/s'
    } else if (hashes >= 1000000000000) {
        return (hashes / 1000000000000).toFixed(2) + ' Th/s'
    } else if (hashes >= 1000000000) {
        return (hashes / 1000000000).toFixed(2) + ' Gh/s'
    } else if (hashes >= 1000000) {
        return (hashes / 1000000).toFixed(2) + ' Mh/s'
    } else if (hashes >= 1000) {
        return (hashes / 1000).toFixed(2) + ' Kh/s'
    } else {
        return hashes + ' H/s'
    }
}