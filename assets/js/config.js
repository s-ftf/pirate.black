/** Public API settings. Edit these values to change the site's data sources. */
export const CONFIG = Object.freeze({
  statsURL: 'https://pirate.watch/api/v1/stats',
  supplyURL: 'https://pirate.watch/api/v1/stats/supply',
  miningCalculatorURL: 'https://pirate.watch/api/v1/mining-calculator/calculate',
  // {repository} is replaced with the selected wallet's repository below.
  githubReleaseURL: 'https://api.github.com/repos/{repository}/releases/latest',
  publicationFeed: 'https://medium.com/feed/piratechain',
  feedService: 'https://api.rss2json.com/v1/api.json',
  youtubePlaylistURL: 'https://www.googleapis.com/youtube/v3/playlistItems',
  youtubeUploads: 'UUd2zagYKjbo1mLTwIxEd06w',
  // Public browser key used by the example community website.
  youtubeAPIKey: 'AIzaSyAzrBuUUtL34scmof_gZN2Vbk4iimMhBV8',
  wallets: {
    'treasure-chest': { repository: 'PirateNetwork/pirate', assetType: 'qt' },
    stashi: { repository: 'PirateNetwork/Stashi-Wallet', installerOnly: true },
    paper: { repository: 'PirateNetwork/piratepaperwallet' },
    cli: { repository: 'PirateNetwork/pirate', assetType: 'cli' }
  },
  pollInterval: 65000,
  staleAfter: 5 * 60 * 1000
});
