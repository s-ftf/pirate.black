const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/wallets.js'), 'utf8');

function walletScript(fetch) {
  const context = vm.createContext({
    BASEURL: '/',
    URL,
    WALLET_REPOSITORIES: {
      core: { github: 'PirateNetwork/pirate' },
      stashi: { github: 'PirateNetwork/Stashi-Wallet' },
      paper: { github: 'PirateNetwork/piratepaperwallet' }
    },
    WALLET_LINKS: { bootstrap: 'https://example.com/bootstrap', paper_launcher: 'https://example.com/launcher' },
    fetch,
    window: { addEventListener() {} },
    console
  });
  vm.runInContext(source, context);
  return context;
}

test('core release is shared by QT and CLI and filters their assets', async () => {
  let requests = 0;
  const release = {
    tag_name: 'v1',
    html_url: 'https://github.com/PirateNetwork/pirate/releases/tag/v1',
    assets: [
      'pirate-qt-arm-macos-v1.dmg',
      'pirate-qt-x86_64-macos-v1.dmg',
      'pirate-cli-aarch64-linux-v1.zip',
      'checksums.txt'
    ].map(name => ({
      name,
      browser_download_url: `https://github.com/PirateNetwork/pirate/releases/download/v1/${name}`
    }))
  };
  const context = walletScript(async () => {
    requests++;
    return { ok: true, json: async () => release };
  });
  const getRelease = vm.runInContext('getRelease', context);
  const releaseLinks = vm.runInContext('releaseLinks', context);
  const wallets = vm.runInContext('wallets', context);

  const [qtRelease, cliRelease] = await Promise.all([
    getRelease(wallets['treasure-chest'].repository),
    getRelease(wallets['cli-wallet'].repository)
  ]);
  assert.equal(requests, 1);
  assert.deepEqual(Array.from(releaseLinks(qtRelease, wallets['treasure-chest']), file => file.name),
    ['pirate-qt-arm-macos-v1.dmg', 'pirate-qt-x86_64-macos-v1.dmg']);
  assert.deepEqual(Array.from(releaseLinks(qtRelease, wallets['treasure-chest']), file => file.label),
    ['macOS disk image (Apple silicon)', 'macOS disk image (Intel Mac)']);
  assert.deepEqual(Array.from(releaseLinks(cliRelease, wallets['cli-wallet']), file => file.name),
    ['pirate-cli-aarch64-linux-v1.zip']);
  assert.equal(releaseLinks(cliRelease, wallets['cli-wallet'])[0].label, 'ZIP archive (ARM64)');
  assert.equal(vm.runInContext('getOS("piratepaperwallet-aarch64-v1.zip")', context), 'ARM Linux');
  assert.equal(vm.runInContext('getOS("pirate-qt-arm-macos-v1.dmg")', context), 'Mac OS');
});

test('Stashi shows installers and selected resources but excludes unrelated developer artifacts', () => {
  const context = walletScript(async () => { throw new Error('fetch not expected'); });
  const releaseLinks = vm.runInContext('releaseLinks', context);
  const wallet = vm.runInContext('wallets.stashi', context);
  const names = [
    'Stashi-Wallet-windows-installer.exe',
    'Stashi-Wallet-macos-unsigned.dmg',
    'Stashi-Wallet-linux-x86_64.AppImage',
    'Stashi-Wallet-amd64.deb',
    'Stashi-Wallet.flatpak',
    'Stashi-Wallet-android-V7.apk',
    'Stashi-Wallet-android-V8.apk',
    'Stashi-Wallet-windows-installer.exe.sig',
    'Stashi-Wallet-windows-component-i2pd.exe',
    'Stashi-Wallet-mobile-store-test-builds.zip',
    'pirate-unified-wallet-android-sdk-artifacts-v1.2.2.zip',
    'pirate-unified-wallet-ios-sdk-artifacts-v1.2.2.zip',
    'pirate-unified-wallet-ios-sdk-artifacts-v1.2.2.zip.sig',
    'sha256sum-v1.2.3.txt',
    'signatures-v1.2.3.zip',
    'public_key.asc'
  ];
  const files = releaseLinks({ assets: names.map(name => ({
    name,
    browser_download_url: `https://github.com/PirateNetwork/Stashi-Wallet/releases/download/v1.2.3/${name}`
  })) }, wallet);
  assert.deepEqual(Array.from(files, file => file.name), [
    'Stashi-Wallet-windows-installer.exe',
    'Stashi-Wallet-macos-unsigned.dmg',
    'Stashi-Wallet-linux-x86_64.AppImage',
    'Stashi-Wallet-amd64.deb',
    'Stashi-Wallet.flatpak',
    'Stashi-Wallet-android-V8.apk',
    'Stashi-Wallet-android-V7.apk',
    'sha256sum-v1.2.3.txt',
    'signatures-v1.2.3.zip',
    'public_key.asc',
    'pirate-unified-wallet-ios-sdk-artifacts-v1.2.2.zip'
  ]);
  assert.equal(files[5].label, 'Android APK — 64-bit ARM (V8)');
  assert.equal(files[6].label, 'Android APK — 32-bit ARM (V7)');
  assert.deepEqual(Array.from(files.slice(7), file => [file.os, file.label]),
    [['Resources', 'SHA-256 checksums'], ['Resources', 'Release signatures'],
      ['Resources', 'Signing key'], ['iOS', 'SDK for developers']]);
});

test('labels and Stashi installer matching tolerate renamed release assets', () => {
  const context = walletScript(async () => { throw new Error('fetch not expected'); });
  const label = vm.runInContext('downloadLabel', context);
  const installer = vm.runInContext('stashiInstaller', context);

  assert.equal(label('pirate-qt-x86_64-windows-v6.zip'), 'ZIP archive (x64)');
  assert.equal(label('pirate-cli-arm-macos-v6.zip'), 'ZIP archive (Apple silicon)');
  assert.equal(label('stashi-macos-unsigned.dmg'), 'macOS disk image (unsigned)');
  assert.equal(label('wallet-macos-intel-unsigned.dmg'), 'macOS disk image (Intel Mac, unsigned)');
  assert.equal(label('piratepaperwallet-aarch64-v1.zip'), 'ZIP archive (ARM64)');
  assert.equal(label('stashi_wallet-linux-arm64-v2.deb'), 'Debian package (ARM64)');
  assert.equal(label('Stashi_Wallet-linux-amd64-v2.AppImage'), 'AppImage (x64)');
  assert.equal(label('Stashi_Wallet-android-arm64-v8a.apk'), 'Android APK — 64-bit ARM (V8)');
  assert.equal(installer('Stashi_Wallet-win-setup-v2.exe').os, 'Windows');
  assert.equal(installer('Stashi_Wallet-linux-arm64-v2.deb').os, 'ARM Linux');
  assert.equal(installer('Stashi-Wallet-windows-component-i2pd.exe'), null);
  assert.equal(installer('stashi-sdk-linux-amd64.deb'), null);
  assert.equal(label('Stashi-Wallet-ios-unsigned.ipa'), 'iOS app (unsigned IPA)');
});

test('a standalone Stashi IPA is an iOS app while its SDK archive is a resource', () => {
  const context = walletScript(async () => { throw new Error('fetch not expected'); });
  const releaseLinks = vm.runInContext('releaseLinks', context);
  const wallet = vm.runInContext('wallets.stashi', context);
  const names = ['Stashi-Wallet-ios-unsigned.ipa', 'pirate-unified-wallet-ios-sdk-artifacts-v2.zip'];
  const files = releaseLinks({ assets: names.map(name => ({
    name,
    browser_download_url: `https://github.com/PirateNetwork/Stashi-Wallet/releases/download/v2/${name}`
  })) }, wallet);
  assert.deepEqual(Array.from(files, file => [file.os, file.label]),
    [['iOS', 'iOS app (unsigned IPA)'], ['iOS', 'SDK for developers']]);
});

test('wallet download cards render one short label per file and Stashi resources', () => {
  const context = walletScript(async () => { throw new Error('fetch not expected'); });
  function element(tag) {
    return {
      tag,
      children: [],
      appendChild(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; }
    };
  }
  context.document = { createElement: element };
  const links = element('div');
  const version = element('a');
  const section = { querySelector: selector => selector === '.links' ? links : version };
  const renderLinks = vm.runInContext('renderLinks', context);
  const wallet = vm.runInContext('wallets.stashi', context);
  const release = {
    tag_name: 'v2',
    html_url: 'https://github.com/PirateNetwork/Stashi-Wallet/releases/tag/v2',
    assets: [
      'Stashi-Wallet-windows-installer.exe',
      'Stashi-Wallet-macos-unsigned.dmg',
      'Stashi-Wallet-ios-unsigned.ipa',
      'pirate-unified-wallet-ios-sdk-artifacts-v2.zip',
      'sha256sum-v2.txt'
    ].map(name => ({
      name,
      browser_download_url: `https://github.com/PirateNetwork/Stashi-Wallet/releases/download/v2/${name}`
    }))
  };
  renderLinks(section, release, wallet);
  const groups = links.children[0].children;
  assert.deepEqual(groups.map(group => group.children[0].children[1].children[0].textContent),
    ['Windows', 'Mac OS', 'iOS', 'Resources']);
  assert.equal(groups[2].children[0].children[0].src, '/assets/img/wallets/ios.svg');
  const entries = groups.flatMap(group => group.children[0].children[1].children.slice(1));
  assert.deepEqual(entries.map(entry => entry.textContent),
    ['Windows installer', 'macOS disk image (unsigned)', 'iOS app (unsigned IPA)', 'SDK for developers',
      'SHA-256 checksums', 'More resources on GitHub']);
  assert.ok(entries.every(entry => entry.children.length === 0));
  assert.equal(entries[5].href, release.html_url);

  renderLinks(section, {
    ...release,
    assets: release.assets.filter(asset => asset.name.includes('ios-sdk'))
  }, wallet);
  assert.match(links.children[0].textContent, /No wallet installers found/);
  assert.equal(links.children[1].children[0].children[0].children[0].src,
    '/assets/img/wallets/ios.svg');
});

test('wallet releases preload near the viewport, while Downloads works without an observer', () => {
  const context = walletScript(async () => { throw new Error('fetch not expected'); });
  const cards = [{ id: 'treasure-chest' }, { id: 'stashi' }];
  const requested = [];
  const unobserved = [];
  let observer;
  context.window.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      observer = this;
    }
    observe(card) { (this.observed ||= []).push(card); }
    unobserve(card) { unobserved.push(card); }
  };
  context.document = { querySelectorAll: () => cards };
  context.requested = requested;
  vm.runInContext('updateLinks = walletId => requested.push(walletId)', context);
  vm.runInContext('preloadVisibleWallets()', context);
  assert.deepEqual(observer.observed, cards);
  assert.equal(observer.options.rootMargin, '0px 0px 100px 0px');
  assert.deepEqual(requested, []);

  observer.callback([{ target: cards[0], isIntersecting: false }]);
  assert.deepEqual(requested, []);
  observer.callback([{ target: cards[0], isIntersecting: true }]);
  assert.deepEqual(requested, ['treasure-chest']);
  assert.deepEqual(unobserved, [cards[0]]);

  delete context.window.IntersectionObserver;
  vm.runInContext('preloadVisibleWallets()', context);
  context.document.getElementById = () => ({
    querySelector: selector => selector === '.flip'
      ? { classList: { toggle() {} } }
      : { style: {} }
  });
  vm.runInContext("flip('stashi', 'download')", context);
  assert.deepEqual(requested, ['treasure-chest', 'stashi']);
});

test('failed GitHub requests can be retried', async () => {
  let requests = 0;
  const context = walletScript(async () => {
    requests++;
    if (requests === 1) return { ok: false, status: 403 };
    return {
      ok: true,
      json: async () => ({
        tag_name: 'v2',
        html_url: 'https://github.com/PirateNetwork/pirate/releases/tag/v2',
        assets: []
      })
    };
  });
  const getRelease = vm.runInContext('getRelease', context);
  await assert.rejects(getRelease('PirateNetwork/pirate'), /HTTP 403/);
  assert.equal((await getRelease('PirateNetwork/pirate')).tag_name, 'v2');
  assert.equal(requests, 2);
});

test('a failed card load shows a retry control and then renders the release', async () => {
  let requests = 0;
  const context = walletScript(async () => {
    requests++;
    if (requests === 1) return { ok: false, status: 403 };
    return {
      ok: true,
      json: async () => ({
        tag_name: 'v2',
        html_url: 'https://github.com/PirateNetwork/Stashi-Wallet/releases/tag/v2',
        assets: []
      })
    };
  });
  context.console = { error() {} };

  function element(tag) {
    return {
      tag,
      children: [],
      appendChild(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; },
      setAttribute() {},
      addEventListener(event, handler) { this[event] = handler; }
    };
  }
  const links = element('div');
  const version = element('a');
  context.document = {
    createElement: element,
    getElementById: () => ({
      querySelector: selector => selector === '.links' ? links : version
    })
  };

  const updateLinks = vm.runInContext('updateLinks', context);
  await updateLinks('stashi');
  assert.match(links.children[0].textContent, /Could not load downloads/);
  assert.equal(links.children[1].textContent, 'Try again');
  await links.children[1].click();
  assert.equal(requests, 2);
  assert.equal(version.textContent, 'v2');
  assert.match(links.children[0].textContent, /No wallet installers found/);
});

test('invalid release URLs and download URLs are rejected', async () => {
  const context = walletScript(async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v1', html_url: 'javascript:alert(1)', assets: [] })
  }));
  const getRelease = vm.runInContext('getRelease', context);
  await assert.rejects(getRelease('PirateNetwork/pirate'), /invalid release/);

  const releaseLinks = vm.runInContext('releaseLinks', context);
  const wallets = vm.runInContext('wallets', context);
  const links = releaseLinks({ assets: [{
    name: 'pirate-qt-linux-v1.zip',
    browser_download_url: 'https://example.com/rogue-file.zip'
  }] }, wallets['treasure-chest']);
  assert.equal(links.length, 0);
});
