/** Main site behavior. Data access lives in api.js; release sorting in wallet-releases.js. */
import {
  CONFIG,
  formatZat,
  formatRoundedARRR,
  formatCompactCount,
  formatCompactARRR,
  formatCompactSwapTime,
  formatNumber,
  safeURL,
  privacyCount,
  swapStatsAreValid,
  formatClaimTime,
  CALCULATOR_FIELDS,
  poolLastSeen,
  poolBlockCount,
  recentMiningPools,
  reserveCoverage,
  reserveComparison,
  watchNetwork,
  watchReserve,
  watchMiningPreset,
  calculateMining,
  getRelease,
  loadLatestVideo,
  loadPublications
} from './api.js?v=3';
import { releaseLinks, pairDownloadSignatures } from './wallet-releases.js?v=1';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setStat(name, value, timestamp) {
  document.querySelectorAll(`[data-stat="${name}"]`).forEach(node => {
    node.textContent = value;
    if (timestamp) {
      node.title = `Source updated ${new Date(timestamp).toLocaleString()}`;
      if (node.tagName === 'TIME') node.dateTime = timestamp;
    }
  });
}

// Apply the same external-link behavior to static content and asynchronously rendered links.
function setupExternalLinks() {
  const iconExceptions = '.discord-link, .contribute-button, .x-post-account, .stashi-play, .download-signature, ' +
    '[data-no-external-icon], [data-download-section="Signatures"], .watch-footer, #publications, #resources, .video-player > a';
  function enhance(link) {
    const href = link.getAttribute('href');
    if (!href) return;
    let url;
    try { url = new URL(href, location.href); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === location.origin) return;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const showIcon = !link.closest(iconExceptions);
    if (!showIcon) link.querySelectorAll('.external-link-icon').forEach(icon => icon.remove());
    if (showIcon && !link.querySelector('.external-link-icon')) {
      const icon = element('span', 'external-link-icon');
      icon.setAttribute('aria-hidden', 'true');
      (link.querySelector('.pool-name') || link).append(icon);
    }
  }
  function visit(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches('a[href]')) enhance(node);
    node.querySelectorAll('a[href]').forEach(enhance);
  }
  visit(document.body);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') enhance(record.target);
      else {
        record.addedNodes.forEach(visit);
        const parent = record.target.closest?.('a[href]');
        if (parent) enhance(parent);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
}

// Network, privacy pools, swap activity, and vARRR reserve.
function setupNetwork() {
  if (!document.querySelector('#network')) return;
  let previous;
  watchNetwork(({ data, failed }) => {
    if (data && data !== previous) {
      previous = data;
      const peers = data.network.peer_count;
      setStat('peers', Number.isSafeInteger(peers) && peers >= 0 ? formatNumber(peers) : '—', data.network.updated_at);
      renderPrivacy(data);
      renderMiningPools(data['mining-pools']);
      renderSwaps(data.swaps);
    } else if (!data && failed) {
      document.querySelector('#pools')?.replaceChildren(element('p', 'loading-note', 'Pool activity is temporarily unavailable.'));
    }
  });
}

function renderSwaps(group) {
  const valid = swapStatsAreValid(group);
  const values = valid ? {
    funded: formatCompactCount(group.funded_count),
    claimTime: formatCompactSwapTime(group.median_claim_seconds),
    claimedAmount: formatCompactARRR(group.claimed_zat)
  } : {};
  const full = valid ? {
    funded: `${formatNumber(group.funded_count)} swaps`,
    claimedAmount: `${formatRoundedARRR(group.claimed_zat)} ARRR`,
    claimTime: formatClaimTime(group.median_claim_seconds)
  } : {};
  document.querySelectorAll('[data-swap-stat]').forEach(node => {
    node.textContent = values[node.dataset.swapStat] ?? '—';
    if (valid) node.title = `${full[node.dataset.swapStat]} · Source updated ${new Date(group.updated_at).toLocaleString()}`;
    else node.removeAttribute('title');
  });
}

function setupReserveStats() {
  const monitor = document.querySelector('[data-reserve-monitor]');
  if (!monitor) return;
  const status = monitor.querySelector('[data-data-status]');
  const result = monitor.querySelector('[data-reserve-result]');
  watchReserve(({ data, stale, failed }) => {
    if (data) {
      setStat('locked', formatZat(data.varrr_locked_zat, 0), data.updated_at);
      setStat('reserveRatio', reserveCoverage(data.varrr_locked_zat), data.updated_at);
      setStat('reserveDate', new Date(data.updated_at).toLocaleString(), data.updated_at);
    }
    const health = data && !stale && !failed ? reserveComparison(data.varrr_locked_zat) : data ? 'stale' : failed ? 'unavailable' : 'waiting';
    monitor.dataset.health = health;
    result.textContent = {
      matched: '100% ARRR exists', above: 'Locked balance is above the target',
      below: 'Locked balance is below the target', stale: 'Awaiting a fresh reserve observation',
      unavailable: 'Reserve check currently unavailable', waiting: 'Checking the locked balance…'
    }[health];
    status.hidden = Boolean(data && !stale && !failed);
    status.textContent = data ? `Last known · ${new Date(data.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Pirate Watch`
      : failed ? 'Data unavailable · retrying automatically' : 'Connecting to Pirate Watch…';
  });
}
function renderPrivacy(data) {
  document.querySelectorAll('[data-privacy-pool]').forEach(card => {
    const count = privacyCount(data.privacy, card.dataset.privacyPool);
    card.querySelector('.privacy-count').textContent = formatNumber(count);
    if (count !== null) card.querySelector('.privacy-count').title = `Source updated ${new Date(data.privacy.updated_at).toLocaleString()}`;
    else card.querySelector('.privacy-count').removeAttribute('title');
  });
}

function ago(timestamp) {
  if (timestamp === null) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function renderMiningPools(group) {
  const container = document.querySelector('#pools');
  if (!container) return;
  const pools = recentMiningPools(group);
  if (!pools.length) return;
  const header = element('div', 'pool-list-heading');
  header.append(element('span', '', 'Pool'), element('span', '', 'Last seen'), element('span', '', 'Total blocks'));
  const rows = pools.map(pool => {
    const url = safeURL(pool.url);
    const row = element(url ? 'a' : 'div', 'pool-row');
    if (url) row.href = url;
    const seen = poolLastSeen(pool);
    const time = element('time', 'pool-last-seen', ago(seen));
    if (seen !== null) {
      time.dateTime = new Date(seen).toISOString();
      time.title = `Last observed block: ${new Date(seen).toLocaleString()}`;
    }
    const blocks = poolBlockCount(pool);
    const value = element('span', 'pool-blocks', formatCompactCount(blocks));
    if (blocks !== null) value.title = `${formatNumber(blocks)} total blocks`;
    row.append(element('span', 'pool-name', pool.name), time, value);
    return row;
  });
  container.replaceChildren(header, ...rows);
}
// Wallet platform dialogs and core-wallet bookmarks.
function createWalletDownloads() {
  const models = new WeakMap();
  let dialog, title, version, tabs, panel, current;

  function renderGroup(target, group) {
    const list = element('div', 'wallet-dialog-links');
    let section;
    for (const file of pairDownloadSignatures(group.links)) {
      if (file.section && file.section !== section) {
        list.append(element('h4', 'wallet-download-section', file.section));
        section = file.section;
      }
      const link = element('a', file.source ? 'download-source' : '', file.label);
      link.href = file.href;
      if (file.title) link.title = file.title;
      if (file.source && target.closest('.wallet-download-dialog')) {
        const icon = element('img');
        icon.src = 'assets/img/os/github.svg'; icon.alt = ''; icon.width = 22; icon.height = 22;
        link.prepend(icon);
      }
      const row = element('div', 'wallet-download-row');
      row.append(link);
      if (file.signature) {
        const signature = element('a', 'download-signature');
        signature.href = file.signature.href;
        const label = `Download signature for ${file.label.replace(/[\s↗]+$/g, '')}`;
        signature.title = label;
        signature.setAttribute('aria-label', label);
        const icon = element('img');
        icon.src = 'assets/img/icons/file-signature.svg'; icon.alt = ''; icon.width = 18; icon.height = 18;
        signature.append(icon);
        row.append(signature);
      }
      list.append(row);
    }
    target.replaceChildren(element('h3', '', group.name), list);
  }

  function selectPlatform(index, focus = false) {
    current.index = index;
    const group = current.model.groups[index];
    [...tabs.children].forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `wallet-download-tab-${index}`);
    renderGroup(panel, group);
    if (focus) tabs.children[index].focus();
  }

  function openDownloads(wallet, name, trigger) {
    const model = models.get(wallet);
    current = { wallet, model, trigger, initialName: name, index: 0 };
    title.textContent = model.name;
    version.textContent = model.version;
    version.href = model.versionURL || '#';
    version.hidden = !model.version;
    tabs.replaceChildren(...model.groups.map((group, index) => {
      const button = element('button', 'wallet-platform-tab');
      button.type = 'button';
      button.id = `wallet-download-tab-${index}`;
      button.title = group.name;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-label', group.name);
      button.setAttribute('aria-controls', 'wallet-download-panel');
      const icon = element('img');
      icon.src = group.icon; icon.alt = ''; icon.width = 36; icon.height = 38;
      button.append(icon);
      button.addEventListener('click', () => selectPlatform(index));
      return button;
    }));
    selectPlatform(Math.max(0, model.groups.findIndex(group => group.name === name)));
    document.body.classList.add('download-modal-open');
    dialog.showModal();
  }

  function setupDownloadDialog() {
    if (dialog) return;
    dialog = element('dialog', 'wallet-download-dialog');
    dialog.setAttribute('aria-labelledby', 'wallet-download-title');
    const close = element('button', 'wallet-dialog-close', '×');
    close.type = 'button'; close.autofocus = true;
    close.setAttribute('aria-label', 'Close downloads');
    close.addEventListener('click', () => dialog.close());
    title = element('h2'); title.id = 'wallet-download-title';
    version = element('a', 'wallet-dialog-version');
    version.href = 'https://github.com/PirateNetwork/Stashi-Wallet/releases';
    tabs = element('div', 'wallet-platform-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Wallet platforms');
    tabs.addEventListener('keydown', event => {
      const length = current.model.groups.length;
      let index = current.index;
      if (event.key === 'ArrowRight') index = (index + 1) % length;
      else if (event.key === 'ArrowLeft') index = (index + length - 1) % length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = length - 1;
      else return;
      event.preventDefault(); selectPlatform(index, true);
    });
    panel = element('div', 'wallet-download-panel');
    panel.id = 'wallet-download-panel'; panel.setAttribute('role', 'tabpanel');
    const header = element('div', 'stashi-dialog-header');
    const heading = element('div'); heading.append(title, version);
    const art = element('img', 'stashi-dialog-art');
    art.src = 'assets/img/stashi/stashi-gold-scene.svg'; art.alt = ''; art.width = 176; art.height = 176;
    header.append(heading, art);
    dialog.append(close, header, tabs, panel);
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('download-modal-open');
      const trigger = current.trigger.isConnected ? current.trigger : [...current.wallet.querySelectorAll('[data-wallet-platform]')].find(button => button.dataset.walletPlatform === current.initialName);
      trigger?.focus({ preventScroll: true });
      current = null;
    });
    document.body.append(dialog);
  }

  function hasWalletDownloads(wallet) { return models.has(wallet); }

  function closeDownloadDialog() { if (dialog?.open) dialog.close(); }
  function resetWalletPlatforms(wallet) { models.get(wallet)?.reset?.(); }

  function inlinePlatforms(wallet, groups, model, previous) {
    const picker = element('div', 'wallet-platform-tabs core-wallet-platforms');
    picker.setAttribute('role', 'tablist');
    const label = element('p', 'core-wallet-os-label', 'Select OS');
    label.id = `${wallet.id}-platform-label`;
    picker.setAttribute('aria-labelledby', label.id);
    const target = element('div', 'wallet-download-panel');
    target.id = `${wallet.id}-platform-panel`;
    target.setAttribute('role', 'tabpanel');
    let selected = model.groups.findIndex(group => group.name === previous);
    function clear() {
      selected = -1;
      model.selected = null;
      [...picker.children].forEach((tab, i) => {
        tab.setAttribute('aria-selected', 'false');
        tab.tabIndex = i === 0 ? 0 : -1;
      });
      target.hidden = true;
      target.removeAttribute('aria-labelledby');
      target.replaceChildren();
    }
    model.reset = clear;
    function select(index, focus = false) {
      selected = index;
      const group = model.groups[index];
      model.selected = group.name;
      target.hidden = false;
      [...picker.children].forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      target.setAttribute('aria-labelledby', `${wallet.id}-platform-${index}`);
      renderGroup(target, group);
      if (focus) picker.children[index].focus();
    }
    model.groups.forEach((group, index) => {
      const button = element('button', 'wallet-platform-tab');
      button.type = 'button';
      button.id = `${wallet.id}-platform-${index}`;
      button.title = group.name;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-label', group.name);
      button.setAttribute('aria-controls', target.id);
      const icon = element('img');
      icon.src = group.icon; icon.alt = ''; icon.width = 36; icon.height = 38;
      button.append(icon);
      button.addEventListener('click', () => select(index));
      picker.append(button);
    });
    picker.addEventListener('keydown', event => {
      let index = selected < 0 && event.key === 'ArrowLeft' ? 0 : selected;
      if (event.key === 'ArrowRight') index = (index + 1) % model.groups.length;
      else if (event.key === 'ArrowLeft') index = (index + model.groups.length - 1) % model.groups.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = model.groups.length - 1;
      else return;
      event.preventDefault(); select(index, true);
    });
    if (selected >= 0) select(selected); else clear();
    groups.replaceWith(label, picker, target);
  }

  function enhanceWalletDownloads(wallet) {
    let groups = wallet.querySelector('.download-groups');
    const core = wallet.hasAttribute('data-core-wallet-dialog');
    if (!groups && !core) return;
    const platforms = [...(groups?.querySelectorAll('.download-group') || [])].map(group => ({
      name: group.querySelector('h4')?.textContent.trim(),
      icon: group.querySelector('img')?.getAttribute('src'),
      links: [...(group.querySelector('h4')?.parentElement.querySelectorAll('a') || [])].map(link => ({
        label: link.textContent.trim(), href: link.href, title: link.title, source: link.classList.contains('download-source'), section: link.dataset.downloadSection || ''
      }))
    })).filter(group => group.name && group.icon && group.links.length);
    if (wallet.hasAttribute('data-wallet-feature')) {
      const github = platforms.find(group => group.icon.endsWith('/github.svg'));
      if (github) github.links = github.links.filter(link => link.source);
    }
    if (core) {
      let github = platforms.find(group => group.icon.endsWith('/github.svg'));
      if (!github) {
        github = { name: 'GitHub', icon: 'assets/img/os/github.svg', links: [] };
        platforms.push(github);
      }
      github.name = 'GitHub';
      const href = `https://github.com/${wallet.dataset.walletRepository}`;
      github.links = [{ label: 'Source code', href, source: true }, ...github.links.filter(link => link.href !== href)];
      if (!groups) {
        groups = element('div', 'download-groups');
        wallet.querySelector('.downloads').replaceChildren(groups);
      }
    }
    if (!platforms.length) return;
    const release = wallet.querySelector('[data-wallet-version], .release-version');
    const previous = models.get(wallet)?.selected;
    const model = {
      name: wallet.querySelector('h2, .wallet-name')?.textContent.trim() || 'Wallet downloads',
      version: release?.textContent.trim() || '', versionURL: release?.href || '', groups: platforms
    };
    models.set(wallet, model);
    if (core) {
      inlinePlatforms(wallet, groups, model, previous);
      return;
    }
    const picker = element('div', 'wallet-platform-picker');
    for (const group of platforms) {
      const button = element('button', 'wallet-platform-choice');
      button.type = 'button'; button.dataset.walletPlatform = group.name;
      button.title = group.name;
      button.setAttribute('aria-label', `${group.name} downloads`);
      button.setAttribute('aria-haspopup', 'dialog');
      const icon = element('img');
      icon.src = group.icon; icon.alt = ''; icon.width = 36; icon.height = 38;
      button.append(icon);
      button.addEventListener('click', () => openDownloads(wallet, group.name, button));
      picker.append(button);
    }
    groups.replaceWith(picker);
  }
  return { setupDownloadDialog, enhanceWalletDownloads, hasWalletDownloads, closeDownloadDialog, resetWalletPlatforms };
}

const { setupDownloadDialog, enhanceWalletDownloads, hasWalletDownloads, closeDownloadDialog, resetWalletPlatforms } = createWalletDownloads();
const ICONS = { 'treasure-chest': 'treasure-chest', 'paper-wallet': 'paper-wallet', 'cli-wallet': 'cli' };

export function walletBookmark(hash) {
  try {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    return Object.hasOwn(ICONS, id) ? id : null;
  } catch { return null; }
}

function setupCoreWalletDialogs(loadWallet) {
  const wallets = new Map();
  let current, scrollRequest;
  const unlock = () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('download-modal-open');
  };

  document.querySelectorAll('#wallets details[data-wallet]').forEach(details => {
    const summary = details.querySelector('summary');
    const content = details.querySelector('.wallet-content');
    const name = summary.querySelector('.wallet-name').textContent.trim();
    const id = details.id;
    const row = element('article', 'wallet core-wallet');
    row.id = id;
    const trigger = element('a', 'core-wallet-trigger');
    trigger.href = `#${id}`;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', `${id}-dialog`);
    trigger.append(...summary.childNodes);
    const arrow = trigger.querySelector('.expand');
    arrow.className = 'wallet-open-icon';
    arrow.textContent = '›';
    row.append(trigger);

    const dialog = element('dialog', 'core-wallet-dialog');
    dialog.id = `${id}-dialog`;
    dialog.dataset.wallet = details.dataset.wallet;
    dialog.dataset.walletRepository = CONFIG.wallets[details.dataset.wallet].repository;
    dialog.setAttribute('data-core-wallet-dialog', '');
    dialog.setAttribute('aria-labelledby', `${id}-dialog-title`);
    const close = element('button', 'core-wallet-close', '×');
    close.type = 'button';
    close.autofocus = true;
    close.setAttribute('aria-label', `Close ${name}`);
    const heading = element('div', 'core-wallet-heading');
    const icon = element('img');
    icon.src = `assets/img/wallets/${ICONS[id]}-gold.svg`;
    icon.alt = ''; icon.width = 88; icon.height = 88;
    const title = element('h2', '', name);
    title.id = `${id}-dialog-title`;
    heading.append(icon, title);
    const metadata = element('div', 'core-wallet-meta');
    const links = content.querySelector('.wallet-links');
    links?.querySelectorAll('a').forEach(link => {
      if (/source code|latest release/i.test(link.textContent)) return;
      if (/documentation|guide|instructions/i.test(link.textContent)) {
        link.classList.add('wallet-documentation');
        const book = element('img');
        book.src = 'assets/img/icons/documentation.svg';
        book.alt = ''; book.width = 18; book.height = 18;
        link.prepend(book);
      }
      metadata.append(link);
    });
    links?.remove();
    const version = content.querySelector('.release-version');
    if (version) {
      version.textContent = version.textContent.replace(/\s*·\s*Release notes/i, ' (release notes)');
      metadata.prepend(version);
    }
    content.insertBefore(metadata, content.querySelector('.downloads'));
    dialog.append(close, heading, content);
    details.replaceWith(row);
    document.body.append(dialog);
    enhanceWalletDownloads(dialog);
    const wallet = { id, row, trigger, dialog };
    wallets.set(id, wallet);

    trigger.addEventListener('click', event => {
      if (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const preserve = { x: scrollX, y: scrollY };
      if (walletBookmark(location.hash) !== id) history.pushState(history.state, '', trigger.href);
      syncHash({ preserve });
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (current === wallet) {
        current = null;
        row.removeAttribute('data-wallet-active');
        if (walletBookmark(location.hash) === id) history.replaceState(history.state, '', '#wallets');
        trigger.focus({ preventScroll: true });
        if (wallet.position) window.scrollTo({ left: wallet.position.x, top: wallet.position.y, behavior: 'instant' });
      }
      unlock();
    });
  });

  function syncHash({ scroll = false, preserve } = {}) {
    cancelAnimationFrame(scrollRequest);
    const id = walletBookmark(location.hash);
    const next = wallets.get(id);
    if (current === next && next?.dialog.open) return;
    if (current) {
      const previous = current;
      current = null;
      previous.row.removeAttribute('data-wallet-active');
      previous.dialog.close();
    }
    const target = next?.row || (location.hash === '#stashi' ? document.querySelector('#stashi') : null);
    if (!target) { unlock(); return; }
    closeDownloadDialog();
    scrollRequest = requestAnimationFrame(() => {
      if (scroll && !document.documentElement.classList.contains('restoring-scroll')) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (!next) return;
      next.position = preserve || { x: scrollX, y: scrollY };
      current = next;
      next.row.setAttribute('data-wallet-active', '');
      document.body.classList.add('download-modal-open');
      resetWalletPlatforms(next.dialog);
      next.dialog.showModal();
      next.dialog.scrollTop = 0;
      window.scrollTo({ left: next.position.x, top: next.position.y, behavior: 'instant' });
      loadWallet(next.dialog);
    });
  }

  window.addEventListener('hashchange', () => syncHash());
  window.addEventListener('popstate', () => syncHash());
  syncHash({ scroll: true });
}const platformIcons = { Windows: 'windows', 'Mac OS': 'apple', Linux: 'linux', 'ARM Linux': 'arm', 'Android APK': 'android', iOS: 'ios', Resources: 'github' };
const order = ['Windows', 'Mac OS', 'iOS', 'Linux', 'ARM Linux', 'Android APK', 'Resources'];

async function loadWallet(details) {
  if (details.dataset.loading || details.dataset.loaded) return;
  const wallet = CONFIG.wallets[details.dataset.wallet];
  if (!wallet) return;
  const container = details.querySelector('.downloads');
  const featured = details.hasAttribute('data-wallet-feature');
  details.dataset.loading = 'true';
  container.setAttribute('aria-busy', 'true');
  if (!featured && !hasWalletDownloads(details)) container.replaceChildren(element('p', 'loading-note', 'Reading the latest release…'));
  try {
    const release = await getRelease(wallet.repository);
    const files = releaseLinks(release, wallet);
    const version = element('a', 'release-version', `${release.tag_name} (release notes)`);
    version.href = release.html_url;
    const groups = element('div', 'download-groups');
    for (const os of order) {
      const matches = files.filter(file => file.os === os && (!featured || file.os !== 'Resources'));
      if (!matches.length) continue;
      const group = element('div', 'download-group');
      const icon = element('img');
      icon.src = `assets/img/os/${platformIcons[os]}.svg`; icon.alt = ''; icon.width = 36; icon.height = 38;
      const content = element('div');
      content.append(element('h4', '', os === 'Mac OS' ? 'macOS' : os));
      for (const file of matches) {
        const link = element('a', '', `${file.label}`);
        link.href = file.link; link.title = file.name;
        if (file.section) link.dataset.downloadSection = file.section;
        content.append(link);
      }
      group.append(icon, content); groups.append(group);
    }
    if (featured) {
      const featuredVersion = details.querySelector('[data-wallet-version]');
      if (featuredVersion) {
        featuredVersion.textContent = `${release.tag_name} (release notes)`;
        featuredVersion.href = version.href;
      }
      container.replaceChildren(groups);
      const group = element('div', 'download-group download-links');
      const icon = element('img');
      icon.src = 'assets/img/os/github.svg'; icon.alt = ''; icon.width = 36; icon.height = 38;
      const sourceIcon = element('a', 'download-source-icon');
      sourceIcon.href = `https://github.com/${wallet.repository}`;
      sourceIcon.setAttribute('aria-label', `${details.querySelector('h2')?.textContent.trim() || 'Wallet'} source code on GitHub`);
      sourceIcon.append(icon);
      const content = element('div');
      content.append(element('h4', '', 'Links'));
      const source = element('a', 'download-source', 'Source code');
      source.href = `https://github.com/${wallet.repository}`;
      content.append(source);
      group.append(sourceIcon, content); groups.append(group);
    } else if (details.hasAttribute('data-core-wallet-dialog')) {
      const metadata = details.querySelector('.core-wallet-meta');
      metadata.querySelector('.release-version')?.remove();
      metadata.prepend(version);
      container.replaceChildren(groups);
    } else container.replaceChildren(version, groups);
    if (!files.length) container.append(element('p', 'loading-note', 'No matching packages in this release. Open the release notes or GitHub for available files.'));
    enhanceWalletDownloads(details);
    details.dataset.loaded = 'true';
  } catch {
    const retry = element('button', 'retry-button', 'Try again ↻');
    retry.type = 'button'; retry.addEventListener('click', () => loadWallet(details));
    if (container.querySelector('.download-groups') || hasWalletDownloads(details)) {
      container.querySelector('.retry-button')?.remove();
      retry.textContent = 'Check for newer downloads ↻';
      container.append(retry);
    } else container.replaceChildren(element('p', 'error-note', 'GitHub downloads are temporarily unavailable. Open GitHub for available files, or retry.'), retry);
  } finally { delete details.dataset.loading; container.removeAttribute('aria-busy'); }
}

function setupWallets() {
  if (!document.querySelector('[data-wallet]')) return;
  setupDownloadDialog();
  document.querySelectorAll('[data-wallet-feature]').forEach(wallet => {
    enhanceWalletDownloads(wallet);
    lazy(wallet, () => loadWallet(wallet));
  });
  setupCoreWalletDialogs(loadWallet);
}
// Live feeds enhance the editable HTML; a failed request leaves it intact.
function articleImage(item, local) {
  if (typeof local === 'string' && /^assets\/img\/publications\/[a-f0-9]{12}\.(png|jpg|webp)$/.test(local)) return local;
  const content = typeof item.content === 'string' ? item.content : typeof item.description === 'string' ? item.description : '';
  const candidates = [item.thumbnail, ...[...content.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1].replaceAll('&amp;', '&'))];
  return candidates.map(url => safeURL(url, ['cdn-images-1.medium.com', 'cdn-images-2.medium.com', 'miro.medium.com'])).find(Boolean);
}

function renderArticles(items) {
  const container = document.querySelector('#publication-list');
  if (!container) return false;
  const articles = items.filter(item => typeof item.title === 'string' && safeURL(item.link, ['medium.com']) && Number.isFinite(Date.parse(item.pubDate))).slice(0, 3);
  if (articles.length < 3) return false;
  const fallbackImages = new Map([...container.querySelectorAll('.publication-row')].map(row =>
    [row.href.split('?')[0], row.querySelector('img')?.getAttribute('src')]));
  container.replaceChildren(...articles.map(item => {
    const row = element('a', 'publication-row'); row.href = safeURL(item.link, ['medium.com']);
    row.setAttribute('itemscope', ''); row.setAttribute('itemtype', 'https://schema.org/Article'); row.setAttribute('itemid', row.href.split('?')[0]);
    const date = item.pubDate.slice(0, 10);
    const time = element('time', '', new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));
    time.dateTime = date; time.setAttribute('itemprop', 'datePublished');
    const imageURL = articleImage(item, fallbackImages.get(item.link.split('?')[0]));
    if (imageURL) {
      const image = element('img', 'publication-thumbnail');
      image.setAttribute('itemprop', 'image');
      image.src = imageURL; image.alt = ''; image.loading = 'lazy'; image.width = 528; image.height = 297;
      row.append(image);
    } else row.classList.add('publication-without-thumbnail');
    const copy = element('div', 'publication-copy');
    const heading = element('h3', '', item.title); heading.setAttribute('itemprop', 'headline');
    copy.append(time, heading);
    row.append(copy);
    return row;
  }));
  return true;
}

function setupVideos() {
  const container = document.querySelector('#videos');
  if (!container) return;
  container.querySelectorAll('.video-player > a[data-video-id]').forEach(link => {
    const button = element('button');
    button.type = 'button';
    button.dataset.videoId = link.dataset.videoId;
    button.setAttribute('aria-label', link.getAttribute('aria-label'));
    button.append(...link.childNodes);
    button.addEventListener('click', () => {
      const id = button.dataset.videoId;
      if (!/^[\w-]{11}$/.test(id)) return;
      const iframe = element('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      iframe.title = button.getAttribute('aria-label');
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      button.parentElement.replaceChildren(iframe);
      iframe.focus({ preventScroll: true });
    });
    link.replaceWith(button);
  });
  lazy(container, async () => {
    try {
      const video = await loadLatestVideo();
      const article = container.querySelector('[data-latest-video]');
      const button = article?.querySelector('.video-player > button');
      if (!button) return; // Keep an already-playing video uninterrupted.
      button.dataset.videoId = video.id;
      button.setAttribute('aria-label', `Play ${video.title} on YouTube`);
      button.querySelector('img:not(.youtube-play-icon)').src = video.image;
      const link = article.querySelector('h3 a');
      link.textContent = video.title;
      link.href = `https://www.youtube.com/watch?v=${video.id}`;
    } catch { /* Keep the video and thumbnail written in the HTML. */ }
  });
}

function lazy(section, task) {
  if (!section) return;
  if (!('IntersectionObserver' in window)) { task(); return; }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); task(); }
  }, { rootMargin: '500px' });
  observer.observe(section);
}

function setupMedia() {
  setupVideos();
  lazy(document.querySelector('#publications'), async () => {
    const status = document.querySelector('#publication-status');
    try {
      const items = await loadPublications();
      if (!renderArticles(items)) throw new Error('Insufficient publication entries');
      status.hidden = true;
    } catch {
      status.hidden = false;
      status.textContent = 'Showing selected articles. Open the publication for the latest.';
    }
  });
}
// Mining calculator UI. API requests and polling are centralized.
function calculatorWarning(code) {
  const messages = {
    price_unavailable: 'Enter an ARRR price to include USD revenue.',
    power_unknown: 'Power is unknown, so energy costs and net income are unavailable.',
    cost_unknown: 'Equipment cost is unknown, so capital payback is unavailable.',
    equipment_cost_unknown: 'Equipment cost is unknown, so capital payback is unavailable.'
  };
  return messages[code] || code.replaceAll('_', ' ');
}

function setupMiningCalculator() {
  const form = document.querySelector('#mining-calculator');
  if (!form) return;
  const dialog = document.querySelector('#mining-calculator-dialog');
  const open = document.querySelector('#open-mining-calculator');
  const fieldset = form.querySelector('fieldset');
  const minerSelect = form.elements.namedItem('miner_id');
  const submit = form.querySelector('#calculate-mining');
  const retry = form.querySelector('#retry-mining');
  const status = form.querySelector('#calculator-status');
  const setup = form.querySelector('#calculator-setup');
  const results = form.querySelector('#calculator-results');
  const setupTab = dialog.querySelector('#calculator-setup-tab');
  const resultsTab = dialog.querySelector('#calculator-results-tab');
  const previewStatus = document.querySelector('#mining-preview-status');
  let defaults, calculation, controller;
  let sequence = 0, nextAllowed = 0, unlockTimer;
  const number = (value, digits = 2) => typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
  const money = value => typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) : '—';
  const readInputs = () => Object.fromEntries(['miner_id', ...CALCULATOR_FIELDS].map(key => {
    const input = form.elements.namedItem(key);
    return [key, key === 'miner_id' ? input.value : input.value === '' ? null : input.valueAsNumber];
  }));

  function view(which, focus = false) {
    const showResults = which === 'results' && calculation?.results;
    setup.hidden = Boolean(showResults);
    results.hidden = !showResults;
    setupTab.setAttribute('aria-selected', String(!showResults));
    resultsTab.setAttribute('aria-selected', String(Boolean(showResults)));
    setupTab.tabIndex = showResults ? -1 : 0;
    resultsTab.tabIndex = showResults ? 0 : -1;
    dialog.scrollTop = 0;
    if (showResults && !form.hasAttribute('aria-busy')) status.textContent = results.classList.contains('calculator-previous')
      ? 'Previous estimate. Calculate to apply your input changes.' : 'Estimate after difficulty adjustment and pool fee.';
    if (focus && dialog.open) (showResults ? resultsTab : setupTab).focus();
  }

  function fillDefaults() {
    minerSelect.replaceChildren(...defaults.form.miners.map(miner => new Option(miner.name, miner.id)));
    minerSelect.value = defaults.inputs.miner_id;
    CALCULATOR_FIELDS.forEach(key => {
      const input = form.elements.namedItem(key);
      const bounds = defaults.form.fields?.[key];
      if (Number.isFinite(bounds?.minimum)) input.min = bounds.minimum;
      if (Number.isFinite(bounds?.maximum)) input.max = bounds.maximum;
      input.step = bounds?.integer ? '1' : 'any';
      input.value = defaults.inputs[key] ?? '';
    });
    fieldset.disabled = false;
  }

  function renderPreview(data) {
    const { inputs, results: value } = data;
    const miner = data.form.miners.find(item => item.id === inputs.miner_id);
    document.querySelector('#mining-preview-miner').textContent = miner.name;
    document.querySelector('#mining-preview-arrr').textContent = number(value?.daily?.arrr);
    document.querySelector('#mining-preview-net').textContent = typeof value?.daily?.net_usd === 'number'
      ? `${money(value.daily.net_usd)} net / day` : 'Net income unavailable';
    const stale = [data.network?.state, data.network?.subsidy_state, data.market?.state].some(state => state && state !== 'normal');
    previewStatus.textContent = value ? (stale ? 'Last known estimate' : '') : 'Network inputs unavailable';
  }

  function renderResult(data) {
    calculation = data;
    resultsTab.disabled = !data.results;
    form.querySelector('#calculator-warnings').textContent = (data.warnings || []).filter(item => typeof item === 'string').map(calculatorWarning).join(' ');
    if (!data.results) {
      status.textContent = 'Network inputs are unavailable. Please try again.';
      return;
    }
    const result = data.results;
    const miner = data.form.miners.find(item => item.id === data.inputs.miner_id);
    form.querySelector('#calculator-scenario').textContent = `${number(data.inputs.quantity, 0)} × ${miner.name}`;
    form.querySelector('#daily-reward').textContent = number(result.daily?.arrr, 4);
    form.querySelector('#daily-net').textContent = money(result.daily?.net_usd);
    const values = {
      energy: Number.isFinite(result.daily?.energy_kwh) ? `${number(result.daily.energy_kwh)} kWh` : 'Unknown power',
      breakEven: Number.isFinite(result.break_even_usd_kwh) ? `${money(result.break_even_usd_kwh)} / kWh` : '—',
      payback: Number.isFinite(result.payback_days) ? `${number(result.payback_days, 0)} days` : 'Unavailable',
      share: Number.isFinite(result.network_share) ? `${number(result.network_share * 100, 4)}%` : '—'
    };
    form.querySelectorAll('[data-calc]').forEach(node => { node.textContent = values[node.dataset.calc]; });
    const periods = { hour: 'Hour', day: 'Day', week: 'Week', month: '30 days', year: '1 year' };
    form.querySelector('#calculator-payouts').replaceChildren(...(result.payouts || []).map(payout => {
      const row = element('tr');
      row.dataset.period = payout.period;
      row.dataset.selected = String(payout.period === form.querySelector('#calculator-period').value);
      const heading = element('th', '', periods[payout.period] || payout.period);
      heading.scope = 'row';
      const labels = ['ARRR', 'Gross USD', 'Electricity USD', 'Net USD'];
      row.append(heading, ...[number(payout.arrr, 4), money(payout.revenue_usd), money(payout.electricity_usd), money(payout.net_usd)].map((value, index) => {
        const cell = element('td', '', value);
        cell.dataset.label = labels[index];
        return cell;
      }));
      return row;
    }));
    status.textContent = 'Estimate after difficulty adjustment and pool fee.';
    results.classList.remove('calculator-previous');
  }

  function unlock() {
    const wait = Math.max(0, nextAllowed - Date.now());
    submit.disabled = wait > 0;
    retry.disabled = wait > 0;
    clearTimeout(unlockTimer);
    if (wait) unlockTimer = setTimeout(() => { submit.disabled = false; retry.disabled = false; }, wait);
  }

  function changed() {
    sequence++;
    controller?.abort();
    form.removeAttribute('aria-busy');
    submit.textContent = 'Calculate';
    unlock();
    if (calculation?.results) results.classList.add('calculator-previous');
    status.textContent = calculation?.results ? 'Inputs changed. Calculate to update the previous estimate.' : 'Choose your miner and costs.';
    retry.hidden = true;
  }

  async function calculate() {
    if (Date.now() < nextAllowed || !defaults || !form.reportValidity()) return;
    controller?.abort();
    const active = new AbortController();
    controller = active;
    const request = ++sequence;
    submit.disabled = true;
    submit.textContent = 'Calculating…';
    retry.hidden = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Calculating your setup…';
    try {
      const data = await calculateMining(readInputs(), { signal: active.signal });
      if (request !== sequence) return;
      renderResult(data);
      if (data.results) view('results', true);
    } catch (error) {
      if (request !== sequence) return;
      nextAllowed = Math.max(nextAllowed, error.retryAt || Date.now() + 1000);
      status.textContent = 'Calculation unavailable. Your inputs and previous estimate are retained.';
      retry.hidden = false;
      if (calculation?.results) results.classList.add('calculator-previous');
    } finally {
      if (request === sequence) {
        form.removeAttribute('aria-busy');
        submit.textContent = 'Calculate';
        unlock();
      }
    }
  }

  open.addEventListener('click', () => {
    view('setup');
    document.body.classList.add('download-modal-open');
    dialog.showModal();
    (defaults ? minerSelect : dialog.querySelector('.mining-dialog-close')).focus();
  });
  dialog.querySelector('.mining-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('download-modal-open');
    open.focus({ preventScroll: true });
  });
  setupTab.addEventListener('click', () => view('setup'));
  resultsTab.addEventListener('click', () => view('results'));
  dialog.querySelector('.mining-dialog-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 'setup' : event.key === 'End' ? 'results' : setup.hidden ? 'setup' : 'results';
    view(target, true);
  });
  form.querySelector('#edit-mining-inputs').addEventListener('click', () => view('setup', true));
  form.querySelector('#calculator-period').addEventListener('change', event => {
    form.querySelectorAll('#calculator-payouts tr').forEach(row => { row.dataset.selected = String(row.dataset.period === event.target.value); });
  });
  fieldset.addEventListener('input', changed);
  minerSelect.addEventListener('change', () => {
    const miner = defaults.form.miners.find(item => item.id === minerSelect.value);
    ['sol_s', 'watts', 'cost_usd'].forEach(key => { form.elements.namedItem(key).value = miner[key]; });
    changed();
  });
  form.addEventListener('submit', event => { event.preventDefault(); calculate(); });
  retry.addEventListener('click', () => defaults ? calculate() : preset?.refresh());
  form.querySelector('#reset-mining').addEventListener('click', () => { changed(); fillDefaults(); status.textContent = 'Defaults restored. Calculate to update the estimate.'; });
  let preset;
  lazy(document.querySelector('#mining'), () => {
    preset = watchMiningPreset(({ data, fetchedAt, stale, failed, error }) => {
      if (data) {
        const first = !defaults;
        defaults = data;
        renderPreview(data);
        if (first) {
          fillDefaults(); renderResult(data);
          status.textContent = 'Choose your miner and costs.';
          retry.hidden = true;
        }
        if (stale || failed || Date.now() - fetchedAt > CONFIG.pollInterval) previewStatus.textContent = failed
          ? 'Last known estimate · refresh unavailable' : 'Last known estimate';
      } else if (failed) {
        previewStatus.textContent = 'Estimate temporarily unavailable';
        status.textContent = 'Miner profiles are unavailable. Please retry.';
        retry.hidden = false;
      }
      if (error?.retryAfter) {
        nextAllowed = Math.max(nextAllowed, error.retryAt);
        unlock();
      }
    });
  });
}

// Page motion and clipboard actions.
function setupMiningParallax() {
  const section = document.querySelector('#mining');
  if (!section) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  const update = () => {
    frame = 0;
    const rect = section.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) return;
    const offset = (innerHeight / 2 - rect.top - rect.height / 2) * .3;
    section.style.setProperty('--mining-shift', `${Math.max(-140, Math.min(140, offset))}px`);
  };
  const schedule = () => {
    if (!reducedMotion.matches && !frame) frame = requestAnimationFrame(update);
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  reducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(frame); frame = 0;
    section.style.removeProperty('--mining-shift');
    schedule();
  });
  schedule();
}

function setupCopy() {
  const button = document.querySelector('#copy-viewing-key');
  if (!button) return;
  button.addEventListener('click', async () => {
    const command = document.querySelector('#viewing-key-command');
    try {
      await navigator.clipboard.writeText(command.textContent.trim());
      button.textContent = 'Copied ✓';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(command);
      selection.removeAllRanges(); selection.addRange(range);
      button.textContent = 'Command selected. Copy with Ctrl/Cmd+C';
    }
    setTimeout(() => { button.textContent = 'Copy command'; }, 3500);
  });
}

function setupSectionLinks() {
  document.querySelectorAll('[data-section-link], [data-wallet-link]').forEach(link => {
    const originalLabel = link.getAttribute('aria-label');
    let timer, input;
    link.addEventListener('click', async event => {
      if (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const url = new URL(link.href);
      history.replaceState(history.state, '', url);
      let feedback = link.querySelector('[role="status"]');
      if (!feedback) {
        feedback = document.createElement('span');
        feedback.className = 'wallet-copy-status';
        feedback.setAttribute('role', 'status');
        link.append(feedback);
      }
      try {
        await navigator.clipboard.writeText(url.href);
        link.title = 'Link copied';
        link.setAttribute('aria-label', 'Link copied');
        link.classList.add('copied');
        feedback.className = 'section-copy-feedback';
        feedback.textContent = 'Copied!';
        const right = link.getBoundingClientRect().right;
        if (right + 6 + feedback.getBoundingClientRect().width > innerWidth - 12) feedback.classList.add('copy-feedback-above');
        input?.remove();
        input = null;
      } catch {
        feedback.className = 'wallet-copy-status';
        if (!input) {
          input = document.createElement('input');
          input.className = 'section-share-url'; input.type = 'text'; input.readOnly = true;
          input.setAttribute('aria-label', 'Section link');
          link.parentElement.after(input);
        }
        input.value = url.href; input.focus({ preventScroll: true }); input.select();
        feedback.textContent = 'Copy the selected link with Ctrl+C or Command+C.';
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        link.title = originalLabel; link.setAttribute('aria-label', originalLabel);
        link.classList.remove('copied'); feedback.textContent = '';
      }, 2200);
    });
  });
}
function initializeSite() {
  setupExternalLinks();
  setupWallets();
  setupMedia();
  setupCopy();
  setupMiningCalculator();
  setupMiningParallax();
  setupSectionLinks();
  setupNetwork();
  setupReserveStats();
}

if (typeof document !== 'undefined') initializeSite();
