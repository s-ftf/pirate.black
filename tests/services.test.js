import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, requestJSON, retryDelay, watchResource, getRelease } from '../assets/js/api.js';

function replaceGlobal(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
}

function browserState(t, cached) {
  const doc = new EventTarget();
  doc.hidden = false;
  const items = new Map(cached ? [['test-resource', JSON.stringify(cached)]] : []);
  replaceGlobal(t, 'document', doc);
  replaceGlobal(t, 'sessionStorage', { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) });
  return { doc, items };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('HTTP requests share retry parsing and omit visitor credentials', async t => {
  const now = Date.parse('2026-11-06T23:00:00Z');
  assert.equal(retryDelay('120', 65000, now), 120000);
  assert.equal(retryDelay('Fri, 06 Nov 2026 23:02:00 GMT', 65000, now), 120000);
  for (const value of [null, '0', '-1', 'invalid']) assert.equal(retryDelay(value, 65000, now), 65000);
  assert.equal(retryDelay('3', 1000, now), 3000);
  replaceGlobal(t, 'fetch', async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return { ok: false, status: 429, headers: new Headers({ 'Retry-After': '120' }) };
  });
  await assert.rejects(requestJSON('https://example.com'), error => error.retryAfter === 120000 && error.retryAt > Date.now());
});

test('external cancellation reaches the shared HTTP request', async t => {
  const controller = new AbortController();
  replaceGlobal(t, 'fetch', (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const pending = requestJSON('https://example.com', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('polling coalesces requests, honors retry delays, and retains valid data on failure', async t => {
  const { items } = browserState(t);
  const realNow = Date.now;
  let now = realNow(), calls = 0, fail = false, release;
  Date.now = () => now;
  t.after(() => { Date.now = realNow; });
  const states = [];
  const poller = watchResource({
    cacheKey: 'test-resource', validate: data => data?.value === 7,
    read: async () => {
      calls++;
      if (fail) { const error = new Error('Busy'); error.retryAfter = 120000; throw error; }
      return new Promise(resolve => { release = resolve; });
    }, onUpdate: state => states.push(state)
  });
  t.after(() => poller.stop());
  await poller.refresh();
  assert.equal(calls, 1);
  release({ value: 7 }); await settle();
  assert.equal(states.at(-1).data.value, 7);
  assert.equal(states.at(-1).failed, false);
  assert.equal(JSON.parse(items.get('test-resource')).data.value, 7);
  now += CONFIG.pollInterval + 1; fail = true;
  await poller.refresh();
  assert.equal(calls, 2);
  assert.equal(states.at(-1).data.value, 7);
  assert.equal(states.at(-1).failed, true);
  now += 119999; await poller.refresh();
  assert.equal(calls, 2);
});

test('polling pauses in hidden tabs and resumes on visibility', async t => {
  const { doc } = browserState(t);
  doc.hidden = true;
  let calls = 0;
  const poller = watchResource({ cacheKey: 'test-resource', validate: data => data === 7,
    read: async () => { calls++; return 7; }, onUpdate() {} });
  t.after(() => poller.stop());
  assert.equal(calls, 0);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  await settle();
  assert.equal(calls, 1);
});

test('cache validation rejects future and malformed fetch times, but reuses fresh observations', async t => {
  for (const fetchedAt of [Date.now() + 60000, String(Date.now()), Date.now() - CONFIG.staleAfter - 1]) {
    browserState(t, { data: 7, fetchedAt });
    let calls = 0;
    const poller = watchResource({ cacheKey: 'test-resource', validate: data => data === 7,
      read: async () => { calls++; return 7; }, onUpdate() {} });
    await settle(); poller.stop();
    assert.equal(calls, 1);
  }
  browserState(t, { data: 7, fetchedAt: Date.now() - 1000 });
  let calls = 0, value;
  const poller = watchResource({ cacheKey: 'test-resource', validate: data => data === 7,
    read: async () => { calls++; return 7; }, onUpdate: state => { value = state.data; } });
  poller.stop();
  assert.equal(calls, 0); assert.equal(value, 7);
});

test('GUI and CLI share their GitHub release request and unknown repositories are rejected', async t => {
  let calls = 0;
  replaceGlobal(t, 'fetch', async () => {
    calls++;
    return { ok: true, json: async () => ({ assets: [], tag_name: 'v1', html_url: 'https://github.com/PirateNetwork/pirate/releases/tag/v1' }) };
  });
  const [gui, cli] = await Promise.all([getRelease(CONFIG.wallets['treasure-chest'].repository), getRelease(CONFIG.wallets.cli.repository)]);
  assert.equal(calls, 1); assert.equal(gui, cli);
  await assert.rejects(getRelease('unconfigured/wallet'));
  assert.equal(calls, 1);
});
