// Circulating supply (total supply minus burned coins), market cap and price tiles on the home page
var supplyState = { supplySat: null, burnedSat: null }

function setSupply(sat) { supplyState.supplySat = Number(sat); renderSupplyTiles() }
function setBurned(sat) { supplyState.burnedSat = sat == null ? null : Number(sat); renderSupplyTiles() }

function circulatingSat() {
    var supply = supplyState.supplySat
    if (supply == null || !isFinite(supply)) return null
    var burned = supplyState.burnedSat
    return burned != null && isFinite(burned) ? Math.max(0, supply - burned) : supply
}

function coinsText(sat) {
    var coins = parseFloat(amountFormat(sat))
    return fmtNum(coins, coins >= 1000 ? 0 : 2)
}

function renderSupplyTiles() {
    var supply = supplyState.supplySat
    if (supply == null || !isFinite(supply)) return
    var ticker = getApi()['ticker']
    var circulating = circulatingSat()
    var burned = supplyState.burnedSat

    $('#supply .stat-value').removeClass('loading').find('span').text(fmtNum(Math.floor(parseFloat(amountFormat(circulating)))))
    $('#supply .stat-sub').text(burned != null ? coinsText(burned) + ' burned · ' + coinsText(supply) + ' total' : ticker + ' · click to refresh')

    // market tiles only exist on the main network
    var market = getApi()['market'] === true
    $('.market-tile').toggleClass('d-none', !market)
    if (!market) return
    if (typeof fiatReady === 'function' && fiatReady() && circulating != null) {
        $('#stat-marketcap').removeClass('loading').text(fiatCompact(circulating / 1e8 * fiat.price, fiat.currency))
        $('#stat-marketcap-sub').text('Circulating supply × price')
        $('#stat-price').removeClass('loading').text(fiatFormat(fiat.price, fiat.currency, 8))
        $('#stat-price-sub').text('Per ' + ticker + ' · today')
    } else {
        $('#stat-marketcap, #stat-price').addClass('loading').text('–')
        $('#stat-marketcap-sub, #stat-price-sub').text('\u00a0')
    }
}
