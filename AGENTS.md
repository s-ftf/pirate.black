# Project conventions

- Keep the website as plain HTML, CSS, and vanilla browser JavaScript. No build step or application server.
- Do not introduce npm, package manifests, package dependencies, or bundlers. Do not recommend npm commands.
- Keep static resources inside `assets/`, grouped into `css/`, `js/`, `img/`, `fonts/`, and `data/`.
- Preview using `python3 -m http.server 4173 --bind 127.0.0.1` from the repository root.
- Existing JavaScript checks use Node's built-in test runner directly; Node is not needed to serve or host the site.
- Preserve relative paths so the site works at a domain root and a GitHub Pages project path.

- The user’s term “repo example” refers to https://github.com/s-ftf/piratechain.com (preview: https://s-ftf.github.io/piratechain.com/index).

- Display block heights with a leading `#` and no thousands separators (for example `#4200266`). Counts of blocks are ordinary quantities, not heights.

- Keep JavaScript data access/configuration in `assets/js/api.js`, pure wallet release classification/sorting in `assets/js/wallet-releases.js`, and UI rendering/interactions in `assets/js/site.js`. The small `scroll-position.js` bootstrap must run before rendering.
- Run `python3 scripts/check-site.py` after moving files or changing local links.

- Shared styles belong in `assets/css/base.css`; homepage styles in `site.css`; vARRR styles in `varrr.css`. Keep external links opening in new tabs, while respecting the icon exceptions in `setupExternalLinks`.

- Keep HTML, CSS, JavaScript, and SVG source readable and directly editable. Do not minify source, subset fonts, or add a required build/compression process. Raster image optimization is welcome; preserve SVG artwork as SVG.
