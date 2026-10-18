// Light / dark theme toggle (saved choice wins, otherwise follow the system)
(function() {
    var btn = document.getElementById('themeToggle')
    if (!btn) return

    var saved = null
    try { saved = localStorage.getItem('mwc-theme') } catch (e) {}

    var light = saved ? saved === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches
    document.body.classList.toggle('light', light)

    btn.addEventListener('click', function() {
        var isLight = document.body.classList.toggle('light')
        try { localStorage.setItem('mwc-theme', isLight ? 'light' : 'dark') } catch (e) {}

        // Redraw the chart so it picks up the new colors
        if (window.__chartData && typeof showCharts === 'function') {
            showCharts(window.__chartData)
        }
    })
})()
