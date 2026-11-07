"""Public-post updater checks; no network or third-party libraries."""
import importlib.util
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("media_updater", Path(__file__).parents[1] / "scripts/update-media.py")
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


class LatestPostTests(unittest.TestCase):
    def test_saved_cover_is_reused_without_a_network_request(self):
        entry = {"title": "Saved post", "link": "https://medium.com/piratechain/post-123456789abc", "pubDate": "2026-11-06 12:00:00"}
        previous = {**entry, "image": "assets/img/publications/123456789abc.webp"}
        with TemporaryDirectory() as directory:
            root = Path(directory)
            cover = root / previous["image"]
            cover.parent.mkdir(parents=True)
            cover.write_bytes(b"saved image")
            with patch.object(media, "ROOT", root), patch.object(media, "fetch") as fetch:
                self.assertEqual(media.publication_entry(entry, [previous])["image"], previous["image"])
                fetch.assert_not_called()

    def test_publication_html_and_schema_stay_in_sync_and_escape_titles(self):
        snapshot = {"publications": [{"title": "<script> & title", "link": f"https://medium.com/piratechain/post-{index}",
                                      "pubDate": "2026-11-06 12:00:00"} for index in range(3)]}
        template = ('<script type="application/ld+json">{"@graph":[{"@id":"https://example.com/#publication-items"}]}</script>'
                    '<!-- saved-publications:start -->old<!-- saved-publications:end -->')
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(template)
            with patch.object(media, "ROOT", root):
                media.refresh_publication_html(snapshot)
            page = (root / "index.html").read_text()
        self.assertIn("&lt;script&gt; &amp; title", page)
        self.assertIn('"numberOfItems": 3', page)
        self.assertEqual(page.count('target="_blank"'), 3)
        self.assertIn("\\u003cscript>", page)

    def test_latest_post_ignores_pinned_order_and_links_outside_articles(self):
        old, new = "1867023280995188985", "2118436386877645169"
        profile = (f'<a href="/PirateChain/status/9999999999999999999">Navigation</a>'
                   f'<article>Pinned<a href="/PirateChain/status/{old}">Old</a></article>'
                   f'<article><a href="/PirateChain/status/{new}">Newest</a></article>').encode()
        url = f"https://x.com/PirateChain/status/{new}"
        embed = {"url": url, "author_url": "https://x.com/PirateChain", "author_name": "Pirate Chain",
                 "html": f'<blockquote><p>First &amp; second<br>Next line</p><a href="{url}">November 5, 2026</a></blockquote>'}
        with patch.object(media, "fetch", side_effect=[profile, json.dumps(embed).encode()]):
            post = media.latest_x_post()
        self.assertEqual(post["id"], new)
        self.assertEqual(post["text"], "First & second\nNext line")
        self.assertEqual(post["publishedAt"], "2026-11-05")

    def test_text_preview_does_not_download_unused_post_photos(self):
        post_id = "2118436386877645169"
        url = f"https://x.com/PirateChain/status/{post_id}"
        profile = (f'<article><a href="/PirateChain/status/{post_id}">Newest</a>'
                   '<img src="https://pbs.twimg.com/media/example.webp"></article>').encode()
        embed = {"url": url, "author_url": "https://x.com/PirateChain", "author_name": "Pirate Chain",
                 "html": f'<p>Post text</p><a href="{url}">November 5, 2026</a>'}
        with patch.object(media, "fetch", side_effect=[profile, json.dumps(embed).encode()]) as fetch:
            post = media.latest_x_post()
        self.assertEqual(fetch.call_count, 2)
        self.assertNotIn("image", post)

    def test_missing_posts_and_wrong_author_do_not_replace_saved_content(self):
        with patch.object(media, "fetch", return_value=b'<div>No public posts</div>'):
            with self.assertRaises(ValueError):
                media.latest_x_post()
        profile = b'<article><a href="/PirateChain/status/2118436386877645169">Post</a></article>'
        with patch.object(media, "fetch", side_effect=[profile, b'{"url":"https://example.com/post"}']):
            with self.assertRaises(ValueError):
                media.latest_x_post()


if __name__ == "__main__":
    unittest.main()
