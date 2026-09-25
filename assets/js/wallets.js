// Bookmark a wallet card when it is selected.
function bookmark(section) {
  history.replaceState({}, document.title, window.location.href.split('#')[0]);
  const nextURL = window.location.href + "#" + section;
  window.history.pushState({ additionalInformation: section }, section, nextURL);
  document.querySelectorAll('.wallet-container').forEach(card => {
    card.style.border = "1px solid transparent";
  });
  document.getElementById(section).style.border = "1px solid var(--pirate-neon)";
}

const bootstrapDownload = {
  os: "Resources",
  name: "ARRR-bootstrap.tar.gz",
  label: "Blockchain bootstrap",
  link: WALLET_LINKS.bootstrap
};

// Repository paths are rendered from _config.yml in wallets.html.
const wallets = {
  'treasure-chest': {
    repository: WALLET_REPOSITORIES.core.github,
    assetType: 'qt',
    extras: [bootstrapDownload]
  },
  'stashi': {
    repository: WALLET_REPOSITORIES.stashi.github,
    installerOnly: true
  },
  'paper-wallet': {
    repository: WALLET_REPOSITORIES.paper.github,
    extras: [{
      os: "Windows",
      name: "Windows launcher (.bat file)",
      label: "Windows launcher",
      link: WALLET_LINKS.paper_launcher
    }]
  },
  'cli-wallet': {
    repository: WALLET_REPOSITORIES.core.github,
    assetType: 'cli',
    extras: [bootstrapDownload]
  }
};

const osIcons = {
  'Android APK': 'wallets/android.svg',
  'ARM Linux': 'wallets/arm.svg',
  'iOS': 'wallets/ios.svg',
  'Linux': 'wallets/linux.svg',
  'Mac OS': 'wallets/apple.svg',
  'Windows': 'wallets/windows.svg',
  'Resources': 'icons/blockchain.svg'
};
const osOrder = ['Windows', 'Mac OS', 'iOS', 'Linux', 'ARM Linux', 'Android APK', 'Resources'];
const releaseRequests = new Map();

function getOS(filename) {
  const name = filename.toLowerCase();
  if (name.endsWith('.ipa')) return 'iOS';
  if (name.includes('android') || name.endsWith('.apk')) return 'Android APK';
  if (name.includes('macos') || name.includes('darwin') || name.endsWith('.dmg')) return 'Mac OS';
  if (name.includes('windows') || name.endsWith('.exe') || name.endsWith('.msi')) return 'Windows';
  if (name.includes('aarch') || name.includes('arm')) return 'ARM Linux';
  if (name.includes('linux') || name.includes('ubuntu') ||
      name.endsWith('.deb') || name.endsWith('.rpm') || name.endsWith('.appimage')) return 'Linux';
  return 'Resources';
}

function isGithubReleaseUrl(value, repository, segment) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' &&
      url.pathname.toLowerCase().startsWith(
        `/${repository.toLowerCase()}/releases/${segment}`
      );
  } catch {
    return false;
  }
}

// Match package type and platform rather than a fixed version or exact prefix.
// Stashi releases also contain developer artifacts that must stay off the
// install list. The iOS SDK is shown under iOS with a developer label.
function stashiInstaller(filename) {
  const name = filename.toLowerCase();
  if (/(?:sdk|artifact|component|test|metadata|debug|source|symbols|plugin|qortal|react.native)/.test(name)) return null;
  if (/\.msi$/.test(name) || (/\.exe$/.test(name) && /(?:windows|win|setup)[-_.]/.test(name))) {
    return { os: 'Windows', order: 10 };
  }
  if (/\.dmg$/.test(name)) return { os: 'Mac OS', order: 20 };
  if (/\.ipa$/.test(name)) return { os: 'iOS', order: 25 };
  if (/\.appimage$/.test(name)) return { os: 'Linux', order: 30 };
  if (/\.deb$/.test(name)) return { os: getOS(name), order: 31 };
  if (/\.flatpak$/.test(name)) return { os: 'Linux', order: 32 };
  if (/\.apk$/.test(name)) return { os: 'Android APK', order: /(?:v7|armeabi|armv7)/.test(name) ? 41 : 40 };
  return null;
}

function stashiResource(filename) {
  const name = filename.toLowerCase();
  if (/(?:sha[-_]?256|checksums?)/.test(name) && /\.(?:txt|sha256)$/.test(name)) {
    return { os: 'Resources', label: 'SHA-256 checksums', order: 50 };
  }
  if (/signatures?/.test(name) && /\.(?:zip|tar\.gz)$/.test(name)) {
    return { os: 'Resources', label: 'Release signatures', order: 51 };
  }
  if (/(?:public|signing)[-_]?key/.test(name) && /\.(?:asc|pub)$/.test(name)) {
    return { os: 'Resources', label: 'Signing key', order: 52 };
  }
  if (/(?:^|[-_.])ios[-_.]sdk(?:[-_.]|$)/.test(name) && /\.(?:zip|tar\.gz)$/.test(name)) {
    return { os: 'iOS', label: 'SDK for developers', order: 53 };
  }
  return null;
}

function downloadLabel(filename) {
  const name = filename.toLowerCase();
  const arm64 = /(?:aarch64|arm64|arm[-_]?v8|android[-_]?v8|arm[-_]macos|macos[-_]arm)/.test(name);
  const arm32 = /(?:arm[-_]?v7|android[-_]?v7|armeabi)/.test(name);
  const x64 = /(?:x86[_-]?64|amd64|x64|intel)/.test(name);
  const architecture = arm64 ? 'ARM64' : arm32 ? '32-bit ARM' : x64 ? 'x64' : '';

  if (/(?:sha[-_]?256|checksums?)/.test(name) && /\.(?:txt|sha256)$/.test(name)) return 'SHA-256 checksums';
  if (/signatures?/.test(name) && /\.(?:zip|tar\.gz)$/.test(name)) return 'Release signatures';
  if (/(?:public|signing)[-_]?key/.test(name) && /\.(?:asc|pub)$/.test(name)) return 'Signing key';
  if (/\.exe$/.test(name) || /\.msi$/.test(name)) return 'Windows installer';
  if (/\.dmg$/.test(name)) {
    const details = [];
    if (arm64) details.push('Apple silicon');
    else if (x64) details.push('Intel Mac');
    if (name.includes('unsigned')) details.push('unsigned');
    return `macOS disk image${details.length ? ` (${details.join(', ')})` : ''}`;
  }
  if (/\.ipa$/.test(name)) return name.includes('unsigned') ? 'iOS app (unsigned IPA)' : 'iOS app (IPA)';
  if (/\.appimage$/.test(name)) return architecture ? `AppImage (${architecture})` : 'AppImage';
  if (/\.deb$/.test(name)) return architecture ? `Debian package (${architecture})` : 'Debian package';
  if (/\.rpm$/.test(name)) return architecture ? `RPM package (${architecture})` : 'RPM package';
  if (/\.flatpak$/.test(name)) return 'Flatpak';
  if (/\.apk$/.test(name)) {
    return arm64 ? 'Android APK — 64-bit ARM (V8)' :
      arm32 ? 'Android APK — 32-bit ARM (V7)' : 'Android APK';
  }
  if (/\.zip$/.test(name) || /\.(?:tar\.gz|tgz)$/.test(name)) {
    const packageType = /\.zip$/.test(name) ? 'ZIP archive' : 'Tar archive';
    if (getOS(name) === 'Mac OS' && arm64) return `${packageType} (Apple silicon)`;
    if (getOS(name) === 'Mac OS' && x64) return `${packageType} (Intel Mac)`;
    return architecture ? `${packageType} (${architecture})` : packageType;
  }
  return filename;
}

function releaseLinks(release, wallet) {
  return release.assets
    .filter(asset => typeof asset.name === 'string' &&
      isGithubReleaseUrl(asset.browser_download_url, wallet.repository, 'download/'))
    .filter(asset => !wallet.assetType ||
      asset.name.toLowerCase().includes(`-${wallet.assetType}-`))
    .map(asset => {
      const installer = wallet.installerOnly ? stashiInstaller(asset.name) : null;
      const resource = wallet.installerOnly && !installer ? stashiResource(asset.name) : null;
      if (wallet.installerOnly && !installer && !resource) return null;
      return {
        os: installer ? installer.os : resource ? resource.os : getOS(asset.name),
        name: asset.name,
        link: asset.browser_download_url,
        label: downloadLabel(asset.name),
        isResource: Boolean(resource),
        ...installer,
        ...resource
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Cache successful requests, including the core release shared by QT and CLI.
function getRelease(repository) {
  if (!releaseRequests.has(repository)) {
    const url = `https://api.github.com/repos/${repository}/releases/latest`;
    const request = fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
        return response.json();
      })
      .then(release => {
        if (!release || !Array.isArray(release.assets) ||
            typeof release.tag_name !== 'string' ||
            !isGithubReleaseUrl(release.html_url, repository, 'tag/')) {
          throw new Error('GitHub returned an invalid release');
        }
        return release;
      })
      .catch(error => {
        releaseRequests.delete(repository); // A later click can retry.
        throw error;
      });
    releaseRequests.set(repository, request);
  }
  return releaseRequests.get(repository);
}

function createLinkGroup(os, links) {
  const item = document.createElement('li');
  const container = document.createElement('div');
  container.className = 'link-container';

  const icon = document.createElement('img');
  icon.alt = `${os} icon`;
  icon.src = BASEURL + 'assets/img/' + osIcons[os];
  container.appendChild(icon);

  const linkbox = document.createElement('div');
  linkbox.className = 'linkbox';
  const heading = document.createElement('h3');
  heading.textContent = os;
  linkbox.appendChild(heading);

  links.forEach(file => {
    const link = document.createElement('a');
    link.href = file.link;
    link.title = file.name;
    link.textContent = file.label || file.name;
    linkbox.appendChild(link);
  });

  container.appendChild(linkbox);
  item.appendChild(container);
  return item;
}

function renderLinks(section, release, wallet) {
  const version = section.querySelector('.version a');
  version.href = release.html_url;
  version.textContent = release.tag_name;

  const links = section.querySelector('.links');
  const files = releaseLinks(release, wallet);
  const grouped = new Map();
  const moreResources = wallet.installerOnly ? [{
    os: 'Resources',
    name: 'More resources on GitHub',
    label: 'More resources on GitHub',
    link: release.html_url
  }] : [];
  [...files, ...(wallet.extras || []), ...moreResources].forEach(file => {
    if (!grouped.has(file.os)) grouped.set(file.os, []);
    grouped.get(file.os).push(file);
  });

  const list = document.createElement('ul');
  osOrder.forEach(os => {
    if (grouped.has(os)) list.appendChild(createLinkGroup(os, grouped.get(os)));
  });
  links.replaceChildren();

  if (!files.some(file => !wallet.installerOnly || !file.isResource)) {
    const notice = document.createElement('p');
    notice.textContent = wallet.installerOnly
      ? 'No wallet installers found in this release. Check the release on GitHub.'
      : 'No wallet files found in this release. Check the release on GitHub.';
    links.appendChild(notice);
  }
  links.appendChild(list);
}

async function updateLinks(walletId) {
  const wallet = wallets[walletId];
  if (!wallet || wallet.loaded || wallet.loading) return;

  const section = document.getElementById(walletId);
  const links = section.querySelector('.links');
  wallet.loading = true;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Loading downloads…';
  links.replaceChildren(status);
  try {
    const release = await getRelease(wallet.repository);
    renderLinks(section, release, wallet);
    wallet.loaded = true;
  } catch (error) {
    console.error(`Could not load ${walletId} release:`, error);
    const notice = document.createElement('p');
    notice.setAttribute('role', 'alert');
    notice.textContent = 'Could not load downloads from GitHub. Open the latest release above or try again.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'a-btn retry-downloads';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => updateLinks(walletId));
    links.replaceChildren(notice, retry);
  } finally {
    wallet.loading = false;
  }
}

function flip(walletId, side) {
  const section = document.getElementById(walletId);
  const desc = section.querySelector('.overview .desc');
  const download = section.querySelector('.overview .download');
  const showDownloads = side === 'download';

  download.style.opacity = showDownloads ? 0 : 1;
  desc.style.opacity = showDownloads ? 1 : 0;
  download.style.zIndex = showDownloads ? 0 : 99;
  desc.style.zIndex = showDownloads ? 99 : 0;
  section.querySelector('.flip').classList.toggle('flipCard', showDownloads);

  if (showDownloads) updateLinks(walletId);
}

// Fetch a card's release only when the visitor reaches that part of the page.
// Clicking Downloads still fetches immediately if the observer has not fired.
function preloadVisibleWallets() {
  if (typeof window.IntersectionObserver !== 'function') return;

  const observer = new window.IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      updateLinks(entry.target.id);
    });
  }, { rootMargin: '0px 0px 100px 0px' });

  document.querySelectorAll('.wallet-container').forEach(card => observer.observe(card));
}

window.addEventListener('DOMContentLoaded', () => {
  const requestedWallet = window.location.hash.slice(1).toLowerCase();
  const walletId = ['lite-wallet', 'skull-island'].includes(requestedWallet)
    ? 'stashi' : requestedWallet;
  const wallet = document.getElementById(walletId);
  if (wallet && wallet.classList.contains('wallet-container')) {
    if (walletId !== requestedWallet) {
      history.replaceState({}, document.title, `#${walletId}`);
    }
    wallet.style.border = '1px solid var(--pirate-neon)';
  }
  preloadVisibleWallets();
});
