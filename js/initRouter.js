function initRouter() {
    routePage()
    window.router = false
    $(window).on('hashchange', routePage)
    if (window.location.hash) {
        if (window.router) {
            $(window).trigger('hashchange')
        }
        window.router = true
    }
}