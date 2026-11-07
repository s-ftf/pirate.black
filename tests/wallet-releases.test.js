import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releaseLinks, getOS, stashiInstaller, pairDownloadSignatures } from '../assets/js/wallet-releases.js';

function asset(repository, name) { return { name, browser_download_url: `https://github.com/${repository}/releases/download/v1/${name}` }; }

test('core wallet downloads separate graphical and CLI packages and retain signatures', () => {
  const repository = 'PirateNetwork/pirate';
  const release = { assets: ['pirate-qt-arm-macos-v1.dmg', 'pirate-cli-x86_64-linux-v1.zip', 'signatures-v1.zip'].map(name => asset(repository, name)) };
  assert.deepEqual(releaseLinks(release, { repository, assetType: 'qt' }).map(file => file.name), ['pirate-qt-arm-macos-v1.dmg', 'signatures-v1.zip']);
  assert.equal(getOS('pirate-qt-arm-macos-v1.dmg'), 'Mac OS');
});

test('Stashi separates installers, developer components, and individual signatures without dropping release assets', () => {
  const repository = 'PirateNetwork/Stashi-Wallet';
  const names = ['Stashi-Wallet-windows-installer.exe', 'Stashi-Wallet-windows-component-i2pd.exe', 'Stashi-Wallet-unsigned-desktop-test-builds.zip', 'Stashi-Wallet-amd64.deb', 'Stashi-Wallet-amd64.deb.sig', 'Stashi-Wallet-android-V8.apk', 'sha256sum-v1.txt'];
  const release = { assets: names.map(name => asset(repository, name)) };
  const files = releaseLinks(release, { repository, installerOnly: true });
  assert.deepEqual(new Set(files.map(file => file.name)), new Set(names));
  assert.equal(files.find(file => file.name === names[1]).section, 'Developer tools');
  assert.equal(files.find(file => file.name === names[4]).section, 'Signatures');
  assert.equal(files.filter(file => file.os === 'Windows')[0].name, names[0]);
  assert.equal(stashiInstaller(names[1]), null);
});

test('every uploaded Stashi v1.2.6 asset has one correctly grouped download, including all iOS packages', () => {
  const repository = 'PirateNetwork/Stashi-Wallet';
  const names = JSON.parse(readFileSync(new URL('./fixtures/stashi-v1.2.6-assets.json', import.meta.url), 'utf8'));
  const files = releaseLinks({ assets: names.map(name => asset(repository, name)) }, { repository, installerOnly: true });
  assert.equal(files.length, 47);
  assert.deepEqual(new Set(files.map(file => file.name)), new Set(names));
  assert.equal(files.filter(file => file.os === 'iOS').length, 6);
  assert.equal(files.find(file => file.name.endsWith('Package.swift')).label, 'Swift Package manifest');
  assert.equal(files.find(file => file.name.includes('xcframework') && !file.name.endsWith('.sig')).os, 'iOS');
  for (const os of ['Windows', 'Mac OS', 'Linux', 'ARM Linux', 'Android APK']) {
    assert.equal(files.find(file => file.os === os).section, 'Downloads');
  }
  assert.ok(files.every(file => ['Downloads', 'Developer tools', 'Test builds', 'Verification', 'Release files', 'Signatures'].includes(file.section)));
});

test('wallet download URLs must belong to their exact official release repository', () => {
  const repository = 'PirateNetwork/pirate';
  const release = { assets: [{ name: 'pirate-qt-windows.zip', browser_download_url: 'https://evil.test/wallet.exe' }, asset('SomeoneElse/pirate', 'pirate-qt-windows.zip')] };
  assert.equal(releaseLinks(release, { repository, assetType: 'qt' }).length, 0);
});

test('detached signatures stay beside the exact file without hiding unmatched assets', () => {
  const href = 'https://github.com/PirateNetwork/Stashi-Wallet/releases/download/v1/app.deb';
  const links = [{ href, label: 'Debian package' }, { href: `${href}.sig`, label: 'Signature' },
    { href: `${href.replace('/v1/', '/v2/')}.sig`, label: 'Unmatched signature' },
    { href: `${href}.sha256`, label: 'Checksum' }];
  const rows = pairDownloadSignatures(links);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].signature, links[1]);
  assert.deepEqual(rows.slice(1), links.slice(2));
  assert.equal(links[0].signature, undefined);
  const repository = 'PirateNetwork/Stashi-Wallet';
  const names = JSON.parse(readFileSync(new URL('./fixtures/stashi-v1.2.6-assets.json', import.meta.url), 'utf8'));
  const files = releaseLinks({ assets: names.map(name => asset(repository, name)) }, { repository, installerOnly: true })
    .map(file => ({ href: file.link, label: file.label }));
  const flattened = pairDownloadSignatures(files).flatMap(file => [file.href, ...(file.signature ? [file.signature.href] : [])]);
  assert.equal(flattened.length, 47);
  assert.equal(new Set(flattened).size, 47);
  assert.deepEqual(new Set(flattened), new Set(files.map(file => file.href)));
});

test('download links reject embedded credentials and nonstandard ports', () => {
  const repository = 'PirateNetwork/pirate';
  const assets = ['https://user:pass@github.com/PirateNetwork/pirate/releases/download/v1/pirate-qt.zip',
    'https://github.com:444/PirateNetwork/pirate/releases/download/v1/pirate-qt.zip']
    .map(browser_download_url => ({ name: 'pirate-qt.zip', browser_download_url }));
  assert.deepEqual(releaseLinks({ assets }, { repository }), []);
});
