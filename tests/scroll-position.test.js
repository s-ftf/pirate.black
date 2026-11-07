import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../assets/js/scroll-position.js', import.meta.url), 'utf8');

function bootstrap(href, { reload = false, cached = {} } = {}) {
  const location = new URL(href);
  const items = new Map(Object.entries(cached));
  const events = new Map();
  const state = { existing: 'history state' };
  let replacements = 0, restored;
  const history = {
    state, scrollRestoration: 'auto',
    replaceState(next, title, url) {
      replacements++;
      this.state = next;
      location.href = url.href;
    }
  };
  runInNewContext(script, {
    URL, location, history,
    sessionStorage: { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) },
    performance: { getEntriesByType: () => [{ type: reload ? 'reload' : 'navigate' }] },
    document: {
      documentElement: { classList: { add() {}, remove() {} } },
      addEventListener() {}, querySelectorAll: () => []
    },
    window: {
      addEventListener: (name, callback) => events.set(name, [...(events.get(name) || []), callback]),
      scrollTo: options => { restored = options; }
    },
    requestAnimationFrame: callback => callback(),
    scrollX: 0, scrollY: 850
  });
  for (const callback of events.get('load') || []) callback();
  return { location, history, state, items, events, replacements, restored: () => restored };
}

test('homepage URLs drop index.html while preserving the host, project path, query, and bookmark', () => {
  for (const prefix of ['https://pirate.black/', 'https://s-ftf.github.io/pirate.black/']) {
    const page = bootstrap(`${prefix}index.html?preview=1#projects`);
    assert.equal(page.location.href, `${prefix}?preview=1#projects`);
    assert.equal(page.history.state, page.state);
    assert.equal(page.replacements, 1);
    page.events.get('pagehide').forEach(callback => callback());
    const saved = JSON.parse(page.items.get(`pirate-scroll:${page.location.pathname}?preview=1`));
    assert.equal(saved.y, 850);
  }
});

test('directory URLs, other pages, and local file URLs are preserved', () => {
  for (const href of ['https://pirate.black/#network', 'https://pirate.black/varrr.html#reserve', 'file:///site/index.html#projects']) {
    const page = bootstrap(href);
    assert.equal(page.location.href, href);
    assert.equal(page.replacements, 0);
  }
});

test('a reload through index.html reuses the previous scroll record after URL cleanup', () => {
  const key = 'pirate-scroll:/pirate.black/index.html?preview=1';
  const page = bootstrap('https://s-ftf.github.io/pirate.black/index.html?preview=1#projects', {
    reload: true, cached: { [key]: JSON.stringify({ x: 0, y: 1234 }) }
  });
  assert.equal(page.history.scrollRestoration, 'manual');
  assert.equal(page.restored().top, 1234);
  page.events.get('pagehide').forEach(callback => callback());
  assert.equal(JSON.parse(page.items.get('pirate-scroll:/pirate.black/?preview=1')).y, 1234);
});
