# Pirate Chain community website

View the site at [https://s-ftf.github.io/pirate.black/](https://s-ftf.github.io/pirate.black/).

This is a static website built with Jekyll and hosted on GitHub Pages directly from its public repository. It needs no privately operated application server or database. Anyone can download the source and host a copy, on GitHub Pages or elsewhere.

The website is a community project. Anyone can help improve it, fix a broken link, update information, improve the design, or add a useful feature. Open an issue to discuss an idea, or fork the repository and submit a pull request. Keeping the site accurate and useful is a shared effort.

To run it locally, install the Ruby dependencies with `bundle install`, then run `bundle exec jekyll serve`

## License and reuse

The project's original code and content are available under the [Zero-Clause BSD (0BSD) License](LICENSE). You may use, change, redistribute, and host them for any purpose, including commercially, with no requirement to keep a license or copyright notice. They come without a warranty.

Fork away, but fly yarrrr own flag. Clearly label independent copies so visitors do not mistake them for the Pirate Chain site.

## Maintaining the site

The site uses HTML, CSS, a little JavaScript. The Jekyll backbone only exists to make templates possible. Keep changes simple so community contributors can review and maintain them.

Store new photos and illustrations as WebP (keep logos and drawings as SVG when appropriate). Use a descriptive filename and alt text. Give images their intrinsic `width` and `height`, and use `loading="lazy"` for images below the first screen. Page titles and descriptions are set in each page's front matter. All pages currently share the `default_thumbnail` social preview in `_config.yml`; shared metadata and schema come from `_includes/head.html`.

## Edit exchange listings
Exchange listings appear under **Other Exchanges** below the CheetahDEX feature. They come from [_data/exchanges.yml](_data/exchanges.yml). To propose a change on GitHub, open that file, click the pencil icon, edit it, and choose **Propose changes** to open a pull request.

- **Add:** Copy an entry and set `name`, `url`, and `logo`. Put any new logo in [assets/img/exchanges/](assets/img/exchanges/); `logo` is just its filename.
- **Dark logos:** Add `light_background: true` to show a dark logo on a light listing card.
- **Edit or reorder:** Change the entry's fields or move the whole entry. Listings appear in file order.
- **Remove:** Delete the entire entry.

Use a direct ARRR market or swap link when available. For a wallet-based DEX without a shareable pair URL, link to its official download page. Before proposing a listing, confirm ARRR is supported for trading, an ARRR price page alone is insufficient. There is no need to edit `exchanges.html`. Maintainers should check the proposed link and logo.

<br/>

## Edit social platforms
The Community page's social links come from [_data/socials.yml](_data/socials.yml). Open that file on GitHub, click the pencil icon, and choose **Propose changes** when finished.

- **Add:** Copy an entry and set its `name`, `url`, `icon`, and `enabled: true`. Put a new icon in [assets/img/socials/](assets/img/socials/); `icon` is its filename.
- **Edit or reorder:** Change an entry's fields or move the whole entry. Enabled links appear in file order.
- **Disable or re-enable:** Set `enabled: false` to hide a link while keeping its details, or `enabled: true` to show it again.
- **Remove permanently:** Delete the whole entry.

Discord and Medium use `url_config` instead of a `url` so their links always come from `_config.yml`. Run `bundle exec jekyll serve` to preview a change locally.

<br/>

## Wallet release links
Wallet downloads update automatically. When a visitor reaches a wallet card or clicks **Downloads**, [assets/js/wallets.js](assets/js/wallets.js) reads the latest GitHub release from the repositories listed under `wallet_repositories` in [_config.yml](_config.yml). It picks the relevant files and gives them clear platform and package names. Treasure Chest and CLI share the `core` repository.

To change a release source, edit its GitHub repository path in `_config.yml`. GitLab mirror links and extra links, such as the Stashi guide and Play Store listing, are configured there too. The wallet cards' descriptions, images, and layout are written directly in [wallets.html](wallets.html). If a project's release file names or formats change enough that downloads are missed or mislabeled, update the matching rules in `assets/js/wallets.js`.

After changing `_config.yml`, restart Jekyll and check **Downloads** on the Wallets page. If you change the matching rules, run `node _tests/wallets.test.cjs`.

<br/>

## Mining calculator
The calculator in [assets/js/mining.js](assets/js/mining.js) reads current height and difficulty from the Pirate Chain explorer, falling back to the Dexstats explorer. It gets the ARRR/USD quote from CoinGecko's public price API. The estimate uses the current block reward and difficulty, then subtracts the entered pool fee and electricity cost. If the price API is unavailable, it still shows estimated ARRR rewards and electricity cost. The browser calls these APIs directly; no proxy or API key is needed.

<br/>

## Community Page
The community page is a live feed of the most recent videos posted to the following playlists on the [Official Pirate Chain YouTube channel](https://www.youtube.com/c/piratechain). 
* [Pirate Music Playlist](https://www.youtube.com/watch?v=RhRWM1WW6ak&list=PLgEMYwvTcDT4qBIZCMpTgiTOCSRqU1KtL)
* [Events Playlist](https://www.youtube.com/watch?v=RGplTBYULyE&list=PLgEMYwvTcDT4AqQXvh2fVmJX_kIVMAT7Q)
* [Interviews Playlist](https://www.youtube.com/watch?v=LPyIP8DbkDg&list=PLgEMYwvTcDT6N_jJrA_Jo8m9twRwolHK-)
* [Monthy Updates Playlist](https://www.youtube.com/watch?v=dyz0ltiafWk&list=PLgEMYwvTcDT54FsOk4yVWkJZ4i3Xcz1mM)
* [ARRR Community Playlist](https://www.youtube.com/watch?v=248NO7p2h8w&list=PLgEMYwvTcDT5V1RiSoPh1RheOgDYJ88jK)
* [Daily Dose of Pirate chain channel](https://www.youtube.com/@DailyDoseOfPirateChain)

<br/>

## Branding Page
All the images displayed are linked from the mediakit repository at [https://github.com/PirateNetwork/mediakit](https://github.com/PirateNetwork/mediakit). Any changes to the naming scheme of the logos and brand art will break the images and switching functionality on this page.

<br/>

## Whitepaper
Like the Media Kit assets, the white paper comes directly from a Pirate Chain GitHub repository: [PirateNetwork/pirate-docs](https://github.com/PirateNetwork/pirate-docs/blob/master/assets/whitepaper/Pirate_Chain_White_Paper.pdf). The site links to that PDF rather than hosting a separate copy. If it moves, update `whitepaper_url` in `_config.yml`; the Resources menu and the local whitepaper page both use that setting.

<br/>

## Key site configuration
Update shared values in `_config.yml` rather than editing each page. These are the settings community maintainers are most likely to change:

| Setting | Used for |
| --- | --- |
| `discord_invite_url` | Community Discord links throughout the site, including Resources and support links, plus the `/discord` redirect. Set this to the current invite. |
| `medium_publication_url` | Medium links in the navigation, Community page, and home page fallback. |
| `medium_feed_url` | RSS feed used for the publication cards on the home page. Medium publication feeds use `https://medium.com/feed/PUBLICATION_NAME`. |
| `medium_feed_api_url` | RSS-to-JSON service that lets the static home page read the Medium feed in visitors' browsers. The default is rss2json's public API. |
| `medium_article_count` | Maximum number of publication cards to show on the home page (up to six). |
| `donation_address` | The ARRR address displayed and copied on the Donations page. If it changes, regenerate `assets/img/site/donoQR.svg` with the same address so the QR code stays in sync. |
| `email` | The email links in Contact and Legal. Set this to the current community support mailbox. |
| `pirate_history_url` | Pirate History in the Resources menu. |
| `whitepaper_url` | The Resources menu's Whitepaper link and the link on the old `/whitepaper` page. Set this to the official PDF location. |
| `site_repository_url` | Public source repository linked from the home page's contribution section. Update it if the community moves the site to another repository. |
| `wallet_repositories` | GitHub release repositories and GitLab mirror paths used by the Wallets page. See **Wallet release links** above. |
| `wallet_links` | Supplemental wallet downloads, the Stashi user guide, and its Google Play listing. |
| `url` | Public site origin used for canonical links, social previews, schema, the sitemap, and the RSS feed. Currently `https://s-ftf.github.io`. |
| `baseurl` | The prefix for internal links and assets. Keep `/pirate.black/` when serving from that project path; use `/` when serving from the domain root. |
| `name`, `title`, `description`, `default_thumbnail` | Default site identity and social-sharing metadata. Every page currently uses `meta/pirate-chain-default-social-preview.webp` for Open Graph, Twitter, and structured data. |

When this site moves from GitHub Pages to `piratechain.com`, set `url: "https://piratechain.com"` and `baseurl: "/"`, then rebuild. The canonical URLs and sitemap will update automatically. Keep the URL values pointed at the actual public home of this site; `pirate.black` currently redirects elsewhere.

<br />

<hr />
<img src="assets/img/logo/Pirate_Logo_Wordmark_Gold.svg" style="width:150px;margin:40px auto;display:block;">
