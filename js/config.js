// Config
var networksConfigs = {
    'MWC': {
        'name': 'Main Network (MWC)',
        'api': 'https://api.minersworld.org',
        'ticker': 'MWC',
        'decimals': 8,
        'hrp': 'mwc',
        'burnAddress': '9BuRnXTZBMvVVRW5GtP1KxkYd22QKmtNuW',
        'market': true,
        'supplyIncludesBurned': false   // /info supply is already net of burned coins; set true if that ever changes
    },
    'TMWC': {
        'name': 'Test Network (TMWC)',
        'api': 'https://api.minersworld.org/testnet',
        'ticker': 'TMWC',
        'decimals': 8,
        'hrp': 'tmwc'
    },
}

// Miners World game registry — resolves COMMITMENT-mode OP_RETURN payloads
// (hash-only on chain) back to their full metadata + canonical body, so the
// explorer can show NFT names/rarities AND let anyone verify the SHA-256
// commitment against the on-chain envelope hash.
// NOTE: must be an HTTPS origin (or same-origin) — this page is served over
// HTTPS and browsers block mixed-content subresource fetches to plain HTTP.
var GAME_API_BASE = 'https://game.minersworld.org'   // live game registry (TLS) — full NFT metadata + commitment verification on tx pages