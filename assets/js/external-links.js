(function () {
  const canonical = document.querySelector('link[rel="canonical"]');
  const canonicalHost = canonical ? new URL(canonical.href).hostname : window.location.hostname;
  const ownHosts = new Set([window.location.hostname, canonicalHost, `www.${canonicalHost}`]);

  function updateLink(link) {
    let url;
    try {
      url = new URL(link.getAttribute('href'), window.location.href);
    } catch (_) {
      return;
    }

    if ((url.protocol === 'http:' || url.protocol === 'https:') &&
        url.origin !== window.location.origin && !ownHosts.has(url.hostname)) {
      link.target = '_blank';
      link.relList.add('noopener', 'noreferrer');
    }
  }

  function updateLinks(root) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches('a[href]')) updateLink(root);
    root.querySelectorAll('a[href]').forEach(updateLink);
  }

  updateLinks(document.documentElement);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === 'attributes') {
        updateLink(mutation.target);
      } else {
        mutation.addedNodes.forEach(updateLinks);
      }
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
})();
