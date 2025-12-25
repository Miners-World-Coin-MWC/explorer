// Show big error message at the top of the page :D 
function showError(message) {
    $('#error-message').text(message)
    $('#error-message').removeClass('d-none')
    setTimeout(function() {
        $('#error-message').addClass('d-none')
    }, 3400);
}