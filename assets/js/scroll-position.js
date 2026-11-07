(() => {
  const previousKey = `pirate-scroll:${location.pathname}${location.search}`;
  // Keep homepage bookmarks on the directory URL, including project-path hosting.
  const url = new URL(location.href);
  if (/^https?:$/.test(url.protocol) && /\/index\.html$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/index\.html$/i, '');
    // Let the browser finish its initial fragment navigation before changing the URL.
    window.addEventListener('load', () => requestAnimationFrame(() => {
      const current = new URL(location.href);
      current.pathname = current.pathname.replace(/index\.html$/i, '');
      history.replaceState(history.state, '', current);
    }), { once: true });
  }
  const key = `pirate-scroll:${url.pathname}${url.search}`;
  let saved;
  try {
    saved = JSON.parse(sessionStorage.getItem(key) ?? sessionStorage.getItem(previousKey));
  } catch { /* Storage can be unavailable. */ }
  let restoring = performance.getEntriesByType('navigation')[0]?.type === 'reload'
    && Number.isFinite(saved?.x) && Number.isFinite(saved?.y);
  let observer, deadline, saveTimer;
  const previousRestoration = history.scrollRestoration;
  const restore = () => {
    if (restoring) window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
  };
  const finish = () => {
    restoring = false;
    observer?.disconnect(); clearTimeout(deadline);
    document.documentElement.classList.remove('restoring-scroll');
    history.scrollRestoration = previousRestoration;
  };
  const save = () => {
    try {
      sessionStorage.setItem(key, JSON.stringify(restoring ? saved : {
        x: scrollX, y: scrollY,
        openDetails: [...document.querySelectorAll('details[id][open]')].map(node => node.id)
      }));
    } catch { /* Keep native restoration when storage is unavailable. */ }
  };
  if (restoring) {
    history.scrollRestoration = 'manual';
    document.documentElement.classList.add('restoring-scroll');
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
      window.addEventListener(event, finish, { once: true, passive: true });
    }
    document.addEventListener('DOMContentLoaded', () => {
      if (!restoring) return;
      for (const id of Array.isArray(saved.openDetails) ? saved.openDetails : []) {
        const details = document.getElementById(id);
        if (details?.matches('details')) details.open = true;
      }
      restore();
      observer = new ResizeObserver(() => requestAnimationFrame(restore));
      observer.observe(document.body);
      document.fonts.ready.then(restore);
      deadline = setTimeout(() => { restore(); finish(); }, 8000);
    }, { once: true });
    window.addEventListener('load', restore, { once: true });
    window.addEventListener('hashchange', finish, { once: true });
  }
  window.addEventListener('scroll', () => {
    if (restoring || saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; save(); }, 100);
  }, { passive: true });
  window.addEventListener('pagehide', save);
})();
