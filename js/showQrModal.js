function showQrModal(e, text) {
    $('#qrCode').empty()
    $('#qrCode').qrcode(text)
    $('#qrModal .title').text(text)
    $('#qrModal').modal('toggle')
    e.preventDefault()
}