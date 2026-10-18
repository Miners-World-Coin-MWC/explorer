// Convert timestamp to readable date, e.g. "2 Mar 2026, 17:03:09"
function timeFormat(timestamp) {
    var months_arr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    var date = new Date(timestamp * 1000)
    var pad = function(n) { return ('0' + n).slice(-2) }

    return date.getDate() + ' ' + months_arr[date.getMonth()] + ' ' + date.getFullYear() + ', ' +
        pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
}

// Convert timestamp to relative time, e.g. "5 min ago"
function timeAgo(timestamp) {
    var diff = Math.max(0, Math.floor(Date.now() / 1000 - timestamp))

    if (diff < 10) return 'just now'
    if (diff < 60) return diff + ' sec ago'
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago'
    if (diff < 86400) {
        var h = Math.floor(diff / 3600)
        return h + (h == 1 ? ' hour ago' : ' hours ago')
    }
    var d = Math.floor(diff / 86400)
    if (d < 60) return d + (d == 1 ? ' day ago' : ' days ago')
    var m = Math.floor(d / 30)
    if (m < 24) return m + ' months ago'
    return Math.floor(d / 365) + ' years ago'
}
