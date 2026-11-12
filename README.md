# pirate.black

An open-source static website for the Pirate Chain community, written in simple HTML, CSS, and JavaScript so anyone can contribute and help maintain it.

**Website:** [s-ftf.github.io/pirate.black](https://s-ftf.github.io/pirate.black/)

To view locally, run this from the project folder:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open [127.0.0.1:4173](http://127.0.0.1:4173).

Edit the HTML pages and files in `assets/`. Contributions are welcome through issues and pull requests.

## External APIs

This site is not suitable, in its current form, for use as the official Pirate Chain website. Like many static sites, it consumes external APIs for YouTube videos, GitHub releases, publications, and network statistics, and links to external blockchain explorers.

Some API sources are unofficial and should be treated as untrusted. Before this site is used as the official website, remove the features that depend on those sources or replace their endpoints with officially operated API servers.

See [API_EXAMPLES.json](API_EXAMPLES.json) for the current requests and minimum response examples. Endpoints are configured in [assets/js/config.js](assets/js/config.js).
