/**
 * Data services: request/backoff policy, shared polling,
 * response validation, and formatting of API values. No UI rendering here.
 */

import { CONFIG } from './config.js?v=1';

// Value formatting and response validation.
export function formatZat(value, decimals = 2) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return '—';
  const amount = BigInt(value);
  const whole = (amount / 100000000n).toLocaleString('en-US');
  const fraction = (amount % 100000000n).toString().padStart(8, '0').slice(0, decimals);
  return decimals ? `${whole}.${fraction}` : whole;
}

export function formatRoundedARRR(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return '—';
  return ((BigInt(value) + 50000000n) / 100000000n).toLocaleString('en-US');
}

function compactAmount(amount, base) {
  const units = [1n, 1000n, 1000000n, 1000000000n, 1000000000000n];
  const suffixes = ['', 'k', ' M', ' B', ' T'];
  let unit = 0;
  while (unit < units.length - 1 && amount >= units[unit + 1] * base) unit++;
  let rounded, precision;
  do {
    precision = unit >= 2 ? 10n : 1n;
    const divisor = units[unit] * base;
    rounded = (amount * precision + divisor / 2n) / divisor;
    if (rounded < 1000n * precision || unit === units.length - 1) break;
    unit++;
  } while (true);
  const decimal = precision === 10n && rounded % 10n ? `.${rounded % 10n}` : '';
  return `${(rounded / precision).toLocaleString('en-US')}${decimal}${suffixes[unit]}`;
}

export function formatCompactCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? compactAmount(BigInt(value), 1n) : '—';
}

export function formatCompactARRR(value) {
  return typeof value === 'string' && /^\d+$/.test(value) ? compactAmount(BigInt(value), 100000000n) : '—';
}

export function formatCompactSwapTime(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 59.5) return `${Math.round(seconds)}s`;
  if (seconds < 3570) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86220) return `${formatNumber(seconds / 3600, 1)} hr`;
  const days = formatNumber(seconds / 86400, 1);
  return `${days} ${days === '1' ? 'day' : 'days'}`;
}

export function formatNumber(value, decimals = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value.toLocaleString('en-US', { maximumFractionDigits: decimals }) : '—';
}

export function privacyCount(group, pool) {
  const count = group?.commitments?.[pool];
  return Number.isFinite(Date.parse(group?.updated_at)) && Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function safeURL(value, hosts) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!hosts || hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) ? url.href : null;
  } catch { return null; }
}

export function statsAreValid(data) {
  return Boolean(data && Number.isSafeInteger(data.network?.height) && data.network.height >= 0 &&
    Number.isFinite(Date.parse(data.network.updated_at)));
}

export function statsTimestamp(data) {
  return Date.parse(data.network.updated_at);
}

export function swapStatsAreValid(group) {
  return Boolean(group &&
    ['funded_count']
      .every(key => Number.isSafeInteger(group[key]) && group[key] >= 0) &&
    (group.median_claim_seconds === null ||
      (Number.isFinite(group.median_claim_seconds) && group.median_claim_seconds >= 0)) &&
    typeof group.claimed_zat === 'string' && /^\d+$/.test(group.claimed_zat) &&
    Number.isFinite(Date.parse(group.updated_at)));
}

export function formatClaimTime(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const remainder = total % 60;
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}


// Mining calculator contract.
export const CALCULATOR_FIELDS = ['sol_s', 'watts', 'electricity_usd_kwh', 'pool_fee_percent', 'quantity', 'cost_usd', 'price_usd'];

export function calculatorQuery(inputs) {
  return new URLSearchParams(['miner_id', ...CALCULATOR_FIELDS].map(key => [key, inputs[key] === null ? '' : String(inputs[key])]));
}

export function calculatorDefaultsValid(data) {
  const miners = data?.form?.miners;
  return data?.api_version === 1 && Array.isArray(miners) && miners.length > 0 &&
    miners.every(miner => typeof miner.id === 'string' && typeof miner.name === 'string' &&
      [miner.sol_s, miner.watts, miner.cost_usd].every(Number.isFinite)) &&
    miners.some(miner => miner.id === data.inputs?.miner_id) &&
    CALCULATOR_FIELDS.every(key => key === 'price_usd' && data.inputs[key] === null || Number.isFinite(data.inputs[key]));
}


// Pool observations.
export function poolLastSeen(pool) {
  const value = pool.last_seen ?? pool.last_time ?? pool.stats?.last_time;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value * 1000;
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return Date.parse(value);
  return null;
}

export function poolBlockCount(pool) {
  const value = pool.blocks;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function recentMiningPools(group, limit = 5) {
  if (!Array.isArray(group?.pools)) return [];
  // The public directory order is retained when per-pool dates are unavailable.
  return group.pools.filter(pool => typeof pool.name === 'string' && /^R[a-zA-Z0-9]{20,40}$/.test(pool.address))
    .sort((a, b) => (poolLastSeen(b) ?? 0) - (poolLastSeen(a) ?? 0)).slice(0, limit);
}


// vARRR backing uses exact zatoshi arithmetic.
export function reserveSupplyIsValid(data, now = Date.now()) {
  const time = Date.parse(data?.updated_at);
  return typeof data?.varrr_locked_zat === 'string' && /^\d+$/.test(data.varrr_locked_zat) &&
    Number.isFinite(time) && time > 0 && time <= now + 120000;
}

export function reserveCoverage(zat) {
  if (typeof zat !== 'string' || !/^\d+$/.test(zat)) return '—';
  const target = 1000000000000000n;
  const points = (BigInt(zat) * 10000n + target / 2n) / target;
  const decimals = (points % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  return `${(points / 100n).toLocaleString('en-US')}${decimals ? `.${decimals}` : ''}%`;
}

export function reserveComparison(zat) {
  if (typeof zat !== 'string' || !/^\d+$/.test(zat)) return 'waiting';
  const amount = BigInt(zat), target = 1000000000000000n;
  return amount === target ? 'matched' : amount > target ? 'above' : 'below';
}

// Shared HTTP policy. Calculator interactions may retry sooner than background polls.
export function retryDelay(value, minimum = CONFIG.pollInterval, now = Date.now()) {
  if (!value) return minimum;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(minimum, delay) : minimum;
}

export async function requestJSON(url, { signal, minimumRetry = CONFIG.pollInterval, referrerPolicy = 'no-referrer' } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal, credentials: 'omit', referrerPolicy
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.retryAfter = retryDelay(response.headers.get('Retry-After'), minimumRetry);
      error.retryAt = Date.now() + error.retryAfter;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

/** Poll one resource, preserving its last valid observation through failures. */
export function watchResource({ url, read = () => requestJSON(url), validate, cacheKey, timestamp, onUpdate }) {
  const page = document;
  let data, fetchedAt = 0, lastAttempt = 0, retryAt = 0, timer, fetching = false;
  let failed = false, error = null, stopped = false;
  const emit = () => {
    if (stopped) return;
    const observedAt = data ? (timestamp ? timestamp(data) : fetchedAt) : 0;
    onUpdate({ data, fetchedAt, failed, error, stale: !data || Date.now() - observedAt > CONFIG.staleAfter });
  };
  async function refresh() {
    clearTimeout(timer);
    if (stopped || page.hidden || fetching) return;
    const wait = Math.max(lastAttempt + CONFIG.pollInterval, retryAt) - Date.now();
    if (wait > 0) { timer = setTimeout(refresh, wait); return; }
    lastAttempt = Date.now(); fetching = true;
    try {
      const next = await read();
      if (!validate(next)) throw new Error('Invalid API response');
      data = next; fetchedAt = lastAttempt; failed = false; error = null; retryAt = 0;
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ data, fetchedAt })); } catch { /* Storage is optional. */ }
    } catch (failure) {
      failed = true; error = failure;
      retryAt = Date.now() + (failure.retryAfter || CONFIG.pollInterval);
    } finally {
      fetching = false; emit();
      if (!stopped) timer = setTimeout(refresh, Math.max(CONFIG.pollInterval, retryAt - Date.now()));
    }
  }
  const visibility = () => {
    clearTimeout(timer);
    if (!page.hidden) { emit(); refresh(); }
  };
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey));
    const age = Date.now() - cached?.fetchedAt;
    if (cached && Number.isFinite(cached.fetchedAt) && Number.isFinite(age) && age >= 0 && age < CONFIG.staleAfter && validate(cached.data)) {
      data = cached.data; fetchedAt = cached.fetchedAt; lastAttempt = fetchedAt;
    }
  } catch { /* Invalid or unavailable storage falls back to a fresh request. */ }
  page.addEventListener('visibilitychange', visibility);
  const clock = setInterval(() => { if (!page.hidden) emit(); }, 30000);
  emit(); refresh();
  return {
    refresh,
    stop() {
      stopped = true; clearTimeout(timer); clearInterval(clock);
      page.removeEventListener('visibilitychange', visibility);
    }
  };
}

export const watchNetwork = onUpdate => watchResource({
  url: CONFIG.statsURL, cacheKey: 'pirate-stats-v1',
  validate: statsAreValid, timestamp: statsTimestamp, onUpdate
});

export const watchReserve = onUpdate => watchResource({
  url: CONFIG.supplyURL, cacheKey: 'pirate-supply-v1',
  validate: reserveSupplyIsValid, timestamp: data => Date.parse(data.updated_at), onUpdate
});

let calculatorRetryAt = 0;
export async function calculateMining(inputs, { signal } = {}) {
  if (Date.now() < calculatorRetryAt) {
    const error = new Error('Calculator retry pending');
    error.retryAfter = calculatorRetryAt - Date.now();
    error.retryAt = calculatorRetryAt;
    throw error;
  }
  const query = Object.keys(inputs).length === 1
    ? new URLSearchParams(inputs) : calculatorQuery(inputs);
  try {
    const data = await requestJSON(`${CONFIG.miningCalculatorURL}?${query}`, { signal, minimumRetry: 1000 });
    if (!calculatorDefaultsValid(data)) throw new Error('Invalid calculator response');
    return data;
  } catch (error) {
    if (error.retryAfter) calculatorRetryAt = error.retryAt;
    throw error;
  }
}

export const watchMiningPreset = onUpdate => watchResource({
  async read() {
    const { charts, ...data } = await calculateMining({ miner_id: 'z15-pro' });
    return data;
  },
  cacheKey: 'pirate-mining-defaults-v1',
  validate: data => calculatorDefaultsValid(data) && data.inputs.miner_id === 'z15-pro',
  onUpdate
});

// Core GUI and CLI releases share the same repository request.
const releases = new Map();
const releaseRetryAt = new Map();
export function getRelease(repository) {
  if (!Object.values(CONFIG.wallets).some(wallet => wallet.repository === repository)) {
    return Promise.reject(new Error('Unknown wallet repository'));
  }
  if (Date.now() < (releaseRetryAt.get(repository) || 0)) return Promise.reject(new Error('Release retry pending'));
  if (!releases.has(repository)) {
    releases.set(repository, requestJSON(CONFIG.githubReleaseURL.replace('{repository}', repository))
      .then(data => {
        if (!Array.isArray(data.assets) || typeof data.tag_name !== 'string' ||
            !safeURL(data.html_url, ['github.com']) ||
            !new URL(data.html_url).pathname.toLowerCase().startsWith(`/${repository.toLowerCase()}/releases/tag/`)) {
          throw new Error('Invalid wallet release');
        }
        return data;
      }).catch(error => {
        releases.delete(repository);
        if (error.retryAfter) releaseRetryAt.set(repository, Date.now() + error.retryAfter);
        throw error;
      }));
  }
  return releases.get(repository);
}

export async function loadPublications() {
  const data = await requestJSON(`${CONFIG.feedService}?rss_url=${encodeURIComponent(CONFIG.publicationFeed)}`);
  if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('Invalid publication feed');
  return data.items;
}

// Read the newest public upload directly from YouTube, as in the example site.
export async function loadLatestVideo() {
  const url = new URL(CONFIG.youtubePlaylistURL);
  url.search = new URLSearchParams({
    part: 'snippet', maxResults: '1', playlistId: CONFIG.youtubeUploads, key: CONFIG.youtubeAPIKey
  });
  const data = await requestJSON(url.href, { referrerPolicy: 'strict-origin-when-cross-origin' });
  const snippet = data.items?.[0]?.snippet;
  const id = snippet?.resourceId?.videoId;
  if (!/^[\w-]{11}$/.test(id) || typeof snippet?.title !== 'string') throw new Error('Invalid video feed');
  return {
    id,
    title: snippet.title,
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  };
}
