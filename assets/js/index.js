// Show the latest article from the configured Medium publication feed.
const privacySpoiler = document.querySelector('.privacy-spoiler');
if (privacySpoiler) {
  privacySpoiler.addEventListener('click', () => {
    const revealed = privacySpoiler.classList.toggle('is-revealed');
    privacySpoiler.setAttribute('aria-pressed', String(revealed));
    privacySpoiler.setAttribute('aria-label', revealed ? 'Hide financial privacy' : 'Reveal financial privacy');
  });
}

function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch (_) {
    return null;
  }
}

function renderMediumArticle(item) {
  const sourceText = item.description || item.content || '';
  const description = new DOMParser().parseFromString(sourceText, 'text/html');
  const article = document.createElement('article');
  article.className = 'update-post';

  const link = document.createElement('a');
  link.href = httpsUrl(item.link);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const feedImage = description.querySelector('img[src]');
  const thumbnail = httpsUrl(item.thumbnail) || httpsUrl(feedImage && feedImage.getAttribute('src'));
  if (thumbnail) {
    const image = document.createElement('img');
    image.className = 'update-img';
    image.src = thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    link.appendChild(image);
  }

  const content = document.createElement('div');
  content.className = 'update-content';
  const preview = document.createElement('div');
  preview.className = 'update-preview';
  const date = typeof item.pubDate === 'string' ? item.pubDate.slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const time = document.createElement('time');
    time.className = 'update-date';
    time.dateTime = date;
    time.textContent = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
    });
    preview.appendChild(time);
  }
  const title = document.createElement('h3');
  title.className = 'update-title';
  title.textContent = item.title;
  preview.appendChild(title);

  const plainText = description.body.textContent.replace(/\s+/g, ' ').trim();
  if (plainText) {
    const intro = document.createElement('p');
    intro.className = 'update-intro';
    if (plainText.length > 150) {
      const excerpt = plainText.slice(0, 150);
      const wordBreak = excerpt.lastIndexOf(' ');
      intro.textContent = (wordBreak > 100 ? excerpt.slice(0, wordBreak) : excerpt).trimEnd() + '…';
    } else {
      intro.textContent = plainText;
    }
    preview.appendChild(intro);
  }
  content.appendChild(preview);

  const readMore = document.createElement('span');
  readMore.className = 'update-read-more';
  readMore.textContent = 'Read more →';
  content.appendChild(readMore);
  link.appendChild(content);
  article.appendChild(link);
  return article;
}

const mediumContainer = document.querySelector('.update-article');
function loadMediumArticles() {
  try {
    const apiUrl = new URL(mediumContainer.dataset.apiUrl);
    apiUrl.searchParams.set('rss_url', mediumContainer.dataset.feedUrl);
    fetch(apiUrl.href)
      .then(response => {
        if (!response.ok) throw new Error(`Feed service returned HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (data.status !== 'ok' || !Array.isArray(data.items)) {
          throw new Error(data.message || 'Feed service returned no articles');
        }
        const count = Math.min(6, Math.max(1, parseInt(mediumContainer.dataset.count, 10) || 3));
        const articles = data.items
          .filter(item => item && item.title && httpsUrl(item.link))
          .slice(0, count);
        if (!articles.length) throw new Error('Feed has no usable articles');
        mediumContainer.replaceChildren(...articles.map(renderMediumArticle));
      })
      .catch(error => console.warn('Pirate Chain Medium feed unavailable:', error));
  } catch (error) {
    console.warn('Pirate Chain Medium feed configuration is invalid:', error);
  }
}
if (mediumContainer && mediumContainer.dataset.feedUrl && mediumContainer.dataset.apiUrl) {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      loadMediumArticles();
    }, { rootMargin: '1200px' });
    observer.observe(mediumContainer);
  } else {
    loadMediumArticles();
  }
}

//rotate word in hero section
var TxtRotate = function(el, toRotate, period) {
  this.toRotate = toRotate;
  this.el = el;
  this.loopNum = 0;
  this.period = parseInt(period, 10) || 2000;
  this.txt = '';
  this.tick();
  this.isDeleting = false;
};

TxtRotate.prototype.tick = function() {
  var i = this.loopNum % this.toRotate.length;
  var fullTxt = this.toRotate[i];

  if (this.isDeleting) {
    this.txt = fullTxt.substring(0, this.txt.length - 1);
  } else {
    this.txt = fullTxt.substring(0, this.txt.length + 1);
  }

  this.el.innerHTML = '<span class="wrap">'+this.txt+'</span>';

  var that = this;
  var delta = 300 - Math.random() * 100;

  if (this.isDeleting) { delta /= 2; }

  if (!this.isDeleting && this.txt === fullTxt) {
    delta = this.period;
    this.isDeleting = true;
  } else if (this.isDeleting && this.txt === '') {
    this.isDeleting = false;
    this.loopNum++;
    delta = 500;
  }

  setTimeout(function() {
    that.tick();
  }, delta);
};

window.onload = function() {
  var elements = document.getElementsByClassName('txt-rotate');
  for (var i=0; i<elements.length; i++) {
    var toRotate = elements[i].getAttribute('data-rotate');
    var period = elements[i].getAttribute('data-period');
    if (toRotate) {
      new TxtRotate(elements[i], JSON.parse(toRotate), period);
    }
  }
  // INJECT CSS
  var css = document.createElement("style");
  css.type = "text/css";
  css.innerHTML = ".txt-rotate > .wrap { border-right: 0.08em solid #666 }";
  document.body.appendChild(css);

};
