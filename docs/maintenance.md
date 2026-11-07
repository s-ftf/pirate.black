# Maintenance and credits

A two-page Pirate Chain website built with plain HTML, CSS, and browser JavaScript. There is no framework, dependency installation, build step, analytics, or wallet connection.

## Run locally

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open [the local site](http://127.0.0.1:4173). Use HTTP rather than opening the HTML as a file: browser modules and local JSON need an HTTP origin. Python serves the files; Node is only needed for the optional JavaScript tests.

## Where to make changes

| File | Responsibility |
| --- | --- |
| `index.html` | Homepage content and static wallet fallbacks |
| `varrr.html` | vARRR content, supply allocation, and reserve verification command |
| `assets/css/base.css` | Shared typography, page foundation, footer, and external-link icon |
| `assets/css/site.css` | Homepage sections and responsive layouts |
| `assets/css/varrr.css` | vARRR layout and reserve monitor |
| `assets/js/api.js` | Endpoint configuration, HTTP requests, timeout/cancellation, retry policy, caching, polling, response validation, and value formatting |
| `assets/js/wallet-releases.js` | Pure wallet asset classification, sorting, platform labels, repository restrictions, and detached-signature pairing |
| `assets/js/site.js` | Rendering, wallet and calculator dialogs, clipboard feedback, media playback, and parallax |
| `assets/js/scroll-position.js` | Small pre-render bootstrap that preserves the exact refresh position |
| `assets/data/media.json` | Saved publication, video, and X-post metadata |
| `scripts/update-media.py` | Refresh saved public media using Python's standard library |
| `scripts/check-site.py` | Check local links, imports, resources, SVG parsing, and duplicate HTML IDs |
| `tests/` | Data/service, wallet sorting, bookmark, reserve, and media-updater tests |

All data fetching belongs in `api.js`. Wallet filename rules belong in `wallet-releases.js`; UI code calls those functions rather than duplicating them. `site.js` imports both modules. The scroll bootstrap stays separate because it must run in the page head before rendering; moving it into the deferred module can make refreshes jump. It also normalizes homepage `/index.html` URLs to the containing directory while preserving query parameters, bookmarks, history state, and saved refresh positions.

Keep assets under `assets/`, use relative local paths, and preserve the no-JavaScript content and download fallbacks. Display block heights with `#` and no thousands separators. The current styles support narrow screens and reduced-motion preferences. The homepage ends with the gold skull and white MareLiberum link inside the community section. Both pages use normal document flow.

## Data services

Public endpoints and official wallet repositories are configured at the top of `api.js`.

- **Pirate Watch:** the homepage reads `https://pirate.watch/api/v1/stats`; vARRR reads `/api/v1/stats/supply`. Background requests wait at least 65 seconds, pause in hidden tabs, honor `Retry-After`, and use a five-minute session cache. Failed refreshes retain valid observations. The shared watcher also updates freshness while waiting to retry.
- **Reserve:** zatoshi amounts use BigInt. A successful reserve confirmation requires a fresh reported balance matching the 10,000,000 ARRR target. The API reports the balance; it does not expose a separate original-note verification result. The page includes the original transaction and public viewing-key command for independent verification.
- **Swap activity:** the three displayed values describe observed contracts and claimed ARRR, not exchange liquidity. Rounded values retain fuller figures and source dates in their tooltips. Missing observations remain unavailable rather than becoming zero.
- **Mining:** the compact Z15 Pro preset and full calculator use Pirate Watch's calculator endpoint. API-provided miners, bounds, default costs, and all editable inputs are retained. Custom requests can be canceled; preset refreshes do not overwrite an edited setup. Pools are sorted by their most recent observed block. Timing luck is target block time divided by mean positive parent-block interval, not pool-share luck.
- **GitHub:** Stashi release data loads as its section approaches the viewport; core wallets load when opened. Core GUI and CLI share one repository request. Release links must belong to the configured repository. OS-specific installers/components remain sorted, and each detached signature sits beside its exact file. The GitHub group contains the source-code link.
- **Media:** locally saved articles, thumbnails, videos, and the compact X post render first. Publications can refresh through rss2json. Feed HTML is never inserted into the page. YouTube is contacted only after play, using `youtube-nocookie.com`; no X widget is loaded. The Python updater preserves saved content when upstream services fail and does not download unused X-post photos.

Multiple open previews sharing an IP may receive Pirate Watch's `429 poll_limit`; the retry policy preserves the last valid observation. See the [API reliability handoff](api-reliability-handoff.md) for the observed behavior and a prompt for the agent maintaining the API server.

## Check changes

```sh
python3 scripts/check-site.py
node --experimental-default-type=module --test tests/*.test.js
python3 -m unittest discover -s tests -p 'test_*.py'
```

Use a recent Node version (the Pages workflow uses Node 22). Tests cover monetary rounding, malformed responses and caches, request sharing, cancellation, retry delays, hidden-tab polling, all 47 Stashi v1.2.6 asset classifications, signature pairing, repository URL restrictions, wallet bookmarks, and media selection.

Also check both pages at desktop and mobile widths. Exercise wallet platform selection, Escape/backdrop closing, incoming wallet bookmarks, copy feedback, calculator setup/results, and refresh-position preservation. No browser test dependency is required by this repository.

To refresh the saved media snapshot:

```sh
python3 scripts/update-media.py
```

`.gitignore` excludes generated output, local reports, Python caches/virtual environments, IDE settings (including IntelliJ and VS Code), temporary files, operating-system metadata, and local `.env` files. Environment example files remain trackable. Keep source, tests, fixtures, assets, and license notices in version control. `.editorconfig` records two-space HTML/CSS/JavaScript indentation, four-space Python indentation, and UTF-8/LF files.

## GitHub Pages

The site works at a domain root or a GitHub Pages project path. The workflow in `.github/workflows/pages.yml` checks the code, refreshes public media, validates the final files, stages the HTML, `robots.txt`, `sitemap.xml`, `llms.txt`, `.nojekyll`, and `assets/`, then publishes through GitHub Pages. It runs on pushes to `main`, manual dispatch, and daily at 07:23 UTC. The scheduled deployment does not commit refreshed metadata back into the source repository.

For GitHub Actions hosting, select **Settings → Pages → Build and deployment → GitHub Actions**. For branch-based hosting, publish the root and commit updated media snapshots manually.

The canonical, sitemap, discovery-guide, structured-data, and social-image URL base is `https://s-ftf.github.io/pirate.black/`. Update those absolute URLs when the hosting domain changes. The approved share image is `assets/img/social/pirate-og-image.png`. Static stylesheet and module links use a manual `?v=1` cache label; bump it when publishing changes that need to replace a cached asset.

## Sources and attribution

Content and wallet classification were adapted from the user's [reference repository](https://github.com/s-ftf/piratechain.com), under its 0BSD license. This site uses its own visual layout. The reference's mining statistics informed the swap rings and their hover motion.

- [PirateNetwork/pirate](https://github.com/PirateNetwork/pirate), [Stashi Wallet](https://github.com/PirateNetwork/Stashi-Wallet), and [paper wallet](https://github.com/PirateNetwork/piratepaperwallet): official source and releases.
- [Pirate Watch](https://pirate.watch/api): public data, pool icon contours, and Inter/IM Fell English font sources.
- [Pirate Chain](https://piratechain.com/): whitepaper, marks, vARRR coast artwork, and mining circuit-board artwork. The [mediakit](https://github.com/PirateNetwork/mediakit) and reference repository supplied additional local branding and OS icons.
- [ARRRmada](https://arrrmada.com/): compass-and-anchor contours used in its flat Explore mark. The vARRR mark includes Verus blue and its white badge.
- Font Awesome Free: link, documentation, file-signature, and X icons. Attribution/license are in `assets/img/icons/`.
- Stashi artwork/license: `assets/img/stashi/`. Local Inter, IBM Plex Mono, and IM Fell English font licenses are in `assets/fonts/`.
- Publication thumbnails and YouTube posters remain their creators' work. The videos link to Pirate Chain, Scott Perrie's *The Privacy Shanty*, and *Legend of Lootz*.

The PGP-style block is presentational text, not an encrypted payload. Project marks remain associated with their respective projects.

## Search and link metadata

Both pages have canonical URLs, index/follow crawler directives, unrestricted preview limits, Open Graph/Twitter metadata, a factual Schema.org JSON-LD graph, and inline microdata for visible page, wallet, and publication content. Wallet metadata describes actual software; SDK downloads do not imply an iOS consumer app. The updater synchronizes saved publication links and their ItemList into HTML, so that content remains available without JavaScript.

`robots.txt` allows all crawlers, including AI crawlers. On GitHub Pages project hosting, the effective robots file must be served at the origin root (`https://s-ftf.github.io/robots.txt`); this repository's project-path copy cannot set origin-wide policy. The per-page indexing directives and sitemap still describe this site. `llms.txt` is an optional readable guide, not a promise of search indexing or AI inclusion.

External links use `target="_blank"` and `rel="noopener noreferrer"` in HTML and generated UI. The square-and-arrow icon is omitted from Discord, publications/YouTube, resource links, the X brand mark, and footers. Mining pool icons sit inside their name cell. Internal section bookmarks and wallet dialogs stay in the same tab.

Keep HTML, CSS, JavaScript, and SVG files readable and directly editable. There is no minification, compression, font-subsetting, or build step required to edit or publish the site. The full original webfonts and license notices are included. Raster images may be optimized: publication covers use local WebP files, and the mobile vARRR coast image is a smaller version of the desktop asset. SVG artwork stays in SVG format.

Lighthouse results depend on the serving environment and live services. Python's basic static server does not add text compression or long-lived cache headers. GitHub Pages controls its own response headers. A public API 429 response is reported by Lighthouse as a console error, even when the UI retains cached data and honors the server's retry delay.
