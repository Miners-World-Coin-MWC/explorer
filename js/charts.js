function showCharts(data) {
    window.__chartData = data // kept so the chart can be redrawn when the theme changes

    var step = 2

    if ($(document).width() < 576) {
        step = 9
    } else if ($(document).width() < 1200) {
        step = 4
    }

    // Pull colors from the active theme
    var css = getComputedStyle(document.body)
    var v = function(name, fallback) { return (css.getPropertyValue(name) || fallback).trim() || fallback }
    var muted = v('--text-muted', '#8b95a5')
    var grid = v('--border-soft', '#1e2733')
    var card = v('--bg-card', '#121821')
    var text = v('--text-main', '#e6e9ef')
    var colors = {
        hash: v('--accent', '#f5a524'),
        diff: v('--info', '#60a5fa'),
        txs: v('--ok', '#34d399'),
        size: '#a78bfa'
    }

    var hidden = function(opposite) {
        return { 'labels': { 'enabled': false }, 'title': { 'text': null }, 'gridLineWidth': 0, 'opposite': !!opposite }
    }

    $('#charts').removeClass('d-none')
    Highcharts.chart('network-chart', {
        'chart': {
            'type': 'spline',
            'height': 260,
            'backgroundColor': 'transparent',
            'marginLeft': 8,
            'marginRight': 8,
            'spacingTop': 8,
            'spacingBottom': 8,
            'style': { 'fontFamily': 'Inter, sans-serif' }
        },
        'title': { 'text': '' },
        'credits': { 'enabled': false },
        'exporting': { 'enabled': false },
        'accessibility': { 'description': 'Difficulty, transactions, block size and network hashrate over the last 30 blocks.' },
        'legend': {
            'itemStyle': { 'color': muted, 'fontWeight': '500', 'fontSize': '12px' },
            'itemHoverStyle': { 'color': text }
        },
        'xAxis': [{
            'categories': [].concat(data['blocks']).reverse(),
            'crosshair': { 'color': grid, 'width': 1 },
            'lineColor': grid,
            'tickColor': grid,
            'labels': { 'enabled': true, 'step': step, 'style': { 'color': muted, 'fontSize': '11px' } }
        }],
        'yAxis': [hidden(), hidden(), hidden(true), hidden(), hidden()],
        'tooltip': {
            'shared': true,
            'backgroundColor': card,
            'borderColor': grid,
            'style': { 'color': text },
            formatter: function() {
                var s = '<b>Block ' + this.x + '</b>'

                $.each(this.points, function(i, point) {
                    var value = point.y
                    if (point.series.name == 'Network hashrate') {
                        value = convertHashes(point.y)
                    } else if (point.series.name == 'Size') {
                        value = fmtNum(point.y) + ' B'
                    } else if (point.series.name == 'Difficulty') {
                        value = fmtDifficulty(point.y)
                    } else {
                        value = fmtNum(point.y, 2)
                    }

                    s += '<br/><span style="color:' + point.color + '">\u25CF</span> ' + point.series.name + ': <b>' + value + '</b>'
                })

                return s
            }
        },
        'plotOptions': {
            'series': {
                'animation': false,
                'lineWidth': 2,
                'marker': { 'enabled': false, 'states': { 'hover': { 'enabled': true, 'radius': 3 } } }
            }
        },
        'series': [{
            'name': 'Difficulty',
            'data': [].concat(data['diffs']).reverse(),
            'yAxis': 1,
            'color': colors.diff,
            'type': 'areaspline',
            'fillOpacity': 0.12
        }, {
            'name': 'Transactions',
            'data': [].concat(data['txs']).reverse(),
            'yAxis': 2,
            'color': colors.txs
        }, {
            'name': 'Size',
            'data': [].concat(data['sizes']).reverse(),
            'yAxis': 3,
            'color': colors.size
        }, {
            'name': 'Network hashrate',
            'data': [].concat(data['nethash']).reverse(),
            'yAxis': 4,
            'color': colors.hash
        }],
        'responsive': {
            'rules': [{
                'condition': { 'maxWidth': 500 },
                'chartOptions': {
                    'legend': { 'layout': 'horizontal', 'align': 'center', 'verticalAlign': 'bottom' }
                }
            }]
        }
    })
}
