#!/usr/bin/env python3
"""Refresh public feed metadata and the latest video poster; standard library only.

Runs at deployment time. Visitors get local media, not a third-party thumbnail request.
On upstream failure, retain the dated snapshot already in the repository.
"""
import json
import re
import urllib.request
from urllib.parse import urlparse
from html import escape, unescape
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANNEL = "UCd2zagYKjbo1mLTwIxEd06w"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; pirate.black public-feed updater)"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read()


def from_channel_page(html):
    marker = re.search(r"(?:var\s+)?ytInitialData\s*=\s*", html)
    if not marker:
        raise ValueError("Channel data unavailable")
    data = json.JSONDecoder().raw_decode(html[marker.end():])[0]
    # Only scan the selected channel Videos tab, never recommendations/header links.
    tabs = data["contents"]["twoColumnBrowseResultsRenderer"]["tabs"]
    selected = next(tab["tabRenderer"] for tab in tabs if tab.get("tabRenderer", {}).get("selected"))

    def walk(value):
        if isinstance(value, dict):
            video = value.get("videoRenderer")
            if video:
                return {"id": video["videoId"], "title": "".join(run["text"] for run in video["title"]["runs"])}
            lockup = value.get("lockupViewModel", {})
            if lockup.get("contentType") == "LOCKUP_CONTENT_TYPE_VIDEO":
                return {"id": lockup["contentId"], "title": lockup["metadata"]["lockupMetadataViewModel"]["title"]["content"]}
            for child in value.values():
                found = walk(child)
                if found:
                    return found
        elif isinstance(value, list):
            for child in value:
                found = walk(child)
                if found:
                    return found
        return None

    result = walk(selected["content"])
    if not result:
        raise ValueError("No channel upload found")
    return result


def latest_video():
    try:
        root = ET.fromstring(fetch(f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL}"))
        ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
        entry = root.find("atom:entry", ns)
        return {"id": entry.findtext("yt:videoId", namespaces=ns), "title": entry.findtext("atom:title", namespaces=ns)}
    except Exception:
        return from_channel_page(fetch("https://www.youtube.com/@PirateChain/videos").decode())


class PostText(HTMLParser):
    """Read plain text and the date from X's official oEmbed response."""
    def __init__(self):
        super().__init__()
        self.paragraph = False
        self.date_link = False
        self.text = []
        self.date = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "p":
            self.paragraph = True
        elif tag == "br" and self.paragraph:
            self.text.append("\n")
        elif tag == "a" and re.match(r"https://(?:x|twitter)\.com/PirateChain/status/\d+", attrs.get("href", "")):
            self.date_link = True

    def handle_endtag(self, tag):
        if tag == "p":
            self.paragraph = False
        elif tag == "a":
            self.date_link = False

    def handle_data(self, data):
        if self.paragraph:
            self.text.append(data)
        if self.date_link:
            self.date.append(data)


def latest_x_post():
    profile = fetch("https://x.com/PirateChain").decode()
    # Only real links in rendered post articles, excluding scripts and navigation.
    articles = re.findall(r"<article\b[^>]*>(.*?)</article>", profile, re.S)
    posts = [(post_id, article) for article in articles for post_id in
             re.findall(r'href="/PirateChain/status/(\d{15,25})"', article)]
    if not posts:
        raise ValueError("No public profile posts found")
    post_id, article = max(posts, key=lambda item: int(item[0]))
    url = f"https://x.com/PirateChain/status/{post_id}"
    embed = json.loads(fetch("https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=" + url))
    if embed.get("url") != url or embed.get("author_url") != "https://x.com/PirateChain":
        raise ValueError("Unexpected post author")
    parsed = PostText()
    parsed.feed(embed["html"])
    text = re.sub(r"\s*pic\.twitter\.com/\S+\s*$", "", "".join(parsed.text)).strip()
    published = datetime.strptime("".join(parsed.date).strip(), "%B %d, %Y").date().isoformat()
    if not text:
        raise ValueError("Post text unavailable")
    post = {"id": post_id, "url": url, "author": embed["author_name"], "text": text, "publishedAt": published}
    return post


def publication_entry(item, previous=()):
    entry = {key: item[key] for key in ("title", "link", "pubDate")}
    old = next((article for article in previous if article["link"].split("?")[0] == item["link"].split("?")[0]), {})
    # Reuse an existing local cover, including manually optimized WebP images.
    if old.get("image") and (ROOT / old["image"]).is_file():
        entry["image"] = old["image"]
        return entry
    candidates = [item.get("thumbnail", "")] + re.findall(r'<img\b[^>]*\bsrc=["\']([^"\']+)["\']', item.get("content") or item.get("description", ""), re.I)
    image_url = next((unescape(url) for url in candidates if isinstance(url, str) and urlparse(unescape(url)).scheme == "https" and urlparse(unescape(url)).hostname in {"cdn-images-1.medium.com", "cdn-images-2.medium.com", "miro.medium.com"}), None)
    post_id = re.search(r"-([a-f0-9]{12})(?:\?|$)", item["link"])
    try:
        if not image_url or not post_id:
            raise ValueError("No article cover")
        image = fetch(image_url)
        extension = "png" if image.startswith(b"\x89PNG\r\n\x1a\n") else "jpg" if image.startswith(b"\xff\xd8\xff") else "webp" if image.startswith(b"RIFF") and image[8:12] == b"WEBP" else None
        if not extension:
            raise ValueError("Invalid article image")
        relative = f"assets/img/publications/{post_id[1]}.{extension}"
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(image)
        entry["image"] = relative
    except Exception:
        if old.get("image"):
            entry["image"] = old["image"]
    return entry


def refresh_publication_html(saved):
    """Keep crawlable HTML and its ItemList synchronized with the saved feed."""
    path = ROOT / "index.html"
    page = path.read_text()
    entries = saved.get("publications", [])[:3]
    rows = []
    for entry in entries:
        url = urlparse(entry["link"])
        if url.scheme != "https" or url.hostname != "medium.com":
            raise ValueError("Invalid publication URL")
        date = datetime.fromisoformat(entry["pubDate"]).date().isoformat()
        href = escape(entry["link"], quote=True)
        item_id = escape(entry["link"].split("?")[0], quote=True)
        title = escape(entry["title"])
        cover = entry.get("image", "")
        image = ""
        if re.fullmatch(r"assets/img/publications/[a-f0-9]{12}\.(png|jpg|webp)", cover):
            image = f'<img alt="" class="publication-thumbnail" height="172" loading="lazy" src="{cover}" width="264" itemprop="image"/>'
        rows.append(f'''          <a target="_blank" rel="noopener noreferrer" class="publication-row{' publication-without-thumbnail' if not image else ''}" href="{href}" itemscope="" itemtype="https://schema.org/Article" itemid="{item_id}">
            {image}
            <div class="publication-copy">
              <time datetime="{date}" itemprop="datePublished">{date}</time>
              <h3 itemprop="headline">{title}</h3>
            </div>
          </a>''')
    if len(rows) != 3:
        raise ValueError("Three publications required")
    page, count = re.subn(r"(<!-- saved-publications:start -->)[\s\S]*?(<!-- saved-publications:end -->)",
                         lambda match: match[1] + "\n" + "\n".join(rows) + "\n          " + match[2], page)
    if count != 1:
        raise ValueError("Publication HTML markers missing")

    def update_schema(match):
        data = json.loads(match[1])
        listing = next(node for node in data["@graph"] if node.get("@id", "").endswith("#publication-items"))
        listing["numberOfItems"] = len(entries)
        listing["itemListElement"] = [{"@type": "ListItem", "position": index + 1,
                                      "url": entry["link"].split("?")[0], "name": entry["title"]}
                                     for index, entry in enumerate(entries)]
        encoded = json.dumps(data, indent=2, ensure_ascii=False).replace("<", "\\u003c")
        return '<script type="application/ld+json">\n' + "\n".join("    " + line for line in encoded.splitlines()) + '\n    </script>'

    page = re.sub(r'<script type="application/ld\+json">([\s\S]*?)</script>', update_schema, page, count=1)
    path.write_text(page)


def main():
    path = ROOT / "assets/data/media.json"
    saved = json.loads(path.read_text())
    now = datetime.now(timezone.utc)
    changed = False
    try:
        saved["xPost"] = latest_x_post()
        saved["xCheckedAt"] = now.isoformat()
        changed = True
        print("Updated latest official X post.")
    except Exception as error:
        print(f"X unavailable; retaining dated post ({type(error).__name__}).")
    try:
        video = latest_video()
        if not re.fullmatch(r"[\w-]{11}", video["id"]) or not video["title"]:
            raise ValueError("Invalid video metadata")
        thumbnail = fetch(f"https://i.ytimg.com/vi/{video['id']}/hqdefault.jpg")
        if not thumbnail.startswith(b"\xff\xd8\xff"):
            raise ValueError("Invalid thumbnail")
        (ROOT / "assets/img/videos/latest.jpg").write_bytes(thumbnail)
        video.update(caption="", image="assets/img/videos/latest.jpg")
        saved["videos"][0] = video
        saved["videoCheckedAt"] = now.isoformat()
        changed = True
        print("Updated latest official channel upload.")
    except Exception as error:
        print(f"Video feed unavailable; retaining dated snapshot ({type(error).__name__}).")
    try:
        feed = json.loads(fetch("https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fmedium.com%2Ffeed%2Fpiratechain"))
        items = feed.get("items", [])
        if feed.get("status") != "ok" or len(items) < 3:
            raise ValueError("Invalid publication feed")
        saved["publications"] = [publication_entry(item, saved.get("publications", [])) for item in items[:3]]
        saved["updatedAt"] = now.isoformat()
        changed = True
        print("Updated three publication entries.")
    except Exception as error:
        print(f"Publication feed unavailable; retaining dated snapshot ({type(error).__name__}).")
    if changed:
        path.write_text(json.dumps(saved, indent=2, ensure_ascii=False) + "\n")
    refresh_publication_html(saved)


if __name__ == "__main__":
    main()
