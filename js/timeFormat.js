// Convert timestamp to readable date
function timeFormat(timestamp) {	 
    var months_arr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    var date = new Date(timestamp * 1000)
    var year = date.getFullYear()
    var month = months_arr[date.getMonth()]
    var day = date.getDate()
    var hours = date.getHours()
    var minutes = '0' + date.getMinutes()
    var seconds = '0' + date.getSeconds()
    var convdataTime = month + '-' + day + '-' + year + ' ' + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2)

    return convdataTime
}