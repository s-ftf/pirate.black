# API reliability handoff

Copy the prompt below into the agent working on the Pirate Watch API server repository.

---

Improve the reliability of Pirate Watch's public read API for the Pirate Chain community website at https://s-ftf.github.io/pirate.black/ (source: https://github.com/s-ftf/pirate.black). Inspect the server code, identify the cause, implement a compatible fix, and add focused tests. Do not deploy without an explicit request.

Observed during the website's release checks on 6 November 2026:

- `GET https://pirate.watch/api/v1/stats` repeatedly returned HTTP 429 with `{"error":"poll_limit"}`. One check returned `Retry-After: 51` and `Access-Control-Allow-Origin: *`.
- At the same check, `GET https://pirate.watch/api/v1/stats/supply` returned HTTP 200 with CORS enabled. This is evidence of the behavior, not a diagnosis of its cause.
- Rate-limited homepage requests leave network peers, anonymity sets, mining pools, and swap statistics unavailable when no valid client cache exists. They also produce browser console errors during audits.

The website is plain static HTML/CSS/JavaScript. It makes anonymous, credential-free cross-origin requests and must not need a private API key or a proxy application. Its visible-page background polling interval is 65 seconds. Hidden tabs pause polling. It retains validated responses in a five-minute session cache and honors `Retry-After`. In-flight requests are coalesced within the resource watcher; separate tabs and visitors behind a shared IP can still make concurrent requests. Avoid requiring synchronized client polling to obtain ordinary public data.

Please:

1. Trace the `poll_limit` policy through the API, reverse proxy, and cache layers. Determine whether cached reads, aggregate subrequests, endpoint buckets, or client-IP handling are consuming the wrong quota. Check forwarded client IPs only through explicitly trusted proxies; do not blindly trust client-supplied forwarding headers.
2. Make ordinary reads of a cached public snapshot reliable for concurrent visitors, reloads, and multiple tabs behind one IP. Separate upstream/RPC refresh scheduling from serving cached responses. Coalesce concurrent refresh work so requests do not trigger duplicate upstream work. Keep reasonable abuse protection and preserve protections on sensitive or expensive endpoints.
3. Keep the last valid snapshot during upstream timeouts or failures, with its actual observation timestamps. Make stale state explicit in backward-compatible metadata if necessary. Never invent zero values or advance `updated_at` to make old observations appear fresh. If no valid snapshot exists, return an honest availability error with a useful retry delay. Keep genuine rate-limit failures as HTTP 429.
4. Preserve existing URLs, fields, types, units, and calculator semantics. The site uses `/api/v1/stats`, `/api/v1/stats/supply`, and `/api/v1/mining-calculator/calculate`. Preserve the aggregate network, privacy, `mining-pools`, and swaps groups. Retain peer counts, chain size in bytes, per-pool last-seen timestamps in Unix seconds, and timing-luck percentages. Monetary zatoshi values must remain exact decimal strings. Supply observations must retain `varrr_locked_zat` and a truthful `updated_at`.
5. Preserve the calculator's `z15-pro` preset, API-provided miner list/defaults/bounds, and inputs `miner_id`, `sol_s`, `watts`, `electricity_usd_kwh`, `pool_fee_percent`, `quantity`, `cost_usd`, and `price_usd`. If calculator results are cached, key them by all normalized inputs and relevant defaults/network state so different scenarios cannot share incorrect results.
6. Keep CORS working for anonymous browser requests, including error responses and conditional responses. The GitHub Pages browser origin is `https://s-ftf.github.io` (the project path is not part of the origin). Ensure `Retry-After` is exposed through `Access-Control-Expose-Headers`; otherwise cross-origin JavaScript cannot read it. Preserve meaningful cache headers and ETags where appropriate, with bounded freshness. Do not solve this by changing JSON responses to HTTP 200 error payloads or disabling abuse controls globally.
7. Test cold and warm caches, concurrent visitors sharing an IP, independent visitors, requests across these endpoints, upstream outages/timeouts, stale observations, and genuine abuse. Verify that concurrent refreshes do not multiply RPC calls and that CORS/retry headers remain readable on 429/503 responses. Verify existing API contracts and exact monetary values remain compatible.

Report the root cause, changes made, tests run, cache and rate-limit behavior, and any frontend changes actually required. Recommend a documented polling interval that remains reliable under normal multi-visitor traffic. Keep the scope on API reliability; the website should remain a directly editable static site.

## Pool website URLs

A later frontend check found that records under `mining-pools.pools` do not include official website URLs. Add an optional `url` field containing the pool's verified absolute HTTPS website URL. Keep it absent or null if unknown. The frontend is prepared to link directly to this field and leaves rows without a valid URL unlinked; it no longer substitutes Pirate Watch miner pages.
