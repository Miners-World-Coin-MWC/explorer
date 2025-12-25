function showCharts(data) {
    var step = 2

    if ($(document).width() < 576) {
        step = 9
    } else if ($(document).width() < 1200) {
        step = 4
    }

    $('#charts').removeClass('d-none')
    Highcharts.chart('network-chart', {
        'chart': {
            'type': 'spline',
            'height': 240,
            'marginLeft': 40, // Keep all charts left aligned
            'spacingTop': 20,
            'spacingBottom': 20
        },
        'title': {
            'text': ''
        },
        'xAxis': [{
            'categories': [].concat(data["blocks"]).reverse(),
            'crosshair': true,
            'labels': {
                'enabled': true,
                'step': step
            }
        }],
        'yAxis': [{
            'labels': {
                'enabled': false
            },
            'title': {
                'text': null
            }
        }, {
            'labels': {
                'enabled': false
            },
            'title': {
                'text': null
            }
        }, {
            'labels': {
                'enabled': false
            },
            'title': {
                'text': null
            },
            'opposite': true
        }, {
            'labels': {
                'enabled': false
            },
            'title': {
                'text': null
            }
        }, {
            'labels': {
                'enabled': false
            },
            'title': {
                'text': null
            }
        }],
        'tooltip': {
            'shared': true,
            formatter: function() {
                var s = '<b>' + this.x + '</b>';

                $.each(this.points, function(i, point) {
                    text = point.y
                    if (i == 3) {
                        text = convertHashes(point.y)
                    }

                    s += '<br/><span style="color:' + point.color + '">\u25CF</span>: ' + point.series.name + ': ' + text;
                });

                return s;
            },
        },
        'plotOptions': {
            'series': {
                'animation': false,
                'label': {
                    'connectorAllowed': true
                },
                'marker': {
                    'enabled': false,
                    'size': 2
                }
            }
        },
        'series': [{
            'name': 'Difficulty',
            'data': [].concat(data["diffs"]).reverse(),
            'yAxis': 1,
            'color': '#7cb5ec',
            'type': 'areaspline',
            'fillOpacity': 0.3
        }, {
            'name': 'Transactions',
            'data': [].concat(data["txs"]).reverse(),
            'yAxis': 2,
            'color': '#90ed7d'
        }, {
            'name': 'Size',
            'data': [].concat(data["sizes"]).reverse(),
            'yAxis': 3,
            'color': '#f7a35c'
        }, {
            'name': 'Network hashrate',
            'data': [].concat(data["nethash"]).reverse(),
            'yAxis': 4,
            'color': '#ff2a65'
        }],
        'responsive': {
            'rules': [{
                'condition': {
                    'maxWidth': 500,
                },
                'chartOptions': {
                    'legend': {
                        'layout': 'horizontal',
                        'align': 'center',
                        'verticalAlign': 'bottom'
                    }
                }
            }]
        }
    });
    $('.highcharts-credits').hide();
}