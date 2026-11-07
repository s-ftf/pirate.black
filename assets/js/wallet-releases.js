/**
 * Pure wallet release classification and sorting. No network or DOM access.
 * Keep repository download restrictions and signature pairing here.
 */

// Asset classifiers adapted from the 0BSD reference site.
export function getOS(filename) {
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
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && !url.port &&
      url.pathname.toLowerCase().startsWith(
        `/${repository.toLowerCase()}/releases/${segment}`
      );
  } catch {
    return false;
  }
}

// Match package type and platform rather than a fixed version or exact prefix.
// Developer artifacts are classified separately from installable applications.
export function stashiInstaller(filename) {
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
  if (name.endsWith('.sig')) {
    const original = filename.slice(0, -4);
    const parent = stashiInstaller(original) || stashiResource(original);
    return { os: parent.os, label: `${parent.label || downloadLabel(original)} signature`, section: 'Signatures', order: 100 + parent.order };
  }
  if (/(?:sha[-_]?256|checksums?)/.test(name) && /\.(?:txt|sha256)$/.test(name)) {
    return { os: 'Resources', label: 'SHA-256 checksums', section: 'Verification', order: 80 };
  }
  if (/signatures?/.test(name) && /\.(?:zip|tar\.gz)$/.test(name)) {
    return { os: 'Resources', label: 'Release signatures', section: 'Verification', order: 81 };
  }
  if (/(?:public|signing)[-_]?key/.test(name) && /\.(?:asc|pub)$/.test(name)) {
    return { os: 'Resources', label: 'Signing key', section: 'Verification', order: 82 };
  }
  if (/(?:^|[-_.])ios[-_.]sdk(?:[-_.]|$)/.test(name) && /\.(?:zip|tar\.gz)$/.test(name)) {
    return { os: 'iOS', label: 'iOS SDK artifacts', section: 'Developer tools', order: 50 };
  }
  if (/xcframework/.test(name)) return { os: 'iOS', label: 'Native iOS framework (XCFramework)', section: 'Developer tools', order: 51 };
  if (/\.swift$/.test(name)) return { os: 'iOS', label: 'Swift Package manifest', section: 'Developer tools', order: 52 };
  if (/android.*sdk/.test(name)) return { os: 'Android APK', label: 'Android SDK artifacts', section: 'Developer tools', order: 50 };
  if (/windows-component/.test(name)) return { os: 'Windows', label: /i2pd/.test(name) ? 'i2pd component' : /lyrebird/.test(name) ? 'Lyrebird component' : filename, section: 'Developer tools', order: 50 };
  if (/test-builds/.test(name)) return { os: 'Resources', label: /mobile/.test(name) ? 'Mobile store test builds' : 'Unsigned desktop test builds', section: 'Test builds', order: 60 };
  const artifacts = [
    [/cli-artifacts/, 'CLI artifacts'], [/native-ffi/, 'Native FFI artifacts'],
    [/qortal-jni/, 'Qortal JNI artifacts'], [/react-native-plugin/, 'React Native plugin artifacts']
  ];
  for (const [pattern, label] of artifacts) {
    if (pattern.test(name)) return { os: 'Resources', label, section: 'Developer tools', order: 50 };
  }
  if (/release-metadata/.test(name)) return { os: 'Resources', label: 'Release metadata', section: 'Release files', order: 90 };
  if (/build-payloads/.test(name)) return { os: 'Resources', label: 'Build payload manifest', section: 'Release files', order: 91 };
  if (/^readme(?:\.|$)/.test(name)) return { os: 'Resources', label: 'Release README', section: 'Release files', order: 92 };
  return { os: 'Resources', label: filename, section: 'Release files', order: 95 };
}

export function downloadLabel(filename) {
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
    return arm64 ? 'Android APK - 64-bit ARM (V8)' :
      arm32 ? 'Android APK - 32-bit ARM (V7)' : 'Android APK';
  }
  if (/\.zip$/.test(name) || /\.(?:tar\.gz|tgz)$/.test(name)) {
    const packageType = /\.zip$/.test(name) ? 'ZIP archive' : 'Tar archive';
    if (getOS(name) === 'Mac OS' && arm64) return `${packageType} (Apple silicon)`;
    if (getOS(name) === 'Mac OS' && x64) return `${packageType} (Intel Mac)`;
    return architecture ? `${packageType} (${architecture})` : packageType;
  }
  return filename;
}

// Keep detached signatures beside their exact file, preserving unmatched files.
export function pairDownloadSignatures(links) {
  const byURL = new Map(links.map(link => [link.href, link]));
  const paired = new Set();
  const rows = links.map(link => {
    const signature = byURL.get(`${link.href}.sig`);
    if (!signature) return link;
    paired.add(signature);
    return { ...link, signature };
  });
  return rows.filter(link => !paired.has(link));
}

export function releaseLinks(release, wallet) {
  return release.assets
    .filter(asset => typeof asset.name === 'string' &&
      isGithubReleaseUrl(asset.browser_download_url, wallet.repository, 'download/'))
    .filter(asset => !wallet.assetType ||
      (asset.name.toLowerCase().includes(`-${wallet.assetType}-`) || /^(?:signatures|sha256|public_key)/i.test(asset.name)))
    .filter(asset => wallet.installerOnly || !/\.sig$/i.test(asset.name))
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
        section: installer ? 'Downloads' : '',
        ...installer,
        ...resource
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }));
}
