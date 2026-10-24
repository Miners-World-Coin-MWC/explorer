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