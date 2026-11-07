#!/usr/bin/env python3
"""Check local links, module imports, CSS resources, SVGs, and duplicate HTML IDs.

Standard library only. Does not request remote URLs or require a build step.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import json
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
errors = []


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path, self.ids, self.links = path, set(), []
        self.canonical, self.robots, self.schemas = None, None, []
        self.schema_text = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'a' and attrs.get('href', '').startswith(('https://', 'http://')):
            if attrs.get('target') != '_blank' or not {'noopener', 'noreferrer'} <= set(attrs.get('rel', '').split()):
                errors.append(f'{self.path.name}: external link must open safely in a new tab: {attrs["href"]}')
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')
        if tag == 'meta' and attrs.get('name') == 'robots':
            self.robots = attrs.get('content', '')
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.schema_text = ''
        for name, value in attributes:
            if name == 'id':
                if value in self.ids:
                    errors.append(f'{self.path.name}: duplicate ID {value}')
                self.ids.add(value)
            if name in {'src', 'href', 'poster'} and value:
                self.links.append(value)

    def handle_data(self, data):
        if self.schema_text is not None:
            self.schema_text += data

    def handle_endtag(self, tag):
        if tag == 'script' and self.schema_text is not None:
            try:
                self.schemas.append(json.loads(self.schema_text))
            except json.JSONDecodeError as error:
                errors.append(f'{self.path.name}: invalid JSON-LD: {error}')
            self.schema_text = None

    handle_startendtag = handle_starttag


pages = {}
for path in ROOT.glob('*.html'):
    page = Page(path)
    page.feed(path.read_text())
    pages[path] = page


def check_link(source, value):
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return
    target = (source.parent / unquote(url.path)).resolve() if url.path else source
    if not target.is_relative_to(ROOT):
        errors.append(f'{source.relative_to(ROOT)}: path leaves the project: {value}')
    elif not target.is_file():
        errors.append(f'{source.relative_to(ROOT)}: missing {value}')
    elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
        errors.append(f'{source.relative_to(ROOT)}: missing bookmark {value}')


for path, page in pages.items():
    if not page.canonical or urlsplit(page.canonical).scheme != 'https':
        errors.append(f'{path.name}: missing HTTPS canonical URL')
    if not page.robots or not {'index', 'follow'} <= set(part.strip() for part in page.robots.split(',')):
        errors.append(f'{path.name}: missing index/follow crawler policy')
    if not page.schemas or any(data.get('@context') != 'https://schema.org' or not data.get('@graph') for data in page.schemas):
        errors.append(f'{path.name}: missing Schema.org graph')
    for value in page.links:
        check_link(path, value)

sitemap = ET.parse(ROOT / 'sitemap.xml')
locations = {node.text for node in sitemap.findall('{*}url/{*}loc')}
if locations != {page.canonical for page in pages.values()}:
    errors.append('sitemap.xml: URLs must match the page canonical URLs')

for path in (ROOT / 'assets/css').glob('*.css'):
    for value in re.findall(r'url\([\'"]?([^\)\'"\s]+)', path.read_text()):
        if not value.startswith('#'):
            check_link(path, value)

for path in (ROOT / 'assets/js').glob('*.js'):
    text = path.read_text()
    for value in re.findall(r'\bfrom\s+[\'"]([^\'"]+)', text):
        check_link(path, value)
    # Static asset strings; platform icon templates are verified by wallet tests and browser QA.
    for value in re.findall(r'[\'"](assets/[\w/.-]+\.(?:svg|webp|png|jpg|json))[\'"]', text):
        check_link(ROOT / 'index.html', value)

for path in (ROOT / 'assets/img').rglob('*.svg'):
    try:
        ET.parse(path)
    except ET.ParseError as error:
        errors.append(f'{path.relative_to(ROOT)}: {error}')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'Checked {len(pages)} HTML pages, local links and scripts, CSS resources, and SVG files.')
